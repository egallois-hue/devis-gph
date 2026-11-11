/* Compléments : remise, dates de statut, signature sur écran, avenants, revue des prix indicatifs,
   lecture des devis fournisseurs (PDF), sauvegarde automatique. Aucun prix n'est inventé. */
(function () {
  "use strict";
  const fd = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";

  /* ---------- Remise ---------- */
  window.remRows = (t, d) => t.remise ? `<div class="r"><span>Total HT avant remise</span><span>${eur(t.brut)}</span></div><div class="r"><span>Remise${d.remise.type === "eur" ? "" : " " + String(d.remise.val).replace(".", ",") + " %"}</span><span>− ${eur(t.remise)}</span></div>` : "";
  window.remiseCard = d => { const R = d.remise || { type: "pct", val: "" };
    return `<div class="card"><h2>Remise sur l'ensemble du devis</h2><div class="row"><div><label class="f">Type</label><select class="i" data-rem="type"><option value="pct" ${R.type !== "eur" ? "selected" : ""}>En % du total HT</option><option value="eur" ${R.type === "eur" ? "selected" : ""}>En € HT</option></select></div>
      <div><label class="f">Montant</label><input class="i" data-rem="val" inputmode="decimal" placeholder="0" value="${esc(R.val ?? "")}"></div></div><div class="hint" style="margin-top:6px">Laissez vide s'il n'y a pas de remise. Elle apparaît sur le devis, avant la TVA. Pour une remise sur une seule prestation, utilisez le champ « Remise % » de sa ligne ; les deux peuvent se cumuler.</div></div>`; };
  function majTotaux() { const d = S.draft, t = totaux(d), box = document.querySelector(".totals"); if (!box) return;
    box.innerHTML = `${remRows(t, d)}<div class="r"><span>Total HT</span><span>${eur(t.ht)}</span></div><div class="r"><span>TVA ${String(d.tva).replace(".", ",")} %</span><span>${eur(t.tva)}</span></div><div class="r big"><span>Total TTC</span><span>${eur(t.ttc)}</span></div>${t.incomplet ? `<div class="r" style="color:#FFE0A3">${t.incomplet} ligne(s) sans prix ou quantité</div>` : ""}`; }

  /* ---------- Onglet Devis : sélection multiple ---------- */
  const selList = () => S.devis.filter(d => S.sel && S.sel.has(d.id));
  window.selEntete = function (rows) {
    if (!S.sel) return rows.length ? `<div style="text-align:right;margin:-2px 0 8px"><button class="btn ghost sm" data-a="sel-on">Sélectionner plusieurs devis</button></div>` : "";
    S.selVisible = rows.map(d => d.id); const tous = rows.length && rows.every(d => S.sel.has(d.id));
    return `<div class="selhead"><button class="btn ghost sm" data-a="sel-all">${tous ? "Tout désélectionner" : `Tout sélectionner (${rows.length})`}</button><button class="btn ghost sm" data-a="sel-off">Terminer</button></div>`; };
  window.selBarre = function () { const L = selList(), n = L.length, ttc = L.reduce((a, d) => a + ((d.totaux && d.totaux.ttc) || 0), 0), off = n ? "" : "disabled";
    return `<div class="bar selbar"><div class="selinfo"><b>${n}</b> sélectionné${n > 1 ? "s" : ""}${n ? ` · ${eur(ttc)} TTC` : ""}</div><button class="btn sec" data-a="sel-etat" ${off}>Statut</button><button class="btn sec" data-a="sel-csv" ${off}>Exporter</button><button class="btn danger" data-a="sel-del" ${off}>Supprimer</button></div>`; };
  async function selEtat(e) { const L = selList().filter(d => d.statut === "finalise"), br = selList().length - L.length;
    for (const d of L) { setEtat(d, e); d.updatedAt = Date.now(); await put("devis/" + d.id, d).catch(() => {}); }
    closeModal(); render(); toast(`${L.length} devis passé${L.length > 1 ? "s" : ""} à « ${ETATS.find(x => x[0] === e)[1]} »${br ? ` · ${br} brouillon${br > 1 ? "s" : ""} ignoré${br > 1 ? "s" : ""}` : ""}`, 3600); }
  async function selSuppr() { const L = selList(), ids = new Set(L.map(d => d.id));
    S.devis = S.devis.filter(d => !ids.has(d.id)); for (const id of ids) await del("devis/" + id).catch(() => {});
    if (S.draft && ids.has(S.draft.id)) { S.draft = null; lsSet("gph_current", null); }
    S.sel = new Set(); closeModal(); render(); toast(`${ids.size} devis supprimé${ids.size > 1 ? "s" : ""}`); }
  function selCSV() { const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`, n2 = v => (v === null || v === undefined || !isFinite(v)) ? "" : String(r2(v)).replace(".", ",");
    const rows = [["Numéro", "Date", "Client", "Ville", "Objet", "Statut", "Total HT", "TVA %", "Total TTC", "Début", "Fin prévue"]].concat(selList().sort((a, b) => String(a.numero || "~").localeCompare(String(b.numero || "~"))).map(d => { const t = d.totaux || totaux(d), e = etatOf(d);
      return [d.numero || "Brouillon", d.date || "", d.client?.nom || "", d.client?.cpVille || "", d.objet || "", e ? ETATS.find(x => x[0] === e)[1] + (isLate(d) ? " (en retard)" : "") : "Brouillon", n2(t.ht), String(d.tva ?? "").replace(".", ","), n2(t.ttc), d.debut || "", d.finPrevue || ""]; }));
    downloadBlob(new Blob(["\ufeff" + rows.map(r => r.map(q).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }), `devis-selection-${todayISO()}.csv`); toast("Liste exportée (s'ouvre dans Excel)"); }

  /* ---------- Onglet Prestations : filtres et compteurs ---------- */
  const ORIG = [["", "Toutes"], ["moi", "Mes tarifs"], ["auto", "Créées par la dictée"], ["manuel", "Ajoutées à la main"], ["marche", "Prix du marché"], ["sansprix", "Prix à définir"], ["utilisees", "Déjà utilisées"]];
  const origOf = b => b.origine === "auto" ? "auto" : b.origine === "manuel" ? "manuel" : b.origine === "marché" ? "marche" : "moi";
  const okOrig = (b, o) => !o || (o === "sansprix" ? (b.pu === null || b.pu === undefined) : o === "utilisees" ? (b.uses || 0) > 0 : origOf(b) === o);
  window.libFiltre = b => (!S.libCat || (b.metier || "Divers") === S.libCat) && okOrig(b, S.libOri || "");
  window.libFiltres = function (nAff) {
    const cats = {}; for (const b of S.biblio) if (okOrig(b, S.libOri || "")) cats[b.metier || "Divers"] = (cats[b.metier || "Divers"] || 0) + 1;
    const inCat = b => !S.libCat || (b.metier || "Divers") === S.libCat, nInd = S.biblio.filter(prixIndicatif).length;
    return `<div class="lib-count"><b>${S.biblio.length}</b> prestation${S.biblio.length > 1 ? "s" : ""} au total${nAff !== S.biblio.length && !S.revue ? ` · <b>${nAff}</b> affichée${nAff > 1 ? "s" : ""}` : ""} · ${Object.keys(cats).length} catégorie${Object.keys(cats).length > 1 ? "s" : ""}</div>
      <select class="i" data-lib="cat" style="margin-bottom:10px"><option value="">Toutes les catégories</option>${Object.keys(cats).sort((a, b) => a.localeCompare(b)).map(c => `<option value="${esc(c)}" ${S.libCat === c ? "selected" : ""}>${esc(c)} (${cats[c]})</option>`).join("")}</select>
      <div class="chips" style="margin-bottom:10px">${ORIG.map(o => { const n = S.biblio.filter(b => inCat(b) && okOrig(b, o[0])).length; return o[0] && !n ? "" : `<button class="chip ${!S.revue && (S.libOri || "") === o[0] ? "on" : ""}" data-a="lib-ori" data-v="${o[0]}">${o[1]} <b>${n}</b></button>`; }).join("")}${nInd || S.revue ? `<button class="chip ${S.revue ? "on" : ""}" data-a="pv-mode" data-v="1">À valider <b>${nInd}</b></button>` : ""}</div>
      ${S.revue ? `<div class="banner w">Ces prix sont des estimations du marché, pas vos tarifs. Corrigez le prix si besoin puis touchez ✓. Un prix validé (ou utilisé dans un devis généré) devient le vôtre.</div>` : ""}`; };

  /* ---------- Statuts : dates réelles ---------- */
  window.setEtat = function (d, e, date) { d.etat = e; d.etatDates = Object.assign({}, d.etatDates, { [e]: date || todayISO() }); if (e === "envoye") d.dateEnvoi = d.etatDates[e]; };
  window.etatDatesHTML = function (d) { const D = d.etatDates || {}, e = etatOf(d), items = ETATS.filter(x => D[x[0]]).map(x => `${x[1]} le ${fd(D[x[0]])}`);
    return `<div class="row" style="margin-top:10px;align-items:flex-end"><div><label class="f">Date du statut « ${esc((ETATS.find(x => x[0] === e) || ["", ""])[1])} »</label><input class="i" type="date" data-etd="1" value="${esc(D[e] || "")}"></div></div>
      ${items.length ? `<div class="hint" style="margin-top:6px">Historique : ${items.map(esc).join(" · ")}</div>` : ""}`; };

  /* ---------- Avenants ---------- */
  const avenantsDe = d => S.devis.filter(x => x.avenantDe === d.id).sort((a, b) => (a.avenantNum || 0) - (b.avenantNum || 0));
  window.avenantHTML = function (d) {
    if (d.avenantDe) { const p = S.devis.find(x => x.id === d.avenantDe); return `<div class="banner i">Avenant n° ${d.avenantNum} au devis N° ${esc(d.parentNumero || p?.numero || "")}${p ? ` · <a href="#" data-a="open" data-id="${p.id}">ouvrir le devis d'origine</a>` : ""}</div>`; }
    const av = avenantsDe(d), T = x => (x.statut === "finalise" ? (x.totaux || totaux(x)).ttc : 0), tot = r2((d.totaux || totaux(d)).ttc + av.reduce((a, x) => a + T(x), 0));
    return `<div class="card"><h2>Travaux supplémentaires</h2>
      ${av.length ? `<div class="list">${av.map(x => `<div class="it" data-a="open" data-id="${x.id}"><div class="m"><div class="t">Avenant n° ${x.avenantNum} · ${esc(x.numero || "")}</div><div class="s">${x.statut === "finalise" ? "" : "Brouillon · "}${esc((x.objet || "").slice(0, 60))}</div></div><div class="a">${x.statut === "finalise" ? eur(T(x)) : "—"}</div></div>`).join("")}</div>
        <div class="hint" style="margin:8px 0">Total devis + avenants : <b>${eur(tot)} TTC</b></div>` : `<div class="hint" style="margin-bottom:10px">Des travaux s'ajoutent en cours de chantier ? L'avenant reprend le client et le chantier, porte le numéro du devis suivi de « -A1 », et se dicte comme un devis.</div>`}
      <button class="btn sec block" data-a="avenant">＋ Créer un avenant</button></div>`; };
  function creerAvenant(d) {
    const k = avenantsDe(d).length + 1;
    const c = { id: uid(), statut: "brouillon", date: todayISO(), client: JSON.parse(JSON.stringify(d.client)), clientId: d.clientId || null, chantierIdem: d.chantierIdem, chantier: d.chantier || "", tva: d.tva, acomptes: (d.acomptes || S.cfg.acomptes).slice(),
      objet: `Avenant n° ${k} au devis N° ${d.numero} — travaux supplémentaires`, sections: [], pj: [], dictee: "", createdAt: Date.now(), avenantDe: d.id, avenantNum: k, parentNumero: d.numero, numero: `${d.numero}-A${k}`, exercice: d.exercice };
    openDraft(c, 1); persistDraft(true); toast(`Avenant n° ${k} créé : dictez les travaux supplémentaires`);
  }

  /* ---------- Signature du client sur l'écran ---------- */
  window.signHTML = function (d) { const s = d.signature;
    return `<div class="card"><h2>Accord du client</h2>${s ? `<div class="signed"><img src="${s.img}" alt="Signature"><div><b>Bon pour accord</b><br>Signé le ${fd(s.date)} par ${esc(s.nom || d.client.nom || "le client")}<br><span class="hint">La signature figure sur le PDF.</span></div></div>
      <button class="btn ghost sm" data-a="sign-del" style="margin-top:8px">Retirer la signature</button>` : `<div class="hint" style="margin-bottom:10px">Le client signe au doigt sur l'écran. La signature et la date sont ajoutées au PDF, et le devis passe « Accepté ».</div><button class="btn block" data-a="sign">Faire signer le client</button>`}</div>`; };
  let pad = null;
  function ouvrirSignature(d) {
    const t = totaux(d);
    openModal(`<h2>Bon pour accord</h2><div class="hint">Devis N° ${esc(d.numero)} · ${eur(t.ttc)} TTC</div>
      <label class="f" style="margin-top:10px">Nom du signataire</label><input class="i" id="sg-nom" value="${esc(d.client.nom || "")}">
      <div class="sigwrap"><canvas id="sg-cv"></canvas><span>Signez ici</span></div>
      <div class="row" style="margin-top:10px"><button class="btn sec" data-a="sign-clear">Effacer</button><button class="btn" data-a="sign-ok">Valider la signature</button></div>`);
    const cv = document.getElementById("sg-cv"), r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); const cx = cv.getContext("2d"); cx.scale(dpr, dpr); cx.lineWidth = 2.4; cx.lineCap = cx.lineJoin = "round"; cx.strokeStyle = "#142A80";
    pad = { cv, cx, vide: true }; let on = false, last = null;
    const pos = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    cv.addEventListener("pointerdown", e => { e.preventDefault(); on = true; last = pos(e); cv.setPointerCapture(e.pointerId); cx.beginPath(); cx.arc(last[0], last[1], 1.1, 0, 7); cx.fillStyle = "#142A80"; cx.fill(); pad.vide = false; cv.parentNode.classList.add("on"); });
    cv.addEventListener("pointermove", e => { if (!on) return; e.preventDefault(); const p = pos(e); cx.beginPath(); cx.moveTo(last[0], last[1]); cx.lineTo(p[0], p[1]); cx.stroke(); last = p; });
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) cv.addEventListener(ev, () => { on = false; });
  }
  function rogner(cv) {      // garde seulement la zone signée, fond transparent
    const cx = cv.getContext("2d"), w = cv.width, h = cv.height, px = cx.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (px[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0 || y1 <= y0) return null; const m = 8; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w, x1 + m); y1 = Math.min(h, y1 + m);
    const o = document.createElement("canvas"); o.width = x1 - x0; o.height = y1 - y0; o.getContext("2d").drawImage(cv, x0, y0, o.width, o.height, 0, 0, o.width, o.height); return { img: o.toDataURL("image/png"), w: o.width, h: o.height };
  }

  /* ---------- Revue des prix indicatifs ---------- */
  window.prixIndicatif = b => !!b && b.origine === "marché" && !b.verifie;
  window.ligneIndicative = l => l.type === "mo" && l.source === "bibliotheque" && prixIndicatif(S.biblio.find(b => b.id === l.biblio_id));
  window.revueBandeau = function () { const n = S.biblio.filter(prixIndicatif).length; if (!n && !S.revue) return "";
    return `<div class="chips" style="margin-bottom:10px"><button class="chip ${S.revue ? "" : "on"}" data-a="pv-mode" data-v="">Toutes <b>${S.biblio.length}</b></button><button class="chip ${S.revue ? "on" : ""}" data-a="pv-mode" data-v="1">Prix indicatifs à valider <b>${n}</b></button></div>
      ${S.revue ? `<div class="banner w">Ces prix sont des estimations du marché, pas vos tarifs. Corrigez le prix si besoin puis touchez ✓. Un prix validé (ou utilisé dans un devis généré) devient le vôtre.</div>` : ""}`; };
  window.revueListe = function (q) {
    const items = S.biblio.filter(prixIndicatif).filter(b => !S.libCat || (b.metier || "Divers") === S.libCat).filter(b => !q || norm(b.metier + " " + b.designation).includes(q)).sort((a, b) => (a.metier || "").localeCompare(b.metier || "") || a.designation.localeCompare(b.designation));
    let g = null, html = "";
    for (const b of items) { if (b.metier !== g) { g = b.metier; const n = items.filter(x => x.metier === g).length; html += `<div class="lib-g" style="display:flex;justify-content:space-between;align-items:center">${esc(g || "Divers")}<button class="btn ghost sm" data-a="pv-all" data-m="${esc(g || "")}">Valider les ${n} tels quels</button></div>`; }
      html += `<div class="it pv"><div class="m"><div class="t" style="white-space:normal">${esc(b.designation)}</div><div class="s">par ${esc(b.unite)} · main-d'œuvre HT</div></div><input class="i" inputmode="decimal" data-pv="${b.id}" value="${esc(String(b.pu ?? "").replace(".", ","))}"><button class="btn sm" data-a="pv-ok" data-id="${b.id}">✓</button></div>`; }
    return html || `<div class="empty">Tous les prix sont validés.</div>`; };
  async function validerPrix(ids) { let n = 0;
    for (const id of ids) { const b = S.biblio.find(x => x.id === id); if (!b) continue; const inp = document.querySelector(`[data-pv="${id}"]`), v = inp ? num(inp.value) : b.pu; if (v === null) continue;
      Object.assign(b, { pu: v, verifie: true, updatedAt: Date.now() }); await put("biblio/" + id, b).catch(() => {}); n++; }
    render(); toast(n > 1 ? `${n} prix validés` : "Prix validé"); }

  /* ---------- Lecture d'un devis fournisseur (PDF) ---------- */
  const NUM = /(?<![\w.,])-?\d{1,3}(?:[  .]\d{3})*(?:,\d{1,4})?(?![\w%])|(?<![\w.,])-?\d+(?:[.,]\d{1,4})?(?![\w%])/g;
  const val = s => Number(String(s).replace(/[  ]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."));
  window.parseFournisseur = function (text) {
    const lignes = [], rejets = []; let ttc = null, totalDoc = null;
    const head = text.split("\n").find(l => /(?:p\.?\s?u\.?|prix)\s*(?:unit\w*)?\s*(?:€\s*)?(ht|ttc)/i.test(l)); if (head) ttc = /ttc/i.test(head.match(/(?:p\.?\s?u\.?|prix)\s*(?:unit\w*)?\s*(?:€\s*)?(ht|ttc)/i)[1]);
    for (let raw of text.split("\n")) {
      const l = raw.replace(/€|EUR\b/g, " ").replace(/\s+/g, " ").trim(); if (!l) continue;
      const mt = l.match(/^(?:montant\s+)?(?:total|net\s+[àa]\s+payer|sous[- ]total)\s*(ht|h\.t\.|ttc|t\.t\.c\.)?\b/i);
      if (mt) { const ns = l.match(NUM); if (ns) { const v = val(ns[ns.length - 1]); if (!totalDoc || /ttc|payer/i.test(l)) totalDoc = { label: l.replace(NUM, "").trim().slice(0, 30), v }; } continue; }
      if (/^(?:tva|remise|acompte|dont|base|taux|page|siret|iban|t[ée]l|date|client|devis|facture|r[ée]f[ée]rence\s*:)/i.test(l)) continue;
      const m = [...l.matchAll(NUM)].map(x => ({ v: val(x[0]), i: x.index, s: x[0] })).filter(x => isFinite(x.v));
      if (m.length < 2 || !/[a-zà-ÿ]{3}/i.test(l)) continue;
      let hit = null;       // quantité × prix unitaire = total (à 2 centimes ou 0,5 % près), en partant de la droite
      for (let c = m.length - 1; c >= 2 && !hit; c--) for (let b = c - 1; b >= 1 && !hit; b--) for (let a = b - 1; a >= 0 && !hit; a--) {
        const [x, y, z] = [m[a].v, m[b].v, m[c].v]; if (x <= 0 || y <= 0 || z <= 0) continue;
        if (Math.abs(x * y - z) <= Math.max(0.02, z * 0.005)) { const qa = Number.isInteger(x) || !Number.isInteger(y); hit = { q: qa ? x : y, pu: qa ? y : x, total: z, first: m[a].i }; } }
      if (!hit && m.length >= 2) { const z = m[m.length - 1].v, y = m[m.length - 2].v; if (y > 0 && Math.abs(y - z) < 0.005 && /[.,]\d{2}$/.test(m[m.length - 1].s)) hit = { q: 1, pu: z, total: z, first: m[m.length - 2].i }; }
      if (!hit) { if (/[.,]\d{2}\s*$/.test(l)) rejets.push(l.slice(0, 90)); continue; }
      let des = l.slice(0, hit.first).replace(/^\s*(?:\d{4,}|[A-Z]{1,4}[-\s]?\d{3,}[\w-]*)\s+/, "").replace(/[\s|;:·-]+$/, "").trim();
      const lead = [...des.matchAll(NUM)]; if (lead.length && /\d\s*$/.test(des)) des = des.replace(/\s+\d+(?:[.,]\d+)?\s*$/, "").trim();
      if (des.replace(/[^a-zà-ÿ]/gi, "").length < 3) { rejets.push(l.slice(0, 90)); continue; }
      const um = l.slice(hit.first).match(/(?<![\wà-ÿ])(m²|m2|ml|m3|m³|kg|l|litres?|sacs?|pots?|bo[iî]tes?|cartons?|paquets?|rouleaux?|pi[eè]ces?|u|unit[ée]s?)(?![\wà-ÿ])/i);
      lignes.push({ designation: des.charAt(0).toUpperCase() + des.slice(1), quantite: hit.q, pu: hit.pu, total: hit.total, unite: um ? um[1].toLowerCase().replace("m2", "m²").replace("m3", "m³").replace(/^unit.*|^pi[eè]ces?$/, "u") : "u" });
    }
    return { lignes, rejets, ttc, totalDoc, somme: r2(lignes.reduce((a, x) => a + x.total, 0)) };
  };
  let lecture = null;
  async function lirePJ(i) {
    const d = S.draft, p = d.pj[i]; if (!p) return;
    if (!/pdf/i.test(p.type)) return toast("Lecture automatique possible sur les PDF seulement : pour une photo, recopiez les prix.", 4200);
    const blob = await pjBlob(p); if (!blob) return toast("Fichier introuvable sur cet appareil.");
    let text = ""; try { text = await window.Importer.extractText(new File([blob], p.name || "devis.pdf", { type: "application/pdf" })); } catch (e) { console.error(e); }
    const r = parseFournisseur(text || "");
    if (!r.lignes.length) return toast(text.trim().length < 40 ? "Ce PDF est une image scannée : aucun texte à lire. Recopiez les prix." : "Aucune ligne « quantité × prix = total » trouvée dans ce PDF.", 4500);
    lecture = { r, nom: p.name || "devis fournisseur", ttc: r.ttc === true, sel: r.lignes.map(() => true) }; modalLecture();
  }
  function modalLecture() { const L = lecture, k = L.ttc ? 1 / 1.2 : 1, f = v => eur(r2(v * k));
    openModal(`<h2>Prix lus dans « ${esc(L.nom)} »</h2>
      <div class="hint">Rien n'est inventé : seules les lignes où quantité × prix = total ont été retenues. Vérifiez, décochez ce qui ne va pas.</div>
      <div class="chips" style="margin:10px 0"><button class="chip ${L.ttc ? "" : "on"}" data-a="lf-ttc" data-v="">Les prix du PDF sont HT</button><button class="chip ${L.ttc ? "on" : ""}" data-a="lf-ttc" data-v="1">Ils sont TTC (÷ 1,20)</button></div>
      <div class="list lf">${L.r.lignes.map((x, i) => `<label class="it"><input type="checkbox" data-lf="${i}" ${L.sel[i] ? "checked" : ""}><div class="m"><div class="t" style="white-space:normal">${esc(x.designation)}</div><div class="s">${String(x.quantite).replace(".", ",")} ${esc(x.unite)} × ${f(x.pu)} HT</div></div><div class="a">${f(x.total)}</div></label>`).join("")}</div>
      <div class="hint" style="margin-top:8px">Total des lignes lues : <b>${eur(L.r.somme)}</b>${L.r.totalDoc ? ` · ${esc(L.r.totalDoc.label || "Total du document")} : <b>${eur(L.r.totalDoc.v)}</b>` : ""}${L.r.rejets.length ? `<br>${L.r.rejets.length} ligne(s) non lue(s) : ${esc(L.r.rejets.slice(0, 3).join(" | "))}` : ""}</div>
      <div class="row" style="margin-top:12px"><button class="btn sec" data-a="close">Annuler</button><button class="btn" data-a="lf-ok">Ajouter aux fournitures</button></div>`); }
  function ajouterLecture() { const d = S.draft, L = lecture, k = L.ttc ? 1 / 1.2 : 1; let sec = d.sections.find(s => s.titre === "Fournitures"); if (!sec) { sec = { titre: "Fournitures", lignes: [] }; d.sections.push(sec); }
    let n = 0; L.r.lignes.forEach((x, i) => { if (!L.sel[i]) return; sec.lignes.push({ id: uid(), type: "fourniture", designation: x.designation, details: [`Prix du devis fournisseur « ${L.nom} »${L.ttc ? " (converti de TTC en HT)" : ""}`], quantite: x.quantite, unite: x.unite, pu: r2(x.pu * k), source: "fournisseur" }); n++; });
    lecture = null; closeModal(); render(); persistDraft(); toast(`${n} fourniture(s) ajoutée(s) depuis le devis fournisseur`); }

  /* ---------- Sauvegarde automatique (hebdomadaire) ---------- */
  const snapshot = () => JSON.stringify({ version: 1, auto: true, date: new Date().toISOString(), cfg: S.cfg, devis: S.devis, biblio: S.biblio, clients: S.clients, appris: S.appris });
  const dossier = () => `${S.uid}/_sauvegardes`;
  window.autoBackup = async function (force) {
    const st = lsGet("gph_autobackup", {}); if (!force && st.date && Date.now() - new Date(st.date).getTime() < 7 * 864e5) return null;
    if (!S.devis.length && !S.clients.length) return null;
    const data = snapshot(), nom = todayISO() + ".json"; let lieu = "appareil";
    if (S.sb && S.uid && navigator.onLine) { try { const { error } = await S.sb.storage.from("annexes").upload(`${dossier()}/${nom}`, new Blob([data], { type: "application/json" }), { contentType: "application/json", upsert: true });
        if (!error) { lieu = "en ligne"; const { data: ls } = await S.sb.storage.from("annexes").list(dossier(), { limit: 100, sortBy: { column: "name", order: "desc" } }); const vieux = (ls || []).filter(f => /\.json$/.test(f.name)).slice(8).map(f => `${dossier()}/${f.name}`); if (vieux.length) await S.sb.storage.from("annexes").remove(vieux); } } catch (e) { console.error(e); } }
    if (lieu === "appareil") { try { localStorage.setItem("gph_autobackup_data", data); } catch (e) { lieu = "échec"; } }
    lsSet("gph_autobackup", { date: new Date().toISOString(), lieu, devis: S.devis.length, clients: S.clients.length }); return lieu;
  };
  window.backupCard = function () { const st = lsGet("gph_autobackup", {});
    return `<div class="card"><h2>Sauvegardes automatiques</h2><div class="hint">Une copie complète (devis, clients, prestations, réglages) est faite chaque semaine à l'ouverture de l'application. Les 8 dernières sont gardées.</div>
      <div class="kv" style="margin:10px 0"><b>Dernière sauvegarde :</b> ${st.date ? `${new Date(st.date).toLocaleDateString("fr-FR")} · ${st.lieu === "en ligne" ? "en ligne (Supabase)" : st.lieu === "appareil" ? "sur cet appareil seulement" : "échec"} · ${st.devis ?? 0} devis` : "aucune pour l'instant"}</div>
      <div id="bk-list"></div><div class="row"><button class="btn sec" data-a="bk-now">Sauvegarder maintenant</button><button class="btn ghost" data-a="bk-list">Voir les sauvegardes</button></div></div>`; };
  async function listerSauvegardes() { const box = document.getElementById("bk-list"); if (!box) return; let items = [];
    if (S.sb && S.uid && navigator.onLine) { try { const { data } = await S.sb.storage.from("annexes").list(dossier(), { limit: 100, sortBy: { column: "name", order: "desc" } }); items = (data || []).filter(f => /\.json$/.test(f.name)).map(f => ({ nom: f.name, lieu: "ligne" })); } catch (e) {} }
    if (localStorage.getItem("gph_autobackup_data")) items.push({ nom: "copie sur cet appareil", lieu: "local" });
    box.innerHTML = items.length ? `<div class="list" style="margin-bottom:10px">${items.map(x => `<div class="it"><div class="m"><div class="t">${esc(x.nom.replace(".json", ""))}</div></div><button class="btn ghost sm" data-a="bk-dl" data-n="${esc(x.nom)}" data-l="${x.lieu}">Télécharger</button><button class="btn sec sm" data-a="bk-restore" data-n="${esc(x.nom)}" data-l="${x.lieu}">Restaurer</button></div>`).join("")}</div>` : `<div class="hint" style="margin-bottom:10px">Aucune sauvegarde trouvée.</div>`; }
  async function lireSauvegarde(nom, lieu) { if (lieu === "local") return localStorage.getItem("gph_autobackup_data"); const { data, error } = await S.sb.storage.from("annexes").download(`${dossier()}/${nom}`); if (error || !data) return null; return await data.text(); }

  (function attente() { if (typeof S !== "undefined" && S.ready) autoBackup().catch(() => {}); else setTimeout(attente, 4000); })();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && typeof S !== "undefined" && S.ready) autoBackup().catch(() => {}); });

  /* ---------- Actions ---------- */
  window.extrasAction = async function (a, el) {
    const d = S.draft;
    switch (a) {
      case "sel-on": S.sel = new Set(); render(); return true;
      case "sel-off": S.sel = null; render(); return true;
      case "sel-t": S.sel.has(el.dataset.id) ? S.sel.delete(el.dataset.id) : S.sel.add(el.dataset.id); render(); return true;
      case "sel-all": { const v = S.selVisible || [], tous = v.length && v.every(id => S.sel.has(id)); for (const id of v) tous ? S.sel.delete(id) : S.sel.add(id); render(); return true; }
      case "sel-etat": { const L = selList(), nf = L.filter(d => d.statut === "finalise").length;
        openModal(`<h2>Changer le statut de ${nf} devis</h2>${L.length - nf ? `<div class="hint">${L.length - nf} brouillon(s) sélectionné(s) : ils n'ont pas de statut et ne seront pas modifiés.</div>` : ""}<div class="hint" style="margin:6px 0 10px">La date du jour est enregistrée pour ce statut.</div><div class="etats">${ETATS.map(x => `<button class="btn sec sm" data-a="sel-etat-ok" data-e="${x[0]}" ${nf ? "" : "disabled"}>${x[1]}</button>`).join("")}</div><button class="btn ghost block" data-a="close" style="margin-top:12px">Annuler</button>`); return true; }
      case "sel-etat-ok": await selEtat(el.dataset.e); return true;
      case "sel-del": { const L = selList(), nf = L.filter(d => d.statut === "finalise").length;
        openModal(`<h2>Supprimer ${L.length} devis ?</h2><div class="banner w">${nf ? `<b>${nf} devis généré${nf > 1 ? "s" : ""}</b> (numéroté${nf > 1 ? "s" : ""})${L.length - nf ? ` et ${L.length - nf} brouillon${L.length - nf > 1 ? "s" : ""}` : ""}` : `${L.length} brouillon${L.length > 1 ? "s" : ""}`} : ${esc(L.slice(0, 6).map(d => d.numero || d.client?.nom || "brouillon").join(", "))}${L.length > 6 ? "…" : ""}.<br>La suppression est définitive sur tous vos appareils. Une sauvegarde automatique récente permet de les retrouver (Réglages).</div><div class="row" style="margin-top:12px"><button class="btn sec" data-a="close">Annuler</button><button class="btn danger" data-a="sel-del-ok">Supprimer définitivement</button></div>`); return true; }
      case "sel-del-ok": await selSuppr(); return true;
      case "sel-csv": selCSV(); return true;
      case "avenant": if (d) { await persistDraft(true); creerAvenant(d); } return true;
      case "sign": if (d) ouvrirSignature(d); return true;
      case "sign-clear": if (pad) { pad.cx.clearRect(0, 0, pad.cv.width, pad.cv.height); pad.vide = true; pad.cv.parentNode.classList.remove("on"); } return true;
      case "sign-ok": { if (!pad || pad.vide) { toast("La signature est vide."); return true; } const s = rogner(pad.cv); if (!s) { toast("La signature est vide."); return true; }
        d.signature = { img: s.img, w: s.w, h: s.h, date: todayISO(), nom: (document.getElementById("sg-nom").value || "").trim() };
        if (["attente", "envoye", "refuse"].includes(etatOf(d))) setEtat(d, "accepte");
        pad = null; closeModal(); await persistDraft(true); render(); toast("Devis signé : statut « Accepté »"); return true; }
      case "sign-del": if (d && confirm("Retirer la signature du client ?")) { delete d.signature; await persistDraft(true); render(); } return true;
      case "pv-mode": S.revue = !!el.dataset.v; render(); return true;
      case "lib-ori": S.libOri = el.dataset.v; S.revue = false; render(); return true;
      case "pv-ok": await validerPrix([el.dataset.id]); return true;
      case "pv-all": await validerPrix(S.biblio.filter(b => prixIndicatif(b) && (b.metier || "") === el.dataset.m).map(b => b.id)); return true;
      case "pj-read": await lirePJ(Number(el.dataset.i)); return true;
      case "lf-ttc": if (lecture) { lecture.ttc = !!el.dataset.v; modalLecture(); } return true;
      case "lf-ok": if (lecture) ajouterLecture(); return true;
      case "bk-now": { const l = await autoBackup(true); render(); toast(l === "en ligne" ? "Sauvegarde enregistrée en ligne" : l === "appareil" ? "Sauvegarde gardée sur cet appareil" : "Rien à sauvegarder"); return true; }
      case "bk-list": await listerSauvegardes(); return true;
      case "bk-dl": { const t = await lireSauvegarde(el.dataset.n, el.dataset.l); if (!t) { toast("Sauvegarde illisible"); return true; } downloadBlob(new Blob([t], { type: "application/json" }), "sauvegarde-gallois-ph-" + el.dataset.n.replace(/[^\w.-]+/g, "_").replace(/\.json$/, "") + ".json"); return true; }
      case "bk-restore": { if (!confirm("Restaurer cette sauvegarde ? Les devis, clients et prestations qu'elle contient remplaceront les versions actuelles.")) return true; const t = await lireSauvegarde(el.dataset.n, el.dataset.l); if (!t) { toast("Sauvegarde illisible"); return true; } await importJSON(new File([t], "sauvegarde.json", { type: "application/json" }), "restore"); return true; }
    }
    return false;
  };
  document.addEventListener("input", e => { const el = e.target, d = S.draft;
    if (el.dataset && el.dataset.l === "remise" && d) setTimeout(() => { const l = d.sections[Number(el.dataset.si)].lignes[Number(el.dataset.li)]; l.remise = num(el.value); if (l.remise === null) delete l.remise; const c = el.closest(".line"), t = c && c.querySelector(".tot"); if (t) t.textContent = eur(lineTotal(l)); majTotaux(); persistDraft(); }, 0);
    if (el.dataset && el.dataset.rem === "val" && d) { d.remise = Object.assign({ type: "pct" }, d.remise, { val: el.value.trim() === "" ? "" : num(el.value) }); if (d.remise.val === "" || d.remise.val === null) delete d.remise; majTotaux(); persistDraft(); } });
  document.addEventListener("change", e => { const el = e.target, d = S.draft; if (!el.dataset) return;
    if (el.dataset.rem === "type" && d) { d.remise = Object.assign({ val: "" }, d.remise, { type: el.value }); majTotaux(); persistDraft(); }
    if (el.dataset.etd && d) { const k = etatOf(d); if (k && el.value) { d.etatDates = Object.assign({}, d.etatDates, { [k]: el.value }); if (k === "envoye") d.dateEnvoi = el.value; persistDraft(true); } }
    if (el.dataset.lib === "cat") { S.libCat = el.value; render(); }
    if (el.dataset.lf !== undefined && lecture) lecture.sel[Number(el.dataset.lf)] = el.checked; });
})();
