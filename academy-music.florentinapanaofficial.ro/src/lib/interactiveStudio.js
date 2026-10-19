import midiPackage from '@tonejs/midi';
import { createVoice } from './piano.js';

const { Midi } = midiPackage;
export const HIT_WINDOW = 0.18;

export function parseStudioMidi(bytes) {
    const midi = new Midi(bytes);
    const notes = midi.tracks.filter((track) => !track.instrument.percussion)
        .flatMap((track) => track.notes.map((note) => ({ note: note.midi, time: note.time, duration: note.duration })))
        .sort((first, second) => first.time - second.time || first.note - second.note)
        .filter((note, index, all) => index === 0 || note.time !== all[index - 1].time || note.note !== all[index - 1].note);
    if (!notes.length) throw new Error('Fișierul MIDI nu conține note melodice.');
    const duration = Math.max(...notes.map((note) => note.time + note.duration)) + HIT_WINDOW;
    if (notes.length > 20000 || duration > 1200) throw new Error('Limita este de 20.000 de note și 20 de minute.');
    return { notes: notes.map((note, id) => ({ ...note, id })), duration, maxDuration: Math.max(...notes.map((note) => note.duration)), name: midi.name || 'Studiu MIDI', header: midi.header };
}

export const STUDIO_METERS = ['2/4', '3/4', '4/4', '6/8', '9/8', '12/8'];

export function studioBeats(sequence, start, end, signature) {
    if (!STUDIO_METERS.includes(signature)) return [];
    const [count, unit] = signature.split('/').map(Number);
    const ticksPerBeat = sequence.header.ppq * 4 / unit;
    const first = Math.ceil(sequence.header.secondsToTicks(start) / ticksPerBeat - 0.000001);
    const beats = [];
    for (let index = first; ; index += 1) {
        const time = sequence.header.ticksToSeconds(index * ticksPerBeat);
        if (time >= end) break;
        if (time >= start - 0.000001) beats.push({ index, time, accent: index % count === 0 });
    }
    return beats;
}

export function createStudioMixer(audio, demoLevel = 0.65, studentLevel = 0.8) {
    const demo = audio.createGain();
    const student = audio.createGain();
    demo.gain.value = demoLevel;
    student.gain.value = studentLevel;
    demo.connect(audio.destination);
    student.connect(audio.destination);
    return {
        demo, student,
        setDemo(level) { demo.gain.setTargetAtTime(level, audio.currentTime, 0.01); },
        setStudent(level) { student.gain.setTargetAtTime(level, audio.currentTime, 0.01); },
        disconnect() { demo.disconnect(); student.disconnect(); },
    };
}

export function createStudioPlayback(audio, mixer) {
    const voices = new Map();
    const scheduled = new Set();
    let anchor = null;
    function reset() {
        for (const voice of voices.values()) { try { voice.oscillator.stop(audio.currentTime); } catch { } }
        voices.clear();
        scheduled.clear();
        anchor = null;
    }
    function remember(id, voice) {
        scheduled.add(id);
        voices.set(id, voice);
        const ended = voice.oscillator.onended;
        voice.oscillator.onended = () => { ended?.(); if (voices.get(id) === voice) voices.delete(id); };
    }
    function sync({ sequence, position, rate, end = sequence.duration, signature = '4/4', metronome = false, instrument = 'piano', running = true }) {
        if (!running || audio.state === 'suspended') { reset(); return; }
        if (anchor && (anchor.rate !== rate || anchor.sequence !== sequence || anchor.signature !== signature || anchor.metronome !== metronome || anchor.instrument !== instrument || Math.abs(position - (anchor.position + (audio.currentTime - anchor.audioTime) * rate)) > 0.04)) reset();
        anchor = { position, rate, sequence, signature, metronome, instrument, audioTime: audio.currentTime };
        const until = Math.min(end, position + 0.12 * rate);
        for (const note of visibleNotes(sequence, position, until - position)) {
            const id = `note:${note.id}`;
            if (scheduled.has(id) || note.time >= until) continue;
            const start = Math.max(position, note.time);
            const duration = (Math.min(note.time + note.duration, end) - start) / rate;
            if (duration <= 0) continue;
            remember(id, createVoice(audio, note.note, audio.currentTime + (start - position) / rate, instrument, duration, mixer.demo));
        }
        if (metronome) for (const beat of studioBeats(sequence, Math.max(0, position - 0.005 * rate), until, signature)) {
            const id = `beat:${beat.index}`;
            if (scheduled.has(id)) continue;
            const when = audio.currentTime + Math.max(0, (beat.time - position) / rate);
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.frequency.value = beat.accent ? 1200 : 800;
            gain.gain.setValueAtTime(0.12, when);
            gain.gain.exponentialRampToValueAtTime(0.001, when + 0.035);
            oscillator.connect(gain);
            gain.connect(audio.destination);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
            oscillator.start(when);
            oscillator.stop(when + 0.04);
            remember(id, { oscillator });
        }
    }
    return { sync, reset };
}

export function createHomeworkCapture(audio, mixer, media, Recorder = globalThis.MediaRecorder) {
    if (!Recorder) throw new Error('Browserul nu acceptă înregistrarea audio MediaRecorder.');
    const destination = audio.createMediaStreamDestination();
    const source = audio.createMediaElementSource(media);
    source.connect(audio.destination);
    source.connect(destination);
    mixer.student.connect(destination);
    let recorder = null;
    let disposed = false;
    return {
        start(onComplete, onError) {
            if (disposed || (recorder && recorder.state !== 'inactive')) throw new Error('Înregistrarea este deja pornită sau închisă.');
            const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find((type) => Recorder.isTypeSupported?.(type));
            recorder = mimeType ? new Recorder(destination.stream, { mimeType }) : new Recorder(destination.stream);
            const current = recorder;
            const chunks = [];
            let bytes = 0;
            let failed = false;
            const fail = (message) => { if (failed || disposed) return; failed = true; onError(new Error(message)); };
            current.ondataavailable = (event) => {
                if (!event.data?.size || disposed || failed) return;
                bytes += event.data.size;
                if (bytes > 50 * 1024 * 1024) { fail('Înregistrarea depășește limita de 50 MB.'); if (current.state !== 'inactive') current.stop(); return; }
                chunks.push(event.data);
            };
            current.onerror = () => { fail('Înregistrarea audio a fost întreruptă.'); if (current.state !== 'inactive') current.stop(); };
            current.onstop = () => {
                if (disposed || failed) return;
                const blob = new Blob(chunks, { type: current.mimeType || chunks[0]?.type || 'audio/webm' });
                if (!blob.size) { fail('Înregistrarea este goală. Încearcă din nou.'); return; }
                onComplete(blob);
            };
            current.start(1000);
        },
        stop() { if (recorder && recorder.state !== 'inactive') recorder.stop(); },
        dispose() {
            disposed = true;
            if (recorder && recorder.state !== 'inactive') recorder.stop();
            mixer.student.disconnect(destination);
            source.disconnect();
            for (const track of destination.stream.getTracks()) track.stop();
        },
    };
}

export function demoSequence() {
    const midi = new Midi();
    midi.name = 'Studiu în Do major';
    const track = midi.addTrack();
    [60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60].forEach((note, index) => {
        track.addNote({ midi: note, time: 1 + index * 0.6, duration: 0.45 });
    });
    return parseStudioMidi(midi.toArray());
}

export function lowerBound(notes, time) {
    let start = 0;
    let end = notes.length;
    while (start < end) {
        const middle = Math.floor((start + end) / 2);
        if (notes[middle].time < time) start = middle + 1;
        else end = middle;
    }
    return start;
}

export function visibleNotes(sequence, time, ahead = 0) {
    return sequence.notes.slice(lowerBound(sequence.notes, time - sequence.maxDuration), lowerBound(sequence.notes, time + ahead + 0.001))
        .filter((note) => note.time + note.duration > time);
}

export function matchNote(notes, pitch, time, hitIds, rate = 1, start = 0, end = Infinity) {
    const window = HIT_WINDOW * rate;
    return notes.slice(lowerBound(notes, time - window), lowerBound(notes, time + window + 0.000001))
        .filter((note) => note.note === pitch && !hitIds.has(note.id) && note.time >= start && note.time < end)
        .sort((first, second) => Math.abs(first.time - time) - Math.abs(second.time - time))[0] || null;
}

export function accuracy(hits, expected) { return expected ? Math.round(hits / expected * 100) : 0; }

export function loopPosition(position, start, end) {
    return position >= end ? start + (position - end) % (end - start) : position;
}

export class StudioClock {
    constructor(now = () => performance.now() / 1000) { this.now = now; this.position = 0; this.rate = 1; this.running = false; this.anchor = now(); }
    read() { return this.position + (this.running ? (this.now() - this.anchor) * this.rate : 0); }
    seek(position) { this.position = position; this.anchor = this.now(); }
    play() { this.anchor = this.now(); this.running = true; }
    pause() { this.seek(this.read()); this.running = false; }
    setRate(rate) { this.seek(this.read()); this.rate = rate; }
}