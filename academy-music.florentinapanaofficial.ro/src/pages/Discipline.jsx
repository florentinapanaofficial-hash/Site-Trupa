import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { logEvent } from '../lib/activity';
import PieceCard from '../components/PieceCard';
import SecurePdfViewer from '../components/SecurePdfViewer';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

const META = {
    orga: {
        icon: '🎹',
        title: 'Orgă',
        subtitle: 'Repertoriu, acompaniamente și partituri pentru orgă electronică.',
    },
    canto: {
        icon: '🎤',
        title: 'Canto',
        subtitle: 'Piese vocale cu negativ și pozitiv, pe niveluri de dificultate.',
    },
};

const LEVELS = [
    { value: 'toate', label: 'Toate nivelurile' },
    { value: 'incepator', label: 'Începător' },
    { value: 'mediu', label: 'Mediu' },
    { value: 'avansat', label: 'Avansat' },
];

export default function Discipline({ discipline }) {
    const { profile, isTeacher } = useAuth();
    const navigate = useNavigate();
    const [pieces, setPieces] = useState(null);
    const [level, setLevel] = useState('toate');
    const [search, setSearch] = useState('');
    const [scorePiece, setScorePiece] = useState(null);
    const meta = META[discipline];

    useEffect(() => {
        let active = true;
        setPieces(null);

        supabase
            .from('pieces')
            .select('*')
            .eq('discipline', discipline)
            .order('level', { ascending: true })
            .order('title', { ascending: true })
            .then(({ data }) => {
                if (active) setPieces(data || []);
            });

        return () => {
            active = false;
        };
    }, [discipline]);

    const filtered = useMemo(() => {
        if (!pieces) return [];
        const query = search.trim().toLowerCase();
        return pieces.filter((piece) => {
            const matchesLevel = level === 'toate' || piece.level === level;
            const matchesQuery =
                !query ||
                piece.title.toLowerCase().includes(query) ||
                (piece.composer || '').toLowerCase().includes(query);
            return matchesLevel && matchesQuery;
        });
    }, [pieces, level, search]);

    function openScore(piece) {
        setScorePiece(piece);
        logEvent(profile?.id, 'open_score', `/${discipline}`, { piece_id: piece.id });
    }

    return (
        <div className="space-y-6">
            <header className="card flex flex-wrap items-start justify-between gap-4">
                <div>
                    <span className="text-3xl" aria-hidden="true">
                        {meta.icon}
                    </span>
                    <h1 className="mt-2 font-display text-3xl text-white">{meta.title}</h1>
                    <p className="mt-1 text-sm text-slate-400">{meta.subtitle}</p>
                </div>
                {isTeacher && (
                    <button
                        type="button"
                        className="btn-gold"
                        onClick={() => navigate(`/admin/piese?add=${discipline}`)}
                    >
                        ＋ Adaugă piesă
                    </button>
                )}
            </header>

            <div className="flex flex-col gap-3 sm:flex-row">
                <input
                    type="search"
                    className="input sm:max-w-xs"
                    placeholder="Caută după titlu sau compozitor…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label="Caută în repertoriu"
                />
                <div className="flex flex-wrap gap-2">
                    {LEVELS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setLevel(option.value)}
                            className={`rounded-xl px-3 py-2 text-sm font-medium transition ${level === option.value
                                ? 'bg-brand-500 text-white'
                                : 'border border-white/15 text-slate-400 hover:text-slate-100'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {pieces === null ? (
                <Spinner label="Se încarcă repertoriul…" />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={meta.icon}
                    title="Nicio piesă găsită"
                    description="Încearcă alt filtru sau revino după ce profesorul adaugă materiale noi."
                />
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {filtered.map((piece) => (
                        <PieceCard key={piece.id} piece={piece} onOpenScore={openScore} />
                    ))}
                </div>
            )}

            <Modal
                open={Boolean(scorePiece)}
                title={scorePiece ? `Partitura — ${scorePiece.title}` : ''}
                onClose={() => setScorePiece(null)}
                wide
            >
                {scorePiece && (
                    <SecurePdfViewer
                        path={scorePiece.score_path}
                        watermark={profile?.full_name || 'Academy Music'}
                    />
                )}
            </Modal>
        </div>
    );
}
