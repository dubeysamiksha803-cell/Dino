import { supabase } from "./supabaseClient";
import { sendNotification } from "./notifications";

export type PublicUser = {
  id: string;
  username: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

export type FriendRequest = {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  responded_at: string | null;
  sender?: { id: string; username: string; avatar_url: string | null } | null;
  receiver?: { id: string; username: string; avatar_url: string | null } | null;
};

export async function searchUsersByUsername(query: string) {
  const { data, error } = await supabase
    .from("users")
    .select("id, username, email, full_name")
    .ilike("username", `%${query}%`)
    .limit(10);
  if (error) throw error;
  return (data ?? []) as PublicUser[];
}

export async function listFriends(myId: string) {
  const { data, error } = await supabase
    .from("friends")
    .select("friend_id, created_at, users:users!friends_friend_id_fkey(id, username, avatar_url)")
    .eq("user_id", myId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    created_at: string;
    users?: { id: string; username: string; avatar_url: string | null } | Array<{ id: string; username: string; avatar_url: string | null } | null> | null;
  }>;
  return rows.map((r) => {
    const userField = r.users;
    const u = Array.isArray(userField) ? (userField[0] ?? null) : (userField ?? null);
    return {
      id: u?.id ?? "",
      username: u?.username ?? "",
      avatar_url: u?.avatar_url ?? null,
      since: r.created_at,
    };
  });
}

export async function listIncomingRequests(myId: string) {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, sender_id, receiver_id, status, created_at, responded_at, sender:users!friend_requests_sender_id_fkey(id, username, avatar_url)")
    .eq("receiver_id", myId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  type UserObj = { id?: string; username?: string; avatar_url?: string | null };
  type Row = {
    id: string; sender_id: string; receiver_id: string; status: FriendRequest["status"]; created_at: string; responded_at: string | null;
    sender?: UserObj | UserObj[] | null;
  };
  const rows = (data as unknown as Row[] | null) ?? [];
  return rows.map((r): FriendRequest => {
    const s = Array.isArray(r.sender) ? (r.sender[0] ?? null) : (r.sender ?? null);
    return {
      id: r.id,
      sender_id: r.sender_id,
      receiver_id: r.receiver_id,
      status: r.status,
      created_at: r.created_at,
      responded_at: r.responded_at,
      sender: s ? { id: s.id ?? "", username: s.username ?? "", avatar_url: s.avatar_url ?? null } : null,
      receiver: undefined,
    };
  });
}

export async function listOutgoingRequests(myId: string) {
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, sender_id, receiver_id, status, created_at, responded_at, receiver:users!friend_requests_receiver_id_fkey(id, username, avatar_url)")
    .eq("sender_id", myId)
    .in("status", ["pending", "rejected", "cancelled"]) // show recent
    .order("created_at", { ascending: false });
  if (error) throw error;
  type UserObj = { id?: string; username?: string; avatar_url?: string | null };
  type Row = {
    id: string; sender_id: string; receiver_id: string; status: FriendRequest["status"]; created_at: string; responded_at: string | null;
    receiver?: UserObj | UserObj[] | null;
  };
  const rows = (data as unknown as Row[] | null) ?? [];
  return rows.map((r): FriendRequest => {
    const rec = Array.isArray(r.receiver) ? (r.receiver[0] ?? null) : (r.receiver ?? null);
    return {
      id: r.id,
      sender_id: r.sender_id,
      receiver_id: r.receiver_id,
      status: r.status,
      created_at: r.created_at,
      responded_at: r.responded_at,
      sender: undefined,
      receiver: rec ? { id: rec.id ?? "", username: rec.username ?? "", avatar_url: rec.avatar_url ?? null } : null,
    };
  });
}

export async function sendFriendRequest(senderId: string, receiverId: string) {
  const { error } = await supabase.from("friend_requests").insert({ sender_id: senderId, receiver_id: receiverId });
  if (error) throw error;

  // Send notification to the receiver about the friend request
  if (senderId !== receiverId) {
    await sendNotification(supabase, {
      user_id: receiverId,
      type: "friend_request",
      actor_id: senderId,
      entity_type: "user",
      entity_id: senderId,
      message: "sent you a friend request",
    });
  }
}

export async function cancelFriendRequest(requestId: string, senderId: string) {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("sender_id", senderId);
  if (error) throw error;
}

export async function acceptFriendRequest(requestId: string, myId: string) {
  const { data, error } = await supabase
    .from("friend_requests")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("receiver_id", myId)
    .select("sender_id, receiver_id")
    .single();
  if (error) throw error;
  const senderId = (data as { sender_id: string; receiver_id: string }).sender_id;
  const receiverId = (data as { sender_id: string; receiver_id: string }).receiver_id;
  // Insert friendship both directions
  const { error: fErr } = await supabase.from("friends").insert([
    { user_id: senderId, friend_id: receiverId },
    { user_id: receiverId, friend_id: senderId },
  ]);
  if (fErr) throw fErr;
}

export async function rejectFriendRequest(requestId: string, myId: string) {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: "rejected", responded_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("receiver_id", myId);
  if (error) throw error;
}

export async function unfriend(myId: string, friendId: string) {
  const { error } = await supabase
    .from("friends")
    .delete()
    .or(`and(user_id.eq.${myId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${myId})`);
  if (error) throw error;
}

export async function toggleFavorite(myId: string, friendId: string, isFav: boolean) {
  const { error } = await supabase
    .from("friends")
    .update({ is_favorite: isFav })
    .eq("user_id", myId)
    .eq("friend_id", friendId);
  if (error) throw error;
}

export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase.from("blocked_users").insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw error;
}

export async function createDirectChatIfNotExists(myId: string, otherId: string) {
  // Check for existing direct chat with both members
  const { data: existing, error: exErr } = await supabase
    .from("chats")
    .select("id, type, chat_members:chat_members(chat_id, user_id)")
    .eq("type", "direct");
  if (exErr) throw exErr;
  type ExistingChat = { id: string; chat_members?: Array<{ chat_id: string; user_id: string } | null> | null };
  const match = (existing ?? []).find((c: ExistingChat) => {
    const uids = (c.chat_members ?? []).map((m) => m?.user_id).filter(Boolean) as string[];
    return uids.includes(myId) && uids.includes(otherId) && uids.length === 2;
  });
  if (match) return match.id as string;

  // Create new chat + membership
  const { data: chat, error: cErr } = await supabase
    .from("chats")
    .insert({ type: "direct" })
    .select("id")
    .single();
  if (cErr) throw cErr;
  const chatId = (chat as { id: string }).id;
  const { error: mErr } = await supabase.from("chat_members").insert([
    { chat_id: chatId, user_id: myId },
    { chat_id: chatId, user_id: otherId },
  ]);
  if (mErr) throw mErr;
  return chatId;
}
