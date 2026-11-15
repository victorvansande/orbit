/* ---- Stippen: halftoonraster voor de stippenscènes (Kleurkiezer, Rif, Woud) ---- */
// Victor (15/11/2026) wou drie stukken van ascii-magic.com in de look "dots" als fidget. Hun code is niet vrij
// ("All Rights Reserved"), dus dit is eigen werk naar het idee: elke scène kleurt per beeld een raster van vierkante
// vakjes, en elk vakje wordt één stip in zijn kleur, des te groter hoe lichter. Tekst en lijnwerk blijven gewone tekst
// (zoals de look zonder "all"). Vaste maat van een vakje: een groter bakje toont meer stippen, niet grotere.
// Een scène is { onDark, frame(grid, t, dt), overlay?(g), down/drag/up/tap/leave?(p) } en kleurt met grid.set.

export const CELL = 4;
const STEPS = 7, LEVELS = 20;
export const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
export const mix = (a, b, k) => a + (b - a) * k;
export const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
export const mixc = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];

// kleurverloop over stops [[pos, kleur], ...]
export function ramp(stops) {
  const S = stops.map(([p, c]) => [p, typeof c === 'string' ? hex(c) : c]);
  return v => {
    if (v <= S[0][0]) return S[0][1];
    for (let i = 1; i < S.length; i++) if (v <= S[i][0]) return mixc(S[i - 1][1], S[i][1], (v - S[i - 1][0]) / (S[i][0] - S[i - 1][0]));
    return S[S.length - 1][1];
  };
}

export function hsl(h, s, l) {
  h = ((h % 1) + 1) % 1;
  const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)];
}

// ruis met waarde-interpolatie, vaste seed
const hash = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
export function noise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return mix(mix(hash(xi, yi, s), hash(xi + 1, yi, s), u), mix(hash(xi, yi + 1, s), hash(xi + 1, yi + 1, s), u), v);
}
export function fbm(x, y, oct = 3, s = 0) {
  let a = 0.5, t = 0, n = 0;
  for (let i = 0; i < oct; i++) { t += a * noise(x, y, s + i * 17); n += a; x *= 2.03; y *= 2.03; a *= 0.5; }
  return t / n;
}
export function rng(seed) {
  let a = seed;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// raster van vakjes: kleur per vakje (0..1), en optioneel een eigen stipgrootte (anders volgt die het licht)
function createGrid(W, H) {
  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL), N = cols * rows;
  const col = new Float32Array(N * 3), size = new Float32Array(N);
  return {
    cols, rows,
    clear() { col.fill(0); size.fill(-1); },
    set(x, y, c, s = -1) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      const i = x + y * cols;
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; size[i] = s;
    },
    get(x, y) { const i = x + y * cols; return [col[i * 3], col[i * 3 + 1], col[i * 3 + 2]]; },
    // mengt een kleur over wat er al staat (licht, nevel)
    add(x, y, c, k) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      const i = (x + y * cols) * 3;
      col[i] = mix(col[i], c[0], k); col[i + 1] = mix(col[i + 1], c[1], k); col[i + 2] = mix(col[i + 2], c[2], k);
    },
    draw(g) {
      // stippen gegroepeerd per kleur en grootte: één pad per groep
      const groups = new Map();
      for (let i = 0; i < N; i++) {
        const r = col[i * 3], gg = col[i * 3 + 1], b = col[i * 3 + 2];
        let s = size[i];
        if (s < 0) s = Math.sqrt(clamp(0.2126 * r + 0.7152 * gg + 0.0722 * b)) * 1.08;
        const st = Math.round(clamp(s) * STEPS);
        if (!st) continue;
        const key = ((Math.round(r * LEVELS) * 32 + Math.round(gg * LEVELS)) * 32 + Math.round(b * LEVELS)) * 8 + st;
        let a = groups.get(key);
        if (!a) groups.set(key, a = []);
        a.push(i);
      }
      for (const [key, list] of groups) {
        const st = key % 8, k = Math.floor(key / 8), rr = st / STEPS * CELL * 0.5;
        g.fillStyle = `rgb(${Math.round(Math.floor(k / 1024) / LEVELS * 255)},${Math.round(Math.floor(k / 32) % 32 / LEVELS * 255)},${Math.round(k % 32 / LEVELS * 255)})`;
        g.beginPath();
        for (const i of list) {
          const x = (i % cols + 0.5) * CELL, y = (Math.floor(i / cols) + 0.5) * CELL;
          g.moveTo(x + rr, y); g.arc(x, y, rr, 0, Math.PI * 2);
        }
        g.fill();
      }
    },
  };
}

// fidget rond een scène: eigen canvas, 30 beelden per seconde, minder beweging = één beeld (en opnieuw bij aanraken)
export function createDotFidget(makeScene, { reducedMotion, size }) {
  const W = size?.w || 325.6, H = size?.h || 226.8;
  let cv = null, g = null, grid = null, scene = null, last = 0, t = 0, acc = 0;
  const BG = '#0A0C13';
  function render() {
    if (!g) return;
    grid.clear();
    scene.frame(grid, t, 0);
    g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    g.fillStyle = scene.bg || BG; g.fillRect(0, 0, W, H);
    grid.draw(g);
    if (scene.overlay) { g.save(); scene.overlay(g); g.restore(); }
  }
  const still = () => reducedMotion.matches;
  const hand = name => p => { scene?.[name]?.(p); if (still()) render(); };
  return {
    own: true,
    onDark: true,
    init() {},
    mount(el) {
      if (cv) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      cv = document.createElement('canvas');
      cv.className = 'panel-canvas'; cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      el.append(cv);
      g = cv.getContext('2d');
      grid = createGrid(W, H);
      scene = makeScene({ W, H, cols: grid.cols, rows: grid.rows });
      last = 0; acc = 1;
      if (still()) { t = scene.still ?? 6; render(); document.fonts?.ready.then(render); }
    },
    unmount() { cv?.remove(); cv = null; g = null; scene?.leave?.(); },
    frame(now) {
      if (!g || still()) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now; t += dt; acc += dt;
      scene.step?.(dt, t);
      if (acc < 1 / 30) return;
      acc = 0; render();
    },
    down: hand('down'), drag: hand('drag'), move: hand('move'), up: hand('up'), tap: hand('tap'), leave: hand('leave'),
  };
}

// klein label in Geist Mono kapitaaltjes, zoals elders in Orbit
export function label(g, text, x, y, { align = 'left', alpha = 0.5, size = 9 } = {}) {
  g.font = `500 ${size}px "Geist Mono", ui-monospace, monospace`; g.textAlign = align; g.textBaseline = 'alphabetic';
  try { g.letterSpacing = '1.3px'; } catch { /* oudere browser */ }
  g.fillStyle = `rgba(214,220,236,${alpha})`; g.fillText(text, x, y);
  try { g.letterSpacing = '0px'; } catch { /* oudere browser */ }
}
