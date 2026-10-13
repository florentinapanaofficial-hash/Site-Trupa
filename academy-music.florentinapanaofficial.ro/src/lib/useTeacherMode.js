import { useCallback, useEffect, useState } from 'react';

const KEY = 'academy-music-teacher-mode';

export function useTeacherMode() {
    const [enabled, setEnabled] = useState(() => localStorage.getItem(KEY) === '1');

    useEffect(() => {
        localStorage.setItem(KEY, enabled ? '1' : '0');
    }, [enabled]);

    const set = useCallback((value) => setEnabled(Boolean(value)), []);

    return [enabled, set];
}
