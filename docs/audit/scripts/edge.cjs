const { chromium } = require('playwright');
const KEYS = process.argv[2].split(' ').map(k => k.replace(/'/g, '')).filter(Boolean);
(async () => {
  const b = await chromium.launch();
  async function run(label, init, after) {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 } });
    await ctx.addInitScript(init.fn, init.arg);
    const p = await ctx.newPage(); const errs = [];
    p.on('console', m => { if (m.type() === 'error' && !/WebSocket|ERR_TUNNEL|fonts|open-meteo|bigdatacloud|8787|orbit-sync/.test(m.text())) errs.push(m.text().slice(0, 160)); });
    p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 160)));
    await p.goto('http://localhost:3000/index.html'); await p.waitForTimeout(2500);
    const info = after ? await p.evaluate(after) : '';
    console.log(label, '|', errs.length ? errs.join(' || ') : 'geen fouten', '|', info);
    await ctx.close();
  }
  const base = `localStorage.setItem('priority-orbit.lang.v1','nl');localStorage.setItem('priority-orbit.intro.v1','gezien');`;
  await run('kapotte JSON in elke sleutel', { fn: keys => { if (sessionStorage.i) return; sessionStorage.i = 1; for (const k of keys) localStorage.setItem(k, '{kapot'); localStorage.setItem('priority-orbit.intro.v1', 'gezien'); }, arg: KEYS }, () => document.querySelectorAll('.track').length + ' rijen');
  await run('verkeerde types', { fn: keys => { if (sessionStorage.i) return; sessionStorage.i = 1; for (const k of keys) localStorage.setItem(k, '42'); localStorage.setItem('priority-orbit.tasks.v1', '{"a":1}'); localStorage.setItem('priority-orbit.intro.v1', 'gezien'); }, arg: KEYS }, () => document.querySelectorAll('.track').length + ' rijen');
  await run('null-taak en taak zonder velden', { fn: () => { if (sessionStorage.i) return; sessionStorage.i = 1; localStorage.setItem('priority-orbit.intro.v1', 'gezien'); localStorage.setItem('priority-orbit.tasks.v1', JSON.stringify([null, {}, { id: 'x' }, { id: 'y', title: 'ok', level: 9 }, { id: 'z', title: 'z', level: 2, due: 'gisteren', repeat: 'jaar' }])); }, arg: null }, () => [...document.querySelectorAll('.track')].map(r => r.dataset.id).join(','));
  await run('localStorage geblokkeerd', { fn: () => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('geblokkeerd'); } }); }, arg: null }, () => document.querySelectorAll('.track').length + ' rijen, scene ' + !!document.querySelector('canvas'));
  await run('opslag vol', { fn: () => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('priority-orbit.tasks') || String(v).length > 200) throw new DOMException('vol', 'QuotaExceededError'); return set.call(this, k, v); }; if (!sessionStorage.i) { sessionStorage.i = 1; set.call(localStorage, 'priority-orbit.intro.v1', 'gezien'); } }, arg: null }, () => document.querySelectorAll('.track').length + ' rijen');
  await run('geen IndexedDB', { fn: () => { Object.defineProperty(window, 'indexedDB', { get() { return undefined; } }); if (!sessionStorage.i) { sessionStorage.i = 1; localStorage.setItem('priority-orbit.intro.v1', 'gezien'); } }, arg: null }, () => document.querySelectorAll('.track').length + ' rijen');
  const now = Date.now();
  const many = Array.from({ length: 30 }, (_, i) => ({ id: 'm' + i, title: i === 0 ? 'Eenheelerglangetitelzonderspaties'.repeat(6) : i === 1 ? 'مهمة باللغة العربية 🚀🌍 emoji' : 'Taak ' + i, level: 1, createdAt: now, updatedAt: now, note: i === 2 ? 'x'.repeat(2000) : undefined }));
  await run('30 taken in Nu, lange titel, RTL', { fn: t => { if (sessionStorage.i) return; sessionStorage.i = 1; localStorage.setItem('priority-orbit.intro.v1', 'gezien'); localStorage.setItem('priority-orbit.lang.v1', 'nl'); localStorage.setItem('priority-orbit.tasks.v1', JSON.stringify(t)); }, arg: many }, () => { const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth; const r = document.querySelector('.track[data-id="m0"] .t-title').getBoundingClientRect(); const row = document.querySelector('.track[data-id="m0"]').getBoundingClientRect(); return `${document.querySelectorAll('.track').length} rijen, hscroll ${sw > cw}, titel tot ${Math.round(r.right)} rij tot ${Math.round(row.right)}`; });
  await b.close();
})();
