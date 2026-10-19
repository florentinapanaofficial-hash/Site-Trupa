import { Readable } from 'node:stream';
import { createPrivateKey } from 'node:crypto';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_FILE_BYTES + 5 * 1024 * 1024 + 64 * 1024;
const formats = {
    mid: 'audio/midi', midi: 'audio/midi', mp3: 'audio/mpeg',
    webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4', mp4: 'audio/mp4', wav: 'audio/wav',
};

const driveLink = /^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+\/view(?:\?[^\s]*)?$/;

async function checkFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    const mimeType = Object.hasOwn(formats, extension) ? formats[extension] : null;
    if (!mimeType) return { error: 'Format audio/MIDI neacceptat.', status: 415 };
    if (file.size > MAX_FILE_BYTES || (['mid', 'midi'].includes(extension) && file.size > 5 * 1024 * 1024)) return { error: 'Fișier prea mare: maximum 50 MB audio sau 5 MB MIDI.', status: 413 };
    const header = Buffer.from(await file.slice(0, 16).arrayBuffer());
    const valid = {
        mid: header.toString('ascii', 0, 4) === 'MThd', midi: header.toString('ascii', 0, 4) === 'MThd',
        mp3: header.toString('ascii', 0, 3) === 'ID3' || (header[0] === 255 && (header[1] & 224) === 224),
        webm: header.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])),
        ogg: header.toString('ascii', 0, 4) === 'OggS',
        m4a: header.toString('ascii', 4, 8) === 'ftyp', mp4: header.toString('ascii', 4, 8) === 'ftyp',
        wav: header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WAVE',
    }[extension];
    if (!valid) return { error: 'Conținutul fișierului nu corespunde formatului declarat.', status: 415 };
    return { extension, mimeType };
}

export function createHomeworkUpload({ env, createClient, createDrive }) {
    return async function upload(request) {
        const respond = (body, status = 200) => new Response(JSON.stringify(body), {
            status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' },
        });
        if (request.method !== 'POST') return respond({ error: 'Metodă neacceptată.' }, 405);
        const origin = request.headers.get('origin');
        if (origin && origin !== new URL(request.url).origin) return respond({ error: 'Origine nepermisă.' }, 403);
        const authorization = request.headers.get('authorization') || '';
        if (!/^Bearer \S+$/i.test(authorization)) return respond({ error: 'Autentifică-te pentru a trimite tema.' }, 401);
        const url = env.VITE_SUPABASE_URL;
        const anonKey = env.VITE_SUPABASE_ANON_KEY;
        const hasJsonCredentials = env.GOOGLE_CREDENTIALS !== undefined;
        if (!url || !anonKey || !env.GOOGLE_DRIVE_FOLDER_ID || (!hasJsonCredentials && (!env.GOOGLE_CLIENT_EMAIL || !env.GOOGLE_PRIVATE_KEY))) {
            return respond({ error: 'Serviciul de teme nu este configurat.' }, 503);
        }
        try {
            const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
            const { data: auth, error: authError } = await client.auth.getUser(authorization.slice(7));
            if (authError || !auth?.user) return respond({ error: 'Sesiunea a expirat. Autentifică-te din nou.' }, 401);
            const { data: profile, error: profileError } = await client.from('profiles').select('role,is_active,full_name').eq('id', auth.user.id).single();
            if (profileError || !profile?.is_active || !['student', 'elev', 'teacher', 'profesor'].includes(profile.role)) return respond({ error: 'Nu ai permisiunea de a trimite teme.' }, 403);
            let email;
            let key;
            try {
                const credentials = hasJsonCredentials
                    ? JSON.parse(env.GOOGLE_CREDENTIALS)
                    : { client_email: env.GOOGLE_CLIENT_EMAIL, private_key: env.GOOGLE_PRIVATE_KEY };
                if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)
                    || (hasJsonCredentials && credentials.type !== 'service_account')
                    || typeof credentials.client_email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.client_email)
                    || typeof credentials.private_key !== 'string') {
                    throw new Error('Invalid service account credentials');
                }
                email = credentials.client_email;
                key = credentials.private_key.replace(/\\n/g, '\n');
                if (createPrivateKey(key).asymmetricKeyType !== 'rsa') throw new Error('Invalid key type');
            } catch {
                return respond({ error: hasJsonCredentials
                    ? 'Configurația Google Drive este invalidă. Profesorul trebuie să verifice GOOGLE_CREDENTIALS (JSON Service Account și cheie RSA).'
                    : 'Cheia Google Drive este invalidă. Profesorul trebuie să verifice GOOGLE_CLIENT_EMAIL și GOOGLE_PRIVATE_KEY în configurația serverului.' }, 503);
            }
            const contentType = request.headers.get('content-type') || '';
            if (!contentType.startsWith('multipart/form-data;')) return respond({ error: 'Trimite fișierul prin formular multipart.' }, 415);
            if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return respond({ error: 'Fișierul depășește limita de 50 MB.' }, 413);
            const reader = request.body?.getReader();
            if (!reader) return respond({ error: 'Lipsește fișierul.' }, 400);
            const chunks = [];
            let total = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                total += value.byteLength;
                if (total > MAX_BODY_BYTES) { await reader.cancel(); return respond({ error: 'Fișierul depășește limita de 50 MB.' }, 413); }
                chunks.push(value);
            }
            let form;
            try { form = await new Response(new Blob(chunks), { headers: { 'Content-Type': contentType } }).formData(); }
            catch { return respond({ error: 'Formular de încărcare invalid.' }, 400); }
            const title = form.get('title') || '';
            const studentNote = form.get('studentNote') || '';
            const pieceId = form.get('pieceId') || '';
            if (typeof title !== 'string' || title.length > 200 || typeof studentNote !== 'string' || studentNote.length > 500 || typeof pieceId !== 'string' || (pieceId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pieceId))) return respond({ error: 'Datele temei sunt invalide.' }, 400);
            const file = form.get('file');
            if (!file || typeof file === 'string' || !file.size) return respond({ error: 'Selectează un fișier audio sau MIDI.' }, 400);
            const midiFile = form.get('midiFile');
            if (midiFile !== null && (typeof midiFile === 'string' || !midiFile.size)) return respond({ error: 'Fișierul MIDI este invalid.' }, 400);
            const checked = await checkFile(file);
            if (checked.error) return respond({ error: checked.error }, checked.status);
            if (midiFile) {
                const midiChecked = await checkFile(midiFile);
                if (midiChecked.error) return respond({ error: midiChecked.error }, midiChecked.status);
                if (!['mid', 'midi'].includes(midiChecked.extension)) return respond({ error: 'Fișierul MIDI trebuie să fie .mid sau .midi.' }, 415);
            }
            const { extension, mimeType } = checked;
            const baseName = String(profile.full_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'Elev';
            const drive = await createDrive({ email, key });
            const { data } = await drive.files.create({
                requestBody: { name: `${baseName}_Audio.${extension}`, parents: [env.GOOGLE_DRIVE_FOLDER_ID] },
                media: { mimeType, body: Readable.fromWeb(file.stream()) },
                fields: 'id,webViewLink', supportsAllDrives: true,
            });
            if (typeof data?.id !== 'string' || !data.id || !data.webViewLink) return respond({ error: 'Drive nu a returnat linkul temei. Verifică în folder înainte de retrimitere.' }, 502);
            if (!driveLink.test(data.webViewLink)) return respond({ error: 'Drive a returnat un link neacceptat. Contactează profesorul înainte de retrimitere.' }, 502);
            let midiData = null;
            if (midiFile) {
                try {
                    ({ data: midiData } = await drive.files.create({
                        requestBody: { name: `${baseName}_MIDI.mid`, parents: [env.GOOGLE_DRIVE_FOLDER_ID] },
                        media: { mimeType: formats.mid, body: Readable.fromWeb(midiFile.stream()) },
                        fields: 'id,webViewLink', supportsAllDrives: true,
                    }));
                } catch { midiData = null; }
                if (typeof midiData?.id !== 'string' || !midiData.id || !driveLink.test(midiData.webViewLink || '')) return respond({ error: 'Audio a fost încărcat în Drive, dar fișierul MIDI nu a fost confirmat. Verifică folderul înainte de retrimitere.' }, 502);
            }
            try {
                const { error: catalogError } = await client.from('catalog_teme').insert({
                    student_id: auth.user.id,
                    student_name: profile.full_name || '',
                    drive_url: data.webViewLink,
                    ...(midiData ? { midi_url: midiData.webViewLink } : {}),
                    title: title.trim(),
                    student_note: studentNote.trim() || null,
                    piece_id: pieceId || null,
                });
                if (catalogError) throw catalogError;
            } catch {
                return respond({ error: 'Fișierele au fost încărcate în Drive, dar înscrierea în catalog nu a fost confirmată. Contactează profesorul înainte de retrimitere.' }, 503);
            }
            return respond({ success: true, id: data.id, webViewLink: data.webViewLink, ...(midiData ? { midiId: midiData.id, midiWebViewLink: midiData.webViewLink } : {}) }, 201);
        } catch {
            return respond({ error: 'Încărcarea nu a putut fi confirmată. Verifică folderul înainte de retrimitere; dacă problema persistă, contactează profesorul.' }, 502);
        }
    };
}