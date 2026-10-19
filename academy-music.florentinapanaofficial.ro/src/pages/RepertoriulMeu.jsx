import { useState } from 'react';
import { useMyRepertoire } from '../lib/useMyRepertoire';
import DualAudioRow from '../components/DualAudioRow';
import RecordingStudio from '../components/RecordingStudio';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { useAuth } from '../lib/auth';

export default function RepertoriulMeu() {
    const { isInspector } = useAuth();
    const { rows } = useMyRepertoire();
    const [studioPiece, setStudioPiece] = useState(null);

    return (
        <div className="space-y-6">
            <header className="card">
                <span className="text-3xl" aria-hidden="true">
                    🎼
                </span>
                <h1 className="mt-2 font-display text-3xl text-white">Repertoriul meu</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                    Biblioteca de studiu comună. Exersează pe negativ, apoi înregistrează-ți tema
                    direct din platformă.
                </p>
            </header>

            {rows === null ? (
                <Spinner label="Se încarcă repertoriul…" />
            ) : rows.length === 0 ? (
                <EmptyState
                    icon="🎵"
                    title="Nu ai încă piese alocate"
                    description="Doamna profesoară îți va trimite curând primele piese de studiu."
                />
            ) : (
                <div className="space-y-3">
                    {rows.map((row, index) => (
                        <DualAudioRow
                            key={row.piece_id}
                            index={index}
                            piece={row.pieces}
                            actions={
                                !isInspector && <button
                                    type="button"
                                    className="btn-gold shrink-0 px-3 py-1.5 text-xs"
                                    onClick={() => setStudioPiece(row.pieces)}
                                >
                                    ● Înregistrează tema
                                </button>
                            }
                        />
                    ))}
                </div>
            )}

            <RecordingStudio
                open={Boolean(studioPiece)}
                piece={studioPiece}
                onClose={() => setStudioPiece(null)}
            />
        </div>
    );
}
