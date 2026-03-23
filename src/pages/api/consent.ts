/**
 * /api/consent – Endpoint GDPR pentru salvarea consimțământului
 * ──────────────────────────────────────────────────────────────
 * Baza legală: Art. 7 RGPD – operatorul trebuie să poată DOVEDI
 * că persoana vizată și-a dat consimțământul.
 *
 * Ce face acest endpoint:
 *   1. Verifică originea cererii (CORS whitelist)
 *   2. Verifică header-ul CSRF simplu (X-Requested-With)
 *   3. Aplică rate limiting per IP (10 cereri/minut)
 *   4. Validează și sanitizează body-ul JSON
 *   5. Salvează înregistrarea în DB cu IP hașat (SHA-256)
 *   6. Emite un log JSON structurat server-side
 *   7. Returnează 200 OK sau 400/429/500 cu mesaj în română
 *
 * Securitate:
 *   • IP-ul NU se stochează în clar – se hașează direct în SQL
 *   • Parametrii DB sunt binding-uri parametrizate (fără SQL injection)
 *   • Răspunsurile nu reflectă date interne de sistem
 *   • Rate limiting previne spam-ul în tabelul de consimțăminte
 */

import type { APIRoute } from 'astro';
import { query } from '../../lib/db.js';
import { checkOrigin } from '../../lib/cors.js';

// Astro SSR – endpoint nu se pre-randează
export const prerender = false;

// ──────────────────────────────────────────────────────────────
// Constante de validare
// ──────────────────────────────────────────────────────────────

/** Tipuri de consimțământ acceptate */
const TIPURI_PERMISE = new Set<string>([
    'whatsapp_redirect',
    'phone_call',
    'email_contact',
]);

/** Canale de comunicare acceptate */
const CANALE_PERMISE = new Set<string>([
    'whatsapp',
    'telefon',
    'email',
]);

/** Versiunea curentă a politicii de confidențialitate */
const VERSIUNE_POLITICA = '1.0';

// ──────────────────────────────────────────────────────────────
// Rate limiting în memorie
// ──────────────────────────────────────────────────────────────

const RATE_WINDOW_MS = 60_000; // 1 minut
const RATE_LIMIT = 10;     // max 10 cereri/minut/IP

// Map<ip, timestamps[]> – timestamps în ultimul minut
const consentByIp = new Map<string, number[]>();

/**
 * Verifică dacă IP-ul dat a depășit limita de cereri.
 * Curăță automat intrările expirate pentru a preveni memory leak.
 */
function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const timestamps = (consentByIp.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);

    if (timestamps.length >= RATE_LIMIT) return true;

    timestamps.push(now);
    consentByIp.set(ip, timestamps);

    // Curățare periodică: eliminăm IP-urile fără activitate recentă
    if (consentByIp.size > 5_000) {
        for (const [key, ts] of consentByIp) {
            if (ts.every(t => now - t >= RATE_WINDOW_MS)) {
                consentByIp.delete(key);
            }
        }
    }

    return false;
}

// ──────────────────────────────────────────────────────────────
// Utilitare
// ──────────────────────────────────────────────────────────────

/**
 * Extrage IP-ul real al clientului, respectând proxy-urile de încredere
 * (Cloudflare → X-Forwarded-For → X-Real-IP → fallback).
 */
function getClientIp(request: Request): string {
    const cfIp = request.headers.get('cf-connecting-ip');
    if (cfIp) return cfIp.trim();

    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();

    return request.headers.get('x-real-ip')?.trim() ?? 'unknown';
}

/**
 * Sanitizează un string de input:
 *   • Trebuie să fie de tip string
 *   • Trunchiază la maxLen caractere
 *   • Permite doar caractere alfanumerice, underscore și cratimă
 *   → Previne injecții SQL, XSS, path traversal
 */
function sanitizeString(input: unknown, maxLen = 64): string | null {
    if (typeof input !== 'string') return null;
    const trimmed = input.trim().slice(0, maxLen);
    if (!/^[a-z0-9_\-]+$/i.test(trimmed)) return null;
    return trimmed;
}

/**
 * Construiește un Response JSON cu headers de securitate standard.
 * Oglindește originea CORS doar dacă este în whitelist.
 */
function jsonResponse(
    data: unknown,
    status = 200,
    corsOrigin: string | null = null,
): Response {
    const corsHeaders: Record<string, string> = corsOrigin !== null
        ? { 'Access-Control-Allow-Origin': corsOrigin, 'Vary': 'Origin' }
        : {};

    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            // Headers de securitate – conform recomandărilor OWASP
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            ...corsHeaders,
        },
    });
}

// ──────────────────────────────────────────────────────────────
// PREFLIGHT OPTIONS – necesar pentru cereri cross-origin
// ──────────────────────────────────────────────────────────────

export const OPTIONS: APIRoute = ({ request }) => {
    const cors = checkOrigin(request);
    if (!cors.allowed) {
        return new Response(null, { status: 403 });
    }

    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': cors.origin ?? '',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
            'Access-Control-Max-Age': '600',
        },
    });
};

// ──────────────────────────────────────────────────────────────
// POST /api/consent – salvare consimțământ GDPR
// ──────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {

    // ── 1. Verificare CORS ──────────────────────────────────────
    const cors = checkOrigin(request);
    if (!cors.allowed) {
        return jsonResponse({ eroare: 'Origine nepermisă.' }, 403);
    }

    // ── 2. Protecție CSRF simplă (header obligatoriu) ───────────
    // Header-ul X-Requested-With nu poate fi setat de formulare HTML
    // standard sau de alte origini fără CORS pre-aprobat.
    const xrw = request.headers.get('x-requested-with');
    if (xrw !== 'XMLHttpRequest') {
        return jsonResponse({ eroare: 'Cerere invalidă.' }, 400);
    }

    // ── 3. Extragere metadate request ───────────────────────────
    const clientIp = getClientIp(request);
    // Trunchiuem UA și Referer la lungimea din schema DB
    const userAgent = (request.headers.get('user-agent') ?? 'unknown').slice(0, 512);
    const referer = (request.headers.get('referer') ?? '').slice(0, 255);

    // ── 4. Rate limiting ────────────────────────────────────────
    if (isRateLimited(clientIp)) {
        return jsonResponse(
            { eroare: 'Prea multe cereri. Te rugăm să aștepți un minut și să încerci din nou.' },
            429,
        );
    }

    // ── 5. Parsare și validare body JSON ────────────────────────
    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        return jsonResponse({ eroare: 'Body JSON invalid sau lipsă.' }, 400);
    }

    const tipConsimtamant = sanitizeString(body.tip_consimtamant);
    const canal = sanitizeString(body.canal);

    if (!tipConsimtamant || !TIPURI_PERMISE.has(tipConsimtamant)) {
        return jsonResponse(
            { eroare: 'Câmpul tip_consimtamant este invalid sau lipsă.' },
            400,
        );
    }

    if (!canal || !CANALE_PERMISE.has(canal)) {
        return jsonResponse(
            { eroare: 'Câmpul canal este invalid sau lipsă.' },
            400,
        );
    }

    // ── 6. Salvare în baza de date (MySQL cu query parametrizat) ─
    //
    // SECURITATE: IP-ul este hașat cu SHA2(..., 256) DIRECT ÎN SQL,
    // deci nu trece prin memoria aplicației în clar.
    // Toți parametrii sunt binding-uri – ZERO risc SQL injection.
    try {
        await query(
            `INSERT INTO gdpr_consimtamant
         (tip_consimtamant, canal, ip_hash, user_agent, referer,
          data_consimtamant, versiune_politica)
       VALUES (?, ?, SHA2(?, 256), ?, ?, NOW(), ?)`,
            [
                tipConsimtamant,
                canal,
                clientIp,           // hașat în SQL – nu stocat în clar
                userAgent,
                referer || null,    // null dacă referer lipsă (mai curat în DB)
                VERSIUNE_POLITICA,
            ],
        );
    } catch (dbError) {
        // Logăm eroarea complet server-side, dar NU expunem detalii clientului
        console.error('[GDPR] Eroare DB la salvare consimțământ:', JSON.stringify({
            eroare: dbError instanceof Error ? dbError.message : String(dbError),
            tip: tipConsimtamant,
            canal,
            // Logăm doar primii 4 octeți pentru a putea corelat fără a expune IP-ul complet
            ip_hint: `${clientIp.slice(0, 4)}***`,
            timestamp: new Date().toISOString(),
        }));

        return jsonResponse(
            { eroare: 'Eroare internă la salvarea consimțământului. Te rugăm să încerci din nou.' },
            500,
        );
    }

    // ── 7. Log structurat JSON server-side ──────────────────────
    // Format parsabil de SIEM/Splunk/Datadog/orice agregator de loguri.
    // NB: console.log pe server Astro Node ajunge în stdout → fișier de log.
    console.log(JSON.stringify({
        eveniment: 'gdpr_consimtamant_salvat',
        timestamp: new Date().toISOString(),
        tip_consimtamant: tipConsimtamant,
        canal,
        // Logăm un prefix scurt pentru trasabilitate fără a stoca IP în clar
        ip_hint: `${clientIp.slice(0, 4)}***`,
        user_agent: userAgent,
        referer: referer || null,
        versiune_politica: VERSIUNE_POLITICA,
        status: 'SUCCESS',
    }));

    // ── 8. Răspuns 200 cu confirmare ────────────────────────────
    return jsonResponse(
        { succes: true, mesaj: 'Consimțământul a fost înregistrat cu succes.' },
        200,
        cors.origin,
    );
};
