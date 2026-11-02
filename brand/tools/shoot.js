const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1000, height: 860 }, deviceScaleFactor: 2 });
  for (const k of ['homescreen','browser','inapp']) {
    await p.goto('file://' + process.cwd() + '/merk/mockups/' + k + '.html'); await p.waitForTimeout(600);
    await p.screenshot({ path: 'merk/mockups/' + k + '.png' });
  }
  await b.close();
})();
