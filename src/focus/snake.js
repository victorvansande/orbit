/* ---- Slang in het bakje van de focusmodus ---- */
// Gekozen door Victor (08/11/2026, F1 uit ontwerp/fidgets/: "werk snake alvast uit"). Snake in het raster van de matrixklok:
// onverlichte stippen als schim, de slang in inkt (of de kleur uit de kleurkiezer), eten is een rode Nu-stip.
// Af en toe een vierpuntige ster (star4, het teken van afronden) die meer waard is en na een paar seconden uitdooft.
// Sturen: vegen (ook meerdere bochten in één veeg), een tik stuurt naar die kant, pijltjes of WASD. Randen lopen rond,
// enkel jezelf raken is fataal. Niet aangeraakt: een demo speelt vanzelf. Muis weg uit het bakje: pauze.
// Beste score (`priority-orbit.snake.v1`), gedeeld tussen gekoppelde toestellen (src/data/scores.js). Minder beweging: één stilstaand beeld.

import { LANG } from '../core/i18n.js';


// raster van stippen onder de keuzerij; 34 × 20 in het basisbakje (325,6 × 226,8), een groter bakje krijgt meer stippen
const S = 9, TOP = 34;
let W = 325.6, H = 226.8, COLS = 34, ROWS = 20, OX = 0, OY = 0;
function setField(w, h) {
  W = w; H = h;
  COLS = Math.floor((W - 28.6) / S) + 1; ROWS = Math.floor((H - TOP - 21.8) / S) + 1;
  OX = (W - (COLS - 1) * S) / 2; OY = TOP + (H - TOP - 8 - (ROWS - 1) * S) / 2;
}
setField(W, H);
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', z: 'up', q: 'left' };
const en = LANG === 'en';
const T = en
  ? { start: 'TAP OR SWIPE TO START', over: 'GAME OVER', best: 'BEST', newBest: 'NEW BEST', pause: 'PAUSED', again: 'TAP TO PLAY AGAIN', resume: 'TAP TO RESUME' }
  : { start: 'TIK OF VEEG OM TE STARTEN', over: 'GAME OVER', best: 'BESTE', newBest: 'NIEUWE BESTE', pause: 'PAUZE', again: 'TIK OM OPNIEUW TE SPELEN', resume: 'TIK OM VERDER TE SPELEN' };

const key = (x, y) => y * COLS + x;
const wrap = (v, n) => (v + n) % n;
const px = x => OX + x * S, py = y => OY + y * S;

// vierpuntige ster met holle zijden, zoals star4 in de scène
function star(g, x, y, r, rot) {
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = rot + i * Math.PI / 2, b = a + Math.PI / 4;
    const tx = x + Math.cos(a) * r, ty = y + Math.sin(a) * r;
    if (i === 0) g.moveTo(tx, ty); else g.lineTo(tx, ty);
    g.quadraticCurveTo(x + Math.cos(b) * r * 0.16, y + Math.sin(b) * r * 0.16, x + Math.cos(a + Math.PI / 2) * r, y + Math.sin(a + Math.PI / 2) * r);
  }
  g.closePath();
}

// scores: { load, save } uit src/data/scores.js (via het bakje), gedeeld tussen gekoppelde toestellen
export function createSnake({ reducedMotion, accent, scores, size }) {
  if (size) setField(size.w, size.h);
  const loadBest = () => scores?.load()?.best || 0;
  const touch = matchMedia('(hover: none)');
  let cv = null, g = null, dpr = 1, lastNow = 0, t = 0;
  let C = {}, colorsAt = -9;
  let state = 'demo', stateAt = 0;               // demo, ready, play, pause, over
  let snake = [], prev = [], dir = 'right', queue = [], acc = 0, grow = 0;
  let food = null, bonus = null, ripples = [], score = 0, best = loadBest(), newBest = false;
  let lastInput = -99, swipe = null, deadAt = 0;

  const occupied = (x, y, from = 0) => snake.some((s, i) => i >= from && s[0] === x && s[1] === y);
  const free = () => {
    for (let n = 0; n < 400; n++) {
      const x = Math.random() * COLS | 0, y = Math.random() * ROWS | 0;
      if (!occupied(x, y) && !(food && food[0] === x && food[1] === y) && !(bonus && bonus.x === x && bonus.y === y)) return [x, y];
    }
    return [0, 0];
  };
  const speed = () => Math.max(0.065, 0.13 - (snake.length - 4) * 0.0014);   // seconden per stap, sneller naarmate hij groeit

  function reset(mode) {
    const y = ROWS >> 1;
    snake = [[9, y], [8, y], [7, y], [6, y]]; prev = snake.map(s => s.slice());
    dir = 'right'; queue = []; acc = 0; grow = 0; score = 0; newBest = false;
    bonus = null; ripples = []; food = null; food = free();
    state = mode; stateAt = t;
  }

  function turn(name) {
    const last = queue.length ? queue[queue.length - 1] : dir;
    const [a, b] = DIRS[last], [c, d] = DIRS[name];
    if (a === -c && b === -d) return;             // nooit rechtsomkeert
    if (name === last) return;
    if (queue.length < 2) queue.push(name);
  }
  function begin() { if (state === 'demo' || state === 'over') reset('play'); else if (state === 'pause') setPlay(); lastInput = t; }
  function setPlay() { state = 'play'; stateAt = t; }

  // demo: naar het eten, maar nooit een zet die hem opsluit (telt hoeveel vakjes hij daarna nog kan bereiken)
  function reach(x, y, body) {
    const seen = new Uint8Array(COLS * ROWS); body.forEach(s => { seen[key(s[0], s[1])] = 1; });
    const stack = [[x, y]]; let n = 0;
    while (stack.length && n < 160) {
      const [cx, cy] = stack.pop(); const k = key(cx, cy); if (seen[k]) continue; seen[k] = 1; n++;
      for (const [dx, dy] of Object.values(DIRS)) stack.push([wrap(cx + dx, COLS), wrap(cy + dy, ROWS)]);
    }
    return n;
  }
  function autopilot() {
    const [hx, hy] = snake[0], body = snake.slice(0, -1);
    const opts = Object.keys(DIRS).filter(n => { const [a, b] = DIRS[dir], [c, d] = DIRS[n]; return !(a === -c && b === -d); }).map(n => {
      const nx = wrap(hx + DIRS[n][0], COLS), ny = wrap(hy + DIRS[n][1], ROWS);
      const dxw = Math.min(Math.abs(nx - food[0]), COLS - Math.abs(nx - food[0])), dyw = Math.min(Math.abs(ny - food[1]), ROWS - Math.abs(ny - food[1]));
      const hit = body.some(s => s[0] === nx && s[1] === ny);
      return { n, hit, room: hit ? 0 : reach(nx, ny, body), dist: dxw + dyw + (n === dir ? -0.3 : 0) };
    });
    const need = Math.min(160, snake.length + 2);
    opts.sort((p, q) => p.hit - q.hit || (q.room >= need) - (p.room >= need) || (p.room >= need ? p.dist - q.dist : q.room - p.room));
    dir = opts[0].n;
  }

  function tick() {
    if (state === 'demo') autopilot();
    else if (queue.length) dir = queue.shift();
    prev = snake.map(s => s.slice());
    const [hx, hy] = snake[0];
    const nx = wrap(hx + DIRS[dir][0], COLS), ny = wrap(hy + DIRS[dir][1], ROWS);
    if (occupied(nx, ny, 0) && !(nx === snake[snake.length - 1][0] && ny === snake[snake.length - 1][1] && !grow)) { die(); return; }
    snake.unshift([nx, ny]);
    if (food && nx === food[0] && ny === food[1]) {
      grow += 1; ripples.push({ x: nx, y: ny, at: t, star: false });
      if (state !== 'demo') score += 1;
      food = free();
      if (!bonus && Math.random() < 0.2) { const [bx, by] = free(); bonus = { x: bx, y: by, at: t }; }
    } else if (bonus && nx === bonus.x && ny === bonus.y) {
      grow += 3; ripples.push({ x: nx, y: ny, at: t, star: true });
      if (state !== 'demo') score += 5;
      bonus = null;
    }
    if (grow > 0) { grow--; prev.push(prev[prev.length - 1]); } else snake.pop();   // prev[i] = waar stip i vandaan komt
  }

  function die() {
    deadAt = t;
    if (state === 'demo') { stateAt = t; state = 'demo-dead'; return; }
    if (score > best) { best = score; newBest = true; scores?.save({ best, at: Date.now() }); }
    state = 'over'; stateAt = t;
  }

  function step(dt) {
    t += dt;
    if (bonus && t - bonus.at > 7) bonus = null;
    ripples = ripples.filter(r => t - r.at < 0.9);
    if (state === 'demo-dead') { if (t - stateAt > 2.2) reset('demo'); return; }
    if (state === 'over') { if (t - stateAt > 14) reset('demo'); return; }
    if (state === 'pause') return;
    if (state === 'play' && t - lastInput > 60) { reset('demo'); return; }   // lang niets gedaan: terug naar de demo
    acc += dt;
    const sp = speed();
    while (acc >= sp && (state === 'play' || state === 'demo')) { acc -= sp; tick(); }
  }

  // well = achtergrond van het bakje (op gsm een ander vlak), voor de rand rond de tekst
  function colors() {
    if (t - colorsAt < 0.5 && C.ink) return C;
    colorsAt = t;
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue('--ink').trim() || '#1B1B22';
    C = { ink, well: (cv && getComputedStyle(cv.closest('.fidget') || cv).backgroundColor) || cs.getPropertyValue('--well').trim(), body: accent?.() || ink, core: cs.getPropertyValue('--core').trim() || '#E70049', dark: document.documentElement.dataset.theme === 'dark' };
    return C;
  }
  const rgba = (hex, a) => {
    const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };
  function label(text, x, y, size, color, align = 'center') {
    g.font = `500 ${size}px "Geist Mono", ui-monospace, monospace`;
    g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color;
    g.letterSpacing = `${size * 0.14}px`;
    g.lineJoin = 'round'; g.lineWidth = 5; g.strokeStyle = C.well; g.strokeText(text, x, y);   // rand in de kleur van het bakje: leesbaar boven de slang
    g.fillText(text, x, y);
    g.letterSpacing = '0px'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  }

  function draw() {
    const c = colors();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const sp = speed(), live = state === 'play' || state === 'demo';
    const f = live ? Math.min(1, acc / sp) : 1;
    const ease = f * f * (3 - 2 * f);

    // schim: het raster van de matrixklok
    g.fillStyle = rgba(c.ink, c.dark ? 0.1 : 0.08);
    g.beginPath();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { g.moveTo(px(x) + 1.1, py(y)); g.arc(px(x), py(y), 1.1, 0, 7); }
    g.fill();

    // eten en ster
    const pulse = 1 + 0.08 * Math.sin(t * 5);
    if (food) { g.fillStyle = c.core; g.beginPath(); g.arc(px(food[0]), py(food[1]), 3.3 * pulse, 0, 7); g.fill(); }
    if (bonus) {
      const age = t - bonus.at, life = Math.min(1, age / 0.3) * (age > 5.5 ? Math.max(0, 1 - (age - 5.5) / 1.5) : 1);
      g.fillStyle = rgba(c.ink, 0.9 * life);
      star(g, px(bonus.x), py(bonus.y), 5.6 * (0.8 + 0.2 * life), age * 0.6); g.fill();
    }

    // de slang: elke stip glijdt van zijn vorige plek naar de nieuwe (rond de rand springt hij)
    const dying = state === 'over' || state === 'demo-dead';
    const n = snake.length;
    for (let i = n - 1; i >= 0; i--) {
      const s = snake[i], p = prev[i] || s;
      let x = s[0], y = s[1];
      if (Math.abs(s[0] - p[0]) <= 1 && Math.abs(s[1] - p[1]) <= 1) { x = p[0] + (s[0] - p[0]) * ease; y = p[1] + (s[1] - p[1]) * ease; }
      const k = 1 - i / (n + 8);
      let a = 0.3 + 0.7 * k, r = 3.4 * (0.62 + 0.38 * k);
      if (dying) {   // de slang lost stip voor stip op, van de staart naar de kop
        const gone = (t - deadAt) * 18 - (n - 1 - i);
        if (gone > 1) continue;
        if (gone > 0) { a *= 1 - gone; r *= 1 - 0.5 * gone; }
      }
      g.fillStyle = rgba(c.body, a);
      g.beginPath(); g.arc(px(x), py(y), r, 0, 7); g.fill();
    }

    // rimpel bij eten: een fijne ring in de kleur van wat hij at
    for (const rp of ripples) {
      const u = (t - rp.at) / 0.9;
      g.strokeStyle = rp.star ? rgba(c.ink, 0.5 * (1 - u)) : rgba(c.core, 0.55 * (1 - u));
      g.lineWidth = 1; g.beginPath(); g.arc(px(rp.x), py(rp.y), 4 + u * 14, 0, 7); g.stroke();
    }

    // tekst: score tijdens het spel (de keuzerij wijkt dan), anders boodschappen in het midden
    const ink2 = rgba(c.ink, 0.55), ink1 = rgba(c.ink, 0.85);
    if (state === 'play') {
      label(String(score).padStart(3, '0'), OX - 3, 18, 11, ink1, 'left');
      label(`${T.best} ${String(best).padStart(3, '0')}`, W - OX + 3, 18, 9, ink2, 'right');
    }
    if (state === 'demo' || state === 'demo-dead') {
      label(T.start, W / 2, H / 2 + 1, 9, ink2);
    } else if (state === 'pause') {
      label(`${T.pause} · ${String(score).padStart(3, '0')}`, W / 2, H / 2 - 6, 11, ink1); label(T.resume, W / 2, H / 2 + 9, 8.5, ink2);
    } else if (state === 'over' && t - deadAt > 0.6) {
      label(T.over, W / 2, H / 2 - 14, 11, ink1);
      label(newBest ? `${T.newBest} · ${score}` : `${score} · ${T.best} ${best}`, W / 2, H / 2 + 1, 9, newBest ? c.core : ink2);
      if (t - stateAt > 1.2) label(T.again, W / 2, H / 2 + 16, 8.5, ink2);
    }
  }

  // toetsen: enkel zolang de slang in beeld is en je niet typt of een venster open hebt
  function onKey(e) {
    if (!cv || !cv.offsetParent || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    const name = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!name) return;
    if (state !== 'play' && !(state === 'demo' && e.key.startsWith('Arrow'))) return;
    e.preventDefault(); e.stopPropagation();
    if (state === 'demo') begin();
    turn(name); lastInput = t;
  }

  return {
    own: true,
    get busy() { return state === 'play'; },   // de keuzerij wijkt enkel tijdens het spel
    init() { reset('demo'); },
    reload() { best = Math.max(best, loadBest()); },   // beste score van een ander toestel of tabblad
    mount(el) {
      if (cv) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv = document.createElement('canvas');
      cv.className = 'panel-canvas'; cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      el.append(cv);
      g = cv.getContext('2d');
      document.addEventListener('keydown', onKey, true);
      lastNow = 0;
      if (state === 'play') { state = 'pause'; stateAt = t; }
      if (reducedMotion.matches) { reset('demo'); for (let i = 0; i < 14; i++) tick(); prev = snake.map(s => s.slice()); ripples = []; draw(); }
    },
    unmount() {
      if (state === 'play') { state = 'pause'; stateAt = t; }
      document.removeEventListener('keydown', onKey, true);
      cv?.remove(); cv = null; g = null;
    },
    frame(now) {
      if (!cv || reducedMotion.matches) return;
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 1 / 60;
      lastNow = now;
      step(dt);
      draw();
    },
    down(p) { swipe = { x: p.x, y: p.y, turned: false }; },
    drag(p) {
      if (!swipe) return;
      const dx = p.x - swipe.x, dy = p.y - swipe.y;
      if (Math.hypot(dx, dy) < 14) return;
      if (state !== 'play') begin();
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      swipe = { x: p.x, y: p.y, turned: true };   // nieuw beginpunt: één veeg kan meerdere bochten maken
      lastInput = t;
    },
    up() { swipe = null; },
    tap(p) {
      if (state === 'over') { if (t - stateAt > 1.2) begin(); return; }
      if (state === 'pause') { setPlay(); lastInput = t; return; }
      if (state === 'demo' || state === 'demo-dead') { begin(); return; }
      // tijdens het spel: draai naar de kant van de tik, dwars op de huidige richting
      const [hx, hy] = snake[0], [a] = DIRS[queue.length ? queue[queue.length - 1] : dir];
      const dx = p.x - px(hx), dy = p.y - py(hy);
      turn(a !== 0 ? (dy > 0 ? 'down' : 'up') : (dx > 0 ? 'right' : 'left'));
      lastInput = t;
    },
    leave() { swipe = null; if (state === 'play' && !touch.matches) { state = 'pause'; stateAt = t; } },
    recolor() { colorsAt = -9; },
  };
}
