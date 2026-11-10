/* Lance toute l'évaluation du moteur de dictée et rend un verdict.
   Usage : GPH_CATALOGUE=/chemin/catalogue_prestations.json node test/run_all.js
   (le catalogue contient vos prix : il n'est pas dans le dépôt)
   Le parcours navigateur se lance à part : python3 test/t_e2e.py */
const { execFileSync } = require("child_process"), path = require("path"), fs = require("fs");
const tmp = path.join(require("os").tmpdir(), "gph_scores_" + process.pid + ".json");
const run = set => { execFileSync("node", [path.join(__dirname, "eval.js"), "--set", set, "--json", tmp, "--label", set], { stdio: "ignore" }); return JSON.parse(fs.readFileSync(tmp, "utf8"))[set][set]; };
const SETS = [["train", "Entraînement"], ["valid", "Validation 1"], ["valid2", "Validation 2"], ["valid3", "Validation 3"], ["test", "Test (jamais regardé)"]];
const corpus = require("./corpus.js"), rows = [];
for (const [set, nom] of SETS) if (corpus.some(c => c.set === set)) rows.push([nom, run(set)]);
const col = (s, n) => String(s).padStart(n);
console.log("\n" + "Jeu".padEnd(24) + col("dictées", 8) + col("parfaits", 10) + col("rappel", 8) + col("précision", 11) + col("quantités", 11) + col("prix inv.", 10) + col("ms", 7));
for (const [nom, r] of rows) console.log(nom.padEnd(24) + col(r.dictees, 8) + col(r.parfaites + " %", 10) + col(r.rappel + " %", 8) + col(r.precision + " %", 11) + col(r.quantites + " %", 11) + col(r.prixInventes, 10) + col(r.tempsMoyenMs, 7));
const bad = [];
for (const [nom, r] of rows) { if (r.prixInventes) bad.push(nom + " : prix inventé"); if (r.rappel < 90 || r.precision < 90) bad.push(nom + " : rappel ou précision sous 90 %"); if (r.quantites < 95) bad.push(nom + " : quantités sous 95 %"); }
if (rows[0][1].parfaites < 100) bad.push("Entraînement : régression (doit rester à 100 %)");
try { fs.unlinkSync(tmp); } catch (e) {}
console.log(bad.length ? "\nÉCHEC :\n - " + bad.join("\n - ") : "\nVERDICT : OK (critères atteints sur tous les jeux)");
process.exit(bad.length ? 1 : 0);
