import { useEffect, useMemo, useRef } from 'react';
import { activeLyricIndex, parseLrc } from '../lib/lrc';

export default function KaraokeLyrics({ text, time }) {
    const lines = useMemo(() => parseLrc(text), [text]);
    const active = activeLyricIndex(lines, time);
    const container = useRef(null);
    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            const root = container.current;
            const target = root?.querySelector('[data-active="true"]');
            if (!target) return;
            const top = target.offsetTop - root.clientHeight / 2 + target.clientHeight / 2;
            root.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        });
        return () => cancelAnimationFrame(frame);
    }, [active, lines]);
    if (!text) return <p className="text-sm text-slate-400">Profesorul nu a adăugat încă versurile.</p>;
    if (!lines.length) return <div className="max-h-60 overflow-y-auto whitespace-pre-wrap text-slate-200" tabIndex={0} aria-label="Versuri fără sincronizare">{text}</div>;
    return <div ref={container} className="relative max-h-60 space-y-4 overflow-y-auto rounded-2xl bg-black/20 p-5" tabIndex={0} aria-label="Versuri karaoke">
        {lines.map((line, index) => {
            const wordIndex = index === active ? activeLyricIndex(line.words || [], time) : -1;
            return <p key={index} data-active={index === active} aria-current={index === active ? 'true' : undefined} className={`text-lg leading-relaxed transition-colors ${index === active ? 'font-semibold text-gold-300' : 'text-slate-400'}`}>
                {line.words?.length ? line.words.map((word, i) => <span key={i} data-word-active={i === wordIndex} className={i === wordIndex ? 'rounded bg-gold-400/20 text-gold-200 underline decoration-gold-400 underline-offset-4' : ''}>{word.text}</span>) : line.text || '\u00a0'}
            </p>;
        })}
    </div>;
}
