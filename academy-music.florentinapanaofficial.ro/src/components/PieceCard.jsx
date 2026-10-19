import SecureAudioPlayer from './SecureAudioPlayer';
import { resolveAudioSource } from '../lib/pieces';

const LEVEL_STYLE = {
    incepator: 'bg-emerald-500/15 text-emerald-300',
    mediu: 'bg-gold-500/15 text-gold-400',
    avansat: 'bg-brand-500/20 text-brand-200',
};

const LEVEL_LABEL = {
    incepator: 'Începător',
    mediu: 'Mediu',
    avansat: 'Avansat',
};

export default function PieceCard({ piece, onOpenScore }) {
    const negativ = resolveAudioSource(piece, 'negativ');
    const pozitiv = resolveAudioSource(piece, 'pozitiv');

    return (
        <article className="card space-y-3">
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-white">{piece.title}</h3>
                    {piece.composer && <p className="text-sm text-slate-400">{piece.composer}</p>}
                </div>
                <span className={`badge shrink-0 ${LEVEL_STYLE[piece.level] || LEVEL_STYLE.incepator}`}>
                    {LEVEL_LABEL[piece.level] || piece.level}
                </span>
            </header>

            {piece.description && <p className="text-sm text-slate-400">{piece.description}</p>}

            <div className="space-y-2">
                {negativ && <SecureAudioPlayer audioUrl={negativ.value} label="Negativ (acompaniament)" />}
                {pozitiv && (
                    <SecureAudioPlayer audioUrl={pozitiv.value} label="Pozitiv (cu voce ghid)" accent="gold" />
                )}
            </div>

            {piece.tags?.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                    {piece.tags.map((tag) => (
                        <li key={tag} className="badge bg-white/5 text-slate-400">
                            #{tag}
                        </li>
                    ))}
                </ul>
            )}

            <footer className="flex flex-wrap gap-2 pt-1">
                {piece.score_path && (
                    <button type="button" className="btn-ghost" onClick={() => onOpenScore(piece)}>
                        📄 Vezi partitura
                    </button>
                )}
                {piece.youtube_id && (
                    <a
                        className="btn-ghost"
                        href={`https://www.youtube.com/watch?v=${encodeURIComponent(piece.youtube_id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        ▶ Model pe YouTube
                    </a>
                )}
            </footer>
        </article>
    );
}
