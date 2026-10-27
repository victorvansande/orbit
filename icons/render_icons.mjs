// Rendert de PNG's uit de SVG's met Chromium (Playwright). Gebruik: node icons/render_icons.mjs
// Ander pad naar Playwright: PLAYWRIGHT=/pad/naar/playwright/index.mjs node icons/render_icons.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
// [bron, doel, grootte, transparant]
const jobs = [
  ['icons/icon-full.svg', 'icons/apple-touch-icon.png', 180, true],
  ['icons/icon-any.svg', 'icons/icon-192.png', 192, true],
  ['icons/icon-any.svg', 'icons/icon-512.png', 512, true],
  ['icons/icon-maskable.svg', 'icons/icon-maskable-512.png', 512, false],
  ['icons/icon-monochrome.svg', 'icons/icon-monochrome-512.png', 512, true],
  ['favicon.svg', 'icons/favicon-48.png', 48, true],
  ['favicon.svg', 'icons/favicon-32.png', 32, true],
  ['favicon.svg', 'icons/favicon-16.png', 16, true],
];
const browser = await chromium.launch();
for (const [src, out, size, transparent] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, colorScheme: 'light' });
  const svg = readFileSync(root + src, 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.screenshot({ path: root + out, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
}
await browser.close();
console.log('iconen gerenderd');
