import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function HomeworkCatalog({ studentId, refreshKey = 0 }) {
    const [page, setPage] = useState(0);
    const [revision, setRevision] = useState(0);
    const [state, setState] = useState({ rows: [], loading: true, error: '', hasNext: false });

    useEffect(() => {
        let active = true;
        setState({ rows: [], loading: true, error: '', hasNext: false });
        async function load() {
            try {
                let query = supabase.from('catalog_teme').select('id,student_id,student_name,created_at,drive_url,midi_url,title,student_note').order('created_at', { ascending: false }).order('id', { ascending: false }).range(page * 20, page * 20 + 20);
                if (studentId) query = query.eq('student_id', studentId);
                const { data, error } = await query;
                if (error) throw error;
                if (active) setState({ rows: (data || []).slice(0, 20), loading: false, error: '', hasNext: data?.length > 20 });
            } catch {
                if (active) setState({ rows: [], loading: false, error: 'Catalogul temelor nu este disponibil.', hasNext: false });
            }
        }
        void load();
        return () => { active = false; };
    }, [studentId, refreshKey, page, revision]);

    const controlClass = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/20 text-white hover:border-gold-400 disabled:opacity-40';
    return <section className="min-w-0 space-y-3 border-t border-white/10 pt-6" aria-label="Teme Google Drive">
        <header className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-white">Teme Google Drive</h2>
            <button type="button" className={controlClass} title="Reîmprospătează catalogul" aria-label="Reîmprospătează catalogul" disabled={state.loading} onClick={() => setRevision((current) => current + 1)}><RefreshCw size={18} /></button>
        </header>
        {state.loading && <p role="status" className="text-sm text-slate-400">Se încarcă…</p>}
        {state.error && <p role="alert" className="text-sm text-brand-200">{state.error}</p>}
        {!state.loading && !state.error && !state.rows.length && <p className="text-sm text-slate-400">Nicio temă pe această pagină.</p>}
        <ul className="divide-y divide-white/10">{state.rows.map((row) => <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0 flex-1 basis-48 break-words">
                <h3 className="font-semibold text-white">{row.title || 'Temă muzicală'}</h3>
                <p className="text-sm text-slate-300">{row.student_name || row.student_id}</p>
                <time dateTime={row.created_at} className="text-xs text-slate-400">{new Date(row.created_at).toLocaleString('ro-RO')}</time>
                {row.student_note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{row.student_note}</p>}
            </div>
            {typeof row.drive_url === 'string' && /^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+\/view(?:\?[^\s]*)?$/.test(row.drive_url) && <a href={row.drive_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 text-sm text-gold-300"><ExternalLink size={17} />Deschide în Drive</a>}
            {typeof row.midi_url === 'string' && /^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+\/view(?:\?[^\s]*)?$/.test(row.midi_url) && <a href={row.midi_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 text-sm text-gold-300"><ExternalLink size={17} />Deschide MIDI</a>}
        </li>)}</ul>
        <nav className="flex items-center justify-end gap-3" aria-label="Pagini catalog teme">
            <button type="button" className={controlClass} title="Pagina anterioară" aria-label="Pagina anterioară" disabled={state.loading || page === 0} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={18} /></button>
            <span className="text-sm text-slate-400">{page + 1}</span>
            <button type="button" className={controlClass} title="Pagina următoare" aria-label="Pagina următoare" disabled={state.loading || !state.hasNext} onClick={() => setPage((current) => current + 1)}><ChevronRight size={18} /></button>
        </nav>
    </section>;
}