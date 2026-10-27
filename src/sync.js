/* ---- Synchronisatie tussen toestellen ---- */
// Eigen tussenpost op Cloudflare (map worker/): https op poort 443, dus ook bruikbaar op werk- en schoolnetwerken
// die de poorten van publieke MQTT-servers blokkeren. Live via WebSocket; lukt dat niet (sommige proxy's breken
// WebSockets), dan gewone https-verzoeken om de paar seconden.
// Orbit is een openbare site met persoonlijke taken: een synccode bepaalt het kanaal (hash) én de sleutel.
// Alles wordt in de browser versleuteld (AES-GCM); de server ziet enkel ruis.

const SERVER = 'https://orbit-sync.victorvansande.workers.dev';
const CODE_KEY = 'priority-orbit.sync.v1';
const SERVER_OVERRIDE_KEY = 'priority-orbit.server';   // alleen om lokaal te testen (bv. http://127.0.0.1:8787)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';     // zonder 0/O, 1/I/L
const GONE_DAYS = 60;                                    // zo lang onthouden we afgevinkte taken
const PUBLISH_DELAY = 400;
const POLL_MS = 4000, POLL_HIDDEN_MS = 20000;            // terugval zonder WebSocket
const PING_MS = 25000;

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
// state = { tasks: [{id, updatedAt, ...}], gone: { id: tijdstip van afvinken }, done: { id: tijdstip } }
// Per taak wint de recentste wijziging; een afgevinkte taak komt pas terug als ze nadien opnieuw gewijzigd is (ongedaan maken).
// done is het logboek voor de statistiek: alles van beide kanten, behalve taken die na het afvinken teruggezet zijn
// en alles van vóór de laatste keer dat de teller op nul ging (doneReset).
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
  const done = { ...a.done };
  for (const [id, t] of Object.entries(b.done || {})) if (Number.isFinite(t)) done[id] = Math.max(done[id] || 0, t);
  for (const t of tasks) if (done[t.id] && (t.updatedAt || 0) > done[t.id]) delete done[t.id];
  const doneReset = Math.max(a.doneReset || 0, b.doneReset || 0);
  for (const [id, t] of Object.entries(done)) if (t <= doneReset) delete done[id];
  return { tasks, gone, done, doneReset };
}

// Twee toestanden zijn gelijk als dezelfde taken met dezelfde wijzigingstijd bestaan, dezelfde taken afgevinkt zijn
// en het logboek gelijk is
export function sameState(a, b) {
  const sig = s => JSON.stringify([
    s.tasks.map(t => `${t.id}:${t.updatedAt || 0}`).sort(),
    Object.keys(s.gone || {}).sort(),
    Object.entries(s.done || {}).map(([id, t]) => `${id}:${t}`).sort(),
    s.doneReset || 0,
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

// Kanaal: eerste 16 bytes van een hash van de code (zelfde hash als vroeger bij MQTT, dus bestaande codes blijven geldig)
async function channelFor(code) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode('orbit-topic:' + code)));
  return [...hash.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// In stukken: String.fromCharCode(...bytes) loopt vast op grote lijsten (te veel argumenten)
function toB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const fromB64 = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));

async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj))));
  const out = new Uint8Array(iv.length + data.length);
  out.set(iv); out.set(data, iv.length);
  return toB64(out);
}

async function unseal(key, text) {
  const bytes = fromB64(text);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return JSON.parse(dec.decode(plain));
}

/* ---- Verbinding ---- */
// Rollen bij het koppelen, bewust in één richting:
//   'send'    dit toestel toont de QR-code en verstuurt zijn lijst
//   'receive' dit toestel heeft gescand: het stuurt niets, wacht op de lijst van de verzender en neemt die over
//   'normal'  daarna houden alle gekoppelde toestellen elkaar gelijk (samenvoegen per taak)
// getState(): lokale toestand; applyState(state): samengevoegde toestand overnemen; onReceive(state): ontvangen lijst
// overnemen (vervangt de lokale); onStatus({status, lastSync, code}); onPair({role, step, ...}) voor de stappen.
const RECEIVE_TIMEOUT = 20000;

export function createSync({ getState, applyState, onReceive = applyState, onStatus = () => {}, onPair = () => {}, onPublished = () => {}, deviceName = '' }) {
  let code = null, key = null, channel = null, mode = 'normal';
  let ws = null, transport = 'ws', version = 0, wsFailures = 0, attempts = 0;
  let status = 'off', lastSync = null, dirty = false, generation = 0;
  let publishTimer = 0, waitTimer = 0, retryTimer = 0, pollTimer = 0, pingTimer = 0, lastAckAt = Date.now();
  let pendingOk = null, changeSeq = 0, sentSeq = -1;   // welke wijziging de server bevestigt

  const base = () => {
    try { const o = localStorage.getItem(SERVER_OVERRIDE_KEY); if (o) return o.replace(/\/$/, ''); } catch { /* geen opslag */ }
    return SERVER;
  };
  const httpUrl = (suffix = '') => `${base()}/v1/${channel}${suffix}`;

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
    attempts = 0; wsFailures = 0; version = 0; transport = 'ws';
    lastAckAt = Date.now();
    setStatus('connecting');
    onPair({ role: mode, step: 'connecting' });
    [key, channel] = await Promise.all([deriveKey(code), channelFor(code)]);
    if (gen !== generation) return;
    dirty = mode !== 'receive';      // een ontvanger stuurt niets voor hij iets ontvangen heeft
    connect(gen);
  }

  function connect(gen) {
    if (gen !== generation) return;
    if (transport === 'http' || typeof WebSocket === 'undefined') { transport = 'http'; poll(gen, true); return; }
    let opened = false;
    const sock = new WebSocket(httpUrl().replace(/^http/, 'ws'));
    ws = sock;
    const openTimer = setTimeout(() => { if (!opened) { try { sock.close(); } catch { /* al dicht */ } } }, 8000);
    sock.onopen = () => {
      if (gen !== generation) return;
      opened = true;
      clearTimeout(openTimer);
      wsFailures = 0; attempts = 0;
      clearInterval(pingTimer);
      pingTimer = setInterval(() => { try { sock.send('ping'); } catch { /* dicht */ } }, PING_MS);
    };
    sock.onmessage = e => {
      if (gen !== generation || e.data === 'pong') return;
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.t === 'snap') { const first = !sock.greeted; sock.greeted = true; handleSnap(gen, msg.v, msg.d, first); }
      else if (msg.t === 'ok') published(msg.v);
      else if (msg.t === 'ack') receiveAck(msg.d);
    };
    sock.onclose = () => {
      clearTimeout(openTimer);
      clearInterval(pingTimer);
      if (gen !== generation || sock !== ws) return;
      ws = null;
      if (!opened && ++wsFailures >= 2) transport = 'http';    // WebSocket geblokkeerd: verder via gewone https
      failed(gen);
    };
  }

  // Mislukte verbinding: melden en opnieuw proberen met oplopende wachttijd
  function failed(gen) {
    attempts++;
    const offline = navigator.onLine === false;
    setStatus(offline ? 'offline' : 'connecting');
    onPair({ role: mode, step: 'retrying', attempts, offline });
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => connect(gen), Math.min(15000, 1000 * 2 ** Math.min(attempts - 1, 4)));
  }

  // Terugval: gewone https om de paar seconden
  async function poll(gen, first = false) {
    clearTimeout(pollTimer);
    if (gen !== generation) return;
    let data;
    try {
      const res = await fetch(httpUrl(), { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      data = await res.json();
    } catch {
      if (gen === generation) failed(gen);
      return;
    }
    if (gen !== generation) return;
    attempts = 0;
    if (first || data.v > version) await handleSnap(gen, data.v, data.d, first);   // first: eerste antwoord na (her)verbinden
    else if (status !== 'online') setStatus('online');
    for (const a of data.acks || []) if (a.at > lastAckAt) { lastAckAt = a.at; receiveAck(a.d); }
    pollTimer = setTimeout(() => poll(gen), document.hidden ? POLL_HIDDEN_MS : POLL_MS);
  }

  // Een stand van de server: bij (her)verbinden (eventueel leeg) en bij elke wijziging van een ander toestel
  async function handleSnap(gen, v, d, firstOfConnection) {
    if (gen !== generation) return;
    if (firstOfConnection) {
      setStatus('online');
      if (mode === 'receive') {
        if (!d) {
          onPair({ role: 'receive', step: 'waiting' });
          clearTimeout(waitTimer);
          waitTimer = setTimeout(() => { if (mode === 'receive') onPair({ role: 'receive', step: 'timeout' }); }, RECEIVE_TIMEOUT);
          return;
        }
      }
    }
    if (d) {
      version = Math.max(version, v);
      await receive(d);
    }
    // Verzender (of een toestel met eigen wijzigingen): na de eerste stand de eigen lijst versturen
    if (firstOfConnection && mode !== 'receive' && (dirty || mode === 'send')) publish();
  }

  async function receive(text) {
    let remote;
    try { remote = await unseal(key, text); } catch { return; }        // niet van ons of beschadigd
    if (!remote || !Array.isArray(remote.tasks)) return;
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
    // Had dit toestel iets wat de server nog niet had, dan de samengevoegde stand terugsturen
    if (!sameState(merged, remote)) changed();
    else if (!dirty) onPublished();          // de server heeft exact wat dit toestel heeft
    setStatus('online');
  }

  async function sendAck(count) {
    const d = await seal(key, { ack: true, from: deviceName, count, at: Date.now() });
    if (ws?.readyState === 1) ws.send(JSON.stringify({ t: 'ack', d }));
    else fetch(httpUrl('/ack'), { method: 'POST', body: JSON.stringify({ d }) }).catch(() => {});
  }

  async function receiveAck(text) {
    let info;
    try { info = await unseal(key, text); } catch { return; }
    if (info?.ack) onPair({ role: 'send', step: 'received', count: info.count, by: info.from || '' });
  }

  function changed() {
    changeSeq++;
    if (!code || mode === 'receive') return;
    dirty = true;
    clearTimeout(publishTimer);
    publishTimer = setTimeout(publish, PUBLISH_DELAY);
  }

  async function publish() {
    if (mode === 'receive' || !key) return;
    const gen = generation;
    const state = getState(), seq = changeSeq;
    const d = await seal(key, { ...state, from: deviceName });
    if (gen !== generation) return;
    pendingOk = state.tasks.length;
    sentSeq = seq;
    if (ws?.readyState === 1) { ws.send(JSON.stringify({ t: 'pub', d })); return; }
    if (transport !== 'http') { dirty = true; return; }       // WebSocket komt terug: dan verstuurt handleSnap
    try {
      const res = await fetch(httpUrl(), { method: 'PUT', body: JSON.stringify({ d }) });
      if (!res.ok) throw new Error(res.status);
      published((await res.json()).v);
    } catch {
      dirty = true;
      if (mode === 'send') onPair({ role: 'send', step: 'error', reason: 'publish' });
    }
  }

  function published(v) {
    version = Math.max(version, v || 0);
    lastSync = Date.now();
    if (sentSeq === changeSeq) { dirty = false; onPublished(); }   // niets nieuws sindsdien: alles staat op de server
    setStatus('online');
    if (mode === 'send') onPair({ role: 'send', step: 'ready', count: pendingOk ?? getState().tasks.length });
  }

  // QR-code tonen op een toestel: verzender worden (nieuwe code, of de bestaande als het al gekoppeld is)
  function send(fresh) {
    if (!code) return start(fresh, { role: 'send' });
    mode = 'send';
    onPair({ role: 'send', step: 'connecting' });
    if (status === 'online') publish();
    else start(code, { role: 'send' });
  }

  // Vorige versies op de server (noodherstel): ontcijferd, nieuwste eerst. Leeg zonder koppeling of verbinding.
  async function history() {
    if (!key || !channel) return [];
    const res = await fetch(httpUrl('/history'), { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const out = [];
    for (const h of await res.json()) {
      try {
        const state = await unseal(key, h.d);
        if (Array.isArray(state?.tasks)) out.push({ v: h.v, at: h.at || null, tasks: state.tasks, from: state.from || '' });
      } catch { /* onleesbaar: overslaan */ }
    }
    return out;
  }

  // Venster dicht: geen verzender meer, gewoon gelijk houden
  function endSend() { if (mode === 'send') mode = 'normal'; }

  function stop({ keepCode = false, quiet = false } = {}) {
    generation++;
    for (const t of [publishTimer, waitTimer, retryTimer, pollTimer]) clearTimeout(t);
    clearInterval(pingTimer);
    if (ws) { const s = ws; ws = null; try { s.close(); } catch { /* al dicht */ } }
    if (!keepCode) {
      code = null;
      try { localStorage.removeItem(CODE_KEY); } catch { /* geen opslag */ }
    }
    key = channel = null;
    mode = 'normal';
    if (!quiet) setStatus('off');
  }

  // Terug uit de achtergrond (gsm) of weer online: meteen de laatste stand ophalen
  const wake = () => {
    if (!code || document.hidden) return;
    if (transport === 'http') poll(generation);
    else if (!ws || ws.readyState > 1) { clearTimeout(retryTimer); connect(generation); }
  };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);
  window.addEventListener('offline', () => { if (code) setStatus('offline'); });

  return {
    start, stop, changed, send, endSend, history,
    get code() { return code; },
    get mode() { return mode; },
    get status() { return status; },
    get lastSync() { return lastSync; },
    get transport() { return transport; },
  };
}
