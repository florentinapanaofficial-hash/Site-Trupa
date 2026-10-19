import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { BUCKET_MEDIA } from '../lib/supabase';
import { getSignedAudioUrl, invalidateSignedAudioUrl } from '../lib/media';
import { isSafeHttpUrl } from '../lib/pieces';

export default function CantoAudio({ piece, variant }) {
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
    const audioRef = useRef(null);
    const external = piece[variant.url];
    const path = piece[variant.path];

    useEffect(() => {
        let active = true;
        setUrl('');
        setError('');
        if (isSafeHttpUrl(external)) {
            setUrl(external);
        } else if (path) {
            getSignedAudioUrl(BUCKET_MEDIA, path).then((signed) => {
                if (active) setUrl(signed);
            }).catch(() => { if (active) setError('Accesul audio nu a putut fi pregătit.'); });
        }
        return () => { active = false; };
    }, [external, path, retry]);

    useEffect(() => {
        const audio = audioRef.current;
        return () => { audio?.pause(); };
    }, []);

    if (!isSafeHttpUrl(external) && !path) return <span className="text-xs text-slate-500">Indisponibil</span>;

    return (
        <div className="min-w-0 space-y-1">
            <audio ref={audioRef} controls preload="none" src={url || undefined}
                className="h-10 w-full min-w-0" aria-label={`${variant.label} — ${piece.title}`}
                controlsList="nodownload" disableRemotePlayback
                onPlay={(event) => {
                    document.querySelectorAll('audio').forEach((audio) => { if (audio !== event.currentTarget) audio.pause(); });
                }}
                onError={() => { if (url) setError('Redarea nu este disponibilă. Reîncearcă sursa audio.'); }} />
            {!url && !error && <p role="status" className="text-xs text-slate-400">Se pregătește audio…</p>}
            {error && (
                <div className="text-xs text-brand-200">
                    <p role="alert">{error}</p>
                    <button type="button" className="btn-ghost inline-flex items-center gap-1 text-xs" onClick={() => {
                        if (path) invalidateSignedAudioUrl(BUCKET_MEDIA, path);
                        setRetry((previous) => previous + 1);
                    }}><RefreshCw size={14} aria-hidden="true" /> Reîncearcă {variant.label}</button>
                </div>
            )}
        </div>
    );
}