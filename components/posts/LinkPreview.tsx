"use client";

import { useEffect, useState } from "react";

type LinkPreviewData = {
    url: string;
    title: string;
    description: string | null;
    image: string | null;
    siteName: string;
    favicon: string | null;
    domain: string;
};

export default function LinkPreview({ url }: { url: string }) {
    const [data, setData] = useState<LinkPreviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const fetchPreview = async () => {
            setLoading(true);
            setError(false);
            try {
                const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
                if (!res.ok) throw new Error("Failed to fetch");
                const json = await res.json();
                if (!cancelled) {
                    setData(json);
                }
            } catch {
                if (!cancelled) {
                    setError(true);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchPreview();
        return () => {
            cancelled = true;
        };
    }, [url]);

    if (loading) {
        return (
            <div className="mt-3 animate-pulse rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-4">
                <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 rounded bg-zinc-800" />
                        <div className="h-3 w-full rounded bg-zinc-800/60" />
                        <div className="h-3 w-2/3 rounded bg-zinc-800/60" />
                    </div>
                    <div className="h-20 w-32 flex-none rounded-lg bg-zinc-800" />
                </div>
            </div>
        );
    }

    if (error || !data) {
        return null;
    }

    return (
        <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-3 flex overflow-hidden rounded-xl border border-zinc-800/50 bg-zinc-900/50 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
        >
            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col justify-center p-4">
                {/* Domain */}
                <div className="mb-1.5 flex items-center gap-2 text-xs text-zinc-500">
                    {data.favicon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={data.favicon}
                            alt=""
                            className="h-4 w-4 rounded"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                            }}
                        />
                    )}
                    <span className="truncate">{data.domain}</span>
                </div>

                {/* Title */}
                <h4 className="line-clamp-2 text-sm font-semibold text-zinc-100 transition-colors group-hover:text-white">
                    {data.title}
                </h4>

                {/* Description */}
                {data.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                        {data.description}
                    </p>
                )}
            </div>

            {/* Image */}
            {data.image && (
                <div className="relative h-24 w-32 flex-none sm:h-28 sm:w-40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={data.image}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).parentElement!.style.display = "none";
                        }}
                    />
                </div>
            )}
        </a>
    );
}
