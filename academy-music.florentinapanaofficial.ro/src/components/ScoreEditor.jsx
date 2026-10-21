import { useEffect, useId, useRef, useState } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, VexFlow } from 'vexflow/core';
import { Undo2, Trash2, Play, Square, Download, Pause } from 'lucide-react';
import { createVoice } from '../lib/piano';
import { SCORE_DURATIONS, SCORE_PITCHES, MAX_SCORE_NOTES, SCORE_BPM, pitchFromStaff, scoreTimeline, scoreMidi, scorePitchNumber } from '../lib/scoreEditor';
import './ScoreEditor.css';

const names = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
const noteLabel = (pitch) => `${names[pitch[0]]}${pitch.slice(1)}`;
const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/20 bg-ink-900 px-3 py-2 text-sm text-white hover:border-gold-400 disabled:cursor-not-allowed disabled:opacity-40';

export default function ScoreEditor({ onMidiReady, onCompositionChange } = {}) {
    const durationGroup = useId();
    const [composition, setComposition] = useState([]);
    const [duration, setDuration] = useState('q');
    const [instrument, setInstrument] = useState('piano');
    const [playing, setPlaying] = useState(false);
    const [ready, setReady] = useState(false);
    const [message, setMessage] = useState('');
    const staffRef = useRef(null);
    const scrollRef = useRef(null);
    const geometryRef = useRef(null);
    const pointerRef = useRef(null);
    const audioRef = useRef(null);
    const voicesRef = useRef(new Set());
    const playbackRef = useRef({ version: 0, active: false, timer: null });
    const downloadRef = useRef({ url: null, timer: null });
    const mountedRef = useRef(true);

    useEffect(() => { onCompositionChange?.(); }, [composition, instrument, onCompositionChange]);

    function stop() {
        playbackRef.current.version += 1;
        playbackRef.current.active = false;
        clearTimeout(playbackRef.current.timer);
        for (const voice of voicesRef.current) { try { voice.oscillator.stop(); } catch { } }
        voicesRef.current.clear();
        if (mountedRef.current) setPlaying(false);
    }

    async function context() {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioClass) throw new Error('Web Audio nu este disponibil în acest browser.');
        audioRef.current ||= new AudioClass();
        if (audioRef.current.state === 'suspended') await audioRef.current.resume();
        return audioRef.current;
    }

    function voice(audio, pitch, when, seconds) {
        const current = createVoice(audio, scorePitchNumber(pitch), when, instrument, seconds);
        const ended = current.oscillator.onended;
        current.oscillator.onended = () => { ended?.(); voicesRef.current.delete(current); };
        voicesRef.current.add(current);
    }

    function add(pitch) {
        if (playbackRef.current.active || composition.length >= MAX_SCORE_NOTES) return;
        setComposition((current) => current.length < MAX_SCORE_NOTES ? [...current, { pitch, duration }] : current);
        setMessage('');
        if (pitch) {
            const version = playbackRef.current.version;
            void context().then((audio) => {
                if (mountedRef.current && version === playbackRef.current.version) voice(audio, pitch, audio.currentTime, 0.25);
            }).catch((failure) => { if (mountedRef.current) setMessage(failure.message); });
        }
    }

    async function play() {
        if (playbackRef.current.active || !composition.length) return;
        stop();
        onCompositionChange?.();
        const version = playbackRef.current.version;
        playbackRef.current.active = true;
        setPlaying(true);
        setMessage('');
        try {
            const audio = await context();
            if (!mountedRef.current || version !== playbackRef.current.version) return;
            const timeline = scoreTimeline(composition);
            const start = audio.currentTime + 0.05;
            for (const event of timeline.events) if (event.pitch) voice(audio, event.pitch, start + event.time, event.seconds);
            playbackRef.current.timer = setTimeout(stop, (timeline.duration + 0.3) * 1000);
        } catch (failure) { if (mountedRef.current && version === playbackRef.current.version) { stop(); setMessage(failure.message); } }
    }

    function exportMidi() {
        if (onMidiReady) stop();
        try {
            if (!composition.length) return;
            const download = downloadRef.current;
            clearTimeout(download.timer);
            if (download.url) URL.revokeObjectURL(download.url);
            const bytes = scoreMidi(composition, instrument);
            onMidiReady?.(bytes);
            download.url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
            const link = document.createElement('a');
            link.href = download.url;
            link.download = 'compozitia-mea.mid';
            link.hidden = true;
            document.body.appendChild(link);
            link.click();
            link.remove();
            download.timer = setTimeout(() => { URL.revokeObjectURL(download.url); download.url = null; }, 1000);
            setMessage('Fișierul MIDI a fost exportat.');
        } catch { setMessage('Exportul MIDI nu a reușit. Încearcă din nou.'); }
    }

    useEffect(() => {
        mountedRef.current = true;
        let cancelled = false;
        Promise.all([document.fonts.load('24px Bravura'), document.fonts.load('14px Academico')]).then(() => {
            if (!cancelled) { VexFlow.setFonts('Bravura', 'Academico'); setReady(true); }
        }).catch(() => { if (!cancelled) setMessage('Fonturile portativului nu au putut fi încărcate.'); });
        const blur = () => stop();
        const visibility = () => { if (document.hidden) stop(); };
        window.addEventListener('blur', blur);
        document.addEventListener('visibilitychange', visibility);
        return () => {
            cancelled = true;
            mountedRef.current = false;
            stop();
            window.removeEventListener('blur', blur);
            document.removeEventListener('visibilitychange', visibility);
            if (audioRef.current) void audioRef.current.close();
            clearTimeout(downloadRef.current.timer);
            if (downloadRef.current.url) URL.revokeObjectURL(downloadRef.current.url);
        };
    }, []);

    useEffect(() => {
        if (!ready) return;
        const container = staffRef.current;
        container.replaceChildren();
        geometryRef.current = null;
        try {
            const width = Math.max(700, composition.length * 72 + 150);
            const renderer = new Renderer(container, Renderer.Backends.SVG);
            renderer.resize(width, 220);
            const drawing = renderer.getContext();
            const stave = new Stave(20, 65, width - 40);
            stave.addClef('treble').setContext(drawing).draw();
            if (composition.length) {
                const notes = composition.map((event) => new StaveNote({ clef: 'treble', keys: [event.pitch ? `${event.pitch[0].toLowerCase()}/${event.pitch.slice(1)}` : 'b/4'], duration: event.duration + (event.pitch === null ? 'r' : '') }));
                const voice = new Voice().setMode(Voice.Mode.SOFT).addTickables(notes);
                new Formatter().joinVoices([voice]).format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 20);
                voice.draw(drawing, stave);
            }
            geometryRef.current = { bottom: stave.getYForLine(4), spacing: stave.getYForLine(1) - stave.getYForLine(0), noteStart: stave.getNoteStartX() };
            const svg = container.querySelector('svg');
            svg.setAttribute('role', 'img');
            svg.setAttribute('aria-label', `Partitură în cheia Sol, ${composition.length} note și pauze`);
        } catch (failure) { setMessage('Portativul nu a putut fi desenat.'); }
    }, [composition, ready]);

    return <section className="score-editor not-prose min-w-0 space-y-4 border-y border-white/20 py-6" aria-label="Editor de partituri">
        <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl text-white">Editor de partituri</h2><output className="text-sm text-slate-300" aria-live="polite">{composition.length} / {MAX_SCORE_NOTES} · {SCORE_BPM} BPM</output></header>
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Comenzi partitură">
            <fieldset className="flex flex-wrap gap-1" disabled={playing}><legend className="sr-only">Durată notă</legend>{['h', 'q', '8'].map((value) => <label key={value} className="cursor-pointer"><input type="radio" className="peer sr-only" name={durationGroup} aria-label={SCORE_DURATIONS[value].label} checked={duration === value} onChange={() => setDuration(value)} /><span className={`${buttonClass} peer-checked:border-gold-400 peer-checked:text-gold-300 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-gold-400`}>{SCORE_DURATIONS[value].label}</span></label>)}</fieldset>
            <button type="button" className={buttonClass} onClick={() => add(null)} disabled={playing || composition.length >= MAX_SCORE_NOTES}><Pause size={17} />Pauză</button>
            <button type="button" className={buttonClass} title="Undo: șterge ultima notă sau pauză" aria-label="Undo" onClick={() => { stop(); setComposition((current) => current.slice(0, -1)); setMessage(''); }} disabled={!composition.length || playing}><Undo2 size={18} /></button>
            <button type="button" className={buttonClass} title="Clear All: golește portativul" aria-label="Clear All" onClick={() => { stop(); setComposition([]); setMessage(''); }} disabled={!composition.length || playing}><Trash2 size={18} /></button>
            <label className="flex items-center gap-2 text-sm text-slate-300">Instrument<select aria-label="Instrument partitură" className="rounded border border-white/20 bg-ink-900 p-2 text-white" value={instrument} disabled={playing} onChange={(event) => { stop(); setInstrument(event.target.value); }}><option value="piano">Pian</option><option value="accordion">Acordeon</option></select></label>
            <button type="button" className={buttonClass} disabled={!composition.length} onClick={playing ? stop : () => void play()}>{playing ? <Square size={17} /> : <Play size={17} />}{playing ? 'Oprește compoziția' : 'Play Compoziție'}</button>
            <button type="button" className={buttonClass} onClick={exportMidi} disabled={!composition.length}><Download size={17} />Exportă MIDI</button>
        </div>
        {onMidiReady && <button type="button" className={buttonClass} disabled={playing || !composition.some(note => note.pitch)} onClick={() => { try { stop(); onMidiReady(scoreMidi(composition, instrument)); setMessage('Demo pregătit pe claviatura de mai jos. Apasă Pornește studiul.'); } catch (failure) { setMessage(failure.message || 'Demo-ul MIDI nu a putut fi pregătit.'); } }}>Studiază pe claviatură</button>}
        <div ref={scrollRef} className="overflow-x-auto overscroll-x-contain rounded-md border border-white/20 bg-white" aria-label="Portativ cu derulare orizontală" tabIndex={0}>
            <div ref={staffRef} className="score-staff h-[220px] w-max min-w-full select-none text-black"
                onPointerDown={(event) => { if (event.button !== 0) return; pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, scroll: scrollRef.current.scrollLeft }; }}
                onPointerCancel={() => { pointerRef.current = null; }}
                onPointerUp={(event) => {
                    const start = pointerRef.current;
                    pointerRef.current = null;
                    const geometry = geometryRef.current;
                    if (!start || start.id !== event.pointerId || !geometry || playing || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8 || Math.abs(scrollRef.current.scrollLeft - start.scroll) > 4) return;
                    const svg = staffRef.current.querySelector('svg');
                    const bounds = svg.getBoundingClientRect();
                    const point = { x: (event.clientX - bounds.left) * svg.width.baseVal.value / bounds.width, y: (event.clientY - bounds.top) * svg.height.baseVal.value / bounds.height };
                    if (point.x < geometry.noteStart || point.y < geometry.bottom - 65 || point.y > geometry.bottom + 15) return;
                    add(pitchFromStaff(point.y, geometry.bottom, geometry.spacing));
                }} />
        </div>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8" role="group" aria-label="Adaugă note">{SCORE_PITCHES.map((pitch) => <button key={pitch} type="button" className={buttonClass} aria-label={`Adaugă ${noteLabel(pitch)}`} disabled={playing || composition.length >= MAX_SCORE_NOTES} onClick={() => add(pitch)}>{noteLabel(pitch)}</button>)}</div>
        {message && <p role="status" className="text-sm text-gold-300">{message}</p>}
    </section>;
}