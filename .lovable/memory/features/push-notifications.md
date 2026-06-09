---
name: Push notifications & accounts
description: Comptes Supabase Auth + appairage en couple + notifications push (web-push + VAPID)
type: feature
---
Architecture des notifications push:
- Comptes persistants via Supabase Auth (email+password + Google via lovable.auth)
- Table `couples` lie deux utilisateurs (user_a, user_b)
- Appairage par code 6 chars (table `pairing_codes`, fonction RPC `consume_pairing_code`)
- Abonnements push stockés dans `push_subscriptions` (RLS strict self)
- Edge function `send-push` (Deno + npm:web-push) gère 2 actions JSON:
  - {action:"vapid_public_key"} → renvoie la clé publique
  - {action:"send", message} → auth via Bearer JWT, envoi au partenaire
- Service worker `public/sw.js` (push + notificationclick only, pas de cache offline)
- SW registration via `src/lib/sw-register.ts` (refus en preview Lovable/iframe/dev)
- Manifest PWA `public/manifest.webmanifest` + icônes 192/512/apple-touch
- Hub utilisateur sur route `/hub` (sous `_authenticated/`)
- Secrets requis: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:)
- iOS: push web ne marche QUE si l'app est installée à l'écran d'accueil (iOS 16.4+)
