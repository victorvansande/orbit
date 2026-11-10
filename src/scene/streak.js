// Dagen op rij in de details van de teller (Victor, 10/11/2026: "een achterliggend menutje met statistieken van wanneer de
// streak begon, wanneer ik een dag miste enzovoort, met een kleine kalender"). Bovenaan een paar regels (nu, begonnen,
// langste, laatst gemist, actieve dagen), daaronder een maandkalender in zeshoekige rasterpunten: grootte is het aantal
// afgevinkte taken die dag, de lopende reeks in inkt, oudere dagen in grafiet, vandaag rood (hol en ademend tot de eerste
// ster), een gemiste dag is een ×. De gegevens komen uit streakInfo (src/data/stats.js).
import { tx, LOCALE } from '../core/i18n.js';

const NS = 'http://www.w3.org/2000/svg';
const HEX = (() => { const p = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; p.push(`${(Math.cos(a) * 5).toFixed(2)},${(Math.sin(a) * 5).toFixed(2)}`); } return `M${p.join('L')}Z`; })();
const pad = n => String(n).padStart(2, '0');
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clean = s => s.replace(/\./g, '');
const DAY = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
const SHORT = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const LONG = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long' });
const MONTH = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });
const WEEKDAY = new Intl.DateTimeFormat(LOCALE, { weekday: 'narrow' });

export function createStreak(box) {
  const q = id => box.querySelector(`#${id}`);
  const rows = q('streak-rows'), grid = q('streak-grid'), month = q('streak-month'), prev = q('streak-prev'), next = q('streak-next');
  let info = null, view = null;

  const node = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const days = n => tx('streak.days', { n });

  function renderRows() {
    const L = info.longest;
    // vandaag nog geen ster: dat toont de kalender (hol rood zeshoekje); de data van de langste reeks op een eigen, stille regel
    const longest = () => {
      const dd = node('dd', '', days(L.n));
      dd.append(node('span', 'streak-sub', L.n === 1 ? clean(SHORT.format(L.from)) : tx('streak.range', { from: clean(SHORT.format(L.from)), to: clean(SHORT.format(L.to)) })));
      return dd;
    };
    const list = [
      [tx('streak.now'), info.current ? days(info.current) : '-'],
      [tx('streak.started'), info.start ? clean(DAY.format(info.start)) : '-'],
      [tx('streak.longest'), L ? longest() : '-'],
      [tx('streak.missed'), info.missed ? clean(DAY.format(info.missed)) : info.first ? tx('streak.never') : '-'],
      [tx('streak.active'), tx('streak.of', { n: info.active, total: info.span })],
    ];
    rows.replaceChildren(...list.flatMap(([k, v]) => [node('dt', '', k), typeof v === 'string' ? node('dd', '', v) : v]));
  }

  function renderCal(now) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstMonth = info.first ? new Date(info.first.getFullYear(), info.first.getMonth(), 1) : thisMonth;
    if (!view || view > thisMonth || view < firstMonth) view = thisMonth;
    month.textContent = MONTH.format(view);
    prev.disabled = view <= firstMonth;
    next.disabled = view >= thisMonth;
    const cells = [];
    // kolommen van maandag tot zondag (2 november 2026 is een maandag)
    for (let i = 0; i < 7; i++) cells.push(node('span', 'sw', WEEKDAY.format(new Date(2026, 10, 2 + i))));
    const lead = (view.getDay() + 6) % 7, last = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (let i = 0; i < lead; i++) cells.push(node('span', 'sc is-pad'));
    for (let d = 1; d <= last; d++) {
      const date = new Date(view.getFullYear(), view.getMonth(), d), n = info.days[keyOf(date)] || 0;
      const isToday = +date === +today, future = date > today, before = !info.first || date < info.first;
      const run = info.start && date >= info.start && date <= today;
      const cell = node('span', 'sc');
      cell.setAttribute('role', 'img');
      let label = LONG.format(date);
      if (n) { cell.classList.add('is-star'); cell.style.setProperty('--n', Math.min(4, n)); if (run) cell.classList.add('is-run'); label = tx('streak.cellN', { date: label, n }); }
      else if (isToday) { cell.classList.add('is-open'); label = tx('streak.cellOpen', { date: label }); }
      else if (future || before) cell.classList.add('is-quiet');
      else { cell.classList.add('is-miss'); label = tx('streak.cellMiss', { date: label }); }
      if (isToday) cell.classList.add('is-today');
      cell.setAttribute('aria-label', label);
      if (cell.classList.contains('is-miss')) cell.append(node('span', 'sc-x', '×'));
      else {
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '-6 -6 12 12'); svg.setAttribute('aria-hidden', 'true');
        const p = document.createElementNS(NS, 'path'); p.setAttribute('d', HEX); svg.append(p);
        cell.append(svg);
      }
      cell.append(node('span', 'sc-d', String(d)));
      cells.push(cell);
    }
    grid.replaceChildren(...cells);
    grid.setAttribute('aria-label', MONTH.format(view));
  }

  prev.addEventListener('click', () => { if (!view) return; view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCal(new Date()); });
  next.addEventListener('click', () => { if (!view) return; view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(new Date()); });

  return {
    render(newInfo, now = new Date()) {
      info = newInfo;
      box.hidden = !info.first;
      if (!info.first) return;
      renderRows();
      renderCal(now);
    },
    // details open: altijd op deze maand beginnen
    reset() { view = null; if (info?.first) renderCal(new Date()); },
  };
}
