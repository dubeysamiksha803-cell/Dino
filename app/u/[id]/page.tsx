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
import { useParams, useRouter } from "next/navigation";

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const username = params?.id ? decodeURIComponent(params.id) : null;

  const [email, setEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"posts" | "media" | "replies">("posts");

  useEffect(() => {
    let mounted = true;
    if (!username) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        const uid = session?.user?.id;

        if (mounted) {
          setEmail(session?.user?.email ?? null);
          setCurrentUserId(uid ?? null);
        }

        // 1. Fetch user by username (public profile)
        const { data: userRow } = await supabase
          .from("users")
          .select("id, username, full_name, avatar_url, bio, cover_url")
          .eq("username", username)
          .maybeSingle();

        if (!userRow) {
          // Determine if we should redirect or show 404. 
          // For now, let's stop loading and show "User not found".
          if (mounted) setLoading(false);
          return;
        }

        // If this is my profile, redirect to main profile page
        if (uid && userRow.id === uid) {
          router.replace("/profile");
          return;
        }

        // Process Images
        let avatarUrl: string | undefined = userRow.avatar_url || undefined;
        if (avatarUrl && /^s3:\/\//i.test(avatarUrl)) {
          try { avatarUrl = await getImageDisplayUrl(supabase, avatarUrl); } catch { }
        }
        let coverUrl: string | undefined = (userRow as { cover_url?: string | null }).cover_url || undefined;
        if (coverUrl && /^s3:\/\//i.test(coverUrl)) {
          try { coverUrl = await getImageDisplayUrl(supabase, coverUrl); } catch { }
        }

        if (mounted) {
          setProfile({
            id: userRow.id,
            name: userRow.full_name || userRow.username || "User",
            handle: userRow.username || "",
            avatarUrl,
            bannerUrl: coverUrl,
            bio: userRow.bio || undefined,
          });
        }

        // 2. Fetch Stats
        const { count } = await supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("author_id", userRow.id);

        if (mounted) setStats({ posts: typeof count === "number" ? count : undefined });

        // 3. Check Follow Status
        if (uid) {
          const { data: followData } = await supabase
            .from("user_followers")
            .select("id")
            .eq("follower_id", uid)
            .eq("following_id", userRow.id)
            .maybeSingle();
          if (mounted) setIsFollowing(!!followData);
        }

      } catch (e) {
        console.error("Error fetching profile:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    return () => { mounted = false; };
  }, [username, router]);

  const onToggleFollow = async () => {
    if (!currentUserId || !profile) return;
    // Optimistic update
    const nextState = !isFollowing;
    setIsFollowing(nextState);

    try {
      if (nextState) {
        await supabase.from("user_followers").insert({ follower_id: currentUserId, following_id: profile.id });
      } else {
        await supabase.from("user_followers").delete().eq("follower_id", currentUserId).eq("following_id", profile.id);
      }
    } catch {
      // Revert on error
      setIsFollowing(!nextState);
    }
  };


  if (!username) return null;

  return (
    <div className={APP_BG}>
      <Topbar email={email} />
      <main className={PAGE_MAIN}>
        <div className={LAYOUT_ROW}>
          <Sidebar />
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/60 p-6 text-zinc-400">Loading profile…</div>
            ) : !profile ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <h2 className="text-xl font-semibold text-zinc-200">User not found</h2>
                <p className="mt-2 text-sm text-zinc-500">The user @{username} does not exist or has deleted their account.</p>
                <button onClick={() => router.push("/")} className="mt-6 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700">
                  Go Home
                </button>
              </div>
            ) : (
              <ProfileView
                profile={profile ?? undefined}
                stats={stats ?? undefined}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    {currentUserId && (
                      <button
                        onClick={onToggleFollow}
                        className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-medium backdrop-blur-md transition-all ${isFollowing
                          ? "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800/80"
                          : "border-white/10 bg-white text-black hover:bg-white/90"
                          }`}
                      >
                        {isFollowing ? "Following" : "Follow"}
                      </button>
                    )}

                    <button className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-black/60 px-3 py-2 text-xs font-medium text-zinc-300 backdrop-blur-md transition-all hover:bg-zinc-900">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                      </svg>
                    </button>
                  </div>
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

