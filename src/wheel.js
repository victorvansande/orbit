import { LEVELS, iconSvg, toneNode } from './config.js';

/* ---- Wiel: gebogen keuze tussen de vijf momenten ---- */
// Verticaal (desktop): boog langs de rechterrand, middelpunt van de cirkel rechts buiten beeld.
// Horizontaal (gsm): boog onder de scène, middelpunt onder het wiel.
const GEOM = {
  vertical:   { R: 560, arc: 70, out: 66, spacing: 96 },
  horizontal: { R: 620, arc: 28, out: 86, spacing: 92 },
};
const PILL = { w: 62, h: 48, selW: 76, selH: 54 };

export function createWheel(root, { onChange = () => {}, onOpen = () => {}, onHover = () => {}, reducedMotion }) {
  const narrow = matchMedia('(max-width: 999px)');
  const list = root.querySelector('.wheel-list');
  const arcPath = root.querySelector('.wheel-arc path');
  const handle = root.querySelector('.wheel-handle');

  let index = 2, pos = 2, raf = 0, drag = null, wheelAcc = 0, wheelLock = 0;

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
    const g = GEOM[o];
    const box = root.getBoundingClientRect();
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

    // boog en handvat
    const span = Math.PI / 3;
    const pts = [];
    for (let k = 0; k <= 48; k++) {
      const th = -span + (2 * span * k) / 48;
      const x = o === 'vertical' ? cx - g.R * Math.cos(th) : cx + g.R * Math.sin(th);
      const y = o === 'vertical' ? cy + g.R * Math.sin(th) : cy - g.R * Math.cos(th);
      pts.push(`${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    arcPath.setAttribute('d', pts.join(' '));
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
        pos += (index - pos) * (reducedMotion.matches ? 1 : 1 - Math.exp(-12 * dt));
        if (Math.abs(index - pos) < 0.001) pos = index;
      }
      layout();
      if (pos !== index || drag?.active) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function select(i, { silent = false } = {}) {
    const next = Math.max(0, Math.min(LEVELS.length - 1, i));
    if (next !== index) {
      index = next;
      list.setAttribute('aria-activedescendant', items[index].id);
      if (!silent) onChange(LEVELS[index].id);
    }
    animate();
  }

  /* ---- Invoer ---- */
  root.addEventListener('wheel', e => {
    e.preventDefault();
    const now = performance.now();
    wheelAcc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(wheelAcc) > 40 && now > wheelLock) {
      select(index + Math.sign(wheelAcc));
      wheelAcc = 0;
      wheelLock = now + 140;
    }
  }, { passive: false });

  root.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, pos0: pos, moved: false, active: false, id: e.pointerId };
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
    pos = Math.max(-0.45, Math.min(LEVELS.length - 0.55, drag.pos0 - delta / g.spacing));
    const near = Math.round(Math.max(0, Math.min(LEVELS.length - 1, pos)));
    if (near !== index) { index = near; list.setAttribute('aria-activedescendant', items[index].id); onChange(LEVELS[index].id); }
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
    if (e.key in keys) { e.preventDefault(); select(index + keys[e.key]); }
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
