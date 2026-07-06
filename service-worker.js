const CACHE_NAME="nimbus-core-v7";
const ASSETS=["./","./index.html","./style.css","./app.js","./config.js","./manifest.json","./icon-192.png","./icon-512.png"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(url.pathname.startsWith("/api/")) return;
  event.respondWith(caches.match(event.request).then(res=>res||fetch(event.request)));
});
