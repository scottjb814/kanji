import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPwa } from '../scripts/build_pwa.mjs';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
function worker({ failInstall = false } = {}) {
  const events = {}, stores = new Map(), fetched = [], deleted = [];
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const map = stores.get(name);
      return {
        async addAll(urls) {
          if (failInstall) throw Error('Download failed');
          urls.forEach(url => map.set(url, { body: url }));
        },
        async match(key) { return map.get(key); }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { deleted.push(name); return stores.delete(name); }
  };
  let claimed = false, skipped = false;
  const self = { location: { href: 'https://example.test/kanji/sw.js' },
    addEventListener(name, cb) { events[name] = cb; },
    clients: { async claim() { claimed = true; } },
    skipWaiting() { skipped = true; } };
  vm.runInNewContext(source, { self, caches, URL, Set, fetch: async r => { fetched.push(r); return { body: 'network' }; } });
  async function lifecycle(name) {
    let pending;
    events[name]({ waitUntil(promise) { pending = promise; } });
    await pending;
  }
  async function request(path, overrides = {}) {
    let response;
    const req = { url: new URL(path, self.location.href).href, method: 'GET', mode: 'cors', cache: 'default', headers: new Headers(), ...overrides };
    events.fetch({ request: req, respondWith(promise) { response = promise; } });
    return response && await response;
  }
  return { lifecycle, request, stores, fetched, deleted, events, claimed: () => claimed, skipped: () => skipped };
}

test('precache is limited to required local assets, including basic dictionary data', async () => {
  const h = worker();
  await h.lifecycle('install');
  const urls = [...h.stores.values()][0];
  assert.ok(urls.has('https://example.test/kanji/data/kanjidic.json'));
  assert.ok(urls.has('https://example.test/kanji/index.html'));
  assert.equal(urls.size, 11);
  for (const url of urls.keys()) assert.ok(url.startsWith('https://example.test/kanji/'));
  assert.equal(h.skipped(), false);
});
test('offline navigation with any character query returns shell while preserving URL routing', async () => {
  const h = worker(); await h.lifecycle('install');
  for (const path of ['./?q=牛&c=牛', './index.html?q=學', './']) {
    assert.equal((await h.request(path, { mode: 'navigate' })).body, 'https://example.test/kanji/index.html');
  }
  assert.equal(h.fetched.length, 0);
});
test('local dictionary and scripts are served from the same cached release', async () => {
  const h = worker(); await h.lifecycle('install');
  for (const path of ['data/kanjidic.json', 'historical-forms.js', 'pwa.js']) {
    assert.equal((await h.request(path)).body, 'https://example.test/kanji/' + path);
  }
  assert.equal(h.fetched.length, 0);
});
test('private requests, external data, fonts, unknown paths and non-GETs bypass cache', async () => {
  const h = worker(); await h.lifecycle('install');
  const cases = [
    ['https://private.workers.dev/kp?c=牛', {}],
    ['https://en.wiktionary.org/w/api.php', {}],
    ['https://upload.wikimedia.org/example.svg', {}],
    ['https://fonts.googleapis.com/css2', {}],
    ['fonts/kouzan/kouzan.css', {}], ['../other-site/', { mode: 'navigate' }],
    ['data/kanjidic.json?arbitrary=1', {}],
    ['data/kanjidic.json', { headers: new Headers({ Authorization: 'Bearer synthetic' }) }],
    ['data/kanjidic.json', { cache: 'no-store' }], ['index.html', { method: 'POST' }]
  ];
  for (const [url, options] of cases) assert.equal(await h.request(url, options), undefined, url);
});
test('activation deletes only this app’s older releases and claims clients', async () => {
  const h = worker(); await h.lifecycle('install');
  h.stores.set('kanji-origins-old', new Map());
  h.stores.set('another-site', new Map());
  await h.lifecycle('activate');
  assert.deepEqual(h.deleted, ['kanji-origins-old']);
  assert.ok(h.stores.has('another-site'));
  assert.equal(h.claimed(), true);
  h.events.message({ data: { type: 'ACTIVATE_UPDATE' } });
  assert.equal(h.skipped(), true);
});
test('failed required downloads reject installation without activating over old release', async () => {
  const h = worker({ failInstall: true });
  await assert.rejects(h.lifecycle('install'), /Download failed/);
  assert.equal(h.claimed(), false);
  assert.equal(h.skipped(), false);
});
test('release version is deterministic and changes when monthly dictionary data changes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kanji-pwa-'));
  try {
    mkdirSync(join(dir, 'data'));
    writeFileSync(join(dir, 'index.html'), 'shell');
    writeFileSync(join(dir, 'data/kanjidic.json'), 'edition 1');
    const build = () => {
      writeFileSync(join(dir, 'sw.js'), source);
      buildPwa(dir);
      return readFileSync(join(dir, 'sw.js'), 'utf8');
    };
    const first = build();
    assert.equal(build(), first);
    assert.ok(!first.includes('__PWA_VERSION__'));
    writeFileSync(join(dir, 'data/kanjidic.json'), 'edition 2');
    assert.notEqual(build(), first);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('manifest and PNGs support installation within the GitHub Pages subdirectory', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url)));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.id, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    const bytes = readFileSync(new URL('../' + icon.src, import.meta.url));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16) + 'x' + bytes.readUInt32BE(20), icon.sizes);
  }
  const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(workflow, /node scripts\/build_pwa.mjs _site/);
  for (const name of ['pwa.js', 'sw.js', 'manifest.webmanifest', 'icons']) assert.ok(workflow.includes(name));
});
