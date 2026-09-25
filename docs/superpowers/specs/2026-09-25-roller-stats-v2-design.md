# Roller Stats — Version 2 : cahier des charges

Date : 2026-09-25
Statut : à valider par l'utilisateur (aucun code écrit)
Base : la version 1, en ligne sur https://trophy8726.github.io/roller-stats/ (voir `2026-09-24-roller-stats-design.md`).

## 1. Objectif

Trois besoins, tirés de l'usage réel de la v1 :

1. **Suivre nos gardiens** : chaque tir contre est rattaché à un gardien de l'effectif, et ses stats **s'additionnent d'un match à l'autre** sur la saison.
2. **Ne pas fausser ces stats** avec les situations où il n'y a pas de tir sur un gardien : cage vide et buts contre son camp (CSC).
3. **Distinguer les compétitions** et **enregistrer les événements rares** (onglet « Divers »), puis **exporter le rapport de match en PDF**.

## 2. Vocabulaire

- **« Notre équipe » / « Nous »** et **« Adversaire » / « Eux »**. On n'emploie jamais « domicile » pour parler de nous.
- **Lieu** du match : Domicile, Extérieur ou Terrain neutre. C'est seulement l'endroit où on joue.
- Sur **terrain neutre**, une question demande : « Sur la feuille de match, nous sommes : Domicile / Visiteur ». Cette réponse ne sert qu'à importer plus tard la feuille de match, sans confusion.

## 3. Le match (création)

| Champ | Valeurs |
|---|---|
| Compétition | Championnat (par défaut), Coupe de France, Playoffs |
| Lieu | Domicile (par défaut), Extérieur, Terrain neutre |
| Feuille de match | (si terrain neutre) Domicile ou Visiteur |
| Prolongations et tirs au but possibles | case cochée par défaut pour Championnat et Coupe, décochée pour Playoffs (à cocher pour la petite et la grande finale) |
| Gardien de départ | un gardien de l'effectif, « Notre filet désert », ou « Plus tard » |

Les autres champs (équipe, adversaire, date) ne changent pas.

## 4. L'effectif des gardiens

- Nouvel onglet **« Gardiens »** sur la page d'accueil : la liste, un formulaire d'ajout (nom), la correction d'un nom.
- **Aucune suppression** : un gardien ajouté reste dans la base, et ses stats gardent son nom.
- Un nom déjà présent (sans tenir compte des majuscules ni des espaces) est refusé, pour ne pas couper les stats d'un gardien en deux.
- Un gardien est identifié en interne par un identifiant, pas par son nom : corriger un nom ne casse aucune stat.
- Les gardiens adverses ne sont pas suivis un par un. On calcule les stats du « gardien adverse » en bloc, comme aujourd'hui.

## 5. Les états du match (partagés entre les tablettes)

Trois réglages qui **durent** et qui dépendent de la situation du jeu :

| État | Valeurs |
|---|---|
| Notre gardien en place | un gardien de l'effectif, ou « Notre filet désert » |
| Filet adverse | gardien présent, ou « Filet adverse désert » |
| Situation numérique | Égalité, Supériorité, Infériorité (de notre point de vue) |

- Chaque changement est un **événement daté**. L'état courant est le dernier changement non annulé. Un changement peut donc être annulé comme n'importe quelle saisie.
- Un **bandeau permanent**, en haut de l'écran de saisie, montre l'état courant à toutes les tablettes (par exemple « Gardien : Dupont · Supériorité »). Un changement fait sur une tablette apparaît sur les autres en environ une seconde.
- **Chaque tir, chaque engagement et chaque événement rare enregistre l'état au moment de la saisie** : gardien en place, filet vide ou non, situation numérique. Les stats ne dépendent donc jamais de l'horloge des tablettes.
- **Limite connue :** une tablette hors ligne peut ignorer un changement récent fait ailleurs. C'est rare. Le rapport indiquera « gardien non renseigné » quand aucun gardien n'a été choisi.

## 6. L'onglet « Divers »

Il apparaît à côté de Tir pour / Tir contre / Engagement, pour **tous les rôles**. Il contient :

- **Les trois états du § 5**, avec les changements de gardien.
- **But contre son camp (CSC)** : deux petits boutons discrets, « CSC adversaire (but pour nous) » et « CSC de notre équipe (but contre nous) ». Un seul tap de confirmation, sans position, la période est prise automatiquement.
- **Tir de pénalty** (un tir isolé pendant le jeu) : pour ou contre, puis résultat But / Arrêt / Raté, sans position. Il compte comme un tir normal (tentative, cadré, but) et il est attribué au gardien, mais il n'apparaît pas sur les cartes des tirs faute de position.
- **Tirs au but** (seulement si les prolongations sont possibles) : Nous et Eux, chacun avec But / Arrêté / Raté. Le compteur s'affiche (par exemple « Nous 2/3 · Eux 1/3 »).
- **Note libre** : un texte court (200 caractères maximum), daté et rattaché à la période, affiché dans le rapport.

### Prolongation
Si les prolongations sont possibles, le bouton de période propose **P1, P2, Prol.** À l'entrée en prolongation, la tablette demande « De quel côté défendons-nous ? » (gauche ou droite), sans supposer de règle sur le changement de côté.

## 7. Règles de calcul

- **Stats d'équipe** (tentatives, non bloqués, cadrés, buts, réussite au tir) : tous les tirs, y compris cage vide, tirs de pénalty et prolongation. **Exclus** : les CSC et les tirs au but.
- **Stats d'un gardien (le nôtre)** : les tirs contre avec ce gardien, **sauf cage vide**. On compte tirs cadrés reçus, arrêts, buts encaissés et % d'arrêts (arrêts ÷ tirs cadrés). Les tirs de pénalty sont inclus. Les CSC contre nous, avec ce gardien en place, sont affichés **à part** dans une colonne « CSC » et ne changent pas le % d'arrêts. Les tirs au but ne sont pas inclus dans ce % (ils sont montrés dans leur encart).
- **Gardien adverse** (en bloc) : tirs pour, sauf ceux qui visent un filet adverse désert.
- **Score** : tous les buts (cage vide, tirs de pénalty, prolongation) + les CSC. Les tirs au but ne changent pas le score : leur résultat s'affiche à côté (par exemple « 4 – 4 (TAB 3 – 2) »).
- **Situations** (Égalité / Supériorité / Infériorité) : tentatives, cadrés et buts, pour et contre, pour chacune.

## 8. Le rapport de match (ajouts)

- En-tête : compétition et lieu.
- Score avec les CSC, et le résultat des tirs au but s'il y en a.
- Nouveau tableau **Gardiens** : un par gardien du match, avec cadrés reçus, arrêts, buts encaissés, % d'arrêts et CSC. Les tirs sans gardien apparaissent sur une ligne « Non renseigné ».
- Nouveau tableau **Situations** (Égalité / Supériorité / Infériorité).
- Encarts : tirs au but, CSC, tirs de pénalty, notes.
- Bouton **« Exporter en PDF »** : ouvre la fenêtre d'impression du navigateur avec une mise en page A4 propre (pas de boutons ni de menus, tableaux et cartes non coupés, couleurs conservées). On choisit « Enregistrer au format PDF ».

## 9. La vue saison (ajouts)

- **Filtre de compétition** : Championnat par défaut, puis Tous, Coupe de France, Playoffs. Les totaux, les moyennes, le tableau des matchs et la carte des tirs suivent le filtre.
- **Tableau des gardiens de la saison**, sur les matchs retenus : matchs joués, cadrés reçus, arrêts, buts encaissés, % d'arrêts et CSC.
- Les cases à cocher par match et l'exclusion des matchs vides restent comme dans la v1.

## 10. Base de données

Un script **`supabase/migration-v2.sql`**, que tu colles une fois dans le SQL Editor de Supabase, **sans rien supprimer** :

- **`games`** : colonnes `competition`, `venue` (rempli à partir de l'ancien `home`), `sheet_side`, `overtime_possible`. L'ancienne colonne `home` reste.
- **`goalies`** (nouvelle table) : identifiant, nom, date de création. Lecture et ajout pour tous, correction du nom seulement, pas de suppression.
- **`events`** : nouvelles colonnes `goalie_id`, `empty_net`, `strength`, `penalty_shot`, `note`. Période 3 autorisée. Nouveaux types d'événement : `own_goal_for`, `own_goal_against`, `shootout_for`, `shootout_against`, `note`, `state_our_goalie`, `state_their_net`, `state_strength`. La règle de validité des événements est réécrite pour couvrir chacun.
- **Compatibilité** : les données de la v1 sont conservées. Les anciens matchs passent en « Championnat », leurs événements en « Égalité », sans gardien (« non renseigné ») et sans cage vide. Un onglet resté ouvert sur l'ancienne version continue de fonctionner.

## 11. Tests

- **Automatiques :** calcul de l'état courant à partir des événements (annulation comprise), règles de calcul du § 7 (cage vide, CSC, tir de pénalty, tirs au but, score), gardiens du match et de la saison, filtre de compétition, côté demandé en prolongation, règles du formulaire de création.
- **Base de données :** le script `smoke` est étendu (nouveaux types, période 3, suppression des gardiens refusée, correction de nom acceptée).
- **En direct :** deux tablettes, avec un changement de gardien et un filet désert vus en temps réel sur l'autre, puis un rapport et un PDF réels.

## 12. Hors périmètre de la v2

Stats individuelles des joueurs, temps de jeu et buts encaissés par 60 minutes, import de la feuille de match, suppression ou masquage de gardiens, identification des gardiens adverses, supériorité à deux joueurs d'écart, PDF de la vue saison, temps morts.

## 13. Points à confirmer

1. **« Penaltys »** : j'ai compris « tirs de pénalty pendant le jeu » (§ 6), pas les pénalités de 2 minutes. Est-ce bien cela ?
2. **Ton match déjà saisi** : veux-tu pouvoir lui **attribuer un gardien après coup**, avec un bouton dans le rapport « Attribuer un gardien aux tirs non renseignés » ? Sinon ses tirs contre resteront « non renseigné ». Je le recommande si c'est un vrai match.
3. **Playoffs** : une simple case « Prolongations possibles » à cocher pour les petite et grande finales (comme au § 3), plutôt qu'une liste des phases. Ça te convient ?
4. **Situation numérique** : trois états seulement, sans distinguer un ou deux joueurs d'écart.
