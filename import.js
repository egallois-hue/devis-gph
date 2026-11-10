/* Import de devis déjà faits (.doc Word 97, .docx, .pdf, .txt) → format de l'application.
   Lecture 100 % locale : rien ne part sur Internet. */
(function (root) {
"use strict";
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

/* ---------- .doc (Word 97-2003) : conteneur OLE + table des pièces ---------- */
function readCFB(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf);
  if (v.getUint32(0, true) !== 0xE011CFD0) throw new Error("Pas un fichier Word .doc");
  const ss = 1 << v.getUint16(30, true), mss = 1 << v.getUint16(32, true);
  const nFat = v.getUint32(44, true), dir0 = v.getInt32(48, true), cutoff = v.getUint32(56, true);
  const mf0 = v.getInt32(60, true), nMf = v.getUint32(64, true); let dif = v.getInt32(68, true);
  const off = s => 512 + s * ss;
  const fatSecs = []; for (let i = 0; i < 109 && fatSecs.length < nFat; i++) fatSecs.push(v.getInt32(76 + i * 4, true));
  while (fatSecs.length < nFat && dif >= 0) { for (let i = 0; i < ss / 4 - 1 && fatSecs.length < nFat; i++) fatSecs.push(v.getInt32(off(dif) + i * 4, true)); dif = v.getInt32(off(dif) + ss - 4, true); }
  const fat = []; for (const s of fatSecs) for (let i = 0; i < ss / 4; i++) fat.push(v.getInt32(off(s) + i * 4, true));
  const chain = (s, t) => { const o = []; let g = 0; while (s >= 0 && g++ < 1e6) { o.push(s); s = t[s]; } return o; };
  const readChain = (s, size) => { const out = new Uint8Array(size); let p = 0; for (const c of chain(s, fat)) { const n = Math.min(ss, size - p); if (n <= 0) break; out.set(u8.subarray(off(c), off(c) + n), p); p += n; } return out; };
  const dirBytes = (() => { const cs = chain(dir0, fat); const o = new Uint8Array(cs.length * ss); cs.forEach((c, i) => o.set(u8.subarray(off(c), off(c) + ss), i * ss)); return o; })();
  const dv = new DataView(dirBytes.buffer), ents = [];
  for (let i = 0; i + 128 <= dirBytes.length; i += 128) {
    const nl = dv.getUint16(i + 64, true); let name = ""; for (let k = 0; k < nl / 2 - 1; k++) name += String.fromCharCode(dv.getUint16(i + k * 2, true));
    ents.push({ name, type: dirBytes[i + 66], start: dv.getInt32(i + 116, true), size: dv.getUint32(i + 120, true) });
  }
  const rootE = ents[0]; const ministream = rootE && rootE.start >= 0 ? readChain(rootE.start, rootE.size) : new Uint8Array(0);
  const minifat = []; if (nMf) for (const c of chain(mf0, fat)) for (let i = 0; i < ss / 4; i++) minifat.push(v.getInt32(off(c) + i * 4, true));
  return name => {
    const e = ents.find(x => x.name === name && x.type === 2); if (!e) return null;
    if (e.size < cutoff) { const out = new Uint8Array(e.size); let p = 0; for (const c of chain(e.start, minifat)) { const n = Math.min(mss, e.size - p); if (n <= 0) break; out.set(ministream.subarray(c * mss, c * mss + n), p); p += n; } return out; }
    return readChain(e.start, e.size);
  };
}
const CP1252 = { 0x80: "€", 0x82: "‚", 0x84: "„", 0x85: "…", 0x8C: "Œ", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x99: "™", 0x9C: "œ" };
function docText(buf) {
  const get = readCFB(buf);
  const wd = get("WordDocument"); if (!wd) throw new Error("Document Word illisible");
  const w = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
  const flags = w.getUint16(10, true); const tbl = get(flags & 0x0200 ? "1Table" : "0Table"); if (!tbl) throw new Error("Table Word introuvable");
  const t = new DataView(tbl.buffer, tbl.byteOffset, tbl.byteLength);
  const ccpText = w.getUint32(76, true), fcClx = w.getUint32(418, true), lcbClx = w.getUint32(422, true);
  let p = fcClx; const end = fcClx + lcbClx;
  while (p < end && tbl[p] === 1) p += 3 + t.getUint16(p + 1, true);
  if (tbl[p] !== 2) throw new Error("Structure Word inattendue");
  const lcb = t.getUint32(p + 1, true); p += 5; const n = (lcb - 4) / 12;
  let out = "";
  for (let i = 0; i < n && out.length < ccpText; i++) {
    const cp0 = t.getUint32(p + i * 4, true), cp1 = t.getUint32(p + (i + 1) * 4, true);
    let fc = t.getUint32(p + (n + 1) * 4 + i * 8 + 2, true); const comp = (fc & 0x40000000) !== 0;
    const len = cp1 - cp0;
    if (comp) { fc = (fc & 0x3FFFFFFF) / 2; for (let k = 0; k < len; k++) { const b = wd[fc + k]; out += CP1252[b] || String.fromCharCode(b); } }
    else for (let k = 0; k < len; k++) out += String.fromCharCode(w.getUint16(fc + k * 2, true));
  }
  out = out.slice(0, ccpText);
  out = out.replace(/\x13[^\x14\x15]*\x14?/g, "").replace(/[\x13\x14\x15\x01\x08]/g, "");
  return out.replace(/\x07/g, "\t").replace(/\x0b/g, "\n").replace(/\r/g, "\n").replace(/\x0c/g, "\n").replace(/ /g, " ");
}

/* ---------- .docx : zip minimal + XML ---------- */
async function inflateRaw(bytes) {
  const ds = new DecompressionStream("deflate-raw");
  const s = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function zipEntry(buf, wanted) {
  const v = new DataView(buf), u8 = new Uint8Array(buf);
  let e = buf.byteLength - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("Fichier .docx illisible");
  let p = v.getUint32(e + 16, true); const cnt = v.getUint16(e + 10, true);
  for (let i = 0; i < cnt; i++) {
    const meth = v.getUint16(p + 10, true), csz = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), lo = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    if (name === wanted) { const d0 = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true); const data = u8.subarray(d0, d0 + csz); return new TextDecoder().decode(meth === 0 ? data : await inflateRaw(data)); }
    p += 46 + nl + xl + cl;
  }
  return null;
}
async function docxText(buf) {
  const xml = await zipEntry(buf, "word/document.xml"); if (!xml) throw new Error("Contenu .docx introuvable");
  const ent = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  return ent(xml.replace(/<w:tab\/>/g, "\t").replace(/<w:br[^>]*\/>/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<\/w:tc>/g, "\t").replace(/<[^>]+>/g, ""));
}

/* ---------- .pdf : pdf.js chargé à la demande ---------- */
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Chargement impossible : " + src)); document.head.appendChild(s); }); }
async function pdfText(buf) {
  if (!root.pdfjsLib) { await loadScript("vendor/pdfjs/pdf.min.js"); root.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.js"; }
  const pdf = await root.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  return pdfItemsToText(pdf);
}
async function pdfItemsToText(pdf) {
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const tc = await (await pdf.getPage(i)).getTextContent();
    const rows = [];
    for (const it of tc.items) { if (!it.str || !it.str.trim()) continue; const y = it.transform[5], x = it.transform[4];
      let r = rows.find(r => Math.abs(r.y - y) < 3); if (!r) { r = { y, items: [] }; rows.push(r); } r.items.push({ x, s: it.str, w: it.width }); }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) { r.items.sort((a, b) => a.x - b.x); let line = "", lastEnd = null;
      for (const it of r.items) { if (lastEnd !== null) line += it.x - lastEnd > 12 ? "\t" : (it.x - lastEnd > 1 ? " " : ""); line += it.s; lastEnd = it.x + (it.w || 0); }
      out += line + "\n"; }
    out += "\n\f\n";
  }
  return out;
}

async function extractText(file) {
  const buf = await file.arrayBuffer(); const n = (file.name || "").toLowerCase(); const u8 = new Uint8Array(buf.slice(0, 4));
  if (u8[0] === 0x25 && u8[1] === 0x50) return pdfText(buf);                       // %PDF
  if (u8[0] === 0xD0 && u8[1] === 0xCF) return docText(buf);                       // .doc
  if (u8[0] === 0x50 && u8[1] === 0x4B) return docxText(buf);                      // .docx
  if (/\.(txt|rtf)$/.test(n)) return new TextDecoder().decode(buf);
  throw new Error("Format non pris en charge (PDF, Word .doc ou .docx)");
}

/* ---------- Lecture du contenu d'un devis ---------- */
const MOIS = { janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12 };
const AMT = "(?<![\\w.,])(-?\\d{1,3}(?:[ \\u202f.]\\d{3})+(?:,\\d{1,2})?|-?\\d+(?:[.,]\\d{1,2})?)\\s*€";
const toNum = s => Number(String(s).replace(/[\s ]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
const UNITS = [["m²", /^(?:m2|m²|m\s?2|m(?:e|è)tres?\s*carr(?:e|é)s?)$/i], ["ml", /^(?:ml|m\.?l\.?|m(?:e|è)tres?\s*lin(?:e|é)aires?)$/i], ["m³", /^(?:m3|m³)$/i],
  ["u", /^(?:u|unit(?:e|é)s?|pi(?:e|è)ces?|pcs?|ens\.?)$/i], ["forfait", /^(?:f|ft|forfaits?|fft)$/i], ["h", /^(?:h|heures?)$/i], ["jour", /^(?:j|jours?)$/i]];
const unitOf = s => { s = String(s || "").trim(); for (const [u, re] of UNITS) if (re.test(s)) return u; return null; };
function cleanLine(s) { return s.replace(/\t+/g, " ").replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim(); }

function parseDevis(text, fileName) {
  const raw = String(text).replace(/\r/g, "\n").replace(/\f/g, "\n");
  const lines = raw.split("\n").map(s => s.replace(/\s+$/, ""));
  const flat = lines.join("\n");
  const d = { numero: null, date: null, objet: "", tva: 10, client: { nom: "", adresse: "", cpVille: "", email: "", tel: "" }, sections: [], totalDoc: {}, notes: [] };
  // numéro
  const nm = flat.match(/DEVIS\s*N\s*°?\s*:?\s*(\d{4})\s*(\d{2})\s*N\s*(\d{1,3})/i) || (fileName || "").match(/(\d{4})(\d{2})N(\d{1,3})/i);
  if (nm) d.numero = nm[1] + nm[2] + "N" + String(Number(nm[3])).padStart(2, "0");
  const fnm = (fileName || "").match(/(\d{4})(\d{2})N(\d{1,3})/i);
  // date
  let dm = flat.match(/\ble\s+(\d{1,2})(?:er)?\s+([a-zéûè]+)\s+(\d{4})/i);
  if (dm && MOIS[dm[2].toLowerCase()]) d.date = `${dm[3]}-${String(MOIS[dm[2].toLowerCase()]).padStart(2, "0")}-${String(dm[1]).padStart(2, "0")}`;
  else if ((dm = flat.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/))) d.date = `${dm[3]}-${dm[2]}-${dm[1]}`;
  else if (d.numero) d.date = `${d.numero.slice(0, 4)}-${d.numero.slice(4, 6)}-01`;
  if (fnm && d.date) { const fn = fnm[1] + fnm[2] + "N" + String(Number(fnm[3])).padStart(2, "0");
    if (fn !== d.numero && d.date.slice(0, 4) + d.date.slice(5, 7) === fnm[1] + fnm[2]) { if (d.numero) d.notes.push(`Numéro du document (${d.numero}) corrigé en ${fn} d'après le nom du fichier et la date.`); d.numero = fn; } }
  // TVA
  const tv = flat.match(/TVA\s*(?:à|a|de)?\s*(\d{1,2}(?:[.,]5)?)\s*%/i); if (tv) d.tva = Number(tv[1].replace(",", "."));
  // totaux du document (contrôle)
  const ths = [...flat.matchAll(new RegExp("TOTAL\\s*(?:G[ÉE]N[ÉE]RAL\\s*)?H\\.?\\s*T\\.?\\s*:?\\s*" + AMT, "gi"))]; if (ths.length) d.totalDoc.ht = toNum((ths.find(m => /G[ÉE]N[ÉE]RAL/i.test(m[0])) || ths[ths.length - 1])[1]);
  const tt = flat.match(new RegExp("TOTAL\\s*T\\.?T\\.?C\\.?\\s*:?\\s*" + AMT, "i")); if (tt) d.totalDoc.ttc = toNum(tt[1]);
  // objet
  const ob = flat.match(/\bObjet\s*:\s*([^\n]+)/i); if (ob) d.objet = cleanLine(ob[1]).replace(/[.:]$/, "");
  // e-mail / téléphone du client (hors coordonnées de l'entreprise)
  const em = [...flat.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map(m => m[0]).find(e => !/gallois/i.test(e) || /estebangallois/i.test(e)); if (em) d.client.email = em.toLowerCase();
  const tels = [...flat.matchAll(/\b0[1-9](?:[\s.]?\d{2}){4}\b/g)].map(m => m[0].replace(/[\s.]/g, "")).filter(t => t !== "0615793837"); if (tels[0]) d.client.tel = tels[0].replace(/(\d{2})(?=\d)/g, "$1 ");

  const isApp = /BON POUR ACCORD/i.test(flat) && /D[ÉE]SIGNATION/i.test(flat);
  if (isApp) parseAppPDF(lines, d); else parseOld(lines, d);

  // contrôle des totaux
  let ht = 0; for (const s of d.sections) for (const l of s.lignes) if (l.quantite !== null && l.pu !== null) ht += r2(l.quantite * l.pu);
  ht = r2(ht);
  if (d.totalDoc.ht !== undefined && Math.abs(ht - d.totalDoc.ht) > 0.05) d.notes.push(`Le total HT recalculé (${ht.toFixed(2).replace(".", ",")} €) diffère de celui du document d'origine (${d.totalDoc.ht.toFixed(2).replace(".", ",")} €). Vérifiez les lignes.`);
  if (!d.sections.length) d.notes.push("Aucune ligne de prix reconnue : complétez le devis à la main.");
  if (!d.numero) d.notes.push("Numéro du devis non trouvé : un nouveau numéro sera attribué.");
  return d;
}

/* Ancien modèle Word : blocs de texte suivis d'un montant, « Soit : 18 M2 X 124,00 € » */
function parseOld(lines, d) {
  let i = 0;
  // en-tête entreprise → bloc client → « Angervilliers, le … » / « DEVIS N° »
  const startBody = lines.findIndex(l => /^\s*Objet\s*:/i.test(l));
  const dateIdx = lines.findIndex(l => /,\s*le\s+\d/i.test(l) || /^\s*DEVIS\s*N/i.test(l));
  const telIdx = lines.findIndex(l => /T[ÉE]L\b|Si[èée]ge/i.test(l));
  const cBlock = lines.slice(telIdx >= 0 ? telIdx + 1 : 0, dateIdx > 0 ? dateIdx : 12).map(cleanLine).filter(l => l && !/@|^\d{2}(?:[\s.]?\d{2}){4}$/.test(l) && !/^(?:t[ée]l|mail|e-mail)\b/i.test(l));
  if (cBlock.length) {
    const cpI = cBlock.findIndex(l => /^\d{2}\s?\d{3}\b/.test(l));
    d.client.nom = cBlock[0].replace(/^(?:Mr|M\.)\s+et\s+Mme\b/i, "M. et Mme").replace(/^Mr\b/i, "M.");
    if (cpI > 0) { d.client.adresse = cBlock.slice(1, cpI).join(", "); const m = cBlock[cpI].match(/^(\d{2})\s?(\d{3})\s+(.+)$/); if (m) d.client.cpVille = m[1] + m[2] + " " + m[3]; }
    else d.client.adresse = cBlock.slice(1).join(", ");
  }
  const numIdx = lines.findIndex(l => /^\s*DEVIS\s*N/i.test(l));
  i = Math.max(startBody, numIdx, dateIdx) + 1;
  let sec = { titre: "", lignes: [] }; d.sections.push(sec);
  let buf = [], fourn = false;
  const flush = (q, u, pu, total) => {
    const txt = buf.map(cleanLine).filter(Boolean); buf = [];
    if (!txt.length && pu === null) return;
    let quantite = q, unite = u, prix = pu;
    if (prix === null && total !== null) { quantite = 1; unite = "forfait"; prix = total; }
    const isF = (fourn && !/^(?:mise en (?:place|peinture|œuvre)|pose|d[ée]pose|remplacement|raccordement|r[ée]alisation|cr[ée]ation)\b/i.test(txt[0] || "")) || /^fournitures?\b/i.test(txt[0] || "");
    sec.lignes.push({ type: isF ? "fourniture" : "mo", designation: (txt[0] || "Prestation").replace(/[.:]$/, ""), details: txt.slice(1), quantite, unite: isF && (!unite || unite === "forfait") ? "u" : (unite || "forfait"), pu: prix, source: prix === null ? "a_saisir" : "saisi" });
  };
  for (; i < lines.length; i++) {
    const L = lines[i], C = L.replace(/(?:\t| {3,})+/g, "  ").replace(/ (?=[,.])/g, "").trim().replace(/€\s*\*/g, "€").replace(/(\d),,(\d)/g, "$1,$2");
    if (/^(?:TVA\b|TOTAL\s*T\.?T|mode de r[èe]glement|ACOMPTE|IBAN|Identifiant international|Merci de nous fournir)/i.test(C)) break;
    if (/^TOTAL\b/i.test(C)) { if (buf.length) flush(null, null, null, null); continue; }
    if (/^(?:DEVIS\s*N|Page\s+\d+$|S\.?A\.?R\.?L\.?\s+au capital|E\.?U\.?R\.?L\.?\s+au capital|Num[ée]ro d'identification)/i.test(C)) continue;
    if (!C || /^(?:St[ée]\s+GALLOIS|RENOVATION\s+[–-]|PARQUET\s+[–-]|Si[èée]ge social|T[ée]l\.?\s*[–-]?\s*Port|-{4,})/i.test(C)) continue;
    if (/^\*/.test(C) && !buf.length) { const last = sec.lignes[sec.lignes.length - 1]; if (last) { last.details.push(C.replace(/^\*\s*/, "")); continue; } }
    const pk = C.match(new RegExp("(?<![\\w.,])(\\d+)\\s+(cartons?|bo[iî]tes?|sacs?|pots?|rouleaux?|seaux?|bidons?|cartouches?|lots?|paquets?)\\b.*?(?<![A-Za-zÀ-ÿ])[xX×](?![A-Za-zÀ-ÿ])\\s*" + AMT + "(?:\\s*" + AMT + ")?\\s*$", "i"));
    if (pk) { const pre = C.slice(0, pk.index).trim(); buf.push(pre ? pre + " (" + pk[1] + " " + pk[2] + ")" : pk[0].replace(new RegExp("(?<![A-Za-zÀ-ÿ])[xX×](?![A-Za-zÀ-ÿ])\\s*" + AMT + ".*$"), "").trim()); flush(Number(pk[1]), "u", toNum(pk[3]), null); continue; }
    const opt = C.match(new RegExp("^(.*?)\\b(m2|m²|ml)\\s*(?<![A-Za-zÀ-ÿ])[xX×](?![A-Za-zÀ-ÿ])\\s*" + AMT + "\\s*$", "i"));
    if (opt && !/\d\s*$/.test(opt[1])) { buf.push(opt[1].trim()); flush(0, unitOf(opt[2]), toNum(opt[3]), null); const l = sec.lignes[sec.lignes.length - 1]; if (l) l.details.push("Option, si nécessaire : quantité à définir"); continue; }
    const sp = C.match(new RegExp("soit\\s*:?\\s*" + AMT + "\\s*\\/\\s*([a-zA-Z][a-zA-Z0-9²]{0,4})\\s+" + AMT + "\\s*$", "i"));
    if (sp) { const pre = C.slice(0, sp.index).trim(); if (pre) buf.push(pre); const pu = toNum(sp[1]), tot = toNum(sp[3]); flush(r2(tot / pu), unitOf(sp[2]) || "u", pu, null); continue; }
    const qt = C.match(new RegExp("soit\\s*:?\\s*(\\d+(?:[.,]\\d+)?)\\s*([a-zA-Z][a-zA-Z0-9²³.]{0,7})\\s+" + AMT + "\\s*$", "i"));
    if (qt) { const pre = C.slice(0, qt.index).trim(); if (pre) buf.push(pre); const q = toNum(qt[1]), tot = toNum(qt[3]); flush(q, unitOf(qt[2]) || "u", r2(tot / q), null); continue; }
    const soit = C.match(new RegExp("(?:soit\\s*:?\\s*)?(\\d+(?:[.,]\\d+)?)\\s*([a-zA-Z][a-zA-Z0-9²³.]{0,7})\\s*(?<![A-Za-zÀ-ÿ])[xX×](?![A-Za-zÀ-ÿ])\\s*" + AMT + "(?:\\s+" + AMT + ")?\\s*$", "i"));
    if (soit) { const desc = C.slice(0, soit.index).replace(/soit\s*:?\s*$/i, "").trim(); if (desc) buf.push(desc);
      flush(toNum(soit[1]), unitOf(soit[2]) || "u", toNum(soit[3]), soit[4] ? toNum(soit[4]) : null); continue; }
    const px = C.match(new RegExp(AMT + "\\s*(?:HT\\s*)?(?:\\/\\s*[a-zA-Z0-9²]{1,4}\\s*)?(?:(?<![A-Za-zÀ-ÿ])[xX×](?![A-Za-zÀ-ÿ])|par)\\s*(\\d+(?:[.,]\\d+)?)\\s*([a-zA-Z²³]{1,6})?\\s*(?:=\\s*)?(?:" + AMT + ")?\\s*$", "i"))
      || C.match(new RegExp("(?<![\\w.,])(\\d+(?:[.,]\\d+)?)\\s*(?<![A-Za-zÀ-ÿ])[xX×](?![A-Za-zÀ-ÿ])\\s*" + AMT + "(?:\\s*(?:=\\s*)?" + AMT + ")?\\s*$", "i"));
    if (px) { const pre = C.slice(0, px.index).replace(/soit\s*:?\s*$/i, "").trim(); if (pre) buf.push(pre);
      const puFirst = /€\s*(?:HT\s*)?(?:\/\s*[a-zA-Z0-9²]{1,4}\s*)?(?:(?<![A-Za-zÀ-ÿ])[xX×](?![A-Za-zÀ-ÿ])|par)/i.test(px[0]);
      const q = toNum(puFirst ? px[2] : px[1]), pu = toNum(puFirst ? px[1] : px[2]), pu_ = (px[0].match(/€\s*\/\s*([a-zA-Z0-9²]{1,4})/) || [])[1], u = puFirst ? (unitOf(px[3]) || unitOf(pu_) || "u") : "u";
      flush(q, u, pu, null); continue; }
    const am = C.match(new RegExp("^(.*?)\\s*" + AMT + "\\s*(?:HT)?\\s*$", "i"));
    if (am) { const pre = am[1].replace(/\s*soit\s*:.*$/i, "").trim(); if (pre && !/^(?:soit|total)\b/i.test(pre)) buf.push(pre); flush(null, null, null, toNum(am[2])); continue; }
    if (/^[^\d€*]{3,60}:\s*$/.test(C) && !buf.length) {   // titre de partie
      const t = C.replace(/\s*:\s*$/, ""); fourn = /fourniture/i.test(t) || (fourn && t.length <= 14 && !/carrel|peint|plomb|[ée]lectri|ma[çc]on|placard|menuis/i.test(t));
      if (sec.lignes.length || sec.titre) { sec = { titre: t, lignes: [] }; d.sections.push(sec); } else sec.titre = t; continue; }
    buf.push(C);
  }
  if (buf.length) flush(null, null, null, null);
  d.sections = d.sections.filter(s => s.lignes.length);
}

/* PDF produit par cette application (tableau N°, désignation, qté, unité, PU, total) */
function parseAppPDF(lines, d) {
  const ci = lines.findIndex(l => /CLIENT/.test(l));
  if (ci >= 0) {   // colonne de droite : on garde le dernier segment après une tabulation
    const right = lines.slice(ci + 1, ci + 8).map(l => l.split("\t").map(s => s.trim()).filter(Boolean)).map(p => p.length > 1 ? p[p.length - 1] : (p[0] || ""));
    const r = right.filter(x => x && !/^(?:GALLOIS|7 rue de la Garenne|T[ée]l\.|SIRET|TVA intracom)/i.test(x));
    d.client.nom = r[0] || ""; d.client.adresse = r[1] || ""; const cp = r.find(x => /^\d{5}\s/.test(x)); if (cp) d.client.cpVille = cp.replace(/^(\d{5})\s+(.*)$/, (m, a, b) => a + " " + b.charAt(0) + b.slice(1).toLowerCase());
  }
  const ob = lines.findIndex(l => /\bOBJET\b/.test(l)); if (ob >= 0 && lines[ob + 1]) { const p = lines[ob + 1].split("\t").map(s => s.trim()).filter(Boolean); d.objet = p[p.length - 1] || d.objet; }
  const ROW = new RegExp("^\\s*(\\d{1,3})\\s+(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s+(m²|ml|m³|u|forfait|h|jour|panneau)\\s+" + AMT + "\\s+" + AMT + "\\s*$");
  let sec = null, cur = null, inTable = false;
  for (const L of lines) {
    const C = cleanLine(L);
    if (/D[ÉE]SIGNATION/.test(C)) { inTable = true; continue; }
    if (!inTable) continue;
    if (/^Validit[ée] du devis|^MODALIT|Devis N° .* Page/i.test(C)) { inTable = /Page/.test(C) && !/^Validit/i.test(C) ? inTable : false; cur = null; continue; }
    const m = C.match(ROW);
    if (m) { if (!sec) { sec = { titre: "", lignes: [] }; d.sections.push(sec); }
      cur = { type: /^fournitures?$/i.test(sec.titre) ? "fourniture" : "mo", designation: m[2], details: [], quantite: toNum(m[3]), unite: m[4], pu: toNum(m[5]), source: "saisi" }; sec.lignes.push(cur); continue; }
    if (/^[A-ZÀ-Ý0-9' ,\-–]{3,}$/.test(C) && !/\d+,\d{2}/.test(C)) { sec = { titre: C.charAt(0) + C.slice(1).toLowerCase(), lignes: [] }; d.sections.push(sec); cur = null; continue; }
    if (cur && C && !/^(?:N°|QT[ÉE])/.test(C)) { if (cur.details.length || /^[-•·]/.test(C) || !/^[a-zà-ÿ]/.test(C)) cur.details.push(C.replace(/^[-•·]\s*/, "")); else cur.designation += " " + C; }
  }
  d.sections = d.sections.filter(s => s.lignes.length);
}

root.Importer = { extractText, parseDevis, docText, docxText, pdfItemsToText };
if (typeof module !== "undefined" && module.exports) module.exports = root.Importer;
})(typeof window !== "undefined" ? window : globalThis);
