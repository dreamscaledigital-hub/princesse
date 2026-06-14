Plan déjà détaillé au tour précédent. Récap d'implémentation :

1. **`src/lib/game-content.ts`** — ajouter `"tap"` au type `ModeId` et une entrée dans `MODES` (emoji ⚡, titre "Tap Éclair", sous-titre "Réflexes, best of 5, gage à la clé", gradient jaune/rose). Corriger aussi le doublon `wishlist` au passage.

2. **`src/components/TapEclair.tsx`** (nouveau) — composant complet avec :
   - Liste `TAP_DARES` modifiable en haut du fichier.
   - État stocké dans `rooms.minigame_state` : `phase`, `round`, `round_id`, `scores`, `authority_slot=1`, `dare`, `countdown_start`, `waiting_delay_ms`, `waiting_start`, `lightning_at`, `tap_1`, `tap_2`, `round_winner_slot`, `game_winner_slot`, `dare_done`.
   - Écriture des taps via deux clés top-level distinctes (`tap_1`/`tap_2`) + RPC `minigame_patch` pour merge atomique sans race.
   - Refs `appearTimeRef`, `hasTappedRef` ; reset à chaque `round_id`.
   - `performance.now()` uniquement pour mesurer la réaction localement. Jamais `Date.now()` pour comparer joueurs.
   - Autorité (slot 1) : pilote countdown→waiting→lightning→result→next via `setTimeout` nettoyés ; calcule le gagnant selon faux départ / double faux départ / plus petite réaction / timeout 4s / égalité parfaite.
   - UI cherry blossom + Instrument Serif, plein écran tap, ⚡ géant lumineux, feedback "Faux départ ! 😅" / "Gagné ⚡" / "Trop lent 😴", confettis à la victoire finale.
   - Écrans final : rappel du gage au perdant, boutons "C'est fait ✅" (→ `onDareDone`), "Rejouer 🔁" (reset complet), "← Retour au menu".

3. **`src/routes/room.$code.tsx`** — import `TapEclair`, ajouter `"tap"` à la liste des modes qui passent en `phase: "minigames"` dans `pickMode`, ajouter le dispatch `if (room.mode === "tap") return <TapEclair ... />` dans `MinigamesMode`.

Validation : ouvrir 2 onglets, tester countdown / faux départ / double faux départ / timeout / 3 victoires / rejouer / retour menu.