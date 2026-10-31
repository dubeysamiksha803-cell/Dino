"use client";

import { useEffect, useState } from "react";

type LinkMetadata = {
    title: string | null;
    description: string | null;
    image: string | null;
    siteName: string | null;
    url: string;
};

export default function LinkPreview({ url }: { url: string }) {
    const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!url) {
            setLoading(false);
            setError(true);
            return;
        }

        let cancelled = false;

        const fetchMetadata = async () => {
            try {
                // Use a metadata fetching API endpoint
                const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);

                if (!res.ok) {
                    if (!cancelled) setError(true);
                    return;
                }

                const data = await res.json();

                if (!cancelled) {
                    setMetadata({
                        title: data.title || null,
                        description: data.description || null,
                        image: data.image || null,
                        siteName: data.siteName || new URL(url).hostname.replace("www.", ""),
                        url: url,
                    });
                }
            } catch {
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchMetadata();
        return () => { cancelled = true; };
    }, [url]);

    // Extract domain for display
    const getDomain = (urlStr: string) => {
        try {
            const hostname = new URL(urlStr).hostname;
            return hostname.replace("www.", "");
        } catch {
            return urlStr;
        }
    };

    if (loading) {
        return (
            <div className="mt-2 w-[280px] animate-pulse rounded-xl border border-zinc-800/50 bg-neutral-950 p-3">
                <div className="mb-2 h-3 w-24 rounded bg-zinc-800" />
                <div className="space-y-1.5">
                    <div className="h-3 w-full rounded bg-zinc-800/60" />
                    <div className="h-3 w-4/5 rounded bg-zinc-800/60" />
                </div>
            </div>
        );
    }

    if (error || !metadata) {
        // Just show the URL as a clickable link without preview
        return null;
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="group mt-2 block w-[300px] overflow-hidden rounded-xl border border-zinc-800/50 bg-neutral-950 transition-all hover:border-zinc-700"
        >
            {/* Image preview */}
            {metadata.image && (
                <div className="relative h-36 w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={metadata.image}
                        alt=""
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        onError={(e) => {
                            e.currentTarget.style.display = "none";
                        }}
                    />
                </div>
            )}

            {/* Content */}
            <div className="p-3">
                {/* Site name */}
                <div className="mb-1 flex items-center gap-1.5 text-xs text-zinc-500">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                    </svg>
                    <span className="truncate">{metadata.siteName || getDomain(url)}</span>
                </div>

                {/* Title */}
                {metadata.title && (
                    <h4 className="mb-1 text-sm font-medium text-zinc-200 line-clamp-2 group-hover:text-white">
                        {metadata.title}
                    </h4>
                )}

                {/* Description */}
                {metadata.description && (
                    <p className="text-xs text-zinc-500 line-clamp-2">
                        {metadata.description}
                    </p>
                )}
            </div>
        </a>
    );
}
