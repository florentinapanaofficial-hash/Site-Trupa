import { useCallback, useEffect, useRef, useState } from 'react';
import { BUCKET_MEDIA } from '../lib/supabase';
import { getSignedUrl, invalidateSignedUrl } from '../lib/media';

function formatTime(value) {
    if (!Number.isFinite(value)) return '0:00';
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Player cu controale proprii peste un `<audio>` fără atributul `controls`:
 * browserul nu mai afișează meniul nativ cu „Salvează audio ca…".
 * `source` este fie `{ kind: 'path' }` dintr-un bucket privat (URL semnat, temporar),
 * fie `{ kind: 'url' }` către o sursă externă, pe care nu o putem proteja.
 */
export default function SecureAudioPlayer({ source, label, accent = 'brand', bucket = BUCKET_MEDIA }) {
    const audioRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const sourceKind = source?.kind ?? null;
    const sourceValue = source?.value ?? null;

    const ensureSource = useCallback(
        async (force = false) => {
            const audio = audioRef.current;
            if (!audio || !sourceValue) return false;
            if (audio.src && !force) return true;

            setLoading(true);
            setError('');
            try {
                if (sourceKind === 'url') {
                    audio.src = sourceValue;
                    audio.load();
                    return true;
                }

                if (force) invalidateSignedUrl(bucket, sourceValue);
                const url = await getSignedUrl(bucket, sourceValue);
                if (!url) throw new Error('Fișier indisponibil.');
                audio.src = url;
                audio.load();
                return true;
            } catch {
                setError('Materialul nu a putut fi încărcat. Încearcă din nou.');
                return false;
            } finally {
                setLoading(false);
            }
        },
        [bucket, sourceKind, sourceValue]
    );

    useEffect(() => {
        const audio = audioRef.current;
        setReady(false);
        setPlaying(false);
        setCurrent(0);
        setDuration(0);
        setError('');
        if (audio) {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
        }
    }, [sourceKind, sourceValue]);

    useEffect(() => {
        const audio = audioRef.current;
        return () => {
            if (!audio) return;
            audio.pause();
            audio.removeAttribute('src');
        };
    }, []);

    async function togglePlay() {
        const audio = audioRef.current;
        if (!audio) return;

        if (playing) {
            audio.pause();
            return;
        }

        const ok = await ensureSource();
        if (!ok) return;

        try {
            await audio.play();
        } catch {
            // URL-ul semnat expiră după câteva minute: îl regenerăm și reluăm din aceeași poziție.
            const position = audio.currentTime;
            const refreshed = await ensureSource(true);
            if (!refreshed) return;
            audio.currentTime = position;
            audio.play().catch(() => setError('Redarea nu a putut porni.'));
        }
    }

    async function handleError() {
        const audio = audioRef.current;
        if (!audio || !audio.src) return;

        // Un link extern căzut nu se repară prin reinterogare; doar URL-ul semnat expiră.
        if (sourceKind === 'url') {
            setError('Sursa online nu răspunde. Verifică linkul piesei.');
            return;
        }

        const position = audio.currentTime;
        const refreshed = await ensureSource(true);
        if (!refreshed) return;
        audio.currentTime = position;
        if (playing) audio.play().catch(() => { });
    }

    function seek(event) {
        const audio = audioRef.current;
        if (!audio || !duration) return;
        audio.currentTime = Number(event.target.value);
        setCurrent(audio.currentTime);
    }

    const accentClass =
        accent === 'gold' ? 'bg-gold-500 text-ink-950 hover:bg-gold-400' : 'bg-brand-500 text-white hover:bg-brand-600';

    return (
        <div
            className="protected rounded-xl border border-white/10 bg-ink-800/70 p-3"
            onContextMenu={(event) => event.preventDefault()}
        >
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={togglePlay}
                    disabled={loading}
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition ${accentClass}`}
                    aria-label={playing ? `Pauză ${label}` : `Redă ${label}`}
                >
                    {loading ? '…' : playing ? '❚❚' : '▶'}
                </button>

                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-200">{label}</p>
                        <span className="shrink-0 font-mono text-xs text-slate-500">
                            {formatTime(current)} / {formatTime(duration)}
                        </span>
                    </div>

                    <input
                        type="range"
                        min={0}
                        max={duration || 0}
                        step={0.1}
                        value={current}
                        onChange={seek}
                        disabled={!ready}
                        aria-label="Poziție în piesă"
                        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-gold-400"
                    />
                </div>

                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(event) => {
                        const next = Number(event.target.value);
                        setVolume(next);
                        if (audioRef.current) audioRef.current.volume = next;
                    }}
                    aria-label="Volum"
                    className="hidden h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-white/15 accent-gold-400 sm:block"
                />
            </div>

            {error && <p className="mt-2 text-xs text-brand-300">{error}</p>}

            <audio
                ref={audioRef}
                preload="none"
                controlsList="nodownload noplaybackrate noremoteplayback"
                disableRemotePlayback
                onContextMenu={(event) => event.preventDefault()}
                onLoadedMetadata={(event) => {
                    setDuration(event.currentTarget.duration || 0);
                    setReady(true);
                }}
                onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                    setPlaying(false);
                    setCurrent(0);
                }}
                onError={handleError}
            />
        </div>
    );
}
