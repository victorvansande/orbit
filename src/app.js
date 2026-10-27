import { LEVELS, LEVEL_BY_ID, URGENT_LEVEL, DEFAULT_LEVEL } from './config.js';
import { orbSprite } from './sprites.js';
import { createScene } from './scene.js';
import { createWheel } from './wheel.js';

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
  && LEVEL_BY_ID.has(t.level) && typeof t.createdAt === 'number';

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
saveTasks();

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
  node.style.setProperty('--c', lv.color);
  node.style.setProperty('--c2', lv.tones[1]);
  node.style.setProperty('--c3', lv.tones[2]);
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

  li.addEventListener('pointerenter', () => scene.highlight({ task: t.id }));
  li.addEventListener('pointerleave', () => scene.highlight({}));
  li.append(check, title, levelBtn, picker);
  return li;
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
  if (!task || task.level === level) return;
  task.level = level;
  saveTasks();
  render();
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
const orbCache = new Map();
let composerLevel = DEFAULT_LEVEL, closeTimer = 0;

function paintComposerOrb() {
  const lv = LEVEL_BY_ID.get(composerLevel);
  if (!orbCache.has(lv.id)) orbCache.set(lv.id, orbSprite(lv.tones, composerOrb.width, { blur: 0.03, glow: 0.32 }));
  const g = composerOrb.getContext('2d');
  g.clearRect(0, 0, composerOrb.width, composerOrb.height);
  g.drawImage(orbCache.get(lv.id), 0, 0);
  composer.style.setProperty('--c', lv.color);
  $('composer-level').textContent = lv.name;
  for (const b of $('composer-levels').children) b.setAttribute('aria-checked', String(Number(b.dataset.level) === lv.id));
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
    b.addEventListener('click', () => { composerLevel = lv.id; paintComposerOrb(); composerTitle.focus(); });
    box.append(b);
  }
}

function openComposer(level = wheel.level) {
  clearTimeout(closeTimer);
  composer.classList.remove('is-closing');
  composerLevel = level;
  composerForm.reset();
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
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    composerLevel = Math.max(1, Math.min(LEVELS.length, composerLevel + (e.key === 'ArrowUp' ? -1 : 1)));
    paintComposerOrb();
  }
});
$('composer-cancel').addEventListener('click', closeComposer);
composer.addEventListener('cancel', e => { e.preventDefault(); closeComposer(); });
composer.addEventListener('click', e => { if (e.target === composer) closeComposer(); });
composer.addEventListener('close', () => $('wheel').querySelector('.wheel-list').focus({ preventScroll: true }));
composerForm.addEventListener('submit', e => {
  e.preventDefault();
  const title = composerTitle.value.trim();
  if (!title) return;
  tasks.push({ id: uid(), title, level: composerLevel, createdAt: Date.now() });
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
updateInsets();
renderSummary();
renderTracks();
renderFocusNow();
scene.setTasks(tasks, { intro: true });
