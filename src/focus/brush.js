/* ---- Penseel: geschilderde vormen voor de natuurvensters in het bakje ---- */
// Stijl S1 Penseel (gekozen door Victor, 12/11/2026, uit ontwerp/natuur/stijl.html): elke vorm krijgt een basiskleur
// en daarover korte toetsen, lichter waar het licht valt (linksboven), donkerder en koeler in de schaduw.
// Verfijnd op 12/11/2026 (Victor: "nog te sterk een typisch vibecoded look"): blad per blad met een lichte en een
// donkere helft en een nerf, mos als kussens van stippen, rots met vlakken en barsten, hout als taps lint met schors,
// ruis voor natuurlijke vlekken in plaats van egale willekeur. Licht is warm geel, schaduw koel blauwgroen.
// Schilderen is duur: tekenen in een laag of sprite die één keer gemaakt wordt, nooit per beeld.
// Elke kwast heeft een eigen zaadje, zodat hetzelfde beeld bij elke opbouw (andere maat, herladen) gelijk blijft.

const TAU = Math.PI * 2;
const LIGHT = '#fff0c4', SHADE = '#101c28';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const rgba = (h, a) => `rgba(${rgb(h).join(',')},${a})`;
export function mix(a, b, t) {
  const x = rgb(a), y = rgb(b), k = clamp(t, 0, 1);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}
// licht en schaduw op een kleur: l van -1 (diepe schaduw, koel) tot 1 (vol licht, warm)
export const tone = (col, l) => (l >= 0 ? mix(col, LIGHT, l * 0.62) : mix(col, SHADE, -l * 0.8));
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
// waardenruis, 0 tot 1, met octaven: voor vlekken, randen en wind
export function noise(seed) {
  const r = rng(seed), P = new Uint8Array(512), V = new Float32Array(256);
  for (let i = 0; i < 256; i++) { P[i] = i; V[i] = r(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)), t = P[i]; P[i] = P[j]; P[j] = t; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const at = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const h = (i, j) => V[P[P[(xi + i) & 255] + ((yi + j) & 255)]];
    const a = h(0, 0), b = h(1, 0), c = h(0, 1), d = h(1, 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, oct = 1) => { let s = 0, a = 1, f = 1, n = 0; for (let o = 0; o < oct; o++) { s += at(x * f, y * f) * a; n += a; a *= 0.5; f *= 2; } return s / n; };
}

// een canvas om in te schilderen, op schaal (dpr x zoom), met de oorsprong op (ox, oy) in eigen eenheden
export function layer(w, h, scale, ox = 0, oy = 0) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w * scale)); cv.height = Math.max(1, Math.ceil(h * scale));
  const c = cv.getContext('2d');
  c.setTransform(scale, 0, 0, scale, ox * scale, oy * scale);
  return { cv, c, w, h, ox, oy };
}
// vloeiende lijn door punten (Catmull-Rom), opnieuw bemonsterd om de `step` eenheden: [x, y, hoek]
export function spline(pts, step = 2) {
  const out = [], P = i => pts[clamp(i, 0, pts.length - 1)];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = P(i - 1), b = P(i), c = P(i + 1), d = P(i + 2), n = Math.max(1, Math.round(Math.hypot(c[0] - b[0], c[1] - b[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = j => 0.5 * (2 * b[j] + (c[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t2 + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * t3);
      out.push([f(0), f(1), 0]);
    }
  }
  out.push([pts[pts.length - 1][0], pts[pts.length - 1][1], 0]);
  for (let i = 0; i < out.length; i++) { const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)]; out[i][2] = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  return out;
}
// gesloten vloeiende vorm; een punt [x, y, 1] is een scherpe hoek
export function smooth(c, pts) {
  const n = pts.length, sharp0 = Boolean(pts[0][2]);
  if (sharp0) c.moveTo(pts[0][0], pts[0][1]); else c.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
  for (let i = sharp0 ? 1 : 0; i <= n - (sharp0 ? 0 : 1); i++) {
    const a = pts[i % n], b = pts[(i + 1) % n];
    if (a[2]) c.lineTo(a[0], a[1]); else c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  c.closePath();
}
const box = pts => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; };

// bladvormen in eigen assen: voet op (0, 0), top op (len, 0), halve breedte wd; `side` 0 = heel, 1 of -1 = één helft
function leafShape(c, len, wd, kind, side) {
  const s = side || 1;
  c.moveTo(0, 0);
  if (kind === 'heart') { c.bezierCurveTo(-len * 0.16, -wd * 1.25 * s, len * 0.45, -wd * 1.15 * s, len, 0); if (!side) c.bezierCurveTo(len * 0.45, wd * 1.15, -len * 0.16, wd * 1.25, 0, 0); }
  else if (kind === 'round') { c.bezierCurveTo(len * 0.05, -wd * 1.3 * s, len * 0.85, -wd * 1.2 * s, len, 0); if (!side) c.bezierCurveTo(len * 0.85, wd * 1.2, len * 0.05, wd * 1.3, 0, 0); }
  else if (kind === 'strap') { c.bezierCurveTo(len * 0.2, -wd * s, len * 0.7, -wd * 0.9 * s, len, 0); if (!side) c.bezierCurveTo(len * 0.7, wd * 0.9, len * 0.2, wd, 0, 0); }
  else { c.quadraticCurveTo(len * 0.42, -wd * 1.5 * s, len, 0); if (!side) c.quadraticCurveTo(len * 0.42, wd * 1.5, 0, 0); }
  if (side) c.closePath();
}

export function createBrush(c, seed) {
  const q = rng(seed), nz = noise(seed + 7);
  function dab(x, y, col, a, rx, ry, ang) { c.fillStyle = rgba(col, a); c.beginPath(); c.ellipse(x, y, rx, ry, ang, 0, TAU); c.fill(); }

  const B = {
    q, nz, tone, dab,
    // vlak (grond, muur, oever): basis plus toetsen; lum(u, v) geeft het licht, anders lichter linksboven
    area(pts, col, { shade = 0.6, dab: density = 1, dir = -0.5, lum = null, size = 1, warm = 0.07, max = 2600 } = {}) {
      const [x0, y0, x1, y1] = box(pts);
      c.beginPath(); smooth(c, pts); c.fillStyle = col; c.fill();
      c.save(); c.clip();
      const n = Math.min(max, (x1 - x0) * (y1 - y0) / 7 * density);
      for (let i = 0; i < n; i++) {
        const x = x0 + q() * (x1 - x0), y = y0 + q() * (y1 - y0), u = (x - x0) / (x1 - x0 + 1), v = (y - y0) / (y1 - y0 + 1);
        const l = (lum ? lum(u, v, x, y) : (1 - u) * 0.35 + (1 - v) * 0.65 - 0.55) + (nz(x * 0.09, y * 0.09, 2) - 0.5) * 0.7 + (q() - 0.5) * 0.2;
        const cc = mix(tone(col, l * shade), q() < 0.5 ? '#c9a86a' : '#3f6f7a', warm);
        dab(x, y, cc, 0.55, (1 + q() * 2.2) * size, (0.6 + q()) * size, (typeof dir === 'function' ? dir(x, y) : dir) + (q() - 0.5) * 0.6);
      }
      c.restore();
    },
    // kei: eigen volume (licht boven, donker en koel onder), fijne vlakjes, korstmos, een enkele barst, lichte bovenrand
    rock(pts, col, { shade = 1, wet = 0, cracks = 1 } = {}) {
      const [x0, y0, x1, y1] = box(pts), w = x1 - x0, h = y1 - y0;
      c.beginPath(); smooth(c, pts); c.fillStyle = tone(col, -0.12); c.fill();
      c.save(); c.clip();
      const n = Math.min(1400, w * h / 9);
      for (let i = 0; i < n; i++) {
        const x = x0 + q() * w, y = y0 + q() * h, u = (x - x0) / w, v = (y - y0) / h, s = 1 + q() * 2.6;
        const l = (0.42 - v) * 1.25 + (0.45 - u) * 0.4 + (nz(x * 0.06, y * 0.06, 3) - 0.5) * 0.9;
        const a = (nz(x * 0.025 + 9, y * 0.025, 2) - 0.5) * 2 - 0.3;
        c.fillStyle = rgba(mix(tone(col, l * shade * 0.7), q() < 0.5 ? '#8a6f4a' : '#4a6a72', 0.1), 0.42);
        c.beginPath(); c.ellipse(x, y, s * 1.5, s * 0.75, a, 0, TAU); c.fill();
      }
      for (let i = 0; i < w * h / 40; i++) { const x = x0 + q() * w, y = y0 + q() * h; if (nz(x * 0.1 + 4, y * 0.1) < 0.56) continue; dab(x, y, q() < 0.6 ? '#a8a890' : '#7a8a5a', 0.3, 0.4 + q() * 0.6, 0.3 + q() * 0.4, q() * TAU); }
      for (let i = 0; i < w * h / 1500 * cracks; i++) {
        let x = x0 + (0.15 + q() * 0.7) * w, y = y0 + (0.15 + q() * 0.5) * h, a = 0.6 + q() * 1.4;
        c.strokeStyle = rgba(tone(col, -0.8), 0.45); c.lineWidth = 0.3 + q() * 0.3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y);
        for (let k = 0; k < 3 + q() * 4; k++) { a += (q() - 0.5) * 0.9; x += Math.cos(a) * 2.4; y += Math.sin(a) * 2.4; c.lineTo(x, y); }
        c.stroke();
      }
      const form = c.createLinearGradient(0, y0, 0, y1); form.addColorStop(0, 'rgba(255,240,196,.2)'); form.addColorStop(0.3, 'rgba(255,240,196,0)'); form.addColorStop(0.55, 'rgba(16,28,40,0)'); form.addColorStop(1, `rgba(12,20,30,${0.5 + 0.25 * wet})`);
      c.fillStyle = form; c.fillRect(x0, y0, w, h);
      const rim = c.createLinearGradient(0, y0, 0, y1); rim.addColorStop(0, 'rgba(255,244,214,.55)'); rim.addColorStop(0.4, 'rgba(255,244,214,0)'); rim.addColorStop(0.7, 'rgba(8,12,18,0)'); rim.addColorStop(1, 'rgba(8,12,18,.6)');
      c.strokeStyle = rim; c.lineWidth = 2.2; c.beginPath(); smooth(c, pts); c.stroke();
      c.restore();
    },
    // moskussen (ook struik, kruin, naaldkussen): grillige rand, donker van onderen, stippen die oplichten naar `lit`; `depth` < 1 maakt het vlakker (glooiing in een mosveld)
    moss(cx, cy, rx, ry, col, { dense = 1, fringe = true, l0 = 0, lit = '#c8d24a', depth = 1 } = {}) {
      const k = q() * 20, pts = [];
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, r = 0.82 + nz(Math.cos(a) * 1.4 + k, Math.sin(a) * 1.4 + k, 2) * 0.4; pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]); }
      c.beginPath(); smooth(c, pts); c.fillStyle = tone(col, -0.42 * depth + l0); c.fill();
      const n = rx * ry * 2.6 * dense;
      for (let i = 0; i < n; i++) {
        const a = q() * TAU, d = Math.sqrt(q()) * 0.96, nx = Math.cos(a) * d, ny = Math.sin(a) * d, x = cx + nx * rx, y = cy + ny * ry;
        const l = l0 + (-ny * 0.62 - nx * 0.22 + (nz(x * 0.3, y * 0.3) - 0.5) * 0.7 + (q() - 0.5) * 0.25 - 0.05) * depth;
        dab(x, y, mix(tone(col, l * 0.9), lit, l > 0.2 ? (l - 0.2) * 0.5 : 0), 0.85, 0.45 + q() * 0.7, 0.35 + q() * 0.45, q() * TAU);
      }
      if (fringe) { c.lineCap = 'round'; for (let i = 0; i < rx * 1.2; i++) { const u = q() * 2 - 1, x = cx + u * rx * 0.9, y = cy - Math.sqrt(Math.max(0, 1 - u * u)) * ry * 0.92; c.strokeStyle = rgba(tone(col, 0.25 + q() * 0.4 + l0), 0.8); c.lineWidth = 0.3; c.beginPath(); c.moveTo(x, y + 0.6); c.lineTo(x + (q() - 0.5) * 0.9, y - 0.5 - q() * 1.1); c.stroke(); } }
    },
    // hout: taps lint langs een vloeiende lijn, schors in halen langs de draad, licht bovenop, mos naar keuze
    branch(pts, col, w0, w1 = w0, { bark = 1 } = {}) {
      const S = spline(pts, 1.6), n = S.length, L = [], R = [];
      for (let i = 0; i < n; i++) { const [x, y, a] = S[i], w = (w0 + (w1 - w0) * (i / (n - 1))) * (0.9 + nz(i * 0.21, w0) * 0.25) / 2; L.push([x + Math.sin(a) * w, y - Math.cos(a) * w]); R.push([x - Math.sin(a) * w, y + Math.cos(a) * w]); }
      c.beginPath(); c.moveTo(...L[0]); L.forEach(p => c.lineTo(...p)); for (let i = n - 1; i >= 0; i--) c.lineTo(...R[i]); c.closePath(); c.fillStyle = tone(col, -0.3); c.fill();
      c.lineCap = 'round';
      for (let i = 0; i < n * w0 * 0.9 * bark; i++) {
        const k = Math.floor(q() * (n - 2)), u = q() * 2 - 1, [x, y, a] = S[k], w = (w0 + (w1 - w0) * (k / (n - 1))) / 2, up = -Math.cos(a) * u;   // up > 0: kant naar het licht
        const px = x + Math.sin(a) * w * u * 0.86, py = y - Math.cos(a) * w * u * 0.86, len = 1.5 + q() * 3.5;
        const l = up * 0.75 + (nz(k * 0.12, u * 3 + w0) - 0.5) * 0.9 - 0.1;
        c.strokeStyle = rgba(mix(tone(col, l * 0.8), '#a88a5a', l > 0.3 ? 0.2 : 0), 0.7); c.lineWidth = 0.3 + q() * 0.6 * Math.min(1, w / 3);
        c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a + (q() - 0.5) * 0.3) * len, py + Math.sin(a + (q() - 0.5) * 0.3) * len); c.stroke();
      }
      return S;
    },
    // dunne stengel of rank: één vloeiende haal met een lichte kant
    stem(pts, col, w0, w1 = w0) {
      const S = spline(pts, 1.5), n = S.length; c.lineCap = 'round';
      for (const [dx, cc, sc] of [[0, tone(col, -0.3), 1], [-0.25, tone(col, 0.25), 0.45]]) for (let i = 0; i < n - 1; i++) { c.strokeStyle = cc; c.lineWidth = (w0 + (w1 - w0) * (i / n)) * sc; c.beginPath(); c.moveTo(S[i][0] + dx * w0, S[i][1] + dx * w0); c.lineTo(S[i + 1][0] + dx * w0, S[i + 1][1] + dx * w0); c.stroke(); }
      return S;
    },
    // één blad: donkere en lichte helft, nerf; l = licht op dit blad
    leaf(x, y, len, wd, ang, col, { kind = 'lance', l = 0, vein = true, a = 1 } = {}) {
      c.save(); c.translate(x, y); c.rotate(ang); c.globalAlpha = a;
      const up = Math.cos(ang) > 0 ? -1 : 1;                 // welke helft naar boven (het licht) kijkt
      c.beginPath(); leafShape(c, len, wd, kind, 0); c.fillStyle = tone(col, l - 0.28); c.fill();
      c.beginPath(); leafShape(c, len, wd, kind, up); c.fillStyle = tone(col, l + 0.16); c.fill();
      if (vein && len > 3) { c.strokeStyle = rgba(tone(col, l + 0.55), 0.55); c.lineWidth = Math.min(0.5, len * 0.035); c.beginPath(); c.moveTo(len * 0.04, 0); c.lineTo(len * 0.92, 0); c.stroke(); }
      c.restore();
    },
    // toef bladeren rond een punt: achterste donkerder en koeler, voorste in het licht
    tuft(x, y, n, len, wd, col, { kind = 'lance', spread = TAU, a0 = -Math.PI / 2, jit = 0.3, l = 0, vein = true } = {}) {
      const L = [];
      for (let i = 0; i < n; i++) { const a = a0 + (i / Math.max(1, n - 1) - 0.5) * spread + (q() - 0.5) * jit; L.push([a, len * (0.7 + q() * 0.45), q()]); }
      L.sort((p, r) => p[2] - r[2]);
      L.forEach(([a, ll, z]) => B.leaf(x + Math.cos(a) * ll * 0.08, y + Math.sin(a) * ll * 0.08, ll, wd * (0.8 + q() * 0.4), a, mix(col, q() < 0.5 ? '#8ab03a' : '#2a5a48', 0.18 * q()), { kind, vein, l: l + (z - 0.6) * 0.7 - Math.sin(a) * 0.18 }));
    },
    // varenblad: gebogen nerf die doorhangt, smalle deelblaadjes die naar de top korter worden
    frond(x, y, len, a0, col, { bend = 0.03, droop = 0.012, pin = 8, wd = 1.5, l = 0 } = {}) {
      const pts = [[x, y]]; let a = a0, px = x, py = y; const dir = Math.cos(a0) >= 0 ? 1 : -1;
      for (let d = 0; d < len; d += 2) { a += dir * (bend + droop * d / len * 3); px += Math.cos(a) * 2; py += Math.sin(a) * 2; pts.push([px, py, a]); }
      const n = pts.length;
      for (let j = 2; j < n; j++) {
        const [xx, yy, ta] = pts[j], k = j / n, pl = pin * Math.sin(Math.PI * Math.min(1, k * 1.08 + 0.04)) ** 0.8 * (1 - k * 0.45);
        const ll = l + (0.5 - k) * 0.25 + (nz(j * 0.5, len) - 0.5) * 0.3;
        B.leaf(xx, yy, pl, wd, ta + 1.25 - k * 0.3, col, { l: ll - 0.2, vein: false });
        B.leaf(xx, yy, pl, wd, ta - 1.25 + k * 0.3, col, { l: ll + 0.12, vein: false });
      }
      c.lineCap = 'round'; c.strokeStyle = tone(col, l - 0.35); c.lineWidth = 0.7; c.beginPath(); pts.forEach(([xx, yy], i) => (i ? c.lineTo(xx, yy) : c.moveTo(xx, yy))); c.stroke();
      return pts;
    },
    // rank met blaadjes om en om langs een lijn
    vine(pts, col, { leaf: len = 5, wd = 2.2, kind = 'heart', every = 5, stem: sw = 0.6, l = 0, hang = 0.5 } = {}) {
      const S = B.stem(pts, mix(col, '#5a4a2a', 0.5), sw, sw * 0.5);
      for (let i = 2, side = 1; i < S.length - 1; i += Math.max(1, Math.round(every / 1.5 * (0.7 + q() * 0.6))), side = -side) {
        const [x, y, a] = S[i], la = a + side * (1.1 + q() * 0.5) * (1 - hang) + (Math.PI / 2 - a) * hang * 0.6 + side * hang * 0.5;
        B.leaf(x, y, len * (0.75 + q() * 0.5), wd * (0.8 + q() * 0.4), la, mix(col, q() < 0.5 ? '#8ab03a' : '#2a5a48', 0.2 * q()), { kind, l: l + (q() - 0.5) * 0.5 - Math.sin(la) * 0.15 });
      }
      return S;
    },
    wash(x0, y0, x1, y1, top, bot) { const gr = c.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, top); gr.addColorStop(1, bot); c.fillStyle = gr; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
    // doek: fijne lichte en donkere streepjes, zodat grote vlakken niet glad zijn
    canvas(x0, y0, x1, y1, n = 2200) { for (let i = 0; i < n; i++) { c.fillStyle = q() < 0.5 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)'; c.fillRect(x0 + q() * (x1 - x0), y0 + q() * (y1 - y0), 1.2, 0.5); } },
  };
  return B;
}
