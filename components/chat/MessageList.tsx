"use client";

import { Message, User } from "./types";
import MessageBubble from "./MessageBubble";
import ImageCluster from "./ImageCluster";
import { useEffect, useRef, useMemo } from "react";

type MessageGroup =
  | { type: 'single'; message: Message }
  | { type: 'image-cluster'; messages: Message[] };

export default function MessageList({
  me,
  messages,
  chatType,
  onDelete,
  onReply,
  onReact,
  onJump,
}: {
  me: User;
  messages: Message[];
  chatType?: "direct" | "group";
  onDelete?: (id: string) => void;
  onReply?: (id: string) => void;
  onReact?: (id: string, emoji: string) => void;
  onJump?: (id: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // Deduplicate by id
  const safeMessages = useMemo(() => {
    const seen = new Set<string>();
    const out: Message[] = [];
    for (const m of messages) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
    return out;
  }, [messages]);

  // Group consecutive images from the same sender
  const groupedMessages = useMemo(() => {
    const groups: MessageGroup[] = [];
    let currentImageCluster: Message[] = [];
    let lastSenderId: string | null = null;

    const flushCluster = () => {
      if (currentImageCluster.length > 0) {
        if (currentImageCluster.length === 1) {
          groups.push({ type: 'single', message: currentImageCluster[0] });
        } else {
          groups.push({ type: 'image-cluster', messages: [...currentImageCluster] });
        }
        currentImageCluster = [];
      }
    };

    for (const msg of safeMessages) {
      const isImage = msg.type === 'image' || msg.type === 'gif';

      if (isImage) {
        // Check if this continues the current cluster
        if (lastSenderId === msg.sender.id && currentImageCluster.length > 0) {
          currentImageCluster.push(msg);
        } else {
          // Flush previous cluster and start new one
          flushCluster();
          currentImageCluster = [msg];
          lastSenderId = msg.sender.id;
        }
      } else {
        // Non-image message - flush any pending cluster
        flushCluster();
        groups.push({ type: 'single', message: msg });
        lastSenderId = msg.sender.id;
      }
    }

    // Flush any remaining cluster
    flushCluster();

    return groups;
  }, [safeMessages]);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3 md:p-4">
      {groupedMessages.map((group) => {
        if (group.type === 'image-cluster') {
          return (
            <ImageCluster
              key={`cluster-${group.messages[0].id}`}
              messages={group.messages}
              isMe={group.messages[0].sender.id === me.id}
              chatType={chatType}
            />
          );
        } else {
          const m = group.message;
          return (
            <MessageBubble
              key={m.id}
              message={m}
              isMe={m.sender.id === me.id}
              chatType={chatType}
              onDelete={onDelete}
              onReply={onReply}
              onReact={onReact}
              onJump={(parentId: string) => {
                const el = document.getElementById(`msg-${parentId}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.animate([
                    { boxShadow: '0 0 0 0px rgba(99,102,241,0.0)' },
                    { boxShadow: '0 0 0 6px rgba(99,102,241,0.35)' },
                    { boxShadow: '0 0 0 0px rgba(99,102,241,0.0)' }
                  ], { duration: 900 });
                }
                onJump?.(parentId);
              }}
            />
          );
        }
      })}
      <div ref={bottomRef} />
    </div>
  );
}
