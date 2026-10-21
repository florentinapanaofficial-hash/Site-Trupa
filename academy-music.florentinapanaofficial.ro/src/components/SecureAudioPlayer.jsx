import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { isSafeHttpUrl } from '../lib/pieces';

function formatTime(value) {
    if (!Number.isFinite(value)) return '0:00';
    return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
}

export default function SecureAudioPlayer({ audioUrl, label = 'Audio', accent = 'brand', onClock, onPlayback, onPlayingChange, onSourceError, controlsRef }) {
    const audioRef = useRef(null);
    const clock = useRef(onClock); clock.current = onClock;
    const [ready, setReady] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.75);
    const [error, setError] = useState('');
    const validUrl = isSafeHttpUrl(audioUrl);
    function updateTime(audio) { setCurrent(audio.currentTime); clock.current?.(audio.currentTime); }
    useEffect(() => {
        const audio = audioRef.current;
        setReady(false); setPlaying(false); setCurrent(0); setDuration(0); setError('');
        if (audio) { audio.pause(); audio.volume = volume; audio.load(); }
    }, [audioUrl]);
    useEffect(() => {
        const audio = audioRef.current;
        return () => { audio?.pause(); audio?.removeAttribute('src'); };
    }, []);
    useEffect(() => {
        if (!playing) return;
        let frame;
        const tick = () => { if (audioRef.current) updateTime(audioRef.current); frame = requestAnimationFrame(tick); };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [playing]);
    async function togglePlay() {
        const audio = audioRef.current;
        if (!audio) return;
        if (!audio.paused) { audio.pause(); return; }
        setError('');
        try { await audio.play(); }
        catch { setPlaying(false); onPlayingChange?.(false); setError('Redarea nu a putut porni. Verifică sursa audio și permisiunile browserului.'); }
    }
    function stop() {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        if (audio.readyState > 0) audio.currentTime = 0;
        setPlaying(false); setCurrent(0); clock.current?.(0); onPlayingChange?.(false);
    }
    useImperativeHandle(controlsRef, () => ({ togglePlay, stop, seek(time) {
        const audio = audioRef.current;
        if (audio && Number.isFinite(time) && Number.isFinite(audio.duration)) { audio.currentTime = Math.max(0, Math.min(time, audio.duration)); updateTime(audio); }
    }, duration }));
    return <div onContextMenu={event => event.preventDefault()} className="protected min-w-0 rounded-2xl border border-white/15 bg-gradient-to-br from-ink-800 to-ink-950 p-4 shadow-lg">
        <p className="mb-3 truncate text-sm font-semibold text-white">{label}</p>
        <div className="flex items-center gap-3">
            <button type="button" onClick={togglePlay} disabled={!validUrl} className={`grid size-12 shrink-0 place-items-center rounded-full transition disabled:opacity-40 ${accent === 'gold' ? 'bg-gold-400 text-ink-950 hover:bg-gold-300' : 'bg-brand-500 text-white hover:bg-brand-600'}`} aria-label={playing ? `Pauză ${label}` : `Redă ${label}`}>
                {playing ? <Pause size={21} aria-hidden="true" /> : <Play size={21} aria-hidden="true" />}
            </button>
            <button type="button" className="grid size-10 shrink-0 place-items-center rounded-full border border-white/20 text-slate-100 disabled:opacity-40" disabled={!validUrl} aria-label={`Stop ${label}`} onClick={stop}><Square size={17} aria-hidden="true" /></button>
            <div className="min-w-0 flex-1"><input type="range" min={0} max={duration || 0} step={0.01} value={Math.min(current, duration || 0)} disabled={!ready} onChange={event => { const audio = audioRef.current; if (audio) { audio.currentTime = Number(event.target.value); updateTime(audio); } }} aria-label={`Poziție în piesă — ${label}`} className="block w-full accent-gold-400" />
                <p className="mt-2 flex justify-between font-mono text-xs text-slate-300"><span>{formatTime(current)}</span><span>{formatTime(duration)}</span></p>
            </div>
        </div>
        <label className="mt-4 flex items-center gap-3 text-xs text-slate-300"><Volume2 size={17} aria-hidden="true" />Volum<input type="range" min={0} max={1} step={0.01} value={volume} onChange={event => { const value = Number(event.target.value); setVolume(value); if (audioRef.current) audioRef.current.volume = value; }} aria-label={`Volum — ${label}`} className="min-w-0 flex-1 accent-gold-400" /></label>
        {error && <p role="alert" className="mt-2 text-sm text-brand-200">{error}</p>}
        <audio ref={audioRef} aria-label={label} src={validUrl ? audioUrl : undefined} preload="none" controlsList="nodownload" disableRemotePlayback
            onLoadedMetadata={event => { const value = event.currentTarget.duration; setDuration(Number.isFinite(value) ? value : 0); setReady(Number.isFinite(value) && value > 0); }}
            onDurationChange={event => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration); }}
            onTimeUpdate={event => updateTime(event.currentTarget)} onSeeked={event => updateTime(event.currentTarget)}
            onPlay={event => { document.querySelectorAll('audio').forEach(audio => { if (audio !== event.currentTarget) audio.pause(); }); setPlaying(true); onPlayingChange?.(true); onPlayback?.(); }}
            onPause={event => { setPlaying(false); onPlayingChange?.(false); updateTime(event.currentTarget); }} onEnded={event => { setPlaying(false); updateTime(event.currentTarget); }}
            onError={() => { if (validUrl) { setReady(false); setPlaying(false); onPlayingChange?.(false); setError('Sursa audio nu este disponibilă. Reîncearcă redarea.'); onSourceError?.(); } }} />
    </div>;
}
