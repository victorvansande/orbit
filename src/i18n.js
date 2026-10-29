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
  'menu.intro': 'Uitleg', 'menu.archive': 'Archief',
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
  'task.check': 'Markeer “{title}” als klaar', 'task.dbl': 'Dubbelklik om aan te passen',
  'task.level': 'Moment wijzigen, nu {level}', 'task.pick': 'Kies een moment',
  'task.due': 'Deadline {label}, wijzigen', 'task.dueClear': 'Deadline wissen', 'task.edit': 'Titel aanpassen',
  'demo': ['Huur overschrijven', 'Offerte terugsturen', 'Boodschappen doen', 'Planten water geven', 'Fiets laten herstellen',
    'Cadeau voor zaterdag kopen', 'Was opvouwen', 'Tandarts bellen', 'Belastingaangifte invullen', 'Japans leren', 'Zolder opruimen'],

  // statistiek
  'stats.total': n('{n} ster aan de hemel', '{n} sterren aan de hemel'),
  'stats.label1': 'star collected', 'stats.label': 'stars collected',
  'stats.today': 'Vandaag', 'stats.week': 'Deze week', 'stats.best': 'Beste dag', 'stats.first': 'Eerste ster',
  'stats.reset': 'Teller op nul', 'stats.resetAsk': 'Teller en sterren op nul? Dat geldt ook op je gekoppelde toestellen. Je taken blijven.',
  'stats.resetYes': 'Op nul', 'stats.resetDone': 'Teller en sterren op nul',
  'skies.title': 'Hemels', 'skies.current': 'Deze hemel', 'skies.currentSince': 'Deze hemel, sinds {date}', 'skies.all': 'Alle sterren',
  'skies.until': 'Tot {date}', 'skies.range': '{from} tot {to}', 'skies.new': 'Nieuwe hemel',
  'wall.label': 'Muur', 'wall.title': 'Muur van afgevinkte taken achter de hemel',
  'skies.ask': 'Een nieuwe, lege hemel? Je sterren verdwijnen van het scherm maar blijven bewaard; je kunt ze hier altijd terug tonen. Dat geldt ook op je gekoppelde toestellen.',
  'skies.yes': 'Nieuwe hemel', 'skies.done': 'Nieuwe hemel. Je vorige sterren staan onder Hemels.',

  // focusmodus
  'focus.late': 'Te laat', 'focus.next': 'Volgende deadline', 'focus.now': 'Nu', 'focus.more': 'en nog {n}',

  // toasts
  'undo': 'Ongedaan maken', 'cancel': 'Annuleer', 'done': 'Klaar',
  'toast.completed': 'Afgevinkt · {title}', 'toast.restored': 'Teruggezet · {title}',
  'toast.saveFailed': 'Bewaren op dit toestel lukte niet. Je taken staan in de reservekopie; exporteer ze voor de zekerheid.',
  'toast.mirror': n('{n} taak hersteld uit de reservekopie', '{n} taken hersteld uit de reservekopie'),
  'toast.elsewhere1': 'Elders afgevinkt · {title}', 'toast.elsewhere': '{n} taken elders afgevinkt',
  'toast.restore': 'Terugzetten',
  'toast.back': n('{n} taak terug', '{n} taken terug'), 'toast.updated': '{n} bijgewerkt', 'toast.nothing': 'Niets nieuws: alles stond er al',
  'toast.badFile': 'Dat bestand kon Orbit niet lezen',
  'toast.standalone': 'Deze app heeft een eigen opslag. Haal je taken binnen via Koppelen.',

  // venster nieuwe taak
  'composer': 'Nieuwe taak', 'composer.placeholder': 'Wat moet er gebeuren?', 'composer.title': 'Titel', 'composer.moment': 'Moment',
  'composer.repeat': 'Herhaal', 'repeat.none': 'Niet herhalen', 'repeat.day': 'Elke dag', 'repeat.week': 'Elke week', 'repeat.month': 'Elke maand',
  'repeat.hint': '{repeat}, eerst {label}. Na afvinken komt hij terug.', 'task.repeat': 'Herhalen',
  'toast.repeat': 'Afgevinkt · {title}. Terug {label}.',
  'menu.sound': 'Geluid', 'sound.on': 'Aan', 'sound.off': 'Uit',
  'fidget.aria': 'Bakje om mee te spelen. Sleep het heen en weer, beweeg erover of tik erin.', 'fidget.kind': 'Soort',
  'fidget.water': 'Water', 'fidget.sand': 'Zand', 'fidget.jelly': 'Gelei', 'fidget.magnet': 'Magneet',
  'menu.fx': 'Effecten', 'fx.all': 'Alle', 'fx.min': 'Minimaal',
  'menu.demo': 'Demo', 'demo.open': 'Open demo', 'demo.leave': 'Verlaat demo', 'demo.badge': 'Demo',
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
  'reason.import': 'Voor import', 'reason.sync': 'Voor synchronisatie', 'reason.receive': 'Voor ontvangen',

  // koppelen
  'sync.off': 'Koppelen', 'sync.connecting': 'Verbinden', 'sync.online': 'Gesynchroniseerd', 'sync.offline': 'Offline', 'sync.connected': 'Verbonden',
  'sync.waiting': n('{n} wacht', '{n} wachten'), 'sync.pair': 'Toestellen koppelen', 'sync.status': 'Synchronisatie: {text}',
  'sync.send': 'Versturen', 'sync.receive': 'Ontvangen', 'sync.once': 'Eenmalig',
  'sync.intro': 'Kies op welk toestel je taken nu staan. Dat toestel verstuurt, het andere ontvangt. Daarna blijven ze vanzelf gelijk.',
  'sync.newTitle': 'Verstuur van dit toestel', 'sync.newSub': 'Toont een QR-code. Je lijst hier blijft zoals ze is.',
  'sync.scanTitle': 'Ontvang op dit toestel', 'sync.scanSub': 'Scan de QR-code van je andere toestel. Je lijst hier wordt vervangen.',
  'sync.manual': 'Code of link plakken om te ontvangen', 'sync.input': 'Code of koppellink', 'sync.inputPh': 'Code of link',
  'sync.paste': 'Plak', 'sync.join': 'Ontvang',
  'sync.confirmText': 'Taken ontvangen van je andere toestel?',
  'sync.confirmWarn': 'De lijst op dit toestel wordt vervangen door die van het andere toestel. Orbit bewaart eerst een momentopname, terug te vinden in Archief.',
  'sync.notNow': 'Niet nu', 'sync.receiveTasks': 'Ontvang taken',
  'sync.scanWarn': 'De lijst op dit toestel wordt vervangen door die van het andere toestel. Orbit bewaart eerst een momentopname.',
  'sync.aim': 'Richt de camera op de QR-code van het toestel dat verstuurt.', 'sync.cancel': 'Annuleren',
  'sync.step.scan': 'Code ontvangen', 'sync.step.connect': 'Verbinden met de server', 'sync.step.wait': 'Wachten op de lijst van het andere toestel', 'sync.step.done': 'Taken overgenomen',
  'sync.retry': 'Opnieuw proberen',
  'sync.thisDevice': 'Dit toestel', 'sync.scanning': 'Toestel dat scant', 'sync.qr': 'QR-code om taken naar een ander toestel te versturen',
  'sync.onNote': 'Scan met de camera van het andere toestel, of kies daar in Orbit "Ontvang op dit toestel". Naar de app op het beginscherm van deze zelfde gsm? Tik op "Kopieer link", open de app en plak de link bij Koppelen.',
  'sync.copy': 'Kopieer link', 'sync.copied': 'Gekopieerd', 'sync.copyPrompt': 'Kopieer:',
  'sync.showCode': 'Toon code', 'sync.hideCode': 'Verberg code', 'sync.stop': 'Ontkoppel dit toestel',
  'sync.meta': 'Gekoppeld · {text}', 'sync.metaAt': 'Gekoppeld · {text} om {time}',
  'sync.notOrbitQr': 'Dat is geen QR-code van Orbit. Richt op de code van het toestel dat verstuurt.',
  'sync.badCode': 'Dat is geen code of koppellink van Orbit. Een code heeft 16 tekens, bv. 7K2P-Q9XD-M3TA-4HWE.',
  'sync.connectedWait': 'Verbonden. Hou de QR-code open op het andere toestel.',
  'sync.timeout': 'Nog niets ontvangen. Staat de QR-code nog open op het andere toestel, en zijn beide toestellen online? Orbit blijft wachten.',
  'sync.received': n('{n} taak ontvangen{from}. Vanaf nu blijven beide toestellen gelijk.', '{n} taken ontvangen{from}. Vanaf nu blijven beide toestellen gelijk.'),
  'sync.receivedToast': n('{n} taak ontvangen{from}', '{n} taken ontvangen{from}'), 'sync.fromDevice': ' van {name}',
  'sync.error': 'Er liep iets mis bij het verbinden. Probeer opnieuw.',
  'sync.serverConnecting': 'Verbinden met de server…',
  'sync.ready': n('Klaar om te versturen: {n} taak. Scan met het toestel dat moet ontvangen.', 'Klaar om te versturen: {n} taken. Scan met het toestel dat moet ontvangen.'),
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
  'intro.add': 'Toevoegen', 'intro.addText': 'Kies een moment op het wiel en tik nog eens, of druk <kbd>N</kbd>. Met een deadline schuift de taak vanzelf naar binnen naarmate de datum nadert; met Herhaal komt ze na het afvinken terug.',
  'intro.done': 'Afvinken', 'intro.doneText': 'Tik op het rondje in de lijst: een lichtpuntje vliegt naar de bol en die fonkelt uit. <kbd>Z</kbd> zet ze terug, en alles blijft 60 dagen in Archief.',
  'intro.stars': 'Sterren', 'intro.starsText': 'Elke afgevinkte taak spaart een ster achter de ringen: je hemel groeit met alles wat je gedaan kreeg, en elke 25 sterren vormen even een sterrenbeeld. Via de teller begin je een nieuwe, lege hemel; de oude sterren blijven bewaard.',
  'intro.core': 'De kern', 'intro.coreText': 'De kern heeft een gezicht. Hij begroet je, kijkt mee met je muis en zegt bij een tik wat er nu het meest toe doet. Is er niets dringends, dan doet hij een dutje.',
  'intro.move': 'Verplaatsen', 'intro.moveText': 'Sleep een bol naar een andere ring, of tik op het bolletje rechts van een taak in de lijst.',
  'intro.look': 'Kijken', 'intro.lookText': 'Boven of zijkant (<kbd>1</kbd> <kbd>2</kbd>), slepen in de scène draait mee. Focus (<kbd>F</kbd>) toont klok, weer en wat nu moet.',
  'intro.calm': 'Rust', 'intro.calmText': 'Te druk? Onder Instellingen wissel je het tempo (<kbd>T</kbd>: normaal, zen, stil), licht of donker (<kbd>D</kbd>) en de taal. Effecten op Minimaal zet alle extra effecten uit.',
  'intro.devices': 'Toestellen', 'intro.devicesText': 'Koppelen (rechtsboven, op gsm onder Instellingen): het ene toestel toont een QR-code, het andere scant en ontvangt je taken. Daarna blijven ze gelijk, ook offline.',
  'intro.keys': '<kbd>N</kbd> nieuw <kbd>1</kbd><kbd>2</kbd> aanzicht <kbd>F</kbd> focus <kbd>T</kbd> tempo <kbd>D</kbd> thema <kbd>A</kbd> archief <kbd>Z</kbd> ongedaan <kbd>?</kbd> uitleg',
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
  'menu.intro': 'Guide', 'menu.archive': 'Archive',
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
  'task.check': 'Mark “{title}” as done', 'task.dbl': 'Double-click to edit',
  'task.level': 'Change moment, now {level}', 'task.pick': 'Choose a moment',
  'task.due': 'Deadline {label}, change', 'task.dueClear': 'Clear deadline', 'task.edit': 'Edit title',
  'demo': ['Pay the rent', 'Send back the quote', 'Do the groceries', 'Water the plants', 'Get the bike fixed',
    'Buy a present for Saturday', 'Fold the laundry', 'Call the dentist', 'File the tax return', 'Learn Japanese', 'Clear out the attic'],

  'stats.total': n('{n} star in the sky', '{n} stars in the sky'),
  'stats.label1': 'star collected', 'stats.label': 'stars collected',
  'stats.today': 'Today', 'stats.week': 'This week', 'stats.best': 'Best day', 'stats.first': 'First star',
  'stats.reset': 'Reset counter', 'stats.resetAsk': 'Reset the counter and stars? This also applies to your paired devices. Your tasks stay.',
  'stats.resetYes': 'Reset', 'stats.resetDone': 'Counter and stars reset',
  'skies.title': 'Skies', 'skies.current': 'This sky', 'skies.currentSince': 'This sky, since {date}', 'skies.all': 'All stars',
  'skies.until': 'Until {date}', 'skies.range': '{from} to {to}', 'skies.new': 'New sky',
  'wall.label': 'Wall', 'wall.title': 'Wall of completed tasks behind the sky',
  'skies.ask': 'A new, empty sky? Your stars leave the screen but are kept; you can always show them again here. This also applies to your paired devices.',
  'skies.yes': 'New sky', 'skies.done': 'New sky. Your earlier stars are under Skies.',

  'focus.late': 'Overdue', 'focus.next': 'Next deadline', 'focus.now': 'Now', 'focus.more': 'and {n} more',

  'undo': 'Undo', 'cancel': 'Cancel', 'done': 'Done',
  'toast.completed': 'Done · {title}', 'toast.restored': 'Restored · {title}',
  'toast.saveFailed': 'Saving on this device failed. Your tasks are in the backup copy; export them to be safe.',
  'toast.mirror': n('{n} task restored from the backup copy', '{n} tasks restored from the backup copy'),
  'toast.elsewhere1': 'Done elsewhere · {title}', 'toast.elsewhere': '{n} tasks done elsewhere',
  'toast.restore': 'Restore',
  'toast.back': n('{n} task back', '{n} tasks back'), 'toast.updated': '{n} updated', 'toast.nothing': 'Nothing new: everything was already there',
  'toast.badFile': 'Orbit could not read that file',
  'toast.standalone': 'This app has its own storage. Bring in your tasks via Pair.',

  'composer': 'New task', 'composer.placeholder': 'What needs doing?', 'composer.title': 'Title', 'composer.moment': 'Moment',
  'composer.repeat': 'Repeat', 'repeat.none': 'No repeat', 'repeat.day': 'Every day', 'repeat.week': 'Every week', 'repeat.month': 'Every month',
  'repeat.hint': '{repeat}, first {label}. Comes back after you tick it off.', 'task.repeat': 'Repeat',
  'toast.repeat': 'Done · {title}. Back {label}.',
  'menu.sound': 'Sound', 'sound.on': 'On', 'sound.off': 'Off',
  'fidget.aria': 'A little tank to play with. Drag it around, move over it or tap in it.', 'fidget.kind': 'Kind',
  'fidget.water': 'Water', 'fidget.sand': 'Sand', 'fidget.jelly': 'Jelly', 'fidget.magnet': 'Magnet',
  'menu.fx': 'Effects', 'fx.all': 'All', 'fx.min': 'Minimal',
  'menu.demo': 'Demo', 'demo.open': 'Open demo', 'demo.leave': 'Leave demo', 'demo.badge': 'Demo',
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
  'reason.import': 'Before import', 'reason.sync': 'Before sync', 'reason.receive': 'Before receiving',

  'sync.off': 'Pair', 'sync.connecting': 'Connecting', 'sync.online': 'Synced', 'sync.offline': 'Offline', 'sync.connected': 'Connected',
  'sync.waiting': n('{n} waiting', '{n} waiting'), 'sync.pair': 'Pair devices', 'sync.status': 'Sync: {text}',
  'sync.send': 'Send', 'sync.receive': 'Receive', 'sync.once': 'One time',
  'sync.intro': 'Choose which device has your tasks now. That device sends, the other receives. After that they stay in step by themselves.',
  'sync.newTitle': 'Send from this device', 'sync.newSub': 'Shows a QR code. Your list here stays as it is.',
  'sync.scanTitle': 'Receive on this device', 'sync.scanSub': 'Scan the QR code of your other device. Your list here will be replaced.',
  'sync.manual': 'Paste a code or link to receive', 'sync.input': 'Code or pairing link', 'sync.inputPh': 'Code or link',
  'sync.paste': 'Paste', 'sync.join': 'Receive',
  'sync.confirmText': 'Receive tasks from your other device?',
  'sync.confirmWarn': 'The list on this device will be replaced by the one on the other device. Orbit first saves a snapshot, which you can find in Archive.',
  'sync.notNow': 'Not now', 'sync.receiveTasks': 'Receive tasks',
  'sync.scanWarn': 'The list on this device will be replaced by the one on the other device. Orbit first saves a snapshot.',
  'sync.aim': 'Point the camera at the QR code of the sending device.', 'sync.cancel': 'Cancel',
  'sync.step.scan': 'Code received', 'sync.step.connect': 'Connecting to the server', 'sync.step.wait': 'Waiting for the list from the other device', 'sync.step.done': 'Tasks taken over',
  'sync.retry': 'Try again',
  'sync.thisDevice': 'This device', 'sync.scanning': 'Scanning device', 'sync.qr': 'QR code to send tasks to another device',
  'sync.onNote': 'Scan with the camera of the other device, or choose "Receive on this device" in Orbit there. Sending to the app on the home screen of this same phone? Tap "Copy link", open the app and paste the link under Pair.',
  'sync.copy': 'Copy link', 'sync.copied': 'Copied', 'sync.copyPrompt': 'Copy:',
  'sync.showCode': 'Show code', 'sync.hideCode': 'Hide code', 'sync.stop': 'Unpair this device',
  'sync.meta': 'Paired · {text}', 'sync.metaAt': 'Paired · {text} at {time}',
  'sync.notOrbitQr': 'That is not an Orbit QR code. Point at the code of the sending device.',
  'sync.badCode': 'That is not an Orbit code or pairing link. A code has 16 characters, e.g. 7K2P-Q9XD-M3TA-4HWE.',
  'sync.connectedWait': 'Connected. Keep the QR code open on the other device.',
  'sync.timeout': 'Nothing received yet. Is the QR code still open on the other device, and are both devices online? Orbit keeps waiting.',
  'sync.received': n('{n} task received{from}. From now on both devices stay in step.', '{n} tasks received{from}. From now on both devices stay in step.'),
  'sync.receivedToast': n('{n} task received{from}', '{n} tasks received{from}'), 'sync.fromDevice': ' from {name}',
  'sync.error': 'Something went wrong while connecting. Please try again.',
  'sync.serverConnecting': 'Connecting to the server…',
  'sync.ready': n('Ready to send: {n} task. Scan with the device that should receive.', 'Ready to send: {n} tasks. Scan with the device that should receive.'),
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
  'intro.add': 'Add', 'intro.addText': 'Pick a moment on the wheel and tap again, or press <kbd>N</kbd>. With a deadline, the task moves inward by itself as the date gets closer; with Repeat it comes back after you tick it off.',
  'intro.done': 'Complete', 'intro.doneText': 'Tap the circle in the list: a spark flies to the orb and it twinkles out. <kbd>Z</kbd> brings it back, and everything stays in Archive for 60 days.',
  'intro.stars': 'Stars', 'intro.starsText': 'Every task you tick off earns a star behind the rings: your sky grows with everything you got done, and every 25 stars briefly form a constellation. Via the counter you start a new, empty sky; the old stars are kept.',
  'intro.core': 'The core', 'intro.coreText': 'The core has a face. It greets you, follows your mouse and, when you tap it, tells you what matters most right now. When nothing is urgent, it takes a nap.',
  'intro.move': 'Move', 'intro.moveText': 'Drag an orb to another ring, or tap the dot to the right of a task in the list.',
  'intro.look': 'Look', 'intro.lookText': 'Top or side (<kbd>1</kbd> <kbd>2</kbd>), and dragging the scene turns it. Focus (<kbd>F</kbd>) shows the clock, the weather and what needs doing now.',
  'intro.calm': 'Calm', 'intro.calmText': 'Too busy? Under Settings you change the tempo (<kbd>T</kbd>: normal, zen, still), light or dark (<kbd>D</kbd>) and the language. Effects on Minimal turns off all the extra effects.',
  'intro.devices': 'Devices', 'intro.devicesText': 'Pair (top right, under Settings on a phone): one device shows a QR code, the other scans it and receives your tasks. After that they stay in step, offline too.',
  'intro.keys': '<kbd>N</kbd> new <kbd>1</kbd><kbd>2</kbd> view <kbd>F</kbd> focus <kbd>T</kbd> tempo <kbd>D</kbd> theme <kbd>A</kbd> archive <kbd>Z</kbd> undo <kbd>?</kbd> guide',
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
