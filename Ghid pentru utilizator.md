# Ghid pentru utilizator

Acest ghid este pentru administrarea site-ului fără cunoștințe tehnice.

## 1. Cum intri în administrare

1. Deschide site-ul tău și adaugă /admin la final.
   - exemplu: https://domeniul-tău.ro/admin
2. Loghează-te cu emailul și parola setate în Netlify Identity.
3. După login, vei vedea secțiunile editabile.

## 2. Ce poți edita din admin

### Brand
- short: prescurtare
- name: numele formației
- tagline: slogan

### SEO
- title: titlul pentru Google
- description: descrierea pentru Google
- ogImage: imaginea de preview social

### Contact
- phoneRaw: telefon pentru apel direct
- phoneDisplay: telefon afișat
- email: adresa de email
- city: oraș / zonă de acoperire

### Social Media
- youtube: link canal YouTube
- facebook: link pagină Facebook
- instagram: link profil Instagram

### Hero (prima secțiune)
- kicker: textul mic de deasupra titlului
- title: titlul principal
- description: descrierea principală
- ctaPrimary și ctaSecondary: butoane
- bullets: beneficii

### Noutăți și Comunitate
- intro: text de introducere
- posts: postările de noutăți
- approvedComments: comentarii aprobate pentru afișare publică

La approvedComments ai câmpurile:
- author
- relatedPost
- text
- reaction (opțional)
- trustLevel: nou, verificat sau confirmat

### Servicii
- title
- description

### Repertoriu
- label
- details

### Echipă
- vocalists
- instrumentalists
- collaborators

## 3. Cum funcționează comentariile (important)

1. Vizitatorii trimit comentarii din formularul Comunitate.
2. Comentariile sunt filtrate automat pentru limbaj nepotrivit și spam.
3. Comentariile NU se publică automat.
4. Tu alegi manual ce comentarii ajung în approvedComments.
5. Doar ce pui în approvedComments apare pe site.

Regula sigură:
- întâi moderare
- apoi publicare

## 4. Nivelurile de încredere pentru comentarii

- nou: comentariu recent, neconfirmat ca client
- verificat: comentariu validat de tine
- confirmat: client confirmat

Pe site, utilizatorii pot filtra comentariile după aceste niveluri.

## 5. Cum adaugi poze

1. În admin, mergi la câmpul de imagine.
2. Apasă Upload.
3. Alege poza din calculator.
4. Salvează.

Pozele ajung în folderul public/images.

## 6. Cum publici modificările

1. După editare, apasă Save.
2. Apasă Publish.
3. Netlify pornește automat un deploy nou.
4. După 1-2 minute verifică site-ul live.

## 7. Configurare inițială (o singură dată)

În Netlify:

1. Site configuration -> Identity -> Enable Identity
2. Setează Invite only
3. Activează Git Gateway
4. Invite users pe emailul tău
5. Din email setezi parola

## 8. Verificare finală înainte de lansare (SEO)

1. Setează domeniul real în variabila SITE_URL la deploy.
2. Verifică sitemap în robots.txt cu domeniul real.
3. Verifică title și description din SEO.

## 9. Dacă nu merge /admin

1. Identity este activat
2. Git Gateway este activat
3. Ai acceptat invitația pe email
4. Te loghezi cu emailul corect

## 10. Metodă de lucru fără greșeli

1. Modifici puțin
2. Save
3. Publish
4. Verifici live
5. Continui cu următorul pas

Așa păstrezi controlul și eviți erori mari.
