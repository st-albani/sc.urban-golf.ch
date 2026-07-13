/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// Veraltete Caches bereinigen und neue Assets precachen
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// updateSW(true) aus virtual:pwa-register postet {type:'SKIP_WAITING'} an den
// wartenden Worker. Bei einem custom SW (injectManifest + registerType 'prompt')
// wird der Listener NICHT automatisch injiziert — ohne ihn bleibt der neue SW
// ewig "waiting" und der Update-Dialog kommt in einer Endlosschleife wieder.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// SPA Navigation Fallback: alle Routen → index.html
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// GET /api/* → NetworkFirst mit Timeout (POST-Requests werden nicht gecacht)
registerRoute(
  ({ request, url }) =>
    (url.pathname.startsWith('/api/') || url.hostname.includes('urban-golf.ch')) &&
    request.method === 'GET',
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

// Bilder → CacheFirst (7 Tage)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

// Background Sync: postMessage an offene Windows senden
// Die Queue liegt im App-Layer (localStorage via Pinia) – der SW kann sie nicht direkt lesen.
// Er benachrichtigt offene Tabs, die dann den Flush auslösen.
self.addEventListener('sync', ((event: ExtendableEvent & { tag: string }) => {
  if (event.tag === 'sync-scores') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SYNC_SCORES' }))
      })
    )
  }
}) as EventListener)
