/* ---- Statistiek: afgevinkt per dag, en de sterrenhemel ---- */
// Telling per dag die nooit verloopt (het archief houdt maar 60 dagen bij). Bij de eerste keer aangevuld uit het
// archief. Elke afgevinkte taak telt één keer per toestel, ook als ze op een ander toestel werd afgevinkt.

const STATS_KEY = 'priority-orbit.stats.v1';   // {days: {'JJJJ-MM-DD': n}}
const STARS_KEY = 'priority-orbit.stars.v2';   // {stars: [{id, x, y, s, ph}]}: één ster per afgevinkte taak, voorgoed

export const STATS_KEYS = { STATS_KEY, STARS_KEY };

const pad = n => String(n).padStart(2, '0');
export const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

function readObj(key) { try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' ? v : null; } catch { return null; } }
function writeObj(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* geen opslag */ } }

export function loadStats(archive) {
  const s = readObj(STATS_KEY);
  if (s && s.days && typeof s.days === 'object') return s;
  const fresh = { days: {} };
  for (const a of archive) if (a.doneAt) fresh.days[dayKey(a.doneAt)] = (fresh.days[dayKey(a.doneAt)] || 0) + 1;
  writeObj(STATS_KEY, fresh);
  return fresh;
}

export function countDone(stats, ts, delta = 1) {
  const k = dayKey(ts);
  const n = Math.max(0, (stats.days[k] || 0) + delta);
  if (n) stats.days[k] = n; else delete stats.days[k];
  writeObj(STATS_KEY, stats);
}

export const totalDone = stats => Object.values(stats.days).reduce((a, b) => a + b, 0);

// maandag tot zondag van deze week; null voor dagen die nog moeten komen
export function weekCounts(stats, now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return d > now && dayKey(d) !== dayKey(now) ? null : stats.days[dayKey(d)] || 0;
  });
}

export function monthCount(stats, now = new Date()) {
  const prefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-`;
  return Object.entries(stats.days).reduce((n, [k, v]) => n + (k.startsWith(prefix) ? v : 0), 0);
}

/* ---- Sterrenhemel ---- */
// Coördinaten in stage-eenheden rond het midden van de scène (los van de 3D-camera: de hemel hangt erachter).
const SKY_MIN = 24, SKY_MAX = 250;     // tussen de kern en net buiten de wijzerplaat
const GAPS = [11, 9, 7.5, 6.5];         // gewenste afstand; pas bij een heel volle hemel wat dichter, nooit overlap

export function loadStars() {
  const s = readObj(STARS_KEY);
  return s && Array.isArray(s.stars) ? s : { stars: [] };
}

// Evenveel sterren als afgevinkte taken: taken van vóór de hemel krijgen nu een plek, verspreid over de hemel
export function matchStars(sky, total) {
  let added = 0;
  while (sky.stars.length < total && added < 5000) {
    const before = sky.stars.length;
    placeStar(sky, `oud-${before}-${Date.now().toString(36)}`, null, false);
    if (sky.stars.length === before) break;         // hemel vol
    added++;
  }
  while (sky.stars.length > total) sky.stars.pop();
  writeObj(STARS_KEY, sky);
  return sky;
}

// Best candidate (Mitchell): een paar willekeurige kandidaten rond de plek waar de taak uitfonkelde (niet op het pad
// zelf), en daarvan de kandidaat die het verst van alle bestaande sterren ligt. Geeft een natuurlijke, gelijkmatige
// spreiding zonder raster en zonder klonters. Lukt het niet in de buurt, dan ergens anders aan de hemel.
export function placeStar(sky, id, near, save = true) {
  const stars = sky.stars;
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
  stars.push({ id, x: +spot[0].toFixed(1), y: +spot[1].toFixed(1), s: +(0.75 + Math.random() * 0.5).toFixed(2), ph: +(Math.random() * 6.28).toFixed(2) });
  if (save) writeObj(STARS_KEY, sky);
  return sky;
}

// Ster van een teruggezette taak weg; heeft die taak geen eigen ster (van vóór de hemel), dan een oude ster
export function removeStar(sky, id) {
  let i = sky.stars.findIndex(s => s.id === id);
  if (i < 0) i = sky.stars.findIndex(s => String(s.id).startsWith('oud-'));
  if (i >= 0) { sky.stars.splice(i, 1); writeObj(STARS_KEY, sky); }
  return sky;
}
