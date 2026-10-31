"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getImageDisplayUrl } from "@/lib/media";
import Topbar from "@/components/dashboard/Topbar";
import Sidebar from "@/components/dashboard/Sidebar";
import CommunityMembersRail from "@/components/communities/CommunityMembersRail";
import PostList from "@/components/posts/PostList";
import PostComposer from "@/components/posts/PostComposer";

export default function CommunityDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const communityId = params?.id as string | undefined;

  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [header, setHeader] = useState<{ id: string; slug?: string | null; name: string; description?: string | null; rules?: string | null; created_by?: string | null; created_at?: string | null; avatar_url?: string | null; cover_url?: string | null } | null>(null);
  const [membersCount, setMembersCount] = useState<number | null>(null);
  const [joined, setJoined] = useState<boolean>(false);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [members, setMembers] = useState<{
    userId: string;
    role: string;
    status: string;
    joinedAt: string | null;
    user: { id: string; username: string | null; avatar_url: string | null } | null;
  }[]>([]);
  const [openEdit, setOpenEdit] = useState(false);
  const [editValues, setEditValues] = useState<{ name: string; description: string; rules: string }>({ name: "", description: "", rules: "" });
  const [uploading, setUploading] = useState<null | "avatar" | "cover">(null);


  async function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  const onPickAvatar = () => {
    const el = document.getElementById("community-avatar-input") as HTMLInputElement | null;
    el?.click();
  };
  const onPickCover = () => {
    const el = document.getElementById("community-cover-input") as HTMLInputElement | null;
    el?.click();
  };

  const handleUpload = async (file: File, kind: "avatar" | "cover") => {
    if (!header) return;
    try {
      setUploading(kind);
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const uid = session?.user?.id;
      if (!uid) return;
      const dataUrl = await readAsDataUrl(file);
      const fileName = `${kind}-${Date.now()}.${(file.name.split(".").pop() || "jpg").toLowerCase()}`;
      const { data: uploadRes, error: upErr } = await supabase.functions.invoke('upload-image', {
        body: { imageData: dataUrl, fileName, userId: uid },
      });
      if (upErr) throw upErr;
      const s3Url = (uploadRes as { imageUrl?: string } | null)?.imageUrl as string;
      console.log('Community image uploaded via upload-image', { kind, s3Url });
      const { error: uErr } = await supabase
        .from('communities')
        .update({ [kind === "avatar" ? "avatar_url" : "cover_url"]: s3Url })
        .eq('id', header.id);
      if (uErr) throw uErr;
      const displayUrl = await getImageDisplayUrl(supabase, s3Url);
      setHeader((prev) => prev ? { ...prev, [kind === "avatar" ? "avatar_url" : "cover_url"]: displayUrl } : prev);
    } catch {
      // no-op; could toast error
    } finally {
      setUploading(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) { router.replace("/login"); return; }
      if (!mounted) return;
      setEmail(session.user.email ?? null);
    })();
    return () => { mounted = false; };
  }, [router]);

  useEffect(() => {
    if (!communityId) return;
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user.id ?? "";
        const key = encodeURIComponent(String(communityId));
        const res = await fetch(`/api/communities/${key}${uid ? `?uid=${uid}` : ""}`, { cache: "no-store" });
        if (!mounted) return;
        if (!res.ok) {
          setHeader(null);
          setMembersCount(null);
          setJoined(false);
          return;
        }
        const json = await res.json();
        // Resolve display URLs for avatar and cover using the same edge function
        // used elsewhere in the app (get-image / EDGE proxy). We still store the
        // raw S3 URL in the database; this is only for display.
        let avatarDisplayUrl: string | null = null;
        let coverDisplayUrl: string | null = null;
        try {
          if (json.avatar_url) {
            avatarDisplayUrl = await getImageDisplayUrl(supabase, json.avatar_url as string);
          }
        } catch {
          avatarDisplayUrl = null;
        }
        try {
          if (json.cover_url) {
            coverDisplayUrl = await getImageDisplayUrl(supabase, json.cover_url as string);
          }
        } catch {
          coverDisplayUrl = null;
        }
        const hdr: {
          id: string;
          slug: string | null;
          name: string;
          description: string | null;
          rules: string | null;
          created_by: string | null;
          created_at: string | null;
          avatar_url: string | null;
          cover_url: string | null;
        } = {
          id: String(json.id),
          slug: json.slug ?? null,
          name: String(json.name),
          description: json.description ?? null,
          rules: json.rules ?? null,
          created_by: json.created_by ?? null,
          created_at: json.created_at ?? null,
          avatar_url: avatarDisplayUrl ?? json.avatar_url ?? null,
          cover_url: coverDisplayUrl ?? json.cover_url ?? null,
        };
        setHeader(hdr);
        setMembersCount(typeof json.membersCount === "number" ? json.membersCount : null);
        if (typeof json.joined === "boolean") setJoined(json.joined);
        if (hdr && uid) setIsOwner(hdr.created_by === uid);
        if (hdr) setEditValues({ name: hdr.name, description: hdr.description ?? "", rules: hdr.rules ?? "" });

        // Load full members list (public read via RLS policy)
        try {
          const membersRes = await fetch(`/api/communities/${key}/members`, { cache: "no-store" });
          if (membersRes.ok) {
            const membersJson: {
              userId: string;
              role: string;
              status: string;
              joinedAt: string | null;
              user: { id: string; username: string | null; avatar_url: string | null } | null;
            }[] = await membersRes.json();

            // Resolve display URLs for member avatars so S3 URLs become browser-usable
            const withDisplayAvatars = await Promise.all(
              membersJson.map(async (m) => {
                if (!m.user?.avatar_url) return m;
                let url = m.user.avatar_url;
                try {
                  url = await getImageDisplayUrl(supabase, url);
                } catch {
                  // fall back to raw url if edge function fails
                }
                return {
                  ...m,
                  user: {
                    ...m.user,
                    avatar_url: url,
                  },
                };
              })
            );

            if (mounted) {
              setMembers(withDisplayAvatars);
            }
          } else if (mounted) {
            setMembers([]);
          }
        } catch {
          if (mounted) setMembers([]);
        }
      } catch (e) {
        console.error("Error loading community page:", e);
        if (mounted) {
          setHeader(null);
          setMembersCount(null);
          setJoined(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [communityId]);

  const onToggleJoin = async () => {
    if (!header?.id) return;
    const { data: sess } = await supabase.auth.getSession();
    const session = sess.session;
    const uid = session?.user.id;
    if (!uid) return;
    const key = encodeURIComponent(header.id);
    const method = joined ? "DELETE" : "POST";
    const res = await fetch(`/api/communities/${key}/members`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userId: uid }),
    });
    if (res.ok) {
      if (joined) {
        setJoined(false);
        setMembersCount((c) => (typeof c === "number" ? Math.max(0, c - 1) : c));
      } else {
        setJoined(true);
        setMembersCount((c) => (typeof c === "number" ? c + 1 : 1));
      }
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-black text-zinc-400">Loading community…</div>;
  if (!header) return <div className="flex min-h-screen items-center justify-center bg-black text-zinc-400">Community not found</div>;

  return (
    <div className="min-h-screen bg-black text-zinc-50">
      <Topbar email={email} />
      <Sidebar />
      <main className="lg:ml-[280px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex gap-6">
          {/* Main content */}
          <div className="min-w-0 flex-1 max-w-4xl space-y-6">
            <section className="rounded-2xl border border-zinc-900 bg-black overflow-hidden">
              <div className="relative h-32 w-full">
                {header.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={header.cover_url} alt="cover" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900" />
                )}
                {isOwner && (
                  <button onClick={onPickCover} className="absolute right-3 top-3 rounded-md border border-zinc-700/60 bg-black/40 px-2 py-1 text-[11px] text-zinc-200 hover:bg-black/50">
                    {uploading === 'cover' ? 'Uploading…' : 'Change cover'}
                  </button>
                )}
              </div>
              <div className="flex items-start gap-4 p-5">
                <div className="relative -mt-12 h-20 w-20 overflow-hidden rounded-2xl border-4 border-black bg-zinc-900 shadow-xl">
                  {header.avatar_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={header.avatar_url} alt={header.name} className="h-full w-full object-cover" />
                  )}
                  {isOwner && (
                    <button onClick={onPickAvatar} className="absolute bottom-1 right-1 rounded-md border border-zinc-700/60 bg-black/50 px-2 py-0.5 text-[10px] text-zinc-200 hover:bg-black/60">
                      {uploading === 'avatar' ? '…' : 'Edit'}
                    </button>
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold text-zinc-100">{header.name}</h1>
                  {header.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{header.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-xs text-zinc-400">
                    <span>{membersCount ? membersCount.toLocaleString() : "—"} Members</span>
                    <span>•</span>
                    <span>Top community</span>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {isOwner && (
                    <button onClick={() => setOpenEdit(true)} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100">Edit</button>
                  )}
                  <button onClick={onToggleJoin} className={`rounded-xl px-5 py-2 text-xs font-medium transition-colors ${joined ? "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800" : "bg-zinc-100 text-zinc-900 hover:bg-white"}`}>
                    {joined ? "Joined" : "Join"}
                  </button>
                </div>
              </div>
            </section>

            <section>
              <div className="rounded-2xl border border-zinc-900 bg-black p-5">
                {isOwner || joined ? (
                  <PostComposer communityId={header.id} onPosted={() => { /* feed listens to post:created */ }} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900">
                      <svg className="h-6 w-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="mb-1 text-sm font-medium text-zinc-300">Join to post</p>
                    <p className="mb-4 text-xs text-zinc-600">Become a member to create posts in this community</p>
                    <button onClick={onToggleJoin} className="rounded-xl bg-zinc-100 px-5 py-2 text-xs font-medium text-zinc-900 hover:bg-white">
                      Join Community
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section>
              <PostList columns={1} communityId={header.id} />
            </section>
          </div>

          {/* Members Side Rail */}
          <CommunityMembersRail
            members={members}
            membersCount={membersCount}
            communityName={header.name}
          />
        </div>
      </main>
      {/* Hidden file inputs for owner image updates */}
      {isOwner && (
        <>
          <input id="community-avatar-input" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'avatar'); e.currentTarget.value = ''; }} />
          <input id="community-cover-input" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'cover'); e.currentTarget.value = ''; }} />
        </>
      )}
      {openEdit && header && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpenEdit(false)}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-900 bg-black p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">Edit Community</h2>
              <button onClick={() => setOpenEdit(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-900 hover:text-zinc-400">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const { data } = await supabase.auth.getSession();
              const token = data.session?.access_token;
              if (!token) return;
              const key = encodeURIComponent(header.slug || header.id);
              const res = await fetch(`/api/communities/${key}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ userId: data.session?.user.id, name: editValues.name, description: editValues.description, rules: editValues.rules }),
              });
              if (res.ok) {
                setHeader({ ...header, name: editValues.name, description: editValues.description, rules: editValues.rules });
                setOpenEdit(false);
              }
            }} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">Name</label>
                <input className="w-full rounded-xl border border-zinc-900 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-800" value={editValues.name} onChange={(e) => setEditValues(v => ({ ...v, name: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">Description</label>
                <textarea className="w-full resize-none rounded-xl border border-zinc-900 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-800" rows={3} value={editValues.description} onChange={(e) => setEditValues(v => ({ ...v, description: e.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-400">Rules</label>
                <textarea className="w-full resize-none rounded-xl border border-zinc-900 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-700 focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-800" rows={4} value={editValues.rules} onChange={(e) => setEditValues(v => ({ ...v, rules: e.target.value }))} />
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-zinc-900 pt-4">
                <button type="button" onClick={() => setOpenEdit(false)} className="rounded-xl px-5 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300">Cancel</button>
                <button className="rounded-xl bg-zinc-100 px-6 py-2.5 text-sm font-medium text-zinc-900 hover:bg-white">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
