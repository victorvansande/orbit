/* ---- Demoversie (?demo) ---- */
// Instellingen → Demo opent Orbit met een tijdelijke opslag in het geheugen (zie het script in index.html): de echte
// lijst, de reservekopie in IndexedDB en de synchronisatie blijven onaangeroerd. Deze module vult die opslag met een
// volledige voorbeeldlijst, zodat elke functie meteen te proberen is. Herladen begint opnieuw.
// Moet als eerste module geladen worden: andere modules lezen de opslag al bij het importeren.

export const DEMO_MODE = window.ORBIT_DEMO === true;

const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const dueIn = days => { const d = new Date(Date.now() + days * DAY); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// [titel nl, titel en, moment, extra]: per schil minstens vijf taken, met alles wat Orbit kan tonen: een taak die al
// lang ligt, deadlines (te laat, vandaag, deze week, later), herhalingen
// afgevinkte voorbeeldtaken (titels voor het archief en de muur)
const DEMO_DONE = [
  ['Tandarts bellen', 'Call the dentist'], ['Winterbanden laten steken', 'Fit the winter tyres'], ['Cadeau voor mama', 'Present for mum'],
  ['Belastingaangifte', 'Tax return'], ['Vuilnis buiten', 'Take out the bins'], ['Kapper boeken', 'Book the barber'],
  ['Fiets laten herstellen', 'Get the bike fixed'], ['Presentatie oefenen', 'Rehearse the talk'], ['Pakje ophalen', 'Pick up the parcel'],
  ['Mail aan Sarah', 'Email Sarah'], ['Verzekering vergelijken', 'Compare insurance'], ['Boek terugbrengen', 'Return the book'],
];

const DEMO_TASKS = [
  ['Huur overschrijven', 'Pay the rent', 1, { levelAt: -9 }],
  ['Offerte terugsturen', 'Send back the quote', 1, {}],
  ['Verslag afwerken', 'Finish the report', 1, { due: -2 }],
  ['Klant terugbellen', 'Call the client back', 1, {}],
  ['Factuur betalen', 'Pay the invoice', 1, { due: -1 }],
  ['Boodschappen doen', 'Do the groceries', 2, {}],
  ['Planten water geven', 'Water the plants', 2, { due: 0, repeat: 'week' }],
  ['Mail van Sarah beantwoorden', "Reply to Sarah's email", 2, {}],
  ['Pakje ophalen', 'Pick up the parcel', 2, { due: 0 }],
  ['Sporten', 'Work out', 2, { due: 0, repeat: 'day' }],
  ['Fiets laten herstellen', 'Get the bike repaired', 3, {}],
  ['Cadeau voor zaterdag kopen', 'Buy a present for Saturday', 3, { due: 3 }],
  ['Vuilnis buiten zetten', 'Take out the bins', 3, { due: 5, repeat: 'week' }],
  ['Presentatie voorbereiden', 'Prepare the presentation', 3, {}],
  ['Kapper boeken', 'Book the hairdresser', 3, { due: 6 }],
  ['Tandarts bellen', 'Call the dentist', 4, {}],
  ['Belastingaangifte invullen', 'File the tax return', 4, { due: 20 }],
  ['Winterbanden laten steken', 'Get the winter tyres on', 4, {}],
  ['Weekendje weg plannen', 'Plan a weekend away', 4, { due: 25 }],
  ['Huishuur indexeren', 'Check the rent indexation', 4, { due: 15, repeat: 'month' }],
  ['Japans leren', 'Learn Japanese', 5, { levelAt: -40 }],
  ['Zolder opruimen', 'Clear out the attic', 5, {}],
  ['Verjaardag mama', "Mum's birthday", 5, { due: 60, repeat: 'month' }],
  ['Boek schrijven', 'Write a book', 5, {}],
  ['Moestuin aanleggen', 'Start a vegetable garden', 5, {}],
  ['Fotoalbums digitaliseren', 'Digitise the photo albums', 5, {}],
];

if (DEMO_MODE) seed();

function seed() {
  let lang = 'nl';
  try { lang = localStorage.getItem('priority-orbit.lang.v1') || (/^nl\b/i.test(navigator.language || '') ? 'nl' : 'en'); } catch { /* geen opslag */ }
  const now = Date.now();
  const tasks = DEMO_TASKS.map(([nl, en, level, extra], n) => {
    const at = now - (n + 1) * 3600000;
    const t = { id: `demo-${n}`, title: lang === 'en' ? en : nl, level, createdAt: at, updatedAt: at, levelAt: at };
    if (extra.levelAt) t.levelAt = now + extra.levelAt * DAY;
    if (extra.due !== undefined) t.due = dueIn(extra.due);
    if (extra.repeat) t.repeat = extra.repeat;
    return t;
  });
  // 23 afgevinkte taken over de voorbije weken: teller en sterren gevuld, twee keer afvinken geeft een sterrenbeeld
  const done = {}, archive = [];
  for (let i = 0; i < 23; i++) {
    const at = now - (i * 19 + 2) * 3600000, id = `demo-done-${i}`, [nl, en] = DEMO_DONE[i % DEMO_DONE.length];
    done[id] = at;
    // ook in het archief, met titel: zo heeft de muur achter de hemel iets te tonen
    archive.push({ id, title: lang === 'en' ? en : nl, level: 1 + (i % 5), createdAt: at - DAY, updatedAt: at - DAY, doneAt: at });
  }
  // vorige maand voor de maandrecap (Victor, 01/11/2026: in de demo altijd een volle recap om te testen): 75 afgevinkte
  // taken, een veelvoud van 25 zodat twee keer afvinken nog altijd een sterrenbeeld geeft; drukker op dinsdag en in de
  // avond, één piekdag, verdeeld over de vijf momenten, plus focusblokken en een paar prestaties (fictieve id's die de
  // echte prestaties in de demo, die op 0 beginnen, niet raken)
  const feats = { log: {}, unlocked: {}, focus: {}, ev: {}, rev: {} };
  {
    let s = 11;
    const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    const m0 = new Date(now); const y = m0.getFullYear(), m = m0.getMonth() - 1;
    const days = new Date(y, m + 1, 0).getDate(), peak = 13;
    const pick = w => { let x = r() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return i; } return w.length - 1; };
    const HOURS = [0, 0, 0, 0, 0, 0, 1, 3, 5, 8, 9, 7, 4, 5, 6, 7, 6, 4, 5, 7, 9, 10, 6, 2];
    const dayW = Array.from({ length: days }, (_, d) => { const dow = (new Date(y, m, d + 1).getDay() + 6) % 7; return d === peak ? 9 : dow === 1 ? 4 : dow >= 5 ? 1.2 : 2.6; });
    for (let i = 0; i < 75; i++) {
      const d = pick(dayW), h = pick(HOURS), at = new Date(y, m, d + 1, h, Math.floor(r() * 60)).getTime(), id = `demo-recap-${i}`;
      done[id] = at;
      feats.log[id] = { t: at, lv: 1 + pick([19, 31, 22, 11, 4]), b: at - Math.round(r() * 5 * DAY), f: 0 };
    }
    for (let i = 0; i < 9; i++) feats.focus[String(new Date(y, m, 2 + i * 3, 10 + (i % 4), 0).getTime())] = [25, 25, 15, 50][i % 4];
    for (let i = 0; i < 4; i++) feats.unlocked[`demo-recap-feat-${i}`] = new Date(y, m, 5 + i * 6, 12).getTime();
  }
  try {
    localStorage.setItem('priority-orbit.feats.v1', JSON.stringify(feats));
    localStorage.setItem('priority-orbit.tasks.v1', JSON.stringify(tasks));
    localStorage.setItem('priority-orbit.done.v1', JSON.stringify(done));
    localStorage.setItem('priority-orbit.archive.v1', JSON.stringify(archive));
  } catch { /* geen opslag */ }
}
