/* Service worker : l'application fonctionne hors connexion (dictée, mise en forme, PDF).
   Les données se synchronisent quand le réseau revient. */
const VERSION = "gph-v20";
const SHELL = ["./", "index.html", "styles.css?v=20", "app.js?v=20", "engine.js?v=20", "import.js?v=20", "questions.js?v=20", "crm.js?v=20", "dashboard.js?v=20", "extras.js?v=20", "config.js?v=20", "fonts.js?v=20",
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
