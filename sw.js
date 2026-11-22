/* Офлайн-кэш оболочки приложения (только файлы этого сайта).
   Запросы к Supabase (другой домен) не кэшируются и идут напрямую. */
const CACHE = 'ecomlena-tasks-v3';
const SHELL = ['./', './index.html', './styles.css', './config.js', './storage.js', './app.js', './vendor/supabase-2.119.2.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // Supabase и шрифты мимо кэша
  // сначала сеть (чтобы обновления приходили сразу), без сети из кэша
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
