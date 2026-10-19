import { useEffect, useRef, useState } from 'react';
import { isSafeHttpUrl } from '../lib/pieces';

function formatTime(value) {
    if (!Number.isFinite(value)) return '0:00';
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function SecureAudioPlayer({ audioUrl, label = 'Audio', accent = 'brand' }) {
    const audioRef = useRef(null);
    const [ready, setReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [error, setError] = useState('');
    const validUrl = isSafeHttpUrl(audioUrl);

    useEffect(() => {
        const audio = audioRef.current;
        setReady(false);
        setPlaying(false);
        setCurrent(0);
        setDuration(0);
        setError('');
        if (audio) {
            audio.pause();
            audio.load();
        }
    }, [audioUrl]);

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

        if (!validUrl) return;
        setError('');
        try {
            await audio.play();
        } catch {
            setError('Redarea nu a putut porni. Verifică sursa audio.');
        }
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
                    disabled={!validUrl}
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition ${accentClass}`}
                    aria-label={playing ? `Pauză ${label}` : `Redă ${label}`}
                >
                    {playing ? '❚❚' : '▶'}
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

            {!validUrl && <p className="mt-2 text-xs text-brand-300">Adaugă un URL audio absolut HTTP(S).</p>}
            {error && <p className="mt-2 text-xs text-brand-300">{error}</p>}

            <audio
                ref={audioRef}
                src={validUrl ? audioUrl : undefined}
                preload="none"
                controlsList="nodownload"
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
                onError={() => setError('Sursa audio nu răspunde. Verifică linkul piesei.')}
            />
        </div>
    );
}
