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

### 10. Lange to-do titels op één regel met zachte analoge nevel (Variant 3)
- **Vraag van Victor:** Doordat tekst van langere to-do's werd afgebroken naar een andere regel, namen taken dubbel zoveel verticale ruimte in beslag. Victor vroeg om de taak af te kappen en het einde wat te vervagen als er te weinig ruimte is voor de icoontjes rechts, en koos na voorlegging van drie varianten in een interactief artifact voor Variant 3 (zachte analoge nevel zonder leestekens).
- **Gewijzigde bestanden:**
  - `src/styles.css`: `.t-title` voorzien van `white-space: nowrap; overflow: hidden; text-overflow: clip; min-width: 0;` en een lineair vervagingsmasker over de laatste 34 px (`mask-image: linear-gradient(to right, black calc(100% - 34px), transparent 100%)`). `.track-row` en `.track.has-due .track-row` gebruiken nu `minmax(0, 1fr)` voor de titelkolom en `.t-edit` heeft `min-width: 0` zodat lange teksten het raster nooit meer horizontaal kunnen opblazen.
  - `src/app.js`: In `trackRow(t)` toont de tooltip (`title.title`) nu de volledige titel inclusief de dubbelklik-instructie (`${t.title} · ${tx('task.dbl')}`), zodat afgekapte titels altijd volledig leesbaar zijn bij hoveren.
- **Getest:** Desktop (1440x900) en mobiel (375x812), donker en licht thema. Lange taken blijven exact 42 px hoog. Tekst lost aan het rechteruiteinde natuurlijk en zacht op naar transparant. Volledige tekst toont in de tooltip. Geen horizontale scroll, console foutloos.
- **Impact op opslag / state:** Geen.

### 11. Swipe-to-reveal only op mobiel (Voorstel 1)
- **Vraag van Victor:** Het naar links swipen op gsm om iets te deleten was net iets te gevoelig, waardoor taken te gemakkelijk per ongeluk werden verwijderd tijdens het scrollen of bij een snelle veeg. Victor koos Voorstel 1 (swipe-to-reveal only).
- **Gewijzigde bestanden:**
  - `src/app.js`: In `attachSwipe` verwijdert een veegbeweging nooit meer direct een taak (de drempel `final <= -80` is verwijderd). Een veeg naar links opent altijd uitsluitend het prullenbakje (`is-swiped`, `padding-right: 36px`). Daadwerkelijk verwijderen gebeurt uitsluitend door bewust op het geopende prullenbakje te tikken. Bovendien is de bewegingsvergrendeling aangescherpt (`|dx| > 10px` en `|dx| > 1.5 * |dy|`), zodat verticaal scrollen door de lijst de taak niet meer per ongeluk horizontaal vergrendelt.
- **Getest:** Gesimuleerd op 375x812 en met touch-events. Diagonaal scrollen scrolt de pagina zonder swipe. Doortrekken veert zacht elastisch mee en blijft netjes op het prullenbakje staan zonder te wissen. Tikken op het prullenbakje verwijdert de taak met de vertrouwde soepele FLIP-animatie. Tikken elders sluit het prullenbakje.
- **Impact op opslag / state:** Geen.

### 12. Directe weergave lava-widget in Focusmodus (intro direct op 1)
- **Vraag van Victor:** Soms laadde de lava widget niet meteen in (toonde als een leeg zwart vak met enkel de lampgloed onderaan, zoals zichtbaar in Victors screenshot).
- **Oorzaak:** In `src/fidget.js` zette `lava()` aan het einde van `init()` (na 400 opwarmstappen) `intro = 0`. Hierdoor hadden alle 13 bollen en de bodemplas bij het openen van de focusmodus een straal van 0 px en groeiden ze pas over 1,3 seconden langzaam in via de simulatiestappen. Wanneer stappen nog niet direct getikt hadden of bij pauze, bleef het vak leeg.
- **Gewijzigde bestanden:**
  - `src/fidget.js`: `intro` staat nu standaard direct op 1 (ook na `init()`, de lamp brandt immers al). Hierdoor rendert de lava vanaf het allereerste frame direct op volle grootte en met alle klonten en bodemplas compleet zichtbaar. Daarnaast is een WebGL-contextcheck toegevoegd (`prog.gl !== gl`) en wordt de DPR-canvasresolutie (`cvGL.width / cvGL.height`) direct gesynchroniseerd in `render()`.
- **Getest:** Desktop focusmodus geopend in licht en donker thema: de lavalamp toont vanaf frame 1 direct alle warme bollen en de vloeibare bodemplas zonder enige vertraging of leeg scherm.
- **Impact op opslag / state:** Geen.

### 13. Inspringende inhoud tijdens swipe op mobiel (Voorstel 1)
- **Vraag van Victor:** Als je naar links swipet op een taak om ze te verwijderen, ging de tekst van de to-do over het linker afvink-bolletje. Victor koos Voorstel 1 (inspringende inhoud) om dit op te lossen en te verfijnen.
- **Oorzaak:** Tijdens de live sleepbeweging verschoof `.track-row` fysiek naar links via `translateX`, waardoor de tekst van de titel de 30 px linkerkolom van het afvinkbolletje in schoof en over het cirkeltje liep.
- **Gewijzigde bestanden:**
  - `src/app.js`: In `attachSwipe` beweegt `.track-row` tijdens het slepen niet meer naar links via `translateX`. In plaats daarvan groeit `padding-right` 1:1 dynamisch mee met de vinger (0 tot 36 px, met zachte elastische begrenzing). Het niveaubolletje en eventuele notitieknop schuiven onder de vinger naar links en trekken het prullenbakje tevoorschijn, terwijl het afvinkbolletje en het begin van de titel rotsvast links blijven staan. Hierdoor kan de tekst het afvinkbolletje fysiek nooit meer raken of overlappen.
- **Getest:** Gesimuleerd en geverifieerd op mobiele formaten (375x812 en 320x568). Live slepen laat de inhoud strak naar binnen veren, tekst blijft volledig binnen kolom 2, nul overlap met `.t-check`, prullenbakje opent soepel.
- **Impact op opslag / state:** Geen.


### 14. Sierlijkere komeetstaarten in Zen-modus (Voorstel 2)
- **Vraag van Victor:** Kan je de staarten van de orbs in de rustigere tussenmode iets langer maken? Victor koos Voorstel 2 (~75% van normale lengte) na interactieve demonstratie in `zen-orb-tails-options.html`.
- **Oorzaak:** In `src/scene.js` werd de staartlengte berekend als `Math.min(2.5, v / cruise)`. In normale modus is `v / cruise ≈ 1`. In Zen-modus draaien de bollen op een lagere snelheid (`sp = zenFactor(lv) ≈ 0.14 - 0.21`), waardoor de staartlengte tot ~20% kromp en slechts een kort stompje vormde.
- **Gewijzigde bestanden:**
  - `src/scene.js`: In `TEMPO` is de eigenschap `tail: 0.75` toegevoegd aan `zen` (en `tail: 1` aan `normaal`). In `drawOrb` wordt de verhouding berekend ten opzichte van de actieve kruissnelheid (`(v / (cruise * sp)) * zenTailScale`). Hierdoor behouden de bollen in Zen-modus een elegante staart van ~75% van de normale lengte, terwijl dynamische versnellingen (zoals binnenvliegen of overspringen) nog steeds natuurlijk mee opzwelgen.
- **Getest:** Gecontroleerd in zowel normale, zen- als stilstandmodus. Normale modus blijft identiek (100% lengte), stilstand heeft geen staart, en Zen-modus toont de gekozen langere, sierlijke komeetstaart.
- **Impact op opslag / state:** Geen.

### 15. Oplossing overflow instellingenpaneel op mobiel
- **Vraag van Victor:** "Dit valt buiten het window en is een bug" met schermafbeelding van het instellingenpaneel op mobiel waar het woord `GESYNCHRONISEERD` buiten de rechterrand van de dialoogkaart stak.
- **Oorzaak:** In de kopbalk op mobiel wordt `.hud-actions` in `#hud-menu` geplaatst. Doordat vier knoppen (`PRESTATIES / UITLEG / ARCHIEF / ● GESYNCHRONISEERD`) op één enkele regel zonder afbreking stonden, nam de regel ~400 px in beslag. Op mobiele schermen (375 px of smaller met 16 px schermmarge en padding) was er slechts ~315 px beschikbaar, waardoor de tekst aan de rechterkant uitbrak.
- **Gewijzigde bestanden:**
  - `src/styles.css`: Voor `.topbar .hud-menu .hud-actions` is `flex-wrap: wrap` toegevoegd met `row-gap: 8px`. De laatste scheidingsslash (`.slash:last-of-type`) wordt op mobiel verborgen. `#sync-btn` breekt daardoor netjes af naar een eigen volle breedte onderaan met `border-top: 1px dashed var(--line)` en `padding-top: 8px`.
  - Hierdoor staat `PRESTATIES / UITLEG / ARCHIEF` perfect gecentreerd/uitgelijnd op regel 1 (breedte ~180 px), en staat `● GESYNCHRONISEERD` ruim en comfortabel op regel 2 zonder dat er ook maar één pixel buiten de rand valt. Desktop (`.hud-right`) blijft ongewijzigd op één strakke regel.
- **Getest:** Getest op 375 px (iPhone standaard) en 320 px (iPhone SE klein). Tekst blijft 100% binnen het paneel, acties blijven direct aantikbaar en sluiten het menu zoals voorheen.
- **Impact op opslag / state:** Geen.


### 16. Vloeiende S-curve verbindingslijn tussen orb en hover-label (Voorstel 1)
- **Vraag van Victor:** De verbinding tussen een orb en haar beschrijving zag er bij hoveren soms wat glitchy of te scherp afgesneden uit. Victor vroeg naar alternatieven en koos Voorstel 1 (Vloeiende S-curve).
- **Oorzaak:** In `src/scene.js` (`drawLabels`) werd de verbindingslijn getekend met twee rechte lijnstukken via een tussenpunt (`lineTo(ax, ay) -> lineTo(px, py)`). Wanneer de labelpil verticaal moest uitwijken om overlap te voorkomen, ontstond een scherpe, hoekige knik (zaagtand) en eindigde de lijn stomp tegen de rand van de bol.
- **Gewijzigde bestanden:**
  - `src/scene.js`: In `drawLabels` vervangen door een organische Bezier-curve (`bezierCurveTo`) met zachte horizontale tangens (`cp2y = py`) aan de pilzijde en radiale vertrekrichting aan de orbzijde. Daarnaast is een discreet micro-ankerpuntje van 1,2 px toegevoegd (`ctx.arc(startX, startY, 1.2, 0, TAU)`) aan de bolrand, waardoor de overgang altijd zijdezacht en naadloos oogt.
- **Getest:** Zowel op desktop als mobiel getest met uitwijkende labels: de curve beweegt elastisch en vloeiend mee zonder scherpe knikken of afkappingen.
- **Impact op opslag / state:** Geen.

### 17. Meerlagige diepteparallax en fading voor achtergrondsterren (Voorstel 2)
- **Vraag van Victor:** De sterren op de achtergrond verplaatsten wel mee van plaats bij het switchen tussen bovenaanzicht en zijaanzicht, maar veranderden niet mee van perspectief waardoor de animatie niet vloeiend of sleek oogde. Victor koos Voorstel 2 (Meerlagige diepteparallax en fading).
- **Oorzaak:** In `src/scene.js` gebruikten alle sterren in `skyXY` een uniforme platte 2D-compressie (`y * Math.cos(a) - LIFT`), zonder verschil in afstand, parallax of diepteschaal.
- **Gewijzigde bestanden:**
  - `src/scene.js`: `starLayer(st)` verdeelt sterren deterministisch over 3 kosmische dieptelagen (verre achtergrond, middenlaag, nabije voorgrond). In `skyXY` bewegen verre sterren trager (55% van de kantelsnelheid) en nabije sterren responsiever (115%). In `drawStars` schalen sterren die naar de horizon verdwijnen subtiel af in grootte (`distScale`) en zacht in contrast (`distFade`). Ook sterrenbeelden (`makeConstellation` / `drawConstellation`) en schermpunten (`skyPoints`) volgen nu exact de individuele dieptelaag van elke ster.
- **Getest:** Vloeiend schakelen tussen boven- en zijaanzicht: de hemel krijgt een cinematografisch 'deep space' dieptegevoel waarin de 3D-trechter prachtig ademt en de sterren natuurlijk meebewegen.
- **Impact op opslag / state:** Geen.

### 18. Exacte basislijnutlijning van 'stars collected' en 'muur'
- **Vraag van Victor:** Laat de 'stars collected' en 'wall' op dezelfde lijn uitgelijnd zijn (met screenshot waarop te zien was dat 'MUUR' enkele pixels hoger zweefde dan 'STARS COLLECTED').
- **Oorzaak:** `.stats-total` gebruikte `align-items: flex-end` met `padding-bottom: 2px` op de tekst, terwijl `.wall-toggle` `align-items: center` had in een box van `min-height: 32px`. Daardoor centreerde 'MUUR' verticaal in de 32 px en zweefde de tekst circa 8 px hoger dan 'STARS COLLECTED'.
- **Gewijzigde bestanden:**
  - `src/styles.css`: `.wall-toggle` voorzien van `align-items: flex-end; padding: 0 2px 2px;` en `.wall-toggle svg { margin-bottom: 1.5px; }`. Hierdoor rusten beide knoppen op `flex-end` van de rij en staan de letters van 'MUUR' en 'STARS COLLECTED' op exact dezelfde horizontale basislijn (2 px van de onderkant). Tevens heeft `.feats-badge` `flex-basis: 100%` gekregen zodat deze altijd strak op de volgende regel begint.
- **Getest:** Gecontroleerd op mobiel en desktop: 'stars collected' en 'muur' staan pixelperfect op dezelfde horizontale lijn.
- **Impact op opslag / state:** Geen.


### 19. Rustige, gemoedelijke diagonale muurveeg bij 'Stars Collected' (Voorstel 2)
- **Vraag van Victor:** Victor koos Voorstel 2 voor de muur: laat bij het aantikken van 'Stars Collected' een witte gloed één keer diagonaal over de muur passeren en dan weer verdwijnen. Victor benadrukte expliciet: "Zorg wel dat het niet te snel gaat en je de kans hebt om nog wat taakjes te lezen voor ze weer verdwijnen, anders heeft het ook niet echt nut" en "Zorg er wel voor dat de muur niet gereveald wordt nadat er al veel animaties tegelijk gebeuren ... Maak de animatie ook sleek, rustig en gemoedelijk. Niet bruusk, erg aanwezig of storend".
- **Oplossing & Implementatie:**
  - **Pacing & Leesbaarheid:** De veegduur is ingesteld op 5,6 seconden met een kalme, zachte sinusboog (`ease(p)`). De diagonale lichtbundel (hoek 34°) is 420 px breed (`SWEEP_BEAM = 210`) met een perfecte verhoogde-cosinus afval (`(1 + cos(dist/R * PI)) / 2`). Woorden blijven ~1,8 tot 2,2 seconden comfortabel in het zachte licht leesbaar.
  - **Lichtsterkte:** De maximale helderheid van de verlichte woorden is begrensd op 0,52 (in zachte inktkleur), zodat het nooit fel of storend oogt, maar aanvoelt als een zachte maanlichtgloed over e-ink.
  - **Strikte bewaking tegen animatie-stapeling:** `triggerWallSweep()` in `src/app.js` en `scene.isBusy()` in `src/scene.js` controleren vóór het starten of er openstaande dialogen, actieve toasts, achievement-popups, uitfonkelende taken (`twinkles`), vliegende vonken (`sparks`), een pas geboren ster (`lastStarAt < 3000`), of een getekend sterrenbeeld actief zijn. Is dat het geval, dan wordt de veeg direct tegengehouden.
  - **Direct annuleren bij sluiten:** Als de gebruiker de statistiekdetails weer dichtklapt, dooft de veeg direct en geruisloos uit (`scene.cancelWallSweep()`).
- **Gewijzigde bestanden:**
  - `src/scene.js`: Variabele `wallSweep` toegevoegd, `wallWant` reageert op `wallSweep`, `drawWall(now)` berekent de diagonale bundel en zachte in-/uitfade, en de methoden `sweepWall(dur = 5600)`, `cancelWallSweep()` en `isBusy()` zijn toegevoegd aan het `scene` object.
  - `src/app.js`: In `showStatsDetail` wordt bij het openen `triggerWallSweep()` aangeroepen en bij het sluiten `cancelWallSweep()`.
- **Getest:** Gecontroleerd bij openen en sluiten van de statistieken op zowel desktop als mobiel formaat. Woorden glijden rustig en leesbaar voorbij zonder enige schok, en bij drukke activiteit blijft de muur verborgen in de diepte.
- **Impact op opslag / state:** Geen.


### 20. Trage gradiënt-overgang over de muur van donkergrijs naar witte focus
- **Vraag van Victor:** Laat de gloed er trager overtrekken en werk met een gradiënt van donkergrijs naar de witte focus. Nu waren de woorden binair (of donkergrijs uit focus, of wit uitgelicht). Victor vroeg een vloeiende overgang en een trager verloop.
- **Oplossing & Implementatie:**
  - **Trager en gemoedelijker verloop:** Duur verlengd van 5,6 naar 8,6 seconden (`dur = 8600`). De bundel glijdt kalm en statig over de diagonaal. Elk taakwoord blijft ruim 4,5 seconden in het overgangsverloop en circa 2 seconden in de helderste focus.
  - **Continue gradiënt i.p.v. harde sprong:** De bundelbreedte is verruimd naar 560 px (`SWEEP_BEAM = 280`). Woorden worden berekend met een kosinus-focuscurve: `focusCurve = pow(cos(normDist * PI/2), 1.4)`. Hierdoor vloeit elk woord traploos van rustend donkergrijs (0,065) via zacht middengrijs naar de witte leesfocus (0,62) en dooft weer geruisloos terug naar donkergrijs.
  - **Geen binaire onderlaag:** Tijdens de veeg wordt de statische canvas-onderlaag overgeslagen ten gunste van de directe continue gradiëntberekening per woord.
- **Gewijzigde bestanden:**
  - `src/scene.js`: In `drawWall` de bundelbreedte verhoogd naar 280 px, timingparameters aangepast voor 8,6s, continue gradiëntformule geïmplementeerd en standaardduur in `sweepWall(dur = 8600)` verhoogd.
- **Getest:** Gecontroleerd op zowel desktop als mobiel: woorden warmen zacht en vloeiend op van donkergrijs naar helder wit en dimmen rustig weer terug. Geen harde drempels meer, tijd genoeg om ontspannen te lezen.
- **Impact op opslag / state:** Geen.


### 21. Juiste dieptevolgorde (muur achter banen, kern en orbs, vóór sterren) en 16s leestempo
- **Vraag van Victor:** "nog steeds een pak te snel" en "Laat de muur ook zeker altijd achter alle andere elementen verschijnen (achter de orbs, banen, kern), het mag wel voor de sterretjes".
- **Oplossing & Implementatie:**
  - **Dieptevolgorde (Z-index):** In `src/scene.js` (`draw(now)`) is de tekensvolgorde gecorrigeerd. De muur wordt nu getekend ná `drawSky`, `drawConstellation` en `drawMeteor`, maar vóór `drawRings`, `drawCore` en `drawOrbs`. Hierdoor staat de muur vóór de sterretjes, maar blijven de orbs, banen en kern altijd scherp en helder op de voorgrond.
  - **Gemoedelijk 16s tempo:** Duur verruimd naar 16 seconden (`dur = 16000`), bundel verbreed naar 880 px (`SWEEP_BEAM = 440`) en de beweging omgezet naar een gelijkmatige `smoothstep` (zonder plotse acceleratie in het midden). Woorden blijven nu ruim 8 seconden in de overgangszone, waardoor je in alle rust taken kunt lezen.
- **Gewijzigde bestanden:**
  - `src/scene.js`: Tekensvolgorde in `draw(now)` aangepast; duur en bundelparameters geüpdatet.
- **Getest:** Gecontroleerd op desktop en mobiel. Banen, kern en orbs tekenen prominent over de muur heen; de achtergrondsterren liggen erachter; de tekst glijdt traag en vloeiend voorbij.
- **Impact op opslag / state:** Geen.

### 22. Zandloper in focusmodus als vrije hint zonder kaart (Voorstel 1)
- **Vraag van Victor:** "maak van de zandloper op de focus pagina geen kaart maar eerder ook een kleine 'hint', exact zoals het wordt weergegeven op het dashboard als er een zandloper loopt maar de focus mode is afgesloten. kleiner en niet meer omringt door een kaart, ook het vergroten van de zandloper vergroot gewoon de zandloper zoals nu maar dan vrij, zonder kaart erachter". Uit de drie voorstellen koos Victor **Voorstel 1 (De Stille Hint)**.
- **Oplossing & Implementatie:**
  - **Ingeklapt (Stille Hint):** De ingelaten kaart (`background: var(--well)`, `box-shadow`, `border-radius: 16px`, `326 × 132 px`) rond `#timer` is verwijderd. Rechtsboven het bakje zweeft nu een compact 36 × 60 px zandloperglas met links ervan het dunne minutencijfer (`30px` Geist Light met klein `MIN`, `.timer-min`), exact zoals `.glass` op het dashboard.
  - **Bediening bij aanwijzen:** Net als bij `.glass-tools` op het dashboard schuift de knoppenrij (`15 / 25 / 50`, `Start / Pauze`, `↺` en het vergroot-icoontje `⤢`) pas bij aanwijzen (`:hover`) of toetsenbordfocus (`:focus-within`) zacht tevoorschijn links van het minutencijfer. Een klik op het glas of het minutencijfer start of pauzeert direct.
  - **Vrij vergroten zonder kaart (`.timer.is-open`):** Bij het vergroten groeit het zandloperglas vrij in de ruimte boven het bakje, met eronder de stippencijfers (`50px`) en de bedieningsrij en rechtsboven het verkleinknopje, zonder omsluitende kaart.
- **Gewijzigde bestanden:**
  - `src/focus/timer.js`: `.timer-expand` ondergebracht in `.timer-row`, klik op `.timer-min` op desktop gekoppeld aan `toggle()`.
  - `src/styles.css`: Kaartstijl verwijderd van `.timer`, layout en typografie voor ingeklapte hint en vrij uitgeklapte toestand (`.timer.is-open:not(.is-compact)`) ingesteld met behoud van de mobiele weergave (`.timer.is-compact`).
- **Impact op opslag / state:** Geen (`priority-orbit.timer.v1` en `priority-orbit.timer.ui.v1` blijven ongewijzigd).

---

## 05/11/2026

### 23. Verfijning fysica, ronde kern, warm archiefpapier, dark mode toast en settings-integratie
- **Vraag van Victor:**
  1. Orb-herschikking bij afvinken: orbs draaien soms een volle slag rond. Uit de voorstellen koos Victor **Voorstel A2 (Zwaartepunt-uitlijning)**.
  2. Orb-aankomst: nieuwe orbs kwamen te wild van ver buiten beeld invliegen. Uit de voorstellen koos Victor **Voorstel B3 (Lokale baan-ontvouwing)**.
  3. Kernweergave op kleine schermen: de kern oogde soms hoekig/hexagonaal. Uit de voorstellen koos Victor **Voorstel C1 (Concentrische cirkelringen)**.
  4. Dieptevolgorde kleine nacht: de rode kern moet altijd vóór de animatie van de nieuwe ster (`smallNight`) tekenen, nooit erachter.
  5. Lichte modus papier: lichte modus heeft een zachte tint nodig zodat pure witte effecten afsteken zonder verblinding. Victor koos **Voorstel P2 (Warm Archiefpapier, #EBE8DF)**.
  6. Dark mode toast: maak notificaties in donkere modus echt volledig zwart met een zuiver witte knop en zwarte tekst, exact spiegelend aan de lichte modus.
  7. Achtergrondraster: de cursor-volgende stippen laten vervagen zodra ze binnen de eerste orbit komen om visuele drukte met de baanlijnen te vermijden.
  8. Instellingenknop: de zwevende Settings-knop meer visueel integreren in het blok erboven (onder de takenlijst) zodat het één geheel vormt.
- **Oplossing & Implementatie:**
  - **A2 Zwaartepunt-uitlijning:** In `src/scene/scene.js` (`layoutOffsets()`) worden bestaande bollen geordend op hun actuele cirkelpositie. Het gelijkmatige doelrooster wordt gecentreerd op hun gemiddelde hoekverschil. Resterende bollen leggen zo vloeiend over 2,4 s het kortste pad af zonder 360 graden rondzwiepingen of plotse sprongen.
  - **B3 Lokale baan-ontvouwing:** In plaats van invliegen vanaf straal 320 ontplooien nieuwe bollen zich nu vlak buiten hun doelring (+26 px, `ARRIVE_SPAN = 26`) over een korte tangentiële kwartboog (`ARRIVE_SWEEP = 0.55`) en landen direct op kruissnelheid met een zachte infade.
  - **C1 Concentrische cirkelringen:** `coreGrid(spacing, rMax)` bouwt de rode kern op uit concentrische ringen met een lichte alternerende kwartdraai en een zachte uitloop aan de buitenrand (`smoothstep(0.82, 1.04, uR)`). De kern blijft op elk formaat (ook mobiel en zijaanzicht) zuiver cirkelvormig.
  - **Rode kern vóór kleine nacht:** In `src/scene/fx.js` tekent `smallNight` via `scene.setNightDraw()` direct in de scènepas vlak vóór `drawCore()`. De rode kern blijft te allen tijde haarscherp vóór de nachtgloed en de opbloeiende ster staan.
  - **Voorstel P2 Warm Archiefpapier:** `:root` tokens bijgewerkt naar `--bg: #EBE8DF`, `--surface: #F8F6F0`, `--well: #E0DDD3` en `--backdrop: rgba(235, 232, 223, .6)`. Tevens gesynchroniseerd in `index.html` (`meta[name="theme-color"]`), `src/app.js`, `src/scene/scene.js` (`THEMES.light.paper`), `src/focus/panel.js` en `src/data/recap.js`.
  - **Dark Mode Toast:** In `src/styles.css` is `#undo` in lichte modus spierwit met een zwarte knop, en onder `:root[data-theme="dark"]` is de toast zuiver zwart (`#000000`, rand `rgba(255, 255, 255, .14)`) met een zuiver witte knop (`#FFFFFF`, tekst `#000000`).
  - **Achtergrondraster-vervaging:** In `src/scene/scene.js` vervagen de achtergrondstippen binnen de buitenste orbit via `smoothstep(142, 174, r)`. Buiten de banen blijft het volledige interactieve raster intact.
  - **Instellingen-integratie:** In `index.html` is `<div class="stats-meta" id="stats-meta">` toegevoegd. In `src/app.js` (`placeMenu()`) wordt `#menu-btn` op desktop in `#stats-meta` geplaatst wanneer de statistieken actief zijn, strak uitgelijnd naast de prestatiebadge in monospace kapitaaltjes, terwijl de takenlijst doorloopt tot `bottom: 30px`.
- **Gewijzigde bestanden:**
  - `src/styles.css`
  - `index.html`
  - `src/scene/scene.js`
  - `src/scene/fx.js`
  - `src/app.js`
  - `src/focus/panel.js`
  - `src/data/recap.js`
- **Getest:** Gecontroleerd met headless Edge op 1440x900 en 375x812 in licht en donker thema: console foutloos, P2 papierkleur en dark mode toast geverifieerd via getComputedStyle, menuklik en interactie geverifieerd via geautomatiseerde inspectie.
- **Impact op opslag / state:** Geen.

### 24. Vaste koers A1 (geen tegenstroom of verdwijnende orbs), Voorstel 4 metaband en oogjes-voorstellen
- **Vraag van Victor:**
  1. "Er is een grote bug dat de orbs gewoon doet verdwijnen. Ik wil ook terugkomen op de beslissing voor A2. Hier kunnen orbs blijkbaar toch in tegengestelde richting bewegen en dit wil ik vermijden. Pas daarom A1 toe"
  2. "Voorstel 4 voor de settings verdeling" (naar aanleiding van de 4 lay-outopties in bottom-layout-options.html).
  3. "de orb kern zijn oogjes lijken nu heel boos door de redesign. Ze zijn ook erg ongedetailleerd hoe kleiner de kern wordt. Doe voorstellen voor een redesign van de oogjes en hun animaties"
- **Oplossing & Implementatie:**
  - **Voorstel A1 (Vaste Koers):** In `src/scene/scene.js` (`layoutOffsets()`) behouden bestaande bollen altijd ongewijzigd hun eigen offset (`o.targetOffset = o.offset`). Bij het afvinken van een taak via `complete(id)` wordt `layoutOffsets()` niet meer aangeroepen: overblijvende bollen varen ongestoord op hun eigen koers en kruissnelheid door. Alleen nieuw toegevoegde (verse) bollen kiezen automatisch het grootste vrije gat tussen bestaande bollen. In de update-lus volgt `o.offset = o.targetOffset` direct zonder interpolatiefouten of 360-graden omkeringen. Dit lost tevens de bug op waarbij bollen door wrapAngle-sprongen plotseling verdwenen.
  - **Voorstel 4 (De Compacte Metaband):** In `index.html` en `src/styles.css` is het statistiekenblok opgedeeld in twee zuivere stroken:
    - Bovenstrook (`.stats-head`): links de stippenteller (`06 STARS THIS MONTH`), rechts het badge-cluster (`OCTOBER IN STARS` en `PILOT · 458 PTS`).
    - Onderstrook (`.stats-bar`): links de knop `☲ MUUR ⚬`, rechts de knop `⚙ SETTINGS` (via `#stats-menu-slot`).
    - Secundaire hulplinks (`ACHIEVEMENTS / GUIDE / ARCHIVE / PAIR`) zijn op desktop net als op mobiel verplaatst naar het Instellingen-popover (`#hud-menu`), waardoor de rommelige losse vierde footerregel verdwenen is.
    - Lege `.controls` balk op desktop wordt via `@media (min-width: 1000px) { .controls:not(:has(#menu-btn)) { display: none; } }` netjes verborgen.
  - **Frame-initialisatiefix in `src/focus/glass.js`:** Null-guard toegevoegd (`if (!st || now - lastRead > 250) st = timerState(); if (!st) return;`) zodat de zandloper nooit een runtime TypeError kan triggeren voor de timer-state geladen is.
  - **Voorstellen Herontwerp Oogjes:** Interactieve demonstrator gebouwd in `core-eyes-options.html` met 4 oplossingen (O1 Horizontaal oogrooster, O2 Karakter-pil met drijvende pupil, O3 5x3 Retro micro-matrix, en O4 Kwarts lens met fonkelglans) inclusief live 60fps animaties, muistracking, knipper-, blij- en nachtstand en schaalvergelijking.
- **Gewijzigde bestanden:**
  - `src/scene/scene.js`
  - `src/focus/glass.js`
  - `index.html`
  - `src/styles.css`
  - `src/app.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:** Gecontroleerd via headless browser op desktop (1440x900) en mobiel (375x812): taken afgevinkt, orb-continuïteit geverifieerd (orbs blijven zichtbaar, bewegen uitsluitend voorwaarts), lay-out inspectie bevestigt 2 strakke rijen en 0 fouten in de console.
- **Impact op opslag / state:** Geen.

### 25. Opgelost: Lege hemel bij afvinken van een taak (TDZ ReferenceError in smallNight)
- **Vraag van Victor:** "Grote bug: bij het afvinken van een taak wordt de hemel plots helemaal leeg, geen orbs, alles weg" (met bijgevoegde schermafbeelding van de lege scène zonder kern of orbs).
- **Oorzaak:**
  - In `src/scene/fx.js` (`smallNight`) was bij de scènepas-wijziging (Victor 05/11/2026: rode kern vóór kleine nacht tekenen) een tweede `function stop()` gedefinieerd onderaan in de overlay-tak.
  - Omdat JavaScript function declarations hoorbaar hoist naar de functiescope, overschreef de tweede `stop()` de eerste.
  - Zodra de kleine nacht na 3,5 seconden eindigde (`t >= NIGHT.end`), riep `renderOn()` de gehoiste `stop()` aan. Deze probeerde `raf` te annuleren (`cancelAnimationFrame(raf)`).
  - Omdat de scènepas-tak echter al vroeg in de functie terugkeerde (`return;`), was de `let raf = 0;` toewijzing nooit lexicaal geëvalueerd. Dit resulteerde in een fatale Temporal Dead Zone (TDZ) fout: `ReferenceError: Cannot access 'raf' before initialization`.
  - Doordat deze fout ongevangen in `draw(now)` optrad vlak vóór `drawCore()` en `drawOrbs()`, werd de rest van het frame afgebroken én stopte de `requestAnimationFrame(frame)` lus volledig. Hierdoor verdwenen zowel de kern als alle orbs plotseling van het scherm.
- **Oplossing & Implementatie:**
  - In `src/scene/fx.js` is `stop()` samengevoegd tot één centrale functie bovenaan `smallNight`, die zowel de scènepas (`scene.setNightDraw(null)`) als de overlay (`cancelAnimationFrame(raf)`) netjes afhandelt. Geen dubbele declaraties of TDZ-toegang meer mogelijk.
  - In `src/scene/scene.js` (`draw(now)`) is de aanroep van `nightDraw` omgeven met een `try ... catch`-blok, zodat een eventuele neveneffect-fout nooit meer de kern of de orbs kan blokkeren.
  - In `src/scene/scene.js` (`frame(now)`) zijn `update()` en `draw()` beveiligd met `try ... catch`. De animatielus (`requestAnimationFrame`) blijft hierdoor te allen tijde doordraaien.
- **Gewijzigde bestanden:**
  - `src/scene/fx.js`
  - `src/scene/scene.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:** Geautomatiseerde test via headless Edge: taak afgevinkt, animatietijdlijn 4,5 s gemonitord inclusief nachtcyclus, console 100% foutloos (`errors: 0`), orbs en kern blijven te allen tijde actief doordraaien op de hemel.
- **Impact op opslag / state:** Geen.

### 26. Voorstel 3 (Top-Cockpit): herstel van rust en ademruimte in cockpit en zijbalk-voet
- **Vraag van Victor:** "Dit ziet er na je aanpassingen nog rommeliger uit dan voordien. Verzin betere alternatieven en stel ze voor, je mag de rij opties die eerst rechts boven stond ook gerust terugzetten." Uit de vier voorstellen koos Victor **Voorstel 3 (Top-Cockpit: Profiel Bovenin)**.
- **Oorzaak van de rommelige eerdere stand:**
  - In Voorstel 4 werden 3 brede elementen (de stippenteller "99 STARS ALL TIME", de maandrecap-pil "OCTOBER IN STARS" en de rangbadge "STARGAZER · 21 PTS") samengeperst op één enkele flex-regel in een zijbalk van circa 310 px.
  - Doordat deze drie elementen samen circa 400 px vereisen, brak alle tekst geforceerd af in 2 tot 3 regels ("STARS \n ALL \n TIME" en "STARGAZER \n · 21 PTS"), wat leidde tot een benauwd en rommelig aanzicht.
- **Oplossing & Implementatie (Voorstel 3):**
  - **Top-Cockpit rechtsboven (`.hud-right`):**
    - Onder datum en week is de volledige profiel- en cockpitstrook geplaatst (`.hud-actions`): de actuele rangbadge met insigne-icoon (`#feats-badge`, bv. "✦ NAVIGATOR · 294 PTS"), de maandrecap-pil (`#recap-pill`, "● OKTOBER IN STERREN" wanneer actief), "UITLEG" (`#intro-btn`), "ARCHIEF" (`#archive-btn`) en "KOPPELEN" (`#sync-btn`).
    - Wanneer de gebruiker een rang behaalt, vervangt de rangbadge automatisch de generieke knop "PRESTATIES".
    - Sliders/scheidingstekens (`/`) verbergen zich automatisch wanneer een badge of recap niet actief is (`#feats-badge[hidden] + .slash`, `#recap-pill[hidden] + .slash`).
    - Op desktop heeft de topbar honderden pixels vrije ruimte: alle items staan strak en sereen op één enkele horizontale regel zonder enige tekstafbreking.
  - **Serene zijbalk-voet (`#stats`):**
    - Alle badges en pillen zijn weggehaald onder de takenlijst.
    - Rij 1 (`.stats-head`): links de stippenteller (`#stats-total`, bv. "99 STARS THIS MONTH"), rechts de muurknop (`#wall-toggle`, "☲ MUUR ⚬"), strak op dezelfde basislijn.
    - Rij 2 (`.stats-bar`): rechts de instellingenknop (`#menu-btn`, "⚙ INSTELLINGEN").
    - Hoogte van `.stats-head` is exact 32 px (strakke enkele regel, geen afbrekingen).
  - **Mobiel (`< 1000px`):**
    - `placeMenu()` verplaatst `.hud-actions` op mobiel zoals vanouds netjes binnen het Instellingen-popover (`#hud-menu`), zodat het mobiele scherm compact blijft.
- **Gewijzigde bestanden:**
  - `index.html`
  - `src/app.js`
  - `src/styles.css`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:** Gecontroleerd via headless browser op desktop (1440x900) met 99 sterren, prestatierang en maandrecap: `headHeight: 32px` (geen tekstafbreking), `featsBadgeVisible: true`, `recapPillVisible: true`, `menuBtnInBar: true`, 0 fouten in de console.
- **Impact op opslag / state:** Geen.

### 27. Dieptevolgorde kleine nacht: orbs en banen achter de nieuwe-ster-animatie, kern erbovenop
- **Vraag van Victor:** "Het klopt dat ik vroeg dat de kern altijd over de animatie van een nieuwe ster tekent, maar de orbs en hun orbits moeten wel erachter getekend worden, niet ervoor".
- **Oorzaak:** In `src/scene/scene.js` was de render-volgorde `drawRings` -> `nightDraw` -> `drawCore` -> `drawOrbs` -> `drawEffects`. Hierdoor tekenden de orbs en hun staarten nog steeds bovenop de witte gloed van de nieuwe steranimatie (`smallNight`).
- **Oplossing & Implementatie:**
  - In `src/scene/scene.js` zijn `drawOrbs()` en `drawEffects()` verplaatst naar vóór `nightDraw`.
  - De render-volgorde in `draw(now)` is nu exact gelaagd:
    1. `drawWall(now)` (muur)
    2. `drawRings(now)` (banen / stippenlijnen)
    3. `drawVortex()` (draaikolk)
    4. `drawOrbs()` (orbs met hun halo en staart: achter de nachtanimatie)
    5. `drawEffects()`
    6. `nightDraw(ctx, now, ...)` (kleine nacht: dekt de banen en orbs af met haar zachte lichtschijf)
    7. `drawCore(now)` (de centrale rode kern: dekt de nacht af en blijft altijd haarscherp op de voorgrond)
    8. `drawSonar(now)`, `drawSparks(now)`, `drawLabels()`.
- **Gewijzigde bestanden:**
  - `src/scene/scene.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:** Automatische headless Edge-test uitgevoerd waarbij een taak werd afgevinkt en op de piek van de `smallNight`-gloed (T+2.3s) een screenshot werd gemaakt (`night_peak_depth.png`). Bevestigd dat banen en orbs achter de witte gloed verdwijnen, terwijl de rode kern met oogjes er volkomen scherp en ononderbroken bovenop staat. Console 100% foutloos (`errors: 0`).
- **Impact op opslag / state:** Geen.

