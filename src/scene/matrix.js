/* ---- Matrixklok: cijfers van 5 × 7 stippen, zoals in Kwick ---- */
// Elk teken is een eigen SVG; bij een nieuwe minuut wordt alleen het gewijzigde cijfer opnieuw opgebouwd,
// zodat enkel dat cijfer zijn stippen laat oplichten. Subtiele lichte gloed (#dm-glow) voor actieve stippen (Victor, 06/11/2026).

const GLYPHS = {
  '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ':': ['.', '.', '#', '.', '#', '.', '.'],
  // vlammetje voor de dagen op rij (R4 Matrixwissel, Victor 10/11/2026); grafiet of rood via .dm-flame in styles.css
  'f': ['..#..', '.##..', '.###.', '#.###', '#..##', '##.##', '.###.'],
};

const NS = 'http://www.w3.org/2000/svg';

// De stippen staan in een groep: de gloed (#dm-glow) zit op die groep, één filter per teken, behalve de dubbele punt
// (Safari op iOS tekent een filter op zo'n smal teken niet; Victor, 08/11/2026: "de dubbele punt is plots weg").
function dotGroup(svg) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'dm-dots');
  svg.append(g);
  return g;
}

function glyph(ch) {
  const rows = GLYPHS[ch];
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', ch === ':' ? 'dm dm-colon' : ch === 'f' ? 'dm dm-flame' : 'dm');
  svg.setAttribute('viewBox', `-0.5 -0.5 ${rows[0].length} 7`);
  svg.setAttribute('aria-hidden', 'true');
  const dots = dotGroup(svg);
  rows.forEach((row, y) => [...row].forEach((v, x) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x);
    c.setAttribute('cy', y);
    c.setAttribute('r', v === '#' ? 0.4 : 0.33);
    c.setAttribute('class', v === '#' ? 'o' : 'g');
    // elke stip licht op met een eigen kleine vertraging
    if (v === '#') c.style.setProperty('--d', `${(((x * 7 + y * 13) % 17) / 17 * 0.55).toFixed(2)}s`);
    dots.append(c);
  }));
  return svg;
}

// Zet de tekst (bv. "09:41") in de container; ongewijzigde tekens blijven staan
export function setMatrix(root, text) {
  if (root._morphT) { root._pending = text; return; }   // een wissel loopt: die toont straks de nieuwste tekst
  const chars = [...text].filter(ch => GLYPHS[ch]);
  const prev = root._chars || [];
  if (prev.length !== chars.length) root.replaceChildren();
  chars.forEach((ch, i) => {
    if (prev[i] === ch && root.children[i]) return;
    const node = glyph(ch);
    if (root.children[i]) root.children[i].replaceWith(node);
    else root.append(node);
  });
  root._chars = chars;
  root.setAttribute('aria-label', text);
}

// Wissel met ruis (V5, Victor 03/11/2026): het raster vervalt in flikkerende ruis die van links naar rechts
// bezinkt in de nieuwe tekst; elke stip valt op zijn eigen moment vast, met een klein opspringen. Sinds 04/11/2026
// voor elke stippenmatrix (Victor: "overal waar er een dot matrix is ... dezelfde animatie"): ook met een dubbelpunt
// (klok, zandloper) en vanuit het niets (een lege matrix, zoals het venster van de maandwissel). only: enkel de tekens
// die veranderen vallen in ruis, de rest blijft staan (klok, zandloper). Zonder animatie gewoon setMatrix. onSwap loopt
// halverwege (label wisselen); zonder onSwap zet morphMatrix zelf het aria-label. ms: duur van de wissel; een tragere
// wissel (de datum in het venster van de maandwissel) flikkert ook rustiger (het aantal tikken groeit met de wortel).
export const NOISE_MS = 1250;
const NOISE_TICKS = 26;
const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
const lit = (ch, x, y) => { const g = GLYPHS[ch]; return !!g && x < g[0].length && g[y][x] === '#'; };
export function morphMatrix(root, text, { still = false, only = false, onSwap, ms = NOISE_MS } = {}) {
  cancelAnimationFrame(root._morphT); root._morphT = 0;
  const from = root._chars || [], to = [...text].filter(ch => GLYPHS[ch]);
  if (!onSwap) root.setAttribute('aria-label', text);
  if (still) { setMatrix(root, text); onSwap?.(); return; }
  // rechts uitgelijnd: een getal met een cijfer meer krijgt vooraan een vakje dat openschuift (of dichtschuift)
  const n = Math.max(from.length, to.length), cells = [];
  const F = [...Array(n - from.length).fill(' '), ...from], T = [...Array(n - to.length).fill(' '), ...to];
  const grow = from.length ? n - from.length : 0, shrink = n - to.length;
  const width = i => (GLYPHS[T[i]] || GLYPHS[F[i]])[0].length;
  const w = Array.from({ length: n }, (_, i) => width(i) + 1).reduce((a, b) => a + b, 0) - 1;
  let gx0 = 0;
  const svgs = Array.from({ length: n }, (_, i) => {
    const cw = width(i), keep = only && F[i] === T[i];
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', (cw === 1 ? 'dm dm-colon' : 'dm') + (T[i] === 'f' || (T[i] === ' ' && F[i] === 'f') ? ' dm-flame' : '') + (i < grow ? ' is-gone' : '')); svg.setAttribute('viewBox', `-0.5 -0.5 ${cw} 7`); svg.setAttribute('aria-hidden', 'true');
    const dots = dotGroup(svg);
    for (let y = 0; y < 7; y++) for (let x = 0; x < cw; x++) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', y);
      const gx = gx0 + x;
      cells.push({ c, x, y, gx, i, keep, go: hash(gx, y + 9) * 0.18, lock: 0.32 + gx / w * 0.4 + hash(gx, y) * 0.2, k: '' });
      dots.append(c);
    }
    gx0 += cw + 1;
    return svg;
  });
  const set = (cell, on, pop) => {
    const k = on ? (pop ? 'p' : 'o') : 'g';
    if (k === cell.k) return;
    cell.k = k;
    cell.c.setAttribute('class', on ? 'o n' : 'g');   // n: zonder de oplicht-animatie van een gewoon cijfer
    cell.c.setAttribute('r', on ? (pop ? 0.5 : 0.4) : 0.33);
  };
  cells.forEach(cell => set(cell, lit(F[cell.i], cell.x, cell.y), false));
  root.replaceChildren(...svgs);
  if (grow) { root.getBoundingClientRect(); svgs.slice(0, grow).forEach(svg => svg.classList.remove('is-gone')); }
  let shrunk = false;
  root._pending = text;
  let swapped = false;
  const t0 = performance.now(), ticks = Math.round(NOISE_TICKS * Math.sqrt(ms / NOISE_MS));
  const step = now => {
    const p = Math.min(1, (now - t0) / ms), tick = Math.floor(p * ticks);
    for (const cell of cells) {
      if (cell.keep) continue;
      const on = p < cell.go ? lit(F[cell.i], cell.x, cell.y) : p >= cell.lock ? lit(T[cell.i], cell.x, cell.y) : hash(cell.gx * 7 + tick, cell.y * 3 + tick) < 0.42;
      set(cell, on, p >= cell.lock && p < cell.lock + 0.08);
    }
    if (!swapped && p >= 0.5) { swapped = true; onSwap?.(); }
    if (shrink && !shrunk && p >= 0.6) { shrunk = true; svgs.slice(0, shrink).forEach(svg => svg.classList.add('is-gone')); }
    if (p < 1) { root._morphT = requestAnimationFrame(step); return; }
    root._morphT = 0;
    svgs.slice(0, shrink).forEach(svg => svg.remove());
    root._chars = to;
    if (root._pending !== text) setMatrix(root, root._pending);   // intussen een nieuwe tekst
  };
  root._morphT = requestAnimationFrame(step);
}

// Vlammetje dat leeft (Victor, 10/11/2026: "Kan je het vlammetje wat laten animeren in haar matrix box?"): de onderste
// rijen blijven staan, de bovenkant wisselt tussen een paar vormen in hetzelfde raster. Rood: levendig flakkeren
// (140 tot 260 ms per beeld, de punt wiegt links en rechts); grafiet: traag smeulen (enkel de punt dooft en komt terug).
// Loopt op zijn eigen klok zolang er een vlammetje in de teller staat, niet tijdens een wissel, niet buiten beeld.
const FLAMES = [
  ['..#..', '.##..', '.###.', '#.###', '#..##', '##.##', '.###.'],
  ['...#.', '..##.', '.###.', '##.##', '#..##', '##.##', '.###.'],
  ['.#...', '.##..', '.###.', '###.#', '##..#', '##.##', '.###.'],
  ['..#..', '..##.', '.####', '#.###', '#..##', '##.##', '.###.'],
  ['.....', '..#..', '.###.', '#.###', '#..##', '##.##', '.###.'],
];
export function liveFlame(root, { still, hot, seen }) {
  let frame = 0;
  const tick = () => {
    const flame = root.querySelector('.dm-flame:not(.is-ignite)');
    if (!flame || root._morphT || still() || !seen()) {
      if (flame && frame) { frame = 0; paint(flame, FLAMES[0]); }
      setTimeout(tick, 600); return;
    }
    const lively = hot();
    const choices = lively ? [0, 1, 2, 3] : [0, 4];
    let next = choices[Math.floor(Math.random() * choices.length)];
    if (next === frame) next = choices[(choices.indexOf(next) + 1) % choices.length];
    frame = next;
    paint(flame, FLAMES[frame]);
    setTimeout(tick, lively ? 140 + Math.random() * 120 : 420 + Math.random() * 380);
  };
  const paint = (flame, rows) => {
    const dots = flame.querySelectorAll('circle');
    dots.forEach((c, i) => {
      const on = rows[Math.floor(i / 5)]?.[i % 5] === '#';
      if (c.classList.contains('o') === on) return;
      c.setAttribute('class', on ? 'o n' : 'g');   // n: zonder de oplicht-animatie van een gewoon cijfer
      c.setAttribute('r', on ? 0.4 : 0.33);
    });
  };
  setTimeout(tick, 600);
}

// Vlammetje ontsteken (dagen op rij erbij): de stippen van het vlammetje kleuren van onder naar boven rood met een
// klein opspringen, daarna stijgen drie vonkjes op. hot() zet de klasse die de kleur geeft; de rest is CSS.
export function igniteFlame(root, hot) {
  const flame = root.querySelector('.dm-flame');
  if (!flame) { hot(); return; }
  for (const c of flame.querySelectorAll('circle')) {
    const y = Number(c.getAttribute('cy')), x = Number(c.getAttribute('cx'));
    c.style.setProperty('--fd', `${((6 - y) * 75 + hash(x, y) * 60).toFixed(0)}ms`);
  }
  flame.classList.remove('is-ignite'); flame.getBoundingClientRect(); flame.classList.add('is-ignite');
  hot();
  // de vonkjes tekent emberGlow (fx.js) mee in de rode schijf
  setTimeout(() => flame.classList.remove('is-ignite'), 1600);
}

// Telwerk (S2 "Eén erbij", Victor 11/11/2026: de ruis verborg dat 12 een 13 werd): enkel de tekens die veranderen rollen;
// het oude schuift omhoog weg, het nieuwe komt van onder, eerst rood (is-new, tot hold ms) en dan inkt. Een andere
// lengte (9 naar 10) gaat met de gewone wissel.
export function rollMatrix(root, text, { ms = 620, hold = 2000, onSwap } = {}) {
  const from = root._chars || [], to = [...text].filter(ch => GLYPHS[ch]);
  if (root._morphT || from.length !== to.length) { morphMatrix(root, text, { only: true, onSwap }); return; }
  const o = { duration: ms, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' }, fresh = [];
  to.forEach((ch, i) => {
    if (from[i] === ch) return;
    const old = root.children[i], node = glyph(ch);
    for (const c of node.querySelectorAll('.o')) c.classList.add('n');   // zonder de oplicht-animatie van een gewoon cijfer
    node.classList.add('is-new');
    const left = old.getBoundingClientRect().left - root.getBoundingClientRect().left;
    old.replaceWith(node);
    old.style.cssText = `position: absolute; top: 0; left: ${left}px;`;
    root.append(old);
    old.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-40%)', opacity: 0, offset: 0.55 }, { transform: 'translateY(-50%)', opacity: 0 }], o).onfinish = () => old.remove();
    node.animate([{ transform: 'translateY(70%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], o);
    fresh.push(node);
  });
  root._chars = to;
  onSwap?.();
  setTimeout(() => fresh.forEach(n => n.classList.remove('is-new')), hold);
}

// Knipoog naar de sterrenhemel: één verlichte stip fonkelt even uit als dezelfde vierpuntige ster (holle zijden)
const STAR = (() => {
  const R = 1.7, w = 0.16, p = a => `${(Math.cos(a) * R).toFixed(3)} ${(Math.sin(a) * R).toFixed(3)}`;
  let d = `M${p(-Math.PI / 2)}`;
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 2;
    d += ` Q${(Math.cos(a + Math.PI / 4) * R * w).toFixed(3)} ${(Math.sin(a + Math.PI / 4) * R * w).toFixed(3)} ${p(a + Math.PI / 2)}`;
  }
  return d + 'Z';
})();

export function twinkleDot(root) {
  const dots = root.querySelectorAll('.o:not(.is-twinkling)');
  if (!dots.length) return;
  const dot = dots[Math.floor(Math.random() * dots.length)];
  const spot = document.createElementNS(NS, 'g'), star = document.createElementNS(NS, 'path');
  spot.setAttribute('transform', `translate(${dot.getAttribute('cx')} ${dot.getAttribute('cy')})`);
  star.setAttribute('d', STAR);
  star.setAttribute('class', 'dm-star');
  spot.append(star);
  dot.classList.add('is-twinkling');
  dot.after(spot);
  star.addEventListener('animationend', () => { spot.remove(); dot.classList.remove('is-twinkling'); }, { once: true });
}
