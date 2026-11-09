import http from 'node:http';
const ch = {};
http.createServer(async (req, res) => {
  const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  const m = req.url.match(/^\/v1\/([0-9a-f]{32})(\/ack|\/history)?$/);
  if (!m) { res.writeHead(404, h); return res.end('{}'); }
  const c = ch[m[1]] ||= { v: 0, d: null, acks: [], hist: [] };
  let body = ''; for await (const x of req) body += x;
  if (m[2] === '/history') { res.writeHead(200, h); return res.end(JSON.stringify(c.hist)); }
  if (m[2] === '/ack') { c.acks.push({ at: Date.now(), d: JSON.parse(body).d }); res.writeHead(204, h); return res.end(); }
  if (req.method === 'GET') { res.writeHead(200, h); return res.end(JSON.stringify({ v: c.v, d: c.d, acks: c.acks })); }
  if (req.method === 'PUT') { if (c.d) c.hist.unshift({ v: c.v, d: c.d }); c.v++; c.d = JSON.parse(body).d; res.writeHead(200, h); return res.end(JSON.stringify({ v: c.v })); }
  res.writeHead(405, h); res.end('{}');
}).listen(8787);
