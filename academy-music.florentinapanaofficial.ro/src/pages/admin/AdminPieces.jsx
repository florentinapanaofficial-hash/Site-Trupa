import GenerateLyricsButton from '../../components/GenerateLyricsButton';
import AdminKaraokeGenerator from '../../components/AdminKaraokeGenerator';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, BUCKET_MEDIA } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Pencil } from 'lucide-react';
import { STUDY_LEVELS, normalizeStudyLevel, studyLevelLabel } from '../../lib/studyLevels';
import { saveMusicPiece } from '../../lib/canto';
import { uploadFile } from '../../lib/media';
import { VARIANT_LIST } from '../../lib/pieces';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

const EMPTY_FORM = {
    discipline: 'orga',
    title: '',
    composer: '',
    level: 'modul_1',
    description: '',
    versuri_text: '',
    youtube_id: '',
    tags: '',
    is_published: true,
    positive_url: '',
    negative_url: '',
};

const EMPTY_MODES = { pozitiv: 'online', negativ: 'online' };

export default function AdminPieces() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [pieces, setPieces] = useState(null);
    const [groups, setGroups] = useState([]);
    const [students, setStudents] = useState([]);
    const [form, setForm] = useState(EMPTY_FORM);
    const [modes, setModes] = useState(EMPTY_MODES);
    const [files, setFiles] = useState({ negativ: null, pozitiv: null, score: null });
    const [targetGroups, setTargetGroups] = useState([]);
    const [targetStudents, setTargetStudents] = useState([]);
    const [aiBusy, setAiBusy] = useState(false);
    const [editing, setEditing] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [state, setState] = useState({ busy: false, error: '', info: '' });

    useEffect(() => {
        const requestedDiscipline = searchParams.get('add');
        if (requestedDiscipline === 'canto') {
            navigate('/admin/canto/', { replace: true });
            return;
        }
        if (requestedDiscipline !== 'orga') return;

        openEditor();
        setSearchParams({}, { replace: true });
    }, [searchParams, setSearchParams, navigate]);

    async function load() {
        const { data, error } = await supabase
            .from('pieces')
            .select('*')
            .eq('discipline', 'orga')
            .order('created_at', { ascending: false });
        if (error) { setState((previous) => ({ ...previous, info: '', error: 'Repertoriul nu a putut fi încărcat.' })); return; }
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
            if (groupsResult.error || studentsResult.error) {
                setState((previous) => ({ ...previous, error: 'Destinațiile de alocare nu au putut fi încărcate.' }));
                return;
            }
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

    function openEditor(piece = null) {
        setEditing(piece);
        setForm(piece ? { ...EMPTY_FORM, ...piece,
            level: normalizeStudyLevel(piece.level) || 'modul_1', composer: piece.composer || '', description: piece.description || '',
            youtube_id: piece.youtube_id || '', tags: (piece.tags || []).join(', '),
            positive_url: piece.positive_url || '', negative_url: piece.negative_url || '', versuri_text: piece.versuri_text || '' } : { ...EMPTY_FORM });
        setModes({ pozitiv: piece?.audio_pozitiv_path && !piece.positive_url ? 'local' : 'online', negativ: piece?.audio_negativ_path && !piece.negative_url ? 'local' : 'online' });
        setFiles({ negativ: null, pozitiv: null, score: null });
        setTargetGroups([]); setTargetStudents([]);
        setState({ busy: false, error: '', info: '' });
        setModalOpen(true);
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if ((state.busy || aiBusy)) return;
        setState({ busy: true, error: '', info: '' });
        let saved;
        try {
            for (const variant of VARIANT_LIST) {
                if (modes[variant.key] === 'local' && !files[variant.key] && !editing?.[variant.pathColumn]) {
                    throw new Error('Alege un MP3 pentru ' + variant.label + ' sau revino la URL CDN.');
                }
            }
            saved = await saveMusicPiece({
                client: supabase, form: { ...form, positive_url: modes.pozitiv === 'online' ? form.positive_url : '', negative_url: modes.negativ === 'online' ? form.negative_url : '' },
                files: { score: files.score, pozitiv: modes.pozitiv === 'local' ? files.pozitiv : null, negativ: modes.negativ === 'local' ? files.negativ : null },
                piece: editing, userId: profile.id, discipline: 'orga',
                upload: (path, file) => uploadFile(BUCKET_MEDIA, path, file),
                removeUploaded: (paths) => supabase.storage.from(BUCKET_MEDIA).remove(paths),
            });
            if (!editing && targetGroups.length) {
                const { error } = await supabase.from('group_pieces').insert(targetGroups.map((group_id) => ({ group_id, piece_id: saved.id, added_by: profile.id })));
                if (error) throw new Error('Piesa a fost salvată, dar alocarea la grupe a eșuat. Folosește panoul de alocări; nu recrea piesa.');
            }
            if (!editing && targetStudents.length) {
                const { error } = await supabase.from('student_pieces').insert(targetStudents.map((student_id) => ({ student_id, piece_id: saved.id, assigned_by: profile.id })));
                if (error) throw new Error('Piesa a fost salvată, dar alocarea la elevi a eșuat. Folosește panoul de alocări; nu recrea piesa.');
            }
            setModalOpen(false);
            setState({ busy: false, error: '', info: editing ? 'Modificările au fost salvate.' : 'Piesa a fost adăugată.' });
            await load();
        } catch (error) {
            if (saved) { setEditing(saved); await load(); }
            setState({ busy: false, error: error.message || 'Salvarea a eșuat.', info: '' });
        }
    }

    async function togglePublished(piece) {
        try {
            const { data, error } = await supabase.from('pieces').update({ is_published: !piece.is_published }).eq('id', piece.id).select('id').single();
            if (error || !data) throw new Error('Starea piesei nu a putut fi actualizată.');
            await load();
        } catch (error) { setState({ busy: false, error: error.message, info: '' }); }
    }

    async function remove(piece) {
        if (!window.confirm('Ștergi definitiv piesa „' + piece.title + '”?')) return;
        try {
            const { data, error } = await supabase.from('pieces').delete().eq('id', piece.id).select('id').single();
            if (error || !data) throw new Error('Piesa nu a putut fi ștearsă.');
            setState({ busy: false, error: '', info: 'Piesa a fost ștearsă. Fișierele istorice rămân pentru curățare administrativă.' });
            await load();
        } catch (error) { setState({ busy: false, error: error.message, info: '' }); }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="font-display text-2xl text-white">Repertoriu Orgă</h2>
                    <p className="text-sm text-slate-500">
                        Fiecare piesă poate avea varianta pozitivă și negativă, din fișier local sau link.
                    </p>
                </div>
                <button type="button" className="btn-gold" onClick={() => openEditor()}>
                    ＋ Adaugă piesă
                </button>
            </div>

            {state.error && !modalOpen && <p role="alert" className="text-sm text-brand-200">{state.error}</p>}
            {state.info && !modalOpen && (
                <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{state.info}</p>
            )}

            <Modal open={modalOpen} title={editing ? `Editează: ${editing.title}` : "Adaugă o piesă nouă"} onClose={() => { if (!(state.busy || aiBusy)) setModalOpen(false); }} wide>
                <form onSubmit={handleSubmit} className="space-y-4"><fieldset disabled={(state.busy || aiBusy)} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="label" htmlFor="discipline">
                                Disciplină
                            </label>
                            <select id="discipline" className="input" value={form.discipline} onChange={update('discipline')}>
                                <option value="orga">Orgă</option>
                            </select>
                        </div>

                        <div>
                            <label className="label" htmlFor="level">
                                Nivel
                            </label>
                            <select id="level" className="input" value={form.level} onChange={update('level')}>
                                {STUDY_LEVELS.map((module) => <option key={module.value} value={module.value}>{module.label}</option>)}
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

                    {editing && <p className="text-sm text-slate-300">Fișierele existente sunt păstrate dacă nu alegi înlocuitori. Alocările nu se modifică la editare.</p>}
                    <div><label className="label" htmlFor="piece-lyrics">Versuri / text sincronizat (LRC)</label><textarea id="piece-lyrics" className="input min-h-24" maxLength={100000} value={form.versuri_text} onChange={update("versuri_text")} /><GenerateLyricsButton key={editing?.id || 'new'} piece={editing} disabled={(state.busy || aiBusy) || Boolean(files.pozitiv)} onBusyChange={setAiBusy} onGenerated={text => setForm(previous => ({ ...previous, versuri_text: text }))} /></div>
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

                    {!editing && <fieldset className="rounded-xl border border-white/10 bg-ink-800/40 p-3">
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


                    </fieldset>}

                    <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input type="checkbox" checked={form.is_published} onChange={update('is_published')} className="h-4 w-4 accent-gold-500" />
                        Vizibilă imediat pentru elevi
                    </label>

                    {state.error && <p className="rounded-lg bg-brand-500/15 px-3 py-2 text-sm text-brand-200">{state.error}</p>}

                    <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
                        <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
                            Renunță
                        </button>
                        <button type="submit" className="btn-gold" disabled={(state.busy || aiBusy)}>
                            {state.busy ? 'Se încarcă…' : editing ? 'Salvează modificările' : 'Salvează piesa'}
                        </button>
                    </div>
                </fieldset></form>
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
                                        <td className="px-4 py-3 text-slate-400">{studyLevelLabel(piece.level)}</td>
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
                                            <AdminKaraokeGenerator piece={piece} onAssigned={load} />
                                            <button type="button" className="btn-ghost mr-3" onClick={() => openEditor(piece)} aria-label={`Editează ${piece.title}`}><Pencil size={15} aria-hidden="true" />Editează</button>
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
    { value: 'local', label: 'Upload MP3' },
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
                    accept=".mp3,audio/mpeg"
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
