/**
 * /api/track-plays – Contor persistent de ascultari per piesa (istoric, nu doar sesiune).
 * GET  -> { plays: { [trackId]: number } } pentru toate piesele cunoscute.
 * POST -> { trackId } incrementeaza cu 1 si returneaza { trackId, plays }.
 */

import type { APIRoute } from 'astro';
import { query } from '../../lib/db.js';
import { checkOrigin } from '../../lib/cors.js';
import { secureLogger } from '../../lib/secure-logger.js';

export const prerender = false;

const TRACK_ID_PATTERN = /^[a-z0-9-]{1,191}$/i;
const PLAY_WINDOW_MS = 15_000;
const lastPlayByKey = new Map<string, number>();

function jsonResponse(data: unknown, status = 200, corsOrigin: string | null = null): Response {
  const corsHeaders: Record<string, string> = corsOrigin !== null
    ? { 'Access-Control-Allow-Origin': corsOrigin, 'Vary': 'Origin' }
    : {};
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      ...corsHeaders,
    },
  });
}

function resolveClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const [firstIp] = forwarded.split(',');
    return firstIp.trim();
  }

  return request.headers.get('x-real-ip') ?? 'unknown';
}

function isRateLimited(key: string): boolean {
  const now = Date.now();

  for (const [entryKey, value] of lastPlayByKey.entries()) {
    if (now - value > PLAY_WINDOW_MS) {
      lastPlayByKey.delete(entryKey);
    }
  }

  const lastAt = lastPlayByKey.get(key) ?? 0;
  if (now - lastAt < PLAY_WINDOW_MS) {
    return true;
  }

  lastPlayByKey.set(key, now);
  return false;
}

export const OPTIONS: APIRoute = ({ request }) => {
  const cors = checkOrigin(request);
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
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

export const GET: APIRoute = async ({ request }) => {
  const cors = checkOrigin(request);
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  try {
    const rows = (await query('SELECT track_id, play_count FROM track_plays')) as Array<{
      track_id: string;
      play_count: number;
    }>;

    const plays: Record<string, number> = {};
    for (const row of rows) {
      plays[row.track_id] = row.play_count;
    }

    return jsonResponse({ plays }, 200, cors.origin);
  } catch (error) {
    secureLogger.error('Eroare la citirea contorului de ascultari:', error);
    return jsonResponse({ error: 'Eroare interna.' }, 500, cors.origin);
  }
};

export const POST: APIRoute = async ({ request }) => {
  const cors = checkOrigin(request);
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  let payload: { trackId?: unknown };
  try {
    payload = (await request.json()) as { trackId?: unknown };
  } catch {
    return jsonResponse({ error: 'Body JSON invalid.' }, 400, cors.origin);
  }

  const trackId = typeof payload.trackId === 'string' ? payload.trackId.trim() : '';
  if (!TRACK_ID_PATTERN.test(trackId)) {
    return jsonResponse({ error: 'trackId invalid.' }, 400, cors.origin);
  }

  const ip = resolveClientIp(request);
  if (isRateLimited(`${ip}:${trackId}`)) {
    return jsonResponse({ error: 'Prea multe cereri. Incearca mai tarziu.' }, 429, cors.origin);
  }

  try {
    await query(
      'INSERT INTO track_plays (track_id, play_count) VALUES (?, 1) ON DUPLICATE KEY UPDATE play_count = play_count + 1',
      [trackId],
    );

    const rows = (await query('SELECT play_count FROM track_plays WHERE track_id = ?', [trackId])) as Array<{
      play_count: number;
    }>;

    return jsonResponse({ trackId, plays: rows[0]?.play_count ?? 0 }, 200, cors.origin);
  } catch (error) {
    secureLogger.error('Eroare la incrementarea contorului de ascultari:', error);
    return jsonResponse({ error: 'Eroare interna.' }, 500, cors.origin);
  }
};
