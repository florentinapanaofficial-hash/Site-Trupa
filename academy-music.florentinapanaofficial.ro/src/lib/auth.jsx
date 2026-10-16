import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { loginEmailForIdentity } from './studentCredentials';
import { clearSignedUrlCache } from './media';
import { endActivitySession, setActivityToken, startActivitySession } from './activity';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(isSupabaseConfigured);
    const trackedUserRef = useRef(null);

    useEffect(() => {
        if (!isSupabaseConfigured) return undefined;

        let active = true;

        async function loadProfile(userId) {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, role, disciplines, grade_level, avatar_path, is_active, created_at')
                .eq('id', userId)
                .maybeSingle();

            if (!active) return;
            if (error) {
                setProfile(null);
            } else {
                setProfile(data);
            }
            setLoading(false);
        }

        supabase.auth.getSession().then(({ data }) => {
            if (!active) return;
            setSession(data.session);
            setActivityToken(data.session?.access_token ?? null);
            if (data.session?.user) {
                loadProfile(data.session.user.id);
            } else {
                setLoading(false);
            }
        });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            setActivityToken(nextSession?.access_token ?? null);

            // Apelurile Supabase nu se fac sincron în acest callback: blochează clientul intern.
            setTimeout(() => {
                if (!active) return;
                if (nextSession?.user) {
                    loadProfile(nextSession.user.id);
                } else {
                    setProfile(null);
                    setLoading(false);
                }
            }, 0);
        });

        return () => {
            active = false;
            sub.subscription.unsubscribe();
        };
    }, []);

    // Sesiunea de activitate pornește o singură dată per utilizator autentificat.
    useEffect(() => {
        const userId = profile?.id;
        if (!userId || trackedUserRef.current === userId) return;
        trackedUserRef.current = userId;
        startActivitySession();
    }, [profile?.id]);

    const value = useMemo(() => {
        async function signIn(identity, password) {
            const { error } = await supabase.auth.signInWithPassword({
                email: loginEmailForIdentity(identity),
                password,
            });
            if (error) throw error;
        }

        async function signOut() {
            await endActivitySession();
            trackedUserRef.current = null;
            clearSignedUrlCache();
            await supabase.auth.signOut();
            setProfile(null);
        }

        async function resetPassword(email) {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/login`,
            });
            if (error) throw error;
        }

        return {
            session,
            user: session?.user ?? null,
            profile,
            loading,
            isTeacher: profile?.role === 'teacher',
            signIn,
            signOut,
            resetPassword,
        };
    }, [session, profile, loading]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth trebuie folosit în interiorul <AuthProvider>.');
    return ctx;
}
