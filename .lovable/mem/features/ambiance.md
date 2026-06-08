---
name: Ambiance mode (En vrai / À distance)
description: Mode partagé "irl"|"distance" sur rooms.ambiance, change la palette CSS et la banque de gages
type: feature
---
- Colonne `rooms.ambiance` (text, default 'irl', valeurs 'irl' | 'distance'), synchro temps réel.
- Sélecteur dans MenuScreen via `<AmbianceSelector />`.
- `<AmbianceTheme />` monté dans GamePage applique `data-ambiance` sur le body — CSS dans styles.css surcharge la palette pour "distance" (bleu nuit/violet/doré).
- Banques gages: `GAGES_IRL_BY_LEVEL` et `GAGES_DISTANCE_BY_LEVEL` dans `src/lib/game-content.ts`. Helper `getGagesPool(ambiance, level)`.
- Consommé par room.$code.tsx (dare selection) + ColorBounce, MostLikely, Riddles, StackTower.
