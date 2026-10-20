import { useRef, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { CANTO_VARIANTS } from '../lib/canto';
import PieceAudio from './PieceAudio';
import KaraokeLyrics from './KaraokeLyrics';

export default function CantoPieceStudio({ piece }) {
    const [showLyrics, setShowLyrics] = useState(false);
    const [active, setActive] = useState(piece.audio_negativ_path || piece.negative_url ? 'negativ' : 'pozitiv');
    const [clocks, setClocks] = useState({ pozitiv: 0, negativ: 0 });
    const [playing, setPlaying] = useState({ pozitiv: false, negativ: false });
    const positiveControls = useRef(null), negativeControls = useRef(null);
    const controls = { pozitiv: positiveControls, negativ: negativeControls };
    const hasSource = active === 'negativ' ? piece.audio_negativ_path || piece.negative_url : piece.audio_pozitiv_path || piece.positive_url;
    return <div className="min-w-0 space-y-4">
        <div className="grid min-w-0 gap-4 md:grid-cols-2">{CANTO_VARIANTS.map(variant => <div key={variant.key} className="min-w-0 space-y-2">
            <PieceAudio piece={piece} variant={variant} controlsRef={controls[variant.key]}
                onPlayback={() => { setActive(variant.key); if (variant.key === 'negativ') setShowLyrics(true); }}
                onPlayingChange={value => setPlaying(previous => previous[variant.key] === value ? previous : { ...previous, [variant.key]: value })}
                onClock={time => setClocks(previous => previous[variant.key] === time ? previous : { ...previous, [variant.key]: time })} />
            {(piece[variant.path] || piece[variant.url]) && <button type="button" className={`btn-ghost text-xs ${active === variant.key ? 'text-gold-300' : ''}`} aria-pressed={active === variant.key} onClick={() => setActive(variant.key)}>Sincronizează cu {variant.label.toLowerCase()}</button>}
        </div>)}</div>
        <details className="rounded-2xl border border-gold-400/20 p-4" open={showLyrics} onToggle={event => setShowLyrics(event.currentTarget.open)}>
            <summary className="cursor-pointer font-semibold text-gold-300">Karaoke · {active === 'negativ' ? 'negativ' : 'pozitiv'}</summary>
            <p className="my-3 text-xs text-slate-300">Sincronizare după sursa selectată. Cuvintele sunt evidențiate doar când textul conține timestamp-uri pe cuvânt; LRC simplu evidențiază linia. Alinierea pozitiv/negativ trebuie verificată de profesor.</p>
            {showLyrics && <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn-gold inline-flex items-center gap-2" disabled={!hasSource} onClick={() => controls[active].current?.togglePlay()} aria-label={playing[active] ? 'Pauză karaoke' : 'Play karaoke'}>{playing[active] ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}{playing[active] ? 'Pauză' : 'Play'}</button>
                    <button type="button" className="btn-ghost inline-flex items-center gap-2" disabled={!hasSource} onClick={() => controls[active].current?.stop()} aria-label="Stop karaoke"><Square size={17} aria-hidden="true" />Stop</button>
                </div>
                <KaraokeLyrics text={piece.versuri_text} time={clocks[active]} />
            </div>}
        </details>
    </div>;
}
