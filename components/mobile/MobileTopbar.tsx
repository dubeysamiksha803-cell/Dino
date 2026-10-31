"use client";

import Link from "next/link";
import { MessageCircle, Plus } from "lucide-react";

export default function MobileTopbar({
  onCreatePost,
}: {
  onCreatePost?: () => void;
}) {
  return (
    <div className="sticky top-0 z-40 block border-b border-zinc-800/60 bg-zinc-950/80 px-3 py-2 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between">
        <Link href="/" className="select-none rounded-md px-2 py-1 text-sm font-semibold text-zinc-100">
          Dino2.0
        </Link>
        <div className="flex items-center gap-2">
          {onCreatePost && (
            <button
              type="button"
              onClick={onCreatePost}
              className="inline-flex items-center justify-center rounded-full border border-zinc-800/60 bg-zinc-900/70 px-3 py-1 text-xs font-medium text-zinc-100 hover:bg-zinc-800/70"
            >
              <Plus className="mr-1 h-4 w-4" />
              Drop
            </button>
          )}
          <Link
            href="/chat"
            aria-label="Open chat"
            className="inline-flex items-center justify-center rounded-full border border-zinc-800/60 bg-zinc-900/70 p-2 hover:bg-zinc-800/70"
          >
            <MessageCircle className="h-5 w-5 text-zinc-100" />
          </Link>
        </div>
      </div>
    </div>
  );
}
