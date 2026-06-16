// Edge function: send-push
// Retourne TOUJOURS HTTP 200. Les erreurs passent par { ok: false, reason }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const DEFAULT_VAPID_PUBLIC = "BPQYTPJgYODhRYDEcsuO22ONyEA7cStENzPLOooiX6MaTziKqsjtcflgb0mtbQQXtkAz4Li4PK45mew4i35RYZE";
const RAW_VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PUBLIC = RAW_VAPID_PUBLIC.length > 40 ? RAW_VAPID_PUBLIC : DEFAULT_VAPID_PUBLIC;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const RAW_SUBJECT   = Deno.env.get("VAPID_SUBJECT")     || "";
const VAPID_SUBJECT = RAW_SUBJECT.startsWith("mailto:") || RAW_SUBJECT.startsWith("http")
  ? RAW_SUBJECT
  : `mailto:${RAW_SUBJECT.includes("@") ? RAW_SUBJECT : "hello@princesse.app"}`;
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON          = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

const vapidConfigured = !!(VAPID_PUBLIC && VAPID_PRIVATE);
function decodedBase64UrlLength(value: string) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return atob(padded).length;
  } catch {
    return 0;
  }
}

function validateVapidPublicKey() {
  if (!VAPID_PUBLIC) return "Clé VAPID publique non configurée";
  const byteLength = decodedBase64UrlLength(VAPID_PUBLIC);
  if (byteLength !== 65) {
    return `Clé VAPID publique invalide : elle fait ${byteLength} octets décodés au lieu de 65`;
  }
  return null;
}

function validateVapidPrivateKey() {
  if (!VAPID_PRIVATE) return "Clé VAPID privée non configurée";
  const byteLength = decodedBase64UrlLength(VAPID_PRIVATE);
  if (byteLength !== 32) {
    return `Clé VAPID privée invalide : elle fait ${byteLength} octets décodés au lieu de 32`;
  }
  return null;
}

function validateVapidKeys() {
  return validateVapidPublicKey() || validateVapidPrivateKey();
}

let vapidSet = false;
function ensureVapid() {
  if (vapidSet) return;
  if (!vapidConfigured) throw new Error("Clés VAPID non configurées dans les secrets Supabase");
  const keyError = validateVapidKeys();
  if (keyError) throw new Error(keyError);
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidSet = true;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Toujours HTTP 200 pour que le SDK Supabase parse bien le body
function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json", ...cors },
  });
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const client = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: auth } },
  });
  const { data } = await client.auth.getUser();
  return data?.user ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body   = await req.json().catch(() => ({}));
    const action = body.action;

    // ── Clé publique VAPID ──────────────────────────────────────────────────
    if (action === "vapid_public_key") {
      const keyError = validateVapidKeys();
      if (keyError) return ok({ ok: false, reason: keyError });
      return ok({ key: VAPID_PUBLIC });
    }

    // ── Diagnostic ──────────────────────────────────────────────────────────
    if (action === "status") {
      const user = await getUser(req);
      if (!user) return ok({ ok: false, reason: "non authentifié" });

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: mySubs }  = await admin.from("push_subscriptions").select("id").eq("user_id", user.id);
      const { data: couple }  = await admin.from("couples").select("user_a,user_b")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`).maybeSingle();

      let partnerSubCount = 0;
      if (couple) {
        const pid = couple.user_a === user.id ? couple.user_b : couple.user_a;
        const { data: ps } = await admin.from("push_subscriptions").select("id").eq("user_id", pid);
        partnerSubCount = ps?.length ?? 0;
      }

      return ok({
        vapidOk: vapidConfigured && !validateVapidKeys(),
        coupled: !!couple,
        mySubCount:      mySubs?.length ?? 0,
        partnerSubCount,
      });
    }

    // ── Broadcast quotidien (rituel du jour) ────────────────────────────────
    if (action === "daily_broadcast") {
      const apikey = req.headers.get("apikey") || "";
      const auth = req.headers.get("Authorization") || "";
      // Garde minimale : l'appel doit présenter la clé anon ou service role
      // (pg_cron utilise la anon key). Pas de PII renvoyée, payload générique.
      if (apikey !== ANON && !auth.includes(ANON) && !auth.includes(SERVICE_ROLE)) {
        return ok({ ok: false, reason: "forbidden" });
      }

      try { ensureVapid(); } catch (e) {
        return ok({ ok: false, reason: (e as Error).message });
      }
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: subs } = await admin.from("push_subscriptions").select("*");
      if (!subs || subs.length === 0) return ok({ ok: true, sent: 0 });

      const payload = JSON.stringify({
        title: "Votre rituel du jour vous attend 💕",
        body: "Une nouvelle question tendre est prête pour vous deux.",
        url: "/hub",
      });
      let success = 0;
      const expired: string[] = [];
      await Promise.all(subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          success++;
        } catch (err: any) {
          const code = err?.statusCode;
          if (code === 404 || code === 410) expired.push(s.endpoint);
        }
      }));
      if (expired.length) {
        await admin.from("push_subscriptions").delete().in("endpoint", expired);
      }
      return ok({ ok: true, sent: success });
    }


    // ── Morning digest — notif personnalisée par couple ──────────────────────
    if (action === "morning_digest") {
      const apikey = req.headers.get("apikey") || "";
      const auth = req.headers.get("Authorization") || "";
      if (apikey !== ANON && !auth.includes(ANON) && !auth.includes(SERVICE_ROLE)) {
        return ok({ ok: false, reason: "forbidden" });
      }

      try { ensureVapid(); } catch (e) {
        return ok({ ok: false, reason: (e as Error).message });
      }

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

      // Tous les couples
      const { data: couples } = await admin.from("couples").select("id,user_a,user_b,created_at");
      if (!couples || couples.length === 0) return ok({ ok: true, sent: 0 });

      let totalSent = 0;
      const expired: string[] = [];

      await Promise.all(couples.map(async (couple: { id: string; user_a: string; user_b: string; created_at: string }) => {
        const days = Math.floor((Date.now() - new Date(couple.created_at).getTime()) / 86_400_000);

        // Streak via RPC
        const { data: streak } = await admin.rpc("couple_streak", { _couple_id: couple.id });
        const streakNum = typeof streak === "number" ? streak : 0;

        // Pour chaque membre du couple
        for (const [userId, partnerId] of [
          [couple.user_a, couple.user_b],
          [couple.user_b, couple.user_a],
        ] as [string, string][]) {
          // Vérifier que la notif est activée pour cet utilisateur
          const { data: prof } = await admin
            .from("profiles")
            .select("daily_notif_enabled")
            .eq("id", userId)
            .maybeSingle();
          if (!prof?.daily_notif_enabled) continue;

          // Abonnements push de cet utilisateur
          const { data: subs } = await admin
            .from("push_subscriptions")
            .select("*")
            .eq("user_id", userId);
          if (!subs || subs.length === 0) continue;

          // Infos partenaire
          const { data: partnerProf } = await admin
            .from("profiles")
            .select("display_name,avatar_emoji")
            .eq("id", partnerId)
            .maybeSingle();
          const partnerName = partnerProf?.display_name || "Ton amour";
          const partnerEmoji = partnerProf?.avatar_emoji || "💕";

          // Humeur partenaire aujourd'hui (si déjà remplie)
          const today = new Date().toISOString().split("T")[0];
          const { data: ritual } = await admin
            .from("daily_rituals")
            .select("id")
            .eq("couple_id", couple.id)
            .eq("ritual_date", today)
            .maybeSingle();

          let moodLine = "";
          if (ritual) {
            const { data: entry } = await admin
              .from("daily_entries")
              .select("mood_emoji,mood_word")
              .eq("ritual_id", (ritual as { id: string }).id)
              .eq("user_id", partnerId)
              .maybeSingle();
            if (entry?.mood_emoji) {
              moodLine = ` ${entry.mood_emoji} ${entry.mood_word || ""}`.trim();
            }
          }

          // Construire le message
          const streakText = streakNum > 0 ? ` 🔥 ${streakNum} jour${streakNum > 1 ? "s" : ""} de suite !` : "";
          const body = moodLine
            ? `${partnerName} est${moodLine} aujourd'hui.${streakText}`
            : `${partnerName} ${partnerEmoji} pense à toi.${streakText} ${days} jours ensemble 💕`;

          const payload = JSON.stringify({
            title: `Bonjour 🌸 ${partnerName} t'attend !`,
            body,
            url: "/widget",
          });

          await Promise.all(subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
              );
              totalSent++;
            } catch (err: any) {
              if (err?.statusCode === 404 || err?.statusCode === 410) expired.push(s.endpoint);
            }
          }));
        }
      }));

      if (expired.length) {
        await admin.from("push_subscriptions").delete().in("endpoint", expired);
      }
      return ok({ ok: true, sent: totalSent });
    }

    if (action !== "send") return ok({ ok: false, reason: "action inconnue" });


    const user = await getUser(req);
    if (!user) return ok({ ok: false, reason: "non authentifié — reconnecte-toi" });

    try { ensureVapid(); } catch (e) {
      return ok({ ok: false, reason: (e as Error).message });
    }

    const message = String(body.message || "").trim().slice(0, 140);
    if (!message) return ok({ ok: false, reason: "message vide" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: couple } = await admin.from("couples").select("user_a,user_b")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`).maybeSingle();
    if (!couple) return ok({ ok: false, reason: "pas encore appairés — appaire-toi d'abord dans le hub" });

    const partnerId = couple.user_a === user.id ? couple.user_b : couple.user_a;

    const { data: myProfile } = await admin.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    const fromName = myProfile?.display_name || "Ton amour";

    const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", partnerId);
    if (!subs || subs.length === 0) {
      return ok({ ok: false, reason: "ton amour n'a pas encore activé les notifications 🔔 — dis-lui d'ouvrir le hub" });
    }

    const payload = JSON.stringify({ title: `${fromName} 💕`, body: message, url: "/hub" });

    let success = 0;
    const expired: string[] = [];
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        success++;
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) expired.push(s.endpoint);
        console.error("webpush error", code, err?.body);
      }
    }));

    if (expired.length) {
      await admin.from("push_subscriptions").delete().in("endpoint", expired);
    }

    if (success === 0) {
      return ok({ ok: false, reason: "abonnements expirés — ouvre le hub pour réactiver" });
    }
    return ok({ ok: true });

  } catch (e) {
    console.error("send-push fatal", e);
    return ok({ ok: false, reason: `Erreur serveur : ${(e as Error).message}` });
  }
});
