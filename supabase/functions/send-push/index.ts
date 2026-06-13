// Edge function: send-push
// Retourne TOUJOURS HTTP 200. Les erreurs passent par { ok: false, reason }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC_KEY")  || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const RAW_SUBJECT   = Deno.env.get("VAPID_SUBJECT")     || "";
const VAPID_SUBJECT = RAW_SUBJECT.startsWith("mailto:") || RAW_SUBJECT.startsWith("http")
  ? RAW_SUBJECT
  : `mailto:${RAW_SUBJECT.includes("@") ? RAW_SUBJECT : "hello@princesse.app"}`;
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON          = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

const vapidConfigured = !!(VAPID_PUBLIC && VAPID_PRIVATE);
let vapidSet = false;
function ensureVapid() {
  if (vapidSet) return;
  if (!vapidConfigured) throw new Error("Clés VAPID non configurées dans les secrets Supabase");
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
      if (!VAPID_PUBLIC) return ok({ ok: false, reason: "Clé VAPID publique non configurée" });
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
        vapidOk: vapidConfigured,
        coupled: !!couple,
        mySubCount:      mySubs?.length ?? 0,
        partnerSubCount,
      });
    }

    // ── Envoi d'une pensée ──────────────────────────────────────────────────
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
