"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getImageDisplayUrl } from "@/lib/media";
import { listFriends, listIncomingRequests } from "@/lib/friends";

type UserSummary = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  postsCount: number | null;
  friendsCount: number | null;
  requestsCount: number | null;
};

export default function RightRail() {
  const [user, setUser] = useState<UserSummary | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user;
      if (!sessionUser || !mounted) return;

      const userId = sessionUser.id;

      // Fetch basic profile info from users table
      const [{ data: userRow }, postsCountRes, friendsList, requestsList] = await Promise.all([
        supabase
          .from("users")
          .select("id, username, full_name, avatar_url, cover_url")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userId),
        listFriends(userId).catch(() => []),
        listIncomingRequests(userId).catch(() => []),
      ]);

      if (!mounted) return;

      type UserRow = { id: string; username: string | null; full_name: string | null; avatar_url: string | null; cover_url: string | null } | null;
      const typedUserRow = userRow as UserRow;

      let avatarUrl: string | null = typedUserRow?.avatar_url ?? null;
      if (avatarUrl) {
        try {
          avatarUrl = await getImageDisplayUrl(supabase, avatarUrl);
        } catch {
          // fall back to raw URL if edge function fails
        }
      }

      let coverUrl: string | null = typedUserRow?.cover_url ?? null;
      if (coverUrl) {
        try {
          coverUrl = await getImageDisplayUrl(supabase, coverUrl);
        } catch {
          // fall back to raw URL if edge function fails
        }
      }

      setUser({
        id: userId,
        email: sessionUser.email ?? null,
        full_name: typedUserRow?.full_name ?? null,
        username: typedUserRow?.username ?? null,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        postsCount: postsCountRes.count ?? null,
        friendsCount: friendsList.length,
        requestsCount: requestsList.length,
      });
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!user) {
    return (
      <aside className="hidden w-80 flex-none xl:block">
        <div className="rounded-xl bg-[#0a0a0a] p-5 shadow-sm shadow-white/5 border border-white/5">
          <div className="h-4 w-24 animate-pulse rounded bg-[#1e2d3d]" />
          <div className="mt-3 h-12 w-12 animate-pulse rounded-full bg-[#1e2d3d]" />
          <div className="mt-3 h-3 w-32 animate-pulse rounded bg-[#1e2d3d]" />
        </div>
      </aside>
    );
  }

  const displayName = user.full_name || user.username || user.email || "Logged in";
  const handle = user.username ? `@${user.username}` : user.email ? `@${user.email.split("@")[0]}` : "@user";

  return (
    <aside className="hidden w-80 flex-none xl:block">
      <div className="overflow-hidden rounded-xl bg-[#0a0a0a] shadow-sm shadow-white/5 border border-white/5">
        {/* Header / banner area (user cover if available) */}
        <div className="h-20 w-full overflow-hidden">
          {user.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.cover_url}
              alt="Profile cover"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-indigo-500/60 via-purple-500/60 to-sky-500/60" />
          )}
        </div>

        {/* Avatar and basic info */}
        <div className="px-4 pb-4">
          <div className="-mt-8 flex items-end gap-3">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-lg shadow-black/40">
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-zinc-100">
                  {(displayName[0] ?? "U").toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold tracking-tight text-zinc-50">{displayName}</div>
              <div className="truncate text-xs text-zinc-400">{handle}</div>
              {user.email && (
                <div className="mt-1 truncate text-[11px] text-zinc-500">{user.email}</div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 flex justify-between gap-2 border-t border-white/5 pt-4 text-center">
            <div className="flex-1">
              <div className="text-sm font-bold text-white">{user.postsCount ?? 0}</div>
              <div className="text-[10px] font-medium text-slate-500">Posts</div>
            </div>
            <Link href="/friends" className="flex-1 rounded-lg transition-colors hover:bg-white/5 py-1">
              <div className="text-sm font-bold text-white">{user.friendsCount ?? 0}</div>
              <div className="text-[10px] font-medium text-slate-500">Friends</div>
            </Link>
            <Link href="/friends" className="flex-1 rounded-lg transition-colors hover:bg-white/5 py-1">
              <div className="text-sm font-bold text-white">{user.requestsCount ?? 0}</div>
              <div className="text-[10px] font-medium text-slate-500">Requests</div>
            </Link>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/profile"
              className="group flex w-full items-center justify-center rounded-lg bg-white/5 py-2 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/10"
            >
              View profile
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
