const CACHE_NAME = "my-app-cache-v1.0.1";
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
});

// Cache and return requests
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit - return the response from the cache
      if (response) {
        return response;
      }
      return fetch(event.request); // No cache hit, fetch from network
    })
  );
});

// Update Service Worker and clear old cache
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName); // Delete old cache versions
          }
        })
      );
    })
  );
});
