"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/dashboard/Sidebar";
import MobileTopbar from "@/components/mobile/MobileTopbar";
import Modal from "@/components/ui/Modal";
import ComposerInline from "@/components/dashboard/ComposerInline";
import RightRail from "@/components/dashboard/RightRail";
import { supabase } from "@/lib/supabaseClient";
import { APP_BG, PAGE_MAIN, LAYOUT_ROW } from "@/lib/theme";
import { Bell, Heart, MessageCircle, UserPlus, AtSign, Loader2, AlertCircle } from "lucide-react";
import {
  Notification,
  NotificationType,
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToNotifications,
} from "@/lib/notifications";

export default function NotificationsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);


  // Fetch notifications
  const loadNotifications = useCallback(async (uid: string) => {
    const { data, error: fetchError } = await fetchNotifications(supabase, uid, { limit: 50 });
    if (fetchError) {
      console.error(fetchError);
    } else {
      setNotifications(data || []);

    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      const uid = session.user.id;
      if (mounted) {
        setUserId(uid);
        setChecking(false);
      }

      // Load initial notifications
      await loadNotifications(uid);

      // Subscribe to real-time updates
      unsubscribe = subscribeToNotifications(
        supabase,
        uid,
        (newNotification) => {
          // Insert new notification at the top
          setNotifications((prev) => [newNotification, ...prev]);
        },
        (updatedNotification) => {
          // Update existing notification
          setNotifications((prev) =>
            prev.map((n) => (n.id === updatedNotification.id ? { ...n, ...updatedNotification } : n))
          );
        }
      );
    })();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [router, loadNotifications]);

  const markAllAsRead = async () => {
    if (!userId) return;
    setLoadingAction("markAll");
    const { success, error: markError } = await markAllNotificationsAsRead(supabase, userId);
    if (success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } else {
      console.error(markError);
    }
    setLoadingAction(null);
  };

  const markAsRead = async (id: string) => {
    setLoadingAction(id);
    const { success, error: markError } = await markNotificationAsRead(supabase, id);
    if (success) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } else {
      console.error(markError);
    }
    setLoadingAction(null);
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Navigate based on type
    if (notification.entity_type === "post" && notification.entity_id) {
      router.push(`/posts/${notification.entity_id}`);
    } else if (notification.type === "follow" || notification.type === "friend_request") {
      if (notification.actor?.username) {
        router.push(`/profile/${notification.actor.username}`);
      }
    } else if (notification.type === "message") {
      router.push("/chat");
    }
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case "like":
        return <Heart className="h-4 w-4 text-pink-400" />;
      case "comment":
        return <MessageCircle className="h-4 w-4 text-sky-400" />;
      case "follow":
      case "friend_request":
        return <UserPlus className="h-4 w-4 text-emerald-400" />;
      case "mention":
        return <AtSign className="h-4 w-4 text-amber-400" />;
      case "message":
        return <MessageCircle className="h-4 w-4 text-indigo-400" />;
      case "system":
        return <AlertCircle className="h-4 w-4 text-zinc-400" />;
      default:
        return <Bell className="h-4 w-4 text-zinc-400" />;
    }
  };

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 text-zinc-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className={APP_BG}>
      <MobileTopbar onCreatePost={() => setShowCreatePostModal(true)} />
      <main className={`${PAGE_MAIN} pb-20`}>
        <div className={LAYOUT_ROW}>
          <Sidebar onCreatePost={() => setShowCreatePostModal(true)} />

          {/* Main content area */}
          <div className="min-w-0 flex-1 max-w-3xl">
            {/* Header */}
            <header className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-6 w-6 text-zinc-400" />
                <h1 className="text-xl font-semibold text-white">Notifications</h1>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={loadingAction === "markAll"}
                  className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  {loadingAction === "markAll" ? "Marking..." : "Mark all as read"}
                </button>
              )}
            </header>

            {/* Filters */}
            <div className="mb-4 flex gap-1 rounded-lg bg-black border border-zinc-800 p-1">
              <button
                onClick={() => setFilter("all")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${filter === "all"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                  }`}
              >
                All
                {notifications.length > 0 && (
                  <span className="rounded-full bg-zinc-700 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
                    {notifications.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${filter === "unread"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                  }`}
              >
                Unread
                {unreadCount > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Notifications List */}
            <div className="rounded-xl bg-[#0a0a0a] border border-zinc-800/50">
              {filteredNotifications.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800">
                    <Bell className="h-8 w-8 text-zinc-600" />
                  </div>
                  <div className="text-sm font-medium text-zinc-400">
                    {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-600">
                    {filter === "unread"
                      ? "You're all caught up!"
                      : "When someone interacts with you, you'll see it here"}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {filteredNotifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex items-start gap-4 p-4 transition-colors cursor-pointer hover:bg-zinc-900 ${!n.read ? "bg-zinc-900/50" : ""
                        }`}
                    >
                      {/* Icon */}
                      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-zinc-800 border border-zinc-700">
                        {getIcon(n.type)}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200">
                          {n.actor?.username && (
                            <><span className="font-semibold">{n.actor.username}</span>{" "}</>
                          )}
                          <span className="text-zinc-400">{n.message}</span>
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {new Date(n.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      {/* Unread indicator */}
                      {!n.read && (
                        <div className="flex-none">
                          <div className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <RightRail />
        </div>
      </main>

      {/* Create Post Modal */}
      <Modal open={showCreatePostModal} onClose={() => setShowCreatePostModal(false)}>
        <ComposerInline />
      </Modal>
    </div>
  );
}
