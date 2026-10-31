"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

export type AuthMode = "signin" | "signup";

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const title = mode === "signin" ? "Welcome back" : "Create your account";
  const cta = mode === "signin" ? "Sign in" : "Create account";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
            data: { username },
          },
        });
        if (error) throw error;
        if (data.user && !data.user.confirmed_at) {
          try { if (typeof window !== "undefined") localStorage.setItem("pendingEmail", email); } catch {}
          router.push("/verify-email");
        } else {
          router.push("/");
        }
      }
    } catch (err: unknown) {
      const msg = (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string')
        ? (err as { message: string }).message
        : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = () => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score; // 0-4
  };

  const strength = passwordStrength();
  const strengthLabel = ["Too weak", "Weak", "Fair", "Good", "Strong"][strength] ?? "";
  const strengthColor = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-green-600"][strength] ?? "bg-gray-300";

  return (
    <div className="w-full max-w-md">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, x: error ? [0, -6, 6, -4, 4, 0] : 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="rounded-2xl border border-zinc-200 bg-white/90 p-6 shadow-xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80"
      >
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {mode === "signin" ? "Welcome back! Let’s get you in." : "Takes less than a minute. No fluff."}
          </p>
        </div>

        

        <form onSubmit={handleSubmit} className="space-y-4" aria-label={mode === "signin" ? "Sign in form" : "Sign up form"}>
          {mode === "signup" && (
            <div className="relative" aria-live="polite">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                aria-label="Username"
                required
                className="h-12 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none ring-2 ring-transparent transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
              />
            </div>
          )}
          <div className="relative" aria-live="polite">
            <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" aria-hidden="true" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              inputMode="email"
              autoComplete="email"
              aria-label="Email"
              required
              className="h-12 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-3 text-sm text-zinc-900 outline-none ring-2 ring-transparent transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
            />
          </div>
          <div className="relative" aria-live="polite">
            <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" aria-hidden="true" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              minLength={mode === "signup" ? 6 : undefined}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              aria-label="Password"
              required
              className="h-12 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-12 text-sm text-zinc-900 outline-none ring-2 ring-transparent transition placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 dark:focus:ring-zinc-700"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            {mode === "signup" && (
              <div className="mt-2">
                <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div className={`h-full ${strengthColor}`} style={{ width: `${(strength / 4) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-zinc-500" role="status">{strengthLabel}</p>
              </div>
            )}
          </div>

          {mode === "signin" && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Use your account to continue</span>
              <a href="/forgot-password" className="text-zinc-900 underline hover:opacity-80 dark:text-zinc-100">Forgot password?</a>
            </div>
          )}

          {mode === "signup" && (
            <label className="mt-2 flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" required className="mt-1 size-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800" />
              <span>By creating an account, you agree to our <a className="underline" href="#" target="_blank" rel="noreferrer">Terms</a> and <a className="underline" href="#" target="_blank" rel="noreferrer">Privacy Policy</a>.</span>
            </label>
          )}

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-900/40">
              {error}
            </motion.div>
          )}
          {info && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-900/40">
              {info}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center rounded-md bg-black text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus:ring-zinc-700"
          >
            {loading ? (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing…
              </motion.span>
            ) : (
              cta
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
          {mode === "signin" ? (
            <>
              Don’t have an account? <a href="/signup" className="font-medium text-zinc-900 underline dark:text-zinc-100">Sign up</a>
            </>
          ) : (
            <>
              Already have an account? <a href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-100">Sign in</a>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}
