import { supabase } from "@/integrations/supabase/client";
import { getSWRegistration, canRegisterSW } from "@/lib/sw-register";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function fetchVapidPublicKey(): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ key?: string; reason?: string }>("send-push", {
    body: { action: "vapid_public_key" },
  });
  if (error || !data?.key) throw new Error(error?.message || data?.reason || "Clé VAPID introuvable — vérifie les secrets backend");
  return data.key;
}

export async function subscribeToPush(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === "undefined") return { ok: false, reason: "ssr" };
  if (!("Notification" in window)) return { ok: false, reason: "Notifications non supportées sur cet appareil" };
  if (!canRegisterSW()) {
    return {
      ok: false,
      reason: "Les notifications fonctionnent uniquement sur l'app publiée (pas dans la prévisualisation Lovable). Ouvre l'URL de production.",
    };
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "Permission refusée — autorise les notifications dans ton navigateur" };

  const reg = await getSWRegistration();
  if (!reg) return { ok: false, reason: "Service worker indisponible" };

  // Auth check up-front so helpers can use userId
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user?.id) return { ok: false, reason: "Non connecté" };
  const userId: string = userRes.user.id;

  // Helper — fetch VAPID key and create a fresh PushSubscription
  async function createPushSub(): Promise<PushSubscription | { ok: false; reason: string }> {
    let publicKey: string;
    try { publicKey = await fetchVapidPublicKey(); }
    catch (e) { return { ok: false, reason: (e as Error).message }; }
    const keyBytes = urlBase64ToUint8Array(publicKey);
    try {
      return await reg!.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
      });
    } catch (e) {
      return { ok: false, reason: `Impossible de créer l'abonnement push : ${(e as Error).message}` };
    }
  }

  // Helper — save a PushSubscription to DB; returns true on success.
  // The upsert uses onConflict:"endpoint" but RLS may silently block the update
  // when the endpoint row belongs to a different user (shared device scenario).
  // We verify ownership with a follow-up SELECT.
  async function saveSub(s: PushSubscription): Promise<boolean> {
    const j = s.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
    if (!j.endpoint || !j.keys) return false;
    await supabase
      .from("push_subscriptions")
      .upsert(
        { user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent },
        { onConflict: "endpoint" }
      );
    const { data: row } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", j.endpoint)
      .eq("user_id", userId)
      .maybeSingle();
    return !!row;
  }

  let sub = await reg.pushManager.getSubscription();

  // Purge legacy FCM endpoints (disabled by Google June 2024) and expired subscriptions
  if (sub) {
    const endpoint = sub.endpoint || "";
    const isLegacyFcm = endpoint.includes("fcm.googleapis.com/fcm/send/");
    const expired = typeof sub.expirationTime === "number" && sub.expirationTime < Date.now();
    if (isLegacyFcm || expired) {
      try {
        const oldEndpoint = sub.endpoint;
        await sub.unsubscribe();
        await supabase.from("push_subscriptions").delete().eq("endpoint", oldEndpoint);
      } catch { /* ignore */ }
      sub = null;
    }
  }

  if (sub) {
    // Existing browser subscription: try to save it.
    // If it belongs to another account in the DB, unsubscribe and create a fresh one.
    const saved = await saveSub(sub);
    if (!saved) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
  }

  if (!sub) {
    const result = await createPushSub();
    if ("ok" in result) return result; // error object
    sub = result;
    const saved = await saveSub(sub);
    if (!saved) return { ok: false, reason: "Impossible d'enregistrer l'abonnement push en base" };
  }

  return { ok: true };
}

export async function sendPensee(message: string): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; reason?: string }>("send-push", {
    body: { action: "send", message },
  });
  if (error) return { ok: false, reason: error.message };
  return data ?? { ok: false, reason: "Réponse vide du serveur" };
}

export async function getNotifStatus(): Promise<{
  vapidOk: boolean;
  coupled: boolean;
  mySubCount: number;
  partnerSubCount: number;
} | null> {
  const { data, error } = await supabase.functions.invoke<{
    vapidOk: boolean;
    coupled: boolean;
    mySubCount: number;
    partnerSubCount: number;
  }>("send-push", {
    body: { action: "status" },
  });
  if (error || !data) return null;
  return data;
}

export function pushPermissionState(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)").matches;
  // @ts-expect-error iOS
  const iosStandalone = window.navigator.standalone === true;
  return Boolean(mql || iosStandalone);
}
