/* ---- Jaar: twaalf maandkalenders met wat je afvinkte ---- */
// Naar "calendar-year-heatmap" van ascii-magic.com (Victor, 15/11/2026), eigen code en met echte gegevens: elke dag
// van dit jaar is een zeshoekig rasterpunt, des te groter hoe meer taken je die dag afvinkte (logboek `done`, gaat
// mee met sync). Bij het openen vult het jaar zich dag per dag tot vandaag (een tik slaat dat over). Tik of wijs een
// dag aan: onderaan staat wat je toen afrondde. Bovenaan: totaal, actieve dagen en de langste reeks.
// Kleur uit de kleurkiezer, anders inkt.

import { LANG } from '../core/i18n.js';

const en = LANG === 'en';
const T = en
  ? { tasks: n => `${n} ${n === 1 ? 'TASK' : 'TASKS'}`, days: n => `${n} ${n === 1 ? 'DAY' : 'DAYS'}`, streak: n => `STREAK ${n}`, none: 'NOTHING DONE' }
  : { tasks: n => `${n} ${n === 1 ? 'TAAK' : 'TAKEN'}`, days: n => `${n} ${n === 1 ? 'DAG' : 'DAGEN'}`, streak: n => `REEKS ${n}`, none: 'NIETS AFGEROND' };
const HEX = Array.from({ length: 6 }, (_, n) => [Math.cos(Math.PI / 6 + n * Math.PI / 3), Math.sin(Math.PI / 6 + n * Math.PI / 3)]);
const FILL = 2.4;

export function createYear({ W, H, getData, accent }) {
  const now = new Date(), Y = now.getFullYear();
  const start = new Date(Y, 0, 1), lead = (start.getDay() + 6) % 7;   // maandag eerst
  const dayOf = d => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 864e5);
  const todayIdx = dayOf(now), len = dayOf(new Date(Y, 11, 31)) + 1;
  const count = new Uint16Array(len);
  for (const ts of getData?.().days || []) { const d = new Date(ts); if (d.getFullYear() === Y) count[dayOf(d)]++; }
  let total = 0, active = 0, best = 0, run = 0, max = 1;
  for (let i = 0; i <= todayIdx; i++) { total += count[i]; max = Math.max(max, count[i]); if (count[i]) { active++; run++; best = Math.max(best, run); } else run = 0; }
  const monthName = m => new Date(Y, m, 1).toLocaleDateString(en ? 'en' : 'nl', { month: 'short' }).replace('.', '').toUpperCase();
  // opbouw: 6 × 2 maanden; een vakje groeit mee met het bakje, tot 10 px
  const M = 12, gap = 2.2;
  const cell = Math.min(10, (W - 2 * M) / (6 * 7 + 5 * gap), (H - 84) / (2 * 7 + 1.5));
  const bw = 7 * cell, ox = (W - (6 * bw + 5 * gap * cell)) / 2, top = 44;
  const pos = [];   // middelpunt per dag
  for (let m = 0; m < 12; m++) {
    const bx = ox + (m % 6) * (bw + gap * cell), by = top + Math.floor(m / 6) * (7.5 * cell + 6);
    const first = dayOf(new Date(Y, m, 1)), days = new Date(Y, m + 1, 0).getDate(), lw = (first + lead) % 7;
    for (let i = 0; i < days; i++) { const c = lw + i; pos[first + i] = [bx + (c % 7 + 0.5) * cell, by + 9 + (Math.floor(c / 7) + 0.5) * cell]; }
  }
  let clock = 0, pick = -1;
  const ink = () => { const a = accent?.(); return a ? [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)).join(',') : '236,240,244'; };
  const which = p => { for (let i = 0; i < len; i++) { const q = pos[i]; if (Math.abs(p.x - q[0]) <= cell / 2 && Math.abs(p.y - q[1]) <= cell / 2) return i; } return -1; };
  function text(g, s, x, y, alpha, align = 'left') {
    g.font = '500 9px "Geist Mono", ui-monospace, monospace'; g.textAlign = align; g.textBaseline = 'alphabetic';
    try { g.letterSpacing = '1.3px'; } catch { /* oudere browser */ }
    g.fillStyle = `rgba(214,220,236,${alpha})`; g.fillText(s, x, y);
    try { g.letterSpacing = '0px'; } catch { /* oudere browser */ }
  }
  return {
    still: 99,
    step(dt) { clock += dt; },
    frame() {},
    overlay(g) {
      const upto = Math.min(todayIdx, Math.floor(clock / FILL * todayIdx)), c = ink();
      for (let m = 0; m < 12; m++) text(g, monthName(m), ox + (m % 6) * (bw + gap * cell), top + Math.floor(m / 6) * (7.5 * cell + 6) + 4, 0.5);
      for (let i = 0; i < len; i++) {
        const [x, y] = pos[i];
        if (i > upto) {   // nog te komen of nog niet ingevuld
          g.fillStyle = 'rgba(214,220,236,.12)'; g.beginPath(); g.arc(x, y, 0.7, 0, Math.PI * 2); g.fill();
          continue;
        }
        const n = count[i], k = n ? 0.55 + 0.45 * Math.min(1, n / max) : 0;
        if (!n) { g.fillStyle = 'rgba(214,220,236,.32)'; g.beginPath(); g.arc(x, y, 1.1, 0, Math.PI * 2); g.fill(); }
        else {
          const r = cell * 0.5 * k;
          g.fillStyle = `rgba(${c},${(0.55 + 0.45 * k).toFixed(2)})`; g.beginPath();
          HEX.forEach(([a, b], j) => (j ? g.lineTo : g.moveTo).call(g, x + a * r, y + b * r)); g.fill();
        }
        if (i === todayIdx || i === pick) { g.strokeStyle = `rgba(${i === pick ? '240,244,250' : c},.8)`; g.lineWidth = 1; g.beginPath(); g.arc(x, y, cell * 0.55, 0, Math.PI * 2); g.stroke(); }
      }
      // onderaan: de gekozen dag, anders het jaar in cijfers
      if (pick >= 0) {
        const n = count[pick], day = new Date(Y, 0, 1 + pick).toLocaleDateString(en ? 'en' : 'nl', { day: 'numeric', month: 'short' }).replace('.', '').toUpperCase();
        text(g, `${day} · ${n ? T.tasks(n) : T.none}`, ox, H - 12, 0.85);
      } else text(g, `${Y} · ${T.tasks(total)} · ${T.days(active)} · ${T.streak(best)}`, ox, H - 12, 0.5);
    },
    tap(p) {
      if (clock < FILL) { clock = FILL; return; }
      const i = which(p);
      pick = i >= 0 && i <= todayIdx && i !== pick ? i : -1;
    },
    move(p) { if (clock >= FILL) { const i = which(p); if (i >= 0 && i <= todayIdx) pick = i; } },
    leave() { pick = -1; },
  };
}
