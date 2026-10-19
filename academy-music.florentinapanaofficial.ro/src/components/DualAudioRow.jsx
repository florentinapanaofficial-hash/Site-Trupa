import SecureAudioPlayer from './SecureAudioPlayer';
import { VARIANT_LIST, resolveAudioSource } from '../lib/pieces';

export default function DualAudioRow({
    index,
    piece,
    onRemove,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast,
    actions = null,
}) {
    return (
        <article className="card p-4">
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

                {actions}

                {onRemove && (
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

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {VARIANT_LIST.map((variant) => {
                    const source = resolveAudioSource(piece, variant.key);

                    return (
                        <div key={variant.key}>
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {variant.label} <span className="normal-case">({variant.hint})</span>
                            </p>

                            {source ? (
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
            </div>
        </article>
    );
}
