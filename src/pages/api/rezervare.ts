/**
 * POST /api/rezervare
 * ─────────────────────────────────────────────────────────────────────────
 * Endpoint pentru procesarea formularului de rezervare.
 * Înlocuiește data-netlify="true" — funcționează pe Railway (Node standalone).
 *
 * Securitate:
 *   • Honeypot anti-spam (câmp bot-field ascuns)
 *   • Validare GDPR consent obligatoriu (Art. 7 RGPD)
 *   • Validare și sanitizare pentru toate câmpurile
 *   • Rate limiting per IP (5 cereri/minut)
 *   • Parametrizare SQL (fără SQL injection)
 *   • Validare regex telefon și dată
 */

import type { APIRoute } from 'astro';
import nodemailer from 'nodemailer';
import { query } from '../../lib/db.js';
import { secureLogger } from '../../lib/secure-logger.js';

export const prerender = false;

// ── Notificare email (SMTP Gmail) ─────────────────────────────────────────
function escapeHtml(val: string): string {
    return val
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function trimiteNotificare(campuri: [string, string][], nume: string): Promise<void> {
    try {
        const user = process.env.SMTP_USER?.trim();
        const pass = process.env.SMTP_PASS?.replace(/\s+/g, '');
        if (!user || !pass) {
            secureLogger.error('[/api/rezervare] Email skip: SMTP_USER/SMTP_PASS lipsesc.');
            return;
        }

        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            connectionTimeout: 5000,
            auth: { user, pass },
        });

        await transporter.sendMail({
            from: user,
            to: user,
            subject: `Cerere nouă eveniment: ${nume}`,
            text: campuri.map(([k, v]) => `- ${k}: ${v}`).join('\n'),
            html: `<ul>${campuri
                .map(([k, v]) => `<li><strong>${k}:</strong> ${escapeHtml(v)}</li>`)
                .join('')}</ul>`,
        });
    } catch (err) {
        secureLogger.error('[/api/rezervare] Email error:', err);
    }
}

// ── Rate limiting ─────────────────────────────────────────────────────────
const RATE_WINDOW_MS = 60_000; // 1 minut
const RATE_LIMIT = 5;      // max 5 rezervări/minut/IP

const rateMap = new Map<string, number[]>();

function getClientIp(request: Request): string {
    return (
        request.headers.get('cf-connecting-ip') ??
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown'
    );
}

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const timestamps = (rateMap.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
    if (timestamps.length >= RATE_LIMIT) return true;
    timestamps.push(now);
    rateMap.set(ip, timestamps);
    return false;
}

// ── Sanitizare ────────────────────────────────────────────────────────────
function san(val: FormDataEntryValue | null, maxLen = 255): string {
    if (!val || typeof val !== 'string') return '';
    return val
        .trim()
        // Elimină control chars, normalizează spațiile și taie orice markup HTML.
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, maxLen);
}

function jsonErr(msg: string, status: number): Response {
    return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

// ── Handler ───────────────────────────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
    const ip = getClientIp(request);

    if (isRateLimited(ip)) {
        return jsonErr('Prea multe cereri. Încearcă din nou în câteva minute.', 429);
    }

    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return jsonErr('Date invalide.', 400);
    }

    // Honeypot — bots completează acest câmp, utilizatorii reali nu
    if (formData.get('bot-field')) {
        // Răspundem cu 200 pentru a nu dezvălui mecanismul anti-spam
        return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }

    // Validare consimțământ GDPR — obligatoriu (Art. 7 alin. 2 RGPD)
    if (formData.get('gdpr-consent') !== 'da') {
        return jsonErr('Consimțământul GDPR este obligatoriu.', 400);
    }

    // Sanitizare câmpuri
    const nume = san(formData.get('Nume'), 90);
    const telefon = san(formData.get('Telefon'), 20);
    const eveniment = san(formData.get('Eveniment'), 50);
    const data = san(formData.get('Data'), 20);
    const buget = san(formData.get('Buget'), 30);
    const mesaj = san(formData.get('Mesaj'), 1000);

    // Validare câmpuri obligatorii
    if (!nume || !telefon || !eveniment || !data) {
        return jsonErr('Câmpurile obligatorii lipsesc.', 400);
    }

    // Validare format telefon românesc
    if (!/^(0[0-9]{9}|\+40[0-9]{9})$/.test(telefon)) {
        return jsonErr('Număr de telefon invalid (ex: 07xxxxxxxx sau +407xxxxxxxx).', 400);
    }

    // Validare format dată (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return jsonErr('Data evenimentului este invalidă.', 400);
    }

    // Verifică că data nu este în trecut
    const dataEveniment = new Date(data);
    if (isNaN(dataEveniment.getTime()) || dataEveniment < new Date()) {
        return jsonErr('Data evenimentului nu poate fi în trecut.', 400);
    }

    // Salvare în baza de date
    try {
        const mesajSalvat = [
            buget ? `Buget alocat pentru eveniment: ${buget}.` : '',
            mesaj,
        ].filter(Boolean).join('\n');

        await query(
            `INSERT INTO rezervari
         (nume, telefon, eveniment, data_eveniment, mesaj, gdpr_consent, creat_la)
       VALUES (?, ?, ?, ?, ?, 1, NOW())`,
            [nume, telefon, eveniment, data, mesajSalvat || null],
        );
    } catch (err) {
        secureLogger.error('[/api/rezervare] DB error:', err);
        return jsonErr('Eroare server. Încearcă din nou sau contactează-ne direct la +40767369658.', 500);
    }

    // Fire-and-forget: răspunsul nu așteaptă SMTP; erorile sunt prinse în trimiteNotificare.
    void trimiteNotificare(
        [
            ['Nume', nume],
            ['Telefon', telefon],
            ['Tip Eveniment', eveniment],
            ['Data', data],
            ['Mesaj', mesaj || '-'],
        ],
        nume,
    );

    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
};
