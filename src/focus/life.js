/* ---- Conway's Game of Life in het bakje van de focusmodus ---- */
// 100% werkend cellulair automaat op een toroïdaal raster (60 × 42 cellen, meer in een groter bakje).
// B3/S23 regels: sterft bij onder-/overpopulatie, leeft bij 2 of 3 buren, ontstaat bij exact 3.
// Zachte bioluminescente nagloed, anti-stagnatiemotor zodat het scherm nooit vastloopt,
// en volledige interactie: tekenen met de muis/vinger, tikken om patronen (gliders, pulsars, acorns)
// te planten, en een knopje onder het bakje om door iconische werelden te wisselen.

// 60 × 42 cellen in het basisbakje (325,6 × 226,8); een groter bakje krijgt meer cellen van dezelfde maat
let COLS = 60, ROWS = 42, W = 325.6, H = 226.8, CW = W / COLS, CH = H / ROWS, CELLS = COLS * ROWS;
function setField(w, h) {
  COLS = Math.round(w / (325.6 / 60)); ROWS = Math.round(h / (226.8 / 42));
  W = w; H = h; CW = W / COLS; CH = H / ROWS; CELLS = COLS * ROWS;
}
const STEP_MS = 110;   // 9 generaties per seconde, rustig en boeiend

// Beroemde patronen (coördinaten relatief t.o.v. middelpunt)
const PATTERNS = {
  glider: [
    [0, -1], [1, 0], [-1, 1], [0, 1], [1, 1]
  ],
  lwss: [ // Lightweight spaceship
    [-1, -1], [2, -1], [-2, 0], [-2, 1], [2, 1], [-2, 2], [-1, 2], [0, 2], [1, 2]
  ],
  rpentomino: [
    [0, -1], [1, -1], [-1, 0], [0, 0], [0, 1]
  ],
  acorn: [
    [-2, -1], [0, 0], [-3, 1], [-2, 1], [1, 1], [2, 1], [3, 1]
  ],
  pulsar: [
    [-4,-6],[-3,-6],[-2,-6],[2,-6],[3,-6],[4,-6],
    [-6,-4],[-1,-4],[1,-4],[6,-4],
    [-6,-3],[-1,-3],[1,-3],[6,-3],
    [-6,-2],[-1,-2],[1,-2],[6,-2],
    [-4,-1],[-3,-1],[-2,-1],[2,-1],[3,-1],[4,-1],
    [-4,1],[-3,1],[-2,1],[2,1],[3,1],[4,1],
    [-6,2],[-1,2],[1,2],[6,2],
    [-6,3],[-1,3],[1,3],[6,3],
    [-6,4],[-1,4],[1,4],[6,4],
    [-4,6],[-3,6],[-2,6],[2,6],[3,6],[4,6]
  ],
  gun: [ // Gosper Glider Gun (36 x 9)
    [0,4],[0,5],[1,4],[1,5],
    [10,4],[10,5],[10,6],[11,3],[11,7],[12,2],[12,8],[13,2],[13,8],[14,5],[15,3],[15,7],[16,4],[16,5],[16,6],[17,5],
    [20,2],[20,3],[20,4],[21,2],[21,3],[21,4],[22,1],[22,5],[24,0],[24,1],[24,5],[24,6],
    [34,2],[34,3],[35,2],[35,3]
  ]
};

const PRESETS = [
  { name: 'Oersoep', setup: grid => seedRandom(grid, 0.18) },
  { name: 'Zweverkanon', setup: grid => place(grid, PATTERNS.gun, 6, 12) },
  { name: 'Pulsar', setup: grid => { place(grid, PATTERNS.pulsar, 18, 22); place(grid, PATTERNS.pulsar, 42, 22); } },
  { name: 'Eikel', setup: grid => { place(grid, PATTERNS.acorn, 30, 24); place(grid, PATTERNS.glider, 8, 8); } },
  { name: 'Vloot', setup: grid => {
    place(grid, PATTERNS.lwss, 12, 12);
    place(grid, PATTERNS.lwss, 24, 20);
    place(grid, PATTERNS.lwss, 36, 28);
    place(grid, PATTERNS.glider, 48, 8);
  }}
];

function seedRandom(grid, density = 0.16) {
  grid.fill(0);
  for (let y = 4; y < ROWS - 2; y++) {
    for (let x = 2; x < COLS - 2; x++) {
      if (Math.random() < density) grid[y * COLS + x] = 1;
    }
  }
}

function place(grid, coords, cx, cy) {
  for (const [dx, dy] of coords) {
    const x = (cx + dx + COLS) % COLS;
    const y = (cy + dy + ROWS) % ROWS;
    grid[y * COLS + x] = 1;
  }
}

export function createLife({ accent, onPreset, size }) {
  if (size) setField(size.w, size.h);
  let cv = null, g = null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  let grid = new Uint8Array(CELLS);
  let next = new Uint8Array(CELLS);
  let age = new Uint16Array(CELLS);
  let glow = new Float32Array(CELLS);

  let lastGen = 0;
  let presetIdx = 0;
  let tapCycle = 0;
  let popHistory = [];
  let stagnationCount = 0;
  let genCount = 0;

  function loadPreset(i) {
    presetIdx = (i + PRESETS.length) % PRESETS.length;
    grid.fill(0); next.fill(0); age.fill(0); glow.fill(0);
    PRESETS[presetIdx].setup(grid);
    for (let k = 0; k < CELLS; k++) if (grid[k]) { age[k] = 1; glow[k] = 1; }
    onPreset?.(presetIdx, PRESETS.length, PRESETS[presetIdx].name);
  }

  function tick() {
    let liveCount = 0;
    for (let y = 0; y < ROWS; y++) {
      const ym1 = (y === 0 ? ROWS - 1 : y - 1) * COLS;
      const y0 = y * COLS;
      const yp1 = (y === ROWS - 1 ? 0 : y + 1) * COLS;

      for (let x = 0; x < COLS; x++) {
        const xm1 = x === 0 ? COLS - 1 : x - 1;
        const xp1 = x === COLS - 1 ? 0 : x + 1;

        const count =
          grid[ym1 + xm1] + grid[ym1 + x] + grid[ym1 + xp1] +
          grid[y0  + xm1]                 + grid[y0  + xp1] +
          grid[yp1 + xm1] + grid[yp1 + x] + grid[yp1 + xp1];

        const idx = y0 + x;
        const alive = grid[idx] === 1;

        if (alive) {
          if (count === 2 || count === 3) {
            next[idx] = 1;
            age[idx] = Math.min(255, age[idx] + 1);
            liveCount++;
          } else {
            next[idx] = 0;
            age[idx] = 0;
          }
        } else {
          if (count === 3) {
            next[idx] = 1;
            age[idx] = 1;
            liveCount++;
          } else {
            next[idx] = 0;
            age[idx] = 0;
          }
        }
      }
    }

    // Wissel buffers
    const tmp = grid; grid = next; next = tmp;
    genCount++;

    // Anti-stagnatiemotor: voorkomt dat het scherm doodvalt of vastloopt in statische blokken
    popHistory.push(liveCount);
    if (popHistory.length > 30) popHistory.shift();

    const isStuck = popHistory.length >= 25 &&
      Math.max(...popHistory) - Math.min(...popHistory) <= 1;

    if (liveCount < 10 || isStuck) {
      stagnationCount++;
      if (stagnationCount > 8) {
        stagnationCount = 0;
        // Lanceer een zwever of r-pentomino in een open deel
        const rx = 4 + Math.floor(Math.random() * (COLS - 8));
        const ry = 8 + Math.floor(Math.random() * (ROWS - 14));
        const pattern = Math.random() < 0.6 ? PATTERNS.glider : PATTERNS.rpentomino;
        place(grid, pattern, rx, ry);
      }
    } else {
      stagnationCount = 0;
    }

    // Periodieke kosmische bezoeker (elke ~160 generaties) voor oneindige levendigheid
    if (genCount % 160 === 0 && liveCount < 240) {
      const rx = Math.random() < 0.5 ? 4 : COLS - 6;
      const ry = 6 + Math.floor(Math.random() * (ROWS - 12));
      place(grid, PATTERNS.glider, rx, ry);
    }
  }

  function isDark() {
    return document.documentElement.dataset.theme === 'dark';
  }

  function getColors() {
    const custom = accent?.();
    const dark = isDark();
    if (custom) {
      return {
        birth: dark ? '#FFFFFF' : '#111116',
        live: custom,
        mature: custom,
        fade: custom
      };
    }
    if (dark) {
      return {
        birth: '#FFFFFF',
        live: '#E08600',       // Vandaag oranje
        mature: '#0FAE69',     // Week groen
        fade: '#38A0F0'        // Maand blauw
      };
    }
    return {
      birth: '#111116',
      live: '#C06000',
      mature: '#0D8550',
      fade: '#1F6BB0'
    };
  }

  return {
    own: true,
    init() {
      loadPreset(0);
    },
    mount(el) {
      if (!cv) {
        cv = document.createElement('canvas');
        cv.className = 'panel-canvas';
        cv.setAttribute('aria-hidden', 'true');
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
        cv.style.width = `${W}px`;
        cv.style.height = `${H}px`;
        el.append(cv);
        g = cv.getContext('2d');
      }
    },
    unmount() {
      cv?.remove();
      cv = null;
      g = null;
    },
    next(dir = 1) {
      loadPreset(presetIdx + dir);
    },
    frame(now) {
      if (!g || !cv) return;

      // Tick generaties op vaste interval
      if (now - lastGen >= STEP_MS) {
        lastGen = now;
        tick();
      }

      // Vloeiende bioluminescente nagloed interpoleren (60 fps)
      for (let k = 0; k < CELLS; k++) {
        if (grid[k]) {
          glow[k] += (1 - glow[k]) * 0.48;
        } else {
          glow[k] *= 0.82; // zachte nagloed
        }
      }

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);

      const colors = getColors();
      const dotRad = 2.15;

      for (let y = 0; y < ROWS; y++) {
        // Zachte fade-out onder de bovenste keuzerij (rij 0 tot 4)
        const rowAlpha = y < 5 ? (y / 5) * 0.85 + 0.15 : 1;
        const cy = y * CH + CH / 2;

        for (let x = 0; x < COLS; x++) {
          const idx = y * COLS + x;
          const gl = glow[idx];
          if (gl < 0.03) continue;

          const cx = x * CW + CW / 2;
          const a = grid[idx];
          const cellAge = age[idx];

          let fill = colors.live;
          if (a && cellAge === 1) fill = colors.birth;
          else if (cellAge > 3) fill = colors.mature;
          else if (!a) fill = colors.fade;

          const alpha = Math.min(1, gl) * rowAlpha;
          const r = dotRad * (0.6 + 0.45 * Math.min(1.2, gl));

          g.globalAlpha = alpha;
          g.fillStyle = fill;
          g.beginPath();
          g.arc(cx, cy, r, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
    },
    step() {},
    move() {},
    drag(p) {
      if (!p) return;
      const cx = Math.floor(p.x / CW);
      const cy = Math.floor(p.y / CH);
      if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS) {
        const idx = cy * COLS + cx;
        grid[idx] = 1; age[idx] = 1; glow[idx] = 1;
        if (cx + 1 < COLS) { grid[idx + 1] = 1; age[idx + 1] = 1; glow[idx + 1] = 1; }
        if (cy + 1 < ROWS) { grid[(cy + 1) * COLS + cx] = 1; age[(cy + 1) * COLS + cx] = 1; glow[(cy + 1) * COLS + cx] = 1; }
      }
    },
    leave() {},
    tap(p) {
      if (!p) return;
      const cx = Math.floor(p.x / CW);
      const cy = Math.floor(p.y / CH);
      if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) return;

      // Tikken wisselt tussen een zwever, een pulsar, een acorn of een r-pentomino
      const patternList = [PATTERNS.glider, PATTERNS.acorn, PATTERNS.pulsar, PATTERNS.rpentomino, PATTERNS.lwss];
      const pat = patternList[tapCycle % patternList.length];
      tapCycle++;
      place(grid, pat, cx, cy);
      for (const [dx, dy] of pat) {
        const x = (cx + dx + COLS) % COLS;
        const y = (cy + dy + ROWS) % ROWS;
        const k = y * COLS + x;
        age[k] = 1; glow[k] = 1;
      }
    },
    recolor() {}
  };
}
