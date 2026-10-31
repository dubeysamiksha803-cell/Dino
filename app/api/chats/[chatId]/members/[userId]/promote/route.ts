import { createClient } from "@/lib/supabaseServer";
import { promoteToAdmin } from "@/lib/chatAdmin";
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

    await promoteToAdmin(supabase, chatId, user.id, userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[promote]", err);
    const message = err instanceof Error ? err.message : "Failed to promote";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
