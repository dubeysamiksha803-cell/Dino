"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { motion } from "framer-motion";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("pendingEmail") : null;
      if (stored) setEmail(stored);
    } catch {}
  }, []);

  // Poll for confirmation and redirect when confirmed
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        const u = user as unknown as { email_confirmed_at?: string | null; confirmed_at?: string | null } | null;
        const isConfirmed = !!(u && (u.email_confirmed_at || u.confirmed_at));
        if (user && isConfirmed) {
          try { if (typeof window !== "undefined") localStorage.removeItem("pendingEmail"); } catch {}
          router.replace("/");
          return;
        }
      } catch {}
      timer = setTimeout(poll, 4000);
    };
    poll();
    return () => { if (timer) clearTimeout(timer); };
  }, [router]);

  const resend = async () => {
    if (!email) return;
    setMessage(null);
    setError(null);
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      setMessage("Verification email sent. Check your inbox (and spam).");
    } catch (err: unknown) {
      const msg = (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string')
        ? (err as { message: string }).message
        : "Failed to resend email";
      setError(msg);
    } finally {
      setResending(false);
    }
  };

  const manualCheck = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      const u = user as unknown as { email_confirmed_at?: string | null; confirmed_at?: string | null } | null;
      const isConfirmed = !!(u && (u.email_confirmed_at || u.confirmed_at));
      if (user && isConfirmed) {
        try { if (typeof window !== "undefined") localStorage.removeItem("pendingEmail"); } catch {}
        router.replace("/");
      } else {
        setMessage("Still waiting for confirmation. Try again in a moment.");
      }
    } catch (err: unknown) {
      const msg = (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string')
        ? (err as { message: string }).message
        : "Unable to verify status right now";
      setError(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-white p-6 text-zinc-900 dark:from-[#0b0c10] dark:via-[#0c1020] dark:to-[#0a0a14] dark:bg-gradient-to-br dark:text-zinc-50">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80">
        <h1 className="text-2xl font-semibold">Verify your email</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {email ? (
            <>We sent a verification link to <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>. Open it to activate your account.</>
          ) : (
            <>We sent a verification link to your email. Open it to activate your account.</>
          )}
        </p>

        <div className="mt-6 space-y-3">
          <button
            onClick={manualCheck}
            className="flex h-11 w-full items-center justify-center rounded-md bg-black text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus:ring-zinc-700"
          >
            I verified my email
          </button>
          <button
            onClick={resend}
            disabled={resending || !email}
            className="flex h-11 w-full items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-800/80"
          >
            {resending ? (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Resending…
              </motion.span>
            ) : (
              "Resend verification email"
            )}
          </button>
          <button
            onClick={() => router.replace("/login")}
            className="w-full text-center text-sm text-zinc-600 underline transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Use a different email
          </button>
        </div>

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
