import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import SecureMediaView from '../../components/SecureMediaView';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

const FILTERS = [
    { value: 'de-notat', label: 'De corectat' },
    { value: 'toate', label: 'Toate' },
    { value: 'notat', label: 'Notate' },
];

export default function AdminSubmissions() {
    const { profile } = useAuth();
    const [submissions, setSubmissions] = useState(null);
    const [filter, setFilter] = useState('de-notat');
    const [drafts, setDrafts] = useState({});
    const [savingId, setSavingId] = useState(null);

    async function load() {
        const { data } = await supabase
            .from('submissions')
            .select('*, profiles!submissions_student_id_fkey(full_name), pieces(title)')
            .order('created_at', { ascending: false });
        setSubmissions(data || []);
    }

    useEffect(() => {
        load();
    }, []);

    const filtered = useMemo(() => {
        if (!submissions) return [];
        if (filter === 'toate') return submissions;
        if (filter === 'notat') return submissions.filter((item) => item.status === 'notat');
        return submissions.filter((item) => item.status !== 'notat');
    }, [submissions, filter]);

    async function markSeen(item) {
        if (item.status !== 'trimis') return;
        await supabase.from('submissions').update({ status: 'vazut' }).eq('id', item.id);
        load();
    }

    async function saveReview(item) {
        const draft = drafts[item.id] || {};
        const grade = draft.grade === '' || draft.grade == null ? null : Number(draft.grade);

        if (grade != null && (Number.isNaN(grade) || grade < 1 || grade > 10)) {
            window.alert('Nota trebuie să fie între 1 și 10.');
            return;
        }

        setSavingId(item.id);
        await supabase
            .from('submissions')
            .update({
                grade,
                feedback: (draft.feedback ?? item.feedback ?? '').trim() || null,
                status: grade != null ? 'notat' : 'vazut',
                reviewed_by: profile.id,
                reviewed_at: new Date().toISOString(),
            })
            .eq('id', item.id);
        setSavingId(null);
        load();
    }

    if (submissions === null) return <Spinner />;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {FILTERS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => setFilter(option.value)}
                        className={`rounded-xl px-3 py-2 text-sm transition ${filter === option.value
                                ? 'bg-gold-500 text-ink-950'
                                : 'border border-white/15 text-slate-400 hover:text-slate-100'
                            }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <EmptyState icon="📭" title="Nicio temă în această categorie" />
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {filtered.map((item) => {
                        const draft = drafts[item.id] || {};
                        return (
                            <article key={item.id} className="card space-y-3">
                                <header>
                                    <h3 className="font-semibold text-white">{item.title}</h3>
                                    <p className="text-xs text-slate-500">
                                        {item.profiles?.full_name || 'Elev'} ·{' '}
                                        {new Date(item.created_at).toLocaleString('ro-RO')}
                                        {item.pieces?.title ? ` · ${item.pieces.title}` : ''}
                                    </p>
                                </header>

                                <div onFocus={() => markSeen(item)}>
                                    <SecureMediaView path={item.media_path} type={item.media_type} />
                                </div>

                                {item.student_note && (
                                    <p className="rounded-lg bg-white/5 p-3 text-sm text-slate-300">{item.student_note}</p>
                                )}

                                <div className="grid gap-3 sm:grid-cols-[90px_1fr]">
                                    <div>
                                        <label className="label" htmlFor={`grade-${item.id}`}>
                                            Nota
                                        </label>
                                        <input
                                            id={`grade-${item.id}`}
                                            type="number"
                                            min={1}
                                            max={10}
                                            className="input"
                                            value={draft.grade ?? item.grade ?? ''}
                                            onChange={(event) =>
                                                setDrafts((prev) => ({
                                                    ...prev,
                                                    [item.id]: { ...prev[item.id], grade: event.target.value },
                                                }))
                                            }
                                        />
                                    </div>

                                    <div>
                                        <label className="label" htmlFor={`feedback-${item.id}`}>
                                            Observații pentru elev
                                        </label>
                                        <textarea
                                            id={`feedback-${item.id}`}
                                            className="input min-h-[60px]"
                                            maxLength={800}
                                            value={draft.feedback ?? item.feedback ?? ''}
                                            onChange={(event) =>
                                                setDrafts((prev) => ({
                                                    ...prev,
                                                    [item.id]: { ...prev[item.id], feedback: event.target.value },
                                                }))
                                            }
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="btn-gold"
                                    onClick={() => saveReview(item)}
                                    disabled={savingId === item.id}
                                >
                                    {savingId === item.id ? 'Se salvează…' : 'Salvează feedbackul'}
                                </button>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
