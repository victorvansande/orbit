import { LEVELS, LEVEL_BY_ID, URGENT_LEVEL, RIM, TIP_Z, depthAt, rgbOf, rgba } from './config.js';
import { dueLabel, isOverdue } from './deadline.js';
import { tx } from './i18n.js';

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
  normaal: { orbit: () => 1, spin: 1, beat: 1, waves: 1 },
  zen:     { orbit: zenFactor, spin: 0.35, beat: 0.5, waves: 1 },
  stil:    { orbit: () => 0, spin: 0, beat: 0, waves: 0 },
};
const FIT = 440;                        // zoveel stage-eenheden passen in min(breedte, hoogte)

// Kleuren van structuur en labels per thema; de bollen houden hun eigen kleur
const THEMES = {
  light: { glow: 0.2, grid: 1, ink: [24, 24, 32], paper: [241, 241, 239], calm: [168, 168, 178], pillBg: 'rgba(252,252,251,.94)', pillText: '#1b1b22', pillLine: 'rgba(20,20,30,.08)', shadow: 'rgba(20,20,30,.10)', leader: 'rgba(20,20,30,.22)' },
  dark:  { glow: 0.24, grid: 1.3, ink: [236, 236, 241], paper: [15, 15, 18], calm: [112, 112, 124], pillBg: 'rgba(38,38,44,.94)', pillText: '#ECECF1', pillLine: 'rgba(255,255,255,.1)', shadow: 'rgba(0,0,0,.4)', leader: 'rgba(255,255,255,.28)' },
};
const RING_GAP = 8, RING_ALPHA = 0.2, CORE_RING_ALPHA = 0.3;
const TAIL_GAP = 7, TAIL_LENGTH = 1.1, TRAIL_STEPS = 10;
const BEND_R = 170, BEND_PX = 18;          // raster rond de aanwijzer: straal en diepte (px)
const SHOCK_SPEED = 300, SHOCK_LIFE = 1.1; // schokgolf bij afvinken: eenheden per s, duur (s)
const ORB_SCALE = 0.85;                 // straal t.o.v. LEVELS[].size / 2
// Kern: zeshoekig raster van puntjes (stage-eenheden), straal groeit van rustig naar dringend.
// Op een klein scherm wordt het raster grover (min. CORE_MIN_PX tussen de puntjes), anders vervloeit het tot een vlek.
const TWINKLE_LIFE = 1.1;   // afvinken: duur van het uitfonkelen (s)
const CORE_RMIN = 15, CORE_RMAX = 25, CORE_SPACING = 3.1, CORE_MIN_PX = 5;   // 15 % groter sinds de oogjes
const coreGrids = new Map();
function coreGrid(spacing) {
  const key = spacing.toFixed(2);
  if (!coreGrids.has(key)) {
    const pts = [], n = Math.ceil((CORE_RMAX + 6) / spacing);
    for (let row = -n; row <= n; row++) for (let col = -n; col <= n; col++) {
      const x = (col + (row & 1) * 0.5) * spacing, y = row * spacing * 0.866, r = Math.hypot(x, y);
      if (r <= CORE_RMAX + 6) pts.push({ x, y, r });
    }
    coreGrids.set(key, pts);
  }
  return coreGrids.get(key);
}
const GRID_ALPHA = 0.18, GRID_MAX = 3600;   // 0,13 was op sommige schermen amper zichtbaar
const EDGE = 180;   // net buiten de buitenste ring (Ooit, 174): rand van de scène voor tekst ernaast
const ARRIVE_R = 320;

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

export function createScene(canvas, { onHover = () => {}, onReassign = () => {}, onView = () => {}, onCore = () => {}, reducedMotion }) {
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
  const orbs = new Map();
  const twinkles = [];   // afgevinkte bollen die uitfonkelen
  let sky = [];          // sterrenhemel: één ster per afgevinkte taak
  const skyBorn = new Map();   // id → tijdstip waarop een nieuwe ster verscheen (licht even op)
  // eye candy: raster buigt naar de aanwijzer, schokgolf door de ringen bij afvinken, af en toe een vallende ster,
  // sterrenbeeld bij elke 25e ster
  const bend = { k: 0, x: 0, y: 0 };
  const shocks = [];                         // tijdstippen (ms) van een schokgolf
  let meteor = null, nextMeteor = performance.now() + (90 + Math.random() * 150) * 1000;
  let constellation = null;                  // {edges: [[x1,y1,x2,y2]...], t0}
  let skyKnown = null;
  let hover = { orb: null, level: null }, external = { task: null, level: null }, pinned = null;
  let drag = null, dropLevel = null;
  // urgentie van de kern: 0 = rustig, 1 = alleen vandaag, tot 2 = veel Nu-taken
  let nowCount = 0, todayCount = 0, urgency = 0, beat = 0;
  let theme = THEMES.light;
  let INK = theme.ink, PAPER = theme.paper;
  const coreColor = [...theme.calm];
  let introStart = performance.now(), last = performance.now();
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
        const inner = 0.25 + 0.75 * smoothstep(30, 210, r);
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
    cam.s = Math.min(availW, H) / FIT;
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
    centerTarget = { x: insets.left + (W - insets.left - insets.right) / 2, y: H / 2 };
    if (force && !centerReady) { center = { ...centerTarget }; centerReady = true; }
  }
  new ResizeObserver(resize).observe(canvas);
  resize(); // camera meteen geldig, ook als de muis al beweegt voor de eerste meting

  /* ---- Taken ---- */
  function layoutOffsets() {
    for (const lv of LEVELS) {
      const own = [...orbs.values()].filter(o => !o.leaving && o.level === lv.id).sort((a, b) => a.createdAt - b.createdAt);
      own.forEach((o, i) => { o.targetOffset = TAU * i / own.length; });
    }
  }

  function setTasks(list, { intro = false } = {}) {
    const ids = new Set(list.map(t => t.id));
    for (const o of orbs.values()) if (!ids.has(o.id)) o.leaving = true;
    let i = 0;
    for (const task of list) {
      let o = orbs.get(task.id);
      if (!o || o.leaving) {
        o = {
          id: task.id, level: task.level, createdAt: task.createdAt, title: task.title,
          r: reducedMotion.matches ? LEVEL_BY_ID.get(task.level).orbit : ARRIVE_R,
          alpha: reducedMotion.matches ? 1 : 0, offset: 0, targetOffset: 0, fresh: true,
          wait: intro && !reducedMotion.matches ? 0.55 + i * 0.07 : 0,
          sx: null, sy: null, sr: 0, blend: null,
        };
        orbs.set(task.id, o);
        i++;
      } else if (o.level !== task.level) {
        // absolute hoek behouden bij een niveauwissel, daarna zacht herschikken
        const a = phase.get(o.level) + o.offset;
        o.offset = a - phase.get(task.level);
        o.level = task.level;
      }
      o.title = task.title;
      o.due = task.due || null;
      o.late = Boolean(o.due) && isOverdue(o.due);
    }
    layoutOffsets();
    for (const o of orbs.values()) if (o.fresh) { o.offset = o.targetOffset; o.fresh = false; }
    nowCount = list.filter(t => t.level === URGENT_LEVEL).length;
    todayCount = list.filter(t => t.level === URGENT_LEVEL + 1).length;
  }

  // Geeft de plek terug (stage-eenheden rond het midden van het scherm) voor de sterrenhemel, of null
  function complete(id) {
    const o = orbs.get(id);
    if (!o) return null;
    orbs.delete(id);
    layoutOffsets();
    const spot = o.sx == null ? null : [(o.sx - cam.cx) / cam.s, (o.sy - cam.cy) / cam.s];
    if (reducedMotion.matches || o.sx == null) return spot;
    // Zilver: de bol fonkelt uit waar hij stond, als een ster (vaste plek in de trechter, draait mee met de trechter)
    const [x, y, z] = orbFunnel(o, orbAngle(o));
    twinkles.push({ level: o.level, x, y, z, age: 0, alpha: o.alpha ?? 1 });
    const now = performance.now();
    while (shocks.length && now - shocks[0] > (SHOCK_LIFE + 1) * 1000) shocks.shift();
    shocks.push(now + 250);
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
    }

    for (const o of orbs.values()) {
      if (o.wait > 0) { o.wait -= dt; continue; }
      const target = LEVEL_BY_ID.get(o.level).orbit;
      const r0 = o.r, off0 = o.offset;
      o.r = motion ? smooth(o.r, target, 2.6, dt) : target;
      o.offset += wrapAngle(o.targetOffset - o.offset) * (motion ? 1 - Math.exp(-4 * dt) : 1);
      // werkelijke snelheid (radiaal en extra hoeksnelheid) voor een staart die de echte baan volgt
      o.vr = dt > 0 ? (o.r - r0) / dt : 0;
      o.vo = dt > 0 ? wrapAngle(o.offset - off0) / dt : 0;
      o.alpha = smooth(o.alpha, o.leaving ? 0 : 1, o.leaving ? 8 : 3, dt);
      if (o.leaving && o.alpha < 0.01) orbs.delete(o.id);
      if (o.blend) { o.blend.p += dt / 0.45; if (o.blend.p >= 1) o.blend = null; }
    }

    // raster: de put volgt de aanwijzer zacht, en verdwijnt als die de scène verlaat
    bend.k = smooth(bend.k, motion && pointer.inside ? 1 : 0, 3, dt);
    if (pointer.inside) { bend.x = smooth(bend.x || pointer.x, pointer.x, 8, dt); bend.y = smooth(bend.y || pointer.y, pointer.y, 8, dt); }

    for (let i = twinkles.length - 1; i >= 0; i--) {
      twinkles[i].age += dt;
      if (twinkles[i].age > TWINKLE_LIFE) twinkles.splice(i, 1);
    }

    // kern: urgentie, kleur, tempo en aantal golven glijden mee met de taken
    const target = nowCount > 0 ? 1 + Math.min(nowCount - 1, 3) / 3 : todayCount > 0 ? 0.5 : 0;
    urgency = smooth(urgency, target, 2.5, dt);
    const goal = URGENT_RGB;   // de kern is altijd rood (Nu); urgentie zit in grootte en golf, niet in kleur
    for (let i = 0; i < 3; i++) coreColor[i] = smooth(coreColor[i], goal[i], 3, dt);
    if (motion && urgency > 0.01) beat += dt / beatPeriod() * beatScale;
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
  function drawSky(now) {
    if (!sky.length) return;
    const a = introAlpha(now, 0.3, 1.2);
    if (a <= 0) return;
    const t = now / 1000, still = reducedMotion.matches;
    ctx.fillStyle = rgba(INK, 1);
    const dense = clamp(1 - (sky.length - 150) / 1500, 0.65, 1);   // een volle hemel krijgt iets kleinere sterren
    for (const st of sky) {
      const tw = still ? 0.8 : 0.55 + 0.45 * Math.sin(t * 0.9 + st.ph);
      const x = cam.cx + st.x * cam.s, y = cam.cy + st.y * cam.s;
      // nooit kleiner dan een paar pixels: op een gsm verdwenen ze anders
      let R = Math.max(2.6 * st.s * cam.du, 2.4 + st.s) * dense, alpha = 0.36 + 0.44 * tw;
      // een nieuwe ster verschijnt na het uitfonkelen groot en helder, en zakt in 2,4 s naar haar plek
      const born = skyBorn.get(st.id);
      if (born !== undefined) {
        const p = (now - born) / 1000 - TWINKLE_LIFE * 0.6;
        if (p > 2.4) skyBorn.delete(st.id);
        else if (p < 0) continue;
        else { const k = 1 - ease(p / 2.4); R *= 1 + 1.6 * k; alpha = Math.min(1, alpha + 0.6 * k); }
      }
      ctx.globalAlpha = a * alpha;
      star4(x, y, R, 0);
    }
    ctx.globalAlpha = 1;
  }

  // Vallende ster: heel af en toe (eerst na 1,5 tot 4 min, daarna om de 6 tot 14 min) een dunne streep over de hemel
  function drawMeteor(now) {
    if (reducedMotion.matches) return;
    if (!meteor && now >= nextMeteor) {
      const ang = (0.2 + Math.random() * 0.35) * (Math.random() < 0.5 ? 1 : -1) + (Math.random() < 0.5 ? 0 : Math.PI);
      const dir = [Math.cos(ang), Math.abs(Math.sin(ang))];               // altijd een beetje naar beneden
      meteor = { t0: now, x: W * (0.15 + Math.random() * 0.7), y: H * (0.08 + Math.random() * 0.35), dx: dir[0], dy: dir[1], dist: Math.min(W, H) * (0.35 + Math.random() * 0.2) };
      nextMeteor = now + (360 + Math.random() * 480) * 1000;
    }
    if (!meteor) return;
    const p = (now - meteor.t0) / 900;
    if (p >= 1) { meteor = null; return; }
    const head = ease(p) * meteor.dist, len = Math.min(head, 150 * cam.du + 40);
    const hx = meteor.x + meteor.dx * head, hy = meteor.y + meteor.dy * head;
    const tx = hx - meteor.dx * len, ty = hy - meteor.dy * len;
    const a = Math.sin(p * Math.PI) * 0.55;
    const g = ctx.createLinearGradient(hx, hy, tx, ty);
    g.addColorStop(0, rgba(INK, a));
    g.addColorStop(1, rgba(INK, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
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
      edges.push([pts[best[0]].x, pts[best[0]].y, pts[best[1]].x, pts[best[1]].y]);
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
    constellation.edges.forEach(([x1, y1, x2, y2], i) => {
      // lijntjes verschijnen na elkaar en groeien van de ene ster naar de andere
      const p = clamp((e / IN) * n - i, 0, 1);
      if (p <= 0) return;
      const ax = cam.cx + x1 * cam.s, ay = cam.cy + y1 * cam.s, bx = cam.cx + x2 * cam.s, by = cam.cy + y2 * cam.s;
      ctx.moveTo(ax, ay); ctx.lineTo(ax + (bx - ax) * p, ay + (by - ay) * p);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawRings(now) {
    const maxHot = Math.max(...ringHot.values());
    rings.forEach((ring, idx) => {
      const lv = ring.lv;
      const hot = ringHot.get(lv.id);
      const base = lv.id === URGENT_LEVEL ? CORE_RING_ALPHA : RING_ALPHA;
      const intro = introAlpha(now, 0.15 + idx * 0.12, 0.8);
      const alpha = clamp(base * (1 - 0.32 * maxHot * (1 - hot)) + 0.5 * hot, 0, 1) * intro;
      const z = ring.z * cam.depth;
      // schokgolf na afvinken: de ring schuift een fractie naar buiten als de golf langskomt en veert terug
      let push = 1;
      for (const t0 of shocks) {
        const e = (now - t0) / 1000;
        if (e < 0 || e > SHOCK_LIFE) continue;
        push += 3.2 * Math.exp(-(((lv.ring - e * SHOCK_SPEED) / 20) ** 2)) * (1 - e / SHOCK_LIFE) / lv.ring;
      }
      // stippen
      ctx.fillStyle = rgba(hot > 0.02 ? mixInk(colors.get(lv.id), hot) : INK, 1);
      // In het zijaanzicht worden de ringen platte ellipsen die elkaar kruisen. Twee ingrepen houden het rustig:
      // elke tweede stip vervaagt, en de achterkant van elke ring (van je af) krijgt minder dekking dan de voorkant.
      const r = (1 + 0.35 * hot) * cam.du;
      const cue = cam.depth * (1 - hot);
      const buckets = new Map();
      for (let i = 0, j = 0; i < ring.pts.length; i += 2, j++) {
        const x = ring.pts[i] * push, y = ring.pts[i + 1] * push;
        const front = (x * cam.ss + y * cam.cs) / lv.ring / push;          // 1 = dichtst bij de kijker, -1 = achteraan
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
    const intro = introAlpha(now, 0, 1.1);
    if (intro <= 0) return;
    const z = TIP_Z * cam.depth;
    const strength = Math.min(1, urgency / 2) * 0.6 + Math.min(1, urgency) * 0.4;   // 0..1
    const still = reducedMotion.matches;
    const live = Math.min(1, urgency / 0.3);                // 0 = rustig, 1 = Vandaag of Nu
    const rMax = CORE_RMIN + (CORE_RMAX - CORE_RMIN) * strength * live + 4 * live;
    const p = ((beat % 1) + 1) % 1;
    const front = p * (rMax + 8);   // golf rolt van het midden tot net buiten het raster
    const rippleAmp = still ? 0 : (0.5 + 0.9 * strength) * (1 - p * 0.6) * live * waveVis * beatScale;
    const breatheAmp = still ? 0 : 0.12 * (1 - live) * waveVis;
    const t = now / 1000;
    const spacing = Math.max(CORE_SPACING, Math.round(CORE_MIN_PX / cam.s / 0.25) * 0.25);
    const grow = spacing / CORE_SPACING;                     // grover raster, grotere puntjes
    const eyes = faceState(now, rMax, spacing, z);
    coreHit = project(0, 0, z, false) ? { x: pt.x, y: pt.y, r: Math.max(22, (rMax + 4) * cam.s * pt.f) } : null;
    // Ogen "Inktpil" (P1): puntjes in twee rechtopstaande pillen kleuren van rood naar inkt. In vier stappen
    // gebundeld, zodat het één pad per tint blijft.
    const paths = [[], [], [], []];
    for (const d of coreGrid(spacing)) {
      if (d.r > rMax) continue;
      const base = 0.25 + 1.05 * Math.pow(1 - d.r / rMax, 0.7);
      const bump = rippleAmp ? Math.exp(-(((d.r - front) / (3.2 * grow)) ** 2)) * rippleAmp : 0;
      const breathe = breatheAmp ? breatheAmp * Math.sin(t * 1.3 - d.r * 0.25) : 0;
      const size = base + bump + breathe;
      if (size < 0.25 || !project(d.x, d.y, z, false)) continue;
      paths[Math.round(eyes.ink(d.x, d.y) * 3)].push(pt.x, pt.y, size * grow * cam.s * pt.f);
    }
    paths.forEach((list, i) => {
      if (!list.length) return;
      ctx.fillStyle = rgba(mixInk(coreColor, 1 - i / 3), intro);
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
    const happy = performance.now() < face.happyUntil;
    const h = Math.max(rMax * 0.25, spacing * 0.95);
    const gap = Math.max(rMax * 0.36, h * 1.3), ey = -rMax * 0.12;
    const soft = spacing * 0.55, o = Math.max(0.12, open);
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

  function orbAngle(o) { return phase.get(o.level) + o.offset; }

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
    ctx.globalAlpha = o.alpha;
    // heel zachte gloed rond de kop (op vraag van Victor): een radiaal verloop van de eigen kleur naar niets,
    // in het donker iets sterker. Geen schaduwfilter: dat is traag op gsm.
    {
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
      const length = (lv.tail + 1) * TAIL_GAP * TAIL_LENGTH * Math.min(2.5, v / cruise);
      if (v > 0.01 && length > 0.5) {
        const n = tracePath(o, it, it.a, omega, vr, length / v, TRAIL_STEPS);
        if (n > 1) {
          const c = colors.get(o.level);
          const fade = ctx.createLinearGradient(trailPts[0], trailPts[1], trailPts[2 * n - 2], trailPts[2 * n - 1]);
          fade.addColorStop(0, rgba(c, 0.95));
          fade.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = fade;
          taper(it.r * 2, it.r * 0.35);
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
    const list = [...orbs.values()].filter(o => o.wait <= 0 && o.alpha > 0.01);
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

  // Uitfonkelen ("Zilver", gekozen door Victor): een vierpuntige ster met holle zijden in de inktkleur zwelt op,
  // draait een kwartslag en krimpt tot niets; de bol zelf blijft als gekleurde kern in het midden en dooft mee.
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

  function drawEffects() {
    for (const q of twinkles) {
      if (!project(q.x, q.y, q.z, true)) continue;
      const lv = LEVEL_BY_ID.get(q.level);
      const p = Math.min(1, q.age / TWINKLE_LIFE);
      const r = lv.size / 2 * ORB_SCALE * cam.du * pt.f;
      const grow = p < 0.3 ? ease(p / 0.3) : 1 - Math.pow((p - 0.3) / 0.7, 2.2);
      const shrink = p < 0.3 ? 1 : 1 - Math.pow((p - 0.3) / 0.7, 2.2) * 0.9;
      const R = (r * 1.4 + 11 * cam.du * pt.f * grow) * shrink;
      ctx.globalAlpha = q.alpha;
      ctx.fillStyle = rgba(INK, 0.9);
      if (R > 0.3) star4(pt.x, pt.y, R, Math.PI / 2 * p);
      ctx.fillStyle = rgba(colors.get(q.level), 1);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, Math.max(0, r * 0.8 * (1 - p)), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /* Labels: witte pil, zoals in het wiel */
  function pill(text, x, y, align, color, opts = {}) {
    ctx.font = opts.mono ? '500 10.5px "Geist Mono", ui-monospace, monospace' : '500 12.5px Geist, system-ui, sans-serif';
    let label = text;
    const maxW = 220;
    while (ctx.measureText(label).width > maxW && label.length > 4) label = label.slice(0, -2);
    if (label !== text) label = label.trimEnd() + '…';
    const tw = ctx.measureText(label).width;
    const padX = 10, h = 26, dot = color ? 12 : 0;
    const w = tw + padX * 2 + dot;
    let left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    left = clamp(left, 8, W - w - 8);
    const top = clamp(y - h / 2, 8, H - h - 8);
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
    ctx.textBaseline = 'middle';
    ctx.fillText(label, left + padX + dot, top + h / 2 + 0.5);
  }

  function drawLabels() {
    if (drag?.type === 'orb' && drag.active) {
      if (dropLevel) ringLabel(dropLevel, true);
      return;
    }
    const hot = hotLevel();
    let shown = [];
    const single = hover.orb ?? external.task ?? pinned;
    if (single && orbs.has(single)) shown = [orbs.get(single)];
    else if (hot) shown = [...orbs.values()].filter(o => o.level === hot && !o.leaving);
    if (hot) ringLabel(hot, false);
    for (const o of shown) {
      if (o.sx == null) continue;
      let dx = o.sx - cam.cx, dy = o.sy - cam.cy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      const gap = o.sr + 14;
      const ax = o.sx + dx * gap, ay = o.sy + dy * gap;
      ctx.strokeStyle = theme.leader;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(o.sx + dx * (o.sr + 3), o.sy + dy * (o.sr + 3));
      ctx.lineTo(ax, ay);
      ctx.stroke();
      pill(o.due ? `${o.title} · ${dueLabel(o.due)}` : o.title, ax + (dx >= 0 ? 2 : -2), ay, dx >= 0 ? 'left' : 'right', colors.get(o.level));
    }
  }

  function ringLabel(level, isDrop) {
    const lv = LEVEL_BY_ID.get(level);
    const count = [...orbs.values()].filter(o => o.level === level && !o.leaving).length;
    if (!project(0, -lv.ring, depthAt(lv.ring) * cam.depth, false)) return;
    const text = isDrop ? tx('scene.drop', { level: lv.name.toLowerCase() }) : `${lv.name.toUpperCase()} · ${count}`;
    pill(text, pt.x, pt.y - 16, 'center', null, { mono: !isDrop });
  }

  function draw(now) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    updateCamera();
    drawGrid(now);
    drawSky(now);
    drawConstellation(now);
    drawMeteor(now);
    drawRings(now);
    drawCore(now);
    drawOrbs();
    drawEffects();
    drawLabels();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt, now);
    draw(now);
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

  const onCoreSpot = p => coreHit && Math.hypot(p.x - coreHit.x, p.y - coreHit.y) < coreHit.r;

  function setHover(next) {
    if (next.orb === hover.orb && next.level === hover.level) return;
    hover = next;
    onHover(hover.orb, hover.level);
  }

  canvas.addEventListener('pointermove', e => {
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
        o.blend = { x: pointer.x, y: pointer.y, p: 0 };
        if (!cancelled && dropLevel && dropLevel !== o.level) onReassign(d.id, dropLevel);
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
      pinned = null;
      if (e?.pointerType !== 'mouse') setHover({ orb: null, level: null });
      if (!cancelled && e && onCoreSpot(local(e))) onCore();
    }
  }
  canvas.addEventListener('pointerup', e => endDrag(e, false));
  canvas.addEventListener('pointercancel', e => endDrag(e, true));

  requestAnimationFrame(frame);

  return {
    setTasks, complete, setView, setInsets, highlight,
    restartIntro() { introStart = performance.now(); },
    // de kern kijkt even blij (bv. bij afvinken)
    cheer(ms = 1600) { face.happyUntil = performance.now() + ms; },
    wink(ms = 650) { face.winkUntil = performance.now() + ms; },
    // sterrenbeeld van de laatste `count` sterren, na het verschijnen van de nieuwe ster
    constellation(count = 25) {
      if (reducedMotion.matches) return;
      const edges = makeConstellation(count);
      if (edges) constellation = { edges, t0: performance.now() + 2600 };
    },
    coreAt(clientX, clientY) { const r = canvas.getBoundingClientRect(); return Boolean(onCoreSpot({ x: clientX - r.left, y: clientY - r.top })); },
    // kijkdoel van de kern: [x, y] tussen -1 en 1 (bv. naar de begroeting), of null om vrij te kijken
    lookAt(goal) { face.lookGoal = goal; },
    get centerX() { return cam.cx; },
    // linkerrand van de buitenste ring (px) op schermhoogte y, zodat tekst ernaast tot aan die ring kan lopen
    edgeLeft(y) {
      if (!project(-EDGE, 0, 0, false)) return null;
      const r = cam.cx - pt.x, dy = y - cam.cy;
      return Math.abs(dy) >= r ? null : cam.cx - Math.sqrt(r * r - dy * dy);
    },
    setSky(list) {
      // wat er na de eerste keer bijkomt, is een nieuwe ster (bij het opstarten niet: dan staat de hemel er al)
      const now = performance.now();
      if (skyKnown && !reducedMotion.matches) for (const st of list) if (!skyKnown.has(st.id)) skyBorn.set(st.id, now);
      skyKnown = new Set(list.map(st => st.id));
      sky = list;
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
