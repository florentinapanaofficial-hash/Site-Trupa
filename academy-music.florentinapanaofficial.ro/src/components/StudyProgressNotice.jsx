import { CheckCircle2, Lock, Music2 } from 'lucide-react';
import { studyLevelLabel } from '../lib/studyLevels';
export default function StudyProgressNotice({ state, visible = true }) {
    if (!visible) return null;
    const { progress } = state;
    return <section className="rounded-xl border border-white/10 bg-ink-900/70 p-4" aria-label="Progresul modulului de studiu">
        {state.error && <p role="status" className="text-sm text-amber-200">{state.error} Piesele modulului tău rămân disponibile.</p>}
        {!state.error && <>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Music2 size={17} aria-hidden="true" />Modul de studiu: {studyLevelLabel(progress.studyLevel)}</div>
            {progress.nextLevel && progress.nextLevelUnlocked ? <p role="status" className="mt-2 flex items-center gap-2 text-sm text-emerald-200"><CheckCircle2 size={17} aria-hidden="true" />Ai deblocat {studyLevelLabel(progress.nextLevel)}. Îl poți exersa alături de modulul tău curent.</p>
                : progress.nextLevel && progress.assignedCount > 0 ? <p className="mt-2 flex items-center gap-2 text-sm text-slate-300"><Lock size={16} aria-hidden="true" />Teme trimise pentru modul: {progress.completedCount}/{progress.assignedCount}. După trimiterea temelor pentru piesele alocate, se deblochează {studyLevelLabel(progress.nextLevel)}.</p>
                    : progress.nextLevel ? <p className="mt-2 text-sm text-slate-400">Profesorul va aloca piese pentru acest modul; după trimiterea temelor se va debloca modulul următor.</p>
                        : <p className="mt-2 text-sm text-slate-400">Ai acces la toate cele cinci module.</p>}
        </>}
        {state.loading && <span className="sr-only">Se actualizează progresul…</span>}
    </section>;
}
