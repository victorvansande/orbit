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
import { trace, emit, lensSteps, backdropSteps, stepFree, shift, weight, FOV, D } from './gravity.js';

const TIME = 25;          // M per seconde: één klok voor de schijf en voor wat erin valt
const N = 120;            // deeltjes per bol
// Uitvergroot (Victor, 11/11/2026: "De effecten mogen gewoon meer uitgesproken zijn aangezien het zwarte gat al zo klein
// is"): de vorm volgt de echte getijden (verschil in gewicht over de bol), de sterkte is opgeschroefd.
// Van verder (Victor, 11/11/2026: "De bollen die ik ernaartoe sleep mogen ook al van iets verder beginnen gezogen
// worden"): het gat grijpt nu op 300 px en trekt de bol al van ver naar zich toe (SAG x 5: op 300 px 3 px, op 120 px
// 19 px); de getijden enkel 1,3 keer sterker, zodat losscheuren rond 24 M begint (TEAR_R). Met de getijden 1,5³ keer
// sterker klonterde de bol op 120 px tot twee losse bolletjes en bleven losgescheurde deeltjes als spoor hangen.
const STIFF = 5.3e-5 / 1.3;   // samenhang van de bol tegen het verschil in gewicht: rek x2 op 33 M
const SAG = 2500 * 5;     // hoe ver de hele bol naar het gat toe gezogen wordt per eenheid gewicht (op 75 M ongeveer 2 M)
const TEAR = 3.2, TEAR_R = 24;   // een deeltje scheurt los zodra het verder dan zoveel bolstralen van zijn plek getrokken is, en enkel binnen TEAR_R M
const R_HOLD = 6;         // binnen de binnenste stabiele baan kan niets blijven hangen: dichter komt de bol niet
const HIT = 0.42, REACH = 2.55, REACH_SMALL = 2.1;   // loslaten binnen HIT x breedte verwijdert; binnen REACH (ongeveer 300 px op desktop, 200 op gsm) grijpt het gat de bol al vast
const SECOND = 14;        // het tweede beeld is in het echt ongeveer zoveel keer zwakker dan getekend (anders zie je het niet)
const RED = [196, 24, 52];
const THROW = 10;          // de aanwijzer beweegt veel sneller dan het licht op deze schaal: zijn snelheid telt voor een tiende
const GAMMA = 1.8;        // ontvangen lichtsterkte gaat met de vierde macht van de roodverschuiving; een scherm toont de 2,2-de machtswortel
// Het stippenraster ligt zoveel M achter het gat. Hoe verder erachter, hoe sterker de lens (ring van Einstein ∝ √diepte):
// op 80 M buigt het raster al merkbaar van ver (200 px: 9 px, 300 px: 5 px; op 14 M was dat 0,7 en 0,3 px) (Victor,
// 11/11/2026: "Buig de dots op de achtergrond al van verder rond het zwarte gat")
const DEPTH = 80;
const W_DESK = 120, H_DESK = 74, W_SMALL = 96, H_SMALL = 59;
// Een bol vastgenomen: het gat wordt 1,25 keer zo groot (Victor, 11/11/2026: "Maak het zwarte gat ook wat groter als je
// een bol vastneemt"). Het canvas wordt altijd op die grootte getekend en met een transform geschaald, dus scherp; de
// lens voor het raster, de bol en de zones lezen de maat van het canvas, dus groeien mee.
const GROW = 1.25;

const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
// Stroming: elke ring van de schijf zijn eigen klonterig patroon, meedraaiend met zijn eigen Ω = r^-1,5. Elke ring
// houdt zijn patroon, dus het wikkelt zich niet op tot ruis (een doorlopende textuur zou dat wel doen).
const NR = 26, RINGS = Array.from({ length: NR }, (_, i) => ({ r: 6 + 11 * i / (NR - 1), w: [0, 1, 2].map(k => ({ f: 3 + Math.floor(hash(i * 3 + k) * 7), p: hash(i * 7 + k + 50) * 6.28, a: 0.5 + hash(i * 11 + k) })) }));
function flow(r, phi, t) {
  const u = (r - 6) / 11 * (NR - 1), i = Math.max(0, Math.min(NR - 2, Math.floor(u))), fr = u - i;
  const at = R => { const q = phi - Math.pow(R.r, -1.5) * t; let v = 0, n = 0; for (const w of R.w) { v += w.a * Math.sin(w.f * q + w.p); n += w.a; } return v / n; };
  return Math.max(0.04, 1 + 0.44 * (at(RINGS[i]) * (1 - fr) + at(RINGS[i + 1]) * fr));
}
// Lichtecho (R3, gekozen door Victor op 11/11/2026 uit ontwerp/zwartgat/rust.html; R1 Stroming en R2 Hete vlek
// afgewezen): om de ECHO M loopt een opflakkering aan 0,45 c van de binnenrand naar buiten. Elk punt licht op op het
// moment van uitzenden plus zijn eigen reistijd (de weglengte s van zijn lichtstraal): eerst de voorkant, dan de
// achterkant, en ongeveer 16 M later nog eens in de fotonring (licht dat eerst om het gat liep).
const ECHO = 220, FRONT = 0.45, FLARE = 40;

export function createHole({ reducedMotion, permanent, minimal = () => false }) {
  const el = document.createElement('div');
  el.className = 'hole';
  el.setAttribute('aria-hidden', 'true');
  el.title = tx('hole.title');
  const cv = document.createElement('canvas');
  el.append(cv);
  const fx = document.createElement('canvas');   // de bol en wat ervan valt: over het hele scherm
  fx.className = 'hole-fx';
  fx.setAttribute('aria-hidden', 'true');

  let power = 0, HX = 0, HY = 0, KPX = 1;   // lens voor het raster van de scène: sterkte (0..1, volgt het verschijnen), midden en schaal
  const pair = [0, 0];
  let field = null, filled = 0, lens = null, sky = null, dragging = false, raf = 0, lastT = 0, fxDirty = false;
  let sRef = Infinity, echoT0 = 0, echoAmp = 9;   // kortste weg van het licht (nul van de reistijd), begin en sterkte van de laatste opflakkering
  let bloat = 0, MASS = 1, clock = 0, wakeUp = 0, lookX = null, lookY = null;   // klik: begin van het opzwellen en de massa nu (1 = gewoon); klok van de schijf in M
  let cloud = null;       // de vastgehouden bol: { rgb, a, C, parts: [{ ox, oy, dx, dy, gone }], left, dot }
  let loose = [];         // losse deeltjes in vrije val: { x, y, ux, uy, rgb, dot }
  let trail = [];         // laatste posities van de aanwijzer, voor de snelheid bij het loslaten
  let INK = [0, 0, 0], HOLE = [0, 0, 0], NIGHTC = null;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const rgbOf = c => { const g = fx.getContext('2d'); g.fillStyle = c; const h = g.fillStyle; return h.startsWith('#') ? [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) : h.match(/[\d.]+/g).slice(0, 3).map(Number); };
  // achtergrond van het gat: papier in licht, nacht in donker (de lichtste van de twee tokens is het papier)
  function recolor() { INK = rgbOf(css('--ink')); const bg = rgbOf(css('--bg')); NIGHTC = rgbOf(css('--night')); HOLE = bg[0] + bg[1] + bg[2] > 384 ? bg : NIGHTC; loadGrain(); wake(); }
  // dezelfde korrel als .grain (styles.css), als patroon voor de schaduw van het grote gat
  let grain = null;
  function loadGrain() {
    const el = document.querySelector('.grain');
    if (!el) return;
    const st = getComputedStyle(el), url = st.backgroundImage.match(/url\("?(.*?)"?\)$/)?.[1];
    const next = { op: parseFloat(st.opacity) || 0, blend: st.mixBlendMode === 'normal' ? 'source-over' : st.mixBlendMode, pat: grain?.pat };
    grain = next;
    if (url && !next.pat) { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); grain.pat = fx.getContext('2d').createPattern(c, 'repeat'); }; im.src = url; }
  }
  new MutationObserver(recolor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolor);

  const shown = () => (permanent.matches ? true : dragging || loose.length > 0) && !document.body.classList.contains('is-focus') && !document.hidden;
  const still = () => reducedMotion.matches || minimal();
  const size = () => (permanent.matches ? [W_DESK, H_DESK] : [W_SMALL, H_SMALL]);
  function center() { const b = cv.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2, b.width]; }

  /* ---- Het gat: rasterpunten op een zeshoekig rooster, één lichtstraal per punt (eenmalig, in stukjes) ---- */
  function build() {
    const [w, h] = size(), cols = Math.round(w / 2.4), rows = Math.round(h / 2.1), asp = h / w;
    field = { w, h, cols, rows, cells: [] };
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = (i + 0.5 + (j % 2 ? 0.5 : 0)) / cols, y = (j + 0.5) / rows;
      field.cells.push({ x, y, sx: x * 2 - 1, sy: (1 - y * 2) * asp, res: null });
    }
    filled = 0;
  }
  // Op de rand van de schaduw ligt de fotonring: dunner dan één rasterpunt. Daar negen stralen per punt in plaats van
  // één, anders wordt de ring toevallig wel of niet geraakt en staat er een rij losse stippen.
  function fill(budget) {
    const t0 = performance.now(), cw = 2 / field.cols, ch = 2 * (field.h / field.w) / field.rows;
    while (filled < field.cells.length && performance.now() - t0 < budget) {
      const c = field.cells[filled++], b = Math.hypot(c.sx, c.sy) * FOV * D;
      c.res = [];
      if (Math.abs(b - 5.4) < 1.5) { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) c.res.push(trace(c.sx + i * cw / 3, c.sy + j * ch / 3).hits); }
      else c.res.push(trace(c.sx, c.sy).hits);
      for (const hits of c.res) for (const h of hits) sRef = Math.min(sRef, h.s);
    }
  }
  function shade(tm, hits) {
    let v = 0;
    if (tm - echoT0 > ECHO) { echoT0 = tm; echoAmp = 9; }   // vanzelf, om de ECHO M
    for (const h of hits) {
      let m = 0.55 * flow(h.r, h.phi, tm);
      const ph = tm - (h.s - sRef) - echoT0;
      if (ph > 0 && ph < FLARE) m += echoAmp * Math.exp(-0.5 * ((h.r - 6 - ph * FRONT) / 1.1) ** 2) * (1 - ph / FLARE);
      v += emit(h.r) * m * h.g ** 4 * (h.k ? 1.25 : 1);
    }
    return 1 - Math.exp(-0.42 * v);   // zachte begrenzing: de heldere kant brandt niet uit tot een vlek
  }
  function draw(tm) {
    const [w, h] = size();
    if (!field || field.w !== w) build();
    if (filled < field.cells.length) fill(5);
    const dpr = Math.min(2, window.devicePixelRatio || 1) * GROW, W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    const s = W / field.cols, rMax = s * 0.72;   // vetter (Victor, 11/11/2026: "het mag wat vetter/dikker getekend worden")
    g.fillStyle = `rgb(${INK})`;
    g.beginPath();
    // wakker: de schijf licht op; kijkt mee: het meest aan de kant van de bol (zoals de ogen van de kern de muis volgen)
    let look = 0, la = 0;
    if (wakeUp > 0.001 && lookX != null) { const b = cv.getBoundingClientRect(); la = Math.atan2(lookY - (b.top + b.height / 2), lookX - (b.left + b.width / 2)); look = wakeUp; }
    for (const c of field.cells) {
      if (!c.res) continue;
      let v = 0;
      for (const hits of c.res) v += shade(tm, hits);
      v /= c.res.length;
      if (wakeUp > 0.001) {
        let m = 1 + 0.4 * wakeUp;   // iets zachter dan in het voorstel: samen met het meekijken stapelt het
        if (look) { const q = Math.cos(Math.atan2((c.y - 0.5) * h, (c.x - 0.5) * w) - la); if (q > 0) m *= 1 + 0.9 * look * q * q; }
        v = 1 - Math.pow(1 - Math.min(0.999, v), m);   // zelfde zachte begrenzing, meer licht
      }
      if (v < 0.02) continue;
      const r = rMax * Math.sqrt(v);
      g.moveTo(c.x * W + r, c.y * H); g.arc(c.x * W, c.y * H, r, 0, Math.PI * 2);
    }
    g.fill();
  }

  /* ---- De bol als wolk ---- */
  // Vastgehouden: de bol hangt aan de aanwijzer, maar het gat trekt hem naar zich toe (`SAG`) en rekt hem uit. Elk
  // deeltje voelt het verschil tussen zijn eigen gewicht (dat van iets wat stil hangt: 1 / (r² sqrt(1 - 2/r)), oneindig
  // aan de horizon) en dat van het midden, tegen de samenhang van de bol in: de kant bij het gat zakt verder door, de
  // verre kant blijft achter, dus een druppel en dan een draad naar het gat. Waar het verschil sneller groeit dan de
  // samenhang kan volgen, scheurt een deeltje los en valt. Zolang je de bol dichtbij houdt, blijft hij leegstromen
  // langs die draad (losgescheurde deeltjes groeien aan zijn achterkant weer aan); weg is hij pas als je loslaat.
  function stepCloud(dt) {
    const c = cloud, k = 1 - Math.exp(-9 * dt), cap = 0.6 * TIME * dt;
    const rc = Math.hypot(c.C[0], c.C[1]), ex = c.C[0] / rc, ey = c.C[1] / rc, gc = weight(rc);
    for (const p of c.parts) {
      if (p.gone) continue;
      const x = c.C[0] + p.ox + p.dx, y = c.C[1] + p.oy + p.dy, r = Math.max(2.06, Math.hypot(x, y)), gp = weight(r);
      let tx = ((-x / r) * gp + ex * gc) / STIFF, ty = ((-y / r) * gp + ey * gc) / STIFF;
      const out = tx * ex + ty * ey;   // de verre kant: wordt van het gat weg getrokken, maar je vinger houdt hem tegen
      if (out > 0) { tx -= out * ex; ty -= out * ey; }
      // buiten TEAR_R rekt de bol hooguit tot net onder het losscheuren, zacht begrensd (tanh: de volgorde van de
      // deeltjes blijft, dus één doorlopende druppel en geen klonters aan de grens)
      if (Math.hypot(x, y) >= TEAR_R) { const m = Math.hypot(tx, ty), L = TEAR * c.a * 0.95; if (m > 1e-9) { const f = L * Math.tanh(m / L) / m; tx *= f; ty *= f; } }
      let mx = tx - p.dx, my = ty - p.dy;
      mx *= k; my *= k;
      const m = Math.hypot(mx, my);
      if (m > cap) { mx *= cap / m; my *= cap / m; }
      p.dx += mx; p.dy += my;
      const nx = c.C[0] + p.ox + p.dx, ny = c.C[1] + p.oy + p.dy, nr = Math.hypot(nx, ny);
      // Losscheuren pas binnen TEAR_R: iets wat van verder valt, valt uit rust en doet daar lang over (vanaf 36 M
      // ongeveer 10 s), en bleef zo als spoor achter je vinger hangen. Daarbuiten rekt de bol enkel.
      if ((Math.hypot(p.dx, p.dy) > TEAR * c.a && nr < TEAR_R) || nr < 3.4) {
        p.gone = true; c.left--;
        // Losgescheurd: met de snelheid waarmee het wegliep, maar zoals bij loslaten: de aanwijzer telt voor een tiende,
        // nooit naar buiten en met weinig draaiing. Met de volle snelheid kwamen deeltjes in een vaste baan ver rond
        // het gat terecht en bleven daar hangen (Victor, 11/11/2026).
        const f = Math.sqrt(1 - 2 / Math.max(2.1, nr)), dtc = Math.max(1e-3, dt * TIME * THROW);
        if (loose.length < 1600) loose.push(tame({ x: nx, y: ny, ux: mx / dtc / f, uy: my / dtc / f, rgb: c.rgb, dot: c.dot, born: performance.now() }));
      }
    }
    // aangroeien aan de kant van je vinger: de bol blijft herkenbaar zolang je hem vasthoudt (ongeveer 60 deeltjes per s)
    c.grow += dt * 60;
    for (let n = 0; n < 40 && c.grow >= 1 && c.left < N; n++) {
      const p = c.parts[Math.floor(Math.random() * N)];
      if (!p.gone) continue;
      c.grow--;
      p.gone = false; p.dx = p.dy = 0; c.left++;
    }
    if (c.left >= N) c.grow = 0;
  }
  // nooit naar buiten, hooguit 0,4 c, impulsmoment hooguit 3,2 (onder sqrt(12) heeft geen baan een keerpunt)
  function tame(p) {
    const r = Math.hypot(p.x, p.y), ex = p.x / r, ey = p.y / r;
    let vr = Math.min(0, p.ux * ex + p.uy * ey), vt = -p.ux * ey + p.uy * ex;
    const sp = Math.hypot(vr, vt);
    if (sp > 0.4) { vr *= 0.4 / sp; vt *= 0.4 / sp; }
    if (Math.abs(vt) * r > 3.2) vt *= 3.2 / (Math.abs(vt) * r);
    p.ux = vr * ex - vt * ey; p.uy = vr * ey + vt * ex;
    return p;
  }
  function dotAt(g, hx, hy, k, dpr, x, y, ux, uy, rgb, dot, fade = 1) {
    const r = Math.hypot(x, y), P = lens.primary(Math.min(r, lens.rMax));
    if (!P) return 0;
    const q = { x, y, ux, uy };
    const z = shift(q, P.b, true), a = Math.min(1, (z / 0.96) ** GAMMA) * fade;
    if (a > 0.02) {
      const t = Math.min(1, Math.max(0, (0.96 - z) * 1.25));   // roodverschuiving: naar rood, en via a naar donker
      g.fillStyle = `rgba(${rgb.map((c, i) => Math.round(c + (RED[i] - c) * t))},${a})`;
      g.beginPath(); g.arc((hx + x / r * P.tan * k) * dpr, (hy + y / r * P.tan * k) * dpr, dot * dpr, 0, Math.PI * 2); g.fill();
    }
    // tweede beeld: aan de overkant, vlak buiten de fotonring; het licht is er driekwart omheen gelopen
    const S = lens.secondary(r);
    if (S) {
      const z2 = Math.min(1.15, shift(q, S.b, false)), a2 = Math.min(0.85, (z2 / 0.96) ** GAMMA * SECOND * (S.tan / P.tan) * 0.02) * fade;
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
    if (!lens || (!cloud && !loose.length && MASS <= 1.001)) return;
    fxDirty = true;
    const [hx, hy, w] = center(), k = w / 2 / FOV;
    if (MASS > 1.001) {   // opgezwollen: G3 Halo (Victor, 11/11/2026, uit ontwerp/zwartgat/groot.html; G1 Fotonringen en G2 Inzoomen afgewezen)
      const R = Math.sqrt(27) * k / D * MASS * dpr, grow = Math.min(1, (MASS - 1) / 0.4);
      // De schaduw in de kleur van de achtergrond van het gat, zoals in het kleine beeld: in licht is licht inkt en
      // donker papier, in donker omgekeerd. Een vol vlak, want ook de HTML erachter (die niet kan buigen) moet weg.
      g.fillStyle = `rgba(${HOLE},${grow})`;
      g.beginPath(); g.arc(hx * dpr, hy * dpr, R, 0, Math.PI * 2); g.fill();
      // avondtint en korrel van het papier (.warmth en .grain liggen onder dit canvas) lopen door in de schaduw, anders
      // een vlak dat lichter en gladder is dan de pagina eromheen
      if (HOLE !== NIGHTC) {
        g.save(); g.clip();
        const wm = document.querySelector('.warmth'), ws = wm && getComputedStyle(wm), wo = ws ? parseFloat(ws.opacity) || 0 : 0;
        if (wo > 0.002) { g.globalAlpha = wo * grow; g.globalCompositeOperation = ws.mixBlendMode === 'normal' ? 'source-over' : ws.mixBlendMode; g.fillStyle = ws.backgroundColor; g.fillRect(hx * dpr - R, hy * dpr - R, 2 * R, 2 * R); }
        if (grain?.pat) { g.globalAlpha = grain.op * grow; g.globalCompositeOperation = grain.blend; g.fillStyle = grain.pat; g.fillRect(hx * dpr - R, hy * dpr - R, 2 * R, 2 * R); }
        g.restore();
      }
      // Halo: het gas van de opgeslokte schijf gloeit nog rond de schaduw. Zeshoekig rooster van stippen, grootte =
      // helderheid: een smalle piek op de fotonring (net buiten de schaduw) en een brede gloed die naar buiten uitdooft
      // (r^-6), helderder aan de kant die naar je toe draait (links), met trage klonters die meedraaien op de klok van
      // de schijf (die vertraagt met de massa). Zacht naar nul, geen harde buitenrand.
      const a = Math.min(1, (MASS - 1) / 1.2), p = 3.2 * dpr, row = p * 0.866, Rp = R * 1.04, out = R * 1.8, cx = hx * dpr, cy = hy * dpr;
      const W2 = fx.width, H2 = fx.height;
      g.fillStyle = `rgba(${INK},${a})`;
      g.beginPath();
      for (let j = Math.floor(Math.max(0, cy - out) / row); j <= Math.min(H2, cy + out) / row; j++) {
        const y = j * row, off = j % 2 ? p / 2 : 0;
        for (let i = Math.floor((Math.max(0, cx - out) - off) / p); i <= (Math.min(W2, cx + out) - off) / p; i++) {
          const x = i * p + off, dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
          if (r < R || r > out) continue;
          const th = Math.atan2(dy, dx), u = r / R;
          const clump = 1 + 0.35 * Math.sin(5 * th - clock * 0.18 * Math.pow(u * 3, -1.5) + 1.3) * Math.sin(3 * th + clock * 0.02);
          const I = (1.1 * Math.exp(-0.5 * ((r - Rp) / (R * 0.03)) ** 2) + 0.6 * Math.pow(1 / u, 6)) * (0.5 + 0.5 * -Math.cos(th)) * clump;
          const v = Math.min(1, I) - 0.04;
          if (v <= 0) continue;
          const rr = p * 0.62 * Math.sqrt(v / 0.96);
          g.moveTo(x + rr, y); g.arc(x, y, rr, 0, Math.PI * 2);
        }
      }
      g.fill();
    }
    if (cloud) {
      stepCloud(dt);
      const c = cloud;
      // dezelfde zachte gloed als de bol in de scène, rond het midden van de wolk (door de lens), zwakker naarmate hij
      // leegloopt
      if (c.glow) {
        const rc = Math.hypot(c.C[0], c.C[1]), P = lens.primary(Math.min(rc, lens.rMax));
        if (P) {
          const gx = (hx + c.C[0] / rc * P.tan * k) * dpr, gy = (hy + c.C[1] / rc * P.tan * k) * dpr, R = c.rpx * 3.2 * dpr, a = c.glow * c.left / N;
          const gr = g.createRadialGradient(gx, gy, c.rpx * 0.6 * dpr, gx, gy, R);
          gr.addColorStop(0, `rgba(${c.rgb},${a})`); gr.addColorStop(0.45, `rgba(${c.rgb},${a * 0.35})`); gr.addColorStop(1, `rgba(${c.rgb},0)`);
          g.fillStyle = gr; g.beginPath(); g.arc(gx, gy, R, 0, Math.PI * 2); g.fill();
        }
      }
      for (const p of c.parts) if (!p.gone) dotAt(g, hx, hy, k, dpr, c.C[0] + p.ox + p.dx, c.C[1] + p.oy + p.dy, 0, 0, c.rgb, c.dot);
    }
    const keep = [], now = performance.now();
    for (const p of loose) {
      const alive = stepFree(p, dt * TIME);
      // wat toch blijft rondcirkelen, vervaagt na 10 s (in 1,5 s)
      const fade = 1 - Math.min(1, Math.max(0, (now - (p.born || now) - 10000) / 1500));
      const a = dotAt(g, hx, hy, k, dpr, p.x, p.y, p.ux, p.uy, p.rgb, p.dot, fade);
      if (alive && a > 0.04 && fade > 0) keep.push(p);
    }
    loose = keep;
  }

  // Vooraf rekenen in rustige momenten (gsm: het gat verschijnt pas bij het slepen en moet dan klaar zijn)
  let jobs = null;
  function warm() {
    if (!field) build();
    if (filled < field.cells.length) fill(4);
    else {
      jobs = jobs || [lensSteps(), backdropSteps(DEPTH)];
      const t0 = performance.now();
      while (jobs.length && performance.now() - t0 < 4) {
        const r = jobs[0].next();
        if (r.done) { if (jobs.length === 2) lens = r.value; else sky = r.value; jobs.shift(); }
      }
      if (!jobs.length) { wake(); return; }
    }
    setTimeout(warm, 40);
  }
  setTimeout(warm, 2500);

  // Klik op het gat (desktop): K2 Lens over alles (Victor, 11/11/2026, uit ontwerp/zwartgat/klik.html; K1 Nacht en
  // K3 Rondvlucht afgewezen). De massa zwelt in 1,3 s op tot 10 keer, blijft even en krimpt in 1,4 s terug. Het raster
  // van de scène buigt mee (bend rekent met de massa: alle afstanden schalen met M), de schaduw groeit (straal 3√3 M) en
  // slokt de eigen schijf op, want de schijf is materie van vaste grootte. Op de rand van de schaduw de fotonring.
  // HTML (lijst, wiel) kan niet buigen: wat in de schaduw valt, verdwijnt er even achter.
  const ease = x => { x = Math.min(1, Math.max(0, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const BLOAT = 4.3;
  function swell() {
    if (still() || !sky || bloat) return;
    bloat = performance.now();
    wake();
  }
  el.addEventListener('click', swell);

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (lastT || now)) / 1000);
    lastT = now;
    if (bloat) {
      const t = (now - bloat) / 1000;
      MASS = t >= BLOAT ? 1 : 1 + 9 * Math.min(ease(t / 1.3), 1 - ease((t - 2.9) / 1.4));
      if (t >= BLOAT) bloat = 0;
      cv.style.opacity = MASS > 1.001 ? String(Math.max(0, 1 - (MASS - 1) / 1.5)) : '';
    }
    // klok van de schijf als opgetelde fase: rond een gat van massa M lopen alle tijdschalen M keer trager, dus bij een
    // klik vertraagt de stroming en de echo mee terwijl de massa aanzwelt (nooit tijd x tempo: dat springt)
    // Een bol vastgenomen (V1 Wakker + V3 Kijkt mee, Victor 11/11/2026, uit ontwerp/zwartgat/vastnemen.html; V2 Bereik
    // afgewezen): het gat wordt wakker, snel aan (0,18 s), trager weer in rust (0,35 s)
    const wantWake = dragging && !still() ? 1 : 0;
    wakeUp += (wantWake - wakeUp) * (1 - Math.exp(-dt / (wantWake ? 0.18 : 0.35)));
    if (Math.abs(wantWake - wakeUp) < 0.003) wakeUp = wantWake;
    clock += dt * TIME / MASS * (1 + 0.6 * wakeUp);   // de stroming gaat iets sneller
    cv.style.transform = wakeUp > 0.001 ? `scale(${1 + (GROW - 1) * wakeUp})` : '';   // en het gat groeit
    const live = shown(), tm = still() ? 0 : clock;
    if (live) draw(tm);
    drawFx(dt);
    el.classList.toggle('is-on', shown());   // gsm: het gat blijft tot alles gevallen is
    // de lens voor het raster komt en gaat met het gat (zacht, zoals het gat zelf)
    const goal = shown() && sky ? 1 : 0;
    power = still() || Math.abs(goal - power) < 0.004 ? goal : power + (goal - power) * (1 - Math.exp(-7 * dt));
    if (power) { const c = center(); HX = c[0]; HY = c[1]; KPX = c[2] / 2 / FOV; }
    // de lus loopt enkel zolang er iets beweegt of nog gerekend wordt
    if ((live && (!still() || filled < (field?.cells.length ?? 1))) || cloud || loose.length || fxDirty || bloat || power !== goal || wakeUp !== wantWake) raf = requestAnimationFrame(frame);
    else lastT = 0;
  }
  function wake() { if (!raf) raf = requestAnimationFrame(frame); }
  function update() { el.classList.toggle('is-on', shown()); wake(); }
  permanent.addEventListener('change', () => { field = null; place(); update(); });
  addEventListener('resize', () => { place(); update(); });
  setTimeout(() => { place(); update(); }, 1200);
  document.addEventListener('visibilitychange', update);
  new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // Gsm en liggend: rechtsonder in de scène, liggend links van het wiel; enkel zichtbaar tijdens het slepen (Victor,
  // 11/11/2026: "doe toch maar enkel zichtbaar op gsm als je sleept. Op pc altijd."). Het gat hangt in de scène
  // (`.stage`) en scrolt mee.
  function place() {
    const st = document.getElementById('stage');
    if (st && el.parentNode !== st) st.append(el);
    if (permanent.matches) { el.style.left = el.style.top = ''; return; }
    const sc = document.getElementById('scene')?.getBoundingClientRect(), wh = document.getElementById('wheel')?.getBoundingClientRect(), box = st?.getBoundingClientRect();
    if (!sc || !box) return;
    let right = sc.right - 14;
    if (wh && wh.width && wh.left > sc.left + sc.width / 2 && wh.left < right && wh.bottom > sc.bottom - 80) right = wh.left - 8;   // liggend: het wiel staat rechts
    const bottom = Math.min(sc.bottom, innerHeight) - 12, left = right - W_SMALL, top = bottom - H_SMALL;
    el.style.left = `${Math.round(left - box.left)}px`; el.style.top = `${Math.round(top - box.top)}px`;
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
    for (const p of c.parts) if (!p.gone) loose.push({ x: c.C[0] + p.ox + p.dx, y: c.C[1] + p.oy + p.dy, ux, uy, rgb: c.rgb, dot: c.dot, born: performance.now() });
  }
  // px per M van het hoofdbeeld op afstand rc
  const pxPerM = (rc, k) => (lens.primary(Math.min(lens.rMax, rc + 0.5)).tan - lens.primary(Math.max(2.1, rc - 0.5)).tan) * k;
  // De wolk is op de grens even groot als de bol: de buitenste deeltjes liggen een deeltjesstraal binnen zijn rand
  // (vroeger erop, dan werd hij in één beeld 20 % groter).
  function newCloud(rgb, rpx, k, rc, glow) {
    const a = rpx / pxPerM(rc, k), dot = Math.max(0.7, rpx * 0.21), fill = a * Math.max(0.4, 1 - dot / rpx), parts = [];   // straal van de bol in M
    for (let i = 0; i < N; i++) { const rr = fill * Math.sqrt((i + 0.5) / N), th = i * 2.399963; parts.push({ ox: rr * Math.cos(th), oy: rr * Math.sin(th), dx: 0, dy: 0, gone: false }); }
    return { rgb, a, rpx, glow, C: [rc, 0], parts, left: N, grow: 0, dot };
  }

  return {
    el, fx, recolor,
    // Buigt het gat nu het raster van de scène? (per beeld gevraagd, vóór de punten)
    lensOn: () => power > 0.004,
    // Eén rasterpunt van de scène op (x, y) met straal r0, zoals het door het gat gezien wordt (backdropTable in
    // gravity.js). Schrijft per beeld zes getallen in `out`: x, y, halve dikte in de richting van het gat, halve lengte
    // dwars daarop, de richting vanuit het gat, de afstand tot het gat; en geeft het aantal beelden (0 = teken het punt
    // gewoon: te ver weg voor een merkbaar verschil). Het hoofdbeeld schuift van het gat weg en wordt een boogje; het
    // tweede beeld staat gespiegeld aan de overkant; een punt recht achter het gat wordt een ring.
    bend(x, y, r0, out) {
      const dx = x - HX, dy = y - HY, rho = Math.hypot(dx, dy), KM = KPX * MASS;   // alle afstanden schalen met de massa
      if (rho > 300 * KM / D) return 0;   // voorbij 300 M (het ijkpunt van backdropSteps) buigt niets meer
      const t = rho / KM;
      if (!sky.primary(t, pair)) return 0;
      const a = pair[0] * KM, sl = pair[1];
      if (Math.abs(a - rho) < 0.15 && Math.abs(sl - 1) < 0.02) return 0;
      const ux = rho > 1e-3 ? dx / rho : 1, uy = rho > 1e-3 ? dy / rho : 0, ang = Math.atan2(uy, ux);
      const ring = rho <= r0, half = ring ? Math.PI : Math.asin(Math.min(1, r0 / rho));   // halve hoek die het punt rond de as beslaat
      const R = rho + (a - rho) * power;
      out[0] = HX + ux * R; out[1] = HY + uy * R; out[2] = r0 * (1 + (sl - 1) * power); out[3] = r0 + (a * half - r0) * power; out[4] = ang; out[5] = R;
      if (!sky.secondary(t, pair)) return 1;
      const a2 = pair[0] * KM, thin = r0 * pair[1] * power;
      if (thin < 0.12) return 1;   // te dun om nog te zien
      out[6] = HX - ux * a2; out[7] = HY - uy * a2; out[8] = thin; out[9] = Math.max(thin, a2 * half * power); out[10] = ang + Math.PI; out[11] = a2;
      return 2;
    },
    // een bol wordt vastgenomen of losgelaten: op gsm verschijnt het gat
    setDragging(on) {
      dragging = on;
      if (on) { place(); trail = []; lookX = lookY = null; if (!still() && clock - echoT0 > 30) { echoT0 = clock - 2; echoAmp = 7; } }   // één lichtecho bij het vastnemen, iets zachter dan de gewone
      update();
    },
    // De versleepte bol staat op (x, y), met kleur en straal op het scherm. Geeft terug of loslaten hier verwijdert
    // (`over`) en of het gat de bol nu zelf tekent (`taken`: de scène laat hem dan weg).
    hold(x, y, rgb, rpx, glow = 0) {
      lookX = x; lookY = y;
      if (!shown()) return { over: false, taken: false };
      const [hx, hy, w] = center(), dx = x - hx, dy = y - hy, rho = Math.hypot(dx, dy), now = performance.now();
      trail.push([now, x, y]);
      while (trail.length > 2 && now - trail[0][0] > 90) trail.shift();
      const over = rho <= HIT * w, taken = !still() && Boolean(lens) && rho <= (permanent.matches ? REACH : REACH_SMALL) * w / (1 + (GROW - 1) * wakeUp);   // grijpen op de basismaat, loslaten op wat je ziet
      if (taken) {
        const k = w / 2 / FOV, raw = lens.radius(rho / k), held = Math.max(R_HOLD, raw);
        const rc = Math.max(R_HOLD, held - Math.min(0.35 * held, SAG * weight(held)));   // het gat zuigt de bol naar zich toe
        if (!cloud) cloud = newCloud(rgb, rpx, k, held, glow);
        const ux = rho > 0.5 ? dx / rho : 1, uy = rho > 0.5 ? dy / rho : 0;
        cloud.C = [ux * rc, uy * rc];
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
