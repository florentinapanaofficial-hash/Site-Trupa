import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';

export function useStudyAccess() {
    const [access, setAccess] = useState({ loaded: false, canWrite: false });
    useEffect(() => {
        if (!isSupabaseConfigured) { setAccess({ loaded: true, canWrite: false }); return; }
        let active = true;
        let generation = 0;
        async function load() {
            const current = ++generation;
            const { data } = await supabase.auth.getUser();
            const result = data.user ? await supabase.from('profiles').select('role,is_active').eq('id', data.user.id).maybeSingle() : null;
            if (active && current === generation) setAccess({ loaded: true, canWrite: Boolean(result?.data?.is_active && ['teacher', 'student', 'profesor', 'elev'].includes(result.data.role)) });
        }
        void load();
        const { data } = supabase.auth.onAuthStateChange(() => {
            generation += 1;
            if (active) setAccess({ loaded: false, canWrite: false });
            setTimeout(() => { if (active) void load(); }, 0);
        });
        return () => { active = false; data.subscription.unsubscribe(); };
    }, []);
    return access;
}