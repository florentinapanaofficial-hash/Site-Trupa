# Academy Music

Platformă LMS pentru cursurile de **orgă** și **canto** de la Palatul Copiilor Pitești.
Subdomeniu țintă: `academy-music.florentinapanaofficial.ro`

Stack: **React 18 + Vite 6 + TailwindCSS 3 + Supabase** (Auth, Postgres, Storage).

---

## 1. Structura proiectului

```
academy-music.florentinapanaofficial.ro/
├── index.html
├── server.mjs                 # server static + CSP și headere de securitate
├── railway.toml               # configurație deploy
├── supabase/schema.sql        # tabele, funcții, RLS, buckete
├── supabase/migrations/       # migrări SQL incrementale
└── supabase/functions/       # funcții server-side pentru administrare conturi
├── public/favicon.svg
└── src/
    ├── main.jsx               # punct de intrare
    ├── App.jsx                # rutele aplicației
    ├── index.css              # Tailwind + reguli de protecție conținut
    ├── data/games.json        # întrebări quiz + rebus
    ├── lib/
    │   ├── supabase.js        # client (doar cheia anon)
    │   ├── auth.jsx           # AuthProvider, rol, sesiune
    │   ├── media.js           # URL-uri semnate + upload
    │   ├── activity.js        # sesiuni de activitate și heartbeat
    │   └── useTeacherMode.js  # starea comutatorului profesor
    ├── components/
    │   ├── Layout.jsx             # navigație, antet, comutator
    │   ├── ProtectedRoute.jsx     # gardă pe sesiune + rol
    │   ├── TeacherModeToggle.jsx  # switch Elev ⇄ Profesor
    │   ├── SecureAudioPlayer.jsx  # streaming fără download
    │   ├── SecurePdfViewer.jsx    # partituri randate pe canvas
    │   ├── SecureMediaView.jsx    # video/foto din bucket privat
    │   ├── PieceCard.jsx
    │   └── ui/                    # Spinner, Modal, EmptyState
    └── pages/
        ├── Login.jsx, Dashboard.jsx, Discipline.jsx
        ├── Red.jsx, Jocuri.jsx, Portofoliu.jsx, NotFound.jsx
        └── admin/
            ├── AdminPanel.jsx      # tab-uri + rute interne
            ├── AdminOverview.jsx   # statistici
            ├── AdminPieces.jsx     # adăugare/ștergere piese + fișiere
            ├── AdminResources.jsx  # resurse RED
            ├── AdminStudents.jsx   # elevi, roluri, blocare
            ├── AdminSubmissions.jsx# notare teme
            └── AdminActivity.jsx   # cine, când, cât timp
```

---

## 2. Conectarea la Supabase — pas cu pas

### 2.1. Creează proiectul
1. Intră pe [supabase.com](https://supabase.com) → **New project**.
2. Regiune recomandată: `Central EU (Frankfurt)` — latență mică din România.
3. Notează parola bazei de date (nu e folosită de aplicație, dar îți trebuie pentru backup).

### 2.2. Rulează schema
**SQL Editor → New query** → lipește tot conținutul din `supabase/schema.sql` → **Run**.

Scriptul creează:
- tabelele `profiles`, `pieces`, `resources`, `submissions`, `activity_sessions`, `activity_events`, `quiz_results`;
- coloana unică `profiles.username` pentru conturile elevilor;
- trigger-ul care creează automat profilul la crearea utilizatorului;
- trigger-ul care **împiedică un elev să-și schimbe singur rolul**;
- funcțiile `start_activity_session` / `touch_activity_session` (durata se calculează pe server);
- politicile RLS pentru fiecare tabel;
- bucketele **private** `academy-media` și `portfolio`, cu politicile lor.

### 2.3. Configurează autentificarea
**Authentication → Providers → Email**: activat.
**Authentication → URL Configuration**:
- Site URL: `https://academy-music.florentinapanaofficial.ro`
- Redirect URLs: adaugă și `http://localhost:5180` pentru dezvoltare.
- În **Authentication → Settings → User Signups**, dezactivează `Allow new users to sign up`. Conturile elevilor sunt create numai de profesor; funcția administrativă confirmă adresele tehnice ale elevilor.

### 2.4. Promovează-te ca profesor
Pentru primul profesor, creează un utilizator cu adresa reală în **Authentication → Users → Add user**. Trigger-ul creează profilul cu rolul `student`; promovează apoi contul în SQL Editor:

```sql
update public.profiles set role = 'teacher'
where id = (select id from auth.users where email = 'adresa@ta.ro');
```

Apoi **verifică** rezultatul — mesajul „Success. 1 row affected" nu garantează că valoarea s-a schimbat, pentru că triggerul `protect_profile_role` rulează înainte de scriere:

```sql
select u.email, p.role, p.is_active
from public.profiles p join auth.users u on u.id = p.id
where u.email = 'adresa@ta.ro';
```

Dacă `role` a rămas `student`, verifică trigger-ul `lock_profile_role` și repetă UPDATE-ul din SQL Editor. După schimbare, autentifică-te cu emailul și parola reală ale profesorului; conturile profesorilor existente continuă să funcționeze cu email.

### 2.5. Conturile elevilor și username
1. Rulează `supabase/migrations/20261016_student_usernames.sql` în SQL Editor (sau schema completă actualizată).
2. Din rădăcina proiectului, conectează Supabase CLI și publică funcția:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy create-student
```

Funcția verifică tokenul și rolul profesorului, apoi creează elevul cu Auth Admin API. Cheia `SUPABASE_SERVICE_ROLE_KEY` este folosită numai în Supabase Edge Functions și nu trebuie pusă în `.env`-ul Vite ori într-o variabilă `VITE_*`.

3. În aplicație, deschide **Panou profesor → Elevi → Creează cont**. Username-ul propus poate fi editat; parola se generează din buton. După creare, transmite elevului datele afișate: parola apare o singură dată și nu este salvată în profil.
4. Elevul se autentifică folosind username-ul și parola. Profesorii existenți se pot autentifica în continuare cu email și parola lor.

Username-ul este convertit intern la o adresă tehnică din domeniul rezervat `.invalid`; nu se trimite email și resetarea prin email nu este disponibilă pentru elevi. Profesorul trebuie să păstreze parola generată și să o transmită elevului.

### 2.6. Variabilele de mediu
Copiază `.env.example` în `.env` și completează din **Project Settings → API**:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> Cheia `service_role` **nu** se pune niciodată într-un fișier `VITE_*`. Tot ce are prefixul `VITE_` ajunge în bundle-ul din browser.

---

## 3. Rulare locală

```bash
cd academy-music.florentinapanaofficial.ro
npm install
npm run dev      # http://localhost:5180
npm run build    # bundle de producție în dist/
npm start        # servește dist/ cu headerele de securitate
```

---

## 4. Cum sunt protejate materialele

| Mecanism | Unde | Ce face |
|---|---|---|
| Buckete private | `supabase/schema.sql` | Fișierele nu au URL public. Fără sesiune validă nu există acces. |
| URL-uri semnate | `src/lib/media.js` | Linkuri valabile 5 minute, regenerate automat. Un link copiat expiră. |
| Player propriu | `SecureAudioPlayer.jsx` | `<audio>` fără `controls` → browserul nu mai afișează meniul „Salvează audio ca…". |
| Partituri pe canvas | `SecurePdfViewer.jsx` | PDF-ul se randează ca imagine; viewerul nativ cu buton de Download nu apare deloc. |
| Clic dreapta / drag / print | `index.css` + componente | Meniu contextual blocat, selecție dezactivată, `Ctrl+S` și `Ctrl+P` interceptate, print golit. |
| Filigran | `SecurePdfViewer.jsx` | Numele elevului apare peste partitură — descurajează capturile distribuite. |
| RLS | Postgres | Elevul citește doar ce îi aparține; doar profesorul scrie în `pieces` și `resources`. |
| CSP | `server.mjs` | `frame-ancestors 'none'`, fără `unsafe-eval`, surse externe limitate la Supabase și Google Fonts. |

> **Important, fără iluzii:** nimic nu poate opri complet o captură de ecran sau o înregistrare audio analogică. Măsurile de mai sus elimină descărcarea comodă (un clic) și distribuirea de linkuri, ceea ce acoperă situația reală dintr-o clasă.

---

## 5. Fluxul de lucru

**Profesor**
1. Creează contul elevului din `Elevi → Creează cont` și transmite username-ul și parola generată.
2. `Piese` → completează formularul, încarcă negativul, pozitivul și partitura PDF.
3. `RED` → adaugă fișe teoretice și exerciții.
4. `Teme` → ascultă/vizionează înregistrările, pune nota și observațiile.
5. `Activitate` → vezi sesiunile recente și deschide `Conectați acum` pentru lista live a elevilor/profesorilor activi.

**Elev**
1. Se autentifică cu username-ul și parola primite de la profesor.
2. Intră la `Orgă` sau `Canto`, filtrează după nivel, ascultă negativul și deschide partitura.
3. Rezolvă quizul și rebusul din `Jocuri`.
4. Încarcă tema în `Portofoliu` și primește feedback.

---

## 6. Deploy pe Railway

1. **New Project → Deploy from GitHub repo** (sau `railway up` din acest folder).
2. **Variables**: adaugă `VITE_SUPABASE_URL` și `VITE_SUPABASE_ANON_KEY`.
   Variabilele `VITE_*` se citesc **la build**, deci după modificarea lor e nevoie de redeploy.
3. **Settings → Networking → Custom Domain**: `academy-music.florentinapanaofficial.ro`.
4. În DNS-ul domeniului adaugă `CNAME` de la `academy-music` către hostul oferit de Railway.
5. În Supabase → **Authentication → URL Configuration**, adaugă subdomeniul la Redirect URLs.

---

## 7. Limite de încărcare

| Tip | Limită aplicație |
|---|---|
| Video (portofoliu) | 200 MB |
| Audio | 50 MB |
| Imagine | 10 MB |

Limita globală a fișierelor se configurează și în Supabase: **Storage → Settings → Upload file size limit** (implicit 50 MB pe planul gratuit).
