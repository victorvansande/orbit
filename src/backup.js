/* ---- Tweede kopie op het toestel (IndexedDB) ---- */
// Naast localStorage bewaart Orbit elke stand ook in IndexedDB. Mislukt het schrijven naar localStorage (vol,
// geblokkeerd) of raakt die kwijt, dan haalt de app bij het opstarten de taken uit deze kopie terug.

const DB = 'orbit-backup', STORE = 'state', KEY = 'main';
let dbPromise = null;

function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

// state = { tasks, gone, savedAt }
export async function mirror(state) {
  try {
    const d = await db();
    await new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(state, KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch { return false; }
}

export async function readMirror() {
  try {
    const d = await db();
    return await new Promise((resolve, reject) => {
      const req = d.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch { return null; }
}
