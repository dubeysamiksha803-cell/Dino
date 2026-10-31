import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";

type CommunityRow = {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  created_at: string | null;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

export async function GET(req: NextRequest) {
  try {
    // Parse query params for filtering
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all"; // all | popular | new | joined
    const userId = searchParams.get("userId");
    const sort = searchParams.get("sort") || "recent"; // recent | members | name

    const { data, error } = await supabase
      .from("communities")
      .select("id, name, description, slug, avatar_url, cover_url, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    // Fetch member counts for all communities
    const communityIds = (data ?? []).map((c: CommunityRow) => c.id);
    const memberCounts: Record<string, number> = {};
    const userJoinedCommunities = new Set<string>();

    if (communityIds.length > 0) {
      // Get counts by community
      const { data: membersData } = await supabase
        .from("community_members")
        .select("community_id, user_id")
        .in("community_id", communityIds);

      // Count members per community and track user's memberships
      (membersData ?? []).forEach((m: { community_id: string; user_id: string }) => {
        memberCounts[m.community_id] = (memberCounts[m.community_id] || 0) + 1;
        if (userId && m.user_id === userId) {
          userJoinedCommunities.add(m.community_id);
        }
      });
    }

    const now = Date.now();
    const NEW_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

    // Map communities with additional data
    let communities = (data ?? []).map((c: CommunityRow) => {
      const createdAt = c.created_at ? new Date(c.created_at).getTime() : 0;
      const isJoined = userJoinedCommunities.has(c.id);
      return {
        id: c.id,
        name: c.name,
        description: c.description ?? null,
        slug: c.slug ?? null,
        avatar_url: c.avatar_url ?? null,
        cover_url: c.cover_url ?? null,
        created_at: c.created_at ?? null,
        membersCount: memberCounts[c.id] || 0,
        isNew: now - createdAt < NEW_THRESHOLD_MS,
        joinLabel: isJoined ? "Joined" : undefined,
      };
    });

    // Apply filter
    if (filter === "popular") {
      communities = communities.filter((c) => c.membersCount >= 5);
    } else if (filter === "new") {
      communities = communities.filter((c) => c.isNew);
    } else if (filter === "joined") {
      communities = communities.filter((c) => c.joinLabel === "Joined");
    }

    // Apply sort
    if (sort === "members") {
      communities.sort((a, b) => b.membersCount - a.membersCount);
    } else if (sort === "name") {
      communities.sort((a, b) => a.name.localeCompare(b.name));
    }
    // 'recent' is already the default order from the query

    return NextResponse.json(communities);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description = null } = body ?? {};
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    // derive user from Bearer token to satisfy RLS (created_by = auth.uid())
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const sreq = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userRes, error: userErr } = await sreq.auth.getUser();
    if (userErr || !userRes?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const createdBy = userRes.user.id;

    const baseSlug = slugify(name.trim());
    if (!baseSlug) {
      return NextResponse.json({ error: "invalid name" }, { status: 400 });
    }

    let attempt = 0;
    let lastErr: unknown = null;
    while (attempt < 3) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await sreq
        .from("communities")
        .insert({ name: name.trim(), description, slug, created_by: createdBy })
        .select("id")
        .single();
      if (!error) {
        // Auto-add creator as owner
        try {
          await sreq
            .from("community_members")
            .insert({ community_id: data!.id, user_id: createdBy, role: "owner", status: "active" });
        } catch { }
        return NextResponse.json({ id: data!.id });
      }
      lastErr = error;
      if (typeof (error as { code?: unknown }).code === "string" && (error as { code?: string }).code === "23505") {
        attempt += 1;
        continue;
      }
      break;
    }
    if (lastErr instanceof Error) {
      throw lastErr;
    }
    throw new Error("failed to create community");
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
