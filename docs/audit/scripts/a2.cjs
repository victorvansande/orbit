const { chromium } = require('playwright');
const fs = require('fs');
const measure = fs.readFileSync(__dirname + '/measure.js', 'utf8');
const SIZES = (process.env.SIZES || '1440x900,1024x768,768x1024,375x812,320x640,812x375').split(',');
const THEMES = (process.env.THEMES || 'light,dark').split(',');
const LANGS = (process.env.LANGS || 'nl').split(',');
const EXTRA = process.env.EXTRA || '';   // 'min' | 'rm' | 'red'
const STATES = (process.env.STATES || 'home,menu,composer,archive,snaps,feats,intro,sync,recap,focus').split(',');
const BENIGN = /WebSocket|ERR_TUNNEL|ERR_INTERNET|fonts\.g|open-meteo|bigdatacloud|orbit-sync|8787|Failed to load resource/;
(async () => {
  const b = await chromium.launch();
  const report = [];
  for (const size of SIZES) for (const theme of THEMES) for (const lang of LANGS) {
    const [w, h] = size.split('x').map(Number);
    const touch = w <= 820;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < h, reducedMotion: EXTRA === 'rm' ? 'reduce' : 'no-preference', colorScheme: theme });
    await ctx.addInitScript(([lang, theme, extra]) => {
      if (sessionStorage.i) return; sessionStorage.i = 1;
      localStorage.setItem('priority-orbit.lang.v1', lang); localStorage.setItem('priority-orbit.intro.v1', 'gezien'); localStorage.setItem('priority-orbit.theme.v1', theme);
      if (extra === 'min') localStorage.setItem('priority-orbit.fx.v1', 'min');
      if (extra === 'red') localStorage.setItem('priority-orbit.palette.v1', 'red');
    }, [lang, theme, EXTRA]);
    const p = await ctx.newPage();
    let errs = [];
    const failed = [];
    p.on('console', m => { if (m.type() === 'error' && !BENIGN.test(m.text())) errs.push(m.text().slice(0, 120)); });
    p.on('pageerror', e => errs.push('pageerror ' + e.message.slice(0, 120)));
    p.on('requestfailed', r => { if (r.url().startsWith('http://localhost:3000')) failed.push(r.url()); });
    p.on('response', r => { if (r.url().startsWith('http://localhost:3000') && r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
    await p.goto('http://localhost:3000/index.html'); await p.waitForTimeout(3500);
    for (const st of STATES) {
      errs = [];
      await p.evaluate(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); });
      await p.keyboard.press('Escape'); await p.waitForTimeout(150);
      const click = sel => p.evaluate(s => { const e = document.querySelector(s); if (e) { e.hidden = false; e.click(); return true; } return false; }, sel);
      if (st === 'menu') await click('#menu-btn');
      if (st === 'composer') await p.keyboard.press('n');
      if (st === 'archive') await p.keyboard.press('a');
      if (st === 'snaps') { await p.keyboard.press('a'); await p.waitForTimeout(300); await click('#arch-tab-snaps'); }
      if (st === 'feats') await p.keyboard.press('p');
      if (st === 'intro') await p.evaluate(() => document.getElementById('intro').showModal());
      if (st === 'sync') await click('#sync-btn');
      if (st === 'recap') await click('#recap-open');
      if (st === 'focus') await p.keyboard.press('f');
      await p.waitForTimeout(st === 'home' ? 200 : 1300);
      const r = await p.evaluate(`(${measure})()`);
      const open = await p.evaluate(() => [...document.querySelectorAll('dialog[open]')].map(d => d.id).join(',') || (document.querySelector('.hud-menu.is-open') ? 'menu' : document.body.classList.contains('is-focus') ? 'focus' : '-'));
      report.push({ key: `${size} ${theme} ${lang}${EXTRA ? ' ' + EXTRA : ''} ${st}`, open, errs: [...errs], ...r });
      if (st === 'focus') { await p.keyboard.press('Escape'); await p.waitForTimeout(800); }
    }
    if (failed.length) report.push({ key: `${size} ${theme} ${lang} verzoeken`, failed });
    await ctx.close();
  }
  fs.writeFileSync(__dirname + '/a2-' + (process.env.TAG || 'run') + '.json', JSON.stringify(report, null, 1));
  // compacte samenvatting: per soort bevinding unieke meldingen met de toestanden waar ze voorkomen
  const agg = {};
  for (const r of report) for (const k of ['overflow', 'overlap', 'small', 'contrast', 'offscreen', 'errs', 'failed']) for (const m of r[k] || []) {
    const key = k + ' | ' + m.replace(/\d+(\.\d+)?(x\d+)?/g, n => n.length > 0 ? n : n);
    (agg[key] ||= []).push(r.key.replace(/ (light|dark)/, ' $1'.slice(0, 2)));
  }
  for (const r of report) if (r.hscroll) (agg['hscroll'] ||= []).push(r.key);
  const lines = Object.entries(agg).sort().map(([k, v]) => `${k}  [${v.length}x: ${[...new Set(v)].slice(0, 4).join('; ')}]`);
  console.log(lines.join('\n') || 'niets gevonden');
  console.log('toestanden:', report.length, ' niet geopend:', report.filter(r => r.open === '-' && !/home|verzoeken/.test(r.key)).map(r => r.key).join('; '));
  await b.close();
})();
