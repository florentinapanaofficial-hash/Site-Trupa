const STAMP = /^(\d+):([0-5]\d)(?:[.:](\d{1,3}))?$/;

export function parseTimestamp(value) {
    const match = STAMP.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] || 0}`) : null;
}

export function parseLrc(source = '') {
    const rows = String(source).split(/\r?\n/);
    const offset = Number(rows.map(row => /^\[offset:([+-]?\d+)\]$/i.exec(row.trim())).find(Boolean)?.[1] || 0) / 1000;
    const lines = [];
    for (const row of rows) {
        const tags = [...row.matchAll(/\[([^\]]+)\]/g)].filter(tag => parseTimestamp(tag[1]) !== null);
        if (!tags.length) continue;
        const text = row.slice(tags.at(-1).index + tags.at(-1)[0].length).trim();
        const wordTags = [...text.matchAll(/<([^>]+)>([^<]*)/g)].filter(tag => parseTimestamp(tag[1]) !== null);
        for (const tag of tags) {
            const start = parseTimestamp(tag[1]);
            const shift = start - parseTimestamp(tags[0][1]) + offset;
            const words = wordTags.map(word => ({ time: Math.max(0, parseTimestamp(word[1]) + shift), text: word[2] })).sort((a, b) => a.time - b.time);
            lines.push({ time: Math.max(0, start + offset), text: text.replace(/<[^>]+>/g, ''), ...(words.length ? { words } : {}) });
        }
    }
    return lines.sort((a, b) => a.time - b.time);
}

export function activeLyricIndex(items, time) {
    let low = 0, high = items.length - 1, result = -1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (items[mid].time <= time) { result = mid; low = mid + 1; }
        else high = mid - 1;
    }
    return result;
}
