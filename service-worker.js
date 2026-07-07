const CACHE = 'nimbus-core-v23';
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE).then(c => c.addAll(['/?v=23','/style.css?v=23','/app.js?v=23','/config.js?v=23','/manifest.json?v=23']))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.searchParams.get('fresh') === '1' || url.pathname === '/reset') return;
  event.respondWith(fetch(event.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(event.request, copy)); return r; }).catch(() => caches.match(event.request)));
});
