/* ---- Statistiek: afgevinkte taken en de sterrenhemel ---- */
// Een logboek {id: tijdstip} van elke afgevinkte taak, voorgoed (het archief houdt maar 60 dagen bij). Het logboek
// gaat mee met de synchronisatie, dus elk gekoppeld toestel toont dezelfde telling en evenveel sterren.
// Per taak telt één afvinkmoment; ongedaan maken haalt ze weer weg (ook elders, zie mergeStates in sync.js).

const DONE_KEY = 'priority-orbit.done.v1';     // {id: tijdstip van afvinken}
const STARS_KEY = 'priority-orbit.stars.v2';   // {stars: [{id, x, y, s, ph}]}: één ster per afgevinkte taak
const RESET_KEY = 'priority-orbit.doneReset.v1';   // tijdstip waarop de teller op nul ging (gaat mee met de sync)
const SKIES_KEY = 'priority-orbit.skies.v1';  // [tijdstip, ...]: elke "nieuwe hemel" begint op zo'n tijdstip (gaat mee met de sync)
const VIEW_KEY = 'priority-orbit.skyview.v1'; // welke hemel dit toestel toont: 'current', 'all' of het begin van een vorige hemel
const LEGACY_KEY = 'priority-orbit.stats.v1';  // vroegere telling per dag, alleen nog om over te zetten
export const STATS_KEYS = { DONE_KEY, STARS_KEY, RESET_KEY, SKIES_KEY };

const pad = n => String(n).padStart(2, '0');
export const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function readObj(key) { try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' ? v : null; } catch { return null; } }
function writeObj(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* geen opslag */ } }

/* ---- Logboek ---- */
// 'handmatig-…' waren opvulsterren van een eenmalig consolescript (teller op 3, 28/10/2026), geen echte taken: weg ermee
export const isFiller = id => id.startsWith('handmatig-');
export const cleanDone = done => Object.fromEntries(Object.entries(done || {}).filter(([id, t]) => Number.isFinite(t) && !isFiller(id)));

// Eerste keer: opbouwen uit het archief (echte taken) en de vroegere telling per dag. Wat de telling meer had dan
// het archief nog kent (ouder dan 60 dagen), krijgt een eigen id per toestel, zodat het ook elders meetelt.
export function loadDone(archive) {
  const saved = readObj(DONE_KEY);
  if (saved) return cleanDone(saved);
  const done = {};
  for (const a of archive) if (a.doneAt) done[a.id] = a.doneAt;
  const legacy = readObj(LEGACY_KEY)?.days || {};
  const device = Math.random().toString(36).slice(2, 8);
  for (const [day, n] of Object.entries(legacy)) {
    const known = Object.values(done).filter(t => dayKey(t) === day).length;
    const [y, m, d] = day.split('-').map(Number);
    for (let i = known; i < n; i++) done[`oud-${device}-${day}-${i}`] = new Date(y, m - 1, d, 12).getTime();
  }
  saveDone(done);
  return done;
}

export const saveDone = done => writeObj(DONE_KEY, done);
export const loadReset = () => { try { return Number(localStorage.getItem(RESET_KEY)) || 0; } catch { return 0; } };
export const saveReset = t => { try { localStorage.setItem(RESET_KEY, String(t)); } catch { /* geen opslag */ } };

export const totalDone = done => Object.keys(done).length;

/* ---- Hemels ---- */
// Een nieuwe hemel wist de sterren niet: ze verdwijnen enkel van het scherm. Elke snede is een tijdstip; een ster hoort
// bij de hemel waarin haar taak afgevinkt werd. Teruggeroepen kan altijd (een vorige hemel, of alle sterren samen).
export const cleanCuts = cuts => [...new Set((Array.isArray(cuts) ? cuts : []).filter(Number.isFinite))].sort((a, b) => a - b);
export const loadCuts = () => cleanCuts(readObj(SKIES_KEY));
export const saveCuts = cuts => writeObj(SKIES_KEY, cleanCuts(cuts));
export const loadSkyView = () => { try { return localStorage.getItem(VIEW_KEY) || 'current'; } catch { return 'current'; } };
export const saveSkyView = v => { try { localStorage.setItem(VIEW_KEY, String(v)); } catch { /* geen opslag */ } };

// Alle hemels, oudste eerst: {from, to, n}; de laatste is de huidige (to = Infinity)
export function skyPeriods(done, cuts) {
  const bounds = [0, ...cleanCuts(cuts), Infinity];
  const times = Object.values(done);
  const out = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i], to = bounds[i + 1];
    out.push({ from, to, n: times.filter(t => t >= from && t < to).length });
  }
  return out;
}

// Hoort de ster van deze taak (afgevinkt op t) bij de getoonde hemel?
export function inView(t, view, cuts) {
  if (view === 'all') return true;
  const c = cleanCuts(cuts);
  if (view === 'current' || !Number.isFinite(Number(view))) return t >= (c[c.length - 1] || 0);
  const from = Number(view), next = c.find(x => x > from) ?? Infinity;
  return t >= from && t < next;
}

function perDay(done) {
  const days = {};
  for (const t of Object.values(done)) days[dayKey(t)] = (days[dayKey(t)] || 0) + 1;
  return days;
}

// Details bij de teller: vandaag, deze week (vanaf maandag), deze maand, beste dag en de eerste afgevinkte taak
export function doneSummary(done, now = new Date()) {
  const days = perDay(done);
  const today = dayKey(now);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-`;
  let week = 0, inMonth = 0, best = null;
  for (const [day, n] of Object.entries(days)) {
    const [y, m, d] = day.split('-').map(Number);
    if (new Date(y, m - 1, d) >= monday && day <= today) week += n;
    if (day.startsWith(month)) inMonth += n;
    if (!best || n > best.n || (n === best.n && day > best.day)) best = { n, day };
  }
  const times = Object.values(done);
  return { today: days[today] || 0, week, month: inMonth, best, first: times.length ? times.reduce((a, b) => Math.min(a, b)) : null };
}

/* ---- Sterrenhemel ---- */
// Coördinaten in stage-eenheden rond het midden van de scène (los van de 3D-camera: de hemel hangt erachter).
const SKY_MIN = 24, SKY_MAX = 250;     // tussen de kern en net buiten de wijzerplaat
const GAPS = [11, 9, 7.5, 6.5];         // gewenste afstand; pas bij een heel volle hemel wat dichter, nooit overlap

export function loadStars() {
  const s = readObj(STARS_KEY);
  return s && Array.isArray(s.stars) ? s : { stars: [] };
}

// Eén ster per id in het logboek. Sterren zonder geldig id (bv. van vóór het logboek) krijgen eerst een ontbrekend
// id, zodat de hemel niet verspringt; wat dan nog ontbreekt, krijgt een plek; wat overblijft, verdwijnt.
export function syncStars(sky, done) {
  const ids = Object.keys(done);
  const known = new Set(ids);
  const have = new Set(sky.stars.map(s => s.id));
  const orphans = sky.stars.filter(s => !known.has(s.id));
  let changed = false;
  for (const id of ids) {
    if (have.has(id)) continue;
    const star = orphans.shift();
    if (star) star.id = id;
    else placeStar(sky, id, null, false);
    changed = true;
  }
  if (orphans.length) {
    const drop = new Set(orphans);
    sky.stars = sky.stars.filter(s => !drop.has(s));
    changed = true;
  }
  if (changed) writeObj(STARS_KEY, sky);
  return sky;
}

// Best candidate (Mitchell): een paar willekeurige kandidaten rond de plek waar de taak uitfonkelde (niet op het pad
// zelf), en daarvan de kandidaat die het verst van alle bestaande sterren ligt. Geeft een natuurlijke, gelijkmatige
// spreiding zonder raster en zonder klonters. Lukt het niet in de buurt, dan ergens anders aan de hemel.
export function placeStar(sky, id, near, save = true, visible = null) {
  if (sky.stars.some(s => s.id === id)) return sky;
  // een nieuwe hemel: alleen de sterren die nu op het scherm staan tellen voor de spreiding
  const stars = visible ? sky.stars.filter(s => visible(s.id)) : sky.stars;
  const nearest = (x, y) => stars.reduce((m, s) => Math.min(m, Math.hypot(s.x - x, s.y - y)), Infinity);
  const inSky = (x, y) => { const r = Math.hypot(x, y); return r >= SKY_MIN && r <= SKY_MAX; };
  const pick = (gen, tries, gap) => {
    let best = null, bestD = -1;
    for (let i = 0; i < tries; i++) {
      const [x, y] = gen();
      if (!inSky(x, y)) continue;
      const d = nearest(x, y);
      if (d > bestD) { best = [x, y]; bestD = d; }
    }
    return bestD >= gap ? best : null;
  };
  const around = () => {
    const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 46;    // weg van het pad, niet te ver
    return [near[0] + Math.cos(a) * r, near[1] + Math.sin(a) * r];
  };
  const anywhere = () => {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(SKY_MIN ** 2 + Math.random() * (SKY_MAX ** 2 - SKY_MIN ** 2));
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  let spot = null;
  for (const gap of GAPS) {
    spot = (near && pick(around, 14, gap)) || pick(anywhere, 80, gap);
    if (spot) break;
  }
  if (!spot) return sky;                                  // hemel echt vol: niets meer bij
  sky.stars.push({ id, x: +spot[0].toFixed(1), y: +spot[1].toFixed(1), s: +(0.75 + Math.random() * 0.5).toFixed(2), ph: +(Math.random() * 6.28).toFixed(2) });
  if (save) writeObj(STARS_KEY, sky);
  return sky;
}

export function clearStars(sky) {
  sky.stars = [];
  writeObj(STARS_KEY, sky);
  return sky;
}

export function removeStar(sky, id) {
  const i = sky.stars.findIndex(s => s.id === id);
  if (i >= 0) { sky.stars.splice(i, 1); writeObj(STARS_KEY, sky); }
  return sky;
}
