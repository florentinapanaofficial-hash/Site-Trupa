# Politică de Retenție Date și Procedură de Ștergere – GDPR

**Ultima actualizare:** 23 martie 2026
**Versiune:** 1.0
**Responsabil:** florentinapanaofficial@gmail.com

---

## 1. Categorii de date și perioade de retenție

| Categorie date | Perioadă retenție | Mecanism ștergere | Temei legal |
|---|---|---|---|
| Consimțământ WhatsApp/telefon | **12 luni** de la data acordării | Automat (MySQL Event / MongoDB TTL) | Art. 5(1)(e) RGPD – limitarea stocării |
| IP hașat (SHA-256) | **12 luni** (corelat cu consimțământul) | Idem | Art. 5(1)(e) RGPD |
| User-Agent și Referer | **12 luni** (corelat cu consimțământul) | Idem | Art. 5(1)(e) RGPD |
| Cereri de ștergere primite (email/bilet) | **3 ani** | Manual, la expirare | Art. 6(1)(c) + Art. 17 RGPD |

---

## 2. Mecanism de ștergere automată

### 2.1 MySQL / MariaDB

Procedura stocată `sterge_consimtaminte_expirate()` marchează prin **soft delete**
înregistrările mai vechi de 12 luni. Rularea este automată prin MySQL Event Scheduler
(configurat în `gdpr/schema-gdpr.sql`).

**Verificare manuală:**
```sql
-- Verificați câte înregistrări urmează să fie șterse luna aceasta
SELECT COUNT(*) AS de_sters
  FROM gdpr_consimtamant
 WHERE data_consimtamant < DATE_SUB(NOW(), INTERVAL 12 MONTH)
   AND sters_la IS NULL;

-- Rulare manuală a procedurii (ex: la testare sau urgență)
CALL sterge_consimtaminte_expirate();
```

**Verificare Event Scheduler activ:**
```sql
SHOW VARIABLES LIKE 'event_scheduler';
-- Rezultat așteptat: event_scheduler | ON
```

### 2.2 MongoDB

TTL Index configurat pe câmpul `data_consimtamant` cu `expireAfterSeconds: 31_536_000`
(365 zile). MongoDB îl aplică automat prin procesul intern de TTL monitor (~60 secunde interval).

**Verificare index TTL:**
```js
db.gdpr_consimtamant.getIndexes()
// Căutați entrada cu "expireAfterSeconds": 31536000
```

---

## 3. Procedură manuală – Cerere ștergere Art. 17 RGPD

La primirea unei cereri de ștergere de la un utilizator:

### Pasul 1 – Identificare

Utilizatorul furnizează suficiente informații pentru identificare (ex: ora aproximativă,
pagina accesată, dispozitivul folosit). **Nu cereți date mai multe decât sunt necesare.**

### Pasul 2 – Ștergere în MySQL

```sql
-- Soft delete imediat pentru IP-ul identificat
-- Înlocuiți '<ip-confirmat>' cu IP-ul real furnizat/confirmat
UPDATE gdpr_consimtamant
   SET sters_la = NOW()
 WHERE ip_hash = SHA2('<ip-confirmat>', 256)
   AND sters_la IS NULL;

-- Verificare
SELECT COUNT(*) AS sterse FROM gdpr_consimtamant
 WHERE ip_hash = SHA2('<ip-confirmat>', 256)
   AND sters_la IS NOT NULL;
```

### Pasul 3 – Ștergere în MongoDB

```js
// Folosind metoda statică din schema-gdpr-mongo.js
const marcate = await Consimtamant.stergePentruIp('<ip-confirmat>');
console.log(`Marcate ${marcate} înregistrări ca șterse.`);
```

### Pasul 4 – Confirmare scrisă

Trimiteți confirmarea în scris utilizatorului în **cel mult 30 de zile calendaristice**
de la primirea cererii (Art. 12(3) RGPD). Template de răspuns:

> *„Stimate/Stimată [Nume],*
> *Ca urmare a cererii dumneavoastră din [data], vă confirmăm că datele de consimțământ
> asociate sesiunii dumneavoastră au fost marcate pentru ștergere din sistemele noastre.
> Ștergerea fizică va fi finalizată automat conform politicii noastre de retenție de 12 luni."*

### Pasul 5 – Arhivare cerere

Stocați cererea de ștergere (email/bilet de suport) minimum **3 ani** pentru a demonstra
conformitatea la un eventual audit ANSPDCP.

---

## 4. Audit periodic de conformitate

| Frecvență | Activitate | Responsabil |
|---|---|---|
| **Lunar** | Verificare execuție automată Event MySQL / MongoDB TTL | Admin tehnic |
| **Trimestrial** | Verificare înregistrări expirate neșterse | DPO / Admin |
| **Anual** | Revizuire perioade de retenție; actualizare politică dacă e cazul | DPO |
| **La modificare politică** | Re-obținere consimțământ utilizatori + incrementare `versiune_politica` | DPO + Dev |

---

## 5. Breșe de securitate (Art. 33-34 RGPD)

Dacă datele din tabelul `gdpr_consimtamant` sunt afectate de o breșă de securitate:

1. **72 ore** – notificați **ANSPDCP** (formular online pe dataprotection.ro);
2. **Fără întârziere** – notificați utilizatorii afectați dacă riscul este ridicat;
3. Documentați breșa intern (Art. 33(5) RGPD): cauză, date afectate, măsuri corective.

---

## 6. Responsabilitate și aprobare

Această politică a fost aprobată de operatorul de date și intră în vigoare la data
publicării. Orice modificare necesită aprobare explicită și incrementarea versiunii.

---

*Această politică se aplică împreună cu [Politica de Confidențialitate](POLITICA-CONFIDENTIALITATE.md).*
