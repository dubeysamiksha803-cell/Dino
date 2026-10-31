"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { motion } from "framer-motion";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setMessage("If an account exists for that email, you\u2019ll receive a password reset link shortly.");
    } catch (err: unknown) {
      const msg = (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string')
        ? (err as { message: string }).message
        : "Failed to send reset email";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-white p-6 text-zinc-900 dark:from-[#0b0c10] dark:via-[#0c1020] dark:to-[#0a0a14] dark:bg-gradient-to-br dark:text-zinc-50">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Enter your email and we&#39;ll send you a reset link.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            className="h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none ring-2 ring-transparent transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
          />
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center rounded-md bg-black text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus:ring-zinc-700"
          >
            {loading ? (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending…
              </motion.span>
            ) : (
              "Send reset link"
            )}
          </button>
        </form>
        {message && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">{message}</motion.p>
        )}
        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</motion.p>
        )}
      </div>
    </div>
  );
}
