/* Solo Leveling – Service Worker
   Strategie: stale-while-revalidate.
   - Die App startet sofort aus dem Cache (auch offline).
   - Im Hintergrund wird die neueste Version geladen und im Cache ersetzt
     → beim nächsten Öffnen läuft automatisch die neue Version.
   Eine Änderung an dieser Datei (z. B. VERSION hochzählen) installiert den SW neu. */
const VERSION = 'v1';
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
    // Navigationen (App-Start) immer auf index.html abbilden
    const key = req.mode === 'navigate' ? './index.html' : req;
    const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    const network = fetch(req.mode === 'navigate' ? './index.html' : req, { cache: 'no-cache' })
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
    return res || new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
