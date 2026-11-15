/* ---- Stukken van ASCII Magic in de looks "dots" en "dense" ---- */
// Victor (15/11/2026) wou color-picker-sliders en spinner-set letterlijk ("maar aanpassen aan formaat van de fidget
// wanneer nodig"). De stukken staan ongewijzigd in src/vendor/ en worden pas geladen als je de soort kiest. Dit
// bestand tekent hun beelden (tekst plus kleursleutels per vakje) zoals hun looks: enkel de blokjes (U+2580 tot
// U+259F) worden herschreven, met als dichtheid hun inkt maal de helderheid van hun kleur, genormaliseerd tussen de
// lichtste en de donkerste. "dots": een stip (drie trappen, kleinste blijft zichtbaar, kleuren opgetild, een hoge
// cel krijgt twee stippen). "dense": een teken uit de dichte ASCII-reeks, licht naar donker. Al de rest (tekst,
// kaders, lijnen) blijft tekst. Aanpassing aan het bakje: het raster vult de volle breedte en de hoogte
// onder de keuzerij (vakjes worden hoger, niet breder). Een groter bakje zoomt mee. Minder beweging: één beeld.

const TOP = 26, FONT = '"Geist Mono", ui-monospace, Menlo, monospace', CHAR_W = 0.6;
// inkt van de blokjes (hun nominale dichtheid; de rest gemeten in Menlo, uit hun glyphs.js)
const COVER = { '▀': 0.51, '▁': 0.135, '▂': 0.25, '▃': 0.38, '▄': 0.51, '▅': 0.64, '▆': 0.77, '▇': 0.89, '█': 1, '▉': 0.9, '▊': 0.8, '▋': 0.65, '▌': 0.51, '▍': 0.39, '▎': 0.25, '▏': 0.12, '▐': 0.51, '░': 0.25, '▒': 0.5, '▓': 0.75, '▔': 0.135, '▕': 0.12, '▖': 0.25, '▗': 0.25, '▘': 0.25, '▙': 0.77, '▚': 0.51, '▛': 0.77, '▜': 0.77, '▝': 0.25, '▞': 0.51, '▟': 0.77 };
const DENSE = [..." .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"];
const isShade = ch => { const c = ch.codePointAt(0); return c >= 0x2580 && c <= 0x259f; };
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = h => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

// zelfde tint, lichter waar ze donker is (grootte draagt de schaduw)
function lift(hex) {
  const [r, g, b] = rgb(hex), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const L = Math.max(l, 0.2 + 0.5 * Math.sqrt(l)), C = (1 - Math.abs(2 * L - 1)) * s, X = C * (1 - Math.abs((h % 2) - 1)), m = L - C / 2;
  const [R, G, B] = h < 1 ? [C, X, 0] : h < 2 ? [X, C, 0] : h < 3 ? [0, C, X] : h < 4 ? [0, X, C] : h < 5 ? [X, 0, C] : [C, 0, X];
  return `rgb(${Math.round((R + m) * 255)},${Math.round((G + m) * 255)},${Math.round((B + m) * 255)})`;
}

function paint(g, frame, pal, lifted, x0, y0, cw, ch, look) {
  const T = (typeof frame === 'string' ? frame : frame.text).split('\n').map(r => [...r]);
  const C = typeof frame === 'string' ? null : frame.color.split('\n').map(r => [...r]);
  const ink = k => (k && k !== ' ' && pal[k]) || '#e6edf3';
  // dichtheid per blokje, dan genormaliseerd tussen de lichtste en donkerste
  const D = T.map((row, y) => row.map((c, x) => isShade(c) ? (COVER[c] ?? 0.5) * lum(ink(C?.[y][x])) : -1));
  let max = 0, min = Infinity;
  for (const row of D) for (const d of row) { if (d > max) max = d; if (d >= 0.004 && d < min) min = d; }
  const span = max - min > 0.05 ? max - min : max, lo = max - min > 0.05 ? min : 0;
  const sub = Math.max(1, Math.round(ch / cw)), sh = ch / sub, unit = Math.min(cw, sh), paths = new Map(), text = [];
  for (let r = 0; r < T.length; r++) for (let c = 0; c < T[r].length; c++) {
    const d = D[r][c];
    if (d < 0) { if (T[r][c] !== ' ') text.push([r, c, T[r][c]]); continue; }
    if (d < 0.004 || !span) continue;
    if (look === 'dense') {   // elk ingekleurd blokje krijgt minstens het lichtste teken
      const n = DENSE.length - 1, v = Math.max(0.0001, Math.pow(Math.max(0, d - lo) / span, 0.35));
      text.push([r, c, DENSE[1 + Math.min(n - 1, Math.floor(v * n))]]);
      continue;
    }
    const v = Math.ceil(Math.pow(Math.max(0, d - lo) / span, 1.425) * 3) / 3, half = 0.5 * unit * 0.85 * (0.22 + 0.78 * v);
    const k = C?.[r][c], col = lifted[k] || '#e6edf3';
    let p = paths.get(col); if (!p) paths.set(col, p = new Path2D());
    for (let s = 0; s < sub; s++) { const cx = x0 + (c + 0.5) * cw, cy = y0 + r * ch + (s + 0.5) * sh; p.moveTo(cx + half, cy); p.arc(cx, cy, half, 0, Math.PI * 2); }
  }
  for (const [col, p] of paths) { g.fillStyle = col; g.fill(p); }
  g.font = `${cw / CHAR_W}px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'center';
  for (const [r, c, chr] of text) { g.fillStyle = ink(C?.[r][c]); g.fillText(chr, x0 + (c + 0.5) * cw, y0 + (r + 0.5) * ch); }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}

// load: () => import(...) van een stuk met { meta, createPiece }; look: 'dots' of 'dense'
export function createAsciiFidget(load, { reducedMotion, size, look = 'dots' }) {
  const W = size?.w || 325.6, H = size?.h || 226.8;
  let cv = null, g = null, piece = null, meta = null, lifted = null, t = 0, last = 0, acc = 0, alive = 0;
  function render() {
    if (!g || !piece) return;
    const cw = (W - 8) / meta.cols, ch = (H - TOP - 6) / meta.rows;
    g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    g.fillStyle = '#0A0C13'; g.fillRect(0, 0, W, H);
    paint(g, piece(t), meta.palette, lifted, 4, TOP, cw, ch, look);
  }
  return {
    own: true,
    onDark: true,
    init() {},
    mount(el) {
      if (cv) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1), id = ++alive;
      cv = document.createElement('canvas');
      cv.className = 'panel-canvas'; cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      el.append(cv);
      g = cv.getContext('2d');
      last = 0;
      load().then(mod => {
        if (id !== alive || !g) return;
        meta = mod.meta; piece = mod.createPiece();
        lifted = Object.fromEntries(Object.entries(meta.palette).map(([k, h]) => [k, lift(h)]));
        if (reducedMotion.matches) { t = 3; render(); document.fonts?.ready.then(render); }
      });
    },
    unmount() { alive++; cv?.remove(); cv = null; g = null; piece = null; },
    frame(now) {
      if (!g || !piece || reducedMotion.matches) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now; t += dt; acc += dt;
      if (acc < 1 / (meta.fps || 24)) return;
      acc = 0; render();
    },
  };
}
