/* ---- Plasma in het bakje van de focusmodus ---- */
// Een plasmaplaat zoals op de foto's van Victor (08/11/2026): ontladingen van een elektrode in het midden naar de rand,
// opgevangen door duizenden glazen bolletjes. Die bolletjes zijn een zeshoekig raster van punten, het motief van Orbit
// (kern, zandloper). De ontladingen kronkelen traag langs vaste ruis (geen zenuwachtig trillen), met zijtakjes die opkomen
// en doven. Enkel de plaat over het hele vak (Victor, 08/11/2026: de ronde schijf mocht weg).
// Reactie zoals een echte plaat (Victor, 08/11/2026: "onderzoek eerst hoe deze echte plasma dingen werken"): een ontlading
// loopt altijd van de elektrode tot een rand, glas of vinger, en eindigt nooit in het niets. Een hand vlakbij (muis zonder
// klik) buigt de nabije ontladingen wat naar zich toe, het eindpunt blijft op de rand. Aanraken (indrukken of tikken) is een
// makkelijkere weg naar de aarde: de dichtstbijzijnde ontlading slaat over naar de vinger, wordt feller, dunner en rustiger,
// volgt de vinger en waaiert eronder uit in fijne takjes; de andere worden zwakker (de stroom gaat naar de vinger).
// Loslaten: ze slaat terug naar de rand. Kleur uit de kleurkiezer, anders rood naar amber.
// Tekenen: de ontladingen als grijswaarden op een klein 2D-canvas (energie), daarna in WebGL per bolletje gekleurd.

// maat van het bakje (groeit mee, de bolletjes houden hun maat: een groter bakje heeft er meer); basis 325,6 × 226,8
let W = 325.6, H = 226.8;
let EW = 326, EH = 227;              // energie op schermresolutie (CSS-pixels); de bolletjes lezen per bolletje één waarde
const BEAD = 2.4;                    // afstand tussen bolletjes in CSS-pixels
const SEG = 44;                      // punten per ontlading
const DEFAULT = [[0.07, 0.024, 0.04], [0.29, 0.04, 0.063], [0.85, 0.14, 0.1], [1, 0.58, 0.25], [1, 0.95, 0.85]];   // bijna zwart, donkerrood, rood, amber, warm wit

// zachte ruis in twee dimensies (waarde-ruis met vloeiende overgang), genoeg voor trage kronkels
const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
const smooth = t => t * t * (3 - 2 * t);
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = smooth(xf), v = smooth(yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
const rnd = (a, b) => a + Math.random() * (b - a);

const VERT = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
const FRAG = `precision mediump float;
uniform sampler2D uE;
uniform vec2 uRes;      // canvas in pixels
uniform float uS;       // afstand tussen bolletjes in pixels
uniform vec2 uCen;      // middelpunt in pixels
uniform float uT;
uniform vec3 uC0, uC1, uC2, uC3, uC4;
float h2(vec2 q) { return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 q) { vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
vec3 ramp(float e) {
  if (e < 0.22) return mix(uC0, uC1, e / 0.22);
  if (e < 0.55) return mix(uC1, uC2, (e - 0.22) / 0.33);
  if (e < 0.95) return mix(uC2, uC3, (e - 0.55) / 0.4);
  return mix(uC3, uC4, clamp((e - 0.95) / 0.55, 0.0, 1.0));
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float r = length(p - uCen);
  // zeshoekig raster: dichtstbijzijnde bolletje
  vec2 sz = vec2(uS, uS * 1.7320508);
  vec2 a = mod(p, sz) - sz * 0.5;
  vec2 b = mod(p - sz * 0.5, sz) - sz * 0.5;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 c = p - g;
  float d = length(g) / (uS * 0.5);
  float e = texture2D(uE, c / uRes).r * 1.7;
  float line = texture2D(uE, p / uRes).r * 1.7;
  // gas: overal een zwak licht, iets sterker bij de elektrode, met trage donkere vlekken zoals op de foto's
  float R = length(uRes) * 0.5;
  float gas = (0.17 + 0.16 * exp(-r / (R * 0.5))) * (0.62 + 0.76 * vn(c / (uS * 14.0) + vec2(uT * 0.03, -uT * 0.02)));
  float lit = max(e, gas) * (0.82 + 0.3 * (1.0 - d * d));
  float body = 1.0 - smoothstep(0.62, 1.0, d);                    // het bolletje
  float spec = (1.0 - smoothstep(0.0, 0.42, length(g / (uS * 0.5) - vec2(-0.28, -0.32)))) * 0.35;   // glans op het glas
  vec3 gap = uC0 * 0.55;
  vec3 col = mix(gap, ramp(lit), body) + uC4 * spec * clamp(e, 0.0, 1.0) * body;
  col = mix(col, ramp(line), clamp(line - 0.85, 0.0, 1.0) * 0.35);   // de kern van een ontlading leest ook tussen de bolletjes
  float v = smoothstep(0.0, uS * 6.0, min(min(p.x, uRes.x - p.x), min(p.y, uRes.y - p.y)));
  col *= 0.6 + 0.4 * v;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createPlasma({ reducedMotion, ramp, size }) {
  if (size) { W = size.w; H = size.h; EW = Math.ceil(W); EH = Math.ceil(H); }
  const grow = W / 325.6;   // meer ontladingen en draadjes in een groter bakje
  let cv = null, gl = null, prog = null, tex = null, loc = {};
  const ec = document.createElement('canvas'); ec.width = EW; ec.height = EH;
  const eg = ec.getContext('2d');
  const C = { x: W / 2, y: H / 2 };
  let fil = [], hair = [], t = 0, lastNow = 0, glow = 0;
  const ptr = { x: 0, y: 0, on: false, down: false };
  // aanraking: ingedrukt, of kort na een tik op de plek van de tik; divert = hoeveel stroom naar de vinger gaat
  const touch = { on: false, x: 0, y: 0, until: -9, at: -9, divert: 0, near: 0 };

  // punt op de rand in richting th
  function edge(th) {
    const dx = Math.cos(th), dy = Math.sin(th);
    const ix = (W / 2 - 2) / Math.abs(dx || 1e-6), iy = (H / 2 - 2) / Math.abs(dy || 1e-6), k = Math.min(ix, iy);
    return { x: C.x + dx * k, y: C.y + dy * k };
  }
  const inside = p => p.x > 2 && p.x < W - 2 && p.y > 2 && p.y < H - 2;
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  function branch(lo = 0.22, hi = 0.86) {
    return { s: rnd(lo, hi), len: rnd(0.1, 0.32), ang: rnd(0.35, 0.95) * (Math.random() < 0.5 ? -1 : 1), born: t - rnd(0, 2), life: rnd(0.9, 2.6), seed: rnd(0, 999) };
  }
  function setup() {
    const n = Math.round(11 * grow);
    fil = Array.from({ length: n }, (_, i) => ({
      base: (i / n) * Math.PI * 2 + rnd(-0.25, 0.25),
      ph1: rnd(0, 99), ph2: rnd(0, 99), k1: rnd(0.6, 1.2), k2: rnd(0.8, 1.6),
      seed: rnd(0, 999), bright: rnd(0.78, 1), lean: 0, out: 1, rate: 5, lock: 0, ex: 0, ey: 0,
      br: Array.from({ length: 3 }, () => branch()),
    }));
    // fijne draadjes: zwak en dun, zoals het web op de derde foto; ze volgen niet de vinger
    hair = Array.from({ length: Math.round(12 * grow) }, () => ({ base: rnd(0, Math.PI * 2), ph: rnd(0, 99), k: rnd(0.5, 1.3), seed: rnd(0, 999), len: rnd(0.55, 1) }));
  }

  // pad van a naar b, kronkelend langs de ruis (amp = deel van de lengte), terug als lijst punten.
  // bend: een hand vlakbij ({x, y, k}) trekt het midden van het pad wat naar zich toe; begin en eind blijven liggen
  function path(a, b, seed, amp, n, speed, bend) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const out = new Float32Array((n + 1) * 2);
    for (let i = 0; i <= n; i++) {
      const s = i / n, env = Math.pow(Math.sin(Math.PI * s), 0.7);
      const o = noise(seed + s * 2.2, t * 0.22 * speed) + 0.5 * noise(seed + 40 + s * 5.3, t * 0.45 * speed)
        + 0.28 * noise(seed + 80 + s * 11, t * 0.8 * speed) + 0.16 * noise(seed + 120 + s * 24, t * 1.5 * speed);
      const off = o * amp * L * env;
      let x = a.x + dx * s + nx * off, y = a.y + dy * s + ny * off;
      if (bend && bend.k > 0.001) {
        const w = bend.k * env * Math.exp(-((Math.hypot(bend.x - x, bend.y - y) / 46) ** 2));
        x += (bend.x - x) * w; y += (bend.y - y) * w;
      }
      out[2 * i] = x; out[2 * i + 1] = y;
    }
    return out;
  }
  function stroke(pts, w, k, core = 1) {
    eg.beginPath(); eg.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) eg.lineTo(pts[i], pts[i + 1]);
    // drie lagen: brede gloed, halo, kern (grijswaarden; de kleur komt in de shader); core < 1 = dunnere, fellere kern
    eg.lineWidth = 16 * w; eg.strokeStyle = `rgba(255,255,255,${0.04 * k})`; eg.stroke();
    eg.lineWidth = 6 * w; eg.strokeStyle = `rgba(255,255,255,${0.1 * k})`; eg.stroke();
    eg.lineWidth = 2.2 * w * core; eg.strokeStyle = `rgba(255,255,255,${0.22 * k})`; eg.stroke();
    eg.lineWidth = 1 * w * core; eg.strokeStyle = `rgba(255,255,255,${0.42 * k})`; eg.stroke();
  }
  const dot = (x, y, r, k) => {
    const gr = eg.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${k})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    eg.fillStyle = gr; eg.fillRect(x - r, y - r, 2 * r, 2 * r);
  };
  // opnieuw inslaan: het oude pad dooft in de nagloed, het nieuwe licht snel op
  const restrike = f => { f.out = 0; f.rate = 9; };

  function simulate(dt) {
    t += dt;
    const ease = k => 1 - Math.exp(-dt * k);
    // aanraking: ingedrukt volgt de vinger; een tik houdt de plek kort vast
    const was = touch.on;
    if (ptr.down) { touch.x = ptr.x; touch.y = ptr.y; }
    touch.on = ptr.down || t < touch.until;
    touch.divert += ((touch.on ? 1 : 0) - touch.divert) * ease(touch.on ? 10 : 9);
    touch.near += ((ptr.on && !touch.on ? 1 : 0) - touch.near) * ease(4);
    for (const f of fil) f.th = f.base + 0.55 * Math.sin(t * 0.07 * f.k1 + f.ph1) + 0.3 * Math.sin(t * 0.13 * f.k2 + f.ph2);
    if (touch.on && !was) {
      // de dichtstbijzijnde ontlading slaat over naar de vinger; ligt er een tweede vlakbij, dan die ook (zwakker)
      touch.at = t;
      const ta = Math.atan2(touch.y - C.y, touch.x - C.x);
      const order = [...fil].sort((a, b) => Math.abs(angDiff(ta, a.th)) - Math.abs(angDiff(ta, b.th)));
      order.forEach((f, i) => {
        if (i === 0 || (i === 1 && Math.abs(angDiff(ta, f.th)) < 0.4)) {
          f.lock = i === 0 ? 1 : 0.45; f.ex = touch.x; f.ey = touch.y; restrike(f);
          f.br = Array.from({ length: 3 }, () => branch(0.45, 0.95));   // vlak bij de vinger vertakt het meest
        }
      });
    } else if (!touch.on && was) {
      for (const f of fil) if (f.lock) { f.lock = 0; restrike(f); f.br = Array.from({ length: 3 }, () => branch()); }
    }
    const pa = Math.atan2(ptr.y - C.y, ptr.x - C.x);
    for (const f of fil) {
      if (f.lock) {
        // volgt de vinger met een heel klein beetje traagheid (het hete kanaal blijft even liggen)
        f.ex += (touch.x - f.ex) * ease(28); f.ey += (touch.y - f.ey) * ease(28);
        f.lean = 0;
      } else {
        // hand vlakbij: wie in de buurt draait, helt over naar de hand; het eindpunt blijft op de rand
        const dA = angDiff(pa, f.th);
        const want = touch.near * 0.45 * Math.exp(-((dA / 0.6) ** 2));
        f.lean += (want - f.lean) * ease(4);
        f.th += dA * f.lean;
      }
      // af en toe dooft een vrije ontlading even en slaat ze op een nieuwe plek opnieuw in
      if (f.out < 1) f.out = Math.min(1, f.out + dt * f.rate);
      else if (!f.lock && Math.random() < dt * 0.05) { f.out = -0.4; f.rate = 5; f.seed = rnd(0, 999); f.base += rnd(-0.6, 0.6); }
      for (let i = 0; i < f.br.length; i++) if (t - f.br[i].born > f.br[i].life) f.br[i] = { ...(f.lock ? branch(0.45, 0.95) : branch()), born: t };
    }
    glow += ((0.35 + 0.3 * touch.divert + 0.25 * Math.max(0, 1 - (t - touch.at) / 0.5)) - glow) * ease(3);
  }

  function drawEnergy() {
    eg.setTransform(EW / W, 0, 0, EH / H, 0, 0);
    eg.globalCompositeOperation = 'source-over';
    eg.fillStyle = 'rgba(0,0,0,0.6)'; eg.fillRect(0, 0, W, H);   // nagloed: wat er net was, dooft in enkele beelden
    eg.globalCompositeOperation = 'lighter';
    eg.lineCap = 'round'; eg.lineJoin = 'round';
    const hit = Math.max(0, 1 - (t - touch.at) / 0.35);       // korte opflakkering bij het overslaan
    const bend = { x: ptr.x, y: ptr.y, k: 0.3 * touch.near };
    for (const f of fil) {
      if (f.out <= 0) continue;
      const locked = f.lock > 0;
      const end = locked ? { x: f.ex, y: f.ey } : edge(f.th);
      const flick = 0.9 + 0.1 * noise(f.seed, t * 9);
      // vast aan de vinger: feller en rustiger; de andere zwakker zolang de stroom naar de vinger gaat
      const I = f.bright * flick * f.out * (locked ? (1.1 + 0.4 * hit) * f.lock + 0.15 : 1 - 0.45 * touch.divert);
      const pts = locked ? path(C, end, f.seed, 0.1, SEG, 0.6) : path(C, end, f.seed, 0.16, SEG, 1, bend);
      stroke(pts, locked ? 0.7 : 1, I, locked ? 0.9 : 1);
      // zijtakjes: groeien uit een punt van de ontlading, dunner en zwakker, en doven weer
      for (const b of f.br) {
        const u = (t - b.born) / b.life; if (u < 0 || u > 1) continue;
        const live = Math.sin(Math.PI * u), i0 = Math.round(b.s * SEG);
        const px = pts[2 * i0], py = pts[2 * i0 + 1], dir = Math.atan2(end.y - C.y, end.x - C.x) + b.ang;
        const L = Math.hypot(end.x - C.x, end.y - C.y) * b.len * (0.6 + 0.4 * live) * (locked ? 0.7 : 1);
        const bp = path({ x: px, y: py }, { x: px + Math.cos(dir) * L, y: py + Math.sin(dir) * L }, b.seed, 0.22, 12, 1.4);
        stroke(bp, locked ? 0.45 : 0.55, I * (locked ? 0.35 : 0.55) * live);
      }
      if (locked) continue;
      // waar de ontlading het glas raakt: een klein waaiertje
      for (let j = 0; j < 2; j++) {
        const dir = Math.atan2(end.y - C.y, end.x - C.x) + (j - 0.5) * 0.55;
        const L = 5 + 7 * noise(f.seed + j * 7, t * 0.8 + j) ** 2;
        stroke(path(end, { x: end.x + Math.cos(dir) * L, y: end.y + Math.sin(dir) * L }, f.seed + j, 0.25, 6, 2), 0.4, I * 0.35);
      }
    }
    // onder de vinger: de ontlading waaiert over het glas uit in fijne, vertakte draadjes, rondom maar vooral van de elektrode weg
    if (touch.divert > 0.02) {
      const k = touch.divert, away = Math.atan2(touch.y - C.y, touch.x - C.x);
      for (let j = 0; j < 7; j++) {
        const dir = away + (j - 3) * 0.62 + 0.25 * noise(j * 13, t * 0.5);
        const L = (7 + 15 * noise(j * 7 + 3, t * 0.7) ** 2 + 6 * hit) * (Math.abs(j - 3) > 2 ? 0.6 : 1) * k;
        const tip = { x: touch.x + Math.cos(dir) * L, y: touch.y + Math.sin(dir) * L };
        const bp = path(touch, tip, j * 31, 0.3, 8, 2.2);
        stroke(bp, 0.32, 0.6 * k);
        const m = 4, sx = bp[2 * m], sy = bp[2 * m + 1], sd = dir + (j % 2 ? 0.7 : -0.7);   // een zijtakje halverwege
        stroke(path({ x: sx, y: sy }, { x: sx + Math.cos(sd) * L * 0.45, y: sy + Math.sin(sd) * L * 0.45 }, j * 17, 0.3, 5, 2.4), 0.26, 0.4 * k);
      }
      dot(touch.x, touch.y, 7, (0.22 + 0.2 * hit) * k);   // contactpunt
      dot(touch.x, touch.y, 2.4, 0.55 * k);
    }
    for (const h of hair) {
      const th = h.base + 0.8 * Math.sin(t * 0.05 * h.k + h.ph), e = edge(th);
      const end = { x: C.x + (e.x - C.x) * h.len, y: C.y + (e.y - C.y) * h.len };
      stroke(path(C, end, h.seed, 0.22, 30, 0.8, bend), 0.45, 0.3 * (0.75 + 0.25 * noise(h.seed, t * 3)) * (1 - 0.5 * touch.divert));
    }
    dot(C.x, C.y, 15, 0.42 + 0.18 * glow);   // elektrode
    dot(C.x, C.y, 4.5, 0.8);
  }

  function initGL() {
    gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const ap = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uE', 'uRes', 'uS', 'uCen', 'uT', 'uC0', 'uC1', 'uC2', 'uC3', 'uC4']) loc[n] = gl.getUniformLocation(prog, n);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function paint() {
    if (!gl) return;
    const s = cv.width / W;
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ec);
    gl.uniform1i(loc.uE, 0);
    gl.uniform2f(loc.uRes, cv.width, cv.height);
    gl.uniform1f(loc.uS, BEAD * s);
    gl.uniform2f(loc.uCen, C.x * s, C.y * s);
    gl.uniform1f(loc.uT, t);
    const c = ramp?.() || DEFAULT;
    ['uC0', 'uC1', 'uC2', 'uC3', 'uC4'].forEach((n, i) => gl.uniform3fv(loc[n], c[i]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return {
    own: true,
    onDark: true,   // de plaat vult het vak: lichte keuzerij erboven
    init() { setup(); },
    mount(el) {
      if (cv) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv = document.createElement('canvas');
      cv.className = 'panel-canvas';
      cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      el.append(cv);
      initGL();
      eg.setTransform(1, 0, 0, 1, 0, 0); eg.fillStyle = '#000'; eg.fillRect(0, 0, EW, EH);
      lastNow = 0;
      if (reducedMotion.matches) { t = 12; simulate(0); for (let i = 0; i < 4; i++) drawEnergy(); paint(); }
    },
    unmount() { cv?.remove(); cv = null; gl = null; prog = null; tex = null; loc = {}; },
    frame(now) {
      if (!cv || reducedMotion.matches) return;
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 1 / 60;
      lastNow = now;
      simulate(dt); drawEnergy(); paint();
    },
    move(p) { ptr.x = p.x; ptr.y = p.y; ptr.on = inside(p); },
    drag(p) { ptr.x = p.x; ptr.y = p.y; ptr.on = inside(p); },
    down(p) { ptr.x = p.x; ptr.y = p.y; ptr.on = inside(p); ptr.down = ptr.on; },
    up() { ptr.down = false; },
    tap(p) { if (inside(p)) { touch.x = p.x; touch.y = p.y; touch.until = t + 0.45; } },
    leave() { ptr.on = false; ptr.down = false; },
    recolor() {},
  };
}
