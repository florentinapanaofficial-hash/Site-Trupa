import { jsonResponse, readAuthInput, SecurityError, securityFailure } from './securityServer.js';

const TOPICS = { teorie: 'teorie muzicală elementară și citirea notelor', instrumente: 'recunoașterea și familiile instrumentelor muzicale', ritm: 'durate, pauze, măsuri simple și puls muzical' };
const LEVELS = { incepator: 'începător: noțiuni elementare, formulări foarte simple', mediu: 'intermediar: aplicarea noțiunilor de bază, fără teorie avansată' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const AI_QUIZ_SCHEMA = {
    type: 'object', additionalProperties: false, required: ['title', 'questions'],
    properties: {
        title: { type: 'string' },
        questions: {
            type: 'array', minItems: 5, maxItems: 5, items: {
                type: 'object', additionalProperties: false, required: ['prompt', 'options', 'correctIndex', 'explanation'],
                properties: {
                    prompt: { type: 'string' },
                    options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
                    correctIndex: { type: 'integer', enum: [0, 1, 2, 3] },
                    explanation: { type: 'string' },
                },
            }
        },
    },
};

export class AIGameError extends Error {
    constructor(message, status = 400, code = 'invalid_input') { super(message); this.name = 'AIGameError'; this.status = status; this.code = code; }
}
function invalidQuiz() { throw new AIGameError('AI a returnat un quiz invalid. Nu a fost publicat niciun joc. Încearcă din nou mai târziu.', 502, 'invalid_ai_output'); }
function keys(value, expected) {
    return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}
function text(value, min, max) { return typeof value === 'string' && value.trim().length >= min && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value); }
export function validateAIQuiz(value) {
    if (!keys(value, ['title', 'questions']) || !text(value.title, 3, 100) || !Array.isArray(value.questions) || value.questions.length !== 5) invalidQuiz();
    const prompts = new Set();
    for (const question of value.questions) {
        if (!keys(question, ['prompt', 'options', 'correctIndex', 'explanation']) || !text(question.prompt, 5, 350) || !text(question.explanation, 5, 500)
            || !Array.isArray(question.options) || question.options.length !== 4 || question.options.some(option => !text(option, 1, 120))
            || !Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex > 3) invalidQuiz();
        const normalized = question.options.map(option => option.trim().toLocaleLowerCase('ro-RO'));
        if (new Set(normalized).size !== 4 || prompts.has(question.prompt.trim().toLocaleLowerCase('ro-RO'))) invalidQuiz();
        prompts.add(question.prompt.trim().toLocaleLowerCase('ro-RO'));
    }
    return value;
}
function publicGame(row) {
    const quiz = validateAIQuiz(row.quiz);
    return {
        id: row.id, title: quiz.title, topic: row.topic, level: row.level,
        questions: quiz.questions.map(({ prompt, options }) => ({ prompt, options })),
        score: row.score, answers: row.answers, completed: row.status === 'completed'
    };
}
function databaseError(error) {
    const statuses = { P0429: 429, P0404: 404, P0409: 409, '42501': 403, '22023': 400 };
    if (Object.hasOwn(statuses, error.code)) throw new AIGameError(error.message, statuses[error.code], error.code);
    throw new AIGameError('Salvarea jocurilor AI nu este disponibilă. Profesorul trebuie să verifice migrarea SQL și configurația serverului.', 503, 'database_unavailable');
}
async function providerJSON(response) {
    const reader = response.body?.getReader();
    if (!reader) invalidQuiz();
    const chunks = []; let size = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 65536) { await reader.cancel(); invalidQuiz(); }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    try { return JSON.parse(await new Blob(chunks).text()); }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; invalidQuiz(); }
}

export function createAIGameHandler({ env, createClient, fetch: requestAI = globalThis.fetch, logger = console }) {
    return async ({ request, locals }) => {
        let admin; let gameId; let userId;
        try {
            if (!locals?.academySecurity?.user?.id) throw new SecurityError('unauthorized');
            userId = locals.academySecurity.user.id;
            const input = await readAuthInput(request);
            const action = input.action || 'generate';
            const allowed = action === 'generate' ? ['action', 'topic', 'level'] : action === 'resume' ? ['action', 'gameId'] : ['action', 'gameId', 'questionIndex', 'answerIndex'];
            if (!['generate', 'answer', 'resume'].includes(action) || Object.keys(input).some(key => !allowed.includes(key))) throw new AIGameError('Cerere de joc invalidă.');
            if (action === 'generate') {
                if (!Object.hasOwn(TOPICS, input.topic) || !Object.hasOwn(LEVELS, input.level)) throw new AIGameError('Alege tema și nivelul din lista disponibilă.');
                if (!env.OPENAI_API_KEY?.trim()) throw new AIGameError('Generarea AI nu este configurată. Profesorul trebuie să adauge OPENAI_API_KEY pe server.', 503, 'ai_not_configured');
            } else {
                if (typeof input.gameId !== 'string' || !UUID.test(input.gameId)) throw new AIGameError('Identificatorul jocului este invalid.');
                if (action === 'answer' && (!Number.isInteger(input.questionIndex) || input.questionIndex < 0 || input.questionIndex > 4 || !Number.isInteger(input.answerIndex) || input.answerIndex < 0 || input.answerIndex > 3)) throw new AIGameError('Alege un răspuns valid.');
            }
            if (!env.VITE_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new AIGameError('Configurarea serverului pentru jocuri AI este incompletă.', 503, 'server_configuration');
            admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
            if (action !== 'generate') {
                if (action === 'answer') {
                    const { data, error } = await admin.rpc('ai_game_answer', { p_user: userId, p_game: input.gameId, p_question: input.questionIndex, p_choice: input.answerIndex });
                    if (error) databaseError(error);
                    return jsonResponse(data);
                }
                const { data, error } = await admin.from('ai_game_sessions').select('id,topic,level,status,quiz,score,answers,created_at').eq('id', input.gameId).eq('user_id', userId).maybeSingle();
                if (error) databaseError(error);
                if (!data) throw new AIGameError('Jocul nu a fost găsit.', 404, 'not_found');
                if (!['ready', 'completed'].includes(data.status) || Date.parse(data.created_at) < Date.now() - 86400000) throw new AIGameError('Jocul a expirat sau nu este disponibil.', 409, 'game_unavailable');
                return jsonResponse({ game: publicGame(data) });
            }
            const reservation = await admin.rpc('ai_game_reserve', { p_user: userId, p_topic: input.topic, p_level: input.level });
            if (reservation.error) databaseError(reservation.error);
            gameId = reservation.data;
            let response;
            try {
                response = await requestAI('https://api.openai.com/v1/chat/completions', {
                    method: 'POST', signal: AbortSignal.any([AbortSignal.timeout(25000), request.signal]),
                    headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY.trim(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini', max_completion_tokens: 2500, response_format: { type: 'json_schema', json_schema: { name: 'music_quiz', strict: true, schema: AI_QUIZ_SCHEMA } },
                        messages: [
                            { role: 'system', content: 'Ești un profesor de muzică pentru copii. Generează un quiz educativ original, scurt și prietenos, în limba română cu diacritice. Returnează STRICT un obiect JSON valid conform schemei, fără Markdown, fără blocuri de cod și fără text exterior. Exact 5 întrebări diferite, fiecare cu 4 variante distincte, un singur răspuns corect indicat prin correctIndex (0-3) și o explicație simplă. Titlu 3-100 caractere, întrebare 5-350, variantă 1-120, explicație 5-500. Faptele și notația trebuie să fie corecte și neambigue. Fără versuri, citate din opere protejate, date personale, linkuri sau subiecte nepotrivite copiilor. Nu cere elevului să furnizeze date personale. Încurajează învățarea, nu umilirea sau competiția agresivă.' },
                            { role: 'user', content: 'Tema: ' + TOPICS[input.topic] + '. Nivel: ' + LEVELS[input.level] + '. Creează un nou set de exerciții pentru studiu individual.' },
                        ],
                    }),
                });
            } catch (error) {
                if (['AbortError', 'TimeoutError'].includes(error.name)) throw new AIGameError('Generarea a fost întreruptă sau a durat prea mult. Încearcă mai târziu.', 504, 'ai_timeout');
                if (error instanceof TypeError) throw new AIGameError('Nu putem contacta serviciul AI. Încearcă mai târziu.', 502, 'ai_unavailable');
                throw error;
            }
            if (!response.ok) {
                logger.error('[Academy AI games] Provider HTTP', response.status);
                await response.body?.cancel();
                throw new AIGameError(response.status === 429 ? 'Serviciul AI a atins limita de utilizare. Profesorul trebuie să verifice bugetul și cota OpenAI.' : 'Serviciul AI nu poate genera jocul acum. Profesorul trebuie să verifice configurația.', 502, 'ai_provider_error');
            }
            let result;
            try { result = await providerJSON(response); }
            catch (error) {
                if (['AbortError', 'TimeoutError'].includes(error.name)) throw new AIGameError('Generarea a fost întreruptă sau a durat prea mult. Încearcă mai târziu.', 504, 'ai_timeout');
                throw error;
            }
            if (!result || typeof result !== 'object' || Array.isArray(result)) invalidQuiz();
            const choice = result.choices?.[0];
            if (choice?.message?.refusal || choice?.finish_reason !== 'stop' || typeof choice?.message?.content !== 'string') invalidQuiz();
            let quiz;
            try { quiz = JSON.parse(choice.message.content); }
            catch (error) { if (!(error instanceof SyntaxError)) throw error; invalidQuiz(); }
            validateAIQuiz(quiz);
            const { data, error } = await admin.from('ai_game_sessions').update({ quiz, status: 'ready' }).eq('id', gameId).eq('user_id', userId).eq('status', 'generating').select('id,topic,level,status,quiz,score,answers').single();
            if (error) databaseError(error);
            if (!data) throw new AIGameError('Jocul generat nu a putut fi salvat.', 503, 'database_unavailable');
            return jsonResponse({ game: publicGame(data) });
        } catch (error) {
            if (gameId && admin) {
                try {
                    const { error: updateError } = await admin.from('ai_game_sessions').update({ status: 'failed' }).eq('id', gameId).eq('user_id', userId).eq('status', 'generating');
                    if (updateError) logger.error('[Academy AI games] Failed to mark generation failure:', updateError.code);
                } catch (updateError) { logger.error('[Academy AI games] Failure persistence unavailable:', updateError.name); }
            }
            if (error instanceof SecurityError) return securityFailure(error);
            if (error instanceof AIGameError) {
                if (error.status >= 500) logger.error('[Academy AI games]', error.code);
                const response = jsonResponse({ error: error.message, code: error.code }, error.status);
                if (error.status === 429) response.headers.set('Retry-After', '60');
                return response;
            }
            logger.error('[Academy AI games] Unexpected error:', error.name);
            return jsonResponse({ error: 'Jocul AI nu este disponibil momentan. Încearcă din nou mai târziu.', code: 'server_error' }, 503);
        }
    };
}
