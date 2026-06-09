import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isIOS, isStandalonePWA } from "@/lib/push-client";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "princesse-install-dismissed";

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

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
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
