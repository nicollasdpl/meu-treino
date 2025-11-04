// Service Worker for Meu Treino 2.0
const CACHE_NAME = 'mt-v20251104-1200';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=2025110411',
  '/app.js?v=2025110411',
  '/charts.js?v=2025110411',
  '/firebase.js?v=2025110411',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/assets/beep.mp3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => {
      if (key !== CACHE_NAME) {
        return caches.delete(key);
      }
    })))
  );
});

// Use cache-first for static assets, network-first for others (e.g. Firebase)
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  // Navigate requests fallback to index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }
  // Cache-first for assets
  if (ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then(res => res || fetch(req))
    );
    return;
  }
  // Network-first for other requests
  event.respondWith(
    fetch(req).then(res => {
      return res;
    }).catch(() => caches.match(req))
  );
});