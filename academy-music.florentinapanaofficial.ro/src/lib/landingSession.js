import { supabase } from './supabase';
import { authRequest } from './securityClient';

export async function resumeLandingSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) return;
    try {
        await authRequest('session', {}, data.session.access_token);
    } catch (error) {
        if (error.status === 401 || error.status === 403) {
            await authRequest('session', {}, null, 'DELETE');
            const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
            if (signOutError) throw signOutError;
            const reason = ['locked', 'replaced', 'inactive', 'missing_profile'].includes(error.code) ? error.code : 'unauthorized';
            window.location.replace(`/login/?reason=${reason}`);
            return;
        }
        throw error;
    }
    window.location.replace('/dashboard/');
}
