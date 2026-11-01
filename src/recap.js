/* ---- Maandrecap: Poster ---- */
// Gekozen door Victor uit vijf voorstellen (Hemelkaart, Klok, Kalender, Poster, Banen; 01/11/2026). Een affiche in risodruk
// met twee kleuren: het aantal sterren groot in rode stippen (de stippencijfers van de klok), eronder de maand als een
// lint van stippen per dag (de drukste dag in rood) en de vijf momenten als kometen, lang naar hoeveel je ervan afrondde.
// Onderaan drie cijfers. Getekend op een canvas van 1080 px breed (post 4:5 of story 9:16), licht of donker, zonder
// taaktitels: wat je deelt, blijft van jou. Alles komt uit gegevens die Orbit al bijhoudt (logboek, prestaties, archief).
import { LEVELS } from './config.js';

const KEY = 'priority-orbit.recap.v1';            // per toestel: {said: 'JJJJ-MM-DD', seen: {'JJJJ-MM': ts}, theme, fmt}
const DAY = 86400000;

export function loadRecap() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') return { seen: {}, ...s }; } catch { /* geen opslag */ }
  return { seen: {} };
}
export function saveRecap(r) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* geen opslag */ } }
export const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const monthStart = (y, m) => new Date(y, m, 1);

// Cijfers van één maand (start = eerste dag, lokale tijd)
export function monthStats(start, { done, feats, archive }) {
  const y = start.getFullYear(), m = start.getMonth();
  const from = start.getTime(), to = new Date(y, m + 1, 1).getTime();
  const prevFrom = new Date(y, m - 1, 1).getTime();
  const days = new Date(y, m + 1, 0).getDate();
  const perDay = new Array(days).fill(0), hours = new Array(24).fill(0), levels = [0, 0, 0, 0, 0];
  const levelOf = new Map(archive.map(a => [a.id, a.level]));
  let total = 0, prev = 0;
  for (const [id, t] of Object.entries(done)) {
    if (t >= prevFrom && t < from) prev++;
    if (t < from || t >= to) continue;
    total++;
    const d = new Date(t);
    perDay[d.getDate() - 1]++;
    hours[d.getHours()]++;
    const lv = feats.log?.[id]?.lv || levelOf.get(id);
    if (lv >= 1 && lv <= 5) levels[lv - 1]++;
  }
  let busiest = -1, best = 0;
  perDay.forEach((n, i) => { if (n > best) { best = n; busiest = i; } });
  let streak = 0, run = 0;
  for (const n of perDay) { run = n ? run + 1 : 0; streak = Math.max(streak, run); }
  let hour = -1, hn = 0;
  hours.forEach((n, h) => { if (n > hn) { hn = n; hour = h; } });
  const newFeats = Object.values(feats.unlocked || {}).filter(t => t >= from && t < to).length;
  // minuten gefocust met de zandloper (Victor, 01/11/2026): focusblokken staan als {tijdstip: minuten}
  let focusMin = 0;
  for (const [t, min] of Object.entries(feats.focus || {})) { const ts = Number(t); if (ts >= from && ts < to && Number.isFinite(min)) focusMin += min; }
  return { start, days, total, prev, perDay, hours, levels, busiest, busiestN: best, streak, hour, newFeats, focusMin };
}

/* ---- Tekenen ---- */
const INK = { light: [27, 27, 34], dark: [236, 236, 241] };
const PAPER = { light: '#F1F1EF', dark: '#0F0F12' };
const INK3 = { light: '#9A9AA3', dark: '#6E6E78' };
const INK2 = { light: '#5E5E68', dark: '#A3A3AD' };
const CORE = { light: '#E70049', dark: '#F0306A' };
const MONO = '"Geist Mono", ui-monospace, Menlo, monospace', SANS = '"Geist", system-ui, -apple-system, sans-serif';
// stippencijfers van 5 × 7, dezelfde vormen als de matrixklok
const GLYPH = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], 1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], 3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], 5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], 7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], 9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function grain(g, W, H, dark) {
  const n = document.createElement('canvas'); n.width = n.height = 180;
  const x = n.getContext('2d'), im = x.createImageData(180, 180);
  let s = 3;
  for (let i = 0; i < im.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = s % 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0);
  g.save(); g.globalAlpha = dark ? 0.05 : 0.07; g.globalCompositeOperation = dark ? 'screen' : 'multiply';
  g.fillStyle = g.createPattern(n, 'repeat'); g.fillRect(0, 0, W, H); g.restore();
}
function matrix(g, text, x, y, cell, col, ghost) {
  let cx = x;
  for (const ch of text) {
    const gl = GLYPH[ch];
    if (gl) for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
      const on = gl[r][c] === '1';
      g.fillStyle = on ? col : ghost;
      g.beginPath(); g.arc(cx + c * cell + cell / 2, y + r * cell + cell / 2, cell * (on ? 0.4 : 0.22), 0, Math.PI * 2); g.fill();
    }
    cx += cell * 6;
  }
}
function comet(g, x, y, len, r, col) {
  const gr = g.createLinearGradient(x, y, x - len, y);
  gr.addColorStop(0, col); gr.addColorStop(1, col + '00');
  g.fillStyle = gr; g.beginPath();
  g.moveTo(x, y - r); g.lineTo(x - len, y - r * 0.2); g.lineTo(x - len, y + r * 0.2); g.lineTo(x, y + r); g.fill();
  g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}
function label(g, text, x, y, size, col, align = 'left', weight = 500, track = 0.16) {
  g.font = `${weight} ${size}px ${MONO}`; g.fillStyle = col; g.textAlign = align; g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) g.letterSpacing = `${size * track}px`;
  g.fillText(String(text).toUpperCase(), x, y);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}
function sans(g, text, x, y, size, col, align = 'left', weight = 500) {
  g.font = `${weight} ${size}px ${SANS}`; g.fillStyle = col; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(text, x, y);
}
// past de tekst niet, dan kleiner tot hij past (cijfers onderaan, lange maandnamen)
function fitSans(g, text, x, y, size, maxW, col, weight = 500) {
  let s = size;
  for (; s > size * 0.6; s -= 1) { g.font = `${weight} ${s}px ${SANS}`; if (g.measureText(text).width <= maxW) break; }
  sans(g, text, x, y, s, col, 'left', weight);
}

// s = monthStats(...), t = { tx, locale }; geeft het canvas terug (1080 breed)
export function drawPoster(cv, s, { theme = 'dark', fmt = 'post', tx, locale }) {
  const W = 1080, H = fmt === 'story' ? 1920 : 1350, dark = theme === 'dark', story = fmt === 'story';
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const ink = INK[theme], ink2 = INK2[theme], ink3 = INK3[theme], core = CORE[theme];
  g.fillStyle = PAPER[theme]; g.fillRect(0, 0, W, H);
  grain(g, W, H, dark);
  const month = new Intl.DateTimeFormat(locale, { month: 'long' }).format(s.start);
  const prevMonth = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(s.start.getFullYear(), s.start.getMonth() - 1, 1));
  const L = 72;

  // hoeken, zoals een platenhoes
  label(g, 'Orbit tasks', L, 104, 26, rgba(ink, 1), 'left', 600, 0.2);
  label(g, `${month} ${s.start.getFullYear()}`, W - L, 104, 22, ink3, 'right');
  label(g, 'victorvansande.github.io/orbit', L, H - 64, 18, ink3);

  // het getal, groot in rode stippen; de omschrijving ernaast als dat past, anders eronder
  const big = String(s.total), top = story ? 300 : 190;
  let cell = story ? 44 : 38;
  const room = W - 2 * L;
  while (big.length * cell * 6 - cell > room * 0.62 && cell > 22) cell -= 1;
  const bw = big.length * cell * 6 - cell;
  matrix(g, big, L, top, cell, core, rgba(ink, 0.06));
  const what = tx('recap.starsIn', { month });
  const besides = W - L - (L + bw + 30) >= 300;
  const wx = besides ? L + bw + 30 : L, wy = besides ? top + cell * 7 - 10 : top + cell * 7 + 56;
  fitSans(g, what, wx, wy, 34, W - L - wx, rgba(ink, 1));
  if (s.prev) {
    const d = s.total - s.prev;
    label(g, tx('recap.vs', { d: d > 0 ? `+${d}` : String(d), month: prevMonth }), wx, wy + 40, 17, ink3);
  }

  // per dag: een lint van stippen, de drukste dag in rood
  // story: alles over de volle hoogte verdeeld (hoger lint, ruimere kometen), anders bleef er onderaan een gat
  const ly = (besides ? top + cell * 7 : wy + 40) + (story ? 190 : 100), lintH = story ? 250 : 130;
  const max = Math.max(1, ...s.perDay), colW = room / s.days, step = Math.min(story ? 20 : 14, lintH / max), dot = Math.min(story ? 6 : 4.6, step * 0.34 + 1.2);
  label(g, tx('recap.perDay'), L, ly - 24, 17, ink3);
  // beste uur (Victor, 01/11/2026): klein rechts boven het lint, het uur waarop de meeste sterren vielen
  if (s.hour >= 0) label(g, tx('recap.hour', { h: `${String(s.hour).padStart(2, '0')}:00` }), W - L, ly - 24, 17, ink2, 'right');
  for (let d = 0; d < s.days; d++) for (let k = 0; k < s.perDay[d]; k++) {
    g.fillStyle = d === s.busiest ? core : rgba(ink, 0.85);
    g.beginPath(); g.arc(L + d * colW + colW / 2, ly + lintH - k * step, dot, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = rgba(ink, 0.18); g.fillRect(L, ly + lintH + 12, room, 1.5);
  label(g, '1', L + colW / 2, ly + lintH + 42, 14, ink3, 'center', 500, 0.05);
  label(g, String(s.days), L + (s.days - 0.5) * colW, ly + lintH + 42, 14, ink3, 'center', 500, 0.05);

  // per moment: vijf kometen
  const cy0 = ly + lintH + (story ? 190 : 98), mx = Math.max(1, ...s.levels), gap = story ? 76 : 44;
  label(g, tx('recap.perLevel'), L, cy0 - 26, 17, ink3);
  LEVELS.forEach((lv, i) => {
    const y = cy0 + 20 + i * gap, len = 40 + (W - 440) * s.levels[i] / mx;
    comet(g, L + 140 + len, y, len, story ? 11 : 9, dark ? lv.dark : lv.color);
    label(g, lv.name, L, y + 7, 17, ink2, 'left', 500, 0.12);
    label(g, String(s.levels[i]), L + 168 + len, y + 7, 17, rgba(ink, 1), 'left', 500, 0.05);
  });

  // drie cijfers onderaan
  const busiest = s.busiest >= 0 ? new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(s.start.getFullYear(), s.start.getMonth(), s.busiest + 1)) : '–';
  const fm = s.focusMin, focus = fm >= 60 ? tx('recap.hm', { h: Math.floor(fm / 60), m: fm % 60 }) : tx('recap.min', { n: fm });
  const cells = [[busiest, tx('recap.busiest', { n: s.busiestN })], [tx('recap.days', { n: s.streak }), tx('recap.streak')], [focus, tx('recap.focus')], [tx('recap.featsN', { n: s.newFeats }), tx('recap.feats')]];
  const cw = room / cells.length;
  cells.forEach(([v, k], i) => {
    const x = L + i * cw;
    fitSans(g, v, x, H - 220, 40, cw - 20, rgba(ink, 1));
    label(g, k, x, H - 180, 15, ink3, 'left', 500, 0.12);
  });
  return cv;
}

export const posterName = (s) => `orbit-${monthKey(s.start)}.png`;
export function posterBlob(cv) { return new Promise(res => cv.toBlob(res, 'image/png')); }
export const RECAP_DAY = DAY;
