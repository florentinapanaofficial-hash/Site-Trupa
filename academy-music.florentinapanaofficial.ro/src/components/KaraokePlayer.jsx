import { useEffect, useRef, useState } from 'react';
import { parseLrc, activeLyricIndex } from '../lib/lrc';
import { isSafeHttpUrl } from '../lib/pieces';

export default function KaraokePlayer({ mediaUrl, lyrics = '' }) {
    const [currentTime, setCurrentTime] = useState(0);
    const [error, setError] = useState('');
    const viewportRef = useRef(null);
    const lineRefs = useRef([]);
    const lines = parseLrc(lyrics);
    const active = activeLyricIndex(lines, currentTime);

    useEffect(() => {
        setCurrentTime(0);
        setError('');
    }, [mediaUrl, lyrics]);

    useEffect(() => {
        const viewport = viewportRef.current;
        const line = lineRefs.current[active];
        if (!viewport) return;
        const top = line ? line.offsetTop - viewport.clientHeight / 2 + line.clientHeight / 2 : 0;
        viewport.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }, [active]);

    return (
        <section className="not-prose rounded-lg border border-white/10 bg-ink-900 p-4" aria-label="Karaoke" onContextMenu={(event) => event.preventDefault()}>
            <audio key={mediaUrl} className="w-full" src={isSafeHttpUrl(mediaUrl) ? mediaUrl : undefined} controls controlsList="nodownload" preload="none"
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                onSeeked={(event) => setCurrentTime(event.currentTarget.currentTime)}
                onError={() => setError('Sursa audio nu este disponibilă.')} />
            {!isSafeHttpUrl(mediaUrl) && <p role="alert">Link audio invalid.</p>}
            {error && <p role="alert" className="text-brand-300">{error}</p>}
            <div ref={viewportRef} className="relative mt-4 h-56 overflow-hidden text-center" tabIndex={0} aria-label="Versuri sincronizate">
                <div className="py-24">
                    {lines.map((line, index) => (
                        <p key={`${line.time}-${index}`} ref={(element) => { lineRefs.current[index] = element; }} aria-current={index === active ? 'true' : undefined}
                            className={`min-h-12 px-2 py-3 text-lg transition-colors ${index === active ? 'font-bold text-gold-400' : 'text-slate-400'}`}>
                            {line.text || '\u00a0'}
                        </p>
                    ))}
                    {!lines.length && <p className="text-slate-400">Nu există versuri sincronizate.</p>}
                </div>
            </div>
        </section>
    );
}