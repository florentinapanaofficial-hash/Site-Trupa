import { useRef, useState, type ChangeEvent } from 'react';
import { Camera, Music2 } from 'lucide-react';
import Avatar from '../Avatar';
import { BUCKET_AVATARS, supabase } from '../../lib/supabase';
import { invalidateSignedUrl, uploadFile } from '../../lib/media';

type StudentProfileProps = {
    id: string;
    full_name: string | null;
    avatar_path: string | null;
    onAvatarUpdated?: (avatarPath: string) => void;
};

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

export default function StudentProfile({ id, full_name, avatar_path, onAvatarUpdated }: StudentProfileProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [avatarPath, setAvatarPath] = useState(avatar_path);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
        const file = event.currentTarget.files?.[0];
        if (!file) return;
        event.currentTarget.value = '';

        const extension = IMAGE_EXTENSIONS[file.type];
        if (!extension) {
            setMessage({ type: 'error', text: 'Alege o imagine JPEG, PNG sau WebP.' });
            return;
        }
        if (file.size > MAX_AVATAR_BYTES) {
            setMessage({ type: 'error', text: 'Imaginea trebuie să aibă cel mult 2 MB.' });
            return;
        }

        setLoading(true);
        setMessage(null);
        let uploadedPath: string | null = null;
        try {
            const path = `${id}/${id}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
            await uploadFile(BUCKET_AVATARS, path, file);
            uploadedPath = path;

            const { data, error } = await supabase
                .from('profiles')
                .update({ avatar_path: path })
                .eq('id', id)
                .select('id, avatar_path')
                .maybeSingle();
            if (error) throw error;
            if (!data) throw new Error('Profilul nu a putut fi actualizat. Reîncarcă pagina și încearcă din nou.');

            setAvatarPath(path);
            onAvatarUpdated?.(path);
            if (avatar_path) invalidateSignedUrl(BUCKET_AVATARS, avatar_path);

            if (avatar_path && avatar_path !== path) {
                const { error: removeError } = await supabase.storage.from(BUCKET_AVATARS).remove([avatar_path]);
                if (removeError) {
                    console.error('[Academy] Fotografia veche nu a putut fi ștearsă:', removeError.message);
                    setMessage({ type: 'success', text: 'Poza de profil a fost schimbată. Fotografia veche nu a putut fi ștearsă.' });
                    return;
                }
            }
            setMessage({ type: 'success', text: 'Poza de profil a fost actualizată cu succes!' });
        } catch (error) {
            if (uploadedPath) {
                try {
                    const { error: cleanupError } = await supabase.storage.from(BUCKET_AVATARS).remove([uploadedPath]);
                    if (cleanupError) console.error('[Academy] Fișierul avatar încărcat nu a putut fi curățat:', cleanupError.message);
                } catch (cleanupError) {
                    console.error('[Academy] Curățarea fișierului avatar încărcat a eșuat:', cleanupError instanceof Error ? cleanupError.message : cleanupError);
                }
            }
            const detail = error instanceof Error ? error.message : 'Încearcă din nou.';
            setMessage({ type: 'error', text: `Nu am putut actualiza poza de profil. ${detail}` });
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="mx-auto w-full max-w-3xl">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-900/80 via-ink-900 to-ink-900 shadow-2xl shadow-black/20">
                <div className="h-2 bg-gradient-to-r from-brand-400 via-gold-300 to-brand-400" />
                <div className="p-6 sm:p-10">
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-gold-300">Contul meu</p>
                    <h1 className="mt-2 font-display text-3xl text-white sm:text-4xl">Profilul meu</h1>
                    <p className="mt-2 text-slate-300">Alege o fotografie care să te reprezinte în spațiul de studiu.</p>

                    <div className="mt-8 flex flex-col items-center gap-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:flex-row sm:p-8">
                        <div className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full bg-brand-500/15 ring-4 ring-white/10">
                            {avatarPath
                                ? <Avatar path={avatarPath} name={full_name || 'elev'} size="lg" className="!h-32 !w-32 text-3xl" />
                                : <Music2 size={48} className="text-brand-200" aria-hidden="true" />}
                            <span className="absolute bottom-0 right-0 grid h-10 w-10 place-items-center rounded-full border-4 border-ink-900 bg-gold-300 text-ink-950">
                                <Camera size={18} aria-hidden="true" />
                            </span>
                        </div>
                        <div className="min-w-0 flex-1 text-center sm:text-left">
                            <h2 className="font-display text-2xl text-white">{full_name || 'Profil de elev'}</h2>
                            <p className="mt-1 text-sm text-slate-400">Imagine JPEG, PNG sau WebP · maximum 2 MB</p>
                            <input
                                ref={inputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                onChange={handleAvatarChange}
                                disabled={loading}
                                aria-label="Alege fotografia de profil"
                            />
                            <button
                                type="button"
                                className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gold-300 px-5 py-3 font-bold text-ink-950 shadow-lg shadow-gold-950/20 transition hover:bg-gold-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-200 disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={() => inputRef.current?.click()}
                                disabled={loading}
                            >
                                <Camera size={18} aria-hidden="true" />
                                {loading ? 'Se încarcă...' : 'Schimbă Avatarul'}
                            </button>
                        </div>
                    </div>

                    {message && <p role={message.type === 'error' ? 'alert' : 'status'} aria-live={message.type === 'error' ? 'assertive' : 'polite'} className={`mt-5 rounded-xl border px-4 py-3 text-sm font-medium ${message.type === 'success' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/30 bg-rose-400/10 text-rose-200'}`}>
                        {message.text}
                    </p>}
                </div>
            </div>
        </section>
    );
}
