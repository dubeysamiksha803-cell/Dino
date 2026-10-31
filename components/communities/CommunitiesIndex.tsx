"use client";

type Community = {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  coverUrl?: string;
  membersCount?: number;
  joinLabel?: string;
  isNew?: boolean;
};

type TabKey = "all" | "popular" | "new" | "joined";
type SortKey = "recent" | "members" | "name";

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-950">
      <div className="h-24 w-full bg-zinc-900" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="-mt-8 h-12 w-12 rounded-lg border-2 border-zinc-950 bg-zinc-800" />
          <div className="min-w-0 flex-1 pt-1">
            <div className="h-4 w-24 rounded bg-zinc-800" />
            <div className="mt-2 h-3 w-36 rounded bg-zinc-800/60" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="h-3 w-16 rounded bg-zinc-800/60" />
          <div className="h-8 w-16 rounded-lg bg-zinc-800/60" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreateClick, searchQuery }: { onCreateClick: () => void; searchQuery?: string }) {
  const isSearchEmpty = searchQuery && searchQuery.length > 0;

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800/30 bg-zinc-950/80 px-6 py-12 text-center">
      {/* Illustration */}
      <div className="relative mb-6">
        <div className="absolute -inset-3 rounded-full bg-zinc-800/10 blur-xl" />
        <div className="relative flex items-center justify-center">
          <div className="absolute h-20 w-20 rounded-xl border border-zinc-700/20 bg-zinc-900/60 rotate-12" />
          <div className="absolute h-20 w-20 rounded-xl border border-zinc-700/20 bg-zinc-800/40 -rotate-6" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-xl border border-zinc-700/40 bg-zinc-950">
            {isSearchEmpty ? (
              <svg className="h-8 w-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            ) : (
              <svg className="h-8 w-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            )}
          </div>
        </div>
      </div>

      <h3 className="mb-2 text-lg font-semibold text-zinc-200">
        {isSearchEmpty ? "No communities found" : "No communities yet"}
      </h3>
      <p className="mb-6 max-w-xs text-sm text-zinc-500">
        {isSearchEmpty
          ? `No communities match "${searchQuery}". Try a different search term.`
          : "Be the first to create a community and bring people together."
        }
      </p>
      {!isSearchEmpty && (
        <button
          onClick={onCreateClick}
          className="flex items-center gap-2 rounded-lg bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-900 transition-all hover:bg-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Community
        </button>
      )}
    </div>
  );
}

function CommunityCard({ community, onJoin }: { community: Community; onJoin?: (id: string) => void }) {
  return (
    <a
      href={`/communities/${community.id}`}
      className="group block overflow-hidden rounded-xl border border-zinc-800/50 bg-zinc-950 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/80"
    >
      {/* Cover */}
      <div className="relative h-24 w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 overflow-hidden">
        {community.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={community.coverUrl} alt="cover" className="h-full w-full object-cover" />
        )}
        {community.isNew && (
          <span className="absolute right-2 top-2 rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-900">
            New
          </span>
        )}
      </div>

      <div className="p-4">
        {/* Avatar */}
        <div className="mb-3 h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 shadow-lg">
          {community.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={community.avatarUrl} alt={community.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-lg font-bold text-zinc-400">
              {community.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-zinc-100 transition-colors group-hover:text-white">
            {community.name}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
            {community.description || "A community for like-minded people"}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between pt-3 border-t border-zinc-800/50">
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <span>{typeof community.membersCount === 'number' ? community.membersCount.toLocaleString() : '0'} members</span>
          </div>
          {community.joinLabel ? (
            <span className="rounded-lg bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300">
              {community.joinLabel}
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onJoin?.(community.id);
              }}
              className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition-all hover:bg-white"
            >
              Join
            </button>
          )}
        </div>
      </div>
    </a>
  );
}

function StatsBar({ totalCommunities, activeTab }: { totalCommunities: number; activeTab: TabKey }) {
  const tabLabels = { all: "All Communities", popular: "Popular", new: "New", joined: "Joined" };
  return (
    <div className="mb-4 flex items-center justify-between text-xs text-zinc-500">
      <span>Showing {totalCommunities} {tabLabels[activeTab].toLowerCase()}</span>
    </div>
  );
}

export default function CommunitiesIndex({
  communities,
  loading = false,
  onCreateClick,
  searchQuery,
  onSearchChange,
  activeTab = "all",
  onTabChange,
  sortBy = "recent",
  onSortChange,
}: {
  communities?: Community[] | null;
  loading?: boolean;
  onCreateClick?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  sortBy?: SortKey;
  onSortChange?: (sort: SortKey) => void;
}) {
  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All", icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
    { key: "popular", label: "Popular", icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg> },
    { key: "new", label: "New", icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg> },
    { key: "joined", label: "Joined", icon: <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg> },
  ];

  // Communities are now filtered server-side, just use them directly
  const filteredCommunities = communities ?? [];

  return (
    <section className="w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Communities</h1>
            <p className="mt-1 text-sm text-zinc-500">Find your tribe and connect with like-minded people</p>
          </div>
          <button
            onClick={onCreateClick}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-all hover:bg-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchQuery ?? ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full rounded-lg border border-zinc-800/60 bg-zinc-950 py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700/50"
            placeholder="Search communities..."
          />
        </div>
      </div>

      {/* Tabs & Sort */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-zinc-900/80 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange?.(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${activeTab === tab.key
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300"
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <select
          value={sortBy}
          onChange={(e) => onSortChange?.(e.target.value as SortKey)}
          className="rounded-lg border border-zinc-800/60 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-400 focus:border-zinc-700 focus:outline-none"
        >
          <option value="recent">Most Recent</option>
          <option value="members">Most Members</option>
          <option value="name">Name A-Z</option>
        </select>
      </div>

      {/* Stats */}
      {!loading && filteredCommunities.length > 0 && (
        <StatsBar totalCommunities={filteredCommunities.length} activeTab={activeTab} />
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredCommunities.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCommunities.map((c) => (
            <CommunityCard key={c.id} community={c} />
          ))}
        </div>
      ) : (
        <EmptyState onCreateClick={onCreateClick ?? (() => { })} searchQuery={searchQuery} />
      )}
    </section>
  );
}
