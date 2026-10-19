import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

export function useMyRepertoire() {
    const { profile } = useAuth();
    const [rows, setRows] = useState(null);

    const reload = useCallback(async () => {
        if (!profile?.id) return;

        const { data } = await supabase.from('pieces').select('*').eq('is_published', true).order('title');
        setRows((data || []).map((piece) => ({ piece_id: piece.id, pieces: piece })));
    }, [profile?.id]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { rows, reload };
}
