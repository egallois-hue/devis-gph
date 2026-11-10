/* Répertoire clients (petit CRM) : fiches particulier / couple / professionnel,
   devis rattachés, import (CSV, Excel .xlsx, contacts .vcf) et export CSV. */
"use strict";
const CIVS = ["M.", "Mme", "Mlle", ""];
const TYPES = [["particulier", "Une personne"], ["couple", "Un couple"], ["pro", "Professionnel / copropriété"]];
const PRO_RE = /\b(?:copropri[ée]t[ée]|r[ée]sidence|syndic|soci[ée]t[ée]|sci|sarl|sas|sasu|eurl|mairie|cabinet|agence|association|entreprise|groupe|immobili[eè]re|ets|[ée]tablissements?)\b/i;

function cleanP(p) { return { civ: (p && p.civ) || "", prenom: ((p && p.prenom) || "").trim(), nom: ((p && p.nom) || "").trim() }; }
function personName(p, withCiv = true) { return [withCiv ? p.civ : "", p.prenom, p.nom].filter(Boolean).join(" "); }
function clientDisplay(c) {
  if (c.type === "pro") return (c.societe || "").trim() || personName(cleanP(c.p1));
  const p1 = cleanP(c.p1), p2 = cleanP(c.p2);
  if (c.type === "couple") {
    if (p1.nom && (!p2.nom || norm(p1.nom) === norm(p2.nom))) {
      if (p1.prenom || p2.prenom) { const civ = p1.civ && p2.civ; return `${[civ ? p1.civ : "", p1.prenom].filter(Boolean).join(" ")} et ${[civ ? p2.civ : "", p2.prenom].filter(Boolean).join(" ")} ${p1.nom}`.trim(); }
      return `${p1.civ || "M."} et ${p2.civ || "Mme"} ${p1.nom}`;
    }
    return [personName(p1), personName(p2)].filter(Boolean).join(" et ");
  }
  return personName(p1);
}
function clientCpVille(c) { return [c.cp, c.ville].filter(Boolean).join(" ").trim() || c.cpVille || ""; }
function splitCpVille(s) { const m = String(s || "").match(/^\s*(\d{2})\s?(\d{3})\s+(.+)$/); return m ? { cp: m[1] + m[2], ville: m[3].trim() } : { cp: "", ville: String(s || "").trim() }; }
/* « M. et Mme Martin-Durand », « Mme Leroy », « Copropriété … » → fiche structurée */
function parseNom(nom) {
  const n = String(nom || "").trim(); const c = { type: "particulier", p1: cleanP(), p2: cleanP(), societe: "" };
  if (!n) return c;
  if (PRO_RE.test(n)) { c.type = "pro"; c.societe = n; return c; }
  let m = n.match(/^(?:m\.?|mr|monsieur)\s+et\s+(?:mme|madame)\s+(.+)$/i);
  if (m) { c.type = "couple"; const rest = m[1].trim(); const pm = rest.match(/^([A-ZÀ-Ý][a-zà-ÿ-]+)\s+et\s+([A-ZÀ-Ý][a-zà-ÿ-]+)\s+(.+)$/);
    if (pm) { c.p1 = { civ: "M.", prenom: pm[1], nom: pm[3] }; c.p2 = { civ: "Mme", prenom: pm[2], nom: pm[3] }; } else { c.p1 = { civ: "M.", prenom: "", nom: rest }; c.p2 = { civ: "Mme", prenom: "", nom: rest }; } return c; }
  m = n.match(/^(.+?)\s+et\s+(.+)$/);
  if (m && !/^(?:m\.|mr|mme|monsieur|madame)$/i.test(m[1].trim())) { c.type = "couple"; c.p1 = parsePerson(m[1]); c.p2 = parsePerson(m[2]); return c; }
  c.p1 = parsePerson(n); return c;
}
function parsePerson(s) {
  let t = String(s || "").trim(), civ = "";
  const cm = t.match(/^(m\.?|mr\.?|monsieur|mme|madame|mlle|mademoiselle)\s+/i);
  if (cm) { civ = /^m(?:\.|r)?\.?$|^monsieur$/i.test(cm[1].trim()) ? "M." : /mlle|mademoiselle/i.test(cm[1]) ? "Mlle" : "Mme"; t = t.slice(cm[0].length).trim(); }
  const w = t.split(/\s+/).filter(Boolean);
  if (w.length <= 1) return { civ, prenom: "", nom: w[0] || "" };
  // « DUPONT Henri » (nom en capitales d'abord) ou « Henri Dupont »
  if (w[0] === w[0].toUpperCase() && w[0].length > 1 && w[1] !== w[1].toUpperCase()) return { civ, prenom: w.slice(1).join(" "), nom: w[0].charAt(0) + w[0].slice(1).toLowerCase() };
  if (civ) return { civ, prenom: w.length > 1 && /^[A-ZÀ-Ý][a-zà-ÿ]+(?:-[A-ZÀ-Ý][a-zà-ÿ]+)?$/.test(w[0]) && w.length === 2 ? w[0] : "", nom: w.length === 2 && /^[A-ZÀ-Ý][a-zà-ÿ]+(?:-[A-ZÀ-Ý][a-zà-ÿ]+)?$/.test(w[0]) ? w[1] : w.join(" ") };
  return { civ, prenom: w[0], nom: w.slice(1).join(" ") };
}
function normClient(c) {
  const x = Object.assign({ type: "particulier", p1: cleanP(), p2: cleanP(), societe: "", adresse: "", cp: "", ville: "", tel: "", tel2: "", email: "", email2: "", notes: "" }, c);
  if (!c.p1 && c.nom) Object.assign(x, parseNom(c.nom));
  if (!x.cp && !x.ville && c.cpVille) Object.assign(x, splitCpVille(c.cpVille));
  x.p1 = cleanP(x.p1); x.p2 = cleanP(x.p2);
  x.nom = clientDisplay(x) || c.nom || ""; x.cpVille = clientCpVille(x);
  return x;
}
function clientKey(c) { return norm((c.nom || "") + "|" + (c.cp || splitCpVille(c.cpVille).cp || "")); }
function snapshotOf(c) { return { nom: c.nom, adresse: c.adresse || "", cpVille: clientCpVille(c), email: c.email || "", tel: c.tel || "" }; }
function devisOf(c) { return S.devis.filter(d => d.clientId === c.id).sort((a, b) => String(b.date).localeCompare(String(a.date))); }
async function saveClient(c) { c = normClient(c); c.updatedAt = Date.now(); const i = S.clients.findIndex(x => x.id === c.id); if (i >= 0) S.clients[i] = c; else S.clients.push(c); await put("clients/" + c.id, c).catch(() => {}); return c; }

/* Rattache un devis à une fiche (trouvée par nom + code postal, sinon créée) */
async function linkDevisClient(d, create = true) {
  if (d.clientId && S.clients.some(c => c.id === d.clientId)) return S.clients.find(c => c.id === d.clientId);
  if (!d.client?.nom?.trim()) return null;
  const cp = splitCpVille(d.client.cpVille).cp, n = norm(d.client.nom);
  let c = S.clients.find(x => norm(x.nom) === n && (!cp || !x.cp || x.cp === cp)) || S.clients.find(x => norm(x.nom) === n);
  if (!c && !create) return null;
  if (!c) { const nc = normClient(Object.assign({}, d.client)); delete nc.id; c = await saveClient(Object.assign(nc, { id: uid(), createdAt: Date.now() })); }
  else { // complète la fiche avec ce que le devis apporte
    let ch = false; for (const k of ["adresse", "email", "tel"]) if (!c[k] && d.client[k]) { c[k] = d.client[k]; ch = true; }
    if (!c.cp && d.client.cpVille) { Object.assign(c, splitCpVille(d.client.cpVille)); ch = true; } if (ch) c = await saveClient(c);
  }
  d.clientId = c.id; return c;
}
let migrated = false;
async function migrateClients() {
  if (migrated) return; migrated = true;
  S.clients = S.clients.map(normClient);
  for (const d of S.devis) if (!d.clientId && d.client?.nom && (d.statut === "finalise" || d.importe)) { await linkDevisClient(d); d.updatedAt = Date.now(); await put("devis/" + d.id, d).catch(() => {}); }
  saveLocal();
}

/* ---------- Vues ---------- */
function viewClients() {
  if (!migrated) migrateClients().then(() => { if (S.view === "clients") render(); });
  const q = norm(S.qc || "");
  const list = S.clients.map(normClient).filter(c => !q || norm([c.nom, c.ville, c.cp, c.email, c.tel, c.societe, c.p1.prenom, c.p2.prenom, c.p2.nom].join(" ")).includes(q))
    .filter(c => !S.ft || c.type === S.ft).sort((a, b) => (a.p1.nom || a.societe || a.nom).localeCompare(b.p1.nom || b.societe || b.nom, "fr"));
  const chips = [["", "Tous"], ...TYPES].map(([k, l]) => `<button class="chip ${(S.ft || "") === k ? "on" : ""}" data-a="ft" data-e="${k}">${k === "couple" ? "Couples" : k === "pro" ? "Professionnels" : k === "particulier" ? "Personnes" : l} <b>${k ? S.clients.filter(c => normClient(c).type === k).length : S.clients.length}</b></button>`).join("");
  return statusBanner() + `
  <input class="i" placeholder="Rechercher un client, une ville, un téléphone…" value="${esc(S.qc || "")}" data-in="qc" style="margin-bottom:10px">
  <div class="chips">${chips}</div>
  <div class="card list">${list.length ? list.map(c => { const dv = devisOf(c), last = dv[0];
    return `<div class="it" data-a="cli-open" data-id="${c.id}"><div class="m"><div class="t">${esc(c.nom || "Sans nom")}</div>
      <div class="s">${esc([clientCpVille(c), c.tel].filter(Boolean).join(" · ") || "—")}</div></div>
      <div style="text-align:right"><div class="s">${dv.length} devis</div>${last ? etatPill(last) : ""}</div></div>`; }).join("")
    : `<div class="empty">${S.clients.length ? "Aucun résultat." : "Aucun client pour l'instant.<br>Ajoutez-en un, importez une liste, ou générez un devis : la fiche se crée toute seule."}</div>`}</div>
  <div class="card"><h2>Importer / exporter</h2>
    <div class="hint" style="margin-bottom:10px">Import : fichier Excel (.xlsx), CSV, ou contacts de l'iPhone / du Mac (.vcf). Les clients déjà présents ne sont pas dupliqués.</div>
    <label class="btn sec block">Importer une liste de clients<input type="file" multiple accept=".csv,.xlsx,.vcf,.txt,text/csv,text/vcard,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden data-a="cli-import"></label>
    <div style="height:8px"></div><button class="btn sec block" data-a="cli-export">Exporter tous les clients (Excel / CSV)</button>
  </div>`;
}
function clientForm(c) {
  const p = (k, i) => { const v = c[k]; return `<div class="row"><div style="flex:0 0 84px"><label class="f">Civilité</label><select class="i" data-cf="${k}.civ">${CIVS.map(x => `<option ${x === v.civ ? "selected" : ""} value="${x}">${x || "—"}</option>`).join("")}</select></div>
    <div><label class="f">Prénom${i ? " " + i : ""}</label><input class="i" data-cf="${k}.prenom" value="${esc(v.prenom)}"></div><div><label class="f">Nom${i ? " " + i : ""}</label><input class="i" data-cf="${k}.nom" value="${esc(v.nom)}"></div></div>`; };
  const f = (k, l, ex = "") => `<label class="f">${l}</label><input class="i" data-cf="${k}" value="${esc(c[k] || "")}" ${ex}>`;
  return `<div class="seg" style="display:flex;margin-bottom:6px">${TYPES.map(([k, l]) => `<button class="${c.type === k ? "on" : ""}" data-a="cf-type" data-e="${k}" style="flex:1">${l}</button>`).join("")}</div>
    ${c.type === "pro" ? f("societe", "Société, copropriété, syndic…") + `<div class="hint" style="margin-top:8px">Contact sur place</div>` + p("p1", "") : c.type === "couple" ? p("p1", "1") + p("p2", "2") : p("p1", "")}
    ${f("adresse", "Adresse")}<div class="row"><div style="flex:0 0 110px">${f("cp", "Code postal", 'inputmode="numeric"')}</div><div>${f("ville", "Ville")}</div></div>
    <div class="row"><div>${f("tel", "Téléphone", 'inputmode="tel"')}</div><div>${f("tel2", c.type === "couple" ? "Téléphone 2" : "Autre téléphone", 'inputmode="tel"')}</div></div>
    <div class="row"><div>${f("email", "E-mail", 'inputmode="email"')}</div><div>${f("email2", c.type === "couple" ? "E-mail 2" : "Autre e-mail", 'inputmode="email"')}</div></div>
    <label class="f">Notes (accès, digicode, préférences…)</label><textarea class="i" data-cf="notes" style="min-height:60px">${esc(c.notes || "")}</textarea>
    <div class="hint" style="margin-top:8px">Nom sur les devis : <b id="cf-disp">${esc(clientDisplay(c) || "—")}</b></div>`;
}
function viewClient() {
  const c = S.cliEdit; if (!c) { S.view = "clients"; return viewClients(); }
  const dv = S.clients.some(x => x.id === c.id) ? devisOf(c) : [];
  const ca = dv.filter(d => ["accepte", "acompte1", "en_cours", "acompte2", "fini", "paye"].includes(etatOf(d))).reduce((a, d) => a + (d.totaux?.ht || 0), 0);
  return `<div class="card"><h2>${S.clients.some(x => x.id === c.id) ? "Fiche client" : "Nouveau client"}</h2>${clientForm(c)}</div>
  ${S.clients.some(x => x.id === c.id) ? `<div class="card"><h2>Devis de ce client</h2>
    ${dv.length ? `<div class="hint" style="margin-bottom:6px">${dv.length} devis · ${eur(ca)} HT acceptés</div><div class="list">${dv.map(d => `<div class="it" data-a="open" data-id="${d.id}"><div class="m"><div class="t">${esc(d.numero || "Brouillon")} · ${dFR(d.date)}</div><div class="s">${esc(d.objet || "")}</div></div><div style="text-align:right"><div class="a">${eur(d.totaux?.ttc)}</div>${etatPill(d)}</div></div>`).join("")}</div>` : `<div class="empty">Aucun devis pour ce client.</div>`}
    <button class="btn block" style="margin-top:10px" data-a="cli-newdevis">＋ Nouveau devis pour ce client</button></div>
  <div class="card"><button class="btn danger block" data-a="cli-del">${dv.length ? "Supprimer la fiche (les devis restent)" : "Supprimer ce client"}</button></div>` : ""}`;
}
function openClient(id) { const c = id ? S.clients.find(x => x.id === id) : null; S.cliEdit = JSON.parse(JSON.stringify(normClient(c || { id: uid(), createdAt: Date.now() }))); setView("client"); }
async function clientSaveForm() {
  const c = normClient(S.cliEdit);
  if (!c.nom.trim()) return toast("Indiquez au moins un nom.");
  const dup = S.clients.find(x => x.id !== c.id && clientKey(normClient(x)) === clientKey(c));
  if (dup && !S._dupOk) { S._dupOk = 1; return toast("Un client porte déjà ce nom : touchez encore « Enregistrer » pour confirmer."); }
  S._dupOk = 0; await saveClient(c); S.cliEdit = JSON.parse(JSON.stringify(normClient(c)));
  // les brouillons rattachés prennent les nouvelles coordonnées (les devis émis gardent les leurs)
  for (const d of S.devis) if (d.clientId === c.id && d.statut !== "finalise") { d.client = snapshotOf(c); await put("devis/" + d.id, d).catch(() => {}); }
  toast("Client enregistré"); render();
}
function clientPicker() {
  S.qpc = "";
  openModal(`<h3>Répertoire clients</h3><input class="i" id="pc-q" placeholder="Rechercher…" autocomplete="off"><div class="list" id="pc-list" style="margin-top:8px">${pickClientList("")}</div>
    <button class="btn sec block" style="margin-top:10px" data-a="close">Fermer</button>`);
}
function pickClientList(q) {
  q = norm(q);
  const items = S.clients.map(normClient).filter(c => !q || norm([c.nom, c.ville, c.tel].join(" ")).includes(q)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 60);
  return items.map(c => `<div class="it" data-a="pick-client" data-id="${c.id}"><div class="m"><div class="t">${esc(c.nom)}</div><div class="s">${esc([c.adresse, clientCpVille(c)].filter(Boolean).join(", "))}</div></div></div>`).join("") || `<div class="empty">Aucun client.</div>`;
}

/* ---------- Import / export ---------- */
function parseCSV(text) {
  text = text.replace(/^﻿/, ""); const first = text.split(/\r?\n/)[0] || "";
  const sep = [";", "\t", ","].map(s => [s, first.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { row.push(cell); cell = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += ch; }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim()));
}
async function xlsxRows(buf) {
  const zip = (n) => window.Importer.zipEntry(buf, n);
  const ss = await zip("xl/sharedStrings.xml"), strs = [];
  if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) strs.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(""));
  const sh = await zip("xl/worksheets/sheet1.xml"); if (!sh) throw new Error("Feuille Excel introuvable");
  const dec = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const col = r => { let n = 0; for (const ch of r.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const rows = [];
  for (const rm of sh.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) { const r = [];
    for (const cm of rm[1].matchAll(/<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) { const at = cm[1], ref = (at.match(/r="([A-Z]+\d+)"/) || [])[1], t = (at.match(/t="(\w+)"/) || [])[1], inner = cm[2] || "";
      let v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1]; if (t === "s") v = strs[Number(v)]; else if (t === "inlineStr") v = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join("");
      if (ref) r[col(ref)] = dec(String(v ?? "")); }
    rows.push(Array.from(r, x => x ?? "")); }
  return rows.filter(r => r.some(x => String(x).trim()));
}
const HEAD = { type: /^type$/, civ: /^civ(?:ilit[ée])?\s*1?$|^titre$/, prenom: /^pr[ée]nom\s*1?$|^first\s*name$/, nom: /^nom\s*1?$|^nom de famille$|^last\s*name$|^surname$/,
  civ2: /^civ(?:ilit[ée])?\s*2$/, prenom2: /^pr[ée]nom\s*2$/, nom2: /^nom\s*2$/, full: /^(?:client|nom complet|nom et pr[ée]nom|d[ée]nomination|contact)$/,
  societe: /^(?:soci[ée]t[ée]|entreprise|raison sociale|organisation|company)$/, adresse: /^(?:adresse|rue|adresse 1|address)$/, cp: /^(?:cp|code postal|code_postal|postal code|zip)$/,
  ville: /^(?:ville|commune|localit[ée]|city)$/, cpville: /^(?:cp ville|code postal et ville)$/, tel: /^(?:t[ée]l[ée]?(?:phone)?\s*1?|portable|mobile|phone)$/, tel2: /^(?:t[ée]l[ée]?(?:phone)?\s*2|fixe|autre t[ée]l[ée]phone)$/,
  email: /^(?:e[\s-]?mail\s*1?|mail|courriel|email address)$/, email2: /^(?:e[\s-]?mail\s*2|autre e[\s-]?mail)$/, notes: /^(?:notes?|commentaires?|remarques?)$/ };
function rowsToClients(rows) {
  if (rows.length < 2) return [];
  const h = rows[0].map(x => norm(String(x)).replace(/[_.]/g, " ").replace(/\s+/g, " ").trim()), idx = {};
  h.forEach((x, i) => { for (const [k, re] of Object.entries(HEAD)) if (idx[k] === undefined && re.test(x)) { idx[k] = i; break; } });
  if (idx.nom === undefined && idx.full === undefined && idx.societe === undefined) idx.full = 0;
  const g = (r, k) => idx[k] === undefined ? "" : String(r[idx[k]] ?? "").trim();
  return rows.slice(1).map(r => {
    let c = { id: uid(), createdAt: Date.now() };
    const type = norm(g(r, "type"));
    if (g(r, "nom") || g(r, "prenom")) {
      Object.assign(c, { type: /couple/.test(type) || g(r, "nom2") || g(r, "prenom2") ? "couple" : /pro|soci|copro|entreprise/.test(type) ? "pro" : "particulier",
        p1: { civ: civOf(g(r, "civ")), prenom: g(r, "prenom"), nom: g(r, "nom") }, p2: { civ: civOf(g(r, "civ2")) || (g(r, "nom2") || g(r, "prenom2") ? "Mme" : ""), prenom: g(r, "prenom2"), nom: g(r, "nom2") || (g(r, "prenom2") ? g(r, "nom") : "") } });
      if (c.type === "couple" && !c.p1.civ) c.p1.civ = "M.";
    } else if (g(r, "full")) Object.assign(c, parseNom(g(r, "full")));
    if (g(r, "societe")) { c.societe = g(r, "societe"); if (!c.p1 || (!c.p1.nom && !c.p1.prenom) || /pro|soci|copro/.test(type)) c.type = "pro"; }
    Object.assign(c, { adresse: g(r, "adresse"), cp: g(r, "cp").replace(/[\s\u200B]/g, ""), ville: g(r, "ville"), tel: g(r, "tel"), tel2: g(r, "tel2"), email: g(r, "email").toLowerCase(), email2: g(r, "email2").toLowerCase(), notes: g(r, "notes") });
    if (!c.cp && !c.ville && g(r, "cpville")) Object.assign(c, splitCpVille(g(r, "cpville")));
    if (/^\d{4}$/.test(c.cp)) c.cp = "0" + c.cp;   // Excel enlève le 0 de tête (01…09)
    return normClient(c);
  }).filter(c => c.nom.trim());
}
function civOf(s) { s = norm(s); return !s ? "" : /^(m|mr|monsieur)\.?$/.test(s) ? "M." : /^(mlle|mademoiselle)$/.test(s) ? "Mlle" : /^(mme|madame|mrs|ms)\.?$/.test(s) ? "Mme" : ""; }
function vcfToClients(text) {
  const out = []; text = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  for (const block of text.split(/BEGIN:VCARD/i).slice(1)) {
    const lines = block.split(/\r?\n/); const get = k => lines.filter(l => new RegExp("^(?:item\\d+\\.)?" + k + "[;:]", "i").test(l)).map(l => l.slice(l.indexOf(":") + 1).replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, " ").trim());
    const N = (get("N")[0] || "").split(";"), FN = get("FN")[0] || "", ORG = (get("ORG")[0] || "").replace(/;+$/, "").replace(/;/g, " ");
    const adr = (get("ADR")[0] || "").split(";"), tels = get("TEL"), mails = get("EMAIL");
    let c = { id: uid(), createdAt: Date.now() };
    if (N[0] || N[1]) c.p1 = { civ: civOf(N[3] || ""), prenom: N[1] || "", nom: N[0] || "" }; else Object.assign(c, parseNom(FN));
    if (ORG && !(N[0] || N[1])) { c.type = "pro"; c.societe = ORG; } else if (ORG) c.notes = ORG;
    Object.assign(c, { adresse: (adr[2] || "").trim(), ville: (adr[3] || "").trim(), cp: (adr[5] || "").trim(), tel: tels[0] || "", tel2: tels[1] || "", email: (mails[0] || "").toLowerCase(), email2: (mails[1] || "").toLowerCase() });
    const note = get("NOTE")[0]; if (note) c.notes = [c.notes, note].filter(Boolean).join(" · ");
    c = normClient(c); if (c.nom.trim()) out.push(c);
  }
  return out;
}
async function importClients(files) {
  let all = [];
  for (const f of files) {
    try {
      const buf = await f.arrayBuffer(), head = new Uint8Array(buf.slice(0, 2)), name = f.name.toLowerCase();
      if (head[0] === 0x50 && head[1] === 0x4B) all = all.concat(rowsToClients(await xlsxRows(buf)));
      else { let txt = new TextDecoder("utf-8").decode(buf); if (txt.includes("�")) txt = new TextDecoder("windows-1252").decode(buf);
        all = all.concat(/BEGIN:VCARD/i.test(txt) || name.endsWith(".vcf") ? vcfToClients(txt) : rowsToClients(parseCSV(txt))); }
    } catch (e) { console.error(e); toast("Fichier illisible : " + f.name); }
  }
  let added = 0, merged = 0;
  for (const c of all) {
    const ex = S.clients.find(x => clientKey(normClient(x)) === clientKey(c)) || (c.email && S.clients.find(x => x.email && x.email === c.email));
    if (ex) { const m = normClient(ex); let ch = false; for (const k of ["adresse", "cp", "ville", "tel", "tel2", "email", "email2", "notes"]) if (!m[k] && c[k]) { m[k] = c[k]; ch = true; } if (ch) { await saveClient(m); merged++; } }
    else { await saveClient(c); added++; }
  }
  render(); toast(`${added} client(s) ajouté(s)${merged ? `, ${merged} complété(s)` : ""}${all.length - added - merged > 0 ? `, ${all.length - added - merged} déjà présent(s)` : ""}`);
}
function exportClients() {
  const cols = ["Type", "Civilité 1", "Prénom 1", "Nom 1", "Civilité 2", "Prénom 2", "Nom 2", "Société", "Nom sur les devis", "Adresse", "Code postal", "Ville", "Téléphone", "Téléphone 2", "E-mail", "E-mail 2", "Notes", "Nombre de devis", "Dernier devis"];
  const q = v => { v = String(v ?? ""); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const lines = [cols.join(";")];
  for (const c0 of S.clients) { const c = normClient(c0), dv = devisOf(c);
    lines.push([({ particulier: "Personne", couple: "Couple", pro: "Professionnel" })[c.type], c.p1.civ, c.p1.prenom, c.p1.nom, c.p2.civ, c.p2.prenom, c.p2.nom, c.societe, c.nom, c.adresse, c.cp, c.ville, c.tel, c.tel2, c.email, c.email2, c.notes, dv.length, dv[0]?.numero || ""].map(q).join(";")); }
  downloadBlob(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `Clients_GALLOIS-PH_${todayISO()}.csv`);
}
