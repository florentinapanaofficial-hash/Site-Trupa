import { isIP } from 'node:net';

import { SECURITY_MESSAGES } from './securityMessages.js';
export { SECURITY_MESSAGES };
export const CONSENT_VERSION = '2026-10-20';
export const ACCESS_COOKIE = 'academy-access';

export class SecurityError extends Error {
    constructor(code, status = 401, message = SECURITY_MESSAGES[code]) {
        super(message || 'Verificarea securității nu este disponibilă. Încearcă din nou.');
        this.code = code;
        this.status = status;
    }
}

export function clientIP(request, clientAddress, env) {
    const header = env.ACADEMY_TRUSTED_IP_HEADER;
    let ip;
    if (header) {
        if (!['x-forwarded-for', 'x-real-ip'].includes(header)) throw new SecurityError('proxy_configuration', 503);
        const hops = Number(env.ACADEMY_TRUSTED_PROXY_HOPS);
        if (!Number.isInteger(hops) || hops < 1 || hops > 10) throw new SecurityError('proxy_configuration', 503);
        const chain = (request.headers.get(header) || '').split(',').map((part) => part.trim());
        if (header === 'x-real-ip' && (chain.length !== 1 || hops !== 1)) throw new SecurityError('proxy_configuration', 503);
        ip = chain[chain.length - hops];
    } else {
        if (env.NODE_ENV === 'production') throw new SecurityError('proxy_configuration', 503);
        ip = clientAddress;
    }
    if (ip?.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
    if (!ip || !isIP(ip)) throw new SecurityError('invalid_client_ip', 503);
    return ip;
}

export function verifiedSessionId(token) {
    // Call only after Auth has verified the token with getUser().
    let payload;
    try {
        payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    } catch (error) {
        if (!(error instanceof SyntaxError || error instanceof TypeError)) throw error;
        throw new SecurityError('unauthorized');
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new SecurityError('unauthorized');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.session_id || '')) {
        throw new SecurityError('unauthorized');
    }
    return payload.session_id;
}

export function createSecurityBackend(env, createClient) {
    const url = env.VITE_SUPABASE_URL;
    const anon = env.VITE_SUPABASE_ANON_KEY;
    const service = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !service) throw new SecurityError('server_configuration', 503);
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    const admin = createClient(url, service, options);
    const auth = () => createClient(url, anon, options).auth;

    async function check(token, request, address, register = false) {
        const { data, error } = await auth().getUser(token);
        if (error) {
            const invalid = [400, 401, 403].includes(error.status);
            throw new SecurityError(invalid ? 'unauthorized' : 'auth_unavailable', invalid ? 401 : 503);
        }
        if (!data.user) throw new SecurityError('unauthorized');
        const sessionId = verifiedSessionId(token);
        const { data: result, error: checkError } = await admin.rpc('academy_check_session', {
            p_user_id: data.user.id,
            p_session_id: sessionId,
            p_ip: clientIP(request, address, env),
            p_user_agent: request.headers.get('user-agent') || '',
            p_register: register,
        });
        if (checkError) {
            console.error('[Academy security] Session database check failed:', checkError.code);
            throw new SecurityError('security_unavailable', 503);
        }
        if (result !== 'ok') {
            if (!Object.hasOwn(SECURITY_MESSAGES, result)) throw new SecurityError('invalid_security_response', 503);
            throw new SecurityError(result, result === 'replaced' ? 401 : 403);
        }
        return { user: data.user, sessionId, token };
    }

    async function end(token) {
        const { data, error } = await auth().getUser(token);
        if (error && ![400, 401, 403].includes(error.status)) throw new SecurityError('auth_unavailable', 503);
        if (error || !data.user) throw new SecurityError('unauthorized');
        const { error: endError } = await admin.rpc('academy_end_session', { p_user_id: data.user.id, p_session_id: verifiedSessionId(token) });
        if (endError) throw new SecurityError('security_unavailable', 503);
    }
    return { auth, check, end };
}

export function writeAccessCookie(cookies, request, session) {
    cookies.set(ACCESS_COOKIE, session.access_token, {
        httpOnly: true, secure: new URL(request.url).protocol === 'https:',
        sameSite: 'lax', path: '/', maxAge: Math.max(1, session.expires_in || 3600),
    });
}

export function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: {
        'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store',
    } });
}

export function securityFailure(error) {
    if (!(error instanceof SecurityError)) {
        console.error('[Academy security] Unexpected backend error:', error.name);
        return jsonResponse({ error: 'Serviciul de autentificare nu este disponibil.', code: 'server_error' }, 503);
    }
    if (error.status >= 500) console.error('[Academy security]', error.code);
    return jsonResponse({ error: error.message, code: error.code }, error.status);
}

export async function readAuthInput(request) {
    const origin = request.headers.get('origin');
    if (origin !== new URL(request.url).origin) throw new SecurityError('invalid_origin', 403, 'Origine neautorizată.');
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw new SecurityError('invalid_input', 400, 'Date invalide.');
    const reader = request.body?.getReader();
    if (!reader) throw new SecurityError('invalid_input', 400, 'Date invalide.');
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 8192) {
                await reader.cancel();
                throw new SecurityError('invalid_input', 413, 'Cerere prea mare.');
            }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    try {
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SyntaxError();
        return input;
    } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        throw new SecurityError('invalid_input', 400, 'Date invalide.');
    }
}

export async function secureAcademyRequest(context, env, createClient) {
    const { request, url, cookies } = context;
    const path = url.pathname.replace(/\/$/, '') || '/';
    const publicAuth = ['/api/auth/login', '/api/auth/register'];
    if (publicAuth.includes(path) || (path === '/api/auth/session' && request.method === 'DELETE')) return null;
    if (path.startsWith('/_astro/') || path.startsWith('/images/') || path.startsWith('/fonts/')
        || path.startsWith('/revista/') || path === '/revista'
        || ['/favicon.ico', '/robots.txt', '/manifest.webmanifest', '/login', '/register', '/setup'].includes(path)) return null;
    const authorization = request.headers.get('authorization');
    const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    const token = bearer || cookies.get(ACCESS_COOKIE)?.value;
    if (path === '/' && !token) return null;
    try {
        if (!token) throw new SecurityError('unauthorized');
        context.locals.academySecurity = await createSecurityBackend(env, createClient).check(token, request, context.clientAddress);
        if (path === '/orga') return new Response(null, { status: 301, headers: { Location: '/instrument/', 'Cache-Control': 'private, no-store' } });
        if (path === '/') return new Response(null, { status: 303, headers: { Location: '/dashboard/', 'Cache-Control': 'private, no-store' } });
        return null;
    } catch (error) {
        if (error instanceof SecurityError && error.status < 500) cookies.delete(ACCESS_COOKIE, { path: '/' });
        if (path === '/' && !bearer && error instanceof SecurityError && error.code === 'unauthorized') return null;
        if (path.startsWith('/api/') || bearer || !(error instanceof SecurityError) || error.status >= 500) return securityFailure(error);
        const reason = Object.hasOwn(SECURITY_MESSAGES, error.code) ? error.code : 'unauthorized';
        return new Response(null, { status: 303, headers: { Location: `/login/?reason=${reason}`, 'Cache-Control': 'private, no-store' } });
    }
}
