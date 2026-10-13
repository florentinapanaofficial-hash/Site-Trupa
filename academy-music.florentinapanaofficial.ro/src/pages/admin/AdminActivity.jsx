import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatDuration } from '../../lib/activity';
import Spinner from '../../components/ui/Spinner';

const RANGES = [
    { value: 7, label: 'Ultimele 7 zile' },
    { value: 30, label: 'Ultimele 30 de zile' },
    { value: 365, label: 'Tot anul' },
];

export default function AdminActivity() {
    const [days, setDays] = useState(30);
    const [data, setData] = useState(null);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        let active = true;
        setData(null);

        async function load() {
            const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

            const [profiles, sessions, events] = await Promise.all([
                supabase.from('profiles').select('id, full_name, role, is_active'),
                supabase
                    .from('activity_sessions')
                    .select('*')
                    .gte('started_at', since)
                    .order('started_at', { ascending: false }),
                supabase
                    .from('activity_events')
                    .select('user_id, event_type, path, created_at')
                    .gte('created_at', since)
                    .order('created_at', { ascending: false })
                    .limit(500),
            ]);

            if (!active) return;
            setData({
                profiles: profiles.data || [],
                sessions: sessions.data || [],
                events: events.data || [],
            });
        }

        load();
        return () => {
            active = false;
        };
    }, [days]);

    const rows = useMemo(() => {
        if (!data) return [];

        const byUser = new Map();
        for (const session of data.sessions) {
            const current = byUser.get(session.user_id) || { count: 0, seconds: 0, last: null };
            current.count += 1;
            current.seconds += session.duration_seconds || 0;
            if (!current.last || session.last_seen_at > current.last) current.last = session.last_seen_at;
            byUser.set(session.user_id, current);
        }

        return data.profiles
            .map((student) => {
                const stats = byUser.get(student.id) || { count: 0, seconds: 0, last: null };
                return { ...student, ...stats };
            })
            .sort((a, b) => b.seconds - a.seconds);
    }, [data]);

    if (!data) return <Spinner label="Se calculează activitatea…" />;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                {RANGES.map((range) => (
                    <button
                        key={range.value}
                        type="button"
                        onClick={() => setDays(range.value)}
                        className={`rounded-xl px-3 py-2 text-sm transition ${days === range.value
                                ? 'bg-gold-500 text-ink-950'
                                : 'border border-white/15 text-slate-400 hover:text-slate-100'
                            }`}
                    >
                        {range.label}
                    </button>
                ))}
            </div>

            <div className="card overflow-x-auto p-0">
                <table className="w-full min-w-[720px] text-sm">
                    <thead className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Elev</th>
                            <th className="px-4 py-3">Rol</th>
                            <th className="px-4 py-3">Sesiuni</th>
                            <th className="px-4 py-3">Timp total</th>
                            <th className="px-4 py-3">Ultima activitate</th>
                            <th className="px-4 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {rows.map((row) => (
                            <tr key={row.id} className={row.seconds === 0 ? 'opacity-60' : ''}>
                                <td className="px-4 py-3 font-medium text-slate-100">{row.full_name || '(fără nume)'}</td>
                                <td className="px-4 py-3 text-slate-400">{row.role === 'teacher' ? 'Profesor' : 'Elev'}</td>
                                <td className="px-4 py-3 text-slate-400">{row.count}</td>
                                <td className="px-4 py-3 text-slate-200">{formatDuration(row.seconds)}</td>
                                <td className="px-4 py-3 text-slate-400">
                                    {row.last ? new Date(row.last).toLocaleString('ro-RO') : '—'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button
                                        type="button"
                                        className="text-xs text-gold-400 hover:text-gold-300"
                                        onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                                    >
                                        {expanded === row.id ? 'Ascunde' : 'Detalii'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {expanded && (
                <div className="card">
                    <h3 className="mb-3 text-sm font-semibold text-white">
                        Sesiuni și pagini — {rows.find((row) => row.id === expanded)?.full_name}
                    </h3>

                    <ul className="space-y-1 text-xs text-slate-400">
                        {data.sessions
                            .filter((session) => session.user_id === expanded)
                            .slice(0, 20)
                            .map((session) => (
                                <li key={session.id} className="flex justify-between gap-3 border-b border-white/5 pb-1">
                                    <span>{new Date(session.started_at).toLocaleString('ro-RO')}</span>
                                    <span>{formatDuration(session.duration_seconds)}</span>
                                </li>
                            ))}
                    </ul>

                    <h4 className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Ultimele acțiuni
                    </h4>
                    <ul className="space-y-1 text-xs text-slate-400">
                        {data.events
                            .filter((event) => event.user_id === expanded)
                            .slice(0, 20)
                            .map((event, index) => (
                                <li key={`${event.created_at}-${index}`} className="flex justify-between gap-3">
                                    <span>
                                        {event.event_type} · {event.path}
                                    </span>
                                    <span>{new Date(event.created_at).toLocaleTimeString('ro-RO')}</span>
                                </li>
                            ))}
                    </ul>
                </div>
            )}

            <p className="text-xs text-slate-500">
                Durata este calculată pe server, din semnalele trimise la fiecare minut cât pagina este
                vizibilă. Fila lăsată în fundal nu mai acumulează timp.
            </p>
        </div>
    );
}
