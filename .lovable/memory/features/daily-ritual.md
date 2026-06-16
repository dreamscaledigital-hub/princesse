---
name: Rituel quotidien
description: Question du jour générée par IA, humeur, streak partagé, notif push 9h
type: feature
---

# Rituel du jour

Système d'engagement quotidien pour le couple.

## Tables

- `daily_rituals(couple_id, ritual_date, question, ambiance)` — unique (couple_id, ritual_date). Date en TZ Europe/Paris.
- `daily_entries(ritual_id, user_id, mood_emoji, mood_word, answer)` — unique (ritual_id, user_id). RLS : on lit toutes les entries du couple, on n'écrit/modifie que les siennes.
- Realtime activé sur les deux tables.

## Génération

Server fn `getOrCreateTodayRitual` (`src/lib/daily-ritual.functions.ts`) — auth required :
1. Lit le couple_id via `couple_for_user`.
2. Cherche le rituel du jour, sinon génère via Lovable AI (`google/gemini-3-flash-preview`) avec ton adapté à l'ambiance (irl/distance lue depuis la dernière `rooms.ambiance`).
3. Fallback : liste statique `FALLBACK_QUESTIONS` si l'IA échoue.
4. Upsert (onConflict couple_id,ritual_date) pour gérer la course entre les deux membres.

## Streak

`couple_streak(_couple_id uuid) returns int` (SECURITY DEFINER) — compte les jours consécutifs (terminant aujourd'hui ou hier) où les DEUX membres ont posté une entry. Démarre à hier si rien aujourd'hui pour ne pas casser la série pendant la journée.

## UI

`<DailyRitual myId partnerId partnerName />` rendu dans `/_authenticated/hub` au-dessus de PenseeUI quand un couple existe. Composant gère humeur (8 emojis curated), réponse 500 chars, révélation de la réponse partenaire seulement quand les 2 ont répondu, subscription Realtime sur entries du jour.

## Notification quotidienne

Cron `daily-ritual-push` à `0 7 * * *` UTC (~9h Paris) → POST `send-push` action `daily_broadcast`.
- Action ajoutée à l'edge function `send-push` : gate par apikey/Authorization == ANON ou SERVICE_ROLE.
- Itère `push_subscriptions`, envoie payload générique `{ title: "Votre rituel du jour vous attend 💕", url: "/hub" }`.
- Nettoie les abos 404/410.

Pour modifier l'horaire : `cron.unschedule('daily-ritual-push')` puis re-`cron.schedule`.
