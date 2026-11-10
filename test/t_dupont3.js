const M = require(process.argv[2]||"../engine.js");
const biblio = require("/home/claude/devis_src/catalogue_seed.json");
const d = `J'ai un devis pour refaire de la peinture dans un salon avec une surface au sol de 30 m², et une hauteur sous plafond de 1,80 m donc je te laisse mesurer et me dire combien il y a de mètres carrés de peinture à faire l'idée c'est de prendre en fourniture une une peinture blanche, Tollens satinée classique avec trois couches, je pense que le devis va me prendre à peu près trois jours et je pense que je vais avoir des frais kilométriques parce qu'il y a plus de 100 km de chez moi, il est dans Paris centre donc compte ça aussi dans le devis il y a aussi la vitrification d'un parquet donc je vais le poncer et ensuite le revenir et dans ce chantier il y a aussi un petit chantier où je dois changer un ballon d'eau chaude, donc j'ai un peu de plomberie classique pour le changement d'un ballon d'eau chaude dépose et remplacement et le ballon d'eau chaude je prends un ballon de 60 l Leroy Merlin classique`;
const r = M.analyse(d, biblio);
console.log(JSON.stringify(r.client), "|", r.objet);
for (const s of r.sections){console.log("#",s.titre);for(const l of s.lignes)console.log(` - [${l.type}] ${l.designation.slice(0,70)} | q=${l.quantite} ${l.unite} pu=${l.pu}  ⟵ ${l.raw}`);}
console.log(r.notes);
