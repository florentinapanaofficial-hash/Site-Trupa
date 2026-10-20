import { useTeacherMode } from '../lib/useTeacherMode';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import CantoPieceStudio from '../components/CantoPieceStudio';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';

const RecordingStudio = lazy(() => import('../components/RecordingStudio'));
const SecurePdfViewer = lazy(() => import('../components/SecurePdfViewer'));

export default function Canto() {
    const { isTeacher: teacherRole, profile, isInspector } = useAuth();
    const [teacherMode] = useTeacherMode();
    const isTeacher = teacherRole && teacherMode;
    const [pieces, setPieces] = useState(null);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [group, setGroup] = useState('');
    const [recordingPiece, setRecordingPiece] = useState(null);
    const [score, setScore] = useState(null);
    const [lyrics, setLyrics] = useState(null);

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
                    {filtered.map((piece) => <article key={piece.id} className="card my-5 min-w-0 space-y-4 border border-white/10 bg-gradient-to-br from-ink-900 to-ink-950">
                        <div className="min-w-0"><h2 className="break-words text-lg font-semibold text-white">{piece.title}</h2><p className="mt-1 break-words text-sm text-slate-400">{piece.grupa || 'Fără grupă'}</p>{piece.description && <p className="mt-2 text-sm text-slate-300">{piece.description}</p>}</div>
                        <CantoPieceStudio piece={piece} />
                        {!isInspector && <button type="button" className="btn-gold" onClick={() => { document.querySelectorAll("audio").forEach(audio => audio.pause()); setRecordingPiece(piece); }}>REC · Înregistrează tema</button>}
                        {piece.score_path && <button type="button" className="btn-ghost justify-self-start" onClick={() => setScore(piece)}>Vezi partitura</button>}
                        <button type="button" className="btn-ghost inline-flex items-center justify-center gap-2 justify-self-start" disabled={!piece.versuri_text} aria-label={`Vezi versuri — ${piece.title}`} onClick={() => setLyrics(piece)}><FileText size={16} aria-hidden="true" /> Vezi versuri</button>
                    </article>)}
                </div>
            )}
            {recordingPiece && <Suspense fallback={<Spinner label="Se încarcă studioul de înregistrare…" />}><RecordingStudio open piece={recordingPiece} onClose={() => setRecordingPiece(null)} /></Suspense>}
            <Modal open={Boolean(lyrics)} title={lyrics?.title || 'Versuri'} onClose={() => setLyrics(null)} wide>
                <div className="max-h-[65vh] overflow-y-auto whitespace-pre-wrap break-words text-base leading-8 text-slate-100" tabIndex={0} aria-label="Versurile piesei">{lyrics?.versuri_text}</div>
            </Modal>
            <Modal open={Boolean(score)} title={score ? `Partitura — ${score.title}` : "Partitură"} onClose={() => setScore(null)} wide>
                {score && <Suspense fallback={<Spinner label="Se încarcă partitura…" />}><SecurePdfViewer path={score.score_path} watermark={profile?.full_name || "Academy Music"} /></Suspense>}
            </Modal>
        </section>
    );
}