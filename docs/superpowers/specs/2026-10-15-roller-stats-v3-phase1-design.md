# Roller Stats — Version 3, phase 1 : comptes, clubs et équipes

Date : 2026-10-15
Statut : à valider par l'utilisateur (aucun code écrit)
Base : la version 2, en ligne sur https://trophy8726.github.io/roller-stats/ (voir `2026-09-25-roller-stats-v2-design.md`).

## 1. Objectif

La v3 rend l'application publique. La phase 1 en pose les fondations :

1. **Des comptes** : chaque personne se connecte avec Google.
2. **Des clubs** : chaque personne ne voit que les données des clubs dont elle est membre. Aujourd'hui, n'importe qui possédant la clé publique peut lire et écrire toute la base.
3. **Des équipes dans le club** (N1, N3A, U17…), pour ne pas mélanger leurs statistiques.
4. **Des compétitions personnalisées** (tournois, championnats du monde…) et des filtres de saison par équipe, compétition et saison sportive.
5. **Le respect du RGPD** : export et suppression des données.

La phase 1 est livrée en **deux mises en ligne** :

- **1a — Comptes et clubs** (sections 3 à 8) : tout ce qui doit partir ensemble, car la fermeture de la base arrête l'ancienne application sans compte.
- **1b — Organisation et filtres** (section 9) : compétitions personnalisées, suggestions d'adversaires, filtres de la saison, RGPD.

## 2. Vocabulaire

- **Compte** : une personne connectée avec Google.
- **Club** : l'association (Aix-en-Provence, Maisons-Laffitte…). C'est l'unité de partage des données.
- **Équipe** : une équipe du club (N2, U20…). Chaque match appartient à une équipe du club.
- **Responsable** et **membre** : les deux rôles dans un club (section 4).
- **Saison sportive** : du 1er septembre au 31 août (ex. « 2026-2027 »).

## 3. Modèle de données (1a)

### Nouvelles tables

| Table | Contenu | Règles |
|---|---|---|
| `profiles` | `id` (= compte), `display_name`, `created_at` | Créé automatiquement à la première connexion, avec le nom donné par Google. Modifiable par son propriétaire. |
| `clubs` | `id`, `name`, `sport` (défaut `roller`), `plan` (défaut `free`), `created_at` | `sport` et `plan` ne servent pas encore : ils évitent une migration pour le hockey sur glace et l'offre payante. |
| `club_members` | `club_id`, `user_id`, `role` (`owner` ou `member`), `joined_at` | Clé (`club_id`, `user_id`). Un club a toujours au moins un responsable : la base refuse de retirer ou de rétrograder le dernier. Plusieurs responsables sont possibles. |
| `club_invites` | `club_id`, `token`, `created_at` | Un lien actif par club. Jeton aléatoire d'au moins 128 bits, encodé pour une URL. Lisible seulement par les responsables. |
| `teams` | `id`, `club_id`, `name`, `archived_at`, `created_at` | Nom unique dans le club (sans tenir compte des majuscules ni des espaces). Une équipe archivée disparaît des listes mais garde son historique. |

### Tables existantes modifiées

- **`games`** : ajout de `club_id`, `team_id` (équipe du même club) et `created_by`.
  - `team_name` reste. Il est rempli avec le nom de l'équipe à la création du match et n'est plus modifié ensuite. Le rapport et le CSV continuent de l'utiliser.
  - Le code à 4 caractères reste l'identifiant du match. La phase 2 introduira des liens de partage plus longs.
- **`goalies`** : ajout de `club_id`. L'unicité du nom devient « par club ».
- **`events`** : ajout de `created_by`, rempli par la base avec le compte connecté (le client ne l'envoie pas). Le club d'un événement se déduit de son match.

Les règles existantes des événements ne changent pas : forme des événements, immutabilité sauf `deleted_at` et `goalie_id`, pas de suppression définitive, temps réel.

## 4. Droits d'accès (1a)

Le rôle `anon` (non connecté) perd tous ses droits. Toutes les règles sont appliquées par la base (RLS), à l'aide de deux fonctions : « est membre du club » et « est responsable du club ».

| Action | Membre | Responsable |
|---|---|---|
| Voir les matchs, événements, gardiens, équipes et membres du club | oui | oui |
| Créer un match pour une équipe du club | oui | oui |
| Saisir, supprimer (suppression douce) et attribuer un gardien, y compris sur les saisies des autres membres | oui | oui |
| Ajouter et renommer des gardiens et des équipes | oui | oui |
| Quitter le club | oui | oui, sauf s'il est le dernier responsable |
| Voir et régénérer le lien d'invitation | non | oui |
| Changer le rôle d'un membre, retirer un membre | non | oui |
| Archiver ou réactiver une équipe, renommer le club | non | oui |

Toujours interdit à tous : supprimer définitivement un match ou un événement, et modifier un événement autrement que par `deleted_at` et `goalie_id`.

Les opérations à plusieurs étapes passent par des fonctions de la base, qui font tout ou rien :

- **`create_club(nom_du_club, nom_de_la_première_équipe)`** : crée le club, le créateur comme responsable, l'équipe et le lien d'invitation.
- **`join_club(jeton)`** : ajoute la personne connectée comme membre. Elle ne fait rien si la personne est déjà membre. Un jeton inconnu ou régénéré renvoie une erreur explicite.
- **`regenerate_invite(club)`** : réservée aux responsables. L'ancien lien cesse de fonctionner immédiatement.

Le temps réel applique les mêmes règles : une tablette ne reçoit que les événements des matchs de ses clubs.

## 5. Écrans et parcours (1a)

### Connexion

- Sans session, l'application affiche un écran avec son nom, une phrase d'explication et le bouton **« Continuer avec Google »**.
- La connexion utilise le flux PKCE de Supabase (retour par `?code=`), pour ne pas entrer en conflit avec la navigation par `#` de l'application.

### Premier passage sans club

Deux choix :

- **« Créer mon club »** : nom du club et nom de la première équipe.
- **« J'ai été invité »** : un texte explique de demander le lien au responsable du club.

### Rejoindre un club

- Le lien d'invitation a la forme `#/rejoindre/<jeton>`.
- Sans session, la personne passe par Google. Le jeton est gardé sur l'appareil pendant l'aller-retour, puis elle revient automatiquement sur l'invitation.
- L'écran affiche « Rejoindre le club *nom* ? » et un bouton de confirmation.

### Plusieurs clubs

- Un sélecteur de club apparaît en haut de l'écran, seulement si la personne a plus d'un club.
- Le club choisi est mémorisé sur l'appareil.
- L'accueil, la saison, les gardiens et l'onglet Club portent sur ce club.

### Création d'un match

- **« Notre équipe »** devient une liste déroulante des équipes actives du club, avec une option **« + Nouvelle équipe… »** qui crée l'équipe sur place et la sélectionne.
- L'appareil retient la dernière équipe choisie.
- L'adversaire reste un texte libre (suggestions en 1b).

### Onglet « Club »

Il s'ajoute à côté des onglets « Matchs » et « Gardiens ».

- **Pour tous** : la liste des membres et de leurs rôles, la liste des équipes, le bouton « Quitter le club ».
- **Pour les responsables** :
  - le lien d'invitation, avec « Copier » et « Régénérer » ;
  - le changement de rôle et le retrait d'un membre ;
  - le renommage du club ;
  - l'archivage et la réactivation des équipes.

### Menu du compte

Il affiche le nom de la personne et propose la déconnexion.

### Match d'un autre club

Ouvrir le code d'un match qui n'appartient à aucun de ses clubs affiche « Ce match n'appartient pas à vos clubs ». Le partage entre clubs arrive en phase 2.

## 6. Hors ligne et synchronisation (1a)

- La session Supabase est conservée sur l'appareil. Après une première connexion avec du réseau, l'application s'ouvre et saisit hors ligne comme aujourd'hui.
- Si la session expire sans réseau, les saisies restent dans la file d'attente et partent au retour du réseau, après le renouvellement de la session.
- **Aucune saisie n'est jamais supprimée de la file d'attente sans avoir été acceptée par la base.**
- Si la base refuse l'envoi pour une question de droits (code `42501`, ou une règle RLS), les saisies restent dans la file. La pastille de synchronisation distingue ce cas : « Envoi refusé : accès au club retiré ».
- **Déconnexion avec des saisies non envoyées** : l'application avertit et propose d'attendre l'envoi.

## 7. Migration et mise en ligne de la 1a

### Préproduction (phase 0, prérequis)

- Un second projet Supabase gratuit, avec les mêmes scripts SQL.
- `src/config.ts` lit l'URL et la clé publique depuis des variables Vite (`.env.development` pour la préproduction, `.env.production` pour la production). `npm run dev` vise la préproduction.
- Le script de vérification des règles (`npm run smoke`) ne s'exécute **que** sur la préproduction.

### Bascule en production

À faire un jour sans match. L'application est indisponible quelques minutes entre les étapes 2 et 4.

1. **Activer Google** dans Supabase (identifiant OAuth à créer dans Google Cloud).
2. **Lancer le script `supabase/migration-v3a.sql`** dans l'éditeur SQL. Il :
   - crée les nouvelles tables et colonnes ;
   - crée le club **Aix-en-Provence** (équipe **N2**), qui reçoit les matchs `9MKH` et `B9NG` et le gardien François Mallet ;
   - crée le club **Maisons-Laffitte** (équipe **U20**), qui reçoit le match `QSFA` ;
   - range les gardiens Thibault Cosialls et Thomas Benard (voir section 12) ;
   - remplit `club_id` et `team_id` partout, puis rend ces colonnes obligatoires ;
   - remplace les règles d'accès anonymes par celles de la section 4.

   À partir de là, l'ancienne application sans compte ne fonctionne plus.
3. **Déployer** la nouvelle application (push sur `main`).
4. **Se connecter une première fois avec Google**, puis lancer `supabase/claim-v3a.sql`. Ce script nomme le compte indiqué (par son adresse email) responsable des deux clubs, puis supprime sa propre fonction.

### Passation de Maisons-Laffitte

L'utilisateur est responsable temporaire de Maisons-Laffitte. Il envoie le lien d'invitation au futur responsable, le passe responsable, puis quitte le club, en utilisant les écrans normaux. Aucun code spécifique.

### Appareils encore sur la v2

Une saisie en attente sur un appareil resté en v2 est refusée sans session et reste dans sa file. Après la mise à jour de l'application et la connexion, elle part normalement.

## 8. Tests (1a)

- **Vitest** :
  - écran de connexion ;
  - création de club ;
  - rejoindre par invitation, y compris l'aller-retour Google ;
  - sélecteur de club ;
  - liste des équipes et « + Nouvelle équipe… » ;
  - onglet Club selon le rôle ;
  - pastille « Envoi refusé ».

  Les tests existants sont adaptés au contexte de club.
- **Règles de la base** (`npm run smoke`, préproduction uniquement), avec deux comptes de test :
  - un compte non connecté est refusé partout ;
  - un compte d'un autre club ne voit ni ne modifie rien ;
  - un membre ne peut ni lire le jeton d'invitation ni le régénérer ;
  - le dernier responsable ne peut pas être retiré ;
  - un jeton régénéré ne permet plus de rejoindre le club ;
  - les règles d'immutabilité de la v2 tiennent toujours.
- **Recette manuelle** en préproduction, sur deux tablettes : un match saisi à deux, une coupure réseau pendant la saisie, une invitation de bout en bout.

## 9. Mise en ligne 1b — organisation et filtres

### Compétitions personnalisées

- Nouvelle table `competitions` : `id`, `club_id`, `name`, `archived_at`. Nom unique dans le club.
- Dans `games`, `competition` accepte `championnat`, `coupe`, `playoffs` ou `custom`. Une nouvelle colonne `competition_id` est renseignée si et seulement si `competition = 'custom'`, et pointe vers une compétition du même club. Les trois compétitions classiques restent des valeurs fixes, traduisibles en phase 3.
- À la création d'un match, le sélecteur devient une **liste déroulante** :
  - Championnat, Coupe de France, Playoffs ;
  - puis les compétitions actives du club ;
  - puis **« + Autre… »**, qui crée la compétition sur place et la sélectionne.

  La liste déroulante remplace les boutons segmentés qui débordaient (audit Impeccable).
- « Prolongations et tirs au but possibles » est coché par défaut pour une compétition personnalisée, et reste décochable.
- Les membres créent des compétitions. Les responsables les renomment, les archivent et les réactivent depuis l'onglet Club.

### Adversaires

Le champ reste libre et propose, pendant la frappe, les adversaires déjà rencontrés par le club (liste HTML `datalist`).

### Filtres de la saison

| Filtre | Valeurs | Par défaut |
|---|---|---|
| Équipe | équipes du club, « Toutes » | la dernière équipe utilisée sur l'appareil |
| Compétition | les trois classiques, celles du club, « Toutes » | Championnat |
| Saison sportive | saisons qui ont au moins un match | la saison en cours |

- La saison sportive est calculée à partir de la date du match : du 1er septembre au 31 août.
- Les totaux, le tableau des gardiens, le tableau par match, la carte des tirs et le CSV suivent les filtres.
- Les cases pour exclure un match restent.

### RGPD

- **« Mes données »** : chaque personne télécharge un fichier JSON avec son profil, ses clubs et rôles, et les événements qu'elle a saisis.
- **Export du club** : un responsable télécharge toutes les données du club (matchs, événements, gardiens, équipes, compétitions, membres).
- **Suppression du compte**, par une fonction serveur Supabase (Edge Function), car elle demande un droit que l'application n'a pas :
  - le profil et le compte sont supprimés, ainsi que les appartenances aux clubs ;
  - les événements et matchs restent dans le club, avec `created_by` vidé ;
  - si la personne est le dernier responsable d'un club qui a d'autres membres, la suppression est refusée tant qu'elle n'a pas passé la main ;
  - si elle est seule dans un club, l'application propose de supprimer ce club et toutes ses données (seule suppression définitive autorisée).
- **Anonymiser un gardien** : un responsable remplace le nom par « Gardien supprimé » (numéroté si besoin), sans toucher aux statistiques.

### Tests de la 1b

- **Vitest** :
  - liste des compétitions et « + Autre… » ;
  - prolongations par défaut ;
  - suggestions d'adversaires ;
  - calcul de la saison sportive (31 août et 1er septembre) ;
  - combinaison des trois filtres ;
  - export JSON.
- **Smoke** :
  - un match ne peut pas pointer vers la compétition ou l'équipe d'un autre club ;
  - un membre ne peut pas archiver de compétition ;
  - un membre ne peut pas anonymiser de gardien.

## 10. Hors périmètre de la phase 1

- Liens de partage lecture et saisie, révocation, saisie sans compte (phase 2).
- Connexion par lien magique (phase 6, avec un service d'envoi d'emails).
- Version anglaise (phase 3).
- Démo sans compte et site vitrine (phases 4 et 5).
- Restreindre un membre à certaines équipes du club : tout membre voit tout le club.
- Offre payante et hockey sur glace : seuls les champs `plan` et `sport` sont prévus.

## 11. Décisions confirmées par l'utilisateur (2026-10-15)

- Règles d'accès dans la base (RLS), pas de serveur intermédiaire.
- Une spécification, deux mises en ligne (1a, puis 1b).
- Deux rôles : responsable et membre.
- Rejoindre un club par lien d'invitation, régénérable.
- Connexion Google seule en phase 1.
- Un compte peut appartenir à plusieurs clubs.
- Les gardiens appartiennent au club, pas à une équipe.
- Aix-en-Provence (N2) et Maisons-Laffitte (U20) sont deux clubs distincts. L'utilisateur est responsable temporaire de Maisons-Laffitte et passera la main.

## 12. Questions ouvertes

1. Dans quel club ranger **Thibault Cosialls** et **Thomas Benard**, qui n'apparaissent dans aucun match ?
2. Le nom du club : **« Maisons-Laffitte »** (orthographe de la ville) convient-il ?
