/* ---- Bakje in de focusmodus: digitale fidgets in mono-tekens ---- */
// Een klein bakje rechtsonder, getekend in mono-tekens op een canvas, met drie soorten om mee te spelen (keuze bovenin,
// per toestel onthouden): water (deeltjesvloeistof), gelei (verend raster) en lava (metaballs). Alle drie delen dezelfde
// regels: sleep het bakje en het volgt je, kantelt mee en veert terug, en de inhoud voelt die schok; de kleur volgt hoe hard er iets beweegt, van grijze inkt
// naar het rode korrelverloop van de Bierfeesten. Loopt alleen zolang de focusmodus aan staat en het tabblad zichtbaar is.

const COLS = 44, ROWS = 18;      // het hele afgeronde vak, ook onder de keuzerij (Victor: geen kader in het kader)
const CW = 7.4, CH = 12.6;        // maat van één teken (px), Geist Mono 11 px
const W = COLS * CW, HH = ROWS * CH;
const CELLS = COLS * ROWS;
const TOP = 34, TOP_ROWS = 3;     // de keuzerij ligt bovenop: tekens beginnen eronder, lava hangt eronder
const STEP_MS = 1000 / 60;
const LEVELS = 14;                // kleurstappen in het verloop
const GRAVITY = 0.16;             // px per stap² (water)
const MODE_KEY = 'priority-orbit.fidget.v1';
const COLOR_KEY = 'priority-orbit.fidgetcolor.v1';
// Eigen kleur voor alle soorten (kleurkiezer in het bakje), of null: dan heeft elke soort zijn eigen standaardkleuren.
// Elke soort maakt er zijn eigen verloop uit (zie accentRamp).
let ACCENT = null;
const mixRgb = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
// vijf stappen van bijna zwart over de kleur naar bijna wit, zoals het dusk-verloop van Gloed
function accentRamp(hex) {
  const c = hexRgb(hex), dark = hexRgb('#120f17');
  return [dark, mixRgb(dark, c, 0.3), c, mixRgb(c, [1, 0.93, 0.8], 0.45), mixRgb(c, [1, 0.97, 0.88], 0.78)];
}
export const MODES = ['water', 'jelly', 'lava', 'grain', 'topo', 'wayglim', 'plasma', 'panel', 'life', 'breakout', 'snake'];

import { createPanel } from './panel.js';
import { createLife } from './life.js';
import { createPlasma } from './plasma.js';
import { createBreakout } from './breakout.js';
import { createSnake } from './snake.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---- Water: deeltjesvloeistof (dubbele dichtheidsrelaxatie, Clavet e.a. 2005) ---- */
// Het oppervlak blijft waterpas als het bakje kantelt; bewegen erover roert, een tik geeft een plons.
function water() {
  const N = 840, H = 13;
  const REST = 2.2, K = 0.06, K_NEAR = 0.15;   // rustdichtheid en stijfheid (dimensieloos, schaalt met H)
  const SIGMA = 0.035, BETA = 0.01;            // viscositeit: laag, zodat het water vloeit en nadeint zonder te spatten
  const x = new Float32Array(N), y = new Float32Array(N), px = new Float32Array(N), py = new Float32Array(N);
  const vx = new Float32Array(N), vy = new Float32Array(N);
  const rho = new Float32Array(N), rhoN = new Float32Array(N);
  let stir = null;

  // ruimtelijk raster voor buren
  const gridCols = Math.ceil(W / H) + 2, gridRows = Math.ceil(HH / H) + 2;
  const heads = new Int32Array(gridCols * gridRows), nextIdx = new Int32Array(N);
  function buildGrid() {
    heads.fill(-1);
    for (let i = 0; i < N; i++) {
      const c = clamp(Math.floor(x[i] / H) + 1, 0, gridCols - 1), r = clamp(Math.floor(y[i] / H) + 1, 0, gridRows - 1);
      const k = r * gridCols + c;
      nextIdx[i] = heads[k]; heads[k] = i;
    }
  }
  function forNeighbors(i, fn) {
    const c0 = Math.floor(x[i] / H) + 1, r0 = Math.floor(y[i] / H) + 1;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      if (r < 0 || r >= gridRows) continue;
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        if (c < 0 || c >= gridCols) continue;
        for (let j = heads[r * gridCols + c]; j !== -1; j = nextIdx[j]) if (j > i) fn(j);
      }
    }
  }

  function step({ gx, gy }) {
    for (let i = 0; i < N; i++) { vx[i] += gx * GRAVITY; vy[i] += gy * GRAVITY; }
    if (stir) {
      for (let i = 0; i < N; i++) {
        const dx = x[i] - stir.x, dy = y[i] - stir.y, d2 = dx * dx + dy * dy;
        if (d2 < 400) { const f = (1 - Math.sqrt(d2) / 20) * 0.35; vx[i] += stir.vx * f; vy[i] += stir.vy * f; }
      }
      stir.vx *= 0.5; stir.vy *= 0.5;
    }
    buildGrid();
    for (let i = 0; i < N; i++) {
      forNeighbors(i, j => {
        const dx = x[j] - x[i], dy = y[j] - y[i], r = Math.hypot(dx, dy);
        if (r >= H || r < 1e-6) return;
        const q = r / H, ux = dx / r, uy = dy / r;
        const u = (vx[i] - vx[j]) * ux + (vy[i] - vy[j]) * uy;
        if (u <= 0) return;
        const I = (1 - q) * (SIGMA * u + BETA * u * u) * 0.5;
        vx[i] -= I * ux; vy[i] -= I * uy; vx[j] += I * ux; vy[j] += I * uy;
      });
    }
    for (let i = 0; i < N; i++) { px[i] = x[i]; py[i] = y[i]; x[i] += vx[i]; y[i] += vy[i]; }
    buildGrid();
    rho.fill(0); rhoN.fill(0);
    for (let i = 0; i < N; i++) {
      forNeighbors(i, j => {
        const r = Math.hypot(x[j] - x[i], y[j] - y[i]);
        if (r >= H) return;
        const q = 1 - r / H, q2 = q * q, q3 = q2 * q;
        rho[i] += q2; rho[j] += q2; rhoN[i] += q3; rhoN[j] += q3;
      });
    }
    for (let i = 0; i < N; i++) {
      const P = K * (rho[i] - REST), Pn = K_NEAR * rhoN[i];
      let dxi = 0, dyi = 0;
      forNeighbors(i, j => {
        const dx = x[j] - x[i], dy = y[j] - y[i], r = Math.hypot(dx, dy);
        if (r >= H || r < 1e-6) return;
        const q = 1 - r / H;
        const Pj = K * (rho[j] - REST), Pnj = K_NEAR * rhoN[j];
        const D = H * ((P + Pj) * 0.5 * q + (Pn + Pnj) * 0.5 * q * q) * 0.5;
        const ux = dx / r * D, uy = dy / r * D;
        x[j] += ux; y[j] += uy; dxi -= ux; dyi -= uy;
      });
      x[i] += dxi; y[i] += dyi;
    }
    for (let i = 0; i < N; i++) {
      if (x[i] < 2) x[i] = 2 + Math.random() * 0.01;
      else if (x[i] > W - 2) x[i] = W - 2 - Math.random() * 0.01;
      if (y[i] > HH - 2) { y[i] = HH - 2 - Math.random() * 0.01; x[i] += (px[i] - x[i]) * 0.06; }   // een beetje wrijving op de bodem
      else if (y[i] < 1) y[i] = 1;
      vx[i] = (x[i] - px[i]) * 0.998; vy[i] = (y[i] - py[i]) * 0.998;
    }
  }

  // per teken: aantal deeltjes en hun gemiddelde snelheid (dichtstbijzijnde cel, geen uitsmeren: anders hangt er een
  // nevel boven het oppervlak)
  const d = new Float32Array(CELLS), sp = new Float32Array(CELLS);
  function draw(chr, want) {
    d.fill(0); sp.fill(0);
    for (let i = 0; i < N; i++) {
      const c = clamp(Math.floor(x[i] / CW), 0, COLS - 1), r = clamp(Math.floor(y[i] / CH), 0, ROWS - 1);
      d[r * COLS + c]++; sp[r * COLS + c] += Math.hypot(vx[i], vy[i]);
    }
    const full = N / CELLS * 1.9;
    for (let k = 0; k < CELLS; k++) {
      const v = d[k] / full, above = k >= COLS ? d[k - COLS] / full : 0, speed = d[k] ? sp[k] / d[k] : 0;
      chr[k] = v > 0.45 && above < 0.3 ? '~' : v > 0.45 ? (speed > 0.8 ? '≈' : '=') : v > 0.2 ? '-' : v > 0 ? (above > 0.45 ? '-' : '·') : '';
      want[k] = clamp((speed - 0.55) / 3, 0, 1);
    }
  }

  return {
    init() {
      const s = H * 0.5, cols = Math.floor((W - 4) / s);
      for (let i = 0; i < N; i++) {
        const c = i % cols, r = Math.floor(i / cols);
        x[i] = 2 + (c + 0.5 + (r % 2) * 0.5) * s; y[i] = HH - 2 - (r + 0.5) * s * 0.87; vx[i] = vy[i] = 0;
      }
      for (let k = 0; k < 240; k++) step({ gx: 0, gy: 1 });   // vooraf laten zakken
    },
    step, draw,
    move(p) { stir = stir ? { x: p.x, y: p.y, vx: (p.x - stir.x) * 0.6 + stir.vx, vy: (p.y - stir.y) * 0.6 + stir.vy } : { ...p, vx: 0, vy: 0 }; },
    leave() { stir = null; },
    tap(p) {
      for (let i = 0; i < N; i++) {
        const dx = x[i] - p.x, dy = y[i] - p.y, dd = Math.hypot(dx, dy);
        if (dd < 30) { const f = (1 - dd / 30) * 3.2; vx[i] += dx / (dd || 1) * f; vy[i] += dy / (dd || 1) * f - 1.5 * (1 - dd / 30); }
      }
    },
  };
}

/* ---- Gelei: een verend raster van puntjes ---- */
// Elk teken is een knoop met een veer naar zijn rustplek en veren naar zijn buren, dus een duw loopt als een golf door
// het raster en trilt na. De aanwijzer duwt de knopen opzij, een tik geeft een stoot, en een schok van het bakje laat
// het hele raster meedeinen.
function jelly() {
  const dx = new Float32Array(CELLS), dy = new Float32Array(CELLS), vx = new Float32Array(CELLS), vy = new Float32Array(CELLS);
  const KH = 0.035, KN = 0.22, DAMP = 0.965;   // veer naar de rustplek, naar de buren, demping
  let push = null;
  function step({ ax, ay }) {
    if (push) {
      for (let k = 0; k < CELLS; k++) {
        const cx = (k % COLS + 0.5) * CW + dx[k], cy = (Math.floor(k / COLS) + 0.5) * CH + dy[k];
        const ex = cx - push.x, ey = cy - push.y, d = Math.hypot(ex, ey);
        if (d < 34 && d > 0.01) { const f = (1 - d / 34) ** 2 * 1.6; vx[k] += ex / d * f + push.vx * f * 0.25; vy[k] += ey / d * f + push.vy * f * 0.25; }
      }
      push.vx *= 0.4; push.vy *= 0.4;
    }
    for (let k = 0; k < CELLS; k++) {
      const c = k % COLS, r = (k - c) / COLS;
      let fx = -KH * dx[k], fy = -KH * dy[k];
      const nb = j => { fx += KN * (dx[j] - dx[k]) * 0.25; fy += KN * (dy[j] - dy[k]) * 0.25; };
      if (c > 0) nb(k - 1);
      if (c < COLS - 1) nb(k + 1);
      if (r > 0) nb(k - COLS);
      if (r < ROWS - 1) nb(k + COLS);
      vx[k] = (vx[k] + fx - ax * 0.8) * DAMP; vy[k] = (vy[k] + fy - ay * 0.8) * DAMP;
    }
    for (let k = 0; k < CELLS; k++) { dx[k] = clamp(dx[k] + vx[k], -14, 14); dy[k] = clamp(dy[k] + vy[k], -14, 14); }
  }
  function draw(chr, want, pos) {
    for (let k = 0; k < CELLS; k++) {
      const m = Math.hypot(dx[k], dy[k]), v = Math.hypot(vx[k], vy[k]);
      chr[k] = m > 7 ? '#' : m > 4 ? '*' : m > 2 ? '+' : m > 0.8 ? ':' : '·';
      want[k] = clamp(m / 9 + v / 3, 0, 1);
      pos[2 * k] = dx[k]; pos[2 * k + 1] = dy[k];
    }
  }
  return {
    init() { dx.fill(0); dy.fill(0); vx.fill(0); vy.fill(0); },
    step, draw,
    move(p) { push = push ? { x: p.x, y: p.y, vx: p.x - push.x, vy: p.y - push.y } : { ...p, vx: 0, vy: 0 }; },
    leave() { push = null; },
    tap(p) {
      for (let k = 0; k < CELLS; k++) {
        const ex = (k % COLS + 0.5) * CW - p.x, ey = (Math.floor(k / COLS) + 0.5) * CH - p.y, d = Math.hypot(ex, ey);
        if (d < 60 && d > 0.01) { const f = (1 - d / 60) * 6; vx[k] += ex / d * f; vy[k] += ey / d * f; }
      }
    },
  };
}

/* ---- WebGL: hulpjes voor de soorten die geen tekens zijn (lava, gloed) ---- */
const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
function program(gl, frag) {
  const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  const locs = {};
  return { prog, gl, loc: n => (n in locs ? locs[n] : (locs[n] = gl.getUniformLocation(prog, n))) };
}
// één driehoek over het hele canvas
function fullscreen(gl, prog) {
  if (!gl._tri) { gl._tri = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, gl._tri); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl._tri);
  const at = gl.getAttribLocation(prog.prog, 'p');
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
const hexRgb = v => {
  const h = v.trim().replace('#', '');
  return h.length === 6 ? [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) : [1, 1, 1];
};

/* ---- Lava: metaballs als lavalamp ---- */
// Look van MetaBalls van React Bits met Victors instellingen (solid, 15 bollen, gooeyness 0,5, stretch 0,5, wobble 0,5,
// cursor-bol 3 keer zo groot met hoverSmoothness 0,1, stickiness 0,5, klikstoot, intro, transparant). Beweging zoals een
// echte lavalamp (Victor: "laten werken, vloeien"): onderaan ligt een plas die warm wordt, opgewarmde was wordt lichter
// en stijgt traag op, koelt bovenaan af en zakt terug. Bollen die elkaar raken, kleven even samen (veld Σ r²/d²) en
// scheuren weer los. Kantelen of slepen doet alles meeklotsen; de aanwijzer is een warmtebron, een tik blaast uiteen.
function lava() {
  const COUNT = 13, WOBBLE = 0.5, STRETCH = 0.5, STICKY = 0.5, SMOOTH = 0.1, GOO = 0.5, CURSOR = 3;
  const balls = [];
  const cur = { x: W / 2, y: HH / 2, tx: W / 2, ty: HH / 2, vx: 0, vy: 0, r: 0, on: false };
  let t = 0, intro = 1, prog = null, color = [1, 1, 1], colorAt = -1e9;
  for (let i = 0; i < COUNT; i++) {
    const T = Math.random();
    balls.push({
      x: 30 + Math.random() * (W - 60), y: HH * (0.25 + Math.random() * 0.7), vx: 0, vy: 0, dx: 0, dy: 0,
      s: 8 + Math.random() * 6.5,                 // straal (px); iets voller op vraag van Victor ("meer lava")
      T,                                          // temperatuur 0 (koud, zinkt) tot 1 (warm, stijgt)
      ph: Math.random() * 10,
      heat: 0.7 + Math.random() * 0.6,            // elke klont warmt in zijn eigen tempo op
    });
  }
  // de plas op de bodem: één doorlopende laag vloeibare was met een traag deinend oppervlak (Victor: "alsof er echt een
  // laag liquid lava ligt, geen aparte blobs"); eerst vijf overlappende bollen, die bleven als bultjes zichtbaar
  const POOL_DEPTH = 12;
  const data = new Float32Array(16 * 4);
  const FRAG = `#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 uRes; uniform vec4 uBalls[16]; uniform vec3 uColor; uniform float uGoo; uniform float uTime; uniform float uPool;
const vec3 DEEP = vec3(0.62, 0.12, 0.04);              // diep oranjerood: licht dat door dikke was valt
const vec3 HOT = vec3(1.0, 0.62, 0.22);                // warm oranje aan de belichte rand
const vec2 LAMP = vec2(${(W / 2).toFixed(1)}, ${(HH + 26).toFixed(1)});   // de gloeilamp, net onder de bodem
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * vec2(${W.toFixed(1)}, ${HH.toFixed(1)});
  float f = 0.0;
  vec2 grad = vec2(0.0);
  for (int i = 0; i < 16; i++) {
    vec4 b = uBalls[i];
    if (b.z <= 0.0) continue;
    vec2 d = p - b.xy;
    float q = dot(d, d) + 0.0001;
    f += b.z * b.z / q;
    grad -= 2.0 * b.z * b.z * d / (q * q);
  }
  // de laag op de bodem: zelfde soort veld (L²/(L+h)², h = hoogte boven het oppervlak), dus klonten vloeien er glad in op
  if (uPool > 0.0) {
    float k1 = 0.045, k2 = 0.11;
    float surf = ${HH.toFixed(1)} - uPool + 1.6 * sin(p.x * k1 + uTime * 0.5) + 0.8 * sin(p.x * k2 - uTime * 0.37);
    float dsurf = 1.6 * k1 * cos(p.x * k1 + uTime * 0.5) + 0.8 * k2 * cos(p.x * k2 - uTime * 0.37);
    const float L = 9.0;
    float h = max(surf - p.y, -0.9 * L);
    float lf = L * L / ((L + h) * (L + h));
    float dl = -2.0 * L * L / ((L + h) * (L + h) * (L + h));
    f += lf;
    grad += vec2(dl * dsurf, -dl);
  }
  float fc = min(f, 4.0);                            // midden van een bol: het veld schiet weg, de rand niet
  float w = clamp(fwidth(fc), 0.0001, 0.6) * (1.0 + uGoo);
  float a = smoothstep(1.0 - w, 1.0 + w, fc);
  // licht van de lamp: valt snel af met de afstand en flakkert heel licht
  vec2 toL = LAMP - p;
  float dist = length(toL);
  float flick = 0.94 + 0.035 * sin(uTime * 6.1) + 0.025 * sin(uTime * 1.7 + 1.3);
  float heat = exp(-dist * dist / ${(HH * HH * 0.55).toFixed(1)}) * flick;
  // vorm van de was: buitennormaal uit het veld; de kant naar de lamp licht op (rand), dik midden laat minder door
  vec2 n = -grad / max(length(grad), 1e-4);
  float facing = max(dot(n, toL / dist), 0.0);
  // afstand tot de rand (px) via 1/√f: voor één bol precies r − |d|, glad over samengesmolten klonten, ook in de middelpunten
  float sf = inversesqrt(max(f, 1e-6));
  float inside = (1.0 - sf) / max(0.5 * sf * sf * sf * length(grad), 0.045);
  float edge = 1.0 - smoothstep(0.0, 5.0, inside);   // dicht bij de rand van een klont
  float slope = 0.5 * sf * sf * sf * length(grad);   // ongeveer 1/r (ondergrens 0,045 hierboven: in een hals schoot de afstand uit); bijna 0 in de hals tussen twee klonten, waar de richting wegvalt
  float rim = facing * edge * smoothstep(0.008, 0.03, slope);
  float thin = 1.0 - smoothstep(0.0, 12.0, inside);  // dunne was laat meer licht door
  vec3 wax = mix(uColor, DEEP, heat * (0.35 + 0.45 * thin));
  wax = mix(wax, HOT, clamp(heat * rim * 1.4, 0.0, 0.9));
  // de vloeistof eromheen krijgt alleen een zweem, vlak boven de lamp
  float haze = exp(-dot(toL / vec2(${(W * 0.32).toFixed(1)}, ${(HH * 0.38).toFixed(1)}), toL / vec2(${(W * 0.32).toFixed(1)}, ${(HH * 0.38).toFixed(1)}))) * 0.22 * flick;
  vec3 rgb = wax * a + DEEP * haze * (1.0 - a);
  gl_FragColor = vec4(rgb, a + haze * (1.0 - a));
}`;
  function step({ gx, gy, ax, ay }) {
    t += 1 / 60;
    intro = Math.min(1, intro + 1 / 60 / 1.3);
    const px = cur.x, py = cur.y;
    cur.x += (cur.tx - cur.x) * SMOOTH; cur.y += (cur.ty - cur.y) * SMOOTH;
    cur.vx = cur.x - px; cur.vy = cur.y - py;
    cur.r += ((cur.on ? 5.5 * CURSOR * 0.75 : 0) - cur.r) * 0.08;
    // zwaartekracht in het bakje (kantelt mee); opwaartse kracht werkt er recht tegenin
    const gl = Math.hypot(gx, gy) || 1, ux = gx / gl, uy = gy / gl;
    for (const b of balls) {
      // warmte: de plas onderaan warmt op, bovenaan koelt de was af, in het midden houdt hij zijn warmte lang vast
      const depth = b.y / HH;
      if (depth > 0.78) b.T = Math.min(1, b.T + 0.0035 * b.heat);
      else if (depth < 0.3) b.T = Math.max(0, b.T - 0.0011 * b.heat);   // traag afkoelen: de was blijft bovenaan hangen en vloeit daar samen
      else b.T += (0.5 - b.T) * 0.0006;
      if (cur.r > 1) {
        const d = Math.hypot(cur.x - b.x, cur.y - b.y);
        if (d < 70) b.T = Math.min(1, b.T + 0.004 * (1 - d / 70));   // de aanwijzer is een warmtebron
      }
      const lift = (b.T - 0.5) * 0.034;
      let fx = -ux * lift, fy = -uy * lift;
      // traag dwalen opzij, zoals stroming in de vloeistof
      fx += Math.sin(t * 0.35 + b.ph) * 0.0045;
      // klotsen: de vloeistof blijft achter bij een schok van het bakje
      fx -= ax * 0.5; fy -= ay * 0.5;
      // de cursor-bol duwt elke klont die hij raakt opzij en sleept hem mee in zijn beweging (Victor)
      if (cur.r > 1) {
        const ex = b.x - cur.x, ey = b.y - cur.y, d = Math.hypot(ex, ey) || 0.01, reach = cur.r + b.s + 8;
        if (d < reach) {
          const f = (1 - d / reach);
          fx += ex / d * f * 0.35 + cur.vx * f * STICKY * 0.5;
          fy += ey / d * f * 0.35 + cur.vy * f * STICKY * 0.5;
        }
      }
      b.vx = (b.vx + fx) * 0.965; b.vy = (b.vy + fy) * 0.965;
    }
    // samenkleven en loslaten: bollen die bijna raken trekken zacht naar elkaar, overlappen te veel duwt uiteen
    for (let i = 0; i < COUNT; i++) for (let j = i + 1; j < COUNT; j++) {
      const p = balls[i], q = balls[j], ex = q.x - p.x, ey = q.y - p.y, d = Math.hypot(ex, ey) || 0.01, rr = p.s + q.s;
      if (d > rr * 1.8) continue;
      const f = d < rr * 0.85 ? -(rr * 0.85 - d) * 0.012 : 0.0009 * (1 - d / (rr * 1.8));
      const nx = ex / d * f, ny = ey / d * f;
      p.vx += nx; p.vy += ny; q.vx -= nx; q.vy -= ny;
      // warmte deelt zich een beetje: wie samenkleeft, stijgt of zakt samen
      const dT = (q.T - p.T) * 0.004; p.T += dT; q.T -= dT;
    }
    for (const b of balls) {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > 2.5) { b.vx *= 2.5 / sp; b.vy *= 2.5 / sp; }   // stijgen en zakken blijft traag door de demping; de cursor mag sneller duwen
      const nx = b.x + b.vx, ny = b.y + b.vy;
      b.dx = nx - b.x; b.dy = ny - b.y; b.x = nx; b.y = ny;
      // wanden: zacht terugduwen; onderaan mag een klont in de plas zakken
      const r = b.s;
      if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx) * 0.3; }
      if (b.x > W - r) { b.x = W - r; b.vx = -Math.abs(b.vx) * 0.3; }
      if (b.y < TOP + r * 0.45) { b.y = TOP + r * 0.45; b.vy = Math.abs(b.vy) * 0.1; b.T = Math.max(0, b.T - 0.0025); }   // tegen het plafond plat
      if (b.y > HH + r * 0.2) { b.y = HH + r * 0.2; b.vy = -Math.abs(b.vy) * 0.2; }
    }
  }
  function render(gl, now) {
    if (!prog || prog.gl !== gl) prog = program(gl, FRAG);
    if (!prog) return;
    if (now - colorAt > 1000) { color = ACCENT ? hexRgb(ACCENT) : hexRgb(getComputedStyle(document.documentElement).getPropertyValue('--ink')); colorAt = now; }
    const grow = Math.min(1, intro);
    balls.forEach((b, i) => {
      // uitrekken in de bewegingsrichting (een stijgende klont wordt een druppel) en zacht ademen
      const sp = Math.hypot(b.dx, b.dy), k = STRETCH * Math.min(1.5, sp * 0.9);
      const wob = 1 + WOBBLE * 0.08 * Math.sin(t * 1.1 + b.ph);
      data[i * 4] = b.x + b.dx * k * 3; data[i * 4 + 1] = b.y + b.dy * k * 3; data[i * 4 + 2] = b.s * wob * grow; data[i * 4 + 3] = 0;
    });
    data[15 * 4] = cur.x; data[15 * 4 + 1] = cur.y; data[15 * 4 + 2] = cur.r;
    gl.useProgram(prog.prog);
    gl.uniform2f(prog.loc('uRes'), gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform4fv(prog.loc('uBalls'), data);
    gl.uniform3fv(prog.loc('uColor'), color);
    gl.uniform1f(prog.loc('uGoo'), GOO);
    gl.uniform1f(prog.loc('uTime'), t);
    gl.uniform1f(prog.loc('uPool'), POOL_DEPTH * grow);
    fullscreen(gl, prog);
  }
  return {
    gl: true,
    init() { intro = 1; for (let i = 0; i < 400; i++) step({ gx: 0, gy: 1, ax: 0, ay: 0 }); intro = 1; },   // vooraf laten lopen: de lamp brandt al
    step, render,
    recolor() { colorAt = -1e9; },
    move(p) { cur.on = true; cur.tx = p.x; cur.ty = p.y; },
    leave() { cur.on = false; },
    tap(p) {
      // klikstoot: alles in de buurt vliegt weg van de tik en warmt op
      for (const b of balls) {
        const ex = b.x - p.x, ey = b.y - p.y, d = Math.hypot(ex, ey) || 1, f = Math.max(0, 1 - d / 160) * 3;
        b.vx += ex / d * f; b.vy += ey / d * f; b.T = Math.min(1, b.T + 0.3 * f / 3);
      }
    },
  };
}

/* ---- Gloed: grainient ---- */
// Naar Grainient van React Bits, preset dusk zoals Victor hem doorgaf: kleuren #120F17, #3F0D1A, #BE123C, #FB923C,
// #FDE68A, hoek 150°, silk 0,4. Een verloop dat traag golft als zijde, met filmkorrel. Om mee te spelen: de aanwijzer
// draait een zachte wervel in het verloop, een tik stuurt een kring door de zijde, slepen laat het verloop meeschuiven.
// Uit zichzelf (Victor, 03/11/2026: "meer bewegen op zichzelf, zonder inmenging van de gebruiker, maar hou de animatie
// rustig"): de zijde schuift iets sneller en dieper, de hoek ademt traag (±14° over ongeveer 70 s), het verloop deint
// heen en weer, en een eigen zachte wervel zwerft in een trage lus door het vak (wijkt zolang de aanwijzer er is).
function grain() {
  const COLORS = ['#120f17', '#3f0d1a', '#be123c', '#fb923c', '#fde68a'].map(hexRgb).flat();
  const ANGLE = 150, SILK = 0.4;
  let prog = null, t = 0;
  const ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, k: 0, on: false };
  const rip = { x: 0.5, y: 0.5, t: -10 };
  const off = { x: 0, y: 0 };
  const wand = { x: 0.5, y: 0.5 };
  const FRAG = `precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec3 uCol[5]; uniform float uAngle; uniform float uSilk;
uniform vec3 uPtr; uniform vec3 uRip; uniform vec2 uOff; uniform vec3 uWand;
// hash zonder sinus (Dave Hoskins): geen strepen of patronen, ook niet op gsm-GPU's
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// simplexruis (Ashima, MIT): glad en zonder raster; blokjesruis gaf rechte naden in het verloop
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy)), x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0, h = abs(x) - 0.5, ox = floor(x + 0.5), a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
// twee octaven, de tweede gedraaid, zodat er geen richting overheerst; uitkomst 0..1
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 2; i++) { v += a * snoise(p); p = r * p * 1.9; a *= 0.45; }
  return v * 0.6 + 0.5;
}
vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0) * 4.0;
  vec3 c = mix(uCol[0], uCol[1], smoothstep(0.0, 1.0, t));
  c = mix(c, uCol[2], smoothstep(1.0, 2.0, t));
  c = mix(c, uCol[3], smoothstep(2.0, 3.0, t));
  return mix(c, uCol[4], smoothstep(3.0, 4.0, t));
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0) + uOff;
  // zijde: twee lagen ruis die traag over elkaar schuiven en het verloop vervormen
  float n1 = fbm(p * 0.9 + vec2(uTime * 0.08, -uTime * 0.055));
  float n2 = fbm(p * 1.2 + vec2(-uTime * 0.05, uTime * 0.08) + n1 * 0.8);
  float silk = uSilk * (0.95 + 0.3 * sin(uTime * 0.09));   // de zijde golft afwisselend dieper en vlakker
  vec2 q = p + silk * 0.75 * (vec2(n1, n2) - 0.5);
  // eigen wervel die traag rondzwerft
  vec2 wp = (uWand.xy - 0.5) * vec2(asp, 1.0), wd = q - wp;
  float wa = exp(-dot(wd, wd) * 5.0) * uWand.z * 1.1;
  q = wp + mat2(cos(wa), -sin(wa), sin(wa), cos(wa)) * wd;
  // wervel rond de aanwijzer
  vec2 pp = (uPtr.xy - 0.5) * vec2(asp, 1.0);
  vec2 d = q - pp;
  float fall = exp(-dot(d, d) * 9.0) * uPtr.z;
  float ang = fall * 1.6;
  q = pp + mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * d;
  // kring van een tik
  vec2 rc = (uRip.xy - 0.5) * vec2(asp, 1.0);
  float age = uTime - uRip.z, dist = length(p - rc);
  float ring = exp(-pow((dist - age * 0.55) * 9.0, 2.0)) * exp(-age * 1.6);
  q += normalize(p - rc + 0.0001) * ring * 0.09;
  float a = radians(uAngle);
  vec2 dir = vec2(sin(a), cos(a));                 // zoals CSS: 150° wijst naar rechtsonder (y loopt hier omhoog)
  float t = dot(q, dir) / (0.5 * (abs(dir.x) * asp + abs(dir.y))) * 0.5 + 0.5;
  t += 0.07 * sin(uTime * 0.06);                   // het verloop deint traag heen en weer
  vec3 col = ramp(t);
  // filmkorrel
  float g = hash(gl_FragCoord.xy + fract(uTime * 7.3) * vec2(171.0, 97.0)) - 0.5;
  col += g * 0.075;
  gl_FragColor = vec4(col, 1.0);
}`;
  function step({ ax, ay }) {
    t += 1 / 60;
    ptr.x += (ptr.tx - ptr.x) * 0.08; ptr.y += (ptr.ty - ptr.y) * 0.08;
    ptr.k += ((ptr.on ? 1 : 0) - ptr.k) * 0.05;
    // slepen: het verloop schuift mee met de schok en veert terug
    off.x = (off.x - ax * 0.02) * 0.97; off.y = (off.y + ay * 0.02) * 0.97;
    // eigen wervel: een trage lus (Lissajous) door het vak
    wand.x = 0.5 + 0.34 * Math.sin(t * 0.11); wand.y = 0.5 + 0.3 * Math.sin(t * 0.077 + 1.3);
  }
  function render(gl) {
    if (!prog) prog = program(gl, FRAG);
    if (!prog) return;
    gl.useProgram(prog.prog);
    gl.uniform2f(prog.loc('uRes'), gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(prog.loc('uTime'), t);
    gl.uniform3fv(prog.loc('uCol'), ACCENT ? accentRamp(ACCENT).flat() : COLORS);
    gl.uniform1f(prog.loc('uAngle'), ANGLE + 14 * Math.sin(t * 0.09));
    gl.uniform3f(prog.loc('uWand'), wand.x, wand.y, 0.75 * (1 - ptr.k));
    gl.uniform1f(prog.loc('uSilk'), SILK);
    gl.uniform3f(prog.loc('uPtr'), ptr.x, ptr.y, ptr.k);
    gl.uniform3f(prog.loc('uRip'), rip.x, rip.y, rip.t);
    gl.uniform2f(prog.loc('uOff'), off.x, off.y);
    fullscreen(gl, prog);
  }
  return {
    gl: true,
    init() {},
    step, render,
    move(p) { ptr.on = true; ptr.tx = p.x / W; ptr.ty = 1 - p.y / HH; },
    leave() { ptr.on = false; },
    tap(p) { rip.x = p.x / W; rip.y = 1 - p.y / HH; rip.t = t; },
  };
}

/* ---- Topo: topography ---- */
// Topography van React Bits, letterlijk overgenomen (src/vendor/topography.js, met eigen WebGL2-canvas en eigen lus),
// met Victors instellingen. Pas geladen als je hem kiest; weg zodra je een andere soort kiest of de focus sluit.
// Muis en tik vangt de component zelf op (lift en pulse), dus move, leave en tap doen hier niets.
const TOPO = {
  color: '#cc3022', lineCount: 32, lineWidth: 1, elevation: 0.75, foreground: 0.2, tilt: 32, speed: 0.25,
  direction: 'backward', glow: 0.4, depthOfField: 0, fog: 0, hoverEffect: 'lift', clickEffect: 'pulse', majorLines: true,
  scale: 0.8, detail: 0.17, morph: 0, brightness: 1.1, markers: 'none', glitch: 0, opacity: 1, mouseInteraction: true,
  mouseRadius: 0.3, mouseStrength: 0.35, trail: 0.45, parallax: 0.5, intro: false, lightMode: false,
};
function topo() {
  let destroy = null, loading = false, wanted = false;
  return {
    own: true,
    init() {}, step() {}, move() {}, leave() {}, tap() {},
    mount(el) {
      wanted = true;
      if (destroy || loading) return;
      loading = true;
      import('../vendor/topography.js').then(({ createTopography }) => {
        loading = false;
        if (wanted && !destroy) destroy = createTopography(el, ACCENT ? { ...TOPO, color: ACCENT } : TOPO);
      }).catch(() => { loading = false; });
    },
    unmount() { wanted = false; destroy?.(); destroy = null; },
    // de component leest zijn kleur één keer: opnieuw opbouwen
    recolor(el) { if (destroy) { this.unmount(); this.mount(el); } },
  };
}
/* ---- Wayglim: geanimeerde golf met korrel en licht ---- */
// Export van Wayglim (src/vendor/wayglim.js), WebGL2. Pas geladen als je hem kiest;
// opgeruimd zodra je een andere soort kiest of de focus sluit.
function wayglim() {
  let destroy = null, loading = false, wanted = false, container = null;
  return {
    own: true,
    init() {}, step() {}, move() {}, leave() {}, tap() {},
    mount(el) {
      wanted = true;
      container = el;
      el.style.backgroundColor = 'rgb(11, 5, 7)';
      if (destroy || loading) return;
      loading = true;
      import('../vendor/wayglim.js').then(({ createWayglim }) => {
        loading = false;
        if (wanted && !destroy) {
          let opts = undefined;
          if (ACCENT) {
            const ramp = accentRamp(ACCENT);
            opts = {
              params: {
                spectrum: 'custom',
                customColors: [ramp[1], ramp[2], ramp[3], ramp[4]],
              }
            };
          }
          const player = createWayglim(el, opts);
          destroy = () => { player?.destroy?.(); };
        }
      }).catch(() => { loading = false; });
    },
    unmount() {
      wanted = false;
      destroy?.();
      destroy = null;
      if (container) {
        container.style.backgroundColor = '';
        container = null;
      }
    },
    recolor(el) {
      if (destroy) {
        this.unmount();
        this.mount(el);
      }
    },
  };
}
let gl2;
const hasGL2 = () => {
  if (gl2 === undefined) {
    const c = document.createElement('canvas').getContext('webgl2');
    gl2 = Boolean(c);
    c?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return gl2;
};

const FACTORIES = { water, jelly, lava, grain, topo, wayglim };

// scores: opslag per spel (src/data/scores.js, createScoreStore), zodat highscores mee synchroniseren
export function createFidget(box, { reducedMotion, label = m => m, getData, scores }) {
  const cv = box.querySelector('canvas');
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(W * dpr); cv.height = Math.round(HH * dpr);
  cv.style.width = `${W}px`; cv.style.height = `${HH}px`;
  const g = cv.getContext('2d');
  // tweede canvas voor de soorten die geen tekens zijn (lava, gloed): WebGL, pas aangemaakt als je er een kiest
  const cvGL = document.createElement('canvas');
  cvGL.className = 'fidget-gl'; cvGL.setAttribute('aria-hidden', 'true'); cvGL.hidden = true;
  cvGL.width = cv.width; cvGL.height = cv.height; cvGL.style.width = cv.style.width; cvGL.style.height = cv.style.height;
  cv.after(cvGL);
  // derde vlak voor een soort met een eigen canvas (topo)
  const own = document.createElement('div');
  own.className = 'fidget-own'; own.hidden = true;
  own.style.width = cv.style.width; own.style.height = cv.style.height;
  cvGL.after(own);
  let gl;
  const getGL = () => {
    if (gl === undefined) {
      gl = cvGL.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true }) || null;
      gl?.getExtension('OES_standard_derivatives');
    }
    return gl;
  };
  const chr = new Array(CELLS).fill(''), want = new Float32Array(CELLS), agit = new Float32Array(CELLS), pos = new Float32Array(CELLS * 2);
  let palette = null, paletteAt = 0;
  let raf = 0, running = false, acc = 0, last = 0;
  let press = null;   // het bakje staat vast (Victor), en sinds 03/11/2026 ook geen duwtje meer op de inhoud

  let modeName = 'lava';   // standaard (Victor); zonder WebGL valt renderBar terug op water
  try { const m = localStorage.getItem(MODE_KEY); if (MODES.includes(m)) modeName = m; } catch { /* geen opslag */ }
  const modes = {};
  const mode = () => {
    if (!modes[modeName]) {
      // paneel: dertien schermen, krijgt de toestand van Orbit en de kleur van de kleurkiezer (fosfor)
      if (modeName === 'panel') {
        modes[modeName] = createPanel({ reducedMotion, accent: () => ACCENT, getData, onScreen: showScreen });
      } else if (modeName === 'life') {
        modes[modeName] = createLife({ reducedMotion, accent: () => ACCENT, onPreset: showScreen });
      } else if (modeName === 'plasma') {
        // plasmaplaat (Victor, 08/11/2026): enkel de plaat over het hele vak, kleur uit de kleurkiezer
        modes[modeName] = createPlasma({ reducedMotion, ramp: () => (ACCENT ? accentRamp(ACCENT) : null) });
      } else if (modeName === 'breakout') {
        // breakout B4 Fosfor (Victor, 08/11/2026): levels, levens, powerups, highscores; fosfor uit de kleurkiezer
        modes[modeName] = createBreakout({ reducedMotion, accent: () => ACCENT, scores: scores?.game('breakout') });
      } else if (modeName === 'snake') {
        // slang in stippen (Victor, 08/11/2026, F1): raster van de matrixklok, kleur uit de kleurkiezer
        modes[modeName] = createSnake({ reducedMotion, accent: () => ACCENT, scores: scores?.game('snake') });
      } else {
        modes[modeName] = FACTORIES[modeName]();
      }
      modes[modeName].init();
    }
    return modes[modeName];
  };

  // pijltje onder het bakje: volgend scherm van het paneel (Victor, 03/11/2026: "een heeel subtiel pijltje onder het window, gecentreerd")
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button'; nextBtn.className = 'fidget-next'; nextBtn.hidden = true;
  nextBtn.innerHTML = '<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M3.5 2.5 7 6 3.5 9.5"/></svg>';
  box.after(nextBtn);
  function showScreen(i, n, name) {
    const text = name ? `${name} (${i + 1} / ${n})` : `${label('next')} (${i + 1} / ${n})`;
    nextBtn.setAttribute('aria-label', text); nextBtn.title = text;
  }
  const hasPresets = m => ['panel', 'life'].includes(m);
  nextBtn.addEventListener('click', () => { if (hasPresets(modeName)) mode().next(1); });
  nextBtn.addEventListener('keydown', e => {
    if (!hasPresets(modeName) || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault(); e.stopPropagation();
    mode().next(e.key === 'ArrowLeft' ? -1 : 1);
  });

  // keuze bovenin het bakje: elegant en compact dropdown-menu (Victor, 05/11/2026)
  const bar = box.querySelector('.fidget-modes');
  // zonder WebGL geen lava of gloed (dan ook niet als keuze); zonder WebGL2 geen topo of wayglim
  const available = () => MODES.filter(m => (!['lava', 'grain', 'plasma'].includes(m) || getGL()) && (!['topo', 'wayglim'].includes(m) || hasGL2()));

  const GROUPS = [
    { key: 'groupFluid', modes: ['water', 'jelly', 'lava', 'grain', 'topo', 'wayglim', 'plasma'] },
    { key: 'groupPlay', modes: ['panel', 'life', 'breakout', 'snake'] }
  ];

  const menuWrap = document.createElement('div');
  menuWrap.className = 'fidget-menu-wrap';

  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.className = 'fidget-menu-btn';
  menuBtn.setAttribute('aria-haspopup', 'listbox');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-label', label('choose'));

  const menuDot = document.createElement('span');
  menuDot.className = 'fidget-menu-dot';

  const menuName = document.createElement('span');
  menuName.className = 'fidget-menu-name';

  const menuChevron = document.createElement('span');
  menuChevron.className = 'fidget-menu-chevron';
  menuChevron.innerHTML = '<svg viewBox="0 0 8 5" width="8" height="5" aria-hidden="true"><path d="M1 1l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  menuBtn.append(menuDot, menuName, menuChevron);

  const popover = document.createElement('div');
  popover.className = 'fidget-popover';
  popover.setAttribute('role', 'listbox');
  popover.hidden = true;
  // de lijst scrolt binnen het menu (het bakje knipt af); zachte rand boven of onder zolang er nog iets staat
  const popScroll = document.createElement('div');
  popScroll.className = 'fidget-pop-scroll';
  popover.append(popScroll);
  const edges = () => {
    popScroll.classList.toggle('can-up', popScroll.scrollTop > 1);
    popScroll.classList.toggle('can-down', popScroll.scrollTop + popScroll.clientHeight < popScroll.scrollHeight - 1);
  };
  popScroll.addEventListener('scroll', edges, { passive: true });
  // muiswiel zelf afhandelen: in de balk van het bakje scrolde de browser de lijst niet (gemeten in Chromium)
  popScroll.addEventListener('wheel', e => {
    if (popScroll.scrollHeight <= popScroll.clientHeight) return;
    e.preventDefault();
    popScroll.scrollTop += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? popScroll.clientHeight : 1);
  }, { passive: false });
  // aanwijzen en tikken in het menu zijn voor het menu, niet voor de fidget eronder
  for (const t of ['pointerdown', 'pointermove', 'pointerup']) popover.addEventListener(t, e => e.stopPropagation());

  menuWrap.append(menuBtn, popover);

  const rightBar = document.createElement('div');
  rightBar.className = 'fidget-bar-right';

  function toggleMenu(open) {
    const show = open ?? popover.hidden;
    popover.hidden = !show;
    menuBtn.setAttribute('aria-expanded', String(show));
    box.classList.toggle('has-menu-open', show);
    if (show) {
      const activeOpt = popover.querySelector('[aria-selected="true"]');
      activeOpt?.focus({ preventScroll: true });
      // de gekozen soort in beeld, ook onderaan een lange lijst (enkel de lijst scrolt, niet het bakje of de pagina)
      if (activeOpt) {
        const bottom = activeOpt.offsetTop + activeOpt.offsetHeight + 8;
        popScroll.scrollTop = bottom > popScroll.clientHeight ? bottom - popScroll.clientHeight : 0;
      }
      edges();
    }
  }

  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    toggleMenu();
  });

  document.addEventListener('pointerdown', e => {
    if (!popover.hidden && !menuWrap.contains(e.target)) {
      toggleMenu(false);
    }
  });

  menuWrap.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      toggleMenu(false);
      menuBtn.focus();
    }
  });

  popover.addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]');
    if (!b) return;
    toggleMenu(false);
    if (b.dataset.mode === modeName) return;
    mode().leave?.();
    mode().unmount?.();
    modeName = b.dataset.mode;
    try { localStorage.setItem(MODE_KEY, modeName); } catch { /* geen opslag */ }
    agit.fill(0);
    renderBar();
    if (!running) render(performance.now());
  });

  // kleurkiezer rechts in de rij: een rondje in de gekozen kleur (native kiezer), en terug naar de standaardkleuren
  try { const c = localStorage.getItem(COLOR_KEY); if (/^#[0-9a-f]{6}$/i.test(c || '')) ACCENT = c; } catch { /* geen opslag */ }
  const pick = document.createElement('label');
  pick.className = 'fidget-color';
  const input = Object.assign(document.createElement('input'), { type: 'color', value: ACCENT || '#cc3022' });
  input.setAttribute('aria-label', label('color'));
  const reset = Object.assign(document.createElement('button'), { type: 'button', className: 'fidget-color-reset', textContent: '↺' });
  reset.setAttribute('aria-label', label('colorReset')); reset.title = label('colorReset');
  pick.append(input);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'fidget-close';
  closeBtn.setAttribute('aria-label', label('close') || 'Sluiten');
  closeBtn.innerHTML = '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2 2l8 8M10 2L2 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  closeBtn.addEventListener('click', e => {
    e.stopPropagation();
    toggleMobile(false);
  });
  rightBar.append(reset, pick, closeBtn);

  function setAccent(c) {
    ACCENT = c;
    try { if (c) localStorage.setItem(COLOR_KEY, c); else localStorage.removeItem(COLOR_KEY); } catch { /* geen opslag */ }
    pick.style.setProperty('--pick', c || 'transparent');
    pick.classList.toggle('is-default', !c);
    reset.hidden = !c;
    palette = null;
    for (const m of Object.values(modes)) m.recolor?.(own);
    if (!running) render(performance.now());
  }
  input.addEventListener('focus', () => box.classList.add('has-color-open'));
  input.addEventListener('blur', () => box.classList.remove('has-color-open'));
  input.addEventListener('change', () => {
    setAccent(input.value);
    box.classList.remove('has-color-open');
  });
  input.addEventListener('input', () => setAccent(input.value));
  reset.addEventListener('click', () => setAccent(null));

  function renderBar() {
    if (!available().includes(modeName)) modeName = 'water';
    menuName.textContent = label(modeName);

    popScroll.replaceChildren(...GROUPS.map(grp => {
      const col = document.createElement('div');
      col.className = 'fidget-pop-col';
      const title = document.createElement('div');
      title.className = 'fidget-pop-title';
      title.textContent = label(grp.key);
      col.append(title);

      const availModes = grp.modes.filter(m => available().includes(m));
      availModes.forEach(m => {
        const opt = document.createElement('button');
        opt.type = 'button';
        opt.setAttribute('role', 'option');
        opt.dataset.mode = m;
        opt.className = 'fidget-pop-opt';
        const isSelected = m === modeName;
        opt.setAttribute('aria-selected', String(isSelected));
        opt.innerHTML = `<span class="fpo-dot"></span><span class="fpo-text">${label(m)}</span>`;
        col.append(opt);
      });
      return col;
    }));

    bar.replaceChildren(menuWrap, rightBar);
    nextBtn.hidden = !hasPresets(modeName);
  }
  bar.addEventListener('pointerdown', e => e.stopPropagation()); // de knopjes tellen niet als tik in het bakje
  renderBar();
  setAccent(ACCENT);

  // verloop uit de tokens --water-calm, --water-mid en --water-hot, in LEVELS stappen (volgt het thema)
  function readPalette() {
    const st = getComputedStyle(document.documentElement);
    const rgb = name => {
      g.fillStyle = '#000'; g.fillStyle = st.getPropertyValue(name).trim() || '#888';
      const v = g.fillStyle;
      return v.startsWith('#') ? [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)) : v.match(/\d+/g).slice(0, 3).map(Number);
    };
    const ramp = ACCENT && accentRamp(ACCENT).map(c => c.map(v => Math.round(v * 255)));
    const stops = ramp ? [rgb('--water-calm'), ramp[2], ramp[3]] : [rgb('--water-calm'), rgb('--water-mid'), rgb('--water-hot')];
    return Array.from({ length: LEVELS }, (_, i) => {
      const t = i / (LEVELS - 1), seg = t < 0.55 ? 0 : 1, u = seg ? (t - 0.55) / 0.45 : t / 0.55;
      const [a, b] = [stops[seg], stops[seg + 1]];
      return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * u)).join(',')})`;
    });
  }

  function render(now = 0) {
    const m = mode();
    cv.hidden = Boolean(m.gl || m.own); cvGL.hidden = !m.gl; own.hidden = !m.own;
    box.classList.toggle('is-gl', Boolean(m.gl || m.own));
    box.classList.toggle('on-dark', ['grain', 'wayglim'].includes(modeName) || Boolean(m.onDark));
    box.classList.toggle('is-panel', modeName === 'panel');
    box.classList.toggle('is-breakout', modeName === 'breakout');
    box.classList.toggle('is-playing', Boolean(m.busy));   // breakout: de keuzerij wijkt tijdens het spel
    if (!m.gl) {
      const ctx = getGL();
      if (ctx) {
        ctx.clearColor(0, 0, 0, 0);
        ctx.clear(ctx.COLOR_BUFFER_BIT);
      }
    }
    if (m.own) {
      m.mount(own);
      m.frame?.(now);   // paneel, life: tekenen mee in de lus
      return;
    }
    if (m.gl) {
      const ctx = getGL();
      if (ctx) {
        ctx.viewport(0, 0, cvGL.width, cvGL.height);
        ctx.clearColor(0, 0, 0, 0); ctx.clear(ctx.COLOR_BUFFER_BIT);
        ctx.enable(ctx.BLEND); ctx.blendFunc(ctx.ONE, ctx.ONE_MINUS_SRC_ALPHA);
        m.render(ctx, now);
      }
      return;
    }
    pos.fill(0);
    m.draw(chr, want, pos);
    if (!palette || now - paletteAt > 1000) { palette = readPalette(); paletteAt = now; }
    const groups = Array.from({ length: LEVELS }, () => []);
    const tick = Math.floor(now / 140);    // de korrel verschuift traag, zoals ruis op film
    for (let k = 0; k < CELLS; k++) {
      // woeligheid: snel aan en traag uit, zodat de kleur nadeint
      agit[k] += (want[k] - agit[k]) * (want[k] > agit[k] ? 0.35 : 0.06);
      if (!chr[k] || k < TOP_ROWS * COLS) continue;   // niet onder de keuzerij
      // korrel: elk teken wijkt een beetje af van het verloop, meer naarmate het woeliger is
      const h = (Math.imul(k + 1, 374761393) ^ Math.imul(tick + 7, 668265263)) >>> 0;
      const grain = ((h % 1000) / 1000 - 0.5) * (0.08 + 0.22 * agit[k]);
      const lv = clamp(Math.round((agit[k] + grain) * (LEVELS - 1)), 0, LEVELS - 1);
      const c = k % COLS, r = (k - c) / COLS;
      groups[lv].push(chr[k], c * CW + CW / 2 + pos[2 * k], r * CH + CH / 2 + pos[2 * k + 1]);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, HH);
    g.font = '500 11px "Geist Mono", ui-monospace, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    groups.forEach((list, lv) => {
      if (!list.length) return;
      g.fillStyle = palette[lv];
      for (let i = 0; i < list.length; i += 3) g.fillText(list[i], list[i + 1], list[i + 2]);
    });
  }

  function frame(now) {
    if (!running) return;
    try {
      acc += Math.min(100, now - (last || now));
      last = now;
      let n = 0;
      while (acc >= STEP_MS && n < 3) {
        // zwaartekracht recht naar onder; ax en ay blijven voor een schok op de inhoud, maar die is er niet meer
        mode().step?.({ gx: 0, gy: 1, ax: 0, ay: 0 });
        acc -= STEP_MS; n++;
      }
      if (n === 3) acc = 0;
      render(now);
    } catch (err) {
      console.error('Fidget frame error in mode ' + modeName, err);
    }
    raf = requestAnimationFrame(frame);
  }

  // scherm naar het assenstelsel van het bakje
  const local = e => {
    const el = [cv, cvGL, own].find(node => !node.hidden) || cv;
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left) / (r.width || 1) * W, y: (e.clientY - r.top) / (r.height || 1) * HH };
  };
  // een tik is indrukken en loslaten zonder veel te bewegen; bewegen (ook ingedrukt) roert in de inhoud
  box.addEventListener('pointerdown', e => {
    if (reducedMotion.matches) return;
    if (!bar.contains(e.target)) box.classList.add('is-interacting');
    press = { x0: e.clientX, y0: e.clientY };
    mode().down?.(local(e));
  });
  box.addEventListener('pointermove', e => {
    if (reducedMotion.matches) return;
    const pt = local(e);
    if (press && Math.hypot(e.clientX - press.x0, e.clientY - press.y0) >= 6) {
      mode().drag?.(pt);
    }
    mode().move?.(pt);
  });
  const release = e => {
    box.classList.remove('is-interacting');
    if (press && Math.hypot(e.clientX - press.x0, e.clientY - press.y0) < 6) mode().tap?.(local(e));
    press = null;
    mode().up?.(local(e));
  };
  box.addEventListener('pointerup', release);
  box.addEventListener('pointercancel', () => { box.classList.remove('is-interacting'); press = null; });
  box.addEventListener('pointerleave', () => { box.classList.remove('is-interacting'); press = null; mode().leave?.(); });

  function start() {
    if (running) return;
    if (reducedMotion.matches) { render(performance.now()); return; }
    running = true; last = 0; acc = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false; cancelAnimationFrame(raf);
    press = null; mode().leave?.();
    for (const m of Object.values(modes)) m.unmount?.();
  }

  const mobileBtn = document.getElementById('focus-fidget-btn');
  const backdrop = document.getElementById('fidget-backdrop');

  function updateMobileScale() {
    if (matchMedia('(min-width: 1000px)').matches) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(1, (vw - 32) / 325.6, (vh - 140) / 226.8);
    const clamped = Math.max(0.65, Math.min(1, scale));
    box.style.setProperty('--fidget-scale', clamped.toFixed(3));
  }

  function toggleMobile(open) {
    const isMobile = !matchMedia('(min-width: 1000px)').matches;
    if (!isMobile) return;
    const show = open ?? !box.classList.contains('is-open');
    if (show) updateMobileScale();
    box.classList.toggle('is-open', show);
    if (backdrop) backdrop.hidden = !show;
    mobileBtn?.setAttribute('aria-expanded', String(show));
    document.body.classList.toggle('has-fidget-open', show);
    if (show) {
      nextBtn.hidden = !hasPresets(modeName);
      if (reducedMotion.matches) render(performance.now());
      else if (!running) start();
      render(performance.now());
    } else {
      stop();
    }
  }

  mobileBtn?.addEventListener('click', e => {
    e.stopPropagation();
    toggleMobile();
  });

  backdrop?.addEventListener('pointerdown', e => {
    e.stopPropagation();
    e.preventDefault();
    toggleMobile(false);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && box.classList.contains('is-open')) {
      toggleMobile(false);
      mobileBtn?.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (box.classList.contains('is-open')) updateMobileScale();
  });
  window.addEventListener('orientationchange', () => {
    if (box.classList.contains('is-open')) updateMobileScale();
  });

  matchMedia('(min-width: 1000px)').addEventListener('change', e => {
    if (e.matches) {
      box.classList.remove('is-open');
      if (backdrop) backdrop.hidden = true;
      document.body.classList.remove('has-fidget-open');
      mobileBtn?.setAttribute('aria-expanded', 'false');
      if (document.body.classList.contains('is-focus')) start();
    } else {
      stop();
    }
  });

  return {
    start,
    stop,
    toggleMobile,
    closeMobile() { toggleMobile(false); },
    isOpen() { return box.classList.contains('is-open'); },
    // scores van een ander toestel of tabblad: elk spel dat al draait leest ze opnieuw in
    reloadScores() { for (const m of Object.values(modes)) m.reload?.(); },
  };
}
