"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "@/components/dashboard/Sidebar";
import RightRail from "@/components/dashboard/RightRail";
import MobileTopbar from "@/components/mobile/MobileTopbar";
import PostCard from "@/components/posts/PostCard";
import { PostWithExtras } from "@/lib/posts";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { APP_BG, PAGE_MAIN, LAYOUT_ROW } from "@/lib/theme";

export default function SinglePostPage() {
    const params = useParams();
    const router = useRouter();
    const postId = params?.id as string;

    const [post, setPost] = useState<PostWithExtras | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    void currentUserId; // Satisfy lint

    useEffect(() => {
        const fetchPost = async () => {
            if (!postId) {
                setError("Post not found");
                setLoading(false);
                return;
            }

            try {
                // Get current user
                const { data: session } = await supabase.auth.getSession();
                const userId = session.session?.user?.id ?? null;
                setCurrentUserId(userId);

                // Fetch post - only select columns that exist
                const { data: postData, error: postError } = await supabase
                    .from("posts")
                    .select("id, author_id, post_type, content, link_url, visibility, created_at")
                    .eq("id", postId)
                    .maybeSingle();

                if (postError || !postData) {
                    console.error("Post query error:", postError);
                    setError("Post not found");
                    setLoading(false);
                    return;
                }

                // Fetch author, media, counts, and user-specific data in parallel
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const queries: any[] = [
                    supabase.from("users").select("id, username, avatar_url").eq("id", postData.author_id).maybeSingle(),
                    supabase.from("post_media").select("id, file_url, file_type, position").eq("post_id", postId).order("position"),
                    supabase.from("post_reactions").select("id").eq("post_id", postId).eq("reaction", "like"),
                    supabase.from("comments").select("id").eq("post_id", postId),
                    supabase.from("reposts").select("id").eq("post_id", postId),
                ];

                if (userId) {
                    queries.push(
                        supabase.from("post_reactions").select("id").eq("post_id", postId).eq("user_id", userId).eq("reaction", "like").maybeSingle(),
                        supabase.from("post_bookmarks").select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle(),
                        supabase.from("reposts").select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle()
                    );
                }

                const results = await Promise.all(queries);
                const [authorRes, mediaRes, likesRes, commentsRes, repostsRes, likedRes, bookmarkedRes, repostedRes] = results as [
                    { data: { id: string; username: string; avatar_url: string | null } | null },
                    { data: Array<{ id: string; file_url: string; file_type: string | null; position: number }> | null },
                    { data: Array<{ id: string }> | null },
                    { data: Array<{ id: string }> | null },
                    { data: Array<{ id: string }> | null },
                    { data: { id: string } | null } | undefined,
                    { data: { id: string } | null } | undefined,
                    { data: { id: string } | null } | undefined
                ];

                // Fetch poll data if applicable
                let poll = undefined;
                if (postData.post_type === "poll") {
                    const [pollRes, pollOptionsRes] = await Promise.all([
                        supabase.from("post_polls").select("*").eq("post_id", postId).maybeSingle(),
                        supabase.from("post_poll_options").select("*").eq("post_id", postId).order("position")
                    ]);

                    if (pollRes.data && pollOptionsRes.data) {
                        const optionIds = pollOptionsRes.data.map((o: { id: string }) => o.id);

                        // Get vote counts
                        const { data: votes } = await supabase
                            .from("post_poll_votes")
                            .select("option_id")
                            .in("option_id", optionIds);

                        const voteCounts = new Map<string, number>();
                        (votes ?? []).forEach((v: { option_id: string }) => {
                            voteCounts.set(v.option_id, (voteCounts.get(v.option_id) ?? 0) + 1);
                        });

                        // Get user votes
                        let userVoted: string[] = [];
                        if (userId) {
                            const { data: myVotes } = await supabase
                                .from("post_poll_votes")
                                .select("option_id")
                                .eq("user_id", userId)
                                .in("option_id", optionIds);
                            userVoted = (myVotes ?? []).map((v: { option_id: string }) => v.option_id);
                        }

                        let totalVotes = 0;
                        const options = pollOptionsRes.data.map((opt: { id: string; option_text: string; position: number }) => {
                            const count = voteCounts.get(opt.id) ?? 0;
                            totalVotes += count;
                            return {
                                id: opt.id,
                                option_text: opt.option_text,
                                position: opt.position,
                                vote_count: count
                            };
                        });

                        poll = {
                            multiple_choice: pollRes.data.multiple_choice,
                            closes_at: pollRes.data.closes_at,
                            options,
                            user_voted: userVoted,
                            total_votes: totalVotes
                        };
                    }
                }

                const fullPost: PostWithExtras = {
                    ...postData,
                    author: authorRes.data ?? null,
                    media: (mediaRes.data ?? []).map((m) => ({
                        id: m.id,
                        file_url: m.file_url,
                        file_type: m.file_type,
                        position: m.position
                    })),
                    like_count: likesRes?.data?.length ?? 0,
                    comment_count: commentsRes?.data?.length ?? 0,
                    repost_count: repostsRes?.data?.length ?? 0,
                    liked_by_me: !!likedRes?.data,
                    bookmarked_by_me: !!bookmarkedRes?.data,
                    reposted_by_me: !!repostedRes?.data,
                    poll
                };

                setPost(fullPost);
            } catch (e) {
                console.error("Error fetching post:", e);
                setError("Failed to load post");
            } finally {
                setLoading(false);
            }
        };

        fetchPost();
    }, [postId]);

    return (
        <div className={APP_BG}>
            <MobileTopbar />
            <main className={`${PAGE_MAIN} pb-20`}>
                <div className={LAYOUT_ROW}>
                    <Sidebar />
                    <div className="min-w-0 flex-1">
                        {/* Header */}
                        <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-zinc-800/50 bg-black/80 px-4 py-3 backdrop-blur-md">
                            <button
                                onClick={() => {
                                    // If opened in new tab, there's no history to go back to
                                    if (window.history.length > 1) {
                                        router.back();
                                    } else {
                                        router.push("/");
                                    }
                                }}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                            >
                                <ArrowLeftIcon className="h-5 w-5" />
                            </button>
                            <h1 className="text-lg font-semibold text-zinc-100">Post</h1>
                        </div>

                        {/* Content */}
                        {loading ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="mb-4 text-6xl">😕</div>
                                <h2 className="mb-2 text-xl font-semibold text-zinc-100">Post Not Found</h2>
                                <p className="mb-6 text-zinc-500">{error}</p>
                                <button
                                    onClick={() => router.push("/")}
                                    className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
                                >
                                    Go Home
                                </button>
                            </div>
                        ) : post ? (
                            <div className="border-b border-zinc-800/50">
                                <PostCard post={post} />
                            </div>
                        ) : null}
                    </div>
                    <RightRail />
                </div>
            </main>
        </div>
    );
}
