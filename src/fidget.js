/* ---- Vijver: een rustig fidget-venster in de focusmodus ---- */
// Een vlak water van mono-tekens. Beweeg of tik erin en er lopen rimpels door; zonder iets te doen valt er af en toe
// een zachte druppel. Eenvoudige golfvergelijking op een raster van tekens, 30 keer per seconde. Loopt alleen
// zolang de focusmodus aan staat en het tabblad zichtbaar is.

const RAMP = ' .·:-=+*#';
const COLS = 34, ROWS = 11, STEP_MS = 1000 / 30, DAMP = 0.982;

export function createFidget(box, { reducedMotion }) {
  const pre = box.querySelector('pre');
  let cur = new Float32Array(COLS * ROWS), prev = new Float32Array(COLS * ROWS);
  let raf = 0, running = false, acc = 0, last = 0, nextDrop = 0, lastCell = null;
  const at = (x, y) => y * COLS + x;

  function drop(cx, cy, strength) {
    for (let y = Math.max(1, Math.floor(cy - 2)); y <= Math.min(ROWS - 2, Math.ceil(cy + 2)); y++) {
      for (let x = Math.max(1, Math.floor(cx - 2)); x <= Math.min(COLS - 2, Math.ceil(cx + 2)); x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.8);    // tekens zijn hoger dan breed
        if (d < 2.4) cur[at(x, y)] += strength * (1 - d / 2.4);
      }
    }
  }

  function step() {
    for (let y = 1; y < ROWS - 1; y++) {
      for (let x = 1; x < COLS - 1; x++) {
        const i = at(x, y);
        const n = (cur[i - 1] + cur[i + 1] + cur[i - COLS] + cur[i + COLS]) / 2 - prev[i];
        prev[i] = n * DAMP;
      }
    }
    [cur, prev] = [prev, cur];
  }

  function render(t) {
    let out = '';
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        // een trage deining eronder, zodat het water nooit helemaal stil ligt
        const swell = 0.16 * Math.sin(x * 0.33 + t * 0.55) * Math.sin(y * 0.6 - t * 0.38);
        const v = Math.abs(cur[at(x, y)] + swell);
        out += RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length * 0.9))];
      }
      out += '\n';
    }
    pre.textContent = out;
  }

  function frame(now) {
    if (!running) return;
    acc += Math.min(200, now - (last || now));
    last = now;
    if (now > nextDrop) {
      drop(2 + Math.random() * (COLS - 4), 2 + Math.random() * (ROWS - 4), 0.7 + Math.random() * 0.5);
      nextDrop = now + 2600 + Math.random() * 3800;
    }
    while (acc >= STEP_MS) { step(); acc -= STEP_MS; }
    render(now / 1000);
    raf = requestAnimationFrame(frame);
  }

  // roeren: de aanwijzer laat een spoor van rimpels na, een tik geeft een grotere plons
  const cellOf = e => {
    const r = pre.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * COLS, (e.clientY - r.top) / r.height * ROWS];
  };
  box.addEventListener('pointermove', e => {
    if (reducedMotion.matches) return;
    const [x, y] = cellOf(e);
    if (lastCell) {
      const moved = Math.hypot(x - lastCell[0], y - lastCell[1]);
      if (moved > 0.4) drop(x, y, Math.min(1.1, 0.25 + moved * 0.25));
    }
    lastCell = [x, y];
  });
  box.addEventListener('pointerleave', () => { lastCell = null; });
  box.addEventListener('pointerdown', e => { if (!reducedMotion.matches) { const [x, y] = cellOf(e); drop(x, y, 2.2); } });

  return {
    start() {
      if (running) return;
      if (reducedMotion.matches) { render(0); return; }
      running = true; last = 0; acc = 0;
      nextDrop = performance.now() + 900;
      raf = requestAnimationFrame(frame);
    },
    stop() { running = false; cancelAnimationFrame(raf); },
  };
}
