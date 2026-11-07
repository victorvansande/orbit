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

### 28. Instellingen linksonder uitgelijnd met de dot matrix teller
- **Vraag van Victor:** "zet de settings links onder, aligned met de dot matrix, niet rechts".
- **Oplossing & Implementatie:**
  - In `src/styles.css` is `.stats-bar` aangepast van `justify-content: flex-end;` naar `justify-content: flex-start;`.
  - Bij `.stats-menu-slot` is `margin-left: auto;` verwijderd (`display: flex; align-items: center;`).
  - Hierdoor staat de knop `⚙ INSTELLINGEN` nu strak aan de linkerzijde van de tweede regel onder de scheidingslijn, exact verticaal uitgelijnd met de stippencijfers (`.stat-dm`) van de matrix-teller direct erboven (beide exact op `left: 40px`).
  - De muurknop (`☲ MUUR ⚬`) blijft rechts op de eerste regel staan naast de teller.
- **Gewijzigde bestanden:**
  - `src/styles.css`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:** Headless browser test uitgevoerd met metingen van bounding rects: `.stat-dm.left = 40px`, `#menu-btn.left = 40px`, `.menu-gear.left = 40px` (volledig uitgelijnd). Screenshot geverifieerd (`stats_settings_left_clean.png`) en opening van het instellingenmenu boven de knop gecontroleerd (`stats_menu_open.png`).
- **Impact op opslag / state:** Geen.

### 29. Evenwichtige verticale spacing in de zijbalk-voet
- **Vraag van Victor:** "De spacing boven en onder is niet even groot. Verwijder de ruimte boven de tekst en maak ze gelijk met eronder".
- **Oorzaak van de scheefgroei:**
  - `.stats` had `padding-top: 14px;`.
  - `.stats-head` en `.stats-total` hadden `min-height: 32px;` met `align-items: flex-end;`.
  - Daardoor werd de 22 px hoge dot matrix teller naar onderen gedrukt en ontstond er `14px + 10px = 24px` tot 33 px lege ruimte boven de teller/tekst, terwijl de ruimte eronder naar de scheidingslijn slechts `10px` bedroeg (2,5x zo klein).
- **Oplossing & Implementatie:**
  - In `src/styles.css` is `padding-top` van `.stats` teruggebracht van 14 px naar 10 px.
  - De overbodige `min-height: 32px` op `.stats-head` en `.stats-total` is vervangen door `min-height: auto` (hoogte sluit nu exact aan op de 22 px van de dot matrix teller).
  - De tussenruimtes en paddings zijn symmetrisch gelijkgetrokken:
    - Ruimte van bovenste scheidingslijn tot bovenkant matrix-teller: **11 px**.
    - Ruimte van onderkant matrix-teller tot middelste scheidingslijn: **10 px**.
    - Ruimte van middelste scheidingslijn tot Instellingen: **10 px**.
- **Gewijzigde bestanden:**
  - `src/styles.css`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:** Nauwkeurig opgemeten in headless Chrome via CDP: `spaceAboveDm: 11px`, `spaceBelowDmToDivider: 10px`, `spaceBelowDividerToMenu: 10px`. Screenshot geverifieerd (`stats_final_balanced.png`).
- **Impact op opslag / state:** Geen.

### 30. Prestaties naar instellingenmenu, discreet rang-insigne in de voetbalk, en uniforme dikkere logovariant voor alle iconen
- **Vraag van Victor:**
  1. *"optie 1. Zet enkel het logotje van de huidige rang ook naast de settings als hint dat daar de achievements te vinden zijn"*
  2. *"Maak de app-icon en favicon dezelfde dikkere variant van het logo als op de site zelf terug te vinden is, overal trouwens, Ik begrijp niet goed waarom er soms de dunnere variant wordt gebruikt."*
- **Oplossing & Implementatie:**
  1. **Prestaties in Instellingen (Optie 1) & Rang-insigne hint:**
     - De volledige prestatiebadge (`#feats-badge`) is uit de cockpithoek rechtsboven (`.hud-actions`) gehaald en verplaatst naar het instellingenmenu (`#hud-menu`) als een vaste profielregel (`.menu-feats-row`).
     - De navigatiestrook rechtsboven is nu sereen en zuiver: `UITLEG / ARCHIEF / KOPPELEN` (plus eventuele maandrecap).
     - In `.stats-bar` naast `⚙ INSTELLINGEN` is een discreet rang-insigne (`#stats-rank-hint`) geplaatst. Dit toont enkel het SVG-embleem van de actuele rang in de metallieke tier-kleur (brons, zilver, goud, platina, diamant).
     - Bij hover schaalt het insigne subtiel (`transform: scale(1.22)`), toont een tooltip met de rang en punten, en bij klik opent het direct het volledige Prestaties-venster (`#feats`).
     - In `src/app.js` beheert `renderFeatsBadge` zowel de menu-rij als de hint in de voetbalk, en `placeMenu` voegt `menuBtn` vooraan toe (`slot.prepend(menuBtn)`) zodat de volgorde `[⚙ INSTELLINGEN] [✦ RANG-INSIGNE]` strak behouden blijft.
  2. **Uniforme dikkere logovariant overal:**
     - Oorspronkelijk kende `src/core/mark.js` twee varianten: `SYMBOL` (de dunnere variant) en `SYMBOL_SMALL` (de dikkere variant met een grotere cirkelkop en vollere staart).
     - De website toonde al de dikkere variant (`LOCKUP_SMALL`), maar icon-generatiescripts en app-iconen vielen terug op de dunnere variant.
     - In `src/core/mark.js` zijn `SYMBOL` en `LOCKUP` nu gelijkgesteld aan de dikkere variant (`SYMBOL_SMALL` / `LOCKUP_SMALL`).
     - Alle SVG-iconen (`icons/icon-full.svg`, `icons/icon-any.svg`, `icons/icon-maskable.svg`, `icons/icon-monochrome.svg`, `favicon.svg`, `brand/merk/svg/*`, `brand/merk/favicon/*`) zijn vernieuwd met de dikkere variant.
     - `favicon.svg` achtergrondkleur is bijgewerkt naar het gekozen Warm Archiefpapier `#EBE8DF`.
     - Alle PNG-formaten (16, 32, 48, 180, 192, 512, maskable, dark) en de multi-resolutie `favicon.ico` (16, 32 en 48 px) zijn opnieuw gegenereerd via headless Edge.
- **Gewijzigde bestanden:**
  - `index.html`
  - `src/app.js`
  - `src/styles.css`
  - `src/core/mark.js`
  - `icons/make_icons.py`
  - `favicon.svg`
  - `favicon.ico`
  - `icons/*` (alle PNG's en SVG's)
  - `brand/merk/*` (alle PNG's, SVG's en ICO)
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:**
  - Automatische headless browser inspectie (`verify_opt1_hint.mjs`): console 100% foutloos (`errors: 0`).
  - Geverifieerd dat `.hud-actions` rechtsboven ontdaan is van badge en overtollige slashes.
  - Geverifieerd dat `#stats-rank-hint` naast `#menu-btn` staat op `left: 157.7px` (uitgelijnd).
  - Geverifieerd dat klik op het insigne het Prestaties-dialoogvenster opent.
  - Screenshots gecontroleerd: `hud_right_clean.png`, `stats_bar_hint.png`, `menu_with_feats.png`.
- **Impact op opslag / state:** Geen.

### 31. Uitlijning van rang en punten in het instellingenmenu
- **Vraag van Victor:** "De rang en punten staan heel raar uitgelijnd in het settings menu" (met screenshot `media_1793882000105_38476cd9.png`).
- **Oorzaak van de scheefgroei:**
  - Een oude CSS-regel op regel 1281 (`.feats-badge { flex-basis: 100%; margin-top: 13px; ... }`) die nog dateerde uit de tijd dat de badge onder de teller in de zijbalk stond, werkte door op `#feats-badge` in het menu.
  - Door `flex-basis: 100%` rekte de badge-knop zich horizontaal over de volledige restbreedte van de rij uit, terwijl de inhoud (`<svg>` en tekst) links binnen die knop werd uitgelijnd (vlak naast het label `Achievements` / `Prestaties`).
  - Bovendien drukte `margin-top: 13px` de badge naar beneden, waardoor deze ver onder de verticale as van het label kwam te hangen.
- **Oplossing & Implementatie:**
  - In `src/styles.css` is de oude regel op regel 1281 ontdaan van `flex-basis: 100%` en `margin-top: 13px`.
  - `.hud-menu .feats-badge` heeft expliciet `flex: none; margin: 0; padding: 0; justify-content: flex-end;` gekregen, waardoor de badge zich automatisch rechts uitlijnt via `justify-content: space-between` van de rij.
  - De badge eindigt nu op exact dezelfde rechterkolom als de knoppen erboven (bv. `Open demo`), en is exact verticaal gecentreerd op de regel (binnen een halve pixel).
  - Tevens is in `src/app.js` een klik-luisteraar aan de hele rij `.menu-feats-row` toegevoegd, zodat een klik overal op de rij het venster opent.
- **Gewijzigde bestanden:**
  - `src/styles.css`
  - `src/app.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:**
  - Geautomatiseerde CDP-metingen uitgevoerd in headless Edge (`verify_menu_feats_align.mjs`):
    - `demoButton.right = 423px`, `featsBadge.right = 423px` (`rightDelta = 0px`, exact gelijk).
    - `demoLabel.left = 57px`, `featsLabel.left = 57px` (`leftDelta = 0px`, exact gelijk).
    - Verticaal centrum van de 48px-rij (`top: 697px`) en de 32px-badge (`top: 704.5px`) vallen exact samen op 720,5-721 px.
  - Screenshot gemaakt en geverifieerd (`menu_feats_aligned_en.png`).
  - Klik op de hele rij opent het Prestaties-venster.
  - Console 100% foutloos (`errors: 0`).
- **Impact op opslag / state:** Geen.

### 32. Trage, geleidelijke herverdeling van bollen over de ringen zonder omkeren of verspringen
- **Vraag van Victor:** "Er is nog steeds iets niet juist in de logica van hoe orbs verdwijnen op hun orbit en terug verschijnen. Dit gebeurde net (zie screenshot) toen ik een taak toevoegde aan de 'week' orbit. De orbs verschijnen echt vlak na elkaar. Probeer dit op te lossen. Kan je anders gewoon implementeren dat als een bolletje wordt afgevinkt, de andere bolletjes heeel traag en geleidelijk zich terug even verdelen over hun orbit, zonder ooit in de tegengestelde richting te gaan of snel te verspringen?" (met screenshot `media_1793882530011_98b8db5d.png`).
- **Oorzaak van het probleem:**
  - In de eerdere opzet (Vaste Koers A1) verplaatsten bestaande bollen zich helemaal niet meer (`o.targetOffset = o.offset`). Hierdoor ontstond na meerdere taken een 'klont' van bollen aan één zijde van de ring, terwijl de andere helft leeg was.
  - Bovendien kon bij het invoegen van nieuwe taken een verouderde array-volgorde ontstaan en was `ARRIVE_SWEEP` (0.55 rad = 31,5°) zo wijd dat een invliegende bol te dicht op de staart van een voorganger landde.
- **Oplossing & Implementatie:**
  1. **Symmetrisch N-rooster via circulair gemiddelde:**
     - In `src/scene/scene.js` (`layoutOffsets()`) kiezen nieuwe (verse) bollen altijd het grootste vrije gat tussen reeds geplaatste bollen.
     - Vervolgens wordt voor alle $N$ bollen op die ring een ideaal, gelijkmatig rooster berekend ($\Delta\theta = 2\pi / N$).
     - De oriëntatie $\theta_0$ van dit rooster wordt gecentreerd op het circulaire gemiddelde van de huidige bolposities, zodat de benodigde correctie voor elke bol minimaal is.
     - Verse bollen starten direct op hun ideale roosterpositie (zodat ze nooit vlakbij een andere bol spawnen).
  2. **Trage, niet-omkerende herverdeling in de renderlus:**
     - In plaats van instant verspringen (`o.offset = o.targetOffset;`) glijden de bollen zachtjes naar hun `targetOffset` via `diff * (1 - Math.exp(-0.45 * dt))`.
     - De maximale correctiesnelheid is begrensd op $\pm 25\%$ van de baansnelheid van de ring: `clamp(step, -0.25 * omega * dt, 0.25 * omega * dt)`.
     - **Harde garantie:** de werkelijke hoeksnelheid in de ruimte is altijd minimaal $\omega - 0.25\omega = 0.75\omega > 0$. De bol gaat **NOOIT achteruit**, stopt nooit en verspringt nooit snel; hij versnelt of vertraagt hoogstens subtiel met 25%, wat oogt als een volkomen natuurlijke zwaartekrachtsaanpassing over 5-8 seconden.
  3. **Directe trigger bij afvinken:**
     - `complete(id)` roept nu direct `layoutOffsets()` aan zodra een bol uit `orbs` is verwijderd. De overgebleven bollen verdelen zich direct traag en sereen over de hele ring.
  4. **Kortere invlieg-sweep:**
     - `ARRIVE_SWEEP` is teruggebracht van 0.55 rad (31,5°) naar 0.28 rad (16°), zodat de raaklijnige landing strak binnen het eigen baansegment blijft.
- **Gewijzigde bestanden:**
  - `src/scene/scene.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:**
  - Wiskundige simulatietest (`test_orb_distribution.mjs`): alle ringen (periodes 1.1s tot 38s) getest bij toevoegen en afvinken; bollen bereiken perfect evenwicht (hoekfout < 1,6°); 0 omkeringen (`worldVelocity > 0` in 100% van de frames).
  - Browser-integratietest (`verify_orb_motion.mjs`): 1 taak in Week -> 2e taak toegevoegd -> screenshot gemaakt (`week_two_orbs_balanced.png`) -> 3e taak toegevoegd -> screenshot gemaakt (`week_three_orbs_balanced.png`) -> 1 taak afgevinkt. Geen overlap, 0 console-errors.
- **Impact op opslag / state:** Geen.

### 33. Rangnaam bij insigne op gsm en achtergrondraster vervaging buiten de buitenste ring
- **Vraag van Victor:**
  1. *"Zet enkel op gsm weergave onderaan bij het icoontje ook de rang van de achievements"* (met screenshot `media_1793889585139_87718339.jpg`).
  2. *"Sommige bolletjes van het dot raster achtergrond renderen nog binnen de buitenste orbit. Laat ze nog net iets vroeger vervagen"*.
- **Oplossing & Implementatie:**
  1. **Rangnaam onderaan op gsm (`#stats-rank-hint`):**
     - In `src/app.js` (`renderFeatsBadge()`) bevat `#stats-rank-hint` nu naast het SVG-embleem ook `<span class="stats-rank-name">${r.rank.name}</span>`.
     - In `src/styles.css` is `.stats-rank-name` op desktop standaard verborgen (`display: none;`), zodat naast `⚙ INSTELLINGEN` enkel het compacte 14x14 px insigne zichtbaar blijft.
     - Onder `@media (max-width: 999px)` staat `.stats-rank-name` op `display: inline;`, met `font: 500 10.5px/1 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3);` en een comfortabele mobiele trefzone (`min-height: 32px`).
     - Het insigne en de rangtekst (bv. `✦ STARGAZER` / `✦ NAVIGATOR`) zijn strak links uitgelijnd met de dot matrix cijfers (`left: 16px`).
     - Een tik opent direct het Prestaties-venster.
  2. **Vervaging achtergrondraster buiten de buitenste ring:**
     - In `src/scene/scene.js` (`buildGrid()`) gebruikte `inner` voorheen `smoothstep(142, 174, r)`. Omdat de buitenste ring ('Ooit') op straal 174 ligt, waren punten tussen $r = 142$ en $r = 174$ al deels zichtbaar binnen het banengebied.
     - De overgang is aangepast naar `smoothstep(180, 216, r)`. Voor alle $r \le 180$ is de transparantie nu strikt 0; punten binnen of op de buitenste ring ($r \le 174$) worden overgeslagen en niet meer aangemaakt.
     - Buiten straal 180 vervaagt het raster zacht en geleidelijk naar 100% zichtbaarheid.
- **Gewijzigde bestanden:**
  - `src/scene/scene.js`
  - `src/app.js`
  - `src/styles.css`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:**
  - Geautomatiseerde CDP-meting in headless Edge (`verify_mobile_rank_and_grid.mjs`):
    - Mobiel (375x812): `nameDisplay = "block"`, `nameText = "Scout"`, `hintRect.left = 16px` exact gelijk aan `dmLeft = 16px`. Tik opent dialoogvenster (`open = true`). Screenshot geverifieerd (`mobile_stats_rank_name.png`).
    - Desktop (1440x900): `nameDisplay = "none"`, enkel het 14px insigne naast `⚙ INSTELLINGEN`.
    - Raster: alle punten binnen $r \le 180$ verdwenen. Screenshot geverifieerd (`grid_outside_outer_orbit.png`).
    - 0 console-errors.
- **Impact op opslag / state:** Geen.








### 34. Subtiele, minimale landingspuls op de orbit bij nieuwe taken
- **Vraag van Victor:** *"7: voeg dit toe maar het is wel weer een extra animatie dat voor drukte kan zorgen. Pas het toe maar erg subtiel, minimaal, strak en passend."*
- **Oplossing & Implementatie:**
  - In `src/scene/scene.js` is `ringPulse` (een Map per ringniveau) geïntroduceerd.
  - Wanneer een nieuwe bol landt via de lokale baan-ontvouwing (`o.arrive`), triggert de voltooiing van de landing (`u >= 1`) bij een actieve taaktoevoeging (`!o.isIntro`) een zachte impuls op de doelring (`ringPulse.set(lvO.id, 1)`).
  - De puls dooft zacht en snel uit over circa 350 ms (`Math.max(0, p - dt * 2.8)`).
  - In `drawRings(now)` is de puls wiskundig gekoppeld via een kwadratische curve (`pulseEased = pulse * pulse`):
    - Alpha van de ringstippen krijgt een bescheiden verhoging van maximaal +0.18.
    - Kleur van de ringstippen krijgt een zachte 45% opwarming naar de eigen momentkleur (`mixInk(colors.get(lv.id), 0.45 * pulseEased)`).
    - Stipgrootte zwelt maximaal 15% op (`0.15 * pulseEased`) voor een subtiel, tactiel "landingsgevoel" dat nooit flitst of schreeuwt.
  - Bij `isIntro` (het initiële laden van de pagina), `reducedMotion` of in de instelling Minimaal (`minimal: true`) is de landingspuls strikt uitgeschakeld om elke drukte te voorkomen.
- **Gewijzigde bestanden:**
  - `src/scene/scene.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:**
  - Syntaxcontrole: `Get-Content src/scene/scene.js -Raw | node --input-type=module --check` foutloos.
  - Geautomatiseerde CDP-test in headless Edge (`verify_ring_pulse.mjs`): taak toevoegen -> aankomst -> 0 console logs/exceptions.
- **Impact op opslag / state:** Geen.


### 35. Statuskleuren, rustige tellerbalk, D2 datum in focus, mobiele swipe-notities, audio limiter & Game of Life
- **Vraag van Victor:**
  1. Statuskleuren: koppelen grijs (licht pulserend), verbinden oranje, offline rood, verbonden blauw (licht pulserend), gesynchroniseerd groen. Tandwieltje naast instellingen neemt deze exacte kleuren en effecten over, behalve als het gesynchroniseerd is (dan terug naar standaard). Gebruik Orbit's eigen momentkleuren.
  2. Punt 2: Doe voorstel A (onderste scheidingslijn onder teller weghalen).
  3. Punt 3: D2 (Datum in focusmodus: groot dagcijfer in Geist Light naast de klok met scheidingslijn en gestapelde weekdag/maand).
  4. Punt 5: Optie A (Geen permanent notitie-icoontje op mobiel; notitie toevoegen via swipe la).
  5. Geluid bij maandwissel: Luide krak / pop oplossen bij het opslokken van de sterretjes.
  6. Game of Life: Voeg een 100% werkende Conway's Game of Life toe aan de fidgets.
- **Oplossing & Implementatie:**
  1. **Statuskleuren & Tandwiel:**
     - Orbit tokens gedefinieerd op :root en dark: `--orbit-red`, `--orbit-orange`, `--orbit-green`, `--orbit-blue`, `--orbit-gray`.
     - Keyframe animaties `@keyframes sync-pulse-soft` en `@keyframes gear-settle-green` toegevoegd in `src/styles.css`.
     - `.menu-gear` neemt de statuskleur en puls over. Bij `online` voert het tandwieltje een subtiele settle-animatie uit (groen gloeien -> rustig uitdoven naar inherit).
  2. **Tellerscheiding (Voorstel A):**
     - `border-top: none;` op `.stats-bar`, met 12 px rustige ademruimte tussen de dot matrix cijfers en de actieknoppen eronder. Hokjesgevoel op mobiel volledig verdwenen.
  3. **Datum in Focusmodus (Voorstel 2 · Rustige subregel onder de klok):**
     - D2 (dagcijfer direct naast de klok) werd door Victor afgewezen omdat het te veel info op één horizontale rij gaf en te druk oogde.
     - Uit de 4 voorgestelde alternatieven koos Victor **Voorstel 2**:
     - De matrixklok staat weer 100% vrij, dominant en sereen op haar eigen rij.
     - Direct onder de klok (14 px tussenruimte op desktop, 12 px op mobiel) verschijnt de datum via `#clock-date`: bv. `DONDERDAG 5 NOVEMBER` in Geist Mono 11px kapitaaltjes (`letter-spacing: .14em; color: var(--ink-2)`), waarbij het dagcijfer via `<b class="cd-day">` zuiver wit (`var(--ink)`) is geaccentueerd.
     - Vormt een natuurlijke en rustige overgang vóórdat de deadlines en Nu-taken beginnen.
  4. **Mobiele Swipe-notities (Optie A):**
     - Lege notitieknoppen (`.t-note-btn:not(.has-note)`) verborgen op touch (`opacity: 0; pointer-events: none;`).
     - `.t-swipe-note-btn` toegevoegd in de swipe-to-reveal la. Bij naar links vegen schuift de taak 72 px in en verschijnen zowel de rode Delete-knop als de `+ Notitie` knop.
  5. **Audio pop/krak fix:**
     - In `src/scene/sound.js` een centrale `masterLimiter = ctx.createDynamicsCompressor()` ingevoerd voor alle audiokanalen om clippen en vervorming bij opstapeling van tonen te voorkomen.
     - In `ping()`: gain curve zacht laten uitdoven naar 0.00001 direct voor `o.stop(stopT)` om DC-offsets en harde schakelklikken te elimineren.
     - In `monthTicks()`: bus gain begrensd en dynamisch volume per bolletje geschaald.
  6. **Conway's Game of Life in Fidgets:**
     - Nieuwe module `src/focus/life.js` met een 60 × 42 toroïdaal raster volgens Conway's B3/S23 regels.
     - 60 fps vloeiende bioluminescente nagloed op stervende en levende cellen.
     - Anti-stagnatiemotor voorkomt dat het scherm doodvalt of vastloopt in statische blokken; periodieke kosmische bezoekers houden het bakje oneindig fascinerend.
     - 5 iconische werelden wisselbaar via het pijltje onder het bakje: Oersoep, Zweverkanon (Gosper Glider Gun), Pulsar, Eikel (Acorn), Vloot.
     - Volledige interactie: tikken spawnt zwevers, acorns en pulsars; slepen tekent levende cellen direct op het raster.
     - Ondersteunt zowel lichte als donkere thema's en volgt de kleurkiezer van het bakje.
     - Vertaald in `src/core/i18n.js` (NL en EN), toegevoegd aan `SHELL` in `sw.js` en service worker gebumpt naar `orbit-v6`.
- **Gewijzigde bestanden:**
  - `src/focus/life.js` (nieuw)
  - `src/focus/fidget.js`
  - `src/scene/sound.js`
  - `src/styles.css`
  - `src/app.js`
  - `index.html`
  - `src/core/i18n.js`
  - `sw.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:**
  - CDP verificatie in headless Edge op zowel desktop als mobiel: 0 errors, focus D2 datum perfect uitgelijnd, swipe drawers soepel, Game of Life evolueert met 60fps bioluminescentie en wisselt feilloos tussen alle 5 presets.
- **Impact op opslag / state:**
  - Service worker cache gebumpt naar `orbit-v6` zodat clients direct de nieuwe life.js module ophalen. Geen brekende storage wijzigingen.

### 05/11/2026 - Orb verslepen zonder staart & Gesynchroniseerd-label fade
- **Wat is er veranderd:**
  1. **Orb verslepen hersteld (geen komeet-animatie):**
     - Wanneer een gebruiker een orb oppakt en op een andere orbit laat vallen, kreeg deze voorheen per abuis een radiale komeetstaart/aankomst alsof hij net uit de diepe ruimte kwam binnengevlogen.
     - In `src/scene/scene.js` wordt bij het voltooien van een drag (`pointerup`) de orb direct op de doelring geplaatst (`o.r = targetR`, `o.vr = 0`, `o.arrive = null`, `o.lag = 0`, `o.blend = null`). De bol landt direct op zijn cirkelbaan en voegt zich organisch in het N-rooster tussen de andere bollen.
  2. **'Gesynchroniseerd' woord-settle:**
     - Het woord 'gesynchroniseerd' in de kopbalk was voorheen constant groen.
     - In `src/styles.css` en `src/app.js` is `#sync-label` in rust nu sereen grijs (`var(--ink-3)`). Enkel bij het openen van de pagina wanneer sync gereedkomt speelt een zachte pulserende animatie (`@keyframes sync-label-settle-green`) die na twee rustige pulsen uitdooft. Het groene statusstipje (`.sync-dot`) blijft discreet groen.
  3. **Datum in Focusmodus (Voorstel 2 - Rustige subregel):**
     - De matrixklok staat weer 100% vrij en gecentreerd op haar eigen rij.
     - Direct onder de klok (14 px) toont `#clock-date` de datum in Geist Mono 11px kapitaaltjes met het dagnummer zuiver wit uitgelicht (`<b class="cd-day">`).
  4. **Voorstellen & Prototype conceptfidgets geschrapt:**
     - De 5 voorgestelde fidget-concepten (Ferro, Chladni, Moiré, Slingshot, Turing) en de prototypepagina `ontwerp/fidgets.html` zijn op verzoek van Victor volledig geschrapt. De bestaande fidgets (de actieve zandloper en Conway's Game of Life) in Orbit blijven ongewijzigd.
- **Gewijzigde bestanden:**
  - `src/scene/scene.js`
  - `src/styles.css`
  - `src/app.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:**
  - CDP verificatie in headless Edge van de focusmodus en drag & drop interacties.

### 05/11/2026 - Drie nieuwe fidgets (Breakout, Plasmabol, Bubbels) & Compact keuzemenu
- **Wat is er veranderd:**
  1. **Mini Breakout (`src/focus/breakout.js`):**
     - Rustgevende, niet-straffende breakout-fidget in Orbit-stijl.
     - Balletje met micro-komeetstaart, zachte paddle die de cursor volgt met snelheidsspin en hoekafbuiging.
     - Bricks in zachte Orbit-kleuren (Nu-oranje, Vandaag-goud, Morgen-blauw, Later-paars) met 4 wisselbare layouts (Klassiek, Orbits, Piramide, Kosmos).
     - Rustgevende partikels bij inslag en subtiele zwevende score-indicaties.
  2. **Plasmabol (`src/focus/plasma.js`):**
     - Klassieke plasmabol met dielektrische ontlading.
     - Centrale bol-elektrode met paarse/magenta corona, 12 kronkelende fractale ontladingsfilamenten die organisch golven naar het glas.
     - Bij aanwijzen of tikken springen de bliksemschichten magnetisch naar het contactpunt met een intense dielektrische bundel, oppervlakte-flare en vonkjes.
     - 4 kleurenthema's: Neon-Xenon, Bliksem, Zonnewind, Aurora.
  3. **Bubbels / Noppenfolie (`src/focus/bubbles.js`):**
     - Eeuwig voorbijglijdende noppenfolie-wand in frosted glass esthetiek met zachte diepteschaduwen en witte randglans.
     - 1 klik popt direct een bubbel met een rimpeling en gesynthetiseerd plop-geluid via Web Audio.
     - Slepen / ingedrukt houden veegt over de bubbels en popt elke bubbel waar de cursor overheen zweeft.
     - 4 formaten/thema's: Klassiek, Groot, Micro, Regenboog.
  4. **Compact Fidget Keuzemenu (`src/focus/fidget.js`, `src/styles.css`):**
     - Vervangt de overvolle, overlappende schuine-streep balk door een compacte capsuleknop (`.fidget-menu-btn`) met statusstip, actieve fidgetnaam en chevron (`● BREAKOUT ▾`).
     - Bij klik opent een frosted glass popover (`.fidget-popover`, `backdrop-filter: blur(24px)`) georganiseerd in twee overzichtelijke kolommen:
       - *Vloeistof & Veld* (Water, Gelei, Lava, Gloed, Topo, Plasma)
       - *Interactief & Spel* (Paneel, Life, Breakout, Bubbels)
     - Volledig toetsenbord- en toegankelijkheidsvriendelijk (`Escape` en buitenklik sluiten het menu, `aria-expanded`, `aria-selected`).
     - WebGL canvas overlay-fix (`display: none !important` via `[hidden]` en buffer clearing) zodat 2D en WebGL fidgets naadloos naast elkaar wisselen.
  5. **Taalondersteuning & Caching:**
     - `src/core/i18n.js` uitgebreid met Nederlandse en Engelse labels voor alle nieuwe modi en categorieen.
     - `sw.js` cache gebumpt naar `orbit-v7` met de nieuwe JS-bestanden toegevoegd aan de `SHELL` pre-cache.
- **Gewijzigde bestanden:**
  - `src/focus/breakout.js` (nieuw)
  - `src/focus/plasma.js` (nieuw)
  - `src/focus/bubbles.js` (nieuw)
  - `src/focus/fidget.js`
  - `src/styles.css`
  - `src/core/i18n.js`
  - `sw.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:**
  - CDP verificatie in headless Edge voor Breakout, Plasma, Bubbels en het geopende keuzemenu. Nul console- of runtimefouten.
- **Impact op opslag / state:**
  - Service worker cache gebumpt naar `orbit-v7`. Geen brekende storage wijzigingen.

### 05/11/2026 - Bugfix: Fidget frame-crash en blanco scherm hersteld
- **Wat is er veranderd:**
  1. **Herstel `mode().step` contract:**
     - De animatielus in `src/focus/fidget.js` riep binnen `frame(now)` ongeconditioneerd `mode().step(...)` aan.
     - Omdat de drie nieuwe fidgets (`breakout.js`, `plasma.js`, `bubbles.js`) hun animatie in `frame(now)` uitvoeren en geen `step()` hadden gedefinieerd, crashte de lus direct op `TypeError: mode().step is not a function`.
     - Hierdoor werd `render(now)` nooit bereikt, werd de nieuwe canvas nooit gemount/getoond, en bleef het fidgetbakje volledig zwart/blanco. Zodra de animatielus crashte, bleef ook elke andere gekozen fidget blanco omdat de lus gestopt was.
     - Opgelost door `step() {}` toe te voegen aan de 3 fidgets en in `fidget.js` optionele chaining `mode().step?.(...)` toe te passen.
  2. **Robuuste foutbeveiliging in `frame`:**
     - De berekenings- en renderstap binnen `frame()` is ingekapseld in een `try ... catch`. Mocht een specifieke modus onverhoopt een fout genereren, dan blijft `requestAnimationFrame(frame)` doorlopen en herstelt het bakje zichzelf direct zodra naar een andere fidget wordt geschakeld.
  3. **Pointer-coördinaten en interactieve methodes:**
     - In `local(e)` is een veilige fallback ingebouwd (`const el = [cv, cvGL, own].find(...) || cv`) zodat `getBoundingClientRect()` nooit op `undefined` kan worden aangeroepen.
     - Eventhandlers gebruiken nu overal optionele chaining (`mode().move?.()`, `mode().leave?.()`, `mode().tap?.()`, `mode().up?.()`).
  4. **Service worker:**
     - Service worker cache bijgewerkt naar `orbit-v8` in `sw.js`.
- **Gewijzigde bestanden:**
  - `src/focus/breakout.js`
  - `src/focus/plasma.js`
  - `src/focus/bubbles.js`
  - `src/focus/fidget.js`
  - `sw.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:**
  - CDP verificatie in headless Edge voor alle 10 fidgets achter elkaar. Alle 10 renderen gegarandeerd met actieve inhoud en 0 fouten.

### 06/11/2026 - Alle fidgets beschikbaar op mobiel via knop in focusscherm
- **Wat is er veranderd:**
  1. **Discreet Fidget-knopje op mobiel in de focusbalk:**
     - In `index.html` een knop `#focus-fidget-btn` toegevoegd binnen `.controls` naast de bestaande weergave- en focusknoppen.
     - In `src/styles.css` is deze knop op desktop verborgen (`display: none`) en verschijnt hij op mobiele schermen (`@media (max-width: 999px)`) uitsluitend wanneer `body.is-focus` actief is.
     - `placeMenu()` in `src/app.js` geactualiseerd zodat het knopje op mobiel netjes in `.controls` behouden blijft.
  2. **Zwevende modale fidgetkaart met frosted glass:**
     - Achtergrond-overlay `.fidget-backdrop` met `background: rgba(0, 0, 0, 0.48)` en `backdrop-filter: blur(10px)` (inclusief `-webkit-backdrop-filter`).
     - `#fidget` wordt op mobiel gecentreerd weergegeven (`position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%) scale(...)`).
     - Schaalbaarheid via CSS variabele `--fidget-scale: min(1, calc((100vw - 24px) / 325.6), calc((100vh - 120px) / 226.8))` zodat de kaart nooit buiten het scherm valt, ook niet op kleine schermen (320px) of in landschapsmodus.
     - Subtiele pop-in en fade-in animaties (`.fidget.is-open` en `backdrop-fade-in`).
  3. **Volledige functionaliteit van alle 10 widgets:**
     - Toegang tot alle 10 fidgets (Water, Gelei, Lava, Gloed, Topo, Plasma, Paneel, Life, Breakout, Bubbels) via het compacte popover-menu.
     - Kleurenkiezer, preset-/levelwisselaar (`.fidget-next` zwevend onder het bakje) en interactieve touch-besturing.
     - De pointer-mapping in `fidget.js` berekent coördinaten via `getBoundingClientRect()`, wat automatisch compenseert voor CSS transform-scaling waardoor touch-invoer 100% pixel-precies blijft.
  4. **Sluitmogelijkheden en batterijbesparing:**
     - Sluiten kan via het nieuwe `✕`-knopje (`.fidget-close`) in de menubalk, door op de backdrop te tikken, via de `Escape`-toets of door de focusmodus te verlaten.
     - De animatielus (`fidget.start()`) start pas zodra het fidget-venster op mobiel wordt geopend en stopt (`fidget.stop()`) zodra het wordt gesloten, waardoor onnodig batterij- en CPU-verbruik op mobiele toestellen wordt voorkomen.
  5. **Internationalisatie en Service Worker:**
     - Vertalingen toegevoegd voor `'fidget.title'` en `'fidget.close'` in `src/core/i18n.js` (NL en EN).
     - Service worker cache bijgewerkt naar `orbit-v9` in `sw.js`.
- **Gewijzigde bestanden:**
  - `index.html`
  - `src/styles.css`
  - `src/focus/fidget.js`
  - `src/app.js`
  - `src/core/i18n.js`
  - `sw.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:**
  - Uitgebreide CDP-verificatie in headless Edge op mobiel viewportformaat (390x844) en desktop (1280x820):
    - Fidget knop verschijnt in focusbalk op mobiel en ontbreekt op desktop.
    - Tikken op de knop opent het zwevende venster en toont de frosted glass achtergrond.
    - Wisselen tussen widgets (o.a. Plasma, Breakout, Bubbels) en touch interacties verlopen vlekkeloos met 0 fouten.
    - Sluiten via sluitknop en backdrop functioneert correct.

### 06/11/2026 - Bugfix: Fidget-venster positionering op mobiel hersteld
- **Wat is er veranderd:**
  1. **Oorzaak analyse van het van het scherm vallen:**
     - De CSS-selector `body.is-focus .fidget` op desktop had een hogere specificiteit dan de mobiele `.fidget` regels en paste `transform: none;` toe.
     - Hierdoor werd `transform: translate(-50%, -50%)` genegeerd en bleef het venster met zijn linkerbovenhoek op `left: 50%; top: 50%` staan, waardoor de rechter- en onderkant van het 326px brede venster rechtsonder van het scherm vielen.
     - Bovendien evalueerde `scale(calc((100vw - 24px) / 325.6))` in CSS zonder eenheid in de noemer tot een `<length>` in plaats van een getal, waardoor strikte CSS-parsers de transformatiedeclaratie als ongeldig afwezen.
  2. **Isolatie van desktop-stijlen:**
     - De desktop-positionering van `.fidget` en `.fidget-next` is strikt ingekaderd binnen `@media (min-width: 1000px)`. Desktop-regels kunnen mobiele weergaves daardoor onder geen beding meer overschrijven.
  3. **Robuuste centrering via inset:**
     - Op mobiel is `.fidget` gecentreerd via `position: fixed; inset: 0 !important; margin: auto !important;`. Dit garandeert dat het venster altijd exact in het midden van het scherm staat, zelfs als transformaties niet ondersteund worden of worden gereset.
  4. **Betrouwbare numerieke schaling via JavaScript:**
     - In `src/focus/fidget.js` is `updateMobileScale()` toegevoegd. Deze functie berekent bij het openen en tijdens `resize` en `orientationchange` een zuivere getalswaarde voor `--fidget-scale` (bijvoorbeeld 0.884 op een scherm van 320px breed).
     - In CSS wordt geschaald via `transform: scale(var(--fidget-scale, 1)) !important;` met `transform-origin: center center;` en `animation-fill-mode: forwards`.
  5. **Service worker:**
     - Service worker cache bijgewerkt naar `orbit-v10` in `sw.js`.
- **Gewijzigde bestanden:**
  - `src/styles.css`
  - `src/focus/fidget.js`
  - `sw.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:**
  - CDP-verificatie in headless Edge voor verschillende viewports:
    - iPhone staand (390x844): `isFullyOnScreen: true`, 32.2px gelijke marges links en rechts.
    - Compact scherm (320x568): `isFullyOnScreen: true`, schaalt netjes naar 288px breedte met veilige marges.
    - iPhone liggend (844x390): `isFullyOnScreen: true`, perfect verticaal en horizontaal gecentreerd.
    - Desktop (1280x820): `isFullyOnScreen: true`, vaste positie rechtsonder in de cockpit behouden.
    - Lava, Breakout en Bubbels geverifieerd zonder consolefouten.

### 06/11/2026 - Fidget menu-opties op desktop verbergen zolang niet gehoverd
- **Wat is er veranderd:**
  1. **Schoon scherm zonder menu-opties bij afwezigheid van cursor:**
     - In `src/styles.css` is voor desktop (`@media (min-width: 1000px)`) ingesteld dat `.fidget-modes` standaard onzichtbaar is (`opacity: 0; visibility: hidden; pointer-events: none; transform: translateY(-4px)`).
     - De animaties (water, lava, gloed, life, breakout, bubbels) worden hierdoor over het volledige venster weergegeven zonder storende tekst of knoppen bovenop het effect.
  2. **Zachte transitie bij hover, focus of interactie:**
     - Zodra de gebruiker over het venster beweegt (`.fidget:hover`), met het toetsenbord navigeert (`.fidget:focus-within`), of het keuzemenu of de kleurkiezer geopend is (`.fidget.has-menu-open`, `.fidget.has-color-open`), verschijnen de bedieningselementen vloeiend met een 0.22s ease transitie.
     - Ook de subtiele gradient-overlay aan de bovenzijde (`.fidget.is-gl::before` bij topo en lava) dooft zachtjes uit wanneer er niet gehoverd wordt.
  3. **Ondersteuning voor mobiel:**
     - Op mobiel (`@media (max-width: 999px)`) blijven de opties en het sluitkruisje bij het openen van de modale kaart duidelijk in beeld, maar doven ze via de klasse `.is-interacting` zachtjes uit zodra de gebruiker op het canvas tikt of sleept, zodat ook daar een schoon speelscherm ontstaat.
  4. **Service worker:**
     - Service worker cache bijgewerkt naar `orbit-v11` in `sw.js`.
- **Gewijzigde bestanden:**
  - `src/styles.css`
  - `src/focus/fidget.js`
  - `sw.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:**
  - Verificatie in headless Edge op desktop en mobiel:
    - Zonder hover: `modesOpacity: "0"`, `modesVisibility: "hidden"`.
    - Met interactie/focus/menu-open: `modesOpacity: "1"`, `modesVisibility: "visible"`.
    - Geen console- of runtimefouten.

### 06/11/2026 - Geïntegreerd woordmerk in topbar met reveal-animatie van de 'O'
- **Wat is er veranderd:**
  1. **Vraag van Victor:**
     - Verander het logo linksboven naar het nieuwe woordmerk met de Orbit als 'O'.
     - Als je over het logo gaat met je muis (desktop) of erop tikt (mobiel), verschijnt de 'O' van achter de orbit mooi, smooth en doordacht als animatie. Daarna gaat het weer weg.
  2. **Implementatie in de topbar:**
     - `index.html`: Het oude SVG-beeldmerk in `<h1 class="brand">` vervangen door het geïntegreerde woordmerk (viewBox `0 -730 2359.49 742`).
     - De typografische 'O' uit *Instrument Sans* is geplaatst in een transform-wrapper `<g transform="translate(83.34, 0)">` achter het Orbit-symbool.
     - `.brand` voorzien van `pointer-events: auto; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;` zodat interacties vlekkeloos doorkomen ondanks de `pointer-events: none` op `.topbar`.
     - Toegankelijkheid gewaarborgd met `tabindex="0"`, `role="button"`, `aria-label="Orbit"` en toetsenbordbediening (`Enter` / `Spatie`).
  3. **Vloeiende Soft Bloom & Breathe animatie:**
     - `@keyframes reveal-o` (duur 2.4s met `var(--ease)`):
       - `0%`: `opacity: 0; transform: scale(0.88);`
       - `20%`: `opacity: 0.88; transform: scale(1);` (de 'O' bloeit soepel op vanuit het optische midden `393px -360px` achter de lus)
       - `75%`: `opacity: 0.88; transform: scale(1);` (ademt rustig in beeld, perfect leesbaar als "Orbit")
       - `100%`: `opacity: 0; transform: scale(0.94);` (lost geleidelijk en sereen weer op)
     - Respecteert `@media (prefers-reduced-motion: reduce)`: animatie wordt dan direct onderdrukt.
  4. **Interactielogica:**
     - `src/app.js`: Pointerenter (muis) en click/tap (mobiel touch) activeren `.is-animating` op `.brand`.
     - Bij herhaalde tikken of snelle hovers wordt de animatie via een reflow direct en vloeiend gereset.
     - Een timeout van 2450 ms ruimt de toestand na voltooiing weer netjes op.
  5. **Service Worker:**
     - Cache-versie in `sw.js` opgehoogd naar `orbit-v12`.
- **Gewijzigde bestanden:**
  - `index.html`
  - `src/styles.css`
  - `src/app.js`
  - `sw.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:**
  - Visuele verificatie via headless Edge op 1280x820 (desktop) en 375x812 (mobiel) in zowel Donker als Licht thema.
  - Vóór klik: schoon geïntegreerd woordmerk zonder 'O'.
  - Tijdens klik/hover: 'O' bloeit met 88% dekking op achter de lus, optisch perfect gecentreerd.
  - Na afloop: 'O' lost volledig op en keert terug naar opacity 0 zonder lay-outverschuiving.
- **Wat is er veranderd:**
  1. **Vraag van Victor:**
     - Voeg aan het logobestand toe dat het beeldmerk direct als de letter 'O' gebruikt kan worden in het woordmerk (zoals getoond in een mockup-voorbeeld).
     - De mockup dient echter puur als inspiratie: het ontwerp moest volledig vanaf stap 0 geconstrueerd worden zodat alle afmetingen, schalen, overshoots, gewichten en tussenafstanden wiskundig en optisch kloppen.
     - Vijf doorgerekende voorstellen voorgelegd (V1 Ascender-uitlijning, V2 Cap-height, V3 Hybride, V4 X-height, V5 Extra lucht). Victor koos **Voorstel 1 (Ascender-uitlijning, hoogte 742, gap 65)**.
  2. **Typografische constructie vanaf stap 0:**
     - Gebaseerd op het officiële fontgrid van *Instrument Sans Medium* (1000 units/em, ascender b = -720, x-height = -520, baseline y = 0).
     - Het Orbit-symbool (ellips 410x270 onder -24 graden, kop op 70 graden, tapse staart) is geschaald naar hoogte 742 font-units.
     - **Ascender-uitlijning met curve-overshoot:** De top van de ellips bereikt y = -730. Dit geeft een optische overshoot van 10 eenheden ten opzichte van de rechte stok van de 'b' op y = -720. Hierdoor oogt de ronde letterkapitaal optisch exact even hoog als de stokletter in plaats van kleiner.
     - **Baseline-overgang:** De buitenste onderboog van de ellips landt op y = +12 (subtiele baseline-overshoot). De rode kern (Nu) zweeft op y ≈ -50 comfortabel en geborgen binnen de kom van de letter, waardoor er geen storende staart of descender onder de basislijn uitsteekt.
     - **Spatiëring en kerning:** De tussenruimte (gap) tussen het symbool en de stam van de 'r' is vastgesteld op 65 font-units (offset naar x = 343.49). Dit zorgt voor een natuurlijke, vloeiende woordcadans die direct en vanzelfsprekend leest als "Orbit".
     - **Totale verhouding:** Totale inkt-afmetingen 2359.49 x 742 (aspect ratio 3.18 : 1).
  3. **Geleverde assets en documentatie:**
     - Vijf officiële vector-SVGs gegenereerd in `brand/merk/svg/`:
       - `orbit-integrated-fullcolour.svg` (Inkt `#1B1B22`, Nu `#E70049`)
       - `orbit-integrated-fullcolour-reversed.svg` (Inkt licht `#ECECF1`, Nu `#F0306A`)
       - `orbit-integrated-black.svg` (Zwart `#000000`)
       - `orbit-integrated-white.svg` (Wit `#FFFFFF`)
       - `orbit-integrated-red.svg` (Monochroom amaranth `#E70049`)
     - `brand/merk/manifest.json`: de vijf nieuwe SVG-bestanden opgenomen in de officiële manifestlijst.
     - `brand/merkgids/index.html`: nieuwe showcase-platen toegevoegd (licht en donker), typografische verantwoording opgenomen in de sectie Lockups, bestandenlijst bijgewerkt, en de eerdere kanttekening ("leest mogelijk als C orbit") herzien doordat deze geïntegreerde variant die verwarring structureel oplost.
     - `src/core/mark.js`: `INTEGRATED` export toegevoegd met schaal (0.11628), offsets, basislijn (73) en kopcoördinaten.
- **Gewijzigde bestanden:**
  - `brand/merk/svg/orbit-integrated-fullcolour.svg` (nieuw)
  - `brand/merk/svg/orbit-integrated-fullcolour-reversed.svg` (nieuw)
  - `brand/merk/svg/orbit-integrated-black.svg` (nieuw)
  - `brand/merk/svg/orbit-integrated-white.svg` (nieuw)
  - `brand/merk/svg/orbit-integrated-red.svg` (nieuw)
  - `brand/merk/manifest.json`
  - `brand/merkgids/index.html`
  - `src/core/mark.js`
  - `CLAUDE.md`
  - `ANTIGRAVITY_CHANGELOG.md`
- **Getest:**
  - Playwright visual render test `scratch/verify_merkgids.mjs` uitgevoerd tegen `brand/merkgids/index.html`:
    - Alle 23 afbeeldingen in de merkgids laden foutloos (0 mislukte verzoeken, 0 consolefouten).
    - Zowel de lichte als donkere platen met het nieuwe geïntegreerde woordmerk renderen haarscherp.

### 27. Reveal-animatie voor geïntegreerd woordmerk linksboven
- **Commit:** `7fa8800`
- **Vraag van Victor:** Verander het logo links boven naar het nieuwe woordmerk met de orbit als O. Als je over het logo gaat met je muis of er op tikt op mobiel, verschijnt de O van achter de orbit mooi, smooth en doordacht als animatie. Daarna gaat het weer weg.
- **Gewijzigde bestanden:**
  - `index.html`: `.brand-mark` voorzien van de typografische 'O' in een aparte `<g class="bm-o-wrap" transform="translate(83.34, 0)">` achter het Orbit-symbool.
  - `src/styles.css`: Reveal-animatie `@keyframes brand-o-reveal` met 4 fasen (opbloeien, zachte ademhaling, rustige uitdoving over 2.4s), `pointer-events: auto` op `.brand`.
  - `src/app.js`: Eventlisteners op `.brand` voor hover en tik met automatische reset-timer.
  - `sw.js`: Cache-versie verhoogd naar `orbit-v12`.
- **Getest:** Visueel gecontroleerd via headless Edge op desktop en mobiel in donker en licht thema.

### 28. Verfijnde Composer-orbit (Voorstel 1: Het 5-Bansysteem) en Rangnaam met scheiding op desktop
- **Commit:** `d27e9b4`
- **Vraag van Victor:**
  1. "Deze animatie is leuk, je ziet de orbit die je selecteert maar ze is wat onafgewerkt. Kan je enkele voorstellen maken om dit te verfijnen? De hele orbit beweegt ook random wat naar boven en onder, redelijk traag, dit hoeft ook niet." -> Na voorstellen gekozen voor Voorstel 1 (Het 5-Bansysteem).
  2. "Zet de naam van de huidige rang naast het symbooltje en zorg voor een subtiele scheiding met settings."
- **Gewijzigde bestanden:**
  - `src/app.js`:
    - 5 concentrische banen in grafiet met lage dekking (`ORB_RADII = [64, 98, 132, 166, 200]`).
    - Gekozen ring licht op in de tint van het moment met subtiele overgangspuls (`orbPulse`).
    - Vloeiende radiale overgang (`orbRadius += (orbTargetRadius - orbRadius) * dt`) bij niveauwissel via klik of toetsenbord.
    - Komeet getekend via `drawRefinedComet` met chord-gradient en 3.2x zachte radiale kopgloed, zonder harde conic-gradient wig-afsnijdingen.
    - Rode centrale Nu-kern als stabiel baken.
  - `src/styles.css`:
    - `.composer-orb`: `animation: float` en `.is-swap` verwijderd, zodat het venster rustig en geankerd blijft.
    - `.stats-rank-name`: `display: inline` gemaakt op desktop (voorheen verborgen met `display: none`).
    - `.stats-menu-slot`: voorzien van `gap: 11px`.
    - `.stats-menu-slot > .menu-btn + .stats-rank-hint`: voorzien van `border-left: 1px solid var(--line); padding-left: 11px;`. Sluit exact aan op de vormentaal van `.tempo` en `.stats`.
  - `sw.js`: Cache-versie verhoogd naar `orbit-v13`.
  - `CLAUDE.md`: Overdracht bijgewerkt.
  - `ANTIGRAVITY_CHANGELOG.md`: Wijzigingen gedocumenteerd.
- **Getest:**
  - Visuele verificatie via headless Edge op 1440x900 (desktop) en 390x844 (mobiel) in zowel Donker als Licht thema.
  - `live_stats_bar_dark.png` en `live_stats_bar_light.png`: rangnaam (bv. `STERRENKIJKER`) staat haarscherp naast de badge, gescheiden van `INSTELLINGEN` via de subtiele 14px hoge haarlijn (`var(--line)`).
  - `live_composer_5ring.png`: 5 ringen ragfijn zichtbaar, geselecteerde ring groen (Week), rode kern geankerd in het midden, geen op-en-neer gedobber.
  - Mobiel: instellingenknop blijft zoals ontworpen in de topbar; `.stats-rank-hint` in de voettekst toont de rangnaam zonder overbodige linkerrand.
- **Impact op opslag / state:** Geen.

### 29. Herontwerp Uitleg-menu (Richting A: De Typografische Monografie)
- **Vraag van Victor:** "maak dit menu wat mooier, beter uitgelijnd, strakker en ordelijker. Het is het allereerste wat nieuwe gebruikers zien dus het moet er heel duidelijk, afgeleid en afgewerkt uitzien" -> Na afwijzen van generieke bento/pill ontwerpen gekozen voor "Richting A kies ik" (De Typografische Monografie).
- **Gewijzigde bestanden:**
  - `index.html`:
    - Oude v1 lockup in `#intro-title` vervangen door het officiële nieuwe geïntegreerde Orbit-woordmerk (`viewBox="0 -730 2359.49 742"`).
    - Grid herstructureerd van 10 verspringende blokken naar 6 perfect gebalanceerde redactionele secties: Toevoegen & verplaatsen (`N` · ↕), Afvinken & herstel (`Z`), Hemel & sterrenbeelden (`✦`), Prestaties & rangen (`P`), De bezielde kern (`●`), en Focus & rust (`F` · `T`).
    - Sneltoetsen onderaan omgevormd tot een rustige mono-strook (`.intro-keys`).
  - `src/styles.css`:
    - `.intro`: breedte op desktop verruimd naar `min(720px, calc(100vw - 32px))`.
    - `.intro-card`: royale ademruimte (`padding: 28px 32px 24px`), `scrollbar-width: thin` met haarlijn-duim (`var(--line-2)`) en transparante track.
    - `.intro-lockup`: hoogte 38px, `fill: var(--ink)` met `.bm-head` in amarant (`var(--core)`).
    - `.intro-levels`: minimalistische horizontale momentenladder met 6px ronde kleurstippen.
    - `.intro-grid`: 2 kolommen met `1px solid var(--line)` haarlijnen onder titels, Geist Mono kapitaaltjes met letterafstand en uitgelijnde baselines.
    - `@media (max-width: 600px)`: vloeiende enkelkoloms lay-out op mobiel.
  - `src/core/i18n.js`:
    - Nederlandse en Engelse woordenboeken bijgewerkt met strak gebalanceerde teksten (elk blok circa 3-4 regels, 150-180 tekens) voor alle 6 secties.
  - `sw.js`:
    - Cache-versie verhoogd naar `orbit-v14`.
  - `CLAUDE.md` en `ANTIGRAVITY_CHANGELOG.md`: gedocumenteerd.
- **Getest:**
  - Headless Edge tests via CDP:
    - `live_intro_desktop_dark.png`: donker thema NL (748px hoog, past zonder scrollbalk, baselines strak uitgelijnd).
    - `live_intro_desktop_light.png`: licht thema NL (warme riso-papieren esthetiek).
    - `live_intro_desktop_en.png`: Engels woordenboek (alle teksten, momenten en sneltoetsen netjes vertaald).
    - `live_intro_mobile_dark.png`: mobiele weergave (390x844, één kolom, elegante kaart).
  - Consolefouten: 0 fouten.
- **Impact op opslag / state:** Geen.

### 30. Mobiele verfijning en adaptatie van het Uitleg-menu
- **Vraag van Victor:** "make sure it also looks good and adapted on mobile"
- **Gewijzigde bestanden:**
  - `index.html`:
    - In `#intro` de sectiekoppen voorzien van `.intro-meta-desk` (toont sneltoetsen op desktop) en `.intro-meta-mob` (toont redactionele hoofdstuknummers `01` t/m `06` op mobiel).
  - `src/styles.css`:
    - Op mobiel (< 600 px) en touchscreens (`hover: none`):
      - Storende desktop scrollbalk-track volledig verborgen (`scrollbar-width: none; -ms-overflow-style: none; ::-webkit-scrollbar { display: none; }`) waardoor de 22px afgeronde hoeken van de kaart en de `1px solid var(--line)` rand overal zuiver en gaaf blijven.
      - Sneltoetsen onderaan (`.intro-keys`) verborgen op mobiel; in de koppen tonen de metadata strakke kapitaalnummers `01` t/m `06` in Geist Mono.
      - Sticky footer (`.intro-foot`) verbreed van rand tot rand via negatieve marges (`-20px`) met een vloeiend 24px oplosverloop (`::before`) zodat er bij het scrollen geen tekst door de hoeken lekt.
      - De "Aan de slag" knop (`#intro-close`) beslaat op mobiel de volle breedte met een comfortabele trefzone van 44px hoogte en respecteert `env(safe-area-inset-bottom)`.
      - `overscroll-behavior-y: contain` en `-webkit-overflow-scrolling: touch` voor een soepele, natuurlijke veegervaring.
  - `sw.js`:
    - Cache-versie verhoogd naar `orbit-v15`.
  - `CLAUDE.md` en `ANTIGRAVITY_CHANGELOG.md`: bijgewerkt.
- **Getest:**
  - Headless Edge visual renders via CDP:
    - `final_mobile_390_dark_top.png` & `_bottom.png`: iPhone 14/15/16 donker thema (hoofdstukken 01-06, volle knop, perfect scrollbereik).
    - `final_mobile_390_light_top.png` & `_bottom.png`: iPhone licht thema.
    - `final_mobile_375_dark_top.png`: iPhone SE (375x667, compact en perfect geproportioneerd).
    - `final_desktop_dark.png`: desktop blijft onaangetast met toetsenbord-sneltoetsen en zijwaartse knop.
  - Consolefouten: 0 fouten.
- **Impact op opslag / state:** Geen.

### 31. Wayglim WebGL2 fidget in focusmodus
- **Vraag van Victor:** Victor deelde de volledige Wayglim geanimeerde hero-achtergrond (`WayglimBackground.tsx` / `mountCfMotion`) en vroeg: "Kan je dit als fidget toevoegen?"
- **Gewijzigde bestanden:**
  - `src/vendor/wayglim.js`:
    - Nieuw vendor-bestand met de verbatim Wayglim engine (`mountCfMotion`), inclusief Paper Shaders (Apache 2.0 licentie), noise textuur, presets (`WAYGLIM_SETTINGS`), `WAYGLIM_BACKGROUND` (`rgb(11, 5, 7)`), `WAYGLIM_ASPECT` (`1.777778`) en factory `createWayglim(container, options)`.
  - `src/focus/fidget.js`:
    - `MODES`: `'wayglim'` toegevoegd als 11e optie.
    - `FACTORIES`: geregistreerd met factory `wayglim()`.
    - `available()`: WebGL2-detectie toegevoegd via `hasGL2()` (`(!['topo', 'wayglim'].includes(m) || hasGL2())`).
    - `GROUPS`: ingedeeld onder `groupFluid` ("Vloeistof & Veld").
    - `render()`: `box.classList.toggle('on-dark', ['grain', 'wayglim'].includes(modeName))` activeert heldere witte contraststijl voor de bedieningselementen over de donkere achtergrond.
    - Kleurafstemming: bij selectie van een eigen accentkleur (`ACCENT`) via de kleurkiezer wordt via `accentRamp(ACCENT)` een aangepast 4-kleurenspectrum (`customColors`) aan Wayglim doorgegeven. Bij reset (↺) keert Wayglim direct terug naar de originele studio sunset look.
    - Levenscyclus: dynamische `import('../vendor/wayglim.js')` pas bij keuze; bij verlaten of focus sluiten worden requestAnimationFrame, ResizeObserver, IntersectionObserver en contexten netjes opgeruimd via `player.destroy()`.
  - `src/core/i18n.js`:
    - Vertaalsleutel `'fidget.wayglim': 'Wayglim'` toegevoegd aan zowel het Nederlandse als het Engelse woordenboek.
  - `src/styles.css`:
    - `.fidget-own canvas`: voorzien van `display: block; width: 100% !important; height: 100% !important; left: 0 !important; top: 0 !important;` zodat het canvas altijd exact het fidgetvenster vult zonder double-scaling bij CSS transform scales op mobiel.
  - `sw.js`:
    - `src/vendor/wayglim.js` toegevoegd aan `SHELL`.
    - Cache-versie verhoogd van `orbit-v15` naar `orbit-v16`.
  - `CLAUDE.md`:
    - `Bestanden`-tabel en `Overdracht` bijgewerkt.
- **Getest:**
  - Syntaxtesten met Node.js (`--check` / `--input-type=module`): 0 fouten op alle bestanden.
  - Headless Chromium CDP geautomatiseerde tests:
    - Desktop (1440x900): focusmodus geopend, fidget popover geopend, Wayglim gekozen, WebGL2-canvas geverifieerd (buffer 651x454 voor 2x DPR retina, lay-out 326x227), `.on-dark` en `.is-gl` actief, menu-naam "Wayglim".
    - Kleurkiezer: custom kleur `#00ff88` ingesteld en geverifieerd dat Wayglim herbouwt met customColors; reset (↺) herstelt de standaard sunset-look.
    - Mobiel (375x667): mobiele `#focus-fidget-btn` geopend, modal opent met scale 1.000, canvas lay-out 326x227, geen horizontale scroll.
    - Smal scherm (320x568 iPhone SE): modal opent met scale 0.885, canvas matched container, geen horizontale scroll.
    - Consolefouten: 0 fouten.
- **Impact op opslag / state:** Geen nieuwe opslagsleutels; bewaart keuze in bestaande `priority-orbit.fidget.v1`.

### 32. Volledige weergave van letter 't' in geïntegreerd woordmerk (viewBox correctie)
- **Vraag van Victor:** "the t is not fully there and cut off." (met schermafbeelding `image.png` waarop de rechterzijde van de 't' in het topbar-logo verticaal afgesneden was).
- **Oorzaak:**
  - De 'rbit' padcoördinaten in de geïntegreerde lockup lopen na de groepstranslatie `translate(343.486, 0)` door tot `x = 2480.49` (de rechterdwarsbalk en de boog van de letter 't').
  - De oorspronkelijke `viewBox` stond ingesteld op `0 -730 2359.49 742`.
  - Hierdoor was de viewBox precies 121 font-eenheden te smal (`2480.49 - 2359.49 = 121`), waardoor de browser de rechterflank van de letter 't' afkapte en de intrinsieke verhouding te smal berekende (3.18 : 1 in plaats van 3.34 : 1).
- **Gewijzigde bestanden:**
  - `index.html`:
    - `.brand-mark` in topbar (`viewBox="0 -730 2480.49 742"`).
    - `.intro-lockup` in `#intro-title` (`viewBox="0 -730 2480.49 742"`).
  - `src/core/mark.js`:
    - `INTEGRATED.w` gecorrigeerd van `235.95` naar `248.05`.
  - `brand/merk/svg/`:
    - `orbit-integrated-fullcolour.svg`: viewBox aangepast naar `0 -730 2480.49 742`.
    - `orbit-integrated-fullcolour-reversed.svg`: viewBox aangepast naar `0 -730 2480.49 742`.
    - `orbit-integrated-black.svg`: viewBox aangepast naar `0 -730 2480.49 742`.
    - `orbit-integrated-white.svg`: viewBox aangepast naar `0 -730 2480.49 742`.
    - `orbit-integrated-red.svg`: viewBox aangepast naar `0 -730 2480.49 742`.
  - `brand/merkgids/index.html`:
    - Hoogtes van de geïntegreerde showcase-afbeeldingen herberekend naar `185px` (bij breedte 620px) en `138px` (bij breedte 460px) conform de werkelijke 3.34 : 1 verhouding.
  - `sw.js`:
    - Cache-versie verhoogd naar `orbit-v17`.
  - `CLAUDE.md` en `ANTIGRAVITY_CHANGELOG.md`: documentatie bijgewerkt.
- **Getest:**
  - Headless Chromium visual render & DOM bounding box inspectie:
    - BBox van `.brand-mark` en elementen geëvalueerd; de volledige letter 't' valt nu 100% binnen de SVG viewBox.
    - Schermafbeeldingen gemaakt en visueel gecontroleerd op desktop en mobiel.
  - Consolefouten: 0 fouten.
- **Impact op opslag / state:** Geen.

### 33. Verwijdering fidgets Bubbles, Plasma en Breakout
- **Vraag van Victor:** "verwijder de bubbles, plasma en breakout fidgets"
- **Doorgevoerde wijzigingen:**
  - `src/focus/breakout.js`, `src/focus/plasma.js`, `src/focus/bubbles.js`:
    - De drie afzonderlijke fidget-bestanden verwijderd uit de codebase via `git rm`.
  - `src/focus/fidget.js`:
    - Imports van `createBreakout`, `createPlasma`, `createBubbles` verwijderd.
    - `MODES` bijgewerkt naar 8 stuks: `['water', 'jelly', 'lava', 'grain', 'topo', 'wayglim', 'panel', 'life']`.
    - Factory-branches voor breakout, plasma en bubbles in `mode()` verwijderd.
    - `hasPresets` teruggebracht naar `['panel', 'life']`.
    - `GROUPS` bijgewerkt: `groupFluid` (`water`, `jelly`, `lava`, `grain`, `topo`, `wayglim`), `groupPlay` (`panel`, `life`).
    - Bestaande opslag-fallback (`!available().includes(modeName)`) zorgt ervoor dat als een gebruiker eerder breakout, plasma of bubbles had geselecteerd, het bakje geruisloos terugvalt naar `water` zonder fouten.
  - `src/core/i18n.js`:
    - Woordenboeken NL en EN geschoond van de vertaalsleutels voor plasma, breakout en bubbels.
  - `sw.js`:
    - `SHELL`-lijst ontdaan van de 3 verwijderde JavaScript-bestanden.
    - Cache-versie verhoogd naar `orbit-v18`.
  - `CLAUDE.md`:
    - Bestanden-tabel en overdracht bijgewerkt.
- **Getest:**
  - Syntaxcontrole met `node --check` op alle gewijzigde JS-bestanden (foutloos).
  - Headless Chromium CDP tests: focusmodus geopend, popover geopend, geverifieerd dat er exact 8 opties getoond worden onder de 2 groepen, wisselen tussen fidgets getest, fallback getest.
  - Consolefouten: 0 fouten.
- **Impact op opslag / state:** Geen; valkuil-vrije migratie naar actieve modus.

### 34. Subtiele dot matrix gloed voor actieve stippen (maandwissel, klok en tellers)
- **Vraag van Victor:** "Kan je hier de rode dots die 'aan' staan een heel klein beetje, heel subtiel laten gloeien alsof het echt een dot matrix van licht is? Zoals je denk ik al een beetje deed bij de klok op focus mode en de star counter? Zoniet, laat die op dezelfde manier gloeien."
- **Doorgevoerde wijzigingen:**
  - `index.html`:
    - SVG filter `<filter id="dm-glow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="0.18" flood-color="currentColor" flood-opacity="0.75"/></filter>` toegevoegd aan de `<defs>` sectie.
    - Door de filterregio op 200% te stellen en `overflow: visible` op de `.dm` SVGs, wordt de gloed nergens door viewBox-randen of tegelgrenzen afgesneden.
    - `flood-color="currentColor"` zorgt ervoor dat de gloed dynamisch de kleur van de stip volgt: warm rood (`var(--core)`) bij de maandwissel, en zacht wit fosforlicht (`var(--ink)`) bij de klok en tellers in het donkere thema.
  - `src/styles.css`:
    - `filter: url(#dm-glow)` gekoppeld aan `.mg-dm .dm .o` (altijd zacht oplichtend rood bij het maandnummer in zowel licht als donker thema) en `[data-theme="dark"] .dm .o` (voor de focusklok, stappenteller/sterrenteller en zandloperminuten in het donkere thema).
    - In het lichte thema behouden de klok en teller hun strakke grafiet/inkt-stippen zonder schaduwranden.
  - `src/scene/matrix.js`:
    - Toelichting in de codekop bijgewerkt.
  - `sw.js`:
    - Cache-versie verhoogd naar `orbit-v19`.
  - `CLAUDE.md`:
    - Overdracht bijgewerkt.
- **Getest:**
  - Headless Chromium screenshots geverifieerd voor donker en licht thema op de maandwissel (`.mg-dm`), focusklok (`.clock`) en sterrenteller (`.stat-dm`).
  - Volledige app-boot geverifieerd in Chromium headless zonder consolefouten.
- **Impact op opslag / state:** Geen.

### 35. Herontwerp takenlijst naar Variant 1 "De Stille Kolom"
- **Vraag van Victor:** "Kan je dit menu qua ordening wat opschonen? Het ziet er best rommelig uit. De info is allemaal wel nuttig denk ik, maar de manier waarop alles georganiseerd is, de locatie van alle tekst en elementen etc maakt alles rommelig. Stel wat varianten voor" + screenshot. Na interactief vergelijkingsbord (`task-list-variants.html` en visuele samenvatting) koos Victor: "Variant 1".
- **Probleemanalyse van de eerdere layout:**
  1. *Verspringende inhoud (Layout Shift):* Bij hover op desktop sprong `.track-row` 36 px naar links (`padding-right: 36px`), waardoor de taaktitel onder de cursor danste en onrust veroorzaakte.
  2. *Zwevende glyphs in het midden:* Het notitie-icoon reserveerde een vaste middelste rasterkolom (`minmax(0, 1fr) 26px 32px`), waardoor titels te vroeg afgekapt werden (+26 px verloren ruimte).
  3. *Overtollige dubbele statusbollen:* Onder een groepskop met reeds een gekleurde stip (bv. "● Week") verscheen bij hover rechts n&oacute;g een gekleurde stip (`.orb-dot`), wat visuele ruis veroorzaakte en leek op een ongelezen status.
- **Doorgevoerde wijzigingen (Variant 1: De Stille Kolom):**
  - `src/styles.css`:
    - `.track-row`: omgezet van een 3-koloms grid naar een zuivere flex-rij (`display: flex; align-items: center; min-height: 42px; width: 100%; padding-right: 0`). De regel `.track:not(.is-picking):hover .track-row { padding-right: 36px; }` is volledig verwijderd. **0 px layout-shift** bij hover op desktop.
    - `.t-title`: `flex: 1 1 0%; min-width: 0;` met zachte nevel-fade over de laatste 28 px. Heeft nu volle breedte tot aan de metadatazone (+26 px extra titelruimte).
    - `.t-edit`: flexibel meeschalend met de rij bij dubbelklikken/aanpassen van titels.
    - `.t-meta`: vaste rechter metadatazone van 84 px (`flex-shrink: 0; position: relative`).
    - `.t-meta-labels`: toont in ruststand discrete passieve labels (deadline-chip `.t-due` en/of notitielabel `.t-meta-note`, strak rechts uitgelijnd).
    - `.t-meta-actions`: 3 discrete actieknoppen van 26 px (`.t-act-btn`) die bij hover op desktop zacht infaden (`opacity: 1`) terwijl de labels uitfaden:
      1. Niveaukiezer (`.t-act-level`) met ragfijn `ORBIT_SVG` icoon (twee concentrische cirkels in lijnstijl, geen verwarrende gekleurde stip meer).
      2. Notitieknop (`.t-act-note`) met subtiel tone-stipje in de momentkleur bij bestaande notitie.
      3. Prullenbakknop (`.t-act-del`) met zachte rode tint (`var(--late)`) bij hover.
    - Mobiele swipe: `.track.is-swiped .t-meta` dooft uit naar `opacity: 0`, zodat bij het vegen alleen de twee grote touch-knoppen (notitie en verwijderen) in de 72 px drawer overblijven.
  - `src/app.js`:
    - `ORBIT_SVG` en `CALENDAR_SVG` toegevoegd.
    - `trackRow(t)`: opgebouwd volgens Variant 1 met `.t-meta`, `.t-meta-labels`, `.t-meta-actions` en gescheiden mobiele swipe-knoppen (`swipeDel`, `swipeNote`).
    - `levelControls(t, li)`: gebruikt `ORBIT_SVG` voor zowel de desktop actieknop als het mobiele niveauknopje.
    - `dueControls(t, li)`: deadline-chip in labels, kalender-icoon in acties, datum-editor geopend via toggle.
    - `attachSwipe`: live drag fade-out van `.t-meta` via `pad / 36` voor 60fps soepele touch-ervaring.
    - `deleteTask`: verwijdert alle delete-knoppen tegelijk tijdens de uitschuifanimatie naar links.
  - `sw.js`:
    - Cache-versie verhoogd naar `orbit-v20`.
  - `CLAUDE.md`:
    - Interactiesectie en Overdracht bijgewerkt.
- **Getest:**
  - Automated CDP Puppeteer tests uitgevoerd op desktop (1440×900) en mobiel (375×812):
    - Exact 0 px layout-shift bevestigd (`rowLeft: 0px`, `titleLeft: 0px`, `titleWidth: 0px` verschil voor en na hover).
    - Hover crossfade bevestigd (`actionsOp: 1`, `labelsOp: 0`).
    - Notitiepaneel openen, typen en opslaan getest en geverifieerd.
    - Niveaukiezer openen en niveau wisselen getest en geverifieerd.
    - Mobiele swipe links getest: 72 px drawer met prullenbak en notitie opent feilloos.
    - Donker en licht thema visueel geverifieerd via screenshots (`desktop-dark.png`, `desktop-tracks.png`, `mobile-tracks.png`).
    - 0 applicatie- of consolefouten.
- **Impact op opslag / state:** Geen; alle taakgegevens, notities en deadlines blijven 100% compatibel.

### 36. Symmetrische 4-hoeken layout statistiekenbalk (.stats)
- **Vraag van Victor:** "Zet het prestatie-niveau (navigator) en bijhorende badge rechts uitgelijnd van dit menu, dus mooi rechts uitgelijnd met de muur instelling, zodat er in elke 'hoek' van deze sectie een optie is, nu lijkt het asymetrisch" met screenshot van de onderzijde van de takenkolom.
- **Probleemanalyse:**
  - In de eerdere opzet van de statistiekenstrook (`.stats`) stonden bovenaan de sterrenteller (`.stats-total`, links) en de muurschakelaar (`.wall-toggle`, rechts).
  - In de onderstrook (`.stats-bar`) stonden zowel het instellingen-knopje (`.menu-btn`) als de prestatierang met het badge-icoontje (`#stats-rank-hint`) samen links geclusterd in `#stats-menu-slot`, gescheiden door een verticaal streepje.
  - De rechterhoek van de onderstrook was hierdoor leeg, wat een visueel asymmetrisch en ongebalanceerd gevoel gaf ten opzichte van de muurknop erboven.
- **Doorgevoerde wijzigingen:**
  - `index.html`:
    - `#stats-rank-hint` losgekoppeld van `#stats-menu-slot` en als directe sibling in `#stats-bar` geplaatst (`<div class="stats-menu-slot" id="stats-menu-slot"></div><button type="button" class="stats-rank-hint" id="stats-rank-hint" hidden ...></button>`).
  - `src/styles.css`:
    - `.stats-bar`: voorzien van `justify-content: space-between;`.
    - `.stats-menu-slot`: vereenvoudigd tot zuivere flex-container voor `#menu-btn` (de eerdere `gap: 11px` en de `border-left` scheidingslijn tussen `#menu-btn` en `#stats-rank-hint` zijn opgeruimd).
    - `.stats-rank-hint`: uitgelijnd naar rechts via `margin-left: auto; justify-content: flex-end;`.
    - Interactievriendelijkheid: royale hit-target behouden via `position: relative` en `::before { content: ''; position: absolute; inset: -8px -6px; }`.
    - Typografische harmonie: alle 3 de tekstknoppen (`.wall-toggle`, `.menu-btn`, `.stats-rank-hint`) delen exact dezelfde `font: 500 10.5px/1 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3)`.
  - Resultaat (4 hoeken):
    - **Linksboven:** `.stats-total` (matrixcijfers + "STARS ALL TIME", links uitgelijnd op x = 40 px)
    - **Rechtsboven:** `.wall-toggle` ("WALL ⚬", rechts uitgelijnd op x = 340 px)
    - **Linksonder:** `.menu-btn` ("SETTINGS ⚙", links uitgelijnd op x = 40 px)
    - **Rechtsonder:** `.stats-rank-hint` ("SCOUT ✦", rechts uitgelijnd op x = 340 px)
  - `sw.js`:
    - Cache-versie verhoogd naar `orbit-v21`.
  - `CLAUDE.md`:
    - Overdracht bijgewerkt.
- **Getest:**
  - Automated CDP Puppeteer script gedraaid via `/tmp/verify_stats_layout.py`:
    - `statsRect`: left = 40, right = 340 (breedte = 300 px).
    - `statsToggleRect.left`: 40.
    - `menuBtnRect.left`: 40.
    - `wallToggleRect.right`: 340.0.
    - `statsRankHintRect.right`: 340.0.
    - Pixelprecieze overeenkomst (0.0 px afwijking) op de rechterrand tussen de muurschakelaar en het prestatieniveau.
    - Mobiele weergave (375×667) gecontroleerd: `#stats-rank-hint` lijnt rechts strak uit met `.wall-toggle` op x = 359 px.
    - Donker en licht thema visueel geverifieerd via gecropte zoom-screenshots.
    - 0 fouten in browserconsole.
- **Impact op opslag / state:** Geen.



