import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, BUCKET_AVATARS } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { invalidateSignedUrl, safeFileName, uploadFile } from '../../lib/media';
import Avatar from '../../components/Avatar';
import DualAudioRow from '../../components/DualAudioRow';
import PieceSelectorModal from '../../components/PieceSelectorModal';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export default function StudentDetail({ student, allPieces, onBack, onStudentChange, onPatch }) {
    const { profile } = useAuth();
    const isSelf = student.id === profile.id;
    const [rows, setRows] = useState(null);
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [avatarPath, setAvatarPath] = useState(student.avatar_path);
    const [groups, setGroups] = useState([]);
    const [memberships, setMemberships] = useState([]);
    const [status, setStatus] = useState({ busy: false, error: '' });
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const fileInputRef = useRef(null);
    const deleteConfirmationValue = student.username || student.full_name || student.id;

    const loadRows = useCallback(async () => {
        const { data, error } = await supabase
            .from('student_pieces')
            .select('piece_id, position, pieces(*)')
            .eq('student_id', student.id)
            .order('position');

        if (error) {
            setStatus({ busy: false, error: 'Repertoriul elevului nu a putut fi încărcat.' });
            setRows([]);
            return;
        }

        setRows((data || []).filter((row) => row.pieces));
    }, [student.id]);

    useEffect(() => {
        setRows(null);
        setAvatarPath(student.avatar_path);
        loadRows();
    }, [student.id, student.avatar_path, loadRows]);

    const loadMemberships = useCallback(async () => {
        const { data } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('student_id', student.id);
        setMemberships((data || []).map((row) => row.group_id));
    }, [student.id]);

    useEffect(() => {
        supabase
            .from('study_groups')
            .select('id, name')
            .order('position')
            .then(({ data }) => setGroups(data || []));
    }, []);

    useEffect(() => {
        loadMemberships();
    }, [loadMemberships]);

    async function toggleGroup(groupId) {
        if (memberships.includes(groupId)) {
            await supabase
                .from('group_members')
                .delete()
                .eq('group_id', groupId)
                .eq('student_id', student.id);
        } else {
            await supabase.from('group_members').insert({ group_id: groupId, student_id: student.id });
        }
        loadMemberships();
    }

    async function handleConfirm(selectedIds) {
        setSelectorOpen(false);

        const current = rows.map((row) => row.piece_id);
        const toAdd = selectedIds.filter((id) => !current.includes(id));
        const toRemove = current.filter((id) => !selectedIds.includes(id));

        if (toRemove.length) {
            await supabase
                .from('student_pieces')
                .delete()
                .eq('student_id', student.id)
                .in('piece_id', toRemove);
        }

        if (toAdd.length) {
            const base = current.length - toRemove.length;
            await supabase.from('student_pieces').insert(
                toAdd.map((pieceId, index) => ({
                    student_id: student.id,
                    piece_id: pieceId,
                    position: base + index,
                    assigned_by: profile.id,
                }))
            );
        }

        loadRows();
    }

    async function persistOrder(nextRows) {
        setRows(nextRows);
        await supabase.from('student_pieces').upsert(
            nextRows.map((row, index) => ({
                student_id: student.id,
                piece_id: row.piece_id,
                position: index,
            }))
        );
    }

    function move(index, direction) {
        const target = index + direction;
        if (target < 0 || target >= rows.length) return;
        const next = [...rows];
        [next[index], next[target]] = [next[target], next[index]];
        persistOrder(next);
    }

    async function removeRow(pieceId) {
        await supabase
            .from('student_pieces')
            .delete()
            .eq('student_id', student.id)
            .eq('piece_id', pieceId);
        loadRows();
    }

    async function handleAvatar(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setStatus({ busy: false, error: 'Alege un fișier imagine.' });
            return;
        }
        if (file.size > MAX_AVATAR_BYTES) {
            setStatus({ busy: false, error: 'Fotografia depășește 5 MB.' });
            return;
        }

        setStatus({ busy: true, error: '' });
        const previous = avatarPath;

        try {
            // Prefixul cu id-ul elevului este cerut de politica RLS de pe bucketul `avatars`.
            const path = `${student.id}/${Date.now()}-${safeFileName(file.name)}`;
            await uploadFile(BUCKET_AVATARS, path, file);

            const { error } = await supabase
                .from('profiles')
                .update({ avatar_path: path })
                .eq('id', student.id);
            if (error) throw error;

            if (previous) {
                await supabase.storage.from(BUCKET_AVATARS).remove([previous]);
                invalidateSignedUrl(BUCKET_AVATARS, previous);
            }

            setAvatarPath(path);
            onStudentChange?.({ ...student, avatar_path: path });
            setStatus({ busy: false, error: '' });
        } catch (err) {
            setStatus({ busy: false, error: err?.message || 'Încărcarea fotografiei a eșuat.' });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    async function handleDeleteStudent() {
        if (deleteConfirmation !== deleteConfirmationValue || deleteBusy) return;

        setDeleteBusy(true);
        setDeleteError('');

        try {
            const { data, error } = await supabase.functions.invoke('delete-student', {
                body: { studentId: student.id },
            });

            if (error) {
                let message = error.message;
                if (error.context instanceof Response) {
                    const body = await error.context.json().catch(() => null);
                    message = body?.error || message;
                }
                throw new Error(message);
            }
            if (!data?.success) throw new Error(data?.error || 'Contul nu a putut fi șters.');

            setDeleteOpen(false);
            onBack();
        } catch (error) {
            setDeleteError(error?.message || 'Ștergerea contului a eșuat.');
        } finally {
            setDeleteBusy(false);
        }
    }

    function closeDeleteModal() {
        if (deleteBusy) return;
        setDeleteOpen(false);
        setDeleteConfirmation('');
        setDeleteError('');
    }

    return (
        <div className="space-y-5">
            <button type="button" className="btn-ghost" onClick={onBack}>
                ← Înapoi la clasă
            </button>

            <header className="card flex flex-wrap items-center gap-4">
                <Avatar path={avatarPath} name={student.full_name} size="lg" />

                <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-2xl text-white">
                        {student.full_name || '(fără nume)'}
                    </h2>
                    <p className="text-sm text-slate-500">
                        {student.role === 'teacher' ? 'Profesor' : 'Elev'}
                        {student.grade_level ? ` · ${student.grade_level}` : ''} · înscris pe{' '}
                        {new Date(student.created_at).toLocaleDateString('ro-RO')}
                    </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                    <label className="btn-ghost cursor-pointer text-xs">
                        {status.busy ? 'Se încarcă…' : 'Schimbă fotografia'}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatar}
                            disabled={status.busy}
                        />
                    </label>
                    <span className="text-xs text-slate-600">JPG sau PNG, maximum 5 MB</span>
                </div>
            </header>

            {status.error && (
                <p className="rounded-lg bg-brand-500/15 px-3 py-2 text-sm text-brand-200">{status.error}</p>
            )}

            <section className="card grid gap-4 sm:grid-cols-3">
                <div>
                    <label className="label" htmlFor="student-role">
                        Rol
                    </label>
                    <select
                        id="student-role"
                        className="input"
                        value={student.role}
                        disabled={isSelf}
                        onChange={(event) => onPatch(student.id, { role: event.target.value })}
                    >
                        <option value="student">Elev</option>
                        <option value="teacher">Profesor</option>
                    </select>
                </div>

                <div>
                    <label className="label" htmlFor="student-grade">
                        Clasă / grupă
                    </label>
                    <input
                        id="student-grade"
                        className="input"
                        defaultValue={student.grade_level || ''}
                        maxLength={40}
                        onBlur={(event) => {
                            const value = event.target.value.trim();
                            if (value !== (student.grade_level || '')) {
                                onPatch(student.id, { grade_level: value || null });
                            }
                        }}
                    />
                </div>

                <div>
                    <span className="label">Acces în platformă</span>
                    <button
                        type="button"
                        disabled={isSelf}
                        onClick={() => onPatch(student.id, { is_active: !student.is_active })}
                        className={`btn w-full ${student.is_active
                            ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                            : 'bg-brand-500/20 text-brand-200 hover:bg-brand-500/30'
                            }`}
                    >
                        {student.is_active ? 'Activ — apasă pentru blocare' : 'Blocat — apasă pentru activare'}
                    </button>
                </div>
            </section>

            {student.role === 'student' && !isSelf && (
                <section className="card border border-red-500/20">
                    <h3 className="text-sm font-semibold text-red-200">Eliminare definitivă</h3>
                    <p className="mt-1 text-xs text-slate-400">
                        Șterge contul elevului și datele asociate. Operația nu poate fi anulată.
                    </p>
                    <button
                        type="button"
                        className="btn mt-3 bg-red-500/15 text-red-200 hover:bg-red-500/25"
                        onClick={() => {
                            setDeleteConfirmation('');
                            setDeleteError('');
                            setDeleteOpen(true);
                        }}
                    >
                        Șterge definitiv contul elevului
                    </button>
                </section>
            )}

            <section className="card">
                <h3 className="text-sm font-semibold text-slate-200">Grupe de studiu</h3>
                <p className="mt-1 text-xs text-slate-500">
                    Elevul primește automat tot repertoriul grupelor din care face parte.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {groups.length === 0 && <p className="text-xs text-slate-600">Nicio grupă definită.</p>}
                    {groups.map((group) => (
                        <button
                            key={group.id}
                            type="button"
                            onClick={() => toggleGroup(group.id)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${memberships.includes(group.id)
                                ? 'bg-gold-500 text-ink-950'
                                : 'border border-white/15 text-slate-400 hover:text-slate-100'
                                }`}
                        >
                            {group.name}
                        </button>
                    ))}
                </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-display text-xl text-white">Repertoriul elevului</h3>
                <button
                    type="button"
                    className="btn-gold"
                    onClick={() => setSelectorOpen(true)}
                    disabled={rows === null}
                >
                    ＋ Alege piese pentru elev
                </button>
            </div>

            {rows === null ? (
                <Spinner label="Se încarcă repertoriul…" />
            ) : rows.length === 0 ? (
                <EmptyState
                    icon="🎼"
                    title="Niciun material alocat"
                    description={`${student.full_name || 'Elevul'} nu are încă piese atribuite.`}
                />
            ) : (
                <div className="space-y-3">
                    {rows.map((row, index) => (
                        <DualAudioRow
                            key={row.piece_id}
                            index={index}
                            piece={row.pieces}
                            isFirst={index === 0}
                            isLast={index === rows.length - 1}
                            onMoveUp={() => move(index, -1)}
                            onMoveDown={() => move(index, 1)}
                            onRemove={() => removeRow(row.piece_id)}
                        />
                    ))}
                </div>
            )}

            <PieceSelectorModal
                open={selectorOpen}
                pieces={allPieces}
                selectedIds={rows ? rows.map((row) => row.piece_id) : []}
                onClose={() => setSelectorOpen(false)}
                onConfirm={handleConfirm}
            />

            <Modal
                open={deleteOpen}
                title="Confirmă ștergerea definitivă"
                onClose={closeDeleteModal}
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-300">
                        Se vor șterge contul, repertoriul individual, apartenența la grupe, temele încărcate,
                        istoricul de activitate, fotografia și fișierele din portofoliu ale elevului.
                    </p>
                    <p className="text-sm text-red-200">
                        Această operație este ireversibilă. Pentru confirmare, scrie exact:
                        <span className="ml-1 font-mono font-semibold">{deleteConfirmationValue}</span>
                    </p>
                    <div>
                        <label className="label" htmlFor="delete-student-confirmation">
                            Username / nume de confirmare
                        </label>
                        <input
                            id="delete-student-confirmation"
                            className="input"
                            value={deleteConfirmation}
                            onChange={(event) => setDeleteConfirmation(event.target.value)}
                            autoComplete="off"
                            autoCapitalize="none"
                            disabled={deleteBusy}
                        />
                    </div>
                    {deleteError && (
                        <p role="alert" className="rounded-lg bg-brand-500/15 px-3 py-2 text-sm text-brand-200">
                            {deleteError}
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
                        <button type="button" className="btn-ghost" onClick={closeDeleteModal} disabled={deleteBusy}>
                            Anulează
                        </button>
                        <button
                            type="button"
                            className="btn bg-red-500/20 text-red-200 hover:bg-red-500/30"
                            onClick={handleDeleteStudent}
                            disabled={deleteBusy || deleteConfirmation !== deleteConfirmationValue}
                        >
                            {deleteBusy ? 'Se șterge…' : 'Șterge definitiv'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
