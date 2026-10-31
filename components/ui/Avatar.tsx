"use client";

import { edgeImageUrlFromS3 } from "@/lib/media";

export default function Avatar({
    src,
    name,
    size = 36,
    className = "",
    onClick,
    ring = true,
    interactive = true,
}: {
    src?: string | null;
    name?: string | null;
    size?: number; // px
    className?: string;
    onClick?: () => void;
    ring?: boolean;
    interactive?: boolean;
}) {
    const displaySrc = (() => {
        if (!src) return null;
        if (src.startsWith("s3://")) return edgeImageUrlFromS3(src);
        return src;
    })();

    const initials = (name ?? "").trim().charAt(0).toUpperCase() || "?";
    const style = { width: size, height: size } as React.CSSProperties;
    const ringClass = ring ? " ring-1 ring-zinc-800" : "";
    const baseClasses = `relative overflow-hidden rounded-full${ringClass} ${className}`;

    if (displaySrc) {
        return interactive ? (
            <button type="button" onClick={onClick} className={baseClasses} style={style}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={displaySrc} alt={name ?? "avatar"} className="h-full w-full object-cover" />
            </button>
        ) : (
            <div className={baseClasses} style={style}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={displaySrc} alt={name ?? "avatar"} className="h-full w-full object-cover" />
            </div>
        );
    }
    const content = (
        <div className={`flex items-center justify-center bg-zinc-800 text-zinc-200 ${baseClasses}`} style={style} aria-label={name ?? "avatar"}>
            <span className="text-sm font-medium">{initials}</span>
        </div>
    );
    if (!interactive) return content;
    return <button type="button" onClick={onClick} className="contents">{content}</button>;
}
