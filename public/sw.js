const CACHE_NAME = 'inventory-v1';
const RUNTIME_CACHE = 'inventory-runtime';
const ASSETS_CACHE = 'inventory-assets';

const STATIC_ASSETS = [
  '/',
  '/styles/globals.css',
  '/offline.html',
];

const API_CACHE_ROUTES = [
  '/api/dashboard',
  '/api/products',
  '/api/customers',
  '/api/inventory',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Failed to cache some assets:', err);
      });
    })
  );
  
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (![CACHE_NAME, RUNTIME_CACHE, ASSETS_CACHE].includes(cacheName)) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const { method, url } = request;

  // Skip non-GET requests
  if (method !== 'GET') {
    return;
  }

  // Skip chrome extensions
  if (url.includes('chrome-extension')) {
    return;
  }

  // API requests - Network first, fallback to cache
  if (url.includes('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Assets - Cache first, fallback to network
  if (isAsset(url)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // HTML pages - Stale while revalidate
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidateStrategy(request));
    return;
  }

  // Default - Network first
  event.respondWith(networkFirstStrategy(request));
});

// Cache first strategy
async function cacheFirstStrategy(request) {
  const cache = await caches.open(ASSETS_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('Fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network first strategy
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('Network request failed:', error);
    
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Return offline page or error response
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    return new Response(
      JSON.stringify({ error: 'Offline', success: false }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached || new Response('Offline', { status: 503 }));

  return cached || fetchPromise;
}

// Check if URL is an asset
function isAsset(url) {
  return (
    /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot|css|js)$/i.test(url) ||
    url.includes('/_next/static/') ||
    url.includes('/public/')
  );
}

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach(name => caches.delete(name));
    });
  }
});
