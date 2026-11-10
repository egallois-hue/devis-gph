const M = require(process.env.ENG||"../engine.js");
const biblio = require("/home/claude/devis_src/catalogue_seed.json");
const D = [
`Devis pour monsieur Dupont, 9 rue de Gaudré à Limours. Chambre : on dépose le papier peint, vingt-huit mètres carrés, dix-huit euros du mètre. Enduit et peinture satin 28 m2 à 38 euros.`,
`Devis pour madame Durand 10 rue des Essais 91410 Dourdan. Protection et nettoyage du chantier et évacuation à la déchetterie. Salle de bains : dépose de la baignoire et du meuble lavabo. Dépose du carrelage sol et mur 31 m2. Pose de carrelage au sol 6 m2 et faïence murale 25 mètres carrés. Pose d'un sèche-serviettes. 4 spots. Fournitures : receveur de douche 140 par 100 à 531 euros 19, colle Weber flex 8 sacs à 36,65 euros, mitigeur lavabo.`,
`devis pour monsieur et madame colas bara 4 rue mirabeau paris 16. protection des parquets et des meubles. Séjour peinture plafond 13,5 m2 et murs 49,5 m2. Cuisine plafond 6 m2 murs 23 m2. Ponçage et vitrification du parquet de la chambre 12 m2. Déplacement de la fibre dans le placard pour 160 euros.`,
`Pour la copropriété du 18 rue des bas rogers 92800 Puteaux. Il faut faire un coffrage en bois des tuyaux extérieurs pour 228 euros, peinture blanche spéciale extérieure 145 euros. Fournitures : panneau contreplaqué marine 169 euros, 2 tasseaux 36 euros.`,
`Devis pour monsieur Santiago 9 rue des jardins du parc à Angervilliers. Remplacer la prise extérieure. Pose de trois éclairages extérieurs. Contrôle du tableau électrique. Nettoyage de la VMC. On met un WC suspendu à la place de l'ancien.`,
];
for (const d of D) {
  const r = M.analyse(d, biblio);
  console.log("\n=== ", JSON.stringify(r.client), "| objet:", r.objet, "| TVA", r.tva);
  for (const s of r.sections) { console.log("  #", s.titre);
    for (const l of s.lignes) console.log(`   - [${l.type}] ${l.designation} | q=${l.quantite} ${l.unite} | pu=${l.pu} (${l.source}${l.biblio_id ? " " + l.biblio_id : ""})  ⟵ « ${l.raw} »`); }
  if (r.notes.length) console.log("  notes:", r.notes.join(" / "));
}
