# Orbit: kern van de projectkennis

To-do-visualizer: taken draaien als slanke, taps toelopende bollen (kometen) rond vijf ringen, één per moment (Nu, Vandaag, Week, Maand, Ooit). Hoe dringender, hoe dichter bij de kern, hoe sneller. Live: https://victorvansande.github.io/orbit/ (GitHub Pages, `main` / root, elke push publiceert).

## Zuinig met tokens (Victor, 08/11/2026)

Dit bestand wordt bij elke beurt meegelezen, dus het blijft kort (doel: onder 15 KB). Alle details, de geschiedenis van elke keuze en de volledige overdracht staan in **`docs/kennis.md`** (het naslagwerk, ongeveer 340 KB).
- **Lees `docs/kennis.md` nooit volledig.** Zoek met grep op een functie, bestand, sleutel of sectienaam (bv. `grep -n "## Geluid" docs/kennis.md`) en lees enkel die paar regels of die sectie.
- **Nieuwe kennis**: details (wat, waarom, keuze van Victor met datum en wat hij afwees, bestanden, functies, sleutels, hoe getest) gaan in de juiste sectie van `docs/kennis.md`, kort en zonder herhaling. Hier enkel een nieuwe harde regel of een regel onder Overdracht.
- **Overdracht**: hieronder hooguit de laatste 10 regels; oudere regels verhuizen naar het einde van `docs/kennis.md`.
- **Werkwijze**: lees enkel de bestanden en stukken die je nodig hebt (grep, `sed -n`), niet hele modules. Grote bestanden: `src/app.js` (ongeveer 3500 regels), `src/styles.css`, `src/scene/scene.js`.
- **Testen**: één Playwright-script per taak dat alle maten en thema's in één keer afloopt en DOM-metingen als tekst geeft. Schermafbeeldingen met `deviceScaleFactor: 1`, enkel het stuk dat ertoe doet (`clip`), en alleen bekijken als het om het uiterlijk gaat; meerdere samen op één blad.
- **Voorstellen**: hooguit drie varianten, compact, tenzij Victor meer vraagt.
- **Antwoorden**: kort, geen samenvatting van wat al in de commit staat.

## Identiteit (kort; volledig in `docs/kennis.md`, sectie Identiteit)

- Een object om naar te kijken, geen lijstje met decor. Rustig, verfijnd, smaakvol; Victor schrapt wat te druk, te standaard, te speels, goedkoop, gedateerd, "gevibecode" of te echt is. Liever één subtiele reactie dan zes.
- Speels in het klein (paaseitjes, fidgets, kern met gezicht), nooit luid. Geloofwaardige beweging, gestileerde vorm.
- Beeldtaal: poster en risodruk, papier met korrel, inkt, kleur enkel in de bollen. Ringen en raster grafiet met lage dekking. Zeshoekige rasterpunten als motief (grootte = hoeveelheid). Vierpuntige ster met holle zijden (`star4`) = iets afronden. Rood (Nu, kern) enkel als accent. Tekenset `·:+×#`. Geist voor tekst, Geist Mono kapitaaltjes met letterafstand voor labels.
- Geen glans, geen dikke 3D, geen zware schaduwen, geen `filter: blur` (uitzondering: `backdrop-filter` achter de vensters en in het fidgetmenu, Victor 08/11/2026). Dingen verdwijnen zacht.
- Eén ding tegelijk in de aandacht: animaties en meldingen gaan via de regisseur (`takeStage`, `whenCalm`, voorrang prestatie 1, toast 2, muurveeg 3) en stapelen nooit.
- Exact: wat ergens naar wijst, ligt precies op zijn doel, op elke maat en pixeldichtheid. Geen overlap, niets afgekapt, geen horizontale scroll.
- **Logisch uitgelijnd**: wat bij elkaar hoort deelt een rand of lijn (zichtbare tekst en randen, niet de trefzone); randloze knoppen krijgen een negatieve marge zodat hun tekst op de rand staat. Niets forceren waar het niets betekent. Nameten met `getBoundingClientRect`.
- **Genoeg lucht**, gemeten tussen zichtbare tekst en randen: binnen een groep 2 tot 10 px, tussen groepen minstens 16 px, onder een groot vlak (poster, kaart, QR, scène, venster) minstens 20 px, een regel onder een merk of titel minstens 8 px. Bij twijfel meer.
- Tijdgebaseerd (gelijk op 60 en 120 Hz), easing `cubic-bezier(.4,0,.2,1)`, alles uit bij minder beweging. Een tik of toets slaat lange animaties over, behalve de maandwissel.
- De kern is een goedaardige HAL: kort, droog, vriendelijk, één regel onder de scène.
- Gegevens zijn heilig: niets verdwijnt zonder spoor (Vangnet), ook niet bij sync, import of een nieuwe versie.

## Werken met Victor

- Antwoord en UI-tekst in het Nederlands. Geen em dashes, geen marketing- of AI-taal, geen emoji.
- Mobiel eerst: touch meteen mee ontwerpen, trefzones 36 tot 44 px, `transition: none` tijdens slepen, op gsm verifiëren.
- Bij ontwerpkeuzes eerst visuele voorstellen (artifact, ook bewaard in `ontwerp/`), dan bouwen wat hij kiest. Noteer de keuze met datum en wat hij afwees en waarom.
- "Niet te veel aanpassen" = alleen wat gevraagd is. Wel melden wat opvalt.
- React Bits-componenten letterlijk uit de bron (`raw.githubusercontent.com/DavidHDev/react-bits`).

## Klaar is pas klaar

1. NL én EN in `src/core/i18n.js`. 2. Licht én donker, kleuren als tokens op `:root` en herdefinieerd onder `:root[data-theme="dark"]`. 3. Gsm 375 en 320 px én desktop 1440×900: console foutloos, geen horizontale scroll, uitgelijnd, genoeg lucht. 4. Minder beweging: geen animatie; effect ook in de lijst van Minimaal. 5. Nieuwe gegevens: mee in sync (`mergeStates`, `sameState`), export, import, archief, compatibel met oudere versies; nooit in de echte opslag vanuit de demo. 6. Botsing met nacht, ster, prestatie, toast, venster, focus: wachten of voorrang via de regisseur. 7. Uitleg (`#intro`) bijwerken als de gebruiker het moet kennen. 8. Nieuw bestand in `src/`: in `SHELL` van `sw.js`. 9. `docs/kennis.md` bijwerken, Overdracht, committen, pushen.

## Samenwerking (Claude Code en Antigravity)

- Eén tool tegelijk. Begin met `git pull origin main`, stop met commit en push naar `main`. Krijgt een cloudsessie een eigen branch toegewezen (bv. `claude/...`), toch op `main` werken en naar `main` pushen: Pages publiceert enkel `main` (Victor, 08/11/2026).
- Bij het starten: dit bestand en de Overdracht hieronder lezen, `git log --oneline -15`. Staat er in de commits iets dat niet in `docs/kennis.md` staat, dan eerst aanvullen.
- Antigravity houdt elke wijziging ook bij in `ANTIGRAVITY_CHANGELOG.md` (niet meelezen tenzij nodig: groot).
- **Nooit geschiedenis herschrijven**: geen force push, rebase, reset of amend op gepushte commits. Ongedaan maken = `git revert`.
- **Nooit secrets beheren** (Cloudflare-tokens staan als GitHub secrets, door Victor ingesteld). Nooit gegevens laten verdwijnen. Opslagsleutels `priority-orbit.<naam>.v1` en het formaat van de synctoestand blijven compatibel.
- Geen build-stap, geen dependencies in de app, geen frameworks. `index.html` + `src/**/*.js` (ES-modules) + `src/styles.css`.
- `docs/kennis.md` wordt aangevuld, nooit ingekort of herschreven zonder vraag van Victor.

## Structuur (regels in `docs/kennis.md`, sectie Structuur)

```
index.html, sw.js, manifest.webmanifest, favicon.*   root
icons/  worker/ (sync-server Cloudflare)  brand/ (merk)  ontwerp/ (voorstellen, niets laadt het)  docs/ (naslag)
src/app.js       ingang en regisseur (te groot; nieuwe functies niet hier)
src/styles.css   alle stijl, tokens bovenaan, secties /* ---- Naam ---- */
src/core/   config, i18n, deadline, demo, mark, badge
src/data/   store, backup, stats, feats, recap
src/sync/   sync, pair, keychain
src/scene/  scene, wheel, legend, fx, matrix, greet, sound, promo, turn, hole, gravity
src/focus/  timer, glass, fidget, panel, life, weather, quotes, plasma, breakout, snake
src/vendor/ code van derden met bron en licentie, pas geladen als nodig
```
- Eén bestand, één verantwoordelijkheid, in de map van zijn domein. Afhankelijkheden één kant op: `core` niets, `data` core, `sync` core en data, `scene` core, `focus` core en scene; enkel `app.js` importeert alles. Nieuwe functie = module met `createX(...)`, `app.js` verbindt.
- Bestandsnamen kort, kleine letters, één Engels woord. Verplaatsen met `git mv`, imports en `SHELL` mee, `CACHE` ophogen als paden verdwijnen.
- Geen dode code. Vóór een push: ESLint (`no-undef`, `no-unused-vars`) in een kladmap, nooit in de repo (bekende waarschuwingen in `app.js` zijn oké), en `node --input-type=module --check < bestand.js`. Config, nagebootste syncserver en testopzet: `docs/kennis.md`, sectie Testrecepten (kopiëren, niet opnieuw uitzoeken).
- Een media query staat ná de basisregel van die selector.

## Technische vaste punten

- Fidgets in het bakje (`src/focus/fidget.js`, `MODES`): soorten met `own: true` krijgen `init`, `mount(el)`, `unmount`, `frame(now)`, `move`/`drag`/`down`/`up`/`tap(p)`, `leave`, `recolor`, optioneel `onDark`, `busy` (keuzerij wijkt), `next` (pijltje, `hasPresets`). Basismaat 325,6 × 226,8, maar het bakje is schaalbaar (desktop): een soort krijgt `size {w, h}` en toont meer inhoud met elementen van dezelfde maat, of `zoom` als de opbouw vast is (Breakout, Paneel); nooit een vaste maat aannemen. Kleurkiezer via `accent()`. Houdt een fidget iets bij (scores, records): nooit eigen localStorage, maar `scores.game(naam)` uit `src/data/scores.js` (regel in `GAMES`, vorm `{top}` of `{best, at}`, `reload()`), dan gaat het mee in sync, export en import.
- Valkuilen (volledig in `docs/kennis.md`, sectie Valkuilen): sticky kop werkt enkel met `body{overflow-x:clip}`; `left:50%` + `translate(-50%)` krijgt halve breedte (gebruik `width: max-content`); canvasstaat (`textAlign`, `font`, `globalAlpha`) altijd terugzetten; elke localStorage-toegang in try/catch; scrollwacht `guardScroll` bij open vensters; een golf met wisselend tempo als opgetelde fase, nooit `sin(t * tempo)`.
- Lokaal testen: `python3 -m http.server 3000` (modules werken niet via `file://`). Testbrowser staat op Engels: zet `priority-orbit.lang.v1 = 'nl'` voor Nederlandse tekst; `priority-orbit.intro.v1 = 'gezien'` om de Uitleg over te slaan.

## Overdracht

Hooguit de laatste 10 regels, nieuwste onderaan (oudere: einde van `docs/kennis.md`).

- 10/11/2026, Claude Code: dagen op rij volgens R4 Matrixwissel (gekozen door Victor): derde stand in de stippenteller met een vlammetje (grafiet, rood na de eerste ster van de dag), ontsteekanimatie bij de eerste ster van de dag (of de kern zegt het op gsm), details met regels en een maandkalender in zeshoekjes (`streakInfo`, `src/scene/streak.js`); het vlammetje flakkert (rood) of smeult (grafiet) in zijn vakje (`liveFlame`). Open: Victor kijkt en vinkt morgen iets af.
- 10/11/2026, Claude Code: Geschenken in een eigen tabblad naast Prestaties (P3); titel en teller bovenaan volgen het tabblad. Aan / Uit: de hele tegel is de knop, aan kleurt ze met een zweem van het metaal en een zeshoekig raster dat openvloeit vanaf de tik (G1 Inkt, gekozen door Victor uit `ontwerp/geschenken/ronde2.html`; de iOS-schakelaar S1 viel af). Open: Victor kijkt op pc en gsm.
- 10/11/2026, Claude Code: details onder de sterrenteller dekkend (`--fill-solid`, de hemel scheen erdoor), scrollen zelf in de vaste kolom (op 1440 × 900 vielen ze onder het scherm) en hebben een knop Sluit rechts naast Nieuwe hemel. Open: Victor kijkt.
- 10/11/2026, Claude Code: kern pulseerde wild bij terugkeer naar een venster dat al even openstond: de ademgolf was `sin(tijd sinds laden x tempo)`, en elke tempowissel (inslapen, wakker worden) joeg de fase op; nu een opgetelde fase `breath` (Valkuilen in `docs/kennis.md`). Open: Victor kijkt of het weg is.
- 10/11/2026, Claude Code: de ogen van de kern volgen de muis over het hele venster, ook boven de lijst en het wiel (`gaze` in `scene.js`, vanuit `window`); de rest van de scène reageert enkel boven de scène. Open: Victor kijkt.
- 10/11/2026, Claude Code: een versleepte bol landt waar je hem loslaat (`ringAngleAt` keert de projectie om; vroeger `atan2` op het scherm, dat de draaiing van de scène negeerde). Open: Victor sleept.
- 11/11/2026, Claude Code: zwart gat Z1 Raster (gekozen door Victor uit `ontwerp/zwartgat/`), desktop rechts onder de boog, gsm en liggend enkel tijdens het slepen. Een bol in de buurt wordt een deeltjeswolk: vastgehouden rekt hij als een druppel en dan een draad naar het gat, losgelaten valt elk deeltje op zijn eigen echte baan (uitrekken, vertragen aan de rand, roder, uitdoven), door de lens getekend met een tweede beeld op de fotonring; het gat neemt de bol ook zelf als je binnen de binnenste baan komt. Fysica in `src/scene/gravity.js` (nagerekend tegen de theorie), tekenen in `hole.js`. Open: Victor sleept (traag naderen, loslaten, een zwaai), ook op gsm; zegt of het gat op desktop altijd zichtbaar mag blijven en of het tempo goed is.
- 11/11/2026, Claude Code: het zwarte gat buigt nu het echte raster van de scène (hoofdbeeld weg van het gat, tweede beeld gespiegeld binnen de ring van Einstein, een punt recht erachter wordt een ring); daarvoor staat de toeschouwer nu ver weg (`D = 4000`, één schaal over het hele scherm) en heeft de fotonring negen stralen per punt (`backdropSteps`, `hole.bend`, `drawGrid`). Open: Victor kijkt, en beweegt de muis zodat het raster onder het gat doorschuift.
- 11/11/2026, Claude Code: gsm: een bol viel los bij verticaal of schuin slepen (de browser nam het gebaar over om te scrollen); nu houdt de scène zo'n gebaar vast, ruimere trefzone op touch. Zwart gat: grijpt de bol al op ongeveer 200 px, rekt hem uitgesprokener uit (echte getijdenvorm, opgeschroefd), verwijdert pas bij loslaten (vasthouden = blijven spelen), drukkere schijf in rust; op gsm enkel tijdens het slepen. Open: Victor sleept op pc en gsm.
- 11/11/2026, Claude Code: rode gloed uit het vlammetje bij de eerste ster van de dag, zelfde vorm als de gloed van een nieuwe ster (`emberGlow` in `fx.js`). Open: Victor vinkt morgen de eerste taak af.
