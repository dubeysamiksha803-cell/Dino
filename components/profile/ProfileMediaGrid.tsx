"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getImageDisplayUrl } from "@/lib/media";

type GridItem = { id: string; url: string; type: string | null; isVideo: boolean };

export default function ProfileMediaGrid({ userId }: { userId: string }) {
  const [items, setItems] = useState<GridItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // Get latest posts for author and their media
        const { data: posts } = await supabase
          .from("posts")
          .select("id, created_at")
          .eq("author_id", userId)
          .order("created_at", { ascending: false })
          .limit(60);
        if (!posts || posts.length === 0) { if (mounted) setItems([]); return; }
        const ids = posts.map(p => p.id);
        const { data: media } = await supabase
          .from("post_media")
          .select("id, post_id, file_url, file_type, position")
          .in("post_id", ids);
        type MediaRow = { id: string; post_id: string; file_url: string; file_type: string | null; position: number | null };
        const firstByPost = new Map<string, { id: string; url: string; type: string | null; position: number }>();
        (media ?? []).forEach((m: MediaRow) => {
          const prev = firstByPost.get(m.post_id);
          const pos = typeof m.position === 'number' ? m.position : 0;
          const better = !prev || pos < prev.position;
          if (!prev || better) firstByPost.set(m.post_id, { id: m.id, url: m.file_url, type: m.file_type, position: pos });
        });
        const isVideoExt = (u?: string) => !!u && /\.(mp4|webm|ogg|mov|m4v)$/i.test(u);
        const arr: GridItem[] = [];
        for (const p of posts) {
          const it = firstByPost.get(p.id);
          if (!it) continue;
          const sourceUrl = it.url;
          let displayUrl = sourceUrl;
          if (displayUrl && /^s3:\/\//i.test(displayUrl)) {
            displayUrl = await getImageDisplayUrl(supabase, displayUrl);
          }
          const isVideo = (it.type && it.type.startsWith("video")) || isVideoExt(sourceUrl) || isVideoExt(displayUrl);
          arr.push({ id: it.id, url: displayUrl, type: it.type, isVideo });
        }
        if (mounted) setItems(arr);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [userId]);

  if (loading) return <div className="mt-4 grid grid-cols-3 gap-1 md:gap-2">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-lg bg-[#192734]" />)}</div>;
  if (items.length === 0) return <div className="mt-4 text-sm text-slate-500">No media posts yet</div>;

  return (
    <div className="mt-4 grid grid-cols-3 gap-1 md:gap-2">
      {items.map((it, idx) => (
        <button
          key={it.id}
          className="relative aspect-square overflow-hidden rounded-lg bg-[#192734] transition-opacity hover:opacity-90"
          onClick={() => { setActive(idx); setOpen(true); }}
          aria-label="Open media"
        >
          {it.isVideo ? (
            <>
              <video className="h-full w-full object-cover" src={it.url} muted playsInline autoPlay loop preload="metadata" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="rounded-full bg-black/40 px-2 py-1 text-[10px] text-white">Video</span>
              </div>
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="h-full w-full object-cover" src={it.url} alt="media" />
            </>
          )}
        </button>
      ))}
      {open && items[active] && (
        <Lightbox
          item={items[active]}
          onClose={() => setOpen(false)}
          onPrev={() => setActive((i) => (i - 1 + items.length) % items.length)}
          onNext={() => setActive((i) => (i + 1) % items.length)}
        />
      )}
    </div>
  );
}

function Lightbox({ item, onClose, onPrev, onNext }: {
  item: GridItem;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  // esc/arrow key support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        {item.isVideo ? (
          <video src={item.url} className="max-h-[90vh] max-w-[90vw] rounded-lg" controls autoPlay playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt="media" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
        )}
        <button onClick={onClose} aria-label="Close" className="absolute right-2 top-2 rounded-full bg-black/40 p-2 text-white/80 backdrop-blur-md hover:bg-black/60 hover:text-white transition-colors">✕</button>
        <button onClick={(e) => { e.stopPropagation(); onPrev(); }} aria-label="Previous" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/80 backdrop-blur-md hover:bg-black/60 hover:text-white transition-colors">‹</button>
        <button onClick={(e) => { e.stopPropagation(); onNext(); }} aria-label="Next" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/80 backdrop-blur-md hover:bg-black/60 hover:text-white transition-colors">›</button>
      </div>
    </div>
  );
}
