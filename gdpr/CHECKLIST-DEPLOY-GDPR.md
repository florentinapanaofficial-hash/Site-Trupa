# Checklist Deploy și Conformitate GDPR
## Site România – Butoane WhatsApp & Click-to-Call

**Versiune:** 1.0 | **Data:** 23 martie 2026

---

## SECȚIUNEA 1 – Baza de Date și Schema

- [ ] **Rulare migrare SQL:**
  ```bash
  mysql -u <user> -p <database> < gdpr/schema-gdpr.sql
  ```
- [ ] **Verificare tabel creat:**
  ```sql
  DESCRIBE gdpr_consimtamant;
  SHOW INDEX FROM gdpr_consimtamant;
  ```
- [ ] **Event Scheduler activat** (MySQL):
  ```sql
  SET GLOBAL event_scheduler = ON;
  SHOW VARIABLES LIKE 'event_scheduler'; -- așteptat: ON
  ```
- [ ] **Test inserare manuală** pentru a valida schema (vezi comentariile din `schema-gdpr.sql`)
- [ ] **Variabilă de mediu `IP_HASH_SALT`** setată cu un string aleatoriu de minim 32 caractere:
  ```bash
  # Generare salt:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

---

## SECȚIUNEA 2 – Variabile de Mediu (`.env`)

- [ ] `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_PORT` – setate și testate
- [ ] `IP_HASH_SALT` – salt aleatoriu (minim 32 caractere hex)
- [ ] `PUBLIC_SITE_URL` – URL-ul canonical de producție (ex: `https://www.florentinapanaofficial.ro`)
- [ ] `PUBLIC_SITE_URL_WWW` – varianta www dacă diferă
- [ ] **Fișierul `.env` NU este în git** – verificați `.gitignore`:
  ```
  .env
  .env.local
  .env.production
  ```

---

## SECȚIUNEA 3 – Endpoint `/api/consent`

- [ ] **Rulare teste cURL:**
  ```bash
  bash gdpr/curl-teste.sh
  # Toate 8 teste trebuie să afișeze ✔ PASS
  ```
- [ ] **Rulare teste Jest:**
  ```bash
  npx jest gdpr/consent.test.js --verbose
  # Toate testele trebuie să treacă (verde)
  ```
- [ ] **Test manual în browser:** deschideți pagina cu componenta `ConsentWhatsApp`,
  încercați să apăsați butonul fără bifă → trebuie să apară mesajul de eroare
- [ ] **Test cu bifa:** bifați checkbox-ul și apăsați butonul → verificați că:
  - Se face request POST la `/api/consent`
  - Răspunsul este 200
  - Redirect-ul la `wa.me` are loc
  - Înregistrarea apare în DB
- [ ] **Rate limiting testat:** trimiteți >10 cereri în 1 minut → trebuie să primiți 429

---

## SECȚIUNEA 4 – Componenta Frontend

- [ ] **Checkbox nepre-bifat** – verificați vizual că checkbox-ul nu este bifat la încărcare
- [ ] **Link politică de confidențialitate** funcțional (href="/politica-confidentialitate")
- [ ] **Mesaj de eroare** afișat la click fără bifă, ascuns după bifă
- [ ] **Buton dezactivat** în timpul procesării (evitare dublu-clic)
- [ ] **Test accesibilitate:**
  - Navigare cu Tab → checkbox și buton sunt selectabile
  - Cititor de ecran: mesajul de eroare este anunțat (aria-live="polite")
- [ ] **Test mobil** (iOS Safari, Android Chrome) – dimensiune checkbox ≥ 44px touch target

---

## SECȚIUNEA 5 – Politica de Confidențialitate

- [ ] **Pagina `/politica-confidentialitate`** există și este accesibilă publicului
- [ ] **Conținut actualizat** cu datele reale ale operatorului (nume, email, DPO)
- [ ] **Link în footer** al site-ului
- [ ] **Text GDPR în bbox-ul de consimțământ** menționează Meta Platforms Ireland Ltd.
- [ ] **Versiunea politicii** din DB (`versiune_politica: '1.0'`) corespunde cu documentul publicat
- [ ] **Test cu ANSPDCP** – verificați că toate câmpurile obligatorii Art. 13 sunt prezente:
  - Identitate operator
  - Scopul și temeiul prelucrării
  - Terți beneficiari (Meta/WhatsApp)
  - Drepturi utilizator (acces, rectificare, ștergere, opoziție)
  - Dreptul de a depune plângere la ANSPDCP
  - Perioada de retenție

---

## SECȚIUNEA 6 – Politica de Retenție

- [ ] **Perioadă de retenție 12 luni** documentată în `gdpr/POLITICA-RETENTIE.md`
- [ ] **Procedura de ștergere la cerere** testată (SQL UPDATE cu SHA2)
- [ ] **Răspuns în 30 zile** la cereri Art. 17 – setați un reminder în calendar
- [ ] **Audit lunar** planificat (calendarizat în task manager / calendar)

---

## SECȚIUNEA 7 – Securitate

- [ ] **HTTPS obligatoriu** pe toată durata sesiunii (redirect HTTP → HTTPS)
- [ ] **Headers de securitate** activi pe server (verificați cu securityheaders.com):
  - `Content-Security-Policy`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy`
  - `Strict-Transport-Security` (HSTS)
- [ ] **SQL injection imposibil** – toți parametrii DB sunt binding-uri parametrizate (✔ implementat)
- [ ] **IP stocat hașat** – verificați în DB că nu există IP-uri în format x.x.x.x (✔ implementat)
- [ ] **CORS configurat corect** – endpoint respinge origini necunoscute cu 403
- [ ] **Rate limiting activ** – 10 cereri/minut/IP (✔ implementat)
- [ ] **Fără date sensibile în loguri** – verificați că logurile nu conțin IP-uri complete sau date personale

---

## SECȚIUNEA 8 – WhatsApp Business și DPA

Vedeți instrucțiunile complete în [gdpr/WHATSAPP-BUSINESS-DPA.md](WHATSAPP-BUSINESS-DPA.md).

- [ ] **Tip cont WhatsApp**: Personal / Business App / Business API (Cloud API)
      → Alegeți cel potrivit nevoilor (Business API dacă > 1000 conversații/lună)
- [ ] **DPA cu Meta semnat** (necesar la WhatsApp Business API)
- [ ] **Politica de confidențialitate menționează explicit Meta** ca terț
- [ ] **Mesajul pre-completat** nu conține date personale ale utilizatorului
- [ ] **Numărul de telefon** din `numarTelefon` prop este numărul oficial al afacerii

---

## SECȚIUNEA 9 – Pre-Launch Final

- [ ] Toate testele cURL trec (`bash gdpr/curl-teste.sh`)
- [ ] Toate testele Jest trec (`npx jest gdpr/consent.test.js`)
- [ ] Checkbox nepre-bifat confirmat vizual pe desktop și mobil
- [ ] Redirect WhatsApp funcționează după bifă și click
- [ ] Înregistrarea apare în tabelul `gdpr_consimtamant` după test
- [ ] Pagina politică de confidențialitate accesibilă și completă
- [ ] Event MySQL scheduler activ (ștergere automată 12 luni configurată)
- [ ] `.env` NU în repository git
- [ ] `IP_HASH_SALT` setat în producție

---

## SECȚIUNEA 10 – Post-Launch

- [ ] **Lunar**: verificare execuție automată ștergere GDPR
- [ ] **Trimestrial**: audit înregistrări expirate
- [ ] **Anual**: revizuire politică confidențialitate + retenție
- [ ] **La orice modificare politică**: incrementare `versiune_politica` în cod, re-deploy, re-obținere consimțământ dacă modificarea este semnificativă
