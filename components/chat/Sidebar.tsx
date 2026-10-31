"use client";

import { useState } from "react";
import { Chat, User } from "./types";
import { MagnifyingGlassIcon, PlusIcon, ChevronLeftIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import WhatsAppImportModal from "./WhatsAppImportModal";
import Avatar from "@/components/ui/Avatar";
import { useSwipeable } from "react-swipeable";
import { motion } from "framer-motion";

export default function Sidebar({
  me,
  chats,
  activeId,
  onSelect,
  onNewChat,
}: {
  me: User;
  chats: Chat[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}) {
  const router = useRouter();
  const [showImportModal, setShowImportModal] = useState(false);

  const activeChat = chats.find(c => c.id === activeId);
  const activeMembers = activeChat?.members ?? [];

  const directTitle = (c: Chat) => {
    if (c.type !== 'direct') return c.title;
    const other = c.members?.find((m) => m.id !== me.id);
    return other?.username ?? c.title;
  };
  const directAvatar = (c: Chat) => {
    if (c.type !== 'direct') return c.avatarUrl ?? null;
    const other = c.members?.find((m) => m.id !== me.id);
    return other?.avatarUrl ?? c.avatarUrl ?? null;
  };
  return (
    <aside className="flex h-full w-full md:max-w-[360px] flex-col bg-black border-r border-neutral-900/50">
      <div className="flex items-center gap-3 p-4 border-b border-neutral-900/50">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800/60 bg-neutral-950 text-zinc-400 transition hover:bg-neutral-900 hover:text-zinc-200"
          aria-label="Back to home"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <Avatar src={me.avatarUrl ?? null} name={me.username} size={36} onClick={() => router.push(`/u/${me.id}`)} />
        {me.isOnline && <span className="ml-[-14px] mt-6 h-3 w-3 rounded-full border-2 border-black bg-emerald-500" />}
        <div className="flex-1">
          <div className="text-sm font-semibold text-zinc-100">{me.username}</div>
          <div className="text-xs text-zinc-600">Online</div>
        </div>
        <div className="flex items-center gap-1">
          {activeId && (
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-950 text-emerald-500 hover:bg-neutral-900 hover:text-emerald-400 transition-colors"
              title="Import WhatsApp Chat"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
            </button>
          )}
          <button onClick={onNewChat} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-950 text-zinc-400 hover:bg-neutral-900 hover:text-zinc-200 transition-colors">
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 pt-3">
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-700" />
          <input
            placeholder="Search chats"
            className="h-10 w-full rounded-xl border border-neutral-800/60 bg-neutral-950 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-neutral-700 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <ul className="space-y-1">
          {chats.map((c) => (
            <ChatListItem
              key={c.id}
              chat={c}
              active={activeId === c.id}
              onSelect={onSelect}
              title={directTitle(c)}
              avatar={directAvatar(c)}
            />
          ))}
        </ul>
      </div>

      {activeId && (
        <WhatsAppImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          chatId={activeId}
          members={activeMembers}
          onImportComplete={() => {
            // Ideally trigger a refresh or let realtime handle it
            setShowImportModal(false);
          }}
        />
      )}
    </aside>
  );
}

function ChatListItem({
  chat,
  active,
  onSelect,
  title,
  avatar,
}: {
  chat: Chat;
  active: boolean;
  onSelect: (id: string) => void;
  title: string | null;
  avatar: string | null;
}) {
  const [swiped, setSwiped] = useState(false);
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setSwiped(true),
    onSwipedRight: () => setSwiped(false),
    trackTouch: true,
    trackMouse: false,
  });

  return (
    <li>
      <div className="relative" {...swipeHandlers}>
        {swiped && (
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-2">
            <button className="pointer-events-auto rounded-full bg-neutral-900 px-3 py-1 text-xs text-zinc-500 hover:bg-neutral-800 hover:text-zinc-300">
              Mute
            </button>
            <button className="pointer-events-auto rounded-full bg-red-950/60 px-3 py-1 text-xs text-red-400 hover:bg-red-900/80">
              Delete
            </button>
          </div>
        )}
        <motion.button
          onClick={() => onSelect(chat.id)}
          className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-neutral-900/80 text-zinc-100" : "hover:bg-neutral-950"
            }`}
          animate={{ x: swiped ? -96 : 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
        >
          <div className="relative">
            <Avatar src={avatar} name={title ?? chat.title ?? "Chat"} size={40} interactive={false} />
            {(chat.members?.some((m) => m.isOnline) ?? false) && (
              <span className="absolute -bottom-0.5 -right-0.5 inline-block h-3 w-3 rounded-full border-2 border-black bg-emerald-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-medium text-zinc-200">{title}</span>
              {chat.lastMessageAt && (
                <span className="ml-2 shrink-0 text-xs text-zinc-600">
                  {new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              {typeof chat.unread === "number" && chat.unread > 0 && (
                <span className="inline-flex items-center rounded-full bg-neutral-800 px-2 py-0.5 text-xs font-medium text-zinc-300">
                  {chat.unread}
                </span>
              )}
            </div>
          </div>
        </motion.button>
      </div>
    </li>
  );
}
