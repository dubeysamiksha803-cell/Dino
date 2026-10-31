"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { edgeImageUrlFromS3, getImageDisplayUrl } from "@/lib/media";
import Sidebar from "@/components/chat/Sidebar";
import ChatHeader from "@/components/chat/ChatHeader";
import CallModal from "@/components/call/CallModal";
import MessageList from "@/components/chat/MessageList";
import Composer from "@/components/chat/Composer";
import type { Chat, Message, User } from "@/components/chat/types";
import { getCallChannel, getUserCallChannel, sendSignal, sendUserSignal, type SignalEvent } from "@/lib/signaling";
import { startCall } from "@/lib/calls";
import GroupCreateModal from "@/components/chat/GroupCreateModal";
import RingSubsetModal from "@/components/call/RingSubsetModal";
import GroupMembersModal from "@/components/chat/GroupMembersModal";
import { markMessagesAsRead, getMessageReadStatus } from "@/lib/messageReads";

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlChatId = searchParams?.get('id');
  const [checking, setChecking] = useState(true);
  const [me, setMe] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mobile sidebar toggle
  const [showSidebar, setShowSidebar] = useState(true);
  const [callOpen, setCallOpen] = useState(false);
  const [callIsVideo, setCallIsVideo] = useState(false);
  const [incomingFrom, setIncomingFrom] = useState<string | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const callChannelRef = useRef<ReturnType<typeof getCallChannel> | null>(null);
  const userChannelRef = useRef<ReturnType<typeof getUserCallChannel> | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewChooser, setShowNewChooser] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showRingSubset, setShowRingSubset] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [ringMode, setRingMode] = useState<"audio" | "video">("audio");
  const [, setCreating] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);

  const swipeHandlers = useSwipeable({
    onSwipedRight: () => setShowSidebar(true),
    onSwipedLeft: () => setShowSidebar(false),
    trackTouch: true,
    trackMouse: false,
  });

  // Local row types to avoid 'any' in Supabase results
  type ChatMemberRow = { chat_id: string; user_id: string };
  type ChatRow = { id: string; type: "direct" | "group"; title: string | null; avatar_url: string | null; created_at: string };
  type UserRow = { id: string; username: string; avatar_url: string | null };
  type MessageRow = { id: string; chat_id: string; content: string | null; created_at: string; sender_id: string; reply_to: string | null; message_type: string | null };

  // Data
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; author: string; content: string } | null>(null);
  void loadingMessages; // satisfy lint when not rendered
  void loadingChats;    // satisfy lint when not rendered

  useEffect(() => {
    // Subscribe to call signaling for current chat
    if (!activeId) return;
    const ch = getCallChannel(activeId);
    callChannelRef.current = ch;
    ch.on('broadcast', { event: 'signal' }, ({ payload }: { payload: SignalEvent }) => {
      const p = payload;
      if (!me) return;
      if (p.type === 'ring') {
        // If already in a call, reply busy
        if (callOpen) {
          sendSignal(activeId, { type: 'busy', from: me.id });
          return;
        }
        setCallIsVideo(p.isVideo);
        setIncomingFrom(p.from);
        if (p.callId) setActiveCallId(p.callId);
        setCallOpen(true);
      }
    });
    ch.subscribe();
    return () => {
      try { ch.unsubscribe(); } catch { }
      if (callChannelRef.current === ch) callChannelRef.current = null;
    };
  }, [activeId, me, callOpen]);

  useEffect(() => {
    // Subscribe to per-user signaling so we can receive calls even when not viewing the chat
    if (!me?.id) return;
    const myId = me.id;
    const uch = getUserCallChannel(myId);
    userChannelRef.current = uch;
    uch.on('broadcast', { event: 'signal' }, ({ payload }: { payload: SignalEvent & { chatId?: string } }) => {
      const p = payload;
      if (!p) return;
      if (p.type === 'ring') {
        const ringChatId = payload.chatId as string | undefined;
        if (callOpen) {
          // Reply busy on user channel if already in a call
          if (payload && ringChatId) sendUserSignal(p.from, { ...p, type: 'busy', chatId: ringChatId, from: myId });
          return;
        }
        if (ringChatId && ringChatId !== activeId) setActiveId(ringChatId);
        setCallIsVideo(p.isVideo);
        setIncomingFrom(p.from);
        if (p.callId) setActiveCallId(p.callId);
        setCallOpen(true);
      }
    });
    uch.subscribe();
    return () => { try { uch.unsubscribe(); } catch { } if (userChannelRef.current === uch) userChannelRef.current = null; };
  }, [me?.id, callOpen, activeId]);
  useEffect(() => {
    const init = async () => {
      setError(null);
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const id = session.user.id;
      const email = session.user.email ?? "";
      try {
        // Load my user (tolerate absence while bootstrap)
        const { data: meRow } = await supabase
          .from("users")
          .select("id, username, avatar_url")
          .eq("id", id)
          .maybeSingle();
        const username = (meRow?.username as string) || (session.user.user_metadata?.username as string) || email.split("@")[0];
        setMe({ id, username, avatarUrl: meRow?.avatar_url ?? null, isOnline: true });

        // Load chats I am a member of
        setLoadingChats(true);
        const { data: memberRows, error: mErr } = await supabase
          .from("chat_members")
          .select("chat_id")
          .eq("user_id", id);
        if (mErr) throw mErr;
        const chatIds = (memberRows ?? []).map((r: { chat_id: string }) => r.chat_id);
        if (chatIds.length === 0) {
          setChats([]);
          setChecking(false);
          setLoadingChats(false);
          return;
        }
        const { data: chatRows, error: cErr } = await supabase
          .from("chats")
          .select("id, type, title, avatar_url, created_at")
          .in("id", chatIds)
          .order("created_at", { ascending: false });
        if (cErr) throw cErr;
        // Load members (without join) and then profiles in batch
        const { data: cmRows, error: cmErr } = await supabase
          .from("chat_members")
          .select("chat_id, user_id")
          .in("chat_id", chatIds);
        if (cmErr) throw cmErr;
        const membersByChat = new Map<string, string[]>();
        const memberIds = new Set<string>();
        ((cmRows as ChatMemberRow[] | null) ?? []).forEach((r) => {
          const arr = membersByChat.get(r.chat_id) ?? [];
          arr.push(r.user_id);
          membersByChat.set(r.chat_id, arr);
          memberIds.add(r.user_id);
        });
        // Fetch member users
        const profilesById = new Map<string, { id: string; username: string; avatar_url: string | null }>();
        if (memberIds.size > 0) {
          const ids = Array.from(memberIds);
          const { data: profRows, error: profErr } = await supabase
            .from("users")
            .select("id, username, avatar_url")
            .in("id", ids);
          if (profErr) throw profErr;
          ((profRows as UserRow[] | null) ?? []).forEach((p) => {
            profilesById.set(p.id, { id: p.id, username: p.username, avatar_url: p.avatar_url });
          });
        }
        const mappedChats: Chat[] = ((chatRows as ChatRow[] | null) ?? []).map((c) => {
          let title = c.title as string | null;
          let avatar: string | null = c.avatar_url;
          const memberIdsForChat = membersByChat.get(c.id) ?? [];
          const members = memberIdsForChat
            .map((uid) => profilesById.get(uid))
            .filter(Boolean) as { id: string; username: string; avatar_url: string | null }[];
          if (c.type === "direct") {
            const other = members.find((m) => m.id !== id);
            if (other) {
              title = other.username;
              avatar = other.avatar_url;
            }
          }
          return {
            id: c.id,
            type: c.type,
            title: title ?? "Direct Chat",
            avatarUrl: avatar ?? null,
            lastMessageAt: c.created_at,
            members: members.map((m) => ({ id: m.id, username: m.username, avatarUrl: m.avatar_url })),
          } as Chat;
        });
        setChats(mappedChats);
        setActiveId(mappedChats[0]?.id ?? null);
        setChecking(false);
        setLoadingChats(false);
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : "Failed to load chats";
        setError(msg);
        setChecking(false);
        setLoadingChats(false);
      }
    };
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  // Live search users by username (debounced) – separate top-level effect
  useEffect(() => {
    const run = async () => {
      const q = createUsername.trim();
      if (!q) { setResults([]); return; }
      setSearching(true);
      try {
        const { data } = await supabase
          .from('users')
          .select('id, username')
          .ilike('username', `%${q}%`)
          .limit(8);
        const shaped = ((data as Array<{ id: string; username: string }> | null) ?? []).map((u) => ({ ...u, avatar_url: null }));
        setResults(shaped.filter((p) => p.id !== me?.id));
      } catch {
        // ignore
      } finally {
        setSearching(false);
      }
    };
    const t = window.setTimeout(run, 300);
    return () => window.clearTimeout(t);
  }, [createUsername, me?.id]);

  const activeChat = useMemo(() => chats.find((c) => c.id === activeId) ?? null, [chats, activeId]);

  // Sync active chat state from URL on load and URL changes
  useEffect(() => {
    if (urlChatId && urlChatId !== activeId) {
      setActiveId(urlChatId);
    }
  }, [urlChatId, activeId]);
  const currentMessages = useMemo(() => (activeId ? messages[activeId] ?? [] : []), [messages, activeId]);

  useEffect(() => {
    const checkBlock = async () => {
      if (!me || !activeChat || activeChat.type !== 'direct') { setIsBlocked(false); return; }
      const other = activeChat?.members?.find((m) => m.id !== me.id);
      if (!other) { setIsBlocked(false); return; }
      const { data } = await supabase
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', me.id)
        .eq('blocked_id', other.id)
        .maybeSingle();
      setIsBlocked(!!data);
    };
    checkBlock();
  }, [me, activeChat]);

  // Load messages when active chat changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeId) return;
      setLoadingMessages(true);
      setError(null);
      try {
        const { data: rows, error: err } = await supabase
          .from("messages")
          .select("id, chat_id, content, created_at, sender_id, reply_to, message_type")
          .eq("chat_id", activeId)
          .order("created_at", { ascending: true });
        if (err) {
          console.warn('messages fetch error', err);
        }
        const senderIds = Array.from(new Set(((rows as MessageRow[] | null) ?? []).map((r) => r.sender_id)));
        const profileMap = new Map<string, { username: string; avatar_url: string | null }>();
        if (senderIds.length > 0) {
          const { data: profs } = await supabase
            .from("users")
            .select("id, username, avatar_url")
            .in("id", senderIds);
          ((profs as UserRow[] | null) ?? []).forEach((p) => profileMap.set(p.id, { username: p.username, avatar_url: p.avatar_url }));
        }
        // Build reply preview map
        const replyIds = Array.from(new Set(((rows as MessageRow[] | null) ?? []).map((r) => r.reply_to).filter((x): x is string => !!x)));
        const replyMap = new Map<string, { id: string; author: string; content: string }>();
        if (replyIds.length > 0) {
          const { data: replyRows } = await supabase
            .from('messages')
            .select('id, content, sender_id')
            .in('id', replyIds);
          ((replyRows as Array<{ id: string; content: string | null; sender_id: string }> | null) ?? []).forEach((rr) => {
            const author = profileMap.get(rr.sender_id)?.username ?? 'user';
            replyMap.set(rr.id, { id: rr.id, author, content: rr.content ?? '' });
          });
        }

        // Fetch reactions for all messages
        const messageIds = ((rows as MessageRow[] | null) ?? []).map((r) => r.id);
        const reactionsMap = new Map<string, Record<string, number>>();
        if (messageIds.length > 0) {
          const { data: reactionRows } = await supabase
            .from('message_reactions')
            .select('message_id, reaction')
            .in('message_id', messageIds);
          ((reactionRows as Array<{ message_id: string; reaction: string }> | null) ?? []).forEach((rx) => {
            const existing = reactionsMap.get(rx.message_id) ?? {};
            existing[rx.reaction] = (existing[rx.reaction] ?? 0) + 1;
            reactionsMap.set(rx.message_id, existing);
          });
        }

        // Fetch read status for messages sent by current user
        const myMessageIds = ((rows as MessageRow[] | null) ?? [])
          .filter((r) => r.sender_id === me?.id)
          .map((r) => r.id);
        const readStatusMap = me?.id
          ? await getMessageReadStatus(myMessageIds, me.id)
          : new Map<string, "delivered" | "read">();

        const mapped: Message[] = ((rows as MessageRow[] | null) ?? []).map((r) => {
          const p = profileMap.get(r.sender_id);
          const type = (() => {
            const t = r.message_type ?? 'text';
            if (t === 'image' && typeof r.content === 'string' && r.content.toLowerCase().includes('.gif')) return 'gif';
            return t;
          })() as Message['type'];
          let content = r.content ?? '';
          if ((type === 'image' || type === 'gif') && typeof content === 'string' && content.startsWith('s3://')) {
            content = edgeImageUrlFromS3(content);
          }
          return {
            id: r.id,
            chatId: r.chat_id,
            content,
            createdAt: r.created_at,
            sender: {
              id: r.sender_id,
              username: p?.username ?? "unknown",
              avatarUrl: p?.avatar_url ?? null,
            },
            replyToId: r.reply_to ?? undefined,
            replyPreview: r.reply_to ? (replyMap.get(r.reply_to) ?? null) : null,
            type,
            reactions: reactionsMap.get(r.id) ?? undefined,
            status: r.sender_id === me?.id ? (readStatusMap.get(r.id) ?? "delivered") : undefined,
          };
        });
        setMessages((prev) => ({ ...prev, [activeId]: mapped }));

        // Mark messages from others as read
        if (me?.id) {
          markMessagesAsRead(activeId, me.id);
        }
      } catch (e) {
        console.error("loadMessages error", e);
        const msg = e instanceof Error ? e.message : "Failed to load messages";
        setError(msg);
      } finally {
        setLoadingMessages(false);
      }
    };
    loadMessages();
  }, [activeId, me?.id]);

  // Realtime subscription for messages in the active chat (INSERT/UPDATE/DELETE)
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`chat-messages-${activeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${activeId}` },
        async (payload) => {
          const r = payload.new as MessageRow;
          const { data: prof } = await supabase
            .from('users')
            .select('id, username, avatar_url')
            .eq('id', r.sender_id)
            .maybeSingle();
          let replyPreview: { id: string; author: string; content: string } | null = null;
          if (r.reply_to) {
            const { data: rr } = await supabase
              .from('messages')
              .select('id, content, sender_id')
              .eq('id', r.reply_to)
              .maybeSingle();
            if (rr) {
              replyPreview = { id: rr.id, author: prof?.username ?? 'user', content: rr.content ?? '' };
            }
          }
          let content = r.content ?? '';
          const type: Message['type'] = (() => {
            const t = (r.message_type ?? 'text') as Message['type'];
            if (t === 'image' && typeof r.content === 'string' && r.content.toLowerCase().includes('.gif')) return 'gif';
            return t;
          })();
          if ((type === 'image' || type === 'gif') && typeof content === 'string' && content.startsWith('s3://')) {
            content = edgeImageUrlFromS3(content);
          }
          const msg: Message = {
            id: r.id,
            chatId: r.chat_id,
            content,
            createdAt: r.created_at,
            sender: { id: r.sender_id, username: prof?.username ?? 'unknown', avatarUrl: prof?.avatar_url ?? null },
            replyToId: r.reply_to ?? undefined,
            replyPreview,
            type,
          };
          setMessages((prev) => {
            const prevArr = prev[activeId] ?? [];
            if (prevArr.some((m) => m.id === msg.id)) return prev; // dedupe
            return { ...prev, [activeId]: [...prevArr, msg] };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${activeId}` },
        async (payload) => {
          const r = payload.new as MessageRow;
          setMessages((prev) => {
            const arr = [...(prev[activeId] ?? [])];
            const idx = arr.findIndex((m) => m.id === r.id);
            if (idx !== -1) {
              arr[idx] = { ...arr[idx], content: r.content ?? arr[idx].content };
            }
            return { ...prev, [activeId]: arr };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${activeId}` },
        async (payload) => {
          const r = payload.old as MessageRow;
          setMessages((prev) => {
            const arr = (prev[activeId] ?? []).filter((m) => m.id !== r.id);
            return { ...prev, [activeId]: arr };
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId]);

  // Realtime subscription for message_reads to update read status (double tick)
  useEffect(() => {
    if (!activeId || !me?.id) return;

    const readsChannel = supabase
      .channel(`chat-reads-${activeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reads' },
        async (payload) => {
          const readRecord = payload.new as { message_id: string; user_id: string };
          // Only update if someone else (not me) read the message
          if (readRecord.user_id === me.id) return;

          // Update the message status to "read" if it's my message
          setMessages((prev) => {
            const arr = [...(prev[activeId] ?? [])];
            const idx = arr.findIndex((m) => m.id === readRecord.message_id);
            if (idx !== -1 && arr[idx].sender.id === me.id) {
              arr[idx] = { ...arr[idx], status: "read" };
            }
            return { ...prev, [activeId]: arr };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(readsChannel);
    };
  }, [activeId, me?.id]);

  // Global realtime: when any message is inserted in my chats, bump chat in list and append if not active
  useEffect(() => {
    if (!chats.length) return;
    const chatIdSet = new Set(chats.map((c) => c.id));
    const channel = supabase
      .channel('chat-list-message-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const r = payload.new as MessageRow;
          if (!chatIdSet.has(r.chat_id)) return;
          // Update chats ordering and lastMessageAt
          setChats((prev) => {
            const idx = prev.findIndex((c) => c.id === r.chat_id);
            if (idx === -1) return prev;
            const updated = { ...prev[idx], lastMessageAt: r.created_at } as Chat;
            const rest = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
            return [updated, ...rest];
          });
          // If active, skip appending here to avoid duplication with the active channel
          if (r.chat_id === activeId) return;
          const { data: prof } = await supabase
            .from('users')
            .select('id, username, avatar_url')
            .eq('id', r.sender_id)
            .maybeSingle();
          let content = r.content ?? '';
          const type: Message['type'] = (() => {
            const t = (r.message_type ?? 'text') as Message['type'];
            if (t === 'image' && typeof r.content === 'string' && r.content.toLowerCase().includes('.gif')) return 'gif';
            return t;
          })();
          if ((type === 'image' || type === 'gif') && typeof content === 'string' && content.startsWith('s3://')) {
            content = edgeImageUrlFromS3(content);
          }
          const msg: Message = {
            id: r.id,
            chatId: r.chat_id,
            content,
            createdAt: r.created_at,
            sender: { id: r.sender_id, username: prof?.username ?? 'unknown', avatarUrl: prof?.avatar_url ?? null },
            replyToId: r.reply_to ?? undefined,
            type,
          };
          setMessages((prev) => {
            const prevArr = prev[r.chat_id] ?? [];
            if (prevArr.some((m) => m.id === msg.id)) return prev; // dedupe
            return { ...prev, [r.chat_id]: [...prevArr, msg] };
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chats, activeId]);

  const onSend = async (text: string) => {
    if (!me || !activeId) return;
    if (isBlocked && activeChat?.type === 'direct') { setError('You have blocked this user'); return; }
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ chat_id: activeId, sender_id: me.id, content: text, message_type: 'text', reply_to: replyTo?.id ?? null })
        .select('id, chat_id, content, created_at, sender_id, reply_to, message_type')
        .single();
      if (error) throw error;
      if (data) {
        const msg: Message = {
          id: (data as MessageRow).id,
          chatId: activeId,
          content: (data as MessageRow).content ?? text,
          createdAt: (data as MessageRow).created_at,
          sender: { id: me.id, username: me.username, avatarUrl: me.avatarUrl },
          replyToId: (data as MessageRow).reply_to ?? undefined,
          replyPreview: replyTo ?? null,
          type: ((data as MessageRow).message_type ?? 'text') as Message['type'],
          status: 'delivered',
        };
        // Optimistically append; realtime will dedupe via id
        setMessages((prev) => {
          const prevArr = prev[activeId] ?? [];
          if (prevArr.some((m) => m.id === msg.id)) return prev;
          return { ...prev, [activeId]: [...prevArr, msg] };
        });
        // Bump chat order locally
        setChats((prev) => {
          const idx = prev.findIndex((c) => c.id === activeId);
          if (idx === -1) return prev;
          const updated = { ...prev[idx], lastMessageAt: (data as MessageRow).created_at } as Chat;
          const rest = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
          return [updated, ...rest];
        });
        setReplyTo(null);
      }
    } catch (e) {
      console.error(e);
      setError('Failed to send message');
    }
  };

  const onSelectImage = async (imageData: string, fileName: string, caption?: string) => {
    if (!me || !activeId) return;
    try {
      // Upload via Supabase Functions client (handles Authorization/apikey)
      const { data: uploadRes, error: upErr } = await supabase.functions.invoke('upload-image', {
        body: { imageData, fileName, userId: me.id },
      });
      if (upErr) throw upErr;
      const s3Url = (uploadRes as { imageUrl?: string } | null)?.imageUrl as string;
      // Resolve an authenticated display URL for the image (uses get-image via invoke; falls back to GET proxy)
      const displayUrl = await getImageDisplayUrl(supabase, s3Url);
      // Insert message with s3 URL and message_type 'image'
      const { data, error } = await supabase
        .from('messages')
        .insert({ chat_id: activeId, sender_id: me.id, content: s3Url, message_type: 'image' })
        .select('id, chat_id, content, created_at, sender_id, message_type')
        .single();
      if (error) throw error;
      // Optimistic render with proxied URL
      const msg: Message = {
        id: (data as MessageRow).id,
        chatId: activeId,
        content: displayUrl,
        createdAt: (data as MessageRow).created_at,
        sender: { id: me.id, username: me.username, avatarUrl: me.avatarUrl },
        type: 'image',
      };
      setMessages((prev) => {
        const prevArr = prev[activeId] ?? [];
        if (prevArr.some((m) => m.id === msg.id)) return prev;
        return { ...prev, [activeId]: [...prevArr, msg] };
      });
      setChats((prev) => {
        const idx = prev.findIndex((c) => c.id === activeId);
        if (idx === -1) return prev;
        const updated = { ...prev[idx], lastMessageAt: (data as MessageRow).created_at } as Chat;
        const rest = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        return [updated, ...rest];
      });
      // If caption is provided, send it as a subsequent text message
      if (caption && caption.trim()) {
        await supabase
          .from('messages')
          .insert({ chat_id: activeId, sender_id: me.id, content: caption.trim(), message_type: 'text' });
      }
    } catch (e) {
      console.error(e);
      setError('Failed to send image');
    }
  };

  const onSendGif = async (url: string) => {
    if (!me || !activeId) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({ chat_id: activeId, sender_id: me.id, content: url, message_type: 'image' })
        .select('id, chat_id, content, created_at, sender_id, message_type')
        .single();
      if (error) throw error;
      if (data) {
        const msg: Message = {
          id: (data as MessageRow).id,
          chatId: activeId,
          content: (data as MessageRow).content ?? '',
          createdAt: (data as MessageRow).created_at,
          sender: { id: me.id, username: me.username, avatarUrl: me.avatarUrl },
          type: 'gif',
        };
        setMessages((prev) => {
          const prevArr = prev[activeId] ?? [];
          if (prevArr.some((m) => m.id === msg.id)) return prev;
          return { ...prev, [activeId]: [...prevArr, msg] };
        });
      }
    } catch (e) {
      console.error(e);
      setError('Failed to send GIF');
    }
  };

  const onReplyMessage = (id: string) => {
    const src = currentMessages.find((m) => m.id === id);
    if (!src) return;
    setReplyTo({ id: src.id, author: src.sender.username, content: src.type === 'gif' ? '[GIF]' : src.content });
  };

  const onReactMessage = async (id: string, emoji: string) => {
    if (!me || !activeId) return;

    // Optimistic update: immediately update the UI
    setMessages((prev) => {
      const chatMessages = prev[activeId] ?? [];
      return {
        ...prev,
        [activeId]: chatMessages.map((m) => {
          if (m.id !== id) return m;
          const reactions = { ...(m.reactions ?? {}) };
          const currentCount = reactions[emoji] ?? 0;
          // Toggle: check if we need to add or remove
          // We'll sync with DB, but for now assume toggle
          if (currentCount > 0) {
            reactions[emoji] = currentCount - 1;
            if (reactions[emoji] <= 0) delete reactions[emoji];
          } else {
            reactions[emoji] = 1;
          }
          return { ...m, reactions: Object.keys(reactions).length > 0 ? reactions : undefined };
        }),
      };
    });

    try {
      // toggle reaction: if exists remove, else add
      const { data: existing } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', id)
        .eq('user_id', me.id)
        .eq('reaction', emoji)
        .maybeSingle();
      if (existing) {
        await supabase.from('message_reactions').delete().eq('id', existing.id);
      } else {
        await supabase.from('message_reactions').insert({ message_id: id, user_id: me.id, reaction: emoji });
      }

      // Refetch reactions to sync with actual DB state
      const { data: reactionRows } = await supabase
        .from('message_reactions')
        .select('message_id, reaction')
        .eq('message_id', id);
      const reactionCounts: Record<string, number> = {};
      ((reactionRows as Array<{ message_id: string; reaction: string }> | null) ?? []).forEach((rx) => {
        reactionCounts[rx.reaction] = (reactionCounts[rx.reaction] ?? 0) + 1;
      });

      // Update with actual data
      setMessages((prev) => {
        const chatMessages = prev[activeId] ?? [];
        return {
          ...prev,
          [activeId]: chatMessages.map((m) =>
            m.id === id ? { ...m, reactions: Object.keys(reactionCounts).length > 0 ? reactionCounts : undefined } : m
          ),
        };
      });
    } catch (e) {
      console.error(e);
    }
  };

  // removed unused onNewChat

  const onDeleteMessage = async (id: string) => {
    try {
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) throw error;
      if (activeId) {
        setMessages((prev) => ({ ...prev, [activeId]: (prev[activeId] ?? []).filter((m) => m.id !== id) }));
      }
    } catch (e) {
      console.error(e);
      setError('Failed to delete message');
    }
  };

  const onClearChat = async () => {
    if (!activeId) return;
    try {
      const { error } = await supabase.from('messages').delete().eq('chat_id', activeId);
      if (error) throw error;
      setMessages((prev) => ({ ...prev, [activeId]: [] }));
    } catch (e) {
      console.error(e);
      setError('Failed to clear chat');
    }
  };

  const onToggleBlock = async () => {
    if (!me || !activeChat || activeChat.type !== 'direct') return;
    const other = activeChat?.members?.find((m) => m.id !== me.id);
    if (!other) return;
    try {
      if (!isBlocked) {
        const { error } = await supabase.from('blocked_users').insert({ blocker_id: me.id, blocked_id: other.id });
        if (error) throw error;
        setIsBlocked(true);
      } else {
        const { error } = await supabase
          .from('blocked_users')
          .delete()
          .eq('blocker_id', me.id)
          .eq('blocked_id', other.id);
        if (error) throw error;
        setIsBlocked(false);
      }
    } catch (e) {
      console.error(e);
      setError('Failed to update block');
    }
  };

  const createDirectChat = async () => {
    if (!me) return;
    const uname = createUsername.trim();
    if (!uname) return;
    setCreating(true);
    setError(null);
    try {
      // find user by username
      const { data: other } = await supabase
        .from('users')
        .select('id, username')
        .ilike('username', `%${uname}%`)
        .limit(1)
        .maybeSingle();
      if (!other) throw new Error('User not found');
      if (other.id === me.id) throw new Error('Cannot chat with yourself');

      // create chat
      const { data: chatRow, error: cErr } = await supabase
        .from('chats')
        .insert({ type: 'direct' })
        .select('id, type, title, avatar_url, created_at')
        .single();
      if (cErr) throw cErr;
      const chatId = (chatRow as { id: string }).id as string;
      try {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .in('id', [me.id, other.id]);
        const have = new Set((existing as Array<{ id: string }> | null ?? []).map((p) => p.id));
        const toUpsert: Array<{ id: string; username: string; avatar_url: string | null }> = [];
        if (!have.has(me.id)) toUpsert.push({ id: me.id, username: me.username, avatar_url: me.avatarUrl ?? null });
        if (!have.has(other.id)) toUpsert.push({ id: other.id, username: other.username, avatar_url: null });
        if (toUpsert.length) {
          await supabase.from('profiles').upsert(toUpsert, { onConflict: 'id' });
        }
      } catch { }
      const { error: mErr } = await supabase
        .from('chat_members')
        .insert([
          { chat_id: chatId, user_id: me.id },
          { chat_id: chatId, user_id: other.id },
        ]);
      if (mErr) throw mErr;

      // reload chats
      setShowNewChat(false);
      setCreateUsername("");
      // Prepend new chat locally for responsiveness
      const mapped: Chat = {
        id: chatId,
        type: 'direct',
        title: other.username,
        avatarUrl: null,
        lastMessageAt: new Date().toISOString(),
        members: [
          { id: me.id, username: me.username, avatarUrl: me.avatarUrl },
          { id: other.id, username: other.username, avatarUrl: null },
        ],
      };
      setChats((prev) => [mapped, ...prev]);
      setActiveId(chatId);
      setShowSidebar(false);
    } catch (e: unknown) {
      console.error('createDirectChat error', e);
      const msg = (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string')
        ? (e as { message: string }).message
        : 'Failed to create chat';
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  if (checking || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-300">
        Loading chat…
      </div>
    );
  }

  return (
    <div
      className="grid min-h-screen grid-cols-1 bg-black text-zinc-100 md:grid-cols-[360px_1fr]"
      {...swipeHandlers}
    >
      {/* Sidebar (hidden on mobile when a chat is active) */}
      <div className={`${showSidebar ? "block" : "hidden"} md:block`}>
        <Sidebar
          me={me}
          chats={chats}
          activeId={activeId}
          onSelect={(id) => {
            setActiveId(id);
            setShowSidebar(false);
            const params = new URLSearchParams(searchParams?.toString());
            params.set('id', id);
            router.replace(`/chat?${params.toString()}`);
          }}
          onNewChat={() => setShowNewChooser(true)}
        />
      </div>

      {/* Chat area (hidden on mobile when the sidebar is visible) */}
      <div className={`${showSidebar ? "hidden" : "flex"} h-screen flex-col md:flex`}>
        <ChatHeader
          chat={activeChat ? (() => {
            const c = activeChat as Chat;
            if (c.type !== 'direct') return c;
            const other = c.members?.find((m) => m.id !== me?.id);
            if (!other) return c;
            return { ...c, title: other.username || c.title, avatarUrl: other.avatarUrl ?? c.avatarUrl } as Chat;
          })() : activeChat}
          onBack={() => setShowSidebar(true)}
          onClear={onClearChat}
          onToggleBlock={onToggleBlock}
          blockLabel={isBlocked ? 'Unblock user' : 'Block user'}
          onOpenProfile={() => {
            const chat = activeChat;
            if (!chat) return;
            if (chat.type === 'direct') {
              const other = chat.members?.find((m) => m.id !== me?.id);
              if (other?.id) router.push(`/u/${other.id}`);
            }
          }}
          onStartAudioCall={async () => {
            if (!activeId || !me) return;
            if (activeChat && activeChat.type === 'group') {
              setRingMode('audio');
              setShowRingSubset(true);
              return;
            }
            setCallIsVideo(false);
            setIncomingFrom(null);
            setCallOpen(true);
            let callId: string | null = null;
            try { callId = await startCall(activeId, me.id, 'audio'); } catch { }
            setActiveCallId(callId);
            await sendSignal(activeId, { type: 'ring', from: me.id, isVideo: false, chatId: activeId, callId: callId ?? undefined });
            const other = (activeChat && activeChat.type === 'direct') ? activeChat.members?.find(m => m.id !== me.id) : null;
            if (other?.id) await sendUserSignal(other.id, { type: 'ring', from: me.id, isVideo: false, chatId: activeId, callId: callId ?? undefined });
          }}
          onStartVideoCall={async () => {
            if (!activeId || !me) return;
            if (activeChat && activeChat.type === 'group') {
              setRingMode('video');
              setShowRingSubset(true);
              return;
            }
            setCallIsVideo(true);
            setIncomingFrom(null);
            setCallOpen(true);
            let callId: string | null = null;
            try { callId = await startCall(activeId, me.id, 'video'); } catch { }
            setActiveCallId(callId);
            await sendSignal(activeId, { type: 'ring', from: me.id, isVideo: true, chatId: activeId, callId: callId ?? undefined });
            const other = (activeChat && activeChat.type === 'direct') ? activeChat.members?.find(m => m.id !== me.id) : null;
            if (other?.id) await sendUserSignal(other.id, { type: 'ring', from: me.id, isVideo: true, chatId: activeId, callId: callId ?? undefined });
          }}
          onShowMembers={() => setShowMembersModal(true)}
          onShowGroupInfo={() => setShowMembersModal(true)}
        />
        <motion.div
          key={activeId ?? "no-chat"}
          className="flex min-h-0 flex-1 flex-col"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
        >
          {error && (
            <div className="border-b border-zinc-800 bg-red-900/20 p-2 text-sm text-red-400">{error}</div>
          )}
          {activeId ? (
            <>
              <MessageList
                me={me}
                messages={currentMessages}
                chatType={activeChat?.type}
                onDelete={onDeleteMessage}
                onReply={onReplyMessage}
                onReact={onReactMessage}
              />
              <div className="relative">
                <Composer
                  onSend={onSend}
                  disabled={!activeId || (isBlocked && activeChat?.type === 'direct')}
                  replyTo={replyTo}
                  onCancelReply={() => setReplyTo(null)}
                  onSendGif={onSendGif}
                  onSelectImage={onSelectImage}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="text-sm text-zinc-400">No chat selected</div>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setShowNewChooser(true)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    New…
                  </button>
                  <button
                    onClick={() => setShowGroupModal(true)}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                  >
                    New group
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {callOpen && me && activeChat && (
        <CallModal
          open={callOpen}
          onClose={() => { setCallOpen(false); setActiveCallId(null); }}
          chatId={activeId!}
          me={me}
          peer={(activeChat.type === 'direct' ? activeChat.members?.find(m => m.id !== me.id) : null) as User | null}
          isVideo={callIsVideo}
          incomingFromUserId={incomingFrom ?? undefined}
          callId={activeCallId ?? undefined}
          isGroup={activeChat.type === 'group'}
          chatTitle={activeChat.title}
        />
      )}

      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <div className="text-lg font-semibold text-zinc-100">Start a chat</div>
                  <div className="text-xs text-zinc-500">Find someone to message</div>
                </div>
              </div>
              <button onClick={() => setShowNewChat(false)} className="rounded-full p-2 text-zinc-400 hover:bg-neutral-800 hover:text-zinc-200 transition-colors" title="Close">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Search Input */}
              <div className="relative">
                <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  placeholder="Search by username"
                  className="h-11 w-full rounded-xl border border-neutral-800 bg-neutral-900 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-neutral-700 transition-all"
                />
              </div>

              {/* Results List */}
              <div className="max-h-64 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900/50">
                {searching && <div className="p-4 text-center text-sm text-zinc-500">Searching…</div>}
                {!searching && results.length === 0 && createUsername.trim() && (
                  <div className="p-4 text-center text-sm text-zinc-500">No users found</div>
                )}
                {!searching && results.length === 0 && !createUsername.trim() && (
                  <div className="p-4 text-center text-sm text-zinc-600">Type to search for users</div>
                )}
                <ul className="divide-y divide-neutral-800">
                  {results.map((u) => (
                    <li key={u.id} className="flex items-center justify-between p-3 hover:bg-neutral-800/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 overflow-hidden rounded-full ring-1 ring-neutral-700">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u.avatar_url ?? '/avatar-placeholder.png'} alt={u.username} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-zinc-100">{u.username}</div>
                          <div className="text-xs text-zinc-500">Click to start chatting</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => { setCreateUsername(u.username); await createDirectChat(); }}
                          className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-white transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Chat
                        </button>
                        <a href={`/u/${u.id}`} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-neutral-800 transition-colors">
                          Profile
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-neutral-800 px-5 py-4 bg-neutral-900/30">
              <div className="text-xs text-zinc-500">
                <a href="/friends" className="hover:text-zinc-300 transition-colors">Manage friend requests →</a>
              </div>
              <button
                onClick={() => setShowNewChat(false)}
                className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewChooser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
            <div className="text-center">
              <div className="text-xl font-semibold text-zinc-100">Start a conversation</div>
              <p className="mt-1 text-sm text-zinc-500">Choose how you want to connect</p>
            </div>

            <div className="mt-6 space-y-3">
              <button
                onClick={() => { setShowNewChooser(false); setShowNewChat(true); }}
                className="group flex w-full items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-left transition-all hover:border-neutral-700 hover:bg-neutral-900"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-zinc-300 transition-colors group-hover:bg-neutral-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-zinc-100">Direct message</div>
                  <div className="text-xs text-zinc-500">Start a private conversation</div>
                </div>
              </button>

              <button
                onClick={() => { setShowNewChooser(false); setShowGroupModal(true); }}
                className="group flex w-full items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-left transition-all hover:border-neutral-700 hover:bg-neutral-900"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-zinc-300 transition-colors group-hover:bg-neutral-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-zinc-100">Create group</div>
                  <div className="text-xs text-zinc-500">Chat with multiple people</div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowNewChooser(false)}
              className="mt-6 w-full rounded-xl border border-neutral-800 py-2.5 text-sm font-medium text-zinc-400 transition-all hover:bg-neutral-900 hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showGroupModal && me && (
        <GroupCreateModal
          me={me}
          onClose={() => setShowGroupModal(false)}
          onCreated={(newChat) => {
            setChats((prev) => [newChat, ...prev]);
            setActiveId(newChat.id);
            setShowSidebar(false);
          }}
        />
      )}

      {showRingSubset && activeChat && me && (
        <RingSubsetModal
          members={(activeChat.members ?? []).filter(m => m.id !== me.id)}
          onCancel={() => setShowRingSubset(false)}
          onConfirm={async (selectedIds) => {
            setShowRingSubset(false);
            if (!activeId) return;
            const isVideo = ringMode === 'video';
            setCallIsVideo(isVideo);
            setIncomingFrom(null);
            setCallOpen(true);
            let callId: string | null = null;
            try { callId = await startCall(activeId, me.id, isVideo ? 'video' : 'audio'); } catch { }
            setActiveCallId(callId);
            // Broadcast on chat channel (so late joiners can see ringing if needed)
            await sendSignal(activeId, { type: 'ring', from: me.id, isVideo, chatId: activeId, callId: callId ?? undefined });
            // Ring only selected members on per-user channel
            for (const uid of selectedIds) {
              await sendUserSignal(uid, { type: 'ring', from: me.id, isVideo, chatId: activeId, callId: callId ?? undefined });
            }
          }}
        />
      )}

      {showMembersModal && me && activeId && (
        <GroupMembersModal
          chatId={activeId}
          currentUserId={me.id}
          onClose={() => setShowMembersModal(false)}
        />
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-zinc-300">
          Loading chat…
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  );
}
