// Service worker da versão instalável (celular e navegador).
//
// - Arquivos do app (JS/CSS com hash no nome, ícones): guardados na primeira visita e servidos
//   do cache — o app abre instantâneo e funciona sem internet.
// - Página inicial e base de concursos: tenta a rede primeiro, para pegar versão nova do app
//   e concursos novos; sem internet, usa a última cópia guardada.
// - API da Caixa: nunca passa pelo cache.

const VERSAO = 'lotofacil-v1';
const ESSENCIAIS = ['./', './index.html', './manifest.webmanifest', './icone-192.png', './icone-512.png', './data/lotofacil.json'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(VERSAO)
      .then((cache) => cache.addAll(ESSENCIAIS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

async function redePrimeiro(requisicao) {
  const cache = await caches.open(VERSAO);
  // a base é pedida com ?t=… para furar cache HTTP; guarda uma cópia só, sem a query
  const u = new URL(requisicao.url);
  const chave = u.origin + u.pathname;
  try {
    const resposta = await fetch(requisicao);
    if (resposta.ok) cache.put(chave, resposta.clone());
    return resposta;
  } catch {
    const guardada = (await cache.match(chave)) ?? (await cache.match(requisicao, { ignoreSearch: true })) ?? (await cache.match('./index.html'));
    if (guardada) return guardada;
    throw new Error('Sem internet e sem cópia guardada.');
  }
}

async function cachePrimeiro(requisicao) {
  const cache = await caches.open(VERSAO);
  const guardada = await cache.match(requisicao);
  if (guardada) return guardada;
  const resposta = await fetch(requisicao);
  if (resposta.ok) cache.put(requisicao, resposta.clone());
  return resposta;
}

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Caixa e afins: direto na rede
  if (url.pathname.includes('/api/')) return;

  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/data/lotofacil.json')) {
    evento.respondWith(redePrimeiro(req));
    return;
  }

  evento.respondWith(cachePrimeiro(req));
});
