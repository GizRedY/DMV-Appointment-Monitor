// Service worker for the Home Customization sheet (offline support)
const CACHE = 'customization-v2';
const ASSETS = [
  '/customization-sheet',
  '/cs-styles.css',
  '/cs-app.js',
  '/cs-manifest.json',
  '/cs-icon-192.png',
  '/cs-icon-512.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); })
           .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; })
                             .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// Network-first for the page, cache fallback when offline
self.addEventListener('fetch', function(e){
  var url = new URL(e.request.url);
  if(ASSETS.indexOf(url.pathname) === -1 && url.pathname !== '/customization-sheet') return;
  e.respondWith(
    fetch(e.request).then(function(resp){
      var copy = resp.clone();
      caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
      return resp;
    }).catch(function(){
      return caches.match(e.request).then(function(m){
        return m || caches.match('/customization-sheet');
      });
    })
  );
});