import { defineMiddleware } from 'astro:middleware';

const isDev = import.meta.env.DEV;

// Aplicate pe fiecare răspuns — protecție OWASP Top 10
const SECURITY_HEADERS: Record<string, string> = {
    // Previne clickjacking (iframe embedding de pe alte domenii)
    'X-Frame-Options': 'SAMEORIGIN',
    // Previne MIME-type sniffing (atacuri prin fișiere deghizate)
    'X-Content-Type-Options': 'nosniff',
    // Controlează informațiile trimise în header-ul Referer
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Dezactivează API-uri de browser nefolosite (cameră, microfon, locație, plăți)
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    // Cross-Origin: previne leak-ul de date între origini
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-origin',
};

export const onRequest = defineMiddleware(async (context, next) => {
    const host = context.request.headers.get('host') ?? '';

    // Redirect non-www să www în producție
    if (!isDev && host === 'florentinapanaofficial.ro') {
        const url = new URL(context.request.url);
        url.host = 'www.florentinapanaofficial.ro';
        return Response.redirect(url.toString(), 301);
    }

    // Redirect /index.html, /index.php → / (SEO: evită conținut duplicat)
    const { pathname } = context.url;
    if (pathname === '/index.html' || pathname === '/index.php') {
        const clean = new URL(context.request.url);
        clean.pathname = '/';
        return Response.redirect(clean.toString(), 301);
    }

    const response = await next();

    // Aplică security headers pe toate răspunsurile
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        response.headers.set(key, value);
    }

    // HSTS doar în producție — Railway servește totul prin HTTPS
    // max-age=1 an; includeSubDomains protejează și subdomenii
    if (!isDev) {
        response.headers.set(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains',
        );
    }

    // Blochează indexarea rutelor interne de către crawlere
    if (pathname.startsWith('/api/') || pathname.startsWith('/admin/')) {
        response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    }

    // ── Cache-Control headers (Railway + AWS CloudFront) ──────────────────
    // /_astro/* → fișiere cu hash content (Astro build) → 1 an, immutable
    if (pathname.startsWith('/_astro/')) {
        response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
    // /images/, /fonts/ → fișiere statice → 7 zile + stale-while-revalidate
    else if (pathname.startsWith('/images/') || pathname.startsWith('/fonts/')) {
        response.headers.set('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    }
    // robots.txt, sitemap → 1 zi
    else if (
        pathname === '/robots.txt' ||
        pathname === '/sitemap.xml' ||
        pathname === '/sitemap-index.xml'
    ) {
        response.headers.set('Cache-Control', 'public, max-age=86400');
    }
    // API → niciodată în cache (date dinamice, GDPR)
    else if (pathname.startsWith('/api/')) {
        response.headers.set('Cache-Control', 'no-store');
    }
    // Pagini HTML → revalidare la fiecare vizită (SSR cu conținut dinamic)
    else {
        response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
    }

    return response;
});
