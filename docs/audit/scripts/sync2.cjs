const { chromium } = require('playwright');
const CODE = 'ABCD-EFGH-JKMN-PQRS';
const now = Date.now();
const T = (id, title, lvl = 2) => ({ id, title, level: lvl, createdAt: now - 1e5, updatedAt: now - 1e5, levelAt: now - 1e5 });
(async () => {
  const b = await chromium.launch();
  const errs = [];
  async function dev(name, tasks) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(([code, tasks]) => {
      if (sessionStorage.getItem('init')) return; sessionStorage.setItem('init', '1');
      localStorage.setItem('priority-orbit.lang.v1', 'nl'); localStorage.setItem('priority-orbit.intro.v1', 'gezien');
      localStorage.setItem('priority-orbit.server', 'http://127.0.0.1:8787'); localStorage.setItem('priority-orbit.sync.v1', code);
      localStorage.setItem('priority-orbit.tasks.v1', JSON.stringify(tasks));
    }, [CODE, tasks]);
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' && !/WebSocket|ERR_TUNNEL|fonts|open-meteo|bigdatacloud|ERR_INTERNET/.test(m.text())) errs.push(name + ': ' + m.text()); });
    p.on('pageerror', e => errs.push(name + ' pageerror: ' + e.message));
    await p.goto('http://localhost:3000/index.html');
    return { ctx, p };
  }
  const ids = p => p.evaluate(() => JSON.parse(localStorage.getItem('priority-orbit.tasks.v1') || '[]').map(t => t.id + '=' + t.title).sort().join('|'));
  const arch = p => p.evaluate(() => JSON.parse(localStorage.getItem('priority-orbit.archive.v1') || '[]').map(t => t.id).sort().join(','));
  async function equal(A, B, label) {
    for (let i = 0; i < 40; i++) { const [x, y] = [await ids(A.p), await ids(B.p)]; if (x === y) { console.log(label, 'gelijk na', i * 0.5, 's:', x); return x; } await A.p.waitForTimeout(500); }
    console.log(label, 'NIET GELIJK:', await ids(A.p), '<>', await ids(B.p));
  }
  const A = await dev('A', [T('a1', 'Eerste'), T('a2', 'Tweede')]);
  await A.p.waitForTimeout(1500);
  const B = await dev('B', [T('b1', 'Van B')]);
  await equal(A, B, '1 samenvoegen');
  // offline op beide
  await A.ctx.setOffline(true); await B.ctx.setOffline(true);
  await A.p.click('.track[data-id="a1"] .t-check'); await A.p.waitForTimeout(800);
  await B.p.dblclick('.track[data-id="a2"] .t-title'); await B.p.keyboard.press('Control+A'); await B.p.keyboard.type('Tweede bewerkt'); await B.p.keyboard.press('Enter');
  await B.p.waitForTimeout(800);
  console.log('offline A:', await ids(A.p), ' B:', await ids(B.p));
  await A.ctx.setOffline(false); await B.ctx.setOffline(false);
  await equal(A, B, '2 na offline');
  console.log('archief A:', await arch(A.p), ' B:', await arch(B.p));
  // verwijderen op B (prullenbak via hover)
  await B.p.hover('.track[data-id="b1"]');
  const del = await B.p.$('.track[data-id="b1"] .t-act-del');
  if (del) { await del.evaluate(e => e.click()); await B.p.waitForTimeout(800); await equal(A, B, '3 na verwijderen'); console.log('archief A:', await arch(A.p), ' B:', await arch(B.p)); }
  else console.log('geen verwijderknop gevonden');
  for (const [n, D] of [['A', A], ['B', B]]) console.log('opnames', n, await D.p.evaluate(() => JSON.parse(localStorage.getItem('priority-orbit.snapshots.v1') || '[]').map(s => s.reason + ':' + s.tasks.map(t => t.id).join('+')).join(' ; ')));
  console.log('fouten:', errs.length ? errs : 'geen');
  await b.close();
})();
