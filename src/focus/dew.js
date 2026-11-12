/* ---- Beslagen glas van het paludarium: aanslag en druppels ---- */
// Uit terra.js gehaald (12/11/2026) zodat het paludarium zelf leesbaar blijft; de werking is die van de eerste versie.
// Aanslag groeit volgens een masker (bovenaan en in de hoeken) en verdampt even traag weer, dus hij vindt een evenwicht
// (bovenaan half, lager minder) in plaats van dicht te slibben; wat je nevelt, trekt in een paar minuten weg. Aangroei
// in stappen van 2 s: per beeld is ze kleiner dan één kleurtrap en ging ze verloren. Druppels groeien, smelten samen
// (rooster van 8 px) en lopen af met een helder spoor. Vegen (spons) wist een baan en duwt het water als één druppel naar de rand van het spoor.
// Nevelen legt er een waas en fijne druppels bij. `m` (0 tot 1) is hoe vochtig het bakje is: droog glas beslaat amper.
// Het glas beslaat aan de binnenkant, dus enkel boven de waterlijn (`floor`): een druppel die het water bereikt, gaat
// erin op (`onDrip`). De stand blijft behouden (Victor, 12/11/2026: "resizen reset de mist"): een nieuwe maat neemt de
// aanslag en de druppels van de vorige over (`prev`), en `pack` / `unpack` schrijven ze kort op (rooster van 24 x 16
// en de veertig grootste druppels) voor de opslag, met de aangroei van de tijd die intussen verliep.

import { layer } from './brush.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const GW = 24, GH = 16, B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const GROW = 0.009, DRY = 0.012;     // per seconde: aanslag erbij (maal het masker en de vochtigheid) en eraf

export function createDew(W, H, scale, { floor = H, onDrip = () => {}, prev = null } = {}) {
  const mask = layer(W, H, scale), fog = layer(W, H, scale);
  { const mg = mask.c, top = mg.createLinearGradient(0, 0, 0, H * 0.5); top.addColorStop(0, 'rgba(255,255,255,1)'); top.addColorStop(1, 'rgba(255,255,255,0)');
    mg.fillStyle = top; mg.fillRect(0, 0, W, H);
    for (const cx of [0, W]) { const r = mg.createRadialGradient(cx, 0, 0, cx, 0, 120); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); mg.fillStyle = r; mg.fillRect(0, 0, W, H); } }
  const fogAt = (x, y) => Math.max(clamp(1 - y / (H * 0.5), 0, 1), clamp(1 - Math.hypot(x, y) / 120, 0, 1), clamp(1 - Math.hypot(W - x, y) / 120, 0, 1));
  let drops = prev ? prev.drops() : [], acc = 0, wet = 0, due = 0;
  if (prev) fog.c.drawImage(prev.canvas, 0, 0, W, H);
  const small = document.createElement('canvas'); small.width = GW; small.height = GH;
  const sc = small.getContext('2d', { willReadFrequently: true });
  function spawn(x, y, r) { drops.push({ x, y, r, gr: 0.012 + Math.random() * 0.03, slide: false, vy: 0, k: Math.random() * 9, dead: false }); }
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
  return {
    step(dt, t, m) {
      const f = fog.c;
      if ((due += dt) >= 2) {
        f.globalAlpha = clamp(due * GROW * (0.2 + 0.8 * m), 0, 1); f.drawImage(mask.cv, 0, 0, W, H);
        f.globalCompositeOperation = 'destination-out'; f.globalAlpha = clamp(due * DRY, 0, 1); f.fillStyle = '#000'; f.fillRect(0, 0, W, H);
        f.globalCompositeOperation = 'source-over'; f.globalAlpha = 1; due = 0;
      }
      acc += dt * 14 * (0.15 + 0.85 * m);
      while (acc > 1) { acc--; if (drops.length > 260) { acc = 0; break; } const x = Math.random() * W, y = Math.random() * Math.min(floor, H * 0.7); if (Math.random() < fogAt(x, y)) spawn(x, y, 0.4 + Math.random() * 0.45); }
      for (const d of drops) {
        if (!d.slide) { d.r += dt * d.gr; if (d.r > 2.4 && Math.random() < dt * 0.9) { d.slide = true; d.vy = 0; } }
        else {
          d.vy = Math.min(d.vy + dt * 50, 12 + d.r * 7); const ny = d.y + d.vy * dt, nx = d.x + Math.sin(t * 2.3 + d.k) * dt * 3;
          f.globalCompositeOperation = 'destination-out'; f.lineCap = 'round'; f.lineWidth = d.r * 1.5; f.beginPath(); f.moveTo(d.x, d.y); f.lineTo(nx, ny); f.stroke(); f.globalCompositeOperation = 'source-over';
          d.x = nx; d.y = ny; d.r -= dt * 0.22; if (d.r < 1.4) d.slide = false; if (d.y > floor) { d.dead = true; onDrip(d.x, d.r); }
        }
      }
      merge();
    },
    // vegen van (x0, y0) naar (x1, y1) met een spons van `wd` breed
    wipe(x0, y0, x1, y1, wd = 15) {
      const f = fog.c; f.globalCompositeOperation = 'destination-out'; f.lineCap = 'round'; f.lineWidth = wd; f.beginPath(); f.moveTo(x0, y0); f.lineTo(x1, y1); f.stroke(); f.globalCompositeOperation = 'source-over';
      const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy || 1, nl = Math.sqrt(l2);
      for (const d of drops) { const s = clamp(((d.x - x0) * vx + (d.y - y0) * vy) / l2, 0, 1); if (Math.hypot(d.x - x0 - vx * s, d.y - y0 - vy * s) < wd / 2 + 0.5) { wet += d.r * d.r; d.dead = true; } }
      if (wet > 5) { const side = Math.random() < 0.5 ? -1 : 1; spawn(x1 - vy / nl * (wd / 2 + 1) * side, y1 + vx / nl * (wd / 2 + 1) * side, Math.min(2.9, Math.sqrt(wet))); wet = 0; }
      drops = drops.filter(d => !d.dead);
    },
    lift() { wet = 0; },
    // eerste keer: het glas is al wat beslagen als je kijkt
    prime(m) { const f = fog.c; f.globalAlpha = 0.34 * (0.2 + 0.8 * m); f.drawImage(mask.cv, 0, 0, W, H); f.globalAlpha = 1; },
    // nevel tegen het glas rond (x, y): een waas en fijne druppels
    mist(x, y, r = 34, n = 14, a = 0.14) {
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r, dy = y + Math.sin(a) * d * 0.8; if (dy < floor - 1) spawn(x + Math.cos(a) * d, dy, 0.4 + Math.random() * 0.5); }
      const f = fog.c, rg = f.createRadialGradient(x, y, 0, x, y, r * 1.2); rg.addColorStop(0, `rgba(255,255,255,${a})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); f.fillStyle = rg; f.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
    },
    canvas: fog.cv,
    drops: () => drops,
    // de stand kort opgeschreven: aanslag per vakje (0 tot z) en de grootste druppels [x, y, straal x 10]
    pack() {
      sc.globalCompositeOperation = 'copy'; sc.drawImage(fog.cv, 0, 0, GW, GH);
      const d = sc.getImageData(0, 0, GW, GH).data; let fogS = '';
      for (let i = 0; i < GW * GH; i++) fogS += B36[Math.round(d[i * 4 + 3] / 255 * 35)];
      const big = [...drops].sort((a, b) => b.r - a.r).slice(0, 40).flatMap(o => [Math.round(o.x), Math.round(o.y), Math.round(o.r * 10)]);
      return { fog: fogS, drops: big };
    },
    // terugzetten, met de aangroei van `sec` seconden bij vochtigheid m
    unpack(v, sec = 0, m = 1) {
      if (typeof v?.fog !== 'string' || v.fog.length !== GW * GH) return false;
      const im = sc.createImageData(GW, GH), gm = GROW * (0.2 + 0.8 * m), tt = Math.max(0, sec);
      for (let i = 0; i < GW * GH; i++) { const a = (B36.indexOf(v.fog[i]) || 0) / 35, x = (i % GW + 0.5) / GW * W, y = (Math.floor(i / GW) + 0.5) / GH * H; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 255; const g = gm * fogAt(x, y), eq = g / (g + DRY); im.data[i * 4 + 3] = Math.round(255 * (eq + (Math.max(0, a) - eq) * Math.exp(-(g + DRY) * tt))); }
      sc.putImageData(im, 0, 0);
      const f = fog.c; f.save(); f.globalCompositeOperation = 'copy'; f.imageSmoothingEnabled = true; f.imageSmoothingQuality = 'high'; f.drawImage(small, 0, 0, W, H); f.restore();
      drops = [];
      if (Array.isArray(v.drops)) for (let i = 0; i + 2 < v.drops.length; i += 3) if (v.drops[i + 1] < floor) spawn(v.drops[i], v.drops[i + 1], clamp(v.drops[i + 2] / 10, 0.3, 3));
      return true;
    },
    draw(g) {
      g.globalAlpha = 0.42; g.drawImage(fog.cv, 0, 0, W, H); g.globalAlpha = 1;
      const fc = fog.c; fc.globalCompositeOperation = 'destination-out'; fc.fillStyle = '#000'; fc.beginPath(); for (const d of drops) { fc.moveTo(d.x + d.r, d.y); fc.arc(d.x, d.y, d.r * 1.05, 0, TAU); } fc.fill(); fc.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); for (const d of drops) { if (d.r < 1.3) continue; g.moveTo(d.x + d.r, d.y); g.arc(d.x, d.y, d.r, 0, TAU); } g.fill();
      g.lineWidth = 0.6; g.strokeStyle = 'rgba(20,30,30,.16)'; g.beginPath(); for (const d of drops) { if (d.r < 1.3) continue; g.moveTo(d.x + Math.cos(0.15 * Math.PI) * d.r, d.y + Math.sin(0.15 * Math.PI) * d.r); g.arc(d.x, d.y, d.r, 0.15 * Math.PI, 0.95 * Math.PI); } g.stroke();
      g.fillStyle = 'rgba(255,255,255,.26)'; g.beginPath(); for (const d of drops) { if (d.r >= 1.3) continue; g.moveTo(d.x + d.r * 0.7, d.y); g.arc(d.x, d.y, d.r * 0.7, 0, TAU); } g.fill();
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); for (const d of drops) { if (d.r < 1.2) continue; const hr = d.r * 0.28; g.moveTo(d.x - d.r * 0.35 + hr, d.y - d.r * 0.38); g.arc(d.x - d.r * 0.35, d.y - d.r * 0.38, hr, 0, TAU); } g.fill();
    },
  };
}
