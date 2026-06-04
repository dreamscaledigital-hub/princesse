Je vais corriger le flux des mini-jeux à la source, sans toucher au reste de l’application.

Plan :
1. Modifier le passage `countdown -> play` dans `src/components/minigames.tsx` pour qu’il conserve les infos de synchronisation existantes (`picker_slot`, `countdown_start`) au lieu de remplacer entièrement `minigame_state`.
2. Rendre le pilotage du mini-jeu plus robuste : si l’état vient d’une ancienne partie sans `picker_slot`, le joueur 1 continue de piloter, sinon le joueur qui a choisi le mini-jeu déclenche bien le lancement.
3. Ajouter une sécurité de rattrapage : si le compte à rebours est déjà dépassé et que l’état reste bloqué sur `countdown`, le driver force immédiatement le passage en `play`.
4. Vérifier que les 4 mini-jeux (`memory/tap`, `green`, `culture`, `rps`) reçoivent bien un état `phase: "play"` complet après le compte à rebours.

Cause probable repérée : l’état initial du compte à rebours est bien écrit, mais le passage en jeu remplace ensuite tout `minigame_state` par l’état du jeu. Cette transition est fragile avec la synchro temps réel et les anciennes parties, ce qui peut laisser les deux écrans coincés sur la fin du compte à rebours au lieu d’afficher le composant du jeu.