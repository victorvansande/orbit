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
- **Commit:** `d6e1261`
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

### 4. Prestatiepil zonder schermvullend spotlicht, met verfijnde witte parelgloed en langere duur
- **Vraag van Victor:** Verwijder bij het behalen van een nieuw achievement de schermvullende donker/wit-animatie die alle focus opeist. Laat in plaats daarvan de prestatiepil zelf duidelijk, verfijnd en smaakvol wit gloeien (geen typische vibecoded-gloed) en laat haar langer staan zodat ze zeker gelezen wordt.
- **Gewijzigde bestanden:**
  - `src/fx.js`: `export function spotlight(...)` verwijderd; `overlay()` blijft in dienst voor `softReveal` (intro) en `nightFall` (nieuwe ster).
  - `src/app.js`: Import van `spotlight`, evenals `activeSpot`, `lastSpot`, `.is-spot` en de `takeStage(4000)` voor het spotlicht verwijderd uit `showFeatPop()` en `hideFeatPop()`. De pil wacht nog altijd via `whenCalm(..., 1)` tot een lopende `nightFall`, nieuwe ster of sterrenbeeld klaar is. Zichtbaarheidsduur verhoogd naar `FEAT_POP_MS = 7200` (`7,2 s`); `pointerenter` op `#feat-pop` pauzeert de timer en `pointerleave` hervat met `2,4 s` respijt; een klik op `#feat-pop` sluit meteen de pil en opent `#feats`.
  - `src/styles.css`: Tokens `--feat-top`, `--feat-bg`, `--feat-rim-hi`, `--feat-rim-lo`, `--feat-sweep`, `--feat-glow` en `--feat-glow-peak` toegevoegd op `:root` en `:root[data-theme="dark"]` (geen losse kleuren, geen `filter: blur`, geen oneindige pulslus). `.feat-pop` opgebouwd met een porseleinen verloop (`padding-box`) binnen een asymmetrisch van boven aangelichte `1 px` parelrand (`border-box`), vier lagen Gaussisch wit lichtverloop (in donker met spreiding `0` tot `-4 px` om een harde kraag of 8-bit band te vermijden; in licht met zuiver witte rand en wit halo dat de papierkorrel zacht oplost zonder grijze onderlijn), een eenmalige zachte opbloei bij aankomst (`feat-halo`, `2,1 s`) en een subtiele diagonale parelglans achter de tekst (`feat-sheen`, `1,45 s`, `z-index: 0` onder `.feat-pop > *`). Alles uitgeschakeld onder `prefers-reduced-motion: reduce`.
  - `CLAUDE.md`: Gedocumenteerd onder `## Regisseur: één groot moment tegelijk`, `## Prestaties (\`src/feats.js\`)` en `## Overdracht`.
- **Getest:** Visueel gecontroleerd op echte 2x DPR screenshots in donker (`#0F0F12`) en licht (`#F1F1EF`) bij zowel piek/glans (`+380 ms`) als rustgloed (`+2,45 s`), plus mobiel `375x812` (`fx = 'all'`, EN): console foutloos, geen `.fx-reveal` spotlicht bij prestaties, pil nog zichtbaar op `6,0 s` en netjes gesloten op `7,85 s`, hover pauzeert het sluiten, en ongedaan maken (`Z` / knop) trekt de prestatie in en verbergt `#feat-pop`.
- **Impact op opslag / state:** Geen.
