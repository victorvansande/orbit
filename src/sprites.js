import { rgbOf, rgba, mix } from './config.js';

/* ---- Iriserende bollen (posterstijl), eenmalig getekend en daarna geschaald ---- */
// De bol zelf heeft straal SPHERE * grootte; de rest van het canvas is halo.
export const SPHERE = 0.3;
const TAU = Math.PI * 2;
const WHITE = [255, 255, 255];

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

// tones: [basis, schifting, licht] als hex
// Mat en strak: een diagonaal verloop door de drie tinten, geen glans, geen donkere rand.
// blur: zachtheid van de rand (fractie van de grootte), glow: dekking van de gekleurde gloed eronder.
export function orbSprite(tones, size = 160, { blur = 0.004, glow = 0.22 } = {}) {
  const [c1, c2, c3] = tones.map(rgbOf);
  const C = size / 2;
  const R = size * SPHERE;

  // 1. De bol
  const body = canvas(size);
  const b = body.getContext('2d');
  const sphere = () => { b.beginPath(); b.arc(C, C, R, 0, TAU); };
  const lin = b.createLinearGradient(C - R, C - R, C + R, C + R);
  lin.addColorStop(0, rgba(mix(c3, WHITE, 0.18), 1));
  lin.addColorStop(0.5, rgba(c1, 1));
  lin.addColorStop(1, rgba(c2, 1));
  b.fillStyle = lin;
  sphere();
  b.fill();
  // zachte tweede vlek, zoals een mesh-gradient
  b.fillStyle = radial(b, C + R * 0.35, C - R * 0.3, 0, R * 0.95, [[0, rgba(c3, 0.32)], [1, rgba(c3, 0)]]);
  sphere();
  b.fill();

  // 2. Gekleurde gloed onder de bol, dan de bol erop
  const out = canvas(size);
  const g = out.getContext('2d');
  g.fillStyle = radial(g, C, C + R * 0.24, R * 0.55, R * 1.6, [[0, rgba(c1, glow)], [1, rgba(c1, 0)]]);
  g.fillRect(0, 0, size, size);
  const px = size * blur;
  if (px >= 0.6 && supportsFilter(g)) {
    g.filter = `blur(${px.toFixed(1)}px)`;
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
