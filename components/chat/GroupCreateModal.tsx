"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Chat, User } from "@/components/chat/types";
import { X, Search, UserPlus, Users, Check } from "lucide-react";
import { generateInviteCode } from "@/lib/inviteCodes";

export default function GroupCreateModal({
  me,
  onClose,
  onCreated,
}: {
  me: User;
  onClose: () => void;
  onCreated: (chat: Chat) => void;
}) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Array<{ id: string; username: string; avatar_url: string | null }>>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!query.trim()) { setResults([]); return; }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, avatar_url')
          .ilike('username', `%${query.trim()}%`)
          .limit(8);
        if (error) throw error;
        if (!cancelled) setResults((data ?? []).filter((u) => u.id !== me.id));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const t = setTimeout(run, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, me.id]);

  function toggleSelect(u: { id: string; username: string; avatar_url: string | null }) {
    setSelected((prev) => {
      const exists = prev.some((x) => x.id === u.id);
      if (exists) return prev.filter((x) => x.id !== u.id);
      return [...prev, u];
    });
  }

  function removeSelected(id: string) {
    setSelected((prev) => prev.filter((x) => x.id !== id));
  }

  async function createGroup() {
    const title = name.trim();
    if (!title) return;
    if (selected.length === 0) return;
    setCreating(true);
    try {
      // Create group chat with invite code
      const inviteCode = generateInviteCode();
      const { data: chatRow, error: cErr } = await supabase
        .from('chats')
        .insert({ type: 'group', title, created_by: me.id, invite_code: inviteCode })
        .select('id, type, title, avatar_url, created_at, invite_code')
        .single();
      if (cErr) throw cErr;
      const chatId = chatRow.id as string;

      // Ensure basic profiles rows exist when schema expects it (best-effort)
      try {
        const ids = [me.id, ...selected.map((s) => s.id)];
        const { data: existing } = await supabase.from('profiles').select('id').in('id', ids);
        const have = new Set((existing ?? []).map((p: { id: string }) => p.id));
        const upserts: Array<{ id: string; username: string | null | undefined; avatar_url: string | null }> = [];
        if (!have.has(me.id)) upserts.push({ id: me.id, username: me.username, avatar_url: me.avatarUrl ?? null });
        selected.forEach((s) => { if (!have.has(s.id)) upserts.push({ id: s.id, username: s.username, avatar_url: s.avatar_url }); });
        if (upserts.length) await supabase.from('profiles').upsert(upserts, { onConflict: 'id' });
      } catch { }

      // Add members: owner first, then selected members
      const members = [
        { chat_id: chatId, user_id: me.id, role: "owner" },
        ...selected.map((s) => ({ chat_id: chatId, user_id: s.id, role: "member" })),
      ];
      const { error: mErr } = await supabase.from("chat_members").insert(members);
      if (mErr) throw mErr;

      const mapped: Chat = {
        id: chatId,
        type: 'group',
        title,
        avatarUrl: chatRow.avatar_url ?? null,
        lastMessageAt: new Date().toISOString(),
        members: [
          { id: me.id, username: me.username, avatarUrl: me.avatarUrl },
          ...selected.map((s) => ({ id: s.id, username: s.username, avatarUrl: s.avatar_url })),
        ],
      };
      onCreated(mapped);
      onClose();
    } catch {
      // TODO: show toast
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800">
              <Users className="h-5 w-5 text-zinc-300" />
            </div>
            <div>
              <div className="text-lg font-semibold text-zinc-100">Create group</div>
              <div className="text-xs text-zinc-500">Add members to your group</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-zinc-400 hover:bg-neutral-800 hover:text-zinc-200 transition-colors" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Group Name Input */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Group name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekend Trip"
              className="mt-2 h-11 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-neutral-700 transition-all"
            />
          </div>

          {/* Selected Members Chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-full bg-neutral-800 pl-1 pr-2 py-1">
                  <div className="h-6 w-6 overflow-hidden rounded-full ring-1 ring-neutral-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.avatar_url ?? '/avatar-placeholder.png'} alt={s.username} className="h-full w-full object-cover" />
                  </div>
                  <span className="text-xs text-zinc-300">{s.username}</span>
                  <button onClick={() => removeSelected(s.id)} className="ml-1 rounded-full p-0.5 text-zinc-500 hover:text-zinc-200 hover:bg-neutral-700 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search Members */}
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Add members</label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-zinc-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by username"
                className="h-11 w-full rounded-xl border border-neutral-800 bg-neutral-900 pl-10 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-neutral-700 transition-all"
              />
            </div>

            {/* Results List */}
            <div className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900/50">
              {loading && <div className="p-4 text-center text-sm text-zinc-500">Searching…</div>}
              {!loading && results.length === 0 && query.trim() && (
                <div className="p-4 text-center text-sm text-zinc-500">No users found</div>
              )}
              {!loading && results.length === 0 && !query.trim() && (
                <div className="p-4 text-center text-sm text-zinc-600">Type to search for users</div>
              )}
              <ul className="divide-y divide-neutral-800">
                {results.map((u) => {
                  const isSelected = selected.some(s => s.id === u.id);
                  return (
                    <li key={u.id} className="flex items-center justify-between p-3 hover:bg-neutral-800/50 transition-colors">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-9 w-9 overflow-hidden rounded-full ring-1 ring-neutral-700">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u.avatar_url ?? '/avatar-placeholder.png'} alt={u.username} className="h-full w-full object-cover" />
                        </div>
                        <div className="truncate text-sm text-zinc-100">{u.username}</div>
                      </div>
                      <button
                        onClick={() => toggleSelect(u)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${isSelected
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-neutral-800 text-zinc-300 border border-neutral-700 hover:bg-neutral-700'
                          }`}
                      >
                        {isSelected ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                        {isSelected ? 'Added' : 'Add'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-neutral-800 px-5 py-4 bg-neutral-900/30">
          <div className="text-xs text-zinc-500">
            {selected.length === 0 ? 'No members selected' : `${selected.length} member${selected.length > 1 ? 's' : ''} selected`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createGroup}
              disabled={creating || !name.trim() || selected.length === 0}
              className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? 'Creating…' : 'Create group'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
