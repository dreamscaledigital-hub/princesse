import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isIOS, isStandalonePWA } from "@/lib/push-client";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "princesse-install-dismissed";

// Capture le prompt navigateur (Chrome/Android/Desktop) dès qu'il arrive.
let cachedPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    cachedPrompt = e as BeforeInstallPromptEvent;
  });
}

/**
 * Bouton "Installer l'appli" toujours visible (sauf si déjà installé en standalone).
 * - Android/desktop : déclenche le prompt natif si dispo.
 * - iOS / pas de prompt : affiche les instructions Partager → Sur l'écran d'accueil.
 */
export function InstallButton({ className }: { className?: string }) {
  const [standalone, setStandalone] = useState(true);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    setStandalone(isStandalonePWA());
  }, []);

  if (standalone) return null;

  const click = async () => {
    if (cachedPrompt) {
      try {
        await cachedPrompt.prompt();
        await cachedPrompt.userChoice;
        cachedPrompt = null;
        return;
      } catch {}
    }
    setShowIosHint(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={click}
        className={
          className ||
          "inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white/80 px-4 py-2 text-sm font-medium text-primary shadow-sm backdrop-blur transition active:scale-95"
        }
      >
        <Download className="h-4 w-4" /> Installer l'appli 📲
      </button>

      <AnimatePresence>
        {showIosHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
            onClick={() => setShowIosHint(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-serif text-2xl text-primary">Installer 📲</h3>
                <button onClick={() => setShowIosHint(false)} className="rounded-full p-1 text-muted-foreground" aria-label="Fermer">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Sur iPhone, dans Safari :</p>
              <ol className="mt-3 space-y-2 text-sm text-foreground">
                <li className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">1</span>
                  Appuie sur <Share className="inline h-4 w-4 align-text-bottom" /> Partager
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">2</span>
                  Choisis "Sur l'écran d'accueil" <Plus className="inline h-4 w-4 align-text-bottom" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">3</span>
                  Ouvre Princesse depuis ton écran d'accueil 💕
                </li>
              </ol>
              <p className="mt-3 rounded-xl bg-blossom-cream/60 p-2 text-[11px] text-primary/80">
                Indispensable pour recevoir les notifications sur iPhone.
              </p>
              <Button className="mt-4 w-full" onClick={() => setShowIosHint(false)}>Compris 💖</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalonePWA()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    if (isIOS()) {
      setIosHint(true);
      setShow(true);
      return;
    }

    if (cachedPrompt) {
      setEvt(cachedPrompt);
      setShow(true);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      const ev = e as BeforeInstallPromptEvent;
      cachedPrompt = ev;
      setEvt(ev);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  };

  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    cachedPrompt = null;
    dismiss();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-primary/20 bg-white/95 p-3 shadow-xl backdrop-blur"
        >
          <button
            onClick={dismiss}
            className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
          {iosHint ? (
            <div className="pr-6">
              <p className="font-serif text-base text-primary">Installer l'appli 📲</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sur iPhone, appuie sur <Share className="inline h-3 w-3 align-text-bottom" /> Partager,
                puis <span className="font-semibold">"Sur l'écran d'accueil"</span> <Plus className="inline h-3 w-3 align-text-bottom" />.
                <br />
                <span className="text-primary/80">Indispensable pour recevoir les notifications.</span>
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 pr-6">
              <div className="flex-1">
                <p className="font-serif text-base text-primary">Installer l'appli 📲</p>
                <p className="text-xs text-muted-foreground">Pour recevoir les pensées de ton amour.</p>
              </div>
              <Button size="sm" onClick={install}>Installer</Button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
