/* ---- Effecten buiten de scène (naar React Bits Pro, eigen versie zonder React) ---- */
// Zachte intro vanuit de kern, particle text (titel in de Uitleg) en typographic wall (lege lijst).
// Zelfde taal als de scène: Geist Mono, inkt met lage dekking, rood alleen als accent.
// Glyph sonar, vortex en mosaic wave zitten in scene.js.

const TAU = Math.PI * 2;
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
  const cv = document.createElement('canvas');
  cv.className = 'fx-reveal';
  cv.setAttribute('aria-hidden', 'true');
  document.body.append(cv);
  const W = innerWidth, H = innerHeight, g = fitCanvas(cv, W, H);
  const bg = css('--bg'), maxR = Math.hypot(W, H);
  const START = 0.08, END = 1.35;
  let t0 = performance.now(), revealed = false, skipAt = 0, raf = 0;

  function frame(now) {
    let t = (now - t0) / 1000;
    if (skipAt) t = Math.max(t, END - 0.25 + (now - skipAt) / 1000);
    if (t >= START && !revealed) { revealed = true; onReveal(); }
    if (t >= END) { cv.remove(); removeEventListener('pointerdown', skip, true); removeEventListener('keydown', skip, true); done(); return; }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    if (t > START) {
      const [cx, cy] = center();
      const p = smoothstep(START, END, t), R = maxR * p * 1.05;
      g.globalCompositeOperation = 'destination-out';
      const grad = g.createRadialGradient(cx, cy, Math.max(0, R - 140), cx, cy, R + 1);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }
    raf = requestAnimationFrame(frame);
  }
  function skip() { if (!skipAt) skipAt = performance.now(); }
  addEventListener('pointerdown', skip, true);
  addEventListener('keydown', skip, true);
  raf = requestAnimationFrame(frame);
  return { skip, cancel() { cancelAnimationFrame(raf); cv.remove(); } };
}

/* ---- Nacht na het afvinken ("Nacht valt", gekozen door Victor uit vier voorstellen) ---- */
// Na het uitfonkelen valt de nacht: de pagina wordt in 0,55 s volledig inkt (licht in het donkere thema), alleen de
// sterrenhemel blijft en licht op. De nieuwe ster bloeit open, daarna komt de dag terug met dezelfde zachte cirkel als
// bij het laden, vanuit die ster. 2,7 s; een tik of toets laat de cirkel meteen openen.
const NIGHT_DEFAULT = { fade: 0.55, born: 0.55, open: 1.2, end: 2.7 };
// Ook voor een nieuwe prestatie (app.js): dan blijft de pil zelf licht staan (`bloom: false`, langer donker via `open`/`end`).
export function nightFall({ star, stars = [], onOpen = () => {}, done = () => {}, bloom = true, open, end }) {
  const NIGHT = { ...NIGHT_DEFAULT, ...(open ? { open } : {}), ...(end ? { end } : {}) };
  const cv = document.createElement('canvas');
  cv.className = 'fx-reveal';
  cv.setAttribute('aria-hidden', 'true');
  document.body.append(cv);
  const W = innerWidth, H = innerHeight, g = fitCanvas(cv, W, H);
  const rgb = name => { g.fillStyle = css(name); const h = g.fillStyle.slice(1); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(','); };
  const ink = rgb('--ink'), paper = rgb('--bg');
  const soft = Math.max(110, Math.min(W, H) * 0.22);
  const M = Math.hypot(Math.max(star.x, W - star.x), Math.max(star.y, H - star.y)) + soft;
  const easeIO = x => (x = Math.min(1, Math.max(0, x)), x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOut = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  // dekking op afstand r van de nieuwe ster
  const cover = (r, t) => {
    const R = t < NIGHT.open ? 0 : M * easeIO((t - NIGHT.open) / (NIGHT.end - NIGHT.open));
    return easeIO(t / NIGHT.fade) * smoothstep(R - soft, R, r);
  };
  const t0 = performance.now();
  let skipAt = 0, opened = false, raf = 0;

  function star4(x, y, R, rot) {
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = rot + i * Math.PI / 2, b = a + Math.PI / 4, c = a + Math.PI / 2;
      if (i === 0) g.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
      g.quadraticCurveTo(x + Math.cos(b) * R * 0.18, y + Math.sin(b) * R * 0.18, x + Math.cos(c) * R, y + Math.sin(c) * R);
    }
    g.fill();
  }

  function frame(now) {
    let t = (now - t0) / 1000;
    if (skipAt) t = Math.max(t, NIGHT.open + (now - skipAt) / 1000 * 1.6);
    if (t >= NIGHT.open && !opened) { opened = true; onOpen(); }
    if (t >= NIGHT.end) { stop(); done(); return; }
    g.clearRect(0, 0, W, H);
    const N = 64, grad = g.createRadialGradient(star.x, star.y, 0, star.x, star.y, M);
    for (let i = 0; i <= N; i++) grad.addColorStop(i / N, `rgba(${ink},${cover(M * i / N, t).toFixed(4)})`);
    g.globalAlpha = 1; g.fillStyle = grad; g.fillRect(0, 0, W, H);
    // de sterrenhemel licht op in de nacht, in papierkleur
    g.fillStyle = `rgb(${paper})`;
    for (const s of stars) {
      const a = cover(Math.hypot(s.x - star.x, s.y - star.y), t);
      if (a < 0.01) continue;
      g.globalAlpha = a * (0.55 + 0.25 * Math.sin(now / 900 + s.x));
      star4(s.x, s.y, s.r, 0);
    }
    // de nieuwe ster bloeit open en zakt naar haar gewone maat
    const ac = cover(0, t);
    if (bloom && t > NIGHT.born && ac > 0.01) {
      const u = t - NIGHT.born, k = easeOut(u / 0.35) * (1 + 2.6 * (1 - easeOut(u / 1.8))), R = star.r * k;
      const glow = g.createRadialGradient(star.x, star.y, 0, star.x, star.y, 10 + R * 5);
      glow.addColorStop(0, `rgba(${paper},${0.3 * ac})`); glow.addColorStop(1, `rgba(${paper},0)`);
      g.globalAlpha = 1; g.fillStyle = glow; g.fillRect(star.x - 10 - R * 5, star.y - 10 - R * 5, 20 + R * 10, 20 + R * 10);
      g.fillStyle = `rgb(${paper})`; g.globalAlpha = ac;
      star4(star.x, star.y, R, (1 - easeOut(u / 1.2)) * Math.PI / 4);
    }
    g.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  function skip() { if (!skipAt) skipAt = performance.now(); }
  function stop() { cancelAnimationFrame(raf); cv.remove(); removeEventListener('pointerdown', skip, true); removeEventListener('keydown', skip, true); }
  addEventListener('pointerdown', skip, true);
  addEventListener('keydown', skip, true);
  raf = requestAnimationFrame(frame);
  return { skip };
}

/* ---- Particle text: de titel in de Uitleg ---- */
// De letters bestaan uit puntjes in een zeshoekig raster (zoals de kern). Bij het openen spiralen ze binnen zoals de
// bollen bij de intro; de aanwijzer duwt ze opzij en kleurt ze even rood.
const ARRIVE = 1.1;   // s, binnenkomen van de puntjes
export function particleTitle(h, { reducedMotion }) {
  const cv = document.createElement('canvas');
  cv.className = 'fx-title';
  cv.setAttribute('aria-hidden', 'true');
  h.classList.add('has-fx');
  h.append(cv);
  let pts = [], g = null, W = 0, H = 0, raf = 0, running = false, pointer = null, t0 = 0;

  function build() {
    const r = h.getBoundingClientRect();
    if (!r.width) return false;
    const padX = 12, padY = 14;
    W = Math.floor(r.width + padX * 2); H = Math.floor(r.height + padY * 2);
    g = fitCanvas(cv, W, H);
    cv.style.left = `${-padX}px`; cv.style.top = `${-padY}px`;
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const o = off.getContext('2d');
    const st = getComputedStyle(h);
    o.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
    o.textBaseline = 'middle';
    o.fillText(h.textContent.trim(), padX, H / 2);
    const data = o.getImageData(0, 0, W, H).data, sp = W < 300 ? 1.9 : 2.2, out = [];
    for (let y = 0, row = 0; y < H; y += sp * 0.866, row++) {
      for (let x = (row % 2) * sp / 2; x < W; x += sp) {
        if (data[(Math.round(y) * W + Math.round(x)) * 4 + 3] > 120) {
          const a = Math.random() * TAU, d = 60 + Math.random() * W * 0.5;
          out.push({ hx: x, hy: y, sx: W / 2 + Math.cos(a) * d - x, sy: H / 2 + Math.sin(a) * d * 0.35 - y, x, y, vx: 0, vy: 0, heat: 0, delay: Math.random() * 0.3 });
        }
      }
    }
    pts = out;
    return true;
  }

  function draw(now) {
    if (!running) return;
    const t = (now - t0) / 1000, still = reducedMotion.matches;
    g.clearRect(0, 0, W, H);
    const ink = css('--ink'), red = css('--core');
    const hot = [];
    g.fillStyle = ink;
    g.beginPath();
    for (const p of pts) {
      const arrive = Math.min(1, Math.max(0, (t - p.delay) / ARRIVE));
      if (still) { p.x = p.hx; p.y = p.hy; }
      else if (arrive < 1) {
        // binnenkomen op tijd (niet op beelden): een draai naar binnen, zoals de bollen bij de intro
        const e = 1 - Math.pow(1 - arrive, 3), k = 1 - e, a = k * 1.6;
        p.x = p.hx + (p.sx * Math.cos(a) - p.sy * Math.sin(a)) * k;
        p.y = p.hy + (p.sx * Math.sin(a) + p.sy * Math.cos(a)) * k;
      } else {
        let ax = (p.hx - p.x) * 0.09, ay = (p.hy - p.y) * 0.09;
        if (pointer) {
          const dx = p.x - pointer.x, dy = p.y - pointer.y, d = Math.hypot(dx, dy);
          if (d < 34) { const f = (34 - d) / 34 * 2.6; ax += dx / (d || 1) * f; ay += dy / (d || 1) * f; p.heat = 1; }
        }
        p.vx = (p.vx + ax) * 0.78; p.vy = (p.vy + ay) * 0.78;
        p.x += p.vx; p.y += p.vy;
        p.heat *= 0.94;
      }
      if (p.heat > 0.08) { hot.push(p); continue; }
      g.moveTo(p.x + 0.85, p.y); g.arc(p.x, p.y, 0.85, 0, TAU);
    }
    g.fill();
    for (const p of hot) {
      g.fillStyle = red; g.globalAlpha = 0.35 + 0.65 * p.heat;
      g.beginPath(); g.arc(p.x, p.y, 0.95, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  }

  const local = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointermove', e => { pointer = local(e); });
  cv.addEventListener('pointerdown', e => { pointer = local(e); });
  cv.addEventListener('pointerleave', () => { pointer = null; });

  let enabled = true;
  return {
    // uit (Minimaal): gewone tekst in de titel, geen puntjes
    setEnabled(on) { enabled = on; h.classList.toggle('has-fx', on); cv.hidden = !on; if (!on) this.stop(); },
    start() {
      if (running || !enabled) return;
      if (!build()) return;
      running = true; t0 = performance.now();
      raf = requestAnimationFrame(draw);
    },
    stop() { running = false; cancelAnimationFrame(raf); pointer = null; },
  };
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
