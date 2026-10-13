import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Spinner from '../../components/ui/Spinner';

export default function AdminOverview() {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        let active = true;

        async function load() {
            const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

            const [students, pieces, resources, pending, weekSessions] = await Promise.all([
                supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
                supabase.from('pieces').select('id', { count: 'exact', head: true }),
                supabase.from('resources').select('id', { count: 'exact', head: true }),
                supabase
                    .from('submissions')
                    .select('id', { count: 'exact', head: true })
                    .neq('status', 'notat'),
                supabase.from('activity_sessions').select('user_id').gte('started_at', since),
            ]);

            if (!active) return;

            setStats({
                students: students.count ?? 0,
                pieces: pieces.count ?? 0,
                resources: resources.count ?? 0,
                pending: pending.count ?? 0,
                activeThisWeek: new Set((weekSessions.data || []).map((row) => row.user_id)).size,
            });
        }

        load();
        return () => {
            active = false;
        };
    }, []);

    if (!stats) return <Spinner />;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Stat label="Elevi înregistrați" value={stats.students} icon="🧒" />
                <Stat label="Piese în repertoriu" value={stats.pieces} icon="🎼" />
                <Stat label="Resurse RED" value={stats.resources} icon="📚" />
                <Stat label="Teme de corectat" value={stats.pending} icon="📝" highlight={stats.pending > 0} />
                <Stat label="Activi ultimele 7 zile" value={stats.activeThisWeek} icon="🔥" />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <QuickLink to="/admin/piese" icon="➕" title="Adaugă o piesă" text="Negativ, pozitiv și partitură." />
                <QuickLink to="/admin/teme" icon="⭐" title="Notează temele" text="Vezi înregistrările elevilor." />
                <QuickLink
                    to="/admin/activitate"
                    icon="📊"
                    title="Monitorizare"
                    text="Cine s-a logat și cât a stat."
                />
            </div>
        </div>
    );
}

function Stat({ label, value, icon, highlight = false }) {
    return (
        <div className={`card ${highlight ? 'border-gold-500/40' : ''}`}>
            <span className="text-xl" aria-hidden="true">
                {icon}
            </span>
            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
        </div>
    );
}

function QuickLink({ to, icon, title, text }) {
    return (
        <Link to={to} className="card transition hover:-translate-y-0.5 hover:border-white/25">
            <span className="text-2xl" aria-hidden="true">
                {icon}
            </span>
            <h3 className="mt-2 font-semibold text-white">{title}</h3>
            <p className="text-sm text-slate-400">{text}</p>
        </Link>
    );
}
