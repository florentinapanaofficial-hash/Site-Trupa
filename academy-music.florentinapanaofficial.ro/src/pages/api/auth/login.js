import { createClient } from '@supabase/supabase-js';
import { signInWithIdentity } from '../../../lib/studentCredentials.js';
import { ACCESS_COOKIE, createSecurityBackend, readAuthInput, writeAccessCookie, jsonResponse, securityFailure, SecurityError } from '../../../lib/securityServer.js';
export const prerender = false;

export async function POST({ request, cookies, clientAddress, locals }) {
    try {
        const input = await readAuthInput(request);
        if (typeof input.identity !== 'string' || !input.identity.trim() || input.identity.length > 254
            || typeof input.password !== 'string' || !input.password || input.password.length > 128) {
            throw new SecurityError('invalid_input', 400, 'Completează username-ul/emailul și parola.');
        }
        const backend = createSecurityBackend(locals?.workerEnv ?? {}, createClient);
        const auth = backend.auth();
        let data;
        try {
            data = await signInWithIdentity(auth, input.identity, input.password);
        } catch (error) {
            if (error.status === 400 || error.status === 401) throw new SecurityError('invalid_credentials', 401, 'Username, email sau parolă incorectă.');
            if (error.status === 429) throw new SecurityError('rate_limited', 429, 'Prea multe încercări. Încearcă mai târziu.');
            throw error;
        }
        await backend.check(data.session.access_token, request, clientAddress, true, Boolean(locals?.cfContext));
        writeAccessCookie(cookies, request, data.session);
        return jsonResponse({ session: data.session });
    } catch (error) {
        if (error instanceof SecurityError && (error.status === 401 || error.status === 403)) cookies.delete(ACCESS_COOKIE, { path: '/' });
        return securityFailure(error);
    }
}
