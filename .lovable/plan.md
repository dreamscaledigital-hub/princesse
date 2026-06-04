## Objectif

Transformer le jeu actuel (parcours linéaire imposé) en une vraie appli avec **menu hub** d'où on lance librement chaque mode. Garder tout l'existant (synchro Supabase, design, jauge, gages 3 niveaux, mini-jeux, questions/gages perso), réorganiser juste l'architecture.

## Nouvelle architecture de phases

On ajoute une nouvelle phase BDD : `menu`. Le flux devient :

```text
lobby → secrets (optionnel, premier passage) → menu ⇄ {quiz | minigames | full | edit_secrets}
                                                 ↑              │
                                                 └──────────────┘ (retour menu après résultat)
```

- `phase` (rooms) prend les valeurs : `lobby | secrets | menu | quiz | minigames | full | edit_secrets | dare | done`
- Nouveau champ `mode` (text nullable) pour préciser le sous-mode actif (ex. mini-jeu choisi)
- Quand un joueur clique une carte du menu → update `rooms.phase` → l'autre bascule en temps réel (déjà câblé via `useRoomState`)
- Bouton "← Menu" partout : remet `phase = 'menu'` côté BDD, les deux reviennent ensemble
- Jauge `complicity` reste persistante entre les modes (déjà en BDD)

## Modes

1. **💬 Tu me connais ?** — le QCM existant (round1 actuel) en boucle libre, gage SIMPLE à chaque erreur. Bouton "Terminer" → retour menu.
2. **🎮 Mini-jeux** — sous-menu listant les 4 mini-jeux (TapBattle/Memory, GreenLight, CultureFlash, RPS). On en choisit un, on joue, le perdant tire un gage MOYEN, puis retour au sous-menu. Bouton "← Menu principal".
3. **🏆 Partie complète** — l'enchaînement structuré existant (round1 → round2 → finale → done) inchangé, juste lancé depuis le menu.
4. **✏️ Nos pièges** — réutilise l'écran `secrets` existant en mode "édition libre" : chacun peut ajouter/modifier ses questions et gages perso à tout moment. Bouton "← Menu" pour sortir.

## Écran menu

- Header sticky : `<ComplicityBar />` + ligne "Toi & Eloise 💕 en ligne" (compte de `players`)
- 4 grosses cartes tappables (grid 1 col mobile, 2 col tablette) avec emoji géant, titre, sous-titre, gradient doux
- Tap sur carte → `supabase.from('rooms').update({ phase: <mode> })` → bascule synchronisée
- Footer mignon avec code de la partie + bouton "Quitter la partie"

## Découpage des fichiers (minimiser le diff)

- `src/lib/game-content.ts` : ajoute `MODES` (id, label, emoji, gradient, description) en haut
- `src/lib/use-room-state.ts` : étend le type `phase` aux nouvelles valeurs
- `src/routes/room.$code.tsx` : ajoute un `<MenuScreen />` + routage sur `phase === 'menu' | 'quiz' | 'minigames' | 'edit_secrets'`. Le code existant des phases `phase1/phase2` devient le mode `full`. Les mini-jeux et le QCM existants sont extraits/réutilisés tels quels.
- `src/components/MenuScreen.tsx` : nouveau composant
- `src/components/MinigamesMenu.tsx` : sous-menu pour choisir un mini-jeu à la carte
- Migration : ajouter `mode` (text nullable) à `rooms` + élargir contrainte sur `phase` si CHECK contraint

## Étapes d'implémentation

1. Migration BDD : ajouter colonne `mode` à `rooms` ; pas de CHECK sur `phase` à modifier (column libre text).
2. Mettre à jour `types.ts` et `use-room-state.ts` (élargir union `phase`).
3. Ajouter `MODES` et helpers dans `game-content.ts`.
4. Créer `MenuScreen.tsx` (4 cartes, sync, présence joueurs).
5. Créer `MinigamesMenu.tsx` (sous-menu de choix de mini-jeu, lance un mini-jeu unique, perdant tire gage moyen).
6. Dans `room.$code.tsx` :
   - Au lieu d'enchaîner `lobby → secrets → phase1`, après lobby on va sur `menu` (et au tout premier passage on propose le détour `secrets` si un joueur n'a pas encore créé de pièges, mais c'est skippable).
   - Routing par `phase` : `menu`, `quiz` (QCM en boucle), `minigames` (sous-menu + lancement), `full` (parcours existant complet), `edit_secrets` (écran secrets en mode libre).
   - Bouton "← Menu" sur chaque écran de mode → `update({ phase: 'menu' })`.
7. Tester la synchro : un joueur clique une carte, l'autre suit.

## Notes techniques

- Pas de breaking change BDD : on garde tout, on ajoute juste `mode` et on autorise plus de valeurs de `phase`.
- Mode "Tu me connais ?" seul = boucle infinie de tours QCM ; on incrémente `current_turn` à chaque réponse sans condition de fin (juste un bouton "Terminer → Menu").
- Mode "Partie complète" = lance le parcours `stage=round1` existant tel quel.
- Mode "Mini-jeux" : `minigame_id` est mis par le joueur qui choisit ; à la fin du mini-jeu (winner connu + éventuel gage validé), on remet `minigame_id = null` et on reste sur `phase = 'minigames'` (sous-menu).
- Confidentialité des pièges perso : préservée (chacun ne voit que les siens en édition).
