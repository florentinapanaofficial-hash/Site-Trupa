import { defineMiddleware } from 'astro:middleware';
import { env as workerEnv } from 'cloudflare:workers';
import { createClient } from '@supabase/supabase-js';
import { secureAcademyRequest } from './lib/securityServer.js';

const TONE_SAMPLE_ORIGIN = 'https://tonejs.github.io';
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Studioul de înregistrare are nevoie de microfon și cameră pe propriul origin.
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    // Platformă privată: nu trebuie indexată nicăieri.
    'X-Robots-Tag': 'noindex, nofollow',
};

export const onRequest = defineMiddleware(async (context, next) => {
    context.locals.workerEnv = workerEnv;
    const SUPABASE_HOST = workerEnv.SUPABASE_HOST || 'https://*.supabase.co';
    const MEDIA_ORIGIN = new URL(workerEnv.MEDIA_ORIGIN || 'https://media.florentinapanaofficial.ro').origin;
    const jitsiDomain = workerEnv.JITSI_DOMAIN || '';
    if (jitsiDomain && !/^[a-z0-9.-]+$/i.test(jitsiDomain)) throw new Error('JITSI_DOMAIN trebuie să fie un hostname fără schemă sau cale.');
    const jitsiOrigin = jitsiDomain ? `https://${jitsiDomain}` : '';
    const response = await secureAcademyRequest(context, workerEnv, createClient) || await next();
    // Hash the final SSR HTML so hydrated Astro components keep working under CSP.
    const html = response.headers.get('Content-Type')?.includes('text/html') ? await response.text() : null;
    const inlineScriptHashes = new Set();
    if (html !== null) {
        for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
            if (script[1]) {
                const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(script[1]));
                const encoded = btoa(String.fromCharCode(...new Uint8Array(digest)));
                inlineScriptHashes.add(`'sha256-${encoded}'`);
            }
        }
    }
    const CSP = [
        "default-src 'self'",
        `script-src 'self' ${jitsiOrigin} ${[...inlineScriptHashes].join(' ')}`,
        `frame-src 'self' ${jitsiOrigin}`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        `img-src 'self' data: blob: ${SUPABASE_HOST}`,
        `media-src 'self' blob: ${SUPABASE_HOST} ${MEDIA_ORIGIN}`,
        `connect-src 'self' ${SUPABASE_HOST} wss://*.supabase.co ${MEDIA_ORIGIN} ${TONE_SAMPLE_ORIGIN}`,
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        'upgrade-insecure-requests',
    ].join('; ');

    const secured = new Response(html ?? response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) secured.headers.set(header, value);
    secured.headers.set('Permissions-Policy', `geolocation=(), camera=(self${jitsiOrigin ? ` "${jitsiOrigin}"` : ''}), microphone=(self${jitsiOrigin ? ` "${jitsiOrigin}"` : ''}), payment=()`);
    secured.headers.set('Content-Security-Policy', CSP);
    if (context.url.pathname === '/' || context.locals.academySecurity || context.url.pathname.startsWith('/api/auth/')) {
        secured.headers.set('Cache-Control', 'private, no-store');
    } else if (!secured.headers.has('Cache-Control')) secured.headers.set('Cache-Control', 'no-cache');
    return secured;
});
