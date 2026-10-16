import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { generateTemporaryPassword, normalizeUsername, suggestUsername } from '../../lib/studentCredentials';
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

    const load = useCallback(async () => {
        const [profilesResult, piecesResult, assignedResult] = await Promise.all([
            supabase.from('profiles').select('*').order('full_name', { ascending: true }),
            supabase.from('pieces').select('*').order('title'),
            supabase.from('student_pieces').select('student_id'),
        ]);

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
        await supabase.from('profiles').update(changes).eq('id', id);
        load();
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
        (student) => !query || (student.full_name || '').toLowerCase().includes(query)
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
                    <button type="button" className="btn-gold" onClick={openCreateModal}>
                        ＋ Creează cont
                    </button>
                </div>
            </div>

            {filtered.length === 0 ? (
                <EmptyState icon="🧒" title="Niciun elev găsit" />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((student) => {
                        const isSelf = student.id === profile.id;
                        const assigned = counts[student.id] || 0;

                        return (
                            <button
                                key={student.id}
                                type="button"
                                onClick={() => setSelectedId(student.id)}
                                className="card flex items-center gap-3 text-left transition hover:-translate-y-0.5 hover:border-white/25"
                            >
                                <Avatar path={student.avatar_path} name={student.full_name} />

                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-semibold text-white">
                                        {student.full_name || '(fără nume)'}
                                        {isSelf && <span className="ml-2 text-xs text-gold-400">(tu)</span>}
                                    </span>
                                    {student.username && (
                                        <span className="block truncate text-xs text-gold-300">{student.username}</span>
                                    )}
                                    <span className="block truncate text-xs text-slate-500">
                                        {student.role === 'teacher' ? 'Profesor' : 'Elev'}
                                        {student.grade_level ? ` · ${student.grade_level}` : ''} ·{' '}
                                        {assigned} {assigned === 1 ? 'piesă' : 'piese'}
                                    </span>
                                </span>

                                {!student.is_active && (
                                    <span className="badge shrink-0 bg-brand-500/20 text-brand-200">Blocat</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            <p className="text-xs text-slate-500">
                Apasă pe un elev pentru repertoriul lui și fotografia de profil. Parola generată este afișată o singură dată.
            </p>

            <Modal open={createOpen} title="Creează cont de elev" onClose={() => setCreateOpen(false)} wide>
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
                                    username: normalizeUsername(event.target.value),
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
                        <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>
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



