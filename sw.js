// =======================
// sw.js - Service Worker
// =======================

// Cache version (bump this when you deploy new changes)
const CACHE_NAME = "healthguide-cache-v1";
const API_CACHE = "healthguide-api-cache";

// Static assets to always cache
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/script.js",
  "/config.js",
  "/login.html",
  "/offline.html",
  "/assets/logo.png",
];

// Install event → pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); // activate worker immediately
});

// Activate event → clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== API_CACHE) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch event → cache-first for static, network-first for API
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Handle API requests separately
  if (url.origin === self.location.origin || url.origin.includes("127.0.0.1")) {
    if (url.pathname.startsWith("/api/")) {
      event.respondWith(networkFirst(event.request));
      return;
    }
  }

  // For static assets → cache-first
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Default → try network, fallback to offline.html if HTML page
  event.respondWith(
    fetch(event.request).catch(() => {
      if (event.request.mode === "navigate") {
        return caches.match("/offline.html");
      }
    })
  );
});

// ===== Strategies =====
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  cache.put(request, fresh.clone());
  return fresh;
}

async function networkFirst(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const fresh = await fetch(request);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: "Offline and no cached data available" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
}
