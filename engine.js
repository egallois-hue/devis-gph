/* =====================================================================
   Moteur de mise en forme des devis — Gallois PH
   100 % local, sans IA : transforme une dictée en devis structuré.
   ===================================================================== */
(function (root) {
"use strict";

/* ---------- Normalisation ---------- */
const deaccent = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const low = s => deaccent(String(s || "").toLowerCase()).replace(/œ/g, "oe").replace(/æ/g, "ae");
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

/* ---------- Nombres en lettres → chiffres ---------- */
const NUM = { zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13,
  quatorze: 14, quinze: 15, seize: 16, vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100, cents: 100, mille: 1000, mil: 1000 };
const NUMWORD = new RegExp("\\b(?:" + Object.keys(NUM).join("|") + ")(?:[\\s-]+(?:et[\\s-]+)?(?:" + Object.keys(NUM).join("|") + "))*\\b", "gi");
function wordsToNumber(str) {   // renvoie un ou plusieurs nombres : « soixante soixante » → "60 60"
  const toks = low(str).split(/[\s-]+/).filter(t => t && t !== "et");
  const out = []; let total = 0, cur = 0, last = null;
  const push = () => { if (last !== null) out.push(total + cur); total = 0; cur = 0; last = null; };
  for (let i = 0; i < toks.length; i++) {
    const v = NUM[toks[i]]; if (v === undefined) return null;
    if (v === 100) { cur = (cur % 100 || 1) * 100 + (cur - cur % 100); last = 100; continue; }
    if (v === 1000) { total += (cur || 1) * 1000; cur = 0; last = 1000; continue; }
    if (v === 20 && last === 4) { cur = cur - 4 + 80; last = 80; continue; }                 // quatre-vingt
    if (v >= 10 && v < 20 && (cur % 100 === 60 || cur % 100 === 80) && last !== null && last >= 60) { cur += v; last = v; continue; }  // soixante-dix
    const ok = last === null || (last === 10 && v >= 7 && v <= 9 && cur % 100 % 10 === 0) || last >= 100 && cur % 100 === 0 || ((cur % 100 === 70 || cur % 100 === 90) && v < 10) || (last >= 20 && v < 10 && cur % 10 === 0 && last % 10 === 0);
    if (!ok) push();
    cur += v; last = v;
  }
  push();
  return out.join(" ");
}
function convertNumbers(text) {
  // "vingt-huit virgule cinq" → "28,5"
  let t = text.replace(NUMWORD, (m, off, full) => {
    const n = wordsToNumber(m); if (n === null) return m;
    const lm = low(m).trim();
    if ((lm === "un" || lm === "une")) {          // article : on ne convertit que devant une unité / un prix
      const after = low(full.slice(off + m.length, off + m.length + 22));
      if (!/^\s*(metre|m2|m²|m\b|euro|€|forfait|heure|jour|ml|lot|piece|unite|kilo)/.test(after)) return m;
    }
    return String(n);
  });
  t = t.replace(/(\d+)\s+virgule\s+(\d+)/gi, "$1,$2");
  t = t.replace(/(\d+)\s*(?:euros?|€)\s+(\d{1,2})\b(?!\s*(?:m\b|m2|m²|mètres?|metres?|%|x\b|fois|sacs?|u\b|unit))/gi, (m, a, b) => a + "," + b.padStart(2, "0") + " euros");
  return t;
}

/* ---------- Unités ---------- */
const UNIT_PATTERNS = [
  ["m²", /^(?:m(?:etres?|ètres?)?\s*carr(?:e|é)s?|m\s?2|m²|mc)\b/i],
  ["m³", /^(?:m(?:etres?|ètres?)?\s*cubes?|m\s?3|m³)\b/i],
  ["ml", /^(?:m(?:etres?|ètres?)\s*lin(?:e|é)aires?|ml|m(?:etres?|ètres?)(?!\s*carr)(?!\s*cub))\b/i],
  ["h", /^(?:heures?|h)\b/i],
  ["jour", /^(?:jours?|journ(?:e|é)es?)\b/i],
  ["forfait", /^forfaits?\b/i],
  ["u", /^(?:unit(?:e|é)s?|pi(?:e|è)ces?|points?|u)\b/i],
];
function unitAt(s) { s = s.trim(); for (const [u, re] of UNIT_PATTERNS) { const m = s.match(re); if (m) return { u, len: m[0].length }; } return null; }

/* ---------- Vocabulaire métier ---------- */
const STOP = new Set("le la les l un une des du de d au aux a à en et ou pour par sur sous avec dans on va il faut faire fait je nous vous y ce cet cette ces son sa ses leur leurs mon ma mes ton ta qui que quoi est sont etre être tout toute tous toutes plus aussi alors donc puis ensuite apres après euh bon ben voila voilà comme bien deja déjà encore chaque environ".split(" "));
const SYN = {   // forme dictée → racine canonique
  enlev: "depos", retir: "depos", arrach: "depos", vir: "depos", demont: "depos", deposs: "depos", decoll: "depos", detapiss: "depos", casse: "depos", cass: "depos",
  peindr: "peintur", peint: "peintur", repeindr: "peintur", repeint: "peintur", peinturag: "peintur",
  carrel: "carrelag", faienc: "carrelag", carreau: "carrelag",
  placo: "ba13", placoplatr: "ba13", plaqu: "ba13", ba: "ba13",
  ponc: "poncag", vitrifi: "vitrif", vernis: "vitrif",
  joint: "jointoi", jointoi: "jointoi",
  install: "pos", mett: "pos", met: "pos", mis: "pos", pose: "pos", pos: "pos", poser: "pos",
  remplac: "remplac", chang: "remplac",
  toilett: "wc", cabinet: "wc", chiott: "wc",
  lavabo: "lavabo", vasqu: "lavabo",
  italien: "italien", receveur: "douch", bac: "douch",
  tapiss: "papier", papier: "papier",
  lessiv: "nettoy", nettoi: "nettoy", nettoy: "nettoy", lav: "nettoy",
  dechet: "dechet", gravat: "dechet", gravoi: "dechet", decheteri: "dechet", dechetteri: "dechet",
  protect: "protect", proteg: "protect", bach: "protect",
  enduit: "enduit", enduir: "enduit", ratiss: "enduit", lissag: "enduit",
  fissur: "fissur", rebouch: "fissur",
  lumier: "lumin", luminair: "lumin", lustr: "lumin", appliqu: "lumin", eclairag: "lumin", plafonni: "lumin",
  spot: "spot", prise: "pris", pris: "pris", interrupteur: "interrupt",
  ventil: "vmc", vmc: "vmc", aerat: "vmc",
  cloison: "cloison", doublag: "doublag", "faux": "faux",
  parquet: "parquet", stratifi: "parquet", flott: "flottant",
  porte: "port", huisseri: "port", fenetr: "fenetr", clotur: "clotur", grillag: "clotur", portail: "portillon", portillon: "portillon",
  ragre: "ragreag", etanch: "etanch", hydro: "hydrofug", hydrofug: "hydrofug",
  plafond: "plafond", mur: "mur", murs: "mur", mural: "mur", murau: "mur", muret: "muret", meubl: "mobili", mobili: "mobili", eclair: "lumin", radiateur: "radiateur", "seche": "radiateur",
  mitigeur: "mitigeur", robinet: "mitigeur", robinetteri: "mitigeur",
  machin: "machine", fibr: "fibr", box: "fibr", tableau: "tableau", disjoncteur: "tableau",
};
function stem(w) {
  w = low(w).replace(/[^a-z0-9]/g, "");
  if (!w) return "";
  if (/^\d/.test(w)) return w === "13" ? "ba13" : "";
  let s = w.replace(/(ements|ement|ations|ation|ages|age|ees|ee|es|er|ez|e|s|x)$/,"") || w;
  if (s.length < 3) s = w;
  for (let k = Math.min(s.length, 10); k >= 3; k--) { const p = s.slice(0, k); if (SYN[p]) return SYN[p]; }
  return s;
}
const ACTIONS = new Set(["depos","pos","peintur","poncag","remplac","nettoy","protect","fissur","enduit","vitrif","jointoi","ragreag","etanch"]);
function tokens(text) {
  return low(text).split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w)).map(stem).filter(Boolean);
}

/* ---------- Pièces (sections) ---------- */
const ROOMS = [
  ["Salle de bains", /salle (?:de|d)\s*bains?|\bsdb\b/], ["Salle de douche", /salle (?:de|d)\s*douche|salle d'?eau/], ["WC", /\b(?:wc|toilettes?)\b/],
  ["Cuisine", /\bcuisine\b/], ["Séjour", /\bs(?:e|é)jour\b/], ["Salon", /\bsalon\b/], ["Salle à manger", /salle a manger/],
  ["Entrée", /\bentr(?:e|é)e\b/], ["Couloir", /\b(?:couloir|d(?:e|é)gagement)\b/], ["Chambre", /\bchambres?\b/], ["Bureau", /\bbureau\b/],
  ["Buanderie", /\bbuanderie\b/], ["Cellier", /\bcellier\b/], ["Garage", /\bgarage\b/], ["Escalier", /\bescaliers?\b/], ["Palier", /\bpalier\b/],
  ["Balcon", /\bbalcons?\b/], ["Terrasse", /\bterrasses?\b/], ["Façade", /\bfa(?:c|ç)ades?\b/], ["Jardin", /\bjardin\b/], ["Extérieur", /\bext(?:e|é)rieur\b/],
  ["Combles", /\bcombles?\b/], ["Mezzanine", /\bmezzanine\b/], ["Dressing", /\bdressing\b/], ["Parties communes", /parties? communes?/],
];
function roomOf(text) {
  const l = low(text);
  for (const [name, re] of ROOMS) { const m = l.match(re); if (m) { const num = l.slice(m.index).match(/^[a-z' ]+?\s(\d)\b/); return { name: num && name === "Chambre" ? name + " " + num[1] : name, index: m.index, len: m[0].length }; } }
  return null;
}

/* ---------- Reformulation professionnelle (prestations hors catalogue) ---------- */
const VERBS = [
  [/^(?:d(?:e|é)pos(?:er|e|é|ez)?|enlev(?:er|e|é)|retir(?:er|e)|arrach(?:er|e)|vir(?:er|e)|d(?:e|é)mont(?:er|e)|d(?:e|é)coll(?:er|e))\b/, "Dépose"],
  [/^(?:mettre en place|mise en place|met en place)\b/, "Mise en place"],
  [/^(?:pos(?:er|e|é|ez)|install(?:er|e|é)|mettre|met|fixer)\b/, "Pose"],
  [/^peinture\s+(?=blanch|satin|mat|velours|laqu|sp(?:e|é)cial|ext(?:e|é)rieur|int(?:e|é)rieur|glyc|acryl)/, "Peinture"],
  [/^(?:repeindre|repeint|peindre|peint|faire la peinture (?:de|des|du)?|peinture)\b/, "Mise en peinture"],
  [/^(?:poncer|ponce|pon(?:c|ç)age)\b/, "Ponçage"], [/^(?:reboucher|rebouche|rebouchage)\b/, "Rebouchage"],
  [/^(?:lessiver|lessive)\b/, "Lessivage"], [/^(?:nettoyer|nettoie|laver|lave)\b/, "Nettoyage"],
  [/^(?:remplacer|remplace|changer|change)\b/, "Remplacement"], [/^(?:raccorder|raccorde|brancher|branche)\b/, "Raccordement"],
  [/^(?:cr(?:e|é)er|cr(?:e|é)e|r(?:e|é)aliser|r(?:e|é)alise)\b/, "Réalisation"], [/^(?:reprendre|reprend|reprise)\b/, "Reprise"],
  [/^(?:vitrifier|vitrifie)\b/, "Vitrification"], [/^(?:carreler|carrelle)\b/, "Pose de carrelage"], [/^(?:enduire|enduit)\b/, "Application d'enduit"],
  [/^(?:isoler|isole)\b/, "Isolation"], [/^(?:d(?:e|é)molir|d(?:e|é)molit|casser|casse)\b/, "Démolition"], [/^(?:(?:e|é)vacuer|(?:e|é)vacue)\b/, "Évacuation"],
  [/^(?:prot(?:e|é)ger|prot(?:e|è)ge)\b/, "Protection"], [/^(?:v(?:e|é)rifier|contr(?:o|ô)ler|v(?:e|é)rifie|contr(?:o|ô)le)\b/, "Contrôle"],
  [/^(?:r(?:e|é)parer|r(?:e|é)pare)\b/, "Réparation"], [/^(?:d(?:e|é)placer|d(?:e|é)place)\b/, "Déplacement"], [/^(?:sceller|scelle)\b/, "Scellement"],
  [/^(?:ragr(?:e|é)er)\b/, "Ragréage"], [/^(?:traiter|traite)\b/, "Traitement"], [/^(?:d(?:e|é)mousser|d(?:e|é)mousse)\b/, "Démoussage"],
  [/^(?:tirer|tire)\b/, "Tirage"], [/^(?:percer|perce)\b/, "Perçage"], [/^(?:ajuster|r(?:e|é)gler|r(?:e|é)gle)\b/, "Réglage"],
];
const LEX = [
  [/\bplaco(?:pl[aâ]tre)?\b/gi, "plaques de plâtre BA13"], [/\bba ?13\b/gi, "BA13"], [/\bpvc\b/gi, "PVC"], [/\bvmc\b/gi, "VMC"], [/\bwc\b/gi, "WC"],
  [/\beau chaude (?:et )?(?:eau )?froide\b/gi, "EC/EF"], [/\bm ?2\b/gi, "m²"], [/\bsdb\b/gi, "salle de bains"], [/\bsous[ -]couche\b/gi, "sous-couche"],
  [/\bhydro\b/gi, "hydrofuge"], [/\bgeberit\b/gi, "Geberit"], [/\btollens\b/gi, "Tollens"], [/\bplacard\b/gi, "placard"],
];
const FILLER = /^(?:(?:alors|donc|ensuite|puis|apr(?:e|è)s|et|aussi|euh|bon|ben|voil(?:a|à)|ok|du coup|egalement|également)\s*,?\s*)+/i;
const SUBJ = /^(?:(?:on|il|nous|je|tu|vous)\s+(?:va|vais|allons|allez|doit|dois|devra|faut|faudra|peut|pourra)?\s*(?:falloir\s+)?|il\s+(?:y\s+a|faut|faudra)\s+(?:(?:a|à)\s+)?|y\s+a\s+|faut\s+|(?:la\s+)?pr(?:e|é)voir\s+)/i;
function articleDe(rest) {
  rest = rest.trim();
  if (!rest) return "";
  let m;
  if ((m = rest.match(/^(?:le|du)\s+/i))) return "du " + rest.slice(m[0].length);
  if ((m = rest.match(/^la\s+/i))) return "de la " + rest.slice(m[0].length);
  if ((m = rest.match(/^l['’]\s*/i))) return "de l'" + rest.slice(m[0].length);
  if ((m = rest.match(/^(?:les|des)\s+/i))) return "des " + rest.slice(m[0].length);
  if ((m = rest.match(/^(un|une)\s+/i))) return "d'" + m[1].toLowerCase() + " " + rest.slice(m[0].length);
  if ((m = rest.match(/^(?:de|d['’])\s*/i))) return rest;
  if ((m = rest.match(/^(\d+(?:,\d+)?)\s+/))) return "de " + rest;
  return (/^[aeiouyhéèêàâ]/i.test(rest) ? "d'" : "de ") + rest;
}
function reformulate(raw) {
  let t = raw.replace(/\s+/g, " ").trim().replace(/[.;:,]+$/, "");
  t = t.replace(FILLER, "").replace(SUBJ, "").replace(FILLER, "");
  for (const [re, rep] of LEX) t = t.replace(re, rep);
  const l = low(t);
  for (const [re, noun] of VERBS) {
    const m = l.match(re);
    if (m) { const rest = t.slice(m[0].length).replace(/^\s*(?:de|du|des|d['’])?\s*$/i, ""); if (noun === "Peinture") return cap("Peinture " + rest.trim()); return cap(noun + (rest.trim() ? " " + articleDe(rest) : "")).trim(); }
  }
  return cap(t);
}

/* ---------- Correspondance avec le catalogue ---------- */
function buildIndex(biblio) {
  const df = {}; const docs = biblio.map(b => {
    const main = tokens(b.designation), alias = (b.aliases || []).flatMap(tokens), det = (b.details || []).flatMap(tokens);
    const set = new Map();
    for (const t of main) set.set(t, Math.max(set.get(t) || 0, 1));
    for (const t of alias) set.set(t, Math.max(set.get(t) || 0, 1.2));
    for (const t of det) set.set(t, Math.max(set.get(t) || 0, 0.35));
    for (const t of set.keys()) df[t] = (df[t] || 0) + 1;
    return { b, set };
  });
  const N = docs.length || 1;
  const idf = t => Math.log(1 + N / (df[t] || 0.5));
  for (const d of docs) { let n = 0; for (const [t, w] of d.set) n += (w * idf(t)) ** 2; d.norm = Math.sqrt(n) || 1; }
  return { docs, idf };
}
function match(index, text, unite) {
  const q = [...new Set(tokens(text))];
  if (!q.length) return [];
  const qn = Math.sqrt(q.reduce((a, t) => a + index.idf(t) ** 2, 0)) || 1;
  const out = [];
  for (const d of index.docs) {
    let dot = 0, hits = 0;
    for (const t of q) { const w = d.set.get(t); if (w) { dot += w * index.idf(t) ** 2; hits++; } }
    if (!hits) continue;
    let score = dot / (qn * d.norm);
    if (!d.acts) { const a = tokens(d.b.designation).filter(t => ACTIONS.has(t)); d.acts = new Set(a.length > 1 && a.includes("pos") && /^mise en/i.test(d.b.designation) ? a.filter(t => t !== "pos") : a); }
    const qa = q.filter(t => ACTIONS.has(t));
    const compat = qa.some(t => d.acts.has(t)) || (qa.includes("pos") && d.acts.has("remplac")) || (qa.includes("remplac") && d.acts.has("pos"));
    if (qa.length && d.acts.size && !compat) score -= 0.4;
    if (unite && d.b.unite === unite) score += 0.08;
    else if (unite && d.b.unite && unite !== d.b.unite && !(unite === "u" && d.b.unite === "forfait")) score -= (["m²", "ml", "m³"].includes(unite) && ["m²", "ml", "m³"].includes(d.b.unite)) ? 0.2 : 0.06;
    out.push({ b: d.b, score: r2(score), hits });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

/* ---------- Client ---------- */
const CP_VILLES = { "angervilliers": "91470", "limours": "91470", "forges les bains": "91470", "les molieres": "91470", "pecqueuse": "91470", "briis sous forges": "91640",
  "fontenay les briis": "91640", "janvry": "91640", "vaugrigneuse": "91640", "dourdan": "91410", "roinville": "91410", "saint cheron": "91530", "sermaise": "91530",
  "le val saint germain": "91530", "saint maurice montcouronne": "91530", "breuillet": "91650", "breux jouy": "91650", "saint yon": "91650", "egly": "91520", "arpajon": "91290",
  "ollainville": "91340", "bruyeres le chatel": "91680", "courson monteloup": "91680", "saint germain les arpajon": "91180", "breteuil": "", "bretigny sur orge": "91220",
  "marcoussis": "91460", "montlhery": "91310", "linas": "91310", "gometz la ville": "91400", "gometz le chatel": "91940", "les ulis": "91940", "orsay": "91400",
  "bures sur yvette": "91440", "gif sur yvette": "91190", "palaiseau": "91120", "massy": "91300", "saclas": "91690", "etampes": "91150", "evry": "91000",
  "evry courcouronnes": "91000", "corbeil essonnes": "91100", "saint michel sur orge": "91240", "boissy sous saint yon": "91790", "bonnelles": "78830",
  "rochefort en yvelines": "78730", "saint arnoult en yvelines": "78730", "rambouillet": "78120", "clairefontaine en yvelines": "78120", "sonchamp": "78120",
  "ablis": "78660", "chevreuse": "78460", "cernay la ville": "78720", "versailles": "78000", "boulogne billancourt": "92100", "puteaux": "92800", "cesson": "77240" };
const CIV = [[/^monsieur et madame\b|^m(?:\.|r)? et mme\b/i, "M. et Mme"], [/^mesdames et messieurs\b/i, "Mesdames et Messieurs"], [/^monsieur\b|^m\.|^mr\b/i, "M."],
  [/^madame\b|^mme\b/i, "Mme"], [/^mademoiselle\b|^mlle\b/i, "Mlle"], [/^(?:la )?copropri(?:e|é)t(?:e|é)\b/i, "Copropriété"], [/^(?:le )?syndic\b/i, "Syndic"], [/^(?:la )?soci(?:e|é)t(?:e|é)\b/i, "Société"]];
const STREET = "rue|avenue|av\\.?|boulevard|bd|all(?:e|é)e|chemin|impasse|place|route|villa|passage|square|quai|cours|r(?:e|é)sidence|sentier|hameau|lotissement|sente|ruelle|faubourg|rond-point|parvis|cit(?:e|é)|domaine";
function titleCase(s) { return s.toLowerCase().replace(/(^|[\s'’-])([a-zàâçéèêëîïôûùüÿœ])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Du|Des|La|Le|Les|Sur|Sous|En|Et|Aux|Au|L')\b/g, w => w.toLowerCase()).replace(/^./, c => c.toUpperCase()); }
function extractClient(text) {
  const c = { nom: "", adresse: "", cpVille: "", email: "", tel: "" }; let consumed = [];
  const em = text.match(/([a-z0-9._-]+)\s*(?:@|arobase|arrobase)\s*([a-z0-9-]+)\s*(?:\.|point)\s*(fr|com|net|org|eu|io)\b/i);
  if (em) { c.email = (em[1] + "@" + em[2] + "." + em[3]).toLowerCase(); consumed.push(em[0]); }
  const tel = text.match(/\b0[1-9](?:[\s.]?\d{2}){4}\b/);
  if (tel) { c.tel = tel[0].replace(/[\s.]/g, "").replace(/(\d{2})(?=\d)/g, "$1 "); consumed.push(tel[0]); }
  const nm = text.match(new RegExp("(?:devis\\s+(?:pour|chez|de)|pour|chez|client(?:e)?\\s*:?)\\s+((?:monsieur et madame|m(?:\\.|r)? et mme|mesdames et messieurs|monsieur|madame|mademoiselle|mme|mlle|m\\.|mr|(?:la )?copropri(?:e|é)t(?:e|é)|(?:le )?syndic|(?:la )?soci(?:e|é)t(?:e|é))\\s+[^,.;\\d]{2,60}?)(?=\\s*(?:,|\\.|;|\\bqui\\b|\\bau\\b|\\bà\\b|\\ba\\b|\\bhabit|\\bdemeur|\\bsitu|\\b\\d|$))", "i"));
  if (nm) {
    let n = nm[1].trim(); let civ = "";
    for (const [re, rep] of CIV) { const m = n.match(re); if (m) { civ = rep; n = n.slice(m[0].length).trim(); break; } }
    n = n.replace(/\s+(?:du|de|des|de la|au|aux|le|la)$/i, "").trim(); c.nom = (civ ? civ + " " : "") + titleCase(n); consumed.push(nm[0].replace(/\s+(?:du|de|des|au)\s*$/i, ""));
  }
  const ad = text.match(new RegExp("\\b(\\d{1,4}(?:\\s?(?:bis|ter))?)\\s*,?\\s+((?:" + STREET + ")\\b[^,.;]*?)(?=\\s*(?:,|\\.|;|\\s(?:à|a|au|sur)\\s|\\s\\d{2}\\s?\\d{3}\\b|$))", "i"));
  if (ad) { c.adresse = ad[1].replace(/\s/g, " ") + " " + ad[2].trim().replace(/^(\w)/, x => x.toLowerCase()); c.adresse = c.adresse.replace(/\b(rue|avenue|boulevard|allée|allee|chemin|impasse|place|route|villa|passage|square|quai|cours|résidence|residence|sentier)\s+(?:de\s+la\s+|de\s+l'|du\s+|des\s+|de\s+)?(.+)$/i, (m, t, rest) => m.slice(0, m.length - rest.length) + titleCase(rest)); consumed.push(ad[0]); }
  const cp = text.match(/\b(\d{2})\s?(\d{3})\s+([A-Za-zÀ-ÿ' -]{2,40}?)(?=\s*(?:,|\.|;|$|\s\d|\s\S+@|\s(?:pour|on|il|j|je|le|la|les|t[eé]l|chambre|salle|cuisine|wc)\b))/i);
  if (cp && /^(7[5-8]|9[1-5]|2[78]|6[0]|4[5])/.test(cp[1])) { c.cpVille = cp[1] + cp[2] + " " + titleCase(cp[3].trim()); consumed.push(cp[0]); }
  else {
    const v = text.match(/(?:^|[\s,])(?:à|a|sur)\s+([A-ZÀ-Ý][\wÀ-ÿ'-]+(?:[\s-](?:sur|sous|les|lès|le|la|en|de|du|saint|sainte|[A-ZÀ-Ý][\wÀ-ÿ'-]+)){0,4})/);
    if (v) { const key = low(v[1]).replace(/[-']/g, " ").replace(/\s+/g, " ").trim(); const cpv = CP_VILLES[key];
      if (cpv !== undefined) { consumed.push(v[0].trim()); c.cpVille = (cpv ? cpv + " " : "") + titleCase(v[1].replace(/\s+/g, "-").replace(/-(sur|sous|les|lès|le|la|en|de|du)-/gi, (m, w) => "-" + w.toLowerCase() + "-")); consumed.push(v[0]); } }
    const paris = text.match(/\bparis\s*(\d{1,2})(?:e|ème|eme)?\b/i);
    if (!c.cpVille && paris) { c.cpVille = "750" + String(paris[1]).padStart(2, "0") + " Paris"; consumed.push(paris[0]); }
  }
  if (c.adresse && c.cpVille) { const ville = c.cpVille.replace(/^\d{5}\s*/, ""); c.adresse = c.adresse.replace(new RegExp("\\s+(?:à\\s+)?" + ville.replace(/[-\s]/g, "[-\\s]") + "(?:\\s*\\d{1,2}(?:e|ème)?)?\\s*$", "i"), "").trim(); }
  return { client: c, consumed };
}

/* ---------- Extraction quantité / prix dans une ligne ---------- */
function parseAmounts(t) {
  const res = { quantite: null, unite: null, pu: null, total: null, prixUnit: null };
  const s = t.replace(/(\d)\s+(\d{3})\b/g, "$1$2");
  // prix
  const PR = /(\d+(?:[.,]\d+)?)\s*(?:€|euros?|eur\b|balles)(?:\s*(?:ht|hors taxes?))?(\s*(?:\/|par|du|le|la|l['’]|chaque|de l['’]|au|pour (?:le|la|l['’]))\s*(m(?:e|è)tres?\s*carr(?:e|é)s?|m\s?2|m²|m(?:e|è)tres?\s*lin(?:e|é)aires?|ml|m(?:e|è)tres?|unit(?:e|é)|pi(?:e|è)ces?|heures?|h|jours?|journ(?:e|é)es?|points?|panneaux?|portes?|spots?|prises?|m(?:e|è)tre cube|m3))?/gi;
  let m, prices = [];
  while ((m = PR.exec(s))) prices.push({ v: Number(m[1].replace(",", ".")), per: m[3] || null, idx: m.index, len: m[0].length, txt: m[0], before: s.slice(Math.max(0, m.index - 14), m.index) });
  // quantités
  const QR = /(\d+(?:[.,]\d+)?)\s*(m(?:e|è)tres?\s*carr(?:e|é)s?|m\s?2\b|m²|m(?:e|è)tres?\s*cubes?|m\s?3\b|m³|m(?:e|è)tres?\s*lin(?:e|é)aires?|ml\b|m(?:e|è)tres?\b|heures?\b|jours?\b|journ(?:e|é)es?\b|unit(?:e|é)s?\b|pi(?:e|è)ces?\b|points?\b|forfaits?\b)/gi;
  const priceSpans = prices.map(p => [p.idx, p.idx + p.len]);
  let qs = [];
  while ((m = QR.exec(s))) { if (priceSpans.some(([a, b]) => m.index >= a && m.index < b)) continue; qs.push({ v: Number(m[1].replace(",", ".")), u: unitAt(m[2])?.u || null, idx: m.index, txt: m[0] }); }
  // "fois 3", "x 3", "3 fois"
  const FX = s.match(/(?:\bx\s*|\bfois\s+)(\d+(?:[.,]\d+)?)\b|\b(\d+(?:[.,]\d+)?)\s+fois\b/i);
  // "3 portes", "4 spots" (quantité + nom)
  const QN = s.match(/\b(\d{1,3})\s+(portes?|spots?|prises?|fen(?:e|ê)tres?|luminaires?|appliques?|lustres?|interrupteurs?|radiateurs?|panneaux?|poteaux?|points? lumineux|wc|lavabos?|vasques?|mitigeurs?|robinets?|bouches?|plinthes?|marches?|sacs?|boites?|bo(?:i|î)tes?|cartons?|rouleaux?|pots?|seaux?|cartouches?|bidons?)\b/i);
  const QG = !QN && s.match(/\b(\d{1,3})\s+(?!(?:euros?|€|m\b|m2|m²|ml|mm|cm|kg|x\b|par\b|fois|%))([a-zà-ÿœ-]{3,})/i);
  if (qs.length) { res.quantite = qs[0].v; res.unite = qs[0].u; }
  else if (QG) { res.quantite = Number(QG[1]); res.unite = "u"; }
  else if (QN) { res.quantite = Number(QN[1]); res.unite = "u"; }
  else if (FX) { res.quantite = Number((FX[1] || FX[2]).replace(",", ".")); res.unite = "u"; }
  if (prices.length) {
    const p = prices[prices.length - 1];
    const totalHint = /(?:pour|total|en tout|l['’]ensemble|forfait|au forfait|soit)\s*(?:de\s*|à\s*)?$/i.test(p.before) || /forfait/i.test(s);
    if (p.per) { res.pu = p.v; const u = unitAt(p.per)?.u; if (u && !res.unite) res.unite = u; if (/portes?|spots?|prises?|panneaux?/i.test(p.per)) res.unite = res.unite || "u"; }
    else if (totalHint || res.quantite === null || (res.unite === "u" && !/(?:(?:^|\s)(?:à|a)|chaque|pi(?:e|è)ce|l['’]unit(?:e|é))\s*$/i.test(p.before))) { res.total = p.v; }
    else res.pu = p.v;                 // « 28 m² à 38 euros » : prix unitaire
  }
  if (res.total !== null) {
    if (res.quantite && res.quantite !== 1 && res.unite && res.unite !== "forfait") { res.pu = r2(res.total / res.quantite); res.totalDicte = res.total; }
    else { res.quantite = 1; res.unite = res.unite && res.unite !== "u" ? (res.quantite === 1 && res.unite !== "forfait" ? res.unite : "forfait") : "forfait"; res.pu = res.total; if (res.unite !== "forfait") res.unite = "forfait"; }
  }
  if (/forfait/i.test(s) && res.quantite === null) { res.quantite = 1; res.unite = "forfait"; }
  const qnTxt = (QN && QN[0]) || (QG && !qs.length && QG[0] && /^(?:sacs?|bo(?:i|î)tes?|cartons?|rouleaux?|pots?|seaux?|cartouches?|bidons?|lots?)$/i.test(QG[2]) ? QG[0].replace(/\s+\S+$/, "") + " " + QG[2] : "") || "";
  let s2 = s; if (qnTxt && /^(?:\d+\s+(?:sacs?|bo(?:i|î)tes?|cartons?|rouleaux?|pots?|seaux?|cartouches?|bidons?|lots?))$/i.test(qnTxt)) s2 = s.replace(qnTxt, " ");
  res.cleaned = s2.replace(PR, " ").replace(QR, " ").replace(/\b(?:x|fois)\s*\d+(?:[.,]\d+)?\b|\b\d+(?:[.,]\d+)?\s+fois\b/gi, " ")
    .replace(/\b(?:soit|à|a|pour|au prix de|au tarif de|ça fait|ca fait|ce qui fait|tarif|prix|total|en tout|forfait|au forfait|de|du|le|la)\s*(?=[\s,.;]*$)/gi, " ")
    .replace(/\s+(?:soit|à|a|pour|au)\s*(?=[,.;]|$)/gi, " ").replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").trim();
  return res;
}

/* ---------- Découpage de la dictée ---------- */
function splitClauses(text) {
  let t = " " + text.replace(/\r/g, "") + " ";
  t = t.replace(/\n+/g, " ¶ ");
  t = t.replace(/\s*(?:\.\s+|;\s*|\s¶\s|!\s+|\?\s+)/g, " ¶ ");
  t = t.replace(/\s(?:puis|ensuite|apr(?:e|è)s (?:ça|ca|cela)|et apr(?:e|è)s|et ensuite|et puis|ensuite on|deuxi(?:e|è)me chose|autre chose)\s/gi, " ¶ ");
  t = t.replace(/:\s*/g, " : ");
  let parts = t.split("¶").map(s => s.trim()).filter(Boolean);
  // une virgule suivie d'un nouveau verbe d'action sépare deux prestations
  const out = [];
  const ACT = /^(?:on\s+|il\s+faut\s+|faut\s+)?(?:d(?:e|é)pos|enl(?:e|è)v|retir|arrach|pos|install|mett|met\b|mise en|peindr|repeindr|peinture|ponc|rebouch|lessiv|nettoy|remplac|chang|raccord|cr(?:e|é)|r(?:e|é)alis|reprend|vitrifi|carrel|endui|isol|d(?:e|é)mol|cass|(?:e|é)vacu|prot(?:e|é)g|contr(?:o|ô)l|v(?:e|é)rifi|r(?:e|é)par|d(?:e|é)plac|scell|ragr|tir|perc|fourni|habill|coffr|doubl|joint|pr(?:e|é)par)/i;
  for (const p of parts) {
    const segs = p.split(/,\s+(?:et\s+)?/);
    let acc = segs[0];
    for (let i = 1; i < segs.length; i++) {
      const hasAmountAcc = /\d/.test(acc);
      if (ACT.test(segs[i].trim()) && hasAmountAcc) { out.push(acc); acc = segs[i]; } else acc += ", " + segs[i];
    }
    out.push(acc);
  }
  const QU = "\\d+(?:[.,]\\d+)?\\s*(?:m(?:e|è)tres?\\s*carr(?:e|é)s?|m\\s?2|m²|ml|m(?:e|è)tres?(?:\\s*lin(?:e|é)aires?)?)";
  const fin = [];
  for (const p of out) {
    // « plafond 6 m² murs 23 m² » ou « … 6 m² et faïence 25 m² »
    const re = new RegExp("(" + QU + "(?:\\s*(?:à|a)\\s*\\d+(?:[.,]\\d+)?\\s*(?:€|euros?)(?:\\s*(?:du|le|par)\\s*\\S+)?)?)\\s*(?:,\\s*|\\s+et\\s+|\\s+)(?=[a-zà-ÿœ][^\\d]{2,40}?" + QU + ")", "gi");
    const parts = p.replace(re, "$1 ¶ ").split(" ¶ ").map(x => x.trim()).filter(Boolean);
    if (parts.length > 1) {
      const head = (parts[0].match(/^(?:la\s+|le\s+|les\s+)?(peinture|pose|d(?:e|é)pose|pon(?:c|ç)age|mise en peinture|enduit|ratissage)\b/i) || [])[1];
      parts.forEach((x, i) => fin.push(i && head && !new RegExp("^" + head, "i").test(x) && !/^(?:pose|d(?:e|é)pose|peinture)/i.test(x) ? head + " " + x : x));
    } else fin.push(p);
  }
  return fin.map(s => s.trim()).filter(s => s && !/^[,.;: ]+$/.test(s));
}


/* ---------- Dictée « parlée » (phrases longues, sans ponctuation) ---------- */
const CHAT_LEAD = /^(?:(?:alors|donc|et|bon|ok|aussi|du coup)\s+)*(?:(?:et\s+)?dans\s+ce\s+chantier\s+)?(?:j['’]ai\s+un\s+(?:devis|chantier|client)\s+(?:pour|chez|o[uù])\s+|(?:dans\s+ce\s+chantier\s+)?il\s+y\s+a\s+(?:aussi\s+)?(?:un\s+(?:petit\s+)?chantier\s+o[uù]\s+)?|un\s+petit\s+chantier\s+o[uù]\s+|j['’]ai\s+(?:aussi\s+)?(?:un\s+peu\s+de\s+)?|je\s+(?:dois|vais|veux|voudrais|compte|pense)\s+(?:aussi\s+)?|on\s+(?:doit|va)\s+|il\s+(?:faut|faudra)\s+|l['’]id[ée]e\s+c['’]est\s+(?:de\s+)?)*/i;
const CHAT_DROP = /^(?:(?:et\s+)?(?:dans|sur)\s+ce\s+chantier\s*[.,]?$|je\s+te\s+laisse|je\s+pense\s+que\s+le\s+devis|compte\s+(?:[çc]a|cela)|le\s+revenir|tu\s+peux|merci|voil[aà]|c['’]est\s+tout|et\s+voil[aà])/i;
function conversation(body) {
  const facts = { notes: [], extra: [] };
  let t = " " + body + " ";
  const sol = t.match(/surface\s+(?:au\s+sol\s+)?(?:de\s+|d['’]environ\s+)?(\d+(?:[.,]\d+)?)\s*(?:m(?:e|è)tres?\s*carr(?:e|é)s?|m\s?2|m²)/i);
  const haut = t.match(/hauteur\s+(?:sous\s+plafond\s+)?(?:de\s+|d['’]environ\s+)?(\d+(?:[.,]\d+)?)\s*(?:m(?:e|è)tres?|m)\b(?:\s*(\d{2}))?/i);
  if (sol) { facts.sol = Number(sol[1].replace(",", ".")); t = t.replace(sol[0], " "); }
  if (haut) { facts.hauteur = Number(haut[1].replace(",", ".")) + (haut[2] ? Number(haut[2]) / 100 : 0); t = t.replace(haut[0], " "); }
  const couches = t.match(/\b(\d)\s+couches?\b/i); if (couches) facts.couches = Number(couches[1]);
  // découpe sur les mots de liaison de la langue parlée
  t = t.replace(/\s+(?:donc|du coup|parce\s+qu['’]?\w*|l['’]id[ée]e\s+c['’]est|je\s+pense\s+que|il\s+y\s+a\s+aussi|et\s+il\s+y\s+a|et\s+dans\s+ce\s+chantier|dans\s+ce\s+chantier|et\s+je\s+(?=dois|vais|prends|pense|compte|mets)|et\s+(?=le|la|les)\s+[a-zà-ÿ' ]{3,40}?\s+je\s+prends|je\s+prends|j['’]ai\s+aussi|on\s+a\s+aussi)\b/gi, m => " ¶ " + m.trim() + " ");
  t = t.replace(/\s+(?:il\s+est|c['’]est)\s+(?:dans|sur|à|a)\s+paris\b[^¶]*/gi, m => { facts.paris = true; return " ¶ "; });
  return { text: t.replace(/\s*¶\s*/g, ". ").replace(/\s{2,}/g, " ").trim(), facts };
}

/* ---------- Carrelage : format, joints, type de pose ---------- */
const CARRELAGE_DEFAUT = {   // ajustements du prix de pose au m² (modifiables dans Réglages)
  formats: [{ max: 10, nom: "mosaïque", delta: 25 }, { max: 20, nom: "petit format", delta: 15 }, { max: 45, nom: "format standard", delta: 0 },
            { max: 90, nom: "grand format", delta: -5 }, { max: 999, nom: "très grand format", delta: 20 }],
  jointFin: 5, epoxy: 15, decale: 5, diagonale: 12, chevron: 25 };
const TILE_CTX = /carrel|fa(?:i|ï)ence|carreaux?|dalles?|gr(?:e|è)s|mosa(?:i|ï)que|format|plinthes?\s+carrel/i;
function extractTile(raw) {
  const t = { fmt: null, tier: null, jointFin: false, epoxy: false, pose: null, txt: raw };
  if (!TILE_CTX.test(raw)) return t;
  let r = raw;
  const fm = r.match(/(?:\b(?:au\s+|en\s+|de\s+)?format\s+(?:de\s+)?)?(?<![\d,.])(\d{1,3})\s*(?:x|×|\*|par|sur|fois)?\s*(\d{1,3})(?:\s*(?:cm|centim(?:e|è)tres?))?(?!\d|[.,]\d|\s*(?:m2|m²|m\b|m(?:e|è)tres?|ml|euros?|€|%|sacs?|kg|bo(?:i|î)tes?|cartons?|pots?))/i);
  if (fm) { const a = Number(fm[1]), b = Number(fm[2]); if (a >= 5 && b >= 5 && a <= 320 && b <= 320) { t.fmt = [a, b]; r = r.replace(fm[0], " "); } }
  if (!t.fmt && /mosa(?:i|ï)que/i.test(r)) t.tier = "mosaïque";
  else if (!t.fmt && /petits?\s+(?:carreaux|format)|\bm(?:e|é)tro\b/i.test(r)) t.tier = "petit format";
  else if (!t.fmt && /tr(?:e|è)s\s+grands?\s+formats?/i.test(r)) { t.tier = "très grand format"; r = r.replace(/(?:en\s+)?tr(?:e|è)s\s+grands?\s+formats?/i, " "); }
  else if (!t.fmt && /grands?\s+formats?/i.test(r)) { t.tier = "grand format"; r = r.replace(/(?:en\s+)?grands?\s+formats?/i, " "); }
  const jf = r.match(/(?:avec\s+(?:des\s+|un\s+)?)?joints?\s+(?:tr(?:e|è)s\s+)?(?:fins?|minces?|de\s+[12](?:[.,]5)?\s*mm)/i); if (jf) { t.jointFin = true; r = r.replace(jf[0], " "); }
  const ep = r.match(/(?:avec\s+(?:un\s+|des\s+)?)?(?:joints?\s+)?(?:e|é)poxy/i); if (ep) { t.epoxy = true; r = r.replace(ep[0], " "); }
  const po = r.match(/(?:en\s+|pose\s+)?(d(?:e|é)cal(?:e|é)e?s?|quinconce|(?:a|à)\s+(?:la\s+)?(?:mi|tiers)|diagonale|chevrons?|b(?:a|â)tons?\s+rompus|point\s+de\s+hongrie)\b/i);
  if (po) { t.pose = /diag/i.test(po[1]) ? "diagonale" : /chevron|b(?:a|â)ton|hongrie/i.test(po[1]) ? "chevron" : "decale"; r = r.replace(po[0], " "); }
  t.txt = r.replace(/\s+(?:avec|et)\s*(?=[,.;]|$)/gi, " ").replace(/\s{2,}/g, " ").trim();
  return t;
}
function tileTier(t, cfg) {
  if (t.fmt) { const big = Math.max(t.fmt[0], t.fmt[1]); return cfg.formats.find(f => big <= f.max) || cfg.formats[cfg.formats.length - 1]; }
  if (t.tier) return cfg.formats.find(f => f.nom === t.tier) || null;
  return null;
}
const FC_RE = /(?:,\s*|\s+)(?:avec\s+)?(?:(?:la|les)\s+)?(?:fournitures?|mat(?:e|é)riels?|mat(?:e|é)riaux)\s+(?:comprises|comprise|compris|incluses|incluse|inclus)\b|(?:,\s*|\s+)fourni(?:e|s|es)?\s+(?:et\s+)?pos(?:e|é)(?:e|s|es)?|(?:,\s*|\s+)avec\s+(?:la\s+|les\s+)?fournitures?(?!\s+(?:de|du|d['’]))|(?:,\s*|\s+)tout\s+compris/i;

/* ---------- Analyse complète ---------- */
function analyse(dictee, biblio, opts = {}) {
  const today = opts.today || new Date();
  const text = convertNumbers(String(dictee || "").replace(/\b([a-zà-ÿ]+)(\s+\1\b)+/gi, "$1"));
  const index = buildIndex(biblio || []);
  const { client, consumed } = extractClient(text);
  let body = text; for (const c of consumed) body = body.replace(c, " ");
  const conv = conversation(body); body = conv.text; const F = conv.facts;
  const TC = Object.assign({}, CARRELAGE_DEFAUT, opts.carrelage || {});
  const gTile = (() => { const fs = []; for (const c of splitClauses(body)) { const x = extractTile(c); if (x.fmt || x.tier) fs.push(x); } const k = new Set(fs.map(x => x.fmt ? x.fmt.join("x") : x.tier)); return k.size === 1 ? fs[0] : null; })();
  // TVA
  let tva = 10; const lt = low(text);
  if (/tva\s*(?:a|à|de)?\s*20|20\s*%\s*(?:de\s*)?tva|local (?:professionnel|commercial)|construction neuve|logement neuf|bureaux?\b/.test(lt)) tva = 20;
  if (/tva\s*(?:a|à|de)?\s*5[,.]?5|5[,.]5\s*%/.test(lt)) tva = 5.5;
  // objet explicite
  let objet = ""; const ob = text.match(/\bobjet\s*:?\s*([^.\n;]{4,90})/i); if (ob) { objet = cap(ob[1].trim()); body = body.replace(ob[0], " "); }

  const sections = []; let cur = null, fournMode = false;
  const notes = [], ignored = [];
  const getSec = titre => { let s = sections.find(x => x.titre === titre); if (!s) { s = { titre, lignes: [] }; sections.push(s); } return s; };
  let lastAction = null; const pending = splitClauses(body);
  const findBib = q => { const m = match(index, q)[0]; return m && m.score >= 0.3 ? m.b : null; };
  const fromBib = (b, extra) => Object.assign({ type: "mo", designation: b.designation, details: (b.details || []).slice(), quantite: 1, unite: b.unite, pu: b.pu ?? null,
    source: b.pu !== null && b.pu !== undefined ? "bibliotheque" : "a_saisir", biblio_id: b.id, raw: "", suggestions: [] }, extra || {});
  // frais de déplacement / stationnement repérés n'importe où dans la dictée
  const km = text.match(/(?:plus\s+de\s+|environ\s+|à\s+|a\s+)?(\d+)\s*(?:km|kilom(?:e|è)tres?)\b/i);
  if (/frais\s+(?:kilom|de\s+d(?:e|é)placement|de\s+route)|indemnit(?:e|é)s?\s+kilom/i.test(text) || km) {
    const b = findBib("frais de déplacement chantier éloigné");
    const l = b ? fromBib(b) : { type: "mo", designation: "Frais de déplacement", details: [], quantite: 1, unite: "forfait", pu: null, source: "a_saisir", biblio_id: null, raw: "", suggestions: [] };
    if (km) l.details = [`Chantier situé à ${/plus\s+de/i.test(km[0]) ? "plus de " : ""}${km[1]} km de l'entreprise`];
    getSec("Frais de chantier").lignes.push(l); F.deplacement = true;
  }
  if (F.paris) { const b = findBib("frais de stationnement paris"); if (b) getSec("Frais de chantier").lignes.push(fromBib(b, { quantite: null })); }
  let lastLine = null;
  while (pending.length) { let raw = pending.shift();
    raw = raw.replace(/^(?:devis|le devis|un devis)\b[^,.;]*$/i, "").trim(); if (!raw) continue;
    if (CHAT_DROP.test(raw) || /^parce\s+qu/i.test(raw)) continue;
    if (/frais\s+(?:kilom|de\s+d(?:e|é)placement|de\s+route)|\d+\s*(?:km|kilom)/i.test(raw) && F.deplacement) continue;
    let prendFourn = false;
    { const pf = raw.match(/\b(?:je\s+)?(?:prends?|prendre|prend)\s+(?:en\s+fournitures?\s+)?(.+)$/i) || raw.match(/\b(?:en\s+fournitures?|comme\s+fournitures?)\s+(.+)$/i);
      if (pf && !/^(?:le|la|les)?\s*(?:mesures?|temps|cotes?)\b/i.test(pf[1])) { raw = pf[1]; prendFourn = true; } }
    for (let k = 0; k < 3; k++) raw = raw.replace(CHAT_LEAD, "").replace(/^(?:que\s+|refaire\s+(?=de|la|le|les|du)|faire\s+(?=de|la|le|les|du))/i, "").trim();
    if (!raw || CHAT_DROP.test(raw)) continue;
    if (/^(?:tva|bonjour|merci|c'est tout|voil(?:a|à) c'est tout|fin)\b/i.test(raw)) continue;
    // en-tête de pièce (« Chambre : … », « Dans la salle de bains, … », « Côté cuisine »)
    const lr = low(raw);
    const rm = roomOf(raw);
    if (rm && rm.index <= 18 && (/^(?:dans|pour|cote|côté|en|au niveau de|concernant|partie)?\s*(?:la|le|les|l')?\s*$/.test(lr.slice(0, rm.index).trim()) || rm.index === 0)) {
      cur = getSec(rm.name); fournMode = false;
      raw = raw.slice(rm.index + rm.len).replace(/^\s*\d?\s*[:,-]?\s*/, "").trim();
      if (!raw) continue;
    }
    if (/^(?:les\s+)?fournitures?\b|^(?:mat(?:e|é)riel|mat(?:e|é)riaux)\s*:/i.test(raw)) {
      fournMode = true; raw = raw.replace(/^(?:les\s+)?fournitures?\s*:?\s*|^(?:mat(?:e|é)riel|mat(?:e|é)riaux)\s*:\s*/i, "").trim(); if (!raw) continue;
    }
    let fc = false; { const m = raw.match(FC_RE); if (m) { fc = true; raw = raw.replace(m[0], " ").replace(/\s{2,}/g, " ").trim(); } }
    const isFourn = prendFourn || fournMode || /^(?:fourniture|fournir|achat|acheter)\b|\bfourniture d[eu']/i.test(raw);
    if (prendFourn) raw = raw.replace(/\s*,\s*/g, " ").replace(/^(un|une|le|la)?\s*ballon\b(?!\s+d['’]eau)(?:\s+de)?/i, "ballon d'eau chaude").replace(/\s+avec\s+\d\s+couches?\b/i, "").replace(/\b(\d+)\s*l\b/gi, "$1 L");
    if (isFourn && !prendFourn && /,\s*\S/.test(raw)) {   // liste de fournitures : une ligne par article
      const items = raw.split(/,\s+(?:et\s+)?(?=\D|\d+\s+[a-zà-ÿ])/i).map(x => x.trim()).filter(Boolean);
      if (items.length > 1) { fournMode = fournMode || /^(?:fourniture|fournir|achat|acheter)/i.test(raw); pending.unshift(...items.map((x, i) => (i === 0 ? x : "fourniture " + x))); continue; }
    }
    const tile = extractTile(raw); raw = tile.txt;
    if (!isFourn && (tile.fmt || tile.tier || /carrel|fa(?:i|ï)ence|mosa(?:i|ï)que/i.test(raw)) && !tokens(raw).some(t => ACTIONS.has(t))) raw = "pose de " + raw.replace(/^(?:du|de la|des|le|la|les|en)\s+/i, "");
    let lineRoom = null; const rm2 = roomOf(raw); if (rm2 && !isFourn && rm2.name !== "WC" && rm2.name !== "Extérieur") lineRoom = rm2.name;
    const hasAction = tokens(raw).some(t => ACTIONS.has(t));
    if (!isFourn && !hasAction && lastAction && /^\s*(?:(?:les?|la|des)\s+)?(?:plafonds?|murs?|sols?|portes?|plinthes?|boiseries?|radiateurs?)\b/i.test(raw)) raw = lastAction + " " + raw;
    if (!isFourn) { const a = raw.match(/^(?:on\s+|il faut\s+)?(peinture|pose|d(?:e|é)pose|pon(?:c|ç)age|nettoyage|enduit)\b/i); if (a) lastAction = a[1]; }
    const am = parseAmounts(raw);
    let desc = am.cleaned.replace(/\s+(?:dans|pour)\s+(?:un|une|le|la|l['’])\s*(?:salon|s(?:e|é)jour|cuisine|chambre|salle\s+(?:de|d['’])\s*\S+|entr(?:e|é)e|couloir|bureau)\b/i, "").replace(/(?:\s+(?:avec|et|de|d['’]|une?|,))+\s*$/i, "").replace(/(?:\s*,\s*(?:une?|de)?)+\s*$/, "").replace(/^(?:fourniture\s+(?:de|d['’]|du|des)\s*|fournir\s+|acheter\s+)/i, "").replace(/\s*:\s*$/, "").trim();
    if (!desc || desc.length < 3) { if (am.pu !== null || am.quantite !== null) notes.push(`Montant sans description ignoré : « ${raw} »`); continue; }
    const ligne = { type: isFourn ? "fourniture" : "mo", designation: "", details: [], quantite: am.quantite, unite: am.unite, pu: null, source: "a_saisir", biblio_id: null, raw, suggestions: [] };
    if (isFourn) {
      ligne.designation = cap(desc.replace(/^\d{1,3}\s+(?=[a-zà-ÿ])/i, "").replace(/^(?:des|les|le|la|un|une|du)\s+/i, "")).replace(/\bm2\b/g, "m²");
      if (ligne.quantite === null) ligne.quantite = 1;
      if (!ligne.unite || ligne.unite === "forfait") ligne.unite = "u";
      if (am.pu !== null) { ligne.pu = am.pu; ligne.source = "dicte"; }
    } else {
      const ms = match(index, desc, am.unite);
      ligne.suggestions = ms.map(x => ({ id: x.b.id, designation: x.b.designation, pu: x.b.pu, unite: x.b.unite, score: x.score }));
      const best = ms[0];
      const strong = best && (best.score >= 0.42 || (best.score >= 0.3 && best.hits >= 2));
      if (strong) {
        ligne.designation = best.b.designation; ligne.details = (best.b.details || []).slice(); ligne.biblio_id = best.b.id;
        if (!ligne.unite) ligne.unite = best.b.unite;
        if (best.b.unite === "forfait" && ligne.quantite === null) { ligne.quantite = 1; ligne.unite = "forfait"; }
        if (am.pu !== null) { ligne.pu = am.pu; ligne.source = "dicte"; }
        else if (best.b.pu !== null && best.b.pu !== undefined) { ligne.pu = best.b.pu; ligne.source = "bibliotheque"; }
        ligne.reformule = reformulate(desc);
      } else {
        ligne.designation = reformulate(desc);
        if (am.pu !== null) { ligne.pu = am.pu; ligne.source = "dicte"; }
        if (!ligne.unite) ligne.unite = ligne.quantite === 1 ? "forfait" : "m²";
      }
    }
    if (!isFourn && ligne.quantite === null && (ligne.unite === "u" || ligne.unite === "forfait")) ligne.quantite = 1;
    const titre = isFourn ? "Fournitures" : (lineRoom && cur && lineRoom !== cur.titre && !/^(?:Salle|WC)/.test(cur.titre) ? lineRoom : (cur ? cur.titre : (lineRoom || "Travaux")));
    const sec = getSec(titre);
    if (fc && !isFourn) ligne.fournitureComprise = true;
    const fmtTxt = x => x.fmt ? `${x.fmt[0]}×${x.fmt[1]}` : "";
    if (isFourn && (tile.fmt || tile.tier) && TILE_CTX.test(ligne.designation)) {
      ligne.designation = ligne.designation.replace(/\b(carrelage|fa(?:i|ï)ence|carreaux?|dalles?|gr(?:e|è)s(?:\s+c(?:e|é)rame)?)\b/i, m => m + (tile.fmt ? " " + fmtTxt(tile) + " cm" : " " + tile.tier)).replace(/\s{2,}/g, " ");
    }
    const isPoseCarrelage = !isFourn && (/^(?:pose|mise en (?:place|œuvre))\b.*(?:carrel|fa(?:i|ï)ence|mosa)/i.test(ligne.designation) || (ligne.biblio_id && /carrelage|fa(?:i|ï)ence/i.test(ligne.designation) && /^pose/i.test(ligne.designation)));
    if (isPoseCarrelage) {
      const tx = (tile.fmt || tile.tier) ? tile : (gTile || tile);
      const tier = tileTier(tx, TC); const plus = [];
      let delta = 0;
      if (tier) { delta += Number(tier.delta) || 0; ligne.details = [`Carreaux ${tx.fmt ? fmtTxt(tx) + " cm (" + tier.nom + ")" : tier.nom}`, ...ligne.details]; }
      if (tile.jointFin || (tx === gTile && gTile && gTile.jointFin)) { delta += Number(TC.jointFin) || 0; plus.push("joints fins"); ligne.details.push("Joints fins (1 à 2 mm), carreaux rectifiés, calepinage soigné"); }
      if (tile.epoxy || (tx === gTile && gTile && gTile.epoxy)) { delta += Number(TC.epoxy) || 0; plus.push("joint époxy"); ligne.details.push("Jointoiement à la résine époxy"); }
      const pose = tile.pose || (tx === gTile && gTile && gTile.pose);
      if (pose) { delta += Number(TC[pose]) || 0; plus.push(pose === "decale" ? "pose décalée" : pose === "diagonale" ? "pose en diagonale" : "pose en chevrons"); }
      if (tier || plus.length) {
        ligne.designation = ligne.designation.replace(/,?\s*jointoiement compris/i, "") + (tx.fmt ? `, format ${fmtTxt(tx)}` : tier ? `, ${tier.nom}` : "") + (plus.length ? ", " + plus.join(", ") : "") + (/jointoiement compris/i.test(ligne.designation) ? ", jointoiement compris" : "");
        if (ligne.source === "bibliotheque" && ligne.pu !== null && delta) {
          const base = ligne.pu; ligne.pu = Math.max(0, r2(base + delta)); ligne.ajustCarrelage = delta;
          notes.push(`Carrelage ${tx.fmt ? fmtTxt(tx) : tier ? tier.nom : ""}${plus.length ? " (" + plus.join(", ") + ")" : ""} : pose à ${String(ligne.pu).replace(".", ",")} €/m² au lieu de ${String(base).replace(".", ",")} € (${delta > 0 ? "+" : ""}${String(delta).replace(".", ",")} €). Barème réglable dans Réglages.`);
        }
      }
    }
    if (!isFourn) {
      const dt = tokens(desc);
      // bavardage : ni action, ni chiffre, ni prestation reconnue → non retenu
      if (!ligne.biblio_id && am.quantite === null && am.pu === null && (!dt.some(t => ACTIONS.has(t)) || dt.length > 14)) { notes.push(`Phrase non retenue : « ${raw.slice(0, 90)}${raw.length > 90 ? "…" : ""} »`); ignored.push(raw); continue; }
      // déjà couvert par la ligne précédente (« je vais le poncer » après « ponçage et vitrification »)
      if (lastLine && am.quantite === null && am.pu === null && dt.length && dt.length <= 4 && dt.some(t => ACTIONS.has(t)) && dt.filter(t => ACTIONS.has(t)).every(t => tokens(lastLine.designation).includes(t)) && !match(index, desc).some(m => m.score >= 0.42 && m.b.id !== lastLine.biblio_id)) continue;
      // même prestation dictée deux fois sans quantité : on fusionne
      if (ligne.biblio_id && am.quantite === null && sections.some(sc => sc.lignes.some(x => x.biblio_id === ligne.biblio_id))) continue;
      // peinture d'une pièce décrite par sa surface au sol et sa hauteur
      if (F.sol && am.quantite === null && dt.includes("peintur") && !F.peintFaite) {
        const murs = Math.round(4 * Math.sqrt(F.sol) * (F.hauteur || 2.5) * 10) / 10;
        const bm = findBib("peinture des murs"), bp = findBib("peinture des plafonds");
        const ext = [];
        const nc = x => F.couches && F.couches !== 2 ? x.replace(/\b2 couches\b/g, `${F.couches} couches`) : x;
        const lm = bm ? fromBib(bm, { quantite: murs, unite: "m²", raw }) : Object.assign({}, ligne, { designation: "Peinture des murs", quantite: murs, unite: "m²" });
        const lp = bp ? fromBib(bp, { quantite: F.sol, unite: "m²", raw }) : Object.assign({}, ligne, { designation: "Peinture du plafond", quantite: F.sol, unite: "m²" });
        lm.estime = true; lm.estimeInfo = { sol: F.sol, hauteur: F.hauteur || 2.5 };
        lm.details = lm.details.concat([`Surface estimée : pièce de ${String(F.sol).replace(".", ",")} m² au sol, hauteur ${String(F.hauteur || 2.5).replace(".", ",")} m (à vérifier, ouvertures non déduites)`], ext);
        if (F.couches) lp.details = lp.details.concat(ext);
        for (const L of [lm, lp]) { L.designation = nc(L.designation); L.details = L.details.map(nc); }
        if (F.couches && F.couches > 2) notes.push(`${F.couches} couches demandées : le prix catalogue est prévu pour 2 couches, ajustez le prix au m² si besoin.`);
        sec.lignes.push(lm, lp); lastLine = lp; F.peintFaite = true;
        notes.push(`Peinture : ${String(murs).replace(".", ",")} m² de murs calculés pour une pièce carrée de ${F.sol} m² au sol et ${String(F.hauteur || 2.5).replace(".", ",")} m de hauteur. Mesurez sur place et corrigez si besoin.`);
        if (F.hauteur && F.hauteur < 2.2) notes.push(`Hauteur sous plafond de ${String(F.hauteur).replace(".", ",")} m : inhabituelle, vérifiez la dictée.`);
        continue;
      }
      // sol (parquet, carrelage, ragréage) sans quantité : surface au sol dictée
      if (F.sol && ligne.quantite === null && ligne.unite === "m²" && dt.some(t => /^(?:parquet|sol|carrel|ragreag|vitrif)/.test(t))) { ligne.quantite = F.sol; ligne.details = ligne.details.concat([`Surface au sol : ${String(F.sol).replace(".", ",")} m²`]); }
    }
    sec.lignes.push(ligne); lastLine = ligne;
  }
  // ordre : Mise en œuvre / pièces / Travaux / Fournitures
  const rank = t => t === "Fournitures" ? 2 : t === "Frais de chantier" ? 1 : 0;
  sections.sort((a, b) => rank(a.titre) - rank(b.titre));
  if (!objet) {
    const rooms = sections.map(s => s.titre).filter(t => !["Travaux", "Fournitures", "Frais de chantier"].includes(t));
    objet = rooms.length ? "Travaux de rénovation : " + rooms.slice(0, 3).map(r => r.toLowerCase()).join(", ") + (rooms.length > 3 ? "…" : "")
      : (sections[0]?.lignes[0]?.designation ? sections[0].lignes[0].designation : "Travaux de rénovation");
  }
  if (!client.nom) notes.push("Nom du client non reconnu : complétez-le.");
  if (!client.adresse) notes.push("Adresse non reconnue : complétez-la.");
  const nbSans = sections.reduce((a, s) => a + s.lignes.filter(l => l.pu === null).length, 0);
  if (nbSans) notes.push(`${nbSans} ligne(s) sans prix : à saisir (en orange).`);
  let dureeJours = null;
  const du = text.match(/(?:prendre|prend|dur(?:e|é)e|durer|dure|compter|faut|pr(?:e|é)voir|chantier\s+de)[^.¶\d]{0,40}?(\d+(?:[.,]5)?)\s*(jours?|journ(?:e|é)es?|semaines?)/i);
  if (du) { dureeJours = Number(du[1].replace(",", ".")) * (/semaine/i.test(du[2]) ? 5 : 1); notes.push(`Durée du chantier : ${String(dureeJours).replace(".", ",")} jour(s) ouvré(s), reprise dans le suivi du devis.`); }
  return { client, objet, tva, sections, notes, chantier: "", dureeJours, ignored };
}

const Moteur = { CARRELAGE_DEFAUT, analyse, reformulate, match, buildIndex, tokens, convertNumbers, parseAmounts, splitClauses, extractClient };
if (typeof module !== "undefined" && module.exports) module.exports = Moteur; else root.Moteur = Moteur;
})(typeof window !== "undefined" ? window : globalThis);
