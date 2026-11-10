// Débogage : node test/dbg.js A10 [A17 …]  ou  node test/dbg.js "texte dicté"
const M = require("../engine.js"), fs = require("fs"), path = require("path");
const CAT = process.env.GPH_CATALOGUE || path.join(__dirname, "../../devis_src/catalogue_seed.json");
const biblio = JSON.parse(fs.readFileSync(CAT, "utf8")), corpus = require("./corpus.js");
for (const a of process.argv.slice(2)) {
  const c = corpus.find(x => x.id === a); if (c && c.set === "test" && !process.env.GPH_VOIR_TEST) { console.log(a, ": jeu de test, non affiché"); continue; }
  const text = c ? c.text : a;
  const pre = M.normalizeOral(text).text, cl = M.extractClient(pre);
  console.log("\n#", a.slice(0, 60), "\n  client:", JSON.stringify(cl.client), "\n  segments:", M.segmenter(cl.body).map(s => `[${s.lead}${s.fournCue ? " F" : ""}${s.intro ? " intro" : ""}] ${s.raw}`).join("\n            "));
  const r = M.analyse(text, biblio);
  for (const s of r.sections) { console.log("  §", s.titre); for (const l of s.lignes) console.log(`    - [${l.type}] ${l.biblio_id || "HC"} ${l.designation.slice(0, 60)} | q=${l.quantite} ${l.unite} pu=${l.pu} ${l.incertain ? "(incertain " + l.confiance + ")" : ""} ⟵ ${l.raw}`); }
  console.log("  notes:", r.notes.join(" | "), "\n  ignorés:", r.ignored, "| durée", r.dureeJours, "| tva", r.tva);
}
