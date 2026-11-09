# Grote nalezing van Orbit

Opdracht voor een Claude Code-sessie. Start met: "Voer `docs/nalezing.md` uit." Opgesteld op 09/11/2026 op vraag van Victor.

## Doel

Ga door heel Orbit, front-end en back-end (`worker/`), en laat het achter als een project dat:
1. **correct** is: geen fouten, geen stille gegevensverliezen, geen randgevallen die breken;
2. **logisch en opgeruimd** is: één verantwoordelijkheid per bestand, geen dode code, geen dubbels, eenduidige namen;
3. **gestroomlijnd** is: minder code voor hetzelfde gedrag, geen omwegen, geen lagen die niets doen;
4. **zuinig** is: snel op gsm (geen onnodige frames, filters, herberekeningen) en zuinig met tokens voor elke volgende sessie.

Het uiterlijk en het gedrag dat Victor gekozen heeft, blijven **identiek**. Dit is onderhoud, geen herontwerp.

## Harde grenzen (gaan boven alles in deze opdracht)

- Lees eerst `CLAUDE.md`. Alle regels daar blijven gelden (gegevens heilig, nooit geschiedenis herschrijven, geen secrets, geen build-stap of dependencies, opslagsleutels en formaat van de synctoestand compatibel, Nederlands, geen em dashes).
- **Niets zichtbaars veranderen** zonder voorstel aan Victor. Twijfel je of iets zichtbaar is: meten (zie Verificatie). Een zichtbaar verschil dat een fout is (overlap, afgekapt, verkeerd uitgelijnd) mag je herstellen, maar meld het.
- **Gedrag bewaren.** Elke keuze in `docs/kennis.md` met "Victor koos" of "op vraag van Victor" is vast. Verander je die, dan enkel na een vraag aan Victor.
- **Gegevens.** Wat je ook herstructureert: `mergeStates`, `sameState`, export, import, archief, Vangnet en demo moeten exact hetzelfde blijven werken, ook met gegevens van oudere versies. Test dit expliciet.
- **Kleine, losse commits** per onderwerp, elk met een duidelijke boodschap, rechtstreeks op `main` (Pages publiceert enkel `main`). Elke commit moet op zichzelf werken.
- Stop en vraag Victor bij: een ontwerpkeuze, iets wat gegevens raakt waar je niet 100 % zeker van bent, of een opsplitsing die meer dan een paar honderd regels verplaatst en je niet volledig kunt nameten.

## Toestemming die deze opdracht geeft

Als Victor deze opdracht start, geeft hij daarmee toestemming voor:
- **`docs/kennis.md` herstructureren voor tokenzuinigheid** (nu ongeveer 365 KB, 42 secties), op voorwaarde dat **geen enkele inhoud verloren gaat**: verplaatsen, ontdubbelen en samenvatten mag, schrappen niet. Voorstel: een korte index bovenaan (sectie, waar, waarover), de actuele toestand per onderwerp kort en vooraan, de geschiedenis (wie koos wat wanneer, afgewezen varianten) in een apart bestand `docs/geschiedenis.md`, en de oude Overdracht-regels in `docs/overdracht.md`. Verwijzingen ("zie Merk") blijven kloppen.
- **`src/app.js` opsplitsen** (nu ongeveer 3800 regels) in modules volgens de regels in `CLAUDE.md` (Structuur), met `app.js` als ingang en regisseur.
- **`CLAUDE.md` aanscherpen** (doel onder 12 KB), zonder harde regels te verliezen.

Alles daarbuiten: eerst vragen.

## Werkwijze

Werk in deze volgorde. Houd een takenlijst bij (TaskCreate en TaskUpdate). Na elke fase: commit en push, en een regel in de Overdracht.

### Fase 0: inventaris (meten, nog niets veranderen)

- `git log --oneline -30`, Overdracht lezen, nagaan of de laatste commits in `docs/kennis.md` staan.
- Bestandsgroottes, regels per bestand, de importgraaf (wie importeert wie; klopt de richting `core` → `data` → `sync`, `scene`, `focus` → `app.js`?).
- Dode code: exports die niemand importeert, functies die niemand aanroept, CSS-selectors zonder element in `index.html` of in de JS, i18n-sleutels die nergens gebruikt worden (en sleutels die in NL of EN ontbreken), bestanden die niet in `SHELL` van `sw.js` staan (of erin staan maar niet bestaan).
- Dubbels: gelijke of bijna gelijke functies (hulpjes zoals `clamp`, `smooth`, `hexRgb`, `rgba`, `rnd` in meerdere modules), herhaalde CSS-blokken, `!important`.
- Leg een **nulmeting** vast voor de regressietest (zie Verificatie) vóór je iets verandert.
- Schrijf de bevindingen kort in een werklijst (kladmap) en rangschik: fouten, risico's voor gegevens, dode code, dubbels, structuur, prestaties, tokens.

### Fase 1: fouten en robuustheid

- Console op alle maten en thema's foutloos, ook tijdens de maandwissel, focus, het bakje met elke fidget, alle vensters, sync (nagebootste server, zie Testrecepten).
- Elke localStorage-toegang in try/catch, elke JSON.parse beschermd.
- Lekken: event listeners, `setInterval`, `requestAnimationFrame`, `ResizeObserver` die blijven lopen na sluiten of wisselen (bakje, focus, vensters, fidgets). Elke lus stopt als niemand kijkt (`document.hidden`, focus dicht, bakje dicht).
- Regisseur: botsingen tussen nacht, ster, prestatie, toast, venster, focus volgens `takeStage`/`whenCalm`.
- Safari en iOS: alles wat in Chromium werkt maar in WebKit kan breken (filters op smalle SVG, `:has`, popover, `backdrop-filter`, veilige zones, `100dvh`). WebKit staat niet in de testomgeving: lijst de risico's op voor Victor in plaats van te gokken.
- `worker/src/index.js`: invoercontrole, groottes, CORS, foutpaden, geschiedenis van versies. Niets deployen; enkel lokaal met `wrangler dev` als dat kan.

### Fase 2: opruimen

- Dode code, dode CSS, ongebruikte i18n-sleutels, verouderde commentaren weg. Commentaar dat een keuze van Victor uitlegt, blijft (kort).
- Dubbele hulpjes naar één plek in `src/core/` (bv. `core/math.js` of `core/color.js`), alleen als minstens drie modules ze delen.
- CSS: één regel per selector waar mogelijk, media queries ná de basisregel, tokens in plaats van vaste waarden, `!important` alleen waar het echt moet (en dan met reden). Ongebruikte tokens weg.
- `index.html`: inline SVG die herhaald wordt (merk, iconen) op één plek.

### Fase 3: structuur

- `src/app.js` opsplitsen volgens de bestaande domeinen (bv. lijst en taakrij, vensters, archief en Vangnet-weergave, sync-venster, focusmodus, toetsenbord, instellingen, prestaties en meldingen). Elke module `createX(deps)`, `app.js` verbindt. Eén bestand, één verantwoordelijkheid, korte Engelse naam, in de map van zijn domein. Nieuwe bestanden in `SHELL`, `CACHE` ophogen.
- `src/styles.css` volgt de secties `/* ---- Naam ---- */` in een logische volgorde (tokens, basis, topbar, scène, lijst, vensters, focus, bakje, gsm, minder beweging).
- Namen: één taal per laag (Engelse code-namen, Nederlandse UI en commentaar), eenduidige termen (bakje, zandloper, kern, moment).

### Fase 4: prestaties

- Meet op 375 × 812 met CPU-vertraging (4×) in Playwright: beelden per seconde in de scène, de focus en elke fidget. Zoek frames die niets nieuws tekenen, canvassen die elk frame volledig hertekend worden zonder reden, `getComputedStyle` in lussen, filters per element, te grote canvassen (dpr boven 2).
- Laadtijd: wat moet bij het opstarten, wat kan pas bij gebruik (`import()` zoals de vendor-code).
- Niets wat Victor ziet mag trager of anders worden.

### Fase 5: tokenzuinigheid voor volgende sessies

- `docs/kennis.md` herstructureren zoals hierboven toegestaan. Meet voor en na (KB) en controleer met een script dat elke alinea van vroeger nog ergens staat.
- `CLAUDE.md`: enkel harde regels, structuur, valkuilen en de laatste 10 Overdracht-regels; alles wat uitleg is, naar `docs/kennis.md`.
- Testrecepten in `docs/kennis.md` bijwerken: één herbruikbaar Playwright-script per soort test (maten en thema's, regressie, sync, fidgets) als kopieerbaar recept, zodat een sessie het niet opnieuw uitzoekt.
- Grote bestanden zo opdelen dat een sessie zelden een bestand van meer dan 800 regels hoeft te openen.

## Verificatie (verplicht, na elke fase)

- **Regressie op uiterlijk**: de methode uit `docs/kennis.md` (Audit uitgevoerd, Nagelopen na de gebroken dubbele punt): beide versies naast elkaar via `git worktree` in de kladmap, vaste `Math.random` en datum, van elk zichtbaar element positie, grootte en dekking meten in minstens deze toestanden: desktop 1440 × 900 thuis, focus, bakje met drie fidgets, alle vensters, melding; gsm 375 × 812 en 320 × 640 thuis, focus, bakje open, venster. Licht en donker. Elk verschil boven 1 px is een fout of moet verklaard worden.
- **Gegevens**: unit-test in Node op `mergeStates`, `sameState`, `mergeArchive`, `mergeScores` met gegevens in het oude formaat; twee gekoppelde toestellen tegen de nagebootste server (Testrecepten); export, import, terugzetten uit archief, Vangnet-momentopname; demo schrijft niets in de echte opslag.
- **Kwaliteit**: ESLint (`no-undef`, `no-unused-vars`) op elk gewijzigd bestand, `node --input-type=module --check`, console foutloos, geen horizontale scroll.
- Schermafbeeldingen enkel waar het om het uiterlijk gaat, `deviceScaleFactor: 1`, met `clip`, meerdere op één blad.

## Tokendiscipline tijdens deze opdracht

- Nooit een bestand van meer dan 400 regels volledig lezen: grep, `sed -n`, gerichte stukken.
- `docs/kennis.md` en `ANTIGRAVITY_CHANGELOG.md` nooit volledig lezen.
- Bewerkingen van meerdere plekken in één script (Python in de kladmap), met `assert` dat elke te vervangen tekst precies één keer voorkomt.
- Testscripts in de kladmap, één per fase, en herbruiken.
- Geen subagents tenzij Victor erom vraagt.

## Oplevering

- Per fase een commit (of enkele), elk met wat en waarom. `docs/kennis.md` en de Overdracht bijgewerkt.
- Een eindrapport als artifact (en bewaard in `ontwerp/nalezing/`): wat er gevonden is (fouten, risico's), wat er veranderd is, meetresultaten voor en na (regels code, KB, beelden per seconde, grootte van `CLAUDE.md` en `docs/kennis.md`), wat bewust niet veranderd is, en wat Victor nog moet beslissen of op zijn iPhone moet nakijken (Safari-risico's).
- Antwoord aan Victor kort: de belangrijkste vondsten, de link naar het rapport, en de open vragen.
