/* global importScripts */
// Push-hanteringen ligger i samma service worker, eftersom båda behöver scope '/'
// och en scope bara kan ha en registrering.
try {
  importScripts('/firebase-messaging-sw.js')
} catch (error) {
  console.warn('Push kunde inte startas i service workern', error)
}

const CACHE_NAME = 'june5th-v2'
const APP_SHELL = '/index.html'
const PRECACHE = [APP_SHELL, '/manifest.json']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

const isLocalDev = ['localhost', '127.0.0.1'].includes(self.location.hostname)

async function networkFirst(request, cacheKey = request, fetchRequest = request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(fetchRequest)
    if (response.ok) await cache.put(cacheKey, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(cacheKey)
    if (cached) return cached
    throw error
  }
}

// Filer under /assets/ har innehållshash i namnet och ändras aldrig.
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET' || isLocalDev) return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // Alla sidor i appen är samma index.html, så nya versioner hämtas alltid först.
    // no-cache tvingar webbläsaren att fråga servern i stället för att använda
    // en HTTP-cachad kopia av just den adressen (t.ex. en gammal /login).
    const fresh = new Request(request.url, { cache: 'no-cache', credentials: 'same-origin' })
    event.respondWith(networkFirst(request, APP_SHELL, fresh))
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request))
  } else {
    event.respondWith(networkFirst(request))
  }
})
