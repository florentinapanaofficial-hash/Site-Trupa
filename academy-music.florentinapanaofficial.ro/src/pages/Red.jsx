import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { logEvent } from '../lib/activity';
import SecurePdfViewer from '../components/SecurePdfViewer';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

const CATEGORIES = [
    { value: 'toate', label: 'Toate' },
    { value: 'partitura', label: 'Partituri' },
    { value: 'fisa-teoretica', label: 'Fișe teoretice' },
    { value: 'exercitiu', label: 'Exerciții' },
    { value: 'link', label: 'Linkuri utile' },
];

const CATEGORY_ICON = {
    partitura: '🎼',
    'fisa-teoretica': '📖',
    exercitiu: '🎯',
    link: '🔗',
};

const DISCIPLINE_LABEL = { orga: 'Orgă', canto: 'Canto', comun: 'Comun' };

export default function Red() {
    const { profile } = useAuth();
    const [resources, setResources] = useState(null);
    const [category, setCategory] = useState('toate');
    const [discipline, setDiscipline] = useState('toate');
    const [openResource, setOpenResource] = useState(null);

    useEffect(() => {
        let active = true;
        supabase
            .from('resources')
            .select('*')
            .order('created_at', { ascending: false })
            .then(({ data }) => {
                if (active) setResources(data || []);
            });
        return () => {
            active = false;
        };
    }, []);

    const filtered = useMemo(() => {
        if (!resources) return [];
        return resources.filter(
            (item) =>
                (category === 'toate' || item.category === category) &&
                (discipline === 'toate' || item.discipline === discipline)
        );
    }, [resources, category, discipline]);

    function open(resource) {
        setOpenResource(resource);
        logEvent(profile?.id, 'open_resource', '/red', { resource_id: resource.id });
    }

    return (
        <div className="space-y-6">
            <header className="card">
                <span className="text-3xl" aria-hidden="true">
                    📚
                </span>
                <h1 className="mt-2 font-display text-3xl text-white">RED — Resurse Educaționale Deschise</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                    Partituri, fișe de teorie muzicală și exerciții pentru studiul individual. Toate se
                    deschid direct în platformă.
                </p>
            </header>

            <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => setCategory(option.value)}
                        className={`rounded-xl px-3 py-2 text-sm font-medium transition ${category === option.value
                                ? 'bg-brand-500 text-white'
                                : 'border border-white/15 text-slate-400 hover:text-slate-100'
                            }`}
                    >
                        {option.label}
                    </button>
                ))}
                <select
                    className="input ml-auto w-auto"
                    value={discipline}
                    onChange={(event) => setDiscipline(event.target.value)}
                    aria-label="Filtrează după disciplină"
                >
                    <option value="toate">Toate disciplinele</option>
                    <option value="orga">Orgă</option>
                    <option value="canto">Canto</option>
                    <option value="comun">Comun</option>
                </select>
            </div>

            {resources === null ? (
                <Spinner label="Se încarcă resursele…" />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon="📚"
                    title="Nicio resursă în această categorie"
                    description="Profesorul adaugă materiale noi pe parcursul anului școlar."
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((resource) => (
                        <article key={resource.id} className="card flex flex-col">
                            <span className="text-2xl" aria-hidden="true">
                                {CATEGORY_ICON[resource.category] || '📄'}
                            </span>
                            <h2 className="mt-2 text-base font-semibold text-white">{resource.title}</h2>
                            <p className="mt-1 flex-1 text-sm text-slate-400">{resource.description}</p>
                            <div className="mt-3 flex items-center justify-between gap-2">
                                <span className="badge bg-white/5 text-slate-400">
                                    {DISCIPLINE_LABEL[resource.discipline]}
                                </span>
                                {resource.file_path ? (
                                    <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => open(resource)}>
                                        Deschide
                                    </button>
                                ) : resource.external_url ? (
                                    <a
                                        className="btn-ghost px-3 py-1.5"
                                        href={resource.external_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Vizitează
                                    </a>
                                ) : null}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <Modal
                open={Boolean(openResource)}
                title={openResource?.title || ''}
                onClose={() => setOpenResource(null)}
                wide
            >
                {openResource?.file_path && (
                    <SecurePdfViewer
                        path={openResource.file_path}
                        watermark={profile?.full_name || 'Academy Music'}
                    />
                )}
            </Modal>
        </div>
    );
}
