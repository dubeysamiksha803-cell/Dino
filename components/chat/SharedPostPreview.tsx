"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Avatar from "@/components/ui/Avatar";

type PostData = {
    id: string;
    content: string | null;
    author: {
        id: string;
        username: string;
        avatar_url: string | null;
    } | null;
    media: { file_url: string }[];
    like_count: number;
    comment_count: number;
    created_at: string;
};

export default function SharedPostPreview({ postId, postUrl }: { postId: string; postUrl: string }) {
    const [post, setPost] = useState<PostData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!postId) {
            setLoading(false);
            setError(true);
            return;
        }

        let cancelled = false;
        const fetchPost = async () => {
            try {
                // First fetch the post - only select columns that exist
                const { data: postData, error: postError } = await supabase
                    .from("posts")
                    .select("id, author_id, content, created_at")
                    .eq("id", postId)
                    .maybeSingle();

                if (postError || !postData) {
                    console.error("SharedPostPreview error:", postError);
                    if (!cancelled) setError(true);
                    return;
                }

                // Fetch author, media, and counts in parallel
                const [authorRes, mediaRes, likesRes, commentsRes] = await Promise.all([
                    supabase
                        .from("users")
                        .select("id, username, avatar_url")
                        .eq("id", postData.author_id)
                        .maybeSingle(),
                    supabase
                        .from("post_media")
                        .select("file_url")
                        .eq("post_id", postId)
                        .order("position"),
                    supabase
                        .from("post_reactions")
                        .select("id")
                        .eq("post_id", postId)
                        .eq("reaction", "like"),
                    supabase
                        .from("comments")
                        .select("id")
                        .eq("post_id", postId)
                ]);

                if (!cancelled) {
                    setPost({
                        id: postData.id,
                        content: postData.content,
                        created_at: postData.created_at,
                        like_count: likesRes.data?.length ?? 0,
                        comment_count: commentsRes.data?.length ?? 0,
                        author: authorRes.data ? {
                            id: authorRes.data.id,
                            username: authorRes.data.username,
                            avatar_url: authorRes.data.avatar_url
                        } : null,
                        media: (mediaRes.data ?? []) as { file_url: string }[]
                    });
                }
            } catch (e) {
                console.error("SharedPostPreview fetch error:", e);
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchPost();
        return () => { cancelled = true; };
    }, [postId]);

    if (loading) {
        return (
            <div className="w-[280px] animate-pulse rounded-2xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-zinc-800" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 rounded bg-zinc-800" />
                        <div className="h-2 w-16 rounded bg-zinc-800/60" />
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="h-3 w-full rounded bg-zinc-800/60" />
                    <div className="h-3 w-4/5 rounded bg-zinc-800/60" />
                </div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <a
                href={postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-[280px] rounded-2xl border border-zinc-800/60 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4 transition-all hover:border-zinc-700"
            >
                <div className="flex items-center gap-2 text-zinc-400">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757" />
                    </svg>
                    <span className="text-sm font-medium">View shared post</span>
                </div>
            </a>
        );
    }

    const timeAgo = (() => {
        const diff = Date.now() - new Date(post.created_at).getTime();
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(mins / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days}d`;
        if (hours > 0) return `${hours}h`;
        if (mins > 0) return `${mins}m`;
        return "now";
    })();

    const firstImage = post.media?.[0]?.file_url;

    return (
        <a
            href={postUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="group block w-[300px] overflow-hidden rounded-2xl transition-all"
        >
            {/* Header */}
            <div className="px-4 pt-4 pb-3">

                <div className="flex items-center gap-3">
                    <Avatar
                        src={post.author?.avatar_url ?? null}
                        name={post.author?.username ?? "User"}
                        size={40}
                        interactive={false}
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-zinc-100">
                                {post.author?.username ?? "User"}
                            </span>
                            <span className="text-xs text-zinc-500">• {timeAgo}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span>Shared Post</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            {post.content && (
                <div className="px-4 pb-3">
                    <p className="text-sm leading-relaxed text-zinc-300 line-clamp-3">
                        {post.content}
                    </p>
                </div>
            )}

            {/* Media preview */}
            {firstImage && (
                <div className="relative mx-3 mb-3 overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={firstImage}
                        alt=""
                        className="h-36 w-full object-cover transition-transform group-hover:scale-105"
                    />
                    {post.media.length > 1 && (
                        <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">
                            +{post.media.length - 1}
                        </div>
                    )}
                </div>
            )}

            {/* Footer with stats */}
            <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {post.like_count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {post.comment_count || 0}
                    </span>
                </div>
                <span className="flex items-center gap-1 text-xs text-zinc-400 transition-colors group-hover:text-zinc-300">
                    View post
                    <svg className="h-3 w-3 transform transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </span>
            </div>
        </a>
    );
}
