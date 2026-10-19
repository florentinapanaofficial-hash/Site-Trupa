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
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice('Bearer '.length);
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) {
    return respond(request, { error: 'Sesiune invalidă. Autentifică-te din nou.' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: teacher, error: teacherError } = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (teacherError || !['teacher', 'profesor'].includes(teacher?.role) || !teacher.is_active) {
    return respond(request, { error: 'Doar un profesor activ poate crea conturi.' }, 403);
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return respond(request, { error: 'Date invalide.' }, 400);
  }

  const firstName = String(input.firstName || '').trim();
  const lastName = String(input.lastName || '').trim();
  const username = String(input.username || '').trim();
  const password = String(input.password || '');
  const fullName = `${firstName} ${lastName}`.trim();

  if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60) {
    return respond(request, { error: 'Completează numele și prenumele (maximum 60 de caractere fiecare).' }, 400);
  }
  if (
    username !== username.toLowerCase()
    || !/^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/.test(username)
    || username.includes('..')
  ) {
    return respond(request, { error: 'Username-ul trebuie să aibă 3–30 de caractere: litere mici, cifre, punct, _ sau -.' }, 400);
  }
  if (password.length < 12 || password.length > 128) {
    return respond(request, { error: 'Parola generată trebuie să aibă între 12 și 128 de caractere.' }, 400);
  }

  const { data: existing, error: lookupError } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (lookupError) return respond(request, { error: 'Nu am putut verifica username-ul.' }, 500);
  if (existing) return respond(request, { error: 'Username-ul este deja folosit. Alege altul.' }, 409);

  const email = `${username}@students.academy.invalid`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    return respond(request, { error: 'Contul nu a putut fi creat. Verifică username-ul și încearcă din nou.' }, 400);
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .update({ full_name: fullName, username, role: 'student' })
    .eq('id', created.user.id)
    .select('id')
    .maybeSingle();

  if (profileError || !profile) {
    await admin.auth.admin.deleteUser(created.user.id);
    return respond(request, { error: 'Profilul nu a putut fi salvat; contul temporar a fost șters.' }, 500);
  }

  return respond(request, { id: created.user.id, fullName, username }, 201);
});