// Essai rapide : node test/q.js "texte dicté"  (affiche segments, lignes, notes)
const M = require("../engine.js"), fs = require("fs"), path = require("path");
const CAT = process.env.GPH_CATALOGUE || path.join(__dirname, "../../devis_src/catalogue_seed.json");
const biblio = JSON.parse(fs.readFileSync(CAT, "utf8"));
for (const text of process.argv.slice(2)) {
  const r = M.analyse(text, biblio);
  console.log("\n«", text.slice(0, 110), "»", r.client.nom ? "\n  client: " + [r.client.nom, r.client.adresse, r.client.cpVille].join(" | ") : "");
  for (const s of r.sections) for (const l of s.lignes) console.log(`  [${s.titre}] ${l.type === "fourniture" ? "F " : ""}${l.biblio_id || "HC"} ${l.designation.slice(0, 58)} | q=${l.quantite} ${l.unite} pu=${l.pu}${l.fournitureComprise ? " FC" : ""}${l.incertain ? " (incertain " + l.confiance + ")" : ""} ⟵ ${l.raw}`);
  if (r.notes.length) console.log("  notes:", r.notes.join(" | ").slice(0, 300)); if (r.ignored.length) console.log("  ignorés:", r.ignored);
}
