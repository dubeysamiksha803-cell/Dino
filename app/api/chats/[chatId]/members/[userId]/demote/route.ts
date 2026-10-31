import { createClient } from "@/lib/supabaseServer";
import { demoteAdmin } from "@/lib/chatAdmin";
import { NextResponse } from "next/server";

export async function POST(
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

    await demoteAdmin(supabase, chatId, user.id, userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[demote]", err);
    const message = err instanceof Error ? err.message : "Failed to demote";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
