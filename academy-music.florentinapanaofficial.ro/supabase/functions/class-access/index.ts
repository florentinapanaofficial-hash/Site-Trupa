import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.4';
import { classClaims, classRole, signClassToken } from '../_shared/class-token.js';

const origins = new Set(['https://academy-music.florentinapanaofficial.ro', 'http://localhost:5180', 'http://127.0.0.1:5180']);

Deno.serve(async (request: Request) => {
    const origin = request.headers.get('origin') || '';
    const headers = {
        'Content-Type': 'application/json', 'Cache-Control': 'no-store',
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        ...(origins.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    };
    const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return respond({ error: 'Metodă neacceptată' }, 405);
    try {
        const domain = Deno.env.get('JITSI_DOMAIN') || '';
        const appId = Deno.env.get('JITSI_APP_ID') || '';
        const secret = Deno.env.get('JITSI_APP_SECRET') || '';
        if (!/^[a-z0-9.-]+$/i.test(domain) || domain === 'meet.jit.si' || !appId || secret.length < 32 || Deno.env.get('JITSI_SECURE_LOBBY_READY') !== 'true') return respond({ error: 'Jitsi securizat nu este configurat.' }, 503);
        const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: request.headers.get('authorization') || '' } }, auth: { persistSession: false } });
        const { data: auth, error: authError } = await client.auth.getUser();
        if (authError || !auth.user) return respond({ error: 'Neautentificat' }, 401);
        const { groupId } = await request.json();
        if (typeof groupId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(groupId)) return respond({ error: 'Grupă invalidă' }, 400);
        const [profileResult, groupResult, accessResult] = await Promise.all([
            client.from('profiles').select('id,full_name,role,is_active').eq('id', auth.user.id).single(),
            client.from('online_groups').select('id,name').eq('id', groupId).single(),
            client.rpc('can_join_online_group', { group_uuid: groupId }),
        ]);
        const profile = profileResult.data;
        if (profileResult.error || groupResult.error || accessResult.error || accessResult.data !== true || !profile?.is_active || !classRole(profile.role)) return respond({ error: 'Acces refuzat' }, 403);
        const claims = classClaims(profile, groupId, { domain, appId });
        return respond({ jwt: await signClassToken(claims, secret), roomName: claims.room, domain, role: classRole(profile.role), groupName: groupResult.data.name });
    } catch { return respond({ error: 'Cererea nu a putut fi procesată.' }, 400); }
});