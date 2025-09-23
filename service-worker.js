/* escopo é calculado pelo registro em index.html */
const SW_VERSION = 'v1.0.0';
const CACHE_NAME = `meutreino-${SW_VERSION}`;

// Precache básico (relativos ao escopo)
const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Cache-first para tudo do mesmo escopo
self.addEventListener('fetch', (e) => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        // atualiza cache em background
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, resClone));
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});

// Mensagens do app (ex.: descanso finalizado)
self.addEventListener('message', (e) => {
  const { type, payload } = e.data || {};
  if (type === 'rest-finished') {
    // Notificação local via SW (funciona quando o app está aberto/instalado)
    if (self.registration && Notification.permission === 'granted') {
      self.registration.showNotification('Descanso finalizado!', {
        body: 'Vamos para a próxima série.',
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        vibrate: [250,120,250,120,400],
        tag: 'rest-finished',
        renotify: true
      });
    }
  }
});

// (Opcional) Push – quando você ativar Web Push no futuro
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title:'Meu Treino', body:'Nova notificação.' };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Meu Treino', {
      body: data.body || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: data.tag || 'push',
      renotify: true
    })
  );
});
