/* Tableau de bord — calculé uniquement à partir des devis enregistrés (aucune donnée inventée). */
(function () {
  "use strict";
  const SIGNES = ["accepte", "acompte1", "en_cours", "acompte2", "fini", "paye"], ACTIFS = ["accepte", "acompte1", "en_cours", "acompte2"];
  const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const k0 = n => Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g, " ");
  const court = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " M€" : n >= 1e4 ? Math.round(n / 1e3) + " k€" : n >= 1e3 ? (n / 1e3).toFixed(1).replace(".", ",") + " k€" : Math.round(n) + " €";
  const T = d => d.totaux && isFinite(d.totaux.ttc) ? d.totaux : totaux(d);
  const jours = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  const fd = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "";
  function encaisse(d) { const e = etatOf(d), t = T(d); return e === "paye" ? t.ttc : e === "acompte2" || e === "fini" ? r2(t.a1 + t.a2) : e === "acompte1" || e === "en_cours" ? t.a1 : 0; }
  function aReclamer(d) { const e = etatOf(d), t = T(d); return e === "accepte" ? ["Acompte à la commande", t.a1] : e === "en_cours" ? ["Acompte en cours de chantier", t.a2] : e === "fini" ? ["Solde", t.solde] : null; }

  function stats() {
    const today = todayISO(), per = S.dashPer || "ex", ex = exerciceKey(today);
    const lim = per === "12" ? new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10) : null;
    const inPer = d => per === "tout" ? true : per === "ex" ? (d.exercice || exerciceKey(d.date || today)) === ex : (d.date || today) >= lim;
    const fin = S.devis.filter(estEmis), F = fin.filter(inPer), classes = F.filter(d => !aClasser(d)), nonClasses = fin.filter(aClasser);
    const signes = F.filter(d => SIGNES.includes(etatOf(d))), envoyes = classes.filter(d => etatOf(d) !== "attente");
    const sum = (a, f) => a.reduce((x, d) => x + (f(d) || 0), 0);
    const caHT = sum(signes, d => T(d).ht), caTTC = sum(signes, d => T(d).ttc), enc = sum(signes, encaisse);
    const attente = classes.filter(d => ["attente", "envoye"].includes(etatOf(d)));
    // 12 derniers mois
    const mois = []; const now = new Date(today);
    for (let i = 11; i >= 0; i--) { const x = new Date(now.getFullYear(), now.getMonth() - i, 1); mois.push({ k: x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"), l: MOIS[x.getMonth()], dev: 0, sig: 0, n: 0 }); }
    for (const d of fin) { const m = mois.find(x => x.k === (d.date || "").slice(0, 7)); if (!m) continue; const h = T(d).ht || 0; m.dev += h; m.n++; if (SIGNES.includes(etatOf(d))) m.sig += h; }
    // corps d'état (lignes des devis signés)
    const metiers = {}; const bib = new Map(S.biblio.map(b => [b.id, b.metier || "Divers"]));
    for (const d of signes) for (const s of d.sections || []) for (const l of s.lignes || []) { const t = lineTotal(l); if (!t) continue; const m = l.type === "fourniture" ? "Fournitures" : (bib.get(l.biblio_id) || "Divers"); metiers[m] = (metiers[m] || 0) + t; }
    const clients = {}; for (const d of signes) { const n = d.client?.nom || "?"; clients[n] = (clients[n] || 0) + (T(d).ht || 0); }
    const reclam = fin.map(d => ({ d, r: aReclamer(d) })).filter(x => x.r && x.r[1] > 0).sort((a, b) => b.r[1] - a.r[1]);
    const relance = fin.filter(d => etatOf(d) === "envoye" && jours((d.etatDates && d.etatDates.envoye) || d.dateEnvoi || d.date || today, today) >= 10).sort((a, b) => ((a.etatDates && a.etatDates.envoye) || a.date || "").localeCompare((b.etatDates && b.etatDates.envoye) || b.date || ""));
    const chantiers = fin.filter(d => ACTIFS.includes(etatOf(d)) && d.debut && d.finPrevue).sort((a, b) => a.debut.localeCompare(b.debut));
    return { today, per, F, fin, signes, envoyes, caHT, caTTC, enc, reste: r2(caTTC - enc), attente, attenteHT: sum(attente, d => T(d).ht), taux: envoyes.length ? signes.length / envoyes.length : null,
      panier: signes.length ? caHT / signes.length : 0, mois, metiers: Object.entries(metiers).sort((a, b) => b[1] - a[1]), clients: Object.entries(clients).sort((a, b) => b[1] - a[1]).slice(0, 5),
      reclam, reclamTotal: sum(reclam, x => x.r[1]), relance, chantiers, retards: fin.filter(isLate), brouillons: S.devis.filter(d => !estEmis(d)).length, nonClasses, nonClassesHT: sum(nonClasses, d => T(d).ht),
      parEtat: ETATS.map(e => ({ e, n: classes.filter(d => etatOf(d) === e[0]).length, ht: sum(classes.filter(d => etatOf(d) === e[0]), d => T(d).ht) })) };
  }

  const COL = ["#4F7BFF", "#22C3A6", "#FFB020", "#FF6B8A", "#9B7BFF", "#3ED0F5", "#FF8A4C", "#7CD957", "#C9D2F2"];
  function ring(p, label) {       // jauge circulaire animée
    const R = 52, C = 2 * Math.PI * R, v = p === null ? 0 : Math.max(0, Math.min(1, p));
    return `<svg viewBox="0 0 130 130" class="d-ring"><defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7FE3FF"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient></defs>
      <circle cx="65" cy="65" r="${R}" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="11"/>
      <circle cx="65" cy="65" r="${R}" fill="none" stroke="url(#dg)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-ring="${C * (1 - v)}" transform="rotate(-90 65 65)"/>
      <text x="65" y="62" text-anchor="middle" class="d-ring-n">${p === null ? "—" : `<tspan data-count="${Math.round(v * 100)}">0</tspan><tspan dx="2" font-size="15">%</tspan>`}</text><text x="65" y="82" text-anchor="middle" class="d-ring-l">${label}</text></svg>`;
  }
  function bars(mois) {
    const W = 720, H = 230, pad = 46, bw = (W - pad) / 12, brut = Math.max(1, ...mois.map(m => Math.max(m.dev, m.sig)));
    const pas = (() => { const p = Math.pow(10, Math.floor(Math.log10(brut / 4))); return [1, 2, 2.5, 5, 10].map(k => k * p).find(v => v * 4 >= brut); })(), max = pas * 4;
    const y = v => 190 - v / max * 160; let g = "";
    for (let i = 0; i <= 4; i++) { const v = max * i / 4, yy = y(v); g += `<line x1="${pad}" x2="${W}" y1="${yy}" y2="${yy}" stroke="#E6EAF7" stroke-dasharray="${i ? "3 5" : ""}"/><text x="${pad - 6}" y="${yy + 4}" text-anchor="end" class="d-ax">${i ? court(v).replace(" €", "") : "0"}</text>`; }
    mois.forEach((m, i) => { const x = pad + i * bw, w = bw * .34, cur = i === 11;
      g += `<g class="d-bar" data-tip="${m.l} · devisé ${k0(m.dev)} € · signé ${k0(m.sig)} € · ${m.n} devis">
        <rect x="${x + 2}" y="20" width="${bw - 4}" height="178" rx="8" class="d-hit"/>
        <rect x="${x + bw / 2 - w - 1.5}" width="${w}" rx="5" fill="#C9D5FA" y="190" height="0" data-h="${190 - y(m.dev)}" data-y="${y(m.dev)}"/>
        <rect x="${x + bw / 2 + 1.5}" width="${w}" rx="5" fill="url(#bg1)" y="190" height="0" data-h="${190 - y(m.sig)}" data-y="${y(m.sig)}"/>
        <text x="${x + bw / 2}" y="212" text-anchor="middle" class="d-ax ${cur ? "cur" : ""}">${m.l}</text></g>`; });
    return `<svg viewBox="0 0 ${W} ${H}" class="d-chart"><defs><linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4F7BFF"/><stop offset="1" stop-color="#1F3FB5"/></linearGradient></defs>${g}</svg>`;
  }
  function donut(items) {
    const tot = items.reduce((a, x) => a + x[1], 0) || 1, R = 54, C = 2 * Math.PI * R; let off = 0, arcs = "";
    const top = items.slice(0, 7); if (items.length > 7) top.push(["Autres", items.slice(7).reduce((a, x) => a + x[1], 0)]);
    top.forEach((x, i) => { const len = x[1] / tot * C; arcs += `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${COL[i % COL.length]}" stroke-width="20" stroke-dasharray="${Math.max(len - 2, 0)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)" class="d-arc" style="animation-delay:${i * 70}ms"/>`; off += len; });
    return `<div class="d-donut"><svg viewBox="0 0 140 140">${arcs}<text x="70" y="66" text-anchor="middle" class="d-dn">${court(tot)}</text><text x="70" y="84" text-anchor="middle" class="d-dl">HT signé</text></svg>
      <div class="d-leg">${top.map((x, i) => `<div><i style="background:${COL[i % COL.length]}"></i><span>${esc(x[0])}</span><b>${Math.round(x[1] / tot * 100)} %</b></div>`).join("")}</div></div>`;
  }
  function gantt(ch, today) {
    if (!ch.length) return `<div class="d-empty">Aucun chantier daté. Renseignez « début » et « durée » dans le suivi d'un devis accepté (ou dictez « début du chantier le… »).</div>`;
    const t0 = new Date(today); t0.setDate(t0.getDate() - 7); const span = 56, pos = iso => Math.max(0, Math.min(100, jours(t0.toISOString().slice(0, 10), iso) / span * 100));
    let ticks = ""; for (let i = 0; i <= span; i += 7) { const x = new Date(t0); x.setDate(x.getDate() + i); ticks += `<span style="left:${i / span * 100}%">${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}</span>`; }
    return `<div class="d-gantt"><div class="d-gt">${ticks}</div><div class="d-ov"><div class="d-now" style="left:${pos(today)}%"><b>Aujourd'hui</b></div></div>
      ${ch.slice(0, 8).map((d, i) => { const a = pos(d.debut), b = pos(d.finPrevue), late = isLate(d);
        return `<div class="d-gr" data-a="open" data-id="${d.id}"><div class="d-gl">${esc(d.client?.nom || "?")}<small>${fd(d.debut)} → ${fd(d.finPrevue)}</small></div><div class="d-gb"><i class="${late ? "late" : ""}" style="left:${a}%;width:${Math.max(b - a, 2.5)}%;animation-delay:${i * 80}ms"></i></div></div>`; }).join("")}</div>`;
  }

  window.viewDash = function () {
    const s = stats(), h = new Date().getHours(), per = s.per;
    const nom = (S.cfg.gerant || S.cfg.nom || "").split(" ")[0] || "";
    if (!s.fin.length) return (typeof statusBanner === "function" ? statusBanner() : "") + `<div class="d-hero"><div class="d-glow"></div><div class="d-hi">${h < 18 ? "Bonjour" : "Bonsoir"}${nom ? " " + esc(nom) : ""}</div><div class="d-big" style="font-size:26px;margin-top:10px">Votre tableau de bord se remplira tout seul</div><div class="d-sub">Dès le premier devis finalisé : chiffre d'affaires signé, acomptes à encaisser, planning des chantiers, relances.</div><button class="btn d-cta" data-a="new">＋ Créer le premier devis</button></div>`;
    const seg = [["ex", "Exercice en cours"], ["12", "12 mois"], ["tout", "Tout"]].map(x => `<button class="${per === x[0] ? "on" : ""}" data-a="dash-per" data-p="${x[0]}">${x[1]}</button>`).join("");
    const alertes = [];
    if (s.nonClasses.length) alertes.push(["o", "⇩", `${s.nonClasses.length} devis importé${s.nonClasses.length > 1 ? "s" : ""} à classer · ${k0(s.nonClassesHT)} € HT`, "Signés, payés, refusés ? Donnez-leur un statut pour qu'ils comptent en « signé » et « encaissé »", `data-a="dash-fe" data-e="importe"`]);
    if (s.retards.length) alertes.push(["r", "⚠", `${s.retards.length} chantier${s.retards.length > 1 ? "s" : ""} en retard`, s.retards.map(d => d.client?.nom).slice(0, 3).join(", "), `data-a="dash-fe" data-e="retard"`]);
    if (s.reclam.length) alertes.push(["g", "€", `${k0(s.reclamTotal)} € à réclamer maintenant`, `${s.reclam.length} échéance${s.reclam.length > 1 ? "s" : ""} arrivée${s.reclam.length > 1 ? "s" : ""} (acompte ou solde)`, `data-a="dash-scroll" data-t="d-cash"`]);
    if (s.relance.length) alertes.push(["b", "↻", `${s.relance.length} devis à relancer`, "Envoyés depuis plus de 10 jours, sans réponse", `data-a="dash-fe" data-e="envoye"`]);
    if (s.brouillons) alertes.push(["n", "✎", `${s.brouillons} brouillon${s.brouillons > 1 ? "s" : ""} à terminer`, "Devis commencés, pas encore finalisés", `data-a="dash-fe" data-e="brouillon"`]);
    const maxE = Math.max(1, ...s.parEtat.map(x => x.n));
    return (typeof statusBanner === "function" ? statusBanner() : "") + `<div class="dash">
    <div class="d-hero"><div class="d-glow"></div><div class="d-glow b"></div>
      <div class="d-top"><div><div class="d-hi">${h < 18 ? "Bonjour" : "Bonsoir"}${nom ? " " + esc(nom) : ""} 👋</div><div class="d-date">${(x => x.charAt(0).toUpperCase() + x.slice(1))(new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }))}</div></div><div class="d-seg">${seg}</div></div>
      <div class="d-main"><div><div class="d-lab">Chiffre d'affaires signé (HT)</div><div class="d-big"><span data-count="${Math.round(s.caHT)}">0</span><small> €</small></div>
        <div class="d-sub">${s.signes.length} devis signé${s.signes.length > 1 ? "s" : ""} · panier moyen ${k0(s.panier)} € · ${k0(s.caTTC)} € TTC</div>
        <div class="d-prog"><i data-w="${s.caTTC ? Math.round(s.enc / s.caTTC * 100) : 0}"></i></div><div class="d-pl"><span>Encaissé <b>${k0(s.enc)} €</b></span><span>Reste à encaisser <b>${k0(s.reste)} €</b></span></div></div>
        ${ring(s.taux, "de signature")}</div>
    </div>
    <div class="d-kpis">
      <div class="d-kpi" data-a="dash-fe" data-e="envoye"><span class="ic b">◷</span><div class="l">En attente de réponse</div><div class="v"><span data-count="${Math.round(s.attenteHT)}">0</span> €</div><div class="s">${s.attente.length} devis HT</div></div>
      <div class="d-kpi" data-a="dash-scroll" data-t="d-cash"><span class="ic g">€</span><div class="l">À réclamer maintenant</div><div class="v"><span data-count="${Math.round(s.reclamTotal)}">0</span> €</div><div class="s">${s.reclam.length} échéance${s.reclam.length > 1 ? "s" : ""} TTC</div></div>
      <div class="d-kpi" data-a="dash-scroll" data-t="d-plan"><span class="ic o">▦</span><div class="l">Chantiers en cours</div><div class="v"><span data-count="${s.fin.filter(d => ACTIFS.includes(etatOf(d))).length}">0</span></div><div class="s">${s.retards.length ? `<b style="color:#E5484D">${s.retards.length} en retard</b>` : "aucun retard"}</div></div>
      <div class="d-kpi" data-a="tab" data-v="list"><span class="ic v">▤</span><div class="l">Devis émis</div><div class="v"><span data-count="${s.F.length}">0</span></div><div class="s">sur la période</div></div>
    </div>
    ${alertes.length ? `<div class="d-card"><h3>À faire</h3><div class="d-al">${alertes.map(a => `<div class="a ${a[0]}" ${a[4]}><i>${a[1]}</i><div><b>${a[2]}</b><small>${esc(a[3] || "")}</small></div><em>›</em></div>`).join("")}</div></div>` : ""}
    <div class="d-grid">
      <div class="d-card wide"><h3>Activité des 12 derniers mois <span class="d-key"><i style="background:#C9D5FA"></i>Devisé <i style="background:#2B50D0"></i>Signé</span></h3><div class="d-tip" id="d-tip">Touchez un mois pour le détail</div>${bars(s.mois)}</div>
      <div class="d-card"><h3>Suivi des devis</h3><div class="d-pipe">${s.parEtat.map((x, i) => `<div class="r" data-a="dash-fe" data-e="${x.e[0]}"><span>${x.e[1]}</span><div class="t"><i class="c${i}" data-w="${Math.round(x.n / maxE * 100)}"></i></div><b>${x.n}</b><em>${x.ht ? court(x.ht) : ""}</em></div>`).join("")}</div></div>
      <div class="d-card" id="d-cash"><h3>Argent à réclamer <span class="d-tot">${k0(s.reclamTotal)} € TTC</span></h3>${s.reclam.length ? `<div class="d-list">${s.reclam.slice(0, 6).map(x => `<div class="it" data-a="open" data-id="${x.d.id}"><div><b>${esc(x.d.client?.nom || "?")}</b><small>${x.r[0]} · ${esc(x.d.numero || "")}</small></div><strong>${k0(x.r[1])} €</strong></div>`).join("")}</div>` : `<div class="d-empty">Rien à réclamer pour le moment.</div>`}</div>
      <div class="d-card wide" id="d-plan"><h3>Planning des chantiers <span class="d-key">8 semaines</span></h3>${gantt(s.chantiers, s.today)}</div>
      <div class="d-card"><h3>Répartition par corps d'état</h3>${s.metiers.length ? donut(s.metiers) : `<div class="d-empty">Disponible dès qu'un devis est signé.</div>`}</div>
      <div class="d-card"><h3>Meilleurs clients</h3>${s.clients.length ? `<div class="d-top5">${s.clients.map((c, i) => `<div><span class="rk">${i + 1}</span><div class="n">${esc(c[0])}<div class="t"><i data-w="${Math.round(c[1] / s.clients[0][1] * 100)}"></i></div></div><b>${k0(c[1])} €</b></div>`).join("")}</div>` : `<div class="d-empty">Disponible dès qu'un devis est signé.</div>`}</div>
    </div>
    <div class="d-foot">Chiffres calculés à partir de vos devis (créés ici ou importés) et de leur statut. Un devis importé sans statut compte en « devisé » seulement. « Signé » = accepté et au-delà. « Encaissé » suit les statuts acompte 1, acompte 2 et payé.</div></div>`;
  };

  window.dashAfter = function () {       // animations : compteurs, barres, jauges
    const root = document.querySelector(".dash, .d-hero"); if (!root) return;
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches, dur = reduce ? 1 : 900, t0 = performance.now();
    const cs = [...document.querySelectorAll("[data-count]")].map(el => [el, +el.dataset.count]);
    const ease = x => 1 - Math.pow(1 - x, 4);
    (function tick(now) { const p = Math.min(1, (now - t0) / dur), e = ease(p); for (const [el, v] of cs) el.textContent = k0(v * e); if (p < 1) requestAnimationFrame(tick); })(t0);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll("[data-w]").forEach(el => el.style.width = el.dataset.w + "%");
      document.querySelectorAll("[data-ring]").forEach(el => el.style.strokeDashoffset = el.dataset.ring);
      document.querySelectorAll(".d-bar rect[data-h]").forEach((el, i) => { el.style.transitionDelay = (i * 18) + "ms"; el.setAttribute("y", el.dataset.y); el.setAttribute("height", el.dataset.h); });
    }));
    const tip = document.getElementById("d-tip");
    document.querySelectorAll(".d-bar").forEach(g => { const f = () => { document.querySelectorAll(".d-bar.on").forEach(x => x.classList.remove("on")); g.classList.add("on"); if (tip) tip.textContent = g.dataset.tip; }; g.addEventListener("click", f); g.addEventListener("mouseenter", f); });
  };
  window.dashAction = function (a, el) {
    if (a === "dash-per") { S.dashPer = el.dataset.p; render(); return true; }
    if (a === "dash-fe") { S.fe = el.dataset.e; S.sel = el.dataset.e === "importe" ? new Set() : null; setView("list"); return true; }
    if (a === "dash-scroll") { const t = document.getElementById(el.dataset.t); if (t) t.scrollIntoView({ behavior: "smooth", block: "center" }); return true; }
    return false;
  };
})();
