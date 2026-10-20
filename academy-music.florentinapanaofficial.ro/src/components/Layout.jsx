import { Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Home, Mic2, Piano, Music2, Library, Puzzle, FolderOpen, Users, Settings, Menu } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { logEvent } from '../lib/activity';
import { useTeacherMode } from '../lib/useTeacherMode';
import TeacherModeToggle from './TeacherModeToggle';
import Spinner from './ui/Spinner';
import Avatar from './Avatar';
import LivePresence from './LivePresence';

const SHARED_LINKS = [
    { to: '/red/', label: 'Resurse de teorie', Icon: Library },
    { to: '/jocuri/', label: 'Jocuri muzicale', Icon: Puzzle },
    { to: '/portofoliu/', label: 'Portofoliu', Icon: FolderOpen },
    { to: '/cursuri-online/', label: 'Cursuri online', Icon: Users },
];

export default function Layout() {
    const { profile, user, isTeacher, isInspector, signOut } = useAuth();
    const [teacherMode] = useTeacherMode();
    const location = useLocation();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [signOutError, setSignOutError] = useState('');
    const path = location.pathname;
    const isCanto = path === '/canto' || path.startsWith('/canto/');
    const isInstrument = path === '/instrument' || path.startsWith('/instrument/');
    const isSelection = path.replace(/\/$/, '') === '/dashboard';

    useLayoutEffect(() => { setMenuOpen(false); }, [path]);
    useEffect(() => {
        logEvent(profile?.id, 'page_view', path);
    }, [path, profile?.id]);
    useEffect(() => {
        if (!menuOpen) return undefined;
        function closeOnEscape(event) { if (event.key === 'Escape') setMenuOpen(false); }
        document.addEventListener('keydown', closeOnEscape);
        return () => document.removeEventListener('keydown', closeOnEscape);
    }, [menuOpen]);

    async function handleSignOut() {
        setSignOutError('');
        try {
            await signOut();
            navigate('/login/', { replace: true });
        } catch (error) {
            console.error('[Academy] Deconectarea a eșuat:', error.message);
            setSignOutError('Nu am putut încheia sesiunea. Încearcă din nou.');
        }
    }

    const linkClass = ({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive
        ? 'bg-brand-500/15 text-white ring-1 ring-brand-400/40'
        : 'text-slate-300 hover:bg-white/5 hover:text-white'}`;

    function navigation(mobile = false) {
        const links = isCanto ? [{ to: '/canto/', label: 'Biblioteca Canto', Icon: Mic2 }]
            : isInstrument ? [
                { to: '/instrument/', label: 'Repertoriu și partituri', Icon: Music2, end: true },
                { to: '/instrument/claviatura/', label: 'Claviatură virtuală', Icon: Piano },
            ] : [];
        return <>
            <nav aria-label={mobile ? 'Navigare mobilă' : 'Navigare principală'} className="mt-6 space-y-1">
                <NavLink to="/dashboard/" end className={linkClass}><Home size={19} aria-hidden="true" />Alege disciplina</NavLink>
                {links.length > 0 && <div className="py-3">
                    <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-gold-300">{isCanto ? 'Canto' : 'Instrument-Orgă'}</p>
                    {links.map(({ to, label, Icon, end }) => <NavLink key={to} to={to} end={end} className={linkClass}><Icon size={19} aria-hidden="true" />{label}</NavLink>)}
                </div>}
                {!isSelection && <div className="border-t border-white/10 pt-3">
                    {SHARED_LINKS.map(({ to, label, Icon }) => <NavLink key={to} to={to} className={linkClass}><Icon size={19} aria-hidden="true" />{label}</NavLink>)}
                    {!isCanto && !isInstrument && <NavLink to="/repertoriul-meu/" className={linkClass}><Music2 size={19} aria-hidden="true" />Repertoriul meu</NavLink>}
                </div>}
                {isTeacher && teacherMode && <NavLink to="/admin/" className={linkClass}><Settings size={19} aria-hidden="true" />Panou profesor</NavLink>}
                <a href="https://revista.florentinapanaofficial.ro/" target="_blank" rel="noopener noreferrer" className="mt-5 flex min-h-12 items-center gap-3 rounded-xl border border-gold-400/30 bg-gold-400/10 px-3 py-3 text-sm font-bold tracking-wider text-gold-300 transition hover:bg-gold-400/20"><BookOpen size={22} aria-hidden="true" />REVISTA<span className="sr-only"> (se deschide într-un tab nou)</span></a>
            </nav>
            {isTeacher && <div className="mt-6 rounded-xl border border-gold-500/25 bg-gold-500/5 p-3"><TeacherModeToggle /></div>}
        </>;
    }

    return (
        <div className="min-h-screen lg:flex lg:items-start">
            <aside aria-label="Meniu lateral" className="sticky top-0 hidden h-screen w-64 shrink-0 self-start overflow-y-auto border-r border-white/10 bg-ink-900/60 p-4 lg:block">
                <Brand />
                {navigation()}
            </aside>
            <div className="flex min-w-0 flex-1 flex-col self-stretch">
                <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-950/95 backdrop-blur">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="lg:hidden"><Brand compact /></div>
                        <div className="ml-auto flex items-center gap-3">
                            <div className="hidden text-right sm:block"><p className="text-sm font-semibold text-slate-100">{profile?.full_name || user?.email}</p><p className="text-xs text-slate-400">{isTeacher ? 'Profesor' : isInspector ? 'Inspector' : 'Elev'} · Palatul Copiilor Pitești</p></div>
                            <Avatar path={profile?.avatar_path} name={profile?.full_name || user?.email} size="sm" className="hidden sm:inline-grid" />
                            <button type="button" className="btn-ghost px-3 py-2" onClick={handleSignOut}>Ieșire</button>
                            <button type="button" className="btn-ghost px-3 py-2 lg:hidden" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="academy-mobile-menu" aria-label="Meniu"><Menu size={22} aria-hidden="true" /></button>
                        </div>
                    </div>
                    {menuOpen && <div id="academy-mobile-menu" className="max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-white/10 bg-ink-900 px-4 pb-5 lg:hidden">{navigation(true)}</div>}
                </header>
                {signOutError && <p role="alert" className="mx-4 mt-4 rounded-xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">{signOutError}</p>}
                <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 sm:p-6 xl:flex-row">
                    <main className="min-w-0 flex-1">
                        <Suspense fallback={<Spinner label="Se încarcă disciplina…" />}><Outlet /></Suspense>
                    </main>
                    <aside className="w-full shrink-0 xl:w-64"><LivePresence profile={profile} /></aside>
                </div>
                <footer className="border-t border-white/10 px-4 py-5 text-center text-xs text-slate-400">Academy Music · Florentina Pană · Palatul Copiilor Pitești — materialele sunt protejate prin drept de autor și destinate exclusiv elevilor înscriși.</footer>
            </div>
        </div>
    );
}

function Brand({ compact = false }) {
    return <div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-gold-500 text-lg">♫</span><div><p className="font-display text-base leading-tight text-white sm:text-lg">Academy Music</p>{!compact && <p className="text-xs text-slate-400">Palatul Copiilor Pitești</p>}</div></div>;
}
