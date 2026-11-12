/* ---- Paludarium in het bakje van de focusmodus ---- */
// Natuurvenster (Victor, 12/11/2026): geschilderd in de geest van Ghibli, stijl S1 Penseel (src/focus/brush.js), over het
// hele bakje zonder kader, recht vooruit, in volle natuurkleur (enkel hier). Half land, half water: rots met mos en varens,
// een watervalletje in een poel, een tak met een bromelia, een pijlgifkikker, onder water grind, vallisneria en neontetra's.
// Leven: varens en ranken wiegen, het water stroomt, licht speelt over het grind, een slakje kruipt over de rots,
// springstaartjes wippen op de oever, de kikker knippert en springt soms naar een andere plek, 's nachts vuurvliegjes.
// Zelf doen: tik = nevelen (blad glinstert, glas slaat aan), slepen = glas schoonvegen, dubbeltik = lamp aan of uit,
// tik op een geel blad = snoeien (het valt en drijft weg), tik in het water = kring en de visjes schieten weg,
// tik bij de kikker = hij springt weg. De muis bewegen geeft een beetje diepte (parallax).
// Zorg: hoe lang geleden je nevelde, wordt bewaard (scores.game('terra'), gaat mee in sync); na drie dagen is het glas
// droog en hangen de varens wat, nooit meer dan dat. Licht volgt de klok (lamp aan van 7 tot 22 uur), niet het thema.
// Geluid enkel bij acties (playTerra). Diepte enkel met nevel: geen blur, geen lichtstralen. Minder beweging: één beeld.

import { createBrush, layer, rng } from './brush.js';
import { playTerra } from '../scene/sound.js';
import { LANG } from '../core/i18n.js';

const W = 325.6, H = 226.8, TAU = Math.PI * 2, PAD = 8, WATER = 168;
const DRY_MS = 3 * 86400e3;          // zo lang na het nevelen is het glas helemaal droog
const HINT = LANG === 'en' ? 'TAP: MIST · DRAG: WIPE · DOUBLE TAP: LAMP' : 'TIK: NEVELEN · SLEEP: VEGEN · DUBBELTIK: LAMP';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
let hinted = false;                  // de korte uitleg onderaan: één keer per bezoek

// plekken waar de kikker graag zit (voeten), waar een blad geel kan worden, de oever
const PERCH = [[226, 141], [84, 81], [298, 137], [238, 72]];
const SPOTS = [[296, 40], [246, 30], [54, 40], [312, 70]];
const BANK = [[150, 172], [176, 156], [214, 146], [262, 142], [300, 138], [334, 136]];
const bankY = x => { for (let i = 0; i < BANK.length - 1; i++) { const [x0, y0] = BANK[i], [x1, y1] = BANK[i + 1]; if (x <= x1) return y0 + (y1 - y0) * clamp((x - x0) / (x1 - x0), 0, 1); } return BANK[BANK.length - 1][1]; };

export function createTerra({ reducedMotion, store, zoom = 1 }) {
  let cv = null, g = null, scale = 1, built = null, fog = null, mask = null;
  let t = 0, lastNow = 0, hintAt = -99;
  let px = 0, py = 0, hover = { x: W / 2, y: H / 2, at: -99 }, ptr = null, lastTap = null;
  let lamp = 1, userLamp = null, mistAt = 0, savedAt = 0;
  let drops = [], spray = [], sparks = [], rings = [], flies = [], springs = [], fish = [], acc = 0, wet = 0;
  let frog = null, snail = null, yellow = null, fall = null, nextYellow = 90;
  const ferns = [[54, 78, 52, -2.1, 0.04], [58, 78, 60, -1.3, 0.045], [62, 80, 44, -0.6, 0.05]].map(([x, y, len, a0, bend], i) => ({ x, y, len, a0, bend, a: 0, v: 0, k: i * 2.1 }));
  const vines = [[196, 0, 44], [228, 2, 62], [268, 0, 38], [300, 4, 52], [22, 6, 36]].map(([x, y, len], i) => ({ x, y, len, a: 0, v: 0, k: i * 1.7 }));
  const weeds = Array.from({ length: 9 }, (_, i) => ({ x: 150 + i * 19 + (i * 37 % 11), top: 176 + (i * 13 % 9), k: i * 1.3 }));

  /* ---- zorg: wanneer het laatst geneveld ---- */
  function loadMist() { const v = store?.load?.(); const m = v?.run?.mist; if (Number.isFinite(m) && m > mistAt) mistAt = m; if (!mistAt) mistAt = Date.now(); }
  const moist = () => clamp(1 - (Date.now() - mistAt) / DRY_MS, 0, 1);
  function misted() { const now = Date.now(); mistAt = now; if (now - savedAt > 60000) { savedAt = now; store?.save?.({ run: { mist: now }, at: now }); } }
  const clockLamp = () => { const h = new Date().getHours(); return h >= 7 && h < 22; };
  const lampOn = () => userLamp ?? clockLamp();

  /* ---- schilderen: één keer per opbouw ---- */
  function build() {
    const back = layer(W + PAD * 2, H, scale, PAD, 0), mid = layer(W + PAD * 2, H, scale, PAD, 0);
    let b = createBrush(back.c, 41);
    b.wash(-PAD, 0, W + PAD, H, '#6b5c40', '#2f2a22');
    for (let i = 0; i < 46; i++) { const x = -PAD + b.q() * (W + PAD * 2), y = b.q() * 160; b.line([[x, y], [x + 4 + b.q() * 8, y + (b.q() - 0.5) * 3]], b.drk('#5a4c35', 0.15 + b.q() * 0.2), 1.4, 0.8); }
    b.blobs(250, 18, 44, 16, '#435e36'); b.blobs(40, 30, 34, 14, '#3f5a33'); b.blobs(300, 60, 26, 16, '#3c5631'); b.blobs(150, 10, 30, 10, '#3f5a33');
    b.canvas(-PAD, 0, W + PAD, H);
    b = createBrush(mid.c, 43);
    // tak met bromelia
    b.line([[186, 52], [220, 70], [262, 92], [300, 104], [336, 114]], '#6a4a30', 9, 7);
    b.line([[232, 76], [246, 58], [252, 44]], '#6a4a30', 4, 2.2);
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.3; b.leaf(262, 88, 20 - Math.abs(i - 4) * 1.4, 3.2, a + (i - 4) * 0.05, i % 2 ? '#3f7a45' : '#4f8c4e'); }
    for (let i = 0; i < 4; i++) b.leaf(262, 88, 9, 2.6, -Math.PI / 2 + (i - 1.5) * 0.45, '#d33a36');
    // hangend groen bovenaan (de ranken zelf wiegen als sprite)
    b.blobs(214, 6, 30, 9, '#4a6a38'); b.blobs(286, 8, 34, 10, '#46663a'); b.blobs(20, 10, 26, 9, '#4a6a38');
    // rots met mos
    const rock = '#77726a';
    b.area([[-PAD - 2, 84, 1], [26, 74], [64, 76], [100, 86], [118, 100], [122, 132], [128, 176], [80, 186], [-PAD - 2, 190, 1]], rock, { shade: 0.8 });
    b.blobs(26, 78, 26, 7, '#6e9a3e'); b.blobs(68, 80, 26, 7, '#7aa645'); b.blobs(104, 92, 12, 6, '#6e9a3e'); b.blobs(18, 118, 14, 6, '#5f8a38'); b.blobs(6, 150, 12, 8, '#5f8a38');
    // oever met mos en fittonia
    b.area([[150, 172], ...BANK.slice(1, -1), [W + PAD + 2, 136, 1], [W + PAD + 2, 178, 1]], '#4c3d2c', { shade: 0.5 });
    b.blobs(232, 146, 30, 6, '#7aa645'); b.blobs(300, 140, 30, 6, '#6e9a3e'); b.blobs(180, 158, 18, 5, '#7aa645');
    for (let i = 0; i < 12; i++) b.leaf(282 + b.q() * 34, 128 + b.q() * 10, 7, 3.6, -Math.PI / 2 + (b.q() - 0.5) * 2, '#3e6e3c', { vein: true });
    // grind op de bodem (het water komt er live over)
    for (let i = 0; i < 50; i++) { const x = -PAD + b.q() * (W + PAD * 2), y = 213 + b.q() * 14, r = 1.2 + b.q() * 2.2; b.blobs(x, y, r, r * 0.7, ['#8a8273', '#a69d8a', '#6a6458'][i % 3], { n: 1, r }); }
    // sprites: varens, ranken, geel blad, kikker
    const fernS = ferns.map((f, i) => {
      const s = layer(130, 92, scale, 65, 86), fb = createBrush(s.c, 60 + i);
      let a = f.a0, x = 0, y = 0; const pts = [[0, 0]];
      for (let d = 0; d < f.len; d += 3) { a += f.bend; x += Math.cos(a) * 3; y += Math.sin(a) * 3; pts.push([x, y]); }
      fb.line(pts, '#3f6f30', 1, 0.5);
      pts.forEach(([xx, yy], j) => { if (j < 2) return; const k = j / pts.length, l = 9 * Math.sin(Math.PI * Math.min(1, k * 1.05)) * (1 - k * 0.5); const ta = Math.atan2(yy - pts[j - 1][1], xx - pts[j - 1][0]); fb.leaf(xx, yy, l, 1.6, ta - 1.1, '#5c9a3e'); fb.leaf(xx, yy, l, 1.6, ta + 1.1, '#4e8a36'); });
      return s;
    });
    const vineS = vines.map((v, i) => {
      const s = layer(50, v.len + 14, scale, 25, 2), vb = createBrush(s.c, 80 + i);
      const pts = []; for (let y = 0; y <= v.len; y += 4) pts.push([Math.sin(y * 0.06 + i) * 3, y]);
      vb.line(pts, '#4a5a2e', 1.3, 0.8);
      pts.forEach(([x, y], j) => { if (j % 2 || j === 0) return; const side = (j / 2) % 2 ? 1 : -1; vb.leaf(x, y, 7 + (j / pts.length) * 2, 3.4, Math.PI / 2 + side * 0.9, j % 4 ? '#4f7a3a' : '#5a8a40', { vein: true }); });
      return s;
    });
    const yel = layer(16, 16, scale, 2, 2); createBrush(yel.c, 90).leaf(0, 0, 9, 4.2, Math.PI / 2 - 0.2, '#d8b23a', { vein: true });
    yel.c.fillStyle = 'rgba(120,80,30,.55)'; [[1.5, 5], [-0.5, 7.5]].forEach(([x, y]) => { yel.c.beginPath(); yel.c.arc(x, y, 0.7, 0, TAU); yel.c.fill(); });
    const frogS = layer(20, 14, scale, 10, 12), fr = createBrush(frogS.c, 95);
    fr.area([[-7, 0], [-6, -3], [-3, -2], [-2, 0]], '#1f4fa0', { shade: 0.5 });
    fr.area([[-6, 0], [-5, -4], [0, -6], [5, -5.5], [7.5, -2.5], [6.5, 0], [-4, 0.6]], '#2f72d6', { shade: 0.6 });
    frogS.c.fillStyle = '#121620'; [[-2.5, -3], [1.5, -2.2], [-0.5, -4.8]].forEach(([x, y]) => { frogS.c.beginPath(); frogS.c.ellipse(x, y, 0.9, 0.7, 0, 0, TAU); frogS.c.fill(); });
    frogS.c.beginPath(); frogS.c.arc(4.6, -4.6, 1.25, 0, TAU); frogS.c.fill();
    frogS.c.fillStyle = '#ffffff'; frogS.c.beginPath(); frogS.c.arc(5, -5, 0.4, 0, TAU); frogS.c.fill();
    fr.line([[4.5, -1.2], [5.8, 0.2]], '#1f4fa0', 0.9, 0.7);
    // water en licht: verlopen één keer
    built = {
      back, mid, fernS, vineS, yel, frogS,
      water: (() => { const gr = g.createLinearGradient(0, WATER, 0, H); gr.addColorStop(0, 'rgba(160,220,215,.16)'); gr.addColorStop(1, 'rgba(10,40,45,.36)'); return gr; })(),
      glow: (() => { const gr = g.createRadialGradient(170, -30, 0, 170, -30, 250); gr.addColorStop(0, 'rgba(255,240,200,.45)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); return gr; })(),
    };
    // beslagen glas: wat aanslaat, valt vooral bovenaan en in de hoeken
    mask = layer(W, H, scale);
    const mg = mask.c, top = mg.createLinearGradient(0, 0, 0, H * 0.5); top.addColorStop(0, 'rgba(255,255,255,1)'); top.addColorStop(1, 'rgba(255,255,255,0)');
    mg.fillStyle = top; mg.fillRect(0, 0, W, H);
    for (const cx of [0, W]) { const r = mg.createRadialGradient(cx, 0, 0, cx, 0, 120); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); mg.fillStyle = r; mg.fillRect(0, 0, W, H); }
    fog = layer(W, H, scale);
  }
  const fogAt = (x, y) => Math.max(clamp(1 - y / (H * 0.5), 0, 1), clamp(1 - Math.hypot(x, y) / 120, 0, 1), clamp(1 - Math.hypot(W - x, y) / 120, 0, 1));

  /* ---- leven ---- */
  function seed() {
    const q = rng(7);
    frog = { p: 0, x: PERCH[0][0], y: PERCH[0][1], face: 1, hop: null, blink: 2, next: 50 + q() * 60, squash: 0 };
    snail = { u: 0.3, dir: 1 };
    springs = Array.from({ length: 7 }, () => { const x = 186 + q() * 130; return { x, hop: null }; });
    fish = Array.from({ length: 5 }, () => ({ x: 180 + q() * 120, y: 182 + q() * 22, a: q() * TAU, v: 9, turn: 0, flee: 0, ph: q() * TAU }));
    flies = Array.from({ length: 3 }, () => ({ x: 60 + q() * 200, y: 30 + q() * 90, a: q() * TAU, ph: q() * TAU }));
    drops = []; spray = []; sparks = []; rings = []; yellow = null; fall = null;
  }
  function spawnDrop(x, y, r) { drops.push({ x, y, r, gr: 0.012 + Math.random() * 0.03, slide: false, vy: 0, k: Math.random() * 9, dead: false }); }
  function merge() {
    const cell = 8, cols = Math.ceil(W / cell) + 1, grid = new Map();
    for (const d of drops) { const key = ((d.y / cell) | 0) * cols + ((d.x / cell) | 0); let bk = grid.get(key); if (!bk) grid.set(key, bk = []); bk.push(d); }
    for (const d of drops) {
      if (d.dead) continue;
      const gx = (d.x / cell) | 0, gy = (d.y / cell) | 0;
      for (let j = gy - 1; j <= gy + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) {
        const bk = grid.get(j * cols + i); if (!bk) continue;
        for (const e of bk) {
          if (e === d || e.dead || d.dead) continue;
          const dx = e.x - d.x, dy = e.y - d.y, rr = (d.r + e.r) * 0.82;
          if (dx * dx + dy * dy < rr * rr) { const [big, sm] = d.r >= e.r ? [d, e] : [e, d]; const A = big.r * big.r, a = sm.r * sm.r; big.x = (big.x * A + sm.x * a) / (A + a); big.y = (big.y * A + sm.y * a) / (A + a); big.r = Math.sqrt(A + a); sm.dead = true; }
        }
      }
    }
    drops = drops.filter(d => !d.dead);
  }
  function wipe(x0, y0, x1, y1) {
    const f = fog.c; f.globalCompositeOperation = 'destination-out'; f.lineCap = 'round'; f.lineWidth = 13; f.beginPath(); f.moveTo(x0, y0); f.lineTo(x1, y1); f.stroke(); f.globalCompositeOperation = 'source-over';
    const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy || 1, nl = Math.sqrt(l2);
    for (const d of drops) { const s = clamp(((d.x - x0) * vx + (d.y - y0) * vy) / l2, 0, 1); if (Math.hypot(d.x - x0 - vx * s, d.y - y0 - vy * s) < 7) { wet += d.r * d.r; d.dead = true; } }
    // het weggeveegde water verzamelt zich aan de rand van het spoor en loopt af
    if (wet > 5) { const side = Math.random() < 0.5 ? -1 : 1; spawnDrop(x1 - vy / nl * 7.5 * side, y1 + vx / nl * 7.5 * side, Math.min(2.9, Math.sqrt(wet))); wet = 0; }
    drops = drops.filter(d => !d.dead);
  }
  function mist(x, y) {
    for (let i = 0; i < 40; i++) { const a = Math.random() * TAU, v = 20 + Math.random() * 45; spray.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, life: 0.6 + Math.random() * 0.4, r: 0.5 + Math.random() * 0.7 }); }
    for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 34; spawnDrop(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 0.4 + Math.random() * 0.5); }
    for (let i = 0; i < 18; i++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 42; sparks.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8, at: t + Math.random() * 0.4 }); }
    const f = fog.c, rg = f.createRadialGradient(x, y, 0, x, y, 40); rg.addColorStop(0, 'rgba(255,255,255,.45)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); f.fillStyle = rg; f.fillRect(x - 40, y - 40, 80, 80);
    for (const fe of ferns) fe.v += (Math.random() - 0.5) * 0.5;
    springs.forEach(s => { s.lively = t + 4; });
    if (Math.random() < 0.3) hopFrog();
    misted();
    playTerra('mist', { x: x / W * 2 - 1 });
  }
  function hopFrog(away) {
    if (frog.hop) return;
    let to = (frog.p + 1 + Math.floor(Math.random() * (PERCH.length - 1))) % PERCH.length;
    if (away) { const far = PERCH.map((p, i) => [Math.hypot(p[0] - away.x, p[1] - away.y), i]).filter(([, i]) => i !== frog.p).sort((a, b) => b[0] - a[0]); to = far[0][1]; }
    const [x, y] = PERCH[to], d = Math.hypot(x - frog.x, y - frog.y);
    frog.hop = { x0: frog.x, y0: frog.y, x1: x, y1: y, at: t, dur: 0.45 + d / 400, h: 12 + d * 0.18, to };
    frog.face = x >= frog.x ? 1 : -1;
  }
  const yellowPos = () => { const [x, y] = SPOTS[yellow.spot], a = 0.12 * Math.sin(t * 0.8 + yellow.spot); return { x, y, a, cx: x - Math.sin(a) * 5, cy: y + Math.cos(a) * 5 }; };

  function step(dt) {
    t += dt;
    const m = moist();
    // diepte: de muis bewegen, anders heel traag vanzelf
    const live = t - hover.at < 2.5;
    const tx = live ? clamp(hover.x / W - 0.5, -0.5, 0.5) * 2 : 0.35 * Math.sin(t * 0.05), ty = live ? clamp(hover.y / H - 0.5, -0.5, 0.5) * 2 : 0.2 * Math.sin(t * 0.037);
    const k = 1 - Math.exp(-dt * 2.2); px += (tx - px) * k; py += (ty - py) * k;
    lamp += ((lampOn() ? 1 : 0) - lamp) * (1 - Math.exp(-dt * 3));
    // dubbeltik: de eerste tik wacht even
    if (lastTap && t - lastTap.t > 0.26) { const p = lastTap; lastTap = null; if (p.y > WATER + 2) { rings.push({ x: p.x, y: WATER + 1, at: t }); fish.forEach(f => { if (Math.hypot(f.x - p.x, f.y - p.y) < 70) { f.flee = 1; f.a = Math.atan2(f.y - p.y, f.x - p.x); } }); playTerra('plop', { x: p.x / W * 2 - 1 }); } else mist(p.x, p.y); }
    // glas: slaat aan, druppels groeien, lopen af
    const f = fog.c; f.globalAlpha = dt * 0.05 * (0.2 + 0.8 * m); f.drawImage(mask.cv, 0, 0, W, H); f.globalAlpha = 1;
    acc += dt * 14 * (0.15 + 0.85 * m);
    while (acc > 1) { acc--; if (drops.length > 260) { acc = 0; break; } const x = Math.random() * W, y = Math.random() * H * 0.7; if (Math.random() < fogAt(x, y)) spawnDrop(x, y, 0.4 + Math.random() * 0.45); }
    for (const d of drops) {
      if (!d.slide) { d.r += dt * d.gr; if (d.r > 2.4 && Math.random() < dt * 0.9) { d.slide = true; d.vy = 0; } }
      else {
        d.vy = Math.min(d.vy + dt * 50, 12 + d.r * 7); const ny = d.y + d.vy * dt, nx = d.x + Math.sin(t * 2.3 + d.k) * dt * 3;
        f.globalCompositeOperation = 'destination-out'; f.lineCap = 'round'; f.lineWidth = d.r * 1.5; f.beginPath(); f.moveTo(d.x, d.y); f.lineTo(nx, ny); f.stroke(); f.globalCompositeOperation = 'source-over';
        d.x = nx; d.y = ny; d.r -= dt * 0.22; if (d.r < 1.4) d.slide = false; if (d.y > H) d.dead = true;
      }
    }
    merge();
    spray.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 60 * dt; s.vx *= 1 - dt * 2; s.life -= dt; }); spray = spray.filter(s => s.life > 0);
    sparks = sparks.filter(s => t - s.at < 3); rings = rings.filter(r => t - r.at < 1.6);
    // planten: veer terug, de muis of vinger duwt
    const push = (o, x, y, r) => { if (ptr && Math.hypot(ptr.x - x, ptr.y - y) < r) o.v += ptr.dx * 0.02; };
    for (const fe of ferns) { push(fe, fe.x + Math.cos(fe.a0) * fe.len * 0.6, fe.y + Math.sin(fe.a0) * fe.len * 0.6, 24); fe.v += (-fe.a * 8 - fe.v * 2.2) * dt; fe.a += fe.v * dt; }
    for (const v of vines) { push(v, v.x, v.y + v.len * 0.7, 18); v.v += (-v.a * 6 - v.v * 1.8) * dt; v.a += v.v * dt; }
    if (ptr) { ptr.dx = 0; ptr.dy = 0; }
    // kikker
    frog.blink -= dt; if (frog.blink < -0.12) frog.blink = 2.5 + Math.random() * 5;
    frog.squash = Math.max(0, frog.squash - dt * 4);
    if (frog.hop) { const u = (t - frog.hop.at) / frog.hop.dur; if (u >= 1) { frog.x = frog.hop.x1; frog.y = frog.hop.y1; frog.p = frog.hop.to; frog.hop = null; frog.squash = 1; } else { frog.x = frog.hop.x0 + (frog.hop.x1 - frog.hop.x0) * u; frog.y = frog.hop.y0 + (frog.hop.y1 - frog.hop.y0) * u - Math.sin(u * Math.PI) * frog.hop.h; } }
    else if ((frog.next -= dt) < 0) { frog.next = 45 + Math.random() * 75; hopFrog(); }
    // slakje: heen en weer over de rots, een paar pixels per seconde
    snail.u += snail.dir * dt * 0.006; if (snail.u > 1 || snail.u < 0) { snail.dir *= -1; snail.u = clamp(snail.u, 0, 1); }
    for (const s of springs) {
      if (s.hop) { if (t - s.hop.at > 0.3) { s.x = s.hop.x1; s.hop = null; } }
      else if (Math.random() < dt * (t < (s.lively || 0) ? 0.6 : 0.04)) s.hop = { x0: s.x, x1: clamp(s.x + (Math.random() - 0.5) * 14, 184, 320), at: t };
    }
    for (const fi of fish) {
      fi.turn += (Math.random() - 0.5) * dt * 4; fi.turn *= 1 - dt; fi.a += fi.turn * dt - Math.sin(2 * fi.a) * dt * 0.9;   // visjes zwemmen vooral horizontaal
      if (fi.x < 150 || fi.x > 316 || fi.y < 178 || fi.y > 208) fi.a += Math.atan2(194 - fi.y, 236 - fi.x) - fi.a > 0 ? dt * 2 : -dt * 2;
      fi.flee *= Math.exp(-dt * 1.6); const v = 8 + fi.flee * 55;
      fi.x += Math.cos(fi.a) * v * dt; fi.y += Math.sin(fi.a) * v * dt * 0.6; fi.ph += dt * (6 + v);
      fi.x = clamp(fi.x, 140, 322); fi.y = clamp(fi.y, 175, 211);
    }
    for (const fl of flies) { fl.a += (Math.random() - 0.5) * dt * 3; fl.x += Math.cos(fl.a) * dt * 7; fl.y += Math.sin(fl.a) * dt * 5; if (fl.x < 20 || fl.x > W - 20 || fl.y < 20 || fl.y > 150) fl.a += Math.PI * dt * 2; fl.ph += dt; }
    // snoeien: af en toe wordt een blad geel
    if (!yellow && !fall && t > nextYellow) yellow = { spot: Math.floor(Math.random() * SPOTS.length) };
    if (fall) {
      if (!fall.float) { fall.vy = Math.min(fall.vy + dt * 30, 20); fall.x += Math.sin(t * 3 + fall.k) * dt * 14; fall.y += fall.vy * dt; fall.a = Math.sin(t * 3 + fall.k) * 0.8; if (fall.y >= WATER) { fall.y = WATER; fall.float = true; rings.push({ x: fall.x, y: WATER + 1, at: t }); playTerra('plop', { x: fall.x / W * 2 - 1 }); } }
      else { fall.x += dt * 4; fall.a += (1.4 - fall.a) * dt; fall.fade = (fall.fade || 0) + dt / 40; if (fall.x > W + 12 || fall.fade >= 1) fall = null; }
    }
  }

  /* ---- tekenen ---- */
  function draw() {
    const { back, mid, fernS, vineS, yel, frogS } = built, m = moist();
    g.setTransform(scale, 0, 0, scale, 0, 0);
    const bx = -PAD - px * 2.5, by = -py * 1, mx = -PAD - px * 6, my = -py * 2;
    g.drawImage(back.cv, bx, by, W + PAD * 2, H);
    g.save(); g.translate(mx + PAD, my);
    // ranken van boven
    vines.forEach((v, i) => { g.save(); g.translate(v.x, v.y); g.rotate(v.a + 0.04 * Math.sin(t * 0.5 + v.k)); g.drawImage(vineS[i].cv, -25, -2, 50, v.len + 14); g.restore(); });
    g.restore();
    g.drawImage(mid.cv, mx, my, W + PAD * 2, H);
    g.save(); g.translate(mx + PAD, my);
    // varens op de rots: wiegen, hangen wat als het glas droog is
    ferns.forEach((fe, i) => { const droop = (1 - m) * 0.22 * (fe.a0 < -Math.PI / 2 ? -1 : 1); g.save(); g.translate(fe.x, fe.y); g.rotate(fe.a + droop + 0.03 * Math.sin(t * 0.7 + fe.k)); g.drawImage(fernS[i].cv, -65, -86, 130, 92); g.restore(); });
    // geel blad en vallend blad
    if (yellow) { const p = yellowPos(); g.strokeStyle = '#6a7a3a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(p.x, p.y - 4); g.lineTo(p.x, p.y); g.stroke(); g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.drawImage(yel.cv, -2, -2, 16, 16); g.restore(); }
    if (fall) { g.save(); g.globalAlpha = 1 - (fall.fade || 0); g.translate(fall.x, fall.y); g.rotate(fall.a); g.drawImage(yel.cv, -2, -2, 16, 16); g.restore(); }
    // slakje op de rots
    { const u = snail.u, x = 26 + u * 70, y = 150 - u * 30 + Math.sin(u * 9) * 2, d = snail.dir; g.fillStyle = '#c9b48a'; g.beginPath(); g.ellipse(x + d * 1.5, y, 4.2, 1.2, -0.35 * d, 0, TAU); g.fill(); g.strokeStyle = '#a8916a'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(x + d * 5, y - 1.2); g.lineTo(x + d * 6.2, y - 3.2); g.moveTo(x + d * 4.4, y - 1); g.lineTo(x + d * 5, y - 3); g.stroke(); g.fillStyle = '#8a5a34'; g.beginPath(); g.arc(x - d * 0.6, y - 2, 2.6, 0, TAU); g.fill(); g.strokeStyle = '#d8b88a'; g.lineWidth = 0.5; g.beginPath(); g.arc(x - d * 0.6, y - 2, 1.3, 0, Math.PI * 1.6); g.stroke(); }
    // springstaartjes
    g.fillStyle = '#ece6d2'; for (const s of springs) { let x = s.x, y = bankY(s.x) - 0.8; if (s.hop) { const u = (t - s.hop.at) / 0.3; x = s.hop.x0 + (s.hop.x1 - s.hop.x0) * u; y = bankY(x) - 0.8 - Math.sin(u * Math.PI) * 4; } g.fillRect(x - 0.5, y - 0.4, 1, 0.8); }
    // kikker
    { g.save(); g.translate(frog.x, frog.y); g.scale(frog.face * (1 + frog.squash * 0.15), 1 - frog.squash * 0.15); if (frog.hop) g.rotate(-0.25); g.drawImage(frogS.cv, -10, -12, 20, 14);
      if (frog.blink < 0) { g.fillStyle = '#2f72d6'; g.beginPath(); g.arc(4.6, -4.6, 1.4, 0, TAU); g.fill(); }
      g.fillStyle = `rgba(190,220,250,${0.25 + 0.2 * Math.sin(t * 7)})`; g.beginPath(); g.ellipse(4.5, -1.3, 1.6, 0.9, 0, 0, TAU); g.fill(); g.restore(); }
    // watervalletje: stromende halen, schuim, kringen
    g.fillStyle = 'rgba(215,236,236,.32)'; g.beginPath(); g.moveTo(112, 100); g.lineTo(122, 100); g.lineTo(130, WATER); g.lineTo(116, WATER); g.closePath(); g.fill();
    g.lineCap = 'round'; g.setLineDash([7, 5]);
    for (let i = 0; i < 12; i++) { const x0 = 113 + (i * 7 % 9), x1 = x0 + 3 + (i * 5 % 4); g.lineDashOffset = -t * (52 + i * 3) - i * 3; g.strokeStyle = i % 3 ? 'rgba(214,236,240,.75)' : 'rgba(255,255,255,.9)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x0, 100); g.quadraticCurveTo(x0 + 1, 120, x1, WATER); g.stroke(); }
    g.setLineDash([]);
    g.fillStyle = 'rgba(240,248,246,.85)'; for (let i = 0; i < 6; i++) { const r = 1.6 + 0.8 * Math.sin(t * 9 + i * 1.7); g.beginPath(); g.arc(119 + i * 2.2, WATER - 1 + Math.sin(t * 7 + i) * 0.6, Math.max(0.4, r), 0, TAU); g.fill(); }
    // water
    g.fillStyle = 'rgba(47,106,104,.56)'; g.fillRect(-PAD, WATER, W + PAD * 2, H - WATER + 4);
    g.fillStyle = built.water; g.fillRect(-PAD, WATER, W + PAD * 2, H - WATER + 4);
    g.fillStyle = 'rgba(210,255,240,.08)'; for (let i = 0; i < 7; i++) { const x = ((i * 61 + t * (5 + i)) % (W + 40)) - 20, y = 214 + (i * 7 % 10); g.beginPath(); g.ellipse(x, y, 10 + (i % 3) * 4, 2.2, 0, 0, TAU); g.fill(); }
    for (const w of weeds) { g.lineCap = 'round'; for (const [col, lw, off] of [['#3f7a3e', 1.5, 0], ['#6aa85a', 0.6, -0.4]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); for (let y = H; y >= w.top; y -= 4) { const u = (H - y) / (H - w.top), x = w.x + off + Math.sin(t * 0.7 + y * 0.1 + w.k) * 3.2 * u; y === H ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); } }
    for (const fi of fish) { g.save(); g.translate(fi.x, fi.y); g.rotate(Math.atan2(Math.sin(fi.a) * 0.6, Math.cos(fi.a))); g.fillStyle = 'rgba(205,214,218,.9)'; g.beginPath(); g.ellipse(0, 0, 3.8, 1.25, 0, 0, TAU); g.fill(); g.fillStyle = '#3fa4e0'; g.fillRect(-1.5, -0.65, 4.2, 0.6); g.fillStyle = '#d5383a'; g.fillRect(-3, 0.05, 2.6, 0.6); g.fillStyle = 'rgba(205,214,218,.8)'; const fl = Math.sin(fi.ph) * 0.8; g.beginPath(); g.moveTo(-3.4, 0); g.lineTo(-5.4, -1.2 + fl); g.lineTo(-5.4, 1.2 + fl); g.closePath(); g.fill(); g.restore(); }
    g.strokeStyle = 'rgba(235,250,248,.55)'; g.lineWidth = 0.7; g.beginPath(); for (let x = -PAD; x <= W + PAD; x += 6) { const y = WATER + 0.5 + Math.sin(x * 0.2 + t * 1.6) * 0.35; x === -PAD ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
    for (let i = 0; i < 3; i++) { const u = ((t * 0.6 + i / 3) % 1); g.strokeStyle = `rgba(235,250,248,${0.45 * (1 - u)})`; g.beginPath(); g.ellipse(123, WATER + 1, 4 + u * 16, 1 + u * 3, 0, 0, TAU); g.stroke(); }
    for (const r of rings) { const u = (t - r.at) / 1.6; g.strokeStyle = `rgba(235,250,248,${0.5 * (1 - u)})`; g.beginPath(); g.ellipse(r.x, r.y, 3 + u * 26, 1 + u * 5, 0, 0, TAU); g.stroke(); }
    g.restore();
    // licht: lamp van boven, of nacht met vuurvliegjes
    if (lamp > 0.01) { g.globalAlpha = lamp; g.fillStyle = built.glow; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    if (lamp < 0.99) {
      g.fillStyle = `rgba(10,16,32,${0.58 * (1 - lamp)})`; g.fillRect(0, 0, W, H);
      for (const fl of flies) { const a = (1 - lamp) * (0.5 + 0.5 * Math.sin(fl.ph * 2.2)), gr = g.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, 6); gr.addColorStop(0, `rgba(230,250,140,${0.9 * a})`); gr.addColorStop(0.25, `rgba(200,240,110,${0.35 * a})`); gr.addColorStop(1, 'rgba(200,240,110,0)'); g.fillStyle = gr; g.fillRect(fl.x - 6, fl.y - 6, 12, 12); }
    }
    // glinstering na het nevelen
    for (const s of sparks) { const u = (t - s.at) / 3; if (u < 0) continue; const r = 1.6 * Math.sin(Math.min(1, u * 4) * Math.PI / 2) * (1 - u); g.fillStyle = `rgba(255,255,255,${0.9 * (1 - u)})`; g.beginPath(); g.moveTo(s.x - r, s.y); g.lineTo(s.x, s.y - r * 0.25); g.lineTo(s.x + r, s.y); g.lineTo(s.x, s.y + r * 0.25); g.closePath(); g.moveTo(s.x, s.y - r); g.lineTo(s.x + r * 0.25, s.y); g.lineTo(s.x, s.y + r); g.lineTo(s.x - r * 0.25, s.y); g.closePath(); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.6)'; for (const s of spray) { g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill(); }
    // glas: aanslag, druppels als lensjes
    g.globalAlpha = 0.5; g.drawImage(fog.cv, 0, 0, W, H); g.globalAlpha = 1;
    const fc = fog.c; fc.globalCompositeOperation = 'destination-out'; fc.fillStyle = '#000'; fc.beginPath(); for (const d of drops) { fc.moveTo(d.x + d.r, d.y); fc.arc(d.x, d.y, d.r * 1.05, 0, TAU); } fc.fill(); fc.globalCompositeOperation = 'source-over';
    g.lineWidth = 0.7; g.strokeStyle = 'rgba(20,30,30,.2)'; g.beginPath(); for (const d of drops) { if (d.r < 1.3) continue; g.moveTo(d.x + Math.cos(0.15 * Math.PI) * d.r, d.y + Math.sin(0.15 * Math.PI) * d.r); g.arc(d.x, d.y, d.r, 0.15 * Math.PI, 0.95 * Math.PI); } g.stroke();
    g.fillStyle = 'rgba(255,255,255,.32)'; g.beginPath(); for (const d of drops) { if (d.r >= 1.3) continue; g.moveTo(d.x + d.r * 0.7, d.y); g.arc(d.x, d.y, d.r * 0.7, 0, TAU); } g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); for (const d of drops) { if (d.r < 1.2) continue; const hr = d.r * 0.28; g.moveTo(d.x - d.r * 0.35 + hr, d.y - d.r * 0.38); g.arc(d.x - d.r * 0.35, d.y - d.r * 0.38, hr, 0, TAU); } g.fill();
    // korte uitleg, één keer per bezoek
    const hu = t - hintAt;
    if (hu >= 0 && hu < 7) {
      const a = Math.min(1, hu / 0.6, (7 - hu) / 0.8);
      g.font = '500 8.5px "Geist Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      if ('letterSpacing' in g) g.letterSpacing = '1.2px';
      g.fillStyle = `rgba(240,246,244,${0.8 * a})`; g.fillText(HINT, W / 2, H - 9);
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      g.textAlign = 'start';
    }
  }

  return {
    own: true,
    onDark: true,
    get busy() { return false; },
    init() { loadMist(); seed(); },
    reload() { loadMist(); },
    mount(el) {
      if (cv) return;
      scale = Math.min(2, window.devicePixelRatio || 1) * zoom;
      cv = document.createElement('canvas');
      cv.className = 'panel-canvas'; cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
      cv.style.width = `${W * zoom}px`; cv.style.height = `${H * zoom}px`;
      el.append(cv);
      g = cv.getContext('2d');
      build();
      lastNow = 0;
      if (reducedMotion.matches) {
        // één stilstaand beeld: wat aanslag op het glas, de lamp volgens de klok
        lamp = lampOn() ? 1 : 0;
        for (let i = 0; i < 300; i++) step(1 / 30);
        draw();
        return;
      }
      for (let i = 0; i < 160; i++) step(1 / 30);   // het glas is al wat beslagen als je kijkt
      if (!hinted) { hinted = true; hintAt = t + 0.4; }
    },
    unmount() { cv?.remove(); cv = null; g = null; built = null; fog = null; mask = null; ptr = null; lastTap = null; },
    frame(now) {
      if (!cv || reducedMotion.matches) return;
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 1 / 60;
      lastNow = now;
      step(dt);
      draw();
    },
    move(p) { hover = { x: p.x, y: p.y, at: t }; if (ptr) { ptr.dx += p.x - ptr.x; ptr.dy += p.y - ptr.y; ptr.x = p.x; ptr.y = p.y; } },
    down(p) { ptr = { x: p.x, y: p.y, dx: 0, dy: 0, wipe: null }; },
    drag(p) {
      if (!ptr || !fog) return;
      if (ptr.wipe) wipe(ptr.wipe.x, ptr.wipe.y, p.x, p.y);
      ptr.wipe = { x: p.x, y: p.y };
      if (!frog.hop && Math.hypot(p.x - frog.x, p.y - frog.y + 4) < 18) hopFrog(p);
    },
    up() { ptr = null; wet = 0; },
    tap(p) {
      if (yellow) { const y = yellowPos(); if (Math.hypot(p.x - y.cx, p.y - y.cy) < 12) { fall = { x: y.cx, y: y.cy, vy: 0, a: y.a, k: Math.random() * 9 }; yellow = null; nextYellow = t + 480 + Math.random() * 420; playTerra('snip', { x: p.x / W * 2 - 1 }); return; } }
      if (!frog.hop && Math.hypot(p.x - frog.x, p.y - frog.y + 4) < 16) { hopFrog(p); playTerra('hop', { x: p.x / W * 2 - 1 }); return; }
      if (lastTap && t - lastTap.t < 0.3 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40) { lastTap = null; userLamp = !lampOn(); playTerra('lamp', { x: 0 }); return; }
      lastTap = { x: p.x, y: p.y, t };
    },
    leave() { ptr = null; hover.at = -99; },
    recolor() {},
  };
}
