// Service Worker - cache-first for app shell, runtime cache for fonts.
// Bumps CACHE_VERSION to force a refresh after deploys.

const CACHE_VERSION = 'sport-v1';
const APP_SHELL = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'storage.js',
  'exercises.js',
  'modules/gym.js',
  'modules/run.js',
  'modules/yoga.js',
  'modules/kb.js',
  'modules/dashboard.js',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL).catch(err => {
      // Don't fail install if a single asset is missing (e.g. icon not yet generated)
      console.warn('SW install: some assets failed to cache:', err);
    })),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first for navigation requests so updates show up
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match('index.html')),
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache successful same-origin or font responses
        if (res.ok && (req.url.startsWith(self.location.origin) || req.url.includes('fonts.g'))) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    }),
  );
});
