/* ---- Dieren van de natuurvensters: getekend naar het echte dier ---- */
// Victor (12/11/2026): "laat diertjes er net iets realistischer uitzien, geen uncanny valley, het mag getekend blijven".
// Elk dier volgt de bouw van zijn soort: de blauwe pijlgifkikker (Dendrobates tinctorius 'azureus') zit ineengedoken
// met gevouwen achterpoten en tenen met hechtschijfjes, zijn keel pulseert; de neontetra heeft een olijfgroene rug,
// zilveren buik, de lichtgevende streep van oog tot vetvin en het rood naar de staart; de slak rekt en trekt samen; de koi is van
// boven gezien met borstvinnen en vlekken; het vogeltje is een brilvogel (mejiro). Sprites één keer geschilderd,
// kleine dieren per beeld.

import { layer } from './brush.js';

const TAU = Math.PI * 2;
const limb = (c, pts, w, col) => { c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
const toes = (c, x, y, tips, col) => { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 0.42; for (const [tx, ty] of tips) { c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke(); c.beginPath(); c.arc(tx, ty, 0.42, 0, TAU); c.fill(); } };

// pijlgifkikker, kijkt naar rechts, voeten op y = 0; pose 'sit' of 'leap'. Oorsprong onder het midden van het lijf.
export function frogSprite(scale, pose = 'sit') {
  const leap = pose === 'leap', s = layer(leap ? 46 : 30, 22, scale, leap ? 26 : 14, 18), c = s.c;
  const LEG = '#1b3894', LEG2 = '#12266c', SPOT = '#0c1436';
  // achterste poten (ver), donkerder
  if (leap) { limb(c, [[-5.5, -4.6], [-10.5, -3.6], [-15, -3.2]], 2.4, LEG2); limb(c, [[3.6, -4.6], [6.4, -2.6], [8.6, -1.6]], 1.4, LEG2); }
  else { limb(c, [[-5, -4.4], [-0.4, -5], [-5.8, -1.6], [-1.2, -0.9]], 1.9, LEG2); limb(c, [[5.2, -4.4], [4.6, -2.2], [6.2, -0.7]], 1.3, LEG2); toes(c, 6.2, -0.7, [[7.6, -1.1], [7.8, -0.3]], LEG2); }
  // lijf: rug in het licht, flank donkerder
  const body = c.createLinearGradient(0, -10.5, 0, -1.5); body.addColorStop(0, '#5a97f2'); body.addColorStop(0.35, '#2f6fdc'); body.addColorStop(1, '#1b3f9e');
  c.fillStyle = body; c.beginPath(); c.moveTo(-8.6, -3.6);
  c.bezierCurveTo(-8.2, -8, -3.2, -10.3, 1, -9.7); c.bezierCurveTo(4.2, -9.3, 7.6, -8.7, 8.9, -6.6); c.bezierCurveTo(9.3, -5.6, 8.5, -4.4, 6.8, -3.8); c.bezierCurveTo(4, -2.3, -2, -1.2, -6, -1.6); c.bezierCurveTo(-8, -1.8, -8.9, -2.6, -8.6, -3.6); c.closePath(); c.fill();
  c.save(); c.clip();
  c.fillStyle = 'rgba(126,178,240,.75)'; c.beginPath(); c.ellipse(4.6, -3.2, 4.2, 1.5, -0.25, 0, TAU); c.fill();           // lichte keel en buik
  c.fillStyle = SPOT; for (const [x, y, rx, ry, a] of [[-4.2, -7.5, 1.35, 0.85, 0.4], [-0.9, -8.5, 1.15, 0.75, 0.1], [2.5, -8.3, 0.95, 0.65, -0.1], [-6.3, -5.2, 0.95, 0.8, 0.9], [-2.2, -6, 0.85, 0.6, 0.3], [4.9, -8, 0.6, 0.45, 0], [1.1, -6.3, 0.6, 0.5, 0], [-7.4, -3.2, 0.6, 0.5, 0], [7.4, -7.6, 0.45, 0.35, 0]]) { c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, TAU); c.fill(); }
  c.restore();
  // natte glans op de rug
  c.strokeStyle = 'rgba(214,232,255,.6)'; c.lineWidth = 0.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-5.2, -8.5); c.quadraticCurveTo(-1, -10.1, 3.2, -9.2); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(-2.4, -9.2, 0.9, 0.3, -0.2, 0, TAU); c.fill();
  // voorste poten (dichtbij)
  if (leap) {
    limb(c, [[-6, -3.6], [-11.5, -1.9], [-16.5, -1.3]], 3, LEG); limb(c, [[-16.5, -1.3], [-21, -0.4]], 1.1, LEG); toes(c, -21, -0.4, [[-23.2, -1.2], [-23.6, -0.2], [-23, 0.7]], LEG);
    limb(c, [[4.2, -4], [7, -1.6], [9.4, -0.4]], 1.6, LEG); toes(c, 9.4, -0.4, [[11, -0.9], [11.2, 0], [10.6, 0.7]], LEG);
  } else {
    limb(c, [[-6, -3.6], [-1.2, -4.3]], 3.4, LEG); limb(c, [[-1.2, -4.3], [-6.8, -0.9]], 2.3, LEG); limb(c, [[-6.8, -0.7], [-2.4, -0.4]], 1.15, LEG); toes(c, -2.4, -0.4, [[-0.5, -1.1], [-0.2, -0.3], [-0.9, 0]], LEG);
    c.fillStyle = SPOT; c.beginPath(); c.ellipse(-3.4, -4.1, 0.7, 0.5, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(120,170,240,.5)'; c.lineWidth = 0.4; c.beginPath(); c.moveTo(-5.4, -4.9); c.lineTo(-2, -5.4); c.stroke();
    limb(c, [[4.2, -4.2], [3.3, -2], [5, -0.5]], 1.6, LEG); toes(c, 5, -0.5, [[6.6, -1], [6.9, -0.2], [6.1, 0]], LEG);
  }
  // oog: donkere bol met glans, bek, neusgat
  c.fillStyle = '#1d3f9e'; c.beginPath(); c.arc(6.1, -7.7, 1.85, 0, TAU); c.fill();
  c.fillStyle = '#07090f'; c.beginPath(); c.arc(6.2, -7.6, 1.38, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(120,170,240,.6)'; c.lineWidth = 0.3; c.beginPath(); c.arc(6.2, -7.6, 1.5, 0.2, 2.4); c.stroke();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(6.7, -8.2, 0.42, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(8,14,44,.75)'; c.lineWidth = 0.32; c.beginPath(); c.moveTo(8.9, -5.9); c.quadraticCurveTo(7, -5, 5.2, -4.9); c.stroke();
  c.fillStyle = 'rgba(8,14,44,.8)'; c.beginPath(); c.arc(8.5, -7, 0.22, 0, TAU); c.fill();
  return s;
}
// de kikker in het beeld: f = { x, y, face, squash, blink, air (0 = zit), tilt }, t voor de keel
export function drawFrog(g, sit, leapS, f, t) {
  g.save(); g.translate(f.x, f.y); g.scale(f.face * (1 + f.squash * 0.14), 1 - f.squash * 0.16);
  if (f.air) { g.rotate(f.tilt); g.drawImage(leapS.cv, -26, -18, 46, 22); }
  else {
    g.drawImage(sit.cv, -14, -18, 30, 22);
    const p = 0.5 + 0.5 * Math.sin(t * 5.2);                                                     // keel pulseert
    g.fillStyle = `rgba(150,196,246,${0.28 + 0.3 * p})`; g.beginPath(); g.ellipse(5.9, -3.7, 1.7 + p * 0.5, 0.8 + p * 0.45, -0.2, 0, TAU); g.fill();
  }
  if (f.blink < 0) { g.fillStyle = '#2f6fdc'; g.beginPath(); g.arc(6.15, -7.65, 1.6, 0, TAU); g.fill(); g.strokeStyle = 'rgba(8,14,44,.6)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(4.9, -7.3); g.lineTo(7.5, -7.3); g.stroke(); }
  g.restore();
}

// neontetra, per beeld getekend: x, y, kant (-1 tot 1: draait door smal te worden), hoek, slag van de staart, glans
export function drawTetra(g, x, y, side, pitch, ph, glint = 0.5, s = 1) {
  const w = Math.sin(ph) * 0.9, sx = Math.sign(side || 1) * Math.max(0.16, Math.abs(side));
  g.save(); g.translate(x, y); g.rotate(pitch * Math.sign(side || 1)); g.scale(sx * s, s);
  // vinnen, doorschijnend
  g.fillStyle = 'rgba(214,224,222,.42)';
  g.beginPath(); g.moveTo(-3.5, 0); g.lineTo(-6.7, -2.4 + w); g.quadraticCurveTo(-5.2, w * 0.6, -6.7, 2.4 + w); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0, -1.8); g.lineTo(-2, -3.4 + w * 0.2); g.lineTo(-2.4, -1.5); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-0.4, 1.7); g.lineTo(-2.7, 3 + w * 0.2); g.lineTo(-3, 0.8); g.closePath(); g.fill();
  // lijf
  const body = g.createLinearGradient(0, -2.2, 0, 2); body.addColorStop(0, '#5f7260'); body.addColorStop(0.42, '#b9c6c2'); body.addColorStop(1, '#eef0ea');
  g.fillStyle = body; g.beginPath(); g.moveTo(5.5, 0); g.bezierCurveTo(4.5, -1.7, 1, -2.3, -1.5, -1.6); g.bezierCurveTo(-2.6, -1.2, -3.2, -0.7, -3.8, -0.45 + w * 0.25); g.lineTo(-3.8, 0.45 + w * 0.25); g.bezierCurveTo(-3.2, 0.8, -2, 1.7, 0.5, 1.9); g.bezierCurveTo(3, 2, 4.9, 1.2, 5.5, 0); g.closePath(); g.fill();
  // rood naar de staart, lichtgevende streep
  g.lineCap = 'round';
  g.strokeStyle = '#dc3a30'; g.lineWidth = 1; g.beginPath(); g.moveTo(0.2, 0.35); g.quadraticCurveTo(-2, 0.4, -4.1, w * 0.3); g.stroke();
  g.strokeStyle = `rgb(${40 + glint * 70 | 0},${190 + glint * 50 | 0},${246 - glint * 30 | 0})`; g.lineWidth = 0.78; g.beginPath(); g.moveTo(4.1, -0.8); g.quadraticCurveTo(1, -1.25, -2.3, -0.85); g.stroke();
  g.strokeStyle = `rgba(230,255,255,${0.25 + glint * 0.5})`; g.lineWidth = 0.28; g.beginPath(); g.moveTo(3.4, -0.98); g.quadraticCurveTo(1, -1.36, -1.2, -1.02); g.stroke();
  // oog
  g.fillStyle = '#dfe7e6'; g.beginPath(); g.arc(4.15, -0.3, 0.8, 0, TAU); g.fill();
  g.fillStyle = '#0c1016'; g.beginPath(); g.arc(4.2, -0.3, 0.5, 0, TAU); g.fill();
  g.restore();
}

// huisjesslak, per beeld: d = richting (1 of -1), u = fase van het kruipen (het lijf rekt en trekt samen)
export function drawSnail(g, x, y, d, u, slope = 0) {
  const st = 0.5 + 0.5 * Math.sin(u * TAU);
  g.save(); g.translate(x, y); g.rotate(slope); g.scale(d, 1);
  g.fillStyle = '#b9a47c'; g.beginPath(); g.moveTo(-4.2, 0); g.quadraticCurveTo(-1, -1.5, 4.4 + st * 0.9, -0.8); g.quadraticCurveTo(5.4 + st * 0.9, -0.2, 4.6 + st * 0.9, 0); g.closePath(); g.fill();
  g.strokeStyle = '#9a8660'; g.lineWidth = 0.34; g.lineCap = 'round'; g.beginPath(); g.moveTo(4.2 + st * 0.9, -0.8); g.lineTo(5.6 + st, -3 - st * 0.3); g.moveTo(3.5 + st * 0.9, -0.9); g.lineTo(4.2 + st, -2.7); g.stroke();
  g.fillStyle = '#9a8660'; g.beginPath(); g.arc(5.6 + st, -3 - st * 0.3, 0.3, 0, TAU); g.arc(4.2 + st, -2.7, 0.26, 0, TAU); g.fill();
  const sh = g.createRadialGradient(-1.2, -3.4, 0.3, -0.6, -2.6, 3.2); sh.addColorStop(0, '#c99a62'); sh.addColorStop(0.6, '#8a5a34'); sh.addColorStop(1, '#5a3822');
  g.fillStyle = sh; g.beginPath(); g.ellipse(-0.6, -2.5, 3, 2.7, -0.2, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(60,34,18,.7)'; g.lineWidth = 0.4; g.beginPath(); for (let a = 0; a < 9.5; a += 0.3) { const r = 0.25 + a * 0.26, px = -0.5 + Math.cos(a + 2.4) * r, py = -2.5 + Math.sin(a + 2.4) * r * 0.9; a ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
  g.fillStyle = 'rgba(255,240,210,.5)'; g.beginPath(); g.ellipse(-1.6, -3.9, 0.9, 0.4, -0.5, 0, TAU); g.fill();
  g.restore();
}

// koi van boven, in een vijver die schuin gezien wordt: ruggengraat sp (kop eerst), kleurpatroon, vy = verkorting
export function drawKoi(g, k, vy = 0.5, alpha = 0.9) {
  const sp = k.sp, n = sp.length, Lp = [], Rp = [], N = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1), [x, y] = sp[i], [ax, ay] = sp[Math.max(0, i - 1)], [bx, by] = sp[Math.min(n - 1, i + 1)], dx = ax - bx, dy = (ay - by) / vy, l = Math.hypot(dx, dy) || 1;
    const wd = k.size * (s < 0.22 ? 0.55 + 0.45 * Math.sin(s / 0.22 * Math.PI / 2) : 1 - ((s - 0.22) / 0.78) ** 1.25 * 0.86), nx = -dy / l, ny = dx / l * vy;
    Lp.push([x + nx * wd, y + ny * wd]); Rp.push([x - nx * wd, y - ny * wd]); N.push([nx, ny, wd]);
  }
  g.globalAlpha = alpha;
  // borstvinnen en staart, doorschijnend
  g.fillStyle = k.fin;
  for (const sgn of [1, -1]) { const [x, y] = sp[2], [nx, ny, wd] = N[2], fl = 0.5 + 0.3 * Math.sin(k.ph * 0.8 + sgn), ex = x + nx * sgn * wd * (1.6 + fl) + (sp[4][0] - sp[2][0]) * 0.55, ey = y + ny * sgn * wd * (1.6 + fl) + (sp[4][1] - sp[2][1]) * 0.55; g.beginPath(); g.moveTo(x + nx * sgn * wd * 0.8, y + ny * sgn * wd * 0.8); g.quadraticCurveTo(x + nx * sgn * wd * 2.2, y + ny * sgn * wd * 2.2, ex, ey); g.quadraticCurveTo((x + ex) / 2, (y + ey) / 2, x + nx * sgn * wd * 0.8, y + ny * sgn * wd * 0.8); g.fill(); }
  { const [tx, ty] = sp[n - 1], [ux, uy] = sp[n - 2], ta = Math.atan2((ty - uy) / vy, tx - ux) + Math.sin(k.ph) * 0.35, L = k.size * 2.3; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(ta + 0.25) * L * 0.6, ty + Math.sin(ta + 0.25) * L * 0.6 * vy, tx + Math.cos(ta + 0.62) * L, ty + Math.sin(ta + 0.62) * L * vy); g.quadraticCurveTo(tx + Math.cos(ta) * L * 0.55, ty + Math.sin(ta) * L * 0.55 * vy, tx + Math.cos(ta - 0.62) * L, ty + Math.sin(ta - 0.62) * L * vy); g.quadraticCurveTo(tx + Math.cos(ta - 0.25) * L * 0.6, ty + Math.sin(ta - 0.25) * L * 0.6 * vy, tx, ty); g.fill(); }
  // lijf met vlekken
  const path = () => { g.beginPath(); g.moveTo(...Lp[0]); for (let i = 1; i < n; i++) g.lineTo(...Lp[i]); for (let i = n - 1; i >= 0; i--) g.lineTo(...Rp[i]); g.closePath(); };
  path(); g.fillStyle = k.col; g.fill();
  g.save(); path(); g.clip();
  for (const [s, off, r, col] of k.marks) { const i = Math.min(n - 1, Math.round(s * (n - 1))), [x, y] = sp[i], [nx, ny, wd] = N[i]; g.fillStyle = col; g.beginPath(); g.ellipse(x + nx * off * wd, y + ny * off * wd, r * k.size * 1.5, r * k.size * 1.5 * vy + 0.3, 0, 0, TAU); g.fill(); }
  // rug iets donkerder, een lichte lijn langs de ruggengraat
  g.strokeStyle = 'rgba(20,24,30,.16)'; g.lineWidth = k.size * 0.9; g.lineCap = 'round'; g.beginPath(); sp.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  g.restore();
  g.fillStyle = 'rgba(14,16,20,.8)'; for (const sgn of [1, -1]) { const [x, y] = sp[0], [nx, ny, wd] = N[1]; g.beginPath(); g.arc(x + nx * sgn * wd * 0.62 + (sp[1][0] - x) * 0.4, y + ny * sgn * wd * 0.62 + (sp[1][1] - y) * 0.4, 0.34, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
}

// brilvogel (mejiro): olijfgroen, gele keel, witte oogring; b = { x, y, face, hop, look, fly (0 tot 1 vleugelslag) }
export function drawBird(g, b, t) {
  g.save(); g.translate(b.x, b.y - (b.hop || 0)); g.scale(b.face || 1, 1);
  const fly = b.fly != null;
  if (fly) g.rotate(-0.25);
  // staart, lijf, kop
  g.fillStyle = '#4a5a2c'; g.beginPath(); g.moveTo(-3, -2.6); g.lineTo(-7.6, -1.2); g.lineTo(-7.2, -0.2); g.lineTo(-2.6, -1.4); g.closePath(); g.fill();
  const body = g.createLinearGradient(0, -6, 0, 0); body.addColorStop(0, '#7f9a3a'); body.addColorStop(0.55, '#8a9a54'); body.addColorStop(1, '#d8d4c2');
  g.fillStyle = body; g.beginPath(); g.ellipse(-0.4, -2.9, 3.6, 2.6, -0.25, 0, TAU); g.fill();
  g.fillStyle = '#d9cf5a'; g.beginPath(); g.ellipse(2.3, -3.6, 1.5, 1.2, 0.3, 0, TAU); g.fill();
  const hx = 2.6 + (b.look || 0) * 0.4, hy = -5.2;
  g.fillStyle = '#86a03c'; g.beginPath(); g.arc(hx, hy, 2.05, 0, TAU); g.fill();
  g.fillStyle = '#d9cf5a'; g.beginPath(); g.ellipse(hx + 0.7, hy + 1.1, 1.3, 0.8, 0.4, 0, TAU); g.fill();
  g.fillStyle = '#2a2a26'; g.beginPath(); g.moveTo(hx + 1.7, hy - 0.4); g.lineTo(hx + 3.7 + (b.look || 0) * 0.3, hy + 0.1); g.lineTo(hx + 1.7, hy + 0.5); g.closePath(); g.fill();
  g.fillStyle = '#f6f6f0'; g.beginPath(); g.arc(hx + 0.75, hy - 0.35, 0.82, 0, TAU); g.fill();
  g.fillStyle = '#101010'; g.beginPath(); g.arc(hx + 0.8, hy - 0.35, 0.46, 0, TAU); g.fill();
  // vleugel: dicht tegen het lijf, of slaand
  g.fillStyle = '#5a6a30';
  if (fly) { const f = Math.sin(t * 34), up = f * 5; g.beginPath(); g.moveTo(1.4, -3.6); g.quadraticCurveTo(-1, -5 - up, -5, -4 - up * 1.4); g.quadraticCurveTo(-2.4, -3, -1.6, -2.2); g.closePath(); g.fill(); }
  else { g.beginPath(); g.moveTo(1.2, -3.8); g.quadraticCurveTo(-1.6, -4.6, -4.4, -2); g.quadraticCurveTo(-1.6, -1.4, 0.8, -2.2); g.closePath(); g.fill(); g.strokeStyle = 'rgba(40,50,20,.5)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(-0.2, -3); g.lineTo(-3.6, -2.2); g.stroke(); }
  if (!fly) { g.strokeStyle = '#3a3428'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(0.2, -0.6); g.lineTo(0.4, 0.4); g.moveTo(-1, -0.6); g.lineTo(-1, 0.4); g.stroke(); }
  g.restore();
}
