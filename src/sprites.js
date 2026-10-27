import { rgbOf, rgba, mix } from './config.js';

/* ---- Iriserende bollen (posterstijl), eenmalig getekend en daarna geschaald ---- */
// De bol zelf heeft straal SPHERE * grootte; de rest van het canvas is halo.
export const SPHERE = 0.3;
const TAU = Math.PI * 2;
const WHITE = [255, 255, 255];
const BLACK = [18, 16, 30];

let filterOk = null;
function supportsFilter(ctx) {
  if (filterOk === null) {
    ctx.filter = 'blur(1px)';
    filterOk = ctx.filter === 'blur(1px)';
    ctx.filter = 'none';
  }
  return filterOk;
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function radial(g, x, y, r0, r1, stops) {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

// tones: [basis, schifting, glans] als hex
export function orbSprite(tones, size = 160, { soft = 1 } = {}) {
  const [c1, c2, c3] = tones.map(rgbOf);
  const C = size / 2;
  const R = size * SPHERE;

  // 1. De bol, scherp getekend
  const body = canvas(size);
  const b = body.getContext('2d');
  b.save();
  b.beginPath();
  b.arc(C, C, R, 0, TAU);
  b.clip();
  b.fillStyle = radial(b, C - R * 0.35, C - R * 0.4, 0, R * 1.55, [
    [0, rgba(mix(c3, WHITE, 0.55), 1)],
    [0.42, rgba(c1, 1)],
    [1, rgba(mix(c2, BLACK, 0.28), 1)],
  ]);
  b.fillRect(0, 0, size, size);
  // diagonale veeg, zoals op de posters
  b.translate(C, C);
  b.rotate(-0.62);
  const sweep = b.createLinearGradient(0, -R, 0, R);
  sweep.addColorStop(0.38, rgba(c2, 0));
  sweep.addColorStop(0.62, rgba(c2, 0.62));
  sweep.addColorStop(0.86, rgba(c2, 0));
  b.fillStyle = sweep;
  b.fillRect(-R, -R, R * 2, R * 2);
  b.setTransform(1, 0, 0, 1, 0, 0);
  // warme gloed onderaan rechts
  b.fillStyle = radial(b, C + R * 0.35, C + R * 0.3, 0, R * 0.75, [[0, rgba(c3, 0.55)], [1, rgba(c3, 0)]]);
  b.fillRect(0, 0, size, size);
  // iriserende rand
  b.fillStyle = radial(b, C, C, R * 0.72, R, [[0, rgba(c2, 0)], [1, rgba(mix(c2, c3, 0.4), 0.55)]]);
  b.fillRect(0, 0, size, size);
  // zachte glans linksboven
  b.fillStyle = radial(b, C - R * 0.32, C - R * 0.38, 0, R * 0.5, [[0, rgba(WHITE, 0.3)], [1, rgba(WHITE, 0)]]);
  b.fillRect(0, 0, size, size);
  b.restore();

  // 2. Halo + kleurschifting + wazige bol samenvoegen
  const out = canvas(size);
  const g = out.getContext('2d');
  g.fillStyle = radial(g, C, C, R * 0.7, R * 1.65, [[0, rgba(c1, 0.32 * soft)], [1, rgba(c1, 0)]]);
  g.fillRect(0, 0, size, size);
  g.fillStyle = radial(g, C - R * 0.08, C - R * 0.1, R * 0.8, R * 1.35, [[0, rgba(c2, 0.22 * soft)], [1, rgba(c2, 0)]]);
  g.fillRect(0, 0, size, size);
  if (supportsFilter(g)) {
    g.filter = `blur(${(size * 0.018 * soft).toFixed(1)}px)`;
    g.drawImage(body, 0, 0);
    g.filter = 'none';
  } else {
    g.drawImage(body, 0, 0);
  }
  return out;
}

// Teken een sprite zodat de bol zelf straal r (px) krijgt
export function drawOrb(ctx, sprite, x, y, r, alpha = 1) {
  if (alpha <= 0.004 || r <= 0) return;
  const half = r / SPHERE / 2;
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - half, y - half, half * 2, half * 2);
  ctx.globalAlpha = 1;
}
