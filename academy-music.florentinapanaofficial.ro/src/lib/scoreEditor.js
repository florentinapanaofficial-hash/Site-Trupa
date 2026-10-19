import MidiWriter from 'midi-writer-js';

export const SCORE_DURATIONS = { h: { beats: 2, midi: '2', label: 'Doime' }, q: { beats: 1, midi: '4', label: 'Pătrime' }, '8': { beats: 0.5, midi: '8', label: 'Optime' } };
export const SCORE_PITCHES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'];
export const MAX_SCORE_NOTES = 128;
export const SCORE_BPM = 120;

export function pitchFromStaff(y, bottom, spacing) {
    const index = 2 + Math.round((bottom - y) / (spacing / 2));
    return SCORE_PITCHES[Math.max(0, Math.min(SCORE_PITCHES.length - 1, index))];
}

export function scoreTimeline(composition) {
    let time = 0;
    const events = composition.map((event) => {
        if (!SCORE_DURATIONS[event.duration] || (event.pitch !== null && !SCORE_PITCHES.includes(event.pitch))) throw new Error('Nota sau durata nu este validă.');
        const duration = SCORE_DURATIONS[event.duration].beats * 60 / SCORE_BPM;
        const current = { ...event, time, seconds: duration };
        time += duration;
        return current;
    });
    return { events, duration: time };
}

export function scoreMidi(composition, instrument = 'piano') {
    scoreTimeline(composition);
    const track = new MidiWriter.Track();
    track.setTempo(SCORE_BPM);
    track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: instrument === 'accordion' ? 21 : 0 }));
    let rests = 0;
    for (const event of composition) {
        const duration = SCORE_DURATIONS[event.duration];
        if (event.pitch === null) rests += duration.beats;
        else {
            track.addEvent(new MidiWriter.NoteEvent({ pitch: [event.pitch], duration: duration.midi, wait: `T${rests * 128}` }));
            rests = 0;
        }
    }
    track.addEvent(new MidiWriter.EndTrackEvent({ delta: rests * 128 }));
    return new MidiWriter.Writer([track]).buildFile();
}

export function scorePitchNumber(pitch) {
    const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    return (Number(pitch.slice(1)) + 1) * 12 + semitones[pitch[0]];
}