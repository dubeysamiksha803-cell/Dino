"use client";

import Topbar from "@/components/dashboard/Topbar";
import Sidebar from "@/components/dashboard/Sidebar";
import ProfileView from "@/components/profile/ProfileView";
import ProfileMediaGrid from "@/components/profile/ProfileMediaGrid";
import PostList from "@/components/posts/PostList";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getImageDisplayUrl } from "@/lib/media";
import { APP_BG, PAGE_MAIN, LAYOUT_ROW } from "@/lib/theme";

export default function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    id: string;
    name: string;
    handle: string;
    avatarUrl?: string;
    bannerUrl?: string;
    bio?: string;
    location?: string;
    website?: string;
  } | null>(null);
  const [stats, setStats] = useState<{ posts?: number; followers?: number; following?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatarInputId = "avatar-file-input";
  const bannerInputId = "banner-file-input";
  const [tab, setTab] = useState<"posts" | "media" | "replies">("posts");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (mounted) setEmail(session?.user?.email ?? null);
      const uid = session?.user?.id;
      if (!uid) return;
      // Load profile from users (fallbacks applied)
      const { data: userRow } = await supabase
        .from("users")
        .select("id, username, full_name, avatar_url, bio, cover_url")
        .eq("id", uid)
        .maybeSingle();
      if (mounted && userRow) {
        let avatarUrl: string | undefined = userRow.avatar_url || undefined;
        if (avatarUrl && /^s3:\/\//i.test(avatarUrl)) {
          avatarUrl = await getImageDisplayUrl(supabase, avatarUrl);
        }
        let coverUrl: string | undefined = (userRow as { cover_url?: string | null }).cover_url || undefined;
        if (coverUrl && /^s3:\/\//i.test(coverUrl)) {
          coverUrl = await getImageDisplayUrl(supabase, coverUrl);
        }
        setProfile({
          id: userRow.id,
          name: userRow.full_name || userRow.username || "",
          handle: userRow.username || "",
          avatarUrl,
          bannerUrl: coverUrl,
          bio: userRow.bio || undefined,
        });
      } else {
        // Fallback to profiles table if present
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, bio, cover_url")
          .eq("id", uid)
          .maybeSingle();
        if (mounted && profileRow) {
          let avatarUrl: string | undefined = profileRow.avatar_url || undefined;
          if (avatarUrl && /^s3:\/\//i.test(avatarUrl)) {
            avatarUrl = await getImageDisplayUrl(supabase, avatarUrl);
          }
          let coverUrl: string | undefined = (profileRow as { cover_url?: string | null }).cover_url || undefined;
          if (coverUrl && /^s3:\/\//i.test(coverUrl)) {
            coverUrl = await getImageDisplayUrl(supabase, coverUrl);
          }
          setProfile({
            id: profileRow.id,
            name: profileRow.full_name || profileRow.username || "",
            handle: profileRow.username || "",
            avatarUrl,
            bannerUrl: coverUrl,
            bio: profileRow.bio || undefined,
          });
        } else if (mounted) {
          // Last resort: build minimal profile from session
          const meta = session?.user?.user_metadata as Record<string, unknown> | undefined;
          setProfile({
            id: uid,
            name:
              (typeof meta?.full_name === "string" && meta.full_name) ||
              (typeof meta?.name === "string" && meta.name) ||
              session?.user?.email ||
              "User",
            handle:
              (typeof meta?.user_name === "string" && meta.user_name) ||
              (typeof meta?.username === "string" && meta.username) ||
              (session?.user?.email?.split("@")[0] ?? ""),
            avatarUrl: undefined,
          });
        }
      }
      // Basic stats: posts count
      const { count } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", uid);
      if (mounted) setStats({ posts: typeof count === "number" ? count : undefined });
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const readAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve((fr.result as string));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

  const handleUpload = async (file: File, kind: "avatar" | "banner") => {
    setSaving(true); setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const uid = session?.user?.id as string;
      if (!uid) return;
      const dataUrl = await readAsDataUrl(file);
      const fileName = `${kind}-${Date.now()}.${(file.name.split(".").pop() || "jpg").toLowerCase()}`;
      // Use the same method as chat: Supabase Functions invoke('upload-image')
      const { data: uploadRes, error: upErr } = await supabase.functions.invoke('upload-image', {
        body: { imageData: dataUrl, fileName, userId: uid },
      });
      if (upErr) throw upErr;
      const s3Url = (uploadRes as { imageUrl?: string } | null)?.imageUrl as string;
      const table = await supabase.from("users").select("id").eq("id", uid).maybeSingle();
      if (table.data) {
        await supabase.from("users").update({ [kind === "avatar" ? "avatar_url" : "cover_url"]: s3Url }).eq("id", uid);
      } else {
        await supabase.from("profiles").update({ [kind === "avatar" ? "avatar_url" : "cover_url"]: s3Url }).eq("id", uid);
      }
      // Refresh local state with resolved display URL (same as chats)
      const displayUrl = await getImageDisplayUrl(supabase, s3Url);
      setProfile((prev) => prev ? { ...prev, [kind === "avatar" ? "avatarUrl" : "bannerUrl"]: displayUrl } : prev);
    } catch (e: unknown) {
      const message = e instanceof Error && typeof e.message === "string" ? e.message : "Upload failed";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={APP_BG}>
      <Topbar email={email} />
      <main className={PAGE_MAIN}>
        <div className={LAYOUT_ROW}>
          <Sidebar />
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/60 p-6 text-zinc-400">Loading profile…</div>
            ) : (
              <ProfileView
                profile={profile ?? undefined}
                stats={stats ?? undefined}
                actions={
                  <>
                    <input id={avatarInputId} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "avatar"); }} />
                    <input id={bannerInputId} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, "banner"); }} />

                    {/* Mobile: Compact layout with single settings button */}
                    <div className="flex items-center gap-2 sm:hidden">
                      <a
                        href="/profile/edit"
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs font-medium text-white backdrop-blur-md transition-all hover:bg-black/80"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit
                      </a>
                      <a
                        href="/profile/settings"
                        className="flex items-center justify-center rounded-lg border border-white/10 bg-black/60 p-2 text-white backdrop-blur-md transition-all hover:bg-black/80"
                        aria-label="Settings"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </a>
                    </div>

                    {/* Desktop: Full buttons in a row */}
                    <div className="hidden items-center gap-2 sm:flex">
                      <a
                        href="/profile/edit"
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs font-medium text-white backdrop-blur-md transition-all hover:bg-black/80"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit Profile
                      </a>
                      <a
                        href="/profile/settings"
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs font-medium text-white backdrop-blur-md transition-all hover:bg-black/80"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </a>
                    </div>

                    {saving && <span className="text-xs text-white/70">Saving…</span>}
                    {error && <span className="text-xs text-red-400">{error}</span>}
                  </>
                }
              >
                {/* Tabs */}
                <div className="mb-6 flex items-center gap-8 border-b border-white/10 text-sm">
                  {([
                    { id: "posts", label: "Posts" },
                    { id: "media", label: "Media" },
                    { id: "replies", label: "Replies" },
                  ] as const).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`relative pb-3 font-medium transition-colors duration-200 ${tab === t.id ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                    >
                      {t.label}
                      <span className={`absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-sky-400 transition-opacity duration-200 ${tab === t.id ? "opacity-100" : "opacity-0"}`} />
                    </button>
                  ))}
                </div>

                {/* Content by tab */}
                {profile?.id ? (
                  tab === "media" ? (
                    <ProfileMediaGrid userId={profile.id} />
                  ) : (
                    <PostList columns={2} authorId={profile.id} repliesOnly={tab === "replies"} />
                  )
                ) : null}
              </ProfileView>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
