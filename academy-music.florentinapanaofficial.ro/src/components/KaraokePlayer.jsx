import { useEffect, useState } from 'react';
import SecureAudioPlayer from './SecureAudioPlayer';
import KaraokeLyrics from './KaraokeLyrics';

export default function KaraokePlayer({ mediaUrl, lyrics = '' }) {
    const [time, setTime] = useState(0);
    useEffect(() => { setTime(0); }, [mediaUrl, lyrics]);
    return <section className="not-prose space-y-4 rounded-2xl border border-white/10 bg-ink-900 p-4" aria-label="Karaoke">
        <SecureAudioPlayer audioUrl={mediaUrl} label="Karaoke" accent="gold" onClock={setTime} />
        <KaraokeLyrics text={lyrics} time={time} />
    </section>;
}
