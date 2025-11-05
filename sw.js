// Service Worker – cache first para estáticos, network first para resto
// >>> Suba a versão SEMPRE que publicar novas mudanças
const CACHE_NAME = 'mt-v2025110503';

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './charts.js',
  './firebase.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './assets/beep.mp3'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE_NAME && caches.delete(k))))
      .then(()=> self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isStatic = STATIC_ASSETS.some(p => url.pathname.endsWith(p.replace('./','/')));
  if (isStatic || url.origin === location.origin) {
    // cache-first para estáticos do mesmo domínio
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(r=>{
        const copy = r.clone();
        caches.open(CACHE_NAME).then(c=>c.put(e.request, copy));
        return r;
      }))
    );
  } else {
    // network-first (ex.: Firebase)
    e.respondWith(
      fetch(e.request).then(r=>{
        const copy = r.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request, copy));
        return r;
      }).catch(()=> caches.match(e.request))
    );
  }
});
