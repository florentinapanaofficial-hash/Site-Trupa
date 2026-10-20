import { isSafeHttpUrl } from './pieces.js';

export const CANTO_VARIANTS = [
    { key: 'pozitiv', label: 'Pozitiv', url: 'positive_url', path: 'audio_pozitiv_path' },
    { key: 'negativ', label: 'Negativ', url: 'negative_url', path: 'audio_negativ_path' },
];
export const EMPTY_CANTO = { title: '', grupa: '', description: '', versuri_text: '', positive_url: '', negative_url: '', is_published: true };
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
    if (!file || !/\.mp3$/i.test(file.name) || !['', 'audio/mpeg', 'audio/mp3'].includes(file.type)) throw new Error('Alege un fișier MP3 pentru varianta audio.');
    if (!file.size || file.size > MAX_CANTO_MP3) throw new Error('Fișierul MP3 trebuie să aibă între 1 octet și 30 MB.');
    const bytes = new Uint8Array(await file.slice(0, 3).arrayBuffer());
    if (!(bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51) && !(bytes[0] === 255 && (bytes[1] & 224) === 224)) throw new Error('Fișierul nu are un antet MP3 valid.');
}

export async function validateScorePdf(file) {
    if (!file || !/\.pdf$/i.test(file.name) || !['', 'application/pdf'].includes(file.type) || !file.size || file.size > 20 * 1024 * 1024) throw new Error('Alege un PDF valid de maximum 20 MB.');
    if (new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== '%PDF-') throw new Error('Fișierul nu are un antet PDF valid.');
}

export function saveCantoPiece(options) {
    return saveMusicPiece({ ...options, discipline: 'canto' });
}

export async function saveMusicPiece({ client, upload, removeUploaded, form, files = {}, piece, userId, discipline = 'orga' }) {
    if (!['orga', 'canto'].includes(discipline) || (piece?.discipline && piece.discipline !== discipline)) throw new Error('Disciplină invalidă.');
    const payload = cantoPayload(form);
    if (discipline === 'orga') {
        delete payload.grupa;
        if (!['incepator', 'mediu', 'avansat'].includes(form.level)) throw new Error('Nivel invalid.');
        payload.level = form.level;
        payload.composer = String(form.composer || '').trim() || null;
        payload.youtube_id = String(form.youtube_id || '').trim() || null;
        payload.tags = String(form.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
    }
    if (form.description !== undefined) {
        if (String(form.description).length > 600) throw new Error('Descrierea poate avea maximum 600 de caractere.');
        payload.description = String(form.description).trim() || null;
    }
    for (const variant of CANTO_VARIANTS) if (files[variant.key]) await validateCantoMp3(files[variant.key]);
    if (files.score) await validateScorePdf(files.score);
    const uploaded = [];
    try {
        for (const variant of CANTO_VARIANTS) {
            const file = files[variant.key];
            if (!file) continue;
            const path = `${discipline}/${crypto.randomUUID()}/${variant.key}.mp3`;
            await upload(path, file);
            uploaded.push(path);
            payload[variant.path] = path;
            payload[variant.url] = null;
        }
        if (files.score) {
            const path = `${discipline}/${crypto.randomUUID()}/score.pdf`;
            await upload(path, files.score);
            uploaded.push(path);
            payload.score_path = path;
        }
        const query = piece
            ? client.from('pieces').update(payload).eq('id', piece.id).eq('discipline', discipline)
            : client.from('pieces').insert({ ...payload, discipline, created_by: userId });
        const { data, error } = await query.select('*').single();
        if (error || !data) throw new Error('Piesa nu a putut fi salvată. Verifică datele și permisiunile.');
        return data;
    } catch (error) {
        if (uploaded.length) {
            try {
                const result = await removeUploaded(uploaded);
                if (result?.error) throw result.error;
            } catch (cleanupError) {
                console.error('[Academy] Curățarea uploadurilor a eșuat:', cleanupError.message);
                throw new Error(`${error.message} Fișierele noi pot necesita curățare în Storage.`);
            }
        }
        throw error;
    }
}

export async function saveStudyResource({ client, upload, removeUploaded, form, file, resource, userId }) {
    const title = String(form.title || '').trim();
    const url = String(form.external_url || '').trim();
    if (!title || title.length > 120) throw new Error('Completează titlul (maximum 120 de caractere).');
    if (!['comun', 'orga', 'canto'].includes(form.discipline)) throw new Error('Disciplină invalidă.');
    if (!['partitura', 'fisa-teoretica', 'exercitiu', 'link'].includes(form.category)) throw new Error('Categorie invalidă.');
    if (url && !isSafeHttpUrl(url)) throw new Error('Linkul trebuie să fie HTTP(S).');
    if (!file && !resource?.file_path && !url) throw new Error('Adaugă un PDF sau un link extern.');
    if (String(form.description || '').length > 400) throw new Error('Descrierea poate avea maximum 400 de caractere.');
    if (file) await validateScorePdf(file);
    const payload = { title, discipline: form.discipline, category: form.category, description: String(form.description || '').trim() || null, external_url: url || null };
    let uploaded;
    try {
        if (file) {
            const path = `red/${crypto.randomUUID()}/resource.pdf`;
            await upload(path, file);
            uploaded = path;
            payload.file_path = path;
        }
        const query = resource ? client.from('resources').update(payload).eq('id', resource.id)
            : client.from('resources').insert({ ...payload, created_by: userId });
        const { data, error } = await query.select('*').single();
        if (error || !data) throw new Error('Resursa nu a putut fi salvată.');
        return data;
    } catch (error) {
        if (uploaded) {
            try {
                const result = await removeUploaded([uploaded]);
                if (result?.error) throw result.error;
            } catch (cleanupError) {
                console.error('[Academy] Curățarea PDF-ului a eșuat:', cleanupError.message);
                throw new Error(`${error.message} PDF-ul nou poate necesita curățare în Storage.`);
            }
        }
        throw error;
    }
}
