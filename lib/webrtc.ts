export type LocalMedia = {
  stream: MediaStream;
  stop: () => void;
};

export async function getLocalMedia(audio: boolean, video: boolean): Promise<LocalMedia> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as MediaTrackConstraints : false,
    video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } as MediaTrackConstraints : false,
  });
  const stop = () => stream.getTracks().forEach(t => t.stop());
  return { stream, stop };
}

export async function resolveIceServers(): Promise<RTCIceServer[]> {
  // If an external ICE endpoint is provided, fetch from there (e.g., FastAPI on Render)
  const endpoint = process.env.NEXT_PUBLIC_ICE_ENDPOINT?.trim();
  if (endpoint) {
    const fetchWithTimeout = async (url: string, ms: number) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      try {
        const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
        if (!res.ok) throw new Error(`ICE ${res.status}`);
        return await res.json();
      } finally {
        clearTimeout(t);
      }
    };
    // Try once with a short timeout; if it fails, fall back to local defaults immediately
    try {
      const json = await fetchWithTimeout(endpoint, 3500);
      const servers = (json?.iceServers || []) as RTCIceServer[];
      if (Array.isArray(servers) && servers.length > 0) return servers;
    } catch {
      // fall through to local defaults
    }
  }

  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302'] },
    { urls: ['stun:global.stun.twilio.com:3478?transport=udp'] },
  ];
  const turnUrls = (process.env.NEXT_PUBLIC_TURN_URL || '').split(',').map(u => u.trim()).filter(Boolean);
  if (turnUrls.length > 0) {
    const username = process.env.NEXT_PUBLIC_TURN_USERNAME || '';
    const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '';
    if (username && credential) servers.push({ urls: turnUrls, username, credential });
    else servers.push({ urls: turnUrls });
  }
  return servers;
}

export function createPeerConnection(options?: { iceServers?: RTCIceServer[] }) {
  const defaultServers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302'] },
    { urls: ['stun:global.stun.twilio.com:3478?transport=udp'] },
  ];
  const turnUrls = (process.env.NEXT_PUBLIC_TURN_URL || '').split(',').map(u => u.trim()).filter(Boolean);
  if (turnUrls.length > 0) {
    const username = process.env.NEXT_PUBLIC_TURN_USERNAME || '';
    const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '';
    if (username && credential) {
      defaultServers.push({ urls: turnUrls, username, credential });
    } else {
      defaultServers.push({ urls: turnUrls });
    }
  }
  const pc = new RTCPeerConnection({
    iceServers: options?.iceServers ?? defaultServers,
  });
  return pc;
}

export async function createOffer(pc: RTCPeerConnection) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return offer;
}

export async function createAnswer(pc: RTCPeerConnection) {
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
}
