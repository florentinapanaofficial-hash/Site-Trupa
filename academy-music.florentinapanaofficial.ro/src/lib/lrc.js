export function parseLrc(lyrics = '') {
    const offset = Number(lyrics.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;
    return lyrics.split(/\r?\n/).flatMap((line) => {
        const stamps = [...line.matchAll(/\[(\d+):([0-5]\d)(?:[.:](\d{1,3}))?\]/g)];
        const text = line.replace(/\[[^\]]*\]/g, '').trim();
        return stamps.map((stamp) => ({
            time: Math.max(0, Number(stamp[1]) * 60 + Number(stamp[2]) + Number(`0.${stamp[3] || 0}`) + offset),
            text,
        }));
    }).sort((first, second) => first.time - second.time);
}

export function activeLyricIndex(lines, currentTime) {
    let active = -1;
    for (let index = 0; index < lines.length && lines[index].time <= currentTime; index += 1) active = index;
    return active;
}