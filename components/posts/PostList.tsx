"use client";

import { useCallback, useEffect, useState } from "react";
import { listPosts, listPostsByCommunity, listPostsByAuthor, listRepliesByAuthor, type PostWithExtras } from "@/lib/posts";
import PostCard from "@/components/posts/PostCard";
import { supabase } from "@/lib/supabaseClient";

function SkeletonPost() {
  return (
    <div className="animate-pulse rounded-lg bg-[#0a0a0a] p-5 shadow-sm shadow-white/5 border border-white/5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-[#1e2d3d]" />
        <div className="flex-1">
          <div className="h-3 w-32 rounded bg-[#1e2d3d]" />
          <div className="mt-2 h-3 w-48 rounded bg-[#1e2d3d]" />
        </div>
      </div>
      <div className="mt-4 h-48 w-full rounded-lg bg-[#1e2d3d]" />
      <div className="mt-4 grid grid-cols-4 gap-3">
        <div className="h-6 rounded bg-[#1e2d3d]" />
        <div className="h-6 rounded bg-[#1e2d3d]" />
        <div className="h-6 rounded bg-[#1e2d3d]" />
        <div className="h-6 rounded bg-[#1e2d3d]" />
      </div>
    </div>
  );
}

type FeedType = "for-you" | "following" | "communities" | "media";

export default function PostList({ columns = 1, communityId, authorId, repliesOnly = false, feedType = "for-you" }: { columns?: 1 | 2; communityId?: string; authorId?: string; repliesOnly?: boolean; feedType?: FeedType }) {
  const [posts, setPosts] = useState<PostWithExtras[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user ID on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setCurrentUserId(data.session?.user.id ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const base = communityId
        ? await listPostsByCommunity(communityId, 30, currentUserId)
        : authorId
          ? (repliesOnly ? await listRepliesByAuthor(authorId, 30, currentUserId) : await listPostsByAuthor(authorId, 30, currentUserId))
          : await listPosts(30, feedType === "communities", currentUserId);

      let data = base;
      if (!communityId && !authorId) {
        if (feedType === "communities") {
          data = base.filter((p) => p.visibility === "community");
        } else if (feedType === "media") {
          data = base.filter((p) => (p.media?.length ?? 0) > 0);
        }
        // "following" currently falls back to the same as "for-you" until a follow graph is implemented.
      }

      setPosts(data);
    } catch (e) {
      console.warn("Failed to load posts:", e);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [communityId, authorId, repliesOnly, feedType, currentUserId]);

  useEffect(() => {
    refresh();
    const handler = () => void refresh();
    window.addEventListener("post:created", handler as EventListener);
    return () => window.removeEventListener("post:created", handler as EventListener);
  }, [refresh]);

  if (loading)
    return (
      <div className={
        columns === 2
          ? "grid grid-cols-1 gap-4 md:grid-cols-2"
          : "space-y-4 max-w-xl mx-auto"
      }>
        {Array.from({ length: columns === 2 ? 6 : 3 }).map((_, i) => (
          <SkeletonPost key={i} />
        ))}
      </div>
    );
  if (posts.length === 0) return <div className="text-sm text-slate-500">No posts yet</div>;

  return (
    <div
      className={
        columns === 2
          ? "grid grid-cols-1 gap-4 md:grid-cols-2"
          : "space-y-4 max-w-xl mx-auto"
      }
    >
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}
