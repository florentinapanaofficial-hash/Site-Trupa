import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { authRequest } from './securityClient';
import { clearSignedUrlCache } from './media';
import { endActivitySession, setActivityToken, startActivitySession } from './activity';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(isSupabaseConfigured);
    const [securityError, setSecurityError] = useState('');
    const trackedUserRef = useRef(null);

    async function rejectSession(error) {
        console.error('[Academy security]', error.code || error.message);
        setSecurityError(error.message);
        setSession(null);
        setProfile(null);
        setActivityToken(null);
        clearSignedUrlCache();
        if (error.status === 401 || error.status === 403) {
            try {
                await authRequest('session', {}, null, 'DELETE');
            } finally {
                const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
                if (signOutError) console.error('[Academy security] Local signout failed:', signOutError.message);
                setLoading(false);
            }
        }
        setLoading(false);
    }

    useEffect(() => {
        if (!isSupabaseConfigured) return undefined;
        let active = true;
        let generation = 0;
        async function acceptSession(nextSession) {
            const current = ++generation;
            if (!nextSession) {
                if (active) {
                    setSession(null); setProfile(null); setActivityToken(null); setLoading(false);
                }
                return;
            }
            try {
                await authRequest('session', {}, nextSession.access_token);
                const { data, error } = await supabase.from('profiles')
                    .select('id, full_name, role, disciplines, grade_level, avatar_path, is_active, created_at')
                    .eq('id', nextSession.user.id).maybeSingle();
                if (error) throw error;
                if (!active || current !== generation) return;
                setSession(nextSession); setProfile(data); setSecurityError('');
                setActivityToken(nextSession.access_token); setLoading(false);
            } catch (error) {
                if (active && current === generation) {
                    await rejectSession(error).catch((failure) => {
                        console.error('[Academy security] Session cleanup failed:', failure.message);
                        setLoading(false);
                    });
                }
            }
        }
        supabase.auth.getSession().then(({ data, error }) => {
            if (error) { if (active) { setSecurityError(error.message); setLoading(false); } return; }
            if (active) acceptSession(data.session);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            // Supabase calls must run outside its auth callback to avoid locking the client.
            setTimeout(() => { if (active) acceptSession(nextSession); }, 0);
        });
        return () => { active = false; generation++; sub.subscription.unsubscribe(); };
    }, []);

    useEffect(() => {
        if (!session) return undefined;
        let checking = false;
        let active = true;
        async function check() {
            if (checking) return;
            checking = true;
            try { await authRequest('session', {}, session.access_token); }
            catch (error) {
                if (active) await rejectSession(error).catch((failure) => {
                    console.error('[Academy security] Session cleanup failed:', failure.message);
                });
            } finally { checking = false; }
        }
        const timer = setInterval(check, 30000);
        window.addEventListener('focus', check);
        return () => { active = false; clearInterval(timer); window.removeEventListener('focus', check); };
    }, [session?.access_token]);

    useEffect(() => {
        const userId = profile?.id;
        if (!userId) { trackedUserRef.current = null; return; }
        if (trackedUserRef.current === userId) return;
        trackedUserRef.current = userId;
        startActivitySession();
    }, [profile?.id]);

    const value = useMemo(() => {
        async function signIn(identity, password) {
            const { session: nextSession } = await authRequest('login', { identity, password });
            const { error } = await supabase.auth.setSession(nextSession);
            if (error) throw error;
        }
        async function signOut() {
            await endActivitySession();
            await authRequest('session', {}, session?.access_token, 'DELETE');
            const { error } = await supabase.auth.signOut({ scope: 'local' });
            if (error) throw error;
            trackedUserRef.current = null;
            clearSignedUrlCache(); setSession(null); setProfile(null); setSecurityError('');
        }
        async function resetPassword(email) {
            const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login/` });
            if (error) throw error;
        }
        function updateAvatarPath(avatarPath) {
            setProfile((current) => current?.id === session?.user?.id ? { ...current, avatar_path: avatarPath } : current);
        }
        return { session, user: session?.user ?? null, profile, loading, securityError, updateAvatarPath,
            isTeacher: ['teacher', 'profesor'].includes(profile?.role), isInspector: profile?.role === 'inspector',
            signIn, signOut, resetPassword };
    }, [session, profile, loading, securityError]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth trebuie folosit în interiorul <AuthProvider>.');
    return ctx;
}
