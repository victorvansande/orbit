/* ---- Bakje in de focusmodus: digitale fidgets in mono-tekens ---- */
// Een klein bakje rechtsonder, getekend in mono-tekens op een canvas, met drie soorten om mee te spelen (keuze bovenin,
// per toestel onthouden): water (deeltjesvloeistof), gelei (verend raster) en lava (metaballs). Alle drie delen dezelfde
// regels: sleep het bakje en het volgt je, kantelt mee en veert terug, en de inhoud voelt die schok; de kleur volgt hoe hard er iets beweegt, van grijze inkt
// naar het rode korrelverloop van de Bierfeesten. Loopt alleen zolang de focusmodus aan staat en het tabblad zichtbaar is.

const COLS = 40, ROWS = 14;
const CW = 7.4, CH = 12.6;        // maat van één teken (px), Geist Mono 11 px
const W = COLS * CW, HH = ROWS * CH;
const CELLS = COLS * ROWS;
const STEP_MS = 1000 / 60;
const TILT = 0.3;                 // graden kanteling per px uitwijking van het bakje
const MAX_SHIFT = 26;             // px, zo ver volgt het bakje je sleepbeweging
const LEVELS = 14;                // kleurstappen in het verloop
const GRAVITY = 0.16;             // px per stap² (water)
const MODE_KEY = 'priority-orbit.fidget.v1';
export const MODES = ['water', 'jelly', 'lava'];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---- Water: deeltjesvloeistof (dubbele dichtheidsrelaxatie, Clavet e.a. 2005) ---- */
// Het oppervlak blijft waterpas als het bakje kantelt; bewegen erover roert, een tik geeft een plons.
function water() {
  const N = 760, H = 13;
  const REST = 2.2, K = 0.06, K_NEAR = 0.15;   // rustdichtheid en stijfheid (dimensieloos, schaalt met H)
  const SIGMA = 0.035, BETA = 0.01;            // viscositeit: laag, zodat het water vloeit en nadeint zonder te spatten
  const x = new Float32Array(N), y = new Float32Array(N), px = new Float32Array(N), py = new Float32Array(N);
  const vx = new Float32Array(N), vy = new Float32Array(N);
  const rho = new Float32Array(N), rhoN = new Float32Array(N);
  let stir = null;

  // ruimtelijk raster voor buren
  const gridCols = Math.ceil(W / H) + 2, gridRows = Math.ceil(HH / H) + 2;
  const heads = new Int32Array(gridCols * gridRows), nextIdx = new Int32Array(N);
  function buildGrid() {
    heads.fill(-1);
    for (let i = 0; i < N; i++) {
      const c = clamp(Math.floor(x[i] / H) + 1, 0, gridCols - 1), r = clamp(Math.floor(y[i] / H) + 1, 0, gridRows - 1);
      const k = r * gridCols + c;
      nextIdx[i] = heads[k]; heads[k] = i;
    }
  }
  function forNeighbors(i, fn) {
    const c0 = Math.floor(x[i] / H) + 1, r0 = Math.floor(y[i] / H) + 1;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      if (r < 0 || r >= gridRows) continue;
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        if (c < 0 || c >= gridCols) continue;
        for (let j = heads[r * gridCols + c]; j !== -1; j = nextIdx[j]) if (j > i) fn(j);
      }
    }
  }

  function step({ gx, gy }) {
    for (let i = 0; i < N; i++) { vx[i] += gx * GRAVITY; vy[i] += gy * GRAVITY; }
    if (stir) {
      for (let i = 0; i < N; i++) {
        const dx = x[i] - stir.x, dy = y[i] - stir.y, d2 = dx * dx + dy * dy;
        if (d2 < 400) { const f = (1 - Math.sqrt(d2) / 20) * 0.35; vx[i] += stir.vx * f; vy[i] += stir.vy * f; }
      }
      stir.vx *= 0.5; stir.vy *= 0.5;
    }
    buildGrid();
    for (let i = 0; i < N; i++) {
      forNeighbors(i, j => {
        const dx = x[j] - x[i], dy = y[j] - y[i], r = Math.hypot(dx, dy);
        if (r >= H || r < 1e-6) return;
        const q = r / H, ux = dx / r, uy = dy / r;
        const u = (vx[i] - vx[j]) * ux + (vy[i] - vy[j]) * uy;
        if (u <= 0) return;
        const I = (1 - q) * (SIGMA * u + BETA * u * u) * 0.5;
        vx[i] -= I * ux; vy[i] -= I * uy; vx[j] += I * ux; vy[j] += I * uy;
      });
    }
    for (let i = 0; i < N; i++) { px[i] = x[i]; py[i] = y[i]; x[i] += vx[i]; y[i] += vy[i]; }
    buildGrid();
    rho.fill(0); rhoN.fill(0);
    for (let i = 0; i < N; i++) {
      forNeighbors(i, j => {
        const r = Math.hypot(x[j] - x[i], y[j] - y[i]);
        if (r >= H) return;
        const q = 1 - r / H, q2 = q * q, q3 = q2 * q;
        rho[i] += q2; rho[j] += q2; rhoN[i] += q3; rhoN[j] += q3;
      });
    }
    for (let i = 0; i < N; i++) {
      const P = K * (rho[i] - REST), Pn = K_NEAR * rhoN[i];
      let dxi = 0, dyi = 0;
      forNeighbors(i, j => {
        const dx = x[j] - x[i], dy = y[j] - y[i], r = Math.hypot(dx, dy);
        if (r >= H || r < 1e-6) return;
        const q = 1 - r / H;
        const Pj = K * (rho[j] - REST), Pnj = K_NEAR * rhoN[j];
        const D = H * ((P + Pj) * 0.5 * q + (Pn + Pnj) * 0.5 * q * q) * 0.5;
        const ux = dx / r * D, uy = dy / r * D;
        x[j] += ux; y[j] += uy; dxi -= ux; dyi -= uy;
      });
      x[i] += dxi; y[i] += dyi;
    }
    for (let i = 0; i < N; i++) {
      if (x[i] < 2) x[i] = 2 + Math.random() * 0.01;
      else if (x[i] > W - 2) x[i] = W - 2 - Math.random() * 0.01;
      if (y[i] > HH - 2) { y[i] = HH - 2 - Math.random() * 0.01; x[i] += (px[i] - x[i]) * 0.06; }   // een beetje wrijving op de bodem
      else if (y[i] < 1) y[i] = 1;
      vx[i] = (x[i] - px[i]) * 0.998; vy[i] = (y[i] - py[i]) * 0.998;
    }
  }

  // per teken: aantal deeltjes en hun gemiddelde snelheid (dichtstbijzijnde cel, geen uitsmeren: anders hangt er een
  // nevel boven het oppervlak)
  const d = new Float32Array(CELLS), sp = new Float32Array(CELLS);
  function draw(chr, want) {
    d.fill(0); sp.fill(0);
    for (let i = 0; i < N; i++) {
      const c = clamp(Math.floor(x[i] / CW), 0, COLS - 1), r = clamp(Math.floor(y[i] / CH), 0, ROWS - 1);
      d[r * COLS + c]++; sp[r * COLS + c] += Math.hypot(vx[i], vy[i]);
    }
    const full = N / CELLS * 1.9;
    for (let k = 0; k < CELLS; k++) {
      const v = d[k] / full, above = k >= COLS ? d[k - COLS] / full : 0, speed = d[k] ? sp[k] / d[k] : 0;
      chr[k] = v > 0.45 && above < 0.3 ? '~' : v > 0.45 ? (speed > 0.8 ? '≈' : '=') : v > 0.2 ? '-' : v > 0 ? (above > 0.45 ? '-' : '·') : '';
      want[k] = clamp((speed - 0.55) / 3, 0, 1);
    }
  }

  return {
    init() {
      const s = H * 0.5, cols = Math.floor((W - 4) / s);
      for (let i = 0; i < N; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        x[i] = 2 + (c + 0.5 + (r % 2) * 0.5) * s; y[i] = HH - 2 - (r + 0.5) * s * 0.87; vx[i] = vy[i] = 0;
      }
      for (let k = 0; k < 240; k++) step({ gx: 0, gy: 1 });   // vooraf laten zakken
    },
    step, draw,
    move(p) { stir = stir ? { x: p.x, y: p.y, vx: (p.x - stir.x) * 0.6 + stir.vx, vy: (p.y - stir.y) * 0.6 + stir.vy } : { ...p, vx: 0, vy: 0 }; },
    leave() { stir = null; },
    tap(p) {
      for (let i = 0; i < N; i++) {
        const dx = x[i] - p.x, dy = y[i] - p.y, dd = Math.hypot(dx, dy);
        if (dd < 30) { const f = (1 - dd / 30) * 3.2; vx[i] += dx / (dd || 1) * f; vy[i] += dy / (dd || 1) * f - 1.5 * (1 - dd / 30); }
      }
    },
  };
}

/* ---- Gelei: een verend raster van puntjes ---- */
// Elk teken is een knoop met een veer naar zijn rustplek en veren naar zijn buren, dus een duw loopt als een golf door
// het raster en trilt na. De aanwijzer duwt de knopen opzij, een tik geeft een stoot, en een schok van het bakje laat
// het hele raster meedeinen.
function jelly() {
  const dx = new Float32Array(CELLS), dy = new Float32Array(CELLS), vx = new Float32Array(CELLS), vy = new Float32Array(CELLS);
  const KH = 0.035, KN = 0.22, DAMP = 0.965;   // veer naar de rustplek, naar de buren, demping
  let push = null;
  function step({ ax, ay }) {
    if (push) {
      for (let k = 0; k < CELLS; k++) {
        const cx = (k % COLS + 0.5) * CW + dx[k], cy = (Math.floor(k / COLS) + 0.5) * CH + dy[k];
        const ex = cx - push.x, ey = cy - push.y, d = Math.hypot(ex, ey);
        if (d < 34 && d > 0.01) { const f = (1 - d / 34) ** 2 * 1.6; vx[k] += ex / d * f + push.vx * f * 0.25; vy[k] += ey / d * f + push.vy * f * 0.25; }
      }
      push.vx *= 0.4; push.vy *= 0.4;
    }
    for (let k = 0; k < CELLS; k++) {
      const c = k % COLS, r = (k - c) / COLS;
      let fx = -KH * dx[k], fy = -KH * dy[k];
      const nb = j => { fx += KN * (dx[j] - dx[k]) * 0.25; fy += KN * (dy[j] - dy[k]) * 0.25; };
      if (c > 0) nb(k - 1);
      if (c < COLS - 1) nb(k + 1);
      if (r > 0) nb(k - COLS);
      if (r < ROWS - 1) nb(k + COLS);
      vx[k] = (vx[k] + fx - ax * 0.8) * DAMP; vy[k] = (vy[k] + fy - ay * 0.8) * DAMP;
    }
    for (let k = 0; k < CELLS; k++) { dx[k] = clamp(dx[k] + vx[k], -14, 14); dy[k] = clamp(dy[k] + vy[k], -14, 14); }
  }
  function draw(chr, want, pos) {
    for (let k = 0; k < CELLS; k++) {
      const m = Math.hypot(dx[k], dy[k]), v = Math.hypot(vx[k], vy[k]);
      chr[k] = m > 7 ? '#' : m > 4 ? '*' : m > 2 ? '+' : m > 0.8 ? ':' : '·';
      want[k] = clamp(m / 9 + v / 3, 0, 1);
      pos[2 * k] = dx[k]; pos[2 * k + 1] = dy[k];
    }
  }
  return {
    init() { dx.fill(0); dy.fill(0); vx.fill(0); vy.fill(0); },
    step, draw,
    move(p) { push = push ? { x: p.x, y: p.y, vx: p.x - push.x, vy: p.y - push.y } : { ...p, vx: 0, vy: 0 }; },
    leave() { push = null; },
    tap(p) {
      for (let k = 0; k < CELLS; k++) {
        const ex = (k % COLS + 0.5) * CW - p.x, ey = (Math.floor(k / COLS) + 0.5) * CH - p.y, d = Math.hypot(ex, ey);
        if (d < 60 && d > 0.01) { const f = (1 - d / 60) * 6; vx[k] += ex / d * f; vy[k] += ey / d * f; }
      }
    },
  };
}

/* ---- Lava: metaballs ---- */
// Naar MetaBalls van React Bits (motion orbit, 15 bollen, cursor-bol, klikstoot, intro). Bollen draaien rond het midden
// en vloeien ineen waar ze elkaar raken (veld Σ (1 - d²/(2,5r)²)², rand bij 0,7); vier randlagen in tekens rond elke klodder. Een
// grotere bol volgt de aanwijzer zacht en trekt de andere aan; een tik blaast ze uiteen, waarna ze terug in hun baan
// glijden. Ze rekken wat uit in hun bewegingsrichting en wiebelen. Een schok van het bakje laat ze meeslingeren.
function lava() {
  const COUNT = 15, SPEED = 0.3, WOBBLE = 0.5, STRETCH = 0.5, STICKY = 0.5, SMOOTH = 0.1;
  const balls = [];
  const cur = { x: W / 2, y: HH / 2, tx: W / 2, ty: HH / 2, r: 0, on: false, px: W / 2, py: HH / 2 };
  let t = 0, intro = 0;
  const RINGS = ['·', ':', '+', '*'];   // van buiten naar binnen; binnenin '#'
  for (let i = 0; i < COUNT; i++) {
    balls.push({
      a: i / COUNT * Math.PI * 2 + Math.random() * 0.4,
      R: 22 + Math.random() * 70,                 // straal van de baan (px)
      w: (0.25 + Math.random() * 0.55) * (Math.random() < 0.5 ? -1 : 1),   // hoeksnelheid (rad/s)
      s: 6 + Math.random() * 6,                   // grootte (px)
      ph: Math.random() * 10,
      ox: 0, oy: 0, vx: 0, vy: 0, x: W / 2, y: HH / 2, sp: 0,
    });
  }
  function step({ ax, ay }) {
    t += 1 / 60;
    intro = Math.min(1, intro + 1 / 60 / 1.3);
    const ease = 1 - Math.pow(1 - intro, 3);
    // cursor-bol: volgt zacht, groeit als de aanwijzer erin is
    cur.x += (cur.tx - cur.x) * SMOOTH; cur.y += (cur.ty - cur.y) * SMOOTH;
    cur.r += ((cur.on ? 13 : 0) - cur.r) * 0.08;
    const csp = Math.hypot(cur.x - cur.px, cur.y - cur.py); cur.px = cur.x; cur.py = cur.y;
    for (const b of balls) {
      b.a += b.w * SPEED * (1 / 60) * 3;
      const wob = 1 + WOBBLE * 0.18 * Math.sin(t * 1.3 + b.ph);
      const hx = W / 2 + Math.cos(b.a) * b.R * wob * ease * 1.35, hy = HH / 2 + Math.sin(b.a) * b.R * wob * ease * 0.62;
      // veer terug naar de baan, schok van het bakje, aantrekking door de cursor-bol
      let fx = -b.ox * 0.04 - ax * 2.2, fy = -b.oy * 0.04 - ay * 2.2;
      if (cur.r > 1) {
        const ex = cur.x - (hx + b.ox), ey = cur.y - (hy + b.oy), d = Math.hypot(ex, ey);
        if (d < 90 && d > 1) { const f = STICKY * 0.9 * (1 - d / 90); fx += ex / d * f; fy += ey / d * f; }
      }
      b.vx = (b.vx + fx) * 0.9; b.vy = (b.vy + fy) * 0.9;
      b.ox += b.vx; b.oy += b.vy;
      const nx = hx + b.ox, ny = hy + b.oy;
      b.dx = nx - b.x; b.dy = ny - b.y; b.sp = Math.hypot(b.dx, b.dy);
      b.x = nx; b.y = ny;
    }
    cur.sp = csp;
  }
  function draw(chr, want) {
    const list = balls.map(b => [b.x, b.y, b.s * (0.5 + 0.5 * Math.min(1, intro * 1.4)), b.dx, b.dy, b.sp]);
    if (cur.r > 0.5) list.push([cur.x, cur.y, cur.r, 0, 0, cur.sp]);
    for (let k = 0; k < CELLS; k++) {
      const cx = (k % COLS + 0.5) * CW, cy = (Math.floor(k / COLS) + 0.5) * CH;
      let f = 0, heat = 0;
      for (const [x, y, r, dx, dy, sp] of list) {
        let ex = cx - x, ey = cy - y;
        // uitrekken in de bewegingsrichting: de afstand langs de snelheid telt minder
        if (sp > 0.05) {
          const ux = dx / sp, uy = dy / sp, along = ex * ux + ey * uy, k2 = 1 + STRETCH * Math.min(1.5, sp * 0.6);
          ex -= ux * along * (1 - 1 / k2); ey -= uy * along * (1 - 1 / k2);
        }
        const q = (ex * ex + ey * ey) / (r * r * 6.25);       // tot 2,5 keer de straal, daarbuiten niets
        if (q >= 1) continue;
        const c = (1 - q) * (1 - q);
        f += c; heat += c * sp;
      }
      // randlagen: vier ringen buiten de drempel, vol binnenin
      chr[k] = f >= 0.7 ? '#' : f > 0.52 ? RINGS[3] : f > 0.36 ? RINGS[2] : f > 0.22 ? RINGS[1] : f > 0.11 ? RINGS[0] : '';
      want[k] = clamp(heat / Math.max(f, 0.15) * 0.35 - 0.1, 0, 1);
    }
  }
  return {
    init() { intro = 0; },
    step, draw,
    move(p) { cur.on = true; cur.tx = p.x; cur.ty = p.y; },
    leave() { cur.on = false; },
    tap(p) {
      // klikstoot: alles in de buurt vliegt weg van de tik
      for (const b of balls) {
        const ex = b.x - p.x, ey = b.y - p.y, d = Math.hypot(ex, ey) || 1, f = Math.max(0, 1 - d / 160) * 12;
        b.vx += ex / d * f; b.vy += ey / d * f;
      }
    },
  };
}

const FACTORIES = { water, jelly, lava };

export function createFidget(box, { reducedMotion, label = m => m }) {
  const cv = box.querySelector('canvas');
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(W * dpr); cv.height = Math.round(HH * dpr);
  cv.style.width = `${W}px`; cv.style.height = `${HH}px`;
  const g = cv.getContext('2d');
  const chr = new Array(CELLS).fill(''), want = new Float32Array(CELLS), agit = new Float32Array(CELLS), pos = new Float32Array(CELLS * 2);
  let palette = null, paletteAt = 0;
  let raf = 0, running = false, acc = 0, last = 0;
  const shift = { x: 0, y: 0, vx: 0, vy: 0, goalX: 0, goalY: 0 };
  let drag = null, nudgeAt = 0;

  let modeName = 'water';
  try { const m = localStorage.getItem(MODE_KEY); if (MODES.includes(m)) modeName = m; } catch { /* geen opslag */ }
  const modes = {};
  const mode = () => {
    if (!modes[modeName]) { modes[modeName] = FACTORIES[modeName](); modes[modeName].init(); }
    return modes[modeName];
  };

  // keuze bovenin het bakje
  const bar = box.querySelector('.fidget-modes');
  function renderBar() {
    bar.replaceChildren(...MODES.map((m, i) => {
      const frag = document.createDocumentFragment();
      if (i) frag.append(Object.assign(document.createElement('span'), { className: 'slash', textContent: '/', ariaHidden: 'true' }));
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.mode = m;
      b.setAttribute('aria-checked', String(m === modeName));
      b.textContent = label(m);
      frag.append(b);
      return frag;
    }));
  }
  bar.addEventListener('pointerdown', e => e.stopPropagation());   // de knopjes slepen het bakje niet mee
  bar.addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]');
    if (!b || b.dataset.mode === modeName) return;
    mode().leave();
    modeName = b.dataset.mode;
    try { localStorage.setItem(MODE_KEY, modeName); } catch { /* geen opslag */ }
    agit.fill(0);
    renderBar();
    if (!running) render(performance.now());
  });
  renderBar();

  // verloop uit de tokens --water-calm, --water-mid en --water-hot, in LEVELS stappen (volgt het thema)
  function readPalette() {
    const st = getComputedStyle(document.documentElement);
    const rgb = name => {
      g.fillStyle = '#000'; g.fillStyle = st.getPropertyValue(name).trim() || '#888';
      const v = g.fillStyle;
      return v.startsWith('#') ? [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)) : v.match(/\d+/g).slice(0, 3).map(Number);
    };
    const stops = [rgb('--water-calm'), rgb('--water-mid'), rgb('--water-hot')];
    return Array.from({ length: LEVELS }, (_, i) => {
      const t = i / (LEVELS - 1), seg = t < 0.55 ? 0 : 1, u = seg ? (t - 0.55) / 0.45 : t / 0.55;
      const [a, b] = [stops[seg], stops[seg + 1]];
      return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * u)).join(',')})`;
    });
  }

  // het bakje volgt je sleepbeweging en veert terug; zijn versnelling is wat de inhoud voelt
  function moveBox() {
    const dragging = drag?.moved, k = dragging ? 0.25 : 0.06, damp = dragging ? 0.6 : 0.82;
    const ax = (shift.goalX - shift.x) * k, ay = (shift.goalY - shift.y) * k;
    const nvx = (shift.vx + ax) * damp, nvy = (shift.vy + ay) * damp;
    const accX = nvx - shift.vx, accY = nvy - shift.vy;
    shift.vx = nvx; shift.vy = nvy;
    shift.x += shift.vx; shift.y += shift.vy;
    if (!dragging) { shift.goalX = 0; shift.goalY = 0; }
    return [accX, accY];
  }

  function render(now = 0) {
    const m = mode();
    pos.fill(0);
    m.draw(chr, want, pos);
    if (!palette || now - paletteAt > 1000) { palette = readPalette(); paletteAt = now; }
    const groups = Array.from({ length: LEVELS }, () => []);
    const tick = Math.floor(now / 140);    // de korrel verschuift traag, zoals ruis op film
    for (let k = 0; k < CELLS; k++) {
      // woeligheid: snel aan en traag uit, zodat de kleur nadeint
      agit[k] += (want[k] - agit[k]) * (want[k] > agit[k] ? 0.35 : 0.06);
      if (!chr[k]) continue;
      // korrel: elk teken wijkt een beetje af van het verloop, meer naarmate het woeliger is
      const h = (Math.imul(k + 1, 374761393) ^ Math.imul(tick + 7, 668265263)) >>> 0;
      const grain = ((h % 1000) / 1000 - 0.5) * (0.08 + 0.22 * agit[k]);
      const lv = clamp(Math.round((agit[k] + grain) * (LEVELS - 1)), 0, LEVELS - 1);
      const c = k % COLS, r = (k - c) / COLS;
      groups[lv].push(chr[k], c * CW + CW / 2 + pos[2 * k], r * CH + CH / 2 + pos[2 * k + 1]);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, HH);
    g.font = '500 11px "Geist Mono", ui-monospace, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    groups.forEach((list, lv) => {
      if (!list.length) return;
      g.fillStyle = palette[lv];
      for (let i = 0; i < list.length; i += 3) g.fillText(list[i], list[i + 1], list[i + 2]);
    });
    box.style.translate = `${shift.x.toFixed(1)}px ${shift.y.toFixed(1)}px`;
    box.style.rotate = `${(shift.x * TILT).toFixed(2)}deg`;
  }

  function frame(now) {
    if (!running) return;
    acc += Math.min(100, now - (last || now));
    last = now;
    // af en toe een zacht duwtje, zodat het nooit lang helemaal stil ligt
    if (now > nudgeAt && !drag) {
      shift.vx += (Math.random() < 0.5 ? -1 : 1) * (0.6 + 0.5 * Math.random());
      nudgeAt = now + 9000 + Math.random() * 7000;
    }
    let n = 0;
    while (acc >= STEP_MS && n < 3) {
      const [ax, ay] = moveBox(), m = mode();
      // zwaartekracht in het assenstelsel van het gekantelde bakje, plus de schok van het bakje zelf
      const tilt = -shift.x * TILT * Math.PI / 180;
      m.step({ gx: Math.sin(tilt) - ax / GRAVITY, gy: Math.cos(tilt) - ay / GRAVITY, ax, ay });
      acc -= STEP_MS; n++;
    }
    if (n === 3) acc = 0;
    render(now);
    raf = requestAnimationFrame(frame);
  }

  // scherm naar het assenstelsel van het bakje (zonder de kanteling, die is klein)
  const local = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * HH }; };
  box.addEventListener('pointerdown', e => {
    if (reducedMotion.matches) return;
    drag = { x0: e.clientX, y0: e.clientY, moved: false };
    box.setPointerCapture(e.pointerId);
    box.classList.add('is-dragging');
  });
  box.addEventListener('pointermove', e => {
    if (reducedMotion.matches) return;
    const p = local(e);
    if (drag) {
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved) {
        const lim = v => MAX_SHIFT * Math.tanh(v / MAX_SHIFT);   // zacht begrensd
        shift.goalX = lim(dx); shift.goalY = lim(dy) * 0.6;
      }
      return;
    }
    mode().move(p);
  });
  const endDrag = e => {
    if (!drag) return;
    if (!drag.moved) mode().tap(local(e));
    drag = null;
    box.classList.remove('is-dragging');
  };
  box.addEventListener('pointerup', endDrag);
  box.addEventListener('pointercancel', endDrag);
  box.addEventListener('pointerleave', () => { if (!drag) mode().leave(); });

  return {
    start() {
      if (running) return;
      if (reducedMotion.matches) { render(performance.now()); return; }
      running = true; last = 0; acc = 0;
      nudgeAt = performance.now() + 2500;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false; cancelAnimationFrame(raf);
      drag = null; mode().leave();
      Object.assign(shift, { x: 0, y: 0, vx: 0, vy: 0, goalX: 0, goalY: 0 });
      box.style.translate = box.style.rotate = '';
    },
  };
}
