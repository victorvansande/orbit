/* ---- Taal: Nederlands of Engels ---- */
// Alle teksten van Orbit op één plek. De taal staat in localStorage; wisselen herlaadt de pagina, zodat elke tekst
// (ook in canvas, wiel en vensters) meteen in de nieuwe taal staat. Waarden zijn tekst met {naam}-invulvelden of een
// functie (voor meervouden). In index.html: data-i (tekst), data-ih (html) en data-ia="attribuut:sleutel;…".

import { LEVELS } from './config.js';

const LANG_KEY = 'priority-orbit.lang.v1';
export const LANGS = ['nl', 'en'];

function pickLang() {
  try { const saved = localStorage.getItem(LANG_KEY); if (LANGS.includes(saved)) return saved; } catch { /* geen opslag */ }
  return /^nl\b/i.test(navigator.language || '') ? 'nl' : 'en';
}
export const LANG = pickLang();
export const LOCALE = LANG === 'nl' ? 'nl-BE' : 'en-GB';

export function setLang(lang) {
  if (!LANGS.includes(lang) || lang === LANG) return;
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* geen opslag */ }
  location.reload();
}

const fillIn = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
const n = (one, other) => v => fillIn(v.n === 1 ? one : other, v);

const NL = {
  'level.1': 'Nu', 'level.2': 'Vandaag', 'level.3': 'Week', 'level.4': 'Maand', 'level.5': 'Ooit',
  'tasks.n': n('{n} taak', '{n} taken'),

  // kop, instellingen
  'summary.none': 'Geen taken',
  'summary.urgent': n('{n} dringend', '{n} dringend'),
  'summary.calm': 'Niets dringend',
  'scene.label': 'Orbit: {parts}', 'scene.empty': 'Orbit: geen taken',
  'week': 'Week {n}',
  'menu.settings': 'Instellingen', 'menu.theme': 'Thema', 'menu.language': 'Taal',
  'theme.light': 'Licht', 'theme.dark': 'Donker', 'theme.auto': 'Auto',
  'menu.keys': '<kbd>N</kbd> nieuw <kbd>1</kbd><kbd>2</kbd> aanzicht <kbd>Z</kbd> ongedaan <kbd>A</kbd> archief <kbd>?</kbd> uitleg',
  'menu.intro': 'Uitleg', 'menu.archive': 'Archief', 'menu.feats': 'Prestaties',
  'recap.title': 'Maandrecap', 'recap.open': 'Maandrecap', 'recap.starsIn': 'sterren in {month}', 'recap.vs': '{d} t.o.v. {month}', 'recap.perDay': 'per dag', 'recap.hour': 'meestal rond {h}', 'recap.perLevel': 'per moment', 'recap.busiest': 'drukste dag · {n}', 'recap.days': '{n} d', 'recap.streak': 'dagen op rij', 'recap.featsN': '{n} nieuwe', 'recap.feats': 'prestaties', 'recap.focus': 'gefocust', 'recap.hm': '{h} u {m}', 'recap.min': '{n} min', 'recap.share': 'Delen', 'recap.save': 'Bewaar als afbeelding', 'recap.saveShort': 'Bewaar', 'recap.post': 'Post', 'recap.story': 'Story', 'recap.prev': 'Vorige maand', 'recap.next': 'Volgende maand', 'recap.pill': '{month} in sterren', 'recap.soon1': 'Nog één dag {month}. {stars} sterren tot nu.', 'recap.soon': 'Nog {n} dagen {month}. {stars} sterren tot nu.', 'recap.ready': '{month} zit erop. {stars} sterren. Je recap staat klaar onder de teller.', 'recap.saved': 'Recap bewaard', 'recap.alt': 'Maandrecap van {month}: {n} sterren',
  'feats.title': 'Prestaties', 'feats.how': 'Elke ster is 1 punt, elke prestatie 10 tot 100 punten.', 'feats.level': 'Rang {n}', 'feats.points': '{n} punten', 'feats.next': 'nog {n} tot {name}', 'feats.max': 'hoogste rang', 'feats.count': '{a} van {b} behaald', 'feats.got': 'behaald {date}', 'feats.gotToday': 'vandaag behaald', 'feats.gotYesterday': 'gisteren behaald', 'feats.recent': 'Recent behaald', 'feats.pop': 'Prestatie behaald', 'rank.new': 'Nieuwe rang', 'rank.newAria': 'Nieuwe rang: {name}. Open Prestaties.', 'feats.secret': 'Geheim', 'feats.secretDesc': 'Ontdek het zelf.', 'feats.badge': '{rank} · {n} p',
  'view': 'Aanzicht', 'view.top': 'Boven', 'view.side': 'Zijkant',
  'focus': 'Focus', 'focus.exit': 'Focus uit',
  'tempo': 'Tempo', 'tempo.normaal': 'Normaal', 'tempo.zen': 'Zen', 'tempo.stil': 'Stil',
  'stars.mini': n('{n} ster, toon details', '{n} sterren, toon details'),

  // wiel en lijst
  'wheel': 'Nieuwe taak', 'wheel.list': 'Kies een moment, druk Enter om een taak toe te voegen', 'wheel.hint': 'Scroll · klik om toe te voegen',
  'tracks': 'Taken',
  'tracks.pair': 'Deze app op je beginscherm heeft een eigen opslag, los van je browser. Haal je taken hierheen: kies in Orbit in je browser of op je pc Koppelen, Verstuur, en ontvang ze hier.',
  'tracks.pairGo': 'Taken ontvangen', 'tracks.pairLater': 'Later',
  'tracks.allDone': 'Alles afgevinkt.',
  'tracks.demo': 'Dit zijn voorbeeldtaken. Ze verdwijnen zodra je zelf een taak toevoegt.',
  'tracks.emptyDesk': 'Niets te doen. Kies rechts een moment om een taak toe te voegen.',
  'tracks.emptyMobile': 'Niets te doen. Kies hierboven een moment om een taak toe te voegen.',
  'task.check': 'Markeer "{title}" als klaar', 'task.delete': 'Verwijder "{title}"', 'task.dbl': 'Dubbelklik om aan te passen', 'task.note': 'Notitie bij "{title}"', 'task.noteAdd': 'Notitie toevoegen', 'task.noteShow': 'Notitie tonen', 'task.notePlaceholder': 'Korte notitie',
  'task.level': 'Moment wijzigen, nu {level}', 'task.pick': 'Kies een moment',
  'task.due': 'Deadline {label}, wijzigen', 'task.dueClear': 'Deadline wissen', 'task.edit': 'Titel aanpassen',
  'demo': ['Huur overschrijven', 'Offerte terugsturen', 'Boodschappen doen', 'Planten water geven', 'Fiets laten herstellen',
    'Cadeau voor zaterdag kopen', 'Was opvouwen', 'Tandarts bellen', 'Belastingaangifte invullen', 'Japans leren', 'Zolder opruimen'],

  // statistiek
  'stats.total': n('{n} ster aan de hemel', '{n} sterren aan de hemel'),
  'stats.label1': 'star all time', 'stats.label': 'stars all time',
  'stats.month1': 'star this month', 'stats.month': 'stars this month',
  'stats.monthAria': n('{n} ster deze maand', '{n} sterren deze maand'),
  'stats.today': 'Vandaag', 'stats.week': 'Deze week', 'stats.best': 'Beste dag', 'stats.first': 'Eerste ster',
  'skies.title': 'Hemels', 'skies.current': 'Deze hemel', 'skies.currentSince': 'Deze hemel, sinds {date}', 'skies.all': 'Alle sterren',
  'skies.until': 'Tot {date}', 'skies.range': '{from} tot {to}', 'skies.new': 'Nieuwe hemel',
  'wall.label': 'Muur', 'wall.title': 'Muur van afgevinkte taken achter de hemel',
  'skies.ask': 'Een nieuwe, lege hemel? Je sterren verdwijnen van het scherm maar blijven bewaard; je kunt ze hier altijd terug tonen. Dat geldt ook op je gekoppelde toestellen.',
  'skies.yes': 'Nieuwe hemel', 'skies.done': 'Nieuwe hemel. Je vorige sterren staan onder Hemels.',

  // focusmodus
  'focus.late': 'Te laat', 'focus.next': 'Volgende deadline', 'focus.now': 'Nu', 'focus.more': 'en nog {n}',

  // toasts
  'undo': 'Ongedaan maken', 'cancel': 'Annuleer', 'done': 'Klaar',
  'toast.completed': 'Afgevinkt · {title}', 'toast.demoDone': 'Voorbeeldtaak: sterren krijg je voor je eigen taken.', 'toast.completedN': 'Afgevinkt · {n} taken', 'toast.deleted': 'Verwijderd · "{title}"', 'toast.restored': 'Teruggezet · {title}', 'toast.ownLeft': n('1 eigen taak van dit toestel niet overgenomen. Ze staat bij Momentopnames.', '{n} eigen taken van dit toestel niet overgenomen. Ze staan bij Momentopnames.'),
  'toast.saveFailed': 'Bewaren op dit toestel lukte niet. Je taken staan in de reservekopie; exporteer ze voor de zekerheid.',
  'toast.mirror': n('{n} taak hersteld uit de reservekopie', '{n} taken hersteld uit de reservekopie'),
  'toast.elsewhere1': 'Elders afgevinkt · {title}', 'toast.elsewhere': '{n} taken elders afgevinkt',
  'toast.restore': 'Terugzetten',
  'toast.back': n('{n} taak terug', '{n} taken terug'), 'toast.updated': '{n} bijgewerkt', 'toast.nothing': 'Niets nieuws: alles stond er al',
  'toast.badFile': 'Dat bestand kon Orbit niet lezen',
  'toast.standalone': 'Deze app heeft een eigen opslag. Haal je taken binnen via Koppelen.',

  // venster nieuwe taak
  'composer': 'Nieuwe taak', 'composer.placeholder': 'Wat moet er gebeuren?', 'composer.title': 'Titel', 'composer.moment': 'Moment',
  'composer.repeat': 'Herhaal', 'composer.note': 'Notitie', 'repeat.none': 'Niet herhalen', 'repeat.day': 'Elke dag', 'repeat.week': 'Elke week', 'repeat.month': 'Elke maand',
  'repeat.hint': '{repeat}, eerst {label}. Na afvinken komt hij terug.', 'task.repeat': 'Herhalen',
  'toast.repeat': 'Afgevinkt · {title}. Terug {label}.',
  'menu.sound': 'Geluid', 'sound.on': 'Aan', 'sound.off': 'Uit', 'sound.mute': 'Geluid uit', 'sound.unmute': 'Geluid aan',
  'fidget.aria': 'Bakje om mee te spelen. Beweeg erover of tik erin.', 'fidget.color': 'Kleur', 'fidget.colorReset': 'Standaardkleuren', 'fidget.kind': 'Soort', 'fidget.title': 'Fidget', 'fidget.close': 'Sluiten',
  'glass.running': 'Focus loopt nog, {time} te gaan. Open de focus.', 'glass.paused': 'Focus gepauzeerd, nog {time}. Open de focus.',
  'timer.aria': 'Focustimer', 'timer.start': 'Start', 'timer.pause': 'Pauze', 'timer.resume': 'Verder', 'timer.done': 'Klaar', 'timer.reset': 'Opnieuw', 'timer.expand': 'Uitklappen', 'timer.collapse': 'Inklappen', 'timer.tools': 'Zandloper: {time}. Toon de bediening.',
  'fidget.water': 'Water', 'fidget.jelly': 'Gelei', 'fidget.lava': 'Lava', 'fidget.grain': 'Gloed', 'fidget.topo': 'Topo', 'fidget.wayglim': 'Wayglim', 'fidget.plasma': 'Plasma', 'fidget.plasmaDisc': 'Schijf', 'fidget.plasmaPlate': 'Plaat', 'fidget.panel': 'Paneel', 'fidget.life': 'Life', 'fidget.breakout': 'Breakout', 'fidget.groupFluid': 'Vloeistof & Veld', 'fidget.groupPlay': 'Interactief & Spel', 'fidget.choose': 'Kies fidget', 'fidget.next': 'Volgend scherm',
  'menu.fx': 'Effecten', 'fx.all': 'Alle', 'fx.min': 'Minimaal',
  'menu.demo': 'Demo', 'demo.open': 'Open demo', 'demo.leave': 'Verlaat demo', 'demo.badge': 'Demo',
  'turn.empty': '{month}. Een lege hemel.', 'turn.fresh': n('{month}. Een nieuwe hemel, al {n} ster.', '{month}. Een nieuwe hemel, al {n} sterren.'), 'turn.replay': 'Speel maandwissel', 'turn.gate': 'Tik om een nieuwe maand te starten', 'turn.gateAria': 'Nieuwe maand. Tik om een nieuwe maand te starten.', 'meteor.replay': 'Laat een ster vallen',
  'demo.start': 'Demo: niets wordt bewaard of gedeeld.', 'demo.noSync': 'In de demo wordt niets gekoppeld.',
  'composer.due': 'Deadline', 'composer.clear': 'Wissen', 'composer.add': 'Voeg toe <kbd>↵</kbd>',
  'composer.levelDue': '{level} · deadline', 'composer.hint': '{label}, komt in {level}. Schuift vanzelf mee.',

  // deadlines
  'due.late': n('{n} dag te laat', '{n} dagen te laat'), 'due.yesterday': 'gisteren, te laat', 'due.today': 'vandaag',
  'due.tomorrow': 'morgen', 'due.in': 'over {n} dagen',

  // archief
  'archive': 'Archief', 'archive.device': 'Op dit toestel', 'archive.done': 'Afgevinkt', 'archive.snaps': 'Momentopnames',
  'archive.doneNote': 'Afgevinkte taken blijven 60 dagen bewaard. Zet ze terug met één tik, of verwijder ze voorgoed.',
  'archive.snapsNote': 'Orbit bewaart de hele lijst vóór elke synchronisatie, import of terugzetting, en minstens één keer per dag. Terugzetten voegt enkel de ontbrekende taken toe; er verdwijnt niets.',
  'archive.server': 'Op de Orbit-server', 'archive.serverNote': 'De server bewaart de laatste 20 versies van je gedeelde lijst, ook als al je toestellen iets kwijt zijn.',
  'archive.export': 'Exporteer', 'archive.import': 'Importeer',
  'archive.doneMeta': '{level} · afgevinkt {when}', 'archive.elsewhere': ' op een ander toestel',
  'archive.restore': 'Terugzetten', 'archive.remove': 'Verwijder', 'archive.removeLong': 'Definitief verwijderen', 'archive.sure': 'Zeker?',
  'archive.removed': 'Definitief verwijderd · {title}',
  'archive.empty': 'Nog niets afgevinkt.', 'archive.noSnaps': 'Nog geen momentopnames.',
  'archive.missing': n(' · {n} ontbreekt nu', ' · {n} ontbreken nu'), 'archive.complete': ' · niets ontbreekt',
  'archive.bring': 'Zet {n} terug', 'archive.full': 'Volledig',
  'archive.loading': 'Versies ophalen…', 'archive.offline': 'De server is nu niet bereikbaar.', 'archive.noServer': 'Nog geen versies op de server.',
  'archive.version': 'Versie {v}', 'archive.from': ' · van {from}', 'archive.unknown': 'onbekend',
  'stamp.today': 'vandaag', 'stamp.yesterday': 'gisteren',
  'reason.overwrite': 'Voor een overschrijving', 'reason.demo': 'Voor opruimen voorbeeldtaken', 'reason.mirror': 'Voor herstel uit reservekopie',
  'reason.daily': 'Dagelijkse kopie', 'reason.restore': 'Voor terugzetten', 'reason.restoreServer': 'Voor terugzetten van server',
  'reason.import': 'Voor import', 'reason.sync': 'Voor synchronisatie', 'reason.receive': 'Voor ontvangen', 'reason.delete': 'Voor verwijderen',

  // koppelen
  'sync.off': 'Koppelen', 'sync.connecting': 'Verbinden', 'sync.online': 'Gesynchroniseerd', 'sync.offline': 'Offline', 'sync.connected': 'Verbonden',
  'sync.waiting': n('{n} wacht', '{n} wachten'), 'sync.pair': 'Toestellen koppelen', 'sync.status': 'Synchronisatie: {text}', 'sync.receive': 'Ontvangen', 'sync.once': 'Eenmalig',
  'sync.intro': 'Kies op welk toestel je taken nu staan. Dat toestel verstuurt, het andere ontvangt. Daarna blijven ze vanzelf gelijk.',
  'sync.newTitle': 'Verstuur van dit toestel', 'sync.newSub': 'Toont een QR-code. Je lijst hier blijft zoals ze is.',
  'sync.scanTitle': 'Ontvang op dit toestel', 'sync.scanSub': 'Scan de QR-code van je andere toestel. Je lijst hier wordt vervangen.',
  'sync.manual': 'Code of link plakken om te ontvangen', 'sync.input': 'Code of koppellink', 'sync.inputPh': 'Code of link',
  'sync.paste': 'Plak', 'sync.join': 'Ontvang',
  'sync.keyPh': 'Code uit je sleutelhanger', 'sync.keep': 'Bewaar in sleutelhanger', 'sync.keepAgain': 'Opnieuw aanbieden',
  'sync.keepText': 'Bewaar de synccode in je sleutelhanger. Verliest dit toestel ooit zijn gegevens, dan haal je met die code je taken terug van de Orbit-server.',
  'sync.keepDone': 'Aangeboden aan je sleutelhanger. Kies Bewaar in de melding van je toestel. Later terughalen: Koppelen, Code of link plakken, het veld Code uit je sleutelhanger.',
  'sync.confirmText': 'Taken ontvangen van je andere toestel?',
  'sync.confirmWarn': 'De lijst op dit toestel wordt vervangen door die van het andere toestel. Orbit bewaart eerst een momentopname, terug te vinden in Archief.',
  'sync.notNow': 'Niet nu', 'sync.receiveTasks': 'Ontvang taken',
  'sync.scanWarn': 'De lijst op dit toestel wordt vervangen door die van het andere toestel. Orbit bewaart eerst een momentopname.',
  'sync.aim': 'Richt de camera op de QR-code van het toestel dat verstuurt.', 'sync.cancel': 'Annuleren',
  'sync.step.scan': 'Code ontvangen', 'sync.step.connect': 'Verbinden met de server', 'sync.step.wait': 'Wachten op de lijst van het andere toestel', 'sync.step.done': 'Taken overgenomen',
  'sync.retry': 'Opnieuw proberen', 'sync.qr': 'QR-code om taken naar een ander toestel te versturen', 'sync.copied': 'Gekopieerd', 'sync.copyPrompt': 'Kopieer:',
  'sync.showCode': 'Toon code', 'sync.hideCode': 'Verberg code',
  'sync.addTitle': 'Nieuw toestel koppelen', 'sync.addNote': 'Scan met de camera van je andere toestel. Daar wordt de lijst vervangen door deze.',
  'sync.rowLink': 'Link', 'sync.rowCode': 'Code', 'sync.rowKeychain': 'Sleutelhanger', 'sync.rowShared': 'Gedeeld', 'sync.rowDevice': 'Dit toestel',
  'sync.actCopy': 'Kopieer', 'sync.actShow': 'Toon', 'sync.actKeep': 'Bewaar', 'sync.actKeepAgain': 'Opnieuw', 'sync.actStop': 'Ontkoppel',
  'sync.keepSub': 'Haal je taken zo altijd terug', 'sync.keepSubDone': 'Aangeboden aan je sleutelhanger',
  'sync.sharedTasks': n('{n} taak', '{n} taken'), 'sync.sharedStars': n('{n} ster', '{n} sterren'), 'sync.sharedAt': 'Gelijk · {time}',
  'sync.notOrbitQr': 'Dat is geen QR-code van Orbit. Richt op de code van het toestel dat verstuurt.',
  'sync.badCode': 'Dat is geen code of koppellink van Orbit. Een code heeft 16 tekens, bv. 7K2P-Q9XD-M3TA-4HWE.',
  'sync.connectedWait': 'Verbonden. Hou de QR-code open op het andere toestel.',
  'sync.timeout': 'Nog niets ontvangen. Staat de QR-code nog open op het andere toestel, en zijn beide toestellen online? Orbit blijft wachten.',
  'sync.received': n('{n} taak ontvangen{from}. Vanaf nu blijven beide toestellen gelijk.', '{n} taken ontvangen{from}. Vanaf nu blijven beide toestellen gelijk.'),
  'sync.receivedToast': n('{n} taak ontvangen{from}', '{n} taken ontvangen{from}'), 'sync.fromDevice': ' van {name}',
  'sync.error': 'Er liep iets mis bij het verbinden. Probeer opnieuw.',
  'sync.serverConnecting': 'Verbinden met de server…',
  'sync.ready': n('Klaar om te versturen: {n} taak.', 'Klaar om te versturen: {n} taken.'),
  'sync.sent': n('Verstuurd naar {name}: {n} taak. Je kunt nog een toestel laten scannen.', 'Verstuurd naar {name}: {n} taken. Je kunt nog een toestel laten scannen.'),
  'sync.sentToast': 'Verstuurd naar {name}', 'sync.otherDevice': 'een ander toestel',
  'sync.sendFailed': 'Versturen lukte niet. Sluit het venster en probeer opnieuw.',
  'sync.isOffline': 'Dit toestel is offline. Orbit probeert opnieuw zodra er internet is.',
  'sync.unreachable': 'Geen verbinding met de Orbit-server. Controleer je internet. Lukt het op dit netwerk nooit, probeer dan even via mobiele data: sommige bedrijfsnetwerken blokkeren workers.dev.',
  'sync.orbitConnecting': 'Verbinden met de Orbit-server…',
  'cam.none': 'Deze browser geeft geen toegang tot de camera. Open de link of typ de code.',
  'cam.denied': 'Geen toegang tot de camera. Sta de camera toe, of open de link of typ de code.',
  'cam.load': 'De scanner kon niet laden. Probeer opnieuw of typ de code.',
  'device.android': 'Android-gsm', 'device.androidTab': 'Android-tablet', 'device.windows': 'Windows-pc', 'device.linux': 'Linux-pc', 'device.other': 'ander toestel',

  // weer
  'wx.0': 'Helder', 'wx.1': 'Overwegend helder', 'wx.2': 'Half bewolkt', 'wx.3': 'Bewolkt', 'wx.45': 'Mist', 'wx.48': 'Aanvriezende mist',
  'wx.51': 'Lichte motregen', 'wx.53': 'Motregen', 'wx.55': 'Zware motregen', 'wx.56': 'Aanvriezende motregen', 'wx.57': 'Aanvriezende motregen',
  'wx.61': 'Lichte regen', 'wx.63': 'Regen', 'wx.65': 'Zware regen', 'wx.66': 'IJzel', 'wx.67': 'IJzel',
  'wx.71': 'Lichte sneeuw', 'wx.73': 'Sneeuw', 'wx.75': 'Zware sneeuw', 'wx.77': 'Korrelsneeuw',
  'wx.80': 'Lichte buien', 'wx.81': 'Buien', 'wx.82': 'Zware buien', 'wx.85': 'Sneeuwbuien', 'wx.86': 'Zware sneeuwbuien',
  'wx.95': 'Onweer', 'wx.96': 'Onweer met hagel', 'wx.99': 'Onweer met hagel', 'wx.unknown': 'Weer',
  'rain.rain': 'Regen', 'rain.snow': 'Sneeuw', 'rain.until': '{kind} tot {time}', 'rain.hour': '{kind} het komende uur', 'rain.from': '{kind} vanaf {time}',
  'wx.aria': '{label}{where}, {temp} graden{rain}. Open Kwick', 'wx.in': ' in {name}', 'wx.title': '{label}{where} · open Kwick',

  // uitleg
  'intro.kicker': 'Welkom bij', 'intro.kicker2': 'Uitleg',
  'intro.lead': 'Je taken draaien rond een kern. Hoe dringender, hoe dichter bij het midden en hoe sneller ze draaien.',
  'intro.levels': 'De vijf momenten, van binnen naar buiten',
  'intro.add': 'Toevoegen & verplaatsen', 'intro.addMeta': '<kbd>N</kbd> · ↕',
  'intro.addText': 'Kies een moment op het wiel of druk <kbd>N</kbd>. Sleep een bol naar een andere ring, of kies het moment via het baantje naast een taak. Een taak met een deadline schuift vanzelf naar binnen.',
  'intro.done': 'Afvinken & herstel', 'intro.doneMeta': '<kbd>Z</kbd>',
  'intro.doneText': 'Tik op het rondje in de lijst. De bol brandt op, en waar hij stond verschijnt een ster. Meteen ongedaan maken kan met <kbd>Z</kbd>. Afgevinkte taken blijven 60 dagen in het Archief.',
  'intro.stars': 'Hemel & sterrenbeelden',
  'intro.starsText': 'Elke afgevinkte taak wordt een ster achter de ringen. Bij elke 25e ster verschijnt kort een sterrenbeeld. Bij een nieuwe maand vallen de sterren in de kern en krijg je een poster van de vorige maand.',
  'intro.feats': 'Prestaties & rangen', 'intro.featsMeta': '<kbd>P</kbd>',
  'intro.featsText': 'Dagen op rij, deadlines op tijd en focusblokken leveren prestaties en punten op. Je punten bepalen je rang. Die staat onder je takenlijst; een tik toont al je prestaties.',
  'intro.core': 'De kern',
  'intro.coreText': 'De kern heeft een gezicht. Hij begroet je, kijkt mee en zegt bij een tik wat er nu het meest toe doet. Is er niets dringends, of is het nacht, dan doet hij zijn ogen dicht.',
  'intro.focus': 'Focus & rust', 'intro.focusMeta': '<kbd>F</kbd> · <kbd>T</kbd>',
  'intro.focusText': 'Focus toont enkel wat telt: een grote klok, het weer, je Nu-taken, een zandloper en een bakje om mee te spelen. Tempo, thema en taal kies je onder Instellingen.',
  'intro.keys': '<span><kbd>N</kbd> nieuw</span> <span><kbd>1</kbd><kbd>2</kbd> aanzicht</span> <span><kbd>F</kbd> focus</span> <span><kbd>T</kbd> tempo</span> <span><kbd>D</kbd> thema</span> <span><kbd>A</kbd> archief</span> <span><kbd>P</kbd> prestaties</span> <span><kbd>Z</kbd> ongedaan</span> <span><kbd>?</kbd> uitleg</span>',
  'intro.note': 'Deze uitleg vind je altijd terug onder Uitleg.', 'intro.go': 'Aan de slag',

  // scène
  'scene.drop': 'Naar {level}',
};

const EN = {
  'level.1': 'Now', 'level.2': 'Today', 'level.3': 'Week', 'level.4': 'Month', 'level.5': 'Someday',
  'tasks.n': n('{n} task', '{n} tasks'),

  'summary.none': 'No tasks',
  'summary.urgent': n('{n} urgent', '{n} urgent'),
  'summary.calm': 'Nothing urgent',
  'scene.label': 'Orbit: {parts}', 'scene.empty': 'Orbit: no tasks',
  'week': 'Week {n}',
  'menu.settings': 'Settings', 'menu.theme': 'Theme', 'menu.language': 'Language',
  'theme.light': 'Light', 'theme.dark': 'Dark', 'theme.auto': 'Auto',
  'menu.keys': '<kbd>N</kbd> new <kbd>1</kbd><kbd>2</kbd> view <kbd>Z</kbd> undo <kbd>A</kbd> archive <kbd>?</kbd> guide',
  'menu.intro': 'Guide', 'menu.archive': 'Archive', 'menu.feats': 'Achievements',
  'recap.title': 'Monthly recap', 'recap.open': 'Monthly recap', 'recap.starsIn': 'stars in {month}', 'recap.vs': '{d} vs {month}', 'recap.perDay': 'per day', 'recap.hour': 'mostly around {h}', 'recap.perLevel': 'per moment', 'recap.busiest': 'busiest day · {n}', 'recap.days': '{n} d', 'recap.streak': 'days in a row', 'recap.featsN': '{n} new', 'recap.feats': 'achievements', 'recap.focus': 'focused', 'recap.hm': '{h} h {m}', 'recap.min': '{n} min', 'recap.share': 'Share', 'recap.save': 'Save as image', 'recap.saveShort': 'Save', 'recap.post': 'Post', 'recap.story': 'Story', 'recap.prev': 'Previous month', 'recap.next': 'Next month', 'recap.pill': '{month} in stars', 'recap.soon1': 'One day of {month} left. {stars} stars so far.', 'recap.soon': '{n} days of {month} left. {stars} stars so far.', 'recap.ready': '{month} is done. {stars} stars. Your recap is ready under the counter.', 'recap.saved': 'Recap saved', 'recap.alt': 'Monthly recap for {month}: {n} stars',
  'feats.title': 'Achievements', 'feats.how': 'Every star is 1 point, every achievement 10 to 100 points.', 'feats.level': 'Rank {n}', 'feats.points': '{n} points', 'feats.next': '{n} to {name}', 'feats.max': 'highest rank', 'feats.count': '{a} of {b} earned', 'feats.got': 'earned {date}', 'feats.gotToday': 'earned today', 'feats.gotYesterday': 'earned yesterday', 'feats.recent': 'Recently earned', 'feats.pop': 'Achievement unlocked', 'rank.new': 'New rank', 'rank.newAria': 'New rank: {name}. Open Achievements.', 'feats.secret': 'Secret', 'feats.secretDesc': 'Find out for yourself.', 'feats.badge': '{rank} · {n} pts',
  'view': 'View', 'view.top': 'Top', 'view.side': 'Side',
  'focus': 'Focus', 'focus.exit': 'Exit focus',
  'tempo': 'Tempo', 'tempo.normaal': 'Normal', 'tempo.zen': 'Zen', 'tempo.stil': 'Still',
  'stars.mini': n('{n} star, show details', '{n} stars, show details'),

  'wheel': 'New task', 'wheel.list': 'Choose a moment, press Enter to add a task', 'wheel.hint': 'Scroll · click to add',
  'tracks': 'Tasks',
  'tracks.pair': 'This app on your home screen has its own storage, separate from your browser. Bring your tasks here: in Orbit in your browser or on your computer, choose Pair, Send, and receive them here.',
  'tracks.pairGo': 'Receive tasks', 'tracks.pairLater': 'Later',
  'tracks.allDone': 'All done.',
  'tracks.demo': 'These are example tasks. They disappear as soon as you add one of your own.',
  'tracks.emptyDesk': 'Nothing to do. Pick a moment on the right to add a task.',
  'tracks.emptyMobile': 'Nothing to do. Pick a moment above to add a task.',
  'task.check': 'Mark "{title}" as done', 'task.delete': 'Delete "{title}"', 'task.dbl': 'Double-click to edit', 'task.note': 'Note for "{title}"', 'task.noteAdd': 'Add a note', 'task.noteShow': 'Show note', 'task.notePlaceholder': 'Short note',
  'task.level': 'Change moment, now {level}', 'task.pick': 'Choose a moment',
  'task.due': 'Deadline {label}, change', 'task.dueClear': 'Clear deadline', 'task.edit': 'Edit title',
  'demo': ['Pay the rent', 'Send back the quote', 'Do the groceries', 'Water the plants', 'Get the bike fixed',
    'Buy a present for Saturday', 'Fold the laundry', 'Call the dentist', 'File the tax return', 'Learn Japanese', 'Clear out the attic'],

  'stats.total': n('{n} star in the sky', '{n} stars in the sky'),
  'stats.label1': 'star all time', 'stats.label': 'stars all time',
  'stats.month1': 'star this month', 'stats.month': 'stars this month',
  'stats.monthAria': n('{n} star this month', '{n} stars this month'),
  'stats.today': 'Today', 'stats.week': 'This week', 'stats.best': 'Best day', 'stats.first': 'First star',
  'skies.title': 'Skies', 'skies.current': 'This sky', 'skies.currentSince': 'This sky, since {date}', 'skies.all': 'All stars',
  'skies.until': 'Until {date}', 'skies.range': '{from} to {to}', 'skies.new': 'New sky',
  'wall.label': 'Wall', 'wall.title': 'Wall of completed tasks behind the sky',
  'skies.ask': 'A new, empty sky? Your stars leave the screen but are kept; you can always show them again here. This also applies to your paired devices.',
  'skies.yes': 'New sky', 'skies.done': 'New sky. Your earlier stars are under Skies.',

  'focus.late': 'Overdue', 'focus.next': 'Next deadline', 'focus.now': 'Now', 'focus.more': 'and {n} more',

  'undo': 'Undo', 'cancel': 'Cancel', 'done': 'Done',
  'toast.completed': 'Done · {title}', 'toast.demoDone': 'Example task: stars come from your own tasks.', 'toast.completedN': 'Done · {n} tasks', 'toast.deleted': 'Deleted · "{title}"', 'toast.restored': 'Restored · {title}', 'toast.ownLeft': n('1 task from this device was not taken over. It is under Snapshots.', '{n} tasks from this device were not taken over. They are under Snapshots.'),
  'toast.saveFailed': 'Saving on this device failed. Your tasks are in the backup copy; export them to be safe.',
  'toast.mirror': n('{n} task restored from the backup copy', '{n} tasks restored from the backup copy'),
  'toast.elsewhere1': 'Done elsewhere · {title}', 'toast.elsewhere': '{n} tasks done elsewhere',
  'toast.restore': 'Restore',
  'toast.back': n('{n} task back', '{n} tasks back'), 'toast.updated': '{n} updated', 'toast.nothing': 'Nothing new: everything was already there',
  'toast.badFile': 'Orbit could not read that file',
  'toast.standalone': 'This app has its own storage. Bring in your tasks via Pair.',

  'composer': 'New task', 'composer.placeholder': 'What needs doing?', 'composer.title': 'Title', 'composer.moment': 'Moment',
  'composer.repeat': 'Repeat', 'composer.note': 'Note', 'repeat.none': 'No repeat', 'repeat.day': 'Every day', 'repeat.week': 'Every week', 'repeat.month': 'Every month',
  'repeat.hint': '{repeat}, first {label}. Comes back after you tick it off.', 'task.repeat': 'Repeat',
  'toast.repeat': 'Done · {title}. Back {label}.',
  'menu.sound': 'Sound', 'sound.on': 'On', 'sound.off': 'Off', 'sound.mute': 'Sound off', 'sound.unmute': 'Sound on',
  'fidget.aria': 'A little tank to play with. Move over it or tap in it.', 'fidget.color': 'Colour', 'fidget.colorReset': 'Default colours', 'fidget.kind': 'Kind', 'fidget.title': 'Fidget', 'fidget.close': 'Close',
  'glass.running': 'Focus still running, {time} to go. Open focus.', 'glass.paused': 'Focus paused, {time} left. Open focus.',
  'timer.aria': 'Focus timer', 'timer.start': 'Start', 'timer.pause': 'Pause', 'timer.resume': 'Resume', 'timer.done': 'Done', 'timer.reset': 'Reset', 'timer.expand': 'Expand', 'timer.collapse': 'Collapse', 'timer.tools': 'Hourglass: {time}. Show the controls.',
  'fidget.water': 'Water', 'fidget.jelly': 'Jelly', 'fidget.lava': 'Lava', 'fidget.grain': 'Glow', 'fidget.topo': 'Topo', 'fidget.wayglim': 'Wayglim', 'fidget.plasma': 'Plasma', 'fidget.plasmaDisc': 'Disc', 'fidget.plasmaPlate': 'Plate', 'fidget.panel': 'Panel', 'fidget.life': 'Life', 'fidget.breakout': 'Breakout', 'fidget.groupFluid': 'Fluid & Field', 'fidget.groupPlay': 'Interactive & Play', 'fidget.choose': 'Choose fidget', 'fidget.next': 'Next screen',
  'menu.fx': 'Effects', 'fx.all': 'All', 'fx.min': 'Minimal',
  'menu.demo': 'Demo', 'demo.open': 'Open demo', 'demo.leave': 'Leave demo', 'demo.badge': 'Demo',
  'turn.empty': '{month}. An empty sky.', 'turn.fresh': n('{month}. A new sky, {n} star already.', '{month}. A new sky, {n} stars already.'), 'turn.replay': 'Play month turn', 'turn.gate': 'Tap to start a new month', 'turn.gateAria': 'New month. Tap to start a new month.', 'meteor.replay': 'Drop a falling star',
  'demo.start': 'Demo: nothing is saved or shared.', 'demo.noSync': 'Nothing is paired in the demo.',
  'composer.due': 'Deadline', 'composer.clear': 'Clear', 'composer.add': 'Add <kbd>↵</kbd>',
  'composer.levelDue': '{level} · deadline', 'composer.hint': '{label}, goes into {level}. Moves along by itself.',

  'due.late': n('{n} day overdue', '{n} days overdue'), 'due.yesterday': 'yesterday, overdue', 'due.today': 'today',
  'due.tomorrow': 'tomorrow', 'due.in': 'in {n} days',

  'archive': 'Archive', 'archive.device': 'On this device', 'archive.done': 'Done', 'archive.snaps': 'Snapshots',
  'archive.doneNote': 'Completed tasks are kept for 60 days. Restore them with one tap, or delete them for good.',
  'archive.snapsNote': 'Orbit saves the whole list before every sync, import or restore, and at least once a day. Restoring only adds missing tasks; nothing disappears.',
  'archive.server': 'On the Orbit server', 'archive.serverNote': 'The server keeps the last 20 versions of your shared list, even if all your devices lose something.',
  'archive.export': 'Export', 'archive.import': 'Import',
  'archive.doneMeta': '{level} · done {when}', 'archive.elsewhere': ' on another device',
  'archive.restore': 'Restore', 'archive.remove': 'Delete', 'archive.removeLong': 'Delete for good', 'archive.sure': 'Sure?',
  'archive.removed': 'Deleted for good · {title}',
  'archive.empty': 'Nothing done yet.', 'archive.noSnaps': 'No snapshots yet.',
  'archive.missing': n(' · {n} missing now', ' · {n} missing now'), 'archive.complete': ' · nothing missing',
  'archive.bring': 'Restore {n}', 'archive.full': 'Complete',
  'archive.loading': 'Fetching versions…', 'archive.offline': 'The server is unreachable right now.', 'archive.noServer': 'No versions on the server yet.',
  'archive.version': 'Version {v}', 'archive.from': ' · from {from}', 'archive.unknown': 'unknown',
  'stamp.today': 'today', 'stamp.yesterday': 'yesterday',
  'reason.overwrite': 'Before an overwrite', 'reason.demo': 'Before clearing example tasks', 'reason.mirror': 'Before restoring from the backup copy',
  'reason.daily': 'Daily copy', 'reason.restore': 'Before restoring', 'reason.restoreServer': 'Before restoring from the server',
  'reason.import': 'Before import', 'reason.sync': 'Before sync', 'reason.receive': 'Before receiving', 'reason.delete': 'Before deleting',

  'sync.off': 'Pair', 'sync.connecting': 'Connecting', 'sync.online': 'Synced', 'sync.offline': 'Offline', 'sync.connected': 'Connected',
  'sync.waiting': n('{n} waiting', '{n} waiting'), 'sync.pair': 'Pair devices', 'sync.status': 'Sync: {text}', 'sync.receive': 'Receive', 'sync.once': 'One time',
  'sync.intro': 'Choose which device has your tasks now. That device sends, the other receives. After that they stay in step by themselves.',
  'sync.newTitle': 'Send from this device', 'sync.newSub': 'Shows a QR code. Your list here stays as it is.',
  'sync.scanTitle': 'Receive on this device', 'sync.scanSub': 'Scan the QR code of your other device. Your list here will be replaced.',
  'sync.manual': 'Paste a code or link to receive', 'sync.input': 'Code or pairing link', 'sync.inputPh': 'Code or link',
  'sync.paste': 'Paste', 'sync.join': 'Receive',
  'sync.keyPh': 'Code from your keychain', 'sync.keep': 'Save to keychain', 'sync.keepAgain': 'Offer again',
  'sync.keepText': 'Save the sync code in your keychain. If this device ever loses its data, that code gets your tasks back from the Orbit server.',
  'sync.keepDone': 'Offered to your keychain. Choose Save in your device\'s prompt. To get it back later: Pair, Paste a code or link, the field Code from your keychain.',
  'sync.confirmText': 'Receive tasks from your other device?',
  'sync.confirmWarn': 'The list on this device will be replaced by the one on the other device. Orbit first saves a snapshot, which you can find in Archive.',
  'sync.notNow': 'Not now', 'sync.receiveTasks': 'Receive tasks',
  'sync.scanWarn': 'The list on this device will be replaced by the one on the other device. Orbit first saves a snapshot.',
  'sync.aim': 'Point the camera at the QR code of the sending device.', 'sync.cancel': 'Cancel',
  'sync.step.scan': 'Code received', 'sync.step.connect': 'Connecting to the server', 'sync.step.wait': 'Waiting for the list from the other device', 'sync.step.done': 'Tasks taken over',
  'sync.retry': 'Try again', 'sync.qr': 'QR code to send tasks to another device', 'sync.copied': 'Copied', 'sync.copyPrompt': 'Copy:',
  'sync.showCode': 'Show code', 'sync.hideCode': 'Hide code',
  'sync.addTitle': 'Pair a new device', 'sync.addNote': 'Scan with the camera of your other device. Its list is replaced by this one.',
  'sync.rowLink': 'Link', 'sync.rowCode': 'Code', 'sync.rowKeychain': 'Keychain', 'sync.rowShared': 'Shared', 'sync.rowDevice': 'This device',
  'sync.actCopy': 'Copy', 'sync.actShow': 'Show', 'sync.actKeep': 'Save', 'sync.actKeepAgain': 'Again', 'sync.actStop': 'Unpair',
  'sync.keepSub': 'Always get your tasks back', 'sync.keepSubDone': 'Offered to your keychain',
  'sync.sharedTasks': n('{n} task', '{n} tasks'), 'sync.sharedStars': n('{n} star', '{n} stars'), 'sync.sharedAt': 'In sync · {time}',
  'sync.notOrbitQr': 'That is not an Orbit QR code. Point at the code of the sending device.',
  'sync.badCode': 'That is not an Orbit code or pairing link. A code has 16 characters, e.g. 7K2P-Q9XD-M3TA-4HWE.',
  'sync.connectedWait': 'Connected. Keep the QR code open on the other device.',
  'sync.timeout': 'Nothing received yet. Is the QR code still open on the other device, and are both devices online? Orbit keeps waiting.',
  'sync.received': n('{n} task received{from}. From now on both devices stay in step.', '{n} tasks received{from}. From now on both devices stay in step.'),
  'sync.receivedToast': n('{n} task received{from}', '{n} tasks received{from}'), 'sync.fromDevice': ' from {name}',
  'sync.error': 'Something went wrong while connecting. Please try again.',
  'sync.serverConnecting': 'Connecting to the server…',
  'sync.ready': n('Ready to send: {n} task.', 'Ready to send: {n} tasks.'),
  'sync.sent': n('Sent to {name}: {n} task. You can let another device scan.', 'Sent to {name}: {n} tasks. You can let another device scan.'),
  'sync.sentToast': 'Sent to {name}', 'sync.otherDevice': 'another device',
  'sync.sendFailed': 'Sending failed. Close the window and try again.',
  'sync.isOffline': 'This device is offline. Orbit tries again as soon as there is internet.',
  'sync.unreachable': 'No connection to the Orbit server. Check your internet. If it never works on this network, try mobile data: some company networks block workers.dev.',
  'sync.orbitConnecting': 'Connecting to the Orbit server…',
  'cam.none': 'This browser gives no access to the camera. Open the link or type the code.',
  'cam.denied': 'No access to the camera. Allow the camera, or open the link or type the code.',
  'cam.load': 'The scanner could not load. Try again or type the code.',
  'device.android': 'Android phone', 'device.androidTab': 'Android tablet', 'device.windows': 'Windows PC', 'device.linux': 'Linux PC', 'device.other': 'another device',

  'wx.0': 'Clear', 'wx.1': 'Mostly clear', 'wx.2': 'Partly cloudy', 'wx.3': 'Cloudy', 'wx.45': 'Fog', 'wx.48': 'Freezing fog',
  'wx.51': 'Light drizzle', 'wx.53': 'Drizzle', 'wx.55': 'Heavy drizzle', 'wx.56': 'Freezing drizzle', 'wx.57': 'Freezing drizzle',
  'wx.61': 'Light rain', 'wx.63': 'Rain', 'wx.65': 'Heavy rain', 'wx.66': 'Freezing rain', 'wx.67': 'Freezing rain',
  'wx.71': 'Light snow', 'wx.73': 'Snow', 'wx.75': 'Heavy snow', 'wx.77': 'Snow grains',
  'wx.80': 'Light showers', 'wx.81': 'Showers', 'wx.82': 'Heavy showers', 'wx.85': 'Snow showers', 'wx.86': 'Heavy snow showers',
  'wx.95': 'Thunderstorm', 'wx.96': 'Thunderstorm with hail', 'wx.99': 'Thunderstorm with hail', 'wx.unknown': 'Weather',
  'rain.rain': 'Rain', 'rain.snow': 'Snow', 'rain.until': '{kind} until {time}', 'rain.hour': '{kind} for the next hour', 'rain.from': '{kind} from {time}',
  'wx.aria': '{label}{where}, {temp} degrees{rain}. Open Kwick', 'wx.in': ' in {name}', 'wx.title': '{label}{where} · open Kwick',

  'intro.kicker': 'Welcome to', 'intro.kicker2': 'Guide',
  'intro.lead': 'Your tasks orbit a core. The more urgent, the closer to the centre and the faster they turn.',
  'intro.levels': 'The five moments, from the inside out',
  'intro.add': 'Add & move', 'intro.addMeta': '<kbd>N</kbd> · ↕',
  'intro.addText': 'Pick a moment on the wheel or press <kbd>N</kbd>. Drag an orb to another ring, or pick the moment with the small orbit next to a task. A task with a deadline moves inward by itself.',
  'intro.done': 'Complete & undo', 'intro.doneMeta': '<kbd>Z</kbd>',
  'intro.doneText': 'Tap the circle in the list. The orb burns up, and a star appears where it was. Undo right away with <kbd>Z</kbd>. Completed tasks stay in the Archive for 60 days.',
  'intro.stars': 'Sky & constellations',
  'intro.starsText': 'Every completed task becomes a star behind the rings. Every 25th star briefly draws a constellation. In a new month the stars fall into the core and you get a poster of the past month.',
  'intro.feats': 'Achievements & rank', 'intro.featsMeta': '<kbd>P</kbd>',
  'intro.featsText': 'Streaks, deadlines met and focus blocks earn achievements and points. Your points set your rank. It sits below your task list; tap it to see all your achievements.',
  'intro.core': 'The core',
  'intro.coreText': 'The core has a face. It greets you, looks along and, when tapped, says what matters most right now. When nothing is urgent, or at night, it closes its eyes.',
  'intro.focus': 'Focus & calm', 'intro.focusMeta': '<kbd>F</kbd> · <kbd>T</kbd>',
  'intro.focusText': 'Focus shows only what counts: a large clock, the weather, your Now tasks, an hourglass and a small tray to play with. Tempo, theme and language are under Settings.',
  'intro.keys': '<span><kbd>N</kbd> new</span> <span><kbd>1</kbd><kbd>2</kbd> view</span> <span><kbd>F</kbd> focus</span> <span><kbd>T</kbd> tempo</span> <span><kbd>D</kbd> theme</span> <span><kbd>A</kbd> archive</span> <span><kbd>P</kbd> achievements</span> <span><kbd>Z</kbd> undo</span> <span><kbd>?</kbd> guide</span>',
  'intro.note': 'You can always find this guide again under Guide.', 'intro.go': 'Get started',

  'scene.drop': 'To {level}',
};

const DICT = LANG === 'nl' ? NL : EN;
export const DEMO_TITLES = { nl: NL.demo, en: EN.demo };

// Tekst opzoeken; ontbreekt hij in het Engels, dan het Nederlands (en anders de sleutel zelf)
export function tx(key, vars = {}) {
  const v = DICT[key] ?? NL[key];
  if (v === undefined) return key;
  if (typeof v === 'function') return v(vars);
  if (typeof v !== 'string') return v;
  return fillIn(v, vars);
}

// Redenen van momentopnames: nieuw als sleutel bewaard, oude als Nederlandse zin; beide in de huidige taal tonen
export function reasonText(reason) {
  if (DICT[`reason.${reason}`]) return tx(`reason.${reason}`);
  const key = Object.keys(NL).find(k => k.startsWith('reason.') && NL[k] === reason);
  return key ? tx(key) : reason;
}

// Namen van de momenten in de huidige taal (config.js blijft de bron voor al de rest)
for (const lv of LEVELS) lv.name = tx(`level.${lv.id}`);

// Vaste teksten in de pagina
export function applyStatic(root = document) {
  document.documentElement.lang = LANG;
  for (const node of root.querySelectorAll('[data-i]')) node.textContent = tx(node.dataset.i);
  for (const node of root.querySelectorAll('[data-ih]')) node.innerHTML = tx(node.dataset.ih);
  for (const node of root.querySelectorAll('[data-ia]')) {
    for (const pair of node.dataset.ia.split(';')) {
      const [attr, key] = pair.split(':');
      if (attr && key) node.setAttribute(attr.trim(), tx(key.trim()));
    }
  }
}
