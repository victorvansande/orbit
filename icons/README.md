# Iconen

Bron: `make_icons.py` schrijft de SVG's (`icon-*.svg` en `../favicon.svg`). `render_icons.mjs` rendert de PNG's met Chromium (Playwright); `../favicon.ico` komt uit de favicon-PNG's via Pillow.

```
python3 icons/make_icons.py
node icons/render_icons.mjs   # of PLAYWRIGHT=/pad/naar/playwright/index.mjs node icons/render_icons.mjs
```

| Bestand | Gebruik |
|---|---|
| `../favicon.svg` | Chrome, Firefox, Edge; past zich aan licht en donker aan |
| `../favicon.ico` | 16, 32 en 48 px voor oudere browsers en Windows |
| `apple-touch-icon.png` | iOS-thuisscherm, 180 px, transparant buiten de orbit-elementen (liquid glass). Let op: iOS vulde transparantie bij webiconen vroeger met zwart |
| `icon-192.png`, `icon-512.png` | Android en installeerbare app (`any`), transparant buiten de orbit-elementen |
| `icon-maskable-512.png` | Android adaptieve iconen (`maskable`), inhoud binnen de veilige cirkel van 80 % |
| `icon-monochrome-512.png` | Material You thema-iconen (`monochrome`), wit op transparant |
