# Release Notes — florentinapanaofficial.ro

> Data: 19 martie 2026

---

## SEO implementat

### Meta tags & Open Graph
- `og:type` dinamic per pagină: `website` (homepage), `article` (blog), `video.other` (video)
- `og:image` convertit la URL absolut (`https://florentinapanaofficial.ro/...`) — obligatoriu pentru sharing corect
- `og:image:width=1200`, `og:image:height=630`, `og:locale=ro_RO`, `og:site_name`
- `twitter:card=summary_large_image` pe toate paginile
- `<link rel="canonical">` absolut pe toate paginile
- `<slot name="head">` în BaseLayout — permite injecție de meta per pagină

### JSON-LD Structured Data
| Pagină | Schema |
|---|---|
| Homepage | `MusicGroup` + `LocalBusiness` + `FAQPage` (3 întrebări din `siteContent.json`) |
| Blog `[slug]` | `Article` cu `headline`, `datePublished`, `author`, `publisher` |
| Video `[slug]` | `VideoObject` cu `embedUrl`, `thumbnailUrl` (YouTube) |
| `/colaboratori/saxofon` | `Person` cu `jobTitle`, `worksFor` |
| `/colaboratori/tambal` | `Person` cu `jobTitle`, `worksFor` |

### Crawlability
- `robots.txt` — `Disallow: /admin/` și `Disallow: /api/`
- `sitemap-index.xml` generat automat (`@astrojs/sitemap@3.1.6`, **pinned** — 3.5+ necesită Astro 5)

### Analytics
- GA4 injectat condiționat prin `PUBLIC_GA4_ID` — dacă variabila lipsește, niciun script nu se încarcă
- Evenimente GA4 pe pagina Contact:
  - `click_phone` — buton telefon + „Apelează direct"
  - `click_whatsapp` — butoane WhatsApp
  - `generate_lead` — submit formular rezervare rapidă

---

## API Security implementat

### CORS strict (`src/lib/cors.ts`)
- Whitelist construit la runtime din env vars: `PUBLIC_SITE_URL`, `PUBLIC_SITE_URL_WWW` + fallback hardcodat
- `checkOrigin(request)` returnează `{ allowed, origin }` cu 3 stări:
  - `allowed: true, origin: string` — cross-origin autorizat → setează `ACAO` + `Vary: Origin`
  - `allowed: true, origin: null` — fără header `Origin` (same-origin / server-to-server) → fără CORS headers
  - `allowed: false, origin: null` — origin neautorizat → **403** + `{ error: "Origin not allowed" }`, fără reflecție
- Aplicat în `comentarii.ts` (GET + POST) și `upload-photo.ts` (POST)

### OPTIONS preflight (`comentarii.ts`, `upload-photo.ts`)
- Handler `OPTIONS` explicit în ambele endpoint-uri
- Răspuns `204 No Content` cu:
  - `Access-Control-Allow-Methods: GET,POST,OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`
  - `Access-Control-Max-Age: 86400` (preflight cache 24h)
- Origin neautorizat → 403 și în preflight

### Rate limiting
- `comentarii.ts` — 1 comentariu / 60 s per IP (Map in-memory, auto-cleanup)
- `upload-photo.ts` — 1 upload / 60 s per IP (Map in-memory, auto-cleanup)
- IP rezolvat din: `cf-connecting-ip` → `x-forwarded-for` → `x-real-ip` → `unknown`

### Validare upload
- MIME types permise imagini: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- MIME types permise audio: `audio/mpeg`, `audio/mp3` (+ fallback extensie `.mp3`)
- Limite: imagine 5 MB, audio 4 MB
- Procesare imagine prin `sharp`: EXIF strip (`.rotate()`), flatten, resize 1200px, WebP 82%
- Titlu igienizat cu DOMPurify (zero tags, zero atribute)

### Security headers (toate răspunsurile API)
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'
```

---

## Variabile de mediu obligatorii în producție

```env
# Bază de date
DB_HOST=
DB_USER=
DB_PASS=
DB_NAME=
DB_PORT=3306

# Google Analytics 4 (lasă gol pentru a dezactiva)
PUBLIC_GA4_ID=G-XXXXXXXXXX

# CORS whitelist
PUBLIC_SITE_URL=https://florentinapanaofficial.ro
PUBLIC_SITE_URL_WWW=https://www.florentinapanaofficial.ro
```

> Dacă `PUBLIC_SITE_URL` / `PUBLIC_SITE_URL_WWW` lipsesc, fallback-ul hardcodat `https://florentinapanaofficial.ro` rămâne activ.

---

## Checklist post-deploy (5 pași)

- [ ] **1. Rulează `node scripts/qa-check.mjs`** după build — trebuie `49 OK | 0 FAIL`
- [ ] **2. Validare Rich Results** — deschide [search.google.com/test/rich-results](https://search.google.com/test/rich-results) și testează homepage, un articol blog și o pagină video; verifică FAQPage, Article, VideoObject fără erori
- [ ] **3. CORS live** — testează cu `curl`:
  ```bash
  # Origin permis → 200 + ACAO header
  curl -s -I -H "Origin: https://florentinapanaofficial.ro" https://florentinapanaofficial.ro/api/comentarii?post_id=1

  # Origin nepermis → 403
  curl -s -o /dev/null -w "%{http_code}" -H "Origin: https://atacator.ro" https://florentinapanaofficial.ro/api/comentarii?post_id=1
  ```
- [ ] **4. GA4 DebugView** — setează `?gtm_debug=x` sau activează GA4 Debug Mode în extensia browser; execută submit formular, click telefon, click WhatsApp; confirmă că `generate_lead`, `click_phone`, `click_whatsapp` apar în GA4 → Admin → DebugView
- [ ] **5. Sitemap + robots în Google Search Console** — submit `https://florentinapanaofficial.ro/sitemap-index.xml`; verifică că `robots.txt` blochează `/admin/` și `/api/` folosind testul din GSC → Inspecție URL
