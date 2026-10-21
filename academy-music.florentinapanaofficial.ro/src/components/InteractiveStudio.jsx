import { memo, useEffect, useRef, useState } from 'react';
import midiPackage from '@tonejs/midi';
import { Play, Pause, RotateCcw, Repeat2, Monitor, Usb, Upload, Volume2, VolumeX, Circle, Square, Send, Music } from 'lucide-react';
import { PIANO_KEYS, INSTRUMENTS, createVoice } from '../lib/piano';
import { demoSequence, parseStudioMidi, matchNote, visibleNotes, accuracy, loopPosition, StudioClock, STUDIO_METERS, createStudioMixer, createStudioPlayback, createHomeworkCapture } from '../lib/interactiveStudio';
import { uploadHomeworkToDrive } from '../lib/submitHomework';
import { useStudyAccess } from '../lib/useStudyAccess';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const TEACHER_EMAILS = ['florentinapanaofficial@gmail.com', 'pana_claudiu_profesor@yahoo.ro'];
import './InteractiveStudio.css';

export { uploadHomeworkToDrive };

export function HomeworkStudio() {
    const { canWrite } = useStudyAccess();
    return <InteractiveStudio isHomeworkMode={canWrite} />;
}

const names = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
let whiteIndex = -1;
const keys = Array.from({ length: 128 }, (_, note) => {
    const black = [1, 3, 6, 8, 10].includes(note % 12);
    if (!black) whiteIndex += 1;
    return { note, black, left: black ? (whiteIndex + 1) * 40 - 12 : whiteIndex * 40, width: black ? 24 : 40, name: `${names[note % 12]}${Math.floor(note / 12) - 1}`, key: PIANO_KEYS.find((key) => key.note === note)?.key };
});
const boardWidth = (whiteIndex + 1) * 40;
const { Midi } = midiPackage;
function buildStudentMidi(events, duration) {
    const midi = new Midi();
    const track = midi.addTrack();
    const open = new Map();
    for (const event of events) {
        if (event.on) open.set(event.note, event.time);
        else if (open.has(event.note)) { track.addNote({ midi: event.note, time: open.get(event.note), duration: Math.max(0.05, event.time - open.get(event.note)), velocity: 0.8 }); open.delete(event.note); }
    }
    for (const [note, time] of open) track.addNote({ midi: note, time, duration: Math.max(0.05, duration - time), velocity: 0.8 });
    return new Blob([midi.toArray()], { type: 'audio/midi' });
}
const timeLabel = (time) => `${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')}`;

const Keyboard = memo(function Keyboard({ teacher = false, active = '', feedback = {}, actions }) {
    const activeSet = new Set(active.split(',').map(Number));
    return <div className="is-keyboard" role="group" aria-label={teacher ? 'Claviatura profesorului' : 'Claviatura elevului'}>
        {keys.map((key) => {
            const lit = active !== '' && activeSet.has(key.note);
            const state = teacher ? (lit ? 'teacher' : '') : feedback[key.note] || (lit ? 'held' : '');
            const props = { className: `is-key ${key.black ? 'is-black' : 'is-white'} ${state ? `is-${state}` : ''}`, style: { left: key.left, width: key.width }, 'data-note': key.note, 'data-state': state };
            return teacher ? <div key={key.note} {...props}><span>{key.note % 12 === 0 ? key.name : ''}</span></div> :
                <button key={key.note} {...props} type="button" aria-label={key.name} aria-pressed={lit}
                    onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); actions.current.press(key.note, `pointer:${event.pointerId}`); }}
                    onPointerUp={(event) => actions.current.release(key.note, `pointer:${event.pointerId}`)}
                    onPointerCancel={(event) => actions.current.release(key.note, `pointer:${event.pointerId}`)}
                    onLostPointerCapture={(event) => actions.current.release(key.note, `pointer:${event.pointerId}`)}
                    onKeyDown={(event) => { if (!event.repeat && [' ', 'Enter'].includes(event.key)) { event.preventDefault(); actions.current.press(key.note, 'accessible'); } }}
                    onKeyUp={(event) => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); actions.current.release(key.note, 'accessible'); } }}
                    onBlur={() => actions.current.release(key.note, 'accessible')}>
                    <span>{key.key?.toUpperCase() || (key.note % 12 === 0 ? key.name : '')}</span>
                </button>;
        })}
    </div>;
});

function Waterfall({ model, actions, running, sequence, pausedPosition }) {
    const canvasRef = useRef(null);
    useEffect(() => {
        let frame;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;
        const draw = () => {
            const position = actions.current.position();
            context.clearRect(0, 0, boardWidth, 180);
            context.fillStyle = '#12151a';
            context.fillRect(0, 0, boardWidth, 180);
            context.strokeStyle = '#32343a';
            for (const key of keys.filter((key) => !key.black)) { context.beginPath(); context.moveTo(key.left, 0); context.lineTo(key.left, 180); context.stroke(); }
            for (const note of visibleNotes(sequence, position, 3)) {
                const key = keys[note.note];
                const bottom = 180 - (note.time - position) * 60;
                const height = Math.max(3, note.duration * 60);
                context.fillStyle = model.current.hits.has(note.id) ? '#44d49b' : key.black ? '#d97e9a' : '#e8c468';
                context.fillRect(key.left + 2, bottom - height, key.width - 4, height);
            }
            context.fillStyle = '#e8c468';
            context.fillRect(0, 178, boardWidth, 2);
            if (running) frame = requestAnimationFrame(draw);
        };
        draw();
        return () => cancelAnimationFrame(frame);
    }, [model, actions, running, sequence, pausedPosition]);
    return <canvas ref={canvasRef} width={boardWidth} height={180} className="is-waterfall" aria-label="Note MIDI în cascadă" role="img" />;
}

export default function InteractiveStudio({ isHomeworkMode = false, onSubmitHomework, initialMidi } = {}) {
    const [sequence, setSequence] = useState(() => {
        if (!initialMidi) return demoSequence;
        const parsed = parseStudioMidi(initialMidi.bytes);
        return { ...parsed, name: initialMidi.name };
    });
    const model = useRef(null);
    if (!model.current) model.current = { sequence, clock: new StudioClock(), running: false, starting: false, version: 0, rate: 1, loop: false, a: 0, b: sequence.duration, hits: new Set(), hitTotal: 0, expectedTotal: 0, start: 0, wrong: 0, voices: new Map(), feedback: {}, instrument: 'piano', mediaActive: false, ended: false, demoLevel: 0.65, studentLevel: 0.8, demoMuted: false, metronome: false, signature: '4/4', buffering: false };
    const rootRef = useRef(null);
    const scrollRef = useRef(null);
    const audioRef = useRef(null);
    const synthRef = useRef(null);
    const mixerRef = useRef(null);
    const playbackRef = useRef(null);
    const midiRef = useRef(null);
    const urlRef = useRef(null);
    const loadRef = useRef(0);
    const previewRef = useRef(null);
    const homeworkRef = useRef({ mounted: true, enabled: false, busy: false, active: false, starting: false, sending: false, version: 0, capture: null, blob: null, url: null, timer: null });
    homeworkRef.current.enabled = isHomeworkMode === true;
    const actions = useRef({});
    const [view, setView] = useState({ position: 0, running: false, teacher: '', student: '', feedback: {}, hits: 0, expected: sequence.notes.length, wrong: 0, ended: false });
    useEffect(() => {
        if (!initialMidi || !view.running || !view.teacher) return;
        const key = keys[Number(view.teacher.split(',')[0])];
        if (!key) return;
        const frame = requestAnimationFrame(() => {
            const scroller = scrollRef.current;
            if (!scroller) return;
            const left = scroller.scrollLeft;
            const width = scroller.clientWidth;
            if (key.left < left || key.left + key.width > left + width) scroller.scrollLeft = Math.max(0, key.left - Math.min(120, width / 3));
        });
        return () => cancelAnimationFrame(frame);
    }, [initialMidi, view.running, view.teacher]);
    const [animation, setAnimation] = useState(false);
    const [rate, setRate] = useState(1);
    const [instrument, setInstrument] = useState('piano');
    const [loop, setLoop] = useState(false);
    const [marks, setMarks] = useState({ a: 0, b: sequence.duration });
    const [mp3, setMp3] = useState('');
    const [message, setMessage] = useState('');
    const [midiStatus, setMidiStatus] = useState('USB MIDI neconectat');
    const [demoLevel, setDemoLevel] = useState(0.65);
    const [studentLevel, setStudentLevel] = useState(0.8);
    const [demoMuted, setDemoMuted] = useState(false);
    const [metronome, setMetronome] = useState(false);
    const [signature, setSignature] = useState('4/4');
    const [recordState, setRecordState] = useState('idle');
    const [previewUrl, setPreviewUrl] = useState('');
    const [homeworkLink, setHomeworkLink] = useState('');
    const [playerSrc, setPlayerSrc] = useState('');
    const [playerName, setPlayerName] = useState('');
    const playerUrlRef = useRef(null);
    const [user, setUser] = useState(null);

    useEffect(() => {
        if (!isSupabaseConfigured) return undefined;
        let active = true;
        void supabase.auth.getUser().then(({ data }) => { if (active) setUser(data.user ?? null); });
        const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (active) setUser(session?.user ?? null); });
        return () => { active = false; data.subscription.unsubscribe(); };
    }, []);
    const recordingLocked = ['starting', 'recording', 'stopping'].includes(recordState);

    function showInPlayer(blob, name) {
        if (playerUrlRef.current) URL.revokeObjectURL(playerUrlRef.current);
        playerUrlRef.current = URL.createObjectURL(blob);
        setPlayerSrc(playerUrlRef.current);
        setPlayerName(name);
    }

    function loadPlayerMidi(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!/\.midi?$/i.test(file.name) || file.size > 5 * 1024 * 1024) { setMessage('Alege un MIDI de maximum 5 MB.'); return; }
        showInPlayer(file, file.name);
        setMessage('');
    }

    function finishRecording() {
        const take = homeworkRef.current;
        if (!take.active && !take.starting) return;
        clearTimeout(take.timer);
        take.starting = false;
        if (take.active) {
            take.active = false;
            take.durationSeconds = (performance.now() - take.startedAt) / 1000;
            setRecordState('stopping');
            take.capture.stop();
        } else { take.busy = false; setRecordState('idle'); }
    }

    function failRecording(reason) {
        const take = homeworkRef.current;
        take.version += 1;
        take.busy = false;
        take.active = false;
        take.starting = false;
        clearTimeout(take.timer);
        take.capture?.stop();
        pause();
        if (take.mounted) { setRecordState('idle'); setMessage(reason); }
    }

    async function startRecording() {
        const take = homeworkRef.current;
        if (!take.enabled || take.busy || take.sending) return;
        if (!urlRef.current || audioRef.current.readyState < 1 || !Number.isFinite(audioRef.current.duration)) { setMessage('Încarcă un negativ MP3 valid înainte de REC.'); return; }
        pause();
        take.busy = true;
        take.starting = true;
        const version = ++take.version;
        setRecordState('starting');
        setMessage('');
        try {
            const audio = audioContext();
            take.capture ||= createHomeworkCapture(audio, mixerRef.current, audioRef.current);
            if (audio.state === 'suspended') await audio.resume();
            if (!take.mounted || !take.enabled || !take.starting || take.version !== version) return;
            previewRef.current?.pause();
            if (take.url) URL.revokeObjectURL(take.url);
            take.url = null;
            take.blob = null;
            setPreviewUrl('');
            setHomeworkLink('');
            model.current.loop = false;
            setLoop(false);
            seek(0);
            take.startedAt = performance.now();
            take.events = [];
            take.logging = true;
            take.metadata = { midiName: model.current.sequence.name, backingName: mp3, tempoRate: model.current.rate };
            take.capture.start((blob) => {
                take.logging = false;
                take.midiBlob = null;
                if (take.mounted && take.enabled && take.version === version && take.events?.length) { take.midiBlob = buildStudentMidi(take.events, take.durationSeconds ?? 0); showInPlayer(take.midiBlob, 'Înregistrarea elevului'); }
                if (!take.mounted || !take.enabled || take.version !== version) return;
                take.busy = false;
                take.active = false;
                clearTimeout(take.timer);
                take.blob = blob;
                take.fileName = `tema-${crypto.randomUUID()}.${blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`;
                take.url = URL.createObjectURL(blob);
                setPreviewUrl(take.url);
                setRecordState('preview');
            }, (failure) => { if (take.version === version) failRecording(failure.message); });
            take.active = true;
            take.starting = false;
            setRecordState('recording');
            take.timer = setTimeout(() => { actions.current.pause(); setMessage('Înregistrarea s-a oprit la limita de 20 de minute.'); }, 20 * 60 * 1000);
            await play();
            if (take.active && !model.current.running) throw new Error('Negativul nu a pornit. Încearcă din nou.');
        } catch (failure) { if (take.version === version && take.mounted) failRecording(failure.message || 'Înregistrarea nu a putut porni.'); }
    }

    async function submitHomework() {
        const take = homeworkRef.current;
        if (!take.enabled || !take.blob || take.busy || take.sending || recordState === 'sent') return;
        take.sending = true;
        setRecordState('uploading');
        setMessage('');
        try {
            const result = await (onSubmitHomework || uploadHomeworkToDrive)({ blob: take.blob, fileName: take.fileName, midiBlob: take.midiBlob, contentType: take.blob.type, durationSeconds: take.durationSeconds, ...take.metadata });
            if (take.mounted && take.enabled) {
                const link = result?.webViewLink;
                setHomeworkLink(typeof link === 'string' && /^https:\/\/drive\.google\.com\//.test(link) ? link : '');
                setRecordState('sent'); setMessage('Tema a fost trimisă cu succes domnului profesor!');
            }
        } catch (failure) { if (take.mounted) { setRecordState('preview'); setMessage(failure.message || 'Tema nu a fost trimisă. Încearcă din nou.'); } }
        finally { take.sending = false; }
    }

    function audioContext() {
        if (!synthRef.current) {
            const AudioClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioClass) throw new Error('Web Audio nu este disponibil în acest browser.');
            synthRef.current = new AudioClass();
            const current = model.current;
            mixerRef.current = createStudioMixer(synthRef.current, current.demoMuted ? 0 : current.demoLevel, current.studentLevel);
            playbackRef.current = createStudioPlayback(synthRef.current, mixerRef.current);
        }
        return synthRef.current;
    }

    function syncAudio() {
        const current = model.current;
        const audio = audioRef.current;
        playbackRef.current?.sync({
            sequence: current.sequence, position: position(), rate: current.rate,
            end: current.loop ? current.b : current.sequence.duration,
            signature: current.signature, metronome: current.metronome, instrument: current.instrument,
            running: current.running && (!current.mediaActive || (!current.buffering && !audio.seeking && !audio.paused && audio.readyState >= 3)),
        });
    }

    function position() {
        const current = model.current;
        return current.running && current.mediaActive ? audioRef.current.currentTime : current.clock.read();
    }

    function refresh() {
        const current = model.current;
        const time = Math.min(current.sequence.duration, position());
        const expected = current.sequence.notes.filter((note) => note.time >= current.start && note.time < (current.loop ? current.b : Infinity)).length;
        setView({ position: time, running: current.running, teacher: visibleNotes(current.sequence, time).filter((note) => note.time <= time).map((note) => note.note).join(','), student: [...current.voices.keys()].join(','), feedback: current.feedback, hits: current.hitTotal + current.hits.size, expected: current.expectedTotal + expected, wrong: current.wrong, ended: current.ended });
    }

    function resetScore(start = 0) {
        Object.assign(model.current, { hits: new Set(), hitTotal: 0, expectedTotal: 0, start, wrong: 0, feedback: {}, ended: false });
    }

    function release(note, source) {
        const current = model.current.voices.get(note);
        if (!current) return;
        if (source) current.sources.delete(source);
        if (source && current.sources.size) return;
        current.release(synthRef.current.currentTime);
        const take = homeworkRef.current;
        if (take.logging) take.events.push({ note, on: false, time: (performance.now() - take.startedAt) / 1000 });
        model.current.voices.delete(note);
        refresh();
    }

    function releaseAll(prefix) {
        for (const [note, voice] of model.current.voices) {
            if (!prefix) release(note);
            else for (const source of [...voice.sources]) if (source.startsWith(prefix)) release(note, source);
        }
    }

    function press(note, source) {
        const current = model.current;
        if (!keys[note]) return;
        const existing = current.voices.get(note);
        if (existing) { existing.sources.add(source); return; }
        try {
            const audio = audioContext();
            if (audio.state === 'suspended') void audio.resume().catch(() => setMessage('Sunetul nu a putut porni.'));
            current.voices.set(note, { ...createVoice(audio, note, audio.currentTime, current.instrument, undefined, mixerRef.current.student), sources: new Set([source]) });
            const take = homeworkRef.current;
            if (take.logging) take.events.push({ note, on: true, time: (performance.now() - take.startedAt) / 1000 });
            if (current.running) {
                const match = matchNote(current.sequence.notes, note, position(), current.hits, current.rate, current.start, current.loop ? current.b : Infinity);
                current.feedback = { ...current.feedback, [note]: match ? 'correct' : 'wrong' };
                if (match) current.hits.add(match.id);
                else current.wrong += 1;
            } else { current.feedback = { ...current.feedback }; delete current.feedback[note]; }
            refresh();
        } catch (failure) { setMessage(failure.message); }
    }

    function pause() {
        finishRecording();
        const current = model.current;
        current.version += 1;
        current.clock.seek(position());
        current.clock.pause();
        current.running = false;
        current.starting = false;
        current.mediaActive = false;
        playbackRef.current?.reset();
        audioRef.current?.pause();
        releaseAll();
        refresh();
    }

    function seek(time, reset = true) {
        const current = model.current;
        const target = Math.max(0, Math.min(time, current.sequence.duration));
        playbackRef.current?.reset();
        current.clock.seek(target);
        const audio = audioRef.current;
        if (urlRef.current) {
            audio.currentTime = Number.isFinite(audio.duration) ? Math.min(target, audio.duration) : target;
            current.mediaActive = current.running && (!Number.isFinite(audio.duration) || target < audio.duration);
        }
        if (reset) resetScore(target);
        syncAudio();
        refresh();
    }

    async function play() {
        const current = model.current;
        if (current.running || current.starting) return;
        if (position() >= current.sequence.duration || current.ended) seek(current.loop ? current.a : 0);
        if (current.loop && (position() < current.a || position() >= current.b)) seek(current.a);
        current.starting = true;
        const version = ++current.version;
        const audio = audioRef.current;
        try {
            const synth = audioContext();
            if (synth.state === 'suspended') await synth.resume();
            if (current.version !== version) return;
            if (urlRef.current && (!Number.isFinite(audio.duration) || position() < audio.duration)) {
                audio.currentTime = position();
                audio.playbackRate = current.rate;
                audio.preservesPitch = true;
                await audio.play();
                if (current.version !== version) return;
                current.mediaActive = true;
            }
            if (current.version !== version) return;
            current.running = true;
            current.starting = false;
            current.clock.play();
            syncAudio();
            setMessage('');
            refresh();
        } catch { if (version === current.version) { pause(); setMessage('Redarea audio nu poate porni. Verifică permisiunile browserului și fișierul MP3.'); } }
    }

    function restart() { pause(); seek(model.current.loop ? model.current.a : 0); }

    async function loadMidi(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        const request = ++loadRef.current;
        pause();
        try {
            if (!/\.midi?$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw new Error('Alege un MIDI de maximum 5 MB.');
            const next = parseStudioMidi(new Uint8Array(await file.arrayBuffer()));
            if (request !== loadRef.current) return;
            next.name = file.name;
            Object.assign(model.current, { sequence: next, a: 0, b: next.duration, loop: false });
            setSequence(next);
            setMarks({ a: 0, b: next.duration });
            setLoop(false);
            seek(0);
            scrollRef.current.scrollLeft = Math.max(0, keys[next.notes[0].note].left - 120);
            setMessage('');
        } catch (failure) { if (request === loadRef.current) setMessage(failure.message || 'Fișier MIDI invalid.'); }
    }

    function loadMp3(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!/\.mp3$/i.test(file.name) || file.size > 100 * 1024 * 1024) { setMessage('Alege un MP3 de maximum 100 MB.'); return; }
        pause();
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(file);
        audioRef.current.src = urlRef.current;
        audioRef.current.load();
        setMp3(file.name);
        seek(0);
        setMessage('');
    }

    function connectInputs(access) {
        releaseAll('midi:');
        for (const input of access.inputs.values()) {
            input.onmidimessage = (event) => {
                const [status, note, velocity] = event.data;
                const kind = status & 0xf0;
                const source = `midi:${input.id}:${status & 0x0f}`;
                if (kind === 0x90 && velocity > 0) press(note, source);
                else if (kind === 0x80 || (kind === 0x90 && velocity === 0)) release(note, source);
                else if (kind === 0xb0 && [120, 123].includes(note)) releaseAll(source);
            };
        }
        const connected = [...access.inputs.values()].filter((input) => input.state === 'connected');
        setMidiStatus(connected.length ? connected.map((input) => input.name || 'Claviatură USB').join(', ') : 'Nicio claviatură MIDI detectată');
    }

    async function connectMidi() {
        if (!navigator.requestMIDIAccess) { setMidiStatus('Web MIDI indisponibil; folosește Chrome sau Edge pe HTTPS.'); return; }
        try {
            const access = await navigator.requestMIDIAccess({ sysex: false });
            if (!rootRef.current) return;
            midiRef.current = access;
            connectInputs(access);
            access.onstatechange = () => actions.current.connectInputs(access);
        } catch { setMidiStatus('Accesul MIDI a fost refuzat sau blocat de browser.'); }
    }

    actions.current = { press, release, position, connectInputs, pause, syncAudio };

    useEffect(() => {
        if (isHomeworkMode === true) return;
        const take = homeworkRef.current;
        if (take.active || take.starting) actions.current.pause();
        take.version += 1;
        take.busy = false;
        take.blob = null;
        if (take.url) URL.revokeObjectURL(take.url);
        take.url = null;
        setPreviewUrl('');
        setHomeworkLink('');
        setRecordState('idle');
    }, [isHomeworkMode]);

    useEffect(() => {
        if (!playerSrc) return;
        let active = true;
        void import('html-midi-player').catch(() => {
            if (active) setMessage('Playerul MIDI suplimentar nu a putut fi încărcat. Folosește studioul interactiv pentru redare.');
        });
        return () => { active = false; };
    }, [playerSrc]);
    useEffect(() => () => { if (playerUrlRef.current) URL.revokeObjectURL(playerUrlRef.current); }, []);

    useEffect(() => {
        homeworkRef.current.mounted = true;
        scrollRef.current.scrollLeft = initialMidi ? Math.max(0, (keys[sequence.notes[0].note]?.left || 0) - 120) : keys[48].left;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setAnimation(false);
        const keydown = (event) => {
            if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !rootRef.current?.contains(document.activeElement) || event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
            const key = PIANO_KEYS.find((key) => key.key === event.key.toLowerCase());
            if (key) { event.preventDefault(); actions.current.press(key.note, `pc:${key.key}`); }
        };
        const keyup = (event) => {
            const key = PIANO_KEYS.find((key) => key.key === event.key.toLowerCase());
            if (key) actions.current.release(key.note, `pc:${key.key}`);
        };
        const blur = () => actions.current.pause();
        const visibility = () => { if (document.hidden) blur(); };
        const timer = setInterval(() => {
            const current = model.current;
            if (!current.running) return;
            const time = actions.current.position();
            if (current.loop && time >= current.b) {
                current.hitTotal += current.hits.size;
                current.expectedTotal += current.sequence.notes.filter((note) => note.time >= current.start && note.time < current.b).length;
                current.hits.clear();
                current.feedback = {};
                current.start = current.a;
                seek(loopPosition(time, current.a, current.b), false);
                if (urlRef.current && current.mediaActive && audioRef.current.paused) void audioRef.current.play().catch(() => { actions.current.pause(); setMessage('Redarea MP3 a fost întreruptă.'); });
            } else if (time >= current.sequence.duration && !homeworkRef.current.active) {
                actions.current.pause();
                current.clock.seek(current.sequence.duration);
                current.ended = true;
            }
            actions.current.syncAudio();
            refresh();
        }, 25);
        window.addEventListener('keydown', keydown);
        window.addEventListener('keyup', keyup);
        window.addEventListener('blur', blur);
        document.addEventListener('visibilitychange', visibility);
        return () => {
            clearInterval(timer);
            loadRef.current += 1;
            model.current.version += 1;
            window.removeEventListener('keydown', keydown);
            window.removeEventListener('keyup', keyup);
            window.removeEventListener('blur', blur);
            document.removeEventListener('visibilitychange', visibility);
            audioRef.current?.pause();
            const take = homeworkRef.current;
            take.mounted = false;
            take.version += 1;
            clearTimeout(take.timer);
            take.capture?.dispose();
            if (take.url) URL.revokeObjectURL(take.url);
            playbackRef.current?.reset();
            mixerRef.current?.disconnect();
            for (const voice of model.current.voices.values()) { try { voice.oscillator.stop(); } catch { } }
            model.current.voices.clear();
            if (synthRef.current) void synthRef.current.close();
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
            if (midiRef.current) { midiRef.current.onstatechange = null; for (const input of midiRef.current.inputs.values()) input.onmidimessage = null; }
        };
    }, []);

    return <section ref={rootRef} tabIndex={0} className="interactive-studio not-prose" aria-label="Studio interactiv MIDI"
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) releaseAll(); }}>
        <header className="is-header"><div><h2>Studio interactiv</h2><p className="is-filename">{sequence.name}</p></div>
            {!isHomeworkMode && !recordingLocked && <a className="is-button" href="/jocuri/?tab=ritm">Joc Ritmic</a>}
            <button type="button" className="is-button" onClick={() => setAnimation(!animation)} aria-pressed={animation}><Monitor size={17} />Schimbă vederea: {animation ? 'Mod Animație' : 'Mod Simplu'}</button>
        </header>
        <div className="is-toolbar">
            <label className="is-upload"><Upload size={16} />MIDI<input aria-label="Încarcă MIDI" type="file" accept=".mid,.midi" onChange={loadMidi} disabled={recordingLocked} /></label>
            <label className="is-upload"><Upload size={16} />MP3<input aria-label="Încarcă MP3" type="file" accept=".mp3,audio/mpeg" onChange={loadMp3} disabled={recordingLocked} /></label>
            <label>Instrument<select aria-label="Instrument studio" value={instrument} onChange={(event) => { releaseAll(); playbackRef.current?.reset(); model.current.instrument = event.target.value; setInstrument(event.target.value); syncAudio(); }}>
                {Object.entries(INSTRUMENTS).map(([value, preset]) => <option key={value} value={value}>{preset.name}</option>)}
            </select></label>
            <button type="button" className="is-button" onClick={connectMidi}><Usb size={17} />Conectează MIDI</button>
        </div>
        <div className="is-mixer" role="group" aria-label="Mixer audio dual">
            <label>Volum Demo<input aria-label="Volum Demo" type="range" min="0" max="1" step="0.01" value={demoLevel} onChange={(event) => { const level = Number(event.target.value); model.current.demoLevel = level; setDemoLevel(level); mixerRef.current?.setDemo(model.current.demoMuted ? 0 : level); }} /><output>{Math.round(demoLevel * 100)}%</output></label>
            <button type="button" className="is-button" aria-label="Mute Demo" aria-pressed={demoMuted} title={demoMuted ? 'Reactivează sunetul demo' : 'Oprește sunetul demo'} onClick={() => { const muted = !model.current.demoMuted; model.current.demoMuted = muted; setDemoMuted(muted); mixerRef.current?.setDemo(muted ? 0 : model.current.demoLevel); }}>{demoMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}Mute Demo</button>
            <label>Volumul Meu<input aria-label="Volumul Meu" type="range" min="0" max="1" step="0.01" value={studentLevel} onChange={(event) => { const level = Number(event.target.value); model.current.studentLevel = level; setStudentLevel(level); mixerRef.current?.setStudent(level); }} /><output>{Math.round(studentLevel * 100)}%</output></label>
        </div>
        <div className="is-loop" role="group" aria-label="Metronom sincronizat">
            <label><input aria-label="Metronom studio" type="checkbox" checked={metronome} onChange={(event) => { model.current.metronome = event.target.checked; setMetronome(event.target.checked); playbackRef.current?.reset(); syncAudio(); }} />Metronom</label>
            <label>Măsură<select aria-label="Măsură" value={signature} onChange={(event) => { model.current.signature = event.target.value; setSignature(event.target.value); playbackRef.current?.reset(); syncAudio(); }}>{STUDIO_METERS.map((meter) => <option key={meter} value={meter}>{meter}</option>)}</select></label>
        </div>
        <p className="is-device" role="status">{midiStatus}</p>
        <div className="my-4 rounded-2xl border border-amber-300/20 bg-zinc-900/80 p-4 shadow-xl" aria-label="Player MIDI premium">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-200"><Music size={16} />{playerName || 'Player MIDI'}</p>
                {TEACHER_EMAILS.includes(user?.email) && <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 px-5 py-2 text-sm font-bold text-zinc-900 shadow transition hover:brightness-110 focus-within:ring-2 focus-within:ring-amber-200">
                    <Upload size={16} />Încarcă Matriță / Exercițiu MIDI
                    <input type="file" accept=".mid, .midi" className="hidden" onChange={loadPlayerMidi} />
                </label>}
            </div>
            {playerSrc ? <>
                <midi-player src={playerSrc} visualizer="#is-midi-visualizer" class="block w-full overflow-hidden rounded-xl bg-zinc-800" />
                <midi-visualizer id="is-midi-visualizer" type="waterfall" src={playerSrc} class="mt-3 block max-h-72 w-full overflow-auto rounded-xl bg-zinc-950" />
            </> : <p className="text-sm text-zinc-400">Încarcă un fișier MIDI sau înregistrează o temă pentru a-l reda aici.</p>}
        </div>
        {mp3 && <div className="is-media"><span>{mp3}</span><button type="button" className="is-button" disabled={recordingLocked} onClick={() => { pause(); audioRef.current.removeAttribute('src'); audioRef.current.load(); URL.revokeObjectURL(urlRef.current); urlRef.current = null; setMp3(''); seek(0); }}>Elimină MP3</button></div>}
        {isHomeworkMode === true && <div className="is-homework" role="group" aria-label="Înregistrare temă">
            <button type="button" className="is-button is-record" aria-label={['recording', 'starting'].includes(recordState) ? 'STOP' : 'REC'} aria-pressed={recordState === 'recording'} disabled={!mp3 || ['stopping', 'uploading'].includes(recordState)} onClick={() => ['recording', 'starting'].includes(recordState) ? pause() : void startRecording()}>
                {['recording', 'starting'].includes(recordState) ? <Square size={17} /> : <Circle size={17} fill="currentColor" />}{['recording', 'starting'].includes(recordState) ? 'STOP' : recordState === 'stopping' ? 'Se finalizează…' : 'REC'}
            </button>
            {previewUrl && <><audio ref={previewRef} controls src={previewUrl} preload="metadata" aria-label="Audiție temă" /><button type="button" className="is-button" disabled={['uploading', 'sent'].includes(recordState)} onClick={() => void submitHomework()}><Send size={17} />{recordState === 'sent' ? 'Temă trimisă' : recordState === 'uploading' ? 'Se trimite…' : 'Trimite Tema'}</button></>}
            {homeworkLink && <a className="is-button" href={homeworkLink} target="_blank" rel="noopener noreferrer">Deschide în Drive</a>}
        </div>}
        <audio ref={audioRef} preload="metadata" onError={() => { if (urlRef.current) { if (homeworkRef.current.busy) failRecording('Fișierul MP3 nu poate fi decodat.'); else { pause(); setMessage('Fișierul MP3 nu poate fi decodat.'); } } }}
            onWaiting={() => { model.current.buffering = true; playbackRef.current?.reset(); }}
            onPlaying={() => { model.current.buffering = false; syncAudio(); }}
            onSeeking={() => playbackRef.current?.reset()}
            onSeeked={syncAudio}
            onLoadedMetadata={() => { const audio = audioRef.current; audio.currentTime = Math.min(model.current.clock.read(), audio.duration); audio.playbackRate = model.current.rate; audio.preservesPitch = true; }}
            onEnded={() => { if (homeworkRef.current.active) { pause(); return; } const current = model.current; if (current.running && current.mediaActive) { current.clock.seek(audioRef.current.currentTime); current.clock.play(); current.mediaActive = false; } }} />
        <div className="is-transport">
            <button type="button" className="is-button is-play" disabled={recordingLocked} aria-label={view.running ? 'Pauză studiu' : 'Pornește studiul'} title={view.running ? 'Pauză' : 'Redare'} onClick={() => view.running ? pause() : void play()}>{view.running ? <Pause size={20} /> : <Play size={20} />}</button>
            <button type="button" className="is-button" disabled={recordingLocked} aria-label="Reia studiul" title="Reia studiul" onClick={restart}><RotateCcw size={18} /></button>
            <output>{timeLabel(view.position)} / {timeLabel(sequence.duration)}</output>
            <label className="is-tempo">Tempo <input aria-label="Tempo studio" type="range" min="0.25" max="1.5" step="0.05" value={rate} disabled={recordingLocked} onChange={(event) => {
                const next = Number(event.target.value);
                playbackRef.current?.reset();
                model.current.clock.seek(position());
                model.current.clock.setRate(next);
                model.current.rate = next;
                audioRef.current.playbackRate = next;
                audioRef.current.preservesPitch = true;
                setRate(next);
                syncAudio();
            }} /><output>{Math.round(rate * 100)}%</output></label>
        </div>
        <input className="is-seek" aria-label="Poziție studiu" type="range" min="0" max={sequence.duration} step="0.01" value={view.position} disabled={recordingLocked} onChange={(event) => { pause(); seek(Number(event.target.value)); }} />
        <div className="is-loop">
            <button type="button" className="is-button" disabled={recordingLocked} onClick={() => { const a = position(); if (a + 0.3 >= model.current.b) { setMessage('Punctul A trebuie să fie înainte de B cu minimum 0,3 secunde.'); return; } pause(); model.current.a = a; setMarks({ a, b: model.current.b }); resetScore(a); refresh(); }}>A · {timeLabel(marks.a)}</button>
            <button type="button" className="is-button" disabled={recordingLocked} onClick={() => { const b = position(); if (b <= model.current.a + 0.3) { setMessage('Punctul B trebuie să fie după A cu minimum 0,3 secunde.'); return; } pause(); model.current.b = b; setMarks({ a: model.current.a, b }); resetScore(model.current.loop ? model.current.a : 0); if (model.current.loop) seek(model.current.a); refresh(); }}>B · {timeLabel(marks.b)}</button>
            <label><input type="checkbox" checked={loop} disabled={recordingLocked} onChange={(event) => { pause(); const enabled = event.target.checked; model.current.loop = enabled; setLoop(enabled); seek(enabled ? model.current.a : 0); }} /><Repeat2 size={17} />Buclă A–B</label>
            <label>Registru<select aria-label="Registru claviaturi" defaultValue="48" onChange={(event) => { scrollRef.current.scrollLeft = keys[Number(event.target.value)].left; }}>
                {[0, 12, 24, 36, 48, 60, 72, 84, 96, 108].map((note) => <option key={note} value={note}>{keys[note].name}</option>)}
            </select></label>
        </div>
        <div ref={scrollRef} className="is-scroll" tabIndex={0} aria-label="Claviaturi cu derulare orizontală">
            <div className="is-boards" style={{ width: boardWidth }}>
                {animation && <Waterfall model={model} actions={actions} running={view.running} sequence={sequence} pausedPosition={view.running ? null : view.position} />}
                <div className="is-board-label">Profesor</div>
                <Keyboard teacher active={view.teacher} actions={actions} />
                <div className="is-board-label">Elev</div>
                <Keyboard active={view.student} feedback={view.feedback} actions={actions} />
            </div>
        </div>
        <div className="is-score" role="status" aria-live={view.ended ? 'polite' : 'off'}>
            <strong>{view.ended ? 'Rezultat final · ' : ''}Acuratețe: {accuracy(view.hits, view.expected)}%</strong>
            <span>{view.hits} / {view.expected} note corecte · {view.wrong} apăsări greșite</span>
        </div>
        {message && <p role="alert" className="is-error">{message}</p>}
    </section>;
}