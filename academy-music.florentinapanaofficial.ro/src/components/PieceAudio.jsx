import { useEffect, useState } from 'react';
import SecureAudioPlayer from './SecureAudioPlayer';
import { RefreshCw } from 'lucide-react';
import { BUCKET_MEDIA } from '../lib/supabase';
import { getSignedAudioUrl, invalidateSignedAudioUrl } from '../lib/media';
import { isSafeHttpUrl } from '../lib/pieces';

export default function PieceAudio({ piece, variant, onClock, onPlayback, onPlayingChange, controlsRef }) {
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    const [retry, setRetry] = useState(0);
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

    if (!isSafeHttpUrl(external) && !path) return <span className="text-xs text-slate-500">Indisponibil</span>;

    return (
        <div className="min-w-0 space-y-1">
            <SecureAudioPlayer audioUrl={url} label={`${variant.label} — ${piece.title}`} accent={variant.key === 'negativ' ? 'gold' : 'brand'} onClock={onClock} onPlayback={onPlayback} onPlayingChange={onPlayingChange} controlsRef={controlsRef} onSourceError={() => setError('Redarea nu este disponibilă. Reîncearcă sursa audio.')} />
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