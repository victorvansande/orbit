/* ---- Vangnet: archief en momentopnames ---- */
// Niets verdwijnt nog zonder spoor. Afgevinkte taken gaan naar het archief (met titel, 60 dagen terug te zetten)
// en vóór elke ingreep die taken kan laten verdwijnen bewaart de app een momentopname van de hele lijst.

const ARCHIVE_KEY = 'priority-orbit.archive.v1';      // [{...taak, doneAt, by}]
const SNAP_KEY = 'priority-orbit.snapshots.v1';       // [{at, reason, tasks}]
const KEEP_DAYS = 60;
const MAX_ARCHIVE = 500;
const MAX_SNAPS = 20;

const read = (key, fallback) => {
  try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : fallback; } catch { return fallback; }
};

// Schrijven; is de opslag vol, dan eerst de oudste items laten vallen
function write(key, list) {
  for (let keep = list.length; keep >= 0; keep = keep ? Math.floor(keep * 0.7) : -1) {
    try { localStorage.setItem(key, JSON.stringify(list.slice(0, keep))); return true; } catch { /* te groot of geblokkeerd */ }
  }
  return false;
}

export const signature = tasks => tasks.map(t => `${t.id}:${t.updatedAt || 0}`).sort().join('|');

/* ---- Archief ---- */
export function loadArchive() {
  const limit = Date.now() - KEEP_DAYS * 86400000;
  return read(ARCHIVE_KEY, []).filter(a => a && typeof a.id === 'string' && typeof a.title === 'string' && a.doneAt > limit);
}

export function saveArchive(list) {
  const seen = new Set();
  const clean = list
    .sort((a, b) => b.doneAt - a.doneAt)
    .filter(a => !seen.has(a.id) && seen.add(a.id))
    .slice(0, MAX_ARCHIVE);
  write(ARCHIVE_KEY, clean);
  return clean;
}

/* ---- Momentopnames ---- */
export function loadSnapshots() {
  return read(SNAP_KEY, []).filter(s => s && typeof s.at === 'number' && Array.isArray(s.tasks));
}

// Bewaart de lijst zoals ze nu is; geeft false als er niets te bewaren valt of de laatste opname gelijk is
export function snapshot(tasks, reason) {
  const real = tasks.filter(t => !t.demo);
  if (!real.length) return false;
  const list = loadSnapshots();
  if (list[0] && signature(list[0].tasks) === signature(real)) return false;
  list.unshift({ at: Date.now(), reason, tasks: real.map(t => ({ ...t })) });
  return write(SNAP_KEY, list.slice(0, MAX_SNAPS));
}

export const lastSnapshotAt = () => loadSnapshots()[0]?.at ?? 0;
export const STORE_KEYS = { ARCHIVE_KEY, SNAP_KEY };
