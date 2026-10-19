import { useEffect, useState } from 'react';
import { FileText, Pencil, Save, Trash2, Upload, X } from 'lucide-react';
import { supabase, BUCKET_MEDIA } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { uploadFile } from '../../lib/media';
import { CANTO_VARIANTS, EMPTY_CANTO, saveCantoPiece } from '../../lib/canto';
import CantoAudio from '../../components/CantoAudio';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

export default function AdminCanto() {
    const { profile } = useAuth();
    const [pieces, setPieces] = useState(null);
    const [groups, setGroups] = useState([]);
    const [form, setForm] = useState({ ...EMPTY_CANTO });
    const [editing, setEditing] = useState(null);
    const [files, setFiles] = useState({});
    const [fileKey, setFileKey] = useState(0);
    const [lyrics, setLyrics] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [search, setSearch] = useState('');
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

    function reset() {
        setForm({ ...EMPTY_CANTO });
        setEditing(null);
        setFiles({});
        setFileKey((previous) => previous + 1);
    }

    function edit(piece) {
        setEditing(piece);
        setForm({ ...EMPTY_CANTO, ...piece });
        setFiles({});
        setFileKey((previous) => previous + 1);
        setStatus({ busy: false, error: '', info: '' });
    }

    async function persist(values, selectedFiles, piece) {
        return saveCantoPiece({
            client: supabase, form: values, files: selectedFiles, piece, userId: profile.id,
            upload: (path, file) => uploadFile(BUCKET_MEDIA, path, file, { contentType: 'audio/mpeg' }),
            removeUploaded: (paths) => supabase.storage.from(BUCKET_MEDIA).remove(paths),
        });
    }

    async function save(event) {
        event.preventDefault();
        if (status.busy) return;
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
        if (!file || status.busy) return;
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
        if (status.busy) return;
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
        if (!deleting || status.busy) return;
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

            <form onSubmit={save} className="space-y-3 border-y border-white/10 py-4" aria-label={editing ? 'Editează piesa Canto' : 'Adaugă piesă Canto'}>
                <fieldset disabled={status.busy} className="grid min-w-0 gap-3 xl:grid-cols-[minmax(150px,1.3fr)_minmax(120px,1fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto]">
                    <div className="min-w-0">
                        <label className="label" htmlFor="canto-title">Titlul piesei</label>
                        <input id="canto-title" className="input" required maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                    </div>
                    <div className="min-w-0">
                        <label className="label" htmlFor="canto-group">Grupa</label>
                        <input id="canto-group" className="input" list="canto-groups" maxLength={100} value={form.grupa} onChange={(event) => setForm({ ...form, grupa: event.target.value })} />
                        <datalist id="canto-groups">{groupNames.map((name) => <option key={name} value={name} />)}</datalist>
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
                <details className="text-sm text-slate-400">
                    <summary className="cursor-pointer">Linkuri audio existente</summary>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        {CANTO_VARIANTS.map((variant) => <div key={variant.key} className="min-w-0">
                            <label className="label" htmlFor={`canto-url-${variant.key}`}>URL {variant.label}</label>
                            <input id={`canto-url-${variant.key}`} type="url" className="input" disabled={status.busy || Boolean(files[variant.key])} value={form[variant.url] || ''} onChange={(event) => setForm({ ...form, [variant.url]: event.target.value })} />
                        </div>)}
                    </div>
                </details>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.is_published} disabled={status.busy} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} /> Publicată pentru elevi</label>
                    <div className="flex flex-wrap gap-2">
                        {editing && <button type="button" disabled={status.busy} className="btn-ghost inline-flex items-center gap-2" onClick={reset}><X size={16} aria-hidden="true" /> Anulează editarea</button>}
                        <button type="submit" disabled={status.busy} className="btn-gold inline-flex items-center gap-2"><Save size={16} aria-hidden="true" /> {status.busy ? 'Se salvează…' : editing ? 'Salvează modificările' : 'Adaugă piesa'}</button>
                    </div>
                </div>
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
                                <button type="button" disabled={status.busy} className="btn-ghost mt-2 inline-flex items-center gap-1 text-xs" aria-label={`Editează ${piece.title}`} onClick={() => edit(piece)}><Pencil size={14} aria-hidden="true" /> Editează</button>
                            </td>
                            {CANTO_VARIANTS.map((variant) => <td key={variant.key} className="px-3 py-4">
                                <CantoAudio piece={piece} variant={variant} />
                                <label className={`btn-ghost relative mt-2 inline-flex cursor-pointer items-center gap-1 text-xs ${status.busy ? 'opacity-50' : ''}`}>
                                    <Upload size={14} aria-hidden="true" /> Înlocuiește
                                    <input type="file" className="sr-only" accept=".mp3,audio/mpeg" aria-label={`Înlocuiește ${variant.label} — ${piece.title}`} disabled={status.busy} onChange={(event) => { replace(piece, variant, event.target.files?.[0]); event.target.value = ''; }} />
                                </label>
                            </td>)}
                            <td className="px-3 py-4"><button type="button" disabled={status.busy} className="btn-ghost inline-flex items-center gap-1 text-xs" aria-label={`Versuri — ${piece.title}`} onClick={() => { setStatus({ ...status, error: '' }); setLyrics({ piece, text: piece.versuri_text || '' }); }}><FileText size={14} aria-hidden="true" /> {piece.versuri_text ? 'Vezi / editează' : 'Adaugă versuri'}</button></td>
                            <td className="px-3 py-4"><button type="button" disabled={status.busy} className="btn-ghost inline-flex items-center gap-1 text-xs text-brand-200" aria-label={`Șterge ${piece.title}`} onClick={() => { setStatus({ ...status, error: '' }); setDeleting(piece); }}><Trash2 size={14} aria-hidden="true" /> Șterge piesă</button></td>
                        </tr>)}</tbody>
                    </table>
                </div>
            )}

            <Modal open={Boolean(lyrics)} title={lyrics?.piece ? `Versuri — ${lyrics.piece.title}` : 'Adaugă versuri'} onClose={() => { if (!status.busy) setLyrics(null); }} wide>
                {lyrics && <div className="space-y-4">
                    <label className="label" htmlFor="canto-lyrics">Textul versurilor</label>
                    <textarea id="canto-lyrics" className="input min-h-80 whitespace-pre-wrap" maxLength={100000} disabled={status.busy} value={lyrics.text} onChange={(event) => setLyrics({ ...lyrics, text: event.target.value })} />
                    {status.error && <p role="alert" className="text-sm text-brand-200">{status.error}</p>}
                    <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" disabled={status.busy} className="btn-ghost" onClick={() => setLyrics(null)}>Anulează</button>
                        <button type="button" disabled={status.busy} className="btn-gold inline-flex items-center gap-2" onClick={saveLyrics}><Save size={16} aria-hidden="true" /> {lyrics.piece ? 'Salvează versurile' : 'Aplică versurile'}</button>
                    </div>
                </div>}
            </Modal>
            <Modal open={Boolean(deleting)} title="Șterge piesa Canto" onClose={() => { if (!status.busy) setDeleting(null); }}>
                <div className="space-y-4">
                    <p className="break-words text-sm text-slate-300">Ștergi definitiv „{deleting?.title}” din bibliotecă și alocările ei? Operația nu poate fi anulată.</p>
                    {status.error && <p role="alert" className="text-sm text-brand-200">{status.error}</p>}
                    <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" disabled={status.busy} className="btn-ghost" onClick={() => setDeleting(null)}>Anulează</button>
                        <button type="button" disabled={status.busy} className="btn-gold inline-flex items-center gap-2" onClick={remove}><Trash2 size={16} aria-hidden="true" /> Confirmă ștergerea</button>
                    </div>
                </div>
            </Modal>
        </section>
    );
}