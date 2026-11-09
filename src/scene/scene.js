import { LEVELS, LEVEL_BY_ID, URGENT_LEVEL, RIM, TIP_Z, depthAt, rgbOf, rgba } from '../core/config.js';
import { dueLabel, isOverdue } from '../core/deadline.js';
import { tx } from '../core/i18n.js';
import { wallRows } from './fx.js';
import { turnPlan, arrived, seg, pullEase } from './turn.js';

/* ---- Camera en geometrie (eenheden van de 390-stage) ---- */
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const P = 1100;                         // perspectief
const PERSP_Y = (0.38 - 0.5) * 390;     // perspective-origin op 38 %
const VIEW = { top: { tilt: 0, zoom: 0.92, shift: 0 }, side: { tilt: 58, zoom: 0.96, shift: -66 } };
const VIEW_MS = 900;
const SPIN_PERIOD = 160;
// Tempo: normaal, zen (alles trager maar de volgorde blijft: Nu het snelst) of stil
const ZEN_BASE = 8;                     // omlooptijd van Nu in zen (s)
const zenFactor = lv => lv.period / (ZEN_BASE * Math.pow(lv.period / LEVELS[0].period, 0.55));
const TEMPO = {
  normaal: { orbit: () => 1, spin: 1, beat: 1, waves: 1, tail: 1, arrive: 1.7, gap: 0.07 },
  zen:     { orbit: zenFactor, spin: 0.35, beat: 0.5, waves: 1, tail: 0.75, arrive: 2.6, gap: 0.1 },
  stil:    { orbit: () => 0, spin: 0, beat: 0, waves: 0, tail: 0, arrive: 2.2, gap: 0.09 },
};
const FIT = 440;                        // zoveel stage-eenheden passen in min(breedte, hoogte)
const FIT_NARROW = 372;                 // gsm: de ringen vullen bijna de hele breedte (Victor: de orbit moet de hoofdzaak zijn)

// Kleuren van structuur en labels per thema; de bollen houden hun eigen kleur
const THEMES = {
  light: { glow: 0.2, grid: 1, ink: [24, 24, 32], paper: [235, 232, 223], calm: [168, 168, 178], pillBg: 'rgba(252,252,251,.94)', pillText: '#1b1b22', pillLine: 'rgba(20,20,30,.08)', shadow: 'rgba(20,20,30,.10)', leader: 'rgba(20,20,30,.22)' },
  dark:  { glow: 0.24, grid: 1.3, ink: [236, 236, 241], paper: [15, 15, 18], calm: [112, 112, 124], pillBg: 'rgba(38,38,44,.94)', pillText: '#ECECF1', pillLine: 'rgba(255,255,255,.1)', shadow: 'rgba(0,0,0,.4)', leader: 'rgba(255,255,255,.28)' },
};
// Diepte in de banen (B1, Victor, 02/11/2026): hoe verder van de kern, hoe lichter en fijner de stippen. Vroeger overal 0,2
// (Nu 0,3) en even groot. Ooit houdt een ondergrens van 0,12, anders verdwijnt hij op een zwak scherm.
const RING_GAP = 8, RING_ALPHA = [0.36, 0.26, 0.2, 0.15, 0.12], RING_DOT = [1.3, 1.12, 1, 0.9, 0.82];
const TAIL_GAP = 7, TAIL_LENGTH = 1.1, TRAIL_STEPS = 10;
const BEND_R = 170, BEND_PX = 18;          // raster rond de aanwijzer: straal en diepte (px)
const WAKE = 0.7;                          // spoor op de baan: hoek (rad) achter een komeet waarin ringstippen nagloeien
const SPARK_MS = 420;                      // afvinken vanuit de lijst: vlucht van het lichtpuntje naar de bol
const GLYPHS = '·:+×#';                    // tekenset van de glyph sonar
const DUST = 560;                          // vortex: korrels in de trechter (zijaanzicht)
const SONAR_SPEED = 230, SONAR_LIFE = 1.7; // glyph sonar na een tik op de kern: eenheden per s, duur (s)
const SKY_WAVE_SPEED = 330;                // nieuwe hemel: de ring van tekens loopt tot buiten beeld (eenheden per s)
const ORB_SCALE = 0.85;                 // straal t.o.v. LEVELS[].size / 2
// Kern: zeshoekig raster van puntjes (stage-eenheden), straal groeit van rustig naar dringend.
// Op een klein scherm wordt het raster grover (min. CORE_MIN_PX tussen de puntjes), anders vervloeit het tot een vlek.
const BURN_LIFE = 0.95;     // afvinken: duur van het opbranden van de bol (s)
// Fijner raster (K2, Victor, 02/11/2026): 2,35 in plaats van 3,1 eenheden tussen de puntjes, puntjes 0,78 keer zo groot (CORE_DOT);
// op gsm blijft het grove raster via CORE_MIN_PX, daar is het effect gelijk aan vroeger.
const CORE_RMAX = 25, CORE_SPACING = 2.35, CORE_DOT = 0.78, CORE_MIN_PX = 3.6;   // C1: concentrische cirkelringen (altijd zuiver rond)
// Vaste maat (Victor, 09/11/2026: "Maak orb niet kleiner bij weinig of minder taken"): vroeger 15 in rust tot 29 bij veel
// dringends; nu altijd de volle maat. Dringendheid zit nog in de hartslag en de golf door de puntjes.
const CORE_R = CORE_RMAX + 4;
// O1 Spiegelraster (Victor, 09/11/2026, uit O1 tot O3 in ontwerp/kern/): op scherpe schermen (DPR 2) mogen de puntjes dichter
// (2,5 px in plaats van 3,6) en tot 0,9 keer de gewone afstand, zodat een oog 2 à 3 puntjes breed wordt in plaats van 1 à 2
const CORE_MIN_PX_SHARP = 2.5, CORE_FINE = 0.9;
const coreGrids = new Map();
function coreGrid(spacing, rMax = CORE_RMAX) {
  const rings = Math.max(4, Math.round(rMax / spacing));
  const key = `${rings}:${rMax.toFixed(1)}`;
  if (!coreGrids.has(key)) {
    const pts = [{ x: 0, y: 0, r: 0 }];
    const dr = rMax / rings;
    for (let k = 1; k <= rings; k++) {
      const rk = k * dr;
      let count = Math.max(6, Math.round((TAU * rk) / dr));
      if (count % 2) count++;   // even: elke ring is zijn eigen spiegelbeeld, dus het linkeroog is exact het rechter (O1)
      const twist = (k & 1) ? Math.PI / count : 0;
      for (let i = 0; i < count; i++) {
        const a = (TAU * i) / count + twist;
        pts.push({ x: Math.cos(a) * rk, y: Math.sin(a) * rk, r: rk });
      }
    }
    coreGrids.set(key, pts);
  }
  return coreGrids.get(key);
}
const GRID_ALPHA = 0.18, GRID_MAX = 3600;   // 0,13 was op sommige schermen amper zichtbaar
const EDGE = 180;   // net buiten de buitenste ring (Ooit, 174): rand van de scène voor tekst ernaast
const ARRIVE_SPAN = 26;    // B3 (Victor, 05/11/2026): lokale baan-ontvouwing vlak buiten de eigen doelring
const ARRIVE_SWEEP = 0.28; // Korte kwartboog die raaklijnig op kruissnelheid op de baan landt
const SKY_IN = 50;   // binnengrens van de sterrenhemel in stage-eenheden, buiten de ring Nu (38); zelfde als SKY_MIN in stats.js
const arriveR = (target, u) => { const rem = 1 - u; return target + ARRIVE_SPAN * (rem * rem * rem); };
const arriveLag = u => { const rem = 1 - u; return -ARRIVE_SWEEP * (rem * rem); };

const ease = cubicBezier(0.4, 0, 0.2, 1);

function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = t => ((ax * t + bx) * t + cx) * t;
  const sy = t => ((ay * t + by) * t + cy) * t;
  const dx = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x, d = dx(t);
      if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    return sy(Math.min(1, Math.max(0, t)));
  };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
}

export function createScene(canvas, { onHover = () => {}, onReassign = () => {}, onView = () => {}, onCore = () => {}, onLegend = () => {}, reducedMotion }) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  let insets = { left: 0, right: 0 }, center = { x: 0, y: 0 }, centerReady = false;

  /* ---- Toestand ---- */
  let t = 0, tween = null;               // 0 = boven, 1 = zijkant
  let spin = 0, spinDrag = 0;
  let yaw = 0, pitch = 0, yawTarget = 0, pitchTarget = 0;
  const phase = new Map(LEVELS.map(l => [l.id, 0]));
  const speed = new Map(LEVELS.map(l => [l.id, 1]));
  const ringHot = new Map(LEVELS.map(l => [l.id, 0]));
  const ringPulse = new Map(LEVELS.map(l => [l.id, 0]));
  const orbs = new Map();
  const burns = [];      // afgevinkte bollen die opbranden
  let sky = [];          // sterrenhemel: één ster per afgevinkte taak
  const skyBorn = new Map();   // id → tijdstip waarop een nieuwe ster verscheen (licht even op)
  // eye candy: raster buigt naar de aanwijzer, schokgolf door de ringen bij afvinken, af en toe een vallende ster,
  // sterrenbeeld bij elke 25e ster
  const bend = { k: 0, x: 0, y: 0 };
  let meteor = null, nextMeteor = performance.now() + (90 + Math.random() * 150) * 1000, forceMeteor = false;
  let gifts = new Set();                     // geschenken bij een rang (src/core/gifts.js): enkel uiterlijk, zie setGifts
  const starTint = new Map();                // geschenk Sterrenstof: moment per ster, vast uit het id
  let constellation = null;                  // {edges: [[x1,y1,x2,y2]...], t0}
  const sparks = [];                         // lichtpuntjes van een rij in de lijst naar de bol: {x0,y0,x1,y1,t0,level}
  let sleepK = 0, wakeUntil = 0;             // slapende kern (0 = wakker, 1 = slaapt)
  // vortex: stof dat in het zijaanzicht langs de trechter naar de kern spiraalt; meer en sneller bij een volle lijst
  const dust = Array.from({ length: DUST }, (_, i) => ({ r: 20 + Math.random() * 190, a: Math.random() * TAU, s: 0.55 + Math.random() * 0.9, k: i / DUST }));
  let dustAmount = 0;
  // De trechter mondt uit op de rand van de kern, niet in een punt (Victor, 03/11/2026): tussen de ring Nu en de kern
  // loopt de wand naar de bodem op de straal van de kern; `coreR` volgt de kern (groter als het dringend is).
  let coreR = CORE_R;
  const NU_RING = LEVELS[0].ring, NU_Z = depthAt(NU_RING);
  function funnelZ(r) {
    if (r >= NU_RING) return depthAt(r);
    return NU_Z + (TIP_Z - NU_Z) * Math.min(1, (NU_RING - r) / (NU_RING - coreR));
  }
  let sonar = null;                          // {t0, target}: ring van tekens vanuit de kern, de gezochte bol licht op
  let turn = null;                           // maandwissel: {t0, plan, onBurst, fired}, de oude hemel gaat naar de kern (turn.js)
  let skyWave = null;                        // {t0, old}: nieuwe hemel, de ring van tekens neemt de oude sterren mee
  let nightDraw = null;                      // kleine nacht bij een nieuwe ster: tekent vóór drawCore zodat de rode kern er altijd vóór staat
  let minimal = false;                       // Minimaal (Instellingen → Effecten): alle extra effecten uit
  // muur van afgevinkte taken achter de sterrenhemel (typographic wall): basislaag gecachet, verlichte woorden apart
  let wallWords = [], wallOn = false, wallK = 0, wallLayout = null, wallBase = null, wallKey = '', wallSweep = null;
  const lamp = { x: 0, y: 0 };
  const starHold = new Set();   // nieuwe ster die wacht tot de nacht na het afvinken opengaat (app.js, smallNight)
  let holdNext = false;
  let starDelay = 0, lastStarAt = 0;                         // ms tot de nieuwe ster verschijnt: pas na het uitfonkelen, nooit twee sterren tegelijk
  let skyKnown = null;
  let hover = { orb: null, level: null }, external = { task: null, level: null }, pinned = null;
  let drag = null, dropLevel = null;
  // urgentie van de kern: 0 = rustig, 1 = alleen vandaag, tot 2 = veel Nu-taken
  let nowCount = 0, todayCount = 0, urgency = 0, beat = 0;
  let theme = THEMES.light;
  let INK = theme.ink, PAPER = theme.paper;
  const coreColor = [...theme.calm];
  let introStart = performance.now(), last = performance.now();
  // Bollen en ringen wijken tijdens de maandwissel (Victor, 03/11/2026: "de orbs die nog draaien even verbergen dat we echt
  // enkel de sterretjes naar de kern zien vertrekken", daarna "ook tijdelijk de orbits zelf, enkel de kern in beeld"):
  // 0 zolang er een maandwissel klaarstaat of loopt, daarna zacht terug.
  let orbVeil = 1;
  let tempo = TEMPO.normaal, spinScale = 1, beatScale = 1, waveVis = 1;
  let pointer = { x: -1, y: -1, inside: false };
  // Gezicht van de kern ("Uitgespaard", gekozen door Victor): twee oogvormen uitgespaard in het raster, met een pupil
  // in inktkleur die je cursor volgt (anders rustig rondkijkt), af en toe knippert, blij kijkt bij afvinken en 's
  // nachts slaperig is. look: kijkrichting (-1..1), lookGoal: waar hij heen wil kijken (null = vrij).
  const face = { look: [0, 0.1], lookGoal: null, nextBlink: 0, blinkAt: -1, happyUntil: 0, winkUntil: 0, last: 0 };
  let coreHit = null;   // plek en straal van de kern op het scherm, voor een tik

  /* ---- Kleuren ---- */
  const PALETTES = {
    light: new Map(LEVELS.map(l => [l.id, rgbOf(l.color)])),
    dark: new Map(LEVELS.map(l => [l.id, rgbOf(l.dark)])),
  };
  let colors = PALETTES.light;
  let URGENT_RGB = colors.get(URGENT_LEVEL);
  coreColor.splice(0, 3, ...URGENT_RGB);   // meteen rood, niet eerst grijs

  /* ---- Vaste geometrie ---- */
  const rings = LEVELS.map(lv => {
    const n = Math.round(TAU * lv.ring / RING_GAP);
    const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push(Math.cos(a) * lv.ring, Math.sin(a) * lv.ring); }
    return { lv, z: depthAt(lv.ring), pts, screen: new Float32Array(2 * 48) };
  });

  let grid = [];
  function buildGrid(s) {
    const R = Math.hypot(W, H) / s * 0.62;
    const gap = Math.max(18, 2 * R * Math.sqrt(Math.PI / 4 / GRID_MAX));
    grid = [];
    const n = Math.ceil(R / gap);
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const x = i * gap, y = j * gap, r = Math.hypot(x, y);
        if (r > R) continue;
        const outer = 1 - smoothstep(R * 0.45, R, r);
        // Raster vervaagt volledig buiten de buitenste ring (Ooit, 174) zodat binnen de banen geen punten staan
        const inner = smoothstep(180, 216, r);
        if (inner < 0.005) continue;
        grid.push({ x, y, r, a: GRID_ALPHA * outer * inner });
      }
    }
  }

  /* ---- Projectie ---- */
  const cam = {};
  function updateCamera() {
    const e = clamp(t, 0, 1);
    const tilt = (VIEW.top.tilt + (VIEW.side.tilt - VIEW.top.tilt) * e + pitch) * DEG;
    const yawR = yaw * DEG;
    cam.depth = e;
    cam.zoom = VIEW.top.zoom + (VIEW.side.zoom - VIEW.top.zoom) * e;
    cam.shift = VIEW.top.shift + (VIEW.side.shift - VIEW.top.shift) * e;
    cam.ct = Math.cos(tilt); cam.st = Math.sin(tilt);
    cam.cyaw = Math.cos(yawR); cam.syaw = Math.sin(yawR);
    cam.cs = Math.cos(spin + spinDrag); cam.ss = Math.sin(spin + spinDrag);
    const availW = Math.max(200, W - insets.left - insets.right);
    // gsm: groter in het bovenaanzicht; in het zijaanzicht iets kleiner, anders zakt de kern onder de scène
    const fit = W < 600 ? FIT_NARROW + (FIT + 20 - FIT_NARROW) * e : FIT;
    const availH = Math.max(200, H - (insets.bottom || 0));   // gsm: strook onderaan voor de begroeting
    cam.s = Math.min(availW, availH) / fit;
    cam.du = Math.pow(cam.s, 0.72);       // stippen groeien trager mee dan de geometrie
    cam.cx = center.x; cam.cy = center.y;
  }

  const pt = { x: 0, y: 0, f: 1, z: 0 };
  function project(x, y, z, spun) {
    let X = x, Y = y;
    if (spun) { X = x * cam.cs - y * cam.ss; Y = x * cam.ss + y * cam.cs; }
    const y1 = Y * cam.ct - z * cam.st;
    const z1 = Y * cam.st + z * cam.ct;
    let x2 = X * cam.cyaw + z1 * cam.syaw;
    let z2 = -X * cam.syaw + z1 * cam.cyaw;
    x2 *= cam.zoom; z2 *= cam.zoom;
    const y2 = y1 * cam.zoom + cam.shift;
    if (z2 > P * 0.8) return false;
    const f = P / (P - z2);
    pt.x = cam.cx + x2 * f * cam.s;
    pt.y = cam.cy + (PERSP_Y + (y2 - PERSP_Y) * f) * cam.s;
    pt.f = f; pt.z = z2;
    return true;
  }

  /* ---- Formaat ---- */
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    updateCenterTarget(true);
    updateCamera();
    buildGrid(cam.s);
  }
  let centerTarget = { x: 0, y: 0 };
  function updateCenterTarget(force) {
    centerTarget = { x: insets.left + (W - insets.left - insets.right) / 2, y: (H - (insets.bottom || 0)) / 2 };
    if (force && !centerReady) { center = { ...centerTarget }; centerReady = true; }
  }
  new ResizeObserver(resize).observe(canvas);
  resize(); // camera meteen geldig, ook als de muis al beweegt voor de eerste meting

  /* ---- Taken ---- */
  function layoutOffsets() {
    for (const lv of LEVELS) {
      const own = [...orbs.values()].filter(o => !o.leaving && o.level === lv.id);
      if (!own.length) continue;
      const fresh = own.filter(o => o.fresh);
      const est = own.filter(o => !o.fresh);

      if (!est.length) {
        // Cold start (alle bollen nieuw op deze ring): gelijkmatig verdelen over de ring
        own.sort((a, b) => a.createdAt - b.createdAt);
        own.forEach((o, i) => {
          o.offset = o.targetOffset = (TAU * i) / own.length;
          o.fresh = false;
        });
        continue;
      }

      // Verse bollen kiezen elk het grootste vrije gat tussen reeds geplaatste bollen
      const placed = est.slice();
      for (const f of fresh) {
        placed.sort((a, b) => ((wrapAngle(a.offset) + TAU) % TAU) - ((wrapAngle(b.offset) + TAU) % TAU));
        let bestGap = -1, bestMid = 0;
        for (let i = 0; i < placed.length; i++) {
          const a = ((wrapAngle(placed[i].offset) + TAU) % TAU);
          const next = placed[(i + 1) % placed.length];
          let b = ((wrapAngle(next.offset) + TAU) % TAU);
          if (b <= a) b += TAU;
          const gap = b - a;
          if (gap > bestGap) {
            bestGap = gap;
            bestMid = (a + gap / 2) % TAU;
          }
        }
        f.offset = bestMid;
        placed.push(f);
      }

      // Symmetrisch N-rooster: centreer de doelen op het circulaire gemiddelde van alle bollen,
      // zodat elke bol de minimale verplaatsing heeft en de bollen perfect evenredig verdeeld raken.
      const all = own.slice().sort((a, b) => ((wrapAngle(a.offset) + TAU) % TAU) - ((wrapAngle(b.offset) + TAU) % TAU));
      const N = all.length;
      if (N === 1) {
        all[0].targetOffset = all[0].offset;
        all[0].fresh = false;
        continue;
      }

      let sumSin = 0, sumCos = 0;
      for (let k = 0; k < N; k++) {
        const d = wrapAngle(all[k].offset - (k * TAU / N));
        sumSin += Math.sin(d);
        sumCos += Math.cos(d);
      }
      const theta0 = Math.atan2(sumSin, sumCos);

      for (let k = 0; k < N; k++) {
        const ideal = theta0 + (k * TAU / N);
        const diff = wrapAngle(ideal - all[k].offset);
        all[k].targetOffset = all[k].offset + diff;
        if (all[k].fresh) {
          // Verse bol start direct op zijn ideale roosterpositie
          all[k].offset = all[k].targetOffset;
          all[k].fresh = false;
        }
      }
    }
  }

  function setTasks(list, { intro = false } = {}) {
    const ids = new Set(list.map(t => t.id));
    for (const o of orbs.values()) if (!ids.has(o.id)) o.leaving = true;
    let i = 0;
    for (const task of list) {
      let o = orbs.get(task.id);
      if (!o || o.leaving) {
        const target = LEVEL_BY_ID.get(task.level).orbit;
        o = {
          id: task.id, level: task.level, createdAt: task.createdAt, title: task.title,
          r: reducedMotion.matches ? target : target + ARRIVE_SPAN,
          alpha: reducedMotion.matches ? 1 : 0,
          offset: 0, targetOffset: 0, startOffset: 0, shiftT: 1, shiftDur: 1,
          fresh: true, lag: reducedMotion.matches ? 0 : -ARRIVE_SWEEP,
          wait: 0, isIntro: Boolean(intro),
          arrive: reducedMotion.matches ? null : { t0: performance.now() + (intro ? (0.55 + i * tempo.gap) * 1000 : 0), dur: tempo.arrive * 0.72 },
          sx: null, sy: null, sr: 0, blend: null,
        };
        orbs.set(task.id, o);
        i++;
      } else if (o.level !== task.level) {
        const target = LEVEL_BY_ID.get(task.level).orbit;
        o.r = target;
        o.vr = 0;
        o.vo = 0;
        o.lag = 0;
        o.arrive = null;
        o.blend = null;
        if (o.dropAngle != null) {
          o.offset = wrapAngle(o.dropAngle - phase.get(task.level));
          o.dropAngle = null;
        } else {
          const a = phase.get(o.level) + o.offset + (o.lag || 0);
          o.offset = a - phase.get(task.level);
        }
        o.level = task.level;
      }
      o.title = task.title;
      o.due = task.due || null;
      o.late = Boolean(o.due) && isOverdue(o.due);
    }
    layoutOffsets();
    nowCount = list.filter(t => t.level === URGENT_LEVEL).length;
    todayCount = list.filter(t => t.level === URGENT_LEVEL + 1).length;
  }

  // Geeft de plek terug (stage-eenheden rond het midden van het scherm) voor de sterrenhemel, of null
  function complete(id, from = null) {
    const o = orbs.get(id);
    if (!o) return null;
    orbs.delete(id);
    layoutOffsets();
    const spot = o.sx == null ? null : [(o.sx - cam.cx) / cam.s, (o.sy - cam.cy) / cam.s];
    if (reducedMotion.matches || o.sx == null) return spot;
    // A Opgebrand (Victor, 03/11/2026): de bol brandt op langs zijn eigen baan, zonder ster (de enige ster is de nieuwe in de hemel)
    // De bol draait gewoon door met zijn ring (Victor, 03/11/2026: "het sprongetje naar de orb die dan verdwijnt is nog
    // steeds wat raar"): vroeger bevroor hij op de plek van de klik, wachtte tot het lichtpuntje aankwam en vertrok dan uit
    // stilstand; en verdween hij bij de klik meteen kaal (zonder de gloed en de grootte van een aangewezen bol). Nu volgt
    // hij elk beeld de echte snelheid van zijn ring (die na het aanwijzen weer op gang komt), het lichtpuntje volgt hem,
    // en pas als het aankomt remt hij af en brandt op.
    const wait = from && !minimal ? SPARK_MS / 1000 : 0;
    const burn = { level: o.level, r: o.r, a: orbAngle(o), w: 0, age: -wait, alpha: o.alpha ?? 1, k: isHot(o) ? 1.2 : 1 };
    burns.push(burn);
    if (wait) {
      const r = canvas.getBoundingClientRect();
      sparks.push({ x0: from.x - r.left, y0: from.y - r.top, burn, t0: performance.now(), level: o.level });
    }
    starDelay = (wait + BURN_LIFE) * 1000 + 120;
    return spot;
  }

  /* ---- Weergave ---- */
  function setView(name, instant = false) {
    const target = name === 'side' ? 1 : 0;
    if (instant || reducedMotion.matches) { t = target; tween = null; return; }
    tween = { from: t, to: target, start: performance.now(), dur: VIEW_MS * Math.max(0.35, Math.abs(target - t)) };
  }

  function setInsets(next) {
    insets = next;
    updateCenterTarget(false);
    if (reducedMotion.matches) center = { ...centerTarget };
  }

  function highlight({ task = null, level = null } = {}) {
    external = { task, level };
  }

  /* ---- Update ---- */
  function hotLevel() {
    if (drag?.type === 'orb') return orbs.get(drag.id)?.level ?? null;
    const id = hover.orb ?? external.task ?? pinned;
    if (id && orbs.has(id)) return orbs.get(id).level;
    return hover.level ?? external.level;
  }

  function update(dt, now) {
    const motion = !reducedMotion.matches;
    if (tween) {
      const p = (now - tween.start) / tween.dur;
      t = tween.from + (tween.to - tween.from) * ease(p);
      if (p >= 1) { t = tween.to; tween = null; }
    }
    center.x = motion ? smooth(center.x, centerTarget.x, 6, dt) : centerTarget.x;
    center.y = motion ? smooth(center.y, centerTarget.y, 6, dt) : centerTarget.y;
    spinScale = smooth(spinScale, tempo.spin, 2, dt);
    beatScale = smooth(beatScale, tempo.beat, 2, dt);
    waveVis = smooth(waveVis, tempo.waves, 2, dt);
    if (motion) spin += dt * TAU / SPIN_PERIOD * spinScale;
    yaw = motion ? smooth(yaw, yawTarget, 3, dt) : 0;
    pitch = motion ? smooth(pitch, pitchTarget, 3, dt) : 0;

    const hot = hotLevel();
    for (const lv of LEVELS) {
      speed.set(lv.id, smooth(speed.get(lv.id), hot === lv.id ? 0 : tempo.orbit(lv), hot === lv.id ? 5 : 2.5, dt));
      if (motion) phase.set(lv.id, phase.get(lv.id) + dt * TAU / lv.period * speed.get(lv.id));
      const dragging = drag?.type === 'orb' && drag.active;
      const lit = dragging ? dropLevel === lv.id : hot === lv.id;
      ringHot.set(lv.id, smooth(ringHot.get(lv.id), lit ? 1 : 0, 9, dt));
      const p = ringPulse.get(lv.id) || 0;
      if (p > 0) ringPulse.set(lv.id, Math.max(0, p - dt * 2.8));
    }

    orbVeil = motion ? smooth(orbVeil, turn ? 0 : 1, turn ? 5 : 1.6, dt) : (turn ? 0 : 1);
    for (const o of orbs.values()) {
      const lvO = LEVEL_BY_ID.get(o.level), target = lvO.orbit;
      const r0 = o.r, off0 = o.offset + (o.lag || 0);
      if (o.arrive) {
        const u = (now - o.arrive.t0) / 1000 / o.arrive.dur;
        o.wait = u < 0 ? 1 : 0;
        if (u < 0) { if (o.leaving) orbs.delete(o.id); continue; }
        if (!motion || u >= 1) {
          o.r = target; o.lag = 0; o.arrive = null;
          if (!o.leaving) {
            o.alpha = 1;
            if (!o.isIntro && !reducedMotion.matches && !minimal) ringPulse.set(lvO.id, 1);
          }
        }
        else {
          o.r = arriveR(target, u);
          o.lag = arriveLag(u);
          if (!o.leaving) o.alpha = Math.max(o.alpha, smoothstep(0, 0.45, u));
        }
      } else {
        o.r = motion ? smooth(o.r, target, 2.6, dt) : target;
        o.lag = 0;
      }
      // Zachte, geleidelijke herverdeling (Victor 05/11/2026):
      // Als een taak wordt afgevinkt of toegevoegd, verdelen de bollen zich traag
      // en gelijkmatig over hun ring, ZONDER ooit achteruit te gaan of te verspringen.
      if (!motion || reducedMotion.matches) {
        o.offset = o.targetOffset;
      } else {
        const diff = wrapAngle(o.targetOffset - o.offset);
        if (Math.abs(diff) > 1e-4) {
          const omega = (TAU / lvO.period) * speed.get(lvO.id);
          let step = diff * (1 - Math.exp(-0.45 * dt));
          // Harde garantie: de bol gaat NOOIT achteruit in de ruimte!
          // De vertraging is begrensd op max 25% van de baansnelheid,
          // zodat de werkelijke hoeksnelheid (omega + step/dt) altijd >= 0.75 * omega blijft.
          const maxStep = Math.max(1e-4, 0.25 * omega * dt);
          step = clamp(step, -maxStep, maxStep);
          o.offset += step;
        } else {
          o.offset = o.targetOffset;
        }
      }
      // werkelijke snelheid (radiaal en extra hoeksnelheid) voor een staart die de echte baan volgt
      o.vr = dt > 0 ? (o.r - r0) / dt : 0;
      o.vo = dt > 0 ? clamp(wrapAngle(o.offset + (o.lag || 0) - off0) / dt, -0.35, 0.35) : 0;
      if (!o.arrive || o.leaving) o.alpha = smooth(o.alpha, o.leaving ? 0 : 1, o.leaving ? 8 : 3, dt);
      if (o.leaving && o.alpha < 0.01) orbs.delete(o.id);
      if (o.blend) { o.blend.p += dt / 0.45; if (o.blend.p >= 1) o.blend = null; }
    }

    // raster: de put volgt de aanwijzer zacht, en verdwijnt als die de scène verlaat
    bend.k = smooth(bend.k, motion && !minimal && pointer.inside ? 1 : 0, 3, dt);
    if (pointer.inside) { bend.x = smooth(bend.x || pointer.x, pointer.x, 8, dt); bend.y = smooth(bend.y || pointer.y, pointer.y, 8, dt); }

    for (let i = burns.length - 1; i >= 0; i--) {
      const q = burns[i];
      q.age += dt;
      if (q.age > BURN_LIFE) { burns.splice(i, 1); continue; }
      // snelheid van zijn ring, na de aankomst van het lichtpuntje afremmend naar 0
      const lvq = LEVEL_BY_ID.get(q.level);
      q.w = motion ? TAU / lvq.period * speed.get(q.level) * (1 - Math.min(1, Math.max(0, q.age) / BURN_LIFE)) : 0;
      q.a += q.w * dt;
    }

    // slapende kern: geen taken, of 's nachts (23 tot 6 u) zonder iets dringends; een aanwijzer maakt hem 20 s wakker
    const hr = new Date().getHours();
    const asleep = nowCount === 0 && todayCount === 0 && (orbs.size === 0 || hr >= 23 || hr < 6) && now > wakeUntil;
    sleepK = motion ? smooth(sleepK, asleep ? 1 : 0, asleep ? 0.6 : 4, dt) : (asleep ? 1 : 0);

    // kern: urgentie, kleur, tempo en aantal golven glijden mee met de taken
    const target = nowCount > 0 ? 1 + Math.min(nowCount - 1, 3) / 3 : todayCount > 0 ? 0.5 : 0;
    urgency = smooth(urgency, target, 2.5, dt);
    const goal = URGENT_RGB;   // de kern is altijd rood (Nu); urgentie zit in grootte en golf, niet in kleur
    for (let i = 0; i < 3; i++) coreColor[i] = smooth(coreColor[i], goal[i], 3, dt);
    if (motion && urgency > 0.01) beat += dt / beatPeriod() * beatScale;

    // vortex: hoeveelheid volgt het aantal taken, tempo de urgentie en de gekozen snelheid
    const live = [...orbs.values()].filter(o => !o.leaving).length;
    dustAmount = smooth(dustAmount, cam.depth > 0.02 && !minimal ? 0.45 + 0.55 * Math.min(1, live / 20) : 0, 1.5, dt);
    if (motion && cam.depth > 0.02) {
      const pace = (0.6 + 0.3 * Math.min(2, urgency)) * spinScale;
      for (const d of dust) {
        d.a += dt * d.s * (0.25 + 34 / (d.r + 10)) * pace;
        // vlak boven de kern remt het stof af, zodat de wand zichtbaar doorloopt tot op de rand van de kern
        d.r -= dt * d.s * (3 + 520 / (d.r + 24)) * pace * (0.3 + 0.7 * smoothstep(coreR, coreR + 26, d.r));
        if (d.r < coreR) { d.r = 175 + Math.random() * 35; d.a = Math.random() * TAU; }
      }
    }
    if (sonar && (now - sonar.t0) / 1000 > (sonar.far || sonar.quiet ? 6 : SONAR_LIFE + 2.4)) sonar = null;
    const wallWant = (wallOn || wallSweep) && wallWords.length && !minimal ? 1 : 0;
    wallK = motion ? smooth(wallK, wallWant, 3, dt) : wallWant;
    if (wallK > 0.001) {
      // licht: rond de aanwijzer, anders zwerft het traag rond
      const t = now / 1000;
      const gx = pointer.inside ? pointer.x : W / 2 + Math.cos(t / 3.1) * W * 0.3, gy = pointer.inside ? pointer.y : H / 2 + Math.sin(t / 2.3) * H * 0.3;
      lamp.x = motion ? smooth(lamp.x || gx, gx, pointer.inside ? 10 : 1.5, dt) : gx;
      lamp.y = motion ? smooth(lamp.y || gy, gy, pointer.inside ? 10 : 1.5, dt) : gy;
    }
    if (skyWave && skyWaveFront(now) > Math.hypot(W, H) + 60) skyWave = null;
  }

  /* ---- Tekenen ---- */
  function introAlpha(now, delay, dur = 0.9) {
    if (reducedMotion.matches) return 1;
    return smoothstep(0, 1, ((now - introStart) / 1000 - delay) / dur);
  }

  function drawGrid(now) {
    const depth = cam.depth;
    const fade = introAlpha(now, 0, 1.4) * (0.5 + 0.2 * depth);
    if (fade <= 0) return;
    const buckets = Array.from({ length: 6 }, () => []);
    for (const g of grid) {
      const z = g.r < RIM ? depthAt(g.r) * depth : 0;
      if (!project(g.x, g.y, z, false)) continue;
      // in het zijaanzicht wijkt het raster binnen en rond de trechter terug: de ringen tonen de vorm al
      const inside = 1 - depth * (1 - smoothstep(RIM - 24, RIM + 90, g.r));
      const a = g.a * fade * inside * Math.min(1, pt.f * pt.f);
      if (!(a >= 0.006)) continue;
      if (pt.x < -8 || pt.x > W + 8 || pt.y < -8 || pt.y > H + 8) continue;
      let gx = pt.x, gy = pt.y;
      if (bend.k > 0.01) {
        // een zachte zwaartekrachtput rond de aanwijzer: puntjes zakken een paar pixels naar binnen
        const dx = bend.x - gx, dy = bend.y - gy, d = Math.hypot(dx, dy);
        if (d < BEND_R && d > 0.5) {
          const pull = BEND_PX * bend.k * (1 - d / BEND_R) ** 2 * (d / (d + 10));
          gx += dx / d * pull; gy += dy / d * pull;
        }
      }
      const k = Math.min(5, Math.floor(a / GRID_ALPHA * 6));
      buckets[k].push(gx, gy, 0.9 * cam.du * pt.f);
    }
    ctx.fillStyle = rgba(INK, 1);
    buckets.forEach((b, k) => {
      if (!b.length) return;
      ctx.globalAlpha = (k + 0.5) / 6 * GRID_ALPHA * theme.grid;   // in het donker iets sterker, anders verdwijnt het
      ctx.beginPath();
      for (let i = 0; i < b.length; i += 3) { ctx.moveTo(b[i] + b[i + 2], b[i + 1]); ctx.arc(b[i], b[i + 1], b[i + 2], 0, TAU); }
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // Sterrenhemel: één klein vierpuntig sterretje per afgevinkte taak deze week, achter de scène, zacht fonkelend
  // Op een klein of vierkant canvas (gsm) valt de buitenrand van de hemel (straal 250) buiten beeld: dan schuift de
  // hele hemel wat naar binnen, zodat elke ster zichtbaar blijft.
  function skyScale() {
    const half = Math.min(W, H - (insets.bottom || 0)) / 2 / cam.s - 10;
    return cam.s * Math.min(1, half / 250);
  }

  // Typographic wall (naar React Bits): de titels van wat je afvinkte, in kapitaaltjes over de hele scène, bijna
  // onzichtbaar; rond de aanwijzer (of een zacht rondzwervend licht) worden ze leesbaar.
  const WALL_LH = 15, WALL_R = 130, WALL_FONT = '500 9.5px "Geist Mono", ui-monospace, monospace';
  function layoutWall() {
    const key = `${W}x${H}:${Math.round(cam.cx / 40)}:${wallWords.join('|')}:${theme === THEMES.dark}:${document.fonts?.status}`;
    if (key === wallKey) return;
    wallKey = key;
    ctx.save();
    ctx.font = WALL_FONT;
    const items = wallRows(wallWords, W, H, WALL_LH, t => ctx.measureText(t).width);
    ctx.restore();
    wallLayout = items;
    // basislaag één keer tekenen
    wallBase = wallBase || document.createElement('canvas');
    wallBase.width = Math.round(W * DPR); wallBase.height = Math.round(H * DPR);
    const g = wallBase.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.font = WALL_FONT; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillStyle = rgba(INK, 1);
    for (const it of items) g.fillText(it.word, it.x, it.y);
    // alleen rond de scène, niet achter de lijst en het wiel: zacht uitdoven naar de rand
    const R = wallRadius();
    g.globalCompositeOperation = 'destination-in';
    const grad = g.createRadialGradient(cam.cx, cam.cy, R * 0.45, cam.cx, cam.cy, R);
    grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }
  function wallRadius() { return Math.min(Math.max(200, W - insets.left - insets.right), H) * 0.62; }
  const SWEEP_ANGLE = 34 * DEG;
  const SWEEP_R = R => Math.min(300, Math.max(150, R * 0.62));   // straal van de lichtcirkel over de muur (px)
  function drawWall(now) {
    if (wallK < 0.005 || !wallWords.length) return;
    layoutWall();
    const R = wallRadius();

    let sweepFade = 0, beamPos = -9999;
    if (wallSweep) {
      const p = (now - wallSweep.t0) / wallSweep.dur;
      if (p >= 1) {
        wallSweep = null;
      } else {
        // Heel kalme, ademende in- en uitfade (geen plotselinge schokken of versnellingen)
        if (p < 0.15) sweepFade = smoothstep(0, 1, p / 0.15);
        else if (p > 0.82) sweepFade = 1 - smoothstep(0, 1, (p - 0.82) / 0.18);
        else sweepFade = 1;
        // afgebroken (details dicht, of de regisseur geeft het podium aan iets anders): zacht uitdoven in 0,7 s
        if (wallSweep.outAt) { const o = (now - wallSweep.outAt) / 700; if (o >= 1) wallSweep = null; sweepFade *= 1 - smoothstep(0, 1, Math.min(1, o)); }

        // Gelijkmatige, statige drift (smoothstep) zonder plotse versnelling in het midden: de cirkel komt van linksboven
        // buiten de muur en verlaat haar rechtsonder, langs de diagonaal door het midden van de scène
        const span = R + SWEEP_R(R);
        beamPos = -span + smoothstep(0, 1, p) * span * 2;
      }
    }

    // Handmatige muur (wallOn): basisprint
    if (wallOn && !wallSweep) {
      ctx.globalAlpha = 0.035 * theme.grid * wallK;
      ctx.drawImage(wallBase, 0, 0, W, H);
    }

    ctx.font = WALL_FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = rgba(INK, 1);

    const cosA = Math.cos(SWEEP_ANGLE), sinA = Math.sin(SWEEP_ANGLE);

    for (const it of wallLayout) {
      const midX = it.x + it.w / 2, midY = it.y;
      const fade = 1 - smoothstep(R * 0.45, R, Math.hypot(midX - cam.cx, midY - cam.cy));
      if (fade < 0.02) continue;

      let lit = 0;
      // 1. Handmatig aangezette muur: lichtstraal rond de cursor / zwevende lamp
      if (wallOn) {
        const d = Math.hypot(Math.max(0, Math.abs(midX - lamp.x) - it.w / 2), midY - lamp.y);
        if (d < WALL_R) {
          const l = 1 - d / WALL_R;
          lit = Math.max(lit, 0.45 * l * l * wallK);
        }
      }
      // 2. Lichtcirkel (Victor, 03/11/2026: "een cirkel die helder is in het midden maar geleidelijk aan vager wordt naar de
      // uiteinden", in plaats van de diagonale bundel): helder in het midden, uitdovend tot de rand, schuift traag over de muur
      if (sweepFade > 0.01) {
        const cxS = cam.cx + cosA * beamPos, cyS = cam.cy + sinA * beamPos;
        const normDist = Math.min(1, Math.hypot(midX - cxS, midY - cyS) / SWEEP_R(R));
        // vol in het hart, daarna een zachte klokvorm naar de rand (geen zichtbare cirkelrand)
        const focusCurve = Math.pow(1 - smoothstep(0, 1, normDist), 1.6);
        const darkGray = 0.07 * theme.grid;
        const whiteFocus = 0.65;
        const sweepLit = (darkGray + (whiteFocus - darkGray) * focusCurve) * sweepFade;
        lit = Math.max(lit, sweepLit);
      }

      if (lit * fade < 0.012) continue;
      ctx.globalAlpha = lit * fade;
      ctx.fillText(it.word, it.x, it.y);
    }
    ctx.globalAlpha = 1;
  }

  // afstand (px) van het golffront van de mozaïekgolf tot het midden, of null
  // afstand (px) van de ring van tekens tot het midden bij een nieuwe hemel, of null
  function skyWaveFront(now) { return skyWave ? (26 + (now - skyWave.t0) / 1000 * SKY_WAVE_SPEED) * cam.s * cam.zoom : null; }

  // Plek van een ster op het scherm. Meerlagige diepteparallax en fading (Voorstel 2, gekozen door Victor):
  // Drie kosmische dieptelagen (ver, midden, nabij) bewegen met gedifferentieerde parallax en zachte diepte-fading.
  const SKY_TILT = 0.45, SKY_LIFT = 150;
  function starLayer(st) {
    if (!st) return { pFactor: 0.85, depthScale: 0.98, depthFade: 0.95 };
    const tier = Math.abs(Math.round((st.ph || 0) * 10)) % 3;
    if (tier === 0) return { pFactor: 0.55, depthScale: 0.88, depthFade: 0.80 };
    if (tier === 1) return { pFactor: 0.85, depthScale: 0.98, depthFade: 0.95 };
    return { pFactor: 1.15, depthScale: 1.08, depthFade: 1.05 };
  }

  function skyXY(x, y, ks, st = null) {
    // Moet de hemel op een klein scherm naar binnen (skyScale), dan schuift hij tussen SKY_IN en de rand samen in plaats
    // van alles naar de kern toe: zo komt geen ster binnen de ring Nu (Victor, 03/11/2026).
    if (ks < cam.s) {
      const kk = Math.max(0, (250 * ks / cam.s - SKY_IN) / (250 - SKY_IN)), r = Math.hypot(x, y);
      if (r > 0) { const f = (SKY_IN + Math.max(0, r - SKY_IN) * kk) / r; x *= f; y *= f; }
      ks = cam.s;
    }
    const { pFactor } = starLayer(st);
    const baseTilt = (VIEW.top.tilt + (VIEW.side.tilt - VIEW.top.tilt) * cam.depth) * DEG * SKY_TILT;
    const a = baseTilt * pFactor;
    const lift = (SKY_LIFT * pFactor) * Math.sin(a);
    return [cam.cx + x * ks * (1 + 0.05 * cam.depth * pFactor), cam.cy + (y * Math.cos(a) - lift) * ks];
  }

  function drawSky(now) {
    if (turn) { drawTurn(now); return; }
    const front = skyWaveFront(now);
    if (front !== null) drawStars(now, skyWave.old, d => d > front);   // oude hemel tot de ring langskomt
    drawStars(now, sky, front === null ? null : d => d < front - 30);   // nieuwe hemel achter de ring
  }

  // Maandwissel (Zwaartekracht, gekozen door Victor, 01/11/2026). Sinds 04/11/2026 vier uitwerkingen, elke maand een andere
  // (Victor: "Kan je z1 tot en met z4 allemaal uitwerken en elke maand random kiezen"): Z1 Opgeslokt, Z2 Draaikolk,
  // Z3 Sterrenbeeld, Z4 Inademen. De tijdlijn staat in turn.js en is dezelfde als die van het geluid. Op `plan.light`
  // laat de scène het licht beginnen (`onBurst(kind)`, app.js): zacht vanuit de kern of een flits. Niet over te slaan.
  const TURN_TAIL_N = 12, TURN_TAIL_DT = 0.025;   // staart: 12 stukjes over 0,3 s van de eigen baan, dus mee gebogen
  const easeOut = u => 1 - Math.pow(1 - u, 3);
  const turnT = now => (now - turn.t0) / 1000;
  // grootte van de kern (factor) op tijd t
  function turnCoreAt(t) {
    const pl = turn?.plan;
    if (!pl || !(t > -1e9)) return 1;   // holdTurn: t = -Infinity, nog niets begonnen
    const back = ease(seg(t, pl.light + 1.6, pl.end));
    let k;
    if (pl.style === 'slok' || pl.style === 'beeld') {   // elke ster die aankomt is een slok: een stapje groter en een klein veertje
      const n = arrived(pl, t);
      let bump = 0;
      for (let i = n - 1; i >= 0 && i >= n - 14; i--) { const age = t - pl.T[i]; if (age > 0.7) break; bump += 0.06 * Math.exp(-age / 0.12); }
      const inh = ease(seg(t, pl.inhale[0], pl.inhale[1])), out = easeOut(seg(t, pl.light, pl.light + 1.2));
      k = (1 + 1.2 * n / Math.max(1, pl.T.length) + Math.min(0.3, bump)) * (1 - 0.12 * inh) * (1 + 0.6 * out);
    } else if (pl.style === 'kolk') {
      k = 1 + 1.1 * pullEase(seg(t, 2.6, pl.collapse)) + 0.8 * ease(seg(t, pl.collapse, pl.collapse + 0.5));
    } else {
      const hold = Math.sin(seg(t, pl.inEnd, pl.light) * Math.PI) * 0.04;
      k = (1 + 1.4 * pullEase(seg(t, 1.3, pl.inEnd)) + hold) * (1 + 0.4 * easeOut(seg(t, pl.light, pl.light + 1.3)));
    }
    return k * (1 - back) + back;
  }
  function turnCore(now) { return turn ? turnCoreAt(turnT(now)) : 1; }
  // rimpels door de rasterpunten van de kern (leeftijden in s): bij elke slok (Z1, Z3), bij het dichtknijpen (Z2) of uitademen (Z4)
  function turnWaves(now) {
    const pl = turn?.plan;
    if (!pl) return null;
    const t = turnT(now), out = [];
    if (!(t > -1e9)) return null;
    for (let i = arrived(pl, t) - 1; i >= 0 && out.length < 6; i--) { const age = t - pl.T[i]; if (age > 0.4) break; out.push(age); }
    const at = pl.style === 'kolk' ? pl.collapse : pl.style === 'adem' ? pl.light : null;
    if (at != null && t > at && t < at + 0.5) out.push((t - at) * 0.8);
    return out.length ? out : null;
  }
  // plek van de oude sterren op het scherm in dit beeld, en de kern
  function turnFrame() {
    const ks = skyScale(), S = turn.plan.stars, n = S.length;
    const cx = coreHit ? coreHit.x : cam.cx, cy = coreHit ? coreHit.y : cam.cy;
    if (!turn.xy || turn.xy.length !== 2 * n) turn.xy = new Float32Array(2 * n);
    let R = 0;
    for (let i = 0; i < n; i++) {
      const [x, y] = skyXY(S[i].st.x, S[i].st.y, ks, S[i].st);
      turn.xy[2 * i] = x; turn.xy[2 * i + 1] = y; R = Math.max(R, Math.hypot(x - cx, y - cy));
    }
    return { cx, cy, base: coreHit ? coreHit.r : 22, R: Math.max(R, 60), xy: turn.xy };
  }
  const turnEdge = (F, t) => F.base * 0.72 * turnCoreAt(t);   // rand van de (gezwollen) kern, daar komt een ster aan
  // Z3: punt op afstand d langs het pad van een ster naar de kern (in hemeleenheden), op het scherm
  function turnAlong(F, s, t) {
    const pl = turn.plan;
    let d = pl.maxL * pullEase(seg(t, pl.tC, pl.tC + pl.dur));
    for (let k = 0; k < s.lens.length; k++) {
      const a = s.path[k], ax = F.xy[2 * a], ay = F.xy[2 * a + 1];
      let bx, by;
      if (k + 1 < s.path.length) { const b = s.path[k + 1]; bx = F.xy[2 * b]; by = F.xy[2 * b + 1]; }
      else { const dd = Math.hypot(ax - F.cx, ay - F.cy) || 1, e = turnEdge(F, t); bx = F.cx + (ax - F.cx) / dd * e; by = F.cy + (ay - F.cy) / dd * e; }
      if (d <= s.lens[k]) { const u = d / s.lens[k]; return { x: ax + (bx - ax) * u, y: ay + (by - ay) * u, node: k + 1, bx, by }; }
      d -= s.lens[k];
    }
    return null;
  }
  // één ster op tijd t: plek, grootte (k), dekking (a), en of ze een staart krijgt; null = in de kern
  function turnStar(F, s, t) {
    const pl = turn.plan, x0 = F.xy[2 * s.i], y0 = F.xy[2 * s.i + 1];
    const b = ease(seg(t, 0.1 + s.r1 * 0.5, 1.1 + s.r1 * 0.5));   // de sterren lichten eerst op, elk iets later
    const r0 = Math.hypot(x0 - F.cx, y0 - F.cy), a0 = Math.atan2(y0 - F.cy, x0 - F.cx);
    if (pl.style === 'slok') {   // spiraal naar de kern, de dichtste eerst
      if (t >= s.T) return null;
      const q = pullEase(seg(t, s.T - s.F, s.T)), e = turnEdge(F, t);
      const r = e + Math.max(0, r0 - e) * (1 - q), an = a0 + s.w * Math.pow(q, 1.6), sink = smoothstep(0.86, 1, q);
      return { x: F.cx + Math.cos(an) * r, y: F.cy + Math.sin(an) * r, k: (1 + b * 0.6) * (1 - 0.35 * q) * (1 - 0.6 * sink), a: (0.45 + 0.55 * b) * (1 - sink), tail: q > 0.004 };
    }
    if (pl.style === 'kolk') {   // eerst een platte schijf rond de kern, die sneller draait en dichtknijpt
      const g = ease(seg(t, 0.9 + 0.5 * s.r1, 2.9)), c = pullEase(seg(t, 3.0 + 0.25 * s.r1, pl.collapse - 0.05));
      if (c >= 1) return null;
      const e = turnEdge(F, t) * 1.4, rd = F.R * (0.42 + 0.26 * s.r2), rr = e + (rd - e) * (1 - c);
      const phi = a0 + 1.6 * Math.pow(seg(t, 0.9, 3.1), 2) + 9.5 * Math.pow(seg(t, 3.0, pl.collapse), 2.2);
      const dx = F.cx + Math.cos(phi) * rr, dy = F.cy + Math.sin(phi) * rr * 0.42, sink = smoothstep(0.86, 1, c);
      return { x: x0 + (dx - x0) * g, y: y0 + (dy - y0) * g, k: (1 + b * 0.6) * (1 - 0.3 * c) * (1 - 0.6 * sink), a: (0.45 + 0.55 * b) * (1 - sink), tail: g > 0.01 };
    }
    if (pl.style === 'beeld') {   // kralen langs de draden van het sterrenbeeld
      if (t >= s.T) return null;
      const lit = ease(seg(t, s.lit - 0.1, s.lit + 0.4)), p = turnAlong(F, s, t);
      if (!p) return null;
      const sink = smoothstep(0, 1, 1 - clamp((s.T - t) / 0.18, 0, 1));
      return { x: p.x, y: p.y, k: (1 + lit * 0.55) * (1 - 0.5 * sink), a: (0.42 + 0.58 * lit) * (1 - sink), tail: false };
    }
    // adem: de hele hemel zakt als één geheel naar de kern en draait een kwartslag mee
    const p = pullEase(seg(t, 1.3 + 0.35 * s.ur, pl.inEnd - 0.25 + 0.25 * s.ur));
    if (p >= 1) return null;
    const e = turnEdge(F, t), r = e + Math.max(0, r0 - e) * (1 - p), an = a0 + 1.1 * ease(seg(t, 1.2, pl.inEnd)), sink = smoothstep(0.8, 1, p);
    return { x: F.cx + Math.cos(an) * r, y: F.cy + Math.sin(an) * r, k: (1 + b * 0.6) * (1 - 0.35 * p) * (1 - 0.6 * sink), a: (0.45 + 0.55 * b) * (1 - sink), tail: false };
  }
  // Z3: de lijntjes van het sterrenbeeld groeien vanaf de kern, en worden daarna als draden binnengehaald
  function drawTurnLines(F, t, alpha) {
    const pl = turn.plan, fade = 1 - seg(t, pl.tC + pl.dur * 0.6, pl.tC + pl.dur);
    if (fade <= 0) return;
    ctx.strokeStyle = rgba(INK, 0.3 * fade * alpha); ctx.lineWidth = 1;
    ctx.beginPath();
    for (const s of pl.stars) {
      const t0 = 0.35 + s.depth * pl.step, u = ease(seg(t, t0, t0 + pl.draw));
      if (u <= 0) continue;
      const x = F.xy[2 * s.i], y = F.xy[2 * s.i + 1];
      let px, py;
      if (s.parent >= 0) { px = F.xy[2 * s.parent]; py = F.xy[2 * s.parent + 1]; }
      else { const dd = Math.hypot(x - F.cx, y - F.cy) || 1, e = turnEdge(F, t); px = F.cx + (x - F.cx) / dd * e; py = F.cy + (y - F.cy) / dd * e; }
      let hx = px + (x - px) * u, hy = py + (y - py) * u;
      if (t > pl.tC) {   // binnenhalen: enkel het stuk tussen de ster en haar volgende knoop
        const p = turnAlong(F, s, t);
        if (!p || p.node > 1 || t >= s.T) continue;
        hx = p.x; hy = p.y;
      }
      ctx.moveTo(px, py); ctx.lineTo(hx, hy);
    }
    ctx.stroke();
  }
  function drawTurn(now) {
    const pl = turn.plan, t = turnT(now);
    if (t >= pl.light && !turn.fired) { turn.fired = true; turn.onBurst?.(pl.kind); }
    if (t >= pl.end) { turn = null; return; }
    const a = introAlpha(now, 0.3, 1.2);
    if (a <= 0) return;
    const F = turnFrame(), small = Math.min(W, H) < 500, dark = theme === THEMES.dark;
    const dense = clamp(1 - (pl.stars.length - 150) / 1500, 0.65, 1);
    ctx.lineCap = 'round';
    if (pl.style === 'beeld') drawTurnLines(F, t, a);
    for (const s of pl.stars) {
      const p = turnStar(F, s, t);
      if (!p) continue;
      const R = starR(s.st, dense, small) * p.k, alpha = a * p.a;
      if (p.tail) {   // taps lichtstaartje langs de werkelijke baan (waar de ster de laatste 0,3 s was), dooft uit naar achteren
        trailPts.length = 0; trailPts.push(p.x, p.y);
        for (let k = 1; k <= TURN_TAIL_N; k++) { const q = turnStar(F, s, t - k * TURN_TAIL_DT); if (!q || q.a <= 0) break; trailPts.push(q.x, q.y); }
        const n = trailPts.length / 2, ex = trailPts[2 * n - 2], ey = trailPts[2 * n - 1];
        if (n > 2 && Math.hypot(ex - p.x, ey - p.y) > 1.5) {
          const gr = ctx.createLinearGradient(p.x, p.y, ex, ey);
          gr.addColorStop(0, rgba(INK, 0.7 * alpha)); gr.addColorStop(1, rgba(INK, 0));
          ctx.fillStyle = gr;
          taper(Math.max(1, R * 0.5), 0.15);
        }
      }
      if (dark && alpha > 0.02) {   // heel zachte gloed, alleen in het donker (op papier zou het een vlek zijn)
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R * 2.2);
        g.addColorStop(0, rgba(INK, 0.2 * alpha)); g.addColorStop(1, rgba(INK, 0));
        ctx.fillStyle = g; ctx.fillRect(p.x - R * 2.2, p.y - R * 2.2, R * 4.4, R * 4.4);
      }
      ctx.fillStyle = rgba(INK, 1);
      ctx.globalAlpha = alpha;
      star4(p.x, p.y, R, 0);
      ctx.globalAlpha = 1;
    }
  }

  // nooit kleiner dan een paar pixels: op een gsm verdwenen ze anders
  const starR = (st, dense, small) => Math.max(2.6 * st.s * cam.du, (small ? 3 : 2.4) + st.s) * dense;

  function drawStars(now, sky, keep) {
    if (!sky.length) return;
    const a = introAlpha(now, 0.3, 1.2);
    if (a <= 0) return;
    const t = now / 1000, still = reducedMotion.matches;
    ctx.fillStyle = rgba(INK, 1);
    const dense = clamp(1 - (sky.length - 150) / 1500, 0.65, 1);
    const ks = skyScale();
    const small = Math.min(W, H) < 500;   // gsm: sterren iets groter en helderder, anders vallen ze weg   // een volle hemel krijgt iets kleinere sterren
    for (const st of sky) {
      const tw = still ? 0.8 : 0.55 + 0.45 * Math.sin(t * 0.9 + st.ph);
      if (starHold.has(st.id)) continue;
      const [x, y] = skyXY(st.x, st.y, ks, st);
      if (keep && !keep(Math.hypot(st.x * ks, st.y * ks))) continue;
      const { depthScale, depthFade } = starLayer(st);
      const yNorm = clamp((st.y * ks + 200) / 400, 0, 1);
      const distFade = 1 - (1 - yNorm) * cam.depth * 0.32;
      const distScale = 1 - (1 - yNorm) * cam.depth * 0.18;
      let R = starR(st, dense, small) * depthScale * distScale;
      let alpha = Math.max(0.12, ((small ? 0.5 : 0.36) + 0.44 * tw) * depthFade * distFade);
      // een nieuwe ster verschijnt na het uitfonkelen groot en helder, en zakt in 2,4 s naar haar plek
      const born = skyBorn.get(st.id);
      if (born !== undefined) {
        const p = (now - born) / 1000;
        if (p > 2.4) skyBorn.delete(st.id);
        else if (p < 0) continue;
        else { const k = 1 - ease(p / 2.4); R *= 1 + 1.6 * k; alpha = Math.min(1, alpha + 0.6 * k); }
      }
      ctx.globalAlpha = a * alpha;
      if (gifts.has('stardust')) ctx.fillStyle = rgba(mixInk(colors.get(starLevel(st.id)), 0.62), 1);   // gedempt: een volle hemel mag geen confetti worden
      star4(x, y, R, 0);
    }
    ctx.globalAlpha = 1;
  }
  // Sterrenstof: elke ster een vast moment (1 tot 5), uit een hash van haar id, zodat ze haar kleur houdt
  function starLevel(id) {
    let lv = starTint.get(id);
    if (lv === undefined) {
      let h = 2166136261;
      for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
      lv = 1 + ((h >>> 0) % 5);
      starTint.set(id, lv);
    }
    return lv;
  }
  // Melkweg (geschenk): een vage band van fijne puntjes schuin door de kern, achter alles; vaste puntjes, beweegt niet
  let milky = null;
  function drawMilky(now) {
    if (!gifts.has('milky')) return;
    const a = introAlpha(now, 0.3, 1.2) * orbVeil;
    if (a <= 0) return;
    if (!milky) {
      let sd = 20261109;
      const rand = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      milky = Array.from({ length: 560 }, () => {
        const u = rand() * 2 - 1, g = (rand() + rand() + rand() - 1.5) / 1.5;
        return [u, g * (0.55 + 0.45 * (1 - Math.abs(u))), 0.5 + rand() * 0.9, rand()];
      });
    }
    const c0 = project(0, 0, TIP_Z * cam.depth, false) ? [pt.x, pt.y] : [W / 2, H / 2];
    const L = Math.hypot(W, H) * 0.55, wd = Math.min(W, H) * 0.075, ca = Math.cos(-0.42), sa = Math.sin(-0.42);
    const k = Math.min(W, H) < 500 ? 0.9 : 1.1;
    ctx.fillStyle = rgba(INK, 1);
    for (const [u, v, r, b] of milky) {
      ctx.globalAlpha = a * (0.12 + 0.26 * b) * (1 - 0.55 * Math.abs(u));
      ctx.beginPath();
      ctx.arc(c0[0] + u * L * ca - v * wd * sa, c0[1] + u * L * sa + v * wd * ca, r * k, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // Maantje en ring om de kern (geschenken): op het scherm rond het midden van de kern, schuin; de achterkant wordt vóór de
  // kern getekend, de voorkant erna. Draait traag; stil bij minder beweging en Minimaal. Wijkt mee tijdens de maandwissel.
  function drawSatellites(now, front) {
    const moon = gifts.has('moon'), ring = gifts.has('saturn');
    if (!moon && !ring) return;
    const a0 = introAlpha(now, 0.4, 1.2) * orbVeil * (1 - 0.55 * sleepK);
    if (a0 <= 0.01 || !project(0, 0, TIP_Z * cam.depth, false)) return;
    const cx = pt.x, cy = pt.y, R = Math.max(10, (coreR + 4) * cam.s * pt.f);
    const t = reducedMotion.matches || minimal ? 0 : now / 1000;
    const ct = Math.cos(-0.32), st = Math.sin(-0.32);
    const at = (ang, rad, flat) => {
      const ex = Math.cos(ang) * rad, ey = Math.sin(ang) * rad * flat;
      return [cx + ex * ct - ey * st, cy + ex * st + ey * ct];
    };
    ctx.fillStyle = rgba(INK, 1);
    if (ring) {
      const rad = R * 1.5, dot = Math.max(0.7, R * 0.05);
      ctx.globalAlpha = a0 * (front ? 0.7 : 0.3);
      ctx.beginPath();
      for (let i = 0; i < 48; i++) {
        const ang = i / 48 * TAU + t * 0.1;
        if ((Math.sin(ang) > 0) !== front) continue;
        const [x, y] = at(ang, rad, 0.3);
        ctx.moveTo(x + dot, y); ctx.arc(x, y, dot, 0, TAU);
      }
      ctx.fill();
    }
    if (moon) {
      const ang = 1.1 + t * TAU / 14;
      if ((Math.sin(ang) > 0) === front) {
        const [x, y] = at(ang, R * 1.9, 0.45), r = Math.max(3, R * 0.17);
        ctx.globalAlpha = a0 * (front ? 0.85 : 0.4);
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
        // sikkeltje: een schijfje papier schuift er half over
        ctx.globalAlpha = a0 * (front ? 0.85 : 0.4);
        ctx.fillStyle = rgba(PAPER, 1);
        ctx.beginPath(); ctx.arc(x + r * 0.45, y - r * 0.3, r * 0.85, 0, TAU); ctx.fill();
        ctx.fillStyle = rgba(INK, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Vallende ster: heel af en toe (eerst na 1,5 tot 4 min, daarna om de 6 tot 14 min) een dunne streep over de hemel.
  // Zoals een echte: de kop gloeit op, vertraagt, flakkert nog even op en brandt dan op; het spoor blijft daarna kort
  // hangen en lost van achteren naar het eindpunt op. Taps (breed aan de kop, niets aan het eind), zoals de kometen.
  // Vloeiender (Victor, 02/11/2026: "voelt nog steeds wat hakkelig aan"): de kop was een stipje dat per beeld 10 tot 20 px
  // versprong, het spoor een harde driehoek van 2 px die bij het bewegen flikkerde, en de vlucht duurde 0,82 s met een
  // sterke rem. Nu: langer en bijna even snel (1 − (1 − f)^1,6), het spoor is de plek waar de kop de laatste 0,26 s was
  // (dus het krimpt mee als hij afremt), een zachte rand rond een fijne kern tegen het flikkeren, en de kop is een kort
  // streepje van waar hij een beeld geleden was (bewegingsonscherpte) in plaats van een stip.
  const METEOR_FLY = 1150, METEOR_FADE = 560, METEOR_TRAIL = 260;
  const meteorAt = f => 1 - Math.pow(1 - Math.min(1, Math.max(0, f)), 1.6);   // afgelegde weg (0..1)
  function meteorQuad(hx, hy, tx, ty, nx, ny, w, a) {
    const g = ctx.createLinearGradient(hx, hy, tx, ty);
    g.addColorStop(0, rgba(INK, a));
    g.addColorStop(0.3, rgba(INK, a * 0.5));
    g.addColorStop(1, rgba(INK, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(hx + nx * w, hy + ny * w);
    ctx.lineTo(tx + nx * w * 0.08, ty + ny * w * 0.08);
    ctx.lineTo(tx - nx * w * 0.08, ty - ny * w * 0.08);
    ctx.lineTo(hx - nx * w, hy - ny * w);
    ctx.closePath();
    ctx.fill();
  }
  function drawMeteor(now) {
    if (reducedMotion.matches || (minimal && !forceMeteor && !meteor?.forced)) return;
    if (!meteor && now >= nextMeteor) {
      const ang = (0.2 + Math.random() * 0.35) * (Math.random() < 0.5 ? 1 : -1) + (Math.random() < 0.5 ? 0 : Math.PI);
      const dir = [Math.cos(ang), Math.abs(Math.sin(ang))];               // altijd een beetje naar beneden
      // enkel boven de scène, niet achter de lijst of het wiel (op desktop viel ze daar soms helemaal weg)
      const free = Math.max(200, W - insets.left - insets.right);
      meteor = { t0: now, x: insets.left + free * (0.15 + Math.random() * 0.7), y: H * (0.08 + Math.random() * 0.35), dx: dir[0], dy: dir[1], dist: Math.min(W, H) * (0.38 + Math.random() * 0.2), forced: forceMeteor };
      forceMeteor = false;
      nextMeteor = now + (gifts.has('meteors') ? 70 + Math.random() * 110 : 360 + Math.random() * 480) * 1000;   // Meteorenregen: om de 1 tot 3 min
    }
    if (!meteor) return;
    const ms = now - meteor.t0;
    if (ms >= METEOR_FLY + METEOR_FADE) { meteor = null; return; }
    const f = Math.min(1, ms / METEOR_FLY);                                      // vlucht van de kop
    const q = ms > METEOR_FLY ? (ms - METEOR_FLY) / METEOR_FADE : 0;             // nagloei van het spoor
    const at = t => meteorAt(t) * meteor.dist;
    const head = at(f);
    let tail = at(f - METEOR_TRAIL / METEOR_FLY);                                // waar de kop zonet was
    if (q > 0) tail += (head - tail) * ease(q);                                  // na het opbranden lost het spoor op naar het eindpunt
    const len = head - tail;
    // helderheid: zacht opgloeien, een kleine opflakkering vlak voor het einde, het spoor dooft na
    const base = smoothstep(0, 0.2, f), flare = 0.35 * Math.exp(-(((f - 0.86) / 0.07) ** 2));
    const glow = base * (1 + flare);
    const a = 0.5 * glow * (1 - q) ** 1.4;
    const nx = -meteor.dy, ny = meteor.dx;
    const hx = meteor.x + meteor.dx * head, hy = meteor.y + meteor.dy * head;
    if (len > 0.5 && a > 0.004) {
      const tx = meteor.x + meteor.dx * tail, ty = meteor.y + meteor.dy * tail, w = 1 - 0.4 * q;
      meteorQuad(hx, hy, tx, ty, nx, ny, w * 2.6, a * 0.2);   // zachte rand
      meteorQuad(hx, hy, tx, ty, nx, ny, w * 0.9, a);         // fijne kern
    }
    // de kop: een kort streepje (waar hij een beeld geleden was tot nu), zwelt met de opflakkering en brandt op tot niets
    const hr = base * (1.1 + 0.7 * flare / 0.35) * (1 - smoothstep(0.88, 1, f));
    if (hr > 0.05 && q === 0) {
      const back = Math.min(len, Math.max(0, head - at(f - 16 / METEOR_FLY)));
      const bx = hx - meteor.dx * back, by = hy - meteor.dy * back;
      ctx.fillStyle = rgba(INK, Math.min(0.85, 0.62 * glow));
      ctx.beginPath();
      ctx.arc(hx, hy, hr, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);
      ctx.arc(bx, by, hr, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Sterrenbeeld: bij elke 25e ster verbinden dunne lijntjes de laatste 25 sterren even (kortste verbindingen, Prim)
  function makeConstellation(count) {
    const pts = sky.slice(-count);
    if (pts.length < 3) return null;
    const inTree = [0], edges = [], rest = new Set(pts.map((_, i) => i).slice(1));
    while (rest.size) {
      let best = null, bd = Infinity;
      for (const i of inTree) for (const j of rest) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < bd) { bd = d; best = [i, j]; }
      }
      inTree.push(best[1]); rest.delete(best[1]);
      edges.push([pts[best[0]], pts[best[1]]]);
    }
    return edges;
  }
  function drawConstellation(now) {
    if (!constellation) return;
    const e = (now - constellation.t0) / 1000;
    if (e < 0) return;
    const IN = 1.6, HOLD = 3.2, OUT = 2;
    if (e > IN + HOLD + OUT) { constellation = null; return; }
    const fade = e > IN + HOLD ? 1 - (e - IN - HOLD) / OUT : 1;
    const n = constellation.edges.length;
    ctx.strokeStyle = rgba(INK, 1);
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.3 * fade;
    ctx.beginPath();
    constellation.edges.forEach(([stA, stB], i) => {
      // lijntjes verschijnen na elkaar en groeien van de ene ster naar de andere
      const p = clamp((e / IN) * n - i, 0, 1);
      if (p <= 0) return;
      const ks = skyScale(), [ax, ay] = skyXY(stA.x, stA.y, ks, stA), [bx, by] = skyXY(stB.x, stB.y, ks, stB);
      ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * p, ay + (by - ay) * p);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Vortex (naar React Bits): in het zijaanzicht spiraalt fijn stof langs de wand van de trechter naar de kern.
  // Inkt, heel licht, dichter en donkerder naar de bodem; het laatste stukje kleurt naar de kern.
  function drawVortex() {
    const amount = dustAmount * cam.depth;
    if (amount < 0.01) return;
    const n = Math.round(DUST * Math.min(1, dustAmount));
    const buckets = Array.from({ length: 8 }, () => []), red = [];
    for (let i = 0; i < n; i++) {
      const d = dust[i];
      if (!project(Math.cos(d.a) * d.r, Math.sin(d.a) * d.r, funnelZ(d.r) * cam.depth, true)) continue;
      const near = 1 - d.r / 210;
      const fadeIn = smoothstep(210, 168, d.r) * smoothstep(coreR, coreR + 3, d.r);   // zacht verschijnen aan de rand, opgaan in de kern
      const back = (Math.sin(d.a + spin + spinDrag) + 1) / 2;   // achterkant van de trechter iets zwakker
      const a = (0.2 + 0.6 * near * near) * fadeIn * (0.55 + 0.45 * back) * amount;
      const size = (1 + 0.7 * near) * cam.du * pt.f;
      if (d.r < coreR + 18) red.push(pt.x, pt.y, size, a * smoothstep(coreR + 18, coreR + 4, d.r));
      buckets[Math.min(7, Math.floor(a * 14))].push(pt.x, pt.y, size);
    }
    ctx.fillStyle = rgba(INK, 1);
    buckets.forEach((b, k) => {
      if (!b.length) return;
      ctx.globalAlpha = (k + 0.5) / 14;
      ctx.beginPath();
      for (let i = 0; i < b.length; i += 3) ctx.rect(b[i] - b[i + 2] / 2, b[i + 1] - b[i + 2] / 2, b[i + 2], b[i + 2]);
      ctx.fill();
    });
    ctx.fillStyle = rgba(URGENT_RGB, 1);
    for (let i = 0; i < red.length; i += 4) {
      ctx.globalAlpha = red[i + 3];
      ctx.fillRect(red[i] - red[i + 2] / 2, red[i + 1] - red[i + 2] / 2, red[i + 2], red[i + 2]);
    }
    ctx.globalAlpha = 1;
  }

  // Glyph sonar (naar React Bits): een tik op de kern zendt een ring van tekens uit langs de trechter. Waar hij de
  // taak raakt waar de kern over praat, kaatst een echo terug: twee dunne ringen rond die bol.
  function drawSonar(now) {
    if (!sonar || reducedMotion.matches) return;
    const e = (now - sonar.t0) / 1000;
    // gewone tik: tot net buiten de ringen; nieuwe hemel (far): sneller en tot buiten beeld, en neemt de sterren mee
    const R = 26 + e * (sonar.far ? SKY_WAVE_SPEED : SONAR_SPEED);
    const reach = sonar.far ? Math.hypot(W, H) / (cam.s * cam.zoom) : EDGE + 40;
    if (!sonar.quiet && (sonar.far ? R < reach : e < SONAR_LIFE && R < reach)) {
      const n = sonar.far ? Math.max(84, Math.round(R * 0.5)) : 84;
      const fade = sonar.far ? 0.85 * (1 - smoothstep(reach * 0.55, reach, R)) : (1 - e / SONAR_LIFE) * (1 - smoothstep(EDGE - 10, EDGE + 40, R));
      const z = (R < RIM ? depthAt(R) : 0) * cam.depth;
      ctx.font = `500 ${Math.max(8, 9 * cam.du)}px "Geist Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(INK, 1);
      const step = Math.floor(e * 24);
      for (let k = 0; k < n; k++) {
        const a = k / n * TAU;
        if (!project(Math.cos(a) * R, Math.sin(a) * R, z, true)) continue;
        ctx.globalAlpha = fade * (0.25 + 0.55 * ((k + step) % 4 === 0)) * Math.min(1, pt.f);
        ctx.fillText(GLYPHS[(k * 7 + step) % GLYPHS.length], pt.x, pt.y);
      }
      ctx.textAlign = 'left';
    }
    // echo rond de gezochte bol, zodra het front zijn baan bereikt
    const o = sonar.target && orbs.get(sonar.target);
    if (o && o.sx != null) {
      const hit = sonar.t0 + (sonar.timeTo ? sonar.timeTo(coreHit ? Math.hypot(o.sx - coreHit.x, o.sy - coreHit.y) : 0) : Math.max(0, (o.r - 26) / SONAR_SPEED)) * 1000;
      const q = (now - hit) / 1000;
      if (q > 0 && q < 2.4) {
        ctx.strokeStyle = rgba(INK, 1);
        ctx.lineWidth = 1;
        for (const lag of [0, 0.35]) {
          const p = (q - lag) / 1.2;
          if (p <= 0 || p >= 1) continue;
          ctx.globalAlpha = 0.55 * (1 - p) * o.alpha;
          ctx.beginPath(); ctx.arc(o.sx, o.sy, o.sr + 3 + 14 * ease(p), 0, TAU); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawRings(now) {
    const maxHot = Math.max(...ringHot.values());
    rings.forEach((ring, idx) => {
      const lv = ring.lv;
      const hot = ringHot.get(lv.id);
      const pulse = (ringPulse.get(lv.id) || 0) * (reducedMotion.matches || minimal ? 0 : 1);
      const pulseEased = pulse * pulse;
      const base = RING_ALPHA[idx] ?? RING_ALPHA[RING_ALPHA.length - 1];
      const intro = introAlpha(now, 0.15 + idx * 0.12, 0.8);
      const alpha = clamp(base * (1 - 0.32 * maxHot * (1 - hot)) + 0.5 * hot + 0.18 * pulseEased, 0, 1) * intro * orbVeil;   // tijdens de maandwissel wijken ook de ringen: enkel de kern en de sterren
      const z = ring.z * cam.depth;
      // stippen
      const blend = Math.max(hot, 0.45 * pulseEased, gifts.has('tinted') ? 0.55 : 0);   // Gekleurde banen: altijd een zachte tint
      ctx.fillStyle = rgba(blend > 0.02 ? mixInk(colors.get(lv.id), blend) : INK, 1);
      // In het zijaanzicht worden de ringen platte ellipsen die elkaar kruisen. Twee ingrepen houden het rustig:
      // elke tweede stip vervaagt, en de achterkant van elke ring (van je af) krijgt minder dekking dan de voorkant.
      const r = (1 + 0.35 * hot + 0.15 * pulseEased) * (RING_DOT[idx] ?? 1) * cam.du;
      const cue = cam.depth * (1 - hot);
      const buckets = new Map();
      for (let i = 0, j = 0; i < ring.pts.length; i += 2, j++) {
        const x = ring.pts[i], y = ring.pts[i + 1];
        const front = (x * cam.ss + y * cam.cs) / lv.ring;          // 1 = dichtst bij de kijker, -1 = achteraan
        const factor = (j % 2 ? 1 - 0.8 * cue : 1 + 0.4 * cue) * (1 - 0.68 * cue * (1 - front) / 2);
        const a = Math.min(1, alpha * factor);
        if (a < 0.004 || !project(x, y, z, true)) continue;
        const k = Math.round(a * 24);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(pt.x, pt.y, r * pt.f);
      }
      for (const [k, list] of buckets) {
        ctx.globalAlpha = k / 24;
        ctx.beginPath();
        for (let i = 0; i < list.length; i += 3) { ctx.moveTo(list[i] + list[i + 2], list[i + 1]); ctx.arc(list[i], list[i + 1], list[i + 2], 0, TAU); }
        ctx.fill();
      }
      // spoor op de baan: de stippen net achter een komeet gloeien even na in zijn kleur
      if (!reducedMotion.matches && !minimal) {
        const heads = [];
        for (const o of orbs.values()) if (o.level === lv.id && !o.leaving && o.alpha > 0.5 && Math.abs(o.r - lv.orbit) < 3) heads.push(orbAngle(o));
        const sp = speed.get(lv.id);
        if (heads.length && sp > 0.15) {
          const n = ring.pts.length / 2;
          ctx.fillStyle = rgba(colors.get(lv.id), 1);
          for (let j = 0; j < n; j++) {
            let glow = 0;
            for (const a of heads) {
              const behind = wrapAngle(a - j / n * TAU);
              if (behind > 0 && behind < WAKE) glow = Math.max(glow, (1 - behind / WAKE) ** 2 * orbVeil);   // weg met de bollen tijdens de maandwissel
            }
            if (glow < 0.04) continue;
            const x = ring.pts[2 * j], y = ring.pts[2 * j + 1];
            if (!project(x, y, z, true)) continue;
            ctx.globalAlpha = 0.55 * glow * Math.min(1, sp) * intro;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, r * pt.f * (1 + 0.6 * glow), 0, TAU);
            ctx.fill();
          }
        }
      }
      // monsterpunten voor hit-testing
      for (let k = 0; k < 48; k++) {
        const a = k / 48 * TAU;
        project(Math.cos(a) * lv.ring, Math.sin(a) * lv.ring, z, true);
        ring.screen[2 * k] = pt.x; ring.screen[2 * k + 1] = pt.y;
      }
    });
    ctx.globalAlpha = 1;
  }

  function mixInk(c, t) {
    return [INK[0] + (c[0] - INK[0]) * t, INK[1] + (c[1] - INK[1]) * t, INK[2] + (c[2] - INK[2]) * t];
  }

  /* Kern: een baken. Effen stip die klopt en effen lichtgolven uitzendt; sneller, sterker en meer golven bij meer urgentie */
  function beatPeriod() {
    return urgency >= 1 ? 1.9 / (1 + 0.9 * (urgency - 1)) : 3.4;
  }

  // Kern "Rasterpunt" (gekozen door Victor uit twee reeksen voorstellen): een cirkel van drukpuntjes zoals op een
  // risoposter, plat in het vlak van de tip. Rustig: klein, grijs, een trage ademgolf. Dringend: groter, in kleur,
  // en bij elke slag rolt een golf naar buiten door de puntjes. Effen stippen, geen verloop of gloed.
  function drawCore(now) {
    const intro = introAlpha(now, 0, 1.1) * (1 - 0.55 * sleepK);   // slapend: bijna uitgedoofd
    if (intro <= 0) return;
    const z = TIP_Z * cam.depth;
    const strength = Math.min(1, urgency / 2) * 0.6 + Math.min(1, urgency) * 0.4;   // 0..1
    const still = reducedMotion.matches;
    const live = Math.min(1, urgency / 0.3);                // 0 = rustig, 1 = Vandaag of Nu
    const rMax = CORE_R;
    coreR = rMax;
    const p = ((beat % 1) + 1) % 1;
    const front = p * (rMax + 8);   // golf rolt van het midden tot net buiten het raster
    const rippleAmp = still ? 0 : (0.5 + 0.9 * strength) * (1 - p * 0.6) * live * waveVis * beatScale;
    const breatheAmp = still ? 0 : (0.12 + 0.1 * sleepK) * (1 - live) * waveVis;
    const t = now / 1000;
    const spacing = Math.min(rMax / (DPR >= 2 ? 5.2 : 4.2), Math.max(CORE_SPACING * (DPR >= 2 ? CORE_FINE : 1), (DPR >= 2 ? CORE_MIN_PX_SHARP : CORE_MIN_PX) / cam.s));
    const grow = spacing / CORE_SPACING;                     // grover raster, grotere puntjes
    const eyes = faceState(now, rMax, spacing, z);
    const tw = turnWaves(now);   // maandwissel: een rimpel door de puntjes bij elke ster die aankomt
    coreHit = project(0, 0, z, false) ? { x: pt.x, y: pt.y, r: Math.max(22, (rMax + 4) * cam.s * pt.f) } : null;
    // Ogen "Inktpil" (P1): puntjes in twee rechtopstaande pillen kleuren van rood naar inkt. In negen stappen (O1; was vier)
    // gebundeld, zodat het één pad per tint blijft.
    const paths = Array.from({ length: 9 }, () => []);   // O1: negen tinten van rood naar inkt (was vier), de rand van het oog vloeit
    const blush = gifts.has('blush'), blushDots = [];
    for (const d of coreGrid(spacing, rMax)) {
      if (d.r > rMax + 0.05) continue;
      const uR = Math.min(1, d.r / rMax);
      const edgeSoft = 1 - smoothstep(0.82, 1.04, uR);
      const base = (0.2 + 1.08 * Math.pow(1 - uR, 0.68)) * (0.72 + 0.28 * edgeSoft);
      const bump = rippleAmp ? Math.exp(-(((d.r - front) / (3.2 * grow)) ** 2)) * rippleAmp : 0;
      const breathe = breatheAmp ? breatheAmp * Math.sin(t * (1.3 - 0.85 * sleepK) - d.r * 0.25) : 0;
      let gulp = 0;
      if (tw) for (const age of tw) gulp += 0.9 * (1 - age / 0.4) * Math.exp(-(((d.r - age / 0.32 * (rMax + 8)) / (3.2 * grow)) ** 2));
      const size = base + bump + breathe + gulp;
      if (size < 0.25 || !project(d.x, d.y, z, false)) continue;
      const ink = eyes.ink(d.x, d.y);
      if (blush && ink < 0.25 && Math.min(Math.hypot(d.x - eyes.cheek.x, d.y - eyes.cheek.y), Math.hypot(d.x + eyes.cheek.x, d.y - eyes.cheek.y)) < eyes.cheek.r) {
        blushDots.push(pt.x, pt.y, size * grow * CORE_DOT * cam.s * pt.f);
        continue;
      }
      paths[Math.round(ink * 8)].push(pt.x, pt.y, size * grow * CORE_DOT * cam.s * pt.f * (1 + 0.25 * ink));   // inkt iets groter: de pil leest voller
    }
    if (blushDots.length) {   // Blosjes (geschenk): zachtroze puntjes onder de ogen
      // lichter dan de kern zelf (die is meestal rood): zachtroze vlekjes lezen dan als blos, niet als extra ogen
      const k = theme === THEMES.dark ? 0.55 : 0.62, rose = [255, 226, 234];
      ctx.fillStyle = rgba(coreColor.map((c, i) => c + (rose[i] - c) * k), intro);
      ctx.beginPath();
      for (let k = 0; k < blushDots.length; k += 3) { ctx.moveTo(blushDots[k] + blushDots[k + 2], blushDots[k + 1]); ctx.arc(blushDots[k], blushDots[k + 1], blushDots[k + 2], 0, TAU); }
      ctx.fill();
    }
    paths.forEach((list, i) => {
      if (!list.length) return;
      ctx.fillStyle = rgba(mixInk(coreColor, 1 - i / 8), intro);
      ctx.beginPath();
      for (let k = 0; k < list.length; k += 3) {
        ctx.moveTo(list[k] + list[k + 2], list[k + 1]);
        ctx.arc(list[k], list[k + 1], list[k + 2], 0, TAU);
      }
      ctx.fill();
    });
  }

  // Ogen: plaats en grootte volgen de kern (op gsm met grover raster wat groter, anders lezen ze niet).
  // ink(x, y) geeft per puntje hoeveel inkt het krijgt (0..1).
  function faceState(now, rMax, spacing, z) {
    const t = now / 1000, still = reducedMotion.matches;
    const dt = Math.min(0.1, Math.max(0, (now - face.last) / 1000)); face.last = now;
    // kijkrichting: naar de cursor, naar een gevraagd doel, of rustig rondkijken
    let goal = face.lookGoal;
    if (!goal && pointer.inside && project(0, 0, z, false)) {
      const dx = pointer.x - pt.x, dy = pointer.y - pt.y, m = Math.hypot(dx, dy) || 1;
      goal = [dx / m * Math.min(1, m / 220), dy / m * Math.min(1, m / 220)];
    }
    if (!goal) goal = still ? [0, 0.1] : [0.35 * Math.sin(t * 0.31), 0.1 + 0.2 * Math.sin(t * 0.19 + 1)];
    face.look = face.look.map((v, i) => v + (goal[i] - v) * (1 - Math.exp(-6 * dt)));
    // knipperen: elke 2,6 tot 6 s, 0,24 s lang
    let open = 1;
    if (!still) {
      if (!face.nextBlink) face.nextBlink = t + 2 + Math.random() * 3;
      if (t >= face.nextBlink) { face.blinkAt = t; face.nextBlink = t + 2.6 + Math.random() * 3.4; }
      const b = (t - face.blinkAt) / 0.24;
      if (b >= 0 && b < 1) open = 1 - Math.sin(b * Math.PI);
    }
    const sleepy = new Date().getHours() < 6;                     // 's nachts slaperig: half zo hoog, bovenkant zakt
    if (sleepy) open *= 0.42;
    open *= 1 - 0.95 * sleepK;                                    // slapend: ogen dicht
    const happy = performance.now() < face.happyUntil;
    const h = Math.max(rMax * 0.25, spacing * 2.2);   // O1: nooit kleiner dan 2,2 puntafstanden, ook op een grof raster
    const gap = Math.max(rMax * 0.36, h * 1.3), ey = -rMax * 0.12;
    const soft = spacing * 0.7, o = Math.max(0.12, open);
    const [lx, ly] = face.look;
    const rw = h * 0.4;
    const wink = performance.now() < face.winkUntil;   // knipoog: het rechteroog dicht
    const eyes = [-gap, gap].map((ex, i) => {
      const px = ex + lx * h * 0.4, py = ey + ly * h * 0.35;
      const oe = wink && i === 1 ? 0.12 : o, hle = h * 0.62 * oe;
      return { ex, px, py, top: sleepy ? py - hle * 0.2 : py - hle, bot: py + hle, flat: Math.min(1, Math.max(0.25, oe * 2)) };
    });
    const cover = (v, w) => Math.max(0, Math.min(1, (w - v) / soft + 0.5));
    return {
      cheek: { x: gap + rw * 0.5, y: ey + h * 0.62 + spacing * 1.5, r: spacing * 1.85 },   // geschenk Blosjes: een rond vlekje schuin onder elk oog (na O1, grotere ogen)
      ink(x, y) {
        let c = 0;
        for (const e of eyes) {
          if (happy) {
            // blij: een boogje (∩) van inktpuntjes
            const cy = ey + h * 0.5, rad = h * 0.62;
            if (y > cy + rad * 0.25) continue;
            c = Math.max(c, cover(Math.abs(Math.hypot(x - e.ex, y - cy) - rad), spacing * 0.45));
          } else {
            const yy = Math.max(e.top, Math.min(e.bot, y));
            c = Math.max(c, cover(Math.hypot(x - e.px, (y - yy) / e.flat), rw));
          }
        }
        return c;
      },
    };
  }

  const isHot = o => hover.orb === o.id || external.task === o.id || pinned === o.id;

  function orbAngle(o) { return phase.get(o.level) + o.offset + (o.lag || 0); }

  function orbFunnel(o, a, r = o.r) {
    const z = r < RIM ? depthAt(r) * cam.depth : 0;
    return [Math.cos(a) * r, Math.sin(a) * r, z];
  }

  // Punten langs de baan achter een bol, op het scherm
  const trailPts = [];
  // Teruggerekend over tau seconden met hoeksnelheid omega en radiale snelheid vr
  function tracePath(o, from, a, omega, vr, tau, steps) {
    trailPts.length = 0;
    trailPts.push(from.x, from.y);
    for (let k = 1; k <= steps; k++) {
      const t = k / steps * tau;
      const [x, y, z] = orbFunnel(o, a - omega * t, Math.max(1, o.r - vr * t));
      if (!project(x, y, z, true)) break;
      trailPts.push(pt.x, pt.y);
    }
    return trailPts.length / 2;
  }

  // Taps vlak langs trailPts: volle breedte aan de kop, dun aan het eind (kleur of verloop: fillStyle van de aanroeper)
  function taper(wHead, wTail) {
    const n = trailPts.length / 2;
    if (n < 2) return;
    const left = [], right = [];
    for (let k = 0; k < n; k++) {
      const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1);
      const dx = trailPts[2 * b] - trailPts[2 * a], dy = trailPts[2 * b + 1] - trailPts[2 * a + 1];
      const len = Math.hypot(dx, dy) || 1;
      const w = (wHead + (wTail - wHead) * k / (n - 1)) / 2;
      left.push(trailPts[2 * k] - dy / len * w, trailPts[2 * k + 1] + dx / len * w);
      right.push(trailPts[2 * k] + dy / len * w, trailPts[2 * k + 1] - dx / len * w);
    }
    ctx.beginPath();
    ctx.moveTo(left[0], left[1]);
    for (let k = 1; k < n; k++) ctx.lineTo(left[2 * k], left[2 * k + 1]);
    for (let k = n - 1; k >= 0; k--) ctx.lineTo(right[2 * k], right[2 * k + 1]);
    ctx.closePath();
    ctx.fill();
  }

  // Bol ("Komeet", gekozen door Victor): volle ronde kop, de staart dooft uit naar doorzichtig langs de werkelijke
  // baan (ook tijdens binnenvliegen of van ring wisselen). Effen staarten oogden te speels.
  // Lengte volgt de snelheid: op kruissnelheid de gewone staart, sneller (binnenvliegen) tot 2,5 keer zo lang.
  function drawOrb(o, it, lv, sp, moving) {
    ctx.globalAlpha = o.alpha * orbVeil;
    // heel zachte gloed rond de kop (op vraag van Victor): een radiaal verloop van de eigen kleur naar niets,
    // in het donker iets sterker. Geen schaduwfilter: dat is traag op gsm.
    if (!minimal) {
      const c = colors.get(o.level), R = it.r * 3.2;
      const g = ctx.createRadialGradient(it.sx, it.sy, it.r * 0.6, it.sx, it.sy, R);
      g.addColorStop(0, rgba(c, theme.glow));
      g.addColorStop(0.45, rgba(c, theme.glow * 0.35));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(it.sx, it.sy, R, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = rgba(colors.get(o.level), 1);
    if (moving) {
      const omega = TAU / lv.period * sp + (o.vo || 0);
      const vr = o.vr || 0;
      const v = Math.hypot(o.r * omega, vr);
      const cruise = lv.orbit * TAU / lv.period;
      // In normale modus volgt de staartlengte de snelheid (cruise = 1).
      // In Zen-modus (Voorstel 2) behouden de orbs ~75% van hun sierlijke normale lengte.
      const zenTailScale = tempo.tail !== undefined ? tempo.tail : 1;
      const vRatio = (sp > 0.001 && tempo.tail !== undefined) ? (v / (cruise * sp)) * zenTailScale : (v / cruise);
      const length = (lv.tail + 1) * TAIL_GAP * TAIL_LENGTH * Math.min(2.5, vRatio);
      if (v > 0.01 && length > 0.5) {
        const n = tracePath(o, it, it.a, omega, vr, length / v, TRAIL_STEPS);
        if (n > 1) {
          const c = colors.get(o.level);
          const fade = ctx.createLinearGradient(trailPts[0], trailPts[1], trailPts[2 * n - 2], trailPts[2 * n - 1]);
          fade.addColorStop(0, rgba(c, 0.95));
          fade.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = fade;
          taper(it.r * 1.15, it.r * 0.35);
          ctx.fillStyle = rgba(c, 1);
        }
      }
    }
    ctx.beginPath();
    ctx.arc(it.sx, it.sy, it.r, 0, TAU);
    if (o.due) {
      // deadline ("Holle kop", gekozen door Victor): open kop met een stip in het midden, de staart blijft effen.
      // Verstreken: de kop vult zich met inkt, de rand houdt de eigen kleur.
      const lw = Math.max(1, it.r * 0.28);
      ctx.fillStyle = rgba(o.late ? INK : PAPER, 1);
      ctx.fill();
      ctx.strokeStyle = rgba(colors.get(o.level), 1);
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(it.sx, it.sy, Math.max(0.5, it.r - lw / 2), 0, TAU);
      ctx.stroke();
      if (!o.late) {
        ctx.fillStyle = rgba(colors.get(o.level), 1);
        ctx.beginPath();
        ctx.arc(it.sx, it.sy, Math.max(0.75, it.r * 0.28), 0, TAU);
        ctx.fill();
      }
    } else ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawOrbs() {
    const list = orbVeil < 0.01 ? [] : [...orbs.values()].filter(o => o.wait <= 0 && o.alpha > 0.01);
    const items = [];
    for (const o of list) {
      const lv = LEVEL_BY_ID.get(o.level);
      const a = orbAngle(o);
      const [x, y, z] = orbFunnel(o, a);
      if (!project(x, y, z, true)) { o.sx = null; continue; }
      let sx = pt.x, sy = pt.y;
      const f = pt.f, depth = pt.z;
      if (drag?.type === 'orb' && drag.id === o.id && drag.active) { sx = pointer.x; sy = pointer.y; }
      else if (o.blend) { const e = ease(o.blend.p); sx = o.blend.x + (sx - o.blend.x) * e; sy = o.blend.y + (sy - o.blend.y) * e; }
      const r = lv.size / 2 * ORB_SCALE * cam.du * f * (isHot(o) ? 1.2 : 1);
      o.sx = sx; o.sy = sy; o.sr = Math.max(r, 4);
      items.push({ o, lv, a, x: sx, y: sy, sx, sy, r, f, depth });
    }
    items.sort((p, q) => p.depth - q.depth);
    for (const it of items) {
      const { o, lv } = it;
      const sp = speed.get(o.level);
      const free = !(drag?.type === 'orb' && drag.id === o.id && drag.active) && !o.blend;
      if (isHot(o)) {
        ctx.strokeStyle = rgba(INK, 0.35 * o.alpha);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(it.sx, it.sy, it.r + 4, 0, TAU);
        ctx.stroke();
      }
      drawOrb(o, it, lv, sp, free && o.r > 1);
    }
  }

  // Vierpuntige ster met holle zijden (sterren in de hemel); vroeger ook het uitfonkelen bij afvinken (Zilver, vervangen door A)
  function star4(x, y, R, rot, waist = 0.18) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = rot + i * Math.PI / 2, b = a + Math.PI / 4, c = a + Math.PI / 2;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
      ctx.quadraticCurveTo(x + Math.cos(b) * R * waist, y + Math.sin(b) * R * waist, x + Math.cos(c) * R, y + Math.sin(c) * R);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Opbranden (A, Victor, 03/11/2026, uit vier voorstellen in artifact "Orbit afvinkmoment"; vervangt "Zilver", het uitfonkelen
  // als vierpuntige ster, dat vlak voor de nieuwe ster in de hemel als een tweede ster las). Zoals de vallende ster: de bol
  // remt af langs zijn baan, flakkert nog even op en krimpt tot niets; zijn staart krimpt mee met zijn snelheid en lost op.
  function drawEffects() {
    for (const q of burns) {
      const lv = LEVEL_BY_ID.get(q.level), c = colors.get(q.level);
      const o = { r: q.r };
      if (!project(...orbFunnel(o, q.a), true)) continue;
      const hx = pt.x, hy = pt.y, r = lv.size / 2 * ORB_SCALE * cam.du * pt.f * (q.k || 1);
      ctx.globalAlpha = q.alpha;
      const p = Math.max(0, q.age) / BURN_LIFE;
      const head = Math.min(1, p / 0.8);
      const flick = 1 + 0.35 * Math.sin(Math.max(0, Math.min(1, (head - 0.5) / 0.35)) * Math.PI);
      const hit = 1 + 0.22 * Math.sin(Math.min(1, Math.max(0, q.age) / 0.22) * Math.PI);   // het lichtpuntje komt aan: kleine opflakkering
      const rh = r * Math.pow(1 - head, 1.3) * flick * hit;
      const fadeT = 1 - smoothstep(0.5, 1, p);
      // staart langs de baan, zo lang als bij een gewone bol op die snelheid (krimpt mee als hij afremt), lost na het opbranden op
      const span = (lv.tail + 1) * TAIL_GAP * TAIL_LENGTH / lv.orbit * Math.min(2.5, q.w / (TAU / lv.period));
      trailPts.length = 0;
      for (let k = 0; k <= TRAIL_STEPS; k++) {
        if (!project(...orbFunnel(o, q.a - k / TRAIL_STEPS * span), true)) break;
        trailPts.push(pt.x, pt.y);
      }
      const n = trailPts.length / 2;
      if (n > 1 && fadeT > 0.01) {
        const g = ctx.createLinearGradient(trailPts[0], trailPts[1], trailPts[2 * n - 2], trailPts[2 * n - 1]);
        g.addColorStop(0, rgba(c, 0.95 * fadeT)); g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        taper(1.15 * Math.max(rh, r * 0.6 * (1 - p)), r * 0.3 * (1 - p));
      }
      if (rh > 0.2) {
        if (!minimal) {   // dezelfde zachte gloed als een gewone bol, dooft mee
          const R = rh * 3.2, g = ctx.createRadialGradient(hx, hy, rh * 0.6, hx, hy, R);
          g.addColorStop(0, rgba(c, theme.glow)); g.addColorStop(0.45, rgba(c, theme.glow * 0.35)); g.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, R, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = rgba(c, 1); ctx.beginPath(); ctx.arc(hx, hy, rh, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Lichtpuntje van de rij in de lijst naar de bol: een korte boog met een staartje
  function drawSparks(now) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i], p = (now - s.t0) / SPARK_MS;
      if (p >= 1) { sparks.splice(i, 1); continue; }
      // eindpunt = waar de bol nu is (hij draait door), zodat het lichtpuntje hem echt raakt
      if (!project(...orbFunnel({ r: s.burn.r }, s.burn.a), true)) continue;
      const x1 = pt.x, y1 = pt.y;
      const at = q => {
        const e = ease(Math.max(0, Math.min(1, q)));
        const mx = (s.x0 + x1) / 2, my = Math.min(s.y0, y1) - 60;   // boogje omhoog
        const u = 1 - e;
        return [u * u * s.x0 + 2 * u * e * mx + e * e * x1, u * u * s.y0 + 2 * u * e * my + e * e * y1];
      };
      const [hx, hy] = at(p);
      const c = colors.get(s.level);
      trailPts.length = 0;
      for (let k = 0; k <= 8; k++) { const [x, y] = at(p - k * 0.016); trailPts.push(x, y); }
      const n = trailPts.length / 2;
      if (Math.hypot(trailPts[2 * n - 2] - hx, trailPts[2 * n - 1] - hy) > 1) {
        const g = ctx.createLinearGradient(hx, hy, trailPts[2 * n - 2], trailPts[2 * n - 1]);
        g.addColorStop(0, rgba(c, 0.9)); g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        taper(4.4, 0.3);
      }
      ctx.fillStyle = rgba(c, 1);   // in de kleur van het moment (A): geen inktstip die als ster leest
      ctx.beginPath(); ctx.arc(hx, hy, 2.4, 0, TAU); ctx.fill();
    }
  }

  /* Labels: witte pil, zoals in het wiel */
  // Eerst meten (`pillBox`), dan tekenen (`drawPill`): zo kan `drawLabels` ze schikken zodat ze elkaar nooit overlappen.
  const PILL_H = 26;
  function pillBox(text, x, y, align, color, opts = {}) {
    ctx.font = opts.mono ? '500 10.5px "Geist Mono", ui-monospace, monospace' : '500 12.5px Geist, system-ui, sans-serif';
    let label = text;
    const maxW = 220;
    while (ctx.measureText(label).width > maxW && label.length > 4) label = label.slice(0, -2);
    if (label !== text) label = label.trimEnd() + '…';
    const tw = ctx.measureText(label).width;
    const padX = 10, h = PILL_H, dot = color ? 12 : 0;
    const w = tw + padX * 2 + dot;
    let left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    left = clamp(left, 8, W - w - 8);
    const top = clamp(y - h / 2, 8, H - h - 8);
    return { label, left, top, w, h, padX, dot, color, opts };
  }
  function drawPill(b) {
    const { label, left, top, w, h, padX, dot, color, opts } = b;
    ctx.font = opts.mono ? '500 10.5px "Geist Mono", ui-monospace, monospace' : '500 12.5px Geist, system-ui, sans-serif';
    ctx.save();
    ctx.shadowColor = theme.shadow;
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = theme.pillBg;
    ctx.beginPath();
    ctx.roundRect(left, top, w, h, h / 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = theme.pillLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(left + 0.5, top + 0.5, w - 1, h - 1, h / 2);
    ctx.stroke();
    if (color) {
      ctx.fillStyle = rgba(color, 1);
      ctx.beginPath();
      ctx.arc(left + padX + 3, top + h / 2, 3, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = opts.mono ? rgba(color || INK, 1) : theme.pillText;
    ctx.textAlign = 'left';   // expliciet: een effect (sonar) kan het op center laten staan
    ctx.textBaseline = 'middle';
    ctx.fillText(label, left + padX + dot, top + h / 2 + 0.5);
  }

  // Labels: "Nummers en legende" (gekozen door Victor uit vier voorstellen, 01/11/2026). Vroeger stond naast elke bol een
  // pil die enkel andere pillen ontweek; op gsm liep een lange titel over andere bollen en buiten beeld. Nu krijgt elke bol
  // van een opgelichte ring een klein nummer naast zich, en staan titel en deadline in een legende onder de scène
  // (`onLegend`, getekend door legend.js). Eén bol (aanwijzen, vastzetten, rij in de lijst): enkel zijn regel, zonder nummer.
  let legendKey = '', legendOrder = [], legendSig = '';
  function drawLabels() {
    if (drag?.type === 'orb' && drag.active) {
      if (dropLevel) ringLabel(dropLevel, true);
      emitLegend(null);
      return;
    }
    const hot = hotLevel();
    const single = hover.orb ?? external.task ?? pinned;
    let shown = [], key = '';
    if (single && orbs.has(single)) { shown = [orbs.get(single)]; key = `o:${single}`; }
    else if (hot) { shown = [...orbs.values()].filter(o => o.level === hot && !o.leaving && o.sx != null); key = `r:${hot}`; }
    const ring = hot ? ringBox(hot, false) : null;
    if (!shown.length) { if (ring) drawPill(ring); emitLegend(null); return; }
    // volgorde vast zolang dezelfde ring opgelicht is: met de klok mee vanaf boven, nieuwe bollen achteraan
    const angle = o => (Math.atan2(o.sx - cam.cx, -(o.sy - cam.cy)) + TAU) % TAU;
    if (key !== legendKey) { legendKey = key; legendOrder = shown.slice().sort((a, b) => angle(a) - angle(b)).map(o => o.id); }
    for (const o of shown) if (!legendOrder.includes(o.id)) legendOrder.push(o.id);
    const list = legendOrder.map(id => orbs.get(id)).filter(o => o && shown.includes(o));
    const numbered = key.startsWith('r:');
    if (numbered) {
      ctx.font = '500 10.5px "Geist Mono", ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(INK, .9);
      const spots = [];
      list.forEach((o, i) => {
        let dx = o.sx - cam.cx, dy = o.sy - cam.cy; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        let d = o.sr + 9, x = o.sx + dx * d, y = o.sy + dy * d;
        for (let k = 0; k < 4 && spots.some(p => Math.hypot(p[0] - x, p[1] - y) < 11); k++) { d += 10; x = o.sx + dx * d; y = o.sy + dy * d; }
        spots.push([x, y]);
        ctx.fillText(String(i + 1), x, y);
      });
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      // het ringlabel bovenaan mag geen bol of nummer afdekken: dan schuift het omhoog tot het vrij is
      if (ring) {
        const pts = [...spots, ...list.map(o => [o.sx, o.sy])];
        const covers = () => pts.some(([x, y]) => x > ring.left - 8 && x < ring.left + ring.w + 8 && y > ring.top - 8 && y < ring.top + ring.h + 8);
        for (let k = 0; k < 8 && covers(); k++) ring.top -= 7;
      }
    }
    if (ring) drawPill(ring);
    emitLegend(list.map((o, i) => ({ id: o.id, n: numbered ? i + 1 : 0, title: o.title, due: o.due ? dueLabel(o.due) : '', late: Boolean(o.late), level: o.level })));
  }
  function emitLegend(items) {
    const sig = items ? JSON.stringify(items) : '';
    if (sig === legendSig) return;
    legendSig = sig;
    if (!items) legendKey = '';
    onLegend(items);
  }
  // onderkant van de buitenste ring op het scherm (px, canvas), zodat de legende eronder past zonder iets te raken
  function ringsBottom() {
    const scr = rings[rings.length - 1].screen; let max = 0;
    for (let k = 1; k < scr.length; k += 2) if (scr[k] > max) max = scr[k];
    return max;
  }
  // Onderkant en bovenkant van wat er van de orbit te zien is: in het zijaanzicht hangt de trechter met de kern onder de
  // ringen (Victor, 03/11/2026: de legende stond over de trechter), dus telt de kern mee. Boven: de buitenste ring.
  function sceneBottom() { return Math.max(ringsBottom(), coreHit ? coreHit.y + coreHit.r : 0); }
  function ringsTop() {
    const scr = rings[rings.length - 1].screen; let min = Infinity;
    for (let k = 1; k < scr.length; k += 2) if (scr[k] < min) min = scr[k];
    return min;
  }

  function ringBox(level, isDrop) {
    const lv = LEVEL_BY_ID.get(level);
    const count = [...orbs.values()].filter(o => o.level === level && !o.leaving).length;
    if (!project(0, -lv.ring, depthAt(lv.ring) * cam.depth, false)) return null;
    const text = isDrop ? tx('scene.drop', { level: lv.name.toLowerCase() }) : `${lv.name.toUpperCase()} · ${count}`;
    return pillBox(text, pt.x, pt.y - 16, 'center', null, { mono: !isDrop });
  }
  function ringLabel(level, isDrop) { const b = ringBox(level, isDrop); if (b) drawPill(b); }

  function draw(now) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    updateCamera();
    drawGrid(now);
    drawMilky(now);
    drawSky(now);
    drawConstellation(now);
    drawMeteor(now);
    // Muur van taken verschijnt vóór de sterretjes, maar altijd achter de banen, de kern en de orbs
    drawWall(now);
    drawRings(now);
    drawVortex();
    drawOrbs();
    drawEffects();
    // Kleine nacht bij een nieuwe ster: tekent over de banen en orbs heen, maar achter de rode kern (Victor, 05/11/2026)
    try {
      if (nightDraw) nightDraw(ctx, now, canvas.getBoundingClientRect());
    } catch (err) {
      console.error('nightDraw error:', err);
      nightDraw = null;
    }
    drawSatellites(now, false);
    const swell = turnCore(now);
    if (swell !== 1 && coreHit) {   // maandwissel: de kern zwelt rond haar eigen middelpunt
      const { x, y } = coreHit;
      ctx.save(); ctx.translate(x, y); ctx.scale(swell, swell); ctx.translate(-x, -y);
      drawCore(now);
      ctx.restore();
      coreHit = { x, y, r: coreHit.r };
    } else drawCore(now);
    drawSatellites(now, true);
    drawSonar(now);
    drawSparks(now);
    drawLabels();
  }

  const frameErrors = new Set();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      update(dt, now);
      draw(now);
    } catch (err) {
      // vangnet: de lus blijft draaien, maar een fout mag niet stil verdwijnen; elke soort fout één keer melden, niet 60 keer per seconde
      const key = String(err && err.message);
      if (!frameErrors.has(key)) { frameErrors.add(key); console.error('Orbit frame error:', err); }
    }
    requestAnimationFrame(frame);
  }

  /* ---- Aanwijzer ---- */
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function nearestRing(x, y, threshold) {
    let best = null, bd = threshold;
    for (const ring of rings) {
      const s = ring.screen;
      for (let k = 0; k < 48; k++) {
        const j = (k + 1) % 48;
        const d = distToSegment(x, y, s[2 * k], s[2 * k + 1], s[2 * j], s[2 * j + 1]);
        if (d < bd) { bd = d; best = ring.lv.id; }
      }
    }
    return best;
  }

  function pick(x, y) {
    let best = null, bd = 10;
    for (const o of orbs.values()) {
      if (o.leaving || o.sx == null) continue;
      const d = Math.hypot(o.sx - x, o.sy - y) - o.sr;
      if (d < bd) { bd = d; best = o; }
    }
    if (best) return { orb: best.id, level: best.level };
    return { orb: null, level: nearestRing(x, y, 12) };
  }

  function clearSelection() {
    pinned = null;
    external = { task: null, level: null };
    setHover({ orb: null, level: null });
  }

  const onCoreSpot = p => coreHit && Math.hypot(p.x - coreHit.x, p.y - coreHit.y) < coreHit.r;

  function setHover(next) {
    if (next.orb === hover.orb && next.level === hover.level) return;
    hover = next;
    onHover(hover.orb, hover.level);
  }

  canvas.addEventListener('pointermove', e => {
    wakeUntil = performance.now() + 20000;
    const p = local(e);
    pointer = { ...p, inside: true };
    if (e.pointerType === 'mouse' && !reducedMotion.matches && cam.s) {
      const n = Math.min(W, H) / 2;
      const nx = clamp((p.x - cam.cx) / n, -1, 1), ny = clamp((p.y - cam.cy) / n, -1, 1);
      yawTarget = nx * (3 + 3 * cam.depth);
      pitchTarget = -ny * (2 + 2 * cam.depth);
    }
    if (drag) {
      const dx = p.x - drag.x0, dy = p.y - drag.y0;
      if (!drag.active && Math.hypot(dx, dy) > 5) {
        if (drag.fixed) return; // deadline-taak: vaste schil
        drag.active = true;
      }
      if (!drag.active) return;
      if (drag.type === 'orb') {
        const lv = nearestRing(p.x, p.y, 70);
        dropLevel = lv;
        canvas.style.cursor = 'grabbing';
      } else {
        spinDrag = drag.spin0 + dx * 0.006;
        t = clamp(drag.t0 - dy / 260, 0, 1);
        tween = null;
        canvas.style.cursor = 'grabbing';
      }
      return;
    }
    const h = pick(p.x, p.y);
    setHover(h);
    canvas.style.cursor = h.orb ? (orbs.get(h.orb)?.due ? 'pointer' : 'grab') : onCoreSpot(p) ? 'pointer' : 'default';
  });

  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
    yawTarget = 0; pitchTarget = 0;
    if (!drag) setHover({ orb: null, level: null });
  });

  canvas.addEventListener('pointerdown', e => {
    wakeUntil = performance.now() + 20000;
    if (e.button !== 0) return;
    const p = local(e);
    pointer = { ...p, inside: true };
    const h = pick(p.x, p.y);
    if (e.pointerType !== 'mouse') setHover(h);
    canvas.setPointerCapture(e.pointerId);
    if (h.orb) drag = { type: 'orb', id: h.orb, x0: p.x, y0: p.y, active: false, fixed: Boolean(orbs.get(h.orb)?.due) };
    else drag = { type: 'cam', x0: p.x, y0: p.y, t0: t, spin0: spinDrag, active: false };
  });

  function endDrag(e, cancelled) {
    if (!drag) return;
    const d = drag;
    drag = null;
    canvas.style.cursor = 'default';
    if (d.type === 'orb') {
      const o = orbs.get(d.id);
      if (d.active && o) {
        if (!cancelled && dropLevel) {
          const targetR = LEVEL_BY_ID.get(dropLevel).orbit;
          const dropAngle = (Math.atan2(pointer.y - cam.cy, pointer.x - cam.cx) + TAU) % TAU;
          o.r = targetR;
          o.vr = 0;
          o.vo = 0;
          o.arrive = null;
          o.lag = 0;
          o.blend = null;
          if (dropLevel !== o.level) {
            o.dropAngle = dropAngle;
            onReassign(d.id, dropLevel);
          } else {
            o.offset = wrapAngle(dropAngle - phase.get(o.level));
            layoutOffsets();
          }
        } else {
          o.blend = { x: pointer.x, y: pointer.y, p: 0 };
        }
      } else if (!d.active) {
        pinned = pinned === d.id ? null : d.id;
        onHover(pinned, pinned ? orbs.get(pinned)?.level ?? null : null);
      }
      dropLevel = null;
    } else if (d.active) {
      const name = t > 0.5 ? 'side' : 'top';
      setView(name);
      onView(name);
    } else {
      // een tik op lege ruimte zet alles terug: geen vastgezette bol, geen opgelichte ring
      clearSelection();
      if (!cancelled && e && onCoreSpot(local(e))) onCore();
    }
  }
  canvas.addEventListener('pointerup', e => endDrag(e, false));
  canvas.addEventListener('pointercancel', e => endDrag(e, true));

  requestAnimationFrame(frame);

  return {
    setTasks, complete, setView, setInsets, highlight,
    restartIntro() { introStart = performance.now(); },
    // intro opnieuw, ook de bollen (na de terminal rain)
    replayIntro(list) { orbs.clear(); introStart = performance.now(); setTasks(list, { intro: true }); },
    // de kern kijkt even blij (bv. bij afvinken)
    cheer(ms = 1600) { face.happyUntil = performance.now() + ms; },
    wink(ms = 650) { face.winkUntil = performance.now() + ms; },
    // sterrenbeeld van de laatste `count` sterren, na het verschijnen van de nieuwe ster
    constellation(count = 25) {
      if (reducedMotion.matches || minimal) return;
      const edges = makeConstellation(count);
      if (edges) constellation = { edges, t0: Math.max(performance.now(), lastStarAt) + 1200 };   // na de nieuwe ster
    },
    clearSelection,
    // glyph sonar vanuit de kern; target: id van de taak waar de kern over praat (die bol krijgt een echo)
    // quiet + timeTo: enkel de echo rond de bol, getimed op de zachte golf van fx.js (coreWave) in plaats van de tekens
    sonar(target = null, { quiet = false, timeTo = null } = {}) { if (!reducedMotion.matches && !minimal) sonar = { t0: performance.now(), target, quiet, timeTo }; },
    // nieuwe hemel: een mozaïekgolf neemt de huidige sterren mee (roep vóór setSky)
    newSky() {
      if (reducedMotion.matches || minimal) return;
      const t0 = performance.now();
      skyWave = { t0, old: sky.slice() };
      sonar = { t0, target: null, far: true };
    },
    // Minimaal: alle extra effecten uit; wat overblijft is de scène zelf (ringen, kometen, kern, sterren)
    // maandwissel: `old` = de sterren van de vorige hemel (zelfde vorm als setSky); onBurst start de witte gloed
    // style: een van TURN_STYLES (turn.js); t0: wanneer de tijdlijn begint (iets later dan nu, zodat het geluid op tijd is).
    // Geeft de tijdlijn terug, voor het geluid.
    monthTurn(old, { style, t0 = performance.now(), onBurst } = {}) { const plan = turnPlan(style, old.slice()); turn = { t0, plan, onBurst, fired: false }; skyWave = null; return plan; },
    // oude hemel al tonen (stil, nog niet aangetrokken) tot monthTurn begint, bv. tijdens de zachte intro
    holdTurn(old, style) { turn = { t0: Infinity, plan: turnPlan(style, old.slice()), onBurst: null, fired: true }; skyWave = null; },
    endTurn() { turn = null; },
    get turning() { return Boolean(turn); },
    setMinimal(on) { minimal = on; if (on) { sonar = null; skyWave = null; meteor = null; constellation = null; sparks.length = 0; } },
    wake() { wakeUntil = performance.now() + 20000; },
    // demo: meteen een vallende ster (knop in de details van de teller), ook met Minimaal; niet bij minder beweging
    meteorNow() { meteor = null; nextMeteor = 0; forceMeteor = true; },
    // middelpunt van de kern in schermcoördinaten (voor de golf vanuit de kern)
    coreScreen() { const r = canvas.getBoundingClientRect(); return coreHit ? [r.left + coreHit.x, r.top + coreHit.y] : [r.left + cam.cx, r.top + r.height / 2]; },
    coreAt(clientX, clientY) { const r = canvas.getBoundingClientRect(); return Boolean(onCoreSpot({ x: clientX - r.left, y: clientY - r.top })); },
    // kijkdoel van de kern: [x, y] tussen -1 en 1 (bv. naar de begroeting), of null om vrij te kijken
    lookAt(goal) { face.lookGoal = goal; },
    get centerX() { return cam.cx; },
    ringsBottom,
    sceneBottom,
    ringsTop,
    // linkerrand van de buitenste ring (px) op schermhoogte y, zodat tekst ernaast tot aan die ring kan lopen
    edgeLeft(y) {
      if (!project(-EDGE, 0, 0, false)) return null;
      const r = cam.cx - pt.x, dy = y - cam.cy;
      return Math.abs(dy) >= r ? null : cam.cx - Math.sqrt(r * r - dy * dy);
    },
    // middelpunt en straal van de buitenste ring op het scherm (het bakje in de focus groeit niet over de binnenste ringen)
    ring() {
      if (!project(-EDGE, 0, 0, false)) return null;
      return { cx: cam.cx, cy: cam.cy, r: cam.cx - pt.x };
    },
    setSky(list, { quiet = false } = {}) {
      // wat er na de eerste keer bijkomt, is een nieuwe ster (bij het opstarten niet: dan staat de hemel er al)
      const now = performance.now();
      // de nieuwe ster verschijnt pas als de afgevinkte taak helemaal uitgefonkeld is; een andere hemel tonen gebeurt stil
      if (skyKnown && !quiet && !reducedMotion.matches && !minimal) for (const st of list) if (!skyKnown.has(st.id)) {
        if (holdNext) { starHold.add(st.id); lastStarAt = now + starDelay + 1400; }   // de nacht toont haar; sterrenbeeld pas als het weer open is
        else { skyBorn.set(st.id, now + starDelay); lastStarAt = now + starDelay; }
      }
      starDelay = 0; holdNext = false;
      skyKnown = new Set(list.map(st => st.id));
      sky = list;
    },
    // Nacht na het afvinken (app.js): de nieuwe ster wacht verborgen, de nacht toont haar en de sterrenhemel
    get starWait() { return starDelay; },
    holdNextStar() { holdNext = true; },
    releaseStars(born = false) {
      const now = performance.now();
      if (born) for (const id of starHold) skyBorn.set(id, now);
      starHold.clear();
    },
    // sterren van de getoonde hemel in schermcoördinaten (px): [{id, x, y, r}]
    skyPoints() {
      const r = canvas.getBoundingClientRect(), ks = skyScale(), small = Math.min(W, H) < 500;
      const dense = clamp(1 - (sky.length - 150) / 1500, 0.65, 1);
      return sky.map(st => { const [x, y] = skyXY(st.x, st.y, ks, st); return { id: st.id, x: r.left + x, y: r.top + y, r: starR(st, dense, small) }; });
    },
    // muur van afgevinkte taken achter de hemel: woorden (titels) en aan/uit
    setWall(words, on) { wallWords = words.map(w => w.toUpperCase()); wallOn = on; wallKey = ''; },
    sweepWall(dur = 16000) {
      if (reducedMotion.matches || minimal || !wallWords.length) return;
      wallSweep = { t0: performance.now(), dur };
    },
    cancelWallSweep() { if (wallSweep && !wallSweep.outAt) wallSweep.outAt = performance.now(); },
    get sweeping() { return Boolean(wallSweep && !wallSweep.outAt); },
    isBusy() {
      return Boolean(
        turn !== null ||
        sparks.length > 0 ||
        burns.length > 0 ||
        constellation !== null ||
        starHold.size > 0 ||
        (drag?.type === 'orb' && drag.active) ||
        (performance.now() - lastStarAt < 3000)
      );
    },
    setNightDraw(fn) { nightDraw = fn; },
    // geschenken die nu werken (Set van id's); Meteorenregen haalt een verre volgende meteoor meteen dichterbij
    setGifts(list) {
      const had = gifts.has('meteors');
      gifts = new Set(list);
      if (gifts.has('meteors') && !had) nextMeteor = Math.min(nextMeteor, performance.now() + (40 + Math.random() * 60) * 1000);
    },
    setTempo(name) { if (TEMPO[name]) tempo = TEMPO[name]; },
    setTheme(name) {
      theme = THEMES[name] || THEMES.light;
      INK = theme.ink;
      PAPER = theme.paper;
      colors = PALETTES[name] || PALETTES.light;
      URGENT_RGB = colors.get(URGENT_LEVEL);
    },
  };
}
