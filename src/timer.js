/* ---- Zandloper: focustimer in de focusmodus ---- */
// Een vakje boven het bakje, in dezelfde ingelaten stijl: links een zandloper van stippen die in 15, 25 of 50 minuten
// leegloopt, rechts de resterende tijd in de stippencijfers van de klok. Een tik op de zandloper of op Start begint,
// nog een tik pauzeert. De tijd loopt op de klok (eindtijd in de opslag), dus ook verder als de focus dicht is of de
// pagina herlaadt. Klaar: een paar stippen fonkelen uit als de vierpuntige ster, en de afvinktik klinkt (als geluid aan staat).
import { setMatrix, twinkleDot } from './matrix.js';

const KEY = 'priority-orbit.timer.v1';
const DURATIONS = [15, 25, 50];
const ROWS = [11, 9, 7, 5, 3, 1, 3, 5, 7, 9, 11];   // breedte per rij: bovenste bol, hals, onderste bol
const NECK = 5, COLS = 11, GAP = 9;                 // px tussen stippen
const SIZE = COLS * GAP;

// stippen van de zandloper, met de volgorde waarin het zand boven verdwijnt en onder bijkomt
const cells = [];
ROWS.forEach((w, r) => { for (let i = 0; i < w; i++) cells.push({ r, c: (COLS - w) / 2 + i, off: Math.abs(i - (w - 1) / 2) }); });
// boven: de bovenste laag eerst, van het midden naar buiten (het oppervlak zakt eerst in het midden)
const TOP = cells.filter(d => d.r < NECK).sort((a, b) => a.r - b.r || a.off - b.off);
// onder: de onderste laag eerst, van het midden naar buiten (het hoopje groeit)
const BOTTOM = cells.filter(d => d.r > NECK).sort((a, b) => b.r - a.r || a.off - b.off);
const GRAINS = TOP.length;

export function createTimer(box, { reducedMotion, tx, onDone = () => {} }) {
  const cv = document.createElement('canvas');
  cv.className = 'timer-glass';
  cv.setAttribute('aria-hidden', 'true');
  const side = document.createElement('div');
  side.className = 'timer-side';
  const digits = document.createElement('div');
  digits.className = 'timer-digits';
  digits.setAttribute('role', 'timer');
  const row = document.createElement('div');
  row.className = 'timer-row';
  const durs = DURATIONS.map(m => Object.assign(document.createElement('button'), { type: 'button', textContent: String(m), className: 'timer-dur' }));
  const toggle = Object.assign(document.createElement('button'), { type: 'button', className: 'timer-go' });
  const reset = Object.assign(document.createElement('button'), { type: 'button', className: 'timer-reset', textContent: '↺' });
  reset.setAttribute('aria-label', tx('timer.reset')); reset.title = tx('timer.reset');
  durs.forEach((b, i) => { if (i) row.append(Object.assign(document.createElement('span'), { className: 'slash', textContent: '/', ariaHidden: 'true' })); row.append(b); });
  row.append(toggle, reset);
  side.append(digits, row);
  box.append(cv, side);

  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(SIZE * dpr); cv.height = Math.round(SIZE * dpr);
  cv.style.width = cv.style.height = `${SIZE}px`;
  const g = cv.getContext('2d');

  // toestand: duur (min), en ofwel een eindtijd (loopt), ofwel de resterende tijd (gepauzeerd of nog niet gestart)
  let st = { dur: 25, endAt: 0, left: 25 * 60000, done: false };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && DURATIONS.includes(s.dur)) st = { ...st, ...s }; } catch { /* geen opslag */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* geen opslag */ } };
  const remaining = (now = Date.now()) => st.endAt ? Math.max(0, st.endAt - now) : st.left;

  let raf = 0, running = false, shownText = '', inkCol = '', ghost = 0.08, colAt = 0;

  function readColors(now) {
    if (now - colAt < 1000 && inkCol) return;
    const css = getComputedStyle(document.documentElement);
    inkCol = css.getPropertyValue('--ink').trim() || '#1B1B22';
    ghost = parseFloat(css.getPropertyValue('--dm-ghost')) || 0.08;
    colAt = now;
  }

  function draw(now = performance.now()) {
    readColors(now);
    const total = st.dur * 60000, left = remaining(), p = 1 - left / total;
    const fallen = Math.min(GRAINS, p * GRAINS), whole = Math.floor(fallen), frac = fallen - whole;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, SIZE, SIZE);
    g.fillStyle = inkCol;
    const dot = (d, a, r = 2.6) => { g.globalAlpha = a; g.beginPath(); g.arc(d.c * GAP + GAP / 2, d.r * GAP + GAP / 2, r, 0, Math.PI * 2); g.fill(); };
    const goneTop = new Set(TOP.slice(0, whole)), filled = new Set(BOTTOM.slice(0, whole));
    for (const d of cells) {
      const lit = d.r < NECK ? !goneTop.has(d) : filled.has(d);
      dot(d, lit ? 1 : ghost, lit ? 2.6 : 2.2);
    }
    // de hals en een korrel die valt, zolang de tijd loopt
    const live = st.endAt && left > 0;
    if (live && whole < GRAINS) {
      dot({ r: NECK, c: (COLS - 1) / 2 }, 0.5 + 0.5 * Math.abs(Math.sin(now / 600)), 2.4);
      if (!reducedMotion.matches) {
        const to = BOTTOM[whole], k = Math.min(1, frac / 0.35);   // de korrel valt in het eerste stuk van zijn tijd
        if (k < 1) {
          const x = ((COLS - 1) / 2 + (to.c - (COLS - 1) / 2) * k * k) * GAP + GAP / 2;
          const y = (NECK + (to.r - NECK) * k * k) * GAP + GAP / 2;
          g.globalAlpha = 1; g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    // tijd en knoppen
    const s = Math.ceil(left / 1000), text = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (text !== shownText) { setMatrix(digits, text); shownText = text; }
    toggle.textContent = tx(st.done ? 'timer.done' : st.endAt ? 'timer.pause' : left < total ? 'timer.resume' : 'timer.start');
    toggle.disabled = st.done;
    durs.forEach(b => { b.setAttribute('aria-pressed', String(Number(b.textContent) === st.dur)); b.disabled = Boolean(st.endAt); });   // een lopend blok wissel je niet per ongeluk
    reset.hidden = !st.done && !st.endAt && left >= total;
    box.classList.toggle('is-running', Boolean(st.endAt));
    // klaar
    if (st.endAt && left <= 0) finish();
  }

  function finish(quiet = false) {
    st = { ...st, endAt: 0, left: 0, done: true };
    save();
    if (quiet) return;
    if (!reducedMotion.matches) [0, 260, 520].forEach(ms => setTimeout(() => twinkleDot(digits), ms));
    onDone();
  }

  function loop(now) {
    if (!running) return;
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  function go() {
    if (st.done) return;
    if (st.endAt) st = { ...st, left: remaining(), endAt: 0 };          // pauze
    else st = { ...st, endAt: Date.now() + st.left };                 // start of verder
    save();
    schedule();
    draw();
  }
  toggle.addEventListener('click', go);
  cv.addEventListener('click', go);
  cv.style.cursor = 'pointer';
  reset.addEventListener('click', () => { st = { dur: st.dur, endAt: 0, left: st.dur * 60000, done: false }; save(); schedule(); draw(); });
  durs.forEach(b => b.addEventListener('click', () => {
    const m = Number(b.textContent);
    st = { dur: m, endAt: 0, left: m * 60000, done: false };
    save(); draw();
  }));

  // het einde ook opmerken als de focus dicht is (geluid op tijd); wat lang geleden afliep, eindigt stil
  let endTimer = 0;
  function schedule() {
    clearTimeout(endTimer);
    if (st.endAt) endTimer = setTimeout(() => draw(), Math.max(0, st.endAt - Date.now()) + 50);
  }
  if (st.endAt && Date.now() - st.endAt > 60000) finish(true);
  draw();
  schedule();
  return {
    start() { if (running) return; running = true; raf = requestAnimationFrame(loop); },
    stop() { running = false; cancelAnimationFrame(raf); },
  };
}
