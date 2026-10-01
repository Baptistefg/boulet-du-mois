# Boulet du mois

Site statique (HTML/CSS/JS), sans serveur, prêt pour GitHub Pages.

## Pages

- `index.html` : accueil, compte à rebours jusqu'au 25, aperçu du cycle
- `actions.html` : ajout des mauvaises actions (avec justification) et historique
- `classement.html` : classement du cycle, de l'année, et total
- `photos.html` : upload des photos, galerie, vote
- `palmares.html` : élus de chaque cycle, classement annuel, export/import
- `septembre.html` : saisie manuelle du Boulet de septembre 2026 (déjà élu entre eux) pour l'historique, et annonce
- `app.js` / `style.css` : code et style partagés

## Règles

- Le Boulet du mois est celui qui a le plus de mauvaises actions sur le cycle (aucun vote). Seule exception : septembre 2026, saisi à la main.
- Le vote ne concerne que les photos.
- Un cycle va du 25 au 24. L'annonce a lieu le 25.
- Le vote photo est ouvert du 20 au 24. Maximum 3 photos par personne et par cycle.
- On ne peut pas voter pour sa propre photo.

## Mise en ligne

1. Crée un repo GitHub et envoie tous ces fichiers à la racine.
2. Settings, Pages, branche `main`, dossier `/ (root)`.
3. Le site est disponible sur `https://pseudo.github.io/nom-du-repo/`.

## Important

Les données (actions, photos, votes) sont enregistrées dans le navigateur de chacun.
Elles ne sont pas partagées entre appareils. Utiliser Palmarès, Exporter / Importer
pour se passer les données.
