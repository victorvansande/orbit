/* ---- Effecten buiten de scène (naar React Bits Pro, eigen versie zonder React) ---- */
// Zachte intro vanuit de kern, witte gloed (maandwissel), nacht en typographic wall (lege lijst).
// Zelfde taal als de scène: Geist Mono, inkt met lage dekking, rood alleen als accent.
// Glyph sonar, vortex en mosaic wave zitten in scene.js.

import { morphMatrix } from './matrix.js';

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function fitCanvas(cv, w, h) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cv.style.width = `${w}px`; cv.style.height = `${h}px`;
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return g;
}

// Verduistering over het hele venster (intro, nacht). Draai je de gsm of wisselt het thema terwijl ze loopt,
// dan past ze zich aan: `fresh()` maakt de canvas opnieuw passend en zegt wat er veranderde ('size', 'theme' of false).
function overlay(cls = 'fx-reveal') {
  const cv = document.createElement('canvas');
  cv.className = cls;
  cv.setAttribute('aria-hidden', 'true');
  document.body.append(cv);
  const o = {
    cv, W: innerWidth, H: innerHeight, g: null, theme: document.documentElement.dataset.theme,
    fresh() {
      let changed = false;
      if (innerWidth !== o.W || innerHeight !== o.H) { o.W = innerWidth; o.H = innerHeight; o.g = fitCanvas(cv, o.W, o.H); changed = 'size'; }
      const th = document.documentElement.dataset.theme;
      if (th !== o.theme) { o.theme = th; changed = changed || 'theme'; }
      return changed;
    },
  };
  o.g = fitCanvas(cv, o.W, o.H);
  return o;
}

/* ---- Muur van woorden: verdeling ---- */
// Rijen woorden voor de muur (in de scène en in de lege lijst). Vroeger koos een vast patroon (i × 7 + rij) het woord:
// met weinig titels stond dezelfde taak dan vlak naast of schuin onder zichzelf, alsof er maar een paar taken waren.
// Nu een geschud stapeltje dat helemaal doorlopen wordt voor een titel terugkomt, en nooit dezelfde titel als de buur
// links of als een titel die er in de rij erboven recht boven staat. Vast zaad, dus de muur verspringt niet.
export function wallRows(words, W, H, lh, measure) {
  const n = words.length, items = [];
  if (!n) return items;
  let seed = 0x9e3779b9 ^ (n * 2654435761);
  const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let deck = [];
  const draw = () => {
    if (!deck.length) { deck = words.map((_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } }
    return deck;
  };
  let above = [];
  for (let row = 0; row * lh < H + lh; row++) {
    const line = [];
    let x = -((row * 41) % 90), left = -1;
    while (x < W) {
      const d = draw();
      const clash = idx => { const w = measure(`${words[idx]}  ✦  `); return idx === left || above.some(a => a.idx === idx && a.x < x + w && a.x + a.w > x); };
      // de eerste kaart die niet botst met de buur links of het woord erboven
      let k = d.findIndex(i => !clash(i)), idx;
      if (k >= 0) idx = d.splice(k, 1)[0];
      else {
        // het stapeltje heeft niets passends meer: kies uit alle titels, liefst zonder botsing, anders niet dezelfde als links
        const free = words.map((_, i) => i).filter(i => !clash(i));
        const pool = free.length ? free : words.map((_, i) => i).filter(i => i !== left);
        idx = pool.length ? pool[Math.floor(rand() * pool.length)] : 0;
      }
      const word = `${words[idx]}  ✦  `, w = measure(word);
      const it = { word, idx, x, y: row * lh + 8, w };
      items.push(it); line.push(it);
      left = idx; x += w;
    }
    above = line;
  }
  return items;
}

/* ---- Intro: een zachte cirkel vanuit de kern ---- */
// Bij het openen ligt er even effen papier over de pagina; een zachte cirkel vanuit de kern wist het weg en de ringen
// verschijnen van binnen naar buiten (de gewone intro van de scène). Een tik of toets slaat over. Vroeger regende er
// eerst tekens (terminal rain); Victor hield alleen de cirkel.
export function softReveal({ center, onReveal, done = () => {} }) {
  const ov = overlay(), cv = ov.cv;
  let W = ov.W, H = ov.H, g = ov.g, bg = css('--bg');
  const START = 0.08, END = 1.96;
  // trage, zachte start boven de kern die naar de randen toe geleidelijk versnelt
  const easeReveal = u => 0.2 * u + 0.8 * Math.pow(u, 2.35);
  const STOPS = [[0, 1], [0.25, 0.9], [0.5, 0.5], [0.75, 0.1], [1, 0]];
  let t0 = performance.now(), revealed = false, skipAt = 0, raf = 0;

  function frame(now) {
    if (ov.fresh()) { W = ov.W; H = ov.H; g = ov.g; bg = css('--bg'); }
    let t = (now - t0) / 1000;
    if (skipAt) t = Math.max(t, END - 0.25 + (now - skipAt) / 1000);
    if (t >= START && !revealed) { revealed = true; onReveal(); }
    if (t >= END) { cv.remove(); removeEventListener('pointerdown', skip, true); removeEventListener('keydown', skip, true); done(); return; }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    if (t > START) {
      const [cx, cy] = center();
      const soft = Math.max(135, Math.min(W, H) * 0.19);
      const farR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + soft;
      const u = Math.min(1, Math.max(0, (t - START) / (END - START)));
      const R = farR * easeReveal(u);
      const a = smoothstep(0, soft * 0.5, R);
      g.globalCompositeOperation = 'destination-out';
      const grad = g.createRadialGradient(cx, cy, Math.max(0, R - soft), cx, cy, R + 1);
      for (const [pos, w] of STOPS) grad.addColorStop(pos, `rgba(0,0,0,${(a * w).toFixed(4)})`);
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }
    raf = requestAnimationFrame(frame);
  }
  function skip() { if (!skipAt) skipAt = performance.now(); }
  addEventListener('pointerdown', skip, true);
  addEventListener('keydown', skip, true);
  frame(t0);   // meteen het eerste beeld, dan pas het papier uit index.html weg: geen gat ertussen
  document.documentElement.classList.remove('is-veiled');
  return { skip, cancel() { cancelAnimationFrame(raf); cv.remove(); } };
}

/* ---- Witte gloed bij de maandwissel ("Zwaartekracht") ---- */
// De sterren van de vorige maand zijn in de kern verdwenen; vanuit de kern vult een zachte witte gloed het venster
// (radiaal verloop, geen harde rand) en op het hoogtepunt opent het recapvenster (`onPeak`). Daarna trekt de gloed
// achter het venster terug. Wit in beide thema's: het is licht, geen inkt. De maandwissel slaat niet over.
// soft (Z1, Z3, Z4 van de maandwissel, 04/11/2026): geen opkomende was maar een zachte cirkel van vol licht vanuit de kern,
// zoals de intro, die het scherm in 1,5 s vult; de recap opent op 1,25 s.
export function whiteBurst({ center, onPeak = () => {}, done = () => {}, soft = false }) {
  const ov = overlay(), cv = ov.cv;
  let W = ov.W, H = ov.H, g = ov.g;
  const GROW = soft ? 1.5 : 1.6, PEAK = soft ? 1.25 : 1.1, END = soft ? 1.95 : 1.8;   // rustig; na het hoogtepunt neemt de witte achtergrond van het venster het over
  let t0 = performance.now(), peaked = false, raf = 0, over = false;
  const easeOut = u => 1 - Math.pow(1 - u, 3);
  function frame(now) {
    if (ov.fresh()) { W = ov.W; H = ov.H; g = ov.g; }
    const t = (now - t0) / 1000;
    if (t >= PEAK && !peaked) { peaked = true; onPeak(); }
    if (t >= END) { finish(); return; }
    const [cx, cy] = center();
    const far = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
    const grow = Math.min(1, t / GROW), fade = t < PEAK ? 1 : 1 - smoothstep(PEAK, END, t);
    const k = smoothstep(0, soft ? 0.12 : 0.7, t) * fade;
    // op het hoogtepunt is het hele venster vol wit, tot in de hoeken (anders sprong het naar de witte achtergrond
    // van het venster); de zachte rand ligt dan buiten beeld
    const R = Math.max(1, far * (soft ? 1.3 : 1.7) * easeOut(grow));
    g.clearRect(0, 0, W, H);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    gr.addColorStop(0, `rgba(255,255,255,${k.toFixed(4)})`);
    gr.addColorStop(soft ? 0.5 : 0.3, `rgba(255,255,255,${k.toFixed(4)})`);
    gr.addColorStop(0.62, `rgba(255,255,255,${(soft ? 1 : 0.96) * k})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    raf = requestAnimationFrame(frame);
  }
  function finish() { if (over) return; over = true; cancelAnimationFrame(raf); cv.remove(); done(); }
  raf = requestAnimationFrame(frame);
  return {
    skip() { if (!peaked) t0 = performance.now() - PEAK * 1000; },
    cancel: finish,
  };
}

/* ---- Kleine nacht: een nieuwe ster na het afvinken ---- */
// S1 (Victor, 02/11/2026: de nacht over het hele scherm werd na een tijd te veel; "dezelfde animatie als nu maar dan lokaler
// en kleiner"). Enkel in een cirkel rond de plek van de nieuwe ster wordt het even inkt (licht in het donker), de sterren
// daarbinnen lichten op in papierkleur, de nieuwe ster bloeit open, en de dag komt terug met een zachte cirkel vanuit de ster.
// Laat alle klikken door (pointer-events: none) en stopt niet als je intussen iets anders doet.
const NIGHT = { fall: 0.45, born: 0.3, open: 1.1, end: 2.3 };
/* ---- Venster vóór de maandwissel: M1 Het nummer (Victor, 04/11/2026) ----
   Op het papier van de intro: linksboven het merk, rechtsboven de datum, in het midden het nummer van de nieuwe maand in
   rode stippen met schimmen (zoals het aantal sterren op de recapkaart), klein eronder de naam van de maand, onderaan een
   fluistering. Het hele venster is de
   knop: de tik is de klik die de browser vraagt voor geluid, daarna lost het venster op in het papier van de intro.
   Zolang het er staat, doen sneltoetsen niets; Enter of spatie opent. */
export function monthGate({ digits, month = '', date, label, aria, mark, onOpen }) {
  const el = document.createElement('div');
  el.className = 'month-gate';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', aria);
  el.tabIndex = 0;
  el.innerHTML = '<div class="mg-corner"><span class="mg-mark"></span><span class="mg-date"></span></div><span class="mg-dm" aria-hidden="true"></span><span class="mg-month"></span><span class="mg-hint"></span>';
  if (mark) el.querySelector('.mg-mark').append(mark);
  el.querySelector('.mg-date').textContent = date;
  el.querySelector('.mg-month').textContent = month;   // naam van de maand onder het nummer (Victor, 04/11/2026)
  el.querySelector('.mg-hint').textContent = label;
  document.body.append(el);
  morphMatrix(el.querySelector('.mg-dm'), digits);   // het nummer ontstaat uit ruis, zoals de stippenteller wisselt
  el.querySelector('.mg-dm').removeAttribute('aria-label');
  requestAnimationFrame(() => el.focus({ preventScroll: true }));
  let opened = false;
  const keys = e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    e.stopImmediatePropagation();
  };
  function open() {
    if (opened) return;
    opened = true;
    removeEventListener('keydown', keys, true);
    onOpen();
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 700);
  }
  addEventListener('keydown', keys, true);
  el.addEventListener('click', open);
}

/* ---- Golf vanuit de kern (tik op de kern, Victor 04/11/2026) ----
   Vervangt de ring van tekens (glyph sonar): een zachte, brede rimpeling in inktkleur die traag van de kern naar de randen
   van het scherm loopt en onderweg uitdooft (één golf; een tweede erachter was te veel, Victor, 04/11/2026). Geen sluier zoals de intro, enkel een band
   licht/schaduw met een klokvormig profiel, dekking hooguit 0,07. timeTo(px) zegt wanneer het front op die afstand van de
   kern is, zodat de scène de echo rond een bol er precies op laat vallen. */
const WAVE = { dur: 3.2, peak: 0.07 };
export function coreWave({ center }) {
  const ov = overlay('fx-wave');
  let W = ov.W, H = ov.H, g = ov.g, [cx, cy] = center();
  const rgb = () => { g.fillStyle = css('--ink'); const h = g.fillStyle.slice(1); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(','); };
  let ink = rgb();
  const farOf = () => Math.max(Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy)) + 160;
  let far = farOf();
  const front = u => far * (1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 2.4));   // traag uitlopend
  const t0 = performance.now();
  let raf = 0;
  function band(grad, R, wid, a, rMax) {
    if (a <= 0.002 || R <= 0) return;
    for (let i = 0; i <= 24; i++) {
      const x = (i / 24) * 2 - 1, r = R + x * wid * 1.6;
      if (r < 0 || r > rMax) continue;
      grad.push([r / rMax, a * Math.exp(-x * x * 3.2)]);
    }
  }
  function frame(now) {
    const ch = ov.fresh();
    if (ch) { W = ov.W; H = ov.H; g = ov.g; ink = rgb(); [cx, cy] = center(); far = farOf(); }
    const t = (now - t0) / 1000;
    if (t > WAVE.dur) { cancelAnimationFrame(raf); ov.cv.remove(); return; }
    g.clearRect(0, 0, W, H);
    const stops = [];
    for (const [lag, k] of [[0, 1]]) {
      const u = (t - lag) / WAVE.dur;
      if (u <= 0 || u >= 1) continue;
      const R = front(u), wid = 40 + 150 * u;
      const a = WAVE.peak * k * Math.min(1, u / 0.08) * Math.pow(1 - u, 1.4);   // zacht aan, traag uitdovend
      band(stops, R, wid, a, far);
    }
    if (stops.length) {
      stops.sort((p, q) => p[0] - q[0]);
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, far);
      let last = -1;
      grad.addColorStop(0, `rgba(${ink},0)`);
      for (const [o, a] of stops) { if (o <= last) continue; last = o; grad.addColorStop(Math.min(1, o), `rgba(${ink},${a.toFixed(4)})`); }
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return {
    // seconden tot het front op afstand px van de kern is
    timeTo(px) { const q = Math.min(1, Math.max(0, px / far)); return (1 - Math.pow(1 - q, 1 / 2.4)) * WAVE.dur; },
  };
}

export function smallNight({ star, stars = [], scene = null, onOpen = () => {}, done = () => {} }) {
  let W = innerWidth, H = innerHeight, theme = document.documentElement.dataset.theme;
  const probe = document.createElement('canvas').getContext('2d');
  const rgb = name => { probe.fillStyle = css(name); const h = probe.fillStyle.slice(1); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(','); };
  let ink = rgb('--ink'), paper = rgb('--bg');
  const R = Math.max(70, Math.min(120, Math.min(W, H) * 0.13));   // straal van de kleine nacht
  const easeIO = x => (x = Math.min(1, Math.max(0, x)), x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOut = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  // dekking op afstand r van de nieuwe ster: een schijf met een zachte rand die eerst opbloeit, daarna een gat vanuit de ster
  const cover = (r, t) => {
    const fall = easeIO(t / NIGHT.fall), size = R * (0.75 + 0.25 * fall);
    const disc = 1 - smoothstep(size * 0.5, size, r);
    const hole = t < NIGHT.open ? 0 : R * 1.3 * easeIO((t - NIGHT.open) / (NIGHT.end - NIGHT.open));
    return fall * disc * smoothstep(hole - R * 0.45, hole, r);
  };
  const near = stars.filter(s => Math.hypot(s.x - star.x, s.y - star.y) < R);
  const t0 = performance.now();
  let opened = false, stopped = false;

  function star4(g, x, y, r, rot) {
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = rot + i * Math.PI / 2, b = a + Math.PI / 4, c = a + Math.PI / 2;
      if (i === 0) g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      g.quadraticCurveTo(x + Math.cos(b) * r * 0.18, y + Math.sin(b) * r * 0.18, x + Math.cos(c) * r, y + Math.sin(c) * r);
    }
    g.fill();
  }

  function renderOn(g, now, ox = 0, oy = 0) {
    if (stopped) return;
    const sizeChanged = innerWidth !== W || innerHeight !== H;
    const th = document.documentElement.dataset.theme;
    if (th !== theme) { theme = th; ink = rgb('--ink'); paper = rgb('--bg'); }
    const t = (now - t0) / 1000;
    if ((t >= NIGHT.open || sizeChanged) && !opened) { opened = true; onOpen(); }
    if (t >= NIGHT.end || sizeChanged) { stop(); done(); return; }   // gsm gedraaid: de ster staat elders
    const sx = star.x - ox, sy = star.y - oy;
    const N = 40, grad = g.createRadialGradient(sx, sy, 0, sx, sy, R * 1.3);
    for (let i = 0; i <= N; i++) grad.addColorStop(i / N, `rgba(${ink},${cover(R * 1.3 * i / N, t).toFixed(4)})`);
    g.globalAlpha = 1; g.fillStyle = grad; g.fillRect(sx - R * 1.4, sy - R * 1.4, R * 2.8, R * 2.8);
    g.fillStyle = `rgb(${paper})`;
    for (const s of near) {
      const a = cover(Math.hypot(s.x - star.x, s.y - star.y), t);
      if (a < 0.01) continue;
      g.globalAlpha = a * (0.55 + 0.25 * Math.sin(now / 900 + s.x));
      star4(g, s.x - ox, s.y - oy, s.r, 0);
    }
    // de nieuwe ster bloeit open in papierkleur en zakt naar haar gewone maat; vanaf het openen neemt de scène haar over
    const ac = cover(0, t);
    if (t > NIGHT.born && ac > 0.01) {
      const u = t - NIGHT.born, k = easeOut(u / 0.35) * (1 + 1.8 * (1 - easeOut(u / 1.6))), r = star.r * k;
      const glow = g.createRadialGradient(sx, sy, 0, sx, sy, 8 + r * 4);
      glow.addColorStop(0, `rgba(${paper},${0.3 * ac})`); glow.addColorStop(1, `rgba(${paper},0)`);
      g.globalAlpha = 1; g.fillStyle = glow; g.fillRect(sx - 8 - r * 4, sy - 8 - r * 4, 16 + r * 8, 16 + r * 8);
      g.fillStyle = `rgb(${paper})`; g.globalAlpha = ac;
      star4(g, sx, sy, r, (1 - easeOut(u / 1.2)) * Math.PI / 4);
    }
    g.globalAlpha = 1;
  }

  // Teken in de scène vóór drawCore zodat de rode kern altijd vóór deze animatie tekent, nooit erachter (Victor, 05/11/2026)
  if (scene?.setNightDraw) {
    function stop() { if (stopped) return; stopped = true; scene.setNightDraw(null); }
    scene.setNightDraw((g, now, rect) => renderOn(g, now, rect.left, rect.top));
    return;
  }

  const ov = overlay('fx-night'), cv = ov.cv;
  let raf = 0;
  function stop() { if (stopped) return; stopped = true; cancelAnimationFrame(raf); cv.remove(); }
  function frame(now) {
    ov.fresh();
    ov.g.clearRect(0, 0, ov.W, ov.H);
    renderOn(ov.g, now, 0, 0);
    if (!stopped) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
}


/* ---- Typographic wall: de lege lijst ---- */
// Als alles afgevinkt is: een muur van wat je onlangs afvinkte, in kapitaaltjes, bijna onzichtbaar. Waar je aanwijst
// (of waar een zacht licht rondzwerft) worden de woorden leesbaar.
export function createWall({ reducedMotion }) {
  const box = document.createElement('div');
  box.className = 'fx-wall';
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  const msg = document.createElement('p');
  msg.className = 'fx-wall-msg';
  box.append(cv, msg);
  let words = [], g = null, W = 0, H = 0, raf = 0, running = false, pointer = null, lamp = { x: -999, y: -999 }, visible = false;
  let layout = [], layoutKey = '';

  function resize() {
    W = Math.floor(box.clientWidth); H = Math.floor(box.clientHeight);
    if (W && H) g = fitCanvas(cv, W, H);
  }
  function draw(now) {
    if (!running) return;
    if (!g || cv.width === 0) resize();
    if (!g) { raf = requestAnimationFrame(draw); return; }
    const still = reducedMotion.matches;
    const target = pointer || { x: W / 2 + Math.cos(now / 3100) * W * 0.32, y: H / 2 + Math.sin(now / 2300) * H * 0.3 };
    lamp.x += (target.x - lamp.x) * (still ? 1 : 0.1); lamp.y += (target.y - lamp.y) * (still ? 1 : 0.1);
    g.clearRect(0, 0, W, H);
    const ink = css('--ink');
    g.fillStyle = ink;
    g.font = '500 9.5px "Geist Mono", ui-monospace, monospace';
    g.textBaseline = 'middle';
    if (layoutKey !== `${W}x${H}:${words.join('|')}`) { layoutKey = `${W}x${H}:${words.join('|')}`; layout = wallRows(words, W, H, 15, t => g.measureText(t).width); }
    for (const { word, x, y, w } of layout) {
      const d = Math.hypot(Math.max(0, Math.abs(x + w / 2 - lamp.x) - w / 2), y - lamp.y), lit = Math.max(0, 1 - d / 110);
      g.globalAlpha = 0.06 + 0.55 * lit * lit;
      g.fillText(word, x, y);
    }
    g.globalAlpha = 1;
    if (!still) raf = requestAnimationFrame(draw);
  }
  const play = () => {
    const want = visible && words.length && !document.hidden;
    if (want && !running) { running = true; raf = requestAnimationFrame(draw); }
    else if (!want && running) { running = false; cancelAnimationFrame(raf); }
  };
  new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; if (visible) resize(); play(); }).observe(box);
  new ResizeObserver(resize).observe(box);
  document.addEventListener('visibilitychange', play);
  const local = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  box.addEventListener('pointermove', e => { pointer = local(e); });
  box.addEventListener('pointerleave', () => { pointer = null; });

  return {
    el: box,
    set(list, text) {
      words = list.map(w => w.toUpperCase());
      msg.textContent = text;
      if (reducedMotion.matches && running) { running = false; play(); }
    },
  };
}
