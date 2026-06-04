# Plan : Jeu romantique "À quel point tu me connais ?"

Quiz mobile pour deux joueurs, synchronisé en temps réel via Lovable Cloud (Supabase Realtime), entièrement en français, avec ton tendre et joueur.

## Activation backend

Activer Lovable Cloud pour bénéficier de Postgres + Realtime (synchro entre les deux téléphones).

## Schéma base de données

**`rooms`**
- `id` (uuid, PK)
- `code` (text, unique, 6 caractères ex: `ABCD12`) — utilisé dans le lien `?room=ABCD12`
- `phase` (text) : `lobby` | `phase1` | `phase2` | `dare` | `done`
- `current_turn` (int) — index de la question en Phase 2
- `current_player` (int 1 ou 2) — qui doit deviner
- `current_dare` (text nullable) — gage en cours
- `score_1`, `score_2` (int)
- `created_at`

**`players`**
- `id` (uuid, PK)
- `room_id` (FK)
- `slot` (int 1 ou 2)
- `name` (text, défaut "Toi" / "Eloise")
- `client_id` (text) — identifiant local stocké en localStorage pour reconnexion
- `joined_at`

**`answers`** (réponses Phase 1)
- `id`, `room_id`, `player_slot`, `question_index`, `answer_text`

**`guesses`** (réponses Phase 2)
- `id`, `room_id`, `question_index`, `guesser_slot`, `chosen_text`, `is_correct`

RLS ouverte en lecture/écriture sur ces tables (jeu éphémère sans auth — accès par connaissance du code de room). Realtime activé sur les 4 tables.

## Flux applicatif

### 1. Accueil (`/`)
- Si `?room=XXX` dans l'URL → écran "Rejoindre"
- Sinon → bouton "Créer une partie" + champ "Rejoindre avec un code"
- Création : génère un code, insère `rooms` + `players` (slot 1), redirige vers `/?room=XXX`

### 2. Lobby
- Affiche les deux slots (avec prénom éditable)
- Lien d'invitation copiable + bouton "Partager" (Web Share API sur mobile)
- Subscribe au canal Realtime `room:{code}` → quand slot 2 rejoint, les deux écrans s'actualisent
- Bouton "Commencer 💕" actif uniquement quand 2 joueurs présents ; un clic met `phase = 'phase1'`

### 3. Phase 1 — Questionnaire sur soi
- 8 questions affichées une par une, champ texte court
- Insère dans `answers` au fur et à mesure
- Barre de progression + indicateur "Eloise a répondu à 5/8"
- Si on finit avant l'autre : écran d'attente animé ("On attend que Eloise finisse… 🥰")
- Quand les 16 réponses sont là → passage auto à `phase2`

### 4. Phase 2 — Devine l'autre
- 10 questions au total, alternance des tours (joueur 1, 2, 1, 2…)
- Le joueur actif voit la question + 4 propositions (vraie réponse de l'autre + 3 leurres tirés de la banque, mélangés)
- L'autre joueur voit "C'est au tour de [prénom]…" avec animation
- **Bonne réponse** : +1 point, animation confettis/cœurs, message tendre, passage au tour suivant
- **Mauvaise réponse** : `phase = 'dare'`, `current_dare = null`
  - Le partenaire reçoit 3 gages aléatoires et en choisit un → écrit dans `current_dare`
  - Le joueur fautif voit "Gage : …" + bouton "C'est fait ! ✅" → retour à `phase2`, tour suivant

### 5. Écran final
- Scores des deux joueurs
- Verdict mignon selon écart de score
- Phrase manuscrite "Peu importe le score, je t'aime Eloise ❤️"
- Boutons "Rejouer 🔁" (reset scores/réponses, retour phase1) et "Nouvelle partie" (retour accueil)

## Contenu (en haut de `src/lib/game-content.ts`, facilement modifiable)

- `QUESTIONS_PHASE1` : 8 questions ("Ton film préféré ?", "Ton plat préféré ?", etc.)
- `LEURRES` : tableau parallèle, 4-5 leurres drôles par question
- `GAGES` : 12+ gages tendres ("Câlin de 20 secondes", "Vocal mignon", "Imite l'autre"…)

## Design

- Tokens dans `src/styles.css` : dégradé crème → rose poudré → vert sauge
- Polices Google Fonts : **Quicksand** (UI), **Caveat** (titres manuscrits, phrases d'amour)
- Petits cœurs/étoiles SVG flottants en arrière-plan (animation CSS subtile)
- Animations via `framer-motion` : fondus, scale doux, micro-rebonds sur boutons
- `canvas-confetti` (ou équivalent léger) pour les bonnes réponses
- Mobile-first : gros boutons, marges généreuses, une seule étape par écran

## Routes TanStack

- `src/routes/index.tsx` : accueil / création / lien d'invitation
- `src/routes/room.$code.tsx` : écran de jeu unique qui rend lobby / phase1 / phase2 / dare / done selon `rooms.phase`

## Détails techniques

- Identité du joueur : `client_id` UUID stocké en `localStorage` → permet de retrouver son slot après rechargement
- Subscriptions Realtime sur `rooms`, `players`, `answers`, `guesses` filtrées par `room_id`
- Génération du code : 6 caractères alphanumériques (sans caractères ambigus)
- Web Share API pour le partage du lien, fallback "Copier le lien" avec toast
- Lecture/écriture directe depuis le client Supabase (pas de serverFn nécessaire — jeu ouvert sans auth)

## Livrables

1. Activation Lovable Cloud + migrations (4 tables, RLS, Realtime)
2. Fichier de contenu modifiable (questions/leurres/gages)
3. Hooks : `useRoom`, `usePlayers`, `useRealtimeRoom`
4. Écrans : Home, Lobby, Phase1, Phase2, DareScreen, Final
5. Tokens design + composants animés
