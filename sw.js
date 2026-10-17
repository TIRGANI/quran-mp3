// Service worker : met l'application en cache et sert les sourates téléchargées hors ligne.
const SHELL = 'shell-v4';
const AUDIO = 'audio-v1'; // même nom que dans index.html

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    const files = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'fonts/fonts.css'];
    // Ajoute les fichiers de police référencés par fonts.css
    try {
      const css = await (await fetch('fonts/fonts.css')).text();
      for (const m of css.matchAll(/url\(([^)]+)\)/g)) files.push('fonts/' + m[1].replace(/['"]/g, ''));
    } catch {}
    await Promise.all([...new Set(files)].map(f => cache.add(f).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (![SHELL, AUDIO].includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Les MP3 peuvent venir du site lui-même ou du CDN mp3quran.net
  if (url.pathname.endsWith('.mp3')) {
    event.respondWith(serveAudio(req, url));
    return;
  }
  if (url.origin !== location.origin) return;
  // Application : cache d'abord, mise à jour en arrière-plan
  event.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached || cache.match('index.html'));
    return cached || network;
  })());
});

// Les navigateurs (Safari surtout) demandent l'audio par morceaux (en-tête Range) :
// on découpe le fichier en cache pour répondre en 206.
async function serveAudio(req, url) {
  const cached = await (await caches.open(AUDIO)).match(url.href);
  if (!cached) return fetch(req);
  const range = req.headers.get('range');
  if (!range) return cached;
  const blob = await cached.blob();
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  let start, end;
  if (m[1] === '' && m[2]) { start = Math.max(0, blob.size - +m[2]); end = blob.size - 1; }
  else { start = +(m[1] || 0); end = m[2] ? Math.min(+m[2], blob.size - 1) : blob.size - 1; }
  if (start >= blob.size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${blob.size}` } });
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${blob.size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
