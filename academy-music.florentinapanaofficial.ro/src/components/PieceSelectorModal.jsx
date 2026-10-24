import { useEffect, useMemo, useState } from 'react';
import Modal from './ui/Modal';
import { VARIANT_LIST, resolveAudioSource } from '../lib/pieces';

import { studyLevelLabel } from '../lib/studyLevels';

export default function PieceSelectorModal({ open, pieces, selectedIds, onClose, onConfirm }) {
    const [draft, setDraft] = useState(() => new Set(selectedIds));
    const [search, setSearch] = useState('');
    const [discipline, setDiscipline] = useState('toate');

    // Fiecare deschidere pornește de la selecția salvată, nu de la ce a rămas din sesiunea trecută.
    useEffect(() => {
        if (open) setDraft(new Set(selectedIds));
    }, [open, selectedIds]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        return pieces.filter((piece) => {
            const matchesDiscipline = discipline === 'toate' || piece.discipline === discipline;
            const matchesQuery =
                !query ||
                piece.title.toLowerCase().includes(query) ||
                (piece.composer || '').toLowerCase().includes(query);
            return matchesDiscipline && matchesQuery;
        });
    }, [pieces, search, discipline]);

    function toggle(id) {
        setDraft((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    return (
        <Modal open={open} title="Alege piesele pentru grupă" onClose={onClose} wide>
            <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                        type="search"
                        className="input sm:max-w-xs"
                        placeholder="Caută după titlu sau compozitor…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        aria-label="Caută piesă"
                    />
                    <select
                        className="input w-auto"
                        value={discipline}
                        onChange={(event) => setDiscipline(event.target.value)}
                        aria-label="Filtrează după disciplină"
                    >
                        <option value="toate">Toate disciplinele</option>
                        <option value="orga">Orgă</option>
                        <option value="canto">Canto</option>
                    </select>
                    <span className="ml-auto self-center text-sm text-slate-400">
                        {draft.size} selectate
                    </span>
                </div>

                <ul className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
                    {filtered.length === 0 && (
                        <li className="py-6 text-center text-sm text-slate-500">
                            Nicio piesă nu corespunde filtrelor.
                        </li>
                    )}

                    {filtered.map((piece) => {
                        const checked = draft.has(piece.id);
                        const available = VARIANT_LIST.filter(
                            (variant) => resolveAudioSource(piece, variant.key) !== null
                        );

                        return (
                            <li key={piece.id}>
                                <label
                                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${checked
                                        ? 'border-gold-400/60 bg-gold-500/10'
                                        : 'border-white/10 hover:border-white/25'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggle(piece.id)}
                                        className="h-4 w-4 accent-gold-500"
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-slate-100">
                                            {piece.title}
                                        </span>
                                        <span className="block truncate text-xs text-slate-500">
                                            {piece.composer || 'Compozitor nespecificat'} ·{' '}
                                            {piece.discipline === 'orga' ? 'Orgă' : 'Canto'} ·{' '}
                                            {studyLevelLabel(piece.level)}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-xs text-slate-500">
                                        {available.length === 0
                                            ? 'fără audio'
                                            : available.map((variant) => variant.label).join(' + ')}
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                </ul>

                <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
                    <button type="button" className="btn-ghost" onClick={onClose}>
                        Renunță
                    </button>
                    <button type="button" className="btn-gold" onClick={() => onConfirm([...draft])}>
                        Salvează selecția
                    </button>
                </div>
            </div>
        </Modal>
    );
}
