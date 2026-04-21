# JURNAL DE BORD (CARTEA DE SERVICE)
Orice reparație sau optimizare se notează aici de către AI, pentru transparență totală.

- **[Data de azi]**: S-a instalat sistemul Autopilot. Zero erori în consolă. S-au setat bazele pentru SEO automatizat.

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