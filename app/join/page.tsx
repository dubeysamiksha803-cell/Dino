"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft } from "lucide-react";
import Avatar from "@/components/ui/Avatar";

function JoinPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams?.get("code") ?? "";
  const [loading, setLoading] = useState(!!code);
  const [chat, setChat] = useState<{ id: string; title: string; avatar_url: string | null; type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!code) {
      return;
    }
    const fetch = async () => {
      const { data, error: err } = await supabase
        .from("chats")
        .select("id, title, avatar_url, type")
        .eq("invite_code", code)
        .eq("type", "group")
        .maybeSingle();
      if (err) setError(err.message);
      else if (!data) setError("Invalid or expired invite link");
      else setChat(data);
      setLoading(false);
    };
    fetch();
  }, [code]);

  async function handleJoin() {
    if (!chat || !code) return;
    setJoining(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace(`/login?redirect=/join?code=${encodeURIComponent(code)}`);
      return;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("chat_members")
      .select("user_id")
      .eq("chat_id", chat.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) {
      router.replace(`/chat/${chat.id}`);
      return;
    }

    // Add as member
    const { error: insertErr } = await supabase
      .from("chat_members")
      .insert({ chat_id: chat.id, user_id: user.id, role: "member" });
    if (insertErr) setError(insertErr.message);
    else router.replace(`/chat/${chat.id}`);
    setJoining(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-300">
        <div>Loading…</div>
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-300">
        <div className="mb-4 text-lg font-semibold">Invalid invite</div>
        <div className="mb-6 text-sm text-zinc-500">{error ?? "This invite link is not valid."}</div>
        <button onClick={() => router.back()} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800">
          <ArrowLeft className="mr-2 inline h-4 w-4" />
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
        <div className="mb-6 flex flex-col items-center">
          <Avatar src={chat.avatar_url} name={chat.title ?? "Group"} size={64} interactive={false} />
          <div className="mt-3 text-xl font-semibold">{chat.title ?? "Group"}</div>
          <div className="text-sm text-zinc-400">You’re invited to join this group</div>
        </div>

        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {joining ? "Joining…" : "Join group"}
        </button>

        <div className="mt-4 text-center text-xs text-zinc-500">
          You’ll be added as a member. Group admins can remove you at any time.
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div>Loading...</div>
      </div>
    }>
      <JoinPageContent />
    </Suspense>
  );
}
