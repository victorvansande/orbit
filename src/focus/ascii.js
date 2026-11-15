/* ---- Stukken van ASCII Magic in het bakje ---- */
// Victor (15/11/2026) wou color-picker-sliders, spinner-set, underwater-reef en redwood-forest-light letterlijk
// ("maar aanpassen aan formaat van de fidget wanneer nodig"). Stukken en hun tekencode staan ongewijzigd in
// src/vendor/ (ascii*.js) en worden pas geladen als je de soort kiest. Dit bestand doet wat hun speler doet: elk
// beeld van het stuk door de look halen en met hun `paint` tekenen ("dots" = halftoon met paintTone, "dense" =
// tekst in de dichte ASCII-reeks). Aanpassing aan het bakje: tekststukken vullen de breedte en de hoogte onder de
// keuzerij (hogere vakjes); schilderijen met vierkante vakjes vullen het hele bakje en worden links en rechts
// bijgesneden. Een groter bakje zoomt mee. Minder beweging: één beeld.

const TOP = 26, BG = '#0A0C13', INK = '#e4e4e7';

// load: () => import(...) van een stuk met { meta, createPiece }; look: 'dots' of 'dense'
export function createAsciiFidget(load, { reducedMotion, size, look = 'dots' }) {
  const W = size?.w || 325.6, H = size?.h || 226.8;
  let cv = null, g = null, piece = null, meta = null, lib = null, dpr = 1, t = 0, last = 0, acc = 0, alive = 0;
  function render() {
    if (!g || !piece) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = BG; g.fillRect(0, 0, W, H);
    let x, y, cw, ch;
    if (meta.cell === 'square') { cw = ch = Math.max(W / meta.cols, H / meta.rows); x = (W - meta.cols * cw) / 2; y = (H - meta.rows * ch) / 2; }
    else { x = 4; y = TOP; cw = (W - 8) / meta.cols; ch = (H - TOP - 6) / meta.rows; }
    let frame = piece(t);
    const opts = { x, y, cw, ch, ink: INK, dpr, over: true, mode: look === 'dots' ? 'circle' : 'text', ...(meta.dots || {}) };
    if (meta.cell === 'square') opts.lift = false;   // schilderijen houden hun echte kleuren (zoals hun speler)
    if (look !== 'dots') frame = lib.restyle(frame, meta.palette, { look, lift: opts.lift });
    lib.paint(g, frame, meta.palette, opts);
  }
  return {
    own: true,
    onDark: true,
    init() {},
    mount(el) {
      if (cv) return;
      const id = ++alive;
      dpr = Math.min(3, window.devicePixelRatio || 1);
      cv = document.createElement('canvas');
      cv.className = 'panel-canvas'; cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      el.append(cv);
      g = cv.getContext('2d', { willReadFrequently: true });
      last = 0;
      Promise.all([load(), import('../vendor/asciicanvas.js'), import('../vendor/asciiglyphs.js')]).then(([mod, canvas, glyphs]) => {
        if (id !== alive || !g) return;
        meta = mod.meta; piece = mod.createPiece(); lib = { paint: canvas.paint, restyle: glyphs.restyle };
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
