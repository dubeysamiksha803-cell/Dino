"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { XMarkIcon, MagnifyingGlassIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";

type ChatDisplay = {
    id: string;
    displayName: string;
    type: "direct" | "group";
    avatarUrl: string | null;
};

type SharePostModalProps = {
    open: boolean;
    onClose: () => void;
    postId: string;
    postContent?: string;
};

export default function SharePostModal({ open, onClose, postId, postContent }: SharePostModalProps) {
    const [chats, setChats] = useState<ChatDisplay[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        const fetchChats = async () => {
            setLoading(true);
            try {
                const { data: session } = await supabase.auth.getSession();
                const userId = session.session?.user?.id;
                if (!userId) return;

                // Get chats the user is a member of
                const { data: memberData } = await supabase
                    .from("chat_members")
                    .select("chat_id")
                    .eq("user_id", userId);

                if (!memberData || memberData.length === 0) {
                    setChats([]);
                    return;
                }

                const chatIds = memberData.map((m) => m.chat_id);

                // Get chat details
                const { data: chatData } = await supabase
                    .from("chats")
                    .select("id, title, type, avatar_url")
                    .in("id", chatIds);

                if (!chatData || chatData.length === 0) {
                    setChats([]);
                    return;
                }

                // Get all members for these chats to resolve direct chat names
                const { data: allMembers } = await supabase
                    .from("chat_members")
                    .select("chat_id, user_id")
                    .in("chat_id", chatIds);

                // Get unique user IDs to fetch profiles
                const memberUserIds = new Set<string>();
                (allMembers ?? []).forEach((m: { user_id: string }) => memberUserIds.add(m.user_id));

                // Fetch user profiles
                const profilesMap = new Map<string, { username: string; avatar_url: string | null }>();
                if (memberUserIds.size > 0) {
                    const { data: profiles } = await supabase
                        .from("users")
                        .select("id, username, avatar_url")
                        .in("id", Array.from(memberUserIds));

                    (profiles ?? []).forEach((p: { id: string; username: string; avatar_url: string | null }) => {
                        profilesMap.set(p.id, { username: p.username, avatar_url: p.avatar_url });
                    });
                }

                // Build members by chat
                const membersByChatId = new Map<string, string[]>();
                (allMembers ?? []).forEach((m: { chat_id: string; user_id: string }) => {
                    const arr = membersByChatId.get(m.chat_id) ?? [];
                    arr.push(m.user_id);
                    membersByChatId.set(m.chat_id, arr);
                });

                // Map chats with resolved display names and avatars
                const displayChats: ChatDisplay[] = chatData.map((c: { id: string; title: string | null; type: "direct" | "group"; avatar_url: string | null }) => {
                    let displayName = c.title ?? "Chat";
                    let avatarUrl = c.avatar_url;

                    // For direct chats, use the other user's name and avatar
                    if (c.type === "direct") {
                        const members = membersByChatId.get(c.id) ?? [];
                        const otherUserId = members.find((uid) => uid !== userId);
                        if (otherUserId) {
                            const otherProfile = profilesMap.get(otherUserId);
                            if (otherProfile) {
                                displayName = otherProfile.username;
                                avatarUrl = otherProfile.avatar_url;
                            }
                        }
                    }

                    return {
                        id: c.id,
                        displayName,
                        type: c.type,
                        avatarUrl,
                    };
                });

                if (!cancelled) {
                    setChats(displayChats);
                }
            } catch {
                // swallow
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchChats();
        return () => {
            cancelled = true;
        };
    }, [open]);

    const filteredChats = chats.filter((c) =>
        (c.displayName || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleChat = (chatId: string) => {
        setSelectedChats((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(chatId)) {
                newSet.delete(chatId);
            } else {
                newSet.add(chatId);
            }
            return newSet;
        });
    };

    const handleShare = async () => {
        if (selectedChats.size === 0) return;
        setSending(true);

        try {
            const { data: session } = await supabase.auth.getSession();
            const userId = session.session?.user?.id;
            if (!userId) return;

            const postUrl = `${window.location.origin}/posts/${postId}`;
            const shareMessage = `🔗 Shared a post:\n${postContent ? `"${postContent.slice(0, 100)}${postContent.length > 100 ? '...' : ''}"` : ''}\n\n${postUrl}`;

            // Send message to each selected chat
            for (const chatId of selectedChats) {
                await supabase.from("messages").insert({
                    chat_id: chatId,
                    sender_id: userId,
                    content: shareMessage,
                });
            }

            setSent(true);
            setTimeout(() => {
                onClose();
                setSent(false);
                setSelectedChats(new Set());
                setSearchQuery("");
            }, 1000);
        } catch {
            // swallow
        } finally {
            setSending(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
            <div
                className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                    <h2 className="text-lg font-semibold text-zinc-100">Share to Chat</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="border-b border-zinc-800 px-4 py-3">
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search chats..."
                            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                        />
                    </div>
                </div>

                {/* Chat List */}
                <div className="max-h-64 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-500" />
                        </div>
                    ) : filteredChats.length === 0 ? (
                        <div className="py-8 text-center text-sm text-zinc-500">
                            {searchQuery ? "No chats found" : "No chats available"}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredChats.map((chat) => (
                                <button
                                    key={chat.id}
                                    onClick={() => toggleChat(chat.id)}
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${selectedChats.has(chat.id)
                                        ? "bg-indigo-500/20 text-indigo-300"
                                        : "text-zinc-300 hover:bg-zinc-800"
                                        }`}
                                >
                                    {/* Avatar */}
                                    {chat.avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={chat.avatarUrl}
                                            alt={chat.displayName}
                                            className="h-10 w-10 rounded-full object-cover flex-shrink-0"
                                            onError={(e) => {
                                                // Hide broken image and show fallback
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                            }}
                                        />
                                    ) : null}
                                    <div
                                        className={`flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0 ${chat.avatarUrl ? 'hidden' : ''} ${chat.type === "group"
                                            ? "bg-gradient-to-br from-purple-500 to-indigo-600"
                                            : "bg-gradient-to-br from-emerald-500 to-teal-600"
                                            }`}
                                    >
                                        <span className="text-sm font-semibold text-white">
                                            {(chat.displayName || "C")[0].toUpperCase()}
                                        </span>
                                    </div>

                                    {/* Name */}
                                    <div className="min-w-0 flex-1 text-left">
                                        <div className="truncate text-sm font-medium">{chat.displayName}</div>
                                        <div className="text-xs text-zinc-500">
                                            {chat.type === "group" ? "Group" : "Direct"}
                                        </div>
                                    </div>

                                    {/* Checkbox */}
                                    <div
                                        className={`h-5 w-5 flex-none rounded-full border-2 transition-colors ${selectedChats.has(chat.id)
                                            ? "border-indigo-500 bg-indigo-500"
                                            : "border-zinc-600"
                                            }`}
                                    >
                                        {selectedChats.has(chat.id) && (
                                            <svg className="h-full w-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-zinc-800 px-4 py-3">
                    <button
                        onClick={handleShare}
                        disabled={selectedChats.size === 0 || sending || sent}
                        className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${sent
                            ? "bg-emerald-500 text-white"
                            : selectedChats.size === 0
                                ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                                : "bg-indigo-500 text-white hover:bg-indigo-600"
                            }`}
                    >
                        {sent ? (
                            <>
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Sent!
                            </>
                        ) : sending ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <PaperAirplaneIcon className="h-4 w-4" />
                                Share to {selectedChats.size || ""} {selectedChats.size === 1 ? "chat" : selectedChats.size > 0 ? "chats" : "selected"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
