/* GuGa · service worker: o app abre sem internet.
 * - App e bibliotecas: cache primeiro.
 * - Dados do IPH/UFRGS: cache primeiro (mudam raramente; nova versão = novo nome de cache).
 * - APIs ao vivo (nível, chuva): rede primeiro, cópia em cache como reserva marcada pelo app.
 * - Tiles do mapa e do relevo: guardados conforme a pessoa navega (até 1500), para o bairro dela funcionar offline.
 */
const VERSAO = "guga-0.19.0";
const APP = [
  "./", "index.html", "app.css", "manifest.webmanifest", "icons/guga.svg", "icons/guga-192.png", "icons/guga-180.png", "icons/guga-maskable-192.png", "icons/guga-maskable-512.png",
  "vendor/maplibre-gl.js", "vendor/maplibre-gl.css", "vendor/three.min.js", "vendor/fonts.css",
  "vendor/fonts/barlow-condensed-latin-700-italic.woff2", "vendor/fonts/barlow-condensed-latin-600-italic.woff2", "vendor/fonts/atkinson-hyperlegible-latin-400-normal.woff2", "vendor/fonts/atkinson-hyperlegible-latin-700-normal.woff2", "vendor/fonts/ibm-plex-mono-latin-500-normal.woff2",
  "js/config.js", "js/icones.js", "js/voz.js", "js/data.js", "js/modelo.js", "js/backend.js", "js/live.js", "js/mapa.js", "js/busca.js", "js/casa.js", "js/simulador.js",
  "js/relatar.js", "js/morro.js", "js/guia.js", "js/cobrar.js", "js/compartilhar.js", "js/vergonha.js", "js/resgate.js", "js/inicio.js", "js/instalar.js", "js/app.js",
  "data/poa_cotas.geojson", "data/poa_bairros.geojson", "data/rmpa_polders.geojson", "data/rmpa_diques.geojson",
  "data/rmpa_comportas.geojson", "data/rmpa_ebaps.geojson", "data/abrigos_2024.geojson", "data/poa_marcas_2024.geojson",
  "data/rh_mancha_2024.geojson", "data/rh_bacia.geojson", "data/municipios_rs.json", "data/barragens_2024.geojson", "data/situacao_atual.json", "data/poa_cotas_resumo.json",
];
const TILES = "guga-tiles";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO && k !== TILES).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function limitar(nome, max) {
  const c = await caches.open(nome), ks = await c.keys();
  for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // APIs ao vivo: rede primeiro
  // estilo e índice do mapa vetorial mudam de versão: rede primeiro (os tiles em si ficam guardados, logo abaixo)
  const estiloMapa = /tiles\.openfreemap/.test(url.href) && !/\.(pbf|png|webp|jpg)$|\/fonts\/|\/sprites?\//.test(url.pathname);
  if (estiloMapa || /open-meteo|nominatim|functions\/v1|rest\/v1/.test(url.href)) {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(VERSAO).then((c) => c.put(req, cp)); return r; }).catch(() => caches.match(req)));
    return;
  }
  // tiles do mapa / relevo
  if (/basemaps\.cartocdn|tiles\.openfreemap|elevation-tiles|fonts\.gstatic/.test(url.href)) {
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === "opaque") { c.put(req, r.clone()); limitar(TILES, 1500); }
      return r;
    }));
    return;
  }
  // app e dados: cache primeiro
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok && url.origin === location.origin) { const cp = r.clone(); caches.open(VERSAO).then((c) => c.put(req, cp)); }
    return r;
  }).catch(() => req.mode === "navigate" ? caches.match("index.html") : undefined)));
});

// Alertas push (servidor envia quando o nível passa da cota salva pela pessoa)
self.addEventListener("push", (e) => {
  const d = e.data ? e.data.json() : { titulo: "GuGa", corpo: "Alerta de cheia na sua região." };
  e.waitUntil(self.registration.showNotification(d.titulo, { body: d.corpo, icon: "icons/guga-192.png", "icons/guga-180.png", "icons/guga-maskable-192.png", "icons/guga-maskable-512.png", badge: "icons/guga-192.png", tag: d.tag || "guga", requireInteraction: !!d.critico }));
});
self.addEventListener("notificationclick", (e) => { e.notification.close(); e.waitUntil(self.clients.openWindow("./#casa")); });
