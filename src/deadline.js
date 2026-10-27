/* ---- Deadlines: een vaste datum bepaalt de schil ---- */
// Datums als 'JJJJ-MM-DD' in lokale tijd. Verstreken: Nu, vandaag: Vandaag, ≤ 7 dagen: Week, ≤ 31 dagen: Maand, later: Ooit.
const DAY = 86400000;
const SHORT = new Intl.DateTimeFormat('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' });

export const isDue = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(parseDue(v).getTime());

function parseDue(due) {
  const [y, m, d] = due.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function midnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toDue(date) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function daysUntil(due, now = new Date()) {
  return Math.round((parseDue(due) - midnight(now)) / DAY);
}

export function levelForDue(due, now = new Date()) {
  const d = daysUntil(due, now);
  if (d < 0) return 1;
  if (d === 0) return 2;
  if (d <= 7) return 3;
  if (d <= 31) return 4;
  return 5;
}

// Kort en menselijk: "vandaag", "morgen", "over 5 dagen", "2 dagen te laat"; verder weg de datum zelf
export function dueLabel(due, now = new Date()) {
  const d = daysUntil(due, now);
  if (d < -1) return `${-d} dagen te laat`;
  if (d === -1) return 'gisteren, te laat';
  if (d === 0) return 'vandaag';
  if (d === 1) return 'morgen';
  if (d <= 7) return `over ${d} dagen`;
  return SHORT.format(parseDue(due)).replace(/\./g, '');
}

export const isOverdue = (due, now = new Date()) => daysUntil(due, now) < 0;
