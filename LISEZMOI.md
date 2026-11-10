# Devis Gallois PH

Application web de devis pour iPhone et Mac : dictée, mise en forme automatique (sans IA, hors ligne), PDF bleu roi avec devis fournisseurs en annexe, numérotation par exercice (1er octobre → 30 septembre), synchronisation entre appareils.

## Mise en service (une seule fois, environ 15 minutes)

### 1. Base de données gratuite (Supabase)
1. Créer un compte sur https://supabase.com (gratuit, sans carte), puis **New project** : nom `devis-gph`, région **Paris (eu-west-3)**, noter le mot de passe de la base.
2. **SQL Editor → New query** : coller tout le contenu de `supabase.sql`, puis **Run**.
3. **Authentication → Users → Add user → Create new user** : l'e-mail et le mot de passe de Philippe, cocher **Auto Confirm User**.
4. **Authentication → Sign In / Providers** : désactiver **Allow new users to sign up** (personne d'autre ne pourra créer de compte).
5. **Project Settings → API** : copier **Project URL** et la clé **anon public**, et les coller dans `config.js`.

### 2. Mise en ligne gratuite (GitHub Pages)
1. Déposer tous les fichiers de ce dossier dans le dépôt GitHub.
2. **Settings → Pages** : Source = **Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. L'adresse s'affiche après une minute : `https://<compte>.github.io/<dépôt>/`.

### 3. Installation sur les appareils
- **iPhone** : ouvrir l'adresse dans Safari → bouton Partager → **Sur l'écran d'accueil**.
- **Mac** : Safari → menu Fichier → **Ajouter au Dock**.
- Se connecter avec l'e-mail et le mot de passe de Philippe ; accepter l'enregistrement du mot de passe (Face ID / Touch ID le remplira ensuite).
- **Réglages → Importer un catalogue** : choisir le fichier `catalogue_prestations.json` (fourni à part, il ne doit pas être mis sur GitHub car le dépôt est public).
- Facultatif : **Réglages → Activer Face ID / Touch ID** sur chaque appareil.

## Bon à savoir
- Le plan gratuit de Supabase met la base en pause après 7 jours sans activité. La tâche `.github/workflows/keepalive.yml` l'appelle chaque jour pour l'éviter.
- Le plan gratuit ne fait pas de sauvegarde automatique : **Réglages → Télécharger une sauvegarde** de temps en temps.
- Sans réseau, tout fonctionne (dictée, mise en forme, PDF) ; les devis partent dans la base dès le retour du réseau.
- Le prix des fournitures n'est jamais proposé automatiquement : il vient toujours du devis fournisseur.
