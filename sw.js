const CACHE = 'avustralya-v1';
const BASE  = '/words/';

const CORE = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png'
];

const WEEKS = [];
for (let i = 1; i <= 52; i++) {
  WEEKS.push(BASE + 'Week' + String(i).padStart(2, '0') + '_words.json');
}

/* ── INSTALL: cache core files (must succeed) + week files (best-effort) ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(async cache => {
      await cache.addAll(CORE);
      await Promise.allSettled(WEEKS.map(url => cache.add(url).catch(() => {})));
      return self.skipWaiting();
    })
  );
});

/* ── ACTIVATE: remove old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── FETCH strategy ──
   Week JSON files  → network-first (picks up updates automatically when online)
   Everything else  → cache-first   (fast, works offline)
── */
self.addEventListener('fetch', event => {
  const url = event.request.url;
  const isWeekJson = /Week\d{2}_words\.json/.test(url);

  if (isWeekJson) {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request))
    );
  }
});

/* ── MESSAGE: force-refresh a specific week file ── */
self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'REFRESH_WEEK') return;
  const url = event.data.url;
  event.waitUntil(
    fetch(url, { cache: 'no-store' })
      .then(resp => {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return caches.open(CACHE).then(c => c.put(url, resp.clone())).then(() => resp);
      })
      .then(() => event.source && event.source.postMessage({ type: 'REFRESH_DONE', url }))
      .catch(() => event.source && event.source.postMessage({ type: 'REFRESH_FAIL', url }))
  );
});
