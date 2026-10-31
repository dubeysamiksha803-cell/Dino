"use client";

import { Paperclip, Smile, Send, X, Camera, FileImage } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function Composer({
  onSend,
  disabled,
  replyTo,
  onCancelReply,
  onSendGif,
  onSelectImage,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  replyTo?: { id: string; author: string; content: string } | null;
  onCancelReply?: () => void;
  onSendGif?: (url: string) => void;
  onSelectImage?: (imageData: string, fileName: string, caption?: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState("");
  const [showGifs, setShowGifs] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<{ id: string; url: string; preview: string }[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifMode, setGifMode] = useState<'trending' | 'search'>("trending");
  const [gifOffset, setGifOffset] = useState(0);
  const gifContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputId = "composer-file-input";
  const [pendingImages, setPendingImages] = useState<{ dataUrl: string; name: string }[]>([]);
  const [pendingCaption, setPendingCaption] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useRef<HTMLDivElement | null>(null);
  const EMOJIS = "😀😁😂🤣😊😍😘😎🤩🤔🙄😴🥱😪😢😭😤😡👍👎🙏👏🙌🔥✨🎉🎯❤️🧡💛💚💙💜🖤🤍🤝💯".split("");

  function insertEmoji(e: string) {
    const el = textareaRef.current;
    if (!el) { setValue(v => v + e); return; }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const newVal = el.value.slice(0, start) + e + el.value.slice(end);
    setValue(newVal);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + e.length;
      // trigger resize
      el.style.height = "auto";
      const max = 160;
      el.style.height = Math.min(max, el.scrollHeight) + "px";
    });
  }

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  // Load GIFs: trending by default, search when query provided and mode switched
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setGifLoading(true);
      try {
        const key = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
        if (!key) { setGifResults([]); return; }
        let url = '';
        const limit = 24;
        if (gifMode === 'trending') {
          url = `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=${limit}&rating=g&offset=0`;
        } else {
          const q = gifQuery.trim();
          if (!q) { setGifResults([]); return; }
          url = `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=${limit}&rating=g&offset=0`;
        }
        const res = await fetch(url);
        const json = await res.json();
        type GiphyItem = {
          id: string;
          url?: string;
          images?: {
            original?: { url?: string };
            fixed_height_small?: { url?: string };
            preview_gif?: { url?: string };
            downsized_small?: { mp4?: string };
          };
        };
        const arr = (json.data as GiphyItem[] | undefined) ?? [];
        const mapped = arr.map((g) => ({
          id: g.id,
          url: g.images?.original?.url || g.url || '',
          preview: g.images?.fixed_height_small?.url || g.images?.preview_gif?.url || g.images?.downsized_small?.mp4 || g.images?.original?.url || '',
        }));
        if (cancelled) return;
        setGifResults(mapped);
      } catch {
        if (cancelled) return;
        setGifResults([]);
      } finally {
        if (!cancelled) setGifLoading(false);
      }
    }
    // initial or when mode/query changes: reset list and offset
    setGifOffset(0);
    setGifResults([]);
    const t = setTimeout(() => load(), gifMode === 'search' ? 300 : 0);
    return () => { clearTimeout(t); cancelled = true; };
  }, [gifMode, gifQuery]);

  // Infinite scroll for GIFs
  useEffect(() => {
    const el = gifContainerRef.current;
    if (!el) return;
    const target = el as HTMLDivElement;
    function onScroll() {
      if (target.scrollTop + target.clientHeight >= target.scrollHeight - 60 && !gifLoading) {
        setGifOffset(o => o + 24);
      }
    }
    target.addEventListener('scroll', onScroll);
    return () => target.removeEventListener('scroll', onScroll);
  }, [gifLoading]);

  useEffect(() => {
    // when offset increases, fetch next page
    let cancelled = false;
    async function loadMore() {
      const key = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
      if (!key) return;
      const limit = 24;
      let url = '';
      if (gifMode === 'trending') {
        url = `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=${limit}&rating=g&offset=${gifOffset}`;
      } else {
        const q = gifQuery.trim();
        if (!q) return;
        url = `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=${limit}&rating=g&offset=${gifOffset}`;
      }
      try {
        setGifLoading(true);
        const res = await fetch(url);
        const json = await res.json();
        type GiphyItem = {
          id: string;
          url?: string;
          images?: {
            original?: { url?: string };
            fixed_height_small?: { url?: string };
            preview_gif?: { url?: string };
            downsized_small?: { mp4?: string };
          };
        };
        const arr = (json.data as GiphyItem[] | undefined) ?? [];
        const mapped = arr.map((g) => ({
          id: g.id,
          url: g.images?.original?.url || g.url || '',
          preview: g.images?.fixed_height_small?.url || g.images?.preview_gif?.url || g.images?.downsized_small?.mp4 || g.images?.original?.url || '',
        }));
        if (!cancelled) setGifResults(prev => [...prev, ...mapped]);
      } finally {
        if (!cancelled) setGifLoading(false);
      }
    }
    if (gifOffset > 0) loadMore();
    return () => { cancelled = true; };
  }, [gifOffset, gifMode, gifQuery]);

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      const newImages: { dataUrl: string; name: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await compressImageFile(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 });
        newImages.push({ dataUrl: compressed.dataUrl, name: file.name });
      }
      // Add to existing pending images (allow adding more)
      setPendingImages(prev => [...prev, ...newImages]);
    } catch {
      // noop
    } finally {
      e.target.value = ""; // reset
    }
  }

  function removeImage(index: number) {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  }

  function openFilePicker() {
    const el = document.getElementById(fileInputId) as HTMLInputElement | null;
    el?.click();
  }

  async function compressImageFile(file: File, opts: { maxWidth: number; maxHeight: number; quality: number }): Promise<{ dataUrl: string; width: number; height: number }> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const ratio = Math.min(1, opts.maxWidth / img.width, opts.maxHeight / img.height);
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    // Prefer webp if supported; fallback to jpeg
    const mime = 'image/webp';
    const dataUrl = canvas.toDataURL(mime, opts.quality);
    return { dataUrl, width: w, height: h };
  }

  return (
    <div className="relative flex items-center gap-2 border-t border-neutral-900/50 bg-black p-2 md:p-3">
      {replyTo && (
        <div className="absolute left-1/2 top-[-64px] z-10 w-[95%] -translate-x-1/2 rounded-lg border border-neutral-800/60 bg-neutral-950 px-3 py-2 text-xs text-zinc-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium">Replying to {replyTo.author}</div>
              <div className="truncate text-zinc-400">{replyTo.content}</div>
            </div>
            {onCancelReply && (
              <button onClick={onCancelReply} className="rounded p-1 text-zinc-400 hover:bg-neutral-900 hover:text-zinc-200" title="Cancel reply">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
      {pendingImages.length > 0 && (
        <div className="absolute inset-x-0 bottom-full z-30 mb-2 px-3">
          <div className="mx-auto max-w-sm overflow-hidden rounded-xl border border-neutral-800/50 bg-black shadow-xl">
            {/* Compact Image Grid */}
            <div className="relative bg-neutral-950 p-2">
              <div className={`grid gap-1.5 ${pendingImages.length === 1 ? 'grid-cols-2' :
                pendingImages.length <= 3 ? 'grid-cols-3' :
                  'grid-cols-4'
                }`}>
                {pendingImages.map((img, index) => (
                  <div key={index} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.dataUrl}
                      alt={`preview ${index + 1}`}
                      className="h-16 w-full rounded-lg object-cover"
                    />
                    {/* Remove button */}
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-900 hover:text-white"
                      disabled={uploading}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {/* Add more button */}
                {pendingImages.length < 10 && (
                  <button
                    onClick={openFilePicker}
                    className="flex h-16 items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-900/30 text-zinc-500 transition hover:border-neutral-500 hover:text-zinc-300"
                    disabled={uploading}
                  >
                    <span className="text-lg">+</span>
                  </button>
                )}
              </div>
              {/* Count & Clear */}
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-500">
                <span>{pendingImages.length} image{pendingImages.length > 1 ? 's' : ''}</span>
                <button
                  onClick={() => { if (!uploading) { setPendingImages([]); setPendingCaption(""); } }}
                  className="text-zinc-500 hover:text-zinc-300"
                  disabled={uploading}
                >
                  Clear all
                </button>
              </div>
            </div>

            {/* Caption & Send */}
            <div className="flex items-center gap-2 border-t border-neutral-800/50 bg-black p-2">
              <input
                value={pendingCaption}
                onChange={(e) => setPendingCaption(e.target.value)}
                placeholder="Add a caption..."
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && !e.shiftKey && !uploading && onSelectImage) {
                    e.preventDefault();
                    setUploading(true);
                    try {
                      for (const img of pendingImages) {
                        await onSelectImage(img.dataUrl, img.name, pendingCaption.trim() || undefined);
                      }
                      setPendingImages([]);
                      setPendingCaption("");
                    } finally {
                      setUploading(false);
                    }
                  }
                }}
                className="flex-1 rounded-xl border border-neutral-800/50 bg-neutral-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-neutral-700"
                autoFocus
              />
              <button
                onClick={async () => {
                  if (!onSelectImage || pendingImages.length === 0) return;
                  try {
                    setUploading(true);
                    // Upload all images sequentially
                    for (const img of pendingImages) {
                      await onSelectImage(img.dataUrl, img.name, pendingCaption.trim() || undefined);
                    }
                    setPendingImages([]);
                    setPendingCaption("");
                  } finally {
                    setUploading(false);
                  }
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-black shadow-lg transition hover:bg-white disabled:opacity-50"
                disabled={uploading || pendingImages.length === 0}
                title={`Send ${pendingImages.length} image${pendingImages.length > 1 ? 's' : ''}`}
              >
                {uploading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <input id={fileInputId} type="file" accept="image/*" multiple className="hidden" onChange={handlePickFile} />
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-950 text-zinc-400 hover:bg-neutral-900 hover:text-zinc-200"
        title="Attach file"
        onClick={openFilePicker}
      >
        <Paperclip className="h-4 w-4" />
      </button>
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-950 text-zinc-400 hover:bg-neutral-900 hover:text-zinc-200"
        title="Upload photo or video"
        onClick={openFilePicker}
      >
        <Camera className="h-4 w-4" />
      </button>
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-950 text-zinc-400 hover:bg-neutral-900 hover:text-zinc-200"
        title="Send GIF"
        onClick={() => setShowGifs((s) => !s)}
      >
        <FileImage className="h-4 w-4" />
      </button>
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            const max = 160; // px, similar to WhatsApp
            const next = Math.min(max, el.scrollHeight);
            el.style.height = next + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Message"
          className="scrollbar-hide min-h-[44px] max-h-40 w-full resize-none overflow-y-auto rounded-2xl border border-neutral-800/60 bg-neutral-950 px-4 py-2.5 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-neutral-700"
        />
      </div>
      <button
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-neutral-900 shadow-lg transition-all hover:bg-white hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={submit}
        disabled={disabled || !value.trim()}
        title="Send"
      >
        <Send className="h-4 w-4" />
      </button>
      <div className="relative hidden md:block">
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-950 text-zinc-400 hover:bg-neutral-900 hover:text-zinc-200"
          title="Emoji"
          onClick={() => setShowEmoji(s => !s)}
        >
          <Smile className="h-4 w-4" />
        </button>
        {showEmoji && (
          <div ref={emojiRef} className="absolute bottom-12 right-0 z-20 w-56 rounded-xl border border-neutral-800/60 bg-neutral-950 p-2 shadow-xl">
            <div className="grid grid-cols-8 gap-1 text-lg">
              {EMOJIS.map((em, idx) => (
                <button key={`${em}-${idx}`} className="rounded p-1 hover:bg-neutral-900" onClick={() => insertEmoji(em)}>{em}</button>
              ))}
            </div>
          </div>
        )}
      </div>
      {showGifs && (
        <div className="absolute bottom-16 left-2 right-2 z-20 rounded-xl border border-neutral-800/60 bg-neutral-950 p-3 shadow-xl">
          <div className="mb-2 flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-neutral-900 p-1 text-xs">
              <button onClick={() => setGifMode('trending')} className={`px-2 py-1 rounded ${gifMode === 'trending' ? 'bg-neutral-800 text-white' : 'text-zinc-400'}`}>Trending</button>
              <button onClick={() => setGifMode('search')} className={`px-2 py-1 rounded ${gifMode === 'search' ? 'bg-neutral-800 text-white' : 'text-zinc-400'}`}>Search</button>
            </div>
            {gifMode === 'search' && (
              <input
                value={gifQuery}
                onChange={(e) => setGifQuery(e.target.value)}
                placeholder="Search GIFs"
                className="flex-1 rounded-lg border border-neutral-800/60 bg-black px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-neutral-700"
              />
            )}
          </div>
          <div ref={gifContainerRef} className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
            {gifResults.map((g) => (
              <button key={g.id} className="group relative overflow-hidden rounded-lg ring-1 ring-neutral-800 hover:ring-zinc-500" onClick={() => { onSendGif?.(g.url); setShowGifs(false); }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.preview} alt="gif" className="aspect-square w-full object-cover" />
                <span className="absolute inset-0 hidden items-center justify-center bg-black/50 text-xs text-white group-hover:flex">Send</span>
              </button>
            ))}
            {gifLoading && <div className="col-span-3 p-2 text-center text-xs text-zinc-500">Loading…</div>}
            {!gifLoading && gifResults.length === 0 && (
              <div className="col-span-3 p-2 text-center text-xs text-zinc-500">No GIFs</div>
            )}
          </div>
          {!process.env.NEXT_PUBLIC_GIPHY_API_KEY && (
            <div className="mt-2 text-center text-[11px] text-zinc-500">Set NEXT_PUBLIC_GIPHY_API_KEY in .env.local</div>
          )}
        </div>
      )}
    </div>
  );
}
