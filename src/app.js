import { DEMO_MODE } from './demo.js';   // als eerste: vult in de demo de tijdelijke opslag
import { LEVELS, LEVEL_BY_ID, URGENT_LEVEL, DEFAULT_LEVEL, toneNode } from './config.js';
import { createScene } from './scene.js';
import { createWheel } from './wheel.js';
import { isDue, levelForDue, dueLabel, isOverdue, toDue, nextDue } from './deadline.js';
import { createSync, newCode, normalizeCode, savedCode, mergeStates, sameState } from './sync.js';
import { mirror, readMirror } from './backup.js';
import { setMatrix, twinkleDot } from './matrix.js';
import { loadDone, saveDone, cleanDone, totalDone, doneSummary, loadReset, saveReset, loadStars, syncStars, placeStar, removeStar, clearStars, dayKey, STATS_KEYS,
  loadCuts, saveCuts, cleanCuts, loadSkyView, saveSkyView, skyPeriods, inView } from './stats.js';
import { QUOTES } from './quotes.js';
import { createWeather } from './weather.js';
import { renderQr, codeFromText, createScanner, deviceName } from './pair.js';
import { loadArchive, saveArchive, loadSnapshots, snapshot, lastSnapshotAt, STORE_KEYS } from './store.js';
import { tx, LANG, LOCALE, setLang, applyStatic, reasonText, DEMO_TITLES } from './i18n.js';
import { greeting, coreLine } from './greet.js';
import { playDone, soundOn, setSound } from './sound.js';
import { createFidget } from './fidget.js';
import { createTimer } from './timer.js';
import { FEATS, FEATS_KEY, GROUPS, groupName, loadFeats, saveFeats, mergeFeats, recordDone, recordEvent, recordFocus, backfill, evaluate } from './feats.js';
import { softReveal, nightFall, particleTitle, createWall } from './fx.js';

applyStatic();

/* ---- Instellingen ---- */
const STORAGE_KEY = 'priority-orbit.tasks.v1';
const GONE_KEY = 'priority-orbit.gone.v1';        // afgevinkte taken (id → tijdstip), nodig voor synchronisatie
const SAVED_KEY = 'priority-orbit.saved.v1';      // tijdstip van de laatste geslaagde bewaring in localStorage
const PENDING_KEY = 'priority-orbit.pending.v1';  // {n, confirmedAt}: wijzigingen die de server nog niet bevestigde
const DONE_MS = 320;          // rij vervaagt, daarna verdwijnt ze uit de lijst
const TOAST_MS = 5000;
const IDLE_MS = 2500;         // focusmodus: cursor en knoppen verbergen na stilstand

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(min-width: 1000px)');
const $ = id => document.getElementById(id);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/* ---- Opslag ---- */
const isTask = t => t && typeof t.id === 'string' && typeof t.title === 'string'
  && LEVEL_BY_ID.has(t.level) && typeof t.createdAt === 'number'
  && (t.due === undefined || isDue(t.due));

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const data = JSON.parse(raw);
    // oudere taken hebben nog geen wijzigingstijd: dan geldt de aanmaaktijd.
    // Een opgeslagen voorbeeldtaak die nooit aangepast werd, blijft een voorbeeldtaak (zie demoIds).
    if (!Array.isArray(data)) return null;
    const list = data.filter(isTask).map(({ demo, ...t }) => ({ ...t, updatedAt: t.updatedAt ?? t.createdAt }));
    const demo = demoIds(list);
    return list.map(t => (demo.has(t.id) ? { ...t, demo: true } : t));
  } catch {
    return null;
  }
}

function loadGone() {
  try { const g = JSON.parse(localStorage.getItem(GONE_KEY)); return g && typeof g === 'object' ? g : {}; } catch { return {}; }
}

// Voorbeeldtaken worden nooit bewaard: zolang je niets eigens hebt, blijft de opslag leeg
const realTasks = () => tasks.filter(t => !t.demo);

// Lokaal bewaren; met notify (standaard) ook doorgeven aan de synchronisatie.
// Vangnet: verdwijnen er taken die niet afgevinkt zijn (bv. een ander tabblad dat een oude lijst bewaart),
// dan eerst een momentopname van wat er stond.
let notifySync = () => {};
function saveTasks({ notify = true, reason = 'overwrite' } = {}) {
  const real = realTasks();
  const before = loadTasks();
  if (before) {
    const keep = new Set(real.map(t => t.id));
    const lost = before.filter(t => !keep.has(t.id) && !gone[t.id]);
    if (lost.length) snapshot(before, reason);
  }
  const json = JSON.stringify(real), now = Date.now();
  let ok = true;
  try {
    if (before || real.length) localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(GONE_KEY, JSON.stringify(gone));
    // nalezen: staat het er echt?
    if ((before || real.length) && localStorage.getItem(STORAGE_KEY) !== json) ok = false;
    else localStorage.setItem(SAVED_KEY, String(now));
  } catch { ok = false; }
  // altijd ook de tweede kopie, los van of localStorage lukte
  mirror({ tasks: real, gone, savedAt: now });
  if (!ok) storageWarning();
  if (notify) notifySync();
}

// Bewaren mislukte: niet stil blijven, maar zeggen wat je kunt doen
let warned = 0;
function storageWarning() {
  if (Date.now() - warned < 60000) return;
  warned = Date.now();
  setTimeout(() => showToast(tx('toast.saveFailed'), () => openArchive(), tx('menu.archive')), 0);
}

// Wijzigingen die nog niet bij de server zijn: geteld en bewaard, ook als je de app sluit
function loadPending() {
  try { const p = JSON.parse(localStorage.getItem(PENDING_KEY)); return p && typeof p.n === 'number' ? p : { n: 0, confirmedAt: 0 }; }
  catch { return { n: 0, confirmedAt: 0 }; }
}
let pending = loadPending();
function savePending() { try { localStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch { /* geen opslag */ } }

// Elke bewuste wijziging krijgt een nieuwe wijzigingstijd; zo wint bij synchronisatie de recentste
function touch(task) {
  task.updatedAt = Date.now();
  delete task.demo;
}

// Voorbeeldtaken in de taal van de app; herkennen (zie demoIds) gebeurt in beide talen
const DEMO_LEVELS = [1, 1, 2, 2, 3, 3, 3, 4, 4, 5, 5];
const DEMO = DEMO_TITLES[LANG].map((title, i) => [DEMO_LEVELS[i], title]);
const DEMO_LEVEL = new Map(Object.values(DEMO_TITLES).flatMap(list => list.map((title, i) => [title, DEMO_LEVELS[i]])));

// Voorbeeldtaken herkennen die ooit opgeslagen werden: zelfde titel en moment als in het voorbeeld, nooit gewijzigd,
// en als groepje (minstens drie, aangemaakt binnen 15 s, zoals het voorbeeld dat doet). Zo wordt een eigen taak die
// toevallig "Boodschappen doen" heet niet aangezien voor een voorbeeld. Zulke taken horen niet in je echte lijst;
// vroeger werden ze soms opgeslagen en via sync tussen je eigen taken gezet.
const untouchedDemo = t => DEMO_LEVEL.get(t.title) === t.level && !t.due && (t.updatedAt ?? t.createdAt) === t.createdAt;
function demoIds(list) {
  const ids = new Set(list.filter(t => t.demo).map(t => t.id));
  const cand = list.filter(t => !t.demo && untouchedDemo(t)).sort((a, b) => a.createdAt - b.createdAt);
  for (let i = 0; i < cand.length; i++) {
    const group = cand.filter(t => t.createdAt >= cand[i].createdAt && t.createdAt - cand[i].createdAt <= 15000);
    if (group.length >= 3) for (const t of group) ids.add(t.id);
  }
  return ids;
}

function demoTasks() {
  const now = Date.now();
  return DEMO.map(([level, title], i) => {
    const createdAt = now - (DEMO.length - i) * 1000;
    return { id: uid(), title, level, createdAt, updatedAt: createdAt, demo: true };
  });
}

// Voorbeeldtaken tussen echte taken: weg, met een afvinkmarkering zodat ze ook op gekoppelde toestellen verdwijnen.
// Eerst een momentopname, zodat er toch niets onherroepelijk verdwijnt.
function dropDemo(list, reason) {
  const ids = demoIds(list);
  const demo = list.filter(t => ids.has(t.id)), real = list.filter(t => !ids.has(t.id));
  if (!demo.length) return list;
  if (!real.length) return list.map(t => ({ ...t, demo: true }));    // enkel voorbeeld: tonen, niet bewaren of delen
  snapshot(list.map(({ demo: _, ...t }) => t), reason);
  const now = Date.now();
  for (const t of demo) gone[t.id] = Math.max(gone[t.id] || 0, now);
  return real;
}

// Reservekopie en bewaartijd lezen vóór het eerste bewaren hieronder ze overschrijft
const mirrorAtStart = readMirror();
let savedAtStart = 0, lsEmptyAtStart = true;
try {
  savedAtStart = Number(localStorage.getItem(SAVED_KEY) || 0);
  lsEmptyAtStart = localStorage.getItem(STORAGE_KEY) === null;
} catch { /* opslag geblokkeerd (bv. privévenster): de app werkt verder met de reservekopie */ }

let gone = loadGone();
let tasks = loadTasks();
tasks = tasks === null ? demoTasks() : dropDemo(tasks, 'demo');
let archive = loadArchive();
let done = loadDone(archive);                    // logboek van afgevinkte taken, gaat mee met de sync
// Elke afgevinkte taak in het archief telt als ster; ontbreekt ze in het logboek (bv. door de vroegere "Teller op nul"),
// dan komt ze erbij. Geeft true als er iets bijkwam.
function archiveIntoDone() {
  let added = false;
  for (const a of archive) if (Number.isFinite(a.doneAt) && done[a.id] === undefined) { done[a.id] = a.doneAt; added = true; }
  return added;
}
if (archiveIntoDone()) saveDone(done);
let doneReset = loadReset();                      // teller op nul gezet op dit tijdstip
let skyCuts = loadCuts();                         // begin van elke nieuwe hemel (gaat mee met de sync)
let skyView = loadSkyView();                      // getoonde hemel: 'current', 'all' of het begin van een vorige
const starVisible = id => done[id] !== undefined && inView(done[id], skyView, skyCuts);
let sky = syncStars(loadStars(), done);           // één ster per afgevinkte taak
let feats = loadFeats();                          // prestaties: logboek, ontgrendeld, focusblokken, gebeurtenissen
if (backfill(feats, archive)) saveFeats(feats);   // wat al in het archief zat, telt mee
applyDeadlines();
saveTasks({ notify: false });
// Vraag de browser om de opslag niet op te ruimen als er plaats tekort is
navigator.storage?.persist?.().catch(() => {});

// Reservekopie nakijken: is ze nieuwer dan localStorage (het bewaren mislukte) of is localStorage leeg terwijl de
// kopie taken heeft, dan worden de taken samengevoegd. Er verdwijnt niets: samenvoegen voegt enkel toe.
mirrorAtStart.then(m => {
  if (!m || !Array.isArray(m.tasks) || !m.tasks.length) return;
  if (!lsEmptyAtStart && (m.savedAt || 0) <= savedAtStart) return;
  const local = { tasks: realTasks(), gone };
  const merged = mergeStates(local, { tasks: m.tasks.filter(isTask), gone: m.gone || {} });
  if (sameState(merged, local)) return;
  const added = merged.tasks.length - local.tasks.length;
  snapshot(tasks, 'mirror');
  tasks = merged.tasks; gone = merged.gone;
  applyDeadlines();
  saveTasks();
  render();
  if (added > 0) showToast(tx('toast.mirror', { n: added }));
});

// Elke dag minstens één momentopname, ook als er niets misgaat
if (Date.now() - lastSnapshotAt() > 20 * 3600000) snapshot(tasks, 'daily');

// Taken met een deadline krijgen hun schil uit de datum; geeft true als er iets opschoof
function applyDeadlines() {
  let moved = false;
  for (const t of tasks) {
    if (!t.due) continue;
    const level = levelForDue(t.due);
    if (level !== t.level) { t.level = level; t.levelAt = Date.now(); moved = true; }
  }
  return moved;
}

/* ---- Scène en wiel ---- */
const groupsEl = $('groups');
let hotTask = null, hotLevel = null;

const scene = createScene($('scene'), {
  reducedMotion,
  onHover(taskId, level) { hotTask = taskId; hotLevel = level; markHot(); },
  onReassign(id, level) { setLevel(id, level); },
  onView(name) { syncViewButtons(name); },
  onCore() { tapCore(); },
});

// Een tik of klik buiten de scène (lijst, wiel, kop, lege pagina) zet een vastgezette bol of opgelichte ring terug.
// Wat je daarna aanwijst (een rij, een moment op het wiel), licht gewoon opnieuw op.
document.addEventListener('pointerdown', e => {
  scene.wake();
  if (e.target instanceof Element && e.target.closest('#scene')) return;
  clearTimeout(flashTimer);
  scene.clearSelection();
}, true);

let flashTimer = 0;
const wheel = createWheel($('wheel'), {
  reducedMotion,
  onChange(level) {
    scene.highlight({ level });
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => scene.highlight({}), 1100);
  },
  onHover(level) { clearTimeout(flashTimer); scene.highlight({ level }); },
  onOpen(level) { openComposer(level); },
});

/* ---- Samenvatting en hoeklabels ---- */
const countBy = level => tasks.reduce((n, t) => n + (t.level === level), 0);
const DAY_FMT = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
const TIME_FMT = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - start) / 86400000 + 1) / 7);
}

function renderSummary() {
  const total = tasks.length;
  const urgent = countBy(URGENT_LEVEL);
  $('summary').textContent = total === 0
    ? tx('summary.none')
    : `${urgent ? tx('summary.urgent', { n: urgent }) : tx('summary.calm')} · ${tx('tasks.n', { n: total })}`;
  const parts = LEVELS.map(lv => `${countBy(lv.id)} ${lv.name}`).join(', ');
  $('scene').setAttribute('aria-label', total ? tx('scene.label', { parts }) : tx('scene.empty'));
}

// Het papier kleurt 's avonds een tikje warmer (vanaf 17 u, vol om 21 u, tot 6 u) en 's ochtends weer neutraal (tot 9 u)
function renderWarmth(now) {
  const h = now.getHours() + now.getMinutes() / 60;
  const w = h < 6 ? 1 : h < 9 ? 1 - (h - 6) / 3 : h < 17 ? 0 : h < 21 ? (h - 17) / 4 : 1;
  document.documentElement.style.setProperty('--warmth', w.toFixed(3));
  requestAnimationFrame(() => document.documentElement.classList.add('warm-ready'));
}

function renderClock() {
  const now = new Date();
  renderWarmth(now);
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  $('week').textContent = tx('week', { n: isoWeek(now) });
  $('date').textContent = `${dd} · ${mm} · ${now.getFullYear()}`;
  setMatrix($('clock'), TIME_FMT.format(now));
  $('clock-date').textContent = DAY_FMT.format(now);
}

// Focusmodus: de eerstvolgende deadline (ook een verstreken), met hetzelfde label als in de lijst
function renderFocusDue() {
  const line = $('focus-due');
  const next = tasks.filter(t => t.due && !t.demo).sort((a, b) => a.due.localeCompare(b.due) || a.createdAt - b.createdAt)[0];
  line.hidden = !next;
  if (!next) return;
  const b = el('b', '', isOverdue(next.due) ? tx('focus.late') : tx('focus.next'));
  line.replaceChildren(b, document.createTextNode(`${next.title} · ${dueLabel(next.due)}`));
  line.classList.toggle('is-late', isOverdue(next.due));
}

// Quote in de focusmodus als er niets dringend is: om de 20 minuten een andere, in een geschudde volgorde die eerst
// de hele bibliotheek doorloopt voor er een terugkomt. De volgorde blijft bewaard, ook over herladen heen.
const QUOTE_KEY = 'priority-orbit.quote.v1';
const QUOTE_MS = 20 * 60 * 1000;
function shuffled(n, avoidFirst = -1) {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (a[0] === avoidFirst && n > 1) [a[0], a[1]] = [a[1], a[0]];
  return a;
}
function currentQuote() {
  let st = null;
  try { st = JSON.parse(localStorage.getItem(QUOTE_KEY)); } catch { /* opnieuw beginnen */ }
  if (!st || !Array.isArray(st.order) || st.order.length !== QUOTES.length) st = { order: shuffled(QUOTES.length), i: 0, at: Date.now() };
  if (Date.now() - st.at >= QUOTE_MS) {
    st.i++;
    st.at = Date.now();
    if (st.i >= st.order.length) st = { order: shuffled(QUOTES.length, st.order[st.order.length - 1]), i: 0, at: Date.now() };
  }
  try { localStorage.setItem(QUOTE_KEY, JSON.stringify(st)); } catch { /* geen opslag */ }
  return { index: st.order[st.i], quote: QUOTES[st.order[st.i]] };
}
let shownQuote = -1;
function quoteNode() {
  const { index, quote: [text, author] } = currentQuote();
  shownQuote = index;
  const fig = el('figure', 'focus-quote');
  fig.append(el('blockquote', '', text), el('figcaption', '', author));
  return fig;
}
// elke minuut nakijken of het tijd is voor een nieuwe quote (alleen zichtbaar in de focusmodus)
setInterval(() => {
  if (!document.body.classList.contains('is-focus') || shownQuote < 0) return;
  if (currentQuote().index !== shownQuote) renderFocusNow();
}, 60000);

// De quote loopt door tot vlak voor de buitenste ring (desktop): breedte uit de echte positie van de buitenste ring op
// de hoogte van de quote. Na het openen van de focusmodus schuift de scène nog even, dus ook later opnieuw.
// Quote of Nu-taken lopen door tot net voor de buitenste ring (Victor), op desktop
function fitQuote() {
  const fig = document.querySelector('.focus-quote, #focus-now ul');
  if (!fig || !desktop.matches || !document.body.classList.contains('is-focus')) return;
  fig.style.width = '';
  // twee keer: een andere breedte geeft een andere hoogte, en de quote hangt aan de onderkant
  for (let i = 0; i < 2; i++) {
    const box = fig.getBoundingClientRect();
    if (!box.height) return;
    const edges = [box.top, box.bottom].map(y => scene.edgeLeft(y)).filter(x => x !== null);
    const edge = edges.length ? Math.min(...edges) : innerWidth / 2;
    fig.style.width = `${Math.max(260, Math.min(760, edge - box.left - 32))}px`;
  }
}
window.addEventListener('resize', () => fitQuote());

function renderFocusNow() {
  renderFocusDue();
  const box = $('focus-now');
  const urgent = tasks.filter(t => t.level === URGENT_LEVEL).sort((a, b) => a.createdAt - b.createdAt);
  box.replaceChildren();
  if (!urgent.length) { box.append(quoteNode()); fitQuote(); return; }
  box.append(el('p', 'focus-kicker', tx('focus.now')));
  const ul = el('ul');
  const max = desktop.matches ? 4 : 3;   // op gsm minder plaats onder de scène
  for (const t of urgent.slice(0, max)) ul.append(el('li', '', t.title));
  if (urgent.length > max) ul.append(el('li', 'focus-more', tx('focus.more', { n: urgent.length - max })));
  box.append(ul);
  fitQuote();
}

/* ---- Statistiek: teller onder de lijst (met details bij een tik) en de sterrenhemel in de scène ---- */
const MONTH_FMT = new Intl.DateTimeFormat(LOCALE, { month: 'long' });
const LONG_DAY = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
let statsDay = '';
// Muur van afgevinkte taken achter de sterrenhemel, aan of uit met het knopje naast de teller (per toestel)
const WALL_KEY = 'priority-orbit.wall.v1';
let wallOn = false;
try { wallOn = localStorage.getItem(WALL_KEY) === 'on'; } catch { /* geen opslag */ }
function renderWall() {
  const words = [...new Set(archive.slice(0, 80).map(a => a.title))];
  scene.setWall(words, wallOn);
  $('wall-toggle').setAttribute('aria-pressed', String(wallOn));
  $('wall-toggle').hidden = !words.length;
}
$('wall-toggle').addEventListener('click', () => {
  wallOn = !wallOn;
  try { localStorage.setItem(WALL_KEY, wallOn ? 'on' : 'off'); } catch { /* geen opslag */ }
  renderWall();
});

function renderStats({ quiet = false } = {}) {
  const now = new Date();
  if (archiveIntoDone()) { saveDone(done); syncStars(sky, done); notifySync(); }
  renderWall();
  statsDay = dayKey(now);
  scene.setSky(sky.stars.filter(s => starVisible(s.id)), { quiet });
  const all = totalDone(done);
  $('stats').hidden = all === 0;
  $('stat-mini').hidden = all === 0;
  if (!all) return;
  // de teller telt alle verzamelde sterren; de gekozen hemel bepaalt enkel welke sterren in de scène staan
  const total = all;
  $('stat-mini-n').textContent = String(total);
  $('stat-mini').setAttribute('aria-label', tx('stars.mini', { n: total }));
  setMatrix($('stat-total'), String(total));
  $('stat-total').setAttribute('aria-label', tx('stats.total', { n: total }));
  $('stat-stars-label').textContent = total === 1 ? tx('stats.label1') : tx('stats.label');
  renderSkies();
  const sum = doneSummary(done, now);
  const day = ts => LONG_DAY.format(ts);
  const bestDay = sum.best ? (([y, m, d]) => new Date(y, m - 1, d))(sum.best.day.split('-').map(Number)) : null;
  const rows = [
    [tx('stats.today'), sum.today],
    [tx('stats.week'), sum.week],
    [MONTH_FMT.format(now), sum.month],
    [tx('stats.best'), sum.best ? `${sum.best.n} · ${day(bestDay)}` : '-'],
    [tx('stats.first'), sum.first ? day(sum.first) : '-'],
  ];
  $('stats-rows').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', '', k), el('dd', '', String(v))]));
}
// Hemels: een nieuwe, lege hemel zonder iets te wissen; vorige hemels of alle sterren samen kun je terug tonen
const SKY_DATE = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const skyDate = t => SKY_DATE.format(t).replace(/\./g, '');
function renderSkies() {
  const list = $('skies-list');
  $('skies-title').hidden = !skyCuts.length;
  if (!skyCuts.length) { list.replaceChildren(); return; }
  const periods = skyPeriods(done, skyCuts);
  const cur = periods[periods.length - 1];
  const opt = (value, label, n) => {
    const b = el('button', 'sky-opt');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(String(skyView) === String(value)));
    b.append(el('span', '', label), el('span', '', String(n)));
    b.addEventListener('click', () => setSkyView(value));
    return b;
  };
  const rows = [opt('current', tx('skies.currentSince', { date: skyDate(cur.from) }), cur.n)];
  for (const p of periods.slice(0, -1).reverse()) {
    rows.push(opt(p.from, p.from ? tx('skies.range', { from: skyDate(p.from), to: skyDate(p.to) }) : tx('skies.until', { date: skyDate(p.to) }), p.n));
  }
  rows.push(opt('all', tx('skies.all'), totalDone(done)));
  list.replaceChildren(...rows);
}
function setSkyView(value) {
  skyView = value;
  saveSkyView(value);
  renderStats({ quiet: true });
}
function showSkyConfirm(on) {
  $('sky-confirm').hidden = !on;
  $('sky-new').hidden = on;
  if (on) $('sky-new-no').focus();
}
$('sky-new').addEventListener('click', () => showSkyConfirm(true));
$('sky-new-no').addEventListener('click', () => showSkyConfirm(false));
$('sky-new-yes').addEventListener('click', () => {
  scene.newSky();   // de ring van tekens uit de kern neemt de oude sterren mee
  skyCuts = cleanCuts([...skyCuts, Date.now()]);
  saveCuts(skyCuts);
  skyView = 'current';
  saveSkyView(skyView);
  showSkyConfirm(false);
  renderStats({ quiet: true });
  checkFeats(true);
  notifySync();
  showToast(tx('skies.done'));
});

function showStatsDetail(open) {
  $('stats-detail').hidden = !open;
  $('stats-toggle').setAttribute('aria-expanded', String(open));
}
$('stats-toggle').addEventListener('click', () => showStatsDetail($('stats-detail').hidden));
// gsm: het tellertje bovenaan brengt je naar de details onderaan
$('stat-mini').addEventListener('click', () => {
  showStatsDetail(true);
  $('stats').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'center' });
});

// Af en toe fonkelt één stip, net als de sterren in de scène: van de klok in de focusmodus, anders van de teller
(function wink() {
  setTimeout(() => {
    if (!reducedMotion.matches && !document.hidden && !minimalFx) {
      if (document.body.classList.contains('is-focus')) twinkleDot($('clock'));
      else if (!$('stats').hidden && $('stats').offsetParent) twinkleDot($('stat-total'));
    }
    wink();
  }, 7000 + Math.random() * 9000);
})();

/* ---- Takenlijst ---- */
const CHECK_SVG = '<svg viewBox="0 0 14 14" width="11" height="11" aria-hidden="true"><path d="M2.6 7.3l2.9 2.9 5.9-6.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const leaving = new Set();

const wall = createWall({ reducedMotion });
function renderTracks() {
  const frag = document.createDocumentFragment();
  if (!tasks.length) {
    // alles afgevinkt: een muur van wat je onlangs afvinkte (typographic wall), anders gewoon de uitleg
    const recent = [...new Set(archive.slice(0, 40).map(a => a.title))];
    if (recent.length && !minimalFx) { wall.set(recent, tx('tracks.allDone')); frag.append(wall.el); }
    frag.append(el('p', 'tracks-empty', desktop.matches ? tx('tracks.emptyDesk') : tx('tracks.emptyMobile')));
  }
  for (const lv of LEVELS) {
    const own = tasks.filter(t => t.level === lv.id).sort((a, b) => a.createdAt - b.createdAt);
    if (!own.length) continue;
    const group = el('section', 'group');
    group.dataset.level = lv.id;
    toneNode(group, lv);
    const head = el('h3', 'group-head');
    head.append(el('span', 'group-name', lv.name), el('span', 'group-count', String(own.length).padStart(2, '0')));
    head.addEventListener('pointerenter', () => scene.highlight({ level: lv.id }));
    head.addEventListener('pointerleave', () => scene.highlight({}));
    const ul = el('ul', 'group-list');
    for (const t of own) ul.append(trackRow(t));
    group.append(head, ul);
    frag.append(group);
  }
  groupsEl.replaceChildren(frag);
  $('tracks-count').textContent = String(tasks.length).padStart(2, '0');
  $('tracks-demo').hidden = !tasks.some(t => t.demo);
  markHot();
}

function trackRow(t) {
  const li = el('li', leaving.has(t.id) ? 'track is-done' : 'track');
  li.dataset.id = t.id;

  const check = el('button', 't-check');
  check.type = 'button';
  check.innerHTML = CHECK_SVG;
  check.setAttribute('aria-label', tx('task.check', { title: t.title }));
  check.addEventListener('click', () => complete(t.id, li));

  const title = el('span', 't-title', t.title);
  title.title = tx('task.dbl');
  title.addEventListener('dblclick', () => editTitle(t.id, title));

  li.append(check, title, noteButton(t, li));
  if (t.due) li.append(...dueControls(t, li));
  else li.append(...levelControls(t, li));
  li.append(notePanel(t, li));

  li.addEventListener('pointerenter', () => scene.highlight({ task: t.id }));
  li.addEventListener('pointerleave', () => scene.highlight({}));
  return li;
}

// Notitie bij een taak: een icoontje naast de titel klapt eronder een tekstvak open. Enkel zichtbaar als je ze openklapt;
// een taak met notitie houdt het icoontje altijd zichtbaar. Bewaard terwijl je typt (gaat mee met de sync en het archief).
const NOTE_SVG = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h6"/></svg>';
const openNotes = new Set();   // taken waarvan de notitie openstaat (blijft open als de lijst opnieuw getekend wordt)
function noteButton(t, li) {
  const btn = el('button', t.note ? 't-note-btn has-note' : 't-note-btn');
  btn.type = 'button';
  btn.innerHTML = NOTE_SVG;
  btn.setAttribute('aria-label', tx('task.note', { title: t.title }));
  btn.title = tx(t.note ? 'task.noteShow' : 'task.noteAdd');
  btn.setAttribute('aria-expanded', String(openNotes.has(t.id)));
  btn.addEventListener('click', () => {
    const open = !openNotes.has(t.id);
    if (open) openNotes.add(t.id); else openNotes.delete(t.id);
    btn.setAttribute('aria-expanded', String(open));
    const panel = li.querySelector('.t-note');
    panel.hidden = !open;
    li.classList.toggle('is-noting', open);
    if (open) { const area = panel.querySelector('textarea'); fitNote(area); area.focus(); }
  });
  return btn;
}
const fitNote = area => { area.style.height = 'auto'; area.style.height = `${area.scrollHeight}px`; };
function notePanel(t, li) {
  const panel = el('div', 't-note');
  const open = openNotes.has(t.id);
  panel.hidden = !open;
  li.classList.toggle('is-noting', open);
  const area = el('textarea', 't-note-text');
  area.rows = 1;
  area.maxLength = 2000;
  area.value = t.note || '';
  area.placeholder = tx('task.notePlaceholder');
  area.setAttribute('aria-label', tx('task.note', { title: t.title }));
  let timer = 0;
  const save = () => {
    clearTimeout(timer);
    const task = tasks.find(x => x.id === t.id);
    if (!task) return;
    const value = area.value.replace(/\s+$/, '');
    if ((task.note || '') === value) return;
    if (value) task.note = value; else delete task.note;
    touch(task);
    saveTasks();
    li.querySelector('.t-note-btn').classList.toggle('has-note', Boolean(value));
  };
  area.addEventListener('input', () => { fitNote(area); clearTimeout(timer); timer = setTimeout(save, 500); });
  area.addEventListener('blur', save);
  area.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); save(); openNotes.delete(t.id); panel.hidden = true; li.classList.remove('is-noting'); li.querySelector('.t-note-btn').setAttribute('aria-expanded', 'false'); }
  });
  panel.append(area);
  if (open) requestAnimationFrame(() => fitNote(area));
  return panel;
}

// Gewone taak: bolletje rechts opent een keuze van de vijf momenten
function levelControls(t, li) {
  const levelBtn = el('button', 't-level');
  levelBtn.type = 'button';
  levelBtn.setAttribute('aria-label', tx('task.level', { level: LEVEL_BY_ID.get(t.level).name }));
  levelBtn.setAttribute('aria-expanded', 'false');
  levelBtn.append(el('span', 'orb-dot'));

  const picker = el('div', 't-picker');
  picker.hidden = true;
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', tx('task.pick'));
  for (const lv of LEVELS) {
    const opt = el('button', 't-opt');
    opt.type = 'button';
    toneNode(opt, lv);
    opt.setAttribute('aria-label', lv.name);
    opt.title = lv.name;
    if (lv.id === t.level) opt.setAttribute('aria-current', 'true');
    opt.append(el('span', 'orb-dot'));
    opt.addEventListener('click', () => setLevel(t.id, lv.id));
    picker.append(opt);
  }
  levelBtn.addEventListener('click', () => {
    const open = picker.hidden;
    picker.hidden = !open;
    levelBtn.setAttribute('aria-expanded', String(open));
    li.classList.toggle('is-picking', open);
  });
  return [levelBtn, picker];
}

// Taak met deadline: vaste schil, de datum rechts opent een bewerker (wijzigen of wissen)
function dueControls(t, li) {
  li.classList.add('has-due');
  const chip = el('button', isOverdue(t.due) ? 't-due is-late' : 't-due', dueLabel(t.due));
  chip.type = 'button';
  if (t.repeat) { chip.insertAdjacentHTML('afterbegin', REPEAT_SVG); chip.title = tx(`repeat.${t.repeat}`); }
  chip.setAttribute('aria-label', tx('task.due', { label: dueLabel(t.due) }));
  chip.setAttribute('aria-expanded', 'false');

  const editor = el('div', 't-due-edit');
  editor.hidden = true;
  const input = el('input', 'due-input');
  input.type = 'date';
  input.value = t.due;
  input.setAttribute('aria-label', tx('composer.due'));
  input.addEventListener('change', () => { if (isDue(input.value)) setDue(t.id, input.value); });
  const clear = el('button', 'due-clear', tx('task.dueClear'));
  clear.type = 'button';
  clear.addEventListener('click', () => setDue(t.id, null));
  const repeat = repeatSelect(t.repeat || '');
  repeat.addEventListener('change', () => setRepeat(t.id, repeat.value));
  editor.append(input, repeat, clear);

  chip.addEventListener('click', () => {
    const open = editor.hidden;
    editor.hidden = !open;
    chip.setAttribute('aria-expanded', String(open));
    li.classList.toggle('is-picking', open);
    if (open) input.focus();
  });
  return [chip, editor];
}

const REPEAT_SVG = '<svg class="t-rep" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/></svg>';
function repeatSelect(value) {
  const sel = el('select', 'due-input repeat-select');
  sel.setAttribute('aria-label', tx('task.repeat'));
  for (const v of ['', 'day', 'week', 'month']) {
    const o = el('option', '', tx(v ? `repeat.${v}` : 'repeat.none'));
    o.value = v;
    sel.append(o);
  }
  sel.value = value;
  return sel;
}

function markHot() {
  for (const row of groupsEl.querySelectorAll('.track')) row.classList.toggle('is-hot', row.dataset.id === hotTask);
  for (const g of groupsEl.querySelectorAll('.group')) g.classList.toggle('is-hot', !hotTask && Number(g.dataset.level) === hotLevel);
}

function editTitle(id, span) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const input = el('input', 't-edit');
  input.value = task.title;
  input.maxLength = 120;
  input.setAttribute('aria-label', tx('task.edit'));
  span.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = save => {
    if (done) return;
    done = true;
    const value = input.value.trim();
    if (save && value && value !== task.title) { task.title = value; touch(task); saveTasks(); }
    render();
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}

/* ---- Acties ---- */
function render() {
  renderSummary();
  renderTracks();
  renderFocusNow();
  scene.setTasks(tasks);
}

function setLevel(id, level) {
  const task = tasks.find(t => t.id === id);
  if (!task || task.due || task.level === level) return;
  task.level = level;
  task.levelAt = Date.now();
  touch(task);
  saveTasks();
  render();
}

function setDue(id, due) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const before = task.level;
  if (due) { task.due = due; task.level = levelForDue(due); }
  else { delete task.due; delete task.repeat; }   // herhalen kan alleen met een datum
  if (task.level !== before) task.levelAt = Date.now();
  touch(task);
  saveTasks();
  render();
}

function setRepeat(id, repeat) {
  const task = tasks.find(t => t.id === id);
  if (!task || !task.due || (task.repeat || '') === repeat) return;
  if (repeat) task.repeat = repeat; else delete task.repeat;
  touch(task);
  saveTasks();
  render();
}

// Deadlines opvolgen: elke minuut (ook over middernacht) en bij terugkeer naar het tabblad
function followDeadlines() {
  if (applyDeadlines()) { saveTasks({ notify: false }); render(); }   // afgeleid uit de datum, elk toestel rekent zelf
  else { renderTracks(); renderFocusDue(); }
  if (dayKey(Date.now()) !== statsDay) renderStats();   // nieuwe dag of week
}

let toastAction = null, toastTimer = 0;
function complete(id, row) {
  const task = tasks.find(t => t.id === id);
  if (!task || leaving.has(id)) return;
  leaving.add(id);
  row.classList.add('is-done');
  const box = row.querySelector('.t-check')?.getBoundingClientRect();
  const spot = scene.complete(id, box && box.width ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null);
  scene.cheer();
  tasks = tasks.filter(t => t.id !== id);
  let next = null;
  // Nacht na het afvinken: alleen met een echte ster, alle effecten en niet terwijl er al een nacht loopt
  const night = !task.demo && !nightBusy && !minimalFx && !reducedMotion.matches && !document.hidden;
  const wait = scene.starWait;
  if (night) scene.holdNextStar();
  if (!task.demo) {
    const now = Date.now();
    gone[id] = now;
    archive = saveArchive([{ ...task, doneAt: now }, ...archive]);
    done[id] = now;
    saveDone(done);
    recordDone(feats, task, now);
    if (skyView !== 'current' && skyView !== 'all') { skyView = 'current'; saveSkyView(skyView); }   // een nieuwe ster hoort bij deze hemel
    placeStar(sky, id, spot, true, starVisible);
    renderStats();
    const shown = Object.keys(done).filter(starVisible).length;
    if (shown % 25 === 0) scene.constellation(25);   // mijlpaal: de laatste 25 sterren vormen even een sterrenbeeld
    // herhalende taak: meteen de volgende, met de eerstvolgende datum na vandaag
    if (task.repeat && task.due) {
      const due = nextDue(task.due, task.repeat);
      next = { id: uid(), title: task.title, level: levelForDue(due), due, repeat: task.repeat, createdAt: now, updatedAt: now, levelAt: now };
      tasks.push(next);
    }
  }
  const sound = () => playDone({ level: task.level, n: totalDone(done) - 1 });
  saveTasks();
  renderSummary();
  renderFocusNow();
  renderArchive();
  scene.setTasks(tasks);
  const back = task.demo ? () => { tasks.push(task); render(); } : () => {
    if (next) { tasks = tasks.filter(t => t.id !== next.id); gone[next.id] = Date.now(); }
    restore([id]);
  };
  const toast = () => showToast(next ? tx('toast.repeat', { title: task.title, label: dueLabel(next.due) }) : tx('toast.completed', { title: task.title }), back);
  // toast en geluid wachten tot de nacht voorbij is, zodat er niets over het moment loopt
  if (night) fallNight(id, wait, sound, toast);
  else { sound(); toast(); }
  // prestaties: de laatste Nu-taak, of de hele lijst leeg
  if (!task.demo) {
    if (task.level === URGENT_LEVEL && !realTasks().some(t => t.level === URGENT_LEVEL)) recordEvent(feats, 'nuEmpty');
    if (!realTasks().length) recordEvent(feats, 'clear');
    checkFeats(true);
  }
  setTimeout(() => { leaving.delete(id); renderTracks(); }, reducedMotion.matches ? 0 : DONE_MS);
}

let nightBusy = false;
function fallNight(id, wait, sound, toast) {
  nightBusy = true;
  setTimeout(() => {
    const pts = scene.skyPoints(), star = pts.find(p => p.id === id);
    const seen = star && star.x > 0 && star.x < innerWidth && star.y > 0 && star.y < innerHeight;
    if (!seen || document.hidden) {   // ster niet in beeld (gsm, gescrold naar de lijst): gewoon verschijnen
      scene.releaseStars(true); nightBusy = false; sound(); toast(); return;
    }
    nightFall({
      star, stars: pts.filter(p => p !== star),
      onOpen() { scene.releaseStars(); sound(); },
      done() { nightBusy = false; toast(); },
    });
  }, wait);
}

// Taken uit het archief terugzetten. Een nieuwe wijzigingstijd maakt ze recenter dan het afvinken,
// dus komen ze via de synchronisatie ook op andere toestellen terug.
function restore(ids) {
  const want = new Set(ids);
  const back = archive.filter(a => want.has(a.id) && !tasks.some(t => t.id === a.id));
  if (!back.length) return 0;
  for (const a of back) {
    delete done[a.id];
    delete feats.log[a.id];
    removeStar(sky, a.id);
    const { doneAt, by, ...task } = a;
    touch(task);
    delete gone[task.id];
    tasks.push(task);
  }
  archive = saveArchive(archive.filter(a => !want.has(a.id)));
  saveDone(done);
  saveFeats(feats);
  applyDeadlines();
  saveTasks();
  render();
  renderArchive();
  renderStats();
  return back.length;
}

function undo() {
  if (!toastAction) return;
  const action = toastAction;
  toastAction = null;
  action();
  hideToast();
}

function showToast(text, action = null, label = tx('undo')) {
  toastAction = action;
  $('undo').textContent = label;
  $('undo').hidden = !action;
  $('toast-text').textContent = text;
  const toast = $('toast');
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('is-on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, TOAST_MS);
}

function hideToast() {
  const toast = $('toast');
  toast.classList.remove('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 250);
}

$('undo').addEventListener('click', undo);

/* ---- Venster: nieuwe taak ---- */
const composer = $('composer');
const composerForm = $('composer-form');
const composerTitle = $('composer-title');
const composerSubmit = $('composer-submit');
const composerOrb = $('composer-orb');
let composerLevel = DEFAULT_LEVEL, composerDue = '', closeTimer = 0;
let wheelLevel = DEFAULT_LEVEL;     // moment van het wiel, terug als de deadline gewist wordt

// Mini-orbit in het venster: een taps bolletje rond een kleine kern, in kleur en tempo van het moment
let orbRaf = 0;
function drawComposerOrbit(now) {
  const lv = LEVEL_BY_ID.get(composerLevel);
  const g = composerOrb.getContext('2d');
  const size = composerOrb.width, C = size / 2, TAU = Math.PI * 2;
  const R = size * 0.27, head = size * 0.034, span = 1.9;
  const period = Math.min(lv.period, 6);
  const a = reducedMotion.matches ? -Math.PI / 2 : (now / 1000) / period * TAU;
  g.clearRect(0, 0, size, size);
  // kern: kleine stip
  g.fillStyle = `rgba(${inkRgb()}, .2)`;
  g.beginPath();
  g.arc(C, C, size * 0.02, 0, TAU);
  g.fill();
  // baan
  g.lineWidth = size * 0.003;
  g.strokeStyle = `rgba(${inkRgb()}, .14)`;
  g.beginPath();
  g.arc(C, C, R, 0, TAU);
  g.stroke();
  // komeet: volle kop, de staart dooft langs de boog uit (conische gradient rond het midden)
  const tone = resolvedTheme() === 'dark' ? lv.dark : lv.color;
  const steps = 24, left = [], right = [];
  for (let k = 0; k <= steps; k++) {
    const p = k / steps, t = a - p * span;
    const w = head * (1 - p * 0.82);
    left.push(C + Math.cos(t) * (R + w), C + Math.sin(t) * (R + w));
    right.push(C + Math.cos(t) * (R - w), C + Math.sin(t) * (R - w));
  }
  if (g.createConicGradient) {
    const fade = g.createConicGradient(a - span, C, C);
    fade.addColorStop(0, `${tone}00`);
    fade.addColorStop(span / TAU, `${tone}f2`);
    fade.addColorStop(Math.min(1, span / TAU + 0.001), `${tone}00`);
    g.fillStyle = fade;
  } else g.fillStyle = `${tone}80`;
  g.beginPath();
  g.moveTo(left[0], left[1]);
  for (let k = 1; k <= steps; k++) g.lineTo(left[2 * k], left[2 * k + 1]);
  for (let k = steps; k >= 0; k--) g.lineTo(right[2 * k], right[2 * k + 1]);
  g.closePath();
  g.fill();
  g.fillStyle = tone;
  g.beginPath();
  g.arc(C + Math.cos(a) * R, C + Math.sin(a) * R, head, 0, TAU);
  g.fill();
  if (composer.open && !reducedMotion.matches) orbRaf = requestAnimationFrame(drawComposerOrbit);
}

function paintComposerOrb() {
  const lv = LEVEL_BY_ID.get(composerLevel);
  cancelAnimationFrame(orbRaf);
  orbRaf = requestAnimationFrame(drawComposerOrbit);
  toneNode(composer, lv);
  $('composer-level').textContent = composerDue ? tx('composer.levelDue', { level: lv.name }) : lv.name;
  for (const b of $('composer-levels').children) {
    b.setAttribute('aria-checked', String(Number(b.dataset.level) === lv.id));
    b.disabled = Boolean(composerDue);
  }
  $('composer-levels').classList.toggle('is-locked', Boolean(composerDue));
  $('due-hint').textContent = composerDue && composerRepeat ? tx('repeat.hint', { repeat: tx(`repeat.${composerRepeat}`), label: dueLabel(composerDue) })
    : composerDue ? tx('composer.hint', { label: dueLabel(composerDue), level: lv.name }) : '';
  composerOrb.classList.remove('is-swap');
  void composerOrb.offsetWidth;
  composerOrb.classList.add('is-swap');
}

function buildComposerLevels() {
  const box = $('composer-levels');
  for (const lv of LEVELS) {
    const b = el('button', 'c-level');
    b.type = 'button';
    b.dataset.level = lv.id;
    b.setAttribute('role', 'radio');
    toneNode(b, lv);
    b.append(el('span', 'orb-dot'), el('span', '', lv.name));
    b.addEventListener('click', () => { if (composerDue) return; composerLevel = wheelLevel = lv.id; paintComposerOrb(); composerTitle.focus(); });
    box.append(b);
  }
}

function openComposer(level = wheel.level) {
  clearTimeout(closeTimer);
  composer.classList.remove('is-closing');
  composerLevel = level;
  wheelLevel = level;
  composerForm.reset();
  $('due-toggle').hidden = false;
  setComposerRepeat('');
  setComposerDue('');
  composerSubmit.disabled = true;
  paintComposerOrb();
  if (!composer.open) composer.showModal();
  composerTitle.focus();
}

function closeComposer() {
  if (!composer.open || composer.classList.contains('is-closing')) return;
  if (reducedMotion.matches) { composer.close(); return; }
  composer.classList.add('is-closing');
  closeTimer = setTimeout(() => { composer.close(); composer.classList.remove('is-closing'); }, 200);
}

composerTitle.addEventListener('input', () => { composerSubmit.disabled = composerTitle.value.trim() === ''; });
composerTitle.addEventListener('keydown', e => {
  // pijltjes wisselen het moment zonder de muis
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !composerDue) {
    e.preventDefault();
    composerLevel = wheelLevel = Math.max(1, Math.min(LEVELS.length, composerLevel + (e.key === 'ArrowUp' ? -1 : 1)));
    paintComposerOrb();
  }
});
// Deadline in het venster: met een datum volgt het moment uit de datum en is de keuze vergrendeld
function setComposerDue(due) {
  composerDue = isDue(due) ? due : '';
  $('due-field').hidden = !composerDue && !$('due-toggle').hidden;
  composerLevel = composerDue ? levelForDue(composerDue) : wheelLevel;
  paintComposerOrb();
}
$('due-toggle').addEventListener('click', () => {
  $('due-toggle').hidden = true;
  $('due-field').hidden = false;
  const input = $('composer-due');
  input.min = toDue(new Date());
  input.focus();
  input.showPicker?.();
});
$('composer-due').addEventListener('change', e => setComposerDue(e.target.value));
$('due-clear').addEventListener('click', () => {
  $('composer-due').value = '';
  $('due-toggle').hidden = false;
  setComposerRepeat('');   // herhalen kan alleen met een datum
  setComposerDue('');
  composerTitle.focus();
});
// Herhalen: kies dag, week of maand; zonder datum begint de reeks vandaag
let composerRepeat = '';
function setComposerRepeat(value) {
  composerRepeat = value;
  $('composer-repeat').value = value;
  $('composer-repeat').hidden = !value;
  $('repeat-toggle').hidden = Boolean(value);
}
$('repeat-toggle').addEventListener('click', () => {
  setComposerRepeat('week');
  if (!composerDue) {
    const today = toDue(new Date());
    $('due-toggle').hidden = true;
    $('composer-due').min = today;
    $('composer-due').value = today;
    setComposerDue(today);
  } else paintComposerOrb();
  composerTitle.focus();   // Enter voegt meteen toe; de keuze staat ernaast
});
$('composer-repeat').addEventListener('change', e => { setComposerRepeat(e.target.value); paintComposerOrb(); });

$('composer-cancel').addEventListener('click', closeComposer);
composer.addEventListener('cancel', e => { e.preventDefault(); closeComposer(); });
composer.addEventListener('click', e => { if (e.target === composer) closeComposer(); });
composer.addEventListener('close', () => {
  cancelAnimationFrame(orbRaf);
  // focus alleen terug naar het wiel voor wie met het toetsenbord werkt
  if (document.documentElement.dataset.input === 'keyboard') $('wheel').querySelector('.wheel-list').focus({ preventScroll: true });
  else document.activeElement?.blur?.();
});
composerForm.addEventListener('submit', e => {
  e.preventDefault();
  const title = composerTitle.value.trim();
  if (!title) return;
  const now = Date.now();
  const task = { id: uid(), title, level: composerLevel, createdAt: now, updatedAt: now, levelAt: now };
  if (composerDue) { task.due = composerDue; task.level = levelForDue(composerDue); }
  if (composerDue && composerRepeat) task.repeat = composerRepeat;
  tasks = tasks.filter(t => !t.demo);     // je eerste eigen taak vervangt het voorbeeld
  tasks.push(task);
  saveTasks();
  render();
  wheel.setLevel(composerLevel);
  closeComposer();
});

/* ---- Aanzicht ---- */
const viewButtons = [...document.querySelectorAll('[data-view]')];
function syncViewButtons(name) {
  for (const b of viewButtons) b.setAttribute('aria-checked', String(b.dataset.view === name));
}
function setView(name) {
  scene.setView(name);
  syncViewButtons(name);
}
for (const b of viewButtons) b.addEventListener('click', () => setView(b.dataset.view));

/* ---- Tempo: normaal, zen of stil ---- */
const TEMPO_KEY = 'priority-orbit.tempo.v1';
const TEMPOS = ['normaal', 'zen', 'stil'];
const tempoButtons = [...document.querySelectorAll('[data-tempo]')];
let tempo = 'normaal';
try { const saved = localStorage.getItem(TEMPO_KEY); if (TEMPOS.includes(saved)) tempo = saved; } catch { /* geen opslag */ }
function setTempo(name) {
  tempo = name;
  scene.setTempo(name);
  for (const b of tempoButtons) b.setAttribute('aria-checked', String(b.dataset.tempo === name));
  try { localStorage.setItem(TEMPO_KEY, name); } catch { /* geen opslag */ }
}
for (const b of tempoButtons) b.addEventListener('click', () => setTempo(b.dataset.tempo));
setTempo(tempo);

/* ---- Thema: licht, donker of auto (volgt het toestel) ---- */
const THEME_KEY = 'priority-orbit.theme.v1';
const THEME_PREFS = ['light', 'dark', 'auto'];
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const themeButtons = [...document.querySelectorAll('[data-theme-pref]')];
let themePref = 'auto';
try { const saved = localStorage.getItem(THEME_KEY); if (THEME_PREFS.includes(saved)) themePref = saved; } catch { /* geen opslag */ }
const resolvedTheme = () => (themePref === 'auto' ? (systemDark.matches ? 'dark' : 'light') : themePref);
function inkRgb() { return resolvedTheme() === 'dark' ? '236, 236, 241' : '27, 27, 34'; }
function applyTheme() {
  const name = resolvedTheme();
  document.documentElement.dataset.theme = name;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', name === 'dark' ? '#0F0F12' : '#F1F1EF');
  scene.setTheme(name);
  try { renderStats(); } catch { /* bij het opstarten nog niet klaar */ }
  for (const b of themeButtons) b.setAttribute('aria-checked', String(b.dataset.themePref === themePref));
}
function setThemePref(pref) {
  themePref = pref;
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* geen opslag */ }
  applyTheme();
}
for (const b of themeButtons) b.addEventListener('click', () => setThemePref(b.dataset.themePref));
systemDark.addEventListener('change', () => { if (themePref === 'auto') applyTheme(); });
applyTheme();

/* ---- Taal: Nederlands of Engels (wisselen herlaadt de pagina) ---- */
for (const b of document.querySelectorAll('[data-lang]')) {
  b.setAttribute('aria-checked', String(b.dataset.lang === LANG));
  b.addEventListener('click', () => setLang(b.dataset.lang));
}

/* ---- Geluid bij afvinken (standaard uit) ---- */
const soundButtons = [...document.querySelectorAll('[data-sound]')];
function renderSound() { for (const b of soundButtons) b.setAttribute('aria-checked', String((b.dataset.sound === 'on') === soundOn())); }
for (const b of soundButtons) b.addEventListener('click', () => {
  const on = b.dataset.sound === 'on';
  setSound(on);
  renderSound();
  if (on) playDone({ level: wheel.level, force: true });   // meteen laten horen hoe het klinkt
});
renderSound();

/* ---- Effecten: Alle of Minimaal ---- */
// Minimaal zet alle extra effecten uit (intro, gloed, raster dat buigt en klopt, schokgolf, vallende ster,
// sterrenbeeld, spoor op de baan, lichtpuntje, vortex, sonar, muur, avondtint, bakje water, puntjestitel, fonkelende klok).
// Wat blijft: de scène zelf (ringen, kometen, kern met gezicht, sterren) en het uitfonkelen bij afvinken.
const FX_KEY = 'priority-orbit.fx.v1';
let minimalFx = false;
try { minimalFx = localStorage.getItem(FX_KEY) === 'min'; } catch { /* geen opslag */ }
const fxButtons = [...document.querySelectorAll('[data-fx]')];
function applyFx() {
  document.body.classList.toggle('is-minimal', minimalFx);
  scene.setMinimal(minimalFx);
  introTitle.setEnabled(!minimalFx);
  for (const b of fxButtons) b.setAttribute('aria-checked', String((b.dataset.fx === 'min') === minimalFx));
  if (minimalFx) fidget.stop();
  else if (document.body.classList.contains('is-focus') && desktop.matches) fidget.start();
}
for (const b of fxButtons) b.addEventListener('click', () => {
  minimalFx = b.dataset.fx === 'min';
  try { localStorage.setItem(FX_KEY, minimalFx ? 'min' : 'all'); } catch { /* geen opslag */ }
  applyFx();
  renderTracks();
});

/* ---- Demoversie: een losse kopie om nieuwe functies te proberen (zie src/demo.js) ---- */
$('demo-btn').textContent = tx(DEMO_MODE ? 'demo.leave' : 'demo.open');
$('demo-btn').addEventListener('click', () => { location.href = location.pathname + (DEMO_MODE ? '' : '?demo'); });
if (DEMO_MODE) {
  $('demo-badge').hidden = false;
  document.title = `${document.title} · ${tx('demo.badge')}`;
}

/* ---- Focusmodus ---- */
let idleTimer = 0;
const weather = createWeather($('focus-weather'));
const fidget = createFidget($('fidget'), { reducedMotion, label: m => tx(`fidget.${m}`) });   // bakje water, alleen op desktop zichtbaar
// zandloper boven het bakje (desktop): een focusblok van 15, 25 of 50 minuten; klaar = de afvinktik
const timer = createTimer($('timer'), { reducedMotion, tx, onDone(minutes) { playDone({ level: 1 }); recordFocus(feats, minutes); checkFeats(true); } });
function setFocus(on) {
  document.body.classList.toggle('is-focus', on);
  if (on) weather.start(); else weather.stop();
  if (on && desktop.matches && !minimalFx) fidget.start(); else fidget.stop();
  if (on && desktop.matches) timer.start(); else timer.stop();
  if (on && !$('greeting').hidden) hideGreeting();   // anders botst de begroeting op gsm met de klok
  $('focus-btn').setAttribute('aria-pressed', String(on));
  if (on) {
    document.documentElement.requestFullscreen?.().catch(() => {});
    bumpIdle();
  } else {
    clearTimeout(idleTimer);
    document.body.classList.remove('is-idle');
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }
  updateInsets();
  if (on) setTimeout(fitQuote, 1000);     // de scène schuift eerst naar het midden
}
function bumpIdle() {
  document.body.classList.remove('is-idle');
  clearTimeout(idleTimer);
  if (document.body.classList.contains('is-focus')) idleTimer = setTimeout(() => document.body.classList.add('is-idle'), IDLE_MS);
}
$('focus-btn').addEventListener('click', () => setFocus(!document.body.classList.contains('is-focus')));
$('focus-exit').addEventListener('click', () => setFocus(false));
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('is-focus')) setFocus(false);
});
window.addEventListener('pointermove', bumpIdle, { passive: true });
window.addEventListener('pointerdown', bumpIdle, { passive: true }); // aanraakschermen: een tik toont de knoppen weer

/* ---- Prestaties: punten, rang en een venster met alle prestaties ---- */
// Berekening in src/feats.js. Hier: ontgrendelen (met melding na een eigen actie, stil bij laden en sync), het
// rangknopje naast de teller, het venster (knop Prestaties, toets P) en de melding bovenaan.
const featsDialog = $('feats');
const DATE_SHORT = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const featQueue = [];
function checkFeats(pop) {
  const r = evaluate(feats, done, { skies: skyCuts.length });
  if (r.fresh.length) {
    const now = Date.now();
    for (const x of r.fresh) feats.unlocked[x.id] = now;
    if (pop) featQueue.push(...r.fresh);
    notifySync();
  }
  saveFeats(feats);
  renderFeatsBadge(r);
  if (featsDialog.open) renderFeats();
  if (featQueue.length) showFeatPop();
}
// vierpuntige ster met holle zijden in een ring, zoals de sterren in de hemel
const STAR4 = (() => {
  const R = 6.6, w = 0.2, p = a => `${(Math.cos(a) * R).toFixed(2)} ${(Math.sin(a) * R).toFixed(2)}`;
  let d = `M${p(-Math.PI / 2)}`;
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 2;
    d += ` Q${(Math.cos(a + Math.PI / 4) * R * w).toFixed(2)} ${(Math.sin(a + Math.PI / 4) * R * w).toFixed(2)} ${p(a + Math.PI / 2)}`;
  }
  return d + 'Z';
})();
const badgeSvg = (secret = false) => `<circle class="fb-ring" r="10.6"/>${secret ? '<text class="fb-q" y="4">?</text>' : `<path class="fb-star" d="${STAR4}"/>`}`;
function renderFeatsBadge(r = evaluate(feats, done, { skies: skyCuts.length })) {
  const b = $('feats-badge');
  b.hidden = !r.stars;
  b.innerHTML = `<svg viewBox="-12 -12 24 24" aria-hidden="true">${badgeSvg()}</svg><span>${tx('feats.badge', { rank: r.rank.name, n: r.points.toLocaleString(LOCALE) })}</span>`;
}
function renderFeats() {
  const r = evaluate(feats, done, { skies: skyCuts.length });
  $('feats-count').textContent = tx('feats.count', { a: r.earned, b: FEATS.length });
  $('feats-level').textContent = tx('feats.level', { n: r.rank.level });
  $('feats-rankname').textContent = r.rank.name;
  $('feats-rank-badge').innerHTML = badgeSvg();
  const pts = tx('feats.points', { n: r.points.toLocaleString(LOCALE) });
  $('feats-points').textContent = r.rank.next ? `${pts} · ${tx('feats.next', { n: (r.rank.next.at - r.points).toLocaleString(LOCALE), name: r.rank.next.name })}` : `${pts} · ${tx('feats.max')}`;
  $('feats-bar').style.width = `${r.rank.next ? Math.round((r.points - r.rank.from) / (r.rank.next.at - r.rank.from) * 100) : 100}%`;
  const list = $('feats-list');
  list.replaceChildren(...GROUPS.map(([g]) => {
    const items = r.list.filter(x => x.group === g);
    const sec = el('section', 'feats-group');
    const got = items.filter(x => x.at || x.value >= x.goal).length;
    const h = el('h3', 'feats-group-title', groupName(g));
    h.append(el('span', '', `${got}/${items.length}`));
    const ul = el('ul', 'feats-grid');
    for (const x of items) {
      const earned = Boolean(x.at) || x.value >= x.goal, hidden = x.secret && !earned;
      const li = el('li', `feat tier-${x.tier}${earned ? ' is-got' : ''}`);
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '-12 -12 24 24'); icon.setAttribute('class', 'feat-badge'); icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = badgeSvg(hidden);
      const body = el('div', 'feat-body');
      const name = el('p', 'feat-name', hidden ? tx('feats.secret') : x.name);
      name.append(el('span', 'feat-pts', `+${x.points}`));
      body.append(name, el('p', 'feat-desc', hidden ? tx('feats.secretDesc') : x.desc));
      if (earned) body.append(el('p', 'feat-meta', x.at ? tx('feats.got', { date: DATE_SHORT.format(x.at) }) : ''));
      else if (x.goal > 1 && !hidden) {
        const bar = el('div', 'feat-bar'), fill = el('i');
        fill.style.width = `${Math.round(x.value / x.goal * 100)}%`;
        bar.append(fill);
        body.append(bar, el('p', 'feat-meta', `${x.value.toLocaleString(LOCALE)} / ${x.goal.toLocaleString(LOCALE)}`));
      }
      li.append(icon, body);
      ul.append(li);
    }
    sec.append(h, ul);
    return sec;
  }));
}
function openFeats() {
  renderFeats();
  if (!featsDialog.open) featsDialog.showModal();
  featsDialog.querySelector('.feats-card').scrollTop = 0;
}
$('feats-btn').addEventListener('click', () => { setMenu(false); openFeats(); });
$('feats-badge').addEventListener('click', openFeats);
$('feats-close').addEventListener('click', () => featsDialog.close());
featsDialog.addEventListener('click', e => { if (e.target === featsDialog) featsDialog.close(); });

// melding bovenaan: één prestatie tegelijk, pas als de nacht na het afvinken voorbij is
let popBusy = false;
function showFeatPop() {
  if (popBusy || !featQueue.length) return;
  if (nightBusy || document.querySelector('.fx-reveal')) { setTimeout(showFeatPop, 400); return; }
  popBusy = true;
  const x = featQueue.shift(), pop = $('feat-pop');
  pop.className = `feat-pop tier-${x.tier}`;
  pop.innerHTML = `<svg class="feat-badge" viewBox="-12 -12 24 24" aria-hidden="true">${badgeSvg()}</svg><span class="feat-pop-text"><span class="feat-pop-kicker">${tx('feats.pop')}</span><span class="feat-pop-name"></span></span><span class="feat-pop-pts">+${x.points}</span>`;
  pop.querySelector('.feat-pop-name').textContent = x.name;
  pop.hidden = false;
  // net als bij een nieuwe ster: het scherm wordt nacht en alles wacht op de pil, die licht blijft staan en daarna
  // opent de dag weer vanuit de pil. Eén keer per reeks meldingen, niet met Minimaal of minder beweging.
  const spot = !minimalFx && !reducedMotion.matches && !document.hidden && Date.now() - lastSpot > 15000;
  requestAnimationFrame(() => {
    pop.classList.add('is-on');
    if (spot) {
      lastSpot = Date.now();
      pop.classList.add('is-spot');
      const r = pop.getBoundingClientRect();
      nightFall({ star: { x: r.left + r.width / 2, y: r.top + 14 + r.height / 2, r: 0 }, bloom: false, open: 2.2, end: 3.8,
        onOpen() { pop.classList.remove('is-spot'); } });
    }
  });
  setTimeout(() => {
    pop.classList.remove('is-on', 'is-spot');
    setTimeout(() => { pop.hidden = true; popBusy = false; showFeatPop(); }, 400);
  }, spot ? 5200 : 4200);
}
let lastSpot = 0;
$('feat-pop').addEventListener('click', () => openFeats());

/* ---- Toetsenbord ---- */
document.addEventListener('keydown', e => {
  if (composer.open || archiveDialog.open || syncDialog.open || introDialog.open || featsDialog.open) return;
  if (e.repeat) return;                 // ingedrukt houden herhaalt niets (anders flitst D tussen licht en donker)
  if (e.target.closest?.('input, textarea, [contenteditable]')) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'n') { e.preventDefault(); openComposer(); }
  else if (k === '1') setView('top');
  else if (k === '2') setView('side');
  else if (k === 'f') setFocus(!document.body.classList.contains('is-focus'));
  else if (k === 'z') undo();
  else if (k === 'a') openArchive();
  else if (k === 'p') openFeats();
  else if (e.key === '?') openIntro();
  else if (k === 'd') setThemePref(resolvedTheme() === 'dark' ? 'light' : 'dark');
  else if (k === 't') setTempo(TEMPOS[(TEMPOS.indexOf(tempo) + 1) % TEMPOS.length]);
  else if (e.key === 'Escape' && document.body.classList.contains('is-focus')) setFocus(false);
});

/* ---- Lay-out: de scène centreert tussen lijst en wiel ---- */
const GREET_STRIP = 62;   // px, zie .stage op gsm
function updateInsets() {
  if (!desktop.matches || document.body.classList.contains('is-focus')) {
    // gsm: onder de ringen een eigen strook voor de begroeting, zodat ze niet tegen de ringen of de knoppen botst
    scene.setInsets({ left: 0, right: 0, bottom: !desktop.matches && !document.body.classList.contains('is-focus') ? GREET_STRIP : 0 });
    return;
  }
  const left = $('tracks').getBoundingClientRect().right + 8;
  const right = innerWidth - $('wheel').getBoundingClientRect().left - 40;
  scene.setInsets({ left: Math.max(0, left), right: Math.max(0, right) });
}
window.addEventListener('resize', updateInsets);
desktop.addEventListener('change', () => { updateInsets(); renderTracks(); renderFocusNow(); });

/* ---- Archief: afgevinkt, momentopnames, export en import ---- */
const archiveDialog = $('archive');
const STAMP_DAY = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
let archiveTab = 'done';

function stamp(ts) {
  const d = new Date(ts), today = new Date();
  const days = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000);
  const day = days === 0 ? tx('stamp.today') : days === 1 ? tx('stamp.yesterday') : STAMP_DAY.format(d);
  return `${day} ${TIME_FMT.format(d)}`;
}

function archRow({ title, meta, level, action, label, disabled = false, remove = null }) {
  const li = el('li', 'arch-row');
  const dot = el('span', 'arch-dot');
  if (level) toneNode(dot, LEVEL_BY_ID.get(level)); else dot.classList.add('is-plain');
  const text = el('div', 'arch-text');
  text.append(el('span', 'arch-title', title), el('span', 'arch-meta', meta));
  const btn = el('button', 'btn-ghost arch-btn', label);
  btn.type = 'button';
  btn.disabled = disabled;
  btn.addEventListener('click', action);
  li.append(dot, text);
  if (remove) li.append(removeButton(remove));
  li.append(btn);
  return li;
}

// Definitief verwijderen in twee tikken: de eerste vraagt "Zeker?", na 3 s zonder tweede tik terug naar normaal
function removeButton(action) {
  const btn = el('button', 'arch-remove');
  btn.type = 'button';
  const label = () => { btn.textContent = tx('archive.remove'); btn.setAttribute('aria-label', tx('archive.removeLong')); btn.classList.remove('is-armed'); };
  label();
  let timer = 0;
  btn.addEventListener('click', () => {
    if (!btn.classList.contains('is-armed')) {
      btn.classList.add('is-armed');
      btn.textContent = tx('archive.sure');
      clearTimeout(timer);
      timer = setTimeout(label, 3000);
      return;
    }
    clearTimeout(timer);
    action();
  });
  return btn;
}

// Uit het archief, voorgoed. De taak blijft afgevinkt (ook op andere toestellen) en blijft meetellen bij de sterren.
function removeFromArchive(id) {
  const a = archive.find(x => x.id === id);
  archive = saveArchive(archive.filter(x => x.id !== id));
  renderArchive();
  if (a) showToast(tx('archive.removed', { title: a.title }));
}

function renderArchive() {
  if (!archiveDialog.open) return;
  for (const [tab, panel] of [['done', 'arch-done'], ['snaps', 'arch-snaps']]) {
    $(`arch-tab-${tab}`).setAttribute('aria-selected', String(archiveTab === tab));
    $(panel).hidden = archiveTab !== tab;
  }
  const doneList = $('arch-done-list');
  doneList.replaceChildren(...archive.map(a => archRow({
    title: a.title,
    meta: tx('archive.doneMeta', { level: LEVEL_BY_ID.get(a.level)?.name ?? '', when: stamp(a.doneAt) }) + (a.by === 'elders' ? tx('archive.elsewhere') : ''),
    level: a.level, label: tx('archive.restore'),
    action: () => { restore([a.id]); showToast(tx('toast.restored', { title: a.title })); },
    remove: () => removeFromArchive(a.id),
  })));
  if (!archive.length) doneList.append(el('li', 'arch-empty', tx('archive.empty')));

  const now = new Set(tasks.map(t => t.id));
  const snaps = loadSnapshots();
  const snapList = $('arch-snaps-list');
  snapList.replaceChildren(...snaps.map(sn => {
    const missing = sn.tasks.filter(t => !now.has(t.id)).length;
    return archRow({
      title: reasonText(sn.reason),
      meta: `${stamp(sn.at)} · ${tx('tasks.n', { n: sn.tasks.length })}${missing ? tx('archive.missing', { n: missing }) : tx('archive.complete')}`,
      label: missing ? tx('archive.bring', { n: missing }) : tx('archive.full'),
      disabled: !missing,
      action: () => bringBack(sn.tasks, 'restore'),
    });
  }));
  if (!snaps.length) snapList.append(el('li', 'arch-empty', tx('archive.noSnaps')));

  // Versies op de server, alleen als dit toestel gekoppeld is
  $('arch-server').hidden = !sync.code;
  const srv = $('arch-server-list');
  if (serverHistory === 'loading') srv.replaceChildren(el('li', 'arch-empty', tx('archive.loading')));
  else if (serverHistory === 'error') srv.replaceChildren(el('li', 'arch-empty', tx('archive.offline')));
  else if (Array.isArray(serverHistory)) {
    srv.replaceChildren(...serverHistory.map(h => {
      const missing = h.tasks.filter(t => !now.has(t.id)).length;
      return archRow({
        title: tx('archive.version', { v: h.v }) + (h.from ? tx('archive.from', { from: h.from }) : ''),
        meta: `${h.at ? stamp(h.at) : tx('archive.unknown')} · ${tx('tasks.n', { n: h.tasks.length })}${missing ? tx('archive.missing', { n: missing }) : tx('archive.complete')}`,
        label: missing ? tx('archive.bring', { n: missing }) : tx('archive.full'),
        disabled: !missing,
        action: () => bringBack(h.tasks, 'restoreServer'),
      });
    }));
    if (!serverHistory.length) srv.append(el('li', 'arch-empty', tx('archive.noServer')));
  }
}

let serverHistory = null;
async function loadServerHistory() {
  if (!sync.code) return;
  serverHistory = 'loading';
  renderArchive();
  try { serverHistory = await sync.history(); } catch { serverHistory = 'error'; }
  renderArchive();
}

// Ontbrekende taken uit een momentopname of export toevoegen; bestaande taken blijven onaangeroerd
// (bij een import wint wel de recentste versie van dezelfde taak)
function bringBack(list, reason, { preferNewer = false } = {}) {
  snapshot(tasks, reason);
  tasks = tasks.filter(t => !t.demo);
  let added = 0, updated = 0;
  for (const raw of list) {
    if (!isTask(raw)) continue;
    const { demo, doneAt, by, ...t } = raw;
    const cur = tasks.find(x => x.id === t.id);
    if (cur) {
      if (preferNewer && (t.updatedAt || 0) > (cur.updatedAt || 0)) { Object.assign(cur, t); updated++; }
      continue;
    }
    const task = { ...t, updatedAt: t.updatedAt ?? t.createdAt };
    touch(task);
    delete gone[task.id];
    delete done[task.id];
    removeStar(sky, task.id);
    tasks.push(task);
    added++;
  }
  const ids = new Set(tasks.map(t => t.id));
  archive = saveArchive(archive.filter(a => !ids.has(a.id)));
  saveDone(done);
  applyDeadlines();
  saveTasks({ reason });
  render();
  renderArchive();
  renderStats();
  const parts = [];
  if (added) parts.push(tx('toast.back', { n: added }));
  if (updated) parts.push(tx('toast.updated', { n: updated }));
  showToast(parts.length ? parts.join(' · ') : tx('toast.nothing'));
  return added + updated;
}

function openArchive(tab = archiveTab) {
  archiveTab = tab;
  if (!archiveDialog.open) archiveDialog.showModal();
  renderArchive();
  if (archiveTab === 'snaps') loadServerHistory();
}

$('archive-btn').addEventListener('click', () => openArchive());
$('arch-tab-done').addEventListener('click', () => { archiveTab = 'done'; renderArchive(); });
$('arch-tab-snaps').addEventListener('click', () => { archiveTab = 'snaps'; renderArchive(); loadServerHistory(); });
$('arch-close').addEventListener('click', () => archiveDialog.close());
archiveDialog.addEventListener('click', e => { if (e.target === archiveDialog) archiveDialog.close(); });

$('arch-export').addEventListener('click', () => {
  const data = { app: 'orbit', version: 1, exportedAt: new Date().toISOString(), tasks: realTasks(), archive, done };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = el('a');
  a.href = url;
  a.download = `orbit-${toDue(new Date())}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('arch-import').addEventListener('click', () => $('arch-file').click());
$('arch-file').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data?.tasks;
    if (!Array.isArray(list)) throw new Error('geen taken');
    if (Array.isArray(data.archive)) {
      const known = new Set([...tasks, ...archive].map(t => t.id));
      archive = saveArchive([...archive, ...data.archive.filter(a => isTask(a) && typeof a.doneAt === 'number' && !known.has(a.id))]);
    }
    if (data.done && typeof data.done === 'object') {
      ({ done } = mergeStates({ tasks: [], gone: {}, done, doneReset }, { tasks: [], gone: {}, done: cleanDone(data.done) }));
      saveDone(done);
      syncStars(sky, done);
    }
    bringBack(list, 'import', { preferNewer: true });
  } catch {
    showToast(tx('toast.badFile'));
  }
});

/* ---- Tabbladen houden elkaar bij ---- */
// Elke wijziging wordt meteen bewaard, dus een ander tabblad mag de opslag gewoon opnieuw inlezen
window.addEventListener('storage', e => {
  if (DEMO_MODE) return;   // de demo leest de echte opslag nooit, ook niet als een ander tabblad schrijft
  if (e.key === STORAGE_KEY || e.key === GONE_KEY) {
    const stored = loadTasks();
    if (stored) tasks = stored;
    gone = loadGone();
    applyDeadlines();
    render();
    renderArchive();
  } else if (e.key === STORE_KEYS.ARCHIVE_KEY || e.key === STORE_KEYS.SNAP_KEY) {
    archive = loadArchive();
    renderArchive();
  } else if (e.key === STATS_KEYS.DONE_KEY || e.key === STATS_KEYS.STARS_KEY || e.key === STATS_KEYS.RESET_KEY) {
    // anders overschrijft dit tabblad bij de volgende afgevinkte taak de telling van het andere
    done = loadDone(archive);
    doneReset = loadReset();
    skyCuts = loadCuts();
    sky = loadStars();
    renderStats();
  } else if (e.key === FEATS_KEY) {
    feats = loadFeats();
    checkFeats(false);
  }
});

/* ---- Synchronisatie tussen toestellen ---- */
// Koppelen gebeurt in één richting: het toestel met de QR-code verstuurt, het toestel dat scant ontvangt
// en neemt die lijst over (na een momentopname). Daarna houden ze elkaar gewoon gelijk.
const syncDialog = $('sync');
const SYNC_TEXT = { off: tx('sync.off'), connecting: tx('sync.connecting'), online: tx('sync.online'), offline: tx('sync.offline') };
const DEVICE = deviceName();

const sync = createSync({
  deviceName: DEVICE,
  getState: () => ({ tasks: realTasks(), gone, done, doneReset, skyCuts, feats }),
  applyState(state) {
    gone = { ...state.gone };
    const incoming = dropDemo(state.tasks.filter(isTask).map(t => ({ ...t })), 'demo');
    const keep = new Set(incoming.map(t => t.id));
    // Taken die hier verdwijnen omdat ze elders afgevinkt zijn: eerst een momentopname, dan naar het archief, en melden
    const lost = realTasks().filter(t => !keep.has(t.id));
    if (lost.length) {
      snapshot(tasks, 'sync');
      const now = Date.now();
      archive = saveArchive([...lost.map(t => ({ ...t, doneAt: state.gone?.[t.id] || now, by: 'elders' })), ...archive]);
      for (const t of lost) placeStar(sky, t.id, scene.complete(t.id));     // ook hier fonkelt de taak uit en blijft er een ster
    }
    // logboek van het andere toestel (een oudere versie van Orbit stuurt er geen: dan zelf aanvullen)
    done = cleanDone(state.done || done);
    doneReset = Math.max(doneReset, state.doneReset || 0);
    skyCuts = cleanCuts([...skyCuts, ...(state.skyCuts || [])]);
    saveCuts(skyCuts);
    feats = mergeFeats(feats, state.feats);
    for (const t of lost) if (!done[t.id] && (state.gone?.[t.id] || Date.now()) > doneReset) done[t.id] = state.gone?.[t.id] || Date.now();
    saveDone(done);
    saveReset(doneReset);
    syncStars(sky, done);
    renderStats();
    checkFeats(false);   // wat elders gehaald werd: stil, zonder melding
    tasks = incoming;
    applyDeadlines();
    saveTasks({ notify: false, reason: 'sync' });
    if (incoming.length < state.tasks.length) sync.changed();     // opgeruimde voorbeeldtaken ook elders weg
    render();
    renderArchive();
    if (lost.length) {
      showToast(lost.length === 1 ? tx('toast.elsewhere1', { title: lost[0].title }) : tx('toast.elsewhere', { n: lost.length }),
        () => restore(lost.map(t => t.id)), tx('toast.restore'));
    }
  },
  // Ontvanger: de lijst van de verzender vervangt de eigen lijst; eerst een momentopname
  onReceive(state) {
    snapshot(tasks, 'receive');
    // Eigen wijzigingen die nog niet bij de server waren (bv. offline toegevoegd op een al gekoppeld toestel) blijven
    const unsynced = pending.n > 0 && pending.confirmedAt > 0
      ? realTasks().filter(t => (t.updatedAt || 0) > pending.confirmedAt && !state.tasks.some(r => r.id === t.id)) : [];
    gone = { ...state.gone };
    tasks = [...dropDemo(state.tasks.filter(isTask).map(t => ({ ...t })), 'demo'), ...unsynced];
    // het logboek van beide toestellen samen: niemand verliest zijn telling
    ({ done, doneReset, skyCuts } = mergeStates({ tasks: [], gone: {}, done, doneReset, skyCuts }, { tasks, gone: {}, done: cleanDone(state.done), doneReset: state.doneReset, skyCuts: state.skyCuts }));
    saveDone(done);
    saveReset(doneReset);
    saveCuts(skyCuts);
    feats = mergeFeats(feats, state.feats);
    syncStars(sky, done);
    renderStats();
    checkFeats(false);
    // had dit toestel iets wat de verzender niet had (eigen taken of afgevinkte), dan terugsturen
    if (tasks.length !== state.tasks.length || totalDone(done) !== totalDone(cleanDone(state.done)) || doneReset !== (state.doneReset || 0)
      || skyCuts.length !== cleanCuts(state.skyCuts).length) setTimeout(() => sync.changed(), 0);
    applyDeadlines();
    saveTasks({ notify: false, reason: 'receive' });
    render();
    renderArchive();
  },
  onStatus: renderSync,
  onPair: renderPair,
  // de server bevestigde een stand: alles wat wachtte is binnen
  onPublished() { pending = { n: 0, confirmedAt: Date.now() }; savePending(); renderSync(); },
});
notifySync = () => {
  if (sync.code) { pending.n++; savePending(); renderSync(); }
  sync.changed();
};

// Welk deel van het venster zichtbaar is: 'auto' (keuze of verzenden), 'confirm' (link geopend), 'scan' (camera), 'recv'
let syncView = 'auto', pendingCode = null, showCode = false, recvCode = null;
const recv = { connect: 'todo', wait: 'todo', done: 'todo' };

const scanner = createScanner($('sync-video'), {
  onCode(text) {
    const code = codeFromText(text);
    if (!code) { scanMessage(tx('sync.notOrbitQr')); return false; }
    receiveFrom(code);
    return true;
  },
  onMessage(text, failed) {
    if (!failed) { scanMessage(text); return; }
    // geen camera: terug naar het begin, met code typen open
    syncView = 'auto';
    renderSync();
    $('sync-manual').open = true;
    $('sync-error').textContent = text;
    $('sync-error').hidden = false;
  },
});

function scanMessage(text, failed = false) {
  const msg = $('sync-scan-msg');
  msg.textContent = text;
  msg.classList.toggle('is-error', failed);
}

function receiveFrom(code) {
  recvCode = code;
  Object.assign(recv, { connect: 'active', wait: 'todo', done: 'todo' });
  $('sync-recv-msg').textContent = '';
  syncView = 'recv';
  renderSync();
  renderRecv();
  sync.start(code, { role: 'receive' });
}

function renderRecv(state = {}) {
  for (const li of $('sync-recv-steps').children) {
    const step = li.dataset.step;
    li.dataset.state = step === 'scan' ? 'done' : recv[step];
  }
  const done = recv.done === 'done';
  const stuck = recv.connect === 'fail' || recv.wait === 'fail';
  $('sync-recv-cancel').hidden = done;
  $('sync-recv-retry').hidden = !stuck;
  $('sync-recv-done').hidden = !done;
  if (state.text !== undefined) {
    $('sync-recv-msg').textContent = state.text;
    $('sync-recv-msg').classList.toggle('is-error', Boolean(state.error));
  }
}

// Stappen van het koppelen, voor verzender en ontvanger
function renderPair(e) {
  if (e.role === 'receive' && syncView === 'recv') {
    if (e.step === 'connecting') { recv.connect = 'active'; renderRecv({ text: '' }); }
    else if (e.step === 'retrying') {
      recv.connect = e.attempts >= 4 ? 'fail' : 'active';
      renderRecv({ text: serverHint(e), error: e.attempts >= 4 });
    } else if (e.step === 'waiting') {
      Object.assign(recv, { connect: 'done', wait: 'active' });
      renderRecv({ text: tx('sync.connectedWait') });
    } else if (e.step === 'timeout') {
      recv.wait = 'fail';
      renderRecv({ text: tx('sync.timeout'), error: true });
    } else if (e.step === 'done') {
      Object.assign(recv, { connect: 'done', wait: 'done', done: 'done' });
      renderRecv({ text: tx('sync.received', { n: e.count, from: e.from ? tx('sync.fromDevice', { name: e.from }) : '' }) });
    } else if (e.step === 'error') {
      recv.connect = 'fail';
      renderRecv({ text: tx('sync.error'), error: true });
    }
    return;
  }
  if (e.role === 'receive' && e.step === 'done') {
    showToast(tx('sync.receivedToast', { n: e.count, from: e.from ? tx('sync.fromDevice', { name: e.from }) : '' }));
    return;
  }
  if (e.role !== 'send') return;
  const text = $('sync-send-text'), line = $('sync-send-status');
  const set = (msg, state) => { text.textContent = msg; line.dataset.state = state; };
  if (e.step === 'connecting') set(tx('sync.serverConnecting'), 'busy');
  else if (e.step === 'retrying') set(serverHint(e), e.attempts >= 4 ? 'error' : 'busy');
  else if (e.step === 'ready') set(tx('sync.ready', { n: e.count }), 'ready');
  else if (e.step === 'received') {
    const name = e.by || tx('sync.otherDevice');
    set(tx('sync.sent', { n: e.count, name }), 'done');
    showToast(tx('sync.sentToast', { name }));
  } else if (e.step === 'error') set(tx('sync.sendFailed'), 'error');
}

function serverHint(e) {
  if (e.offline) return tx('sync.isOffline');
  if (e.attempts >= 4) return tx('sync.unreachable');
  return tx('sync.orbitConnecting');
}

function renderSync({ status, lastSync, code } = { status: sync.status, lastSync: sync.lastSync, code: sync.code }) {
  try { renderPairHint(); } catch { /* bij het opstarten nog niet klaar */ }
  const btn = $('sync-btn');
  btn.dataset.status = status;
  $('menu-btn').dataset.status = status;      // gsm: de status blijft zichtbaar als bolletje op het knopje
  // verbonden maar nog niets uitgewisseld: nog niet "gesynchroniseerd" noemen
  const text = status === 'online' && !lastSync ? tx('sync.connected') : SYNC_TEXT[status];
  // wijzigingen die nog naar de server moeten: zichtbaar tot de server ze bevestigt
  $('sync-label').textContent = code && pending.n > 0 && status !== 'online' ? `${text} · ${tx('sync.waiting', { n: pending.n })}` : text;
  btn.setAttribute('aria-label', status === 'off' ? tx('sync.pair') : tx('sync.status', { text: text.toLowerCase() }));
  const view = syncView !== 'auto' ? syncView : code ? 'on' : 'off';
  const ids = { off: 'sync-off', confirm: 'sync-confirm', scan: 'sync-scanner', recv: 'sync-recv', on: 'sync-on' };
  for (const [v, id] of Object.entries(ids)) $(id).hidden = v !== view;
  $('sync-title').textContent = { on: tx('sync.send'), scan: tx('sync.receive'), recv: tx('sync.receive'), confirm: tx('sync.receive') }[view] ?? tx('sync.pair');
  $('sync-kicker').textContent = view === 'off' ? tx('sync.once') : DEVICE;
  if (code) {
    renderQr($('sync-qr'), syncLink(code));
    $('sync-code').textContent = code;
    $('sync-code').hidden = !showCode;
    $('sync-show-code').textContent = showCode ? tx('sync.hideCode') : tx('sync.showCode');
    $('sync-show-code').setAttribute('aria-expanded', String(showCode));
    $('sync-meta').textContent = lastSync ? tx('sync.metaAt', { text: text.toLowerCase(), time: TIME_FMT.format(lastSync) }) : tx('sync.meta', { text: text.toLowerCase() });
  }
}

function syncLink(code) {
  return `${location.origin}${location.pathname}#sync=${code.replace(/-/g, '')}`;
}

// Het venster tonen; een gekoppeld toestel opent op "Versturen" en wordt dan verzender
function openSync(view = 'auto') {
  if (DEMO_MODE) { showToast(tx('demo.noSync')); return; }   // de demo koppelt nooit, anders gaat ze naar je echte lijst
  syncView = view;
  $('sync-error').hidden = true;
  if (view === 'auto' && sync.code) sync.send();
  renderSync();
  if (!syncDialog.open) syncDialog.showModal();
  const focus = { confirm: 'sync-confirm-yes', scan: 'sync-scan-cancel', recv: 'sync-recv-cancel' }[view] ?? (sync.code ? 'sync-close' : 'sync-new');
  $(focus).focus();
}

function startScan() {
  syncView = 'scan';
  scanMessage(tx('sync.aim'));
  renderSync();
  scanner.start();
}

async function copyText(text, button) {
  const label = button.textContent;
  try { await navigator.clipboard.writeText(text); button.textContent = tx('sync.copied'); }
  catch { window.prompt(tx('sync.copyPrompt'), text); }
  setTimeout(() => { button.textContent = label; }, 1500);
}

$('sync-btn').addEventListener('click', () => openSync());
$('sync-new').addEventListener('click', () => { syncView = 'auto'; sync.send(newCode()); renderSync(); $('sync-close').focus(); });
$('sync-scan').addEventListener('click', startScan);
$('sync-scan-cancel').addEventListener('click', () => { scanner.stop(); syncView = 'auto'; renderSync(); });
$('sync-join-form').addEventListener('submit', e => {
  e.preventDefault();
  const code = codeFromText($('sync-input').value.trim());     // een code of een geplakte koppellink
  if (!code) {
    $('sync-error').textContent = tx('sync.badCode');
    $('sync-error').hidden = false;
    return;
  }
  $('sync-input').value = '';
  $('sync-manual').open = false;
  receiveFrom(code);
});
// Plakken: link of code van het klembord (bv. gekopieerd in de browser op dezelfde gsm)
$('sync-paste').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    $('sync-input').value = text.trim();
    if (codeFromText(text.trim())) $('sync-join-form').requestSubmit();
  } catch { $('sync-input').focus(); }
});

// Webapp op het beginscherm (eigen opslag, los van de browser) en nog niet gekoppeld: zeg dat, met een knop
const STANDALONE = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const PAIR_HINT_KEY = 'priority-orbit.pairhint.v1';
function renderPairHint() {
  let later = false;
  try { later = localStorage.getItem(PAIR_HINT_KEY) === 'later'; } catch { /* geen opslag */ }
  $('tracks-pair').hidden = !STANDALONE || Boolean(sync.code) || later;
}
$('tracks-pair-go').addEventListener('click', () => { openSync(); $('sync-manual').open = true; });
$('tracks-pair-no').addEventListener('click', () => {
  try { localStorage.setItem(PAIR_HINT_KEY, 'later'); } catch { /* geen opslag */ }
  renderPairHint();
});

$('sync-confirm-yes').addEventListener('click', () => { const c = pendingCode; pendingCode = null; if (c) receiveFrom(c); });
$('sync-confirm-no').addEventListener('click', () => { pendingCode = null; syncDialog.close(); });
$('sync-recv-cancel').addEventListener('click', () => { sync.stop(); syncView = 'auto'; renderSync(); });
$('sync-recv-retry').addEventListener('click', () => { if (recvCode) receiveFrom(recvCode); });
$('sync-recv-done').addEventListener('click', () => syncDialog.close());
$('sync-show-code').addEventListener('click', () => { showCode = !showCode; renderSync(); });
$('sync-copy-link').addEventListener('click', e => copyText(syncLink(sync.code), e.currentTarget));
$('sync-stop').addEventListener('click', () => { showCode = false; syncView = 'auto'; sync.stop(); });
$('sync-close').addEventListener('click', () => syncDialog.close());
syncDialog.addEventListener('click', e => { if (e.target === syncDialog) syncDialog.close(); });
// Venster dicht: camera uit, niet langer verzender. Een ontvanger die nog wacht, blijft wachten op de achtergrond.
syncDialog.addEventListener('close', () => {
  scanner.stop();
  sync.endSend();
  syncView = 'auto';
  pendingCode = null;
});

// Link met #sync=CODE (ook via de gsm-camera): één tik om te ontvangen.
// Bewust geen automatische overname: anders kan iemand met een link je lijst vervangen.
function readSyncHash() {
  const m = location.hash.match(/^#sync=([0-9A-Za-z-]+)$/);
  if (!m || DEMO_MODE) return;
  history.replaceState(null, '', location.pathname + location.search);
  const code = normalizeCode(m[1]);
  if (!code) return;
  // Ook als dit toestel al met deze code gekoppeld is: wie scant, ontvangt (vroeger werd dat stil overgeslagen)
  pendingCode = code;
  openSync('confirm');
}
window.addEventListener('hashchange', readSyncHash);

/* ---- Invoermethode: toetsenbord of aanwijzer (bepaalt of focusmarkeringen zichtbaar zijn) ---- */
const setInput = kind => { document.documentElement.dataset.input = kind; };
window.addEventListener('pointerdown', () => setInput('pointer'), { capture: true, passive: true });
window.addEventListener('keydown', e => { if (!e.metaKey && !e.ctrlKey && !e.altKey) setInput('keyboard'); }, { capture: true });
// Aanraakschermen beginnen zonder focuskaders (bv. een venster dat opent via een gescande link)
if (matchMedia('(hover: none)').matches) setInput('pointer');

/* ---- Uitleg: eerste bezoek, knop Uitleg, toets ? ---- */
const introDialog = $('intro');
const INTRO_KEY = 'priority-orbit.intro.v1';
for (const lv of LEVELS) { const li = el('li', '', lv.name); toneNode(li, lv); $('intro-levels').append(li); }
const introTitle = particleTitle($('intro-title'), { reducedMotion });
function openIntro() {
  if (!introDialog.open) introDialog.showModal();
  requestAnimationFrame(() => introTitle.start());
  const card = introDialog.querySelector('.intro-card');
  card.scrollTop = 0;
  card.focus({ preventScroll: true });     // bovenaan beginnen, geen kader rond de knop
}
function closeIntro() { try { localStorage.setItem(INTRO_KEY, 'gezien'); } catch { /* geen opslag */ } introDialog.close(); }
introDialog.addEventListener('close', () => introTitle.stop());
$('intro-btn').addEventListener('click', openIntro);
$('intro-close').addEventListener('click', closeIntro);
introDialog.addEventListener('click', e => { if (e.target === introDialog) closeIntro(); });
introDialog.addEventListener('cancel', () => { try { localStorage.setItem(INTRO_KEY, 'gezien'); } catch { /* geen opslag */ } });

/* ---- Instellingen: één knopje met een paneel ---- */
// Desktop: het knopje staat linksonder en het paneel bevat aanzicht, focus, tempo, thema en de sneltoetsen;
// uitleg, archief en sync blijven rechtsboven. Gsm: het knopje staat in de kop en het paneel bevat thema, tempo,
// uitleg, archief en sync; aanzicht en focus blijven onder de scène.
const hudMenu = $('hud-menu'), menuBtn = $('menu-btn');
function setMenu(open) {
  hudMenu.classList.toggle('is-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
}
menuBtn.addEventListener('click', () => setMenu(!hudMenu.classList.contains('is-open')));
document.addEventListener('pointerdown', e => { if (!hudMenu.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && hudMenu.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); } });
document.querySelector('.hud-actions').addEventListener('click', e => { if (e.target.closest('button')) setMenu(false); });
function placeMenu() {
  const controls = document.querySelector('.controls'), actions = document.querySelector('.hud-actions');
  if (desktop.matches) {
    $('menu-view').append($('view-switch'), $('focus-btn'));
    $('menu-tempo').append($('tempo'));
    hudMenu.before(actions);
    controls.append(menuBtn, $('focus-exit'), hudMenu);
  } else {
    controls.append($('view-switch'), $('focus-btn'));
    $('menu-tempo').append($('tempo'));
    hudMenu.append(actions);
    document.querySelector('.hud-right').append(menuBtn, hudMenu);
  }
  setMenu(false);
}
desktop.addEventListener('change', placeMenu);
placeMenu();


/* ---- Begroeting: de kern zegt iets bij een bezoek (src/greet.js) ---- */
// Een grote zin onder de scène, zes seconden; de kern kijkt er even naar. Een tik of klik ergens laat hem verdwijnen.
let greetTimer = 0;
function placeGreeting() {
  if (desktop.matches) $('greeting').style.left = `${scene.centerX}px`;
  else $('greeting').style.left = '';
}
function hideGreeting() {
  clearTimeout(greetTimer);
  $('greeting').classList.remove('is-on');
  scene.lookAt(null);
  greetTimer = setTimeout(() => { $('greeting').hidden = true; }, 800);
}
function sayLine(line) {
  clearTimeout(greetTimer);
  $('greeting-text').textContent = line;
  placeGreeting();
  const node = $('greeting');
  node.hidden = false;
  requestAnimationFrame(() => node.classList.add('is-on'));
  scene.lookAt([0, 0.9]);
  setTimeout(() => scene.lookAt(null), 2200);
  greetTimer = setTimeout(hideGreeting, 6500);
  window.removeEventListener('pointerdown', hideOnTap);
  window.addEventListener('pointerdown', hideOnTap);
}
// een tik ergens laat de zin verdwijnen, behalve een tik op de kern zelf (die zegt iets nieuws of knipoogt)
function hideOnTap(e) {
  if (scene.coreAt(e.clientX, e.clientY)) return;
  window.removeEventListener('pointerdown', hideOnTap);
  hideGreeting();
}

// Hoe lang een taak al op haar moment staat (dagen); oudere taken zonder levelAt: laatste wijziging
const DAY_MS = 86400000;
const daysOn = t => Math.floor((Date.now() - (t.levelAt || t.updatedAt || t.createdAt)) / DAY_MS);
const daysLate = due => Math.round((new Date(toDue(new Date()) + 'T00:00') - new Date(due + 'T00:00')) / DAY_MS);
const levelName = id => LEVEL_BY_ID.get(id).name;
function longest(list) {
  let best = null;
  for (const t of list) if (!best || daysOn(t) > daysOn(best)) best = t;
  return best;
}

function greet() {
  if (document.body.classList.contains('is-focus') || document.querySelector('dialog[open]')) return;
  const real = realTasks();
  const today = toDue(new Date());
  const stuck = longest(real.filter(t => t.level <= 2 && !t.due && daysOn(t) >= 7));
  const dusty = longest(real.filter(t => t.level === 5 && !t.due && daysOn(t) >= 30));
  const line = greeting({
    urgent: real.filter(t => t.level === URGENT_LEVEL).length,
    total: real.length,
    overdue: real.filter(t => t.due && isOverdue(t.due)).length,
    dueToday: real.filter(t => t.due === today).length,
    stars: totalDone(done),
    stuck: stuck && { title: stuck.title, days: daysOn(stuck), level: levelName(stuck.level) },
    dusty: dusty && { title: dusty.title, days: daysOn(dusty) },
  });
  if (line) sayLine(line);
  if (line && /Dave/.test(line)) { recordEvent(feats, 'dave'); setTimeout(() => checkFeats(true), 2500); }
}

// Tik op de kern: hij zegt wat er nu het meest toe doet. Nog een tik binnen 4 s: een knipoog.
let lastCoreTap = 0;
function tapCore() {
  if (Date.now() - lastCoreTap < 4000) { lastCoreTap = 0; scene.wink(); recordEvent(feats, 'wink'); checkFeats(true); return; }
  lastCoreTap = Date.now();
  const list = tasks;
  const today = toDue(new Date());
  const byAge = (a, b) => a.createdAt - b.createdAt;
  const late = list.filter(t => t.due && isOverdue(t.due)).sort((a, b) => a.due.localeCompare(b.due))[0];
  const dueToday = list.filter(t => t.due === today).sort(byAge)[0];
  const stuck = longest(list.filter(t => t.level <= 2 && !t.due && daysOn(t) >= 2));
  const next = list.filter(t => t.level === URGENT_LEVEL).sort(byAge)[0] || list.filter(t => t.level === 2).sort(byAge)[0];
  scene.cheer(900);
  scene.sonar((late || dueToday || stuck || next)?.id ?? null);   // glyph sonar, met een echo rond de taak waarover de kern praat
  sayLine(coreLine({
    total: list.length,
    late: late && { title: late.title, days: daysLate(late.due) },
    today: dueToday && { title: dueToday.title },
    stuck: stuck && { title: stuck.title, days: daysOn(stuck), level: levelName(stuck.level) },
    next: next && { title: next.title },
  }));
}
window.addEventListener('resize', () => { if (!$('greeting').hidden) placeGreeting(); });

/* ---- Offline (sw.js) ---- */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ---- Start ---- */
buildComposerLevels();
renderClock();
setInterval(renderClock, 10000);
setInterval(followDeadlines, 60000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) followDeadlines();
  if (document.hidden) fidget.stop();
  else if (document.body.classList.contains('is-focus') && desktop.matches && !minimalFx) fidget.start();
});
updateInsets();
renderSummary();
renderTracks();
renderFocusNow();
scene.setTasks(tasks, { intro: true });
applyFx();
// Intro: een zachte cirkel vanuit de kern wist het papier weg en de ringen verschijnen van binnen naar buiten.
// Bij elk openen, behalve met Minimaal, minder beweging of een koppellink.
let revealDelay = 0;
if (!reducedMotion.matches && !minimalFx && !/^#sync=/.test(location.hash)) {
  revealDelay = 300;
  softReveal({
    center() { const r = $('scene').getBoundingClientRect(); return [r.left + scene.centerX, r.top + r.height / 2]; },
    onReveal() { scene.replayIntro(tasks); },
  });
}
renderStats();
if (new Date().getHours() === 3) recordEvent(feats, 'night');
checkFeats(false);   // bij het laden stil: wat al gehaald was, staat meteen goed
renderSync();
if (savedCode()) sync.start(savedCode());
// Webapp op het beginscherm zonder koppeling: meteen zeggen, de uitleg in de lijst staat op gsm ver onderaan
if (STANDALONE && !savedCode() && !$('tracks-pair').hidden) {
  setTimeout(() => showToast(tx('toast.standalone'), () => { openSync(); $('sync-manual').open = true; }, tx('sync.off')), 1500);
}
readSyncHash();
// Eerste bezoek (nog geen eigen taken bewaard, uitleg nooit gezien, niet via een koppellink): de uitleg tonen
{
  let seen = false;
  try { seen = localStorage.getItem(INTRO_KEY) === 'gezien'; } catch { /* geen opslag */ }
  if (!seen && lsEmptyAtStart && !syncDialog.open) setTimeout(openIntro, 900);
  else setTimeout(DEMO_MODE ? () => sayLine(tx('demo.start')) : greet, 1400 + revealDelay);   // demo: de kern zegt dat het een demo is     // na de intro van de scène; bij een eerste bezoek spreekt de uitleg
}
