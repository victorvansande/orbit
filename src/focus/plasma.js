/* ---- Plasma in het bakje van de focusmodus ---- */
// Een plasmaplaat zoals op de foto's van Victor (08/11/2026): ontladingen van een elektrode in het midden naar de rand,
// opgevangen door duizenden glazen bolletjes. Die bolletjes zijn een zeshoekig raster van punten, het motief van Orbit
// (kern, zandloper). De ontladingen kronkelen traag langs vaste ruis (geen zenuwachtig trillen), met zijtakjes die opkomen
// en doven. Een vinger of de muis trekt ze naar zich toe; ingedrukt houden trekt ze allemaal samen, een tik geeft een flits.
// Twee vormen via het pijltje onder het bakje: Schijf en Plaat. Kleur uit de kleurkiezer, anders rood naar amber.
// Tekenen: de ontladingen als grijswaarden op een klein 2D-canvas (energie), daarna in WebGL per bolletje gekleurd.

const W = 325.6, H = 226.8;
const EW = 326, EH = 227;            // energie op schermresolutie (CSS-pixels); de bolletjes lezen per bolletje één waarde
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
uniform float uRad;     // straal van de schijf in pixels (0 = plaat over het hele vak)
uniform float uGlow;    // hoeveel er gloeit, voor de rand
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
  float R = uRad > 0.0 ? uRad : length(uRes) * 0.5;
  float gas = (0.17 + 0.16 * exp(-r / (R * 0.5))) * (0.62 + 0.76 * vn(c / (uS * 14.0) + vec2(uT * 0.03, -uT * 0.02)));
  float lit = max(e, gas) * (0.82 + 0.3 * (1.0 - d * d));
  float body = 1.0 - smoothstep(0.62, 1.0, d);                    // het bolletje
  float spec = (1.0 - smoothstep(0.0, 0.42, length(g / (uS * 0.5) - vec2(-0.28, -0.32)))) * 0.35;   // glans op het glas
  vec3 gap = uC0 * 0.55;
  vec3 col = mix(gap, ramp(lit), body) + uC4 * spec * clamp(e, 0.0, 1.0) * body;
  col = mix(col, ramp(line), clamp(line - 0.85, 0.0, 1.0) * 0.35);   // de kern van een ontlading leest ook tussen de bolletjes
  float alpha = 1.0;
  if (uRad > 0.0) {
    float inside = 1.0 - smoothstep(uRad - 1.0, uRad + 0.5, r);
    float rimW = uS * 2.4;
    float rim = smoothstep(uRad - 0.5, uRad + 1.0, r) * (1.0 - smoothstep(uRad + rimW - 1.0, uRad + rimW, r));
    vec3 rimCol = mix(uC1, uC2, 0.35 + 0.4 * uGlow);
    col = mix(rimCol, col, inside);
    alpha = max(inside, rim * 0.94);
  } else {
    float v = smoothstep(0.0, uS * 6.0, min(min(p.x, uRes.x - p.x), min(p.y, uRes.y - p.y)));
    col *= 0.6 + 0.4 * v;
  }
  gl_FragColor = vec4(col * alpha, alpha);
}`;

export function createPlasma({ reducedMotion, ramp, names = ['Schijf', 'Plaat'], onPreset }) {
  let preset = 0;
  let cv = null, gl = null, prog = null, tex = null, loc = {};
  const ec = document.createElement('canvas'); ec.width = EW; ec.height = EH;
  const eg = ec.getContext('2d');
  const C = { x: W / 2, y: H / 2 };
  let fil = [], hair = [], t = 0, lastNow = 0, strike = -9, glow = 0;
  const ptr = { x: 0, y: 0, on: false, down: false, pull: 0 };

  const radius = () => H / 2 - 13;
  // punt op de rand in richting th
  function edge(th) {
    const dx = Math.cos(th), dy = Math.sin(th);
    if (preset === 0) { const R = radius() - 1.5; return { x: C.x + dx * R, y: C.y + dy * R }; }
    const ix = (W / 2 - 2) / Math.abs(dx || 1e-6), iy = (H / 2 - 2) / Math.abs(dy || 1e-6), k = Math.min(ix, iy);
    return { x: C.x + dx * k, y: C.y + dy * k };
  }
  const inside = p => preset === 0 ? Math.hypot(p.x - C.x, p.y - C.y) < radius() : (p.x > 2 && p.x < W - 2 && p.y > 2 && p.y < H - 2);

  function branch() {
    return { s: rnd(0.22, 0.86), len: rnd(0.1, 0.32), ang: rnd(0.35, 0.95) * (Math.random() < 0.5 ? -1 : 1), born: t - rnd(0, 2), life: rnd(0.9, 2.6), seed: rnd(0, 999) };
  }
  function setup() {
    const n = preset === 0 ? 9 : 11;
    fil = Array.from({ length: n }, (_, i) => ({
      base: (i / n) * Math.PI * 2 + rnd(-0.25, 0.25),
      ph1: rnd(0, 99), ph2: rnd(0, 99), k1: rnd(0.6, 1.2), k2: rnd(0.8, 1.6),
      seed: rnd(0, 999), bright: rnd(0.78, 1), pull: 0, out: 1,
      br: Array.from({ length: 3 }, branch),
    }));
    // fijne draadjes: zwak en dun, zoals het web op de derde foto; ze volgen niet de vinger
    hair = Array.from({ length: preset === 0 ? 8 : 12 }, (_, i) => ({ base: rnd(0, Math.PI * 2), ph: rnd(0, 99), k: rnd(0.5, 1.3), seed: rnd(0, 999), len: rnd(0.55, 1) }));
    onPreset?.(preset, names.length, names[preset]);
  }

  // pad van a naar b, kronkelend langs de ruis (amp = deel van de lengte), terug als lijst punten
  function path(a, b, seed, amp, n, speed) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const out = new Float32Array((n + 1) * 2);
    for (let i = 0; i <= n; i++) {
      const s = i / n, env = Math.pow(Math.sin(Math.PI * s), 0.7);
      const o = noise(seed + s * 2.2, t * 0.22 * speed) + 0.5 * noise(seed + 40 + s * 5.3, t * 0.45 * speed)
        + 0.28 * noise(seed + 80 + s * 11, t * 0.8 * speed) + 0.16 * noise(seed + 120 + s * 24, t * 1.5 * speed);
      const off = o * amp * L * env;
      out[2 * i] = a.x + dx * s + nx * off; out[2 * i + 1] = a.y + dy * s + ny * off;
    }
    return out;
  }
  function stroke(pts, w, k) {
    eg.beginPath(); eg.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) eg.lineTo(pts[i], pts[i + 1]);
    // drie lagen: brede gloed, halo, kern (grijswaarden; de kleur komt in de shader)
    eg.lineWidth = 16 * w; eg.strokeStyle = `rgba(255,255,255,${0.04 * k})`; eg.stroke();
    eg.lineWidth = 6 * w; eg.strokeStyle = `rgba(255,255,255,${0.1 * k})`; eg.stroke();
    eg.lineWidth = 2.2 * w; eg.strokeStyle = `rgba(255,255,255,${0.22 * k})`; eg.stroke();
    eg.lineWidth = 1 * w; eg.strokeStyle = `rgba(255,255,255,${0.42 * k})`; eg.stroke();
  }
  const dot = (x, y, r, k) => {
    const gr = eg.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(255,255,255,${k})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    eg.fillStyle = gr; eg.fillRect(x - r, y - r, 2 * r, 2 * r);
  };

  function simulate(dt) {
    t += dt;
    const flash = Math.max(0, 1 - (t - strike) / 0.7);
    const target = ptr.on ? (ptr.down ? 1 : 0.6) : 0;
    ptr.pull += (Math.max(target, flash) - ptr.pull) * (1 - Math.exp(-dt * 6));
    const pa = Math.atan2(ptr.y - C.y, ptr.x - C.x);
    let sum = 0;
    for (const f of fil) {
      f.th = f.base + 0.55 * Math.sin(t * 0.07 * f.k1 + f.ph1) + 0.3 * Math.sin(t * 0.13 * f.k2 + f.ph2);
      // aantrekking: wie dicht bij de vinger draait, buigt ernaartoe; ingedrukt of bij een tik ook de verdere
      const dA = Math.atan2(Math.sin(pa - f.th), Math.cos(pa - f.th));
      const width = ptr.down || flash > 0 ? 2.2 : 0.95;
      const want = ptr.pull * Math.exp(-((dA / width) ** 2));
      f.pull += (want - f.pull) * (1 - Math.exp(-dt * 5));
      // af en toe dooft een ontlading even en slaat ze op een nieuwe plek opnieuw in
      if (f.out < 1) f.out = Math.min(1, f.out + dt * 5);
      else if (Math.random() < dt * 0.05) { f.out = -0.4; f.seed = rnd(0, 999); f.base += rnd(-0.6, 0.6); }
      for (let i = 0; i < f.br.length; i++) if (t - f.br[i].born > f.br[i].life) f.br[i] = { ...branch(), born: t };
      sum += f.pull;
    }
    glow += ((0.35 + 0.4 * sum / fil.length + 0.3 * flash) - glow) * (1 - Math.exp(-dt * 3));
  }

  function drawEnergy() {
    eg.setTransform(EW / W, 0, 0, EH / H, 0, 0);
    eg.globalCompositeOperation = 'source-over';
    eg.fillStyle = 'rgba(0,0,0,0.6)'; eg.fillRect(0, 0, W, H);   // nagloed: wat er net was, dooft in enkele beelden
    eg.globalCompositeOperation = 'lighter';
    eg.lineCap = 'round'; eg.lineJoin = 'round';
    const flash = Math.max(0, 1 - (t - strike) / 0.7);
    for (const f of fil) {
      if (f.out <= 0) continue;
      const e0 = edge(f.th), k = f.pull;
      const end = { x: e0.x + (ptr.x - e0.x) * k, y: e0.y + (ptr.y - e0.y) * k };
      const flick = 0.9 + 0.1 * noise(f.seed, t * 9);
      const I = f.bright * flick * f.out * (1 + 0.5 * f.pull + 0.6 * flash);
      const pts = path(C, end, f.seed, 0.16 * (1 - 0.35 * k), SEG, 1 + 0.6 * k);
      stroke(pts, 1 + 0.35 * f.pull, I);
      // zijtakjes: groeien uit een punt van de ontlading, dunner en zwakker, en doven weer
      for (const b of f.br) {
        const u = (t - b.born) / b.life; if (u < 0 || u > 1) continue;
        const live = Math.sin(Math.PI * u), i0 = Math.round(b.s * SEG);
        const px = pts[2 * i0], py = pts[2 * i0 + 1], dir = Math.atan2(end.y - C.y, end.x - C.x) + b.ang;
        const L = Math.hypot(end.x - C.x, end.y - C.y) * b.len * (0.6 + 0.4 * live);
        const bp = path({ x: px, y: py }, { x: px + Math.cos(dir) * L, y: py + Math.sin(dir) * L }, b.seed, 0.22, 12, 1.4);
        stroke(bp, 0.55, I * 0.55 * live);
      }
      // waar de ontlading het glas of de vinger raakt: een klein waaiertje
      const fan = 2 + Math.round(2 * f.pull);
      for (let j = 0; j < fan; j++) {
        const dir = Math.atan2(end.y - C.y, end.x - C.x) + (j - (fan - 1) / 2) * 0.55;
        const L = 5 + 7 * noise(f.seed + j * 7, t * 0.8 + j) ** 2 + 6 * f.pull;
        stroke(path(end, { x: end.x + Math.cos(dir) * L, y: end.y + Math.sin(dir) * L }, f.seed + j, 0.25, 6, 2), 0.4, I * 0.35);
      }
    }
    for (const h of hair) {
      const th = h.base + 0.8 * Math.sin(t * 0.05 * h.k + h.ph), e = edge(th);
      const end = { x: C.x + (e.x - C.x) * h.len, y: C.y + (e.y - C.y) * h.len };
      stroke(path(C, end, h.seed, 0.22, 30, 0.8), 0.45, 0.3 * (0.75 + 0.25 * noise(h.seed, t * 3)));
    }
    dot(C.x, C.y, 15, 0.42 + 0.18 * glow);   // elektrode
    dot(C.x, C.y, 4.5, 0.8);
    if (ptr.pull > 0.05 && inside(ptr)) dot(ptr.x, ptr.y, 16, 0.32 * ptr.pull);   // contactpunt
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
    for (const n of ['uE', 'uRes', 'uS', 'uCen', 'uRad', 'uGlow', 'uT', 'uC0', 'uC1', 'uC2', 'uC3', 'uC4']) loc[n] = gl.getUniformLocation(prog, n);
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
    gl.uniform1f(loc.uRad, preset === 0 ? radius() * s : 0);
    gl.uniform1f(loc.uGlow, glow);
    gl.uniform1f(loc.uT, t);
    const c = ramp?.() || DEFAULT;
    ['uC0', 'uC1', 'uC2', 'uC3', 'uC4'].forEach((n, i) => gl.uniform3fv(loc[n], c[i]));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return {
    own: true,
    get onDark() { return preset === 1; },   // de plaat vult het vak: lichte keuzerij erboven
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
    next(dir = 1) { preset = (preset + dir + names.length) % names.length; setup(); },
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
    tap(p) { if (inside(p)) { ptr.x = p.x; ptr.y = p.y; strike = t; } },
    leave() { ptr.on = false; ptr.down = false; },
    recolor() {},
  };
}
