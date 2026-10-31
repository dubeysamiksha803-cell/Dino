"use client";

import Topbar from "@/components/dashboard/Topbar";
import Sidebar from "@/components/dashboard/Sidebar";
import CommunitiesIndex from "@/components/communities/CommunitiesIndex";
import CreateCommunityModal from "@/components/communities/CreateCommunityModal";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getImageDisplayUrl } from "@/lib/media";

export default function CommunitiesPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "popular" | "new" | "joined">("all");
  const [sortBy, setSortBy] = useState<"recent" | "members" | "name">("recent");
  const [communities, setCommunities] = useState<Array<{ id: string; name: string; description?: string; avatarUrl?: string; coverUrl?: string; membersCount?: number; isNew?: boolean; joinLabel?: string }>>([]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setEmail(data.session?.user?.email ?? null);
        setUserId(data.session?.user?.id ?? null);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const fetchCommunities = async (tab = activeTab, sort = sortBy, uid = userId) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("filter", tab);
      params.set("sort", sort);
      if (uid) params.set("userId", uid);

      const res = await fetch(`/api/communities?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "failed");

      type CommunityApiRow = {
        id: string | number;
        name: string;
        description?: string | null;
        avatarUrl?: string | null;
        avatar_url?: string | null;
        coverUrl?: string | null;
        cover_url?: string | null;
        membersCount?: number | null;
        created_at?: string | null;
        isNew?: boolean;
        joinLabel?: string;
      };

      const baseList: Array<{ id: string; name: string; description?: string; avatarUrl?: string; coverUrl?: string; membersCount?: number; isNew?: boolean; joinLabel?: string }> =
        Array.isArray(json)
          ? (json as CommunityApiRow[]).map((c) => ({
            id: String(c.id),
            name: String(c.name),
            description: c.description ?? undefined,
            avatarUrl: c.avatarUrl ?? c.avatar_url ?? undefined,
            coverUrl: c.coverUrl ?? c.cover_url ?? undefined,
            membersCount: typeof c.membersCount === "number" ? c.membersCount : 0,
            isNew: c.isNew ?? false,
            joinLabel: c.joinLabel,
          }))
          : [];

      // Resolve display URLs for avatars and covers
      const withDisplayUrls = await Promise.all(
        baseList.map(async (item) => {
          let avatarDisplayUrl = item.avatarUrl;
          let coverDisplayUrl = item.coverUrl;

          try {
            if (item.avatarUrl) {
              avatarDisplayUrl = await getImageDisplayUrl(supabase, item.avatarUrl);
            }
            if (item.coverUrl) {
              coverDisplayUrl = await getImageDisplayUrl(supabase, item.coverUrl);
            }
          } catch {
            // Keep original URLs on error
          }

          return { ...item, avatarUrl: avatarDisplayUrl, coverUrl: coverDisplayUrl };
        })
      );

      setCommunities(withDisplayUrls);
    } catch {
      setCommunities([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when tab, sort, or userId changes
  useEffect(() => {
    // Only fetch after we've attempted to get the session
    // userId will be the user's id if logged in, or null if not logged in
    fetchCommunities(activeTab, sortBy, userId ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, sortBy, userId]);

  return (
    <div className="min-h-screen bg-black text-zinc-50">
      <Topbar email={email} />

      {/* Sidebar - fixed position */}
      <Sidebar />

      {/* Main content with left margin to account for fixed sidebar */}
      <main className="lg:ml-[280px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <CommunitiesIndex
            loading={loading}
            communities={searchQuery
              ? communities.filter((c) =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.description?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              : communities}
            onCreateClick={() => setOpenCreate(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
        </div>
      </main>

      <CreateCommunityModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={fetchCommunities}
        createdByUserId={userId}
      />
    </div>
  );
}

