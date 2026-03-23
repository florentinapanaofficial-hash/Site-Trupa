# Notă de Securitate – Implementare GDPR Consimțământ

**Verificat:** 23 martie 2026 | **Standard de referință:** OWASP Top 10

---

## Măsuri de securitate implementate

### 1. Injecție SQL – PREVENITĂ

Toți parametrii trimiși la baza de date folosesc **binding-uri parametrizate** (`?`
în mysql2). IP-ul este hașat direct în SQL (`SHA2(?, 256)`) – nu există șiruri construite
prin concatenare.

```ts
// ✔ CORECT – binding parametrizat
await query(
  'INSERT INTO gdpr_consimtamant (tip_consimtamant, ip_hash) VALUES (?, SHA2(?, 256))',
  [tipConsimtamant, clientIp]
);

// ✘ GREȘIT – concatenare (NICIODATĂ)
// await query(`INSERT ... VALUES ('${tip}', SHA2('${ip}', 256))`);
```

### 2. XSS (Cross-Site Scripting) – PREVENITĂ

Funcția `sanitizeString()` respinge orice input care conține caractere speciale HTML
(`<`, `>`, `"`, `'`, etc.) prin regex pozitiv (`/^[a-z0-9_\-]+$/i`). Răspunsurile JSON
nu reflectă input-ul utilizatorului.

### 3. CSRF (Cross-Site Request Forgery) – MITIGAT

Header-ul `X-Requested-With: XMLHttpRequest` este verificat obligatoriu. Acesta nu
poate fi setat de formulare HTML standard sau de cereri cross-origin fără CORS
pre-aprobat. Pentru acțiuni cu impact financiar sau de autentificare, adăugați
**token CSRF sincron** suplimentar.

### 4. Origine nepermisă (CORS) – BLOCAT

Endpoint-ul respinge toate cererile cu header `Origin` care nu este în whitelist
(`cors.ts`). Răspunsul este **403 Forbidden** fără a reflecta originea solicitantă.

### 5. Rate Limiting – ACTIV

Maxim 10 cereri per IP per minut. Depășirea returnează **429 Too Many Requests**.
Curăță automat intrările vechi pentru a preveni memory leak.

### 6. Minimizare date (Art. 5 RGPD) – RESPECTATĂ

- IP-ul **nu se stochează în clar** – hașat SHA-256 direct în SQL
- Nu se colectează date suplimentare față de cele strict necesare
- User-Agent și Referer sunt trunchiuate la dimensiunile din schemă

### 7. Headers de securitate – ACTIVE pe răspunsuri API

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'
```

### 8. Informații sensibile în loguri – PROTEJATE

Logurile server-side conțin doar primii 4 octeți hex ai IP-ului pentru trasabilitate
(ex: `5a3f***`), nu IP-ul complet. Erorile DB sunt logate complet la server, dar
**niciun detaliu intern nu este expus clientului**.

---

## Măsuri recomandate suplimentar (post-deploy)

| Prioritate | Măsură | Efort |
|---|---|---|
| **Ridicată** | Activare HSTS (`Strict-Transport-Security: max-age=31536000`) pe server | Mic |
| **Ridicată** | Token CSRF sincron pentru acțiuni de autentificare | Mediu |
| **Medie** | WAF (Web Application Firewall) – ex: Cloudflare Free plan | Mic |
| **Medie** | Monitorizare anomalii în loguri (ex: creștere bruscă cereri 429) | Mediu |
| **Mică** | Salt rotire anuală `IP_HASH_SALT` cu re-hașare date existente | Mare |

---

## Puncte *non-blocking* de revizuit la scară

- **Rate limiting în memorie**: La deploy multi-instanță (cluster Node.js), fiecare
  instanță are propriul Map. Migrați la Redis pentru rate limiting distribuit.
- **TTL token CSRF**: Dacă adăugați autentificare, implementați token CSRF cu
  durată limitată (ex: 1 oră), nu header `X-Requested-With` singur.
- **Audit trail**: Pentru cerințe de aderare strictă, considerați un tabel separat
  de audit imutabil (append-only) pentru toate operațiunile pe datele GDPR.
