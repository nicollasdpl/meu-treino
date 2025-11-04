const CACHE_NAME = 'meu-treino-static-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/charts.js',
  '/firebase.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/assets/beep.mp3'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evt => {
  if (evt.request.method !== 'GET') return;
  const url = new URL(evt.request.url);
  if (url.origin === location.origin) {
    // cache-first for same-origin
    evt.respondWith(
      caches.match(evt.request).then(cached => {
        return cached || fetch(evt.request).catch(() => caches.match('/index.html'));
      })
    );
  } else {
    // network-first for cross-origin
    evt.respondWith(
      fetch(evt.request).catch(() => caches.match(evt.request))
    );
  }
});
