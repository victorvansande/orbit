/* ---- Nieuwe rang: het teken groeit ---- */
// P1 (Victor, 03/11/2026, uit vier voorstellen in artifact "Orbit promotie": P1 Het teken groeit, P2 De kern promoveert,
// P3 Op de teller, P4 De balk loopt vol). Op een canvas: eerst het teken van de oude rang, dan gebeurt de promotie zelf.
// Binnen hetzelfde metaal schuiven de stippen op en vliegt de nieuwe stip als een maantje over de baan naar zijn plek.
// Naar een nieuw metaal verkleurt het teken, doven de oude stippen, tekent er een baan bij en krimpt de ster, daarna
// landt de eerste stip van het nieuwe metaal. Tijdgebaseerd; `still` toont meteen de eindstand (minder beweging, Minimaal).
import { rankParts, RANK_BOX } from '../core/badge.js';

const T0 = 900;                                   // ms: de oude rang staat er even voor de promotie begint
export const PROMO_MS = 6200;                     // ms: zo lang blijft de melding staan
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const span = (t, a, b) => ease((t - a) / (b - a));
const UNIT = parseFloat(RANK_BOX.split(' ')[2]);  // 27 eenheden breed

function mix(a, b, u) {
  const p = h => { const c = h.trim().replace('#', ''); const f = c.length === 3 ? c.split('').map(x => x + x).join('') : c; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)); };
  const A = p(a), B = p(b);
  return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * u)).join(',')})`;
}
function star(g, R, w = 0.2) {
  g.beginPath();
  for (let i = 0; i <= 4; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 2, x = Math.cos(a) * R, y = Math.sin(a) * R;
    if (!i) g.moveTo(x, y);
    else { const m = a - Math.PI / 4; g.quadraticCurveTo(Math.cos(m) * R * w, Math.sin(m) * R * w, x, y); }
  }
  g.fill();
}
const rad = d => d * Math.PI / 180;

// wanneer de nieuwe stip landt (de tekst verschijnt kort daarna)
export const landAt = (from, to) => T0 + (rankParts(from).metal === rankParts(to).metal ? 1300 : 1500);

export function createPromo(canvas, { reducedMotion }) {
  const g = canvas.getContext('2d');
  let raf = 0, start = 0, job = null;

  function draw(t) {
    const { from, to, cols, still } = job, A = rankParts(from), B = rankParts(to), change = A.metal !== B.metal;
    if (still) t = 1e6;
    const dpr = Math.min(2, devicePixelRatio || 1), W = canvas.clientWidth || 64;
    if (canvas.width !== Math.round(W * dpr)) { canvas.width = canvas.height = Math.round(W * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, W);
    g.translate(W / 2, W / 2); g.scale(W / UNIT, W / UNIT);
    const col = change ? mix(cols[A.metal], cols[B.metal], span(t, T0, T0 + 700)) : cols[B.metal];
    g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round';
    // banen: wat bij het nieuwe metaal bijkomt, tekent zich met de klok mee vanaf boven
    B.rings.forEach((ring, j) => {
      const p = j < A.rings.length ? 1 : span(t, T0 + 300, T0 + 1200);
      if (p <= 0) return;
      g.lineWidth = ring.w; g.beginPath(); g.arc(0, 0, ring.r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); g.stroke();
    });
    star(g, change ? A.starR + (B.starR - A.starR) * span(t, T0 + 300, T0 + 1100) : B.starR);
    const moon = (ang, s, alpha = 1, r = 1.75) => {
      if (s <= 0 || alpha <= 0) return;
      const x = Math.cos(rad(ang)) * 10.6, y = Math.sin(rad(ang)) * 10.6;
      g.save(); g.globalAlpha = alpha;
      g.beginPath(); g.arc(x, y, r * s + 1.2, 0, Math.PI * 2); g.fillStyle = cols.bg; g.fill();
      g.beginPath(); g.arc(x, y, r * s, 0, Math.PI * 2); g.fillStyle = col; g.fill();
      g.restore();
    };
    if (B.comet !== null) {   // platina: het komeetje komt mee met de nieuwe baan
      const c = change ? span(t, T0 + 900, T0 + 1500) : 1;
      if (c > 0) {
        g.save(); g.globalAlpha = 0.55 * c; g.lineWidth = 2.2; g.beginPath(); g.arc(0, 0, 10.6, rad(B.comet - 57 * c), rad(B.comet)); g.stroke(); g.restore();
        moon(B.comet, c, 1, 2.3);
      }
    }
    // oude stippen: doven bij een nieuw metaal, schuiven anders op naar hun nieuwe plek
    if (change) A.dots.forEach((a, j) => { const u = span(t, T0 - 300 + j * 60, T0 + 100 + j * 60); moon(a, 1 - u, 1 - u); });
    else A.dots.forEach((a, j) => { const u = span(t, T0 + 900, T0 + 1300); moon(a + (B.dots[j] - a) * u, 1); });
    // de nieuwe stip: vliegt over de baan aan en landt met een klein veertje
    const land = landAt(from, to), end = B.dots[B.dots.length - 1], startA = end + 200;
    if (t > land - 900) {
      const fly = span(t, land - 900, land), ang = startA + (end - startA) * fly;
      if (fly < 1) {   // taps staartje achter de stip, langs de baan
        g.save();
        for (let i = 0; i < 10; i++) {
          g.globalAlpha = 0.5 * (1 - i / 10) * (1 - fly * 0.6); g.lineWidth = 2.6 * (1 - i / 10);
          g.beginPath(); g.arc(0, 0, 10.6, rad(ang + i * 6), rad(ang + (i + 1) * 6)); g.stroke();
        }
        g.restore();
      }
      moon(ang, t < land ? 0.8 : 1 + 0.35 * Math.sin(Math.min(1, (t - land) / 350) * Math.PI));
    }
  }
  function frame(now) {
    if (!job) return;
    draw(now - start);
    if (!job.still && now - start < landAt(job.from, job.to) + 600) raf = requestAnimationFrame(frame);
  }
  return {
    play(from, to, cols, { still = false } = {}) {
      cancelAnimationFrame(raf);
      job = { from, to, cols, still: still || reducedMotion.matches };
      start = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() { cancelAnimationFrame(raf); job = null; },
  };
}
