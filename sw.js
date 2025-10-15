/* Hot Potato PWA Service Worker */
const CACHE_NAME = 'hot-potato-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/main.js',
  '/manifest.json',
  '/locales/en.json',
  '/locales/el.json',
  '/locales/bg.json',
  '/locales/mk.json',
  '/locales/sq.json',
  '/assets/background.jpg',
  '/assets/music-file.mp3',
  '/assets/scream.mp3'
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(self.skipWaiting())
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(resp => {
      return resp || fetch(event.request).then(networkResp => {
        // Cache new GETs
        if (event.request.method === 'GET') {
          const clone = networkResp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResp;
      }).catch(() => resp);
    })
  );
});
