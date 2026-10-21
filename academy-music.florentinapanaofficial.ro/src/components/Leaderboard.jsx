import { useEffect, useState } from 'react';
import Avatar from './Avatar';
import { gameRpc } from '../lib/games';

export default function Leaderboard() {
    const [rows, setRows] = useState(null);
    const [error, setError] = useState('');
    const [revision, refresh] = useState(0);
    useEffect(() => {
        let active = true;
        setError('');
        gameRpc('game_leaderboard').then(data => { if (active) setRows(data); }).catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [revision]);
    return <section className="card space-y-4" aria-label="Clasament muzical">
        <h2 className="font-display text-2xl text-white">🏆 Podiumul muzicienilor</h2>
        <p className="text-sm text-slate-400">Cel mai bun Joc Ritmic (1000) + cel mai bun duel finalizat, normalizat (1000). Încercările nu se adună. La egalitate, locul este comun. Participarea este opțională.</p>
        <button className="btn-ghost" onClick={() => refresh(x => x + 1)}>Actualizează clasamentul</button>
        {error && <p role="alert" className="text-red-300">{error}</p>}
        {!rows && !error && <p role="status">Se încarcă punctajele…</p>}
        {rows?.length === 0 && <p>Podiumul așteaptă primele rezultate! Activează participarea și finalizează o rundă.</p>}
        {!!rows?.length && <>
            <div className="grid grid-cols-3 items-end gap-2" aria-label="Podium">
                {[1,0,2].map(index => rows[index] && <div key={rows[index].user_id} style={{gridColumn: index === 0 ? 2 : index === 1 ? 1 : 3}} className="flex min-w-0 flex-col items-center gap-2 text-center">
                    <Avatar path={rows[index].avatar_path} name={rows[index].alias} size="lg" />
                    <strong className="max-w-full break-words text-white">{rows[index].alias}</strong>
                    <span>{rows[index].total} pct</span>
                    <div className={'w-full rounded-t-xl bg-brand-500/30 p-2 text-white ' + (index === 0 ? 'min-h-28' : index === 1 ? 'min-h-20' : 'min-h-12')}>Locul {1 + rows.filter(r => r.total > rows[index].total).length}</div>
                </div>)}
            </div>
            <ol className="space-y-2" aria-label="Punctaje">
                {rows.map(row => <li key={row.user_id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 p-3">
                    <span>#{1 + rows.filter(r => r.total > row.total).length}</span><Avatar path={row.avatar_path} name={row.alias} size="sm" />
                    <strong className="break-words">{row.alias}</strong><span className="ml-auto">{row.total} pct</span>
                    <span className="w-full text-xs text-slate-400">Ritm: {row.rhythm} · Duel: {row.quiz}</span>
                </li>)}
            </ol>
        </>}
    </section>;
}
