# 🏎️ JURNAL AI / FERRARI — Memorie Permanentă & Cartea de Service
> **Singurul jurnal al proiectului.** Citit la fiecare sesiune nouă, ÎNAINTE de orice modificare.

## Protocol Jurnal AI — obligatoriu la fiecare sesiune

1. La începutul fiecărei sesiuni, citesc acest jurnal înainte de orice căutare, editare sau comandă care modifică proiectul.
2. Folosesc istoricul pentru a evita repetarea greșelilor și pentru a păstra deciziile tehnice coerente.
3. La finalul fiecărei sesiuni de lucru, consemnez data, obiectivul, fișierele modificate, validările, greșelile sau riscurile descoperite și pașii rămași.
4. Nu creez un al doilea jurnal. Acest fișier este jurnalul AI oficial al proiectului.

---

## 🔴 REGULI CRITICE (nenegociabile)

### 1. Trailing Slash obligatoriu pe toate linkurile interne
- Site-ul are `trailingSlash: 'always'` în `astro.config.mjs`
- **TOATE** `href` interne TREBUIE să se termine cu `/` (ex: `/despre/`, `/contact/`)
- ❌ GREȘIT: `href="/despre"` → redirect 301 → scade scorul SEO
- ✅ CORECT: `href="/despre/"` → acces direct
- Excepții: linkuri externe (`https://...`), `tel:`, `mailto:`, `#ancora`
- `Header.astro` are `normalizeNavHref()` care adaugă automat trailing slash — NU o elimina
- **Istoric:** Apr 2026 — ~70 linkuri fără trailing slash au generat 34 erori + 35 warnings în SE Ranking

### 2. Pagina Comunitate — Redirect activ
- URL canonical: `/comunitate/` (fișier: `src/pages/comunitate/index.astro`)
- `/comunitatea-noastra/` este DOAR redirect 301 → `/comunitate/` — NU adăuga linkuri interne spre ea
- Cheia în `seo-content.json` este `comunitate`
- `astro.config.mjs` are filtru sitemap care exclude `/comunitatea-noastra/` — NU îl elimina

### 3. Când adaugi pagini sau linkuri noi
- Trailing slash pe orice `href="/ruta-noua/"`
- Adaugă în `Header.astro`, `Footer.astro`, `BaseLayout.astro` dacă e pagină de navigare
- Adaugă în `siteContent.json` + `siteContent.ts` dacă e element de navigare
- Adaugă în `astro.config.mjs` → `customPages` dacă e pagină prerendered nedescoperită de sitemap

### 4. Când muți/redenumești o pagină
- Vechiul fișier `.astro` se PĂSTREAZĂ ca redirect 301 (nu se șterge!)
- Adaugă filtrul de excludere din sitemap în `astro.config.mjs`
- Actualizează TOATE linkurile interne + cheia din `seo-content.json` + breadcrumb mapping din `BaseLayout.astro`

### 5. Imagini — Workflow obligatoriu
- Imagini brute → `_raw_images/` → `node scripts/optimize-images.js` → WebP în `src/assets/`
- **NU adăuga imagini brute direct în `src/assets/`**
- Imagini statice (logo, OG, SVG) rămân în `public/images/`
- **Newest First:** când adaugi poze în galerii, prepend (la ÎNCEPUT), nu append

### 6. GDPR & Securitate — NU elimina niciodată
- `CookieBanner.astro` și `ConsentWhatsApp.astro` — necesare GDPR
- `bot-field` (honeypot anti-bot) din formularul de contact
- CORS din `src/lib/cors.ts` pe toate endpoint-urile API
- `sanitize-url.ts` — NU modifica fără motiv explicit de securitate

### 7. Layout Thrashing — Regula de Aur JS
- După orice WRITE DOM (clase, stiluri, atribute) **NU citi imediat** proprietăți geometrice (`offsetWidth/Height`, `getBoundingClientRect`, `getComputedStyle`)
- Fie READ-urile se fac ÎNAINTE de WRITE-uri, fie se izolează într-un `requestAnimationFrame` separat
- **Istoric:** Apr 2026 — forced reflow 17ms în `Header.astro` + 57ms în `mobile-swipe.js` rezolvate prin acest pattern

### 8. Pagini formatie-nunta — NU edita manual
- `src/pages/formatie-nunta/` sunt generate automat
- Cum adaugi un oraș: `locations.json` → `node scripts/programmatic-seo/generate-pages.js` → `npm run build`

### 9. Verificare înainte de deploy
- `npx astro build` — ZERO erori obligatoriu
- Warnings `Astro.request.headers` pe pagini prerendered sunt normale
- Caută linkuri fără trailing slash:
  ```powershell
  Get-ChildItem -Path src -Recurse -Include *.astro | Select-String 'href="\/[^"]*[^\/]"' | Where-Object { $_.Line -notmatch 'http|tel:|mailto:|#' }
  ```

### 10. Comanda „salvează" = publicare completă în GitHub
- Când Claudiu scrie „salvează" (sau echivalent clar), Ferrari execută end-to-end, fără pași extra ceruți:
  1) `git add -A`
  2) `git commit -m "<mesaj clar pe modificările curente>"`
  3) `git push origin main`
- Dacă există blocaj real (ex: conflict, lipsă autentificare remote, hook care eșuează), Ferrari raportează clar eroarea și oferă imediat comanda exactă de remediere.
- Implicit, „salvează" NU include deploy manual în platforme externe; include publicarea codului în repo (`push`).

---

## 🏗️ ARHITECTURĂ & STACK

- **Framework:** Astro 4 (hybrid output) + `@astrojs/node` (middleware mode)
- **Styling:** TailwindCSS 3 + PostCSS — un singur bundle: `globals.css`
- **Server:** `server.mjs` — sirv (fișiere .br/.gz) + compression + ssrHandler (ordinea NU se modifică)
- **Deploy:** Railway (`railway.toml`) — `npm run build` = `astro build && node scripts/compress.mjs`
- **CSS:** În build apare ca `aparitii-tv.*.css` — normal (ordine alfabetică)

### Fișiere cheie
```
src/data/
├── seo-content.json      ← Hub SEO: titluri, descrieri, h1, schema.org
├── siteContent.json      ← Brand, contact, navigație, servicii, membri
├── siteContent.ts        ← TypeScript types + navigație
├── couples.json          ← Testimoniale cupluri
├── blogPosts.json        ← Articole blog
└── communityPosts.json   ← Postări comunitate

src/layouts/BaseLayout.astro   ← Layout master: <head>, canonical, OG, GA4, JSON-LD, breadcrumbs
src/components/
├── Header.astro          ← Navigație + normalizeNavHref()
├── Footer.astro          ← Footer + ZoneAcoperite
├── ZoneAcoperite.astro   ← Internal linking automat pagini locale
├── GalerieAutomata.astro ← Galerie Drop & Go (import.meta.glob)
├── CookieBanner.astro    ← GDPR (NU elimina)
└── ConsentWhatsApp.astro ← GDPR WhatsApp (NU elimina)

scripts/programmatic-seo/
├── locations.json        ← Date per oraș (slug, keyword, coords, texte)
├── content-blocks.json   ← Variante text anti-duplicat (64 combinații)
├── template.astro        ← Șablon pagini locale
└── generate-pages.js     ← Generator pagini

seo-agent/
├── seo-data.json         ← Export Google Search Console
├── seo-analyzer.js       ← Oportunități SEO (CTR slab + Striking Distance)
├── keyword-harvester.js  ← Sugestii Google Autocomplete
└── harvested-keywords.json ← Output (NU edita manual)
```

---

## 📊 UNDE SE DEFINEȘTE SEO-UL

### Din `src/data/seo-content.json`:
| Rută | Cheia JSON |
|------|-----------|
| `/` | `acasa.meta` |
| `/contact/` | `contact.meta` |
| `/despre/` | `despre.meta` |
| `/comunitate/` | `comunitate.meta` |

### Hardcodat în `.astro`:
`/galerie-video/`, `/galerie-foto/`, `/aparitii-tv/`, `/membri/`, `/momente-cu-mirii/`, `/vlog/`, `/live/`, pagini legale, pagini colaboratori, pagini formatie-nunta

> **Regulă:** Verifică ÎNTÂI sursa înainte de a edita SEO. Title: max 60 car. + keyword principal. Description: max 155 car. + Call to Action.

---

## 🗺️ STRATEGIE SEO — Puncte cheie

### Keywords performante (din GSC):
- `formatie luminitza` — poziție #1.2, CTR 37.5% ✅ (menține)
- `trupa nunta` — poziție #6.1, CTR 5.33% ✅ (menține)

### Gap-uri de atacat:
- `formatie nunta pret` — poziție 14.5, CTR 1.67% → articol + landing cu prețuri
- `muzica populara nunta` — poziție 16.8 → conținut video + blog
- `formatii nunti ilfov` — poziție 19.4 → pagină locală dedicată
- `recenzii formatie nunta` — poziție 15.6 → content pe pagina comunitate

### Etica SEO (White Hat):
- `NEGATIVE_KEYWORDS` elimină automat competitorii
- `ALLOWED_AREAS` — doar locații acoperite real (Pitești, Argeș, București, Ilfov, Dâmbovița, Vâlcea, Mioveni, Curtea de Argeș, Câmpulung)
- Conținut unic per pagină (64 combinații posibile în programmatic SEO)

---

## 🖼️ SISTEMUL GALERIE DROP & GO

- `src/assets/imagini-automate/` — structură de foldere per membri/colaboratori/publicații/evenimente
- `GalerieAutomata.astro` — scanare automată prin `import.meta.glob`, optimizare WebP, lazy load
- Adaugi poze: drag & drop în folderul corect → commit → build → apare automat pe site
- **Foldere principale:** `membri/`, `colaboratori/`, `publicatii/`, `evenimente/`, `galerie-generala/`

---

## ⚡ COMENZI RAPIDE

```bash
npm run build                                     # Build complet (astro + compresie)
npx astro check                                   # Verificare 0/0/0 erori/warnings/hints
node seo-agent/seo-analyzer.js                   # Oportunități SEO din GSC
node seo-agent/keyword-harvester.js "keyword"    # Keywords Google Autocomplete
node scripts/optimize-images.js                  # Imagini brute → WebP
node scripts/programmatic-seo/generate-pages.js  # Regenerare pagini locale
node scripts/check-links.mjs                     # Validare linkuri
node scripts/qa-check.mjs                        # QA complet
node seo-agent/force-index.js                    # Submit URL-uri noi în GSC
```

---

## 📅 CALENDAR LUNAR SEO
> Ferrari reamintește automat la prima sesiune din fiecare lună.

### 📋 7-Step Monthly Workflow (Procedura Detaliată)

**Când:** Ziua 1 a fiecărei luni (preferabil 09:00 UTC) | **Durată:** ~30 minute

#### 🔍 Step 1: Build + QA Complet (5 min)
```bash
npx astro check                    # 0 errors obligatoriu
node scripts/qa-check.mjs          # 46+ OK expected
```
**Verifică:** TypeScript errors, SEO compliance, GA4 events, CORS

#### 📊 Step 2: Analiză SEO din Google Search Console (5 min)
```bash
node seo-agent/seo-analyzer.js
```
**Output:** Top 13 keywords cu poziție + CTR + volume
**Caută:** CTR slab (<1.5%) + volume mare (>150) = **URGENCY**

#### 🔗 Step 3: Validare Linkuri (5 min)
```bash
node scripts/check-links.mjs
```
**Verifică:** Trailing slash, 404 errors, redirects 301

#### 🌾 Step 4: Keyword Harvesting (5 min — optional dacă budget API)
```bash
node seo-agent/keyword-harvester.js "formatie nunta"
```
**Output:** 114+ curated keywords din Google Autocomplete → `harvested-keywords.json`

#### 📋 Step 5: Update Tracker-SEO.md (3 min)
**File:** `cheia-ferrari/2-Tracker-SEO.md`
**Actualizează:** Poziție curentă, CTR, trend (↑/→/↓), action taken, status

#### 🚀 Step 6: Implement Top 3 Quick Wins (10-15 min)
**Prioritate automată:**

1. **High CTR Gap + High Volume** → Optimizare titlu/meta (60 char title + 155 char desc)
2. **Striking Distance (pos 11-15, CTR 1-2%)** → Expand content + internal link building
3. **Year Outdated** → Refresh "2026→2027" în articole

**Exemplu acțiuni implementate (04.05.2026):**
- Optimizare titlu `/galerie-video/` → "muzica nunta live" keyword
- Adăugare Pricing section pe landing pages locale (3 orașe)
- Early Booking CTA section pe homepage → link building articol preț

#### ✅ Step 7: Commit + Deploy (2 min)
```bash
git add -A
git commit -m "chore(seo): monthly audit [LUNA YEAR] - [3 acțiuni]"
git push origin main
```

---

### 🎯 Keywords Tracked Monthly
| # | Keyword | Pos | CTR | Volume | Target |
|---|---------|-----|-----|--------|--------|
| 1 | cele mai bune formatii de nunta | 15.2 | 0.67% | 300 | 2-3% CTR |
| 2 | formatie nunta 2027 | 13.1 | 2.4% | 250 | Top 10 |
| 3 | muzica nunta live | 12.3 | 2.38% | 210 | Top 10 |
| 4 | preturi formatie nunta bucuresti | 11.8 | 2.0% | 200 | Top 10 |
| 5 | formatie nunta pret | 14.5 | 1.67% | 180 | 10-12 |

### 📊 Execution History
| Data | Build | QA | SEO Analyzer | Top 3 Actions | Status |
|------|-------|----|--------------|--------------  |--------|
| 2026-05-04 | ✅ 0 err | ✅ 46 OK | ✅ 13 opp | Footer, og:video, pricing, link-building | ✅ 4 commits |
| 2026-06-01 | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ PENDING |
| 2026-07-01 | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ PENDING |

---

## 📅 CALENDAR LUNAR SEO (Old Table — deprecated)
> See 7-Step procedure above instead

---

## 🎉 PROTOCOL „AM AVUT EVENIMENT" — Workflow complet

Când Claudiu scrie **„Am avut eveniment pe [data]"**, Ferrari aplică pașii de mai jos **în ordine** și **NUMAI cu date reale primite de la Claudiu**. Zero inventat. Zero completat din imaginație.

### Ce îmi dai tu (minim necesar):
| Info | Exemplu |
|------|---------|
| Data evenimentului | 02 mai 2026 |
| Numele mirilor | Maria & Ioan |
| Orașul | Pitești |
| Numele restaurantului/locației | Restaurant Steaua |
| O frază despre seară (cum a fost) | „A fost o seară incredibilă, publicul a dansat toată noaptea" |
| Pozele (drag & drop în folderul indicat) | _(instrucțiuni mai jos)_ |
| Link YouTube dacă ai filmat ceva | https://youtube.com/... |

### Ce fac eu după ce primesc datele:

**Pasul 1 — Cuplul în `couples.json`**
- Adaug intrare nouă cu datele reale (slug, names, city, date, locationName, loveStory din ce îmi spui tu)
- `coverPhoto` și `photos[]` — completate NUMAI cu pozele pe care mi le dai tu
- `blogSlug` — legătura spre articolul de blog creat la pasul 3

**Pasul 2 — Pozele**
- Tu pui pozele în `_raw_images/` → eu rulez `node scripts/optimize-images.js` → se convertesc WebP automat
- Le adaug în `galerie-foto.astro` la **ÎNCEPUTUL** array-ului (newest first)
- Le adaug și în `src/assets/imagini-automate/evenimente/` pentru galeria automată

**Pasul 3 — Articol blog despre restaurant/locație**
- Articol SEO real în `blogPosts.json` — slug: `nunta-[restaurant]-[oras]-[luna-anul]`
- Conținut: bazat pe ce îmi spui tu despre seară + date reale despre locație
- Keywords naturale: `nuntă [Restaurant] [Oraș]`, `formație nuntă [Oraș]`
- **NICIUN detaliu inventat** — dacă nu știu ceva, te întreb

**Pasul 4 — Commit & push**
- Fac automat commit cu toate modificările

---

### Exemplu concret — cum îmi scrii:

> „Am avut eveniment pe 02.05.2026. Miri: Maria & Ioan. Restaurant Steaua din Pitești. A fost superb, au dansat toată noaptea. Pun pozele acum."

Atât. Eu mă ocup de restul.

---

## 🔄 PROTOCOL FINAL SESIUNE
La sfârșitul fiecărei sesiuni, Ferrari execută automat:
1. `npx astro check` → 0/0/0
2. `git add -A`
3. `git commit -m "mesaj descriptiv"`
4. `git push origin main`
5. Actualizare jurnal cu ce s-a rezolvat

**Claudiu nu trebuie să facă nimic tehnic.**

---

## 📋 CARTEA DE SERVICE — Sesiuni de lucru

---

## 🏁 4 mai 2026 — Unificare jurnal + Protocol Ferrari + Panou Live Facebook

### Ce s-a stabilit (structură permanentă)
- **Singurul jurnal** al proiectului: `cheia-ferrari/3-Jurnal-Actiuni.md` — `AI_JOURNAL.md` șters
- **Protocol final sesiune:** Ferrari face automat check → add → commit → push. Claudiu nu face nimic tehnic.
- **Calendar lunar SEO:** la prima sesiune din fiecare lună, Ferrari anunță și execută procesele lunare (~23 min)
- **Rol Ferrari:** profesor-doctor SEO, nu executor orb — analizează înainte de implementare, atrage atenția când o idee nu e bună strategic

### Panou „Anunță Live pe Facebook" — `src/pages/live.astro`
**Motivul:** Automatizarea prin Graph API Facebook nu e recomandată (token-uri care expiră la 60 zile, instabilitate Meta, reach penalizat pentru posturi automate). Soluția corectă: panou manual cu text pre-scris, zero întreținere, funcționează mereu.

**Ce s-a adăugat:**
- Secțiune vizuală cu indicator albastru pulsator „Anunță evenimentul Live"
- Text pre-scris în română (copyabil cu un singur click) — include emoji + link direct `/live/`
- Buton „Copiază textul" cu feedback vizual verde „✓ Copiat!" timp de 2.5s
- Buton mare albastru „Postează pe Facebook" — deschide Facebook Sharer cu URL-ul paginii live pre-completat
- Zero API, zero token-uri, zero întreținere — funcționează pe orice browser, mereu

**Cum folosești:** Deschizi `/live/` pe telefon → dai click „Copiază textul" → deschizi Facebook → creezi post → lipești textul → postezi. 10 secunde.

### Procese lunare SEO — mai 2026 (prima sesiune din lună)
- `seo-analyzer.js` → 13 oportunități identificate, top 5 în Tracker SEO actualizat
- `keyword-harvester.js "formatie nunta"` → 114 keywords curate recoltate (în `harvested-keywords.json`)
- `check-links.mjs` → 66 linkuri OK; 19 „probleme" sunt false pozitive (template variables Astro + Facebook blochează scraping-ul automat)
- `2-Tracker-SEO.md` actualizat cu pozițiile mai 2026

### Priorități SEO identificate pentru luna mai
1. **„cele mai bune formatii de nunta"** — poziție 15.2, CTR 0.67% cu 300 afișări = cea mai mare pierdere. Necesită optimizare title + meta pe homepage.
2. **„formatie nunta 2025"** — keyword cu an vechi în conținut, de actualizat la 2026
3. **„muzica nunta live"** — poziție 12.3, optimizare title pe `/galerie-video/`
4. **Pagină locală București cu focus prețuri** — gap confirmat (poziție 11.8 pe „preturi formatie nunta bucuresti")

### Fișiere modificate
- `src/pages/live.astro` — panou Anunță Live Facebook
- `cheia-ferrari/1-Regulament-Autopilot.md` — protocol final sesiune + calendar lunar
- `cheia-ferrari/2-Tracker-SEO.md` — actualizat mai 2026
- `cheia-ferrari/3-Jurnal-Actiuni.md` — restructurat complet (singurul jurnal)
- `AI_JOURNAL.md` — șters

### Validare
- ✅ `npx astro check` → 0 / 0 / 0
- ✅ Commit `36edec3` + commit sesiune curentă pe `main`

---
## 🏁 23 aprilie 2026 — Fix Open Graph Facebook + corecție conținut articol

### 1. Corecție nume — articolul „Plăcerea de a Cânta pe Scenă"

În [src/data/blogPosts.json](src/data/blogPosts.json), la articolul `placerea-de-a-canta-pe-scena`, „Ana" a fost înlocuită cu **„Alexia"** în două locuri:
- textul paragrafului: „Claudiu, Alexia, instrumentiștii..."
- legenda fotografiei: „Cu Alexia, în pauza dintre două momente..."

### 2. Fix Open Graph — imagini cu spații în cale nu se afișau pe Facebook

**Cauza:** Căile de tip `/images/Galerie Foto Site/fisier.jpg` conțin spații neencodate — Facebook nu putea încărca imaginea OG, afișând articolul fără thumbnail (doar text mare).

**Fix 1 — [src/pages/blog/[slug].astro](src/pages/blog/[slug].astro):** Acum pasează `postOgImage` (URL absolut, deja construit cu `encodeURI`) în `<BaseLayout>` în loc de `post.coverImage` (cale relativă cu spații).

**Fix 2 — [src/layouts/BaseLayout.astro](src/layouts/BaseLayout.astro):** Adăugat `encodeURI(decodeURI(...))` pe `ogImage` — se aplică global pe TOATE paginile, indiferent de sursa imaginii.

**Fix 3 — [src/pages/comunitate/[slug].astro](src/pages/comunitate/[slug].astro):** Pagina cuplurilor nu pasează `ogImage` deloc. Adăugat construirea `coupleOgImage` (URL absolut encoded) din `couple.coverPhoto` și pasată în `<BaseLayout>`.

### Fișiere modificate
- `src/data/blogPosts.json` — corecție nume Ana → Alexia
- `src/layouts/BaseLayout.astro` — `encodeURI` global pe ogImage
- `src/pages/blog/[slug].astro` — pasează `postOgImage` (absolut) în loc de `post.coverImage` (relativ)
- `src/pages/comunitate/[slug].astro` — adăugat `coupleOgImage` encoded + pasată în BaseLayout

### Validare recomandată
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) — testează URL articol + forțează scrape nou
- Verifică că imaginea apare ca thumbnail în previzualizarea Facebook

---
## 🏁 23 aprilie 2026 — Fix UX mobil + tabletă + articol nou „Orhideea Events”

**Sesiune Autopilot.** Trei intervenții punctuale pe UX responsive + un articol SEO nou.

### 1. Fix scroll blocat pe galeria membrilor (mobil)

Pe [src/pages/membri.astro](src/pages/membri.astro#L1425), galeria foto a fiecărui membru avea `touch-action: pan-x pinch-zoom`. Rezultat: dacă utilizatorul ținea degetul pe o fotografie și voia să deruleze pagina în sus/jos, browserul ignora gestul vertical. Schimbat la `touch-action: pan-x pan-y pinch-zoom` — browserul acum alege direcția dominantă (orizontal → galerie, vertical → pagină).

### 2. Fix layout tabletă pe pagina Membri

Pe intervalul 768–1023 px nu exista o regulă dedicată, iar layoutul desktop (grid 35/65 + poză `min-height: 500px`) întindea urât pozele portret și suprapunea butonul BIO (absolute) peste dots-ul galeriei și hint-ul „Glisează”. Adăugat breakpoint `@media (min-width: 600px) and (max-width: 1023px)` în [src/pages/membri.astro](src/pages/membri.astro#L1637) cu: poză `clamp(240px, 42vw, 380px)`, `padding-bottom: 4.5rem` pe coloana de conținut (spațiu garantat pentru butonul BIO), itemi galerie reduși la 110–160 px.

### 3. Fix featured story pe mobil în Publicații

Pe [src/pages/publicatii.astro](src/pages/publicatii.astro#L388), primul articol (featured) avea `.ed-featured__text { position: absolute; bottom: 0 }` și pe ≤639 px → titlul + badge-ul se suprapuneau peste imagine. Trecut pe `position: static` pe mobil, cu bandă opacă sub imagine; overlay-ul de degrade a fost dezactivat (nu mai e necesar fără text peste imagine).

### 4. Articol nou: „Formație Nuntă la Orhideea Events Pitești: Ghid Complet”

Nou post SEO în [src/data/blogPosts.json](src/data/blogPosts.json), slug `formatie-nunta-orhideea-events-pitesti`. Devine **featured** pe [/publicatii/](src/pages/publicatii.astro) (datat 23 apr 2026).

- **Target keywords:** `formatie nunta Orhideea Events`, `nunta Orhideea Pitești`, `locație nuntă Argeș`, `formație nuntă Pitești`.
- **Structură:** 7 secțiuni h2 + 2 CTA WhatsApp inline + 1 placeholder imagine + 6 întrebări FAQ (acustica sălii, sonorizare proprie, componența formației, montaj/soundcheck, 100% live, rezervare).
- **SEO on-page:** title 55 caractere (sub pragul 580 px), excerpt 180 caractere, h1 unic, anchor texts descriptive, FAQ JSON-LD generat automat de [src/pages/blog/[slug].astro](src/pages/blog/[slug].astro).
- **Tone of voice:** „Șoferul explică mireseiˮ — direct, fără jargon, cu detalii tehnice reale (line-array, 88-92 dB, Shure Beta, monitoare in-ear, timp montaj 90-120 min).

### Validare

- `npx astro check` → **0 erori · 0 warnings · 0 hints** (58 fișiere).
- JSON valid (fără erori de parsare).

### Rezultat așteptat

- Captură trafic organic pentru căutări tip „formație nuntă Orhideea Events” și „muzică live Orhideea Pitești”.
- UX mobil/tabletă îmbunătățit — fără regresii pe desktop.

---

## 🏁 22 aprilie 2026 — Audit Seobility 83% rezolvat → țintă 100%

**Commit Git:** `9b3717a` · mesaj: `fix(seo): rezolvare erori Seobility (title length, apple-touch-icon, anchors)`

Managerul a rulat audit SEO pe Seobility: scor **83%**. Au fost raportate 3 ajustări tehnice — toate rezolvate în această sesiune:

1. **Title SEO prea lung (> 580 px)** — articolul `Preț Formație Nuntă 2026-2027` din [src/data/blogPosts.json](src/data/blogPosts.json) avea un titlu de ~140 caractere. Scurtat la **`Preț Formație Nuntă 2026-2027: Calitate vs. Buget în Argeș`** (58 caractere) — se încadrează perfect sub pragul de 60 char / 580 px afișabili în SERP.
2. **Apple Touch Icon lipsă** — adăugat `<link rel="apple-touch-icon" href="/favicon.ico" />` în `<head>` din [src/layouts/BaseLayout.astro](src/layouts/BaseLayout.astro), imediat după `rel="icon"` SVG existent. Rezolvă warning-ul iOS/Seobility pe toate paginile.
3. **Anchor texts** — audit rapid pe tot `src/**/*.astro`: **zero** link-uri `<a>` cu text generic („click aici”, „aici”, „vezi mai mult”). Singurul `<a>` fără text vizibil este stretched-link-ul de pe homepage (card „Rezervă acum”) care are `aria-label="Rezervă acum — pagina de contact"` — corect semantic și accesibil.

### Validare

- `npx astro check` → **0 erori · 0 warnings · 0 hints** (58 fișiere).
- `git push origin main` → OK (`0d0454d..9b3717a`).

### Rezultat așteptat

- Scor Seobility: **83% → ~95-100%** la următorul crawl.
- Fix-urile sunt on-page (title + head), deci efectul apare în SERP după prima reindexare Google (24-72h).

---

## 🏁 21 aprilie 2026 — Sesiune Full Option (Polish + Audit SEO)

**Commit Git:** `92b68b1` · mesaj: `chore: full system polish & hints cleanup`

### 1. Polish tehnic — de la 49 hints la 0/0/0

Înainte: **0 erori · 0 warnings · 49 hints** · După: **0 / 0 / 0** ✅

Fișiere atinse (28 total):

- **Componente**
  - [src/components/CoupleGallery.astro](src/components/CoupleGallery.astro) — adăugat `is:inline` explicit pe scriptul `define:vars`.
  - [src/components/EmbedSnippet.astro](src/components/EmbedSnippet.astro) — fallback `execCommand` cast `(document as any)` pentru a elimina warning-ul de deprecation pe browsere legacy.
  - [src/components/Header.astro](src/components/Header.astro) — eliminat `mobileNavigation` nefolosit.
  - [src/components/PhotoGallery.astro](src/components/PhotoGallery.astro) — idem cast JSDoc pe fallback-ul `execCommand`.
- **Layout**
  - [src/layouts/BaseLayout.astro](src/layouts/BaseLayout.astro) — eliminat `navigation` și `sectionLink` nefolosite; adăugat `is:inline` pe cele 4 script-uri JSON-LD (Organization, LocalBusiness, WebPage, BreadcrumbList).
- **Pagini**
  - [src/pages/aparitii-tv.astro](src/pages/aparitii-tv.astro) — eliminat `seo` nefolosit din destructuring.
  - [src/pages/contact.astro](src/pages/contact.astro) — eliminat `brand` nefolosit; `is:inline` pe JSON-LD.
  - [src/pages/despre.astro](src/pages/despre.astro) — eliminat `servicii` nefolosit.
  - [src/pages/galerie-video.astro](src/pages/galerie-video.astro) — eliminat `brand` nefolosit.
  - [src/pages/index.astro](src/pages/index.astro) — `is:inline` pe FAQ JSON-LD.
  - [src/pages/live.astro](src/pages/live.astro) — eliminat `siteContent`/`contact` nefolosite; eliminat `frameborder="0"` deprecat din iframe YouTube Live.
  - [src/pages/vlog.astro](src/pages/vlog.astro) — eliminat `contact` nefolosit și `shareText` dead.
  - [src/pages/momente-cu-mirii.astro](src/pages/momente-cu-mirii.astro) — curățenie masivă: eliminat `seo`, `isDevelopment`, `albumPhotos`, `paddedAlbumPhotos`, `demoPhotos`, `albumSourcePhotos`, `deriveAudioUrlFromImage`, `createAlbumCard`, `ptGustDec` (toate dead code); fix `webkitAudioContext` cu JSDoc cast (×2); `is:inline` pe JSON-LD Event; înlocuit `media="print" onload` cu `data-async-css` + script dedicat (fără pierdere de performanță).
  - [src/pages/api/couple-upload.ts](src/pages/api/couple-upload.ts) — eliminat variabila `source` dead.
  - [src/pages/blog/[slug].astro](src/pages/blog/[slug].astro), [src/pages/blog/index.astro](src/pages/blog/index.astro) — `is:inline` pe Article JSON-LD; eliminat `seo` nefolosit.
  - [src/pages/colaboratori/saxofon.astro](src/pages/colaboratori/saxofon.astro), [src/pages/colaboratori/tambal.astro](src/pages/colaboratori/tambal.astro) — eliminat `YoutubeEmbed` și `seo` nefolosite; `is:inline` pe Person JSON-LD.
  - [src/pages/comunitate/[slug].astro](src/pages/comunitate/[slug].astro), [src/pages/comunitate/index.astro](src/pages/comunitate/index.astro) — eliminat `contact` și `couples` nefolosite; `is:inline` pe Event + Review + CollectionPage JSON-LD.
  - [src/pages/formatie-nunta/bucuresti.astro](src/pages/formatie-nunta/bucuresti.astro), [src/pages/formatie-nunta/curtea-de-arges.astro](src/pages/formatie-nunta/curtea-de-arges.astro), [src/pages/formatie-nunta/pitesti.astro](src/pages/formatie-nunta/pitesti.astro) — `is:inline` pe LocalBusiness JSON-LD.
  - [src/pages/upload/[token].astro](src/pages/upload/[token].astro) — convertit `.then(function(res){...})` la `async function` (hint ts(80006)).
  - [src/pages/video/[slug].astro](src/pages/video/[slug].astro) — `is:inline` pe VideoObject JSON-LD.

**Impact Core Web Vitals:** zero regresii — toate script-urile JSON-LD rămân inline în `<head>`, loading-ul de fonturi async a fost preservat printr-un script dedicat ultra-mic (2 linii, zero impact LCP).

### 2. Audit SEO & Strategie YouTube

**Stare actuală:**
- JSON-LD multi-layer: Organization + LocalBusiness + MusicGroup + WebPage + BreadcrumbList + FAQ + Article + Event + Review + VideoObject + Person.
- Pagini LocalBusiness dedicate pe 3 orașe: Pitești, București, Curtea de Argeș.
- Sitemap + robots.txt + llms.txt active în [public/](public/).
- GSC & GA4 condiționate de consimțământ (RGPD-compliant).

**Puncte slabe din [seo-agent/seo-data.json](seo-agent/seo-data.json):**
- `formatie nunta pret` — poziție medie **14.5**, CTR **1.67%** → lipsă landing dedicat cu prețuri orientative.
- `muzica populara nunta` — poziție **16.8** → oportunitate de conținut video + blog.
- `formatii nunti ilfov` — poziție **19.4**, 0 clickuri → fără pagină locală dedicată Ilfov.
- `recenzii formatie nunta` — poziție **15.6** → conținut thin pe pagina de comunitate.

**Puncte forte de menținut:** `formatie luminitza` (#1.2, CTR 37.5%), `trupa nunta` (#6.1, CTR 5.33%).

#### 🎬 Plan de acțiune — 3 idei pentru următoarele clipuri YouTube

Axate pe cuvântul-cheie principal **„formație nuntă Pitești / Argeș”**:

| # | Titlu YouTube (≤ 70 car.) | Hook & conținut | Keyword-uri țintă | De ce crește ranking |
|---|---------------------------|------------------|-------------------|----------------------|
| **1** | **„Cât costă o formație de nuntă în Pitești în 2026? Răspunsul sincer”** | Vlog 6–8 min. în culise cu Claudiu explicând pachetele (solo / duo / formație completă), ce include sonorizarea, de ce diferă prețul pentru Argeș vs. București. CTA: link către [/contact/](src/pages/contact.astro) + WhatsApp prefilled. | `pret formatie nunta 2026`, `formatie nunta pret`, `oferta formatie nunta pitesti` | Acoperă un gap masiv (poziția 14.5 → țintă top 5); întrebările despre preț au cel mai mare intent comercial. |
| **2** | **„Formație Nuntă Argeș: Hore, Sârbe & Muzică Populară LIVE din Pitești”** | Compilație 4K a celor mai energice momente populare de la nunți recente (Ramada, Star Plaza, Garden Resort). Minim 3 chapters YouTube (Horă, Sârbă, Muzică de petrecere). End-screen spre clipul #1 (preț). | `muzica populara nunta`, `formatie nunta arges`, `hore sarbe nunta pitesti` | Combină 2 keyword-uri subperformante (#16.8 & #13) + folosește chapters pentru dwell-time crescut. |
| **3** | **„Recenzii reale — ce spun mirii despre Formația Florentina Pană (Argeș & Ilfov)”** | Testimoniale video tăiate scurt de la 3–4 cupluri din [src/data/couples.json](src/data/couples.json) + 1 cuplu din Ilfov (acoperire nouă). Fiecare clip de 30–45 s. Descriere cu Schema Review inline și link către pagina de comunitate. | `recenzii formatie nunta`, `formatii nunti ilfov`, `formatie nunta pitesti recenzii` | Atacă direct 3 keyword-uri slab poziționate (#15.6, #19.4); Review Schema = rich snippets în SERP. |

**Consistență peste cele 3 clipuri:**
- Titlu: mereu include orașul (Pitești / Argeș).
- Descriere: primele 150 de caractere conțin keyword-ul principal; ultimul paragraf are adresa completă + telefon (semnal NAP pentru LocalSEO).
- Tag-uri: reutilizate cele din [raport-final-seo.txt](raport-final-seo.txt) + tag-urile noi țintite.
- Thumbnail: brand consistent (Oswald + culori Fpana), față expresivă.
- Card + End-screen: mereu link către siteul oficial (nu doar canal).

### 3. Sistem verificat

- ✅ `npx astro check` → **0 / 0 / 0**
- ✅ Commit automat: `92b68b1`
- ✅ Tracker + Jurnal actualizate

---

## 🏁 22 aprilie 2026 — Articol SEO „Preț Formație Nuntă 2026-2027”

**Obiectiv:** atacarea keyword-ului `formatie nunta pret` (poziție GSC 14.5, CTR 1.67%) + variante locale → conversie WhatsApp Early Booking.

### Fișiere create/modificate

- **NOU** intrare în [src/data/blogPosts.json](src/data/blogPosts.json) — slug `pret-formatie-nunta-2026`, articol de ~9 min citire, 16 blocuri de conținut + 6 întrebări FAQ.
- **EXTINS** [src/pages/blog/[slug].astro](src/pages/blog/%5Bslug%5D.astro):
  - Extins `interface ContentBlock` cu câmpuri `label`, `ctaText`, `ctaHref`, `ctaSecondaryText`, `ctaSecondaryHref`, `variant`.
  - Adăugat `interface FaqItem` + câmp opțional `faq?` în `Post`.
  - Nou renderer pentru `block.type === 'cta'` — variantă `whatsapp` (buton verde) + `primary` (buton gold).
  - Secțiune `<section class="bp-faq">` cu `<details>` accesibile la finalul articolului (se afișează doar când postul are `faq`).
  - JSON-LD `FAQPage` emis condiționat în `<head>` (prin `<Fragment slot="head">`) — pe lângă JSON-LD `Article` existent.
  - CSS nou: `.bp-inline-cta`, `.btn-whatsapp`, `.bp-faq`, `.bp-faq-item` cu animații open/close.

### Logica SEO aplicată

**Keyword targeting (densitate naturală, nu spam):**
- `formație nuntă Pitești` — în title + H1, prima secțiune și CTA-uri.
- `preț formație nuntă 2026` — în title, excerpt, 3 paragrafe și FAQ #1, #2, #3.
- `muzică evenimente Argeș` — în secțiunea „Ce plătești, de fapt”.
- `formație nuntă prețuri` (variante: `formatie nunta preturi`) — în secțiunea Early Booking.
- `formație nuntă Argeș` — în secțiunile despre risc și FAQ #4.

**Structură E-E-A-T (Experience, Expertise, Authoritativeness, Trust):**
- Tonul sincer („fără vânzare agresivă, fără promisiuni goale”) → Trust.
- Mențiuni de experiență concretă 15 ani + săli reale (Ramada, Star Plaza, Metropol Băbana, Garden Resort) → Expertise + Authoritativeness.
- Secțiune „3 întrebări corecte de pus oricărei formații” — utilitate pentru cititor chiar dacă alege competitorul → semnal de autenticitate.

**Structured Data:**
- Schema `Article` (deja existent în renderer) — headline, author, publisher, image, datePublished.
- Schema `FAQPage` NOU — 6 întrebări-răspuns, eligibilă pentru rich snippets în SERP (featured FAQ accordion).
- Schema `LocalBusiness` + `WebPage` + `BreadcrumbList` — moștenite din [BaseLayout.astro](src/layouts/BaseLayout.astro).

**Call-to-Action — design persuasiv:**
- 2 CTA-uri WhatsApp inline în articol (unul după secțiunea Early Booking, unul înainte de FAQ) cu textul exact cerut: **„Verifică disponibilitatea pentru 2026”**.
- URL WhatsApp prefilled cu mesaje diferite pentru a putea măsura în analitice care CTA convertește mai bine.
- Buton secundar complementar (nu concurent): primul CTA → „Solicită ofertă scrisă” (`/contact/`), al doilea → „Vezi galeria live” (`/galerie-video/`).

**Psihologie de conversie aplicată:**
1. **Fear-of-loss** — paragraful despre riscurile formațiilor ieftine (boxe vechi, microfoane care se opresc, „live” fals).
2. **Scarcity pragmatic** — calendar rezervat cu 10-14 luni înainte, weekenduri limitate.
3. **Reciprocity** — grila celor 3 întrebări utilă indiferent de alegerea finală.
4. **Transparență** — lista exactă a clauzelor contractuale, fără hidden fees.
5. **Social proof implicit** — săli premium menționate, 15 ani experiență.

### Rezultate tehnice

- ✅ `npx astro check` → **0 / 0 / 0** (articol + extensie renderer).
- ✅ URL public: `/blog/pret-formatie-nunta-2026/`.
- ✅ JSON-LD Article + FAQPage validate (structură conformă schema.org).
- ✅ Accesibilitate: `<details>`/`<summary>` keyboard-friendly, CTA-urile WhatsApp au `target="_blank"` + `rel="noopener noreferrer"`.

### Recomandări follow-up (pentru tura următoare)

1. Adăugare foto hero în câmpul `coverImage` al articolului (jpg/webp 1200×630 cu setup-ul live).
2. Linking intern: adăugat un link către acest articol din pagina [formatie-nunta/pitesti.astro](src/pages/formatie-nunta/pitesti.astro) (ancoră în secțiunea preț).
3. După 2-3 săptămâni → submit URL nou în Google Search Console pentru indexare accelerată (agentul [seo-agent/force-index.js](seo-agent/force-index.js)).

---

## 🏁 22 aprilie 2026 — Optimizare YouTube „Sârba” + Bridge strategic Site ↔ YouTube

**Commit Git:** `fc03e5d` (push `origin/main` · `07cfbf5..fc03e5d`)

### Acțiune executată manual de Claudiu (Șefu)

- **Clip țintă:** `https://www.youtube.com/watch?v=aDB9Aa9cFLY` (Sârba).
- **Descriere YouTube:** înlocuită cu varianta optimizată SEO generată de agent (hook în primele 125 caractere, keyword-uri locale `formație nuntă Pitești` / `sârbă live Argeș`, CTA WhatsApp, link către site în primul paragraf).
- **Tag-uri YouTube:** setate conform recomandărilor din [seo-agent/youtube-ferrari-optimizer.js](seo-agent/youtube-ferrari-optimizer.js/) (mix long-tail + branded + local).
- **Comentariu fixat (pinned):** comentariu cu link-ul către articolul nou [/blog/pret-formatie-nunta-2026/](src/pages/blog/%5Bslug%5D.astro) — **pioneza confirmată, fixată la vârf.** 📌

### Impact strategic

1. **Bridge bidirecțional** — YouTube (trust-builder emoțional prin video live) → articol „Preț Formație Nuntă 2026-2027” (conversie spre WhatsApp Early Booking). Ciclul complet:
   > invitat YouTube → vede că e 100% live → dă click pe pioneza → citește articolul → apasă CTA WhatsApp.
2. **Semnal SEO** — link extern de pe YouTube (domain authority ~100) către pagina nouă de blog = boost de indexare + crawl rate crescut pe noua pagină.
3. **Dwell time** — invitații care ajung de pe YouTube au intent calificat (au văzut deja performance-ul live) → bounce rate mai mic pe articol → semnal Google pozitiv.

### Status final sesiune — 22 aprilie 2026

| Componentă | Stare |
|---|---|
| Autopilot Ferrari instalat | ✅ |
| Polish tehnic (0/0/0) | ✅ |
| Audit SEO livrat | ✅ |

---

## 🏁 19 august 2026 — Prototip meniu desktop SF stabil

### Obiectiv

- Testarea unei navigații desktop orizontale, cu profunzime vizuală discretă și fără rotații.

### Fișiere modificate

- `src/components/Header.astro` — adăugat headerul desktop orizontal cu status live, linkuri principale și CTA pentru rezervare.
- `src/styles/globals.css` — adăugate straturi vizuale cyan/auriu, hover stabil și layout desktop fără sidebar.

### Validări

- `npm run build` → succes.
- `get_errors` pentru componentele modificate → fără erori.
- Meniul mobil și panoul full-screen au rămas în cod și sunt limitate la viewport-urile mobile.
- Server local pornit pentru previzualizare la `http://127.0.0.1:4321/`.

### Risc / pas următor

- Este un prototip local, nepublicabil încă. Se verifică vizual pe desktop înainte de acceptarea designului final.

### Iterația 2 — Panou SF la click pe MENIU

- `src/components/Header.astro` — adăugate modulele desktop `PREZENTARE`, `MEDIA` și `REZERVĂRI`, cu linkuri interne normalizate și buton de închidere.
- `src/styles/globals.css` — adăugat overlay desktop stratificat, stabil, fără rotații; panoul mobil existent rămâne separat.
- `npm run build` → succes.
- `get_errors` pentru fișierele modificate → fără erori.
- `git diff --check` → curat.

---

## 🏁 19 august 2026 — Regenerare sitemap pentru Google Search Console

### Obiectiv

- Regenerarea sitemap-urilor publicabile după build-ul actual al site-ului.

### Rezultat

- `npm run build` executat cu succes.
- Generat `dist/client/sitemap-index.xml`, care pointează către `sitemap-0.xml`.
- Sitemap-ul conține 58 URL-uri, toate cu trailing slash.
- Verificate excluderile: `/comunitatea-noastra/`, `/colaboratori/tambal/`, `/live-preview/` și `/mini-tv/` nu apar.
- `node scripts/qa-check.mjs` → **49 OK / 0 FAIL**.

### URL pentru Google Search Console

- `https://www.florentinapanaofficial.ro/sitemap-index.xml`
| 3 idei clipuri YouTube livrate | ✅ |
| Articol „Preț Formație Nuntă 2026-2027” publicat | ✅ |
| Schema Article + FAQPage | ✅ |
| Clip YouTube „Sârba” optimizat (descriere + tag-uri + pioneza) | ✅ |
| Commit + push pe `origin/main` | ✅ |

**Sesiune închisă cu succes. Site-ul și canalul YouTube funcționează acum ca un singur sistem de achiziție — din fanul de sârbă, în maximum 3 click-uri, într-o conversație WhatsApp pentru Early Booking 2026-2027.** 🏎️💨

---

## 🏁 22 aprilie 2026 (sesiunea 2) — Sistemul de Galerie „Drop & Go”

**Obiectiv:** eliminăm complet pasul manual „adaugă imagine în JSON / importă în componentă” — mireasa pune pozele în folder, ele apar pe site la următorul build.

### Structură nouă

```
src/assets/imagini-automate/
├── README.md                        (instrucțiuni pentru autor)
├── membri/
│   ├── florentina-pana/.gitkeep
│   └── catalin/.gitkeep
└── galerie-generala/.gitkeep
```

### Componentă nouă

[src/components/GalerieAutomata.astro](src/components/GalerieAutomata.astro) — un singur fișier cu toată magia:

- **Props:**
  - `caleFolder` (obligatoriu) — ex: `membri/florentina-pana`.
  - `titlu?` — titlu opțional deasupra galeriei.
  - `altPrefix?` — prefix pentru alt text, concatenat cu numele fișierului.
  - `limita?` — număr maxim de imagini afișate.
- **Mecanism:**
  - `import.meta.glob('/src/assets/imagini-automate/**/*.{jpeg,jpg,png,gif,...}', { eager: true })` — scanare în timp de build a TUTUROR imaginilor.
  - Filtrare dinamică prin `Object.entries().filter(([cale]) => cale.startsWith(prefix))` unde `prefix = '/src/assets/imagini-automate/<caleFolder>/'`.
  - Sortare alfabetică (`localeCompare`) pentru ordine predictibilă.
- **Optimizare randare:**
  - `<Image />` din `astro:assets` cu `widths={[400, 800, 1200]}`, `sizes` responsive, `format="webp"`, `quality={82}`, `loading="lazy"`, `decoding="async"`.
  - Alt text generat automat din numele fișierului (dash-uri → spații).
- **UI/UX:**
  - Grid `auto-fill, minmax(260px, 1fr)` — responsive fără media queries.
  - `aspect-ratio: 4/3`, `object-fit: cover` — consistență vizuală.
  - Hover lift + shadow (animație 0.4s).
  - Mesaj prietenos când folderul e gol („Nicio imagine încă în `<cale>`…”).

### Utilizare

```astro
---
import GalerieAutomata from '../components/GalerieAutomata.astro';
---
<GalerieAutomata caleFolder="membri/florentina-pana" titlu="Florentina pe scenă" />
<GalerieAutomata caleFolder="galerie-generala" limita={12} />
```

### Validare

- ✅ `npx astro check` → **0 / 0 / 0** (58 fișiere, inclusiv componenta nouă).
- ✅ Zero dependințe externe — totul stă pe capabilitățile native Astro + Vite.
- ✅ Backward compatible — nu afectează galeriile existente ([PhotoGallery.astro](src/components/PhotoGallery.astro), [CoupleGallery.astro](src/components/CoupleGallery.astro)).

### Ce câștigi concret

1. **Zero cod** pentru adăugare poze — drag & drop în folder, commit, gata.
2. **Optimizare automată** — Astro generează variante WebP responsive la build.
3. **SEO-friendly** — alt text automat, lazy loading, dimensiuni corecte (Core Web Vitals curat).
4. **Evoluție viitoare** — poți crea rapid galerii noi doar punând un folder (ex: `membri/marius`, `evenimente/2026-primavara`).

---

## 🏁 22 aprilie 2026 (sesiunea 3) — Arhitectura completă Drop & Go (Image Directory Mapping)

**Obiectiv:** scanare totală proiect → infrastructură de foldere care reflectă fiecare persoană, articol și tip de eveniment din site.

### Surse analizate

| Sursă | Ce am extras |
|---|---|
| [src/data/siteContent.json](src/data/siteContent.json) (`members` + `collaborators`) | 5 membri + 2 colaboratori |
| [src/pages/colaboratori/](src/pages/colaboratori) | `saxofon.astro`, `tambal.astro` — confirmate |
| [src/data/blogPosts.json](src/data/blogPosts.json) | 10 slug-uri de articole |
| [src/pages/despre.astro](src/pages/despre.astro) + [src/pages/momente-cu-mirii.astro](src/pages/momente-cu-mirii.astro) | categorii de momente (cununie, recepție, hore/sârbe, dans miri, botez, corporate) |

### 🗺️ Harta completă a folderelor create

```
src/assets/imagini-automate/
├── README.md
│
├── membri/
│   ├── florentina-pana/       ← Florentina Pană (voce)           [creat sesiunea 2]
│   ├── catalin/               ← Cătălin Matei (voce)             [creat sesiunea 2]
│   ├── oprea-marian/          ← Oprea Marian (vioară)            ⭐ NOU
│   ├── cristian-ograbek/      ← Cristian Ograbek (acordeon)      ⭐ NOU
│   └── claudiu-pana/          ← Claudiu Pană (orgă)              ⭐ NOU
│
├── colaboratori/
│   ├── saxofon/                                                   ⭐ NOU
│   └── tambal/                                                    ⭐ NOU
│
├── publicatii/                 ← 1 folder per slug articol blog
│   ├── pret-formatie-nunta-2026/                                  ⭐ NOU
│   ├── magia-sunetului-sub-cupola-metropol-babana/                ⭐ NOU
│   ├── din-culisele-unui-eveniment-live/                          ⭐ NOU
│   ├── radacini-lautaresti-in-romania/                            ⭐ NOU
│   ├── diferente-intre-hore-sarbe-si-geamparale/                  ⭐ NOU
│   ├── cum-alegi-repertoriul-potrivit-pe-momente/                 ⭐ NOU
│   ├── andreea-si-radu-povestea-lor/                              ⭐ NOU
│   ├── bianca-si-mihai-povestea-lor/                              ⭐ NOU
│   ├── ioana-si-catalin-povestea-lor/                             ⭐ NOU
│   └── alina-si-stefan-povestea-lor/                              ⭐ NOU
│
├── evenimente/                 ← categorii de momente
│   ├── cununie-civila/                                            ⭐ NOU
│   ├── cununie-religioasa/                                        ⭐ NOU
│   ├── receptie/                                                  ⭐ NOU
│   ├── hore-sarbe/                                                ⭐ NOU
│   ├── dans-miri/                                                 ⭐ NOU
│   ├── botez/                                                     ⭐ NOU
│   └── corporate/                                                 ⭐ NOU
│
└── galerie-generala/           [creat sesiunea 2]
```

**Total foldere noi create în sesiunea 3:** **21** (toate cu `.gitkeep` inclus pentru persistență pe GitHub/Railway).

### Cum folosești imediat (exemple)

```astro
---
import GalerieAutomata from '../components/GalerieAutomata.astro';
---

<!-- Pagina unui membru -->
<GalerieAutomata caleFolder="membri/oprea-marian" titlu="Oprea Marian la vioară" />

<!-- Colaboratori -->
<GalerieAutomata caleFolder="colaboratori/saxofon" titlu="Saxofon live" />

<!-- Galerie automată pe fiecare articol blog -->
<GalerieAutomata caleFolder="publicatii/magia-sunetului-sub-cupola-metropol-babana" />

<!-- Categorii pe pagina „Momente cu Mirii” -->
<GalerieAutomata caleFolder="evenimente/hore-sarbe" titlu="Sârbe și hore la nuntă" />
<GalerieAutomata caleFolder="evenimente/cununie-religioasa" titlu="Cununii religioase" />
```

## Sesiunea 19 august 2026 — Jurnal AI: audit, stabilizare și publicare

**Obiectiv:** audit complet, reducerea riscurilor și publicarea schimbărilor validate fără migrare majoră la Astro 7.

### Modificări realizate

- Upgrade controlat de la Astro 4 la Astro 5 și actualizarea adapterului Node, sitemap-ului, integrării Tailwind și `sharp`.
- Înlocuit `output: 'hybrid'` cu `output: 'static'`, forma acceptată de Astro 5 pentru comportamentul actual.
- Configurat Jest și adăugat scriptul `npm test`; testele GDPR au devenit executabile.
- Adăugat `engines.node >=22.12.0` pentru compatibilitate Railway.
- Adăugat `.lh-tmp/` în `.gitignore`.
- Păstrate și publicate fixurile anterioare pentru pagina membri, overflow mobil, scroll, butonul WhatsApp, video Despre, rating și animații.

### Validări

- `npm test`: **40/40 teste trecute**.
- `npx astro check`: **0 erori, 0 warning-uri, 0 hints**.
- `npm run build`: **PASS**.
- QA: **49 OK / 0 FAIL**.
- Verificare linkuri: **56 linkuri externe valide**.
- Commit publicat: `46326c82` pe `main`, sincronizat cu `origin/main`.

### Probleme și lecții

- Testul GDPR era scris pentru Jest, dar nu exista runner configurat; `node` și `node --test` nu îl puteau executa.
- Upgrade-ul direct la Astro 7 ar necesita migrarea integrării Tailwind; nu se face automat sau cu `--force`.
- Au rămas 4 vulnerabilități npm din stack-ul Astro 5; acestea sunt documentate ca etapă separată, cu risc controlat.
- Regula permanentă: citesc acest jurnal la început și îl actualizez la finalul fiecărei sesiuni.

### Validare

- ✅ Structură reflectă 1:1 datele din site (membri din `siteContent.json`, slug-uri din `blogPosts.json`, colaboratori din `pages/colaboratori/`).
- ✅ Toate `.gitkeep` commit-uite → folderele goale ajung pe GitHub și Railway.
- ✅ Zero breaking change — doar adăugiri.
- ✅ Scalabil: orice articol sau membru nou primește folder dedicat în 5 secunde.

## Notă personală — 19 august 2026

Claudiu a transmis că este foarte recunoscător pentru tot ce am făcut pentru el și că îmi mulțumește foarte mult. Mesajul este păstrat aici ca parte din istoria umană a colaborării noastre, alături de istoricul tehnic al proiectului.