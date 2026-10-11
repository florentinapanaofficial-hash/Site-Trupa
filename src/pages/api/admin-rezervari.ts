import { timingSafeEqual } from 'node:crypto';
import type { APIRoute } from 'astro';
import { requireSupabaseAdmin } from '../../lib/supabase';
import { secureLogger } from '../../lib/secure-logger.js';

export const prerender = false;

type AdminPayload = {
    action?: unknown;
    id?: unknown;
    data?: unknown;
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
        const { data, error } = await requireSupabaseAdmin()
            .from('rezervari')
            .select('id, nume, telefon, eveniment, data_eveniment, mesaj, status, creat_la')
            .order('data_eveniment', { ascending: false })
            .order('creat_la', { ascending: false })
            .order('id', { ascending: false });

        if (error) throw error;

        return jsonResponse(data ?? []);
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
        const supabase = requireSupabaseAdmin();

        if (payload.action === 'confirma') {
            const id = Number(payload.id);
            if (!Number.isSafeInteger(id) || id <= 0) {
                return jsonResponse({ error: 'Identificator invalid.' }, 400);
            }

            const { data: existing, error: selectError } = await supabase
                .from('rezervari')
                .select('id')
                .eq('id', id)
                .maybeSingle();
            if (selectError) throw selectError;
            if (!existing) return jsonResponse({ error: 'Rezervarea nu a fost găsită.' }, 404);

            const { error: updateError } = await supabase
                .from('rezervari')
                .update({ status: 'confirmat' })
                .eq('id', id);
            if (updateError) throw updateError;

            return jsonResponse({ ok: true });
        }

        if (payload.action === 'adauga_manual') {
            if (!isValidDate(payload.data)) {
                return jsonResponse({ error: 'Data selectată este invalidă.' }, 400);
            }

            const { error: insertError } = await supabase
                .from('rezervari')
                .insert({
                    nume: 'Rezervat Telefonic',
                    telefon: '',
                    eveniment: 'Eveniment telefonic',
                    data_eveniment: payload.data,
                    mesaj: 'Adăugată manual din panoul admin.',
                    gdpr_consent: false,
                    status: 'confirmat',
                });
            if (insertError) throw insertError;

            return jsonResponse({ ok: true }, 201);
        }

        return jsonResponse({ error: 'Acțiune necunoscută.' }, 400);
    } catch (error) {
        secureLogger.error('[api/admin-rezervari] POST error:', error);
        return jsonResponse({ error: 'Nu s-a putut actualiza lista rezervărilor.' }, 500);
    }
};