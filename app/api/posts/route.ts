import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

type MediaRow = { id: string; post_id: string; file_url: string; file_type: string | null; position: number | null };
type LikeRow = { post_id: string };
type AuthorRow = { id: string; username: string; avatar_url: string | null };

export async function GET() {
  try {
    const { data: posts, error } = await supabase
      .from("posts")
      .select("id, author_id, post_type, content, link_url, visibility, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw error;

    if (!posts || posts.length === 0) return NextResponse.json([]);

    const ids = posts.map((p) => p.id);
    const authorIds = Array.from(new Set(posts.map((p) => p.author_id)));

    const [mediaRes, likesRes, authorsRes] = await Promise.all([
      supabase.from("post_media").select("id, post_id, file_url, file_type, position").in("post_id", ids),
      supabase.from("post_reactions").select("post_id").eq("reaction", "like").in("post_id", ids),
      supabase.from("users").select("id, username, avatar_url").in("id", authorIds),
    ]);

    const mediaMap = new Map<string, Array<{ id: string; file_url: string; file_type: string | null; position: number }>>();
    if (mediaRes.data) {
      for (const m of mediaRes.data as MediaRow[]) {
        const arr = mediaMap.get(m.post_id) ?? [];
        arr.push({ id: m.id, file_url: m.file_url, file_type: m.file_type, position: m.position ?? 0 });
        mediaMap.set(m.post_id, arr);
      }
      for (const [, arr] of mediaMap) arr.sort((a, b) => a.position - b.position);
    }

    const likeCount = new Map<string, number>();
    if (likesRes.data) {
      for (const r of likesRes.data as LikeRow[]) likeCount.set(r.post_id, (likeCount.get(r.post_id) ?? 0) + 1);
    }

    const authorMap = new Map<string, { id: string; username: string; avatar_url: string | null }>();
    if (authorsRes.data) {
      for (const a of authorsRes.data as AuthorRow[]) authorMap.set(a.id, a);
    }

    const enriched = posts.map((p) => ({
      ...p,
      media: mediaMap.get(p.id) ?? [],
      like_count: likeCount.get(p.id) ?? 0,
      author: authorMap.get(p.author_id) ?? null,
    }));

    return NextResponse.json(enriched);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { authorId, content, mediaUrls = [], postType = "text", visibility = "public", linkUrl = null } = body ?? {};
    if (!authorId) return NextResponse.json({ error: "authorId required" }, { status: 400 });

    const { data: post, error } = await supabase
      .from("posts")
      .insert({ author_id: authorId, content, post_type: postType, visibility, link_url: linkUrl })
      .select("id")
      .single();
    if (error) throw error;

    if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
      const rows = mediaUrls.map((url: string, i: number) => ({ post_id: post.id, file_url: url, position: i }));
      const { error: mErr } = await supabase.from("post_media").insert(rows);
      if (mErr) throw mErr;
    }

    return NextResponse.json({ id: post.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
