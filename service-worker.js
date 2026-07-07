const VERSION='27.0.0';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async()=>{ const keys=await caches.keys(); await Promise.all(keys.filter(k=>!k.includes(VERSION)).map(k=>caches.delete(k))); await self.clients.claim(); })()));
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request)); });
