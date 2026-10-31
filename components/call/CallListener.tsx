"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import CallModal from "@/components/call/CallModal";
import type { User } from "@/components/chat/types";
import { getUserCallChannel, type SignalEvent } from "@/lib/signaling";

export default function CallListener() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [isVideo, setIsVideo] = useState(false);
  const [incomingFrom, setIncomingFrom] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const userChannelRef = useRef<ReturnType<typeof getUserCallChannel> | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!mounted) return;
      if (!session) return;
      const id = session.user.id;
      const email = session.user.email ?? "";
      const username = (session.user.user_metadata?.username as string) || email.split("@")[0];
      setMe({ id, username, avatarUrl: null, isOnline: true });
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!me?.id) return;
    const uch = getUserCallChannel(me.id);
    userChannelRef.current = uch;
    uch.on('broadcast', { event: 'signal' }, ({ payload }: { payload: SignalEvent & { chatId?: string } }) => {
      const p = payload;
      if (!p) return;
      if (p.type === 'ring') {
        const ring = p as Extract<SignalEvent, { type: 'ring' }> & { chatId?: string };
        setIsVideo(ring.isVideo);
        setIncomingFrom(ring.from);
        if (ring.chatId) setChatId(ring.chatId);
        if (ring.callId) setCallId(ring.callId);
        // Navigate to chat to ensure chat context is available
        if (pathname !== '/chat') router.push('/chat');
        setOpen(true);
      }
    });
    uch.subscribe();
    return () => { try { uch.unsubscribe(); } catch {} if (userChannelRef.current === uch) userChannelRef.current = null; };
  }, [me?.id, pathname, router]);

  if (!open || !me || !chatId) return null;

  return (
    <CallModal
      open={open}
      onClose={() => setOpen(false)}
      chatId={chatId}
      me={me}
      peer={null}
      isVideo={isVideo}
      incomingFromUserId={incomingFrom ?? undefined}
      callId={callId ?? undefined}
    />
  );
}
