/* ---- Raster in het bakje van de focusmodus ---- */
// Gekozen door Victor (12/11/2026, R1 Deining uit ontwerp/raster/): een veld zeshoekige rasterpunten als wateroppervlak.
// Elke golf loopt echt door het veld (golfvergelijking op het zeshoekige rooster), kaatst tegen de rand en dooft uit.
// Grootte van een punt = hoogte van het water. Tik = druppel, slepen of met de muis erover = kielzog; blijf je weg,
// dan valt er om de paar seconden vanzelf een druppel. Kleur uit de kleurkiezer, anders inkt.
// Een groter bakje krijgt meer punten van dezelfde maat. Minder beweging: één stilstaand beeld.

const S = 7, RH = S * Math.sqrt(3) / 2;   // afstand tussen de punten, hoogte van een rij
const C2 = 0.035, DAMP = 0.995, DT = 1 / 60;   // golfsnelheid en demping per vaste stap: gelijk op 60 en 120 Hz
const HEX = Array.from({ length: 6 }, (_, n) => [Math.cos(Math.PI / 6 + n * Math.PI / 3), Math.sin(Math.PI / 6 + n * Math.PI / 3)]);

export function createRaster({ reducedMotion, accent, size }) {
  const W = size?.w || 325.6, H = size?.h || 226.8;
  const COLS = Math.floor((W - S / 2) / S) + 1, ROWS = Math.floor(H / RH) + 1, N = COLS * ROWS;
  const OX = (W - ((COLS - 1) * S + S / 2)) / 2, OY = (H - (ROWS - 1) * RH) / 2;
  const PX = new Float32Array(N), PY = new Float32Array(N), NB = new Int32Array(N * 6);
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const k = j * COLS + i, o = j & 1;   // rijen om en om een halve stap verschoven
    PX[k] = OX + i * S + (o ? S / 2 : 0); PY[k] = OY + j * RH;
    [[i - 1, j], [i + 1, j], [i - 1 + o, j - 1], [i + o, j - 1], [i - 1 + o, j + 1], [i + o, j + 1]]
      .forEach(([x, y], n) => { NB[k * 6 + n] = x < 0 || y < 0 || x >= COLS || y >= ROWS ? k : y * COLS + x; });   // rand: spiegelt
  }
  const h = new Float32Array(N), v = new Float32Array(N);
  let cv = null, g = null, dpr = 1, lastNow = 0, acc = 0, wait = 1, quiet = 9;
  let at = null;                       // vorige plek van muis of vinger
  let C = {}, colorsAt = -9e9;

  function colors(now) {
    if (now - colorsAt < 500 && C.pen) return C;
    colorsAt = now;
    const cs = getComputedStyle(document.documentElement);
    C = {
      pen: accent?.() || cs.getPropertyValue('--ink').trim() || '#1B1B22',
      well: (cv && getComputedStyle(cv.closest('.fidget') || cv).backgroundColor) || cs.getPropertyValue('--well').trim(),
    };
    return C;
  }

  // een bult (of kuil) in het water rond een punt
  function drop(x, y, amp, rad = 26) {
    const j0 = Math.max(0, Math.floor((y - rad - OY) / RH)), j1 = Math.min(ROWS - 1, Math.ceil((y + rad - OY) / RH));
    const i0 = Math.max(0, Math.floor((x - rad - OX) / S) - 1), i1 = Math.min(COLS - 1, Math.ceil((x + rad - OX) / S));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * COLS + i, dx = PX[k] - x, dy = PY[k] - y, d2 = dx * dx + dy * dy;
      if (d2 < rad * rad) h[k] += amp * Math.exp(-d2 / (rad * rad * 0.13));
    }
  }
  function step() {
    for (let k = 0; k < N; k++) {
      const n = k * 6;
      v[k] = (v[k] + C2 * (h[NB[n]] + h[NB[n + 1]] + h[NB[n + 2]] + h[NB[n + 3]] + h[NB[n + 4]] + h[NB[n + 5]] - 6 * h[k])) * DAMP;
    }
    for (let k = 0; k < N; k++) h[k] += v[k];
  }
  function draw(now) {
    if (!g) return;
    const c = colors(now);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = c.well; g.fillRect(0, 0, W, H);
    g.fillStyle = c.pen; g.beginPath();
    for (let k = 0; k < N; k++) {
      const e = 1 - Math.exp(-Math.abs(h[k]) * 3.2);          // kleine golven blijven leesbaar
      const r = 1.2 + (h[k] > 0 ? 2.15 : -0.95) * e, x = PX[k], y = PY[k];
      g.moveTo(x + HEX[0][0] * r, y + HEX[0][1] * r);
      for (let n = 1; n < 6; n++) g.lineTo(x + HEX[n][0] * r, y + HEX[n][1] * r);
      g.closePath();
    }
    g.fill();
  }
  function still() {
    h.fill(0); v.fill(0);
    drop(W * 0.38, H * 0.52, 1.6);
    for (let s = 0; s < 70; s++) step();
    draw(performance.now());
  }

  return {
    own: true,
    init() { /* het veld begint vlak */ },
    mount(el) {
      if (cv) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv = document.createElement('canvas');
      cv.className = 'panel-canvas'; cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      el.append(cv);
      g = cv.getContext('2d');
      lastNow = 0; acc = 0; colorsAt = -9e9; at = null;
      if (reducedMotion.matches) still();
    },
    unmount() { cv?.remove(); cv = null; g = null; at = null; },
    frame(now) {
      if (!g || reducedMotion.matches) return;
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0;
      lastNow = now;
      quiet += dt; wait -= dt;
      if (wait < 0 && quiet > 2.5) {   // niemand thuis: af en toe een druppel
        wait = 2.5 + Math.random() * 3;
        drop(20 + Math.random() * (W - 40), 20 + Math.random() * (H - 40), 1.3);
      }
      acc += dt;
      while (acc >= DT) { acc -= DT; step(); }
      draw(now);
    },
    down(p) { at = { x: p.x, y: p.y }; quiet = 0; },
    // kielzog: een ondiepe geul langs de weg van muis of vinger
    move(p) {
      quiet = 0;
      if (!at) { at = { x: p.x, y: p.y }; return; }
      const d = Math.hypot(p.x - at.x, p.y - at.y), n = Math.max(1, Math.ceil(d / 5));
      for (let i = 1; i <= n; i++) drop(at.x + (p.x - at.x) * i / n, at.y + (p.y - at.y) * i / n, -0.05 * Math.min(6, d / n), 20);
      at = { x: p.x, y: p.y };
    },
    up() { if (matchMedia('(hover: none)').matches) at = null; },
    leave() { at = null; },
    tap(p) { quiet = 0; drop(p.x, p.y, 1.7); },
    recolor() { colorsAt = -9e9; },
  };
}
