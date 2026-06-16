import { useEffect } from "react";
import { isSoundId, playSound, unlockSoundEngine, type SoundId } from "@/lib/pensee-sound";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "princesse:pensee_sound";
const DEFAULT_SOUND: SoundId = "clochette";
let activeSound: SoundId = DEFAULT_SOUND;

export function getCachedPenseeSound(): SoundId {
  if (typeof window === "undefined") return DEFAULT_SOUND;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    activeSound = isSoundId(v) ? v : activeSound;
    return activeSound;
  } catch {
    return activeSound;
  }
}

export function cachePenseeSound(id: SoundId) {
  if (!isSoundId(id)) return;
  activeSound = id;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch { /* ignore */ }
}

export async function refreshPenseeSoundFromProfile() {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return activeSound;

  const { data: prof } = await supabase
    .from("profiles")
    .select("pensee_sound")
    .eq("id", uid)
    .maybeSingle();
  const s = (prof as { pensee_sound?: string } | null)?.pensee_sound;
  if (isSoundId(s)) cachePenseeSound(s);
  return activeSound;
}

export function playNotificationSound() {
  playSound(activeSound);
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
      unlockSoundEngine();
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

      await refreshPenseeSoundFromProfile();

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
        void refreshPenseeSoundFromProfile().finally(() => playNotificationSound());
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
