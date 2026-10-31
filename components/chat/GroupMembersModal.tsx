"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getImageDisplayUrl, edgeImageUrlFromS3 } from "@/lib/media";
import { supabase } from "@/lib/supabaseClient";
import { X, Crown, Shield, UserMinus, UserPlus, Copy, RefreshCw, Camera } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import ImageCropperModal from "@/components/ui/ImageCropperModal";
import type { User } from "./types";
import { generateInviteCode } from "@/lib/inviteCodes";

type Member = User & { role: "owner" | "admin" | "member" };

export default function GroupMembersModal({
  chatId,
  currentUserId,
  onClose,
}: {
  chatId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<"owner" | "admin" | "member" | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showFullscreenAvatar, setShowFullscreenAvatar] = useState(false);
  const [selectedImageForCrop, setSelectedImageForCrop] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data: memberRows, error: mErr } = await supabase
        .from("chat_members")
        .select("user_id, role")
        .eq("chat_id", chatId);
      if (mErr) throw mErr;

      const userIds = (memberRows ?? []).map((r) => r.user_id);
      const { data: userRows, error: uErr } = await supabase
        .from("users")
        .select("id, username, avatar_url")
        .in("id", userIds);
      if (uErr) throw uErr;

      const merged: Member[] = (memberRows ?? []).map((mr) => {
        const user = (userRows ?? []).find((u) => u.id === mr.user_id);
        return {
          id: mr.user_id,
          username: user?.username ?? "unknown",
          avatarUrl: user?.avatar_url ?? null,
          role: mr.role as "owner" | "admin" | "member",
        };
      });

      // Order: owner > admin > members, then by username
      merged.sort((a, b) => {
        const order = { owner: 0, admin: 1, member: 2 };
        const diff = order[a.role] - order[b.role];
        if (diff !== 0) return diff;
        return a.username.localeCompare(b.username);
      });

      setMembers(merged);
      const me = merged.find((m) => m.id === currentUserId);
      setMyRole(me?.role ?? null);

      // Fetch invite_code for this group and current avatar
      const { data: chatData, error: chatErr } = await supabase
        .from("chats")
        .select("invite_code, avatar_url")
        .eq("id", chatId)
        .eq("type", "group")
        .maybeSingle();
      if (!chatErr && chatData) {
        setInviteCode(chatData.invite_code);
        setGroupAvatar(chatData.avatar_url);
      }

      setLoading(false);
    };
    fetchMembers();
  }, [chatId, currentUserId]);

  async function action(
    type: "promote" | "demote" | "remove",
    targetUserId: string,
  ) {
    setActionLoading(targetUserId);
    const route = type === "remove"
      ? `/api/chats/${chatId}/members/${targetUserId}/remove`
      : `/api/chats/${chatId}/members/${targetUserId}/${type}`;
    const method = type === "remove" ? "DELETE" : "POST";

    try {
      const res = await fetch(route, { method });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed");
      }
      // Refetch members
      window.location.reload(); // simple refresh; in real app you’d re-fetch locally
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Action failed";
      alert(message);
    } finally {
      setActionLoading(null);
    }
  }

  async function generateInviteLink() {
    setGenerating(true);
    try {
      const newCode = generateInviteCode();
      const { error } = await supabase
        .from("chats")
        .update({ invite_code: newCode })
        .eq("id", chatId)
        .eq("type", "group");
      if (error) throw error;
      setInviteCode(newCode);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate invite link";
      alert(message);
    } finally {
      setGenerating(false);
    }
  }

  // Helper to read file as data URL (same as profile upload)
  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // When user selects a file, show the cropper instead of uploading immediately
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be selected again
    e.target.value = "";

    // Convert file to data URL and show cropper
    const dataUrl = await readAsDataUrl(file);
    setSelectedImageForCrop(dataUrl);
  }

  // Handle the cropped image upload
  async function handleCroppedImage(croppedBlob: Blob) {
    setSelectedImageForCrop(null);
    setUploadingAvatar(true);

    try {
      // Convert blob to data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(croppedBlob);
      });

      const fileName = `group-avatar-${chatId}-${Date.now()}.jpg`;

      console.log('Uploading cropped avatar...', { fileName, userId: currentUserId });

      // Upload via edge function
      const { data: uploadRes, error: uploadErr } = await supabase.functions.invoke('upload-image', {
        body: { imageData: dataUrl, fileName, userId: currentUserId },
      });

      if (uploadErr) throw uploadErr;

      // Get the S3 URL from response
      const s3Url = (uploadRes as { imageUrl?: string } | null)?.imageUrl as string;
      if (!s3Url) throw new Error("No image URL returned from upload");

      // Update the chat's avatar_url in database
      const { error: updateErr } = await supabase
        .from("chats")
        .update({ avatar_url: s3Url })
        .eq("id", chatId);
      if (updateErr) throw updateErr;

      // Resolve display URL and update local state
      const displayUrl = await getImageDisplayUrl(supabase, s3Url);
      setGroupAvatar(displayUrl);

      console.log('Group avatar upload complete:', displayUrl);
    } catch (err: unknown) {
      console.error('Group avatar upload error:', err);
      const message = err instanceof Error ? err.message : "Failed to update avatar";
      alert(message);
    } finally {
      setUploadingAvatar(false);
    }
  }
  async function copyGroupLink() {
    if (!inviteCode) {
      alert("Invite link not available");
      return;
    }
    const url = `${window.location.origin}/join?code=${inviteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      alert("Invite link copied");
    } catch (err) {
      console.error("Failed to copy:", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("Invite link copied");
    }
  }

  if (loading) {
    return (
      <div className="fixed left-[280px] top-16 z-50 w-72 rounded-xl border border-neutral-800 bg-neutral-950 p-4 shadow-2xl">
        <div className="text-sm text-zinc-400">Loading members…</div>
      </div>
    );
  }

  return (
    <div className="fixed left-[280px] top-16 z-50 w-72 max-h-[70vh] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 p-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => groupAvatar && setShowFullscreenAvatar(true)}
              className="cursor-pointer rounded-full hover:ring-2 hover:ring-purple-500 transition-all"
              title="View full size"
            >
              <Avatar src={groupAvatar} name="Group" size={36} interactive={false} />
            </button>
            {(myRole === "owner" || myRole === "admin") && (
              <label className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-neutral-700 text-white hover:bg-neutral-600 overflow-hidden">
                {uploadingAvatar ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </label>
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-100">Group info</div>
            <div className="text-xs text-zinc-500">{members.length} members</div>
          </div>
        </div>
        <button onClick={onClose} className="rounded-full p-1.5 text-zinc-400 hover:bg-neutral-800 hover:text-zinc-200">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Invite Link Section */}
      {inviteCode ? (
        <button
          onClick={copyGroupLink}
          className="w-full flex items-center justify-center gap-2 border-b border-neutral-800 px-3 py-2.5 text-xs text-zinc-400 hover:bg-neutral-900"
        >
          <Copy className="h-3.5 w-3.5" /> Copy invite link
        </button>
      ) : myRole === "owner" ? (
        <button
          onClick={generateInviteLink}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 border-b border-neutral-800 px-3 py-2.5 text-xs text-zinc-400 hover:bg-neutral-900 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Generating…" : "Generate invite link"}
        </button>
      ) : null}

      {/* Members List */}
      <div className="max-h-64 overflow-y-auto p-2">
        {members.map((m) => {
          const isMe = m.id === currentUserId;
          const canPromote = myRole === "owner" && m.role === "member";
          const canDemote = myRole === "owner" && m.role === "admin" && !isMe;
          const canRemove =
            (myRole === "owner" && m.role !== "owner") ||
            (myRole === "admin" && m.role === "member" && !isMe);

          return (
            <div key={m.id} className="flex items-center justify-between rounded-lg p-2 hover:bg-neutral-900">
              <div className="flex items-center gap-2.5">
                <Avatar src={m.avatarUrl} name={m.username} size={32} interactive={false} />
                <div>
                  <div className="text-sm text-zinc-100">{m.username}</div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                    {m.role === "owner" && <Crown className="h-2.5 w-2.5 text-yellow-500" />}
                    {m.role === "admin" && <Shield className="h-2.5 w-2.5 text-blue-400" />}
                    <span className="capitalize">{m.role}</span>
                  </div>
                </div>
              </div>

              {!isMe && (
                <div className="flex gap-0.5">
                  {canPromote && (
                    <button
                      onClick={() => action("promote", m.id)}
                      disabled={actionLoading === m.id}
                      className="rounded p-1 text-emerald-400 hover:bg-neutral-800 disabled:opacity-60"
                      title="Make admin"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canDemote && (
                    <button
                      onClick={() => action("demote", m.id)}
                      disabled={actionLoading === m.id}
                      className="rounded p-1 text-yellow-400 hover:bg-neutral-800 disabled:opacity-60"
                      title="Remove admin"
                    >
                      <Shield className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {canRemove && (
                    <button
                      onClick={() => action("remove", m.id)}
                      disabled={actionLoading === m.id}
                      className="rounded p-1 text-red-400 hover:bg-neutral-800 disabled:opacity-60"
                      title="Remove from group"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fullscreen Avatar Modal - rendered via portal to escape stacking context */}
      {showFullscreenAvatar && groupAvatar && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95"
          onClick={() => setShowFullscreenAvatar(false)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFullscreenAvatar(false);
            }}
            className="absolute top-6 right-6 z-[10000] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            title="Close"
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={groupAvatar.startsWith("s3://") ? edgeImageUrlFromS3(groupAvatar) : groupAvatar}
            alt="Group Avatar"
            className="max-w-[85vw] max-h-[85vh] rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}

      {/* Image Cropper Modal */}
      {selectedImageForCrop && (
        <ImageCropperModal
          imageSrc={selectedImageForCrop}
          onCropComplete={handleCroppedImage}
          onCancel={() => setSelectedImageForCrop(null)}
          aspectRatio={1}
          cropShape="round"
        />
      )}
    </div>
  );
}
