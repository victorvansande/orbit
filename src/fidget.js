/* ---- Bakje water in de focusmodus (liquid ascii) ---- */
// Een klein bakje met water, getekend in mono-tekens op een canvas. De kleur volgt hoe woelig het water is: stil in
// grijze inkt, hoe harder het beweegt hoe roder (verloop naar het rode korrelverloop van de Bierfeesten), met korrel. Het water is een echte deeltjesvloeistof (dubbele
// dichtheidsrelaxatie, Clavet e.a. 2005) waar de zwaartekracht op werkt: sleep het bakje heen en weer en het water
// klotst, het bakje kantelt mee en het oppervlak blijft waterpas; beweeg erover en je roert erin, een tik geeft een
// plons. Loopt alleen zolang de focusmodus aan staat en het tabblad zichtbaar is.

const COLS = 40, ROWS = 14;
const CW = 7.4, CH = 12.6;        // maat van één teken (px), Geist Mono 11 px
const N = 760;                    // deeltjes: vult ongeveer de onderste helft
const H = 13;                     // interactiestraal (px)
const REST = 2.2, K = 0.06, K_NEAR = 0.15;   // rustdichtheid en stijfheid (dimensieloos, schaalt met H)
const SIGMA = 0.035, BETA = 0.01;  // viscositeit: laag, zodat het water vloeit en nadeint zonder te spatten
const LEVELS = 14;                // kleurstappen in het verloop
const GRAVITY = 0.16;             // px per stap², 60 stappen per seconde
const STEP_MS = 1000 / 60;
const TILT = 0.3;                 // graden kanteling per px uitwijking van het bakje
const MAX_SHIFT = 26;             // px, zo ver volgt het bakje je sleepbeweging

export function createFidget(box, { reducedMotion }) {
  const cv = box.querySelector('canvas');
  const W = COLS * CW, Hh = ROWS * CH;
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
  cv.style.width = `${W}px`; cv.style.height = `${Hh}px`;
  const g = cv.getContext('2d');
  const agit = new Float32Array(COLS * ROWS);   // woeligheid per teken, zacht nagevolgd (0..1)
  let palette = null, paletteAt = 0;
  const x = new Float32Array(N), y = new Float32Array(N), px = new Float32Array(N), py = new Float32Array(N);
  const vx = new Float32Array(N), vy = new Float32Array(N);
  let raf = 0, running = false, acc = 0, last = 0, ready = false;
  // het bakje zelf: uitwijking (px) met een veer terug, en de versnelling die het water voelt
  const shift = { x: 0, y: 0, vx: 0, vy: 0, goalX: 0, goalY: 0 };
  let drag = null, stir = null, nudgeAt = 0;

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

  function seed() {
    // in een rooster in de onderste helft, licht verschoven, zodat het meteen zakt en zich zet
    const s = H * 0.5, cols = Math.floor((W - 4) / s);
    for (let i = 0; i < N; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      x[i] = 2 + (c + 0.5 + (r % 2) * 0.5) * s;
      y[i] = Hh - 2 - (r + 0.5) * s * 0.87;
      vx[i] = vy[i] = 0;
    }
    ready = true;
  }

  // ruimtelijk raster voor buren
  let cellW = 0, gridCols = 0, heads = null;
  const nextIdx = new Int32Array(N);
  function buildGrid() {
    cellW = H; gridCols = Math.ceil(W / H) + 2;
    const rows = Math.ceil(Hh / H) + 2;
    if (!heads || heads.length !== gridCols * rows) heads = new Int32Array(gridCols * rows);
    heads.fill(-1);
    for (let i = 0; i < N; i++) {
      const c = Math.min(gridCols - 1, Math.max(0, Math.floor(x[i] / cellW) + 1));
      const r = Math.min(heads.length / gridCols - 1, Math.max(0, Math.floor(y[i] / cellW) + 1));
      const k = r * gridCols + c;
      nextIdx[i] = heads[k]; heads[k] = i;
    }
  }
  function forNeighbors(i, fn) {
    const c0 = Math.floor(x[i] / cellW) + 1, r0 = Math.floor(y[i] / cellW) + 1, rows = heads.length / gridCols;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      if (r < 0 || r >= rows) continue;
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        if (c < 0 || c >= gridCols) continue;
        for (let j = heads[r * gridCols + c]; j !== -1; j = nextIdx[j]) if (j > i) fn(j);
      }
    }
  }

  function step(ax, ay) {
    // zwaartekracht in het assenstelsel van het (gekantelde) bakje, plus de schok van het bakje zelf
    const tilt = -shift.x * TILT * Math.PI / 180;
    const gx = Math.sin(tilt) * GRAVITY - ax, gy = Math.cos(tilt) * GRAVITY - ay;
    for (let i = 0; i < N; i++) { vx[i] += gx; vy[i] += gy; }
    // roeren met de aanwijzer
    if (stir) {
      for (let i = 0; i < N; i++) {
        const dx = x[i] - stir.x, dy = y[i] - stir.y, d2 = dx * dx + dy * dy;
        if (d2 < 400) { const f = (1 - Math.sqrt(d2) / 20) * 0.35; vx[i] += stir.vx * f; vy[i] += stir.vy * f; }
      }
      stir.vx *= 0.5; stir.vy *= 0.5;
    }
    buildGrid();
    // viscositeit
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
    for (let i = 0; i < N; i++) {
      px[i] = x[i]; py[i] = y[i];
      x[i] += vx[i]; y[i] += vy[i];
    }
    buildGrid();
    // dubbele dichtheidsrelaxatie: houdt de vloeistof samen zonder dat ze samendrukt
    const rho = new Float32Array(N), rhoN = new Float32Array(N);
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
    // wanden van het bakje (open bovenaan, maar hoog genoeg), daarna snelheid uit de verplaatsing
    for (let i = 0; i < N; i++) {
      if (x[i] < 2) x[i] = 2 + Math.random() * 0.01;
      else if (x[i] > W - 2) x[i] = W - 2 - Math.random() * 0.01;
      if (y[i] > Hh - 2) { y[i] = Hh - 2 - Math.random() * 0.01; x[i] += (px[i] - x[i]) * 0.06; }   // een beetje wrijving op de bodem
      else if (y[i] < 1) y[i] = 1;
      vx[i] = (x[i] - px[i]) * 0.998; vy[i] = (y[i] - py[i]) * 0.998;
    }
  }

  // het bakje volgt je sleepbeweging en veert terug; zijn versnelling is wat het water voelt
  function moveBox() {
    const k = drag ? 0.25 : 0.06, damp = drag ? 0.6 : 0.82;
    const ax = (shift.goalX - shift.x) * k, ay = (shift.goalY - shift.y) * k;
    const nvx = (shift.vx + ax) * damp, nvy = (shift.vy + ay) * damp;
    const accX = nvx - shift.vx, accY = nvy - shift.vy;
    shift.vx = nvx; shift.vy = nvy;
    shift.x += shift.vx; shift.y += shift.vy;
    if (!drag) { shift.goalX = 0; shift.goalY = 0; }
    return [accX, accY];
  }

  function render(now = 0) {
    // per teken: aantal deeltjes en hun gemiddelde snelheid (dichtstbijzijnde cel, geen uitsmeren: anders hangt er
    // een nevel boven het oppervlak)
    const d = new Float32Array(COLS * ROWS), sp = new Float32Array(COLS * ROWS);
    for (let i = 0; i < N; i++) {
      const c = Math.min(COLS - 1, Math.max(0, Math.floor(x[i] / CW))), r = Math.min(ROWS - 1, Math.max(0, Math.floor(y[i] / CH)));
      d[r * COLS + c]++; sp[r * COLS + c] += Math.hypot(vx[i], vy[i]);
    }
    if (!palette || now - paletteAt > 1000) { palette = readPalette(); paletteAt = now; }
    const full = N / (COLS * ROWS) * 1.9;   // aantal in een volle cel
    const groups = Array.from({ length: LEVELS }, () => []);
    const tick = Math.floor(now / 140);    // de korrel verschuift traag, zoals ruis op film
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const k = r * COLS + c, v = d[k] / full, above = r > 0 ? d[k - COLS] / full : 0;
        const speed = d[k] ? sp[k] / d[k] : 0;
        // woeligheid: snelheid van het water in dit teken, traag aan en uit zodat de kleur vloeit
        const want = Math.min(1, Math.max(0, (speed - 0.55) / 3));
        agit[k] += (want - agit[k]) * (want > agit[k] ? 0.35 : 0.06);
        let chr = '';
        if (v > 0.45 && above < 0.3) chr = '~';                       // het oppervlak
        else if (v > 0.45) chr = speed > 0.8 ? '≈' : '=';             // binnenin: golvend waar het beweegt
        else if (v > 0.2) chr = '-';
        else if (v > 0) chr = above > 0.45 ? '-' : '·';               // druppels en spetters
        if (!chr) continue;
        // korrel: elk teken wijkt een beetje af van het verloop, meer naarmate het water woeliger is
        const h = (Math.imul(k + 1, 374761393) ^ Math.imul(tick + 7, 668265263)) >>> 0;
        const grain = ((h % 1000) / 1000 - 0.5) * (0.08 + 0.22 * agit[k]);
        const lv = Math.min(LEVELS - 1, Math.max(0, Math.round((agit[k] + grain) * (LEVELS - 1))));
        groups[lv].push(chr, c * CW + CW / 2, r * CH + CH / 2);
      }
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, Hh);
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
    // af en toe een zacht duwtje, zodat het water nooit lang helemaal stil ligt
    if (now > nudgeAt && !drag) {
      shift.vx += (Math.random() < 0.5 ? -1 : 1) * (0.6 + 0.5 * Math.random());
      nudgeAt = now + 9000 + Math.random() * 7000;
    }
    let n = 0;
    while (acc >= STEP_MS && n < 3) { const [ax, ay] = moveBox(); step(ax, ay); acc -= STEP_MS; n++; }
    if (n === 3) acc = 0;
    render(now);
    raf = requestAnimationFrame(frame);
  }

  // tekens op het scherm naar het assenstelsel van het bakje (zonder de kanteling, die is klein)
  const local = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * Hh }; };
  box.addEventListener('pointerdown', e => {
    if (reducedMotion.matches) return;
    drag = { x0: e.clientX, y0: e.clientY, moved: false };
    box.setPointerCapture(e.pointerId);
    box.classList.add('is-dragging');
  });
  box.addEventListener('pointermove', e => {
    if (reducedMotion.matches) return;
    if (drag) {
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      const lim = v => MAX_SHIFT * Math.tanh(v / MAX_SHIFT);   // zacht begrensd
      shift.goalX = lim(dx); shift.goalY = lim(dy) * 0.6;
      return;
    }
    const p = local(e);
    stir = stir ? { x: p.x, y: p.y, vx: (p.x - stir.x) * 0.6 + stir.vx, vy: (p.y - stir.y) * 0.6 + stir.vy } : { ...p, vx: 0, vy: 0 };
  });
  const endDrag = e => {
    if (!drag) return;
    if (!drag.moved) {
      // tik: een plons vanaf die plek
      const p = local(e);
      for (let i = 0; i < N; i++) {
        const dx = x[i] - p.x, dy = y[i] - p.y, d = Math.hypot(dx, dy);
        if (d < 30) { const f = (1 - d / 30) * 3.2; vx[i] += dx / (d || 1) * f; vy[i] += dy / (d || 1) * f - 1.5 * (1 - d / 30); }
      }
    }
    drag = null;
    box.classList.remove('is-dragging');
  };
  box.addEventListener('pointerup', endDrag);
  box.addEventListener('pointercancel', endDrag);
  box.addEventListener('pointerleave', () => { stir = null; });

  return {
    start() {
      if (running) return;
      if (!ready) { seed(); for (let k = 0; k < 240; k++) step(0, 0); }   // vooraf laten zakken
      if (reducedMotion.matches) { render(); return; }
      running = true; last = 0; acc = 0;
      nudgeAt = performance.now() + 2500;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false; cancelAnimationFrame(raf);
      drag = null; stir = null;
      Object.assign(shift, { x: 0, y: 0, vx: 0, vy: 0, goalX: 0, goalY: 0 });
      box.style.translate = box.style.rotate = '';
    },
  };
}
