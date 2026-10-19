import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { startMetronome } from '../lib/metronome';

export default function Metronome() {
    const [bpm, setBpm] = useState(100);
    const [playing, setPlaying] = useState(false);
    const [beat, setBeat] = useState(-1);
    const [error, setError] = useState('');
    const bpmRef = useRef(100);
    const audioRef = useRef(null);
    const stopRef = useRef(null);
    const generationRef = useRef(0);

    function stop() {
        generationRef.current += 1;
        stopRef.current?.();
        stopRef.current = null;
        setPlaying(false);
        setBeat(-1);
    }

    async function play() {
        if (playing) { stop(); return; }
        const generation = ++generationRef.current;
        try {
            const AudioClass = window.AudioContext || window.webkitAudioContext;
            audioRef.current ||= new AudioClass();
            await audioRef.current.resume();
            if (generation !== generationRef.current) return;
            stopRef.current?.();
            stopRef.current = startMetronome(audioRef.current, () => bpmRef.current, setBeat);
            setError('');
            setPlaying(true);
        } catch { setError('Metronomul nu a putut porni.'); }
    }

    useEffect(() => {
        const onHidden = () => { if (document.hidden) stop(); };
        document.addEventListener('visibilitychange', onHidden);
        return () => {
            generationRef.current += 1;
            stopRef.current?.();
            document.removeEventListener('visibilitychange', onHidden);
            if (audioRef.current) void audioRef.current.close();
        };
    }, []);

    return <section aria-label="Metronom" className="space-y-3 border-t border-white/15 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg text-white">Metronom</h3>
            <output className="font-mono text-lg text-gold-300">{bpm} BPM</output>
            <button type="button" className="btn-ghost" onClick={() => void play()} title={playing ? 'Oprește metronomul' : 'Pornește metronomul'} aria-label={playing ? 'Oprește metronomul' : 'Pornește metronomul'}>{playing ? <Square size={18} /> : <Play size={18} />}</button>
        </div>
        <input aria-label="Tempo BPM" type="range" min="40" max="240" value={bpm} className="w-full accent-amber-400" onChange={(event) => { bpmRef.current = Number(event.target.value); setBpm(bpmRef.current); }} />
        <div className="flex gap-3" aria-label={`Măsură 4/4${beat >= 0 ? `, timpul ${beat + 1}` : ''}`}>
            {[0, 1, 2, 3].map((position) => <span key={position} className={`h-4 w-4 rounded-full ${beat === position ? position === 0 ? 'bg-amber-400' : 'bg-emerald-400' : 'bg-white/20'}`} />)}
        </div>
        {error && <p role="alert">{error}</p>}
    </section>;
}