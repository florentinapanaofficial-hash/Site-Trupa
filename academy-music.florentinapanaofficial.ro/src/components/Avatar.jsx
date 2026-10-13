import { useEffect, useState } from 'react';
import { BUCKET_AVATARS } from '../lib/supabase';
import { getSignedUrl } from '../lib/media';

const SIZES = {
    sm: 'h-9 w-9 text-xs',
    md: 'h-12 w-12 text-sm',
    lg: 'h-20 w-20 text-xl',
};

function initials(name) {
    const source = (name || '?').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
}

/** Avatarele stau într-un bucket privat, deci au nevoie de URL semnat, ca orice alt material. */
export default function Avatar({ path, name, size = 'md', className = '' }) {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        let active = true;
        setUrl(null);
        if (!path) return undefined;

        getSignedUrl(BUCKET_AVATARS, path)
            .then((value) => {
                if (active) setUrl(value);
            })
            .catch(() => { });

        return () => {
            active = false;
        };
    }, [path]);

    const base = `${SIZES[size]} shrink-0 rounded-full object-cover ${className}`;

    if (url) {
        return <img src={url} alt={`Fotografia elevului ${name || ''}`} className={base} />;
    }

    return (
        <span
            className={`${SIZES[size]} grid shrink-0 place-items-center rounded-full bg-brand-500/20 font-bold text-brand-200 ${className}`}
            aria-hidden="true"
        >
            {initials(name)}
        </span>
    );
}
