/* ---- Zandloper: focustimer in de focusmodus ---- */
// Een vak boven het bakje, in dezelfde ingelaten stijl. Een glazen zandloper (dunne omtrek, twee ronde bollen, platen
// boven en onder) met zand als fijn stippelwerk, zoals de kern: boven zakt het zand en vormt het een kuiltje, door de hals
// loopt een dun straaltje, onder groeit een heuveltje. Ernaast of eronder de resterende tijd in de stippencijfers van de
// klok, 15 / 25 / 50 minuten en Start / Pauze. Uitklapbaar: dan vult het vak de hele ruimte boven het bakje.
// De tijd loopt op de klok (eindtijd in de opslag), dus ook verder als de focus dicht is of de pagina herlaadt.
// Klaar: een paar stippen fonkelen uit als de vierpuntige ster, en de afvinktik klinkt (als geluid aan staat).
import { setMatrix, twinkleDot } from './matrix.js';

const KEY = 'priority-orbit.timer.v1';
const UI_KEY = 'priority-orbit.timer.ui.v1';     // uitgeklapt of niet, per toestel
const DURATIONS = [15, 25, 50];
const FILL = 0.8;                                 // tot waar de bovenste bol bij de start gevuld is
const STEPS = 240;                                // stappen voor de inhoudstabel van een bol
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// vorm van één bol: halve breedte (0..1) op hoogte u, van de hals (0) naar de plaat (1); rond, bovenaan iets ingesnoerd
const shape = u => Math.pow(Math.sin(Math.min(u / 0.74, 1) * Math.PI / 2), 0.85) * (1 - 0.16 * smooth(0.74, 1, u));

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

  let raf = 0, running = false, shownText = '', ink = '#1B1B22', ghost = 0.08, colAt = 0;
  function readColors(now) {
    if (now - colAt < 1000) return;
    const css = getComputedStyle(document.documentElement);
    ink = css.getPropertyValue('--ink').trim() || ink;
    ghost = parseFloat(css.getPropertyValue('--dm-ghost')) || ghost;
    colAt = now;
  }

  /* ---- Glas: maat, vorm en inhoud ---- */
  let W = 0, H = 0, dpr = 1, glass = null;
  function measure() {
    const w = Math.round(wrap.clientWidth), h = Math.round(wrap.clientHeight);
    if (!w || !h || (w === W && h === H)) return;
    W = w; H = h; dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const plate = Math.max(1.8, H * 0.02);                   // platen boven en onder
    const top = plate + 2, bot = H - plate - 2;
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
    const sp = Math.max(2.4, Math.min(5, W / 42));           // afstand tussen de zandkorrels (stippelraster)
    glass = { top, bot, plate, neckLen, bulb, R, neck, area, sp, cx: W / 2, neckTop: top + bulb, neckBot: top + bulb + neckLen };
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
    const { top, bot, plate, bulb, R, cx, neckTop, neckBot, area, sp } = glass;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const vol = area[Math.round(FILL * STEPS)];
    const upper = q * vol, lower = (1 - q) * vol;
    const uTop = levelFor(upper);                         // zandhoogte boven (vanaf de hals)
    const vBot = levelFor(area[STEPS] - lower);           // onder: zand van de plaat tot hier (vanaf de hals gemeten)
    const flowing = live && q > 0.001;
    const dip = flowing ? Math.min(uTop, 0.09) : 0;       // kuiltje boven waar het zand wegloopt
    const mound = lower > 0 ? Math.min(0.13, (1 - vBot) * 0.9) : 0;   // heuveltje onder
    // zand: stippels in een zeshoekig raster, zoals de kern
    const rr = sp * 0.36;
    g.fillStyle = ink;
    const ghostPath = new Path2D(), sandPath = new Path2D();
    for (let row = 0, y = top + sp * 0.5; y < bot; row++, y += sp * 0.866) {
      const inUpper = y < neckTop, inLower = y > neckBot;
      if (!inUpper && !inLower) continue;
      const u = inUpper ? (neckTop - y) / bulb : (y - neckBot) / bulb;
      const hw = halfAt(u) - rr * 1.6;
      if (hw <= 0) continue;
      const off = (row % 2) * sp * 0.5;
      for (let x = cx - Math.floor(hw / sp) * sp - off; x <= cx + hw; x += sp) {
        const dx = Math.abs(x - cx);
        if (dx > hw) continue;
        const k = 1 - dx / Math.max(hw, 1);
        const sand = inUpper ? u <= uTop - dip * k * k : u >= vBot - mound * Math.pow(k, 1.4);
        const path = sand ? sandPath : ghostPath, r = sand ? rr : rr * 0.8;
        path.moveTo(x + r, y); path.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    g.globalAlpha = ghost * 0.9; g.fill(ghostPath);
    g.globalAlpha = 1; g.fill(sandPath);
    // straaltje door de hals tot op het heuveltje
    if (flowing) {
      const end = neckBot + (vBot - mound) * bulb;          // de top van het heuveltje (of de bodem)
      const step = Math.max(2.2, sp * 0.7), shift = reducedMotion.matches ? 0 : (now / 1000 * 60) % step;
      g.beginPath();
      for (let y = neckTop - 2 + shift; y < end; y += step) { g.moveTo(cx + rr * 0.7, y); g.arc(cx, y, rr * 0.7, 0, Math.PI * 2); }
      g.globalAlpha = 0.85; g.fill();
    }
    // glas: dunne omtrek van beide bollen en de hals
    g.globalAlpha = 0.42; g.strokeStyle = ink; g.lineWidth = 1.1; g.lineJoin = 'round';
    for (const side of [-1, 1]) {
      g.beginPath();
      for (let i = 0; i <= 60; i++) { const u = 1 - i / 60; g.lineTo(cx + side * halfAt(u), neckTop - u * bulb); }
      g.lineTo(cx + side * glass.neck, neckBot);
      for (let i = 0; i <= 60; i++) { const u = i / 60; g.lineTo(cx + side * halfAt(u), neckBot + u * bulb); }
      g.stroke();
    }
    // platen boven en onder, iets breder dan het glas, met twee dunne staanders
    g.globalAlpha = 0.5; g.lineWidth = plate; g.lineCap = 'round';
    const pw = R * 1.16;
    for (const y of [top - plate * 0.6, bot + plate * 0.6]) { g.beginPath(); g.moveTo(cx - pw, y); g.lineTo(cx + pw, y); g.stroke(); }
    g.globalAlpha = 0.22; g.lineWidth = 1;
    for (const side of [-1, 1]) { g.beginPath(); g.moveTo(cx + side * pw * 0.94, top); g.lineTo(cx + side * pw * 0.94, bot); g.stroke(); }
    g.globalAlpha = 1; g.lineCap = 'butt';
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
