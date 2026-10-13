import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';

/** Piesele unui elev: cele primite individual plus cele ale grupelor din care face parte. */
export function useMyRepertoire() {
    const { profile } = useAuth();
    const [rows, setRows] = useState(null);

    const reload = useCallback(async () => {
        if (!profile?.id) return;

        const { data: memberships } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('student_id', profile.id);

        const groupIds = (memberships || []).map((row) => row.group_id);

        const [direct, fromGroups] = await Promise.all([
            supabase
                .from('student_pieces')
                .select('piece_id, position, pieces(*)')
                .eq('student_id', profile.id)
                .order('position'),
            groupIds.length
                ? supabase
                    .from('group_pieces')
                    .select('piece_id, position, pieces(*)')
                    .in('group_id', groupIds)
                    .order('position')
                : Promise.resolve({ data: [] }),
        ]);

        // Aceeași piesă poate veni și individual, și prin grupă: o păstrăm o singură dată.
        const seen = new Map();
        for (const row of [...(direct.data || []), ...(fromGroups.data || [])]) {
            if (row.pieces && !seen.has(row.piece_id)) seen.set(row.piece_id, row);
        }

        setRows([...seen.values()]);
    }, [profile?.id]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { rows, reload };
}
