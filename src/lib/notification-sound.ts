import { useEffect } from "react";
import { playSound, type SoundId } from "@/lib/pensee-sound";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "princesse:pensee_sound";
const DEFAULT_SOUND: SoundId = "clochette";

const VALID: SoundId[] = ["clochette", "bulle", "bise", "harpe", "silence"];

function isSoundId(v: unknown): v is SoundId {
  return typeof v === "string" && (VALID as string[]).includes(v);
}

export function getCachedPenseeSound(): SoundId {
  if (typeof window === "undefined") return DEFAULT_SOUND;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isSoundId(v) ? v : DEFAULT_SOUND;
  } catch {
    return DEFAULT_SOUND;
  }
}

export function cachePenseeSound(id: SoundId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch { /* ignore */ }
}

export function playNotificationSound() {
  playSound(getCachedPenseeSound());
}

/**
 * Mount once near the app root.
 * - Hydrates the cached sound from the user's profile.
 * - Listens to service worker messages so any push notification plays
 *   the user's chosen sound when the app is in foreground.
 */
export function useNotificationSoundBridge() {
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Unlock the AudioContext on the first user gesture so later
    // notifications (which are not triggered by a gesture) can play.
    function unlock() {
      try { playSound("silence"); } catch { /* ignore */ }
      // Trigger a no-op oscillator via current cached sound at zero gain by
      // simply calling the engine once — the AudioContext is then resumed.
      try {
        const AC = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
        if (AC) {
          const c = new AC();
          if (c.state === "suspended") c.resume().catch(() => {});
        }
      } catch { /* ignore */ }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    }
    window.addEventListener("pointerdown", unlock, { once: false });
    window.addEventListener("keydown", unlock, { once: false });
    window.addEventListener("touchstart", unlock, { once: false });

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("pensee_sound")
        .eq("id", uid)
        .maybeSingle();
      const s = (prof as { pensee_sound?: string } | null)?.pensee_sound;
      if (isSoundId(s)) cachePenseeSound(s);

      channel = supabase
        .channel(`profile-sound-${uid}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
          (payload) => {
            const next = (payload.new as { pensee_sound?: string }).pensee_sound;
            if (isSoundId(next)) cachePenseeSound(next);
          },
        )
        .subscribe();
    })();

    function onSwMessage(ev: MessageEvent) {
      const data = ev.data as { type?: string } | null;
      if (data && data.type === "play-notification-sound") {
        playNotificationSound();
      }
    }

    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      if (channel) supabase.removeChannel(channel);
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
    };
  }, []);
}
