/* ---- Orbit offline ---- */
// Netwerk eerst (altijd de nieuwste versie als er internet is), met een time-out zodat trage wifi niet blokkeert;
// lukt dat niet, dan de bewaarde kopie. Zo werkt Orbit ook zonder internet; taken bewaart de app zelf al in
// localStorage, en sync stuurt wat offline veranderde door zodra er weer verbinding is.
// Alleen de eigen bestanden en de lettertypes; nooit de sync-server of de weerdienst.

const CACHE = 'orbit-v1';
const TIMEOUT = 3500;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'favicon.svg', 'favicon.ico',
  'src/styles.css', 'src/app.js', 'src/config.js', 'src/scene.js', 'src/wheel.js', 'src/deadline.js',
  'src/store.js', 'src/backup.js', 'src/sync.js', 'src/pair.js', 'src/matrix.js', 'src/weather.js',
  'src/vendor/qrcode.min.mjs', 'src/vendor/jsqr.min.js',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function fromNetwork(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('time-out')), TIMEOUT);
    fetch(request).then(res => { clearTimeout(timer); resolve(res); }, err => { clearTimeout(timer); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin && url.pathname.startsWith(new URL('./', self.registration.scope).pathname);
  const font = FONT_HOSTS.includes(url.hostname);
  if (!own && !font) return;                     // sync-server, weer, Kwick: gewoon het netwerk
  if (own && url.search.includes('sync=')) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fromNetwork(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req, { ignoreSearch: own });
      if (hit) return hit;
      // pagina zonder internet en zonder kopie van die precieze url: de app zelf
      if (req.mode === 'navigate') { const shell = await cache.match('index.html'); if (shell) return shell; }
      return Response.error();
    }
  })());
});
