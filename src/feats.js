/* ---- Prestaties: punten, rangen en een logboek om ze te berekenen ---- */
// Elke ster (afgevinkte taak) is 1 punt; elke prestatie geeft 10 (brons), 25 (zilver), 50 (goud) of 100 (platina).
// De punten samen bepalen je rang. Alles wordt berekend uit een eigen logboek met per afgevinkte taak het moment, de
// tijd en een paar kenmerken (deadline, herhaling, leeftijd), plus de afgeronde focusblokken en een paar gebeurtenissen.
// Gaat mee met de sync (samenvoegen = alles van beide kanten), zodat elk toestel dezelfde punten toont.
import { LANG } from './i18n.js';

const KEY = 'priority-orbit.feats.v1';
const DAY = 86400000;

export const TIERS = { bronze: 10, silver: 25, gold: 50, platinum: 100 };

const RANKS = [
  [0, 'Sterrenkijker', 'Stargazer'], [50, 'Verkenner', 'Scout'], [150, 'Navigator', 'Navigator'],
  [300, 'Piloot', 'Pilot'], [500, 'Kapitein', 'Captain'], [800, 'Astronaut', 'Astronaut'],
  [1200, 'Commandant', 'Commander'], [1800, 'Sterrenbouwer', 'Star builder'],
  [2600, 'Melkwegreiziger', 'Galaxy traveller'], [3600, 'Kosmos', 'Cosmos'],
];

export const GROUPS = [
  ['stars', 'Sterren', 'Stars'], ['pace', 'Tempo', 'Pace'], ['moments', 'Momenten', 'Moments'],
  ['deadlines', 'Deadlines', 'Deadlines'], ['rhythm', 'Ritme', 'Rhythm'], ['tidy', 'Opruimen', 'Tidying up'],
  ['focus', 'Focus', 'Focus'], ['secret', 'Geheim', 'Secret'],
];

// [id, groep, niveau, metriek, doel, naam NL, naam EN, uitleg NL, uitleg EN, geheim]
const DEFS = [
  ['stars-1', 'stars', 'bronze', 'total', 1, 'Eerste ster', 'First star', 'Vink je eerste taak af.', 'Complete your first task.'],
  ['stars-10', 'stars', 'bronze', 'total', 10, 'Tien sterren', 'Ten stars', 'Vink 10 taken af.', 'Complete 10 tasks.'],
  ['stars-25', 'stars', 'bronze', 'total', 25, 'Sterrenbeeld', 'Constellation', 'Vink 25 taken af.', 'Complete 25 tasks.'],
  ['stars-50', 'stars', 'silver', 'total', 50, 'Halve honderd', 'Half a hundred', 'Vink 50 taken af.', 'Complete 50 tasks.'],
  ['stars-100', 'stars', 'silver', 'total', 100, 'Melkweg in wording', 'Galaxy in the making', 'Vink 100 taken af.', 'Complete 100 tasks.'],
  ['stars-250', 'stars', 'gold', 'total', 250, 'Sterrenzee', 'Sea of stars', 'Vink 250 taken af.', 'Complete 250 tasks.'],
  ['stars-500', 'stars', 'gold', 'total', 500, 'Nevel', 'Nebula', 'Vink 500 taken af.', 'Complete 500 tasks.'],
  ['stars-1000', 'stars', 'platinum', 'total', 1000, 'Supernova', 'Supernova', 'Vink 1000 taken af.', 'Complete 1000 tasks.'],

  ['hour-3', 'pace', 'bronze', 'perHour', 3, 'Op dreef', 'On a roll', '3 taken binnen één uur.', '3 tasks within one hour.'],
  ['hour-5', 'pace', 'silver', 'perHour', 5, 'Op stoom', 'Full steam', '5 taken binnen één uur.', '5 tasks within one hour.'],
  ['hour-8', 'pace', 'gold', 'perHour', 8, 'Ontketend', 'Unleashed', '8 taken binnen één uur.', '8 tasks within one hour.'],
  ['day-10', 'pace', 'silver', 'perDay', 10, 'Topdag', 'Big day', '10 taken op één dag.', '10 tasks in one day.'],
  ['day-20', 'pace', 'gold', 'perDay', 20, 'Marathon', 'Marathon', '20 taken op één dag.', '20 tasks in one day.'],
  ['quick-1', 'pace', 'bronze', 'quick', 1, 'Bliksem', 'Lightning', 'Vink een taak af binnen 10 minuten na het toevoegen.', 'Complete a task within 10 minutes of adding it.'],
  ['quick-10', 'pace', 'silver', 'quick', 10, 'Donderslag', 'Thunderclap', '10 keer een taak binnen 10 minuten afgevinkt.', 'Complete 10 tasks within 10 minutes of adding them.'],

  ['now-10', 'moments', 'bronze', 'lv1', 10, 'Brandjes blussen', 'Firefighter', 'Vink 10 Nu-taken af.', 'Complete 10 Now tasks.'],
  ['now-50', 'moments', 'silver', 'lv1', 50, 'Brandweer', 'Fire brigade', 'Vink 50 Nu-taken af.', 'Complete 50 Now tasks.'],
  ['now-200', 'moments', 'gold', 'lv1', 200, 'Niets brandt nog', 'Nothing burns', 'Vink 200 Nu-taken af.', 'Complete 200 Now tasks.'],
  ['today-25', 'moments', 'bronze', 'lv2', 25, 'Dagwerk', 'Day job', 'Vink 25 Vandaag-taken af.', 'Complete 25 Today tasks.'],
  ['today-100', 'moments', 'silver', 'lv2', 100, 'Dag na dag', 'Day after day', 'Vink 100 Vandaag-taken af.', 'Complete 100 Today tasks.'],
  ['week-25', 'moments', 'bronze', 'lv3', 25, 'Weekplanner', 'Week planner', 'Vink 25 Week-taken af.', 'Complete 25 Week tasks.'],
  ['week-100', 'moments', 'silver', 'lv3', 100, 'Weekmeester', 'Week master', 'Vink 100 Week-taken af.', 'Complete 100 Week tasks.'],
  ['month-10', 'moments', 'bronze', 'lv4', 10, 'Vooruitdenker', 'Forward thinker', 'Vink 10 Maand-taken af.', 'Complete 10 Month tasks.'],
  ['month-50', 'moments', 'silver', 'lv4', 50, 'Lange adem', 'Long breath', 'Vink 50 Maand-taken af.', 'Complete 50 Month tasks.'],
  ['someday-1', 'moments', 'bronze', 'lv5', 1, 'Ooit is nu', 'Someday is now', 'Vink een Ooit-taak af.', 'Complete a Someday task.'],
  ['someday-10', 'moments', 'silver', 'lv5', 10, 'Dromen waarmaken', 'Dreams come true', 'Vink 10 Ooit-taken af.', 'Complete 10 Someday tasks.'],
  ['someday-25', 'moments', 'gold', 'lv5', 25, 'Bucketlist', 'Bucket list', 'Vink 25 Ooit-taken af.', 'Complete 25 Someday tasks.'],
  ['all-rings', 'moments', 'gold', 'allRings', 1, 'Rond de kern', 'Around the core', 'Vink op één dag een taak af van elk moment.', 'Complete a task from every moment in one day.'],

  ['due-1', 'deadlines', 'bronze', 'onTime', 1, 'Op tijd', 'On time', 'Vink een taak met deadline op tijd af.', 'Complete a task with a deadline on time.'],
  ['due-10', 'deadlines', 'silver', 'onTime', 10, 'Betrouwbaar', 'Reliable', '10 deadlines op tijd gehaald.', 'Meet 10 deadlines on time.'],
  ['due-50', 'deadlines', 'gold', 'onTime', 50, 'Klokwerk', 'Clockwork', '50 deadlines op tijd gehaald.', 'Meet 50 deadlines on time.'],
  ['due-edge', 'deadlines', 'bronze', 'edge', 1, 'Op de valreep', 'Just in time', 'Vink een taak af op de dag van de deadline zelf.', 'Complete a task on its deadline day.'],
  ['due-early', 'deadlines', 'bronze', 'early', 1, 'Ruim op tijd', 'Well ahead', 'Vink een taak af minstens 7 dagen voor de deadline.', 'Complete a task at least 7 days before its deadline.'],
  ['due-early-10', 'deadlines', 'silver', 'early', 10, 'Altijd voorop', 'Always ahead', '10 keer minstens 7 dagen voor de deadline.', '10 tasks at least 7 days before their deadline.'],
  ['due-late', 'deadlines', 'bronze', 'late', 1, 'Beter laat dan nooit', 'Better late than never', 'Vink een taak af waarvan de deadline al voorbij was.', 'Complete a task after its deadline.'],
  ['due-catchup', 'deadlines', 'silver', 'lateDay', 3, 'Inhaalslag', 'Catching up', '3 verstreken deadlines op één dag weggewerkt.', 'Clear 3 overdue tasks in one day.'],

  ['streak-3', 'rhythm', 'bronze', 'streak', 3, 'Drie op rij', 'Three in a row', '3 dagen op rij minstens één taak.', 'At least one task 3 days in a row.'],
  ['streak-7', 'rhythm', 'silver', 'streak', 7, 'Een week lang', 'A whole week', '7 dagen op rij minstens één taak.', 'At least one task 7 days in a row.'],
  ['streak-14', 'rhythm', 'gold', 'streak', 14, 'Twee weken', 'Two weeks', '14 dagen op rij minstens één taak.', 'At least one task 14 days in a row.'],
  ['streak-30', 'rhythm', 'platinum', 'streak', 30, 'Onstuitbaar', 'Unstoppable', '30 dagen op rij minstens één taak.', 'At least one task 30 days in a row.'],
  ['days-30', 'rhythm', 'silver', 'activeDays', 30, 'Vaste gast', 'Regular', 'Op 30 verschillende dagen een taak afgevinkt.', 'Complete tasks on 30 different days.'],
  ['days-100', 'rhythm', 'gold', 'activeDays', 100, 'Huisgenoot', 'Housemate', 'Op 100 verschillende dagen een taak afgevinkt.', 'Complete tasks on 100 different days.'],
  ['early-bird', 'rhythm', 'bronze', 'early7', 1, 'Vroege vogel', 'Early bird', 'Vink een taak af voor 7 uur.', 'Complete a task before 7 am.'],
  ['night-owl', 'rhythm', 'bronze', 'owl', 1, 'Nachtuil', 'Night owl', 'Vink een taak af tussen 23 en 4 uur.', 'Complete a task between 11 pm and 4 am.'],
  ['monday', 'rhythm', 'bronze', 'monday', 5, 'Maandagmotor', 'Monday engine', '5 taken op een maandag.', '5 tasks on a Monday.'],
  ['weekend', 'rhythm', 'silver', 'weekend', 5, 'Weekendkrijger', 'Weekend warrior', '5 taken in één weekend.', '5 tasks in one weekend.'],

  ['now-empty', 'tidy', 'bronze', 'ev:nuEmpty', 1, 'Kern in rust', 'Core at rest', 'Vink de laatste Nu-taak af.', 'Complete the last Now task.'],
  ['all-clear', 'tidy', 'gold', 'ev:clear', 1, 'Tabula rasa', 'Clean slate', 'Vink alle taken af tot de lijst leeg is.', 'Complete every task until the list is empty.'],
  ['old-30', 'tidy', 'bronze', 'old30', 1, 'Archeoloog', 'Archaeologist', 'Vink een taak af die al 30 dagen bestond.', 'Complete a task that was 30 days old.'],
  ['old-90', 'tidy', 'silver', 'old90', 1, 'Fossiel', 'Fossil', 'Vink een taak af die al 90 dagen bestond.', 'Complete a task that was 90 days old.'],
  ['repeat-10', 'tidy', 'bronze', 'repeat', 10, 'Ritueel', 'Ritual', 'Vink 10 herhalende taken af.', 'Complete 10 repeating tasks.'],
  ['habit-7', 'tidy', 'silver', 'habit', 7, 'Gewoonte', 'Habit', 'Vink dezelfde herhalende taak 7 keer af.', 'Complete the same repeating task 7 times.'],
  ['habit-30', 'tidy', 'gold', 'habit', 30, 'Tweede natuur', 'Second nature', 'Vink dezelfde herhalende taak 30 keer af.', 'Complete the same repeating task 30 times.'],
  ['new-sky', 'tidy', 'bronze', 'skies', 1, 'Nieuwe hemel', 'New sky', 'Begin een nieuwe hemel.', 'Start a new sky.'],

  ['focus-1', 'focus', 'bronze', 'focus', 1, 'Eerste zandloper', 'First hourglass', 'Rond een focusblok af met de zandloper.', 'Finish a focus block with the hourglass.'],
  ['focus-10', 'focus', 'silver', 'focus', 10, 'Diepe focus', 'Deep focus', 'Rond 10 focusblokken af.', 'Finish 10 focus blocks.'],
  ['focus-50', 'focus', 'gold', 'focus', 50, 'Zenmeester', 'Zen master', 'Rond 50 focusblokken af.', 'Finish 50 focus blocks.'],
  ['focus-long', 'focus', 'silver', 'focus50', 1, 'Diep werk', 'Deep work', 'Rond een blok van 50 minuten af.', 'Finish a 50 minute block.'],
  ['focus-day', 'focus', 'silver', 'focusDay', 3, 'Drie zandlopers', 'Three hourglasses', '3 focusblokken op één dag.', '3 focus blocks in one day.'],

  ['wink', 'secret', 'bronze', 'ev:wink', 1, 'Knipoog', 'Wink', 'De kern knipoogde naar je.', 'The core winked at you.', true],
  ['dave', 'secret', 'bronze', 'ev:dave', 1, 'Dave', 'Dave', 'De kern zei iets bekends.', 'The core said something familiar.', true],
  ['night-watch', 'secret', 'bronze', 'ev:night', 1, 'Nachtwake', 'Night watch', 'Orbit open tussen 3 en 4 uur.', 'Orbit open between 3 and 4 am.', true],
];

const en = LANG === 'en';
export const FEATS = DEFS.map(([id, group, tier, metric, goal, nl, enName, nlDesc, enDesc, secret = false]) => ({
  id, group, tier, metric, goal, secret, points: TIERS[tier], name: en ? enName : nl, desc: en ? enDesc : nlDesc,
}));
export const groupName = id => { const g = GROUPS.find(x => x[0] === id); return g ? (en ? g[2] : g[1]) : id; };

/* ---- Opslag en sync ---- */
const empty = () => ({ log: {}, unlocked: {}, focus: {}, ev: {} });
export function loadFeats() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') return { ...empty(), ...s }; } catch { /* geen opslag */ }
  return empty();
}
export function saveFeats(f) { try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* geen opslag */ } }
export const FEATS_KEY = KEY;

// alles van beide kanten; bij hetzelfde id het vroegste tijdstip (een prestatie haal je één keer)
export function mergeFeats(a = empty(), b = empty()) {
  const out = empty();
  for (const k of ['log', 'focus']) out[k] = { ...(b[k] || {}), ...(a[k] || {}) };
  for (const k of ['unlocked', 'ev']) {
    out[k] = { ...(a[k] || {}) };
    for (const [id, t] of Object.entries(b[k] || {})) if (Number.isFinite(t)) out[k][id] = Math.min(out[k][id] ?? t, t);
  }
  return out;
}
export const featsSig = f => f ? `${Object.keys(f.log || {}).length}:${Object.keys(f.unlocked || {}).length}:${Object.keys(f.focus || {}).length}:${Object.keys(f.ev || {}).length}` : '';

/* ---- Vastleggen ---- */
const dayStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dueEnd = due => { const [y, m, d] = due.split('-').map(Number); return new Date(y, m - 1, d, 23, 59, 59, 999).getTime(); };
const hash = s => { let h = 0; for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };

// f: 2 op tijd, 4 te laat, 8 herhalend, 16 op de deadlinedag, 32 minstens 7 dagen vooraf
export function entryFor(task, t) {
  const e = { t, lv: task.level, b: task.createdAt || 0, f: 0 };
  if (task.due) {
    const end = dueEnd(task.due);
    if (t <= end) {
      e.f |= 2;
      if (dayStart(t) === dayStart(end)) e.f |= 16;
      if (dayStart(end) - dayStart(t) >= 7 * DAY) e.f |= 32;
    } else e.f |= 4;
  }
  if (task.repeat) { e.f |= 8; e.s = hash(task.title.trim().toLowerCase()); }
  return e;
}
export function recordDone(f, task, t = Date.now()) { if (task?.id && !task.demo) f.log[task.id] = entryFor(task, t); }
export function recordEvent(f, key, t = Date.now()) { if (!f.ev[key]) f.ev[key] = t; }
export function recordFocus(f, minutes, t = Date.now()) { f.focus[String(t)] = minutes; }
// afgevinkte taken uit het archief die nog niet in het logboek staan (eerste keer, of een ouder toestel)
export function backfill(f, archive) {
  let n = 0;
  for (const a of archive) if (a.id && a.doneAt && a.level && !f.log[a.id]) { f.log[a.id] = entryFor(a, a.doneAt); n++; }
  return n;
}

/* ---- Berekenen ---- */
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
function maxPer(times, keyOf) {
  const m = new Map();
  for (const t of times) { const k = keyOf(t); m.set(k, (m.get(k) || 0) + 1); }
  return Math.max(0, ...m.values());
}

// `since`: alleen wat vanaf dat tijdstip gebeurde (de demo begint zo altijd op 0)
export function measure(f, done, { skies = 0, since = 0 } = {}) {
  const times = Object.values(done || {}).filter(t => Number.isFinite(t) && t >= since).sort((a, b) => a - b);
  const log = Object.values(f.log || {}).filter(e => e.t >= since);
  const m = { total: times.length, skies };
  // meeste taken binnen een uur (schuivend venster)
  let best = 0;
  for (let i = 0, j = 0; i < times.length; i++) { while (times[i] - times[j] > 3600000) j++; best = Math.max(best, i - j + 1); }
  m.perHour = best;
  m.perDay = maxPer(times, dayKey);
  // dagen op rij en verschillende dagen
  const days = [...new Set(times.map(dayStart))].sort((a, b) => a - b);
  m.activeDays = days.length;
  let run = 0, longest = 0, prev = 0;
  for (const d of days) { run = prev && Math.round((d - prev) / DAY) === 1 ? run + 1 : 1; longest = Math.max(longest, run); prev = d; }
  m.streak = longest;
  m.early7 = times.filter(t => { const h = new Date(t).getHours(); return h >= 4 && h < 7; }).length;
  m.owl = times.filter(t => { const h = new Date(t).getHours(); return h >= 23 || h < 4; }).length;
  m.monday = maxPer(times.filter(t => new Date(t).getDay() === 1), dayKey);
  // weekend: zaterdag en zondag samen, sleutel = de zaterdag
  m.weekend = maxPer(times.filter(t => [0, 6].includes(new Date(t).getDay())), t => dayKey(t - (new Date(t).getDay() === 0 ? DAY : 0)));
  for (let lv = 1; lv <= 5; lv++) m[`lv${lv}`] = log.filter(e => e.lv === lv).length;
  const ringsByDay = new Map();
  for (const e of log) { const k = dayKey(e.t); if (!ringsByDay.has(k)) ringsByDay.set(k, new Set()); ringsByDay.get(k).add(e.lv); }
  m.allRings = [...ringsByDay.values()].some(s => s.size >= 5) ? 1 : 0;
  m.onTime = log.filter(e => e.f & 2).length;
  m.edge = log.filter(e => e.f & 16).length;
  m.early = log.filter(e => e.f & 32).length;
  m.late = log.filter(e => e.f & 4).length;
  m.lateDay = maxPer(log.filter(e => e.f & 4).map(e => e.t), dayKey);
  m.repeat = log.filter(e => e.f & 8).length;
  const series = new Map();
  for (const e of log) if (e.s) series.set(e.s, (series.get(e.s) || 0) + 1);
  m.habit = Math.max(0, ...series.values());
  m.old30 = log.filter(e => e.b && e.t - e.b >= 30 * DAY).length;
  m.old90 = log.filter(e => e.b && e.t - e.b >= 90 * DAY).length;
  m.quick = log.filter(e => e.b && e.t - e.b >= 0 && e.t - e.b <= 10 * 60000).length;
  const focus = Object.entries(f.focus || {}).map(([t, min]) => [Number(t), min]).filter(([t]) => t >= since);
  m.focus = focus.length;
  m.focus50 = focus.some(([, min]) => min >= 50) ? 1 : 0;
  m.focusDay = maxPer(focus.map(([t]) => t), dayKey);
  for (const [k, t] of Object.entries(f.ev || {})) if (t && t >= since) m[`ev:${k}`] = 1;
  return m;
}

// voortgang per prestatie, punten en rang; `fresh` = wat net gehaald is en nog niet ontgrendeld was
export function evaluate(f, done, extra) {
  const m = measure(f, done, extra);
  const since = extra?.since || 0;
  const list = FEATS.map(d => ({ ...d, value: Math.min(d.goal, m[d.metric] || 0), at: (f.unlocked[d.id] || 0) >= since ? f.unlocked[d.id] || 0 : 0 }));
  const fresh = list.filter(x => !x.at && x.value >= x.goal);
  const earned = list.filter(x => x.at || x.value >= x.goal);
  const points = m.total + earned.reduce((s, x) => s + x.points, 0);
  let r = 0;
  while (r + 1 < RANKS.length && points >= RANKS[r + 1][0]) r++;
  const rank = { level: r + 1, name: RANKS[r][en ? 2 : 1], from: RANKS[r][0], next: RANKS[r + 1] ? { at: RANKS[r + 1][0], name: RANKS[r + 1][en ? 2 : 1] } : null };
  return { list, fresh, earned: earned.length, points, stars: m.total, rank };
}
