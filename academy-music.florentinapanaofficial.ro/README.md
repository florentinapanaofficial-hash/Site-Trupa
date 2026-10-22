# Academy Music

Platformă LMS pentru cursurile de **orgă** și **canto** de la Palatul Copiilor Pitești.
Subdomeniu țintă: `academy-music.florentinapanaofficial.ro`

Stack: **Astro 7 (SSR Cloudflare Workers) + React 18 + MDX + TailwindCSS 4 + Supabase** (Auth, Postgres, Storage privat). Audio: URL-uri directe Cloudflare R2/CDN; Canto acceptă și upload MP3 privat în Supabase Storage.

---

## Pagina publică de start

- `/` este landing-ul public Astro: Hero cu prezentare manuală Canto/Instrument-orgă/Teorie, butoane către `/login/` și site-ul oficial, plus secțiunea E-Learning către revista externă (tab nou cu `noopener noreferrer`). Ilustrațiile sunt SVG inline și elemente CSS; nu se descarcă imagini externe sau instrumentele dashboard-ului.
- `/dashboard/` este dashboard-ul existent, protejat. Loginul și navigarea Acasă trimit aici; nu se afișează conținut educațional privat pe landing.
- Un cookie valid la `/` produce redirect server-side către `/dashboard/`. Fără cookie, pagina este publică și nu apelează Supabase. Dacă browserul păstrează o sesiune locală, aceasta se validează prin `/api/auth/session/` înainte de redirect; serviciile indisponibile afișează o eroare explicită.
- Prezentarea se schimbă numai la cererea vizitatorului, inclusiv din tastatură; nu există autoplay. Animația decorativă se oprește în mai puțin de 5 secunde și respectă `prefers-reduced-motion`. Fără JavaScript rămân disponibile textul, prima prezentare și toate linkurile.
- Se păstrează politica existentă `noindex, nofollow` pentru Academy; pagina publică nu activează automat indexarea SEO.
- Validare: `npm run build`, `npm run test:server`, `npm run test:landing` (Chromium existent, mobil/desktop, navigare, sesiuni persistente și fără JavaScript). Capturile opționale se salvează în directorul indicat de `ACADEMY_SCREENSHOT_DIR`.

## Navigare privată și discipline

- `/dashboard/` este ecranul minimalist cu două carduri: Canto → `/canto/` și Instrument-Orgă → `/instrument/`. Fiecare Info folosește un disclosure nativ (`details`/`summary`), separat de linkul cardului, accesibil și din tastatură. Nu se mai încarcă statistici, repertorii sau studioul de înregistrare pe ecranul de selecție.
- `/canto/` încarcă biblioteca vocală existentă; `/instrument/` încarcă repertoriul Orgă, iar `/instrument/claviatura/` claviatura virtuală existentă. Engine-ul nou de pian rămâne separat. Canto include acum monitorizare cu reverb și karaoke pe linie/cuvânt, descrise în secțiunea Modulul 4.
- `/orga/` rămâne compatibilă prin redirect 301 server-side către `/instrument/` pentru utilizatorii autentificați și fallback React `replace`. Toate rutele disciplinei rămân protejate prin middleware/Auth/RLS existente.
- Paginile de discipline, uneltele, resursele comune și panoul profesorului folosesc importuri dinamice React `lazy`. Dashboard-ul nu importă playerul Canto, PDF-ul, claviatura sau panoul admin. Un fallback Suspense local păstrează layout-ul și meniul vizibile în timpul încărcării.
- Sidebar desktop: `sticky top-0 h-screen overflow-y-auto`, cu scroll independent pe ecrane joase. Mobil: header sticky și meniu pliabil cu scroll propriu, Escape și închidere la schimbarea rutei.
- Navigarea la dashboard arată doar Alege disciplina, REVISTA și, pentru profesor, administrarea/toggle-ul existent. În Canto se afișează biblioteca vocală; în Instrument, repertoriul și claviatura. Resursele de teorie, jocurile, portofoliul și cursurile online rămân disponibile după alegerea disciplinei, fără încărcarea lor până la acces. Schimbarea disciplinei se face prin Alege disciplina. Rutele comune vechi sunt păstrate.
- REVISTA este același link extern pe desktop/mobil: `https://revista.florentinapanaofficial.ro/`, cu `target="_blank" rel="noopener noreferrer"`. Rolurile și drepturile profesorului nu sunt schimbate de noua navigare.
- Validare după build: `npm run test:navigation` verifică în Chromium desktop/mobil cele două carduri, Info, meniurile, scroll-ul real, REVISTA și cererile de bundle-uri pentru izolarea disciplinelor. Opțional: `ACADEMY_SCREENSHOT_DIR` pentru capturi în afara repository-ului.

## Biblioteca Canto

Profesor: `/admin/canto/`, tabul **Canto**. Elev: `/canto/`, în continuare autentificat; nu se publică materiale către utilizatori anonimi. Vechiul `/admin/piese/?add=canto` redirecționează spre noul editor, iar secțiunea Piese administrează Orgă.

Înainte de publicarea frontendului, rulează `supabase/migrations/20261019_canto_library.sql` în SQL Editor, după schema Academy și `setup_online_classes.sql`. Migrarea este tranzacțională, repetabilă și nu mută/șterge piesele sau alocările existente. Adaugă `pieces.grupa` (maximum 100 caractere) și `pieces.versuri_text` (maximum 100.000), apoi view-ul read-only `canto_playlist`, cu `security_invoker=true` și acces SELECT doar pentru authenticated. RLS de pe `pieces` rămâne sursa de adevăr.

| View `canto_playlist` | Sursa canonică `pieces` |
|---|---|
| `titlu_piesa` | `title` (titlul manual, nu numele fișierului) |
| `grupa` | `grupa` |
| `pozitiv_url` | `positive_url` (CDN/HTTP(S), opțional) |
| `negativ_url` | `negative_url` (CDN/HTTP(S), opțional) |
| `versuri_text` | `versuri_text` (text simplu, cu rânduri/strofe) |

Uploadurile noi păstrează căile în `audio_pozitiv_path` / `audio_negativ_path`, expuse și în view. Nu se salvează URL-uri semnate expirabile în DB. Bucketul `academy-media` rămâne privat, cu politicile existente de profesor pentru scriere și material publicat pentru citire autorizată. Playerul Canto obține temporar URL-uri semnate și permite retry la eroare; linkurile CDN existente continuă să funcționeze. Resolverul Orgă nu este modificat. Repertoriul comun utilizează playerul privat doar pentru piesele Canto.

Editorul include titlu, grupă cu sugestii din `study_groups` și din bibliotecă, upload pozitiv/negativ și modal de versuri. Layoutul este pe un rând pe desktop larg și se rearanjează pe mobil; tabelul are scroll propriu. Grupa este o etichetă de organizare/filtrare, nu înscriere automată în grupă sau restricție de acces: biblioteca publicată rămâne comună conform politicilor curente. Publicarea/ciorna este păstrată. Piesele istorice fără grupă/versuri rămân disponibile și editabile.

MP3: maximum 30 MB per variantă, verificare extensie/MIME/antet în browser; această verificare nu este antivirus sau validare server-side completă. Titlul nu se deduce din numele fișierului. Doar fișierele selectate sunt încărcate, iar eșecul salvării DB declanșează încercarea de curățare a uploadurilor noi. Eșecul curățării este raportat explicit. Fișierele vechi la înlocuire și fișierele asociate unei piese șterse nu sunt șterse automat din Storage, pentru a nu afecta referințe comune; retenția/curățarea obiectelor neutilizate necesită administrare separată. Nu există tranzacție distribuită Storage/DB sau garanție de cleanup după întreruperea browserului.

Versurile sunt randate ca text React, nu HTML; elevul le poate citi în modal sau în panoul karaoke. Playerele au controale React pentru redare/pauză, poziție și volum, cu oprirea celuilalt audio la pornire. Ascunderea descărcării nu reprezintă DRM. Versurile goale dezactivează butonul elevului; profesorul le poate adăuga ulterior.

Verificări: `npm test`, `npm run build`, `npm run test:browser -- --canto`, cu `ACADEMY_TEST_URL` setat spre preview. Testul browser necesită `ffmpeg` și verifică MP3 real la 1440/390 px, editare, înlocuire independentă, refuz DB/cleanup, versuri și XSS literal, filtrare, redare/excludere, repertoriu comun, ștergere/anulare, retry, metadata și lipsa overflow-ului. Supabase este simulat; migrarea este testată separat în PostgreSQL PGlite inclusiv repetabilitate, limite și RLS. Capturi: `.astro/screenshots/canto-{admin,student,lyrics}-{1440,390}.png`.

## Generare karaoke locală cu SpectraLayers

În **Admin → Piese**, butonul „🎛️ Generează Karaoke (SpectraLayers 12)” creează un job în `audio_processing_queue`. Adminul primește statusul prin Supabase Realtime, ascultă fișierul rezultat din bucketul privat `karaoke-audio` și îl poate asigna explicit drept negativ pentru piesă; apoi îl poate aloca elevilor prin fluxul obișnuit de repertoriu. Elevii autorizați pot citi numai fișierul karaoke referit de o piesă la care au acces.

Aplică `supabase/migrations/20261021000002_audio_processing_queue.sql` în Supabase înainte de deploy. Pentru bridge, urmează pașii din [local-spectralayers-bridge/README.md](./local-spectralayers-bridge/README.md). `SUPABASE_SERVICE_ROLE_KEY` rămâne exclusiv pe PC-ul profesorului, niciodată în bundle-ul web. Argumentele CLI nu sunt presupuse: confirmă automatizarea acceptată de versiunea/ediția SpectraLayers 12 instalată și configurează runnerul local cu `{input}` și `{output}`.

Migrarea adaugă politici RLS pentru profesori, bucket privat, un singur job activ per piesă și înscriere Realtime. `result_url` păstrează locatorul privat `karaoke-audio:negative/<song-id>/<job-id>.<ext>`, nu un URL semnat cu expirare.
## Studio Interactiv MIDI + MP3

`src/components/InteractiveStudio.jsx` este integrată în `/studio/`, separat de pianul care înregistrează teme. Include un studiu MIDI demonstrativ preîncărcat și permite alegerea fișierelor locale `.mid`/`.midi` (maximum 5 MB, 20.000 de note melodice, 20 de minute) și `.mp3` (maximum 100 MB). Fișierele și scorul rămân în browser până la trimiterea explicită a înregistrării în modul Temă; MIDI-ul și negativul de studiu nu sunt trimise automat. Parserul `@tonejs/midi` aplică harta de tempo a fișierului; pistele de percuție sunt excluse și atacurile simultane duplicate ale aceleiași note sunt reunite.

- Claviatura profesorului este read-only și redă acum și demo-ul MIDI prin motorul Web Audio existent: Pian, Acordeon, Nai/Flaut, același instrument selectat ca la elev. Două GainNode-uri master independente controlează „Volum Demo” și „Volumul Meu” (0–100%, implicit 65%/80%); „Mute Demo” atenuează doar demo-ul, păstrează nivelul ales pentru unmute și nu modifică ghidajul vizual, MP3-ul, metronomul sau elevul. Tranzițiile de volum folosesc setTargetAtTime de 10 ms. Ambele claviaturi au derulare comună și selector de registru, cu aproximativ trei octave vizibile pe desktop și acces la toate notele MIDI 0–127. Maparea PC C3–C5 rămâne aceeași ca la pianul existent și funcționează când studioul are focus; touch permite și swipe orizontal.
- Tempo: 25–150%. Cu MP3, `audio.currentTime` este ceasul principal inclusiv în timpul buffering-ului; după terminarea unui negativ mai scurt, ceasul monoton continuă MIDI-ul. MP3 și MIDI trebuie să fie deja aliniate la secunda zero; nu există detecție automată de beat sau compensare a latenței hardware. `preservesPitch` este activat, dar suportul și calitatea time-stretch depind de browser.
- Metronomul studioului are activare separată și măsurile 2/4, 3/4, 4/4, 6/8, 9/8, 12/8. Click pe pătrime pentru /4, pe optime pentru /8 (nu pe pătrime cu punct), cu 1200 Hz pe prima unitate a măsurii și 800 Hz pe restul. Faza măsurii pornește la secunda zero a MIDI-ului, este derivată din tick-uri/PPQ și harta de tempo, fără BPM sau interval de redare independent. Seek-ul și A–B păstrează faza muzicală de la poziția respectivă; punctul A nu devine artificial primul timp.
- Demo-ul și click-urile sunt programate pe AudioContext cu lookahead 120 ms, în același tick de 25 ms al transportului; duratele și decalajele sunt împărțite la multiplicatorul Tempo. Programările sunt anulate/recalculate la pauză, seek, A–B, schimbare de tempo/instrument/măsură, waiting/seeking MP3 sau suspendarea AudioContext. În buffering nu se programează sunete noi. Nu se garantează sincronizare sample-accurate cu HTMLAudioElement, bucle gapless sau lipsa jitter-ului pe hardware real. Metronomul separat al pianului pentru teme rămâne independent, neschimbat.
- Punctele A/B se stabilesc la poziția curentă, cu minimum 0,3 secunde între ele. Seek-ul, schimbarea marcajelor și activarea/dezactivarea buclei încep o evaluare nouă. În buclă, rezultatele se cumulează pe repetări; altfel, la final se afișează procentul de atacuri MIDI potrivite din segmentul studiat. Fereastra de evaluare este de ±180 ms reali, adaptată tempo-ului; fiecare notă punctează o singură dată pe repetare. Acordurile sunt evaluate notă cu notă. Notele ratate rămân în numitor; apăsările greșite se afișează separat. Nu se evaluează durata, dinamica sau degetația propriu-zisă și nu se acordă note oficiale în baza de date.
- Modul Simplu este implicit: Canvas nu este montat și nu rulează `requestAnimationFrame`. Modul Animație desenează doar notele din fereastra vizibilă; în pauză desenează un singur cadru. În ambele moduri, actualizarea transportului/clapelor folosește un interval de 25 ms; componentele claviaturilor sunt memoizate. Ieșirea din pagină sau pierderea vizibilității pune redarea pe pauză și eliberează sunetele.
- „Conectează MIDI” cere explicit Web MIDI fără SysEx, citește note-on/note-off pe toate canalele, inclusiv note-on cu velocity zero, și urmărește conectarea/deconectarea dispozitivelor. Necesită un browser compatibil (Chrome/Edge), HTTPS sau localhost și permisiunea utilizatorului. Nu există fallback USB în Safari/iOS; click/touch/PC rămân disponibile. Nu s-a verificat o orgă USB fizică.

Verificări: `npm test`, `npm run build`, `ACADEMY_TEST_URL=http://127.0.0.1:4194 npm run test:browser` (în PowerShell setează separat variabila de mediu). Suita existentă verifică și studioul la 1440 și 390 px: import MIDI, acorduri, culori/scor final, tempo, buclă, pixeli Canvas/animație, mod simplu, input MIDI simulat și pointer/touch; mixerul este verificat pe noduri Web Audio reale, inclusiv rutare separată, mute cu ghidaj vizual, automatizare volum și accente 3/4. Testele de nucleu acoperă toate cele șase măsuri, harta de tempo variabilă, anulări și limitarea la B. Dacă `ffmpeg` este disponibil în PATH, generează în memorie un MP3 sintetic și verifică decodarea, sincronizarea, playbackRate/preservesPitch, pauza, bucla audio și alinierea click-urilor la schimbări de tempo/măsură; altfel acel subtest este raportat SKIP. Capturile sunt în `.astro/screenshots/interactive-studio-*.png`. Testele nu demonstrează latența sau sunetul perceput pe echipament real.

### Înregistrare în Modul Temă

Prop-ul `isHomeworkMode` este implicit `false`. REC, preview-ul și trimiterea există în DOM doar când valoarea este strict booleanul `true`. Pagina `/studio/` folosește `HomeworkStudio`, care activează modul pentru profilurile Supabase active elev/profesor; vizitatorii și inspectorii rămân în modul de studiu. Integrarea React directă:

```jsx
<InteractiveStudio
    isHomeworkMode={true}
/>
```

Implicit, „Trimite Tema” folosește helperul comun `src/lib/submitHomework.js` și trimite `FormData` cu câmpul `file` și JWT-ul Supabase la `POST /api/upload-homework/`. Endpoint-ul verifică tokenul și profilul activ (elev/student/profesor/teacher), originea same-origin, limita efectivă de 50 MB audio / 5 MB MIDI și semnătura containerului. Acceptă `.mid`, `.midi`, `.mp3`, `.webm`, `.ogg`, `.m4a`, `.mp4`, `.wav`; semnătura nu înlocuiește decodarea completă sau scanarea antivirus. Studioul trimite înregistrarea audio, nu MIDI-ul de referință. După Drive, inserează în `catalog_teme` ID-ul și numele profilului verificat, linkul Drive și, opțional, titlul (200 caractere), mesajul elevului (500 caractere) și piesa asociată. Data `created_at` este generată exclusiv de baza de date; fișierul binar nu ajunge în Supabase. Numai după confirmarea ambelor servicii returnează `{ id, webViewLink }`, apoi UI afișează „Tema a fost trimisă cu succes domnului profesor!” și linkul Drive. Dacă înscrierea în catalog eșuează după upload, răspunde 503 explicit și păstrează fișierul în Drive; nu există tranzacție distribuită sau ștergere automată. Preview-ul se păstrează la eroare. Retry-ul nu este idempotent: verifică folderul înainte de retrimitere.

Același flux este folosit pentru înregistrările **audio** din `RecordingStudio` și fișierele **audio/MIDI** din Portofoliu; titlul, mesajul și piesa sunt păstrate ca metadata. Video și imaginile continuă pe fluxul existent `submissions`/Storage. Înregistrările istorice din Storage nu sunt migrate sau șterse. `HomeworkCatalog.jsx` afișează linkurile cu paginare și reîmprospătare în portofoliul elevului și în pagina principală a profesorului. RLS permite elevului doar înregistrările proprii, profesorului catalogul, iar inspectorului îi interzice trimiterea și accesul la catalogul personal. Un callback opțional `onSubmitHomework` poate suprascrie integrarea din InteractiveStudio și trebuie să arunce eroare la eșec; responsabilitatea persistenței revine integrării personalizate.

Configurare Workers: `GOOGLE_CREDENTIALS` (JSON-ul complet al Service Account-ului, cu `type: "service_account"`, `client_email` și `private_key`), `GOOGLE_DRIVE_FOLDER_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. JSON-ul se parsează numai pe server; cheia RSA acceptă newline-uri reale sau `\\n`. `GOOGLE_CREDENTIALS` are prioritate: o valoare invalidă sau goală produce 503 explicit, fără fallback la alte credențiale. Pentru configurațiile existente, `GOOGLE_CLIENT_EMAIL` și `GOOGLE_PRIVATE_KEY` rămân acceptate numai când `GOOGLE_CREDENTIALS` lipsește. În producție, secretele Google sunt Cloudflare Worker Secrets; URL-ul și cheia anon Supabase sunt variabile GitHub Actions folosite la build și ajung doar în bundle-ul client ca valori publice. Local, variabilele build se citesc din `.env`, iar secretele runtime din `.dev.vars` (pornește de la `.dev.vars.example`). Credențialele Google nu primesc prefix `VITE_`/`PUBLIC_` și nu ajung în bundle-ul browserului. Integrarea Drive folosește JWT RS256 prin Web Crypto și Google Drive REST multipart, `supportsAllDrives: true`; fișierele primesc nume generate server-side din numele normalizat al elevului și sufixul Audio/MIDI.

**Important:** activează Google Drive API și acordă Service Account-ului drept de creare în folderul unui **Shared Drive** (de exemplu Contributor). Un Service Account nu are cotă proprie de stocare; un folder My Drive doar partajat cu adresa lui nu este suficient. Alternativa necesită OAuth al unui utilizator sau delegare Workspace, neimplementate aici. Nu se creează permisiuni `anyone`: linkul nu acordă acces automat elevului; profesorul și elevul au nevoie de permisiunile Drive potrivite. Înainte de activare aplică `supabase/setup_catalog_teme.sql`, după migrarea rolurilor online; nu a fost aplicată automat pe Supabase live. Stabilește accesul, retenția și informarea privind transferul temelor în Google Drive înainte de utilizarea cu date reale. Ștergerea unui profil elimină rândurile catalogului prin cascade, nu și fișierele externe din Drive; retenția Drive se gestionează separat.

Astro rulează cu `output: 'server'` pe Cloudflare Workers; paginile și API-urile sunt SSR, fără fallback HTML pe `/api/`. `npm run preview` pornește Wrangler local în `workerd`; `npm run deploy` construiește și publică Worker-ul. Middleware-ul păstrează CSP, hash-urile scripturilor inline, permisiunile media și `noindex`. Verificare focalizată: `npm test` pentru testele logice și `npm run test:worker` pentru build + Wrangler dry-run; testele browser folosesc `ACADEMY_TEST_URL` către Worker-ul local. API-ul Drive este simulat în teste, fără scrieri live. La succes, numai după upload și înscrierea în catalog, endpoint-ul returnează 201 JSON cu `success: true`, `id`, `webViewLink` și, pentru perechi audio/MIDI, `midiId`/`midiWebViewLink`. Dacă uploadul reușește dar catalogul sau al doilea fișier eșuează, răspunsul avertizează explicit despre confirmarea parțială, fără succes fals. Endpoint-ul verifică JSON-ul Service Account și parsarea RSA a cheii și returnează 503 explicit pentru o valoare invalidă; nu afișează cheia sau răspunsurile sensibile ale serviciilor externe.

Verificare de catalog: `npm run test:browser -- --drive-catalog` testează trimitere MIDI/audio din portofoliu, metadata, Bearer, eșec/retry, confirmare, linkuri elev/profesor și lipsa cererilor Storage la 1440/390 px. Serviciile sunt simulate; fixture-ul audio testează upload-ul, nu decodarea/redarea. `npm test` rulează și migrarea repetabilă cu PostgreSQL PGlite: RLS, roluri, date generate de server, nume verificat și constrângeri de link.

- REC este roșu și necesită un MP3 valid încărcat. Pornește MediaRecorder și negativul de la secunda zero, cu tempo-ul ales înainte de REC; dezactivează A–B și blochează seek/tempo/schimbarea fișierelor până la STOP. Notele elevului, instrumentul și faderele rămân utilizabile. Sfârșitul MIDI-ului nu taie negativul mai lung.
- MediaStreamAudioDestinationNode folosește același AudioContext ca sintetizatorul. Primește doar master-ul elevului (după fader) și MediaElementAudioSourceNode al MP3-ului; demo-ul și metronomul rămân exclusiv în monitorizare. Sursa MP3 este creată o singură dată și reutilizată între încercări; MP3-ul rămâne audibil și după oprirea capturii. Nu se cere microfon și nu se captează sunetul acustic al orgii USB, ci sinteza declanșată de input-ul MIDI.
- STOP sau sfârșitul MP3-ului finalizează Blob-ul și afișează `<audio controls>` plus „Trimite Tema”. Pauza prin pierderea vizibilității/focusului finalizează de asemenea înregistrarea, nu continuă în fundal. Limite de protecție: 20 minute reale/50 MB. Fișierul nu este convertit în MP3: MediaRecorder negociază WebM/Opus, MP4 sau Ogg, cu extensie și contentType corespunzătoare browserului.
- Blob-ul și preview-ul sunt locale până la trimitere și se pierd la reîncărcare. URL-urile sunt revocate la o nouă încercare, dezactivarea modului sau unmount; la unmount se oprește recorderul, stream-ul și se eliberează nodurile. Erorile de codec/redare/captură și upload rămân vizibile, cu retry pentru trimitere.

Testul browser construiește în memorie o instanță React cu modul Temă, fără a publica o rută nouă. Verifică MediaRecorder real, REC ascuns în modul normal, MP3 de la zero, STOP manual/la final, MIDI mai scurt decât MP3, preview redabil, retry upload simulat, încercări repetate și cleanup. Cu negativ silențios, decodează fișierul înregistrat și verifică RMS sub 0,00001 deși demo-ul și metronomul sunt audibile în monitorizare. Capturi: `.astro/screenshots/homework-recording-1440.png` și `homework-recording-390.png`. Testul necesită ffmpeg pentru fixture-urile MP3 și raportează SKIP dacă lipsește; nu scrie în Supabase live și nu demonstrează compatibilitate Safari/iOS sau latență pe hardware real.

## Editor de Partituri

**Decizie Flat.io:** documentația oficială [Editor Mode](https://flat.io/developers/docs/embed/javascript-editor) precizează că aplicațiile gratuite pot afișa partituri, dar nu le pot edita; `mode: 'edit'` revine la `view` fără eroare. API-ul `getMIDI()` există și returnează `Uint8Array`, însă editorul integrat necesită un plan Embed care include editarea și un `appId` propriu. Cerința „editor integrat gratuit” nu poate fi satisfăcută cu acel plan. Până la aprobarea unui plan compatibil sau alegerea unei alternative gratuite, VexFlow/midi-writer-js rămân instalate și editorul existent rămâne funcțional; `flat-embed` nu este introdus doar pentru a livra un editor read-only.

`src/components/ScoreEditor.jsx` este disponibil în `/studio/`, cu hidratare `client:visible`. Folosește VexFlow 5 (SVG, intrarea core) și midi-writer-js. Fonturile oficiale Bravura/Academico sunt livrate local din pachetele npm; nu necesită CDN sau relaxarea CSP. Restul interfeței folosește Tailwind și iconițele Lucide existente.

- Compoziția este un array `{ pitch: 'C4', duration: 'q' }`; pauzele au `pitch: null`. Duratele acceptate sunt h/doime, q/pătrime și 8/optime. Registru natural Do4–Do6, o singură voce, maximum 128 de elemente, notație liberă fără împărțire automată în măsuri. Nu există acorduri, alterații, import sau autosave în această versiune.
- Click pe liniile/spațiile portativului adaugă nota după coordonatele reale VexFlow. Butoanele Do4–Do6 oferă alternativă tactilă și acces prin tastatură. Swipe-ul și mișcările peste 8 px nu introduc note. Portativul este centrat pe alb; compozițiile lungi se derulează local, fără overflow al paginii.
- Toolbar: durate, Pauză, Undo, Clear All, Pian/Acordeon, Play/Oprește Compoziția și Exportă MIDI. Adăugarea unei note declanșează un sunet scurt; pauzele sunt silențioase. Redarea programează atacurile și duratele pe AudioContext.currentTime la 120 BPM prin createVoice/ADSR existent, fără fișiere audio externe. STOP, pierderea focusului/vizibilității și unmount anulează sunetele; editarea este blocată în timpul audiției.
- Exportul produce `compozitia-mea.mid` prin Blob/URL temporar și link ascuns, cu program General MIDI pian/acordeon și tempo 120. Pauzele inițiale/intermediare sunt wait-uri; pauza finală este păstrată la EndTrack. Fișierul poate fi încărcat în studioul MIDI existent. Compoziția rămâne în memoria browserului până la export; nu este trimisă în Supabase și se pierde la reîncărcare.

Verificări: `npm test`, `npm run build`; browser focalizat `npm run test:browser -- --score-editor`, cu `ACADEMY_TEST_URL` setat la preview (curent `http://127.0.0.1:4196`). Testul recitește MIDI-ul descărcat, verifică note/pauze/durate, click/tap, fonturi/SVG, Undo/Clear, programare ADSR, oprire/finalizare și overflow la 1440/390 px. Capturi `.astro/screenshots/score-editor-1440.png` și `score-editor-390.png`. Filtrul nu schimbă suita implicită completă; aceasta poate fi oprită de problema intermitentă REC deja consemnată. Compatibilitatea audio pe Safari/iOS și importul în editoare MIDI externe nu au fost validate.

## Cursuri Online, Roluri și Instrumente

- Biblioteca publicată, playlist-urile, RED, exercițiile și claviatura sunt comune tuturor elevilor. Grupele din `/cursuri-online/` izolează numai conferințele video. Temele personale și portofoliile rămân private, nu sunt filtrate prin grupa video.
- Profesorul creează/editează/șterge grupe, stabilește ziua, ora și durata și selectează elevii. Orarul este săptămânal, în fusul `Europe/Bucharest`; schimbarea orei de vară urmează fusul local. Un elev poate aparține unei singure grupe video; pentru mutare se elimină întâi din grupa veche.
- Rolurile sunt `profesor`, `elev`, `inspector`; aliasurile existente `teacher/student` rămân compatibile. Profesorul atribuie rolul inspector din fișa contului existent. Inspectorul vede toate grupele, fără formulare administrative sau salvări de teme; RLS refuză și scrierile directe în tabele/Storage. Telemetria de sesiune existentă continuă să funcționeze. Nu există invizibilitate: inspectorul apare ca participant, dar fără cameră/microfon.
- Claviatura C3–C6 are 37 de clape și scroll orizontal pe mobil. Clapele albe C3–B3: `Z X C V B N M`; C4–C5: `A S D F G H J K`. Diezii inferiori: `1 2 3 4 5`; cei superiori: `W E T Y U`. Tastatura funcționează când claviatura are focus. Pianul, acordeonul, naiul și tick-urile metronomului sunt exclusiv oscilatoare Web Audio, fără sample-uri. Metronom: 40–240 BPM, măsură 4/4, lookahead 120 ms cu scheduler la 25 ms; performanța poate fi afectată de suspendarea browserului/dispozitivului.

### Activare Supabase

După schema de bază, rulează în ordine `supabase/setup_quizzes.sql`, `supabase/setup_student_homework.sql` (inclusiv actualizarea intervalului MIDI 48–84), `supabase/setup_online_classes.sql`, apoi `supabase/setup_catalog_teme.sql`. Nu rerula schema de bază după aceste migrări: ar restaura politicile vechi. Migrarea nu mută datele din grupele vechi în grupele video și nu migrează fișierele istorice din Storage.

Publică funcția `class-access` și versiunile actualizate `create-student` și `delete-student`. Configurează în secretele Edge Functions `JITSI_DOMAIN` (hostname, fără schemă), `JITSI_APP_ID`, `JITSI_APP_SECRET` (minimum 32 caractere) și, numai după verificările de mai jos, `JITSI_SECURE_LOBBY_READY=true`. Nu pune secretul JWT în `VITE_*`, în repo sau în browser. Funcția folosește JWT-ul Supabase și RLS, fără service-role, și emite un token Jitsi valabil 5 minute pentru o singură sală `academy-<uuid>`; reconectarea după expirare necesită reîncărcarea sălii.

### Instanța Jitsi Obligatorie

`meet.jit.si` public nu este acceptat: nu poate garanta rolurile și lobby-ul cerute. Este necesar un deployment Jitsi administrat, HTTPS, cu autentificare JWT HS256 și aceeași pereche app ID/secret ca funcția. Configurează `allow_empty_token = false`, `token_verification` și dezactivează `allowners`/auto-owner în Jicofo. Nu permite acces anonim sau moduri alternative de autentificare care ocolesc JWT.

Instalează modulul inclus `supabase/jitsi/mod_academy_roles.lua` în directorul pluginurilor Prosody și activează `academy_roles` pe componenta MUC principală, după verificarea JWT. În aceeași componentă setează `academy_service_domain = "auth.DOMENIUL-JITSI"` la domeniul intern real al contului Jicofo `focus`; numai acest cont intern este exceptat de la JWT. El acordă owner/moderator participanților numai pe baza claim-ului semnat; ceilalți nu pot deveni automat owner. Nu îl combina cu module care acordă ulterior owner tuturor utilizatorilor.

Activează `muc_lobby_rooms` și `persistent_lobby` pe VirtualHost, plus modulele [lobby_autostart](https://github.com/jitsi-contrib/prosody-plugins/tree/main/lobby_autostart) și [token_lobby_bypass](https://github.com/jitsi-contrib/prosody-plugins/tree/main/token_lobby_bypass) pe componenta MUC. Numai profesorul primește claim-ul semnat `lobby_bypass=true`; elevii și inspectorii necesită aprobare. Lobby-ul trebuie să fie activ de la crearea sălii, nu doar după comanda din React. Verifică ordinea hook-urilor pentru versiunea Prosody instalată și accesul conturilor interne Jicofo/Jibri înainte de producție; modulul inclus este pentru participanții Academy și refuză intrările fără context JWT.

Setează și `JITSI_DOMAIN` ca secret/variabilă a Worker-ului pentru CSP și delegarea permisiunilor iframe. Inspectorul pornește cu `startWithAudioMuted/startWithVideoMuted`, fără GUM inițial, fără comenzi media și cu `camera/microphone/display-capture 'none'` pe iframe. Audio de studiu: `disableAEC`, `disableNS`, `disableAGC`, `disableAP` și constraints fără echo cancellation/noise suppression. Folosește căști: anularea ecoului este intenționat oprită.

Înainte de `JITSI_SECURE_LOBBY_READY=true`, testează cu conturi reale: elev înaintea profesorului rămâne în lobby; profesorul este moderator automat; aprobare/refuz manual; elevul altei grupe primește 403 inclusiv prin apel direct; tokenul nu funcționează în altă sală; inspectorul nu solicită dispozitive și nu poate activa transmisia. Aceste verificări depind de serverul extern și nu sunt demonstrate de testele locale cu Jitsi simulat. Configurează acordurile de procesare a datelor și informarea participanților pentru serviciul video ales.

---

## 1. Structura proiectului

```
academy-music.florentinapanaofficial.ro/
├── index.html
├── wrangler.jsonc             # entrypoint și assets Cloudflare Workers
├── src/middleware.js          # CSP și headere pentru răspunsurile SSR/API
├── .github/workflows/         # deploy automat la push pe main
├── supabase/schema.sql        # tabele, funcții, RLS, buckete
├── supabase/migrations/       # migrări SQL incrementale
└── supabase/functions/       # funcții server-side pentru administrare conturi
├── public/favicon.svg
└── src/
    ├── main.jsx               # punct de intrare SPA React, încărcat din Astro
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
supabase functions deploy delete-student
```

Funcțiile verifică tokenul și rolul profesorului activ. `create-student` creează elevul cu Auth Admin API; `delete-student` șterge definitiv numai conturi cu rol de elev și curăță fișierele din bucket-urile private `avatars` și `portfolio`. Ștergerea contului elimină în cascadă profilul, repertoriul individual, temele, sesiunile și activitatea asociată. În fișa elevului, ștergerea cere introducerea username-ului și nu poate fi anulată.

Cheia `SUPABASE_SERVICE_ROLE_KEY` este folosită numai pe server (Supabase Edge Functions și bridge-ul local de încredere) și nu trebuie pusă în `.env`-ul Vite ori într-o variabilă `VITE_*`.

3. În aplicație, deschide **Panou profesor → Elevi → Adaugă elev**. Formularul cere numai prenume, nume, username și parolă (12–128 caractere); parola poate fi și generată din buton. Numele real este salvat în `user_metadata.full_name` și profil. După creare, transmite elevului datele afișate: parola apare o singură dată și nu este salvată în profil.
4. Elevul se autentifică folosind username-ul și parola. Profesorii existenți se pot autentifica în continuare cu email și parola lor.

Conturile noi folosesc intern `[username]@student.academy.local`, fără email real sau mesaj de confirmare. Publică versiunea actualizată `create-student` împreună cu frontendul. Pentru conturile istorice `@students.academy.invalid`, loginul încearcă sufixul vechi numai după `invalid_credentials` la username; emailurile explicite ale profesorilor și erorile de rețea/rate-limit nu declanșează fallback. Resetarea prin email nu este disponibilă pentru elevi; profesorul transmite parola pe un canal sigur.

Tabelul include doar rolurile `student`/`elev`, încarcă profilurile în loturi și permite căutarea după nume/username. Filtrul implicit afișează conturile active; sunt disponibile și Inactive/Toate. Dezactivarea și reactivarea direct din tabel cer confirmare și verifică valoarea `profiles.is_active` returnată de baza de date. Aceste operații păstrează repertoriul și temele, se bazează pe RLS/triggerul existent și nu reprezintă ștergere Auth sau revocare globală a sesiunilor deja emise. Ștergerea definitivă existentă rămâne în fișa elevului.

Verificare focalizată: `npm run test:browser -- --students`, cu `ACADEMY_TEST_URL` spre preview. Testează desktop/mobil, creare fără email, editarea username-ului, căutare, confirmare/anulare, refuz/retry, dezactivare/reactivare și eroare de listare. Supabase este simulat, fără modificări ale conturilor reale. `npm test` verifică și funcția Edge transpilată, metadata, autorizarea, rollback-ul și compatibilitatea loginului.

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
npm ci
npm run dev      # Astro dev pe workerd, http://localhost:5180
npm run build    # Worker SSR și active în dist/
npm run preview  # Wrangler local, același runtime ca producția
```

---

## 4. Cum sunt protejate materialele

| Mecanism | Unde | Ce face |
|---|---|---|
| Buckete private | `supabase/schema.sql` | Protejează PDF-uri, avataruri și portofolii, nu audio public R2. |
| URL-uri semnate | `src/lib/media.js` | Rămân pentru materialele private; playerul audio nu mai apelează acest modul. |
| Player propriu | `SecureAudioPlayer.jsx` | URL HTTP(S) direct, `nodownload` și blocarea meniului contextual: doar descurajare vizuală, nu DRM. |
| Partituri pe canvas | `SecurePdfViewer.jsx` | PDF-ul se randează ca imagine; viewerul nativ cu buton de Download nu apare deloc. |
| Clic dreapta / drag / print | `index.css` + componente | Meniu contextual blocat, selecție dezactivată, `Ctrl+S` și `Ctrl+P` interceptate, print golit. |
| Filigran | `SecurePdfViewer.jsx` | Numele elevului apare peste partitură — descurajează capturile distribuite. |
| RLS | Postgres | Elevul citește doar ce îi aparține; doar profesorul scrie în `pieces` și `resources`. |
| CSP | `src/middleware.js` | `frame-ancestors 'none'`, fără `unsafe-eval`, hash-uri pentru scripturile inline Astro și origine media explicită. |

> Audio R2 public poate fi descărcat și distribuit prin URL, inclusiv din DevTools. `nodownload` nu împiedică accesul direct și nu este suportat identic de toate browserele. Nu publica în R2 înregistrări ale minorilor sau materiale fără drept de distribuire.

---

## 5. Fluxul de lucru

**Profesor**
1. Creează contul elevului din `Elevi → Creează cont` și transmite username-ul și parola generată.
2. `Piese` → completează URL-urile CDN pentru negativ/pozitiv și încarcă separat partitura PDF. Audio nu se mai încarcă în Supabase din acest formular.
3. `RED` → adaugă fișe teoretice și exerciții.
4. `Teme` → ascultă/vizionează înregistrările, pune nota și observațiile.
5. `Activitate` → vezi sesiunile recente și deschide `Conectați acum` pentru lista live a elevilor/profesorilor activi.

**Elev**
1. Se autentifică cu username-ul și parola primite de la profesor.
2. Intră la `Orgă` sau `Canto`, filtrează după nivel, ascultă negativul și deschide partitura.
3. Rezolvă quizul și rebusul din `Jocuri`.
4. Încarcă tema în `Portofoliu` și primește feedback.

---

## 6. Deploy pe Cloudflare Workers

1. Creează un Worker conectat la repository-ul Academy sau lasă GitHub Actions să-l creeze la primul deploy. Workflow-ul `.github/workflows/deploy-workers.yml` publică automat fiecare push pe `main` și poate fi pornit manual.
2. În GitHub → Settings → Secrets and variables → Actions, configurează secrets `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit) și `CLOUDFLARE_ACCOUNT_ID`; configurează repository variables `VITE_SUPABASE_URL` și `VITE_SUPABASE_ANON_KEY` pentru build.
3. În Cloudflare Worker → Settings → Variables and Secrets, adaugă `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GOOGLE_CREDENTIALS` și `GOOGLE_DRIVE_FOLDER_ID` ca **secrets**. Configurează `SUPABASE_HOST`, `MEDIA_ORIGIN`, `JITSI_DOMAIN`, `ACADEMY_TRUSTED_IP_HEADER` și `ACADEMY_TRUSTED_PROXY_HOPS` ca variables unde sunt necesare. Nu pune secrete în `wrangler.jsonc` sau GitHub variables.
4. `wrangler.jsonc` configurează SSR entrypoint-ul Astro, assets și custom domain `academy-music.florentinapanaofficial.ro`. Activează domeniul în zona Cloudflare înainte de deploy și verifică DNS-ul să nu mai trimită trafic la Railway. Nu este activat `nodejs_compat`; logica runtime folosește Workers/Web APIs.
5. După deploy verifică `/` → 200; GET `/api/upload-homework/` → 405 JSON; POST neautentificat → 401 JSON; API inexistent → 404 JSON. În Supabase → **Authentication → URL Configuration**, adaugă domeniul Academy la Redirect URLs.

---

## 7. Limite de încărcare

| Tip | Limită aplicație |
|---|---|
| Video (portofoliu) | 200 MB |
| Audio | 50 MB |
| Imagine | 10 MB |

Limita globală a fișierelor se configurează și în Supabase: **Storage → Settings → Upload file size limit** (implicit 50 MB pe planul gratuit).

## 8. Activarea modulelor noi

După schema de bază, rulează în SQL Editor, în această ordine:

1. `supabase/setup_quizzes.sql`: quiz-uri, întrebări și extinderea compatibilă a tabelului existent `quiz_results`. Rezultatele vechi sunt păstrate. Pentru testele noi, triggerul calculează scorul din răspunsuri; `correct_option` nu poate fi citit de client. Profesorul configurează întrebările și răspunsurile corecte în SQL Editor. Nu rerula schema de bază după aceste scripturi fără să le reaplici, deoarece schema de bază redefinește unele politici.
2. `supabase/setup_student_homework.sql`: teme cu jurnal JSON, RLS, validare pe server, maximum 2000 de note și cinci minute. Nu creează bucket sau fișier audio.

Nu s-au aplicat automat migrări pe proiectul live. Testele SQL folosesc PostgreSQL local izolat (PGlite), cu roluri și sesiuni simulate.

### Audio R2 / CDN

- Încarcă audio în bucketul R2 și activează un custom domain, de exemplu `https://media.florentinapanaofficial.ro`.
- Setează `Content-Type` audio corect, suport pentru range requests și CORS `GET`/`HEAD` pentru originile Academy. Folosește `Cache-Control: public, max-age=31536000, immutable` numai pentru chei versionate; schimbă cheia când înlocuiești fișierul.
- Actualizează `pieces.positive_url` și `pieces.negative_url` cu URL-uri absolute. Câmpurile vechi `audio_*_path` nu mai sunt redate și nu au fost migrate/șterse automat. Piesele care au doar căi vechi rămân fără audio până la completarea URL-urilor.
- `MEDIA_ORIGIN` se setează ca Worker variable dacă domeniul diferă de cel implicit; CSP acceptă numai originea configurată. După schimbarea variabilelor, redeploy Worker-ul.
- Nu există garanție de cost zero: R2 are cote și costuri pentru stocare/operații peste plan; jurnalul JSON consumă spațiu Postgres. Pianul folosește **0 bytes de fișiere audio**, nu zero spațiu de baze de date. Portofoliile și materialele private existente nu au fost migrate.

### Mini-cursuri MDX

Colecția se definește în `src/content/config.ts`, reexportată din `src/content.config.ts` pentru Astro actual. Articolele sunt în `src/content/revista/`, cu `titlu`, `descriere`, `data_publicarii`, `imagine_cover`. Imaginea este o cale locală din `public/`; folosește WebP optimizat, nu originale brute.

```mdx
import SecureAudioPlayer from '../../components/SecureAudioPlayer.jsx';
import StudentQuizPlayer from '../../components/StudentQuizPlayer.jsx';
import KaraokePlayer from '../../components/KaraokePlayer.jsx';

<SecureAudioPlayer audioUrl="https://media.florentinapanaofficial.ro/lectii/exemplu-v1.mp3" label="Exemplu" client:visible />
<StudentQuizPlayer quizId="note-muzicale-intro" client:visible />
<KaraokePlayer mediaUrl="https://media.florentinapanaofficial.ro/lectii/exemplu-v1.mp3" lyrics={'[00:12.50] Vers original'} client:visible />
```

URL-urile audio din acest fragment sunt exemple și trebuie înlocuite cu obiecte reale. MDX poate importa componente direct; folosește `client:visible` pentru hidratare la apropierea de viewport și `client:load` doar când interacțiunea trebuie disponibilă imediat. Articolul demonstrativ și `/studio/` sunt prerandate; `prose-invert` formatează articolul, nu controalele interactive.

**Acces:** revista și studioul sunt HTML static accesibil fără login, cu `noindex,nofollow`, care nu este protecție de acces. Nu pune date private sau lecții confidențiale în frontmatter, MDX ori props. Quiz-urile și trimiterea temelor necesită autentificare și trec prin RLS. Pentru restricționarea HTML-ului static este necesară o poartă de acces înainte de CDN/server; nu este inclusă în această implementare.

Cele patru carduri Google Workspace din `src/pages/admin/AdminDashboard.jsx` folosesc folderele Drive furnizate de Claudiu: Catalog și Prezențe, Planificări și Programe, Lista Concursuri și Documente Administrative. Linkurile se deschid într-un tab nou, cu `rel="noopener noreferrer"`. Componenta este conectată la sumarul existent `AdminOverview`; accesul efectiv la foldere depinde de permisiunile configurate în Google Drive.

### Build și verificări

`npm run build` generează serverul SSR și activele client, plus variante `.br`/`.gz`. Adaptorul standalone livrează activele `/_astro/` cu cache immutable, iar middleware-ul setează `no-cache` pentru HTML. Rutele private rămân React + Supabase, fără randarea datelor elevilor pe server. Astro avertizează despre fișierele JSX existente în `src/pages/`; acestea sunt importate de SPA, nu tratate drept pagini Astro.

```bash
npm test                   # logică, Web Crypto, Drive REST simulat, migrări SQL/RLS
npm run test:worker        # build SSR + Wrangler deploy dry-run
npm run preview            # Worker local pe workerd
npm run test:browser       # setează ACADEMY_TEST_URL către preview-ul local
```

Testul de browser cere un build configurat cu variabilele publice Supabase existente și interceptează toate cererile către acel proiect: nu scrie în baza live. Include verificări la 1440px/390px și capturi în `.astro/screenshots/`. Chromium se instalează cu `npx playwright install chromium`. Fișierele media CDN și fonturile pot fi cerute public în timpul testelor.

## Securitate: sesiune unică, IP-uri și acord parental

Implementare: `src/middleware.js`, `src/lib/securityServer.js`, `src/pages/api/auth/` și migrarea
`supabase/migrations/20261020000005_security_sessions.sql`.

### Configurare și activare fără întreruperea conturilor existente

1. Aplică toate migrările în ordine, după schema și modulele de bază. Migrarea de securitate este idempotentă.
2. Configurează **doar în mediul serverului** `SUPABASE_SERVICE_ROLE_KEY`; nu folosi prefixul `VITE_` și nu publica cheia.
3. Workers furnizează IP-ul clientului prin `cfContext`; nu seta trusted-proxy headers manual în Cloudflare. În dezvoltare, `Astro.clientAddress` este folosit numai în afara producției. Domeniul canonical este permis în configurația Astro.
4. Publică aplicația Astro și funcțiile Edge actualizate `create-student` și `delete-student`. Fluxul profesorului marchează conturile provisionate exclusiv în `app_metadata`; nu pretinde că profesorul este părintele și nu inventează consimțământ.
5. Testează loginul cu un cont de test și două sesiuni independente, apoi activează global din SQL Editor:

   ```sql
   update public.academy_security_config set enforce_sessions = true where id;
   ```

Înainte de pasul 5, conturile vechi fără `active_session_id` rămân funcționale, iar crearea conturilor prin vechiul flux nu este întreruptă. Imediat ce un cont folosește noul login, sesiunea sa devine obligatorie în RLS chiar și în etapa de tranziție. După activarea globală, toate conturile trebuie să treacă prin noul login; noile înscrieri Auth directe fără acord parental sunt refuzate și în baza de date. Nu raporta securitatea ca activată global cât timp flagul este `false`.

### Comportament

- `POST /api/auth/login/` verifică parola prin Supabase Auth, înregistrează atomic sesiunea și IP-ul, apoi setează un cookie HttpOnly, SameSite=Lax, Secure pe HTTPS. Tokenurile pentru client se trimit numai într-un răspuns `private, no-store`.
- `POST /api/auth/session/` validează, dar **nu** înlocuiește sesiunea activă; refresh-ul de token păstrează `session_id`. Browserul verifică la fiecare 30 de secunde și la revenirea în fereastră. Cererile la API/DB sunt refuzate imediat după revocare; o pagină deja deschisă afișează deconectarea la următoarea verificare.
- `DELETE /api/auth/session/` șterge cookie-ul; cu Bearer token revocă și sesiunea din profil, numai dacă încă este cea activă. Ieșirea dintr-o sesiune veche nu o revocă pe cea nouă.
- Middleware-ul verifică tokenul cu Auth înainte de a folosi `session_id`; nu stochează tokenuri sau parole în istoricul IP. RLS restrictiv se intersectează cu permisiunile existente, inclusiv Storage; nu acordă acces suplimentar la materiale. În schema actuală nu există `lessons`: migrarea protejează tabelele reale și adaugă protecții pentru `lessons` numai dacă există deja.
- Al treilea IP distinct blochează persistent contul și inserează o alertă în `security_alerts`, vizibilă profesorului activ prin RLS / administratorului din Supabase. Nu există notificare email configurată în această etapă.
- `POST /api/auth/register/` cere booleanul `parentalConsent=true` înainte de `auth.signUp`. Înregistrarea este disponibilă și la `/register/`; acordul nu este preselectat. Textul, versiunea și data acceptării sunt înregistrate server-side în `parental_consents`. Acest checkbox consemnează o declarație, nu verifică identitatea sau calitatea de tutore.
- Origin-ul trebuie să coincidă cu origin-ul cererii la endpointurile de autentificare. Pentru API, erorile sunt JSON; pentru pagini, sesiunea revocată/blocată conduce la `/login/?reason=...`. Indisponibilitatea Auth/DB produce 503, nu acces permis.

### Administrarea blocărilor

Consultă `security_alerts` și `user_security_logs` în Supabase cu un administrator autorizat. Pentru deblocare, verifică situația cu părintele; execută într-o tranzacție, cu UUID-ul real în loc de `USER_UUID`:

```sql
begin;
select id from public.profiles where id = 'USER_UUID'::uuid for update;
delete from public.user_security_logs where user_id = 'USER_UUID'::uuid;
update public.profiles set is_locked = false, active_session_id = 'signed-out' where id = 'USER_UUID'::uuid;
commit;
```

Nu șterge alertele la deblocare. Resetarea istoricului IP este explicită, nu automată. Cerința actuală numără IP-uri pe întreg istoricul păstrat: Wi-Fi/date mobile/VPN pot bloca un elev legitim. Înainte de utilizarea cu minori, stabilește în informarea GDPR temeiul, retenția și procedura de ștergere pentru aceste date. Nu reprezintă o certificare de conformitate juridică.

### Limite și verificări

- Această etapă nu implementează pragul personalizat de 5 parole greșite / 15 minute; rămân protecțiile native Supabase Auth. Nu confunda blocarea IP cu anti-brute-force.
- URL-urile audio deja emise nu pot fi retrase prin RLS; rămân utilizabile până la expirare. Audio CDN public și streamingul anti-download necesită etapa media dedicată.
- RLS validează sesiunea inclusiv pentru cereri directe Supabase; istoricul IP se actualizează la cererile Astro, nu pentru traficul direct care ocolește Astro.
- Reaplicarea vechilor scripturi `setup_*.sql` poate redefini helperii de acces; migrarea de securitate trebuie să fie ultima. Tabelele noi trebuie să primească și politica restrictivă `academy_valid_session`.
- `npm test` include teste PostgreSQL/PGlite pentru RLS, înlocuirea sesiunii, al treilea IP, acord parental și privilegii. `npm run build` validează integrarea Astro/React.

## Administrare: editare și previzualizare Profesor / Elev

- `/admin/piese/` (Instrument-Orgă), `/admin/canto/` și `/admin/resurse/` (RED) oferă butoane **Editează** lângă Șterge, cu formulare precompletate. Salvarea folosește UPDATE pe ID în `pieces` / `resources`, nu ștergere și recreare. Piesele rămân în disciplina lor; alocările și autorul inițial nu sunt resetate la editare.
- Poți completa sau înlocui pozitivul/negativul MP3 (maximum 30 MB fiecare), versurile/LRC și partitura PDF (maximum 20 MB). Validările verifică extensia, MIME și semnătura fișierului. Uploadurile sunt private în `academy-media`, cu căi unice; un fișier nou actualizează numai sursa corespunzătoare. Fără selecție nouă se păstrează fișierul existent. Uploadul audio înlocuiește URL-ul extern al aceleiași variante.
- Eșecurile la upload/salvare sunt afișate, iar uploadurile noi finalizate înainte de eroare sunt eliminate. Eșecul curățării este raportat explicit. Fișierele istorice înlocuite sau rămase după ștergerea unui rând **nu sunt șterse automat**: pot avea alte referințe. Curățarea administrativă trebuie să verifice referințele și retenția înainte de eliminare.
- PDF-ul Canto se deschide într-un vizualizator încărcat la cerere; audio din Storage funcționează și la Instrument, prin playerul comun `PieceAudio`. URL-urile semnate expiră, dar interfața nu reprezintă DRM și nu poate împiedica absolut copierea/înregistrarea.
- Primul element al panoului este **Vizualizare: Profesor / Elev**. Starea este comună cu sidebar-ul, implicit Profesor, actualizată fără reload și păstrată între navigările SPA. Un reload revine la Profesor. Elevul real nu primește acest comutator.
- În previzualizare se folosesc componentele reale Canto/Instrument/RED, fără unelte administrative; piesele nepublicate sunt excluse. Rolul Supabase, token-ul și RLS rămân neschimbate. **Nu este impersonarea unui elev anume**: alocările/permisiunile sale individuale nu sunt simulate. Revino la Profesor din oricare comutator.
- Pentru UPDATE și preview nu este necesară o migrare nouă: coloanele pentru fișiere/versuri și politicile profesor există deja. Nu activa sau modifica politicile de securitate pentru a folosi previzualizarea.
- Validare: `npm test`, `npm run test:admin`, `npm run test:navigation`, `npm run test:landing`, `npm run test:server` și `npm run build`. Testele browser folosesc output-ul Astro construit și un backend Supabase simulat; RLS/UPDATE sunt testate separat în PostgreSQL/PGlite. Nu modifică înregistrări de producție.

## Modulul 4 — Studio Canto: karaoke, microfon și AI

### Karaoke și redare

Pe `/canto/`, fiecare piesă are carduri Pozitiv/Negativ cu redare, pauză, progres și volum (inclusiv pe mobil). O singură sursă audio se aude la un moment dat. **Play pe negativ deschide automat versurile Karaoke**; le poți deschide și manual. Controalele Play/Pauză și Stop sunt disponibile atât în player, cât și lângă versuri și comandă aceeași sursă audio. Pauza păstrează poziția, iar Stop oprește audio și readuce sincronizarea la zero, fără a închide versurile. Redarea unei variante o selectează automat ca sursă de sincronizare. Versurile urmăresc `audio.currentTime` și salturile înainte/înapoi, cu scroll numai în panoul versurilor și respectarea reduced motion.

Parserul existent `src/lib/lrc.js` suportă în continuare LRC simplu, offset și refrene repetate; adaugă acum Enhanced LRC. Nu estimează cuvinte din timpi de linie:

```text
[00:01.00]Linie evidențiată de la o secundă
[00:05.00]<00:05.00>Text <00:05.50><00:06.00>original<00:06.80>
```

Timestamp-urile `<...>` delimitează cuvintele; un tag fără text poate marca finalul cuvântului/pauza. Textul fără timestamp rămâne lizibil, nesincronizat. Versurile trebuie verificate manual: pozitivul și negativul pot avea introduceri diferite. `KaraokePlayer` reutilizează aceleași controale/parser și păstrează interfața `mediaUrl`/`lyrics` pentru lecțiile MDX.

### Microfon și reverb numai la REC pentru temă

**Ascultarea pozitivului/negativului, karaoke, Play/Pauză/Stop nu cer microfonul și nu afișează regula căștilor.** Elevul poate studia folosind numai materialul salvat de profesor, fără permisiuni audio de captare și fără apeluri AI.

Butonul **REC · Înregistrează tema** al piesei deschide studioul existent de teme (încărcat la cerere). Alegerea audio/video nu activează dispozitivele. **REC · Pregătește tema** afișează regula de studio; numai **Sunt gata, am conectat căștile!** poate solicita microfonul/camera și porni înregistrarea. Aplicația nu poate detecta fizic căștile: folosește căști cu microfon și volum redus, nu difuzoare.

Vocea trece prin ramuri gain dry și ConvolverNode (impuls stereo Room de 1,8 s) → gain wet, apoi gain de ieșire redus și compresor/limiter. Semnalul procesat este monitorizat numai în căști. MediaRecorder captează o ramură separată direct din sursa microfonului, înainte de gain/reverb/limiter; negativul este conectat exclusiv la ieșirea pentru căști și nu este inclus în fișier. Captura audio din RecordingStudio este dry inclusiv pentru temele standard și modul video (camera rămâne inclusă la video). În timpul REC apar versurile ajutătoare sincronizate cu timpul real al negativului, folosind același parser/highlight/auto-scroll; sunt doar vizuale, nu se transformă în voce și nu se includ ca text în fișierul audio. Sliderul Dry/Wet ajustează numai audiția în căști în timpul REC, nu fișierul capturat. Vocea nu este trimisă către AI. Nu se promite latență zero; aceasta depinde de dispozitiv/browser/căști (Bluetooth poate avea întârziere mare).

Stop sau trecerea în fundal oprește REC, eliberează imediat microfonul/contextul și păstrează fișierul pentru revizuire. **Trimite tema** este o acțiune separată, explicită; audio folosește endpointul existent de teme/Drive, iar video fluxul existent de portofoliu. Înregistrarea nu se trimite automat. O nouă încercare cere din nou confirmarea căștilor. Oprire automată la 10 minute; înregistrările goale sunt respinse cu mesaj.

Închiderea studioului/paginii sau schimbarea rutei eliberează dispozitivele, inclusiv dacă permisiunea era încă în așteptare. Erorile de permisiune, dispozitiv, înregistrare sau negativ sunt explicite. Negativul privat este rezolvat și din Storage; pentru includerea unei surse externe în mix este necesar CORS. Dacă sursa nu poate fi mixată, nu se recomandă difuzorul: verifică sursa sau înregistrează fără negativ. Necesită HTTPS/localhost și un browser modern cu Web Audio/getUserMedia/MediaRecorder/AbortSignal.

### Generarea AI în Admin

Butonul **✨ Generează Versuri Automat (AI)** există lângă textul LRC în `/admin/piese/`, în formularul `/admin/canto/` și în modalul de versuri Canto. Este disponibil numai pentru un pozitiv MP3 **deja salvat și activ în Storage, fără URL extern prioritar**. Salvează întâi un upload nou; URL-urile externe nu sunt urmărite de funcție. În timpul generării, salvarea și editarea formularului sunt blocate.

Profesorul confirmă explicit drepturile și prelucrarea înainte de trimitere. **Numai acel pozitiv salvat** este trimis către API-ul OpenAI Whisper (`whisper-1`, `verbose_json`, timpi de cuvânt/segment, limba română); microfonul live nu este sursă pentru AI. Nu trimite materiale fără drepturi sau înregistrări personale/ale minorilor fără autorizările și informările necesare. Verifică termenii, retenția și transferurile furnizorului înainte de utilizare.

`generate-lyrics` validează JWT prin `getUser`, sesiunea prin `academy_session_allowed`, rolul teacher/profesor activ și neblocat, apoi verifică ID-ul piesei și potrivirea exactă a căii cu pozitivul din DB. Bucketul și endpointul furnizorului sunt fixe; nu acceptă URL-uri arbitrare. Verifică dimensiunea și antetul MP3. CORS permite numai originea Academy și localhost/127.0.0.1:5180. Cheia furnizorului și service role rămân exclusiv în Edge Function.

- MP3 pentru AI: maximum **24 MB** (uploadul normal rămâne maximum 30 MB).
- O cerere la **două minute per profesor**, rezervată atomic în DB, inclusiv dacă furnizorul eșuează. Configurează suplimentar limite de buget/cotă în contul furnizorului.
- Răspunsul este LRC extins pe cuvânt când există timestamp-uri de cuvânt; altfel LRC pe linie din segmente. AI poate greși versurile și timpii din muzică.
- După revizuire și salvare, versurile rămân persistent în `pieces.versuri_text`. Elevul citește acest text din DB și **nu face niciun apel AI la deschiderea piesei, Play, Pauză, Stop sau reload**. Generarea se repetă numai la solicitarea explicită a profesorului.
- Răspunsul completează **numai formularul**; revizuiește și apasă manual Salvează. Nu se scrie automat în piesă și nu se păstrează audio/transcriere în tabelul de cooldown. La eroare rămâne textul anterior.
- Cererile au timeout și erori explicite pentru configurare lipsă, cotă, sesiune, fișier și furnizor. Părăsirea editorului anulează cererea browserului; o cerere deja ajunsă la furnizor poate totuși fi facturată.

### Activarea Edge Function (separată de frontend)

Această implementare nu publică automat funcția, nu setează chei și nu transmite înregistrări reale.

1. Aplică `supabase/migrations/20261020000006_generate_lyrics.sql` după migrarea de securitate `20261020000005`. Creează numai tabelul/RPC service-only pentru cooldown; nu schimbă piesele sau politicile existente. Dacă folosești SQL Editor, înregistrează și versiunea în istoricul migrărilor conform fluxului proiectului.
2. În Supabase Dashboard → Edge Functions → Secrets, configurează **OPENAI_API_KEY**, folosind un proiect cu buget controlat. Nu pune cheia în frontend, Cloudflare `VITE_*`, Git sau mesaje. `SUPABASE_URL`, `SUPABASE_ANON_KEY` și `SUPABASE_SERVICE_ROLE_KEY` sunt variabilele server ale funcției.
3. Din directorul Academy, cu CLI autentificat: `npx --no-install supabase functions deploy generate-lyrics --no-verify-jwt`. Configurația dezactivează doar verificarea gateway-ului; handlerul verifică explicit JWT-ul, sesiunea și rolul înainte de acces. Nu elimina aceste verificări.
4. Publică frontendul separat. Verifică funcția cu un cont profesor și un pozitiv original/autorizat ≤24 MB. Fără secret/migrare/funcție publicată, UI afișează eroare și păstrează textul.
5. Test audio manual: pe `/canto/`, verifică mai întâi karaoke fără microfon. Apoi alege REC pentru temă, conectează căștile, confirmă regula și testează Dry/Wet, Stop, revizuirea și trimiterea explicită. Ascultarea reală și Safari/iOS trebuie validate pe dispozitivele țintă.

### Validare Modulul 4

`npm test` include parser/AI, graful Web Audio, anularea/cleanup-ul microfonului, autorizarea Edge și migrarea cooldown în PostgreSQL/PGlite. După `npm run build`, rulează `npm run test:canto`: Chromium 390/1440 px, microfon virtual și audio PCM sintetic (cu byte ranges reale), gardă de căști exclusiv la REC, zero captare la Play, MediaRecorder real cu microfon virtual, permisiune refuzată, Stop/fundal și revizuire, trimitere multipart simulată cu fișier audio nenul, highlight pe cuvânt și reduced motion; UI AI cu răspunsuri simulate în ambele editoare. Browserul de test este mut. Nu se trimit fișiere sau chei către furnizor și nu se verifică automat calitatea perceptivă a reverbului/transcrierii reale.

## Casa de Discuri Virtuală (Virtual Studio)

Cererile de masterizare sunt salvate în `studio_requests`; piesa este referită prin `song_id` la `public.pieces`. Elevul trimite înregistrarea audio din etapa de ascultare a `RecordingStudio`, iar fluxul standard de teme către Drive rămâne neschimbat. Profesorul gestionează cererile pending/processing în `/admin/studio/`, descarcă brutul, îl procesează offline și încarcă masterul final. Piesele completed apar în secțiunea „Lansările mele” din `/portofoliu/`.

Înainte de publicarea frontendului, aplică `supabase/migrations/20261021000001_virtual_studio.sql` în Supabase SQL Editor după schema Academy și migrările existente până la `20261020000007_study_levels_presence.sql`. Migrarea este repetabilă; creează tabela și enum-ul, păstrează bucketul `student_records` privat și aplică politicile de acces pentru elev/profesor. Căile din tabel sunt chei Storage, nu URL-uri publice sau URL-uri semnate. Frontendul emite linkuri semnate doar pentru utilizatorii autorizați. Limita configurată pentru bucket și uploadul masterului este 200 MB.

`notification_seen_at` ține evidența confirmării alertei elevului după finalizarea unei piese. Migrarea nu trebuie rulată cu cheia service-role din browser. `npm test` verifică local repetabilitatea migrării, enum-ul, RLS și politicile Storage; verificarea locală nu aplică migrarea în proiectul Supabase live.
## Personalizare, niveluri de studiu și prezență

Migrarea incrementală `supabase/migrations/20261020000007_study_levels_presence.sql` se aplică după migrarea catalogului de teme și celelalte migrări anterioare (inclusiv `20261020000005_security_sessions.sql` și `20261020000006_generate_lyrics.sql`), înainte de publicarea frontendului actualizat. Ea adaugă `profiles.study_level` (distinct de `grade_level`), protejează schimbarea nivelului la profesor, păstrează bucketul `avatars` privat și configurează RLS pentru canalul privat Realtime `academy:online`. Nu lărgește accesul elevilor la profilurile celorlalți.

Biblioteca afișează piesele publicate, dar accesul la audio/PDF rămâne controlat separat de `can_access_piece` și Storage RLS. Nivelul următor se deblochează numai când există cel puțin o piesă alocată în nivelul elevului și fiecare piesă distinctă are o temă audio/video asociată prin `piece_id` în `catalog_teme` sau `submissions`. Lipsa alocărilor nu deblochează nivelul. Înregistrările din pian fără asociere la o piesă nu sunt luate în calcul.

Avatarurile acceptă JPEG, PNG și WebP până la 5 MB. Prezența transmite doar numele și un URL semnat temporar al avatarului; nu folosește starea Presence ca autorizare și nu expune lista de profiluri prin RLS.

După migrare, validează cu `npm test`, `npx vite build`, `npm run build`, `npm run test:admin` și `npm run test:canto`. Migrarea și prezența live trebuie verificate în proiectul Supabase înainte de deploy.

### Canto — fereastră de versuri sincronizate

- „Vezi versuri” deschide aceeași fereastră karaoke care se deschide automat la Play pentru pozitiv sau negativ. Play/Pauză, Stop și poziția din fereastră controlează aceeași sursă audio, fără dublarea redării. Schimbarea variantei oprește sursa precedentă. Închiderea ferestrei nu oprește muzica.
- Textul cu timestamp-uri Enhanced LRC evidențiază cuvântul curent și derulează linia activă după ceasul audio, inclusiv după seek. Textul simplu nu primește timpi inventați; timestamp-urile doar pe linie rămân sincronizare pe linie. Pozitivul și negativul trebuie să aibă aceeași aliniere temporală pentru a reutiliza aceiași timpi.
- Profesorul poate genera direct din această fereastră folosind integrarea `generate-lyrics` existentă. Configurează `OPENAI_API_KEY` în Supabase Edge Functions Secrets și publică funcția/migrarea conform secțiunii AI de mai sus. Nu introduce cheia OpenAI în `.env` cu prefix `VITE_` și nu o confunda cu cheia publică Supabase.
- Generarea necesită un pozitiv MP3 salvat în Storage (maximum 24 MB), consimțământ și drept de prelucrare. Ciorna poate fi previzualizată/editată; numai „Salvează versurile sincronizate” actualizează coloana `versuri_text`. Elevul folosește rezultatul salvat și nu declanșează cereri AI.
- `npm run test:canto` acoperă fereastra pe mobil/desktop, auto-deschiderea ambelor variante, clock/seek/scroll pe cuvânt și generarea/salvarea manuală de către profesor. Configurația reală OpenAI, costurile și precizia pe înregistrări muzicale necesită verificare separată.

### Orgă — bibliotecă PDF și propriul demo MIDI

- Ruta autentificată `/instrument/partituri/`, accesibilă din meniul Instrument și din repertoriu, listează piesele Orgă care au `score_path`. Căutarea după titlu, filtrarea pe nivel și paginarea (12 PDF-uri/pagină) sunt executate în Supabase, fără descărcarea întregii biblioteci. Elevul vede numai materiale publicate, cu RLS și blocarea nivelurilor existente păstrate inclusiv la accesarea directă prin `?piece=...`.
- Profesor: „Încarcă partitură PDF” deschide formularul existent `/admin/piese/?add=orga`. Completează titlul și nivelul, atașează PDF-ul în câmpul „Partitură (PDF)” și salvează/publică piesa. Fișierele audio sunt opționale. Repetă pentru fiecare partitură; nu s-a introdus un upload multiplu sau un bucket nou.
- Elev: alege tema; PDF-ul privat este afișat deasupra editorului de note, cu pagini/zoom și watermark. Notele se introduc manual; nu se face recunoaștere automată PDF → MIDI. Editorul păstrează limitele existente (128 note/pauze, 120 BPM la export).
- „Exportă MIDI” descarcă fișierul și pregătește demo-ul din aceiași bytes. „Studiază pe claviatură” pregătește demo fără descărcare. Apasă „Pornește studiul”: claviatura profesorului redă/evidențiază compoziția elevului, iar claviatura elevului rămâne disponibilă simultan prin touch, taste PC sau USB MIDI, cu mixer separat, viteză și buclă A–B.
- Modificarea compoziției/instrumentului sau previzualizarea în editor invalidează demo-ul anterior, pentru a evita partituri și sunete nealiniate. Nu se salvează automat ciornele în DB: exportă MIDI înainte de schimbarea temei/închiderea paginii; un MIDI salvat se poate încărca ulterior în studio. Nu este necesară o migrare SQL nouă.
- Stilurile editorului și studioului sunt importate explicit și în shell-ul SPA Astro, ca să nu depindă de CSS-ul paginii publice `/studio/`. Playerul MIDI suplimentar se încarcă numai când primește o sursă, nu la pornirea demo-ului nativ; CSP nu este relaxat.
- `npm run test:admin` verifică la 390px și 1440px: biblioteca/paginarea/căutarea, canvas PDF deasupra editorului, export MIDI cu note/durate/pauze exacte, sunetul demo (oscilator 261,63 Hz pentru Do4), clapă evidențiată și claviatura elevului simultană, invalidarea demo-ului și blocarea nivelurilor. Testele folosesc PDF/date sintetice, fără modificări în Supabase live.

### Etapa 1 — voce dry și confirmare Studio securizată

- `startLiveMonitor` expune sursa brută `input`; `createStudioSession` o leagă direct de un `MediaStreamAudioDestinationNode` dedicat recorderului. Pozitivul/negativul nu este mixat în captură. Negativul se aude în căști; reverb-ul și limiterul rămân pe monitorizare. Nu se cer echo cancellation, noise suppression sau AGC software. Browserul/dispozitivul poate aplica propria procesare/resampling; formatul existent rămâne WebM/Opus sau MP4, nu WAV studio lossless.
- Folosește căști: izolarea grafului Web Audio nu poate elimina negativul recaptat acustic prin microfon de la difuzoare sau o intrare hardware de tip Stereo Mix. Înregistrările vechi deja mixate nu pot fi transformate retroactiv în voce separată.
- În Supabase SQL Editor, aplică `supabase/migrations/20261021000003_studio_dry_notification_security.sql` după `20261021000001_virtual_studio.sql` și migrările de securitate necesare proiectului. Noua migrare este tranzacțională și repetabilă; nu șterge înregistrări. Pentru instalări noi, `supabase/schema.sql` include acum și infrastructura Studio plus protecția notificărilor. Nu rerula schema completă în locul migrării incrementale pe o bază existentă.
- RLS selectează doar cererea proprie finalizată și necitită a unui cont activ. Pentru că elevul/profesorul împart rolul PostgreSQL `authenticated`, privilegiile pe coloană singure nu îi diferențiază. Triggerul `guard_studio_notification_update` compară toate datele OLD/NEW, ignorând exclusiv `notification_seen_at`, refuză celelalte modificări cu SQLSTATE 42501 și setează data confirmării pe server. Confirmarea nu poate fi anulată sau rescrisă de elev. Profesorul păstrează actualizarea masterului/statusului; rolurile administrative PostgreSQL/service_role rămân privilegiate.
- `npm test` verifică atacuri reale PGlite/RLS: modificări URL/status/proprietar/piesă/ID/dată, inclusiv împreună cu confirmarea; acces străin/inactiv, pending, confirmare repetată/resetată, timestamp server, flux profesor și o politică permisivă simulată. Testele audio verifică ramura dry și cleanup-ul în modurile audio/video, cu/fără negativ. `test:canto` folosește MediaRecorder real cu microfon sintetic și verifică ramurile recorder/monitor.
- Această etapă nu adaugă Joc Ritmic, clasament sau multiplayer. Testarea migrării în Supabase live și audiția pe hardware real rămân separate de testele locale.


## Etapa 2 — Joc Ritmic, podium și dueluri quiz între elevi

### Activarea în Supabase

1. Proiectele existente trebuie să aibă deja banca din `supabase/setup_quizzes.sql` (migrarea `20261020000003_quizzes.sql`). Dacă nu există tabelele `quizzes` / `quiz_questions`, aplică întâi acel script.
2. Aplică **doar** `supabase/migrations/20261021000004_games_live.sql` în SQL Editor. Migrarea este tranzacțională și repetabilă. Pentru o instalare nouă, `supabase/schema.sql` include banca și Etapa 2. Nu reaplica schema integrală pe baza live pentru această actualizare.
3. Migrarea adaugă `live_quiz_rooms` în publicația `supabase_realtime`, dacă există. Browserul ascultă Postgres Changes cu RLS; verificarea periodică (2 s în duel, 5 s în lista duelurilor, 10 s în notificarea globală) păstrează funcționarea când WebSocket-ul lipsește. Nu sunt necesare chei secret/service în browser.
4. Sunt pregătite două quiz-uri, fiecare cu cinci întrebări: **Note și portativ** și **Ritm și expresie**. Conținutul nou se pregătește în SQL Editor, în `quizzes` / `quiz_questions`; se afișează numai quiz-urile publicate. Nu există încă un editor vizual nou pentru banca de întrebări. Rularea repetată a migrării nu rescrie editările profesorului. Duelurile folosesc copii ale întrebărilor/soluțiilor, stabile pe durata jocului.

### Flux elev

- În **Jocuri muzicale → Dueluri quiz**, elevul selectează un quiz pregătit și un adversar din lista participanților voluntari sau trimite codul privat al duelului. Provocarea directă apare și în dashboard/celelalte pagini ale contului destinatarului. Destinatarul acceptă/refuză; doar două conturi pot participa. Invitația expiră în 10 minute.
- Acceptarea pornește automat aceleași întrebări pentru ambii elevi. Timpul ales este de 10/20/30/60 secunde pe întrebare. Se permite un singur răspuns confirmat, 100 puncte pentru răspuns corect, fără bonus de viteză. După ambele răspunsuri sau deadline urmează 4 secunde de recapitulare, apoi următoarea întrebare. La final se afișează câștigătorul sau egalitatea.
- Reîncărcarea paginii permite redeschiderea duelului din lista proprie. Deadline-urile sunt în DB; părăsirea paginii nu oprește cronometrul. Tranzițiile expirate se materializează la următoarea interogare a duelului/inboxului/clasamentului participantului, fără cron/worker. Rezultatele și răspunsurile rămân persistente.
- **Orgă → Joc Ritmic**, linkul din Studio sau tabul din Jocuri deschid o rundă cu 12 note / 10 secunde. Input: A/S/D/F/G, clape tactile sau MIDI USB. Motorul comun extras în `src/lib/rhythm.js` păstrează evaluarea din Studio. Scor: max(0, round(note corecte × 1000 / 12) − 20 × apăsări greșite). Minimum 25 secunde între porniri. La eroare de salvare se poate reîncerca aceeași rundă fără duplicare (maximum 3 minute de la start).
- **Clasament**: maximum 50 de participanți; cel mai bun scor ritmic + cel mai bun duel finalizat normalizat la 1000, maximum 2000 în total. Încercările nu se însumează. Scorurile egale primesc același loc. Avatarurile folosesc bucket-ul privat existent și URL-uri semnate.
- Pseudonimul și participarea în clasament/lista de adversari sunt voluntare și implicit oprite. Nu se publică numele complete. Participarea prin cod rămâne posibilă fără listarea generală. Retragerea elimină utilizatorul la următoarea actualizare și oprește emiterea de URL-uri noi pentru fotografia sa în acest context; URL-urile deja semnate expiră conform TTL configurat. Regulile existente de acces pentru proprietar/profesor rămân valabile.

### Securitate și verificare

- `game_profiles`, `rhythm_attempts`, `live_quiz_rooms`, `live_quiz_questions`, `live_quiz_members`, `live_quiz_answers` au RLS. Mutările de joc sunt numai prin RPC-uri SECURITY DEFINER cu search_path gol și verificarea sesiunii/contului activ; RPC-urile interne nu sunt apelabile de elev. Cheile răspunsurilor și rezultatele adversarului la întrebarea curentă nu sunt expuse înainte de recapitulare.
- Scorul ritmic este recalculat din evenimentele clientului, cu pattern creat de server, limită de evenimente/timp și închidere idempotentă. **Nu este anti-cheat invulnerabil:** un browser modificat poate fabrica apăsări. Nu folosi rezultatul drept examen certificat sau recompensă cu valoare financiară.
- Teste: `npm test` include SQL/RLS/adversarial și motorul comun; `npm run test:games` pornește SSR de test și două contexte Playwright, cu baza PGlite reală în spatele RPC-urilor. Verifică invitație din dashboard, acceptare, reconectare, deadline, progresie, scoruri, salvare ritmică cu retry, podium/avatare/opt-out și layout 390/1440 px. WebSocket-ul extern este blocat intenționat: acest test validează fallback-ul HTTP, nu o instanță Supabase Realtime live.
- Aplicarea migrării și livrarea Realtime în proiectul Supabase/Workers real necesită validare după publicare. Nu au fost executate automat asupra contului live.


## Jocuri AI — generare OpenAI și studiu individual

### Activare și testare

1. În Supabase SQL Editor aplică **supabase/migrations/20261021000005_ai_games.sql**. Necesită tabela profiles existentă, nu banca de quiz-uri pentru dueluri. Nu reaplica schema consolidată integrală pe proiectul existent.
2. În **.env al aplicației Academy**, adaugă variabila server-only (nu trimite cheia în chat și nu o pune în Git):

~~~dotenv
OPENAI_API_KEY=<cheia-ta-api-openai>
~~~

Nu folosi prefixele VITE_ sau PUBLIC_. Cheia dintr-o Edge Function Supabase de versuri nu configurează automat serverul Astro. Exemplul fără secret este în .env.example.
3. Păstrează configurarea Supabase existentă: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY și SUPABASE_SERVICE_ROLE_KEY. Cheia service_role este server-only, diferită de cheia anon/publică.
4. Configurează accesul API, facturarea și alertele/limitele de buget în proiectul OpenAI pentru **gpt-4o-mini**. Abonamentul ChatGPT nu oferă automat credit API.
5. Repornește serverul cu **npm run dev -- --host 127.0.0.1**, autentifică-te la http://localhost:5180/ și deschide **Jocuri muzicale → Joc AI** (/jocuri/?tab=ai). Alege Teorie/Instrumente/Ritm și Începător/Intermediar, apoi Generează un joc nou.
6. În Cloudflare Worker adaugă OPENAI_API_KEY ca secret, apoi redeploy. Nu o pune în serviciul site-ului public și nu o publica în variabile VITE sau screenshot-uri.

### Fișiere și contract

- src/pages/api/games/generate.js este ruta Astro server-side, prerender=false. Refolosește autentificarea middleware-ului existent. src/lib/aiGamesServer.js conține implementarea testabilă pentru prompt, OpenAI, validare, limite și persistență.
- src/components/AIGamePlayer.jsx afișează întrebările pe rând, verifică selecția pe server, oferă feedback/explicație și scor salvat, cu reluare în același tab după reload. Cheia OpenAI nu ajunge în browser.
- POST /api/games/generate/ acceptă action=generate, topic=teorie|instrumente|ritm, level=incepator|mediu. Numai sesiuni active elev/profesor, same-origin, JSON maximum 8 KB; fără prompt liber, date personale sau user_id/scor de la client.
- OpenAI primește prompt educațional în română și response_format=json_schema, strict=true. Obiectul generat are title și questions; fiecare întrebare are prompt, options (4 string-uri distincte), correctIndex (0–3) și explanation. Exact **5 întrebări**, titlu maximum 100 caractere, întrebare 350, variantă 120, explicație 500. Refuzurile, răspunsurile trunchiate/invalide, câmpurile suplimentare, întrebările duplicate și indexurile greșite sunt respinse explicit, nu înlocuite cu jocuri fictive. Timeout 25 secunde, răspuns maximum 64 KB.
- Browserul primește numai ID/titlu/întrebări/opțiuni, **nu soluțiile în avans**. action=answer cu gameId/questionIndex/answerIndex validează proprietarul și ordinea, salvează răspunsul și returnează feedbackul pentru acea întrebare. Retry identic este idempotent; schimbarea unui răspuns confirmat este respinsă. action=resume cu gameId recuperează numai jocul propriu și feedbackul deja obținut.
- Migrarea creează ai_game_sessions privat și RPC-uri numai pentru service_role, fără citiri/mutări directe de elev. Scorul **0–5**, răspunsurile și data finalizării rămân persistente. Jocurile expiră după 24 ore. sessionStorage păstrează numai ID-ul jocului, separat pe cont. Renunțarea la reluare/închiderea tabului nu șterge răspunsurile din DB, dar nu există încă o pagină nouă de istoric AI.
- Scorurile AI sunt pentru **studiu individual**, separate de dueluri/podium și de notele școlare. Nu publicăm automat quiz-urile generate în banca de dueluri.

### Buget, confidențialitate și limite

Rezervare atomică în DB, comună tuturor instanțelor Workers: **o generare/minut/cont, 10/cont în ultimele 24h, 200/platformă în ultimele 24h**. Inclusiv erorile consumă rezervarea pentru a evita apelurile plătite nelimitate. Cheia absentă este detectată înainte de rezervare; răspunsurile/reluările nu apelează OpenAI. Limitele aplicației nu înlocuiesc controlul facturării furnizorului.

Promptul trimite numai tema/nivelul din liste fixe, fără nume, profil, pseudonim, voce sau date ale copilului. Nu relaxăm CSP/CORS și nu includem scripturi externe de joc. Formatul valid nu garantează corectitudinea muzicală, moderarea perfectă sau întrebări mereu diferite: AI poate greși/repetă, iar explicațiile neclare trebuie discutate cu profesorul.

### Validări

npm test include validarea strictă, auth/origin/input, cote exacte și SQL/RLS real, răspunsuri protejate, scor persistent, refuzuri/JSON invalid/timeout OpenAI. npm run test:games verifică ruta Astro compilată (401/403/400 fără apel plătit), player 390/1440px cu **OpenAI simulat și DB PGlite reală**: lipsă cheie, feedback, conexiune pierdută după salvare și retry fără duplicare, reload/reluare, scoruri 4/5 și 5/5 și cota fără apel suplimentar. Include și regresiile duel/ritm/podium.

Nu se execută automat migrarea în proiectul Supabase live și nu se consumă credit OpenAI în teste. Primul apel real se verifică după SQL + configurarea cheii.


### Canto — editare directă pentru profesor

În biblioteca /canto/, cu modul Profesor activ, fiecare piesă are linkul **Editează piesa · negativ și versuri**, care deschide /admin/canto/?edit=ID în formularul existent, completat și focalizat pe piesa aleasă. Acolo poți încărca **Upload MP3 Negativ**, completa **Versuri / text sincronizat (LRC)** și apăsa **Salvează modificările**. Audio/PDF existente rămân neschimbate dacă nu alegi înlocuitori. Linkul nu apare elevilor sau în previzualizarea Elev; RLS rămâne neschimbat.
