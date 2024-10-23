const CACHE_NAME = "my-app-cache-v1.0.14"; // Update the cache version with every new deployment
const urlsToCache = ["/", "/js/script.js", "/css/style.css"];

// Install Service Worker and Cache Files
self.addEventListener("install", (event) => {
  // Force the new service worker to take over immediately
  self.skipWaiting();
  console.log("Installing new service worker and caching assets...");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate the Service Worker and Remove Old Caches
self.addEventListener("activate", (event) => {
  console.log("Service worker activating...");

  const cacheWhitelist = [CACHE_NAME]; // Whitelist only the current cache version

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log(`Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName); // Delete outdated caches
          }
        })
      );
    })
  );

  // Take control of all open pages right after activation
  return self.clients.claim();
});

// Fetch event with a Network-First Strategy
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache valid responses (status 200 and type basic)
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        // Clone the response and store it in the cache
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });

        return response;
      })
      .catch(() => {
        // On failure, fallback to cached resources
        return caches.match(event.request);
      })
  );
});

// Listen for service worker updates and refresh pages immediately
self.addEventListener("controllerchange", () => {
  window.location.reload();
});
