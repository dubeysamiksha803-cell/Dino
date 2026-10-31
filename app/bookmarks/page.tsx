"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import MobileTopbar from "@/components/mobile/MobileTopbar";
import Modal from "@/components/ui/Modal";
import ComposerInline from "@/components/dashboard/ComposerInline";
import RightRail from "@/components/dashboard/RightRail";
import { supabase } from "@/lib/supabaseClient";
import { listBookmarkedPosts, type PostWithExtras } from "@/lib/posts";
import PostCard from "@/components/posts/PostCard";
import { APP_BG, PAGE_MAIN, LAYOUT_ROW } from "@/lib/theme";
import { Bookmark, Loader2, Trash2 } from "lucide-react";

export default function BookmarksPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [posts, setPosts] = useState<PostWithExtras[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      if (!mounted) return;
      setChecking(false);
      setLoading(true);
      try {
        const bookmarks = await listBookmarkedPosts(session.user.id);
        if (mounted) setPosts(bookmarks);
      } catch {
        if (mounted) setPosts([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 text-zinc-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className={APP_BG}>
      <MobileTopbar onCreatePost={() => setShowCreatePostModal(true)} />
      <main className={`${PAGE_MAIN} pb-20`}>
        <div className={LAYOUT_ROW}>
          <Sidebar onCreatePost={() => setShowCreatePostModal(true)} />

          {/* Main content area */}
          <div className="min-w-0 flex-1 max-w-3xl">
            {/* Header */}
            <header className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800">
                  <Bookmark className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">Bookmarks</h1>
                  <p className="text-sm text-zinc-500">
                    {posts.length > 0
                      ? `${posts.length} saved post${posts.length === 1 ? "" : "s"}`
                      : "Save posts to revisit later"}
                  </p>
                </div>
              </div>
              {posts.length > 0 && (
                <button
                  className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800"
                  title="Clear all bookmarks"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Clear all</span>
                </button>
              )}
            </header>

            {/* Bookmarks List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 text-zinc-600 animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-xl bg-[#0a0a0a] border border-zinc-800/50 py-16 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800">
                  <Bookmark className="h-8 w-8 text-zinc-600" />
                </div>
                <div className="text-sm font-medium text-zinc-400">No bookmarks yet</div>
                <div className="mt-1 text-xs text-zinc-600">
                  Click the bookmark icon on any post to save it here
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            )}
          </div>

          <RightRail />
        </div>
      </main>

      {/* Create Post Modal */}
      <Modal open={showCreatePostModal} onClose={() => setShowCreatePostModal(false)}>
        <ComposerInline />
      </Modal>
    </div>
  );
}
