/* ---- Vallend water voor de natuurvensters ---- */
// Victor (12/11/2026): "de waterval ziet er nog heel vibecoded en te basic uit". Een val is nu opgebouwd zoals je hem
// ziet: bovenaan een gladde, glazige lip waar het water over de rand buigt en even versmalt, daaronder sluiers die
// elk hun eigen rand hebben (dus geen strak vlak) en draden die versnellen (vrije val: de weg groeit met het kwadraat
// van de tijd, dus de streepjes worden naar onder langer en vallen uiteen in druppels); de natte rots schemert door.
// Een steen in de stroom (`split`) duwt het water opzij. Onderaan schuim dat opbolt en inzakt, spatjes in boogjes en
// nevel die opstijgt. Eén val = createFall({ x0, x1, y0, x2, x3, y1 }): boven van x0 tot x1 op y0, onder x2 tot x3 op y1.

import { rng, noise } from './brush.js';

const TAU = Math.PI * 2;

export function createFall({ x0, x1, y0, x2, x3, y1, time = 0.55, seed = 1, strands = 26, veils = 9, foam = true, mist = 1, split = null }) {
  const q = rng(seed), nz = noise(seed + 3), h = y1 - y0;
  const S = Array.from({ length: strands }, (_, i) => ({ u: (i + 0.5 + (q() - 0.5) * 0.9) / strands, ph: q(), sp: 0.8 + q() * 0.45, w: 0.35 + q() * q() * 1.3, br: q(), n: 2 + Math.floor(q() * 2), sway: q() * 9 }));
  const V = Array.from({ length: veils }, (_, i) => ({ u: (i + 0.5 + (q() - 0.5) * 0.6) / veils, w: (0.7 + q() * 0.9) / veils, a: 0.1 + q() * 0.16, k: q() * 20, k0: i === 0 || i === veils - 1 ? 0.05 + q() * 0.1 : 0 }));
  let drops = [], puffs = [], acc = 0, pacc = 0;
  // plaats van een draad: u dwars (0 tot 1), k langs de val (0 tot 1); versmalt onder de lip, waaiert dan uit, wijkt voor de steen
  const xAt = (u, k, t) => {
    const uu = 0.5 + (u - 0.5) * (1 - 0.2 * Math.exp(-(((k - 0.2) / 0.16) ** 2)));
    let x = x0 + (x1 - x0) * uu + ((x2 + (x3 - x2) * uu) - (x0 + (x1 - x0) * uu)) * k + (nz(u * 7 + seed, t * 0.5 + k * 2.4) - 0.5) * 2.2 * k;
    if (split && k > split.k) { const d = u - split.u, near = Math.max(0, 1 - Math.abs(d) / split.w); x += Math.sign(d || 1) * near * Math.min(1, (k - split.k) * 7) * (x3 - x2) * split.w * 0.55 * (1 - (k - split.k) * 0.5); }
    return x;
  };
  return {
    step(dt, t) {
      if (foam) {
        acc += dt * 18;
        while (acc > 1) { acc--; const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 8 + Math.random() * 17; drops.push({ x: x2 + Math.random() * (x3 - x2), y: y1 - 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.4, r: 0.22 + Math.random() * 0.4 }); }
        pacc += dt * 1.8 * mist;
        while (pacc > 1) { pacc--; puffs.push({ x: x2 + Math.random() * (x3 - x2), y: y1 - 1, vx: (Math.random() - 0.5) * 3, r: 3 + Math.random() * 4, at: t, life: 2.2 + Math.random() * 1.6 }); }
      }
      if (split && Math.random() < dt * 9) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8, v = 5 + Math.random() * 9, sx = xAt(split.u, split.k, t); drops.push({ x: sx + (Math.random() - 0.5) * 3, y: y0 + h * split.k - 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.3 + Math.random() * 0.25, r: 0.2 + Math.random() * 0.3 }); }
      for (const d of drops) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 70 * dt; d.life -= dt; }
      drops = drops.filter(d => d.life > 0 && d.y < y1 + 1);
      puffs = puffs.filter(p => t - p.at < p.life);
    },
    draw(g, t) {
      // sluiers: elk een eigen baan met golvende randen, ijl bovenaan (glas), dichter en witter naar onder
      for (const v of V) {
        const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(170,208,212,${v.a * 1.5})`); gr.addColorStop(0.3, `rgba(206,230,232,${v.a})`); gr.addColorStop(1, `rgba(244,250,250,${v.a * 2.3})`);
        g.fillStyle = gr; g.beginPath();
        const L = [], R = [];
        for (let k = v.k0; k <= 1.001; k += 0.1) { const wd = v.w * (0.75 + k * 0.6) * (0.8 + 0.4 * nz(v.k, k * 3 - t * 1.1)), wob = (nz(v.k + 9, k * 2.2 - t * 0.9) - 0.5) * 0.08 * k; L.push([xAt(v.u - wd / 2 + wob, k, t), y0 + h * k]); R.push([xAt(v.u + wd / 2 + wob, k, t), y0 + h * k]); }
        g.moveTo(...L[0]); L.forEach(p => g.lineTo(...p)); for (let i = R.length - 1; i >= 0; i--) g.lineTo(...R[i]); g.closePath(); g.fill();
      }
      // draden: streepjes in vrije val; onderaan vallen ze uiteen in druppels
      g.lineCap = 'round';
      for (const s of S) {
        for (let j = 0; j < s.n; j++) {
          const tau = (t * s.sp / time + s.ph + j / s.n) % 1, k1 = tau * tau, k0 = Math.max(0, tau - 0.09 - tau * 0.2) ** 2;
          const fade = Math.min(1, tau * 5) * (1 - Math.max(0, (tau - 0.9) / 0.1) * 0.6), ux = s.u + Math.sin(t * 1.3 + s.sway) * 0.014;
          g.strokeStyle = g.fillStyle = s.br > 0.6 ? `rgba(255,255,255,${(0.42 + 0.45 * tau) * fade})` : `rgba(210,234,238,${(0.24 + 0.4 * tau) * fade})`;
          if (tau > 0.8 && s.br < 0.75) { for (let d = 0; d < 3; d++) { const kk = k0 + (k1 - k0) * (d / 2.4); g.beginPath(); g.arc(xAt(ux, kk, t), y0 + h * kk, s.w * 0.55, 0, TAU); g.fill(); } continue; }
          g.lineWidth = s.w * (1 - tau * 0.25);
          g.beginPath(); g.moveTo(xAt(ux, k0, t), y0 + h * k0); g.lineTo(xAt(ux, (k0 + k1) / 2, t), y0 + h * (k0 + k1) / 2); g.lineTo(xAt(ux, k1, t), y0 + h * k1); g.stroke();
        }
      }
      // de lip: een heldere, gladde rand waar het water over de steen buigt
      const lip = g.createLinearGradient(0, y0 - 1.4, 0, y0 + 4);
      lip.addColorStop(0, 'rgba(236,248,248,0)'); lip.addColorStop(0.3, 'rgba(240,250,250,.85)'); lip.addColorStop(1, 'rgba(206,232,234,0)');
      g.fillStyle = lip; g.beginPath(); g.moveTo(x0 - 0.6, y0 - 0.2); g.quadraticCurveTo((x0 + x1) / 2, y0 - 1.3, x1 + 0.6, y0 - 0.2); g.lineTo(x1 + 0.3, y0 + 2.4); g.quadraticCurveTo((x0 + x1) / 2, y0 + 1.2, x0 - 0.3, y0 + 2.4); g.closePath(); g.fill();
      if (foam) {
        // nevel: zachte wolkjes die opstijgen en verdwijnen
        for (const p of puffs) { const u = (t - p.at) / p.life, x = p.x + p.vx * (t - p.at), y = p.y - u * 10, r = p.r * (1 + u * 1.8), a = 0.14 * Math.sin(Math.min(1, u * 3) * Math.PI / 2) * (1 - u); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(236,246,246,${a})`); gr.addColorStop(1, 'rgba(236,246,246,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
        // schuim: bolt op en zakt in, breder dan de val
        const fw = x3 - x2, n = Math.max(6, Math.round(fw / 1.9));
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1), x = x2 - 3 + u * (fw + 6), r = 0.7 + nz(i * 1.7, t * 2.6) * 2.3 * (1 - Math.abs(u - 0.5) * 1.2);
          g.fillStyle = `rgba(248,252,252,${0.5 + 0.4 * nz(i * 0.9 + 5, t * 1.9)})`; g.beginPath(); g.ellipse(x + (nz(i, t * 1.4) - 0.5) * 1.8, y1 - r * 0.3, r * 1.2, r * 0.75, 0, 0, TAU); g.fill();
        }
      }
      if (split) { const sx = xAt(split.u, split.k, t), sy = y0 + h * split.k; for (let i = 0; i < 5; i++) { const r = 0.6 + nz(i * 2.1 + 40, t * 3) * 1.3; g.fillStyle = `rgba(250,253,253,${0.6 + 0.3 * nz(i + 50, t * 2)})`; g.beginPath(); g.ellipse(sx - 3.4 + i * 1.7, sy - r * 0.2, r, r * 0.7, 0, 0, TAU); g.fill(); } }
      g.fillStyle = 'rgba(250,253,253,.85)'; for (const d of drops) { g.globalAlpha = Math.min(1, d.life * 4); g.beginPath(); g.arc(d.x, d.y, d.r, 0, TAU); g.fill(); } g.globalAlpha = 1;
    },
  };
}
