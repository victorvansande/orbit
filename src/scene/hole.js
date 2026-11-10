/* ---- Zwart gat: een bol erin slepen verwijdert de taak (Z1 Raster, Victor 10/11/2026) ---- */
// Klein zwart gat rechts onder de boog van het wiel (desktop; op gsm en liggend verschijnt het pas als je een bol
// vastneemt). Het beeld komt uit een echte straalberekening rond een niet-draaiend gat (Schwarzschild): schaduw,
// fotonring, de achterkant van de schijf boven en onder het gat omgebogen, de kant die naar je toe draait helderder
// (doppler) en het raster erachter mee gebogen. Getekend als zeshoekige rasterpunten, grootte = helderheid, zoals
// Luminet in 1979 het eerste beeld van zo'n gat maakte. Voorstellen: ontwerp/zwartgat/index.html.
import { tx } from '../core/i18n.js';

// Eenheden M = 1: horizon r = 2, fotonring b = 3√3, binnenste stabiele baan r = 6. Camera bijna in het vlak van de schijf.
const D = 34, ELEV = 7.5 * Math.PI / 180, R_IN = 6, R_OUT = 17, FOV = 0.8;
const CAM = [0, D * Math.sin(ELEV), D * Math.cos(ELEV)];
const FWD = [0, -Math.sin(ELEV), -Math.cos(ELEV)], RIGHT = [1, 0, 0], UP = [0, Math.cos(ELEV), -Math.sin(ELEV)];
const SHADOW = 0.249;   // straal van de schaduw in beeldeenheden (halve breedte = 1), uit de berekening zelf

// Eén lichtstraal terug vanaf de camera. x'' = -3M h² x / r^5 (h = |x × v|) geeft exact de lichtbanen van Schwarzschild
// (vergelijking van Binet). Tot drie kruisingen met de schijf, of gevangen, of ontsnapt (dan: richting voor het raster).
function trace(sx, sy) {
  let px = CAM[0], py = CAM[1], pz = CAM[2];
  let vx = FWD[0] + FOV * (sx * RIGHT[0] + sy * UP[0]), vy = FWD[1] + FOV * (sx * RIGHT[1] + sy * UP[1]), vz = FWD[2] + FOV * (sx * RIGHT[2] + sy * UP[2]);
  const n = Math.hypot(vx, vy, vz); vx /= n; vy /= n; vz /= n;
  const cx = py * vz - pz * vy, cy = pz * vx - px * vz, cz = px * vy - py * vx, h2 = cx * cx + cy * cy + cz * cz;
  const acc = (x, y, z) => { const r2 = x * x + y * y + z * z, k = -3 * h2 / (r2 * r2 * Math.sqrt(r2)); return [k * x, k * y, k * z]; };
  const hits = [];
  for (let i = 0; i < 3000; i++) {
    const r = Math.hypot(px, py, pz);
    if (r < 2.02) return { hits };
    if (r > D * 1.4 && px * vx + py * vy + pz * vz > 0) return { hits, esc: [vx, vy, vz] };
    const dt = Math.min(1.2, Math.max(0.012, 0.06 * (r - 1.6)));
    const a1 = acc(px, py, pz);
    const v2 = [vx + a1[0] * dt / 2, vy + a1[1] * dt / 2, vz + a1[2] * dt / 2], a2 = acc(px + vx * dt / 2, py + vy * dt / 2, pz + vz * dt / 2);
    const v3 = [vx + a2[0] * dt / 2, vy + a2[1] * dt / 2, vz + a2[2] * dt / 2], a3 = acc(px + v2[0] * dt / 2, py + v2[1] * dt / 2, pz + v2[2] * dt / 2);
    const v4 = [vx + a3[0] * dt, vy + a3[1] * dt, vz + a3[2] * dt], a4 = acc(px + v3[0] * dt, py + v3[1] * dt, pz + v3[2] * dt);
    const nx = px + dt / 6 * (vx + 2 * v2[0] + 2 * v3[0] + v4[0]), ny = py + dt / 6 * (vy + 2 * v2[1] + 2 * v3[1] + v4[1]), nz = pz + dt / 6 * (vz + 2 * v2[2] + 2 * v3[2] + v4[2]);
    const nvx = vx + dt / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]), nvy = vy + dt / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]), nvz = vz + dt / 6 * (a1[2] + 2 * a2[2] + 2 * a3[2] + a4[2]);
    if (py * ny < 0) {
      const f = py / (py - ny), hx = px + (nx - px) * f, hz = pz + (nz - pz) * f, rr = Math.hypot(hx, hz);
      if (rr >= R_IN && rr <= R_OUT) {
        // roodverschuiving van gas op een cirkelbaan: g = sqrt(1 - 3/r) / (1 - Ω L), Ω = r^-1,5, L = impulsmoment van
        // het foton om de as (we volgen terug, dus het foton zelf beweegt tegen v in)
        const kx = -(vx + (nvx - vx) * f), kz = -(vz + (nvz - vz) * f), L = hz * kx - hx * kz;
        hits.push({ r: rr, phi: Math.atan2(hz, hx), g: Math.sqrt(1 - 3 / rr) / (1 - Math.pow(rr, -1.5) * L), k: hits.length });
        if (hits.length >= 3) return { hits };
      }
    }
    px = nx; py = ny; pz = nz; vx = nvx; vy = nvy; vz = nvz;
  }
  return { hits };
}
// helderheid van de schijf (vorm van Page en Thorne), met banden die meedraaien met de echte verhouding van de baansnelheden
const emit = r => { const x = R_IN / r; return Math.max(0, (1 - Math.sqrt(x)) * x * x * x) / 0.0255; };
const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const BANDS = Array.from({ length: 64 }, (_, i) => 0.55 + 0.9 * hash(i + 1));
function shade(t, hits, gain) {
  let v = 0;
  for (const h of hits) {
    const spin = h.phi - Math.pow(h.r, -1.5) * t * 4;
    const ring = (h.r - R_IN) * 3.1, i0 = Math.floor(ring), fr = ring - i0;
    const tex = BANDS[i0 & 63] * (1 - fr) + BANDS[(i0 + 1) & 63] * fr;
    const swirl = 0.75 + 0.25 * Math.sin(spin * 3 + h.r * 1.7) * Math.sin(spin * 7 - h.r);
    v += emit(h.r) * tex * swirl * h.g ** 4 * (h.k ? 1.25 * gain : 1);   // boven het gat hangen: de omgebogen beelden lichten op
  }
  return 1 - Math.exp(-0.8 * v * gain);   // zachte begrenzing: de heldere kant brandt niet uit tot een vlek
}
function gridOf(esc) {   // het raster achter het gat, gezien langs de afgebogen straal (0..1)
  if (!esc) return 0;
  const f = esc[0] * FWD[0] + esc[1] * FWD[1] + esc[2] * FWD[2];
  if (f <= 0.05) return 0;
  const bx = (esc[0] * RIGHT[0] + esc[1] * RIGHT[1] + esc[2] * RIGHT[2]) / f, by = (esc[0] * UP[0] + esc[1] * UP[1] + esc[2] * UP[2]) / f;
  const u = bx / 0.085, w = by / 0.085;
  return Math.max(0, 1 - Math.hypot(u - Math.round(u), w - Math.round(w)) / 0.22);
}

const W_DESK = 120, H_DESK = 74, W_SMALL = 96, H_SMALL = 59;
const PLUNGE_MS = 2200;

export function createHole({ reducedMotion, permanent, minimal = () => false }) {
  const el = document.createElement('div');
  el.className = 'hole';
  el.setAttribute('aria-hidden', 'true');
  el.title = tx('hole.title');
  const cv = document.createElement('canvas');
  el.append(cv);
  const fx = document.createElement('canvas');   // val: over het hele scherm, want hij begint waar je loslaat
  fx.className = 'hole-fx';
  fx.setAttribute('aria-hidden', 'true');

  let field = null, filled = 0, hover = 0, hoverOn = false, dragging = false, falls = [], raf = 0, lastT = 0;
  let INK = [0, 0, 0], INK3 = [0, 0, 0];
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const rgbOf = c => { const g = fx.getContext('2d'); g.fillStyle = c; const h = g.fillStyle; return h.startsWith('#') ? [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) : h.match(/[\d.]+/g).slice(0, 3).map(Number); };
  function recolor() { INK = rgbOf(css('--ink')); INK3 = rgbOf(css('--ink-3')); wake(); }
  new MutationObserver(recolor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);

  const shown = () => (permanent.matches ? !document.body.classList.contains('is-focus') : dragging || falls.length > 0) && !document.hidden;
  const still = () => reducedMotion.matches || minimal();
  function size() { return permanent.matches ? [W_DESK, H_DESK] : [W_SMALL, H_SMALL]; }

  // Rasterpunten op een zeshoekig rooster, één straal per punt; eenmalig, in stukjes zodat niets hapert.
  function build() {
    const [w, h] = size(), cols = Math.round(w / 2.4), rows = Math.round(h / 2.1), asp = h / w;
    field = { w, h, cols, rows, cells: [] };
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = (i + 0.5 + (j % 2 ? 0.5 : 0)) / cols, y = (j + 0.5) / rows;
      field.cells.push({ x, y, sx: x * 2 - 1, sy: (1 - y * 2) * asp, res: null, bg: 0 });
    }
    filled = 0;
  }
  function fill(budget) {
    const t0 = performance.now();
    while (filled < field.cells.length && performance.now() - t0 < budget) { const c = field.cells[filled++]; c.res = trace(c.sx, c.sy); c.bg = gridOf(c.res.esc); }
  }

  function draw(t) {
    const [w, h] = size();
    if (!field || field.w !== w) build();
    if (filled < field.cells.length) fill(5);
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    const s = W / field.cols, rMax = s * 0.56, gain = 1 + 0.45 * hover;
    g.fillStyle = `rgb(${INK})`;
    g.beginPath();
    for (const c of field.cells) {
      if (!c.res) continue;
      const v = shade(t, c.res.hits, gain);
      if (v < 0.02) continue;
      const r = rMax * Math.sqrt(v);
      g.moveTo(c.x * W + r, c.y * H); g.arc(c.x * W, c.y * H, r, 0, Math.PI * 2);
    }
    g.fill();
    g.fillStyle = `rgba(${INK3},.6)`;
    g.beginPath();
    for (const c of field.cells) {
      if (!c.res || !c.bg || c.res.hits.length) continue;
      const r = rMax * 0.42 * c.bg;
      g.moveTo(c.x * W + r, c.y * H); g.arc(c.x * W, c.y * H, r, 0, Math.PI * 2);
    }
    g.fill();
  }

  // Val zoals een toeschouwer van ver hem ziet: in een spiraal naar binnen, uitgerekt door de getijden, steeds trager
  // vlak bij de schaduwrand (tijdvertraging: hij nadert die rand en raakt hem nooit), roder en doffer, dan weg.
  function drawFalls(now) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    if (fx.width !== W || fx.height !== H) { fx.width = W; fx.height = H; }
    const g = fx.getContext('2d');
    g.clearRect(0, 0, W, H);
    if (!falls.length) return;
    const b = cv.getBoundingClientRect(), hx = b.left + b.width / 2, hy = b.top + b.height / 2, rs = SHADOW * b.width / 2;
    falls = falls.filter(f => now - f.t0 < PLUNGE_MS);
    for (const f of falls) {
      const u = (now - f.t0) / PLUNGE_MS, r0 = Math.max(rs + 1, Math.hypot(f.x - hx, (f.y - hy) / 0.62)), a0 = Math.atan2((f.y - hy) / 0.62, f.x - hx);
      const k = 1 - Math.exp(-4.2 * u);
      const r = rs + (r0 - rs) * (1 - k), a = a0 + 3.3 * k * r0 / (r + 4);
      const z = Math.max(0.0001, 1 - rs / r);   // roodverschuiving: naar de rand toe dooft hij en wordt hij roder
      const fade = Math.pow(1 - u, 1.6) * Math.sqrt(z);
      const col = f.rgb.map((c, i) => Math.round(c + ([196, 24, 52][i] - c) * (1 - z)));
      const x = hx + Math.cos(a) * r, y = hy + Math.sin(a) * r * 0.62, stretch = 1 + 3.5 * (1 - z);
      g.save();
      g.translate(x * dpr, y * dpr); g.rotate(a + Math.PI / 2);
      g.fillStyle = `rgba(${col},${fade})`;
      g.beginPath(); g.ellipse(0, 0, 4.5 * dpr / Math.sqrt(stretch), 4.5 * dpr * stretch * 0.7, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }

  function frame(now) {
    raf = 0;
    const live = shown();
    hover += ((hoverOn ? 1 : 0) - hover) * (still() ? 1 : Math.min(1, (now - (lastT || now)) / 1000 * 8));
    lastT = now;
    if (live) draw(still() ? 0 : now / 1000);
    drawFalls(now);
    el.classList.toggle('is-on', shown());   // gsm: het gat blijft tot de val voorbij is
    // de lus loopt enkel zolang er iets beweegt: zichtbaar en niet stil, of een val die nog bezig is, of de berekening loopt nog
    if ((live && (!still() || filled < (field?.cells.length ?? 1) || Math.abs(hover - (hoverOn ? 1 : 0)) > 0.01)) || falls.length) raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf) raf = requestAnimationFrame(frame); }

  function update() {
    el.classList.toggle('is-on', shown());
    wake();
  }
  permanent.addEventListener('change', () => { field = null; place(); update(); });
  document.addEventListener('visibilitychange', update);
  new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // gsm en liggend: rechtsonder in de scène, links van het wiel als dat ernaast staat
  function place() {
    if (permanent.matches) { el.style.left = el.style.top = ''; return; }
    const sc = document.getElementById('scene')?.getBoundingClientRect(), wh = document.getElementById('wheel')?.getBoundingClientRect();
    if (!sc) return;
    let right = Math.min(sc.right, innerWidth) - 14;
    if (wh && wh.width && wh.left > sc.left + sc.width / 2 && wh.left < right && wh.bottom > sc.bottom - 80) right = wh.left - 8;   // liggend: het wiel staat rechts
    const bottom = Math.min(sc.bottom, innerHeight) - 12;
    el.style.left = `${Math.round(right - W_SMALL)}px`; el.style.top = `${Math.round(bottom - H_SMALL)}px`;
  }

  function center() { const b = cv.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, b.width, b.height]; }
  return {
    el, fx, recolor,
    // een bol wordt vastgenomen of losgelaten: op gsm verschijnt het gat
    setDragging(on) { dragging = on; if (on) place(); if (!on) hoverOn = false; update(); },
    // hangt de aanwijzer boven het gat (ruime ovale zone rond de schaduw)?
    hit(x, y) {
      if (!shown()) return false;
      const [cx, cy, w, h] = center();
      return ((x - cx) / (w * 0.5)) ** 2 + ((y - cy) / (h * 0.62)) ** 2 <= 1;
    },
    // zachte aantrekking van de versleepte bol, in px
    pull(x, y) {
      if (!shown() || still()) return [0, 0];
      const [cx, cy] = center(), d = Math.hypot(cx - x, cy - y), R = 110;
      if (d >= R) return [0, 0];
      const k = 0.22 * (1 - d / R) ** 2;
      return [(cx - x) * k, (cy - y) * k];
    },
    setHover(on) { if (on !== hoverOn) { hoverOn = on; wake(); } },
    // de bol valt erin, vanaf de plek waar hij losgelaten werd, in zijn eigen kleur
    swallow(x, y, rgb) {
      if (reducedMotion.matches) return;
      falls.push({ x, y, rgb, t0: performance.now() });
      wake();
    },
  };
}
