# 📸 Sistemul Drop & Go — Imagini Automate

## Cum funcționează

Pune orice imagine (`.jpg`, `.jpeg`, `.png`, `.gif`) în unul din folderele de mai jos și ea va apărea automat pe site la următorul build. **Fără cod, fără config.**

## Structură foldere

```
src/assets/imagini-automate/
├── membri/
│   ├── florentina-pana/   ← pozele Florentinei
│   └── catalin/           ← pozele lui Cătălin
└── galerie-generala/      ← poze generice (atmosferă, echipament, etc.)
```

## Utilizare în orice pagină `.astro`

```astro
---
import GalerieAutomata from '../components/GalerieAutomata.astro';
---

<GalerieAutomata caleFolder="membri/florentina-pana" />
<GalerieAutomata caleFolder="galerie-generala" titlu="Atmosfera la evenimentele noastre" />
```

## Recomandări imagini

- **Format:** `.jpg` sau `.webp` (vor fi convertite automat de Astro).
- **Dimensiune:** minim 1200 px pe latura lungă.
- **Denumire:** fără spații, fără diacritice (ex: `florentina-scena-01.jpg`).
- **Greutate:** sub 3 MB per imagine (Astro optimizează oricum, dar originalul contează).
