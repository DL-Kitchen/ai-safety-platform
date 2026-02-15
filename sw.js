// Saforia - Service Worker
// Cache-first for static assets, network-first for external APIs.

const CACHE_NAME = 'saforia-v1.0.0';

const STATIC_ASSETS = [
  './',
  './index.html',
  './favicon.svg',
  './manifest.json',
  './css/themes.css',
  './css/main.css',
  './css/components.css',
  './js/app.js',
  './js/router.js',
  './js/i18n.js',
  './js/event-bus.js',
  './js/lib/stats.js',
  './js/lib/hash.js',
  './js/lib/safety-lexicon.js',
  './js/lib/analyzer-engine.js',
  './js/lib/export.js',
  './js/lib/api-client.js',
  './js/lib/charts.js',
  './js/lib/storage.js',
  './js/components/saforia-navbar.js',
  './js/components/saforia-score-card.js',
  './js/modules/analyzer.js',
  './js/modules/experiment.js',
  './js/modules/observatory.js',
  './js/modules/redteam.js',
  './js/modules/certification.js',
  './locales/en.json',
  './locales/es.json',
  './data/lexicons/en.json',
  './data/lexicons/es.json',
  './data/experiment-templates.json',
  './data/attack-patterns.json',
  './data/risk-taxonomy.json',
  './data/frameworks.json'
];

// Install: pre-cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for local assets, network-first for external
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // External API calls: network-first
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request)
      )
    );
    return;
  }

  // Local assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
