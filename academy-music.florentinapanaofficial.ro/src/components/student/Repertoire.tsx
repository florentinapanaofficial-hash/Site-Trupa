import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, LoaderCircle, Music2, Plus } from 'lucide-react';
import { BUCKET_BACKING_TRACKS, supabase } from '../../lib/supabase';
import { getSignedAudioUrl } from '../../lib/media';

type RepertoireStatus = 'wishlist' | 'in_progress' | 'stage_ready';
type RepertoireRow = {
    id: string;
    student_id: string;
    title: string;
    status: RepertoireStatus;
    audio_path: string | null;
    created_at: string;
};

type RepertoireProps = { studentId: string };

const STAGES: { status: RepertoireStatus; title: string; description: string; color: string }[] = [
    { status: 'wishlist', title: 'Piese de vis', description: 'Piese pe care vrei să le înveți', color: 'border-violet-300/20 bg-violet-300/10' },
    { status: 'in_progress', title: 'În lucru', description: 'Piese la care exersezi', color: 'border-gold-300/20 bg-gold-300/10' },
    { status: 'stage_ready', title: 'Gata de scenă', description: 'Pregătite pentru aplauze!', color: 'border-emerald-300/20 bg-emerald-300/10' },
];

const SELECT_COLUMNS = 'id, student_id, title, status, audio_path, created_at';

export default function Repertoire({ studentId }: RepertoireProps) {
    const [pieces, setPieces] = useState<RepertoireRow[] | null>(null);
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [movingId, setMovingId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
    const [audioErrors, setAudioErrors] = useState<Record<string, string>>({});

    const loadPieces = useCallback(async () => {
        setPieces(null);
        setError('');
        try {
            const { data, error: queryError } = await supabase
                .from('student_repertoire')
                .select(SELECT_COLUMNS)
                .eq('student_id', studentId)
                .order('created_at', { ascending: true });
            if (queryError) throw queryError;
            setPieces((data || []) as RepertoireRow[]);
        } catch (queryError) {
            console.error('[Academy] Portofoliul elevului nu a putut fi încărcat:', queryError instanceof Error ? queryError.message : queryError);
            setError('Portofoliul nu a putut fi încărcat. Verifică dacă migrarea a fost aplicată și încearcă din nou.');
            setPieces([]);
        }
    }, [studentId]);

    useEffect(() => {
        void loadPieces();
    }, [loadPieces]);

    useEffect(() => {
        let active = true;
        const paths = [...new Set((pieces || []).map((piece) => piece.audio_path).filter((path): path is string => Boolean(path)))];
        setAudioUrls({});
        setAudioErrors({});
        if (!paths.length) return () => { active = false; };

        void Promise.all(paths.map(async (path) => {
            try {
                return { path, url: await getSignedAudioUrl(BUCKET_BACKING_TRACKS, path), error: '' };
            } catch (audioError) {
                console.error('[Academy] Negativul nu a putut fi pregătit pentru redare:', audioError instanceof Error ? audioError.message : audioError);
                return { path, url: '', error: 'Negativul nu poate fi redat momentan.' };
            }
        })).then((results) => {
            if (!active) return;
            setAudioUrls(Object.fromEntries(results.filter((result) => result.url).map(({ path, url }) => [path, url])));
            setAudioErrors(Object.fromEntries(results.filter((result) => result.error).map(({ path, error: audioError }) => [path, audioError])));
        });

        return () => { active = false; };
    }, [pieces]);

    async function handleAdd(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const cleanTitle = title.trim();
        if (!cleanTitle || saving) return;
        if (pieces === null) return;
        setSaving(true);
        setError('');
        setNotice('');
        try {
            const { data, error: insertError } = await supabase
                .from('student_repertoire')
                .insert({ student_id: studentId, title: cleanTitle, status: 'wishlist' })
                .select(SELECT_COLUMNS)
                .single();
            if (insertError) throw insertError;
            setPieces((current) => [...(current || []), data as RepertoireRow]);
            setTitle('');
            setNotice('Piesa a fost adăugată la „Piese de vis”.');
        } catch (insertError) {
            console.error('[Academy] Piesa nu a putut fi adăugată în portofoliu:', insertError instanceof Error ? insertError.message : insertError);
            setError('Piesa nu a putut fi adăugată. Încearcă din nou.');
        } finally {
            setSaving(false);
        }
    }

    async function movePiece(piece: RepertoireRow, direction: -1 | 1) {
        if (movingId) return;
        const nextStatus = STAGES[STAGES.findIndex((stage) => stage.status === piece.status) + direction]?.status;
        if (!nextStatus) return;
        setMovingId(piece.id);
        setError('');
        setNotice('');
        try {
            const { data, error: updateError } = await supabase
                .from('student_repertoire')
                .update({ status: nextStatus })
                .eq('id', piece.id)
                .eq('student_id', studentId)
                .select(SELECT_COLUMNS)
                .maybeSingle();
            if (updateError) throw updateError;
            if (!data) throw new Error('Rândul nu mai este disponibil.');
            setPieces((current) => (current || []).map((item) => item.id === piece.id ? data as RepertoireRow : item));
        } catch (updateError) {
            console.error('[Academy] Stadiul piesei nu a putut fi actualizat:', updateError instanceof Error ? updateError.message : updateError);
            setError('Stadiul piesei nu a putut fi schimbat. Încearcă din nou.');
        } finally {
            setMovingId(null);
        }
    }

    return (
        <section aria-labelledby="artist-repertoire-title" className="space-y-5">
            <header className="card border border-gold-300/15 bg-gradient-to-br from-brand-900/60 via-ink-900 to-ink-900">
                <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gold-300/15 text-gold-200">
                        <Music2 size={25} aria-hidden="true" />
                    </span>
                    <div>
                        <h2 id="artist-repertoire-title" className="font-display text-2xl text-white sm:text-3xl">Portofoliul meu de artist</h2>
                        <p className="mt-1 text-sm text-slate-400">Urmărește-ți drumul de la prima idee până la scenă.</p>
                    </div>
                </div>
                <form onSubmit={handleAdd} className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <label htmlFor="repertoire-title" className="sr-only">Titlul piesei</label>
                    <input
                        id="repertoire-title"
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.currentTarget.value)}
                        maxLength={200}
                        required
                        placeholder="Ce piesă ai vrea să înveți?"
                        className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-ink-950/70 px-4 text-white placeholder:text-slate-500 focus:border-gold-300/50 focus:outline-none focus:ring-2 focus:ring-gold-300/20"
                        disabled={saving}
                    />
                    <button type="submit" disabled={saving || pieces === null || !title.trim()} className="btn-gold inline-flex min-h-12 items-center justify-center gap-2 px-5 disabled:cursor-not-allowed disabled:opacity-60">
                        {saving ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
                        {saving ? 'Se adaugă…' : 'Adaugă piesa'}
                    </button>
                </form>
            </header>

            {error && <div role="alert" aria-live="assertive" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm text-rose-200">
                <p>{error}</p>
                <button type="button" onClick={() => void loadPieces()} className="rounded-lg border border-rose-200/20 px-3 py-1.5 font-semibold text-rose-100 transition hover:bg-rose-200/10">Reîncarcă portofoliul</button>
            </div>}
            {notice && <p role="status" aria-live="polite" className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-200">{notice}</p>}

            {pieces === null ? (
                <p role="status" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-slate-300">Se încarcă portofoliul…</p>
            ) : (
                <div className="grid gap-4 lg:grid-cols-3">
                    {STAGES.map((stage, stageIndex) => {
                        const stagePieces = pieces.filter((piece) => piece.status === stage.status);
                        return <section key={stage.status} aria-labelledby={`repertoire-${stage.status}`} className={`min-w-0 rounded-2xl border p-4 ${stage.color}`}>
                            <div className="mb-4 flex items-start justify-between gap-2">
                                <div>
                                    <h3 id={`repertoire-${stage.status}`} className="font-display text-xl text-white">{stage.title}</h3>
                                    <p className="mt-1 text-xs text-slate-400">{stage.description}</p>
                                </div>
                                <span className="rounded-full bg-black/20 px-2.5 py-1 text-xs font-bold text-white" aria-label={`${stagePieces.length} piese`}>{stagePieces.length}</span>
                            </div>
                            <ul className="space-y-3">
                                {stagePieces.map((piece) => <li key={piece.id} className="rounded-xl border border-white/10 bg-ink-950/60 p-3 shadow-lg shadow-black/10">
                                    <p className="break-words font-semibold text-white">{piece.title}</p>
                                    {piece.audio_path && <div className="mt-3">
                                        {audioUrls[piece.audio_path]
                                            ? <audio controls preload="none" src={audioUrls[piece.audio_path]} className="h-8 w-full" aria-label={`Negativ pentru ${piece.title}`} />
                                            : audioErrors[piece.audio_path]
                                                ? <p className="text-xs text-rose-200" role="status">{audioErrors[piece.audio_path]}</p>
                                                : <p className="text-xs text-slate-400">Se pregătește negativul…</p>}
                                    </div>}
                                    <div className="mt-3 flex items-center justify-between gap-2">
                                        <button type="button" onClick={() => void movePiece(piece, -1)} disabled={stageIndex === 0 || movingId !== null} aria-label={`Mută „${piece.title}” la etapa anterioară`} title="Etapa anterioară" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">
                                            <ArrowLeft size={17} aria-hidden="true" />
                                        </button>
                                        <span className="text-center text-[11px] text-slate-400">{movingId === piece.id ? 'Se mută…' : `${stageIndex + 1} din 3`}</span>
                                        <button type="button" onClick={() => void movePiece(piece, 1)} disabled={stageIndex === STAGES.length - 1 || movingId !== null} aria-label={`Mută „${piece.title}” la etapa următoare`} title="Etapa următoare" className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">
                                            <ArrowRight size={17} aria-hidden="true" />
                                        </button>
                                    </div>
                                </li>)}
                            </ul>
                            {stagePieces.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-sm text-slate-500">Piesele tale vor apărea aici.</p>}
                        </section>;
                    })}
                </div>
            )}
        </section>
    );
}
