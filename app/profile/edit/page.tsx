"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Topbar from "@/components/dashboard/Topbar";
import Sidebar from "@/components/dashboard/Sidebar";
import { supabase } from "@/lib/supabaseClient";
import { getImageDisplayUrl } from "@/lib/media";
import { APP_BG, PAGE_MAIN, LAYOUT_ROW } from "@/lib/theme";
import { Camera, User, Phone, Mail, ArrowLeft, Check, X, Loader2 } from "lucide-react";

type EditableProfile = {
  id: string;
  username: string;
  full_name: string;
  email: string;
  bio?: string | null;
  phone_number?: string | null;
  country_code?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
};

export default function EditProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const BIO_MAX_LENGTH = 160;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.replace("/login");
          return;
        }

        if (mounted) setEmail(session.user.email ?? null);
        const uid = session.user.id;

        // Fetch user data from public.users
        const { data: userRow } = await supabase
          .from("users")
          .select("id, username, email, full_name, avatar_url, bio, phone_number, country_code, cover_url")
          .eq("id", uid)
          .maybeSingle(); // Use maybeSingle to avoid error if not found

        let baseData = userRow;

        // Fallback to profiles if no user row found in public.users
        if (!baseData) {
          const { data: profileRow } = await supabase
            .from("profiles")
            .select("id, username, email, full_name, avatar_url, bio, phone_number, country_code, cover_url")
            .eq("id", uid)
            .maybeSingle();
          baseData = profileRow;
        }

        if (mounted) {
          // Initialize state with data from users/profiles or session defaults
          let avatarUrl = baseData?.avatar_url;
          if (avatarUrl && /^s3:\/\//i.test(avatarUrl)) {
            avatarUrl = await getImageDisplayUrl(supabase, avatarUrl);
          }
          let coverUrl = baseData?.cover_url;
          if (coverUrl && /^s3:\/\//i.test(coverUrl)) {
            coverUrl = await getImageDisplayUrl(supabase, coverUrl);
          }

          setProfile({
            id: uid, // Always use session uid
            username: baseData?.username || session.user.user_metadata?.username || session.user.email?.split("@")[0] || "",
            full_name: baseData?.full_name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || "",
            email: baseData?.email || session.user.email || "",
            bio: baseData?.bio || "",
            phone_number: baseData?.phone_number || "",
            country_code: baseData?.country_code || "",
            avatar_url: avatarUrl || undefined,
            cover_url: coverUrl || undefined,
          });
          setLoading(false);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });

  const handleImageUpload = async (file: File, kind: "avatar" | "banner") => {
    if (kind === "avatar") setUploadingAvatar(true);
    else setUploadingBanner(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;

      const dataUrl = await readAsDataUrl(file);
      const fileName = `${kind}-${Date.now()}.${(file.name.split(".").pop() || "jpg").toLowerCase()}`;

      const { data: uploadRes, error: upErr } = await supabase.functions.invoke("upload-image", {
        body: { imageData: dataUrl, fileName, userId: uid },
      });
      if (upErr) throw upErr;

      const s3Url = (uploadRes as { imageUrl?: string } | null)?.imageUrl as string;

      // Use upsert to handle both create and update
      const { error: updateError } = await supabase
        .from("users")
        .upsert({
          id: uid,
          email: profile?.email,
          username: profile?.username || "",
          // If profile is partial, this might be risky, but profile should be loaded.
          // Better: only upsert if we have critical data, but we do check if profile exists.
          [kind === "avatar" ? "avatar_url" : "cover_url"]: s3Url,
          updated_at: new Date().toISOString(),
        })
        .select();

      if (updateError) throw updateError;

      const displayUrl = await getImageDisplayUrl(supabase, s3Url);
      setProfile((prev) => (prev ? { ...prev, [kind === "avatar" ? "avatar_url" : "cover_url"]: displayUrl } : prev));
    } catch (e: unknown) {
      const message = e instanceof Error && typeof e.message === "string" ? e.message : "Upload failed";
      setError(message);
    } finally {
      if (kind === "avatar") setUploadingAvatar(false);
      else setUploadingBanner(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw new Error("Not authenticated");

      const payload = {
        id: uid,
        email: profile.email,
        username: profile.username.trim(),
        full_name: profile.full_name.trim(),
        bio: (profile.bio ?? "").trim() || null,
        phone_number: (profile.phone_number ?? "").trim() || null,
        country_code: (profile.country_code ?? "").trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("users")
        .upsert(payload)
        .eq("id", uid);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => router.replace("/profile"), 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save profile";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const InputField = ({
    label,
    icon: Icon,
    value,
    onChange,
    placeholder,
    disabled,
    type = "text",
  }: {
    label: string;
    icon?: React.ElementType;
    value: string;
    onChange?: (val: string) => void;
    placeholder?: string;
    disabled?: boolean;
    type?: string;
  }) => (
    <div className="group">
      <label className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full rounded-xl border bg-[#0a0a0a] px-4 py-3 text-sm text-white placeholder:text-slate-600 transition-all duration-200 focus:outline-none ${disabled
          ? "cursor-not-allowed border-white/5 text-slate-500"
          : "border-white/10 focus:border-white/30 focus:ring-2 focus:ring-white/10"
          }`}
      />
    </div>
  );

  return (
    <div className={APP_BG}>
      <Topbar email={email} />
      <main className={PAGE_MAIN}>
        <div className={LAYOUT_ROW}>
          <Sidebar />
          <div className="min-w-0 flex-1">
            {loading || !profile ? (
              <div className="flex items-center justify-center rounded-2xl border border-white/5 bg-[#0a0a0a] p-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <button onClick={() => router.back()} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h1 className="text-xl font-semibold text-white">Edit Profile</h1>
                    <p className="text-sm text-slate-500">Update your personal information</p>
                  </div>
                </div>

                {/* Banner & Avatar Section */}
                <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#0a0a0a]">
                  {/* Banner */}
                  <div className="relative h-40 bg-[#111111]">
                    {profile.cover_url && (
                      <Image
                        src={profile.cover_url}
                        alt="Banner"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    )}
                    <button
                      onClick={() => bannerInputRef.current?.click()}
                      disabled={uploadingBanner}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100"
                    >
                      {uploadingBanner ? (
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
                          <Camera className="h-4 w-4" />
                          Change Cover
                        </div>
                      )}
                    </button>
                    <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "banner"); }} />
                  </div>

                  {/* Avatar */}
                  <div className="relative -mt-16 ml-6">
                    <div className="relative h-28 w-28 overflow-hidden rounded-2xl border-4 border-[#0a0a0a] bg-[#1a1a1a] shadow-xl">
                      {profile.avatar_url ? (
                        <Image
                          src={profile.avatar_url}
                          alt="Avatar"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <User className="h-12 w-12 text-white/80" />
                        </div>
                      )}
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100"
                      >
                        {uploadingAvatar ? (
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        ) : (
                          <Camera className="h-5 w-5 text-white" />
                        )}
                      </button>
                      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "avatar"); }} />
                    </div>
                  </div>

                  <div className="px-6 pb-6 pt-4">
                    <p className="text-xs text-slate-500">Click on avatar or cover to change</p>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={onSubmit} className="space-y-6">
                  {/* Basic Info Section */}
                  <div className="rounded-2xl border border-white/5 bg-[#0a0a0a] p-6">
                    <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-400">Basic Information</h2>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <InputField
                        label="Display Name"
                        icon={User}
                        value={profile.full_name}
                        onChange={(val) => setProfile({ ...profile, full_name: val })}
                        placeholder="Your name"
                      />
                      <InputField
                        label="Username"
                        value={profile.username}
                        onChange={(val) => setProfile({ ...profile, username: val })}
                        placeholder="@username"
                      />
                    </div>
                    <div className="mt-5">
                      <label className="mb-2 block text-xs font-medium text-slate-400">Bio</label>
                      <textarea
                        rows={3}
                        value={profile.bio ?? ""}
                        onChange={(e) => {
                          if (e.target.value.length <= BIO_MAX_LENGTH) {
                            setProfile({ ...profile, bio: e.target.value });
                          }
                        }}
                        placeholder="Tell people about yourself..."
                        className="w-full resize-none rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white placeholder:text-slate-600 transition-all duration-200 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/10"
                      />
                      <div className="mt-1.5 flex justify-end">
                        <span className={`text-xs ${(profile.bio?.length ?? 0) >= BIO_MAX_LENGTH ? "text-amber-400" : "text-slate-500"}`}>
                          {profile.bio?.length ?? 0}/{BIO_MAX_LENGTH}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contact Section */}
                  <div className="rounded-2xl border border-white/5 bg-[#0a0a0a] p-6">
                    <h2 className="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-400">Contact</h2>
                    <div className="space-y-5">
                      <InputField
                        label="Email"
                        icon={Mail}
                        value={profile.email}
                        disabled
                        placeholder="Email address"
                      />
                      <div>
                        <label className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
                          <Phone className="h-3.5 w-3.5" />
                          Phone Number
                        </label>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={profile.country_code ?? ""}
                            onChange={(e) => setProfile({ ...profile, country_code: e.target.value })}
                            placeholder="+1"
                            className="w-20 rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white placeholder:text-slate-600 transition-all duration-200 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/10"
                          />
                          <input
                            type="text"
                            value={profile.phone_number ?? ""}
                            onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                            placeholder="Phone number"
                            className="flex-1 rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-sm text-white placeholder:text-slate-600 transition-all duration-200 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/10"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status Messages */}
                  {error && (
                    <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                      <X className="h-4 w-4 shrink-0" />
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                      <Check className="h-4 w-4 shrink-0" />
                      Profile saved successfully! Redirecting...
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-white/10 transition-all duration-200 hover:bg-slate-200 hover:shadow-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="rounded-xl border border-white/10 px-6 py-3 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-white/5 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
