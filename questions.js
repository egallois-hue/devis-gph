/* Questions de précision après la mise en forme (facultatives, 3 au maximum par série).
   On répond en écrivant ou avec le micro du clavier ; les réponses complètent le devis. */
"use strict";
const Q_MAX = 3, Q_ROUNDS = 2;

function qLineList(d) { const out = []; d.sections.forEach((s, si) => s.lignes.forEach((l, li) => out.push({ s, si, l, li }))); return out; }
function buildQuestions(d, res) {
  const qs = [], asked = new Set(d.qAsked || []);
  const add = q => { if (!asked.has(q.key) && qs.length < Q_MAX && !qs.some(x => x.key === q.key)) qs.push(q); };
  if (!d.client.nom?.trim() || !d.client.adresse?.trim())
    add({ key: "client", kind: "client", text: !d.client.nom?.trim() ? "Pour quel client est ce devis ? (nom et adresse)" : `Quelle est l'adresse de ${d.client.nom} ?`, ph: "Ex. : Monsieur et Madame Martin, 3 rue des Lilas à Dourdan" });
  for (const { l, li, si } of qLineList(d)) {
    if (l.type === "fourniture") continue;
    const id = l.id;
    if (l.estime && l.estimeInfo) add({ key: "est:" + id, kind: "qte", id, text: `Murs : j'ai estimé ${String(l.quantite).replace(".", ",")} m² (pièce carrée de ${String(l.estimeInfo.sol).replace(".", ",")} m², ${String(l.estimeInfo.hauteur).replace(".", ",")} m de haut). Quelle est la vraie surface ?`, ph: "Ex. : 42 m² (laisser vide si l'estimation convient)" });
    else if (num(l.quantite) === null) add({ key: "q:" + id, kind: "qte", id, text: `Quelle quantité pour « ${l.designation.slice(0, 70)} » ?`, ph: "Ex. : 25 m², 12 ml, 3 unités, 1 forfait" });
    if (/carrel|fa(?:i|ï)ence/i.test(l.designation) && /^pose/i.test(l.designation) && !/format|mosa(?:i|ï)que/i.test(l.designation))
      add({ key: "fmt:" + id, kind: "refine", id, text: "Quel format de carrelage, et quels joints ou type de pose ?", ph: "Ex. : 60x60 joint fin, pose décalée" });
    if (num(l.pu) === null && num(l.quantite) !== null) add({ key: "pu:" + id, kind: "pu", id, text: `Quel prix HT pour « ${l.designation.slice(0, 70)} » (par ${l.unite || "unité"}) ?`, ph: "Ex. : 120" });
  }
  for (const [i, raw] of (res?.ignored || []).entries())
    add({ key: "ign:" + norm(raw).slice(0, 40), kind: "ligne", text: `Je n'ai pas compris : « ${raw.slice(0, 90)}${raw.length > 90 ? "…" : ""} ». Que faut-il ajouter au devis ?`, ph: "Ex. : remplacement d'une prise, 1 forfait 60 euros (vide = rien)" });
  return qs;
}
function askQuestions(res) {
  const d = S.draft; d.qRound = (d.qRound || 0) + 1;
  if (d.qRound > Q_ROUNDS) { d.questions = []; return; }
  d.questions = buildQuestions(d, res);
}
function questionsCard() {
  const d = S.draft; if (!d?.questions?.length || d.statut === "finalise") return "";
  return `<div class="card qcard"><h2>Pour affiner le devis</h2>
    <div class="hint" style="margin-bottom:8px">Facultatif. Répondez en écrivant ou avec le micro 🎤 du clavier, puis « Appliquer ». Laissez vide ce qui ne sert pas.</div>
    ${d.questions.map((q, i) => `<label class="f" style="font-size:14px;color:var(--ink);font-weight:600">${i + 1}. ${esc(q.text)}</label>
      <textarea class="i" data-qa="${i}" style="min-height:44px" placeholder="${esc(q.ph || "")}">${esc(q.answer || "")}</textarea>`).join("")}
    <div class="row" style="margin-top:10px"><button class="btn sec" data-a="q-skip">Ignorer</button><button class="btn" data-a="q-apply">Appliquer</button></div></div>`;
}
function findLine(d, id) { for (const s of d.sections) { const i = s.lignes.findIndex(l => l.id === id); if (i >= 0) return { s, l: s.lignes[i], i }; } return null; }
function applyAnswers() {
  const d = S.draft, M = window.Moteur; let done = 0;
  for (const q of d.questions || []) {
    d.qAsked = [...new Set([...(d.qAsked || []), q.key])];
    const a = (q.answer || "").trim(); if (!a) continue;
    const t = M.convertNumbers(a);
    if (q.kind === "client") {
      const r = M.extractClient("Devis pour " + t.replace(/^(?:c'est |pour |chez )/i, ""));
      for (const k of ["nom", "adresse", "cpVille", "email", "tel"]) if (r.client[k] && !d.client[k]?.trim()) d.client[k] = r.client[k];
      if (!r.client.nom && !d.client.nom) d.client.nom = a; done++; continue;
    }
    const f = q.id && findLine(d, q.id); if (q.id && !f) continue;
    if (q.kind === "qte") { const p = M.parseAmounts(t); const n = p.quantite ?? num(t.match(/\d+(?:[.,]\d+)?/)?.[0]); if (n !== null && n !== undefined) { f.l.quantite = n; if (p.unite && p.unite !== "forfait") f.l.unite = p.unite; f.l.estime = false; done++; } }
    else if (q.kind === "pu") { const n = num(t.match(/\d+(?:[.,]\d+)?/)?.[0]); if (n !== null) { f.l.pu = n; f.l.source = "saisi"; done++; } }
    else if (q.kind === "refine") {
      const r = M.analyse(`pose de carrelage ${t} ${num(f.l.quantite) ?? 1} m2`, S.biblio, { carrelage: carrelageCfg() });
      const nl = r.sections.flatMap(s => s.lignes).find(x => x.type === "mo" && /carrel|fa(?:i|ï)ence/i.test(x.designation));
      if (nl) { Object.assign(f.l, { designation: nl.designation, details: nl.details, biblio_id: nl.biblio_id || f.l.biblio_id, ajustCarrelage: nl.ajustCarrelage });
        if (f.l.source !== "dicte" && f.l.source !== "saisi" && nl.pu !== null) { f.l.pu = nl.pu; f.l.source = nl.source; } done++; }
    }
    else if (q.kind === "ligne") {
      const r = M.analyse(t, S.biblio, { carrelage: carrelageCfg() });
      for (const s of r.sections) { const titre = s.titre === "Travaux" ? "" : s.titre; let sec = d.sections.find(x => x.titre === titre) || d.sections.find(x => !x.titre && !titre);
        if (!sec) { sec = { titre, lignes: [] }; d.sections.push(sec); } sec.lignes.push(...s.lignes.map(l => Object.assign({ id: uid() }, l))); done++; }
    }
  }
  askQuestions(null);   // nouvelle série si des points restent ouverts (2 séries au plus)
  persistDraft(); render(); toast(done ? `${done} réponse(s) prise(s) en compte` : "Aucune réponse saisie");
}
