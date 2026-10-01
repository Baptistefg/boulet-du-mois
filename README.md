# Boulet du mois

Site statique (HTML/CSS/JS) hébergé sur GitHub Pages. Toutes les données (actions, photos, votes,
photothèque) sont dans une base en ligne gratuite (Supabase) : tout le monde voit la même chose.
Sans base configurée, le site affiche un message et n'enregistre rien.

## Pages

- `index.html` : accueil, compte à rebours jusqu'au 25, aperçu du cycle
- `actions.html` : ajout des mauvaises actions (justification + gravité 1 à 3 points) et historique
- `classement.html` : classement du cycle, de l'année, et total des points
- `photos.html` : concours photo (photos cachées jusqu'au 25, vote le 25)
- `phototheque.html` : saison septembre 2026 à juin 2027, un cadre par mois, le Boulet et les photos avec la coupe
- `palmares.html` : élus de chaque cycle, classement annuel, export/import
- `admin.html` : connexion admin
- `config.js` : le seul fichier à modifier (base de données)
- `setup.sql` : script de création de la base (à lancer une fois dans Supabase)
- `app.js` / `style.css` : code et style partagés

## Règles

- Chaque mauvaise action a une gravité de 1 à 3 points. Le Boulet du mois est celui qui a le plus de points sur le cycle (aucun vote).
- Septembre 2026 : Titouan, inscrit directement dans `app.js` (constante `FIXED`).
- Un cycle va du 25 au 24. L'annonce du Boulet a lieu le 25.
- Photos : cachées pendant le cycle, dévoilées et votées le 25 (anonymes), gagnante annoncée à partir du 26. Maximum 3 photos par personne et par cycle, pas de vote pour sa propre photo.
- Seul l'admin peut supprimer une action ou une photo, importer des données et ajouter les photos avec la coupe.

## Mettre en place la base de données (une seule fois, environ 10 minutes)

1. Va sur https://supabase.com, clique sur Start your project et connecte-toi avec GitHub.
2. New project : nom `boulet-du-mois`, choisis un mot de passe de base (garde-le), région Europe (Paris ou Francfort). Attends que le projet soit prêt.
3. Menu SQL Editor, New query : colle tout le contenu de `setup.sql`, puis Run. Le message « Success » doit apparaître.
4. Menu Authentication, Users, Add user, Create new user : ton e-mail et un mot de passe admin, coche Auto Confirm User. C'est ce compte qui te connecte sur la page Admin.
5. Important : dans Authentication, réglages des connexions (Sign In / Providers), désactive « Allow new users to sign up ». Sinon n'importe qui pourrait se créer un compte et supprimer des actions.
6. Menu Project Settings, API Keys : copie l'URL du projet (Project URL, du type `https://xxxx.supabase.co`) et la clé publique (`anon` `public`, ou la clé `publishable`). Ne prends jamais la clé `service_role` / `secret`.
7. Ouvre `config.js` sur GitHub (crayon) et colle les deux valeurs :

```js
window.BDM_CONFIG = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseKey: "ta-clé-publique",
};
```

8. Commit changes. Après 1 minute, le site utilise la base. La page Admin affiche « Base de données en ligne ».

La clé publique est faite pour être visible : la sécurité est assurée par les règles de `setup.sql`
(tout le monde peut lire et ajouter, seul l'admin connecté peut supprimer et gérer la photothèque).

## Mise en ligne sur GitHub Pages

1. Envoie tous ces fichiers à la racine du repo.
2. Settings, Pages, branche `main`, dossier `/ (root)`.
