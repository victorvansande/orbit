# Antigravity Wijzigingslogboek (Co-work met Claude Code)

Dit bestand houdt alle wijzigingen bij die zijn uitgevoerd met Antigravity. Zo kunnen Victor en Claude Code bij het hervatten van Claude's weeklimiet eenvoudig controleren wat er precies is aangepast, welke bestanden geraakt zijn en welke afwegingen zijn gemaakt.

---

## 29/10/2026

### 1. Tandwielicoon op instellingenknop
- **Commit:** `4af9591`
- **Vraag van Victor:** Maak van het witte bolletje naast 'settings' een klein tandwielicoontje in plaats van het bolletje.
- **Gewijzigde bestanden:**
  - `index.html` (regel ~94): `<span class="sync-dot">` in `#menu-btn` vervangen door een inline SVG `<svg class="menu-gear">` (viewBox 0 0 24 24, 12x12 px, stroke 1.6, afgeronde hoeken).
  - `src/styles.css`: Styling voor `.menu-gear` toegevoegd (`stroke: currentColor`). De verbindingsindicatie blijft behouden via statusselectoren: bij `data-status="connecting"` pulseert het tandwieltje zacht via `sync-blink`, bij `data-status="offline"` kleurt het tandwieltje `var(--late)`. Oude mobiele regels voor `.menu-btn .sync-dot` opgeruimd.
  - `CLAUDE.md`: Sectie `## Instellingen` en `## Overdracht` bijgewerkt conform werkafspraken.
- **Impact op opslag / state:** Geen. Geen localStorage- of dataformaat-wijzigingen.
- **Aandachtspunten voor Claude:** De synchronisatiedot (`.sync-dot`) in `#sync-btn` (knop 'Koppelen' in het menu) is ongewijzigd gebleven; enkel het knopje op het hoofdscherm toont nu het tandwieltje.

---

## 30/10/2026

### 2. Aanhalingstekens rond taaknamen en duidelijke Engelse deadline-begroeting
- **Vraag van Victor:**
  1. Zet in de kernmeldingen de taak tussen aanhalingstekens om te onderscheiden waar de naam van de taak stopt en de bijhorende melding begint.
  2. Verduidelijk "One thing is due today" in het Engels naar "One thing has a deadline today", omdat "due today" verwarrend is wanneer er meerdere taken in de schillen Now en Today draaien.
- **Gewijzigde bestanden:**
  - `src/greet.js`: Alle 20 plekken waar `{title}` voorkomt in `LINES` (`stuck`, `dusty`) en `CORE` (`late`, `today`, `stuck`, `next`) voor zowel `nl` als `en` voorzien van rechte aanhalingstekens `"{title}"` (zelfde conventie als in `src/i18n.js`). In `LINES.en` `dueToday1` en `dueToday` gewijzigd van `is/are due today` naar `has/have a deadline today` (sluit exact aan op het Nederlandse `heeft/hebben vandaag een deadline`).
  - `CLAUDE.md`: Gedocumenteerd onder `## Kerngezicht en begroeting` en `## Overdracht`.
- **Getest:** Headless Edge op 1440x900 en 375x812, licht en donker thema, NL en EN: console foutloos, geen horizontale scroll (`scrollWidth === innerWidth`), begroeting en kernzinnen passen op hooguit 2 regels op 375 px.
- **Impact op opslag / state:** Geen.
