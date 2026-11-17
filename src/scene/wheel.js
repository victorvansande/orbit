import { LEVELS, iconSvg, toneNode, MOBILE_MQ } from '../core/config.js';

/* ---- Wiel: gebogen keuze tussen de vijf momenten ---- */
// Verticaal (desktop): boog langs de rechterrand, middelpunt van de cirkel rechts buiten beeld.
// Horizontaal (gsm): boog onder de scène, middelpunt onder het wiel.
const GEOM = {
  vertical:   { R: 560, arc: 70, out: 66, spacing: 96 },
  horizontal: { R: 620, arc: 30, out: 42, spacing: 80 },
};
const PILLS = {
  vertical: { w: 62, h: 48, selW: 76, selH: 54 },
  horizontal: { w: 52, h: 40, selW: 64, selH: 46 },   // gsm: compacter, de scène is de hoofdzaak
};

const N = LEVELS.length;
const clamp = i => Math.max(0, Math.min(N - 1, i));   // het wiel stopt bij Nu en Ooit (Victor, 17/11/2026: geen eindeloze cirkel)

export function createWheel(root, { onChange = () => {}, onOpen = () => {}, onHover = () => {}, onTick = () => {}, reducedMotion }) {
  const narrow = matchMedia(MOBILE_MQ);
  const list = root.querySelector('.wheel-list');
  const arcPath = root.querySelector('.wheel-arc path');
  const arcGrad = root.querySelector('#wheel-arc-grad');
  const arcFade = root.querySelector('#wheel-arc-fade');   // desktop: boog dooft uit naar boven en onder (W1)
  const handle = root.querySelector('.wheel-handle');

  // target = het gekozen moment (0..4), pos volgt met een veer; detent = laatste moment dat het midden passeerde (tikje).
  let index = 2, target = 2, pos = 2, detent = 2, quiet = false, raf = 0, drag = null;
  let wheelAcc = 0, wheelDir = 0, wheelAt = 0, wheelBack = 0, wheelBackN = 0;

  const items = LEVELS.map((lv, i) => {
    const li = document.createElement('li');
    li.className = 'wheel-item';
    li.id = 'wheel-' + lv.id;
    li.setAttribute('role', 'option');
    toneNode(li, lv);
    li.innerHTML = `<span class="wi-label">${lv.name}<svg class="wi-plus" viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M6 2v8M2 6h8"/></svg></span><span class="wi-pill">${iconSvg(lv.id, 22)}</span>`;
    li.addEventListener('click', () => {
      if (drag?.moved) return;
      if (i === index) onOpen(lv.id);
      else select(i);
    });
    li.addEventListener('pointerenter', () => onHover(lv.id));
    li.addEventListener('pointerleave', () => onHover(null));
    list.append(li);
    return li;
  });

  const orientation = () => (narrow.matches ? 'horizontal' : 'vertical');

  function layout() {
    const o = orientation();
    const box = root.getBoundingClientRect();
    let g = GEOM[o], PILL = PILLS[o];
    // liggende gsm (desktopindeling op weinig hoogte): de vijf momenten krijgen een kleinere stap en kleinere pillen,
    // zodat ze binnen de hoogte van het wiel passen (anders liepen Nu en Ooit buiten beeld)
    if (o === 'vertical' && box.height < 560) {
      const k = Math.max(0.6, Math.min(1, (box.height - 30) / (4.8 * g.spacing)));
      g = { ...g, spacing: g.spacing * k, out: g.out * (0.6 + 0.4 * k), arc: g.arc * (0.75 + 0.25 * k) };
      PILL = { w: PILL.w * (0.7 + 0.3 * k), h: PILL.h * (0.7 + 0.3 * k), selW: PILL.selW * (0.7 + 0.3 * k), selH: PILL.selH * (0.7 + 0.3 * k) };
    }
    const Ri = g.R + g.out;
    const step = g.spacing / Ri;
    let cx, cy;
    if (o === 'vertical') { cx = box.width - g.arc + g.R; cy = box.height / 2; }
    else { cx = box.width / 2; cy = box.height - g.arc + g.R; }

    items.forEach((li, i) => {
      const rel = i - pos;
      const th = rel * step;
      const x = o === 'vertical' ? cx - Ri * Math.cos(th) : cx + Ri * Math.sin(th);
      const y = o === 'vertical' ? cy + Ri * Math.sin(th) : cy - Ri * Math.cos(th);
      const rot = (o === 'vertical' ? -th : th) * 180 / Math.PI;
      const d = Math.abs(rel);
      const sel = Math.max(0, 1 - d * 1.6);           // 1 in het midden, 0 vanaf ~0,6 stap
      li.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
      li.style.opacity = Math.max(0.1, 1 - d * 0.3).toFixed(3);
      li.style.setProperty('--sel', sel.toFixed(3));
      li.style.setProperty('--pw', (PILL.w + (PILL.selW - PILL.w) * sel).toFixed(1) + 'px');
      li.style.setProperty('--ph', (PILL.h + (PILL.selH - PILL.h) * sel).toFixed(1) + 'px');
      li.classList.toggle('is-selected', i === index);
      li.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });

    // boog en handvat: op desktop een open cirkelboog, op gsm taps en uitdovend naar de randen
    if (o === 'vertical') {
      const span = Math.PI / 3;
      const pts = [];
      for (let k = 0; k <= 48; k++) {
        const th = -span + (2 * span * k) / 48;
        pts.push(`${k ? 'L' : 'M'}${(cx - g.R * Math.cos(th)).toFixed(1)} ${(cy + g.R * Math.sin(th)).toFixed(1)}`);
      }
      arcPath.setAttribute('d', pts.join(' '));
      if (arcFade) { arcFade.setAttribute('x1', '0'); arcFade.setAttribute('y1', '0'); arcFade.setAttribute('x2', '0'); arcFade.setAttribute('y2', box.height.toFixed(1)); }
    } else {
      const maxDrop = g.arc - 2;
      const halfW = Math.max(20, Math.min(cx - 16, Math.sqrt(2 * g.R * maxDrop - maxDrop * maxDrop)));
      const maxTh = Math.asin(Math.min(0.95, halfW / g.R));
      const upper = [], lower = [];
      for (let k = 0; k <= 48; k++) {
        const u = -1 + (2 * k) / 48;
        const th = u * maxTh;
        const taper = Math.pow(Math.cos((u * Math.PI) / 2), 1.35) * 0.85;
        const sin = Math.sin(th), cos = Math.cos(th);
        upper.push(`${k ? 'L' : 'M'}${(cx + (g.R + taper) * sin).toFixed(2)} ${(cy - (g.R + taper) * cos).toFixed(2)}`);
        lower.unshift(`L${(cx + (g.R - taper) * sin).toFixed(2)} ${(cy - (g.R - taper) * cos).toFixed(2)}`);
      }
      if (arcGrad) {
        arcGrad.setAttribute('x1', (cx - halfW).toFixed(1));
        arcGrad.setAttribute('y1', '0');
        arcGrad.setAttribute('x2', (cx + halfW).toFixed(1));
        arcGrad.setAttribute('y2', '0');
      }
      arcPath.setAttribute('d', `${upper.join(' ')} ${lower.join(' ')} Z`);
    }
    // merkstreepje dwars op de boog, in de kleur van het gekozen moment
    const hx = o === 'vertical' ? cx - g.R : cx;
    const hy = o === 'vertical' ? cy : cy - g.R;
    handle.style.transform = `translate(${hx.toFixed(1)}px, ${hy.toFixed(1)}px) rotate(${o === 'vertical' ? 0 : 90}deg)`;
    toneNode(handle, LEVELS[index]);
    root.dataset.orientation = o;
  }

  function animate() {
    cancelAnimationFrame(raf);
    let last = performance.now();
    const tick = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!drag?.active) {
        if (reducedMotion.matches) pos = target;
        else {
          // hooguit 0,4 stap per beeld en 26 per seconde: sneller lijkt het wiel achteruit te draaien (wagenwieleffect),
          // wat eerder op trage beelden gebeurde
          const cap = Math.min(0.4, 26 * dt);
          pos += Math.max(-cap, Math.min(cap, (target - pos) * (1 - Math.exp(-14 * dt))));
          if (Math.abs(target - pos) < 0.001) pos = target;
        }
      }
      notch();
      layout();
      if (pos !== target || drag?.active) raf = requestAnimationFrame(tick);
      else quiet = false;
    };
    raf = requestAnimationFrame(tick);
  }

  // een tikje telkens een moment het midden echt passeert: snel draaien geeft snel opeenvolgende tikjes, in de maat van wat je ziet
  function notch() {
    const d = Math.round(pos);
    if (d !== detent) { detent = d; if (!quiet) onTick(); }
  }

  function setIndex(next, silent) {
    if (next === index) return;
    index = next;
    list.setAttribute('aria-activedescendant', items[index].id);
    if (!silent) onChange(LEVELS[index].id);
  }

  // stappen ten opzichte van het huidige doel (scrollen, pijltjes); voorbij Nu of Ooit gebeurt niets
  function nudge(n) {
    const next = clamp(target + n);
    if (next === target) return;
    quiet = false;
    target = next;
    setIndex(target, false);
    animate();
  }

  function select(i, { silent = false } = {}) {
    if (i < 0) return;
    if (!silent) quiet = false;
    else if (pos === target) quiet = true;
    target = clamp(i);
    setIndex(target, silent);
    animate();
  }

  /* ---- Invoer ---- */
  // Geen vergrendeling: elk nokje van een muiswiel is één stap, een trackpad telt per 40 px (ook de uitloop),
  // dus snel draaien gaat even snel. Een losse tegengestelde uitschieter midden in snel scrollen (muiswielen en
  // trackpads geven die soms) wordt genegeerd: omkeren telt pas na een pauze of na duidelijk volgehouden tegenbeweging.
  const TRACK_STEP = 40, NOTCH = 50, BACK = 150, GAP = 160;
  root.addEventListener('wheel', e => {
    e.preventDefault();
    const now = performance.now();
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 300 : 1;
    const dx = e.deltaX * unit, dy = e.deltaY * unit;
    const v = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
    if (!v) return;
    const dir = Math.sign(v);
    if (now - wheelAt > GAP) { wheelAcc = 0; wheelBack = 0; wheelBackN = 0; wheelDir = dir; }
    wheelAt = now;
    if (dir !== wheelDir) {
      wheelBack += Math.abs(v); wheelBackN++;
      // losse uitschieter negeren; omkeren pas na 150 px tegenbeweging of een tweede nokje terug
      if (wheelBack < BACK && !(wheelBackN >= 2 && Math.abs(v) >= NOTCH)) return;
      wheelDir = dir; wheelAcc = 0;
    }
    wheelBack = 0; wheelBackN = 0;
    // muiswiel: grote sprongen (of regels/pagina's) = één stap per nokje; trackpad: optellen
    if (e.deltaMode !== 0 || Math.abs(v) >= NOTCH) { wheelAcc = 0; nudge(dir); return; }
    wheelAcc += v;
    const n = Math.trunc(wheelAcc / TRACK_STEP);
    if (n) { wheelAcc -= n * TRACK_STEP; nudge(n); }
  }, { passive: false });

  root.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, pos0: pos, moved: false, active: false, id: e.pointerId };
    quiet = false;
  });
  window.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const g = GEOM[orientation()];
    const delta = orientation() === 'vertical' ? e.clientY - drag.y : e.clientX - drag.x;
    if (!drag.active && Math.abs(delta) > 6) {
      drag.active = true; drag.moved = true;
      root.setPointerCapture?.(e.pointerId);
      animate();
    }
    if (!drag.active) return;
    pos = Math.max(-0.45, Math.min(N - 0.55, drag.pos0 - delta / g.spacing));
    target = clamp(Math.round(pos));
    setIndex(target, false);
  });
  const endDrag = () => {
    if (!drag) return;
    const wasActive = drag.active;
    drag.active = false;
    if (wasActive) animate();
    // click-event volgt na pointerup; daarna pas vrijgeven
    setTimeout(() => { drag = null; }, 0);
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  list.addEventListener('keydown', e => {
    const keys = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 };
    if (e.key in keys) { e.preventDefault(); nudge(keys[e.key]); }
    else if (e.key === 'Home') { e.preventDefault(); select(0); }
    else if (e.key === 'End') { e.preventDefault(); select(LEVELS.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(LEVELS[index].id); }
  });
  list.addEventListener('focus', () => onHover(LEVELS[index].id));
  list.addEventListener('blur', () => onHover(null));

  new ResizeObserver(() => layout()).observe(root);
  narrow.addEventListener('change', layout);
  list.setAttribute('aria-activedescendant', items[index].id);
  layout();

  return {
    get level() { return LEVELS[index].id; },
    setLevel(level) { select(LEVELS.findIndex(l => l.id === level), { silent: true }); },
  };
}
