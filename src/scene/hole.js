/* ---- Zwart gat: een bol erin slepen verwijdert de taak (Z1 Raster, Victor 10/11/2026) ---- */
// Klein zwart gat rechts onder de boog van het wiel (desktop; op gsm en liggend verschijnt het pas als je een bol
// vastneemt). Alles wat je ziet komt uit de rekenfuncties van gravity.js (Schwarzschild, niet-draaiend gat):
// - het gat zelf: schaduw, fotonring, de achterkant van de schijf boven en onder het gat omgebogen, de kant die naar je
//   toe draait helderder (doppler), het raster erachter mee gebogen; als zeshoekige rasterpunten, grootte = helderheid;
// - de schijf leeft: heldere vlekken draaien mee met de echte baansnelheid van hun afstand en smeren daardoor uit;
// - een bol in de buurt wordt een wolk deeltjes. Vastgehouden rekt hij uit naar het gat (het verschil in gewicht over
//   de bol tegen zijn samenhang); te dichtbij scheuren deeltjes los en stromen naar binnen. Losgelaten valt elk deeltje
//   langs zijn eigen echte baan, in de tijd van een verre toeschouwer: de wolk wordt een draad (getijden), vertraagt aan
//   de rand, wordt roder en dooft uit. Elk deeltje wordt door de lens getekend, met een zwak tweede beeld aan de overkant.
// Voorstellen: ontwerp/zwartgat/index.html.
import { tx } from '../core/i18n.js';
import { trace, emit, gridOf, lensTable, stepFree, shift, weight, R_IN, FOV } from './gravity.js';

const TIME = 13;          // M per seconde: één klok voor de schijf en voor wat erin valt
const N = 120;            // deeltjes per bol
const STIFF = 0.0045;     // samenhang van de bol (veerconstante per massa): de enige vrije materiaalkeuze
const TEAR = 3.2;         // een deeltje scheurt los zodra het verder dan zoveel bolstralen van zijn plek getrokken is
const R_HOLD = 6;         // binnen de binnenste stabiele baan kan niets blijven hangen: daar neemt het gat de bol uit je hand
const HIT = 0.32, REACH = 0.56;   // loslaten binnen HIT x breedte verwijdert; binnen REACH neemt het gat de bol over
const SECOND = 14;        // het tweede beeld is in het echt ongeveer zoveel keer zwakker dan getekend (anders zie je het niet)
const RED = [196, 24, 52];
const THROW = 10;          // de aanwijzer beweegt veel sneller dan het licht op deze schaal: zijn snelheid telt voor een tiende
const GAMMA = 1.8;        // ontvangen lichtsterkte gaat met de vierde macht van de roodverschuiving; een scherm toont de 2,2-de machtswortel
const W_DESK = 120, H_DESK = 74, W_SMALL = 96, H_SMALL = 59;

const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
const BANDS = Array.from({ length: 64 }, (_, i) => 0.55 + 0.9 * hash(i + 1));

export function createHole({ reducedMotion, permanent, minimal = () => false, onEaten = () => {} }) {
  const el = document.createElement('div');
  el.className = 'hole';
  el.setAttribute('aria-hidden', 'true');
  el.title = tx('hole.title');
  const cv = document.createElement('canvas');
  el.append(cv);
  const fx = document.createElement('canvas');   // de bol en wat ervan valt: over het hele scherm
  fx.className = 'hole-fx';
  fx.setAttribute('aria-hidden', 'true');

  let field = null, filled = 0, lens = null, dragging = false, raf = 0, lastT = 0, fxDirty = false;
  let spots = [], spotSeed = 1, nextSpot = 0;
  let cloud = null;       // de vastgehouden bol: { rgb, a, C, parts: [{ ox, oy, dx, dy, gone }], left, dot }
  let loose = [];         // losse deeltjes in vrije val: { x, y, ux, uy, rgb, dot }
  let trail = [];         // laatste posities van de aanwijzer, voor de snelheid bij het loslaten
  let INK = [0, 0, 0], INK3 = [0, 0, 0];
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const rgbOf = c => { const g = fx.getContext('2d'); g.fillStyle = c; const h = g.fillStyle; return h.startsWith('#') ? [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) : h.match(/[\d.]+/g).slice(0, 3).map(Number); };
  function recolor() { INK = rgbOf(css('--ink')); INK3 = rgbOf(css('--ink-3')); wake(); }
  new MutationObserver(recolor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);

  const shown = () => (permanent.matches ? !document.body.classList.contains('is-focus') : dragging || loose.length > 0) && !document.hidden;
  const still = () => reducedMotion.matches || minimal();
  const size = () => (permanent.matches ? [W_DESK, H_DESK] : [W_SMALL, H_SMALL]);
  function center() { const b = cv.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, b.width]; }

  /* ---- Het gat: rasterpunten op een zeshoekig rooster, één lichtstraal per punt (eenmalig, in stukjes) ---- */
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
  // Vlekken in de schijf: heldere (zoals de opflakkeringen die bij het gat in het centrum van de Melkweg gemeten zijn)
  // en donkere (ijler gas), om en om. Elke vlek ontstaat op een afstand, leeft een paar omlopen en draait mee. Omdat elke afstand haar eigen baansnelheid
  // heeft (Ω = r^-1,5), loopt de binnenkant voor op de buitenkant en smeert de vlek uit tot een boog.
  function tendSpots(tm) {
    spots = spots.filter(s => tm - s.t0 < s.life);
    if (spots.length < 6 && tm >= nextSpot) {
      const q = k => hash(spotSeed * 7.13 + k), r0 = R_IN + 0.6 + q(1) * 7.5;
      spots.push({ r0, phi0: q(2) * Math.PI * 2, t0: tm, life: (1.6 + q(3) * 1.6) * Math.PI * 2 * Math.pow(r0, 1.5), amp: spotSeed % 2 ? 1 + q(4) * 1.4 : -0.55 - q(4) * 0.3, sr: 0.6 + q(5) * 0.7 });
      spotSeed++;
      nextSpot = tm + 14 + q(6) * 40;
    }
  }
  function shade(tm, hits) {
    let v = 0;
    for (const h of hits) {
      const ring = (h.r - R_IN) * 3.1, i0 = Math.floor(ring), fr = ring - i0;
      let hot = 1;
      for (const s of spots) {
        const dr = (h.r - s.r0) / s.sr;
        if (dr * dr > 9) continue;
        const age = tm - s.t0, a = h.phi - s.phi0 - Math.pow(h.r, -1.5) * age, d = (a - Math.PI * 2 * Math.round(a / (Math.PI * 2))) / 0.42;
        if (d * d > 9) continue;
        hot += s.amp * Math.sin(Math.PI * age / s.life) * Math.exp(-0.5 * (dr * dr + d * d));
      }
      v += emit(h.r) * (BANDS[i0 & 63] * (1 - fr) + BANDS[(i0 + 1) & 63] * fr) * Math.max(0.12, hot) * h.g ** 4 * (h.k ? 1.25 : 1);
    }
    return 1 - Math.exp(-0.62 * v);   // zachte begrenzing: de heldere kant brandt niet uit tot een vlek
  }
  function draw(tm) {
    const [w, h] = size();
    if (!field || field.w !== w) build();
    if (filled < field.cells.length) fill(5);
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    const s = W / field.cols, rMax = s * 0.56;
    g.fillStyle = `rgb(${INK})`;
    g.beginPath();
    for (const c of field.cells) {
      if (!c.res) continue;
      const v = shade(tm, c.res.hits);
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

  /* ---- De bol als wolk ---- */
  // Vastgehouden: de bol hangt aan de aanwijzer. Elk deeltje voelt zijn eigen gewicht (dat van iets wat stil hangt:
  // 1 / (r² sqrt(1 - 2/r)), oneindig aan de horizon) en wordt teruggehouden door de samenhang van de bol. De kant bij
  // het gat weegt meer dan de andere kant, dus de bol zakt door en rekt uit tot een druppel naar het gat toe. Ver weg is
  // dat een fractie van een pixel; dichtbij groeit het gewicht sneller dan de samenhang kan volgen: een deeltje loopt
  // weg, scheurt los en valt, het eerst aan de punt. Zo loopt de bol leeg langs een draad.
  function stepCloud(dt) {
    const c = cloud, k = 1 - Math.exp(-9 * dt), cap = 0.45 * TIME * dt;
    for (const p of c.parts) {
      if (p.gone) continue;
      const x = c.C[0] + p.ox + p.dx, y = c.C[1] + p.oy + p.dy, r = Math.max(2.06, Math.hypot(x, y)), gp = weight(r);
      let mx = (-x / r) * gp / STIFF - p.dx, my = (-y / r) * gp / STIFF - p.dy;
      mx *= k; my *= k;
      const m = Math.hypot(mx, my);
      if (m > cap) { mx *= cap / m; my *= cap / m; }
      p.dx += mx; p.dy += my;
      const nx = c.C[0] + p.ox + p.dx, ny = c.C[1] + p.oy + p.dy, nr = Math.hypot(nx, ny);
      if (Math.hypot(p.dx, p.dy) > TEAR * c.a || nr < 3.4) {
        p.gone = true; c.left--;
        const f = Math.sqrt(1 - 2 / Math.max(2.1, nr)), dtc = Math.max(1e-3, dt * TIME);
        loose.push({ x: nx, y: ny, ux: mx / dtc / f, uy: my / dtc / f, rgb: c.rgb, dot: c.dot });
      }
    }
    if (c.left < N * 0.3 || c.fall) {   // het gat heeft hem: de rest valt mee en de taak is weg
      cloud = null;
      dropAll(c, c.fall);
      onEaten();
    }
  }
  function dotAt(g, hx, hy, k, dpr, x, y, ux, uy, rgb, dot) {
    const r = Math.hypot(x, y), P = lens.primary(Math.min(r, lens.rMax));
    if (!P) return 0;
    const q = { x, y, ux, uy };
    const z = shift(q, P.b, true), a = Math.min(1, (z / 0.96) ** GAMMA);
    if (a > 0.02) {
      const t = Math.min(1, Math.max(0, (0.96 - z) * 1.25));   // roodverschuiving: naar rood, en via a naar donker
      g.fillStyle = `rgba(${rgb.map((c, i) => Math.round(c + (RED[i] - c) * t))},${a})`;
      g.beginPath(); g.arc((hx + x / r * P.tan * k) * dpr, (hy + y / r * P.tan * k) * dpr, dot * dpr, 0, Math.PI * 2); g.fill();
    }
    // tweede beeld: aan de overkant, vlak buiten de fotonring; het licht is er driekwart omheen gelopen
    const S = lens.secondary(r);
    if (S) {
      const z2 = Math.min(1.15, shift(q, S.b, false)), a2 = Math.min(0.85, (z2 / 0.96) ** GAMMA * SECOND * (S.tan / P.tan) * 0.02);
      if (a2 > 0.02) {
        g.fillStyle = `rgba(${rgb},${a2})`;
        g.beginPath(); g.arc((hx - x / r * S.tan * k) * dpr, (hy - y / r * S.tan * k) * dpr, Math.max(0.45, dot * 0.5) * dpr, 0, Math.PI * 2); g.fill();
      }
    }
    return a;
  }
  function drawFx(dt) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    if (fx.width !== W || fx.height !== H) { fx.width = W; fx.height = H; }
    const g = fx.getContext('2d');
    if (fxDirty) { g.clearRect(0, 0, W, H); fxDirty = false; }
    if (!lens || (!cloud && !loose.length)) return;
    fxDirty = true;
    const [hx, hy, w] = center(), k = w / 2 / FOV;
    if (cloud) {
      stepCloud(dt);
      const c = cloud;
      if (c) for (const p of c.parts) if (!p.gone) dotAt(g, hx, hy, k, dpr, c.C[0] + p.ox + p.dx, c.C[1] + p.oy + p.dy, 0, 0, c.rgb, c.dot);
    }
    const keep = [];
    for (const p of loose) {
      const alive = stepFree(p, dt * TIME);
      const a = dotAt(g, hx, hy, k, dpr, p.x, p.y, p.ux, p.uy, p.rgb, p.dot);
      if (alive && a > 0.04) keep.push(p);
    }
    loose = keep;
  }

  // Vooraf rekenen in rustige momenten (gsm: het gat verschijnt pas bij het slepen en moet dan klaar zijn)
  function warm() {
    if (!field) build();
    if (filled < field.cells.length) fill(4);
    else if (!lens) { lens = lensTable(); return; }
    setTimeout(warm, 60);
  }
  setTimeout(warm, 2500);

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (lastT || now)) / 1000);
    lastT = now;
    const live = shown(), tm = still() ? 0 : now / 1000 * TIME;
    if (live) { if (!still()) tendSpots(tm); draw(tm); }
    drawFx(dt);
    el.classList.toggle('is-on', shown());   // gsm: het gat blijft tot alles gevallen is
    // de lus loopt enkel zolang er iets beweegt of nog gerekend wordt
    if ((live && (!still() || filled < (field?.cells.length ?? 1))) || cloud || loose.length || fxDirty) raf = requestAnimationFrame(frame);
    else lastT = 0;
  }
  function wake() { if (!raf) raf = requestAnimationFrame(frame); }
  function update() { el.classList.toggle('is-on', shown()); wake(); }
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

  // Wat er van de bol over is, valt: elk deeltje op zijn eigen baan. Met `moving` krijgt het de snelheid en richting van
  // de aanwijzer mee (begrensd: niet naar buiten, hooguit 0,4 c, en met zo weinig draaiing dat alles erin eindigt in
  // plaats van te blijven cirkelen: onder L = sqrt(12) heeft geen enkele baan een keerpunt).
  function dropAll(c, moving) {
    const [, , w] = center(), k = w / 2 / FOV, rc = Math.hypot(c.C[0], c.C[1]), ex = c.C[0] / rc, ey = c.C[1] / rc;
    let vx = 0, vy = 0;
    if (moving && trail.length > 1) {
      const a = trail[0], b = trail[trail.length - 1], dtm = Math.max(16, b[0] - a[0]) / 1000, scale = pxPerM(rc, k) * TIME * THROW;
      if (performance.now() - b[0] < 120) { vx = (b[1] - a[1]) / dtm / scale; vy = (b[2] - a[2]) / dtm / scale; }   // stil gehouden voor het loslaten: uit rust
    }
    let vr = Math.min(0, vx * ex + vy * ey), vt = vx * -ey + vy * ex;
    const sp = Math.hypot(vr, vt);
    if (sp > 0.4) { vr *= 0.4 / sp; vt *= 0.4 / sp; }
    const f = Math.sqrt(1 - 2 / rc);
    vr /= f; vt /= f;
    let far = 0;
    for (const p of c.parts) if (!p.gone) far = Math.max(far, Math.hypot(c.C[0] + p.ox + p.dx, c.C[1] + p.oy + p.dy));
    if (Math.abs(vt) * far > 3.2) vt *= 3.2 / (Math.abs(vt) * far);
    const ux = vr * ex - vt * ey, uy = vr * ey + vt * ex;
    for (const p of c.parts) if (!p.gone) loose.push({ x: c.C[0] + p.ox + p.dx, y: c.C[1] + p.oy + p.dy, ux, uy, rgb: c.rgb, dot: c.dot });
  }
  // px per M van het hoofdbeeld op afstand rc
  const pxPerM = (rc, k) => (lens.primary(Math.min(lens.rMax, rc + 0.5)).tan - lens.primary(Math.max(2.1, rc - 0.5)).tan) * k;
  function newCloud(rgb, rpx, k, rc) {
    const a = rpx / pxPerM(rc, k), parts = [];   // straal van de bol in M
    for (let i = 0; i < N; i++) { const rr = a * Math.sqrt((i + 0.5) / N), th = i * 2.399963; parts.push({ ox: rr * Math.cos(th), oy: rr * Math.sin(th), dx: 0, dy: 0, gone: false }); }
    return { rgb, a, C: [rc, 0], parts, left: N, dot: Math.max(0.7, rpx * 0.21) };
  }

  return {
    el, fx, recolor,
    // een bol wordt vastgenomen of losgelaten: op gsm verschijnt het gat
    setDragging(on) { dragging = on; if (on) { place(); trail = []; } update(); },
    // De versleepte bol staat op (x, y), met kleur en straal op het scherm. Geeft terug of loslaten hier verwijdert
    // (`over`) en of het gat de bol nu zelf tekent (`taken`: de scène laat hem dan weg).
    hold(x, y, rgb, rpx) {
      if (!shown()) return { over: false, taken: false };
      const [hx, hy, w] = center(), dx = x - hx, dy = y - hy, rho = Math.hypot(dx, dy), now = performance.now();
      trail.push([now, x, y]);
      while (trail.length > 2 && now - trail[0][0] > 90) trail.shift();
      const over = rho <= HIT * w, taken = !still() && Boolean(lens) && rho <= REACH * w;
      if (taken) {
        const k = w / 2 / FOV, raw = lens.radius(rho / k), rc = Math.max(R_HOLD, raw);
        if (!cloud) cloud = newCloud(rgb, rpx, k, rc);
        const ux = rho > 0.5 ? dx / rho : 1, uy = rho > 0.5 ? dy / rho : 0;
        cloud.C = [ux * rc, uy * rc];
        if (raw < R_HOLD) cloud.fall = true;   // te diep: het volgende beeld laat het gat hem vallen (zie stepCloud)
      } else cloud = null;
      wake();
      return { over, taken };
    },
    // Losgelaten. Boven het gat: wat er van de bol over is, valt (zie dropAll). Geeft true als de taak weg moet.
    release(x, y) {
      const c = cloud;
      cloud = null;
      wake();
      if (!shown()) return false;
      const [hx, hy, w] = center();
      if (Math.hypot(x - hx, y - hy) > HIT * w) return false;
      if (c) dropAll(c, true);   // zonder wolk (minder beweging, Minimaal, lens nog niet klaar): gewoon weg
      return true;
    },
  };
}
