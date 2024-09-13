const CACHE_NAME = "my-app-cache-v1.0.3";
const urlsToCache = [
  "/",
  "/index.html",
  "/hgv.html",
  "/tippers.html",
  "/services.html",
  "/depots.html",
  "/maintenance.html",
  "/js/script.js",
  "/css/style.css",
];

// Install Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      return cache.addAll(urlsToCache); // Cache the specified files
    })
  );
  self.skipWaiting(); // Forces new service worker to take control immediately
});

self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Cache and return requests
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and store the response in cache
        if (event.request.url.indexOf("http") === 0) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response; // No cache hit, fetch from network
      })
      .catch(() => {
        // If network fetch fails, try to get it from cache
        return caches.match(event.request);
      })
  );
});
