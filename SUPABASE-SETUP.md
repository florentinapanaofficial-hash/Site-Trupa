# Setup — Live Page cu Supabase Realtime

## 📋 Ce am adăugat

Pagina `/live/` acum are:

1. **Buton de Like** (❤️) — Trimite interacțiuni în Supabase
2. **Burtiera Realtime (Lower Third)** — Apare o animație când cineva dă like
3. **Ticker Text** — Bandă de text care curge continuu sub player
4. **Supabase Realtime Listener** — Ascultă noi like-uri în timp real

---

## 🚀 Setup Supabase (Necesar!)

### 1. Rulează migrația SQL în Supabase

Accesează **Supabase Dashboard** > **SQL Editor** și rulează:

```bash
# Copiază conținutul din: scripts/supabase-setup.sql
```

Sau deschide link-ul direct:
- URL: https://app.supabase.com/project/uhqujllxujfbyvwrafzn/sql/new
- Paste codul din `scripts/supabase-setup.sql`
- Click **Run**

### 2. Verifică că tabela a fost creată

```sql
SELECT * FROM public.interactions LIMIT 1;
```

### 3. Activează Realtime pe tabelă

- Dashboard > **Realtime** > **Add Table to Realtime** > Selectează `interactions`
- Click **Enable**

---

## 🎯 Cum funcționează

### Like Button
```
1. Utilizatorul apasă "❤️ Like"
2. Datele sunt trimise la Supabase (`interactions` tabel)
3. Butonul se animează (scale 1.1x)
4. Counter-ul se actualizează
```

### Realtime Lower Third
```
1. Supabase Realtime listener ascultă INSERT-urile la `interactions`
2. Când cineva dă like, se declanșează `slideInLowerThird` animation
3. Apare textul "❤️ Cineva a dat like!" cu pulsing heart
4. Dispare automat după 3 secunde
```

### Ticker Text
- Text care curge continuu sub player: "Urmăriți-ne live! • Comentați pe platforme! • Florentina Pană"
- Animație: `liveMainTicker` (30s cycle)

---

## 📊 Schema Tabel `interactions`

```sql
id              BIGSERIAL PRIMARY KEY
stream_id       TEXT NOT NULL         -- Format: "live-stream-YYYY-MM-DD"
type            TEXT DEFAULT 'like'   -- Tip: 'like', 'comment', etc.
created_at      TIMESTAMP DEFAULT NOW -- Timestamp UTC
user_session    TEXT (opțional)       -- Session ID pentru tracking
metadata        JSONB (opțional)      -- Date extra
```

---

## 🔧 Configurație Variabile (deja în `.env`)

```env
PUBLIC_SUPABASE_URL=https://uhqujllxujfbyvwrafzn.supabase.co
PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Pizn5TO9w3NpDGMtIKLuGg_TIlKCeCT
```

---

## 🎨 Stiluri & Animații

### Like Button
- Culoare: Roșu (`border-red-500`, `bg-red-500/10`)
- Hover: Scale + shadow
- Click: Scale 1.1x (feedback)

### Lower Third
- Fundal: Black/transparent cu blur (`backdrop-blur-sm`)
- Text: Alb, bold, centrat
- Icon: ❤️ pulsing (`animate-pulse`)
- Animație: `slideInLowerThird` (0.4s) → 3s stare → `slideOutLowerThird` (0.4s)

### Ticker
- Text: Cyan (`text-cyan-300`)
- Animație: `liveMainTicker` (30s linear infinite)

---

## ✅ Verificare

După setup, testează:

1. **Deschide** pagina `/live/`
2. **Apasă** butonul "❤️ Like"
3. **Observă**:
   - Counter-ul crește
   - Lower third apare cu animație
   - Dacă deschizi din altă tabă și dai like, Lower third se activează (Realtime!)

---

## 🐛 Troubleshooting

### "Lower third nu apare"
- Verific că Realtime e activat în Supabase Dashboard
- Verific Console (F12) pentru erori

### "Like count nu se actualizează"
- Verific că tabela `interactions` a fost creată
- Verific RLS policies (INSERT/SELECT trebuie activate)

### "Realtime listener nu se conectează"
- Verific conexiunea la internet
- Verific că `PUBLIC_SUPABASE_KEY` și `PUBLIC_SUPABASE_URL` sunt corecte

---

## 📝 Note

- **Stream ID**: Generat ca `live-stream-YYYY-MM-DD` (grupează interacțiunile pe zile)
- **Realtime Channel**: `interactions:stream_id=eq.{streamId}` (filtrează pe stream curent)
- **Polling**: Scriptul nu folosește polling, doar Realtime listeners (low latency)

---

## 🔐 Securitate

- ✅ RLS enabled pe tabel
- ✅ Anonymous INSERT/SELECT allowed (GDPR-compliant)
- ✅ Rate limiting recomandat în production (cf. OWASP)

---

## 🎬 Demo

1. Deschide `/live/` în browser
2. Apasă "❤️ Like"
3. Deschide tab 2 și apasă Like din tab 1
4. Lower third se declanșează în tab 2 (Realtime sync!) ✨

---

Gata! 🚀 Live page-ul tău e acum interactiv cu Supabase Realtime!
