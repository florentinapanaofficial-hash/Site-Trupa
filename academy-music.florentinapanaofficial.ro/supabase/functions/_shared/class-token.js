export function classRole(role) {
    if (['teacher', 'profesor'].includes(role)) return 'profesor';
    if (['student', 'elev'].includes(role)) return 'elev';
    if (role === 'inspector') return role;
    return null;
}

export function classClaims(profile, groupId, config, now = Math.floor(Date.now() / 1000)) {
    const role = classRole(profile.role);
    if (!role || !profile.is_active) throw new Error('Acces refuzat');
    return {
        aud: config.appId, iss: config.appId, sub: config.domain,
        room: `academy-${groupId.toLowerCase()}`,
        iat: now, nbf: now - 10, exp: now + 300,
        context: { user: { id: profile.id, name: profile.full_name || role, moderator: role === 'profesor' ? 'true' : 'false', affiliation: role === 'profesor' ? 'owner' : 'none', lobby_bypass: role === 'profesor' } },
    };
}

export async function signClassToken(claims, secret) {
    const encode = (value) => btoa(String.fromCharCode(...new TextEncoder().encode(value))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    const data = `${encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${encode(JSON.stringify(claims))}`;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
    return `${data}.${btoa(String.fromCharCode(...signature)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;
}