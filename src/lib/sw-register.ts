// Guarded service worker registration.
// Refuses to register in Lovable preview/dev/iframe contexts.

export function isLovablePreviewHost(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  if (h.startsWith("id-preview--") || h.startsWith("preview--")) return true;
  if (h === "lovableproject.com" || h.endsWith(".lovableproject.com")) return true;
  if (h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")) return true;
  if (h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")) return true;
  return false;
}

export function canRegisterSW(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!import.meta.env.PROD) return false;
  if (window.self !== window.top) return false;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return false;
  if (isLovablePreviewHost()) return false;
  return true;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canRegisterSW()) {
    // Best-effort cleanup if a stale SW was registered
    try {
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          if (r.active?.scriptURL.endsWith("/sw.js")) await r.unregister();
        }
      }
    } catch {}
    return null;
  }
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (e) {
    console.warn("[sw] register failed", e);
    return null;
  }
}

export async function getSWRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!canRegisterSW()) return null;
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return registerServiceWorker();
}
