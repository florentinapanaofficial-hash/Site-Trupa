import { useTeacherMode } from '../lib/useTeacherMode';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Pencil, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import CantoPieceStudio from '../components/CantoPieceStudio';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import StudyProgressNotice from '../components/StudyProgressNotice';
import { useStudyProgress } from '../lib/useStudyProgress';
import { isStudyLevelLocked, studyLevelLabel } from '../lib/studyLevels';

const RecordingStudio = lazy(() => import('../components/RecordingStudio'));
const SecurePdfViewer = lazy(() => import('../components/SecurePdfViewer'));

export default function Canto() {
    const { isTeacher: teacherRole, profile, isInspector } = useAuth();
    const [teacherMode] = useTeacherMode();
    const isTeacher = teacherRole && teacherMode;
    const studyProgress = useStudyProgress(profile, !isTeacher);
    const [lockNotice, setLockNotice] = useState('');
    const [pieces, setPieces] = useState(null);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [group, setGroup] = useState('');
    const [recordingPiece, setRecordingPiece] = useState(null);
    const [score, setScore] = useState(null);

    async function load() {
        setError('');
        try {
            const rows = [];
            for (let offset = 0; ; offset += 500) {
                const { data, error } = await supabase.from('pieces').select('*').eq('discipline', 'canto').eq('is_published', true)
                    .order('grupa').order('title').order('id').range(offset, offset + 499);
                if (error) throw error;
                rows.push(...data);
                if (data.length < 500) break;
            }
            setPieces(rows);
        } catch {
            setError('Piesele Canto nu au putut fi încărcate.');
            setPieces((previous) => previous || []);
        }
    }

    useEffect(() => { load(); }, []);
    const groups = [...new Set((pieces || []).map((piece) => piece.grupa).filter(Boolean))].sort();
    const query = search.trim().toLowerCase();
    const filtered = (pieces || []).filter((piece) => (!group || piece.grupa === group) && `${piece.title} ${piece.grupa || ''}`.toLowerCase().includes(query));

    return (
        <section className="min-w-0 space-y-5" aria-label="Biblioteca Canto">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <h1 className="font-display text-3xl text-white">Canto</h1>
                {isTeacher && <Link to="/admin/canto/" className="btn-gold inline-flex items-center gap-2"><Plus size={16} aria-hidden="true" /> Adaugă piesă</Link>}
            </header>
            {!isTeacher && <StudyProgressNotice state={studyProgress} />}
            {lockNotice && <p role="status" aria-live="polite" className="rounded-lg border border-gold-400/20 bg-gold-400/10 p-3 text-sm text-gold-200">{lockNotice}</p>}
            <div className="flex flex-col gap-3 sm:flex-row">
                <input type="search" className="input sm:max-w-xs" aria-label="Caută în Canto" placeholder="Piesă sau grupă" value={search} onChange={(event) => setSearch(event.target.value)} />
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <label htmlFor="canto-filter-group">Grupa</label>
                    <select id="canto-filter-group" className="input" value={group} onChange={(event) => setGroup(event.target.value)}>
                        <option value="">Toate grupele</option>
                        {groups.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                </div>
            </div>
            {error && <div role="alert" className="text-sm text-brand-200">{error} <button type="button" className="btn-ghost" onClick={load}>Reîncearcă</button></div>}
            {pieces === null ? <Spinner label="Se încarcă Canto…" /> : !error && !filtered.length ? <p className="text-slate-400">Nicio piesă găsită.</p> : (
                <div className="divide-y divide-white/10">
                    {filtered.map((piece) => {
                        const locked = !isTeacher && isStudyLevelLocked(piece.level, studyProgress.progress.unlockedLevels);
                        return <article key={piece.id} className="card relative my-5 min-w-0 space-y-4 overflow-hidden border border-white/10 bg-gradient-to-br from-ink-900 to-ink-950">
                        <div className="min-w-0"><h2 className="break-words text-lg font-semibold text-white">{piece.title}</h2><p className="mt-1 break-words text-sm text-slate-400">{piece.grupa || 'Fără grupă'}</p>{piece.description && <p className="mt-2 text-sm text-slate-300">{piece.description}</p>}</div>
                        {isTeacher && <Link to={'/admin/canto/?edit=' + encodeURIComponent(piece.id)} className="btn-ghost inline-flex items-center gap-2" aria-label={'Editează ' + piece.title}><Pencil size={16} aria-hidden="true" /> Editează piesa · negativ și versuri</Link>}
                        {!locked ? <>
                            <CantoPieceStudio piece={piece} canGenerate={isTeacher} onLyricsSaved={text => setPieces(previous => previous.map(item => item.id === piece.id ? { ...item, versuri_text: text } : item))} />
                            {!isInspector && <button type="button" className="btn-gold" onClick={() => { document.querySelectorAll("audio").forEach(audio => audio.pause()); setRecordingPiece(piece); }}>REC · Înregistrează tema</button>}
                            {piece.score_path && <button type="button" className="btn-ghost justify-self-start" onClick={() => setScore(piece)}>Vezi partitura</button>}
                        </> : <div className="min-h-24" aria-hidden="true" />}
                        {locked && <button type="button" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-ink-950/75 p-4 text-center font-semibold text-white" onClick={() => setLockNotice('Info: profilul tău este ' + studyLevelLabel(studyProgress.progress.studyLevel) + '. Trimite toate temele asociate pieselor alocate nivelului curent pentru a debloca nivelul următor.')} aria-label={`Piesa ${piece.title} este blocată. Vezi condițiile de deblocare.`}><Lock size={28} aria-hidden="true" /><span>Piesă blocată</span><span className="text-xs font-normal text-slate-200">Finalizează temele nivelului tău pentru a debloca nivelul următor.</span></button>}
                    </article>;
                    })}
                </div>
            )}
            {recordingPiece && <Suspense fallback={<Spinner label="Se încarcă studioul de înregistrare…" />}><RecordingStudio open piece={recordingPiece} onClose={() => setRecordingPiece(null)} onSubmitted={() => void studyProgress.reload()} /></Suspense>}

            <Modal open={Boolean(score)} title={score ? `Partitura — ${score.title}` : "Partitură"} onClose={() => setScore(null)} wide>
                {score && <Suspense fallback={<Spinner label="Se încarcă partitura…" />}><SecurePdfViewer path={score.score_path} watermark={profile?.full_name || "Academy Music"} /></Suspense>}
            </Modal>
        </section>
    );
}