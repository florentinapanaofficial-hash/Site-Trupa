# Copilot Instructions — Site Formația Florentina Pană

> Citește acest fișier înainte de orice modificare. Conține arhitectura completă, regulile critice și istoricul proiectului.

---

## Stack Tehnologic

- **Framework:** Astro 4 (hybrid output) + `@astrojs/node` (middleware mode)
- **Styling:** TailwindCSS 3 + PostCSS
- **Server:** `server.mjs` — sirv (fișiere pre-comprimate .br/.gz) + compression (SSR fallback) + OWASP headers
- **Deploy:** Railway (`railway.toml`)
- **Build:** `npm run build` = `astro build && node scripts/compress.mjs`

---

## Reguli Critice — OBLIGATORIU DE RESPECTAT

### 🔴 0. Protocol SEO automat la fiecare sesiune
- În paralel cu citirea jurnalului, rulează `npm run seo:audit` înainte de prima modificare, dacă există deja `dist/client`.
- O dată pe săptămână rulează `npm run seo:weekly`: build complet, audit SEO local, verificare linkuri externe și teste.
- Dacă auditul raportează FAIL, rezolvă problemele SEO înainte de a închide sesiunea; nu ignora rezultatul și nu modifica auditul pentru a ascunde o problemă reală.
- După orice modificare care poate afecta pagini, conținut, imagini, linkuri, layout sau metadata, rulează din nou `npm run seo:check`.
- La final, notează în `cheia-ferrari/3-Jurnal-Actiuni.md` rezultatul auditului (`pagini verificate`, `FAIL`, `WARN`) împreună cu fișierele modificate.
- Auditul este local și verifică output-ul din `dist/client`: title, description, canonical, H1, OpenGraph, Twitter Cards, alt text, trailing slash și sitemap.

### 🔴 1. Trailing Slash pe toate linkurile interne
- Site-ul are `trailingSlash: 'always'` în `astro.config.mjs`
- **TOATE** linkurile interne `href` TREBUIE să se termine cu `/`
- ❌ Greșit: `href="/despre"` → redirect 301 → scade scorul SEO
- ✅ Corect: `href="/despre/"` → acces direct
- Excepții: linkuri externe (`https://...`), `tel:`, `mailto:`, `#ancora`
- `Header.astro` are funcția `normalizeNavHref()` care adaugă automat trailing slash — NU o elimina

### 🔴 2. Pagina Comunitate — Redirect Activ
- URL canonical: `/comunitate/` (fișier: `src/pages/comunitate/index.astro`)
- `/comunitatea-noastra/` este DOAR redirect 301 → `/comunitate/`
- **NU adăuga linkuri interne către `/comunitatea-noastra/`**
- Cheia în `seo-content.json` este `comunitate`
- `astro.config.mjs` are filtru sitemap care exclude `/comunitatea-noastra/` — NU îl elimina

### 🔴 3. Când adaugi pagini sau linkuri noi
- Verifică mereu trailing slash pe orice `href="/ruta-noua/"`
- Adaugă în `Header.astro`, `Footer.astro`, `BaseLayout.astro` dacă e pagină de navigare
- Adaugă în `siteContent.json` + `siteContent.ts` dacă e element de navigare
- Adaugă în `astro.config.mjs` → `customPages` dacă e pagină prerendered nedescoperită de sitemap

### 🔴 4. Când muți/redenumești o pagină
- Vechiul fișier `.astro` se PĂSTREAZĂ ca redirect 301 (nu se șterge)
- Adaugă filtrul de excludere din sitemap în `astro.config.mjs`
- Actualizează TOATE linkurile interne (Header, Footer, BaseLayout, componente, pagini, JSON-uri)
- Actualizează cheia din `seo-content.json`
- Actualizează breadcrumb mapping din `BaseLayout.astro`

### 🔴 5. Imagini — Workflow obligatoriu
- Pune imaginile brute în `_raw_images/` → rulează `node scripts/optimize-images.js`
- Scriptul convertește automat în WebP (calitate 80%), redimensionează la max 1920px, șterge originalele
- Imaginile din `src/assets/` se folosesc cu `<Image>` Astro
- Imaginile statice (logo, OG, SVG) rămân în `public/images/`
- **NU adăuga imagini brute direct în `src/assets/`**

### 🟡 6. Verificare înainte de deploy
- `npx astro build` — ZERO erori obligatoriu
- `npm run seo:weekly` — revizie săptămânală obligatorie: `0 FAIL | 0 WARN`, linkuri valide și teste trecute
- Warnings `Astro.request.headers` pe pagini prerendered sunt normale
- Caută linkuri fără trailing slash:
  ```powershell
  Get-ChildItem -Path src -Recurse -Include *.astro | Select-String 'href="\/[^"]*[^\/]"' | Where-Object { $_.Line -notmatch 'http|tel:|mailto:|#' }
  ```

### 🟡 7. Regula de aur JavaScript (Layout Thrashing)
- După orice modificare DOM (clase, stiluri, atribute) **NU citi imediat** proprietăți geometrice (`offsetWidth/Height`, `getBoundingClientRect`, `getComputedStyle`)
- Fie READ-urile se fac ÎNAINTE de WRITE-uri, fie se izolează într-un `requestAnimationFrame` separat

### 🟡 8. Adăugare foto în galerii — Newest First
- Când adaugi foto noi la orice galerie, **prepend** (la ÎNCEPUTUL array-ului), nu append
- Se aplică la: `src/pages/galerie-foto.astro` → `photos[]` și `src/data/siteContent.json` → `galpisFoto[]`

---

## Structura Fișierelor Cheie

```
src/data/
├── seo-content.json      ← Hub centralizat SEO (titluri, descrieri, h1, schema.org)
├── siteContent.json      ← Date principale: brand, contact, navigație, servicii, membri
├── siteContent.ts        ← TypeScript types + navigație
├── couples.json          ← Testimoniale și date cupluri
├── blogPosts.json        ← Articole blog/vlog
└── communityPosts.json   ← Postări comunitate

src/layouts/
└── BaseLayout.astro      ← Layout master (<head>, canonical, OG, GA4, JSON-LD, breadcrumbs, meniu lateral)

src/components/
├── Header.astro          ← Navigație principală + normalizeNavHref()
├── Footer.astro          ← Footer + ZoneAcoperite
├── ZoneAcoperite.astro   ← „Pânza de Păianjen" — linkuri automate pagini locale
├── CookieBanner.astro    ← Banner GDPR (NU elimina)
└── ConsentWhatsApp.astro ← Consimțământ WhatsApp GDPR (NU elimina)

src/lib/
├── cors.ts               ← Utilități CORS pentru API (NU dezactiva)
├── db.js                 ← Conexiune bază de date
└── sanitize-url.ts       ← Sanitizare URL-uri (securitate — NU modifica fără motiv)

scripts/
├── compress.mjs          ← Compresie .gz + .br
├── optimize-images.js    ← Conversie WebP via sharp
├── check-links.mjs       ← Validare linkuri
├── qa-check.mjs          ← QA: alt text, linkuri, SEO
└── programmatic-seo/
    ├── locations.json    ← Date per oraș (slug, keyword, coords, texte)
    ├── content-blocks.json ← Variante text anti-duplicat
    ├── template.astro    ← Șablon pagini locale
    └── generate-pages.js ← Generator pagini (rulare: node scripts/programmatic-seo/generate-pages.js)

seo-agent/
├── seo-data.json         ← Export Google Search Console
├── seo-analyzer.js       ← Oportunități SEO (CTR slab + Striking Distance) — rulare: node seo-agent/seo-analyzer.js
├── keyword-harvester.js  ← Extrage sugestii Google Autocomplete — rulare: node seo-agent/keyword-harvester.js "seed"
└── harvested-keywords.json ← Output (auto-generat, NU edita manual)
```

---

## SEO — Unde se definește (CRITIC)

### Pagini cu SEO din `src/data/seo-content.json`:
| Rută | Cheia JSON |
|------|-----------|
| `/` | `acasa.meta` |
| `/contact/` | `contact.meta` |
| `/despre/` | `despre.meta` |
| `/comunitate/` | `comunitate.meta` |

### Pagini cu SEO hardcodat în `.astro`:
`/galerie-video/`, `/galerie-foto/`, `/aparitii-tv/`, `/membri/`, `/momente-cu-mirii/`, `/vlog/`, `/live/`, pagini legale

> **Regulă:** Verifică ÎNTÂI dacă pagina citește din `seo-content.json` sau are title/description hardcodat înainte de a edita SEO.

### Limite SEO:
- Title: **max 60 caractere**, trebuie să conțină cuvântul cheie principal
- Description: **max 155 caractere**, trebuie să includă un Call to Action

---

## CSS

- Un singur bundle global: `globals.css` (~2500+ linii)
- În build apare ca `aparitii-tv.*.css` — e normal (ordine alfabetică)
- Stiluri responsive = override-uri, nu duplicări
- Orice pagină nouă primește automat layout vertical pe mobil

---

## Programmatic SEO — Landing Pages Locale

- Pagini generate: `src/pages/formatie-nunta/` (pitesti, bucuresti, curtea-de-arges etc.)
- **NU edita manual** fișierele din `src/pages/formatie-nunta/`
- Cum adaugi un oraș nou: adaugă obiect în `locations.json` → `node scripts/programmatic-seo/generate-pages.js` → `npm run build`
- `ZoneAcoperite.astro` adaugă automat linkuri interne în Footer și Contact pentru toate orașele

---

## Securitate & API

- Formularul de contact are honeypot anti-bot (`bot-field`) — **NU elimina**
- Endpoint-urile din `src/pages/api/` folosesc `cors.ts` — **NU dezactiva CORS**
- URL-urile din datele utilizatorului se sanitizează prin `sanitize-url.ts`

---

## Server (`server.mjs`)

- Ordinea middleware: **sirv → compression → ssrHandler** — NU modifica ordinea
- Cache-Control: `/_astro/*` = 1 an immutable, `/images/` = 7 zile, `robots.txt` = 1 zi

---

## Jurnal AI și sesiuni anterioare

- Jurnalul oficial și unic este `cheia-ferrari/3-Jurnal-Actiuni.md`.
- Se citește înainte de orice modificare.
- La finalul fiecărei sesiuni se consemnează obiectivul, fișierele modificate, validările, greșelile/riscurile și pașii următori.
- Nu se creează un fișier separat `AI_JOURNAL.md`.

### Probleme Rezolvate

| Data | Problemă | Fix |
|------|----------|-----|
| Apr 2026 | ~70 linkuri fără trailing slash → 34 erori SE Ranking | Adăugat `normalizeNavHref()` în Header + corectat 22 fișiere |
| Apr 2026 | `/comunitatea-noastra/` → swap cu `/comunitate/` | Redirect 301 + actualizat 14 fișiere + sitemap |
| Apr 2026 | Swipe popup galerie declanșa navigarea globală pe mobil | `stopPropagation()` pe touch events în `membri.astro` |
| Apr 2026 | Forced reflow 17ms (layout thrashing) în `Header.astro` | Inversat ordinea READ/WRITE + `requestAnimationFrame` |
| Apr 2026 | Contrast insuficient WCAG AA în `Footer.astro` | `text-white/40` → `text-white/70`, linkuri `text-white/60` → `text-white/80` |
| Apr 2026 | 5 anchor links rupte (`/#membri`, `/#contact`) | Înlocuit cu `/membri/`, `/contact/` în saxofon.astro, tambal.astro, blog/[slug].astro |

---

## Comenzi Utile

```bash
npm run build                                    # Build complet (astro + compresie)
node seo-agent/seo-analyzer.js                  # Oportunități SEO din GSC
node seo-agent/keyword-harvester.js "keyword"   # Recoltare keywords Google Autocomplete
node scripts/optimize-images.js                 # Conversie imagini brute → WebP
node scripts/programmatic-seo/generate-pages.js # Regenerare pagini locale
node scripts/check-links.mjs                    # Validare linkuri
node scripts/qa-check.mjs                       # QA complet
```
