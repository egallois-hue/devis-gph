/* Service worker : l'application fonctionne hors connexion (dictée, mise en forme, PDF).
   Les données se synchronisent quand le réseau revient. */
const VERSION = "gph-v7";
const SHELL = ["./", "index.html", "styles.css?v=7", "app.js?v=7", "engine.js?v=7", "import.js?v=7", "questions.js?v=7", "crm.js?v=7", "config.js?v=7", "fonts.js?v=7",
  "vendor/supabase.js", "vendor/jspdf.umd.min.js", "vendor/pdf-lib.min.js",
  "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;   // Supabase : toujours en direct
  // réseau d'abord (mises à jour), cache en secours hors ligne
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
