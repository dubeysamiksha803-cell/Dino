import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

async function resolveCommunityId(client: SupabaseClient, key: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
  if (isUuid) {
    const byId = await client
      .from("communities")
      .select("id")
      .eq("id", key)
      .maybeSingle();
    if (!byId.error && byId.data) return byId.data.id as string;
  }
  const byName = await client
    .from("communities")
    .select("id")
    .eq("name", key)
    .maybeSingle();
  if (!byName.error && byName.data) return byName.data.id as string;
  try {
    const bySlug = await client
      .from("communities")
      .select("id")
      .eq("slug", key)
      .maybeSingle();
    if (!bySlug.error && bySlug.data) return bySlug.data.id as string;
  } catch {}
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key: raw } = await params;
    const key = decodeURIComponent(raw).trim();
    if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const client = createClient(url, anon);

    const communityId = await resolveCommunityId(client, key);
    if (!communityId) return NextResponse.json({ error: "not found" }, { status: 404 });

    const { data, error } = await client
      .from("community_members")
      .select(
        "user_id, role, status, joined_at, users ( id, username, avatar_url )"
      )
      .eq("community_id", communityId)
      .order("joined_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    type UserRow = { id: string; username: string | null; avatar_url: string | null } | null;
    const members = (data ?? []).map((row) => {
      const u = (row as unknown as { users: UserRow }).users;
      return {
        userId: (row as { user_id: string }).user_id,
        role: (row as { role: string }).role,
        status: (row as { status: string }).status,
        joinedAt: (row as { joined_at: string | null }).joined_at,
        user: u
          ? {
              id: u.id,
              username: u.username,
              avatar_url: u.avatar_url,
            }
          : null,
      };
    });

    return NextResponse.json(members);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key: raw } = await params;
    const key = decodeURIComponent(raw).trim();
    const { userId } = await req.json();
    if (!userId || typeof userId !== "string") return NextResponse.json({ error: "userId required" }, { status: 400 });
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const client = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });

    const communityId = await resolveCommunityId(client, key);
    if (!communityId) return NextResponse.json({ error: "not found" }, { status: 404 });
    const { error } = await client.from("community_members").insert({ community_id: communityId, user_id: userId });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key: raw } = await params;
    const key = decodeURIComponent(raw).trim();
    const { userId } = await req.json();
    if (!userId || typeof userId !== "string") return NextResponse.json({ error: "userId required" }, { status: 400 });
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const client = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });

    const communityId = await resolveCommunityId(client, key);
    if (!communityId) return NextResponse.json({ error: "not found" }, { status: 404 });

    const { error } = await client
      .from("community_members")
      .delete()
      .eq("community_id", communityId)
      .eq("user_id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
