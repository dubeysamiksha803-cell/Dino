"use client";

import { useState, useEffect, useRef } from "react";
import { Chat } from "./types";
import {
  ChevronLeftIcon,
  EllipsisVerticalIcon,
  PhoneIcon,
  VideoCameraIcon,
  ShieldExclamationIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import Avatar from "@/components/ui/Avatar";

export default function ChatHeader({
  chat,
  onBack,
  onClear,
  onToggleBlock,
  blockLabel,
  onOpenProfile,
  onStartAudioCall,
  onStartVideoCall,
  onShowMembers,
  onShowGroupInfo,
}: {
  chat: Chat | null;
  onBack?: () => void;
  onClear?: () => void;
  onToggleBlock?: () => void;
  blockLabel?: string;
  onOpenProfile?: () => void;
  onStartAudioCall?: () => void;
  onStartVideoCall?: () => void;
  onShowMembers?: () => void;
  onShowGroupInfo?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <header className="relative flex h-16 items-center gap-3 border-b border-neutral-900/50 bg-black px-3 backdrop-blur-md md:px-4 z-[60]">
      <button onClick={onBack} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-950 text-zinc-400 hover:bg-neutral-900 hover:text-zinc-200 md:hidden">
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      <button
        onClick={
          chat?.type === "group"
            ? (onShowMembers ?? onShowGroupInfo)
            : onOpenProfile
        }
        className="flex min-w-0 items-center gap-3"
      >
        <Avatar src={chat?.avatarUrl ?? null} name={chat?.title ?? 'Chat'} size={36} interactive={false} />
        <div className="min-w-0 text-left">
          <div className="truncate text-sm font-medium text-zinc-100">{chat?.title ?? "Select a chat"}</div>
          <div className="truncate text-xs text-zinc-500">{chat?.type === "group" ? "Group" : "Direct"}</div>
        </div>
      </button>
      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-950 text-zinc-400 hover:bg-neutral-900 hover:text-zinc-200"
        >
          <EllipsisVerticalIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Dropdown Menu */}
      {showMenu && (
        <div ref={menuRef} className="absolute right-3 top-14 z-[60] w-52 rounded-lg border border-neutral-800/60 bg-neutral-950 shadow-xl">
          {onStartAudioCall && (
            <button
              onClick={() => {
                onStartAudioCall();
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-3 rounded-t-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-neutral-900"
            >
              <PhoneIcon className="h-5 w-5" />
              <span>Audio call</span>
            </button>
          )}
          {onStartVideoCall && (
            <button
              onClick={() => {
                onStartVideoCall();
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-neutral-900"
            >
              <VideoCameraIcon className="h-5 w-5" />
              <span>Video call</span>
            </button>
          )}
          {onClear && (
            <button
              onClick={() => {
                onClear();
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-red-400 hover:bg-red-950/50"
            >
              <TrashIcon className="h-5 w-5" />
              <span>Clear chat</span>
            </button>
          )}
          {onToggleBlock && (
            <button
              onClick={() => {
                onToggleBlock();
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-3 rounded-b-lg px-3 py-2 text-left text-sm text-amber-300 hover:bg-amber-950/40"
            >
              <ShieldExclamationIcon className="h-5 w-5" />
              <span>{blockLabel ?? "Block user"}</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
}
