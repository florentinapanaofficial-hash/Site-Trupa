import { useCallback, useEffect, useState } from 'react';
import { Plus, UserRoundCheck, UserRoundX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { generateTemporaryPassword, suggestUsername } from '../../lib/studentCredentials';
import Avatar from '../../components/Avatar';
import StudentDetail from './StudentDetail';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

const EMPTY_STUDENT_FORM = { firstName: '', lastName: '', username: '', password: '' };

export default function AdminStudents() {
    const { profile } = useAuth();
    const [students, setStudents] = useState(null);
    const [allPieces, setAllPieces] = useState([]);
    const [counts, setCounts] = useState({});
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [usernameEdited, setUsernameEdited] = useState(false);
    const [newStudent, setNewStudent] = useState(EMPTY_STUDENT_FORM);
    const [createStatus, setCreateStatus] = useState({ busy: false, error: '' });
    const [createdCredentials, setCreatedCredentials] = useState(null);
    const [copyStatus, setCopyStatus] = useState('');
    const [listError, setListError] = useState('');
    const [activeFilter, setActiveFilter] = useState('active');
    const [statusTarget, setStatusTarget] = useState(null);
    const [statusBusy, setStatusBusy] = useState(false);
    const [statusError, setStatusError] = useState('');

    const load = useCallback(async () => {
        setListError('');
        const [profilesResult, piecesResult, assignedResult] = await Promise.all([
            (async () => {
                const students = [];
                for (let offset = 0; ; offset += 500) {
                    const result = await supabase.from('profiles').select('*')
                        .in('role', ['student', 'elev'])
                        .order('full_name', { ascending: true }).order('id')
                        .range(offset, offset + 499);
                    if (result.error) return result;
                    students.push(...(result.data || []));
                    if ((result.data || []).length < 500) return { data: students };
                }
            })(),
            supabase.from('pieces').select('*').order('title'),
            supabase.from('student_pieces').select('student_id'),
        ]);

        if (profilesResult.error || piecesResult.error || assignedResult.error) {
            setListError('Datele clasei nu au putut fi încărcate complet. Încearcă din nou.');
            setStudents((previous) => previous || []);
            return;
        }
        setStudents(profilesResult.data || []);
        setAllPieces(piecesResult.data || []);

        const tally = {};
        for (const row of assignedResult.data || []) {
            tally[row.student_id] = (tally[row.student_id] || 0) + 1;
        }
        setCounts(tally);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function patch(id, changes) {
        const { data, error } = await supabase.from('profiles').update(changes)
            .eq('id', id).in('role', ['student', 'elev']).select('id, is_active').single();
        if (error || !data || ('is_active' in changes && data.is_active !== changes.is_active)) {
            throw new Error('Modificarea elevului nu a putut fi salvată.');
        }
        await load();
    }

    async function changeStudentStatus() {
        if (!statusTarget || statusBusy) return;
        setStatusBusy(true);
        setStatusError('');
        try {
            await patch(statusTarget.id, { is_active: !statusTarget.is_active });
            setStatusTarget(null);
        } catch (error) {
            setStatusError(error.message || 'Starea contului nu a putut fi schimbată.');
        } finally {
            setStatusBusy(false);
        }
    }

    function openCreateModal() {
        setNewStudent(EMPTY_STUDENT_FORM);
        setUsernameEdited(false);
        setCreateStatus({ busy: false, error: '' });
        setCreateOpen(true);
    }

    function updateStudentName(field) {
        return (event) => {
            const value = event.target.value;
            setNewStudent((previous) => {
                const next = { ...previous, [field]: value };
                if (!usernameEdited) next.username = suggestUsername(next.firstName, next.lastName);
                return next;
            });
        };
    }

    async function createStudent(event) {
        event.preventDefault();
        if (createStatus.busy) return;
        setCreateStatus({ busy: true, error: '' });

        try {
            const { data, error } = await supabase.functions.invoke('create-student', {
                body: newStudent,
            });

            if (error) {
                let message = error.message;
                if (error.context instanceof Response) {
                    const body = await error.context.json().catch(() => null);
                    message = body?.error || message;
                }
                throw new Error(message);
            }
            if (!data?.id) throw new Error(data?.error || 'Contul nu a putut fi creat.');

            const fullName = `${newStudent.firstName.trim()} ${newStudent.lastName.trim()}`;
            setCreatedCredentials({ fullName, username: data.username, password: newStudent.password });
            setCopyStatus('');
            setCreateOpen(false);
            setNewStudent(EMPTY_STUDENT_FORM);
            setSearch('');
            setActiveFilter('active');
            await load();
        } catch (error) {
            setCreateStatus({ busy: false, error: error?.message || 'Crearea contului a eșuat.' });
        }
    }

    async function copyCredentials() {
        try {
            await navigator.clipboard.writeText(
                `Nume: ${createdCredentials.fullName}\nUsername: ${createdCredentials.username}\nParolă: ${createdCredentials.password}`
            );
            setCopyStatus('Datele au fost copiate. Parola nu va mai fi salvată după închiderea ferestrei.');
        } catch {
            setCopyStatus('Copierea automată nu este disponibilă; selectează datele de mai sus.');
        }
    }

    if (students === null) return <Spinner label="Se încarcă clasa…" />;

    const selected = students.find((student) => student.id === selectedId);

    if (selected) {
        return (
            <StudentDetail
                student={selected}
                allPieces={allPieces}
                onBack={() => {
                    setSelectedId(null);
                    load();
                }}
                onStudentChange={(updated) =>
                    setStudents((prev) =>
                        prev.map((student) => (student.id === updated.id ? updated : student))
                    )
                }
                onPatch={patch}
            />
        );
    }

    const query = search.trim().toLowerCase();
    const filtered = students.filter(
        (student) => (activeFilter === 'all' || student.is_active === (activeFilter === 'active'))
            && (!query || `${student.full_name || ''} ${student.username || ''}`.toLowerCase().includes(query))
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="font-display text-2xl text-white">Clasa mea</h2>
                    <p className="text-sm text-slate-500">
                        Gestionează conturile și repertoriul elevilor.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <input
                        type="search"
                        className="input sm:max-w-xs"
                        placeholder="Caută elev…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        aria-label="Caută elev"
                    />
                    <button type="button" className="btn-gold inline-flex items-center gap-2" onClick={openCreateModal}>
                        <Plus size={16} aria-hidden="true" /> Adaugă elev
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <label htmlFor="student-status-filter">Conturi</label>
                    <select id="student-status-filter" className="input" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="all">Toate</option>
                    </select>
                </div>
                <span className="text-sm text-slate-400">{filtered.length} elevi</span>
            </div>

            {listError && (
                <div role="alert" className="text-sm text-brand-200">
                    {listError}
                    <button type="button" className="btn-ghost ml-2" onClick={load}>Reîncearcă</button>
                </div>
            )}

            {!listError && filtered.length === 0 ? (
                <EmptyState icon="🧒" title="Niciun elev găsit" />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                        <caption className="sr-only">Elevii înscriși și starea conturilor</caption>
                        <thead className="border-b border-white/10 text-slate-400">
                            <tr>
                                <th scope="col" className="px-3 py-3">Nume și prenume</th>
                                <th scope="col" className="px-3 py-3">Username</th>
                                <th scope="col" className="px-3 py-3">Repertoriu</th>
                                <th scope="col" className="px-3 py-3">Stare</th>
                                <th scope="col" className="px-3 py-3">Acțiuni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((student) => {
                                const assigned = counts[student.id] || 0;

                                return (
                                    <tr key={student.id} className="border-b border-white/10">
                                        <td className="px-3 py-3">
                                            <button type="button" className="flex items-center gap-3 text-left font-semibold text-white hover:text-gold-300" onClick={() => setSelectedId(student.id)}>
                                                <Avatar path={student.avatar_path} name={student.full_name} />
                                                <span className="max-w-60 break-words">{student.full_name || '(fără nume)'}</span>
                                            </button>
                                        </td>
                                        <td className="px-3 py-3 text-gold-300">{student.username || '—'}</td>
                                        <td className="px-3 py-3 text-slate-300">{assigned} {assigned === 1 ? 'piesă' : 'piese'}</td>
                                        <td className={`px-3 py-3 ${student.is_active ? 'text-emerald-300' : 'text-brand-200'}`}>{student.is_active ? 'Activ' : 'Inactiv'}</td>
                                        <td className="px-3 py-3">
                                            <button type="button" className="btn-ghost inline-flex items-center gap-2" title={student.is_active ? 'Dezactivează contul' : 'Reactivează contul'}
                                                disabled={student.id === profile?.id || statusBusy}
                                                aria-label={`${student.is_active ? 'Dezactivează' : 'Reactivează'} ${student.full_name}`}
                                                onClick={() => { setStatusTarget(student); setStatusError(''); }}>
                                                {student.is_active ? <UserRoundX size={16} aria-hidden="true" /> : <UserRoundCheck size={16} aria-hidden="true" />}
                                                {student.is_active ? 'Dezactivează' : 'Reactivează'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal open={Boolean(statusTarget)} title={statusTarget?.is_active ? 'Dezactivează elevul' : 'Reactivează elevul'} onClose={() => { if (!statusBusy) setStatusTarget(null); }}>
                <div className="space-y-4">
                    <p className="break-words text-sm text-slate-300">
                        {statusTarget?.is_active ? 'Dezactivezi' : 'Reactivezi'} contul pentru {statusTarget?.full_name}?
                        {statusTarget?.is_active && ' Repertoriul și temele rămân salvate.'}
                    </p>
                    {statusError && <p role="alert" className="text-sm text-brand-200">{statusError}</p>}
                    <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" className="btn-ghost" disabled={statusBusy} onClick={() => setStatusTarget(null)}>Anulează</button>
                        <button type="button" className="btn-gold" disabled={statusBusy} onClick={changeStudentStatus}>
                            {statusBusy ? 'Se salvează…' : 'Confirmă'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal open={createOpen} title="Creează cont de elev" onClose={() => { if (!createStatus.busy) setCreateOpen(false); }} wide>
                <form onSubmit={createStudent} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="label" htmlFor="student-first-name">Prenume</label>
                            <input
                                id="student-first-name"
                                className="input"
                                value={newStudent.firstName}
                                onChange={updateStudentName('firstName')}
                                autoComplete="given-name"
                                maxLength={60}
                                required
                            />
                        </div>
                        <div>
                            <label className="label" htmlFor="student-last-name">Nume</label>
                            <input
                                id="student-last-name"
                                className="input"
                                value={newStudent.lastName}
                                onChange={updateStudentName('lastName')}
                                autoComplete="family-name"
                                maxLength={60}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label" htmlFor="student-username">Username</label>
                        <input
                            id="student-username"
                            className="input"
                            value={newStudent.username}
                            onChange={(event) => {
                                setUsernameEdited(true);
                                setNewStudent((previous) => ({
                                    ...previous,
                                    username: event.target.value.toLowerCase(),
                                }));
                            }}
                            autoCapitalize="none"
                            autoComplete="off"
                            minLength={3}
                            maxLength={30}
                            pattern="[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]"
                            required
                        />
                        <p className="mt-1 text-xs text-slate-500">Litere mici, cifre, punct, _ sau -.</p>
                    </div>

                    <div>
                        <label className="label" htmlFor="student-password">Parolă temporară</label>
                        <div className="flex flex-wrap gap-2">
                            <input
                                id="student-password"
                                className="input min-w-0 flex-1 font-mono"
                                value={newStudent.password}
                                onChange={(event) => setNewStudent((previous) => ({
                                    ...previous,
                                    password: event.target.value,
                                }))}
                                autoComplete="new-password"
                                minLength={12}
                                maxLength={128}
                                required
                            />
                            <button
                                type="button"
                                className="btn-ghost"
                                onClick={() => setNewStudent((previous) => ({
                                    ...previous,
                                    password: generateTemporaryPassword(),
                                }))}
                            >
                                Generează parolă
                            </button>
                        </div>
                    </div>

                    {createStatus.error && (
                        <p role="alert" className="rounded-lg bg-brand-500/15 px-3 py-2 text-sm text-brand-200">
                            {createStatus.error}
                        </p>
                    )}

                    <div className="flex justify-end gap-2">
                        <button type="button" className="btn-ghost" disabled={createStatus.busy} onClick={() => setCreateOpen(false)}>
                            Anulează
                        </button>
                        <button type="submit" className="btn-gold" disabled={createStatus.busy}>
                            {createStatus.busy ? 'Se creează…' : 'Creează contul'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                open={Boolean(createdCredentials)}
                title="Cont creat"
                onClose={() => setCreatedCredentials(null)}
            >
                {createdCredentials && (
                    <div className="space-y-4">
                        <p className="text-sm text-slate-300">
                            Transmite datele elevului acum. Parola nu este salvată în lista clasei.
                        </p>
                        <dl className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
                            <div>
                                <dt className="text-xs text-slate-500">Elev</dt>
                                <dd className="text-white">{createdCredentials.fullName}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-slate-500">Username</dt>
                                <dd className="font-mono text-white">{createdCredentials.username}</dd>
                            </div>
                            <div>
                                <dt className="text-xs text-slate-500">Parolă temporară</dt>
                                <dd className="break-all font-mono text-gold-300">{createdCredentials.password}</dd>
                            </div>
                        </dl>
                        {copyStatus && <p role="status" className="text-xs text-emerald-300">{copyStatus}</p>}
                        <div className="flex justify-end gap-2">
                            <button type="button" className="btn-ghost" onClick={copyCredentials}>
                                Copiază datele
                            </button>
                            <button type="button" className="btn-gold" onClick={() => setCreatedCredentials(null)}>
                                Am transmis parola
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}



