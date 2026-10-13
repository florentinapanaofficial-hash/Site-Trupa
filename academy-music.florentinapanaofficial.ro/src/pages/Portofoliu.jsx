import { useEffect, useState } from 'react';
import { supabase, BUCKET_PORTFOLIO } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { detectMediaType, safeFileName, uploadFile } from '../lib/media';
import { logEvent } from '../lib/activity';
import SecureMediaView from '../components/SecureMediaView';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

const MAX_SIZE = {
    video: 200 * 1024 * 1024,
    audio: 50 * 1024 * 1024,
    image: 10 * 1024 * 1024,
};

const STATUS_STYLE = {
    trimis: 'bg-sky-500/15 text-sky-300',
    vazut: 'bg-gold-500/15 text-gold-400',
    notat: 'bg-emerald-500/15 text-emerald-300',
};

const STATUS_LABEL = { trimis: 'Trimis', vazut: 'Văzut de profesor', notat: 'Notat' };

export default function Portofoliu() {
    const { profile } = useAuth();
    const [submissions, setSubmissions] = useState(null);
    const [pieces, setPieces] = useState([]);
    const [form, setForm] = useState({ title: '', pieceId: '', note: '', file: null });
    const [state, setState] = useState({ busy: false, error: '', info: '', progress: 0 });

    async function loadSubmissions() {
        const { data } = await supabase
            .from('submissions')
            .select('*, pieces(title)')
            .eq('student_id', profile.id)
            .order('created_at', { ascending: false });
        setSubmissions(data || []);
    }

    useEffect(() => {
        if (!profile?.id) return;
        loadSubmissions();
        supabase
            .from('pieces')
            .select('id, title, discipline')
            .order('title')
            .then(({ data }) => setPieces(data || []));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.id]);

    async function handleSubmit(event) {
        event.preventDefault();
        const file = form.file;

        if (!file) {
            setState({ busy: false, error: 'Alege un fișier video sau foto.', info: '', progress: 0 });
            return;
        }

        const mediaType = detectMediaType(file);
        if (!mediaType) {
            setState({
                busy: false,
                error: 'Sunt acceptate doar fișiere video, audio sau imagine.',
                info: '',
                progress: 0,
            });
            return;
        }

        if (file.size > MAX_SIZE[mediaType]) {
            setState({
                busy: false,
                error: `Fișierul depășește limita de ${Math.round(MAX_SIZE[mediaType] / 1024 / 1024)} MB.`,
                info: '',
                progress: 0,
            });
            return;
        }

        setState({ busy: true, error: '', info: '', progress: 0 });

        try {
            // Prefixul cu `user.id` este impus și de politica RLS de pe storage.
            const path = `${profile.id}/${Date.now()}-${safeFileName(file.name)}`;
            await uploadFile(BUCKET_PORTFOLIO, path, file);

            const { error } = await supabase.from('submissions').insert({
                student_id: profile.id,
                piece_id: form.pieceId || null,
                title: form.title.trim() || file.name,
                student_note: form.note.trim() || null,
                media_path: path,
                media_type: mediaType,
            });
            if (error) throw error;

            logEvent(profile.id, 'submission_upload', '/portofoliu', { media_type: mediaType });
            setForm({ title: '', pieceId: '', note: '', file: null });
            event.target.reset();
            setState({ busy: false, error: '', info: 'Tema a fost trimisă profesorului.', progress: 100 });
            loadSubmissions();
        } catch (err) {
            setState({
                busy: false,
                error: err?.message || 'Încărcarea a eșuat. Încearcă din nou.',
                info: '',
                progress: 0,
            });
        }
    }

    return (
        <div className="space-y-6">
            <header className="card">
                <span className="text-3xl" aria-hidden="true">
                    📁
                </span>
                <h1 className="mt-2 font-display text-3xl text-white">Portofoliul meu</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                    Înregistrează-te cântând și încarcă tema aici. Doamna profesoară o vede în panoul ei și îți
                    lasă observații și notă.
                </p>
            </header>

            <form onSubmit={handleSubmit} className="card space-y-4">
                <h2 className="text-lg font-semibold text-white">Încarcă o temă nouă</h2>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label className="label" htmlFor="title">
                            Titlu
                        </label>
                        <input
                            id="title"
                            className="input"
                            value={form.title}
                            maxLength={120}
                            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                            placeholder="Ex: Exercițiu respirație — săptămâna 3"
                        />
                    </div>

                    <div>
                        <label className="label" htmlFor="piece">
                            Piesă (opțional)
                        </label>
                        <select
                            id="piece"
                            className="input"
                            value={form.pieceId}
                            onChange={(event) => setForm((prev) => ({ ...prev, pieceId: event.target.value }))}
                        >
                            <option value="">— fără piesă anume —</option>
                            {pieces.map((piece) => (
                                <option key={piece.id} value={piece.id}>
                                    {piece.title}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="label" htmlFor="note">
                        Mesaj pentru profesor (opțional)
                    </label>
                    <textarea
                        id="note"
                        className="input min-h-[80px]"
                        maxLength={500}
                        value={form.note}
                        onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                    />
                </div>

                <div>
                    <label className="label" htmlFor="file">
                        Fișier video, audio sau foto
                    </label>
                    <input
                        id="file"
                        type="file"
                        accept="video/*,audio/*,image/*"
                        className="input file:mr-3 file:rounded-lg file:border-0 file:bg-brand-500 file:px-3 file:py-1.5 file:text-white"
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))
                        }
                        required
                    />
                    <p className="mt-1 text-xs text-slate-500">
                        Maxim 200 MB video, 50 MB audio, 10 MB imagine.
                    </p>
                </div>

                {state.error && (
                    <p className="rounded-lg bg-brand-500/15 px-3 py-2 text-sm text-brand-200">{state.error}</p>
                )}
                {state.info && (
                    <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{state.info}</p>
                )}

                <button type="submit" className="btn-primary" disabled={state.busy}>
                    {state.busy ? 'Se încarcă…' : 'Trimite tema'}
                </button>
            </form>

            <section className="space-y-4">
                <h2 className="font-display text-2xl text-white">Temele mele</h2>

                {submissions === null ? (
                    <Spinner />
                ) : submissions.length === 0 ? (
                    <EmptyState
                        icon="📹"
                        title="Încă nu ai încărcat nimic"
                        description="Prima ta temă poate fi chiar exercițiul de azi."
                    />
                ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                        {submissions.map((item) => (
                            <article key={item.id} className="card space-y-3">
                                <header className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="truncate font-semibold text-white">{item.title}</h3>
                                        <p className="text-xs text-slate-500">
                                            {new Date(item.created_at).toLocaleString('ro-RO')}
                                            {item.pieces?.title ? ` · ${item.pieces.title}` : ''}
                                        </p>
                                    </div>
                                    <span className={`badge shrink-0 ${STATUS_STYLE[item.status]}`}>
                                        {STATUS_LABEL[item.status]}
                                    </span>
                                </header>

                                <SecureMediaView path={item.media_path} type={item.media_type} />

                                {item.student_note && <p className="text-sm text-slate-400">{item.student_note}</p>}

                                {(item.grade != null || item.feedback) && (
                                    <div className="rounded-xl border border-gold-500/25 bg-gold-500/5 p-3">
                                        {item.grade != null && (
                                            <p className="text-sm font-semibold text-gold-400">Nota: {item.grade}</p>
                                        )}
                                        {item.feedback && <p className="mt-1 text-sm text-slate-300">{item.feedback}</p>}
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
