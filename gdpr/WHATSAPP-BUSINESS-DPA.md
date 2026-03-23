# Instrucțiuni WhatsApp Business și DPA – Ghid Scurt

**Audiență:** Operator site florentinapanaofficial.ro
**Data:** 23 martie 2026

---

## 1. Ce tip de cont WhatsApp să folosiți?

| Caracteristică | Personal / Business App | WhatsApp Business API (Cloud API) |
|---|---|---|
| Număr de mesaje | Limitat, manual | Nelimitat, automatizat |
| Cost | Gratuit | Per conversație (Meta pricing) |
| Integrare API | Nu | Da |
| Cerințe DPA | Recomandat | **Obligatoriu** |
| Potrivit pentru | Site mic, contact ocazional | Volume mari, notificări automate |

**Recomandare pentru site personal/trupă muzicală:** WhatsApp Business App (gratuit)
este suficient pentru contact ocazional. Dacă generați >1000 conversații/lună, treceți
la Business API.

---

## 2. Pași pentru WhatsApp Business App (scenariul curent)

1. Descărcați **WhatsApp Business** (aplicație separată de WhatsApp personal)
2. Înregistrați-vă cu **numărul oficial de afaceri** (nu numărul personal)
3. Completați profilul: nume afacere, categorie, descriere, orar
4. Setați **mesaj de bun-venit** și **mesaj de absență** automate
5. Generați link-ul wa.me: `https://wa.me/40767369658?text=Mesaj%20pre-completat`
6. Actualizați prop-ul `numarTelefon` din componenta `ConsentWhatsApp`

---

## 3. Pași pentru WhatsApp Business API (Cloud API)

### 3.1 Configurare cont

1. Creați cont **Meta for Developers** (developers.facebook.com)
2. Creați o aplicație de tip **Business**
3. Adăugați produsul **WhatsApp** la aplicație
4. Asociați un **număr de telefon business** (poate fi număr nou sau port-in)
5. Obțineți **WABA ID** (WhatsApp Business Account ID) și **Phone Number ID**

### 3.2 DPA (Data Processing Agreement) cu Meta

**Obligatoriu conform Art. 28 RGPD** când folosiți WhatsApp Business API.

Pași pentru semnare DPA:
1. Mergeți la **Meta Business Settings** → **Data Use Checkup**
2. Acceptați **WhatsApp Business Terms of Service**
3. Acceptați **Meta Business Messaging Policy**
4. Descărcați confirmarea DPA (păstrați-o minimum 3 ani pentru audit)

**Important:** DPA cu Meta acoperă prelucrarea datelor utilizatorilor finali prin
platforma WhatsApp. Totuși, **responsabilitatea față de utilizatorii dvs.** (RGPD Art. 13)
rămâne la operatorul de date (dvs.).

### 3.3 Actualizare politică de confidențialitate

Adăugați explicit în secțiunea „Transferuri terți":
> *„Folosim WhatsApp Business API (Meta Platforms Ireland Ltd., 4 Grand Canal Square,
> Dublin 2, Irlanda) pentru comunicare. Meta procesează mesajele conform propriei politici
> de confidențialitate și în baza DPA semnat cu Meta Business."*

---

## 4. Linkul wa.me – format corect

```
https://wa.me/<numar_telefon>?text=<mesaj_url_encoded>
```

| Parametru | Format | Exemplu |
|---|---|---|
| `numar_telefon` | Internațional, fără `+`, fără spații | `40767369658` |
| `text` | URL-encoded (encodeURIComponent în JS) | `Bun%C4%83%20ziua%2C%20doresc%20informa%C8%9Bii` |

**Testare link:** deschideți `https://wa.me/40767369658` în browser – trebuie să deschidă
WhatsApp Web sau aplicația mobilă.

---

## 5. Mesaj Pre-completat – Bune practici GDPR

- **Nu includeți** date personale ale utilizatorului în mesajul pre-completat
- **Nu includeți** informații de sesiune sau identificatori unici
- Mesajul pre-completat este **vizibil utilizatorului** înainte de trimitere în WhatsApp
- Utilizatorul poate **modifica sau șterge** mesajul înainte de trimitere

Exemplu mesaj corect (neutral, fără date personale):
```
Bună ziua, doresc informații despre serviciile dvs. muzicale.
```

Exemplu mesaj incorect (de evitat):
```
Utilizator: ion.popescu@email.com, pagina: /contact, sesiune: abc123
```

---

## 6. Rezumat obligații legale

| Obligație | Baza legală | Status |
|---|---|---|
| Consimțământ explicit înainte de redirect | Art. 7 RGPD | ✔ Implementat (checkbox nepre-bifat) |
| Informare despre transfer la Meta | Art. 13(1)(e) RGPD | ✔ În componenta ConsentWhatsApp |
| DPA cu Meta (dacă se folosește Business API) | Art. 28 RGPD | Semnați dacă folosiți API |
| Politică de confidențialitate publicată | Art. 13 RGPD | ✔ gdpr/POLITICA-CONFIDENTIALITATE.md |
| Retenție date max 12 luni | Art. 5(1)(e) RGPD | ✔ Automatizat în DB |
| Răspuns la cereri drept Art. 17 în 30 zile | Art. 12(3) RGPD | Procedură în POLITICA-RETENTIE.md |
