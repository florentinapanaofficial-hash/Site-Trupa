import { createClient } from '@supabase/supabase-js';
import { ACCESS_COOKIE, createSecurityBackend, readAuthInput, writeAccessCookie, jsonResponse, securityFailure, SecurityError } from '../../../lib/securityServer.js';
export const prerender = false;

export async function POST({ request, cookies, locals }) {
    try {
        await readAuthInput(request);
        if (!locals.academySecurity) throw new SecurityError('unauthorized');
        writeAccessCookie(cookies, request, { access_token: locals.academySecurity.token });
        return jsonResponse({ ok: true });
    } catch (error) { return securityFailure(error); }
}
export async function DELETE({ request, cookies }) {
    try {
        await readAuthInput(request);
        const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
        if (token) await createSecurityBackend(process.env, createClient).end(token);
        cookies.delete(ACCESS_COOKIE, { path: '/' });
        return jsonResponse({ ok: true });
    } catch (error) { return securityFailure(error); }
}
