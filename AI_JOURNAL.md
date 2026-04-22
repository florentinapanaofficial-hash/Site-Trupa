# 🧠 AI_JOURNAL.md — Memorie Permanentă pentru Asistenți AI

## ⚠️ LA ÎNCEPUTUL FIECĂREI SESIUNI NOI, CITEȘTE ACEST FIȘIER ÎNAINTE SĂ MODIFICI ORICE COD.

---

## 🚨 ATENȚIONĂRI CRITICE — CITEȘTE ÎNAINTE DE ORICE MODIFICARE!

### 🔴 1. TRAILING SLASH OBLIGATORIU PE TOATE LINKURILE INTERNE
- Site-ul are `trailingSlash: 'always'` în `astro.config.mjs`
- **TOATE** linkurile interne `href` TREBUIE să se termine cu `/` (ex: `/despre/`, `/contact/`, `/comunitate/`)
- ❌ GREȘIT: `href="/despre"` → generează redirect 301 → scade scorul SEO
- ✅ CORECT: `href="/despre/"` → acces direct, fără redirect
- **Excepții:** linkuri externe (`https://...`), `tel:`, `mailto:`, `#ancora`
- `Header.astro` are funcția `normalizeNavHref()` care adaugă automat trailing slash — NU o elimina/modifica
- **Istoric:** În aprilie 2026, ~70 linkuri fără trailing slash au scăzut scorul SE Ranking dramatic (34 erori + 35 warnings + 19 redirects)

### 🔴 2. PAGINA COMUNITATE — REDIRECT ACTIV
- URL-ul canonical este `/comunitate/` (fișier: `src/pages/comunitate/index.astro`)
- `/comunitatea-noastra/` este DOAR redirect 301 → `/comunitate/` (fișier: `src/pages/comunitatea-noastra.astro`)
- **NU adăuga linkuri interne către `/comunitatea-noastra/`** — folosește mereu `/comunitate/`
- **NU modifica** `comunitatea-noastra.astro` — trebuie să rămână redirect simplu
- Cheia SEO din `seo-content.json` este `comunitate` (NU `comunitatea-noastra`)
- `astro.config.mjs` are filtru sitemap care exclude `/comunitatea-noastra/` — NU îl elimina

### 🔴 3. CÂND ADAUGI PAGINI SAU LINKURI NOI
- Verifică MEREU că orice `href="/ruta-noua/"` are trailing slash
- Adaugă linkul în `Header.astro`, `Footer.astro`, `BaseLayout.astro` (meniu lateral + mobil) dacă e pagină de navigare
- Adaugă în `siteContent.json` + `siteContent.ts` dacă e element de navigare
- Adaugă în `astro.config.mjs` → `customPages` dacă e pagină prerendered care nu e descoperită automat de sitemap

### 🔴 4. CÂND MUȚI/REDENUMEȘTI O PAGINĂ
- Vechiul fișier `.astro` trebuie PĂSTRAT ca redirect 301 (nu șters!)
- Adaugă filtrul de excludere din sitemap în `astro.config.mjs`
- Actualizează TOATE linkurile interne (Header, Footer, BaseLayout, componente, pagini, JSON-uri de date)
- Actualizează cheia din `seo-content.json` dacă pagina citește SEO de acolo
- Actualizează breadcrumb mapping din `BaseLayout.astro`

### 🟡 5. VERIFICARE ÎNAINTE DE DEPLOY
- Rulează `npx astro build` — ZERO erori obligatoriu
- Caută linkuri fără trailing slash: `Get-ChildItem -Path src -Recurse -Include *.astro | Select-String 'href="\/[^"]*[^\/]"' | Where-Object { $_.Line -notmatch 'http|tel:|mailto:|#' }`
- Caută linkuri template fără trailing slash: `Get-ChildItem -Path src -Recurse -Include *.astro | Select-String 'href=\{.*/[^/]*\}' | Where-Object { $_.Line -notmatch 'http|tel:|mailto:|#' }`
- Warning-urile `Astro.request.headers` pe pagini prerendered sunt NORMALE — nu sunt erori

---

## 1. Arhitectură și Stack Tehnologic

- **Framework:** Astro 4 (hybrid output) + `@astrojs/node` (middleware mode)
- **Styling:** TailwindCSS 3 + PostCSS
- **Server:** `server.mjs` — sirv (pre-compressed .br/.gz) + compression (SSR fallback) + OWASP headers
- **Deploy:** Railway (`railway.toml`)
- **Build:** `npm run build` → `astro build && node scripts/compress.mjs`

---

## 2. Structura Fișierelor Cheie

```
src/
├── data/
│   ├── seo-content.json      ← Hub centralizat SEO (titluri, descrieri, h1, schema.org)
│   ├── siteContent.json       ← Date principale: brand, contact, navigație, servicii, membri
│   ├── couples.json           ← Testimoniale și date cupluri
│   ├── blogPosts.json         ← Articole blog/vlog
│   └── communityPosts.json    ← Postări comunitate
├── components/                ← Componente Astro reutilizabile
├── layouts/
│   └── BaseLayout.astro       ← Layout principal (<head>, <header>, <footer>)
├── lib/
│   ├── cors.ts                ← Utilități CORS pentru API
│   ├── db.js                  ← Conexiune bază de date
│   └── sanitize-url.ts        ← Sanitizare URL-uri (securitate)
├── pages/                     ← Rutele site-ului
│   └── api/                   ← Endpoint-uri API (comentarii, consent, upload, rezervare)
└── styles/
    └── globals.css            ← CSS global (~2500+ linii, bundle ~12KB brotli)

scripts/
├── check-links.mjs            ← Validare linkuri interne/externe
├── compress.mjs               ← Compresie .gz + .br pentru toate asset-urile text
├── optimize-images.js         ← Optimizare imagini brute → WebP (sharp)
├── qa-check.mjs               ← QA: alt text, linkuri, SEO
└── update-seo.js              ← Sincronizare metadata SEO

_raw_images/                   ← Drop zone imagini brute (în .gitignore)

seo-agent/
├── seo-data.json              ← Export date Google Search Console
└── seo-analyzer.js            ← Analiză oportunități SEO (CTR slab + Striking Distance)
```

### Programmatic SEO — Landing Pages Locale
```
scripts/programmatic-seo/
├── locations.json             ← Array de locații (oraș, județ, keyword, coords, texte)
├── content-blocks.json        ← Variante de text (intros/services/outros) anti-duplicat
├── template.astro             ← Șablon cu variabile {{ORAS}}, {{KEYWORD}} etc.
└── generate-pages.js          ← Generează pagini .astro din template + locations + content-blocks

src/pages/formatie-nunta/      ← Pagini generate (NU edita manual!)
src/components/ZoneAcoperite.astro ← „Pânza de Păianjen" — linkuri automate către fiecare oraș
├── pitesti.astro
├── bucuresti.astro
└── curtea-de-arges.astro
```

**Comandă generare:** `node scripts/programmatic-seo/generate-pages.js`
**Cum adaugi un oraș nou:** Adaugă un obiect în `locations.json` → rulează comanda → rebuild Astro.

---

## 3. Unde se definește SEO-ul (CRITIC!)

### ✅ Pagini care iau SEO din `src/data/seo-content.json`:
| Rută              | Cheia din JSON       | Observații                                     |
|-------------------|----------------------|------------------------------------------------|
| `/`               | `acasa.meta`         | + hero, FAQ, schema.org                        |
| `/contact`        | `contact.meta`       | + h1, descriere, CTA-uri                       |
| `/despre`         | `despre.meta`        | + h1, aboutIntro, bio                          |
| `/comunitate`          | `comunitate.meta`          | + JSON-LD CollectionPage           |

### ❌ Pagini cu SEO hardcodat direct în fișierul `.astro`:
| Rută                        | Fișier                          |
|-----------------------------|---------------------------------|
| `/galerie-video`            | `src/pages/galerie-video.astro` |
| `/galerie-foto`             | `src/pages/galerie-foto.astro`  |
| `/aparitii-tv`              | `src/pages/aparitii-tv.astro`   |
| `/membri`                   | `src/pages/membri.astro`        |
| `/momente-cu-mirii`         | `src/pages/momente-cu-mirii.astro` |
| `/vlog`                     | `src/pages/vlog.astro`          |
| `/politica-confidentialitate` | `src/pages/politica-confidentialitate.astro` |
| `/politica-cookie`          | `src/pages/politica-cookie.astro` |
| `/termeni-conditii`         | `src/pages/termeni-conditii.astro` |

> **Regulă:** Când modifici SEO, verifică ÎNTÂI dacă pagina citește din `seo-content.json` sau are title/description hardcodat.

---

## 4. Componente Principale

| Componentă              | Rol                                              |
|--------------------------|--------------------------------------------------|
| `BaseLayout.astro`       | Layout master — `<head>`, canonical, OG, GA4, JSON-LD |
| `Header.astro`           | Navigație principală                             |
| `Footer.astro`           | Footer cu linkuri, legal, social                 |
| `Hero.astro`             | Secțiune hero cu headline + CTA                  |
| `CookieBanner.astro`     | Banner GDPR cookies                              |
| `ConsentWhatsApp.astro`  | Consimțământ comunicare WhatsApp                 |
| `YoutubeEmbed.astro`     | Embed YouTube cu lazy load                       |
| `CoupleCard.astro`       | Card testimonial cuplu                           |
| `Testimonials.astro`     | Secțiune testimoniale                            |
| `SkyBackground.astro`    | Fundal decorativ animat                          |
| `ZoneAcoperite.astro`    | Internal linking automat → pagini programmatic SEO |

---

## 5. Reguli Stricte de Editare

### Layout & Componente
- **NU șterge** niciodată `BaseLayout.astro`, `Header.astro` sau `Footer.astro` — doar modifică conținutul lor.
- **NU elimina** `CookieBanner.astro` sau `ConsentWhatsApp.astro` — sunt necesare pentru conformitatea GDPR.
- **NU modifica** `sanitize-url.ts` sau `cors.ts` fără motiv explicit de securitate.

### SEO & Conținut
- Titlurile SEO: **max 60 caractere**, trebuie să conțină cuvântul cheie principal.
- Descrierile SEO: **max 155 caractere**, trebuie să includă un Call to Action.
- Când editezi SEO, verifică sursa (JSON centralizat vs. hardcodat) — vezi tabelele de mai sus.
- **NU duplica** conținut SEO între `seo-content.json` și fișierele `.astro`.

### Imagini & Assets
- **Workflow:** Pune imaginile brute în `_raw_images/` → rulează `node scripts/optimize-images.js` → imaginile optimizate apar în `src/assets/`.
- Scriptul convertește automat în WebP (calitate 80%), redimensionează la max 1920px și șterge originalele.
- Imaginile din `src/assets/` se folosesc cu `<Image>` Astro (optimizare automată la build).
- Imaginile statice (logo, OG, SVG) rămân în `public/images/`.
- OG image: dimensiune standard `1200×630px`.
- **NU adăuga** imagini brute direct în `src/assets/` — folosește mereu pipeline-ul.

### API & Securitate
- Endpoint-urile din `src/pages/api/` folosesc `cors.ts` — NU dezactiva CORS.
- URL-urile din datele utilizatorului se sanitizează prin `sanitize-url.ts`.
- Formularul de contact are honeypot anti-bot (`bot-field`) — NU îl elimina.

### Build & Deploy
- `npm run build` = `astro build && node scripts/compress.mjs`
- Deploy pe Railway — configurare în `railway.toml`
- Serverul (`server.mjs`) servește fișiere pre-comprimate — ordinea: sirv → compression → ssrHandler.
- NU modifica ordinea middleware din `server.mjs`.

### CSS
- Un singur bundle global: `globals.css` (alias „aparitii-tv.*.css" în build — e normal, e doar ordine alfabetică).
- Stiluri responsive = override-uri, nu duplicări.

---

## 6. Ecosistem SEO Agent (`seo-agent/`)

- `seo-data.json` — Date exportate din Google Search Console (query, page, clicks, impressions, ctr, position).
- `seo-analyzer.js` — Citește datele și identifică oportunități:
  - **Regula 1 (CTR slab):** impressions > 50 + CTR < 3%
  - **Regula 2 (Striking Distance):** poziție medie 11–20
  - Rulare: `node seo-agent/seo-analyzer.js`
- `keyword-harvester.js` — Extrage sugestii din Google Autocomplete:
  - Tehnica „seed + alfabet" (a-z, ă, â, î, ș, ț) + prefixe („pret", „cel mai", „cum")
  - **NEGATIVE_KEYWORDS** — listă de competitori/termeni irelevanți (eliminare automată)
  - **ALLOWED_AREAS** — whitelist geografic (Pitești, Argeș, București, Ilfov, Dâmbovița, Vâlcea, Mioveni, Curtea de Argeș, Câmpulung)
  - Dacă un keyword conține un oraș/județ din România care NU e în ALLOWED_AREAS → eliminat
  - Keywords-urile generale (fără locație) sunt păstrate
  - Curăță duplicate, sortează, salvează în `harvested-keywords.json`
  - Rulare: `node seo-agent/keyword-harvester.js "formatie nunta"`
  - Acceptă orice seed keyword ca argument CLI
- `harvested-keywords.json` — Output keyword harvester (auto-generat, NU edita manual).

---

## 7. Jurnal de Sesiune

### 2025-04-13 — Optimizare SEO Top 5 Oportunități
**Ce s-a modificat:**
- Creat folderul `seo-agent/` cu `seo-data.json` (date demo GSC) și `seo-analyzer.js`.
- Actualizat `src/data/seo-content.json`:
  - `acasa.meta.title`: „Formația Florentina Pană | Muzică Live…" → **„Cele Mai Bune Formații de Nuntă 2025 | Florentina Pană"** (54 car.)
  - `acasa.meta.description`: rescris cu cuvintele cheie *cele mai bune formații de nuntă* + *formație nuntă 2025* (139 car.)
  - `contact.meta.title`: „Rezervă Formația Florentina Pană | Contact" → **„Prețuri Formație Nuntă București | Florentina Pană"** (50 car.)
  - `contact.meta.description`: rescris cu *preț formație nuntă* + CTA (138 car.)
- Actualizat `src/pages/galerie-video.astro`:
  - Title: „Galerie Video Muzică Live…" → **„Muzică Nuntă Live — Videoclipuri Formația Florentina Pană"** (~57 car.)
  - Description: rescris cu *muzică nuntă live* + CTA „Vezi video-urile acum!" (146 car.)
- **Fișiere atinse:** `seo-content.json`, `galerie-video.astro`
- **Cuvinte cheie integrate:** cele mai bune formații de nuntă, formație nuntă 2025, muzică nuntă live, prețuri formație nuntă bucurești, formație nuntă preț

### 2025-04-13 — Pipeline Optimizare Imagini
**Ce s-a creat:**
- Script `scripts/optimize-images.js` — folosește `sharp` pentru:
  - Conversie automată → WebP (calitate 80%)
  - Redimensionare inteligentă (max 1920px lățime)
  - Ștergere automată a fișierelor brute după procesare
  - Raport consolă cu: dimensiune veche vs. nouă, economie %, cod Astro import
- Folder `_raw_images/` (adăugat în `.gitignore`) — drop zone pentru imagini brute
- **Comandă:** `node scripts/optimize-images.js`
- **Test:** imagine 328.7 KB → 141.7 KB (economie 56.9%)

### 2025-04-13 — Motor Programmatic SEO
**Ce s-a creat:**
- Sistem complet de generare automată a landing page-urilor locale
- `scripts/programmatic-seo/template.astro` — șablon cu: BaseLayout, JSON-LD LocalBusiness, H1/H2/H3, CTA-uri, zone acoperite
- `scripts/programmatic-seo/locations.json` — date per oraș (slug, keyword, coords, texte unice, locații populare)
- `scripts/programmatic-seo/generate-pages.js` — citeste template + locations + content-blocks → generează `.astro` în `src/pages/formatie-nunta/`
- `scripts/programmatic-seo/content-blocks.json` — variante de text (intros/services/outros) cu {{ORAS}} și {{KEYWORD}}
  - Random pick per oraș → conținut unic anti-duplicat pe fiecare pagină
- **Comandă:** `node scripts/programmatic-seo/generate-pages.js`
- **Pagini generate (test):** `/formatie-nunta/pitesti`, `/formatie-nunta/bucuresti`, `/formatie-nunta/curtea-de-arges`
- **Build Astro:** ✅ Toate 3 paginile compilate cu succes
- **Cum adaugi un oraș nou:** Adaugă obiect în `locations.json` → rulează `generate-pages.js` → `npm run build`

### 2026-04-13 — Fix Trailing Slash pe toate linkurile interne (~70 instanțe)
**Problemă:** Scor SE Ranking scăzut — 34 erori „No inbound links", 35 warning-uri „Internal links to 3XX redirect pages", 19 redirects 3XX. Cauza: site-ul are `trailingSlash: 'always'` dar ~70 de linkuri interne nu aveau `/` la final (ex. `/despre` în loc de `/despre/`), generând redirect-uri 301 inutile.
**Ce s-a modificat (22 fișiere):**
- **`Header.astro`** — funcția `normalizeNavHref()` adaugă acum automat trailing slash; meniu mobil corectat
- **`Footer.astro`** — toate cele 16 linkuri interne corectate
- **`BaseLayout.astro`** — `sideMenuTopItems` + `mobileNavAllItems` corectate
- **Componente:** `CoupleHero`, `CoupleCard`, `CookieBanner`, `ConsentWhatsApp`, `ZoneAcoperite`
- **Pagini:** `index`, `despre`, `contact`, `galerie-video`, `comunitatea-noastra`, `publicatii`, `vlog`, `momente-cu-mirii`, `blog/[slug]`, `blog/index`, `comunitate/[slug]`, `video/[slug]`, `termeni-conditii`, `politica-confidentialitate`, `politica-cookie`, `colaboratori/saxofon`, `colaboratori/tambal`, `formatie-nunta/pitesti`, `formatie-nunta/bucuresti`, `formatie-nunta/curtea-de-arges`, `upload/[token]`
- **Date:** `siteContent.json` + `siteContent.ts` — navigație cu trailing slash
- **Share URLs:** `publicatii.astro` + `vlog.astro` — URL-urile de share social media corectate
**Impact așteptat:** Elimină complet cele 3 categorii de erori din SE Ranking (Redirects, No inbound links, Internal links to 3XX).

### 2026-04-13 — Swap rută /comunitatea-noastra/ → /comunitate/
**Problemă:** URL-ul `/comunitatea-noastra/` era prea lung și greu de reținut. Utilizatorul a creat pagina `/comunitate/` ca înlocuitor.
**Ce s-a modificat:**
- **`comunitate/index.astro`** — acum conține pagina completă (CollectionPage + AggregateRating JSON-LD, grid CoupleCard, search, prerender=true)
- **`comunitatea-noastra.astro`** — transformat în redirect 301 → `/comunitate/` (prerender=false)
- **Linkuri interne (~14 fișiere):** Header, Footer, BaseLayout, CoupleHero, CoupleCard, blogPosts.json, siteContent.json, siteContent.ts, index.astro, despre.astro, momente-cu-mirii.astro, galerie-video.astro, galerie-foto.astro, aparitii-tv.astro
- **`seo-content.json`** — cheia redenumită din `comunitatea-noastra` în `comunitate`
- **`astro.config.mjs`** — sitemap `customPages` actualizat cu `/comunitate/`; filtru adăugat pentru excluderea `/comunitatea-noastra/` din sitemap
- **`BaseLayout.astro`** — breadcrumb mapping actualizat (`comunitate` → `Comunitatea Noastră`)
**Impact:** URL canonical corect, fără redirect-uri suplimentare, sitemap curat.

### 2025-04-13 — Keyword Harvester (Google Autocomplete)
**Ce s-a creat:**
- `seo-agent/keyword-harvester.js` — extrage sugestii din Google Suggest API
- Tehnica: seed keyword + fiecare literă din alfabet românesc + prefixe („pret", „cel mai", „cum")
- **Test cu „formatie nunta":** 210 cuvinte cheie unice din 74 request-uri
- Categorii descoperite: 34 cu oraș, 17 cu preț, 204 cu tip eveniment, 8 cu gen muzical
- **Comandă:** `node seo-agent/keyword-harvester.js "formatie nunta"`

### 2025-04-13 — Etică SEO: Filtre Negative + Whitelist Geografic
**Ce s-a modificat:**
- Extins `NEGATIVE_KEYWORDS` (21 termeni): competitori + orașe irelevante + variante cu diacritice
- Adăugat `ALLOWED_AREAS` (14 variante pentru 9 localități): Pitești, Argeș, București, Ilfov, Dâmbovița, Vâlcea, Mioveni, Curtea de Argeș, Câmpulung
- Adăugat `ALL_RO_LOCATIONS` (~70 orașe/județe din România) pentru detectarea automată a locațiilor
- **Logică filtrare:** dacă keyword conține un oraș/județ din România → TREBUIE să fie în ALLOWED_AREAS. Keywords generale → păstrate.
- **Rezultat:** 210 brute → 34 eliminate negativ, 61 eliminate geo → **115 curate rămase**
- **Principiu:** Nu vizăm zone unde nu acoperim servicii. SEO etic = relevanță reală.

### 2026-04-22 — Fix mobil: swipe în popup-ul galeriei de membri declanșa navigarea între pagini
**Problemă:** Pe mobil, când se deschidea popup-ul cu poza mare a unui membru (pe `/membri/`), un swipe instinctiv stânga/dreapta făcea două lucruri în paralel:
1. Schimba poza în popup (handler intern).
2. **Se propaga la `document`** și declanșa navigatorul global din `public/js/mobile-swipe.js`, care ducea utilizatorul la pagina următoare/anterioară din meniu (`/galerie-video/`, `/galerie-foto/` etc.) — exact când omul voia doar să vadă altă poză.

**Fix aplicat în `src/pages/membri.astro`:**
- Eliminat handler-ul `touchstart`/`touchmove`/`touchend` care schimba poza prin swipe.
- Adăugat un bloc care apelează `e.stopPropagation()` pe `touchstart`/`touchmove`/`touchend`/`touchcancel` cât timp `#gallery-popup` e `.active`. Asta **blochează swipe-ul global** pe toată durata în care popup-ul e deschis.
- Navigarea între poze rămâne **exclusiv** prin săgețile laterale `‹ ›` (`.gallery-popup-nav`), care sunt click-uri, nu gesturi. Tastele `←` `→` și `Escape` funcționează în continuare. Închiderea: buton `✕`, click pe backdrop, tasta `Escape`, butonul Back al telefonului.

**De reținut pentru viitor:**
- `public/js/mobile-swipe.js` are deja o listă de selectoare care suprimă swipe-ul global (vezi `e.target.closest('#gallery-popup')` etc.), **dar** acea verificare se face pe elementul inițial al atingerii. Dacă popup-ul e mutat sub `<body>` la runtime și elementul atins e un copil (imagine/backdrop), `closest('#gallery-popup')` ar trebui să se potrivească — însă, pentru siguranță pe orice browser, am adăugat `stopPropagation` direct pe container. Regula: **orice overlay full-screen pe mobil trebuie să oprească explicit propagarea touch-urilor** către detectorul de swipe din `mobile-swipe.js`.

---

## 8. Etica SEO

Proiectul respectă principii de **SEO etic** (White Hat):
- **Nu vizăm competitori** — NEGATIVE_KEYWORDS elimină automat numele trupelor/artiștilor concurenți
- **Nu vizăm zone neacoperite** — ALLOWED_AREAS garantează că doar locațiile relevante rămân
- **Conținut autentic** — Landing pages din Programmatic SEO conțin texte unice per oraș, nu spin
- **Anti-duplicat** — Content Blocks system: 4×intros × 4×services × 4×outros = 64 combinații unice posibile
- **Relevanță reală** — Fiecare keyword rămas corespunde unui serviciu efectiv oferit

---

### 2026-04-22 — Lighthouse: Forced Reflow rezidual (17ms + 1ms) — REZOLVAT
**Problema:** raportul Lighthouse marca „Rearanjare forțată" cu sursa în `_lighthouse-eval.js:13:45` (17ms) și `florentinapanaofficial.ro:712:18` (1ms). Cauză reală: pattern **layout thrashing** (WRITE → READ în același tick sincron) în scripturile de inițializare.

**Surse identificate:**
1. `Header.astro` → `initScrollSpy()`:
   - `syncTopMenuBodyClass(false)` (WRITE clase pe `<body>`) urmat IMEDIAT de `recalcHeaderSpyOffset()` (READ `offsetHeight`) → forced reflow #1
   - `setActiveByPathname(currentPathname)` (WRITE `.is-active` pe linkuri) urmat IMEDIAT de `recalcSectionTops()` (READ `getBoundingClientRect`) → forced reflow #2
2. `BaseLayout.astro` → `sync()` pentru `--mob-nav-h`: READ `offsetHeight` executat direct la `DOMContentLoaded`, după ce alte scripturi au modificat DOM-ul

**Fix aplicat (pattern read-phase → write-phase):**
- `Header.astro`: inversat ordinea — `recalcHeaderSpyOffset()` rulează ACUM înainte de `syncTopMenuBodyClass(false)`; `recalcSectionTops()` rulează înainte de `setActiveByPathname()`
- `BaseLayout.astro`: `nav.offsetHeight` citit acum în interiorul unui `requestAnimationFrame`, separându-l de orice WRITE anterior

**Regulă de aur memorată:** În JavaScript, după orice modificare DOM (clase, stiluri, atribute) NU se citește imediat o proprietate geometrică (`offsetWidth/Height/Top/Left`, `clientWidth/Height`, `scrollWidth/Height`, `getBoundingClientRect`, `getComputedStyle`). Fie READ-urile se fac ÎNAINTE de WRITE-uri, fie se izolează într-un `requestAnimationFrame` separat.

**Fișiere modificate:** `src/components/Header.astro`, `src/layouts/BaseLayout.astro`
**Validare:** `get_errors` → zero erori TypeScript/Astro pe ambele fișiere

---

### 2026-04-15 — PageSpeed Insights: Contrast + Forced Reflow
**Probleme identificate din raportul PageSpeed (mobil):**

**1. Contrast insuficient (WCAG AA) — REZOLVAT**
- `Footer.astro` — secțiunea „Ghid Evenimente" avea text `text-white/40` pe fundal `#0C080F` → contrast ~2.2:1 (necesar ≥4.5:1)
- Linkurile din ghid aveau `text-white/60` → contrast ~4.1:1 (sub pragul minim)
- **Fix aplicat:**
  - Text label: `text-white/40` → `text-white/70`
  - Linkuri: `text-white/60` → `text-white/80`
  - Separatori `|`: `text-white/20` → `text-white/40`
  - Hartă site linkuri: `text-white/70` → `text-white/80`

**2. Rearanjare forțată (forced reflow) — REZOLVAT**
- `public/js/mobile-swipe.js` linia 146 — `cachedNavEl.offsetWidth` se citea sincron la execuția scriptului, forțând un layout reflow de 57 ms
- **Fix aplicat:** Inițializare `cachedNavEl = null; cachedNavWidth = 0;` — citirea reală se face doar în `cacheNavBtnPositions()` apelat deja prin `requestAnimationFrame`

**3. CSS nefolosit (~10 KiB) — NU NECESITĂ ACȚIUNE**
- Provine din variabilele CSS interne Tailwind v3 (`--tw-border-spacing-x`, etc.) pe selectorul `*,::before,::after`
- Este overhead structural al Tailwind v3, nu se poate elimina fără risc
- PageSpeed îl marchează „Nu se adaugă la scor"

**Fișiere modificate:** `Footer.astro`, `mobile-swipe.js`
**Commit:** `a49ee8c` pe `main`

---

### 2025-04-13 — Content Blocks (Anti-Duplicat)
**Ce s-a creat:**
- `scripts/programmatic-seo/content-blocks.json` — 3 array-uri (intros, services, outros) × 4 variante fiecare
- Variabilele `{{ORAS}}` și `{{KEYWORD}}` sunt înlocuite automat per oraș
- `generate-pages.js` — extins cu `pickRandom()` + `buildContent()` + raport conținut
- `template.astro` — secțiune nouă „Experiența Muzicală" cu `{CONTENT_INTRO}`, `{CONTENT_SERVICES}`, `{CONTENT_OUTRO}`
- **Rezultat:** fiecare pagină primește combinație aleatorie unică → **64 combinații posibile** (4×4×4)
- **Build Astro:** ✅ Toate 3 paginile compilate cu conținut diferit

### 2025-04-13 — Internal Linking Automat („Pânza de Păianjen")
**Ce s-a creat:**
- `src/components/ZoneAcoperite.astro` — componentă Astro care citește `locations.json` și randează badge-uri/pill-uri cu link-uri către paginile programmatic SEO
- Evidențiază pagina curentă (badge amber activ, `pointer-events-none`, `aria-current="page"`)
- Importată și adăugată în:
  - `Footer.astro` — deasupra zonei de copyright, pe toate paginile site-ului
  - `contact.astro` — la finalul secțiunii principale (relevant pentru vizitatorii care vor să rezerve)
- **Efect SEO:** Elimină „pagini orfane" — fiecare landing page locală primește link-uri interne din footer + contact
- **Automat:** Când adaugi un oraș nou în `locations.json` → componenta se actualizează automat la build
- **Build Astro:** ✅ Compilat cu succes, zero erori

### 2026-04-15 — Pagina LIVE de la Evenimente (`live.astro`)
**Ce s-a creat:**
- `src/pages/live.astro` — pagină nouă cu design editorial premium (fundal negru profund, fonturi Serif)
- **Player YouTube Live** — iframe embed `https://www.youtube.com/embed/live_stream?channel=UCNi3X-Qm3V4aaOAFSOlzHew`
- **Toggle Landscape/Vertical** — două butoane care comută aspect ratio între 16:9 și 9:16 (optimizat pentru filmări tip Stories)
  - Modul vertical: rama aurie se strânge la max 440px, efect ecran de telefon elegant pe desktop
- **Glassmorphism** — fundal blur decorativ cu 3 blob-uri difuze (amber, roșu, gold) + `backdrop-filter: blur(30px)` activ în modul vertical
- **Indicator ON AIR** — punct roșu `animate-pulse` + text «TRANSMISIUNE LIVE»
- **Ramă aurie** — `border-2 border-amber-500/40` + `box-shadow: 0 0 60px rgba(245,166,35,0.15)`
- **Butoane distribuire socială** — WhatsApp, Facebook, Copiază linkul (URL dinamic via `window.location.href`)
  - Stil auriu rotunjit cu hover subtil (`translateY(-1px)` + glow)
  - Butonul Copy Link oferă feedback vizual verde «Copiat!» timp de 2 secunde
- **CTA auriu** — «Vrei acest vibe la evenimentul tău? Verifică disponibilitatea» cu iconiță broadcast/radio
- **Secțiune Program live-uri** — carduri cu calendar pentru următoarele transmisiuni
- **Navigație** — link 🔴 LIVE adăugat în:
  - `Header.astro` — meniul hamburger mobil (`mobileFullNavigation`)
  - `BaseLayout.astro` — sidebar (`sideMenuTopItems`), mobile nav (`mobileNavAllItems`), breadcrumbs
  - `siteContent.json` — navigația principală desktop
- **Fișiere modificate:** `Header.astro`, `BaseLayout.astro`, `siteContent.json`
- **Build Astro:** ✅ 67 pagini generate, zero erori

### 2026-04-15 — Audit SEO complet + Remediere anchor links
**Audit rezultate:**
- ✅ Alt atribute imagini — 0 probleme (lightbox-urile cu `alt=""` sunt placeholder-uri dinamice, corect)
- ✅ Link-uri interne 404 — 0 pagini sparte
- ✅ Meta description — toate paginile au descrieri unice
- ✅ Canonical URLs, OG tags, JSON-LD Schema, `rel="noopener noreferrer"` — toate corecte
- ✅ OG image (`public/images/og-default-1200x630.jpg`) — confirmată existentă
- ⚠️ **5 anchor links rupte** — `/#membri` și `/#contact` duceau la homepage unde secțiunile nu existau

**Remediere aplicată (3 fișiere):**
- `src/pages/colaboratori/saxofon.astro` — `/#membri` → `/membri/`, `/#contact` → `/contact/`
- `src/pages/colaboratori/tambal.astro` — `/#membri` → `/membri/`, `/#contact` → `/contact/`
- `src/pages/blog/[slug].astro` — `/#contact` → `/contact/`

**Verificare post-remediere:** Build complet ✅ — 67 fișiere generate, zero erori. Warnings pre-existente (`Astro.request.headers` în mod static + CSS minification) sunt normale și nu afectează SEO.
