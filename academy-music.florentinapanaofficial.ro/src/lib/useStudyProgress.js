import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { normalizeStudyProgress } from './studyLevels';
export function useStudyProgress(profile, enabled = true) {
    const [state, setState] = useState({ loading: true, error: '', progress: null });
    const reload = useCallback(async () => {
        if (!enabled || !profile?.id) {
            setState({ loading: false, error: '', progress: null });
            return;
        }
        setState((current) => ({ ...current, loading: true, error: '' }));
        const { data, error } = await supabase.rpc('get_my_study_progress');
        if (error) {
            console.error('[Academy] Progresul studiului nu a putut fi încărcat:', error.message);
            setState({ loading: false, error: 'Progresul temelor nu este disponibil momentan.', progress: null });
            return;
        }
        setState({ loading: false, error: '', progress: normalizeStudyProgress(data, profile.study_level) });
    }, [enabled, profile?.id, profile?.study_level]);
    useEffect(() => { void reload(); }, [reload]);
    const safeProgress = state.progress || normalizeStudyProgress(null, profile?.study_level);
    return { ...state, progress: safeProgress, reload };
}
