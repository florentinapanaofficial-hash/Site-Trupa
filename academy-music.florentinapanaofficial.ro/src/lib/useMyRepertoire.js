import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

export function useMyRepertoire() {
    const { profile } = useAuth();
    const [rows, setRows] = useState(null);
    const [error, setError] = useState('');

    const reload = useCallback(async () => {
        if (!profile?.id) return;

        setError('');
        const { data, error: queryError } = await supabase.from('pieces').select('*').eq('is_published', true).order('title');
        if (queryError) {
            console.error('[Academy] Repertoriul publicat nu a putut fi încărcat:', queryError.message);
            setError('Piesele disponibile nu au putut fi încărcate. Reîncarcă pagina.');
            setRows([]);
            return;
        }
        setRows((data || []).map((piece) => ({ piece_id: piece.id, pieces: piece })));
    }, [profile?.id]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { rows, reload, error };
}
