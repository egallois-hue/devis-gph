/* Harnais de mesure du moteur de dictée.
   Usage : node test/eval.js [--set train|test|all] [--detail] [--engine chemin] [--json fichier] [--label nom]
   Le catalogue (non versionné, prix privés) est lu dans $GPH_CATALOGUE ou ../../devis_src/catalogue_seed.json */
const fs = require("fs"), path = require("path");
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf("--" + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true) : null; };
const SET = opt("set") || "train", DETAIL = !!opt("detail"), ENGINE = path.resolve(opt("engine") || path.join(__dirname, "../engine.js"));
const CAT = process.env.GPH_CATALOGUE || path.join(__dirname, "../../devis_src/catalogue_seed.json");
if (!fs.existsSync(CAT)) { console.error("Catalogue introuvable : définissez GPH_CATALOGUE=/chemin/catalogue_prestations.json"); process.exit(2); }
const M = require(ENGINE), biblio = JSON.parse(fs.readFileSync(CAT, "utf8")), corpus = require("./corpus.js");
const byId = new Map(biblio.map(b => [b.id, b]));
const low = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[-'’]/g, " ").replace(/\s+/g, " ").trim();
const near = (a, b) => a !== null && a !== undefined && Math.abs(Number(a) - Number(b)) <= 0.11;
const sameUnit = (a, b, q) => a === b || (Number(q) === 1 && ["u", "forfait"].includes(a) && ["u", "forfait"].includes(b));

// vérifie les identifiants du corpus
for (const c of corpus) for (const g of c.L) for (const alt of String(g[0]).split("|")) if (!alt.startsWith("HC:") && !byId.has(alt)) { console.error("Identifiant inconnu dans le corpus :", c.id, alt); process.exit(2); }

function evalCase(c) {
  const t0 = process.hrtime.bigint();
  const r = M.analyse(c.text, biblio, { today: new Date("2026-11-10") });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const norm = M.convertNumbers ? low(M.convertNumbers(c.text)) : low(c.text);
  const pred = [], fourn = [];
  for (const s of r.sections) for (const l of s.lignes) (l.type === "fourniture" ? fourn : pred).push(Object.assign({ sec: s.titre }, l));
  const res = { id: c.id, ms, tp: 0, fn: 0, fp: 0, qOk: 0, qN: 0, puOk: 0, puN: 0, fcOk: 0, fcN: 0, fTp: 0, fFn: 0, fFp: 0, fQOk: 0, fQN: 0, inv: 0, errs: [] };
  const okId = (g, p) => String(g[0]).split("|").some(alt => alt.startsWith("HC:") ? !p.biblio_id && low(p.designation).includes(low(alt.slice(3))) : p.biblio_id === alt);
  const used = new Set(), pair = new Map();
  for (const pass of [1, 2]) c.L.forEach((g, gi) => {
    if (pair.has(gi)) return;
    const pi = pred.findIndex((p, i) => !used.has(i) && okId(g, p) && (pass === 2 || g[1] === "*" || (g[1] === null ? p.quantite === null : near(p.quantite, g[1]))));
    if (pi >= 0) { used.add(pi); pair.set(gi, pi); }
  });
  c.L.forEach((g, gi) => {
    const o = g[3] || {}, p = pair.has(gi) ? pred[pair.get(gi)] : null;
    if (!p) { if (!o.opt) { res.fn++; res.errs.push(`MANQUE ${g[0]} ${g[1]} ${g[2]}`); } return; }
    if (!o.opt) res.tp++;
    if (g[1] !== "*") { res.qN++; const ok = (g[1] === null ? p.quantite === null : near(p.quantite, g[1])) && sameUnit(p.unite, g[2], g[1]); if (ok) res.qOk++; else res.errs.push(`QTE ${g[0]} attendu ${g[1]} ${g[2]}, obtenu ${p.quantite} ${p.unite}`); }
    if (o.pu !== undefined) { res.puN++; if (near(p.pu, o.pu)) res.puOk++; else res.errs.push(`PRIX DICTÉ ${g[0]} attendu ${o.pu}, obtenu ${p.pu}`); }
    if (o.fc !== undefined) { res.fcN++; if (!!p.fournitureComprise === !!o.fc) res.fcOk++; else res.errs.push(`FOURNITURE COMPRISE ${g[0]} attendu ${o.fc}`); }
  });
  pred.forEach((p, i) => { if (!used.has(i)) { res.fp++; res.errs.push(`EN TROP ${p.biblio_id || "HC"} « ${p.designation.slice(0, 50)} » q=${p.quantite} ${p.unite}  ⟵ ${String(p.raw).slice(0, 60)}`); } });
  // fournitures
  const fUsed = new Set();
  for (const g of c.F || []) {
    const fi = fourn.findIndex((f, i) => !fUsed.has(i) && low(f.designation).includes(low(g[0])));
    if (fi < 0) { res.fFn++; res.errs.push(`FOURNITURE MANQUE ${g[0]}`); continue; }
    fUsed.add(fi); res.fTp++; const f = fourn[fi];
    res.fQN++; if (near(f.quantite, g[1]) && (g[2] === null ? f.pu === null : near(f.pu, g[2]))) res.fQOk++; else res.errs.push(`FOURNITURE ${g[0]} attendu q=${g[1]} pu=${g[2]}, obtenu q=${f.quantite} pu=${f.pu}`);
  }
  fourn.forEach((f, i) => { if (!fUsed.has(i)) { res.fFp++; res.errs.push(`FOURNITURE EN TROP « ${f.designation.slice(0, 50)} »`); } });
  // prix inventés : tout prix qui ne vient ni du catalogue ni de la dictée
  const nums = new Set((norm.match(/\d+(?:[.,]\d+)?/g) || []).map(x => Number(x.replace(",", "."))));
  for (const l of pred.concat(fourn)) {
    if (l.pu === null || l.pu === undefined) continue;
    const cat = l.biblio_id && byId.get(l.biblio_id);
    const fromCat = cat && cat.pu !== null && near(l.pu - (l.ajustCarrelage || 0), cat.pu);
    const fromDict = nums.has(l.pu) || [...nums].some(n => l.quantite && near(n / l.quantite, l.pu));
    if (!fromCat && !fromDict) { res.inv++; res.errs.push(`PRIX INVENTÉ ${l.pu} sur « ${l.designation.slice(0, 40)} »`); }
  }
  // client et entête
  const cl = r.client || {}, g = c.client || {};
  res.cli = {};
  const eqNom = (a, b) => b.startsWith("~") ? low(a).includes(b.slice(1)) : low(a) === low(b);
  if (g.nom !== undefined) res.cli.nom = eqNom(cl.nom, g.nom); else res.cli.nom = !cl.nom;
  if (g.adr !== undefined) res.cli.adr = low(cl.adresse) === low(g.adr); else res.cli.adr = !cl.adresse;
  if (g.ville !== undefined) res.cli.ville = low(cl.cpVille).includes(low(g.ville));
  if (g.tel !== undefined) res.cli.tel = cl.tel === g.tel;
  if (g.email !== undefined) res.cli.email = cl.email === g.email;
  for (const k of Object.keys(res.cli)) if (!res.cli[k]) res.errs.push(`CLIENT ${k} : attendu « ${g[k === "adr" ? "adr" : k] ?? ""} », obtenu « ${k === "adr" ? cl.adresse : k === "ville" ? cl.cpVille : cl[k]} »`);
  res.duree = c.duree === undefined ? (r.dureeJours == null) : r.dureeJours === c.duree;
  if (!res.duree) res.errs.push(`DURÉE attendu ${c.duree}, obtenu ${r.dureeJours}`);
  res.tva = r.tva === (c.tva || 10); if (!res.tva) res.errs.push(`TVA attendu ${c.tva || 10}, obtenu ${r.tva}`);
  res.perfect = res.errs.length === 0;
  return res;
}

function aggregate(rs) {
  const sum = k => rs.reduce((a, r) => a + r[k], 0), pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 100;
  const cli = k => { const v = rs.filter(r => r.cli[k] !== undefined); return pct(v.filter(r => r.cli[k]).length, v.length); };
  const times = rs.map(r => r.ms).sort((a, b) => a - b);
  return {
    dictees: rs.length, parfaites: pct(rs.filter(r => r.perfect).length, rs.length),
    rappel: pct(sum("tp"), sum("tp") + sum("fn")), precision: pct(sum("tp"), sum("tp") + sum("fp")),
    quantites: pct(sum("qOk"), sum("qN")), prixDictes: pct(sum("puOk"), sum("puN")), fournComprise: pct(sum("fcOk"), sum("fcN")),
    fournRappel: pct(sum("fTp"), sum("fTp") + sum("fFn")), fournPrecision: pct(sum("fTp"), sum("fTp") + sum("fFp")), fournExactes: pct(sum("fQOk"), sum("fQN")),
    prixInventes: sum("inv"), clientNom: cli("nom"), clientAdresse: cli("adr"), clientVille: cli("ville"),
    duree: pct(rs.filter(r => r.duree).length, rs.length), tva: pct(rs.filter(r => r.tva).length, rs.length),
    tempsMoyenMs: Math.round(100 * times.reduce((a, b) => a + b, 0) / times.length) / 100, tempsMaxMs: Math.round(100 * times[times.length - 1]) / 100,
  };
}
const LABELS = { dictees: "Dictées", parfaites: "Devis parfaits du premier coup (%)", rappel: "Prestations : rappel (%)", precision: "Prestations : précision (%)", quantites: "Quantités et unités exactes (%)",
  prixDictes: "Prix dictés repris (%)", fournComprise: "Fourniture comprise (%)", fournRappel: "Fournitures : rappel (%)", fournPrecision: "Fournitures : précision (%)", fournExactes: "Fournitures : quantité et prix exacts (%)",
  prixInventes: "Prix inventés (nombre)", clientNom: "Client : nom (%)", clientAdresse: "Client : adresse (%)", clientVille: "Client : ville (%)", duree: "Durée du chantier (%)", tva: "TVA (%)",
  tempsMoyenMs: "Temps moyen par dictée (ms)", tempsMaxMs: "Temps maximal (ms)" };

const out = {};
for (const set of SET === "all" ? ["train", "test"] : [SET]) {
  const cases = corpus.filter(c => c.set === set), rs = cases.map(evalCase);
  if (DETAIL && set !== "test") for (const r of rs) if (!r.perfect) console.log(`\n✗ ${r.id}\n   ` + r.errs.join("\n   "));
  out[set] = aggregate(rs);
  console.log(`\n=== ${set.toUpperCase()} — ${path.basename(ENGINE)} ===`);
  for (const k of Object.keys(LABELS)) console.log("  " + LABELS[k].padEnd(44) + String(out[set][k]).padStart(7));
  if (set !== "test") console.log("  Dictées imparfaites : " + rs.filter(r => !r.perfect).map(r => r.id).join(" "));
}
const jf = opt("json"); if (jf && jf !== true) { let all = {}; try { all = JSON.parse(fs.readFileSync(jf, "utf8")); } catch (e) {} all[opt("label") || "run"] = out; fs.writeFileSync(jf, JSON.stringify(all, null, 1)); }
module.exports = { evalCase, aggregate, LABELS };
