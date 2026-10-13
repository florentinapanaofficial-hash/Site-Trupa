import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import Avatar from '../../components/Avatar';
import StudentDetail from './StudentDetail';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

export default function AdminStudents() {
    const { profile } = useAuth();
    const [students, setStudents] = useState(null);
    const [allPieces, setAllPieces] = useState([]);
    const [counts, setCounts] = useState({});
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(null);

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
                        Apasă pe un elev pentru repertoriul lui și pentru fotografia de profil.
                    </p>
                </div>
                <input
                    type="search"
                    className="input sm:max-w-xs"
                    placeholder="Caută elev…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label="Caută elev"
                />
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
                Conturile se creează de către elevi din pagina de autentificare. Aici le poți aloca
                repertoriu, schimba fotografia, bloca sau promova.
            </p>
        </div>
    );
}



