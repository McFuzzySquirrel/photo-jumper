// Photo Jumper Service Worker
// Enables offline play and PWA installation

const CACHE_NAME = 'photo-jumper-v2';
const OFFLINE_CACHE_NAME = 'photo-jumper-offline-v2';

// Core files to cache for offline use
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/css/android-game.css',
  '/js/main.js',
  '/js/config.js',
  '/js/runtime.js',
  '/js/platform/native-bridge.js',
  '/js/detection/ml.js',
  '/js/detection/grid.js',
  '/js/detection/pipeline.js',
  '/js/detection/fallback.js',
  '/js/detection/hough.js',
  '/js/detection/edge-density.js',
  '/js/detection/skeleton.js',
  '/js/detection/helpers.js',
  '/js/detection/contours.js',
  '/js/engine/goal.js',
  '/js/engine/platform.js',
  '/js/engine/letter.js',
  '/js/engine/player.js',
  '/manifest.json',
];

// ML assets - cached separately and lazily
const ML_ASSETS = [
  '/models/yolov8n.onnx',
  '/lib/ort.min.js',
];

// Icon sizes to cache
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const ICON_ASSETS = ICON_SIZES.map(size => `/icons/icon-${size}.png`);

// All assets to pre-cache
const PRECACHE_ASSETS = [...CORE_ASSETS, ...ICON_ASSETS];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching core assets');
        // Cache what we can, track failures but don't block installation
        return Promise.allSettled(
          PRECACHE_ASSETS.map(url => cache.add(url))
        ).then(results => {
          const failures = results.filter(r => r.status === 'rejected');
          if (failures.length > 0) {
            console.warn(`[SW] Failed to cache ${failures.length} asset(s):`);
            failures.forEach((f, i) => console.warn(`  - ${PRECACHE_ASSETS[results.indexOf(f)]}: ${f.reason?.message || 'Unknown error'}`));
          }
          const successes = results.filter(r => r.status === 'fulfilled').length;
          console.log(`[SW] Cached ${successes}/${PRECACHE_ASSETS.length} assets`);
        });
      })
      .then(() => {
        console.log('[SW] Core assets cached');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== OFFLINE_CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - network first, then cache fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests except for CDN assets we want to cache
  if (url.origin !== self.location.origin) {
    // Cache ONNX runtime and WASM files from CDN
    if (url.href.includes('onnxruntime-web') || 
        url.href.includes('ort.min.js') || 
        url.href.includes('ort-wasm') ||
        url.href.includes('.wasm')) {
      event.respondWith(
        caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            console.log('[SW] Serving cached CDN asset:', event.request.url);
            return cachedResponse;
          }
          return fetch(event.request).then(response => {
            if (response.ok) {
              const cache = caches.open(OFFLINE_CACHE_NAME);
              cache.then(c => c.put(event.request, response.clone()));
              console.log('[SW] Cached CDN asset:', event.request.url);
            }
            return response;
          }).catch(err => {
            console.warn('[SW] Failed to fetch CDN asset:', event.request.url, err);
            throw err;
          });
        })
      );
      return;
    }
    // Cache YOLOv8 model from CDN
    if (url.href.includes('yolov8') && url.href.includes('.onnx')) {
      event.respondWith(
        caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            console.log('[SW] Serving cached model:', event.request.url);
            return cachedResponse;
          }
          return fetch(event.request).then(response => {
            if (response.ok) {
              const cache = caches.open(OFFLINE_CACHE_NAME);
              cache.then(c => c.put(event.request, response.clone()));
              console.log('[SW] Cached model:', event.request.url);
            }
            return response;
          }).catch(err => {
            console.warn('[SW] Failed to fetch model:', event.request.url, err);
            throw err;
          });
        })
      );
      return;
    }
    // Let other cross-origin requests pass through
    return;
  }
  
  // For ML assets, use cache-first (they're large and don't change often)
  // But skip if it's a local file that might not exist (allow fallback to work)
  const isLocalMLAsset = ML_ASSETS.some(asset => url.pathname.endsWith(asset.replace('/', '')));
  if (isLocalMLAsset) {
    // Only intercept if we already have it cached
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          console.log('[SW] Serving cached ML asset:', event.request.url);
          return cachedResponse;
        }
        // Not cached - let browser handle it (will 404 for local, then JS fallback will try CDN)
        return fetch(event.request).then(response => {
          if (response.ok) {
            const cache = caches.open(OFFLINE_CACHE_NAME);
            cache.then(c => c.put(event.request, response.clone()));
          }
          return response;
        }).catch(err => {
          // Let 404s pass through - this allows JS fallback to work
          console.log('[SW] Local ML asset not found (expected):', event.request.url);
          throw err;
        });
      })
    );
    return;
  }
  
  // For everything else, use network-first with cache fallback
  event.respondWith(networkFirstStrategy(event.request));
});

// Network-first strategy: try network, fall back to cache
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // For navigation requests, return the cached index.html
    if (request.mode === 'navigate') {
      const indexResponse = await caches.match('/index.html');
      if (indexResponse) {
        return indexResponse;
      }
    }
    
    // If nothing in cache, return a simple offline message for HTML requests
    if (request.headers.get('Accept')?.includes('text/html')) {
      return new Response(
        '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>Photo Jumper is offline</h1><p>Please check your internet connection and try again.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    
    throw error;
  }
}

// Cache-first strategy: try cache, fall back to network
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('[SW] Serving from cache:', request.url);
    return cachedResponse;
  }
  
  console.log('[SW] Fetching and caching:', request.url);
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to fetch:', request.url, error);
    throw error;
  }
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  // Handle cache ML assets request
  if (event.data === 'cacheMLAssets') {
    cacheMLAssets().then(() => {
      // Try MessageChannel first, fall back to client messaging
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      } else if (event.source) {
        event.source.postMessage({ type: 'cacheMLAssetsResult', success: true });
      }
    }).catch((error) => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false, error: error.message });
      } else if (event.source) {
        event.source.postMessage({ type: 'cacheMLAssetsResult', success: false, error: error.message });
      }
    });
  }
});

// Cache ML assets on demand
async function cacheMLAssets() {
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  
  for (const asset of ML_ASSETS) {
    try {
      const response = await fetch(asset);
      if (response.ok) {
        await cache.put(asset, response);
        console.log('[SW] Cached ML asset:', asset);
      }
    } catch (error) {
      console.warn('[SW] Failed to cache ML asset:', asset, error.message);
    }
  }
}
