# Orbit: projectkennis

To-do-visualizer: taken draaien als bolletjes rond vijf concentrische ringen, één per prioriteit. Hoe dringender, hoe dichter bij het midden, hoe sneller en feller. Een snel draaiende rode kern in je ooghoek zegt: er ligt iets dat nu moet.

## Werkafspraken

- Antwoord en UI-tekst in het Nederlands. Geen em dashes, geen marketingtaal, geen emoji.
- Geen build-stap. Alleen `index.html`, `src/styles.css`, `src/app.js` (vanilla JS).
- Elke wijziging nakijken op 375 px breed (gsm) en op desktop. Console moet foutloos blijven.
- Lokaal testen: `python3 -m http.server 3000` in deze map, open `http://localhost:3000/`.

## Concept

- Vijf niveaus, elk een gestippelde ring. Elke taak is één bolletje met een korte staart.
- Taken op dezelfde ring staan gelijk verdeeld via een negatieve `animation-delay` (`-(i/n) * omlooptijd`).
- Zijaanzicht: dezelfde 3D-scène, gekanteld. De ringen vormen een trechter, de kern is de punt (de "teut"). Hoe dringender, hoe dieper.
- De hele trechter draait traag rond zijn as (160 s per omwenteling).

## Niveaus

De array `LEVELS` bovenaan `src/app.js` is de enige bron van waarheid (naam, ringstraal, baanstraal, omlooptijd, kleur, grootte bolletje, aantal staartstippen). CSS bevat geen niveauwaarden; alles komt via custom properties per element.

| id | naam | ring | baan | omloop | kleur |
|---|---|---:|---:|---:|---|
| 1 | Nu | 38 | 24 | 1,1 s | #FF453A |
| 2 | Vandaag | 72 | 72 | 2,8 s | #FF9F0A |
| 3 | Week | 106 | 106 | 7 s | #D9C25B |
| 4 | Maand | 140 | 140 | 16 s | #64B5C8 |
| 5 | Ooit | 174 | 174 | 38 s | #5E8BD6 |

"Nu" draait binnen de kernring (baan 24 < ring 38), dus dieper in de trechter.

## Ontwerpregels

- Apple HIG, alleen dark mode. Achtergrond #000, oppervlak #1C1C1E, secundaire tekst rgba(235,235,245,.6), scheidingslijnen rgba(84,84,88,.65), accent #0A84FF. Systeemfont.
- Rustig, geen neon: geen gradients, glow op het hoofd van een bolletje (`GLOW = 0.35`, blur = GLOW × 10 px = 3,5 px) en een zachte, pulserende gloed in de kern.
- Ringen: 2 px stippen elke ~8 px, opacity 0,38 (kernring 0,55). Oorspronkelijk 0,2 en 0,38, opgetrokken omdat de banen te zwak waren tegen het zwart. Staart: stippen elke ~7 px booglengte terug, kleiner, opacity max. 0,45.
- Touch targets minstens 44 px (segmented controls via een onzichtbare `::after`, afvinkcirkel in een 44 px knop).
- `prefers-reduced-motion`: banen, trechter en kernpulse staan stil (gepauzeerd, verdeling blijft zichtbaar), cameraovergang is direct.

## Architectuur

### Scène (`#scene`)

- Stage van 390×390 px, middelpunt (195,195). `ResizeObserver` zet `--fit` = containerbreedte / 390; `.scene` schaalt zich daarmee (2D, buiten de 3D-ruimte, zodat perspectief overal gelijk blijft).
- Nesting: `.scene` (perspective 1100px, origin 50% 38%) > `.camera` (shift, zoom, rotateX) > `.spin` (160 s) > `.origin` > lagen `#rings`, `#meridians`, tip, `#orbits`.
- `.camera`, `.spin`, `.origin`, lagen, `.orbit` en `.rotor` zijn 0×0 op het middelpunt met `preserve-3d`. Zo klopt het draaipunt en geven de onzichtbare containers geen horizontale overflow. Nooit `opacity` op zo'n container zetten: dat platdrukt de 3D-context.
- Camera via geregistreerde properties (`@property --depth, --tilt, --shift, --zoom, --now`) op `data-view` van `.scene`. Overgang 0,9 s `cubic-bezier(.4,0,.2,1)`.
  - Boven: depth 0, tilt 0, zoom 0,92.
  - Zijkant: depth 1, tilt 58°, zoom 0,96, shift -66 px.
- Elke stip (`.pt`): `translate3d(var(--x), var(--y), calc(var(--depth) * var(--z) * 1px))`. `--z` komt uit het diepteprofiel `PROFILE` via `depthAt(r)` (lineaire interpolatie).
- Meridianen (8) en de rode tip zijn er altijd, maar hun opacity is × `--depth`, dus alleen zichtbaar in het zijaanzicht. De tip ook × `--now` (1 als er Nu-taken zijn, klasse `has-now`).
- Kern (`.core` > `.core-glow`): zachte rode gloed die pulseert (2,4 s, opacity 0,5 tot 1, scale 0,8 tot 1,2). Zit op de diepte van de punt, dus in het bovenaanzicht in het midden en in het zijaanzicht op de tip. Alleen zichtbaar met Nu-taken (× `--now`). Pulse via de losse `scale`-property, zodat ze niet botst met de `transform` van de diepte. Bij reduced motion: vaste gloed zonder pulse.
- Ringen, meridianen en tip worden één keer opgebouwd. Taakbolletjes (`buildOrbits`) worden bij elke wijziging volledig opnieuw opgebouwd: `.orbit` (diepte) > `.rotor` (draait) > staartstippen + `.head`.

### Data

- Taken `{id, title, level, createdAt}` in localStorage, sleutel `priority-orbit.tasks.v1`.
- Ontbreekt de sleutel (of is de inhoud kapot), dan komen er demotaken: 2× Nu, 2× Vandaag, 3× Week, 2× Maand, 2× Ooit. Een lege lijst `[]` blijft leeg.
- Lijst gesorteerd op niveau, daarna op `createdAt`.
- "Dringend" in de samenvatting = aantal taken op niveau Nu.

### UI-stromen

- Afvinken: cirkel wordt meteen blauw, rij vervaagt 280 ms (na 140 ms vertraging), na 430 ms verdwijnt de taak uit lijst en orbit en wordt er opgeslagen. Ids in `completing` blijven vervaagd als de lijst tussendoor herbouwd wordt.
- Nieuwe taak: native `<dialog>` als bottom sheet (`showModal`). Annuleer, Escape en tik op de achtergrond sluiten met een korte schuifanimatie. "Voeg toe" is uitgeschakeld zolang de titel leeg is (Enter doet dan ook niets). Standaardprioriteit: Week.

### Valkuilen

- Klassenamen in de scène (`.head`, `.tail`, `.pt`, `.orbit`, `.rotor`) niet hergebruiken in de rest van de pagina. Een `<header class="head">` kreeg ooit de absolute positionering van een taakbolletje; daarom heet de paginakop `.masthead`.

## Open vragen

- `GLOW = 0.35`: in de opdracht stond een box-shadow van 3,5 px en een globale constante 0,35. Nu geïnterpreteerd als blur = GLOW × 10 px, met de volle kleur. Andere lezing: kleur op 35 % alpha.
- Zijaanzicht-shift staat op -66 px in plaats van ~50 px, omdat de trechter anders te laag in het vierkant hangt.
- Telt "Vandaag" ook als dringend? Nu niet (de voorbeeldtekst "2 dringend · 11 taken" klopt alleen met enkel Nu).
- Bij reduced motion staat alles stil. Alternatief: heel traag laten draaien zodat de kern nog "leeft".
- Een taak bewerken of van niveau veranderen kan nog niet. Afgevinkte taken worden niet bewaard (geen geschiedenis of ongedaan maken).
- Geen synchronisatie tussen toestellen; alles zit in localStorage van één browser.
- Bij elke wijziging herstarten alle banen (posities springen even). Eventueel later fases behouden.
