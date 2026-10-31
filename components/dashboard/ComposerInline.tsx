"use client";

import PostComposer from "@/components/posts/PostComposer";

export default function ComposerInline() {
  return (
    <div className="rounded-xl bg-[#0a0a0a] p-5 shadow-sm shadow-white/5 border border-white/5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Create</div>
      <PostComposer onPosted={() => { /* no-op: parent feed can refresh if needed */ }} />
    </div>
  );
}
