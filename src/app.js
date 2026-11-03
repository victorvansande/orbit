import { DEMO_MODE } from './core/demo.js';   // als eerste: vult in de demo de tijdelijke opslag
import { LEVELS, LEVEL_BY_ID, URGENT_LEVEL, DEFAULT_LEVEL, toneNode } from './core/config.js';
import { createScene } from './scene/scene.js';
import { createWheel } from './scene/wheel.js';
import { createLegend } from './scene/legend.js';
import { isDue, levelForDue, dueLabel, isOverdue, toDue, nextDue } from './core/deadline.js';
import { createSync, newCode, normalizeCode, savedCode, mergeStates, sameState } from './sync/sync.js';
import { mirror, readMirror } from './data/backup.js';
import { setMatrix, twinkleDot } from './scene/matrix.js';
import { loadDone, saveDone, cleanDone, isFiller, totalDone, doneSummary, loadReset, saveReset, loadStars, syncStars, placeStar, removeStar, dayKey, STATS_KEYS,
  loadCuts, saveCuts, cleanCuts, loadSkyView, saveSkyView, skyPeriods, inView } from './data/stats.js';
import { QUOTES } from './focus/quotes.js';
import { createWeather } from './focus/weather.js';
import { renderQr, codeFromText, createScanner, deviceName } from './sync/pair.js';
import { canStore, storeCode, wasOffered, markOffered } from './sync/keychain.js';
import { loadArchive, saveArchive, loadArchDel, saveArchDel, mergeArchive, loadSnapshots, snapshot, lastSnapshotAt, STORE_KEYS } from './data/store.js';
import { tx, LANG, LOCALE, setLang, applyStatic, reasonText, DEMO_TITLES } from './core/i18n.js';
import { greeting, coreLine } from './scene/greet.js';
import { playDone, soundOn, setSound } from './scene/sound.js';
import { createFidget } from './focus/fidget.js';
import { createTimer, timerState, saveTimerState, TIMER_KEY } from './focus/timer.js';
import { createGlass } from './focus/glass.js';
import { FEATS, FEATS_KEY, GROUPS, groupName, loadFeats, saveFeats, mergeFeats, recordDone, recordEvent, recordFocus, backfill, purge, evaluate, revoke } from './data/feats.js';
import { softReveal, whiteBurst, smallNight, createWall } from './scene/fx.js';
import { loadRecap, saveRecap, monthKey, monthStart, monthStats, drawPoster, posterBlob, posterName } from './data/recap.js';

applyStatic();

/* ---- Instellingen ---- */
const STORAGE_KEY = 'priority-orbit.tasks.v1';
const GONE_KEY = 'priority-orbit.gone.v1';        // afgevinkte taken (id → tijdstip), nodig voor synchronisatie
const SAVED_KEY = 'priority-orbit.saved.v1';      // tijdstip van de laatste geslaagde bewaring in localStorage
const PENDING_KEY = 'priority-orbit.pending.v1';  // {n, confirmedAt}: wijzigingen die de server nog niet bevestigde
const DONE_MS = 720;          // afvinken in de lijst: vinkje, inhoud schuift weg, rij sluit zich (leaveRow), daarna opnieuw tekenen
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
let archDel = loadArchDel();                      // voorgoed uit het archief verwijderd (gaat mee met de sync)
let done = loadDone(archive);                    // logboek van afgevinkte taken, gaat mee met de sync
// Elke afgevinkte taak in het archief telt als ster; ontbreekt ze in het logboek (bv. door de vroegere "Teller op nul"),
// dan komt ze erbij. Geeft true als er iets bijkwam.
function archiveIntoDone() {
  let added = false;
  for (const a of archive) if (Number.isFinite(a.doneAt) && done[a.id] === undefined && !isFiller(a.id)) { done[a.id] = a.doneAt; added = true; }
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
if (purge(feats, isFiller)) saveFeats(feats);      // opgeruimde voorbeeldtaken en testblokken van de zandloper tellen niet (03/11/2026)
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
  onView(name) { syncViewButtons(name); setTimeout(placeLegend, 950); },
  onCore() { tapCore(); },
  onLegend(items) { showLegend(items); },
});

// Legende onder de scène (src/scene/legend.js): nummers op de bollen van een opgelichte ring, titels hieronder.
// Ze begint net onder de buitenste ring en krijgt zoveel rijen als er tot de onderrand passen (max. 5); meer taken
// schuiven traag door. Niet in de focusmodus (daar staan klok en Nu-taken onder de scène). Vervangt een zin van de kern.
const legend = createLegend($('legend'), { reducedMotion });
let legendItems = null;
// Op gsm is er onder de ringen maar plaats voor twee rijen: daar neemt de legende ook de rij Boven / Zijkant / Focus in,
// die zolang vervaagt (`body.has-legend`), zodat er vier rijen passen.
function legendWhere() {
  const mobile = !desktop.matches, lineH = mobile ? 19 : 23;
  const st = $('scene').getBoundingClientRect();
  const top = scene.ringsBottom() + (mobile ? 18 : 26);
  const bottom = mobile ? document.querySelector('.controls').getBoundingClientRect().bottom - st.top - 4 : st.height - 28;
  return { top, left: mobile ? null : scene.centerX, lineH, rows: Math.max(1, Math.min(5, Math.floor((bottom - top) / lineH))) };
}
let legendOff = 0;
function showLegend(items) {
  legendItems = items;
  clearTimeout(legendOff);
  if (!items || document.body.classList.contains('is-focus')) {
    legend.hide();
    legendOff = setTimeout(() => document.body.classList.remove('has-legend'), 260);
    return;
  }
  if (!$('greeting').hidden) hideGreeting();
  if (!desktop.matches) document.body.classList.add('has-legend');
  legend.show(items, legendWhere());
}
function placeLegend() { if (legendItems && legend.visible) legend.place(legendWhere()); }

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
    flashTimer = setTimeout(() => scene.highlight({}), 4500);   // lang genoeg om de legende te lezen (was 1,1 s, toen nog met pillen)
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
  for (const t of urgent.slice(0, max)) {
    const li = el('li');
    li.dataset.id = t.id;
    const check = el('button', 'fn-check');
    check.type = 'button';
    check.innerHTML = CHECK_SVG;
    check.setAttribute('aria-label', tx('task.check', { title: t.title }));
    check.addEventListener('click', () => complete(t.id, li));
    li.append(check, el('span', 'fn-title', t.title));
    ul.append(li);
  }
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
  try { renderRecapPill(); } catch { /* bij het opstarten nog niet klaar (recap.js wordt verderop geladen) */ }
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

// Veeg over de muur bij het openen van de details: via de regisseur, met de laagste voorrang (3). Hij wacht tot het
// podium vrij is en er geen venster, toast, pil of iets in de scène bezig is (`scene.isBusy()`: lichtpuntje, uitfonkelen,
// verse ster, sterrenbeeld, slepen), en houdt het podium zelf niet vast: neemt iets anders het podium, dan dooft hij zacht uit.
let sweepWanted = false;
function triggerWallSweep() {
  sweepWanted = true;
  whenCalm(startWallSweep, 3);
}
function startWallSweep() {
  if (!sweepWanted || $('stats-detail').hidden) return;
  if (document.querySelector('dialog[open], .feat-pop.is-on, .toast.is-on') || scene.isBusy()) { setTimeout(() => { if (sweepWanted) whenCalm(startWallSweep, 3); }, 400); return; }
  sweepWanted = false;
  scene.sweepWall();
}
function stopWallSweep() { sweepWanted = false; scene.cancelWallSweep(); }
function showStatsDetail(open) {
  $('stats-detail').hidden = !open;
  $('stats-toggle').setAttribute('aria-expanded', String(open));
  if (open) triggerWallSweep();
  else stopWallSweep();
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
const CHECK_SVG = '<svg viewBox="0 0 14 14" width="11" height="11" aria-hidden="true"><path d="M2.6 7.3l2.9 2.9 5.9-6.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TRASH_SVG = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5h10M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M12.5 4.5l-.7 9a1.5 1.5 0 0 1-1.5 1.5H5.7a1.5 1.5 0 0 1-1.5-1.5l-.7-9M6.5 7.5v4M9.5 7.5v4"/></svg>';
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
  const li = el('li', 'track');
  li.dataset.id = t.id;

  const check = el('button', 't-check');
  check.type = 'button';
  check.innerHTML = CHECK_SVG;
  check.setAttribute('aria-label', tx('task.check', { title: t.title }));
  check.addEventListener('click', () => complete(t.id, li));

  const title = el('span', 't-title', t.title);
  title.title = t.title + ' · ' + tx('task.dbl');
  title.addEventListener('dblclick', () => editTitle(t.id, title));

  const del = el('button', 't-del-btn');
  del.type = 'button';
  del.innerHTML = TRASH_SVG;
  del.setAttribute('aria-label', tx('task.delete', { title: t.title }));
  del.title = tx('task.delete', { title: t.title });
  del.addEventListener('click', e => {
    e.stopPropagation();
    deleteTask(t.id, li);
  });

  const row = el('div', 'track-row');
  row.append(title, noteButton(t, li));
  if (t.due) {
    const [chip, editor] = dueControls(t, li);
    row.append(chip);
    li.append(check, del, row, editor);
  } else {
    const [levelBtn, picker] = levelControls(t, li);
    row.append(levelBtn);
    li.append(check, del, row, picker);
  }
  li.append(notePanel(t, li));
  attachSwipe(li, row, t, del);

  li.addEventListener('pointerenter', () => scene.highlight({ task: t.id }));
  li.addEventListener('pointerleave', () => scene.highlight({}));
  return li;
}

function attachSwipe(li, row, t, del) {
  let startX = 0, startY = 0, dx = 0, locked = '', dragging = false;

  const onPointerDown = e => {
    if (e.target.closest('button, input, textarea, select')) return;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0; locked = ''; dragging = false;
  };

  const onPointerMove = e => {
    if (startX === 0 && startY === 0) return;
    const curDx = e.clientX - startX, curDy = e.clientY - startY;
    if (!locked) {
      // Voorkom dat verticaal scrollen per ongeluk als swipe wordt gezien
      if (Math.abs(curDy) > 6 && Math.abs(curDy) >= Math.abs(curDx)) {
        locked = 'v'; startX = 0; startY = 0; return;
      }
      if (Math.abs(curDx) > 10 && Math.abs(curDx) > Math.abs(curDy) * 1.5) {
        locked = 'h'; dragging = true;
        try { li.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
    }
    if (locked === 'h') {
      dx = curDx;
      e.preventDefault();
      row.style.transition = 'none';
      del.style.transition = 'none';
      const base = li.classList.contains('is-swiped') ? -36 : 0;
      let raw = base + dx;
      if (raw < -36) {
        raw = -36 + (raw - (-36)) * 0.35; // zachte elastische begrenzing
      }
      // Voorstel 1 (Victor, 31/10/2026): inspringende padding-right zodat tekst nooit over afvinkbolletje schuift
      const clamped = Math.min(0, Math.max(-48, raw));
      const pad = -clamped; // 0 tot 48 px
      row.style.transform = '';
      row.style.paddingRight = pad + 'px';
      del.style.opacity = String(Math.min(1, Math.max(0, pad / 28)));
      del.style.pointerEvents = pad >= 20 ? 'auto' : 'none';
    }
  };

  const onPointerEnd = e => {
    if (!dragging && locked !== 'h') { startX = 0; startY = 0; return; }
    try { li.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const base = li.classList.contains('is-swiped') ? -36 : 0;
    const final = base + dx;
    startX = 0; startY = 0; locked = ''; dragging = false;

    row.style.transition = 'padding-right .2s var(--ease), transform .2s var(--ease)';
    del.style.transition = 'opacity .2s var(--ease)';

    // Swipe opent enkel het prullenbakje via padding-right (geen fysieke verschuiving links)
    if (final <= -18) {
      closeAllSwiped(li);
      row.style.transform = '';
      row.style.paddingRight = '36px';
      del.style.opacity = '1';
      del.style.pointerEvents = 'auto';
      li.classList.add('is-swiped');
    } else {
      row.style.transform = '';
      row.style.paddingRight = '';
      del.style.opacity = '';
      del.style.pointerEvents = '';
      li.classList.remove('is-swiped');
    }
  };

  li.addEventListener('pointerdown', onPointerDown);
  li.addEventListener('pointermove', onPointerMove);
  li.addEventListener('pointerup', onPointerEnd);
  li.addEventListener('pointercancel', onPointerEnd);
}

function closeAllSwiped(except) {
  for (const el of groupsEl.querySelectorAll('.track.is-swiped')) {
    if (el !== except) {
      el.classList.remove('is-swiped');
      const r = el.querySelector('.track-row');
      if (r) { r.style.transition = 'transform .2s var(--ease), padding-right .2s var(--ease)'; r.style.transform = ''; r.style.paddingRight = ''; }
      const d = el.querySelector('.t-del-btn');
      if (d) { d.style.opacity = ''; d.style.pointerEvents = ''; }
    }
  }
}
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('.track.is-swiped')) closeAllSwiped();
});

// Notitie bij een taak: een icoontje naast de titel klapt eronder een tekstvak open. Enkel zichtbaar als je ze openklapt;
// een taak met notitie houdt het icoontje altijd zichtbaar, met een stip. Bewaard terwijl je typt (gaat mee met de sync en
// het archief). Ergens anders tikken klapt ze weer dicht (Victor, 29/10/2026: ze bleef op gsm permanent openstaan).
const NOTE_SVG = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M3 4.5h10M3 8h10M3 11.5h6"/></svg>';
const openNotes = new Set();   // taken waarvan de notitie openstaat (blijft open als de lijst opnieuw getekend wordt terwijl je typt)
function noteButton(t, li) {
  const btn = el('button', t.note ? 't-note-btn has-note' : 't-note-btn');
  btn.type = 'button';
  btn.innerHTML = NOTE_SVG;
  btn.setAttribute('aria-label', tx('task.note', { title: t.title }));
  btn.title = tx(t.note ? 'task.noteShow' : 'task.noteAdd');
  btn.setAttribute('aria-expanded', String(openNotes.has(t.id)));
  // een tik op het icoontje terwijl de notitie openstaat: niet eerst dichtklappen bij het verlaten van het tekstvak
  btn.addEventListener('pointerdown', () => { btn.dataset.down = '1'; setTimeout(() => { delete btn.dataset.down; }, 600); });
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
  const close = () => { openNotes.delete(t.id); panel.hidden = true; li.classList.remove('is-noting'); li.querySelector('.t-note-btn')?.setAttribute('aria-expanded', 'false'); };
  area.addEventListener('blur', () => {
    save();
    if (!area.isConnected || li.querySelector('.t-note-btn')?.dataset.down) return;   // lijst opnieuw getekend, of een tik op het icoontje (dat klapt zelf dicht)
    close();
  });
  area.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); save(); close(); }
  });
  panel.append(area);
  // opnieuw getekend terwijl je typte: verder typen in het nieuwe tekstvak; anders niet open laten staan
  if (open) requestAnimationFrame(() => {
    fitNote(area);
    const lost = !document.activeElement || document.activeElement === document.body;
    if (lost && area.isConnected) { area.focus({ preventScroll: true }); area.setSelectionRange(area.value.length, area.value.length); }
    else if (document.activeElement !== area) close();
  });
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

/* ---- Regisseur: één groot moment tegelijk ---- */
// Nacht na het afvinken, de nieuwe ster, een sterrenbeeld en een nieuwe prestatie vechten nooit om het scherm
// (Victor, 29/10/2026). Wie het podium nodig heeft, neemt het (`takeStage`, met een vangnet in ms) en geeft het terug;
// meldingen wachten (`whenCalm`) tot het vrij is, de prestatie (1) vóór de toast (2). Na het afvinken dus altijd:
// uitfonkelen, nacht en ster, sterrenbeeld, prestatiepil en toast.
let stageHolds = 0;
const stageWaiting = [];
const stageFree = () => stageHolds === 0;
function takeStage(maxMs) {
  stageHolds++;
  if (scene.sweeping) stopWallSweep();   // een groot moment gaat altijd voor de veeg over de muur
  let held = true;
  const give = () => { if (!held) return; held = false; stageHolds--; setTimeout(flushStage, 0); };
  setTimeout(give, maxMs);
  return give;
}
function whenCalm(fn, prio = 2) {
  stageWaiting.push({ fn, prio });
  stageWaiting.sort((a, b) => a.prio - b.prio);
  flushStage();
}
function flushStage() { while (stageFree() && stageWaiting.length) stageWaiting.shift().fn(); }

let toastAction = null, toastTimer = 0, lastTick = -1e9, resetToastDrag = () => {};
function deleteTask(id, li) {
  const task = tasks.find(t => t.id === id);
  if (!task || leaving.has(id)) return;
  leaving.add(id);

  const del = li.querySelector('.t-del-btn');
  if (del) del.remove();
  groupsEl.style.pointerEvents = 'none';

  const trackRow = li.querySelector('.track-row');
  const check = li.querySelector('.t-check');

  // 1. Soepele uitschuifbeweging naar links
  if (trackRow) {
    trackRow.style.transition = 'transform .18s cubic-bezier(0.4, 0, 0.2, 1)';
    trackRow.style.transform = 'translateX(-105%)';
  }
  if (check) {
    check.style.transition = 'transform .18s cubic-bezier(0.4, 0, 0.2, 1), opacity .15s ease';
    check.style.transform = 'translateX(-30px)';
    check.style.opacity = '0';
  }

  const performDelete = () => {
    // 2. Meet de posities van alle overige rijen voor verwijdering uit de DOM
    const allTracks = Array.from(groupsEl.querySelectorAll('.track')).filter(el => el !== li);
    const positions = allTracks.map(el => ({ el, top: el.getBoundingClientRect().top }));

    // vangnet: een verwijderde taak komt niet in het archief, dus eerst een momentopname (anders na 5 s onherstelbaar weg)
    if (!task.demo) snapshot(tasks, 'delete');
    tasks = tasks.filter(t => t.id !== id);
    const now = Date.now();
    if (!task.demo) {
      gone[id] = now;
      archDel[id] = now;
      saveArchDel(archDel);
    }
    saveTasks();
    renderSummary();
    renderFocusNow();
    scene.setTasks(tasks);
    $('tracks-count').textContent = String(tasks.length).padStart(2, '0');
    $('tracks-demo').hidden = !tasks.some(t => t.demo);

    const group = li.closest('.group');
    li.remove();
    if (group && !group.querySelector('.track')) group.remove();
    leaving.delete(id);

    // 3. FLIP-animatie: onderliggende rijen glijden in een enkele vloeiende beweging op hun plek
    if (!reducedMotion.matches) {
      for (const { el, top } of positions) {
        if (!el.isConnected) continue;
        const newTop = el.getBoundingClientRect().top;
        const dy = top - newTop;
        if (Math.abs(dy) > 0.5) {
          el.style.transition = 'none';
          el.style.transform = 'translateY(' + dy + 'px)';
        }
      }
      requestAnimationFrame(() => {
        for (const { el } of positions) {
          if (!el.isConnected) continue;
          el.style.transition = 'transform .28s cubic-bezier(0.4, 0, 0.2, 1)';
          el.style.transform = '';
        }
        setTimeout(() => { groupsEl.style.pointerEvents = ''; }, 300);
      });
    } else {
      groupsEl.style.pointerEvents = '';
    }
  };

  const delay = reducedMotion.matches ? 0 : 160;
  setTimeout(performDelete, delay);

  const undoDelete = () => {
    if (!task.demo) {
      delete gone[id];
      delete archDel[id];
      saveArchDel(archDel);
    }
    touch(task);
    tasks.push(task);
    saveTasks();
    render();
  };
  showToast(tx('toast.deleted', { title: task.title }), undoDelete, tx('undo'), 'del');
}

function complete(id, row) {
  const task = tasks.find(t => t.id === id);
  if (!task || leaving.has(id)) return;
  leaving.add(id);
  row.classList.add('is-done');
  leaveRow(row);
  const box = row.querySelector('.t-check, .fn-check')?.getBoundingClientRect();
  // lichtpuntje van het rondje naar de bol: niet op gsm (Victor, 02/11/2026: "heel glitchy", de lijst staat daar onder de scène)
  const spot = scene.complete(id, desktop.matches && box && box.width ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null);
  scene.cheer();
  tasks = tasks.filter(t => t.id !== id);
  let next = null;
  // Nacht na het afvinken: alleen met een echte ster, alle effecten en niet terwijl er al een nacht loopt
  const night = !task.demo && !nightBusy && !minimalFx && !reducedMotion.matches && !document.hidden;
  const wait = scene.starWait;
  if (night) scene.holdNextStar();
  // het podium: de nacht houdt het tot ze voorbij is, anders tot de nieuwe ster verschenen is
  const motion = !reducedMotion.matches && !document.hidden;
  const giveNight = night ? takeStage(wait + 6000) : null;
  if (motion && !night) takeStage(wait + (minimalFx || task.demo ? 0 : 900));
  if (!task.demo) {
    const now = Date.now();
    gone[id] = now;
    // herhalende taak: meteen de volgende, met de eerstvolgende datum na vandaag; het archief onthoudt welke (`next`),
    // zodat terugzetten die volgende weer weghaalt in plaats van de taak dubbel te zetten
    if (task.repeat && task.due) {
      const due = nextDue(task.due, task.repeat);
      next = { id: uid(), title: task.title, level: levelForDue(due), due, repeat: task.repeat, createdAt: now, updatedAt: now, levelAt: now };
      tasks.push(next);
    }
    archive = saveArchive([{ ...task, doneAt: now, ...(next ? { next: next.id } : {}) }, ...archive]);
    done[id] = now;
    saveDone(done);
    recordDone(feats, task, now);
    if (skyView !== 'current' && skyView !== 'all') { skyView = 'current'; saveSkyView(skyView); }   // een nieuwe ster hoort bij deze hemel
    placeStar(sky, id, spot, true, starVisible);
    renderStats();
    const shown = Object.keys(done).filter(starVisible).length;
    if (shown % 25 === 0) {   // mijlpaal: de laatste 25 sterren vormen even een sterrenbeeld; meldingen wachten tot het getekend is
      scene.constellation(25);
      if (motion && !minimalFx) takeStage(wait + (night ? 5000 : 3600));
    }
  }
  const sound = () => { lastTick = performance.now(); playDone({ level: task.level, n: totalDone(done) - 1 }); };
  saveTasks();
  renderSummary();
  if (!document.body.classList.contains('is-focus')) renderFocusNow();
  renderArchive();
  scene.setTasks(tasks);
  const back = task.demo ? () => { tasks.push(task); render(); } : () => {
    if (next) { tasks = tasks.filter(t => t.id !== next.id); gone[next.id] = archDel[next.id] = Date.now(); saveArchDel(archDel); }
    restore([id]);
  };
  // ongedaan maken trekt ook in wat deze taak opleverde (prestaties, gebeurtenissen; Victor koos "A")
  const gained = { unlocked: [], ev: [] };
  const undoTask = () => {
    if (gained.unlocked.length || gained.ev.length) {
      revoke(feats, gained);
      for (let i = featQueue.length - 1; i >= 0; i--) if (gained.unlocked.includes(featQueue[i].id)) featQueue.splice(i, 1);
      if (gained.unlocked.includes(popId)) hideFeatPop();
    }
    leaving.delete(id);
    back();
    if (!task.demo) { checkFeats(false); notifySync(); }
  };
  // toast en geluid wachten tot de nacht voorbij is, zodat er niets over het moment loopt; de toast wacht via de regisseur
  // voorbeeldtaak: geen ster en geen nacht (ze wordt nooit bewaard); zeg dat, anders lijkt het een fout (Victor, 02/11/2026)
  toastDone(task.demo ? tx('toast.demoDone') : next ? tx('toast.repeat', { title: task.title, label: dueLabel(next.due) }) : tx('toast.completed', { title: task.title }), undoTask);
  if (!task.demo) noteStar(id, wait);
  if (night) fallNight(id, wait, sound, giveNight);
  else sound();
  // prestaties: de laatste Nu-taak, of de hele lijst leeg
  if (!task.demo) {
    const had = new Set(Object.keys(feats.unlocked)), hadEv = new Set(Object.keys(feats.ev));
    if (task.level === URGENT_LEVEL && !realTasks().some(t => t.level === URGENT_LEVEL)) recordEvent(feats, 'nuEmpty');
    if (!realTasks().length) recordEvent(feats, 'clear');
    checkFeats(true);
    gained.unlocked = Object.keys(feats.unlocked).filter(k => !had.has(k));
    gained.ev = Object.keys(feats.ev).filter(k => !hadEv.has(k));
  }
  setTimeout(() => { leaving.delete(id); renderTracks(); renderFocusNow(); }, reducedMotion.matches ? 0 : DONE_MS);
}

// Een afgevinkte rij verlaat de lijst in drie rustige stappen (Victor, 02/11/2026: "het schuift niet mooi vlot weg"):
// 0 tot 0,3 s vult het rondje zich en tekent het vinkje (CSS .is-done), daarna schuift de inhoud weg (.is-leaving)
// en vanaf 0,4 s sluit de rij zich tot hoogte 0, zodat de rijen eronder vloeiend opschuiven in plaats van te springen.
// Was ze de laatste van haar moment, dan sluit het hele groepje (met kop) zich.
const LEAVE_SLIDE = 280, LEAVE_CLOSE = 120, LEAVE_EASE = 'cubic-bezier(.4, 0, .2, 1)';
function leaveRow(row) {
  if (reducedMotion.matches) return;
  const group = row.classList.contains('track') ? row.closest('.group') : null;
  const alone = group && ![...group.querySelectorAll('.track')].some(r => r !== row && !leaving.has(r.dataset.id));
  const target = alone ? group : row;
  setTimeout(() => {
    if (!row.isConnected) return;
    row.classList.add('is-leaving');
    setTimeout(() => {
      if (!target.isConnected) return;
      const h = target.offsetHeight;
      Object.assign(target.style, { boxSizing: 'border-box', height: h + 'px', minHeight: '0', overflow: 'hidden' });
      void target.offsetHeight;
      target.style.transition = `height .3s ${LEAVE_EASE}, margin-top .3s ${LEAVE_EASE}, border-color .2s ${LEAVE_EASE}`;
      Object.assign(target.style, { height: '0px', marginTop: '0px', borderBottomColor: 'transparent' });
    }, LEAVE_CLOSE);
  }, LEAVE_SLIDE);
}

// De nieuwe ster buiten beeld (gsm: gescrold naar de lijst): de teller fonkelt even, zodat je toch ziet dat er een ster
// bijkwam (Victor, 02/11/2026). Rechtsboven het tellertje ✦ als het in beeld is, anders de stippenteller onder de lijst.
function noteStar(id, wait) {
  if (minimalFx || reducedMotion.matches) return;
  setTimeout(() => {
    if (document.hidden) return;
    const star = scene.skyPoints().find(p => p.id === id);
    if (star && star.x > 0 && star.x < innerWidth && star.y > 0 && star.y < innerHeight) return;   // de ster zelf is te zien
    const inView = el => { if (!el || el.hidden || !el.offsetParent) return false; const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; };
    const mini = $('stat-mini');
    if (inView(mini)) { mini.classList.remove('is-twinkle'); void mini.offsetWidth; mini.classList.add('is-twinkle'); }
    else if (inView($('stat-total'))) [0, 260, 520].forEach(ms => setTimeout(() => twinkleDot($('stat-total')), ms));
  }, wait);
}

let nightBusy = false;
function fallNight(id, wait, sound, give) {
  nightBusy = true;
  const go = () => {
    // loopt er nog een verduistering (bv. de intro), dan eerst die laten eindigen: nooit twee tegelijk
    if (document.querySelector('.fx-reveal')) { setTimeout(go, 60); return; }
    const pts = scene.skyPoints(), star = pts.find(p => p.id === id);
    const seen = star && star.x > 0 && star.x < innerWidth && star.y > 0 && star.y < innerHeight;
    if (!seen || document.hidden) {   // ster niet in beeld (gsm, gescrold naar de lijst): gewoon verschijnen
      scene.releaseStars(true); nightBusy = false; sound(); setTimeout(give, 900); return;
    }
    smallNight({
      star, stars: pts.filter(p => p !== star),
      onOpen() { scene.releaseStars(); sound(); },
      done() { nightBusy = false; give(); },
    });
  };
  setTimeout(go, wait);
}

// Taken uit het archief terugzetten. Een nieuwe wijzigingstijd maakt ze recenter dan het afvinken,
// dus komen ze via de synchronisatie ook op andere toestellen terug.
// Een herhalende taak terugzetten haalt de volgende uit dezelfde reeks weg, anders stond ze er twee keer (Victor,
// 03/11/2026). De volgende is de taak die het archief onthield (`next`); bij oudere archiefregels zonder `next` (of afgevinkt
// op een ander toestel) een taak met dezelfde titel en herhaling die later aangemaakt is. Eerst een momentopname; de
// volgende krijgt een afvinkmarkering en een verwijdermarkering (`archDel`), zodat ze ook op gekoppelde toestellen verdwijnt
// zonder daar als afgevinkt te tellen. Een notitie die enkel de volgende
// had, gaat mee naar de teruggezette taak.
function successors(a) {
  if (!a.repeat) return [];
  const byId = a.next ? tasks.filter(t => t.id === a.next) : [];
  if (byId.length) return byId;
  return tasks.filter(t => t.id !== a.id && t.repeat === a.repeat && t.title === a.title && !t.demo && (t.createdAt || 0) > (a.createdAt || 0));
}
function restore(ids) {
  const want = new Set(ids);
  const back = archive.filter(a => want.has(a.id) && !tasks.some(t => t.id === a.id));
  if (!back.length) return 0;
  if (back.some(a => successors(a).length)) snapshot(tasks, 'restore');
  for (const a of back) {
    delete done[a.id];
    delete feats.log[a.id];
    removeStar(sky, a.id);
    const { doneAt, by, next, ...task } = a;
    const later = successors(a);
    if (later.length) {
      if (!task.note) task.note = later.find(t => t.note)?.note;
      if (!task.note) delete task.note;
      const drop = new Set(later.map(t => t.id)), now = Date.now();
      tasks = tasks.filter(t => !drop.has(t.id));
      for (const d of drop) { gone[d] = now; archDel[d] = now; }   // archDel: elders niet als afgevinkt tellen (geen ster)
      saveArchDel(archDel);
    }
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
  if (!toastAction && doneBatch) { undoDone(); return; }   // de toast staat nog niet in beeld
  if (!toastAction) return;
  const action = toastAction;
  toastAction = null;
  action();
  hideToast();
}

// Toasts: een toast met een knop (Ongedaan maken, Terugzetten) wordt nooit weggeduwd; een volgende wacht tot hij weg is.
// Snel na elkaar afvinken voegt samen: "Afgevinkt · 2 taken", en Ongedaan maken zet ze allemaal terug.
// Ongedaan maken (ook Z) werkt meteen na het afvinken, ook als de toast nog op de nacht en de prestatie wacht (`doneBatch`).
let toastKind = '', doneBatch = null;
const toastWaiting = [];
const toastOn = () => !$('toast').hidden && $('toast').classList.contains('is-on');
function toastDone(text, back) {
  if (doneBatch && (!doneBatch.shown || (toastKind === 'done' && toastOn()))) {
    doneBatch.backs.push(back);
    if (doneBatch.shown) showDoneToast();
    return;
  }
  const batch = doneBatch = { backs: [back], text, shown: false };
  whenCalm(() => { if (doneBatch !== batch) return; batch.shown = true; showDoneToast(); }, 2);
}
function showDoneToast() {
  const b = doneBatch;
  if (b) showToast(b.backs.length > 1 ? tx('toast.completedN', { n: b.backs.length }) : b.text, undoDone, tx('undo'), 'done');
}
function undoDone() {
  const b = doneBatch;
  doneBatch = null;
  if (b) for (const f of [...b.backs].reverse()) f();
}
function showToast(text, action = null, label = tx('undo'), kind = '') {
  if (!stageFree()) { whenCalm(() => showToast(text, action, label, kind), 2); return; }
  if (toastOn() && toastAction && !(kind && kind === toastKind)) { toastWaiting.push([text, action, label, kind]); return; }
  toastKind = kind;
  toastAction = action;
  $('undo').textContent = label;
  $('undo').hidden = !action;
  $('toast-text').textContent = text;
  const toast = $('toast');
  resetToastDrag();
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('is-on'));
  bumpIdle();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, TOAST_MS);
}

function hideToast() {
  const toast = $('toast');
  toast.classList.remove('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (toastKind === 'done') doneBatch = null;
    toast.hidden = true; toastKind = ''; toastAction = null;
    resetToastDrag();
    const next = toastWaiting.shift();
    if (next) showToast(...next);
  }, 250);
}

$('undo').addEventListener('click', undo);
$('toast').addEventListener('pointerenter', () => { if (toastOn()) clearTimeout(toastTimer); });
$('toast').addEventListener('pointerleave', () => { if (toastOn()) { clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 2000); } });

// Wegvegen (Victor, 02/11/2026: "make the notifications at the bottom dismissable by swiping them down"): de melding volgt
// de vinger of muis live naar beneden (geen transitie tijdens het slepen), los na 44 px of een snelle veeg en ze glijdt weg;
// anders veert ze terug. Omhoog geeft ze maar een klein beetje mee. Wegvegen is hetzelfde als laten verlopen: niets ongedaan.
(function swipeToast() {
  const toast = $('toast');
  let active = false, y0 = 0, dy = 0, t0 = 0, dragging = false, moved = false;
  const place = (y, fade) => {
    toast.style.transform = `translate(-50%, ${y}px)`;
    toast.style.opacity = String(fade);
  };
  const reset = () => { toast.style.transition = ''; toast.style.transform = ''; toast.style.opacity = ''; };
  const start = y => {
    if (!toastOn()) return false;
    active = true; y0 = y; dy = 0; t0 = performance.now(); dragging = false; moved = false;
    return true;
  };
  const move = y => {
    if (!active) return false;
    const d = y - y0;
    if (!dragging) {
      if (Math.abs(d) < 6) return false;
      dragging = true; moved = true;
      clearTimeout(toastTimer);
      toast.style.transition = 'none';
    }
    dy = d > 0 ? d : Math.max(-8, d * 0.25);
    place(dy, Math.max(0, 1 - Math.max(0, dy) / 120));
    return true;
  };
  const finish = () => {
    if (!active) return;
    active = false;
    if (!dragging) return;
    dragging = false;
    const fast = dy > 14 && dy / Math.max(1, performance.now() - t0) > 0.45;
    if (dy > 44 || fast) {
      if (reducedMotion.matches) { reset(); hideToast(); return; }
      toast.style.transition = 'transform .22s cubic-bezier(.4, 0, .2, 1), opacity .2s cubic-bezier(.4, 0, .2, 1)';
      place(toast.offsetHeight + 48, 0);
      hideToast();
    } else {
      toast.style.transition = 'transform .25s cubic-bezier(.4, 0, .2, 1), opacity .25s cubic-bezier(.4, 0, .2, 1)';
      toast.style.transform = ''; toast.style.opacity = '';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(hideToast, 2000);
    }
  };
  // vinger: touch-events (niet passief), zodat iOS de veeg niet overneemt om te scrollen en geen pointercancel stuurt
  toast.addEventListener('touchstart', e => { if (e.touches.length === 1) start(e.touches[0].clientY); }, { passive: true });
  toast.addEventListener('touchmove', e => {
    if (!active) return;
    if (e.touches.length !== 1) { finish(); return; }
    e.preventDefault();
    move(e.touches[0].clientY);
  }, { passive: false });
  toast.addEventListener('touchend', finish);
  toast.addEventListener('touchcancel', finish);
  // muis en pen: pointer-events
  let pid = null;
  toast.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || e.button !== 0 || !start(e.clientY)) return;
    pid = e.pointerId;
  });
  toast.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    if (move(e.clientY)) { try { toast.setPointerCapture(pid); } catch { /* ignore */ } }
  });
  const endPointer = e => { if (e.pointerId === pid) { pid = null; finish(); } };
  toast.addEventListener('pointerup', endPointer);
  toast.addEventListener('pointercancel', endPointer);
  // een veeg die op de knop begon, is geen tik op Ongedaan maken
  toast.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  resetToastDrag = reset;
})();

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
  setComposerNote(false);
  composerSubmit.disabled = true;
  // klad van de vorige keer (venster gesloten zonder toe te voegen): titel en notitie terug, zodat niets verloren gaat
  if (composerDraft && Date.now() - composerDraft.at < DRAFT_MS) {
    composerTitle.value = composerDraft.title;
    composerNote.value = composerDraft.note;
    if (composerDraft.note) setComposerNote(true, false);
    composerSubmit.disabled = composerTitle.value.trim() === '';
  }
  composerDraft = null;
  submitted = false;
  paintComposerOrb();
  if (!composer.open) composer.showModal();
  composerTitle.focus();
}

// Notitie bij een nieuwe taak: knop Notitie naast Deadline en Herhaal toont een tekstvak dat meegroeit
const composerNote = $('composer-note');
const DRAFT_MS = 30 * 60000;
let composerDraft = null, submitted = false;
function fitComposerNote() { composerNote.style.height = 'auto'; composerNote.style.height = `${composerNote.scrollHeight}px`; }
function setComposerNote(open, focus = true) {
  composerNote.hidden = !open;
  $('note-toggle').setAttribute('aria-expanded', String(open));
  if (open) { requestAnimationFrame(fitComposerNote); if (focus) composerNote.focus(); }
}
$('note-toggle').addEventListener('click', () => {
  // dichtklappen kan enkel als er nog niets in staat, anders zou je tekst onzichtbaar meegaan
  if (!composerNote.hidden && !composerNote.value.trim()) setComposerNote(false);
  else setComposerNote(true);
});
composerNote.addEventListener('input', fitComposerNote);
composerNote.addEventListener('keydown', e => {
  // Enter is een nieuwe regel; Ctrl/Cmd+Enter voegt de taak toe
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); composerForm.requestSubmit(); }
});

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
  // gesloten zonder toe te voegen: titel en notitie bewaren als klad voor de volgende keer
  if (!submitted && (composerTitle.value.trim() || composerNote.value.trim())) composerDraft = { title: composerTitle.value, note: composerNote.value, at: Date.now() };
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
  const note = composerNote.value.replace(/\s+$/, '');
  if (note.trim()) task.note = note;
  submitted = true;
  composerDraft = null;
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
// sterrenbeeld, spoor op de baan, lichtpuntje, vortex, sonar, muur, avondtint, bakje water, fonkelende klok).
// Wat blijft: de scène zelf (ringen, kometen, kern met gezicht, sterren) en het uitfonkelen bij afvinken.
const FX_KEY = 'priority-orbit.fx.v1';
let minimalFx = false;
try { minimalFx = localStorage.getItem(FX_KEY) === 'min'; } catch { /* geen opslag */ }
const fxButtons = [...document.querySelectorAll('[data-fx]')];
function applyFx() {
  document.body.classList.toggle('is-minimal', minimalFx);
  scene.setMinimal(minimalFx);
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
// Een blok telt onder zijn eindtijd (`end`, zie timer.js): twee gekoppelde toestellen met dezelfde zandloper tellen het samen
// één keer. Stil klaar (lang na het einde geopend): wel tellen, geen tik of melding.
const timer = createTimer($('timer'), {
  reducedMotion, tx,
  onDone(minutes, end, quiet) {
    recordFocus(feats, minutes, end);
    saveFeats(feats);
    notifySync();
    if (quiet) return;
    if (performance.now() - lastTick > 1500) playDone({ level: 1 });   // net afgevinkt: geen tweede tik
    setTimeout(() => checkFeats(true), 0);   // kan al bij het opstarten gebeuren, vóór de rest van de app klaar is
  },
  onChange: () => notifySync(),
});
// Op gsm staat de zandloper compact rechts in de rij Boven / Zijkant / Focus (P3, Victor, 02/11/2026), op dezelfde plek
// als het kleine glas buiten de focus; op desktop in zijn eigen vak boven het bakje
function placeTimer() {
  const el = $('timer'), row = document.querySelector('.controls');
  el.classList.toggle('is-compact', !desktop.matches);
  if (desktop.matches) { if (el.parentElement !== document.body) document.querySelector('.focus-info').before(el); }
  else if (row && el.parentElement !== row) row.append(el);
}
desktop.addEventListener('change', placeTimer);
placeTimer();
// klein glas rechtsonder buiten de focus (desktop), zolang de zandloper loopt of gepauzeerd staat; een tik opent de focus
const glass = createGlass($('glass'), { reducedMotion, tx, onOpen: () => setFocus(true), onToggle: () => timer.toggle(), onReset: () => timer.reset() });
// desktop: rechtsonder in het venster; gsm: rechts in de rij Boven / Zijkant / Focus onder de scène, naast de knop Focus
// (Victor, 02/11/2026: "op gsm geen zandloper als focus mode stopt")
function placeGlass() {
  const el = $('glass'), row = document.querySelector('.controls');
  if (desktop.matches) { if (el.parentElement !== document.body) $('timer').after(el); }
  else if (row && el.parentElement !== row) row.append(el);
  if (!document.body.classList.contains('is-focus')) glass.start(); else glass.stop();
}
desktop.addEventListener('change', placeGlass);
placeGlass();
function setFocus(on) {
  document.body.classList.toggle('is-focus', on);
  placeGlass();
  if (on) weather.start(); else weather.stop();
  if (on && desktop.matches && !minimalFx) fidget.start(); else fidget.stop();
  if (on) timer.start(); else timer.stop();   // ook op gsm (Victor, 02/11/2026: "ook op gsm moet ik kunnen focussen")
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
/* ---- Maandrecap: Poster (src/recap.js) ---- */
// Venster met de kaart van één maand (vorige / volgende), licht of donker, post of story (per toestel onthouden), Delen
// (deelmenu van het toestel, alleen waar dat met een afbeelding kan) en Bewaar als afbeelding. Te openen via de details
// van de teller, of via het pilletje "Oktober in sterren" onder de teller op de 1e tot de 5e van de maand. In de demo
// staat het pilletje er altijd, met een volle vorige maand aan voorbeeldgegevens (src/demo.js).
const recapDialog = $('recap'), recapCanvas = $('recap-canvas');
let recap = loadRecap(), recapMonth = null, recapShown = null;
// Maandwissel van november 2026 opnieuw (Victor, 01/11/2026: eerst teruggedraaid omdat hij ze niet verwachtte, daarna
// "speel de animatie de eerstvolgende keer af en reset de hemel alsof ik hem net opende in een nieuwe maand"): één keer
// per toestel wordt `turned` gewist, zodat de wissel bij dit openen speelt. De verborgen snede van de tussenversie
// (`priority-orbit.skyhide.v1`) verdwijnt. De snede zelf bestond al, dus er komt geen tweede prestatie bij.
if (!DEMO_MODE) {
  try {
    localStorage.removeItem('priority-orbit.skyhide.v1');
    if (localStorage.getItem('priority-orbit.turnagain.v1') !== '2026-11') {
      localStorage.setItem('priority-orbit.turnagain.v1', '2026-11');
      if (recap.turned === '2026-11') { delete recap.turned; saveRecap(recap); }
    }
  } catch { /* geen opslag: geen herhaling */ }
}
const monthName = d => new Intl.DateTimeFormat(LOCALE, { month: 'long' }).format(d);
const capFirst = t => t.charAt(0).toUpperCase() + t.slice(1);
const thisMonth = (now = new Date()) => monthStart(now.getFullYear(), now.getMonth());
const lastMonth = (now = new Date()) => monthStart(now.getFullYear(), now.getMonth() - 1);
const recapStats = m => monthStats(m, { done, feats, archive });
function firstStarMonth() {
  const ts = Object.values(done).filter(Number.isFinite);
  if (!ts.length) return thisMonth();
  const d = new Date(Math.min(...ts));
  return monthStart(d.getFullYear(), d.getMonth());
}
function drawRecap() {
  const st = recapShown = recapStats(recapMonth);
  const theme = recap.theme || document.documentElement.dataset.theme || 'dark', fmt = recap.fmt || 'post';
  drawPoster(recapCanvas, st, { theme, fmt, tx, locale: LOCALE });
  recapCanvas.setAttribute('aria-label', tx('recap.alt', { month: monthName(recapMonth), n: st.total }));
  $('recap-month').textContent = `${monthName(recapMonth)} ${recapMonth.getFullYear()}`;
  $('recap-next').disabled = recapMonth >= thisMonth();
  $('recap-prev').disabled = recapMonth <= firstStarMonth();
  for (const b of recapDialog.querySelectorAll('[data-recap-theme]')) b.setAttribute('aria-pressed', String(b.dataset.recapTheme === theme));
  for (const b of recapDialog.querySelectorAll('[data-recap-fmt]')) b.setAttribute('aria-pressed', String(b.dataset.recapFmt === fmt));
}
async function openRecap(month = new Date().getDate() <= 5 ? lastMonth() : thisMonth(), { born = false } = {}) {
  recapMonth = month;
  recapDialog.classList.toggle('is-born', born);   // maandwissel: het venster komt uit het licht
  if (document.fonts) { try { await document.fonts.ready; } catch { /* geen fonts */ } }
  drawRecap();
  recap.seen[monthKey(month)] = Date.now();
  saveRecap(recap);
  renderRecapPill();
  let canShare = false;
  try { canShare = Boolean(navigator.canShare?.({ files: [new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' })] })); } catch { /* geen delen */ }
  $('recap-share').hidden = !canShare;
  setMenu(false);
  if (!recapDialog.open) recapDialog.showModal();
  if (born) recapDialog.querySelector('.recap-card').focus({ preventScroll: true });   // geen focuskader op een knop na de animatie
}
// het pilletje onder de teller: op de 1e tot de 5e voor de vorige maand, zolang je die nog niet opende (in de demo altijd)
function recapDue(now = new Date()) {
  const prev = lastMonth(now);
  if (DEMO_MODE) return prev;
  if (now.getDate() > 5 || recap.seen[monthKey(prev)]) return null;
  return recapStats(prev).total ? prev : null;
}
function renderRecapPill() {
  const m = recapDue(), pill = $('recap-pill');
  pill.hidden = !m;
  if (m) { pill.textContent = capFirst(tx('recap.pill', { month: monthName(m) })); pill.dataset.month = monthKey(m); }
}
// de kern zegt het, hooguit één keer per dag: de laatste 3 dagen van de maand, en op de 1e tot de 5e (als je hem nog niet zag)
function recapLine(now = new Date()) {
  if (DEMO_MODE || recap.said === dayKey(now)) return '';
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), left = days - now.getDate();
  let line = '';
  if (left <= 2) {
    const n = recapStats(thisMonth(now)).total;
    if (n) line = left === 0 ? tx('recap.soon1', { month: monthName(now), stars: n }) : tx('recap.soon', { n: left + 1, month: monthName(now), stars: n });
  } else if (recapDue(now)) {
    line = capFirst(tx('recap.ready', { month: monthName(lastMonth(now)), stars: recapStats(lastMonth(now)).total }));
  }
  if (line) { recap.said = dayKey(now); saveRecap(recap); }
  return line;
}
async function saveRecapImage() {
  const blob = await posterBlob(recapCanvas);
  if (!blob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = posterName(recapShown);
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function shareRecap() {
  const blob = await posterBlob(recapCanvas);
  if (!blob) return;
  const file = new File([blob], posterName(recapShown), { type: 'image/png' });
  try { await navigator.share({ files: [file], title: `Orbit · ${monthName(recapMonth)} ${recapMonth.getFullYear()}` }); }
  catch (e) { if (e?.name !== 'AbortError') saveRecapImage(); }
}
$('recap-open').addEventListener('click', () => openRecap());
$('recap-pill').addEventListener('click', () => openRecap(recapDue() || lastMonth()));
$('recap-prev').addEventListener('click', () => { recapMonth = monthStart(recapMonth.getFullYear(), recapMonth.getMonth() - 1); drawRecap(); });
$('recap-next').addEventListener('click', () => { recapMonth = monthStart(recapMonth.getFullYear(), recapMonth.getMonth() + 1); drawRecap(); });
for (const b of recapDialog.querySelectorAll('[data-recap-theme]')) b.addEventListener('click', () => { recap.theme = b.dataset.recapTheme; saveRecap(recap); drawRecap(); });
for (const b of recapDialog.querySelectorAll('[data-recap-fmt]')) b.addEventListener('click', () => { recap.fmt = b.dataset.recapFmt; saveRecap(recap); drawRecap(); });
$('recap-save').addEventListener('click', saveRecapImage);
$('recap-share').addEventListener('click', shareRecap);
$('recap-close').addEventListener('click', () => recapDialog.close());
recapDialog.addEventListener('click', e => { if (e.target === recapDialog) recapDialog.close(); });
recapDialog.addEventListener('close', () => recapDialog.classList.remove('is-born'));

// ---- Maandwissel ("Zwaartekracht", gekozen door Victor, 01/11/2026) ----
// De eerste keer dat je Orbit opent in een nieuwe maand (ook als dat pas op de 3e is), per toestel één keer
// (`recap.turned`): er komt een nieuwe hemel vanaf de 1e (snede op exact het begin van de maand, dus op twee toestellen
// dezelfde en nooit dubbel), de sterren van de vorige hemel spiralen naar de kern, een zachte witte gloed, en daaruit
// opent de recap van de vorige maand. Sluit je de recap, dan zegt de kern iets als "November. Een lege hemel."
// In plaats van de gewone intro, via de regisseur. Niet over te slaan (Victor: "te belangrijk om geskipt te kunnen
// worden"): tikken en toetsen doen niets tot de recap open is. Minimaal of minder beweging: meteen de recap.
// De snede geeft de prestatie "Nieuwe hemel" (Victor, 01/11/2026), met melding na de recap. Had de vorige maand geen sterren, dan alleen de nieuwe hemel, zonder animatie of recap.
// Er wordt niets gewist: de vorige hemel staat onder Hemels. Demo: bij elk openen, en opnieuw via de details.
let turning = false, turnFeatLater = false, booted = false;
// niet over te slaan: tikken en toetsen doen niets (ook geen sneltoetsen, slepen of de intro overslaan) tot de recap open is
const HUSH_EVENTS = ['pointerdown', 'pointerup', 'click', 'keydown', 'wheel', 'touchstart'];
const hush = e => { e.preventDefault(); e.stopImmediatePropagation(); };
let hushed = false;
function setHush(on) {
  if (on === hushed) return;
  hushed = on;
  for (const ev of HUSH_EVENTS) (on ? addEventListener : removeEventListener)(ev, hush, { capture: true, passive: false });
}
const turnCuts = new Set();   // sneden van de maandwissel in deze sessie (demo: tellen mee, ook al liggen ze vóór FEATS_SINCE)
function turnDue(now = new Date()) {
  if (DEMO_MODE) return true;
  return recap.turned !== monthKey(thisMonth(now));
}
// sterren van de hemel die op het begin van deze maand eindigt (ook als de snede via de sync al binnen was)
function oldSky(ms) {
  const before = skyCuts.filter(c => c < ms);
  const from = before.length ? before[before.length - 1] : 0;
  return sky.stars.filter(st => Number.isFinite(done[st.id]) && done[st.id] >= from && done[st.id] < ms);
}
function planTurn(now = new Date()) {
  if (!turnDue(now)) return null;
  const ms = +thisMonth(now), prev = lastMonth(now);
  return { ms, prev, old: oldSky(ms), recap: recapStats(prev).total > 0 };
}
function cutMonth(plan) {
  const hadOld = Object.values(done).some(t => Number.isFinite(t) && t < plan.ms);
  if (hadOld && !skyCuts.some(c => c >= plan.ms)) {
    skyCuts = cleanCuts([...skyCuts, plan.ms]); saveCuts(skyCuts); turnCuts.add(plan.ms); notifySync();
    if (booted) checkFeats(true); else turnFeatLater = true;   // de pil wacht via de regisseur tot de recap dicht is
  }
  if (skyView !== 'current') { skyView = 'current'; saveSkyView(skyView); }
  renderStats({ quiet: true });   // de scène heeft meteen de nieuwe hemel; tijdens de wissel toont ze nog de oude
}
function turnLine() {
  const now = new Date(), month = capFirst(monthName(now));
  const n = Object.values(done).filter(t => Number.isFinite(t) && t >= +thisMonth(now)).length;
  const line = n ? tx('turn.fresh', { month, n }) : tx('turn.empty', { month });
  return DEMO_MODE ? `${line} ${tx('demo.start')}` : line;
}
function runTurn(plan, { replay = false } = {}) {
  if (!plan || turning) return false;
  if (!replay && !DEMO_MODE) { recap.turned = monthKey(thisMonth()); saveRecap(recap); }
  if (!plan.recap) { cutMonth(plan); return false; }
  turning = true;
  const give = takeStage(180000);   // geen begroeting, pil of toast tot de recap weer dicht is
  cutMonth(plan);
  recapDialog.addEventListener('close', () => {
    turning = false;
    give();
    setTimeout(() => { if (!document.querySelector('dialog[open]')) sayLine(turnLine()); }, 500);
  }, { once: true });
  setMenu(false);
  if (reducedMotion.matches || minimalFx || !plan.old.length || document.hidden) {
    scene.endTurn();
    setHush(false);
    setTimeout(() => openRecap(plan.prev), reducedMotion.matches || minimalFx ? 300 : 0);
    return true;
  }
  let opened = false;
  const open = () => { if (opened) return; opened = true; setHush(false); openRecap(plan.prev, { born: true }); };
  setHush(true);
  scene.monthTurn(plan.old, {
    onBurst() {
      whiteBurst({
        center() { const r = $('scene').getBoundingClientRect(); return [r.left + scene.centerX, r.top + r.height / 2]; },
        onPeak: open,
      });
    },
  });
  return true;
}
// demo: een vallende ster laten vallen (Victor, 02/11/2026); op gsm eerst naar boven, de scène staat boven de lijst
$('meteor-btn').hidden = !DEMO_MODE;
$('meteor-btn').addEventListener('click', () => {
  if (!desktop.matches && scrollY > 40) { scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' }); setTimeout(() => scene.meteorNow(), 600); }
  else scene.meteorNow();
});
// demo: de maandwissel opnieuw afspelen vanuit de details van de teller
$('turn-replay').hidden = !DEMO_MODE;
$('turn-replay').addEventListener('click', () => {
  if (turning) return;
  const go = () => runTurn(planTurn(), { replay: true });
  if (!desktop.matches && scrollY > 40) { scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' }); setTimeout(go, 600); }
  else go();
});

const featsDialog = $('feats');
const DATE_SHORT = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const featQueue = [];
// demo: prestaties en punten tellen enkel wat in deze demo gebeurt, zodat je altijd van 0 begint (Victor)
const FEATS_SINCE = DEMO_MODE ? Date.now() : 0;
// de automatische snede van de maandwissel telt niet als zelf een nieuwe hemel beginnen
const featsNow = () => evaluate(feats, done, { skies: skyCuts.filter(t => t >= FEATS_SINCE || turnCuts.has(t)).length, since: FEATS_SINCE });
function checkFeats(pop) {
  const r = featsNow();
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
const starPath = (R, cx = 0, cy = 0, w = 0.2) => {
  const p = a => `${(cx + Math.cos(a) * R).toFixed(2)} ${(cy + Math.sin(a) * R).toFixed(2)}`;
  let d = `M${p(-Math.PI / 2)}`;
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 2;
    d += ` Q${(cx + Math.cos(a + Math.PI / 4) * R * w).toFixed(2)} ${(cy + Math.sin(a + Math.PI / 4) * R * w).toFixed(2)} ${p(a + Math.PI / 2)}`;
  }
  return d + 'Z';
};
const STAR4 = starPath(6.6);
// T3 Fonkeling in de ring (Victor, 03/11/2026: "T3 maar dan nog steeds in een cirkel altijd"): elk niveau een eigen vorm,
// niet enkel een eigen kleur. Brons een kleine ster, zilver een volle, goud met vier sterretjes schuin eromheen, platina
// met acht (vier schuin, vier kleinere recht). Altijd binnen de ring. Zonder niveau (de rang) blijft het de volle ster.
const SPARK_D = [45, 135, 225, 315].map(a => starPath(1.9, Math.cos(a * Math.PI / 180) * 7.9, Math.sin(a * Math.PI / 180) * 7.9, 0.25));
const SPARK_A = [0, 90, 180, 270].map(a => starPath(1.15, Math.cos(a * Math.PI / 180) * 8.7, Math.sin(a * Math.PI / 180) * 8.7, 0.25));
const TIER_STAR = { bronze: starPath(5), silver: STAR4, gold: starPath(5.6), platinum: starPath(5.6) };
const badgeSvg = (secret = false, tier = null) => {
  if (secret) return '<circle class="fb-ring" r="10.6"/><text class="fb-q" y="4">?</text>';
  const sparks = tier === 'gold' ? SPARK_D : tier === 'platinum' ? [...SPARK_D, ...SPARK_A] : [];
  return `<circle class="fb-ring" r="10.6"/><path class="fb-star" d="${TIER_STAR[tier] || STAR4}"/>${sparks.map(d => `<path class="fb-spark" d="${d}"/>`).join('')}`;
};
function renderFeatsBadge(r = featsNow()) {
  const b = $('feats-badge');
  b.hidden = !r.stars;
  b.innerHTML = `<svg viewBox="-12 -12 24 24" aria-hidden="true">${badgeSvg()}</svg><span>${tx('feats.badge', { rank: r.rank.name, n: r.points.toLocaleString(LOCALE) })}</span>`;
}
function renderFeats() {
  const r = featsNow();
  $('feats-count').textContent = tx('feats.count', { a: r.earned, b: FEATS.length });
  $('feats-level').textContent = tx('feats.level', { n: r.rank.level });
  $('feats-rankname').textContent = r.rank.name;
  $('feats-rank-badge').innerHTML = badgeSvg();
  const pts = tx('feats.points', { n: r.points.toLocaleString(LOCALE) });
  $('feats-points').textContent = r.rank.next ? `${pts} · ${tx('feats.next', { n: (r.rank.next.at - r.points).toLocaleString(LOCALE), name: r.rank.next.name })}` : `${pts} · ${tx('feats.max')}`;
  $('feats-bar').style.width = `${r.rank.next ? Math.round((r.points - r.rank.from) / (r.rank.next.at - r.rank.from) * 100) : 100}%`;
  const list = $('feats-list');
  // Recent bovenaan (Victor, 01/11/2026: niet zoeken of scrollen naar wat je net behaalde): de vier laatst behaalde
  // prestaties, nieuwste eerst; minder dan een dag oud krijgt een rood stipje. Ze staan daarna ook gewoon in hun groep.
  const recent = r.list.filter(x => x.at).sort((a, b) => b.at - a.at).slice(0, RECENT_FEATS);
  const groups = GROUPS.map(([g]) => {
    const items = r.list.filter(x => x.group === g);
    const got = items.filter(x => x.at || x.value >= x.goal).length;
    return featSection(groupName(g), `${got}/${items.length}`, items);
  });
  list.replaceChildren(...(recent.length ? [featSection(tx('feats.recent'), '', recent, true)] : []), ...groups);
}
const RECENT_FEATS = 4;   // vier past zonder gat in het raster van twee kolommen
function gotLabel(at) {   // vandaag, gisteren of de datum
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / DAY_MS);
  return days === 0 ? tx('feats.gotToday') : days === 1 ? tx('feats.gotYesterday') : tx('feats.got', { date: DATE_SHORT.format(at) });
}
function featSection(title, count, items, isRecent = false) {
  const sec = el('section', `feats-group${isRecent ? ' is-recent' : ''}`);
  const h = el('h3', 'feats-group-title', title);
  h.append(el('span', '', count));
  const ul = el('ul', 'feats-grid');
  ul.append(...items.map(x => featTile(x, isRecent)));
  sec.append(h, ul);
  return sec;
}
function featTile(x, isRecent) {
  const earned = Boolean(x.at) || x.value >= x.goal, hidden = x.secret && !earned;
  const fresh = isRecent && x.at && Date.now() - x.at < DAY_MS;
  const li = el('li', `feat tier-${x.tier}${earned ? ' is-got' : ''}${fresh ? ' is-fresh' : ''}`);
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '-12 -12 24 24'); icon.setAttribute('class', 'feat-badge'); icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = badgeSvg(hidden, x.tier);
  const body = el('div', 'feat-body');
  const name = el('p', 'feat-name', hidden ? tx('feats.secret') : x.name);
  name.append(el('span', 'feat-pts', `+${x.points}`));
  body.append(name, el('p', 'feat-desc', hidden ? tx('feats.secretDesc') : x.desc));
  if (earned) body.append(el('p', 'feat-meta', x.at ? gotLabel(x.at) : ''));
  else if (x.goal > 1 && !hidden) {
    const bar = el('div', 'feat-bar'), fill = el('i');
    fill.style.width = `${Math.round(x.value / x.goal * 100)}%`;
    bar.append(fill);
    body.append(bar, el('p', 'feat-meta', `${x.value.toLocaleString(LOCALE)} / ${x.goal.toLocaleString(LOCALE)}`));
  }
  li.append(icon, body);
  return li;
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
// De regisseur bepaalt wanneer: pas als het podium vrij is (na de nacht, de ster en een sterrenbeeld), en niet zolang er
// een venster open is (anders verdwijnt de pil erachter).
const FEAT_POP_MS = 7200;
let popBusy = false, popWaiting = false, popId = null, popTimer = 0;
function showFeatPop() {
  if (popBusy || popWaiting || !featQueue.length) return;
  if (!stageFree()) { popWaiting = true; whenCalm(() => { popWaiting = false; showFeatPop(); }, 1); return; }
  if (document.querySelector('dialog[open], .fx-reveal')) { popWaiting = true; setTimeout(() => { popWaiting = false; showFeatPop(); }, 400); return; }
  popBusy = true;
  const x = featQueue.shift(), pop = $('feat-pop');
  popId = x.id;
  pop.className = `feat-pop tier-${x.tier}`;
  pop.innerHTML = `<svg class="feat-badge" viewBox="-12 -12 24 24" aria-hidden="true">${badgeSvg(false, x.tier)}</svg><span class="feat-pop-text"><span class="feat-pop-kicker">${tx('feats.pop')}</span><span class="feat-pop-name"></span></span><span class="feat-pop-pts">+${x.points}</span>`;
  pop.querySelector('.feat-pop-name').textContent = x.name;
  pop.hidden = false;
  placeFeatPop();
  requestAnimationFrame(() => { pop.classList.add('is-on'); followFeatPop(); });
  popTimer = setTimeout(hideFeatPop, FEAT_POP_MS);
}
// De melding staat midden boven de kern, niet midden op het scherm (Victor, 02/11/2026: "cleaner"). Op desktop ligt de
// kern tussen lijst en wiel; nooit buiten beeld en nooit over het merk linksboven of de hoeklabels rechtsboven: past ze
// daar niet, dan schuift ze zo weinig mogelijk opzij. Volgt de kern zolang ze in beeld is (focusmodus, venster herschalen).
function placeFeatPop() {
  const pop = $('feat-pop');
  if (pop.hidden) return;
  const w = pop.offsetWidth, m = 16, top = pop.getBoundingClientRect();
  let lo = m + w / 2, hi = innerWidth - m - w / 2;
  for (const sel of ['.brand', '.hud-right']) {   // wat bovenaan op dezelfde hoogte staat, ontwijken
    const r = document.querySelector(sel)?.getBoundingClientRect();
    if (!r || !r.width || r.bottom < top.top || r.top > top.bottom) continue;
    if (r.right < innerWidth / 2) lo = Math.max(lo, r.right + m + w / 2); else hi = Math.min(hi, r.left - m - w / 2);
  }
  const core = $('scene').getBoundingClientRect().left + scene.centerX;
  const x = lo > hi ? innerWidth / 2 : Math.min(hi, Math.max(lo, core));
  pop.style.left = `${Math.round(x)}px`;
}
function followFeatPop() {
  if ($('feat-pop').hidden) return;
  placeFeatPop();
  requestAnimationFrame(followFeatPop);
}
function hideFeatPop() {
  const pop = $('feat-pop');
  clearTimeout(popTimer);
  pop.classList.remove('is-on');
  popTimer = setTimeout(() => { pop.hidden = true; popBusy = false; popId = null; showFeatPop(); }, 450);
}
$('feat-pop').addEventListener('pointerenter', () => { if (popBusy && $('feat-pop').classList.contains('is-on')) clearTimeout(popTimer); });
$('feat-pop').addEventListener('pointerleave', () => { if (popBusy && $('feat-pop').classList.contains('is-on')) { clearTimeout(popTimer); popTimer = setTimeout(hideFeatPop, 2400); } });
$('feat-pop').addEventListener('click', () => { hideFeatPop(); openFeats(); });

/* ---- Scrollen met een venster of menu open: enkel binnen dat venster ---- */
// Anders scrolde de pagina (of de takenlijst, of het wiel) erachter mee, en op sommige toestellen bleef een lang venster
// zelf stilstaan. Muiswiel, trackpad en vinger: enkel doorlaten als er binnen het open venster iets in die richting kan
// scrollen; al de rest wordt tegengehouden. In de CSS: overscroll-behavior: contain in vensters.
function openLayer() {
  const dlg = [...document.querySelectorAll('dialog[open]')].pop();
  if (dlg) return dlg;
  const menu = document.querySelector('.hud-menu.is-open');
  return menu || null;
}
function scrollsInside(el, root, dy) {
  for (; el && el !== root.parentElement; el = el.parentElement) {
    if (el.nodeType !== 1) continue;
    const st = getComputedStyle(el);
    if (!/(auto|scroll)/.test(st.overflowY) || el.scrollHeight <= el.clientHeight + 1) continue;
    if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
  }
  return false;
}
function guardScroll(e, dy) {
  const layer = openLayer();
  if (!layer) return;
  if (layer.contains(e.target) && scrollsInside(e.target, layer, dy)) return;
  if (e.cancelable) e.preventDefault();
  e.stopPropagation();
}
addEventListener('wheel', e => guardScroll(e, e.deltaY), { capture: true, passive: false });
let touchY = 0;
addEventListener('touchstart', e => { touchY = e.touches[0]?.clientY ?? 0; }, { capture: true, passive: true });
addEventListener('touchmove', e => {
  const y = e.touches[0]?.clientY ?? touchY, dy = touchY - y;
  touchY = y;
  guardScroll(e, dy);
}, { capture: true, passive: false });

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
// .stage is op gsm 62 px hoger dan breed (zie styles.css); de ringen centreren in de stage min deze strook. Eerst de volle 62 px: dan stonden de ringen te hoog (26 px tot de kop,
// 91 px tot Boven / Zijkant / Focus; Victor, 29/10/2026). Met 26 px zakken ze 18 px en past de begroeting (twee regels)
// er nog tussen.
const GREET_INSET = 26;
function updateInsets() {
  if (!desktop.matches || document.body.classList.contains('is-focus')) {
    // gsm: onder de ringen een eigen strook voor de begroeting, zodat ze niet tegen de ringen of de knoppen botst
    scene.setInsets({ left: 0, right: 0, bottom: !desktop.matches && !document.body.classList.contains('is-focus') ? GREET_INSET : 0 });
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
  archDel[id] = Date.now();   // anders komt hij via een ander toestel terug
  saveArchDel(archDel);
  notifySync();
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
  } else if (e.key === STORE_KEYS.ARCHIVE_KEY || e.key === STORE_KEYS.ARCHDEL_KEY || e.key === STORE_KEYS.SNAP_KEY) {
    archive = loadArchive();
    archDel = loadArchDel();
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
  } else if (e.key === TIMER_KEY) {
    timer.reload();   // zandloper in een ander tabblad gestart of gepauzeerd
  }
});

/* ---- Synchronisatie tussen toestellen ---- */
// Koppelen gebeurt in één richting: het toestel met de QR-code verstuurt, het toestel dat scant ontvangt
// en neemt die lijst over (na een momentopname). Daarna houden ze elkaar gewoon gelijk.
const syncDialog = $('sync');
const SYNC_TEXT = { off: tx('sync.off'), connecting: tx('sync.connecting'), online: tx('sync.online'), offline: tx('sync.offline') };
const DEVICE = deviceName();

// zandloper van een ander toestel: recenter dan de eigen (at), dan overnemen en de timer opnieuw laten lezen
function adoptTimer(t) {
  if (!t || (t.at || 0) <= (timerState().at || 0)) return;
  if (saveTimerState(t)) timer.reload();
}
const sync = createSync({
  deviceName: DEVICE,
  getState: () => ({ tasks: realTasks(), gone, done, doneReset, skyCuts, feats, archive, archDel, timer: timerState() }),
  applyState(state) {
    gone = { ...state.gone };
    // het gedeelde archief (een oudere versie van Orbit stuurt er geen: dan blijft het eigen archief)
    if (state.archDel) archDel = saveArchDel({ ...archDel, ...state.archDel });
    if (state.archive) archive = saveArchive(state.archive.map(a => ({ ...a })));
    const incoming = dropDemo(state.tasks.filter(isTask).map(t => ({ ...t })), 'demo');
    const keep = new Set(incoming.map(t => t.id));
    // Taken die hier verdwijnen omdat ze elders afgevinkt zijn: eerst een momentopname, dan naar het archief, en melden
    // elders verwijderd (archDel) gaat niet naar het archief, maar krijgt wel eerst een momentopname: niets verdwijnt zonder spoor
    if (realTasks().some(t => !keep.has(t.id))) snapshot(tasks, 'sync');
    // opgeruimde voorbeeldtaken (elders weggehaald door dropDemo) zijn niet afgevinkt: stil weg, geen archief en geen ster
    // (Victor, 03/11/2026: zo kwamen er op 27/10 acht valse sterren en later vier valse prestaties bij)
    const demoLike = demoIds(realTasks());
    const lost = realTasks().filter(t => !keep.has(t.id) && !demoLike.has(t.id) && !state.archDel?.[t.id] && !archDel[t.id]);
    if (lost.length) {
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
    if (backfill(feats, archive)) saveFeats(feats);   // wat elders afgevinkt werd, telt ook hier mee voor de prestaties
    if (purge(feats, isFiller)) saveFeats(feats);
    adoptTimer(state.timer);
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
    // Eigen taken die de verzender niet kent (bv. een taak die je in een nieuwe webapp toevoegde vóór het koppelen): niet
    // stil overnemen (de lijst wordt vervangen, zo blijft er niets ouds of afgevinkts terugkomen), maar ook niet vergeten.
    // Ze staan in de momentopname "Voor ontvangen" en een toast biedt aan ze terug te zetten (Victor, 03/11/2026: "dit
    // moet echt waterdicht zijn"). Wat de verzender als afgevinkt of verwijderd kent, telt niet als eigen taak.
    const theirs = new Set(state.tasks.map(t => t.id));
    const known = id => theirs.has(id) || state.gone?.[id] || state.archDel?.[id] || state.done?.[id] || (state.archive || []).some(a => a.id === id);
    const leftover = realTasks().filter(t => !known(t.id) && !unsynced.includes(t) && !demoIds(realTasks()).has(t.id));
    gone = { ...state.gone };
    tasks = [...dropDemo(state.tasks.filter(isTask).map(t => ({ ...t })), 'demo'), ...unsynced];
    // het logboek van beide toestellen samen: niemand verliest zijn telling
    ({ done, doneReset, skyCuts } = mergeStates({ tasks: [], gone: {}, done, doneReset, skyCuts }, { tasks, gone: {}, done: cleanDone(state.done), doneReset: state.doneReset, skyCuts: state.skyCuts }));
    saveDone(done);
    saveReset(doneReset);
    saveCuts(skyCuts);
    feats = mergeFeats(feats, state.feats);
    adoptTimer(state.timer);
    for (const [id, t] of Object.entries(state.archDel || {})) archDel[id] = Math.max(archDel[id] || 0, t);
    saveArchDel(archDel);
    const ownArchive = archive.length;
    archive = saveArchive(mergeArchive(archive, state.archive || [], new Set(tasks.map(t => t.id)), archDel));
    if (backfill(feats, archive)) saveFeats(feats);
    if (purge(feats, isFiller)) saveFeats(feats);
    syncStars(sky, done);
    renderStats();
    checkFeats(false);
    // had dit toestel iets wat de verzender niet had (eigen taken of afgevinkte), dan terugsturen
    if (tasks.length !== state.tasks.length || totalDone(done) !== totalDone(cleanDone(state.done)) || doneReset !== (state.doneReset || 0)
      || skyCuts.length !== cleanCuts(state.skyCuts).length || archive.length !== (state.archive || []).length || ownArchive > (state.archive || []).length) setTimeout(() => sync.changed(), 0);
    applyDeadlines();
    saveTasks({ notify: false, reason: 'receive' });
    render();
    renderArchive();
    if (leftover.length) {
      showToast(tx('toast.ownLeft', { n: leftover.length }), () => {
        const now = Date.now();
        for (const t of leftover) if (!tasks.some(x => x.id === t.id)) { delete gone[t.id]; tasks.push({ ...t, updatedAt: now }); }
        applyDeadlines(); saveTasks(); render(); notifySync();
      }, tx('toast.restore'));
    }
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
    $('sync-keep-code').value = code;
    const offered = wasOffered(code);
    $('sync-keep-text').textContent = tx(offered ? 'sync.keepDone' : 'sync.keepText');
    $('sync-keep-btn').textContent = tx(offered ? 'sync.keepAgain' : 'sync.keep');
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
  const code = codeFromText($('sync-input').value.trim() || $('sync-key').value.trim());     // een code, een geplakte koppellink of de code uit de sleutelhanger
  if (!code) {
    $('sync-error').textContent = tx('sync.badCode');
    $('sync-error').hidden = false;
    return;
  }
  $('sync-input').value = ''; $('sync-key').value = '';
  $('sync-manual').open = false;
  receiveFrom(code);
});
// synccode uit de sleutelhanger: zodra het toestel het veld invult, meteen ontvangen (voorstel A)
$('sync-key').addEventListener('input', () => { if (codeFromText($('sync-key').value.trim())) $('sync-join-form').requestSubmit(); });
// synccode als wachtwoord aanbieden: Chrome en Android via de API, Safari en iOS via het formulier naar het onzichtbare kader
$('sync-keep').addEventListener('submit', async e => {
  const code = sync.code;
  if (!code) { e.preventDefault(); return; }
  $('sync-keep-code').value = code;
  markOffered(code);
  if (canStore()) { e.preventDefault(); await storeCode(code); }
  setTimeout(renderSync, 0);
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
function openIntro() {
  if (!introDialog.open) introDialog.showModal();
  const card = introDialog.querySelector('.intro-card');
  card.scrollTop = 0;
  card.focus({ preventScroll: true });     // bovenaan beginnen, geen kader rond de knop
}
function closeIntro() { try { localStorage.setItem(INTRO_KEY, 'gezien'); } catch { /* geen opslag */ } introDialog.close(); }
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
// Hooguit twee regels (Victor, 29/10/2026): past de zin niet, dan eerst tot 3 px kleiner; pas een echt lange zin krijgt meer regels
function fitGreeting() {
  const text = $('greeting-text');
  text.style.fontSize = '';
  const base = parseFloat(getComputedStyle($('greeting')).fontSize);
  for (let size = base; text.getClientRects().length > 2 && size > base - 3; size -= 0.5) text.style.fontSize = `${size - 0.5}px`;
}
function sayLine(line) {
  clearTimeout(greetTimer);
  legend.hide(); document.body.classList.remove('has-legend');   // de kern spreekt op dezelfde plek
  $('greeting-text').textContent = line;
  placeGreeting();
  $('greeting').hidden = false;
  fitGreeting();
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
  const overdueList = real.filter(t => t.due && isOverdue(t.due));
  const dueTodayList = real.filter(t => t.due === today);
  const stuck = longest(real.filter(t => t.level <= 2 && !t.due && daysOn(t) >= 7));
  const dusty = longest(real.filter(t => t.level === 5 && !t.due && daysOn(t) >= 30));
  // maandrecap: na verstreken deadlines en deadlines vandaag (die gaan voor), hooguit één keer per dag
  if (!overdueList.length && !dueTodayList.length) { const rl = recapLine(); if (rl) { sayLine(rl); return; } }
  const line = greeting({
    urgent: real.filter(t => t.level === URGENT_LEVEL).length,
    total: real.length,
    overdue: overdueList.length,
    overdueTitle: overdueList.length === 1 ? overdueList[0].title : '',
    dueToday: dueTodayList.length,
    dueTodayTitle: dueTodayList.length === 1 ? dueTodayList[0].title : '',
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
window.addEventListener('resize', () => { if (!$('greeting').hidden) { placeGreeting(); fitGreeting(); } placeLegend(); });

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
  // de maand wisselde terwijl Orbit openstond: bij terugkeren alsnog de maandwissel (niet in de demo, niet over een venster)
  if (!document.hidden && !DEMO_MODE && !turning && !document.querySelector('dialog[open]') && turnDue()) runTurn(planTurn());
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
// maandwissel bij het openen: vervangt de gewone intro (nooit via een koppellink)
const turnPlan = /^#sync=/.test(location.hash) ? null : planTurn();
const turnShow = Boolean(turnPlan?.recap);
if (turnPlan && !turnShow) runTurn(turnPlan);   // vorige maand zonder sterren: enkel de nieuwe hemel, zonder animatie
let turnAfterReveal = false;
if (!reducedMotion.matches && !minimalFx && !/^#sync=/.test(location.hash)) {
  revealDelay = 800;
  turnAfterReveal = turnShow;   // maandwissel: eerst opent de pagina zacht met de oude hemel, dan begint de zwaartekracht
  if (turnAfterReveal && turnPlan.old.length) { scene.holdTurn(turnPlan.old); setHush(true); }
  const give = takeStage(3000);   // meldingen bij het laden wachten tot de intro voorbij is
  softReveal({
    center() { const r = $('scene').getBoundingClientRect(); return [r.left + scene.centerX, r.top + r.height / 2]; },
    onReveal() { scene.replayIntro(tasks); },
    done() {
      if (!turnAfterReveal) { give(); return; }
      const hold = takeStage(2000);   // podium blijft bezet tot runTurn het overneemt: geen pil of toast ertussen
      give();
      setTimeout(() => { runTurn(turnPlan); hold(); }, 350);
    },
  });
}
document.documentElement.classList.remove('is-veiled');   // geen intro: het papier uit index.html meteen weg
renderStats();
if (turnShow && !turnAfterReveal) setTimeout(() => runTurn(turnPlan), 250);   // zonder intro: de scène bouwt op terwijl de sterren oplichten
if (new Date().getHours() === 3) recordEvent(feats, 'night');
// Eenmalig (Victor, 03/11/2026: "die achievements heb ik niet oprecht verdiend en moeten weg"): wat sinds 2 november
// ontgrendeld werd maar enkel steunde op de opgeruimde voorbeeldtaken of de testblokken van de zandloper (die nu niet meer
// meetellen), wordt ingetrokken met een markering in feats.rev, zodat ook gekoppelde toestellen het laten vallen.
try {
  if (!DEMO_MODE && localStorage.getItem('priority-orbit.fix.v1') !== '2026-11-03') {
    const since = new Date(2026, 10, 2).getTime();
    const wrong = featsNow().list.filter(x => x.at >= since && x.value < x.goal).map(x => x.id);
    if (wrong.length) { revoke(feats, { unlocked: wrong }); saveFeats(feats); setTimeout(() => notifySync(), 0); }
    localStorage.setItem('priority-orbit.fix.v1', '2026-11-03');
  }
} catch { /* geen opslag */ }
checkFeats(turnFeatLater);   // bij het laden stil: wat al gehaald was, staat meteen goed (behalve de nieuwe hemel van de maandwissel)
booted = true;
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
  if (!seen && lsEmptyAtStart && !syncDialog.open) setTimeout(openIntro, 900 + (revealDelay ? 650 : 0));
  else if (turnShow) { /* de kern spreekt na de recap */ }
  else setTimeout(DEMO_MODE ? () => sayLine(tx('demo.start')) : greet, 1400 + revealDelay);   // demo: de kern zegt dat het een demo is     // na de intro van de scène; bij een eerste bezoek spreekt de uitleg
}
