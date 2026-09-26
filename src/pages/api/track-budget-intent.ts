import type { APIRoute } from 'astro';
import { query } from '../../lib/db.js';
import { checkOrigin } from '../../lib/cors.js';
import { secureLogger } from '../../lib/secure-logger.js';

export const prerender = false;

const lastIntentByIp = new Map<string, number>();
const RATE_WINDOW_MS = 15_000;
let lastCleanupAt = 0;

const jsonError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get('origin');
  if (!origin || (!checkOrigin(request).allowed && origin !== new URL(request.url).origin)) {
    return jsonError('Origin not allowed', 403);
  }

  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return jsonError('Content-Type invalid.', 415);
  }

  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > 512) return jsonError('Cerere prea mare.', 413);
    payload = JSON.parse(body);
  } catch {
    return jsonError('Body JSON invalid.', 400);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return jsonError('Date invalide.', 400);
  }

  const { budget, timestamp, url } = payload as Record<string, unknown>;
  const selectedAt = typeof timestamp === 'string' ? Date.parse(timestamp) : NaN;
  if (!Number.isInteger(budget) || (budget as number) < 1000 || (budget as number) > 10000 || (budget as number) % 100 !== 0 ||
      !Number.isFinite(selectedAt) || Math.abs(Date.now() - selectedAt) > 300_000 || url !== '/contact/') {
    return jsonError('Date invalide.', 400);
  }

  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ?? 'unknown';
  const now = Date.now();
  for (const [key, lastAt] of lastIntentByIp) {
    if (now - lastAt > RATE_WINDOW_MS) lastIntentByIp.delete(key);
  }
  if (now - (lastIntentByIp.get(ip) ?? 0) < RATE_WINDOW_MS) {
    return jsonError('Prea multe cereri.', 429);
  }
  lastIntentByIp.set(ip, now);

  try {
    if (now - lastCleanupAt > 86_400_000) {
      await query('DELETE FROM budget_intents WHERE selected_at < NOW() - INTERVAL 12 MONTH');
      lastCleanupAt = now;
    }
    await query('INSERT INTO budget_intents (budget_eur, page_path) VALUES (?, ?)', [budget, url]);
    return new Response(null, { status: 204 });
  } catch (error) {
    secureLogger.error('[/api/track-budget-intent] DB error:', error);
    return jsonError('Eroare interna.', 500);
  }
};