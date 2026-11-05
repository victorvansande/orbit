/* ---- Paneel: Orbit aan het werk, als lampjes, schermen en meters ---- */
// Een soort in het bakje van de focusmodus (zie fidget.js), op vraag van Victor (03/11/2026): "a lot of different lights,
// buttons, display animations that makes it look like the servers/computers are doing all sorts of stuff ... as if Orbit
// is doing very important tasks". Dertien schermen uit vier voorstelrondes (ontwerp/paneel/), tussen te wisselen met een
// subtiel pijltje onder het bakje: tien als oude CRT-monitor (fosfor dat nagloeit, scanlijnen, vignet, rollende band,
// lichte flikkering, VT323) en drie in de vlakke inkt van Orbit. Alles leest de echte toestand (getData). De fosforkleur
// volgt de kleurkiezer van het bakje; de momentkleuren van de taken blijven altijd hun eigen kleur.
import { LEVELS as CONF } from '../core/config.js';
import { LANG } from '../core/i18n.js';
import { timerState } from './timer.js';

export const PANEL_KEY = 'priority-orbit.panel.v1';
const W = 326, H = 227, TAU = Math.PI * 2;
const S = { x: 10, y: 32, w: 306, h: 185 };   // het scherm in het bakje (onder de keuzerij)
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const ease = u => u * u * (3 - 2 * u);

// Schermtekst is Nederlands; in het Engels per woord of vaste regel vertaald
const EN = {
  'CATALOGUS': 'CATALOGUE', 'KAART': 'CHART', 'WEEK': 'WEEK', 'REK 01 · ORBIT': 'RACK 01 · ORBIT', 'TAAK': 'TASK', 'TAKEN': 'TASKS',
  'PING': 'PING', 'CONSOLE': 'CONSOLE', 'GEHEUGEN': 'MEMORY', 'RADAR': 'RADAR', 'MODEL': 'MODEL', 'TRECHTER': 'FUNNEL', 'LIJNEN': 'LINES',
  'PEN': 'PEN', 'TEKENT': 'DRAWING', 'RUST': 'IDLE', 'DRAAI': 'ROTATION', 'BOLLEN': 'ORBS', 'GOLF': 'WAVE', 'SCAN': 'SCAN', 'RASTER': 'GRID',
  'PATROON': 'PATTERN', 'STER': 'STAR', 'GEHEUGEN · 0X0000-0X02BC': 'MEMORY · 0X0000-0X02BC', 'BEZET': 'IN USE',
  'PID   TAAK                  CPU': 'PID   TASK                  CPU', 'DEFRAGMENTEREN...': 'DEFRAGMENTING...', 'BAAN': 'ORBIT',
  'OMLOOP': 'PERIOD', 'STRAAL': 'RADIUS', 'VOORTGANG': 'PROGRESS', 'KERN': 'CORE', 'LAMPEN': 'LAMPS', 'SECTOR': 'SECTOR',
  'STERREN': 'STARS', 'FOCUS': 'FOCUS', 'TELLERS': 'COUNTERS', 'MOMENTEN': 'MOMENTS', 'ARCHIEF': 'ARCHIVE', 'ZOOM ×40': 'ZOOM ×40',
  'MA': 'MO', 'DI': 'TU', 'WO': 'WE', 'DO': 'TH', 'VR': 'FR', 'ZA': 'SA', 'ZO': 'SU', 'DOELEN': 'TARGETS', 'BEREIK 5': 'RANGE 5',
  'SYS': 'SYS', 'VANDAAG': 'TODAY',
};
const w = s => LANG === 'en' ? (EN[s] ?? s) : s;
const MONTHS = LANG === 'en' ? ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] : ['JAN', 'FEB', 'MRT', 'APR', 'MEI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];
const SHORT = LANG === 'en' ? ['NOW', 'TDY', 'WK', 'MTH', 'SMD'] : ['NU', 'VAN', 'WK', 'MND', 'OOIT'];

// Gedeelde toestand, bijgewerkt uit getData (één keer per seconde)
const LEVELS = CONF.map((l, i) => ({ n: l.name.toUpperCase(), s: SHORT[i], count: 0, ring: l.ring, period: l.period }));
const TASKS = [];
const DATA = { n: 0, total: 0, archive: 0, today: 0, stars: [], sync: 'off' };
let BPM = 64;
const BOOT = performance.now();
let CLOCK = 0;   // tijd van het laatste beeld (s): een tik in een scherm rekent op dezelfde klok als het tekenen
const LV = CONF.map(l => l.dark);   // momentkleuren op het donkere scherm: altijd hun eigen kleur
const LVRGB = LV.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
const pad3 = n => String(n).padStart(3, '0');
function focusLeft() {
  const st = timerState(), ms = st.endAt ? Math.max(0, st.endAt - Date.now()) : st.left, s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function uptime() {
  const s = Math.floor((performance.now() - BOOT) / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function weekNo(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}
const dayLabel = t => { const d = new Date(t); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const syncWord = () => ({ online: 'OK', connecting: '...', offline: 'OFFLINE', off: LANG === 'en' ? 'OFF' : 'UIT' })[DATA.sync] || 'OK';
const nu = () => LEVELS[0].count;
function termLines() {
  const en = LANG === 'en', n = LEVELS.map(l => l.count);
  return en
    ? ['orbit> status', `now ${n[0]}  today ${n[1]}  week ${n[2]}`, `month ${n[3]}  someday ${n[4]}`, 'orbit> sync', `${syncWord().toLowerCase()}`, 'orbit> star', `${pad3(DATA.total)} stars`, 'orbit> focus', `${focusLeft()} left`, 'orbit> archive', `${DATA.archive} lines`]
    : ['orbit> status', `nu ${n[0]}  vandaag ${n[1]}  week ${n[2]}`, `maand ${n[3]}  ooit ${n[4]}`, 'orbit> sync', `${syncWord().toLowerCase()}`, 'orbit> ster', `${pad3(DATA.total)} sterren`, 'orbit> focus', `nog ${focusLeft()}`, 'orbit> archief', `${DATA.archive} regels`];
}
function consoleLines() {
  const en = LANG === 'en', top = TASKS[0];
  return en
    ? ['orbit> sync', `${syncWord().toLowerCase()}, ${DATA.n} tasks`, 'orbit> star', `${DATA.total} stars`, 'orbit> core', `${BPM}/min, ${nu()} urgent`, 'orbit> focus', `${focusLeft()} left`, 'orbit> next', top ? `"${top.toLowerCase()}"` : 'nothing urgent']
    : ['orbit> sync', `${syncWord().toLowerCase()}, ${DATA.n} taken`, 'orbit> ster', `${DATA.total} sterren`, 'orbit> kern', `${BPM}/min, ${nu()} dringend`, 'orbit> focus', `nog ${focusLeft()}`, 'orbit> volgende', top ? `"${top.toLowerCase()}"` : 'niets dringend'];
}
function tickerText() {
  const en = LANG === 'en';
  return en
    ? ` ORBIT · ${DATA.n} TASKS · ${nu()} NOW · STAR ${DATA.total} · FOCUS ${focusLeft()} · SYNC ${syncWord()} · CORE ${BPM} ·`
    : ` ORBIT · ${DATA.n} TAKEN · ${nu()} NU · STER ${DATA.total} · FOCUS ${focusLeft()} · SYNC ${syncWord()} · KERN ${BPM} ·`;
}
function panelLog() {
  const en = LANG === 'en';
  return en
    ? [`SYNC ${syncWord()}`, `${DATA.n} TASKS LOADED`, `CORE ${BPM}/MIN`, `FOCUS ${focusLeft()}`, `STAR ${DATA.total} SET`, `ORBIT NOW ${LEVELS[0].period} S`, `ARCHIVE ${DATA.archive}`, `WEEK ${weekNo()} · ${LEVELS[2].count}`, 'BACKUP IDB OK']
    : [`SYNC ${syncWord()}`, `${DATA.n} TAKEN GELADEN`, `KERN ${BPM}/MIN`, `FOCUS ${focusLeft()}`, `STER ${DATA.total} GEZET`, `BAAN NU ${LEVELS[0].period} S`, `ARCHIEF ${DATA.archive}`, `WEEK ${weekNo()} · ${LEVELS[2].count}`, 'BACKUP IDB OK'];
}
// je eigen sterren voor de telescoop (stage-eenheden rond het midden, straal tot 250), anders een voorbeeldhemel
function skyStars() {
  const src = DATA.stars.slice(-64);
  if (src.length >= 8) {
    return src.map((st, i) => ({
      x: Math.min(S.w - 8, Math.max(8, S.w / 2 + st.x * 0.58)), y: Math.min(S.h - 14, Math.max(18, S.h / 2 + st.y * 0.32)),
      m: 0.7 + hash(i * 1.9) * 1.2, ph: hash(i) * TAU, n: DATA.total - (src.length - 1 - i), d: dayLabel(st.t),
    }));
  }
  return Array.from({ length: 64 }, (_, i) => ({ x: 8 + hash(i * 3.1) * (S.w - 16), y: 18 + hash(i * 7.7) * (S.h - 30), m: 0.6 + hash(i * 1.9) * 1.4, ph: hash(i) * TAU, n: Math.max(0, DATA.total - i), d: dayLabel(Date.now() - hash(i * 5.3) * 30 * 86400000) }));
}

/* ---- CRT-schermen ---- */
const CRT = (() => {
let P = { hi: [253, 230, 138], mid: [251, 146, 60], lo: [224, 71, 59], bg: [14, 8, 6] };
const c = (col, a = 1) => `rgba(${col[0]},${col[1]},${col[2]},${a})`;
const hi = a => c(P.hi, a), mid = a => c(P.mid, a), lo = a => c(P.lo, a);
const FONT = s => `${s}px VT323, "Geist Mono", ui-monospace, monospace`;
function txt(g, s, x, y, size = 12, col = mid(0.95), align = 'left') { g.font = FONT(size); g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillStyle = col; g.fillText(w(s), x, y); g.textAlign = 'left'; }

// venster met titelbalk, zoals in de retro-HUD
function win(g, x, y, w, h, title, act = 0) {
  g.strokeStyle = mid(0.75); g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.fillStyle = act ? mid(0.9) : mid(0.12); g.fillRect(x + 1, y + 1, w - 2, 11);
  g.strokeStyle = mid(0.6); g.beginPath(); g.moveTo(x, y + 12.5); g.lineTo(x + w, y + 12.5); g.stroke();
  txt(g, title, x + 4, y + 10, 11, act ? c(P.bg, 1) : hi(0.9));
  g.strokeStyle = act ? c(P.bg, 0.9) : mid(0.7); g.strokeRect(x + w - 10.5, y + 3.5, 6, 6);
}
// trechter als draadmodel
const PROF = [[0, -300], [38, -200], [72, -125], [106, -70], [140, -30], [174, 0]];
const depth = r => { for (let i = 1; i < PROF.length; i++) if (r <= PROF[i][0]) { const [r0, z0] = PROF[i - 1], [r1, z1] = PROF[i]; return z0 + (r - r0) / (r1 - r0) * (z1 - z0); } return 0; };
function halfRadar(g, cx, cy, R, t) {
  g.strokeStyle = mid(0.45);
  for (let k = 1; k <= 4; k++) { g.beginPath(); g.arc(cx, cy, R * k / 4, Math.PI, TAU); g.stroke(); }
  for (let k = 0; k <= 6; k++) { const a = Math.PI + k / 6 * Math.PI; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke(); }
  g.beginPath(); g.moveTo(cx - R - 3, cy); g.lineTo(cx + R + 3, cy); g.stroke();
  const sw = Math.PI + (Math.sin(t * 0.6) * 0.5 + 0.5) * Math.PI;
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R); gr.addColorStop(0, lo(0.15)); gr.addColorStop(1, lo(0.55));
  g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, sw - 0.5, sw); g.closePath(); g.fill();
  g.strokeStyle = hi(0.9); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(sw) * R, cy + Math.sin(sw) * R); g.stroke();
  g.fillStyle = hi(1); g.fillRect(cx + Math.cos(sw + 0.4) * R * 0.6 - 1.5, cy + Math.sin(sw + 0.4) * R * 0.6 - 1.5, 3, 3);
  return sw;
}
function scopeTrace(g, x, y, w, h, t, which = 1) {
  g.fillStyle = mid(0.2);
  for (let i = 0; i <= 8; i++) for (let yy = 0; yy <= h; yy += 3) g.fillRect(x + i * w / 8, y + yy, 1, 1);
  for (let j = 0; j <= 4; j++) for (let xx = 0; xx <= w; xx += 3) g.fillRect(x + xx, y + j * h / 4, 1, 1);
  const T = 2.4, head = (t % T) / T, N = 90;
  const f = u => {
    const time = (t - (head - u) * T);
    if (which === 1) { const ph = (time * BPM / 60) % 1; return -Math.exp(-((((ph - 0.12) / 0.025)) ** 2)) * 0.9 + Math.exp(-((((ph - 0.2) / 0.04)) ** 2)) * 0.25; }
    let s = 0; LEVELS.forEach((lv, i) => { s += Math.sin(time * TAU / lv.period + i) / (i + 1.5); }); return s * 0.45;
  };
  g.lineWidth = 1.3;
  for (let k = 0; k < N; k++) {
    const u0 = k / N, u1 = (k + 1) / N, age = u1 <= head ? head - u1 : head + 1 - u1;
    g.strokeStyle = u1 <= head ? hi(0.2 + 0.8 * Math.exp(-age * 2.5)) : mid(0.15 * (1 - age));
    g.beginPath(); g.moveTo(x + u0 * w, y + h / 2 + f(u0) * h * 0.45); g.lineTo(x + u1 * w, y + h / 2 + f(u1) * h * 0.45); g.stroke();
  }
  g.lineWidth = 1;
}
// typende tekst
function typer(lines, speed = 26) {
  return (g, x, y, w, nLines, t, size = 11, lh = 11) => {
    const total = lines.reduce((a, l) => a + l.length + 6, 0), pos = (t * speed) % total;
    let acc = 0, shown = [];
    for (const l of lines) { const n = Math.max(0, Math.min(l.length, pos - acc)); shown.push(l.slice(0, Math.floor(n))); acc += l.length + 6; if (pos < acc) break; }
    shown = shown.slice(-nLines);
    shown.forEach((s, i) => txt(g, s, x, y + i * lh, size, i === shown.length - 1 ? hi(0.95) : mid(0.75)));
    const last = shown[shown.length - 1] || '';
    g.font = FONT(size);
    if (Math.floor(t * 2.5) % 2 === 0) { g.fillStyle = hi(0.9); g.fillRect(x + g.measureText(last).width + 1, y + (shown.length - 1) * lh - size + 3, size * 0.45, size - 2); }
  };
}
function bar(g, x, y, w, h, frac, segs, vertical) {
  for (let s = 0; s < segs; s++) {
    const on = s < Math.round(frac * segs);
    g.fillStyle = on ? (s >= segs * 0.75 ? hi(0.95) : mid(0.5 + 0.5 * s / segs)) : mid(0.1);
    if (vertical) { const sh = (h - (segs - 1) * 2) / segs; g.fillRect(x, y + h - (s + 1) * sh - s * 2, w, sh); }
    else { const sw = (w - (segs - 1) * 2) / segs; g.fillRect(x + s * (sw + 2), y, sw, h); }
  }
}

/* ---- Momentkleuren: taken in de kleur van hun moment (Victor: "ook graag meerdere kleuren") ---- */

/* ---- R13 Kaartkamer (telescoop + plotter) ---- */
function chartroom() {
  const stars = Array.from({ length: 70 }, (_, i) => ({ x: 10 + hash(i * 3.1) * 210, y: 18 + hash(i * 7.7) * 150, m: 0.6 + hash(i * 1.9) * 1.3, ph: hash(i) * TAU, n: 98 - i }));
  const weeks = [0, 1, 2].map(w => { const set = [Math.floor(hash(w * 13 + 1) * 70)]; while (set.length < 8) { const l = stars[set[set.length - 1]]; let b = -1, bd = 1e9; stars.forEach((s, i) => { if (set.includes(i)) return; const d = Math.hypot(s.x - l.x, s.y - l.y) + hash(i * 7 + w) * 20; if (d < bd) { bd = d; b = i; } }); set.push(b); } return set; });
  let wk = 0, start = 0, first = true;
  const DUR = 6.5;
  return {
    tap() { wk = (wk + 1) % 3; start = CLOCK; },
    draw(g, t) {
      if (first) { start = t; first = false; }
      if (t - start > DUR + 2) { wk = (wk + 1) % 3; start = t; }
      g.strokeStyle = mid(0.12); g.setLineDash([2, 3]);
      for (let x = 30; x < 226; x += 40) { g.beginPath(); g.moveTo(x, 12); g.lineTo(x, 176); g.stroke(); }
      for (let y = 30; y < 176; y += 36) { g.beginPath(); g.moveTo(6, y); g.lineTo(226, y); g.stroke(); }
      g.setLineDash([]);
      txt(g, `${w('KAART')} · ${w('WEEK')} ${weekNo() - 2 + wk}`, 6, 11, 10, mid(0.8));
      for (const s of stars) { g.fillStyle = hi(0.45 + 0.35 * Math.sin(t * 2 + s.ph)); g.fillRect(s.x - s.m / 2, s.y - s.m / 2, s.m + 0.4, s.m + 0.4); }
      const set = weeks[wk], u = Math.min(1, (t - start) / DUR), fade = t - start > DUR ? Math.max(0, 1 - (t - start - DUR) / 2) : 1;
      const segs = set.length - 1, pos = u * segs, k = Math.floor(pos), f = pos - k;
      g.strokeStyle = hi(0.9 * fade); g.lineWidth = 1.2; g.beginPath();
      for (let i = 0; i <= Math.min(k, segs); i++) { const s = stars[set[i]]; i ? g.lineTo(s.x, s.y) : g.moveTo(s.x, s.y); }
      let px = stars[set[Math.min(k, segs)]].x, py = stars[set[Math.min(k, segs)]].y;
      if (k < segs) { const a = stars[set[k]], b = stars[set[k + 1]]; px = a.x + (b.x - a.x) * f; py = a.y + (b.y - a.y) * f; g.lineTo(px, py); }
      g.stroke(); g.lineWidth = 1;
      set.forEach((i, j) => { if (j > k) return; const s = stars[i]; g.strokeStyle = lvc(Math.floor(hash(i * 11) * 5), 0.95 * fade); g.beginPath(); g.arc(s.x, s.y, 3.5, 0, TAU); g.stroke(); });
      g.strokeStyle = hi(fade); g.beginPath(); g.moveTo(px - 6, py); g.lineTo(px + 6, py); g.moveTo(px, py - 6); g.lineTo(px, py + 6); g.stroke();
      // catalogus
      g.strokeStyle = mid(0.6); g.strokeRect(230.5, 4.5, 72, 176);
      txt(g, 'CATALOGUS', 234, 15, 10, hi(0.9));
      g.strokeStyle = mid(0.4); g.beginPath(); g.moveTo(231, 19); g.lineTo(302, 19); g.stroke();
      set.forEach((i, j) => {
        const y = 31 + j * 17, on = j <= k;
        g.fillStyle = lvc(Math.floor(hash(i * 11) * 5), on ? 1 : 0.3); g.beginPath(); g.arc(237, y - 3.5, 2.2, 0, TAU); g.fill();
        txt(g, String(stars[i].n).padStart(3, '0'), 243, y, 11, j === k ? hi(1) : on ? mid(0.9) : mid(0.35));
        txt(g, ['MA', 'DI', 'WO', 'DO', 'VR', 'ZA', 'ZO', 'MA'][j], 262, y, 10, on ? mid(0.7) : mid(0.3));
        txt(g, `${String(8 + Math.floor(hash(i) * 14)).padStart(2, '0')}:${String(Math.floor(hash(i * 3) * 60)).padStart(2, '0')}`, 299, y, 10, on ? mid(0.7) : mid(0.3), 'right');
      });
      txt(g, `${Math.round(u * 100)}%`, 299, 176, 10, hi(0.9), 'right');
    },
  };
}

/* ---- R14 Rekkast (mainframe + schakelbord) ---- */
function rack2() {
  let ping = -1, pingAt = -9;
  return {
    tap(x, y) { ping = Math.floor((y - 16) / 32); pingAt = CLOCK; },
    draw(g, t) {
      txt(g, 'REK 01 · ORBIT', 6, 11, 10, mid(0.8)); txt(g, uptime(), S.w - 6, 11, 10, mid(0.7), 'right');
      LEVELS.forEach((lv, i) => {
        const y = 16 + i * 32, pg = ping === i ? Math.max(0, 1 - (t - pingAt) / 1.2) : 0;
        g.strokeStyle = mid(0.55 + 0.4 * pg); g.strokeRect(4.5, y + 0.5, S.w - 9, 29);
        for (const sx of [10, S.w - 10]) { g.strokeStyle = mid(0.4); g.beginPath(); g.arc(sx, y + 15, 2.2, 0, TAU); g.stroke(); }
        // lcd
        g.fillStyle = mid(0.1); g.fillRect(18, y + 5, 62, 20);
        txt(g, lv.n.slice(0, 7), 22, y + 14, 11, lvc(i, 0.95));
        txt(g, `${String(lv.count).padStart(2, '0')} ${w(lv.count === 1 ? 'TAAK' : 'TAKEN')}`, 22, y + 23, 9, mid(0.6));
        // lampjes per taak
        for (let k = 0; k < 8; k++) {
          const has = k < lv.count, ph = (t / lv.period + hash(i * 31 + k)) % 1, on = has ? (ph < 0.45 ? 1 : 0.25) : 0.06;
          g.fillStyle = has ? lvc(i, Math.max(on, pg)) : mid(on);
          g.fillRect(88 + k * 11, y + 9, 7, 5);
          g.fillStyle = mid(has ? 0.25 : 0.06); g.fillRect(88 + k * 11, y + 17, 7, 3);
        }
        // schijfactiviteit
        for (let d = 0; d < 2; d++) { g.fillStyle = hi(hash(i * 5 + d + Math.floor(t * (8 + i * 3))) > 0.55 ? 0.95 : 0.12); g.beginPath(); g.arc(186 + d * 9, y + 15, 2, 0, TAU); g.fill(); }
        // belasting
        bar(g, 204, y + 11, 60, 8, 0.2 + 0.65 * (Math.sin(t * (0.5 + i * 0.2) + i) * 0.5 + 0.5), 12, false);
        txt(g, pg > 0 ? 'PING' : lv.period.toFixed(1) + 'S', S.w - 18, y + 19, 10, pg > 0 ? hi(1) : mid(0.7), 'right');
      });
    },
  };
}

/* ---- R15 Console met kaarten (tekstconsole + commandocentrum) ---- */
function termmap() {
  const ty = typer(termLines(), 20);
  const cells = Array.from({ length: 22 * 12 }, (_, i) => hash(i * 1.7) > 0.4 ? Math.floor(hash(i * 3.3) * 5) : -1);
  let fast = -9;
  return {
    tap() { fast = CLOCK; },
    draw(g, t) {
      win(g, 4, 4, 170, 177, 'CONSOLE', 0);
      ty(g, 10, 28, 156, 13, t + (t - fast < 3 ? (t - fast) * 30 : 0), 12, 11.4);
      win(g, 178, 4, 124, 84, 'GEHEUGEN', 0);
      const cur = (t * 14) % cells.length;
      cells.forEach((v, i) => { const x = 183 + (i % 22) * 5.2, y = 21 + Math.floor(i / 22) * 5.4; let a = v < 0 ? 0.06 : 0.45 + (4 - v) * 0.1; if (v === 0 && hash(i + Math.floor(t * 5)) > 0.5) a = 1; const curOn = Math.abs(i - cur) < 1; g.fillStyle = curOn ? hi(1) : v < 0 ? mid(a) : lvc(v, a); g.fillRect(x, y, 4.2, 4.2); });
      win(g, 178, 92, 124, 89, 'RADAR', 0);
      const cx = 240, cy = 140, R = 36, sw = (t * 1.4) % TAU;
      LEVELS.forEach(lv => { g.strokeStyle = mid(0.22); g.beginPath(); g.arc(cx, cy, R * lv.ring / 174, 0, TAU); g.stroke(); });
      const cg = g.createConicGradient(sw - 1, cx, cy); cg.addColorStop(0, mid(0)); cg.addColorStop(1 / TAU, mid(0.3)); cg.addColorStop(1 / TAU + 0.001, mid(0)); cg.addColorStop(1, mid(0));
      g.fillStyle = cg; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, sw - 1, sw); g.fill();
      LEVELS.forEach((lv, i) => { for (let k = 0; k < lv.count; k++) { const a = hash(i * 9 + k) * TAU + t * TAU / (lv.period * 6), behind = ((sw - a) % TAU + TAU) % TAU, life = Math.exp(-behind * 0.9); g.fillStyle = lvc(i, 0.15 + 0.85 * life); g.fillRect(cx + Math.cos(a) * R * lv.ring / 174 - 1, cy + Math.sin(a) * R * lv.ring / 174 - 1, 2.4, 2.4); } });
    },
  };
}

/* ---- R16 Draadplotter (draadmodel + plotter) ---- */
function wireplot() {
  let start = 0, first = true;
  const DRAW = 8, HOLD = 3.5;
  return {
    tap() { start = CLOCK; },
    draw(g, t) {
      if (first) { start = t; first = false; }
      if (t - start > DRAW + HOLD) start = t;
      const el = t - start, u = Math.min(1, el / DRAW), spin = el > DRAW ? (el - DRAW) * 0.5 : 0;
      const cx = 108, cy = 66, s = 0.5, tilt = 1.0;
      const Pt = (r, a, z) => { const x = Math.cos(a + spin) * r, y = Math.sin(a + spin) * r; return [cx + x * s, cy + (y * Math.cos(tilt) - z * Math.sin(tilt)) * s]; };
      const lines = [];
      [174, 140, 106, 72, 38].forEach(r => { const l = []; for (let k = 0; k <= 48; k++) l.push(Pt(r, k / 48 * TAU, depth(r))); lines.push(l); });
      for (let m = 0; m < 16; m++) { const l = []; for (let k = 0; k <= 18; k++) { const r = 174 - k / 18 * 166; l.push(Pt(r, m / 16 * TAU, depth(r))); } lines.push(l); }
      const total = lines.reduce((a, l) => a + l.length - 1, 0); let budget = u * total, pen = null;
      g.strokeStyle = mid(0.12); for (let x = 8; x < 216; x += 16) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, 176); g.stroke(); }
      for (const l of lines) {
        if (budget <= 0) break;
        const n = Math.min(l.length - 1, budget); budget -= n;
        g.strokeStyle = n < l.length - 1 ? hi(0.95) : mid(0.65); g.beginPath();
        for (let k = 0; k <= Math.floor(n); k++) k ? g.lineTo(...l[k]) : g.moveTo(...l[k]);
        const fk = Math.floor(n), fr = n - fk;
        if (fr > 0 && fk + 1 < l.length) { const a = l[fk], b = l[fk + 1]; pen = [a[0] + (b[0] - a[0]) * fr, a[1] + (b[1] - a[1]) * fr]; g.lineTo(...pen); }
        else pen = l[fk];
        g.stroke();
      }
      if (u >= 1) { LEVELS.forEach((lv, i) => { for (let k = 0; k < lv.count; k++) { const [x, y] = Pt(lv.ring, k / lv.count * TAU + t * TAU / (lv.period * 4), depth(lv.ring)); g.fillStyle = lvc(i, 0.95); g.fillRect(x - 1, y - 1, 2.4, 2.4); } }); const [kx, ky] = Pt(0, 0, -300); g.fillStyle = hi(1); g.beginPath(); g.arc(kx, ky, 2.5, 0, TAU); g.fill(); }
      else if (pen) { g.strokeStyle = hi(1); g.beginPath(); g.moveTo(pen[0] - 6, pen[1]); g.lineTo(pen[0] + 6, pen[1]); g.moveTo(pen[0], pen[1] - 6); g.lineTo(pen[0], pen[1] + 6); g.stroke(); }
      g.strokeStyle = mid(0.6); g.strokeRect(222.5, 4.5, 80, 176);
      [['MODEL', 'TRECHTER'], ['LIJNEN', `${Math.round(u * 21)}/21`], ['PEN', u < 1 ? 'TEKENT' : 'RUST'], ['DRAAI', `${String(Math.round((spin % TAU) / TAU * 360)).padStart(3, '0')}°`], ['BOLLEN', u < 1 ? '--' : String(DATA.n)]].forEach(([k, v], i) => { txt(g, k, 227, 20 + i * 30, 10, mid(0.6)); txt(g, v, 227, 33 + i * 30, 13, i === 2 && u < 1 ? hi(1) : mid(0.95)); });
      bar(g, 227, 168, 71, 6, u, 10, false);
    },
  };
}

/* ---- R17 Lampenwand (schakelbord groot) ---- */
function lampwall() {
  const COLS = 10, ROWS = 7, MODES = ['GOLF', 'TAKEN', 'SCAN', 'RASTER'], user = new Map();
  return {
    tap(x, y) { const cc = Math.floor((x - 8) / 29.6), r = Math.floor((y - 22) / 21); if (cc >= 0 && cc < COLS && r >= 0 && r < ROWS) user.set(r * COLS + cc, CLOCK); },
    draw(g, t) {
      const mode = Math.floor(t / 6) % 4, mt = t % 6;
      LEVELS.forEach((lv, i) => txt(g, lv.n.slice(0, 3), 8 + i * 59.2 + 29.6, 15, 10, lvc(i, 0.85), 'center'));
      for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) {
        const x = 8 + cc * 29.6, y = 22 + r * 21, lvI = Math.floor(cc / 2), lv = LEVELS[lvI];
        let on = 0;
        if (mode === 0) on = Math.sin((cc + r) * 0.7 - t * 3) > 0.4 ? 1 : 0.1;
        else if (mode === 1) { const idx = (cc % 2) * ROWS + r; on = idx < lv.count ? ((t / lv.period + idx * 0.13) % 1 < 0.5 ? 1 : 0.3) : 0.06; }
        else if (mode === 2) on = Math.floor(mt * 4) % ROWS === r ? 1 : (Math.floor(mt * 4) - 1) % ROWS === r ? 0.4 : 0.08;
        else on = hash(r * 31 + cc + Math.floor(t * 3)) > 0.6 ? 1 : 0.1;
        const ut = user.get(r * COLS + cc), held = ut !== undefined && t - ut < 4;
        g.fillStyle = mid(0.05); g.fillRect(x, y, 25.6, 17);
        g.fillStyle = held ? hi(1) : lvc(lvI, on);
        g.fillRect(x + 3, y + 3, 19.6, 11);
        if (held || on > 0.9) { g.fillStyle = c(P.hi, 0.35); g.fillRect(x + 5, y + 4, 8, 2); }
      }
      txt(g, `${w('PATROON')} ${w(MODES[mode])}`, 8, 178, 11, hi(0.9));
      MODES.forEach((m, i) => { g.fillStyle = i === mode ? hi(1) : mid(0.25); g.beginPath(); g.arc(S.w - 50 + i * 12, 175, 3, 0, TAU); g.fill(); });
    },
  };
}

/* ---- R7 Telescoop ---- */
function scope3() {
  const stars = skyStars();
  const chain = [3]; while (chain.length < 7) { const l = stars[chain[chain.length - 1]]; let b = -1, bd = 1e9; stars.forEach((s, i) => { if (chain.includes(i)) return; const d = Math.hypot(s.x - l.x, s.y - l.y); if (d < bd) { bd = d; b = i; } }); chain.push(b); }
  let cur = 0, from = 0, at = -9, user = false;
  return {
    tap(x, y) { let b = 0, bd = 1e9; stars.forEach((s, i) => { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; b = i; } }); from = cur; cur = b; at = CLOCK; user = true; },
    draw(g, t) {
      if (!user && t - at > 3.2) { from = cur; cur = Math.floor(hash(Math.floor(t / 3.2) + 0.5) * stars.length); at = t; }
      if (user && t - at > 6) user = false;
      // raster van coördinaten
      g.strokeStyle = mid(0.12); g.setLineDash([2, 3]);
      for (let x = 30; x < S.w; x += 50) { g.beginPath(); g.moveTo(x, 12); g.lineTo(x, S.h - 4); g.stroke(); }
      for (let y = 30; y < S.h; y += 40) { g.beginPath(); g.moveTo(4, y); g.lineTo(S.w - 4, y); g.stroke(); }
      g.setLineDash([]);
      for (let x = 30, k = 0; x < S.w; x += 50, k++) txt(g, `${String(k * 2).padStart(2, '0')}H`, x + 2, S.h - 6, 9, mid(0.45));
      // sterrenbeeld
      g.strokeStyle = mid(0.35); g.beginPath(); chain.forEach((i, k) => k ? g.lineTo(stars[i].x, stars[i].y) : g.moveTo(stars[i].x, stars[i].y)); g.stroke();
      for (const s of stars) { const tw = 0.7 + 0.3 * Math.sin(t * 2 + s.ph); g.fillStyle = hi(0.5 + 0.5 * tw); g.fillRect(s.x - s.m / 2, s.y - s.m / 2, s.m + 0.5, s.m + 0.5); }
      // vizier
      const u = ease(Math.min(1, (t - at) / 0.9)), A = stars[from], B = stars[cur];
      const rx = A.x + (B.x - A.x) * u, ry = A.y + (B.y - A.y) * u, R = 14 - 4 * u;
      g.strokeStyle = hi(0.9); g.beginPath(); g.arc(rx, ry, R, 0, TAU); g.stroke();
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + t * 0.4; g.beginPath(); g.moveTo(rx + Math.cos(a) * (R + 2), ry + Math.sin(a) * (R + 2)); g.lineTo(rx + Math.cos(a) * (R + 7), ry + Math.sin(a) * (R + 7)); g.stroke(); }
      txt(g, `RA ${(rx / S.w * 24).toFixed(2)}  DEC +${(90 - ry / S.h * 90).toFixed(1)}`, 6, 12, 10, mid(0.8));
      // zoomvenster
      const zx = S.w - 92, zy = S.h - 88;
      g.fillStyle = c(P.bg, 0.92); g.fillRect(zx, zy, 86, 82);
      win(g, zx, zy, 86, 82, 'ZOOM ×40', 0);
      const cx = zx + 43, cy = zy + 44, pulse = 1 + 0.08 * Math.sin(t * 3);
      g.strokeStyle = mid(0.3); g.beginPath(); g.moveTo(zx + 6, cy); g.lineTo(zx + 80, cy); g.moveTo(cx, zy + 16); g.lineTo(cx, zy + 78); g.stroke();
      const r = 13 * pulse * (0.4 + 0.6 * u); g.fillStyle = hi(0.95); g.beginPath();
      for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + k * Math.PI / 4, rr = k % 2 ? r * 0.22 : r; k ? g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.closePath(); g.fill();
      txt(g, `${w('STER')} ${String(B.n).padStart(3, '0')}`, zx + 5, zy + 77, 10, hi(0.9));
      txt(g, B.d, zx + 82, zy + 77, 10, mid(0.8), 'right');
    },
  };
}

/* ---- R10 Mainframe ---- */
function mainframe() {
  const COLS = 50, ROWS = 14, cells = [];
  let p = 0;
  LEVELS.forEach((lv, i) => { for (let k = 0; k < lv.count; k++) { const len = 6 + Math.floor(hash(i * 9 + k) * 14); for (let j = 0; j < len; j++) cells[p + j] = { lv: i, task: i * 10 + k }; p += len + 2 + Math.floor(hash(k + i) * 5); } });
  let defrag = -9;
  return {
    tap() { defrag = CLOCK; },
    draw(g, t) {
      const cw = (S.w - 12) / COLS, ch = 6.2, x0 = 6, y0 = 16;
      txt(g, 'GEHEUGEN · 0X0000-0X02BC', 6, 11, 10, mid(0.8)); txt(g, `${Math.round(p / (COLS * ROWS) * 100)}% ${w('BEZET')}`, S.w - 6, 11, 10, hi(0.85), 'right');
      const fast = t - defrag < 2.5, cursor = fast ? ((t - defrag) / 2.5) * COLS * ROWS : (t * 9) % (COLS * ROWS);
      for (let i = 0; i < COLS * ROWS; i++) {
        const x = x0 + (i % COLS) * cw, y = y0 + Math.floor(i / COLS) * ch, cell = cells[i];
        let a = 0.07;
        if (cell) { a = cell.lv === 0 ? 0.55 + 0.45 * (hash(cell.task + Math.floor(t * 6)) > 0.4) : 0.3 + 0.12 * (4 - cell.lv); }
        if (Math.abs(i - cursor) < 1) a = 1;
        else if (i < cursor && i > cursor - 6) a = Math.max(a, 0.5 * (1 - (cursor - i) / 6));
        g.fillStyle = Math.abs(i - cursor) < 1 ? hi(1) : cell ? lvc(cell.lv, a) : mid(a); g.fillRect(x, y, cw - 1, ch - 1.2);
      }
      // procestabel
      const ty = y0 + ROWS * ch + 8;
      g.strokeStyle = mid(0.5); g.beginPath(); g.moveTo(6, ty - 3); g.lineTo(S.w - 6, ty - 3); g.stroke();
      txt(g, 'PID   TAAK                  CPU', 8, ty + 8, 10, mid(0.6));
      TASKS.slice(0, 5).forEach((name, i) => {
        const y = ty + 19 + i * 10, cpu = 0.2 + 0.7 * (Math.sin(t * (0.8 + i * 0.37) + i) * 0.5 + 0.5);
        txt(g, String(i + 1).padStart(4, '0'), 8, y, 10, i === 0 ? hi(0.95) : mid(0.8));
        txt(g, name.slice(0, 20), 46, y, 10, i === 0 ? hi(0.95) : mid(0.8));
        bar(g, 214, y - 6, 60, 5, cpu, 10, false);
        txt(g, `${Math.round(cpu * 100)}%`, S.w - 8, y, 10, mid(0.8), 'right');
      });
      if (fast) txt(g, 'DEFRAGMENTEREN...', S.w - 8, ty + 8, 10, Math.floor(t * 4) % 2 ? hi(1) : mid(0.5), 'right');
    },
  };
}

/* ---- R11 Baanplotter ---- */
function plotter() {
  let idx = 0, start = 0, first = true;
  const DUR = 7;
  return {
    tap() { idx = (idx + 1) % LEVELS.length; start = CLOCK; },
    draw(g, t) {
      if (first) { start = t; first = false; }
      if (t - start > DUR + 1.2) { idx = (idx + 1) % LEVELS.length; start = t; }
      const cx = 118, cy = 98, el = (i, a) => { const lv = LEVELS[i], rx = 22 + lv.ring * 0.52, ry = rx * (0.55 + 0.08 * i), rot = -0.35 + i * 0.25; const x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; };
      // assen en raster
      g.strokeStyle = mid(0.18);
      for (let x = 8; x < 230; x += 20) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, S.h - 8); g.stroke(); }
      for (let y = 8; y < S.h; y += 20) { g.beginPath(); g.moveTo(8, y); g.lineTo(228, y); g.stroke(); }
      g.strokeStyle = mid(0.5); g.beginPath(); g.moveTo(8, cy); g.lineTo(228, cy); g.moveTo(cx, 8); g.lineTo(cx, S.h - 8); g.stroke();
      // vorige banen, vaag
      for (let i = 0; i < LEVELS.length; i++) {
        if (i === idx) continue;
        g.strokeStyle = mid(0.16); g.beginPath(); for (let k = 0; k <= 80; k++) { const [x, y] = el(i, k / 80 * TAU); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      }
      // huidige baan: getekend deel en voorspelling
      const u = Math.min(1, (t - start) / DUR), fade = t - start > DUR ? 1 - (t - start - DUR) / 1.2 : 1;
      g.setLineDash([2, 4]); g.strokeStyle = mid(0.45 * fade); g.beginPath();
      for (let k = Math.floor(u * 120); k <= 120; k++) { const [x, y] = el(idx, k / 120 * TAU); k === Math.floor(u * 120) ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke(); g.setLineDash([]);
      g.strokeStyle = hi(0.95 * fade); g.lineWidth = 1.5; g.beginPath();
      for (let k = 0; k <= Math.floor(u * 120); k++) { const [x, y] = el(idx, k / 120 * TAU); k ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.lineWidth = 1;
      const [px, py] = el(idx, u * TAU);
      g.strokeStyle = hi(1); g.beginPath(); g.moveTo(px - 6, py); g.lineTo(px + 6, py); g.moveTo(px, py - 6); g.lineTo(px, py + 6); g.stroke();
      g.fillStyle = hi(1); g.beginPath(); g.arc(px, py, 1.8, 0, TAU); g.fill();
      for (let k = 0; k < LEVELS[idx].count; k++) { const a = k / LEVELS[idx].count * TAU; if (a > u * TAU) continue; const [x, y] = el(idx, a); g.strokeStyle = lvc(idx, 0.95); g.beginPath(); g.moveTo(x - 3, y - 3); g.lineTo(x + 3, y + 3); g.moveTo(x + 3, y - 3); g.lineTo(x - 3, y + 3); g.stroke(); }
      g.fillStyle = hi(1); g.beginPath(); g.arc(cx, cy, 3, 0, TAU); g.fill();
      // metingen
      const lv = LEVELS[idx];
      g.strokeStyle = mid(0.6); g.strokeRect(236.5, 8.5, 64, 169);
      [['BAAN', lv.n], ['OMLOOP', lv.period.toFixed(1) + ' S'], ['TAKEN', String(lv.count)], ['STRAAL', String(lv.ring)], ['VOORTGANG', Math.round(u * 100) + '%'], ['ΔV', (0.2 + 0.3 * Math.sin(t)).toFixed(2)]].forEach(([k, v], i) => {
        txt(g, k, 241, 22 + i * 26, 10, mid(0.6)); txt(g, v, 241, 34 + i * 26, 13, i === 4 ? hi(0.95) : mid(0.95));
      });
    },
  };
}

/* ---- R2 Commandocentrum ---- */
function cmd() {
  const hex = Array.from({ length: 40 }, (_, i) => `${(0x3F00 + i * 16).toString(16).toUpperCase()} ${Array.from({ length: 4 }, (_, j) => Math.floor(hash(i * 5 + j) * 255).toString(16).padStart(2, '0').toUpperCase()).join(' ')}`);
  let zoom = -1, zoomAt = -9;
  const cells = [[4, 4], [106, 4], [208, 4], [4, 76], [106, 76], [208, 76]], CW = 98, CHh = 68;
  const ticker = tickerText();
  return {
    tap(x, y) { cells.forEach(([cx, cy], i) => { if (x > cx && x < cx + CW && y > cy && y < cy + CHh) { zoom = i; zoomAt = CLOCK; } }); },
    draw(g, t) {
      const draws = [
        (x, y, w, h) => { scopeTrace(g, x + 4, y + 14, w - 8, h - 18, t, 1); return 'KERN'; },
        (x, y, w, h) => {
          let k = 0; LEVELS.forEach((lv, i) => { for (let j = 0; j < lv.count; j++, k++) { const ph = (t / lv.period + hash(i * 31 + j)) % 1, on = ph < 0.45; const xx = x + 6 + (k % 9) * 10, yy = y + 16 + Math.floor(k / 9) * 15; g.fillStyle = on ? LV[i] : 'rgba(255,255,255,.07)'; g.globalAlpha = on ? 0.95 : 1; g.fillRect(xx, yy, 7, 9); g.globalAlpha = 1; } });
          return 'LAMPEN';
        },
        (x, y, w, h) => { const off = (t * 4) % 1, i0 = Math.floor(t * 4); g.save(); g.beginPath(); g.rect(x + 2, y + 13, w - 4, h - 15); g.clip(); for (let r = 0; r < 6; r++) txt(g, hex[(i0 + r) % hex.length], x + 5, y + 24 + (r - off) * 9.5, 10, r === 5 ? hi(0.9) : mid(0.65)); g.restore(); return 'GEHEUGEN'; },
        (x, y, w, h) => { const sw = halfRadar(g, x + w / 2, y + h - 6, 40, t); txt(g, `${String(Math.round((sw - Math.PI) / Math.PI * 180)).padStart(3, '0')}°`, x + w - 4, y + 22, 10, mid(0.8), 'right'); return 'SECTOR'; },
        (x, y, w, h) => {
          txt(g, pad3(DATA.total), x + 6, y + 36, 24, hi(0.95)); txt(g, 'STERREN', x + 52, y + 26, 10, mid(0.7)); txt(g, '+1', x + 52, y + 36, 10, hi(Math.floor(t * 2) % 2 ? 0.9 : 0.3));
          txt(g, focusLeft(), x + 6, y + 52, 14, mid(0.95)); txt(g, 'FOCUS', x + 52, y + 52, 10, mid(0.7));
          txt(g, uptime(), x + 6, y + 64, 11, mid(0.7)); return 'TELLERS';
        },
        (x, y, w, h) => { LEVELS.forEach((lv, i) => { const bh = (lv.count / 7) * (h - 26) * (0.9 + 0.1 * Math.sin(t * 2.2 + i)); for (let yy = 0; yy < bh; yy += 3) { g.fillStyle = mid(0.4 + 0.6 * yy / (h - 26)); g.fillRect(x + 8 + i * 18, y + h - 10 - yy, 12, 2); } txt(g, lv.n[0], x + 11 + i * 18, y + h - 1, 9, mid(0.7)); }); return 'MOMENTEN'; },
      ];
      cells.forEach(([x, y], i) => {
        const z = zoom === i ? Math.max(0, 1 - (t - zoomAt) / 1.6) : 0;
        g.save();
        if (z > 0) { const s = 1 + 0.12 * ease(z); g.translate(x + CW / 2, y + CHh / 2); g.scale(s, s); g.translate(-x - CW / 2, -y - CHh / 2); }
        g.strokeStyle = mid(0.6); g.strokeRect(x + 0.5, y + 0.5, CW - 1, CHh - 1);
        const name = draws[i](x, y, CW, CHh);
        g.fillStyle = mid(z > 0 ? 0.9 : 0.15); g.fillRect(x + 1, y + 1, Math.min(CW - 2, name.length * 6 + 10), 10);
        txt(g, name, x + 4, y + 9.5, 10, z > 0 ? c(P.bg, 1) : hi(0.9));
        g.fillStyle = Math.floor(t * 1.5 + i) % 3 ? mid(0.7) : hi(1); g.fillRect(x + CW - 7, y + 4, 3, 3);
        g.restore();
      });
      // lichtkrant
      g.strokeStyle = mid(0.5); g.strokeRect(4.5, 150.5, 300, 30);
      const sh = (t * 30) % (ticker.length * 9.5);
      g.save(); g.beginPath(); g.rect(6, 152, 296, 26); g.clip();
      for (let k = -1; k < 2; k++) txt(g, ticker, 8 - sh + k * ticker.length * 9.5, 172, 18, hi(0.9));
      g.restore();
    },
  };
}

/* ---- R5 Tekstconsole ---- */
function console_() {
  let cmdAt = -9;
  const ty = typer(consoleLines(), 22);
  const CH = '·:+×#';
  return {
    tap() { cmdAt = CLOCK; },
    draw(g, t) {
      const L = 11, X = 6, R = S.w - 6; let y = 6;
      // kader met lijnen (lijntekens hebben in VT323 een andere breedte)
      g.strokeStyle = mid(0.75); g.strokeRect(X + 0.5, y + 5.5, R - X - 1, L * 8 + 6);
      g.fillStyle = c(P.bg, 1); g.fillRect(X + 8, y, 74, 11); g.fillRect(R - 66, y, 60, 11);
      txt(g, 'ORBIT v4', X + 11, y + 9, 12, hi(0.95)); txt(g, uptime(), R - 9, y + 9, 12, mid(0.9), 'right');
      y += 20;
      LEVELS.forEach((lv, i) => {
        const n = 12; let barS = '';
        for (let k = 0; k < n; k++) { const v = k < lv.count * 2 ? ((t / lv.period + k / n) % 1) : -1; barS += v < 0 ? ' ' : CH[Math.min(4, Math.floor((1 - v) * 5))]; }
        const col = i === 0 ? hi(0.95) : mid(0.85);
        txt(g, lv.n, X + 8, y, 12, lvc(i, 0.95));
        g.font = FONT(12); for (let k = 0; k < n; k++) txt(g, barS[k], X + 70 + k * 8, y, 12, col);
        txt(g, String(lv.count), X + 184, y, 12, col, 'right');
        txt(g, lv.period.toFixed(1) + 's', R - 9, y, 12, col, 'right');
        y += L;
      });
      g.strokeStyle = mid(0.45); g.beginPath(); g.moveTo(X, y - 6.5); g.lineTo(R, y - 6.5); g.stroke(); y += 4;
      const k = Math.exp(-((t * BPM / 60) % 1) * 5);
      txt(g, 'KERN', X + 8, y, 12, mid(0.85)); txt(g, '#'.repeat(1 + Math.round(k * 6)), X + 46, y, 12, hi(0.9));
      txt(g, `${BPM}/MIN`, X + 126, y, 12, mid(0.85)); txt(g, `FOCUS ${focusLeft()}`, R - 9, y, 12, mid(0.85), 'right'); y += L;
      txt(g, `${w('STER')} ${pad3(DATA.total)}`, X + 8, y, 12, mid(0.85)); txt(g, `SYNC ${Math.floor(t * 2) % 2 ? '●' : '○'}`, X + 80, y, 12, mid(0.85));
      txt(g, `${w('ARCHIEF')} ${DATA.archive}`, X + 140, y, 12, mid(0.85)); txt(g, `MEM ${(41 + Math.sin(t) * 2).toFixed(1)}%`, R - 9, y, 12, mid(0.85), 'right');
      y += L + 10;
      const boost = t - cmdAt < 3 ? (t - cmdAt) * 40 : 0;
      ty(g, X + 2, y, 290, 5, t + boost, 12, L);
    },
  };
}

const lvc = (i, a = 1) => c(LVRGB[i], a);
return { makers: { scope3, mainframe, plotter, cmd, console: console_, chartroom, rack2, termmap, wireplot, lampwall }, setP: p => { P = p; }, getP: () => P, c };
})();

/* ---- Vlakke schermen in de inkt van Orbit ---- */
const FLAT = (() => {
const TH = {
  light: { ink: [27, 27, 34], ink2: [94, 94, 104], ink3: [154, 154, 163], well: '#E0DDD3', screen: 'rgba(27,27,34,.05)', core: '#E70049', lv: ['#E70049', '#E08600', '#0FAE69', '#1F78B4', '#08415C'], glow: 0 },
  dark:  { ink: [236, 236, 241], ink2: [169, 169, 179], ink3: [110, 110, 120], well: '#0A0A0D', screen: 'rgba(255,255,255,.035)', core: '#F0306A', lv: ['#F0306A', '#F5A623', '#20E08A', '#38A0F0', '#B3B9D6'], glow: 1 },
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const TOP = 34;
const MONO = '500 8px "Geist Mono", ui-monospace, monospace';

function label(g, th, text, x, y, align = 'left', col) { g.font = MONO; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillStyle = col || rgba(th.ink3, 1); g.fillText(w(text), x, y); g.textAlign = 'left'; }
function lamp(g, th, x, y, w, h, col, on) {   // vierkant lampje: uit = schim, aan = kleur (in het donker met een heel zachte gloed)
  g.fillStyle = on > 0.02 ? col : rgba(th.ink, 0.08);
  g.globalAlpha = on > 0.02 ? 0.25 + 0.75 * on : 1;
  if (th.glow && on > 0.4) { g.shadowColor = col; g.shadowBlur = 6 * on; }
  g.beginPath(); g.roundRect(x, y, w, h, Math.min(w, h) * 0.3); g.fill();
  g.shadowBlur = 0; g.globalAlpha = 1;
}

/* ---- P2 Radar ---- */
function radar() {
  const cx = W / 2, cy = TOP + (H - TOP) / 2 + 2, R = 84, SWEEP = 4.2;
  const orbs = [];
  LEVELS.forEach((lv, i) => { for (let k = 0; k < lv.count; k++) orbs.push({ i, r: R * lv.ring / 174, off: k / lv.count * TAU + hash(i * 7 + k) * 0.5, w: TAU / (lv.period * 6), last: -99 }); });
  let ping = null;
  return {
    tap(x, y) { ping = { x, y, t: CLOCK }; },
    draw(g, th, t) {
      // ringen en kruis
      for (const lv of LEVELS) {
        const r = R * lv.ring / 174, n = Math.round(r * 0.55);
        g.fillStyle = rgba(th.ink, 0.22);
        for (let k = 0; k < n; k++) { const a = k / n * TAU; g.fillRect(cx + Math.cos(a) * r - 0.5, cy + Math.sin(a) * r - 0.5, 1, 1); }
      }
      g.strokeStyle = rgba(th.ink, 0.08); g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx - R - 6, cy); g.lineTo(cx + R + 6, cy); g.moveTo(cx, cy - R - 6); g.lineTo(cx, cy + R + 6); g.stroke();
      for (let d = 0; d < 36; d++) {   // graden langs de rand
        const a = d / 36 * TAU, l = d % 9 === 0 ? 5 : 2.5;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4)); g.lineTo(cx + Math.cos(a) * (R + 4 + l), cy + Math.sin(a) * (R + 4 + l)); g.strokeStyle = rgba(th.ink, d % 9 === 0 ? 0.3 : 0.14); g.stroke();
      }
      // zwaai: taps uitdovend
      const sw = (t / SWEEP * TAU) % TAU;
      const cg = g.createConicGradient(sw - 1.2, cx, cy);
      cg.addColorStop(0, rgba(th.ink, 0)); cg.addColorStop(1.2 / TAU, rgba(th.ink, th.glow ? 0.13 : 0.1)); cg.addColorStop(1.2 / TAU + 0.001, rgba(th.ink, 0)); cg.addColorStop(1, rgba(th.ink, 0));
      g.fillStyle = cg; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, sw - 1.2, sw); g.closePath(); g.fill();
      g.strokeStyle = rgba(th.ink, 0.5); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(sw) * R, cy + Math.sin(sw) * R); g.stroke();
      // ping
      let pr = -1;
      if (ping) { pr = (t - ping.t) * 140; if (pr > 260) ping = null; else { g.strokeStyle = rgba(th.ink, 0.35 * (1 - pr / 260)); g.beginPath(); g.arc(ping.x, ping.y, pr, 0, TAU); g.stroke(); } }
      // doelen
      for (const o of orbs) {
        const a = ((o.off + t * o.w) % TAU + TAU) % TAU;
        const x = cx + Math.cos(a) * o.r, y = cy + Math.sin(a) * o.r;
        const behind = ((sw - a) % TAU + TAU) % TAU;
        if (behind < 0.12) o.last = t - behind / TAU * SWEEP;
        if (ping && Math.abs(Math.hypot(x - ping.x, y - ping.y) - pr) < 5) o.last = t;
        const life = Math.exp(-(t - o.last) / 1.7);
        g.globalAlpha = 0.12 + 0.88 * life;
        g.fillStyle = th.lv[o.i];
        if (th.glow && life > 0.3) { g.shadowColor = th.lv[o.i]; g.shadowBlur = 8 * life; }
        g.beginPath(); g.arc(x, y, 2 + 1.2 * life, 0, TAU); g.fill();
        g.shadowBlur = 0; g.globalAlpha = 1;
      }
      // kern
      const beat = (t * BPM / 60) % 1, k = Math.exp(-beat * 6);
      g.fillStyle = th.core; g.beginPath(); g.arc(cx, cy, 3.2 + 1.6 * k, 0, TAU); g.fill();
      // aflezing
      label(g, th, `BRG ${String(Math.round(sw / TAU * 360)).padStart(3, '0')}°`, 14, TOP + 12);
      label(g, th, `${DATA.n} ${w('DOELEN')}`, W - 14, TOP + 12, 'right');
      label(g, th, 'BEREIK 5', 14, H - 12);
      label(g, th, `${BPM} BPM`, W - 14, H - 12, 'right', th.core);
    },
  };
}

/* ---- P5 Schakelbord ---- */
function panel() {
  const lamps = Array.from({ length: 16 }, (_, k) => ({ lv: k % 5, seed: hash(k * 13), user: 0 }));
  const btn = [0, 0, 1];
  const log = panelLog();
  const L = { x: 14, y: TOP + 8, w: 104, h: 104 };
  return {
    tap(x, y) {
      for (let k = 0; k < 16; k++) { const lx = L.x + (k % 4) * 26, ly = L.y + Math.floor(k / 4) * 26; if (x > lx - 3 && x < lx + 23 && y > ly - 3 && y < ly + 23) lamps[k].user = lamps[k].user ? 0 : 1; }
      for (let b = 0; b < 3; b++) { const bx = 226 + b * 34, by = H - 22; if (Math.hypot(x - bx, y - by) < 12) btn[b] = 1 - btn[b]; }
    },
    draw(g, th, t) {
      const line = rgba(th.ink, 0.12);
      // drukknoppen
      lamps.forEach((l, k) => {
        const x = L.x + (k % 4) * 26, y = L.y + Math.floor(k / 4) * 26;
        const step = Math.floor(t / (1.6 + l.seed * 2.4) + l.seed * 9);
        const on = l.user ? 1 : hash(step * 3.7 + k) > 0.45 ? 1 : 0;
        g.fillStyle = rgba(th.ink, 0.05); g.beginPath(); g.roundRect(x - 2, y - 2, 24, 24, 4); g.fill();
        lamp(g, th, x + 2, y + 2, 16, 16, l.user ? th.core : th.lv[l.lv], on);
      });
      // schermpje met staafjes
      const S = { x: 134, y: TOP + 8, w: 178, h: 62 };
      g.fillStyle = th.screen; g.beginPath(); g.roundRect(S.x, S.y, S.w, S.h, 5); g.fill();
      LEVELS.forEach((lv, i) => {
        const bw = 22, gx = S.x + 12 + i * 33, hgt = (lv.count / 7) * (S.h - 22) * (0.92 + 0.08 * Math.sin(t * 2 + i));
        for (let y = 0; y < hgt; y += 4) { g.fillStyle = th.lv[i]; g.globalAlpha = 0.9; g.fillRect(gx, S.y + S.h - 12 - y - 3, bw, 3); }
        g.globalAlpha = 1;
        label(g, th, lv.s, gx, S.y + S.h - 3);
      });
      // logboek
      const B = { x: 134, y: TOP + 78, w: 178, h: 34 };
      g.strokeStyle = line; g.beginPath(); g.moveTo(B.x, B.y - 4); g.lineTo(B.x + B.w, B.y - 4); g.stroke();
      const rate = 0.9, idx = Math.floor(t / rate), frac = ease(Math.min(1, (t / rate - idx) / 0.25));
      g.save(); g.beginPath(); g.rect(B.x, B.y, B.w, B.h); g.clip();
      for (let r = -1; r < 3; r++) {
        const s = log[((idx + r) % log.length + log.length) % log.length];
        const y = B.y + 10 + (r + 1 - frac) * 11;
        label(g, th, '›', B.x, y, 'left', rgba(th.ink3, 1));
        label(g, th, s, B.x + 10, y, 'left', rgba(r === 1 ? th.ink2 : th.ink3, r === 1 ? 1 : 0.7));
      }
      g.restore();
      const cur = Math.floor(t * 2) % 2 === 0;
      if (cur) { g.fillStyle = rgba(th.ink2, 1); g.fillRect(B.x + B.w - 6, B.y + 23, 5, 8); }
      // ledjes en knoppen
      g.strokeStyle = line; g.beginPath(); g.moveTo(14, H - 40); g.lineTo(W - 14, H - 40); g.stroke();
      for (let k = 0; k < 18; k++) {
        const on = (Math.floor(t * 6) - k) % 18 === 0 ? 1 : hash(k + Math.floor(t * 1.3) * 0.13) > 0.7 ? 0.6 : 0.1;
        g.fillStyle = rgba(th.ink, on * 0.85 + 0.05); g.beginPath(); g.arc(18 + k * 10.5, H - 22, 2, 0, TAU); g.fill();
      }
      label(g, th, 'SYS', 18, H - 9);
      for (let b = 0; b < 3; b++) {
        const bx = 226 + b * 34, by = H - 22;
        g.strokeStyle = rgba(th.ink, 0.3); g.beginPath(); g.arc(bx, by, 9, 0, TAU); g.stroke();
        g.fillStyle = btn[b] ? (b === 2 ? th.core : rgba(th.ink, 0.85)) : rgba(th.ink, 0.08);
        if (th.glow && btn[b] && b === 2) { g.shadowColor = th.core; g.shadowBlur = 6; }
        g.beginPath(); g.arc(bx, by, 5, 0, TAU); g.fill(); g.shadowBlur = 0;
      }
    },
  };
}

/* ---- P7 Draadmodel ---- */
function wire() {
  const PROF = [[0, -300], [38, -200], [72, -125], [106, -70], [140, -30], [174, 0]];
  const depth = r => { for (let i = 1; i < PROF.length; i++) if (r <= PROF[i][0]) { const [r0, z0] = PROF[i - 1], [r1, z1] = PROF[i]; return z0 + (r - r0) / (r1 - r0) * (z1 - z0); } return 0; };
  let tilt = 0.95, want = 0.95;
  return {
    tap() { want = want > 0.5 ? 0.25 : 0.95; },
    draw(g, th, t) {
      tilt += (want - tilt) * 0.06;
      const cx = 96, cy = TOP + 58, s = 0.42, spin = t * 0.25;
      const P = (r, a, z) => { const x = Math.cos(a + spin) * r, y = Math.sin(a + spin) * r; const y2 = y * Math.cos(tilt) - z * Math.sin(tilt); return [cx + x * s, cy + y2 * s * -1 * -1]; };
      // ringen
      for (const r of [24, 38, 72, 106, 140, 174]) {
        g.strokeStyle = rgba(th.ink, r === 174 ? 0.4 : 0.22); g.beginPath();
        for (let k = 0; k <= 48; k++) { const [x, y] = P(r, k / 48 * TAU, depth(r)); k ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
      // meridianen
      for (let m = 0; m < 16; m++) {
        const a = m / 16 * TAU; g.strokeStyle = rgba(th.ink, 0.13); g.beginPath();
        for (let k = 0; k <= 20; k++) { const r = 10 + k / 20 * 164, [x, y] = P(r, a, depth(r)); k ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }
      // bollen
      LEVELS.forEach((lv, i) => { for (let k = 0; k < lv.count; k++) { const a = k / lv.count * TAU + t * TAU / (lv.period * 4), [x, y] = P(lv.ring, a, depth(lv.ring)); g.fillStyle = th.lv[i]; g.beginPath(); g.arc(x, y, 1.9, 0, TAU); g.fill(); } });
      const [kx, ky] = P(0, 0, -300); g.fillStyle = th.core; g.beginPath(); g.arc(kx, ky, 3, 0, TAU); g.fill();
      label(g, th, `${w('TRECHTER')} · ${DATA.n}`, 14, H - 12);
      // halve radar
      const rx = 252, ry = TOP + 84, rr = 56;
      g.strokeStyle = rgba(th.ink, 0.22);
      for (let k = 1; k <= 4; k++) { g.beginPath(); g.arc(rx, ry, rr * k / 4, Math.PI, TAU); g.stroke(); }
      for (let k = 0; k <= 6; k++) { const a = Math.PI + k / 6 * Math.PI; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx + Math.cos(a) * rr, ry + Math.sin(a) * rr); g.stroke(); }
      g.beginPath(); g.moveTo(rx - rr - 4, ry); g.lineTo(rx + rr + 4, ry); g.stroke();
      const sw = Math.PI + (Math.sin(t * 0.6) * 0.5 + 0.5) * Math.PI;
      g.fillStyle = rgba(th.ink, th.glow ? 0.16 : 0.12); g.beginPath(); g.moveTo(rx, ry); g.arc(rx, ry, rr, sw - 0.45, sw); g.closePath(); g.fill();
      g.fillStyle = th.core; g.beginPath(); g.arc(rx + Math.cos(sw) * rr * 0.7, ry + Math.sin(sw) * rr * 0.7, 2, 0, TAU); g.fill();
      label(g, th, 'SECTOR', rx - rr, ry + 14);
      label(g, th, `${String(Math.round((sw - Math.PI) / Math.PI * 180)).padStart(3, '0')}°`, rx + rr, ry + 14, 'right');
      // niveaubalk
      const bx = rx - rr, byy = H - 44, segs = 10, done = Math.round(DATA.today * segs);
      for (let k = 0; k < segs; k++) { g.fillStyle = k < done ? rgba(th.ink, 0.35 + k * 0.06) : rgba(th.ink, 0.08); g.fillRect(bx + k * 9, byy, 6, 12); }
      label(g, th, `${Math.round(DATA.today * 100)}% ${w('VANDAAG')}`, bx, H - 12, 'left', rgba(th.ink2, 1));
    },
  };
}

return { makers: { panel, wire, radar }, TH };
})();

// volgorde zoals de favorieten van Victor (03/11/2026)
export const SCREENS = [['crt', 'scope3'], ['crt', 'mainframe'], ['crt', 'plotter'], ['crt', 'cmd'], ['crt', 'console'], ['crt', 'chartroom'], ['crt', 'rack2'],
  ['crt', 'termmap'], ['crt', 'wireplot'], ['crt', 'lampwall'], ['flat', 'panel'], ['flat', 'wire'], ['flat', 'radar']];

const mixRgb = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
// fosfor uit de kleurkiezer: de kleur zelf, een lichtere voor het heetste licht, een donkerdere en een bijna zwarte buis
function phosphor(hex) {
  if (!hex) return { hi: [253, 230, 138], mid: [251, 146, 60], lo: [224, 71, 59], bg: [14, 8, 6] };
  const col = hexRgb(hex);
  return { hi: mixRgb(col, [255, 248, 232], 0.55), mid: col, lo: mixRgb(col, [0, 0, 0], 0.3), bg: mixRgb([10, 10, 13], col, 0.05) };
}

export function createPanel({ reducedMotion, accent, getData, onScreen }) {
  let idx = 0;
  try { const v = Number(localStorage.getItem(PANEL_KEY)); if (Number.isInteger(v) && v >= 0 && v < SCREENS.length) idx = v; } catch { /* geen opslag */ }
  let lastNow = 0, cv = null, g = null, off = null, og = null, small = null, sg = null, pat = null, maker = null, sig = '', dataAt = 0, lastAccent;
  const dpr = Math.min(2, devicePixelRatio || 1);

  function refresh(force) {
    const now = performance.now();
    if (!force && now - dataAt < 1000) return;
    dataAt = now;
    const d = getData?.() || {};
    const tasks = d.tasks || [];
    LEVELS.forEach((lv, i) => { lv.count = tasks.filter(t => t.level === i + 1).length; });
    TASKS.length = 0;
    for (const t of [...tasks].sort((a, b) => a.level - b.level)) TASKS.push(String(t.title || '').toUpperCase());
    Object.assign(DATA, { n: tasks.length, total: d.total || 0, archive: d.archive || 0, today: Math.min(1, Math.max(0, d.today || 0)), stars: d.stars || [], sync: d.sync || 'off' });
    BPM = 60 + 4 * Math.min(6, LEVELS[0].count) + 2 * Math.min(4, LEVELS[1].count);
    // een scherm dat zijn gegevens bij het maken vastlegt, wordt opnieuw gemaakt als de toestand wezenlijk verandert
    const next = [LEVELS.map(l => l.count).join(','), DATA.total, DATA.stars.length, TASKS.slice(0, 5).join('|')].join(';');
    if (next !== sig) { sig = next; maker = null; }
  }
  const kind = () => SCREENS[idx][0];
  function current() {
    if (!maker) maker = (kind() === 'crt' ? CRT : FLAT).makers[SCREENS[idx][1]]();
    return maker;
  }
  function theme() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }

  function draw(now) {
    refresh(false);
    const a = accent?.() || null;
    if (a !== lastAccent) { CRT.setP(phosphor(a)); lastAccent = a; }
    // de tijd gaat nooit terug: een tekenbeurt buiten de lus (performance.now) kan iets later liggen dan het volgende beeld
    lastNow = Math.max(lastNow, now);
    const t = reducedMotion.matches ? 14 : lastNow / 1000, m = current();
    CLOCK = t;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (kind() === 'flat') { m.draw(g, FLAT.TH[theme()], t); return; }
    // CRT: scherm op een eigen canvas, dan nagloed (verkleinde kopie opgeschaald, geen blurfilter), scanlijnen en vignet
    const P = CRT.getP(), c = CRT.c;
    og.setTransform(dpr, 0, 0, dpr, 0, 0);
    og.clearRect(0, 0, S.w, S.h);
    m.draw(og, t);
    g.save();
    g.beginPath(); g.roundRect(S.x, S.y, S.w, S.h, 10); g.clip();
    const bg = g.createRadialGradient(S.x + S.w / 2, S.y + S.h / 2, 10, S.x + S.w / 2, S.y + S.h / 2, S.w * 0.7);
    bg.addColorStop(0, c(P.bg.map(v => v + 10), 1)); bg.addColorStop(1, c(P.bg, 1));
    g.fillStyle = bg; g.fillRect(S.x, S.y, S.w, S.h);
    const flick = reducedMotion.matches ? 1 : 0.94 + 0.06 * hash(Math.floor(t * 24));
    sg.clearRect(0, 0, small.width, small.height); sg.drawImage(off, 0, 0, small.width, small.height);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.7 * flick; g.drawImage(small, S.x - 2, S.y - 2, S.w + 4, S.h + 4);
    g.globalAlpha = flick; g.drawImage(off, S.x, S.y, S.w, S.h);
    if (!reducedMotion.matches) {
      const by = S.y + ((t * 22) % (S.h + 60)) - 30, band = g.createLinearGradient(0, by - 24, 0, by + 24);
      band.addColorStop(0, c(P.mid, 0)); band.addColorStop(0.5, c(P.mid, 0.05)); band.addColorStop(1, c(P.mid, 0));
      g.globalAlpha = 1; g.fillStyle = band; g.fillRect(S.x, by - 24, S.w, 48);
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = pat; g.fillRect(S.x, S.y, S.w, S.h);
    const v = g.createRadialGradient(S.x + S.w / 2, S.y + S.h / 2, S.h * 0.35, S.x + S.w / 2, S.y + S.h / 2, S.w * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = v; g.fillRect(S.x, S.y, S.w, S.h);
    g.restore();
    g.strokeStyle = theme() === 'light' ? 'rgba(27,27,34,.35)' : 'rgba(255,255,255,.08)';
    g.lineWidth = 1; g.beginPath(); g.roundRect(S.x - 0.5, S.y - 0.5, S.w + 1, S.h + 1, 10.5); g.stroke();
  }

  return {
    own: true,
    init() {}, step() {}, move() {}, leave() {},
    tap(p) {
      const m = current(), x = p.x / 325.6 * W, y = p.y / 226.8 * H;
      if (kind() === 'crt') m.tap?.(x - S.x, y - S.y); else m.tap?.(x, y);
      if (cv) draw(performance.now());
    },
    mount(el) {
      if (cv) return;
      // VT323 pas laden als het paneel er is
      if (!document.querySelector('link[data-vt323]')) {
        const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=VT323&display=swap' });
        l.dataset.vt323 = ''; document.head.append(l);
      }
      cv = document.createElement('canvas');
      cv.className = 'panel-canvas'; cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      el.append(cv);
      g = cv.getContext('2d');
      off = document.createElement('canvas'); off.width = Math.round(S.w * dpr); off.height = Math.round(S.h * dpr); og = off.getContext('2d');
      small = document.createElement('canvas'); small.width = Math.round(S.w / 3); small.height = Math.round(S.h / 3); sg = small.getContext('2d');
      const scan = document.createElement('canvas'); scan.width = 4; scan.height = 3;
      const sc = scan.getContext('2d'); sc.fillStyle = 'rgba(0,0,0,.32)'; sc.fillRect(0, 2, 4, 1);
      pat = g.createPattern(scan, 'repeat');
      refresh(true);
      onScreen?.(idx, SCREENS.length);
      draw(performance.now());
      document.fonts?.load('12px VT323').then(() => { if (cv) draw(performance.now()); }).catch(() => {});
    },
    // elk beeld vanuit de lus van het bakje (loopt enkel in de focusmodus en met een zichtbaar tabblad)
    frame(now) { if (cv) draw(now); },
    unmount() { cv?.remove(); cv = null; maker = null; },
    recolor() { lastAccent = undefined; if (cv) draw(performance.now()); },
    next(dir = 1) {
      idx = (idx + dir + SCREENS.length) % SCREENS.length;
      try { localStorage.setItem(PANEL_KEY, String(idx)); } catch { /* geen opslag */ }
      maker = null;
      onScreen?.(idx, SCREENS.length);
      if (cv) draw(performance.now());
    },
  };
}
