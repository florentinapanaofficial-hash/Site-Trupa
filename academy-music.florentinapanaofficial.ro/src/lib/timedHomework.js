export const HOMEWORK_BUCKET = 'homework-audio';
export const HOMEWORK_MAX_BYTES = 30 * 1024 * 1024;
export const HOMEWORK_MIME_EXTENSIONS = {
    'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
    'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/aac': 'aac',
};

export function submissionState(start, end, now = Date.now()) {
    const from = Date.parse(start);
    const until = Date.parse(end);
    if (!Number.isFinite(from) || !Number.isFinite(until) || from >= until) return 'invalid';
    if (now < from) return 'upcoming';
    return now <= until ? 'open' : 'expired';
}

export async function submitTimedHomework(client, { assignmentId, submissionStart, submissionEnd, file }) {
    const checkWindow = () => {
        if (submissionState(submissionStart, submissionEnd) !== 'open') {
            throw new Error('Predarea nu este permisă în afara intervalului stabilit de profesor.');
        }
    };
    checkWindow();
    const mime = file.type.split(';')[0].toLowerCase();
    const extension = HOMEWORK_MIME_EXTENSIONS[mime];
    if (!extension || !file.size || file.size > HOMEWORK_MAX_BYTES) {
        throw new Error('Alege un fișier audio MP3, WAV, OGG, WebM, M4A sau AAC, de maximum 30 MB.');
    }
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError) throw authError;
    if (!auth.user) throw new Error('Autentifică-te pentru a trimite tema.');
    const { data: assignment, error: assignmentError } = await client.from('homework_assignments')
        .select('id,student_id,submission_start,submission_end').eq('id', assignmentId).eq('student_id', auth.user.id).single();
    if (assignmentError) throw assignmentError;
    if (Date.parse(assignment.submission_start) !== Date.parse(submissionStart)
        || Date.parse(assignment.submission_end) !== Date.parse(submissionEnd)) {
        throw new Error('Intervalul nu corespunde temei. Reîncarcă lista temelor.');
    }
    checkWindow();
    const path = `${auth.user.id}/${assignmentId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await client.storage.from(HOMEWORK_BUCKET).upload(path, file, { contentType: mime, upsert: false });
    if (uploadError) throw uploadError;
    try {
        checkWindow();
        const { data, error } = await client.from('student_homework').insert({
            student_id: auth.user.id, assignment_id: assignmentId, audio_path: path,
            submission_start: assignment.submission_start, submission_end: assignment.submission_end,
        }).select('id').single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Academy] Audio încărcat, dar predarea nu a fost confirmată:', error);
        throw new Error('Fișierul a fost încărcat, dar predarea nu a fost confirmată. Reîncarcă lista înainte de a reîncerca; dacă termenul a expirat, contactează profesorul.');
    }
}
