const noteNames = ['Do', 'Do diez', 'Re', 'Re diez', 'Mi', 'Fa', 'Fa diez', 'Sol', 'Sol diez', 'La', 'La diez', 'Si'];
const keyboardKeys = ['z', '1', 'x', '2', 'c', 'v', '3', 'b', '4', 'n', '5', 'm', 'a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k'];
let whiteIndex = -1;
export const PIANO_KEYS = Array.from({ length: 37 }, (_, index) => {
    const note = 48 + index;
    const black = [1, 3, 6, 8, 10].includes(note % 12);
    if (!black) whiteIndex += 1;
    return { note, name: `${noteNames[note % 12]}${Math.floor(note / 12) - 1}`, key: keyboardKeys[index] || '', black, white: whiteIndex };
});

export const INSTRUMENTS = {
    piano: { name: 'Pian', type: 'triangle', attack: 0.003, decay: 1.4, sustain: 0.0001, release: 0.12 },
    accordion: { name: 'Acordeon', type: 'sawtooth', attack: 0.015, decay: 0.08, sustain: 0.035, release: 0.025 },
    flute: { name: 'Nai / Flaut', type: 'sine', attack: 0.09, decay: 0.08, sustain: 0.045, release: 0.15 },
};

export function createVoice(audio, note, when, instrument = 'piano', duration, destination = audio.destination) {
    const preset = INSTRUMENTS[instrument] || INSTRUMENTS.piano;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = preset.type;
    oscillator.frequency.value = noteFrequency(note);
    oscillator.connect(gain);
    gain.connect(destination);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(0.055, when + preset.attack);
    gain.gain.exponentialRampToValueAtTime(preset.sustain, when + preset.attack + preset.decay);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(when);
    const release = (time) => {
        if (typeof gain.gain.cancelAndHoldAtTime === 'function') gain.gain.cancelAndHoldAtTime(time);
        else {
            const elapsed = Math.max(0, time - when);
            const level = elapsed < preset.attack
                ? 0.0001 + (0.055 - 0.0001) * elapsed / preset.attack
                : 0.055 * (preset.sustain / 0.055) ** Math.min(1, (elapsed - preset.attack) / preset.decay);
            gain.gain.cancelScheduledValues(time);
            gain.gain.setValueAtTime(level, time);
        }
        gain.gain.linearRampToValueAtTime(0, time + preset.release);
        oscillator.stop(time + preset.release + 0.01);
    };
    if (duration !== undefined) release(when + Math.max(0.01, duration));
    return { oscillator, gain, release };
}

export const MAX_RECORDING_MS = 300_000;
export const MAX_EVENTS = 2000;
export function noteFrequency(note) { return 440 * 2 ** ((note - 69) / 12); }
export function recordedNote(note, startedAt, endedAt, recordingStart) {
    const timestamp = Math.round(Math.max(0, startedAt - recordingStart));
    return { note, timestamp, duration: Math.max(1, Math.min(Math.round(endedAt - startedAt), MAX_RECORDING_MS - timestamp)) };
}