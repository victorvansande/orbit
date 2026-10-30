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
- **Commit:** `10fa88d`
- **Vraag van Victor:**
  1. Zet in de kernmeldingen de taak tussen aanhalingstekens om te onderscheiden waar de naam van de taak stopt en de bijhorende melding begint.
  2. Verduidelijk "One thing is due today" in het Engels naar "One thing has a deadline today", omdat "due today" verwarrend is wanneer er meerdere taken in de schillen Now en Today draaien.
- **Gewijzigde bestanden:**
  - `src/greet.js`: Alle 20 plekken waar `{title}` voorkomt in `LINES` (`stuck`, `dusty`) en `CORE` (`late`, `today`, `stuck`, `next`) voor zowel `nl` als `en` voorzien van rechte aanhalingstekens `"{title}"` (zelfde conventie als in `src/i18n.js`). In `LINES.en` `dueToday1` en `dueToday` gewijzigd van `is/are due today` naar `has/have a deadline today` (sluit exact aan op het Nederlandse `heeft/hebben vandaag een deadline`).
  - `CLAUDE.md`: Gedocumenteerd onder `## Kerngezicht en begroeting` en `## Overdracht`.
- **Getest:** Headless Edge op 1440x900 en 375x812, licht en donker thema, NL en EN: console foutloos, geen horizontale scroll (`scrollWidth === innerWidth`), begroeting en kernzinnen passen op hooguit 2 regels op 375 px.
- **Impact op opslag / state:** Geen.

### 3. Taaknaam bij enkele deadline/over-tijd-begroeting en taps uitlopende wielboog op gsm
- **Vraag van Victor:**
  1. Voer de suggestie uit voor `'"..." has a deadline today. I am keeping an eye on it.'` bij één taak, en pas vanaf twee taken `"{n} tasks have a deadline today..."` (ook voor NL en voor over tijd).
  2. Voer voor de wielboog op gsm optie B uit, maar enkel de boog die dunner wordt naar de uiteinden, niet de extra lijstscheiding onder `TASKS`.
- **Gewijzigde bestanden:**
  - `src/greet.js`: `dueToday1` en `overdue1` noemen in NL en EN de taak meteen tussen aanhalingstekens (`"{title}" heeft vandaag een deadline...` / `"{title}" has a deadline today...`), met `dueToday1Anon` en `overdue1Anon` (`Eén taak...` / `One task...`) als veilige terugval als er geen titel meegegeven wordt. Vanaf 2 taken gebruiken `dueToday` en `overdue` nu `{n} taken...` / `{n} tasks...` in plaats van `dingen` / `things`.
  - `src/app.js`: `greet()` berekent `overdueList` en `dueTodayList` en geeft bij lengte 1 `overdueTitle` en `dueTodayTitle` mee aan `greeting()`.
  - `index.html`: `<defs><linearGradient id="wheel-arc-grad" gradientUnits="userSpaceOnUse">` met vijf stops (`0%` -> `0`, `28%` -> `.22`, `50%` -> `.28`, `72%` -> `.22`, `100%` -> `0`) toegevoegd in `<svg class="wheel-arc">`.
  - `src/styles.css`: Token `--arc-ink` toegevoegd op `:root` (`#1B1B22`) en `:root[data-theme="dark"]` (`#FFFFFF`). `.wheel-arc stop` gebruikt `stop-color: var(--arc-ink)` en `.wheel[data-orientation="horizontal"] .wheel-arc path` gebruikt `fill: url(#wheel-arc-grad); stroke: none;`. Onder `@media (max-width: 999px)` is `.wheel` verhoogd van `138px` naar `148px` (zodat de neerwaartse punten van de boog nooit door `overflow: hidden` afgesneden worden) en de bovenpadding van `.tracks` verlaagd van `14px` naar `6px`. `.tracks-head` heeft bewust geen extra rand gekregen.
  - `src/wheel.js`: `GEOM.horizontal.arc` verhoogd van `20` naar `30` (zodat `box.height - g.arc` exact `118px` blijft en geen enkel wiel-item verschuift). In `layout()` wordt bij `o === 'horizontal'` een gesloten taps vlak (`cos^1.35 * 0.85` tot `0`, `halfW` begrensd op `cx - 16` en max. valhoogte `g.arc - 2`) getekend en `#wheel-arc-grad` bijgewerkt; bij `o === 'vertical'` blijft de desktopboog ongewijzigd.
  - `CLAUDE.md`: Gedocumenteerd onder `## Wiel (\`src/wheel.js\`)`, `## Kerngezicht en begroeting` en `## Overdracht`.
- **Getest:** Headless Edge op 1440x900, 320x568, 375x812 en 430x932 in licht en donker thema, NL en EN: console foutloos, geen horizontale scroll, boog op gsm overal ruim binnen `.wheel` (vrijwaring 13,05 px op 320 px, 5,81 px op 375 px, 2,00 px op 430 px), desktopboog ongewijzigd, geen rand onder `.tracks-head`, en live `greet()` met 1 deadline vandaag toont de taaknaam op hooguit 2 regels.
- **Impact op opslag / state:** Geen.
