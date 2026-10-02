import { timingSafeEqual } from 'node:crypto';
import type { APIRoute } from 'astro';
import { query } from '../../lib/db.js';
import { ensureReservationStatusColumn } from '../../lib/reservation-status.js';
import { secureLogger } from '../../lib/secure-logger.js';

export const prerender = false;

type AdminPayload = {
    action?: unknown;
    id?: unknown;
    data?: unknown;
};

type ExistingReservation = {
    id: number;
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json; charset=utf-8',
        },
    });
}

function isAuthorized(request: Request): boolean {
    const authorization = request.headers.get('authorization') ?? '';
    const suppliedPassword = authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length)
        : '';
    const expectedPassword = process.env.ADMIN_PASSWORD || 'formatia2026';
    const supplied = Buffer.from(suppliedPassword);
    const expected = Buffer.from(expectedPassword);

    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function isValidDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const [year, month, day] = value.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));

    return parsedDate.getUTCFullYear() === year &&
        parsedDate.getUTCMonth() === month - 1 &&
        parsedDate.getUTCDate() === day;
}

export const GET: APIRoute = async ({ request }) => {
    if (!isAuthorized(request)) return jsonResponse({ error: 'Neautorizat.' }, 401);

    try {
        await ensureReservationStatusColumn();
        const reservations = await query(
            `SELECT id, nume, telefon, eveniment,
                    DATE_FORMAT(data_eveniment, '%Y-%m-%d') AS data_eveniment,
                    mesaj, status, creat_la
             FROM rezervari
             ORDER BY data_eveniment DESC, creat_la DESC, id DESC`,
        );

        return jsonResponse(reservations);
    } catch (error) {
        secureLogger.error('[api/admin-rezervari] GET error:', error);
        return jsonResponse({ error: 'Nu s-au putut încărca rezervările.' }, 500);
    }
};

export const POST: APIRoute = async ({ request }) => {
    if (!isAuthorized(request)) return jsonResponse({ error: 'Neautorizat.' }, 401);

    let payload: AdminPayload;
    try {
        payload = await request.json() as AdminPayload;
    } catch {
        return jsonResponse({ error: 'Date invalide.' }, 400);
    }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return jsonResponse({ error: 'Date invalide.' }, 400);
    }

    try {
        await ensureReservationStatusColumn();

        if (payload.action === 'confirma') {
            const id = Number(payload.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                return jsonResponse({ error: 'Identificator invalid.' }, 400);
            }

            const existing = await query(
                'SELECT id FROM rezervari WHERE id = ? LIMIT 1',
                [id],
            ) as ExistingReservation[];
            if (existing.length === 0) return jsonResponse({ error: 'Rezervarea nu a fost găsită.' }, 404);

            await query(
                "UPDATE rezervari SET status = 'confirmat' WHERE id = ?",
                [id],
            );
            return jsonResponse({ ok: true });
        }

        if (payload.action === 'adauga_manual') {
            if (!isValidDate(payload.data)) {
                return jsonResponse({ error: 'Data selectată este invalidă.' }, 400);
            }

            await query(
                `INSERT INTO rezervari
                 (nume, telefon, eveniment, data_eveniment, mesaj, gdpr_consent, creat_la, status)
                 VALUES (?, '', ?, ?, ?, 0, NOW(), 'confirmat')`,
                ['Rezervat Telefonic', 'Eveniment telefonic', payload.data, 'Adăugată manual din panoul admin.'],
            );
            return jsonResponse({ ok: true }, 201);
        }

        return jsonResponse({ error: 'Acțiune necunoscută.' }, 400);
    } catch (error) {
        secureLogger.error('[api/admin-rezervari] POST error:', error);
        return jsonResponse({ error: 'Nu s-a putut actualiza lista rezervărilor.' }, 500);
    }
};