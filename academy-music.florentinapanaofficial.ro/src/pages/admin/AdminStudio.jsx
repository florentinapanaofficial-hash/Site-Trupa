import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, Upload } from 'lucide-react';
import { supabase, BUCKET_STUDENT_RECORDS } from '../../lib/supabase';
import { safeFileName } from '../../lib/media';

const MAX_MASTER_SIZE = 200 * 1024 * 1024;
const EXTENSION_BY_TYPE = {
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/flac': 'flac',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
};
const ALLOWED_EXTENSIONS = new Set(Object.values(EXTENSION_BY_TYPE));

export default function AdminStudio() {
    const [requests, setRequests] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [actionError, setActionError] = useState('');
    const [busyId, setBusyId] = useState(null);
    const [success, setSuccess] = useState('');

    const loadRequests = useCallback(async () => {
        setLoadError('');
        const { data, error } = await supabase
            .from('studio_requests')
            .select('id, student_id, song_id, raw_audio_url, status, created_at, profiles!studio_requests_student_id_fkey(full_name), pieces!studio_requests_song_id_fkey(title)')
            .in('status', ['pending', 'processing'])
            .order('created_at', { ascending: true });
        if (error) {
            console.error('[Academy] Nu s-au putut încărca tichetele Studio:', error.message);
            setLoadError('Tichetele Studio nu s-au putut încărca. Verifică dacă migrarea SQL a fost aplicată și reîncearcă.');
            setRequests([]);
            return;
        }
        setRequests(data || []);
    }, []);

    useEffect(() => { void loadRequests(); }, [loadRequests]);

    async function downloadRaw(request) {
        setBusyId(request.id);
        setActionError('');
        setSuccess('');
        try {
            const rawExtension = request.raw_audio_url.split('.').pop()?.toLowerCase() || 'webm';
            const filename = `${safeFileName(request.pieces?.title || 'piesa')}-brut.${['webm', 'mp4'].includes(rawExtension) ? rawExtension : 'webm'}`;
            const { data: signed, error: signError } = await supabase.storage
                .from(BUCKET_STUDENT_RECORDS)
                .createSignedUrl(request.raw_audio_url, 300, { download: filename });
            if (signError) throw signError;

            const { data: updated, error: updateError } = await supabase
                .from('studio_requests')
                .update({ status: 'processing' })
                .eq('id', request.id)
                .in('status', ['pending', 'processing'])
                .select('id')
                .maybeSingle();
            if (updateError) throw updateError;
            if (!updated) throw new Error('Tichetul nu mai este disponibil pentru procesare.');

            setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status: 'processing' } : item));
            const link = document.createElement('a');
            link.href = signed.signedUrl;
            link.download = filename;
            link.rel = 'noopener';
            document.body.append(link);
            link.click();
            link.remove();
            setSuccess(`Brutul pentru „${request.pieces?.title || 'piesă'}” a fost pregătit pentru descărcare.`);
        } catch (error) {
            console.error('[Academy] Descărcarea brutului a eșuat:', error.message);
            setActionError(error.message || 'Nu am putut descărca brutul. Reîncearcă.');
        } finally {
            setBusyId(null);
        }
    }

    async function uploadMaster(request, file) {
        if (!file) return;
        setActionError('');
        setSuccess('');
        if (!file.type.startsWith('audio/')) {
            setActionError('Alege un fișier audio pentru masterul final.');
            return;
        }
        if (file.size > MAX_MASTER_SIZE) {
            setActionError('Fișierul depășește limita de 200 MB.');
            return;
        }
        const suppliedExtension = file.name.split('.').pop()?.toLowerCase() || '';
        const extension = ALLOWED_EXTENSIONS.has(suppliedExtension) ? suppliedExtension : EXTENSION_BY_TYPE[file.type];
        if (!extension) {
            setActionError('Format neacceptat. Folosește MP3, WAV, FLAC, M4A, AAC, OGG sau WebM.');
            return;
        }

        setBusyId(request.id);
        const path = `mastered/${request.student_id}/${request.id}/master.${extension}`;
        let uploaded = false;
        try {
            const { error: uploadError } = await supabase.storage
                .from(BUCKET_STUDENT_RECORDS)
                .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
            if (uploadError) throw uploadError;
            uploaded = true;

            const { data: updated, error: updateError } = await supabase
                .from('studio_requests')
                .update({ final_audio_url: path, status: 'completed' })
                .eq('id', request.id)
                .in('status', ['pending', 'processing'])
                .select('id')
                .maybeSingle();
            if (updateError) throw updateError;
            if (!updated) throw new Error('Tichetul nu mai este disponibil pentru finalizare.');

            setSuccess(`Masterul pentru „${request.pieces?.title || 'piesă'}” a fost publicat în portofoliul elevului.`);
            await loadRequests();
        } catch (error) {
            console.error('[Academy] Încărcarea masterului a eșuat:', error.message);
            if (uploaded) {
                const { error: cleanupError } = await supabase.storage.from(BUCKET_STUDENT_RECORDS).remove([path]);
                if (cleanupError) console.error('[Academy] Fișierul master temporar nu a putut fi eliminat:', cleanupError.message);
            }
            setActionError(error.message || 'Masterul nu a putut fi încărcat. Reîncearcă.');
        } finally {
            setBusyId(null);
        }
    }

    return (
        <section className="space-y-5">
            <header className="card flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-gold-400">Casa de Discuri Virtuală</p>
                    <h2 className="mt-1 font-display text-2xl text-white">Tichete Studio (Mixaj)</h2>
                    <p className="mt-1 text-sm text-slate-400">Descarcă înregistrările brute, procesează-le offline și publică masterul final.</p>
                </div>
                <button type="button" className="btn-ghost inline-flex items-center gap-2" onClick={() => void loadRequests()}>
                    <RefreshCw size={16} aria-hidden="true" /> Reîncarcă
                </button>
            </header>

            {loadError && <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">{loadError}</p>}
            {actionError && <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">{actionError}</p>}
            {success && <p role="status" className="rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-100">{success}</p>}

            {requests === null ? <div className="card text-sm text-slate-400">Se încarcă tichetele…</div>
                : requests.length === 0 ? <div className="card text-sm text-slate-400">Nu există tichete Studio în așteptare.</div>
                    : <div className="grid gap-4 xl:grid-cols-2">
                        {requests.map((request) => <article key={request.id} className="card space-y-4">
                            <header className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h3 className="break-words font-semibold text-white">{request.pieces?.title || 'Piesă fără titlu'}</h3>
                                    <p className="mt-1 text-sm text-slate-300">{request.profiles?.full_name || 'Elev'}</p>
                                    <p className="text-xs text-slate-500">{new Date(request.created_at).toLocaleString('ro-RO')}</p>
                                </div>
                                <span className={`badge ${request.status === 'pending' ? 'bg-gold-500/15 text-gold-300' : 'bg-sky-500/15 text-sky-300'}`}>
                                    {request.status === 'pending' ? 'În așteptare' : 'În procesare'}
                                </span>
                            </header>
                            <button type="button" className="btn-ghost inline-flex items-center gap-2" disabled={busyId === request.id} onClick={() => void downloadRaw(request)}>
                                <Download size={17} aria-hidden="true" /> {busyId === request.id ? 'Se pregătește…' : 'Descarcă Brutul'}
                            </button>
                            <form className="space-y-3 border-t border-white/10 pt-4" onSubmit={(event) => { event.preventDefault(); const file = event.currentTarget.elements.master.files?.[0]; void uploadMaster(request, file); }}>
                                <label className="label" htmlFor={`studio-master-${request.id}`}>Încarcă Masterul Final</label>
                                <div className="flex flex-wrap items-center gap-3">
                                    <input id={`studio-master-${request.id}`} name="master" className="input min-w-0 flex-1" type="file" accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.webm" required disabled={busyId === request.id} />
                                    <button type="submit" className="btn-gold inline-flex items-center gap-2" disabled={busyId === request.id}>
                                        <Upload size={17} aria-hidden="true" /> {busyId === request.id ? 'Se încarcă…' : 'Publică masterul'}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500">Audio până la 200 MB. La publicare, piesa devine disponibilă în portofoliul elevului.</p>
                            </form>
                        </article>)}
                    </div>}
        </section>
    );
}
