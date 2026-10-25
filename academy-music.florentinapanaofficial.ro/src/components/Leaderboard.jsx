import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Avatar from './Avatar';
import { gameRpc } from '../lib/games';

export default function Leaderboard() {
    const [rows, setRows] = useState(null);
    const [error, setError] = useState('');
    const [expanded, setExpanded] = useState(false);
    const [revision, refresh] = useState(0);
    const year = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', year: 'numeric' }).format(new Date());

    useEffect(() => {
        let active = true;
        setError('');
        gameRpc('game_annual_stars').then(data => { if (active) setRows(data); }).catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [revision]);

    const rankOf = row => 1 + rows.filter(item => item.stars > row.stars).length;

    return <section className="card space-y-4 border-cyan-300/15 bg-ink-900/80" aria-label="Clasament anual cu steluțe">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <h2 className="font-display text-2xl text-white">⭐ Podiumul {year}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">O steluță pentru fiecare răspuns corect la quiz/duel și fiecare notă reușită în jocul ritmic, în anul curent. Clasamentul include doar elevii care și-au dat acordul.</p>
            </div>
            <button type="button" className="btn-ghost min-h-11 px-3" aria-label="Actualizează clasamentul" onClick={() => refresh(x => x + 1)}>Actualizează</button>
        </div>
        {error && <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">Clasamentul nu a putut fi încărcat: {error}</p>}
        {!rows && !error && <p role="status" className="text-sm text-slate-300">Se încarcă steluțele…</p>}
        {rows?.length === 0 && <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-200">Podiumul așteaptă primele steluțe. Participarea este opțională.</p>}
        {!!rows?.length && <>
            <div className="grid grid-cols-3 items-end gap-2" aria-label="Podium">
                {[1, 0, 2].map(index => rows[index] && <div key={rows[index].user_id} style={{ gridColumn: index === 0 ? 2 : index === 1 ? 1 : 3 }} className="flex min-w-0 flex-col items-center gap-2 text-center">
                    <Avatar path={rows[index].avatar_path} name={rows[index].alias} size="lg" />
                    <strong className="max-w-full break-words text-sm text-white sm:text-base">{rows[index].alias}</strong>
                    <span className="font-semibold text-cyan-100">⭐ {rows[index].stars}</span>
                    <div className={`w-full rounded-t-xl border-t border-cyan-200/30 bg-gradient-to-b from-cyan-300/25 to-violet-500/10 p-2 text-white shadow-[0_0_20px_rgba(34,211,238,0.08)] ${index === 0 ? 'min-h-24' : index === 1 ? 'min-h-16' : 'min-h-12'}`}>Locul {rankOf(rows[index])}</div>
                </div>)}
            </div>
            {rows.length > 3 && <div className="space-y-3">
                <button type="button" className="btn-ghost min-h-12 w-full justify-between border-cyan-300/20 text-cyan-100 hover:border-cyan-300/50" aria-expanded={expanded} aria-controls="annual-stars-runners-up" onClick={() => setExpanded(value => !value)}>
                    <span>{expanded ? 'Ascunde clasamentul extins' : 'Cine vine din urmă'}</span>{expanded ? <ChevronUp size={19} aria-hidden="true" /> : <ChevronDown size={19} aria-hidden="true" />}
                </button>
                {expanded && <ol id="annual-stars-runners-up" className="space-y-2" aria-label="Elevii care vin din urmă">
                    {rows.slice(3).map(row => <li key={row.user_id} className="flex min-h-14 flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                        <span className="w-8 text-sm font-bold text-violet-200">#{rankOf(row)}</span><Avatar path={row.avatar_path} name={row.alias} size="sm" />
                        <strong className="min-w-0 flex-1 break-words text-sm text-white">{row.alias}</strong><span className="text-sm font-semibold text-cyan-100">⭐ {row.stars}</span>
                    </li>)}
                </ol>}
            </div>}
        </>}
    </section>;
}
