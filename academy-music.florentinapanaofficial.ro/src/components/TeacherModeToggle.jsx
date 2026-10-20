import { useTeacherMode } from '../lib/useTeacherMode';

export default function TeacherModeToggle() {
    const [teacherMode, setTeacherMode] = useTeacherMode();
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm font-semibold text-gold-300">Vizualizare: Profesor / Elev</p><p className="text-xs text-slate-300">{teacherMode ? 'Unelte de administrare vizibile' : 'Previzualizare elev · rolul real nu se schimbă'}</p></div>
            <button type="button" role="switch" aria-label="Comută modul profesor" aria-checked={teacherMode} onClick={() => setTeacherMode((previous) => !previous)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${teacherMode ? 'bg-gold-500' : 'bg-white/20'}`}>
                <span className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${teacherMode ? 'left-1 translate-x-5' : 'left-1'}`} />
            </button>
            <span className="text-xs font-semibold text-slate-200">{teacherMode ? 'Profesor' : 'Elev'}</span>
        </div>
    );
}
