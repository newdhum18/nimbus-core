const CACHE_NAME="nimbus-core-v15";
const ASSETS=["./index.html?v=15","./style.css?v=15","./app.js?v=15","./config.js?v=15","./manifest.json?v=15","./icon-192.png?v=15","./icon-512.png?v=15"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(u.pathname.startsWith("/api/"))return;e.respondWith(fetch(e.request,{cache:"no-store"}).catch(()=>caches.match(e.request)))});
