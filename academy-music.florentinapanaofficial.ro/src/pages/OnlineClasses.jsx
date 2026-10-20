import { useTeacherMode } from '../lib/useTeacherMode';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Video, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const DAYS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
const blank = { id: null, name: '', weekday: 1, start_time: '16:00', duration_minutes: 60, students: [] };

export default function OnlineClasses() {
    const { isTeacher: teacherRole, isInspector } = useAuth();
    const [teacherMode] = useTeacherMode();
    const isTeacher = teacherRole && teacherMode;
    const [groups, setGroups] = useState(null);
    const [students, setStudents] = useState([]);
    const [members, setMembers] = useState([]);
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState(null);

    async function load() {
        const results = await Promise.all([
            supabase.from('online_groups').select('*').order('weekday').order('start_time'),
            isTeacher ? supabase.from('profiles').select('id,full_name').in('role', ['student', 'elev']).eq('is_active', true).order('full_name') : Promise.resolve({ data: [] }),
            isTeacher ? supabase.from('online_group_members').select('group_id,student_id') : Promise.resolve({ data: [] }),
        ]);
        if (results.some((result) => result.error)) { setError('Grupele nu au putut fi încărcate. Verifică conexiunea și migrarea cursurilor online.'); return; }
        setGroups(results[0].data);
        setStudents(results[1].data);
        setMembers(results[2].data);
    }

    useEffect(() => { void load(); }, [isTeacher]);

    async function save(event) {
        event.preventDefault();
        if (!isTeacher || busy) return;
        setBusy(true);
        setError('');
        try {
            const result = await supabase.rpc('save_online_group', { group_uuid: form.id, group_name: form.name, day_number: Number(form.weekday), lesson_time: form.start_time, minutes: Number(form.duration_minutes), students: form.students });
            if (result.error) throw new Error(result.error.code === '23505' ? 'Un elev este deja înscris în altă grupă.' : 'Grupa nu a fost salvată. Verifică datele și conexiunea.');
            setForm(null);
            await load();
        } catch (failure) { setError(failure.message); }
        finally { setBusy(false); }
    }

    async function remove() {
        if (!isTeacher || busy) return;
        setBusy(true);
        const result = await supabase.from('online_groups').delete().eq('id', deleting.id).select('id');
        if (result.error || !result.data?.length) setError('Grupa nu a fost ștearsă.');
        else { setDeleting(null); await load(); }
        setBusy(false);
    }

    return <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
            <h1 className="max-w-xl font-display text-2xl text-white">Cursuri online / grupe de elevi</h1>
            {isTeacher && <button type="button" className="btn-gold" onClick={() => { setForm({ ...blank, students: [] }); setDeleting(null); }}><Plus size={18} /> Creează grupă</button>}
        </header>
        {error && <p role="alert" className="text-red-300">{error} <button type="button" className="underline" onClick={() => { setError(''); void load(); }}>Reîncearcă</button></p>}
        {form && isTeacher && <form onSubmit={save} className="space-y-4 border-b border-white/10 pb-6">
            <h2 className="text-lg text-white">{form.id ? 'Editează grupa' : 'Grupă nouă'}</h2>
            <label className="block text-sm">Denumire<input required maxLength={100} className="input mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm">Zi<select className="input mt-1" value={form.weekday} onChange={(event) => setForm({ ...form, weekday: event.target.value })}>{DAYS.map((day, index) => <option key={day} value={index + 1}>{day}</option>)}</select></label>
                <label className="text-sm">Ora (Europe/Bucharest)<input type="time" required className="input mt-1" value={form.start_time.slice(0, 5)} onChange={(event) => setForm({ ...form, start_time: event.target.value })} /></label>
                <label className="text-sm">Durată (minute)<input type="number" min={15} max={240} required className="input mt-1" value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })} /></label>
            </div>
            <fieldset><legend className="mb-2 text-sm">Elevi</legend><div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                {students.map((student) => {
                    const assigned = members.some((member) => member.student_id === student.id && member.group_id !== form.id);
                    return <label key={student.id} className={`flex items-center gap-2 text-sm ${assigned ? 'text-slate-500' : 'text-slate-200'}`}><input type="checkbox" disabled={assigned} checked={form.students.includes(student.id)} onChange={(event) => setForm({ ...form, students: event.target.checked ? [...form.students, student.id] : form.students.filter((id) => id !== student.id) })} />{student.full_name || student.id}{assigned ? ' · altă grupă' : ''}</label>;
                })}
            </div></fieldset>
            <div className="flex gap-2"><button type="submit" className="btn-gold" disabled={busy}><Save size={18} />Salvează</button><button type="button" className="btn-ghost" disabled={busy} onClick={() => setForm(null)}><X size={18} />Anulează</button></div>
        </form>}
        {deleting && isTeacher && <div role="alert" className="space-y-3 border border-red-400/40 p-4"><p>Ștergi grupa „{deleting.name}” și înscrierile video? Materialele de studiu rămân intacte.</p><div className="flex gap-2"><button type="button" className="btn-primary" disabled={busy} onClick={() => void remove()}><Trash2 size={18} />Confirmă ștergerea</button><button type="button" className="btn-ghost" onClick={() => setDeleting(null)}>Anulează</button></div></div>}
        {!groups && !error && <p role="status">Se încarcă grupele…</p>}
        {groups?.length === 0 && <p className="text-slate-400">{isTeacher || isInspector ? 'Nu există grupe online.' : 'Nu ești încă înscris într-o grupă online.'}</p>}
        <div className="grid gap-4 md:grid-cols-2">{groups?.map((group) => <article key={group.id} className="min-w-0 space-y-4 rounded-lg border border-white/15 bg-ink-900 p-5">
            <h2 className="break-words text-xl text-white">{group.name}</h2>
            <p className="flex items-start gap-2 text-sm text-slate-300"><CalendarDays size={18} className="shrink-0" />{DAYS[group.weekday - 1]}, {group.start_time.slice(0, 5)} · {group.duration_minutes} min · Europe/Bucharest</p>
            <div className="flex flex-wrap gap-2"><Link className="btn-gold" to={`/cursuri-online/${group.id}/`}><Video size={18} />{isInspector ? 'Asistă la curs' : 'Intră la curs'}</Link>
                {isTeacher && <><button type="button" className="btn-ghost" aria-label={`Editează ${group.name}`} title="Editează grupa" onClick={() => { setForm({ ...group, students: members.filter((member) => member.group_id === group.id).map((member) => member.student_id) }); setDeleting(null); }}><Pencil size={18} /></button><button type="button" className="btn-ghost" aria-label={`Șterge ${group.name}`} title="Șterge grupa" onClick={() => { setDeleting(group); setForm(null); }}><Trash2 size={18} /></button></>}
            </div>
        </article>)}</div>
    </div>;
}