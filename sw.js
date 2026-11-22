/* Solo Leveling – Service Worker
   Strategie: stale-while-revalidate.
   - Die App startet sofort aus dem Cache (auch offline).
   - Im Hintergrund wird die neueste Version geladen und im Cache ersetzt
     → beim nächsten Öffnen läuft automatisch die neue Version.
   Eine Änderung an dieser Datei (z. B. VERSION hochzählen) installiert den SW neu. */
const VERSION = 'v5';
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

/* ===== Pausen-Timer im Hintergrund =====
   Android friert die App im Hintergrund ein. Deshalb zählt der Service Worker die Pause herunter,
   aktualisiert die Benachrichtigung jede Sekunde und meldet am Ende mit Vibration "Go". */
let REST = null;            // {id,end,total,title,set,vib}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

async function closeRest() {
  const ns = await self.registration.getNotifications({ tag: 'rest' });
  ns.forEach(n => n.close());
}
function showRest(r) {
  const left = (r.end - Date.now()) / 1000, k = Math.round(Math.min(1, Math.max(0, 1 - left / r.total)) * 12);
  const bar = '▰'.repeat(k) + '▱'.repeat(12 - k);
  return self.registration.showNotification(r.title, {
    tag: 'rest', body: `${fmt(left)}   ${bar}${r.set ? '\n' + r.set : ''}`, silent: true, renotify: false,
    requireInteraction: true, icon: 'icons/icon-192.png', data: r,
    actions: [{ action: 'add30', title: '+30 sec' }, { action: 'skip', title: 'Skip' }]
  });
}
async function runRest(r) {
  REST = r; await closeRest();
  while (REST && REST.id === r.id && Date.now() < REST.end) {
    await showRest(REST);
    await sleep(Math.min(1000, Math.max(50, REST.end - Date.now())));
  }
  if (!REST || REST.id !== r.id) return;
  REST = null;
  await self.registration.showNotification(r.title.replace(/^Next:/, 'Go:'), {
    tag: 'rest', body: r.set || 'Rest over', renotify: true, silent: false,
    vibrate: r.vib ? [300, 120, 300] : [], icon: 'icons/icon-192.png', data: { done: true }
  });
  setTimeout(() => closeRest(), 60000);
}
async function tellClients(msg) {
  const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  cs.forEach(c => c.postMessage(msg));
}

self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'restStart') e.waitUntil(runRest({ id: d.id, end: d.end, total: d.total, title: d.title, set: d.set, vib: d.vib }));
  if (d.type === 'restStop') { REST = null; e.waitUntil(closeRest()); }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const r = e.notification.data || {};
  e.waitUntil((async () => {
    if (e.action === 'add30' && r.end) {
      const n = { ...r, end: (REST && REST.id === r.id ? REST.end : r.end) + 30000, total: r.total + 30 };
      if (REST && REST.id === r.id) { REST.end = n.end; REST.total = n.total; }
      await tellClients({ rest: 'add30', id: r.id });
      if (!REST) await runRest(n);           // Worker war zwischendurch beendet → neu starten
      return;
    }
    if (e.action === 'skip') { REST = null; await closeRest(); await tellClients({ rest: 'skip', id: r.id }); return; }
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (cs.length) return cs[0].focus();
    return self.clients.openWindow('./');
  })());
});
