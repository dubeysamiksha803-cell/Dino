"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getImageDisplayUrl } from "@/lib/media";
import PostCard from "@/components/posts/PostCard";
import type { PostWithExtras } from "@/lib/posts";

type GridItem = { id: string; postId: string; url: string; isVideo: boolean };

export default function ExploreGrid() {
  const [items, setItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [activePost, setActivePost] = useState<PostWithExtras | null>(null);
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Get latest posts with media (public or community) and pick a primary media per post
        const { data: posts } = await supabase
          .from("posts")
          .select("id, created_at, visibility")
          .in("visibility", ["public", "community"]) // explore should be safe content
          .order("created_at", { ascending: false })
          .limit(120);
        if (!posts || posts.length === 0) { if (mounted) setItems([]); return; }
        const ids = posts.map((p) => p.id);
        const { data: media } = await supabase
          .from("post_media")
          .select("id, post_id, file_url, file_type, position")
          .in("post_id", ids);
        type MediaRow = { id: string; post_id: string; file_url: string; file_type: string | null; position: number | null };
        const firstByPost = new Map<string, { id: string; url: string; type: string | null; pos: number }>();
        (media ?? []).forEach((m: MediaRow) => {
          const prev = firstByPost.get(m.post_id);
          const pos = typeof m.position === "number" ? m.position : 0;
          if (!prev || pos < prev.pos) firstByPost.set(m.post_id, { id: m.id, url: m.file_url, type: m.file_type, pos });
        });
        const isVideoExt = (u?: string) => !!u && /\.(mp4|webm|ogg|mov|m4v)$/i.test(u);
        const out: GridItem[] = [];
        for (const p of posts) {
          const fm = firstByPost.get(p.id);
          if (!fm) continue;
          let displayUrl = fm.url;
          if (displayUrl && /^s3:\/\//i.test(displayUrl)) {
            displayUrl = await getImageDisplayUrl(supabase, displayUrl);
          }
          const isVideo = (fm.type && fm.type.startsWith("video")) || isVideoExt(fm.url) || isVideoExt(displayUrl);
          out.push({ id: fm.id, postId: p.id, url: displayUrl, isVideo });
        }
        // Optional: light shuffle for variety
        out.sort(() => Math.random() - 0.5);
        if (mounted) setItems(out);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function fetchPostWithExtras(postId: string): Promise<PostWithExtras | null> {
    const { data: post, error } = await supabase
      .from("posts")
      .select("id, author_id, post_type, content, link_url, visibility, created_at")
      .eq("id", postId)
      .maybeSingle();
    if (error || !post) return null;

    const [mediaRes, likesRes, authorsRes] = await Promise.all([
      supabase.from("post_media").select("id, post_id, file_url, file_type, position").eq("post_id", post.id),
      supabase.from("post_reactions").select("post_id").eq("reaction", "like").eq("post_id", post.id),
      supabase.from("users").select("id, username, avatar_url").eq("id", post.author_id),
    ]);

    type MediaRow = { id: string; file_url: string; file_type: string | null; position: number | null };
    const media = (mediaRes.data ?? []).map((m: MediaRow) => ({
      id: m.id,
      file_url: m.file_url,
      file_type: m.file_type ?? null,
      position: m.position ?? 0,
    })).sort((a, b) => a.position - b.position);

    const likeCount = (likesRes.data ?? []).length;
    const author = (authorsRes.data && authorsRes.data[0])
      ? { id: authorsRes.data[0].id as string, username: authorsRes.data[0].username as string, avatar_url: authorsRes.data[0].avatar_url as string | null }
      : null;

    const fullPost: PostWithExtras = {
      id: post.id,
      author_id: post.author_id,
      post_type: post.post_type,
      content: post.content,
      link_url: post.link_url,
      visibility: post.visibility,
      created_at: post.created_at,
      media,
      like_count: likeCount,
      author,
    };

    return fullPost;
  }

  const openPost = async (index: number) => {
    const item = items[index];
    if (!item) return;
    setOpen(true);
    setPostLoading(true);
    setPostError(null);
    setActivePost(null);
    try {
      const p = await fetchPostWithExtras(item.postId);
      if (p) setActivePost(p);
      else setPostError("Post not found");
    } catch {
      setPostError("Failed to load post");
    } finally {
      setPostLoading(false);
    }
  };

  // Bento grid pattern - compact layout with smaller tiles
  // Pattern repeats every 12 items for visual variety
  const getSpanClass = (idx: number): string => {
    const pattern = idx % 12;
    switch (pattern) {
      case 0: // Medium tile
        return "col-span-3 row-span-2 sm:col-span-2 md:col-span-2 lg:col-span-2";
      case 1: // Small tile
        return "col-span-3 row-span-1 sm:col-span-2 md:col-span-2 lg:col-span-1";
      case 2: // Small tile
        return "col-span-3 row-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1";
      case 3: // Medium tile
        return "col-span-3 row-span-2 sm:col-span-2 md:col-span-2 lg:col-span-2";
      case 4: // Small tile
        return "col-span-3 row-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1";
      case 5: // Small tile
        return "col-span-3 row-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1";
      case 6: // Wide tile
        return "col-span-6 row-span-1 sm:col-span-4 md:col-span-3 lg:col-span-2";
      case 7: // Small tile
        return "col-span-3 row-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1";
      case 8: // Medium tile
        return "col-span-3 row-span-2 sm:col-span-2 md:col-span-2 lg:col-span-2";
      case 9: // Small tile
        return "col-span-3 row-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1";
      case 10: // Small tile
        return "col-span-3 row-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1";
      case 11: // Small tile
        return "col-span-3 row-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1";
      default:
        return "col-span-3 row-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1";
    }
  };

  if (loading) return (
    <div className="grid auto-rows-[80px] grid-cols-6 grid-flow-row-dense gap-1.5 sm:auto-rows-[90px] md:auto-rows-[100px] md:gap-2">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse rounded-xl bg-zinc-800/50 ${getSpanClass(i)}`}
        />
      ))}
    </div>
  );
  if (items.length === 0) return (
    <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
      No posts to explore yet. Check back soon!
    </div>
  );

  return (
    <div className="grid auto-rows-[80px] grid-cols-6 grid-flow-row-dense gap-1.5 sm:auto-rows-[90px] md:auto-rows-[100px] md:gap-2">
      {items.map((it, idx) => {
        const spanClass = getSpanClass(idx);
        return (
          <button
            key={it.id}
            className={`group relative h-full overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/80 transition-all duration-300 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10 hover:scale-[1.02] ${spanClass}`}
            onClick={() => openPost(idx)}
            aria-label="Open media"
          >
            {it.isVideo ? (
              <>
                <video
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  src={it.url}
                  muted
                  playsInline
                  autoPlay
                  loop
                  preload="metadata"
                />
                <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  Video
                </div>
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                src={it.url}
                alt="media"
                loading="lazy"
              />
            )}
            {/* Subtle gradient overlay for depth */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </button>
        );
      })}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => { setOpen(false); setActivePost(null); }}
        >
          <div
            className="relative max-h-[85vh] w-full max-w-md overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              aria-label="Close post"
              className="absolute right-2 top-2 z-10 rounded-md bg-zinc-900/80 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800/80"
              onClick={() => { setOpen(false); setActivePost(null); }}
            >
              Close
            </button>
            {postLoading && (
              <div className="flex min-h-[200px] items-center justify-center text-sm text-zinc-300">
                Loading post…
              </div>
            )}
            {postError && !postLoading && (
              <div className="min-h-[200px] rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
                {postError}
              </div>
            )}
            {activePost && !postLoading && (
              <PostCard post={activePost} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
