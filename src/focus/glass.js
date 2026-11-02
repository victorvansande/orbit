/* ---- Klein glas: de zandloper buiten de focus ---- */
// F (Victor, 02/11/2026, uit twee rondes voorstellen: "als ik een focus ben gestart met de zandloper en uit de fullscreen
// focus ga, moet er wel ergens blijven staan dat mijn timer loopt, in het klein"). Rechtsonder een glaasje van
// rasterpunten, dezelfde zandloper als in de focus maar klein, met zand dat zakt; een tik opent de focus. Gepauzeerd:
// stil, zonder vallende korrels. Klaar: fonkelt uit als de vierpuntige ster en verdwijnt.
// D1 op pc (Victor, 02/11/2026: "op pc ... wel heel minimal en klein"): groter glas met de resterende minuten als groot,
// dun cijfer (T3, zoals de zandloper in de focus op gsm), altijd zichtbaar; aanwijzen toont Pauze / Verder en ↺ ernaast.
// Op gsm blijft het glaasje met de tijd in Geist Mono. De maat van het glas komt uit de CSS (canvasmaat).
// Leest de toestand van de zandloper uit de opslag (timerState in timer.js), dus loopt mee met herladen en tabbladen.
import { timerState } from './timer.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// halve breedte van een bol (0..1) op hoogte u van de hals (0) naar de rand (1): ronde schouders
const shape = u => u < 0.62 ? Math.sin(u / 0.62 * Math.PI / 2) : Math.sqrt(Math.max(0, 1 - ((u - 0.62) / 0.4) ** 2));

export function createGlass(root, { reducedMotion, tx, onOpen, onToggle = () => {}, onReset = () => {} }) {
  const open = Object.assign(document.createElement('button'), { type: 'button', className: 'glass-open' });
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  const time = Object.assign(document.createElement('span'), { className: 'glass-time' });   // gsm: 08:57
  const min = Object.assign(document.createElement('span'), { className: 'glass-min' });     // pc: 16 MIN
  const minNum = document.createElement('span'), minUnit = document.createElement('small');
  min.append(minNum, minUnit);
  min.setAttribute('aria-hidden', 'true');
  open.append(time, min, cv);
  // pc: Pauze / Verder en ↺ verschijnen bij aanwijzen of toetsenbordfocus
  const tools = Object.assign(document.createElement('div'), { className: 'glass-tools' });
  const pause = Object.assign(document.createElement('button'), { type: 'button', className: 'glass-pause' });
  const reset = Object.assign(document.createElement('button'), { type: 'button', className: 'glass-reset', textContent: '↺' });
  reset.setAttribute('aria-label', tx('timer.reset')); reset.title = tx('timer.reset');
  tools.append(pause, reset);
  root.append(tools, open);
  const g = cv.getContext('2d');
  let raf = 0, running = false, shown = null, endAt = 0, ink = '27,27,34', colAt = 0, lastRead = 0, st = null, W = 28, H = 46;

  function colors(now) {
    if (now - colAt < 1000) return;
    colAt = now;
    g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#1B1B22';
    const h = g.fillStyle.slice(1);
    ink = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
  }
  function fit() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = cv.clientWidth || 28; H = cv.clientHeight || 46;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // rasterpunten: zand boven (q, van de hals omhoog gevuld) en onder (1 - q, van de bodem op), zachte rand naar de wand
  function drawGlass(q, live, now) {
    const sp = W > 30 ? 3.7 : 3.3, bulb = (H - 2) / 2, R = W / 2 - 1.5, cx = W / 2, cy = H / 2;
    for (let row = 0, y = 1 + sp / 2; y < H - 1; row++, y += sp * 0.866) {
      const up = y < cy, u = Math.abs(y - cy) / bulb, hw = 0.8 + (R - 0.8) * shape(u);
      for (let x = cx - Math.ceil(hw / sp) * sp + (row % 2) * sp / 2; x <= cx + hw; x += sp) {
        const dx = Math.abs(x - cx);
        if (dx > hw - 0.4) continue;
        const f = up ? smooth(-0.07, 0.07, q * 0.92 - u + 0.04) : smooth(-0.07, 0.07, (1 - q) * 0.92 - (1 - u) + 0.04);
        const edge = smooth(0, sp * 1.6, Math.min(hw - dx, up ? y - 1 : H - 1 - y));
        g.globalAlpha = (0.2 + 0.8 * f) * (0.35 + 0.65 * edge);
        g.beginPath(); g.arc(x, y, sp * (0.12 + 0.33 * f) * (0.6 + 0.4 * edge), 0, Math.PI * 2); g.fill();
      }
    }
    // een korreltje door de hals zolang het loopt
    if (live && q > 0.002 && !reducedMotion.matches) {
      const ph = (now / 420) % 1;
      g.globalAlpha = 0.85 * (1 - ph);
      g.beginPath(); g.arc(cx, cy + ph * bulb * 0.75, W > 30 ? 0.95 : 0.75, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  }
  // klaar: de vierpuntige ster zwelt op, draait een kwartslag en krimpt tot niets
  function star(p) {
    const r = Math.min(W, H) * 0.32 * (p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7), rot = p * Math.PI / 2, cx = W / 2, cy = H / 2;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = rot + i * Math.PI / 2, b = a + Math.PI / 4, c = a + Math.PI / 2;
      if (i === 0) g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.quadraticCurveTo(cx + Math.cos(b) * r * 0.18, cy + Math.sin(b) * r * 0.18, cx + Math.cos(c) * r, cy + Math.sin(c) * r);
    }
    g.fill();
  }

  const fmt = ms => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  function setShown(on) {
    if (on === shown) return;
    shown = on;
    root.classList.toggle('is-on', on);
    for (const b of [open, pause, reset]) b.tabIndex = on ? 0 : -1;
    root.setAttribute('aria-hidden', String(!on));
  }

  function frame(now) {
    if (!running) return;
    if (now - lastRead > 250) { st = timerState(); lastRead = now; }
    const left = st.endAt ? Math.max(0, st.endAt - Date.now()) : st.left, total = st.dur * 60000;
    const active = !st.done && (st.endAt > 0 || (left > 0 && left < total));
    if (active) {
      endAt = 0;
      setShown(true);
      colors(now); fit();
      g.clearRect(0, 0, W, H); g.fillStyle = `rgb(${ink})`;
      drawGlass(left / total, st.endAt > 0, now);
      const txt = fmt(left);
      if (time.textContent !== txt) {
        time.textContent = txt;
        minNum.textContent = String(left >= 60000 ? Math.ceil(left / 60000) : Math.ceil(left / 1000));
        minUnit.textContent = left >= 60000 ? 'min' : 's';
      }
      open.setAttribute('aria-label', tx(st.endAt ? 'glass.running' : 'glass.paused', { time: txt }));
      const p = tx(st.endAt ? 'timer.pause' : 'timer.resume');
      if (pause.textContent !== p) pause.textContent = p;
      root.classList.toggle('is-paused', !st.endAt);
    } else if (shown) {
      // net klaar terwijl het glaasje in beeld stond: fonkelen en weg; anders gewoon weg
      if (st.done && !reducedMotion.matches) {
        if (!endAt) endAt = now;
        const p = (now - endAt) / 1100;
        colors(now); fit(); g.clearRect(0, 0, W, H); g.fillStyle = `rgb(${ink})`;
        if (p < 1) star(p); else { setShown(false); endAt = 0; }
      } else setShown(false);
    }
    raf = requestAnimationFrame(frame);
  }

  open.addEventListener('click', () => { if (shown) onOpen(); });
  pause.addEventListener('click', () => { if (shown) { onToggle(); lastRead = 0; } });
  reset.addEventListener('click', () => { if (shown) { onReset(); lastRead = 0; } });
  setShown(false);
  return {
    start() { if (running) return; running = true; lastRead = 0; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); setShown(false); },
  };
}
