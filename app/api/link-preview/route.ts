import { NextRequest, NextResponse } from "next/server";

// Helper to detect YouTube URLs
function isYouTubeUrl(url: string) {
    const patterns = [
        /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/
    ];
    return patterns.some(pattern => pattern.test(url));
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    let url = searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "url parameter is required" }, { status: 400 });
    }

    // Prepend https if no protocol specified
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`;
    }

    try {
        // Validate URL
        const parsedUrl = new URL(url);

        // Fetch the page with a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        // Special handling for YouTube via oEmbed
        if (isYouTubeUrl(url)) {
            try {
                const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
                const oembedRes = await fetch(oembedUrl);
                if (oembedRes.ok) {
                    const data = await oembedRes.json();
                    return NextResponse.json({
                        url,
                        title: data.title,
                        description: data.author_name ? `Video by ${data.author_name}` : "YouTube Video",
                        image: data.thumbnail_url,
                        siteName: "YouTube",
                        favicon: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png",
                        domain: "youtube.com",
                    });
                }
            } catch (e) {
                console.error("YouTube oEmbed failed, falling back to scraping:", e);
                // Fallback to standard scraping if oEmbed fails
            }
        }

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
        }

        const html = await response.text();

        // Parse Open Graph and meta tags
        const getMetaContent = (property: string): string | null => {
            // Try og: tags first
            const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, "i"))
                || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, "i"));
            if (ogMatch) return ogMatch[1];

            // Try twitter: tags
            const twitterMatch = html.match(new RegExp(`<meta[^>]*name=["']twitter:${property}["'][^>]*content=["']([^"']*)["']`, "i"))
                || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']twitter:${property}["']`, "i"));
            if (twitterMatch) return twitterMatch[1];

            // Try standard meta tags for description
            if (property === "description") {
                const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
                    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
                if (descMatch) return descMatch[1];
            }

            return null;
        };

        // Get title from og:title or <title> tag
        let title = getMetaContent("title");
        if (!title) {
            const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
            title = titleMatch ? titleMatch[1].trim() : null;
        }

        const description = getMetaContent("description");
        let image = getMetaContent("image");
        const siteName = getMetaContent("site_name");

        // Make image URL absolute if relative
        if (image && !image.startsWith("http")) {
            if (image.startsWith("//")) {
                image = `https:${image}`;
            } else if (image.startsWith("/")) {
                image = `${parsedUrl.origin}${image}`;
            } else {
                image = `${parsedUrl.origin}/${image}`;
            }
        }

        // Get favicon
        let favicon: string | null = null;
        const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i)
            || html.match(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["'](?:shortcut )?icon["']/i);
        if (faviconMatch) {
            favicon = faviconMatch[1];
            if (!favicon.startsWith("http")) {
                if (favicon.startsWith("//")) {
                    favicon = `https:${favicon}`;
                } else if (favicon.startsWith("/")) {
                    favicon = `${parsedUrl.origin}${favicon}`;
                } else {
                    favicon = `${parsedUrl.origin}/${favicon}`;
                }
            }
        } else {
            // Default to /favicon.ico
            favicon = `${parsedUrl.origin}/favicon.ico`;
        }

        return NextResponse.json({
            url,
            title: title || parsedUrl.hostname,
            description: description || null,
            image: image || null,
            siteName: siteName || parsedUrl.hostname,
            favicon,
            domain: parsedUrl.hostname,
        });
    } catch {
        // Return minimal info on error
        try {
            const parsedUrl = new URL(url);
            return NextResponse.json({
                url,
                title: parsedUrl.hostname,
                description: null,
                image: null,
                siteName: parsedUrl.hostname,
                favicon: `${parsedUrl.origin}/favicon.ico`,
                domain: parsedUrl.hostname,
            });
        } catch {
            return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
        }
    }
}
