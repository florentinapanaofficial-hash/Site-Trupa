import { defineMiddleware } from 'astro:middleware';

const isDev = import.meta.env.DEV;

// Aplicate pe fiecare răspuns — protecție OWASP Top 10
const SECURITY_HEADERS: Record<string, string> = {
    // Previne clickjacking (iframe embedding de pe alte domenii)
    'X-Frame-Options': 'SAMEORIGIN',
    // Previne MIME-type sniffing (atacuri prin fișiere deghizate)
    'X-Content-Type-Options': 'nosniff',
    // Controlează informațiile trimise în header-ul Referer
    'Referrer-Policy': 'origin-when-cross-origin',
    // Dezactivează API-uri de browser nefolosite (cameră, microfon, locație, plăți)
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    // Cross-Origin: previne leak-ul de date între origini
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-origin',
    // Content Security Policy — protejează contra XSS și injecții de resurse
    'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https://www.google-analytics.com https://i.ytimg.com https://img.youtube.com https://*.googleusercontent.com https://*.cloudflarestream.com https://videodelivery.net",
        "font-src 'self'",
        "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://api.whatsapp.com https://*.supabase.co wss://*.supabase.co https://*.cloudflarestream.com https://videodelivery.net",
        "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://ec.europa.eu https://*.cloudflarestream.com https://iframe.cloudflarestream.com",
        "media-src 'self' blob: https://*.cloudflarestream.com https://videodelivery.net",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self' https://api.whatsapp.com",
        "frame-ancestors 'self'",
    ].join('; '),
};

const CANONICAL_HOST = 'www.florentinapanaofficial.ro';

export const onRequest = defineMiddleware(async (context, next) => {
    const host = context.request.headers.get('host') ?? '';
    const proto = context.request.headers.get('x-forwarded-proto') ?? 'https';

    // HTTP → HTTPS redirect (301)
    if (proto === 'http') {
        const dest = `https://${host}${context.url.pathname}${context.url.search}`;
        return Response.redirect(dest, 301);
    }

    // non-www → www redirect (301) – o singură versiune canonică
    const bareHost = host.replace(/:\d+$/, '');
    if (bareHost === 'florentinapanaofficial.ro') {
        const dest = `https://${CANONICAL_HOST}${context.url.pathname}${context.url.search}`;
        return Response.redirect(dest, 301);
    }

    // Redirect /index.html, /index.php → / (SEO: evită conținut duplicat)
    const { pathname } = context.url;
    if (pathname === '/index.html' || pathname === '/index.php') {
        const clean = new URL(context.request.url);
        clean.pathname = '/';
        return Response.redirect(clean.toString(), 301);
    }

    // Redirect /sitemap.xml → /sitemap-index.xml (compatibilitate Google Search Console)
    if (pathname === '/sitemap.xml') {
        const clean = new URL(context.request.url);
        clean.pathname = '/sitemap-index.xml';
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
