import { createClient } from "@/lib/supabaseServer";
import { removeMember } from "@/lib/chatAdmin";
import { NextResponse } from "next/server";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ chatId: string; userId: string }> }
) {
  try {
    const { chatId, userId } = await params;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await removeMember(supabase, chatId, user.id, userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[remove]", err);
    const message = err instanceof Error ? err.message : "Failed to remove member";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
