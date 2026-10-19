import { supabase } from './supabase';

export async function uploadHomeworkToDrive({ blob, fileName, midiBlob = null, title = '', studentNote = '', pieceId = '' }) {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new Error('Autentifică-te pentru a trimite tema.');
    const form = new FormData();
    form.set('file', blob, fileName);
    if (midiBlob) form.set('midiFile', midiBlob, 'student.mid');
    if (title) form.set('title', title);
    if (studentNote) form.set('studentNote', studentNote);
    if (pieceId) form.set('pieceId', pieceId);
    const response = await fetch('/api/upload-homework/', {
        method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}` }, body: form,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.webViewLink) throw new Error(result?.error || 'Tema nu a fost trimisă. Încearcă din nou.');
    return result;
}