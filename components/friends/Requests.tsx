"use client";

import { useCallback, useEffect, useState } from "react";
import { acceptFriendRequest, cancelFriendRequest, listIncomingRequests, listOutgoingRequests, rejectFriendRequest, type FriendRequest } from "@/lib/friends";
import Avatar from "@/components/ui/Avatar";
import { Check, X, Loader2, UserCheck, Clock, Inbox, Send } from "lucide-react";

export default function Requests({ myId }: { myId: string }) {
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"incoming" | "outgoing">("incoming");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [inc, out] = await Promise.all([
        listIncomingRequests(myId),
        listOutgoingRequests(myId),
      ]);
      setIncoming(inc);
      setOutgoing(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : typeof e === 'string' ? e : 'Failed to load requests';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [myId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAccept = async (id: string) => {
    setProcessingId(id);
    try {
      await acceptFriendRequest(id, myId);
      await refresh();
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await rejectFriendRequest(id, myId);
      await refresh();
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    setProcessingId(id);
    try {
      await cancelFriendRequest(id, myId);
      await refresh();
    } finally {
      setProcessingId(null);
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

  return (
    <div className="space-y-4">
      {/* Section Toggle */}
      <div className="flex gap-1 rounded-lg bg-black border border-zinc-800 p-1">
        <button
          onClick={() => setActiveSection("incoming")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${activeSection === "incoming"
            ? "bg-zinc-700 text-white shadow-sm"
            : "text-zinc-400 hover:text-zinc-200"
            }`}
        >
          <Inbox className="h-4 w-4" />
          <span>Received</span>
          {incoming.length > 0 && (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
              {incoming.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSection("outgoing")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${activeSection === "outgoing"
            ? "bg-zinc-700 text-white shadow-sm"
            : "text-zinc-400 hover:text-zinc-200"
            }`}
        >
          <Send className="h-4 w-4" />
          <span>Sent</span>
          {outgoing.length > 0 && (
            <span className="rounded-full bg-zinc-600 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">
              {outgoing.length}
            </span>
          )}
        </button>
      </div>

      {/* Incoming Requests */}
      {activeSection === "incoming" && (
        <div className="space-y-2">
          {incoming.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800">
                <UserCheck className="h-7 w-7 text-zinc-600" />
              </div>
              <div className="text-sm text-zinc-400">No pending requests</div>
              <div className="mt-1 text-xs text-zinc-600">When someone sends you a request, it will appear here</div>
            </div>
          ) : (
            incoming.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-lg bg-zinc-900 p-4 transition-colors hover:bg-zinc-800 border border-zinc-800"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar src={r.sender?.avatar_url ?? null} name={r.sender?.username ?? r.sender_id} size={44} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-100">
                      {r.sender?.username ?? r.sender_id}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-amber-400">
                      <Clock className="h-3 w-3" />
                      <span>Wants to be friends</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <button
                    onClick={() => handleAccept(r.id)}
                    disabled={processingId === r.id}
                    className="flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-black transition-all hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {processingId === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Accept
                  </button>
                  <button
                    onClick={() => handleReject(r.id)}
                    disabled={processingId === r.id}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-700/50 text-zinc-400 transition-colors hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
                    title="Decline"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Outgoing Requests */}
      {activeSection === "outgoing" && (
        <div className="space-y-2">
          {outgoing.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800">
                <Send className="h-7 w-7 text-zinc-600" />
              </div>
              <div className="text-sm text-zinc-400">No sent requests</div>
              <div className="mt-1 text-xs text-zinc-600">Find people in the Discover tab and send them a request</div>
            </div>
          ) : (
            outgoing.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 rounded-lg bg-zinc-900 p-4 transition-colors hover:bg-zinc-800 border border-zinc-800"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar src={r.receiver?.avatar_url ?? null} name={r.receiver?.username ?? r.receiver_id} size={44} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-100">
                      {r.receiver?.username ?? r.receiver_id}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <Clock className="h-3 w-3" />
                      <span>{r.status === "pending" ? "Awaiting response" : r.status}</span>
                    </div>
                  </div>
                </div>
                {r.status === 'pending' && (
                  <button
                    onClick={() => handleCancel(r.id)}
                    disabled={processingId === r.id}
                    className="flex h-9 items-center gap-2 rounded-lg bg-zinc-700/50 px-4 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                  >
                    {processingId === r.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    Cancel
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
