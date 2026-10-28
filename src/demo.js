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
  const done = {};
  for (let i = 0; i < 23; i++) done[`demo-done-${i}`] = now - (i * 19 + 2) * 3600000;
  try {
    localStorage.setItem('priority-orbit.tasks.v1', JSON.stringify(tasks));
    localStorage.setItem('priority-orbit.done.v1', JSON.stringify(done));
  } catch { /* geen opslag */ }
}
