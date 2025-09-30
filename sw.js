const VER = 'v2.1.0';
const CORE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VER).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method === 'GET' && (request.url.startsWith(self.location.origin) || request.url.includes('cdn.jsdelivr.net'))) {
    e.respondWith(
      caches.match(request).then(resp => resp || fetch(request).then(r => {
        const copy = r.clone();
        caches.open(VER).then(c => c.put(request, copy));
        return r;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
