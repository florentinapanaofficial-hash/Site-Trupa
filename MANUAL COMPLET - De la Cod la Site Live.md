# MANUAL COMPLET
## De la codul gata până la site-ul live pe internet
### Site-ul Formației Florentina Pană — Ghid pentru Claudiu

---

> **Acest document îți explică, pas cu pas și fără termeni tehnici, tot ce trebuie să faci ca să publici site-ul, să-l actualizezi și să-l menții în funcțiune.**
>
> Poți tipări acest document și să-l ai lângă tine când lucrezi.

---

## CUPRINS

**PARTEA 1 — Pregătire (se face o singură dată)**
1. Programele necesare pe calculator
2. Contul Netlify (publicarea pe internet)
3. Contul GitHub (salvarea codului)
4. Conectarea GitHub cu Netlify

**PARTEA 2 — Cum publici site-ul pentru prima oară**
5. Pașii de publicare inițială

**PARTEA 3 — Cum actualizezi site-ul după ce e live**
6. Fluxul complet de actualizare
7. Cum schimbi texte, poze, videoclipuri

**PARTEA 4 — Instrumentul SEO cu Ollama (opțional)**
8. Ce este și când îl folosești
9. Pașii de utilizare

**PARTEA 5 — Întrebări frecvente**
10. Probleme și soluții

---
---

# PARTEA 1 — PREGĂTIRE
## (Se face o singură dată, nu mai repeți)

---

## 1. Programele necesare pe calculator

Verifică dacă ai deja instalate aceste programe. Dacă nu, urmează instrucțiunile de mai jos.

---

### PROGRAMUL 1: Visual Studio Code (VS Code)

**Ce este:** Editorul de cod — programul în care deschizi și modifici fișierele site-ului.

**Ai nevoie de el pentru:** orice modificare pe site.

**Cum îl instalezi (dacă nu îl ai):**
1. Deschide Chrome sau Edge
2. Mergi la adresa: **code.visualstudio.com**
3. Apasă butonul mare albastru **"Download for Windows"**
4. Deschide fișierul descărcat și urmează pașii de instalare (Next → Next → Install)

**Cum știi că e instalat:** Pe desktop sau în meniul Start apare o pictogramă albastră cu litera **V**.

---

### PROGRAMUL 2: Node.js

**Ce este:** Motor care face site-ul să funcționeze pe calculatorul tău (pentru previzualizare înainte de publicare).

**Cum îl instalezi (dacă nu îl ai):**
1. Mergi la adresa: **nodejs.org**
2. Apasă butonul **"LTS"** (recomandat) — se descarcă un fișier `.msi`
3. Deschide fișierul și urmează pașii: Next → Accept → Next → Install

**Cum verifici că e instalat:**
- Deschide VS Code
- Apasă **Ctrl + `** (tasta backtick, lângă cifra 1) — se deschide un terminal în jos
- Scrie: `node --version` și apasă Enter
- Trebuie să apară ceva de genul: `v22.0.0` (orice număr = OK)

---

### PROGRAMUL 3: Git

**Ce este:** Programul care salvează modificările codului și le trimite pe internet (la Netlify).

**Cum îl instalezi (dacă nu îl ai):**
1. Mergi la adresa: **git-scm.com**
2. Apasă **"Download for Windows"**
3. Deschide fișierul descărcat → Next de mai multe ori → la secțiunea **"Adjusting your PATH"** alege **"Git from the command line"** → continuă cu Next → Install

**Cum verifici că e instalat:**
- În terminalul din VS Code scrie: `git --version`
- Trebuie să apară: `git version 2.xx.x`

---

### PROGRAMUL 4: Git — configurare cu numele tău (se face o singură dată)

După instalarea Git, deschide terminalul în VS Code și scrie aceste 2 comenzi (înlocuiești cu datele tale reale):

```
git config --global user.name "Claudiu Pana"
git config --global user.email "adresa_ta@email.com"
```

Apasă Enter după fiecare linie. Nu apare niciun mesaj de confirmare — asta înseamnă că a mers.

---

## 2. Contul Netlify

**Ce este Netlify:** Serviciul de pe internet care găzduiește site-ul tău. Este **gratuit** pentru un site simplu.

**Dacă nu ai deja cont:**
1. Mergi la **netlify.com**
2. Apasă **Sign up**
3. Alege **"Sign up with GitHub"** (cel mai simplu — creezi automat și contul GitHub)
4. Urmează instrucțiunile

**Dacă ai deja cont:** continuă la pasul următor.

---

## 3. Contul GitHub

**Ce este GitHub:** Un serviciu online unde se stochează codul site-ului. Este ca un "Google Drive pentru programatori". Este **gratuit**.

**Dacă nu ai cont:** Mergi la **github.com** și apasă **Sign up**. Urmează instrucțiunile.

**Dacă ai deja cont:** continuă la pasul următor.

> **Notă importantă:** Reține bine adresa de email și parola contului GitHub — vei avea nevoie de ele de mai multe ori.

---

## 4. Conectarea GitHub cu Netlify

Aceasta se face o singură dată. Scopul este ca atunci când salvezi modificările pe GitHub, Netlify să actualizeze automat site-ul.

1. Intră pe **netlify.com** și autentifică-te
2. Apasă **"Add new site"** → **"Import an existing project"**
3. Alege **"GitHub"** ca sursă
4. Autorizează Netlify să acceseze GitHub-ul tău
5. Alege repository-ul cu site-ul formației
6. Netlify va detecta automat că e un site Astro
7. Apasă **"Deploy site"**

Site-ul va primi un link de genul: `formatie-florentinapana.netlify.app`

> **Poți conecta mai târziu și un domeniu propriu** (ex: `florentinapana.ro`) din panoul Netlify → Domain Settings.

---
---

# PARTEA 2 — PUBLICAREA INIȚIALĂ
## (Dacă site-ul nu a mai fost publicat niciodată)

---

## 5. Pașii de publicare inițială

### Ce faci în VS Code — Terminal

Deschide VS Code. Apasă **Ctrl + `** pentru a deschide terminalul. Asigură-te că ești în folderul proiectului (scrie `cd "D:\landing-ul meu"` dacă nu ești deja acolo).

---

**PASUL A — Instalează dependențele (o singură dată)**

```
npm install
```

Așteptă să se termine. Poate dura 1-2 minute. Vei vedea mesaje care curg — normal.

---

**PASUL B — Previzualizează site-ul local (opțional, recomandat)**

```
npm run dev
```

Deschide Chrome la adresa **http://localhost:4321** și verifică că totul arată bine.

Când ești mulțumit, apasă **Ctrl + C** în terminal ca să oprești serverul.

---

**PASUL C — Inițializează Git (o singură dată)**

```
git init
git add .
git commit -m "prima versiune a site-ului"
```

Apasă Enter după fiecare linie. La ultima comandă vei vedea o listă de fișiere — normal.

---

**PASUL D — Conectează cu GitHub**

1. Mergi pe **github.com** și autentifică-te
2. Apasă **"+"** (dreapta sus) → **"New repository"**
3. La **Repository name** scrie: `site-florentina-pana`
4. Lasă **Private** bifat
5. NU bifa nimic altceva
6. Apasă **"Create repository"**

7. GitHub îți va afișa câteva comenzi. Copiază și rulează în terminal:

```
git remote add origin https://github.com/CONTUL_TAU/site-florentina-pana.git
git branch -M main
git push -u origin main
```

(înlocuiește `CONTUL_TAU` cu numele tău de pe GitHub)

---

**PASUL E — Conectează Netlify cu GitHub** (vezi Capitolul 4 de mai sus)

Odată conectat, Netlify va publica site-ul în câteva minute. Vei primi un link public.

✅ **Site-ul este acum live pe internet!**

---
---

# PARTEA 3 — ACTUALIZAREA SITE-ULUI
## (Cum faci modificări după ce site-ul e deja live)

---

## 6. Fluxul complet de actualizare

**De fiecare dată când vrei să schimbi ceva pe site**, urmezi acești 4 pași:

---

### PASUL 1 — Deschide proiectul în VS Code

1. Deschide **Visual Studio Code**
2. **File** → **Open Folder...** → navighează la `D:\landing-ul meu` → **Select Folder**

---

### PASUL 2 — Pornește previzualizarea locală (recomandat)

Apasă **Ctrl + `** pentru terminal, scrie:

```
npm run dev
```

Deschide **http://localhost:4321** în browser ca să vezi modificările în timp real.

---

### PASUL 3 — Fă modificările dorite

Deschide fișierul de modificat (cel mai des `src/data/siteContent.json`), fă schimbările, salvează cu **Ctrl + S**. Site-ul din browser se actualizează singur.

> **Ghidul detaliat** pentru tipuri de modificări (texte, poze, videoclipuri etc.) se află în documentul separat: **"Ghid - Pana Claudiu.md"**

---

### PASUL 4 — Publică modificările pe internet

Când ești mulțumit de ce ai schimbat, în terminal scrie **3 comenzi** (una câte una):

```
git add .
```
*(marchează toate fișierele modificate pentru salvare)*

```
git commit -m "descriere scurta a ce ai schimbat"
```
*(salvează modificările cu o descriere — pune orice text între ghilimele)*

De exemplu:
- `git commit -m "am adaugat poza nunta Andreea"`
- `git commit -m "am actualizat numarul de telefon"`
- `git commit -m "am adaugat videoclip YouTube petrecere"`

```
git push
```
*(trimite modificările la GitHub — Netlify va actualiza site-ul automat)*

---

### ⏱️ Cât durează până apare pe site?

După `git push`, Netlify primește modificarea și reconstruiește site-ul. Durează de obicei **1-3 minute**. Poți urmări progresul pe **netlify.com** în panoul tău.

---

### 🔁 Rezumat rapid (de lipit pe monitor)

```
1. Deschide VS Code → Open Folder D:\landing-ul meu
2. Ctrl+` → npm run dev → verifici la localhost:4321
3. Faci modificările → Ctrl+S
4. git add .
   git commit -m "ce am schimbat"
   git push
5. Aștepți 1-3 minute → site-ul e actualizat!
```

---

## 7. Modificări rapide frecvente

### 7.1 Schimbarea numărului de telefon

1. Deschide `src/data/siteContent.json`
2. Caută `"phoneRaw"` (folosește **Ctrl + F** pentru căutare în fișier)
3. Modifică numărul la ambele câmpuri: `"phoneRaw"` și `"phoneDisplay"`
4. Salvează → **git add . → commit → push**

---

### 7.2 Adăugarea unui videoclip YouTube

1. Pe YouTube, copiază ID-ul din adresă (ex: `...watch?v=`**`aDB9Aa9cFLY`**)
2. Deschide `src/data/siteContent.json` → caută `"videos"`
3. Adaugă la sfârșitul listei (înainte de `]`):

```json
{
  "title": "Titlul videoclipului",
  "youtubeId": "ID_COPIAT",
  "youtubeUrl": "https://www.youtube.com/watch?v=ID_COPIAT",
  "category": "petrecere"
}
```

Categorii valide: `"petrecere"` / `"usoara-diverse"` / `"tineret-manele"`

4. Salvează → **git add . → commit → push**

---

### 7.3 Adăugarea unei poze în galerie

1. Copiază poza în folderul `public/images/` (dă-i un nume fără spații, ex: `nunta-ion-2026.jpg`)
2. Deschide `src/data/siteContent.json` → caută `"gallery"`
3. Adaugă:

```json
{
  "alt": "Descriere poză — Nuntă Ion și Maria, mai 2026",
  "image": "/images/nunta-ion-2026.jpg"
}
```

4. Salvează → **git add . → commit → push**

---

### 7.4 Adăugarea unui moment cu mirii

1. Copiază poza în `public/images/`
2. Deschide `src/data/siteContent.json` → caută `"realMoments"` → `"events"`
3. Adaugă un bloc nou:

```json
{
  "title": "Nuntă Ion & Maria",
  "couple": "Ion & Maria",
  "city": "Pitești",
  "date": "Mai 2026",
  "image": "/images/nunta-ion-2026.jpg",
  "audioUrl": "",
  "youtubeUrl": "",
  "coupleQuote": "\"A fost exact ce ne-am dorit!\""
}
```

4. Actualizează și statisticile dacă e cazul (`"events": "156+"`)
5. Salvează → **git add . → commit → push**

---
---

# PARTEA 4 — INSTRUMENTUL SEO CU OLLAMA
## (Opțional — pentru optimizarea site-ului în Google)

---

## 8. Ce este și când îl folosești

**SEO** = cum apare site-ul tău în rezultatele Google (titlul și descrierea care apar când cineva caută).

**Ollama** = un program instalat pe calculatorul tău care folosește inteligență artificială (modelul Mistral) ca să scrie variante optimizate de text pentru Google.

**Când îl folosești:**
- Când vrei să îmbunătățești cum apare site-ul în Google
- Înaintea sezonului de nunți (mai–septembrie)
- Când adaugi servicii noi sau zone geografice noi de activitate
- În general: **1-2 ori pe an** este suficient

---

## 9. Pașii de utilizare SEO

### Cerință: Ollama trebuie instalat și modelul `mistral` descărcat

(Dacă nu ai făcut asta încă, descarcă Ollama de pe **ollama.com** și rulează `ollama pull mistral` în terminal)

---

### PASUL 1 — Pornește Ollama

Deschide un terminal (poate fi și Terminalul Windows, nu neapărat VS Code) și scrie:

```
ollama serve
```

**Lasă această fereastră deschisă** cât timp lucrezi cu scriptul SEO. Nu o închide.

---

### PASUL 2 — Testează fără a modifica fișierul (recomandat)

În terminalul din VS Code (diferit de cel cu Ollama), scrie:

```
npm run update-seo:dry
```

Vei vedea ce text a generat AI-ul. Dacă ți se pare bun, mergi la Pasul 3. Dacă nu, mai rulează comanda o dată — de fiecare dată generează variante diferite.

---

### PASUL 3 — Aplică modificarea

Când ești mulțumit de rezultat, scrie:

```
npm run update-seo
```

Fișierul `siteContent.json` va fi actualizat automat.

---

### PASUL 4 — Publică pe site

```
git add src/data/siteContent.json
git commit -m "seo: actualizare automata cu Ollama"
git push
```

✅ Google va indexa noile texte în câteva zile.

---

### ℹ️ Ce face scriptul automat

- Trimite textul SEO actual la modelul Mistral
- Primește 3 variante (dacă prima nu respectă limitele, încearcă din nou)
- Dacă niciuna nu e perfectă, trunchiază automat la limitele corecte
- Scrie rezultatul în fișier

Nu trebuie să faci nimic manual — scriptul se ocupă de tot.

---
---

# PARTEA 5 — ÎNTREBĂRI FRECVENTE
## Probleme și soluții

---

### ❓ Scriu `npm run dev` și apare eroare "command not found"

**Cauza:** Node.js nu e instalat sau terminalul nu știe unde e.

**Soluție:**
1. Închide VS Code complet
2. Reinstalează Node.js de pe **nodejs.org**
3. Redeschide VS Code și încearcă din nou

---

### ❓ Scriu `git push` și îmi cere user și parolă

**Cauza:** Git vrea să se autentifice la GitHub.

**Soluție:**
1. La **Username** scrie numele tău de pe GitHub
2. La **Password** NU scrie parola — scrie un **Personal Access Token**

**Cum faci un token:**
1. Mergi pe **github.com** → contul tău (dreapta sus) → **Settings**
2. Scrolează jos → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. **Generate new token** → bifează `repo` → **Generate token**
4. Copiază tokenul (îl vezi o singură dată!) și folosește-l în loc de parolă

---

### ❓ Site-ul nu se actualizează pe Netlify după `git push`

**Soluție:**
1. Mergi pe **netlify.com** → site-ul tău → tab-ul **"Deploys"**
2. Verifică dacă există o eroare (apare cu roșu)
3. Dacă e eroare, apasă pe ea și citește mesajul — cel mai frecvent e un fișier JSON cu o virgulă lipsă

---

### ❓ Am schimbat ceva în JSON și site-ul nu mai pornește local

**Cauza:** Cel mai probabil o virgulă lipsă sau în plus în fișierul JSON.

**Soluție:**
1. Deschide `src/data/siteContent.json` în VS Code
2. VS Code subliniază cu roșu locul unde e eroarea
3. Caută linia subliniată și verifică dacă lipsește sau e în plus o virgulă `,`

**Regula de aur pentru JSON:**
- Între elemente dintr-o listă: **DA virgulă** după fiecare, EXCEPT ultimul
- Nu pune virgulă după `}` sau `]` de la final

---

### ❓ Am greșit ceva și vreau să revin la versiunea anterioară

**Soluție:**
1. Mergi pe **github.com** → repository-ul site-ului
2. Click pe **"commits"** (istoricul modificărilor)
3. Găsește versiunea la care vrei să te întorci
4. Apasă butonul **"..."** → **"Revert"** sau contactează-mă

---

### ❓ Ollama nu răspunde / scriptul SEO dă eroare de conexiune

**Soluție:**
1. Verifică dacă ai rulat `ollama serve` într-un terminal separat
2. Dacă ai rulat deja, poate că s-a oprit — închide terminalul și rulează din nou `ollama serve`
3. Dacă tot nu merge: repornește calculatorul, pornește Ollama, și încearcă din nou

---
---

## 📋 REZUMAT VIZUAL — Fluxul de lucru

```
┌─────────────────────────────────────────────────────────┐
│  PRIMA PUBLICARE (o singură dată)                       │
│                                                         │
│  1. Instalezi: VS Code + Node.js + Git                  │
│  2. Creezi cont: GitHub + Netlify                       │
│  3. npm install                                         │
│  4. git init → git add . → git commit → git push        │
│  5. Conectezi Netlify cu GitHub                         │
│  ✅ Site live!                                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  ACTUALIZARE (de fiecare dată)                          │
│                                                         │
│  1. Deschizi VS Code → folderul proiectului             │
│  2. npm run dev → verifici la localhost:4321            │
│  3. Modifici fișierul dorit → Ctrl+S                    │
│  4. git add .                                           │
│     git commit -m "ce am schimbat"                      │
│     git push                                            │
│  5. Aștepți 1-3 minute → site actualizat!               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  SEO CU OLLAMA (1-2 ori pe an)                         │
│                                                         │
│  1. ollama serve  (într-un terminal separat)            │
│  2. npm run update-seo:dry  (previzualizare)            │
│  3. npm run update-seo  (aplică modificarea)            │
│  4. git add . → git commit → git push                   │
└─────────────────────────────────────────────────────────┘
```

---

## 📞 Contact pentru asistență tehnică

Dacă ceva nu merge și nu găsești soluția în acest manual, descrie exact:
- Ce ai vrut să faci
- Ce comandă ai scris
- Ce mesaj de eroare a apărut (copiază textul exact)

Cu aceste informații, problema se rezolvă mult mai rapid.

---

*Document creat: martie 2026 | Site: Formația Florentina Pană*
