const CACHE_NAME = 'arena-flow-v3';
const ASSETS = [
  'index.html',
  '404.html',
  'manifest.json',
  'src/css/styles.css',
  'src/js/security.js',
  'src/js/state.js',
  'src/js/router.js',
  'src/js/test-runner.js',
  'src/js/app.js',
  'src/assets/preview.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Allow graceful failure if any single asset is absent
      return cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only intercept HTTP/S requests (ignores chrome-extension / data schemes)
  if (e.request.url.startsWith('http')) {
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        return cachedResponse || fetch(e.request);
      })
    );
  }
});
