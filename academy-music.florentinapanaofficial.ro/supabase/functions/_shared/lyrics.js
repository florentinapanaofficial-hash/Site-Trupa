function timestamp(seconds) {
    const hundredths = Math.round(seconds * 100);
    return `${String(Math.floor(hundredths / 6000)).padStart(2, '0')}:${String(Math.floor(hundredths / 100) % 60).padStart(2, '0')}.${String(hundredths % 100).padStart(2, '0')}`;
}

function cleanText(value) { return String(value || '').replace(/[\r\n\[\]<>]/g, ' ').replace(/\s+/g, ' ').trim(); }

export function transcriptionToLrc(data) {
    let result;
    if (Array.isArray(data?.words) && data.words.length) {
        const groups = [];
        let group = [], previousEnd = 0, previousStart = -1;
        for (const item of data.words) {
            if (!Number.isFinite(item.start) || !Number.isFinite(item.end) || item.start < 0 || item.end < item.start || item.start < previousStart) throw new Error('Timestamp-uri AI invalide.');
            const text = cleanText(item.word);
            if (!text) continue;
            if (group.length && (group.length >= 8 || item.start - previousEnd > 1.2)) { groups.push(group); group = []; }
            group.push({ start: item.start, end: item.end, text }); previousEnd = item.end; previousStart = item.start;
            if (/[.!?]$/.test(text)) { groups.push(group); group = []; }
        }
        if (group.length) groups.push(group);
        result = groups.map(words => `[${timestamp(words[0].start)}]` + words.map(word => `<${timestamp(word.start)}>${word.text} <${timestamp(word.end)}>`).join('').trimEnd()).join('\n');
    } else if (Array.isArray(data?.segments) && data.segments.length) {
        result = data.segments.map(segment => {
            if (!Number.isFinite(segment.start) || segment.start < 0) throw new Error('Timestamp-uri AI invalide.');
            const text = cleanText(segment.text);
            if (!text) throw new Error('AI nu a returnat text pentru segment.');
            return `[${timestamp(segment.start)}] ${text}`;
        }).join('\n');
    }
    if (!result?.trim() || result.length > 100000) throw new Error('AI nu a returnat versuri sincronizate valide (maximum 100.000 de caractere).');
    return result;
}
