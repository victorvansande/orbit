// Orbitje boven het venster Nieuwe taak, "B Horizon" (gekozen door Victor, 10/11/2026, uit A Miniatuur, B Horizon en
// C Schuin; artifact "Orbit nieuwe taak", bron ontwerp/toevoegen/index.html). De bovenrand van het venster is de
// horizon: halve stippelringen rijzen erboven op, de kern van rasterpunten met oogjes piept erboven uit als een
// opkomende zon. De komeet van het gekozen moment komt links op en gaat rechts onder, achter de rand. Voeg toe: hij
// duikt de kaart in en de kern kijkt blij. Het canvas ligt precies boven de kaart; zijn onderrand is de horizon.
import { LEVELS } from '../core/config.js';

const TAU = Math.PI * 2;
const PERIOD = [2.2, 3.4, 5, 7, 10];    // seconden per omloop, per moment (in het klein, dus sneller dan de scène)
const ABOVE = 0.8;                       // deel van de omloop boven de horizon; de rest gaat snel eronder door
const GLIDE_MS = 520, DIVE_MS = 420;
const STILL_ANGLE = Math.PI * 1.32;      // minder beweging: de komeet staat linksboven stil

const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const rgbOf = hex => { const n = parseInt(String(hex).trim().replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// canvas: het <canvas> boven de kaart; still(): minder beweging of Minimaal; colors(): { ink, tone, red } als hex
export function createHorizon(canvas, { still, colors }) {
  const g = canvas.getContext('2d');
  let raf = 0, last = 0, level = 1, from = 1, target = 1, switchAt = -1e9, angle = 0;
  let sendAt = 0, blinkAt = -9, nextBlink = 0;

  function fit() {
    const dpr = Math.min(2, devicePixelRatio || 1), w = canvas.clientWidth, h = canvas.clientHeight;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h, dpr };
  }

  // straal bij een (fractioneel) moment
  const ringAt = (f, s) => {
    const i = Math.max(0, Math.min(LEVELS.length - 2, Math.floor(f - 1))), u = f - 1 - i;
    return (LEVELS[i].ring + (LEVELS[i + 1].ring - LEVELS[i].ring) * u) * s;
  };

  // stippelring, enkel boven de horizon
  function ring(cx, cy, r, color, alpha) {
    const n = Math.max(12, Math.round(TAU * r / 6.2));
    g.fillStyle = rgba(color, alpha);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, y = cy + Math.sin(a) * r;
      if (y > cy - 1.5) continue;
      const x = cx + Math.cos(a) * r;
      g.moveTo(x + 0.95, y); g.arc(x, y, 0.95, 0, TAU);
    }
    g.fill();
  }

  // komeet: punten langs de baan (kop eerst), taps en uitdovend, effen kop, geen gloed
  function comet(pts, head, tone) {
    const n = pts.length / 2;
    const L = [], R = [];
    for (let k = 0; k < n; k++) {
      const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1);
      const dx = pts[2 * b] - pts[2 * a], dy = pts[2 * b + 1] - pts[2 * a + 1], len = Math.hypot(dx, dy) || 1;
      const w = head * 0.9 * (1 - k / (n - 1)) ** 1.15;
      L.push(pts[2 * k] - dy / len * w, pts[2 * k + 1] + dx / len * w);
      R.push(pts[2 * k] + dy / len * w, pts[2 * k + 1] - dx / len * w);
    }
    const f = g.createLinearGradient(pts[0], pts[1], pts[2 * n - 2], pts[2 * n - 1]);
    f.addColorStop(0, rgba(tone, 0.9)); f.addColorStop(0.5, rgba(tone, 0.35)); f.addColorStop(1, rgba(tone, 0));
    g.fillStyle = f;
    g.beginPath(); g.moveTo(L[0], L[1]);
    for (let k = 1; k < n; k++) g.lineTo(L[2 * k], L[2 * k + 1]);
    for (let k = n - 1; k >= 0; k--) g.lineTo(R[2 * k], R[2 * k + 1]);
    g.closePath(); g.fill();
    g.fillStyle = rgba(tone, 1);
    g.beginPath(); g.arc(pts[0], pts[1], head, 0, TAU); g.fill();
  }

  // kern: rasterpunten in ringen met een even aantal (spiegelbeeld), twee inktpillen als oogjes, hoog genoeg om
  // helemaal boven de horizon te staan. Ze worden nooit kleiner (Victor, 10/11/2026): enkel knipperen of blij.
  function core(cx, cy, R, look, happy, blink, ink, red, dpr) {
    const sp = R / (dpr >= 2 ? 7 : 5.8);
    const h = R * 0.3, gap = R * 0.36, ey = -R * 0.34, rw = h * 0.45, open = Math.max(0.12, 1 - blink);
    const eyes = [-gap, gap].map(ex => ({ ex, px: ex + look[0] * h * 0.4, py: ey + look[1] * h * 0.3 }));
    const inkAt = (x, y) => {
      let c = 0;
      for (const e of eyes) {
        if (happy) {
          const by = ey + h * 0.45, rad = h * 0.62;
          if (y > by + rad * 0.2) continue;
          c = Math.max(c, 1 - Math.abs(Math.hypot(x - e.ex, y - by) - rad) / (sp * 0.6));
        } else {
          const hl = h * 0.62 * open, yy = Math.max(e.py - hl, Math.min(e.py + hl, y));
          c = Math.max(c, 1 - (Math.hypot(x - e.px, y - yy) - rw) / (sp * 0.7));
        }
      }
      return Math.max(0, Math.min(1, c));
    };
    const paths = Array.from({ length: 9 }, () => []);
    for (let k = 0; k * sp <= R + 0.01; k++) {
      const r = k * sp, n = k ? Math.round(TAU * r / sp / 2) * 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + (k % 2 ? Math.PI / n : 0), x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (cy + y > cy - 1.5) continue;   // enkel boven de horizon
        const c = inkAt(x, y), u = r / R;
        paths[Math.round(c * 8)].push(cx + x, cy + y, sp * 0.34 * (0.35 + 0.75 * (1 - u) ** 0.7) * (1 + 0.25 * c));
      }
    }
    paths.forEach((list, i) => {
      if (!list.length) return;
      g.fillStyle = rgba(mix(red, ink, i / 8), 1);
      g.beginPath();
      for (let k = 0; k < list.length; k += 3) { g.moveTo(list[k] + list[k + 2], list[k + 1]); g.arc(list[k], list[k + 1], list[k + 2], 0, TAU); }
      g.fill();
    });
  }

  function draw(now) {
    const { w, h, dpr } = fit();
    g.clearRect(0, 0, w, h);
    if (!w || !h) return;
    const calm = still();
    const dt = Math.min(0.05, Math.max(0, (now - (last || now)) / 1000)); last = now;
    const k = calm ? 1 : smooth((now - switchAt) / GLIDE_MS);
    level = from + (target - from) * k;
    const sendK = sendAt ? (now - sendAt) / DIVE_MS : -1;   // -1: niet aan het toevoegen
    if (!calm) angle += dt / PERIOD[target - 1] * TAU * (sendK >= 0 && sendK < 1 ? 1 + 5 * sendK * sendK : 1);
    const t = now / 1000;
    if (!nextBlink) nextBlink = t + 2 + Math.random() * 2;
    if (!calm && t > nextBlink) { blinkAt = t; nextBlink = t + 2.6 + Math.random() * 3.4; }
    const b = (t - blinkAt) / 0.22, blink = b > 0 && b < 1 ? Math.sin(b * Math.PI) : 0;

    const c = colors(), ink = rgbOf(c.ink), tone = rgbOf(c.tone), red = rgbOf(c.red);
    const cx = w / 2, cy = h;   // de horizon is de onderrand van het canvas, dus de bovenrand van de kaart
    const s = Math.min((h - 10) / LEVELS[LEVELS.length - 1].ring, (w / 2 - 34) / LEVELS[LEVELS.length - 1].ring);
    for (const lv of LEVELS) {
      const on = Math.max(0, 1 - Math.abs(level - lv.id));
      ring(cx, cy, lv.ring * s, mix(ink, tone, on), 0.16 + 0.5 * on);
    }

    // 80 % van de omloop boven de rand (van links pi naar rechts 2 pi), de rest snel eronder door
    const p = ((angle % TAU) + TAU) % TAU / TAU;
    const a = calm ? STILL_ANGLE : p < ABOVE ? Math.PI + p / ABOVE * Math.PI : 2 * Math.PI + (p - ABOVE) / (1 - ABOVE) * Math.PI;
    const r = ringAt(level, s), dive = sendK >= 0 ? smooth(Math.min(1, sendK)) : 0;
    const span = Math.min(0.9, 34 / r), pts = [];
    for (let j = 0; j <= 14; j++) {
      const q = 1 - j / 14, aa = a - span * j / 14;
      pts.push(cx + Math.cos(aa) * r * (1 - dive * 0.6 * q), cy + Math.sin(aa) * r * (1 - dive * 0.6 * q) + dive * 70 * q);
    }
    const R = Math.max(18, Math.min(26, 26 * s / 0.79));
    const hx = pts[0] - cx, hy = pts[1] - (cy - R * 0.34), m = Math.hypot(hx, hy) || 1;
    const look = [hx / m * 0.9, Math.min(0.2, hy / m * 0.8)];
    g.save();
    g.beginPath(); g.rect(0, 0, w, cy - 1.5); g.clip();
    if (dive < 1) comet(pts, 4.6, tone);
    core(cx, cy, R, look, sendK >= 0 && sendK < 3, blink, ink, red, dpr);
    g.restore();
  }

  function loop(now) {
    draw(now);
    raf = still() ? 0 : requestAnimationFrame(loop);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }

  return {
    // venster gaat open op dit moment: komeet meteen op zijn baan, links op de horizon
    start(id) {
      level = from = target = id; switchAt = -1e9; sendAt = 0; last = 0;
      angle = PERIOD[id - 1] ? 0.04 * TAU : 0;
      cancelAnimationFrame(raf); raf = 0; kick();
    },
    // ander moment: de komeet glijdt naar zijn nieuwe baan, die ring licht op
    setLevel(id) {
      if (id === target) { kick(); return; }
      from = level; target = id; switchAt = performance.now(); kick();
    },
    // Voeg toe: hij duikt de kaart in; geeft terug hoe lang dat duurt (0 bij minder beweging)
    send() {
      if (still()) return 0;
      sendAt = performance.now(); kick();
      return DIVE_MS;
    },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
}
