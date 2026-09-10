// ─── Service worker do RampControll ────────────────────────────────────────
// Reescrito em 10/09/2026. Motivo: os líderes preenchem o relatório num lugar
// de internet ruim e reclamavam que **nem conseguiam abrir o app**, o que os
// obrigava a preencher tudo de uma vez no fim do turno.
//
// 🔥 POR QUE NÃO ABRIA: a versão antiga guardava só '/', '/index.html' e
// '/manifest.json'. Os arquivos de JavaScript e CSS que a Vercel gera moram em
// /assets/ com o nome cheio de hash, e NENHUM deles era guardado. Sem rede, o
// navegador servia o HTML do cache e não achava o resto: tela branca. Junto
// disso, o Tailwind e a fonte vêm de CDN, então mesmo o que abrisse viria sem
// estilo nenhum.
//
// 🔴 A TROCA DE NOME DO CACHE SÓ É SEGURA COM A LIMPEZA NO 'activate', e é por
// isso que ela existe aqui embaixo. `caches.match` varre TODOS os caches da
// origem: sem apagar o antigo, o 'rampcontroll-v1' continuaria respondendo
// primeiro e a versão nova nunca apareceria. Trocar o nome sem limpar é pior
// que não trocar.
//
// 🔥 ESTE ARQUIVO PRECISA MORAR EM `public/`, E ESSE ERA O DEFEITO DE VERDADE.
// Ele vivia na raiz do projeto, que a Vite NÃO copia pro build. Conferido na
// produção em 10/09/2026: `app-rampa2.vercel.app/sw.js` respondia **404**. O
// registro no index.html falhava calado (tem um `.catch` que só faz console),
// então o app NUNCA teve service worker no ar. Não era cache velho nem
// estratégia errada: não havia nada. Só a pasta `public/` faz o arquivo chegar
// na Vercel com o endereço `/sw.js`, que é o que dá a ele o escopo do site.
//
// 📌 AO SUBIR VERSÃO NOVA DO APP, SUBIR ESTE NÚMERO. É o que aposenta o cache
// antigo e faz o líder receber o app novo.
const CACHE = 'rampcontroll-v2';

// Só o que existe com nome fixo. O resto (os /assets/ com hash) entra sozinho
// conforme o app é usado, porque o nome deles muda a cada publicação e não dá
// pra listar aqui sem gerar este arquivo no build.
//
// ⚠️ '/manifest.json' NÃO ENTRA nesta lista, por mais que o arquivo exista no
// projeto: a Vite o renomeia pra /assets/manifest-<hash>.json no build, e na
// produção o endereço antigo dá 404. Como `cache.addAll` é tudo ou nada, UM
// endereço quebrado deixaria o app inteiro sem cache. Ele entra sozinho pela
// regra de arquivos, no primeiro uso.
const CASCA = ['/', '/index.html'];

// De onde vêm o Tailwind e a fonte. Sem guardar isso, o app abre offline sem
// estilo, que na prática é não abrir.
const CDNS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

// 🔴 O SUPABASE NUNCA PODE SER GUARDADO. É dado vivo: frota, líderes,
// companhias e os relatórios já gravados. Servir isso do cache mostraria
// equipamento parado que já voltou, e o líder tomaria decisão em cima de
// informação velha sem nada avisando na tela.
const ehSupabase = (url) => url.hostname.includes('supabase');

self.addEventListener('install', (event) => {
  // skipWaiting: sem isso a versão nova fica esperando o líder fechar TODAS as
  // abas do app, o que num celular com o app instalado quase nunca acontece.
  self.skipWaiting();
  // Um a um, e não `addAll`: assim um endereço que falhe não leva junto os
  // outros, e o app fica com o que deu pra guardar em vez de ficar sem nada.
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(
      CASCA.map((url) => cache.add(url).catch(() => {}))
    ))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// Guarda a resposta sem deixar um erro de cache derrubar a navegação.
const guardar = (req, resp) => {
  if (!resp || resp.status !== 200) return resp;
  const copia = resp.clone();
  caches.open(CACHE).then((cache) => cache.put(req, copia)).catch(() => {});
  return resp;
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (ehSupabase(url)) return;              // vai direto pra rede, sempre

  const mesmaOrigem = url.origin === self.location.origin;
  const ehCDN = CDNS.some((c) => url.href.startsWith(c));
  if (!mesmaOrigem && !ehCDN) return;

  // ─── Navegação (abrir o app) ─────────────────────────────────────────────
  // 🔑 CACHE PRIMEIRO, e a rede atualiza por trás. Foi escolhido sabendo do
  // custo: depois de uma publicação, o líder vê a versão anterior UMA vez e a
  // seguinte já vem nova. O contrário (rede primeiro) faria o app ficar
  // rodando a bolinha justamente onde o sinal é ruim, que é o problema que
  // esta reescrita veio resolver.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((doCache) => {
        const daRede = fetch(req).then((resp) => guardar('/index.html', resp)).catch(() => null);
        return doCache || daRede.then((r) => r || new Response(
          '<meta charset="utf-8"><p style="font-family:sans-serif;padding:24px">Abra o app uma vez com internet para ele passar a funcionar offline.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        ));
      })
    );
    return;
  }

  // ─── Arquivos ────────────────────────────────────────────────────────────
  // Cache primeiro e guarda o que for novo. Os /assets/ da Vercel têm hash no
  // nome, então o conteúdo de um mesmo endereço nunca muda: servir do cache é
  // seguro, e o arquivo velho some junto com o cache velho na próxima versão.
  event.respondWith(
    caches.match(req).then((doCache) => {
      if (doCache) return doCache;
      return fetch(req)
        .then((resp) => guardar(req, resp))
        .catch(() => doCache || Response.error());
    })
  );
});
