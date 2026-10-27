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
// Rollen bij het koppelen, bewust in één richting:
//   'send'    dit toestel toont de QR-code en verstuurt zijn lijst (bewaarde snapshot op het kanaal)
//   'receive' dit toestel heeft gescand: het stuurt niets, wacht op de lijst van de verzender en neemt die over
//   'normal'  daarna houden alle gekoppelde toestellen elkaar gelijk (samenvoegen per taak)
// getState(): lokale toestand; applyState(state): samengevoegde toestand overnemen; onReceive(state): ontvangen lijst
// overnemen (vervangt de lokale); onStatus({status, lastSync, code}); onPair({role, step, ...}) voor de stappen.
const RECEIVE_TIMEOUT = 20000;

export function createSync({ getState, applyState, onReceive = applyState, onStatus = () => {}, onPair = () => {}, deviceName = '' }) {
  let code = null, key = null, topic = null, client = null, mode = 'normal';
  let brokerIdx = 0, failures = 0, attempts = 0, status = 'off', lastSync = null;
  let publishTimer = 0, firstTimer = 0, waitTimer = 0, dirty = false, generation = 0;

  const brokers = () => {
    try { const o = localStorage.getItem(BROKER_OVERRIDE_KEY); if (o) return [o]; } catch { /* geen opslag */ }
    return BROKERS;
  };
  const brokerName = url => (/hivemq/.test(url) ? 'HiveMQ' : /emqx/.test(url) ? 'EMQX' : new URL(url).host);

  function setStatus(next) {
    status = next;
    onStatus({ status, lastSync, code });
  }

  // role: 'send', 'receive' of 'normal' (gewoon opnieuw verbinden met een bewaarde code)
  async function start(newCodeValue, { role = 'normal' } = {}) {
    stop({ keepCode: false, quiet: true });
    code = normalizeCode(newCodeValue);
    if (!code) throw new Error('ongeldige code');
    try { localStorage.setItem(CODE_KEY, code); } catch { /* geen opslag */ }
    mode = role;
    const gen = ++generation;
    attempts = 0;
    setStatus('connecting');
    onPair({ role: mode, step: 'connecting' });
    [key, topic] = await Promise.all([deriveKey(code), topicFor(code)]);
    try { await loadMqtt(); } catch {
      if (gen === generation) { setStatus('offline'); onPair({ role: mode, step: 'error', reason: 'lib' }); }
      return;
    }
    if (gen !== generation) return;
    dirty = mode !== 'receive';      // een ontvanger stuurt niets voor hij iets ontvangen heeft
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
      c.subscribe([topic, topic + '/ack'], { qos: 1 }, err => {
        if (gen !== generation) return;
        if (err) { onPair({ role: mode, step: 'error', reason: 'subscribe', server: brokerName(url) }); return; }
        if (mode === 'receive') {
          onPair({ role: 'receive', step: 'waiting', server: brokerName(url) });
          clearTimeout(waitTimer);
          waitTimer = setTimeout(() => { if (mode === 'receive') onPair({ role: 'receive', step: 'timeout' }); }, RECEIVE_TIMEOUT);
          return;
        }
        // Verzender: even wachten op een bewaarde stand van eerder gekoppelde toestellen, die samenvoegen, dan versturen
        clearTimeout(firstTimer);
        firstTimer = setTimeout(() => { if (dirty || mode === 'send') publish(); }, mode === 'send' ? 800 : FIRST_SNAPSHOT_WAIT);
      });
    });
    c.on('message', (t, payload) => {
      if (gen !== generation) return;
      if (t === topic + '/ack') receiveAck(payload.toString());
      else receive(payload.toString());
    });
    const fail = () => {
      if (gen !== generation || c.dead) return;
      attempts++;
      setStatus(navigator.onLine === false ? 'offline' : 'connecting');
      onPair({ role: mode, step: 'retrying', attempts, server: brokerName(url), offline: navigator.onLine === false });
      if (++failures >= 2 && brokers().length > 1) {
        // na twee mislukte pogingen naar de reservebroker
        failures = 0;
        brokerIdx++;
        c.dead = true;
        try { c.end(true); } catch { /* al dicht */ }
        connect(gen);
      }
    };
    // MQTT.js meldt elke mislukte (her)verbinding als 'close'; een verbroken verbinding ook
    c.on('close', () => {
      if (gen !== generation || c.dead) return;
      if (status === 'online') setStatus('connecting');
      else fail();
    });
  }

  async function receive(text) {
    let remote;
    try { remote = await open(key, text); } catch { return; }        // niet van ons of beschadigd
    if (!remote || !Array.isArray(remote.tasks)) return;
    clearTimeout(firstTimer);
    lastSync = Date.now();
    if (mode === 'receive') {
      // Eerste lijst van de verzender: overnemen, bevestigen, en vanaf nu gewoon gelijk houden
      mode = 'normal';
      clearTimeout(waitTimer);
      onReceive(remote);
      dirty = false;
      setStatus('online');
      onPair({ role: 'receive', step: 'done', count: remote.tasks.length, from: remote.from || '' });
      sendAck(remote.tasks.length);
      return;
    }
    const local = getState();
    const merged = mergeStates(local, remote);
    if (!sameState(merged, local)) applyState(merged);
    // Had dit toestel iets wat de snapshot nog niet had, dan de samengevoegde stand terugsturen
    if (!sameState(merged, remote)) changed(); else dirty = false;
    setStatus('online');
  }

  async function sendAck(count) {
    if (!client?.connected) return;
    const payload = await seal(key, { ack: true, from: deviceName, count, at: Date.now() });
    client.publish(topic + '/ack', payload, { qos: 1 });
  }

  async function receiveAck(text) {
    let info;
    try { info = await open(key, text); } catch { return; }
    if (info?.ack) onPair({ role: 'send', step: 'received', count: info.count, by: info.from || '' });
  }

  function changed() {
    if (!code || mode === 'receive') return;
    dirty = true;
    clearTimeout(publishTimer);
    publishTimer = setTimeout(publish, PUBLISH_DELAY);
  }

  async function publish() {
    if (mode === 'receive') return;
    if (!client || !client.connected) { dirty = true; return; }
    const state = getState();
    const payload = await seal(key, { ...state, from: deviceName });
    client.publish(topic, payload, { qos: 1, retain: true }, err => {
      if (err) { if (mode === 'send') onPair({ role: 'send', step: 'error', reason: 'publish' }); return; }
      dirty = false;
      lastSync = Date.now();
      setStatus('online');
      if (mode === 'send') onPair({ role: 'send', step: 'ready', count: state.tasks.length });
    });
  }

  // QR-code tonen op een toestel: verzender worden (nieuwe code, of de bestaande als het al gekoppeld is)
  function send(fresh) {
    if (!code) return start(fresh, { role: 'send' });
    mode = 'send';
    if (client?.connected) { onPair({ role: 'send', step: 'connecting' }); publish(); }
    else start(code, { role: 'send' });
  }

  // Venster dicht: geen verzender meer, gewoon gelijk houden
  function endSend() { if (mode === 'send') mode = 'normal'; }

  function stop({ keepCode = false, quiet = false } = {}) {
    generation++;
    clearTimeout(publishTimer); clearTimeout(firstTimer); clearTimeout(waitTimer);
    if (client) { try { client.end(true); } catch { /* al dicht */ } client = null; }
    if (!keepCode) {
      code = null;
      try { localStorage.removeItem(CODE_KEY); } catch { /* geen opslag */ }
    }
    key = topic = null;
    mode = 'normal';
    if (!quiet) setStatus('off');
  }

  // Na een tijd in de achtergrond (gsm) meteen opnieuw verbinden en de laatste stand ophalen
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !code) return;
    if (!client || !client.connected) start(code, { role: mode });
  });
  window.addEventListener('online', () => {
    if (!code) return;
    if (client && client.connected) { setStatus('online'); if (dirty) changed(); }
    else start(code, { role: mode });
  });
  window.addEventListener('offline', () => { if (code) setStatus('offline'); });

  return {
    start, stop, changed, send, endSend,
    get code() { return code; },
    get mode() { return mode; },
    get status() { return status; },
    get lastSync() { return lastSync; },
  };
}
