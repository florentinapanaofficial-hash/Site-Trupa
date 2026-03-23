/**
 * Sanitize a URL before placing it in an href/src attribute.
 *
 * Allows:
 *   - Relative paths starting with "/" or "#"
 *   - Absolute URLs with https://, http://, mailto:, or tel: schemes
 *
 * Rejects anything else (javascript:, data:, vbscript:, …) by
 * returning the safe fallback "#".
 */
export function sanitizeUrl(url: string | null | undefined, fallback = '#'): string {
    if (!url) return fallback;
    const trimmed = url.trim();
    if (trimmed === '') return fallback;

    // Allow safe relative paths
    if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;

    // Validate absolute URLs via the URL constructor to avoid bypass tricks
    try {
        const parsed = new URL(trimmed);
        const scheme = parsed.protocol.toLowerCase();
        if (scheme === 'https:' || scheme === 'http:' || scheme === 'mailto:' || scheme === 'tel:') {
            return trimmed;
        }
    } catch {
        // Not a valid absolute URL — fall through to reject
    }

    return fallback;
}
