'use strict';

(() => {
  /* ---- Config (enige bron van waarheid) ---- */
  // ring: straal van de gestippelde ring, orbit: baanstraal van de bolletjes (px in de 390-stage)
  const LEVELS = [
    { id: 1, name: 'Nu',      ring: 38,  orbit: 24,  period: 1.1, color: '#FF453A', size: 7,   tail: 3 },
    { id: 2, name: 'Vandaag', ring: 72,  orbit: 72,  period: 2.8, color: '#FF9F0A', size: 6,   tail: 2 },
    { id: 3, name: 'Week',    ring: 106, orbit: 106, period: 7,   color: '#D9C25B', size: 5.5, tail: 2 },
    { id: 4, name: 'Maand',   ring: 140, orbit: 140, period: 16,  color: '#64B5C8', size: 5,   tail: 1 },
    { id: 5, name: 'Ooit',    ring: 174, orbit: 174, period: 38,  color: '#5E8BD6', size: 5,   tail: 1 },
  ];
  const LEVEL_BY_ID = new Map(LEVELS.map(l => [l.id, l]));
  const URGENT_LEVEL = 1;
  const DEFAULT_LEVEL = 3;

  const STAGE = 390;
  const GLOW = 0.35;                 // glow-blur = GLOW * 10 px, alleen op het hoofd
  const PROFILE = [[0, -300], [38, -200], [72, -125], [106, -70], [140, -30], [174, 0]]; // [straal, z]
  const TIP_Z = PROFILE[0][1];

  const RING_GAP = 8, RING_OPACITY = 0.38, CORE_OPACITY = 0.55;
  const TAIL_GAP = 7, TAIL_MAX_OPACITY = 0.45, TAIL_SHRINK = 0.18;
  const MERIDIANS = 8, MERIDIAN_GAP = 14, MERIDIAN_COLOR = '#EBEBF5', MERIDIAN_OPACITY = 0.14;

  const STORAGE_KEY = 'priority-orbit.tasks.v1';
  const CHECK_DONE_MS = 430;         // 140 ms blauw zien + 280 ms vervagen + marge

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- Helpers ---- */
  const $ = id => document.getElementById(id);

  function el(tag, cls, vars) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (vars) for (const k in vars) n.style.setProperty(k, vars[k]);
    return n;
  }

  const px = v => v.toFixed(2) + 'px';

  function depthAt(r) {
    if (r <= PROFILE[0][0]) return PROFILE[0][1];
    for (let i = 1; i < PROFILE.length; i++) {
      const [r1, z1] = PROFILE[i];
      if (r <= r1) {
        const [r0, z0] = PROFILE[i - 1];
        return z0 + (r - r0) / (r1 - r0) * (z1 - z0);
      }
    }
    return PROFILE[PROFILE.length - 1][1];
  }

  function uid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  /* ---- Opslag ---- */
  const isTask = t => t && typeof t.id === 'string' && typeof t.title === 'string'
    && LEVEL_BY_ID.has(t.level) && typeof t.createdAt === 'number';

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return null;
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data.filter(isTask) : null;
    } catch {
      return null;
    }
  }

  function saveTasks() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch { /* opslag geblokkeerd */ }
  }

  function demoTasks() {
    const demo = [
      [1, 'Huur overschrijven'], [1, 'Offerte terugsturen'],
      [2, 'Boodschappen doen'], [2, 'Planten water geven'],
      [3, 'Fiets laten herstellen'], [3, 'Cadeau voor zaterdag kopen'], [3, 'Was opvouwen'],
      [4, 'Tandarts bellen'], [4, 'Belastingaangifte invullen'],
      [5, 'Japans leren'], [5, 'Zolder opruimen'],
    ];
    const now = Date.now();
    return demo.map(([level, title], i) => ({ id: uid(), title, level, createdAt: now - (demo.length - i) * 1000 }));
  }

  let tasks = loadTasks() ?? demoTasks();
  saveTasks();
  const completing = new Set();

  /* ---- Elementen ---- */
  const scene = $('scene'), sceneWrap = $('scene-wrap');
  const ringsLayer = $('rings'), meridianLayer = $('meridians'), orbitLayer = $('orbits');
  const summary = $('summary'), legend = $('legend'), list = $('list');
  const viewToggle = $('view-toggle');
  const sheet = $('sheet'), form = $('task-form'), titleInput = $('task-title');
  const confirmBtn = $('confirm'), prio = $('prio');

  /* ---- Statische scène: ringen, meridianen (eenmalig) ---- */
  function point(cls, x, y, z, color, opacity) {
    return el('span', cls, { '--x': px(x), '--y': px(y), '--z': z.toFixed(2), '--c': color, '--o': opacity });
  }

  function buildRings() {
    const frag = document.createDocumentFragment();
    for (const lv of LEVELS) {
      const n = Math.round(2 * Math.PI * lv.ring / RING_GAP);
      const z = depthAt(lv.ring);
      const o = lv.id === URGENT_LEVEL ? CORE_OPACITY : RING_OPACITY;
      for (let i = 0; i < n; i++) {
        const a = i / n * 2 * Math.PI;
        frag.append(point('pt', lv.ring * Math.cos(a), lv.ring * Math.sin(a), z, lv.color, o));
      }
    }
    ringsLayer.append(frag);
  }

  function buildMeridians() {
    // Monsterpunten langs het profiel van rand naar tip, elke MERIDIAN_GAP px 3D-booglengte
    const path = PROFILE.slice().reverse();
    const samples = [];
    let carry = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const [r0, z0] = path[i], [r1, z1] = path[i + 1];
      const len = Math.hypot(r1 - r0, z1 - z0);
      for (let s = carry; s < len; s += MERIDIAN_GAP) {
        const t = s / len;
        samples.push([r0 + t * (r1 - r0), z0 + t * (z1 - z0)]);
      }
      carry = (carry - len) % MERIDIAN_GAP;
      if (carry < 0) carry += MERIDIAN_GAP;
    }
    // Laatste stip niet op de rode tip laten vallen
    while (samples.length && samples[samples.length - 1][0] < 4) samples.pop();

    const frag = document.createDocumentFragment();
    for (let m = 0; m < MERIDIANS; m++) {
      const a = m / MERIDIANS * 2 * Math.PI;
      const cos = Math.cos(a), sin = Math.sin(a);
      for (const [r, z] of samples) {
        frag.append(point('pt meridian', r * cos, r * sin, z, MERIDIAN_COLOR, MERIDIAN_OPACITY));
      }
    }
    meridianLayer.append(frag);
  }

  /* ---- Bewegende taakbolletjes (bij elke wijziging opnieuw) ---- */
  function buildOrbits() {
    const frag = document.createDocumentFragment();
    for (const lv of LEVELS) {
      const own = tasks.filter(t => t.level === lv.id);
      const z = depthAt(lv.orbit).toFixed(2);
      const step = TAIL_GAP / lv.orbit * 180 / Math.PI; // graden per staartstip
      own.forEach((task, i) => {
        const orbit = el('div', 'orbit', { '--z': z });
        const rotor = el('div', 'rotor', {
          '--period': lv.period + 's',
          '--delay': (-(i / own.length) * lv.period).toFixed(3) + 's',
        });
        for (let k = lv.tail; k >= 1; k--) {
          rotor.append(el('span', 'tail', {
            '--c': lv.color,
            '--r': lv.orbit + 'px',
            '--a': (-k * step).toFixed(2) + 'deg',
            '--s': px(lv.size * (1 - k * TAIL_SHRINK)),
            '--o': (TAIL_MAX_OPACITY * (1 - (k - 1) / lv.tail)).toFixed(3),
          }));
        }
        rotor.append(el('span', 'head', {
          '--c': lv.color,
          '--r': lv.orbit + 'px',
          '--s': lv.size + 'px',
          '--glow': (GLOW * 10) + 'px',
        }));
        orbit.append(rotor);
        frag.append(orbit);
      });
    }
    orbitLayer.replaceChildren(frag);
  }

  /* ---- Samenvatting, legende, lijst ---- */
  const countBy = level => tasks.reduce((n, t) => n + (t.level === level), 0);

  function renderSummary() {
    const total = tasks.length;
    const urgent = countBy(URGENT_LEVEL);
    const text = total === 0
      ? 'Geen taken'
      : `${urgent ? urgent + ' dringend' : 'Niets dringend'} · ${total} ${total === 1 ? 'taak' : 'taken'}`;
    summary.textContent = text;
    const parts = LEVELS.map(lv => `${countBy(lv.id)} ${lv.name}`).join(', ');
    scene.setAttribute('aria-label', total ? `Orbit: ${parts}` : 'Orbit: geen taken');
    scene.classList.toggle('has-now', urgent > 0);
  }

  const legendCells = new Map();
  function buildLegend() {
    for (const lv of LEVELS) {
      const li = el('li', '', { '--c': lv.color });
      const dot = el('span', 'dot');
      const count = el('span', 'count');
      const name = el('span', 'name');
      name.textContent = lv.name;
      li.append(dot, count, name);
      legend.append(li);
      legendCells.set(lv.id, { li, count });
    }
  }

  function renderLegend() {
    for (const lv of LEVELS) {
      const n = countBy(lv.id);
      const { li, count } = legendCells.get(lv.id);
      count.textContent = n;
      li.classList.toggle('zero', n === 0);
    }
  }

  const CHECK_SVG = '<svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true"><path d="M2.5 7.4l3 3 6-6.8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function renderList() {
    const sorted = tasks.slice().sort((a, b) => a.level - b.level || a.createdAt - b.createdAt);
    const frag = document.createDocumentFragment();
    if (!sorted.length) {
      const li = el('li', 'empty');
      li.textContent = 'Niets meer te doen.';
      frag.append(li);
    }
    for (const t of sorted) {
      const lv = LEVEL_BY_ID.get(t.level);
      const li = el('li', completing.has(t.id) ? 'row done' : 'row');
      li.dataset.id = t.id;

      const check = el('button', 'check');
      check.type = 'button';
      check.setAttribute('aria-label', `Markeer “${t.title}” als klaar`);
      const ring = el('span', 'check-ring');
      ring.innerHTML = CHECK_SVG;
      check.append(ring);

      const body = el('div', 'row-body');
      const title = el('span', 'row-title');
      title.textContent = t.title;
      const level = el('span', 'row-level', { '--c': lv.color });
      level.append(el('i'), document.createTextNode(lv.name));
      body.append(title, level);

      li.append(check, body);
      frag.append(li);
    }
    list.replaceChildren(frag);
  }

  function render() {
    buildOrbits();
    renderSummary();
    renderLegend();
    renderList();
  }

  /* ---- Afvinken ---- */
  list.addEventListener('click', e => {
    const btn = e.target.closest('.check');
    if (!btn) return;
    const row = btn.closest('.row');
    const id = row.dataset.id;
    if (completing.has(id)) return;
    completing.add(id);
    row.classList.add('done');
    btn.disabled = true;
    setTimeout(() => {
      completing.delete(id);
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      render();
    }, reducedMotion.matches ? 150 : CHECK_DONE_MS);
  });

  /* ---- Segmented controls ---- */
  function syncSegmented(group) {
    const inputs = [...group.querySelectorAll('input')];
    group.style.setProperty('--index', Math.max(0, inputs.findIndex(i => i.checked)));
  }

  viewToggle.addEventListener('change', e => {
    scene.dataset.view = e.target.value;
    syncSegmented(viewToggle);
  });

  function buildPrio() {
    for (const lv of LEVELS) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'level';
      input.id = 'level-' + lv.id;
      input.value = lv.id;
      const span = document.createElement('span');
      span.textContent = lv.name;
      label.append(input, span);
      prio.append(label);
    }
    prio.addEventListener('change', () => syncSegmented(prio));
  }

  function setPrio(level) {
    $('level-' + level).checked = true;
    syncSegmented(prio);
  }

  /* ---- Nieuwe taak (bottom sheet) ---- */
  let closeTimer = 0;

  function openSheet() {
    clearTimeout(closeTimer);
    sheet.classList.remove('closing');
    form.reset();
    setPrio(DEFAULT_LEVEL);
    updateConfirm();
    sheet.showModal();
    titleInput.focus();
  }

  function closeSheet() {
    if (!sheet.open || sheet.classList.contains('closing')) return;
    if (reducedMotion.matches) { sheet.close(); return; }
    sheet.classList.add('closing');
    closeTimer = setTimeout(() => {
      sheet.close();
      sheet.classList.remove('closing');
    }, 250);
  }

  function updateConfirm() {
    confirmBtn.disabled = titleInput.value.trim() === '';
  }

  $('add').addEventListener('click', openSheet);
  $('cancel').addEventListener('click', closeSheet);
  titleInput.addEventListener('input', updateConfirm);

  sheet.addEventListener('cancel', e => { e.preventDefault(); closeSheet(); });
  sheet.addEventListener('click', e => {
    if (e.target !== sheet) return;
    const r = sheet.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) closeSheet();
  });
  sheet.addEventListener('close', () => $('add').focus());

  form.addEventListener('submit', e => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    const level = Number(form.elements.level.value) || DEFAULT_LEVEL;
    tasks.push({ id: uid(), title, level, createdAt: Date.now() });
    saveTasks();
    render();
    closeSheet();
  });

  /* ---- Schalen naar containerbreedte ---- */
  new ResizeObserver(([entry]) => {
    sceneWrap.style.setProperty('--fit', (entry.contentRect.width / STAGE).toFixed(4));
  }).observe(sceneWrap);

  /* ---- Start ---- */
  $('core-layer').style.setProperty('--z', TIP_Z); // kern en tip erven de diepte van de punt
  buildRings();
  buildMeridians();
  buildLegend();
  buildPrio();
  syncSegmented(viewToggle);
  render();
})();
