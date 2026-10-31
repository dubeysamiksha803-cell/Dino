"use client";

import { useEffect, useState } from "react";
import { searchUsersByUsername, sendFriendRequest, createDirectChatIfNotExists, type PublicUser } from "@/lib/friends";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import { Search, MessageCircle, UserPlus, ExternalLink, Loader2 } from "lucide-react";

export default function FriendSearch({ myId }: { myId: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const v = q.trim();
      if (!v) { setResults([]); setSearching(false); return; }
      setSearching(true);
      setError(null);
      try {
        const data = await searchUsersByUsername(v);
        setResults(data.filter((u) => u.id !== myId));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Search failed';
        setError(msg);
      } finally {
        setSearching(false);
      }
    };
    const t = setTimeout(run, 300);
    return () => clearTimeout(t);
  }, [q, myId]);

  const onAdd = async (otherId: string) => {
    setAddingId(otherId);
    setError(null);
    try {
      await sendFriendRequest(myId, otherId);
      setAddedIds(prev => new Set(prev).add(otherId));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Failed to send request';
      setError(msg);
    } finally {
      setAddingId(null);
    }
  };

  const startChat = async (otherId: string) => {
    try {
      await createDirectChatIfNotExists(myId, otherId);
      router.push("/chat");
    } catch { }
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search for people by username..."
          className="h-11 w-full rounded-lg border border-zinc-800 bg-black pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all focus:outline-none focus:ring-1 focus:ring-zinc-700 focus:border-zinc-700"
        />
        {searching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className="h-5 w-5 text-indigo-400 animate-spin" />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 ? (
        <div className="space-y-2">
          {results.map((u) => {
            const isAdded = addedIds.has(u.id);
            return (
              <div
                key={u.id}
                className="group flex items-center justify-between gap-4 rounded-lg bg-zinc-900 p-3 transition-all hover:bg-zinc-800 border border-zinc-800"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar src={u.avatar_url ?? null} name={u.username} size={48} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-100">{u.username}</div>
                    {u.full_name && (
                      <div className="truncate text-xs text-zinc-500">{u.full_name}</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <button
                    onClick={() => startChat(u.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-700/50 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                    title="Send message"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                  {isAdded ? (
                    <div className="flex h-9 items-center gap-2 rounded-lg bg-emerald-500/10 px-4 text-sm font-medium text-emerald-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Sent
                    </div>
                  ) : (
                    <button
                      onClick={() => onAdd(u.id)}
                      disabled={addingId === u.id}
                      className="flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-black transition-all hover:bg-zinc-200 disabled:opacity-50"
                    >
                      {addingId === u.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                      Add
                    </button>
                  )}
                  <a
                    href={`/u/${u.id}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-700/50 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                    title="View Profile"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : q.trim() && !searching ? (
        <div className="py-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50">
            <Search className="h-7 w-7 text-zinc-600" />
          </div>
          <div className="text-sm text-zinc-400">No users found for &quot;{q}&quot;</div>
          <div className="mt-1 text-xs text-zinc-600">Try a different username</div>
        </div>
      ) : !q.trim() ? (
        <div className="py-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800">
            <Search className="h-7 w-7 text-zinc-600" />
          </div>
          <div className="text-sm text-zinc-400">Search for people</div>
          <div className="mt-1 text-xs text-zinc-600">Type a username above to find someone</div>
        </div>
      ) : null}
    </div>
  );
}
