// Edge function: send-push
// Handles 3 actions via JSON body:
//   { action: "vapid_public_key" }      -> { key }
//   { action: "send", message: string } -> { ok, reason? }
// Auth: requires Authorization: Bearer <user JWT>.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const RAW_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "";
const VAPID_SUBJECT =
  RAW_SUBJECT.startsWith("mailto:") || RAW_SUBJECT.startsWith("http")
    ? RAW_SUBJECT
    : `mailto:${RAW_SUBJECT.includes("@") ? RAW_SUBJECT : "hello@princesse.app"}`;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidConfigured = true;
}



const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "vapid_public_key") {
      return json(200, { key: VAPID_PUBLIC, len: VAPID_PUBLIC?.length ?? 0 });
    }

    if (action !== "send") return json(400, { ok: false, reason: "action inconnue" });

    ensureVapid();

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { ok: false, reason: "non authentifié" });

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: ures, error: uerr } = await userClient.auth.getUser();
    if (uerr || !ures.user) return json(401, { ok: false, reason: "non authentifié" });
    const me = ures.user.id;

    const message = String(body.message || "").trim().slice(0, 140);
    if (!message) return json(400, { ok: false, reason: "message vide" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Find couple
    const { data: couple } = await admin
      .from("couples")
      .select("user_a,user_b")
      .or(`user_a.eq.${me},user_b.eq.${me}`)
      .maybeSingle();
    if (!couple) return json(400, { ok: false, reason: "pas encore appairés" });
    const partnerId = couple.user_a === me ? couple.user_b : couple.user_a;

    // My display name
    const { data: myProfile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", me)
      .maybeSingle();
    const fromName = myProfile?.display_name || "Ton amour";

    // Partner subscriptions
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", partnerId);

    if (!subs || subs.length === 0) {
      return json(200, { ok: false, reason: "ton amour n'a pas encore activé les notifications" });
    }

    const payload = JSON.stringify({
      title: `${fromName} 💕`,
      body: message,
      url: "/hub",
    });

    let success = 0;
    const expired: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          success++;
        } catch (err: any) {
          const code = err?.statusCode;
          if (code === 404 || code === 410) expired.push(s.endpoint);
          console.error("push error", code, err?.body);
        }
      }),
    );

    if (expired.length) {
      await admin.from("push_subscriptions").delete().in("endpoint", expired);
    }

    if (success === 0) return json(200, { ok: false, reason: "tous les abonnements sont expirés" });
    return json(200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(500, { ok: false, reason: (e as Error).message });
  }
});
