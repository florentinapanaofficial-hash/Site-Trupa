import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useTeacherMode } from '../lib/useTeacherMode';
import { useStudyProgress } from '../lib/useStudyProgress';
import { isStudyLevelLocked, STUDY_LEVELS, studyLevelLabel } from '../lib/studyLevels';
import { parseStudioMidi } from '../lib/interactiveStudio';
import SecurePdfViewer from '../components/SecurePdfViewer';
import ScoreEditor from '../components/ScoreEditor';
import InteractiveStudio from '../components/InteractiveStudio';
import StudyProgressNotice from '../components/StudyProgressNotice';
import Spinner from '../components/ui/Spinner';

const PAGE_SIZE = 12;

function ScoreWorkspace({ piece, watermark }) {
    const [demo, setDemo] = useState(null);
    const [error, setError] = useState('');
    const revision = useRef(0);
    const resetDemo = useCallback(() => { setDemo(null); setError(''); }, []);
    function prepareDemo(bytes) {
        try {
            parseStudioMidi(bytes);
            setDemo({ bytes, name: piece.title + ' — compoziția mea', revision: ++revision.current });
            setError('');
        } catch (failure) { setDemo(null); setError(failure.message || 'Compoziția nu poate fi redată ca demo MIDI.'); }
    }
    return <section className="min-w-0 space-y-6" aria-label="Tema mea din partitură">
        <header className="space-y-2"><h2 className="text-2xl text-white">Tema aleasă: {piece.title}</h2>
            <p className="text-sm text-slate-300">Citește PDF-ul de sus și scrie notele pe portativul de jos. Exportă MIDI sau apasă „Studiază pe claviatură”, apoi „Pornește studiul”. Demo-ul este creat din notele tale, nu automat din PDF.</p>
            <p className="text-xs text-slate-400">Compoziția rămâne în această pagină până schimbi tema sau închizi pagina. Exportă MIDI pentru a o păstra; îl poți reîncărca ulterior în studio.</p>
        </header>
        <section className="min-w-0 rounded-xl border border-white/10 p-3" aria-label="Partitura de referință"><SecurePdfViewer path={piece.score_path} watermark={watermark} /></section>
        <ScoreEditor onMidiReady={prepareDemo} onCompositionChange={resetDemo} />
        {error && <p role="alert" className="text-sm text-brand-200">{error}</p>}
        {demo && <section className="min-w-0 space-y-3" aria-label="Demo-ul compoziției mele">
            <h2 className="text-2xl text-white">Studiază alături de propriul demo</h2>
            <p className="text-sm text-slate-300">Claviatura profesorului arată și redă MIDI-ul tău. Cântă simultan pe claviatura elevului cu mouse/touch, tastele calculatorului sau un dispozitiv MIDI. Poți reduce viteza și repeta un fragment A–B. Modificarea notelor cere pregătirea unui demo nou.</p>
            <InteractiveStudio key={demo.revision} initialMidi={demo} />
        </section>}
    </section>;
}

export default function ScoreLibrary() {
    const { profile, isTeacher: teacherRole } = useAuth();
    const [teacherMode] = useTeacherMode();
    const teacher = teacherRole && teacherMode;
    const progress = useStudyProgress(profile, !teacher);
    const [params, setParams] = useSearchParams();
    const selectedId = params.get('piece') || '';
    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [level, setLevel] = useState('');
    const [page, setPage] = useState(0);
    const [library, setLibrary] = useState({ loading: true, rows: [], count: 0, error: '' });
    const [selection, setSelection] = useState(null);
    const [reload, setReload] = useState(0);
    useEffect(() => {
        let cancelled = false;
        setLibrary(previous => ({ ...previous, loading: true, error: '' }));
        let request = supabase.from('pieces').select('id,title,composer,level,score_path', { count: 'exact' }).eq('discipline', 'orga').not('score_path', 'is', null).neq('score_path', '').order('title').order('id').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (!teacher) request = request.eq('is_published', true);
        if (level) request = request.eq('level', level);
        if (query) request = request.ilike('title', '%' + query.replace(/[\\%_]/g, '\\$&') + '%');
        request.then(({ data, error, count }) => {
            if (cancelled) return;
            if (error) console.error('[Academy] Biblioteca de partituri:', error.message);
            setLibrary({ loading: false, rows: error ? [] : data || [], count: count || 0, error: error ? 'Biblioteca de partituri nu a putut fi încărcată.' : '' });
        });
        return () => { cancelled = true; };
    }, [teacher, page, query, level, reload]);
    useEffect(() => {
        let cancelled = false;
        setSelection(null);
        if (!selectedId) return;
        let request = supabase.from('pieces').select('id,title,level,score_path').eq('id', selectedId).eq('discipline', 'orga');
        if (!teacher) request = request.eq('is_published', true);
        request.maybeSingle().then(({ data, error }) => {
            if (cancelled) return;
            if (error) console.error('[Academy] Selectarea partiturii:', error.message);
            setSelection({ id: selectedId, piece: data, error: error ? 'Tema nu a putut fi încărcată.' : !data?.score_path ? 'Partitura nu este disponibilă sau nu ai acces la ea.' : '' });
        });
        return () => { cancelled = true; };
    }, [selectedId, teacher, reload]);
    const locked = selection?.piece && !teacher && isStudyLevelLocked(selection.piece.level, progress.progress.unlockedLevels);
    return <div className="min-w-0 space-y-6">
        <header className="card space-y-3"><h1 className="font-display text-3xl text-white">Biblioteca de partituri · Orgă</h1>
            <p className="text-sm text-slate-300">Alege o partitură PDF încărcată de profesor și creează propriul demo MIDI în studioul de scris note.</p>
            <div className="flex flex-wrap gap-3"><Link className="btn-ghost" to="/instrument/">Repertoriu Orgă</Link>{teacher && <Link className="btn-gold" to="/admin/piese/?add=orga">Încarcă partitură PDF</Link>}</div>
        </header>
        {!teacher && <StudyProgressNotice state={progress} />}
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(0); }}>
            <label className="min-w-0 flex-1 text-sm text-slate-300">Caută partitură<input className="input mt-1" type="search" maxLength={120} value={search} onChange={event => setSearch(event.target.value)} /></label>
            <label className="text-sm text-slate-300">Nivel partitură<select className="input mt-1" value={level} onChange={event => { setLevel(event.target.value); setPage(0); }}><option value="">Toate nivelurile</option>{STUDY_LEVELS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <button className="btn-gold" type="submit">Caută</button>
        </form>
        {library.loading ? <Spinner label="Se încarcă partiturile…" /> : library.error ? <div role="alert" className="space-y-2 text-brand-200"><p>{library.error}</p><button className="btn-ghost" type="button" onClick={() => setReload(value => value + 1)}>Reîncearcă</button></div> : <>
            {!library.rows.length && <p role="status" className="text-slate-300">Nu sunt partituri pentru filtrele alese. Profesorul poate adăuga PDF-uri din administrarea pieselor de Orgă.</p>}
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">{library.rows.map(piece => {
                const restricted = !teacher && isStudyLevelLocked(piece.level, progress.progress.unlockedLevels);
                return <article key={piece.id} className="card min-w-0 space-y-3"><h2 className="break-words text-lg text-white">{piece.title}</h2><p className="text-sm text-slate-300">{piece.composer} · {studyLevelLabel(piece.level)}</p><button type="button" className="btn-gold" disabled={restricted} aria-pressed={selectedId === String(piece.id)} onClick={() => setParams({ piece: String(piece.id) })}>{restricted ? 'Nivel încă blocat' : 'Alege tema — ' + piece.title}</button></article>;
            })}</div>
            <nav className="flex flex-wrap items-center gap-3" aria-label="Pagini partituri"><button className="btn-ghost" type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Pagina precedentă</button><span className="text-sm text-slate-300">Pagina {page + 1} din {Math.max(1, Math.ceil(library.count / PAGE_SIZE))}</span><button className="btn-ghost" type="button" disabled={(page + 1) * PAGE_SIZE >= library.count} onClick={() => setPage(value => value + 1)}>Pagina următoare</button></nav>
        </>}
        {selectedId && (selection?.id !== selectedId ? <Spinner label="Se încarcă tema…" /> : selection.error ? <p role="alert" className="text-brand-200">{selection.error}</p> : locked ? <p role="status" className="text-gold-300">Partitura aparține unui nivel încă blocat pentru contul tău.</p> : <ScoreWorkspace key={selectedId} piece={selection.piece} watermark={profile?.full_name || ''} />)}
    </div>;
}
