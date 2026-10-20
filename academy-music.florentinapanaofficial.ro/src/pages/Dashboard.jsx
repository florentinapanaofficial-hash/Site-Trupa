import { Link } from 'react-router-dom';
import { Info, Mic2, Piano, ArrowUpRight } from 'lucide-react';

const DISCIPLINES = [
    {
        title: 'Canto', to: '/canto/', Icon: Mic2, eyebrow: 'Dă voce pasiunii tale',
        description: 'Lecții, negative și materiale pentru studiul vocal. Sincronizarea versurilor și înregistrarea cu reverb vor fi dezvoltate în modulul Canto.',
        gradient: 'from-brand-500/25 via-rose-500/10 to-ink-900', accent: 'text-rose-200',
        iconStyle: 'border-rose-300/25 bg-rose-300/10 text-rose-200',
    },
    {
        title: 'Instrument-Orgă', to: '/instrument/', Icon: Piano, eyebrow: 'Descoperă muzica, clapă cu clapă',
        description: 'Exerciții, partituri și claviatură virtuală pentru studiul instrumentului.',
        gradient: 'from-teal-400/20 via-sky-500/10 to-ink-900', accent: 'text-teal-200',
        iconStyle: 'border-teal-300/25 bg-teal-300/10 text-teal-200',
    },
];

export default function Dashboard() {
    return (
        <section className="mx-auto max-w-5xl space-y-10 py-6 sm:py-12" aria-labelledby="dashboard-title">
            <header className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">Clasa ta virtuală</p>
                <h1 id="dashboard-title" className="mt-4 text-4xl text-white sm:text-5xl">Ce vrei să studiezi astăzi?</h1>
                <p className="mt-5 text-base leading-relaxed text-slate-300">Alege disciplina și intră în spațiul tău de pregătire. Uneltele potrivite te așteaptă acolo.</p>
            </header>
            <div className="grid items-start gap-6 md:grid-cols-2">
                {DISCIPLINES.map(({ title, to, Icon, eyebrow, description, gradient, accent, iconStyle }) => (
                    <article key={to} className={`rounded-[2rem] border border-white/15 bg-gradient-to-br ${gradient} shadow-xl shadow-black/15 transition-colors hover:border-white/30`}>
                        <Link to={to} aria-label={`Deschide ${title}`} className="group flex min-h-80 flex-col rounded-[2rem] p-7 sm:min-h-96 sm:p-9">
                            <span className={`grid size-24 place-items-center rounded-3xl border ${iconStyle} transition-transform duration-300 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:rotate-3`}><Icon size={52} strokeWidth={1.4} aria-hidden="true" /></span>
                            <p className={`mt-8 text-xs font-semibold uppercase tracking-widest ${accent}`}>{eyebrow}</p>
                            <h2 className="mt-3 break-words text-3xl text-white sm:text-4xl">{title}</h2>
                            <span className={`mt-7 flex items-center gap-2 text-sm font-semibold ${accent}`}>Intră în clasă <ArrowUpRight size={18} aria-hidden="true" /></span>
                        </Link>
                        <details className="mx-7 mb-7 border-t border-white/10 pt-4 sm:mx-9 sm:mb-9">
                            <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"><Info size={17} aria-hidden="true" />Info <span className="sr-only">despre {title}</span></summary>
                            <p className="mt-3 text-sm leading-relaxed text-slate-300">{description}</p>
                        </details>
                    </article>
                ))}
            </div>
            <p className="text-sm text-slate-400">Poți schimba disciplina oricând din „Alege disciplina”.</p>
        </section>
    );
}
