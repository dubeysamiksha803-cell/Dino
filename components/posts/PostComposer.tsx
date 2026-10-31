"use client";

import { useRef, useState } from "react";
import { createPost, createPollPost } from "@/lib/posts";
import { supabase } from "@/lib/supabaseClient";
import { storageClient } from "@/lib/storage";

type MediaItem = {
  id: string;
  file?: File;
  url?: string;
  type: "image" | "video";
  name: string;
  progress: number; // 0-100
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};

type ComposerTab = "text" | "image" | "link" | "poll";

export default function PostComposer({ communityId, onPosted }: { communityId?: string; onPosted?: () => void }) {
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const isImageType = (t: string) => t.startsWith("image/");
  const isVideoType = (t: string) => t.startsWith("video/");
  const [storageError, setStorageError] = useState<string | null>(null);

  // Poll state
  const [activeTab, setActiveTab] = useState<ComposerTab>("text");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const onSubmit = async () => {
    const uploaded = media.filter((m) => m.status === "done" && m.url);

    // Validation
    if (activeTab === "poll") {
      const validOptions = pollOptions.filter(o => o.trim().length > 0);
      if (!content.trim() || validOptions.length < 2) return;
    } else {
      if (!content && uploaded.length === 0) return;
    }

    setSubmitting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;

      if (activeTab === "poll") {
        // Create poll post
        const validOptions = pollOptions.filter(o => o.trim().length > 0);
        await createPollPost({
          authorId: user.id,
          content: content.trim(),
          options: validOptions,
          communityId
        });
        setPollOptions(["", ""]);
      } else {
        // Create regular post
        const urls = uploaded.map((m) => m.url!);
        const hasVideo = media.some((m) => m.type === "video" && m.status === "done");
        const postType = urls.length ? (hasVideo ? "video" : "image") : "text";
        await createPost({ authorId: user.id, content, mediaUrls: urls, postType, communityId });
        setMedia([]);
      }

      setContent("");
      setActiveTab("text");
      window.dispatchEvent(new CustomEvent("post:created"));
      onPosted?.();
    } finally {
      setSubmitting(false);
    }
  };

  const onPickFile = () => fileRef.current?.click();

  // --- Client-side compression helpers ---
  async function compressImage(file: File, opts?: { maxW?: number; maxH?: number; quality?: number; type?: string }): Promise<Blob> {
    const { maxW = 1920, maxH = 1080, quality = 0.8, type } = opts || {};
    const img = await createImageBitmap(await file.arrayBuffer().then((b) => new Blob([b])));
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const mime = type || (file.type.includes('png') ? 'image/png' : 'image/jpeg');
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b || file), mime, quality));
    return blob;
  }

  async function compressVideoFallback(file: File, opts?: { maxW?: number; maxH?: number; fps?: number; mime?: string; bitrate?: number }): Promise<Blob | null> {
    // Canvas-based transcode to WebM. Not as efficient as ffmpeg.wasm, but avoids heavy deps.
    const { maxW = 1280, maxH = 720, fps = 24, mime = 'video/webm' } = opts || {};
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.src = url;
      video.crossOrigin = 'anonymous';
      await video.play().catch(() => { });
      await new Promise<void>((resolve) => video.addEventListener('loadeddata', () => resolve(), { once: true }));
      const scale = Math.min(maxW / video.videoWidth, maxH / video.videoHeight, 1);
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const stream = (canvas as HTMLCanvasElement).captureStream(fps);
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const done = new Promise<Blob>((resolve) => recorder.onstop = () => resolve(new Blob(chunks, { type: mime })));
      recorder.start(100);
      const frameInterval = 1000 / fps;
      let last = performance.now();
      let rafId = 0;
      const draw = () => {
        const now = performance.now();
        if (now - last >= frameInterval) {
          ctx.drawImage(video, 0, 0, w, h);
          last = now;
        }
        if (!video.ended) {
          rafId = requestAnimationFrame(draw);
        } else {
          cancelAnimationFrame(rafId);
          recorder.stop();
        }
      };
      draw();
      const out = await done;
      URL.revokeObjectURL(url);
      return out.size > 0 ? out : null;
    } catch {
      return null;
    }
  }

  type StorageLike = {
    storage: {
      from: (bucket: string) => {
        list: (path: string, options: { limit: number }) => Promise<{ data: unknown; error: { message?: string } | null }>;
        upload: (path: string, body: Blob | File, options: { upsert: boolean; cacheControl: string }) => Promise<{ data: { path: string } | null; error: Error | null }>;
        getPublicUrl: (path: string) => { data: { publicUrl: string } };
      };
    };
  };

  const uploadFile = async (file: File, onProgress?: (n: number) => void): Promise<string | null> => {
    try {
      setUploading(true);
      setStorageError(null);
      const bucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || "public";
      const client: StorageLike = (storageClient ?? supabase) as unknown as StorageLike;
      // quick preflight to surface misconfigured URL/key/bucket with a friendly error
      try {
        const probe = await client.storage.from(bucket).list("", { limit: 1 });
        const probeError = (probe as { error: { message?: string } | null }).error;
        if (probeError?.message) {
          setStorageError(`Storage check failed for bucket "${bucket}": ${probeError.message}. Verify NEXT_PUBLIC_SUPABASE_STORAGE_URL, NEXT_PUBLIC_SUPABASE_STORAGE_ANON_KEY, and bucket name.`);
          return null;
        }
      } catch {
        setStorageError('Unable to reach storage. Check environment variables and network.');
        return null;
      }
      // Pre-compress if image/video
      let toUpload: Blob | File = file;
      if (isImageType(file.type)) {
        toUpload = await compressImage(file);
      } else if (isVideoType(file.type)) {
        const compressed = await compressVideoFallback(file);
        if (compressed) toUpload = compressed;
      }
      const ext = (file.name.split(".").pop()?.toLowerCase() || "dat").replace(/[^a-z0-9]/g, "") || "dat";
      const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      // Simulated progress: ramp to 90% while uploading, then 100% on completion
      let pct = 0;
      const timer = setInterval(() => {
        pct = Math.min(pct + 5, 90);
        onProgress?.(pct);
      }, 200);
      const { data, error } = await client.storage.from(bucket).upload(path, toUpload, { upsert: false, cacheControl: "3600" });
      clearInterval(timer);
      if (error) throw error;
      if (!data) throw new Error("Upload completed without returning a path");
      const { data: pub } = client.storage.from(bucket).getPublicUrl(data.path);
      onProgress?.(100);
      return pub.publicUrl as string;
    } catch (e: unknown) {
      console.error("upload error", e);
      const msg = e instanceof Error && typeof e.message === "string" ? e.message : "Upload failed";
      setStorageError(msg);
      return null;
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/50 p-4 text-zinc-200 shadow">
      <textarea
        ref={textRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={activeTab === "poll" ? "Ask a question..." : "What's happening?"}
        className="w-full resize-none rounded-lg border border-zinc-800/60 bg-zinc-950/30 p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-700"
        rows={activeTab === "poll" ? 2 : 3}
      />

      {/* Poll Options Editor */}
      {activeTab === "poll" && (
        <div className="mt-3 space-y-2">
          {pollOptions.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-xs text-zinc-500">
                {i + 1}
              </div>
              <input
                type="text"
                value={opt}
                onChange={(e) => {
                  const updated = [...pollOptions];
                  updated[i] = e.target.value;
                  setPollOptions(updated);
                }}
                placeholder={`Option ${i + 1}`}
                className="flex-1 rounded-lg border border-zinc-800/60 bg-zinc-950/30 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-700"
              />
              {pollOptions.length > 2 && (
                <button
                  onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          {pollOptions.length < 6 && (
            <button
              onClick={() => setPollOptions([...pollOptions, ""])}
              className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              Add option
            </button>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setActiveTab("text"); textRef.current?.focus(); }}
            className={`rounded-full border px-3 py-1.5 text-xs transition-all ${activeTab === "text" ? "border-zinc-600 bg-zinc-800 text-white" : "border-zinc-800/60 text-zinc-300 hover:bg-zinc-900/60"}`}
          >Text</button>
          <button
            onClick={() => { setActiveTab("image"); onPickFile(); }}
            className={`rounded-full border px-3 py-1.5 text-xs transition-all ${activeTab === "image" ? "border-zinc-600 bg-zinc-800 text-white" : "border-zinc-800/60 text-zinc-300 hover:bg-zinc-900/60"}`}
          >Image</button>
          <button
            onClick={() => { setActiveTab("link"); textRef.current?.focus(); }}
            className={`rounded-full border px-3 py-1.5 text-xs transition-all ${activeTab === "link" ? "border-zinc-600 bg-zinc-800 text-white" : "border-zinc-800/60 text-zinc-300 hover:bg-zinc-900/60"}`}
          >Link</button>
          <button
            onClick={() => setActiveTab("poll")}
            className={`rounded-full border px-3 py-1.5 text-xs transition-all ${activeTab === "poll" ? "border-zinc-600 bg-zinc-800 text-white" : "border-zinc-800/60 text-zinc-300 hover:bg-zinc-900/60"}`}
          >Poll</button>
        </div>
        <div className="ml-auto hidden items-center gap-1 sm:flex">
          <button aria-label="Add image" onClick={onPickFile} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 16l5-5 4 4 5-5 4 4" /><circle cx="8.5" cy="8.5" r="1.5" /></svg>
          </button>
          <button aria-label="Attach file" onClick={onPickFile} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21.44 11.05l-8.49 8.49a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.19 9.19a2 2 0 01-2.83-2.83l8.49-8.49" /></svg>
          </button>
          <button aria-label="Add link" onClick={() => textRef.current?.focus()} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 10-7.07-7.07L10 6" /><path d="M14 11a5 5 0 00-7.07 0L5.5 12.43a5 5 0 107.07 7.07L14 18" /></svg>
          </button>
          <button aria-label="Emoji" className="rounded-md p-2 text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length === 0) return;
            const maxImage = 15 * 1024 * 1024; // 15MB
            const maxVideo = 100 * 1024 * 1024; // 100MB
            // Queue
            const queued: MediaItem[] = files.map((f) => {
              const type = isVideoType(f.type) ? "video" : "image";
              let error: string | undefined;
              if (!isImageType(f.type) && !isVideoType(f.type)) error = "Unsupported type";
              if (isImageType(f.type) && f.size > maxImage) error = "Image exceeds 15MB";
              if (isVideoType(f.type) && f.size > maxVideo) error = "Video exceeds 100MB";
              return {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                file: f,
                url: undefined,
                type,
                name: f.name,
                progress: 0,
                status: error ? "error" : "queued",
                error,
              };
            });
            setMedia((m) => [...m, ...queued]);

            // Upload valid ones
            await Promise.all(
              queued.filter((q) => q.status !== "error").map(async (q) => {
                setMedia((m) => m.map((it) => (it.id === q.id ? { ...it, status: "uploading" } : it)));
                const url = await uploadFile(q.file!, (p) => {
                  setMedia((m) => m.map((it) => (it.id === q.id ? { ...it, progress: p } : it)));
                });
                if (!url) {
                  setMedia((m) => m.map((it) => (it.id === q.id ? { ...it, status: "error", error: "Upload failed" } : it)));
                } else {
                  setMedia((m) => m.map((it) => (it.id === q.id ? { ...it, status: "done", url, progress: 100 } : it)));
                }
              })
            );
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <button
          onClick={onSubmit}
          disabled={submitting || uploading}
          className="rounded-lg bg-zinc-100 px-6 py-2 text-sm font-medium text-black hover:bg-white disabled:opacity-50"
        >Post</button>
      </div>
      {media.length > 0 && (
        <div className="mt-3 space-y-3">
          {storageError && (
            <div className="rounded-md border border-red-500/30 bg-red-900/20 px-3 py-2 text-xs text-red-300">{storageError}</div>
          )}
          {/* Images grid */}
          {media.some((m) => m.type === "image") && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {media.filter((m) => m.type === "image").map((m) => (
                <div key={m.id} className="relative overflow-hidden rounded-md border border-zinc-800/60 bg-zinc-950/30">
                  {m.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.name} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center text-xs text-zinc-400">{m.progress}%</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-zinc-800/60">
                    <div className="h-1 bg-zinc-200" style={{ width: `${m.progress}%` }} />
                  </div>
                  <button
                    className="absolute right-1 top-1 rounded-md bg-zinc-900/70 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-800/80"
                    onClick={() => setMedia((arr) => arr.filter((x) => x.id !== m.id))}
                  >Remove</button>
                  {m.status === "error" && (
                    <div className="absolute left-1 top-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">{m.error}</div>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Videos stacked */}
          {media.some((m) => m.type === "video") && (
            <div className="space-y-2">
              {media.filter((m) => m.type === "video").map((m) => (
                <div key={m.id} className="overflow-hidden rounded-md border border-zinc-800/60 bg-zinc-950/30">
                  {m.url ? (
                    <video controls className="max-h-72 w-full object-contain">
                      <source src={m.url} />
                    </video>
                  ) : (
                    <div className="flex h-24 items-center justify-center text-xs text-zinc-400">{m.progress}%</div>
                  )}
                  <div className="h-1 bg-zinc-800/60">
                    <div className="h-1 bg-zinc-200" style={{ width: `${m.progress}%` }} />
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] text-zinc-400">
                    <span className="truncate">{m.name}</span>
                    <div className="flex items-center gap-2">
                      {m.status === "error" && <span className="text-red-300">{m.error}</span>}
                      <button
                        className="rounded-md px-2 py-1 text-zinc-300 hover:bg-zinc-900/60"
                        onClick={() => setMedia((arr) => arr.filter((x) => x.id !== m.id))}
                      >Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
