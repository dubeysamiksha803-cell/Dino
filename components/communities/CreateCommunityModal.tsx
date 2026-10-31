"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CreateCommunityModal({
  open,
  onClose,
  onCreated,
  createdByUserId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  createdByUserId?: string | null;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!isAuthed) {
      setError("You must be signed in to create a community");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        throw new Error("You must be signed in to create a community");
      }
      const res = await fetch("/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          createdByUserId: createdByUserId ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create community");
      reset();
      onCreated();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create community";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setIsAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setIsAuthed(!!session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const charCount = name.length;
  const maxChars = 50;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-900 bg-black shadow-2xl shadow-black/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle accent line at top */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />

        {/* Header */}
        <div className="relative border-b border-zinc-900 px-6 py-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {/* Icon container */}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 ring-1 ring-zinc-800">
                <svg className="h-5 w-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">Create Community</h2>
                <p className="mt-0.5 text-sm text-zinc-500">Build your tribe and connect with others</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-900 hover:text-zinc-400"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-5">
            {/* Name field */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  Community Name
                </label>
                <span className={`text-xs ${charCount > maxChars ? 'text-red-400' : 'text-zinc-600'}`}>
                  {charCount}/{maxChars}
                </span>
              </div>
              <input
                className="w-full rounded-xl border border-zinc-900 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-700 transition-all focus:border-zinc-700 focus:bg-black focus:outline-none focus:ring-2 focus:ring-zinc-800"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, maxChars + 10))}
                placeholder="e.g. Indie Hackers, Design Club, Music Lovers"
                autoFocus
              />
              <p className="mt-1.5 text-xs text-zinc-700">Choose a unique name that represents your community</p>
            </div>

            {/* Description field */}
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
                <svg className="h-4 w-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Description
                <span className="text-xs font-normal text-zinc-600">(optional)</span>
              </label>
              <textarea
                className="w-full resize-none rounded-xl border border-zinc-900 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-700 transition-all focus:border-zinc-700 focus:bg-black focus:outline-none focus:ring-2 focus:ring-zinc-800"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Tell people what your community is about. What will members find here? What topics will you cover?"
              />
            </div>
          </div>

          {/* Auth warning */}
          {!isAuthed && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-amber-900/40 bg-amber-950/30 px-4 py-3">
              <svg className="h-5 w-5 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-amber-200">You must be signed in to create a community</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3">
              <svg className="h-5 w-5 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-zinc-900 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-zinc-500 transition-all hover:bg-zinc-900 hover:text-zinc-300"
            >
              Cancel
            </button>
            <button
              disabled={submitting || !isAuthed || !name.trim()}
              className="relative flex items-center gap-2 overflow-hidden rounded-xl bg-zinc-100 px-6 py-2.5 text-sm font-medium text-zinc-900 transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Community
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
