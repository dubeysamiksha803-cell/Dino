"use client";

import { useEffect, useState } from "react";
import { getPost, type PostWithExtras } from "@/lib/posts";
import Avatar from "@/components/ui/Avatar";
import { default as LinkPreviewComponent } from "../posts/LinkPreview";

export default function ChatPostPreview({ postId }: { postId: string }) {
  const [post, setPost] = useState<PostWithExtras | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchPost = async () => {
      try {
        const p = await getPost(postId);
        if (!cancelled) setPost(p);
      } catch (err) {
        console.error("Failed to fetch post preview", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPost();
    return () => { cancelled = true; };
  }, [postId]);

  if (loading) {
    return (
      <div className="mt-2 w-full max-w-sm rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-3">
        <div className="flex animate-pulse gap-3">
          <div className="h-10 w-10 rounded-full bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-zinc-800" />
            <div className="h-3 w-3/4 rounded bg-zinc-800" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) return null;

  const firstMedia = post.media?.[0];

  return (
    <a 
      href={`/posts/${post.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block w-full max-w-sm overflow-hidden rounded-xl border border-zinc-800/50 bg-zinc-900/50 transition hover:bg-zinc-800"
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Avatar 
            src={post.author?.avatar_url} 
            name={post.author?.username ?? "Unknown"} 
            size={24} 
            interactive={false}
          />
          <span className="text-sm font-medium text-zinc-200">
            {post.author?.username}
          </span>
          <span className="text-xs text-zinc-500">
            • {new Date(post.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Content */}
        {post.content && (
          <p className="mt-2 line-clamp-3 text-sm text-zinc-300">
            {post.content}
          </p>
        )}

        {/* Link Preview (if no media) */}
        {!firstMedia && post.link_url && (
            <div className="pointer-events-none mt-2">
                 <LinkPreviewComponent url={post.link_url} />
            </div>
        )}
      </div>

      {/* Media Preview */}
      {firstMedia && (
        <div className="aspect-video w-full bg-black">
          {firstMedia.file_type?.startsWith("video") ? (
            <video 
              src={firstMedia.file_url} 
              className="h-full w-full object-cover"
              muted 
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={firstMedia.file_url} 
              alt="Post preview" 
              className="h-full w-full object-cover"
            />
          )}
        </div>
      )}
    </a>
  );
}
