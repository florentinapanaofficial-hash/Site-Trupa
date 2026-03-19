# 📖 Ghid - Pana Claudiu
## Cum administrezi site-ul Formației Florentina Pană
### (Ghid pas cu pas, scris simplu, fără cunoștințe tehnice)

---

> **Regula de aur:** Înainte să faci orice modificare, deschide Visual Studio Code și pornește serverul local ca să poți vedea în timp real cum arată schimbările.

---

## CUPRINS

1. [Cum deschizi proiectul în VS Code](#1-cum-deschizi-proiectul-în-vs-code)
2. [Cum pornești site-ul local ca să îl vezi pe calculator](#2-cum-pornești-site-ul-local)
3. [Fișierele importante — unde găsești ce](#3-fișierele-importante)
4. [Cum schimbi textele din site](#4-cum-schimbi-textele-din-site)
5. [Cum adaugi un videoclip YouTube](#5-cum-adaugi-un-videoclip-youtube)
6. [Cum adaugi poze la galerie](#6-cum-adaugi-poze-la-galerie)
7. [Cum schimbi poza unui membru al formației](#7-cum-schimbi-poza-unui-membru-al-formației)
8. [Cum adaugi o apariție TV](#8-cum-adaugi-o-apariție-tv)
9. [Cum adaugi o noutate / știre](#9-cum-adaugi-o-noutate--știre)
10. [Cum adaugi un eveniment real (Momente cu mirii)](#10-cum-adaugi-un-eveniment-real-momente-cu-mirii)
11. [Cum adaugi sau modifici un articol de Blog](#11-cum-adaugi-sau-modifici-un-articol-de-blog)
12. [Cum publici site-ul pe internet (build final)](#12-cum-publici-site-ul-pe-internet)
13. [Probleme frecvente și soluții](#13-probleme-frecvente-și-soluții)

---

## 1. Cum deschizi proiectul în VS Code

**Pasul 1.** Deschide programul **Visual Studio Code** (pictograma albastră cu litera V)

**Pasul 2.** Click pe **File** (sus-stânga) → **Open Folder...**

**Pasul 3.** Navighează la folderul **"landing-ul meu"** de pe discul D: și apasă **Select Folder**

**Pasul 4.** VS Code va deschide proiectul. Vei vedea în stânga o listă de fișiere și foldere.

---

## 2. Cum pornești site-ul local

> Serverul local îți permite să vezi cum arată site-ul pe calculatorul tău, fără să fie publicat pe internet.

**Pasul 1.** În VS Code, apasă **Ctrl + `` ` ``** (tasta backtick, cea de lângă cifra 1) — se deschide un **Terminal** în josul ecranului

**Pasul 2.** Scrie exact această comandă și apasă **Enter**:
```
npm run dev
```

**Pasul 3.** Asteaptă câteva secunde. Vei vedea un mesaj de genul:
```
Local:   http://localhost:4321/
```

**Pasul 4.** Deschide Chrome/Edge și mergi la adresa: **http://localhost:4321**

✅ Acum vezi site-ul în direct! Orice modificare salvezi, se vede imediat în browser.

> **Oprire server:** Când termini, apasă **Ctrl + C** în Terminal.

---

## 3. Fișierele importante

### 📁 Unde găsești ce

| Ce vrei să modifici | Fișierul de deschis |
|---|---|
| Texte generale (titluri, descrieri, tagline) | `src/data/siteContent.json` |
| Videoclipuri YouTube din galerie | `src/data/siteContent.json` (secțiunea `videos`) |
| Galerie foto | `src/data/siteContent.json` (secțiunea `gallery`) |
| Membrii formației (text + poze) | `src/data/siteContent.json` (secțiunea `team`) |
| Apariții TV | `src/data/siteContent.json` (secțiunea `tvAppearances`) |
| Noutăți / știri | `src/data/siteContent.json` (secțiunea `news`) |
| Momente cu mirii (nunți reale) | `src/data/siteContent.json` (secțiunea `realMoments`) |
| Articole de blog | `src/data/blogPosts.json` |
| Poze încărcate pe site | Folderul `public/images/` |

### 📌 Cum deschizi un fișier

În stânga VS Code, click pe săgeata de lângă folderul **src** → click pe **data** → click pe fișierul dorit.

---

## 4. Cum schimbi textele din site

### Deschide fișierul: `src/data/siteContent.json`

Acest fișier conține TOATE textele site-ului. Fiecare text este între **ghilimele duble** `"..."`.

### ⚠️ Regulă importantă pentru JSON:
- Nu șterge virgulele `,` după valori
- Nu șterge acoladele `{` `}` sau parantezele pătrate `[` `]`
- Schimbă DOAR textul dintre ghilimele `"text de schimbat"`

---

### 4.1 Titlul și descrierea site-ului (apare în Google)

Caută în fișier secțiunea `"seo"`:
```json
"seo": {
  "title": "Formația Florentina Pană | Muzică live pentru nunți și evenimente",
  "description": "Formația Florentina Pană aduce show live pentru nunți..."
}
```
Schimbă textul dintre ghilimele după `"title":` și `"description":`.

---

### 4.2 Datele de contact

Caută secțiunea `"contact"`:
```json
"contact": {
  "phoneRaw": "+40767369658",
  "phoneDisplay": "0767 369 658",
  "email": "florentinapanaofficial@gmail.com",
  "city": "Argeș/Pitești, disponibilitate națională"
}
```
- `"phoneRaw"` → numărul de telefon fără spații (format internațional)
- `"phoneDisplay"` → numărul de telefon așa cum apare vizibil
- `"email"` → adresa de email
- `"city"` → locația / zona de activitate

---

### 4.3 Textul de pe prima pagină (Hero)

Caută secțiunea `"hero"`:
```json
"hero": {
  "kicker": "Live band | Nuntă | Botez | Corporate",
  "title": "Sunet Modern, Vibe Elegant",
  "description": "Combinăm hituri actuale..."
}
```
- `"kicker"` → rândul mic de deasupra titlului mare
- `"title"` → titlul mare din centrul paginii
- `"description"` → textul descriptiv de sub titlu
- `"bullets"` → cele 3 puncte cu avantaje

---

### 4.4 Serviciile oferite

Caută secțiunea `"services"`:
```json
"services": [
  {
    "title": "Nunți",
    "description": "Program complet pe momente-cheie..."
  },
  ...
]
```
Modifică `"title"` și `"description"` pentru fiecare serviciu.

---

### 4.5 Întrebări frecvente (FAQ)

Caută secțiunea `"faq"`:
```json
"faq": [
  {
    "question": "Cântați în toată țara?",
    "answer": "Da. Ne deplasăm oriunde în România..."
  },
  ...
]
```
Modifică întrebările și răspunsurile sau adaugă unele noi copiind blocul `{ "question": "...", "answer": "..." }` și adăugând o virgulă după cel anterior.

---

### 4.6 Salvarea modificărilor

După orice modificare apasă **Ctrl + S** pentru a salva. Site-ul din browser se va actualiza automat dacă serverul local rulează.

---

## 5. Cum adaugi un videoclip YouTube

### Deschide: `src/data/siteContent.json` → caută secțiunea `"videos"`

### Pasul 1 — Găsește link-ul YouTube

Intră pe YouTube, deschide videoclipul dorit. Din bara de adrese, copiază **ID-ul** — seria de caractere după `?v=`

**Exemplu:**
```
https://www.youtube.com/watch?v=aDB9Aa9cFLY
                                  ^^^^^^^^^^^
                               Acesta este ID-ul: aDB9Aa9cFLY
```

### Pasul 2 — Adaugă videoclipul în fișier

Găsește secțiunea `"videos": [` și adaugă un bloc nou la sfârșit (înainte de `]`):

```json
{
  "title": "Titlul videoclipului tău",
  "youtubeId": "ID-ul copiat de la YouTube",
  "youtubeUrl": "https://www.youtube.com/watch?v=ID-ul copiat",
  "category": "petrecere"
}
```

### Categoriile disponibile:
| Valoare în fișier | Unde apare pe site |
|---|---|
| `"petrecere"` | Muzică Populară & de Petrecere |
| `"usoara-diverse"` | Muzică Ușoară / Diverse Genuri |
| `"tineret-manele"` | Tineret |

### ⚠️ Atenție la virgule!
Dacă adaugi un bloc nou, pune **virgulă** după blocul anterior:
```json
  { ..., "category": "petrecere" },   ← virgulă aici
  { ..., "category": "petrecere" }    ← ultimul NU are virgulă
]
```

### Limita maximă: 6 videoclipuri per categorie.

---

## 6. Cum adaugi poze la galerie

### Există 2 metode: A) Poze de pe internet (link) sau B) Poze încărcate pe site

---

### METODA A — Poze cu link de pe internet

Dacă ai poza pe Facebook, Google Drive sau orice site, copiază link-ul direct al imaginii.

Deschide `src/data/siteContent.json` → caută secțiunea `"gallery"`:

```json
"gallery": [
  {
    "alt": "Moment live la nuntă",
    "image": ""
  },
  ...
]
```

Pune link-ul imaginii în câmpul `"image"`:
```json
{
  "alt": "Nuntă Andreea și Radu - septembrie 2025",
  "image": "https://link-catre-poza-ta.jpg"
}
```

- `"alt"` → descrierea pozei (importantă pentru Google și pentru accesibilitate)
- `"image"` → link-ul sau calea către poză

---

### METODA B — Poze încărcate direct pe site

**Pasul 1.** Copiază fișierul .jpg sau .png al pozei în folderul: `public/images/`

**Pasul 2.** Dă fișierului un nume simplu fără spații, de exemplu: `nunta-andreea-radu.jpg`

**Pasul 3.** În `siteContent.json`, la câmpul `"image"` scrie:
```json
"image": "/images/nunta-andreea-radu.jpg"
```

> Obsevă că adresa începe cu `/images/` (cu slash la început).

---

### 👉 Câte poze poți adăuga?

Poți adăuga oricâte blocuri vrei în secțiunea `"gallery"`. Fiecare bloc este:
```json
{
  "alt": "Descriere poză",
  "image": "/images/numele-pozei.jpg"
},
```

---

## 7. Cum schimbi poza unui membru al formației

### Deschide: `src/data/siteContent.json` → caută secțiunea `"team"`

Găsești membrii formației sub `"vocalists"` și `"instrumentalists"`:

```json
{
  "name": "Florentina Pană",
  "role": "Interpretă de muzică populară și ușoară",
  "description": "Voce cu timbru cald...",
  "image": "https://placehold.co/400x400/..."
}
```

**Pentru a schimba poza:**

**Pasul 1.** Copiază poza în `public/images/`, de exemplu: `florentina-pana.jpg`

**Pasul 2.** Înlocuiește valoarea lui `"image"`:
```json
"image": "/images/florentina-pana.jpg"
```

**Recomandare format poză:** pătrat, minim 400×400 pixeli, format JPG sau PNG.

---

## 8. Cum adaugi o apariție TV

### Deschide: `src/data/siteContent.json` → caută secțiunea `"tvAppearances"`

Structura unui element:
```json
{
  "channel": "Numele postului TV",
  "show": "Numele emisiunii",
  "year": "2025",
  "note": "Scurtă descriere a momentului.",
  "videoUrl": "https://www.youtube.com/watch?v=ID_VIDEO",
  "logo": ""
}
```

**Pasul 1.** Găsește ultimul element din lista `"tvAppearances"` (cel de dinaintea `]`)

**Pasul 2.** Pune virgulă după el și adaugă blocul nou:
```json
  {
    "channel": "Antena 1",
    "show": "Neatza cu Răzvan și Dani",
    "year": "2026",
    "note": "Moment muzical live cu repertoriu popular.",
    "videoUrl": "https://www.youtube.com/watch?v=ID_VIDEOCLIPULUI",
    "logo": ""
  }
```

> Dacă nu ai video pentru acea apariție, lasă `"videoUrl": ""` (ghilimele goale).

---

## 9. Cum adaugi o noutate / știre

### Deschide: `src/data/siteContent.json` → caută secțiunea `"news"` → subsecțiunea `"posts"`

Structura unei știri:
```json
{
  "title": "Titlul știrii",
  "date": "16 martie 2026",
  "category": "Categoria",
  "summary": "Un scurt rezumat de 1-2 propoziții despre subiect."
}
```

**Categorii sugerate:** `"Repertoriu Nou"`, `"Membri Noi"`, `"Evenimente"`, `"Anunț"`, `"Premii"`

**Adăugare știre nouă:** Pune virgulă după ultimul element din `"posts"` și adaugă blocul nou.

---

### Cum adaugi un comentariu aprobat

Caută `"approvedComments"` în aceeași secțiune `"news"`:

```json
{
  "author": "Numele persoanei",
  "relatedPost": "Titlul știrii la care se referă",
  "text": "Textul comentariului.",
  "reaction": "❤️",
  "trustLevel": "verificat"
}
```

- `"reaction"` → un emoji reprezentativ: `"❤️"`, `"👍"`, `"🎵"`, `"🌟"`
- `"trustLevel"` → `"verificat"` sau `"confirmat"`

---

## 10. Cum adaugi un eveniment real (Momente cu mirii)

### Deschide: `src/data/siteContent.json` → caută secțiunea `"realMoments"` → subsecțiunea `"events"`

Structura unui eveniment:
```json
{
  "title": "Eveniment Nume & Prenume",
  "couple": "Prenume & Prenume",
  "city": "Orașul",
  "date": "Luna Anul",
  "image": "/images/nunta-couple.jpg",
  "audioUrl": "",
  "youtubeUrl": "https://www.youtube.com/watch?v=ID_VIDEO",
  "coupleQuote": "\"Citat de la miri despre formație.\""
}
```

### Pași detaliați:

**Pasul 1.** Pregătește o poză reprezentativă (format 16:9, min 1600×900 px). Copiaz-o în `public/images/`

**Pasul 2.** Scrie datele evenimentului în blocul de mai sus

**Pasul 3.** La `"coupleQuote"` scrie citatul cu **ghilimele speciale** (observă că în JSON sunt `\"` în față și la final — asta e obligatoriu):
```json
"coupleQuote": "\"A fost exact cum ne-am dorit — o seară de neuitat!\""
```

**Pasul 4.** Dacă nu ai poză, poți lăsa `"image": ""` — va apărea un placeholder albastru.

**Pasul 5.** Actualizează și statisticile de sus dacă este cazul:
```json
"stats": {
  "events": "155+",
  "reviews": "105+"
}
```

---

## 11. Cum adaugi sau modifici un articol de Blog

### Deschide: `src/data/blogPosts.json`

Fiecare articol are această structură generală:

```json
{
  "slug": "titlul-articolului-cu-liniute",
  "category": "Categorie",
  "categoryAccent": "rose",
  "title": "Titlul complet al articolului",
  "excerpt": "Un rezumat scurt de 1-2 propoziții.",
  "coverImage": "/images/poza-articol.jpg",
  "coverEmoji": "🎵",
  "readTime": "5 min",
  "date": "2026-03-16",
  "author": "Florentina Pană",
  "content": [ ... ]
}
```

### Câmpuri importante:

| Câmp | Ce face | Exemplu |
|---|---|---|
| `slug` | Adresa URL a articolului | `"ce-muzica-alegem-la-nunta"` |
| `category` | Categoria afișată | `"Sfaturi"` |
| `categoryAccent` | Culoarea categoriei | `"rose"`, `"gold"`, `"teal"`, `"cyan"` |
| `coverEmoji` | Emoji afișat dacă nu ai poză | `"🎹"` |
| `date` | Data publicării (format AAAA-LL-ZZ) | `"2026-03-16"` |

---

### Conținutul articolului (câmpul `"content"`)

Articolul este format din blocuri. Există 3 tipuri:

**1. Paragraf de text:**
```json
{
  "type": "paragraph",
  "text": "Textul paragrafului tău aici."
}
```

**2. Titlu de secțiune:**
```json
{
  "type": "heading",
  "text": "Titlul secțiunii"
}
```

**3. Imagine:**
```json
{
  "type": "image",
  "src": "/images/poza-articol.jpg",
  "caption": "Descrierea pozei"
}
```

### Exemplu articol complet nou:

```json
{
  "slug": "cum-alegem-muzica-la-nunta",
  "category": "Sfaturi",
  "categoryAccent": "gold",
  "title": "Cum alegem muzica potrivită la nuntă",
  "excerpt": "Câteva sfaturi practice pentru a crea un program muzical de care să vă aduceți aminte toată viața.",
  "coverImage": "",
  "coverEmoji": "💍",
  "readTime": "4 min",
  "date": "2026-03-16",
  "author": "Florentina Pană",
  "content": [
    {
      "type": "paragraph",
      "text": "Muzica la nuntă este mai mult decât fundal — este coloana sonoră a uneia dintre cele mai importante zile din viața voastră."
    },
    {
      "type": "heading",
      "text": "Primul pas: discuția cu formația"
    },
    {
      "type": "paragraph",
      "text": "Înainte de orice, stabiliți o întâlnire cu formația și spuneți-le ce vă place și ce nu vă place. Cu cât comunicarea e mai clară, cu atât seara va fi mai reușită."
    }
  ]
}
```

> ⚠️ **Important:** `"slug"` trebuie să fie unic (diferit de toate celelalte articole) și să conțină doar litere mici, cifre și liniuțe `-`, fără spații, fără diacritice.

---

## 12. Cum publici site-ul pe internet

> Publicarea înseamnă că generezi versiunea finală a site-ului pe care o încarci la furnizorul de hosting.

### Pasul 1 — Verifică că totul arată bine local

Pornește serverul (`npm run dev`) și verifică în browser că tot ce ai adăugat arată corect.

### Pasul 2 — Oprește serverul local

Apasă **Ctrl + C** în Terminal.

### Pasul 3 — Rulează comanda de build

În Terminal scrie și apasă Enter:
```
npx astro build
```

Așteptați. Dacă la final scrie `[build] Complete!` — totul este în regulă. ✅

Dacă apar erori roșii — cel mai probabil ai o virgulă lipsă sau în plus în fișierul JSON. (Vezi secțiunea 13)

### Pasul 4 — Folderul generat

Build-ul creează folderul **`dist/`** în proiect. Acesta conține versiunea finală a site-ului.

### Pasul 5 — Încărcarea pe hosting

Conținutul folderului `dist/` se încarcă pe serverul de hosting (prin FTP, cPanel File Manager sau platforma specifică hostingului tău).

> **Dacă folosești Netlify / Vercel:** Aceste platforme fac build-ul automat când schimbările sunt trimise pe GitHub. Nu mai e nevoie de pasul manual.

---

## 13. Probleme frecvente și soluții

---

### ❌ Eroare: "Unexpected token" sau "JSON parse error"

**Cauza:** O greșeală în fișierul JSON (virgulă lipsă, ghilimele netancheiate, etc.)

**Soluție:**
1. Deschide fișierul cu eroarea în VS Code
2. VS Code subliniază cu **roșu** linia cu problema
3. Cele mai frecvente greșeli:
   - Virgulă lipsă după un bloc `}`
   - Virgulă în plus după ultimul element (înainte de `]` sau `}`)
   - Ghilimele deschise fără a fi închise
   - Caractere speciale copiate din Word (ghilimele „ " în loc de " ")

**Sfat:** Când copiezi text dintr-un document Word sau email, înlocuiește întotdeauna ghilimelele „  " cu ghilimele normale `"  "`.

---

### ❌ Poza nu apare pe site

**Verifică:**
1. Fișierul pozei este în folderul `public/images/`?
2. Numele fișierului din JSON corespunde exact cu numele fișierului (inclusiv extensia .jpg sau .png)?
3. Adresa în JSON începe cu `/images/` (cu slash la început)?

✅ Corect: `"/images/poza-mea.jpg"`
❌ Greșit: `"images/poza-mea.jpg"` sau `"public/images/poza-mea.jpg"`

---

### ❌ Videoclipul YouTube nu apare

**Verifică:**
1. AI copiat doar **ID-ul** (ex: `aDB9Aa9cFLY`), nu tot link-ul?
2. Videoclipul de pe YouTube este **public** (nu privat sau listat)?

---

### ❌ Articolul de blog nu apare la adresa lui

**Verifică:**
1. `"slug"` nu conține spații, diacritice sau caractere speciale?
2. `"slug"` este unic față de celelalte articole?
3. Ai salvat fișierul cu **Ctrl + S**?

---

### ❌ Site-ul local nu pornește (npm run dev dă eroare)

**Soluție:**
1. Închide toate ferestrele de Terminal din VS Code (**X** pe fiecare)
2. Apasă **Ctrl + `` ` ``** să deschizi un Terminal nou
3. Scrie: `npm run dev` și apasă Enter

---

### ❌ Build-ul dă eroare la `npx astro build`

1. Citește cu atenție mesajul de eroare — spune exact fișierul și linia cu problema
2. Deschide fișierul respectiv și caută linia indicată
3. Cel mai adesea e o problemă în JSON — verifică virgulele și ghilimelele

---

## ✅ Lista de verificare înainte de publicare

Bifează fiecare punct înainte să faci build-ul final:

- [ ] Am actualizat datele de contact (telefon, email)
- [ ] Am înlocuit toate pozele placeholder cu poze reale (galerie, membri)
- [ ] Am adăugat cel puțin 3 videoclipuri YouTube reale
- [ ] Am verificat că toate paginile se deschid corect în browser (local)
- [ ] Am verificat pagina Contact — butonul de telefon funcționează?
- [ ] Am rulat `npx astro build` și a ieșit fără erori
- [ ] Am încărcat folderul `dist/` pe hosting

---

## 📌 Structura fișierului `siteContent.json` — hartă rapidă

```
siteContent.json
├── brand          → Numele formației, tagline
├── seo            → Titlu și descriere pentru Google
├── contact        → Telefon, email, oraș
├── socialLinks    → YouTube, Facebook, Instagram
├── navigation     → Butoanele din bara de sus
├── hero           → Prima pagină: titlu mare, descriere, butoane
├── videos         → Toate videoclipurile YouTube
├── videoAdmin     → Setări tehnice pentru galeria video (nu modifica)
├── realMoments    → Momente cu mirii (nunți reale + statistici)
├── news           → Noutăți și comentarii aprobate
├── tvAppearances  → Apariții la TV
├── services       → Tipuri de evenimente (Nunți, Botezuri, Corporate)
├── repertoire     → Categorii de repertoriu și piese
├── team           → Membrii formației și colaboratorii
├── gallery        → Galeria foto
└── faq            → Întrebări frecvente
```

---

*Ghid creat pentru uz intern — Formația Florentina Pană*
*Versiunea 1.0 — Martie 2026*
