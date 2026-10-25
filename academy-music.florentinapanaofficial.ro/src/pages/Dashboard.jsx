import { ArrowUpRight, BookOpen, FolderOpen, Library, Mic2, Music2, Piano, Puzzle, Settings, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const APPS = [
    { title: 'Canto', to: '/canto/', Icon: Mic2, description: 'Piese, negative și karaoke sincronizat.', accent: 'text-fuchsia-200', glow: 'hover:border-fuchsia-300/60 hover:shadow-fuchsia-500/15' },
    { title: 'Instrument-Orgă', to: '/instrument/', Icon: Piano, description: 'Repertoriu și clape virtuale interactive.', accent: 'text-cyan-200', glow: 'hover:border-cyan-300/60 hover:shadow-cyan-500/15' },
    { title: 'Quiz-uri & dueluri', to: '/jocuri/', Icon: Puzzle, description: 'Joacă individual sau provoacă un coleg.', accent: 'text-violet-200', glow: 'hover:border-violet-300/60 hover:shadow-violet-500/15' },
    { title: 'Partituri', to: '/instrument/partituri/', Icon: Music2, description: 'Deschide rapid biblioteca muzicală.', accent: 'text-cyan-200', glow: 'hover:border-cyan-300/60 hover:shadow-cyan-500/15' },
    { title: 'Resurse RED', to: '/red/', Icon: Library, description: 'Materiale digitale de teorie muzicală.', accent: 'text-fuchsia-200', glow: 'hover:border-fuchsia-300/60 hover:shadow-fuchsia-500/15' },
    { title: 'Cursuri online', to: '/cursuri-online/', Icon: Users, description: 'Intră în clasa virtuală și întâlnește grupa.', accent: 'text-violet-200', glow: 'hover:border-violet-300/60 hover:shadow-violet-500/15' },
    { title: 'Portofoliu', to: '/portofoliu/', Icon: FolderOpen, description: 'Urmărește piesele aflate în lucru.', accent: 'text-fuchsia-200', glow: 'hover:border-fuchsia-300/60 hover:shadow-fuchsia-500/15' },
];

export default function Dashboard() {
    const { isTeacher } = useAuth();
    const apps = isTeacher ? [...APPS, { title: 'Administrare', to: '/admin/', Icon: Settings, description: 'Gestionează clasa și resursele Academiei.', accent: 'text-cyan-200', glow: 'hover:border-cyan-300/60 hover:shadow-cyan-500/15' }] : APPS;
    return (
        <section className="mx-auto max-w-6xl space-y-8 py-6 sm:py-10" aria-labelledby="dashboard-title">
            <header className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Clasa ta virtuală</p>
                <h1 id="dashboard-title" className="mt-3 text-4xl text-white sm:text-5xl">Ce vrei să studiezi astăzi?</h1>
                <p className="mt-4 text-base leading-relaxed text-slate-200">Alege o aplicație de studiu. Toate modulele, materialele și jocurile sunt la o atingere distanță.</p>
            </header>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4" aria-label="Aplicațiile Academiei">
                {apps.map(({ title, to, Icon, description, accent, glow }) => (
                    <Link key={to} to={to} aria-label={`Deschide ${title}`} className={`group flex min-h-48 flex-col rounded-3xl border border-white/10 bg-ink-900/65 p-5 shadow-lg shadow-black/20 backdrop-blur-xl transition duration-200 hover:-translate-y-1 hover:shadow-xl ${glow} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:min-h-56 sm:p-6`}>
                        <span className={`grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] ${accent} transition group-hover:scale-105 sm:size-16`}><Icon size={30} strokeWidth={1.7} aria-hidden="true" /></span>
                        <span className="mt-5 flex items-start justify-between gap-2">
                            <span className="text-lg font-semibold leading-tight text-white sm:text-xl">{title}</span>
                            <ArrowUpRight className={`mt-0.5 shrink-0 ${accent}`} size={19} aria-hidden="true" />
                        </span>
                        <span className="mt-2 text-sm leading-relaxed text-slate-300">{description}</span>
                    </Link>
                ))}
            </div>
            <p className="flex items-center gap-2 text-sm text-slate-400"><BookOpen size={17} aria-hidden="true" />Poți schimba activitatea oricând din meniul cu pătrățele din stânga.</p>
        </section>
    );
}
