import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { logEvent } from '../lib/activity';
import TeacherModeToggle from './TeacherModeToggle';

const STUDENT_LINKS = [
    { to: '/', label: 'Acasă', icon: '🏠', end: true },
    { to: '/repertoriul-meu', label: 'Repertoriul meu', icon: '🎼' },
    { to: '/red', label: 'RED', icon: '📚' },
    { to: '/jocuri', label: 'Jocuri', icon: '🧩' },
    { to: '/portofoliu', label: 'Portofoliu', icon: '📁' },
    { to: '/cursuri-online/', label: 'Cursuri online / grupe de elevi' },
    { to: '/orga/', label: 'Orgă' },
    { to: '/canto/', label: 'Canto' },
];

function initials(name, email) {
    const source = (name || email || '?').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
}

export default function Layout() {
    const { profile, user, isTeacher, isInspector, signOut } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        setMenuOpen(false);
        logEvent(profile?.id, 'page_view', location.pathname);
    }, [location.pathname, profile?.id]);

    async function handleSignOut() {
        await signOut();
        navigate('/login', { replace: true });
    }

    const linkClass = ({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive
            ? 'bg-brand-500/15 text-white ring-1 ring-brand-400/40'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
        }`;

    return (
        <div className="min-h-screen lg:flex">
            <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-ink-900/60 p-4 lg:block">
                <Brand />
                <nav className="mt-6 space-y-1">
                    <a href="/revista/" className="block px-3 py-2.5 text-sm font-medium text-gold-400">Revista</a>
                    <a href="/studio/" className="block px-3 py-2.5 text-sm font-medium text-gold-400">Studio</a>
                    {STUDENT_LINKS.map((link) => (
                        <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                            <span aria-hidden="true">{link.icon}</span>
                            {link.label}
                        </NavLink>
                    ))}
                    {isTeacher && (
                        <>
                            <NavLink to="/admin" className={linkClass}>
                                <span aria-hidden="true">⚙️</span>
                                Panou profesor
                            </NavLink>
                        </>
                    )}
                </nav>

                {isTeacher && (
                    <div className="mt-6 rounded-xl border border-gold-500/25 bg-gold-500/5 p-3">
                        <TeacherModeToggle />
                    </div>
                )}
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/10 bg-ink-950/90 px-4 py-3 backdrop-blur">
                    <div className="lg:hidden">
                        <Brand compact />
                    </div>

                    <div className="ml-auto flex items-center gap-3">
                        <div className="hidden text-right sm:block">
                            <p className="text-sm font-semibold text-slate-100">
                                {profile?.full_name || user?.email}
                            </p>
                            <p className="text-xs text-slate-500">
                                {isTeacher ? 'Profesor' : isInspector ? 'Inspector' : 'Elev'} · Palatul Copiilor Pitești
                            </p>
                        </div>
                        <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-500/20 text-sm font-bold text-brand-200">
                            {initials(profile?.full_name, user?.email)}
                        </span>
                        <button type="button" className="btn-ghost px-3 py-2" onClick={handleSignOut}>
                            Ieșire
                        </button>
                        <button
                            type="button"
                            className="btn-ghost px-3 py-2 lg:hidden"
                            onClick={() => setMenuOpen((open) => !open)}
                            aria-expanded={menuOpen}
                            aria-label="Meniu"
                        >
                            ☰
                        </button>
                    </div>
                </header>

                {menuOpen && (
                    <nav className="space-y-1 border-b border-white/10 bg-ink-900 p-4 lg:hidden">
                        <a href="/revista/" className="block px-3 py-2.5 text-sm font-medium text-gold-400">Revista</a>
                        <a href="/studio/" className="block px-3 py-2.5 text-sm font-medium text-gold-400">Studio</a>
                        {STUDENT_LINKS.map((link) => (
                            <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                                <span aria-hidden="true">{link.icon}</span>
                                {link.label}
                            </NavLink>
                        ))}
                        {isTeacher && (
                            <>
                                <NavLink to="/admin" className={linkClass}>
                                    <span aria-hidden="true">⚙️</span>
                                    Panou profesor
                                </NavLink>
                                <div className="mt-3 rounded-xl border border-gold-500/25 bg-gold-500/5 p-3">
                                    <TeacherModeToggle />
                                </div>
                            </>
                        )}
                    </nav>
                )}

                <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
                    <Outlet />
                </main>

                <footer className="border-t border-white/10 px-4 py-5 text-center text-xs text-slate-500">
                    Academy Music · Florentina Pană · Palatul Copiilor Pitești — materialele sunt protejate
                    prin drept de autor și destinate exclusiv elevilor înscriși.
                </footer>
            </div>
        </div>
    );
}

function Brand({ compact = false }) {
    return (
        <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-gold-500 text-lg">
                🎵
            </span>
            <div>
                <p className="font-display text-lg leading-tight text-white">Academy Music</p>
                {!compact && <p className="text-xs text-slate-500">Palatul Copiilor Pitești</p>}
            </div>
        </div>
    );
}
