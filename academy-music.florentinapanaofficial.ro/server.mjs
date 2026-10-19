import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sirv from 'sirv';
import { handler as ssrHandler } from './dist/server/entry.mjs';

const root = dirname(fileURLToPath(import.meta.url));
for (const filename of [join(root, '.env'), join(root, '..', '.env')]) {
    try { process.loadEnvFile(filename); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const clientDir = join(root, 'dist', 'client');
const port = Number(process.env.PORT) || 4180;

const SUPABASE_HOST = process.env.SUPABASE_HOST || 'https://*.supabase.co';
const MEDIA_ORIGIN = new URL(process.env.MEDIA_ORIGIN || 'https://media.florentinapanaofficial.ro').origin;
const jitsiDomain = process.env.JITSI_DOMAIN || '';
if (jitsiDomain && !/^[a-z0-9.-]+$/i.test(jitsiDomain)) throw new Error('JITSI_DOMAIN trebuie să fie un hostname fără schemă sau cale.');
const jitsiOrigin = jitsiDomain ? `https://${jitsiDomain}` : '';
const inlineScriptHashes = new Set();
for (const filename of readdirSync(clientDir, { recursive: true })) {
    if (!filename.endsWith('.html')) continue;
    const html = readFileSync(join(clientDir, filename), 'utf8');
    for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        if (script[1]) inlineScriptHashes.add(`'sha256-${createHash('sha256').update(script[1]).digest('base64')}'`);
    }
}

/**
 * `script-src` fără `unsafe-eval`: pdf.js rulează cu `isEvalSupported: false`.
 * `frame-ancestors 'none'` blochează încadrarea platformei în alt site.
 */
const CSP = [
    "default-src 'self'",
    `script-src 'self' ${jitsiOrigin} ${[...inlineScriptHashes].join(' ')}`,
    `frame-src 'self' ${jitsiOrigin}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${SUPABASE_HOST}`,
    `media-src 'self' blob: ${SUPABASE_HOST} ${MEDIA_ORIGIN}`,
    `connect-src 'self' ${SUPABASE_HOST} wss://*.supabase.co ${MEDIA_ORIGIN}`,
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
    'Permissions-Policy': `geolocation=(), camera=(self${jitsiOrigin ? ` "${jitsiOrigin}"` : ''}), microphone=(self${jitsiOrigin ? ` "${jitsiOrigin}"` : ''}), payment=()`,
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    // Platformă privată: nu trebuie indexată nicăieri.
    'X-Robots-Tag': 'noindex, nofollow',
};

const assets = sirv(clientDir, {
    single: false,
    etag: true,
    gzip: true,
    brotli: true,
    setHeaders(res, pathname) {
        if (pathname.startsWith('/assets/') || pathname.startsWith('/_astro/')) {
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

    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) {
        ssrHandler(req, res, (error) => {
            res.statusCode = error ? 500 : 404;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify({ error: error ? 'Serviciul nu este disponibil.' : 'Endpoint inexistent.' }));
        });
        return;
    }
    if (pathname === '/revista' || pathname === '/studio') {
        res.writeHead(301, { Location: `${pathname}/` });
        res.end();
        return;
    }
    assets(req, res, () => {
        if (!/^\/(revista|studio)(\/|$)/.test(pathname) && !pathname.split('/').pop().includes('.')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.end(readFileSync(join(clientDir, 'index.html')));
            return;
        }
        res.statusCode = 404;
        res.end('Not found');
    });
}).listen(port, () => {
    console.log(`Academy Music rulează pe portul ${port}`);
});
