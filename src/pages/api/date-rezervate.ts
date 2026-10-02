import type { APIRoute } from 'astro';
import { query } from '../../lib/db.js';
import { secureLogger } from '../../lib/secure-logger.js';

export const prerender = false;

type ReservedDateRow = {
    data_eveniment: string | null;
};

export const GET: APIRoute = async () => {
    try {
        const rows = await query(
            `SELECT DISTINCT DATE_FORMAT(data_eveniment, '%Y-%m-%d') AS data_eveniment
             FROM rezervari
             WHERE data_eveniment IS NOT NULL
               AND data_eveniment >= '1000-01-01'
             ORDER BY data_eveniment ASC`,
        ) as ReservedDateRow[];

        const dates = rows
            .map((row) => row.data_eveniment)
            .filter((date): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date));

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