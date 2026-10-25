import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Home, Mic2, Piano, Music2, Library, Puzzle, FolderOpen, Users, Settings, Menu, UserRound, Trophy, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { logEvent } from '../lib/activity';
import { useTeacherMode } from '../lib/useTeacherMode';
import TeacherModeToggle from './TeacherModeToggle';
import Spinner from './ui/Spinner';
import Avatar from './Avatar';
import LivePresence from './LivePresence';
import DuelInvitations from './DuelInvitations';

const Leaderboard = lazy(() => import('./Leaderboard'));

const APPLICATION_LINKS = [
    { to: '/dashboard/', label: 'Alege disciplina', Icon: Home, end: true },
    { to: '/canto/', label: 'Biblioteca Canto', Icon: Mic2 },
    { to: '/instrument/', label: 'Instrument-Orgă', Icon: Piano },
    { to: '/instrument/partituri/', label: 'Biblioteca de partituri', Icon: Music2 },
    { to: '/instrument/claviatura/', label: 'Claviatură virtuală', Icon: Piano },
    { to: '/jocuri/', label: 'Jocuri muzicale', Icon: Puzzle },
    { to: '/red/', label: 'Resurse de teorie', Icon: Library },
    { to: '/portofoliu/', label: 'Portofoliu', Icon: FolderOpen },
    { to: '/cursuri-online/', label: 'Cursuri online', Icon: Users },
    { to: '/profil/', label: 'Profilul meu', Icon: UserRound },
];

export default function Layout() {
    const { profile, user, isTeacher, isInspector, signOut } = useAuth();
    const [teacherMode] = useTeacherMode();
    const location = useLocation();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [podiumOpen, setPodiumOpen] = useState(false);
    const [studioNotice, setStudioNotice] = useState(null);
    const [studioNoticeError, setStudioNoticeError] = useState('');
    const [studioNoticeBusy, setStudioNoticeBusy] = useState(false);
    const [signOutError, setSignOutError] = useState('');
    const loadStudioNotice = useCallback(async () => {
        if (!profile?.id || isTeacher || isInspector) {
            setStudioNotice(null);
            return;
        }
        setStudioNoticeError('');
        const { data, error } = await supabase
            .from('studio_requests')
            .select('id')
            .eq('student_id', profile.id)
            .eq('status', 'completed')
            .is('notification_seen_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) {
            console.error('[Academy] Notificarea Studio nu a putut fi verificată:', error.message);
            setStudioNoticeError('Nu am putut verifica dacă ai o piesă nouă în Studio.');
            return;
        }
        setStudioNotice(data || null);
    }, [profile?.id, isTeacher, isInspector]);

    useEffect(() => { void loadStudioNotice(); }, [loadStudioNotice]);

    async function dismissStudioNotice() {
        if (!studioNotice || studioNoticeBusy) return;
        setStudioNoticeBusy(true);
        setStudioNoticeError('');
        try {
            const { error } = await supabase
                .from('studio_requests')
                .update({ notification_seen_at: new Date().toISOString() })
                .eq('id', studioNotice.id)
                .is('notification_seen_at', null);
            if (error) throw error;
            setStudioNotice(null);
        } catch (error) {
            console.error('[Academy] Confirmarea notificării Studio a eșuat:', error.message);
            setStudioNoticeError('Notificarea nu a putut fi marcată ca văzută. Reîncearcă.');
        } finally {
            setStudioNoticeBusy(false);
        }
    }
    const path = location.pathname;

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

    const linkClass = ({ isActive }) => `group flex aspect-square min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center text-[11px] font-semibold leading-tight transition [touch-action:manipulation] ${isActive
        ? 'border-cyan-300/80 bg-cyan-300/15 text-white shadow-[0_0_24px_rgba(34,211,238,0.24)]'
        : 'border-white/10 bg-white/[0.035] text-slate-200 hover:border-fuchsia-300/50 hover:bg-fuchsia-400/10 hover:text-white'}`;

    function navigation(mobile = false) {
        const links = [...APPLICATION_LINKS, ...(isTeacher && teacherMode ? [{ to: '/admin/', label: 'Panou profesor', Icon: Settings }] : [])];
        return <>
            <nav aria-label={mobile ? 'Navigare mobilă' : 'Navigare principală'} className="mt-5">
                <div className={`grid gap-2 ${mobile ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {links.map(({ to, label, Icon, end }) => <NavLink key={to} to={to} end={end} title={label} className={linkClass}>
                        <Icon size={26} strokeWidth={1.8} aria-hidden="true" />
                        <span>{label}</span>
                    </NavLink>)}
                </div>
                <a href="https://revista.florentinapanaofficial.ro/" target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-12 items-center justify-center gap-3 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-3 text-sm font-bold tracking-wider text-cyan-100 transition hover:bg-cyan-300/20"><BookOpen size={22} aria-hidden="true" />REVISTA<span className="sr-only"> (se deschide într-un tab nou)</span></a>
            </nav>
            {isTeacher && <div className="mt-5 rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/5 p-3"><TeacherModeToggle /></div>}
        </>;
    }

    return (
        <div className="min-h-screen lg:pl-56">
            <aside aria-label="Meniu lateral" className="fixed left-0 top-0 z-40 hidden h-dvh w-56 overflow-y-auto border-r border-white/10 bg-ink-950/85 p-4 shadow-[12px_0_40px_rgba(0,0,0,0.2)] backdrop-blur-2xl lg:block">
                <Brand />
                {navigation()}
            </aside>
            <div className="flex min-w-0 flex-1 flex-col self-stretch">
                <header className="sticky top-0 z-30 border-b border-white/10 bg-ink-950/95 backdrop-blur">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="lg:hidden"><Brand compact /></div>
                        <div className="ml-auto flex items-center gap-3">
                            <div className="hidden text-right sm:block"><p className="text-sm font-semibold text-slate-100">{profile?.full_name || user?.email}</p><p className="text-xs text-slate-400">{isTeacher ? 'Profesor la clasă' : isInspector ? 'Inspector' : 'Elev'} · Palatul Copiilor Pitești</p></div>
                            <Avatar path={profile?.avatar_path} name={profile?.full_name || user?.email} size="sm" className="hidden sm:inline-grid" />
                            <button type="button" className="btn-ghost px-3 py-2" onClick={handleSignOut}>Ieșire</button>
                            <button type="button" className="btn-ghost px-3 py-2 lg:hidden" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="academy-mobile-menu" aria-label="Meniu"><Menu size={22} aria-hidden="true" /></button>
                        </div>
                    </div>
                    {menuOpen && <div id="academy-mobile-menu" className="max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-white/10 bg-ink-900 px-4 pb-5 lg:hidden">{navigation(true)}</div>}
                </header>
                {!isInspector && profile?.id && <DuelInvitations userId={profile.id} />}
                {studioNotice && <section role="status" className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold-300/40 bg-gold-300/10 p-4 shadow-lg shadow-black/20">
                    <p className="font-semibold text-gold-100">🎉 Felicitări! Piesa ta a fost masterizată și este disponibilă în Portofoliu!</p>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link to="/portofoliu/" className="btn-gold" onClick={() => void dismissStudioNotice()}>Vezi portofoliul</Link>
                        <button type="button" className="btn-ghost" onClick={() => void dismissStudioNotice()} disabled={studioNoticeBusy}>{studioNoticeBusy ? 'Se salvează…' : 'Am înțeles'}</button>
                    </div>
                </section>}
                {studioNoticeError && <p role="alert" className="mx-4 mt-3 rounded-xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">{studioNoticeError} <button type="button" className="ml-2 underline" onClick={() => void loadStudioNotice()}>Reîncearcă</button></p>}
                {signOutError && <p role="alert" className="mx-4 mt-4 rounded-xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">{signOutError}</p>}
                <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 sm:p-6 xl:flex-row">
                    <main className="min-w-0 flex-1">
                        <Suspense fallback={<Spinner label="Se încarcă disciplina…" />}><Outlet /></Suspense>
                    </main>
                    <aside className="w-full shrink-0 xl:w-64"><LivePresence profile={profile} /></aside>
                </div>
                <footer className="border-t border-white/10 px-4 py-5 text-center text-xs text-slate-400">Academy Music · Florentina Pană · Palatul Copiilor Pitești — materialele sunt protejate prin drept de autor și destinate exclusiv elevilor înscriși.</footer>
            </div>
            <AnnualStarsWidget visible={!isInspector && (!isTeacher || !teacherMode)} open={podiumOpen} onOpenChange={setPodiumOpen} />
        </div>
    );
}

function Brand({ compact = false }) {
    return <div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-lg shadow-lg shadow-brand-500/20">♫</span><div><p className="font-display text-base leading-tight text-white sm:text-lg">Academy Music</p>{!compact && <p className="text-xs text-slate-400">Palatul Copiilor Pitești</p>}</div></div>;
}

function AnnualStarsWidget({ visible, open, onOpenChange }) {
    if (!visible) return null;
    return <div className="fixed bottom-4 right-4 z-50">
        {open ? <section aria-label="Podiumul anual cu steluțe" className="max-h-[min(78dvh,48rem)] w-[min(25rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-cyan-300/30 bg-ink-950/95 p-3 shadow-[0_0_44px_rgba(34,211,238,0.18)] backdrop-blur-2xl sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3 px-2">
                <p className="font-semibold text-cyan-100">Podiumul elevilor · {new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', year: 'numeric' }).format(new Date())}</p>
                <button type="button" className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-300 transition hover:border-fuchsia-300/50 hover:text-white" aria-label="Închide podiumul" onClick={() => onOpenChange(false)}><X size={20} aria-hidden="true" /></button>
            </div>
            <Suspense fallback={<Spinner label="Se încarcă podiumul…" />}><Leaderboard /></Suspense>
        </section> : <button type="button" className="flex min-h-14 items-center gap-3 rounded-2xl border border-cyan-300/50 bg-ink-900/90 px-5 text-sm font-bold text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.22)] backdrop-blur-xl transition hover:border-fuchsia-300 hover:text-white" aria-expanded="false" aria-label="Deschide podiumul anual cu steluțe" onClick={() => onOpenChange(true)}><Trophy size={22} aria-hidden="true" />Podium ⭐</button>}
    </div>;
}
