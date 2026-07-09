// Nimbus Core V31.0 clean service worker
// Purpose: remove old cached UI and always load the latest deployed app.
const CACHE_NAME = 'nimbus-core-v31-0-hyper-extractor-network-only';

async function clearAllCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
}

self.addEventListener('install', event => {
  event.waitUntil(clearAllCaches().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(clearAllCaches().then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => {
    return new Response('Nimbus Core is offline. Please reconnect and refresh.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
    });
  }));
});
