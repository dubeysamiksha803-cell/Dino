"use client";

import Avatar from "@/components/ui/Avatar";
import {
  toggleLike,
  toggleBookmark,
  toggleRepost,
  votePoll,
  type PostWithExtras,
  type Poll,
  listCommentsForPost,
  addCommentToPost,
  type Comment,
  updateComment,
  deleteComment,
} from "@/lib/posts";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState, useRef } from "react";
import {
  EllipsisHorizontalIcon,
  HeartIcon as HeartIconOutline,
  ChatBubbleLeftIcon,
  ArrowPathRoundedSquareIcon,
  BookmarkIcon as BookmarkIconOutline,
  FlagIcon,
} from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid, BookmarkIcon as BookmarkIconSolid } from "@heroicons/react/24/solid";
import LinkPreview from "./LinkPreview";
import SharePostModal from "./SharePostModal";

export default function PostCard({ post }: { post: PostWithExtras }) {
  const [likeCount, setLikeCount] = useState(post.like_count ?? 0);
  const [liked, setLiked] = useState(post.liked_by_me ?? false);
  const [liking, setLiking] = useState(false);
  const author = post.author;
  const mediaList = (post.media ?? []).map((m) => m.file_url);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const isVideo = (u: string) => /\.(mp4|webm|ogg|mov|m4v)$/i.test(u);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(post.bookmarked_by_me ?? false);
  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [repostCount, setRepostCount] = useState(post.repost_count ?? 0);
  const [reposted, setReposted] = useState(post.reposted_by_me ?? false);
  const [reposting, setReposting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Poll state
  const [poll, setPoll] = useState<Poll | null>(post.poll ?? null);
  const [voting, setVoting] = useState(false);

  // Sync props to state when they change (e.g., after re-fetch with user ID)
  useEffect(() => {
    setLiked(post.liked_by_me ?? false);
  }, [post.liked_by_me]);

  useEffect(() => {
    setBookmarked(post.bookmarked_by_me ?? false);
  }, [post.bookmarked_by_me]);

  useEffect(() => {
    setLikeCount(post.like_count ?? 0);
  }, [post.like_count]);

  useEffect(() => {
    setCommentCount(post.comment_count ?? 0);
  }, [post.comment_count]);

  useEffect(() => {
    setReposted(post.reposted_by_me ?? false);
  }, [post.reposted_by_me]);

  useEffect(() => {
    setRepostCount(post.repost_count ?? 0);
  }, [post.repost_count]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setCurrentUserId(data.session?.user.id ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Sync poll from props
  useEffect(() => {
    setPoll(post.poll ?? null);
  }, [post.poll]);

  // Handle poll vote
  const onVote = async (optionId: string) => {
    if (!currentUserId || voting || !poll) return;
    setVoting(true);
    try {
      const res = await votePoll(optionId, currentUserId);
      // Optimistically update poll state
      setPoll(prev => {
        if (!prev) return prev;
        const wasVoted = prev.user_voted.includes(optionId);
        const newUserVoted = wasVoted
          ? prev.user_voted.filter(id => id !== optionId)
          : [...prev.user_voted, optionId];
        const newOptions = prev.options.map(opt => ({
          ...opt,
          vote_count: opt.id === optionId
            ? opt.vote_count + (res.voted ? 1 : -1)
            : opt.vote_count
        }));
        return {
          ...prev,
          user_voted: newUserVoted,
          total_votes: prev.total_votes + (res.voted ? 1 : -1),
          options: newOptions,
        };
      });
    } catch {
      // swallow for now
    } finally {
      setVoting(false);
    }
  };

  // Bookmark state is now initialized from post.bookmarked_by_me

  const onLike = async () => {
    setLiking(true);
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;
      const res = await toggleLike(post.id, user.id);
      setLiked(res.liked);
      setLikeCount((c) => c + (res.liked ? 1 : -1));
    } finally {
      setLiking(false);
    }
  };

  const onToggleBookmark = async () => {
    const userId = currentUserId;
    if (!userId) return;
    try {
      const res = await toggleBookmark(post.id, userId);
      setBookmarked(res.bookmarked);
    } catch {
      // swallow for now; could show toast
    }
  };

  const onRepost = async () => {
    const userId = currentUserId;
    if (!userId || reposting) return;
    setReposting(true);
    try {
      const res = await toggleRepost(post.id, userId);
      setReposted(res.reposted);
      setRepostCount((c) => c + (res.reposted ? 1 : -1));
    } catch {
      // swallow for now; could show toast
    } finally {
      setReposting(false);
    }
  };

  useEffect(() => {
    if (!commentsOpen) return;
    let cancelled = false;
    (async () => {
      setCommentsLoading(true);
      try {
        const data = await listCommentsForPost(post.id, 50);
        if (!cancelled) setComments(data);
      } catch {
        if (!cancelled) setComments([]);
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [commentsOpen, post.id]);

  const onSubmitComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    setCommentSubmitting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;
      const parentId = replyTo?.id ?? null;

      if (editingCommentId) {
        await updateComment(editingCommentId, user.id, trimmed);
        setComments((prev) => {
          const updateTree = (items: Comment[]): Comment[] =>
            items.map((c) => {
              if (c.id === editingCommentId) {
                return { ...c, content: trimmed };
              }
              if (c.replies && c.replies.length > 0) {
                return { ...c, replies: updateTree(c.replies) };
              }
              return c;
            });
          return updateTree(prev);
        });
      } else {
        const newComment = await addCommentToPost(post.id, user.id, trimmed, parentId);
        setComments((prev) => {
          if (!parentId) return [...prev, newComment];
          return prev.map((c) => {
            if (c.id === parentId) {
              const replies = [...(c.replies ?? []), newComment];
              return { ...c, replies };
            }
            return c;
          });
        });
      }
      setCommentText("");
      setReplyTo(null);
      setEditingCommentId(null);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) return;
    try {
      await deleteComment(commentId, user.id);
      setComments((prev) => {
        const removeFromTree = (items: Comment[]): Comment[] =>
          items
            .filter((c) => c.id !== commentId)
            .map((c) => ({
              ...c,
              replies: c.replies ? removeFromTree(c.replies) : [],
            }));
        return removeFromTree(prev);
      });
    } catch {
      // swallow for now; could show toast
    }
  };

  return (
    <>
      <article className="rounded-lg bg-[#0a0a0a] p-5 text-slate-200 shadow-sm shadow-white/5 border border-white/5 transition-all duration-200 hover:bg-[#121212]">
        <header className="mb-2 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar src={author?.avatar_url ?? null} name={author?.username ?? "User"} size={40} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-semibold text-white">{author?.username ?? post.author_id}</div>
                <span className="text-xs text-slate-500">• {new Date(post.created_at).toLocaleDateString()}</span>
              </div>
              <div className="text-xs text-slate-500">@{(author?.username ?? 'user').toLowerCase()}</div>
            </div>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              aria-label="More"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-lg p-2 text-slate-500 transition-colors duration-200 hover:bg-white/5 hover:text-slate-300"
            >
              <EllipsisHorizontalIcon className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/40">
                {/* Copy Link Option */}
                <button
                  type="button"
                  onClick={() => {
                    const postUrl = `${window.location.origin}/posts/${post.id}`;
                    navigator.clipboard.writeText(postUrl);
                    setLinkCopied(true);
                    setTimeout(() => {
                      setLinkCopied(false);
                      setMenuOpen(false);
                    }, 1500);
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  {linkCopied ? (
                    <>
                      <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-emerald-400">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Copy Post Link
                    </>
                  )}
                </button>

                {/* Share to Chat Option */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setShareModalOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                  Share to Chat
                </button>

                {/* Divider */}
                <div className="my-1 border-t border-zinc-800" />

                {/* Report Option */}
                {reportSubmitted ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-emerald-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Report submitted
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setReportSubmitted(true);
                      setTimeout(() => {
                        setMenuOpen(false);
                        setReportSubmitted(false);
                      }, 1500);
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-red-400 transition-colors hover:bg-zinc-800"
                  >
                    <FlagIcon className="h-4 w-4" />
                    Report Post
                  </button>
                )}
              </div>
            )}
          </div>
        </header>
        {post.content && (() => {
          // URL detection regex
          const urlRegex = /(https?:\/\/[^\s]+)|((?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z]{2,})+(?:\/[^\s]*)?)/gi;
          const urls = post.content.match(urlRegex) || [];
          const firstUrl = urls[0] || null;

          // Render content with clickable links
          // If there's a firstUrl with preview, hide that URL from the text
          const renderContentWithLinks = (text: string) => {
            const parts = text.split(urlRegex).filter(Boolean);
            return parts.map((part, i) => {
              if (urlRegex.test(part)) {
                urlRegex.lastIndex = 0; // Reset regex
                // Hide the URL if it's the one being shown in preview
                if (firstUrl && (part === firstUrl || part === firstUrl.replace(/^https?:\/\//, ''))) {
                  return null;
                }
                const href = part.startsWith('http') ? part : `https://${part}`;
                return (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {part}
                  </a>
                );
              }
              return part;
            });
          };

          return (
            <>
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-100">
                {renderContentWithLinks(post.content)}
              </div>
              {firstUrl && <LinkPreview url={firstUrl} />}
            </>
          );
        })()}

        {/* Poll Display */}
        {post.post_type === "poll" && poll && (
          <div className="mt-3 space-y-2">
            {poll.options.map((opt) => {
              const pct = poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
              const isVoted = poll.user_voted.includes(opt.id);
              const hasVoted = poll.user_voted.length > 0;

              return (
                <button
                  key={opt.id}
                  onClick={() => onVote(opt.id)}
                  disabled={voting}
                  className={`relative w-full overflow-hidden rounded-lg border transition-all ${isVoted
                    ? "border-indigo-500/50 bg-indigo-500/10"
                    : "border-zinc-700/50 bg-zinc-800/40 hover:border-zinc-600 hover:bg-zinc-800/60"
                    }`}
                >
                  {/* Progress bar background */}
                  {hasVoted && (
                    <div
                      className={`absolute inset-y-0 left-0 transition-all duration-500 ${isVoted ? "bg-indigo-500/20" : "bg-zinc-700/30"
                        }`}
                      style={{ width: `${pct}%` }}
                    />
                  )}

                  <div className="relative flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isVoted && (
                        <svg className="h-4 w-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      <span className={`text-sm ${isVoted ? "font-medium text-indigo-300" : "text-zinc-300"}`}>
                        {opt.option_text}
                      </span>
                    </div>
                    {hasVoted && (
                      <span className={`text-sm font-medium ${isVoted ? "text-indigo-400" : "text-zinc-500"}`}>
                        {pct}%
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>{poll.total_votes} vote{poll.total_votes !== 1 ? "s" : ""}</span>
              {poll.closes_at && (
                <span>Ends {new Date(poll.closes_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        )}

        {post.media && post.media.length > 0 && (
          <div className="mt-3 w-full max-w-xs mx-auto">
            {(() => {
              const count = post.media!.length;
              const current = post.media![previewIndex % count];
              const idx = previewIndex % count;
              const v = isVideo(current.file_url);
              return (
                <div className="relative overflow-hidden rounded-lg bg-black border border-white/5">
                  {v ? (
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      className="aspect-square w-full object-cover"
                      crossOrigin="anonymous"
                    >
                      <source src={current.file_url} />
                    </video>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setPreviewIndex(idx); setPreviewOpen(true); }}
                      className="block w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    >
                      <div className="relative aspect-square w-full overflow-hidden">
                        <div
                          className={`absolute inset-0 bg-gradient-to-br from-zinc-900/60 to-zinc-800/40 ${loaded[idx] ? "opacity-0" : "opacity-100"
                            } transition-opacity`}
                        ></div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={current.file_url}
                          alt="media"
                          className={`h-full w-full object-cover transition duration-300 ${loaded[idx] ? "scale-100 blur-0 opacity-100" : "scale-105 blur-sm opacity-80"
                            }`}
                          loading="lazy"
                          decoding="async"
                          sizes="(max-width: 640px) 100vw, 50vw"
                          referrerPolicy="no-referrer-when-downgrade"
                          crossOrigin="anonymous"
                          onLoad={() => setLoaded((s) => ({ ...s, [idx]: true }))}
                        />
                      </div>
                    </button>
                  )}
                  {count > 1 && (
                    <>
                      {/* index badge */}
                      <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-zinc-100">
                        {idx + 1}/{count}
                      </div>
                      {/* navigation arrows */}
                      <button
                        type="button"
                        aria-label="Previous"
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-xs text-zinc-100 backdrop-blur hover:bg-black/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewIndex((i) => (i - 1 + count) % count);
                        }}
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        aria-label="Next"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-xs text-zinc-100 backdrop-blur hover:bg-black/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewIndex((i) => (i + 1) % count);
                        }}
                      >
                        ›
                      </button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}
        <div className="mt-4 pt-3">
          <footer className="flex items-center justify-between text-slate-500">
            <button
              title="Like"
              onClick={onLike}
              disabled={liking}
              className={`group inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-200 hover:bg-white/5 ${liked ? "text-pink-500" : "hover:text-pink-400"}`}
            >
              {liked ? <HeartIconSolid className="h-5 w-5 text-pink-500" /> : <HeartIconOutline className="h-5 w-5" />}
              <span>{likeCount}</span>
            </button>
            <button
              title="Comment"
              onClick={() => setCommentsOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-200 hover:bg-white/5 hover:text-sky-400"
            >
              <ChatBubbleLeftIcon className="h-5 w-5" />
              <span>{commentsOpen ? comments.length : (commentCount || "")}</span>
            </button>
            <button
              title="Repost"
              onClick={onRepost}
              disabled={reposting}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-200 hover:bg-white/5 ${reposted ? "text-emerald-400" : "hover:text-emerald-400"}`}
            >
              <ArrowPathRoundedSquareIcon className={`h-5 w-5 ${reposted ? "text-emerald-400" : ""}`} />
              <span>{repostCount || ""}</span>
            </button>
            <button
              title="Save"
              onClick={onToggleBookmark}
              className={`inline-flex items-center rounded-lg p-2 text-sm transition-colors duration-200 hover:bg-white/5 ${bookmarked ? "text-amber-400" : "hover:text-amber-400"}`}
            >
              {bookmarked ? <BookmarkIconSolid className="h-5 w-5 text-amber-400" /> : <BookmarkIconOutline className="h-5 w-5" />}
            </button>
          </footer>
          {/* Comments preview + thread */}
          {comments.length > 0 && !commentsOpen && (
            <div className="mt-2 space-y-1 text-[11px] text-zinc-400">
              <button
                type="button"
                onClick={() => setCommentsOpen(true)}
                className="text-left text-[11px] font-medium text-zinc-400 hover:text-zinc-200"
              >
                View all {comments.length} comment{comments.length === 1 ? "" : "s"}
              </button>
              {/* Show the latest comment as a preview */}
              {(() => {
                const last = comments[comments.length - 1];
                if (!last) return null;
                return (
                  <div className="truncate text-zinc-300">
                    <span className="font-medium mr-1">{last.author?.username ?? last.author_id}:</span>
                    <span>{last.content}</span>
                  </div>
                );
              })()}
            </div>
          )}
          {commentsOpen && (
            <div className="mt-2 rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-2">
              {/* Comments Header */}
              <div className="mb-2 flex items-center gap-2">
                <ChatBubbleLeftIcon className="h-4 w-4 text-zinc-400" />
                <span className="text-xs font-medium text-zinc-200">Comments</span>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
                  {comments.length}
                </span>
              </div>

              {/* Comments List */}
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-track]:bg-transparent">
                {commentsLoading && (
                  <div className="flex items-center justify-center py-6">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-500" />
                  </div>
                )}
                {!commentsLoading && comments.length === 0 && (
                  <div className="py-6 text-center">
                    <p className="text-sm text-zinc-500">No comments yet</p>
                    <p className="mt-1 text-xs text-zinc-600">Be the first to share your thoughts!</p>
                  </div>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="group rounded-lg bg-zinc-800/40 p-2 transition-colors hover:bg-zinc-800/60">
                    <div className="flex gap-2">
                      {/* Avatar */}
                      <div className="relative h-6 w-6 flex-none">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[1.5px]">
                          <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                            {c.author?.username?.[0]?.toUpperCase() ?? "U"}
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="truncate text-xs font-semibold text-zinc-100">{c.author?.username ?? c.author_id}</span>
                          <span className="text-[10px] text-zinc-500">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-snug text-zinc-300">{c.content}</p>

                        {/* Actions */}
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyTo({ id: c.id, username: c.author?.username ?? c.author_id });
                              setCommentText(prev => prev.startsWith("@" + (c.author?.username ?? c.author_id)) ? prev : `@${c.author?.username ?? c.author_id} `);
                            }}
                            className="font-medium text-zinc-500 transition-colors hover:text-indigo-400"
                          >
                            Reply
                          </button>
                          {currentUserId && c.author_id === currentUserId && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCommentId(c.id);
                                  setReplyTo(null);
                                  setCommentText(c.content);
                                }}
                                className="font-medium text-zinc-500 transition-colors hover:text-amber-400"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(c.id)}
                                className="font-medium text-zinc-500 transition-colors hover:text-red-400"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Replies */}
                    {c.replies && c.replies.length > 0 && (
                      <div className="ml-8 mt-2 space-y-1.5 border-l-2 border-zinc-700/50 pl-3">
                        {c.replies.map((r) => (
                          <div key={r.id} className="rounded-lg bg-zinc-800/30 p-2 transition-colors hover:bg-zinc-800/50">
                            <div className="flex gap-2">
                              {/* Reply Avatar */}
                              <div className="relative h-5 w-5 flex-none">
                                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 p-[1.5px]">
                                  <div className="flex h-full w-full items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">
                                    {r.author?.username?.[0]?.toUpperCase() ?? "U"}
                                  </div>
                                </div>
                              </div>

                              {/* Reply Content */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="truncate text-[11px] font-semibold text-zinc-200">{r.author?.username ?? r.author_id}</span>
                                  <span className="text-[10px] text-zinc-500">{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="mt-0.5 whitespace-pre-wrap text-xs leading-snug text-zinc-400">{r.content}</p>

                                {/* Reply Actions */}
                                <div className="mt-1.5 flex items-center gap-2.5 text-[10px]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyTo({ id: c.id, username: r.author?.username ?? r.author_id });
                                      setCommentText(prev => prev.startsWith("@" + (r.author?.username ?? r.author_id)) ? prev : `@${r.author?.username ?? r.author_id} `);
                                    }}
                                    className="font-medium text-zinc-500 transition-colors hover:text-indigo-400"
                                  >
                                    Reply
                                  </button>
                                  {currentUserId && r.author_id === currentUserId && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCommentId(r.id);
                                          setReplyTo(null);
                                          setCommentText(r.content);
                                        }}
                                        className="font-medium text-zinc-500 transition-colors hover:text-amber-400"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(r.id)}
                                        className="font-medium text-zinc-500 transition-colors hover:text-red-400"
                                      >
                                        Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Comment Input */}
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-2 transition-colors focus-within:border-indigo-500/50 focus-within:bg-zinc-800/60">
                {replyTo && (
                  <div className="flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-2.5 py-1 text-xs text-indigo-300">
                    <span>Replying to @{replyTo.username}</span>
                    <button type="button" onClick={() => { setReplyTo(null); setCommentText(""); }} className="ml-1 hover:text-white">×</button>
                  </div>
                )}
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={replyTo ? "Write your reply..." : "Write a comment..."}
                  className="h-8 flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSubmitComment(); } }}
                  disabled={commentSubmitting}
                />
                <button
                  type="button"
                  onClick={onSubmitComment}
                  disabled={commentSubmitting || !commentText.trim()}
                  className="rounded-lg bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
                >
                  {commentSubmitting ? "..." : "Post"}
                </button>
              </div>
            </div>
          )}
        </div>
      </article>
      {previewOpen && mediaList.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewOpen(false)}>
          <div className="relative max-h-[90vh] w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              aria-label="Close preview"
              className="absolute right-2 top-2 rounded-md bg-zinc-900/70 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800/80"
              onClick={() => setPreviewOpen(false)}
            >Close</button>
            {isVideo(mediaList[previewIndex]) ? (
              <video controls autoPlay preload="metadata" className="max-h-[90vh] w-full rounded-lg object-contain" crossOrigin="anonymous">
                <source src={mediaList[previewIndex]} />
              </video>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaList[previewIndex]}
                alt="preview"
                className="max-h-[90vh] w-full rounded-lg object-contain"
                loading="eager"
                decoding="async"
                referrerPolicy="no-referrer-when-downgrade"
                crossOrigin="anonymous"
              />
            )}
            {mediaList.length > 1 && (
              <>
                <button
                  aria-label="Previous"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-zinc-900/70 p-2 text-zinc-200 hover:bg-zinc-800/80"
                  onClick={() => setPreviewIndex((i) => (i - 1 + mediaList.length) % mediaList.length)}
                >‹</button>
                <button
                  aria-label="Next"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-zinc-900/70 p-2 text-zinc-200 hover:bg-zinc-800/80"
                  onClick={() => setPreviewIndex((i) => (i + 1) % mediaList.length)}
                >›</button>
              </>
            )}
          </div>
        </div>
      )}
      <SharePostModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        postId={post.id}
        postContent={post.content ?? undefined}
      />
    </>
  );
}
