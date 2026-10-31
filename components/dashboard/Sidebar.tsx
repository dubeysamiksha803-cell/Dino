"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
// Refreshing imports
import { Home, Compass, Users, MessageCircle, Bell, Bookmark, User, PenSquare, TrendingUp, BookOpen, Newspaper } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getUnreadCount, subscribeToNotifications } from "@/lib/notifications";

const nav = [
  { href: "/", label: "For You", Icon: Home },
  { href: "/explore", label: "Discover", Icon: Compass },
  { href: "/communities", label: "Circles", Icon: Users },
  { href: "/chat", label: "DMs", Icon: MessageCircle },
  { href: "/notifications", label: "Pings", Icon: Bell },
  { href: "/bookmarks", label: "Saves", Icon: Bookmark },
  { href: "/profile", label: "Profile", Icon: User },
];

const explore = [
  { label: "Trending Circles", Icon: TrendingUp },
  { label: "Sci‑Fi Vibes", Icon: BookOpen },
  { label: "What's Poppin", Icon: Newspaper },
];

export default function Sidebar({ onCreatePost }: { onCreatePost?: () => void }) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const setupNotifications = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const userId = data.session.user.id;

      // Initial count
      if (mounted) {
        const { count } = await getUnreadCount(supabase, userId);
        setUnreadCount(count);
      }

      // Subscribe to changes
      unsubscribe = subscribeToNotifications(
        supabase,
        userId,
        // On new notification
        () => {
          setUnreadCount((prev) => prev + 1);
        },
        // On update (e.g. read status change)
        () => {
          // Re-fetch count to be accurate
          getUnreadCount(supabase, userId).then(({ count }) => {
            if (mounted) setUnreadCount(count);
          });
        }
      );
    };

    setupNotifications();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <aside className="fixed left-6 top-6 hidden h-[calc(100vh-48px)] w-68 flex-none overflow-y-auto lg:block [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
      <div className="flex h-full flex-col gap-4">
        {/* Create Post Button */}
        <button
          type="button"
          onClick={() => onCreatePost?.()}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-black shadow-lg shadow-white/10 transition-all duration-200 hover:bg-slate-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          <PenSquare className="h-4 w-4" />
          Drop something
        </button>

        {/* Main Navigation */}
        <div className="rounded-xl bg-[#0a0a0a] p-3 shadow-sm shadow-white/5 border border-white/5">
          <nav className="flex flex-col gap-1">
            {nav.map((n) => {
              const isActive = pathname === n.href || (n.href !== "/" && pathname?.startsWith(n.href));
              const isNotifications = n.label === "Notifications";

              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isActive
                    ? "bg-white/10 text-white"
                    : "text-neutral-400 hover:bg-white/5 hover:text-white"
                    }`}
                >
                  <n.Icon className={`h-5 w-5 transition-colors ${isActive ? "text-white" : "text-neutral-500 group-hover:text-neutral-300"}`} />
                  <span className="flex-1">{n.label}</span>
                  {isNotifications && unreadCount > 0 && (
                    <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Explore Section */}
        <div className="rounded-xl bg-[#0a0a0a] p-3 shadow-sm shadow-white/5 border border-white/5">
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Explore
          </div>
          <div className="flex flex-col gap-1">
            {explore.map((item, idx) => (
              <button
                key={idx}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-neutral-400 transition-all duration-200 hover:bg-white/5 hover:text-white"
              >
                <item.Icon className="h-5 w-5 text-neutral-500" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
