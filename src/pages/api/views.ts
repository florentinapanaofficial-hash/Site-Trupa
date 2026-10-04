/**
 * /api/views/ – Contor de vizualizări pentru fațadele video (VideoFacade).
 * GET  ?ids=a,b,c -> { views: { [videoId]: number } }
 * POST { videoId } -> incrementează cu 1 și returnează { videoId, views }.
 * Persistență: MySQL `video_views`, prin conexiunea Railway existenta.
 */

import type { APIRoute } from 'astro';
import { getPool, query } from '../../lib/db.js';
import { checkOrigin } from '../../lib/cors.js';
import { secureLogger } from '../../lib/secure-logger.js';

export const prerender = false;

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;
const MAX_IDS_PER_REQUEST = 50;
const VIEW_WINDOW_MS = 30_000;
const lastViewByKey = new Map<string, number>();

async function readViews(ids: string[]): Promise<Record<string, number>> {
    const rows = await query(
        `SELECT video_id, views_count FROM video_views WHERE video_id IN (${ids.map(() => '?').join(',')})`,
        ids,
    ) as Array<{ video_id: string; views_count: number }>;

    const views: Record<string, number> = {};
    for (const id of ids) views[id] = 0;
    for (const row of rows) {
        views[row.video_id] = Number(row.views_count);
    }
    return views;
}

async function incrementView(id: string): Promise<number> {
    const connection = await getPool().getConnection();
    try {
        await connection.beginTransaction();
        await connection.execute(
            'INSERT INTO video_views (video_id, views_count) VALUES (?, 1) ON DUPLICATE KEY UPDATE views_count = views_count + 1',
            [id],
        );
        const [result] = await connection.execute('SELECT views_count FROM video_views WHERE video_id = ?', [id]);
        const rows = result as Array<{ views_count: number }>;
        const total = Number(rows[0]?.views_count);
        if (!Number.isSafeInteger(total) || total < 1) throw new Error('Contor video invalid.');
        await connection.commit();
        return total;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
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
        return jsonResponse({ error: 'Eroare internă.' }, 500, cors.origin);
    }
};

export const POST: APIRoute = async ({ request }) => {
    const cors = checkOrigin(request);
    if (!cors.allowed) return forbidden();

    let payload: { video_id?: unknown; videoId?: unknown } | null;
    try {
        payload = await request.json();
    } catch {
        return jsonResponse({ error: 'Body JSON invalid.' }, 400, cors.origin);
    }

    const rawId = payload?.video_id ?? payload?.videoId;
    const videoId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!VIDEO_ID_PATTERN.test(videoId)) {
        return jsonResponse({ error: 'videoId invalid.' }, 400, cors.origin);
    }

    if (isRateLimited(`${resolveClientIp(request)}:${videoId}`)) {
        return jsonResponse({ error: 'Prea multe cereri. Încearcă mai târziu.' }, 429, cors.origin);
    }

    try {
        const views = await incrementView(videoId);
        return jsonResponse({ video_id: videoId, views_count: views, videoId, views }, 200, cors.origin);
    } catch (error) {
        lastViewByKey.delete(`${resolveClientIp(request)}:${videoId}`);
        secureLogger.error('Eroare la incrementarea vizualizărilor video:', error);
        return jsonResponse({ error: 'Eroare internă.' }, 500, cors.origin);
    }
};
