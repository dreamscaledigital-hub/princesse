Objectif : remplacer le système actuel de compte à rebours Tap éclair par une machine de jeu plus fiable, pour éviter définitivement le blocage sur 3.

Plan d’action :

1. Supprimer le compte à rebours piloté par mises à jour successives en base
- Ne plus écrire 3, puis 2, puis 1 dans `minigame_state`.
- Éviter les `useEffect` dépendants de l’état temps réel, car chaque mise à jour peut relancer/annuler le timer.

2. Passer à un compte à rebours local côté écran
- Au lancement d’une manche, la base stockera une seule information stable : `round_started_at`.
- Chaque téléphone affichera 3, 2, 1 localement à partir de cette heure.
- Même si le réseau temps réel est lent, le chrono ne restera plus figé.

3. Utiliser une vraie machine d’état simple
```text
idle -> countdown -> armed/wait -> go -> result -> next_round/game_over
```
- `idle` : initialise la manche si besoin.
- `countdown` : affichage local 3, 2, 1.
- `armed/wait` : attente aléatoire avant l’éclair.
- `go` : premier tap valide gagne.
- `result` : score + transition.
- `game_over` : fin du best of 5.

4. Réduire les écritures en base
- Une écriture pour démarrer la manche.
- Une écriture pour passer à `go`.
- Une écriture quand un joueur tape.
- Une écriture pour passer à la manche suivante ou terminer.

5. Ajouter des garde-fous anti-blocage
- Si le joueur hôte ne déclenche pas la transition, l’autre téléphone pourra prendre le relais après un délai de sécurité.
- Chaque action vérifiera le numéro de manche pour ignorer les anciens timers.
- Les taps seront verrouillés dès qu’un gagnant existe.

6. Adapter l’interface
- Pendant le countdown : afficher 3, 2, 1 localement.
- Pendant l’attente : bouton sombre “patience”.
- À l’éclair : bouton jaune “TAPE”.
- Résultat clair : faux départ, gagnant, score, prochaine manche.

Fichiers concernés :
- `src/routes/room.$code.tsx` uniquement pour refaire `TapMode` et le lancement du mode Tap éclair.

Validation prévue :
- Vérifier que l’état initial lance bien une manche.
- Vérifier que le compte à rebours avance sans dépendre des mises à jour temps réel.
- Vérifier faux départ, victoire, score, changement de manche et fin en 3 points.