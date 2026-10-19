import { CalendarDays, ClipboardList, Files, Trophy, ExternalLink } from 'lucide-react';

const WORKSPACE = [
    { title: 'Catalog și Prezențe', href: 'https://drive.google.com/drive/folders/1Q8E1AMA3BfPaOnT5-uNbUEMTNw7wmy_T?usp=sharing', icon: ClipboardList, color: 'text-emerald-300' },
    { title: 'Planificări și Programe', href: 'https://drive.google.com/drive/folders/1G-ednBis5yAhMotJToHJl42UVWuM9sC4?usp=drive_link', icon: CalendarDays, color: 'text-sky-300' },
    { title: 'Lista Concursuri', href: 'https://drive.google.com/drive/folders/1tPD6PD-xeCCsgHUNlKHVEmIxh_We3di9?usp=sharing', icon: Trophy, color: 'text-gold-400' },
    { title: 'Documente Administrative', href: 'https://drive.google.com/drive/folders/16c_4a1Y804bq2LZHvOWDfdPaqyX1_6lh?usp=drive_link', icon: Files, color: 'text-brand-300' },
];

export default function AdminDashboard() {
    return (
        <section aria-labelledby="cancelarie-title" className="border-t border-white/10 pt-6">
            <h2 id="cancelarie-title" className="mb-4 text-2xl text-white">Cancelarie Digitală</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {WORKSPACE.map(({ title, href, icon: Icon, color }) => (
                    <a key={title} href={href} target="_blank" rel="noopener noreferrer"
                        className="group flex min-h-28 items-center gap-3 rounded-lg border border-white/10 bg-ink-800 p-4 shadow-md transition hover:-translate-y-1 hover:border-gold-400/50 hover:shadow-lg hover:shadow-black/40">
                        <Icon className={`h-6 w-6 shrink-0 ${color}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1 font-semibold text-white">{title}</span>
                        <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    </a>
                ))}
            </div>
        </section>
    );
}