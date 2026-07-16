# Tower Defense Simulator Mapper

## Présentation

Cette application est un éditeur de placement pour le jeu `Tower Defense Simulator` sur Roblox. Elle permet de choisir des troupes, de les placer sur une carte, de visualiser les portées et de sauvegarder/recharger la configuration en JSON.

## Architecture

Le projet est structuré en modules pour faciliter la maintenance :

- `src/app.js` : point d'entrée principal de l'application.
- `src/service/` : services de chargement de données (`dataService.js`) et de sauvegarde (`saveService.js`).
- `src/model/` : modèles métiers.
  - `troopModel.js` : gestion des données de troupes.
  - `mapModel.js` : gestion de la carte, du zoom et des conversions d'espace.
  - `placementModel.js` : gestion des troupes posées et de la sélection.
- `src/view/` : rendu et interface.
  - `canvasRenderer.js` : dessine la carte et les troupes sur le canvas.
  - `sidebarView.js` : gère le menu latéral et les interactions HTML.
- `src/controller/` : logique de contrôle.
  - `inputController.js` : gère les interactions souris et clavier.
  - `uiController.js` : relie la vue, les modèles et l'état applicatif.
- `data/` : fichiers de configuration JSON.

## Installation

Ce projet peut être ouvert directement dans un navigateur supportant les modules ES (`<script type="module">`). Aucun build n'est requis.

## Utilisation

1. Ouvrir `index.html` dans un navigateur.
2. Sélectionner une carte dans le menu.
3. Rechercher et choisir une troupe.
4. Cliquer sur le canvas pour placer la troupe.
5. Utiliser la molette pour zoomer et les touches `Z/Q/S/D` ou flèches pour déplacer la carte.
6. Utiliser les boutons pour supprimer, vider, sauvegarder ou charger.

## Fonctionnalités

- Sélection de troupes via recherche.
- Placement par clic gauche.
- Affichage des portées et des zones de collision.
- Suppression de troupe sélectionnée.
- Sauvegarde/chargement JSON.
- Zoom et déplacement de la carte.

## Fichiers importants

- `index.html` : structure HTML et inclusion du module principal.
- `style.css` : styles de l'application.
- `data/maps.json` : configuration des cartes.
- `data/troops.json` : données des troupes.

## Notes de maintenance

- Le code est modulé pour faciliter l'ajout de nouvelles cartes ou de nouvelles troupes.
- Les modèles sont séparés de la vue pour limiter les effets de bord.
- Les services isolent les opérations de lecture/écriture JSON.

## Améliorations possibles

- Ajouter un import/export localStorage.
- Ajouter un mode de suppression par glisser.
- Ajouter un rail de grille pour le placement.
- Ajouter une interface mobile.
