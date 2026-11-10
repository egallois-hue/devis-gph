/* =====================================================================
   Moteur de compréhension des dictées — Gallois PH (version 2)
   100 % local, sans IA distante, sans clé : transforme une dictée parlée
   (peu ou pas de ponctuation, erreurs de transcription) en devis structuré.

   Chaîne de traitement (voir MOTEUR.md) :
     1. normalizeOral   nombres, unités, homophones, corrections orales
     2. extractClient   civilité, nom, couple, adresse, ville, tél., e-mail
     3. faits globaux   TVA, durée, déplacement, stationnement, surface au sol / hauteur
     4. segmenter       découpe en « intentions » (une prestation par segment)
     5. interprétation  ellipses (« et le plafond… »), références (« pareil pour… »),
                        retraits (« laisse tomber… »), fournitures, pièces
     6. match           appariement multi-critères au catalogue + confiance
   Aucun prix n'est jamais inventé : catalogue (main-d'œuvre) ou prix dicté.
   ===================================================================== */
(function (root) {
"use strict";

/* ---------- Outils ---------- */
const deaccent = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const low = s => deaccent(String(s || "").toLowerCase()).replace(/œ/g, "oe").replace(/æ/g, "ae");
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const fr = n => String(n).replace(".", ",");
const nb = s => Number(String(s).replace(",", "."));
const NB = "(?<![\\wà-ÿ])", NA = "(?![\\wà-ÿ])";            // limites de mot tenant compte des accents
const W = (s, f) => new RegExp(NB + "(?:" + s + ")" + NA, f || "gi");

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
const COUNT_NOUNS = "portes?|spots?|prises?|fen(?:e|ê)tres?|luminaires?|appliques?|lustres?|interrupteurs?|radiateurs?|panneaux?|poteaux?|points?|wc|lavabos?|vasques?|mitigeurs?|robinets?|bouches?|plinthes?|marches?|sacs?|bo(?:i|î)tes?|cartons?|rouleaux?|pots?|seaux?|cartouches?|bidons?|couches?|jours?|heures?|journ(?:e|é)es?|semaines?|pi(?:e|è)ces?|chambres?|(?:e|é)l(?:e|é)ments?|lots?|tasseaux?";
function convertNumbers(text) {
  let t = String(text || "").replace(W("pour\\s+cents?"), "%");
  t = t.replace(NUMWORD, (m, off, full) => {
    const n = wordsToNumber(m); if (n === null) return m;
    const lm = low(m).trim(), after = low(full.slice(off + m.length, off + m.length + 24));
    if (lm === "un" || lm === "une") {            // article : converti seulement devant une unité / un prix
      if (!/^\s*(?:metre|m2|m²|m³|m\b|ml\b|euro|€|forfait|heure|jour|lot\b|piece|unite|kilo|semaine|demi)/.test(after)) return m;
    }
    if (lm === "neuf" && !/^\s*(?:metre|m2|m²|m³|m\b|ml\b|euro|€|heure|jour|semaine|cent|mille|\d|[a-z-]+[sx]\b)/.test(after)) return m;   // « un WC neuf »
    return String(n);
  });
  t = t.replace(/(\d+)\s+virgule\s+(\d+)/gi, "$1,$2");
  t = t.replace(/(\d+)\s*(?:euros?|€)\s+(\d{1,2})\b(?!\s*(?:m\b|m2|m²|mètres?|metres?|%|x\b|fois|sacs?|u\b|unit|jours?|heures?|prises?|spots?|portes?))/gi, (m, a, b) => a + "," + b.padStart(2, "0") + " euros");
  return t;
}

/* ---------- Langue parlée : homophones et erreurs de transcription courantes ----------
   Pour en ajouter : [expression régulière, remplacement]. Les motifs s'appliquent au texte brut. */
const ORAL = [
  [W("des\\s+poses?|des\\s+pauses?|d[ée]p[oô]ts?|d[ée]\\s+poses?|d[ée]pauses?") , (m, off, s) => /^\s+(?:de|du|des|d'|compl[eè]te)/i.test(s.slice(off + m.length)) ? "dépose" : m],
  [W("pauses?|pos[ée]e?s?"), (m, off, s) => /^\s+(?:de\s|du\s|des\s|d'|d'une?\s|une?\s+\w+|et\s+raccord)/i.test(s.slice(off + m.length)) && !/fourni(?:e|s|es)?\s+(?:et\s+)?$/i.test(s.slice(0, off)) ? "pose" : m],
  [W("papiers?\\s+peints?"), "papier-peint"], [W("plaintes"), "plinthes"], [W("plainte"), "plinthe"],
  [W("toiles?\\s+de\\s+(?:vert|verts|verres|vers|ver|vair)"), "toile de verre"],
  [W("faillances?|fayences?|fa[iï]ances?|fa[iï]enses?"), "faïence"],
  [W("sales?\\s+de\\s+bains?"), "salle de bain"], [W("sales?\\s+d'eau"), "salle d'eau"],
  [W("m[uû]rs"), "murs"], [W("mûr"), "mur"],
  [W("placots?|placos|placo\\s*pl[aâ]tres?"), "placo"],
  [W("b\\.?\\s?a\\.?\\s?13|b\\s+[àa]\\s+13|b[ée]a\\s?13"), "BA13"],
  [W("w\\.?\\s?-?\\s?c\\.?|v[ée]c[ée]s?|waters?"), "WC"],
  [W("v\\.?\\s?m\\.?\\s?c\\.?"), "VMC"],
  [W("ra[ts]?\\s+gr[ée]ages?|ragr[ée]ages"), "ragréage"],
  [W("joins"), "joints"], [W("en\\s+duis|en\\s+duit|enduis"), "enduit"],
  [W("s[eè]ches?[- ]serviettes?"), "sèche-serviettes"], [W("chauffes?[- ]eaux?"), "chauffe-eau"],
  [W("laves?[- ]vaisselles?"), "lave-vaisselle"], [W("laves?[- ]linges?"), "lave-linge"], [W("laves?[- ]mains?"), "lave-mains"],
  [W("blocs?[- ]portes?"), "bloc-porte"], [W("pare[- ]baignoires?|part\\s+baignoires?"), "pare-baignoire"],
  [W("mains?[- ]d'oeuvres?|mains?\\s+d\\s+oeuvres?"), "main-d'oeuvre"],
  [W("carlages?"), "carrelage"], [W("hydro\\s+fuges?"), "hydrofuge"], [W("plus\\s+values?"), "plus-value"],
  [W("linol[ée]ums?|linos"), "lino"], [W("si\\s+fonds?\\s+de\\s+sol"), "siphon de sol"],
  [W("le\\s+re\\s?venir|le\\s+re\\s+vernir"), "le vernir"], [W("d[ée]\\s?tapiss[ée]e?s?|des\\s+tapiss(?:er|[ée])"), "détapisser"],
  [W("g[ée]b[ée]rit|j'ai\\s+b[ée]rit"), "Geberit"], [W("placo\\s+hydro"), "placo hydrofuge"],
];
const UQ = "m²|m³|ml|m|heures?|h|jours?|journ(?:é|e)es?|semaines?|€";
function normalizeOral(src) {
  const notes = [];
  let t = " " + String(src || "").replace(/[’‘`´]/g, "'").replace(/[  ]/g, " ").replace(/œ/g, "oe").replace(/Œ/g, "Oe").replace(/[«»"]/g, " ").replace(/\r/g, "") + " ";
  t = t.replace(new RegExp(NB + "([a-zà-ÿ']{2,})(?:\\s+\\1" + NA + ")+", "gi"), (m, w) => NUM[low(w)] !== undefined ? m : w);          // « une une » → « une »
  for (const [re, rep] of ORAL) t = t.replace(re, rep);
  t = convertNumbers(t);
  // unités : une seule écriture
  t = t.replace(/(\d)\s*(?:m(?:è|e)tres?|m)\s*(?:carr(?:é|e)s?|2(?![\d,.])|²)/gi, "$1 m²").replace(new RegExp(NB + "m(?:è|e)tres?\\s+carr(?:é|e)s?", "gi"), "m²")
       .replace(/(\d)\s*(?:m(?:è|e)tres?|m)\s*(?:cubes?|3(?![\d,.])|³)/gi, "$1 m³").replace(new RegExp(NB + "m(?:è|e)tres?\\s+cubes?", "gi"), "m³")
       .replace(/(\d)\s*(?:m(?:è|e)tres?|m)\s+lin(?:é|e)aires?/gi, "$1 ml").replace(new RegExp(NB + "m(?:è|e)tres?\\s+lin(?:é|e)aires?", "gi"), "ml")
       .replace(new RegExp("(\\d)\\s*m(?:è|e)tres?" + NA, "gi"), "$1 m")
       .replace(new RegExp("(\\d)\\s*(?:euros?|eur|balles)" + NA, "gi"), "$1 €").replace(/(\d)€/g, "$1 €")
       .replace(new RegExp("(\\d)\\s*(?:l|litres?)(?![\\wà-ÿ'])", "gi"), "$1 L");
  t = t.replace(new RegExp("(\\d+)\\s*(" + UQ + ")\\s+virgule\\s+(\\d+)", "gi"), "$1,$3 $2");
  // « 2 m 50 » → « 2,50 m » ; « et demi »
  t = t.replace(new RegExp("(\\d+)\\s*m\\s+(\\d{2})(?![\\d,.]|\\s*(?:m²|m³|ml|m\\b|cm|mm|€|%|L\\b|x\\b|par\\b|sur\\b|fois\\b|(?:" + COUNT_NOUNS + ")\\b))", "gi"), "$1,$2 m");
  t = t.replace(new RegExp("(\\d+)\\s*(" + UQ + "|L)\\s+et\\s+demie?" + NA, "gi"), "$1,5 $2").replace(new RegExp("(\\d+)\\s+et\\s+demie?" + NA, "gi"), "$1,5")
       .replace(new RegExp(NB + "(?:une?\\s+)?demi[- ](journ(?:é|e)e|heure)", "gi"), "0,5 $1");
  // dimensions : « 4 m de long sur 2,50 m de haut » → surface
  const DIMW = "(?:\\s+de\\s+(?:long(?:ueur)?|large(?:ur)?|haut(?:eur)?))";
  t = t.replace(new RegExp("(\\d+(?:,\\d+)?)\\s*m" + DIMW + "?\\s+(sur|par|x|fois)\\s+(\\d+(?:,\\d+)?)\\s*m(?![²³l\\w])" + DIMW + "?", "gi"), (m, a, op, b) => {
    const s = r2(nb(a) * nb(b)); notes.push(`Surface calculée : ${a} m × ${b} m = ${fr(s)} m².`); return fr(s) + " m²"; });
  t = t.replace(new RegExp("((?:fait|font|mesure|mesurent|de)\\s+)(\\d+(?:,\\d+)?)\\s*m\\s+(?:sur|par)\\s+(\\d+(?:,\\d+)?)(?![\\d,.]|\\s*(?:m²|m³|ml|m|cm|mm|€|%|" + COUNT_NOUNS + ")(?![\\wà-ÿ]))", "gi"), (m, pre, a, b) => {
    const s = r2(nb(a) * nb(b)); notes.push(`Surface calculée : ${a} m × ${b} m = ${fr(s)} m².`); return pre + fr(s) + " m²"; });
  // corrections à l'oral : « 12 m² non pardon 14 m² » → « 14 m² »
  const U2 = "(\\s*(?:" + UQ + "))?";
  t = t.replace(new RegExp("(\\d+(?:,\\d+)?)" + U2 + "\\s*,?\\s*(?:euh\\s+)?(?:non\\s+pardon|non\\s+non|pardon|non|ou\\s+plut[oô]t|plut[oô]t|je\\s+veux\\s+dire|excuse)\\s+(?:pardon\\s+|non\\s+|c'est\\s+|plut[oô]t\\s+|je\\s+voulais\\s+dire\\s+)*(\\d+(?:,\\d+)?)" + U2 + "(?!\\s*(?:" + COUNT_NOUNS + ")\\b)(?:\\s+(?:pardon|excuse[sz]?(?:[- ]moi)?))?", "gi"),
    (m, a, ua, b, ub) => { notes.push(`Correction prise en compte : ${b}${ub || ua || ""} (au lieu de ${a}${ua || ""}).`); return b + (ub || ua || ""); });
  return { text: t.replace(/\s{2,}/g, " ").trim(), notes };
}

/* ---------- Unités ---------- */
const UNIT_PATTERNS = [
  ["m²", /^(?:m(?:etres?|ètres?)?\s*carr(?:e|é)s?|m\s?2|m²|mc)(?![\wà-ÿ])/i],
  ["m³", /^(?:m(?:etres?|ètres?)?\s*cubes?|m\s?3|m³)(?![\wà-ÿ])/i],
  ["ml", /^(?:m(?:etres?|ètres?)\s*lin(?:e|é)aires?|ml|m(?:etres?|ètres?)?(?!\s*carr)(?!\s*cub))(?![\wà-ÿ²³])/i],
  ["h", /^(?:heures?|h)\b/i],
  ["jour", /^(?:jours?|journ(?:e|é)es?)\b/i],
  ["forfait", /^forfaits?\b/i],
  ["u", /^(?:unit(?:e|é)s?|pi(?:e|è)ces?|points?|u)\b/i],
];
function unitAt(s) { s = s.trim(); for (const [u, re] of UNIT_PATTERNS) { const m = s.match(re); if (m) return { u, len: m[0].length }; } return null; }

/* ---------- Vocabulaire métier ----------
   COMPOUNDS : expressions figées ramenées à un seul mot avant l'analyse.
   SYN       : forme dictée (début du mot, sans accent) → racine canonique. */
const COMPOUNDS = [
  [/\bpapiers?[- ]peints?\b|\btapisseries?\b/g, "papierpeint"], [/\btoiles? de verre\b/g, "toileverre"], [/\bpoints? lumineux\b/g, "pointlumineux"],
  [/\bfaux[- ]plafonds?\b/g, "fauxplafond"], [/\bblocs?[- ]portes?\b/g, "blocporte"], [/\bseche[- ]serviettes?\b/g, "secheserviette"],
  [/\bmachines? a laver\b|\blave[- ]linges?\b|\blave[- ]vaisselles?\b/g, "machinelaver"], [/\bchauffe[- ]eaux?\b|\bballons? d'? ?eau chaude\b|\bcumulus\b|\bballons?\b/g, "chauffeeau"],
  [/\bsalles? de bains?\b|\bsalles? d'? ?eau\b|\bsalles? de douches?\b|\bsdb\b/g, "sdb"], [/\bmise en peinture\b/g, "peinture"], [/\bmise en place\b|\bmise en oeuvre\b/g, "pose"],
  [/\bplans? de travail\b/g, "plantravail"], [/\bmeubles?[- ](?:vasques?|lavabos?)\b|\bmeubles? de salle de bains?\b|\blave[- ]mains?\b/g, "lavabo"],
  [/\bpare[- ]baignoires?\b/g, "parebaignoire"], [/\bfin de chantier\b/g, "finchantier"], [/\bmain[- ]d'? ?oeuvre\b/g, "maindoeuvre"],
  [/\btableaux? electriques?\b/g, "tableau"], [/\bdouches? (?:a l'? ?)?italiennes?\b/g, "doucheitalienne"], [/\bbacs? a douche\b|\breceveurs?(?: de douche)?\b/g, "receveur"],
  [/\bgrandes? hauteurs?\b/g, "grandehauteur"], [/\bplus[- ]values?\b/g, "plusvalue"], [/\bcages? d'? ?escaliers?\b/g, "escalier"], [/\bcoupe[- ]feu\b/g, "coupefeu"],
  [/\bbati[- ]supports?\b/g, "bati"], [/\bsiphons? de sol\b/g, "siphonsol"], [/\bparquets? flottants?\b/g, "parquet flottant"], [/\bsols? (?:souples?|pvc|vinyles?)\b/g, "vinyle"],
  [/\bfrais (?:de deplacements?|kilometriques?|de route)\b|\bindemnites? kilometriques?\b/g, "fraisdeplacement"], [/\ben regie\b|\bde regie\b/g, "regie maindoeuvre"],
  [/\bportes?[- ]fenetres?\b/g, "xportefenetre"], [/\bportes? d'? ?entree\b/g, "xporteentree"], [/\bportes?[- ]serviettes?\b/g, "xporteserviette"], [/\bvolets? roulants?\b/g, "voletroulant"],
  [/\bfenetres? de toit\b|\bvelux\b/g, "velux"], [/\bgarde[- ]corps\b/g, "gardecorps"], [/\bsous[- ]couches?\b/g, "souscouche"], [/\bchasses? d'? ?eau\b/g, "chasseeau"], [/\bpoints? d'? ?eau\b/g, "pointeau"],
  [/\bcuisines? equipees?\b|\bmeubles? de cuisine\b/g, "cuisineequipee"], [/\bplans? vasques?\b/g, "planvasque"], [/\bva[- ]et[- ]vient\b/g, "vaetvient"], [/\bparties? communes?\b/g, "partiescommunes"],
  [/\ba la place de l'? ?ancien(?:ne)?\b/g, ""], [/\bw\.?-?c\.?\b|\btoilettes?\b/g, "wc"], 
];
const STOP = new Set(("le la les l un une des du de d au aux a en et ou pour par sur sous avec dans on va il faut faire fait je nous vous y ce cet cette ces son sa ses leur leurs mon ma mes ton ta " +
  "qui que quoi est sont etre tout toute tous toutes plus aussi alors donc puis ensuite apres euh bon ben voila comme bien deja encore chaque environ lui me te se ca cela j ai c m t n s qu " +
  "font fais dois doit vais veux veut peu pres juste seulement uniquement meme niveau cote partie petit petite grand grande nouveau nouvel nouvelle ancien ancienne vieux vieille simple simples normal normale classique " +
  "entier entiere neuf neuve premier premiere deuxieme second seconde troisieme quatrieme cinquieme dernier derniere autre autres chez moi toi avoir ete tres trop assez vers entre sans hors dont ou la-bas ici travaux appartement maison logement pavillon studio immeuble habitation domicile divers diverses metro").split(" "));
const UNITWORD = new Set(["m", "m2", "m3", "ml", "h", "u", "l", "cm", "mm", "kg", "km", "ht", "ttc", "eur", "euro", "euros"]);
const SYN = {
  enlev: "depos", retir: "depos", arrach: "depos", vir: "depos", demont: "depos", deposs: "depos", decoll: "depos", detapiss: "depos papier", casse: "depos", cass: "depos", demol: "depos", abatt: "depos", supprim: "depos", oter: "depos",
  peindr: "peintur", peint: "peintur", pein: "peintur", repeindr: "peintur", repeint: "peintur", repein: "peintur", lasur: "peintur", peinturag: "peintur", laqu: "peintur", laque: "peintur", laquer: "peintur", laquee: "peintur",
  carrel: "carrelag", faienc: "carrelag", carreau: "carrelag", mosaiqu: "carrelag", gres: "carrelag",
  placo: "ba13", placoplatr: "ba13", plaqu: "ba13", ba13: "ba13",
  ponc: "poncag", vitrifi: "vitrif", vitrific: "vitrif", vernis: "vitrif", vernir: "vitrif",
  joint: "jointoi", jointoi: "jointoi",
  install: "pos", mett: "pos", met: "pos", mis: "pos", pose: "pos", pos: "pos", poser: "pos", remett: "pos", remet: "pos", repos: "pos", fix: "pos", mont: "pos", rajout: "cre", ajout: "cre",
  remplac: "remplac", chang: "remplac",
  cre: "cre", cree: "cre", crees: "cre", creon: "cre", creat: "cre", creer: "cre", realis: "cre",
  refai: "refect", refect: "refect", refair: "refect", renov: "refect",
  repar: "repar", raccord: "raccord", branch: "raccord", control: "control", verifi: "control", resserr: "control", deplac: "deplac",
  cabinet: "wc", chiott: "wc",
  lavabo: "lavabo", vasqu: "lavabo", evier: "evier",
  italien: "italien", douch: "douch",
  papierpeint: "papier", tapiss: "papier",
  nettoy: "nettoy", nettoi: "nettoy", demouss: "demouss", lessiv: "lessiv",
  dechet: "dechet", gravat: "gravat", gravoi: "gravat", gravas: "gravat", decheteri: "dechetteri", dechetteri: "dechetteri", evacu: "evacu",
  protect: "protect", proteg: "protect", bach: "protect",
  enduit: "enduit", enduir: "enduit", endui: "enduit", ratiss: "enduit", lissag: "enduit", liss: "enduit",
  fissur: "fissur", rebouch: "fissur",
  lumier: "lumin", luminair: "lumin", lustr: "lumin", appliqu: "lumin", eclairag: "lumin", plafonni: "lumin", eclair: "lumin",
  spot: "spot", prise: "pris", pris: "pris", interrupteur: "interrupt",
  ventil: "vmc", vmc: "vmc", aerat: "vmc",
  cloison: "cloison", doublage: "doublag", doublages: "doublag", doubler: "doublag", double: "double", doubles: "double", isol: "isol", travail: "maindoeuvre", boulot: "maindoeuvre",
  parquet: "parquet", stratifi: "parquet flottant", flott: "flottant", coll: "colle", massif: "colle", contrecoll: "colle",
  moquett: "moquett", lino: "vinyle", vinyl: "vinyle", pvc: "vinyle",
  porte: "port", huisseri: "port", fenetr: "fenetr", clotur: "clotur", grillag: "clotur", portail: "portillon", portillon: "portillon",
  ragre: "ragreag", ragr: "ragreag", rejointoy: "jointoi", lav: "nettoy", etanch: "etanch", hydro: "hydrofug", hydrofug: "hydrofug",
  plafond: "plafond", mur: "mur", murs: "mur", mural: "mur", murau: "mur", muret: "muret", meubl: "mobili", mobili: "mobili", radiateur: "radiateur", secheserviette: "secheserviette",
  mitigeur: "mitigeur", robinet: "mitigeur", robinetteri: "robinetteri",
  machinelaver: "machine", fibr: "fibr", box: "fibr", tableau: "tableau", disjoncteur: "tableau",
  journ: "jour", jour: "jour", heur: "heur", electr: "electr", plomb: "plomb", coffr: "coffr", habill: "habill", repris: "repris", reprend: "repris", raccords: "repris", retouch: "repris",
  occult: "occult", lame: "lame", ouvr: "ouvr", ouvert: "ouvr", ouvrir: "ouvr", plinth: "plinth", baignoir: "baignoir", paroi: "paroi", exterieur: "exterieur", suspendu: "suspendu", sol: "sol", sols: "sol",
};
function stem1(w) {
  if (!w || UNITWORD.has(w)) return "";
  if (/^\d/.test(w)) return w === "13" ? "ba13" : "";
  if (SYN[w]) return SYN[w];
  if (/ons$/.test(w) && w.length > 5) { const v = w.slice(0, -3); for (let k = Math.min(v.length, 12); k >= 3; k--) { const p = v.slice(0, k); if (SYN[p] && ACTIONS_SET.has(SYN[p].split(" ")[0])) return SYN[p]; } }      // « posons », « changeons »
  let s = w.replace(/(ements|ement|ations|ation|ages|age|ees|ee|es|er|ez|e|s|x)$/, "") || w;
  if (s.length < 3) s = w;
  for (let k = Math.min(s.length, 12); k >= 3; k--) { if (k === 3 && s.length > 3) break; const p = s.slice(0, k); if (SYN[p]) return SYN[p]; }
  return s.length < 2 ? "" : s;
}
const ACTIONS_SET = new Set(["depos", "pos", "peintur", "poncag", "remplac", "nettoy", "demouss", "protect", "enduit", "vitrif", "jointoi", "ragreag", "etanch", "cre", "refect", "repar", "raccord", "control", "deplac", "coffr", "habill", "repris", "evacu", "lessiv", "isol"]);
const ACTIONS = new Set(["depos", "pos", "peintur", "poncag", "remplac", "nettoy", "demouss", "protect", "enduit", "vitrif", "jointoi", "ragreag", "etanch", "cre", "refect", "repar", "raccord", "control", "deplac", "coffr", "habill", "repris", "evacu", "lessiv", "isol"]);
const ACT_GROUP = { pos: 1, remplac: 1, raccord: 1, cre: 1, refect: 1, depos: 2, evacu: 2, peintur: 3, poncag: 4, vitrif: 4, nettoy: 5, demouss: 5, control: 5 };
const ZONES = new Set(["mur", "plafond", "sol"]);
const actCompat = (qa, da) => {
  if (qa.includes("remplac") && !qa.includes("cre") && da.has("cre") && !da.has("remplac") && !da.has("pos")) return false;
  if (qa.includes("cre") && !qa.includes("remplac") && !qa.includes("pos") && da.has("remplac") && !da.has("cre") && !da.has("pos")) return false;
  return qa.some(a => da.has(a) || (ACT_GROUP[a] && [...da].some(b => ACT_GROUP[b] === ACT_GROUP[a]))); };
function tokens(text) {
  let l = low(text).replace(/œ/g, "oe");
  for (const [re, rep] of COMPOUNDS) l = l.replace(re, " " + rep + " ");
  const out = [];
  for (const w of l.split(/[^a-z0-9]+/)) { if (!w || STOP.has(w)) continue; const s = stem1(w); if (s) for (const x of s.split(" ")) if (!STOP.has(x)) out.push(x); }
  return out;
}

/* ---------- Pièces (sections) ---------- */
const ROOMS = [
  ["Salle de bains", /salles? (?:de|d)\s*bains?|\bsdb\b/], ["Salle de douche", /salles? (?:de|d)\s*douches?|salles? d'? ?eau/], ["WC", /\b(?:wc|toilettes?)\b/],
  ["Cuisine", /\bcuisine\b/], ["Salle à manger", /salle a manger/], ["Séjour", /\bsejour\b/], ["Salon", /\bsalon\b/],
  ["Entrée", /\bentree\b/], ["Couloir", /\b(?:couloir|degagement)\b/], ["Chambre", /\bchambres?\b/], ["Bureau", /\bbureaux?\b/],
  ["Buanderie", /\bbuanderie\b/], ["Cellier", /\bcellier\b/], ["Garage", /\bgarage\b/], ["Escalier", /\b(?:cage d'? ?)?escaliers?\b/], ["Palier", /\bpalier\b/],
  ["Balcon", /\bbalcons?\b/], ["Terrasse", /\bterrasses?\b/], ["Façade", /\bfacades?\b/], ["Jardin", /\bjardin\b/], ["Extérieur", /\bexterieur\b/],
  ["Combles", /\bcombles?\b/], ["Mezzanine", /\bmezzanine\b/], ["Dressing", /\bdressing\b/], ["Parties communes", /parties? communes?/], ["Cave", /\bcave\b/], ["Véranda", /\bveranda\b/],
];
const HUMID = new Set(["WC", "Salle de bains", "Salle de douche"]);
const ROOM_AS_OBJECT = new Set(["WC", "Escalier", "Balcon", "Extérieur", "Palier", "Façade"]);   // aussi des objets de prestation : laissés dans la recherche
const ROOM_BASE = new Map();       // « Chambre parentale » → « Chambre »
const baseOf = n => ROOM_BASE.get(n) || n;
const ROOM_QUAL = /^\s(parentale?s?|principale?s?|d'amis?|d'enfants?|des enfants|des parents|du (?:haut|bas|fond|milieu|rez[- ]de[- ]chaussee|rdc|sous[- ]sol|\d(?:er|e|eme) etage|premier etage|deuxieme etage)|de l'etage|d'en (?:haut|bas)|de (?:droite|gauche)|cote (?:rue|cour|jardin)|sur (?:rue|cour|jardin))(?![a-z])/;
const ROOM_ORD = /(?:^|\s)(premiere|deuxieme|seconde|troisieme|quatrieme|1ere|2eme|3eme|4eme|autre|petite|grande)\s$/;
const ORD_NUM = { premiere: "1", "1ere": "1", deuxieme: "2", seconde: "2", "2eme": "2", troisieme: "3", "3eme": "3", quatrieme: "4", "4eme": "4" };
function roomsIn(text) {
  const l = low(text), out = [];
  for (const [name, re] of ROOMS) { const g = new RegExp(re.source, "g"); let m; while ((m = g.exec(l))) {
    let nm = name, index = m.index, len = m[0].length;
    const num = l.slice(index + len).match(/^\s(\d)\b(?!\s*(?:m²|m\b|ml|m³|€|,|\d))/);
    if (num && name === "Chambre") { nm = name + " " + num[1]; len += num[0].length; }
    else {
      const q = l.slice(index + len).match(ROOM_QUAL), o = l.slice(0, index).match(ROOM_ORD);
      if (q) { nm = name + " " + String(text).slice(index + len + 1, index + len + q[0].length).toLowerCase(); len += q[0].length; }
      else if (o && /^(?:Chambre|Salle de bains|Salle de douche|WC|Bureau)$/.test(name)) { nm = ORD_NUM[o[1]] ? name + " " + ORD_NUM[o[1]] : (o[1] === "autre" ? "Autre " + name.toLowerCase() : cap(o[1]) + " " + name.toLowerCase()); index -= o[1].length + 1; len += o[1].length + 1; }
    }
    if (nm !== name) ROOM_BASE.set(nm, name);
    out.push({ name: nm, base: name, index, len }); } }
  return out.sort((a, b) => a.index - b.index).filter((r, i, a) => !a.some((o, j) => j !== i && o.index <= r.index && o.index + o.len >= r.index + r.len && (o.len > r.len || j < i)));
}
function roomOf(text) { return roomsIn(text)[0] || null; }

/* ---------- Reformulation professionnelle (prestations hors catalogue) ---------- */
const VERBS = [
  [/^(?:d(?:e|é)pos(?:er|e|é|ez)?|enl(?:e|è)v(?:er|e|é)|retir(?:er|e)|arrach(?:er|e)|vir(?:er|e)|d(?:e|é)mont(?:er|e)|d(?:e|é)coll(?:er|e))\b/, "Dépose"],
  [/^(?:mettre en place|mise en place|met en place)\b/, "Mise en place"],
  [/^(?:pos(?:er|e|é|ez)|install(?:er|e|é)|mettre|met|remettre)\b/, "Pose"], [/^(?:fixer|fixe)\b/, "Fixation"], [/^(?:monter|monte)\b/, "Montage"],
  [/^peinture\s+(?=blanch|satin|mat|velours|laqu|sp(?:e|é)cial|ext(?:e|é)rieur|int(?:e|é)rieur|glyc|acryl)/, "Peinture"],
  [/^(?:repeindre|repeint|peindre|peint|faire la peinture (?:de|des|du)?|peinture)\b/, "Mise en peinture"],
  [/^(?:poncer|ponce|pon(?:c|ç)age)\b/, "Ponçage"], [/^(?:reboucher|rebouche|rebouchage)\b/, "Rebouchage"],
  [/^(?:lessiver|lessive|lessivage)\b/, "Lessivage"], [/^(?:nettoyer|nettoie|laver|lave)\b/, "Nettoyage"],
  [/^(?:remplacer|remplace|changer|change)\b/, "Remplacement"], [/^(?:raccorder|raccorde|brancher|branche)\b/, "Raccordement"],
  [/^(?:cr(?:e|é)er|cr(?:e|é)e|r(?:e|é)aliser|r(?:e|é)alise|ajouter|ajoute)\b/, "Réalisation"], [/^(?:reprendre|reprend|reprise)\b/, "Reprise"],
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
  [/\bhydro\b/gi, "hydrofuge"], [/\bpapier-peint\b/gi, "papier peint"], [/\bgeberit\b/gi, "Geberit"], [/\btollens\b/gi, "Tollens"], [/\bmain-d'oeuvre\b/gi, "main-d'œuvre"],
];
const FILLER = /^(?:(?:alors|donc|ensuite|puis|apr(?:e|è)s|et|aussi|euh|bon|ben|voil(?:a|à)|ok|du coup|egalement|également)\s*,?\s*)+/i;
const SUBJ = /^(?:(?:on|il|nous|je|tu|vous)\s+(?:va|vais|allons|allez|doit|dois|devra|faut|faudra|peut|pourra)?\s*(?:falloir\s+)?|il\s+(?:y\s+a|faut|faudra)\s+(?:(?:a|à)\s+)?|y\s+a\s+|faut\s+|(?:la\s+)?pr(?:e|é)voir\s+)/i;
function articleDe(rest) {
  rest = rest.trim();
  if (!rest) return "";
  let m;
  if ((m = rest.match(/^(?:le|du)\s+/i))) return "du " + rest.slice(m[0].length);
  if ((m = rest.match(/^la\s+/i))) return "de la " + rest.slice(m[0].length);
  if ((m = rest.match(/^l'\s*/i))) return "de l'" + rest.slice(m[0].length);
  if ((m = rest.match(/^(?:les|des)\s+/i))) return "des " + rest.slice(m[0].length);
  if ((m = rest.match(/^(un|une)\s+/i))) return "d'" + m[1].toLowerCase() + " " + rest.slice(m[0].length);
  if ((m = rest.match(/^(?:de|d')\s*/i))) return rest;
  if ((m = rest.match(/^(\d+(?:,\d+)?)\s+/))) return "de " + rest;
  return (/^[aeiouyhéèêàâ]/i.test(rest) ? "d'" : "de ") + rest;
}
function reformulate(raw) {
  let t = String(raw || "").replace(/\s+/g, " ").trim().replace(/[.;:,]+$/, "");
  t = t.replace(FILLER, "").replace(SUBJ, "").replace(FILLER, "");
  for (const [re, rep] of LEX) t = t.replace(re, rep);
  // « X à poser » → « poser X »
  const post = t.match(/^(.+?)\s+(?:à|a)\s+((?:re)?(?:poser|peindre|changer|remplacer|poncer|vitrifier|nettoyer|d[ée]mousser|r[ée]parer|r[ée]gler|laquer|d[ée]poser|enlever|refaire|reboucher|raccorder|fixer|monter|lessiver)\b.*)$/i);
  if (post) t = post[2] + " " + post[1];
  const l = low(t);
  for (const [re, noun] of VERBS) {
    const m = l.match(re);
    if (m) { const rest = t.slice(m[0].length).replace(/^\s*(?:de|du|des|d')?\s*$/i, ""); if (noun === "Peinture") return cap("Peinture " + rest.trim()); return cap(noun + (rest.trim() ? " " + articleDe(rest) : "")).trim(); }
  }
  return cap(t.replace(/^(?:le|la|les|l'|du|des|de la|de l')\s*/i, ""));
}

/* ---------- Lexique parlé ----------
   Façons de dire courantes sur un chantier, rattachées aux prestations du catalogue d'origine.
   Format : identifiant → [mot de contrôle (doit figurer dans la désignation), tournures…].
   Si la prestation a été renommée ou supprimée, le mot de contrôle ne correspond plus et l'entrée est ignorée.
   Aucun prix ici : seulement du vocabulaire. Pour en ajouter, voir MOTEUR.md. */
const PARLE = {
  P001: ["protection", "protection des sols", "protection des meubles", "protéger les sols et les meubles", "bâchage", "protection du chantier", "protection et nettoyage"],
  P004: ["gravats", "évacuation des gravats", "mise en déchetterie", "aller à la déchetterie", "emmener les gravats à la déchetterie", "enlèvement des gravats", "évacuation à la déchetterie"],
  P005: ["gravats", "benne à gravats", "location de benne"],
  P006: ["nettoyage", "nettoyage de fin de chantier", "nettoyage final", "ménage de fin de chantier", "nettoyage du chantier"],
  P007: ["fournitures", "aller chercher les fournitures", "achat des fournitures", "approvisionnement du chantier"],
  P009: ["papier peint", "enlever le papier peint", "décoller le papier peint", "arracher la tapisserie", "décoller la tapisserie", "dépose de la tapisserie"],
  P010: ["carrelage", "dépose du carrelage", "enlever le carrelage", "casser le carrelage", "dépose de la faïence", "enlever la faïence", "piquer le carrelage", "piquage du carrelage", "démolition du carrelage"],
  P011: ["revêtement", "enlever la moquette", "arracher la moquette", "dépose du lino", "enlever le lino", "dépose du parquet flottant", "dépose du sol PVC", "dépose de l'ancien revêtement de sol", "dépose du stratifié", "dépose du vinyle", "dépose de la moquette"],
  P012: ["baignoire", "dépose de la baignoire", "enlever la baignoire", "dépose de la baignoire et du lavabo"],
  P013: ["sanitaires", "dépose des sanitaires", "enlever tous les sanitaires", "dépose de tous les sanitaires"],
  P014: ["wc", "dépose des toilettes", "enlever le WC", "dépose de l'ancien WC"],
  P015: ["cloison", "dépose de la cloison", "démolition de la cloison", "abattre la cloison", "casser la cloison", "dépose du placo", "dépose du doublage", "tomber la cloison"],
  P016: ["paroi", "dépose de la douche", "dépose du bac à douche", "dépose du receveur", "démolition de la douche", "dépose de la cabine de douche", "casser la douche"],
  P017: ["clôture", "dépose de la clôture", "enlever le grillage", "arracher la clôture", "dépose de l'ancienne clôture"],
  P018: ["enduit", "enduit de lissage", "ratissage des murs", "enduire les murs", "lisser les murs", "enduit sur les murs", "enduit complet"],
  P019: ["fissures", "reboucher les fissures", "traitement des fissures", "ouvrir les fissures", "reprise des fissures", "fissures à reboucher"],
  P020: ["ragréage", "ragréer le sol", "mise à niveau du sol", "ragréage autolissant", "rattraper le niveau du sol"],
  P021: ["murs", "peinture des murs", "peindre les murs", "repeindre les murs", "murs à peindre"],
  P022: ["plafonds", "peinture du plafond", "peindre le plafond", "repeindre le plafond", "plafond à peindre"],
  P023: ["mezzanine", "plus-value hauteur", "plus-value grande hauteur", "travail en grande hauteur"],
  P024: ["humide", "peinture des WC", "peinture de la salle de bain", "peinture de la salle d'eau", "repeindre les toilettes", "repeindre la salle de bain"],
  P025: ["enduit", "enduit et peinture", "enduit puis peinture satin"],
  P026: ["toile de verre", "pose de toile de verre", "toile de verre et peinture", "toile de verre à peindre", "fibre de verre à peindre"],
  P027: ["reprise", "raccord de peinture", "retouche de peinture", "reprise de peinture", "retouches de peinture"],
  P028: ["porte", "peinture d'une porte", "peindre une porte", "porte à peindre", "laquer une porte", "porte à laquer", "repeindre la porte"],
  P029: ["double", "peinture d'une double porte", "double porte à peindre", "porte double à peindre"],
  P030: ["radiateur", "peinture du radiateur", "peindre le radiateur", "radiateur à peindre", "repeindre le radiateur"],
  P031: ["plinthes", "peinture des plinthes", "peindre les plinthes", "plinthes à peindre", "repeindre les plinthes"],
  P032: ["papier", "pose de papier peint", "poser du papier peint", "pose de tapisserie", "coller le papier peint", "papier peint à poser"],
  P033: ["démoussage", "nettoyage du muret", "nettoyage du balcon", "démousser le muret", "nettoyage haute pression", "nettoyage au karcher", "démoussage de la terrasse"],
  P034: ["murets", "peinture du muret", "peindre le muret", "peinture des murets"],
  P036: ["cloison", "cloison en placo", "monter une cloison", "création d'une cloison", "cloison BA13", "faire une cloison", "cloison de séparation"],
  P037: ["hydrofuge", "placo hydrofuge", "cloison hydrofuge", "doublage hydrofuge", "placo vert", "plaques hydrofuges"],
  P038: ["collé", "placo collé", "doublage en placo collé", "plaques de plâtre collées"],
  P039: ["isolant", "isoler les murs", "doublage avec laine de verre", "doublage laine de roche", "contre-cloison isolante", "isolation par l'intérieur", "isolation des murs"],
  P040: ["faux plafond", "plafond en placo", "plafond suspendu", "faux plafond BA13", "faux plafond en placo"],
  P041: ["bandes", "bandes à joint", "bandes placo", "faire les bandes", "reprise des bandes", "bandes et enduit"],
  P042: ["conduit", "coffrage de conduit", "coffrage coupe-feu", "coffrage du conduit de cheminée"],
  P043: ["habillage", "habillage du bâti", "habillage du bâti-support", "habillage du WC suspendu", "coffrage du bâti-support", "habillage du Geberit"],
  P044: ["carrelage", "pose du carrelage", "carrelage à poser", "poser la faïence", "faïence à poser", "crédence en carrelage", "crédence carrelée", "carreler le sol", "carreler les murs", "pose de carreaux", "repose de faïence", "pose de grès cérame"],
  P045: ["format", "carrelage très grand format", "plus-value pose en diagonale"],
  P046: ["jointoiement", "reprise des joints", "refaire les joints du carrelage", "refaire les joints", "reprendre les joints", "rejointoyer", "rejointoiement", "joints à refaire", "joints du carrelage à refaire"],
  P047: ["plinthes", "plinthes carrelées", "plinthes en carrelage", "pose de plinthes en carrelage", "plinthes assorties au carrelage"],
  P048: ["carrelage", "reprise de carrelage", "remplacer quelques carreaux", "changer des carreaux cassés", "réparation du carrelage mural", "reprise de faïence", "carreaux à remplacer"],
  P049: ["vitrification", "vitrification du parquet", "vitrifier le parquet", "poncer et vitrifier", "ponçage et vitrification", "rénovation du parquet", "parquet à vitrifier", "vernir le parquet"],
  P050: ["ponçage", "ponçage du parquet", "poncer le parquet", "parquet à poncer"],
  P051: ["flottant", "pose de parquet flottant", "pose de stratifié", "poser du parquet flottant", "sol stratifié", "pose de sol stratifié", "parquet clipsable", "pose de parquet"],
  P052: ["collé", "parquet collé", "pose de parquet massif", "parquet contrecollé", "pose de parquet à coller"],
  P053: ["vinyle", "pose de sol PVC", "pose de lino", "pose de vinyle", "lames PVC", "dalles PVC", "lames vinyle clipsables", "poser du lino", "pose de sol souple"],
  P054: ["plinthes", "pose de plinthes", "plinthes en bois", "plinthes MDF", "plinthes à poser", "poser les plinthes", "plinthes assorties au parquet"],
  P055: ["plomberie", "plomberie de la salle de bain", "plomberie complète", "refaire la plomberie de la salle d'eau", "plomberie de la douche"],
  P056: ["douche", "création d'une douche italienne", "faire une douche à l'italienne", "douche de plain-pied", "douche italienne à créer"],
  P057: ["robinetterie", "pose de la robinetterie de douche", "pose du meuble vasque et de la paroi"],
  P058: ["suspendu", "pose d'un WC suspendu", "installer un WC suspendu", "remplacer le WC par un suspendu", "toilettes suspendues"],
  P059: ["wc", "remplacement du WC", "changer le WC", "changer les toilettes", "remplacer les toilettes", "pose d'un WC", "WC à changer", "toilettes à remplacer"],
  P060: ["lavabo", "pose d'un lavabo", "pose d'un meuble vasque", "installer un lavabo", "remplacement du lavabo", "changer le lavabo", "pose d'un lave-mains", "pose de la vasque"],
  P061: ["mitigeur", "changer le robinet", "remplacer le mitigeur", "changement de robinet", "remplacement de la robinetterie", "robinet à changer", "mitigeur à remplacer", "changer le mitigeur", "pose d'un mitigeur", "pose d'un robinet", "installer un robinet", "nouveau robinet"],
  P062: ["baignoire", "paroi de baignoire", "pose d'un pare-baignoire", "paroi sur la baignoire", "écran de baignoire"],
  P063: ["baignoire", "refaire les joints de la baignoire", "joints silicone de la baignoire", "refaire le joint silicone", "joints de la douche à refaire", "étanchéité de la baignoire", "refaire les joints sanitaires"],
  P064: ["receveur", "préparation pour le receveur", "scellement du receveur", "préparer le support du bac à douche"],
  P065: ["évacuation", "fuite sous la douche", "réparation de l'évacuation de la douche", "réparer la fuite de la douche", "réparation de fuite sous douche"],
  P066: ["siphon de sol", "pose d'un siphon de sol", "installer un siphon de sol", "mettre un siphon de sol"],
  P067: ["machine à laver", "raccordement du lave-linge", "brancher la machine à laver", "raccorder le lave-vaisselle", "branchement de la machine à laver", "installer la machine à laver"],
  P068: ["prise", "remplacement d'une prise", "changer une prise", "changer un interrupteur", "remplacer l'interrupteur", "prise à changer", "interrupteur à remplacer"],
  P069: ["prise", "création d'une prise", "ajouter une prise", "prise supplémentaire", "rajouter une prise", "tirer une ligne pour une prise", "créer une prise", "prise à créer", "installer une prise"],
  P070: ["point lumineux", "création d'un point lumineux", "ajouter un point lumineux", "créer un éclairage au plafond", "point lumineux avec interrupteur"],
  P071: ["luminaire", "pose d'un luminaire", "pose d'un lustre", "pose d'une applique", "installer un luminaire", "brancher un lustre", "pose d'un plafonnier", "accrocher un lustre", "raccorder une applique", "pose d'une suspension"],
  P072: ["spot", "pose de spots", "spots encastrés", "installer des spots", "spots à encastrer", "spots LED"],
  P073: ["tableau", "contrôle du tableau électrique", "vérifier le tableau", "resserrer le tableau", "vérification du tableau électrique"],
  P074: ["électricité", "électricité de la salle de bain", "électricité de la salle d'eau", "refaire l'électricité de la salle de bain"],
  P075: ["radiateur", "pose d'un sèche-serviettes", "installer un radiateur", "radiateur électrique à poser", "remplacement du sèche-serviettes", "changer le sèche-serviettes", "pose d'un convecteur", "radiateur à remplacer"],
  P076: ["fibre", "déplacer la fibre", "déplacement de la box", "déplacer la prise fibre", "déplacer l'arrivée internet"],
  P077: ["vmc", "nettoyage de la VMC", "contrôle de la VMC", "entretien de la VMC", "nettoyer les bouches de VMC", "vérifier la VMC"],
  P078: ["vmc", "pose d'une VMC", "installer une VMC", "installation d'une ventilation", "VMC simple flux", "mettre une VMC"],
  P079: ["fenêtre", "pose d'une fenêtre", "remplacement de fenêtre", "changer une fenêtre", "fenêtre à remplacer", "changer les fenêtres", "remplacer la fenêtre"],
  P080: ["bloc-porte", "pose d'un bloc-porte", "pose d'une porte intérieure", "installer une porte", "pose d'une porte", "changer la porte", "porte à poser"],
  P081: ["placard", "porte de placard coulissante", "portes de placard", "pose de portes coulissantes", "portes de placard à poser"],
  P082: ["coffrage", "coffrage en bois", "coffrage sur mesure", "cache-tuyaux en bois", "coffrage démontable", "coffrage pour cacher les tuyaux"],
  P083: ["étanchéité", "étanchéité des murs", "traitement d'un mur humide", "étanchéité intérieure", "traitement des infiltrations"],
  P084: ["étanchéité", "étanchéité sous carrelage", "étanchéité de la douche", "étanchéité de la salle de bain", "étanchéité liquide", "étanchéité avant carrelage"],
  P087: ["clôture", "pose de clôture", "pose de grillage rigide", "clôture en panneaux rigides", "poser une clôture", "installer une clôture", "pose de panneaux rigides"],
  P088: ["portillon", "pose d'un portillon", "portillon à poser", "installer un portillon"],
  P089: ["occultantes", "pose d'occultants", "occultation de la clôture", "lattes occultantes", "kit occultant", "lamelles occultantes"],
  P090: ["régie", "heures de main-d'œuvre", "heure de travail", "heures en régie", "taux horaire"],
  P091: ["journée", "journée de travail", "jour de main-d'œuvre", "journée de boulot"],
  P092: ["chauffe-eau", "remplacement du chauffe-eau", "changer le cumulus", "pose d'un chauffe-eau", "nouveau ballon d'eau chaude"],
};

/* ---------- Correspondance avec le catalogue ----------
   Chaque prestation a plusieurs « variantes » : sa désignation, chacun de ses alias, et l'ensemble.
   Le score est la meilleure ressemblance (cosinus pondéré par la rareté des mots) entre la phrase et une variante,
   corrigée par la compatibilité de l'action (poser ≠ déposer ≠ peindre) et de l'unité. */
function buildIndex(biblio) {
  const df = {};
  const docs = (biblio || []).map(b => {
    const des = String(b.designation || ""), cut = des.search(/\s[—–]\s|\(/);
    const main = tokens(cut > 0 ? des.slice(0, cut) : des), minor = cut > 0 ? tokens(des.slice(cut)) : [];
    const D = new Map(); for (const t of main) D.set(t, 1); for (const t of minor) if (!D.has(t)) D.set(t, 0.3);
    const pl = PARLE[b.id], plOk = pl && tokens(pl[0]).some(t => main.includes(t) || minor.includes(t));
    const A = (b.aliases || []).concat(plOk ? pl.slice(1) : []).map(a => { const m = new Map(); for (const t of tokens(a)) m.set(t, 1); return m; }).filter(m => m.size);
    const U = new Map(D); for (const a of A) for (const t of a.keys()) U.set(t, Math.max(U.get(t) || 0, 1)); for (const t of (b.details || []).flatMap(tokens)) if (!U.has(t)) U.set(t, 0.3);
    for (const t of U.keys()) df[t] = (df[t] || 0) + 1;
    const acts = new Set(main.filter(t => ACTIONS.has(t)));
    // « têtes » : l'objet principal de la prestation (premier nom de la désignation) et les objets cités dans les alias
    const objs = main.filter(t => !ACTIONS.has(t) && !ZONES.has(t)), heads = new Set();
    { const h = objs.find(t => !ADJ_HEAD.has(t)); if (h) heads.add(h); }
    for (const a of A) for (const t of a.keys()) if (!ACTIONS.has(t) && !ZONES.has(t) && !ADJ_HEAD.has(t)) heads.add(t);
    return { b, D, A, U, acts, heads, variant: cut > 0 };
  });
  const N = docs.length || 1;
  const idf = t => (ZONES.has(t) ? 0.6 : 1) * (df[t] ? Math.log(1 + N / df[t]) : Math.log(1 + N / 6));       // mot inconnu du catalogue : poids moyen ; mur / plafond / sol : poids réduit
  const norm = m => { let n = 0; for (const [t, w] of m) n += (w * idf(t)) ** 2; return Math.sqrt(n) || 1; };
  for (const d of docs) { d.nD = norm(d.D); d.nU = norm(d.U); d.nA = d.A.map(norm); }
  return { docs, idf, byId: new Map(docs.map(d => [d.b.id, d])) };
}
const ADJ_HEAD = new Set(["double", "partiel", "ponctuel", "complet", "faux", "grand", "petit", "nouveau", "simple", "seul", "exterieur", "interieur"]);
function cosine(index, q, qn, m, mn) { let dot = 0, hits = 0; for (const t of q) { const w = m.get(t); if (w) { dot += w * index.idf(t) ** 2; hits++; } } return { s: dot / (qn * mn), hits }; }
function matchTokens(index, q, unite, o) {
  o = o || {}; q = [...new Set(q)];
  if (!q.length) return [];
  const qn = Math.sqrt(q.reduce((a, t) => a + index.idf(t) ** 2, 0)) || 1;
  const qa = q.filter(t => ACTIONS.has(t)), qo = qa.includes("protect") ? [] : q.filter(t => !ACTIONS.has(t) && !ZONES.has(t));
  const out = [];
  for (const d of index.docs) {
    const u = cosine(index, q, qn, d.U, d.nU); if (!u.hits) continue;
    const cD = cosine(index, q, qn, d.D, d.nD).s;
    let s = Math.max(cD, 0.92 * u.s);
    d.A.forEach((a, i) => { const c = cosine(index, q, qn, a, d.nA[i]); if (c.s > s) s = c.s; });
    s += 0.04 * cD;                                                                               // à égalité, la désignation départage
    if (qa.length && d.acts.size && !actCompat(qa, d.acts)) s -= 0.6;
    else if (qa.some(a => d.acts.has(a))) s += 0.05;
    if (qa.length && !d.acts.size && qa.every(a => ACT_GROUP[a] === 2)) s -= 0.6;                 // « dépose de … » ne vise pas une prestation de pose
    if (qo.length && d.heads.size && !qo.some(t => d.heads.has(t))) s -= 0.2;                     // l'objet principal de la prestation n'est pas cité
    if (!qa.length && d.acts.size && [...d.acts].every(a => a === "depos" || a === "repris" || a === "repar" || a === "deplac" || (a === "peintur" && qo.length))) s -= 0.2;     // sans verbe, on ne suppose ni une dépose ni une peinture
    if (unite && d.b.unite === unite) s += 0.06;
    else if (unite && d.b.unite && unite !== d.b.unite && !(unite === "u" && !["m²", "ml", "m³"].includes(d.b.unite))) s -= (["m²", "ml", "m³"].includes(unite) && ["m²", "ml", "m³"].includes(d.b.unite)) ? 0.2 : (["h", "jour"].includes(unite) || ["h", "jour"].includes(d.b.unite)) ? 0.3 : 0.06;
    if (o.sansQte && d.b.unite === "m³") s -= 0.2;
    if (o.neg) for (const t of o.neg) if (d.D.has(t)) s -= 0.5;                                   // « sans vitrification »
    if (o.boost) for (const t of o.boost) if (d.U.has(t)) s += 0.12;
    const qs = new Set(q);
    let covered = d.A.some(a => [...a.keys()].every(t => qs.has(t)));
    if (!covered) { let tot = 0, got = 0; for (const [t, w] of d.D) if (w === 1) { const x = index.idf(t) ** 2; tot += x; if (qs.has(t)) got += x; } covered = tot > 0 && got / tot >= 0.5; }
    const objHit = (!qo.length || qo.some(t => d.U.has(t))) && covered;
    out.push({ b: d.b, score: r2(s), hits: u.hits, objHit });
  }
  return out.sort((a, b) => b.score - a.score || (a.b.id < b.b.id ? -1 : 1)).slice(0, 6);
}
function match(index, text, unite, o) { return matchTokens(index, tokens(text), unite, o).slice(0, 5); }
const T_OK = 0.5, T_SURE = 0.66, T_MARGE = 0.05;
function decide(ms) {       // { best, ok, sure } : accepté ? sûr ? (sinon : question ou ligne à compléter)
  const best = ms[0]; if (!best) return { best: null, ok: false, sure: false, conf: 0 };
  const ok = best.score >= T_OK && best.objHit;
  const second = ms.find(m => m.b.id !== best.b.id);
  const marge = second ? best.score - second.score : 1;
  return { best, ok, sure: ok && best.score >= T_SURE && marge >= T_MARGE, conf: Math.max(0, Math.min(1, r2(best.score))), marge: r2(marge) };
}
function learnKey(text) { return [...new Set(tokens(text))].sort().join(" "); }

/* ---------- Client ---------- */
const CP_VILLES = { "angervilliers": "91470", "limours": "91470", "forges les bains": "91470", "les molieres": "91470", "pecqueuse": "91470", "briis sous forges": "91640",
  "fontenay les briis": "91640", "janvry": "91640", "vaugrigneuse": "91640", "dourdan": "91410", "roinville": "91410", "saint cheron": "91530", "sermaise": "91530",
  "le val saint germain": "91530", "saint maurice montcouronne": "91530", "breuillet": "91650", "breux jouy": "91650", "saint yon": "91650", "egly": "91520", "arpajon": "91290",
  "ollainville": "91340", "bruyeres le chatel": "91680", "courson monteloup": "91680", "saint germain les arpajon": "91180", "bretigny sur orge": "91220",
  "marcoussis": "91460", "montlhery": "91310", "linas": "91310", "gometz la ville": "91400", "gometz le chatel": "91940", "les ulis": "91940", "orsay": "91400",
  "bures sur yvette": "91440", "gif sur yvette": "91190", "palaiseau": "91120", "massy": "91300", "saclas": "91690", "etampes": "91150", "evry": "91000",
  "evry courcouronnes": "91000", "corbeil essonnes": "91100", "saint michel sur orge": "91240", "boissy sous saint yon": "91790", "bonnelles": "78830",
  "rochefort en yvelines": "78730", "saint arnoult en yvelines": "78730", "rambouillet": "78120", "clairefontaine en yvelines": "78120", "sonchamp": "78120",
  "ablis": "78660", "chevreuse": "78460", "cernay la ville": "78720", "versailles": "78000", "boulogne billancourt": "92100", "puteaux": "92800", "cesson": "77240" };
const CIVS = [["monsieur et madame|madame et monsieur|m(?:\\.|r)? et mme|mme et m(?:\\.|r)?", "M. et Mme"], ["mesdames et messieurs", "Mesdames et Messieurs"], ["monsieur|mr|m\\.", "M."],
  ["madame|mme", "Mme"], ["mademoiselle|mlle", "Mlle"], ["(?:la |le syndic de (?:la )?)?copropri[ée]t[ée]", "Copropriété"], ["(?:le )?syndic", "Syndic"], ["(?:la )?soci[ée]t[ée]", "Société"], ["(?:l')?entreprise", "Entreprise"], ["(?:la )?sci", "SCI"]];
const CIV_ANY = CIVS.map(c => c[0]).join("|");
const STREET = "rue|avenue|av\\.?|boulevard|bd|all[ée]e|chemin|impasse|place|route|villa|passage|square|quai|cours|r[ée]sidence|sentier|hameau|lotissement|sente|ruelle|faubourg|rond-point|parvis|cit[ée]|domaine|clos|voie|mail";
const ACRO = /^(?:WC|VMC|TVA|PVC|BA13|SDB|HT|TTC|LED|MDF|IP44|EC|EF)$/;
const PARTIC = /^(?:de|du|des|la|le|les|d'|l'|en|sur|sous|aux|saint|sainte|st|ste|da|dos|di|del|van|von|ben|el)$/i;
const isCap = w => /^(?:[dl]')?[A-ZÀ-Ý]/.test(w) && !ACRO.test(w.replace(/[.,;:]+$/, ""));
function titleCase(s) { return s.toLowerCase().replace(/(^|[\s'-])([a-zàâçéèêëîïôûùüÿ])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Du|Des|La|Le|Les|Sur|Sous|En|Et|Aux|Au|L'|D'|Lès)\b/g, w => w.toLowerCase()).replace(/^./, c => c.toUpperCase()); }
function scanStreet(str) {      // str commence après le type de voie ; renvoie { len, name }
  const words = []; const re = /\s+(\S+)/y; re.lastIndex = 0; let m, names = 0, len = 0;
  const toks = []; while ((m = re.exec(str)) && toks.length < 12) toks.push({ w: m[1], end: re.lastIndex });
  const termAt = i => { const w = toks[i] && toks[i].w; if (!w) return true; return /^\d{5}[.,;]?$/.test(w) || (/^\d{2}$/.test(w) && toks[i + 1] && /^\d{3}[.,;]?$/.test(toks[i + 1].w)) || (/^(?:à|a|au|aux)$/i.test(w) && toks[i + 1] && isCap(toks[i + 1].w)); };
  for (let i = 0; i < toks.length && words.length < 7; i++) {
    const raw = toks[i].w, w = raw.replace(/[.,;:]+$/, ""), ends = raw !== w, lw = low(w);
    if (termAt(i)) break;
    const prevPart = words.length && PARTIC.test(words[words.length - 1]);
    if (lw === "paris" && names >= 1 && !prevPart) break;
    let okTok = false;
    if (PARTIC.test(w)) okTok = !!toks[i + 1] && !termAt(i + 1);
    else if (/^\d+$/.test(w)) okTok = prevPart && /^du$/i.test(words[words.length - 1]) && toks[i + 1] && /^[A-Za-zÀ-ÿ]/.test(toks[i + 1].w);     // rue du 8 Mai 1945
    else if (isCap(w)) okTok = true;
    else if (/^[a-zà-ÿ'-]+$/.test(w)) { if (names === 0) okTok = !SEG_STARTERS.has(lw) || prevPart; else { for (let j = i + 1; j <= i + 4 && j < toks.length; j++) if (termAt(j) && toks[j]) { okTok = true; break; } if (/[.,;:]$/.test(raw)) okTok = true; } }
    if (!okTok) break;
    words.push(w); if (!PARTIC.test(w)) names++; len = toks[i].end;
    if (ends) break;
  }
  while (words.length && PARTIC.test(words[words.length - 1])) words.pop();
  if (!names) return null;
  return { len, name: words.join(" ") };
}
function scanVille(str) {       // str commence au nom de la ville ; renvoie { len, name }
  const re = /\s*(\S+)/y; const toks = []; let m; while ((m = re.exec(str)) && toks.length < 7) toks.push({ w: m[1].replace(/[.,;:]+$/, ""), end: re.lastIndex, stop: /[.,;:]$/.test(m[1]) });
  if (!toks.length) return null;
  const key = n => low(toks.slice(0, n).map(t => t.w).join(" ")).replace(/[-']/g, " ").replace(/\s+/g, " ").trim();
  let best = 0;
  for (let n = Math.min(5, toks.length); n >= 1; n--) { if (CP_VILLES[key(n)] !== undefined) { best = n; break; } if (toks.slice(0, n - 1).some(t => t.stop)) continue; }
  if (!best) {
    if (!isCap(toks[0].w)) return null;
    best = 1;
    if (/^(?:Saint|Sainte|Le|La|Les|L')$/i.test(toks[0].w) && toks[1] && isCap(toks[1].w)) best = 2;
    while (!toks[best - 1].stop && toks[best] && /^(?:sur|sous|en|lès|les|le|la|de|du)$/i.test(toks[best].w) && toks[best + 1] && isCap(toks[best + 1].w) && best < 5) best += 2;
  }
  const name = toks.slice(0, best).map(t => t.w).join(" ");
  return { len: toks[best - 1].end, name, cp: CP_VILLES[key(best)] || "" };
}
const SEG_STARTERS = new Set(["on", "je", "il", "elle", "ils", "nous", "tu", "dans", "pour", "pose", "depose", "peinture", "et", "avec", "puis", "ensuite", "alors", "donc", "tel", "email", "mail", "devis", "tva", "qui", "au", "a"]);
function extractClient(text) {
  const c = { nom: "", adresse: "", cpVille: "", email: "", tel: "" }; const consumed = [];
  let s = " " + String(text || "").replace(/[’‘]/g, "'") + " ";
  const em = s.match(/(?:(?:e-?mail|mail|courriel)\s*:?\s*)?((?:[a-z0-9_-]+\s*(?:\.|point|tiret)\s*){0,3}[a-z0-9._-]+)\s*(?:@|arobase|arrobase)\s*([a-z0-9-]+)\s*(?:\.|point)\s*(fr|com|net|org|eu|io)\b/i);
  if (em) { c.email = (em[1].replace(/\s*point\s*/gi, ".").replace(/\s*tiret\s*/gi, "-").replace(/\s+/g, "") + "@" + em[2] + "." + em[3]).toLowerCase(); consumed.push(em[0]); s = s.replace(em[0], " "); }
  const tel = s.match(/(?:(?:t[ée]l(?:[ée]phone)?|portable|num[ée]ro)\s*:?\s*(?:au\s+)?)?(?<!\d)0[1-9](?:[\s.]?\d{2}){4}(?!\d)/i);
  if (tel) { c.tel = tel[0].replace(/[^\d]/g, "").replace(/(\d{2})(?=\d)/g, "$1 "); consumed.push(tel[0]); s = s.replace(tel[0], " "); }
  const capsText = /[a-zà-ÿ]\s+[A-ZÀ-Ý][a-zà-ÿ]/.test(s);       // la dictée contient des majuscules (noms propres)
  let p = 0; const rest = () => s.slice(p);
  const eat = re => { const m = rest().match(re); if (m) p += m[0].length; return m; };
  const LEAD = /^\s*(?:(?:bonjour|alors|donc|bon|ok|oui|voil[aà]|euh)[\s,]+)*(?:c'est\s+)?(?:(?:(?:pour\s+)?(?:un\s+|le\s+)?devis|pour\s+le\s+chantier|(?:un\s+)?chantier)\s*)?(?:pour|chez|de|client(?:e)?\s*:?)?\s*/i;
  const parseName = () => {
    let civ = "", m;
    for (const [re, rep] of CIVS) if ((m = eat(new RegExp("^\\s*(?:" + re + ")" + NA, "i")))) { civ = rep; break; }
    if (!civ) return null;
    const words = [];
    for (let k = 0; k < 4; k++) {
      const w = rest().match(/^\s+((?:(?:de la|de|du|des|da|dos|di|del|le|la|van|von|ben|el)\s+)?)([^\s,.;:]+)([,.;:]?)/); if (!w) break;
      const tok = w[2];
      if (/^\d/.test(tok)) break;
      const okCap = isCap(tok) && !(/^(?:Paris)$/.test(tok) && words.length && /^\s*\d/.test(rest().slice(w[0].length)));
      const okLow = !capsText && /^[a-zà-ÿ'-]{2,}$/.test(tok) && !w[1] && words.length < 2 && !SEG_STARTERS.has(low(tok)) && !new RegExp("^(?:" + STREET + ")$", "i").test(tok);
      if (!okCap && !okLow) break;
      if (civ === "Copropriété" && /^(?:du|de|des)\s*$/i.test(w[1]) && !isCap(tok)) break;
      words.push((w[1] || "") + tok); p += w[0].length;
      if (w[3]) break;
    }
    return { civ, name: words.join(" ") };
  };
  eat(LEAD);
  let nm = parseName();
  if (!nm) {
    // « devis pour Dupont 12 rue … » : nom sans civilité, seulement s'il est suivi d'une adresse
    const m = s.match(/^\s*(?:(?:bonjour|alors)[\s,]+)*(?:c'est\s+)?(?:(?:pour\s+)?(?:un\s+|le\s+)?devis\s+)?(?:pour|chez)\s+([A-ZÀ-Ý][\wà-ÿ'-]+(?:\s+[A-ZÀ-Ý][\wà-ÿ'-]+)?)(?=\s*,?\s+(?:au\s+)?\d{1,4}\s*(?:bis|ter)?\s*,?\s+(?:rue|avenue|boulevard|all[ée]e|chemin|impasse|place|route)\b)/);
    if (m && !ACRO.test(m[1])) { p = m[0].length; nm = { civ: "", name: m[1] }; } else p = 0;
  }
  const readAddr = () => {
    const m = rest().match(new RegExp("^\\s*,?\\s*(?:au\\s+|du\\s+)?(\\d{1,4}(?:\\s?(?:bis|ter))?)\\s*,?\\s+(" + STREET + ")(?=\\s)", "i")); if (!m) return false;
    const st = scanStreet(rest().slice(m[0].length)); if (!st) return false;
    c.adresse = m[1] + " " + m[2].toLowerCase() + " " + st.name.replace(/^((?:(?:de la|de l'|du|des|de|d')\s*)?)(.*)$/i, (x, a, b) => a.toLowerCase() + titleCase(b)).replace(/\s+/g, " ");
    p += m[0].length + st.len; return true;
  };
  const readVille = () => {
    let m = rest().match(/^\s*,?\s*(\d{2})\s?(\d{3})\s+(?=\S)/);
    if (m) { const v = scanVille(rest().slice(m[0].length)) || (() => { const w = rest().slice(m[0].length).match(/^([A-Za-zÀ-ÿ'-]+)/); return w ? { len: w[0].length, name: w[1] } : null; })(); if (!v) return false; c.cpVille = m[1] + m[2] + " " + titleCase(v.name); p += m[0].length + v.len; return true; }
    m = rest().match(/^\s*,?\s*(?:(?:à|a|sur)\s+)?paris(?:\s*(\d{1,2})(?:e|ème|eme|er)?(?!\d|[,.]\d|\s*(?:m²|m\b|ml|€)))?(?![\wà-ÿ-])/i);
    if (m && (m[1] || /à|a\s+paris/i.test(m[0]))) { c.cpVille = (m[1] ? "750" + String(m[1]).padStart(2, "0") + " " : "75000 ") + "Paris"; p += m[0].length; return true; }
    m = rest().match(/^\s*,?\s*(à|a|au|aux|sur)\s+(?=\S)/i); if (!m) return false;
    const v = scanVille(rest().slice(m[0].length)); if (!v) return false;
    let name = titleCase(v.name); let cp = v.cp;
    if (/^aux$/i.test(m[1])) { name = "Les " + name; cp = CP_VILLES[low("les " + v.name).replace(/[-']/g, " ")] || cp; } else if (/^au$/i.test(m[1])) { name = "Le " + name; cp = CP_VILLES[low("le " + v.name).replace(/[-']/g, " ")] || cp; }
    c.cpVille = (cp ? cp + " " : "") + name; p += m[0].length + v.len; return true;
  };
  if (nm) {
    for (let k = 0; k < 8; k++) {
      if (eat(/^\s*(?:,|qui\s+habitent?|(?:elle|il|ils|elles)\s+habitent?|habitant|domicili[ée]e?s?|demeurant|situ[ée]e?|c'est)(?![\wà-ÿ])/i)) continue;
      if (!c.adresse && readAddr()) continue;
      if (!c.cpVille && readVille()) continue;
      break;
    }
    c.nom = ((nm.civ ? nm.civ + " " : "") + (nm.name ? titleCase(nm.name).replace(/\b(Da|Dos|Di|Del|Van|Von|Ben|El)\b/g, x => x) : "")).trim();
    if (nm.civ === "Copropriété" && !nm.name && c.adresse) c.nom = "Copropriété du " + c.adresse;
    if (nm.civ && !nm.name && !c.adresse && nm.civ !== "Copropriété" && nm.civ !== "Syndic") { c.nom = ""; p = 0; }
  }
  let body = s.slice(p);
  if (p) consumed.push(s.slice(0, p).trim());
  if (!c.nom) {             // le client est cité ailleurs dans la dictée : « … c'est pour madame Durand à Limours »
    const m = body.match(new RegExp("(?:devis\\s+(?:pour|chez|de)|pour|chez|client(?:e)?\\s*:?)\\s+(" + CIV_ANY + ")\\s+((?:[A-ZÀ-Ý][\\wà-ÿ'-]*|(?:de|du|da|le|la)\\s+[A-ZÀ-Ý][\\wà-ÿ'-]*)(?:\\s+[A-ZÀ-Ý][\\wà-ÿ'-]*)?)", "i"));
    if (m && isCap(m[2].replace(/^(?:de|du|da|le|la)\s+/i, ""))) { let civ = ""; for (const [re, rep] of CIVS) if (new RegExp("^(?:" + re + ")$", "i").test(m[1])) { civ = rep; break; } c.nom = (civ + " " + titleCase(m[2])).trim(); consumed.push(m[0]); body = body.replace(m[0], " "); }
  }
  for (const which of ["adr", "ville"]) {      // adresse ou ville dictées plus loin
    if (which === "adr" && !c.adresse) { const m = body.match(new RegExp("(?:^|\\s)(?:au\\s+)?\\d{1,4}(?:\\s?(?:bis|ter))?\\s*,?\\s+(?:" + STREET + ")\\s", "i")); if (m) { const save = [s, p]; s = body; p = m.index; if (readAddr()) { if (!c.cpVille) readVille(); consumed.push(s.slice(m.index, p)); body = s.slice(0, m.index) + " " + s.slice(p); } [s, p] = save; } }
    if (which === "ville" && !c.cpVille) { const m = body.match(/(?:^|\s)(\d{2})\s?(\d{3})\s+[A-ZÀ-Ý]/); if (m && /^(?:7[5-8]|9[1-5]|2[78]|60|45)/.test(m[1])) { const save = [s, p]; s = body; p = m.index; if (readVille()) { consumed.push(s.slice(m.index, p)); body = s.slice(0, m.index) + " " + s.slice(p); } [s, p] = save; } }
  }
  return { client: c, consumed, body: body.replace(/\s{2,}/g, " ").trim() };
}

/* ---------- Extraction quantité / prix dans un segment ---------- */
function parseAmounts(t) {
  const res = { quantite: null, unite: null, pu: null, total: null, prixUnit: null };
  const s = t.replace(/(\d)\s+(\d{3})\b(?!\s*(?:x|par)\b)/g, "$1$2");
  const PR = /(\d+(?:[.,]\d+)?)\s*(?:€|euros?|eur\b|balles)(?:\s*(?:ht|hors taxes?))?(\s*(?:\/|par|du|le|la|l'|chaque|de l'|au|pour (?:le|la|l'))\s*(m(?:e|è)tres?\s*carr(?:e|é)s?|m\s?2|m²|m(?:e|è)tres?\s*lin(?:e|é)aires?|ml|m(?:e|è)tres?|m(?![\wà-ÿ²³])|unit(?:e|é)|pi(?:e|è)ces?|heures?|h\b|jours?|journ(?:e|é)es?|points?|panneaux?|portes?|spots?|prises?|sacs?|m(?:e|è)tre cube|m3|m³))?/gi;
  let m, prices = [];
  while ((m = PR.exec(s))) prices.push({ v: nb(m[1]), per: m[3] || null, idx: m.index, len: m[0].length, txt: m[0], before: s.slice(Math.max(0, m.index - 14), m.index) });
  const QR = /(\d+(?:[.,]\d+)?)\s*(m(?:e|è)tres?\s*carr(?:e|é)s?|m\s?2\b|m²|m(?:e|è)tres?\s*cubes?|m\s?3\b|m³|m(?:e|è)tres?\s*lin(?:e|é)aires?|ml\b|m(?:e|è)tres?\b|m(?![\wà-ÿ²³])|heures?\b|h\b|jours?\b|journ(?:e|é)es?\b|unit(?:e|é)s?\b|pi(?:e|è)ces?\b|points?\b(?!\s+lumineux)|forfaits?\b)/gi;
  const priceSpans = prices.map(p => [p.idx, p.idx + p.len]);
  let qs = [];
  while ((m = QR.exec(s))) { if (priceSpans.some(([a, b]) => m.index >= a && m.index < b)) continue; qs.push({ v: nb(m[1]), u: unitAt(m[2])?.u || null, idx: m.index, txt: m[0] }); }
  const FX = s.match(/(?:\bx\s*|\bfois\s+)(\d+(?:[.,]\d+)?)\b|\b(\d+(?:[.,]\d+)?)\s+fois\b/i);
  const QN = s.match(/(?<![\d,.])(\d{1,3})\s+(portes?|spots?|prises?|fen(?:e|ê)tres?|luminaires?|appliques?|lustres?|interrupteurs?|radiateurs?|panneaux?|poteaux?|points? lumineux|wc|lavabos?|vasques?|mitigeurs?|robinets?|bouches?|plinthes?|marches?|sacs?|boites?|bo(?:i|î)tes?|cartons?|rouleaux?|pots?|seaux?|cartouches?|bidons?)(?![\wà-ÿ])/i);
  const QG = !QN && s.match(/(?<![\d,.x×]\s?|\bpar\s|\bsur\s|\bformat\s|\ben\s)(\d{1,3})\s+(?!(?:euros?|€|m\b|m2|m²|ml|mm|cm|kg|L\b|x\b|par\b|sur\b|fois|%|couches?|\d))([a-zà-ÿ-]{3,})/i);
  if (qs.length) { res.quantite = qs[0].v; res.unite = qs[0].u; }
  else if (QG) { res.quantite = Number(QG[1]); res.unite = "u"; res.compte = true; }
  else if (QN) { res.quantite = Number(QN[1]); res.unite = "u"; res.compte = true; }
  else if (FX) { res.quantite = nb(FX[1] || FX[2]); res.unite = "u"; res.compte = true; }
  if (prices.length) {
    const p = prices[prices.length - 1];
    const totalHint = /(?:pour|total|en tout|l'ensemble|forfait|au forfait|soit)\s*(?:de\s*|à\s*)?$/i.test(p.before) || /forfait/i.test(s) || /^\s*\d+(?:[.,]\d+)?\s*€\s+de\s/i.test(s);
    if (p.per) { res.pu = p.v; const u = unitAt(p.per)?.u; if (u && !res.unite) res.unite = u; if (/portes?|spots?|prises?|panneaux?|sacs?/i.test(p.per)) res.unite = res.unite || "u"; }
    else if (totalHint || res.quantite === null || (res.unite === "u" && !/(?:(?:^|\s)(?:à|a)|chaque|pi(?:e|è)ce|l'unit(?:e|é))\s*$/i.test(p.before))) { res.total = p.v; }
    else res.pu = p.v;                 // « 28 m² à 38 euros » : prix unitaire
  }
  if (res.total !== null) {
    if (res.quantite && res.quantite !== 1 && res.unite && res.unite !== "forfait") { res.pu = r2(res.total / res.quantite); res.totalDicte = res.total; }
    else { res.quantite = 1; res.unite = "forfait"; res.pu = res.total; }
  }
  if (/forfait/i.test(s) && res.quantite === null) { res.quantite = 1; res.unite = "forfait"; }
  const qnTxt = (QN && QN[0]) || (QG && !qs.length && QG[0] && /^(?:sacs?|bo(?:i|î)tes?|cartons?|rouleaux?|pots?|seaux?|cartouches?|bidons?|lots?)$/i.test(QG[2]) ? QG[0].replace(/\s+\S+$/, "") + " " + QG[2] : "") || "";
  let s2 = s; if (qnTxt && /^(?:\d+\s+(?:sacs?|bo(?:i|î)tes?|cartons?|rouleaux?|pots?|seaux?|cartouches?|bidons?|lots?|panneaux?))$/i.test(qnTxt)) s2 = s.replace(qnTxt, " ");
  res.cleaned = s2.replace(PR, " ").replace(QR, " ").replace(/\b(?:x|fois)\s*\d+(?:[.,]\d+)?\b|\b\d+(?:[.,]\d+)?\s+fois\b/gi, " ")
    .replace(/(?:^|\s)(?:soit|à|a|pour|au prix de|au tarif de|ça fait|ca fait|ce qui fait|tarif|prix|total|en tout|forfait|au forfait|de|du|le|la|font|fait)\s*(?=[\s,.;]*$)/gi, " ")
    .replace(/\s+(?:soit|à|a|pour|au|font|fait)\s*(?=[,.;]|$)/gi, " ").replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").trim();
  return res;
}

/* ---------- Carrelage : format, joints, type de pose ---------- */
const CARRELAGE_DEFAUT = {   // ajustements du prix de pose au m² (modifiables dans Réglages)
  formats: [{ max: 10, nom: "mosaïque", delta: 25 }, { max: 20, nom: "petit format", delta: 15 }, { max: 45, nom: "format standard", delta: 0 },
            { max: 90, nom: "grand format", delta: -5 }, { max: 999, nom: "très grand format", delta: 20 }],
  jointFin: 5, epoxy: 15, decale: 5, diagonale: 12, chevron: 25 };
const TILE_CTX = /carrel|fa(?:i|ï)ence|carreaux?|dalles?|gr(?:e|è)s|mosa(?:i|ï)que|format|plinthes?\s+carrel/i;
function extractTile(raw, force) {
  const t = { fmt: null, tier: null, jointFin: false, epoxy: false, pose: null, txt: raw };
  if (!force && !TILE_CTX.test(raw)) return t;
  let r = raw;
  const fm = r.match(/(?:(?:au\s+|en\s+|de\s+)?format\s+(?:de\s+)?|en\s+)?(?<![\d,.])(\d{1,3})\s*(?:x|×|\*|par|sur|fois)?\s*(\d{1,3})(?:\s*(?:cm|centim(?:e|è)tres?))?(?!\d|[.,]\d|\s*(?:m2|m²|m³|m\b|m(?:e|è)tres?|ml|euros?|€|%|sacs?|kg|L\b|bo(?:i|î)tes?|cartons?|pots?|jours?|heures?))/i);
  if (fm) { const a = Number(fm[1]), b = Number(fm[2]); if (a >= 5 && b >= 5 && a <= 320 && b <= 320) { t.fmt = [a, b]; r = r.replace(fm[0], " "); } }
  if (!t.fmt && /mosa(?:i|ï)que/i.test(r)) t.tier = "mosaïque";
  else if (!t.fmt && /petits?\s+(?:carreaux|format)|(?<![\wà-ÿ])m(?:e|é)tro(?![\wà-ÿ])/i.test(r)) { t.tier = "petit format"; r = r.replace(/(?:en\s+)?petits?\s+formats?/i, " "); }
  else if (!t.fmt && /tr(?:e|è)s\s+grands?\s+formats?/i.test(r)) { t.tier = "très grand format"; r = r.replace(/(?:en\s+)?tr(?:e|è)s\s+grands?\s+formats?/i, " "); }
  else if (!t.fmt && /grands?\s+formats?/i.test(r)) { t.tier = "grand format"; r = r.replace(/(?:en\s+)?grands?\s+formats?/i, " "); }
  const jf = r.match(/(?:avec\s+(?:des\s+|un\s+)?)?joints?\s+(?:tr(?:e|è)s\s+)?(?:fins?|minces?|de\s+[12](?:[.,]5)?\s*mm)/i); if (jf) { t.jointFin = true; r = r.replace(jf[0], " "); }
  const ep = r.match(/(?:avec\s+(?:un\s+|des\s+)?)?(?:joints?\s+)?(?:e|é)poxy/i); if (ep) { t.epoxy = true; r = r.replace(ep[0], " "); }
  const po = r.match(/(?:pose\s+)?(?:en\s+)?(d(?:e|é)cal(?:e|é)e?s?|quinconce|(?:a|à)\s+(?:la\s+)?(?:mi|tiers)|diagonale|chevrons?|b(?:a|â)tons?\s+rompus|point\s+de\s+hongrie)(?![\wà-ÿ])/i);
  if (po) { t.pose = /diag/i.test(po[1]) ? "diagonale" : /chevron|b(?:a|â)ton|hongrie/i.test(po[1]) ? "chevron" : "decale"; r = r.replace(po[0], " "); }
  t.txt = r.replace(/\s+(?:avec|et|en)\s*(?=[,.;]|$)/gi, " ").replace(/\s{2,}/g, " ").trim();
  return t;
}
function tileTier(t, cfg) {
  if (t.fmt) { const big = Math.max(t.fmt[0], t.fmt[1]); return cfg.formats.find(f => big <= f.max) || cfg.formats[cfg.formats.length - 1]; }
  if (t.tier) return cfg.formats.find(f => f.nom === t.tier) || null;
  return null;
}
const FC_RE = /(?:,\s*|\s+|^)(?:avec\s+)?(?:(?:la|les)\s+)?(?:fournitures?|mat(?:e|é)riels?|mat(?:e|é)riaux)\s+(?:comprises|comprise|compris|incluses|incluse|inclus)(?![\wà-ÿ])|(?:,\s*|\s+|^)fourni(?:e|s|es)?\s+(?:et\s+)?pos(?:e|é)(?:e|s|es)?(?![\wà-ÿ])|(?:,\s*|\s+)avec\s+(?:la\s+|les\s+)?fournitures?(?!\s+(?:de|du|d'))|(?:,\s*|\s+|^)tout\s+compris/i;

/* ---------- Segmentation : une intention (prestation) par segment ----------
   La dictée parlée n'a pas de ponctuation : on coupe sur les mots de liaison, les sujets (« on », « je », « il faut »),
   après une quantité (« … 25 m² | ragréage … »), devant un nouveau mot d'action (« … | pose de … »),
   devant un nouveau décompte (« … | 3 fenêtres … »). Les liaisons « et », « avec », « plus » et la virgule donnent
   une coupure « souple » : le segment de droite peut être rattaché à celui de gauche (voir canMerge). */
const HARD_1 = new Set(["ensuite", "puis", "donc", "alors", "sinon", "mais", "apres", "parce", "car", "bonjour", "merci", "voila", "non", "finalement", "enfin", "d'abord", "premierement", "deuxiemement", "egalement"]);
const HARD_N = [["du", "coup"], ["pour", "finir"], ["pour", "terminer"], ["pour", "commencer"], ["par", "contre"], ["en", "plus"], ["autre", "chose"], ["deuxieme", "chose"], ["au", "final"], ["en", "fait"], ["tout", "d'abord"], ["ainsi", "que"], ["a", "la", "fin"], ["apres", "ca"], ["apres", "cela"], ["l'idee", "c'est"], ["c'est", "tout"], ["par", "ailleurs"]];
const SUBJECT = new Set(["on", "je", "j'ai", "j'aurai", "j'aurais", "il", "elle", "ils", "elles", "nous", "tu", "c'est", "faut", "faudra", "l'idee", "j'en", "j'y"]);
const SOFT = new Set(["et", "avec", "plus"]);
const LEADW = new Set(["faut", "faudra", "dois", "doit", "vais", "va", "veux", "veut", "voudrais", "compte", "pense", "lui", "leur", "aussi", "y", "a", "ai", "ne", "n'", "te", "me", "se", "en", "que", "refais", "fais"]);
const GOVERN = new Set(["de", "d'", "du", "des", "en", "a", "pour", "sans", "par", "sur", "sous", "dans", "au", "aux", "le", "la", "les", "l'", "un", "une", "d'un", "d'une", "que", "qu'", "chez", "ou", "son", "sa", "ses", "mon", "ma", "mes", "ce", "cette", "ces", "leur", "leurs", "tout", "toute", "tous", "toutes", "juste", "seulement", "petit", "petite", "grand", "grande", "nouveau", "nouvelle", "ancien", "ancienne", "lui", "leur", "y", "en", "bien", "aussi", "comme", "fourniture", "fournitures", "prends", "prend", "prendre", "pris", "meme"]);
const ACT_WORD = /^(?:d[ée]pos(?:e|er|é|ée|és|ées|ons|ez)?|enl[eè]v\w*|retir\w*|arrach\w*|pos(?:e|er|é|ée|és|ées|ons|ez)|install\w*|mettre|mets?|remettre|remet|peindre|peint|peinture|repeindre|repeint|ponc\w*|pon[cç]age|rebouch\w*|lessiv\w*|nettoy\w*|nettoie|d[ée]mouss\w*|remplac\w*|chang(?:e|er|é|ement|ements|eons)|raccord(?:e|er|é|ement|ements)|cr[ée]er|cr[ée]e|cr[ée]ation|r[ée]alis\w*|repr(?:endre|end|ise|ises)|vitrifi\w*|carreler|carrell?e|carrel[ée]|endui(?:re|t|ts|s)|ratiss\w*|isol(?:er|e|é|ation)|d[ée]mol\w*|cass(?:e|er|é|ons)|[ée]vacu\w*|prot[ée]g\w*|prot[eè]ge|protection|contr[oô]l\w*|v[ée]rifi\w*|r[ée]par\w*|d[ée]plac\w*|scell\w*|ragr[ée]\w*|perc(?:e|er|é)|habill\w*|coffr\w*|doubl(?:age|er)|d[ée]tapiss\w*|refai(?:re|s|t)|r[ée]fection|fix(?:e|er|é|ation)|mont(?:e|er|é|age)|ajout\w*|rajout\w*|r[ée]gl(?:e|er|é|age)|laqu(?:e|er|é)|[ée]tanch[ée]it[ée]|[ée]lectricit[ée]|plomberie|ouv(?:rir|erture)|pr[ée]par(?:er|e|é|ation)|d[ée]molition|r[ée]novation|fissures?|ragr[ée]age|d[ée]tapisser)$/i;
const NOM_METIER = /^(?:carrelage|fa[iï]ence)$/i;       // ouvre une prestation seulement après un élément déjà complet (« un sèche-serviettes | carrelage au sol »)
const isNumTok = t => /^\d+(?:[.,]\d+)?$/.test(t.l);
const UNIT_TOK = new Set(["m²", "m³", "ml", "m", "h", "heure", "heures", "jour", "jours", "journee", "journees", "semaine", "semaines", "forfait", "forfaits", "sac", "sacs", "pot", "pots", "boite", "boites", "carton", "cartons", "rouleau", "rouleaux", "seau", "seaux", "cartouche", "cartouches", "bidon", "bidons", "panneau", "panneaux", "lot", "lots"]);
const SPEC_TOK = new Set(["l", "cm", "mm", "kg", "km", "w", "watts", "%", "couches", "couche"]);
function lex(body) {
  const out = [];
  for (const m of String(body || "").matchAll(/\S+/g)) {
    let w = m[0], hard = false, soft = false;
    const pm = w.match(/[.;:!?,]+$/);
    if (pm && !/^\d+[.,]\d+$/.test(w)) { hard = /[.;:!?]/.test(pm[0]); soft = !hard; w = w.slice(0, -pm[0].length); }
    if (!w) { if (out.length) { out[out.length - 1].hard = out[out.length - 1].hard || hard; out[out.length - 1].soft = out[out.length - 1].soft || soft; } continue; }
    out.push({ w, l: low(w), hard, soft });
  }
  // « chambre 1 » : numéro de pièce collé au mot
  for (let i = 0; i < out.length - 1; i++) if (/^chambres?$/.test(out[i].l) && /^[1-9]$/.test(out[i + 1].l) && !(out[i + 2] && (UNIT_TOK.has(out[i + 2].l) || out[i + 2].l === "€"))) { out[i].w += " " + out[i + 1].w; out[i].l += " " + out[i + 1].l; out[i].hard = out[i + 1].hard; out[i].soft = out[i + 1].soft; out.splice(i + 1, 1); }
  return out;
}
function segmenter(body) {
  const T = lex(body), segs = [];
  let cur = [], lead = "hard", fournNext = false, pend = false, postInf = false;
  const flush = next => { if (cur.length) { segs.push({ raw: cur.map(t => t.w).join(" "), lead, fournCue: fournNext }); fournNext = false; } cur = []; lead = cur.length ? lead : (segs.length && !next ? lead : next || lead); lead = next || lead; pend = false; postInf = false; };
  const L = i => (T[i] ? T[i].l : "");
  const seq = (i, arr) => arr.every((w, k) => L(i + k) === w);
  const isCountStart = i => (isNumTok(T[i]) || /^une?$/.test(L(i))) && T[i + 1] && /^(?:[a-zà-ÿ'-]{3,}|wc)$/.test(T[i + 1].l) && !UNIT_TOK.has(L(i + 1)) && !SPEC_TOK.has(L(i + 1)) && !isNumTok(T[i + 1]) && L(i + 1) !== "par" && L(i + 1) !== "sur" && L(i + 1) !== "fois";
  const priceAt = i => {       // (à|pour|soit)? N € (ht)? ((du|le|par|au|la|l') unité)?
    let j = i; if (/^(?:a|pour|soit)$/.test(L(j)) && isNumTok(T[j + 1] || { l: "" }) && L(j + 2) === "€") j++;
    if (!(T[j] && isNumTok(T[j]) && L(j + 1) === "€")) return 0;
    j += 2; if (/^(?:ht|ttc)$/.test(L(j))) j++;
    if (/^(?:du|le|la|par|au|l'unite|l'heure|chaque|\/)$/.test(L(j)) && /^(?:m²|m³|ml|m|metre|unite|piece|heure|jour|journee|panneau|sac|porte|prise|spot|point)$/.test(L(j + 1))) j += 2;
    else if (/^(?:l'unite|l'heure|piece)$/.test(L(j))) j++;
    return j - i;
  };
  const trailAt = i => {       // compléments qui restent attachés à la quantité qui précède
    let n;
    if ((n = priceAt(i))) return n;
    const a = L(i), b = L(i + 1), c = L(i + 2);
    if (/^(?:ht|ttc|environ|seulement|uniquement)$/.test(a)) return 1;
    if (a === "en" && b === "tout" || a === "au" && b === "total") return 2;
    if (/^(?:en|au|de)$/.test(a) && b === "format") return 1;
    if (a === "format" || (a === "en" && isNumTok(T[i + 1] || { l: "" }) && isNumTok(T[i + 2] || { l: "" }))) return 1;
    if (isNumTok(T[i]) && T[i + 1] && (isNumTok(T[i + 1]) || (/^(?:x|par|sur)$/.test(b) && isNumTok(T[i + 2] || { l: "" })))) return isNumTok(T[i + 1]) ? 2 : 3;      // 60 60, 60 x 60
    if (a === "cm") return 1;
    if (/^(?:grands?|petits?)$/.test(a) && /^formats?$/.test(b)) return 2;
    if (a === "tres" && /^grands?$/.test(b) && /^formats?$/.test(c)) return 3;
    if (a === "pose" && b === "en") return 3;
    if (/^(?:pose|main-d'oeuvre)$/.test(a) && /^(?:seule|seulement|uniquement)$/.test(b)) return 2;
    if (a === "pose" && /^(?:diagonale|decalee|droite|chevrons?|quinconce)$/.test(b)) return 2;
    if (a === "en" && /^(?:diagonale|decale|decalee|chevrons?|quinconce|epoxy)$/.test(b)) return 2;
    if (/^joints?$/.test(a) && /^(?:fins?|epoxy|minces?)$/.test(b)) return 2;
    if (/^joints?$/.test(a) && b === "tres" && /^fins?$/.test(c)) return 3;
    if (a === "avec" && /^joints?$/.test(b)) return 1;
    if (a === "avec" && /^(?:des|un|du)$/.test(b) && /^joints?$/.test(c)) return 2;
    if (a === "epoxy") return 1;
    if (/^fournie?s?$/.test(a) && (/^pose/.test(b) || (b === "et" && /^pose/.test(c)))) return b === "et" ? 3 : 2;
    if (/^(?:fournitures?|materiaux|materiel)$/.test(a) && /^(?:comprise?s?|incluse?s?|inclus)$/.test(b)) return 2;
    if (a === "tout" && b === "compris") return 2;
    if (/^(?:hors|sans|avec)$/.test(a) && /^(?:fournitures?)$/.test(b)) return 2;
    if (/^(?:hors|sans|avec)$/.test(a) && /^(?:la|les)$/.test(b) && /^fournitures?$/.test(c)) return 3;
    if (a === "sans") return /^(?:le|la|les|l'|de|du|des|d')$/.test(b) ? 3 : 2;
    if (isNumTok(T[i]) && /^couches?$/.test(b)) return 2;
    if (/^(?:en|avec)$/.test(a) && isNumTok(T[i + 1] || { l: "" }) && /^couches?$/.test(c)) return 3;
    if (a === "au" && /^(?:sol|mur|plafond)$/.test(b)) return 2;
    if (a === "aux" && b === "murs") return 2;
    if (a === "sur" && /^(?:le|les)$/.test(b) && /^(?:sols?|murs?|plafonds?)$/.test(c)) return 3;
    if (/^[a-zà-ÿ'-]+$/.test(a) && /^comprise?s?$/.test(b) && !SOFT.has(a)) return 2;                 // « bandes comprises »
    if (a === "dans" && /^(?:le|la|les|l'entree|l'escalier)$/.test(b)) { const r = roomOf(T.slice(i, i + 6).map(t => t.l).join(" ")); if (r && r.index <= 12) { let k = i + 1, pos = L(i).length + 1; while (T[k] && pos < r.index + r.len) { pos += L(k).length + 1; k++; } if (/^(?:pareil|idem|meme)$/.test(L(k)) || (L(k) === "la" && L(k + 1) === "meme")) return 0; return k - i; } }
    if (a === "en" && T[i + 1] && !isNumTok(T[i + 1]) && !/^fournitures?$/.test(b) && b !== "plus" && b !== "fait") { let k = i + 1; while (T[k] && k < i + 4 && !SOFT.has(L(k)) && !HARD_1.has(L(k)) && !SUBJECT.has(L(k)) && !isNumTok(T[k]) && !(k > i + 1 && ACT_WORD.test(L(k))) && !/^une?$/.test(L(k))) { k++; if (T[k - 1].hard || T[k - 1].soft) break; } return k - i; }
    return 0;
  };
  const fmtNb = k => T[k] && /^\d{1,3}$/.test(T[k].l) && +T[k].l >= 5 && +T[k].l <= 320;
  const tileTrailAt = i => {     // « 60 60 », « 60 par 60 », « en 30 60 », « avec joint fin », « joints époxy »
    const a = L(i), b = L(i + 1), c = L(i + 2);
    if (fmtNb(i) && fmtNb(i + 1) && !UNIT_TOK.has(L(i + 2)) && L(i + 2) !== "€") return 2;
    if (fmtNb(i) && /^(?:x|par|sur)$/.test(b) && fmtNb(i + 2) && !UNIT_TOK.has(L(i + 3)) && L(i + 3) !== "€") return 3;
    if (/^(?:en|format)$/.test(a) && fmtNb(i + 1) && (fmtNb(i + 2) || (/^(?:x|par|sur)$/.test(c) && fmtNb(i + 3)))) return 1;
    if (/^(?:en|au|de)$/.test(a) && b === "format" && fmtNb(i + 2)) return 2;
    if (a === "avec" && /^joints?$/.test(b)) return 1;
    if (a === "avec" && /^(?:des|un|du|le|les)$/.test(b) && /^joints?$/.test(c)) return 2;
    if (/^joints?$/.test(a) && /^(?:fins?|epoxy|minces?)$/.test(b)) return 2;
    if (/^joints?$/.test(a) && b === "tres" && /^fins?$/.test(c)) return 3;
    return 0; };
  for (let i = 0; i < T.length; i++) {
    const t = T[i], l = t.l;
    if (!pend && cur.length && cur.some(x => /^(?:carrelages?|fa[iï]ences?|carreaux|dalles?|mosa[iï]ques?)$/.test(x.l))) { const n = tileTrailAt(i); if (n) { for (let j = 0; j < n; j++) cur.push(T[i + j]); const last = T[i + n - 1]; i += n - 1; if (last.hard) flush("hard"); else if (last.soft) flush("soft"); continue; } }
    const push = k => { for (let j = 0; j < k; j++) { cur.push(T[i + j]); } const last = T[i + k - 1]; i += k - 1; if (last.hard) flush("hard"); else if (last.soft) flush("soft"); };
    const prev = cur.length ? cur[cur.length - 1].l : null;
    const onlyLead = cur.length > 0 && cur.every(x => SUBJECT.has(x.l) || LEADW.has(x.l));
    // faits (surface au sol, hauteur) : restent dans le segment courant
    if (/^⟦/.test(t.w)) { if (pend) flush("juxt"); push(1); continue; }
    // « en fourniture … », « fournitures : … »
    if ((l === "en" || l === "comme" || l === "cote") && /^fournitures?$/.test(L(i + 1)) && !/^(?:comprise?s?|incluse?s?)$/.test(L(i + 2))) { flush("hard"); fournNext = true; i++; if (T[i].hard || T[i].soft) lead = "hard"; continue; }
    if (/^(?:fournitures?|materiaux|materiel)$/.test(l) && !/^(?:comprise?s?|incluse?s?|inclus)$/.test(L(i + 1)) && !(prev && /^(?:la|les|des|de|sans|hors|avec|en)$/.test(prev)) && (t.hard || !/^(?:de|du|des|d'|d'une?)$/.test(L(i + 1)))) { flush("hard"); fournNext = true; continue; }
    // liaisons fortes
    if (l === "en" && L(i + 1) === "plus" && cur.some(x => isNumTok(x) || /^une?$/.test(x.l)) && !pend) { cur.push(t, T[i + 1]); i++; if (T[i].hard) flush("hard"); else if (T[i].soft) flush("soft"); continue; }
    const hn = HARD_N.find(a => seq(i, a));
    if (hn) { flush("hard"); if (hn[0] === "du" && segs.length) segs[segs.length - 1].intro = true; const last = T[i + hn.length - 1]; if (hn[0] === "en" && hn[1] === "fait" || hn[0] === "l'idee") { cur.push(...T.slice(i, i + hn.length)); } i += hn.length - 1; continue; }
    if (HARD_1.has(l) && !(l === "apres" && cur.length === 0)) { flush("hard"); if (l === "donc" && segs.length) segs[segs.length - 1].intro = true; if (l === "non" || l === "finalement" || l === "parce") cur.push(t); continue; }
    if (SUBJECT.has(l) && !(prev && /^(?:que|qu'|si|quand|ou|dont|et)$/.test(prev) && false)) {
      if (!onlyLead) flush("hard");
      cur.push(t); if (t.hard) flush("hard"); else if (t.soft) flush("soft"); continue;
    }
    if (l === "y" && L(i + 1) === "a" && prev !== "il" && prev !== "qu'il") { flush("hard"); cur.push(t); continue; }
    if (/^(?:pareil|idem)$/.test(l)) { if (cur.length && roomOf(cur.map(x => x.l).join(" "))) { cur.push(t); flush("hard"); } else { flush("hard"); cur.push(t); } continue; }
    // liaisons souples
    if (SOFT.has(l)) {
      if (l === "plus" && (L(i + 1) === "de" && isNumTok(T[i + 2] || { l: "" }) || (prev && /^(?:en|de|non|peu)$/.test(prev)))) { cur.push(t); continue; }
      if (l === "et" && /^(?:monsieur|madame)$/.test(L(i + 1)) && prev && /^(?:monsieur|madame)$/.test(prev)) { cur.push(t); continue; }
      const tr = pend ? 0 : 0;
      flush("soft:" + l); continue;
    }
    // quantité + unité
    if (isNumTok(t) && T[i + 1] && (UNIT_TOK.has(L(i + 1)))) {
      const qFirst = /^(?:de|d'|d'une?)$/.test(L(i + 2)) || /^d'/.test(L(i + 2));
      if (qFirst) {
        if (pend || (cur.length && !(GOVERN.has(prev) || (ACT_WORD.test(prev) && !postInf)))) flush("juxt");
        push(2); continue;
      }
      if (pend || cur.some((x, k) => isNumTok(x) && cur[k + 1] && /^(?:m²|m³|ml|m)$/.test(cur[k + 1].l))) { flush("juxt"); }
      const atStart = cur.length === 0 && !/^(?:m²|m³|ml|m|h|heures?|jours?|journees?|semaines?)$/.test(L(i + 1));
      push(2); if (!cur.length || atStart) continue;
      let n; while (T[i + 1] && (n = trailAt(i + 1))) { i++; push(n); if (!cur.length) break; }
      if (cur.length) pend = true;
      continue;
    }
    if (pend) {
      let n = trailAt(i);
      if (n) { push(n); if (cur.length) pend = true; continue; }
      flush("juxt");
    }
    // prix seul après une désignation (« … pour 120 € ») : reste dans le segment, puis coupure
    { const n = priceAt(i); if (n && cur.length) { push(n); if (cur.length) pend = true; continue; } }
    // nouveau décompte : « … | 3 fenêtres », « … | un radiateur »
    if (cur.length && !onlyLead && isCountStart(i) && !(GOVERN.has(prev) || (ACT_WORD.test(prev) && !postInf) || isNumTok(cur[cur.length - 1]) || /^chambres?/.test(prev))) flush("juxt");
    if (cur.length && /^[A-ZÀ-Ý][a-zà-ÿ]/.test(t.w) && (ACT_WORD.test(l) || NOM_METIER.test(l) || /^(?:la|le|les|un|une|peinture|parquet|plinthes?|cloison|debut|duree)$/.test(l)) && !isNumTok(cur[cur.length - 1]) && !pend) flush("juxt");
    if (NOM_METIER.test(l) && cur.length >= 2 && !GOVERN.has(prev) && !/^(?:l'|d')/.test(prev) && cur.some((x, k) => (isNumTok(x) || /^une?$/.test(x.l)) && cur[k + 1] && !UNIT_TOK.has(cur[k + 1].l))) flush("juxt");
    // nouveau mot d'action
    if (ACT_WORD.test(l)) {
      const inf = prev === "a" || prev === "à";
      if (cur.length && !inf && !onlyLead && !GOVERN.has(prev) && !(l === "pose" && /^(?:en|diagonale|decalee|droite)$/.test(L(i + 1))) && !(/^(?:fissures?)$/.test(l) && ACT_WORD.test(prev))) flush("juxt");
      postInf = inf || (postInf && prev === null);
      cur.push(t); if (inf) postInf = true; if (t.hard) flush("hard"); else if (t.soft) flush("soft"); continue;
    }
    if (cur.length >= 3 && /^[a-zà-ÿ-]{5,}$/.test(l) && !GOVERN.has(l) && !UNIT_TOK.has(l) && !/^(?:murs?|plafonds?|sols?|pareil|idem|parentale?s?|principale?s?|fournie?s?|compris|comprise?s?|existante?s?|complete?s?|entiere?s?|seule?s?|seulement|uniquement)$/.test(l) && !isNumTok(t)) {
      const fin = cur.slice(-4).map(x => x.l).join(" "), r = roomsIn(fin).pop();
      if (r && r.index + r.len === fin.length && !ROOM_AS_OBJECT.has(r.base) && cur.some(x => ACT_WORD.test(x.l)) && !/^(?:dans|pour|chez)$/.test(cur[0].l)) flush("juxt"); }
    if (/^(?:le|la|les)$/.test(l) && cur.length >= 2 && prev && !GOVERN.has(prev) && !ACT_WORD.test(prev) && !SUBJECT.has(prev) && !LEADW.has(prev) && !/^(?:long|meme|plus|moins|tout|toute)$/.test(L(i + 1)) && T[i + 1]
        && cur.some((x, k) => (isNumTok(x) || /^une?$/.test(x.l)) && cur[k + 1] && !UNIT_TOK.has(cur[k + 1].l))) flush("juxt");
    push(1);
  }
  flush("hard");
  return segs;
}
function splitClauses(text) { return segmenter(normalizeOral(text).text).map(s => s.raw); }

/* ---------- Bavardage et tournures de la langue parlée ---------- */
const CHAT_LEAD = /^(?:(?:alors|donc|et|bon|ok|aussi|du coup|ensuite)\s+)*(?:(?:et\s+)?dans\s+ce\s+chantier\s+)?(?:j'ai\s+un\s+(?:devis|chantier|client)\s+(?:pour|chez|o[uù])\s+|c'est\s+pour\s+un\s+devis\s*|(?:dans\s+ce\s+chantier\s+)?il\s+y\s+a\s+(?:aussi\s+)?(?:un\s+(?:petit\s+)?chantier\s+o[uù]\s+)?|(?:il\s+)?y\s+en\s+a\s+(?:pour\s+)?|(?:elle|il|ils|elles|qui)\s+(?:fait|font|mesure|mesurent)\s+(?=\d)|[çc]a\s+(?:fait|repr[ée]sente)\s+|ce\s+qui\s+fait\s+|y\s+a\s+(?:aussi\s+)?|un\s+petit\s+chantier\s+o[uù]\s+|j'ai\s+(?:aussi\s+)?(?:un\s+peu\s+de\s+)?|je\s+(?:lui\s+|leur\s+)?(?:dois|vais|veux|voudrais|compte|pense|fais)\s+(?:aussi\s+)?(?:lui\s+|leur\s+)?|je\s+(?=\w+[e]\b|refais|mets|prends|repeins|peins)(?!prends|te\b|pense|compte\s+\d)|on\s+(?:doit|va|a|aura)\s+(?:aussi\s+)?|on\s+|nous\s+|il\s+(?:faut|faudra)\s+(?:aussi\s+)?(?:lui\s+|leur\s+)?|faut\s+|(?:elle|il|ils|elles)\s+(?:veut|veulent|voudrait|souhaite|souhaitent|aimerait|demande|demandent)\s+(?:aussi\s+)?|c'est\s+(?:pour\s+)?|l'id[ée]e\s+c'est\s+(?:de\s+)?|aussi\s+|[ée]galement\s+|juste\s+)*/i;
const CHAT_DROP = /^(?:(?:et\s+)?(?:dans|sur)\s+ce\s+chantier\s*[.,]?$|je\s+te\s+laisse|je\s+pense(?!\s+(?:prendre|poser|mettre|faire))|compte\s+(?:[çc]a|cela)|le\s+revenir|tu\s+peux|merci|voil[aà]|c'est\s+tout|et\s+voil[aà]|parce|qu'|car\s|bonjour|de\s+chez\s+moi|me\s+dire|(?:il|elle|le chantier)\s+est\s+|un\s+petit\s+chantier|l'id[ée]e\s+c'est\s+de\s+prendre$|pour\s+le\s+reste$|(?:un\s+)?(?:gros|petit|grand|moyen)\s+chantier$|(?:un\s+)?chantier\s+(?:moyen|normal|important|de\s+taille\s+moyenne)$|petite\s+intervention$|(?:elle|il|ils|elles|qui)\s+habite(?:nt)?$|r[ée]novation\s+compl[eè]te$|(?:et\s+)?dans\s+ce\s+chantier)/i;

/* ---------- Compléments qui ne décrivent pas la prestation ---------- */
const LOC_RE = /\s+(?:(?:sur|sous|derri[eè]re|devant|contre|dans|entre|vers)\s+(?:le|la|les|l'|un|une|ce|cette|ces|son|sa|ses|leur|leurs|mon|ma|mes)|(?:au[- ]dessus|au[- ]dessous|en\s+dessous|[àa]\s+c[oô]t[ée]|le\s+long|autour|pr[eè]s|en\s+face|en\s+bas|en\s+haut|au\s+niveau|au\s+fond)\s+(?:du|des|de\s+la|de\s+l'|d'une?|de))\s*(?!(?:murs?|plafonds?|sols?|ensemble|totalit[ée]|tout|toute)(?![\wà-ÿ]))[^\d⟦]*$/i;
const REL_RE = /\s+(?:qui|qu'(?:il|elle|on|ils|elles))\s+[^\d⟦]*$/i;
function sansComplement(t) {      // { txt, lieu } : texte utile à la recherche, complément de lieu retiré
  let x = String(t || ""), lieu = "";
  const r = x.match(REL_RE); if (r && tokensLight(x.slice(0, r.index))) x = x.slice(0, r.index);
  const m = x.match(LOC_RE); if (m && tokensLight(x.slice(0, m.index))) { lieu = m[0].trim(); x = x.slice(0, m.index); }
  return { txt: x.trim(), lieu };
}
const tokensLight = t => /[a-zà-ÿ]{3,}/i.test(String(t || "").replace(/^(?:une?|le|la|les|des|du|de|et|avec)\s+/i, ""));

/* ---------- Analyse complète ---------- */
function analyse(dictee, biblio, opts) {
  opts = opts || {};
  const pre = normalizeOral(dictee), text = pre.text;
  const index = buildIndex(biblio || []);
  const appris = opts.appris || {};
  const { client, body: body0 } = extractClient(text);
  let body = " " + body0 + " ";
  const TC = Object.assign({}, CARRELAGE_DEFAUT, opts.carrelage || {});
  const notes = pre.notes.slice(), ignored = [], aConfirmer = [];
  const F = { rooms: {} };
  const lt = low(text);
  // TVA
  let tva = 10;
  if (/tva\s*(?:a|à|de)?\s*20|20\s*%\s*(?:de\s*)?tva|local (?:professionnel|commercial)|locaux (?:professionnels|commerciaux)|construction neuve|logement neuf/.test(lt)) tva = 20;
  if (/tva\s*(?:a|à|de)?\s*5[,.]5|5[,.]5\s*%/.test(lt)) tva = 5.5;
  body = body.replace(/(?:avec\s+(?:une\s+)?|en\s+)?tva\s*(?:a|à|de)?\s*\d+(?:[,.]\d)?\s*%?/gi, " ").replace(/(?:c'est\s+un\s+|dans\s+un\s+)?loca(?:l|ux)\s+(?:professionnels?|commercia(?:l|ux))/gi, " ");
  // objet explicite
  let objet = ""; const ob = body.match(/(?<![\wà-ÿ])objet\s*:?\s*([^.\n;]{4,90})/i); if (ob) { objet = cap(ob[1].trim()); body = body.replace(ob[0], " "); }
  // durée du chantier
  let dureeJours = null;
  { const N = "(?:à\\s+peu\\s+près\\s+|environ\\s+|dans\\s+les\\s+|sur\\s+)?(\\d+(?:,5)?)\\s*(journ[ée]es?|jours?|semaines?)(?![\\wà-ÿ])";
    const pats = [
      ["(?:ça|ca|cela|le\\s+chantier|les\\s+travaux|le\\s+devis|il)?\\s*(?:va|vont|devrait|doit)\\s+(?:me\\s+|nous\\s+)?(?:durer|prendre)\\s+" + N, true],
      ["(?:chantier|travaux|intervention)\\s+(?:sur|de|d'environ|pendant|pr[ée]vus?\\s+sur)\\s+" + N, true],
      ["dur[ée]e\\s*(?:du\\s+chantier|des\\s+travaux|pr[ée]vue)?\\s*:?\\s*(?:de\\s+|d'environ\\s+)?" + N, true],
      ["(?:je\\s+|il\\s+faut\\s+|faut\\s+)?(?:compter?|comptez|compte|pr[ée]voir)\\s+" + N + "(\\s+de\\s+(?:travail|main-d'oeuvre|boulot))?", false],
    ];
    for (const [p, rm] of pats) { const m = body.match(new RegExp(NB + p, "i")); if (!m) continue; if (!rm && m[3] && /main-d'oeuvre/i.test(m[3]) && /journ/i.test(m[2])) continue; if (dureeJours === null) dureeJours = nb(m[1]) * (/semaine/i.test(m[2]) ? 5 : 1); if (rm || !m[3] || (/travail|boulot/i.test(m[3]) && !/^\s+pour\s/i.test(body.slice(m.index + m[0].length)))) body = body.replace(m[0], " ¶ "); } }
  // frais de déplacement, stationnement
  const frais = [];
  { const km = text.match(/(?:plus\s+de\s+|environ\s+|à\s+|a\s+)?(\d+)\s*(?:km|kilom(?:e|è)tres?)(?![\wà-ÿ])/i);
    const FD = "(?:les\\s+|des\\s+|mes\\s+|avoir\\s+des\\s+)?(?:frais\\s+(?:de\\s+d[ée]placements?|kilom[ée]triques?|de\\s+route)|indemnit[ée]s?\\s+kilom[ée]triques?)";
    const m1 = body.match(new RegExp("(\\d+(?:,\\d+)?)\\s*€\\s+(?:de|pour\\s+les)\\s+" + FD, "i")) || body.match(new RegExp(FD + "(?:\\s*(?:de|à|pour|:)?\\s*(\\d+(?:,\\d+)?)\\s*€)?", "i"));
    if (m1 || km) {
      const fdT = tokens("frais de déplacement"); const b = (matchTokens(index, fdT)[0] || {}).b;
      const l = b && fdT.some(t => index.byId.get(b.id).U.has(t)) && /d[ée]placement|kilom/i.test(b.designation) ? fromBib(b) : { type: "mo", designation: "Frais de déplacement", details: [], quantite: 1, unite: "forfait", pu: null, source: "a_saisir", biblio_id: null, raw: "", suggestions: [] };
      l.quantite = 1; l.raw = m1 ? m1[0].trim() : km[0].trim();
      const prix = m1 && m1[1] ? nb(m1[1]) : null; if (prix !== null) { l.pu = prix; l.source = "dicte"; }
      if (km) l.details = [`Chantier situé à ${/plus\s+de/i.test(km[0]) ? "plus de " : ""}${km[1]} km de l'entreprise`];
      frais.push(l); if (m1) body = body.replace(m1[0], " ¶ "); if (km) body = body.replace(new RegExp("(?:parce\\s+qu'|car\\s+)?(?:il\\s+y\\s+a\\s+|c'est\\s+à\\s+|situ[ée]\\s+à\\s+)?" + km[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:\\s+de\\s+chez\\s+moi|\\s+de\\s+l'entreprise|\\s+d'ici)?", "i"), " ¶ ");
    }
    let park = null;
    const p1 = body.match(new RegExp("(\\d+)\\s*jours?\\s+de\\s+(?:stationnement|parking)", "i")) || body.match(new RegExp("(?:pr[ée]voir\\s+|compter\\s+|avec\\s+|et\\s+)?(?:le\\s+|du\\s+|les\\s+frais\\s+de\\s+|des\\s+frais\\s+de\\s+)?(?:stationnement|parking)(?:\\s+payant)?(?:\\s+(?:pendant\\s+|sur\\s+|pour\\s+)?(\\d+)\\s*jours?)?", "i"));
    if (p1) { park = { q: p1[1] ? Number(p1[1]) : dureeJours, raw: p1[0].trim() }; body = body.replace(p1[0], " ¶ "); if (!p1[1] && dureeJours) notes.push(`Stationnement : ${fr(dureeJours)} jour(s) comptés, comme la durée du chantier.`); }
    const p2 = body.match(new RegExp(NB + "(?:il|elle|le\\s+chantier|c')\\s*est\\s+(?:dans|sur|à|a)\\s+paris(?:\\s+centre|\\s+intra[- ]muros|\\s+\\d{1,2}(?:e|ème)?)?", "i"));
    if (p2) { if (!park) park = { q: null, raw: p2[0].trim() }; body = body.replace(p2[0], " ¶ "); }
    if (park) { const b = (matchTokens(index, tokens("frais de stationnement paris"))[0] || {}).b; if (b && /stationnement|parking/i.test(b.designation)) frais.push(fromBib(b, { quantite: park.q, raw: park.raw })); else frais.push({ type: "mo", designation: "Frais de stationnement", details: [], quantite: park.q, unite: "jour", pu: null, source: "a_saisir", biblio_id: null, raw: park.raw, suggestions: [] }); }
  }
  // date de début du chantier
  let debut = null;
  { const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
    const m = body.match(new RegExp(NB + "(?:d[ée]but|d[ée]marrage|commencement)\\s+(?:du\\s+chantier|des\\s+travaux)?\\s*(?:pr[ée]vu\\s+)?(?:le\\s+|au\\s+|:\\s*)?(\\d{1,2}|1er|premier)\\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)(?:\\s+(20\\d{2}))?", "i"))
           || body.match(new RegExp(NB + "(?:on\\s+|je\\s+)?(?:commence|d[ée]marre|attaque)(?:\\s+le\\s+chantier|\\s+les\\s+travaux)?\\s+le\\s+(\\d{1,2}|1er|premier)\\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)(?:\\s+(20\\d{2}))?", "i"));
    if (m) { const today = opts.today ? new Date(opts.today) : new Date(), j = /^\d/.test(m[1]) ? parseInt(m[1], 10) : 1, mo = MOIS.indexOf(low(m[2]));
      let y = m[3] ? Number(m[3]) : today.getFullYear(); if (!m[3] && new Date(y, mo, j + 1) < today) y++;
      debut = `${y}-${String(mo + 1).padStart(2, "0")}-${String(j).padStart(2, "0")}`; body = body.replace(m[0], " ¶ "); notes.push(`Début du chantier : ${String(j).padStart(2, "0")}/${String(mo + 1).padStart(2, "0")}/${y}.`); } }
  body = body.replace(new RegExp(NB + "(?:dans\\s+un\\s+(?:premier|deuxi[eè]me|second|troisi[eè]me)\\s+temps|(?:premi[eè]re|deuxi[eè]me|seconde|troisi[eè]me|quatri[eè]me|autre|derni[eè]re)\\s+(?:prestation|chose|[ée]tape|partie)|(?:premier|deuxi[eè]me|second|troisi[eè]me|dernier)\\s+(?:point|poste|lot))" + NA, "gi"), " ¶ ")
             .replace(new RegExp(NB + "(?:premi[eè]re|deuxi[eè]me|seconde|troisi[eè]me|quatri[eè]me|autre|derni[eè]re)\\s+pi[eè]ce" + NA, "gi"), " ¶ ")
             .replace(new RegExp(NB + "(?:sur|dans|pour|toujours\\s+dans)\\s+(?:la\\s+m[eê]me|cette)\\s+pi[eè]ce" + NA, "gi"), " ");
  // « la salle de bain fait 15 m² » : surface au sol de la pièce ; « sur toute la hauteur du mur qui fait 2,50 m » : hauteur
  body = body.replace(new RegExp(NB + "((?:la\\s+|le\\s+|les\\s+|l')?(?:salles?\\s+de\\s+bains?|salles?\\s+d'eau|salles?\\s+de\\s+douches?|chambres?(?:\\s+\\d)?|cuisine|salon|s[ée]jour|salle\\s+[àa]\\s+manger|pi[eè]ce|bureau|entr[ée]e|couloir|wc|toilettes|garage|buanderie|cellier|dressing|v[ée]randa|studio|appartement))\\s+(?:fait|mesure|c'est)\\s+(\\d+(?:,\\d+)?)\\s*m²", "gi"), (m, r, a) => ` ¶ ${r} ⟦sol:${nb(a)}⟧ ¶ `)
             .replace(new RegExp("(?:sur\\s+)?toute\\s+la\\s+hauteur(?:\\s+(?:du|des)\\s+murs?)?(?:\\s+(?:qui\\s+(?:fait|font)|soit|de|donc))?((?:\\s+\\d+(?:,\\d+)?\\s*m(?![²³l\\wà-ÿ]))+)?", "gi"), (m, hs) => { const all = hs ? hs.match(/\d+(?:,\d+)?/g) : null; return all ? ` ⟦haut:${nb(all[all.length - 1])}⟧ ` : " "; });
  // surface au sol et hauteur sous plafond : marqueurs rattachés ensuite à la pièce
  { const Nn = "(\\d+(?:,\\d+)?)";
    body = body.replace(new RegExp("(?:(?:avec\\s+)?(?:une\\s+|la\\s+)?surface\\s+(?:au\\s+sol\\s+)?(?:de\\s+|d'environ\\s+)?)" + Nn + "\\s*m²(?:\\s+au\\s+sol)?", "gi"), (m, a) => ` ⟦sol:${nb(a)}⟧ `)
               .replace(new RegExp(Nn + "\\s*m²\\s+(?:au\\s+sol|de\\s+surface(?:\\s+au\\s+sol)?)" + NA, "gi"), (m, a) => ` ⟦sol:${nb(a)}⟧ `)
               .replace(new RegExp("(?:(?:et\\s+|avec\\s+)?(?:une\\s+|la\\s+)?)?hauteur\\s+(?:sous\\s+plafond\\s+)?(?:de\\s+|d'environ\\s+)?" + Nn + "\\s*m(?![²³l\\wà-ÿ])", "gi"), (m, a) => ` ⟦haut:${nb(a)}⟧ `)
               .replace(new RegExp(Nn + "\\s*m\\s+(?:de\\s+)?(?:hauteur|haut)(?:\\s+sous\\s+plafond)?" + NA, "gi"), (m, a) => ` ⟦haut:${nb(a)}⟧ `)
               .replace(new RegExp("(?:sous\\s+plafond|hsp)\\s+(?:de\\s+)?" + Nn + "\\s*m(?![²³l\\wà-ÿ])", "gi"), (m, a) => ` ⟦haut:${nb(a)}⟧ `); }
  { const cm = body.match(/(?<![\d,.])(\d)\s+couches?/i); if (cm) F.couches = Number(cm[1]); }
  body = body.replace(W("aussi|[ée]galement|euh|ben|bah|hein|en\\s+gros|tu\\s+vois|du\\s+genre|tant\\s+qu(?:e\\s+j'y\\s+suis|'on\\s+y\\s+est|'[àa]\\s+faire)|pendant\\s+qu(?:e\\s+j'y\\s+suis|'on\\s+y\\s+est)|au\\s+passage|si\\s+possible|bien\\s+s[uû]r|bien\\s+entendu|[àa]\\s+la\\s+louche|je\\s+dirais?|on\\s+va\\s+dire|disons|grosso\\s+modo|comme\\s+d'habitude|normalement|[àa]\\s+vue\\s+de\\s+nez|quelque\\s+chose\\s+comme|dans\\s+les(?=\\s+\\d+(?:,\\d+)?\\s*(?:m²|m³|ml|m|€|jours?|heures?)(?![\\wà-ÿ]))|[àa]\\s+peu\\s+pr[eè]s|environ|approximativement|des\\s+2\\s+c[oô]t[ée]s|sur\\s+les\\s+2\\s+(?:faces|c[oô]t[ée]s)|des\\s+2\\s+faces|recto\\s+verso"), " ").replace(/¶/g, " . ");

  /* ----- segments ----- */
  const segs = segmenter(body);
  function fromBib(b, extra) { return Object.assign({ type: "mo", designation: b.designation, details: (b.details || []).slice(), quantite: 1, unite: b.unite, pu: b.pu ?? null,
    source: b.pu !== null && b.pu !== undefined ? "bibliotheque" : "a_saisir", biblio_id: b.id, raw: "", suggestions: [] }, extra || {}); }
  const findBib = (q, need) => { const m = matchTokens(index, tokens(q))[0]; return m && m.score >= T_OK && (!need || index.byId.get(m.b.id).U.has(need)) ? m.b : null; };
  const stripLead = r => { let x = r; for (let k = 0; k < 3; k++) x = x.replace(CHAT_LEAD, "").replace(/^(?:que\s+|faire\s+(?=de\s|la\s|le\s|les\s|du\s))/i, "").trim(); return x; };
  const cleanQ = r => { const am = parseAmounts(extractTile(r).txt); return am.cleaned; };
  const hasQty = r => /\d+(?:,\d+)?\s*(?:m²|m³|ml|m(?![\wà-ÿ])|heures?|h\b|jours?|journ[ée]es?)/i.test(r) || /(?<![\d,.])\d{1,3}\s+(?!€|couches?)[a-zà-ÿ-]{3,}/i.test(r);
  const lieu = (r, t) => !ROOM_AS_OBJECT.has(r.base) || /(?:murs?|plafonds?|sols?|carrelage|peinture|fa[iï]ence|parquet)\s+(?:du|de\s+la|des|de\s+l'|dans\s+les?|dans\s+la|dans\s+l')\s*$/i.test(t.slice(0, r.index));
  const noRoom = t => { let x = t; for (const r of roomsIn(t).reverse()) if (lieu(r, t) && (!/^Salle de (?:bains|douche)$/.test(r.base) || /dans\s+(?:la|le|les|l'|sa|leur)\s*$/i.test(t.slice(0, r.index))) && !/^(?:pose|d[ée]pose|installation|montage)\s+(?:d'une?|de\s+la|du)\s+$/i.test(t.slice(0, r.index))) x = x.slice(0, r.index).replace(/(?:dans|de|du|des|pour|sur)\s+(?:la\s+|le\s+|les\s+|l')?$/i, "") + " " + x.slice(r.index + r.len); return x; };
  const sig = r => { const tk = tokens(noRoom(cleanQ(r).replace(/⟦[^⟧]*⟧/g, " "))); return { tk, acts: tk.filter(t => ACTIONS.has(t)), zones: tk.filter(t => ZONES.has(t)), others: tk.filter(t => !ACTIONS.has(t) && !ZONES.has(t)) }; };

  // rattachement des segments « souples » (et / avec / plus / virgule) au segment précédent quand ils décrivent la même prestation
  function canMerge(Lr, Rr) {
    const hl = hasQty(Lr), hr = hasQty(Rr);
    if (hl && hr) return false;
    if (/(?<![\d,.])\d{1,3}\s+[a-zà-ÿ-]{3,}/i.test(Lr) && /^(?:d')?une?\s+[a-zà-ÿ-]{3,}/i.test(Rr.trim())) return false;      // « 2 prises et d'un interrupteur »
    if (hr && /(?<![\d,.])\d{1,3}\s+[a-zà-ÿ-]{3,}/i.test(Rr) && /(?:^|\s)une?\s+[a-zà-ÿ-]{3,}/i.test(Lr)) return false;      // « une porte double … et 3 portes simples »
    if (CHAT_DROP.test(Rr) || /^(?:dans|sur|pour)\s+ce\s/i.test(Rr)) return false;
    if (/^⟦/.test(Rr.trim()) || /⟦/.test(Lr) && !tokens(Lr.replace(/⟦[^⟧]*⟧/g, "")).length) return false;
    const L = sig(Lr), R = sig(Rr);
    if (!L.tk.length) return false;
    if (!R.tk.length) return /\d/.test(Rr) && L.tk.length > 0 ? "qte" : false;
    if (!hl && L.acts.length && !L.others.length && !L.zones.length && R.acts.length) { const j = decide(matchTokens(index, L.tk.concat(R.tk))); if (j.ok) { const e = index.byId.get(j.best.b.id); if (L.acts.every(a => e.U.has(a)) && R.acts.some(a => e.U.has(a))) return true; } }
    if (L.acts.includes("protect") && !hr && !hl && R.acts.every(a => a === "nettoy" || a === "evacu" || a === "protect") && R.others.every(t => t === "chanti" || t === "dechet" || t === "dechetteri" || t === "gravat" || t === "finchantier")) return true;
    if (!R.others.length && !R.acts.length) return !hl && L.zones.length > 0;                       // « murs » + « plafond »
    if (hl) return false;
    const ms = matchTokens(index, L.tk), d = decide(ms);
    if (d.ok) {
      const e = index.byId.get(d.best.b.id);
      if (R.others.every(t => e.U.has(t)) && R.acts.every(a => e.D.has(a) || e.acts.has(a) || L.acts.includes(a))) {
        if (!R.others.length && R.acts.length && !R.acts.every(a => e.D.has(a) || e.acts.has(a))) return false;
        return true;
      }
    }
    // la somme des deux décrit mieux une prestation que chacun pris à part
    const mj = decide(matchTokens(index, L.tk.concat(R.tk))), mr = decide(matchTokens(index, (R.acts.length ? [] : L.acts).concat(R.tk)));
    if (mj.ok && mj.best.score >= 0.75) { const e = index.byId.get(mj.best.b.id); if (L.tk.concat(R.tk).every(t => e.U.has(t) || ZONES.has(t))) return true; }
    // complément sans verbe ni prestation propre (« … et une tringle à rideaux »)
    if (!R.acts.length && !hr && !mr.ok && d.ok && R.others.length && !roomOf(Rr) && !/^(?:le|la|les|l'|du|des|un|une)?\s*(?:mur|plafond|sol)/i.test(Rr)) return "desc";
    return false;
  }
  const NOSTART = /^(?:de|d'|du|des|à|a|au|aux|en|sur|sous|pour|par|avec|dans|et|ou|d'une?|qui|que|le|la|les|l')$/i, NOEND = /^(?:de|d'|du|des|à|a|au|aux|en|sur|sous|pour|par|avec|dans|et|ou|d'une?|le|la|les|l'|une?|sans)$/i;
  function resplit(raw) {       // « création douche italienne siphon de sol WC suspendu » → trois prestations
    if (/\d|⟦/.test(raw)) return null;
    { const sc = sansComplement(raw); if (sc.txt !== raw && decide(matchTokens(index, sig(sc.txt).tk)).ok) return null; }
    const words = raw.split(/\s+/), n = words.length; if (n < 3 || n > 18) return null;
    const S0 = sig(raw); if (S0.tk.length < 3) return null;
    const whole = decide(matchTokens(index, S0.tk));
    if (whole.ok) { const e = index.byId.get(whole.best.b.id); if (!S0.others.some(t => !e.U.has(t))) return null; }
    const best = new Array(n + 1).fill(null); best[0] = { v: 0, parts: [] };
    for (let i = 1; i <= n; i++) for (let j = 0; j < i; j++) {
      if (!best[j] || (j > 0 && (NOSTART.test(words[j]) || /^d'/i.test(words[j]))) || NOEND.test(words[i - 1])) continue;
      const txt = words.slice(j, i).join(" "), sg = sig(txt); if (!sg.tk.length) continue;
      const d = decide(matchTokens(index, sg.tk)); if (!d.ok || d.best.score < 0.7) continue;
      const e = index.byId.get(d.best.b.id); if (sg.others.some(t => !e.U.has(t))) continue;
      const v = best[j].v + d.best.score - 0.45;
      if (!best[i] || v > best[i].v) best[i] = { v, parts: best[j].parts.concat([txt]) };
    }
    const r = best[n]; if (!r || r.parts.length < 2) return null;
    if (r.parts.flatMap(x => sig(x).tk).sort().join(" ") !== S0.tk.slice().sort().join(" ")) return null;      // ne coupe pas une expression figée
    if (whole.ok && r.v <= whole.best.score - 0.45) return null;
    return r.parts;
  }
  for (let i = 0; i < segs.length; i++) segs[i].raw0 = segs[i].raw;
  const merged = [];
  { let fm = false;
    for (const s of segs) {
      if (s.fournCue) fm = true; else if (s.lead === "hard") fm = false;
      s.fourn = fm; if (/^(?:je\s+)?(?:prends?|prendre)\s/i.test(stripLead(s.raw)) || /^je\s+prends?\s/i.test(s.raw)) { fm = true; s.fourn = true; }
      const prev = merged[merged.length - 1];
      if (prev && s.fourn && prev.fourn && s.lead === "soft" && /^[A-ZÀ-Ý][a-zà-ÿ]/.test(s.raw) && !/\d/.test(prev.raw)) { prev.raw += " " + s.raw; continue; }
      if (prev && !s.fourn && !prev.fourn && /^soft/.test(s.lead) && !prev.noMerge) {
        const a = stripLead(prev.raw), b = stripLead(s.raw);
        const cm = a && b ? canMerge(a, b) : false;
        if (cm) { prev.raw = prev.raw + (cm === "qte" ? " " : " et ") + s.raw; if (cm === true) { const R = sig(b); if (R.others.length) prev.conj = (prev.conj || 0) + 1; } continue; }
      }
      if (!s.fourn) { const lead0 = s.raw.match(CHAT_LEAD)[0] || "", parts = resplit(stripLead(s.raw)); if (parts) { parts.forEach((x, k) => merged.push(Object.assign({}, s, { raw: (k ? "" : lead0) + x, lead: k ? "juxt" : s.lead, intro: k === parts.length - 1 ? s.intro : false, noMerge: k < parts.length - 1 }))); continue; } }
      merged.push(s);
    } }

  /* ----- interprétation ----- */
  const sections = [];
  const getSec = titre => { let s = sections.find(x => x.titre === titre); if (!s) { s = { titre, lignes: [] }; sections.push(s); } return s; };
  for (const l of frais) getSec("Frais de chantier").lignes.push(l);
  let headerRoom = null, inlineRoom = null, lastAction = null, lastLine = null, lastFrame = null;
  const roomLines = {};          // lignes créées par pièce (pour « pareil pour la chambre 2 »)
  // faits par pièce (premier passage)
  { let room = null; const set = (r, k, v) => { const key = r || "*"; (F.rooms[key] = F.rooms[key] || {})[k] = v; if (!F.first) F.first = F.rooms[key]; };
    for (const s of merged) { const rm = roomOf(s.raw.replace(/⟦[^⟧]*⟧/g, " ")); if (rm) room = rm.name; for (const m of s.raw.matchAll(/⟦(sol|haut):([\d.]+)⟧/g)) set(room, m[1], Number(m[2])); } }
  const factsFor = room => F.rooms[room] || (Object.keys(F.rooms).length === 1 ? F.first : null) || F.rooms["*"] || null;
  const paintDone = new Set();

  let corrAt = -9, curSi = 0, lastLineSi = -9;
  const addLine = (ligne, titre) => {
    if (curSi - corrAt === 1 && lastLine && lastLine.type === "mo" && ligne.type === "mo" && corrAt - lastLineSi <= 1 && lastLine !== ligne) {
      const sansNb = x => String(x || "").replace(/\d+(?:,\d+)?\s*(?:m²|m³|ml|m|€)?/g, " ");
      const a = new Set(tokens(sansNb(lastLine.raw) + " " + lastLine.designation).filter(t => !ZONES.has(t)));
      if ((ligne._tk || tokens(sansNb(ligne.raw))).some(t => a.has(t))) { for (const s2 of sections) { const k = s2.lignes.indexOf(lastLine); if (k >= 0) s2.lignes.splice(k, 1); } for (const k of Object.keys(roomLines)) roomLines[k] = roomLines[k].filter(x => x !== lastLine); notes.push(`Correction prise en compte : « ${String(lastLine.raw || lastLine.designation).slice(0, 50)} » remplacé par « ${String(ligne.raw).slice(0, 50)} ».`); }
      corrAt = -9; }
    lastLineSi = curSi; const sec = getSec(titre); sec.lignes.push(ligne); lastLine = ligne; (roomLines[titre] = roomLines[titre] || []).push(ligne); return ligne; };
  const cloneLine = (l, extra) => Object.assign(JSON.parse(JSON.stringify(l)), extra || {});

  for (let si = 0; si < merged.length; si++) {
    const seg = merged[si]; let raw = seg.raw.trim(); curSi = si;
    const hardLead = seg.lead === "hard";
    // retraits : « non en fait laisse tomber le nettoyage »
    { const rt = raw.match(/^(?:non\s+)?(?:pardon\s+)?(?:en\s+fait\s+|finalement\s+)?(?:(?:on\s+|je\s+)?(?:laisse|laisses|laissez)\s+tomber|oublie[sz]?|annule[sz]?|supprime[sz]?|enl[eè]ve[sz]?\s+du\s+devis|(?:on\s+)?(?:ne\s+)?(?:fait|fais)\s+pas|pas\s+de|pas\s+besoin\s+de)\s+(.+)$/i);
      if (rt) { const tg = tokens(rt[1]); let done = false;
        for (let k = sections.length - 1; k >= 0 && !done; k--) for (let j = sections[k].lignes.length - 1; j >= 0; j--) { const l = sections[k].lignes[j]; const lt2 = new Set(tokens((l.raw || "") + " " + l.designation)); if (tg.length && tg.some(t => lt2.has(t)) && tg.filter(t => lt2.has(t)).length >= Math.min(tg.length, 1)) { notes.push(`Ligne retirée à votre demande : « ${l.designation.slice(0, 60)} ».`); sections[k].lignes.splice(j, 1); done = true; break; } }
        continue; }
      if (/^(?:non(?:\s+pardon|\s+non)?|pardon|finalement|en\s+fait|je\s+me\s+suis\s+tromp[ée]e?|je\s+me\s+trompe)$/i.test(raw)) { if (/non|pardon|tromp/i.test(raw)) corrAt = si; continue; }
      if (/^(?:non|pardon)\s+/i.test(raw)) corrAt = si - 1;
      raw = raw.replace(/^(?:(?:non|pardon|finalement|en\s+fait)\s+)+/i, ""); }
    if (/^(?:mais\s+)?(?:[çc]a\s+|cela\s+)?(?:je|on)\s+(?:ne\s+|n')?(?:le\s+|la\s+|les\s+|y\s+)?(?:fais|fait|touche|prends|m'en\s+occupe)\s+pas(?:\s+[çc]a)?$/i.test(raw) || /^pas\s+(?:[çc]a|pour\s+moi)$/i.test(raw)) {
      if (lastLine && lastLineSi >= si - 2) { for (const s2 of sections) { const k = s2.lignes.indexOf(lastLine); if (k >= 0) s2.lignes.splice(k, 1); } notes.push(`Ligne retirée (« ${raw} ») : « ${lastLine.designation.slice(0, 60)} ».`); lastLine = null; }
      continue; }
    // faits seuls
    const facts = [...raw.matchAll(/⟦(sol|haut):([\d.]+)⟧/g)]; raw = raw.replace(/⟦[^⟧]*⟧/g, " ").replace(/\s{2,}/g, " ").trim();
    if (/^(?:devis|le devis|un devis)(?![\wà-ÿ])/i.test(raw) && raw.split(/\s+/).length <= 4) continue;
    if (!raw || /^(?:une?|et|avec|de|la|le|les)$/i.test(raw)) continue;
    if (CHAT_DROP.test(raw)) continue;
    // fournitures : « je prends … »
    let isFourn = seg.fourn, prendFourn = false;
    { const pf = raw.match(/(?:^|\s)(?:je\s+)?(?:prends?|prendre)\s+(?:en\s+fournitures?\s+)?(.+)$/i);
      if (pf && !/^(?:le|la|les)?\s*(?:mesures?|temps|cotes?)\b|^(?:à\s+peu\s+près|environ)?\s*\d+\s*(?:jours?|semaines?|heures?)/i.test(pf[1])) { raw = pf[1]; prendFourn = true; isFourn = true; } }
    raw = stripLead(raw);
    if (!raw || CHAT_DROP.test(raw)) continue;
    if (/^(?:tva|bonjour|merci|c'est tout|fin)(?![\wà-ÿ])/i.test(raw)) continue;
    if (/^\d\s+couches?$/i.test(raw)) continue;
    // « pareil pour la chambre 2 », « idem dans le couloir »
    { const same = raw.match(/^(?:pareil|idem|la\s+m[eê]me\s+chose|m[eê]me\s+chose|m[eê]mes?\s+travaux|comme)\s+(?:pour|dans|que\s+dans|que\s+pour|que)?\s*(.+)$/i);
      if (same) { const rm = roomOf(same[1]); const src = headerRoom || inlineRoom;
        const suite = rm ? same[1].slice(rm.index + rm.len).trim() : "";
        if (rm && suite && hasQty(suite)) { headerRoom = rm.name; inlineRoom = null; raw = suite; seg.suiteDe = true; }
        else if (rm && src && roomLines[src] && roomLines[src].length) { for (const l of roomLines[src].slice()) addLine(cloneLine(l, { raw: raw }), rm.name); headerRoom = rm.name; inlineRoom = null; notes.push(`« ${raw} » : les lignes de « ${src} » ont été reprises pour « ${rm.name} ». Vérifiez les quantités.`); continue; } } }
    { const same2 = raw.match(/^(.+?)\s+(?:c'est\s+)?(?:pareil|idem|la\s+m[eê]me\s+chose|m[eê]me\s+chose|m[eê]mes\s+travaux)$/i), rm = same2 && roomOf(same2[1]), src = headerRoom || inlineRoom;
      if (rm && !hasQty(same2[1]) && src && src !== rm.name && roomLines[src] && roomLines[src].length) { for (const l of roomLines[src].slice()) addLine(cloneLine(l, { raw }), rm.name); headerRoom = rm.name; inlineRoom = null; notes.push(`« ${raw} » : les lignes de « ${src} » ont été reprises pour « ${rm.name} ». Vérifiez les quantités.`); continue; } }
    // en-tête de pièce (« dans la chambre 1 », « salle de bain », « rénovation complète de la salle de bain »)
    const rms = roomsIn(raw);
    if (rms.length && !isFourn) {
      const rm = rms[0], before = low(raw.slice(0, rm.index)).trim(), after = raw.slice(rm.index + rm.len).trim();
      const headBefore = /^(?:(?:et\s+)?(?:dans|pour|cote|en|au niveau de|concernant|partie)?\s*(?:la|le|les|l'|sa|son|ses|leur|un|une)?\s*|(?:il|elle|ils|elles|on)\s+(?:a|ont)\s+(?:la|le|les|sa|son|ses|leur|un|une)\s*|(?:r[ée]novation|r[ée]fection|refai(?:re|s|t|sons)|refont|r[ée]nov(?:er|e|ons|ent)|fai(?:re|s|t|sons)|travaux\s+(?:dans|de))\s+(?:compl[eè]te(?:ment)?\s+|entierement\s+)?(?:de\s+|d')?(?:toute?s?\s+)?(?:la\s+|le\s+|les\s+|l'|sa\s+|son\s+|leur\s+)?)$/.test(before + " ");
      const afterTk = tokens(after.replace(/^(?:\d\s+)?/, ""));
      const afterIsHead = !after || /^(?:à|a)\s+(?:refaire|r[ée]nover|faire|reprendre|r[ée]am[ée]nager)(?:\s+(?:compl[eè]tement|enti[eè]rement|en\s+entier))?$/i.test(after) || (roomsIn(after).length && afterTk.every(t => !ACTIONS.has(t)) && !hasQty(after)) || (!hasQty(after) && !afterTk.some(t => ACTIONS.has(t)) && afterTk.length <= 2 && !decide(matchTokens(index, afterTk)).ok);
      const objetEntier = ROOM_AS_OBJECT.has(rm.base) && after && decide(matchTokens(index, tokens(raw))).ok;      // « WC suspendu » : prestation, pas un titre de pièce
      if (headBefore && afterIsHead && !objetEntier) {
        headerRoom = rm.name; inlineRoom = null; if (/renovation/.test(before) && /appartement|maison|logement/.test(low(raw))) F.renov = true;
        continue;
      }
      if (headBefore && (/^(?:dans|pour|cote|au niveau|concernant)/.test(before) || ((before === "" || /^(?:la|le|les|l')$/.test(before)) && (!ROOM_AS_OBJECT.has(rm.base) || /^(?:murs?|plafonds?|sols?)(?![\wà-ÿ])/i.test(after))))) { headerRoom = rm.name; inlineRoom = null; raw = after.replace(/^\s*[:,-]?\s*/, ""); if (!raw) continue; }
    }
    if (/r[ée]novation\s+compl[eè]te\s+(?:de\s+|d')(?:l'appartement|la\s+maison|du\s+logement|l'ensemble)/i.test(raw)) { F.renov = true; raw = raw.replace(/r[ée]novation\s+compl[eè]te\s+(?:de\s+|d')(?:l'appartement|la\s+maison|du\s+logement|l'ensemble)/i, " ").trim(); if (!raw) continue; }
    // compléments rattachés à la ligne précédente
    if (lastLine && !hardLead && /^(?:(?:le|la|les)\s+[\wà-ÿ'-]+\s+(?:est|sont)\s+)?fournie?s?\s+par\s+(?:le|la|les)\s+client/i.test(raw)) { lastLine.details = (lastLine.details || []).concat(["Fourniture par le client"]); continue; }
    if (lastLine && /^[\wà-ÿ'-]+\s+comprise?s?$/i.test(raw) && !FC_RE.test(" " + raw)) { lastLine.details = (lastLine.details || []).concat([cap(raw)]); continue; }
    if (/^(?:les\s+)?fournitures?(?![\wà-ÿ])\s*:?|^(?:mat(?:e|é)riel|mat(?:e|é)riaux)\s*:/i.test(raw) && !FC_RE.test(" " + raw)) { isFourn = true; raw = raw.replace(/^(?:les\s+)?fournitures?\s*:?\s*|^(?:mat(?:e|é)riel|mat(?:e|é)riaux)\s*:\s*/i, "").trim(); if (!raw) continue; }
    { const cf = raw.match(/^(?:c'est\s+)?(?:elle|il|lui|eux|ils|elles|le\s+client|la\s+cliente|les\s+clients|le\s+propri[ée]taire|madame|monsieur)\s+(?:qui\s+)?(?:fourni(?:t|ssent|ra|ront)|ach[eè]te(?:nt|ra)?|a\s+(?:d[ée]j[aà]\s+)?(?:achet[ée]|fourni|pris)|(?:s'occupe|se\s+charge)\s+d(?:e|es|u)\s+(?:la\s+|les\s+)?(?:fournitures?|achats?))(?![\wà-ÿ])\s*(.*)$/i);
      if (cf) { const all = sections.flatMap(x => x.lignes).filter(x => x.type === "mo"), tg = new Set(tokens(cf[1] || ""));
        const cible = (tg.size && all.slice().reverse().find(x => tokens(x.designation + " " + (x.raw || "")).some(t => tg.has(t)))) || lastLine;
        if (cible) { cible.fournitureComprise = false; if (!(cible.details || []).includes("Fourniture par le client")) cible.details = (cible.details || []).concat(["Fourniture par le client"]); }
        continue; } }
    let fc = false; { const m = (" " + raw).match(FC_RE); if (m) { fc = true; raw = (" " + raw).replace(m[0], " ").replace(/\s{2,}/g, " ").trim(); } }
    if (/(?:hors|sans)\s+(?:la\s+|les\s+)?fournitures?|(?:main-d'oeuvre|pose)\s+(?:seule(?:ment)?|uniquement)(?![\wà-ÿ])/i.test(raw)) raw = raw.replace(/(?:,?\s*(?:en\s+)?)?(?:(?:hors|sans)\s+(?:la\s+|les\s+)?fournitures?|main-d'oeuvre\s+(?:seule(?:ment)?|uniquement)|(?<=\S\s)pose\s+(?:seule(?:ment)?|uniquement))(?![\wà-ÿ])/i, " ").replace(/\s{2,}/g, " ").trim();
    if (!isFourn && /^(?:fourniture|fournir|achat|acheter)(?![\wà-ÿ])|(?<![\wà-ÿ])fourniture\s+d[eu']/i.test(raw)) isFourn = true;
    if (!raw) { if (fc && lastLine) lastLine.fournitureComprise = true; continue; }
    // modificateurs de carrelage seuls (« pose en diagonale », « joint époxy ») : complètent la ligne précédente
    if (!isFourn && lastLine && lastLine.tile && /^(?:(?:avec|en|et)\s+)?(?:pose\s+)?(?:en\s+)?(?:diagonale|d[ée]cal[ée]e?|chevrons?|quinconce|joints?\s+(?:fins?|[ée]poxy)|[ée]poxy|(?:format\s+)?\d{1,3}\s*(?:x|par)?\s*\d{1,3})\s*$/i.test(raw)) { seg.tileMod = raw; }
    if (prendFourn) raw = raw.replace(/\s*,\s*/g, " ").replace(/^(un|une|le|la)?\s*ballon(?![\wà-ÿ])(?!\s+d'eau)(?:\s+de)?/i, "ballon d'eau chaude").replace(/\s+avec\s+\d\s+couches?(?![\wà-ÿ])/i, "");
    raw = raw.replace(/\s+(?:avec|en)\s+\d\s+couches?(?![\wà-ÿ])|(?<![\d,.])\s\d\s+couches?(?![\wà-ÿ])/gi, " ").trim();
    // négations : « sans vitrification », « sans le plafond »
    const neg = []; raw = raw.replace(/(?:^|\s)sans\s+(?:(?:le|la|les|l'|de|du|des|d')\s*)?([a-zà-ÿ'-]+)/gi, (m, w) => { for (const t of tokens(w)) neg.push(t); return " "; }).replace(/\s{2,}/g, " ").trim();
    if (!raw) continue;

    { const cz = raw.match(/^(?:de\s+|pris\s+|achet[ée]e?s?\s+)?chez\s+((?:[A-ZÀ-Ý][\wà-ÿ'-]*\s*){1,3})$/); if (cz && lastLine) { lastLine.details = (lastLine.details || []).concat(["Fournisseur : " + cz[1].trim()]); continue; } }
    if (TILE_CTX.test(raw)) raw = raw.replace(/\s+(?:pause|pose)$/i, "");
    const tile = extractTile(raw, !!seg.tileMod); raw = tile.txt || raw;
    if (seg.tileMod && lastLine && lastLine.tile) { applyTile(lastLine, Object.assign({}, lastLine.tile, { fmt: tile.fmt || lastLine.tile.fmt, tier: tile.tier || lastLine.tile.tier, jointFin: tile.jointFin || lastLine.tile.jointFin, epoxy: tile.epoxy || lastLine.tile.epoxy, pose: tile.pose || lastLine.tile.pose }), true); continue; }
    // pièce citée dans le segment
    let lineRoom = null;
    if (!isFourn) { const cand = roomsIn(raw).filter(r => lieu(r, raw) || /(?:dans|de|du|des)\s+(?:la\s+|le\s+|les\s+|l')?$/i.test(raw.slice(0, r.index)) && r.base !== "WC" && r.base !== "Extérieur"); if (cand.length) { lineRoom = cand[0].name; if (/^chambre$/i.test(lineRoom) && /\d+\s+chambres/i.test(raw)) lineRoom = null; } }
    const am = parseAmounts(raw);
    let desc = am.cleaned.replace(/(?:\s+(?:avec|et|de|d'|une?|,|sur|font|fait))+\s*$/i, "").replace(/(?:\s*,\s*(?:une?|de)?)+\s*$/, "").replace(/^(?:fourniture\s+(?:de|d'|du|des)\s*|fournir\s+|acheter\s+|achat\s+(?:de|d'|du|des)\s*)/i, "").replace(/\s*:\s*$/, "").replace(/^(?:et|avec|plus|de|du|des)\s+(?=(?:le|la|les|l'|du|des|un|une|\d))/i, "").trim();
    desc = desc.replace(/^(?:de\s+la|de\s+l'|du|des|de|d')\s*(?=\S)/i, m => /^d[eu]s?\s*$|^de\s+la\s*$|^de\s+l'$|^d'$/i.test(m.trim()) ? m.replace(/^de\s+la\s*/i, "la ").replace(/^de\s+l'/i, "l'").replace(/^du\s*/i, "le ").replace(/^des\s*/i, "les ").replace(/^de\s*|^d'/i, "") : m);
    if (!desc || desc.length < 3) {
      // quantité seule : même prestation que la ligne précédente (« la deuxième 28 m² »)
      if (!isFourn && lastFrame && lastFrame.line && am.quantite !== null && am.unite && am.unite === lastFrame.line.unite && lastFrame.line.quantite === null) { lastFrame.line.quantite = am.quantite; if (am.pu !== null) { lastFrame.line.pu = am.pu; lastFrame.line.source = "dicte"; } lastFrame.line.raw += " " + raw; delete lastFrame.line._implicit; continue; }
      if (!isFourn && lastFrame && lastFrame.line && am.quantite !== null && am.unite && am.unite === lastFrame.line.unite && am.pu === null) { addLine(cloneLine(lastFrame.line, { quantite: am.quantite, raw, estime: false }), lastFrame.titre); continue; }
      { const seul = raw.match(/^(\d{1,3})$/); if (!isFourn && seul && lastLine && lastLine.type === "mo" && (lastLine.unite === "u" || lastLine._implicit) && (lastLine._implicit || lastLine.quantite === null || lastLine.quantite === 1)) { lastLine.quantite = Number(seul[1]); if (lastLine.unite === "forfait") lastLine.unite = "u"; lastLine.raw += " " + raw; delete lastLine._implicit; continue; } }
      if (am.pu !== null || am.quantite !== null) notes.push(`Montant sans description ignoré : « ${raw} »`); continue; }
    const ligne = { type: isFourn ? "fourniture" : "mo", designation: "", details: [], quantite: am.quantite, unite: am.unite, pu: null, source: "a_saisir", biblio_id: null, raw, suggestions: [] };

    /* ----- fournitures : jamais de prix inventé ----- */
    if (isFourn) {
      ligne.designation = cap(desc.replace(/^\d{1,3}\s+(?=[a-zà-ÿ])/i, "").replace(/^(?:des\s|les\s|le\s|la\s|une\s|un\s|du\s|de la\s|de l'|de\s|d'|l')\s*/i, "")).replace(/\bm2\b/g, "m²");
      if (ligne.quantite === null) ligne.quantite = 1;
      if (!ligne.unite || ligne.unite === "forfait") ligne.unite = "u";
      if (am.pu !== null) { ligne.pu = am.pu; ligne.source = "dicte"; }
      if ((tile.fmt || tile.tier) && TILE_CTX.test(ligne.designation)) ligne.designation = ligne.designation.replace(/(?<![\wà-ÿ])(carrelage|fa(?:i|ï)ence|carreaux?|dalles?|gr(?:e|è)s(?:\s+c(?:e|é)rame)?)(?![\wà-ÿ])/i, m => m + (tile.fmt ? ` ${tile.fmt[0]}×${tile.fmt[1]} cm` : " " + tile.tier)).replace(/\s{2,}/g, " ");
      if (tokens(ligne.designation).length === 0) continue;
      addLine(ligne, "Fournitures"); lastFrame = null; continue;
    }

    /* ----- main-d'œuvre ----- */
    if (/(?<![\wà-ÿ])(?:en\s+plus|en\s+suppl[ée]ment|suppl[ée]mentaires?)(?![\wà-ÿ])/i.test(desc) && /\d|(?<![\wà-ÿ])une?(?![\wà-ÿ])/i.test(desc)) { desc = desc.replace(/(?<![\wà-ÿ])(?:en\s+plus|en\s+suppl[ée]ment|suppl[ée]mentaires?)(?![\wà-ÿ])/gi, " ").replace(/\s{2,}/g, " ").trim(); seg.ajout = true; }
    { const r = desc.match(REL_RE); if (r && tokensLight(desc.slice(0, r.index))) desc = desc.slice(0, r.index).trim(); }
    let S = sig(desc); let tk = S.tk.slice();
    { const sc = sansComplement(desc); if (sc.txt !== desc) { const S2 = sig(sc.txt); if (S2.tk.length) { const dF = decide(matchTokens(index, S.tk)), dS = decide(matchTokens(index, S2.tk)); const s2 = new Set(S2.tk), eF = dF.ok && index.byId.get(dF.best.b.id), utile = dF.ok && S.tk.some(t => !s2.has(t) && eF.U.has(t)) && (!S2.others.length || S2.others.some(t => eF.U.has(t))); if (!utile && dS.ok && (!dF.ok || dS.best.score >= dF.best.score - 0.02) || (!dF.ok && !dS.ok && sc.txt.length < desc.length && /(?:qui|qu')\s/i.test(desc.slice(sc.txt.length)))) { S = S2; tk = S2.tk.slice(); ligne.lieu = sc.lieu; ligne.descUtile = sc.txt; } } } }
    if (seg.ajout && !tk.some(t => ACTIONS.has(t))) tk.push("cre");
    const roomTok = new Set(); for (const r of roomsIn(desc)) if (lieu(r, desc)) for (const t of tokens(desc.slice(r.index, r.index + r.len))) roomTok.add(t);
    const isRoomObj = /^(?:pose|d[ée]pose|installation|montage)\s+(?:d'une?|de\s+la|du)\s+(?:cuisine|salle)/i.test(desc);
    const sdbLieu = roomsIn(desc).some(r => /^Salle de (?:bains|douche)$/.test(r.base) && /dans\s+(?:la|le|les|l'|sa|leur)\s*$/i.test(desc.slice(0, r.index)));
    if (!isRoomObj) tk = tk.filter(t => !roomTok.has(t) || (t === "sdb" && !sdbLieu));
    let acts = tk.filter(t => ACTIONS.has(t)), zones = [...new Set(tk.filter(t => ZONES.has(t)))], others = tk.filter(t => !ACTIONS.has(t) && !ZONES.has(t));
    if (acts.length && !others.length && !zones.length && lastLine && lastLine.type === "mo" && new RegExp("(?:^|\\s)(?:je|j'|on|il|elle|nous|tu)\\s*(?:la|le|les|l')\\s*[a-zà-ÿ]", "i").test(seg.raw)) {
      const objs = tokens(String(lastLine.raw || "").replace(/\d+(?:,\d+)?\s*(?:m²|m³|ml|m|€)?/g, " ")).filter(t => !ACTIONS.has(t) && !ZONES.has(t));
      if (objs.length) { tk = tk.concat(objs); others = objs.slice(); ligne.pronom = true; } }
    ligne._tk = tk.slice();
    const room = lineRoom || (!hardLead && !acts.length && inlineRoom) || headerRoom || (acts.length ? null : inlineRoom) || null;
    if (lineRoom) inlineRoom = lineRoom;
    const titre = room || "Travaux";
    const humid = HUMID.has(baseOf(room)) || tk.includes("sdb") || (tk.includes("wc") && (acts.includes("peintur") || lastAction === "peintur") && !acts.some(a => ACT_GROUP[a] === 1 || a === "depos"));
    if (am.quantite === null && am.pu === null && /^(?:(?:la|l'|le|les|c[oô]t[ée]|partie|pour|en|niveau)\s*)*(?:[ée]lectricit[ée]|plomberie|peinture|carrelage|menuiserie|ma[cç]onnerie|pl[aâ]trerie|sanitaires?|sols?|ext[ée]rieur|int[ée]rieur)\s*:?$/i.test(desc)) continue;
    // bavardage : rien d'exploitable
    if (!tk.length) { if (facts.length || (roomsIn(raw).length && !hasQty(raw))) { if (roomsIn(raw).length && !headerRoom) headerRoom = roomsIn(raw)[0].name; continue; } if (am.quantite !== null && lastFrame && lastFrame.line && am.unite === lastFrame.line.unite && !am.compte) {
        if (lastFrame.line.quantite === null) { const ll = lastFrame.line; ll.quantite = am.quantite; ll.raw += " " + raw; delete ll._implicit; if (ll.tile) { const t2 = extractTile(raw, true); if (t2.fmt || t2.tier || t2.jointFin || t2.epoxy || t2.pose) applyTile(ll, Object.assign({}, ll.tile, { fmt: t2.fmt || ll.tile.fmt, tier: t2.tier || ll.tile.tier, jointFin: t2.jointFin || ll.tile.jointFin, epoxy: t2.epoxy || ll.tile.epoxy, pose: t2.pose || ll.tile.pose }), true); } continue; }
        addLine(cloneLine(lastFrame.line, { quantite: am.quantite, raw, estime: false }), room || lastFrame.titre); continue; } continue; }
    // complément de lieu de la ligne précédente (« … sur la clôture ») : pas une prestation
    if (!acts.length && am.quantite === null && am.pu === null && lastLine && /^(?:sur|sous|derri[eè]re|devant|contre|autour|le long|au-dessus|au dessus|c[oô]t[ée]|vers|pr[eè]s)\s/i.test(desc)) continue;
    // même prestation sur une autre zone (« pose du carrelage au mur 20 m² et au sol 5 m² »)
    if (!acts.length && !others.length && zones.length && am.quantite !== null && !am.compte && lastFrame && lastFrame.line && lastFrame.line.biblio_id && lastFrame.action !== "peintur" && lastAction !== "peintur" && am.unite === lastFrame.line.unite) {
      const nl = cloneLine(lastFrame.line, { quantite: am.quantite, raw, estime: false }); if (am.pu !== null) { nl.pu = am.pu; nl.source = "dicte"; } addLine(nl, room || lastFrame.titre); continue; }
    // phrase d'introduction reprise mot pour mot juste après (« avec une porte donc un bloc-porte »)
    if (seg.intro && !acts.length && merged[si + 1] && tk.length && low(desc).split(/[^a-z0-9]+/).filter(w => w.length > 3 && !STOP.has(w)).every(w => low(merged[si + 1].raw).includes(w))) continue;
    // ellipse : « … et le plafond 11 m² », « … 3 interrupteurs », « … plus le radiateur »
    let inherited = null;
    const wantInherit = !acts.length && lastAction && lastFrame && (seg.lead !== "hard" || zones.length || /^(?:le|la|les|l'|du|des|un|une|\d)/i.test(desc));
    const opt = { neg, sansQte: am.quantite === null };
    if (lastFrame && lastFrame.carrelage && others.length === 1 && others[0] === "plinth") opt.boost = ["carrelag"];
    else if (others.includes("plinth") && !acts.includes("peintur") && lastAction !== "peintur" && !tk.includes("carrelag")) opt.boost = ["boi"];
    // peinture simple : murs / plafond, pièce humide, surfaces estimées
    const paintAct = acts.includes("peintur") || (!acts.length && wantInherit && lastAction === "peintur" && !others.length && zones.length);
    const plain = paintAct && acts.every(a => a === "peintur" || a === "refect") && others.every(t => t === "wc" || t === "sdb" || t === "satin" || t === "velour" || t === "mat" || t === "blanc" || t === "blanch" || t === "couch" || t === "piec" || t === "humid" || t === "interieur" || t === "complet" || t === "classiqu" || t === "tollen");
    if (plain && !neg.includes("mur")) {
      const fx = factsFor(room); const zs = zones.filter(z => z !== "sol" && !neg.includes(z));
      const mk = (q, qty, extra) => { const b = findBib(q); if (!b) return null; const L2 = fromBib(b, Object.assign({ quantite: qty, unite: b.unite, raw, cle: learnKey(q) }, extra || {})); if (am.pu !== null && qty !== null) { L2.pu = am.pu; L2.source = "dicte"; } if (fc) L2.fournitureComprise = true; return L2; };
      const nc = L2 => { if (F.couches && F.couches !== 2) { const f = x => x.replace(/(?<!\d)2 couches/g, `${F.couches} couches`); L2.designation = f(L2.designation); L2.details = L2.details.map(f); } return L2; };
      const key = titre + "|" + (zs.join("+") || "tout");
      const qM = am.unite === "m²" ? am.quantite : null;
      let made = [];
      if (humid && zs.length !== 1) { const L2 = mk("peinture murs plafond pièce humide wc salle d'eau", qM); if (L2) made.push(L2); }
      else if (qM !== null) {
        if (zs.length === 2) { const a = mk("peinture des murs", qM), b = mk("peinture des plafonds", null); made.push(a, b); notes.push(`« ${raw} » : la surface a été mise sur les murs ; indiquez celle du plafond.`); }
        else made.push(mk(zs[0] === "plafond" ? "peinture des plafonds" : "peinture des murs", qM));
      } else if (fx && fx.sol && !paintDone.has(titre) && !(fx._fait && !room)) {
        const h = fx.haut || 2.5, murs = Math.round(4 * Math.sqrt(fx.sol) * h * 10) / 10;
        if (!zs.length || zs.includes("mur")) { const a = mk("peinture des murs", murs, { estime: true, estimeInfo: { sol: fx.sol, hauteur: h } }); if (a) { a.details = a.details.concat([`Surface estimée : pièce de ${fr(fx.sol)} m² au sol, hauteur ${fr(h)} m (à vérifier, ouvertures non déduites)`]); made.push(a); notes.push(`Peinture : ${fr(murs)} m² de murs calculés pour une pièce carrée de ${fr(fx.sol)} m² au sol et ${fr(h)} m de hauteur. Mesurez sur place et corrigez si besoin.`); if (fx.haut && fx.haut < 2.2) notes.push(`Hauteur sous plafond de ${fr(fx.haut)} m : inhabituelle, vérifiez la dictée.`); } }
        if (!zs.length || zs.includes("plafond")) made.push(mk("peinture des plafonds", fx.sol));
        paintDone.add(titre); fx._fait = true;
      } else if (fx && fx.sol && (paintDone.has(titre) || (fx._fait && !room))) { continue; }
      else {
        if (zs.length === 2 || (!zs.length && /murs?\s+et\s+plafonds?/i.test(raw))) made.push(mk("peinture des murs", null), mk("peinture des plafonds", null));
        else made.push(mk(zs[0] === "plafond" ? "peinture des plafonds" : "peinture des murs", null));
      }
      made = made.filter(Boolean).map(nc);
      if (made.length) {
        if (F.couches && F.couches > 2 && !F.couchesNote) { notes.push(`${F.couches} couches demandées : le prix catalogue est prévu pour 2 couches, ajustez le prix au m² si besoin.`); F.couchesNote = true; }
        for (const L2 of made) {
          // même prestation déjà notée sans quantité dans cette pièce : on la complète
          const ex = getSec(titre).lignes.find(x => x.biblio_id === L2.biblio_id && x.quantite === null);
          if (ex && L2.quantite !== null) { ex.quantite = L2.quantite; ex.raw += " " + raw; lastLine = ex; continue; }
          if (L2.quantite === null && getSec(titre).lignes.some(x => x.biblio_id === L2.biblio_id)) continue;
          addLine(L2, titre);
        }
        lastAction = "peintur"; lastFrame = { line: lastLine, titre, action: "peintur" }; continue;
      }
    }
    // appariement au catalogue (avec et sans l'action héritée)
    const key = [...new Set(tk)].sort().join(" ") || learnKey(desc); ligne.cle = key;       // clé d'apprentissage : mots utiles, sans la pièce ni les quantités
    if (!am.compte && (am.unite === "h" || am.unite === "jour")) { tk = tokens(desc.replace(/\spour\s.*$/i, " ")).filter(t => !roomTok.has(t)).concat([am.unite === "h" ? "heur" : "jour"]); acts = tk.filter(t => ACTIONS.has(t)); others = tk.filter(t => !ACTIONS.has(t) && !ZONES.has(t)); }
    let ms = matchTokens(index, tk, am.compte ? null : am.unite, opt), d = decide(ms);
    if (acts.length === 1 && !others.length && !zones.length && d.ok && d.best.score < 0.85) d = Object.assign({}, d, { ok: false, sure: false });       // un verbe seul ne suffit pas
    if (wantInherit) {
      const ms2 = matchTokens(index, [lastAction].concat(tk), am.compte ? null : am.unite, opt), d2 = decide(ms2);
      const parallel = /^soft/.test(seg.lead) && /^(?:le|la|les|l'|du|des|un|une|\d)/i.test(desc) && (ACT_GROUP[lastAction] || 0) >= 1 && (ACT_GROUP[lastAction] || 0) <= 3;
      if (d2.ok && (!d.ok || !d.sure || d2.best.b.id === d.best.b.id || d2.best.score >= d.best.score + 0.1 || (parallel && d2.best.score >= d.best.score - 0.1))) { ms = ms2; d = d2; inherited = lastAction; }
    }
    if (humid && tk.includes("carrelag") === false && false) {}
    let learned = false;
    if (Object.prototype.hasOwnProperty.call(appris, key)) { const id = appris[key]; if (id === null) { d = { best: null, ok: false, sure: false, conf: 0 }; learned = true; } else if (index.byId.has(id)) { const b = index.byId.get(id).b; d = { best: { b, score: 1, hits: 9, objHit: true }, ok: true, sure: true, conf: 1 }; learned = true; } }
    ligne.suggestions = ms.slice(0, 5).map(x => ({ id: x.b.id, designation: x.b.designation, pu: x.b.pu, unite: x.b.unite, score: x.score }));
    if (d.ok && seg.intro && !learned && am.quantite === null && am.pu === null) {
      const mine = new Set(tk.filter(t => !ACTIONS.has(t) && !ZONES.has(t)));
      const suite = merged.slice(si + 1, si + 4).some(x => tokens(x.raw).some(t => mine.has(t)));
      if (!d.sure || suite) continue; }
    if (d.ok) {
      const b = d.best.b; const std = ["m²", "ml", "m³", "h", "jour", "forfait", "u"];
      ligne.designation = b.designation; ligne.details = (b.details || []).slice(); ligne.biblio_id = b.id; ligne.confiance = d.conf; if (learned) ligne.appris = true;
      if (!d.sure && !learned) { ligne.incertain = true; aConfirmer.push(ligne); }
      // quantité : cohérence avec l'unité de la prestation
      if (am.compte && ["m²", "ml", "m³"].includes(b.unite)) { ligne.quantite = null; ligne.unite = b.unite; }
      if (am.compte && b.unite === "forfait") { ligne.quantite = 1; ligne.unite = "forfait"; }
      if (am.compte && !std.includes(b.unite)) ligne.unite = b.unite;
      if (!am.compte && am.unite === "ml" && b.unite === "m²" && am.quantite !== null) { ligne.unite = "ml"; }
      if (!ligne.unite) ligne.unite = b.unite;
      if (b.unite === "forfait" && (ligne.quantite === null || am.unite === null)) { ligne.quantite = 1; ligne.unite = "forfait"; }
      if (b.unite === "forfait" && am.total === null && am.pu === null && ["m²", "ml", "m³"].includes(am.unite || "")) { /* quantité dictée conservée en détail */ ligne.details = ligne.details.concat([`Surface concernée : ${fr(am.quantite)} ${am.unite}`]); ligne.quantite = 1; ligne.unite = "forfait"; }
      if (b.unite === "u" && ligne.quantite === null) { ligne.quantite = 1 + (seg.conj || 0); ligne.unite = "u"; }
      if (am.pu !== null) { ligne.pu = am.pu; ligne.source = "dicte"; }
      else if (b.pu !== null && b.pu !== undefined) { ligne.pu = b.pu; ligne.source = "bibliotheque"; }
      ligne.reformule = reformulate(desc); if (ligne.lieu) ligne.details = ligne.details.concat([cap(ligne.lieu)]);
      // main-d'œuvre au temps : le motif devient un détail
      if ((b.unite === "h" || b.unite === "jour")) { const pm = desc.match(/\spour\s+(.{4,90})$/i); if (pm) ligne.details = ligne.details.concat([cap("pour " + pm[1].trim())]); }
      const spec = raw.match(/(?<![\d,.])\d+\s*L(?![\wà-ÿ])/); if (spec) ligne.details = ligne.details.concat([`Capacité : ${spec[0].replace(/\s+/g, " ")}`]);
    } else {
      // rien de sûr dans le catalogue : ligne « à compléter », jamais rattachée de force
      if (seg.intro && am.quantite === null && am.pu === null) continue;                                    // phrase d'introduction détaillée juste après (« … donc … »)
      if (acts.length === 1 && !others.length && !zones.length && am.quantite === null && am.pu === null) continue;  // verbe seul
      if (acts.length === 1 && acts[0] === "refect" && am.quantite === null && am.pu === null) { ignored.push(raw); continue; }                // « réfection de la douche » : annonce, détaillée ensuite (« dépose et remplacement ») : déjà couvert
      const enonce = /^(?:je|j'|on|nous)\s*(?:lui\s+|leur\s+|y\s+)?[a-zà-ÿ]{3,}(?:e|es|s|t|ons|is|ds)\s+(?:le|la|les|l'|un|une|des|du|son|sa|ses)\s*[a-zà-ÿ]{3,}/i.test(seg.raw.trim()) && others.length >= 2 && tk.length <= 5 && !seg.intro;
      if (!acts.length && am.quantite === null && am.pu === null && !enonce) {
        if (others.length + zones.length >= 2 && tk.length <= 14) { ignored.push(raw); notes.push(`Phrase non retenue : « ${raw.slice(0, 90)}${raw.length > 90 ? "…" : ""} »`); }
        continue; }
      if (tk.length > 14) { ignored.push(raw); notes.push(`Phrase non retenue : « ${raw.slice(0, 90)}… »`); continue; }
      ligne.designation = reformulate(desc); ligne.confiance = 0; ligne.horsCatalogue = true;
      if (am.pu !== null) { ligne.pu = am.pu; ligne.source = "dicte"; }
      if (!ligne.unite) ligne.unite = ligne.quantite === 1 || ligne.quantite === null ? "forfait" : "m²";
      if (ligne.unite === "forfait" && ligne.quantite === null) ligne.quantite = 1;
    }
    if (fc) ligne.fournitureComprise = true;
    // carrelage : format, joints, pose
    const isPoseCarrelage = ligne.biblio_id ? (/carrelage|fa(?:i|ï)ence/i.test(ligne.designation) && /^pose/i.test(ligne.designation) && !/plinthe/i.test(ligne.designation)) : /^(?:pose|mise en (?:place|œuvre))(?![\wà-ÿ]).*(?:carrel|fa(?:i|ï)ence|mosa)/i.test(ligne.designation);
    if (isPoseCarrelage) { ligne.tile = { fmt: tile.fmt, tier: tile.tier, jointFin: tile.jointFin, epoxy: tile.epoxy, pose: tile.pose }; applyTile(ligne, ligne.tile, false); }
    if (ligne.biblio_id && lastLine && lastLine.type === "mo" && lastLine.biblio_id && lastLine.biblio_id !== ligne.biblio_id && lastLineSi >= si - 1 && am.quantite === null && am.pu === null && !learned) {
      const mainOf = e => [...e.D].filter(([t, w]) => w === 1 && t !== "seul" && t !== "pos").map(([t]) => t);
      const eN = index.byId.get(ligne.biblio_id), eL = index.byId.get(lastLine.biblio_id), lm = eL ? mainOf(eL) : [], nm = new Set(eN ? mainOf(eN) : []);
      if (lm.length && lm.every(t => nm.has(t)) && nm.size > new Set(lm).size && (eL.b.unite === eN.b.unite || lastLine.quantite === 1)) {
        const b = eN.b; Object.assign(lastLine, { designation: b.designation, details: (b.details || []).slice(), biblio_id: b.id }); if (lastLine.source !== "dicte") { lastLine.pu = b.pu ?? null; lastLine.source = lastLine.pu === null ? "a_saisir" : "bibliotheque"; }
        if (b.unite === "forfait" && (lastLine.quantite === null || lastLine.quantite === 1)) { lastLine.quantite = 1; lastLine.unite = "forfait"; }
        lastLine.raw += " " + raw; lastLineSi = si; if (acts.length) lastAction = acts.find(a => a !== "refect") || acts[0]; continue; } }
    const sec = getSec(titre);
    // même prestation dictée deux fois
    if (ligne.biblio_id) {
      const same = sec.lignes.filter(x => x.biblio_id === ligne.biblio_id);
      const anyw = sections.flatMap(s => s.lignes).filter(x => x.biblio_id === ligne.biblio_id);
      const explicitQ = am.quantite !== null || (!!inherited && /^une?\s/i.test(desc) && ligne.unite === "u");
      const zs = x => [...new Set(tokens(String(x || "")).filter(t => ZONES.has(t)))].sort().join("+");
      const autreZone = same.length && zs(raw) && same.every(x => zs(x.raw) && zs(x.raw) !== zs(raw));       // « carrelage au sol » puis « carrelage au mur » : deux lignes
      if (!explicitQ && same.length && !autreZone && !(ligne.unite === "u" && seg.conj)) { lastFrame = { line: anyw[anyw.length - 1], titre, action: acts[0] || inherited || lastAction, carrelage: isPoseCarrelage }; if (acts.length) lastAction = acts.find(a => a !== "refect") || acts[0]; continue; }
      const open = same.find(x => x.quantite === null || (x._implicit && x.unite === ligne.unite)) || anyw.find(x => x.quantite === null) || (lastLine && lastLine._implicit && lastLine.biblio_id === ligne.biblio_id ? lastLine : null);
      if (explicitQ && open) { if (!sec.lignes.includes(open)) { for (const s2 of sections) { const k = s2.lignes.indexOf(open); if (k >= 0) s2.lignes.splice(k, 1); } sec.lignes.push(open); } open.quantite = ligne.quantite; if (ligne.unite) open.unite = ligne.unite; if (am.pu !== null) { open.pu = am.pu; open.source = "dicte"; } open.raw += " " + raw; delete open._implicit; lastLine = open; lastFrame = { line: open, titre, action: acts[0] || inherited || lastAction, carrelage: isPoseCarrelage }; if (acts.length) lastAction = acts.find(a => a !== "refect") || acts[0]; continue; }
      if (explicitQ && lastLine && lastLine.biblio_id === ligne.biblio_id && lastLine.quantite === ligne.quantite && lastLine.unite === ligne.unite && sec.lignes.includes(lastLine)) continue;
      if (!explicitQ) ligne._implicit = true;
    }
    // sols sans quantité : surface au sol dictée
    { const fx = factsFor(room); if (fx && fx.sol && ligne.quantite === null && ligne.unite === "m²" && tk.some(t => /^(?:parquet|sol|carrelag|ragreag|vitrif|moquett|vinyle|poncag)$/.test(t)) && !zones.includes("mur") && !/fa[iï]ence|mural/i.test(raw)) { ligne.quantite = fx.sol; ligne.details = ligne.details.concat([`Surface au sol : ${fr(fx.sol)} m²`]); } }
    addLine(ligne, titre);
    lastFrame = { line: ligne, titre, action: acts.find(a => a !== "refect") || acts[0] || inherited || null, carrelage: isPoseCarrelage };
    if (acts.length) lastAction = acts.find(a => a !== "refect") || acts[0]; else if (inherited) lastAction = inherited; else if (hardLead) lastAction = null;
  }
  function applyTile(ligne, tile, redo) {
    const gT = tile; const tier = tileTier(gT, TC); const plus = []; let delta = 0;
    const fmtTxt = x => x.fmt ? `${x.fmt[0]}×${x.fmt[1]}` : "";
    const base0 = ligne._tileBase || { designation: ligne.designation, details: ligne.details.slice(), pu: ligne.pu }; ligne._tileBase = base0;
    ligne.designation = base0.designation; ligne.details = base0.details.slice(); if (ligne.source === "bibliotheque") ligne.pu = base0.pu; delete ligne.ajustCarrelage;
    if (tier) { delta += Number(tier.delta) || 0; ligne.details = [`Carreaux ${gT.fmt ? fmtTxt(gT) + " cm (" + tier.nom + ")" : tier.nom}`, ...ligne.details]; }
    if (gT.jointFin) { delta += Number(TC.jointFin) || 0; plus.push("joints fins"); ligne.details.push("Joints fins (1 à 2 mm), carreaux rectifiés, calepinage soigné"); }
    if (gT.epoxy) { delta += Number(TC.epoxy) || 0; plus.push("joint époxy"); ligne.details.push("Jointoiement à la résine époxy"); }
    if (gT.pose) { delta += Number(TC[gT.pose]) || 0; plus.push(gT.pose === "decale" ? "pose décalée" : gT.pose === "diagonale" ? "pose en diagonale" : "pose en chevrons"); }
    if (tier || plus.length) {
      ligne.designation = ligne.designation.replace(/,?\s*jointoiement compris/i, "") + (gT.fmt ? `, format ${fmtTxt(gT)}` : tier ? `, ${tier.nom}` : "") + (plus.length ? ", " + plus.join(", ") : "") + (/jointoiement compris/i.test(base0.designation) ? ", jointoiement compris" : "");
      if (ligne.source === "bibliotheque" && ligne.pu !== null && delta) {
        const base = base0.pu; ligne.pu = Math.max(0, r2(base + delta)); ligne.ajustCarrelage = delta;
        ligne._tileNote = `Carrelage ${gT.fmt ? fmtTxt(gT) : tier ? tier.nom : ""}${plus.length ? " (" + plus.join(", ") + ")" : ""} : pose à ${fr(ligne.pu)} €/m² au lieu de ${fr(base)} € (${delta > 0 ? "+" : ""}${fr(delta)} €). Barème réglable dans Réglages.`;
      }
    }
  }
  { const zoneDe = l => { const r = low((l.raw || "")), d = low(l.designation);
      const mur = /(?<![a-z])murs?(?![a-z])|mural|faience|papier|toile de verre|enduit|ratiss/.test(r), sol = /(?<![a-z])sols?(?![a-z])|parquet|moquette|lino|vinyle|pvc|ragre|stratifi|vitrifi|ponc/.test(r), pla = /plafond/.test(r);
      if (mur && (sol || (/carrelage/.test(r) && /faience/.test(r)))) return "mur+sol"; if (mur && pla) return "mur+plafond"; if (pla) return "plafond"; if (mur) return "mur"; if (sol) return "sol";
      if (/plafond/.test(d) && /murs?/.test(d)) return "mur+plafond"; if (/^peinture des plafonds|faux plafond/.test(d)) return "plafond";
      if (/^peinture des murs|papier peint|enduit|ratissage|toile de verre|doublage|etancheite de murs/.test(d)) return "mur";
      if (/de sol|parquet|ragreage|carrelage|vinyle/.test(d)) return "sol"; return null; };
    const seules = Object.keys(F.rooms).filter(k => k !== "*");
    for (const sec of sections) { if (sec.titre === "Fournitures" || sec.titre === "Frais de chantier") continue;
      const fx = F.rooms[sec.titre] || (sec.titre === "Travaux" && !seules.length ? F.rooms["*"] : null) || {};
      let sol = fx.sol || null, deduit = false;
      if (!sol) { const fl = sec.lignes.find(l => l.type === "mo" && l.unite === "m²" && l.quantite !== null && !l.estime && zoneDe(l) === "sol"); if (fl && sec.titre !== "Travaux") { sol = fl.quantite; deduit = true; } }
      if (!sol) continue;
      const h = fx.haut || 2.5, murs = Math.round(4 * Math.sqrt(sol) * h * 10) / 10; let nM = 0, nS = 0;
      for (const l of sec.lignes) { if (l.type !== "mo" || l.unite !== "m²" || l.quantite !== null) continue; const z = zoneDe(l); if (!z) continue;
        if (z === "sol" || z === "plafond") { l.quantite = sol; l.details = (l.details || []).concat([`Surface ${z === "sol" ? "au sol" : "du plafond"} : ${fr(sol)} m²`]); nS++; }
        else { l.quantite = r2(murs + (z === "mur" ? 0 : sol)); l.estime = true; l.estimeInfo = { sol, hauteur: h }; l.details = (l.details || []).concat([`Surface estimée : pièce de ${fr(sol)} m² au sol, hauteur ${fr(h)} m (à vérifier, ouvertures non déduites)`]); nM++; } }
      if (nM) notes.push(`${sec.titre} : ${fr(murs)} m² de murs calculés pour une pièce carrée de ${fr(sol)} m² au sol et ${fr(h)} m de hauteur${fx.haut ? "" : " (hauteur supposée)"}. Mesurez sur place et corrigez si besoin.`);
      if (nS && deduit) notes.push(`${sec.titre} : ${fr(sol)} m² au sol repris pour les lignes sans surface.`); } }
  // format de carrelage dit une seule fois : vaut pour les autres lignes de pose
  { const tl = sections.flatMap(s => s.lignes).filter(l => l.tile); const withF = tl.filter(l => l.tile.fmt || l.tile.tier); const kinds = new Set(withF.map(l => l.tile.fmt ? l.tile.fmt.join("x") : l.tile.tier));
    if (kinds.size === 1) for (const l of tl) if (!l.tile.fmt && !l.tile.tier) applyTile(l, Object.assign({}, l.tile, { fmt: withF[0].tile.fmt, tier: withF[0].tile.tier }), true);
    for (const l of tl) { if (l._tileNote) notes.push(l._tileNote); } }
  // famille « Protection, nettoyage… » : variante selon la taille du chantier
  { const rooms = sections.map(s => s.titre).filter(t => !["Travaux", "Fournitures", "Frais de chantier"].includes(t));
    const hint = lt.match(/(?:c'est|pour|sur|compter?|comme|en)\s+(?:un\s+)?(petit|gros|grand|moyen)\s+chantier(?!\s+ou)|chantier\s+(moyen|normal|important|de taille moyenne)|(petite) intervention/);
    const sizeHint = hint ? (/petit/.test(hint[0]) ? 0 : /moyen|normal/.test(hint[0]) ? 1 : 2) : null;
    const size = sizeHint !== null ? sizeHint : F.renov || rooms.length >= 4 || /r[ée]novation\s+compl[eè]te\s+(?:de\s+|d')(?:l'appartement|la\s+maison|du\s+logement)|tout\s+l'appartement|toute\s+la\s+maison/i.test(text) ? 2 : (rooms.length >= 2 || rooms.some(r => /^Salle/.test(baseOf(r)))) ? 1 : 0;
    for (const s of sections) for (const l of s.lignes) { const d0 = l.biblio_id && index.byId.get(l.biblio_id); if (!d0 || !d0.variant || l.appris) continue; const stemD = d0.b.designation.split(/\s[—–]\s/)[0];
      const fam = index.docs.filter(x => x.variant && x.b.designation.split(/\s[—–]\s/)[0] === stemD && x.b.unite === d0.b.unite); if (fam.length < 2) continue;
      const rank = x => /compl[eè]te|logement|grand|gros/i.test(x.b.designation.split(/\s[—–]\s/)[1] || "") ? 2 : /moyen|2-3|salle/i.test(x.b.designation.split(/\s[—–]\s/)[1] || "") ? 1 : /petit|1 pi[eè]ce/i.test(x.b.designation.split(/\s[—–]\s/)[1] || "") ? 0 : -1;
      const pick = fam.find(x => rank(x) === size); if (pick && pick.b.id !== l.biblio_id) { l.biblio_id = pick.b.id; l.designation = pick.b.designation; l.details = (pick.b.details || []).slice(); if (l.source === "bibliotheque" || l.source === "a_saisir") { l.pu = pick.b.pu ?? null; l.source = l.pu === null ? "a_saisir" : "bibliotheque"; } } } }
  // nettoyage des champs internes
  for (const s of sections) for (const l of s.lignes) { delete l._implicit; delete l._tileBase; delete l._tileNote; delete l.tile; delete l._tk; delete l.descUtile; }
  for (let i = sections.length - 1; i >= 0; i--) if (!sections[i].lignes.length) sections.splice(i, 1);
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
  const nbInc = sections.reduce((a, s) => a + s.lignes.filter(l => l.incertain).length, 0);
  if (nbInc) notes.push(`${nbInc} ligne(s) à vérifier : la prestation choisie n'est pas certaine (touchez « Prestations proches »).`);
  if (dureeJours) notes.push(`Durée du chantier : ${fr(dureeJours)} jour(s) ouvré(s), reprise dans le suivi du devis.`);
  return { client, objet, tva, sections, notes, chantier: "", dureeJours, debut, ignored };
}

const Moteur = { VERSION: 2, CARRELAGE_DEFAUT, analyse, reformulate, match, matchTokens, decide, buildIndex, tokens, convertNumbers, normalizeOral, parseAmounts, splitClauses, segmenter, extractClient, learnKey };
if (typeof module !== "undefined" && module.exports) module.exports = Moteur; else root.Moteur = Moteur;
})(typeof window !== "undefined" ? window : globalThis);
