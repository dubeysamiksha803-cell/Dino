import { supabase } from '@/lib/supabaseClient';

export type CallStatus = 'ringing' | 'ongoing' | 'ended' | 'missed';

export async function startCall(chatId: string, initiatedBy: string, callType: 'audio'|'video') {
  const { data, error } = await supabase
    .from('calls')
    .insert({ chat_id: chatId, initiated_by: initiatedBy, call_type: callType, status: 'ringing' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function addParticipant(callId: string, userId: string) {
  const { error } = await supabase
    .from('call_participants')
    .insert({ call_id: callId, user_id: userId, joined_at: new Date().toISOString() });
  if (error) throw error;
}

export async function markOngoing(callId: string) {
  const { error } = await supabase
    .from('calls')
    .update({ status: 'ongoing', started_at: new Date().toISOString() })
    .eq('id', callId);
  if (error) throw error;
}

export async function endCall(callId: string) {
  const { error } = await supabase
    .from('calls')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', callId);
  if (error) throw error;
}

export async function markMissed(callId: string) {
  const { error } = await supabase
    .from('calls')
    .update({ status: 'missed', ended_at: new Date().toISOString() })
    .eq('id', callId);
  if (error) throw error;
}

export async function leaveParticipant(callId: string, userId: string) {
  const { error } = await supabase
    .from('call_participants')
    .update({ left_at: new Date().toISOString() })
    .eq('call_id', callId)
    .eq('user_id', userId);
  if (error) throw error;
}
