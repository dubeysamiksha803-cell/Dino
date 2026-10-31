"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@/components/chat/types";
import { X, Phone, Video, PhoneOff, Mic, MicOff, VideoOff as VideoOffIcon, Maximize2, Minimize2 } from "lucide-react";
import { getCallChannel, sendSignal, type SignalEvent } from "@/lib/signaling";
import { createPeerConnection, getLocalMedia, createOffer, createAnswer, resolveIceServers } from "@/lib/webrtc";
import { addParticipant, endCall, markOngoing, leaveParticipant } from "@/lib/calls";

export default function CallModal({
  open,
  onClose,
  chatId,
  me,
  peer,
  isVideo,
  incomingFromUserId,
  callId,
  isGroup,
  chatTitle,
}: {
  open: boolean;
  onClose: () => void;
  chatId: string;
  me: User;
  peer: User | null;
  isVideo: boolean;
  incomingFromUserId?: string;
  callId?: string;
  isGroup?: boolean;
  chatTitle?: string;
}) {
  const [ringing, setRinging] = useState<boolean>(!!incomingFromUserId);
  const [timer, setTimer] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const role: 'caller' | 'callee' = incomingFromUserId ? 'callee' : 'caller';

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<ReturnType<typeof getCallChannel> | null>(null);
  const [audioNeedsResume, setAudioNeedsResume] = useState(false);
  const [iceServers, setIceServers] = useState<RTCIceServer[] | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(isVideo);
  const [connected, setConnected] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const callTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const ringtoneCtxRef = useRef<AudioContext | null>(null);
  const ringtoneOscRef = useRef<OscillatorNode | null>(null);

  useEffect(() => {
    if (!open) return;
    // simple timer (seconds)
    intervalRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (ringing) {
      try { navigator.vibrate?.(200); } catch {}
      try {
        // Prefer standard AudioContext, fallback to webkitAudioContext without using 'any'
        if (!ringtoneCtxRef.current) {
          const winWithWebkit = window as unknown as { webkitAudioContext?: typeof AudioContext };
          const Ctor = window.AudioContext || winWithWebkit.webkitAudioContext;
          if (Ctor) ringtoneCtxRef.current = new Ctor();
        }
        const ctx = ringtoneCtxRef.current;
        if (ctx && ctx.state !== 'suspended') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.02;
          osc.type = 'sine';
          osc.frequency.value = 880;
          osc.connect(gain).connect(ctx.destination);
          osc.start();
          ringtoneOscRef.current = osc;
        }
      } catch {}
    } else {
      try {
        ringtoneOscRef.current?.stop();
        ringtoneOscRef.current?.disconnect();
        ringtoneOscRef.current = null;
        // keep ctx to avoid user gesture issues; will be closed in cleanup
      } catch {}
    }
  }, [open, ringing]);

  const cleanup = useCallback(() => {
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;
    // Stop and release local media
    localStreamRef.current?.getTracks().forEach(t=>t.stop());
    localStreamRef.current = null;
    // Stop and release screen share
    screenStreamRef.current?.getTracks().forEach(t=>t.stop());
    screenStreamRef.current = null;
    // Detach media from elements to fully release camera/mic indicators
    const lv = localVideoRef.current; if (lv) { try { (lv as HTMLVideoElement & { srcObject: MediaStream | null }).srcObject = null; } catch {} }
    const rv = remoteVideoRef.current; if (rv) { try { (rv as HTMLVideoElement & { srcObject: MediaStream | null }).srcObject = null; } catch {} }
    const ra = remoteAudioRef.current; if (ra) { try { (ra as HTMLAudioElement & { srcObject: MediaStream | null }).srcObject = null; } catch {} }
    remoteStreamRef.current = null;
    if (callTickRef.current) { clearInterval(callTickRef.current); callTickRef.current = null; }
    setCallSeconds(0);
    setConnected(false);
    setSharing(false);
    try {
      ringtoneOscRef.current?.stop();
      ringtoneOscRef.current?.disconnect();
      ringtoneOscRef.current = null;
      ringtoneCtxRef.current?.close();
      ringtoneCtxRef.current = null;
    } catch {}
  }, []);

  const handleReject = useCallback(async () => {
    await sendSignal(chatId, { type: 'reject', from: me.id });
    try {
      if (callId) {
        if (isGroup) {
          await leaveParticipant(callId, me.id);
        } else {
          await endCall(callId);
        }
      }
    } catch {}
    cleanup();
    onClose();
  }, [chatId, me.id, callId, isGroup, onClose, cleanup]);

  useEffect(() => {
    // auto-decline after 30s when ringing
    if (!ringing) return;
    const t = setTimeout(() => { void handleReject(); }, 30000);
    return () => clearTimeout(t);
  }, [ringing, handleReject]);

  const title = useMemo(() => {
    const name = isGroup ? (chatTitle ?? "Group") : (peer?.username ?? "Unknown");
    if (incomingFromUserId) return `${name} is calling…`;
    return `Calling ${name}…`;
  }, [isGroup, chatTitle, peer?.username, incomingFromUserId]);

  const attachRemote = useCallback((stream: MediaStream) => {
    remoteStreamRef.current = stream;
    if (isVideo) {
      const v = remoteVideoRef.current;
      if (v) { v.srcObject = stream; v.play().catch(()=>{}); }
    }
    const a = remoteAudioRef.current;
    if (a) {
      a.srcObject = stream;
      a.play().catch(()=>{ setAudioNeedsResume(true); });
    }
  }, [isVideo]);

  const ensureLocalMedia = useCallback(async () => {
    if (!localStreamRef.current) {
      const { stream } = await getLocalMedia(true, isVideo);
      localStreamRef.current = stream;
      const v = localVideoRef.current;
      if (isVideo && v) { v.srcObject = stream; v.muted = true; v.play().catch(()=>{}); }
      // Respect current mic/cam state
      stream.getAudioTracks().forEach(t => t.enabled = micOn);
      stream.getVideoTracks().forEach(t => t.enabled = camOn);
    }
    return localStreamRef.current!;
  }, [isVideo, micOn, camOn]);

  const getOrCreatePc = useCallback(async () => {
    if (pcRef.current) return pcRef.current;
    // Prefer external ICE endpoint if configured (e.g., your FastAPI /ice)
    let pc: RTCPeerConnection;
    try {
      const servers = iceServers ?? await resolveIceServers();
      if (!iceServers) setIceServers(servers);
      pc = createPeerConnection({ iceServers: servers });
    } catch {
      pc = createPeerConnection();
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(chatId, { type: 'ice', from: me.id, candidate: e.candidate.toJSON() });
      }
    };
    pc.ontrack = (ev) => {
      if (ev.streams && ev.streams[0]) {
        attachRemote(ev.streams[0]);
      } else {
        // Some browsers fire track without streams
        let rs = remoteStreamRef.current;
        if (!rs) {
          rs = new MediaStream();
          remoteStreamRef.current = rs;
          attachRemote(rs);
        }
        rs.addTrack(ev.track);
      }
    };
    pc.onconnectionstatechange = async () => {
      const st = pc.connectionState;
      if (st === 'connected') {
        setConnected(true);
        if (!callTickRef.current) callTickRef.current = setInterval(()=> setCallSeconds(s=>s+1), 1000);
        try {
          if (callId) {
            await markOngoing(callId);
            await addParticipant(callId, me.id);
          }
        } catch {}
      }
      if (st === 'disconnected' || st === 'failed' || st === 'closed') {
        if (callTickRef.current) { clearInterval(callTickRef.current); callTickRef.current = null; }
      }
    };
    try {
      // Pre-create transceivers to ensure proper m-lines and recv
      pc.addTransceiver('audio', { direction: 'sendrecv' });
      if (isVideo) pc.addTransceiver('video', { direction: 'sendrecv' });
    } catch {}
    pcRef.current = pc;
    return pc;
  }, [iceServers, isVideo, chatId, me.id, callId, attachRemote]);

  const startCallerOffer = useCallback(async () => {
    const pc = await getOrCreatePc();
    const ls = await ensureLocalMedia();
    // Set according to current toggles
    ls.getAudioTracks().forEach(t => t.enabled = micOn);
    ls.getVideoTracks().forEach(t => t.enabled = camOn);
    ls.getTracks().forEach(t => pc.addTrack(t, ls));
    const offer = await createOffer(pc);
    await sendSignal(chatId, { type: 'offer', from: me.id, sdp: offer });
  }, [getOrCreatePc, ensureLocalMedia, micOn, camOn, chatId, me.id]);



  async function handleAccept() {
    setRinging(false);
    await sendSignal(chatId, { type: 'accept', from: me.id });
    // Prompt mic/cam immediately to ensure permissions and live tracks
    try { await ensureLocalMedia(); } catch {}
    // Caller will send offer; callee waits for offer event
  }
  const handleHangup = useCallback(async () => {
    await sendSignal(chatId, { type: 'hangup', from: me.id });
    try {
      if (callId) {
        if (isGroup) {
          await leaveParticipant(callId, me.id);
        } else {
          await endCall(callId);
        }
      }
    } catch {}
    cleanup();
    onClose();
  }, [chatId, me.id, callId, isGroup, onClose, cleanup]);

  useEffect(() => {
    if (!open) return;
    // If I'm the caller, request mic/camera immediately so the browser prompts on call start
    if (role === 'caller') {
      ensureLocalMedia().catch(() => {/* ignore, user may deny */});
    }
    // Prefetch ICE servers as soon as the modal opens, so your backend API is called on initiation
    resolveIceServers().then((servers)=> setIceServers(servers)).catch(()=>{});
    const ch = getCallChannel(chatId);
    channelRef.current = ch;
    ch.on('broadcast', { event: 'signal' }, async ({ payload }: { payload: SignalEvent }) => {
      const p = payload;
      if (!p || !me) return;
      if (p.from === me.id) return; // ignore self
      switch (p.type) {
        case 'accept':
          if (role === 'caller') {
            setRinging(false);
            await startCallerOffer();
          }
          break;
        case 'offer':
          if (role === 'callee') {
            const pc = await getOrCreatePc();
            const ls = await ensureLocalMedia();
            // Apply toggles
            ls.getAudioTracks().forEach(t => t.enabled = micOn);
            ls.getVideoTracks().forEach(t => t.enabled = camOn);
            ls.getTracks().forEach(t => pc.addTrack(t, ls));
            await pc.setRemoteDescription(p.sdp);
            const answer = await createAnswer(pc);
            await sendSignal(chatId, { type: 'answer', from: me.id, sdp: answer });
            setRinging(false);
          }
          break;
        case 'answer':
          if (role === 'caller' && pcRef.current) {
            await pcRef.current.setRemoteDescription(p.sdp);
          }
          break;
        case 'ice':
          if (pcRef.current && p.candidate) {
            try { await pcRef.current.addIceCandidate(new RTCIceCandidate(p.candidate)); } catch {}
          }
          break;
        case 'hangup':
          // In group calls, a participant hangup should not end my call
          if (!isGroup) { cleanup(); onClose(); }
          break;
        case 'reject':
        case 'busy':
        case 'timeout':
          cleanup();
          onClose();
          break;
      }
    });
    ch.subscribe();
    return () => { try { ch.unsubscribe(); } catch {} };
  }, [open, chatId, me?.id, me, role, cleanup, ensureLocalMedia, getOrCreatePc, isGroup, micOn, camOn, onClose, startCallerOffer]);

  const stopScreenShare = useCallback(async () => {
    try {
      const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null;
      const sender = pcRef.current?.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender && cameraTrack) {
        await sender.replaceTrack(cameraTrack);
        const lv = localVideoRef.current; if (lv && localStreamRef.current) { lv.srcObject = localStreamRef.current; lv.muted = true; lv.play().catch(()=>{}); }
      }
    } catch {}
    screenStreamRef.current?.getTracks().forEach(t=>t.stop());
    screenStreamRef.current = null;
    setSharing(false);
  }, []);

  const startScreenShare = useCallback(async () => {
    if (!isVideo) return; // only in video calls
    try {
      const md = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: (opts: DisplayMediaStreamOptions) => Promise<MediaStream> };
      const getDisplay = md.getDisplayMedia;
      if (!getDisplay) return;
      const display = await getDisplay({ video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false });
      screenStreamRef.current = display;
      const screenTrack = screenStreamRef.current.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender && screenTrack) {
        await sender.replaceTrack(screenTrack);
        const lv = localVideoRef.current; if (lv) { lv.srcObject = screenStreamRef.current; lv.muted = true; lv.play().catch(()=>{}); }
        setSharing(true);
        screenTrack.onended = () => { void stopScreenShare(); };
      }
    } catch {}
  }, [isVideo, stopScreenShare]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div ref={containerRef} className={`w-full ${isFullscreen ? 'max-w-none h-full' : 'max-w-4xl'} overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl ${isFullscreen ? 'flex flex-col' : ''}`}>
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium">{isVideo ? "Video Call" : "Voice Call"}</div>
            <div className={`text-[11px] font-medium ${iceServers && iceServers.some(s=>Array.isArray(s.urls)? s.urls.some(u=>!u.startsWith('stun:')) : typeof s.urls==='string' ? !s.urls.startsWith('stun:') : false) ? 'text-emerald-400' : 'text-amber-400'}`}>
              {iceServers && iceServers.some(s=>Array.isArray(s.urls)? s.urls.some(u=>!u.startsWith('stun:')) : typeof s.urls==='string' ? !s.urls.startsWith('stun:') : false) ? 'TURN On' : 'TURN Off'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isVideo && !ringing && (
              sharing ? (
                <button onClick={() => { void stopScreenShare(); }} className="rounded-md px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800" title="Stop sharing">Stop</button>
              ) : (
                <button onClick={() => { void startScreenShare(); }} className="rounded-md px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800" title="Share screen">Share</button>
              )
            )}
            <button onClick={handleHangup} className="rounded-lg p-1 hover:bg-zinc-800" title="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className={`flex ${isVideo ? 'flex-col' : 'flex-col'} ${isFullscreen ? 'flex-1' : ''}`}>
          <div className="px-5 pt-5">
            <div className="text-lg font-semibold">{title}</div>
            <div className="mt-1 text-sm text-zinc-400">{ringing ? `Ringing • ${timer}s` : connected ? `In call • ${Math.floor(callSeconds/60).toString().padStart(2,'0')}:${(callSeconds%60).toString().padStart(2,'0')}` : `Connecting • ${timer}s`}</div>
          </div>
          {isVideo && (
            <div className={`relative mt-4 ${isFullscreen ? 'flex-1' : ''}`}>
              <video ref={remoteVideoRef} className={`aspect-video w-full bg-black ${isFullscreen ? 'h-full object-contain' : 'rounded-none md:rounded-lg'}`} playsInline />
              <video ref={localVideoRef} className="pointer-events-none absolute bottom-3 right-3 h-24 w-40 rounded-md border border-zinc-700 bg-black/60 object-cover shadow-lg md:bottom-4 md:right-4 md:h-28 md:w-48" muted playsInline />
            </div>
          )}
          <audio ref={remoteAudioRef} autoPlay />
          {audioNeedsResume && (
            <div className="mt-3 text-center">
              <button
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                onClick={() => { const a = remoteAudioRef.current; if (!a) return; a.play().then(()=>setAudioNeedsResume(false)).catch(()=>{}); }}
              >Enable audio</button>
            </div>
          )}
          {!ringing && (
            <div className="mt-4 flex items-center justify-center gap-3 px-5 pb-5">
              <button
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${micOn ? 'bg-zinc-800 text-zinc-100' : 'bg-red-600 text-white'} hover:opacity-90`}
                title={micOn ? 'Mute' : 'Unmute'}
                onClick={() => { setMicOn((v)=>{ const next = !v; const ls = localStreamRef.current; if (ls) ls.getAudioTracks().forEach(t=> t.enabled = next); return next; }); }}
              >{micOn ? <Mic className="h-5 w-5"/> : <MicOff className="h-5 w-5"/>}</button>
              {isVideo && (
                <button
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${camOn ? 'bg-zinc-800 text-zinc-100' : 'bg-yellow-600 text-white'} hover:opacity-90`}
                  title={camOn ? 'Turn camera off' : 'Turn camera on'}
                  onClick={() => { setCamOn((v)=>{ const next = !v; const ls = localStreamRef.current; if (ls) ls.getVideoTracks().forEach(t=> t.enabled = next); return next; }); }}
                >{camOn ? <Video className="h-5 w-5"/> : <VideoOffIcon className="h-5 w-5"/>}</button>
              )}
              {isVideo && (
                sharing ? (
                  <button
                    className="inline-flex items-center justify-center rounded-full bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
                    title="Stop sharing"
                    onClick={() => { void stopScreenShare(); }}
                  >Stop sharing</button>
                ) : (
                  <button
                    className="inline-flex items-center justify-center rounded-full bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700"
                    title="Share screen"
                    onClick={() => { void startScreenShare(); }}
                  >Share screen</button>
                )
              )}
              {isVideo && (
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-100 hover:opacity-90"
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  onClick={async () => { try { if (!document.fullscreenElement) { await containerRef.current?.requestFullscreen(); setIsFullscreen(true); } else { await document.exitFullscreen(); setIsFullscreen(false); } } catch {} }}
                >{isFullscreen ? <Minimize2 className="h-5 w-5"/> : <Maximize2 className="h-5 w-5"/>}</button>
              )}
            </div>
          )}
          <div className="flex items-center justify-center gap-4 px-5 pb-6">
            {ringing ? (
              <>
                <button onClick={handleReject} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500">
                  <PhoneOff className="h-4 w-4" /> Reject
                </button>
                <button onClick={handleAccept} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
                  {isVideo ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />} Accept
                </button>
              </>
            ) : (
              <button onClick={handleHangup} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500">
                <PhoneOff className="h-4 w-4" /> End
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
