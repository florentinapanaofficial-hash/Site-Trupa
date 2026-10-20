import { transcriptionToLrc } from '../_shared/lyrics.js';

const ORIGINS = new Set(['https://academy-music.florentinapanaofficial.ro', 'http://localhost:5180', 'http://127.0.0.1:5180']);
const MAX_AUDIO = 24 * 1024 * 1024;

export function createLyricsHandler({ createClient, env, fetch: requestProvider = globalThis.fetch, logger = console }) {
    return async request => {
        const origin = request.headers.get('origin');
        const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', ...(ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}) };
        const respond = (error, status) => new Response(JSON.stringify({ error }), { status, headers });
        if (origin && !ORIGINS.has(origin)) return respond('Origine neautorizată.', 403);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
        if (request.method !== 'POST') return respond('Metodă neacceptată.', 405);
        const auth = request.headers.get('Authorization');
        if (!auth?.startsWith('Bearer ')) return respond('Autentificare necesară.', 401);
        if (Number(request.headers.get('content-length')) > 2048) return respond('Cerere prea mare.', 413);
        try {
            const authClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } });
            const { data: authenticated, error: authError } = await authClient.auth.getUser(auth.slice(7));
            if (authError || !authenticated.user) return respond('Sesiune invalidă.', 401);
            const { data: allowed, error: sessionError } = await authClient.rpc('academy_session_allowed');
            if (sessionError) return respond('Verificarea securității nu este disponibilă.', 503);
            if (allowed !== true) return respond('Sesiune revocată sau cont blocat.', 403);
            const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
            const { data: teacher, error: teacherError } = await admin.from('profiles').select('role,is_active,is_locked').eq('id', authenticated.user.id).maybeSingle();
            if (teacherError) return respond('Profilul nu poate fi verificat.', 503);
            if (!teacher?.is_active || teacher.is_locked || !['teacher', 'profesor'].includes(teacher.role)) return respond('Doar un profesor activ poate genera versuri.', 403);
            let input;
            try {
                const reader = request.body?.getReader();
                if (!reader) return respond('Date JSON invalide.', 400);
                const decoder = new TextDecoder();
                let text = '', size = 0;
                try {
                    while (true) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        size += value.byteLength;
                        if (size > 2048) { await reader.cancel(); return respond('Cerere prea mare.', 413); }
                        text += decoder.decode(value, { stream: true });
                    }
                    text += decoder.decode();
                } finally { reader.releaseLock(); }
                input = JSON.parse(text);
            } catch { return respond('Date JSON invalide.', 400); }
            if (!input || typeof input !== 'object' || input.consent !== true || typeof input.pieceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.pieceId) || typeof input.audioPath !== 'string') return respond('Selectează o piesă salvată și confirmă dreptul de prelucrare a înregistrării.', 400);
            const { data: piece, error: pieceError } = await authClient.from('pieces').select('id,audio_pozitiv_path,positive_url').eq('id', input.pieceId).maybeSingle();
            if (pieceError) return respond('Piesa nu a putut fi verificată.', 503);
            const path = piece?.audio_pozitiv_path;
            if (!path || piece.positive_url?.trim() || path !== input.audioPath || path.includes('..') || path.startsWith('/') || !/^[a-zA-Z0-9_\-/]+\.mp3$/i.test(path)) return respond('Pozitivul salvat în Storage nu corespunde piesei.', 400);
            const key = env('OPENAI_API_KEY');
            if (!key) return respond('Generarea AI nu este configurată. Administratorul trebuie să seteze OPENAI_API_KEY în Edge Function.', 503);
            const bucket = admin.storage.from('academy-media');
            const { data: info, error: infoError } = await bucket.info(path);
            if (infoError || !info) return respond('Fișierul audio nu este disponibil.', 404);
            if (!Number.isFinite(info.size) || info.size <= 0 || info.size > MAX_AUDIO) return respond('Pentru AI, pozitivul MP3 trebuie să aibă maximum 24 MB.', 413);
            const { data: reserved, error: reserveError } = await admin.rpc('academy_reserve_lyrics_request', { teacher_id: authenticated.user.id });
            if (reserveError) return respond('Limitarea cererilor AI nu este configurată. Aplică migrarea generate-lyrics.', 503);
            if (reserved !== true) return respond('Ai trimis deja o cerere AI. Așteaptă două minute înainte de a reîncerca.', 429);
            const { data: audio, error: audioError } = await bucket.download(path);
            if (audioError || !audio) return respond('Fișierul audio nu a putut fi citit.', 502);
            if (!audio.size || audio.size > MAX_AUDIO) return respond('Pentru AI, pozitivul MP3 trebuie să aibă maximum 24 MB.', 413);
            const bytes = new Uint8Array(await audio.slice(0, 3).arrayBuffer());
            if (!(bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51) && !(bytes[0] === 255 && (bytes[1] & 224) === 224)) return respond('Fișierul salvat nu are un antet MP3 valid.', 400);
            const form = new FormData();
            form.append('file', audio, 'positive.mp3'); form.append('model', 'whisper-1'); form.append('language', 'ro');
            form.append('response_format', 'verbose_json'); form.append('timestamp_granularities[]', 'word'); form.append('timestamp_granularities[]', 'segment');
            const response = await requestProvider('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.any([request.signal, AbortSignal.timeout(110000)]) });
            if (!response.ok) {
                logger.error('[generate-lyrics] Provider status:', response.status);
                return respond(response.status === 429 ? 'Serviciul AI este ocupat sau cota a fost atinsă. Reîncearcă mai târziu.' : 'Serviciul AI nu a putut transcrie fișierul. Verifică configurarea și încearcă din nou.', 502);
            }
            const lrc = transcriptionToLrc(await response.json());
            return new Response(JSON.stringify({ lrc, provider: 'OpenAI Whisper', reviewRequired: true }), { status: 200, headers });
        } catch (error) {
            if (error.name === 'TimeoutError' || error.name === 'AbortError') return respond('Transcrierea a fost întreruptă sau a depășit timpul disponibil. Reîncearcă mai târziu.', 504);
            logger.error('[generate-lyrics] Processing failed:', error.name);
            return respond('Generarea versurilor a eșuat. Nu s-a modificat piesa; verifică funcția și reîncearcă.', 502);
        }
    };
}
