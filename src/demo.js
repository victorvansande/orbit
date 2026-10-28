/* ---- Demoversie (?demo) ---- */
// Instellingen → Demo opent Orbit met een tijdelijke opslag in het geheugen (zie het script in index.html): de echte
// lijst, de reservekopie in IndexedDB en de synchronisatie blijven onaangeroerd. Deze module vult die opslag met een
// volledige voorbeeldlijst, zodat elke functie meteen te proberen is. Herladen begint opnieuw.
// Moet als eerste module geladen worden: andere modules lezen de opslag al bij het importeren.

export const DEMO_MODE = window.ORBIT_DEMO === true;

const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const dueIn = days => { const d = new Date(Date.now() + days * DAY); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const TITLES = {
  nl: ['Huur overschrijven', 'Offerte terugsturen', 'Boodschappen doen', 'Planten water geven', 'Fiets laten herstellen',
    'Cadeau voor zaterdag kopen', 'Vuilnis buiten zetten', 'Tandarts bellen', 'Belastingaangifte invullen', 'Japans leren',
    'Zolder opruimen', 'Verslag afwerken', 'Verjaardag mama'],
  en: ['Pay the rent', 'Send back the quote', 'Do the groceries', 'Water the plants', 'Get the bike repaired',
    'Buy a present for Saturday', 'Take out the bins', 'Call the dentist', 'File the tax return', 'Learn Japanese',
    'Clear out the attic', 'Finish the report', "Mum's birthday"],
};

if (DEMO_MODE) seed();

function seed() {
  let lang = 'nl';
  try { lang = localStorage.getItem('priority-orbit.lang.v1') || (/^nl\b/i.test(navigator.language || '') ? 'nl' : 'en'); } catch { /* geen opslag */ }
  const T = TITLES[lang] || TITLES.nl, now = Date.now();
  // [titel, moment, extra]: iets dat al lang ligt, deadlines (te laat, vandaag, deze week, later), een herhaling
  const list = [
    [0, 1, { levelAt: now - 9 * DAY }],
    [1, 1, {}],
    [2, 2, {}],
    [3, 2, { due: dueIn(0), repeat: 'week' }],
    [11, 1, { due: dueIn(-2) }],
    [4, 3, {}],
    [5, 3, { due: dueIn(3) }],
    [6, 3, { due: dueIn(5), repeat: 'week' }],
    [7, 4, {}],
    [8, 4, { due: dueIn(20) }],
    [12, 5, { due: dueIn(60), repeat: 'month' }],
    [9, 5, { levelAt: now - 40 * DAY }],
    [10, 5, {}],
  ];
  const tasks = list.map(([i, level, extra], n) => ({
    id: `demo-${n}`, title: T[i], level, createdAt: now - (n + 1) * 3600000, updatedAt: now - (n + 1) * 3600000,
    levelAt: now - (n + 1) * 3600000, ...extra,
  }));
  // 23 afgevinkte taken over de voorbije weken: teller en sterren gevuld, twee keer afvinken geeft een sterrenbeeld
  const done = {};
  for (let i = 0; i < 23; i++) done[`demo-done-${i}`] = now - (i * 19 + 2) * 3600000;
  try {
    localStorage.setItem('priority-orbit.tasks.v1', JSON.stringify(tasks));
    localStorage.setItem('priority-orbit.done.v1', JSON.stringify(done));
  } catch { /* geen opslag */ }
}
