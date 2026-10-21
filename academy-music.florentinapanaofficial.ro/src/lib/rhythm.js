export const HIT_WINDOW = 0.18;

export function lowerBound(notes, time) {
    let start = 0;
    let end = notes.length;
    while (start < end) {
        const middle = Math.floor((start + end) / 2);
        if (notes[middle].time < time) start = middle + 1;
        else end = middle;
    }
    return start;
}

export function matchNote(notes, pitch, time, hitIds, rate = 1, start = 0, end = Infinity) {
    const window = HIT_WINDOW * rate;
    return notes.slice(lowerBound(notes, time - window), lowerBound(notes, time + window + 0.000001))
        .filter((note) => note.note === pitch && !hitIds.has(note.id) && note.time >= start && note.time < end)
        .sort((first, second) => Math.abs(first.time - time) - Math.abs(second.time - time))[0] || null;
}

export function accuracy(hits, expected) { return expected ? Math.round(hits / expected * 100) : 0; }

export function rhythmScore(hits, mistakes, total = 12) {
    return Math.max(0, Math.round(hits * 1000 / total) - mistakes * 20);
}
