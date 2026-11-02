// Optional real-browser test. Install Playwright and Chromium, then run:
// node tests/pwa-smoke.mjs
// PLAYWRIGHT_MODULE / CHROME_EXECUTABLE may select an existing local installation.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = new URL('../', import.meta.url);
const dictionary = { _meta: { dictDate: '2026-11-01' }, chars: {
  '牛': { o: ['ギュウ'], m: ['cow'] }, '學': { m: ['study'] }, '学': { m: ['study'] }
} };
let version = 'smoke-v1', dictionaryFailure = false;
const types = { html: 'text/html', js: 'text/javascript', json: 'application/json', webmanifest: 'application/manifest+json', png: 'image/png' };
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/kanji/')) { res.writeHead(404).end(); return; }
  let path = url.pathname.slice('/kanji/'.length) || 'index.html';
  if (path.includes('..')) { res.writeHead(404).end(); return; }
  try {
    if (path === 'data/kanjidic.json' && dictionaryFailure) { res.writeHead(503).end(); return; }
    let bytes = path === 'data/kanjidic.json' ? JSON.stringify(dictionary) : readFileSync(new URL(path, root));
    if (path === 'sw.js') bytes = String(bytes).replace('__PWA_VERSION__', version);
    res.writeHead(200, { 'content-type': types[path.split('.').pop()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 850 }, serviceWorkers: 'allow' });
  // All source content is synthetic or unavailable; no dictionary prose is copied.
  await context.route(/^https:\/\//, route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/kanji/?q=牛');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.locator('.kd-slot').filter({ hasText: 'cow' }).waitFor();
  await page.locator('#pwa-ready').waitFor();
  assert.match(await page.locator('#kddate').innerText(), /2026-11-01/);
  const manifest = await page.evaluate(async () => {
    const url = new URL(document.querySelector('[rel=manifest]').href);
    const manifest = await (await fetch(url)).json();
    return { ...manifest, launch: new URL(manifest.start_url, url).pathname };
  });
  assert.equal(manifest.launch, '/kanji/');
  assert.equal(manifest.display, 'standalone');
  const cdp = await context.newCDPSession(page);
  const { errors: installErrors } = await cdp.send('Page.getInstallabilityErrors');
  assert.deepEqual(installErrors, [], 'Chromium installability requirements');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await context.setOffline(true);
  await page.reload();
  await page.locator('#offline-status').waitFor();
  await page.locator('.kd-slot').filter({ hasText: 'cow' }).waitFor();
  assert.ok(await page.locator('#saved').isVisible());
  await page.locator('#q').fill('學'); await page.locator('#f').evaluate(form => form.requestSubmit());
  await page.locator('.kd-slot').filter({ hasText: 'study' }).waitFor();
  await page.goBack();
  await page.locator('.kd-slot').filter({ hasText: 'cow' }).waitFor();
  await page.goto(origin + '/kanji/index.html?q=学');
  await page.locator('.kd-slot').filter({ hasText: 'study' }).waitFor();
  await page.locator('#q').fill('𠮷'); await page.locator('#f').evaluate(form => form.requestSubmit());
  await page.getByText('No KANJIDIC readings or meanings for this character.', { exact: true }).waitFor();
  assert.equal(await page.locator('.historical img').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.emulateMedia({ colorScheme: 'dark' });
  await context.setOffline(false);
  version = 'smoke-v2';
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.locator('#pwa-status').waitFor();
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Update and reload' }).click()]);
  await page.waitForFunction(async () => (await caches.keys()).includes('kanji-origins-smoke-v2'));
  assert.deepEqual(await page.evaluate(() => caches.keys()), ['kanji-origins-smoke-v2']);
  assert.deepEqual(errors, []);
  console.log('PASS: Chromium installability, 390px layout, cached readings, saved characters, query navigation, missing character, dark mode, and update/reload.');

  // A fresh client with no downloaded dictionary must fail honestly and recover.
  const fresh = await browser.newContext({ serviceWorkers: 'block' });
  await fresh.route(/^https:\/\//, route => route.abort());
  dictionaryFailure = true;
  const missing = await fresh.newPage();
  await missing.goto(origin + '/kanji/?q=牛');
  await missing.getByText('Local dictionary data unavailable. Connect to download it, then try again.', { exact: true }).waitFor();
  dictionaryFailure = false;
  await missing.getByRole('button', { name: 'Retry live sources' }).click();
  await missing.locator('.kd-slot').filter({ hasText: 'cow' }).waitFor();
  await fresh.close();
  await context.close();
  console.log('PASS: missing local data and retry recovery.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
