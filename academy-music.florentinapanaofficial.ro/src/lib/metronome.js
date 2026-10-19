export function startMetronome(audio, getBpm, onBeat, timers = globalThis) {
    let nextTime = audio.currentTime + 0.05;
    let beat = 0;
    const voices = new Set();
    const visuals = new Set();
    const schedule = () => {
        if (nextTime < audio.currentTime) nextTime = audio.currentTime + 0.01;
        while (nextTime < audio.currentTime + 0.12) {
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.frequency.value = beat === 0 ? 1200 : 800;
            gain.gain.setValueAtTime(0.12, nextTime);
            gain.gain.exponentialRampToValueAtTime(0.001, nextTime + 0.035);
            oscillator.connect(gain);
            gain.connect(audio.destination);
            voices.add(oscillator);
            oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
            oscillator.start(nextTime);
            oscillator.stop(nextTime + 0.04);
            const currentBeat = beat;
            const timeout = timers.setTimeout(() => { visuals.delete(timeout); onBeat(currentBeat); }, Math.max(0, (nextTime - audio.currentTime) * 1000));
            visuals.add(timeout);
            nextTime += 60 / Math.max(40, Math.min(240, getBpm()));
            beat = (beat + 1) % 4;
        }
    };
    schedule();
    const interval = timers.setInterval(schedule, 25);
    return () => {
        timers.clearInterval(interval);
        for (const timeout of visuals) timers.clearTimeout(timeout);
        for (const oscillator of voices) { try { oscillator.stop(); } catch { } }
        visuals.clear();
    };
}