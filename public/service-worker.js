const CACHE_NAME = "my-app-cache-v1.0.11"; // Increment this on every new deployment
const urlsToCache = ["/", "/js/script.js", "/css/style.css"];

// Install Service Worker and Cache Files
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Force the new service worker to take over immediately
  console.log("Installing new service worker...");
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

  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            // Only delete caches not in the whitelist
            console.log(`[Service worker] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  self.clients.claim(); // Take control of all open clients (tabs)
});

// Network First Fetch Strategy with Cache Fallback
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses (status 200)
        if (response && response.status === 200 && response.type === "basic") {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone); // Cache the response
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if network fails
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse; // Return cached response if available
          }

          // Optionally, serve a fallback page for failed navigations
          if (event.request.mode === "navigate") {
            return caches.match("/fallback.html"); // Serve a fallback page if network fails entirely
          }
        });
      })
  );
});
