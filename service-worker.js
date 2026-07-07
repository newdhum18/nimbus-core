const CACHE='nimbus-core-v21';
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/?v=21','/style.css?v=21','/app.js?v=21','/config.js?v=21','/manifest.json?v=21'])))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.pathname.startsWith('/api/')||url.pathname==='/reset'){event.respondWith(fetch(event.request));return}event.respondWith(fetch(event.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});return res}).catch(()=>caches.match(event.request))) });
