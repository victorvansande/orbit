# Orbit: projectkennis

To-do-visualizer: taken draaien als slanke bollen rond vijf ringen, één per moment (Nu, Vandaag, Week, Maand, Ooit). Hoe dringender, hoe dichter bij de kern, hoe sneller. Gemaakt om open te staan op een scherm: mensen moeten vragen "wat is dat?".

Live: https://victorvansande.github.io/orbit/ (GitHub Pages, bron `main` / root). Elke push naar `main` publiceert opnieuw.

## Werkafspraken

- Antwoord en UI-tekst in het Nederlands. Geen em dashes, geen marketingtaal, geen emoji.
- Geen build-stap. `index.html` + `src/*.js` (ES-modules) + `src/styles.css`.
- Na elke afgeronde wijziging committen en pushen naar `main`, daarna de Pages-run opvolgen.
- Elke wijziging nakijken op desktop (1440×900) én gsm (375 px). Console foutloos, geen horizontale scroll.
- Lokaal testen: `python3 -m http.server 3000` in deze map (modules werken niet via `file://`).

## Ontwerp

Richting gekozen door Victor: posterstijl (lichte poster-reeks met wazige kleurbollen) en een gebogen wiel als kiezer (referentie: verticale boog met pillen en labels). Bewust één licht thema.
- Bollen: zonder kleurverloop en zonder gloed, slank (Victor: verloop en glans oogden gedateerd, bollen en kern waren te dik). Vier stijlen in `src/orbs.js`, elk met een eigen kern: Ring (dunne cirkel met stip, kern zendt sonarringen uit), Vlak (effen schijf, kern met ademende ring), Raster (stippenschijf, pulserende stippenkern), Capsule (rekt uit langs de baan, kern is een ring met draaiend segment). Tijdelijke kiezer linksonder (`Bol`, toets `B`, of `?bollen=ring|vlak|raster|capsule`), keuze in localStorage `priority-orbit.orbstyle.v1`. Victor koos Capsule; nu nog een keuze tussen vier Capsule-varianten (`?capsule=a|b|c|d`: A capsule, B fijn, C taps, D kop + naald, elk met eigen kern). Daarna kiezer, `?capsule` en de andere stijlen weghalen.

- Papier #F1F1EF met lichte korrel (`.grain`, SVG-ruis, opacity 0,14). Inkt #1B1B22, secundair #5E5E68, tertiair #9A9AA3.
- Typografie: Geist (UI) en Geist Mono (kapitaaltjes in de hoeken, tellers), via Google Fonts, met systeemfont als terugval.
- Hoeklabels zoals op een platenhoes: linksboven ORBIT + samenvatting, rechtsboven weeknummer + datum, linksonder Boven / Zijkant / Focus.
- Kleur zit alleen in de bollen. Ringen, raster en wijzerplaat zijn grafiet met lage dekking; een ring krijgt zijn kleur pas bij hover of als sleepdoel.
- Desktop (≥ 1000 px): takenlijst links (300 px), scène in het midden, wiel rechts. Smaller: alles onder elkaar (kop, scène, aanzicht, horizontaal wiel, lijst).

## Bestanden

| Bestand | Inhoud |
|---|---|
| `src/config.js` | `LEVELS` (enige bron van waarheid: naam, ring, baan, omloop, kleur, grootte, staart), diepteprofiel, kleurhelpers, iconen voor het wiel |
| `src/orbs.js` | `ORB_STYLES` (id, naam, schaal), `paintOrb` (statische bol, ook voor het venster) en `halftone` (stippenschijf) |
| `src/scene.js` | Canvas-renderer met eigen 3D-projectie, animatie, hit-testing, slepen |
| `src/wheel.js` | Het gebogen wiel (DOM, posities via JS) |
| `src/app.js` | Data, takenlijst, venster "nieuwe taak", toast, focusmodus, sneltoetsen, lay-out |

## Niveaus

| id | naam | ring | baan | omloop | kleur |
|---|---|---:|---:|---:|---|
| 1 | Nu | 38 | 24 | 1,1 s | #FF3B30 |
| 2 | Vandaag | 72 | 72 | 2,8 s | #FF8A00 |
| 3 | Week | 106 | 106 | 7 s | #E5B21A |
| 4 | Maand | 140 | 140 | 16 s | #22AFC6 |
| 5 | Ooit | 174 | 174 | 38 s | #6A6CF6 |

"Nu" draait binnen de kernring (baan 24 < ring 38).

## Scène (`src/scene.js`)

- Eén canvas over het hele venster (desktop) of in `.stage` (gsm). Stage-eenheden: dezelfde 390-stage als vroeger; `FIT = 440` eenheden passen in min(beschikbare breedte, hoogte). `setInsets({left, right})` houdt de scène gecentreerd tussen lijst en wiel (zacht geanimeerd, ook bij focusmodus).
- Projectie per punt: spin (rond de trechteras) → rotateX (tilt) → rotateY (parallax) → zoom → shift → perspectief 1100 met oorsprong op 38 %. Zelfde waarden als de oude CSS-versie: boven tilt 0 / zoom 0,92, zijkant tilt 58° / zoom 0,96 / shift -66. Overgang 0,9 s met cubic-bezier(.4,0,.2,1), eigen implementatie.
- Lagen van achter naar voor: raster (zwaartekrachtput, buigt in het zijaanzicht mee met het diepteprofiel), wijzerplaat (120 streepjes, statisch), meridianen (alleen zijkant), ringen, kern, bollen met staart, effecten, labels.
- Banen draaien via een fase per niveau (`phase`), elke bol heeft een `offset` die zacht naar gelijke verdeling glijdt. Bij een niveauwissel blijft de absolute hoek behouden.
- Staart (`drawTrail`): taps vlak langs de baan dat vervaagt; bij Ring een haarlijn, bij Raster een stippellijn, bij Capsule geen staart maar een rek van de bol zelf. Lengte volgt de snelheid.
- Hover over een ring of bol: die baan glijdt tot stilstand (`speed` → 0), staarten krimpen mee, labels verschijnen (witte pil met leader), de bol krijgt een dun ringetje. Hover op een rij in de lijst doet hetzelfde voor die ene taak.
- Slepen op een bol: bol volgt de cursor, dichtstbijzijnde ring licht op ("Naar …"), loslaten verplaatst de taak (`onReassign`). Slepen op lege ruimte: horizontaal draaien, verticaal kantelen; loslaten klikt naar het dichtste aanzicht.
- Kern (`drawCore`): vorm hangt af van de bolstijl. Rood en levendig zolang er Nu-taken zijn (sneller bij meer Nu-taken), grijs en stil zonder. Ligt op de diepte van de tip.
- Intro: raster, wijzerplaat en ringen (van binnen naar buiten) faden in, bollen spiralen gestaffeld binnen. Nieuwe taken spiralen ook binnen; afvinken laat de bol uiteenspatten (deeltjes + ring).
- Tijdgebaseerd (dt), dus even snel op 60 en 120 Hz.

## Wiel (`src/wheel.js`)

- Vijf items langs een cirkelboog; `pos` (kommagetal) volgt `index` met een veer. Verticaal op desktop (middelpunt rechts buiten beeld), horizontaal op gsm (middelpunt onder het wiel).
- Scrollen (muiswiel of trackpad, met drempel en korte vergrendeling), slepen langs de boog, pijltjestoetsen. Klik op een ander item centreert het; klik op het geselecteerde item (of Enter) opent het venster "nieuwe taak" voor dat moment.
- Hover of selectiewissel licht de bijhorende ring in de scène kort op.

## Data

- Taken `{id, title, level, createdAt}` in localStorage, sleutel `priority-orbit.tasks.v1`. Ontbreekt de sleutel, dan demotaken (2 Nu, 2 Vandaag, 3 Week, 2 Maand, 2 Ooit).
- "Dringend" in de samenvatting = aantal Nu-taken.

## Interactie in de lijst en het venster

- Lijst gegroepeerd per moment. Afvinken: cirkel kleurt als bol, rij schuift weg, bol spat uiteen, toast met "Ongedaan maken" (5 s, ook `Z` of Ctrl/Cmd+Z).
- Dubbelklik op een titel om hem aan te passen. Bolletje rechts in een rij opent een keuze van de vijf momenten.
- Venster "nieuwe taak": native `<dialog>`, grote zwevende bol bovenaan in de kleur van het moment en de gekozen stijl, groot tekstveld, momentkeuze (ook met ↑↓ in het tekstveld), "Voeg toe" pas actief met een titel.
- Sneltoetsen: `N` nieuw, `1`/`2` aanzicht, `F` focus, `Z` ongedaan, `B` bolstijl (tijdelijk), `Esc` sluit.
- Focusmodus: lijst en wiel weg, volledig scherm (indien toegestaan), grote klok, datum en de Nu-taken leesbaar van op afstand. Cursor en knoppen verdwijnen na 2,5 s stilstand.

## Toegankelijkheid

- Canvas heeft `role="img"` met een samenvatting per niveau. Alles wat in de scène kan (afvinken, niveau wijzigen) kan ook via de lijst met toetsenbord.
- `prefers-reduced-motion`: banen, trechter en pulse staan stil, geen intro of deeltjes, overgangen direct.

## Valkuilen

- Canvas-teksten gebruiken Geist; is het font nog niet geladen, dan tekent hij met de terugval tot het binnen is (elk frame opnieuw).
- De camera moet geldig zijn vóór de eerste pointermove: `resize()` loopt meteen bij het opstarten (anders werd alles NaN als de muis al over de scène stond).
- Gsm: `.stage canvas` heeft `touch-action: pan-y` zodat de pagina kan scrollen; verticaal kantelen met de vinger kan daardoor niet, horizontaal draaien wel.

## Open vragen

- Moeten afgevinkte taken bewaard worden (geschiedenis, statistiek)?
- Synchronisatie tussen toestellen (nu alleen localStorage van één browser).
- Welke Capsule-variant blijft (A, B, C of D)?
- Een donkere variant voor 's avonds, of bewust alleen licht houden?
- Het wiel toont nu vijf items; als er ooit meer momenten bijkomen, werkt de boog al met meer items.
