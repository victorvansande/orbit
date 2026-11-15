/* ---- Kerstboom in tekens, in het bakje van de focusmodus ---- */
// Gekozen door Victor (15/11/2026, A1 Kleur uit ontwerp/ascii/, naar een schermopname van een reel "ASCII Christmas Tree").
// Een boom als wolk van ongeveer 13 000 punten die traag ronddraait; elk beeld wordt opnieuw omgezet naar tekens:
// per vakje wint het dichtste punt, zijn licht kiest het teken. Altijd een donker venster met volle kleur (zoals het
// Natuurvenster een uitzondering op "kleur enkel in de bollen"). De boom bouwt zich op in lagen: grond, stam, naalden,
// sneeuw, slinger, ballen, lichtjes, piek, pakjes. Slepen draait hem (met uitloop), een tik schudt de sneeuw van de
// takken (ze sneeuwt traag weer aan), een dubbeltik bouwt hem opnieuw op. Onderaan klein: draaihoek, lichtjes, tekens.
// Een groter bakje krijgt een grotere boom met meer tekens van dezelfde maat. Minder beweging: één beeld, afgewerkt.

import { LANG } from '../core/i18n.js';

const TAU = Math.PI * 2;
const en = LANG === 'en';
const WORDS = en ? ['LIGHTS', 'CHARACTERS'] : ['LICHTJES', 'TEKENS'];

/* ---------- model: één boom, één keer gebouwd (vaste seed) ---------- */
const NEEDLE = 0, SNOW = 1, TRUNK = 2, GARLAND = 3, BALL = 4, LIGHT = 5, STAR = 6, GIFT = 7, RIBBON = 8;
let M = null;
function build() {
  let a = 7; const r = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const gs = () => (r() + r() + r() - 1.5) * 1.15;
  const P = [];   // x y z nx ny nz kind variant birth phase
  const add = (x, y, z, nx, ny, nz, kind, variant, birth) => { const l = Math.hypot(nx, ny, nz) || 1; P.push(x, y, z, nx / l, ny / l, nz / l, kind, variant, birth, r()); };
  const Y0 = 0.22, Y1 = 2.0, env = y => 0.03 + 0.8 * Math.pow(1 - Math.min(1, Math.max(0, (y - Y0) / (Y1 - Y0))), 1.08);
  // stam
  for (let i = 0; i < 140; i++) { const an = r() * TAU, y = r() * 0.34; add(Math.cos(an) * 0.05, y, Math.sin(an) * 0.05, Math.cos(an), 0.1, Math.sin(an), TRUNK, 0, 0.3 + y); }
  // naalden: kransen van afhangende takken, dichter aan de top van elke tak; sneeuw op de buitenste helft
  for (let i = 0; i < 26; i++) {
    const y = Y0 + 0.02 + (Y1 - Y0 - 0.06) * i / 25, R = env(y), f = (y - Y0) / (Y1 - Y0), nb = Math.floor(7 + 11 * (1 - f));
    for (let b = 0; b < nb; b++) {
      const an = TAU * b / nb + i * 0.618 * TAU + gs() * 0.12, L = R * (i % 2 ? 0.72 : 0.9) * (0.86 + 0.3 * r()), n = Math.floor(10 + 64 * L);
      for (let k = 0; k < n; k++) {
        const s = Math.pow(r(), 0.65), sp = 0.03 + 0.1 * s, rad = Math.max(0.01, s * L + gs() * sp * 0.4), aa = an + gs() * sp / Math.max(0.1, s * L) * 0.55;
        const yy = y + 0.07 * s * L - 0.22 * (s * L) ** 2 + gs() * sp * 0.45, snow = s > 0.42 && r() < 0.17;
        add(Math.cos(aa) * rad, yy + (snow ? 0.014 : 0), Math.sin(aa) * rad, Math.cos(aa) * 0.75, snow ? 1.4 : 0.55, Math.sin(aa) * 0.75, snow ? SNOW : NEEDLE, 0, snow ? 4.2 + r() * 1.3 : 0.5 + 3.2 * f + r() * 0.5);
      }
    }
  }
  // slinger: spiraal met doorhangende bogen
  for (let i = 0; i < 760; i++) { const t = i / 760, an = 6.5 * TAU * t, y = 0.36 + 1.46 * t - 0.03 * Math.abs(Math.sin(an * 3)), R = env(y) * 0.97; add(Math.cos(an) * R, y, Math.sin(an) * R, Math.cos(an), 0.3, Math.sin(an), GARLAND, 0, 5.2 + 1.5 * (1 - t)); }
  // ballen: kleine bollen aan de rand van de boom
  for (let i = 0; i < 26; i++) {
    const y = 0.3 + 1.4 * r(), an = r() * TAU, R = env(y) * 0.96, cx = Math.cos(an) * R, cz = Math.sin(an) * R, rad = 0.042 + 0.014 * r();
    for (let k = 0; k < 46; k++) { const u = r() * 2 - 1, v = r() * TAU, q = Math.sqrt(1 - u * u); add(cx + q * Math.cos(v) * rad, y - 0.05 + u * rad, cz + q * Math.sin(v) * rad, q * Math.cos(v), u, q * Math.sin(v), BALL, i % 5, 6.8 + i * 0.07); }
  }
  // lichtjes
  for (let i = 0; i < 170; i++) { const y = 0.26 + 1.66 * r(), an = r() * TAU, R = env(y) * (0.86 + 0.14 * r()); add(Math.cos(an) * R, y, Math.sin(an) * R, 0, 1, 0, LIGHT, 0, 8.8 + i / 170 * 1.6); }
  // piek: stralen langs de drie assen
  for (let i = 0; i < 90; i++) { const ax = i % 3, d = (r() * 2 - 1) * (ax === 1 ? 0.13 : 0.1), v = [0, 0, 0]; v[ax] = d; add(v[0], 2.07 + v[1], v[2], 0, 1, 0, STAR, 0, 10.6); }
  // pakjes: dozen met een lint
  [[0.5, 0.2, 0.15, 0], [2.3, 0.15, 0.2, 1], [4.1, 0.24, 0.13, 2], [5.4, 0.13, 0.11, 3]].forEach(([an, w, hh, vr], gi) => {
    const R = 0.9 + 0.04 * gi, cx = Math.cos(an) * R, cz = Math.sin(an) * R, c = Math.cos(an * 2.3), s = Math.sin(an * 2.3);
    for (let k = 0; k < 420; k++) {
      const face = k % 5, u = r() * 2 - 1, v = r() * 2 - 1;
      let p, nn;
      if (face === 0) { p = [u * w, hh * 2, v * w]; nn = [0, 1, 0]; }
      else { const sg = face < 3 ? 1 : -1; p = face % 2 ? [sg * w, (v + 1) * hh, u * w] : [u * w, (v + 1) * hh, sg * w]; nn = face % 2 ? [sg, 0, 0] : [0, 0, sg]; }
      const rib = Math.abs(u) < 0.17 || (face === 0 && Math.abs(v) < 0.17);
      add(cx + p[0] * c - p[2] * s, p[1], cz + p[0] * s + p[2] * c, nn[0] * c - nn[2] * s, nn[1], nn[0] * s + nn[2] * c, rib ? RIBBON : GIFT, vr, 11.2 + gi * 0.3);
    }
  });
  return { P: new Float32Array(P), N: P.length / 10 };
}

/* ---------- tekenen in tekens ---------- */
const CW = 3.3, CH = 5.5;                       // vakje van één teken
const TILT = 0.22, ST = Math.sin(TILT), CT = Math.cos(TILT), RG = 1.75;   // kanteling van de blik, straal van de grond
const LX = -0.48, LY = 0.66, LZ = 0.58;         // licht van linksboven vooraan
const RAMP = ' .:-=+*#%@', TOP = RAMP.length - 1;
const GROUND = 20, PATCH = 21, FLAKE = 22;      // soorten die geen punt van het model zijn
const BG = '#0A0C13';
const COLORS = { [NEEDLE]: [78, 150, 92], [SNOW]: [236, 240, 244], [TRUNK]: [128, 92, 66], [GARLAND]: [232, 194, 96], [LIGHT]: [255, 220, 150], [STAR]: [255, 232, 160], [RIBBON]: [238, 232, 214], [GROUND]: [112, 122, 156], [PATCH]: [206, 211, 222], [FLAKE]: [196, 203, 222] };
const BALLS = [[226, 62, 62], [236, 190, 84], [92, 124, 232], [226, 62, 62], [236, 190, 84]];
const GIFTS = [[96, 116, 226], [214, 70, 70], [84, 160, 110], [226, 180, 90]];
const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
const BASE_SPIN = 0.33, DOUBLE = 0.32;

// kleur per soort en helderheid (vier trappen), één keer berekend
const STYLES = [];
function style(kind, variant, lvl) {
  const key = kind * 40 + variant * 4 + lvl;
  if (!STYLES[key]) {
    const col = kind === BALL ? BALLS[variant] : kind === GIFT ? GIFTS[variant] : COLORS[kind];
    const al = kind === GROUND ? 0.3 + 0.12 * lvl : kind === LIGHT || kind === STAR ? 0.55 + 0.15 * lvl : 0.5 + 0.17 * lvl;
    STYLES[key] = `rgba(${col.join(',')},${al.toFixed(2)})`;
  }
  return key;
}

export function createTree({ reducedMotion, size }) {
  const W = size?.w || 325.6, H = size?.h || 226.8, K = Math.min(W / 325.6, H / 226.8);
  const COLS = Math.ceil(W / CW), ROWS = Math.ceil(H / CH), CELLS = COLS * ROWS;
  const SC = 72 * K, CX = W / 2, GY = H - 36 * K;      // schaal, midden, hoogte van de grond onder de stam
  const own = new Int32Array(CELLS), zb = new Float32Array(CELLS), chr = new Uint8Array(CELLS), sty = new Uint16Array(CELLS);
  let birth = null, flakes = [], fall = [];
  let cv = null, g = null, dpr = 1, lastNow = 0;
  let clock = 0, t = 0, ang = 0.6, om = BASE_SPIN, lights = 0, count = 0;
  let grab = null, tapWait = -1;

  function rebuild() {
    if (!M) M = build();
    if (!birth) birth = new Float32Array(M.N);
    for (let i = 0; i < M.N; i++) birth[i] = M.P[i * 10 + 8];
    clock = 0; fall = [];
  }
  function put(i, kind, variant, a) {
    chr[i] = Math.max(1, Math.min(TOP, Math.round(a * TOP)));
    sty[i] = style(kind, variant, Math.min(3, Math.floor(a * 4)));
  }
  function render() {
    if (!g || !M) return;
    const cs = Math.cos(ang), sn = Math.sin(ang), P = M.P;
    own.fill(-1); zb.fill(-1e9); chr.fill(0);
    // grond: schijf in strepen, met een sneeuwplek onder de boom; het patroon draait mee
    const grow = Math.min(1, clock / 0.9) * RG;
    for (let row = 0; row < ROWS; row++) {
      const zr = ((row + 0.5) * CH - GY) / (SC * ST);
      if (Math.abs(zr) > grow) continue;
      for (let col = 0; col < COLS; col++) {
        const xr = ((col + 0.5) * CW - CX) / SC, rr = Math.hypot(xr, zr);
        if (rr > grow) continue;
        const mx = xr * cs + zr * sn, mz = -xr * sn + zr * cs, n = hash(Math.floor(mx * 16), Math.floor(mz * 16)), i = row * COLS + col;
        if (rr < 0.92 + n * 0.22 && clock > 0.9) put(i, PATCH, 0, 0.5 + 0.5 * n);
        else put(i, GROUND, 0, (0.25 + 0.5 * (1 - rr / RG)) * (row % 2 ? 1 : 0.75));
      }
    }
    // vallende sneeuw, achter de boom
    const flake = f => {
      const col = Math.floor(f.x / CW), row = Math.floor(f.y / CH);
      if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return;
      const i = row * COLS + col;
      if (!chr[i]) { chr[i] = f.v > 30 ? 2 : 1; sty[i] = style(FLAKE, 0, 2); }
    };
    flakes.forEach(flake); fall.forEach(flake);
    // punten: het dichtste punt per vakje wint; lichtjes en piek krijgen wat voorsprong
    lights = 0;
    for (let k = 0; k < M.N; k++) {
      if (clock < birth[k]) continue;
      const o = k * 10, kind = P[o + 6], xr = P[o] * cs - P[o + 2] * sn, zr = P[o] * sn + P[o + 2] * cs, y = P[o + 1];
      if (kind === LIGHT) lights++;
      const col = Math.floor((CX + xr * SC) / CW), row = Math.floor((GY - (y * CT - zr * ST) * SC) / CH);
      if (col < 0 || row < 0 || col >= COLS || row >= ROWS) continue;
      const i = row * COLS + col, dp = zr * CT + y * ST + (kind === LIGHT || kind === STAR ? 0.22 : 0);
      if (dp > zb[i]) { zb[i] = dp; own[i] = k; }
    }
    count = 0;
    for (let i = 0; i < CELLS; i++) {
      const k = own[i];
      if (k >= 0) {
        const o = k * 10, kind = P[o + 6], nx = P[o + 3] * cs - P[o + 5] * sn, nz = P[o + 3] * sn + P[o + 5] * cs, zr = P[o] * sn + P[o + 2] * cs;
        let b = (0.3 + 0.7 * Math.max(0, nx * LX + P[o + 4] * LY + nz * LZ)) * (0.78 + 0.22 * Math.min(1, Math.max(0, (zr + 0.9) / 1.8)));
        if (kind === LIGHT) b = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(P[o + 9] * TAU + t * (1.5 + P[o + 9] * 3)));
        if (kind === STAR) b = 0.85 + 0.15 * Math.sin(t * 3 + P[o + 9] * TAU);
        put(i, kind, P[o + 7], b);
      }
      if (chr[i]) count++;
    }
    // tekenen, per stijl gebundeld
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = BG; g.fillRect(0, 0, W, H);
    g.font = `500 ${CH}px "Geist Mono", ui-monospace, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const groups = new Map();
    for (let i = 0; i < CELLS; i++) {
      if (!chr[i]) continue;
      let a = groups.get(sty[i]);
      if (!a) groups.set(sty[i], a = []);
      a.push(i);
    }
    for (const [key, list] of groups) {
      g.fillStyle = STYLES[key];
      for (const i of list) g.fillText(RAMP[chr[i]], (i % COLS + 0.5) * CW, (Math.floor(i / COLS) + 0.5) * CH);
    }
    // statusregel, met een rand in de achtergrondkleur zodat ze leesbaar blijft over de grond
    g.font = '500 9px "Geist Mono", ui-monospace, monospace'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    try { g.letterSpacing = '1.3px'; } catch { /* oudere browser */ }
    const deg = ((ang * 180 / Math.PI) % 360 + 360) % 360;
    const line = `${String(Math.round(deg) % 360).padStart(3, '0')}° · ${lights} ${WORDS[0]} · ${String(count).replace(/\B(?=(\d{3})+$)/g, ' ')} ${WORDS[1]}`;
    g.strokeStyle = BG; g.lineWidth = 7; g.lineJoin = 'round'; g.strokeText(line, 12, H - 11);
    g.fillStyle = 'rgba(214,220,236,.5)'; g.fillText(line, 12, H - 11);
    try { g.letterSpacing = '0px'; } catch { /* oudere browser */ }
  }
  // tik: de sneeuw valt van de takken en sneeuwt traag weer aan
  function shake() {
    const cs = Math.cos(ang), sn = Math.sin(ang), P = M.P;
    for (let k = 0; k < M.N; k++) {
      const o = k * 10;
      if (P[o + 6] !== SNOW || clock < birth[k]) continue;
      const xr = P[o] * cs - P[o + 2] * sn, zr = P[o] * sn + P[o + 2] * cs;
      if (fall.length < 420 && Math.random() < 0.4) fall.push({ x: CX + xr * SC, y: GY - (P[o + 1] * CT - zr * ST) * SC, v: 34 + Math.random() * 50, end: GY + zr * ST * SC });
      birth[k] = clock + 3 + Math.random() * 16;
    }
    om += (Math.random() < 0.5 ? -1 : 1) * 0.5;
  }

  return {
    own: true,
    onDark: true,
    init() { /* het model wordt pas gebouwd bij mount */ },
    mount(el) {
      if (cv) return;
      dpr = Math.min(3, window.devicePixelRatio || 1);
      cv = document.createElement('canvas');
      cv.className = 'panel-canvas'; cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      el.append(cv);
      g = cv.getContext('2d');
      flakes = Array.from({ length: Math.round(44 * W * H / 74000) }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 7 + Math.random() * 12, p: Math.random() * TAU }));
      rebuild();
      lastNow = 0; tapWait = -1; grab = null;
      if (reducedMotion.matches) { clock = 99; render(); document.fonts?.ready.then(render); }
    },
    unmount() { cv?.remove(); cv = null; g = null; grab = null; },
    frame(now) {
      if (!g || reducedMotion.matches) return;
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0;
      lastNow = now; t += dt; clock += dt;
      if (tapWait >= 0) { tapWait += dt; if (tapWait > DOUBLE) { tapWait = -1; shake(); } }
      if (!grab) { ang += om * dt; om += (BASE_SPIN - om) * Math.min(1, dt * 1.2); }
      for (const f of flakes) {
        f.y += f.v * dt; f.x += Math.sin(t * 0.8 + f.p) * 6 * dt;
        if (f.y > H) { f.y = -3; f.x = Math.random() * W; }
      }
      for (const f of fall) { f.y += f.v * dt; f.v += 60 * dt; }
      if (fall.length) fall = fall.filter(f => f.y < f.end);
      render();
    },
    down(p) { grab = { x: p.x, at: performance.now() }; },
    // slepen draait de boom; de laatste beweging geeft de uitloop
    drag(p) {
      if (!grab) return;
      const now = performance.now(), turn = (p.x - grab.x) * 0.011 / K, dt = Math.max(0.008, (now - grab.at) / 1000);
      ang += turn; om = Math.max(-6, Math.min(6, turn / dt));
      grab = { x: p.x, at: now };
    },
    up() { grab = null; },
    leave() { grab = null; },
    tap() {
      if (tapWait >= 0) { tapWait = -1; rebuild(); }   // dubbeltik: opnieuw opbouwen
      else tapWait = 0;
    },
  };
}
