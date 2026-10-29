/* ---- Zandloper: focustimer in de focusmodus ---- */
// Een vak boven het bakje, in dezelfde ingelaten stijl. De zandloper is één silhouet van rasterpunten, zoals een
// risoposter en zoals de kern (Halftoon, gekozen door Victor): zand zijn volle punten, leeg glas zijn speldenprikjes, en
// het oppervlak is een zacht verloop van puntgroottes. Boven zakt het zand met een kuiltje, door de hals loopt een dun
// straaltje in het accent, onder groeit een heuveltje. Geen omtrek of platen (een echte glazen versie oogde te antiek).
// Ernaast of eronder de resterende tijd in de stippencijfers van de klok, 15 / 25 / 50 minuten en Start / Pauze. Uitklapbaar: dan vult het vak de hele ruimte boven het bakje.
// De tijd loopt op de klok (eindtijd in de opslag), dus ook verder als de focus dicht is of de pagina herlaadt.
// Klaar: een paar stippen fonkelen uit als de vierpuntige ster, en de afvinktik klinkt (als geluid aan staat).
import { setMatrix, twinkleDot } from './matrix.js';

const KEY = 'priority-orbit.timer.v1';
const UI_KEY = 'priority-orbit.timer.ui.v1';     // uitgeklapt of niet, per toestel
const DURATIONS = [15, 25, 50];
const FILL = 0.8;                                 // tot waar de bovenste bol bij de start gevuld is
const STEPS = 240;                                // stappen voor de inhoudstabel van een bol
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// vorm van één bol: halve breedte (0..1) op hoogte u, van de hals (0) naar de rand (1); strak en rond
const shape = u => Math.pow(Math.sin(Math.min(u / 0.8, 1) * Math.PI / 2), 0.75);

const ICON_OPEN = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 6.5h-4v-4M9.5 6.5 14 2M2.5 9.5h4v4M6.5 9.5 2 14"/></svg>';

export function createTimer(box, { reducedMotion, tx, onDone = () => {} }) {
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
  row.append(durWrap, go, reset);
  side.append(digits, row);
  const expand = Object.assign(document.createElement('button'), { type: 'button', className: 'timer-expand' });
  box.append(wrap, side, expand);
  const g = cv.getContext('2d');

  // toestand: duur (min), en ofwel een eindtijd (loopt), ofwel de resterende tijd (gepauzeerd of nog niet gestart)
  let st = { dur: 25, endAt: 0, left: 25 * 60000, done: false };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && DURATIONS.includes(s.dur)) st = { ...st, ...s }; } catch { /* geen opslag */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* geen opslag */ } };
  const remaining = (now = Date.now()) => st.endAt ? Math.max(0, st.endAt - now) : st.left;

  let open = false;
  try { open = localStorage.getItem(UI_KEY) === 'open'; } catch { /* geen opslag */ }

  let raf = 0, running = false, shownText = '', ink = '#1B1B22', accent = '#E70049', colAt = 0;
  function readColors(now) {
    if (now - colAt < 1000) return;
    const css = getComputedStyle(document.documentElement);
    ink = css.getPropertyValue('--ink').trim() || ink;
    accent = css.getPropertyValue('--core').trim() || accent;
    colAt = now;
  }

  /* ---- Glas: maat, vorm en inhoud ---- */
  let W = 0, H = 0, dpr = 1, glass = null;
  function measure() {
    const w = Math.round(wrap.clientWidth), h = Math.round(wrap.clientHeight);
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h; dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const top = 3, bot = H - 3;
    const neckLen = Math.max(2, (bot - top) * 0.025);
    const bulb = (bot - top - neckLen) / 2;
    const R = Math.min(W / 2 - 4, bulb * 0.62);             // halve breedte van een bol
    const neck = Math.max(1.4, R * 0.075);
    // inhoud van een bol van de hals tot hoogte u (in px², halve breedtes × 2)
    const area = new Float64Array(STEPS + 1);
    for (let i = 1; i <= STEPS; i++) {
      const u0 = (i - 1) / STEPS, u1 = i / STEPS;
      const w0 = neck + (R - neck) * shape(u0), w1 = neck + (R - neck) * shape(u1);
      area[i] = area[i - 1] + (w0 + w1) * bulb / STEPS;     // 2 × gemiddelde halve breedte × hoogte van de stap
    }
    const sp = Math.max(3.6, Math.min(6.5, W / 30));         // afstand tussen de rasterpunten
    glass = { top, bot, neckLen, bulb, R, neck, area, sp, cx: W / 2, neckTop: top + bulb, neckBot: top + bulb + neckLen };
  }
  const halfAt = u => glass.neck + (glass.R - glass.neck) * shape(Math.min(1, Math.max(0, u)));
  // u waarop de inhoud van hals tot u gelijk is aan a
  function levelFor(a) {
    const t = glass.area;
    if (a <= 0) return 0;
    if (a >= t[STEPS]) return 1;
    let lo = 0, hi = STEPS;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] < a) lo = m; else hi = m; }
    return (lo + (a - t[lo]) / (t[hi] - t[lo])) / STEPS;
  }

  function draw(now = performance.now()) {
    readColors(now);
    measure();
    const total = st.dur * 60000, left = remaining(), live = Boolean(st.endAt && left > 0);
    if (glass) drawGlass(left / total, live, now);
    // tijd en knoppen
    const s = Math.ceil(left / 1000), text = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (text !== shownText) { setMatrix(digits, text); shownText = text; }
    go.textContent = tx(st.done ? 'timer.done' : st.endAt ? 'timer.pause' : left < total ? 'timer.resume' : 'timer.start');
    go.disabled = st.done;
    durs.forEach(b => { b.setAttribute('aria-pressed', String(Number(b.textContent) === st.dur)); b.disabled = Boolean(st.endAt); });   // een lopend blok wissel je niet per ongeluk
    reset.hidden = !st.done && !st.endAt && left >= total;
    box.classList.toggle('is-running', Boolean(st.endAt));
    if (st.endAt && left <= 0) finish();
  }

  function drawGlass(q, live, now) {
    const { top, bot, bulb, cx, neckTop, neckBot, area, sp } = glass;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const vol = area[Math.round(FILL * STEPS)];
    const uTop = levelFor(q * vol);                       // zandhoogte boven (vanaf de hals)
    const vBot = levelFor(area[STEPS] - (1 - q) * vol);   // onder: zand van de rand tot hier (vanaf de hals gemeten)
    const flowing = live && q > 0.001;
    const dip = flowing ? Math.min(uTop, 0.08) : 0;       // kuiltje boven waar het zand wegloopt
    const mound = 1 - vBot > 0.02 ? 0.12 : 0;             // heuveltje onder
    const soft = 0.07;                                    // breedte van het verloop aan het oppervlak (in u)
    g.fillStyle = ink;
    for (let row = 0, y = top + sp / 2; y < bot; row++, y += sp * 0.866) {
      const up = y < neckTop;
      if (!up && y <= neckBot) continue;
      const u = up ? (neckTop - y) / bulb : (y - neckBot) / bulb, hw = halfAt(u);
      for (let x = cx - Math.ceil(hw / sp) * sp + (row % 2) * sp / 2; x <= cx + hw; x += sp) {
        const dx = Math.abs(x - cx);
        if (dx > hw - 1) continue;
        const k = 1 - dx / hw, edge = smooth(0, sp, hw - dx);
        // hoeveel zand er op deze plek is (0..1), met een zacht verloop aan het oppervlak
        const f = up ? smooth(uTop - dip * k * k + soft, uTop - dip * k * k - soft, u)
          : smooth(vBot - mound * Math.pow(k, 1.5) - soft, vBot - mound * Math.pow(k, 1.5) + soft, u);
        const r = sp * (0.09 + 0.39 * f) * (0.55 + 0.45 * edge);
        g.globalAlpha = 0.18 + 0.82 * Math.max(f, 0.05);
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    }
    // vallende korrels door de hals tot op het heuveltje, in het accent: ze komen dicht op elkaar uit de hals, versnellen
    // (zwaartekracht), spreiden een beetje en stuiteren na de landing nog even opzij voor ze in het heuveltje opgaan
    if (flowing) {
      const end = neckBot + (vBot - mound) * bulb, drop = Math.max(4, end - neckTop);
      const GRAV = 1500, EVERY = 16, fall = Math.sqrt(2 * drop / GRAV) * 1000, LAND = 180;   // px/s², ms
      const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
      const t = reducedMotion.matches ? 0 : now, last = Math.floor(t / EVERY);
      g.fillStyle = accent;
      for (let i = last; i > last - (fall + LAND) / EVERY - 1; i--) {
        if (rnd(i, 9) < 0.3) continue;                     // niet elke tik een korrel: een onregelmatig straaltje
        const age = t - i * EVERY, r = sp * (0.15 + 0.15 * rnd(i, 1));
        let x, y, a = 1;
        if (age < fall) {
          const s = age / 1000, d = 0.5 * GRAV * s * s;
          x = cx + (rnd(i, 2) - 0.5) * Math.min(sp * 1.8, d * 0.07);
          y = neckTop - 2 + d;
        } else {
          const k = Math.min(1, (age - fall) / LAND), side = rnd(i, 3) < 0.5 ? -1 : 1;
          x = cx + (rnd(i, 2) - 0.5) * Math.min(sp * 1.8, drop * 0.07) + side * k * sp * (0.6 + rnd(i, 4) * 1.4);
          y = neckTop - 2 + drop - Math.sin(k * Math.PI) * sp * (0.3 + 0.5 * rnd(i, 5));
          a = 1 - k;
        }
        if (age < 0) continue;
        g.globalAlpha = a; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  function finish(quiet = false) {
    st = { ...st, endAt: 0, left: 0, done: true };
    save();
    if (quiet) return;
    if (!reducedMotion.matches) [0, 260, 520].forEach(ms => setTimeout(() => twinkleDot(digits), ms));
    onDone(st.dur);
  }

  function loop(now) {
    if (!running) return;
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  function toggle() {
    if (st.done) return;
    if (st.endAt) st = { ...st, left: remaining(), endAt: 0 };          // pauze
    else st = { ...st, endAt: Date.now() + st.left };                 // start of verder
    save();
    schedule();
    draw();
  }
  go.addEventListener('click', toggle);
  wrap.addEventListener('click', toggle);
  reset.addEventListener('click', () => { st = { dur: st.dur, endAt: 0, left: st.dur * 60000, done: false }; save(); schedule(); draw(); });
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
    stop() { running = false; cancelAnimationFrame(raf); },
  };
}
