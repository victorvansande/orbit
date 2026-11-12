/* ---- Licht voor de natuurvensters: klok, lichtkaart, vlekkenlicht ---- */
// Victor (12/11/2026): "gezelligere verlichting, zeker 's avonds als het donker is". Het geschilderde beeld is de kleur
// van de dingen in vol licht; een kleine lichtkaart (halve resolutie, zacht opgeschaald) vermenigvuldigt dat beeld:
// omgevingslicht als grondkleur, lampen als warme plekken die uitdoven met de afstand. Zo verlicht een lantaarn of een
// vuurvliegje echt wat ernaast staat, in plaats van een blauwe waas over alles. Geen blur, geen stralen.

import { noise } from './brush.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// zon op en onder volgens de dag van het jaar (Vlaanderen: 5:30 tot 22:00 in juni, 8:45 tot 16:40 in december)
export function daylight(d = new Date()) {
  const doy = (d - new Date(d.getFullYear(), 0, 0)) / 864e5, c = Math.cos(TAU * (doy - 172) / 365);
  const rise = 7.1 - 1.6 * c, set = 19.35 + 2.65 * c, h = d.getHours() + d.getMinutes() / 60;
  const light = clamp(Math.min((h - rise + 0.6) / 1.2, (set + 0.6 - h) / 1.2), 0, 1);
  const warm = Math.max(Math.exp(-(((h - rise) / 0.9) ** 2)), Math.exp(-(((h - set) / 0.9) ** 2)));
  const night = ((h - set + 24) % 24) / (24 - (set - rise));
  return { light, warm, sun: clamp((h - rise) / (set - rise), 0, 1), moon: clamp(night, 0, 1), h, rise, set };
}

// de maan volgens de echte schijngestalte (Victor, 12/11/2026): phase 0 = nieuwe maan, 0,5 = volle maan; lit = verlicht
// deel van de schijf; up = waar ze aan de hemel staat (0 = komt op, 1 = gaat onder, -1 = onder de horizon). Opkomst
// benaderd: de maan staat het hoogst om 12 uur plus een etmaal maal de fase (nieuwe maan 's middags, volle om middernacht).
export function moon(d = new Date()) {
  const syn = 29.530588853, phase = ((((d - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % syn) + syn) % syn / syn;
  const h = d.getHours() + d.getMinutes() / 60, since = (((h - (6 + 24 * phase)) % 24) + 24) % 24;
  return { phase, lit: (1 - Math.cos(phase * TAU)) / 2, up: since < 12 ? since / 12 : -1 };
}

// lichtkaart over een vlak van w x h eenheden
export function createLight(w, h, res = 0.5) {
  const cv = document.createElement('canvas'); cv.width = Math.ceil(w * res); cv.height = Math.ceil(h * res);
  const c = cv.getContext('2d');
  let tmp = null;
  // vlekkenlicht (zon door blad): zachte lichte plekken op een donkerdere grond, herhaalbaar
  const dap = document.createElement('canvas'); dap.width = dap.height = 96;
  { const d = dap.getContext('2d'), im = d.createImageData(96, 96), nz = noise(31);
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
      // naadloos: ruis op een torus (vier hoeken gemengd)
      const u = x / 96, v = y / 96, f = (a, b) => nz(a * 5, b * 5, 3);
      const n = f(u, v) * (1 - u) * (1 - v) + f(u - 1, v) * u * (1 - v) + f(u, v - 1) * (1 - u) * v + f(u - 1, v - 1) * u * v;
      const s = clamp((n - 0.42) / 0.16, 0, 1), k = s * s * (3 - 2 * s), i = (y * 96 + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = 0; im.data[i + 3] = Math.round(255 * (1 - k));
    }
    d.putImageData(im, 0, 0); }
  return {
    cv,
    // begin met het omgevingslicht (rgb 0 tot 1)
    begin([r, g, b]) { c.setTransform(res, 0, 0, res, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.fillStyle = `rgb(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0})`; c.fillRect(0, 0, w, h); },
    // lichtplek: telt op bij wat er al is; `ry` maakt er een ovaal van (plas licht op de grond)
    spot(x, y, r, [cr, cg, cb], a = 1, ry = r) {
      c.save(); c.globalCompositeOperation = 'lighter'; c.translate(x, y); c.scale(1, ry / r);
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, r), col = k => `rgba(${cr * 255 | 0},${cg * 255 | 0},${cb * 255 | 0},${a * k})`;
      gr.addColorStop(0, col(1)); gr.addColorStop(0.25, col(0.62)); gr.addColorStop(0.55, col(0.24)); gr.addColorStop(1, col(0));
      c.fillStyle = gr; c.fillRect(-r, -r, r * 2, r * 2); c.restore();
    },
    // schaduwvlekken (blad, lichtspel op zand) binnen een rechthoek, schuivend met (dx, dy); a = diepte van de schaduw.
    // Twee lagen van verschillende maat die tegen elkaar in schuiven: één laag herhaalt zichtbaar (Victor, 12/11/2026:
    // "een herhalend patroon op de bodem dat de immersion breekt"), twee samen niet. sx, sy = maat van één tegel.
    dapple(x0, y0, x1, y1, dx, dy, a, sx = 190, sy = sx) {
      c.save(); c.globalCompositeOperation = 'source-over'; c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip(); c.globalAlpha = a * 0.62;
      for (const [w, h, ox, oy] of [[sx, sy, dx, dy], [sx * 0.647, sy * 0.71, -dx * 0.73 + sx * 0.31, dy * 1.3 + sy * 0.43]]) {
        const fx = ((ox % w) + w) % w - w, fy = ((oy % h) + h) % h - h;
        for (let y = y0 + fy; y < y1; y += h) for (let x = x0 + fx; x < x1; x += w) c.drawImage(dap, x, y, w, h);
      }
      c.restore();
    },
    // verloop van boven naar onder dat het licht tempert (dieper = donkerder), kleur als rgba-tekst
    shade(x0, y0, x1, y1, top, bot) { c.globalCompositeOperation = 'source-over'; const gr = c.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, top); gr.addColorStop(1, bot); c.fillStyle = gr; c.fillRect(x0, y0, x1 - x0, y1 - y0); },
    // leg de kaart over het beeld: elke pixel maal het licht op die plek
    apply(g) { g.save(); g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, w, h); g.restore(); },
    // idem, maar enkel over wat al getekend is (de lucht komt er daarna achter met 'destination-over'): de kaart
    // wordt eerst op het beeld geknipt, want vermenigvuldigen kleurt anders ook de lege plekken
    applyDrawn(g) {
      const src = g.canvas;
      if (!tmp || tmp.width !== src.width || tmp.height !== src.height) { tmp = document.createElement('canvas'); tmp.width = src.width; tmp.height = src.height; }
      const tc = tmp.getContext('2d');
      tc.globalCompositeOperation = 'copy'; tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high'; tc.drawImage(cv, 0, 0, src.width, src.height);
      tc.globalCompositeOperation = 'destination-in'; tc.drawImage(src, 0, 0);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.drawImage(tmp, 0, 0); g.restore();
    },
  };
}
