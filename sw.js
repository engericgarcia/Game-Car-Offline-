/* Service worker: guarda tudo no cache para o jogo abrir sem internet */
/* Ao editar o jogo, suba o número desta versão (e o ?v= no index.html)
   para o celular baixar os arquivos novos na próxima abertura. */
const CACHE = 'driftgp-v10';
const V = 'v=10';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './style.css?' + V,
  './js/utils.js?' + V, './js/tracks.js?' + V, './js/car.js?' + V, './js/ai.js?' + V,
  './js/audio.js?' + V, './js/render.js?' + V, './js/game.js?' + V,
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* A página HTML tenta a rede primeiro (para receber atualizações) e cai
   no cache se estiver offline. Os demais arquivos vêm do cache na hora,
   porque a URL deles já carrega a versão (?v=N). */
function isDoc(req) {
  return req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (isDoc(req)) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
