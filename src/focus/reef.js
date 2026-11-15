/* ---- Rif in stippen ---- */
// Naar "underwater-reef" van ascii-magic.com in de look "dots" (Victor, 15/11/2026), eigen code.
// Water dat donkerder wordt naar de diepte, schuine lichtbundels en wiegende lichtvlekken, een zandbodem met koraal
// (hersenkoraal, vertakt koraal, waaierkoraal) en wuivend wier, vissen, een school visjes en opstijgende belletjes.
// Tik: een wolk belletjes en de vissen in de buurt schieten weg. Slepen: de school volgt je vinger.

import { clamp, fbm, hex, mixc, ramp, rng } from './dots.js';

const SEA = ramp([[0, '#64cfe0'], [0.25, '#2196bc'], [0.55, '#0b5c8c'], [0.8, '#073262'], [1, '#03142f']]);
const RAY = hex('#c4f2f8'), SAND = ramp([[0, '#e6d2a2'], [0.5, '#b49c70'], [1, '#4e4a50']]);
const CORAL = ['#ff5a7a', '#ff8a5a', '#ffb84a', '#c84ac8', '#8a6aff', '#ff7ab8'].map(hex), GROOVE = hex('#c8384e');
const WEED = ['#1f6e3e', '#33a65e', '#74d282'].map(hex);
const FISH = ['#ffa040', '#ffe04a', '#4ac8ff', '#ff6a5a', '#b67aff', '#5affc8'].map(hex), WHITE = [1, 1, 1], EYE = hex('#0a1a2a');
const BUBBLE = hex('#d4f6ff');

export function createReef({ cols, rows }) {
  const r = rng(21);
  const N = cols * rows, still = new Array(N).fill(null);
  const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < cols && y < rows) still[x + y * cols] = c; };
  const bed = Array.from({ length: cols }, (_, x) => Math.round(rows * 0.8 + (fbm(x * 0.05, 3.1, 3, 6) - 0.5) * rows * 0.12));
  // zand, lichter bovenaan
  for (let x = 0; x < cols; x++) for (let y = bed[x]; y < rows; y++) put(x, y, SAND(clamp((y - bed[x]) / 9 + (fbm(x * 0.3, y * 0.5, 2, 1) - 0.5) * 0.5)));
  // hersenkoraal: bulten met groeven
  const at = f => Math.round(f * cols);
  for (const [f, rad, c] of [[0.12, 0.09, 0], [0.45, 0.07, 2], [0.8, 0.1, 1], [0.95, 0.06, 5]]) {
    const cx = at(f), R = rad * rows * 1.1, by = bed[Math.min(cols - 1, cx)];
    for (let y = by - R; y <= by + 1; y++) for (let x = cx - R * 1.5; x <= cx + R * 1.5; x++) {
      const d = Math.hypot((x - cx) / (R * 1.5), (y - by) / R);
      if (d < 1) put(x, y, Math.sin(x * 0.9 + y * 1.9 + Math.sin(y * 1.3) * 2) > 0.45 ? GROOVE : mixc(CORAL[c], [0, 0, 0], d * 0.35));
    }
  }
  // vertakt koraal
  const branch = (x, y, a, len, depth, c) => {
    for (let i = 0; i < len; i++) { x += Math.cos(a) * 0.8; y -= Math.sin(a) * 0.8; put(x, y, CORAL[c]); if (depth > 1) put(x + 1, y, CORAL[c]); }
    put(x, y - 1, mixc(CORAL[c], WHITE, 0.4));
    if (depth > 0) { branch(x, y, a + 0.5 + r() * 0.3, len * 0.72, depth - 1, c); branch(x, y, a - 0.5 - r() * 0.3, len * 0.72, depth - 1, c); }
  };
  for (const [f, c] of [[0.27, 3], [0.6, 0], [0.69, 4], [0.36, 5]]) { const x = at(f); branch(x, bed[x], Math.PI / 2, rows * 0.07 + r() * 3, 3, c); }
  // waaierkoraal: een open rooster
  for (const f of [0.87, 0.04]) {
    const fx = at(f), top = bed[fx] - Math.round(rows * 0.3);
    for (let y = top; y < bed[fx]; y++) {
      const w = Math.round(Math.sin((y - top) / (bed[fx] - top) * Math.PI) * rows * 0.12);
      for (let x = fx - w; x <= fx + w; x++) if ((x + y) % 3 === 0 || (x - y) % 3 === 0) put(x, y, CORAL[3]);
    }
  }
  const weeds = [0.2, 0.52, 0.64, 0.73, 0.98, 0.08, 0.41].map((f, i) => [at(f), Math.round(rows * (0.2 + 0.1 * ((i * 7) % 3)))]);
  const fish = Array.from({ length: Math.max(5, Math.round(cols * rows / 520)) }, (_, i) => ({
    x: r() * cols, y: rows * 0.12 + r() * rows * 0.55, v: (2 + r() * 4) * (r() < 0.5 ? -1 : 1), kick: 0, ky: 0, len: 3 + Math.floor(r() * 4), c: i % FISH.length, ph: r() * 6.3,
  }));
  const school = Array.from({ length: 22 }, () => [r() * 9 - 4.5, r() * 5 - 2.5, r() * 6.3]);
  let sx = cols / 2, sy = rows * 0.35, target = null;
  let bubbles = Array.from({ length: Math.round(cols / 3) }, () => ({ x: r() * cols, y: r() * rows, v: 2 + r() * 3, ph: r() * 6.3 }));
  let burst = [];

  return {
    still: 7,
    step(dt, t) {
      for (const f of fish) {
        f.x += (f.v + f.kick) * dt; f.kick *= Math.exp(-dt * 1.5); f.y += f.ky * dt; f.ky *= Math.exp(-dt * 1.5);
        f.y = clamp(f.y, rows * 0.08, rows * 0.72);
        if (f.x > cols + 10) f.x = -10; if (f.x < -10) f.x = cols + 10;
      }
      const tx = target ? target[0] : cols / 2 + Math.sin(t * 0.25) * cols * 0.32, ty = target ? target[1] : rows * 0.35 + Math.sin(t * 0.4) * rows * 0.1;
      sx += (tx - sx) * Math.min(1, dt * (target ? 2.5 : 0.8)); sy += (ty - sy) * Math.min(1, dt * (target ? 2.5 : 0.8));
      for (const b of bubbles) { b.y -= b.v * dt; if (b.y < 1) { b.y = rows - 2; b.x = Math.random() * cols; } }
      for (const b of burst) { b.y -= b.v * dt; b.v += dt * 2; }
      if (burst.length) burst = burst.filter(b => b.y > 1);
    },
    frame(grid, t) {
      // water: verloop naar de diepte, wiegende lichtvlekken, schuine bundels die met de golven bewegen
      for (let y = 0; y < rows; y++) {
        const depth = y / rows;
        for (let x = 0; x < cols; x++) {
          const n = fbm(x * 0.05 + t * 0.06, y * 0.09 - t * 0.04, 3, 4);
          const ray = Math.max(0, Math.sin((x + y * 0.5) * 0.16 + Math.sin(t * 0.35 + x * 0.015) * 1.4)) ** 8 * (1 - depth) * (0.6 + 0.4 * Math.sin(t * 0.6 + x * 0.04));
          const c = SEA(clamp(depth * 1.05 - (n - 0.5) * 0.3));
          grid.set(x, y, ray > 0.05 ? mixc(c, RAY, Math.min(0.7, ray)) : c);
        }
      }
      // koraal en zand
      for (let i = 0; i < N; i++) if (still[i]) grid.set(i % cols, Math.floor(i / cols), still[i]);
      // wier
      for (const [wx, h] of weeds) for (let j = 0; j < h; j++) {
        const sw = Math.sin(t * 1.4 + j * 0.3 + wx) * j * 0.14;
        grid.set(wx + sw, bed[Math.min(cols - 1, wx)] - j, WEED[j > h - 3 ? 2 : j % 2]);
      }
      // vissen: lijf als spoel, staart achteraan, oog vooraan
      for (const f of fish) {
        const dir = f.v + f.kick > 0 ? 1 : -1, y = f.y + Math.sin(t * 1.1 + f.ph) * 0.8;
        for (let i = 0; i < f.len; i++) {
          const fx = f.x - dir * i, half = Math.sin((i + 0.5) / f.len * Math.PI) * (f.len > 4 ? 1.2 : 0.7);
          for (let dy = -Math.floor(half); dy <= Math.floor(half); dy++) grid.set(fx, y + dy, i === 1 && dy === 0 ? EYE : f.c === 0 && i % 2 ? WHITE : FISH[f.c]);
        }
        const tx = f.x - dir * f.len, wag = Math.sin(t * 8 + f.ph) > 0 ? 1 : 0;
        grid.set(tx, y - 1 + wag, FISH[f.c]); grid.set(tx, y + wag, FISH[f.c]);
      }
      // school
      for (const [ox, oy, ph] of school) grid.set(sx + ox + Math.sin(t * 2 + ph) * 0.7, sy + oy + Math.cos(t * 1.7 + ph) * 0.4, FISH[2], 0.6);
      // belletjes: klein onderaan, groter naar boven
      for (const b of [...bubbles, ...burst]) grid.set(b.x + Math.sin(t * 2 + b.ph) * 0.7, b.y, BUBBLE, 0.35 + 0.55 * (1 - b.y / rows));
    },
    tap(p) {
      const x = p.x / 4, y = p.y / 4;
      for (let i = 0; i < 14; i++) burst.push({ x: x + (Math.random() - 0.5) * 3, y: y + (Math.random() - 0.5) * 2, v: 3 + Math.random() * 6, ph: Math.random() * 6.3 });
      for (const f of fish) {
        const dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy);
        if (d < 22) { f.kick = Math.sign(dx || 1) * 18 * (1 - d / 22) - f.v * 0.5; f.ky = Math.sign(dy || 1) * 8 * (1 - d / 22); }
      }
    },
    down(p) { target = [p.x / 4, p.y / 4]; },
    drag(p) { target = [p.x / 4, p.y / 4]; },
    up() { target = null; },
    leave() { target = null; },
  };
}
