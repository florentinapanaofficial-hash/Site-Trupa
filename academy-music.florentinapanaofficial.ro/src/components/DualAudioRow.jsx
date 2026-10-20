import SecureAudioPlayer from './SecureAudioPlayer';
import PieceAudio from './PieceAudio';
import { VARIANT_LIST, resolveAudioSource } from '../lib/pieces';
import { Lock } from 'lucide-react';

export default function DualAudioRow({
    index,
    piece,
    onRemove,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast,
    actions = null,
    locked = false,
    onLocked,
}) {
    return (
        <article className={`card relative p-4 ${locked ? 'overflow-hidden' : ''}`}>
            <div className={locked ? 'opacity-45' : ''}>
            <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500/20 text-sm font-bold text-brand-200">
                    {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-white">{piece.title}</h3>
                    <p className="truncate text-xs text-slate-500">
                        {piece.composer || 'Compozitor nespecificat'} ·{' '}
                        {piece.discipline === 'orga' ? 'Orgă' : 'Canto'}
                    </p>
                </div>

                {!locked && actions}

                {!locked && onRemove && (
                    <div className="flex shrink-0 gap-1">
                        <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-xs"
                            onClick={onMoveUp}
                            disabled={isFirst}
                            aria-label="Mută mai sus"
                        >
                            ↑
                        </button>
                        <button
                            type="button"
                            className="btn-ghost px-2 py-1 text-xs"
                            onClick={onMoveDown}
                            disabled={isLast}
                            aria-label="Mută mai jos"
                        >
                            ↓
                        </button>
                        <button
                            type="button"
                            className="px-2 py-1 text-xs text-brand-300 hover:text-brand-200"
                            onClick={onRemove}
                        >
                            Scoate
                        </button>
                    </div>
                )}
            </div>

            {!locked && <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {VARIANT_LIST.map((variant) => {
                    const source = resolveAudioSource(piece, variant.key);

                    return (
                        <div key={variant.key}>
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {variant.label} <span className="normal-case">({variant.hint})</span>
                            </p>

                            {piece.discipline === 'canto' ? (
                                <PieceAudio piece={piece} variant={{ ...variant, url: variant.urlColumn, path: variant.pathColumn }} />
                            ) : source ? (
                                <SecureAudioPlayer
                                    audioUrl={source.value}
                                    label={`${variant.label} — ${piece.title}`}
                                    accent={variant.accent}
                                />
                            ) : (
                                <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-600">
                                    Indisponibil
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>}
            </div>
            {locked && <button type="button" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-ink-950/65 p-4 text-center text-sm font-semibold text-white transition hover:bg-ink-950/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-gold-400" onClick={onLocked} aria-label={`Piesa ${piece.title} este blocată. Vezi condițiile de deblocare.`}>
                <Lock size={26} aria-hidden="true" /><span>Piesă blocată</span>
                <span className="text-xs font-normal text-slate-200">Finalizează temele nivelului tău pentru a debloca nivelul următor.</span>
            </button>}
        </article>
    );
}
