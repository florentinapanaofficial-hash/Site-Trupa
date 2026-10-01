/**
 * /api/views/ – Contor de vizualizări pentru fațadele video (VideoFacade).
 * GET  ?ids=a,b,c -> { views: { [videoId]: number } }
 * POST { videoId } -> incrementează cu 1 și returnează { videoId, views }.
 * Persistență: Supabase `video_stats` + RPC `increment_video_view` (vezi scripts/supabase-video-stats.sql).
 */

import type { APIRoute } from 'astro';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { checkOrigin } from '../../lib/cors.js';
import { secureLogger } from '../../lib/secure-logger.js';

export const prerender = false;

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_IDS_PER_REQUEST = 50;
const VIEW_WINDOW_MS = 30_000;
const lastViewByKey = new Map<string, number>();

class StatsUnavailableError extends Error { }

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
    if (supabase) return supabase;
    // process.env are prioritate: variabilele Railway sunt citite la runtime, nu la build.
    const url = process.env.SUPABASE_URL || import.meta.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
        throw new StatsUnavailableError('Lipsesc SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    }
    supabase = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return supabase;
}

async function readViews(ids: string[]): Promise<Record<string, number>> {
    const { data, error } = await getSupabase()
        .from('video_stats')
        .select('video_id, views')
        .in('video_id', ids);
    if (error) throw error;

    const views: Record<string, number> = {};
    for (const id of ids) views[id] = 0;
    for (const row of (data ?? []) as Array<{ video_id: string; views: number }>) {
        views[row.video_id] = row.views;
    }
    return views;
}

async function incrementView(id: string): Promise<number> {
    const { data, error } = await getSupabase().rpc('increment_video_view', { vid_id: id });
    if (error) throw error;
    if (typeof data !== 'number') throw new Error('Răspuns RPC invalid pentru increment_video_view.');
    return data;
}

function errorStatus(error: unknown): number {
    return error instanceof StatsUnavailableError ? 503 : 500;
}

function jsonResponse(data: unknown, status = 200, corsOrigin: string | null = null): Response {
    const corsHeaders: Record<string, string> = corsOrigin !== null
        ? { 'Access-Control-Allow-Origin': corsOrigin, 'Vary': 'Origin' }
        : {};
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            ...corsHeaders,
        },
    });
}

function forbidden(): Response {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

function resolveClientIp(request: Request): string {
    const cfIp = request.headers.get('cf-connecting-ip');
    if (cfIp) return cfIp;
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return request.headers.get('x-real-ip') ?? 'unknown';
}

function isRateLimited(key: string): boolean {
    const now = Date.now();
    for (const [entryKey, value] of lastViewByKey.entries()) {
        if (now - value > VIEW_WINDOW_MS) lastViewByKey.delete(entryKey);
    }
    const lastAt = lastViewByKey.get(key) ?? 0;
    if (now - lastAt < VIEW_WINDOW_MS) return true;
    lastViewByKey.set(key, now);
    return false;
}

export const OPTIONS: APIRoute = ({ request }) => {
    const cors = checkOrigin(request);
    if (!cors.allowed) return forbidden();
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': cors.origin ?? '',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin',
        },
    });
};

export const GET: APIRoute = async ({ request, url }) => {
    const cors = checkOrigin(request);
    if (!cors.allowed) return forbidden();

    const ids = [...new Set((url.searchParams.get('ids') ?? '').split(',').map((id) => id.trim()))]
        .filter((id) => VIDEO_ID_PATTERN.test(id))
        .slice(0, MAX_IDS_PER_REQUEST);

    if (ids.length === 0) return jsonResponse({ views: {} }, 200, cors.origin);

    try {
        return jsonResponse({ views: await readViews(ids) }, 200, cors.origin);
    } catch (error) {
        secureLogger.error('Eroare la citirea vizualizărilor video:', error);
        return jsonResponse({ error: 'Eroare internă.' }, errorStatus(error), cors.origin);
    }
};

export const POST: APIRoute = async ({ request }) => {
    const cors = checkOrigin(request);
    if (!cors.allowed) return forbidden();

    let payload: { videoId?: unknown };
    try {
        payload = (await request.json()) as { videoId?: unknown };
    } catch {
        return jsonResponse({ error: 'Body JSON invalid.' }, 400, cors.origin);
    }

    const videoId = typeof payload.videoId === 'string' ? payload.videoId.trim() : '';
    if (!VIDEO_ID_PATTERN.test(videoId)) {
        return jsonResponse({ error: 'videoId invalid.' }, 400, cors.origin);
    }

    if (isRateLimited(`${resolveClientIp(request)}:${videoId}`)) {
        return jsonResponse({ error: 'Prea multe cereri. Încearcă mai târziu.' }, 429, cors.origin);
    }

    try {
        return jsonResponse({ videoId, views: await incrementView(videoId) }, 200, cors.origin);
    } catch (error) {
        secureLogger.error('Eroare la incrementarea vizualizărilor video:', error);
        return jsonResponse({ error: 'Eroare internă.' }, errorStatus(error), cors.origin);
    }
};
