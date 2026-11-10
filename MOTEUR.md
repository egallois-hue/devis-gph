# Moteur de compréhension des dictées (version 2)

Le moteur transforme une dictée parlée (peu ou pas de ponctuation, fautes de transcription de Siri)
en devis structuré. Il tourne entièrement dans le navigateur : aucune IA distante, aucune clé,
aucun abonnement, et il marche hors ligne. Fichier : `engine.js`.

Règle absolue : **aucun prix n'est inventé**. Un prix vient du catalogue de prestations
(main-d'œuvre) ou de la dictée (« à 28 € le mètre »). Sinon la ligne reste « à saisir ».

## Chaîne de traitement

| Étape | Fonction | Rôle |
|---|---|---|
| 1 | `normalizeOral` | Nombres en lettres, unités (« mètres carrés » → m²), « 2 m 50 », dimensions (« 6 m sur 4 » → 24 m²), homophones (« plaintes » → plinthes), corrections (« 12 m² non pardon 14 m² ») |
| 2 | `extractClient` | Civilité, nom, couple, société, adresse, code postal et ville, téléphone, e-mail |
| 3 | faits globaux (dans `analyse`) | TVA, durée, frais de déplacement, stationnement, surface au sol et hauteur, taille du chantier |
| 4 | `segmenter` | Découpe en « intentions » : une prestation par segment (liaisons, sujets, quantités, nouveaux verbes, énumérations) |
| 5 | interprétation (dans `analyse`) | Pièces, ellipses (« et le plafond 11 m² »), « pareil dans la chambre 2 », retraits (« finalement pas de nettoyage »), corrections (« non je crée une prise »), pronoms (« je la remplace »), fournitures, client qui fournit |
| 6 | `matchTokens` + `decide` | Appariement au catalogue : ressemblance pondérée, compatibilité de l'action (poser ≠ déposer ≠ peindre), objet principal, unité ; score de confiance |

Résultat de `Moteur.analyse(texte, catalogue, options)` :
`{ client, objet, tva, sections, notes, dureeJours, ignored }`. Chaque ligne porte
`biblio_id` (ou rien si hors catalogue), `confiance`, `incertain` (à vérifier), `suggestions`
(prestations proches), `cle` (clé d'apprentissage), `raw` (ce qui a été dit).

## Quand le moteur n'est pas sûr

- Score trop faible : la ligne est **hors catalogue**, « à compléter ». Elle n'est jamais rattachée de force.
- Score correct mais deux prestations se valent (« 3 prises » : remplacement ou création ?) :
  la ligne est marquée **À vérifier** et une question est posée (3 questions au plus, 2 séries).
- **Apprentissage** : quand une autre prestation est choisie (« Prestations proches » ou réponse à la
  question), la correspondance « mots dictés → prestation » est enregistrée (`config/appris`,
  synchronisée entre appareils) et appliquée directement aux dictées suivantes. Le catalogue n'est pas modifié.

## Ajouter du vocabulaire

Tout est en tête de `engine.js` :

- `ORAL` : fautes de transcription. Exemple : `[W("plaintes"), "plinthes"]`.
- `SYN` : début de mot (sans accent) → racine. Exemple : `arrach: "depos"` (arracher = déposer).
- `COMPOUNDS` : expressions figées (« ballon d'eau chaude » → un seul mot).
- `PARLE` : façons de dire, par prestation du catalogue d'origine. Exemple :
  `P046: ["jointoiement", "reprise des joints", "refaire les joints", …]`. Le premier mot est un
  contrôle : il doit figurer dans la désignation, sinon l'entrée est ignorée (prestation renommée).
- Les « alias » saisis dans une prestation (Prestations → modifier) jouent le même rôle, sans toucher au code.

Après chaque ajout : relancer l'évaluation (ci-dessous). Une règle n'est gardée que si aucun jeu ne régresse.

## Évaluer

```
GPH_CATALOGUE=/chemin/catalogue_prestations.json node test/run_all.js   # tous les jeux + verdict
node test/eval.js --set train --detail                                  # détail des erreurs
node test/q.js "pose de carrelage 60 60 avec joint fin 18 m²"           # essai d'une phrase
python3 -m http.server 8765 &  python3 test/t_e2e.py                    # parcours complet dans Chrome
```

Le catalogue (avec les prix) n'est pas dans le dépôt : indiquer son chemin dans `GPH_CATALOGUE`.

Jeux de dictées (`test/corpus*.js`), avec le devis attendu écrit à la main :

- **train** : sert aux réglages ; doit rester à 100 %.
- **valid**, **valid2**, **valid3** : écrits « à l'aveugle » (sans essayer les phrases avant), mesurés une
  première fois tels quels, puis utilisés pour corriger. Leur score de premier passage est la mesure
  honnête de ce que le moteur fait sur des dictées nouvelles (`test/scores.json`).
- **test** : jamais regardé en détail, mesuré seulement en agrégé.

Mesures : rappel et précision des prestations, quantités et unités, prix dictés, fournitures,
client, durée, TVA, **prix inventés (doit rester à 0)**, temps de traitement.

## Modèle d'embeddings dans le navigateur : non retenu

Option étudiée : un petit modèle multilingue exécuté localement (transformers.js / ONNX).

- **Non mesuré** : les poids du modèle n'ont pas pu être téléchargés dans l'environnement de travail.
- Les erreurs relevées sur les jeux à l'aveugle viennent presque toutes du découpage et de
  l'interprétation (énumérations, ellipses, corrections, quantité dite après coup), pas du sens des
  mots. Un modèle d'embeddings n'agit que sur l'appariement, et distingue mal deux prestations très
  proches (« remplacement d'une prise » / « création d'une prise »).
- Coût : la bibliothèque seule pèse environ 10 Mo, le modèle multilingue de l'ordre de 100 Mo
  (ordre de grandeur, non vérifié ici), à télécharger et garder en cache sur l'iPhone, pour un moteur
  qui répond aujourd'hui en 10 à 15 ms.

Décision : le lexique parlé (`PARLE`) et l'apprentissage des corrections couvrent ce besoin sans poids
ni risque. À réévaluer si, à l'usage, les erreurs d'appariement deviennent majoritaires.

## Limites connues

- Phrases très libres ou hors sujet au milieu d'une dictée : elles sont ignorées ou signalées, pas comprises.
- Surfaces : le moteur calcule (dimensions, murs d'une pièce carrée) mais ne devine pas une mesure absente ; il la demande.
- Deux prestations très proches sans verbe : question posée plutôt que choix arbitraire.
- Le lexique `PARLE` vise le catalogue d'origine ; pour une prestation créée ensuite, ajouter des alias ou laisser l'apprentissage faire.
