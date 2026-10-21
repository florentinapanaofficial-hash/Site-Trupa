import { useTeacherMode } from '../lib/useTeacherMode';
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
import { useStudyProgress } from '../lib/useStudyProgress';
import { isStudyLevelLocked, studyLevelLabel } from '../lib/studyLevels';
import StudyProgressNotice from '../components/StudyProgressNotice';

const META = {
    orga: {
        icon: '🎹',
        title: 'Instrument-Orgă',
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
    const { profile, isTeacher: teacherRole } = useAuth();
    const [teacherMode] = useTeacherMode();
    const isTeacher = teacherRole && teacherMode;
    const studyProgress = useStudyProgress(profile, !isTeacher);
    const [lockNotice, setLockNotice] = useState('');
    const navigate = useNavigate();
    const [loadError, setLoadError] = useState('');
    const [pieces, setPieces] = useState(null);
    const [level, setLevel] = useState('toate');
    const [search, setSearch] = useState('');
    const [scorePiece, setScorePiece] = useState(null);
    const meta = META[discipline];

    useEffect(() => {
        let active = true;
        setPieces(null);

        setLoadError('');
        const query = supabase
            .from('pieces')
            .select('*')
            .eq('discipline', discipline)
            .order('level', { ascending: true })
            .order('title', { ascending: true });
        if (!isTeacher) query.eq('is_published', true);
        query.then(({ data, error }) => {
            if (!active) return;
            if (error) setLoadError('Repertoriul nu a putut fi încărcat. Reîncarcă pagina.');
            setPieces(error ? [] : data || []);
        });

        return () => {
            active = false;
        };
    }, [discipline, isTeacher]);

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
        logEvent(profile?.id, 'open_score', discipline === 'orga' ? '/instrument/' : '/canto/', { piece_id: piece.id });
    }

    function practicePiece(piece) {
        logEvent(profile?.id, 'open_score', '/instrument/claviatura/', { piece_id: piece.id });
        navigate('/instrument/claviatura/?piece=' + encodeURIComponent(piece.id));
    }

    return (
        <div className="space-y-6">
            {!isTeacher && <StudyProgressNotice state={studyProgress} />}
            {lockNotice && <p role="status" aria-live="polite" className="rounded-lg border border-gold-400/20 bg-gold-400/10 p-3 text-sm text-gold-200">{lockNotice}</p>}
            <header className="card flex flex-wrap items-start justify-between gap-4">
                <div>
                    <span className="text-3xl" aria-hidden="true">
                        {meta.icon}
                    </span>
                    <h1 className="mt-2 font-display text-3xl text-white">{meta.title}</h1>
                    <p className="mt-1 text-sm text-slate-400">{meta.subtitle}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {discipline === 'orga' && <button type="button" className="btn-gold" onClick={() => navigate('/instrument/partituri/')}>Biblioteca de partituri</button>}
                    {discipline === 'orga' && <button type="button" className="btn-ghost" onClick={() => navigate('/instrument/claviatura/')}>🎹 Deschide claviatura</button>}
                    {discipline === 'orga' && <button type="button" className="btn-ghost" onClick={() => navigate('/jocuri/?tab=ritm')}>🎮 Joc Ritmic</button>}
                    {isTeacher && (
                    <button
                        type="button"
                        className="btn-gold"
                        onClick={() => navigate(`/admin/piese/?add=${discipline}`)}
                    >
                        ＋ Adaugă piesă
                    </button>
                    )}
                </div>
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

            {loadError && <p role="alert" className="text-sm text-brand-200">{loadError}</p>}
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
                    {filtered.map((piece) => {
                        const locked = !isTeacher && isStudyLevelLocked(piece.level, studyProgress.progress.unlockedLevels);
                        return <PieceCard key={piece.id} piece={piece} locked={locked} onLocked={() => setLockNotice('Info: profilul tău este ' + studyLevelLabel(studyProgress.progress.studyLevel) + '. Trimite toate temele asociate pieselor alocate nivelului curent pentru a debloca nivelul următor.')} onOpenScore={openScore} onPractice={discipline === 'orga' ? practicePiece : undefined} />;
                    })}
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
