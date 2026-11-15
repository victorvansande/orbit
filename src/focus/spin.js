/* ---- Spinners: twaalf klassieke terminalspinners naast elkaar ---- */
// Naar "spinner-set" van ascii-magic.com (Victor, 15/11/2026), eigen code. Per rij de spinner, zijn naam, aantal
// beelden en tempo, en een strook die de reeks laat doorlopen. Tik op een rij: pauze of verder. Slepen opzij: alles
// sneller of trager (bovenaan het tempo). Kleur uit de kleurkiezer, anders inkt.

import { LANG } from '../core/i18n.js';

const en = LANG === 'en';
const BALL = Array.from({ length: 10 }, (_, i) => { const p = i < 5 ? i : 9 - i; return `[${' '.repeat(p)}●${' '.repeat(4 - p)}]`; });
const SET = [
  ['braille', 'braille', '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏', 12],
  ['line', 'lijn', '-\\|/', 8],
  ['dots', 'stippen', '⣾⣽⣻⢿⡿⣟⣯⣷', 10],
  ['arc', 'boog', '┤┘┴└├┌┬┐', 8],
  ['bounce', 'stuiter', '⠁⠂⠄⡀⢀⠠⠐⠈', 10],
  ['pulse', 'puls', '·•●•', 6],
  ['grow', 'groei', '▁▂▃▄▅▆▇█▇▆▅▄▃▂', 14],
  ['quadrant', 'kwadrant', '▖▘▝▗', 6],
  ['arrows', 'pijlen', '←↖↑↗→↘↓↙', 8],
  ['toggle', 'schakel', '■□', 4],
  ['shade', 'schaduw', '░▒▓█▓▒', 8],
  ['ball', 'bal', BALL, 10],
].map(([e, n, fr, fps]) => ({ name: en ? e : n, fr: [...fr], fps, ball: e === 'ball' }));

export function createSpin({ W, H, accent }) {
  const M = 12, top = 46, rh = Math.min(16, (H - top - 28) / SET.length);
  const xs = { name: M + 22, frames: M + 112, fps: M + 142, strip: M + 156 };
  const stripN = Math.max(0, Math.floor((W - M - xs.strip) / 7));
  const phase = SET.map(() => 0), paused = SET.map(() => false);
  let speed = 1, grab = null;
  const ink = a => { const c = accent?.(); return c ? `rgba(${[1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)).join(',')},${a})` : `rgba(236,240,244,${a})`; };
  const grey = a => `rgba(214,220,236,${a})`;
  function text(g, s, x, y, color, { align = 'left', caps = false, size = 9 } = {}) {
    g.font = `500 ${size}px "Geist Mono", ui-monospace, monospace`; g.textAlign = align; g.textBaseline = 'middle';
    try { g.letterSpacing = caps ? '1.3px' : '0px'; } catch { /* oudere browser */ }
    g.fillStyle = color; g.fillText(s, x, y);
    try { g.letterSpacing = '0px'; } catch { /* oudere browser */ }
  }
  return {
    still: 0,
    step(dt) { SET.forEach((s, i) => { if (!paused[i]) phase[i] += dt * s.fps * speed; }); },
    frame() {},
    overlay(g) {
      text(g, `${en ? 'SPEED' : 'TEMPO'} ×${speed.toFixed(speed < 1 ? 2 : 1)}`, M, H - 12, grey(0.5), { caps: true });
      text(g, en ? 'TAP = PAUSE · DRAG = TEMPO' : 'TIK = PAUZE · SLEEP = TEMPO', W - M, H - 12, grey(0.3), { align: 'right', caps: true });
      const hy = top - 9;
      text(g, en ? 'NAME' : 'NAAM', xs.name, hy, grey(0.4), { caps: true });
      text(g, en ? 'FR' : 'BLD', xs.frames, hy, grey(0.4), { align: 'right', caps: true });
      text(g, 'FPS', xs.fps, hy, grey(0.4), { align: 'right', caps: true });
      g.fillStyle = grey(0.12); g.fillRect(M, hy + 6, W - 2 * M, 1);
      SET.forEach((s, i) => {
        const y = top + (i + 0.5) * rh, f = Math.floor(phase[i]), n = s.fr.length, on = !paused[i];
        const cur = s.fr[f % n];
        text(g, s.ball ? '' : cur, M + 4, y, ink(on ? 1 : 0.35), { align: 'center', size: 11 });
        text(g, s.name, xs.name, y, grey(on ? 0.85 : 0.4));
        text(g, String(n), xs.frames, y, grey(0.45), { align: 'right' });
        text(g, String(s.fps), xs.fps, y, grey(0.45), { align: 'right' });
        if (s.ball) {
          text(g, cur, xs.strip, y, ink(on ? 1 : 0.35), { size: 10 });
          text(g, (en ? 'loading' : 'laden') + '.'.repeat(Math.floor(phase[i] / 5) % 4), xs.strip + 56, y, grey(0.45));
        } else for (let k = 0; k < stripN; k++) text(g, s.fr[(f + k) % n], xs.strip + k * 7 + 3, y, k % 2 ? ink(on ? 0.85 : 0.3) : grey(0.25), { align: 'center', size: 10 });
      });
    },
    tap(p) {
      const i = Math.floor((p.y - top) / rh);
      if (i >= 0 && i < SET.length) paused[i] = !paused[i];
    },
    down(p) { grab = { x: p.x, s: speed }; },
    drag(p) { if (grab) speed = Math.max(0.25, Math.min(4, grab.s * Math.pow(2, (p.x - grab.x) / 80))); },
    up() { grab = null; },
    leave() { grab = null; },
  };
}
