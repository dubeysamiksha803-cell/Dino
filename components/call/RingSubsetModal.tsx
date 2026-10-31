"use client";

import { useMemo, useState } from "react";
import type { User } from "@/components/chat/types";
import { X, Search, CheckSquare, Square } from "lucide-react";

export default function RingSubsetModal({
  members,
  onCancel,
  onConfirm,
}: {
  members: User[];
  onCancel: () => void;
  onConfirm: (userIds: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(() => members.map(m=>m.id));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m => (m.username || "").toLowerCase().includes(q));
  }, [members, query]);

  const allSelected = selected.length > 0 && selected.length === members.length;
  const noneSelected = selected.length === 0;

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  }
  function toggleAll() {
    if (allSelected) setSelected([]);
    else setSelected(members.map(m=>m.id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800/80 bg-zinc-900/80 p-0 text-zinc-100 shadow-2xl ring-1 ring-black/20">
        <div className="flex items-center justify-between rounded-t-2xl border-b border-zinc-800/70 bg-zinc-950/50 px-5 py-4">
          <div className="text-base font-semibold tracking-tight">Select participants to ring</div>
          <button onClick={onCancel} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100 transition" title="Close"><X className="h-4 w-4"/></button>
        </div>

        <div className="px-5 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
              placeholder="Search members"
              className="h-10 w-full rounded-xl border border-zinc-800/80 bg-zinc-950/70 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-indigo-600/60 focus:ring-2 focus:ring-indigo-600/40"
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-zinc-800/60 px-3 py-1 text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {selected.length} selected
            </div>
            <button onClick={toggleAll} className="text-indigo-400 hover:text-indigo-300 hover:underline transition">{allSelected ? "Clear all" : "Select all"}</button>
          </div>

          <div className="mt-3 max-h-80 overflow-y-auto rounded-xl border border-zinc-800/70 bg-zinc-950/40">
            {filtered.length === 0 && (
              <div className="p-4 text-sm text-zinc-500">No members</div>
            )}
            <ul className="divide-y divide-zinc-800/70">
              {filtered.map(m => (
                <li key={m.id} className="group flex items-center justify-between px-4 py-3 transition hover:bg-zinc-800/40">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-9 w-9 overflow-hidden rounded-full ring-1 ring-zinc-800/70 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.avatarUrl ?? '/avatar-placeholder.png'} alt={m.username} className="h-full w-full object-cover" />
                    </div>
                    <div className="truncate text-sm font-medium text-zinc-100">{m.username}</div>
                  </div>
                  <button onClick={()=>toggle(m.id)} className="rounded-md p-1.5 text-zinc-300 transition hover:bg-zinc-800/70 hover:text-emerald-400">
                    {selected.includes(m.id) ? <CheckSquare className="h-5 w-5 text-emerald-400"/> : <Square className="h-5 w-5"/>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 rounded-b-2xl border-t border-zinc-800/70 bg-zinc-950/60 px-5 py-4">
          <button onClick={onCancel} className="rounded-lg border border-zinc-700/70 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-800/70">Cancel</button>
          <button onClick={()=>onConfirm(selected)} disabled={noneSelected} className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow disabled:opacity-60 hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
            Ring {selected.length} {selected.length===1? 'member':'members'}
          </button>
        </div>
      </div>
    </div>
  );
}
