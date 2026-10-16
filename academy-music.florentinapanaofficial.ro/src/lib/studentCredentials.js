const EMAIL_DOMAIN = 'students.academy.invalid';

export function normalizeUsername(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '.')
        .replace(/\.{2,}/g, '.')
        .replace(/^[._-]+|[._-]+$/g, '')
        .slice(0, 30);
}

export function suggestUsername(firstName, lastName) {
    return normalizeUsername(`${firstName}.${lastName}`);
}

export function loginEmailForIdentity(identity) {
    const value = String(identity || '').trim();
    if (value.includes('@')) return value.toLowerCase();
    return `${normalizeUsername(value)}@${EMAIL_DOMAIN}`;
}

export function generateTemporaryPassword() {
    const groups = [
        'ABCDEFGHJKLMNPQRSTUVWXYZ',
        'abcdefghijkmnopqrstuvwxyz',
        '23456789',
        '!@#$%*-_',
    ];
    const alphabet = groups.join('');
    const randomIndex = (limit) => {
        const ceiling = Math.floor(0x100000000 / limit) * limit;
        const value = new Uint32Array(1);
        do crypto.getRandomValues(value);
        while (value[0] >= ceiling);
        return value[0] % limit;
    };

    const password = groups.map((group) => group[randomIndex(group.length)]);
    while (password.length < 16) password.push(alphabet[randomIndex(alphabet.length)]);

    for (let index = password.length - 1; index > 0; index -= 1) {
        const otherIndex = randomIndex(index + 1);
        [password[index], password[otherIndex]] = [password[otherIndex], password[index]];
    }

    return password.join('');
}