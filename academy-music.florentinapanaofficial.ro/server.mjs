import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sirv from 'sirv';

const root = dirname(fileURLToPath(import.meta.url));
const clientDir = join(root, 'dist');
const port = Number(process.env.PORT) || 4180;

const SUPABASE_HOST = process.env.SUPABASE_HOST || 'https://*.supabase.co';

/**
 * `script-src` fără `unsafe-eval`: pdf.js rulează cu `isEvalSupported: false`.
 * `frame-ancestors 'none'` blochează încadrarea platformei în alt site.
 */
const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${SUPABASE_HOST}`,
    `media-src 'self' blob: ${SUPABASE_HOST}`,
    `connect-src 'self' ${SUPABASE_HOST} wss://*.supabase.co`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
].join('; ');

const SECURITY_HEADERS = {
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Studioul de înregistrare are nevoie de microfon și cameră pe propriul origin.
    'Permissions-Policy': 'geolocation=(), camera=(self), microphone=(self), payment=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    // Platformă privată: nu trebuie indexată nicăieri.
    'X-Robots-Tag': 'noindex, nofollow',
};

const assets = sirv(clientDir, {
    single: true,
    etag: true,
    gzip: true,
    brotli: true,
    setHeaders(res, pathname) {
        if (pathname.startsWith('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
            res.setHeader('Cache-Control', 'no-cache');
        }
    },
});

createServer((req, res) => {
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
        res.setHeader(header, value);
    }

    assets(req, res, () => {
        res.statusCode = 404;
        res.end('Not found');
    });
}).listen(port, () => {
    console.log(`Academy Music rulează pe portul ${port}`);
});
