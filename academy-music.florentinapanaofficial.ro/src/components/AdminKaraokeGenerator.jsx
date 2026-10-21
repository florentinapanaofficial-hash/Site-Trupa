import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, WandSparkles } from 'lucide-react';
import Modal from './ui/Modal';
import { BUCKET_KARAOKE, BUCKET_MEDIA, SUPABASE_URL, supabase } from '../lib/supabase';
import { isSafeHttpUrl } from '../lib/pieces';

const RESULT_PREFIX = `${BUCKET_KARAOKE}:`;

function getOriginalUrl(piece) {
    if (isSafeHttpUrl(piece.positive_url)) return piece.positive_url.trim();
    if (!piece.audio_pozitiv_path) return '';
    const objectPath = piece.audio_pozitiv_path.split('/').map(encodeURIComponent).join('/');
    return new URL(`/storage/v1/object/authenticated/${BUCKET_MEDIA}/${objectPath}`, SUPABASE_URL).toString();
}

function getResultPath(value) {
    return typeof value === 'string' && value.startsWith(RESULT_PREFIX)
        ? value.slice(RESULT_PREFIX.length)
        : '';
}

export default function AdminKaraokeGenerator({ piece, onAssigned }) {
    const [open, setOpen] = useState(false);
    const [job, setJob] = useState(null);
    const [signedUrl, setSignedUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const originalUrl = useMemo(() => getOriginalUrl(piece), [piece.audio_pozitiv_path, piece.positive_url]);
    const resultPath = getResultPath(job?.result_url);
    const active = job?.status === 'pending' || job?.status === 'processing';

    useEffect(() => {
        if (!open) return undefined;
        let mounted = true;
        const channel = supabase
            .channel(`audio-processing-${piece.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'audio_processing_queue',
                filter: `song_id=eq.${piece.id}`,
            }, ({ new: next }) => {
                if (!mounted || !next?.id) return;
                setJob((current) => !current || !current.created_at || Date.parse(next.created_at) >= Date.parse(current.created_at) ? next : current);
                setError('');
            })
            .subscribe((status) => {
                if (mounted && ['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
                    setError('Conexiunea Realtime a căzut. Reînchide și redeschide fereastra pentru a reîncerca.');
                }
            });

        async function loadLatest() {
            const { data, error: queryError } = await supabase
                .from('audio_processing_queue')
                .select('*')
                .eq('song_id', piece.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (!mounted) return;
            if (queryError) {
                setError(`Starea procesării nu a putut fi încărcată: ${queryError.message}`);
                return;
            }
            if (data) setJob((current) => !current || Date.parse(data.created_at) >= Date.parse(current.created_at) ? data : current);
        }

        void loadLatest();
        return () => {
            mounted = false;
            void supabase.removeChannel(channel);
        };
    }, [open, piece.id]);

    useEffect(() => {
        let mounted = true;
        setSignedUrl('');
        if (!resultPath) return () => { mounted = false; };
        supabase.storage.from(BUCKET_KARAOKE).createSignedUrl(resultPath, 600)
            .then(({ data, error: signError }) => {
                if (!mounted) return;
                if (signError || !data?.signedUrl) {
                    setError(`Fișierul rezultat nu poate fi redat: ${signError?.message || 'URL semnat indisponibil.'}`);
                    return;
                }
                setSignedUrl(data.signedUrl);
            }).catch((signError) => {
                if (mounted) setError(`Fișierul rezultat nu poate fi redat: ${signError.message}`);
            });
        return () => { mounted = false; };
    }, [resultPath]);

    async function enqueue() {
        if (!originalUrl || busy || active) return;
        setBusy(true);
        setError('');
        setInfo('');
        try {
            const { data, error: insertError } = await supabase
                .from('audio_processing_queue')
                .insert({ song_id: piece.id, original_url: originalUrl, status: 'pending' })
                .select('*')
                .single();
            if (insertError || !data) throw new Error(insertError?.message || 'Jobul nu a putut fi creat.');
            setJob(data);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Jobul nu a putut fi creat.');
        } finally {
            setBusy(false);
        }
    }

    async function assignResult() {
        if (!resultPath || busy) return;
        setBusy(true);
        setError('');
        setInfo('');
        try {
            const { data, error: updateError } = await supabase
                .from('pieces')
                .update({ audio_negativ_path: `${BUCKET_KARAOKE}:${resultPath}`, negative_url: null })
                .eq('id', piece.id)
                .select('id')
                .single();
            if (updateError || !data) throw new Error(updateError?.message || 'Negativul nu a putut fi asignat piesei.');
            setInfo('Negativul a fost asignat piesei. Îl poți atribui elevilor din gestionarea repertoriului.');
            await onAssigned?.();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Negativul nu a putut fi asignat piesei.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <button type="button" className="btn-ghost inline-flex items-center gap-2 whitespace-nowrap text-xs" onClick={() => { setOpen(true); setError(''); setInfo(''); }}>
                <WandSparkles size={15} aria-hidden="true" /> 🎛️ Generează Karaoke (SpectraLayers 12)
            </button>
            <Modal open={open} title={`Generează Karaoke — ${piece.title}`} onClose={() => setOpen(false)}>
                <div className="space-y-4">
                    <p className="text-sm text-slate-300">Sursa folosită este varianta Pozitiv (cu voce). Procesarea rulează pe calculatorul conectat la bridge.</p>
                    {!originalUrl && <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">Adaugă mai întâi fișierul audio cu voce în câmpul Pozitiv al piesei.</p>}
                    {job && <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                        {active && <LoaderCircle size={16} className="animate-spin text-gold-300" aria-hidden="true" />}
                        <span>Stare: <strong>{({ pending: 'în așteptare', processing: 'se procesează', completed: 'finalizat', error: 'eroare' })[job.status] || job.status}</strong></span>
                    </div>}
                    {job?.status === 'error' && <p role="alert" className="text-sm text-red-300">{job.error_message || 'Procesarea a eșuat. Verifică bridge-ul local și încearcă din nou.'}</p>}
                    {signedUrl && <div className="space-y-3 rounded-xl border border-white/10 p-3">
                        <p className="text-sm font-semibold text-white">Negativul generat</p>
                        <audio className="w-full" controls preload="none" src={signedUrl}>Browserul nu poate reda acest fișier audio.</audio>
                        <button type="button" className="btn-gold w-full" disabled={busy || piece.audio_negativ_path === job.result_url} onClick={() => void assignResult()}>
                            {piece.audio_negativ_path === job.result_url ? 'Deja asignat piesei' : 'Asignează ca negativ pentru această piesă'}
                        </button>
                    </div>}
                    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
                    {info && <p role="status" className="text-sm text-emerald-300">{info}</p>}
                    <div className="flex flex-wrap justify-end gap-2">
                        {(!job || ['completed', 'error'].includes(job.status)) && <button type="button" className="btn-gold" disabled={!originalUrl || busy} onClick={() => void enqueue()}>
                            {busy ? 'Se trimite…' : '🎛️ Generează Karaoke (SpectraLayers 12)'}
                        </button>}
                    </div>
                </div>
            </Modal>
        </>
    );
}
