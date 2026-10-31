"use client";

import { Message } from "./types";
import { Trash2, Reply, X, Download, Check, CheckCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import Avatar from "@/components/ui/Avatar";
import SharedPostPreview from "./SharedPostPreview";
import LinkPreview from "./LinkPreview";

export default function MessageBubble({
  message,
  isMe,
  chatType,
  onDelete,
  onReply,
  onReact,
}: {
  message: Message;
  isMe: boolean;
  chatType?: "direct" | "group";
  onDelete?: (id: string) => void;
  onReply?: (id: string) => void;
  onReact?: (id: string, emoji: string) => void;
  onJump?: (id: string) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showReactionsPicker, setShowReactionsPicker] = useState(false);
  const reactionPickerRef = useRef<HTMLDivElement>(null);
  const reactionButtonRef = useRef<HTMLButtonElement>(null);

  // Close reaction picker when clicking outside
  useEffect(() => {
    if (!showReactionsPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        reactionPickerRef.current &&
        !reactionPickerRef.current.contains(e.target as Node) &&
        reactionButtonRef.current &&
        !reactionButtonRef.current.contains(e.target as Node)
      ) {
        setShowReactionsPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showReactionsPicker]);

  const timeLabel = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isMedia = message.type === "image" || message.type === "gif";
  const hasReply = Boolean(message.replyPreview);

  return (
    <div className={`group flex w-full ${isMe ? "justify-end" : "justify-start"} mb-2`}>
      {/* Avatar for receiver messages in group chats */}
      {chatType === "group" && !isMe && (
        <Avatar
          src={message.sender.avatarUrl}
          name={message.sender.username}
          size={32}
          interactive={false}
          className="mr-2 mt-1 shrink-0"
        />
      )}

      <div className={`relative ${isMe ? "order-2" : "order-1"} max-w-[72%]`}>
        {/* Sender name for group chats */}
        {chatType === "group" && !isMe && (
          <div className="mb-1 px-1">
            <span className="text-xs text-zinc-500">{message.sender.username}</span>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className={[
            "relative break-words",
            isMedia ? "" : "rounded-2xl px-3 py-2",
            isMedia ? "" : (isMe ? "bg-neutral-900" : "bg-neutral-950"),
            "text-zinc-100",
          ].join(" ")}
        >
          {/* Reply Preview - Compact inline style */}
          {hasReply && (
            <div className="mb-1.5 border-l-2 border-zinc-600 pl-2 opacity-70">
              <span className="text-xs text-zinc-400">{message.replyPreview!.author}: </span>
              <span className="text-xs text-zinc-500 truncate">{message.replyPreview!.content}</span>
            </div>
          )}

          {/* Text Content */}
          {message.type === "text" && (() => {
            // Check if this is a shared post
            const isSharedPost = message.content.startsWith("🔗 Shared a post:");

            if (isSharedPost) {
              // Parse the shared post URL to extract postId
              const lines = message.content.split("\n");
              const postUrlLine = lines.find(l => l.includes("/posts/"));
              const postUrl = postUrlLine?.trim() || "";
              const postId = postUrl.split("/posts/")[1]?.split("?")[0] || "";

              return (
                <>
                  <SharedPostPreview postId={postId} postUrl={postUrl} />
                  {/* Inline timestamp */}
                  <div className="mt-1.5 flex items-center justify-end gap-1">
                    {message.edited && (
                      <span className="text-[10px] text-zinc-600">edited</span>
                    )}
                    <span className="text-[10px] text-zinc-500">{timeLabel}</span>
                    {isMe && (
                      <span className="flex items-center text-zinc-500">
                        <Check className="h-3 w-3" />
                        {message.status === "read" && <Check className="h-3 w-3 -ml-1.5" />}
                      </span>
                    )}
                  </div>
                </>
              );
            }

            // Regular text message
            // Check for URLs in the message
            const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
            const urls = message.content.match(urlRegex) || [];
            const firstUrl = urls[0];

            // Render message content with clickable links
            // If there's a firstUrl with preview, hide that URL from the text
            const renderContent = (text: string) => {
              const parts = text.split(urlRegex);
              return parts.map((part, i) => {
                if (urlRegex.test(part)) {
                  urlRegex.lastIndex = 0; // Reset regex
                  // Hide the URL if it's the one being shown in preview
                  if (firstUrl && part === firstUrl) {
                    return null;
                  }
                  return (
                    <a
                      key={i}
                      href={part}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
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
                <div className="text-[15px] leading-snug whitespace-pre-wrap text-zinc-50">
                  {renderContent(message.content)}
                </div>
                {/* Link Preview for first URL */}
                {firstUrl && !message.content.startsWith("🔗 Shared a post:") && (
                  <LinkPreview url={firstUrl} />
                )}
                {/* Inline timestamp */}
                <div className="mt-0.5 flex items-center justify-end gap-1">
                  {message.edited && (
                    <span className="text-[10px] text-zinc-600">edited</span>
                  )}
                  <span className="text-[10px] text-zinc-500">{timeLabel}</span>
                  {isMe && (
                    <span className="ml-0.5 flex items-center">
                      {message.status === "read" ? (
                        <CheckCheck className="h-4 w-4 text-blue-400" />
                      ) : (
                        <Check className="h-3.5 w-3.5 text-zinc-500" />
                      )}
                    </span>
                  )}
                </div>
              </>
            );
          })()}

          {/* Image/GIF Content - Clean, no background */}
          {isMedia && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.content}
                alt={message.type}
                className="max-w-[280px] rounded-xl cursor-pointer object-cover"
                onClick={() => setPreviewOpen(true)}
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-white/80">
                {timeLabel}
                {isMe && (
                  <span className="flex items-center">
                    <Check className="h-3 w-3" />
                    {message.status === "read" && <Check className="h-3 w-3 -ml-1.5" />}
                  </span>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* Reactions */}
        {onReact && message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${isMe ? "justify-end" : "justify-start"}`}>
            {Object.entries(message.reactions)
              .filter(([, count]) => (count as number) > 0)
              .map(([emoji, count]) => (
                <span
                  key={emoji}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-0.5 text-xs"
                >
                  <span>{emoji}</span>
                  <span className="text-zinc-500">{count as number}</span>
                </span>
              ))}
          </div>
        )}

        {/* Hover Actions (float above bubble, no overlap with text) */}
        <div
          className={[
            "pointer-events-none absolute -top-7 z-40",
            isMe ? "right-0" : "left-0",
            showReactionsPicker ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            "transition-opacity",
          ].join(" ")}
        >
          <div className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-neutral-950 px-1.5 py-1 shadow-md border border-neutral-800/50">
            {onReact && (
              <button
                ref={reactionButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReactionsPicker(!showReactionsPicker);
                }}
                className="rounded-full px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-neutral-900 hover:text-zinc-200"
                title="React to message"
              >
                😊
              </button>
            )}

            {onReply && (
              <button
                onClick={() => onReply(message.id)}
                className="rounded-full px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-neutral-900 hover:text-zinc-200"
                title="Reply to message"
              >
                <Reply className="h-3 w-3" />
              </button>
            )}

            {isMe && onDelete && (
              <button
                onClick={() => onDelete(message.id)}
                className="rounded-full px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-950/60"
                title="Delete message"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Reactions Picker */}
        {showReactionsPicker && (
          <div
            ref={reactionPickerRef}
            className={[
              "absolute -top-12 z-50",
              isMe ? "right-0" : "left-0",
              "flex gap-1 rounded-full bg-neutral-900 p-1.5 shadow-xl border border-neutral-800/50",
            ].join(" ")}
          >
            {["❤️", "😂", "👍", "🔥", "😮", "😢"].map((emoji) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  onReact?.(message.id, emoji);
                  setShowReactionsPicker(false);
                }}
                className="p-1.5 hover:bg-neutral-800 rounded-full text-lg transition-transform hover:scale-110"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Image Preview Modal */}
      {previewOpen && isMedia && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={() => setPreviewOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setPreviewOpen(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setPreviewOpen(false)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900/80 text-zinc-300 transition hover:bg-neutral-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Download button */}
          <a
            href={message.content}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute right-16 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900/80 text-zinc-300 transition hover:bg-neutral-800 hover:text-white"
          >
            <Download className="h-5 w-5" />
          </a>

          {/* Image container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 25 }}
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.content}
              alt={message.type}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />

            {/* Image info */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm text-zinc-300 backdrop-blur-sm">
              <span className="font-medium">{message.sender.username}</span>
              <span className="mx-2 text-zinc-500">•</span>
              <span className="text-zinc-400">{timeLabel}</span>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
