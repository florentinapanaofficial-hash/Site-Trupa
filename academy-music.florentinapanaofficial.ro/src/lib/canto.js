import { isSafeHttpUrl } from './pieces.js';

export const CANTO_VARIANTS = [
    { key: 'pozitiv', label: 'Pozitiv', url: 'positive_url', path: 'audio_pozitiv_path' },
    { key: 'negativ', label: 'Negativ', url: 'negative_url', path: 'audio_negativ_path' },
];
export const EMPTY_CANTO = { title: '', grupa: '', versuri_text: '', positive_url: '', negative_url: '', is_published: true };
export const MAX_CANTO_MP3 = 30 * 1024 * 1024;

export function cantoPayload(form) {
    const title = String(form.title || '').trim();
    const grupa = String(form.grupa || '').trim();
    const lyrics = String(form.versuri_text || '');
    if (!title || title.length > 120) throw new Error('Completează titlul piesei (maximum 120 de caractere).');
    if (grupa.length > 100) throw new Error('Grupa poate avea maximum 100 de caractere.');
    if (lyrics.length > 100000) throw new Error('Versurile pot avea maximum 100.000 de caractere.');
    const payload = { title, grupa, versuri_text: lyrics, is_published: Boolean(form.is_published) };
    for (const variant of CANTO_VARIANTS) {
        const url = String(form[variant.url] || '').trim();
        if (url && !isSafeHttpUrl(url)) throw new Error(`Linkul ${variant.label} trebuie să fie HTTP(S).`);
        payload[variant.url] = url || null;
    }
    return payload;
}

export async function validateCantoMp3(file) {
    if (!file || !/\.mp3$/i.test(file.name) || !['', 'audio/mpeg', 'audio/mp3'].includes(file.type)) {
        throw new Error('Alege un fișier MP3 pentru varianta audio.');
    }
    if (!file.size || file.size > MAX_CANTO_MP3) throw new Error('Fișierul MP3 trebuie să aibă între 1 octet și 30 MB.');
    const bytes = new Uint8Array(await file.slice(0, 3).arrayBuffer());
    if (!(bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51)
        && !(bytes[0] === 255 && (bytes[1] & 224) === 224)) {
        throw new Error('Fișierul nu are un antet MP3 valid.');
    }
}

export async function saveCantoPiece({ client, upload, removeUploaded, form, files = {}, piece, userId }) {
    const payload = cantoPayload(form);
    for (const variant of CANTO_VARIANTS) {
        if (files[variant.key]) await validateCantoMp3(files[variant.key]);
    }
    const uploaded = [];
    try {
        for (const variant of CANTO_VARIANTS) {
            const file = files[variant.key];
            if (!file) continue;
            const path = `canto/${crypto.randomUUID()}/${variant.key}.mp3`;
            await upload(path, file);
            uploaded.push(path);
            payload[variant.path] = path;
            payload[variant.url] = null;
        }
        const query = piece
            ? client.from('pieces').update(payload).eq('id', piece.id).eq('discipline', 'canto')
            : client.from('pieces').insert({ ...payload, discipline: 'canto', created_by: userId });
        const { data, error } = await query.select('*').single();
        if (error || !data) throw new Error('Piesa nu a putut fi salvată. Verifică migrarea Canto și permisiunile.');
        return data;
    } catch (error) {
        if (uploaded.length) {
            try {
                const result = await removeUploaded(uploaded);
                if (result?.error) throw result.error;
            } catch {
                throw new Error(`${error.message} Fișierele noi pot necesita curățare în Storage.`);
            }
        }
        throw error;
    }
}