import type { SupabaseClient } from "@supabase/supabase-js";

export const EDGE_BASE = "https://mackvaasejtzfslxpdjf.supabase.co/functions/v1";
const USE_INVOKE_GET_IMAGE = (process.env.NEXT_PUBLIC_USE_INVOKE_GET_IMAGE ?? '').toLowerCase() === 'true';

export async function uploadImageBase64(
  imageData: string,
  fileName: string,
  userId: string,
  authToken?: string,
  apiKey?: string
): Promise<{ s3Url: string; contentType: string; size: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (apiKey) headers['apikey'] = apiKey;
  const res = await fetch(`${EDGE_BASE}/upload-image`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ imageData, fileName, userId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  return { s3Url: json.imageUrl as string, contentType: json.contentType as string, size: json.size as number };
}

export function edgeImageUrlFromS3(s3Url: string): string {
  const u = encodeURIComponent(s3Url);
  return `${EDGE_BASE}/get-image?url=${u}`;
}

// Try to retrieve an authenticated, displayable URL for an image via Supabase Functions invoke.
// Falls back to the GET proxy URL if invoke is unavailable or the edge function only supports GET.
export async function getImageDisplayUrl(
  supabase: SupabaseClient,
  s3Url: string
): Promise<string> {
  // Default to GET proxy unless explicitly enabled
  if (!USE_INVOKE_GET_IMAGE) return edgeImageUrlFromS3(s3Url);
  try {
    const { data, error } = await supabase.functions.invoke('get-image', {
      body: { url: s3Url },
    });
    if (error) throw error as Error;
    const out = (data ?? {}) as Record<string, unknown>;
    // Support multiple possible response shapes from the edge function
    const url = (out["signedUrl"] ?? out["url"] ?? out["displayUrl"]) as unknown;
    if (typeof url === 'string' && url.length > 0) return url;
    // If the function returned a base64/dataUrl
    const dataUrl = typeof out.dataUrl === 'string' ? (out.dataUrl as string) : undefined;
    if (dataUrl && dataUrl.startsWith('data:')) return dataUrl;
  } catch {
    // ignore and fallback
  }
  return edgeImageUrlFromS3(s3Url);
}
