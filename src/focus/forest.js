/* ---- Woud in stippen ---- */
// Naar "redwood-forest-light" van ascii-magic.com in de look "dots" (Victor, 15/11/2026), eigen code.
// Reuzenstammen in vier rijen, ver en vaag tot dichtbij en warm, met groeven in de schors en licht van één kant;
// een varenbodem met een kronkelpad en een wandelaar, nevel die door schuine zonnebundels trekt, stofjes in het licht
// en een vogel tussen de stammen. Slepen verschuift de zon (de bundels kantelen mee); een tik stuurt een windvlaag
// door de nevel die de stofjes doet dwarrelen.

import { clamp, fbm, hex, mixc, noise, ramp, rng } from './dots.js';

const AIR = ramp([[0, '#eaf0da'], [0.6, '#c8d4b0'], [1, '#a4b892']]);
const SUN = hex('#fff6dc'), FERN = hex('#b8dc80'), FERN2 = hex('#6a9a50'), DEEP = hex('#34522e'), PATH = hex('#dcc6a0');
const HIKER = hex('#e86a4a'), PACK = hex('#3a6aa8'), SKIN = hex('#e8c8a0'), BIRD = hex('#2a2420');

export function createForest({ cols, rows }) {
  const r = rng(21), N = cols * rows;
  const ground = Math.round(rows * 0.72);
  const base = new Array(N), trunk = new Uint8Array(N);
  const put = (x, y, c, k = 0) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < cols && y < rows) { base[x + y * cols] = c; trunk[x + y * cols] = k; } };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) put(x, y, AIR(y / ground));
  // stammen, ver naar dichtbij: dun en vaag in de nevel, dik en warm vooraan; voet die uitwaaiert
  const S = rows / 57;
  for (const [far, n, wmin, wmax] of [[0.8, 7, 1.5, 2.5], [0.55, 5, 2.5, 3.5], [0.25, 3, 4, 6], [0, 2, 8, 11]]) {
    const lit = mixc(hex('#e8a07a'), hex('#c8d0b0'), far), sh = mixc(hex('#7a3e32'), hex('#a0ac8c'), far);
    for (let i = 0; i < n; i++) {
      const cx = (i + 0.2 + r() * 0.6) / n * cols, w = (wmin + r() * (wmax - wmin)) * S, foot = ground + (1 - far) * 5 * S;
      for (let y = 0; y < Math.min(rows, foot); y++) {
        const flare = y > foot - 6 * S ? (y - foot + 6 * S) * 0.35 * (1 - far) : 0;
        for (let x = Math.floor(cx - w / 2 - flare); x <= cx + w / 2 + flare; x++) {
          const u = (x - cx + w / 2 + flare) / (w + 2 * flare), groove = Math.sin(x * (2.4 - far) / S + noise(x / 2, y / 8, i) * 2) > 0.55;
          put(x, y, mixc(mixc(sh, lit, clamp(u * 1.2 - 0.1)), sh, groove ? 0.45 : 0), 1);
        }
      }
    }
  }
  // varens: licht waar de zon komt, donker vooraan
  for (let y = ground; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (trunk[x + y * cols] && y < ground + 2) continue;
    const frond = noise(x / 1.4, y / 1.1, 7) > 0.45 - fbm(x / 4, y / 2.5, 3, 5) * 0.3;
    put(x, y, mixc(frond ? FERN : FERN2, DEEP, clamp((y - ground) / (rows - ground) * 1.1)));
  }
  const trail = y => cols * 0.42 + Math.sin(y / 4) * cols * 0.05 - (y - ground) * 1.1;
  for (let y = ground; y < rows; y++) { const w = 0.6 + (y - ground) * 0.16; for (let x = trail(y) - w; x <= trail(y) + w; x++) put(x, y, PATH); }
  const motes = Array.from({ length: Math.round(cols * rows / 110) }, () => ({ x: r() * cols, y: r() * ground, ph: r() * 6.3, vx: 0, vy: 0 }));
  let sun = 0.55, sunTo = 0.55, gust = 0, grab = null, walk = 0;

  return {
    still: 4,
    step(dt, t) {
      sun += (sunTo - sun) * Math.min(1, dt * 4);
      gust *= Math.exp(-dt * 0.8); walk = (walk + dt * 0.035) % 1;
      for (const m of motes) {
        m.x += (Math.sin(t * 0.3 + m.ph) * 0.3 + m.vx + gust * 6) * dt; m.y += (Math.cos(t * 0.25 + m.ph) * 0.2 + m.vy) * dt;
        m.vx *= Math.exp(-dt); m.vy *= Math.exp(-dt);
        if (m.x > cols) m.x -= cols; if (m.x < 0) m.x += cols; if (m.y < 0) m.y += ground; if (m.y > ground) m.y -= ground;
      }
    },
    frame(grid, t) {
      for (let i = 0; i < N; i++) grid.set(i % cols, Math.floor(i / cols), base[i]);
      // bundels: schuine stroken licht, hun sterkte trekt mee met de nevel (en met een vlaag)
      const slope = sun, beam = x0 => (x, y) => x - (x0 + y * slope);
      const beams = [0.18, 0.4, 0.62, 0.84].map(f => beam(f * cols - ground * slope * 0.5));
      for (let y = 0; y < ground + 3; y++) for (let x = 0; x < cols; x++) {
        let a = 0;
        for (let b = 0; b < 4; b++) { const d = Math.abs(beams[b](x, y)); if (d < 4) a = Math.max(a, (1 - d / 4) * clamp(fbm(x / 9 - t * 0.1 - gust * 2, y / 7, 2, b + 3) * 1.6 - 0.2)); }
        const mist = clamp(fbm(x / 14 - t * 0.04 - gust, y / 6, 2, 9) - 0.45) * 0.9 * (1 - y / ground * 0.4);
        if (a > 0.02) grid.add(x, y, SUN, a * 0.7);
        if (mist > 0.02) grid.add(x, y, AIR(0.2), mist);
      }
      // stofjes: enkel zichtbaar in de bundels
      for (const m of motes) {
        let a = 0;
        for (const b of beams) a = Math.max(a, 1 - Math.abs(b(m.x, m.y)) / 4);
        if (a > 0) grid.set(m.x, m.y, SUN, 0.25 + 0.5 * a * (0.6 + 0.4 * Math.sin(t * 3 + m.ph)));
      }
      // wandelaar op het pad, klein voor de schaal
      const wy = ground + 2 + walk * (rows - ground - 5), wx = trail(wy), step = Math.sin(t * 5) > 0 ? 1 : 0;
      grid.set(wx, wy - 4, SKIN); grid.set(wx, wy - 3, HIKER); grid.set(wx + 1, wy - 3, PACK); grid.set(wx, wy - 2, HIKER);
      grid.set(wx - step, wy - 1, DEEP); grid.set(wx + 1 - step, wy - 1, DEEP);
      // vogel tussen de stammen
      const bx = ((t * 6) % (cols + 20)) - 10, by = rows * 0.22 + Math.sin(t * 0.7) * 3, flap = Math.sin(t * 9) > 0 ? -1 : 1;
      grid.set(bx, by, BIRD); grid.set(bx - 1, by + flap, BIRD); grid.set(bx + 1, by + flap, BIRD);
    },
    down(p) { grab = { x: p.x, s: sunTo }; },
    drag(p) { if (grab) sunTo = clamp(grab.s + (p.x - grab.x) / 200, -0.2, 1.2); },
    up() { grab = null; },
    leave() { grab = null; },
    tap() { gust = 1; for (const m of motes) { m.vx += (Math.random() - 0.3) * 6; m.vy += (Math.random() - 0.5) * 4; } },
  };
}
