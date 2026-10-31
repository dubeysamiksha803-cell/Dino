"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "@/components/dashboard/Sidebar";
import MobileTopbar from "@/components/mobile/MobileTopbar";
import Modal from "@/components/ui/Modal";
import ComposerInline from "@/components/dashboard/ComposerInline";
import FriendSearch from "@/components/friends/FriendSearch";
import Requests from "@/components/friends/Requests";
import FriendsList from "@/components/friends/FriendsList";
import { APP_BG, PAGE_MAIN, LAYOUT_ROW } from "@/lib/theme";
import { Users, Search, UserPlus, Loader2 } from "lucide-react";
import { listFriends, listIncomingRequests } from "@/lib/friends";

type Tab = "friends" | "requests" | "discover";

export default function FriendsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [friendCount, setFriendCount] = useState<number>(0);
  const [requestCount, setRequestCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<Tab>("friends");

  const fetchCounts = useCallback(async (userId: string) => {
    try {
      const [friends, requests] = await Promise.all([
        listFriends(userId),
        listIncomingRequests(userId),
      ]);
      setFriendCount(friends.length);
      setRequestCount(requests.length);
    } catch {
      // silently fail counts
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      setMyId(session.user.id);
      fetchCounts(session.user.id);
      setChecking(false);
    };
    init();
  }, [router, fetchCounts]);

  if (checking || !myId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 text-zinc-600 animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: "friends" as Tab, label: "Friends", icon: Users, count: friendCount },
    { id: "requests" as Tab, label: "Requests", icon: UserPlus, count: requestCount, highlight: requestCount > 0 },
    { id: "discover" as Tab, label: "Discover", icon: Search, count: null },
  ];

  return (
    <div className={APP_BG}>
      <MobileTopbar onCreatePost={() => setShowCreatePostModal(true)} />
      <main className={`${PAGE_MAIN} pb-20`}>
        <div className={LAYOUT_ROW}>
          <Sidebar onCreatePost={() => setShowCreatePostModal(true)} />

          {/* Main content area */}
          <div className="min-w-0 flex-1 max-w-3xl">
            {/* Simple Header */}
            <header className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800">
                  <Users className="h-6 w-6 text-zinc-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">Friends</h1>
                  <p className="text-sm text-zinc-500">Manage your connections</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{friendCount}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Friends</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{requestCount}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Pending</div>
                </div>
              </div>
            </header>

            {/* Tab Navigation */}
            <div className="mb-6 flex gap-1 rounded-lg bg-black border border-zinc-800 p-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${isActive
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                      }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {tab.count !== null && tab.count > 0 && (
                      <span
                        className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tab.highlight
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-zinc-700 text-zinc-400"
                          }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="space-y-4">
              {activeTab === "friends" && (
                <div className="rounded-xl bg-[#0a0a0a] border border-zinc-800/50 p-5">
                  <FriendsList myId={myId} />
                </div>
              )}

              {activeTab === "requests" && (
                <div className="rounded-xl bg-[#0a0a0a] border border-zinc-800/50 p-5">
                  <Requests myId={myId} />
                </div>
              )}

              {activeTab === "discover" && (
                <div className="rounded-xl bg-[#0a0a0a] border border-zinc-800/50 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Search className="h-4 w-4 text-zinc-400" />
                    <h2 className="text-sm font-semibold text-zinc-300">Find New Friends</h2>
                  </div>
                  <FriendSearch myId={myId} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Create Post Modal */}
      <Modal open={showCreatePostModal} onClose={() => setShowCreatePostModal(false)}>
        <ComposerInline />
      </Modal>
    </div>
  );
}
