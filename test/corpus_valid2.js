/* Deuxième jeu « à l'aveugle » — écrit le 10/11/2026 après la première série de corrections,
   sans essayer les phrases sur le moteur avant de les figer. Sert à vérifier que les progrès
   se généralisent à des dictées nouvelles. Clients et adresses fictifs. */
module.exports = [
{ id: "W01", set: "valid2",
  text: `devis pour monsieur et madame Schmitt 22 rue des Platanes à Marcoussis on refait toute la salle de bain donc on casse tout dépose complète des sanitaires on enlève la faïence 20 m² on fait une douche à l'italienne on met un meuble vasque un WC suspendu et un sèche-serviettes carrelage au sol 4 m² faïence aux murs 20 m² en 30 60 et à la fin la peinture du plafond 4 m²`,
  client: { nom: "M. et Mme Schmitt", adr: "22 rue des Platanes", ville: "Marcoussis" },
  L: [["P013", 1, "forfait"], ["P010", 20, "m²"], ["P056", 1, "forfait"], ["P060", 1, "u"], ["P058", 1, "forfait"], ["P075", 1, "u"], ["P044", 4, "m²"], ["P044", 20, "m²"], ["P022|P024", 4, "m²"]] },

{ id: "W02", set: "valid2",
  text: `madame Girard 5 rue de l'Orme à Saint-Chéron elle veut changer ses fenêtres il y en a quatre et la porte d'entrée aussi mais ça je fais pas je lui pose aussi deux blocs portes à l'étage`,
  client: { nom: "Mme Girard", adr: "5 rue de l'Orme", ville: "Saint-Chéron" },
  L: [["P079", 4, "u"], ["P080", 2, "u"]] },

{ id: "W03", set: "valid2",
  text: `pour monsieur Diallo 8 rue Jean Jaurès à Arpajon dans la sale de bain dépose de la baignoire et du lavabo pause d'un receveur avec préparation du support faillance 12 mètres carrés et plaintes carrelées 6 mètres`,
  client: { nom: "M. Diallo", adr: "8 rue Jean Jaurès", ville: "Arpajon" },
  L: [["P012", 1, "forfait"], ["P064", 1, "forfait"], ["P044", 12, "m²"], ["P047", 6, "ml"]] },

{ id: "W04", set: "valid2",
  text: `devis madame Roche 3 rue des Fauvettes à Dourdan peinture du salon murs 48 m² à 30 € le mètre carré plafond 22 m² à 35 € et deux portes à 110 € pièce`,
  client: { nom: "Mme Roche", adr: "3 rue des Fauvettes", ville: "Dourdan" },
  L: [["P021", 48, "m²", { pu: 30 }], ["P022", 22, "m²", { pu: 35 }], ["P028", 2, "u", { pu: 110 }]] },

{ id: "W05", set: "valid2",
  text: `monsieur Antoine 16 rue du Parc à Breuillet remplacement du chauffe-eau par un 200 litres et remplacement du mitigeur de la cuisine en fournitures un chauffe-eau Atlantic 200 litres à 489 € un groupe de sécurité à 35 € et un mitigeur Grohe`,
  client: { nom: "M. Antoine", adr: "16 rue du Parc", ville: "Breuillet" },
  L: [["P092", 1, "forfait"], ["P061", 1, "u"]],
  F: [["chauffe-eau", 1, 489], ["groupe", 1, 35], ["mitigeur", 1, null]] },

{ id: "W06", set: "valid2",
  text: `pour la société Cabinet Morin 2 place de la Mairie à Limours ce sont des bureaux donc TVA 20 % rénovation des bureaux peinture des murs 120 m² plafonds 60 m² pose de sol PVC 60 m² après ragréage 60 m² chantier sur deux semaines`,
  client: { nom: "Société Cabinet Morin", adr: "2 place de la Mairie", ville: "Limours" }, tva: 20, duree: 10,
  L: [["P021", 120, "m²"], ["P022", 60, "m²"], ["P053", 60, "m²"], ["P020", 60, "m²"]] },

{ id: "W07", set: "valid2",
  text: `bonjour devis pour madame Kaya 11 rue des Tulipes à Égly elle a un dégât des eaux au plafond de la cuisine donc je dépose le placo abîmé 6 m² je refais un faux plafond 6 m² avec les bandes et je repeins le plafond complet 14 m²`,
  client: { nom: "Mme Kaya", adr: "11 rue des Tulipes", ville: "Égly" },
  L: [["P015", 6, "m²"], ["P040", 6, "m²"], ["P041", "*", "m²", { opt: true }], ["P022", 14, "m²"]] },

{ id: "W08", set: "valid2",
  text: `monsieur Tran 30 avenue de la République à Massy pose de parquet massif collé dans le séjour 32 m² ponçage et vitrification 32 m² et plinthes en bois 24 mètres linéaires`,
  client: { nom: "M. Tran", adr: "30 avenue de la République", ville: "Massy" },
  L: [["P052", 32, "m²"], ["P049", 32, "m²"], ["P054", 24, "ml"]] },

{ id: "W09", set: "valid2",
  text: `chez madame Poulain 4 rue du Four à Bullion extérieur pose d'un portillon et de 18 mètres de clôture rigide avec 9 panneaux de lames occultantes et je lui démousse sa terrasse 25 m²`,
  client: { nom: "Mme Poulain", adr: "4 rue du Four", ville: "Bullion" },
  L: [["P088", 1, "forfait"], ["P087", 18, "ml"], ["P089", 9, "panneau"], ["P033", 25, "m²"]] },

{ id: "W10", set: "valid2",
  text: `devis pour monsieur Faure 7 rue de la Source à Bonnelles dans la chambre 1 peinture des murs 30 m² et du plafond 11 m² dans la chambre 2 pareil dans le couloir toile de verre et peinture 18 m²`,
  client: { nom: "M. Faure", adr: "7 rue de la Source", ville: "Bonnelles" },
  L: [["P021", 30, "m²"], ["P022", 11, "m²"], ["P021", 30, "m²"], ["P022", 11, "m²"], ["P026", 18, "m²"]] },

{ id: "W11", set: "valid2",
  text: `madame Brunet 9 rue des Vignes à Angervilliers j'ai trois heures de main d'œuvre pour fixer des étagères et une tringle et aussi le remplacement de deux prises et d'un interrupteur`,
  client: { nom: "Mme Brunet", adr: "9 rue des Vignes", ville: "Angervilliers" },
  L: [["P090", 3, "h"], ["P068", 2, "u"], ["P068", 1, "u"]] },

{ id: "W12", set: "valid2",
  text: `pour monsieur et madame Carré 15 allée du Bois à Forges-les-Bains création d'une cloison avec une porte donc 12 m² de placo sur ossature un bloc porte les bandes 24 m² et peinture des deux côtés 24 m²`,
  client: { nom: "M. et Mme Carré", adr: "15 allée du Bois", ville: "Forges-les-Bains" },
  L: [["P036", 12, "m²"], ["P080", 1, "u"], ["P041", 24, "m²"], ["P021", 24, "m²"]] },

{ id: "W13", set: "valid2",
  text: `devis monsieur Leclerc 6 rue des Charmes à Rambouillet peinture de la cuisine murs 28 m² plafond 10 m² et nettoyage de fin de chantier non finalement pas de nettoyage il le fera lui-même`,
  client: { nom: "M. Leclerc", adr: "6 rue des Charmes", ville: "Rambouillet" },
  L: [["P021", 28, "m²"], ["P022", 10, "m²"]] },

{ id: "W14", set: "valid2",
  text: `madame Da Silva 12 rue du Moulin à Ollainville salle de bain remplacement de la baignoire par une baignoire neuve pose d'un pare-baignoire remplacement du mitigeur de la baignoire et joints silicone`,
  client: { nom: "Mme Da Silva", adr: "12 rue du Moulin", ville: "Ollainville" },
  L: [["HC:baignoire", "*", "forfait"], ["P062", 1, "u"], ["P061", 1, "u"], ["P063", 1, "forfait"]] },

{ id: "W15", set: "valid2",
  text: `pour monsieur Roger 40 rue Nationale à Dourdan électricité je crée quatre prises dans le salon deux points lumineux je pose six spots dans la cuisine et je déplace l'arrivée de la fibre`,
  client: { nom: "M. Roger", adr: "40 rue Nationale", ville: "Dourdan" },
  L: [["P069", 4, "u"], ["P070", 2, "u"], ["P072", 6, "u"], ["P076", 1, "forfait"]] },

{ id: "W16", set: "valid2",
  text: `devis pour madame Maillard dix-huit rue de la Gare à Limours ratissage des murs du couloir vingt-deux virgule cinq mètres carrés peinture des murs vingt-deux virgule cinq mètres carrés et peinture des plinthes douze mètres`,
  client: { nom: "Mme Maillard", adr: "18 rue de la Gare", ville: "Limours" },
  L: [["P018", 22.5, "m²"], ["P021", 22.5, "m²"], ["P031", 12, "ml"]] },

{ id: "W17", set: "valid2",
  text: `monsieur Benoit 5 rue des Lilas à Briis-sous-Forges carrelage de la terrasse elle fait 6 mètres sur 4 en 60 60 et les plinthes carrelées autour 20 mètres`,
  client: { nom: "M. Benoit", adr: "5 rue des Lilas", ville: "Briis-sous-Forges" },
  L: [["P044", 24, "m²"], ["P047", 20, "ml"]] },

{ id: "W18", set: "valid2",
  text: `madame Lemoine 27 rue de Versailles à Saint-Arnoult-en-Yvelines dépose de l'ancien WC et pose d'un WC neuf je raccorde aussi le lave-vaisselle et je change le siphon de l'évier`,
  client: { nom: "Mme Lemoine", adr: "27 rue de Versailles", ville: "Saint-Arnoult-en-Yvelines" },
  L: [["P014", 1, "u", { opt: true }], ["P059", 1, "forfait"], ["P067", 1, "u"], ["HC:siphon", "*", "forfait"]] },

{ id: "W19", set: "valid2",
  text: `devis monsieur Perret 8 chemin des Sables à Vaugrigneuse pose d'un sol stratifié dans la chambre 14 m² fourni posé à 55 € le mètre carré dépose de la moquette 14 m² et plinthes 16 mètres fournitures comprises`,
  client: { nom: "M. Perret", adr: "8 chemin des Sables", ville: "Vaugrigneuse" },
  L: [["P051", 14, "m²", { pu: 55, fc: true }], ["P011", 14, "m²"], ["P054", 16, "ml", { fc: true }]] },

{ id: "W20", set: "valid2",
  text: `alors c'est pour monsieur et madame Noël 3 rue du Clos à Roinville ils refont leur cuisine et leur entrée dans la cuisine je dépose l'ancien carrelage 12 m² ragréage 12 m² et je pose un carrelage 60 par 60 sur 12 m² je fais aussi la crédence en faïence 3 m² je crée trois prises et je déplace une prise non pardon je la remplace dans l'entrée je repeins les murs 20 m² et le plafond 5 m² et je change le luminaire compter six jours de travail`,
  client: { nom: "M. et Mme Noël", adr: "3 rue du Clos", ville: "Roinville" }, duree: 6,
  L: [["P010", 12, "m²"], ["P020", 12, "m²"], ["P044", 12, "m²"], ["P044", 3, "m²"], ["P069", 3, "u"], ["P068", 1, "u"], ["P021", 20, "m²"], ["P022", 5, "m²"], ["P071", 1, "u"]] },
];
