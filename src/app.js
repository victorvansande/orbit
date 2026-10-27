import { LEVELS, LEVEL_BY_ID, URGENT_LEVEL, DEFAULT_LEVEL, toneNode } from './config.js';
import { createScene } from './scene.js';
import { createWheel } from './wheel.js';
import { isDue, levelForDue, dueLabel, isOverdue, toDue } from './deadline.js';
import { createSync, newCode, normalizeCode, savedCode } from './sync.js';
import { setMatrix } from './matrix.js';
import { createWeather } from './weather.js';
import { renderQr, codeFromText, createScanner, deviceName } from './pair.js';
import { loadArchive, saveArchive, loadSnapshots, snapshot, lastSnapshotAt, STORE_KEYS } from './store.js';

/* ---- Instellingen ---- */
const STORAGE_KEY = 'priority-orbit.tasks.v1';
const GONE_KEY = 'priority-orbit.gone.v1';      // afgevinkte taken (id → tijdstip), nodig voor synchronisatie
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
function saveTasks({ notify = true, reason = 'Voor een overschrijving' } = {}) {
  const real = realTasks();
  const before = loadTasks();
  if (before) {
    const keep = new Set(real.map(t => t.id));
    const lost = before.filter(t => !keep.has(t.id) && !gone[t.id]);
    if (lost.length) snapshot(before, reason);
  }
  try {
    if (before || real.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(real));
    localStorage.setItem(GONE_KEY, JSON.stringify(gone));
  } catch { /* opslag geblokkeerd */ }
  if (notify) notifySync();
}

// Elke bewuste wijziging krijgt een nieuwe wijzigingstijd; zo wint bij synchronisatie de recentste
function touch(task) {
  task.updatedAt = Date.now();
  delete task.demo;
}

const DEMO = [
  [1, 'Huur overschrijven'], [1, 'Offerte terugsturen'],
  [2, 'Boodschappen doen'], [2, 'Planten water geven'],
  [3, 'Fiets laten herstellen'], [3, 'Cadeau voor zaterdag kopen'], [3, 'Was opvouwen'],
  [4, 'Tandarts bellen'], [4, 'Belastingaangifte invullen'],
  [5, 'Japans leren'], [5, 'Zolder opruimen'],
];
const DEMO_LEVEL = new Map(DEMO.map(([level, title]) => [title, level]));

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

let gone = loadGone();
let tasks = loadTasks();
tasks = tasks === null ? demoTasks() : dropDemo(tasks, 'Voor opruimen voorbeeldtaken');
let archive = loadArchive();
applyDeadlines();
saveTasks({ notify: false });
// Elke dag minstens één momentopname, ook als er niets misgaat
if (Date.now() - lastSnapshotAt() > 20 * 3600000) snapshot(tasks, 'Dagelijkse kopie');

// Taken met een deadline krijgen hun schil uit de datum; geeft true als er iets opschoof
function applyDeadlines() {
  let moved = false;
  for (const t of tasks) {
    if (!t.due) continue;
    const level = levelForDue(t.due);
    if (level !== t.level) { t.level = level; moved = true; }
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
});

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
const DAY_FMT = new Intl.DateTimeFormat('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' });
const TIME_FMT = new Intl.DateTimeFormat('nl-BE', { hour: '2-digit', minute: '2-digit' });

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
    ? 'Geen taken'
    : `${urgent ? urgent + ' dringend' : 'Niets dringend'} · ${total} ${total === 1 ? 'taak' : 'taken'}`;
  const parts = LEVELS.map(lv => `${countBy(lv.id)} ${lv.name}`).join(', ');
  $('scene').setAttribute('aria-label', total ? `Orbit: ${parts}` : 'Orbit: geen taken');
}

function renderClock() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  $('week').textContent = `Week ${isoWeek(now)}`;
  $('date').textContent = `${dd} · ${mm} · ${now.getFullYear()}`;
  setMatrix($('clock'), TIME_FMT.format(now));
  $('clock-date').textContent = DAY_FMT.format(now);
}

function renderFocusNow() {
  const box = $('focus-now');
  const urgent = tasks.filter(t => t.level === URGENT_LEVEL).sort((a, b) => a.createdAt - b.createdAt);
  box.replaceChildren();
  if (!urgent.length) { box.append(el('p', 'focus-calm', 'Niets dringend. Rustig aan.')); return; }
  box.append(el('p', 'focus-kicker', 'Nu'));
  const ul = el('ul');
  const max = desktop.matches ? 4 : 3;   // op gsm minder plaats onder de scène
  for (const t of urgent.slice(0, max)) ul.append(el('li', '', t.title));
  if (urgent.length > max) ul.append(el('li', 'focus-more', `en nog ${urgent.length - max}`));
  box.append(ul);
}

/* ---- Takenlijst ---- */
const CHECK_SVG = '<svg viewBox="0 0 14 14" width="11" height="11" aria-hidden="true"><path d="M2.6 7.3l2.9 2.9 5.9-6.6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const leaving = new Set();

function tone(node, lv) {
  toneNode(node, lv);
}

function renderTracks() {
  const frag = document.createDocumentFragment();
  if (!tasks.length) {
    frag.append(el('p', 'tracks-empty', desktop.matches
      ? 'Niets te doen. Kies rechts een moment om een taak toe te voegen.'
      : 'Niets te doen. Kies hierboven een moment om een taak toe te voegen.'));
  }
  for (const lv of LEVELS) {
    const own = tasks.filter(t => t.level === lv.id).sort((a, b) => a.createdAt - b.createdAt);
    if (!own.length) continue;
    const group = el('section', 'group');
    group.dataset.level = lv.id;
    tone(group, lv);
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
  check.setAttribute('aria-label', `Markeer “${t.title}” als klaar`);
  check.addEventListener('click', () => complete(t.id, li));

  const title = el('span', 't-title', t.title);
  title.title = 'Dubbelklik om aan te passen';
  title.addEventListener('dblclick', () => editTitle(t.id, title));

  li.append(check, title);
  if (t.due) li.append(...dueControls(t, li));
  else li.append(...levelControls(t, li));

  li.addEventListener('pointerenter', () => scene.highlight({ task: t.id }));
  li.addEventListener('pointerleave', () => scene.highlight({}));
  return li;
}

// Gewone taak: bolletje rechts opent een keuze van de vijf momenten
function levelControls(t, li) {
  const levelBtn = el('button', 't-level');
  levelBtn.type = 'button';
  levelBtn.setAttribute('aria-label', `Moment wijzigen, nu ${LEVEL_BY_ID.get(t.level).name}`);
  levelBtn.setAttribute('aria-expanded', 'false');
  levelBtn.append(el('span', 'orb-dot'));

  const picker = el('div', 't-picker');
  picker.hidden = true;
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', 'Kies een moment');
  for (const lv of LEVELS) {
    const opt = el('button', 't-opt');
    opt.type = 'button';
    tone(opt, lv);
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
  chip.setAttribute('aria-label', `Deadline ${dueLabel(t.due)}, wijzigen`);
  chip.setAttribute('aria-expanded', 'false');

  const editor = el('div', 't-due-edit');
  editor.hidden = true;
  const input = el('input', 'due-input');
  input.type = 'date';
  input.value = t.due;
  input.setAttribute('aria-label', 'Deadline');
  input.addEventListener('change', () => { if (isDue(input.value)) setDue(t.id, input.value); });
  const clear = el('button', 'due-clear', 'Deadline wissen');
  clear.type = 'button';
  clear.addEventListener('click', () => setDue(t.id, null));
  editor.append(input, clear);

  chip.addEventListener('click', () => {
    const open = editor.hidden;
    editor.hidden = !open;
    chip.setAttribute('aria-expanded', String(open));
    li.classList.toggle('is-picking', open);
    if (open) input.focus();
  });
  return [chip, editor];
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
  input.setAttribute('aria-label', 'Titel aanpassen');
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
  touch(task);
  saveTasks();
  render();
}

function setDue(id, due) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (due) { task.due = due; task.level = levelForDue(due); }
  else delete task.due;
  touch(task);
  saveTasks();
  render();
}

// Deadlines opvolgen: elke minuut (ook over middernacht) en bij terugkeer naar het tabblad
function followDeadlines() {
  if (applyDeadlines()) { saveTasks({ notify: false }); render(); }   // afgeleid uit de datum, elk toestel rekent zelf
  else renderTracks();
}

let toastAction = null, toastTimer = 0;
function complete(id, row) {
  const task = tasks.find(t => t.id === id);
  if (!task || leaving.has(id)) return;
  leaving.add(id);
  row.classList.add('is-done');
  scene.complete(id);
  tasks = tasks.filter(t => t.id !== id);
  if (!task.demo) {
    const now = Date.now();
    gone[id] = now;
    archive = saveArchive([{ ...task, doneAt: now }, ...archive]);
  }
  saveTasks();
  renderSummary();
  renderFocusNow();
  renderArchive();
  scene.setTasks(tasks);
  showToast(`Afgevinkt · ${task.title}`, task.demo ? () => { tasks.push(task); render(); } : () => restore([id]));
  setTimeout(() => { leaving.delete(id); renderTracks(); }, reducedMotion.matches ? 0 : DONE_MS);
}

// Taken uit het archief terugzetten. Een nieuwe wijzigingstijd maakt ze recenter dan het afvinken,
// dus komen ze via de synchronisatie ook op andere toestellen terug.
function restore(ids) {
  const want = new Set(ids);
  const back = archive.filter(a => want.has(a.id) && !tasks.some(t => t.id === a.id));
  if (!back.length) return 0;
  for (const a of back) {
    const { doneAt, by, ...task } = a;
    touch(task);
    delete gone[task.id];
    tasks.push(task);
  }
  archive = saveArchive(archive.filter(a => !want.has(a.id)));
  applyDeadlines();
  saveTasks();
  render();
  renderArchive();
  return back.length;
}

function undo() {
  if (!toastAction) return;
  const action = toastAction;
  toastAction = null;
  action();
  hideToast();
}

function showToast(text, action = null, label = 'Ongedaan maken') {
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
  // kern: kleine stip, zoals het baken in de scène
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
  // taps bolletje
  g.fillStyle = resolvedTheme() === 'dark' ? lv.dark : lv.color;
  const steps = 24, left = [], right = [];
  for (let k = 0; k <= steps; k++) {
    const p = k / steps, t = a - p * span;
    const w = head * (1 - p * 0.82);
    left.push(C + Math.cos(t) * (R + w), C + Math.sin(t) * (R + w));
    right.push(C + Math.cos(t) * (R - w), C + Math.sin(t) * (R - w));
  }
  g.beginPath();
  g.moveTo(left[0], left[1]);
  for (let k = 1; k <= steps; k++) g.lineTo(left[2 * k], left[2 * k + 1]);
  for (let k = steps; k >= 0; k--) g.lineTo(right[2 * k], right[2 * k + 1]);
  g.closePath();
  g.fill();
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
  $('composer-level').textContent = composerDue ? `${lv.name} · deadline` : lv.name;
  for (const b of $('composer-levels').children) {
    b.setAttribute('aria-checked', String(Number(b.dataset.level) === lv.id));
    b.disabled = Boolean(composerDue);
  }
  $('composer-levels').classList.toggle('is-locked', Boolean(composerDue));
  $('due-hint').textContent = composerDue ? `${dueLabel(composerDue)}, komt in ${lv.name}. Schuift vanzelf mee.` : '';
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
    tone(b, lv);
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
let wheelLevel = DEFAULT_LEVEL;
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
  setComposerDue('');
  composerTitle.focus();
});

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
  const task = { id: uid(), title, level: composerLevel, createdAt: now, updatedAt: now };
  if (composerDue) { task.due = composerDue; task.level = levelForDue(composerDue); }
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

/* ---- Focusmodus ---- */
let idleTimer = 0;
const weather = createWeather($('focus-weather'));
function setFocus(on) {
  document.body.classList.toggle('is-focus', on);
  if (on) weather.start(); else weather.stop();
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
}
function bumpIdle() {
  document.body.classList.remove('is-idle');
  clearTimeout(idleTimer);
  if (document.body.classList.contains('is-focus')) idleTimer = setTimeout(() => document.body.classList.add('is-idle'), IDLE_MS);
}
$('focus-btn').addEventListener('click', () => setFocus(!document.body.classList.contains('is-focus')));
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('is-focus')) setFocus(false);
});
window.addEventListener('pointermove', bumpIdle, { passive: true });
window.addEventListener('pointerdown', bumpIdle, { passive: true }); // aanraakschermen: een tik toont de knoppen weer

/* ---- Toetsenbord ---- */
document.addEventListener('keydown', e => {
  if (composer.open || archiveDialog.open || syncDialog.open) return;
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
  else if (k === 'd') setThemePref(resolvedTheme() === 'dark' ? 'light' : 'dark');
  else if (k === 't') setTempo(TEMPOS[(TEMPOS.indexOf(tempo) + 1) % TEMPOS.length]);
  else if (e.key === 'Escape' && document.body.classList.contains('is-focus')) setFocus(false);
});

/* ---- Lay-out: de scène centreert tussen lijst en wiel ---- */
function updateInsets() {
  if (!desktop.matches || document.body.classList.contains('is-focus')) {
    scene.setInsets({ left: 0, right: 0 });
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
const STAMP_DAY = new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short' });
let archiveTab = 'done';

function stamp(ts) {
  const d = new Date(ts), today = new Date();
  const days = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000);
  const day = days === 0 ? 'vandaag' : days === 1 ? 'gisteren' : STAMP_DAY.format(d);
  return `${day} ${TIME_FMT.format(d)}`;
}

function archRow({ title, meta, level, action, label, disabled = false }) {
  const li = el('li', 'arch-row');
  const dot = el('span', 'arch-dot');
  if (level) tone(dot, LEVEL_BY_ID.get(level)); else dot.classList.add('is-plain');
  const text = el('div', 'arch-text');
  text.append(el('span', 'arch-title', title), el('span', 'arch-meta', meta));
  const btn = el('button', 'btn-ghost arch-btn', label);
  btn.type = 'button';
  btn.disabled = disabled;
  btn.addEventListener('click', action);
  li.append(dot, text, btn);
  return li;
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
    meta: `${LEVEL_BY_ID.get(a.level)?.name ?? ''} · afgevinkt ${stamp(a.doneAt)}${a.by === 'elders' ? ' op een ander toestel' : ''}`,
    level: a.level, label: 'Terugzetten',
    action: () => { restore([a.id]); showToast(`Teruggezet · ${a.title}`); },
  })));
  if (!archive.length) doneList.append(el('li', 'arch-empty', 'Nog niets afgevinkt.'));

  const now = new Set(tasks.map(t => t.id));
  const snaps = loadSnapshots();
  const snapList = $('arch-snaps-list');
  snapList.replaceChildren(...snaps.map(sn => {
    const missing = sn.tasks.filter(t => !now.has(t.id)).length;
    return archRow({
      title: sn.reason,
      meta: `${stamp(sn.at)} · ${sn.tasks.length} ${sn.tasks.length === 1 ? 'taak' : 'taken'}${missing ? ` · ${missing} ontbreken nu` : ' · niets ontbreekt'}`,
      label: missing ? `Zet ${missing} terug` : 'Volledig',
      disabled: !missing,
      action: () => bringBack(sn.tasks, 'Voor terugzetten'),
    });
  }));
  if (!snaps.length) snapList.append(el('li', 'arch-empty', 'Nog geen momentopnames.'));
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
    tasks.push(task);
    added++;
  }
  const ids = new Set(tasks.map(t => t.id));
  archive = saveArchive(archive.filter(a => !ids.has(a.id)));
  applyDeadlines();
  saveTasks({ reason });
  render();
  renderArchive();
  const parts = [];
  if (added) parts.push(`${added} ${added === 1 ? 'taak' : 'taken'} terug`);
  if (updated) parts.push(`${updated} bijgewerkt`);
  showToast(parts.length ? parts.join(' · ') : 'Niets nieuws: alles stond er al');
  return added + updated;
}

function openArchive(tab = archiveTab) {
  archiveTab = tab;
  if (!archiveDialog.open) archiveDialog.showModal();
  renderArchive();
}

$('archive-btn').addEventListener('click', () => openArchive());
$('arch-tab-done').addEventListener('click', () => { archiveTab = 'done'; renderArchive(); });
$('arch-tab-snaps').addEventListener('click', () => { archiveTab = 'snaps'; renderArchive(); });
$('arch-close').addEventListener('click', () => archiveDialog.close());
archiveDialog.addEventListener('click', e => { if (e.target === archiveDialog) archiveDialog.close(); });

$('arch-export').addEventListener('click', () => {
  const data = { app: 'orbit', version: 1, exportedAt: new Date().toISOString(), tasks: realTasks(), archive };
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
    bringBack(list, 'Voor import', { preferNewer: true });
  } catch {
    showToast('Dat bestand kon Orbit niet lezen');
  }
});

/* ---- Tabbladen houden elkaar bij ---- */
// Elke wijziging wordt meteen bewaard, dus een ander tabblad mag de opslag gewoon opnieuw inlezen
window.addEventListener('storage', e => {
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
  }
});

/* ---- Synchronisatie tussen toestellen ---- */
// Koppelen gebeurt in één richting: het toestel met de QR-code verstuurt, het toestel dat scant ontvangt
// en neemt die lijst over (na een momentopname). Daarna houden ze elkaar gewoon gelijk.
const syncDialog = $('sync');
const SYNC_TEXT = { off: 'Koppelen', connecting: 'Verbinden', online: 'Gesynchroniseerd', offline: 'Offline' };
const TIME_FMT_SYNC = new Intl.DateTimeFormat('nl-BE', { hour: '2-digit', minute: '2-digit' });
const DEVICE = deviceName();

const sync = createSync({
  deviceName: DEVICE,
  getState: () => ({ tasks: realTasks(), gone }),
  applyState(state) {
    gone = { ...state.gone };
    const incoming = dropDemo(state.tasks.filter(isTask).map(t => ({ ...t })), 'Voor opruimen voorbeeldtaken');
    const keep = new Set(incoming.map(t => t.id));
    // Taken die hier verdwijnen omdat ze elders afgevinkt zijn: eerst een momentopname, dan naar het archief, en melden
    const lost = realTasks().filter(t => !keep.has(t.id));
    if (lost.length) {
      snapshot(tasks, 'Voor synchronisatie');
      const now = Date.now();
      archive = saveArchive([...lost.map(t => ({ ...t, doneAt: state.gone?.[t.id] || now, by: 'elders' })), ...archive]);
    }
    tasks = incoming;
    applyDeadlines();
    saveTasks({ notify: false, reason: 'Voor synchronisatie' });
    if (incoming.length < state.tasks.length) sync.changed();     // opgeruimde voorbeeldtaken ook elders weg
    render();
    renderArchive();
    if (lost.length) {
      showToast(lost.length === 1 ? `Elders afgevinkt · ${lost[0].title}` : `${lost.length} taken elders afgevinkt`,
        () => restore(lost.map(t => t.id)), 'Terugzetten');
    }
  },
  // Ontvanger: de lijst van de verzender vervangt de eigen lijst; eerst een momentopname
  onReceive(state) {
    snapshot(tasks, 'Voor ontvangen');
    gone = { ...state.gone };
    tasks = dropDemo(state.tasks.filter(isTask).map(t => ({ ...t })), 'Voor opruimen voorbeeldtaken');
    if (tasks.length < state.tasks.length) setTimeout(() => sync.changed(), 0);
    applyDeadlines();
    saveTasks({ notify: false, reason: 'Voor ontvangen' });
    render();
    renderArchive();
  },
  onStatus: renderSync,
  onPair: renderPair,
});
notifySync = () => sync.changed();

// Welk deel van het venster zichtbaar is: 'auto' (keuze of verzenden), 'confirm' (link geopend), 'scan' (camera), 'recv'
let syncView = 'auto', pendingCode = null, showCode = false, recvCode = null;
const recv = { connect: 'todo', wait: 'todo', done: 'todo' };

const scanner = createScanner($('sync-video'), {
  onCode(text) {
    const code = codeFromText(text);
    if (!code) { scanMessage('Dat is geen QR-code van Orbit. Richt op de code van het toestel dat verstuurt.'); return false; }
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
      renderRecv({ text: 'Verbonden. Hou de QR-code open op het andere toestel.' });
    } else if (e.step === 'timeout') {
      recv.wait = 'fail';
      renderRecv({ text: 'Nog niets ontvangen. Staat de QR-code nog open op het andere toestel, en zijn beide toestellen online? Orbit blijft wachten.', error: true });
    } else if (e.step === 'done') {
      Object.assign(recv, { connect: 'done', wait: 'done', done: 'done' });
      renderRecv({ text: `${e.count} ${e.count === 1 ? 'taak' : 'taken'} ontvangen${e.from ? ` van ${e.from}` : ''}. Vanaf nu blijven beide toestellen gelijk.` });
    } else if (e.step === 'error') {
      recv.connect = 'fail';
      renderRecv({ text: 'Er liep iets mis bij het verbinden. Probeer opnieuw.', error: true });
    }
    return;
  }
  if (e.role === 'receive' && e.step === 'done') {
    showToast(`${e.count} ${e.count === 1 ? 'taak' : 'taken'} ontvangen${e.from ? ` van ${e.from}` : ''}`);
    return;
  }
  if (e.role !== 'send') return;
  const text = $('sync-send-text'), line = $('sync-send-status');
  const set = (msg, state) => { text.textContent = msg; line.dataset.state = state; };
  if (e.step === 'connecting') set('Verbinden met de server…', 'busy');
  else if (e.step === 'retrying') set(serverHint(e), e.attempts >= 4 ? 'error' : 'busy');
  else if (e.step === 'ready') set(`Klaar om te versturen: ${e.count} ${e.count === 1 ? 'taak' : 'taken'}. Scan met het toestel dat moet ontvangen.`, 'ready');
  else if (e.step === 'received') {
    set(`Verstuurd naar ${e.by || 'een ander toestel'}: ${e.count} ${e.count === 1 ? 'taak' : 'taken'}. Je kunt nog een toestel laten scannen.`, 'done');
    showToast(`Verstuurd naar ${e.by || 'een ander toestel'}`);
  } else if (e.step === 'error') set('Versturen lukte niet. Sluit het venster en probeer opnieuw.', 'error');
}

function serverHint(e) {
  if (e.offline) return 'Dit toestel is offline. Orbit probeert opnieuw zodra er internet is.';
  if (e.attempts >= 4) return 'Geen verbinding met de Orbit-server. Controleer je internet. Lukt het op dit netwerk nooit, probeer dan even via mobiele data: sommige bedrijfsnetwerken blokkeren workers.dev.';
  return 'Verbinden met de Orbit-server…';
}

function renderSync({ status, lastSync, code } = { status: sync.status, lastSync: sync.lastSync, code: sync.code }) {
  const btn = $('sync-btn');
  btn.dataset.status = status;
  // verbonden maar nog niets uitgewisseld: nog niet "gesynchroniseerd" noemen
  const text = status === 'online' && !lastSync ? 'Verbonden' : SYNC_TEXT[status];
  $('sync-label').textContent = text;
  btn.setAttribute('aria-label', status === 'off' ? 'Toestellen koppelen' : `Synchronisatie: ${text.toLowerCase()}`);
  const view = syncView !== 'auto' ? syncView : code ? 'on' : 'off';
  const ids = { off: 'sync-off', confirm: 'sync-confirm', scan: 'sync-scanner', recv: 'sync-recv', on: 'sync-on' };
  for (const [v, id] of Object.entries(ids)) $(id).hidden = v !== view;
  $('sync-title').textContent = { on: 'Versturen', scan: 'Ontvangen', recv: 'Ontvangen', confirm: 'Ontvangen' }[view] ?? 'Toestellen koppelen';
  $('sync-kicker').textContent = view === 'off' ? 'Eenmalig' : DEVICE;
  if (code) {
    renderQr($('sync-qr'), syncLink(code));
    $('sync-code').textContent = code;
    $('sync-code').hidden = !showCode;
    $('sync-show-code').textContent = showCode ? 'Verberg code' : 'Toon code';
    $('sync-show-code').setAttribute('aria-expanded', String(showCode));
    $('sync-meta').textContent = lastSync ? `Gekoppeld · ${text.toLowerCase()} om ${TIME_FMT_SYNC.format(lastSync)}` : `Gekoppeld · ${text.toLowerCase()}`;
  }
}

function syncLink(code) {
  return `${location.origin}${location.pathname}#sync=${code.replace(/-/g, '')}`;
}

// Het venster tonen; een gekoppeld toestel opent op "Versturen" en wordt dan verzender
function openSync(view = 'auto') {
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
  scanMessage('Richt de camera op de QR-code van het toestel dat verstuurt.');
  renderSync();
  scanner.start();
}

async function copyText(text, button) {
  const label = button.textContent;
  try { await navigator.clipboard.writeText(text); button.textContent = 'Gekopieerd'; }
  catch { window.prompt('Kopieer:', text); }
  setTimeout(() => { button.textContent = label; }, 1500);
}

$('sync-btn').addEventListener('click', () => openSync());
$('sync-new').addEventListener('click', () => { syncView = 'auto'; sync.send(newCode()); renderSync(); $('sync-close').focus(); });
$('sync-scan').addEventListener('click', startScan);
$('sync-scan-cancel').addEventListener('click', () => { scanner.stop(); syncView = 'auto'; renderSync(); });
$('sync-join-form').addEventListener('submit', e => {
  e.preventDefault();
  const code = normalizeCode($('sync-input').value);
  if (!code) {
    $('sync-error').textContent = 'Die code klopt niet. Een code heeft 16 tekens, bv. 7K2P-Q9XD-M3TA-4HWE.';
    $('sync-error').hidden = false;
    return;
  }
  $('sync-input').value = '';
  $('sync-manual').open = false;
  receiveFrom(code);
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
  if (!m) return;
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

/* ---- Start ---- */
buildComposerLevels();
renderClock();
setInterval(renderClock, 10000);
setInterval(followDeadlines, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) followDeadlines(); });
updateInsets();
renderSummary();
renderTracks();
renderFocusNow();
scene.setTasks(tasks, { intro: true });
renderSync();
if (savedCode()) sync.start(savedCode());
readSyncHash();
