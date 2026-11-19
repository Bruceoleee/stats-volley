// Garde l'app disponible même avec un réseau faible au gymnase.
// Les données passent toujours par Supabase (jamais mises en cache ici).
const CACHE = "stats-volley-v2";
const SHELL = [
  "./", "./index.html", "./style.css", "./config.js",
  "./app.js", "./passeurs.js", "./equipe.js", "./pdf.js",
  "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"
];
const LIBS = [
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).then(() => Promise.allSettled(LIBS.map(u => c.add(u))))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.hostname.endsWith("supabase.co")) return;
  // Réseau d'abord pour avoir la dernière version, cache si hors ligne.
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
