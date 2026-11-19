/* Solo Leveling – Service Worker
   Strategie: stale-while-revalidate.
   - Die App startet sofort aus dem Cache (auch offline).
   - Im Hintergrund wird die neueste Version geladen und im Cache ersetzt
     → beim nächsten Öffnen läuft automatisch die neue Version.
   Eine Änderung an dieser Datei (z. B. VERSION hochzählen) installiert den SW neu. */
const VERSION = 'v3';
const CACHE = 'solo-leveling-' + VERSION;
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './strong-history.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('solo-leveling-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Navigationen: jede Seite (index.html, preview.html …) unter ihrer eigenen Adresse cachen;
    // "/" wird auf index.html abgebildet. Offline-Fallback ist index.html.
    const nav = req.mode === 'navigate';
    const path = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
    const key = nav ? path : req;
    const cached = await cache.match(key, { ignoreSearch: nav });
    const network = fetch(nav ? path : req, { cache: 'no-cache' })
      .then(res => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(key, res.clone());
        return res;
      })
      .catch(() => null);
    if (cached) {
      e.waitUntil(network);
      return cached;
    }
    const res = await network;
    if (!res && nav) { const home = await cache.match('./index.html'); if (home) return home; }
    return res || new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
