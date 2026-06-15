## Chat couple — Messagerie privée

Une nouvelle section "Chat" accessible depuis la bottom nav, dédiée à la conversation privée entre toi et Eloïse, en temps réel, dans le ton romantique éditorial de l'app.

### Ce qu'on construit

**Nouvelle page `/messages`** (sous `_authenticated`)
- Liste des messages style bulles (cherry blossom), bulles "moi" alignées à droite (fond `primary`), bulles "elle" alignées à gauche (fond crème/muted) — avec l'avatar du partenaire.
- Auto-scroll en bas à chaque nouveau message, scroll fluide.
- Date/heure groupée par jour ("Aujourd'hui", "Hier", "12 juin").
- Tap long sur un message → réaction emoji rapide (❤️ 😍 😘 🥰 😂 🔥).
- Indicateur "Eloïse écrit…" avec petits points animés quand le partenaire tape.
- Affichage des accusés de lecture discrets (✓ vu).

**Composer (en bas, sticky)**
- Textarea auto-resize multi-lignes, placeholder romantique.
- Bouton emoji (picker léger à 8 catégories) — pas de lib lourde, juste une grille d'emojis curated.
- Bouton 📷 photo → upload vers Supabase Storage, preview avant envoi.
- Bouton envoyer (cœur qui pulse).
- Détection de saisie → broadcast "typing" via Realtime (sans toucher la DB).

**Aperçu sur le hub**
- Petite carte "Messages" sur `/hub` montrant le dernier message + badge de non-lus.

### Backend (Lovable Cloud)

Nouvelle table `messages` :
- `couple_id` (lien au couple)
- `sender_id` (auth user)
- `body` (texte, nullable si c'est juste une image)
- `image_url` (nullable)
- `reactions` (jsonb : `{ "❤️": ["user_id"] }`)
- `read_by` (jsonb array de user_id)
- `created_at`, `updated_at`

RLS : seuls les 2 membres du couple peuvent lire/écrire dans leur conversation (réutilise `couple_for_user`).
Realtime activé sur `messages` pour la synchro instantanée.

Nouveau bucket Storage privé `chat-photos` :
- Chemin `{couple_id}/{message_id}.jpg`
- Policies RLS : seuls les membres du couple peuvent uploader/lire leurs photos.

**Indicateur "en train d'écrire"** : via Supabase Realtime Broadcast (pas de DB), debounced 2s.

### Design

- Header sticky avec avatar d'Eloïse + son pseudo + "en ligne" / "vu à…"
- Bulles arrondies (`rounded-3xl`), ombres douces, animations d'entrée (fade + slide).
- Fond très léger avec quelques pétales SVG flottants pour rester dans l'univers.
- Mobile-first, gros tap targets, composer toujours au-dessus du clavier mobile.
- Tokens sémantiques uniquement (cherry blossom).

### Fichiers touchés

- migration Supabase : table `messages`, RLS, publication realtime, bucket `chat-photos` + policies
- `src/routes/_authenticated/messages.tsx` (nouvelle route)
- `src/components/ChatBubble.tsx`, `ChatComposer.tsx`, `EmojiPicker.tsx`, `TypingIndicator.tsx`
- `src/lib/use-messages.ts` (hook realtime)
- `src/components/BottomNav.tsx` (ajout onglet 💌 Messages)
- `src/routes/_authenticated/hub.tsx` (carte aperçu)

### Hors scope (pour plus tard si tu veux)

- Vocaux, vidéos, GIF
- Réponses à un message spécifique (quote)
- Recherche dans l'historique
- Notifications push (déjà infra présente, on pourrait brancher dessus en suivant)
