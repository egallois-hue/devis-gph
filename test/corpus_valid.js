/* Jeu de validation « à l'aveugle » — écrit le 10/11/2026 AVANT de relire le moteur,
   par quelqu'un qui n'en connaissait pas les règles. Mesuré une première fois tel quel
   (score « premier passage »), puis utilisé comme jeu de mise au point.
   Même format que corpus.js. Clients et adresses fictifs. */
module.exports = [
{ id: "V01", set: "valid",
  text: `bonjour alors c'est pour un devis chez madame Tessier elle habite au 12 rue des Acacias à Rambouillet elle veut refaire sa cuisine donc il faut enlever la vieille faïence il y en a à peu près 6 m² après je repose une crédence en carrelage 6 m² et je lui change son robinet d'évier et puis elle veut aussi deux prises en plus au dessus du plan de travail`,
  client: { nom: "Mme Tessier", adr: "12 rue des Acacias", ville: "Rambouillet" },
  L: [["P010", 6, "m²"], ["P044", 6, "m²"], ["P061", 1, "u"], ["P069", 2, "u"]] },

{ id: "V02", set: "valid",
  text: `devis monsieur Aubert 3 place de l'Église à Forges-les-Bains il a une fuite sous sa douche donc réparation de l'évacuation et tant que j'y suis je refais les joints de la baignoire et je remplace le mitigeur du lavabo`,
  client: { nom: "M. Aubert", adr: "3 place de l'Église", ville: "Forges-les-Bains" },
  L: [["P065", 1, "forfait"], ["P063", 1, "forfait"], ["P061", 1, "u"]] },

{ id: "V03", set: "valid",
  text: `pour monsieur et madame Renard quinze rue Victor Hugo à Dourdan peinture complète du séjour les murs soixante-deux mètres carrés le plafond vingt-huit mètres carrés plus quatre portes à laquer et trois radiateurs à repeindre et vingt-quatre mètres de plinthes à peindre aussi`,
  client: { nom: "M. et Mme Renard", adr: "15 rue Victor Hugo", ville: "Dourdan" },
  L: [["P021", 62, "m²"], ["P022", 28, "m²"], ["P028", 4, "u"], ["P030", 3, "u"], ["P031", 24, "ml"]] },

{ id: "V04", set: "valid",
  text: `chez madame Colin 7 rue du Château à Limours on arrache le lino de la cuisine 11 m² euh non 13 m² pardon ensuite un ragréage sur les 13 m² et je pose un sol PVC 13 m² fourni posé`,
  client: { nom: "Mme Colin", adr: "7 rue du Château", ville: "Limours" },
  L: [["P011", 13, "m²"], ["P020", 13, "m²"], ["P053", 13, "m²", { fc: true }]] },

{ id: "V05", set: "valid",
  text: `monsieur Navarro au 20 rue de la Forêt à Saint-Arnoult-en-Yvelines il veut séparer sa chambre en deux donc une cloison placo de 3 mètres 50 de large sur 2 mètres 50 de hauteur avec un bloc porte à poser dedans et je déplace aussi une prise non je crée une prise sur la nouvelle cloison`,
  client: { nom: "M. Navarro", adr: "20 rue de la Forêt", ville: "Saint-Arnoult-en-Yvelines" },
  L: [["P036", 8.75, "m²"], ["P080", 1, "u"], ["P069", 1, "u"]] },

{ id: "V06", set: "valid",
  text: `devis pour madame Besson 9 allée des Tilleuls à Bruyères-le-Châtel remplacement des toilettes par un WC suspendu avec habillage du bâti en placo hydro et ensuite carrelage du sol des WC 2 m² et peinture des murs et du plafond des WC 9 m²`,
  client: { nom: "Mme Besson", adr: "9 allée des Tilleuls", ville: "Bruyères-le-Châtel" },
  L: [["P058", 1, "forfait"], ["P043", 1, "forfait"], ["P044", 2, "m²"], ["P024", 9, "m²"]] },

{ id: "V07", set: "valid",
  text: `monsieur Lefort 31 rue de Paris à Arpajon pose de parquet flottant dans deux chambres 24 m² à 28 € le mètre et les plinthes 30 mètres à 9 € pour les fournitures je prends 26 m² de parquet chêne à 34 € le mètre carré chez Leroy Merlin et 10 barres de plinthes`,
  client: { nom: "M. Lefort", adr: "31 rue de Paris", ville: "Arpajon" },
  L: [["P051", 24, "m²", { pu: 28 }], ["P054", 30, "ml", { pu: 9 }]],
  F: [["parquet", 26, 34], ["plinthe", 10, null]] },

{ id: "V08", set: "valid",
  text: `pour madame Hamel au 5 rue des Sources à Bullion il faut changer quatre interrupteurs et deux prises qui sont cassées installer un lustre dans la salle à manger et vérifier le tableau`,
  client: { nom: "Mme Hamel", adr: "5 rue des Sources", ville: "Bullion" },
  L: [["P068", 4, "u"], ["P068", 2, "u"], ["P071", 1, "u"], ["P073", 1, "forfait"]] },

{ id: "V09", set: "valid",
  text: `devis pour monsieur Chevalier 18 route de Rochefort à Bonnelles nettoyage et démoussage du muret devant la maison 15 m² et ensuite peinture du muret deux couches 15 m² et aussi je lui enlève sa vieille clôture sur 22 mètres et je repose une clôture rigide à la place 22 mètres`,
  client: { nom: "M. Chevalier", adr: "18 route de Rochefort", ville: "Bonnelles" },
  L: [["P033", 15, "m²"], ["P034", 15, "m²"], ["P017", 22, "ml"], ["P087", 22, "ml"]] },

{ id: "V10", set: "valid",
  text: `madame Perrot 2 rue des Roses à Limours pose d'un velux dans les combles et peinture du plafond des combles 18 m²`,
  client: { nom: "Mme Perrot", adr: "2 rue des Roses", ville: "Limours" },
  L: [["HC:velux", "*", "u"], ["P022", 18, "m²"]] },

{ id: "V11", set: "valid",
  text: `chez monsieur et madame Julien 44 rue de Chartres à Dourdan on refait la salle d'eau donc dépose du bac à douche et de la paroi dépose du carrelage au mur 14 m² ensuite étanchéité sous carrelage sur 14 m² repose de faïence 14 m² en 30 60 pose de la robinetterie de la paroi et du meuble vasque et un sèche-serviettes électrique à poser`,
  client: { nom: "M. et Mme Julien", adr: "44 rue de Chartres", ville: "Dourdan" },
  L: [["P016", 1, "forfait"], ["P010", 14, "m²"], ["P084", 14, "m²"], ["P044", 14, "m²"], ["P057", 1, "forfait"], ["P075", 1, "u"]] },

{ id: "V12", set: "valid",
  text: `pour madame Vasseur 6 rue du Lavoir à Saint-Chéron peinture de la chambre parentale murs 35 m² plafond 14 m² et pareil pour la chambre d'amis murs 28 m² plafond 10 m²`,
  client: { nom: "Mme Vasseur", adr: "6 rue du Lavoir", ville: "Saint-Chéron" },
  L: [["P021", 35, "m²"], ["P022", 14, "m²"], ["P021", 28, "m²"], ["P022", 10, "m²"]] },

{ id: "V13", set: "valid",
  text: `devis pour la société Immo Sud 12 avenue Carnot à Massy c'est des bureaux donc TVA à 20 % pose de moquette non pardon pose de sol PVC sur 80 m² après dépose de l'ancienne moquette 80 m² et peinture des murs 150 m²`,
  client: { nom: "Société Immo Sud", adr: "12 avenue Carnot", ville: "Massy" }, tva: 20,
  L: [["P053", 80, "m²"], ["P011", 80, "m²"], ["P021", 150, "m²"]] },

{ id: "V14", set: "valid",
  text: `monsieur Barre 1 rue du Stade à Angervilliers petits travaux divers je compte deux journées de main d'œuvre plus trois heures en régie et l'évacuation des gravats à la déchetterie`,
  client: { nom: "M. Barre", adr: "1 rue du Stade", ville: "Angervilliers" },
  L: [["P091", 2, "jour"], ["P090", 3, "h"], ["P004", 1, "forfait"]] },

{ id: "V15", set: "valid",
  text: `alors madame Lucas 8 rue de la Mairie à Briis-sous-Forges elle veut repeindre son bureau la pièce fait 12 m² au sol avec 2 m 50 sous plafond tu me calcules les murs et le plafond aussi et il y a une porte à peindre`,
  client: { nom: "Mme Lucas", adr: "8 rue de la Mairie", ville: "Briis-sous-Forges" },
  L: [["P021", 34.6, "m²"], ["P022", 12, "m²"], ["P028", 1, "u"]] },

{ id: "V16", set: "valid",
  text: `devis monsieur Dumas 25 rue des Vergers à Limours remplacement de trois fenêtres en rénovation pose d'une porte de placard coulissante dans l'entrée et un coffrage bois sur mesure pour cacher les tuyaux`,
  client: { nom: "M. Dumas", adr: "25 rue des Vergers", ville: "Limours" },
  L: [["P079", 3, "u"], ["P081", 1, "forfait"], ["P082", 1, "forfait"]] },

{ id: "V17", set: "valid",
  text: `pour monsieur Marchand au 3 rue Pasteur à Breuillet dans la cage d'escalier il y a des fissures à ouvrir et reboucher à peu près 8 mètres ensuite toile de verre et peinture sur 40 m² avec une plus-value pour la grande hauteur sur 15 m²`,
  client: { nom: "M. Marchand", adr: "3 rue Pasteur", ville: "Breuillet" },
  L: [["P019", 8, "ml"], ["P026", 40, "m²"], ["P023", 15, "m²"]] },

{ id: "V18", set: "valid",
  text: `madame Fournier 14 rue de Vaugirard Paris 15e travaux de peinture dans son appartement murs 90 m² plafonds 45 m² ça va durer cinq jours donc compter le stationnement et il faut protéger et nettoyer c'est un chantier moyen`,
  client: { nom: "Mme Fournier", adr: "14 rue de Vaugirard", ville: "Paris" }, duree: 5,
  L: [["P021", 90, "m²"], ["P022", 45, "m²"], ["P008", "*", "jour"], ["P002", 1, "forfait"]] },

{ id: "V19", set: "valid",
  text: `chez monsieur Hoarau 10 rue des Peupliers à Gometz-la-Ville je raccorde la machine à laver dans le cellier je pose une VMC simple flux et je mets un siphon de sol dans la buanderie`,
  client: { nom: "M. Hoarau", adr: "10 rue des Peupliers", ville: "Gometz-la-Ville" },
  L: [["P067", 1, "u"], ["P078", 1, "forfait"], ["P066", 1, "u"]] },

{ id: "V20", set: "valid",
  text: `bon alors euh c'est pour monsieur Pires 7 chemin du Bois à Vaugrigneuse donc dans le garage qu'il transforme en chambre je fais un doublage isolant sur les murs ça fait 32 m² un faux plafond en placo 16 m² euh la création de trois prises et d'un point lumineux et puis voilà ah oui et la peinture des murs 32 m² et du plafond 16 m²`,
  client: { nom: "M. Pires", adr: "7 chemin du Bois", ville: "Vaugrigneuse" },
  L: [["P039", 32, "m²"], ["P040", 16, "m²"], ["P069", 3, "u"], ["P070", 1, "u"], ["P021", 32, "m²"], ["P022", 16, "m²"]] },

{ id: "V21", set: "valid",
  text: `devis madame Gilbert 19 rue de la Poste à Ablis pose de carrelage dans l'entrée 9 m² en 45 45 pose seule c'est elle qui fournit le carrelage et les plinthes carrelées 11 mètres et je reprends les joints de la terrasse 20 m²`,
  client: { nom: "Mme Gilbert", adr: "19 rue de la Poste", ville: "Ablis" },
  L: [["P044", 9, "m²", { fc: false }], ["P047", 11, "ml"], ["P046", 20, "m²"]] },

{ id: "V22", set: "valid",
  text: `devis pour monsieur et madame Albert 5 impasse du Verger à Roinville rénovation de l'étage alors dans le couloir on décolle le papier peint 18 m² on fait un ratissage 18 m² et peinture 18 m² dans la chambre 1 on enlève la moquette 12 m² et on pose un parquet stratifié 12 m² avec 14 mètres de plinthes dans la salle de bain on change le lavabo par un meuble vasque et on remplace les toilettes et à la fin nettoyage de fin de chantier durée dix jours`,
  client: { nom: "M. et Mme Albert", adr: "5 impasse du Verger", ville: "Roinville" }, duree: 10,
  L: [["P009", 18, "m²"], ["P018", 18, "m²"], ["P021", 18, "m²"], ["P011", 12, "m²"], ["P051", 12, "m²"], ["P054", 14, "ml"], ["P060", 1, "u"], ["P059", 1, "forfait"], ["P006", 1, "forfait"]] },
];
