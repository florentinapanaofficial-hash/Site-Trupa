# ⚡ Quick Reference — Live Page Supabase Integration

## 🎯 Rezumat Rapid

| Element | Locație | Funcție | Status |
|---------|---------|---------|--------|
| **Like Button** | Sub player | Trimite like în Supabase | ✅ |
| **Lower Third** | Overlay video | Animație realtime pe like | ✅ |
| **Ticker Text** | Sub player | Text care curge continuu | ✅ |
| **Supabase Client** | Script inline | Gestionează like-uri și Realtime | ✅ |

---

## 🚀 Setup — 3 Pași (5 min)

### 1️⃣ Rulează SQL

```sql
-- Copiază din: scripts/supabase-setup.sql
-- Paste în: Supabase Dashboard > SQL Editor > Run
```

### 2️⃣ Activează Realtime

```
Supabase Dashboard 
  → Realtime 
  → Add Table to Realtime 
  → Selectează "interactions" 
  → Enable
```

### 3️⃣ Test

```bash
npm run build        # Verifică build
```

**GATA!** ✨

---

## 📝 Fișiere

| Fișier | Rol |
|--------|-----|
| `src/pages/live.astro` | Pagina principală cu Like + Lower Third |
| `scripts/supabase-setup.sql` | Migration SQL pentru tabel |
| `SUPABASE-SETUP.md` | Ghid detaliat setup |
| `LIVE-PAGE-GUIDE.md` | Ghid complet cu demo |

---

## 🎮 Teste Rapide

| Test | Command | Expected |
|------|---------|----------|
| Like button | Click "❤️ Like" | Button scale-up + counter++ |
| Lower third | Wait | "❤️ Cineva a dat like!" apare 3s |
| Ticker | Auto | Text curge de la dreapta la stânga |
| Real-time | 2 tabs | Lower third sync pe ambele |

---

## 🔌 API Calls (în script)

### Insert Like
```javascript
await client
  .from('interactions')
  .insert([{ stream_id, type: 'like', created_at }])
```

### Load Count
```javascript
await client
  .from('interactions')
  .select('*', { count: 'exact', head: true })
  .eq('stream_id', streamId)
  .eq('type', 'like')
```

### Realtime Listener
```javascript
client
  .channel(`interactions:stream_id=eq.${streamId}`)
  .on('postgres_changes', { event: 'INSERT', table: 'interactions' }, callback)
  .subscribe()
```

---

## 🎨 CSS Classes

```css
/* Button */
.btn-like { border-red-500; bg-red-500/10; }

/* Lower Third */
#lower-third { absolute bottom-0; bg-black/90; backdrop-blur-sm; }

/* Ticker */
.live-main-ticker-track { animation: liveMainTicker 30s linear infinite; }

/* Animations */
@keyframes slideInLowerThird { opacity: 0→1; transform: translateY(20px→0); }
@keyframes slideOutLowerThird { opacity: 1→0; transform: translateY(0→20px); }
@keyframes liveMainTicker { transform: translateX(0→-50%); }
```

---

## 🐛 Debug Tips

```javascript
// Console logs
window.supabaseClient         // Verifică dacă client e loaded
localStorage.getItem('...')   // Check storage

// Check Lower Third
document.getElementById('lower-third').style.display  // Should be 'flex' when showing

// Check Counter
document.getElementById('like-count').textContent     // Should show "(N)"
```

---

## 📱 Responsive Breakpoints

```css
sm: 640px   ← Text ticker size changes
md: 768px   ← No major changes
lg: 1024px  ← Player max-width stays same
```

---

## ✅ Pre-Launch Checklist

- [ ] SQL migration rulată ✓
- [ ] Realtime activat ✓
- [ ] `npm run build` green ✓
- [ ] `/live/` loads fără erori ✓
- [ ] Like button clickable ✓
- [ ] Lower third apare ✓
- [ ] Ticker text se mișcă ✓
- [ ] Multi-tab sync works ✓

---

## 🆘 Help!

| Problemă | Soluție |
|----------|---------|
| Lower third nu apare | Verifică Realtime ON în Supabase |
| Like count static | Reload pagina sau verifica RLS |
| Ticker nu se mișcă | Reload CSS (`Ctrl+Shift+R`) |
| Supabase error | Check console F12 → Network |

---

## 📞 Contacts

- **Supabase Project**: `uhqujllxujfbyvwrafzn`
- **Database**: `interactions` tabel
- **Docs**: https://supabase.com/docs/reference/javascript/introduction

---

## 🎉 You're All Set!

Pagina Live e gata cu:
✨ Interactive Like button  
🔄 Real-time Supabase sync  
📺 TV-style Lower Third  
📜 Continuous Ticker text  

**Enjoy!** 🎵
