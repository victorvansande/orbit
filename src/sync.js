/* ---- Synchronisatie tussen toestellen ---- */
// Zelfde aanpak als streep en Operatie-Erfpacht: MQTT over WSS naar publieke brokers (HiveMQ, EMQX als reserve)
// met een "retained" snapshot, zodat een toestel bij verbinden meteen de laatste stand krijgt.
// Verschil: Orbit is een openbare site met persoonlijke taken. Daarom bepaalt een synccode het kanaal én
// versleutelt de app alles in de browser (AES-GCM, sleutel afgeleid van de code). De broker ziet enkel ruis.

const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
const CODE_KEY = 'priority-orbit.sync.v1';
const BROKER_OVERRIDE_KEY = 'priority-orbit.broker';   // alleen om lokaal te testen
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';     // zonder 0/O, 1/I/L
const GONE_DAYS = 60;                                    // zo lang onthouden we afgevinkte taken
const PUBLISH_DELAY = 400;
const FIRST_SNAPSHOT_WAIT = 1500;

const enc = new TextEncoder(), dec = new TextDecoder();

/* ---- Code ---- */
export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map(b => ALPHABET[b % ALPHABET.length]).join('');
  return chars.match(/.{4}/g).join('-');
}

export function normalizeCode(input) {
  const chars = String(input || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (chars.length !== 16 || [...chars].some(c => !ALPHABET.includes(c))) return null;
  return chars.match(/.{4}/g).join('-');
}

export function savedCode() {
  try { return normalizeCode(localStorage.getItem(CODE_KEY)); } catch { return null; }
}

/* ---- Samenvoegen ---- */
// state = { tasks: [{id, updatedAt, ...}], gone: { id: tijdstip van afvinken } }
// Per taak wint de recentste wijziging; een afgevinkte taak komt pas terug als ze nadien opnieuw gewijzigd is (ongedaan maken).
export function mergeStates(a, b) {
  const gone = { ...a.gone };
  for (const [id, t] of Object.entries(b.gone || {})) gone[id] = Math.max(gone[id] || 0, t);
  const byId = new Map();
  for (const t of [...a.tasks, ...(b.tasks || [])]) {
    const cur = byId.get(t.id);
    if (!cur || (t.updatedAt || 0) > (cur.updatedAt || 0)) byId.set(t.id, t);
  }
  const tasks = [...byId.values()].filter(t => !(gone[t.id] >= (t.updatedAt || 0)));
  const limit = Date.now() - GONE_DAYS * 86400000;
  for (const [id, t] of Object.entries(gone)) if (t < limit) delete gone[id];
  return { tasks, gone };
}

// Twee toestanden zijn gelijk als dezelfde taken met dezelfde wijzigingstijd bestaan en dezelfde taken afgevinkt zijn
export function sameState(a, b) {
  const sig = s => JSON.stringify([
    s.tasks.map(t => `${t.id}:${t.updatedAt || 0}`).sort(),
    Object.keys(s.gone || {}).sort(),
  ]);
  return sig(a) === sig(b);
}

/* ---- Versleuteling ---- */
async function deriveKey(code) {
  const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('orbit-sync-v1'), iterations: 150000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

async function topicFor(code) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('orbit-topic:' + code)));
  return 'orbit/v1/' + [...hash.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const toB64 = bytes => btoa(String.fromCharCode(...bytes));
const fromB64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));

async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj))));
  const out = new Uint8Array(iv.length + data.length);
  out.set(iv); out.set(data, iv.length);
  return toB64(out);
}

async function open(key, text) {
  const bytes = fromB64(text);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return JSON.parse(dec.decode(plain));
}

/* ---- Bibliotheek pas laden als synchronisatie aan staat ---- */
let libPromise = null;
function loadMqtt() {
  if (window.mqtt) return Promise.resolve(window.mqtt);
  libPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL('./vendor/mqtt.min.js', import.meta.url).href;
    s.onload = () => (window.mqtt ? resolve(window.mqtt) : reject(new Error('mqtt ontbreekt')));
    s.onerror = () => { libPromise = null; reject(new Error('mqtt kon niet laden')); };
    document.head.append(s);
  });
  return libPromise;
}

/* ---- Verbinding ---- */
// getState(): huidige lokale toestand; applyState(state): toestand overnemen; onStatus({status, lastSync, code})
export function createSync({ getState, applyState, onStatus = () => {} }) {
  let code = null, key = null, topic = null, client = null;
  let brokerIdx = 0, failures = 0, status = 'off', lastSync = null;
  let publishTimer = 0, firstTimer = 0, dirty = false, generation = 0;

  const brokers = () => {
    try { const o = localStorage.getItem(BROKER_OVERRIDE_KEY); if (o) return [o]; } catch { /* geen opslag */ }
    return BROKERS;
  };

  function setStatus(next) {
    status = next;
    onStatus({ status, lastSync, code });
  }

  async function start(newCodeValue) {
    stop({ keepCode: false });
    code = normalizeCode(newCodeValue);
    if (!code) throw new Error('ongeldige code');
    try { localStorage.setItem(CODE_KEY, code); } catch { /* geen opslag */ }
    const gen = ++generation;
    setStatus('connecting');
    [key, topic] = await Promise.all([deriveKey(code), topicFor(code)]);
    try { await loadMqtt(); } catch { if (gen === generation) setStatus('offline'); return; }
    if (gen !== generation) return;
    dirty = true;
    connect(gen);
  }

  function connect(gen) {
    const list = brokers();
    const url = list[brokerIdx % list.length];
    client = window.mqtt.connect(url, {
      clientId: 'orbit-' + Math.random().toString(36).slice(2, 10),
      clean: true, connectTimeout: 6000, reconnectPeriod: 4000, keepalive: 30,
    });
    const c = client;
    c.on('connect', () => {
      if (gen !== generation) return;
      failures = 0;
      setStatus('online');
      c.subscribe(topic, { qos: 1 }, () => {
        // Komt er geen bewaarde snapshot binnen, dan zijn wij de eerste: publiceer de eigen stand
        clearTimeout(firstTimer);
        firstTimer = setTimeout(() => { if (dirty) publish(); }, FIRST_SNAPSHOT_WAIT);
      });
    });
    c.on('message', (_t, payload) => { if (gen === generation) receive(payload.toString()); });
    const fail = () => {
      if (gen !== generation) return;
      setStatus(navigator.onLine === false ? 'offline' : 'connecting');
      if (++failures >= 2 && brokers().length > 1) {
        // na twee mislukte pogingen naar de reservebroker
        failures = 0;
        brokerIdx++;
        try { c.end(true); } catch { /* al dicht */ }
        connect(gen);
      }
    };
    c.on('error', fail);
    c.on('offline', fail);
    c.on('close', () => { if (gen === generation && status === 'online') setStatus('connecting'); });
  }

  async function receive(text) {
    let remote;
    try { remote = await open(key, text); } catch { return; }        // niet van ons of beschadigd
    if (!remote || !Array.isArray(remote.tasks)) return;
    clearTimeout(firstTimer);
    const local = getState();
    const merged = mergeStates(local, remote);
    if (!sameState(merged, local)) applyState(merged);
    // Had dit toestel iets wat de snapshot nog niet had, dan sturen we de samengevoegde stand terug
    if (!sameState(merged, remote)) changed(); else dirty = false;
    lastSync = Date.now();
    setStatus('online');
  }

  function changed() {
    if (!code) return;
    dirty = true;
    clearTimeout(publishTimer);
    publishTimer = setTimeout(publish, PUBLISH_DELAY);
  }

  async function publish() {
    if (!client || !client.connected) { dirty = true; return; }
    const payload = await seal(key, getState());
    client.publish(topic, payload, { qos: 1, retain: true }, err => {
      if (err) return;
      dirty = false;
      lastSync = Date.now();
      setStatus('online');
    });
  }

  function stop({ keepCode = false } = {}) {
    generation++;
    clearTimeout(publishTimer); clearTimeout(firstTimer);
    if (client) { try { client.end(true); } catch { /* al dicht */ } client = null; }
    if (!keepCode) {
      code = null;
      try { localStorage.removeItem(CODE_KEY); } catch { /* geen opslag */ }
    }
    key = topic = null;
    setStatus('off');
  }

  // Na een tijd in de achtergrond (gsm) meteen opnieuw verbinden en de laatste stand ophalen
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !code) return;
    if (!client || !client.connected) { const c = code; start(c); }
  });
  window.addEventListener('online', () => {
    if (!code) return;
    if (client && client.connected) { setStatus('online'); if (dirty) changed(); }
    else start(code);
  });
  window.addEventListener('offline', () => { if (code) setStatus('offline'); });

  return {
    start, stop, changed,
    get code() { return code; },
    get status() { return status; },
    get lastSync() { return lastSync; },
  };
}
