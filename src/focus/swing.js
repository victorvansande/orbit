/* ---- Slinger in het bakje van de focusmodus ---- */
// Harmonograaf (Victor, 12/11/2026: "werk harmonograaf uit"; F2 uit ontwerp/fidgets/): vier gedempte slingers sturen
// één pen over een vel. Traag = meer inkt en een dikkere lijn, snel = ijl. De figuur dooft uit, blijft even liggen
// en maakt plaats voor een nieuwe. Slepen geeft een duw (de uitslag groeit), een tik legt een nieuw vel.
// Pijltje: Lissajous (hele verhoudingen), Rozet (bijna gelijke slingers), Riso (tweede pen in rood, iets verschoven).
// Het vel bewaart enkel dekking; de kleur komt er bij het tekenen op, dus thema en kleurkiezer kleuren de lijn mee.
// Minder beweging: één afgewerkte figuur, stilstaand.

import { LANG } from '../core/i18n.js';

const BASE_W = 325.6, BASE_H = 226.8;
const en = LANG === 'en';
const FORMS = en ? ['Lissajous', 'Rosette', 'Riso'] : ['Lissajous', 'Rozet', 'Riso'];
const RATIOS = [[2, 3], [3, 4], [1, 2], [3, 5], [2, 5]];
const STEP = 1 / 1500;     // vaste stap in slingertijd: dezelfde lijn op 60 en 120 Hz
const SPEED = 1.6;         // slingertijd per seconde
const FADE = 1.2, REST = 4;

export function createSwing({ reducedMotion, accent, onPreset, size }) {
  const W = size?.w || BASE_W, H = size?.h || BASE_H;
  const K = Math.min(W / BASE_W, H / BASE_H);       // groter bakje: grotere figuur, zelfde pen
  const CX = W / 2, CY = H / 2 + 6;                 // iets onder het midden: de keuzerij staat bovenaan
  let cv = null, g = null, dpr = 1, lastNow = 0;
  let sheets = [], tint = null;                     // vel voor de pen, vel voor de rode pen, mengvel
  let form = 0, P = null, t = 0, acc = 0, last = null, last2 = null, fade = 0, still = 0, ratio = '';
  let grab = null;
  let C = {}, colorsAt = -9e9;

  function colors(now) {
    if (now - colorsAt < 500 && C.ink) return C;
    colorsAt = now;
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue('--ink').trim() || '#1B1B22';
    C = {
      ink, pen: accent?.() || ink, core: cs.getPropertyValue('--core').trim() || '#E70049',
      well: (cv && getComputedStyle(cv.closest('.fidget') || cv).backgroundColor) || cs.getPropertyValue('--well').trim(),
    };
    return C;
  }
  const rgba = (hex, a) => {
    const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };

  function fresh() {
    const j = () => (Math.random() - 0.5) * 0.012;  // een fractie ernaast: de figuur loopt traag door
    const ph = () => Math.random() * Math.PI * 2;
    if (form === 1) {
      const b = 2 + Math.random();
      P = { f: [b + j(), b * 3 + j(), b + 0.008 + j(), b * 3 + j()], p: [0, ph(), Math.PI / 2, ph()], A: [58, 12, 58, 12], d: [0.03, 0.06, 0.03, 0.06] };
      ratio = '1 : 1';
    } else {
      const [a, b] = RATIOS[Math.random() * RATIOS.length | 0];
      P = { f: [a + j(), a * 2 + j(), b + j(), b * 2 + j()], p: [ph(), ph(), ph(), ph()], A: [56, 20, 44, 16], d: [0.035, 0.05, 0.04, 0.055] };
      ratio = `${a} : ${b}`;
    }
    t = 0; acc = 0; last = last2 = null; still = 0;
    for (const s of sheets) s.g.clearRect(0, 0, W, H);
  }
  const at = (time, lag = 0) => {
    const s = i => P.A[i] * K * Math.exp(-P.d[i] * time) * Math.sin(P.f[i] * (time - lag) + P.p[i]);
    return [CX + s(0) + s(1), CY + s(2) + s(3)];
  };
  // één stapje van de pen; de afstand per stap is haar snelheid
  function ink(o, from, to, a) {
    const v = Math.hypot(to[0] - from[0], to[1] - from[1]) / K * (0.04 / STEP / 60);
    o.strokeStyle = `rgba(0,0,0,${Math.min(0.85, a / (0.5 + v * 0.8))})`;
    o.lineWidth = Math.max(0.4, 1.05 - v * 0.12);
    o.beginPath(); o.moveTo(from[0], from[1]); o.lineTo(to[0], to[1]); o.stroke();
  }
  function advance(dt) {
    if (!sheets.length) return;
    acc += dt * SPEED;
    while (acc >= STEP) {
      acc -= STEP; t += STEP;
      const q = at(t);
      if (last) ink(sheets[0].g, last, q, 0.26);
      last = q;
      if (form === 2) {
        const q2 = at(t, 0.03); q2[0] += 0.9; q2[1] += 0.6;
        if (last2) ink(sheets[1].g, last2, q2, 0.2);
        last2 = q2;
      }
    }
  }
  const swing = () => (P.A[0] * Math.exp(-P.d[0] * t) + P.A[2] * Math.exp(-P.d[2] * t));

  function layer(sheet, color, alpha) {
    const o = tint.g;
    o.globalCompositeOperation = 'source-over';
    o.clearRect(0, 0, W, H);
    o.drawImage(sheet.cv, 0, 0, W, H);
    o.globalCompositeOperation = 'source-in';
    o.fillStyle = color; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'source-over';
    g.globalAlpha = alpha; g.drawImage(tint.cv, 0, 0, W, H); g.globalAlpha = 1;
  }
  function draw(now) {
    if (!g) return;
    const c = colors(now), show = 1 - fade;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = c.well; g.fillRect(0, 0, W, H);
    if (form === 2) layer(sheets[1], c.core, show);
    layer(sheets[0], c.pen, show);
    if (last && fade === 0 && !reducedMotion.matches) {
      g.fillStyle = rgba(c.pen, 0.9);
      g.beginPath(); g.arc(last[0], last[1], 1.7, 0, Math.PI * 2); g.fill();
    }
    g.font = '500 9px "Geist Mono", ui-monospace, monospace';
    try { g.letterSpacing = '1.3px'; } catch { /* oudere browser */ }
    g.fillStyle = rgba(c.ink, 0.42); g.textAlign = 'right';
    g.globalAlpha = show;
    g.fillText(`${ratio} · ${String(Math.round(t)).padStart(2, '0')} S`, W - 12, H - 11);
    g.globalAlpha = 1; g.textAlign = 'left';
    try { g.letterSpacing = '0px'; } catch { /* oudere browser */ }
  }

  const blank = () => {
    const c = document.createElement('canvas');
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const o = c.getContext('2d'); o.scale(dpr, dpr);
    return { cv: c, g: o };
  };

  return {
    own: true,
    init() { /* het vel bestaat pas bij mount */ },
    mount(el) {
      if (cv) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv = document.createElement('canvas');
      cv.className = 'panel-canvas'; cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      el.append(cv);
      g = cv.getContext('2d');
      sheets = [blank(), blank()]; tint = blank();
      lastNow = 0; fade = 0; colorsAt = -9e9;
      fresh();
      onPreset?.(form, FORMS.length, FORMS[form]);
      if (reducedMotion.matches) { for (let i = 0; i < 200; i++) advance(0.2); draw(performance.now()); }
    },
    unmount() { cv?.remove(); cv = null; g = null; sheets = []; tint = null; grab = null; },
    frame(now) {
      if (!g || reducedMotion.matches) return;
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0;
      lastNow = now;
      if (fade > 0) {
        fade += dt / FADE;
        if (fade >= 1) { fade = 0; fresh(); }
      } else {
        advance(dt);
        if (swing() < 8) { still += dt; if (still > REST) fade = 0.001; }
      }
      draw(now);
    },
    down(p) { grab = { x: p.x, y: p.y }; },
    // een duw: de uitslag groeit in de richting van je beweging
    drag(p) {
      if (!grab || !P || fade > 0) { grab = { x: p.x, y: p.y }; return; }
      const dx = Math.abs(p.x - grab.x) / K, dy = Math.abs(p.y - grab.y) / K;
      grab = { x: p.x, y: p.y };
      const e0 = Math.exp(P.d[0] * t), e2 = Math.exp(P.d[2] * t);
      P.A[0] = Math.min(72 * e0, P.A[0] + dx * 0.35 * e0);
      P.A[2] = Math.min(64 * e2, P.A[2] + dy * 0.35 * e2);
      still = 0;
    },
    up() { grab = null; },
    leave() { grab = null; },
    tap() { if (fade === 0) fade = 0.001; },
    recolor() { colorsAt = -9e9; },
    next(dir = 1) {
      form = (form + dir + FORMS.length) % FORMS.length;
      onPreset?.(form, FORMS.length, FORMS[form]);
      fade = 0;
      if (sheets.length) fresh();
      if (reducedMotion.matches && g) { for (let i = 0; i < 200; i++) advance(0.2); draw(performance.now()); }
    },
  };
}
