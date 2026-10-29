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

/* ---- Spotlicht bij afvinken: alles even donker, behalve de nieuwe ster ---- */
// Dezelfde zachte cirkel als bij het laden, maar omgekeerd: net voor de nieuwe ster verschijnt, trekt een donkere
// sluier (licht in het donker) zich zacht samen tot een cirkel rond de plek van de ster; die blijft even staan terwijl
// de ster opbloeit, en gaat dan weer open tot buiten beeld. point() geeft de plek van de ster (die kan meeschuiven),
// bornAt het moment waarop ze verschijnt. Raakt niets aan: klikken gaat gewoon door.
const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export function spotlight({ point, bornAt, dark }) {
  const cv = document.createElement('canvas');
  cv.className = 'fx-spot';
  cv.setAttribute('aria-hidden', 'true');
  document.body.append(cv);
  const W = innerWidth, H = innerHeight, g = fitCanvas(cv, W, H);
  const ink = css('--ink'), A = dark ? 0.7 : 0.8;
  const CLOSE = 0.75, HOLD_AFTER = 1.15, OPEN = 1.0, R0 = 96, FEATHER = 84;
  const start = bornAt - CLOSE * 1000 * 0.8;           // de cirkel is bijna dicht als de ster verschijnt
  const openAt = bornAt + HOLD_AFTER * 1000;
  const maxR = Math.hypot(W, H) * 1.05;
  let raf = 0, done = false;
  function frame(now) {
    const p = point();
    if (!p || now > openAt + OPEN * 1000) { stop(); return; }
    let R, a;
    if (now < start) { raf = requestAnimationFrame(frame); return; }
    if (now < start + CLOSE * 1000) {
      const e = easeInOut((now - start) / (CLOSE * 1000));
      R = maxR + (R0 - maxR) * e; a = A * e;
    } else if (now < openAt) {
      // even stilstaan, met een heel zachte ademhaling rond de ster
      R = R0 * (1 + 0.05 * Math.sin((now - start) / 260)); a = A;
    } else {
      const e = easeInOut((now - openAt) / (OPEN * 1000));
      R = R0 + (maxR - R0) * e; a = A * (1 - e * e);
    }
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    g.globalAlpha = a;
    g.fillStyle = ink;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-out';
    const grad = g.createRadialGradient(p.x, p.y, Math.max(0, R - FEATHER), p.x, p.y, R);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(frame);
  }
  function stop() { if (done) return; done = true; cancelAnimationFrame(raf); cv.remove(); }
  raf = requestAnimationFrame(frame);
  return { stop, get active() { return !done; } };
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
    const lh = 15;
    for (let row = 0, i = 0; row * lh < H + lh; row++) {
      let x = -((row * 41) % 90);
      while (x < W) {
        const word = `${words[(i++ * 7 + row) % words.length]}  ✦  `;
        const w = g.measureText(word).width, y = row * lh + 8;
        const d = Math.hypot(Math.max(0, Math.abs(x + w / 2 - lamp.x) - w / 2), y - lamp.y), lit = Math.max(0, 1 - d / 110);
        g.globalAlpha = 0.06 + 0.55 * lit * lit;
        g.fillText(word, x, y);
        x += w;
      }
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
