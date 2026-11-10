/* ---- Breakout in het bakje van de focusmodus ---- */
// Gekozen door Victor (08/11/2026): B4 Fosfor uit ontwerp/breakout/, "werk het ook uit met meerdere levels, highscores,
// powerups". Een oude beeldbuis zoals het Paneel: nagloeiend fosfor, scanlijnen, een rollende band, VT323. Stenen omlijnd in
// de momentkleuren (Nu bovenaan, het meest waard), al de rest in fosfor uit de kleurkiezer.
// Tien levels (daarna een nieuwe lus, iets sneller), drie levens, zes powerups in capsules, top vijf, gedeeld tussen gekoppelde toestellen.
// Niet aangeraakt: een demo speelt vanzelf (attract-modus) met de highscores ertussen; een tik start.
// Pauze pas als de muis echt ver buiten het bakje gaat (FAR), het venster verlaat of de focus dicht gaat; een paar cm
// ernaast stuurt het batje gewoon verder (Victor, 09/11/2026). Ook met de pijltjes te spelen: links en rechts sturen,
// spatie, Enter of pijl omhoog lanceert. Zachte blipjes (playBreak in sound.js), enkel tijdens het spel, niet in de demo.
// Minder beweging: één stilstaand titelscherm.

import { LEVELS as CONF } from '../core/config.js';
import { LANG } from '../core/i18n.js';
import { playBreak } from '../scene/sound.js';


const W = 325.6, H = 226.8;
const COLS = 10, GAP = 3, SIDE = 12, TOP = 30, BH = 8;
const BW = (W - SIDE * 2 - GAP * (COLS - 1)) / COLS;
const PAD_Y = H - 18, PAD_W = 46, PAD_WIDE = 72, BALL = 2.2;
const LV = CONF.map(l => l.dark);                 // donkere momentkleuren: de buis is altijd donker
const POINTS = [50, 40, 30, 20, 10];              // Nu is het meest waard
const FAR = 200;                                  // zo ver (css-px) mag de muis buiten het bakje voor het spel pauzeert
const KEY_SPEED = 300;                            // batje met de pijltjes, in eenheden van het bakje per seconde
const en = LANG === 'en';
const T = en
  ? { start: 'TAP TO START', launch: 'TAP TO LAUNCH', clear: 'LEVEL CLEAR', over: 'GAME OVER', newHi: 'NEW HIGH SCORE', pause: 'PAUSED', resume: 'TAP TO RESUME', top: 'HIGH SCORES', loop: 'LOOP', empty: 'NO SCORES YET', again: 'TAP TO PLAY AGAIN', bonus: 'BONUS' }
  : { start: 'TIK OM TE STARTEN', launch: 'TIK OM TE LANCEREN', clear: 'LEVEL VOLTOOID', over: 'GAME OVER', newHi: 'NIEUWE HIGHSCORE', pause: 'PAUZE', resume: 'TIK OM VERDER TE SPELEN', top: 'HIGHSCORES', loop: 'LUS', empty: 'NOG GEEN SCORES', again: 'TIK OM OPNIEUW TE SPELEN', bonus: 'BONUS' };
const MONTHS = en ? ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] : ['JAN', 'FEB', 'MRT', 'APR', 'MEI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];

// Levels: tien kolommen. 1 tot 5 = moment (Nu tot Ooit), H = hard (twee tikken), X = staal (onbreekbaar), . = leeg.
const MAPS = [
  { nl: 'OPSTART', en: 'BOOT', rows: ['1111111111', '2222222222', '3333333333', '4444444444', '5555555555'] },
  { nl: 'RASTER', en: 'GRID', rows: ['1.1.1.1.1.', '.2.2.2.2.2', '3.3.3.3.3.', '.4.4.4.4.4', '5.5.5.5.5.'] },
  { nl: 'KERN', en: 'CORE', rows: ['...5555...', '..544445..', '.54333345.', '.54311345.', '.54333345.', '..544445..', '...5555...'] },
  { nl: 'MUUR', en: 'WALL', rows: ['HHHHHHHHHH', '1111111111', 'XX.XXXX.XX', '3333333333', '4444444444'] },
  { nl: 'TRECHTER', en: 'FUNNEL', rows: ['1........1', '22......22', '333....333', '4444..4444', '5555555555'] },
  { nl: 'ZANDLOPER', en: 'HOURGLASS', rows: ['5555555555', '.44444444.', '..333333..', '...2HH2...', '..333333..', '.44444444.', '5555555555'] },
  { nl: 'BANEN', en: 'ORBITS', rows: ['H.H.H.H.H.', '1111111111', '.X.X..X.X.', '3333333333', '4H4H4H4H4H'] },
  { nl: 'STER', en: 'STAR', rows: ['....11....', '....22....', '...3333...', '5544HH4455', '...3333...', '....22....', '....11....'] },
  { nl: 'KOOI', en: 'CAGE', rows: ['XXXX..XXXX', 'X12344321X', 'XHHHHHHHHX', 'X33333333X', 'XXX....XXX'] },
  { nl: 'FINALE', en: 'FINALE', rows: ['HHHHHHHHHH', '1H1H1H1H1H', '2222222222', 'X3X3X3X3X3', '4444444444', '5555555555'] },
];

// Powerups: letter in de capsule, gewicht (kans), duur in seconden (0 = meteen).
const POWERS = [
  { id: 'wide', ch: en ? 'W' : 'B', w: 3, dur: 14 },
  { id: 'multi', ch: 'M', w: 3, dur: 0 },
  { id: 'slow', ch: en ? 'S' : 'T', w: 2, dur: 12 },
  { id: 'laser', ch: 'L', w: 2, dur: 12 },
  { id: 'catch', ch: en ? 'C' : 'V', w: 2, dur: 15 },
  { id: 'life', ch: '+', w: 1, dur: 0 },
];
const POWER_SUM = POWERS.reduce((a, p) => a + p.w, 0);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const pad = (n, k) => String(Math.max(0, Math.floor(n))).padStart(k, '0');
const FONT = s => `${s}px VT323, "Geist Mono", ui-monospace, monospace`;
// fosfor uit de kleurkiezer, zoals het Paneel; zonder keuze amber
function phosphor(hex) {
  if (!hex) return { hi: [255, 217, 166], mid: [255, 138, 61], lo: [150, 70, 28], bg: [6, 5, 4] };
  const c = hexRgb(hex);
  return { hi: mix(c, [255, 248, 232], 0.55), mid: c, lo: mix(c, [0, 0, 0], 0.45), bg: mix([6, 6, 8], c, 0.03) };
}

// scores: { load, save } uit src/data/scores.js (via het bakje), gedeeld tussen gekoppelde toestellen
// zoom: groter bakje = zelfde levels, groter getekend (de opbouw is op één maat ontworpen)
export function createBreakout({ reducedMotion, accent, scores, run, zoom = 1 }) {
  const loadTop = () => (scores?.load()?.top || []).slice(0, 5);
  let cv = null, g = null, tube = null, tg = null, bloom = null, bg = null, pat = null, dpr = 1, lastNow = 0, t = 0;
  let P = phosphor(null), lastAccent;
  let top = loadTop();

  // spel
  let state = 'attract', stateAt = 0, demo = true;
  let level = 0, loop = 0, score = 0, lives = 3, bricks = [], balls = [], caps = [], beams = [], flashes = [];
  let padX = W / 2, padW = PAD_W, target = W / 2, lastInput = -99, rallyBoost = 0, laserAt = 0;
  const power = { wide: 0, slow: 0, laser: 0, catch: 0 };       // tot wanneer (t) actief
  let newRank = -1, attractLevel = 0;

  const keys = { left: false, right: false };
  const sx = x => x / W * 2 - 1;                 // plaats in het bakje naar links-rechts voor het geluid
  const sound = (kind, o) => { if (!demo) playBreak(kind, o); };

  const speed = () => (165 + 8 * Math.min(level, 9) + 25 * loop + rallyBoost) * (power.slow > t ? 0.7 : 1);

  function build(i) {
    bricks = [];
    const map = MAPS[i % MAPS.length];
    map.rows.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      const steel = ch === 'X', hard = ch === 'H';
      const lv = hard ? 0 : steel ? -1 : Number(ch) - 1;
      bricks.push({ x: SIDE + c * (BW + GAP), y: TOP + r * (BH + GAP), lv, hp: steel ? Infinity : hard ? 2 : 1, max: hard ? 2 : 1, steel, hit: -9, born: t + (r * COLS + c) * 0.008 });
    }));
    caps = []; beams = [];
  }
  function serveBall() { balls = [{ x: padX, y: PAD_Y - BALL - 1, vx: 0, vy: 0, stuck: 0, stuckAt: t }]; }
  function resetPowers() { for (const k in power) power[k] = 0; }
  function setState(s) { state = s; stateAt = t; }

  function startAttract() {
    demo = true; level = attractLevel % MAPS.length; loop = 0; score = 0; lives = 3; rallyBoost = 0;
    resetPowers(); build(level); serveBall(); setState('attract');
  }
  function startGame() {
    demo = false; level = 0; loop = 0; score = 0; lives = 3; rallyBoost = 0; newRank = -1;
    resetPowers(); build(0); serveBall(); setState('intro');
    saveRun();
  }

  // Voortgang van een lopend spel (Victor, 10/11/2026: "Ik zat aan level 3 van breakout en ik draaide even mijn gsm en mijn
  // voortgang was al gereset"). Bewaard via run (src/data/scores.js, breakoutRun): bij elk nieuw level, elk verloren leven,
  // pauze, wegleggen en een verborgen tabblad; gewist bij game over. Een nieuw opgebouwd bakje (draaien, andere maat,
  // herladen) zet het spel gepauzeerd terug, met de stenen zoals ze waren; een tik speelt verder.
  const RUN_STATES = new Set(['intro', 'serve', 'play', 'pause', 'clear']);
  function saveRun() {
    if (!run || demo || !RUN_STATES.has(state)) return;
    run.save({ run: { v: 1, level, loop, score, lives, hp: bricks.map(b => (b.steel ? -1 : b.hp)) }, at: Date.now() });
  }
  function clearRun() { run?.save({ run: null, at: Date.now() }); }
  function restoreRun() {
    let r = null;
    try { r = run?.load()?.run; } catch { r = null; }
    if (!r || r.v !== 1 || !Number.isInteger(r.level) || !Array.isArray(r.hp)) return false;
    const lv = clamp(r.level, 0, MAPS.length - 1);
    build(lv);
    if (r.hp.length !== bricks.length) return false;
    bricks.forEach((b, i) => { if (!b.steel) b.hp = clamp(Number(r.hp[i]) || 0, 0, b.max); b.born = -9; });
    if (!bricks.some(b => b.hp > 0 && !b.steel)) return false;
    demo = false; level = lv; loop = Math.max(0, Number(r.loop) | 0); score = Math.max(0, Number(r.score) || 0);
    lives = clamp(Number(r.lives) | 0, 1, 5); rallyBoost = 0; newRank = -1;
    resetPowers(); serveBall(); setState('pause');
    return true;
  }
  function endGame() {
    newRank = -1;
    if (score > 0) {
      const entry = { s: score, lv: level + 1 + loop * MAPS.length, at: Date.now() };
      const list = [...top, entry].sort((a, b) => b.s - a.s).slice(0, 5);
      newRank = list.indexOf(entry);
      top = list; scores?.save({ top });
    }
    setState('over');
    clearRun();
    sound('over');
  }

  function launch() {
    for (const b of balls) {
      if (b.vx || b.vy) { if (b.stuck) { b.stuck = 0; const a = clamp((b.x - padX) / (padW / 2), -1, 1) * 1.0; b.vx = Math.sin(a) * speed(); b.vy = -Math.cos(a) * speed(); } continue; }
      const a = (Math.random() - 0.5) * 0.8; b.vx = Math.sin(a) * speed(); b.vy = -Math.cos(a) * speed();
    }
    if (state === 'serve' || state === 'intro') setState('play');
  }

  function grant(p) {
    if (demo === false) score += 25;
    sound('power', { x: sx(padX) });
    if (p.id === 'life') { lives = Math.min(5, lives + 1); return; }
    if (p.id === 'multi') {
      const src = balls.find(b => !b.stuck && (b.vx || b.vy)) || balls[0];
      if (!src) return;
      const sp = Math.hypot(src.vx, src.vy) || speed(), a0 = Math.atan2(src.vx, -src.vy) || 0;
      for (const d of [-0.4, 0.4]) if (balls.length < 6) balls.push({ x: src.x, y: src.y, vx: Math.sin(a0 + d) * sp, vy: -Math.cos(a0 + d) * sp, stuck: 0 });
      return;
    }
    power[p.id] = t + p.dur;
  }

  function hitBrick(br) {
    br.hit = t;
    const x = sx(br.x + BW / 2);
    if (br.steel) { sound('steel', { x }); return; }
    br.hp--;
    if (br.hp > 0) { sound('hard', { x }); return; }
    sound('brick', { lv: 5 - Math.round((br.y - TOP) / (BH + GAP)), x });
    flashes.push({ x: br.x, y: br.y, w: BW, h: BH, at: t });
    if (!demo) score += POINTS[br.lv] * (1 + loop) + (br.max > 1 ? 10 : 0);
    if (Math.random() < 0.14 && caps.length < 3) {
      let r = Math.random() * POWER_SUM, p = POWERS[0];
      for (const q of POWERS) { r -= q.w; if (r <= 0) { p = q; break; } }
      caps.push({ x: br.x + BW / 2, y: br.y + BH / 2, p });
    }
  }

  // botsing van een bal met de stenen (één steen per deelstap)
  function collide(b, px, py) {
    for (const br of bricks) {
      if (br.hp <= 0) continue;
      const cx = clamp(b.x, br.x, br.x + BW), cy = clamp(b.y, br.y, br.y + BH);
      if ((b.x - cx) ** 2 + (b.y - cy) ** 2 > BALL * BALL) continue;
      if (py + BALL <= br.y || py - BALL >= br.y + BH) b.vy = -b.vy; else b.vx = -b.vx;
      b.x = px; b.y = py;
      hitBrick(br);
      return;
    }
  }

  function step(dt) {
    t += dt;
    const playing = state === 'play' || state === 'serve' || state === 'intro' || state === 'attract';
    if (!playing) return;
    // batje: volgt de aanwijzer, in de demo de bal
    if (demo) {
      const live = balls.filter(b => b.vy > 0).sort((a, b) => b.y - a.y)[0] || balls[0];
      const cap = caps.find(c => c.y > H * 0.55);
      target = live ? live.x + Math.sin(t * 0.9) * padW * 0.28 : W / 2;
      if (cap && (!live || live.y < H * 0.5)) target = cap.x;
    }
    if (!demo && keys.left !== keys.right) { target = clamp(target + (keys.right ? 1 : -1) * KEY_SPEED * dt, padW / 2 + 3, W - padW / 2 - 3); lastInput = t; }
    padW += ((power.wide > t ? PAD_WIDE : PAD_W) - padW) * Math.min(1, dt * 8);
    padX += (target - padX) * Math.min(1, dt * (demo ? 9 : 22));
    padX = clamp(padX, padW / 2 + 3, W - padW / 2 - 3);

    // de demo lanceert zelf; in het spel na een tik
    if (state === 'attract' && balls.every(b => !b.vx && !b.vy) && t - stateAt > 1.2) launch();
    for (const b of balls) if (b.stuck && (demo || t - b.stuckAt > 2.5)) { b.stuckAt = t; launchStuck(b); }

    const v = speed();
    for (const b of balls) {
      if (!b.vx && !b.vy) { b.x = padX; b.y = PAD_Y - BALL - 1; continue; }
      if (b.stuck) { b.x = padX + b.stuck; b.y = PAD_Y - BALL - 1; continue; }
      const n = Math.ceil(v * dt / 2.4), h = dt / n;
      for (let k = 0; k < n; k++) {
        const px = b.x, py = b.y;
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.x < BALL) { b.x = BALL; b.vx = Math.abs(b.vx); }
        if (b.x > W - BALL) { b.x = W - BALL; b.vx = -Math.abs(b.vx); }
        if (b.y < BALL + 22) { b.y = BALL + 22; b.vy = Math.abs(b.vy); }   // onder de regel met de score
        if (b.vy > 0 && b.y + BALL >= PAD_Y && py + BALL <= PAD_Y + 1.5 && Math.abs(b.x - padX) <= padW / 2 + BALL) {
          const off = clamp((b.x - padX) / (padW / 2), -1, 1), a = off * 1.05;
          b.y = PAD_Y - BALL;
          rallyBoost = Math.min(40, rallyBoost + 1.5);
          sound('paddle', { x: sx(b.x) });
          if (power.catch > t) { b.stuck = (b.x - padX) || 0.01; b.stuckAt = t; b.vx = 0.001; b.vy = -0.001; break; }
          b.vx = Math.sin(a) * v; b.vy = -Math.cos(a) * v;
        }
        collide(b, px, py);
      }
      // vaste snelheid, en nooit (bijna) horizontaal blijven stuiteren
      const s = Math.hypot(b.vx, b.vy) || 1;
      if (!b.stuck) {
        b.vx *= v / s; b.vy *= v / s;
        if (Math.abs(b.vy) < v * 0.28) { b.vy = Math.sign(b.vy || -1) * v * 0.28; b.vx = Math.sign(b.vx) * Math.sqrt(v * v - b.vy * b.vy); }
      }
    }
    balls = balls.filter(b => b.y < H + 8);

    // laser: twee stralen om de 0,32 s
    if (power.laser > t && (state === 'play' || state === 'attract') && t - laserAt > 0.32) {
      laserAt = t;
      beams.push({ x: padX - padW / 2 + 3, y: PAD_Y - 2 }, { x: padX + padW / 2 - 3, y: PAD_Y - 2 });
    }
    for (const bm of beams) {
      bm.y -= 320 * dt;
      for (const br of bricks) if (br.hp > 0 && bm.x >= br.x && bm.x <= br.x + BW && bm.y <= br.y + BH && bm.y >= br.y - 6) { hitBrick(br); bm.y = -99; break; }
    }
    beams = beams.filter(bm => bm.y > 22);

    // capsules vallen; vangen met het batje
    for (const c of caps) {
      c.y += 52 * dt;
      if (c.y + 4 >= PAD_Y && c.y - 4 <= PAD_Y + 3 && Math.abs(c.x - padX) <= padW / 2 + 8) { grant(c.p); c.y = H + 99; }
    }
    caps = caps.filter(c => c.y < H + 10);
    flashes = flashes.filter(f => t - f.at < 0.3);

    // bal kwijt
    if (!balls.length) {
      if (demo) { serveBall(); stateAt = t; resetPowers(); }
      else {
        lives--; resetPowers(); rallyBoost = 0; caps = []; beams = [];
        if (lives <= 0) { endGame(); return; }
        sound('life', { x: 0 });
        serveBall(); setState('serve');
        saveRun();
      }
    }
    // level leeg
    if (!bricks.some(b => b.hp > 0 && !b.steel)) {
      if (demo) { attractLevel++; level = attractLevel % MAPS.length; build(level); serveBall(); stateAt = t; resetPowers(); }
      else { score += 250 * (level + 1) * (1 + loop); setState('clear'); sound('clear'); }
    }
    // lang niets gedaan met een bal op het batje: terug naar de demo
    if (!demo && (state === 'serve' || state === 'intro') && t - lastInput > 45 && t - stateAt > 45) { endGame(); }
  }
  function launchStuck(b) {
    const a = clamp(b.stuck / (padW / 2), -1, 1) * 1.0;
    b.stuck = 0; b.vx = Math.sin(a) * speed(); b.vy = -Math.cos(a) * speed();
  }

  function advance() {
    // na 'level voltooid' het volgende level
    level++; if (level >= MAPS.length) { level = 0; loop++; }
    resetPowers(); rallyBoost = 0; build(level); serveBall(); setState('intro');
    saveRun();
  }

  // ---- tekenen ----
  function text(s, x, y, size, col, align = 'center') { tg.font = FONT(size); tg.textAlign = align; tg.fillStyle = col; tg.fillText(s, x, y); }
  function drawTube() {
    tg.fillStyle = rgba(P.bg, 0.4); tg.fillRect(0, 0, W, H);
    const fade = state === 'over' || state === 'pause' || (state === 'attract' && showTop()) ? 0.28 : 1;
    // stenen
    for (const br of bricks) {
      if (br.hp <= 0) continue;
      const born = clamp((t - br.born) / 0.35, 0, 1) * fade, hot = t - br.hit < 0.12;
      if (br.steel) {
        const c = hot ? P.hi : P.lo;
        tg.strokeStyle = rgba(c, 0.9 * born); tg.lineWidth = 1; tg.strokeRect(br.x + 0.5, br.y + 0.5, BW - 1, BH - 1);
        tg.beginPath();
        for (let x = br.x + 3; x < br.x + BW; x += 4) { tg.moveTo(x, br.y + BH - 1); tg.lineTo(x + 3, br.y + 1); }
        tg.strokeStyle = rgba(c, 0.45 * born); tg.stroke();
        continue;
      }
      const c = hexRgb(LV[br.lv]);
      tg.fillStyle = rgba(hot ? P.hi : c, (hot ? 0.5 : 0.16) * born); tg.fillRect(br.x, br.y, BW, BH);
      tg.strokeStyle = rgba(c, 0.95 * born); tg.lineWidth = 1; tg.strokeRect(br.x + 0.5, br.y + 0.5, BW - 1, BH - 1);
      if (br.hp > 1) tg.strokeRect(br.x + 2.5, br.y + 2.5, BW - 5, BH - 5);   // hard: dubbele rand
    }
    for (const f of flashes) { tg.fillStyle = rgba(P.hi, (1 - (t - f.at) / 0.3) * 0.9); tg.fillRect(f.x, f.y, f.w, f.h); }
    // capsules
    for (const c of caps) {
      const fl = 0.75 + 0.25 * Math.sin(t * 14 + c.x);
      tg.strokeStyle = rgba(P.mid, fl); tg.lineWidth = 1;
      tg.beginPath(); tg.roundRect(c.x - 8, c.y - 4.5, 16, 9, 4.5); tg.stroke();
      text(c.p.ch, c.x, c.y + 3.6, 11, rgba(P.hi, fl));
    }
    for (const bm of beams) { tg.fillStyle = rgba(P.hi, 0.95); tg.fillRect(bm.x - 0.5, bm.y - 6, 1, 6); }
    // batje en ballen
    if (state !== 'over') {
      tg.fillStyle = rgba(P.mid, fade); tg.fillRect(padX - padW / 2, PAD_Y, padW, 3);
      tg.fillStyle = rgba(P.hi, fade); tg.fillRect(padX - padW / 2, PAD_Y, padW, 1);
      if (power.laser > t) { tg.fillStyle = rgba(P.hi, fade); tg.fillRect(padX - padW / 2 + 2, PAD_Y - 2, 2, 2); tg.fillRect(padX + padW / 2 - 4, PAD_Y - 2, 2, 2); }
      if (power.catch > t) { tg.fillStyle = rgba(P.hi, 0.6 * fade); for (let x = padX - padW / 2 + 2; x < padX + padW / 2; x += 4) tg.fillRect(x, PAD_Y + 4, 2, 1); }
      for (const b of balls) { tg.fillStyle = rgba(P.hi, fade); tg.fillRect(b.x - BALL, b.y - BALL, BALL * 2, BALL * 2); }
    }
    // kop: score, level met levens, highscore
    const hi = Math.max(top[0]?.s || 0, demo ? 0 : score);
    text(`${demo ? 'DEMO' : pad(score, 6)}`, 12, 17, 16, rgba(P.mid, 1), 'left');
    text(`HI ${pad(hi, 6)}`, W - 12, 17, 16, rgba(P.mid, 1), 'right');
    text(`LV ${pad(level + 1, 2)}${loop ? ` · ${T.loop} ${loop + 1}` : ''}`, W / 2 - (demo ? 0 : 14), 17, 16, rgba(P.mid, 1));
    if (!demo) for (let i = 0; i < lives; i++) { tg.fillStyle = rgba(P.mid, 1); tg.fillRect(W / 2 + 22 + i * 7, 11, 5, 2); }
    // actieve powerups rechtsonder
    const act = POWERS.filter(p => p.dur && power[p.id] > t);
    act.forEach((p, i) => text(`${p.ch} ${pad(power[p.id] - t, 2)}`, W - 12 - i * 34, H - 2.5, 12, rgba(P.lo.map((v, k) => Math.max(v, P.mid[k] * 0.8)), 1), 'right'));
    // boodschappen
    const blink = Math.floor((t - stateAt) * 2) % 2 === 0;
    const mapName = MAPS[level % MAPS.length][en ? 'en' : 'nl'];
    if (state === 'attract') {
      if (showTop()) drawTop();
      else { text('BREAKOUT', W / 2, 128, 34, rgba(P.hi, 1)); if (blink) text(T.start, W / 2, 148, 14, rgba(P.mid, 1)); }
    } else if (state === 'intro') {
      text(`LEVEL ${pad(level + 1, 2)}`, W / 2, 138, 28, rgba(P.hi, 1));
      text(mapName, W / 2, 154, 14, rgba(P.mid, 1));
      if (t - stateAt > 1.2 && blink) text(T.launch, W / 2, 172, 12, rgba(P.mid, 0.9));
    } else if (state === 'serve') {
      if (blink) text(T.launch, W / 2, 150, 14, rgba(P.mid, 1));
    } else if (state === 'clear') {
      text(T.clear, W / 2, 132, 26, rgba(P.hi, 1));
      text(`${T.bonus} ${250 * (level + 1) * (1 + loop)}`, W / 2, 150, 14, rgba(P.mid, 1));
    } else if (state === 'pause') {
      text(T.pause, W / 2, 124, 28, rgba(P.hi, 1));
      text(T.resume, W / 2, 142, 14, rgba(P.mid, blink ? 1 : 0.5));
    } else if (state === 'over') {
      text(T.over, W / 2, newRank >= 0 ? 96 : 120, 30, rgba(P.hi, 1));
      text(pad(score, 6), W / 2, newRank >= 0 ? 114 : 138, 16, rgba(P.mid, 1));
      if (newRank >= 0) { if (blink) text(newRank === 0 ? T.newHi : `#${newRank + 1}`, W / 2, 132, 14, rgba(P.hi, 1)); drawTop(150, newRank); }
      else if (t - stateAt > 1.2) text(T.again, W / 2, 156, 12, rgba(P.mid, blink ? 1 : 0.5));
    }
  }
  const showTop = () => state === 'attract' && top.length > 0 && Math.floor((t - stateAt) / 6) % 2 === 1;
  function drawTop(y0 = 108, mark = -1) {
    if (mark < 0) text(T.top, W / 2, y0 + 8, 18, rgba(P.hi, 1));
    const base = mark < 0 ? y0 + 30 : y0;
    if (!top.length) { text(T.empty, W / 2, base, 13, rgba(P.mid, 1)); return; }
    top.slice(0, mark < 0 ? 5 : 3).forEach((e, i) => {
      const d = new Date(e.at), on = i === mark;
      const line = `${i + 1}.  ${pad(e.s, 6)}  LV ${pad(e.lv, 2)}  ${pad(d.getDate(), 2)} ${MONTHS[d.getMonth()]}`;
      text(line, W / 2, base + i * 15, 14, rgba(on ? P.hi : P.mid, on ? 1 : 0.9));
    });
  }

  function composite() {
    bg.clearRect(0, 0, bloom.width, bloom.height); bg.drawImage(tube, 0, 0, bloom.width, bloom.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = rgba(P.bg, 1); g.fillRect(0, 0, W, H);
    g.globalAlpha = reducedMotion.matches ? 1 : 0.96 + Math.random() * 0.04;
    g.drawImage(tube, 0, 0, W, H);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5; g.drawImage(bloom, 0, 0, W, H);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = pat; g.fillRect(0, 0, W, H);
    if (!reducedMotion.matches) {
      const band = ((t * 26) % (H + 60)) - 30, gr = g.createLinearGradient(0, band - 24, 0, band + 24);
      gr.addColorStop(0, rgba(P.mid, 0)); gr.addColorStop(0.5, rgba(P.mid, 0.035)); gr.addColorStop(1, rgba(P.mid, 0));
      g.fillStyle = gr; g.fillRect(0, band - 24, W, 48);
    }
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.66);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  }
  function draw() {
    const a = accent?.();
    if (a !== lastAccent) { lastAccent = a; P = phosphor(a); }
    tg.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTube(); composite();
  }

  function input(p) { lastInput = t; target = p.x; }
  // een tik, klik of spatie: starten, lanceren, verder spelen
  function act(x = target) {
    if (state === 'attract') { startGame(); padX = target = x; lastInput = t; return; }
    input({ x });
    if (state === 'pause') { setState(balls.every(b => !b.vx && !b.vy) ? 'serve' : 'play'); return; }   // teruggezet spel: bal ligt nog op het batje
    if (state === 'over') { if (t - stateAt > 1.2) startGame(); return; }
    if (state === 'serve' || state === 'intro') { if (state !== 'intro' || t - stateAt > 0.6) launch(); return; }
    if (state === 'play') for (const b of balls) if (b.stuck) launchStuck(b);
  }
  const pauseNow = () => { if (!demo && state === 'play') setState('pause'); saveRun(); };
  // muis buiten het bakje: dichtbij stuurt ze het batje verder, ver weg (of het venster uit) pauzeert het spel
  function onWinMove(e) {
    if (demo || !cv || e.pointerType === 'touch') return;
    const r = cv.getBoundingClientRect();
    const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right), dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
    if (!dx && !dy) return;   // binnen: het bakje geeft de beweging zelf door
    if (Math.hypot(dx, dy) > FAR) { pauseNow(); return; }
    if (state !== 'pause') input({ x: (e.clientX - r.left) / (r.width || 1) * W });
  }
  const shown = () => cv && cv.getClientRects().length && getComputedStyle(cv).visibility !== 'hidden';
  const skipKey = e => e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')
    || e.target.closest?.('input, textarea, select, [contenteditable], [role=listbox], [role=menu], .fidget-grip, .fidget-menu');
  function onKey(e) {
    if (!shown() || skipKey(e)) return;
    const down = e.type === 'keydown';
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      keys[e.key === 'ArrowLeft' ? 'left' : 'right'] = down;
      if (down && (state === 'attract' || state === 'pause')) act(target);
      e.preventDefault();
      return;
    }
    // spatie en Enter enkel als er geen knop de focus heeft (die doen dan hun eigen werk); pijl omhoog altijd
    const onButton = e.target.closest?.('button, a[href]');
    if (down && !e.repeat && (e.key === 'ArrowUp' || ((e.key === ' ' || e.key === 'Enter') && !onButton))) { act(target); e.preventDefault(); }
  }
  const clearKeys = () => { keys.left = keys.right = false; };
  const onBlur = () => { clearKeys(); pauseNow(); };
  const onDocLeave = e => { if (!e.relatedTarget) pauseNow(); };
  const onHidden = () => { if (document.hidden) pauseNow(); };
  function listen(on) {
    const f = on ? 'addEventListener' : 'removeEventListener';
    window[f]('pointermove', onWinMove, { passive: true });
    document[f]('keydown', onKey);
    document[f]('keyup', onKey);
    window[f]('blur', onBlur);
    document.documentElement[f]('mouseleave', onDocLeave);
    document[f]('visibilitychange', onHidden);
  }
  return {
    own: true,
    onDark: true,
    // de keuzerij wijkt zolang er gespeeld wordt (anders ligt ze over de score)
    get busy() { return !demo && state === 'play'; },
    init() { if (!restoreRun()) startAttract(); },
    // scores van een ander toestel of tabblad: opnieuw inlezen, een net behaalde plaats blijft gemarkeerd
    reload() {
      const mine = top[newRank];
      top = loadTop();
      if (mine) newRank = top.findIndex(e => e.at === mine.at && e.s === mine.s);
    },
    mount(el) {
      if (cv) return;
      if (!document.querySelector('link[data-vt323]')) {
        const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=VT323&display=swap' });
        l.dataset.vt323 = ''; document.head.append(l);
      }
      dpr = Math.min(2, window.devicePixelRatio || 1) * zoom;
      cv = document.createElement('canvas');
      cv.className = 'panel-canvas'; cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = `${W * zoom}px`; cv.style.height = `${H * zoom}px`;
      el.append(cv);
      g = cv.getContext('2d');
      tube = document.createElement('canvas'); tube.width = cv.width; tube.height = cv.height; tg = tube.getContext('2d');
      tg.fillStyle = rgba(P.bg, 1); tg.fillRect(0, 0, tube.width, tube.height);
      bloom = document.createElement('canvas'); bloom.width = 82; bloom.height = 57; bg = bloom.getContext('2d');
      const scan = document.createElement('canvas'); scan.width = 4; scan.height = 3;
      const sc = scan.getContext('2d'); sc.fillStyle = 'rgba(0,0,0,.32)'; sc.fillRect(0, 2, 4, 1);
      pat = g.createPattern(scan, 'repeat');
      lastNow = 0;
      listen(true);
      // terug in de focus midden in een spel: pauze
      if (!demo && state === 'play') setState('pause');
      if (reducedMotion.matches) {
        if (state === 'attract') { bricks.forEach(b => { b.born = -9; }); balls = []; }
        for (let i = 0; i < 3; i++) draw();
      }
      document.fonts?.load('16px VT323').then(() => { if (cv && reducedMotion.matches) for (let i = 0; i < 3; i++) draw(); }).catch(() => {});
    },
    unmount() {
      listen(false); clearKeys();
      if (!demo && state === 'play') setState('pause');
      saveRun();
      cv?.remove(); cv = null; g = null; tube = null; tg = null;
    },
    frame(now) {
      if (!cv || reducedMotion.matches) return;
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 1 / 60;
      lastNow = now;
      if (state === 'clear' && t - stateAt > 1.8) advance();
      if (state === 'clear' || state === 'over' || state === 'pause') t += dt;
      else step(dt);
      if (state === 'over' && t - stateAt > (newRank >= 0 ? 7 : 12)) startAttract();
      draw();
    },
    move(p) { if (!demo) input(p); },
    drag(p) { if (!demo) input(p); },
    down(p) { if (!demo) input(p); },
    tap(p) { act(p.x); },
    recolor() {},
  };
}
