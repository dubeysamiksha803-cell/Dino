import type { SupabaseClient } from "@supabase/supabase-js";

export type Role = "owner" | "admin" | "member";

/**
 * Load the current member role for a given chat and user.
 */
async function getMemberRole(
  supabase: SupabaseClient,
  chatId: string,
  userId: string,
): Promise<Role | null> {
  const { data, error } = await supabase
    .from("chat_members")
    .select("role")
    .eq("chat_id", chatId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.role as Role | null) ?? null;
}

/**
 * Promote a member to admin (owner only).
 */
export async function promoteToAdmin(
  supabase: SupabaseClient,
  chatId: string,
  currentUserId: string, // who is acting
  targetUserId: string,  // who will become admin
): Promise<void> {
  const myRole = await getMemberRole(supabase, chatId, currentUserId);
  if (myRole !== "owner") {
    throw new Error("Only the owner can promote admins");
  }

  const targetRole = await getMemberRole(supabase, chatId, targetUserId);
  if (!targetRole) throw new Error("Target is not a member of this chat");
  if (targetRole === "owner") throw new Error("Cannot change owner role");
  if (targetRole === "admin") return; // already admin

  const { error } = await supabase
    .from("chat_members")
    .update({ role: "admin" })
    .eq("chat_id", chatId)
    .eq("user_id", targetUserId);

  if (error) throw error;
}

/**
 * Demote an admin back to member (owner only).
 */
export async function demoteAdmin(
  supabase: SupabaseClient,
  chatId: string,
  currentUserId: string,
  targetUserId: string,
): Promise<void> {
  const myRole = await getMemberRole(supabase, chatId, currentUserId);
  if (myRole !== "owner") {
    throw new Error("Only the owner can demote admins");
  }

  const targetRole = await getMemberRole(supabase, chatId, targetUserId);
  if (!targetRole) throw new Error("Target is not a member of this chat");
  if (targetRole !== "admin") return; // nothing to do

  const { error } = await supabase
    .from("chat_members")
    .update({ role: "member" })
    .eq("chat_id", chatId)
    .eq("user_id", targetUserId);

  if (error) throw error;
}

/**
 * Remove a member from the group.
 * Owner can remove admin/member.
 * Admin can only remove members.
 */
export async function removeMember(
  supabase: SupabaseClient,
  chatId: string,
  currentUserId: string,
  targetUserId: string,
): Promise<void> {
  const myRole = await getMemberRole(supabase, chatId, currentUserId);
  if (!myRole) throw new Error("You are not a member of this chat");

  const targetRole = await getMemberRole(supabase, chatId, targetUserId);
  if (!targetRole) return; // already gone

  if (myRole === "owner") {
    if (targetRole === "owner") throw new Error("Owner cannot remove themselves");
    // owner can remove admin/member
  } else if (myRole === "admin") {
    if (targetRole !== "member") {
      throw new Error("Admins can only remove members");
    }
  } else {
    throw new Error("Only owner or admins can remove members");
  }

  const { error } = await supabase
    .from("chat_members")
    .delete()
    .eq("chat_id", chatId)
    .eq("user_id", targetUserId);

  if (error) throw error;
}

/**
 * Leave the group (self‑leave). Owner cannot leave without transferring ownership.
 */
export async function leaveChat(
  supabase: SupabaseClient,
  chatId: string,
  currentUserId: string,
): Promise<void> {
  const myRole = await getMemberRole(supabase, chatId, currentUserId);
  if (!myRole) return;

  if (myRole === "owner") {
    throw new Error("Owner cannot leave group without transferring ownership");
  }

  const { error } = await supabase
    .from("chat_members")
    .delete()
    .eq("chat_id", chatId)
    .eq("user_id", currentUserId);

  if (error) throw error;
}
