import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, BUCKET_MEDIA } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { safeFileName, uploadFile } from '../../lib/media';
import { VARIANT_LIST, isSafeHttpUrl } from '../../lib/pieces';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

const EMPTY_FORM = {
    discipline: 'orga',
    title: '',
    composer: '',
    level: 'incepator',
    description: '',
    youtube_id: '',
    tags: '',
    is_published: true,
    positive_url: '',
    negative_url: '',
};

const EMPTY_MODES = { pozitiv: 'online', negativ: 'online' };

export default function AdminPieces() {
    const { profile } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [pieces, setPieces] = useState(null);
    const [groups, setGroups] = useState([]);
    const [students, setStudents] = useState([]);
    const [form, setForm] = useState(EMPTY_FORM);
    const [modes, setModes] = useState(EMPTY_MODES);
    const [files, setFiles] = useState({ negativ: null, pozitiv: null, score: null });
    const [targetGroups, setTargetGroups] = useState([]);
    const [targetStudents, setTargetStudents] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [state, setState] = useState({ busy: false, error: '', info: '' });

    useEffect(() => {
        const requestedDiscipline = searchParams.get('add');
        if (!['orga', 'canto'].includes(requestedDiscipline)) return;

        setForm({ ...EMPTY_FORM, discipline: requestedDiscipline });
        setModalOpen(true);
        setSearchParams({}, { replace: true });
    }, [searchParams, setSearchParams]);

    async function load() {
        const { data } = await supabase
            .from('pieces')
            .select('*')
            .order('created_at', { ascending: false });
        setPieces(data || []);
    }

    useEffect(() => {
        load();

        Promise.all([
            supabase.from('study_groups').select('id, name, slug').order('position'),
            supabase
                .from('profiles')
                .select('id, full_name')
                .eq('role', 'student')
                .order('full_name'),
        ]).then(([groupsResult, studentsResult]) => {
            setGroups(groupsResult.data || []);
            setStudents(studentsResult.data || []);
        });
    }, []);

    function update(field) {
        return (event) => {
            const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
            setForm((prev) => ({ ...prev, [field]: value }));
        };
    }

    function toggleIn(list, setList, id) {
        setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
    }

    /** Fișierele unei piese alocate unei grupe stau împreună, sub folderul grupei. */
    function storagePrefix() {
        if (targetGroups.length === 1) {
            const slug = groups.find((group) => group.id === targetGroups[0])?.slug;
            if (slug) return `groups/${slug}`;
        }
        return form.discipline;
    }

    async function uploadIfPresent(file, folder) {
        if (!file) return null;
        const path = `${storagePrefix()}/${folder}/${Date.now()}-${safeFileName(file.name)}`;
        await uploadFile(BUCKET_MEDIA, path, file);
        return path;
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setState({ busy: true, error: '', info: '' });

        try {
            if (files.score && files.score.type !== 'application/pdf') {
                throw new Error('Partitura trebuie să fie un fișier PDF.');
            }

            for (const variant of VARIANT_LIST) {
                const url = form[variant.urlColumn].trim();
                if (modes[variant.key] === 'online' && url && !isSafeHttpUrl(url)) {
                    throw new Error(
                        `Linkul pentru ${variant.label} trebuie să înceapă cu http:// sau https://.`
                    );
                }
            }

            const scorePath = await uploadIfPresent(files.score, 'partituri');

            const { data: created, error } = await supabase
                .from('pieces')
                .insert({
                    discipline: form.discipline,
                    title: form.title.trim(),
                    composer: form.composer.trim() || null,
                    level: form.level,
                    description: form.description.trim() || null,
                    youtube_id: form.youtube_id.trim() || null,
                    tags: form.tags
                        .split(',')
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    is_published: form.is_published,
                    audio_negativ_path: null,
                    audio_pozitiv_path: null,
                    negative_url: modes.negativ === 'online' ? form.negative_url.trim() || null : null,
                    positive_url: modes.pozitiv === 'online' ? form.positive_url.trim() || null : null,
                    score_path: scorePath,
                    created_by: profile.id,
                })
                .select('id')
                .single();
            if (error) throw error;

            if (targetGroups.length) {
                await supabase.from('group_pieces').insert(
                    targetGroups.map((groupId) => ({
                        group_id: groupId,
                        piece_id: created.id,
                        added_by: profile.id,
                    }))
                );
            }

            if (targetStudents.length) {
                await supabase.from('student_pieces').insert(
                    targetStudents.map((studentId) => ({
                        student_id: studentId,
                        piece_id: created.id,
                        assigned_by: profile.id,
                    }))
                );
            }

            const allocated = targetGroups.length + targetStudents.length;

            setForm(EMPTY_FORM);
            setModes(EMPTY_MODES);
            setFiles({ negativ: null, pozitiv: null, score: null });
            setTargetGroups([]);
            setTargetStudents([]);
            event.target.reset();
            setModalOpen(false);
            setState({
                busy: false,
                error: '',
                info: allocated
                    ? `Piesa a fost adăugată și alocată (${allocated} destinații).`
                    : 'Piesa a fost adăugată în catalog.',
            });
            load();
        } catch (err) {
            setState({ busy: false, error: err?.message || 'Salvarea a eșuat.', info: '' });
        }
    }

    async function togglePublished(piece) {
        await supabase.from('pieces').update({ is_published: !piece.is_published }).eq('id', piece.id);
        load();
    }

    async function remove(piece) {
        if (!window.confirm(`Ștergi definitiv piesa „${piece.title}”?`)) return;

        const paths = [piece.audio_negativ_path, piece.audio_pozitiv_path, piece.score_path].filter(
            Boolean
        );
        if (paths.length) await supabase.storage.from(BUCKET_MEDIA).remove(paths);
        await supabase.from('pieces').delete().eq('id', piece.id);
        load();
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="font-display text-2xl text-white">Repertoriu</h2>
                    <p className="text-sm text-slate-500">
                        Fiecare piesă poate avea varianta pozitivă și negativă, din fișier local sau link.
                    </p>
                </div>
                <button type="button" className="btn-gold" onClick={() => setModalOpen(true)}>
                    ＋ Adaugă piesă
                </button>
            </div>

            {state.info && !modalOpen && (
                <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{state.info}</p>
            )}

            <Modal open={modalOpen} title="Adaugă o piesă nouă" onClose={() => setModalOpen(false)} wide>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="label" htmlFor="discipline">
                                Disciplină
                            </label>
                            <select id="discipline" className="input" value={form.discipline} onChange={update('discipline')}>
                                <option value="orga">Orgă</option>
                                <option value="canto">Canto</option>
                            </select>
                        </div>

                        <div>
                            <label className="label" htmlFor="level">
                                Nivel
                            </label>
                            <select id="level" className="input" value={form.level} onChange={update('level')}>
                                <option value="incepator">Începător</option>
                                <option value="mediu">Mediu</option>
                                <option value="avansat">Avansat</option>
                            </select>
                        </div>

                        <div>
                            <label className="label" htmlFor="title">
                                Titlu
                            </label>
                            <input id="title" className="input" value={form.title} onChange={update('title')} required maxLength={120} />
                        </div>

                        <div>
                            <label className="label" htmlFor="composer">
                                Compozitor / interpret
                            </label>
                            <input id="composer" className="input" value={form.composer} onChange={update('composer')} maxLength={120} />
                        </div>
                    </div>

                    <div>
                        <label className="label" htmlFor="description">
                            Descriere / indicații de studiu
                        </label>
                        <textarea
                            id="description"
                            className="input min-h-[80px]"
                            value={form.description}
                            onChange={update('description')}
                            maxLength={600}
                        />
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                        {VARIANT_LIST.map((variant) => (
                            <VariantField
                                key={variant.key}
                                variant={variant}
                                mode={modes[variant.key]}
                                url={form[variant.urlColumn]}
                                onModeChange={(mode) => setModes((prev) => ({ ...prev, [variant.key]: mode }))}
                                onUrlChange={(value) =>
                                    setForm((prev) => ({ ...prev, [variant.urlColumn]: value }))
                                }
                                onFileChange={(file) => setFiles((prev) => ({ ...prev, [variant.key]: file }))}
                            />
                        ))}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <label className="label" htmlFor="youtube">
                                ID videoclip YouTube (opțional)
                            </label>
                            <input id="youtube" className="input" value={form.youtube_id} onChange={update('youtube_id')} maxLength={20} />
                        </div>
                        <div>
                            <label className="label" htmlFor="tags">
                                Etichete (separate prin virgulă)
                            </label>
                            <input id="tags" className="input" value={form.tags} onChange={update('tags')} placeholder="colind, 3/4, legato" />
                        </div>
                        <FileField
                            id="score"
                            label="Partitură (PDF)"
                            accept="application/pdf"
                            onChange={(file) => setFiles((prev) => ({ ...prev, score: file }))}
                        />
                    </div>

                    <fieldset className="rounded-xl border border-white/10 bg-ink-800/40 p-3">
                        <legend className="px-1 text-sm font-semibold text-slate-200">
                            Destinație / alocare directă
                        </legend>

                        <p className="mb-3 text-xs text-slate-500">
                            Opțional. Fără nicio bifă, piesa ajunge doar în catalog și nu o vede niciun elev.
                        </p>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <span className="label">Grupe</span>
                                <div className="flex flex-wrap gap-2">
                                    {groups.map((group) => (
                                        <button
                                            key={group.id}
                                            type="button"
                                            onClick={() => toggleIn(targetGroups, setTargetGroups, group.id)}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${targetGroups.includes(group.id)
                                                ? 'bg-gold-500 text-ink-950'
                                                : 'border border-white/15 text-slate-400 hover:text-slate-100'
                                                }`}
                                        >
                                            {group.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <span className="label">Elevi ({targetStudents.length} selectați)</span>
                                <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2 scrollbar-thin">
                                    {students.length === 0 && (
                                        <p className="text-xs text-slate-600">Niciun elev înregistrat.</p>
                                    )}
                                    {students.map((student) => (
                                        <label
                                            key={student.id}
                                            className="flex cursor-pointer items-center gap-2 text-xs text-slate-300"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={targetStudents.includes(student.id)}
                                                onChange={() => toggleIn(targetStudents, setTargetStudents, student.id)}
                                                className="h-3.5 w-3.5 accent-gold-500"
                                            />
                                            {student.full_name || '(fără nume)'}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {targetGroups.length === 1 && (
                            <p className="mt-2 text-xs text-slate-500">
                                Fișierele se vor urca în <code>groups/{groups.find((g) => g.id === targetGroups[0])?.slug}/</code>
                            </p>
                        )}
                    </fieldset>

                    <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input type="checkbox" checked={form.is_published} onChange={update('is_published')} className="h-4 w-4 accent-gold-500" />
                        Vizibilă imediat pentru elevi
                    </label>

                    {state.error && <p className="rounded-lg bg-brand-500/15 px-3 py-2 text-sm text-brand-200">{state.error}</p>}

                    <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
                        <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
                            Renunță
                        </button>
                        <button type="submit" className="btn-gold" disabled={state.busy}>
                            {state.busy ? 'Se încarcă…' : 'Salvează piesa'}
                        </button>
                    </div>
                </form>
            </Modal>

            <section className="space-y-3">
                <h2 className="font-display text-2xl text-white">Repertoriu existent</h2>

                {pieces === null ? (
                    <Spinner />
                ) : pieces.length === 0 ? (
                    <EmptyState title="Niciun material încă" description="Prima piesă adăugată apare aici." />
                ) : (
                    <div className="card overflow-x-auto p-0">
                        <table className="w-full min-w-[640px] text-sm">
                            <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Titlu</th>
                                    <th className="px-4 py-3">Disciplină</th>
                                    <th className="px-4 py-3">Nivel</th>
                                    <th className="px-4 py-3">Fișiere</th>
                                    <th className="px-4 py-3">Stare</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {pieces.map((piece) => (
                                    <tr key={piece.id}>
                                        <td className="px-4 py-3 font-medium text-slate-100">{piece.title}</td>
                                        <td className="px-4 py-3 text-slate-400">{piece.discipline === 'orga' ? 'Orgă' : 'Canto'}</td>
                                        <td className="px-4 py-3 text-slate-400">{piece.level}</td>
                                        <td className="px-4 py-3 text-slate-400">
                                            {[
                                                piece.audio_pozitiv_path && 'pozitiv (local)',
                                                piece.positive_url && 'pozitiv (link)',
                                                piece.audio_negativ_path && 'negativ (local)',
                                                piece.negative_url && 'negativ (link)',
                                                piece.score_path && 'PDF',
                                            ]
                                                .filter(Boolean)
                                                .join(', ') || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => togglePublished(piece)}
                                                className={`badge ${piece.is_published ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-slate-400'}`}
                                            >
                                                {piece.is_published ? 'Publicată' : 'Ascunsă'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button type="button" className="text-xs text-brand-300 hover:text-brand-200" onClick={() => remove(piece)}>
                                                Șterge
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

function FileField({ id, label, accept, onChange }) {
    return (
        <div>
            <label className="label" htmlFor={id}>
                {label}
            </label>
            <input
                id={id}
                type="file"
                accept={accept}
                className="input text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-slate-200"
                onChange={(event) => onChange(event.target.files?.[0] || null)}
            />
        </div>
    );
}

const MODES = [
    { value: 'online', label: 'URL CDN' },
];

function VariantField({ variant, mode, url, onModeChange, onUrlChange, onFileChange }) {
    return (
        <div className="rounded-xl border border-white/10 bg-ink-800/40 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-200">
                    {variant.label}{' '}
                    <span className="text-xs font-normal text-slate-500">({variant.hint})</span>
                </p>

                <div className="flex gap-0.5 rounded-lg border border-white/15 p-0.5">
                    {MODES.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onModeChange(option.value)}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${mode === option.value ? 'bg-gold-500 text-ink-950' : 'text-slate-400 hover:text-slate-100'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {mode === 'local' ? (
                <input
                    type="file"
                    accept="audio/*"
                    aria-label={`Fișier audio ${variant.label}`}
                    className="input text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-slate-200"
                    onChange={(event) => onFileChange(event.target.files?.[0] || null)}
                />
            ) : (
                <input
                    type="url"
                    inputMode="url"
                    placeholder="https://…"
                    aria-label={`Link audio ${variant.label}`}
                    className="input"
                    value={url}
                    onChange={(event) => onUrlChange(event.target.value)}
                />
            )}

            <p className="mt-1.5 text-xs text-slate-500">
                {mode === 'local'
                    ? 'Fișierul se încarcă în bucketul privat și se redă prin link semnat.'
                    : 'Sursele externe nu pot fi protejate de descărcare.'}
            </p>
        </div>
    );
}
