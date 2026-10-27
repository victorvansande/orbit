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

function glyph(ch) {
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
    c.setAttribute('class', v === '#' ? 'o' : 'g');
    // elke stip licht op met een eigen kleine vertraging
    if (v === '#') c.style.setProperty('--d', `${(((x * 7 + y * 13) % 17) / 17 * 0.55).toFixed(2)}s`);
    svg.append(c);
  }));
  return svg;
}

// Zet de tekst (bv. "09:41") in de container; ongewijzigde tekens blijven staan
export function setMatrix(root, text) {
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
