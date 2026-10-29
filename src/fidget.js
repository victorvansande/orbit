/* ---- Bakje in de focusmodus: digitale fidgets in mono-tekens ---- */
// Een klein bakje rechtsonder, getekend in mono-tekens op een canvas, met vier soorten om mee te spelen (keuze bovenin,
// per toestel onthouden): water (deeltjesvloeistof), zand (vallende korrels), gelei (verend raster) en magneet
// (ijzervijlsel dat zich naar de polen richt). Alle vier delen dezelfde regels: sleep het bakje en het volgt je, kantelt
// mee en veert terug (water, zand en gelei voelen die schok); de kleur volgt hoe hard er iets beweegt, van grijze inkt
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
export const MODES = ['water', 'sand', 'jelly', 'magnet'];

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

/* ---- Zand: vallende korrels op het tekenraster ---- */
// Elke cel is een korrel of leeg. Korrels vallen, glijden van een helling en lopen naar de lage kant als het bakje
// kantelt; een schok gooit de bovenste korrels even op. Ingedrukt houden laat zand uit je vinger stromen, bewegen erover
// schept een geul. Is het bakje vol, dan loopt de bodem een beetje leeg.
function sand() {
  const MAX = Math.round(CELLS * 0.42);
  let grid = new Uint8Array(CELLS);               // 1 = korrel
  const heat = new Float32Array(CELLS);           // net bewogen: gloeit na in het verloop
  let pour = null, dig = null, lastX = null, tick = 0, count = 0;
  const at = (c, r) => r * COLS + c;
  const empty = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS && !grid[at(c, r)];
  function moveGrain(a, b) { grid[a] = 0; grid[b] = 1; heat[b] = 1; }

  function step({ gx, ax, ay }) {
    tick++;
    for (let k = 0; k < CELLS; k++) heat[k] *= 0.93;
    if (count >= MAX) for (let c = 0; c < COLS; c++) if (grid[at(c, ROWS - 1)] && Math.random() < 0.3) { grid[at(c, ROWS - 1)] = 0; count--; }
    if (pour && count < MAX && tick % 2 === 0) {
      const c = clamp(Math.round(pour.x / CW - 0.5 + (Math.random() - 0.5) * 1.6), 0, COLS - 1), r = clamp(Math.floor(pour.y / CH), 0, ROWS - 1);
      if (!grid[at(c, r)]) { grid[at(c, r)] = 1; heat[at(c, r)] = 1; count++; }
    }
    if (dig) {
      // een geul scheppen: korrels onder de aanwijzer schuiven opzij en omhoog
      const c0 = Math.floor(dig.x / CW), r0 = Math.floor(dig.y / CH), dir = dig.vx >= 0 ? 1 : -1;
      for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS || !grid[at(c, r)]) continue;
        for (const [dc, dr] of [[dir * 2, -1], [dir, -1], [-dir, -1], [dir * 2, 0]]) if (empty(c + dc, r + dr)) { moveGrain(at(c, r), at(c + dc, r + dr)); break; }
      }
      dig = null;
    }
    // schok van het bakje: de bovenste korrel van elke kolom springt even op
    const shake = Math.hypot(ax, ay);
    if (shake > 0.35) {
      for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
        if (!grid[at(c, r)]) continue;
        if (Math.random() < Math.min(0.6, shake * 0.4)) {
          const nc = c + (Math.sign(-ax) || (Math.random() < 0.5 ? -1 : 1)), nr = r - 1 - (Math.random() < shake * 0.3 ? 1 : 0);
          if (empty(nc, nr)) moveGrain(at(c, r), at(nc, nr));
        }
        break;
      }
    }
    if (tick % 2) return;   // 30 keer per seconde: rustiger en beter te volgen
    // van onder naar boven, afwisselend links en rechts, zodat er geen voorkeursrichting ontstaat
    const ltr = tick % 4 === 0, side = gx > 0.02 ? 1 : gx < -0.02 ? -1 : 0, slide = Math.min(0.9, Math.abs(gx) * 9);
    for (let r = ROWS - 2; r >= 0; r--) {
      for (let i = 0; i < COLS; i++) {
        const c = ltr ? i : COLS - 1 - i, k = at(c, r);
        if (!grid[k]) continue;
        if (empty(c, r + 1)) { moveGrain(k, at(c, r + 1)); continue; }
        const first = side || (Math.random() < 0.5 ? -1 : 1);
        if (empty(c + first, r + 1)) { moveGrain(k, at(c + first, r + 1)); continue; }
        if (!side && empty(c - first, r + 1)) { moveGrain(k, at(c - first, r + 1)); continue; }
        // gekanteld: korrels glijden over een vlakke laag naar de lage kant
        if (side && Math.random() < slide && empty(c + side, r) && !empty(c + side, r + 1)) moveGrain(k, at(c + side, r));
      }
    }
    // bodemrij: ook daar glijden bij een stevige kanteling
    if (side) for (let i = 0; i < COLS; i++) {
      const c = side > 0 ? COLS - 1 - i : i, k = at(c, ROWS - 1);
      if (grid[k] && Math.random() < slide * 0.5 && empty(c + side, ROWS - 1)) moveGrain(k, at(c + side, ROWS - 1));
    }
  }

  function draw(chr, want) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const k = at(c, r);
      if (!grid[k]) { chr[k] = ''; want[k] = 0; continue; }
      const covered = r > 0 && grid[k - COLS];
      chr[k] = heat[k] > 0.5 ? '*' : covered ? ':' : '·';
      want[k] = heat[k];
    }
  }

  return {
    init() {
      grid = new Uint8Array(CELLS); count = 0;
      // een duin: hoger in het midden, met een ruwe kam
      for (let c = 0; c < COLS; c++) {
        const h = Math.round(3 + 2.4 * Math.sin(c / COLS * Math.PI) + Math.sin(c * 1.7) * 0.6);
        for (let r = ROWS - h; r < ROWS; r++) { grid[at(c, r)] = 1; count++; }
      }
    },
    step, draw,
    move(p) { dig = { ...p, vx: p.x - (lastX ?? p.x) }; lastX = p.x; },
    leave() { dig = null; pour = null; lastX = null; },
    hold(p) { pour = p; },
    release() { pour = null; },
    tap() {},
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

/* ---- Magneet: ijzervijlsel ---- */
// Elk teken is een splinter die zich traag naar het veld draait (- \ | /). De ene pool volgt je aanwijzer (zonder
// aanwijzer zwerft hij rustig rond); een tik zet een tweede pool neer met de andere lading, een tik erop haalt hem weg.
// Hoe sterker het veld en hoe sneller de splinter draait, hoe roder.
function magnet() {
  const ang = new Float32Array(CELLS), str = new Float32Array(CELLS), turn = new Float32Array(CELLS);
  const pole = { x: W * 0.35, y: HH * 0.5, tx: W * 0.35, ty: HH * 0.5 };
  let pinned = null, follow = false, t = 0;
  const GLYPHS = ['-', '\\', '|', '/'];
  function step() {
    t += 1 / 60;
    if (!follow) { pole.tx = W * (0.5 + 0.32 * Math.sin(t * 0.21)); pole.ty = HH * (0.5 + 0.3 * Math.sin(t * 0.33 + 1)); }
    pole.x += (pole.tx - pole.x) * 0.12; pole.y += (pole.ty - pole.y) * 0.12;
    const poles = pinned ? [[pole.x, pole.y, 1], [pinned.x, pinned.y, -1]] : [[pole.x, pole.y, 1]];
    for (let k = 0; k < CELLS; k++) {
      const cx = (k % COLS + 0.5) * CW, cy = (Math.floor(k / COLS) + 0.5) * CH;
      let fx = 0, fy = 0;
      for (const [px, py, q] of poles) {
        const ex = cx - px, ey = (cy - py) * 1.1, d2 = ex * ex + ey * ey + 40;
        fx += q * ex / d2; fy += q * ey / d2;
      }
      const goal = Math.atan2(fy, fx), m = Math.hypot(fx, fy) * 26;
      // splinters hebben geen kop of staart: draai de kortste weg binnen een halve slag
      let diff = goal - ang[k];
      diff = Math.atan2(Math.sin(2 * diff), Math.cos(2 * diff)) / 2;
      turn[k] = turn[k] * 0.78 + diff * 0.09 * Math.min(1, m + 0.15);
      ang[k] += turn[k];
      str[k] += (Math.min(1, m) - str[k]) * 0.1;
    }
  }
  function draw(chr, want) {
    for (let k = 0; k < CELLS; k++) {
      const a = ((ang[k] % Math.PI) + Math.PI) % Math.PI;          // 0..π
      chr[k] = str[k] < 0.06 ? '·' : GLYPHS[Math.round(a / (Math.PI / 4)) % 4];
      want[k] = clamp(str[k] * 0.3 + Math.abs(turn[k]) * 9, 0, 1);
    }
  }
  return {
    init() { for (let k = 0; k < CELLS; k++) ang[k] = Math.random() * Math.PI; str.fill(0); turn.fill(0); },
    step, draw,
    move(p) { follow = true; pole.tx = p.x; pole.ty = p.y; },
    leave() { follow = false; },
    tap(p) { pinned = pinned && Math.hypot(pinned.x - p.x, pinned.y - p.y) < 40 ? null : { ...p }; },
    still: true,   // het bakje schuift wel mee, maar het vijlsel voelt geen schok
  };
}

const FACTORIES = { water, sand, jelly, magnet };

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
  let drag = null, nudgeAt = 0, holdTimer = 0;

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
      m.step(m.still ? { gx: 0, gy: 1, ax: 0, ay: 0 } : { gx: Math.sin(tilt) - ax / GRAVITY, gy: Math.cos(tilt) - ay / GRAVITY, ax, ay });
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
    // ingedrukt houden zonder te slepen: gieten (zand)
    clearTimeout(holdTimer);
    const p = local(e);
    holdTimer = setTimeout(() => { if (drag && !drag.moved) mode().hold?.(p); }, 180);
  });
  box.addEventListener('pointermove', e => {
    if (reducedMotion.matches) return;
    const p = local(e);
    if (drag) {
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; clearTimeout(holdTimer); mode().release?.(); }
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
    clearTimeout(holdTimer);
    if (!drag.moved) { mode().release?.(); mode().tap(local(e)); }
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
      running = false; cancelAnimationFrame(raf); clearTimeout(holdTimer);
      drag = null; mode().leave();
      Object.assign(shift, { x: 0, y: 0, vx: 0, vy: 0, goalX: 0, goalY: 0 });
      box.style.translate = box.style.rotate = '';
    },
  };
}
