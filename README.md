# Landing-ul meu - Astro + TailwindCSS

Landing page modern pentru trupa live, construit cu Astro 4 si TailwindCSS 3. Include SEO on-page (meta + OG + Twitter), JSON-LD, sitemap si robots.txt.

## Cerințe

- Node.js 18+ (recomandat 20+)

## Instalare

```bash
npm install
```

## Rulare în dezvoltare

```bash
npm run dev
```

Apoi deschide `http://localhost:4321` in browser.

## Build pentru producție

```bash
npm run build
npm run preview
```

## Cum editezi continutul (important)

Tot continutul principal se editeaza dintr-un singur fisier:

- `src/data/siteContent.json`

De aici poti schimba rapid:

- titluri, descrieri, CTA-uri
- numar de telefon, email, oras
- link-uri YouTube (`videos` -> `youtubeId`)
- membri (`team`)
- galerie foto (`gallery`)
- intrebari FAQ (`faq`)
- meta SEO de baza (`seo.title`, `seo.description`, `seo.ogImage`)

## Cum adaugi poze reale

1. Pune imaginile in `public/images`.
2. In `src/data/siteContent.json`, completeaza campurile `image`:
	 - exemplu membru: `image: '/images/membri/florentina.jpg'`
	 - exemplu galerie: `image: '/images/galerie/live-01.jpg'`
3. Daca lasi `image: ''`, site-ul afiseaza automat placeholder.

## Cum schimbi videoclipurile YouTube

In `src/data/siteContent.json`, sectiunea `videos`:

```ts
videos: [
	{ title: 'Live moment 1', youtubeId: 'ID_VIDEO_1' }
]
```

Inlocuiesti `youtubeId` cu ID-ul real din URL-ul YouTube.

## SEO, sitemap si robots.txt

- SEO on-page este configurat in `src/layouts/BaseLayout.astro`.
- Structured data (JSON-LD de tip `MusicGroup`) este in `src/pages/index.astro`.
- Sitemap-ul este generat automat de `@astrojs/sitemap`, pe baza valorii `site` din `astro.config.mjs`.
- `robots.txt` este in `public/robots.txt`.

## Administrare cu panou /admin (fara cod)

Site-ul are acum panou de administrare la adresa:

- `/admin` (local: `http://localhost:4321/admin`)

Ce poti edita din panou:

- Brand, SEO, Contact
- Hero (titlu, butoane, descriere)
- Servicii
- Repertoriu
- Echipă (solisti, instrumentisti, colaboratori)

### Cum intri in admin cand site-ul e public

Panoul este configurat cu Netlify Identity + Git Gateway.

1. Publici site-ul pe Netlify.
2. In Netlify: Site configuration -> Identity -> Enable Identity.
3. Tot acolo activezi Git Gateway.
4. Din Identity -> Invite users, trimiti invitatie pe emailul tau.
5. Setezi parola din emailul de invitatie.
6. Intri pe `https://domeniul-tau.ro/admin`, te loghezi si editezi continutul.

Raspuns la intrebarea despre parola:

- Da, iti creezi propria parola cand accepti invitatia in Netlify Identity.
- Nu este nevoie de cod pentru asta.

## Formulare de contact (fara mail client)

Formularele din site sunt configurate acum cu Netlify Forms (fara backend custom), deci nu mai depind de `mailto:`.

Unde vezi cererile:

- Netlify dashboard -> Forms -> Submissions

Protectie anti-spam inclusa:

- honeypot field (`bot-field`) pe fiecare formular

## API comentarii (SSR + MySQL)

Ruta API este disponibila la:

- `POST /api/comentarii`

### 1. Variabile de mediu

1. Creeaza fisierul `.env` in radacina proiectului (poti porni de la `.env.example`).
2. Completeaza variabilele:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=parola_ta
DB_NAME=landing_ul_meu
```

### 2. Structura tabelului MySQL

```sql
CREATE TABLE IF NOT EXISTS comentarii (
	id INT UNSIGNED NOT NULL AUTO_INCREMENT,
	id_video VARCHAR(64) NOT NULL,
	nume VARCHAR(120) NOT NULL,
	comentariu TEXT NOT NULL,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	INDEX idx_comentarii_video (id_video)
);
```

### 3. Payload acceptat

```json
{
	"id_video": "abc123",
	"nume": "Florin",
	"comentariu": "Super interpretare!"
}
```

Validare implementata:

- `comentariu` trebuie sa aiba intre 3 si 500 de caractere
- `id_video`, `nume` si `comentariu` sunt obligatorii

### 4. Test rapid

```bash
curl -X POST http://localhost:4321/api/comentarii \
	-H "Content-Type: application/json" \
	-d '{"id_video":"abc123","nume":"Florin","comentariu":"Super interpretare!"}'
```

## Checklist setup MySQL în cPanel

- Creează o bază de date nouă din cPanel -> MySQL Databases.
- Creează un utilizator MySQL dedicat aplicației.
- Asociază utilizatorul la baza de date și acordă privilegii `ALL PRIVILEGES`.
- Rulează scriptul din `schema.sql` în phpMyAdmin (tab-ul SQL).
- Rulează apoi scriptul din `seed.sql` pentru a popula tabela `posts` cu videoclipurile existente.
- Seed-ul folosește ID-uri fixe (1..5), iar `comments.post_id` trebuie să folosească aceste ID-uri.
- Completează fișierul `.env` cu valorile reale: `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_PORT`.
- Verifică local cu `npm run dev` și un request `POST /api/comentarii`.

### Import în phpMyAdmin la Hosterion

1. Intră în contul Hosterion -> cPanel -> phpMyAdmin.
2. Selectează baza de date creată pentru proiect.
3. Mergi la tab-ul `Import` și încarcă mai întâi `schema.sql`.
4. Repetă importul pentru `seed.sql`.
5. Verifică în tabelul `posts` că există înregistrările cu ID 1-5.

## Mentenanță Bază de Date

- Fișierul `verify.sql` verifică integritatea relației dintre `comments.post_id` și `posts.id`.
- Include și raportul cu numărul de comentarii pentru fiecare postare.

### Cum rulezi verify.sql în phpMyAdmin (Hosterion)

1. Intră în cPanel Hosterion -> phpMyAdmin.
2. Selectează baza de date a proiectului.
3. Deschide tab-ul `Import` și încarcă fișierul `verify.sql`.
4. Verifică rezultatele celor 3 interogări (orfane, total pe postare, rezumat valid/orfan).

## Inainte de publicare

- actualizeaza domeniul real in `astro.config.mjs` (`site`)
- actualizeaza URL-ul de sitemap din `public/robots.txt`
- completeaza datele reale in `src/data/siteContent.json`

