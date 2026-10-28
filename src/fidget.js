/* ---- Vijver: een glaasje vloeistof in de focusmodus (liquid ascii) ---- */
// Een klein bakje met water, getekend in mono-tekens. Het water is een echte deeltjesvloeistof (dubbele
// dichtheidsrelaxatie, Clavet e.a. 2005) waar de zwaartekracht op werkt: sleep het bakje heen en weer en het water
// klotst, het bakje kantelt mee en het oppervlak blijft waterpas; beweeg erover en je roert erin, een tik geeft een
// plons. Loopt alleen zolang de focusmodus aan staat en het tabblad zichtbaar is.

const COLS = 34, ROWS = 12;
const N = 560;                    // deeltjes: vult ongeveer de onderste helft
const H = 13;                     // interactiestraal (px)
const REST = 2.2, K = 0.07, K_NEAR = 0.16;   // rustdichtheid en stijfheid (dimensieloos, schaalt met H)
const SIGMA = 0.06, BETA = 0.02;  // viscositeit: lineair en kwadratisch
const GRAVITY = 0.16;             // px per stap², 60 stappen per seconde
const STEP_MS = 1000 / 60;
const TILT = 0.3;                 // graden kanteling per px uitwijking van het bakje
const MAX_SHIFT = 26;             // px, zo ver volgt het bakje je sleepbeweging

export function createFidget(box, { reducedMotion }) {
  const pre = box.querySelector('pre');
  pre.textContent = `${' '.repeat(COLS)}\n`.repeat(ROWS);   // vaste maat, ook vóór de eerste weergave
  let W = 0, Hh = 0;
  const x = new Float32Array(N), y = new Float32Array(N), px = new Float32Array(N), py = new Float32Array(N);
  const vx = new Float32Array(N), vy = new Float32Array(N);
  let raf = 0, running = false, acc = 0, last = 0, ready = false;
  // het bakje zelf: uitwijking (px) met een veer terug, en de versnelling die het water voelt
  const shift = { x: 0, y: 0, vx: 0, vy: 0, goalX: 0, goalY: 0 };
  let drag = null, stir = null, nudgeAt = 0;

  function measure() {
    const r = pre.getBoundingClientRect();
    if (!r.width) return false;
    W = r.width; Hh = r.height;
    return true;
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
      if (y[i] > Hh - 2) { y[i] = Hh - 2 - Math.random() * 0.01; x[i] += (px[i] - x[i]) * 0.2; }   // wat wrijving op de bodem
      else if (y[i] < 1) y[i] = 1;
      vx[i] = (x[i] - px[i]) * 0.995; vy[i] = (y[i] - py[i]) * 0.995;
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

  function render() {
    // per teken: aantal deeltjes en hun gemiddelde snelheid (dichtstbijzijnde cel, geen uitsmeren: anders hangt er
    // een nevel boven het oppervlak)
    const cw = W / COLS, ch = Hh / ROWS, d = new Float32Array(COLS * ROWS), sp = new Float32Array(COLS * ROWS);
    for (let i = 0; i < N; i++) {
      const c = Math.min(COLS - 1, Math.max(0, Math.floor(x[i] / cw))), r = Math.min(ROWS - 1, Math.max(0, Math.floor(y[i] / ch)));
      d[r * COLS + c]++; sp[r * COLS + c] += Math.hypot(vx[i], vy[i]);
    }
    const full = N / (COLS * ROWS) * 1.9;   // aantal in een volle cel
    let out = '';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const k = r * COLS + c, v = d[k] / full, above = r > 0 ? d[k - COLS] / full : 0;
        let chr = ' ';
        if (v > 0.45 && above < 0.3) chr = '~';                       // het oppervlak
        else if (v > 0.45) chr = sp[k] / d[k] > 0.8 ? '≈' : '=';      // binnenin: golvend waar het beweegt
        else if (v > 0.2) chr = '-';
        else if (v > 0) chr = above > 0.45 ? '-' : '·';               // druppels en spetters
        out += chr;
      }
      out += '\n';
    }
    pre.textContent = out;
    box.style.translate = `${shift.x.toFixed(1)}px ${shift.y.toFixed(1)}px`;
    box.style.rotate = `${(shift.x * TILT).toFixed(2)}deg`;
  }

  function frame(now) {
    if (!running) return;
    acc += Math.min(100, now - (last || now));
    last = now;
    // af en toe een zacht duwtje, zodat het water nooit lang helemaal stil ligt
    if (now > nudgeAt && !drag) {
      shift.vx += (Math.random() < 0.5 ? -1 : 1) * (1.2 + Math.random());
      nudgeAt = now + 9000 + Math.random() * 7000;
    }
    let n = 0;
    while (acc >= STEP_MS && n < 3) { const [ax, ay] = moveBox(); step(ax, ay); acc -= STEP_MS; n++; }
    if (n === 3) acc = 0;
    render();
    raf = requestAnimationFrame(frame);
  }

  // tekens op het scherm naar het assenstelsel van het bakje (zonder de kanteling, die is klein)
  const local = e => { const r = pre.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * Hh }; };
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
      if (!measure()) { requestAnimationFrame(() => { if (!running && measure()) this.start(); }); return; }
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
