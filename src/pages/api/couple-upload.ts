import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import DOMPurify from 'isomorphic-dompurify';
import { secureLogger } from '../../lib/secure-logger.js';

export const prerender = false;

/* ─── Rate-limit ──────────────────────────────────── */
const UPLOAD_WINDOW_MS = 30_000;
const lastUploadByIp = new Map<string, number>();

function resolveClientIp(request: Request): string {
    const cfIp = request.headers.get('cf-connecting-ip');
    if (cfIp) return cfIp;
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp;
    return 'unknown';
}

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    for (const [key, ts] of lastUploadByIp.entries()) {
        if (now - ts > UPLOAD_WINDOW_MS) lastUploadByIp.delete(key);
    }
    const last = lastUploadByIp.get(ip) ?? 0;
    if (now - last < UPLOAD_WINDOW_MS) return true;
    lastUploadByIp.set(ip, now);
    return false;
}

/* ─── Helpers ─────────────────────────────────────── */
const MAX_TEXT_LEN = 5000;

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
        },
    });
}

function sanitize(raw: string): string {
    return DOMPurify.sanitize(raw, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim();
}

/* ─── Load couples data ───────────────────────────── */
async function loadCouples() {
    const filePath = path.join(process.cwd(), 'src', 'data', 'couples.json');
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw).couples as Array<{
        slug: string;
        names: string;
        uploadToken: string;
        [k: string]: unknown;
    }>;
}

function findCoupleByToken(couples: Awaited<ReturnType<typeof loadCouples>>, token: string) {
    return couples.find((c) => c.uploadToken === token) ?? null;
}

/* ─── POST handler ────────────────────────────────── */
export const POST: APIRoute = async ({ request }) => {
    const ip = resolveClientIp(request);
    if (isRateLimited(ip)) {
        return json({ error: 'Prea multe cereri. Încearcă din nou în 30 de secunde.' }, 429);
    }

    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return json({ error: 'Date formular invalide.' }, 400);
    }

    /* ─── Validate token ───────────── */
    const token = typeof formData.get('token') === 'string' ? String(formData.get('token')).trim() : '';
    if (!token) {
        return json({ error: 'Token lipsă.' }, 400);
    }

    let couples;
    try {
        couples = await loadCouples();
    } catch {
        return json({ error: 'Eroare server: nu pot citi datele.' }, 500);
    }

    const couple = findCoupleByToken(couples, token);
    if (!couple) {
        return json({ error: 'Token invalid sau expirat.' }, 403);
    }

    /* ─── Determine upload type ───── */
    const uploadType = typeof formData.get('type') === 'string' ? String(formData.get('type')).trim() : '';

    if (uploadType === 'story') {
        /* ─── Love story text ────────── */
        const rawStory = typeof formData.get('story') === 'string' ? String(formData.get('story')) : '';
        const story = sanitize(rawStory);
        if (!story || story.length < 10 || story.length > MAX_TEXT_LEN) {
            return json({ error: 'Povestea trebuie să aibă între 10 și 5000 de caractere.' }, 400);
        }
        // In production, this would save to DB or file. For now, log it.
        secureLogger.info(`[couple-upload] Story from ${couple.names}: ${story.substring(0, 100)}...`);
        return json({ success: true, message: 'Povestea a fost trimisă! O vom publica în curând.' }, 200);
    }

    if (uploadType === 'recommendation') {
        /* ─── Recommendation text ────── */
        const rawRec = typeof formData.get('recommendation') === 'string' ? String(formData.get('recommendation')) : '';
        const rec = sanitize(rawRec);
        if (!rec || rec.length < 10 || rec.length > MAX_TEXT_LEN) {
            return json({ error: 'Recomandarea trebuie să aibă între 10 și 5000 de caractere.' }, 400);
        }
        const rawSource = typeof formData.get('source') === 'string' ? String(formData.get('source')) : '';
        sanitize(rawSource);
        secureLogger.info(`[couple-upload] Recommendation from ${couple.names}: ${rec.substring(0, 100)}...`);
        return json({ success: true, message: 'Recomandarea a fost trimisă! Mulțumim frumos!' }, 200);
    }

    if (uploadType === 'video') {
        /* ─── Dance video URL ────────── */
        const rawUrl = typeof formData.get('videoUrl') === 'string' ? String(formData.get('videoUrl')) : '';
        const videoUrl = sanitize(rawUrl);
        if (!videoUrl || !videoUrl.startsWith('https://')) {
            return json({ error: 'Link-ul video trebuie să fie un URL valid (https://).' }, 400);
        }
        secureLogger.info(`[couple-upload] Video from ${couple.names}: ${videoUrl}`);
        return json({ success: true, message: 'Link-ul video a fost trimis!' }, 200);
    }

    return json({ error: 'Tip de upload necunoscut. Alege: photo, story, recommendation, video.' }, 400);
};
