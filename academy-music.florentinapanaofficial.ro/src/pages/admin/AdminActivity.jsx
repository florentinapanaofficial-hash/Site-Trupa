import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatDuration } from '../../lib/activity';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';

const RANGES = [
    { value: 7, label: 'Ultimele 7 zile' },
    { value: 30, label: 'Ultimele 30 de zile' },
    { value: 365, label: 'Tot anul' },
];

function getDeviceLabel(userAgent) {
    if (!userAgent) return '';

    const browser = /Edg\//.test(userAgent)
        ? 'Edge'
        : /OPR\//.test(userAgent)
            ? 'Opera'
            : /Firefox\//.test(userAgent)
                ? 'Firefox'
                : /Chrome\//.test(userAgent)
                    ? 'Chrome'
                    : /Safari\//.test(userAgent)
                        ? 'Safari'
                        : 'Browser necunoscut';
    const platform = /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad|iPod/.test(userAgent)
            ? 'iOS'
            : /Windows/.test(userAgent)
                ? 'Windows'
                : /Mac OS/.test(userAgent)
                    ? 'macOS'
                    : /Linux/.test(userAgent)
                        ? 'Linux'
                        : '';

    return [browser, platform].filter(Boolean).join(' · ');
}

export default function AdminActivity() {
    const [days, setDays] = useState(30);
    const [data, setData] = useState(null);
    const [expanded, setExpanded] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState(null);
    const [onlineError, setOnlineError] = useState('');
    const [onlineOpen, setOnlineOpen] = useState(false);

    useEffect(() => {
        let active = true;

        async function loadOnlineUsers() {
            const since = new Date(Date.now() - 90_000).toISOString();

            try {
                const { data: sessions, error: sessionsError } = await supabase
                    .from('activity_sessions')
                    .select('id, user_id, started_at, last_seen_at, user_agent')
                    .gte('last_seen_at', since)
                    .order('last_seen_at', { ascending: false });

                if (sessionsError) throw sessionsError;

                const sessionsByUser = new Map();
                for (const session of sessions || []) {
                    const userSessions = sessionsByUser.get(session.user_id) || [];
                    userSessions.push(session);
                    sessionsByUser.set(session.user_id, userSessions);
                }

                const ids = [...sessionsByUser.keys()];
                if (!ids.length) {
                    if (active) {
                        setOnlineUsers([]);
                        setOnlineError('');
                    }
                    return;
                }

                const { data: profiles, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name, role, is_active')
                    .in('id', ids);
                if (profilesError) throw profilesError;

                if (active) {
                    setOnlineUsers((profiles || [])
                        .filter((profile) => profile.is_active)
                        .map((profile) => ({
                            ...profile,
                            activeSessions: sessionsByUser.get(profile.id) || [],
                            activeSessionCount: (sessionsByUser.get(profile.id) || []).length,
                            activeDevices: [...new Set(
                                (sessionsByUser.get(profile.id) || [])
                                    .map((session) => getDeviceLabel(session.user_agent))
                                    .filter(Boolean)
                            )],
                            last_seen_at: sessionsByUser.get(profile.id)?.[0]?.last_seen_at,
                        }))
                        .sort((first, second) => second.last_seen_at.localeCompare(first.last_seen_at)));
                    setOnlineError('');
                }
            } catch {
                if (active) {
                    setOnlineUsers([]);
                    setOnlineError('Lista utilizatorilor activi nu este disponibilă.');
                }
            }
        }

        loadOnlineUsers();
        const timer = window.setInterval(loadOnlineUsers, 15_000);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, []);

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

    const activityAlerts = useMemo(() => {
        if (!data || !onlineUsers) return new Map();

        const cutoff = Date.now() - 90_000;
        const alertsByUser = new Map();

        for (const user of onlineUsers) {
            const alerts = [];
            if (user.activeSessionCount > 1) alerts.push(`${user.activeSessionCount} sesiuni active`);

            const activeSessionIds = new Set(user.activeSessions.map((session) => session.id));
            const previousDevices = new Set(
                data.sessions
                    .filter((session) =>
                        session.user_id === user.id
                        && !activeSessionIds.has(session.id)
                        && new Date(session.last_seen_at).getTime() < cutoff
                    )
                    .map((session) => getDeviceLabel(session.user_agent))
                    .filter(Boolean)
            );
            const newDevices = user.activeDevices.filter((device) => !previousDevices.has(device));
            if (previousDevices.size > 0 && newDevices.length > 0) {
                alerts.push('Browser/platformă nouă în interval');
            }

            if (alerts.length > 0) alertsByUser.set(user.id, alerts);
        }

        return alertsByUser;
    }, [data, onlineUsers]);

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
                <button type="button" className="btn-gold sm:ml-auto" onClick={() => setOnlineOpen(true)}>
                    Conectați acum ({onlineUsers === null ? '…' : onlineUsers.length})
                </button>
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
                                <td className="px-4 py-3 font-medium text-slate-100">
                                    {row.full_name || '(fără nume)'}
                                    {activityAlerts.has(row.id) && (
                                        <span className="mt-1 block text-xs font-normal text-amber-300">
                                            {activityAlerts.get(row.id).join(' · ')}
                                        </span>
                                    )}
                                </td>
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

            <Modal
                open={onlineOpen}
                title="Elevi și profesori conectați"
                onClose={() => setOnlineOpen(false)}
            >
                <p className="mb-4 text-xs text-slate-500">
                    Activitate detectată în ultimele 90 de secunde. Lista se actualizează automat; sesiunile simultane pot însemna și file deschise de același elev.
                </p>
                {onlineError ? (
                    <p role="alert" className="text-sm text-brand-200">{onlineError}</p>
                ) : onlineUsers === null ? (
                    <Spinner label="Se verifică sesiunile…" />
                ) : onlineUsers.length === 0 ? (
                    <p className="text-sm text-slate-400">Niciun utilizator activ în acest moment.</p>
                ) : (
                    <ul className="divide-y divide-white/10">
                        {onlineUsers.map((user) => (
                            <li key={user.id} className="flex items-center justify-between gap-3 py-3">
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-white">
                                        {user.full_name || '(fără nume)'}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        {user.role === 'teacher' ? 'Profesor' : 'Elev'}
                                        {' · '}{user.activeSessionCount} {user.activeSessionCount === 1 ? 'sesiune' : 'sesiuni'}
                                        {user.activeDevices.length > 0 ? ` · ${user.activeDevices.join(', ')}` : ''}
                                    </span>
                                </span>
                                <time className="shrink-0 text-xs text-emerald-300">
                                    {new Date(user.last_seen_at).toLocaleTimeString('ro-RO')}
                                </time>
                            </li>
                        ))}
                    </ul>
                )}
            </Modal>

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
                                    <span>
                                        {new Date(session.started_at).toLocaleString('ro-RO')}
                                        {getDeviceLabel(session.user_agent) ? ` · ${getDeviceLabel(session.user_agent)}` : ''}
                                    </span>
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
