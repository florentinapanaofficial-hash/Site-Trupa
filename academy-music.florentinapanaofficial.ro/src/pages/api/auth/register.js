import { createClient } from '@supabase/supabase-js';
import { createSecurityBackend, CONSENT_VERSION, readAuthInput, jsonResponse, securityFailure, SecurityError } from '../../../lib/securityServer.js';
export const prerender = false;

export async function POST({ request }) {
    try {
        const input = await readAuthInput(request);
        if (input.parentalConsent !== true) throw new SecurityError('consent_required', 400, 'Acordul părintelui/tutorelui legal este obligatoriu.');
        if (typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)
            || typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 128
            || typeof input.fullName !== 'string' || !input.fullName.trim() || input.fullName.length > 120) {
            throw new SecurityError('invalid_input', 400, 'Completează numele, un email valid și o parolă de 12–128 caractere.');
        }
        const backend = createSecurityBackend(process.env, createClient);
        const { error } = await backend.auth().signUp({
            email: input.email.trim().toLowerCase(), password: input.password,
            options: { data: { full_name: input.fullName.trim(), parental_consent: true, consent_version: CONSENT_VERSION } },
        });
        if (error) {
            if (error.status === 429) throw new SecurityError('rate_limited', 429, 'Prea multe încercări. Încearcă mai târziu.');
            console.error('[Academy security] Registration failed:', error.code);
            if (!error.status || error.status >= 500) throw new SecurityError('auth_unavailable', 503);
            throw new SecurityError('registration_failed', 400, 'Înregistrarea nu a putut fi procesată. Contactează administratorul.');
        }
        return jsonResponse({ message: 'Verifică emailul pentru confirmare, apoi autentifică-te. Dacă ai deja cont, folosește autentificarea.' });
    } catch (error) { return securityFailure(error); }
}
