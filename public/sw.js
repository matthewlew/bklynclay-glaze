const CACHE = '__BUILD_HASH__';
const ASSETS = [
  './',
  './index.html',
  './glazes-data.js',
  './scoring.js',
  './state.js',
  './render.js',
  './persistence.js',
  './palette-detail.js',
  './update-banner.js',
  './glazes.json',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // addAll fails if any asset 404s; use individual fetches so missing files don't block
      Promise.allSettled(ASSETS.map(url => c.add(url)))
    )
  );
  // No skipWaiting() here — a new worker should stay in "waiting" until the
  // user opts in (see update-banner.js), otherwise there's no window to
  // detect an update and show the refresh banner.
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Only cache same-origin GET requests
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok) {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      });
    })
  );
});
