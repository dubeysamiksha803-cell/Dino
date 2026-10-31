"use client";

import { useCallback, useEffect, useState } from "react";
import { listFriends, unfriend, createDirectChatIfNotExists } from "@/lib/friends";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import { MessageCircle, UserMinus, Loader2, Users, MoreHorizontal } from "lucide-react";

type FriendItem = { id: string; username: string; avatar_url: string | null; since: string };

export default function FriendsList({ myId }: { myId: string }) {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const router = useRouter();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listFriends(myId);
      setFriends(data as FriendItem[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Failed to load friends';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [myId]);

  useEffect(() => { refresh(); }, [refresh]);

  const startChat = async (otherId: string) => {
    try {
      await createDirectChatIfNotExists(myId, otherId);
      router.push("/chat");
    } catch { }
  };

  const handleRemove = async (friendId: string) => {
    setRemovingId(friendId);
    try {
      await unfriend(myId, friendId);
      await refresh();
    } finally {
      setRemovingId(null);
      setMenuOpenId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800">
          <Users className="h-8 w-8 text-zinc-600" />
        </div>
        <div className="text-sm font-medium text-zinc-400">No friends yet</div>
        <div className="mt-1 text-xs text-zinc-600">Go to Discover tab to find people to connect with</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {friends.map((f) => (
        <div
          key={f.id}
          className="group relative flex items-center gap-4 rounded-lg bg-zinc-900 p-4 transition-all hover:bg-zinc-800 border border-zinc-800"
        >
          {/* Avatar with online indicator */}
          <div className="relative">
            <Avatar src={f.avatar_url} name={f.username} size={48} />
            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-zinc-900 bg-emerald-500" />
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-zinc-100">{f.username}</span>
            </div>
            <div className="text-xs text-zinc-500">
              Friends since {new Date(f.since).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => startChat(f.id)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              title="Send message"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpenId(menuOpenId === f.id ? null : f.id)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-700/50 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
                title="More options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpenId === f.id && (
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl shadow-black/40">
                  <button
                    onClick={() => handleRemove(f.id)}
                    disabled={removingId === f.id}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-400 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                  >
                    {removingId === f.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserMinus className="h-4 w-4" />
                    )}
                    Remove friend
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
