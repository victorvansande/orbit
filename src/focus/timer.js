/* ---- Zandloper: focustimer in de focusmodus ---- */
// Vrije hint boven het bakje, zonder kaart of ingelaten kader (Victor, 04/11/2026, Voorstel 1: "geen kaart maar eerder
// ook een kleine 'hint', exact zoals het wordt weergegeven op het dashboard ... ook het vergroten van de zandloper
// vergroot gewoon de zandloper zoals nu maar dan vrij, zonder kaart erachter"). De zandloper is één silhouet van
// rasterpunten, zoals een risoposter en zoals de kern (Halftoon, gekozen door Victor): zand zijn volle punten, leeg glas
// zijn speldenprikjes, en het oppervlak is een zacht verloop van puntgroottes, met volume zoals de kern. Boven zakt het
// zand met een kuiltje, door de hals vallen kalme korrels in inkt, onder groeit een kegel. Geen omtrek of platen.
// Ingeklapt: klein glas (36 × 60 px) met het dunne minutencijfer (T3); aanwijzen toont 15 / 25 / 50, Start / Pauze, ↺
// en ⤢ links ernaast, exact zoals het kleine glas buiten de focus. Uitgeklapt: de zandloper groeit vrij in de ruimte
// boven het bakje met de stippencijfers eronder, zonder kaart erachter.
// Compact (gsm, klasse is-compact, P3 van Victor, 02/11/2026): klein glas met de resterende minuten als groot, dun cijfer
// (T3) rechts in de knoppenrij; duur, Start / Pauze en ↺ verschijnen pas bij een tik, in een pilletje erboven.
// De tijd loopt op de klok (eindtijd in de opslag), dus ook verder als de focus dicht is of de pagina herlaadt.
// Klaar: een golf door het zand, een paar stippen fonkelen uit als de vierpuntige ster en de afvinktik klinkt.
import { setMatrix, morphMatrix, twinkleDot } from '../scene/matrix.js';
import { createSand } from './sand.js';

export const TIMER_KEY = 'priority-orbit.timer.v1';
const KEY = TIMER_KEY;
const UI_KEY = 'priority-orbit.timer.ui.v1';     // uitgeklapt of niet, per toestel
const DURATIONS = [15, 25, 50];
const ICON_OPEN = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 6.5h-4v-4M9.5 6.5 14 2M2.5 9.5h4v4M6.5 9.5 2 14"/></svg>';

// toestand zoals bewaard: duur (min), en ofwel een eindtijd (loopt), ofwel de resterende tijd (gepauzeerd of nog niet
// gestart), plus `at` (laatste wijziging, voor de sync). Ook gelezen door het kleine glas buiten de focus (glass.js).
export function timerState() {
  let st = { dur: 25, endAt: 0, left: 25 * 60000, done: false, at: 0 };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && DURATIONS.includes(s.dur)) st = { ...st, ...s }; } catch { /* geen opslag */ }
  return st;
}
// toestand van een ander toestel overnemen (sync); geeft false als ze ongeldig is
export function saveTimerState(s) {
  if (!s || !DURATIONS.includes(s.dur)) return false;
  const st = { dur: s.dur, endAt: Number(s.endAt) || 0, left: Number(s.left) || 0, done: !!s.done, at: Number(s.at) || 0 };
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* geen opslag */ }
  return true;
}

export function createTimer(box, { reducedMotion, tx, onDone = () => {}, onChange = () => {} }) {
  const wrap = Object.assign(document.createElement('div'), { className: 'timer-glass' });
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  wrap.append(cv);
  const side = Object.assign(document.createElement('div'), { className: 'timer-side' });
  const digits = Object.assign(document.createElement('div'), { className: 'timer-digits' });
  digits.setAttribute('role', 'timer');
  const row = Object.assign(document.createElement('div'), { className: 'timer-row' });
  const durs = DURATIONS.map(m => Object.assign(document.createElement('button'), { type: 'button', textContent: String(m), className: 'timer-dur' }));
  const unit = Object.assign(document.createElement('span'), { className: 'timer-unit', textContent: 'min' });
  const go = Object.assign(document.createElement('button'), { type: 'button', className: 'timer-go' });
  const reset = Object.assign(document.createElement('button'), { type: 'button', className: 'timer-reset', textContent: '↺' });
  reset.setAttribute('aria-label', tx('timer.reset')); reset.title = tx('timer.reset');
  const durWrap = Object.assign(document.createElement('div'), { className: 'timer-durs' });
  durWrap.setAttribute('role', 'group');
  durs.forEach(b => durWrap.append(b));
  durWrap.append(unit);
  const expand = Object.assign(document.createElement('button'), { type: 'button', className: 'timer-expand' });
  row.append(durWrap, go, reset, expand);
  // groot, dun minutencijfer met klein MIN erachter (op gsm toont een tik de bediening, op pc start/pauzeert het)
  const minBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'timer-min' });
  const minNum = Object.assign(document.createElement('span'), { className: 'timer-num' });
  const minUnit = document.createElement('small');
  minBtn.append(minNum, minUnit);
  minBtn.setAttribute('aria-expanded', 'false');
  side.append(minBtn, digits, row);
  box.append(wrap, side);
  const g = cv.getContext('2d');

  let st = timerState();
  // elke eigen wijziging krijgt een tijdstip en gaat naar de sync (onChange): het recentste toestel wint
  const save = () => { st = { ...st, at: Date.now() }; try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* geen opslag */ } onChange(); };
  const remaining = (now = Date.now()) => st.endAt ? Math.max(0, st.endAt - now) : st.left;

  let open = false;
  try { open = localStorage.getItem(UI_KEY) === 'open'; } catch { /* geen opslag */ }

  let raf = 0, running = false, shownText = '', ink = '#1B1B22', colAt = 0;
  function readColors(now) {
    if (now - colAt < 1000) return;
    const css = getComputedStyle(document.documentElement);
    ink = css.getPropertyValue('--ink').trim() || ink;
    colAt = now;
  }

  /* ---- Glas: maat, vorm en inhoud ---- */
  const sand = createSand();
  let W = 0, H = 0, dpr = 1;
  function measure() {
    const w = Math.round(wrap.clientWidth), h = Math.round(wrap.clientHeight);
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h; dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    sand.fit(W, H);
  }

  function draw(now = performance.now()) {
    readColors(now);
    measure();
    const total = st.dur * 60000, left = remaining(), live = Boolean(st.endAt && left > 0);
    if (W) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.fillStyle = ink;
      sand.draw(g, left / total, { live, now, still: reducedMotion.matches, pausedAt, doneAt });
    }
    // tijd en knoppen
    const s = Math.ceil(left / 1000), text = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (text + st.done !== shownText) {
      // een nieuwe minuut (of een andere duur) valt in ruis en bezinkt, zoals de stippenteller; de seconden wisselen
      // gewoon, elke seconde ruis was te onrustig
      if (shownText && shownText.slice(0, 2) !== text.slice(0, 2) && !digits._morphT) morphMatrix(digits, text, { still: reducedMotion.matches, only: true });
      else setMatrix(digits, text);
      shownText = text + st.done;
      const num = st.done ? '' : String(left >= 60000 ? Math.ceil(left / 60000) : s), unit = st.done ? tx('timer.done') : left >= 60000 ? 'min' : 's';
      minNum.textContent = num; minUnit.textContent = unit;
      minBtn.setAttribute('aria-label', tx('timer.tools', { time: num ? `${num} ${unit}` : unit }));
    }
    go.textContent = tx(st.done ? 'timer.done' : st.endAt ? 'timer.pause' : left < total ? 'timer.resume' : 'timer.start');
    go.disabled = st.done;
    durs.forEach(b => { b.setAttribute('aria-pressed', String(Number(b.textContent) === st.dur)); b.disabled = Boolean(st.endAt); });   // een lopend blok wissel je niet per ongeluk
    reset.hidden = !st.done && !st.endAt && left >= total;
    box.classList.toggle('is-running', Boolean(st.endAt));
    box.classList.toggle('is-paused', !st.endAt && !st.done && left < total);
    if (st.endAt && left <= 0) finish();
  }

  let pausedAt = -1e9, doneAt = -1e9;

  // Klaar. Het blok telt onder zijn eindtijd (`end`): loopt dezelfde zandloper op twee gekoppelde toestellen, dan delen ze
  // die eindtijd via de sync en valt het blok bij het samenvoegen samen tot één (nooit dubbel geteld). Ook stil klaar
  // (lang na het einde geopend) telt het blok nu, zonder geluid of melding.
  function finish(quiet = false) {
    const end = st.endAt || Date.now();
    st = { ...st, endAt: 0, left: 0, done: true };
    save();
    if (!quiet) {
      doneAt = performance.now();
      if (!reducedMotion.matches) [0, 260, 520].forEach(ms => setTimeout(() => twinkleDot(digits), ms));
    }
    onDone(st.dur, end, quiet);
  }

  function loop(now) {
    if (!running) return;
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  function toggle() {
    if (st.done) return;
    if (st.endAt) { st = { ...st, left: remaining(), endAt: 0 }; pausedAt = performance.now(); }   // pauze
    else st = { ...st, endAt: Date.now() + st.left };                 // start of verder
    save();
    schedule();
    draw();
  }
  // compact: de bediening verschijnt bij een tik en verdwijnt 2,5 s na de laatste aanraking (zoals de knoppen in de focus)
  let toolsTimer = 0;
  const compact = () => box.classList.contains('is-compact');
  function tools(on) {
    box.classList.toggle('is-tools', on);
    minBtn.setAttribute('aria-expanded', String(on));
    clearTimeout(toolsTimer);
    if (on) toolsTimer = setTimeout(() => tools(row.contains(document.activeElement) && document.documentElement.dataset.input === 'keyboard'), 2500);
  }
  minBtn.addEventListener('click', () => { if (compact()) tools(!box.classList.contains('is-tools')); else toggle(); });
  row.addEventListener('pointerdown', () => { if (compact()) tools(true); });
  row.addEventListener('focusin', () => { if (compact()) tools(true); });
  document.addEventListener('pointerdown', e => { if (box.classList.contains('is-tools') && !box.contains(e.target)) tools(false); }, true);
  go.addEventListener('click', toggle);
  wrap.addEventListener('click', () => { if (compact()) tools(!box.classList.contains('is-tools')); else toggle(); });
  function restart() { st = { dur: st.dur, endAt: 0, left: st.dur * 60000, done: false }; save(); schedule(); draw(); }
  reset.addEventListener('click', restart);
  durs.forEach(b => b.addEventListener('click', () => {
    const m = Number(b.textContent);
    st = { dur: m, endAt: 0, left: m * 60000, done: false };
    save(); draw();
  }));

  // uitklappen: het vak vult de ruimte boven het bakje
  function setOpen(on) {
    open = on;
    box.classList.toggle('is-open', on);
    expand.innerHTML = on ? ICON_CLOSE : ICON_OPEN;
    expand.setAttribute('aria-label', tx(on ? 'timer.collapse' : 'timer.expand'));
    expand.title = tx(on ? 'timer.collapse' : 'timer.expand');
    expand.setAttribute('aria-expanded', String(on));
    try { localStorage.setItem(UI_KEY, on ? 'open' : 'closed'); } catch { /* geen opslag */ }
  }
  expand.addEventListener('click', () => setOpen(!open));
  new ResizeObserver(() => { W = 0; draw(); }).observe(wrap);

  // het einde ook opmerken als de focus dicht is (geluid op tijd); wat lang geleden afliep, eindigt stil
  let endTimer = 0;
  function schedule() {
    clearTimeout(endTimer);
    if (st.endAt) endTimer = setTimeout(() => draw(), Math.max(0, st.endAt - Date.now()) + 50);
  }
  if (st.endAt && Date.now() - st.endAt > 60000) finish(true);
  setOpen(open);
  draw();
  schedule();
  return {
    start() { if (running) return; running = true; raf = requestAnimationFrame(loop); },
    stop() { running = false; cancelAnimationFrame(raf); tools(false); },
    // ook van buiten de focus (het glas op pc): pauzeren of verder, en opnieuw
    toggle() { st = timerState(); toggle(); },
    reset() { st = timerState(); restart(); },
    // toestand opnieuw lezen (gewijzigd op een ander toestel of in een ander tabblad)
    reload() { st = timerState(); if (st.endAt && Date.now() - st.endAt > 60000) finish(true); schedule(); draw(); },
  };
}
