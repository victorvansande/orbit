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
- Bollen: stijl Taps (gekozen door Victor uit vier stijlen en vier varianten). Effen kleur, geen verloop, geen gloed: een ronde kop die taps uitloopt langs de baan, lengte volgt de snelheid. Bij stilstand (hover, slepen) blijft alleen de ronde kop over. Kern: Rasterpunt, een cirkel van drukpuntjes die de urgentie weerspiegelt (zie Scène). Verloop, glans en dikke bollen oogden gedateerd; niet terugbrengen.

- Papier #F1F1EF met lichte korrel (`.grain`, SVG-ruis, opacity 0,14). Inkt #1B1B22, secundair #5E5E68, tertiair #9A9AA3.
- Typografie: Geist (UI) en Geist Mono (kapitaaltjes in de hoeken, tellers), via Google Fonts, met systeemfont als terugval.
- Hoeklabels zoals op een platenhoes: linksboven ORBIT TASKS (Geist 600, 13 px, kapitalen met letterafstand 0,18em) + samenvatting, rechtsboven weeknummer + datum, linksonder Boven / Zijkant / Focus en Tempo (Normaal / Zen / Stil).
- Kleur zit alleen in de bollen. Ringen, raster en wijzerplaat zijn grafiet met lage dekking; een ring krijgt zijn kleur pas bij hover of als sleepdoel.
- Desktop (≥ 1000 px): takenlijst links (300 px), scène in het midden, wiel rechts. Smaller: alles onder elkaar (kop, scène, aanzicht, horizontaal wiel, lijst).

## Thema

- Schakelaar rechtsboven onder de datum: Licht / Donker / Auto (Auto volgt `prefers-color-scheme`, standaard). Toets `D` wisselt licht en donker. Keuze in localStorage `priority-orbit.theme.v1`.
- Een inline script in `<head>` zet `data-theme` vóór de eerste weergave (geen lichte flits). `app.js` houdt het daarna bij, ook als het systeemthema wijzigt, en past `meta[name=theme-color]` aan.
- CSS: alle kleuren zijn tokens op `:root`, herdefinieerd onder `:root[data-theme="dark"]` (papier #0F0F12, oppervlak #19191D, inkt #ECECF1). Nieuwe kleuren altijd als token toevoegen, nooit een losse `#fff` of `rgba(27, 27, 34, …)`.
- Momentkleuren: elk niveau heeft `color` (licht) en `dark` (gedempt: minder verzadigd, zodat de bollen in het donker niet als kleurboek ogen). DOM-elementen krijgen beide via `toneNode()` (`data-tone`, `--c-l`, `--c-d`); CSS kiest `--c` per thema.
- Canvas: `scene.setTheme(name)` wisselt `THEMES` (inkt van raster, ringen en wijzerplaat, labelpillen, grijze kern) en het bolpalet (`PALETTES`), ook voor de kern.
- Korrel in het donker: `filter: invert(1)` met `mix-blend-mode: screen` en lagere dekking.
- Het wiel is op desktop maximaal `100dvh - 280px` hoog, zodat de hoeken (themaschakelaar, hint) klikbaar blijven.

## Icoon

- Merkteken: Amaranth-kern (#E70049, zelfde als Nu) met één effen lichtgolf (het baken) en één taps bolletje dat er met de klok mee omheen draait; op het grote icoon ook de gestippelde ring. Geen verloop of glans: iOS (liquid glass) en Android (maskers, Material You) voegen hun eigen effect toe.
- App-icoon (`apple-touch-icon`, Android `any`) is volledig transparant buiten de orbit-elementen (Victor: liquid glass). Bolletje en ring zijn daarom middengrijs #8A8A94, leesbaar op lichte én donkere achtergronden. Alleen `maskable` heeft papier #F1F1EF (Android eist een vol vlak). Onzeker: iOS vulde transparantie bij webiconen vroeger met zwart; blijkt dat zo, terug naar een vol vlak.
- Favicon is vetter en zonder stippelring (leesbaar op 16 px) en volgt licht/donker via een media query in de SVG.

## Bestanden

| Bestand | Inhoud |
|---|---|
| `src/config.js` | `LEVELS` (enige bron van waarheid: naam, ring, baan, omloop, kleur, grootte, staart), diepteprofiel, kleurhelpers, iconen voor het wiel |
| `src/scene.js` | Canvas-renderer met eigen 3D-projectie, animatie, hit-testing, slepen, bollen en kern |
| `src/wheel.js` | Het gebogen wiel (DOM, posities via JS) |
| `sw.js` | Service worker: offline werken (netwerk eerst met time-out van 3,5 s, anders de bewaarde kopie) |
| `favicon.svg`, `favicon.ico`, `icons/`, `manifest.webmanifest` | App-icoon en favicon voor alle platformen; bron en uitleg in `icons/README.md`, opnieuw maken met `python3 icons/make_icons.py` en daarna renderen |
| `src/deadline.js` | Datumhulp: `levelForDue`, `dueLabel`, `isDue`, `isOverdue`, `toDue` |
| `src/app.js` | Data, takenlijst, venster "nieuwe taak", toast, focusmodus, sneltoetsen, lay-out, koppeling met sync |
| `src/matrix.js` | Matrixklok: cijfers van 5 × 7 stippen (zelfde glyphs als Kwick), `setMatrix(root, tekst)`, `twinkleDot(root)` |
| `src/quotes.js` | Bibliotheek van 223 korte, positieve Engelse quotes met gekende bron, voor de focusmodus |
| `src/stats.js` | Statistiek: afgevinkt per dag (`priority-orbit.stats.v1`) en de sterrenhemel (`priority-orbit.stars.v2`) |
| `src/backup.js` | Tweede kopie van taken en afgevinkte taken in IndexedDB |
| `src/store.js` | Vangnet: archief (afgevinkte taken) en momentopnames in localStorage |
| `src/sync.js` | Synchronisatie tussen toestellen: synccode, versleuteling, verbinding met de Orbit-server, samenvoegen |
| `src/pair.js` | Koppelen met een QR-code: `renderQr`, `codeFromText`, `createScanner` (camera) |
| `src/vendor/qrcode.min.mjs`, `src/vendor/jsqr.min.js` | qrcode-generator 2.0.4 (MIT, QR maken) en jsQR 1.4.0 (Apache-2.0, QR lezen), met esbuild verkleind, pas geladen als nodig |
| `worker/` | Eigen sync-server op Cloudflare (Worker + Durable Object), deploy via `.github/workflows/sync-worker.yml` |

## Niveaus

| id | naam | ring | baan | omloop | kleur | donker |
|---|---|---:|---:|---:|---|---|
| 1 | Nu | 38 | 38 | 1,1 s | #E70049 | #F0306A |
| 2 | Vandaag | 72 | 72 | 2,8 s | #E08600 | #F5A623 |
| 3 | Week | 106 | 106 | 7 s | #0FAE69 | #20E08A |
| 4 | Maand | 140 | 140 | 16 s | #1F78B4 | #38A0F0 |
| 5 | Ooit | 174 | 174 | 38 s | #08415C | #B3B9D6 |

Palet C "Foto, warm naar koel" (gekozen door Victor, vertrokken van zijn foto: Amaranth, Orange, Spring Green, Yale Blue). Hoe verder weg, hoe koeler: Nu en Vandaag warm, Week groen, Maand en Ooit twee tinten Yale Blue; in het donker wordt Ooit een zacht staalblauw (anders te dicht bij Maand). Geen geel: naast oranje te weinig onderscheidbaar. Getoetst: elke kleur minstens 2,4:1 tegen het lichte papier en 4,9:1 tegen het donkere, en elk paar momenten minstens 0,16 uit elkaar in OKLab (vorige palet: Maand en Ooit 0,09 in het donker, te dicht).

Elke bol draait op zijn eigen ring, ook Nu (baan 38 = ring 38; vroeger 24, dat oogde alsof de Nu-bollen naast hun baan zweefden).

## Scène (`src/scene.js`)

- Eén canvas over het hele venster (desktop) of in `.stage` (gsm). Stage-eenheden: dezelfde 390-stage als vroeger; `FIT = 440` eenheden passen in min(beschikbare breedte, hoogte). `setInsets({left, right})` houdt de scène gecentreerd tussen lijst en wiel (zacht geanimeerd, ook bij focusmodus).
- Projectie per punt: spin (rond de trechteras) → rotateX (tilt) → rotateY (parallax) → zoom → shift → perspectief 1100 met oorsprong op 38 %. Zelfde waarden als de oude CSS-versie: boven tilt 0 / zoom 0,92, zijkant tilt 58° / zoom 0,96 / shift -66. Overgang 0,9 s met cubic-bezier(.4,0,.2,1), eigen implementatie.
- Lagen van achter naar voor: raster (zwaartekrachtput), sterrenhemel, wijzerplaat (120 streepjes), ringen, kern, bollen met staart, effecten, labels.
- Banen draaien via een fase per niveau (`phase`), elke bol heeft een `offset` die zacht naar gelijke verdeling glijdt. Bij een niveauwissel blijft de absolute hoek behouden.
- Bol (`drawOrb`): `tracePath` rekent de werkelijke baan terug (hoeksnelheid inclusief herschikking `vo`, radiale snelheid `vr`), `taper` vult er een effen, taps vlak langs (breedte 2r aan de kop, 0,35r aan het eind). Zo wijst de staart ook tijdens binnenvliegen en ringwissels de goede kant op. Lengte = (staart + 1) × 7 × `TAIL_LENGTH` × (snelheid / kruissnelheid), begrensd op 2,5 keer.
- Wijzerplaat: 120 streepjes (elke tiende lang). Vanaf 12 uur lichten er evenveel op als er deze maand taken afgevinkt zijn (max. 120), met het label "n IN MAAND" erboven (zie Statistiek). De klok op de rand (uurstip, minutenlijn, cijfers 12/3/6/9) is weggehaald op vraag van Victor: geen meerwaarde, enkel afleiding naast de digitale klok.
- Minder drukte in het zijaanzicht (alles schaalt met `cam.depth`, dus glijdt mee met de camera): de achterkant van elke ring (van de kijker af) zakt naar ongeveer een derde dekking zodat de ellipsen niet even sterk kruisen, elke tweede ringstip vervaagt (de overige worden iets krachtiger), het raster wijkt binnen en rond de trechter terug (tot ±90 eenheden buiten de rand) en is lichter, wijzerplaat op de helft. Geen meridianen meer: de ringen tonen de vorm al.
- Hover dimt de andere ringen licht (factor 0,32), niet weg: in het zijaanzicht moeten ze leesbaar blijven.
- Hover over een ring of bol: die baan glijdt tot stilstand (`speed` → 0), staarten krimpen mee, labels verschijnen (witte pil met leader), de bol krijgt een dun ringetje. Hover op een rij in de lijst doet hetzelfde voor die ene taak.
- Slepen op een bol: bol volgt de cursor, dichtstbijzijnde ring licht op ("Naar …"), loslaten verplaatst de taak (`onReassign`). Slepen op lege ruimte: horizontaal draaien, verticaal kantelen; loslaten klikt naar het dichtste aanzicht.
- Kern (`drawCore`): **Rasterpunt** (gekozen door Victor uit twee reeksen voorstellen, nr. 10). Een cirkel van drukpuntjes in een zeshoekig raster, zoals op een risoposter, plat in het vlak van de tip (elk puntje wordt geprojecteerd, dus een ellips in het zijaanzicht). Puntjes groter in het midden, kleiner naar de rand. Altijd rood (Nu-kleur), op vraag van Victor; `urgency` bepaalt straal (13 tot 22 + 4 eenheden) en de golf: bij elke slag (`beat`) rolt een golf van grotere puntjes naar buiten. Rustig: klein, grijs, een trage ademgolf. Stil-tempo en reduced motion: geen golf. Op kleine schermen wordt het raster grover (min. 5 px tussen puntjes, `coreGrid(spacing)` wordt gecachet), anders vervloeit het tot een vlek. Vorige kern (baken met stip en schijven) vond Victor te lakluster.
- Intro: raster, wijzerplaat en ringen (van binnen naar buiten) faden in, bollen spiralen gestaffeld binnen. Nieuwe taken spiralen ook binnen.
- Afvinken: **Zilver** (gekozen door Victor uit vijf fonkelvarianten, na eerst Slinger). De bol fonkelt uit waar hij stond: vaste plek in de trechter (`twinkles`, draait mee met de trechter), een vierpuntige ster met holle zijden (`star4`) in de inktkleur zwelt op, draait een kwartslag en krimpt tot niets, met de bol als gekleurde kern die meedooft. Duur `TWINKLE_LIFE` = 1,1 s. Eerder: deeltjes en een ring (te standaard), daarna Slinger (rechtdoor uit de baan). Reduced motion: geen animatie.
- Tijdgebaseerd (dt), dus even snel op 60 en 120 Hz.
- Tempo (`TEMPO`, `setTempo`): normaal; zen (omlooptijd Nu 8 s, de rest op een samengedrukte schaal `8 × (omloop / 1,1)^0,55`, zodat Nu het snelst blijft; trechter draait aan 35 %, kern klopt half zo snel); stil (banen en trechter glijden tot stilstand, kern zonder golven). Wissels glijden via `speed`, `spinScale`, `beatScale` en `waveVis`. Staarten volgen de snelheid en worden in zen vanzelf korte druppels.

## Wiel (`src/wheel.js`)

- Vijf items langs een cirkelboog; `pos` (kommagetal) volgt `index` met een veer. Verticaal op desktop (middelpunt rechts buiten beeld), horizontaal op gsm (middelpunt onder het wiel).
- Scrollen (muiswiel of trackpad, met drempel en korte vergrendeling), slepen langs de boog, pijltjestoetsen. Klik op een ander item centreert het; klik op het geselecteerde item (of Enter) opent het venster "nieuwe taak" voor dat moment.
- Hover of selectiewissel licht de bijhorende ring in de scène kort op.
- Gsm (horizontaal): pillen staan dicht op de boog (`out: 50`, wiel 168 px hoog), merkstreepje op de boog zelf.
- Merkteken: een fijn streepje dwars op de boog in de kleur van het gekozen moment (de zwarte pil uit de referentie paste niet). Geen `filter: blur` op de items: dat gaf op iOS Safari roze lijnen; verre items vervagen alleen via opacity.

## Data
- Deadlines (`src/deadline.js`): een taak met `due` heeft een vaste schil die uit de datum volgt: verstreken → Nu, vandaag → Vandaag, ≤ 7 dagen → Week, ≤ 31 dagen → Maand, later → Ooit. `applyDeadlines()` loopt bij het laden, elke minuut (ook over middernacht) en bij terugkeer naar het tabblad; een bol die van schil wisselt glijdt naar zijn nieuwe ring. Zulke taken zijn niet te slepen (cursor `pointer`), krijgen geen momentkeuze in de lijst maar een datumlabel ("over 3 dagen", "2 dagen te laat" in rood), en in de scène een dun ringetje in hun eigen kleur plus de datum in het label.

- Taken `{id, title, level, createdAt, updatedAt, due?}` in localStorage, sleutel `priority-orbit.tasks.v1`. Elke wijziging (titel, moment, deadline, ongedaan maken) zet `updatedAt` via `touch()`; een automatische schilwissel door een deadline niet (die volgt op elk toestel vanzelf uit de datum). Afgevinkte taken staan als `{id: tijdstip}` in `priority-orbit.gone.v1` (nodig voor sync, na 60 dagen opgeruimd). `due` is optioneel, een lokale datum `JJJJ-MM-DD`. Ontbreekt de sleutel, dan demotaken (2 Nu, 2 Vandaag, 3 Week, 2 Maand, 2 Ooit).
- "Dringend" in de samenvatting = aantal Nu-taken.

## Vangnet: nooit iets kwijt (`src/store.js`)

Ingebouwd nadat Victor bij het testen van sync al zijn taken kwijtraakte (oorzaak: sync wiste stil voorbeeldtaken en er bestond geen tweede kopie). Regel: geen enkele code mag taken laten verdwijnen zonder spoor.
- **Archief** (`priority-orbit.archive.v1`): afvinken bewaart de volledige taak met `doneAt` (60 dagen, max. 500). Ook taken die via sync verdwijnen omdat ze elders afgevinkt zijn (`by: 'elders'`). `restore(ids)` zet terug met een nieuwe `updatedAt`, dus ook op andere toestellen. De toast "Ongedaan maken" en `Z` gebruiken `toastAction`.
- **Momentopnames** (`priority-orbit.snapshots.v1`, laatste 20, ontdubbeld op id:updatedAt): dagelijks bij het laden, vóór elke sync die taken laat verdwijnen, vóór import en terugzetten, en in `saveTasks` telkens de opslag taken bevat die niet in het geheugen zitten en niet afgevinkt zijn (bv. een ander tabblad). Terugzetten (`bringBack`) voegt alleen ontbrekende taken toe, nooit iets weg.
- **Voorbeeldtaken** (`demo: true`) worden nooit opgeslagen of gesynchroniseerd (`realTasks()`); je eerste eigen taak vervangt ze, een hint in de lijst zegt dat.
- **Oude opgeslagen voorbeeldtaken** (`demoIds`): titel en moment uit `DEMO`, nooit gewijzigd, en als groepje van minstens drie aangemaakt binnen 15 s. Staan ze tussen echte taken, dan ruimt `dropDemo` ze op met een afvinkmarkering (`gone`), zodat ze ook op gekoppelde toestellen verdwijnen, na een momentopname "Voor opruimen voorbeeldtaken". Dat gebeurt bij het laden én op alles wat via sync binnenkomt. Zonder echte taken blijven ze zichtbaar als voorbeeld, maar worden ze niet bewaard of gedeeld. Fout uit het verleden: het vangnet maakte ze eerst tot gewone taken, waarna sync de voorbeeldtaken van Victors gsm tussen zijn 11 eigen taken op de pc zette.
- **Tabbladen**: `storage`-event leest de opslag opnieuw in (taken, archief, statistiek en sterren), zodat tabbladen elkaar niet overschrijven.
- **Venster Archief** (knop rechtsboven naast Sync, toets `A`): tabbladen Afgevinkt en Momentopnames, Exporteer (JSON `orbit-JJJJ-MM-DD.json` met taken en archief) en Importeer (samenvoegen, recentste versie wint, niets verdwijnt).
- Getest: bestaande taken blijven staan, voorbeeld niet bewaard, archief en terugzetten, momentopname bij overschrijven, export en import, tabbladen, sync met elders afgevinkt en terugzetten.

## Synchronisatie (`src/sync.js`)

- **Eigen server op Cloudflare** (`worker/`, live op `https://orbit-sync.victorvansande.workers.dev`). Vroeger publieke MQTT-servers zoals streep (HiveMQ 8884, EMQX 8084), maar die waren voor Victor onbereikbaar (op 27/10/2026 synchroniseerde ook streep niet) en Orbit moet op het werk werken. De Worker loopt over https (443).
  - Eén Durable Object (`Channel`, SQLite-opslag, gratis abonnement) per kanaal. Bewaart de laatste versleutelde lijst met versienummer plus de 20 vorige versies, elk onder een eigen sleutel `h:0000000042` (één waarde mag max. 2 MB zijn; vroeger zaten alle versies samen onder `history`, dat wordt bij het eerste gebruik omgezet), en recente bevestigingen (10 min).
  - `GET /v1/<kanaal>/history`: huidige plus 20 vorige versies, versleuteld. De app ontcijfert ze (`sync.history()`) en toont ze onder Archief → Momentopnames → "Op de Orbit-server", met "Zet n terug" (`bringBack`, voegt alleen ontbrekende taken toe).
  - API: `GET /v1/<kanaal>` als WebSocket (live, berichten `snap`, `ok`, `ack`, `pub`, keepalive `ping`/`pong` via auto-response zodat het object niet wakker hoeft) of als JSON `{v, d, acks}`; `PUT /v1/<kanaal>` met `{d}`; `POST /v1/<kanaal>/ack`. Kanaal = 32 hex-tekens, max. 512 KB, CORS alleen voor `victorvansande.github.io` en localhost.
  - Client: WebSocket; mislukt die twee keer zonder ooit te openen (proxy die WebSockets breekt), dan gewone https om de 4 s (20 s als het tabblad verborgen is). Herverbinden met oplopende wachttijd (1 tot 15 s).
  - Deploy: GitHub Action `sync-worker.yml` bij een push in `worker/` of handmatig (Actions, "Run workflow"). Repo-secrets `CLOUDFLARE_API_TOKEN` (sjabloon "Edit Cloudflare Workers") en `CLOUDFLARE_ACCOUNT_ID`, door Victor zelf ingesteld. Secrets nooit zelf invullen.
  - Lokaal testen: `npx wrangler@4.153.0 dev --port 8787` in `worker/` en in de browser `localStorage.setItem('priority-orbit.server', 'http://127.0.0.1:8787')`. Die sleutel overschrijft de server; nooit in productie zetten.
- Verschil met streep: Orbit is een openbare site met persoonlijke taken. Een synccode van 16 tekens (`XXXX-XXXX-XXXX-XXXX`, zonder 0/O/1/I/L) bepaalt het kanaal (eerste 16 bytes van SHA-256 over `orbit-topic:` + code, als 32 hex-tekens) en de sleutel (PBKDF2 150k, AES-GCM 256). Alles wordt in de browser versleuteld; de broker ziet enkel ruis. Wie de code niet heeft, vindt het kanaal niet en kan niets lezen.
- Koppelen met een QR-code, **in één richting** (Victor: "degene die scant ontvangt, degene die gescand wordt stuurt enkel door"). Knop rechtsboven heet "Koppelen" zolang er niets gekoppeld is, daarna de status.
  - Startscherm: twee keuzes. **Verstuur van dit toestel** (toont de QR met de koppellink `…#sync=CODE`, de lijst hier blijft) of **Ontvang op dit toestel** (camera in Orbit: BarcodeDetector, anders jsQR voor Safari; de lijst hier wordt vervangen). "Code typen om te ontvangen" als terugval; zonder camera gaat het venster daar vanzelf naartoe.
  - Rollen in `sync.js`: `send` (publiceert zijn lijst als bewaarde snapshot, luistert op `<kanaal>/ack`), `receive` (publiceert niets tot er een lijst binnen is, neemt die over via `onReceive` na een momentopname "Voor ontvangen", stuurt dan een versleutelde bevestiging met toestelnaam en aantal), daarna `normal` (samenvoegen per taak, beide richtingen).
  - Verzender ziet "Dit toestel → Toestel dat scant", de QR en een statusregel: verbinden, "Klaar om te versturen: n taken", "Verstuurd naar iPhone: n taken". Een gekoppeld toestel opent het venster altijd als verzender (`sync.send()`); sluiten zet het terug op `normal` (`endSend`).
  - Ontvanger ziet vier stappen (code ontvangen, verbinden, wachten op de lijst, taken overgenomen). Na 20 s zonder lijst: uitleg en "Opnieuw proberen"; na 4 mislukte verbindingen: Orbit-server onbereikbaar, met de tip mobiele data te proberen (sommige bedrijfsnetwerken blokkeren workers.dev).
  - Een geopende link (ook via de gewone gsm-camera) vraagt één tik "Ontvang taken", met de waarschuwing dat de lijst vervangen wordt. Bewust niet automatisch. Ook als het toestel al met dezelfde code gekoppeld is: wie scant, ontvangt altijd (vroeger werd dat stil overgeslagen en bleef het toestel gewoon samenvoegen).
  - `deviceName()` in `pair.js` (iPhone, iPad, Android-gsm, Mac, Windows-pc, ...) voor de bevestiging.
  - **Webapp op het beginscherm** (iOS, en Android bij installatie) heeft een eigen opslag, los van de browser: ze start met voorbeeldtaken en zonder koppeling. Victor ontdekte dat dit de oorzaak was van "sync werkt niet op gsm". Op één gsm kun je je eigen scherm niet scannen, dus: "Kopieer link" in de browser, in de app Koppelen → "Code of link plakken" → **Plak** (leest het klembord en ontvangt meteen; `codeFromText` aanvaardt code of link). In app-modus (`display-mode: standalone` of `navigator.standalone`) zonder koppeling toont de lijst uitleg met "Taken ontvangen" / "Later" (`priority-orbit.pairhint.v1`) en verschijnt bij het openen een melding met knop Koppelen.
  - Getest tegen de Worker in `wrangler dev`, met een nep-camera in Chromium (`--use-file-for-fake-video-capture` met een mjpeg van de QR): pc verstuurt, gsm met eigen taak ontvangt (lijst vervangen, momentopname bewaard), bevestiging bij de verzender, daarna gelijk in beide richtingen, link met bevestiging, time-out, server onbereikbaar, en alles opnieuw zonder WebSocket (https-terugval).
- Code in localStorage `priority-orbit.sync.v1`; bij het laden verbindt de app meteen opnieuw. Ook opnieuw bij `visibilitychange` (gsm uit de achtergrond) en `online`.
- Samenvoegen (`mergeStates`): per taak wint de recentste `updatedAt`; een taak in `gone` blijft weg tenzij ze nadien opnieuw gewijzigd is (ongedaan maken). Na samenvoegen publiceert een toestel enkel als het iets had wat de snapshot nog niet had. Wijzigingen worden 400 ms gebundeld.
- Voorbeeldtaken gaan nooit mee (`getState` geeft `realTasks()`); er wordt bij het koppelen niets meer weggefilterd.
- Wat sync laat verdwijnen (elders afgevinkt) gaat naar het archief, met eerst een momentopname en een toast "Terugzetten".
- Elk toestel heeft een volledige kopie en verstuurt eigen wijzigingen opnieuw bij verbinden; de server bewaart bovendien 20 vorige versies. Risico: een bedrijfsnetwerk dat `*.workers.dev` blokkeert; dan helpt een eigen domein op Cloudflare.

## Statistiek (`src/stats.js`)

Victor wou iets kleins ter motivatie; vier voorstellen tijdelijk tegelijk aan (2, 3, 4 en 5):
- Telling per dag `{days: {'JJJJ-MM-DD': n}}` in `priority-orbit.stats.v1`, verloopt nooit. Bij de eerste keer aangevuld uit het archief. Afvinken telt +1 (ook elders afgevinkt via sync), ongedaan maken -1. Voorbeeldtaken tellen niet.
- **Matrixteller** onder de lijst (`#stat-total`, zelfde stippen als de klok) met "stars collected": evenveel als er sterren aan de hemel staan. Af en toe (7 tot 16 s) fonkelt één verlichte stip uit als dezelfde vierpuntige ster (`twinkleDot` in `matrix.js`), als knipoog naar de hemel. Niet bij reduced motion of als de teller onzichtbaar is.
- **Weekraster**: zeven rasterpuntjes ma tot zo (`rasterDot`, vol bij 5), toekomstige dagen vaag, vandaag vet.
- **Wijzerplaat** vult zich met de maand (zie Scène).
- **Sterrenhemel**: één ster per afgevinkte taak, voorgoed (`priority-orbit.stars.v2`, `{id, x, y, s, ph}` in stage-eenheden rond het midden, tussen straal 24 en 250). Plaatsing met best candidate (Mitchell): 14 kandidaten rond de plek waar de taak uitfonkelde (14 tot 60 eenheden weg, dus niet op de baan), anders 80 overal; de kandidaat die het verst van de rest ligt, met minimale afstand `GAPS` 11, 9, 7,5 of 6,5. Zo oogt een volle hemel natuurlijk, zonder raster en zonder overlap (getest: 400 sterren, kleinste afstand 11). `matchStars` zorgt dat er evenveel sterren als afgevinkte taken zijn. Getekend achter de wijzerplaat, los van de camera, zachtjes fonkelend; bij veel sterren iets kleiner.

## Interactie in de lijst en het venster

- Lijst gegroepeerd per moment. Afvinken: cirkel kleurt als bol, rij schuift weg, bol fonkelt uit (Zilver), toast met "Ongedaan maken" (5 s, ook `Z` of Ctrl/Cmd+Z).
- Datumlabel bij een deadline-taak opent een bewerker: datum wijzigen of deadline wissen (dan wordt het een gewone taak in de huidige schil).
- Dubbelklik op een titel om hem aan te passen. Bolletje rechts in een rij opent een keuze van de vijf momenten; op apparaten met hover verschijnt het pas als je over de rij gaat.
- Venster "nieuwe taak": native `<dialog>`, bovenaan een zwevende mini-orbit (taps bolletje rond een kleine kern) in kleur en tempo van het moment, alleen geanimeerd zolang het venster open is, groot tekstveld, momentkeuze (ook met ↑↓ in het tekstveld), optioneel "Deadline" (native datumveld; met een datum is de momentkeuze vergrendeld en toont een hint in welke schil de taak komt), "Voeg toe" pas actief met een titel.
- Sneltoetsen reageren niet op toetsherhaling (`e.repeat`): `D` ingedrukt houden flitste anders tussen licht en donker.
- Sneltoetsen: `N` nieuw, `1`/`2` aanzicht, `F` focus, `T` tempo (normaal, zen, stil), `D` thema, `A` archief, `Z` ongedaan, `Esc` sluit. Niet actief zolang een venster open is.
- Sneltoetsen onder de lijst zitten achter een klein knopje "Sneltoetsen" (Victor: niet altijd zichtbaar); de regel schuift open bij hover, toetsenbordfocus of klik (`.keys.is-open`), blijft op één regel (`white-space: nowrap`, mag voorbij de lijstbreedte lopen). Verborgen op gsm en touchscreens.
- Tempo-schakelaar linksonder naast Focus; keuze in localStorage `priority-orbit.tempo.v1`.
- Focusmodus: lijst en wiel weg, volledig scherm (indien toegestaan), grote matrixklok (stippen van 5 × 7 zoals in Kwick, onverlichte stippen als schim met `--dm-ghost`, geen gloed; alleen een gewijzigd cijfer laat zijn stippen oplichten; hoogte `min(84px, 9,4vh)`, op gsm 52 px), datum en de Nu-taken leesbaar van op afstand. Cursor en knoppen verdwijnen na 2,5 s stilstand. Een tik of muisbeweging toont ze weer; bij het verlaten wordt de timer gewist.
- Weer in de focusmodus (`src/weather.js`): boven de matrixklok, links gelijk met de klok, een lijnicoon (zelfde iconen als Kwick, symbolen `w-*` in `index.html`) met de temperatuur, link naar https://victorvansande.github.io/kwick/. Open-Meteo (`current=temperature_2m,weather_code,is_day`), 15 min in cache (`priority-orbit.weather.v2`), alleen opgehaald zolang de focusmodus aan staat. Plaats: die van Kwick (`isobar:place`, zelfde origin dus gedeelde localStorage), anders je locatie als je die al toestond, anders Brussel. Bij een fout blijft het icoon weg of toont het de laatst bekende stand. Naast de temperatuur de plaatsnaam (bij je locatie opgezocht via bigdatacloud, zoals Kwick). Eronder neerslag in het komende uur uit `minutely_15` (vanaf 0,1 mm per kwartier): "Regen vanaf 16:45", "Regen tot 17:15", "Regen het komende uur" of "Sneeuw …"; droog = geen regel. Die zin wordt elke minuut opnieuw berekend uit de bewaarde kwartierwaarden (`rainText`).
- Quote in de focusmodus als er geen Nu-taken zijn (vervangt "Niets dringend. Rustig aan.", dat Victor te standaard vond): `QUOTES` uit `src/quotes.js`, alleen quotes met gekende bron of spreekwoorden (geen foutief toegeschreven internetquotes). Om de 20 minuten een andere, in een geschudde volgorde die eerst de hele bibliotheek doorloopt (`priority-orbit.quote.v1`: `{order, i, at}`), zodat je dagenlang geen herhaling ziet. Quote 21 px (gsm 17 px), auteur in kapitaaltjes, zacht ingefade. Breedte volgt de ruimte tot de buitenste ring (`calc(50vw - 41vmin - 72px)`, min. 260 px, max. 52ch); Victor vond 34ch te smal.
- Volgende deadline in de focusmodus (`renderFocusDue`): de vroegste `due`, ook een verstreken ("Te laat" in rood), met hetzelfde label als in de lijst.
- Focus op gsm: één kolom die precies het scherm vult (kop, scène met flex 1, klok en max. 3 Nu-taken, knoppen); thema-schakelaar en datum rechtsboven verdwijnen. Geen vaste posities, zodat niets overlapt. Getest op 375×667, 390×844 en 430×932.

## Offline (`sw.js`)

- **Geen taak gaat verloren** (Victor: "heel belangrijk"):
  - Elke bewaring wordt nagelezen (`localStorage.getItem` na `setItem`); mislukt ze, dan een melding met link naar Archief (exporteren).
  - Tweede kopie in IndexedDB (`src/backup.js`, `mirror`/`readMirror`) bij elke bewaring, met `savedAt`. Bij het opstarten wordt de kopie gelezen vóór de eerste bewaring; is ze nieuwer dan `priority-orbit.saved.v1` of is localStorage leeg, dan worden de taken samengevoegd (alleen toevoegen) met melding "n taken hersteld uit de reservekopie".
  - `navigator.storage.persist()` zodat de browser de opslag niet opruimt.
  - Wachtende wijzigingen (`priority-orbit.pending.v1`, `{n, confirmedAt}`): elke wijziging met sync aan telt mee, ook over het sluiten van de app heen; de knop rechtsboven toont "Offline · 2 wachten" tot de server de stand bevestigt (`onPublished`, alleen als de bevestigde verzending de laatste wijziging bevat: `changeSeq`/`sentSeq`). Bij heropenen verbindt sync opnieuw en stuurt alles wat de server niet had.
  - Ontvangen (scannen) op een al gekoppeld toestel houdt eigen wijzigingen die de server nog niet bevestigde (`updatedAt > confirmedAt`).
  - Getest: gekoppeld toestel zonder server, twee taken toevoegen, app sluiten en heropenen (taken en "2 wachten" blijven), server terug: het andere toestel krijgt ze en "wachten" verdwijnt; localStorage die weigert: melding, en na herladen hersteld uit de reservekopie.

- Service worker met scope `/orbit/`. Eigen bestanden en Google Fonts: netwerk eerst (altijd de nieuwste versie), time-out 3,5 s, dan de bewaarde kopie; paginanavigatie zonder kopie krijgt `index.html`. Nooit de sync-server, de weerdienst of Kwick.
- Taken staan sowieso in localStorage; offline gemaakte wijzigingen gaan via sync door zodra er weer verbinding is (herverbinden bij `online` en `visibilitychange`).
- Nieuwe bestanden in `src/` ook in `SHELL` zetten, anders zijn ze offline pas beschikbaar na een eerste online bezoek. `CACHE` verhogen hoeft niet voor gewone wijzigingen (netwerk eerst), wel als bestanden verdwijnen.
- Getest: offline herladen toont de app met taken, offline een taak toevoegen werkt.

## Uitleg (eerste bezoek)

- Venster "Uitleg" (`#intro`): naam, één zin over de kern, de vijf momenten in hun kleur, zes korte blokken (Toevoegen, Afvinken, Verplaatsen, Kijken, Rust, Toestellen) en een regel sneltoetsen (verborgen op touchscreens). Knop "Aan de slag".
- Opent vanzelf bij een eerste bezoek: nog geen taken bewaard (`lsEmptyAtStart`), uitleg nooit gezien (`priority-orbit.intro.v1`) en niet geopend via een koppellink. Altijd terug via "Uitleg" rechtsboven of `?`.
- Start bovenaan zonder focuskader (focus op de kaart zelf, `preventScroll`).

## Toegankelijkheid

- Canvas heeft `role="img"` met een samenvatting per niveau. Alles wat in de scène kan (afvinken, niveau wijzigen) kan ook via de lijst met toetsenbord.
- `prefers-reduced-motion`: banen, trechter en pulse staan stil, geen intro of deeltjes, overgangen direct.

## Valkuilen

- Focusmarkeringen alleen bij toetsenbordgebruik: `app.js` zet `data-input` op `<html>` (`pointer` bij pointerdown, `keyboard` bij een toets); CSS verbergt `:focus-visible` bij `pointer`. Het wiel zelf krijgt nooit een kader, enkel de gekozen pil bij toetsenbordgebruik. Na het venster gaat de focus alleen terug naar het wiel voor toetsenbordgebruikers (anders verscheen er een kader rond het hele wiel).

- Canvas-teksten gebruiken Geist; is het font nog niet geladen, dan tekent hij met de terugval tot het binnen is (elk frame opnieuw).
- De camera moet geldig zijn vóór de eerste pointermove: `resize()` loopt meteen bij het opstarten (anders werd alles NaN als de muis al over de scène stond).
- Base64 in `sync.js` in stukken (`toB64`): `String.fromCharCode(...bytes)` loopt vast op grote lijsten.
- Opstarten mag niet crashen als localStorage geblokkeerd is: elke toegang staat in try/catch.
- Gsm: `.stage canvas` heeft `touch-action: pan-y` zodat de pagina kan scrollen; verticaal kantelen met de vinger kan daardoor niet, horizontaal draaien wel.

## Open vragen

- Markering van bollen met deadline: zes voorstellen (Aftelboog, Maantje, Holle kop, Kralen, Kernstip, Vizier) liggen bij Victor; nu nog het dunne ringetje.

- Statistiek: vier vormen staan tijdelijk tegelijk aan; Victor kiest later welke blijven.
- Sync-server staat live; nog na te gaan: werkt `workers.dev` op het werknetwerk van Victor.
- Het wiel toont nu vijf items; als er ooit meer momenten bijkomen, werkt de boog al met meer items.
