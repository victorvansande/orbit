# Iconen

Bron: `make_icons.py` schrijft de SVG's (`icon-*.svg` en `../favicon.svg`) uit het merk in `../src/core/mark.js` (merk v1, 02/11/2026, zie CLAUDE.md, Merk). `render_icons.mjs` rendert de PNG's met Chromium (Playwright); `../favicon.ico` komt uit de favicon-PNG's via Pillow.

```
python3 icons/make_icons.py
node icons/render_icons.mjs   # of PLAYWRIGHT=/pad/naar/playwright/index.mjs node icons/render_icons.mjs
python3 -c "from PIL import Image; i=[Image.open(f'icons/favicon-{s}.png') for s in (16,32,48)]; i[2].save('favicon.ico', sizes=[(16,16),(32,32),(48,48)], append_images=i[:2])"
```

| Bestand | Gebruik |
|---|---|
| `../favicon.svg` | Chrome, Firefox, Edge; past zich aan licht en donker aan |
| `../favicon.ico` | 16, 32 en 48 px voor oudere browsers en Windows |
| `apple-touch-icon.png` | iOS-thuisscherm, 180 px, transparant buiten het merk (liquid glass): baan middengrijs, kop amaranth. Let op: iOS vulde transparantie bij webiconen vroeger met zwart |
| `icon-192.png`, `icon-512.png` | Android en installeerbare app (`any`), transparant buiten de orbit-elementen |
| `icon-maskable-512.png` | Android adaptieve iconen (`maskable`), inhoud binnen de veilige cirkel van 80 % |
| `icon-monochrome-512.png` | Material You thema-iconen (`monochrome`), wit op transparant |
