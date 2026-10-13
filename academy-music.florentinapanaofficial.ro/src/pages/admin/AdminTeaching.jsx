import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import DualAudioRow from '../../components/DualAudioRow';
import PieceSelectorModal from '../../components/PieceSelectorModal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';

const LAST_GROUP_KEY = 'academy-music-last-group';

export default function AdminTeaching() {
    const { profile } = useAuth();
    const [groups, setGroups] = useState(null);
    const [groupId, setGroupId] = useState(null);
    const [rows, setRows] = useState(null);
    const [allPieces, setAllPieces] = useState([]);
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;

        async function load() {
            const [groupsResult, piecesResult] = await Promise.all([
                supabase.from('study_groups').select('*').order('position'),
                supabase.from('pieces').select('*').order('title'),
            ]);

            if (!active) return;

            const list = groupsResult.data || [];
            setGroups(list);
            setAllPieces(piecesResult.data || []);

            const remembered = localStorage.getItem(LAST_GROUP_KEY);
            const initial = list.find((group) => group.id === remembered) || list[0];
            if (initial) setGroupId(initial.id);
        }

        load();
        return () => {
            active = false;
        };
    }, []);

    const loadRows = useCallback(async (id) => {
        const { data, error: loadError } = await supabase
            .from('group_pieces')
            .select('piece_id, position, pieces(*)')
            .eq('group_id', id)
            .order('position');

        if (loadError) {
            setError('Repertoriul grupei nu a putut fi încărcat.');
            setRows([]);
            return;
        }

        setError('');
        setRows((data || []).filter((row) => row.pieces));
    }, []);

    useEffect(() => {
        if (!groupId) return;
        localStorage.setItem(LAST_GROUP_KEY, groupId);
        setRows(null);
        loadRows(groupId);
    }, [groupId, loadRows]);

    async function handleConfirm(selectedIds) {
        setSelectorOpen(false);

        const current = rows.map((row) => row.piece_id);
        const toAdd = selectedIds.filter((id) => !current.includes(id));
        const toRemove = current.filter((id) => !selectedIds.includes(id));

        if (toRemove.length) {
            await supabase
                .from('group_pieces')
                .delete()
                .eq('group_id', groupId)
                .in('piece_id', toRemove);
        }

        if (toAdd.length) {
            const base = current.length - toRemove.length;
            const { error: insertError } = await supabase.from('group_pieces').insert(
                toAdd.map((pieceId, index) => ({
                    group_id: groupId,
                    piece_id: pieceId,
                    position: base + index,
                    added_by: profile.id,
                }))
            );
            if (insertError) setError('Unele piese nu au putut fi adăugate.');
        }

        loadRows(groupId);
    }

    /** Pozițiile se rescriu pentru tot setul: cu 15–20 de piese e mai sigur decât un swap parțial. */
    async function persistOrder(nextRows) {
        setRows(nextRows);
        await supabase.from('group_pieces').upsert(
            nextRows.map((row, index) => ({
                group_id: groupId,
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
        await supabase.from('group_pieces').delete().eq('group_id', groupId).eq('piece_id', pieceId);
        loadRows(groupId);
    }

    if (groups === null) return <Spinner label="Se încarcă grupele…" />;

    if (groups.length === 0) {
        return (
            <EmptyState
                icon="👥"
                title="Nicio grupă definită"
                description="Rulează secțiunea 2b din supabase/schema.sql pentru a crea grupele Începători și Avansați."
            />
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
                {groups.map((group) => (
                    <button
                        key={group.id}
                        type="button"
                        onClick={() => setGroupId(group.id)}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${groupId === group.id
                            ? 'bg-brand-500 text-white'
                            : 'border border-white/15 text-slate-400 hover:text-slate-100'
                            }`}
                    >
                        {group.name}
                    </button>
                ))}

                <button
                    type="button"
                    className="btn-gold ml-auto"
                    onClick={() => setSelectorOpen(true)}
                    disabled={rows === null}
                >
                    ＋ Adaugă piese în player
                </button>
            </div>

            {error && <p className="rounded-lg bg-brand-500/15 px-3 py-2 text-sm text-brand-200">{error}</p>}

            {rows === null ? (
                <Spinner label="Se încarcă repertoriul…" />
            ) : rows.length === 0 ? (
                <EmptyState
                    icon="🎹"
                    title="Grupa nu are încă piese"
                    description={'Apasă „Adaugă piese în player” și bifează piesele pentru ora de astăzi.'}
                />
            ) : (
                <>
                    <p className="text-sm text-slate-500">
                        {rows.length} {rows.length === 1 ? 'piesă pregătită' : 'piese pregătite'} pentru
                        această grupă.
                    </p>

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
                </>
            )}

            <PieceSelectorModal
                open={selectorOpen}
                pieces={allPieces}
                selectedIds={rows ? rows.map((row) => row.piece_id) : []}
                onClose={() => setSelectorOpen(false)}
                onConfirm={handleConfirm}
            />
        </div>
    );
}
