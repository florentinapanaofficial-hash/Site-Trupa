import { createServer } from 'node:http';
import { handler as ssrHandler } from './dist/server/entry.mjs';
import sirv from 'sirv';
import compression from 'compression';

// ── Compression for SSR responses (static files use pre-built .gz/.br via sirv) ──
const compress = compression({ threshold: 256 });

// ── Static file serving — pre-compressed .gz/.br files served automatically ──
const serve = sirv('dist/client', {
    etag: true,
    gzip: true,
    brotli: true,
    maxAge: 300,          // 5 min default cache for HTML
    immutable: false,
    setHeaders(res, pathname) {
        // /_astro/* → hashed assets → 1 year immutable
        if (pathname.startsWith('/_astro/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // /images/* → 1 year
        else if (pathname.startsWith('/images/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
        // .svg, .ico, .webp → 1 year
        else if (pathname.endsWith('.svg') || pathname.endsWith('.ico') || pathname.endsWith('.webp')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
        // /fonts/ → 1 year
        else if (pathname.startsWith('/fonts/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
        // /js/* → static app scripts → 1 year with stale-while-revalidate
        else if (pathname.startsWith('/js/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, stale-while-revalidate=86400');
        }
        // Other JS → 1 day
        else if (pathname.endsWith('.js')) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
        // CSS → 1 day (non-fingerprinted)
        else if (pathname.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
        // robots.txt, sitemap → 1 day
        else if (pathname === '/robots.txt' || pathname.startsWith('/sitemap')) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
        // HTML pages → short cache + must-revalidate for fast deploys
        else if (pathname.endsWith('.html') || pathname === '/' || !pathname.includes('.')) {
            res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
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

const CANONICAL_HOST = 'www.florentinapanaofficial.ro';

const server = createServer((req, res) => {
    const host = req.headers.host || '';
    const proto = req.headers['x-forwarded-proto'] || 'https';

    // ── HTTP → HTTPS + non-www → www redirect (301) ──
    // Consolidat: un singur redirect spre URL-ul canonic cu trailing slash
    const bareHost = host.replace(/:\d+$/, '');
    const needsHttps = proto === 'http';
    const needsWww = bareHost === 'florentinapanaofficial.ro';

    if (needsHttps || needsWww) {
        const urlPath = (req.url || '/').split('?')[0];
        const search = (req.url || '').includes('?') ? '?' + (req.url || '').split('?')[1] : '';
        // Adaugă trailing slash direct dacă e nevoie (evită lanț de redirect-uri)
        const needsSlash = !urlPath.endsWith('/') && !urlPath.includes('.');
        const finalPath = needsSlash ? `${urlPath}/` : urlPath;
        const dest = `https://${CANONICAL_HOST}${finalPath}${search}`;
        res.writeHead(301, { Location: dest });
        return res.end();
    }

    // ── /index.html, /index.php → / (SEO: avoid duplicate content) ──
    if (req.url === '/index.html' || req.url === '/index.php') {
        res.writeHead(301, { Location: '/' });
        return res.end();
    }

    // ── /sitemap.xml → /sitemap-index.xml (Google Search Console compatibility) ──
    if (req.url === '/sitemap.xml') {
        res.writeHead(301, { Location: '/sitemap-index.xml' });
        return res.end();
    }

    // ── Trailing slash redirect (match Astro trailingSlash: 'always') ──
    // SSR pages don't have static index.html; sirv can't add the slash for them.
    const urlPath = (req.url || '/').split('?')[0];
    if (!urlPath.endsWith('/') && !urlPath.includes('.')) {
        const search = (req.url || '').includes('?') ? '?' + (req.url || '').split('?')[1] : '';
        res.writeHead(301, { Location: `${urlPath}/${search}` });
        return res.end();
    }

    // Security headers on ALL responses
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        res.setHeader(key, value);
    }

    // Static files first (pre-compressed via sirv), SSR with gzip fallback
    serve(req, res, () => {
        compress(req, res, () => {
            ssrHandler(req, res);
        });
    });
});

const port = parseInt(process.env.PORT || '4321', 10);
const host = process.env.HOST || '0.0.0.0';

server.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`);
});
