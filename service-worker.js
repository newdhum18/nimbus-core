const CACHE='nimbus-v27-rewrite-static-v1';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/index.html','/style.css','/app.js','/config.js','/manifest.json']))));
self.addEventListener('fetch',e=>{ if(new URL(e.request.url).pathname.startsWith('/api/')) return; e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))); });
