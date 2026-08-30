/**
 * youtube-reels.ts — Citește o playlistă YouTube via YouTube Data API v3.
 * Folosit pentru a alimenta automat feed-ul de Reels (/shorts/) dintr-o
 * playlistă gestionată direct pe canalul YouTube. Când adaugi/scoți un short
 * din playlistă, site-ul se actualizează singur (cache 30 min), fără cod.
 *
 * Necesită o cheie YouTube Data API v3 în env: YOUTUBE_API_KEY.
 * Endpoint: GET /youtube/v3/playlistItems?part=snippet&playlistId=...&key=...
 * (RSS-ul public YouTube nu e folosit — e blocat pe multe IP-uri de server.)
 *
 * Rezultatul e păstrat într-un cache la nivel de modul (TTL 30 min) pentru a
 * evita apeluri repetate la fiecare request SSR și pentru a menaja cota API.
 */

export type PlaylistReel = {
    youtubeVideoId: string;
    title: string;
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minute
const FETCH_TIMEOUT_MS = 3500;
const MAX_ITEMS = 30;

type CacheEntry = { data: PlaylistReel[]; at: number };
const cache = new Map<string, CacheEntry>();

function readEnv(key: string): string {
    const fromProcess = typeof process !== 'undefined' ? process.env?.[key]?.trim() : '';
    if (fromProcess) return fromProcess;
    const fromImport = (import.meta.env as Record<string, string | undefined>)[key]?.trim();
    return fromImport || '';
}

/**
 * Extrage ID-ul de playlistă dintr-un link YouTube sau dintr-un ID brut.
 */
export function extractPlaylistId(input: string): string {
    const value = (input || '').trim();
    if (!value) return '';
    const match = value.match(/[?&]list=([A-Za-z0-9_-]+)/);
    if (match) return match[1];
    // Poate fi deja doar ID-ul (PL..., UU..., etc.)
    if (/^[A-Za-z0-9_-]{10,}$/.test(value)) return value;
    return '';
}

type PlaylistItemsResponse = {
    items?: Array<{
        snippet?: {
            title?: string;
            resourceId?: { videoId?: string };
        };
    }>;
    nextPageToken?: string;
    error?: { message?: string };
};

async function fetchPlaylistItems(playlistId: string, apiKey: string): Promise<PlaylistReel[]> {
    const reels: PlaylistReel[] = [];
    const seen = new Set<string>();
    let pageToken = '';

    while (reels.length < MAX_ITEMS) {
        const params = new URLSearchParams({
            part: 'snippet',
            maxResults: '50',
            playlistId,
            key: apiKey,
        });
        if (pageToken) params.set('pageToken', pageToken);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        let data: PlaylistItemsResponse;
        try {
            const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`, {
                signal: controller.signal,
                headers: { Accept: 'application/json' },
            });
            data = (await res.json()) as PlaylistItemsResponse;
            if (!res.ok) throw new Error(data?.error?.message || `Data API status ${res.status}`);
        } finally {
            clearTimeout(timeout);
        }

        for (const item of data.items ?? []) {
            const videoId = item.snippet?.resourceId?.videoId?.trim();
            const title = (item.snippet?.title ?? '').trim();
            // „Deleted/Private video" nu au videoId valid sau titlu utilizabil
            if (!videoId || seen.has(videoId) || title === 'Deleted video' || title === 'Private video') continue;
            seen.add(videoId);
            reels.push({ youtubeVideoId: videoId, title });
            if (reels.length >= MAX_ITEMS) break;
        }

        if (!data.nextPageToken) break;
        pageToken = data.nextPageToken;
    }

    return reels;
}

/**
 * Returnează reels-urile dintr-o playlistă YouTube (cache 30 min).
 * În caz de eroare/timeout, returnează ultimul cache valid sau [].
 */
export async function getReelsFromPlaylist(playlistIdOrUrl: string): Promise<PlaylistReel[]> {
    const playlistId = extractPlaylistId(playlistIdOrUrl);
    if (!playlistId) return [];

    const apiKey = readEnv('YOUTUBE_API_KEY');
    if (!apiKey) return [];

    const cached = cache.get(playlistId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return cached.data;
    }

    try {
        const data = await fetchPlaylistItems(playlistId, apiKey);
        cache.set(playlistId, { data, at: Date.now() });
        return data;
    } catch {
        return cached?.data ?? [];
    }
}
