const CACHE_NAME = "my-app-cache-v1.0.8"; // Increment this on every new deployment
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

// Install Service Worker and Cache Files
self.addEventListener("install", (event) => {
  console.log("Installing new service worker...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting(); // Force the new service worker to take over immediately
});

// Activate the Service Worker and Remove Old Caches
self.addEventListener("activate", (event) => {
  console.log("Service worker activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName); // Delete old caches
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control of all open clients (tabs)
});

// Network First Fetch Strategy
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses (status 200)
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response; // Return the network response if not cacheable
        }

        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone); // Cache the response
        });

        return response;
      })
      .catch(() => {
        return caches.match(event.request); // Fallback to cache if network fails
      })
  );
});
