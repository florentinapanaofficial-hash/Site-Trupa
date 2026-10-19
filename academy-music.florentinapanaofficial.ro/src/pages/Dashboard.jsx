import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatDuration } from '../lib/activity';
import { useMyRepertoire } from '../lib/useMyRepertoire';
import DualAudioRow from '../components/DualAudioRow';
import RecordingStudio from '../components/RecordingStudio';
import Spinner from '../components/ui/Spinner';

const SHORTCUTS = [
    {
        to: '/repertoriul-meu',
        icon: '🎼',
        title: 'Repertoriul meu',
        text: 'Piesele primite de la profesor, cu negativ și pozitiv.',
        accent: 'from-brand-500/20 to-transparent',
    },
    {
        to: '/red',
        icon: '📚',
        title: 'RED',
        text: 'Resurse Educaționale Deschise: fișe și exerciții.',
        accent: 'from-sky-500/20 to-transparent',
    },
    {
        to: '/jocuri',
        icon: '🧩',
        title: 'Jocuri muzicale',
        text: 'Rebus și quiz de teorie, cu scor salvat.',
        accent: 'from-emerald-500/20 to-transparent',
    },
    {
        to: '/portofoliu',
        icon: '📁',
        title: 'Portofoliu',
        text: 'Temele trimise și feedbackul primit.',
        accent: 'from-gold-500/20 to-transparent',
    },
];

const DASHBOARD_PREVIEW = 3;

export default function Dashboard() {
    const { profile, isTeacher, isInspector } = useAuth();
    const [stats, setStats] = useState(null);
    const [studioPiece, setStudioPiece] = useState(null);
    const { rows: myPieces, reload: loadMyPieces } = useMyRepertoire();

    useEffect(() => {
        let active = true;

        async function load() {
            const [pieces, submissions, quiz, sessions] = await Promise.all([
                supabase.from('pieces').select('id', { count: 'exact', head: true }),
                supabase
                    .from('submissions')
                    .select('id, status, grade', { count: 'exact' })
                    .eq('student_id', profile.id),
                supabase
                    .from('quiz_results')
                    .select('score, total, created_at')
                    .eq('user_id', profile.id)
                    .order('created_at', { ascending: false })
                    .limit(1),
                supabase.from('activity_sessions').select('duration_seconds').eq('user_id', profile.id),
            ]);

            if (!active) return;

            const totalSeconds = (sessions.data || []).reduce(
                (sum, row) => sum + (row.duration_seconds || 0),
                0
            );
            const graded = (submissions.data || []).filter((row) => row.grade != null);
            const average = graded.length
                ? (graded.reduce((sum, row) => sum + row.grade, 0) / graded.length).toFixed(1)
                : null;

            setStats({
                pieces: pieces.count ?? 0,
                submissions: submissions.count ?? 0,
                lastQuiz: quiz.data?.[0] ?? null,
                totalSeconds,
                average,
            });
        }

        if (profile?.id) load();
        return () => {
            active = false;
        };
    }, [profile?.id]);

    const firstName = (profile?.full_name || '').split(' ')[0] || 'elev';

    return (
        <div className="space-y-6">
            <section className="card bg-gradient-to-br from-brand-900/40 to-ink-900">
                <p className="text-xs uppercase tracking-widest text-gold-400">Bine ai venit</p>
                <h1 className="mt-1 font-display text-3xl text-white">Salut, {firstName}!</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                    Toate materialele de curs — negative, partituri, fișe și teme — sunt aici. Ascultă,
                    exersează, apoi încarcă tema în portofoliu ca să primească feedback.
                </p>
                {isTeacher && (
                    <Link to="/admin" className="btn-gold mt-4 inline-flex">
                        Deschide panoul de profesor
                    </Link>
                )}
            </section>

            {!stats ? (
                <Spinner />
            ) : (
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard label="Piese în repertoriu" value={stats.pieces} icon="🎼" />
                    <StatCard label="Teme trimise" value={stats.submissions} icon="📤" />
                    <StatCard
                        label="Media notelor"
                        value={stats.average ?? '—'}
                        icon="⭐"
                    />
                    <StatCard label="Timp pe platformă" value={formatDuration(stats.totalSeconds)} icon="⏱️" />
                </section>
            )}

            {myPieces !== null && myPieces.length > 0 && (
                <section className="space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                            <h2 className="font-display text-2xl text-white">Piesele mele de studiu</h2>
                            <p className="text-sm text-slate-500">
                                Biblioteca comună de studiu. Exersează pe negativ, apoi
                                înregistrează-ți tema direct din platformă.
                            </p>
                        </div>
                        {myPieces.length > DASHBOARD_PREVIEW && (
                            <Link to="/repertoriul-meu" className="btn-ghost px-3 py-1.5 text-xs">
                                Vezi toate cele {myPieces.length}
                            </Link>
                        )}
                    </div>

                    {myPieces.slice(0, DASHBOARD_PREVIEW).map((row, index) => (
                        <DualAudioRow
                            key={row.piece_id}
                            index={index}
                            piece={row.pieces}
                            actions={
                                !isInspector && <button
                                    type="button"
                                    className="btn-gold shrink-0 px-3 py-1.5 text-xs"
                                    onClick={() => setStudioPiece(row.pieces)}
                                >
                                    ● Înregistrează tema
                                </button>
                            }
                        />
                    ))}
                </section>
            )}

            <section className="grid gap-4 sm:grid-cols-2">
                {SHORTCUTS.map((item) => (
                    <Link
                        key={item.to}
                        to={item.to}
                        className={`card bg-gradient-to-br ${item.accent} transition hover:-translate-y-0.5 hover:border-white/25`}
                    >
                        <span className="text-3xl" aria-hidden="true">
                            {item.icon}
                        </span>
                        <h2 className="mt-3 text-lg font-semibold text-white">{item.title}</h2>
                        <p className="mt-1 text-sm text-slate-400">{item.text}</p>
                    </Link>
                ))}
            </section>

            {stats?.lastQuiz && (
                <section className="card">
                    <h2 className="text-lg font-semibold">Ultimul quiz</h2>
                    <p className="mt-1 text-sm text-slate-400">
                        Scor {stats.lastQuiz.score} din {stats.lastQuiz.total}, pe{' '}
                        {new Date(stats.lastQuiz.created_at).toLocaleDateString('ro-RO')}.
                    </p>
                    <Link to="/jocuri" className="btn-ghost mt-3 inline-flex">
                        Mai încearcă o dată
                    </Link>
                </section>
            )}

            <RecordingStudio
                open={Boolean(studioPiece)}
                piece={studioPiece}
                onClose={() => setStudioPiece(null)}
                onSubmitted={loadMyPieces}
            />
        </div>
    );
}

function StatCard({ label, value, icon }) {
    return (
        <div className="card">
            <span className="text-xl" aria-hidden="true">
                {icon}
            </span>
            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
        </div>
    );
}
