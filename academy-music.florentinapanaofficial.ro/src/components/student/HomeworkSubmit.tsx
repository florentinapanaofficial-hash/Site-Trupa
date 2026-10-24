import { useEffect, useRef, useState } from 'react';
import CantoStudio, { type CantoBackingPiece } from './CantoStudio';
import { supabase } from '../../lib/supabase';
import { submissionState, submitTimedHomework } from '../../lib/timedHomework';

type HomeworkSubmitProps = {
    assignmentId: string;
    submissionStart: string;
    submissionEnd: string;
    onSubmitted?: () => void;
    pieces?: CantoBackingPiece[];
};
type Assignment = { id: string; submission_start: string; submission_end: string };
type Submission = { assignment_id: string; status: string; teacher_feedback: string | null };
const dateLabel = (date: string) => new Date(date).toLocaleString('ro-RO');

export default function HomeworkSubmit({ assignmentId, submissionStart, submissionEnd, onSubmitted, pieces = [] }: HomeworkSubmitProps) {
    const [now, setNow] = useState(Date.now);
    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [studioBusy, setStudioBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const uploading = useRef(false);
    const windowState = submissionState(submissionStart, submissionEnd, now);
    useEffect(() => {
        const update = () => setNow(Date.now());
        const timer = window.setInterval(update, 1000);
        window.addEventListener('focus', update);
        document.addEventListener('visibilitychange', update);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', update);
            document.removeEventListener('visibilitychange', update);
        };
    }, []);

    async function submit() {
        if (uploading.current || studioBusy) return;
        setError('');
        if (submissionState(submissionStart, submissionEnd) !== 'open') {
            setNow(Date.now());
            setError('Tema poate fi trimisă doar în intervalul stabilit de profesor.');
            return;
        }
        if (!file) { setError('Selectează sau înregistrează un fișier audio.'); return; }
        uploading.current = true;
        setBusy(true);
        try {
            await submitTimedHomework(supabase, { assignmentId, submissionStart, submissionEnd, file });
            setSent(true);
            onSubmitted?.();
        } catch (uploadError) {
            console.error('[Academy] Predarea temei audio a eșuat:', uploadError);
            setError(uploadError instanceof Error ? uploadError.message : 'Tema nu a putut fi trimisă. Încearcă din nou.');
        } finally {
            uploading.current = false;
            setBusy(false);
        }
    }

    return <div className="space-y-3">
        {sent ? <p role="status" className="text-emerald-300">Tema a fost trimisă pentru evaluare.</p>
            : windowState === 'invalid' ? <p role="alert">Interval de predare invalid. Contactează profesorul.</p>
                : windowState === 'upcoming' ? <p>Tema se deblochează pe {dateLabel(submissionStart)}</p>
                    : windowState === 'expired' ? <p>Timpul pentru predare a expirat</p>
                        : <>
                            <p className="text-sm text-slate-400">Poți preda până la {dateLabel(submissionEnd)}. Maximum 30 MB.</p>
                            <label className="label">Fișier audio (sau înregistrare, dacă dispozitivul permite)
                                <input className="input mt-2" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/webm,audio/mp4,audio/aac" capture="user" disabled={busy || studioBusy} onChange={(event) => setFile(event.target.files?.[0] || null)} />
                            </label>
                            <button type="button" className="btn btn-primary" disabled={busy || studioBusy || !file} onClick={() => void submit()}>{busy ? 'Se trimite…' : 'Înregistrează/Trimite tema'}</button>
                        </>}
        {!sent && <CantoStudio assignmentId={assignmentId} submissionStart={submissionStart} submissionEnd={submissionEnd} pieces={pieces} externalBusy={busy} onBusyChange={setStudioBusy} onSubmitted={() => { setSent(true); onSubmitted?.(); }} />}
        {error && <p role="alert" className="text-red-300">{error}</p>}
    </div>;
}

export function StudentHomework({ studentId, pieces = [] }: { studentId: string; pieces?: CantoBackingPiece[] }) {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [revision, setRevision] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        void (async () => {
            try {
                const [assigned, submitted] = await Promise.all([
                    supabase.from('homework_assignments').select('id,submission_start,submission_end').eq('student_id', studentId).order('submission_start', { ascending: false }),
                    supabase.from('student_homework').select('assignment_id,status,teacher_feedback').eq('student_id', studentId).not('assignment_id', 'is', null),
                ]);
                if (assigned.error) throw assigned.error;
                if (submitted.error) throw submitted.error;
                if (active) { setAssignments(assigned.data || []); setSubmissions(submitted.data || []); }
            } catch (loadError) {
                console.error('[Academy] Temele audio nu au putut fi încărcate:', loadError);
                if (active) setError('Temele nu au putut fi încărcate. Verifică migrarea și reîncearcă.');
            } finally { if (active) setLoading(false); }
        })();
        return () => { active = false; };
    }, [studentId, revision]);
    return <section className="card space-y-4">
        <h2 className="text-xl font-semibold text-white">Teme audio cu termen de predare</h2>
        <button type="button" className="btn btn-ghost" onClick={() => setRevision((value) => value + 1)}>Reîncarcă temele</button>
        {error ? <p role="alert" className="text-red-300">{error}</p> : loading ? <p>Se încarcă temele…</p> : <>
            {!assignments.length && <p className="text-slate-400">Profesorul nu a stabilit încă un interval de predare.</p>}
            {assignments.map((assignment) => {
                const submission = submissions.find((row) => row.assignment_id === assignment.id);
                return <article key={assignment.id} className="rounded-xl border border-white/10 p-4 space-y-2">
                    <h3 className="font-medium">Predare: {dateLabel(assignment.submission_start)} – {dateLabel(assignment.submission_end)}</h3>
                    {submission ? <>
                        <p>Evaluare: {submission.status === 'approved' ? 'Aprobată' : submission.status === 'rejected' ? 'Respinsă' : 'În așteptare'}</p>
                        {submission.teacher_feedback && <p className="whitespace-pre-wrap">Feedback: {submission.teacher_feedback}</p>}
                    </> : <HomeworkSubmit assignmentId={assignment.id} submissionStart={assignment.submission_start} submissionEnd={assignment.submission_end} pieces={pieces} onSubmitted={() => setRevision((value) => value + 1)} />}
                </article>;
            })}
        </>}
    </section>;
}
