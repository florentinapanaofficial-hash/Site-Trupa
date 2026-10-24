import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { getSignedAudioUrl } from '../../lib/media';
import { STUDY_LEVELS, normalizeStudyLevel, studyLevelLabel } from '../../lib/studyLevels';
import { HOMEWORK_BUCKET, submissionState } from '../../lib/timedHomework';

type Status = 'pending' | 'approved' | 'rejected';
type Homework = {
    id: string; audio_path: string; status: Status; teacher_feedback: string | null;
    created_at: string; submission_start: string; submission_end: string;
};
type Assignment = { id: string; submission_start: string; submission_end: string };
type Profile = { id: string; study_level: string; role: string };
type Props = { studentId: string; onLevelChange?: (profile: Profile) => void };
const formatDate = (value: string) => new Date(value).toLocaleString('ro-RO');

export default function HomeworkEvaluator({ studentId, onLevelChange }: Props) {
    const [homework, setHomework] = useState<Homework[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [selectedModule, setSelectedModule] = useState('');
    const [feedback, setFeedback] = useState<Record<string, string>>({});
    const [audio, setAudio] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const [revision, setRevision] = useState(0);
    const reportError = useCallback((failure: unknown) => {
        console.error('[Academy] Evaluarea temelor audio a eșuat:', failure);
        setError(failure instanceof Error ? failure.message : 'Operația a eșuat. Verifică permisiunile și migrarea, apoi reîncearcă.');
    }, []);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        setAudio({});
        void (async () => {
            try {
                const [rows, student, windows] = await Promise.all([
                    supabase.from('student_homework').select('id,audio_path,status,teacher_feedback,created_at,submission_start,submission_end').eq('student_id', studentId).not('audio_path', 'is', null).order('created_at', { ascending: false }),
                    supabase.from('profiles').select('id,study_level,role').eq('id', studentId).single(),
                    supabase.from('homework_assignments').select('id,submission_start,submission_end').eq('student_id', studentId).order('submission_start', { ascending: false }),
                ]);
                if (rows.error) throw rows.error;
                if (student.error) throw student.error;
                if (windows.error) throw windows.error;
                if (active) {
                    setHomework(rows.data || []);
                    setProfile(student.data);
                    setSelectedModule(normalizeStudyLevel(student.data.study_level) || '');
                    setAssignments(windows.data || []);
                    setFeedback(Object.fromEntries((rows.data || []).map((row) => [row.id, row.teacher_feedback || ''])));
                }
            } catch (loadError) { if (active) reportError(loadError); }
            finally { if (active) setLoading(false); }
        })();
        return () => { active = false; };
    }, [studentId, revision, reportError]);

    async function run(operation: () => Promise<void>) {
        if (busy) return;
        setBusy(true); setError(''); setNotice('');
        try { await operation(); }
        catch (failure) { reportError(failure); }
        finally { setBusy(false); }
    }
    async function review(row: Homework, status: Status) {
        await run(async () => {
            const { data, error: updateError } = await supabase.from('student_homework')
                .update({ status, teacher_feedback: feedback[row.id]?.trim() || null })
                .eq('id', row.id).eq('student_id', studentId).select('id,status,teacher_feedback').single();
            if (updateError) throw updateError;
            setHomework((rows) => rows.map((item) => item.id === data.id ? { ...item, ...data } : item));
            setNotice('Evaluarea a fost salvată.');
        });
    }
    async function listen(row: Homework) {
        await run(async () => {
            const url = await getSignedAudioUrl(HOMEWORK_BUCKET, row.audio_path);
            if (!url) throw new Error('Fișierul audio nu este disponibil.');
            setAudio((urls) => ({ ...urls, [row.id]: url }));
        });
    }
    async function schedule(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        await run(async () => {
            const from = new Date(start);
            const until = new Date(end);
            if (!Number.isFinite(from.getTime()) || !Number.isFinite(until.getTime())
                || submissionState(from.toISOString(), until.toISOString()) === 'invalid') {
                throw new Error('Alege un început valid, anterior sfârșitului intervalului.');
            }
            const { data, error: insertError } = await supabase.from('homework_assignments').insert({
                student_id: studentId, submission_start: from.toISOString(), submission_end: until.toISOString(),
            }).select('id,submission_start,submission_end').single();
            if (insertError) throw insertError;
            setAssignments((rows) => [data, ...rows]);
            setStart(''); setEnd('');
            setNotice('Intervalul de predare a fost creat.');
        });
    }
    async function saveModule() {
        await run(async () => {
            if (!profile || !STUDY_LEVELS.some((module) => module.value === selectedModule)) throw new Error('Selectează un modul valid.');
            const { data, error: updateError } = await supabase.from('profiles').update({ study_level: selectedModule })
                .eq('id', studentId).in('role', ['student', 'elev']).eq('study_level', profile.study_level)
                .select('id,study_level,role').single();
            if (updateError) throw updateError;
            setProfile(data);
            onLevelChange?.(data);
            setNotice(`Modul salvat: ${studyLevelLabel(data.study_level)}.`);
        });
    }
    return <section className="card space-y-4">
        <h2 className="text-xl font-semibold text-white">Evaluare teme audio</h2>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setRevision((value) => value + 1)}>Reîncarcă evaluările</button>
        {error && <p role="alert" className="text-red-300">{error}</p>}
        {notice && <p role="status" className="text-emerald-300">{notice}</p>}
        {loading ? <p>Se încarcă temele…</p> : <>
            <form onSubmit={(event) => void schedule(event)} className="space-y-3 rounded-xl border border-white/10 p-4">
                <h3 className="font-medium">Stabilește o fereastră nouă de predare</h3>
                <label className="label">Început (ora locală)<input type="datetime-local" className="input" required value={start} disabled={busy} onChange={(event) => setStart(event.target.value)} /></label>
                <label className="label">Sfârșit (ora locală)<input type="datetime-local" className="input" required value={end} disabled={busy} onChange={(event) => setEnd(event.target.value)} /></label>
                <button className="btn btn-primary" disabled={busy}>Salvează intervalul</button>
            </form>
            {assignments.map((assignment) => <p key={assignment.id} className="text-sm text-slate-400">Predare: {formatDate(assignment.submission_start)} – {formatDate(assignment.submission_end)}</p>)}
            {!homework.length && <p className="text-slate-400">Elevul nu a trimis încă teme audio.</p>}
            {homework.map((row) => <article key={row.id} className="rounded-xl border border-white/10 p-4 space-y-3">
                <h3 className="font-medium">Temă din {formatDate(row.created_at)}</h3>
                <p>Stare: {row.status === 'approved' ? 'Aprobată' : row.status === 'rejected' ? 'Respinsă' : 'În așteptare'}</p>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void listen(row)}>Încarcă / reînnoiește audio</button>
                {audio[row.id] && <audio className="w-full" controls preload="none" src={audio[row.id]} onError={() => setError('Redarea a eșuat. Reînnoiește adresa audio și încearcă din nou.')} />}
                <label className="label">Feedback opțional<textarea className="input" maxLength={5000} value={feedback[row.id] || ''} disabled={busy} onChange={(event) => setFeedback((values) => ({ ...values, [row.id]: event.target.value }))} /></label>
                <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void review(row, 'approved')}>Aprobă</button>
                    <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void review(row, 'rejected')}>Respinge</button>
                </div>
            </article>)}
            <div className="border-t border-white/10 pt-4 space-y-2">
                <p>Modul actual: {studyLevelLabel(profile?.study_level)}</p>
                <label className="label" htmlFor={`homework-module-${studentId}`}>Modul de studiu
                    <select id={`homework-module-${studentId}`} className="input" value={selectedModule} disabled={busy || !profile || !['student', 'elev'].includes(profile.role)} onChange={(event) => setSelectedModule(event.target.value)}>
                        <option value="" disabled>Selectează modulul</option>
                        {STUDY_LEVELS.map((module) => <option key={module.value} value={module.value}>{module.label}</option>)}
                    </select>
                </label>
                <p className="text-sm text-slate-400">Poți atribui direct orice modul, inclusiv unul anterior. Modificarea se aplică numai după salvare.</p>
                <button type="button" className="btn btn-primary" disabled={busy || !selectedModule || selectedModule === profile?.study_level || !['student', 'elev'].includes(profile?.role || '')} onClick={() => void saveModule()}>Salvează modulul</button>
            </div>
        </>}
    </section>;
}
