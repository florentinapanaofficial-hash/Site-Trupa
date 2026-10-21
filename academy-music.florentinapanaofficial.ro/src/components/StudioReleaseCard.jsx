import { useEffect, useState } from 'react';
import { Download, Disc3 } from 'lucide-react';
import { supabase, BUCKET_STUDENT_RECORDS } from '../lib/supabase';
import { getSignedAudioUrl, safeFileName } from '../lib/media';
import SecureAudioPlayer from './SecureAudioPlayer';

const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'wav', 'flac', 'aac', 'ogg', 'webm']);

export default function StudioReleaseCard({ request }) {
    const [urls, setUrls] = useState(null);
    const [error, setError] = useState('');
    const title = request.pieces?.title || 'Piesă masterizată';

    useEffect(() => {
        let active = true;
        async function loadUrls() {
            try {
                const extension = request.final_audio_url.split('.').pop()?.toLowerCase() || '';
                if (!AUDIO_EXTENSIONS.has(extension)) throw new Error('Format audio necunoscut.');
                const playbackUrl = await getSignedAudioUrl(BUCKET_STUDENT_RECORDS, request.final_audio_url);
                const { data, error: signedUrlError } = await supabase.storage
                    .from(BUCKET_STUDENT_RECORDS)
                    .createSignedUrl(request.final_audio_url, 300, { download: `${safeFileName(title)}.${extension}` });
                if (signedUrlError) throw signedUrlError;
                if (active) setUrls({ playbackUrl, downloadUrl: data.signedUrl });
            } catch (loadError) {
                console.error('[Academy] Nu s-au putut pregăti linkurile lansării:', loadError.message);
                if (active) setError('Înregistrarea nu este disponibilă momentan. Reîncearcă mai târziu.');
            }
        }
        void loadUrls();
        return () => { active = false; };
    }, [request.final_audio_url, title]);

    return (
        <article className="card space-y-4 border border-gold-400/25 bg-gradient-to-br from-gold-500/10 via-ink-900 to-ink-950">
            <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gold-400/15 text-gold-300" aria-hidden="true"><Disc3 size={25} /></span>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gold-300">Lansare Studio</p>
                    <h3 className="mt-1 break-words font-display text-xl text-white">{title}</h3>
                    <p className="mt-1 text-xs text-slate-400">Cerere Studio din {new Date(request.created_at).toLocaleDateString('ro-RO')}</p>
                </div>
            </div>
            {urls ? <>
                <SecureAudioPlayer audioUrl={urls.playbackUrl} label={`Piesa ${title}, versiune masterizată`} accent="gold" />
                <a className="btn-ghost inline-flex items-center gap-2" href={urls.downloadUrl}><Download size={17} aria-hidden="true" /> Descarcă piesa</a>
            </> : error ? <p role="alert" className="text-sm text-rose-200">{error}</p> : <p role="status" className="text-sm text-slate-400">Se pregătește playerul…</p>}
        </article>
    );
}
