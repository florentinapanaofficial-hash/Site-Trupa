import { useEffect, useState } from 'react';
import { supabase, BUCKET_MEDIA } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Pencil } from 'lucide-react';
import { saveStudyResource } from '../../lib/canto';
import { uploadFile } from '../../lib/media';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

const EMPTY = {
    discipline: 'comun',
    category: 'fisa-teoretica',
    title: '',
    description: '',
    external_url: '',
};

export default function AdminResources() {
    const { profile } = useAuth();
    const [resources, setResources] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [editing, setEditing] = useState(null);
    const [fileKey, setFileKey] = useState(0);
    const [file, setFile] = useState(null);
    const [state, setState] = useState({ busy: false, error: '', info: '' });

    async function load() {
        const { data, error } = await supabase
            .from('resources')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) { setState((previous) => ({ ...previous, info: '', error: 'Resursele nu au putut fi încărcate.' })); return; }
        setResources(data || []);
    }

    useEffect(() => {
        load();
    }, []);

    function update(field) {
        return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
    }

    function edit(resource) {
        setEditing(resource);
        setForm({ ...EMPTY, ...resource, description: resource.description || '', external_url: resource.external_url || '' });
        setFile(null); setFileKey((value) => value + 1);
        setState({ busy: false, error: '', info: '' });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (state.busy) return;
        setState({ busy: true, error: '', info: '' });
        try {
            await saveStudyResource({ client: supabase, form, file, resource: editing, userId: profile.id,
                upload: (path, selectedFile) => uploadFile(BUCKET_MEDIA, path, selectedFile),
                removeUploaded: (paths) => supabase.storage.from(BUCKET_MEDIA).remove(paths) });
            setForm(EMPTY); setFile(null); setEditing(null); setFileKey((value) => value + 1);
            setState({ busy: false, error: '', info: editing ? 'Resursa a fost actualizată.' : 'Resursă adăugată.' });
            await load();
        } catch (error) { setState({ busy: false, error: error.message || 'Salvarea a eșuat.', info: '' }); }
    }

    async function remove(resource) {
        if (!window.confirm('Ștergi resursa „' + resource.title + '”?')) return;
        try {
            const { data, error } = await supabase.from('resources').delete().eq('id', resource.id).select('id').single();
            if (error || !data) throw new Error('Resursa nu a putut fi ștearsă.');
            setState({ busy: false, error: '', info: 'Resursa a fost ștearsă; PDF-ul istoric este păstrat pentru curățare administrativă.' });
            await load();
        } catch (error) { setState({ busy: false, error: error.message, info: '' }); }
    }

    return (
        <div className="space-y-6">
            <form onSubmit={handleSubmit} className="card space-y-4">
                <h2 className="text-lg font-semibold text-white">{editing ? "Editează resursa RED" : "Adaugă resursă RED"}</h2>
                {editing && <p className="text-sm text-slate-300">PDF-ul existent se păstrează dacă nu alegi un fișier nou.</p>}
                <fieldset disabled={state.busy} className="space-y-4">

                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label className="label" htmlFor="res-discipline">
                            Disciplină
                        </label>
                        <select id="res-discipline" className="input" value={form.discipline} onChange={update('discipline')}>
                            <option value="comun">Comun</option>
                            <option value="orga">Orgă</option>
                            <option value="canto">Canto</option>
                        </select>
                    </div>

                    <div>
                        <label className="label" htmlFor="res-category">
                            Categorie
                        </label>
                        <select id="res-category" className="input" value={form.category} onChange={update('category')}>
                            <option value="partitura">Partitură</option>
                            <option value="fisa-teoretica">Fișă teoretică</option>
                            <option value="exercitiu">Exercițiu</option>
                            <option value="link">Link util</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="label" htmlFor="res-title">
                        Titlu
                    </label>
                    <input id="res-title" className="input" value={form.title} onChange={update('title')} required maxLength={120} />
                </div>

                <div>
                    <label className="label" htmlFor="res-description">
                        Descriere
                    </label>
                    <textarea
                        id="res-description"
                        className="input min-h-[70px]"
                        value={form.description}
                        onChange={update('description')}
                        maxLength={400}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label className="label" htmlFor="res-file">
                            Fișier PDF
                        </label>
                        <input
                            key={fileKey}
                            id="res-file"
                            type="file"
                            accept="application/pdf"
                            className="input text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-slate-200"
                            onChange={(event) => setFile(event.target.files?.[0] || null)}
                        />
                    </div>
                    <div>
                        <label className="label" htmlFor="res-url">
                            sau link extern
                        </label>
                        <input
                            id="res-url"
                            type="url"
                            className="input"
                            value={form.external_url}
                            onChange={update('external_url')}
                            placeholder="https://…"
                        />
                    </div>
                </div>

                {state.error && <p className="rounded-lg bg-brand-500/15 px-3 py-2 text-sm text-brand-200">{state.error}</p>}
                {state.info && <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">{state.info}</p>}

                <button type="submit" className="btn-gold" disabled={state.busy}>
                    {state.busy ? 'Se încarcă…' : editing ? 'Salvează modificările' : 'Salvează resursa'}
                </button>
                {editing && <button type="button" className="btn-ghost ml-3" onClick={() => { setEditing(null); setForm(EMPTY); setFile(null); setFileKey((value) => value + 1); }}>Anulează editarea</button>}
                </fieldset>
            </form>

            {resources === null ? (
                <Spinner />
            ) : resources.length === 0 ? (
                <EmptyState icon="📚" title="Nicio resursă încă" />
            ) : (
                <div className="card overflow-x-auto p-0">
                    <table className="w-full min-w-[600px] text-sm">
                        <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Titlu</th>
                                <th className="px-4 py-3">Categorie</th>
                                <th className="px-4 py-3">Disciplină</th>
                                <th className="px-4 py-3">Tip</th>
                                <th className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {resources.map((resource) => (
                                <tr key={resource.id}>
                                    <td className="px-4 py-3 font-medium text-slate-100">{resource.title}</td>
                                    <td className="px-4 py-3 text-slate-400">{resource.category}</td>
                                    <td className="px-4 py-3 text-slate-400">{resource.discipline}</td>
                                    <td className="px-4 py-3 text-slate-400">{resource.file_path ? 'PDF' : 'Link'}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button type="button" className="btn-ghost mr-3" onClick={() => edit(resource)} aria-label={`Editează ${resource.title}`}><Pencil size={15} aria-hidden="true" />Editează</button>
                                        <button type="button" className="text-xs text-brand-300 hover:text-brand-200" onClick={() => remove(resource)}>
                                            Șterge
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
