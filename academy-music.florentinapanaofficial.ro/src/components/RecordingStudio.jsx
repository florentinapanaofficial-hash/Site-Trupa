import KaraokeLyrics from './KaraokeLyrics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, BUCKET_MEDIA, BUCKET_PORTFOLIO } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { getSignedUrl, safeFileName, uploadFile } from '../lib/media';
import { resolveAudioSource } from '../lib/pieces';
import { logEvent } from '../lib/activity';
import { uploadHomeworkToDrive } from '../lib/submitHomework';
import {
    MAX_RECORDING_MS,
    createStudioSession,
    extensionFor,
    formatClock,
    isRecordingSupported,
} from '../lib/recorder';
import Modal from './ui/Modal';

export default function RecordingStudio({ open, piece, onClose, onSubmitted }) {
    const { profile } = useAuth();
    const [lyricTime, setLyricTime] = useState(0);
    const [mix, setMix] = useState(0.2);
    const captureRef = useRef(null);
    const mountedRef = useRef(true);
    const [withVideo, setWithVideo] = useState(false);
    const [autoBacking, setAutoBacking] = useState(true);
    const [phase, setPhase] = useState('idle');
    const [elapsed, setElapsed] = useState(0);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [result, setResult] = useState(null);
    const [note, setNote] = useState('');

    const sessionRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const previewRef = useRef(null);

    const negativ = piece ? resolveAudioSource(piece, 'negativ') || (piece.audio_negativ_path ? { kind: 'storage', value: piece.audio_negativ_path } : null) : null;

    const teardown = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (sessionRef.current) { sessionRef.current.recorder.onstop = null; sessionRef.current.recorder.ondataavailable = null; }
        captureRef.current?.abort();
        sessionRef.current?.stopEverything();
        sessionRef.current = null;
    }, []);

    useEffect(() => {
        if (open) return undefined;
        teardown();
        return undefined;
    }, [open, teardown]);

    useEffect(() => {
        mountedRef.current = true;
        const hide = () => {
            if (!document.hidden) return;
            if (sessionRef.current) stop();
            else if (captureRef.current && !captureRef.current.signal.aborted) { captureRef.current.abort(); setPhase('idle'); setNotice('Activarea a fost anulată deoarece aplicația a trecut în fundal.'); }
        };
        document.addEventListener('visibilitychange', hide);
        window.addEventListener('pagehide', teardown);
        return () => { mountedRef.current = false; teardown(); document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', teardown); };
    }, [teardown]);

    useEffect(
        () => () => {
            if (result?.url) URL.revokeObjectURL(result.url);
        },
        [result]
    );

    useEffect(() => {
        if (phase !== 'recording') return;
        let frame;
        const tick = () => {
            const backing = sessionRef.current?.backing;
            if (backing) setLyricTime(backing.currentTime);
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [phase]);

    async function prepare() {
        if (phase !== 'headphones') return;
        setError('');
        setNotice('');

        if (!isRecordingSupported()) {
            setError('Browserul tău nu permite înregistrarea. Încearcă Chrome sau Edge actualizat.');
            return;
        }

        setPhase('preparing');
        const abort = new AbortController(); captureRef.current = abort;

        try {
            let backingUrl = null;
            if (autoBacking && negativ) {
                backingUrl =
                    negativ.kind === 'url' ? negativ.value : await getSignedUrl(BUCKET_MEDIA, negativ.value);
            }

            if (abort.signal.aborted) return;
            const session = await createStudioSession({ withVideo, backingUrl, mix, signal: abort.signal });
            if (abort.signal.aborted || !mountedRef.current) { session.stopEverything(); return; }
            sessionRef.current = session;

            if (withVideo && previewRef.current) {
                previewRef.current.srcObject = session.userStream;
            }

            session.userStream.getTracks().forEach(track => track.addEventListener('ended', () => { stop(); setNotice('Dispozitivul a fost deconectat; înregistrarea s-a oprit.'); }, { once: true }));
            session.context.addEventListener('statechange', () => { if (session.context.state === 'suspended' || session.context.state === 'interrupted') { stop(); setNotice('Înregistrarea a fost oprită deoarece dispozitivul audio a fost întrerupt.'); } });
            start();
        } catch (err) {
            if (abort.signal.aborted || !mountedRef.current) return;
            teardown();
            const message =
                err?.name === 'NotAllowedError'
                    ? 'Ai refuzat accesul la microfon. Permite-l din bara de adrese și încearcă din nou.'
                    : err?.name === 'NotFoundError'
                        ? 'Nu am găsit microfon sau cameră pe acest dispozitiv.'
                        : err?.message || 'Nu am putut porni înregistrarea.';
            setError(message);
            setPhase('idle');
        }
    }

    function start() {
        const session = sessionRef.current;
        if (!session) return;

        chunksRef.current = [];
        setElapsed(0); setLyricTime(0);
        setError('');

        session.recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunksRef.current.push(event.data);
        };

        session.recorder.onstop = () => {
            if (!mountedRef.current || captureRef.current?.signal.aborted) return;
            const blob = new Blob(chunksRef.current, { type: session.mimeType });
            sessionRef.current = null; captureRef.current = null;
            if (!blob.size) { setError('Înregistrarea este goală. Reîncearcă și înregistrează cel puțin o secundă.'); setPhase('idle'); return; }
            setResult({ blob, url: URL.createObjectURL(blob), mimeType: session.mimeType });
            setPhase('review');
        };

        session.recorder.start(1000);

        if (session.backing) {
            session.backing.currentTime = 0;
            session.backing.play().catch(() => { stop(); setError('Negativul nu a putut porni. Înregistrarea a fost oprită; reîncearcă sau înregistrează fără negativ.'); });
        }

        const startedAt = Date.now();
        timerRef.current = setInterval(() => {
            const value = Date.now() - startedAt;
            setElapsed(value);
            if (value >= MAX_RECORDING_MS) stop();
        }, 250);

        setPhase('recording');
    }

    function stop() {
        const session = sessionRef.current;
        if (!session) return;

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        session.backing?.pause();
        session.stopEverything();
    }

    function retry() {
        if (result?.url) URL.revokeObjectURL(result.url);
        setResult(null);
        setElapsed(0);
        setPhase('idle');
    }

    async function submit() {
        if (!result) return;
        setPhase('uploading');
        setError('');

        try {
            const extension = extensionFor(result.mimeType);
            const base = safeFileName(`${piece.title}-tema`);
            const path = `${profile.id}/${Date.now()}-${base}.${extension}`;
            const file = new File([result.blob], `${base}.${extension}`, { type: result.mimeType });

            if (!withVideo) {
                await uploadHomeworkToDrive({ blob: file, fileName: file.name, title: `${piece.title} — înregistrare`.slice(0, 200), studentNote: note.trim(), pieceId: piece.id });
                logEvent(profile.id, 'recording_submitted', '/', { piece_id: piece.id, with_video: false });
                teardown();
                setPhase('submitted');
                onSubmitted?.();
                return;
            }

            await uploadFile(BUCKET_PORTFOLIO, path, file);

            const { error: insertError } = await supabase.from('submissions').insert({
                student_id: profile.id,
                piece_id: piece.id,
                title: `${piece.title} — înregistrare`,
                student_note: note.trim() || null,
                media_path: path,
                media_type: withVideo ? 'video' : 'audio',
            });
            if (insertError) throw insertError;

            logEvent(profile.id, 'recording_submitted', '/', {
                piece_id: piece.id,
                with_video: withVideo,
            });

            teardown();
            onSubmitted?.();
            onClose();
        } catch (err) {
            setError(err?.message || 'Trimiterea temei a eșuat.');
            setPhase('review');
        }
    }

    function handleClose() {
        teardown();
        setPhase('idle');
        setResult(null);
        setElapsed(0);
        setError('');
        setNotice('');
        setNote('');
        onClose();
    }

    const busy = phase === 'preparing' || phase === 'uploading';

    return (
        <Modal
            open={open}
            title={piece ? `Înregistrează tema — ${piece.title}` : 'Înregistrează tema'}
            onClose={handleClose}
            wide
        >
            <div className="space-y-4">
                {phase === 'idle' && (
                    <>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setWithVideo(false)}
                                className={`rounded-xl border px-4 py-3 text-left transition ${!withVideo
                                    ? 'border-gold-400/60 bg-gold-500/10'
                                    : 'border-white/15 hover:border-white/30'
                                    }`}
                            >
                                <span className="block text-lg">🎙️</span>
                                <span className="mt-1 block font-semibold text-white">Doar audio</span>
                                <span className="block text-xs text-slate-400">Fișier mai mic, pornește rapid.</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setWithVideo(true)}
                                className={`rounded-xl border px-4 py-3 text-left transition ${withVideo
                                    ? 'border-gold-400/60 bg-gold-500/10'
                                    : 'border-white/15 hover:border-white/30'
                                    }`}
                            >
                                <span className="block text-lg">🎥</span>
                                <span className="mt-1 block font-semibold text-white">Video + audio</span>
                                <span className="block text-xs text-slate-400">Se vede și ținuta la instrument.</span>
                            </button>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-slate-300">
                            <input
                                type="checkbox"
                                checked={autoBacking}
                                onChange={(event) => setAutoBacking(event.target.checked)}
                                disabled={!negativ}
                                className="h-4 w-4 accent-gold-500"
                            />
                            Pornește negativul automat la REC
                            {!negativ && <span className="text-xs text-slate-500">(piesa nu are negativ)</span>}
                        </label>

                        <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400">
                            Folosește căști: altfel negativul intră a doua oară prin microfon și se aude dublat.
                        </p>

                        <button type="button" className="btn-primary w-full" onClick={() => setPhase('headphones')}>
                            REC · Pregătește tema
                        </button>
                    </>
                )}

                {phase === 'headphones' && <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gold-300">Regulă de studio</h3>
                    <p>Regulă de studio: Pentru a evita microfonia (țiuitul) și a auzi negativul corect, conectează căștile cu microfon!</p>
                    <p className="text-sm text-slate-300">Microfonul pornește numai după confirmare, pentru înregistrarea temei. Începe cu volumul redus. Aplicația nu poate verifica fizic căștile.</p>
                    <button type="button" className="btn-gold" onClick={prepare}>Sunt gata, am conectat căștile!</button>
                    <button type="button" className="btn-ghost ml-3" onClick={() => setPhase('idle')}>Anulează</button>
                </div>}

                {phase === 'preparing' && (
                    <p className="py-6 text-center text-sm text-slate-400">
                        Se cere accesul la microfon{withVideo ? ' și cameră' : ''}…
                    </p>
                )}

                {phase === 'recording' && (
                    <>
                        {withVideo && (
                            <video
                                ref={previewRef}
                                autoPlay
                                muted
                                playsInline
                                className="w-full rounded-xl bg-black"
                            />
                        )}

                        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-4">
                            <div className="flex items-center gap-3">
                                <span
                                    className={`h-3 w-3 rounded-full ${phase === 'recording' ? 'animate-pulse bg-brand-500' : 'bg-white/30'
                                        }`}
                                />
                                <span className="font-mono text-lg text-white">{formatClock(elapsed)}</span>
                            </div>

                            <button type="button" className="btn-ghost" onClick={stop}>■ Stop</button>
                        </div>

                        {piece?.versuri_text && <section className="space-y-3 rounded-xl border border-gold-400/20 p-4" aria-label="Versuri ajutătoare pentru temă">
                            <h3 className="font-semibold text-gold-300">Versuri ajutătoare · doar vizual</h3>
                            <p className="text-xs text-slate-300">{autoBacking && negativ ? 'Urmăresc negativul din înregistrare. Fișierul audio conține vocea și negativul, nu textul afișat.' : 'Fără negativ, versurile rămân vizibile fără sincronizare audio.'}</p>
                            <KaraokeLyrics text={piece.versuri_text} time={autoBacking && negativ ? lyricTime : -1} />
                        </section>}
                        <label className="block text-sm text-slate-200">Reverb Dry/Wet · {Math.round(mix * 100)}%<input type="range" min="0" max="1" step="0.01" value={mix} className="mt-3 block w-full accent-gold-400" onChange={event => { const value = Number(event.target.value); setMix(value); sessionRef.current?.setMix(value); }} /></label>
                        <p className="text-xs text-slate-500">
                            Durata maximă este de 10 minute; înregistrarea se oprește singură la final.
                        </p>
                    </>
                )}

                {phase === 'review' && result && (
                    <>
                        {withVideo ? (
                            <video src={result.url} controls playsInline className="w-full rounded-xl bg-black" />
                        ) : (
                            <audio src={result.url} controls className="w-full" />
                        )}

                        <div>
                            <label className="label" htmlFor="recording-note">
                                Mesaj pentru profesor (opțional)
                            </label>
                            <textarea
                                id="recording-note"
                                className="input min-h-[70px]"
                                maxLength={500}
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button type="button" className="btn-ghost" onClick={retry}>
                                ↺ Mai încerc o dată
                            </button>
                            <button type="button" className="btn-gold flex-1" onClick={submit}>
                                Trimite tema
                            </button>
                        </div>
                    </>
                )}

                {phase === 'submitted' && <div className="space-y-4 py-6"><p role="status" className="text-sm text-emerald-200">Tema a fost trimisă cu succes domnului profesor!</p><button type="button" className="btn-gold" onClick={handleClose}>Închide</button></div>}

                {phase === 'uploading' && (
                    <p className="py-6 text-center text-sm text-slate-400">Se trimite tema…</p>
                )}

                {notice && (
                    <p className="rounded-lg bg-gold-500/10 px-3 py-2 text-xs text-gold-400">{notice}</p>
                )}
                {error && (
                    <p className="rounded-lg bg-brand-500/15 px-3 py-2 text-sm text-brand-200">{error}</p>
                )}

                {busy && <p className="sr-only">Se procesează…</p>}
            </div>
        </Modal>
    );
}
