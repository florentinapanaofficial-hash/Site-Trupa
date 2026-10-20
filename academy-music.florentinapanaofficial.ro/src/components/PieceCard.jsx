import PieceAudio from './PieceAudio';
import { CANTO_VARIANTS } from '../lib/canto';
import SecureAudioPlayer from './SecureAudioPlayer';
import { resolveAudioSource } from '../lib/pieces';
import { Lock } from 'lucide-react';

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

export default function PieceCard({ piece, onOpenScore, onPractice, locked = false, onLocked }) {
    const negativ = resolveAudioSource(piece, 'negativ');
    const pozitiv = resolveAudioSource(piece, 'pozitiv');

    return (
        <article className={`card relative space-y-3 ${locked ? 'overflow-hidden' : ''}`}>
            <div className={locked ? 'space-y-3 opacity-45' : 'space-y-3'}>
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

            {!locked && <div className="space-y-2">
                {CANTO_VARIANTS.filter((variant) => !piece[variant.url] && piece[variant.path]).map((variant) => <div key={variant.key}><p className="mb-1 text-xs text-slate-300">{variant.label}</p><PieceAudio piece={piece} variant={variant} /></div>)}
                {negativ && <SecureAudioPlayer audioUrl={negativ.value} label="Negativ (acompaniament)" />}
                {pozitiv && (
                    <SecureAudioPlayer audioUrl={pozitiv.value} label="Pozitiv (cu voce ghid)" accent="gold" />
                )}
            </div>}

            {piece.tags?.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                    {piece.tags.map((tag) => (
                        <li key={tag} className="badge bg-white/5 text-slate-400">
                            #{tag}
                        </li>
                    ))}
                </ul>
            )}

            {!locked && <footer className="flex flex-wrap gap-2 pt-1">
                {piece.score_path && (
                    <>
                        <button type="button" className="btn-ghost" onClick={() => onOpenScore(piece)}>
                            📄 Vezi partitura
                        </button>
                        {onPractice && <button type="button" className="btn-ghost" onClick={() => onPractice(piece)}>🎹 Exersează cu claviatura</button>}
                    </>
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
            </footer>}
            </div>
            {locked && <button type="button" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-ink-950/65 p-4 text-center text-sm font-semibold text-white transition hover:bg-ink-950/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-gold-400" onClick={onLocked} aria-label={`Piesa ${piece.title} este blocată. Vezi condițiile de deblocare.`}>
                <Lock size={28} aria-hidden="true" />
                <span>Piesă blocată</span>
                <span className="text-xs font-normal text-slate-200">Finalizează temele nivelului tău pentru a debloca nivelul următor.</span>
            </button>}
        </article>
    );
}
