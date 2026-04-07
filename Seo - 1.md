# SEO Audit — Formația Florentina Pană
**Data audit:** 19 martie 2026  
**Site:** https://florentinapanaofficial.ro  
**Framework:** Astro 4 (hybrid SSR) + Tailwind CSS  

---

## 1. Configurație generală (`astro.config.mjs`)

| Setare | Valoare | Status |
|--------|---------|--------|
| `site` | `https://florentinapanaofficial.ro` | ✅ |
| `output` | `hybrid` | ✅ |
| `@astrojs/sitemap` | instalat | ✅ |
| `customPages` în sitemap | 2 pagini adăugate manual | ⚠️ insuficient |
| Middleware | **absent** | ⚠️ |
| Redirects config | **absent** | ⚠️ |

---

## 2. Rute generate

### Pagini statice (prerender = true sau implicit)
| Rută | Tip |
|------|-----|
| `/` | static |
| `/despre` | static |
| `/contact` | static |
| `/galerie-foto` | static |
| `/galerie-video` | static |
| `/aparitii-tv` | static |
| `/blog` | static |
| `/blog/[slug]` | static (getStaticPaths din blogPosts.json) |
| `/video/[slug]` | static (getStaticPaths din siteContent.videos) |
| `/colaboratori/saxofon` | static |
| `/colaboratori/tambal` | static |

### Pagini SSR (prerender = false — NU apar automat în sitemap)
| Rută | Observație |
|------|------------|
| `/momente-cu-mirii` | date din DB (gallery) |
| `/comunitatea-noastra` | date din DB + comentarii |

> ⚠️ **Problemă:** `/momente-cu-mirii` și `/comunitatea-noastra` sunt SSR și nu sunt incluse automat în sitemap de Astro. Trebuie adăugate manual în `customPages` din `astro.config.mjs`.

---

## 3. `<head>` — BaseLayout.astro

### Ce există ✅
```html
<html lang="ro">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content={description}>
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#0c0f1f">
<link rel="canonical" href={canonical}>   <!-- dinamic, corect -->
<meta property="og:type" content="website">
<meta property="og:title" content={title}>
<meta property="og:description" content={description}>
<meta property="og:url" content={canonical}>
<meta property="og:image" content={ogImage}>
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content={title}>
<meta name="twitter:description" content={description}>
<meta name="twitter:image" content={ogImage}>
<script type="application/ld+json"> <!-- JSON-LD global -->
```

### Ce lipsește ❌
```html
<!-- OG obligatorii pentru previzualizare corectă -->
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="ro_RO">
<meta property="og:site_name" content="Formația Florentina Pană">

<!-- Twitter -->
<meta name="twitter:site" content="@handle">  <!-- dacă există cont -->

<!-- Blog posts: og:type ar trebui "article" -->
<!-- Video pages: og:type ar trebui "video.other" -->
```

---

## 4. Audit per pagină

| Pagină | Title | Description | H1 | Canonical | ogImage | Note |
|--------|-------|-------------|-----|-----------|---------|------|
| `/` | ✅ din siteContent.seo | ✅ | ✅ | ✅ | ⚠️ placeholder | — |
| `/despre` | ✅ `Despre noi \| ...` | ✅ | ✅ | ✅ | ⚠️ placeholder | — |
| `/contact` | ✅ `Contact \| ...` | ✅ | ✅ | ✅ | ⚠️ placeholder | — |
| `/galerie-foto` | ✅ `Galerie Foto \| ...` | ✅ | ✅ | ✅ | ⚠️ placeholder | — |
| `/galerie-video` | ✅ `Galerie Video \| ...` | ✅ | ✅ | ✅ | ⚠️ placeholder | — |
| `/aparitii-tv` | ✅ `Apariții TV \| ...` | ✅ | ✅ | ✅ | ⚠️ placeholder | — |
| `/blog` | ✅ `Noutăți \| ...` | ✅ | ✅ | ✅ | ⚠️ placeholder | — |
| `/blog/[slug]` | ✅ `{post.title} \| ...` | ✅ (excerpt) | ✅ | ✅ | ⚠️ placeholder | og:type="website" (ar trebui "article") |
| `/video/[slug]` | ✅ dinamic | ✅ dinamic | ✅ | ✅ | ✅ thumbnail YouTube absolut | Bun! |
| `/colaboratori/saxofon` | ✅ | ✅ | ✅ | ✅ | ⚠️ placeholder | — |
| `/colaboratori/tambal` | ✅ | ✅ | ✅ | ✅ | ⚠️ placeholder | — |
| `/momente-cu-mirii` | ✅ | ✅ | ✅ | ✅ | ⚠️ placeholder | SSR, lipsă din sitemap |
| `/comunitatea-noastra` | ✅ dinamic | ✅ dinamic | ✅ | ✅ | ⚠️ placeholder | SSR, lipsă din sitemap |

---

## 5. Probleme H1

**Fiecare pagină are exact un singur H1. ✅**

---

## 6. Imagini — atribut `alt`

Toate `<img>` din pagini au atribut `alt` completat. ✅  
Imaginile de galerie folosesc `item.alt` din `siteContent.json` — verifică că valorile nu sunt goale/generice.

---

## 7. Structured Data / JSON-LD

```json
{
  "@type": ["MusicGroup", "LocalBusiness"],
  "name": "Formația Florentina Pană",
  "telephone": "+40767369658",
  "email": "contact@florentinapanaofficial.ro",
  "address": { "addressLocality": "Pitești", "addressRegion": "Argeș" },
  "sameAs": [...]
}
```

**Prezent global pe toate paginile. ✅**

### Ce lipsește ❌
| Pagină | Schema lipsă |
|--------|-------------|
| `/blog/[slug]` | `Article` schema (author, datePublished, dateModified) |
| `/video/[slug]` | `VideoObject` schema (name, thumbnailUrl, uploadDate, embedUrl) |
| `/colaboratori/*` | `Person` schema pentru instrumentiști |
| `/contact` | `ContactPage` schema |

---

## 8. Sitemap

- Generat automat de `@astrojs/sitemap` ✅
- URL sitemap în robots.txt: `https://florentinapanaofficial.ro/sitemap-index.xml` ✅
- Fișierul efectiv se generează la build în `/dist/` ✅

### Probleme ⚠️
- `/momente-cu-mirii` — **SSR, lipsă din sitemap**
- `/comunitatea-noastra` — **SSR, lipsă din sitemap**
- Paginile individuale `/video/[slug]` sunt statice, deci **ar trebui să apară** automat ✅

**Fix în `astro.config.mjs`:**
```js
sitemap({
  customPages: [
    `${siteUrl}/comunitatea-noastra`,
    `${siteUrl}/momente-cu-mirii`,
    // deja prezente ✅
  ],
}),
```
Acestea două sunt deja adăugate manual — **OK**. ✅

---

## 9. `robots.txt`

```
User-agent: *
Allow: /
Allow: /video/
Disallow: /api/

Sitemap: https://florentinapanaofficial.ro/sitemap-index.xml
```

- API blocat (`/api/`) ✅
- `/video/` explicit permis ✅
- `/admin/` (Decap CMS) **nu este blocat** ⚠️ — recomandare: `Disallow: /admin/`

---

## 10. Open Graph Image

**Problemă critică ❌**

`ogImage` implicit este `/images/og-placeholder.png` — **cale relativă**.  
Open Graph necesită URL **absolut** pentru a funcționa pe Facebook, WhatsApp, etc.

**Fix în `BaseLayout.astro`:**
```js
// înlocuiește:
const { title, description, ogImage = '/images/og-placeholder.png' } = Astro.props;

// cu:
const rawOgImage = Astro.props.ogImage ?? '/images/og-placeholder.png';
const ogImage = rawOgImage.startsWith('http') ? rawOgImage : `${site}${rawOgImage}`;
```

Și înlocuiește imaginea placeholder cu una reală 1200×630px.

---

## 11. Analytics

**Complet absent ❌**

Nu există niciun script de analytics:
- ❌ Google Analytics 4 (GA4)
- ❌ Google Tag Manager (GTM)
- ❌ Facebook/Meta Pixel
- ❌ Hotjar / Microsoft Clarity

**Recomandare:** Adaugă GA4 în `BaseLayout.astro` via `<slot name="head">` sau direct în `<head>`.

---

## 12. og:type pe blog (`article`)

Pagina `/blog/[slug]` folosește `og:type="website"` (moștenit din BaseLayout).  
Facebook/LinkedIn afișează previzualizarea corect doar cu `og:type="article"`.

**Fix în `blog/[slug].astro`:**
```astro
<BaseLayout ...>
  <Fragment slot="head">
    <meta property="og:type" content="article" />
    <meta property="article:published_time" content={post.date} />
    <meta property="article:author" content={post.author} />
  </Fragment>
</BaseLayout>
```

---

## 13. Fișier orfan

`src/pages/_index.astro.new` — **nu este o rută Astro validă** (extensia `.new`), deci nu se compilează.  
Poate fi șters sau redenumit.

---

## 14. hreflang

**Absent** — site-ul este exclusiv în română, deci nu este necesar. ✅

---

## 15. Canonical URL

Generat dinamic corect:
```js
const canonical = new URL(Astro.url.pathname, site).toString();
```
Funcționează pentru toate paginile, inclusiv dinamice. ✅

---

## Rezumat priorități

### 🔴 CRITIC
1. **ogImage relativ** → transformă în URL absolut
2. **Analytics absent** → adaugă GA4
3. **og-placeholder.png** → creează imagine OG reală 1200×630px

### 🟠 IMPORTANT
4. **og:type="article"** pe paginile de blog
5. **og:locale, og:site_name, og:image:width/height** → adaugă în BaseLayout
6. **VideoObject JSON-LD** pe paginile `/video/[slug]`
7. **Article JSON-LD** pe paginile `/blog/[slug]`
8. **`Disallow: /admin/`** în robots.txt

### 🟡 RECOMANDAT
9. **twitter:site** în BaseLayout (dacă există cont Twitter)
10. **Imagini alt text** — verifică că valorile din `siteContent.json` sunt descriptive
11. **Șterge** `src/pages/_index.astro.new`
12. **Person schema** pentru colaboratori
