const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const port of [3001, 3000]) for (const [w, h] of [[1440, 900], [375, 812]]) for (const theme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800, reducedMotion: 'reduce' });
    await ctx.addInitScript(([theme]) => { Math.random = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })(); const D = Date; const fixed = new D('2026-11-09T10:00:00').getTime(); const off = fixed - D.now(); Date.now = () => D.now() + off;
      if (sessionStorage.i) return; sessionStorage.i = 1; localStorage.setItem('priority-orbit.intro.v1', 'gezien'); localStorage.setItem('priority-orbit.lang.v1', 'nl'); localStorage.setItem('priority-orbit.theme.v1', theme); localStorage.setItem('priority-orbit.weather.v2', 'x'); }, [theme]);
    const p = await ctx.newPage(); await p.goto(`http://localhost:${port}/index.html`); await p.waitForTimeout(2500);
    for (const st of ['home', 'menu', 'composer', 'archive', 'sync', 'focus']) {
      await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close())); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
      if (st === 'menu') await p.evaluate(() => document.getElementById('menu-btn').click());
      if (st === 'composer') await p.keyboard.press('n');
      if (st === 'archive') await p.keyboard.press('a');
      if (st === 'sync') await p.evaluate(() => document.getElementById('sync-btn').click());
      if (st === 'focus') await p.keyboard.press('f');
      await p.waitForTimeout(1200);
      out[`${port}|${w}|${theme}|${st}`] = await p.evaluate(() => { const r = {}; let i = 0; for (const e of document.querySelectorAll('body *')) { if (e.closest('svg') && e.tagName !== 'svg') continue; const b = e.getBoundingClientRect(); if (b.width < 1 || b.height < 1) continue; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue; const key = (e.id || e.className?.baseVal || e.className || e.tagName) + '#' + (i++); r[key] = [b.left, b.top, b.width, b.height].map(v => Math.round(v)).join(',') + '|' + cs.opacity + '|' + cs.color; } return r; });
      if (st === 'focus') { await p.keyboard.press('Escape'); await p.waitForTimeout(600); }
    }
    await ctx.close();
  }
  let diffs = 0;
  for (const k of Object.keys(out).filter(k => k.startsWith('3001'))) {
    const a = out[k], bb = out[k.replace('3001', '3000')]; const ka = Object.keys(a), kb = Object.keys(bb);
    const lines = [];
    if (ka.length !== kb.length) lines.push(`aantal elementen ${ka.length} -> ${kb.length}`);
    for (const x of ka) if (bb[x] !== undefined && bb[x] !== a[x]) lines.push(`${x}: ${a[x]} -> ${bb[x]}`);
    if (lines.length) { diffs += lines.length; console.log('==', k.slice(5), '\n  ' + lines.slice(0, 6).join('\n  ')); }
  }
  console.log('verschillen:', diffs);
  await b.close();
})();
