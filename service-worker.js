const CACHE_NAME="nimbus-core-v9";
const ASSETS=["./","./index.html","./style.css","./app.js","./config.js","./manifest.json","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const u=new URL(e.request.url); if(u.pathname.startsWith("/api/"))return; e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
