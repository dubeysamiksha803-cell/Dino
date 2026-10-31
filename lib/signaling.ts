import { supabase } from '@/lib/supabaseClient';

export type SignalEvent =
  | { type: 'ring'; from: string; isVideo: boolean; chatId?: string; callId?: string }
  | { type: 'offer'; from: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; from: string; candidate: RTCIceCandidateInit }
  | { type: 'accept'; from: string }
  | { type: 'reject'; from: string }
  | { type: 'busy'; from: string }
  | { type: 'hangup'; from: string }
  | { type: 'timeout'; from: string };

export function channelName(chatId: string) {
  return `webrtc:chat_${chatId}`;
}

export function getCallChannel(chatId: string) {
  return supabase.channel(channelName(chatId), { config: { broadcast: { self: false } } });
}

export async function sendSignal(chatId: string, payload: SignalEvent) {
  const ch = getCallChannel(chatId);
  const state = (ch as unknown as { state?: string }).state;
  if (state !== 'joined') await ch.subscribe();
  await ch.send({ type: 'broadcast', event: 'signal', payload });
}

// Per-user signaling as a fallback when the peer isn't viewing the same chat
export function userChannelName(userId: string) {
  return `webrtc:user_${userId}`;
}

export function getUserCallChannel(userId: string) {
  return supabase.channel(userChannelName(userId), { config: { broadcast: { self: false } } });
}

export async function sendUserSignal(userId: string, payload: SignalEvent & { chatId: string }) {
  const ch = getUserCallChannel(userId);
  const state = (ch as unknown as { state?: string }).state;
  if (state !== 'joined') await ch.subscribe();
  await ch.send({ type: 'broadcast', event: 'signal', payload });
}
