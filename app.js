"use strict";

/* ===================== Utilitaires ===================== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = v => { if (v === null || v === undefined || v === "") return null; const n = Number(String(v).replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : null; };
const eur = n => (n === null || n === undefined || !isFinite(n)) ? "—" : r2(n).toLocaleString("fr-FR", {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace(/[  ]/g, " ") + " €";
const nfr = n => (n === null || n === undefined) ? "" : String(r2(n)).replace(".", ",");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const todayISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const dFR = iso => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
const addMonths = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(y, m - 1 + n, d); return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0"); };
const UNITES = ["m²", "ml", "u", "forfait", "h", "jour", "m³", "kg", "lot", "ens."];
function toast(msg, ms = 2600) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

/* ===================== Réglages par défaut ===================== */
const DEFAULT_CFG = {
  societe: "GALLOIS PH",
  forme: "EURL au capital de 4 000 €",
  activites1: "Rénovation · Carrelage · Peinture · Parquet",
  activites2: "Isolation · Électricité · Plomberie",
  adresse: "7 rue de la Garenne",
  cpVille: "91470 Angervilliers",
  ville: "Angervilliers",
  tel: "06 15 79 38 37",
  email: "",
  siret: "487 442 584 00032",
  rcs: "RCS Évry 487 442 584",
  ape: "43.33Z",
  tvaIntra: "FR93 487 442 584",
  iban: "FR76 1870 7000 1909 0218 7329 576",
  assurance: "Assurance décennale BPCE IARD · contrat n° 191339833 U 001 · France et Principauté de Monaco",
  acomptes: [40, 40, 20],
  validiteMois: 3,
  validiteFournituresJours: 7,
  compteurs: { "2026": 3 }
};
const TVA_CERT = "Le client certifie que les travaux portent sur un local à usage d'habitation achevé depuis plus de deux ans et n'aboutissent pas à la production d'un immeuble neuf (art. 279-0 bis du CGI). À défaut, la TVA de 20 % s'applique.";


/* ===================== État ===================== */
const CFG = window.GPH_CONFIG || {};
const S = {
  sb: null, session: null, uid: null, online: navigator.onLine, syncing: false, lastSync: lsGet("gph_lastsync", null),
  cfg: Object.assign({}, DEFAULT_CFG, lsGet("gph_cfg", {})),
  devis: lsGet("gph_devis", []), biblio: lsGet("gph_biblio", []), clients: lsGet("gph_clients", []),
  view: "list", draft: null, step: 1, pjCache: {}, ready: false
};

/* ===================== Numérotation (exercice 1er oct → 30 sept) ===================== */
function exerciceKey(iso) { const [y, m] = iso.split("-").map(Number); return String(m >= 10 ? y : y - 1); }
function exerciceLabel(k) { return `${k}-${Number(k) + 1}`; }
/* Suivi d'un devis émis */
const ETATS = [["attente", "En attente", "grey"], ["envoye", "Envoyé", "b"], ["accepte", "Accepté", "g"], ["acompte1", "Acompte 1 reçu", "g"],
  ["en_cours", "Chantier en cours", "w"], ["acompte2", "Acompte 2 reçu", "w"], ["fini", "Chantier fini", "b"], ["paye", "Payé", "ok"]];
const ETAT_FICHIER = { attente: "EN-ATTENTE", envoye: "ENVOYE", accepte: "ACCEPTE", acompte1: "ACOMPTE-1-RECU", en_cours: "CHANTIER-EN-COURS", acompte2: "ACOMPTE-2-RECU", fini: "CHANTIER-FINI", paye: "PAYE" };
function etatOf(d) { if (d.statut !== "finalise") return null; const e = d.etat === "fini_paye" ? "paye" : (d.etat || "attente"); return ETAT_FICHIER[e] ? e : "attente"; }
/* « En retard » : automatique quand la fin annoncée est passée et que le chantier n'est pas fini */
function isLate(d) { const e = etatOf(d); return !!(e && d.finPrevue && ["accepte", "acompte1", "en_cours", "acompte2"].includes(e) && todayISO() > d.finPrevue); }
function addWorkDays(iso, n) { const t = new Date(iso + "T12:00:00"); let k = Math.max(0, Math.ceil(n) - 1); while (t.getDay() === 0 || t.getDay() === 6) t.setDate(t.getDate() + 1);
  while (k > 0) { t.setDate(t.getDate() + 1); if (t.getDay() !== 0 && t.getDay() !== 6) k--; } return t.toISOString().slice(0, 10); }
function etatPill(d) { const e = etatOf(d); if (!e) return `<span class="pill grey">${d.importe ? "Importé · à vérifier" : "Brouillon"}</span>`; const x = ETATS.find(z => z[0] === e) || ETATS[0];
  return `<span class="pill ${x[2]}">${x[1]}</span>${isLate(d) ? `<br><span class="pill r" style="margin-top:4px">En retard</span>` : ""}`; }
function nextNumero(iso) {
  const k = exerciceKey(iso);
  let max = Number((S.cfg.compteurs || {})[k] || 0);
  for (const d of S.devis) if (d.numero && d.exercice === k) { const n = Number(String(d.numero).split("N")[1]); if (n > max) max = n; }
  const n = max + 1;
  return { numero: iso.slice(0, 4) + iso.slice(5, 7) + "N" + String(n).padStart(2, "0"), n, k };
}

/* ===================== Calculs ===================== */
function lineTotal(l) { const q = num(l.quantite), p = num(l.pu); return (q === null || p === null) ? null : r2(q * p); }
function totaux(d) {
  let ht = 0, incomplet = 0;
  for (const s of d.sections) for (const l of s.lignes) { const t = lineTotal(l); if (t === null) incomplet++; else ht = r2(ht + t); }
  const taux = Number(d.tva ?? 10) / 100;
  const tva = r2(ht * taux), ttc = r2(ht + tva);
  const p = d.acomptes || S.cfg.acomptes || [40, 40, 20];
  const a1 = r2(ttc * p[0] / 100), a2 = r2(ttc * (p[1] || 0) / 100);
  const solde = r2(ttc - a1 - a2);
  return { ht, tva, ttc, a1, a2, solde, incomplet, p };
}
function problemes(d) {
  const out = [];
  if (!d.client?.nom?.trim()) out.push("Le nom du client est vide.");
  let i = 0;
  for (const s of d.sections) for (const l of s.lignes) {
    i++;
    if (!l.designation?.trim()) out.push(`Ligne ${i} : désignation vide.`);
    if (num(l.quantite) === null) out.push(`Ligne ${i} (${l.designation || "?"}) : quantité manquante.`);
    if (num(l.pu) === null) out.push(`Ligne ${i} (${l.designation || "?"}) : ${l.type === "fourniture" ? "prix fournisseur à saisir" : "prix manquant"}.`);
  }
  if (!i) out.push("Le devis ne contient aucune ligne.");
  return out;
}


/* ===================== Données : cache local + synchronisation Supabase ===================== */
function saveLocal() { lsSet("gph_cfg", S.cfg); lsSet("gph_devis", S.devis); lsSet("gph_biblio", S.biblio); lsSet("gph_clients", S.clients); }
const COLL = { devis: "devis", biblio: "biblio", clients: "clients", config: "config" };
function queue() { return lsGet("gph_queue", []); }
function setQueue(q) { lsSet("gph_queue", q); }
async function put(path, data) {
  saveLocal();
  const [collection, id] = path.split("/");
  const q = queue().filter(x => !(x.collection === collection && x.id === id));
  q.push({ collection, id, data: JSON.parse(JSON.stringify(data)), deleted: false });
  setQueue(q); flush();
}
async function del(path) {
  saveLocal();
  const [collection, id] = path.split("/");
  const q = queue().filter(x => !(x.collection === collection && x.id === id));
  q.push({ collection, id, data: {}, deleted: true }); setQueue(q); flush();
}
let flushing = false;
async function flush() {
  if (flushing || !S.sb || !S.uid || !navigator.onLine) { renderSync(); return; }
  flushing = true; renderSync();
  try {
    let q = queue();
    while (q.length) {
      const batch = q.slice(0, 50);
      const { error } = await S.sb.from("docs").upsert(batch.map(x => ({ owner: S.uid, collection: x.collection, id: x.id, data: x.data, deleted: x.deleted })), { onConflict: "owner,collection,id" });
      if (error) throw error;
      q = queue().slice(batch.length); setQueue(q);
    }
  } catch (e) { console.warn("sync", e); S.syncErr = e.message || String(e); }
  flushing = false; renderSync();
}
function applyRow(r) {
  const list = r.collection === "devis" ? S.devis : r.collection === "biblio" ? S.biblio : r.collection === "clients" ? S.clients : null;
  if (r.collection === "config") { if (!r.deleted && r.id === "app") S.cfg = Object.assign({}, DEFAULT_CFG, r.data); return; }
  if (!list) return;
  const i = list.findIndex(x => x.id === r.id);
  if (r.deleted) { if (i >= 0) list.splice(i, 1); return; }
  const pend = queue().some(x => x.collection === r.collection && x.id === r.id);   // modification locale en attente : elle gagne
  if (pend) return;
  if (S.draft && S.draft.id === r.id) return;
  if (i >= 0) list[i] = r.data; else list.push(r.data);
}
async function pull(full) {
  if (!S.sb || !S.uid || !navigator.onLine) return;
  S.syncing = true; renderSync();
  try {
    let from = 0, maxTs = full ? null : S.lastSync, newest = S.lastSync;
    for (;;) {
      let qy = S.sb.from("docs").select("collection,id,data,deleted,updated_at").order("updated_at", { ascending: true }).range(from, from + 999);
      if (maxTs) qy = qy.gt("updated_at", maxTs);
      const { data, error } = await qy;
      if (error) throw error;
      for (const r of data) { applyRow(r); if (!newest || r.updated_at > newest) newest = r.updated_at; }
      if (data.length < 1000) break; from += 1000;
    }
    S.devis.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    S.lastSync = newest; lsSet("gph_lastsync", newest); S.syncErr = null; saveLocal();
    await dedupeBiblio();
  } catch (e) { console.warn("pull", e); S.syncErr = e.message || String(e); }
  S.syncing = false; render();
}
/* Doublons parfaits dans « Mes prestations » : même désignation, unité, prix et option fournitures → on garde une seule fiche */
async function dedupeBiblio() {
  const seen = new Map(), drop = [];
  const rank = b => (b.origine === "catalogue" ? 1e6 : 0) + (b.uses || 0);
  for (const b of [...S.biblio].sort((a, b) => rank(b) - rank(a))) {
    const k = [norm(b.designation), b.unite || "", num(b.pu) ?? "", !!b.fournitureComprise].join("|");
    const keep = seen.get(k);
    if (!keep) { seen.set(k, b); continue; }
    keep.uses = (keep.uses || 0) + (b.uses || 0);
    keep.aliases = [...new Set([...(keep.aliases || []), ...(b.aliases || [])])].slice(-20);
    if (!keep.details?.length && b.details?.length) keep.details = b.details;
    drop.push({ b, keep });
  }
  if (!drop.length) return 0;
  const ids = new Set(drop.map(x => x.b.id));
  for (const d of S.devis) for (const sc of d.sections || []) for (const l of sc.lignes) if (ids.has(l.biblio_id)) l.biblio_id = drop.find(x => x.b.id === l.biblio_id).keep.id;
  S.biblio = S.biblio.filter(b => !ids.has(b.id));
  for (const k of new Set(drop.map(x => x.keep))) await put("biblio/" + k.id, k).catch(() => {});
  for (const x of drop) await del("biblio/" + x.b.id).catch(() => {});
  saveLocal();
  toast(`${drop.length} prestation(s) en double supprimée(s) automatiquement.`, 4000);
  return drop.length;
}
/* Lignes strictement identiques dans un même devis issues de la dictée */
function dedupeLignes(d) {
  let n = 0;
  for (const sc of d.sections) { const seen = new Set();
    sc.lignes = sc.lignes.filter(l => { const k = [l.type, norm(l.designation), num(l.quantite), l.unite, num(l.pu), !!l.fournitureComprise].join("|"); if (seen.has(k)) { n++; return false; } seen.add(k); return true; }); }
  return n;
}
function renderSync() {
  const el = document.getElementById("syncst"); if (!el) return;
  const n = queue().length;
  el.textContent = !navigator.onLine ? "Hors ligne" + (n ? ` · ${n} en attente` : "") : S.syncErr ? "Synchro à reprendre" : (flushing || S.syncing) ? "Synchronisation…" : n ? `${n} en attente` : "À jour";
}
window.addEventListener("online", () => { S.online = true; flush(); pull(); });
window.addEventListener("offline", () => { S.online = false; renderSync(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { checkLock(); flush(); pull(); } else lastHidden = Date.now(); });
setInterval(() => { if (document.visibilityState === "visible") pull(); }, 60000);

/* ===================== Connexion ===================== */
async function boot() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY || !window.supabase) { S.ready = true; S.noBackend = true; render(); checkLock(); dedupeBiblio().then(n => n && render()); return; }
  S.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "gph_auth" } });
  const { data } = await S.sb.auth.getSession();
  setSession(data.session);
  S.sb.auth.onAuthStateChange((_e, sess) => setSession(sess));
  S.ready = true; render(); checkLock();
  if (S.uid) { await pull(!S.lastSync); flush(); }
}
function setSession(sess) {
  const prev = S.uid; S.session = sess; S.uid = sess?.user?.id || null;
  if (S.uid && S.uid !== prev && prev !== undefined) { pull(true).then(flush); }
  render();
}
async function login(email, pw) {
  const { error } = await S.sb.auth.signInWithPassword({ email, password: pw });
  if (error) return toast(error.message.includes("Invalid") ? "E-mail ou mot de passe incorrect" : "Connexion impossible : " + error.message);
  toast("Connecté");
}
async function logout() { await S.sb.auth.signOut(); lsSet("gph_lastsync", null); S.lastSync = null; render(); }
function viewLogin() {
  return `<div class="auth"><div class="card"><h2>Connexion</h2>
    <div class="hint" style="margin-bottom:8px">Connectez-vous une fois sur chaque appareil. L'iPhone et le Mac proposent ensuite de remplir le mot de passe avec Face ID ou Touch ID.</div>
    <form id="loginf" autocomplete="on"><label class="f">E-mail</label><input class="i" id="lg-email" type="email" autocomplete="username" required>
    <label class="f">Mot de passe</label><input class="i" id="lg-pw" type="password" autocomplete="current-password" required>
    <button class="btn block" style="margin-top:16px" type="submit">Se connecter</button></form></div>
    <div class="hint" style="text-align:center">Sans connexion, vous pouvez quand même dicter et générer des devis : ils restent sur cet appareil.</div>
    <button class="btn ghost block" data-a="offline-mode">Continuer sans connexion</button></div>`;
}
document.addEventListener("submit", e => { if (e.target.id === "loginf") { e.preventDefault(); login($("#lg-email").value.trim(), $("#lg-pw").value); } });

/* ===================== Verrou Face ID / Touch ID (facultatif, par appareil) ===================== */
let lastHidden = 0, unlocked = false;
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
async function lockAvailable() { try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; } }
async function enableLock() {
  try {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: "Devis Gallois PH" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "philippe", displayName: "Philippe Gallois" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" }, timeout: 60000 } });
    lsSet("gph_lock", { id: b64u(cred.rawId) }); unlocked = true; toast("Verrouillage activé sur cet appareil"); render();
  } catch (e) { toast("Activation annulée"); }
}
function disableLock() { lsSet("gph_lock", null); toast("Verrouillage désactivé"); render(); }
async function checkLock() {
  const lk = lsGet("gph_lock", null);
  if (!lk) { $("#lock").innerHTML = ""; return; }
  if (unlocked && Date.now() - lastHidden < 5 * 60000) return;
  unlocked = false;
  $("#lock").innerHTML = `<div class="lock"><div class="logo"><img src="${window.GPH_LOGO || ""}"></div><div style="font-weight:700;font-size:20px">Devis Gallois PH</div>
    <button class="btn" style="background:#fff;color:var(--roi)" data-a="unlock">Déverrouiller</button></div>`;
}
async function unlock() {
  const lk = lsGet("gph_lock", null); if (!lk) return;
  try {
    await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: "public-key", id: unb64u(lk.id) }], userVerification: "required", timeout: 60000 } });
    unlocked = true; lastHidden = Date.now(); $("#lock").innerHTML = "";
  } catch (e) { toast("Déverrouillage annulé"); }
}


/* ===================== Rendu général ===================== */
function setView(v) { S.view = v; window.scrollTo(0, 0); render(); }
function render() {
  if (!S.ready) return;
  const needLogin = !S.noBackend && !S.uid && !S.offlineMode;
  const inEditor = S.view === "edit" && !needLogin;
  $("#top").innerHTML = `${inEditor ? `<button class="back" data-a="leave">‹</button>` : ""}
    <div class="logo"><img src="${window.GPH_LOGO || ""}" alt=""></div>
    <div style="z-index:1;min-width:0"><h1>${inEditor ? (S.draft?.numero ? "Devis " + esc(S.draft.numero) : "Nouveau devis") : "Devis Gallois PH"}</h1>
    <small>${inEditor ? esc(S.draft?.client?.nom || "Client à préciser") : "Dictez · vérifiez · envoyez"}</small></div>
    ${S.uid ? `<span class="sync" id="syncst"></span>` : ""}`;
  renderSync();
  const m = $("#main"), b = $("#barwrap");
  if (needLogin) { $("#tabs").style.display = "none"; m.innerHTML = viewLogin(); b.innerHTML = ""; return; }
  $("#tabs").style.display = inEditor ? "none" : "flex";
  $("#tabs").innerHTML = [["list", "Devis"], ["clients", "Clients"], ["biblio", "Prestations"], ["reglages", "Réglages"]]
    .map(([k, l]) => `<button class="${S.view === k || (k === "clients" && S.view === "client") ? "on" : ""}" data-a="tab" data-v="${k}">${l}</button>`).join("");
  if (S.view === "list") { m.innerHTML = viewList(); b.innerHTML = `<div class="bar"><button class="btn block" data-a="new">＋ Nouveau devis</button></div>`; }
  else if (S.view === "clients") { m.innerHTML = viewClients(); b.innerHTML = `<div class="bar"><button class="btn block" data-a="cli-new">＋ Nouveau client</button></div>`; }
  else if (S.view === "client") { m.innerHTML = viewClient(); b.innerHTML = `<div class="bar"><button class="btn sec" data-a="tab" data-v="clients">Retour</button><button class="btn" data-a="cli-save">Enregistrer</button></div>`; }
  else if (S.view === "biblio") { m.innerHTML = viewBiblio(); b.innerHTML = `<div class="bar"><button class="btn block" data-a="lib-new">＋ Ajouter une prestation</button></div>`; }
  else if (S.view === "reglages") { m.innerHTML = viewReglages(); b.innerHTML = `<div class="bar"><button class="btn block" data-a="cfg-save">Enregistrer les réglages</button></div>`; }
  else if (S.view === "edit") { m.innerHTML = viewEditor(); b.innerHTML = barEditor(); }
}
function statusBanner() {
  if (S.noBackend) return `<div class="banner w">Base de données non configurée : les devis restent sur cet appareil.</div>`;
  if (!S.uid) return `<div class="banner w">Non connecté : les devis restent sur cet appareil. <a href="#" data-a="relogin">Se connecter</a></div>`;
  if (S.syncErr && navigator.onLine) return `<div class="banner w">La synchronisation n'a pas abouti (${esc(S.syncErr)}). Vos devis sont gardés sur l'appareil et repartiront automatiquement.</div>`;
  if (!S.biblio.length) return `<div class="banner i">Aucune prestation enregistrée. Importez votre catalogue dans <b>Réglages</b>.</div>`;
  return "";
}

/* ===================== Vue : liste ===================== */
function viewList() {
  const q = norm(S.q || "");
  const rows = S.devis.filter(d => !q || norm([d.numero, d.client?.nom, d.client?.cpVille, d.objet].join(" ")).includes(q))
    .filter(d => !S.fe || (S.fe === "brouillon" ? d.statut !== "finalise" : S.fe === "retard" ? isLate(d) : etatOf(d) === S.fe))
    .sort((a, b) => String(b.numero || "~").localeCompare(String(a.numero || "~")) || (b.updatedAt || 0) - (a.updatedAt || 0));
  const cnt = e => S.devis.filter(d => e === "brouillon" ? d.statut !== "finalise" : e === "retard" ? isLate(d) : etatOf(d) === e).length;
  const chips = [["", "Tous", S.devis.length], ["retard", "⚠ En retard", cnt("retard")], ...ETATS.map(x => [x[0], x[1], cnt(x[0])]), ["brouillon", "Brouillons", cnt("brouillon")]].filter(x => x[0] === "" || x[2])
    .map(x => `<button class="chip ${(S.fe || "") === x[0] ? "on" : ""}" data-a="fe" data-e="${x[0]}">${x[1]} <b>${x[2]}</b></button>`).join("");
  const k = exerciceKey(todayISO());
  const fin = S.devis.filter(d => d.statut === "finalise" && d.exercice === k);
  const ca = fin.reduce((a, d) => a + (d.totaux?.ht || 0), 0);
  const nbLate = cnt("retard");
  return statusBanner() + (nbLate ? `<div class="banner w" data-a="fe" data-e="retard" style="cursor:pointer"><b>${nbLate} chantier(s) en retard</b> : la fin annoncée est passée. Touchez pour les voir.</div>` : "") + `
  <div class="card">
    <div class="row" style="align-items:center">
      <div><div class="hint">Exercice ${exerciceLabel(k)}</div><div style="font-size:22px;font-weight:700;color:var(--roi)">${fin.length} devis</div></div>
      <div style="text-align:right"><div class="hint">Total HT émis</div><div style="font-size:18px;font-weight:700">${eur(ca)}</div></div>
    </div>
    <div class="hint" style="margin-top:6px">Prochain numéro : <b>${nextNumero(todayISO()).numero}</b></div>
  </div>
  <input class="i" placeholder="Rechercher un client, un numéro…" value="${esc(S.q || "")}" data-in="q" style="margin-bottom:10px">
  <div class="chips">${chips}</div>
  <div class="card list">${rows.length ? rows.map(d => `
    <div class="it" data-a="open" data-id="${d.id}">
      <div class="m"><div class="t">${esc(d.client?.nom || "Sans client")}</div>
      <div class="s">${d.numero ? esc(d.numero) : "Brouillon"} · ${dFR(d.date)} · ${esc(d.objet || "")}</div></div>
      <div style="text-align:right"><div class="a">${eur(d.totaux?.ttc)}</div>
      ${etatPill(d)}</div>
    </div>`).join("") : `<div class="empty">${S.devis.length ? "Aucun résultat." : "Aucun devis pour l'instant.<br>Touchez « Nouveau devis » et dictez."}</div>`}
  </div>
  <div class="card"><h2>Importer des devis déjà faits</h2>
    <div class="hint" style="margin-bottom:10px">Fichiers Word (.doc, .docx) ou PDF. Vous pouvez en choisir plusieurs à la fois. Chaque devis est remis au nouveau format, garde son numéro, puis vous le vérifiez avant de le générer.</div>
    <label class="btn sec block">Choisir les fichiers<input type="file" multiple accept=".doc,.docx,.pdf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden data-a="devis-import"></label>
  </div>`;
}

/* ===================== Vue : bibliothèque ===================== */
function viewBiblio() {
  const q = norm(S.qb || "");
  const items = S.biblio.filter(b => !q || norm(b.metier + " " + b.designation).includes(q))
    .sort((a, b) => (a.metier || "").localeCompare(b.metier || "") || (b.uses || 0) - (a.uses || 0));
  let g = null, html = "";
  for (const b of items) {
    if (b.metier !== g) { g = b.metier; html += `<div class="lib-g">${esc(g || "Divers")}</div>`; }
    html += `<div class="it" data-a="lib-edit" data-id="${b.id}"><div class="m"><div class="t" style="white-space:normal">${esc(b.designation)}</div>
      <div class="s">${b.origine === "auto" ? `<span class="pill w">Créée automatiquement</span> ` : b.origine === "manuel" ? `<span class="pill">Ajoutée</span> ` : ""}${b.pu === null || b.pu === undefined ? `<span class="pill w">Prix à définir</span> ` : ""}${b.uses ? `utilisée ${b.uses}×` : ""}</div></div>
      <div class="a">${eur(b.pu)}<div class="s" style="text-align:right">/ ${esc(b.unite)}</div></div></div>`;
  }
  return statusBanner() + `
  <div class="banner i">Vos prix de main-d'œuvre. Le moteur les reconnaît dans la dictée et les propose. À chaque devis généré, il apprend vos formulations, met à jour les prix réutilisés et ajoute les prestations nouvelles. Les fournitures n'ont jamais de prix ici.</div>
  <input class="i" placeholder="Rechercher une prestation…" value="${esc(S.qb || "")}" data-in="qb" style="margin-bottom:12px">
  <div class="card list">${html || `<div class="empty">Aucune prestation.</div>`}</div>`;
}
function libModal(id) {
  const b = id ? S.biblio.find(x => x.id === id) : { id: uid(), metier: "", designation: "", details: [], unite: "m²", pu: null, origine: "manuel", uses: 0 };
  const metiers = [...new Set(S.biblio.map(x => x.metier).filter(Boolean))].sort();
  openModal(`<h3>${id ? "Modifier la prestation" : "Nouvelle prestation"}</h3>
    <label class="f">Métier</label><input class="i" id="lb-metier" list="lb-metiers" value="${esc(b.metier)}"><datalist id="lb-metiers">${metiers.map(m => `<option value="${esc(m)}">`).join("")}</datalist>
    <label class="f">Désignation</label><textarea class="i" id="lb-des" style="min-height:60px">${esc(b.designation)}</textarea>
    <label class="f">Détail type (une étape par ligne)</label><textarea class="i" id="lb-det">${esc((b.details || []).join("\n"))}</textarea>
    <label class="f">Mots que vous dites pour cette prestation (séparés par des virgules)</label><input class="i" id="lb-alias" value="${esc((b.aliases || []).join(", "))}">
    <div class="row"><div><label class="f">Unité</label><select class="i" id="lb-u">${UNITES.map(u => `<option ${u === b.unite ? "selected" : ""}>${u}</option>`).join("")}</select></div>
    <div><label class="f">Prix HT</label><input class="i" id="lb-pu" inputmode="decimal" value="${nfr(b.pu)}"></div></div>
    <div class="row" style="margin-top:16px">${id ? `<button class="btn danger" data-a="lib-del" data-id="${b.id}">Supprimer</button>` : ""}<button class="btn" data-a="lib-save" data-id="${b.id}">Enregistrer</button></div>`);
}
async function libSave(id) {
  const old = S.biblio.find(x => x.id === id);
  const b = Object.assign({}, old || { id, origine: "manuel", uses: 0, createdAt: Date.now() }, {
    metier: $("#lb-metier").value.trim(), designation: $("#lb-des").value.trim(),
    details: $("#lb-det").value.split("\n").map(s => s.trim()).filter(Boolean),
    aliases: $("#lb-alias").value.split(",").map(s => s.trim()).filter(Boolean),
    unite: $("#lb-u").value, pu: num($("#lb-pu").value), updatedAt: Date.now()
  });
  if (!b.designation) return toast("La désignation est vide.");
  if (old) Object.assign(old, b); else S.biblio.push(b);
  closeModal(); render(); await put("biblio/" + id, b).catch(() => {}); toast("Prestation enregistrée");
}

/* ===================== Vue : réglages ===================== */
function viewReglages() {
  const c = S.cfg, k = exerciceKey(todayISO());
  const f = (key, label, extra = "") => `<label class="f">${label}</label><input class="i" data-cfg="${key}" value="${esc(c[key])}" ${extra}>`;
  return statusBanner() + `
  <div class="card"><h2>Entreprise</h2>${f("societe", "Nom")}${f("forme", "Forme juridique et capital")}${f("adresse", "Adresse")}${f("cpVille", "Code postal et ville")}${f("ville", "Ville (lieu d'établissement)")}${f("tel", "Téléphone")}${f("email", "E-mail (copie des envois)", 'inputmode="email"')}${f("activites1", "Activités (ligne 1)")}${f("activites2", "Activités (ligne 2)")}</div>
  <div class="card"><h2>Mentions légales</h2>${f("siret", "SIRET")}${f("rcs", "RCS")}${f("ape", "Code APE")}${f("tvaIntra", "TVA intracommunautaire")}${f("iban", "IBAN")}
    <label class="f">Assurance décennale (texte en pied de page)</label><textarea class="i" data-cfg="assurance" style="min-height:60px">${esc(c.assurance)}</textarea></div>
  <div class="card"><h2>Conditions</h2>
    <div class="row"><div><label class="f">Acompte commande %</label><input class="i" data-cfgac="0" inputmode="numeric" value="${c.acomptes[0]}"></div>
    <div><label class="f">En cours %</label><input class="i" data-cfgac="1" inputmode="numeric" value="${c.acomptes[1]}"></div>
    <div><label class="f">Solde %</label><input class="i" value="${100 - c.acomptes[0] - c.acomptes[1]}" disabled></div></div>
    <div class="row"><div><label class="f">Validité devis (mois)</label><input class="i" data-cfg="validiteMois" inputmode="numeric" value="${c.validiteMois}"></div>
    <div><label class="f">Prix fournitures (jours)</label><input class="i" data-cfg="validiteFournituresJours" inputmode="numeric" value="${c.validiteFournituresJours}"></div></div></div>
  <div class="card"><h2>Pose de carrelage : prix selon le format</h2>
    <div class="hint">Ajustement en € par m² ajouté au prix de pose de votre catalogue (signe moins pour baisser). Il s'applique quand la dictée donne le format, par exemple « carrelage 60 60 » ou « 30 par 60 ».</div>
    ${(() => { const tc = carrelageCfg(); const lab = ["Mosaïque (≤ 10 cm)", "Petit format (≤ 20 cm)", "Format standard (≤ 45 cm)", "Grand format (≤ 90 cm, ex. 60×60)", "Très grand format (> 90 cm, ex. 60×120)"];
      const opt = [["jointFin", "Joints fins (1-2 mm)"], ["epoxy", "Joint époxy"], ["decale", "Pose décalée"], ["diagonale", "Pose en diagonale"], ["chevron", "Pose en chevrons"]];
      return `<div class="row" style="flex-wrap:wrap">${tc.formats.map((f, i) => `<div style="flex:1 1 45%"><label class="f">${lab[i]}</label><input class="i" inputmode="decimal" data-tcf="${i}" value="${nfr(f.delta)}"></div>`).join("")}</div>
      <div class="row" style="flex-wrap:wrap">${opt.map(([k, l]) => `<div style="flex:1 1 45%"><label class="f">${l}</label><input class="i" inputmode="decimal" data-tco="${k}" value="${nfr(tc[k])}"></div>`).join("")}</div>`; })()}
  </div>
  <div class="card"><h2>Numérotation</h2>
    <div class="hint">Format AAAAMM + N + numéro. Le compteur repart à 01 chaque 1er octobre.</div>
    <label class="f">Dernier numéro utilisé hors application — exercice ${exerciceLabel(k)}</label>
    <input class="i" data-cnt="${k}" inputmode="numeric" value="${(c.compteurs || {})[k] || 0}">
    <div class="hint" style="margin-top:6px">Prochain numéro attribué : <b>${nextNumero(todayISO()).numero}</b></div></div>
  <div class="card"><h2>Sécurité</h2>
    ${lsGet("gph_lock", null) ? `<div class="hint">Verrouillage Face ID / Touch ID <b>activé</b> sur cet appareil.</div><button class="btn sec block" style="margin-top:8px" data-a="lock-off">Désactiver le verrouillage</button>`
      : `<div class="hint">Demander Face ID ou Touch ID à l'ouverture de l'application, sur cet appareil.</div><button class="btn sec block" style="margin-top:8px" data-a="lock-on">Activer Face ID / Touch ID</button>`}
    ${S.uid ? `<div class="hint" style="margin-top:12px">Connecté : ${esc(S.session?.user?.email || "")}</div><button class="btn ghost block" data-a="logout">Se déconnecter</button>` : ""}
  </div>
  <div class="card"><h2>Catalogue et sauvegarde</h2>
    <div class="hint">${S.biblio.length} prestation(s) enregistrée(s).</div>
    <label class="btn sec block" style="margin-top:8px">Importer un catalogue (fichier .json)<input type="file" accept=".json,application/json" hidden data-a="cat-import"></label>
    <div style="height:8px"></div>
    <button class="btn sec block" data-a="backup">Télécharger une sauvegarde complète</button>
    <label class="btn ghost block" style="margin-top:4px">Restaurer une sauvegarde<input type="file" accept=".json,application/json" hidden data-a="restore"></label>
  </div>`;
}
function carrelageCfg() { const D = window.Moteur.CARRELAGE_DEFAUT, c = S.cfg.carrelage || {};
  return Object.assign({}, D, c, { formats: D.formats.map((f, i) => Object.assign({}, f, (c.formats || [])[i] || {})) }); }
async function cfgSave() {
  const c = Object.assign({}, S.cfg, { compteurs: Object.assign({}, S.cfg.compteurs) });
  document.querySelectorAll("[data-cfg]").forEach(el => { const k = el.dataset.cfg; c[k] = ["validiteMois", "validiteFournituresJours"].includes(k) ? Number(el.value) || DEFAULT_CFG[k] : el.value.trim(); });
  const a0 = Number($("[data-cfgac='0']").value), a1 = Number($("[data-cfgac='1']").value);
  if (!(a0 >= 0 && a1 >= 0 && a0 + a1 <= 100)) return toast("Acomptes invalides : le total doit rester ≤ 100 %.");
  c.acomptes = [a0, a1, 100 - a0 - a1];
  document.querySelectorAll("[data-cnt]").forEach(el => { c.compteurs[el.dataset.cnt] = Math.max(0, parseInt(el.value) || 0); });
  const tc = carrelageCfg(); const nv = el => { const v = num(el.value); return v === null ? 0 : v; };
  document.querySelectorAll("[data-tcf]").forEach(el => { tc.formats[Number(el.dataset.tcf)].delta = nv(el); });
  document.querySelectorAll("[data-tco]").forEach(el => { tc[el.dataset.tco] = nv(el); });
  c.carrelage = tc;
  S.cfg = c; render();
  try { await put("config/app", c); toast("Réglages enregistrés"); } catch (e) {}
}

/* ===================== Éditeur de devis ===================== */
function newDraft() {
  return { id: uid(), statut: "brouillon", date: todayISO(), client: { nom: "", adresse: "", cpVille: "", email: "", tel: "" },
    chantierIdem: true, chantier: "", objet: "", tva: 10, acomptes: S.cfg.acomptes.slice(), sections: [], pj: [], dictee: "", createdAt: Date.now() };
}
function openDraft(d, step) { S.draft = JSON.parse(JSON.stringify(d)); S.step = step || (d.sections.length ? 2 : 1); setView("edit"); }
function viewEditor() {
  const d = S.draft;
  const steps = `<div class="steps"><div class="on"></div><div class="${S.step >= 2 ? "on" : ""}"></div><div class="${S.step >= 3 ? "on" : ""}"></div></div>`;
  if (S.step === 1) return steps + `
    <div class="card"><h2>1 · Dictez le devis</h2>
      <div class="hint" style="margin-bottom:10px">Touchez le <b>micro du clavier</b> et dites tout d'une traite : client, adresse, travaux pièce par pièce, surfaces, prix. Les fournitures : dites simplement ce qu'il faut, vous mettrez le prix du devis fournisseur ensuite.</div>
      <div style="display:flex;gap:10px;align-items:flex-start">
      <textarea class="i dict" data-in="dictee" style="flex:1" placeholder="Ex. : Devis pour Monsieur Dupont, 9 rue de Gaudré à Limours. Chambre : on dépose le papier peint, 28 mètres carrés, 18 euros du mètre. Enduit et peinture satin 28 mètres carrés à 38 euros…">${esc(d.dictee || "")}</textarea>
      ${SR ? `<button class="mic ${S.listening ? "on" : ""}" data-a="mic" title="Dicter">🎤</button>` : ""}</div>
      <div class="hint" style="margin-top:8px">Astuce : dites les pièces (« Chambre : … »), puis « Fournitures : … » pour la liste du matériel.</div>
    </div>
`;
  if (S.step === 2) return steps + (d.importe && d.statut !== "finalise" ? `<div class="banner i"><b>Devis importé</b> depuis « ${esc(d.importe.fichier)} ». Vérifiez les lignes, puis « Continuer » et « Générer le devis » : il garde son numéro ${esc(d.numero || "")}.${(d.importe.notes || []).map(n => "<br>• " + esc(n)).join("")}</div>` : "") + editorStep2();
  return steps + editorStep3();
}
function clientSuggestions() {
  const q = norm(S.draft.client.nom); if (q.length < 2) return "";
  const m = S.clients.filter(c => norm(c.nom).includes(q) && norm(c.nom) !== q).slice(0, 4);
  return m.length ? `<div style="margin-top:6px">${m.map(c => `<button class="btn sec sm" style="margin:0 6px 6px 0" data-a="pick-client" data-id="${c.id}">${esc(c.nom)} · ${esc(c.cpVille || "")}</button>`).join("")}</div>` : "";
}
function editorStep2() {
  const d = S.draft, t = totaux(d);
  let n = 0;
  const secs = d.sections.map((s, si) => `
    <div class="card">
      <div class="sec-h"><input class="i" data-sec="${si}" value="${esc(s.titre)}" placeholder="TITRE DE LA PARTIE"><button class="x" data-a="sec-del" data-si="${si}" title="Supprimer la partie">✕</button></div>
      ${s.lignes.map((l, li) => { n++; const tot = lineTotal(l); const needPu = num(l.pu) === null, needQ = num(l.quantite) === null;
        return `<div class="line ${needPu || needQ ? "warn" : ""}">
          <div class="hd"><div class="num">${n}</div>
            <div class="seg"><button class="${l.type !== "fourniture" ? "on" : ""}" data-a="ltype" data-si="${si}" data-li="${li}" data-t="mo">Main-d'œuvre</button><button class="${l.type === "fourniture" ? "on" : ""}" data-a="ltype" data-si="${si}" data-li="${li}" data-t="fourniture">Fourniture</button></div>
            <div class="tot">${eur(tot)}</div></div>
          <textarea class="i" style="min-height:44px;font-weight:600" data-l="designation" data-si="${si}" data-li="${li}" placeholder="Désignation">${esc(l.designation)}</textarea>
          <textarea class="i" style="min-height:44px;margin-top:6px;font-size:14px;color:var(--grey)" data-l="details" data-si="${si}" data-li="${li}" placeholder="Détail (une étape par ligne)">${esc((l.details || []).join("\n"))}</textarea>
          <div class="grid">
            <div><label>Quantité</label><input inputmode="decimal" class="${needQ ? "need" : ""}" data-l="quantite" data-si="${si}" data-li="${li}" value="${nfr(num(l.quantite))}"></div>
            <div><label>Unité</label><select data-l="unite" data-si="${si}" data-li="${li}">${[...new Set([l.unite, ...UNITES])].filter(Boolean).map(u => `<option ${u === l.unite ? "selected" : ""}>${esc(u)}</option>`).join("")}</select></div>
            <div><label>${l.type === "fourniture" ? "Prix fournisseur HT" : "Prix unitaire HT"}</label><input inputmode="decimal" class="${needPu ? "need" : ""}" data-l="pu" data-si="${si}" data-li="${li}" value="${nfr(num(l.pu))}" placeholder="${l.type === "fourniture" ? "Prix du devis fournisseur" : "À saisir"}"></div>
          </div>
          ${l.type !== "fourniture" ? `<label class="fc"><input type="checkbox" data-a="lfc" data-si="${si}" data-li="${li}" ${l.fournitureComprise ? "checked" : ""}><span>Prix avec fournitures comprises<br><small class="hint">${l.fournitureComprise ? "Le prix inclut le matériel" : "Décoché : prix de la main-d'œuvre seule"}</small></span></label>` : ""}
          <div class="acts">
            ${l.source === "bibliotheque" ? `<span class="pill">Prix de vos prestations</span>` : l.source === "dicte" ? `<span class="pill g">Prix dicté</span>` : l.source === "saisi" ? `<span class="pill g">Prix saisi</span>` : needPu ? `<span class="pill w">${l.type === "fourniture" ? "Prix fournisseur à saisir" : "Prix à saisir"}</span>` : ""}
            <span style="flex:1"></span>
            <button class="btn ghost sm" data-a="l-up" data-si="${si}" data-li="${li}">↑</button>
            <button class="btn ghost sm" data-a="l-down" data-si="${si}" data-li="${li}">↓</button>
            ${l.type !== "fourniture" ? `<button class="btn ghost sm" data-a="l-sug" data-si="${si}" data-li="${li}">Prestations proches</button>` : ""}
            <button class="btn ghost sm" data-a="l-del" data-si="${si}" data-li="${li}" style="color:var(--err)">Supprimer</button>
          </div></div>`; }).join("")}
      <div class="row"><button class="btn sec sm" data-a="l-add" data-si="${si}">＋ Ligne</button><button class="btn sec sm" data-a="l-lib" data-si="${si}">＋ Mes prestations</button></div>
      ${s.lignes.length > 1 ? `<div style="text-align:right;margin-top:10px;font-weight:600;color:var(--roi)">Sous-total : ${eur(s.lignes.reduce((a, l) => a + (lineTotal(l) || 0), 0))}</div>` : ""}
    </div>`).join("");
  const fiche = d.clientId && S.clients.find(c => c.id === d.clientId);
  return questionsCard() + `
  <div class="card"><h2>Client</h2>
    <div class="row" style="margin-bottom:4px"><button class="btn sec sm" data-a="cli-pick">Choisir dans le répertoire</button>${fiche ? `<span class="hint" style="align-self:center">Fiche : <a href="#" data-a="cli-open" data-id="${fiche.id}">${esc(fiche.nom)}</a></span>` : ""}</div>
    <label class="f">Nom</label><input class="i" data-c="nom" value="${esc(d.client.nom)}" autocomplete="off"><div id="csug">${clientSuggestions()}</div>
    <label class="f">Adresse</label><input class="i" data-c="adresse" value="${esc(d.client.adresse)}">
    <label class="f">Code postal et ville</label><input class="i" data-c="cpVille" value="${esc(d.client.cpVille)}">
    <div class="row"><div><label class="f">E-mail</label><input class="i" data-c="email" inputmode="email" value="${esc(d.client.email)}"></div>
    <div><label class="f">Téléphone</label><input class="i" data-c="tel" inputmode="tel" value="${esc(d.client.tel)}"></div></div>
    <label class="f"><input type="checkbox" data-a="idem" ${d.chantierIdem ? "checked" : ""}> Travaux à la même adresse</label>
    ${d.chantierIdem ? "" : `<input class="i" data-d="chantier" value="${esc(d.chantier)}" placeholder="Adresse du chantier">`}
  </div>
  <div class="card"><h2>Devis</h2>
    <label class="f">Objet</label><input class="i" data-d="objet" value="${esc(d.objet)}">
    <div class="row"><div><label class="f">Date</label><input class="i" type="date" data-d="date" value="${d.date}"></div>
    <div><label class="f">TVA</label><select class="i" data-d="tva">${[10, 20, 5.5].map(v => `<option value="${v}" ${Number(d.tva) === v ? "selected" : ""}>${String(v).replace(".", ",")} %</option>`).join("")}</select></div></div>
    ${d.numero ? `<div class="hint" style="margin-top:8px">Numéro : <b>${esc(d.numero)}</b></div>` : `<div class="hint" style="margin-top:8px">Le numéro est attribué à la génération du PDF.</div>`}
  </div>
  ${secs}
  <button class="btn sec block" data-a="sec-add" style="margin-bottom:14px">＋ Ajouter une partie</button>
  <div class="card"><h2>Devis fournisseurs (annexes)</h2>
    <div class="hint" style="margin-bottom:10px">Photo ou PDF du devis fournisseur. Il est ajouté à la fin du devis. Reprenez les prix de ce devis dans les lignes « Fourniture ».</div>
    ${d.pj.map((p, i) => `<div class="pj">${p.type.startsWith("image") && S.pjCache[p.id]?.url ? `<img src="${S.pjCache[p.id].url}">` : `<div class="ic">${p.type.includes("pdf") ? "PDF" : "IMG"}</div>`}
      <div class="n">${esc(p.name)}${p.missing ? `<br><span class="pill w">Fichier à rejoindre</span>` : ""}</div>
      <button class="x" data-a="pj-del" data-i="${i}">✕</button></div>`).join("")}
    <label class="btn sec block" style="margin-top:4px">＋ Joindre un devis fournisseur<input type="file" accept="image/*,application/pdf" multiple hidden data-a="pj-add"></label>
  </div>
  <div class="totals">
    <div class="r"><span>Total HT</span><span>${eur(t.ht)}</span></div>
    <div class="r"><span>TVA ${String(d.tva).replace(".", ",")} %</span><span>${eur(t.tva)}</span></div>
    <div class="r big"><span>Total TTC</span><span>${eur(t.ttc)}</span></div>
    ${t.incomplet ? `<div class="r" style="color:#FFE0A3">${t.incomplet} ligne(s) sans prix ou quantité</div>` : ""}
  </div>`;
}
function editorStep3() {
  const d = S.draft, t = totaux(d), pb = problemes(d);
  const subj = `Devis N° ${d.numero || ""} — ${S.cfg.societe}`;
  const body = `Bonjour,\n\nVeuillez trouver ci-joint notre devis N° ${d.numero || ""} pour ${d.objet || "les travaux"}, d'un montant de ${eur(t.ttc)} TTC.\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\nPhilippe GALLOIS\n${S.cfg.societe} · ${S.cfg.tel}`;
  const mailto = `mailto:${encodeURIComponent(d.client.email || "")}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}${S.cfg.email ? "&cc=" + encodeURIComponent(S.cfg.email) : ""}`;
  return `
  ${pb.length ? `<div class="banner w"><b>À compléter avant de générer :</b><br>${pb.map(esc).join("<br>")}</div>` : ""}
  <div class="card"><h2>Récapitulatif</h2>
    <div class="kv"><div><b>${esc(d.client.nom)}</b></div><div class="hint">${esc(d.client.adresse)} ${esc(d.client.cpVille)}</div>
    <div class="hint">${esc(d.objet)}</div></div>
    <div class="totals" style="margin-top:12px">
      <div class="r"><span>Total HT</span><span>${eur(t.ht)}</span></div><div class="r"><span>TVA ${String(d.tva).replace(".", ",")} %</span><span>${eur(t.tva)}</span></div>
      <div class="r big"><span>Total TTC</span><span>${eur(t.ttc)}</span></div>
      <div class="r" style="margin-top:6px"><span>Acompte commande ${t.p[0]} %</span><span>${eur(t.a1)}</span></div>
      ${t.p[1] ? `<div class="r"><span>Acompte en cours ${t.p[1]} %</span><span>${eur(t.a2)}</span></div>` : ""}
      <div class="r"><span>Solde fin de travaux</span><span>${eur(t.solde)}</span></div></div>
    ${d.pj.length ? `<div class="hint" style="margin-top:10px">${d.pj.length} devis fournisseur(s) en annexe.</div>` : `<div class="hint" style="margin-top:10px">Aucun devis fournisseur en annexe.</div>`}
  </div>
  ${d.statut === "finalise" ? `
  <div class="card"><h2>Suivi du devis</h2>
    ${isLate(d) ? `<div class="banner w" style="background:#FDECEC;color:var(--err)"><b>Chantier en retard</b> : la fin annoncée (${dFR(d.finPrevue)}) est passée.</div>` : ""}
    <div class="etats">${ETATS.map(x => `<button class="btn ${etatOf(d) === x[0] ? "" : "sec"} sm" data-a="etat" data-e="${x[0]}">${x[1]}${x[0] === "acompte1" ? " · " + eur(t.a1) : x[0] === "acompte2" && t.p[1] ? " · " + eur(t.a2) : x[0] === "paye" ? " · solde " + eur(t.solde) : ""}</button>`).join("")}</div>
    <div class="row" style="margin-top:10px">
      <div><label class="f">Début des travaux</label><input class="i" type="date" data-dd="debut" value="${esc(d.debut || "")}"></div>
      <div><label class="f">Durée annoncée (jours ouvrés)</label><input class="i" data-dd="dureeJours" inputmode="decimal" value="${esc(d.dureeJours ?? "")}"></div></div>
    <label class="f">Fin annoncée</label><input class="i" type="date" data-dd="finPrevue" value="${esc(d.finPrevue || "")}">
    <div class="hint" style="margin-top:8px">La fin se calcule avec le début et la durée (week-ends exclus), ou se saisit directement. Passé cette date sans « Chantier fini », le devis passe automatiquement « En retard ». Le statut est ajouté au nom du PDF.</div></div>
  <div class="card"><h2>Envoyer</h2>
    <button class="btn block" data-a="pdf-dl">Télécharger le PDF</button>
    <div style="height:10px"></div>
    <button class="btn sec block" data-a="pdf-mail">Envoyer par mail</button>
    <div id="mailbox" style="display:${S.mailOpen ? "block" : "none"};margin-top:12px">
      <div class="banner i">Choisissez <b>Mail</b> dans la fenêtre de partage : le PDF part en pièce jointe. Si la fenêtre ne s'ouvre pas, ouvrez le mail prérempli ci-dessous et joignez le PDF téléchargé.</div>
      <a class="btn sec block" href="${mailto}">Ouvrir un mail prérempli</a>
      <div class="hint" style="margin-top:8px">Destinataire : ${d.client.email ? `<a class="mail" href="${mailto}">${esc(d.client.email)}</a>` : "aucun e-mail client saisi"}</div>
      <button class="btn ghost sm" data-a="copy-mail" style="margin-top:6px">Copier le texte du mail</button>
    </div>
  </div>
  <div class="card"><button class="btn sec block" data-a="dup">Dupliquer ce devis</button><div style="height:8px"></div><button class="btn danger block" data-a="draft-del">Supprimer ce devis</button></div>` : `
  <div class="card"><div class="hint" style="margin-bottom:10px">La génération attribue le numéro <b>${d.numero || nextNumero(d.date).numero}</b>, enregistre le devis et met à jour vos prestations.</div>
  <button class="btn block" data-a="finalize" ${pb.length ? "disabled" : ""}>Générer le devis</button></div>
  <div class="card"><button class="btn danger block" data-a="draft-del">Supprimer ce brouillon</button></div>`}`;
}
function barEditor() {
  if (S.step === 1) return `<div class="bar"><button class="btn sec" data-a="manual">Saisie manuelle</button><button class="btn" data-a="ai-run">Mettre en forme</button></div>`;
  if (S.step === 2) return `<div class="bar"><button class="btn sec" data-a="step1">Dictée</button><button class="btn" data-a="step3">Continuer</button></div>`;
  return `<div class="bar"><button class="btn sec block" data-a="step2">Modifier le devis</button></div>`;
}


/* ===================== Mise en forme (moteur local, sans IA) ===================== */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
function toggleMic() {
  if (!SR) return;
  if (S.listening) { rec && rec.stop(); return; }
  rec = new SR(); rec.lang = "fr-FR"; rec.continuous = true; rec.interimResults = false;
  rec.onresult = ev => { let t = ""; for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) t += ev.results[i][0].transcript; if (t) { S.draft.dictee = ((S.draft.dictee || "").trim() + " " + t.trim()).trim(); const ta = $("[data-in='dictee']"); if (ta) ta.value = S.draft.dictee; lsSet("gph_current", S.draft); } };
  rec.onend = () => { S.listening = false; render(); };
  rec.onerror = () => { S.listening = false; render(); };
  try { rec.start(); S.listening = true; render(); } catch (e) { toast("Micro indisponible : utilisez le micro du clavier"); }
}
function aiRun() {
  const text = (S.draft.dictee || "").trim();
  if (text.length < 8) return toast("Dictez d'abord le devis.");
  const res = window.Moteur.analyse(text, S.biblio, { carrelage: carrelageCfg() });
  applyResult(res);
  { const ex = S.draft.clientId ? S.clients.find(c => c.id === S.draft.clientId) : S.clients.find(c => S.draft.client.nom && norm(c.nom) === norm(S.draft.client.nom));
    if (ex) { S.draft.clientId = ex.id; const sn = snapshotOf(normClient(ex)); for (const k of Object.keys(sn)) if (!S.draft.client[k]) S.draft.client[k] = sn[k]; } }
  { const nd = dedupeLignes(S.draft); if (nd) res.notes.unshift(`${nd} ligne(s) en double supprimée(s) automatiquement.`); }
  S.draft.qRound = 0; S.draft.qAsked = []; askQuestions(res);
  S.step = 2; persistDraft(); render(); window.scrollTo(0, 0);
  if (res.notes.length) { S.aiNotes = res.notes; showNotes(); }
}
function applyResult(res) {
  const d = S.draft;
  for (const k of ["nom", "adresse", "cpVille", "email", "tel"]) if (res.client[k] && (!d.clientId || !d.client[k])) d.client[k] = res.client[k];
  if (res.objet) d.objet = res.objet;
  d.tva = res.tva;
  if (res.dureeJours) d.dureeJours = res.dureeJours;
  d.sections = res.sections.map(s => ({ titre: s.titre === "Travaux" ? "" : s.titre, lignes: s.lignes.map(l => Object.assign({ id: uid() }, l)) }));
}
function showNotes() {
  openModal(`<h3>À vérifier</h3><ul class="hint" style="padding-left:18px">${S.aiNotes.map(n => `<li style="margin-bottom:6px">${esc(n)}</li>`).join("")}</ul>
  <div class="hint">Chaque ligne reconnue reprend la désignation et le prix de vos prestations. Touchez « Prestations proches » pour en choisir une autre.</div>
  <button class="btn block" data-a="close" style="margin-top:12px">Compris</button>`);
  S.aiNotes = null;
}
function suggestModal(si, li) {
  const l = S.draft.sections[si].lignes[li];
  const txt = l.raw || l.designation;
  const ms = window.Moteur.match(window.Moteur.buildIndex(S.biblio), txt + " " + (l.designation || ""), l.unite);
  const reform = l.raw ? window.Moteur.reformulate(l.raw) : null;
  openModal(`<h3>Prestations proches</h3>${l.raw ? `<div class="hint">Vous avez dit : « ${esc(l.raw)} »</div>` : ""}
    <div class="list" style="margin-top:8px">${ms.map(m => `<div class="it" data-a="sug-pick" data-si="${si}" data-li="${li}" data-id="${m.b.id}"><div class="m"><div class="t" style="white-space:normal">${esc(m.b.designation)}</div><div class="s">${esc(m.b.metier)}</div></div><div class="a">${eur(m.b.pu)}<div class="s">/ ${esc(m.b.unite)}</div></div></div>`).join("") || `<div class="empty">Aucune prestation proche.</div>`}</div>
    ${reform ? `<button class="btn sec block" style="margin-top:10px" data-a="sug-own" data-si="${si}" data-li="${li}">Garder ma formulation : « ${esc(reform)} »</button>` : ""}`);
}

/* ===================== Brouillons ===================== */
let persistT = null;
function persistDraft(now) {
  const d = S.draft; if (!d) return;
  d.updatedAt = Date.now(); d.totaux = totaux(d);
  lsSet("gph_current", d);
  clearTimeout(persistT);
  const go = async () => {
    const copy = JSON.parse(JSON.stringify(d));
    const i = S.devis.findIndex(x => x.id === d.id); if (i >= 0) S.devis[i] = copy; else S.devis.unshift(copy);
    await put("devis/" + d.id, copy).catch(() => {});
  };
  if (now) return go(); persistT = setTimeout(go, 1500);
}


/* ===================== Pièces jointes (devis fournisseurs) ===================== */
async function addPJ(files) {
  for (const f of files) {
    if (!/^image\/|pdf/.test(f.type)) { toast("Format non pris en charge : " + f.name); continue; }
    const id = uid();
    S.pjCache[id] = { blob: f, url: URL.createObjectURL(f), type: f.type, name: f.name };
    const pj = { id, name: f.name, type: f.type || "application/pdf", path: null };
    S.draft.pj.push(pj); render();
    if (S.sb && S.uid && navigator.onLine) {
      const path = `${S.uid}/${S.draft.id}/${id}-${f.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await S.sb.storage.from("annexes").upload(path, f, { contentType: f.type, upsert: true });
      if (!error) pj.path = path; else toast("Annexe gardée sur cet appareil (envoi impossible).");
    }
    persistDraft();
  }
}
async function pjBlob(p) {
  if (S.pjCache[p.id]) return S.pjCache[p.id].blob;
  if (p.path && S.sb) { const { data, error } = await S.sb.storage.from("annexes").download(p.path); if (!error && data) { S.pjCache[p.id] = { blob: data, url: URL.createObjectURL(data), type: p.type, name: p.name }; return data; } }
  return null;
}

/* ===================== Finalisation ===================== */
async function finalize() {
  const d = S.draft;
  if (problemes(d).length) return;
  if (!d.numero) { const n = nextNumero(d.date); d.numero = n.numero; d.exercice = n.k; }
  else if (!d.exercice) d.exercice = exerciceKey(d.numero.slice(0, 4) + "-" + d.numero.slice(4, 6) + "-01");
  d.statut = "finalise"; d.etat = d.etat || "attente"; d.finalisedAt = Date.now(); d.totaux = totaux(d);
  await persistDraft(true);
  // compteur
  const k = d.exercice, nn = Number(d.numero.split("N")[1]);
  if (nn > Number((S.cfg.compteurs || {})[k] || 0)) { S.cfg.compteurs = Object.assign({}, S.cfg.compteurs, { [k]: nn }); put("config/app", S.cfg).catch(() => {}); }
  // client
  try { await linkDevisClient(d); await persistDraft(true); } catch (e) { console.error(e); }
  // apprentissage des prestations (main-d'œuvre uniquement)
  for (const s of d.sections) for (const l of s.lignes) {
    if (l.type !== "mo" || num(l.pu) === null || !l.designation) continue;
    let b = (l.biblio_id && S.biblio.find(x => x.id === l.biblio_id)) || S.biblio.find(x => norm(x.designation) === norm(l.designation) && x.unite === l.unite);
    const said = l.raw ? String(l.raw).replace(/\d+(?:[.,]\d+)?\s*(?:€|euros?|m2|m²|mètres?\s*carrés?|ml)?/gi, " ").replace(/\s+/g, " ").trim().slice(0, 80) : "";
    if (b && l.fournitureComprise && !b.fournitureComprise) { b = Object.assign({}, b, { uses: (b.uses || 0) + 1, lastUsed: Date.now() }); }
    else if (b) { b = Object.assign({}, b, { pu: r2(num(l.pu) - (num(l.ajustCarrelage) || 0)), uses: (b.uses || 0) + 1, lastUsed: Date.now() }); if (!b.details?.length && l.details?.length) b.details = l.details;
      if (said && !(b.aliases || []).some(a => norm(a) === norm(said))) b.aliases = [...(b.aliases || []), said].slice(-15); }
    else b = { id: uid(), metier: s.titre || "Divers", fournitureComprise: !!l.fournitureComprise, designation: l.designation, details: l.details || [], unite: l.unite, pu: num(l.pu), origine: "auto", uses: 1, lastUsed: Date.now(), createdAt: Date.now(), aliases: said ? [said] : [] };
    const i = S.biblio.findIndex(x => x.id === b.id); if (i >= 0) S.biblio[i] = b; else S.biblio.push(b);
    await put("biblio/" + b.id, b).catch(() => {});
  }
  render(); toast("Devis " + d.numero + " enregistré"); setTimeout(() => dedupeBiblio().then(n => n && render()), 2700);
}

/* ===================== PDF ===================== */
async function buildPDF(d) {
  const { jsPDF } = window.jspdf;
  const C = S.cfg, t = totaux(d);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  for (const [k, f] of [["P", "P"], ["PL", "PL"], ["PM", "PM"], ["PB", "PB"]]) { doc.addFileToVFS(k + ".ttf", window.GPH_FONTS[f]); doc.addFont(k + ".ttf", k, "normal"); }
  const W = 595.28, H = 841.89, M = 40;
  const ROI = [31, 63, 181], ROI_D = [20, 42, 128], ROI_M = [65, 105, 225], ROI_L = [232, 237, 251], INK = [26, 31, 54], GREY = [91, 97, 117], LINE = [213, 219, 238], ZEB = [246, 248, 254];
  const fill = c => doc.setFillColor(...c), stroke = c => doc.setDrawColor(...c);
  const tx = (x, y, s, font = "P", size = 9, color = INK, align = "left") => { doc.setFont(font, "normal"); doc.setFontSize(size); doc.setTextColor(...color); doc.text(String(s), x, y, { align }); };
  const poly = (pts, c) => { fill(c); doc.lines(pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], "F", true); };
  const wrap = (s, w, font, size) => { doc.setFont(font, "normal"); doc.setFontSize(size); return doc.splitTextToSize(String(s), w); };
  const BOTTOM = H - 62;

  function band(h, big) {
    fill(ROI); doc.rect(0, 0, W, h, "F");
    poly([[W - (big ? 230 : 170), 0], [W, 0], [W, h], [W - (big ? 150 : 135), h]], ROI_M);
    poly([[W - (big ? 95 : 70), 0], [W, 0], [W, h], [W - (big ? 25 : 40), h]], ROI_D);
  }
  function logoCard(x, y, w, h) { fill([255, 255, 255]); doc.roundedRect(x, y, w, h, 8, 8, "F"); doc.addImage(window.GPH_LOGO, "JPEG", x + 6, y + 6, w - 12, h - 12); }
  function header1() {
    band(124, true);
    logoCard(M, 34, 84, 62);
    const x = M + 98;
    tx(x, 56, C.societe, "PB", 22, [255, 255, 255]);
    tx(x, 72, C.activites1, "PL", 8.6, [255, 255, 255]);
    tx(x, 84, C.activites2, "PL", 8.6, [255, 255, 255]);
    tx(x, 106, `${C.adresse}, ${C.cpVille}  ·  ${C.tel}`, "P", 7.8, [255, 255, 255]);
    tx(W - M, 60, "DEVIS", "PB", 26, [255, 255, 255], "right");
    tx(W - M, 78, "N° " + d.numero, "PM", 10, [255, 255, 255], "right");
    return 146;
  }
  function header2() {
    band(54, false); logoCard(M, 7, 54, 40);
    tx(M + 66, 33, C.societe, "PB", 14, [255, 255, 255]);
    tx(W - M - 60, 33, `DEVIS N° ${d.numero} (suite)`, "PM", 9, [255, 255, 255], "right");
    return 78;
  }
  // colonnes
  const X_DES = M + 28, X_Q = M + 330, X_U = M + 352, X_PU = M + 425, X_T = W - M - 9;
  const DES_W = X_Q - X_DES - 52;
  function tableHeader(y) {
    fill(ROI); doc.roundedRect(M, y, W - 2 * M, 24, 4, 4, "F");
    const hy = y + 15.5, w = [255, 255, 255];
    tx(M + 9, hy, "N°", "PB", 8, w); tx(X_DES + 4, hy, "DÉSIGNATION", "PB", 8, w);
    tx(X_Q, hy, "QTÉ", "PB", 8, w, "right"); tx(X_U + 14, hy, "UNITÉ", "PB", 8, w, "center");
    tx(X_PU, hy, "PU HT", "PB", 8, w, "right"); tx(X_T, hy, "TOTAL HT", "PB", 8, w, "right");
    return y + 24;
  }
  let y = header1();
  // cartes
  const cw = (W - 2 * M - 14) / 2, ch = 104;
  const chantierTxt = d.chantierIdem || !d.chantier ? "Lieu des travaux : même adresse" : "Chantier : " + d.chantier;
  const cards = [["ÉMETTEUR", [[C.societe + " — EURL", "PB"], [`${C.adresse}, ${C.cpVille}`, "P"], ["Tél. " + C.tel, "P"], ["SIRET " + C.siret, "P"], ["TVA intracom. " + C.tvaIntra, "P"]]],
    ["CLIENT", [[d.client.nom, "PB"], [d.client.adresse, "P"], [d.client.cpVille, "P"], [[d.client.tel, d.client.email].filter(Boolean).join(" · "), "P"], [chantierTxt, "PL"]]]];
  cards.forEach(([title, lines], i) => {
    const x = M + i * (cw + 14);
    fill(ROI_L); doc.roundedRect(x, y, cw, ch, 6, 6, "F"); fill(ROI); doc.rect(x, y, 3.5, ch, "F");
    tx(x + 16, y + 18, title, "PB", 7.5, ROI);
    let yy = y + 35;
    for (const [s, f] of lines) { const ww = wrap(s || "", cw - 28, f, f === "PB" ? 9.5 : 8.5)[0] || ""; tx(x + 16, yy, ww, f, f === "PB" ? 9.5 : 8.5, f === "PL" ? GREY : INK); yy += 14; }
  });
  y += ch + 22;
  const metas = [["DATE", dFR(d.date)], ["VALIDITÉ", "jusqu'au " + dFR(addMonths(d.date, C.validiteMois || 3))], ["OBJET", d.objet || ""]];
  [M, M + 105, M + 225].forEach((x, i) => { tx(x, y, metas[i][0], "PB", 7, GREY); tx(x, y + 13, i === 2 ? (wrap(metas[i][1], W - M - x, "PM", 9)[0] || "") : metas[i][1], "PM", 9, INK); });
  y += 34;
  y = tableHeader(y);
  let n = 0, z = 0;
  const newPage = () => { doc.addPage(); return tableHeader(header2()); };
  for (const s of d.sections) {
    if (s.titre) {
      if (y + 26 + 30 > BOTTOM) y = newPage();
      fill(ROI_L); doc.rect(M, y, W - 2 * M, 24, "F");
      tx(X_DES + 4, y + 15.5, s.titre.toUpperCase(), "PB", 8, ROI); y += 24;
    }
    for (const l of s.lignes) {
      n++;
      const tl = wrap(l.designation, DES_W, "PM", 9);
      const dl = (l.details || []).flatMap(x => wrap("– " + x, DES_W, "PL", 7.8));
      const fm = l.type !== "fourniture" ? (l.fournitureComprise ? "Fournitures comprises" : "Main-d'œuvre seule") : "";
      const rh = 14 + tl.length * 11.5 + (dl.length ? 3 + dl.length * 10.5 : 0) + (fm ? 11 : 0) + 8;
      if (y + rh > BOTTOM) { y = newPage(); z = 0; }
      if (z++ % 2 === 1) { fill(ZEB); doc.rect(M, y, W - 2 * M, rh, "F"); }
      const ty = y + 17;
      fill(ROI_L); doc.circle(M + 13, ty - 3, 8.5, "F");
      tx(M + 13, ty, String(n), "PB", 7.5, ROI, "center");
      tl.forEach((ln, i) => tx(X_DES + 4, ty + i * 11.5, ln, "PM", 9));
      dl.forEach((ln, i) => tx(X_DES + 4, ty + tl.length * 11.5 + 2 + i * 10.5, ln, "PL", 7.8, GREY));
      if (fm) tx(X_DES + 4, ty + tl.length * 11.5 + (dl.length ? 3 + dl.length * 10.5 : 0) + 1, fm, "PM", 7.4, l.fournitureComprise ? ROI : GREY);
      tx(X_Q, ty, nfr(num(l.quantite)), "P", 8.6, INK, "right");
      tx(X_U + 14, ty, l.unite || "", "P", 8.6, INK, "center");
      tx(X_PU, ty, eur(num(l.pu)), "P", 8.6, INK, "right");
      tx(X_T, ty, eur(lineTotal(l)), "PM", 9, INK, "right");
      y += rh; stroke(LINE); doc.setLineWidth(0.6); doc.line(M, y, W - M, y);
    }
    if (s.lignes.length > 1) {
      if (y + 24 > BOTTOM) { y = newPage(); }
      const st = s.lignes.reduce((a, l) => a + (lineTotal(l) || 0), 0);
      tx(X_PU, y + 16, "Sous-total" + (s.titre ? " " + s.titre.toLowerCase() : ""), "PM", 8.5, ROI, "right");
      tx(X_T, y + 16, eur(st), "PB", 9, ROI, "right"); y += 24;
      stroke(LINE); doc.line(M, y, W - M, y);
    }
  }
  tx(M + 4, y + 14, `Validité du devis : ${C.validiteMois} mois. Prix des fournitures garantis ${C.validiteFournituresJours} jours (variables selon le cours du marché).`, "PL", 7.6, GREY);
  y += 26;
  // bloc final
  const vat10 = Number(d.tva) !== 20;
  if (y + 110 > BOTTOM) { doc.addPage(); y = header2(); }
  const bw = 210, bx = W - M - bw;
  let yy = y;
  for (const [k, v] of [["Total HT", eur(t.ht)], [`TVA ${String(d.tva).replace(".", ",")} %`, eur(t.tva)]]) {
    tx(bx + 12, yy + 14, k, "P", 9, GREY); tx(W - M - 12, yy + 14, v, "PM", 9, INK, "right"); yy += 20; stroke(LINE); doc.line(bx, yy - 1, W - M, yy - 1);
  }
  fill(ROI); doc.roundedRect(bx, yy + 2, bw, 32, 5, 5, "F");
  tx(bx + 12, yy + 22, "TOTAL TTC", "PB", 10, [255, 255, 255]); tx(W - M - 12, yy + 23, eur(t.ttc), "PB", 14, [255, 255, 255], "right");
  tx(M, y + 12, "MODALITÉS DE RÈGLEMENT", "PB", 7.5, ROI);
  let y2 = y + 28;
  const ac = [["Acompte à la commande", t.p[0], t.a1]]; if (t.p[1]) ac.push(["Acompte en cours de travaux", t.p[1], t.a2]); ac.push(["Solde à la fin des travaux", 100 - t.p[0] - (t.p[1] || 0), t.solde]);
  for (const [k, p, v] of ac) { tx(M, y2, k, "P", 8.3, GREY); tx(M + 148, y2, `${p} %  ·  ${eur(v)}`, "PM", 8.3, INK); y2 += 14; }
  y = Math.max(yy + 50, y2 + 10);
  // IBAN
  if (y + 46 > BOTTOM) { doc.addPage(); y = header2(); }
  stroke(LINE); doc.setLineWidth(0.8); doc.roundedRect(M, y, W - 2 * M, 40, 6, 6, "S");
  tx(M + 14, y + 15, "COORDONNÉES BANCAIRES — IBAN", "PB", 7.5, ROI); tx(M + 14, y + 30, C.iban.replace(/ /g, "  "), "PM", 10.5, INK);
  y += 54;
  if (vat10) {
    const cl = wrap(TVA_CERT, W - 2 * M - 28, "P", 7.8);
    const bh = 26 + cl.length * 10.5;
    if (y + bh > BOTTOM) { doc.addPage(); y = header2(); }
    fill(ROI_L); doc.roundedRect(M, y, W - 2 * M, bh, 6, 6, "F");
    tx(M + 14, y + 15, `TVA À TAUX RÉDUIT (${String(d.tva).replace(".", ",")} %) — CERTIFICATION DU CLIENT`, "PB", 7.5, ROI);
    cl.forEach((ln, i) => tx(M + 14, y + 28 + i * 10.5, ln, "P", 7.8, INK));
    y += bh + 14;
  }
  const sw = (W - 2 * M - 14) / 2, sh = 84;
  if (y + sh > BOTTOM) { doc.addPage(); y = header2(); }
  [["BON POUR ACCORD — LE CLIENT", "Date, mention manuscrite « Bon pour accord » et signature"], ["L'ENTREPRISE", "Cachet et signature"]].forEach(([a, b], i) => {
    const x = M + i * (sw + 14); stroke([174, 184, 218]); doc.setLineDashPattern([3, 2], 0); doc.roundedRect(x, y, sw, sh, 6, 6, "S"); doc.setLineDashPattern([], 0);
    tx(x + 12, y + 16, a, "PB", 7.5, ROI); tx(x + 12, y + 28, b, "PL", 7.2, GREY);
  });
  // pieds de page
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    fill(ROI_M); doc.rect(0, H - 36.5, W, 2.5, "F"); fill(ROI); doc.rect(0, H - 34, W, 34, "F");
    tx(W / 2, H - 21, `${C.forme} · ${C.rcs} · SIRET ${C.siret} · APE ${C.ape} · TVA ${C.tvaIntra}`, "P", 6.6, [255, 255, 255], "center");
    tx(W / 2, H - 10, `Siège : ${C.adresse}, ${C.cpVille} · ${C.assurance}`, "PL", 6.3, [255, 255, 255], "center");
    tx(W - M, H - 44, `Devis N° ${d.numero} · Page ${p}/${total}`, "PL", 6.5, GREY, "right");
  }
  let bytes = doc.output("arraybuffer");
  // annexes
  if (d.pj.length) {
    const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
    const out = await PDFDocument.load(bytes);
    const helv = await out.embedFont(StandardFonts.HelveticaBold);
    let missing = 0;
    for (const p of d.pj) {
      const blob = await pjBlob(p); if (!blob) { missing++; p.missing = true; continue; }
      const buf = await blob.arrayBuffer();
      if (/pdf/.test(p.type)) {
        try { const src = await PDFDocument.load(buf, { ignoreEncryption: true }); const pages = await out.copyPages(src, src.getPageIndices()); pages.forEach(pg => out.addPage(pg)); } catch (e) { missing++; }
      } else {
        let img; try { img = /png/.test(p.type) ? await out.embedPng(buf) : await out.embedJpg(buf); } catch (e) { img = await embedViaCanvas(out, blob); }
        if (!img) { missing++; continue; }
        const pg = out.addPage([W, H]);
        pg.drawRectangle({ x: 0, y: H - 40, width: W, height: 40, color: rgb(31 / 255, 63 / 255, 181 / 255) });
        pg.drawText(`ANNEXE — DEVIS FOURNISSEUR · Devis N° ${d.numero}`, { x: M, y: H - 25, size: 10, font: helv, color: rgb(1, 1, 1) });
        const maxW = W - 2 * M, maxH = H - 40 - 2 * M, sc = Math.min(maxW / img.width, maxH / img.height, 1.5);
        const iw = img.width * sc, ih = img.height * sc;
        pg.drawImage(img, { x: (W - iw) / 2, y: (H - 40 - ih) / 2, width: iw, height: ih });
      }
    }
    if (missing) toast(missing + " annexe(s) introuvable(s) : rejoignez le fichier.", 4000);
    bytes = await out.save();
  }
  return new Blob([bytes], { type: "application/pdf" });
}
function embedViaCanvas(out, blob) {
  return new Promise(res => {
    const im = new Image(); im.onload = async () => {
      const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0);
      c.toBlob(async b => { try { res(await out.embedJpg(await b.arrayBuffer())); } catch (e) { res(null); } }, "image/jpeg", 0.9);
    }; im.onerror = () => res(null); im.src = URL.createObjectURL(blob);
  });
}
function pdfName(d) { const e = etatOf(d); return `Devis_${d.numero}_${(d.client.nom || "client").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "")}${e ? "_" + ETAT_FICHIER[e] : ""}${isLate(d) ? "_EN-RETARD" : ""}.pdf`; }
async function savePDF(mail) {
  const d = S.draft;
  const btn = $(mail ? "[data-a='pdf-mail']" : "[data-a='pdf-dl']"); if (btn) { btn.disabled = true; btn.textContent = "Création du PDF…"; }
  try {
    const blob = await buildPDF(d);
    const name = pdfName(d);
    const file = new File([blob], name, { type: "application/pdf" });
    if (mail) {
      S.mailOpen = true;
      const t = totaux(d);
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `Devis N° ${d.numero}`, text: `Devis N° ${d.numero} — ${S.cfg.societe} — ${eur(t.ttc)} TTC` });
          if (etatOf(d) === "attente") { d.etat = "envoye"; await persistDraft(true); toast("Statut passé à « Envoyé »"); } }
        catch (e) { if (e.name !== "AbortError") downloadBlob(blob, name); }
      } else downloadBlob(blob, name);
    } else downloadBlob(blob, name);
  } catch (e) { console.error(e); toast("Erreur de création du PDF"); }
  render();
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000); toast("PDF téléchargé");
}

/* ===================== Modale ===================== */
function openModal(html) { $("#modal").innerHTML = `<div class="modal" data-a="modal-bg"><div class="sheet">${html}</div></div>`; }
function closeModal() { $("#modal").innerHTML = ""; }
function libPicker(si) {
  S.pickSi = si; S.qp = "";
  openModal(`<h3>Mes prestations</h3><input class="i" id="pk-q" placeholder="Rechercher…" autocomplete="off"><div class="list" id="pk-list" style="margin-top:8px">${pickList("")}</div>`);
}
function pickList(q) {
  q = norm(q);
  const items = S.biblio.filter(b => !q || norm(b.metier + " " + b.designation).includes(q)).sort((a, b) => (b.uses || 0) - (a.uses || 0)).slice(0, 60);
  return items.map(b => `<div class="it" data-a="pick" data-id="${b.id}"><div class="m"><div class="t" style="white-space:normal">${esc(b.designation)}</div><div class="s">${esc(b.metier)}</div></div><div class="a">${eur(b.pu)}<div class="s">/ ${esc(b.unite)}</div></div></div>`).join("") || `<div class="empty">Aucune prestation.</div>`;
}


/* ===================== Import de devis existants ===================== */
async function importDevis(files) {
  if (!files.length) return;
  openModal(`<h3>Import en cours…</h3><div class="hint" id="imp-p">Lecture de ${files.length} fichier(s)</div>`);
  const res = [];
  for (const f of files) {
    try {
      const txt = await window.Importer.extractText(f);
      const p = window.Importer.parseDevis(txt, f.name);
      if (p.numero && S.devis.some(x => x.numero === p.numero)) { res.push({ f: f.name, err: `déjà présent (${p.numero})` }); continue; }
      const d = Object.assign(newDraft(), {
        numero: p.numero, exercice: p.numero ? exerciceKey(p.numero.slice(0, 4) + "-" + p.numero.slice(4, 6) + "-01") : null,
        date: p.date || todayISO(), client: Object.assign({ nom: "", adresse: "", cpVille: "", email: "", tel: "" }, p.client), objet: p.objet, tva: p.tva,
        sections: p.sections.map(s => ({ titre: s.titre ? s.titre.charAt(0) + s.titre.slice(1).toLowerCase().replace(/^./, c => c.toUpperCase()) : "", lignes: s.lignes.map(l => Object.assign({ id: uid() }, l)) })),
        importe: { fichier: f.name, notes: p.notes, totalDoc: p.totalDoc, le: Date.now() }, etat: "attente"
      });
      if (!d.objet) { const t = d.sections.map(s => s.titre).filter(Boolean); d.objet = t.length ? "Travaux : " + t.slice(0, 3).join(", ").toLowerCase() : "Travaux de rénovation"; }
      d.totaux = totaux(d); d.updatedAt = Date.now();
      await linkDevisClient(d).catch(() => {});
      S.devis.unshift(d); await put("devis/" + d.id, d).catch(() => {});
      res.push({ f: f.name, d });
    } catch (e) { console.error(e); res.push({ f: f.name, err: e.message || "illisible" }); }
    const pe = $("#imp-p"); if (pe) pe.textContent = `${res.length} / ${files.length} fichier(s) lus`;
  }
  render();
  openModal(`<h3>Import terminé</h3><div class="list">${res.map(r => r.d
    ? `<div class="it" data-a="open" data-id="${r.d.id}"><div class="m"><div class="t">${esc(r.d.numero || "Sans numéro")} · ${esc(r.d.client.nom || "?")}</div><div class="s">${r.d.importe.notes.length ? "⚠ " + esc(r.d.importe.notes[0]) : "Totaux identiques à l'original"}</div></div><div class="a">${eur(r.d.totaux.ht)} HT</div></div>`
    : `<div class="it"><div class="m"><div class="t">${esc(r.f)}</div><div class="s" style="color:var(--warn)">Non importé : ${esc(r.err)}</div></div></div>`).join("")}</div>
    <div class="hint" style="margin-top:10px">Les devis importés sont en brouillon : ouvrez-les, vérifiez, puis « Générer le devis ». Ils gardent leur numéro.</div>
    <button class="btn block" style="margin-top:12px" data-a="close">OK</button>`);
}

/* ===================== Import catalogue / restauration ===================== */
async function importJSON(file, kind) {
  if (!file) return;
  let data; try { data = JSON.parse(await file.text()); } catch (e) { return toast("Fichier illisible"); }
  if (kind === "cat-import") {
    const items = Array.isArray(data) ? data : data.biblio;
    if (!Array.isArray(items) || !items.length) return toast("Aucune prestation dans ce fichier");
    let n = 0;
    for (const it of items) {
      if (!it.designation) continue;
      const b = Object.assign({ origine: "catalogue", uses: 0, details: [], aliases: [] }, it, { id: it.id || uid(), updatedAt: Date.now() });
      const i = S.biblio.findIndex(x => x.id === b.id); if (i >= 0) S.biblio[i] = Object.assign({}, S.biblio[i], b); else S.biblio.push(b);
      await put("biblio/" + b.id, b); n++;
    }
    toast(n + " prestation(s) importée(s)"); await dedupeBiblio(); render();
  } else {
    if (!data.devis || !data.biblio) return toast("Ce fichier n'est pas une sauvegarde");
    S.cfg = Object.assign({}, DEFAULT_CFG, data.cfg || {}); await put("config/app", S.cfg);
    for (const [k, list] of [["devis", data.devis], ["biblio", data.biblio], ["clients", data.clients || []]]) for (const x of list) { const L = S[k]; const i = L.findIndex(y => y.id === x.id); if (i >= 0) L[i] = x; else L.push(x); await put(k + "/" + x.id, x); }
    render(); toast("Sauvegarde restaurée");
  }
}

/* ===================== Événements ===================== */
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-a]"); if (!el) return;
  const a = el.dataset.a, si = Number(el.dataset.si), li = Number(el.dataset.li), d = S.draft;
  if (a === "modal-bg") { if (e.target === el) closeModal(); return; }
  if (el.tagName === "INPUT" && el.type === "file") return;
  switch (a) {
    case "tab": setView(el.dataset.v); break;
    case "lfc": { const l = d.sections[si].lignes[li]; l.fournitureComprise = el.checked; persistDraft(); render(); break; }
    case "ft": S.ft = el.dataset.e || ""; render(); break;
    case "cli-new": openClient(null); break;
    case "cli-open": e.preventDefault(); closeModal(); if (S.view === "edit" && d) { persistDraft(true); S.draft = null; lsSet("gph_current", null); } openClient(el.dataset.id); break;
    case "cf-type": S.cliEdit.type = el.dataset.e; if (S.cliEdit.type === "couple") { if (!S.cliEdit.p1.civ) S.cliEdit.p1.civ = "M."; if (!S.cliEdit.p2.nom && !S.cliEdit.p2.prenom) S.cliEdit.p2 = { civ: "Mme", prenom: "", nom: S.cliEdit.p1.nom }; } render(); break;
    case "cli-save": clientSaveForm(); break;
    case "cli-del": if (!el.dataset.ok) { el.dataset.ok = 1; el.textContent = "Confirmer la suppression ?"; return; }
      { const id = S.cliEdit.id; S.clients = S.clients.filter(x => x.id !== id); for (const x of S.devis) if (x.clientId === id) { x.clientId = null; put("devis/" + x.id, x).catch(() => {}); } await del("clients/" + id); S.cliEdit = null; setView("clients"); toast("Fiche supprimée"); } break;
    case "cli-newdevis": { const c = normClient(S.cliEdit); const nd = Object.assign(newDraft(), { clientId: c.id, client: snapshotOf(c) }); openDraft(nd, 1); break; }
    case "cli-export": exportClients(); break;
    case "cli-pick": clientPicker(); break;
    case "q-apply": applyAnswers(); break;
    case "q-skip": d.qAsked = [...new Set([...(d.qAsked || []), ...(d.questions || []).map(q => q.key)])]; d.questions = []; persistDraft(); render(); break;
    case "fe": S.fe = el.dataset.e || ""; render(); break;
    case "etat": d.etat = el.dataset.e; await persistDraft(true); render(); toast("Statut : " + ETATS.find(x => x[0] === d.etat)[1]); break;
    case "new": { const cur = lsGet("gph_current", null); openDraft(cur && cur.statut === "brouillon" && !S.devis.find(x => x.id === cur.id) && (cur.dictee || cur.sections?.length) ? cur : newDraft(), 1); break; }
    case "open": { closeModal(); const x = S.devis.find(v => v.id === el.dataset.id); if (x) openDraft(x, x.statut === "finalise" ? 3 : 2); break; }
    case "leave": persistDraft(true); S.draft = null; S.mailOpen = false; lsSet("gph_current", null); setView("list"); break;
    case "manual": S.step = 2; if (!d.sections.length) d.sections.push({ titre: "", lignes: [] }); render(); break;
    case "ai-run": aiRun(); break;
    case "mic": toggleMic(); break;
    case "l-sug": suggestModal(si, li); break;
    case "sug-pick": { const b = S.biblio.find(x => x.id === el.dataset.id), l = d.sections[si].lignes[li]; if (b) { Object.assign(l, { designation: b.designation, details: (b.details || []).slice(), unite: l.unite || b.unite, biblio_id: b.id }); if (l.source !== "dicte" && l.source !== "saisi") { l.pu = num(b.pu); l.source = l.pu === null ? "a_saisir" : "bibliotheque"; } if (b.unite === "forfait" && num(l.quantite) === null) { l.quantite = 1; l.unite = "forfait"; } closeModal(); render(); persistDraft(); } break; }
    case "sug-own": { const l = d.sections[si].lignes[li]; l.designation = window.Moteur.reformulate(l.raw); l.details = []; l.biblio_id = null; if (l.source === "bibliotheque") { l.pu = null; l.source = "a_saisir"; } closeModal(); render(); persistDraft(); break; }
    case "unlock": unlock(); break;
    case "lock-on": enableLock(); break;
    case "lock-off": disableLock(); break;
    case "logout": logout(); break;
    case "offline-mode": S.offlineMode = true; render(); break;
    case "relogin": e.preventDefault(); S.offlineMode = false; render(); break;
    case "backup": { const blob = new Blob([JSON.stringify({ version: 1, date: new Date().toISOString(), cfg: S.cfg, devis: S.devis, biblio: S.biblio, clients: S.clients }, null, 1)], { type: "application/json" }); downloadBlob(blob, `Sauvegarde_devis_GPH_${todayISO()}.json`); break; }
    case "step1": S.step = 1; render(); break;
    case "step2": S.step = 2; S.mailOpen = false; render(); break;
    case "step3": persistDraft(true); S.step = 3; render(); window.scrollTo(0, 0); break;
    case "sec-add": d.sections.push({ titre: "", lignes: [] }); render(); break;
    case "sec-del": if (d.sections[si].lignes.length && !el.dataset.ok) { el.dataset.ok = 1; el.textContent = "Confirmer ?"; el.style.fontSize = "12px"; return; } d.sections.splice(si, 1); render(); persistDraft(); break;
    case "l-add": d.sections[si].lignes.push({ id: uid(), type: "mo", designation: "", details: [], quantite: null, unite: "m²", pu: null, source: "a_saisir" }); render(); break;
    case "l-del": d.sections[si].lignes.splice(li, 1); render(); persistDraft(); break;
    case "l-up": case "l-down": { const L = d.sections[si].lignes, j = a === "l-up" ? li - 1 : li + 1; if (j >= 0 && j < L.length) { [L[li], L[j]] = [L[j], L[li]]; render(); persistDraft(); } break; }
    case "ltype": { const l = d.sections[si].lignes[li]; if (l.type !== el.dataset.t) { l.type = el.dataset.t; if (l.type === "fourniture" && l.source !== "dicte") { l.pu = null; l.source = "a_saisir"; l.biblio_id = null; } render(); persistDraft(); } break; }
    case "l-lib": libPicker(si); break;
    case "pick": { const b = S.biblio.find(x => x.id === el.dataset.id); if (b) { d.sections[S.pickSi].lignes.push({ id: uid(), type: "mo", fournitureComprise: !!b.fournitureComprise, designation: b.designation, details: (b.details || []).slice(), quantite: b.unite === "forfait" ? 1 : null, unite: b.unite, pu: num(b.pu), source: "bibliotheque", biblio_id: b.id }); closeModal(); render(); persistDraft(); } break; }
    case "pick-client": { const c0 = S.clients.find(x => x.id === el.dataset.id); if (c0 && d) { const c = normClient(c0); d.clientId = c.id; d.client = snapshotOf(c); closeModal(); render(); persistDraft(); break; } if (c0) { d.client = { nom: c.nom, adresse: c.adresse || "", cpVille: c.cpVille || "", email: c.email || "", tel: c.tel || "" }; render(); persistDraft(); } break; }
    case "idem": d.chantierIdem = el.checked; render(); persistDraft(); break;
    case "pj-del": d.pj.splice(Number(el.dataset.i), 1); render(); persistDraft(); break;
    case "finalize": el.disabled = true; await finalize(); break;
    case "pdf-dl": savePDF(false); break;
    case "pdf-mail": savePDF(true); break;
    case "copy-mail": { const t = totaux(d); const body = `Bonjour,\n\nVeuillez trouver ci-joint notre devis N° ${d.numero} pour ${d.objet || "les travaux"}, d'un montant de ${eur(t.ttc)} TTC.\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\nPhilippe GALLOIS\n${S.cfg.societe} · ${S.cfg.tel}`;
      try { await navigator.clipboard.writeText(body); toast("Texte copié"); } catch (x) { toast("Copie impossible"); } break; }
    case "dup": { const c = JSON.parse(JSON.stringify(d)); Object.assign(c, { id: uid(), numero: null, exercice: null, statut: "brouillon", etat: null, importe: null, date: todayISO(), createdAt: Date.now(), finalisedAt: null }); c.sections.forEach(s => s.lignes.forEach(l => l.id = uid())); openDraft(c, 2); persistDraft(true); toast("Copie créée : nouveau numéro à la génération"); break; }
    case "draft-del": if (!el.dataset.ok) { el.dataset.ok = 1; el.textContent = d.statut === "finalise" ? "Confirmer : supprimer le devis " + d.numero + " ?" : "Confirmer la suppression ?"; return; }
      S.devis = S.devis.filter(x => x.id !== d.id); await del("devis/" + d.id); S.draft = null; lsSet("gph_current", null); setView("list"); toast("Supprimé"); break;
    case "lib-new": libModal(null); break;
    case "lib-edit": libModal(el.dataset.id); break;
    case "lib-save": libSave(el.dataset.id); break;
    case "lib-del": if (!el.dataset.ok) { el.dataset.ok = 1; el.textContent = "Confirmer ?"; return; } S.biblio = S.biblio.filter(x => x.id !== el.dataset.id); closeModal(); render(); await del("biblio/" + el.dataset.id); break;
    case "cfg-save": cfgSave(); break;
    case "close": closeModal(); break;
  }
});
document.addEventListener("input", e => {
  const el = e.target, d = S.draft;
  if (el.id === "pk-q") { $("#pk-list").innerHTML = pickList(el.value); return; }
  if (el.id === "pc-q") { $("#pc-list").innerHTML = pickClientList(el.value); return; }
  if (el.dataset.in === "qc") { S.qc = el.value; const pos = el.selectionStart; render(); const n = $("[data-in='qc']"); n.focus(); n.setSelectionRange(pos, pos); return; }
  if (el.dataset.cf && S.cliEdit) { const [a, b2] = el.dataset.cf.split("."); if (b2) S.cliEdit[a][b2] = el.value; else S.cliEdit[a] = el.value; const disp = $("#cf-disp"); if (disp) disp.textContent = clientDisplay(S.cliEdit) || "—"; return; }
  if (el.dataset.qa !== undefined && d && d.questions) { d.questions[Number(el.dataset.qa)].answer = el.value; return; }
  if (el.dataset.in === "q") { S.q = el.value; const pos = el.selectionStart; render(); const n = $("[data-in='q']"); n.focus(); n.setSelectionRange(pos, pos); return; }
  if (el.dataset.in === "qb") { S.qb = el.value; const pos = el.selectionStart; render(); const n = $("[data-in='qb']"); n.focus(); n.setSelectionRange(pos, pos); return; }
  if (!d) return;
  if (el.dataset.in === "dictee") { d.dictee = el.value; lsSet("gph_current", d); return; }
  if (el.dataset.c) { d.client[el.dataset.c] = el.value; if (el.dataset.c === "nom") { $("#csug").innerHTML = clientSuggestions(); } persistDraft(); return; }
  if (el.dataset.d) { d[el.dataset.d] = el.dataset.d === "tva" ? Number(el.value) : el.value; if (el.dataset.d === "tva") render(); persistDraft(); return; }
  if (el.dataset.sec !== undefined) { d.sections[Number(el.dataset.sec)].titre = el.value; persistDraft(); return; }
  if (el.dataset.l) {
    const l = d.sections[Number(el.dataset.si)].lignes[Number(el.dataset.li)], k = el.dataset.l;
    if (k === "details") l.details = el.value.split("\n").map(s => s.trim()).filter(Boolean);
    else if (k === "quantite" || k === "pu") { l[k] = num(el.value); if (k === "pu") l.source = l.pu === null ? "a_saisir" : (l.type === "fourniture" ? "saisi" : "saisi"); }
    else l[k] = el.value;
    if (k === "quantite" || k === "pu") {   // mise à jour légère sans tout redessiner
      const card = el.closest(".line"); const tot = lineTotal(l);
      card.querySelector(".tot").textContent = eur(tot);
      el.classList.toggle("need", num(el.value) === null);
      card.classList.toggle("warn", num(l.pu) === null || num(l.quantite) === null);
      const t = totaux(d), box = $(".totals");
      if (box) box.innerHTML = `<div class="r"><span>Total HT</span><span>${eur(t.ht)}</span></div><div class="r"><span>TVA ${String(d.tva).replace(".", ",")} %</span><span>${eur(t.tva)}</span></div><div class="r big"><span>Total TTC</span><span>${eur(t.ttc)}</span></div>${t.incomplet ? `<div class="r" style="color:#FFE0A3">${t.incomplet} ligne(s) sans prix ou quantité</div>` : ""}`;
    }
    persistDraft();
  }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.a === "pj-add") { addPJ([...el.files]); el.value = ""; return; }
  if (el.dataset.a === "cli-import") { importClients([...el.files]); el.value = ""; return; }
  if (el.dataset.cf && S.cliEdit) { const [a, b2] = el.dataset.cf.split("."); if (b2) S.cliEdit[a][b2] = el.value; else S.cliEdit[a] = el.value; const disp = $("#cf-disp"); if (disp) disp.textContent = clientDisplay(S.cliEdit) || "—"; return; }
  if (el.dataset.a === "devis-import") { importDevis([...el.files]); el.value = ""; return; }
  if (el.dataset.a === "cat-import" || el.dataset.a === "restore") { importJSON(el.files[0], el.dataset.a); el.value = ""; return; }
  if (el.dataset.l === "unite" && S.draft) { S.draft.sections[Number(el.dataset.si)].lignes[Number(el.dataset.li)].unite = el.value; persistDraft(); }
  if (el.dataset.dd && S.draft) {
    const d = S.draft, k = el.dataset.dd; d[k] = k === "dureeJours" ? (num(el.value) ?? null) : (el.value || null);
    if ((k === "debut" || k === "dureeJours") && d.debut && num(d.dureeJours)) d.finPrevue = addWorkDays(d.debut, num(d.dureeJours));
    persistDraft(true); render(); return;
  }
  if (el.dataset.d === "date" && S.draft) { S.draft.date = el.value || todayISO(); persistDraft(); }
});
window.addEventListener("pagehide", () => { if (S.draft) lsSet("gph_current", S.draft); });

boot();