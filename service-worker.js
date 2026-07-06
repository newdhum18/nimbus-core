const CACHE_NAME="nimbus-core-v13";
const ASSETS=["./index.html?v=13","./style.css?v=13","./app.js?v=13","./config.js?v=13","./manifest.json?v=13","./icon-192.png?v=13","./icon-512.png?v=13"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);if(u.pathname.startsWith("/api/"))return;e.respondWith(fetch(e.request,{cache:"no-store"}).catch(()=>caches.match(e.request)))});
