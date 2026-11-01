/* ---- Legende onder de scène ("Nummers en legende", gekozen door Victor, 01/11/2026) ---- */
// De bollen van een opgelichte ring dragen een nummer op het canvas (scene.js); hier staan nummer, titel en deadline,
// op de plek van de begroeting onder de scène. Nooit over de ringen: app.js geeft mee waar de legende mag beginnen en
// hoeveel rijen er passen. Meer taken dan rijen (Victor: "wat als er echt 9 taken op de schil staan?"): de onderste rij
// vervaagt en de lijst schuift traag rij per rij omhoog, rond en rond. Minder beweging: niet schuiven, zelf scrollen.

import { toneNode, LEVEL_BY_ID } from '../core/config.js';

const HOLD_MS = 2600, HIDE_MS = 220;

export function createLegend(root, { reducedMotion }) {
  root.innerHTML = '<div class="legend-view"><ol class="legend-list"></ol></div>';
  const list = root.querySelector('.legend-list');
  let count = 0, offset = 0, lh = 20, timer = 0, hideTimer = 0, sig = '';

  function row(item) {
    const li = document.createElement('li');
    li.className = 'legend-row';
    if (item.n) {
      const num = document.createElement('span');
      num.className = 'legend-num';
      num.textContent = item.n;
      toneNode(num, LEVEL_BY_ID.get(item.level));
      li.append(num);
    }
    const title = document.createElement('span');
    title.className = 'legend-title';
    title.textContent = item.title;
    li.append(title);
    if (item.due) {
      const due = document.createElement('span');
      due.className = `legend-due${item.late ? ' is-late' : ''}`;
      due.textContent = item.due;
      li.append(due);
    }
    return li;
  }
  // te lange titels lossen rechts zacht op, zoals in de lijst
  function markLong() { for (const t of list.querySelectorAll('.legend-title')) t.classList.toggle('is-long', t.scrollWidth > t.clientWidth + 1); }
  function stopScroll() { clearInterval(timer); timer = 0; }
  function step() {
    offset++;
    list.style.transition = '';
    list.style.transform = `translateY(${-offset * lh}px)`;
  }
  // na de laatste rij staat de kopie van de eerste in beeld: ongemerkt terug naar het begin
  list.addEventListener('transitionend', () => {
    if (offset < count) return;
    offset = 0;
    list.style.transition = 'none';
    list.style.transform = 'translateY(0)';
  });

  function place({ top, left, rows, lineH }) {
    lh = lineH;
    root.style.top = `${Math.round(top)}px`;
    root.style.left = left == null ? '' : `${Math.round(left)}px`;
    root.style.setProperty('--lh', `${lineH}px`);
    root.style.setProperty('--rows', String(Math.max(1, Math.min(rows, count))));
    const scroll = count > rows;
    root.classList.toggle('is-scroll', scroll);
    root.classList.toggle('is-manual', scroll && reducedMotion.matches);
    stopScroll();
    offset = 0;
    list.style.transition = 'none';
    list.style.transform = 'translateY(0)';
    if (scroll && !reducedMotion.matches) {
      for (const li of [...list.children].slice(0, count)) { const c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); list.append(c); }
      timer = setInterval(step, HOLD_MS);
    }
  }

  return {
    show(items, where) {
      clearTimeout(hideTimer);
      const next = JSON.stringify(items);
      if (next !== sig) {
        sig = next;
        count = items.length;
        root.hidden = false;   // eerst zichtbaar maken, anders is elke breedte 0 en vervaagt een lange titel niet
        list.replaceChildren(...items.map(row));
        place(where);
        markLong();
      }
      root.hidden = false;
      requestAnimationFrame(() => root.classList.add('is-on'));
    },
    // zelfde inhoud, nieuwe plek (venster van maat veranderd, ander aanzicht)
    place(where) { if (!root.hidden && count) { const items = JSON.parse(sig || '[]'); list.replaceChildren(...items.map(row)); place(where); markLong(); } },
    hide() {
      clearTimeout(hideTimer);
      // even wachten: het wiel licht een ring maar kort op tijdens het draaien, zo knippert de legende niet
      hideTimer = setTimeout(() => {
        root.classList.remove('is-on');
        stopScroll();
        sig = '';
        hideTimer = setTimeout(() => { root.hidden = true; }, 300);
      }, HIDE_MS);
    },
    get visible() { return !root.hidden && root.classList.contains('is-on'); },
  };
}
