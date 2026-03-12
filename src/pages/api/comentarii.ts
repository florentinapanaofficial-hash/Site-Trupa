import type { APIRoute } from 'astro';
import DOMPurify from 'isomorphic-dompurify';
import { query } from '../../lib/db.js';

export const prerender = false;

const COMMENT_WINDOW_MS = 60_000;
const lastCommentByIp = new Map<string, number>();

type ComentariuPayload = {
  post_id: string | number;
  nume_utilizator?: string;
  nume?: string;
  text_comentariu?: string;
  comentariu?: string;
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
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

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();

  for (const [key, value] of lastCommentByIp.entries()) {
    if (now - value > COMMENT_WINDOW_MS) {
      lastCommentByIp.delete(key);
    }
  }

  const lastCommentAt = lastCommentByIp.get(ip) ?? 0;
  if (now - lastCommentAt < COMMENT_WINDOW_MS) {
    return true;
  }

  lastCommentByIp.set(ip, now);
  return false;
}

function parsePostId(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export const POST: APIRoute = async ({ request }) => {
  let payload: Partial<ComentariuPayload>;

  const ip = resolveClientIp(request);
  if (isRateLimited(ip)) {
    return jsonResponse({ error: 'Prea multe comentarii. Incearca din nou peste un minut.' }, 429);
  }

  try {
    payload = (await request.json()) as Partial<ComentariuPayload>;
  } catch {
    return jsonResponse({ error: 'Body JSON invalid.' }, 400);
  }

  const postId = parsePostId(payload.post_id);
  const numeUtilizatorRaw = payload.nume_utilizator ?? payload.nume;
  const textComentariuRaw = payload.text_comentariu ?? payload.comentariu;

  const numeUtilizator = typeof numeUtilizatorRaw === 'string' ? numeUtilizatorRaw.trim() : '';
  const rawComentariu = typeof textComentariuRaw === 'string' ? textComentariuRaw.trim() : '';
  const textComentariu = DOMPurify.sanitize(rawComentariu, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }).trim();

  if (!postId || !numeUtilizator) {
    return jsonResponse({ error: 'Campurile post_id si nume_utilizator sunt obligatorii.' }, 400);
  }

  if (textComentariu.length === 0 || textComentariu.length > 500) {
    return jsonResponse({ error: 'Comentariul nu poate fi gol si nu poate depasi 500 caractere.' }, 400);
  }

  try {
    await query(
      'INSERT INTO comments (post_id, nume_utilizator, text_comentariu) VALUES (?, ?, ?)',
      [postId, numeUtilizator, textComentariu],
    );

    return jsonResponse({ success: true }, 201);
  } catch (error) {
    console.error('Eroare la salvarea comentariului:', error);
    return jsonResponse({ error: 'Eroare interna la salvarea comentariului.' }, 500);
  }
};

export const GET: APIRoute = async ({ url }) => {
  const postId = parsePostId(url.searchParams.get('post_id'));

  if (!postId) {
    return jsonResponse({ error: 'Parametrul post_id este obligatoriu si trebuie sa fie numar intreg pozitiv.' }, 400);
  }

  try {
    const rows = (await query(
      `SELECT id, post_id, nume_utilizator, text_comentariu, data
       FROM comments
       WHERE post_id = ?
       ORDER BY data DESC`,
      [postId],
    )) as Array<{
      id: number;
      post_id: number;
      nume_utilizator: string;
      text_comentariu: string;
      data: string;
    }>;

    return jsonResponse({ comments: rows }, 200);
  } catch (error) {
    console.error('Eroare la citirea comentariilor:', error);
    return jsonResponse({ error: 'Eroare interna la citirea comentariilor.' }, 500);
  }
};
