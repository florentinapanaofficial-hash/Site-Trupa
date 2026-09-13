# TRACKER EVOLUȚIE (MEMORIA SEO)
Aici vom nota evoluția săptămânală pentru a ne asigura că creștem, nu batem pasul pe loc.

| Data | Cuvânt Cheie Monitorizat | Poziție YouTube (Est.) | Poziție Site (Google GSC) | Notițe / Acțiuni Luate |
|---|---|---|---|---|
| [Data de azi] | formatie nunta pitesti | - | - | Inițializare sistem Autopilot |
| 21 apr 2026 | formatie nunta pitesti | - | - | Full polish cod (0/0/0 Astro); audit SEO efectuat; 3 idei clipuri YouTube propuse; commit `92b68b1` |
| 21 apr 2026 | formatie nunta pret | - | 14.5 | Slăbiciune identificată — propus clip YouTube #1 (video prețuri 2026) |
| 21 apr 2026 | muzica populara nunta | - | 16.8 | Slăbiciune identificată — propus clip YouTube #2 (Hore & Sârbe) |
| 21 apr 2026 | recenzii formatie nunta | - | 15.6 | Slăbiciune identificată — propus clip YouTube #3 (testimoniale mirii) |
| 21 apr 2026 | formatii nunti ilfov | - | 19.4 | Fără pagină locală dedicată — de creat + acoperire video |
| 21 apr 2026 | formatie luminitza | - | 1.2 | ✅ Brand keyword consolidat (CTR 37.5%) |
| 04 mai 2026 | cele mai bune formatii de nunta | - | 15.2 | TOP urgență — CTR 0.67% cu 300 afișări. Necesită optimizare title+meta pe homepage |
| 04 mai 2026 | formatie nunta 2025 | - | 13.1 | Keyword cu an vechi (2025) — de actualizat în conținut la 2026 |
| 04 mai 2026 | muzica nunta live | - | 12.3 | Pagina /galerie-video — necesită optimizare title SEO |
| 04 mai 2026 | preturi formatie nunta bucuresti | - | 11.8 | Gap — fără pagină locală București cu focus pe prețuri |
| 04 mai 2026 | formatie nunta pret | - | 14.5 | Neschimbat față de apr — articolul există, necesită link-building |
| 03 sep 2026 | muzica nunta live | - | 12.3 | ✅ Rezolvat parțial — `/galerie-video/` primește acum Schema `CollectionPage`+`ItemList`(VideoObject); title/description rămân neschimbate (deja sub limită) |
| 03 sep 2026 | formatie nunta pitesti (membri) | - | - | ✅ Rezolvat — title/description `membri.astro` corectate (erau 76/210 car., acum 51/141 car.) + Schema `ItemList`(Person) adăugată |
| 03 sep 2026 | album foto nunta pitesti | - | - | ✅ Rezolvat — title/description `momente-cu-mirii.astro` corectate (erau 77/180 car., acum 50/143 car.) |
| 03 sep 2026 | povestea formatiei | - | - | ✅ Rezolvat — `despre.astro` primește Schema `AboutPage` legată de `MusicGroup` |
| 03 sep 2026 | galerie foto nunta | - | - | ✅ Rezolvat — `galerie-foto.astro` conectat corect la `seo-content.json` (elimină hardcoding) + Schema `CollectionPage`/`ImageGallery` |
| 03 sep 2026 | comunitate recenzii mirii | - | - | ✅ Rezolvat — `comunitate.meta.title` redus la 45 car. (era ~59-60, la limită) |
| 03 sep 2026 | muzica nunta live (Schema fix) | - | 12.3 | ✅ Rezolvat — avertisment GSC `VideoObject` incomplet pe `/galerie-video/` (lipsea `uploadDate`); acum toate cele 12 clipuri au `name`, `description`, `thumbnailUrl`, `uploadDate`, `contentUrl`, `embedUrl` |
| 03 sep 2026 | formatie nunta pitesti/bucuresti/curtea-de-arges (FAQ) | - | - | ✅ Rezolvat — FAQ dinamic (4 întrebări) + Schema `FAQPage` adăugate în `template.astro`, regenerate pe toate cele 3 pagini locale prin `generate-pages.js` |
| 10 sep 2026 | cele mai bune formatii de nunta | - | 15.2 | ✅ Optimizat homepage: title orientat pe „formație de nuntă” + locații Pitești/Argeș; CTR de referință 0.67% la 300 afișări — de remăsurat în GSC |
| 10 sep 2026 | muzica nunta live | - | 12.3 | ✅ Optimizat `/galerie-video/`: title „Clipuri Reale 2026” + CTA în description; CTR de referință 2.38% la 210 afișări — de remăsurat în GSC |
| 10 sep 2026 | preturi formatie nunta bucuresti / formatie nunta pret | - | 11.8 / 14.5 | ✅ Optimizat `/contact/`: title cu București, Pitești și Argeș; prețul și oferta în description; CTR de referință 2.00% / 1.67% — de remăsurat în GSC |
| 12 sep 2026 | pagini cu redirecționare (trailing slash) | - | - | ✅ Curățare tehnică: URL-uri fără slash final eliminate din schema `/comunitate/` și oferta din `momente-cu-mirii`; fallback share gallery normalizat. Validare: `npm run seo:check` => 60 pagini, 0 FAIL \| 0 WARN. |
| 12 sep 2026 | navigație Comunitate | - | - | ✅ Adăugat butonul `Comunitate` în panoul meniului principal desktop, cu ruta canonicală `/comunitate/`. Validare: `npm run seo:check` => 60 pagini, 0 FAIL \| 0 WARN; build complet. |
| 13 sep 2026 | audit Seobility (Page Structure & Links) | - | - | ✅ Audit complet & remedieri Seobility: eliminați 4 <h2> paraziți din Header global, ierarhie h1->h2->h3 restabilită pe membri.astro & live.astro, div-uri în loc de h2/h3 pe widget-uri UI/modal, alt-uri lightbox & dimensiuni imagini, rel="noopener noreferrer" și ancore descriptive. Validare: 60 pagini, 0 FAIL \| 0 WARN; build curat. |
| 13 sep 2026 | audit Seobility homepage (headings, anchor text, dynamic query links) | - | - | ✅ Optimizare homepage Seobility: redus numărul de heading-uri de la 36 la 13 (h1 + 12 h2 de secțiuni principale), adăugat anchor text sr-only pe stretched link-ul cardului de rezervare, adăugat rel="nofollow" pe linkurile cu parametri din Footer (?cat=...). Validare: build curat, 0 FAIL \| 0 WARN. |
| 13 sep 2026 | restaurant Majestic Pitești / locații de 5 stele | - | - | ✅ Publicat articolul local `/publicatii/restaurant-majestic-pitesti-experienta-de-5-stele/`, cu categoria „Restaurante de 5 Stele”, link oficial, linkuri interne către servicii/repertoriu/contact și schema `BlogPosting` cu `contentLocation` Pitești, Argeș. Validare: 61 pagini, 0 FAIL \| 0 WARN. |