"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PostComposer from "@/components/posts/PostComposer";
import PostList from "@/components/posts/PostList";

export default function FeedPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) { router.replace("/login"); return; }
      setMyId(session.user.id);
      setChecking(false);
    })();
  }, [router]);

  if (checking || !myId) return <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-white text-zinc-700 dark:from-[#0b0c10] dark:via-[#0c1020] dark:to-[#0a0a14] dark:bg-gradient-to-br dark:text-zinc-300">Loading…</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-white text-zinc-900 dark:from-[#0b0c10] dark:via-[#0c1020] dark:to-[#0a0a14] dark:bg-gradient-to-br dark:text-zinc-50">
      <main className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">Feed</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Share moments, links, and thoughts.</p>
        </header>
        <section className="mb-6">
          <PostComposer />
        </section>
        <section>
          <PostList />
        </section>
      </main>
    </div>
  );
}
