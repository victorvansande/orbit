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
- **Commit:** `c5c1be0`
- **Vraag van Victor:** Verwijder bij het behalen van een nieuw achievement de schermvullende donker/wit-animatie die alle focus opeist. Laat in plaats daarvan de prestatiepil zelf duidelijk, verfijnd en smaakvol wit gloeien (geen typische vibecoded-gloed) en laat haar langer staan zodat ze zeker gelezen wordt.
- **Gewijzigde bestanden:**
  - `src/fx.js`: `export function spotlight(...)` verwijderd; `overlay()` blijft in dienst voor `softReveal` (intro) en `nightFall` (nieuwe ster).
  - `src/app.js`: Import van `spotlight`, evenals `activeSpot`, `lastSpot`, `.is-spot` en de `takeStage(4000)` voor het spotlicht verwijderd uit `showFeatPop()` en `hideFeatPop()`. De pil wacht nog altijd via `whenCalm(..., 1)` tot een lopende `nightFall`, nieuwe ster of sterrenbeeld klaar is. Zichtbaarheidsduur verhoogd naar `FEAT_POP_MS = 7200` (`7,2 s`); `pointerenter` op `#feat-pop` pauzeert de timer en `pointerleave` hervat met `2,4 s` respijt; een klik op `#feat-pop` sluit meteen de pil en opent `#feats`.
  - `src/styles.css`: Tokens `--feat-top`, `--feat-bg`, `--feat-rim-hi`, `--feat-rim-lo`, `--feat-sweep`, `--feat-glow` en `--feat-glow-peak` toegevoegd op `:root` en `:root[data-theme="dark"]` (geen losse kleuren, geen `filter: blur`, geen oneindige pulslus). `.feat-pop` opgebouwd met een porseleinen verloop (`padding-box`) binnen een asymmetrisch van boven aangelichte `1 px` parelrand (`border-box`), vier lagen Gaussisch wit lichtverloop (in donker met spreiding `0` tot `-4 px` om een harde kraag of 8-bit band te vermijden; in licht met zuiver witte rand en wit halo dat de papierkorrel zacht oplost zonder grijze onderlijn), een eenmalige zachte opbloei bij aankomst (`feat-halo`, `2,1 s`) en een subtiele diagonale parelglans achter de tekst (`feat-sheen`, `1,45 s`, `z-index: 0` onder `.feat-pop > *`). Alles uitgeschakeld onder `prefers-reduced-motion: reduce`.
  - `CLAUDE.md`: Gedocumenteerd onder `## Regisseur: één groot moment tegelijk`, `## Prestaties (\`src/feats.js\`)` en `## Overdracht`.
- **Getest:** Visueel gecontroleerd op echte 2x DPR screenshots in donker (`#0F0F12`) en licht (`#F1F1EF`) bij zowel piek/glans (`+380 ms`) als rustgloed (`+2,45 s`), plus mobiel `375x812` (`fx = 'all'`, EN): console foutloos, geen `.fx-reveal` spotlicht bij prestaties, pil nog zichtbaar op `6,0 s` en netjes gesloten op `7,85 s`, hover pauzeert het sluiten, en ongedaan maken (`Z` / knop) trekt de prestatie in en verbergt `#feat-pop`.
- **Impact op opslag / state:** Geen.

### 5. Nu-taken afvinken in Focus (met ongedaan-maken-pil) en langere, versnellende intro-cirkel
- **Commit:** `78b94f9`
- **Vraag van Victor:**
  1. Implementeer in Focusmodus variant A voor de `Nu`-taken linksboven, maar zonder vastpinnen: enkel rechtstreeks kunnen afvinken, met dezelfde ongedaan-maken-pil (`#toast`) als op het gewone scherm.
  2. Laat de openingsanimatie bij het inladen van de site (`softReveal`, de cirkel vanuit het midden) iets langer duren, net iets trager beginnen en zacht versnellen naar het einde toe zodat ze meer leeft.
- **Gewijzigde bestanden:**
  - `src/app.js`: `renderFocusNow()` bouwt elke `Nu`-taak met `<button type="button" class="fn-check">` (`CHECK_SVG`, klik roept `complete(t.id, li)` aan) en `<span class="fn-title">` (geen klik/pin op de titel). `complete(id, row)` meet `.t-check, .fn-check` zodat de gekromde vonk vanuit `.fn-check` naar de draaiende `Nu`-komeet vliegt, slaat synchrone `renderFocusNow()` over zolang `body.is-focus` actief is zodat `li.is-done` gedurende `DONE_MS` (`320 ms`) zijn vinkje en uitschuifanimatie afspeelt, en werkt `#focus-now` na `DONE_MS` bij. `showToast()` roept `bumpIdle()` aan en pauzeert `toastTimer` op `pointerenter` (`2000 ms` respijt na `pointerleave`), zodat de ongedaan-maken-pil ook in Focusmodus comfortabel aan te klikken is. Bij opstart zijn `revealDelay` (`800 ms`), `takeStage(3000)` en de vertraging voor `openIntro` (`+650 ms`) afgestemd op de langere openingsanimatie.
  - `src/styles.css`: `.fn-check` (`30 x 30 px` klikvlak, `pointer-events: auto` onder `body.is-focus`) toont in rust dezelfde tapse `--core`-komeet (`::before` staart met `transform-origin: right center` + `::after` `6 x 6 px` kop); bij `:hover` of `:focus-visible` trekt de staart volledig in de kop (`opacity: 0; transform: translateX(-5px) scaleX(.3)`) en opent de kop tot een zuivere holle `16 x 16 px` afvinkcirkel; op `li.is-done` vult de cirkel zich met `--core` + wit vinkje terwijl de rij naar rechts wegglijdt. `body.is-idle:not(:has(.toast.is-on, .feat-pop.is-on))` houdt de muiscursor zichtbaar zolang `#toast` of `#feat-pop` open staat. Op mobiel (`@media (max-width: 999px)`) staat `overflow: hidden; text-overflow: ellipsis` op `.fn-title` en `.focus-more` zodat `.fn-check` niet afgesneden wordt. Nieuwe overgangen toegevoegd aan `@media (prefers-reduced-motion: reduce)`.
  - `src/fx.js`: `softReveal()` duurt zichtbaar langer (`START = 0.08 s`, `END = 1.96 s`, `1,88 s` uitwaaiering) tot exact de verste viewporthoek vanaf `(cx, cy)` (`farR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + soft`, zodat geen deel van de curve buiten beeld verloren gaat). Nieuwe curve `easeReveal(u) = 0.2 * u + 0.8 * Math.pow(u, 2.35)` begint rustig rond de kern en versnelt vloeiend richting de buitenste schillen en hoeken, met een zachte 5-staps radiale rand (`STOPS`, `soft = Math.max(135, Math.min(W, H) * 0.19)`) en geleidelijke kernopbloei (`smoothstep(0, soft * 0.5, R)`). Klik of toets spoelt nog altijd netjes door.
  - `src/i18n.js`: `intro.focusText` in `nl` en `en` bijgewerkt zodat vermeld wordt dat `Nu`/`Now`-taken in Focus meteen afgevinkt kunnen worden.
  - `CLAUDE.md`: Gedocumenteerd onder `## Effecten (naar React Bits Pro)`, `## Interactie in de lijst en het venster` en `## Overdracht`.
- **Getest:** Headless Edge + 2x DPR visuele screenshotcontrole op desktop `1440x900` (donker/licht, NL) en mobiel `375x812` (donker, EN, `fx = 'all'`): console foutloos, `softReveal` zichtbaar actief op `~1,55 s` en klaar op `~2,3 s` (skip werkt), geen pinning/dimming bij klik op titel, holle afvinkcirkel zonder zichtbare staartpunt, `li.is-done` vinkje + wegglijden + `#toast` met zichtbare cursor onder `is-idle`, en `#undo` herstelt de `Nu`-taak rechtstreeks in Focusmodus.
- **Impact op opslag / state:** Geen.

### 6. Prestatiepil ingelaten in het papier (zoals fidget/zandloper) met minimalistische zachte cirkelgloed
- **Vraag van Victor:** De parelgloed uit commit `c5c1be0` oogde te realistisch en AI-achtig (3D-verloop, felle rand, glansstreep). Pas haar aan naar een minimalistische gloed in de stijl van de zachte cirkel (optie A in donker thema, optie A3 zachte inktcirkel als tonale spiegel in licht thema omdat puur wit op licht papier wegvalt) en toon de prestatiepil ingebed/ingelaten in de pagina zoals het fidget-venster op het focusscherm.
- **Gewijzigde bestanden:**
  - `src/styles.css`: Oude 3D-pareltokens (`--feat-top`, `--feat-bg`, `--feat-rim-hi`, `--feat-rim-lo`, `--feat-sweep`, `--feat-glow`, `--feat-glow-peak`) en `feat-sheen` / `feat-halo` verwijderd. Nieuwe tokens `--feat-well` (`#E4E4E0` op `:root`, `var(--well)` `#0A0A0D` op `:root[data-theme="dark"]`) en `--feat-aura` (5-staps radiaal verloop: zachte grafietnevel tot `0,135` in licht thema A3, zachte witte nevel tot `0,155` in donker thema A) toegevoegd. `.feat-pop::after` tekent het ingelaten kapsel met exact dezelfde `inset 0 1.5px 3px var(--well-shade), inset 0 1px 1px var(--well-shade-2), 0 1px 0 var(--well-lip)` als `.fidget` en `.timer`. `.feat-pop::before` (`inset: -40px -72px; border-radius: 50%`) legt daarachter het zachte radiale lichtveld (`feat-aura`, `1,6 s backwards`, bij hover `scale(1.07)`, uitgeschakeld onder `prefers-reduced-motion: reduce`).
  - `CLAUDE.md`: Gedocumenteerd onder `## Regisseur: één groot moment tegelijk`, `## Prestaties (\`src/feats.js\`)` en `## Overdracht`.
- **Getest:** Headless Edge + 2x DPR visuele screenshotcontrole op desktop `1440x900` (donker en licht, in Focusmodus rechtstreeks naast `#timer` en `#fidget`) en mobiel `375x812` (donker en licht): console foutloos, geen horizontale scroll (`scrollWidth === innerWidth`), hover-schaal werkt na afloop van de opkomstanimatie, en klik opent `#feats`.
- **Impact op opslag / state:** Geen.


---

## 31/10/2026

### 7. Taken verwijderen zonder afvinken (swipe naar links & discreet prullenbakje)
- **Vraag van Victor:** Er moet een manier zijn om taken uit de lijst te verwijderen zonder ze af te vinken en als 'complete' te behandelen (geen punten of sterren). Victor koos optie 2: een rustig, minimalistisch prullenbak-icoontje naast het niveaubolletje bij hover of een zachte swipe naar links, zonder visuele botsingen met andere rij-elementen.
- **Gewijzigde bestanden:**
  - `src/i18n.js`: Sleutels `'task.delete'` en `'toast.deleted'` toegevoegd in zowel `NL` als `EN`.
  - `src/styles.css`: Grid van `.track` uitgebreid met een discrete 30 px actiekolom voor `.t-del-btn`. Knopje heeft 0 opacity in rust, verschijnt soepel naast `.t-level` of `.t-due` bij hover op desktop, kleurt zacht `var(--late)` bij hover en krimpt bij inklikken. Op touch (`hover: none`) blijft de kolom standaard 0 px breed en toont ze zich na een zachte swipe (`.is-swiped`). `.track.is-deleted` animeert de rij soepel weg (vervagen en inkrimpen van hoogte en padding).
  - `src/app.js`: Inline SVG `TRASH_SVG` in de minimalistische Orbit-lijnlay-out (16x16, stroke 1.3). `deleteTask(id, row)` verwijdert de taak zonder sterren, prestaties of archiefopname, registreert de id in `gone` en `archDel`, toont de toast met "Ongedaan maken", en herstelt de taak bij een klik op de toastknop of toets `Z`. `attachSwipe` verzorgt een soepele 1:1 hardwarematige veegbeweging (zachte swipe ~36 px opent de actieknop, doortrekken > 80 px verwijdert direct, verticale scrolls worden direct vrijgegeven). `applyState` sluit verwijderde taken expliciet uit van `lost` bij synchronisatie.
  - `CLAUDE.md`: Bijgewerkt onder `## Interactie in de lijst en het venster`.
- **Impact op opslag / state:** Registreert verwijderingen in `archDel` en `gone` zodat synchronisatie en backups de taak niet abusievelijk herstellen. Verwijderde taken komen bewust niet in `archive` of `done`.
- **Verfijning animatie (31/10/2026):** Verwijderanimatie opgesplitst in twee natuurlijke fasen: eerst een strakke horizontale uitschuifbeweging naar links (180 ms), gevolgd door een FLIP-animatie (First-Last-Invert-Play) waarbij onderliggende taken direct en vloeiend omhoog glijden met translateY zonder dubbele schokken. Tijdelijke pointerlock en onmiddellijke stijlopruiming voorkomen dat het prullenbak-icoontje op een vervangende taak tweemaal knippert.
- **Mobiel prioriteit:** Werkafspraak toegevoegd in CLAUDE.md dat mobiel te allen tijde de eerste prioriteit is bij nieuwe toepassingen en interacties (touch-gebaren, hardwareversnelling en comfortabele trefzones).

### 8. Subtiel meer witruimte tussen teller en prestatieregel
- **Commit:** 1414379
- **Vraag van Victor:** Zet een heel klein beetje meer ruimte tussen de stars collected regel en de achievements status regel, echt maar een beetje.
- **Gewijzigde bestanden:**
  - `src/styles.css`: `margin-top: 13px` toegevoegd op `.feats-badge` (was voorheen de standaard inline/tekststroom zonder marge).

### 9. Vaste afvinkknop links en inspringende inhoud bij hover (Voorstel A)
- **Vraag van Victor:** Doordat een taak nu naar links schoof bij hover op pc om de prullenbak te tonen, viel het bolletje om de taak af te vinken volledig buiten beeld. Victor koos Voorstel A om dit op te lossen.
- **Gewijzigde bestanden:**
  - `src/styles.css`: `.track` is nu een twee-koloms grid (`grid-template-columns: 30px 1fr`). `.track-row` bevat enkel de inhoud (titel, notitieknop, niveau/deadline). Op hover/swipe krijgt `.track-row` `padding-right: 36px` in plaats van een negatieve `transform: translateX(-36px)`. Hierdoor veert de inhoud links nergens naar buiten, maar schuift het niveau-icoontje 36 px naar binnen om plaats te maken voor `.t-del-btn`.
  - `src/app.js`: In `trackRow(t)` is `.t-check` direct als eerste kind van `li.track` geplaatst, verankerd in de 30 px linkerkolom. Bij `attachSwipe` wordt tijdens swipe-open `paddingRight = '36px'` gebruikt. Bij `deleteTask` glijden `.t-check` en `.track-row` samen soepel naar links weg waarna de onderliggende taken vloeiend omhoog glijden.
- **Getest:** Desktop (1440x900) en mobiel (375x812), donker en licht thema. Afvinkbolletje blijft 100% stabiel en perfect zichtbaar bij hover. Prullenbakje verschijnt discreet rechts. Verwijderen en FLIP-animatie blijven zijdezacht. Geen consolefouten, geen horizontale scroll.
- **Impact op opslag / state:** Geen.
