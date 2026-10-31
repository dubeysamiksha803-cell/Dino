import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type CommunityRow = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  rules: string | null;
  created_by: string | null;
  created_at?: string | null;
  avatar_url: string | null;
  cover_url: string | null;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key: raw } = await params;
    const key = decodeURIComponent(raw).trim();
    if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

    // Find community by id (UUID) or by slug (unique)
    let row: CommunityRow | null = null;
    const fields = "id, slug, name, description, rules, created_by, created_at, avatar_url, cover_url";
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
    if (isUuid) {
      const byId = await supabase
        .from("communities")
        .select(fields)
        .eq("id", key)
        .maybeSingle();
      if (!byId.error && byId.data) row = byId.data;
    }
    if (!row) {
      const bySlug = await supabase
        .from("communities")
        .select(fields)
        .eq("slug", key)
        .maybeSingle();
      if (!bySlug.error && bySlug.data) row = bySlug.data;
    }
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Count members (community_members has composite PK (community_id, user_id), no standalone id column)
    const members = await supabase
      .from("community_members")
      .select("user_id", { count: "exact", head: true })
      .eq("community_id", row.id);
    const membersCount = typeof members.count === "number" ? members.count : 0;

    // Joined (optional, if uid provided)
    const url = new URL(req.url);
    const uid = url.searchParams.get("uid");
    let joined: boolean | undefined = undefined;
    if (uid) {
      const check = await supabase
        .from("community_members")
        .select("user_id")
        .eq("community_id", row.id)
        .eq("user_id", uid)
        .maybeSingle();
      joined = !!check.data;
    }

    return NextResponse.json({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description ?? null,
      rules: row.rules ?? null,
      created_by: row.created_by,
      created_at: row.created_at,
      avatar_url: row.avatar_url ?? null,
      cover_url: row.cover_url ?? null,
      membersCount,
      ...(typeof joined === "boolean" ? { joined } : {}),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key: raw } = await params;
    const key = decodeURIComponent(raw).trim();
    const body = await req.json();
    const userId = String(body?.userId || "").trim();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const sreq: SupabaseClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });

    const fields = "id, slug, name, description, rules, created_by, avatar_url, cover_url";
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
    let row: CommunityRow | null = null;
    if (isUuid) {
      const byId = await sreq.from("communities").select(fields).eq("id", key).maybeSingle();
      if (!byId.error && byId.data) row = byId.data;
    }
    if (!row) {
      const bySlug = await sreq.from("communities").select(fields).eq("slug", key).maybeSingle();
      if (!bySlug.error && bySlug.data) row = bySlug.data;
    }
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (row.created_by !== userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    type CommunityUpdate = Partial<Pick<CommunityRow, "name" | "description" | "rules" | "avatar_url" | "cover_url">>;
    const updates: CommunityUpdate = {};
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
    if (typeof body.description === "string") updates.description = body.description;
    if (typeof body.rules === "string") updates.rules = body.rules;
    if (typeof body.avatar_url === "string") updates.avatar_url = body.avatar_url;
    if (typeof body.cover_url === "string") updates.cover_url = body.cover_url;

    if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true });
    const { error } = await sreq.from("communities").update(updates).eq("id", row.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
