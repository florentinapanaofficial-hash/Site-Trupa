import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, BUCKET_PORTFOLIO } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { getSignedUrl, safeFileName, uploadFile } from '../lib/media';
import { resolveAudioSource } from '../lib/pieces';
import { logEvent } from '../lib/activity';
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

    const negativ = piece ? resolveAudioSource(piece, 'negativ') : null;

    const teardown = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        sessionRef.current?.stopEverything();
        sessionRef.current = null;
    }, []);

    useEffect(() => {
        if (open) return undefined;
        teardown();
        return undefined;
    }, [open, teardown]);

    useEffect(() => () => teardown(), [teardown]);

    useEffect(
        () => () => {
            if (result?.url) URL.revokeObjectURL(result.url);
        },
        [result]
    );

    async function prepare() {
        setError('');
        setNotice('');

        if (!isRecordingSupported()) {
            setError('Browserul tău nu permite înregistrarea. Încearcă Chrome sau Edge actualizat.');
            return;
        }

        setPhase('preparing');

        try {
            let backingUrl = null;
            if (autoBacking && negativ) {
                backingUrl =
                    negativ.kind === 'url' ? negativ.value : await getSignedUrl('academy-media', negativ.value);
            }

            const session = await createStudioSession({ withVideo, backingUrl });
            sessionRef.current = session;

            if (backingUrl && !session.backingMixed) {
                setNotice(
                    'Negativul se aude, dar nu a putut fi inclus în înregistrare. Dă-l pe difuzor ca să se audă în temă.'
                );
            }

            if (withVideo && previewRef.current) {
                previewRef.current.srcObject = session.userStream;
            }

            setPhase('ready');
        } catch (err) {
            const message =
                err?.name === 'NotAllowedError'
                    ? 'Ai refuzat accesul la microfon. Permite-l din bara de adrese și încearcă din nou.'
                    : err?.name === 'NotFoundError'
                        ? 'Nu am găsit microfon sau cameră pe acest dispozitiv.'
                        : 'Nu am putut porni înregistrarea.';
            setError(message);
            setPhase('idle');
        }
    }

    function start() {
        const session = sessionRef.current;
        if (!session) return;

        chunksRef.current = [];
        setElapsed(0);
        setError('');

        session.recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunksRef.current.push(event.data);
        };

        session.recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: session.mimeType });
            setResult({ blob, url: URL.createObjectURL(blob), mimeType: session.mimeType });
            setPhase('review');
        };

        session.recorder.start(1000);

        if (session.backing) {
            session.backing.currentTime = 0;
            session.backing.play().catch(() => { });
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
        if (session.recorder.state !== 'inactive') session.recorder.stop();
    }

    function retry() {
        if (result?.url) URL.revokeObjectURL(result.url);
        setResult(null);
        setElapsed(0);
        setPhase('ready');
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

                        <button type="button" className="btn-primary w-full" onClick={prepare}>
                            Pregătește înregistrarea
                        </button>
                    </>
                )}

                {phase === 'preparing' && (
                    <p className="py-6 text-center text-sm text-slate-400">
                        Se cere accesul la microfon{withVideo ? ' și cameră' : ''}…
                    </p>
                )}

                {(phase === 'ready' || phase === 'recording') && (
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

                            {phase === 'ready' ? (
                                <button type="button" className="btn-primary" onClick={start}>
                                    ● Start înregistrare
                                </button>
                            ) : (
                                <button type="button" className="btn-ghost" onClick={stop}>
                                    ■ Stop
                                </button>
                            )}
                        </div>

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
