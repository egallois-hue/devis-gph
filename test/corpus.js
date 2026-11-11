/* Corpus d'évaluation du moteur de dictée — Gallois PH
   Dictées réalistes (langue parlée, peu ou pas de ponctuation, erreurs de transcription Siri)
   avec le devis attendu écrit à la main.

   set : "train" = sert aux réglages ; "test" = tenu à l'écart, mesuré en agrégé seulement.
   L   : lignes de main-d'œuvre attendues  [prestation, quantité, unité, options]
         prestation = identifiant catalogue ("P021"), alternatives ("P001|P002"),
                      ou hors catalogue ("HC:mot-clé" : ligne « à compléter » contenant ce mot)
         quantité   = nombre, null (inconnue : à demander) ou "*" (non notée)
         options    = { pu: prix dicté, fc: fourniture comprise, opt: ligne facultative }
   F   : fournitures attendues [mot-clé, quantité, prix dicté ou null]
   Les clients et adresses sont fictifs. Aucun prix du catalogue ne figure ici. */
module.exports = [
/* ============================== ENTRAÎNEMENT ============================== */
/* Dictée réelle (11/11/2026, nom modifié) : surfaces données par pièce, hauteur, date de début */
{ id: "G01", set: "train",
  text: `Devis pour Monsieur Henri Girard 9, rue de la gare à Forges les bains dans un premier temps pour une chambre Dépose du carrelage Pose d'un parquet flottant Sur 30 m² Deuxième prestation Dépose du papier peint des murs et peinture et enduit Sur la même pièce avec une hauteur sous plafond de 2,50 m Deuxième pièce salle de bain Dépose de la baignoire Et de l'évier Dépose de toute la faïence et du carrelage au sol Carrelage 60 60 avec joint fin au sol pause Et pose de carrelage au mur Sur toute la hauteur du mur qui fait 1 m 2,50 m La salle de bain fait 15 m² Pose d'un bac à douche 120 par 80 avec vitres coulissant Et robinetterie pose d'une double vasque plus robinet gré Plus miroir intégrée Création de cinq prises électriques un interrupteur Et cinq spots au plafond Début du chantier le 15 novembre Et la durée 20 jours`,
  client: { nom: "M. Henri Girard", adr: "9 rue de la Gare", ville: "Forges" }, duree: 20, debut: "2026-11-15",
  L: [["P010", 30, "m²"], ["P051", 30, "m²"], ["P009", 54.8, "m²"], ["P025", 54.8, "m²"], ["P012", 1, "forfait"], ["P010", 53.7, "m²"], ["P044", 15, "m²"], ["P044", 38.7, "m²"],
      ["P064|P293", 1, "forfait"], ["P113", "*", "u", { opt: true }], ["P280", "*", "u", { opt: true }], ["P061", "*", "u", { opt: true }], ["P057", 1, "forfait"], ["HC:paroi", "*", "forfait", { opt: true }], ["P060", 1, "u"], ["P069", 5, "u"], ["P068|P070", 1, "u"], ["P072", 5, "u"]] },
/* Cas de non-régression tirés des demandes réelles (format de carrelage dit avant la surface) */
{ id: "R03", set: "train",
  text: `pour madame Morin 2 rue du Bac à Limours la salle de bain fait 5 mètres sur 3 avec 2 m 50 sous plafond faïence sur les murs et carrelage au sol et dans la chambre qui fait 4 m par 3,5 hauteur 2,60 peinture des murs et du plafond`,
  client: { nom: "Mme Morin", adr: "2 rue du Bac", ville: "Limours" },
  L: [["P044", 40, "m²"], ["P044", 15, "m²"], ["P021", 39, "m²"], ["P022", 14, "m²"]] },
{ id: "R01", set: "train",
  text: `Devis pour madame Martin 3 rue des Lilas à Dourdan. Cuisine : pose de carrelage soixante soixante avec joint fin 18 m2. Peinture des murs 30 m2 fournitures comprises.`,
  client: { nom: "Mme Martin", adr: "3 rue des Lilas", ville: "Dourdan" },
  L: [["P044", 18, "m²"], ["P021", 30, "m²", { fc: true }]] },
{ id: "R02", set: "train",
  text: `pour monsieur Durand 4 rue du Parc à Limours carrelage 60 60 avec joint fin dans la cuisine 18 m² et faïence 30 par 60 dans la salle de bain 22 m²`,
  client: { nom: "M. Durand", adr: "4 rue du Parc", ville: "Limours" },
  L: [["P044", 18, "m²"], ["P044", 22, "m²"]] },

{ id: "A01", set: "train",
  text: `J'ai un devis pour refaire de la peinture dans un salon avec une surface au sol de 30 m², et une hauteur sous plafond de 1,80 m donc je te laisse mesurer et me dire combien il y a de mètres carrés de peinture à faire l'idée c'est de prendre en fourniture une une peinture blanche, Tollens satinée classique avec trois couches, je pense que le devis va me prendre à peu près trois jours et je pense que je vais avoir des frais kilométriques parce qu'il y a plus de 100 km de chez moi, il est dans Paris centre donc compte ça aussi dans le devis il y a aussi la vitrification d'un parquet donc je vais le poncer et ensuite le revenir et dans ce chantier il y a aussi un petit chantier où je dois changer un ballon d'eau chaude, donc j'ai un peu de plomberie classique pour le changement d'un ballon d'eau chaude dépose et remplacement et le ballon d'eau chaude je prends un ballon de 60 l Leroy Merlin classique`,
  client: {}, duree: 3,
  L: [["P021", 39.4, "m²"], ["P022", 30, "m²"], ["P049", 30, "m²"], ["P092", 1, "forfait"], ["P093", 1, "forfait"], ["P008", "*", "jour"]],
  F: [["tollens", 1, null], ["ballon", 1, null]] },

{ id: "A02", set: "train",
  text: `devis pour monsieur et madame Martin 14 rue de la Gare à Limours alors dans le salon on enlève la moquette 25 m² ensuite ragréage 25 m² et pose de parquet flottant 25 m² avec les plinthes 20 m linéaires et pour finir nettoyage de fin de chantier`,
  client: { nom: "M. et Mme Martin", adr: "14 rue de la Gare", ville: "Limours" },
  L: [["P011", 25, "m²"], ["P020", 25, "m²"], ["P051", 25, "m²"], ["P054", 20, "ml"], ["P006", 1, "forfait"]] },

{ id: "A03", set: "train",
  text: `bonjour c'est pour madame Leroy au 3 impasse des Lilas à Dourdan il faut repeindre la chambre les murs font 38 m² et le plafond 12 m² il y a aussi deux portes à peindre et un radiateur à peindre et les plinthes 14 m`,
  client: { nom: "Mme Leroy", adr: "3 impasse des Lilas", ville: "Dourdan" },
  L: [["P021", 38, "m²"], ["P022", 12, "m²"], ["P028", 2, "u"], ["P030", 1, "u"], ["P031", 14, "ml"]] },

{ id: "A04", set: "train",
  text: `devis pour monsieur Bernard 27 avenue du Général Leclerc 91470 Limours rénovation complète de la salle de bain donc dépose complète des sanitaires dépose de la faïence et du carrelage 24 m² pose de placo hydro sur les murs 16 m² étanchéité sous carrelage 8 m² pose du carrelage au sol 5 m² en 60 60 et faïence murale 19 m² création d'une douche à l'italienne pose d'un WC suspendu à la place de l'ancien pose d'un sèche serviette et électricité de la salle de bain`,
  client: { nom: "M. Bernard", adr: "27 avenue du Général Leclerc", ville: "Limours" },
  L: [["P013", 1, "forfait"], ["P010", 24, "m²"], ["P037", 16, "m²"], ["P084", 8, "m²"], ["P044", 5, "m²"], ["P044", 19, "m²"], ["P056", 1, "forfait"], ["P058", 1, "forfait"], ["P075", 1, "u"], ["P074", 1, "forfait"]] },

{ id: "A05", set: "train",
  text: `pour monsieur Petit à Angervilliers 5 chemin des Vignes je dois lui remplacer 6 prises et 3 interrupteurs créer deux prises dans la cuisine poser 8 spots dans le salon et contrôler le tableau électrique`,
  client: { nom: "M. Petit", adr: "5 chemin des Vignes", ville: "Angervilliers" },
  L: [["P068", 6, "u"], ["P068", 3, "u"], ["P069", 2, "u"], ["P072", 8, "u"], ["P073", 1, "forfait"]] },

{ id: "A06", set: "train",
  text: `devis pour madame Roux 8 rue Pasteur à Arpajon peinture du plafond de la cuisine 12 m² non pardon 14 m² et les murs 30 m² ensuite on change le mitigeur de l'évier`,
  client: { nom: "Mme Roux", adr: "8 rue Pasteur", ville: "Arpajon" },
  L: [["P022", 14, "m²"], ["P021", 30, "m²"], ["P061", 1, "u"]] },

{ id: "A07", set: "train",
  text: `chez monsieur Garcia 2 rue du Moulin à Breuillet dépose de papier peint dans le couloir 22 m² à 16 € du mètre carré puis enduit et peinture satin 22 m² à 36 € et une porte à peindre pour 120 €`,
  client: { nom: "M. Garcia", adr: "2 rue du Moulin", ville: "Breuillet" },
  L: [["P009", 22, "m²", { pu: 16 }], ["P025", 22, "m²", { pu: 36 }], ["P028", 1, "u", { pu: 120 }]] },

{ id: "A08", set: "train",
  text: `alors pour le chantier de monsieur Lambert à Saint-Chéron 11 rue des Écoles on monte une cloison en placo de 4 m de long sur 2 m 50 de haut et un bloc porte à poser`,
  client: { nom: "M. Lambert", adr: "11 rue des Écoles", ville: "Saint-Chéron" },
  L: [["P036", 10, "m²"], ["P080", 1, "u"]] },

{ id: "A09", set: "train",
  text: `devis madame Fontaine 6 allée des Chênes à Bonnelles dépose de l'ancienne clôture 35 m pose d'une clôture rigide 35 m linéaires avec un portillon et 12 panneaux de lames occultantes`,
  client: { nom: "Mme Fontaine", adr: "6 allée des Chênes", ville: "Bonnelles" },
  L: [["P017", 35, "ml"], ["P087", 35, "ml"], ["P088", 1, "forfait"], ["P089", 12, "panneau"]] },

{ id: "A10", set: "train",
  text: `pour madame Chevalier 19 rue Victor Hugo à Rambouillet c'est un parquet à poncer et vitrifier dans le séjour 28 m² et la chambre 11 m² et il faut remplacer les plinthes 30 m`,
  client: { nom: "Mme Chevalier", adr: "19 rue Victor Hugo", ville: "Rambouillet" },
  L: [["P049", 28, "m²"], ["P049", 11, "m²"], ["P054", 30, "ml"]] },

{ id: "A11", set: "train",
  text: `devis pour monsieur Morel 4 rue des Sources à Chevreuse dans la chambre 1 peinture des murs 32 m² et du plafond 11 m² pareil pour la chambre 2 et dans le couloir juste le plafond 6 m²`,
  client: { nom: "M. Morel", adr: "4 rue des Sources", ville: "Chevreuse" },
  L: [["P021", 32, "m²"], ["P022", 11, "m²"], ["P021", 32, "m²"], ["P022", 11, "m²"], ["P022", 6, "m²"]] },

{ id: "A12", set: "train",
  text: `madame Girard 15 rue de l'Église à Forges-les-Bains dans les toilettes on change le WC par un WC normal on repeint murs et plafond 9 m² et on remplace le lavabo par un lave-mains`,
  client: { nom: "Mme Girard", adr: "15 rue de l'Église", ville: "Forges-les-Bains" },
  L: [["P059", 1, "forfait"], ["P024", 9, "m²"], ["P060", 1, "u"]] },

{ id: "A13", set: "train",
  text: `devis pour monsieur Faure 10 rue du Lavoir à Marcoussis pose de carrelage dans la cuisine 14 m² format 45 45 avec plinthes carrelées 12 m en fourniture carrelage 14 m² à 32 € le mètre carré colle 4 sacs à 28 € et joint 2 sacs`,
  client: { nom: "M. Faure", adr: "10 rue du Lavoir", ville: "Marcoussis" },
  L: [["P044", 14, "m²"], ["P047", 12, "ml"]],
  F: [["carrelage", 14, 32], ["colle", 4, 28], ["joint", 2, null]] },

{ id: "A14", set: "train",
  text: `remplacement d'un chauffe eau de 200 l et pose d'un mitigeur dans la salle de bain`,
  client: {},
  L: [["P092", 1, "forfait"], ["P061", 1, "u"]] },

{ id: "A15", set: "train",
  text: `pour madame Blanc 7 place de la Mairie à Limours petite intervention deux heures de main-d'œuvre pour fixer des étagères et une tringle à rideaux`,
  client: { nom: "Mme Blanc", adr: "7 place de la Mairie", ville: "Limours" },
  L: [["P250", "*", "u", { opt: true }], ["P090", 2, "h"]] },

{ id: "A16", set: "train",
  text: `devis pour la copropriété du 22 rue de Paris à Palaiseau dans la cage d'escalier reprise des fissures 15 m toile de verre et peinture sur les murs 85 m² peinture du plafond 20 m² et plus-value grande hauteur sur 40 m²`,
  client: { nom: "~copropri", adr: "22 rue de Paris", ville: "Palaiseau" },
  L: [["P019", 15, "ml"], ["P026", 85, "m²"], ["P022", 20, "m²"], ["P023", 40, "m²"]] },

{ id: "A17", set: "train",
  text: `devis pour la société Dupuis Immobilier 3 avenue de la République à Massy local commercial TVA à 20 pour cent dépose du faux plafond 40 m² pose d'un faux plafond en placo 40 m² et 12 spots`,
  client: { nom: "Société Dupuis Immobilier", adr: "3 avenue de la République", ville: "Massy" }, tva: 20,
  L: [["P015|HC:faux plafond|P104", 40, "m²"], ["P040", 40, "m²"], ["P072", 12, "u"]] },

{ id: "A18", set: "train",
  text: `monsieur et madame Lopez 9 rue des Acacias à Égly remplacement de la baignoire par une douche donc dépose de la baignoire et du meuble lavabo préparation du support pour le receveur pose de la robinetterie de la paroi et du meuble vasque et faïence 6 m²`,
  client: { nom: "M. et Mme Lopez", adr: "9 rue des Acacias", ville: "Égly" },
  L: [["P012", 1, "forfait"], ["P064", 1, "forfait"], ["P057", 1, "forfait"], ["P044", 6, "m²"]] },

{ id: "A19", set: "train",
  text: `devis pour madame Simon 2 rue des Prés à Janvry des poses de la tapisserie dans la chambre 30 m² pause de toile de vert et peinture 30 m² peinture des plaintes 15 m et pause de deux appliques`,
  client: { nom: "Mme Simon", adr: "2 rue des Prés", ville: "Janvry" },
  L: [["P009", 30, "m²"], ["P026", 30, "m²"], ["P031", 15, "ml"], ["P071", 2, "u"]] },

{ id: "A20", set: "train",
  text: `pour monsieur Henry à Limours 30 route de Chartres je compte 3 jours de travail pour monter les meubles de cuisine donc 3 journées de main-d'œuvre et raccordement du lave-vaisselle et de la machine à laver`,
  client: { nom: "M. Henry", adr: "30 route de Chartres", ville: "Limours" }, duree: 3,
  L: [["P091", 3, "jour"], ["P067", 2, "u"]] },

{ id: "A21", set: "train",
  text: `devis pour madame Colin 12 rue Jean Jaurès à Orsay salon salle à manger 42 m² au sol hauteur sous plafond 2 m 60 on refait toute la peinture murs et plafond et on protège les meubles`,
  client: { nom: "Mme Colin", adr: "12 rue Jean Jaurès", ville: "Orsay" },
  L: [["P021", 67.4, "m²"], ["P022", 42, "m²"], ["P001|P002", 1, "forfait"]] },

{ id: "A22", set: "train",
  text: `chez monsieur Dumas 5 rue de la Forêt à Sonchamp salle d'eau à l'étage création d'une douche à l'italienne avec siphon de sol étanchéité sous carrelage 10 m² mosaïque au sol 3 m² et faïence métro sur les murs 14 m² avec joint époxy`,
  client: { nom: "M. Dumas", adr: "5 rue de la Forêt", ville: "Sonchamp" },
  L: [["P056", 1, "forfait"], ["P066", 1, "u"], ["P084", 10, "m²"], ["P044", 3, "m²"], ["P044", 14, "m²"]] },

{ id: "A23", set: "train",
  text: `monsieur Robin au 8 bis rue de Verdun à Dourdan j'ai une fuite sous la douche à réparer il faut casser le carrelage 2 m² réparer l'évacuation et refaire le carrelage 2 m²`,
  client: { nom: "M. Robin", adr: "8 bis rue de Verdun", ville: "Dourdan" },
  L: [["P010", 2, "m²"], ["P065", 1, "forfait"], ["P044", 2, "m²"]] },

{ id: "A24", set: "train",
  text: `devis pour madame Masson 21 rue des Écoles à Briis-sous-Forges fenêtres à changer 3 fenêtres dans le séjour et une porte intérieure dans la chambre et la porte de placard coulissante à régler dans l'entrée`,
  client: { nom: "Mme Masson", adr: "21 rue des Écoles", ville: "Briis-sous-Forges" },
  L: [["P079", 3, "u"], ["P080", 1, "u"], ["P081", 1, "forfait"]] },

{ id: "A25", set: "train",
  text: `pour monsieur Noël 16 rue du Château à Saint-Arnoult-en-Yvelines peinture des murs du bureau 26 m² sans le plafond et pose de parquet stratifié 12 m² fourni posé`,
  client: { nom: "M. Noël", adr: "16 rue du Château", ville: "Saint-Arnoult-en-Yvelines" },
  L: [["P021", 26, "m²"], ["P051", 12, "m²", { fc: true }]] },

{ id: "A26", set: "train",
  text: `devis madame Perrin 4 rue de la Poste à Gif-sur-Yvette VMC à remplacer dans la salle de bain donc pose d'une VMC et aussi nettoyage des bouches dans la cuisine non en fait laisse tomber le nettoyage et on ajoute un point lumineux dans le couloir`,
  client: { nom: "Mme Perrin", adr: "4 rue de la Poste", ville: "Gif-sur-Yvette" },
  L: [["P078", 1, "forfait"], ["P070", 1, "u"]] },

{ id: "A27", set: "train",
  text: `pour monsieur Lucas 13 rue des Sablons à Bures-sur-Yvette mur humide dans le garage étanchéité des murs par l'intérieur 18 m² puis doublage collé 18 m² et peinture 18 m²`,
  client: { nom: "M. Lucas", adr: "13 rue des Sablons", ville: "Bures-sur-Yvette" },
  L: [["P083", 18, "m²"], ["P038", 18, "m²"], ["P021", 18, "m²"]] },

{ id: "A28", set: "train",
  text: `devis pour monsieur Gauthier 2 chemin du Bois à Vaugrigneuse démolition d'une cloison en placo 12 m² et évacuation des gravats 3 mètres cubes`,
  client: { nom: "M. Gauthier", adr: "2 chemin du Bois", ville: "Vaugrigneuse" },
  L: [["P015", 12, "m²"], ["P005", 3, "m³"]] },

{ id: "A29", set: "train",
  text: `pour madame André 18 rue des Tilleuls à Linas il y a le balcon à nettoyer et démousser 9 m² et les murets à repeindre 14 m² en peinture extérieure et aussi changer une prise extérieure`,
  client: { nom: "Mme André", adr: "18 rue des Tilleuls", ville: "Linas" },
  L: [["P033", 9, "m²"], ["P034", 14, "m²"], ["P068", 1, "u"]] },

{ id: "A30", set: "train",
  text: `devis pour monsieur Fournier 6 rue des Roses à Ollainville pose d'une cuisine équipée pose du plan de travail 3 m et raccordement du lave-vaisselle`,
  client: { nom: "M. Fournier", adr: "6 rue des Roses", ville: "Ollainville" },
  L: [["HC:cuisine|P283", "*", "forfait"], ["HC:plan de travail|P284", 3, "ml"], ["P067", 1, "u"]] },

{ id: "A31", set: "train",
  text: `devis pour monsieur et madame Vincent 40 rue de Limours à Briis-sous-Forges rénovation complète de l'appartement protection et nettoyage peinture de tous les murs 180 m² et des plafonds 65 m² ponçage vitrification du parquet 50 m² ça va durer deux semaines`,
  client: { nom: "M. et Mme Vincent", adr: "40 rue de Limours", ville: "Briis-sous-Forges" }, duree: 10,
  L: [["P003", 1, "forfait"], ["P021", 180, "m²"], ["P022", 65, "m²"], ["P049", 50, "m²"]] },

{ id: "A32", set: "train",
  text: `madame Michel 3 rue du Parc à Gometz-la-Ville tel 06 12 34 56 78 une porte double à laquer et trois portes simples plus le radiateur de l'entrée`,
  client: { nom: "Mme Michel", adr: "3 rue du Parc", ville: "Gometz-la-Ville", tel: "06 12 34 56 78" },
  L: [["P029", 1, "u"], ["P028", 3, "u"], ["P030", 1, "u"]] },

{ id: "A33", set: "train",
  text: `pour monsieur David 25 rue Nationale à Montlhéry pose de carrelage sur la terrasse 22 mètres carrés et demi en 60 60 pose en diagonale`,
  client: { nom: "M. David", adr: "25 rue Nationale", ville: "Montlhéry" },
  L: [["P044", 22.5, "m²"]] },

{ id: "A34", set: "train",
  text: `devis pour madame Bertrand 9 rue de l'Orme à Pecqueuse je lui fais la chambre du petit enlever le lino 10 m² poser un sol PVC 10 m² repeindre les murs 28 m² et le plafond 10 m² changer deux prises et poser un lustre`,
  client: { nom: "Mme Bertrand", adr: "9 rue de l'Orme", ville: "Pecqueuse" },
  L: [["P011", 10, "m²"], ["P053", 10, "m²"], ["P021", 28, "m²"], ["P022", 10, "m²"], ["P068", 2, "u"], ["P071", 1, "u"]] },

{ id: "A35", set: "train",
  text: `chez monsieur Roussel 14 rue de la Mairie aux Molières isolation des murs du garage doublage isolant sur ossature 32 m² et faux plafond 20 m² bandes comprises ensuite peinture murs et plafond`,
  client: { nom: "M. Roussel", adr: "14 rue de la Mairie", ville: "Molières" },
  L: [["P039", 32, "m²"], ["P040", 20, "m²"], ["P021", "*", "m²"], ["P022", "*", "m²"]] },

{ id: "A36", set: "train",
  text: `devis pour monsieur Lefebvre 31 rue de la Libération à Saint-Michel-sur-Orge email jean.lefebvre arobase orange point fr pose d'un WC suspendu avec habillage du bâti en placo hydro et peinture des WC 8 m²`,
  client: { nom: "M. Lefebvre", adr: "31 rue de la Libération", ville: "Saint-Michel-sur-Orge", email: "jean.lefebvre@orange.fr" },
  L: [["P058", 1, "forfait"], ["P043", 1, "forfait"], ["P024", 8, "m²"]] },

{ id: "A37", set: "train",
  text: `pour madame Guerin 5 rue des Vergers à Cernay-la-Ville salle de bain je refais les joints de la baignoire et l'étanchéité de la robinetterie et je pose un pare-baignoire`,
  client: { nom: "Mme Guerin", adr: "5 rue des Vergers", ville: "Cernay-la-Ville" },
  L: [["P063", 1, "forfait"], ["P062", 1, "u"]] },

{ id: "A38", set: "train",
  text: `devis pour monsieur Boyer 17 rue Gambetta à Étampes 45 m² de peinture sur les murs du séjour 20 m² de plafond et 60 m de plinthes à peindre`,
  client: { nom: "M. Boyer", adr: "17 rue Gambetta", ville: "Étampes" },
  L: [["P021", 45, "m²"], ["P022", 20, "m²"], ["P031", 60, "ml"]] },

{ id: "A39", set: "train",
  text: `pour madame Clément 12 rue de Rivoli Paris 4 peinture de la cuisine murs 24 m² plafond 9 m² chantier sur 4 jours prévoir le stationnement 4 jours et les frais de déplacement`,
  client: { nom: "Mme Clément", adr: "12 rue de Rivoli", ville: "Paris" }, duree: 4,
  L: [["P021", 24, "m²"], ["P022", 9, "m²"], ["P008", 4, "jour"], ["P093", 1, "forfait"]] },

{ id: "A40", set: "train",
  text: `devis pour monsieur Marchand 8 rue du Stade à Bruyères-le-Châtel coffrage du conduit de cheminée en placo coupe-feu ratissage des murs du salon 40 m² et peinture 40 m² et reprise de peinture sur le plafond 5 m²`,
  client: { nom: "M. Marchand", adr: "8 rue du Stade", ville: "Bruyères-le-Châtel" },
  L: [["P042", 1, "forfait"], ["P018", 40, "m²"], ["P021", 40, "m²"], ["P027", 5, "m²"]] },

/* ============ ENTRAÎNEMENT, 2e série (styles variés) ============ */
{ id: "B01", set: "train",
  text: `devis pour madame Petitjean 4 rue des Lilas à Limours dans la salle de bain dépose WC dépose baignoire et meuble lavabo création douche italienne siphon de sol WC suspendu sèche-serviettes 6 spots`,
  client: { nom: "Mme Petitjean", adr: "4 rue des Lilas", ville: "Limours" },
  L: [["P014", 1, "u"], ["P012", 1, "forfait"], ["P056", 1, "forfait"], ["P066", 1, "u"], ["P058", 1, "forfait"], ["P075", 1, "u"], ["P072", 6, "u"]] },

{ id: "B02", set: "train",
  text: `pour monsieur Legrand 12 rue de la Paix à Dourdan pose de parquet flottant dans les deux chambres 24 m² à 22 € le mètre carré dépose de l'ancienne moquette 24 m² à 8 € et plinthes 28 m à 10 € le mètre`,
  client: { nom: "M. Legrand", adr: "12 rue de la Paix", ville: "Dourdan" },
  L: [["P051", 24, "m²", { pu: 22 }], ["P011", 24, "m²", { pu: 8 }], ["P054", 28, "ml", { pu: 10 }]] },

{ id: "B03", set: "train",
  text: `devis pour monsieur Tessier 3 rue du Puits à Janvry peinture du salon murs 45 m² ou plutôt 48 m² plafond 20 m² et la cage d'escalier murs 30 m² avec plus-value grande hauteur 30 m²`,
  client: { nom: "M. Tessier", adr: "3 rue du Puits", ville: "Janvry" },
  L: [["P021", 48, "m²"], ["P022", 20, "m²"], ["P021", 30, "m²"], ["P023", 30, "m²"]] },

{ id: "B04", set: "train",
  text: `pour madame Vidal 8 rue des Acacias à Orsay pose d'une crédence en verre dans la cuisine 3 m et remplacement de la hotte et aussi remplacer deux prises`,
  client: { nom: "Mme Vidal", adr: "8 rue des Acacias", ville: "Orsay" },
  L: [["HC:crédence|P285", 3, "ml"], ["HC:hotte|P287", 1, "forfait"], ["P068", 2, "u"]] },

{ id: "B05", set: "train",
  text: `devis pour monsieur Chauvin douze rue des Écoles à Forges-les-Bains peinture des murs de la chambre trente-deux mètres carrés et du plafond douze mètres carrés virgule cinq et pose de trois luminaires`,
  client: { nom: "M. Chauvin", adr: "12 rue des Écoles", ville: "Forges-les-Bains" },
  L: [["P021", 32, "m²"], ["P022", 12.5, "m²"], ["P071", 3, "u"]] },

{ id: "B06", set: "train",
  text: `pour madame Collet 5 rue du Lavoir à Limours pose de carrelage 60 60 dans l'entrée 9 m² dépose de l'ancien carrelage 9 m² et ragréage 9 m² finalement pas de ragréage`,
  client: { nom: "Mme Collet", adr: "5 rue du Lavoir", ville: "Limours" },
  L: [["P044", 9, "m²"], ["P010", 9, "m²"]] },

{ id: "B07", set: "train",
  text: `devis chez monsieur et madame Robert à Limours au 15 rue de Chartres téléphone 06 11 22 33 44 mail robert point famille arobase gmail point com changement du chauffe-eau et remplacement du mitigeur de la cuisine`,
  client: { nom: "M. et Mme Robert", adr: "15 rue de Chartres", ville: "Limours", tel: "06 11 22 33 44", email: "robert.famille@gmail.com" },
  L: [["P092", 1, "forfait"], ["P061", 1, "u"]] },

{ id: "B08", set: "train",
  text: `devis pour monsieur Aubry 20 rue de la Mairie à Arpajon alors cuisine dépose du lino 12 m² pose de carrelage 12 m² format 30 30 peinture des murs 30 m² et du plafond 12 m² ensuite salon ponçage et vitrification du parquet 25 m² peinture des murs 55 m² et dans la salle de bain remplacement du lavabo et pose d'un miroir`,
  client: { nom: "M. Aubry", adr: "20 rue de la Mairie", ville: "Arpajon" },
  L: [["P011", 12, "m²"], ["P044", 12, "m²"], ["P021", 30, "m²"], ["P022", 12, "m²"], ["P049", 25, "m²"], ["P021", 55, "m²"], ["P060", 1, "u"], ["HC:miroir|P280", 1, "forfait"]] },

{ id: "B09", set: "train",
  text: `pour madame Hervé 2 rue des Sources à Saint-Chéron dans les WC dépose du papier peint 9 m² peinture murs et plafond 11 m² pose d'un lave-mains et il y a 40 € de frais de déplacement`,
  client: { nom: "Mme Hervé", adr: "2 rue des Sources", ville: "Saint-Chéron" },
  L: [["P009", 9, "m²"], ["P024", 11, "m²"], ["P060", 1, "u"], ["P093", 1, "forfait", { pu: 40 }]] },

{ id: "B10", set: "train",
  text: `devis pour monsieur Carpentier 6 chemin des Prés à Sonchamp pose d'un portillon et de 25 m de clôture rigide et 10 panneaux occultants ça va prendre une semaine`,
  client: { nom: "M. Carpentier", adr: "6 chemin des Prés", ville: "Sonchamp" }, duree: 5,
  L: [["P088", 1, "forfait"], ["P087", 25, "ml"], ["P089", 10, "panneau"]] },

{ id: "B11", set: "train",
  text: `bonjour j'ai un petit devis à faire pour madame Poirier 9 rue Pasteur à Linas c'est juste une prise à remplacer et un luminaire à poser dans l'entrée merci`,
  client: { nom: "Mme Poirier", adr: "9 rue Pasteur", ville: "Linas" },
  L: [["P068", 1, "u"], ["P071", 1, "u"]] },

{ id: "B12", set: "train",
  text: `pour monsieur Jacquet 31 rue de la Vallée à Bures-sur-Yvette création d'une cloison en placo 14 m² avec un bloc-porte doublage collé sur le mur du fond 9 m² bandes et joints 23 m² puis peinture des murs 46 m²`,
  client: { nom: "M. Jacquet", adr: "31 rue de la Vallée", ville: "Bures-sur-Yvette" },
  L: [["P036", 14, "m²"], ["P080", 1, "u"], ["P038", 9, "m²"], ["P041", 23, "m²"], ["P021", 46, "m²"]] },

{ id: "B13", set: "train",
  text: `devis madame Renaud 17 rue Victor Hugo à Massy 18 m² de faïence à déposer dans la salle de bain 18 m² de faïence à reposer en 20 20 et 4 m² de carrelage au sol`,
  client: { nom: "Mme Renaud", adr: "17 rue Victor Hugo", ville: "Massy" },
  L: [["P010", 18, "m²"], ["P044", 18, "m²"], ["P044", 4, "m²"]] },

{ id: "B14", set: "train",
  text: `pour monsieur Guillot 4 rue du Stade à Marcoussis 3 heures de main-d'œuvre pour reprendre des joints de carrelage et en fourniture un sac de joint à 12 € et une cartouche de silicone`,
  client: { nom: "M. Guillot", adr: "4 rue du Stade", ville: "Marcoussis" },
  L: [["P090", 3, "h"]],
  F: [["joint", 1, 12], ["silicone", 1, null]] },

{ id: "B15", set: "train",
  text: `devis pour madame Lemaire 10 rue des Érables à Égly réfection des joints de la baignoire remplacement du mitigeur de la baignoire et pose d'une paroi sur la baignoire`,
  client: { nom: "Mme Lemaire", adr: "10 rue des Érables", ville: "Égly" },
  L: [["P063", 1, "forfait"], ["P061", 1, "u"], ["P062", 1, "u"]] },

{ id: "B16", set: "train",
  text: `pour monsieur Bouvier 7 rue de l'Orge à Brétigny-sur-Orge repeindre la chambre murs et plafond et poncer le parquet`,
  client: { nom: "M. Bouvier", adr: "7 rue de l'Orge", ville: "Brétigny-sur-Orge" },
  L: [["P021", null, "m²"], ["P022", null, "m²"], ["P050|P049", null, "m²"]] },

{ id: "B17", set: "train",
  text: `devis pour madame Perrot 22 rue du Parc à Chevreuse remplacement de 4 fenêtres pose de 4 volets roulants et peinture de 4 portes`,
  client: { nom: "Mme Perrot", adr: "22 rue du Parc", ville: "Chevreuse" },
  L: [["P079", 4, "u"], ["HC:volets|P247", 4, "u"], ["P028", 4, "u"]] },

{ id: "B18", set: "train",
  text: `devis pour la société Bati Conseil 5 avenue de la Gare à Palaiseau locaux professionnels peinture des murs 200 m² peinture des plafonds 90 m² pose de sol PVC 90 m² fourniture comprise`,
  client: { nom: "Société Bati Conseil", adr: "5 avenue de la Gare", ville: "Palaiseau" }, tva: 20,
  L: [["P021", 200, "m²"], ["P022", 90, "m²"], ["P053", 90, "m²", { fc: true }]] },

{ id: "B19", set: "train",
  text: `pour madame Brunet 3 rue des Vignes à Limours sale de bain pause de faillance 12 m² avec joins fins et pause d'un meuble vasque`,
  client: { nom: "Mme Brunet", adr: "3 rue des Vignes", ville: "Limours" },
  L: [["P044", 12, "m²"], ["P060", 1, "u"]] },

{ id: "B20", set: "train",
  text: `devis pour monsieur Lacroix 8 rue du Moulin à Dourdan dans le séjour pose de parquet flottant 22 m² et plinthes 19 m même chose dans le bureau`,
  client: { nom: "M. Lacroix", adr: "8 rue du Moulin", ville: "Dourdan" },
  L: [["P051", 22, "m²"], ["P054", 19, "ml"], ["P051", 22, "m²"], ["P054", 19, "ml"]] },

/* ============ ENTRAÎNEMENT : dictées ponctuées (non-régression de la version 1) ============ */
{ id: "R01", set: "train",
  text: `Devis pour monsieur Durand, 9 rue de Gaudré à Limours. Chambre : on dépose le papier peint, vingt-huit mètres carrés, dix-huit euros du mètre. Enduit et peinture satin 28 m2 à 38 euros.`,
  client: { nom: "M. Durand", adr: "9 rue de Gaudré", ville: "Limours" },
  L: [["P009", 28, "m²", { pu: 18 }], ["P025", 28, "m²", { pu: 38 }]] },

{ id: "R02", set: "train",
  text: `Devis pour madame Humbert 10 rue des Essais 91410 Dourdan. Protection et nettoyage du chantier et évacuation à la déchetterie. Salle de bains : dépose de la baignoire et du meuble lavabo. Dépose du carrelage sol et mur 31 m2. Pose de carrelage au sol 6 m2 et faïence murale 25 mètres carrés. Pose d'un sèche-serviettes. 4 spots. Fournitures : receveur de douche 140 par 100 à 531 euros 19, colle Weber flex 8 sacs à 36,65 euros, mitigeur lavabo.`,
  client: { nom: "Mme Humbert", adr: "10 rue des Essais", ville: "Dourdan" },
  L: [["P001|P002", 1, "forfait"], ["P012", 1, "forfait"], ["P010", 31, "m²"], ["P044", 6, "m²"], ["P044", 25, "m²"], ["P075", 1, "u"], ["P072", 4, "u"]],
  F: [["receveur", 1, 531.19], ["colle", 8, 36.65], ["mitigeur", 1, null]] },

{ id: "R03", set: "train",
  text: `devis pour monsieur et madame dumont laval 4 rue mirabeau paris 16. protection des parquets et des meubles. Séjour peinture plafond 13,5 m2 et murs 49,5 m2. Cuisine plafond 6 m2 murs 23 m2. Ponçage et vitrification du parquet de la chambre 12 m2. Déplacement de la fibre dans le placard pour 160 euros.`,
  client: { nom: "M. et Mme Dumont Laval", adr: "4 rue Mirabeau", ville: "75016 Paris" },
  L: [["P002|P003", 1, "forfait"], ["P022", 13.5, "m²"], ["P021", 49.5, "m²"], ["P022", 6, "m²"], ["P021", 23, "m²"], ["P049", 12, "m²"], ["P076", 1, "forfait", { pu: 160 }]] },

{ id: "R04", set: "train",
  text: `Pour la copropriété du 18 rue des bas rogers 92800 Puteaux. Il faut faire un coffrage en bois des tuyaux extérieurs pour 228 euros, peinture blanche spéciale extérieure 145 euros. Fournitures : panneau contreplaqué marine 169 euros, 2 tasseaux 36 euros.`,
  client: { nom: "~copropri", adr: "18 rue des Bas Rogers", ville: "Puteaux" },
  L: [["P082", 1, "forfait", { pu: 228 }], ["HC:peinture blanche", 1, "forfait", { pu: 145 }]],
  F: [["panneau", 1, 169], ["tasseaux", 2, 18]] },

{ id: "R05", set: "train",
  text: `Devis pour monsieur Santini 9 rue des jardins du parc à Angervilliers. Remplacer la prise extérieure. Pose de trois éclairages extérieurs. Contrôle du tableau électrique. Nettoyage de la VMC. On met un WC suspendu à la place de l'ancien.`,
  client: { nom: "M. Santini", adr: "9 rue des Jardins du Parc", ville: "Angervilliers" },
  L: [["P068", 1, "u"], ["P071", 3, "u"], ["P073", 1, "forfait"], ["P077", 1, "forfait"], ["P058", 1, "forfait"]] },

/* ================================== TEST ================================== */
{ id: "T01", set: "test",
  text: `bonjour alors c'est pour un devis chez madame Aubert elle habite au 12 rue des Peupliers à Limours elle veut refaire sa cuisine donc il faut enlever la faïence 6 m² remettre de la faïence 6 m² format 20 20 repeindre le plafond 10 m² et les murs 22 m² et changer le mitigeur`,
  client: { nom: "Mme Aubert", adr: "12 rue des Peupliers", ville: "Limours" },
  L: [["P010", 6, "m²"], ["P044", 6, "m²"], ["P022", 10, "m²"], ["P021", 22, "m²"], ["P061", 1, "u"]] },

{ id: "T02", set: "test",
  text: `devis monsieur et madame Renard 3 allée des Cerisiers à Dourdan chambre parentale dépose de la moquette 16 m² ragréage 16 m² parquet collé 16 m² plinthes en bois 17 m et peinture des murs 40 m²`,
  client: { nom: "M. et Mme Renard", adr: "3 allée des Cerisiers", ville: "Dourdan" },
  L: [["P011", 16, "m²"], ["P020", 16, "m²"], ["P052", 16, "m²"], ["P054", 17, "ml"], ["P021", 40, "m²"]] },

{ id: "T03", set: "test",
  text: `pour monsieur Caron 22 rue de l'Yvette à Chevreuse je change le cumulus et je remplace les toilettes par des toilettes suspendues et je pose un lavabo`,
  client: { nom: "M. Caron", adr: "22 rue de l'Yvette", ville: "Chevreuse" },
  L: [["P092", 1, "forfait"], ["P058", 1, "forfait"], ["P060", 1, "u"]] },

{ id: "T04", set: "test",
  text: `devis pour madame Picard 7 rue des Fontaines à Marcoussis salle de bain 5 m² au sol on casse tout le carrelage sol et murs 25 m² on pose du carrelage 30 60 sur les murs 20 m² et au sol 5 m² en fourniture je prends la faïence 20 m² à 25 € le mètre et le carrelage de sol 5 m²`,
  client: { nom: "Mme Picard", adr: "7 rue des Fontaines", ville: "Marcoussis" },
  L: [["P010", 25, "m²"], ["P044", 20, "m²"], ["P044", 5, "m²"]],
  F: [["faïence", 20, 25], ["carrelage", 5, null]] },

{ id: "T05", set: "test",
  text: `chez monsieur Roger 15 rue de la Vallée à Saint-Chéron remplacer 4 prises ajouter 2 prises dans le garage poser 3 luminaires et mettre 6 spots dans la salle de bain`,
  client: { nom: "M. Roger", adr: "15 rue de la Vallée", ville: "Saint-Chéron" },
  L: [["P068", 4, "u"], ["P069", 2, "u"], ["P071", 3, "u"], ["P072", 6, "u"]] },

{ id: "T06", set: "test",
  text: `devis pour monsieur et madame Giraud 9 rue des Érables à Breuillet salon 35 m² au sol hauteur 2 m 50 peinture complète murs et plafond et dans l'entrée les murs seulement 18 m² durée 5 jours`,
  client: { nom: "M. et Mme Giraud", adr: "9 rue des Érables", ville: "Breuillet" }, duree: 5,
  L: [["P021", 59.2, "m²"], ["P022", 35, "m²"], ["P021", 18, "m²"]] },

{ id: "T07", set: "test",
  text: `pour madame Barbier 2 place du Marché à Arpajon détapisser le couloir 20 m² enduire 20 m² et peindre 20 m² et aussi peindre deux portes`,
  client: { nom: "Mme Barbier", adr: "2 place du Marché", ville: "Arpajon" },
  L: [["P009", 20, "m²"], ["P018", 20, "m²"], ["P021", 20, "m²"], ["P028", 2, "u"]] },

{ id: "T08", set: "test",
  text: `monsieur Arnaud 10 rue du Pont à Orsay cloison en placo 9 m² avec une porte donc un bloc porte et un faux plafond 9 m² plus 4 spots tva 20`,
  client: { nom: "M. Arnaud", adr: "10 rue du Pont", ville: "Orsay" }, tva: 20,
  L: [["P036", 9, "m²"], ["P080", 1, "u"], ["P040", 9, "m²"], ["P072", 4, "u"]] },

{ id: "T09", set: "test",
  text: `devis pour madame Mathieu 6 rue de Chartres à Rochefort-en-Yvelines parquet du salon à poncer seulement 30 m² sans vitrification et pose de plinthes 22 m`,
  client: { nom: "Mme Mathieu", adr: "6 rue de Chartres", ville: "Rochefort-en-Yvelines" },
  L: [["P050", 30, "m²"], ["P054", 22, "ml"]] },

{ id: "T10", set: "test",
  text: `pour monsieur Lemoine à Angervilliers 4 rue de la Croix une journée et demie de main-d'œuvre pour des petites réparations et 80 € de frais de déplacement`,
  client: { nom: "M. Lemoine", adr: "4 rue de la Croix", ville: "Angervilliers" },
  L: [["P091", 1.5, "jour"], ["P093", 1, "forfait", { pu: 80 }]] },

{ id: "T11", set: "test",
  text: `devis pour madame Duval 28 rue de la République à Massy dépose de l'ancien WC pose d'un WC neuf dépose du lino 3 m² pose de carrelage 3 m² et peinture des toilettes murs et plafond 11 m²`,
  client: { nom: "Mme Duval", adr: "28 rue de la République", ville: "Massy" },
  L: [["P014", 1, "u", { opt: true }], ["P059", 1, "forfait"], ["P011", 3, "m²"], ["P044", 3, "m²"], ["P024", 11, "m²"]] },

{ id: "T12", set: "test",
  text: `chez monsieur Brun 5 rue du Clos à Fontenay-lès-Briis il faut déposer la clôture 20 m et poser 20 m de clôture rigide et un portillon`,
  client: { nom: "M. Brun", adr: "5 rue du Clos", ville: "Fontenay" },
  L: [["P017", 20, "ml"], ["P087", 20, "ml"], ["P088", 1, "forfait"]] },

{ id: "T13", set: "test",
  text: `devis pour monsieur Blanchard 11 avenue de Paris à Versailles local professionnel peinture des bureaux murs 120 m² et plafonds 60 m² remplacement de 10 interrupteurs et contrôle du tableau`,
  client: { nom: "M. Blanchard", adr: "11 avenue de Paris", ville: "Versailles" }, tva: 20,
  L: [["P021", 120, "m²"], ["P022", 60, "m²"], ["P068", 10, "u"], ["P073", 1, "forfait"]] },

{ id: "T14", set: "test",
  text: `pour madame Marie 18 rue des Vignes à Janvry terrasse nettoyage et démoussage des murets 25 m² puis peinture des murets 25 m² deux couches`,
  client: { nom: "Mme Marie", adr: "18 rue des Vignes", ville: "Janvry" },
  L: [["P033", 25, "m²"], ["P034", 25, "m²"]] },

{ id: "T15", set: "test",
  text: `devis pour monsieur Jacob 3 rue du Four à Linas salle d'eau dépose du bac à douche et de la paroi création d'une douche italienne pose de la paroi et du meuble vasque étanchéité sous carrelage 7 m² faïence 15 m² et un sèche-serviettes fournitures receveur extra plat 90 par 120 à 289 € paroi fixe et meuble vasque 80 cm`,
  client: { nom: "M. Jacob", adr: "3 rue du Four", ville: "Linas" },
  L: [["P016", 1, "forfait"], ["P056", 1, "forfait"], ["P057", 1, "forfait"], ["P084", 7, "m²"], ["P044", 15, "m²"], ["P075", 1, "u"]],
  F: [["receveur", 1, 289], ["paroi", 1, null], ["vasque", 1, null]] },

{ id: "T16", set: "test",
  text: `madame Benoit 14 rue Pasteur à Palaiseau j'ai trois chambres à repeindre la première 30 m² de murs la deuxième 28 m² et la troisième 34 m² et les trois plafonds font 36 m² en tout`,
  client: { nom: "Mme Benoit", adr: "14 rue Pasteur", ville: "Palaiseau" },
  L: [["P021", 30, "m²"], ["P021", 28, "m²"], ["P021", 34, "m²"], ["P022", 36, "m²"]] },

{ id: "T17", set: "test",
  text: `devis pour monsieur Paris 6 rue des Écoles à Égly remplacement d'un radiateur électrique dans le salon et peinture de 2 radiateurs dans les chambres`,
  client: { nom: "M. Paris", adr: "6 rue des Écoles", ville: "Égly" },
  L: [["P075", 1, "u"], ["P030", 2, "u"]] },

{ id: "T18", set: "test",
  text: `pour monsieur Hamon 30 rue de la Gare à Brétigny-sur-Orge fissures au plafond du séjour à ouvrir et reboucher 8 m puis peinture du plafond 24 m² et raccords de peinture sur les murs 6 m²`,
  client: { nom: "M. Hamon", adr: "30 rue de la Gare", ville: "Brétigny-sur-Orge" },
  L: [["P019", 8, "ml"], ["P022", 24, "m²"], ["P027", 6, "m²"]] },

{ id: "T19", set: "test",
  text: `devis madame Leclerc 2 rue de l'Abreuvoir à Bonnelles pause de papier peint dans la chambre 18 m² le papier est fourni par la cliente et lessivage du plafond`,
  client: { nom: "Mme Leclerc", adr: "2 rue de l'Abreuvoir", ville: "Bonnelles" },
  L: [["P032", 18, "m²"], ["HC:lessivage", "*", "m²"]] },

{ id: "T20", set: "test",
  text: `pour monsieur Rey 9 rue du Moulin à Gometz-le-Châtel déplacement de la box fibre dans le bureau et création de 3 prises et un point lumineux au plafond`,
  client: { nom: "M. Rey", adr: "9 rue du Moulin", ville: "Gometz-le-Châtel" },
  L: [["P076", 1, "forfait"], ["P069", 3, "u"], ["P070", 1, "u"]] },

{ id: "T21", set: "test",
  text: `devis pour madame Schmitt 27 rue de Versailles à Rambouillet dans le séjour des poses du parquet flottant 26 m² pose d'un parquet stratifié 26 m² fourniture comprise à 45 € le mètre carré et plaintes 21 m`,
  client: { nom: "Mme Schmitt", adr: "27 rue de Versailles", ville: "Rambouillet" },
  L: [["P011", 26, "m²"], ["P051", 26, "m²", { pu: 45, fc: true }], ["P054", 21, "ml"]] },

{ id: "T22", set: "test",
  text: `chez monsieur Collet 4 rue Mirabeau Paris 16 protection des sols et des meubles peinture du séjour plafond 14 m² murs 50 m² et de la cuisine plafond 6 m² murs 22 m² compter 6 jours avec le parking`,
  client: { nom: "M. Collet", adr: "4 rue Mirabeau", ville: "Paris" }, duree: 6,
  L: [["P001|P002", 1, "forfait"], ["P022", 14, "m²"], ["P021", 50, "m²"], ["P022", 6, "m²"], ["P021", 22, "m²"], ["P008", 6, "jour"]] },

{ id: "T23", set: "test",
  text: `devis pour monsieur Meunier 12 rue du Lavoir à Sermaise gros chantier démolition de cloisons en placo 30 m² évacuation des gravats 6 m³ nouvelle cloison 22 m² en placo hydro et doublage isolant 40 m²`,
  client: { nom: "M. Meunier", adr: "12 rue du Lavoir", ville: "Sermaise" },
  L: [["P015", 30, "m²"], ["P005", 6, "m³"], ["P037", 22, "m²"], ["P039", 40, "m²"]] },

{ id: "T24", set: "test",
  text: `pour madame Fleury 8 rue des Jardins à Saint-Yon réfection de la douche réparation de l'évacuation sous la douche siphon de sol à poser reprise du carrelage mural et raccordement de la machine à laver`,
  client: { nom: "Mme Fleury", adr: "8 rue des Jardins", ville: "Saint-Yon" },
  L: [["P065", 1, "forfait"], ["P066", 1, "u"], ["P048", 1, "forfait"], ["P067", 1, "u"]] },

{ id: "T25", set: "test",
  text: `devis pour monsieur et madame Da Silva 16 rue de la Paix à Corbeil-Essonnes fenêtre de la cuisine à remplacer coffrage en bois des tuyaux et pose de lames occultantes 8 panneaux sur la clôture et 4 heures de régie pour le reste`,
  client: { nom: "M. et Mme Da Silva", adr: "16 rue de la Paix", ville: "Corbeil-Essonnes" },
  L: [["P079", 1, "u"], ["P082", 1, "forfait"], ["P089", 8, "panneau"], ["P090", 4, "h"]] },
].concat(require("./corpus_valid.js"), require("./corpus_valid2.js"), require("./corpus_valid3.js"));
