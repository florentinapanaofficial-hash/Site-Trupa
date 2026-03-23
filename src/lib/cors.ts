/**
 * CORS origin whitelist built from environment variables.
 *
 * Reads PUBLIC_SITE_URL and PUBLIC_SITE_URL_WWW at module load time
 * and always includes the canonical production domain as a hard fallback.
 */

const FALLBACK_ORIGIN = 'https://www.florentinapanaofficial.ro';

function normalise(raw: string | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim().replace(/\/$/, '');
    // Reject obviously invalid values (no dot, no protocol)
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null;
    return trimmed;
}

const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
    [
        normalise(import.meta.env.PUBLIC_SITE_URL),
        normalise(import.meta.env.PUBLIC_SITE_URL_WWW),
        FALLBACK_ORIGIN,
    ].filter((v): v is string => v !== null),
);

export type CorsResult =
    | { allowed: true; origin: string }  // cross-origin, in whitelist — set ACAO header
    | { allowed: true; origin: null }    // no Origin header (same-origin / server-to-server)
    | { allowed: false; origin: null };  // Origin present but NOT in whitelist — reject 403

/**
 * Checks whether the request origin is permitted.
 *
 * - No `Origin` header → `{ allowed: true, origin: null }` (same-origin / server-to-server).
 * - `Origin` in whitelist → `{ allowed: true, origin: <origin> }` (set ACAO header).
 * - `Origin` not in whitelist → `{ allowed: false, origin: null }` (return 403, do NOT reflect).
 */
export function checkOrigin(request: Request): CorsResult {
    const origin = request.headers.get('origin');
    if (origin === null) {
        return { allowed: true, origin: null };
    }
    if (ALLOWED_ORIGINS.has(origin)) {
        return { allowed: true, origin };
    }
    return { allowed: false, origin: null };
}
