/**
 * POST /api/rezervare
 * ─────────────────────────────────────────────────────────────────────────
 * Endpoint pentru procesarea formularului de rezervare.
 * Înlocuiește data-netlify="true" — funcționează pe Railway (Node standalone).
 *
 * Securitate:
 *   • Validare și sanitizare pentru toate câmpurile JSON
 *   • Rate limiting per IP (5 cereri/minut)
 *   • Parametrizare SQL (fără SQL injection)
 *   • Validare regex telefon și dată
 */

import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { query } from '../../lib/db.js';
import { ensureReservationStatusColumn } from '../../lib/reservation-status.js';
import { secureLogger } from '../../lib/secure-logger.js';

export const prerender = false;

// ── Notificare email (Resend API) ─────────────────────────────────────────
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
        const apiKey = process.env.RESEND_API_KEY?.trim();
        if (!apiKey) {
            secureLogger.error('[/api/rezervare] Email skip: RESEND_API_KEY lipsește.');
            return;
        }

        const resend = new Resend(apiKey);

        // SDK-ul Resend returnează { error } în loc să arunce excepție.
        const { error } = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: 'florentinapanaofficial@gmail.com',
            subject: `Cerere nouă eveniment: ${nume}`,
            text: campuri.map(([k, v]) => `${k}: ${v}`).join('\n'),
            html: `<div style="font-family:Arial,sans-serif;color:#1f2937;max-width:640px;margin:0 auto;padding:24px"><h1 style="font-size:22px;color:#111827">Cerere nouă de eveniment</h1><p style="color:#4b5563">Detaliile solicitării primite:</p><table style="width:100%;border-collapse:collapse"><tbody>${campuri
                .map(([k, v]) => `<tr><th scope="row" style="padding:10px 12px;border:1px solid #e5e7eb;background:#f9fafb;text-align:left;vertical-align:top;width:38%">${escapeHtml(k)}</th><td style="padding:10px 12px;border:1px solid #e5e7eb;vertical-align:top">${escapeHtml(v)}</td></tr>`)
                .join('')}</tbody></table></div>`,
        });
        if (error) secureLogger.error('[/api/rezervare] Resend error:', error);
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
function san(val: unknown, maxLen = 255): string {
    if (typeof val !== 'string') return '';
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

    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return jsonErr('Date invalide.', 400);
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return jsonErr('Date invalide.', 400);
    }

    const dataFormular = payload as Record<string, unknown>;

    // Sanitizare câmpuri
    const nume = san(dataFormular.nume, 90);
    const telefon = san(dataFormular.telefon, 20).replace(/[\s()-]/g, '');
    const eveniment = san(dataFormular.tip_eveniment, 50);
    const data = san(dataFormular.data, 10);
    const locatie = san(dataFormular.locatie, 180);
    const persoane = san(dataFormular.persoane, 60) || 'Nespecificat';
    const formula = san(dataFormular.formula, 80) || 'Nespecificat';
    const lumini = san(dataFormular.lumini, 100) || 'Nespecificat';
    const buget = san(dataFormular.buget, 60) || 'Nespecificat';
    const mesaj = san(dataFormular.mesaj, 1000) || 'Nespecificat';

    // Validare câmpuri obligatorii
    if (!nume || !telefon || !eveniment || !data || !locatie) {
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
    const [an, luna, zi] = data.split('-').map(Number);
    const dataUtc = Date.UTC(an, luna - 1, zi);
    const dataParsata = new Date(dataUtc);
    const dataAstazi = new Date();
    const astaziUtc = Date.UTC(dataAstazi.getUTCFullYear(), dataAstazi.getUTCMonth(), dataAstazi.getUTCDate());
    if (
        dataParsata.getUTCFullYear() !== an ||
        dataParsata.getUTCMonth() !== luna - 1 ||
        dataParsata.getUTCDate() !== zi
    ) {
        return jsonErr('Data evenimentului este invalidă.', 400);
    }
    if (dataUtc < astaziUtc) {
        return jsonErr('Data evenimentului nu poate fi în trecut.', 400);
    }

    const detaliiEveniment = [
        `Locație: ${locatie}`,
        `Număr estimat de persoane: ${persoane}`,
        `Formula trupei: ${formula}`,
        `Pachet de lumini: ${lumini}`,
        `Buget estimat: ${buget}`,
        `Alte detalii: ${mesaj}`,
    ].join('\n');

    // Salvare în baza de date
    try {
        await ensureReservationStatusColumn();
        await query(
            `INSERT INTO rezervari
                 (nume, telefon, eveniment, data_eveniment, mesaj, gdpr_consent, creat_la, status)
             VALUES (?, ?, ?, ?, ?, 0, NOW(), 'nou')`,
            [nume, telefon, eveniment, data, detaliiEveniment],
        );
    } catch (err) {
        secureLogger.error('[/api/rezervare] DB error:', err);
        return jsonErr('Eroare server. Încearcă din nou sau contactează-ne direct la +40767369658.', 500);
    }

    // Fire-and-forget: răspunsul nu așteaptă SMTP; erorile sunt prinse în trimiteNotificare.
    void trimiteNotificare(
        [
            ['Nume și prenume', nume],
            ['Telefon', telefon],
            ['Tip eveniment', eveniment],
            ['Data evenimentului', data],
            ['Oraș / locație', locatie],
            ['Număr estimat de persoane', persoane],
            ['Formula trupei', formula],
            ['Pachet de lumini', lumini],
            ['Buget estimat', buget],
            ['Alte detalii / mesaj', mesaj],
        ],
        nume,
    );

    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
};
