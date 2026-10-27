import { LEVELS, LEVEL_BY_ID, URGENT_LEVEL, DEFAULT_LEVEL, toneNode } from './config.js';
import { createScene } from './scene.js';
import { createWheel } from './wheel.js';
import { isDue, levelForDue, dueLabel, isOverdue, toDue } from './deadline.js';

/* ---- Instellingen ---- */
const STORAGE_KEY = 'priority-orbit.tasks.v1';
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
    return Array.isArray(data) ? data.filter(isTask) : null;
  } catch {
    return null;
  }
}

function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch { /* opslag geblokkeerd */ }
}

function demoTasks() {
  const demo = [
    [1, 'Huur overschrijven'], [1, 'Offerte terugsturen'],
    [2, 'Boodschappen doen'], [2, 'Planten water geven'],
    [3, 'Fiets laten herstellen'], [3, 'Cadeau voor zaterdag kopen'], [3, 'Was opvouwen'],
    [4, 'Tandarts bellen'], [4, 'Belastingaangifte invullen'],
    [5, 'Japans leren'], [5, 'Zolder opruimen'],
  ];
  const now = Date.now();
  return demo.map(([level, title], i) => ({ id: uid(), title, level, createdAt: now - (demo.length - i) * 1000 }));
}

let tasks = loadTasks() ?? demoTasks();
applyDeadlines();
saveTasks();

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
  $('clock').textContent = TIME_FMT.format(now);
  $('clock-date').textContent = DAY_FMT.format(now);
}

function renderFocusNow() {
  const box = $('focus-now');
  const urgent = tasks.filter(t => t.level === URGENT_LEVEL).sort((a, b) => a.createdAt - b.createdAt);
  box.replaceChildren();
  if (!urgent.length) { box.append(el('p', 'focus-calm', 'Niets dringend. Rustig aan.')); return; }
  box.append(el('p', 'focus-kicker', 'Nu'));
  const ul = el('ul');
  for (const t of urgent.slice(0, 4)) ul.append(el('li', '', t.title));
  if (urgent.length > 4) ul.append(el('li', 'focus-more', `en nog ${urgent.length - 4}`));
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
    if (save && value && value !== task.title) { task.title = value; saveTasks(); }
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
  saveTasks();
  render();
}

function setDue(id, due) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  if (due) { task.due = due; task.level = levelForDue(due); }
  else delete task.due;
  saveTasks();
  render();
}

// Deadlines opvolgen: elke minuut (ook over middernacht) en bij terugkeer naar het tabblad
function followDeadlines() {
  if (applyDeadlines()) { saveTasks(); render(); }
  else renderTracks();
}

let lastDone = null, toastTimer = 0;
function complete(id, row) {
  const task = tasks.find(t => t.id === id);
  if (!task || leaving.has(id)) return;
  leaving.add(id);
  row.classList.add('is-done');
  scene.complete(id);
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderSummary();
  renderFocusNow();
  scene.setTasks(tasks);
  lastDone = task;
  showToast(`“${task.title}” afgevinkt`);
  setTimeout(() => { leaving.delete(id); renderTracks(); }, reducedMotion.matches ? 0 : DONE_MS);
}

function undo() {
  if (!lastDone) return;
  tasks.push(lastDone);
  lastDone = null;
  saveTasks();
  render();
  hideToast();
}

function showToast(text) {
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
  $('wheel').querySelector('.wheel-list').focus({ preventScroll: true });
});
composerForm.addEventListener('submit', e => {
  e.preventDefault();
  const title = composerTitle.value.trim();
  if (!title) return;
  const task = { id: uid(), title, level: composerLevel, createdAt: Date.now() };
  if (composerDue) { task.due = composerDue; task.level = levelForDue(composerDue); }
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
function setFocus(on) {
  document.body.classList.toggle('is-focus', on);
  $('focus-btn').setAttribute('aria-pressed', String(on));
  if (on) {
    document.documentElement.requestFullscreen?.().catch(() => {});
    bumpIdle();
  } else {
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

/* ---- Toetsenbord ---- */
document.addEventListener('keydown', e => {
  if (composer.open) return;
  if (e.target.closest?.('input, textarea, [contenteditable]')) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'n') { e.preventDefault(); openComposer(); }
  else if (k === '1') setView('top');
  else if (k === '2') setView('side');
  else if (k === 'f') setFocus(!document.body.classList.contains('is-focus'));
  else if (k === 'z') undo();
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
desktop.addEventListener('change', () => { updateInsets(); renderTracks(); });

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
