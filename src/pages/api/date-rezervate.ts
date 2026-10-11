import type { APIRoute } from 'astro';
import { requireSupabaseAdmin } from '../../lib/supabase';
import { secureLogger } from '../../lib/secure-logger.js';

export const prerender = false;

export const GET: APIRoute = async () => {
    try {
        const { data, error } = await requireSupabaseAdmin()
            .from('rezervari')
            .select('data_eveniment')
            .eq('status', 'confirmat')
            .not('data_eveniment', 'is', null)
            .order('data_eveniment', { ascending: true });

        if (error) throw error;

        // PostgREST nu are DISTINCT: deduplicarea se face aici, pe rezultatul sortat.
        const dates = [...new Set(
            (data ?? [])
                .map((row) => row.data_eveniment)
                .filter((date): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)),
        )];

        return new Response(JSON.stringify(dates), {
            headers: {
                'Cache-Control': 'no-store',
                'Content-Type': 'application/json; charset=utf-8',
            },
        });
    } catch (error) {
        secureLogger.error('[api/date-rezervate] DB error:', error);
        return new Response(JSON.stringify({ error: 'Datele rezervate nu sunt disponibile momentan.' }), {
            status: 500,
            headers: {
                'Cache-Control': 'no-store',
                'Content-Type': 'application/json; charset=utf-8',
            },
        });
    }
};