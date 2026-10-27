# Orbit: projectkennis

To-do-visualizer: taken draaien als slanke, taps toelopende bollen rond vijf ringen, één per moment (Nu, Vandaag, Week, Maand, Ooit). Hoe dringender, hoe dichter bij de kern, hoe sneller. Gemaakt om open te staan op een scherm: mensen moeten vragen "wat is dat?".

Live: https://victorvansande.github.io/orbit/ (GitHub Pages, bron `main` / root). Elke push naar `main` publiceert opnieuw.

## Werkafspraken

- Antwoord en UI-tekst in het Nederlands. Geen em dashes, geen marketingtaal, geen emoji.
- Geen build-stap. `index.html` + `src/*.js` (ES-modules) + `src/styles.css`.
- Na elke afgeronde wijziging committen en pushen naar `main`, daarna de Pages-run opvolgen.
- Elke wijziging nakijken op desktop (1440×900) én gsm (375 px). Console foutloos, geen horizontale scroll.
- Lokaal testen: `python3 -m http.server 3000` in deze map (modules werken niet via `file://`).

## Ontwerp

Richting gekozen door Victor: posterstijl (lichte poster-reeks met wazige kleurbollen) en een gebogen wiel als kiezer (referentie: verticale boog met pillen en labels). Licht thema als basis, met een donkere variant (zie Thema).
- Bollen: stijl Taps (gekozen door Victor uit vier stijlen en vier varianten). Effen kleur, geen verloop, geen gloed: een ronde kop die taps uitloopt langs de baan, lengte volgt de snelheid. Bij stilstand (hover, slepen) blijft alleen de ronde kop over. Kern: een pulserend baken dat de urgentie weerspiegelt (zie Scène). Verloop, glans en dikke bollen oogden gedateerd; niet terugbrengen.

- Papier #F1F1EF met lichte korrel (`.grain`, SVG-ruis, opacity 0,14). Inkt #1B1B22, secundair #5E5E68, tertiair #9A9AA3.
- Typografie: Geist (UI) en Geist Mono (kapitaaltjes in de hoeken, tellers), via Google Fonts, met systeemfont als terugval.
- Hoeklabels zoals op een platenhoes: linksboven ORBIT + samenvatting, rechtsboven weeknummer + datum, linksonder Boven / Zijkant / Focus en Tempo (Normaal / Zen / Stil).
- Kleur zit alleen in de bollen. Ringen, raster en wijzerplaat zijn grafiet met lage dekking; een ring krijgt zijn kleur pas bij hover of als sleepdoel.
- Desktop (≥ 1000 px): takenlijst links (300 px), scène in het midden, wiel rechts. Smaller: alles onder elkaar (kop, scène, aanzicht, horizontaal wiel, lijst).

## Thema

- Schakelaar rechtsboven onder de datum: Licht / Donker / Auto (Auto volgt `prefers-color-scheme`, standaard). Toets `D` wisselt licht en donker. Keuze in localStorage `priority-orbit.theme.v1`.
- Een inline script in `<head>` zet `data-theme` vóór de eerste weergave (geen lichte flits). `app.js` houdt het daarna bij, ook als het systeemthema wijzigt, en past `meta[name=theme-color]` aan.
- CSS: alle kleuren zijn tokens op `:root`, herdefinieerd onder `:root[data-theme="dark"]` (papier #0F0F12, oppervlak #19191D, inkt #ECECF1). Nieuwe kleuren altijd als token toevoegen, nooit een losse `#fff` of `rgba(27, 27, 34, …)`.
- Canvas: `scene.setTheme(name)` wisselt `THEMES` (inkt van raster, ringen en wijzerplaat, labelpillen, grijze kern). De bolkleuren blijven gelijk.
- Korrel in het donker: `filter: invert(1)` met `mix-blend-mode: screen` en lagere dekking.
- Het wiel is op desktop maximaal `100dvh - 280px` hoog, zodat de hoeken (themaschakelaar, hint) klikbaar blijven.

## Icoon

- Merkteken: rode kern met één effen lichtgolf (het baken) en één taps bolletje in grafiet dat er met de klok mee omheen draait; op het grote icoon ook de gestippelde ring. Papier #F1F1EF, geen verloop of glans: iOS (liquid glass) en Android (maskers, Material You) voegen hun eigen effect toe.
- Favicon is vetter en zonder stippelring (leesbaar op 16 px) en volgt licht/donker via een media query in de SVG.

## Bestanden

| Bestand | Inhoud |
|---|---|
| `src/config.js` | `LEVELS` (enige bron van waarheid: naam, ring, baan, omloop, kleur, grootte, staart), diepteprofiel, kleurhelpers, iconen voor het wiel |
| `src/scene.js` | Canvas-renderer met eigen 3D-projectie, animatie, hit-testing, slepen, bollen en kern |
| `src/wheel.js` | Het gebogen wiel (DOM, posities via JS) |
| `favicon.svg`, `favicon.ico`, `icons/`, `manifest.webmanifest` | App-icoon en favicon voor alle platformen; bron en uitleg in `icons/README.md`, opnieuw maken met `python3 icons/make_icons.py` en daarna renderen |
| `src/deadline.js` | Datumhulp: `levelForDue`, `daysUntil`, `dueLabel`, `isDue`, `toDue` |
| `src/app.js` | Data, takenlijst, venster "nieuwe taak", toast, focusmodus, sneltoetsen, lay-out |

## Niveaus

| id | naam | ring | baan | omloop | kleur |
|---|---|---:|---:|---:|---|
| 1 | Nu | 38 | 38 | 1,1 s | #FF3B30 |
| 2 | Vandaag | 72 | 72 | 2,8 s | #FF8A00 |
| 3 | Week | 106 | 106 | 7 s | #E5B21A |
| 4 | Maand | 140 | 140 | 16 s | #22AFC6 |
| 5 | Ooit | 174 | 174 | 38 s | #6A6CF6 |

Elke bol draait op zijn eigen ring, ook Nu (baan 38 = ring 38; vroeger 24, dat oogde alsof de Nu-bollen naast hun baan zweefden).

## Scène (`src/scene.js`)

- Eén canvas over het hele venster (desktop) of in `.stage` (gsm). Stage-eenheden: dezelfde 390-stage als vroeger; `FIT = 440` eenheden passen in min(beschikbare breedte, hoogte). `setInsets({left, right})` houdt de scène gecentreerd tussen lijst en wiel (zacht geanimeerd, ook bij focusmodus).
- Projectie per punt: spin (rond de trechteras) → rotateX (tilt) → rotateY (parallax) → zoom → shift → perspectief 1100 met oorsprong op 38 %. Zelfde waarden als de oude CSS-versie: boven tilt 0 / zoom 0,92, zijkant tilt 58° / zoom 0,96 / shift -66. Overgang 0,9 s met cubic-bezier(.4,0,.2,1), eigen implementatie.
- Lagen van achter naar voor: raster (zwaartekrachtput, buigt in het zijaanzicht mee met het diepteprofiel), wijzerplaat (120 streepjes, statisch), meridianen (alleen zijkant), ringen, kern, bollen met staart, effecten, labels.
- Banen draaien via een fase per niveau (`phase`), elke bol heeft een `offset` die zacht naar gelijke verdeling glijdt. Bij een niveauwissel blijft de absolute hoek behouden.
- Bol (`drawOrb`): `tracePath` rekent de werkelijke baan terug (hoeksnelheid inclusief herschikking `vo`, radiale snelheid `vr`), `taper` vult er een effen, taps vlak langs (breedte 2r aan de kop, 0,35r aan het eind). Zo wijst de staart ook tijdens binnenvliegen en ringwissels de goede kant op. Lengte = (staart + 1) × 7 × `TAIL_LENGTH` × (snelheid / kruissnelheid), begrensd op 2,5 keer.
- Hover dimt de andere ringen licht (factor 0,32), niet weg: in het zijaanzicht moeten ze leesbaar blijven.
- Hover over een ring of bol: die baan glijdt tot stilstand (`speed` → 0), staarten krimpen mee, labels verschijnen (witte pil met leader), de bol krijgt een dun ringetje. Hover op een rij in de lijst doet hetzelfde voor die ene taak.
- Slepen op een bol: bol volgt de cursor, dichtstbijzijnde ring licht op ("Naar …"), loslaten verplaatst de taak (`onReassign`). Slepen op lege ruimte: horizontaal draaien, verticaal kantelen; loslaten klikt naar het dichtste aanzicht.
- Kern (`drawCore`): een baken. Effen stip die klopt en effen lichtgolven uitzendt (vlakke schijven die uitdijen en vervagen, geen verloop). `urgency` glijdt naar 0 (geen Nu/Vandaag: grijs, stil), 0,5 (alleen Vandaag: oranje, traag, één golf) of 1 tot 2 (Nu: rood, tempo en aantal golven stijgen per Nu-taak, max. 3). Tempo via een opgetelde fase (`beat`), zodat een tempowissel niet springt. Ligt op de diepte van de tip.
- Intro: raster, wijzerplaat en ringen (van binnen naar buiten) faden in, bollen spiralen gestaffeld binnen. Nieuwe taken spiralen ook binnen; afvinken laat de bol uiteenspatten (deeltjes + ring).
- Tijdgebaseerd (dt), dus even snel op 60 en 120 Hz.
- Tempo (`TEMPO`, `setTempo`): normaal; zen (omlooptijd Nu 8 s, de rest op een samengedrukte schaal `8 × (omloop / 1,1)^0,55`, zodat Nu het snelst blijft; trechter draait aan 35 %, kern klopt half zo snel); stil (banen en trechter glijden tot stilstand, kern zonder golven). Wissels glijden via `speed`, `spinScale`, `beatScale` en `waveVis`. Staarten volgen de snelheid en worden in zen vanzelf korte druppels.

## Wiel (`src/wheel.js`)

- Vijf items langs een cirkelboog; `pos` (kommagetal) volgt `index` met een veer. Verticaal op desktop (middelpunt rechts buiten beeld), horizontaal op gsm (middelpunt onder het wiel).
- Scrollen (muiswiel of trackpad, met drempel en korte vergrendeling), slepen langs de boog, pijltjestoetsen. Klik op een ander item centreert het; klik op het geselecteerde item (of Enter) opent het venster "nieuwe taak" voor dat moment.
- Hover of selectiewissel licht de bijhorende ring in de scène kort op.
- Merkteken: een fijn streepje dwars op de boog in de kleur van het gekozen moment (de zwarte pil uit de referentie paste niet). Geen `filter: blur` op de items: dat gaf op iOS Safari roze lijnen; verre items vervagen alleen via opacity.

## Data
- Deadlines (`src/deadline.js`): een taak met `due` heeft een vaste schil die uit de datum volgt: verstreken → Nu, vandaag → Vandaag, ≤ 7 dagen → Week, ≤ 31 dagen → Maand, later → Ooit. `applyDeadlines()` loopt bij het laden, elke minuut (ook over middernacht) en bij terugkeer naar het tabblad; een bol die van schil wisselt glijdt naar zijn nieuwe ring. Zulke taken zijn niet te slepen (cursor `pointer`), krijgen geen momentkeuze in de lijst maar een datumlabel ("over 3 dagen", "2 dagen te laat" in rood), en in de scène een dun ringetje in hun eigen kleur plus de datum in het label.

- Taken `{id, title, level, createdAt, due?}` in localStorage, sleutel `priority-orbit.tasks.v1`. `due` is optioneel, een lokale datum `JJJJ-MM-DD`. Ontbreekt de sleutel, dan demotaken (2 Nu, 2 Vandaag, 3 Week, 2 Maand, 2 Ooit).
- "Dringend" in de samenvatting = aantal Nu-taken.

## Interactie in de lijst en het venster

- Lijst gegroepeerd per moment. Afvinken: cirkel kleurt als bol, rij schuift weg, bol spat uiteen, toast met "Ongedaan maken" (5 s, ook `Z` of Ctrl/Cmd+Z).
- Datumlabel bij een deadline-taak opent een bewerker: datum wijzigen of deadline wissen (dan wordt het een gewone taak in de huidige schil).
- Dubbelklik op een titel om hem aan te passen. Bolletje rechts in een rij opent een keuze van de vijf momenten; op apparaten met hover verschijnt het pas als je over de rij gaat.
- Venster "nieuwe taak": native `<dialog>`, bovenaan een zwevende mini-orbit (taps bolletje rond een kleine kern) in kleur en tempo van het moment, alleen geanimeerd zolang het venster open is, groot tekstveld, momentkeuze (ook met ↑↓ in het tekstveld), optioneel "Deadline" (native datumveld; met een datum is de momentkeuze vergrendeld en toont een hint in welke schil de taak komt), "Voeg toe" pas actief met een titel.
- Sneltoetsen: `N` nieuw, `1`/`2` aanzicht, `F` focus, `T` tempo (normaal, zen, stil), `D` thema, `Z` ongedaan, `Esc` sluit.
- Sneltoetsenregel onder de lijst blijft op één regel (`width: max-content`, mag voorbij de lijstbreedte lopen).
- Tempo-schakelaar linksonder naast Focus; keuze in localStorage `priority-orbit.tempo.v1`.
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
- Het wiel toont nu vijf items; als er ooit meer momenten bijkomen, werkt de boog al met meer items.
