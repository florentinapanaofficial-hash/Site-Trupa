import { useEffect, useRef, useState } from 'react';
import { Circle, Square, Play, Save } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { PIANO_KEYS, INSTRUMENTS, MAX_RECORDING_MS, MAX_EVENTS, createVoice, recordedNote } from '../lib/piano';
import Metronome from './Metronome';
import SecurePdfViewer from './SecurePdfViewer';
import Spinner from './ui/Spinner';
import { useStudyAccess } from '../lib/useStudyAccess';

const TONE_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function toneNote(note) {
    return TONE_NOTES[note % 12] + (Math.floor(note / 12) - 1);
}

export default function VirtualPiano({ splitView = true, desktopSamples = true }) {
    const rootRef = useRef(null);
    const audioRef = useRef(null);
    const desktopAudioRef = useRef(null);
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
    const [deviceType, setDeviceType] = useState(null);
    const [audioEngineStatus, setAudioEngineStatus] = useState('detecting');
    const [audioEngineError, setAudioEngineError] = useState('');
    const [scorePieces, setScorePieces] = useState(null);
    const [scoreLoadError, setScoreLoadError] = useState('');
    const [selectedPieceId, setSelectedPieceId] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('piece') || '');
    const [activeNotes, setActiveNotes] = useState([]);
    const [recording, setRecording] = useState(false);
    const [events, setEvents] = useState([]);
    const [replaying, setReplaying] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [message, setMessage] = useState('');

    const selectedPiece = scorePieces?.find((piece) => String(piece.id) === selectedPieceId);

    function context() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Browserul nu acceptă Web Audio.');
        audioRef.current ||= new AudioContextClass();
        if (audioRef.current.state === 'suspended') void audioRef.current.resume().catch(() => setMessage('Sunetul nu a putut porni.'));
        return audioRef.current;
    }

    function audioTime() {
        if (desktopAudioRef.current && instrumentRef.current === 'piano') return desktopAudioRef.current.Tone.now();
        return context().currentTime;
    }

    function voice(note, when, duration) {
        const desktopAudio = desktopAudioRef.current;
        if (!desktopAudio || instrumentRef.current !== 'piano') {
            return { ...createVoice(context(), note, when, instrumentRef.current, duration), engine: 'native' };
        }

        void desktopAudio.Tone.start().catch(() => setMessage('AudioContext-ul pianului cu sample-uri nu a putut porni.'));
        const noteName = toneNote(note);
        desktopAudio.sampler.triggerAttack(noteName, when);
        let released = false;
        let releaseTimer;
        const release = (time = desktopAudio.Tone.now()) => {
            if (released) return;
            released = true;
            clearTimeout(releaseTimer);
            desktopAudio.sampler.triggerRelease(noteName, time);
        };
        if (duration !== undefined) {
            const delay = Math.max(0, (when + Math.max(0.01, duration) - desktopAudio.Tone.now()) * 1000);
            releaseTimer = setTimeout(() => release(), delay);
        }
        return { engine: 'tone', release, stop: () => release(desktopAudio.Tone.now()) };
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
            voicesRef.current.set(note, { ...voice(note, audioTime()), sources: new Set([source]), startedAt: performance.now() });
            setActiveNotes([...voicesRef.current.keys()]);
        } catch (failure) { setMessage(failure.message); }
    }

    function release(note, source) {
        const current = voicesRef.current.get(note);
        if (!current) return;
        if (source) current.sources.delete(source);
        if (source && current.sources.size) return;
        const releaseTime = current.engine === 'tone' ? desktopAudioRef.current?.Tone.now() ?? 0 : audioRef.current?.currentTime ?? 0;
        current.release(releaseTime);
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
        for (const current of replayRef.current) {
            try {
                if (current.stop) current.stop();
                else current.oscillator.stop();
            } catch { /* The voice may already have ended. */ }
        }
        replayRef.current = [];
        clearTimeout(timersRef.current.replay);
        setReplaying(false);
    }

    function replay() {
        releaseAll();
        try {
            const start = audioTime() + 0.05;
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
        const mobile = Boolean(
            navigator.userAgentData?.mobile
            || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
            || (navigator.maxTouchPoints > 1 && window.matchMedia('(max-width: 900px)').matches)
        );
        setDeviceType(mobile ? 'mobile' : 'desktop');
    }, []);

    useEffect(() => {
        if (!desktopSamples) {
            setAudioEngineStatus('native');
            return undefined;
        }
        if (deviceType === 'mobile') {
            setAudioEngineStatus('mobile');
            return undefined;
        }
        if (deviceType !== 'desktop') return undefined;

        let cancelled = false;
        let sampler;
        setAudioEngineStatus('loading');
        setAudioEngineError('');

        async function loadDesktopAudio() {
            try {
                const toneModule = await import('tone');
                const Tone = toneModule.default || toneModule;
                sampler = new Tone.Sampler({
                    urls: {
                        C3: 'C3.mp3',
                        'F#3': 'Fs3.mp3',
                        C4: 'C4.mp3',
                        'F#4': 'Fs4.mp3',
                        C5: 'C5.mp3',
                        'F#5': 'Fs5.mp3',
                        C6: 'C6.mp3',
                    },
                    baseUrl: 'https://tonejs.github.io/audio/salamander/',
                    release: 0.15,
                }).toDestination();
                await Tone.loaded();
                if (cancelled) {
                    sampler.dispose();
                    return;
                }
                desktopAudioRef.current = { Tone, sampler };
                setAudioEngineStatus('desktop');
            } catch (failure) {
                sampler?.dispose();
                if (!cancelled) {
                    setAudioEngineStatus('fallback');
                    setAudioEngineError(failure instanceof Error ? failure.message : String(failure));
                }
            }
        }

        void loadDesktopAudio();
        return () => {
            cancelled = true;
            sampler?.dispose();
            desktopAudioRef.current = null;
        };
    }, [deviceType, desktopSamples]);

    useEffect(() => {
        if (!splitView) {
            setScorePieces([]);
            return undefined;
        }
        let active = true;
        setScorePieces(null);
        setScoreLoadError('');

        const query = supabase
            .from('pieces')
            .select('id,title,composer,level,score_path,is_published')
            .eq('discipline', 'orga')
            .not('score_path', 'is', null)
            .order('title', { ascending: true });
        query.then(({ data, error }) => {
            if (!active) return;
            if (error) {
                setScoreLoadError('Partiturile nu au putut fi încărcate. Reîncarcă pagina.');
                setScorePieces([]);
                return;
            }
            setScorePieces((data || []).filter((piece) => Boolean(piece.score_path)));
        }).catch(() => {
            if (!active) return;
            setScoreLoadError('Partiturile nu au putut fi încărcate. Reîncarcă pagina.');
            setScorePieces([]);
        });

        return () => { active = false; };
    }, [splitView]);

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
            for (const current of [...voicesRef.current.values(), ...replayRef.current]) {
                try {
                    if (current.stop) current.stop();
                    else current.oscillator.stop();
                } catch { /* The voice may already have ended. */ }
            }
            voicesRef.current.clear();
            replayRef.current = [];
            recordingRef.current = null;
            if (audioRef.current) { void audioRef.current.close(); audioRef.current = null; }
        };
    }, []);

    return (
        <div className="space-y-6">
            {splitView && (
                <header className="card flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="font-display text-3xl text-white">Claviatură și partitură</h1>
                        <p className="mt-1 text-sm text-slate-400">Alege o piesă din repertoriul de Instrument-Orgă și exersează în timp ce citești partitura.</p>
                    </div>
                    <a className="btn-ghost" href="/instrument/">← Repertoriu Instrument</a>
                </header>
            )}
            <div className={splitView ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]' : 'space-y-6'}>
            <section ref={rootRef} tabIndex={0} aria-label="Claviatură virtuală" className="not-prose space-y-4 rounded-lg border border-white/15 bg-ink-900 p-4" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) releaseAll(); }}>
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl text-white">Pian virtual</h2><span className="text-sm text-slate-400" aria-live="polite">{events.length} note{recording ? ' · REC' : ''}</span></div>
            <p className="text-xs text-slate-400" aria-live="polite">
                {audioEngineStatus === 'detecting' && 'Se detectează dispozitivul audio…'}
                {audioEngineStatus === 'mobile' && 'Sintetizator Web Audio optimizat pentru mobil.'}
                {audioEngineStatus === 'native' && 'Sintetizator Web Audio nativ.'}
                {audioEngineStatus === 'loading' && 'Se încarcă pianul Grand cu sample-uri; poți cânta imediat cu sintetizatorul de rezervă.'}
                {audioEngineStatus === 'desktop' && 'Pian Grand cu sample-uri reale activ pe desktop.'}
                {audioEngineStatus === 'fallback' && 'Sample-urile nu s-au încărcat (' + audioEngineError + '). Se folosește sintetizatorul Web Audio.'}
            </p>
            {audioEngineStatus === 'desktop' && <p className="text-xs text-slate-500">Sample-uri <a className="underline" href="https://tonejs.github.io/audio/salamander/" target="_blank" rel="noopener noreferrer">Salamander Grand Piano</a> de Alexander Holm, licență <a className="underline" href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener noreferrer">CC BY 3.0</a>.</p>}
            <label className="flex items-center gap-3 text-sm text-slate-300">Instrument
                <select aria-label="Instrument" className="rounded border border-white/20 bg-ink-950 p-2" value={instrument} onChange={(event) => { releaseAll(); instrumentRef.current = event.target.value; setInstrument(event.target.value); }} disabled={replaying}>
                    {Object.entries(INSTRUMENTS).map(([value, preset]) => <option key={value} value={value}>{preset.name}</option>)}
                </select>
            </label>
            <div className="flex overflow-x-auto whitespace-nowrap pb-2">
                <div className="relative flex h-48 min-w-[880px] flex-1 select-none sm:h-56">
                    {PIANO_KEYS.map((key) => <button key={key.note} type="button" aria-label={`${key.name}${key.key ? `, tasta ${key.key.toUpperCase()}` : ''}`} aria-pressed={activeNotes.includes(key.note)}
                        style={key.black ? { left: `${(key.white + 1) * 100 / 22 - 1.4}%`, width: `${100 / 22 * 0.62}%` } : undefined}
                        className={`rounded-b-md border pb-3 transition-colors ${key.black ? 'absolute top-0 z-10 flex h-3/5 touch-pan-x items-end justify-center border-black text-white' : 'flex h-full min-w-[40px] flex-1 touch-pan-x items-end justify-center border-slate-400 text-ink-950'} ${activeNotes.includes(key.note) ? 'bg-gold-400 shadow-[0_0_18px_rgba(250,204,21,0.7)]' : key.black ? 'bg-zinc-950' : 'bg-white'}`}
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
            {splitView && (
            <section aria-label="Partitura pentru exersare" className="space-y-4 rounded-lg border border-white/15 bg-ink-900 p-4">
                <div>
                    <h2 className="text-xl text-white">Partitură / exercițiu</h2>
                    <p className="mt-1 text-sm text-slate-400">Partiturile sunt preluate din repertoriul Instrument-Orgă.</p>
                </div>
                <label className="block text-sm text-slate-300" htmlFor="piano-score-select">Selectează piesa</label>
                <select
                    id="piano-score-select"
                    className="input w-full"
                    value={selectedPieceId}
                    disabled={!scorePieces?.length}
                    onChange={(event) => {
                        const piece = scorePieces.find((item) => String(item.id) === event.target.value);
                        setSelectedPieceId(event.target.value);
                    }}
                >
                    <option value="">Alege o partitură…</option>
                    {(scorePieces || []).map((piece) => <option key={piece.id} value={piece.id}>{piece.title}{piece.composer ? ' — ' + piece.composer : ''}{piece.level ? ' · ' + piece.level : ''}</option>)}
                </select>
                {scoreLoadError && <p role="alert" className="text-sm text-brand-200">{scoreLoadError}</p>}
                {scorePieces === null ? <Spinner label="Se încarcă partiturile…" /> : scorePieces.length === 0 ? (
                    <p className="rounded-lg border border-white/10 p-4 text-sm text-slate-400">Nu există încă partituri publicate pentru Instrument-Orgă.</p>
                ) : selectedPiece ? (
                    <div className="max-h-[75vh] min-h-80 overflow-auto rounded-lg border border-white/10 bg-ink-950 p-2">
                        <SecurePdfViewer path={selectedPiece.score_path} watermark="Academy Music" />
                    </div>
                ) : selectedPieceId ? (
                    <p role="status" className="text-sm text-slate-400">Partitura selectată nu este disponibilă pentru acest cont. Alege alta din listă.</p>
                ) : (
                    <p className="rounded-lg border border-white/10 p-4 text-sm text-slate-400">Selectează o piesă pentru a deschide partitura aici.</p>
                )}
                <p className="text-xs text-slate-500">Pentru sample-urile audio Grand Piano este necesară conexiunea la internet; pe mobil se folosește sintetizatorul local.</p>
            </section>
            )}
            </div>
        </div>
    );
}