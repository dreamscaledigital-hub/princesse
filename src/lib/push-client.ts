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

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    let publicKey: string;
    try {
      publicKey = await fetchVapidPublicKey();
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
    const keyBytes = urlBase64ToUint8Array(publicKey);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    });
  }

  const json = sub.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
  if (!json.endpoint || !json.keys) return { ok: false, reason: "Abonnement push invalide" };

  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) return { ok: false, reason: "Non connecté" };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
      },
      { onConflict: "endpoint" }
    );
  if (error) return { ok: false, reason: `Erreur DB : ${error.message}` };
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
