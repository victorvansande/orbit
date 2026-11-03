/* ---- Matrixklok: cijfers van 5 × 7 stippen, zoals in Kwick ---- */
// Elk teken is een eigen SVG; bij een nieuwe minuut wordt alleen het gewijzigde cijfer opnieuw opgebouwd,
// zodat enkel dat cijfer zijn stippen laat oplichten. Effen stippen, geen gloed (huisstijl van Orbit).

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
};

const NS = 'http://www.w3.org/2000/svg';
const WAVE_COL = 0.034, WAVE_ROW = 0.012;   // golf bij een wissel: s per kolom en per rij

// col: kolom waar dit teken begint (voor de golf bij een wissel), null = gewone vertraging
function glyph(ch, col = null) {
  const rows = GLYPHS[ch];
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', ch === ':' ? 'dm dm-colon' : 'dm');
  svg.setAttribute('viewBox', `-0.5 -0.5 ${rows[0].length} 7`);
  svg.setAttribute('aria-hidden', 'true');
  rows.forEach((row, y) => [...row].forEach((v, x) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x);
    c.setAttribute('cy', y);
    c.setAttribute('r', v === '#' ? 0.4 : 0.33);
    c.setAttribute('class', v === '#' ? (col === null ? 'o' : 'o w') : 'g');
    // elke stip licht op met een eigen kleine vertraging; bij een wissel kolom per kolom van links naar rechts
    if (v === '#') c.style.setProperty('--d', col === null ? `${(((x * 7 + y * 13) % 17) / 17 * 0.55).toFixed(2)}s`
      : `${((col + x) * WAVE_COL + y * WAVE_ROW).toFixed(3)}s`);
    svg.append(c);
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

// Wissel met een golf: de verlichte stippen springen kolom per kolom even op en zakken terug tot schim,
// daarna lichten de stippen van de nieuwe tekst op in dezelfde richting. Zonder animatie gewoon setMatrix.
export function morphMatrix(root, text, { still = false, onSwap } = {}) {
  clearTimeout(root._morphT); root._morphT = 0;
  root.classList.remove('is-out');
  if (still || !root.children.length) { setMatrix(root, text); onSwap?.(); return; }
  let col = 0;
  for (const svg of root.children) {
    svg.querySelectorAll('.o').forEach(c => c.style.setProperty('--x', `${((col + +c.getAttribute('cx')) * WAVE_COL).toFixed(3)}s`));
    col += +svg.getAttribute('viewBox').split(' ')[2] + 1;
  }
  root._pending = text;
  root.classList.add('is-out');
  root._morphT = setTimeout(() => {
    root._morphT = 0;
    root.classList.remove('is-out');
    const chars = [...root._pending].filter(ch => GLYPHS[ch]);
    let at = 0;
    root.replaceChildren(...chars.map(ch => { const g = glyph(ch, at); at += GLYPHS[ch][0].length + 1; return g; }));
    root._chars = chars;
    root.setAttribute('aria-label', root._pending);
    onSwap?.();
  }, Math.round(col * WAVE_COL * 1000) + 340);
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
