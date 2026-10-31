"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  HomeIcon,
  GlobeAltIcon,
  UsersIcon,
  BookmarkIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

const items = [
  { href: "/", label: "For You", Icon: HomeIcon },
  { href: "/explore", label: "Discover", Icon: GlobeAltIcon },
  { href: "/communities", label: "Circles", Icon: UsersIcon },
  { href: "/bookmarks", label: "Saves", Icon: BookmarkIcon },
  { href: "/profile", label: "Profile", Icon: UserCircleIcon },
];

function MobileBottomNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Check if we're on chat page and have an active chat in URL params
  const chatId = searchParams?.get('id');
  const hasActiveChat = pathname === "/chat" && chatId;

  // Hide bottom nav when there's an active chat
  if (hasActiveChat) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800/60 bg-zinc-950/80 backdrop-blur lg:hidden">
      <ul className="flex items-stretch justify-between px-4 py-2">
        {items.map((it) => {
          const active = pathname === it.href;
          const Icon = it.Icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className="flex flex-col items-center gap-1 px-3 py-1 text-[10px] text-zinc-400"
              >
                <Icon className={active ? "h-5 w-5 text-zinc-200" : "h-5 w-5 text-zinc-500"} />
                <span className={active ? "text-zinc-200" : undefined}>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function MobileBottomNav() {
  return (
    <Suspense fallback={null}>
      <MobileBottomNavInner />
    </Suspense>
  );
}
