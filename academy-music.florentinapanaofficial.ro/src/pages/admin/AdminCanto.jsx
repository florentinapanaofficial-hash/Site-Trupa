import { STUDY_LEVELS, normalizeStudyLevel } from '../../lib/studyLevels';
import GenerateLyricsButton from '../../components/GenerateLyricsButton';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Pencil, Save, Trash2, Upload, X } from 'lucide-react';
import { supabase, BUCKET_MEDIA } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { uploadFile } from '../../lib/media';
import { CANTO_VARIANTS, EMPTY_CANTO, saveCantoPiece } from '../../lib/canto';
import PieceAudio from '../../components/PieceAudio';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

export default function AdminCanto() {
    const { profile } = useAuth();
    const [params, setParams] = useSearchParams();
    const editId = params.get('edit');
    const formRef = useRef(null);
    const [pieces, setPieces] = useState(null);
    const [groups, setGroups] = useState([]);
    const [form, setForm] = useState({ ...EMPTY_CANTO });
    const [editing, setEditing] = useState(null);
    const [files, setFiles] = useState({});
    const [fileKey, setFileKey] = useState(0);
    const [lyrics, setLyrics] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [search, setSearch] = useState('');
    const [aiBusy, setAiBusy] = useState(false);
    const [status, setStatus] = useState({ busy: false, error: '', info: '' });
    const [loadError, setLoadError] = useState('');

    async function load() {
        setLoadError('');
        try {
            const rows = [];
            for (let offset = 0; ; offset += 500) {
                const { data, error } = await supabase.from('pieces').select('*').eq('discipline', 'canto')
                    .order('grupa').order('title').order('id').range(offset, offset + 499);
                if (error) throw error;
                rows.push(...data);
                if (data.length < 500) break;
            }
            setPieces(rows);
        } catch {
            setLoadError('Biblioteca Canto nu a putut fi încărcată. Verifică migrarea Canto și accesul la baza de date.');
            setPieces((previous) => previous || []);
        }
    }

    useEffect(() => {
        load();
        supabase.from('study_groups').select('name').order('position').then(({ data }) => setGroups(data || []));
    }, []);

    useEffect(() => {
        if (!editId || pieces === null || loadError) return;
        const piece = pieces.find(item => item.id === editId);
        if (piece) edit(piece);
        else setStatus({ busy: false, error: 'Piesa solicitată nu a fost găsită în biblioteca Canto.', info: '' });
        setParams(previous => { const next = new URLSearchParams(previous); next.delete('edit'); return next; }, { replace: true });
    }, [editId, pieces, loadError, setParams]);

    useEffect(() => {
        if (!editing) return;
        formRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
        formRef.current?.querySelector('input')?.focus({ preventScroll: true });
    }, [editing?.id]);

    function reset() {
        setForm({ ...EMPTY_CANTO });
        setEditing(null);
        setFiles({});
        setFileKey((previous) => previous + 1);
    }

    function edit(piece) {
        setEditing(piece);
        setForm({ ...EMPTY_CANTO, ...piece, level: normalizeStudyLevel(piece.level) || 'modul_1' });
        setFiles({});
        setFileKey((previous) => previous + 1);
        setStatus({ busy: false, error: '', info: '' });
    }

    async function persist(values, selectedFiles, piece) {
        return saveCantoPiece({
            client: supabase, form: values, files: selectedFiles, piece, userId: profile.id,
            upload: (path, file) => uploadFile(BUCKET_MEDIA, path, file, { contentType: file.type || (path.endsWith('.pdf') ? 'application/pdf' : 'audio/mpeg') }),
            removeUploaded: (paths) => supabase.storage.from(BUCKET_MEDIA).remove(paths),
        });
    }

    async function save(event) {
        event.preventDefault();
        if ((status.busy || aiBusy)) return;
        setStatus({ busy: true, error: '', info: '' });
        try {
            await persist(form, files, editing);
            reset();
            await load();
            setStatus({ busy: false, error: '', info: 'Piesa a fost salvată.' });
        } catch (error) {
            setStatus({ busy: false, error: error.message || 'Salvarea a eșuat.', info: '' });
        }
    }

    async function replace(piece, variant, file) {
        if (!file || (status.busy || aiBusy)) return;
        setStatus({ busy: true, error: '', info: '' });
        try {
            const saved = await persist(piece, { [variant.key]: file }, piece);
            if (editing?.id === piece.id) reset();
            await load();
            setStatus({ busy: false, error: '', info: `${variant.label} pentru „${saved.title}” a fost înlocuit.` });
        } catch (error) {
            setStatus({ busy: false, error: error.message || 'Înlocuirea a eșuat.', info: '' });
        }
    }

    async function saveLyrics() {
        if ((status.busy || aiBusy)) return;
        if (!lyrics.piece) {
            setForm((previous) => ({ ...previous, versuri_text: lyrics.text }));
            setLyrics(null);
            return;
        }
        setStatus({ busy: true, error: '', info: '' });
        try {
            await persist({ ...lyrics.piece, versuri_text: lyrics.text }, {}, lyrics.piece);
            if (editing?.id === lyrics.piece.id) reset();
            setLyrics(null);
            await load();
            setStatus({ busy: false, error: '', info: 'Versurile au fost salvate.' });
        } catch (error) {
            setStatus({ busy: false, error: error.message || 'Versurile nu au fost salvate.', info: '' });
        }
    }

    async function remove() {
        if (!deleting || (status.busy || aiBusy)) return;
        setStatus({ busy: true, error: '', info: '' });
        try {
            const { data, error } = await supabase.from('pieces').delete().eq('id', deleting.id)
                .eq('discipline', 'canto').select('id').single();
            if (error || !data) throw new Error('Piesa nu a putut fi ștearsă.');
            if (editing?.id === deleting.id) reset();
            setDeleting(null);
            await load();
            setStatus({ busy: false, error: '', info: 'Piesa a fost ștearsă din bibliotecă.' });
        } catch (error) {
            setStatus({ busy: false, error: error.message || 'Ștergerea a eșuat.', info: '' });
        }
    }

    const query = search.trim().toLowerCase();
    const filtered = (pieces || []).filter((piece) => `${piece.title} ${piece.grupa || ''}`.toLowerCase().includes(query));
    const groupNames = [...new Set([...groups.map((group) => group.name), ...(pieces || []).map((piece) => piece.grupa)].filter(Boolean))].sort();

    return (
        <section className="min-w-0 space-y-5" aria-label="Administrare Canto">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-2xl text-white">Canto</h2>
                <input type="search" className="input sm:max-w-xs" aria-label="Caută piese Canto" placeholder="Piesă sau grupă" value={search} onChange={(event) => setSearch(event.target.value)} />
            </header>

            <form ref={formRef} onSubmit={save} className="space-y-3 border-y border-white/10 py-4" aria-label={editing ? 'Editează piesa Canto' : 'Adaugă piesă Canto'}>
                {editing && <h3 className="text-lg font-semibold text-white">Editează: {editing.title} — audio și versuri</h3>}
                <fieldset disabled={(status.busy || aiBusy)} className="grid min-w-0 gap-3 xl:grid-cols-[minmax(150px,1.3fr)_minmax(120px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto]">
                    <div className="min-w-0">
                        <label className="label" htmlFor="canto-title">Titlul piesei</label>
                        <input id="canto-title" className="input" required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                    </div>
                    <div className="min-w-0">
                        <label className="label" htmlFor="canto-group">Grupa</label>
                        <input id="canto-group" className="input" list="canto-groups" maxLength={100} value={form.grupa} onChange={(event) => setForm({ ...form, grupa: event.target.value })} />
                        <datalist id="canto-groups">{groupNames.map((name) => <option key={name} value={name} />)}</datalist>
                    </div>
                    <div className="min-w-0">
                        <label className="label" htmlFor="canto-module">Modul de studiu</label>
                        <select id="canto-module" className="input" value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>
                            {STUDY_LEVELS.map((module) => <option key={module.value} value={module.value}>{module.label}</option>)}
                        </select>
                    </div>
                    {CANTO_VARIANTS.map((variant) => (
                        <div className="min-w-0" key={`${fileKey}-${variant.key}`}>
                            <label className="label" htmlFor={`canto-${variant.key}`}>Upload MP3 {variant.label}</label>
                            <input id={`canto-${variant.key}`} type="file" accept=".mp3,audio/mpeg" className="input w-full text-xs" onChange={(event) => setFiles({ ...files, [variant.key]: event.target.files?.[0] || null })} />
                        </div>
                    ))}
                    <button type="button" className="btn-ghost inline-flex items-center justify-center gap-2 self-end" onClick={() => { setStatus({ ...status, error: '' }); setLyrics({ piece: null, text: form.versuri_text }); }}>
                        <FileText size={16} aria-hidden="true" /> {form.versuri_text ? 'Editează versuri' : 'Adaugă versuri'}
                    </button>
                </fieldset>
                <fieldset disabled={(status.busy || aiBusy)} className="grid gap-3 sm:grid-cols-2">
                    <div><label className="label" htmlFor="canto-description">Descriere / indicații de studiu</label><textarea id="canto-description" className="input" maxLength={600} value={form.description || ''} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
                    <div key={fileKey}><label className="label" htmlFor="canto-score">Partitură PDF</label><input id="canto-score" type="file" accept=".pdf,application/pdf" className="input" onChange={(event) => setFiles({ ...files, score: event.target.files?.[0] || null })} /></div>
                </fieldset>
                {editing && <p className="text-xs text-slate-300">Disciplina: Canto. Audio și PDF existente se păstrează dacă nu alegi fișiere noi.</p>}
                <details className="text-sm text-slate-400">
                    <summary className="cursor-pointer">Linkuri audio existente</summary>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {CANTO_VARIANTS.map((variant) => <div key={variant.key} className="min-w-0">
                            <label className="label" htmlFor={`canto-url-${variant.key}`}>URL {variant.label}</label>
                            <input id={`canto-url-${variant.key}`} type="url" className="input" disabled={(status.busy || aiBusy) || Boolean(files[variant.key])} value={form[variant.url] || ''} onChange={(event) => setForm({ ...form, [variant.url]: event.target.value })} />
                        </div>)}
                    </div>
                </details>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.is_published} disabled={(status.busy || aiBusy)} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} /> Publicată pentru elevi</label>
                    <div className="flex flex-wrap gap-2">
                        {editing && <button type="button" disabled={(status.busy || aiBusy)} className="btn-ghost inline-flex items-center gap-2" onClick={reset}><X size={16} aria-hidden="true" /> Anulează editarea</button>}
                        <button type="submit" disabled={(status.busy || aiBusy)} className="btn-gold inline-flex items-center gap-2"><Save size={16} aria-hidden="true" /> {status.busy ? 'Se salvează…' : editing ? 'Salvează modificările' : 'Adaugă piesa'}</button>
                    </div>
                </div>
                <GenerateLyricsButton key={editing?.id || 'new'} piece={editing} disabled={(status.busy || aiBusy) || Boolean(files.pozitiv)} onBusyChange={setAiBusy} onGenerated={text => setForm(previous => ({ ...previous, versuri_text: text }))} />
                <label className="label" htmlFor="canto-draft-lyrics">Versuri / text sincronizat (LRC)</label>
                <textarea id="canto-draft-lyrics" className="input min-h-28" maxLength={100000} disabled={status.busy || aiBusy} value={form.versuri_text} onChange={event => setForm(previous => ({ ...previous, versuri_text: event.target.value }))} />
            </form>

            {status.error && !lyrics && !deleting && <p role="alert" className="text-sm text-brand-200">{status.error}</p>}
            {status.info && <p role="status" className="text-sm text-emerald-300">{status.info}</p>}
            {loadError && <div role="alert" className="text-sm text-brand-200">{loadError} <button type="button" className="btn-ghost" onClick={load}>Reîncarcă Canto</button></div>}
            {pieces === null ? <Spinner label="Se încarcă Canto…" /> : !loadError && !filtered.length ? <p className="text-sm text-slate-400">Nicio piesă găsită.</p> : (
                <div className="max-w-full overflow-x-auto">
                    <table className="w-full min-w-[850px] table-fixed text-left text-sm">
                        <caption className="sr-only">Biblioteca Canto</caption>
                        <thead className="border-b border-white/10 text-slate-400"><tr>
                            {['Piesă & Grupă', 'Pozitiv', 'Negativ', 'Versuri', 'Acțiuni'].map((heading) => <th scope="col" key={heading} className="px-3 py-3">{heading}</th>)}
                        </tr></thead>
                        <tbody>{filtered.map((piece) => <tr key={piece.id} className="border-b border-white/10 align-top">
                            <td className="px-3 py-4">
                                <p className="break-words font-semibold text-white">{piece.title}</p>
                                <p className="mt-1 break-words text-slate-400">{piece.grupa || 'Fără grupă'}</p>
                                <p className="mt-1 text-xs text-slate-500">{piece.is_published ? 'Publicată' : 'Ciornă'}</p>
                                <button type="button" disabled={(status.busy || aiBusy)} className="btn-ghost mt-2 inline-flex items-center gap-1 text-xs" aria-label={`Editează ${piece.title}`} onClick={() => edit(piece)}><Pencil size={14} aria-hidden="true" /> Editează</button>
                            </td>
                            {CANTO_VARIANTS.map((variant) => <td key={variant.key} className="px-3 py-4">
                                <PieceAudio piece={piece} variant={variant} />
                                <label className={`btn-ghost relative mt-2 inline-flex cursor-pointer items-center gap-1 text-xs ${(status.busy || aiBusy) ? 'opacity-50' : ''}`}>
                                    <Upload size={14} aria-hidden="true" /> Înlocuiește
                                    <input type="file" className="sr-only" accept=".mp3,audio/mpeg" aria-label={`Înlocuiește ${variant.label} — ${piece.title}`} disabled={(status.busy || aiBusy)} onChange={(event) => { replace(piece, variant, event.target.files?.[0]); event.target.value = ''; }} />
                                </label>
                            </td>)}
                            <td className="px-3 py-4"><button type="button" disabled={(status.busy || aiBusy)} className="btn-ghost inline-flex items-center gap-1 text-xs" aria-label={`Versuri — ${piece.title}`} onClick={() => { setStatus({ ...status, error: '' }); setLyrics({ piece, text: piece.versuri_text || '' }); }}><FileText size={14} aria-hidden="true" /> {piece.versuri_text ? 'Vezi / editează' : 'Adaugă versuri'}</button></td>
                            <td className="px-3 py-4"><button type="button" disabled={(status.busy || aiBusy)} className="btn-ghost inline-flex items-center gap-1 text-xs text-brand-200" aria-label={`Șterge ${piece.title}`} onClick={() => { setStatus({ ...status, error: '' }); setDeleting(piece); }}><Trash2 size={14} aria-hidden="true" /> Șterge piesă</button></td>
                        </tr>)}</tbody>
                    </table>
                </div>
            )}

            <Modal open={Boolean(lyrics)} title={lyrics?.piece ? `Versuri — ${lyrics.piece.title}` : 'Adaugă versuri'} onClose={() => { if (!(status.busy || aiBusy)) setLyrics(null); }} wide>
                {lyrics && <div className="space-y-4">
                    <GenerateLyricsButton key={lyrics.piece?.id || 'draft'} piece={lyrics.piece || editing} disabled={(status.busy || aiBusy) || Boolean(files.pozitiv)} onBusyChange={setAiBusy} onGenerated={text => setLyrics(previous => ({ ...previous, text }))} />
                    <label className="label" htmlFor="canto-lyrics">Textul versurilor</label>
                    <textarea id="canto-lyrics" className="input min-h-80 whitespace-pre-wrap" maxLength={100000} disabled={(status.busy || aiBusy)} value={lyrics.text} onChange={(event) => setLyrics({ ...lyrics, text: event.target.value })} />
                    {status.error && <p role="alert" className="text-sm text-brand-200">{status.error}</p>}
                    <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" disabled={(status.busy || aiBusy)} className="btn-ghost" onClick={() => setLyrics(null)}>Anulează</button>
                        <button type="button" disabled={(status.busy || aiBusy)} className="btn-gold inline-flex items-center gap-2" onClick={saveLyrics}><Save size={16} aria-hidden="true" /> {lyrics.piece ? 'Salvează versurile' : 'Aplică versurile'}</button>
                    </div>
                </div>}
            </Modal>
            <Modal open={Boolean(deleting)} title="Șterge piesa Canto" onClose={() => { if (!(status.busy || aiBusy)) setDeleting(null); }}>
                <div className="space-y-4">
                    <p className="break-words text-sm text-slate-300">Ștergi definitiv „{deleting?.title}” din bibliotecă și alocările ei? Operația nu poate fi anulată.</p>
                    {status.error && <p role="alert" className="text-sm text-brand-200">{status.error}</p>}
                    <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" disabled={(status.busy || aiBusy)} className="btn-ghost" onClick={() => setDeleting(null)}>Anulează</button>
                        <button type="button" disabled={(status.busy || aiBusy)} className="btn-gold inline-flex items-center gap-2" onClick={remove}><Trash2 size={16} aria-hidden="true" /> Confirmă ștergerea</button>
                    </div>
                </div>
            </Modal>
        </section>
    );
}