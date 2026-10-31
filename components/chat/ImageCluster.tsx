"use client";

import { Message } from "./types";
import { X, Download } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

export default function ImageCluster({
    messages,
    isMe,
    chatType,
}: {
    messages: Message[];
    isMe: boolean;
    chatType?: "direct" | "group";
    onImageClick?: (message: Message) => void;
}) {
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const count = messages.length;
    const firstMessage = messages[0];

    const timeLabel = new Date(messages[messages.length - 1].createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });

    // Grid layout based on image count
    const getGridClass = () => {
        if (count === 1) return "grid-cols-1";
        if (count === 2) return "grid-cols-2";
        if (count === 3) return "grid-cols-2";
        if (count === 4) return "grid-cols-2";
        return "grid-cols-3";
    };

    const getImageClass = (index: number) => {
        if (count === 1) return "rounded-xl max-h-72 w-full object-cover";
        if (count === 3 && index === 0) return "col-span-2 row-span-1 h-32 w-full object-cover rounded-tl-xl rounded-tr-xl";
        if (count === 3 && index === 1) return "h-24 w-full object-cover rounded-bl-xl";
        if (count === 3 && index === 2) return "h-24 w-full object-cover rounded-br-xl";

        // For 2, 4, or 5+ images
        const isFirst = index === 0;
        const isSecond = index === 1;
        const isThird = index === 2;
        const isFourth = index === 3;

        if (count === 2) {
            return `h-36 w-full object-cover ${isFirst ? 'rounded-l-xl' : 'rounded-r-xl'}`;
        }

        if (count === 4) {
            if (isFirst) return "h-28 w-full object-cover rounded-tl-xl";
            if (isSecond) return "h-28 w-full object-cover rounded-tr-xl";
            if (isThird) return "h-28 w-full object-cover rounded-bl-xl";
            if (isFourth) return "h-28 w-full object-cover rounded-br-xl";
        }

        // 5+ images
        return "h-24 w-full object-cover";
    };

    const openPreview = (index: number) => {
        setPreviewIndex(index);
    };

    const closePreview = () => {
        setPreviewIndex(null);
    };

    const navigatePreview = (direction: 'prev' | 'next') => {
        if (previewIndex === null) return;
        if (direction === 'prev' && previewIndex > 0) {
            setPreviewIndex(previewIndex - 1);
        } else if (direction === 'next' && previewIndex < count - 1) {
            setPreviewIndex(previewIndex + 1);
        }
    };

    return (
        <>
            <div className={`group flex w-full ${isMe ? "justify-end" : "justify-start"} mb-2`}>
                <div className={`relative ${isMe ? "order-2" : "order-1"} max-w-[320px]`}>
                    {/* Sender name for group chats */}
                    {chatType === "group" && !isMe && (
                        <div className="mb-1 px-1">
                            <span className="text-xs text-zinc-500">{firstMessage.sender.username}</span>
                        </div>
                    )}

                    {/* Image Grid */}
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 24 }}
                        className={`grid ${getGridClass()} gap-0.5 overflow-hidden rounded-2xl border border-neutral-800/40 bg-neutral-950 shadow-md`}
                    >
                        {messages.slice(0, 5).map((msg, index) => (
                            <div
                                key={msg.id}
                                className="relative cursor-pointer overflow-hidden"
                                onClick={() => openPreview(index)}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={msg.content}
                                    alt={`image ${index + 1}`}
                                    className={`${getImageClass(index)} transition hover:scale-105`}
                                />
                                {/* Show +N overlay for extra images */}
                                {index === 4 && count > 5 && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xl font-semibold text-white">
                                        +{count - 5}
                                    </div>
                                )}
                            </div>
                        ))}
                    </motion.div>

                    {/* Timestamp */}
                    <div className={`mt-1 flex ${isMe ? "justify-end" : "justify-start"} px-1`}>
                        <span className="text-[10px] text-zinc-500">
                            {count} photo{count > 1 ? 's' : ''} • {timeLabel}
                        </span>
                    </div>
                </div>
            </div>

            {/* Fullscreen Preview Modal with Gallery */}
            {previewIndex !== null && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
                    onClick={closePreview}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") closePreview();
                        if (e.key === "ArrowLeft") navigatePreview('prev');
                        if (e.key === "ArrowRight") navigatePreview('next');
                    }}
                >
                    {/* Close button */}
                    <button
                        onClick={closePreview}
                        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900/80 text-zinc-300 transition hover:bg-neutral-800 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    {/* Download button */}
                    <a
                        href={messages[previewIndex].content}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-16 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900/80 text-zinc-300 transition hover:bg-neutral-800 hover:text-white"
                    >
                        <Download className="h-5 w-5" />
                    </a>

                    {/* Navigation arrows */}
                    {previewIndex > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); navigatePreview('prev'); }}
                            className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-900/80 text-2xl text-zinc-300 transition hover:bg-neutral-800 hover:text-white"
                        >
                            ‹
                        </button>
                    )}
                    {previewIndex < count - 1 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); navigatePreview('next'); }}
                            className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-900/80 text-2xl text-zinc-300 transition hover:bg-neutral-800 hover:text-white"
                        >
                            ›
                        </button>
                    )}

                    {/* Image */}
                    <motion.div
                        key={previewIndex}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", damping: 25 }}
                        className="relative max-h-[90vh] max-w-[90vw]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={messages[previewIndex].content}
                            alt={`preview ${previewIndex + 1}`}
                            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                        />
                    </motion.div>

                    {/* Image counter */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm text-zinc-300 backdrop-blur-sm">
                        {previewIndex + 1} / {count}
                    </div>

                    {/* Thumbnail strip */}
                    <div className="absolute bottom-16 left-1/2 flex -translate-x-1/2 gap-2">
                        {messages.map((msg, idx) => (
                            <button
                                key={msg.id}
                                onClick={(e) => { e.stopPropagation(); setPreviewIndex(idx); }}
                                className={`h-12 w-12 overflow-hidden rounded-lg border-2 transition ${idx === previewIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                                    }`}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={msg.content} alt="" className="h-full w-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
