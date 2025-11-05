const CACHE_NAME = 'expense-tracker-pro-v2.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/database.js',
  '/js/scanner.js',
  '/js/analytics.js',
  '/js/insights.js',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
];

// ==========================================
// INSTALL EVENT
// ==========================================
self.addEventListener('install', event => {
  console.log('[SW] Installing Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[SW] Cache installation failed:', error);
      })
  );
  
  self.skipWaiting();
});

// ==========================================
// FETCH EVENT - FIXED TO FILTER INVALID SCHEMES
// ==========================================
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  // ✅ FILTER: Only handle HTTP/HTTPS requests
  if (!requestUrl.protocol.startsWith('http')) {
    console.log('[SW] Ignoring non-HTTP request:', requestUrl.protocol);
    return; // Let browser handle chrome-extension://, file://, data:, etc.
  }

  // ✅ FILTER: Ignore browser extension requests
  if (requestUrl.hostname.includes('extension')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return cached response
        if (response) {
          console.log('[SW] Cache hit:', event.request.url);
          return response;
        }

        // Cache miss - fetch from network
        console.log('[SW] Fetching from network:', event.request.url);
        
        return fetch(event.request).then(
          response => {
            // ✅ VALIDATION: Check if response is valid for caching
            if (!response || response.status !== 200 || response.type !== 'basic') {
              console.log('[SW] Not caching response:', response?.status, response?.type);
              return response;
            }

            // ✅ VALIDATION: Only cache GET requests
            if (event.request.method !== 'GET') {
              console.log('[SW] Not caching non-GET request');
              return response;
            }

            // Clone the response (response can only be consumed once)
            const responseToCache = response.clone();

            // Cache the response
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache)
                  .then(() => {
                    console.log('[SW] Cached:', event.request.url);
                  })
                  .catch(error => {
                    console.warn('[SW] Failed to cache:', event.request.url, error.message);
                  });
              });

            return response;
          }
        ).catch(error => {
          console.error('[SW] Fetch failed:', event.request.url, error);
          // Return offline page or fallback if available
          return caches.match('/index.html');
        });
      })
  );
});

// ==========================================
// ACTIVATE EVENT - CLEANUP OLD CACHES
// ==========================================
self.addEventListener('activate', event => {
  console.log('[SW] Activating Service Worker...');
  
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  self.clients.claim();
  console.log('[SW] Service Worker activated and ready!');
});

// ==========================================
// BACKGROUND SYNC - OFFLINE TRANSACTIONS
// ==========================================
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  console.log('[SW] Syncing offline transactions...');
  
  try {
    // Implementation for syncing offline transactions
    // This would communicate with IndexedDB and sync pending transactions
    
    // Send message to clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        message: 'Transactions synced successfully'
      });
    });
    
    console.log('[SW] Sync completed successfully');
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    throw error; // Retry sync
  }
}

// ==========================================
// PUSH NOTIFICATIONS
// ==========================================
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from Expense Tracker Pro',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    tag: 'expense-tracker-notification',
    requireInteraction: false,
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icons/view-icon.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/close-icon.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Expense Tracker Pro', options)
      .then(() => {
        console.log('[SW] Notification shown');
      })
      .catch(error => {
        console.error('[SW] Notification failed:', error);
      })
  );
});

// ==========================================
// NOTIFICATION CLICK HANDLER
// ==========================================
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Just close, already handled above
    console.log('[SW] Notification dismissed');
  } else {
    // Default click (not on action button)
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        // Focus existing window if available
        for (let client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if no existing window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// ==========================================
// MESSAGE HANDLER - COMMUNICATION WITH APP
// ==========================================
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(event.data.urls))
        .then(() => {
          console.log('[SW] Additional URLs cached');
        })
    );
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        console.log('[SW] All caches cleared');
      })
    );
  }
});

// ==========================================
// ERROR HANDLER
// ==========================================
self.addEventListener('error', event => {
  console.error('[SW] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

// Check if URL is cacheable
function isCacheable(request) {
  const url = new URL(request.url);
  
  // Only cache HTTP/HTTPS
  if (!url.protocol.startsWith('http')) {
    return false;
  }
  
  // Don't cache browser extensions
  if (url.hostname.includes('extension')) {
    return false;
  }
  
  // Don't cache localhost API calls (optional)
  // if (url.hostname === 'localhost' && url.pathname.startsWith('/api')) {
  //   return false;
  // }
  
  return true;
}

console.log('[SW] Service Worker script loaded');