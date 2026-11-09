# Volledige audit van Orbit

Opdracht voor een Claude Code-sessie. Start met: "Voer `docs/nalezing.md` uit." Opgesteld op 09/11/2026 op vraag van Victor: "Het moet echt alles omvatten wat iemand zou doen die ik inhuur om de app volledig te auditen, nalezen en elke fout of verbetering te vinden en op te lijsten, om ze daarna ook zelf aan te kunnen pakken."

## Rol en doel

Je bent een externe auditor en daarna de ontwikkelaar die de bevindingen oplost. Je werkt in twee delen:
- **Deel A, audit**: alles vinden en vastleggen in een register, met bewijs, ernst en een voorstel. In Deel A verander je **niets** aan de app (enkel meetscripts in de kladmap en het register).
- **Deel B, aanpak**: het register afwerken in volgorde van ernst, elke oplossing nameten, en het register bijwerken tot alles opgelost, bewust aanvaard of aan Victor voorgelegd is.

Het resultaat: een Orbit dat correct, veilig, toegankelijk, opgeruimd, consequent, snel en zuinig met tokens is, met het uiterlijk en gedrag dat Victor gekozen heeft.

## Harde grenzen (gaan boven alles in deze opdracht)

- Lees eerst `CLAUDE.md`. Alle regels daar blijven gelden (gegevens heilig, nooit geschiedenis herschrijven, geen secrets, geen build-stap of dependencies, opslagsleutels en formaat van de synctoestand compatibel, Nederlands, geen em dashes).
- **Keuzes van Victor zijn vast.** Elke keuze in `docs/kennis.md` met "Victor koos", "gekozen door Victor" of "op vraag van Victor" verander je niet zonder zijn akkoord. Vind je er een probleem in, dan is dat een bevinding met een voorstel.
- **Objectief versus smaak.** Wat objectief een regel uit `CLAUDE.md` of een norm hieronder breekt (lucht onder het minimum, niet uitgelijnd waar het hoort, overlap, afgekapt, trefzone te klein, horizontale scroll, kleur buiten de tokens, ontbrekende vertaling, contrast onder WCAG AA, fout in de console, gegevensrisico, beveiligingslek) los je in Deel B op binnen de bestaande stijl. Smaak (andere maat, ritme, animatie, tekst) is altijd een voorstel aan Victor, hooguit drie varianten, met voor en na.
- **Gegevens.** `mergeStates`, `sameState`, `mergeArchive`, `mergeScores`, export, import, archief, Vangnet en demo blijven exact werken, ook met gegevens van oudere versies. Elke wijziging die ze raakt, test je expliciet.
- **Kleine, losse commits** per bevinding of groep, met het ID uit het register in de boodschap, rechtstreeks op `main`. Elke commit werkt op zichzelf.
- **Niets deployen** naar Cloudflare en nooit secrets aanraken; wijzigingen aan `worker/` lokaal testen (`wrangler dev`) en melden.
- Stop en vraag bij twijfel over gegevens, een ontwerpkeuze, of een ingreep die je niet volledig kunt nameten.

## Toestemming die deze opdracht geeft

Als Victor deze opdracht start, geeft hij daarmee toestemming voor:
- **`docs/kennis.md` herstructureren voor tokenzuinigheid** (nu ongeveer 365 KB, 42 secties) zonder dat er inhoud verloren gaat: verplaatsen, ontdubbelen en samenvatten mag, schrappen niet. Voorstel: korte index bovenaan, de actuele toestand per onderwerp kort en vooraan, de geschiedenis (wie koos wat wanneer, afgewezen varianten) in `docs/geschiedenis.md`, oude Overdracht-regels in `docs/overdracht.md`. Controleer met een script dat elke alinea van vroeger nog ergens staat. Verwijzingen blijven kloppen.
- **`src/app.js` opsplitsen** (nu ongeveer 3800 regels) volgens de regels in `CLAUDE.md` (Structuur), met `app.js` als ingang en regisseur.
- **`CLAUDE.md` aanscherpen** (doel onder 12 KB) zonder harde regels te verliezen.
- **Objectieve fouten oplossen** zoals hierboven beschreven.

Alles daarbuiten: eerst vragen.

---

## Deel A: audit

Houd een takenlijst bij (TaskCreate en TaskUpdate), één taak per domein. Begin met A0, daarna in willekeurige volgorde, maar elk domein volledig.

### A0. Inventaris en nulmeting

- `git log --oneline -40`, Overdracht lezen, nagaan of recente commits in `docs/kennis.md` staan; alle "Open:" uit de Overdracht en `docs/kennis.md` verzamelen.
- Per bestand: grootte, regels, complexiteit (langste functies), importgraaf (richting `core` → `data` → `sync`, `scene`, `focus` → `app.js` volgens `CLAUDE.md`).
- **Nulmeting** voor de regressietest (zie Verificatie): posities en maten van elk zichtbaar element in alle toestanden van A2, beelden per seconde (A6), groottes van bestanden en documentatie.

### A1. Functionele volledigheid

- Maak een lijst van **elke functie** die Orbit heeft (uit `docs/kennis.md`, de Uitleg, Instellingen, sneltoetsen, vensters) en test elke functie van begin tot einde, inclusief ongedaan maken en foutpaden.
- Toets elke functie aan "Klaar is pas klaar" in `CLAUDE.md` in een **matrix** (NL, EN, licht, donker, gsm 375 en 320, desktop 1440, Minimaal, minder beweging, sync, export en import, archief, regisseur, Uitleg, `SHELL`). Elke lege cel is een bevinding.
- Sneltoetsen: elke toets in de Uitleg en in Instellingen werkt, botst niet met invoervelden of vensters, en staat overal gelijk beschreven.
- Wat de Uitleg belooft, moet de app doen, en omgekeerd: wat een gebruiker moet weten, staat in de Uitleg.

### A2. Visueel, lay-out en interactie

**Toestanden** (op 1440 × 900, 1024 × 768, 768 × 1024, 375 × 812, 320 × 640, liggende gsm 812 × 375; licht en donker; NL en EN; Effecten Alle en Minimaal; minder beweging; pixeldichtheid 1, 2 en 3): eerste bezoek met Uitleg; lege lijst; voorbeeldtaken; echte taken in elke schil; taak met notitie, deadline (vandaag, morgen, te laat, ver), herhaling; taak open (notitie, momentkeuze, datumbewerker); titel bewerken; geveegde rij; aanwijzen van een rij; afvinken, melding, Ongedaan maken; nieuwe taak (venster, wiel, `N`); elke stand van het wiel; teller en statistiek; muur; Instellingen (elke rij, elke keuze, Kleuren Momenten en Rood); Archief (beide tabbladen, leeg en vol, Terugzetten, Zeker?); Koppelen (elke stap van versturen en ontvangen, fouten, sleutelhanger); Prestaties en rang; maandrecap (post en story, licht en donker, maand-navigatie); maandwissel; focus (klok, weer, quote, Nu-taken, zandloper ingeklapt, uitgeklapt, lopend, gepauzeerd, klaar, quote die zakt op gsm); bakje met elke fidget op basismaat en vergroot, fidgetmenu, kleurkiezer, greepje; demo; offline; webapp-modus (`display-mode: standalone`) zonder koppeling; browserzoom 200 %.

**Meetscript** (één herbruikbaar Playwright-script in de kladmap, uitkomst als tekst per toestand):
- *Overlap*: zichtbare rechthoeken van tekst en bediening die elkaar snijden, buiten bedoelde lagen.
- *Afgekapt*: tekst die buiten zijn vak of venster valt, `scrollWidth > clientWidth` zonder bedoeld vervagen of doorschuiven.
- *Lucht* (zichtbare tekst via `Range.getClientRects`, niet het vak): binnen een groep 2 tot 10 px, tussen groepen minstens 16, onder een groot vlak minstens 20, onder een merk of titel minstens 8.
- *Uitlijning*: elementen in dezelfde kolom of rij die bijna maar niet exact een rand of basislijn delen (0,5 tot 4 px verschil is bijna altijd een fout); randloze knoppen waarvan de tekst niet op de rand staat.
- *Ritme*: dezelfde soort elementen (rijen, labels, knoppen, vensterkoppen) met verschillende maten, marges of lettergroottes zonder reden.
- *Trefzones*: kleiner dan 36 × 36 px op touch (met `::after` meegerekend).
- *Horizontale scroll*, *console-fouten*, *mislukte verzoeken* naar eigen bestanden.
- *Kleur*: berekende kleuren die niet uit een token komen; contrast (WCAG AA: 4,5 voor tekst, 3 voor grote tekst, kapitaaltjes-labels en grafische elementen die iets betekenen) in licht en donker en met Kleuren Rood.
- *Staten*: aanwijzen, focus (zichtbaar bij toetsenbord), actief, uitgeschakeld, bezig, leeg, fout: bestaan ze, zijn ze consequent over de hele app.

**Glitches in beweging** (per frame vastleggen met `requestAnimationFrame`): afvinken, ongedaan maken, vensters openen en sluiten, focus aan en uit, aanzicht wisselen, maandwissel, nieuwe ster en sterrenbeeld, prestatie en rang, logo, fidget wisselen, bakje vergroten, zandloper starten en klaar, melding. Zoek sprongen (meer dan een paar px in één frame zonder dat de animatie dat wil), flitsen (dekking die kort springt), lay-outverschuiving (`PerformanceObserver` op `layout-shift`), animaties die blijven hangen of verkeerd eindigen, ongelijke snelheid op 60 en 120 Hz, en wat bij minder beweging toch beweegt. Ook: botsingen tussen gelijktijdige animaties en meldingen (regisseur).

### A3. Inhoud, tekst en UX

- Alle zichtbare tekst in NL en EN (uit `src/core/i18n.js` en `index.html`): spelling, grammatica, toon (rustig, droog, vriendelijk, de kern als goedaardige HAL), consequente termen (bakje, zandloper, kern, moment, schil, Archief, Momentopname), geen em dashes, geen marketing- of AI-taal, hoofdletters en leestekens consequent.
- Vertalingen: elke sleutel in beide talen, geen Nederlands in de Engelse versie of omgekeerd, Engelse tekst die langer is en daardoor breekt.
- Foutmeldingen en lege toestanden: zeggen ze wat er mis is en wat je kunt doen?
- Vindbaarheid: kan een nieuwe gebruiker elke functie ontdekken; wat is verborgen zonder aanwijzing?
- Consequentie van gedrag: gelijke handelingen werken overal gelijk (sluiten met Escape en tik ernaast, bevestigen, ongedaan maken).

### A4. Toegankelijkheid (WCAG 2.2 AA)

- Volledige bediening met het toetsenbord: volgorde, zichtbare focus, geen valkuilen, vensters houden de focus binnen en geven ze terug.
- Schermlezer: rollen, namen (`aria-label`), toestanden (`aria-pressed`, `aria-checked`, `aria-expanded`), live-regio's voor meldingen, canvassen met een tekstalternatief waar ze informatie dragen (scène, teller, klok).
- Zoom 200 % en tekstafstand vergroot zonder verlies van inhoud; `prefers-reduced-motion`, `prefers-contrast`, geforceerde kleuren (Windows High Contrast).
- Kleur niet als enige drager van betekenis (momenten, status van sync), ook met Kleuren Rood.

### A5. Gegevens en synchronisatie

- Unit-tests in Node op `mergeStates`, `sameState`, `mergeArchive`, `mergeScores`, `mergeFeats` met gegevens in elk oud formaat.
- Twee en drie gekoppelde toestellen tegen de nagebootste server (Testrecepten): gelijktijdige bewerkingen, offline bewerken op twee toestellen en daarna verbinden, verschillende klokken (scheefgelopen tijd), afvinken op het ene en bewerken op het andere, terugzetten uit het archief, verwijderen, herhalende taken, sterren, prestaties, zandloper, scores, nieuw toestel koppelen, ontvangen met eigen taken.
- Randgevallen (vaste testsets): geen taken, één, 100, 30 in één schil, titel van 200 tekens zonder spaties, emoji en rechts-naar-links-tekst, notitie van 2000 tekens, herhaling op de 31e, 2000 sterren, 500 archiefregels, oude opslag zonder `levelAt`, `due`, `repeat`, beschadigde JSON in elke opslagsleutel, volle opslag (QuotaExceeded), IndexedDB niet beschikbaar.
- Export en import: rondreis zonder verlies, import van een oud bestand, import van rommel.
- Vangnet: verdwijnt er onder welke omstandigheid ook een taak zonder momentopname of archiefregel?

### A6. Prestaties en zuinigheid

- Op 375 × 812 met CPU-vertraging 4× en op desktop: beelden per seconde in scène, focus, elke fidget (basis en vergroot), maandwissel; lange taken (`PerformanceObserver` `longtask`); laadtijd tot de scène staat; geheugen na 30 minuten focus met wisselen van fidgets (lekken); aantal lussen dat loopt als het tabblad verborgen of de focus dicht is.
- Oorzaken zoeken: frames die niets nieuws tekenen, volledige hertekening zonder reden, `getComputedStyle` of lay-out in lussen, filters per element, te grote canvassen, timers die blijven lopen, dubbele luisteraars.
- Laden: wat moet bij het opstarten, wat kan pas bij gebruik (`import()`), lettertypes, afbeeldingen.

### A7. Beveiliging en privacy

- **XSS**: elke plek waar tekst van de gebruiker of van buiten (titel, notitie, quote, weer, gesynchroniseerde gegevens, import, `#sync=`-link) in `innerHTML` of een attribuut belandt. Zoek elke `innerHTML`, `insertAdjacentHTML`, `outerHTML` en template met variabelen.
- Synchronisatie: sleutelafleiding (PBKDF2-parameters, zout), AES-GCM met unieke IV per bericht, wat de server kan zien, wat er in de URL staat (de code in `#sync=`: verwijzer, geschiedenis), sleutelhanger-formulier, wat er in de opslag staat.
- Server (`worker/src/index.js`): invoercontrole, maximale groottes, CORS, misbruik (veel verzoeken, grote geschiedenis), foutmeldingen die niets verraden, `wrangler.toml` en de GitHub Action (enkel lezen, niets uitvoeren of deployen).
- Content Security Policy en externe bronnen (Google Fonts, weer-API, Kwick): wat er het toestel verlaat, en of dat in de Uitleg of ergens beschreven staat.
- Code van derden in `src/vendor/`: bron, licentie, versie, wordt ze pas geladen als nodig.

### A8. Offline en webapp

- Service worker: elk bestand in `SHELL` bestaat en elk geladen bestand staat erin; `CACHE` opgehoogd waar nodig; update-pad (geen mengeling van oud en nieuw); werkt volledig offline na één bezoek; wat gebeurt er bij een nieuwe versie terwijl de app open is.
- Manifest en iconen (maten, maskeerbaar, themakleur in licht en donker), installatie op iOS en Android, statusbalk, veilige zones, standalone-gedrag.

### A9. Browsers en toestellen

- Chromium volledig getest; Firefox als beschikbaar. WebKit staat niet in de testomgeving: lijst elk Safari-risico op (filters op smalle SVG, `:has`, popover, `backdrop-filter`, `100dvh`, veilige zones, `Intl`-opmaak, WebGL2, `requestFullscreen`, klembord, `BarcodeDetector`) als bevinding "na te kijken door Victor op iPhone", met wat hij precies moet doen.
- Aanraken, muis, pen, toetsenbord, trackpad-scrollen; liggend en staand; tablet.

### A10. Codekwaliteit en architectuur

- Dode code: exports, functies, CSS-selectors zonder element, i18n-sleutels, opslagsleutels die niemand nog leest (behalve om oude gegevens te lezen), bestanden die niets laadt, restanten van weggehaalde functies.
- Dubbels: gelijke of bijna gelijke hulpjes (`clamp`, `smooth`, `hexRgb`, `rgba`, `rnd`, `ease`), herhaalde logica, herhaalde CSS-blokken, `!important`.
- Structuur: bestanden met meer dan één verantwoordelijkheid, afhankelijkheden in de verkeerde richting, `app.js`-functies die in een module horen, magische getallen zonder uitleg, namen die niet zeggen wat ze doen, foutafhandeling (stille `catch` waar iets gemeld moet worden).
- CSS: volgorde van secties, media queries ná de basisregel, tokens in plaats van vaste waarden, ongebruikte tokens, specificiteit, selectors die elkaar overschrijven.
- `index.html`: herhaalde inline SVG, semantiek (koppen, landmarks, knoppen versus links).
- Commentaar en documentatie die niet meer klopt met de code (oude namen, afgeschafte varianten, "per toestel" waar het synchroniseert).
- ESLint (`no-undef`, `no-unused-vars`) en `node --check` op alles.

### A11. Repository en documentatie

- Bestanden die er niet horen (oude scripts, kladbestanden, grote binaire bestanden), `.gitignore`, mapstructuur volgens `CLAUDE.md`, `ontwerp/` en `brand/` netjes en beschreven.
- `docs/kennis.md` en `CLAUDE.md`: klopt alles nog met de code, wat is verouderd, wat ontbreekt, hoeveel tokens kost een sessie om te starten.
- Testrecepten: dekken ze alles wat een volgende sessie nodig heeft.

### A12. Tokenzuinigheid voor volgende sessies

- Meet wat een sessie leest om te starten (CLAUDE.md, systeem) en wat een typische taak leest (grootste bestanden die telkens geopend worden).
- Voorstellen: herstructurering van `docs/kennis.md`, opdeling van grote bestanden zodat een sessie zelden een bestand van meer dan 800 regels opent, herbruikbare testscripts als recept, kortere CLAUDE.md.

### Het register

Eén bestand `docs/audit/register.md` (en een kopie als tabel in het rapport). Per bevinding:

| Veld | Inhoud |
|---|---|
| ID | Domein en nummer, bv. `A2-014` |
| Titel | Kort en concreet |
| Ernst | Kritiek (gegevensverlies, beveiliging, app breekt), Hoog (functie werkt niet of fout zichtbaar voor iedereen), Middel (fout in een randgeval of op één maat), Laag (kleine afwijking), Suggestie (verbetering zonder fout) |
| Soort | Objectief (regel of norm gebroken) of Smaak (voorstel) |
| Waar | Bestand:regel, element of toestand, maat en thema |
| Bewijs | Meting (getallen), schermafdruk of stappen om het te zien |
| Gevolg | Wat de gebruiker merkt of wat er mis kan gaan |
| Voorstel | Wat je eraan doet, en de inschatting (klein, middel, groot) |
| Status | Open, Opgelost (commit), Aanvaard (met reden), Vraag aan Victor |

Na Deel A: commit het register, publiceer een eerste rapport als artifact met de samenvatting per domein en ernst, en meld Victor de kritieke en hoge bevindingen en de vragen. Ga daarna door met Deel B tenzij er een kritieke bevinding is die zijn beslissing vraagt.

---

## Deel B: aanpak

Werk het register af in deze volgorde: Kritiek, Hoog, Middel, Laag, Suggesties die objectief zijn. Smaak-voorstellen bundel je per onderwerp voor Victor (hooguit drie varianten, met voor en na, als artifact en bewaard in `ontwerp/`).

Binnen dezelfde ernst eerst wat de rest makkelijker maakt: dode code weg en dubbels samen, dan de opsplitsing van `app.js` en de ordening van `styles.css`, dan de afzonderlijke fouten, dan prestaties, dan tokenzuinigheid (`docs/kennis.md`, `CLAUDE.md`, testrecepten).

Per bevinding: oplossen, nameten (het bewijs uit het register moet nu het juiste tonen), regressietest, commit met het ID, status bijwerken.

Richtlijnen voor de structuur:
- `app.js` opsplitsen volgens de bestaande domeinen (lijst en taakrij, vensters, archief, koppelen, focus, toetsenbord, instellingen, prestaties en meldingen); elke module `createX(deps)`, `app.js` verbindt; korte Engelse namen; nieuwe bestanden in `SHELL`, `CACHE` ophogen.
- Gedeelde hulpjes naar `src/core/` als minstens drie modules ze gebruiken.
- `styles.css` in de volgorde tokens, basis, topbar, scène, lijst, vensters, focus, bakje, gsm, minder beweging, met de bestaande secties `/* ---- Naam ---- */`.

## Verificatie (na elke groep wijzigingen en op het einde)

- **Regressie op uiterlijk**: beide versies naast elkaar via `git worktree` in de kladmap, vaste `Math.random` en datum, positie, grootte en dekking van elk zichtbaar element in de toestanden van A2. Elk verschil boven 1 px is ofwel de bedoelde oplossing (staat in het register) ofwel een fout.
- **Meetscript van A2** opnieuw op de eindversie: geen nieuwe bevindingen.
- **Gegevens**: de tests van A5 opnieuw, allemaal groen.
- **Prestaties**: de metingen van A6 opnieuw, nergens trager.
- **Kwaliteit**: ESLint, `node --check`, console foutloos, geen horizontale scroll.
- Schermafbeeldingen enkel waar het om het uiterlijk gaat, `deviceScaleFactor: 1` tenzij pixeldichtheid het onderwerp is, met `clip`, meerdere op één blad.

## Tokendiscipline tijdens deze opdracht

- Nooit een bestand van meer dan 400 regels volledig lezen: grep, `sed -n`, gerichte stukken. `docs/kennis.md` en `ANTIGRAVITY_CHANGELOG.md` nooit volledig.
- Bewerkingen in één Python-script in de kladmap, met `assert` dat elke te vervangen tekst precies één keer voorkomt.
- Meetscripts één keer schrijven en herbruiken; uitkomst als compacte tekst, niet als lange dumps.
- Lange audit in delen: na elk domein van Deel A het register committen, zodat een volgende sessie kan verdergaan als deze te lang wordt. Wordt de sessie te lang, schrijf dan in de Overdracht exact waar je bent (domein, laatste ID) en wat de volgende stap is.
- Geen subagents tenzij Victor erom vraagt.

## Oplevering

- `docs/audit/register.md` volledig bijgewerkt; elke bevinding met een eindstatus.
- Eindrapport als artifact (bewaard in `ontwerp/audit/`): samenvatting, aantallen per domein en ernst voor en na, de matrix "Klaar is pas klaar", meetresultaten voor en na (regels code, KB, beelden per seconde, laadtijd, grootte van `CLAUDE.md` en `docs/kennis.md`), wat bewust niet veranderd is en waarom, de Safari-lijst voor Victor, en de open vragen.
- `docs/kennis.md` en de Overdracht bijgewerkt.
- Antwoord aan Victor kort: de belangrijkste vondsten, de link naar het rapport, en wat hij moet beslissen of nakijken.
