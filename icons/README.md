# Iconen

Bron: `make_icons.py` schrijft de SVG's (`icon-*.svg` en `../favicon.svg`). De PNG's en `../favicon.ico` zijn daaruit gerenderd (Chromium voor de PNG's, Pillow voor de ICO).

| Bestand | Gebruik |
|---|---|
| `../favicon.svg` | Chrome, Firefox, Edge; past zich aan licht en donker aan |
| `../favicon.ico` | 16, 32 en 48 px voor oudere browsers en Windows |
| `apple-touch-icon.png` | iOS-thuisscherm, 180 px, vol vlak zonder transparantie (iOS rondt af en legt liquid glass erover) |
| `icon-192.png`, `icon-512.png` | Android en installeerbare app (`any`), eigen afgeronde vorm |
| `icon-maskable-512.png` | Android adaptieve iconen (`maskable`), inhoud binnen de veilige cirkel van 80 % |
| `icon-monochrome-512.png` | Material You thema-iconen (`monochrome`), wit op transparant |
