/**
 * /api/live-status – Verifică dacă canalul YouTube este live în acest moment
 * ──────────────────────────────────────────────────────────────────────────
 * Apelează YouTube Data API v3 (search.list cu eventType=live) și returnează
 * { isLive: boolean, videoId: string | null }
 *
 * Cache-Control: no-store — răspunsul NU trebuie cached (starea live se schimbă)
 */

import type { APIRoute } from 'astro';
import { checkOrigin } from '../../lib/cors.js';

export const prerender = false;

const FALLBACK_CHANNEL_ID = 'UCNi3X-Qm3V4aaOAFSOlzHew';
const LIVE_STATUS_CACHE_TTL_MS = 55_000;
const YOUTUBE_FETCH_TIMEOUT_MS = 1_500;

type LiveStatusPayload = {
    isLive: boolean;
    videoId: string | null;
};

let cachedLiveStatus: LiveStatusPayload | null = null;
let cachedAt = 0;
let inFlightRequest: Promise<LiveStatusPayload> | null = null;

const isCacheFresh = () => {
    return cachedLiveStatus && Date.now() - cachedAt < LIVE_STATUS_CACHE_TTL_MS;
};

const getFallbackPayload = (): LiveStatusPayload => {
    return cachedLiveStatus ?? { isLive: false, videoId: null };
};

const readErrorText = async (res: Response): Promise<string> => {
    try {
        const text = await res.text();
        return text.length > 300 ? `${text.slice(0, 300)}...` : text;
    } catch {
        return '';
    }
};

const fetchLiveStatusFromYoutube = async (apiKey: string, channelId: string): Promise<LiveStatusPayload> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), YOUTUBE_FETCH_TIMEOUT_MS);

    try {
        const url = new URL('https://www.googleapis.com/youtube/v3/search');
        url.searchParams.set('part', 'id');
        url.searchParams.set('channelId', channelId);
        url.searchParams.set('eventType', 'live');
        url.searchParams.set('type', 'video');
        url.searchParams.set('maxResults', '1');
        url.searchParams.set('fields', 'items(id(videoId))');
        url.searchParams.set('key', apiKey);

        const res = await fetch(url.toString(), {
            signal: controller.signal,
            cache: 'no-store',
        });

        if (!res.ok) {
            const responseText = await readErrorText(res);
            console.warn(
                `[api/live-status] YouTube API error: status=${res.status} channelId=${channelId} body=${responseText || 'empty'}`
            );
            return getFallbackPayload();
        }

        const data = await res.json() as { items?: Array<{ id: { videoId: string } }> };
        const videoId = data?.items?.[0]?.id?.videoId ?? null;

        return { isLive: !!videoId, videoId };
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            console.warn(`[api/live-status] YouTube API timeout after ${YOUTUBE_FETCH_TIMEOUT_MS}ms channelId=${channelId}`);
        } else {
            const message = error instanceof Error ? error.message : 'unknown error';
            console.warn(`[api/live-status] YouTube API request failed: channelId=${channelId} error=${message}`);
        }
        return getFallbackPayload();
    } finally {
        clearTimeout(timeoutId);
    }
};

const getLiveStatus = async (apiKey: string, channelId: string): Promise<LiveStatusPayload> => {
    if (isCacheFresh()) {
        return cachedLiveStatus as LiveStatusPayload;
    }

    if (!inFlightRequest) {
        inFlightRequest = fetchLiveStatusFromYoutube(apiKey, channelId)
            .then((payload) => {
                cachedLiveStatus = payload;
                cachedAt = Date.now();
                return payload;
            })
            .finally(() => {
                inFlightRequest = null;
            });
    }

    return inFlightRequest;
};

export const GET: APIRoute = async ({ request }) => {
    const originCheck = checkOrigin(request);

    if (!originCheck.allowed) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
        ...(originCheck.origin ? { 'Access-Control-Allow-Origin': originCheck.origin } : {}),
    };

    const apiKey = process.env.YOUTUBE_API_KEY?.trim() || import.meta.env.YOUTUBE_API_KEY?.trim();
    const channelId =
        process.env.YOUTUBE_CHANNEL_ID?.trim() ||
        import.meta.env.YOUTUBE_CHANNEL_ID?.trim() ||
        FALLBACK_CHANNEL_ID;

    if (!apiKey) {
        return new Response(
            JSON.stringify({ isLive: false, videoId: null, error: 'API key lipsă' }),
            { status: 200, headers }
        );
    }

    try {
        const payload = await getLiveStatus(apiKey, channelId);

        return new Response(
            JSON.stringify(payload),
            { status: 200, headers }
        );
    } catch {
        return new Response(
            JSON.stringify(getFallbackPayload()),
            { status: 200, headers }
        );
    }
};
