/* ---- Bakje in de focusmodus: digitale fidgets in mono-tekens ---- */
// Een klein bakje rechtsonder, getekend in mono-tekens op een canvas, met drie soorten om mee te spelen (keuze bovenin,
// per toestel onthouden): water (deeltjesvloeistof), gelei (verend raster) en lava (metaballs). Alle drie delen dezelfde
// regels: sleep het bakje en het volgt je, kantelt mee en veert terug, en de inhoud voelt die schok; de kleur volgt hoe hard er iets beweegt, van grijze inkt
// naar het rode korrelverloop van de Bierfeesten. Loopt alleen zolang de focusmodus aan staat en het tabblad zichtbaar is.

const COLS = 40, ROWS = 14;
const CW = 7.4, CH = 12.6;        // maat van één teken (px), Geist Mono 11 px
const W = COLS * CW, HH = ROWS * CH;
const CELLS = COLS * ROWS;
const STEP_MS = 1000 / 60;
const TILT = 0.3;                 // graden kanteling per px uitwijking van het bakje
const MAX_SHIFT = 26;             // px, zo ver volgt het bakje je sleepbeweging
const LEVELS = 14;                // kleurstappen in het verloop
const GRAVITY = 0.16;             // px per stap² (water)
const MODE_KEY = 'priority-orbit.fidget.v1';
export const MODES = ['water', 'jelly', 'lava', 'grain', 'slats'];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---- Water: deeltjesvloeistof (dubbele dichtheidsrelaxatie, Clavet e.a. 2005) ---- */
// Het oppervlak blijft waterpas als het bakje kantelt; bewegen erover roert, een tik geeft een plons.
function water() {
  const N = 760, H = 13;
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
  return { prog, loc: n => (n in locs ? locs[n] : (locs[n] = gl.getUniformLocation(prog, n))) };
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

/* ---- Lava: metaballs ---- */
// Naar MetaBalls van React Bits, met Victors instellingen: variant solid, motion orbit, 15 bollen, animationSize 30,
// gooeyness 0,5, stretch 0,5, wobble 0,5, speed 0,3, clumpFactor 1, cursor-bol 3 keer zo groot met hoverSmoothness
// 0,1, stickiness 0,5, klikstoot en intro, transparant. Effen bollen (inktkleur: wit in het donker) die rond het midden
// draaien en ineenvloeien (veld Σ r²/d², drempel 1); de cursor-bol volgt de aanwijzer zacht en trekt de andere aan.
function lava() {
  const COUNT = 15, SPEED = 0.3, WOBBLE = 0.5, STRETCH = 0.5, STICKY = 0.5, SMOOTH = 0.1, GOO = 0.5, CURSOR = 3;
  const balls = [];
  const cur = { x: W / 2, y: HH / 2, tx: W / 2, ty: HH / 2, r: 0, on: false };
  let t = 0, intro = 0, prog = null, color = [1, 1, 1], colorAt = -1e9;
  for (let i = 0; i < COUNT; i++) {
    balls.push({
      a: i / COUNT * Math.PI * 2 + Math.random() * 0.4,
      R: 18 + Math.random() * 62,                 // straal van de baan (px)
      w: (0.3 + Math.random() * 0.6) * (Math.random() < 0.5 ? -1 : 1),
      s: 5.5 + Math.random() * 4.5,               // straal van de bol (px)
      ph: Math.random() * 10, ox: 0, oy: 0, vx: 0, vy: 0, x: W / 2, y: HH / 2, dx: 0, dy: 0,
    });
  }
  const data = new Float32Array(16 * 4);
  const FRAG = `#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 uRes; uniform vec4 uBalls[16]; uniform vec3 uColor; uniform float uGoo;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * vec2(${W.toFixed(1)}, ${HH.toFixed(1)});
  float f = 0.0;
  for (int i = 0; i < 16; i++) {
    vec4 b = uBalls[i];
    if (b.z <= 0.0) continue;
    vec2 d = p - b.xy;
    f += b.z * b.z / (dot(d, d) + 0.0001);
  }
  f = min(f, 4.0);                                   // midden van een bol: het veld schiet weg, de rand niet
  float w = clamp(fwidth(f), 0.0001, 0.6) * (1.0 + uGoo);
  float a = smoothstep(1.0 - w, 1.0 + w, f);
  gl_FragColor = vec4(uColor * a, a);
}`;
  function step({ ax, ay }) {
    t += 1 / 60;
    intro = Math.min(1, intro + 1 / 60 / 1.3);
    const ease = 1 - Math.pow(1 - intro, 3);
    cur.x += (cur.tx - cur.x) * SMOOTH; cur.y += (cur.ty - cur.y) * SMOOTH;
    cur.r += ((cur.on ? 5.5 * CURSOR * 0.75 : 0) - cur.r) * 0.08;
    for (const b of balls) {
      b.a += b.w * SPEED * (1 / 60) * 3;
      const wob = 1 + WOBBLE * 0.18 * Math.sin(t * 1.3 + b.ph);
      const hx = W / 2 + Math.cos(b.a) * b.R * wob * ease * 1.45, hy = HH / 2 + Math.sin(b.a) * b.R * wob * ease * 0.7;
      let fx = -b.ox * 0.04 - ax * 2.2, fy = -b.oy * 0.04 - ay * 2.2;
      if (cur.r > 1) {
        const ex = cur.x - (hx + b.ox), ey = cur.y - (hy + b.oy), d = Math.hypot(ex, ey);
        if (d < 90 && d > 1) { const f = STICKY * 0.9 * (1 - d / 90); fx += ex / d * f; fy += ey / d * f; }
      }
      b.vx = (b.vx + fx) * 0.9; b.vy = (b.vy + fy) * 0.9;
      b.ox += b.vx; b.oy += b.vy;
      const nx = hx + b.ox, ny = hy + b.oy;
      b.dx = nx - b.x; b.dy = ny - b.y; b.x = nx; b.y = ny;
    }
  }
  function render(gl, now) {
    if (!prog) prog = program(gl, FRAG);
    if (!prog) return;
    if (now - colorAt > 1000) { color = hexRgb(getComputedStyle(document.documentElement).getPropertyValue('--ink')); colorAt = now; }
    const grow = Math.min(1, intro * 1.4);
    balls.forEach((b, i) => {
      // uitrekken in de bewegingsrichting: een bol die snel gaat, schuift een beetje voor zich uit
      const sp = Math.hypot(b.dx, b.dy), k = STRETCH * Math.min(1.5, sp * 0.5);
      data[i * 4] = b.x + b.dx * k * 2; data[i * 4 + 1] = b.y + b.dy * k * 2; data[i * 4 + 2] = b.s * grow; data[i * 4 + 3] = 0;
    });
    data[15 * 4] = cur.x; data[15 * 4 + 1] = cur.y; data[15 * 4 + 2] = cur.r;
    gl.useProgram(prog.prog);
    gl.uniform2f(prog.loc('uRes'), gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform4fv(prog.loc('uBalls'), data);
    gl.uniform3fv(prog.loc('uColor'), color);
    gl.uniform1f(prog.loc('uGoo'), GOO);
    fullscreen(gl, prog);
  }
  return {
    gl: true,
    init() { intro = 0; },
    step, render,
    move(p) { cur.on = true; cur.tx = p.x; cur.ty = p.y; },
    leave() { cur.on = false; },
    tap(p) {
      // klikstoot: alles in de buurt vliegt weg van de tik
      for (const b of balls) {
        const ex = b.x - p.x, ey = b.y - p.y, d = Math.hypot(ex, ey) || 1, f = Math.max(0, 1 - d / 160) * 12;
        b.vx += ex / d * f; b.vy += ey / d * f;
      }
    },
  };
}

/* ---- Gloed: grainient ---- */
// Naar Grainient van React Bits, preset dusk zoals Victor hem doorgaf: kleuren #120F17, #3F0D1A, #BE123C, #FB923C,
// #FDE68A, hoek 150°, silk 0,4. Een verloop dat traag golft als zijde, met filmkorrel. Om mee te spelen: de aanwijzer
// draait een zachte wervel in het verloop, een tik stuurt een kring door de zijde, slepen laat het verloop meeschuiven.
function grain() {
  const COLORS = ['#120f17', '#3f0d1a', '#be123c', '#fb923c', '#fde68a'].map(hexRgb).flat();
  const ANGLE = 150, SILK = 0.4;
  let prog = null, t = 0;
  const ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, k: 0, on: false };
  const rip = { x: 0.5, y: 0.5, t: -10 };
  const off = { x: 0, y: 0 };
  const FRAG = `precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec3 uCol[5]; uniform float uAngle; uniform float uSilk;
uniform vec3 uPtr; uniform vec3 uRip; uniform vec2 uOff;
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
  float n1 = fbm(p * 0.9 + vec2(uTime * 0.05, -uTime * 0.035));
  float n2 = fbm(p * 1.2 + vec2(-uTime * 0.03, uTime * 0.05) + n1 * 0.8);
  vec2 q = p + uSilk * 0.75 * (vec2(n1, n2) - 0.5);
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
  }
  function render(gl) {
    if (!prog) prog = program(gl, FRAG);
    if (!prog) return;
    gl.useProgram(prog.prog);
    gl.uniform2f(prog.loc('uRes'), gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(prog.loc('uTime'), t);
    gl.uniform3fv(prog.loc('uCol'), COLORS);
    gl.uniform1f(prog.loc('uAngle'), ANGLE);
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

/* ---- Lamellen: micro slats ---- */
// Naar MicroSlats van React Bits Pro met Victors instellingen: preset swell, kleur #ff1b58, glans #ef4444, achtergrond
// #120f17, lamellen 11 × 30 met 3 px tussenruimte (hier op 70 %, het bakje is klein), roundness 0,65, cursorStrength 1,
// cursorSize 80, swirl 0, trail 3,6, lean 0, scale 1,5, speed 1,85, richting 250°, chop 0,65, stretch 0, glint 0,65,
// contrast 2,1, perspective 0,55, fog 0,45, intro van 1,5 s. Een raster van afgeronde lamellen die kantelen op een
// deining: een lamel die wegdraait wordt korter en donkerder, een die naar je toe draait licht op, met een glans op de
// top. Bovenaan liggen ze verder weg (kleiner, in de mist). De aanwijzer laat een spoor van golfjes achter.
function slats() {
  const P = { color: '#ff1b58', glint: '#ef4444', bg: '#120f17', sw: 11 * 0.7, sh: 30 * 0.7, gap: 3 * 0.7, round: 0.65,
    strength: 1, size: 80 * 0.7, trail: 3.6, scale: 1.5, speed: 1.85, dir: 250, chop: 0.65, glintK: 0.65, contrast: 2.1,
    persp: 0.55, fog: 0.45, intro: 1.5 };
  const MAXT = 16;
  let prog = null, t = 0, shake = 0, shakeV = 0, lastDrop = 0;
  const trail = [];                                          // {x, y, s}: spoor van de aanwijzer, dooft uit
  const ptr = { x: 0, y: 0, on: false };
  const data = new Float32Array(MAXT * 3);
  const FRAG = `precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec3 uTrail[${MAXT}]; uniform float uShake;
uniform vec3 uColor; uniform vec3 uGlint; uniform vec3 uBg;
const float SW = ${P.sw.toFixed(2)}, SH = ${P.sh.toFixed(2)}, GAP = ${P.gap.toFixed(2)}, ROUND = ${P.round.toFixed(2)};
const float PERSP = ${P.persp.toFixed(2)}, FOG = ${P.fog.toFixed(2)}, CHOP = ${P.chop.toFixed(2)}, SCALE = ${P.scale.toFixed(2)};
const float SPEED = ${P.speed.toFixed(2)}, GLINT = ${P.glintK.toFixed(2)}, CONTRAST = ${P.contrast.toFixed(2)};
const float SIZE = ${P.size.toFixed(1)}, STRENGTH = ${P.strength.toFixed(2)}, INTRO = ${P.intro.toFixed(2)};
const vec2 BOX = vec2(${W.toFixed(1)}, ${HH.toFixed(1)});
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
// perspectief: bovenaan meer wereld per pixel (lamellen kleiner, verder weg)
float sx(float yn) { return mix(1.0 - 0.45 * PERSP, 1.0, yn); }
float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uRes * BOX;
  float yn = p.y / BOX.y, s = sx(yn);
  vec2 w = vec2(BOX.x * 0.5 + (p.x - BOX.x * 0.5) / s, BOX.y * (1.0 - pow(1.0 - yn, 1.0 + PERSP)));
  vec2 pitch = vec2(SW + GAP, SH + GAP);
  vec2 cell = floor(w / pitch), c = (cell + 0.5) * pitch, local = w - c;
  // middelpunt van de lamel terug op het scherm, voor het spoor van de aanwijzer
  float cyn = 1.0 - pow(max(0.0, 1.0 - c.y / BOX.y), 1.0 / (1.0 + PERSP));
  vec2 cs = vec2(BOX.x * 0.5 + (c.x - BOX.x * 0.5) * sx(cyn), cyn * BOX.y);
  // deining (swell) in de richting van 250°, met kabbeling (chop)
  float a = radians(${P.dir.toFixed(1)});
  vec2 dir = vec2(cos(a), sin(a)), perp = vec2(-dir.y, dir.x);
  float k = 0.045 / SCALE;
  float ph = dot(c, dir) * k - uTime * SPEED;
  float v = sin(ph) * 0.75 + sin(ph * 0.57 + dot(c, perp) * k * 0.6 + uTime * 0.45) * 0.35;
  v += snoise(c * k * 1.6 + vec2(uTime * 0.35, -uTime * 0.25)) * CHOP * 0.55;
  for (int i = 0; i < ${MAXT}; i++) {
    vec3 tr = uTrail[i];
    if (tr.z <= 0.0) continue;
    vec2 d = cs - tr.xy;
    v += STRENGTH * 1.4 * tr.z * exp(-dot(d, d) / (SIZE * SIZE * 0.35));
  }
  v += uShake;
  // intro: lamellen klappen open van onder naar boven
  float open = smoothstep(0.0, 1.0, (uTime - (1.0 - cyn) * 0.5) / INTRO);
  float th = v * 1.15 + (1.0 - open) * 1.5;
  float h = SH * 0.5 * max(0.06, abs(cos(th)));
  vec2 b = vec2(SW * 0.5, h);
  float sd = sdRound(local, b, ROUND * min(b.x, b.y));
  float px = 1.0 / s;                                         // wereld-eenheden per schermpixel
  float inside = smoothstep(px * 0.9, -px * 0.9, sd);
  // licht: naar je toe gedraaid = helder, weggedraaid = donker; glans op de top
  float lum = clamp(0.5 + 0.5 * sin(th + 0.7), 0.0, 1.0);
  lum = pow(lum, CONTRAST * 0.75);
  vec3 col = mix(uBg * 1.6, uColor, lum);
  float g = pow(max(0.0, cos(th - 0.35)), 18.0) * GLINT;
  col += uGlint * g * 0.9 + vec3(1.0, 0.85, 0.85) * g * g * 0.35;
  // langs de lamel een fijn verloop, alsof hij rond is
  col *= 0.82 + 0.18 * (1.0 - abs(local.x) / (SW * 0.5));
  vec3 outc = mix(uBg, col, inside);
  // mist bovenaan
  outc = mix(outc, uBg, FOG * pow(1.0 - yn, 1.6) * 0.9);
  gl_FragColor = vec4(outc, 1.0);
}`;
  function step({ ax }) {
    t += 1 / 60;
    for (const tr of trail) tr.s -= 1 / 60 / (P.trail * 0.3);
    while (trail.length && trail[0].s <= 0) trail.shift();
    if (ptr.on && t - lastDrop > 0.05) {
      const last = trail[trail.length - 1];
      if (!last || Math.hypot(last.x - ptr.x, last.y - ptr.y) > 3 || last.s < 0.7) { trail.push({ x: ptr.x, y: ptr.y, s: 1 }); lastDrop = t; }
      if (trail.length > MAXT) trail.shift();
    }
    shakeV = (shakeV - shake * 0.05 - ax * 0.05) * 0.9; shake += shakeV;
  }
  function render(gl) {
    if (!prog) prog = program(gl, FRAG);
    if (!prog) return;
    data.fill(0);
    trail.slice(-MAXT).forEach((tr, i) => { data[i * 3] = tr.x; data[i * 3 + 1] = tr.y; data[i * 3 + 2] = Math.max(0, tr.s); });
    gl.useProgram(prog.prog);
    gl.uniform2f(prog.loc('uRes'), gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(prog.loc('uTime'), t);
    gl.uniform3fv(prog.loc('uTrail'), data);
    gl.uniform1f(prog.loc('uShake'), shake);
    gl.uniform3fv(prog.loc('uColor'), hexRgb(P.color));
    gl.uniform3fv(prog.loc('uGlint'), hexRgb(P.glint));
    gl.uniform3fv(prog.loc('uBg'), hexRgb(P.bg));
    fullscreen(gl, prog);
  }
  return {
    gl: true,
    init() { t = 0; },
    step, render,
    move(p) { ptr.on = true; ptr.x = p.x; ptr.y = p.y; },
    leave() { ptr.on = false; },
    tap(p) { trail.push({ x: p.x, y: p.y, s: 2.2 }); if (trail.length > MAXT) trail.shift(); },
  };
}

const FACTORIES = { water, jelly, lava, grain, slats };

export function createFidget(box, { reducedMotion, label = m => m }) {
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
  const shift = { x: 0, y: 0, vx: 0, vy: 0, goalX: 0, goalY: 0 };
  let drag = null, nudgeAt = 0;

  let modeName = 'water';
  try { const m = localStorage.getItem(MODE_KEY); if (MODES.includes(m)) modeName = m; } catch { /* geen opslag */ }
  const modes = {};
  const mode = () => {
    if (!modes[modeName]) { modes[modeName] = FACTORIES[modeName](); modes[modeName].init(); }
    return modes[modeName];
  };

  // keuze bovenin het bakje
  const bar = box.querySelector('.fidget-modes');
  // zonder WebGL geen lava of gloed (dan ook niet als keuze)
  const available = () => MODES.filter(m => !['lava', 'grain', 'slats'].includes(m) || getGL());
  function renderBar() {
    if (!available().includes(modeName)) modeName = 'water';
    bar.replaceChildren(...available().map((m, i) => {
      const frag = document.createDocumentFragment();
      if (i) frag.append(Object.assign(document.createElement('span'), { className: 'slash', textContent: '/', ariaHidden: 'true' }));
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.mode = m;
      b.setAttribute('aria-checked', String(m === modeName));
      b.textContent = label(m);
      frag.append(b);
      return frag;
    }));
  }
  bar.addEventListener('pointerdown', e => e.stopPropagation());   // de knopjes slepen het bakje niet mee
  bar.addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]');
    if (!b || b.dataset.mode === modeName) return;
    mode().leave();
    modeName = b.dataset.mode;
    try { localStorage.setItem(MODE_KEY, modeName); } catch { /* geen opslag */ }
    agit.fill(0);
    renderBar();
    if (!running) render(performance.now());
  });
  renderBar();

  // verloop uit de tokens --water-calm, --water-mid en --water-hot, in LEVELS stappen (volgt het thema)
  function readPalette() {
    const st = getComputedStyle(document.documentElement);
    const rgb = name => {
      g.fillStyle = '#000'; g.fillStyle = st.getPropertyValue(name).trim() || '#888';
      const v = g.fillStyle;
      return v.startsWith('#') ? [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)) : v.match(/\d+/g).slice(0, 3).map(Number);
    };
    const stops = [rgb('--water-calm'), rgb('--water-mid'), rgb('--water-hot')];
    return Array.from({ length: LEVELS }, (_, i) => {
      const t = i / (LEVELS - 1), seg = t < 0.55 ? 0 : 1, u = seg ? (t - 0.55) / 0.45 : t / 0.55;
      const [a, b] = [stops[seg], stops[seg + 1]];
      return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * u)).join(',')})`;
    });
  }

  // het bakje volgt je sleepbeweging en veert terug; zijn versnelling is wat de inhoud voelt
  function moveBox() {
    const dragging = drag?.moved, k = dragging ? 0.25 : 0.06, damp = dragging ? 0.6 : 0.82;
    const ax = (shift.goalX - shift.x) * k, ay = (shift.goalY - shift.y) * k;
    const nvx = (shift.vx + ax) * damp, nvy = (shift.vy + ay) * damp;
    const accX = nvx - shift.vx, accY = nvy - shift.vy;
    shift.vx = nvx; shift.vy = nvy;
    shift.x += shift.vx; shift.y += shift.vy;
    if (!dragging) { shift.goalX = 0; shift.goalY = 0; }
    return [accX, accY];
  }

  function render(now = 0) {
    const m = mode();
    cv.hidden = Boolean(m.gl); cvGL.hidden = !m.gl;
    box.classList.toggle('is-gl', Boolean(m.gl));
    if (m.gl) {
      const ctx = getGL();
      if (ctx) {
        ctx.viewport(0, 0, cvGL.width, cvGL.height);
        ctx.clearColor(0, 0, 0, 0); ctx.clear(ctx.COLOR_BUFFER_BIT);
        ctx.enable(ctx.BLEND); ctx.blendFunc(ctx.ONE, ctx.ONE_MINUS_SRC_ALPHA);
        m.render(ctx, now);
      }
      box.style.translate = `${shift.x.toFixed(1)}px ${shift.y.toFixed(1)}px`;
      box.style.rotate = `${(shift.x * TILT).toFixed(2)}deg`;
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
      if (!chr[k]) continue;
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
    box.style.translate = `${shift.x.toFixed(1)}px ${shift.y.toFixed(1)}px`;
    box.style.rotate = `${(shift.x * TILT).toFixed(2)}deg`;
  }

  function frame(now) {
    if (!running) return;
    acc += Math.min(100, now - (last || now));
    last = now;
    // af en toe een zacht duwtje, zodat het nooit lang helemaal stil ligt
    if (now > nudgeAt && !drag) {
      shift.vx += (Math.random() < 0.5 ? -1 : 1) * (0.6 + 0.5 * Math.random());
      nudgeAt = now + 9000 + Math.random() * 7000;
    }
    let n = 0;
    while (acc >= STEP_MS && n < 3) {
      const [ax, ay] = moveBox(), m = mode();
      // zwaartekracht in het assenstelsel van het gekantelde bakje, plus de schok van het bakje zelf
      const tilt = -shift.x * TILT * Math.PI / 180;
      m.step({ gx: Math.sin(tilt) - ax / GRAVITY, gy: Math.cos(tilt) - ay / GRAVITY, ax, ay });
      acc -= STEP_MS; n++;
    }
    if (n === 3) acc = 0;
    render(now);
    raf = requestAnimationFrame(frame);
  }

  // scherm naar het assenstelsel van het bakje (zonder de kanteling, die is klein)
  const local = e => { const r = (cv.hidden ? cvGL : cv).getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * HH }; };
  box.addEventListener('pointerdown', e => {
    if (reducedMotion.matches) return;
    drag = { x0: e.clientX, y0: e.clientY, moved: false };
    box.setPointerCapture(e.pointerId);
    box.classList.add('is-dragging');
  });
  box.addEventListener('pointermove', e => {
    if (reducedMotion.matches) return;
    const p = local(e);
    if (drag) {
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved) {
        const lim = v => MAX_SHIFT * Math.tanh(v / MAX_SHIFT);   // zacht begrensd
        shift.goalX = lim(dx); shift.goalY = lim(dy) * 0.6;
      }
      return;
    }
    mode().move(p);
  });
  const endDrag = e => {
    if (!drag) return;
    if (!drag.moved) mode().tap(local(e));
    drag = null;
    box.classList.remove('is-dragging');
  };
  box.addEventListener('pointerup', endDrag);
  box.addEventListener('pointercancel', endDrag);
  box.addEventListener('pointerleave', () => { if (!drag) mode().leave(); });

  return {
    start() {
      if (running) return;
      if (reducedMotion.matches) { render(performance.now()); return; }
      running = true; last = 0; acc = 0;
      nudgeAt = performance.now() + 2500;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false; cancelAnimationFrame(raf);
      drag = null; mode().leave();
      Object.assign(shift, { x: 0, y: 0, vx: 0, vy: 0, goalX: 0, goalY: 0 });
      box.style.translate = box.style.rotate = '';
    },
  };
}
