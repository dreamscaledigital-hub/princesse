# Plan — Notifications push entre Eloise et toi

Gros chantier en 3 briques. Je veux valider l'approche avant de coder, parce que la brique 2 (comptes persistants) change la fondation actuelle (rooms anonymes par code).

## Brique 1 — PWA installable

- Ajouter `public/manifest.webmanifest` (nom "Princesse 💕", thème rose `#e88aab`, fond crème, `display: standalone`, icônes 192/512).
- Générer une icône (rose poudré + cœur) via imagegen, décliner en 192/512/apple-touch.
- Tags `<link rel="manifest">`, `theme-color`, `apple-touch-icon` dans `__root.tsx`.
- Service worker `public/sw.js` (écrit à la main car nécessaire pour push — pas `vite-plugin-pwa`). Enregistré via un wrapper qui refuse l'enregistrement en preview Lovable / iframe / dev (sinon ça casse l'éditeur).
- Le SW gère uniquement `push` + `notificationclick` (pas de cache offline — pas demandé).
- Petit composant `InstallPrompt` : bandeau bas "Installer l'appli 📲" si `beforeinstallprompt` dispo (Android/desktop) ; sur iOS, instructions "Partager → Ajouter à l'écran d'accueil".

## Brique 2 — Comptes persistants + appairage

**Migration depuis l'anonyme** : l'appli actuelle marche via `rooms.code` partagé (pas d'auth). On passe à Supabase Auth (email + mot de passe, plus Google), et on conserve les rooms comme "espace de couple" lié aux 2 users.

Nouveau schéma :
- `profiles (id=auth.uid, display_name, avatar_emoji, created_at)` — trigger auto-création sur signup.
- `couples (id, user_a, user_b, room_id, created_at)` — 1 ligne par couple appairé.
- `pairing_codes (code 6 chars, created_by, expires_at, consumed_by)` — usage unique, 15 min.
- `push_subscriptions (id, user_id, endpoint UNIQUE, p256dh, auth, user_agent, created_at)`.
- Ajout `rooms.owner_couple_id` (nullable au début pour pas casser les rooms existantes).

Auth & gates :
- Page `/auth` (signin/signup email+password + bouton Google via `lovable.auth.signInWithOAuth`).
- Layout `_authenticated/route.tsx` géré par l'intégration (déjà présent normalement, sinon créé `ssr:false`, redirect vers `/auth`).
- Écran `/pair` quand connecté mais pas encore en couple : "Génère un code" / "Saisir le code de ton amour".
- Une fois en couple → redirection vers la home qui ouvre/crée automatiquement la room du couple. Plus besoin de saisir un code de partie ; le lien d'invitation pour rejoindre une partie devient l'invitation au couple.

Code existant :
- `room.$code.tsx` reste, mais on l'alimente avec la room liée au `couples` row.
- `players` continue de fonctionner ; on peuple `name` depuis `profiles.display_name`, slot 1 = `user_a`, slot 2 = `user_b`.

## Brique 3 — Push notifications

- **Clés VAPID** : je te demanderai d'ajouter 2 secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT="mailto:..."`) via le tool secrets. Je te donnerai la commande pour les générer (`npx web-push generate-vapid-keys`). La clé publique sera aussi exposée côté client via `VITE_VAPID_PUBLIC_KEY` (publique, non secret).
- Composant `PushOptIn` : demande permission, `swReg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey})`, POST de l'abonnement vers une serverFn `savePushSubscription` qui l'écrit en DB scopé à `auth.uid()`.
- **Envoi** : Edge Function Supabase `send-push` (Deno, `npm:web-push`). Reçoit `{message}`, vérifie l'auth de l'appelant, retrouve son couple, retrouve l'abonnement du partenaire, signe et envoie. Gère 404/410 → suppression de l'abonnement périmé.
- Écran `/pensee` (accessible depuis le menu, bouton "💌 Envoyer une pensée à [prénom]") : 4 messages prêts + textarea libre (max 100 car) + bouton envoyer.
- Service worker `push` handler : `self.registration.showNotification(title, { body, icon, badge, data: { url } })`. `notificationclick` : `clients.openWindow(data.url || '/')`.
- iOS : message clair sur `/pair` et `PushOptIn` "Sur iPhone, installe d'abord l'appli (Partager → Ajouter à l'écran d'accueil) sinon les notifications ne marcheront pas".

## Détails techniques

- Edge Function pour push (vs serverFn) : `web-push` veut Node crypto + signing VAPID ; plus simple et fiable en Deno edge function que dans le Worker SSR. Auth de l'appelant via header `Authorization: Bearer <user JWT>`.
- RLS : `profiles` lisible par le user + son partenaire (via fonction `same_couple(uid)`), `couples` lisible par les 2 membres, `push_subscriptions` 100% privé (`user_id = auth.uid()`), `rooms`/`players`/etc. lisibles par les membres du couple owner.
- `attachSupabaseAuth` (déjà dans `start.ts`) → les serverFn héritent du JWT.
- Le code anonyme actuel (`getClientId` + `players.client_id`) reste pour la compatibilité technique mais c'est `auth.uid()` qui devient la vérité.

## Questions avant de coder

1. **Auth** : email+mot de passe + Google, ou email-only (magic link) ? Je pars sur **email+password + Google** par défaut, dis-moi si tu veux autre chose.
2. **Migration des rooms existantes** : tu joues actuellement avec Eloise sur une room. On peut soit (a) repartir from scratch (vous vous créez des comptes, vous appairez, nouvelle room), soit (b) je tente une migration. Je recommande fortement **(a) from scratch** — c'est propre, et les données de jeu ne sont pas critiques.
3. **VAPID keys** : OK pour que je te demande d'ajouter les 3 secrets quand on en sera là ?

Réponds à ces 3 questions (ou dis "vas-y" pour tout par défaut) et je commence.
