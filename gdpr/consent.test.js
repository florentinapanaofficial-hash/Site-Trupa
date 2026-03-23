/**
 * gdpr/consent.test.js
 * ══════════════════════════════════════════════════════════════════════
 * Teste Jest – Logica de validare din /api/consent
 *
 * Rulare:
 *   npx jest gdpr/consent.test.js --verbose
 *
 * Instalare Jest (dacă nu e prezent):
 *   npm install --save-dev jest
 *   # Adăugați în package.json → "scripts": { "test": "jest" }
 *
 * Acoperire:
 *   • sanitizeString() – validare și sanitizare input
 *   • validateConsentPayload() – logică de validare payload complet
 *   • resolveClientIp() – extragere IP din headere proxy
 *   • isRateLimited() – logică rate limiting
 *
 * NOTĂ: Acestea sunt teste UNITARE ale funcțiilor de validare.
 * Testele de integrare end-to-end (cu DB real) necesită un server
 * Astro pornit și un mediu de testare separat.
 * ══════════════════════════════════════════════════════════════════════
 */


// ──────────────────────────────────────────────────────────────────────
// Funcții extrase din /api/consent pentru testare unitară
// În producție, mutați-le într-un modul separat (lib/gdpr-utils.ts)
// și importați-le atât din endpoint cât și din teste.
// ──────────────────────────────────────────────────────────────────────

const TIPURI_PERMISE = new Set([
    'whatsapp_redirect',
    'phone_call',
    'email_contact',
]);

const CANALE_PERMISE = new Set([
    'whatsapp',
    'telefon',
    'email',
]);

/**
 * Sanitizează un string de input.
 * @returns {string|null} Stringul curat sau null dacă invalid
 */
function sanitizeString(input, maxLen = 64) {
    if (typeof input !== 'string') return null;
    const trimmed = input.trim().slice(0, maxLen);
    if (!/^[a-z0-9_\-]+$/i.test(trimmed)) return null;
    return trimmed;
}

/**
 * Validează payload-ul body JSON primit de endpoint.
 * @returns {{ valid: boolean, tip?: string, canal?: string, eroare?: string }}
 */
function validateConsentPayload(body) {
    const tip = sanitizeString(body?.tip_consimtamant);
    const canal = sanitizeString(body?.canal);

    if (!tip || !TIPURI_PERMISE.has(tip)) {
        return { valid: false, eroare: 'tip_consimtamant invalid sau lipsă' };
    }
    if (!canal || !CANALE_PERMISE.has(canal)) {
        return { valid: false, eroare: 'canal invalid sau lipsă' };
    }
    return { valid: true, tip, canal };
}

/**
 * Extrage IP-ul clientului din headere (simulare pentru test).
 */
function resolveClientIp(headers) {
    if (headers['cf-connecting-ip']) return headers['cf-connecting-ip'].trim();
    if (headers['x-forwarded-for']) return headers['x-forwarded-for'].split(',')[0].trim();
    if (headers['x-real-ip']) return headers['x-real-ip'].trim();
    return 'unknown';
}

/**
 * Rate limiter simplu (Map în memorie) – versiune testabilă.
 * Returnează o funcție isRateLimited(ip) pentru izolare în teste.
 */
function createRateLimiter(windowMs = 60_000, limit = 10) {
    const store = new Map();
    return function isRateLimited(ip) {
        const now = Date.now();
        const ts = (store.get(ip) ?? []).filter(t => now - t < windowMs);
        if (ts.length >= limit) return true;
        ts.push(now);
        store.set(ip, ts);
        return false;
    };
}


// ══════════════════════════════════════════════════════════════════════
// SUITE 1: sanitizeString()
// ══════════════════════════════════════════════════════════════════════

describe('sanitizeString()', () => {

    describe('valori valide', () => {
        test('acceptă string alfanumeric simplu', () => {
            expect(sanitizeString('whatsapp')).toBe('whatsapp');
        });

        test('acceptă string cu underscore', () => {
            expect(sanitizeString('whatsapp_redirect')).toBe('whatsapp_redirect');
        });

        test('acceptă string cu cratimă', () => {
            expect(sanitizeString('phone-call')).toBe('phone-call');
        });

        test('acceptă litere mari și mici', () => {
            expect(sanitizeString('EmailContact')).toBe('EmailContact');
        });

        test('trunchiază corect la maxLen (implicit 64)', () => {
            const lung = 'a'.repeat(100);
            expect(sanitizeString(lung)).toHaveLength(64);
        });

        test('trunchiază la maxLen personalizat', () => {
            expect(sanitizeString('abcdefghij', 5)).toBe('abcde');
        });

        test('elimină spații de la capete (trim)', () => {
            expect(sanitizeString('  whatsapp  ')).toBe('whatsapp');
        });
    });

    describe('valori invalide → null', () => {
        test('respinge number', () => {
            expect(sanitizeString(123)).toBeNull();
        });

        test('respinge boolean', () => {
            expect(sanitizeString(true)).toBeNull();
        });

        test('respinge null', () => {
            expect(sanitizeString(null)).toBeNull();
        });

        test('respinge undefined', () => {
            expect(sanitizeString(undefined)).toBeNull();
        });

        test('respinge array', () => {
            expect(sanitizeString(['whatsapp'])).toBeNull();
        });

        test('respinge tag HTML (XSS)', () => {
            expect(sanitizeString('<script>alert(1)</script>')).toBeNull();
        });

        test('respinge injecție SQL simplă', () => {
            expect(sanitizeString("'; DROP TABLE users; --")).toBeNull();
        });

        test('respinge path traversal', () => {
            expect(sanitizeString('../../etc/passwd')).toBeNull();
        });

        test('respinge spații în mijloc', () => {
            expect(sanitizeString('hello world')).toBeNull();
        });

        test('respinge caractere speciale', () => {
            expect(sanitizeString('test@email.com')).toBeNull();
            expect(sanitizeString('test!value')).toBeNull();
            expect(sanitizeString('test/value')).toBeNull();
        });

        test('respinge string gol după trim', () => {
            expect(sanitizeString('   ')).toBeNull();
        });
    });
});


// ══════════════════════════════════════════════════════════════════════
// SUITE 2: validateConsentPayload()
// ══════════════════════════════════════════════════════════════════════

describe('validateConsentPayload()', () => {

    describe('payload-uri valide', () => {
        test('whatsapp_redirect + whatsapp', () => {
            const r = validateConsentPayload({ tip_consimtamant: 'whatsapp_redirect', canal: 'whatsapp' });
            expect(r.valid).toBe(true);
            expect(r.tip).toBe('whatsapp_redirect');
            expect(r.canal).toBe('whatsapp');
        });

        test('phone_call + telefon', () => {
            const r = validateConsentPayload({ tip_consimtamant: 'phone_call', canal: 'telefon' });
            expect(r.valid).toBe(true);
        });

        test('email_contact + email', () => {
            const r = validateConsentPayload({ tip_consimtamant: 'email_contact', canal: 'email' });
            expect(r.valid).toBe(true);
        });
    });

    describe('tip_consimtamant invalid', () => {
        test('respinge tip necunoscut', () => {
            const r = validateConsentPayload({ tip_consimtamant: 'redirect_malitios', canal: 'whatsapp' });
            expect(r.valid).toBe(false);
            expect(r.eroare).toMatch(/tip_consimtamant/);
        });

        test('respinge tip cu XSS', () => {
            const r = validateConsentPayload({ tip_consimtamant: '<img onerror=alert(1)>', canal: 'whatsapp' });
            expect(r.valid).toBe(false);
        });

        test('respinge tip cu SQL injection', () => {
            const r = validateConsentPayload({
                tip_consimtamant: "'; DROP TABLE gdpr_consimtamant; --",
                canal: 'whatsapp',
            });
            expect(r.valid).toBe(false);
        });

        test('respinge tip lipsă', () => {
            const r = validateConsentPayload({ canal: 'whatsapp' });
            expect(r.valid).toBe(false);
        });
    });

    describe('canal invalid', () => {
        test('respinge canal necunoscut', () => {
            const r = validateConsentPayload({ tip_consimtamant: 'whatsapp_redirect', canal: 'telegram' });
            expect(r.valid).toBe(false);
            expect(r.eroare).toMatch(/canal/);
        });

        test('respinge canal lipsă', () => {
            const r = validateConsentPayload({ tip_consimtamant: 'whatsapp_redirect' });
            expect(r.valid).toBe(false);
        });
    });

    describe('body complet invalid', () => {
        test('respinge null', () => {
            expect(validateConsentPayload(null).valid).toBe(false);
        });

        test('respinge undefined', () => {
            expect(validateConsentPayload(undefined).valid).toBe(false);
        });

        test('respinge obiect gol', () => {
            expect(validateConsentPayload({}).valid).toBe(false);
        });

        test('respinge string în loc de obiect', () => {
            expect(validateConsentPayload('whatsapp_redirect').valid).toBe(false);
        });
    });
});


// ══════════════════════════════════════════════════════════════════════
// SUITE 3: resolveClientIp()
// ══════════════════════════════════════════════════════════════════════

describe('resolveClientIp()', () => {
    test('preferă cf-connecting-ip (Cloudflare)', () => {
        expect(resolveClientIp({ 'cf-connecting-ip': '1.2.3.4' })).toBe('1.2.3.4');
    });

    test('folosește primul IP din x-forwarded-for', () => {
        expect(resolveClientIp({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' })).toBe('5.6.7.8');
    });

    test('folosește x-real-ip dacă lipsesc celelalte', () => {
        expect(resolveClientIp({ 'x-real-ip': '9.10.11.12' })).toBe('9.10.11.12');
    });

    test('returnează "unknown" dacă nu există niciun header', () => {
        expect(resolveClientIp({})).toBe('unknown');
    });

    test('elimină spații din jurul IP-ului Cloudflare', () => {
        expect(resolveClientIp({ 'cf-connecting-ip': '  1.2.3.4  ' })).toBe('1.2.3.4');
    });

    test('cf-connecting-ip are prioritate față de x-forwarded-for', () => {
        expect(resolveClientIp({
            'cf-connecting-ip': '1.2.3.4',
            'x-forwarded-for': '99.99.99.99',
        })).toBe('1.2.3.4');
    });
});


// ══════════════════════════════════════════════════════════════════════
// SUITE 4: isRateLimited() – rate limiter
// ══════════════════════════════════════════════════════════════════════

describe('isRateLimited()', () => {
    test('nu blochează primele N cereri (sub limită)', () => {
        const isRateLimited = createRateLimiter(60_000, 3);
        expect(isRateLimited('1.2.3.4')).toBe(false);
        expect(isRateLimited('1.2.3.4')).toBe(false);
        expect(isRateLimited('1.2.3.4')).toBe(false);
    });

    test('blochează cererea N+1 (>=limită)', () => {
        const isRateLimited = createRateLimiter(60_000, 3);
        isRateLimited('1.2.3.4');
        isRateLimited('1.2.3.4');
        isRateLimited('1.2.3.4');
        // A 4-a cerere trebuie blocată
        expect(isRateLimited('1.2.3.4')).toBe(true);
    });

    test('IP-uri diferite nu se afectează reciproc', () => {
        const isRateLimited = createRateLimiter(60_000, 2);
        isRateLimited('1.1.1.1');
        isRateLimited('1.1.1.1');
        isRateLimited('1.1.1.1'); // blocat
        // Alt IP nu e afectat
        expect(isRateLimited('2.2.2.2')).toBe(false);
    });
});
