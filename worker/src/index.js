/* ---- Orbit sync: eigen tussenpost op Cloudflare ---- */
// Vervangt de publieke MQTT-servers (poort 8884/8084, vaak geblokkeerd op werk- en schoolnetwerken).
// Alles loopt over https (poort 443). De server ziet enkel versleutelde tekst: de sleutel zit in de synccode,
// die nooit de browser verlaat. Eén Durable Object per kanaal (het kanaal is een hash van de code).
//
// GET    /v1/<kanaal>         WebSocket (live) of JSON {v, d, acks} (terugval via gewone https)
// PUT    /v1/<kanaal>         body {d}: nieuwe versleutelde lijst bewaren en doorsturen → {v}
// POST   /v1/<kanaal>/ack     body {d}: versleutelde ontvangstbevestiging doorsturen
// GET    /v1/<kanaal>/history  vorige versies [{v, at, d}] (versleuteld), voor noodherstel in de app
// WebSocket-berichten: van server {t:'snap', v, d} en {t:'ack', d}; van client {t:'pub', d} → {t:'ok', v} en {t:'ack', d}

const MAX_BYTES = 512 * 1024;     // ruim genoeg voor duizenden taken
const HISTORY = 20;               // vorige versies blijven bewaard (versleuteld), voor noodherstel
const ACK_TTL = 10 * 60 * 1000;
const ALLOWED_ORIGINS = ['https://victorvansande.github.io'];
const CHANNEL = /^[0-9a-f]{32}$/;

function cors(request) {
  const origin = request.headers.get('Origin') || '';
  const ok = ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (data, request, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(request) } });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, app: 'orbit-sync' }, request);
    const m = url.pathname.match(/^\/v1\/([^/]+)(\/ack|\/history)?$/);
    if (!m || !CHANNEL.test(m[1])) return json({ error: 'onbekend kanaal' }, request, 404);
    const stub = env.CHANNELS.get(env.CHANNELS.idFromName(m[1]));
    const res = await stub.fetch(request);
    if (res.status === 101) return res;              // WebSocket: headers niet aanpassen
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors(request))) out.headers.set(k, v);
    return out;
  },
};

export class Channel {
  constructor(state) {
    this.state = state;
    // Hou-me-wakker zonder het object te wekken: de runtime antwoordt zelf op "ping"
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async current() {
    return (await this.state.storage.get('snap')) || { v: 0, d: null };
  }

  async store(d) {
    const prev = await this.current();
    const next = { v: prev.v + 1, d, at: Date.now() };
    const history = (await this.state.storage.get('history')) || [];
    if (prev.d) history.unshift({ v: prev.v, d: prev.d, at: prev.at });
    await this.state.storage.put({ snap: next, history: history.slice(0, HISTORY) });
    return next;
  }

  async acks() {
    const list = (await this.state.storage.get('acks')) || [];
    return list.filter(a => Date.now() - a.at < ACK_TTL);
  }

  async addAck(d) {
    const list = [{ d, at: Date.now() }, ...(await this.acks())].slice(0, 10);
    await this.state.storage.put('acks', list);
  }

  broadcast(message, except = null) {
    const text = JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(text); } catch { /* verbinding al weg */ }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const isAck = url.pathname.endsWith('/ack');
    if (url.pathname.endsWith('/history')) {
      if (request.method !== 'GET') return Response.json({ error: 'niet toegestaan' }, { status: 405 });
      const snap = await this.current();
      const history = (await this.state.storage.get('history')) || [];
      const list = snap.d ? [{ v: snap.v, at: snap.at || null, d: snap.d }, ...history] : history;
      return Response.json(list, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1]);
      const snap = await this.current();
      pair[1].send(JSON.stringify({ t: 'snap', v: snap.v, d: snap.d }));
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (request.method === 'GET') {
      const snap = await this.current();
      return Response.json({ v: snap.v, d: snap.d, acks: await this.acks() }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (request.method === 'PUT' || (request.method === 'POST' && isAck)) {
      const body = await request.text();
      if (body.length > MAX_BYTES) return Response.json({ error: 'te groot' }, { status: 413 });
      let d;
      try { d = JSON.parse(body).d; } catch { return Response.json({ error: 'ongeldig' }, { status: 400 }); }
      if (typeof d !== 'string' || !d) return Response.json({ error: 'ongeldig' }, { status: 400 });
      if (isAck) {
        await this.addAck(d);
        this.broadcast({ t: 'ack', d });
        return new Response(null, { status: 204 });
      }
      const snap = await this.store(d);
      this.broadcast({ t: 'snap', v: snap.v, d });
      return Response.json({ v: snap.v });
    }

    return Response.json({ error: 'niet toegestaan' }, { status: 405 });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_BYTES) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (typeof msg?.d !== 'string' || !msg.d) return;
    if (msg.t === 'pub') {
      const snap = await this.store(msg.d);
      ws.send(JSON.stringify({ t: 'ok', v: snap.v }));
      this.broadcast({ t: 'snap', v: snap.v, d: msg.d }, ws);
    } else if (msg.t === 'ack') {
      await this.addAck(msg.d);
      this.broadcast({ t: 'ack', d: msg.d }, ws);
    }
  }

  webSocketClose(ws, code) {
    try { ws.close(code === 1005 ? 1000 : code, 'dicht'); } catch { /* al dicht */ }
  }

  webSocketError() { /* niets te doen: de client verbindt opnieuw */ }
}
