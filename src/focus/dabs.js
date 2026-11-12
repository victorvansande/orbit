/* ---- Oud penseel: enkel nog voor de Japanse tuin ---- */
// Tijdelijk (12/11/2026): het paludarium schildert met het verfijnde penseel (brush.js); de tuin draait nog op deze
// eerste versie tot hij op dezelfde manier herschilderd is. Daarna verdwijnt dit bestand (ook uit SHELL in sw.js).
// Stijl S1 Penseel (gekozen door Victor, 12/11/2026, uit ontwerp/natuur/stijl.html): elke vorm krijgt een basiskleur
// en daarover honderden korte toetsen, lichter linksboven (lamp of zon) en donkerder rechtsonder, met een vleugje
// warm en koel in de toetsen. Schilderen is duur: tekenen in een laag of sprite die één keer gemaakt wordt, nooit per beeld.
// Elke kwast heeft een eigen zaadje, zodat hetzelfde beeld bij elke opbouw (andere maat, herladen) gelijk blijft.

const TAU = Math.PI * 2;
const LIGHT = '#fff2d2', SHADE = '#1c2433';

export const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const rgba = (h, a) => `rgba(${rgb(h).join(',')},${a})`;
export function mix(a, b, t) {
  const x = rgb(a), y = rgb(b), k = Math.max(0, Math.min(1, t));
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// een canvas om in te schilderen, op schaal (dpr x zoom), met de oorsprong op (ox, oy) in eigen eenheden
export function layer(w, h, scale, ox = 0, oy = 0) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w * scale)); cv.height = Math.max(1, Math.ceil(h * scale));
  const c = cv.getContext('2d');
  c.setTransform(scale, 0, 0, scale, ox * scale, oy * scale);
  return { cv, c, w, h, ox, oy };
}

export function createBrush(c, seed) {
  const q = rng(seed);
  const lit = (col, t) => mix(col, LIGHT, t), drk = (col, t) => mix(col, SHADE, t);
  // gesloten vloeiende vorm; een punt [x, y, 1] is een scherpe hoek
  function path(pts) {
    const n = pts.length, sharp0 = Boolean(pts[0][2]);
    if (sharp0) c.moveTo(pts[0][0], pts[0][1]); else c.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (let i = sharp0 ? 1 : 0; i <= n - (sharp0 ? 0 : 1); i++) {
      const a = pts[i % n], b = pts[(i + 1) % n];
      if (a[2]) c.lineTo(a[0], a[1]); else c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    c.closePath();
  }
  const box = pts => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; };
  function dab(x, y, col, a, rx, ry, ang) { c.fillStyle = rgba(col, a); c.beginPath(); c.ellipse(x, y, rx, ry, ang, 0, TAU); c.fill(); }

  return {
    q, lit, drk,
    // vlak (rots, oever, tak): basis plus toetsen, lichter linksboven
    area(pts, col, { shade = 0.6, dab: density = 1, dir = -0.5 } = {}) {
      const [x0, y0, x1, y1] = box(pts);
      c.beginPath(); path(pts); c.fillStyle = col; c.fill();
      c.save(); c.clip();
      const n = Math.min(1600, (x1 - x0) * (y1 - y0) / 7 * density);
      for (let i = 0; i < n; i++) {
        const x = x0 + q() * (x1 - x0), y = y0 + q() * (y1 - y0), u = (x - x0) / (x1 - x0 + 1), v = (y - y0) / (y1 - y0 + 1);
        const l = (1 - u) * 0.35 + (1 - v) * 0.65 + (q() - 0.5) * 0.3;
        let cc = l > 0.55 ? lit(col, (l - 0.55) * 0.8 * shade) : drk(col, (0.55 - l) * 0.7 * shade);
        cc = mix(cc, q() < 0.5 ? '#c9a86a' : '#4f6f7a', 0.07);
        dab(x, y, cc, 0.55, 1 + q() * 2.2, 0.6 + q(), dir + (q() - 0.5) * 0.6);
      }
      c.restore();
    },
    // gebladerte en mos: losse bollen die elk uit toetsen bestaan
    blobs(cx, cy, rx, ry, col, { n, r } = {}) {
      n = n || Math.max(4, Math.round(rx * ry / 28)); r = r || Math.min(rx, ry) * 0.5;
      const B = [];
      for (let i = 0; i < n; i++) { const a = q() * TAU, d = Math.sqrt(q()); B.push([cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, r * (0.6 + q() * 0.55)]); }
      B.sort((a, b) => b[1] - a[1]);
      for (const [x, y, rr] of B) {
        const l0 = (cx - x) / rx * 0.4 + (cy - y) / ry * 0.6;
        dab(x, y, drk(col, 0.25), 0.9, rr * 0.85, rr * 0.85, 0);
        for (let i = 0; i < rr * rr * 0.9; i++) {
          const a = q() * TAU, d = Math.sqrt(q()) * rr, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
          const l = l0 + (x - px) / rr * 0.25 + (y - py) / rr * 0.45 + (q() - 0.5) * 0.3;
          dab(px, py, l > 0 ? lit(col, l * 0.45) : drk(col, -l * 0.45), 0.7, 0.9 + q() * 1.6, 0.6 + q() * 0.8, q() * TAU);
        }
      }
    },
    // stengel, tak, wortel: van dik naar dun, in een paar losse halen
    line(pts, col, w0, w1 = w0) {
      const seg = (dx, dy, cc, a, sc, j) => {
        for (let i = 0; i < pts.length - 1; i++) {
          const t = i / (pts.length - 1);
          c.strokeStyle = rgba(cc, a); c.lineWidth = (w0 + (w1 - w0) * t) * sc;
          c.beginPath(); c.moveTo(pts[i][0] + dx + (q() - 0.5) * j, pts[i][1] + dy); c.lineTo(pts[i + 1][0] + dx + (q() - 0.5) * j, pts[i + 1][1] + dy); c.stroke();
        }
      };
      c.lineCap = 'round';
      seg(0, 0, drk(col, 0.2), 0.9, 1, 0);
      for (let k = 0; k < 3; k++) seg((q() - 0.5) * w0 * 0.4, (q() - 0.5) * w0 * 0.4, k ? lit(col, 0.15 * k) : col, 0.6, 0.55, 0.6);
    },
    // één blad: spoelvorm met een paar lichte toetsen, desgewenst een nerf
    leaf(x, y, len, wd, ang, col, { vein = false } = {}) {
      const ca = Math.cos(ang), sa = Math.sin(ang), tx = x + ca * len, ty = y + sa * len, mx = (x + tx) / 2, my = (y + ty) / 2, nx = -sa * wd, ny = ca * wd;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx + nx, my + ny, tx, ty); c.quadraticCurveTo(mx - nx, my - ny, x, y);
      c.fillStyle = drk(col, 0.1); c.fill();
      for (let i = 0; i < 3; i++) { const u = 0.3 + q() * 0.5; dab(x + ca * len * u, y + sa * len * u, lit(col, 0.15 + q() * 0.2), 0.6, len * 0.14, wd * 0.35, ang); }
      if (vein) { c.strokeStyle = rgba(lit(col, 0.55), 0.7); c.lineWidth = 0.35; c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke(); }
    },
    wash(x0, y0, x1, y1, top, bot) { const gr = c.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, top); gr.addColorStop(1, bot); c.fillStyle = gr; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
    // doek: fijne lichte en donkere streepjes, zodat grote vlakken niet glad zijn
    canvas(x0, y0, x1, y1, n = 2200) { for (let i = 0; i < n; i++) { c.fillStyle = q() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'; c.fillRect(x0 + q() * (x1 - x0), y0 + q() * (y1 - y0), 1.2, 0.5); } },
  };
}
