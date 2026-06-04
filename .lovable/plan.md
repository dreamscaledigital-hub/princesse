# Plan : jeu de couple complet (jauge, gages 3 niveaux, mini-jeux, grand défi)

On garde TOUT l'existant (lobby, phase secrète, QCM "deviner l'autre", design, synchro Supabase). On ajoute la structure ci-dessous.

## 1. Schéma BDD (migration)

**`rooms`** — colonnes ajoutées :
- `complicity` (int, 0-100) — jauge partagée
- `stage` (text) : `round1` | `round2` | `finale` | `done` (sous-phase de phase2)
- `minigame_id` (text nullable) : `tap` | `green` | `culture` | `rps`
- `minigame_state` (jsonb) — état temps réel du mini-jeu en cours (compteurs, timestamps, choix)
- `minigame_round` (int) — pour best-of dans la finale
- `finale_scores` (jsonb) — `{"1": n, "2": n}` pour le grand défi

**`custom_dares`** — colonne ajoutée :
- `level` (text) : `simple` | `medium` | `ultra` (défaut `simple`)

Realtime déjà actif sur `rooms` (les updates de `minigame_state` se propageront).

## 2. Contenu (`src/lib/game-content.ts`)

Variables ajoutées en haut du fichier :
- `GAGES_SIMPLE[]`, `GAGES_MEDIUM[]`, `GAGES_ULTRA[]` (remplace l'actuel `GAGES`)
- `LEVEL_LABELS = { simple: "Simple 🟢", medium: "Moyen 🟡", ultra: "Ultra 🔴" }`
- `SURPRISE_FINALE` (texte libre modifiable, ex. "Bon pour une soirée surprise…")
- `CULTURE_QUESTIONS[]` (banque QCM culture générale, ~10 questions)
- `NB_MINIGAMES_ROUND2 = 2`, `NB_MINIGAMES_FINALE = 3`
- `COMPLICITY_GAINS = { correct: 8, dare_done: 5, minigame: 10 }`

## 3. Flux de partie

```
lobby → secrets → phase1 (réponses) → phase2 :
   stage=round1  : QCM existant (rater = gage SIMPLE)
   stage=round2  : 2 mini-jeux (perdre = gage MEDIUM)
   stage=finale  : 3 mini-jeux + 1 question bonus (perdre = gage ULTRA)
→ done (verdict + surprise si jauge ≥ 100)
```

La jauge `complicity` monte à chaque bonne réponse, gage validé, mini-jeu terminé. Affichée en permanence en haut avec les 2 avatars qui avancent.

## 4. Mini-jeux (composants dans `src/routes/room.$code.tsx`)

Protocole commun : `rooms.minigame_state` = `{ phase: "countdown"|"play"|"result", started_at, ...specific }`.

- **TapBattle** : 5s, chacun incrémente `taps_1`/`taps_2` via update local + sync 200ms. Vainqueur = plus de taps.
- **GreenLight** : délai aléatoire (2-6s) écrit par le slot 1, écran vert, premier `tap_at` gagne. Tap avant le vert = défaite.
- **CultureFlash** : question tirée, 4 choix, premier à cliquer juste gagne (`winner_slot`).
- **RPS** : best-of-3, chacun écrit `choice_1`/`choice_2` ; résolution quand les deux sont remplis.

Chaque mini-jeu : écran "Prêt ? 3-2-1" → jeu → écran "[prénom] gagne ! 🎉" → gage si pertinent → tour suivant.

## 5. Gages 3 niveaux

- `DareScreen` reçoit un `level`. Pool = `GAGES_{LEVEL}` + `customDares.filter(d => d.level === level && d.author_slot === partner)`.
- L'auteur tire 3 propositions au hasard, badge niveau visible.
- Phase secrète : chaque gage perso a un sélecteur de niveau (simple/medium/ultra).
- Validation du gage ("C'est fait ✅") → +5 à la jauge.

## 6. UI jauge & avatars

Composant `<ComplicityBar />` collé en haut, sticky :
- barre dégradée rose→vert sauge, % affiché
- chemin SVG avec 2 avatars (blonde Eloise, brun Toi) qui glissent selon `complicity`
- petite animation pulse + cœur volant quand la jauge monte (framer-motion)
- à 100 % : confettis + déblocage du bouton "Découvrir la surprise 💌" à l'écran final

## 7. Écran final

- Scores Toi / Eloise
- Verdict mignon (gagnant ou ex-aequo)
- Jauge finale ; si ≥ 100 : carte dépliable révélant `SURPRISE_FINALE`
- Boutons "Rejouer 🔁" (reset complet) et "Nouvelle partie"

## 8. Étapes d'implémentation

1. Migration BDD (nouvelles colonnes + level sur custom_dares)
2. Mise à jour `types.ts`, `use-room-state.ts`, `game-content.ts`
3. Composant `ComplicityBar` + intégration en haut de toutes les phases
4. Refonte de `DareScreen` pour 3 niveaux + ajout du sélecteur de niveau dans la phase secrète
5. Logique de progression `round1 → round2 → finale → done` + transitions
6. Implémentation des 4 mini-jeux (composants + synchro `minigame_state`)
7. Grand défi : enchaînement best-of + question bonus
8. Écran final avec surprise déblocable
9. Test mobile

## Notes techniques

- Toute la logique reste dans `src/routes/room.$code.tsx` + `game-content.ts` + `use-room-state.ts` pour cohérence avec l'existant. Mini-jeux extraits en sous-composants dans le même fichier ou un nouveau `src/components/minigames.tsx` selon la taille.
- Pas de serverFn : écritures directes Supabase (jeu sans auth, RLS publique déjà en place).
- Les updates fréquentes (TapBattle) sont throttlées (~200ms) pour ne pas saturer Realtime.
- Valeurs par défaut : si pas de gages perso, on tire dans les pools classiques ; si pas de questions perso, le plan de tours utilise uniquement les classiques.
