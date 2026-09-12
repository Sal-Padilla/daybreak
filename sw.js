// Daybreak — sw.js — offline shell. Every path is relative: this ships to a GitHub Pages subpath.

// Bump this on any change to the strategy below. Asset freshness no longer depends on it —
// stale-while-revalidate handles that — but a new name forces one clean sweep of old caches.
const CACHE = 'daybreak-v0.8.0';

// Relative paths, resolved against the service worker's own scope. A leading slash here would
// point at the domain root and break the app the moment it lives under /daybreak/.
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  './icons/icon-maskable-512.png',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/screens.css',
  './js/app.js',
  './js/core/db.js',
  './js/core/store.js',
  './js/core/router.js',
  './js/data/exercises.js',
  './js/data/classes.js',
  './js/data/programs.js',
  './js/data/standards.js',
  './js/engine/lifestage.js',
  './js/engine/readiness.js',
  './js/engine/progression.js',
  './js/engine/shapemap.js',
  './js/engine/scheduler.js',
  './js/engine/sessionplan.js',
  './js/features/onboarding.js',
  './js/features/warmup.js',
  './js/features/today.js',
  './js/features/train.js',
  './js/features/week.js',
  './js/features/shape.js',
  './js/features/me.js',
  './js/features/report.js',
  './js/features/install.js',
  './js/ui/components.js',
  './js/ui/charts.js',
  './js/data/pillars.js',
  './js/data/info.js',
  './js/engine/recommend.js',
  './js/ui/infosheet.js',
  './js/dev/seed.js',
  './js/data/diagrams.js',
  './js/ui/timer.js',
  './js/ui/voice.js',
  './js/data/schedule.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll() is all-or-nothing — one 404 would leave her with no offline app at all.
    // Cache what we can and log the rest.
    await Promise.all(ASSETS.map(async (path) => {
      try {
        await cache.add(new Request(path, { cache: 'reload' }));
      } catch (err) {
        console.warn('Daybreak SW: could not precache', path, err);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) client.postMessage({ type: 'daybreak:updated', version: CACHE });
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'daybreak:skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never touch anything but same-origin GETs. Writes and cross-origin requests go straight
  // through — caching them is how service workers break apps in ways nobody can debug.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, so a deploy is picked up immediately; cache is the fallback
  // for the tunnel, the plane, and the weight room at 819 N Harbor Dr.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match('./index.html')) ||
               (await caches.match('./')) ||
               new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
      }
    })());
    return;
  }

  // Static assets: STALE-WHILE-REVALIDATE.
  //
  // Serve from cache immediately, so the app opens instantly and works in the concrete box
  // that is the weight room. But ALWAYS re-fetch in the background and update the cache, so
  // the next launch has the new code.
  //
  // The previous version was cache-first with no revalidation, which meant the cache only ever
  // refreshed when CACHE_NAME changed by hand. Miss that bump once — which happened — and every
  // installed copy is frozen on the version it first downloaded, forever. For an app that
  // deploys by `git push` and has no build step to fingerprint filenames, this is the only
  // strategy that is safe to forget about.
  event.respondWith((async () => {
    const cached = await caches.match(req);

    const network = fetch(req).then(async (fresh) => {
      if (fresh && fresh.ok && fresh.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(network);       // refresh behind her back
      return cached;
    }
    const fresh = await network;
    return fresh || new Response('', { status: 504, statusText: 'Offline' });
  })());
});
