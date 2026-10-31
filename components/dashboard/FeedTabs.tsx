"use client";

import { useState } from "react";

const tabs = [
  { id: "for-you", label: "For You" },
  { id: "following", label: "Following" },
  { id: "communities", label: "Communities" },
  { id: "media", label: "Media" },
];

export default function FeedTabs({ onChange }: { onChange?: (id: string) => void }) {
  const [active, setActive] = useState("for-you");
  return (
    <div className="flex items-center gap-4 overflow-x-auto border-b border-zinc-800/60 px-1 text-xs text-zinc-300 sm:gap-6 sm:overflow-visible sm:px-2 sm:text-sm">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => { setActive(t.id); onChange?.(t.id); }}
          className={`relative whitespace-nowrap pb-3 transition hover:text-zinc-100 ${active === t.id ? "text-zinc-100" : ""}`}
        >
          {t.label}
          <span className={`absolute -bottom-0.5 left-0 h-0.5 w-full rounded-full bg-zinc-300 transition-opacity ${active === t.id ? "opacity-100" : "opacity-0"}`} />
        </button>
      ))}
    </div>
  );
}
