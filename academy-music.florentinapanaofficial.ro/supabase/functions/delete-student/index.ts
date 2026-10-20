import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowedOrigins = new Set([
  'https://academy-music.florentinapanaofficial.ro',
  'http://localhost:5180',
  'http://127.0.0.1:5180',
]);

function headersFor(request: Request) {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    ...(allowedOrigins.has(origin)
      ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
      : {}),
  };
}

function respond(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headersFor(request), 'Content-Type': 'application/json' },
  });
}

async function removeUserFiles(admin: ReturnType<typeof createClient>, bucket: string, userId: string) {
  const pendingFolders = [userId];
  const paths: string[] = [];

  while (pendingFolders.length > 0) {
    const folder = pendingFolders.pop()!;
    let offset = 0;

    while (true) {
      const { data: entries, error } = await admin.storage.from(bucket).list(folder, {
        limit: 100,
        offset,
      });
      if (error) throw new Error(`Fișierele din ${bucket} nu au putut fi verificate.`);

      for (const entry of entries || []) {
        const path = `${folder}/${entry.name}`;
        if (entry.id) paths.push(path);
        else pendingFolders.push(path);
      }

      if (!entries || entries.length < 100) break;
      offset += entries.length;
    }
  }

  for (let index = 0; index < paths.length; index += 100) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(index, index + 100));
    if (error) throw new Error(`Fișierele din ${bucket} nu au putut fi șterse.`);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: headersFor(request) });
  }
  if (request.method !== 'POST') return respond(request, { error: 'Metodă neacceptată.' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return respond(request, { error: 'Autentificare necesară.' }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice('Bearer '.length);
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return respond(request, { error: 'Sesiune invalidă. Autentifică-te din nou.' }, 401);
  }

  const { data: allowed, error: securityError } = await authClient.rpc('academy_session_allowed');
  if (securityError) return respond(request, { error: 'Verificarea securității nu este disponibilă.' }, 503);
  if (allowed !== true) return respond(request, { error: 'Sesiune revocată sau cont blocat.' }, 403);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: teacher, error: teacherError } = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (teacherError || !['teacher', 'profesor'].includes(teacher?.role) || !teacher.is_active) {
    return respond(request, { error: 'Doar un profesor activ poate șterge conturi de elev.' }, 403);
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return respond(request, { error: 'Date invalide.' }, 400);
  }

  const studentId = String(input.studentId || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId)) {
    return respond(request, { error: 'Identificatorul elevului nu este valid.' }, 400);
  }
  if (studentId === authData.user.id) {
    return respond(request, { error: 'Nu îți poți șterge propriul cont din această pagină.' }, 403);
  }

  const { data: student, error: studentError } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', studentId)
    .maybeSingle();

  if (studentError) return respond(request, { error: 'Contul elevului nu a putut fi verificat.' }, 500);
  if (!student) return respond(request, { error: 'Elevul nu a fost găsit.' }, 404);
  if (!['student', 'elev'].includes(student.role)) {
    return respond(request, { error: 'Poți șterge doar conturi cu rol de elev.' }, 403);
  }

  try {
    await removeUserFiles(admin, 'avatars', studentId);
    await removeUserFiles(admin, 'portfolio', studentId);
  } catch (error) {
    return respond(request, { error: error instanceof Error ? error.message : 'Fișierele elevului nu au putut fi șterse.' }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(studentId);
  if (deleteError) {
    return respond(request, { error: 'Fișierele au fost curățate, dar contul nu a putut fi șters. Reîncearcă.' }, 500);
  }

  return respond(request, { success: true });
});