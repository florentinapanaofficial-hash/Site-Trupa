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

    const apiKey = process.env.YOUTUBE_API_KEY;
    const channelId = process.env.YOUTUBE_CHANNEL_ID?.trim() || FALLBACK_CHANNEL_ID;

    if (!apiKey) {
        return new Response(
            JSON.stringify({ isLive: false, videoId: null, error: 'API key lipsă' }),
            { status: 200, headers }
        );
    }

    try {
        const url = new URL('https://www.googleapis.com/youtube/v3/search');
        url.searchParams.set('part', 'id');
        url.searchParams.set('channelId', channelId);
        url.searchParams.set('eventType', 'live');
        url.searchParams.set('type', 'video');
        url.searchParams.set('maxResults', '1');
        url.searchParams.set('key', apiKey);

        const res = await fetch(url.toString());

        if (!res.ok) {
            return new Response(
                JSON.stringify({ isLive: false, videoId: null }),
                { status: 200, headers }
            );
        }

        const data = await res.json() as { items?: Array<{ id: { videoId: string } }> };
        const videoId = data?.items?.[0]?.id?.videoId ?? null;

        return new Response(
            JSON.stringify({ isLive: !!videoId, videoId }),
            { status: 200, headers }
        );
    } catch {
        return new Response(
            JSON.stringify({ isLive: false, videoId: null }),
            { status: 200, headers }
        );
    }
};
