import { createServer } from 'node:http';
import { handler as ssrHandler } from './dist/server/entry.mjs';
import sirv from 'sirv';
import compression from 'compression';

// ── Compression (gzip/brotli) for all responses ──
const compress = compression({ threshold: 256 });

// ── Static file serving (CSS, JS, images from dist/client) ──
const serve = sirv('dist/client', {
    etag: true,
    gzip: true,
    brotli: true,
    setHeaders(res, pathname) {
        // /_astro/* → hashed assets → 1 year immutable
        if (pathname.startsWith('/_astro/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // /images/, /fonts/ → 7 days + stale-while-revalidate
        else if (pathname.startsWith('/images/') || pathname.startsWith('/fonts/')) {
            res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
        }
        // robots.txt, sitemap → 1 day
        else if (pathname === '/robots.txt' || pathname.startsWith('/sitemap')) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    },
});

// ── Security headers (OWASP) ──
const SECURITY_HEADERS = {
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

const server = createServer((req, res) => {
    const host = req.headers.host || '';

    // ── WWW redirect (production only) ──
    if (host === 'florentinapanaofficial.ro') {
        res.writeHead(301, { Location: `https://www.florentinapanaofficial.ro${req.url}` });
        return res.end();
    }

    // ── /index.html, /index.php → / (SEO: avoid duplicate content) ──
    if (req.url === '/index.html' || req.url === '/index.php') {
        res.writeHead(301, { Location: '/' });
        return res.end();
    }

    // Security headers on ALL responses
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        res.setHeader(key, value);
    }

    // Compression → static files → SSR handler
    compress(req, res, () => {
        serve(req, res, () => {
            ssrHandler(req, res);
        });
    });
});

const port = parseInt(process.env.PORT || '4321', 10);
const host = process.env.HOST || '0.0.0.0';

server.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`);
});
