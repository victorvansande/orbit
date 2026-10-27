import { rgba } from './config.js';

/* ---- Bolstijlen: zonder verloop of gloed, slank ---- */
// scale: straal t.o.v. LEVELS[].size / 2 (vóór perspectief en schermschaal)
export const ORB_STYLES = [
  { id: 'ring',    name: 'Ring',    scale: 1.25 },
  { id: 'vlak',    name: 'Vlak',    scale: 1.05 },
  { id: 'raster',  name: 'Raster',  scale: 2.2 },
  { id: 'capsule', name: 'Capsule', scale: 0.85 },
];
export const ORB_STYLE_BY_ID = new Map(ORB_STYLES.map(s => [s.id, s]));
export const DEFAULT_ORB_STYLE = 'ring';

const TAU = Math.PI * 2;

// Statische bol (scène-hoofd, venster). Capsule tekent hier een schijf; de rek zit in de scène.
export function paintOrb(ctx, style, rgb, x, y, r, { alpha = 1, line = 1.5 } = {}) {
  if (alpha <= 0.004 || r <= 0) return;
  ctx.globalAlpha = alpha;
  if (style === 'ring') {
    ctx.strokeStyle = rgba(rgb, 1);
    ctx.lineWidth = line;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(r - line / 2, 0.5), 0, TAU);
    ctx.stroke();
    ctx.fillStyle = rgba(rgb, 1);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.3, 0, TAU);
    ctx.fill();
  } else if (style === 'raster') {
    halftone(ctx, rgb, x, y, r);
  } else {
    ctx.fillStyle = rgba(rgb, 1);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Schijf uit stipjes op een driehoeksrooster; naar de rand worden de stippen kleiner
export function halftone(ctx, rgb, x, y, r, gain = 1) {
  const step = Math.min(9, Math.max(1.7, r / 2.4));
  const n = Math.ceil(r / step) + 1;
  ctx.fillStyle = rgba(rgb, 1);
  ctx.beginPath();
  for (let j = -n; j <= n; j++) {
    const yy = j * step * 0.866;
    const off = j & 1 ? step / 2 : 0;
    for (let i = -n; i <= n; i++) {
      const xx = i * step + off;
      const d = Math.hypot(xx, yy);
      if (d > r) continue;
      const dr = step * 0.42 * gain * (1 - 0.55 * d / r);
      if (dr < 0.3) continue;
      ctx.moveTo(x + xx + dr, y + yy);
      ctx.arc(x + xx, y + yy, dr, 0, TAU);
    }
  }
  ctx.fill();
}
