/* Version is replaced with a content digest during Pages assembly. */
const VERSION = '__PWA_VERSION__';
const PREFIX = 'kanji-origins-';
const CACHE = PREFIX + VERSION;
const ROOT = new URL('./', self.location.href);
const SHELL = new URL('index.html', ROOT).href;
const FILES = [
  'index.html', 'historical-forms.js', 'image-provenance.js', 'pwa.js',
  'manifest.webmanifest', 'data/kanjidic.json', 'data/shuowen_index.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];
const URLS = new Set(FILES.map(path => new URL(path, ROOT).href));

self.addEventListener('install', event => {
  // The existing release remains usable if any required asset fails to download.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...URLS])));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Never intercept private requests, external sources, or arbitrary local URLs.
  if (request.method !== 'GET' || request.headers.has('Authorization') ||
      request.cache === 'no-store' || url.origin !== ROOT.origin) return;
  const navigation = request.mode === 'navigate' &&
    (url.pathname === ROOT.pathname || url.pathname === new URL(SHELL).pathname);
  const key = navigation ? SHELL : url.href;
  if (!navigation && !URLS.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key);
    // Serve one coherent release. sw.js changes on every asset/data update.
    return cached || fetch(request);
  })());
});
