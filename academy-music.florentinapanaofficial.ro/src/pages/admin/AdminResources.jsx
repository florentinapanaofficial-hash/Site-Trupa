import { useEffect, useState } from 'react';
import { supabase, BUCKET_MEDIA } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { safeFileName, uploadFile } from '../../lib/media';
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
    const [file, setFile] = useState(null);
    const [state, setState] = useState({ busy: false, error: '', info: '' });

    async function load() {
        const { data } = await supabase
            .from('resources')
            .select('*')
            .order('created_at', { ascending: false });
        setResources(data || []);
    }

    useEffect(() => {
        load();
    }, []);

    function update(field) {
        return (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setState({ busy: true, error: '', info: '' });

        try {
            if (!file && !form.external_url.trim()) {
                throw new Error('Adaugă un fișier PDF sau un link extern.');
            }
            if (file && file.type !== 'application/pdf') {
                throw new Error('Resursele încărcate trebuie să fie PDF.');
            }

            let filePath = null;
            if (file) {
                filePath = `red/${form.discipline}/${Date.now()}-${safeFileName(file.name)}`;
                await uploadFile(BUCKET_MEDIA, filePath, file);
            }

            const { error } = await supabase.from('resources').insert({
                discipline: form.discipline,
                category: form.category,
                title: form.title.trim(),
                description: form.description.trim() || null,
                file_path: filePath,
                external_url: form.external_url.trim() || null,
                created_by: profile.id,
            });
            if (error) throw error;

            setForm(EMPTY);
            setFile(null);
            event.target.reset();
            setState({ busy: false, error: '', info: 'Resursă adăugată.' });
            load();
        } catch (err) {
            setState({ busy: false, error: err?.message || 'Salvarea a eșuat.', info: '' });
        }
    }

    async function remove(resource) {
        if (!window.confirm(`Ștergi resursa „${resource.title}”?`)) return;
        if (resource.file_path) await supabase.storage.from(BUCKET_MEDIA).remove([resource.file_path]);
        await supabase.from('resources').delete().eq('id', resource.id);
        load();
    }

    return (
        <div className="space-y-6">
            <form onSubmit={handleSubmit} className="card space-y-4">
                <h2 className="text-lg font-semibold text-white">Adaugă resursă RED</h2>

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
                    {state.busy ? 'Se încarcă…' : 'Salvează resursa'}
                </button>
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
