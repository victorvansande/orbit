import { LEVELS, LEVEL_BY_ID, URGENT_LEVEL, RIM, TIP_Z, depthAt, rgbOf, rgba } from './config.js';
import { ORB_STYLE_BY_ID, DEFAULT_ORB_STYLE, paintOrb, halftone } from './orbs.js';

/* ---- Camera en geometrie (eenheden van de 390-stage) ---- */
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const P = 1100;                         // perspectief
const PERSP_Y = (0.38 - 0.5) * 390;     // perspective-origin op 38 %
const VIEW = { top: { tilt: 0, zoom: 0.92, shift: 0 }, side: { tilt: 58, zoom: 0.96, shift: -66 } };
const VIEW_MS = 900;
const SPIN_PERIOD = 160;
const FIT = 440;                        // zoveel stage-eenheden passen in min(breedte, hoogte)

const INK = [24, 24, 32];
const RING_GAP = 8, RING_ALPHA = 0.2, CORE_RING_ALPHA = 0.3;
const TAIL_GAP = 7, TAIL_ALPHA = 0.42, TRAIL_STEPS = 14;
const MERIDIANS = 8, MERIDIAN_GAP = 14, MERIDIAN_ALPHA = 0.12;
const GRID_ALPHA = 0.13, GRID_MAX = 3600;
const BEZEL_IN = 186, BEZEL_OUT = 191, BEZEL_MAJOR = 196;
const ARRIVE_R = 320;
const CALM = [168, 168, 178];

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

export function createScene(canvas, { onHover = () => {}, onReassign = () => {}, onView = () => {}, reducedMotion }) {
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
  const particles = [];
  const waves = [];
  let hover = { orb: null, level: null }, external = { task: null, level: null }, pinned = null;
  let drag = null, dropLevel = null;
  let nowCount = 0, nowGlow = 0;
  let introStart = performance.now(), last = performance.now();
  let pointer = { x: -1, y: -1, inside: false };

  /* ---- Kleuren en stijl ---- */
  let style = DEFAULT_ORB_STYLE;
  let capsuleVariant = 'a';
  const colors = new Map(LEVELS.map(l => [l.id, rgbOf(l.color)]));
  const URGENT_RGB = colors.get(URGENT_LEVEL);

  /* ---- Vaste geometrie ---- */
  const rings = LEVELS.map(lv => {
    const n = Math.round(TAU * lv.ring / RING_GAP);
    const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU; pts.push(Math.cos(a) * lv.ring, Math.sin(a) * lv.ring); }
    return { lv, z: depthAt(lv.ring), pts, screen: new Float32Array(2 * 48) };
  });

  const meridianSamples = (() => {
    const path = [[RIM, 0]];
    for (let r = RIM; r > 0; r -= 1) path.push([r - 1, depthAt(r - 1)]);
    const out = [];
    let acc = 0, next = 0;
    for (let i = 1; i < path.length; i++) {
      const [r0, z0] = path[i - 1], [r1, z1] = path[i];
      acc += Math.hypot(r1 - r0, z1 - z0);
      if (acc >= next) { out.push([r1, z1]); next += MERIDIAN_GAP; }
    }
    return out.filter(([r]) => r > 6);
  })();

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
    }
    layoutOffsets();
    for (const o of orbs.values()) if (o.fresh) { o.offset = o.targetOffset; o.fresh = false; }
    nowCount = list.filter(t => t.level === URGENT_LEVEL).length;
  }

  function complete(id) {
    const o = orbs.get(id);
    if (!o) return;
    orbs.delete(id);
    layoutOffsets();
    if (reducedMotion.matches || o.sx == null) return;
    const rgb = colors.get(o.level);
    for (let k = 0; k < 18; k++) {
      const a = Math.random() * TAU, v = (60 + Math.random() * 120) * cam.du;
      particles.push({ x: o.sx, y: o.sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.7 + Math.random() * 0.6, r: (1 + Math.random() * 1.4) * cam.du, c: rgb });
    }
    waves.push({ x: o.sx, y: o.sy, age: 0, c: colors.get(o.level), r0: o.sr });
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
    if (motion) spin += dt * TAU / SPIN_PERIOD;
    yaw = motion ? smooth(yaw, yawTarget, 3, dt) : 0;
    pitch = motion ? smooth(pitch, pitchTarget, 3, dt) : 0;

    const hot = hotLevel();
    for (const lv of LEVELS) {
      speed.set(lv.id, smooth(speed.get(lv.id), hot === lv.id ? 0 : 1, 5, dt));
      if (motion) phase.set(lv.id, phase.get(lv.id) + dt * TAU / lv.period * speed.get(lv.id));
      const dragging = drag?.type === 'orb' && drag.active;
      const lit = dragging ? dropLevel === lv.id : hot === lv.id;
      ringHot.set(lv.id, smooth(ringHot.get(lv.id), lit ? 1 : 0, 9, dt));
    }

    for (const o of orbs.values()) {
      if (o.wait > 0) { o.wait -= dt; continue; }
      const target = LEVEL_BY_ID.get(o.level).orbit;
      o.r = motion ? smooth(o.r, target, 2.6, dt) : target;
      o.offset += wrapAngle(o.targetOffset - o.offset) * (motion ? 1 - Math.exp(-4 * dt) : 1);
      o.alpha = smooth(o.alpha, o.leaving ? 0 : 1, o.leaving ? 8 : 3, dt);
      if (o.leaving && o.alpha < 0.01) orbs.delete(o.id);
      if (o.blend) { o.blend.p += dt / 0.45; if (o.blend.p >= 1) o.blend = null; }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life += dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= Math.exp(-2.4 * dt); q.vy *= Math.exp(-2.4 * dt);
      if (q.life >= q.max) particles.splice(i, 1);
    }
    for (let i = waves.length - 1; i >= 0; i--) { waves[i].age += dt; if (waves[i].age > 0.8) waves.splice(i, 1); }

    nowGlow = smooth(nowGlow, nowCount > 0 ? 1 : 0, 3, dt);
  }

  /* ---- Tekenen ---- */
  function introAlpha(now, delay, dur = 0.9) {
    if (reducedMotion.matches) return 1;
    return smoothstep(0, 1, ((now - introStart) / 1000 - delay) / dur);
  }

  function dotPath(list, r) {
    ctx.moveTo(list.x + r, list.y);
    ctx.arc(list.x, list.y, r, 0, TAU);
  }

  function drawGrid(now) {
    const depth = cam.depth;
    const fade = introAlpha(now, 0, 1.4) * (0.5 + 0.5 * depth);
    if (fade <= 0) return;
    const buckets = Array.from({ length: 6 }, () => []);
    for (const g of grid) {
      const z = g.r < RIM ? depthAt(g.r) * depth : 0;
      if (!project(g.x, g.y, z, false)) continue;
      const a = g.a * fade * Math.min(1, pt.f * pt.f);
      if (!(a >= 0.006)) continue;
      if (pt.x < -8 || pt.x > W + 8 || pt.y < -8 || pt.y > H + 8) continue;
      const k = Math.min(5, Math.floor(a / GRID_ALPHA * 6));
      buckets[k].push(pt.x, pt.y, 0.9 * cam.du * pt.f);
    }
    ctx.fillStyle = rgba(INK, 1);
    buckets.forEach((b, k) => {
      if (!b.length) return;
      ctx.globalAlpha = (k + 0.5) / 6 * GRID_ALPHA;
      ctx.beginPath();
      for (let i = 0; i < b.length; i += 3) { ctx.moveTo(b[i] + b[i + 2], b[i + 1]); ctx.arc(b[i], b[i + 1], b[i + 2], 0, TAU); }
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawBezel(now) {
    const a = introAlpha(now, 0.2, 1.2);
    if (a <= 0) return;
    ctx.strokeStyle = rgba(INK, 1);
    ctx.lineWidth = 1;
    for (const major of [false, true]) {
      ctx.globalAlpha = (major ? 0.32 : 0.14) * a;
      ctx.beginPath();
      for (let i = 0; i < 120; i++) {
        const isMajor = i % 10 === 0;
        if (isMajor !== major) continue;
        const ang = i / 120 * TAU;
        const c = Math.cos(ang), s = Math.sin(ang);
        if (!project(c * BEZEL_IN, s * BEZEL_IN, 0, false)) continue;
        const x0 = pt.x, y0 = pt.y;
        const out = isMajor ? BEZEL_MAJOR : BEZEL_OUT;
        if (!project(c * out, s * out, 0, false)) continue;
        ctx.moveTo(x0, y0); ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawMeridians() {
    const a = MERIDIAN_ALPHA * cam.depth;
    if (a < 0.004) return;
    ctx.fillStyle = rgba(INK, 1);
    ctx.globalAlpha = a;
    ctx.beginPath();
    for (let m = 0; m < MERIDIANS; m++) {
      const ang = m / MERIDIANS * TAU, c = Math.cos(ang), s = Math.sin(ang);
      for (const [r, z] of meridianSamples) {
        if (!project(r * c, r * s, z * cam.depth, true)) continue;
        dotPath(pt, 0.9 * cam.du * pt.f);
      }
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawRings(now) {
    const maxHot = Math.max(...ringHot.values());
    rings.forEach((ring, idx) => {
      const lv = ring.lv;
      const hot = ringHot.get(lv.id);
      const base = lv.id === URGENT_LEVEL ? CORE_RING_ALPHA : RING_ALPHA;
      const intro = introAlpha(now, 0.15 + idx * 0.12, 0.8);
      const alpha = clamp(base * (1 - 0.5 * maxHot * (1 - hot)) + 0.5 * hot, 0, 1) * intro;
      const z = ring.z * cam.depth;
      // stippen
      ctx.fillStyle = rgba(hot > 0.02 ? mixInk(colors.get(lv.id), hot) : INK, 1);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      const r = (1 + 0.35 * hot) * cam.du;
      for (let i = 0; i < ring.pts.length; i += 2) {
        if (!project(ring.pts[i], ring.pts[i + 1], z, true)) continue;
        dotPath(pt, r * pt.f);
      }
      ctx.fill();
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

  /* Kern: per stijl een eigen vorm, rood en levendig met Nu-taken, grijs en stil zonder */
  function drawCore(now) {
    if (!project(0, 0, TIP_Z * cam.depth, false)) return;
    const intro = introAlpha(now, 0, 1.1);
    if (intro <= 0) return;
    const { x, y, f } = pt;
    const u = cam.s * f;
    const n = Math.min(nowCount, 4);
    const period = 2.4 / (1 + 0.3 * Math.max(0, n - 1));
    const still = reducedMotion.matches;
    const time = now / 1000;
    const pulse = still ? 0.5 : 0.5 + 0.5 * Math.sin(time * TAU / period);
    const color = mixRgb(CALM, URGENT_RGB, nowGlow);
    const line = clamp(1.2 * cam.du * f, 1, 2.4);
    ctx.globalAlpha = intro;

    if (style === 'ring') {
      // stip die sonarringen uitzendt
      ctx.fillStyle = rgba(color, 1);
      ctx.beginPath();
      ctx.arc(x, y, 3.2 * u, 0, TAU);
      ctx.fill();
      ctx.lineWidth = line;
      if (nowGlow > 0.01) {
        for (let i = 0; i < 3; i++) {
          const p = still ? (i + 1) / 4 : ((time / (period * 1.4)) + i / 3) % 1;
          ctx.strokeStyle = rgba(URGENT_RGB, Math.pow(1 - p, 1.6) * 0.6 * nowGlow * intro);
          ctx.beginPath();
          ctx.arc(x, y, (5 + p * 30) * u, 0, TAU);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = rgba(CALM, 0.45 * (1 - nowGlow) * intro);
      ctx.beginPath();
      ctx.arc(x, y, 8 * u, 0, TAU);
      ctx.stroke();
    } else if (style === 'vlak') {
      // effen stip met een ademende ring
      ctx.fillStyle = rgba(color, 1);
      ctx.beginPath();
      ctx.arc(x, y, (5 + 0.5 * pulse * nowGlow) * u, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(color, (0.5 - 0.3 * pulse * nowGlow) * intro);
      ctx.lineWidth = line;
      ctx.beginPath();
      ctx.arc(x, y, (10 + 3 * pulse * nowGlow) * u, 0, TAU);
      ctx.stroke();
    } else if (style === 'raster') {
      // stippenbol die pulseert
      halftone(ctx, color, x, y, 13 * u, 0.75 + 0.4 * pulse * nowGlow);
    } else {
      drawCapsuleCore(x, y, u, line, color, time, period, still, intro);
    }
    ctx.globalAlpha = 1;
  }

  // Capsule-kern, vier varianten (tijdelijk, om te kiezen)
  function drawCapsuleCore(x, y, u, line, color, time, period, still, intro) {
    const R = 9 * u;
    const spin = still ? -Math.PI / 2 : time * TAU / (period * 1.2);
    const lit = nowGlow > 0.01;
    ctx.lineCap = 'round';
    const dot = r => { ctx.fillStyle = rgba(color, 1); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
    const ring = (r, w, a) => { ctx.lineWidth = w; ctx.strokeStyle = rgba(color, a * intro); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); };
    const seg = (r, w, from, len) => { ctx.lineWidth = w; ctx.strokeStyle = rgba(URGENT_RGB, nowGlow * intro); ctx.beginPath(); ctx.arc(x, y, r, from, from + len); ctx.stroke(); };
    if (capsuleVariant === 'b') {
      // dunne ring, twee segmenten die tegen elkaar in draaien
      ring(R, line, 0.25);
      if (lit) { seg(R, line * 1.4, spin, Math.PI * 0.4); seg(R * 1.45, line, -spin * 0.7, Math.PI * 0.3); }
      dot(2 * u);
    } else if (capsuleVariant === 'c') {
      // ring van streepjes die als een loader oplichten
      const n = 12;
      ctx.lineWidth = line * 1.5;
      for (let i = 0; i < n; i++) {
        const ang = i / n * TAU;
        const head = ((spin / TAU) % 1 + 1) % 1;
        const p = ((i / n - head) % 1 + 1) % 1;
        const a = lit ? 0.18 + 0.82 * Math.pow(1 - p, 3) * nowGlow : 0.3;
        ctx.strokeStyle = rgba(lit ? URGENT_RGB : color, a * intro);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(ang) * R * 0.78, y + Math.sin(ang) * R * 0.78);
        ctx.lineTo(x + Math.cos(ang) * R * 1.08, y + Math.sin(ang) * R * 1.08);
        ctx.stroke();
      }
    } else if (capsuleVariant === 'd') {
      // effen stip in een ring, een korte capsule draait er als satelliet omheen
      dot(4 * u);
      ring(R, line, 0.3);
      if (lit) seg(R * 1.5, line * 2.2, spin, Math.PI * 0.22);
    } else {
      // ring met een draaiend segment
      ring(R, line * 1.6, 0.22);
      if (lit) seg(R, line * 1.6, spin, Math.PI * 0.6);
      dot(2.4 * u);
    }
  }

  function mixRgb(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  const isHot = o => hover.orb === o.id || external.task === o.id || pinned === o.id;

  function orbAngle(o) { return phase.get(o.level) + o.offset; }

  function orbFunnel(o, a) {
    const z = o.r < RIM ? depthAt(o.r) * cam.depth : 0;
    return [Math.cos(a) * o.r, Math.sin(a) * o.r, z];
  }

  // Punten langs de baan achter een bol, op het scherm
  const trailPts = [];
  function tracePath(o, from, a, span, steps) {
    trailPts.length = 0;
    trailPts.push(from.x, from.y);
    for (let k = 1; k <= steps; k++) {
      const [x, y, z] = orbFunnel(o, a - k / steps * span);
      if (!project(x, y, z, true)) break;
      trailPts.push(pt.x, pt.y);
    }
    return trailPts.length / 2;
  }

  // Taps vlak langs trailPts met verloop naar transparant
  function taper(rgb, wHead, wTail, alpha, solid = false) {
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
    if (solid) ctx.fillStyle = rgba(rgb, alpha);
    else {
      const grad = ctx.createLinearGradient(trailPts[0], trailPts[1], trailPts[2 * n - 2], trailPts[2 * n - 1]);
      grad.addColorStop(0, rgba(rgb, alpha));
      grad.addColorStop(1, rgba(rgb, 0));
      ctx.fillStyle = grad;
    }
    ctx.beginPath();
    ctx.moveTo(left[0], left[1]);
    for (let k = 1; k < n; k++) ctx.lineTo(left[2 * k], left[2 * k + 1]);
    for (let k = n - 1; k >= 0; k--) ctx.lineTo(right[2 * k], right[2 * k + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function drawTrail(o, it, lv, sp, line) {
    const rgb = colors.get(o.level);
    const span = (lv.tail + 1) * TAIL_GAP * 1.5 * sp / o.r;
    if (style === 'raster') {
      // stippellijn die kleiner wordt
      const n = tracePath(o, it, it.a, span, 5);
      ctx.fillStyle = rgba(rgb, 1);
      for (let k = 1; k < n; k++) {
        const p = k / 5;
        ctx.globalAlpha = TAIL_ALPHA * (1 - p) * o.alpha;
        ctx.beginPath();
        ctx.arc(trailPts[2 * k], trailPts[2 * k + 1], Math.max(0.6, it.r * 0.28 * (1 - p * 0.7)), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
    tracePath(o, it, it.a, span, TRAIL_STEPS);
    if (style === 'ring') taper(rgb, line, line * 0.3, 0.55 * o.alpha);
    else taper(rgb, it.r * 1.1, it.r * 0.1, TAIL_ALPHA * o.alpha);
  }

  // Capsule: de bol rekt uit langs de baan, lengte volgt de snelheid
  function drawCapsule(o, it, lv, sp, rgb) {
    const v = capsuleVariant;
    const length = { a: 0.8, b: 1.3, c: 1.1, d: 1.5 }[v];
    const span = (lv.tail + 1) * TAIL_GAP * length * sp / o.r;
    const n = tracePath(o, it, it.a, span, 10);
    ctx.globalAlpha = o.alpha;
    ctx.fillStyle = ctx.strokeStyle = rgba(rgb, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (v === 'c') {
      // taps: volle kop, dunner naar achter, effen kleur
      taper(rgb, it.r * 2, it.r * 0.35, 1, true);
      ctx.beginPath(); ctx.arc(it.sx, it.sy, it.r, 0, TAU); ctx.fill();
    } else if (v === 'd') {
      // kop + naald: ronde kop met een fijne lijn erachter
      ctx.lineWidth = Math.max(1, it.r * 0.4);
      ctx.globalAlpha = o.alpha * 0.7;
      ctx.beginPath(); ctx.moveTo(it.sx, it.sy);
      for (let k = 1; k < n; k++) ctx.lineTo(trailPts[2 * k], trailPts[2 * k + 1]);
      ctx.stroke();
      ctx.globalAlpha = o.alpha;
      ctx.beginPath(); ctx.arc(it.sx, it.sy, it.r * 1.05, 0, TAU); ctx.fill();
    } else {
      ctx.lineWidth = it.r * (v === 'b' ? 1.2 : 2);
      ctx.beginPath(); ctx.moveTo(it.sx, it.sy);
      for (let k = 1; k < n; k++) ctx.lineTo(trailPts[2 * k], trailPts[2 * k + 1]);
      if (n < 2) ctx.lineTo(it.sx + 0.01, it.sy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawOrbs() {
    const scale = ORB_STYLE_BY_ID.get(style).scale;
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
      const r = lv.size / 2 * scale * cam.du * f * (isHot(o) ? 1.2 : 1);
      o.sx = sx; o.sy = sy; o.sr = Math.max(r, 4);
      items.push({ o, lv, a, x: sx, y: sy, sx, sy, r, f, depth });
    }
    items.sort((p, q) => p.depth - q.depth);
    for (const it of items) {
      const { o, lv } = it;
      const rgb = colors.get(o.level);
      const sp = speed.get(o.level);
      const line = clamp(1.15 * cam.du * it.f, 1, 2.2);
      const free = !(drag?.type === 'orb' && drag.id === o.id && drag.active) && !o.blend;
      if (isHot(o)) {
        ctx.strokeStyle = rgba(INK, 0.35 * o.alpha);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(it.sx, it.sy, it.r + 4, 0, TAU);
        ctx.stroke();
      }
      if (style === 'capsule' && free && sp > 0.05) { drawCapsule(o, it, lv, sp, rgb); continue; }
      if (free && sp > 0.05 && o.r > 1) drawTrail(o, it, lv, sp, line);
      paintOrb(ctx, style, rgb, it.sx, it.sy, it.r, { alpha: o.alpha, line });
    }
  }

  function drawEffects() {
    for (const q of particles) {
      const k = 1 - q.life / q.max;
      ctx.fillStyle = rgba(q.c, 0.85 * k);
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r * (0.6 + 0.4 * k), 0, TAU);
      ctx.fill();
    }
    for (const w of waves) {
      const p = w.age / 0.8;
      ctx.strokeStyle = rgba(w.c, 0.5 * (1 - p));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r0 + p * 46 * cam.du, 0, TAU);
      ctx.stroke();
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
    ctx.shadowColor = 'rgba(20,20,30,.10)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = 'rgba(252,252,251,.94)';
    ctx.beginPath();
    ctx.roundRect(left, top, w, h, h / 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(20,20,30,.08)';
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
    ctx.fillStyle = opts.mono ? rgba(color || INK, 1) : '#1b1b22';
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
      ctx.strokeStyle = 'rgba(20,20,30,.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(o.sx + dx * (o.sr + 3), o.sy + dy * (o.sr + 3));
      ctx.lineTo(ax, ay);
      ctx.stroke();
      pill(o.title, ax + (dx >= 0 ? 2 : -2), ay, dx >= 0 ? 'left' : 'right', colors.get(o.level));
    }
  }

  function ringLabel(level, isDrop) {
    const lv = LEVEL_BY_ID.get(level);
    const count = [...orbs.values()].filter(o => o.level === level && !o.leaving).length;
    if (!project(0, -lv.ring, depthAt(lv.ring) * cam.depth, false)) return;
    const text = isDrop ? `Naar ${lv.name.toLowerCase()}` : `${lv.name.toUpperCase()} · ${count}`;
    pill(text, pt.x, pt.y - 16, 'center', null, { mono: !isDrop });
  }

  function draw(now) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    updateCamera();
    drawGrid(now);
    drawBezel(now);
    drawMeridians();
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
      if (!drag.active && Math.hypot(dx, dy) > 5) drag.active = true;
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
    canvas.style.cursor = h.orb ? 'grab' : 'default';
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
    if (h.orb) drag = { type: 'orb', id: h.orb, x0: p.x, y0: p.y, active: false };
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
    }
  }
  canvas.addEventListener('pointerup', e => endDrag(e, false));
  canvas.addEventListener('pointercancel', e => endDrag(e, true));

  requestAnimationFrame(frame);

  return {
    setTasks, complete, setView, setInsets, highlight,
    setStyle(id) { if (ORB_STYLE_BY_ID.has(id)) style = id; },
    setCapsuleVariant(v) { if ('abcd'.includes(v) && v.length === 1) capsuleVariant = v; },
    restartIntro() { introStart = performance.now(); },
  };
}
