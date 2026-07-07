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

const isDev = (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') && self.location.port !== '4173';

self.addEventListener('install', e => {
  if (isDev) {
    self.skipWaiting();
    return;
  }
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // addAll fails if any asset 404s; use individual fetches so missing files don't block
      Promise.allSettled(ASSETS.map(url => c.add(url)))
    )
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  if (isDev) {
    e.waitUntil(
      self.registration.unregister().then(() => {
        return self.clients.matchAll();
      }).then(clients => {
        clients.forEach(client => {
          if (client.navigate) client.navigate(client.url);
        });
      })
    );
    return;
  }
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (isDev) return; // bypass cache, let network handle it
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

