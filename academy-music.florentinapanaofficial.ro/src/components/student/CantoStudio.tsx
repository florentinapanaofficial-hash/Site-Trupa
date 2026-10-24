import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getSignedAudioUrl } from '../../lib/media';
import { getAudioStorageLocation, resolveAudioSource } from '../../lib/pieces';
import { MAX_RECORDING_MS, formatClock, pickMimeType } from '../../lib/recorder';
import { HOMEWORK_MAX_BYTES, submissionState, submitTimedHomework } from '../../lib/timedHomework';

export type CantoBackingPiece = {
    id: string;
    title: string;
    negative_url?: string | null;
    audio_negativ_path?: string | null;
};
type Props = {
    assignmentId: string;
    submissionStart: string;
    submissionEnd: string;
    pieces?: CantoBackingPiece[];
    onSubmitted?: () => void;
    onBusyChange?: (busy: boolean) => void;
    externalBusy?: boolean;
};
type Capture = {
    context: AudioContext;
    stream: MediaStream;
    source: MediaStreamAudioSourceNode;
    analyser: AnalyserNode;
    recorder: MediaRecorder;
    frame: number;
    timer: number;
    startedAt: number;
    discard: boolean;
    released: boolean;
};
type Take = { blob: Blob; url: string };

export default function CantoStudio({ assignmentId, submissionStart, submissionEnd, pieces = [], onSubmitted, onBusyChange, externalBusy = false }: Props) {
    const [pieceId, setPieceId] = useState('');
    const [backingUrl, setBackingUrl] = useState('');
    const [backingLoading, setBackingLoading] = useState(false);
    const [headphones, setHeadphones] = useState(false);
    const [phase, setPhase] = useState<'idle' | 'starting' | 'recording' | 'ready' | 'uploading' | 'sent'>('idle');
    const [take, setTake] = useState<Take | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [now, setNow] = useState(Date.now);
    const backing = useRef<HTMLAudioElement>(null);
    const preview = useRef<HTMLAudioElement>(null);
    const meter = useRef<HTMLMeterElement>(null);
    const capture = useRef<Capture | null>(null);
    const streamPending = useRef<MediaStream | null>(null);
    const contextPending = useRef<AudioContext | null>(null);
    const takeRef = useRef<Take | null>(null);
    const mounted = useRef(false);
    const generation = useRef(0);
    const operation = useRef(false);
    const windowState = submissionState(submissionStart, submissionEnd, now);
    const busy = phase === 'starting' || phase === 'recording' || phase === 'uploading';
    const selected = pieces.find((piece) => piece.id === pieceId);
    const selectedPath = selected?.audio_negativ_path;
    const selectedUrl = selected?.negative_url;

    useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

    function report(failure: unknown, message: string) {
        console.error('[Academy] Canto Studio:', failure);
        if (mounted.current) setError(message);
    }
    function clearTake() {
        preview.current?.pause();
        if (takeRef.current) URL.revokeObjectURL(takeRef.current.url);
        takeRef.current = null;
        setTake(null);
    }
    function release(session: Capture) {
        if (session.released) return;
        session.released = true;
        window.cancelAnimationFrame(session.frame);
        window.clearInterval(session.timer);
        session.stream.getTracks().forEach((track) => track.stop());
        session.source.disconnect();
        session.analyser.disconnect();
        void session.context.close().catch((failure: unknown) => report(failure, 'Contextul audio nu a putut fi închis. Reîncarcă pagina.'));
        backing.current?.pause();
        if (meter.current) meter.current.value = 0;
        if (capture.current === session) capture.current = null;
    }
    function stop(discard = false) {
        const session = capture.current;
        if (!session) return;
        session.discard ||= discard;
        window.cancelAnimationFrame(session.frame);
        window.clearInterval(session.timer);
        backing.current?.pause();
        if (session.recorder.state !== 'inactive') session.recorder.stop();
    }
    useEffect(() => {
        mounted.current = true;
        const clock = window.setInterval(() => {
            setNow(Date.now());
            if (submissionState(submissionStart, submissionEnd) !== 'open') stop();
        }, 250);
        const hidden = () => {
            if (document.visibilityState !== 'hidden') return;
            generation.current++;
            stop();
            backing.current?.pause();
        };
        document.addEventListener('visibilitychange', hidden);
        window.addEventListener('pagehide', hidden);
        return () => {
            mounted.current = false;
            generation.current++;
            window.clearInterval(clock);
            document.removeEventListener('visibilitychange', hidden);
            window.removeEventListener('pagehide', hidden);
            streamPending.current?.getTracks().forEach((track) => track.stop());
            const pendingContext = contextPending.current;
            if (pendingContext && pendingContext.state !== 'closed') void pendingContext.close().catch((failure: unknown) => report(failure, 'Contextul audio nu a putut fi închis.'));
            contextPending.current = null;
            const session = capture.current;
            if (session) { stop(true); release(session); }
            if (takeRef.current) URL.revokeObjectURL(takeRef.current.url);
        };
    }, [submissionStart, submissionEnd]);

    useEffect(() => {
        let active = true;
        setBackingUrl('');
        setBackingLoading(Boolean(pieceId));
        if (!pieceId) return;
        void (async () => {
            try {
                const direct = resolveAudioSource({ negative_url: selectedUrl }, 'negativ');
                const location = getAudioStorageLocation(selectedPath);
                const url = direct?.value || (location ? await getSignedAudioUrl(location.bucket, location.path) : null);
                if (!url) throw new Error('Piesa selectată nu are negativ disponibil.');
                if (active) setBackingUrl(url);
            } catch (failure) { if (active) report(failure, 'Negativul nu a putut fi încărcat. Reîncearcă sau înregistrează fără negativ.'); }
            finally { if (active) setBackingLoading(false); }
        })();
        return () => { active = false; };
    }, [pieceId, selectedPath, selectedUrl]);

    async function record() {
        if (externalBusy || operation.current || capture.current) return;
        setError(''); setNotice('');
        if (!headphones) { setError('Confirmă că folosești căști înainte de înregistrare.'); return; }
        if (submissionState(submissionStart, submissionEnd) !== 'open') { setError('Înregistrarea se poate începe doar în fereastra de predare.'); return; }
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined' || typeof AudioContext === 'undefined') {
            setError('Browserul nu acceptă înregistrarea audio. Folosește un browser actualizat sau încarcă un fișier.'); return;
        }
        if (pieceId && !backingUrl) { setError('Încarcă negativul sau selectează înregistrare fără negativ.'); return; }
        operation.current = true;
        const current = ++generation.current;
        setPhase('starting');
        let stream: MediaStream | null = null;
        let context: AudioContext | null = null;
        let session: Capture | null = null;
        try {
            preview.current?.pause();
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
            streamPending.current = stream;
            if (!mounted.current || generation.current !== current || submissionState(submissionStart, submissionEnd) !== 'open') throw new Error('Înregistrarea a fost anulată sau termenul a expirat.');
            context = new AudioContext();
            contextPending.current = context;
            await context.resume();
            if (!mounted.current || generation.current !== current) throw new Error('Înregistrarea a fost anulată.');
            const source = context.createMediaStreamSource(stream);
            const analyser = context.createAnalyser();
            analyser.fftSize = 1024;
            source.connect(analyser);
            const mimeType = pickMimeType(false);
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            session = { context, stream, source, analyser, recorder, frame: 0, timer: 0, startedAt: performance.now(), discard: false, released: false };
            const recording = session;
            capture.current = recording;
            contextPending.current = null;
            stream.getTracks().forEach((track) => track.addEventListener('ended', () => {
                if (capture.current === recording) { setNotice('Microfonul a fost deconectat. Înregistrarea s-a oprit.'); stop(); }
            }, { once: true }));
            streamPending.current = null;
            const chunks: Blob[] = [];
            let bytes = 0;
            recorder.ondataavailable = (event: BlobEvent) => {
                if (event.data.size) { chunks.push(event.data); bytes += event.data.size; }
                if (bytes > HOMEWORK_MAX_BYTES) {
                    recording.discard = true;
                    report(new Error('Recording exceeds upload limit'), 'Înregistrarea a depășit 30 MB. Fă o înregistrare mai scurtă.');
                    stop(true);
                }
            };
            recorder.onerror = (event) => { recording.discard = true; report(event, 'Înregistrarea a eșuat. Verifică microfonul și încearcă din nou.'); stop(true); };
            recorder.onstop = () => {
                release(recording);
                if (!mounted.current) return;
                if (!recording.discard && chunks.length && bytes <= HOMEWORK_MAX_BYTES) {
                    const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0].type });
                    clearTake();
                    const result = { blob, url: URL.createObjectURL(blob) };
                    takeRef.current = result;
                    setTake(result);
                    setPhase('ready');
                } else { setPhase(takeRef.current ? 'ready' : 'idle'); }
            };
            if (backing.current && backingUrl) {
                backing.current.currentTime = 0;
                await backing.current.play();
            }
            if (!mounted.current || generation.current !== current || submissionState(submissionStart, submissionEnd) !== 'open') throw new Error('Înregistrarea a fost anulată sau termenul a expirat.');
            clearTake();
            setElapsed(0);
            recording.startedAt = performance.now();
            recorder.start(250);
            setPhase('recording');
            const samples = new Float32Array(analyser.fftSize);
            const draw = () => {
                if (capture.current !== recording || recorder.state !== 'recording') return;
                analyser.getFloatTimeDomainData(samples);
                const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
                if (meter.current) meter.current.value = Math.min(1, rms * 4);
                recording.frame = window.requestAnimationFrame(draw);
            };
            draw();
            recording.timer = window.setInterval(() => {
                const duration = performance.now() - recording.startedAt;
                setElapsed(duration);
                if (duration >= MAX_RECORDING_MS || submissionState(submissionStart, submissionEnd) !== 'open') {
                    setNotice(duration >= MAX_RECORDING_MS ? 'Înregistrarea s-a oprit la limita de 10 minute.' : 'Termenul a expirat. Poți asculta înregistrarea, dar nu o mai poți preda.');
                    stop();
                }
            }, 200);
        } catch (failure) {
            if (session) { session.discard = true; stop(true); release(session); }
            else {
                stream?.getTracks().forEach((track) => track.stop());
                if (context && context.state !== 'closed') void context.close().catch((closeError: unknown) => report(closeError, 'Contextul audio nu a putut fi închis.'));
            }
            streamPending.current = null;
            contextPending.current = null;
            report(failure, failure instanceof Error ? failure.message : 'Microfonul nu a putut fi pornit. Verifică permisiunea browserului.');
            if (mounted.current) setPhase(takeRef.current ? 'ready' : 'idle');
        } finally { operation.current = false; }
    }
    async function submit() {
        if (!take || externalBusy || operation.current || busy) return;
        if (submissionState(submissionStart, submissionEnd) !== 'open') { setError('Timpul pentru predare a expirat sau tema nu este încă deschisă.'); return; }
        operation.current = true;
        setPhase('uploading'); setError('');
        try {
            const file = new File([take.blob], 'voce', { type: take.blob.type });
            await submitTimedHomework(supabase, { assignmentId, submissionStart, submissionEnd, file });
            if (mounted.current) { setPhase('sent'); onSubmitted?.(); }
        } catch (failure) {
            report(failure, failure instanceof Error ? failure.message : 'Tema nu a putut fi trimisă. Reîncearcă.');
            if (mounted.current) setPhase('ready');
        } finally { operation.current = false; }
    }
    return <section aria-label="Studio canto pentru temă" className="space-y-3 rounded-xl border border-white/10 p-4">
        <h4 className="font-semibold text-white">Studio de canto</h4>
        <p className="text-sm text-slate-400">Exersează cu negativul în căști. În temă se înregistrează doar vocea ta. Maximum 10 minute și 30 MB.</p>
        <label className="label">Negativ din repertoriu<select className="input" value={pieceId} disabled={busy || externalBusy} onChange={(event) => { backing.current?.pause(); setPieceId(event.target.value); setError(''); }}>
            <option value="">Fără negativ</option>
            {pieces.map((piece) => <option key={piece.id} value={piece.id}>{piece.title}</option>)}
        </select></label>
        {backingLoading && <p role="status">Se încarcă negativul…</p>}
        {backingUrl && <audio ref={backing} aria-label="Negativ" className="w-full" controls preload="metadata" src={backingUrl} onError={() => report(new Error('Backing playback failed'), 'Negativul nu poate fi redat. Selectează din nou piesa pentru a reînnoi adresa.')} />}
        <label className="flex items-center gap-2"><input type="checkbox" checked={headphones} disabled={busy || externalBusy} onChange={(event) => setHeadphones(event.target.checked)} />Folosesc căști</label>
        <label className="block text-sm">Nivel microfon — cântă relaxat, evită volumul maxim
            <meter ref={meter} aria-label="Nivel microfon" className="block h-6 w-full" min={0} max={1} low={0.2} high={0.85} optimum={0.5} value={0} />
        </label>
        <p role="status" aria-live="off">{phase === 'recording' ? `Se înregistrează: ${formatClock(elapsed)}` : phase === 'starting' ? 'Se pornește microfonul…' : 'Microfonul pornește doar la apăsarea butonului.'}</p>
        <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={busy || externalBusy || phase === 'sent' || windowState !== 'open' || !headphones || backingLoading} onClick={() => void record()}>{take ? 'Înregistrează din nou vocea' : 'Înregistrează vocea'}</button>
            <button type="button" className="btn btn-ghost" disabled={phase !== 'recording'} onClick={() => stop()}>Oprește înregistrarea</button>
        </div>
        {take && <div className="space-y-2">
            <p>Ascultă vocea înregistrată înainte de predare:</p>
            <audio ref={preview} aria-label="Vocea înregistrată" className="w-full" controls src={take.url} onPlay={() => backing.current?.pause()} onError={() => report(new Error('Recording playback failed'), 'Înregistrarea nu poate fi redată în acest browser.')} />
            <button type="button" className="btn btn-primary" disabled={busy || externalBusy || phase === 'sent' || windowState !== 'open'} onClick={() => void submit()}>{phase === 'uploading' ? 'Se trimite vocea…' : 'Trimite vocea ca temă'}</button>
        </div>}
        {windowState !== 'open' && <p role="status">{windowState === 'expired' ? 'Predarea vocii nu mai este disponibilă: termenul a expirat.' : windowState === 'invalid' ? 'Intervalul de predare este invalid.' : 'Tema nu este încă deschisă.'}</p>}
        {phase === 'sent' && <p role="status" className="text-emerald-300">Vocea a fost trimisă pentru evaluare.</p>}
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert" className="text-red-300">{error}</p>}
    </section>;
}
