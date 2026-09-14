// Daybreak — sw.js — offline shell. Every path is relative: this ships to a GitHub Pages subpath.

// Bump this on any change to the strategy below. Asset freshness no longer depends on it —
// network-first handles that for code — but a new name forces one clean sweep of old caches.
const CACHE = 'daybreak-v0.9.2';

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
  './js/data/inbody.js',
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
    const upgrading = keys.some((k) => k.startsWith('daybreak-') && k !== CACHE);
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'daybreak:updated', version: CACHE });
      // On an UPGRADE, reload every open copy onto the new code. The page open right now is
      // running the old app.js, which cannot reload itself, and an iPhone Home Screen app is
      // resumed rather than relaunched, so "close it and reopen" never loads anything new.
      // Sets are saved to the phone as they are logged, so a reload loses nothing saved.
      if (upgrading && typeof client.navigate === 'function') {
        try { await client.navigate(client.url); } catch (_) { /* the page catches it on focus */ }
      }
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'daybreak:skip-waiting') self.skipWaiting();
});

// CODE IS NETWORK-FIRST. It used to be stale-while-revalidate: serve the saved copy, fetch the
// new one for "next time". So a fresh page loaded yesterday's JavaScript, and on a phone that
// resumes apps instead of relaunching them, next time never came — Rocio went looking for the
// InBody screen on a copy that had never received it. Online she now always gets the current
// code; offline, or on a signal too slow to wait for, she gets the saved copy.
const NETWORK_WAIT_MS = 4000;
const CODE_EXT = ['.js', '.mjs', '.css', '.html', '.json', '.webmanifest'];

const isCode = (url) => url.pathname.endsWith('/') || CODE_EXT.some((e) => url.pathname.endsWith(e));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const offline = () => new Response('Daybreak is offline and this file is not saved yet.',
  { status: 503, headers: { 'content-type': 'text/plain' } });

async function fetchAndStore(url, key, init) {
  const res = await fetch(url, init);
  if (res && res.ok && res.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(key, res.clone());
  }
  return res;
}

async function networkFirst(net, key) {
  try {
    const res = await Promise.race([net, sleep(NETWORK_WAIT_MS).then(() => Promise.reject(new Error('slow')))]);
    if (res.type === 'opaqueredirect' || res.ok) return res;
  } catch (_) { /* offline or too slow: use the saved copy */ }
  const cached = await caches.match(key, { ignoreSearch: true });
  if (cached) return cached;
  try { return await net; } catch (_) { return offline(); }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate' || isCode(url)) {
    const navigate = req.mode === 'navigate';
    const key = navigate ? './index.html' : req;
    // no-cache revalidates with the server every time, so GitHub Pages' ten-minute HTTP cache
    // cannot hand back the old file either. An unchanged file costs a tiny 304.
    const init = navigate
      ? { cache: 'no-cache', credentials: 'same-origin', redirect: 'manual' }
      : { cache: 'no-cache', credentials: 'same-origin' };
    const net = fetchAndStore(url.href, key, init);
    event.waitUntil(net.then(() => {}, () => {}));
    event.respondWith(networkFirst(net, key));
    return;
  }

  // Icons and images: stale-while-revalidate. They rarely change, and instant matters more.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetchAndStore(req.url, req, {}).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    return (await network) || offline();
  })());
});
