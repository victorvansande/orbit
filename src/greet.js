/* ---- Begroeting door de kern ---- */
// Bij een bezoek zegt de kern iets korts, droog en vriendelijk; nooit een lange zin of een emoji. De zin hangt af van
// het moment en van je lijst. Voorrang: lang weg, iets te laat, een sterrenmijlpaal, een deadline vandaag, veel in de
// kern, maandagochtend of vrijdagmiddag, en anders het uur. Heel af en toe een knipoog naar HAL 9000.

import { LANG } from './i18n.js';

const VISIT_KEY = 'priority-orbit.visit.v1';   // {at, greetedAt, milestone}
const AWAY_MS = 3 * 86400000;
const QUIET_MS = 10 * 60000;                      // binnen 10 min na de vorige begroeting zwijgt hij (herladen)

const LINES = {
  nl: {
    away: ['Daar ben je weer. Ik heb alles netjes laten rondjes draaien.', 'Lang niet gezien. De banen draaiden gewoon door.'],
    overdue1: ['"{title}" is over tijd. Geen paniek, gewoon even doen.'],
    overdue1Anon: ['Eén taak is over tijd. Geen paniek, gewoon even doen.'],
    overdue: ['{n} taken zijn over tijd. Eén voor één.'],
    milestone: ['Ster nummer {n}. Niet slecht.', '{n} sterren aan de hemel. Mooi zo.'],
    dueToday1: ['"{title}" heeft vandaag een deadline. Ik hou het in het oog.'],
    dueToday1Anon: ['Eén taak heeft vandaag een deadline. Ik hou het in het oog.'],
    dueToday: ['{n} taken hebben vandaag een deadline. Ik hou ze in het oog.'],
    busy: ['{n} dingen in de kern. We pakken ze één voor één.', 'Druk in de kern vandaag. Eén tegelijk.'],
    monday: ['Nieuwe week. Tijd om wat sterren te verdienen.', 'Maandag. Alles staat klaar.'],
    friday: ['Bijna weekend. Wat mag er nog af?', 'Vrijdagmiddag. Nog één ster voor het weekend?'],
    empty: ['Lege banen. Geniet ervan.', 'Niets op de planning. Mooi zo.'],
    night: ['Nog wakker? Ik hou de wacht wel.', 'Late shift. Ik draai mee.', 'Het is nacht. Morgen bestaat ook.'],
    morning: ['Goeiemorgen. Koffie eerst, dan de rest.', 'Goeiemorgen. Alles draait al.', 'Goeiemorgen. Rustig beginnen mag.'],
    afternoon: ['Halfweg de dag. Alles draait nog.', 'Goeiemiddag. Nog even doorduwen?', 'Hallo daar. De banen houden het vol.'],
    evening: ['Goedenavond. Nog eentje, of voor morgen?', 'Goedenavond. Wat af is, is af.', 'Avond. De kern doet het rustig aan.'],
    calm: ['Alles draait, niets brandt.', 'Rustige hemel vandaag.'],
    egg: ['Ik kan dat wel doen, Dave.'],
    stuck: ['"{title}" ligt al {days} dagen op {level}. Vandaag de dag?', '"{title}" draait al {days} dagen rond op {level}.'],
    dusty: ['"{title}" staat al {days} dagen op Ooit. Nog nodig?', 'Maandag, tijd om op te ruimen: "{title}" wacht al {days} dagen op Ooit.'],
  },
  en: {
    away: ['There you are. I kept everything going round.', 'Long time no see. The orbits just kept turning.'],
    overdue1: ['"{title}" is overdue. No panic, just do it.'],
    overdue1Anon: ['One task is overdue. No panic, just do it.'],
    overdue: ['{n} tasks are overdue. One at a time.'],
    milestone: ['Star number {n}. Not bad.', '{n} stars in the sky. Nice.'],
    dueToday1: ['"{title}" has a deadline today. I am keeping an eye on it.'],
    dueToday1Anon: ['One task has a deadline today. I am keeping an eye on it.'],
    dueToday: ['{n} tasks have a deadline today. I am keeping an eye on them.'],
    busy: ['{n} things in the core. One at a time.', 'Busy core today. One thing at a time.'],
    monday: ['New week. Time to earn some stars.', 'Monday. Everything is ready.'],
    friday: ['Almost weekend. What else can go?', 'Friday afternoon. One more star before the weekend?'],
    empty: ['Empty orbits. Enjoy it.', 'Nothing planned. Lovely.'],
    night: ['Still up? I will keep watch.', 'Late shift. I am turning with you.', 'It is night. Tomorrow exists too.'],
    morning: ['Good morning. Coffee first, then the rest.', 'Good morning. Everything is already turning.', 'Good morning. A slow start is fine.'],
    afternoon: ['Halfway through the day. Still turning.', 'Good afternoon. One more push?', 'Hello there. The orbits are holding up.'],
    evening: ['Good evening. One more, or tomorrow?', 'Good evening. Done is done.', 'Evening. The core is taking it easy.'],
    calm: ['Everything turning, nothing burning.', 'A calm sky today.'],
    egg: ['I can do that, Dave.'],
    stuck: ['"{title}" has been on {level} for {days} days. Today the day?', '"{title}" has been circling {level} for {days} days.'],
    dusty: ['"{title}" has been on Someday for {days} days. Still needed?', 'Monday, time to tidy up: "{title}" has waited {days} days on Someday.'],
  },
};

const pick = list => list[Math.floor(Math.random() * list.length)];
const fill = (line, n) => line.replace('{n}', n);
const fillIn = (line, vars) => line.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));

// Tik op de kern: hij zegt wat er nu het meest toe doet. ctx: { late, today, stuck, next, total }
const CORE = {
  nl: {
    late: v => fillIn(v.days === 1 ? '"{title}": al {days} dag te laat.' : '"{title}": al {days} dagen te laat.', v),
    today: v => fillIn('Vandaag nog: "{title}".', v),
    stuck: v => fillIn(v.days === 1 ? '"{title}" ligt al {days} dag op {level}.' : '"{title}" ligt al {days} dagen op {level}.', v),
    next: v => fillIn('Volgende: "{title}".', v),
    calm: () => pick(['Niets dringend. Ik hou de wacht.', 'Alles onder controle. Ik kijk mee.']),
    empty: () => 'Geen taken. Ik draai gewoon wat rondjes.',
  },
  en: {
    late: v => fillIn(v.days === 1 ? '"{title}": {days} day overdue.' : '"{title}": {days} days overdue.', v),
    today: v => fillIn('Still today: "{title}".', v),
    stuck: v => fillIn(v.days === 1 ? '"{title}" has been on {level} for {days} day.' : '"{title}" has been on {level} for {days} days.', v),
    next: v => fillIn('Next up: "{title}".', v),
    calm: () => pick(['Nothing urgent. I am keeping watch.', 'All under control. I am watching.']),
    empty: () => 'No tasks. I am just doing some laps.',
  },
};
export function coreLine(ctx) {
  const C = CORE[LANG] || CORE.nl;
  if (ctx.late) return C.late(ctx.late);
  if (ctx.today) return C.today(ctx.today);
  if (ctx.stuck) return C.stuck(ctx.stuck);
  if (ctx.next) return C.next(ctx.next);
  return ctx.total ? C.calm() : C.empty();
}

function read() { try { return JSON.parse(localStorage.getItem(VISIT_KEY)) || {}; } catch { return {}; } }
function write(v) { try { localStorage.setItem(VISIT_KEY, JSON.stringify(v)); } catch { /* geen opslag */ } }

// ctx: { urgent, total, overdue, overdueTitle?, dueToday, dueTodayTitle?, stars, stuck?: {title, days, level}, dusty?: {title, days} } → zin, of '' als hij beter zwijgt (net nog begroet)
export function greeting(ctx, now = new Date()) {
  const L = LINES[LANG] || LINES.nl, visit = read(), ms = now.getTime();
  const lastAt = visit.at || 0;
  write({ ...visit, at: ms });
  if (visit.greetedAt && ms - visit.greetedAt < QUIET_MS) return '';
  const h = now.getHours(), day = now.getDay();
  let line;
  const milestone = ctx.stars > 0 && ctx.stars % 25 === 0 && visit.milestone !== ctx.stars;
  if (Math.random() < 1 / 40) line = pick(L.egg);
  else if (lastAt && ms - lastAt > AWAY_MS) line = pick(L.away);
  else if (ctx.overdue) line = ctx.overdue === 1 ? (ctx.overdueTitle ? fillIn(pick(L.overdue1), { title: ctx.overdueTitle }) : pick(L.overdue1Anon)) : fill(pick(L.overdue), ctx.overdue);
  else if (milestone) line = fill(pick(L.milestone), ctx.stars);
  else if (ctx.dueToday) line = ctx.dueToday === 1 ? (ctx.dueTodayTitle ? fillIn(pick(L.dueToday1), { title: ctx.dueTodayTitle }) : pick(L.dueToday1Anon)) : fill(pick(L.dueToday), ctx.dueToday);
  else if (ctx.stuck) line = fillIn(pick(L.stuck), ctx.stuck);
  else if (ctx.urgent >= 3) line = fill(pick(L.busy), ctx.urgent);
  else if (day === 1 && h >= 6 && h < 12) line = ctx.dusty ? fillIn(pick(L.dusty), ctx.dusty) : pick(L.monday);
  else if (day === 5 && h >= 14 && h < 19) line = pick(L.friday);
  else if (!ctx.total) line = pick(L.empty);
  else if (h < 6) line = pick(L.night);
  else if (!ctx.urgent && Math.random() < 0.35) line = pick(L.calm);
  else line = pick(h < 12 ? L.morning : h < 18 ? L.afternoon : L.evening);
  write({ ...read(), greetedAt: ms, ...(milestone ? { milestone: ctx.stars } : {}) });
  return line;
}
