import { createClient } from "@/lib/supabaseServer";
import { leaveChat } from "@/lib/chatAdmin";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await leaveChat(supabase, chatId, user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[leave]", err);
    const message = err instanceof Error ? err.message : "Failed to leave chat";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
