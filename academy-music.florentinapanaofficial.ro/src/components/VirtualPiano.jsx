import { useEffect, useRef, useState } from 'react';
import { Circle, Square, Play, Save } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PIANO_KEYS, INSTRUMENTS, MAX_RECORDING_MS, MAX_EVENTS, createVoice, recordedNote } from '../lib/piano';
import Metronome from './Metronome';
import { useStudyAccess } from '../lib/useStudyAccess';

export default function VirtualPiano() {
    const rootRef = useRef(null);
    const audioRef = useRef(null);
    const voicesRef = useRef(new Map());
    const recordingRef = useRef(null);
    const eventsRef = useRef([]);
    const timersRef = useRef({});
    const replayRef = useRef([]);
    const attemptRef = useRef(null);
    const savingRef = useRef(false);
    const instrumentRef = useRef('piano');
    const { canWrite } = useStudyAccess();
    const readOnlyRef = useRef(true);
    readOnlyRef.current = !canWrite;
    const [instrument, setInstrument] = useState('piano');
    const [activeNotes, setActiveNotes] = useState([]);
    const [recording, setRecording] = useState(false);
    const [events, setEvents] = useState([]);
    const [replaying, setReplaying] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [message, setMessage] = useState('');

    function context() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Browserul nu acceptă Web Audio.');
        audioRef.current ||= new AudioContextClass();
        if (audioRef.current.state === 'suspended') void audioRef.current.resume().catch(() => setMessage('Sunetul nu a putut porni.'));
        return audioRef.current;
    }

    function voice(note, when, duration) {
        return createVoice(context(), note, when, instrumentRef.current, duration);
    }

    function press(note, source) {
        if (replayRef.current.length || savingRef.current) return;
        const existing = voicesRef.current.get(note);
        if (existing) { existing.sources.add(source); return; }
        try {
            if (recordingRef.current !== null && eventsRef.current.length + voicesRef.current.size >= MAX_EVENTS) {
                finishRecording();
                setMessage('Ai atins limita de 2000 de note.');
                return;
            }
            const audio = context();
            voicesRef.current.set(note, { ...voice(note, audio.currentTime), sources: new Set([source]), startedAt: performance.now() });
            setActiveNotes([...voicesRef.current.keys()]);
        } catch (failure) { setMessage(failure.message); }
    }

    function release(note, source) {
        const current = voicesRef.current.get(note);
        if (!current) return;
        if (source) current.sources.delete(source);
        if (source && current.sources.size) return;
        current.release(audioRef.current.currentTime);
        voicesRef.current.delete(note);
        if (recordingRef.current !== null && eventsRef.current.length < MAX_EVENTS) {
            const event = recordedNote(note, current.startedAt, performance.now(), recordingRef.current);
            if (event.timestamp < MAX_RECORDING_MS) eventsRef.current.push(event);
            setEvents([...eventsRef.current].sort((first, second) => first.timestamp - second.timestamp));
        }
        setActiveNotes([...voicesRef.current.keys()]);
    }

    function releaseAll() { for (const note of [...voicesRef.current.keys()]) release(note); }
    function finishRecording() {
        releaseAll();
        recordingRef.current = null;
        clearTimeout(timersRef.current.recording);
        setRecording(false);
    }

    function toggleRecording() {
        if (recordingRef.current !== null) { finishRecording(); return; }
        releaseAll();
        eventsRef.current = [];
        setEvents([]);
        setSaved(false);
        setMessage('');
        attemptRef.current = crypto.randomUUID();
        recordingRef.current = performance.now();
        setRecording(true);
        timersRef.current.recording = setTimeout(finishRecording, MAX_RECORDING_MS);
        rootRef.current?.focus();
    }

    function stopReplay() {
        for (const current of replayRef.current) { try { current.oscillator.stop(); } catch { } }
        replayRef.current = [];
        clearTimeout(timersRef.current.replay);
        setReplaying(false);
    }

    function replay() {
        releaseAll();
        try {
            const audio = context();
            const start = audio.currentTime + 0.05;
            replayRef.current = events.map((event) => voice(event.note, start + event.timestamp / 1000, event.duration / 1000));
            setReplaying(true);
            const end = Math.max(...events.map((event) => event.timestamp + event.duration));
            timersRef.current.replay = setTimeout(stopReplay, end + 150);
        } catch (failure) { stopReplay(); setMessage(failure.message); }
    }

    async function saveHomework() {
        if (readOnlyRef.current || savingRef.current || !events.length || saved) return;
        savingRef.current = true;
        setSaving(true);
        setMessage('');
        try {
            if (!isSupabaseConfigured) throw new Error('Conexiunea Supabase nu este configurată.');
            const { data, error } = await supabase.auth.getUser();
            if (error || !data.user) throw new Error('Autentifică-te pentru a trimite tema.');
            const result = await supabase.from('student_homework').insert({
                student_id: data.user.id,
                attempt_id: attemptRef.current,
                events,
            });
            if (result.error && result.error.code !== '23505') throw new Error('Tema nu a fost trimisă. Verifică conexiunea și migrarea student_homework.');
            setSaved(true);
            setMessage('Tema a fost trimisă.');
        } catch (failure) { setMessage(failure.message); }
        finally { savingRef.current = false; setSaving(false); }
    }

    useEffect(() => {
        const keydown = (event) => {
            if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
            if (!rootRef.current?.contains(document.activeElement)) return;
            const key = PIANO_KEYS.find((item) => item.key === event.key.toLowerCase());
            if (key) { event.preventDefault(); press(key.note, `key:${key.key}`); }
        };
        const keyup = (event) => {
            const key = PIANO_KEYS.find((item) => item.key === event.key.toLowerCase());
            if (key) release(key.note, `key:${key.key}`);
        };
        const blur = () => { releaseAll(); stopReplay(); };
        const visibility = () => { if (document.hidden) blur(); };
        window.addEventListener('keydown', keydown);
        window.addEventListener('keyup', keyup);
        window.addEventListener('blur', blur);
        document.addEventListener('visibilitychange', visibility);
        return () => {
            window.removeEventListener('keydown', keydown);
            window.removeEventListener('keyup', keyup);
            window.removeEventListener('blur', blur);
            document.removeEventListener('visibilitychange', visibility);
            clearTimeout(timersRef.current.recording);
            clearTimeout(timersRef.current.replay);
            for (const current of [...voicesRef.current.values(), ...replayRef.current]) { try { current.oscillator.stop(); } catch { } }
            voicesRef.current.clear();
            replayRef.current = [];
            recordingRef.current = null;
            if (audioRef.current) { void audioRef.current.close(); audioRef.current = null; }
        };
    }, []);

    return (
        <section ref={rootRef} tabIndex={0} aria-label="Claviatură virtuală" className="not-prose space-y-4 rounded-lg border border-white/15 bg-ink-900 p-4" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) releaseAll(); }}>
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl text-white">Pian virtual</h2><span className="text-sm text-slate-400" aria-live="polite">{events.length} note{recording ? ' · REC' : ''}</span></div>
            <label className="flex items-center gap-3 text-sm text-slate-300">Instrument
                <select aria-label="Instrument" className="rounded border border-white/20 bg-ink-950 p-2" value={instrument} onChange={(event) => { releaseAll(); instrumentRef.current = event.target.value; setInstrument(event.target.value); }} disabled={replaying}>
                    {Object.entries(INSTRUMENTS).map(([value, preset]) => <option key={value} value={value}>{preset.name}</option>)}
                </select>
            </label>
            <div className="flex overflow-x-auto whitespace-nowrap pb-2">
                <div className="relative flex h-48 min-w-[880px] flex-1 select-none sm:h-56">
                    {PIANO_KEYS.map((key) => <button key={key.note} type="button" aria-label={`${key.name}${key.key ? `, tasta ${key.key.toUpperCase()}` : ''}`} aria-pressed={activeNotes.includes(key.note)}
                        style={key.black ? { left: `${(key.white + 1) * 100 / 22 - 1.4}%`, width: `${100 / 22 * 0.62}%` } : undefined}
                        className={`rounded-b-md border pb-3 transition-colors ${key.black ? 'absolute top-0 z-10 flex h-3/5 touch-pan-x items-end justify-center border-black text-white' : 'flex h-full min-w-[40px] flex-1 touch-pan-x items-end justify-center border-slate-400 text-ink-950'} ${activeNotes.includes(key.note) ? 'bg-gold-400' : key.black ? 'bg-zinc-950' : 'bg-white'}`}
                        onMouseDown={(event) => { if (event.button === 0) { event.preventDefault(); rootRef.current?.focus(); press(key.note, 'mouse'); } }}
                        onMouseUp={() => release(key.note, 'mouse')}
                        onMouseLeave={() => release(key.note, 'mouse')}
                        onPointerDown={(event) => { if (event.pointerType === 'mouse') return; rootRef.current?.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId); press(key.note, `pointer:${event.pointerId}`); }}
                        onPointerUp={(event) => release(key.note, `pointer:${event.pointerId}`)}
                        onPointerCancel={(event) => release(key.note, `pointer:${event.pointerId}`)}
                        onLostPointerCapture={(event) => release(key.note, `pointer:${event.pointerId}`)}
                        onKeyDown={(event) => { if (!event.repeat && ['Enter', ' '].includes(event.key)) { event.preventDefault(); press(key.note, 'accessibility'); } }}
                        onKeyUp={(event) => { if (['Enter', ' '].includes(event.key)) release(key.note, 'accessibility'); }}>
                        <span className="text-xs font-semibold">{key.key ? key.key.toUpperCase() : key.name}</span>
                    </button>)}
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                <button type="button" className={recording ? 'btn-primary' : 'btn-ghost'} disabled={saving || replaying} onClick={toggleRecording} aria-pressed={recording}>{recording ? <Square size={18} /> : <Circle size={18} />} {recording ? 'Oprește' : 'Înregistrează Tema'}</button>
                <button type="button" className="btn-ghost" disabled={!events.length || recording || saving} onClick={replaying ? stopReplay : replay}>{replaying ? <Square size={18} /> : <Play size={18} />} {replaying ? 'Oprește redarea' : 'Ascultă'}</button>
                {canWrite && <button type="button" className="btn-gold" disabled={!events.length || recording || replaying || saving || saved} onClick={() => void saveHomework()}><Save size={18} />{saved ? 'Trimisă' : saving ? 'Se trimite…' : 'Trimite tema'}</button>}
            </div>
            {message && <p role="status" className="text-sm text-gold-300">{message}</p>}
            <Metronome />
        </section>
    );
}