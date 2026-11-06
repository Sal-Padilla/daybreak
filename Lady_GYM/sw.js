// Lady_GYM — sw.js — works with no signal in the weight room, and updates itself when there is one.
//
// Code (HTML/JS/CSS/JSON) is network-first with a short timeout: with signal she always gets
// the newest version; in a basement gym with none, the saved copy opens instantly.
// Pictures are cache-first. Launch-screen PNGs are not precached — iOS fetches them once
// itself, when the app is added to the Home Screen.
//
// Keep CACHE in step with js/version.js — tools/check.mjs fails the build if they drift.

const CACHE = 'lady-gym-1.0.1';

const ASSETS = [
  './',
  './index.html',
  './get.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/qr.svg',
  './css/app.css',
  './css/screens.css',
  './css/tokens.css',
  './js/app.js',
  './js/art/figure.js',
  './js/art/scenes.js',
  './js/core/db.js',
  './js/core/nav.js',
  './js/core/store.js',
  './js/data/classes.js',
  './js/data/diagrams.js',
  './js/data/exercises.js',
  './js/data/inbody.js',
  './js/data/info.js',
  './js/data/pillars.js',
  './js/data/programs.js',
  './js/data/schedule.js',
  './js/data/standards.js',
  './js/data/warmup.js',
  './js/dev/seed.js',
  './js/engine/lifestage.js',
  './js/engine/progression.js',
  './js/engine/readiness.js',
  './js/engine/recommend.js',
  './js/engine/report.js',
  './js/engine/scheduler.js',
  './js/engine/sessionplan.js',
  './js/engine/shapemap.js',
  './js/features/classes.js',
  './js/features/install.js',
  './js/features/onboarding.js',
  './js/features/player.js',
  './js/features/profile.js',
  './js/features/progress.js',
  './js/features/shared.js',
  './js/features/today.js',
  './js/features/workouts.js',
  './js/ui/icons.js',
  './js/ui/kit.js',
  './js/ui/rings.js',
  './js/ui/timer.js',
  './js/version.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map(async (path) => {
      try { await cache.add(new Request(path, { cache: 'reload' })); } catch (err) {
        console.warn('Lady_GYM SW: could not precache', path, err);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('lady-gym-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const WAIT_MS = 3500;
const CODE = ['.js', '.mjs', '.css', '.html', '.json', '.webmanifest'];
const isCode = (url) => url.pathname.endsWith('/') || CODE.some((e) => url.pathname.endsWith(e));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const offline = () => new Response('Lady_GYM is offline and this file is not saved yet.',
  { status: 503, headers: { 'content-type': 'text/plain' } });

// The app's own folder, /daybreak/Lady_GYM/ on GitHub Pages.
const SCOPE = new URL('./', self.location.href).pathname;

async function fetchAndStore(url, key, init) {
  const res = await fetch(url, init);
  if (key && res && res.ok && res.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(key, res.clone());
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate' || isCode(url)) {
    const nav = req.mode === 'navigate';
    // A page load is saved only as one of the app's two pages: the shell (the folder itself, or
    // index.html) and get.html. Any other page in the folder — a docs page Pages renders, say — is
    // fetched but never saved over the shell; offline it still falls back to the saved shell.
    const page = url.pathname === SCOPE || url.pathname === SCOPE + 'index.html' ? './index.html'
      : url.pathname === SCOPE + 'get.html' ? './get.html' : null;
    const key = nav ? (page || './index.html') : req;
    const net = fetchAndStore(url.href, nav ? page : req, { cache: 'no-cache', credentials: 'same-origin' });
    event.waitUntil(net.then(() => {}, () => {}));
    event.respondWith((async () => {
      try {
        const res = await Promise.race([net, sleep(WAIT_MS).then(() => Promise.reject(new Error('slow')))]);
        if (res.ok) return res;
      } catch (_) { /* offline or slow: use the saved copy */ }
      // Only from Lady_GYM's own cache. caches.match() searches every cache on the site, oldest
      // first, and Daybreak's old worker saved copies of Lady_GYM files into daybreak-* caches on
      // phones that had Daybreak — an out-of-date copy from there could break an offline start.
      const cached = await (await caches.open(CACHE)).match(key, { ignoreSearch: true });
      if (cached) return cached;
      try { return await net; } catch (_) { return offline(); }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE)).match(req);
    if (cached) return cached;
    try { return await fetchAndStore(req.url, req, {}); } catch (_) { return offline(); }
  })());
});
