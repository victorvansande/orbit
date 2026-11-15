/* ---- Kleurkiezer in stippen ---- */
// Naar "color-picker-sliders" van ascii-magic.com in de look "dots" (Victor, 15/11/2026), eigen code.
// Links een vlak van verzadiging (breed) en licht (hoog) in stippen, eronder een tintstrook; rechts het staal, de
// hexcode en schuiven voor R, G en B; onderaan recente kleuren. Alles beweegt samen: slepen in het vlak, op de strook
// of op een schuif zet de kleur; tik op het staal bewaart ze bij de recente, tik op een recente kiest ze terug.
// Wie niets doet, ziet de kleur na een poos zelf rustig verschuiven.

import { CELL, clamp, hsl, label } from './dots.js';

const DIM = [0.2, 0.22, 0.27];
const STOPS = [0.58, 0.95, 0.12, 0.33];
const toHex = c => '#' + c.map(v => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
function toHsl([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [null, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

export function createPicker({ cols, rows }) {
  // opbouw in vakjes; het rechterpaneel heeft een vaste breedte, het vlak krijgt de rest
  const PW = 30, fx = 3, fy = 9, fw = Math.max(16, cols - PW - fx - 4), fh = Math.max(10, rows - fy - 15);
  const hy = fy + fh + 3, rx = fx + fw + 4, rw = cols - rx - 3;
  const sw = { x: rx, y: fy, w: rw, h: 8 };
  const sl = ['R', 'G', 'B'].map((n, i) => ({ n, i, y: fy + 18 + i * 5, x: rx + 3, w: rw - 3 }));
  const ry = rows - 4;
  let h = 0.58, s = 0.7, l = 0.55, idle = 0, grab = null, hold = 0;
  let recent = [[0.0, 0.7, 0.55], [0.12, 0.8, 0.6], [0.33, 0.55, 0.5], [0.55, 0.6, 0.55], [0.72, 0.5, 0.6], [0.88, 0.65, 0.58]];
  const rgb = () => hsl(h, s, l);
  const cellOf = p => [p.x / CELL, p.y / CELL];
  function hit(p) {
    const [x, y] = cellOf(p);
    if (x >= fx - 1 && x <= fx + fw && y >= fy - 1 && y <= fy + fh) return 'field';
    if (x >= fx - 1 && x <= fx + fw && y >= hy - 2 && y <= hy + 3) return 'hue';
    for (const k of sl) if (x >= k.x - 3 && x <= k.x + k.w + 1 && Math.abs(y - k.y) <= 2) return k;
    return null;
  }
  function set(p) {
    const [x, y] = cellOf(p);
    idle = 0;
    if (grab === 'field') { s = clamp((x - fx) / (fw - 1)); l = clamp(0.95 - (y - fy) / (fh - 1) * 0.9); }
    else if (grab === 'hue') h = clamp((x - fx) / fw, 0, 0.999);
    else if (grab) {
      const c = rgb(); c[grab.i] = clamp((x - grab.x) / (grab.w - 1));
      const [nh, ns, nl] = toHsl(c);
      if (nh !== null) h = nh;
      s = ns; l = nl;
    }
  }
  return {
    still: 0,
    step(dt, t) {
      idle += dt;
      if (idle < 5 || grab) { hold = t; return; }
      // na een poos zonder aanraken: tint verschuift met rust tussen de stops, verzadiging en licht ademen mee
      const k = Math.min(1, (idle - 5) / 3), lt = (t - hold) / 4, si = Math.floor(lt) % 4, f = lt - Math.floor(lt);
      const e = f < 0.4 ? 0 : f > 0.85 ? 1 : (f - 0.4) / 0.45, ee = e * e * (3 - 2 * e);
      let a = STOPS[si], b = STOPS[(si + 1) % 4];
      if (Math.abs(b - a) > 0.5) b += b < a ? 1 : -1;
      const th = ((a + (b - a) * ee) % 1 + 1) % 1;
      let dh = th - h; if (dh > 0.5) dh -= 1; if (dh < -0.5) dh += 1;
      h = ((h + dh * k * Math.min(1, dt * 3)) % 1 + 1) % 1;
      s += (0.6 + 0.3 * Math.sin(t * 0.5) - s) * k * dt;
      l += (0.55 + 0.12 * Math.sin(t * 0.7 + 1) - l) * k * dt;
    },
    frame(grid) {
      const c = rgb();
      // vlak: verzadiging naar rechts, licht naar boven
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) grid.set(fx + x, fy + y, hsl(h, x / (fw - 1), 0.95 - y / (fh - 1) * 0.9));
      // tintstrook en haar wijzer (een gat erboven en eronder)
      for (let x = 0; x < fw; x++) for (let y = 0; y < 2; y++) grid.set(fx + x, hy + y, hsl(x / fw, 0.8, 0.58), 0.95);
      // staal: vol, met rechts drie trappen naar het donker
      for (let y = 0; y < sw.h; y++) for (let x = 0; x < sw.w; x++) {
        const tail = x - (sw.w - 5);
        grid.set(sw.x + x, sw.y + y, c, tail < 0 ? 1 : [0.75, 0.55, 0.38, 0.24, 0.14][tail]);
      }
      // schuiven: gevuld deel in de kleur van het kanaal en de keuze, de rest klein en grijs
      for (const k of sl) {
        const v = c[k.i], kx = Math.round(v * (k.w - 1));
        const tone = [0, 0, 0]; tone[k.i] = 1;
        for (let x = 0; x < k.w; x++) grid.set(k.x + x, k.y, x <= kx ? [0.35 + tone[0] * 0.6, 0.35 + tone[1] * 0.6, 0.35 + tone[2] * 0.6] : DIM, x <= kx ? 0.62 : 0.4);
      }
      // recente kleuren
      recent.forEach(([rh, rs, rl], i) => { for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) grid.set(fx + 9 + i * 6 + x, ry - 1 + y, hsl(rh, rs, rl), 0.95); });
    },
    overlay(g) {
      const c = rgb(), C = CELL;
      // wijzer in het vlak: een ring
      const px = (fx + s * (fw - 1) + 0.5) * C, py = (fy + (0.95 - l) / 0.9 * (fh - 1) + 0.5) * C;
      g.lineWidth = 1.5; g.strokeStyle = '#0A0C13'; g.beginPath(); g.arc(px, py, 6, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 1; g.strokeStyle = 'rgba(240,244,250,.95)'; g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.stroke();
      // wijzer op de strook: twee driehoekjes
      const hx = (fx + h * fw) * C;
      g.fillStyle = 'rgba(240,244,250,.9)';
      for (const [y, d] of [[hy * C - 3, -1], [(hy + 2) * C + 3, 1]]) { g.beginPath(); g.moveTo(hx, y); g.lineTo(hx - 3, y + d * 4); g.lineTo(hx + 3, y + d * 4); g.fill(); }
      // knoppen op de schuiven en de waarden
      for (const k of sl) {
        const v = c[k.i], kx = (k.x + v * (k.w - 1) + 0.5) * C, ky = (k.y + 0.5) * C;
        g.fillStyle = 'rgba(240,244,250,.95)'; g.beginPath(); g.arc(kx, ky, 3.2, 0, Math.PI * 2); g.fill();
        label(g, k.n, rx * C, ky + 3);
        label(g, String(Math.round(v * 255)), (rx + rw) * C, ky - 5, { align: 'right', alpha: 0.75 });
      }
      label(g, toHex(c), rx * C, (fy + 13) * C, { alpha: 0.9, size: 11 });
      label(g, 'RECENT', fx * C, (ry + 1.5) * C + 3);
      label(g, `hsl ${Math.round(h * 360)} ${Math.round(s * 100)} ${Math.round(l * 100)}`, (rx + rw) * C, (ry + 1.5) * C + 3, { align: 'right', alpha: 0.4 });
    },
    down(p) { grab = hit(p); if (grab) set(p); },
    drag(p) { if (grab) set(p); },
    up() { grab = null; },
    leave() { grab = null; },
    tap(p) {
      const [x, y] = cellOf(p);
      idle = 0;
      if (x >= sw.x && x <= sw.x + sw.w && y >= sw.y && y <= sw.y + sw.h) { recent = [[h, s, l], ...recent].slice(0, 6); return; }
      if (y >= ry - 2 && y <= ry + 3) {
        const i = Math.floor((x - fx - 9) / 6);
        if (i >= 0 && i < recent.length && (x - fx - 9) % 6 < 5) [h, s, l] = recent[i];
        return;
      }
      grab = hit(p); if (grab) set(p); grab = null;
    },
  };
}
