import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Zap, MessageCircle, Flame, Share, Plus, X, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isIOS, isStandalonePWA } from "@/lib/push-client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/widget")({
  head: () => ({ meta: [{ title: "Widget — Princesse 💕" }] }),
  component: WidgetPage,
});

type Profile = { id: string; display_name: string; avatar_emoji: string };
type Message = { body: string | null; created_at: string };
type DailyEntry = { mood_emoji: string | null; mood_word: string | null };

// Capture le prompt Android (beforeinstallprompt)
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
let androidPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    androidPrompt = e as BeforeInstallPromptEvent;
  });
}

function WidgetPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [daysTogether, setDaysTogether] = useState<number | null>(null);
  const [lastMsg, setLastMsg] = useState<Message | null>(null);
  const [partnerMood, setPartnerMood] = useState<DailyEntry | null>(null);
  const [streak, setStreak] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    void load();
    setInstalled(isStandalonePWA());
  }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate({ to: "/auth" }); return; }

    const { data: myProf } = await supabase
      .from("profiles").select("id,display_name,avatar_emoji")
      .eq("id", user.id).maybeSingle();
    if (!myProf) { navigate({ to: "/auth" }); return; }
    setMe(myProf as Profile);

    const { data: coupleId } = await supabase.rpc("couple_for_user", { _uid: user.id });
    if (!coupleId) { setLoading(false); return; }

    const { data: couple } = await supabase
      .from("couples").select("user_a,user_b,created_at").eq("id", coupleId).maybeSingle();
    if (!couple) { setLoading(false); return; }

    const since = new Date((couple as { created_at: string }).created_at);
    setDaysTogether(Math.floor((Date.now() - since.getTime()) / 86_400_000));

    const partnerId = (couple as { user_a: string; user_b: string }).user_a === user.id
      ? (couple as { user_a: string; user_b: string }).user_b
      : (couple as { user_a: string; user_b: string }).user_a;

    const { data: partProf } = await supabase
      .from("profiles").select("id,display_name,avatar_emoji")
      .eq("id", partnerId).maybeSingle();
    if (partProf) setPartner(partProf as Profile);

    const { data: msgs } = await supabase
      .from("messages").select("body,created_at")
      .eq("couple_id", coupleId).eq("sender_id", partnerId)
      .order("created_at", { ascending: false }).limit(1);
    if (msgs?.[0]) setLastMsg(msgs[0] as Message);

    const today = new Date().toISOString().split("T")[0];
    const { data: ritual } = await supabase
      .from("daily_rituals").select("id")
      .eq("couple_id", coupleId).eq("ritual_date", today).maybeSingle();
    if (ritual) {
      const { data: entry } = await supabase
        .from("daily_entries").select("mood_emoji,mood_word")
        .eq("ritual_id", (ritual as { id: string }).id).eq("user_id", partnerId).maybeSingle();
      if (entry) setPartnerMood(entry as DailyEntry);
    }

    const { data: s } = await supabase.rpc("couple_streak", { _couple_id: coupleId });
    if (typeof s === "number") setStreak(s);

    setLoading(false);
  }

  async function sendQuickLove() {
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !partner) return;
      const { data: coupleId } = await supabase.rpc("couple_for_user", { _uid: user.id });
      if (!coupleId) return;
      await supabase.from("messages").insert({
        couple_id: coupleId, sender_id: user.id, body: "💕", reactions: {}, read_by: [user.id],
      });
    } finally {
      setTimeout(() => setSending(false), 1500);
    }
  }

  async function handleInstall() {
    if (androidPrompt) {
      try {
        await androidPrompt.prompt();
        await androidPrompt.userChoice;
        androidPrompt = null;
        setInstalled(true);
        return;
      } catch {}
    }
    setShowInstall(true);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-50 to-pink-100">
        <Heart className="h-8 w-8 animate-pulse text-rose-400" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-rose-50 to-pink-100 p-6 text-center">
        <span className="text-5xl">🥹</span>
        <p className="text-sm text-muted-foreground">Connecte-toi d'abord à un·e partenaire.</p>
        <Button onClick={() => navigate({ to: "/" })}>Ouvrir Princesse</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 p-4">

      {/* Widget card */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="w-full max-w-[340px] overflow-hidden rounded-[28px] bg-white/80 shadow-2xl ring-1 ring-rose-100 backdrop-blur-xl"
      >
        {/* Header gradient */}
        <div className="bg-gradient-to-r from-rose-400 to-pink-400 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/30 text-2xl">
                {partner.avatar_emoji}
              </div>
              <div>
                <p className="text-xs font-medium text-white/70">Ton amour</p>
                <p className="text-base font-bold text-white">{partner.display_name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/70">Ensemble depuis</p>
              <p className="text-lg font-bold text-white">{daysTogether ?? "—"} jours</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-rose-50 px-5">
          <div className="py-3.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Humeur aujourd'hui</p>
            {partnerMood ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl">{partnerMood.mood_emoji}</span>
                <span className="text-sm font-medium capitalize">{partnerMood.mood_word}</span>
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">Pas encore partagée…</p>
            )}
          </div>

          <div className="py-3.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dernier message</p>
            {lastMsg?.body ? (
              <div>
                <p className="line-clamp-2 text-sm">"{lastMsg.body}"</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{formatAgo(lastMsg.created_at)}</p>
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">Aucun message encore…</p>
            )}
          </div>

          {streak > 0 && (
            <div className="flex items-center gap-2 py-3.5">
              <Flame className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-medium">{streak} jour{streak > 1 ? "s" : ""} de streak</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 p-4">
          <motion.button whileTap={{ scale: 0.92 }} onClick={sendQuickLove} disabled={sending}
            className="flex flex-col items-center gap-1 rounded-2xl bg-rose-50 py-3 text-rose-500 transition hover:bg-rose-100 disabled:opacity-60">
            <Heart className={`h-5 w-5 ${sending ? "animate-ping fill-rose-400" : "fill-rose-400"}`} />
            <span className="text-[10px] font-medium">{sending ? "Envoyé 💕" : "Envoyer 💕"}</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => navigate({ to: "/messages" })}
            className="flex flex-col items-center gap-1 rounded-2xl bg-pink-50 py-3 text-pink-500 transition hover:bg-pink-100">
            <MessageCircle className="h-5 w-5" />
            <span className="text-[10px] font-medium">Chat</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.92 }} onClick={() => navigate({ to: "/" })}
            className="flex flex-col items-center gap-1 rounded-2xl bg-amber-50 py-3 text-amber-500 transition hover:bg-amber-100">
            <Zap className="h-5 w-5" />
            <span className="text-[10px] font-medium">Jouer</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Bouton ajouter à l'écran d'accueil */}
      {!installed && (
        <motion.button
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={handleInstall}
          className="flex w-full max-w-[340px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose-300 bg-white/70 py-4 text-sm font-semibold text-rose-500 shadow-sm backdrop-blur transition hover:border-rose-400 hover:bg-rose-50 active:scale-[0.98]"
        >
          <Smartphone className="h-5 w-5" />
          Ajouter à l'écran d'accueil 📲
        </motion.button>
      )}

      {installed && (
        <p className="text-xs text-muted-foreground/70">✅ Déjà installé sur cet appareil</p>
      )}

      {/* Modal instructions */}
      <AnimatePresence>
        {showInstall && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
            onClick={() => setShowInstall(false)}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-serif text-2xl text-primary">Ajouter au téléphone 📲</h3>
                <button onClick={() => setShowInstall(false)} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {isIOS() ? (
                <>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Sur <strong>iPhone avec Safari</strong>, ouvre cette page puis :
                  </p>
                  <ol className="space-y-3">
                    <Step n={1} icon={<Share className="h-4 w-4" />}>
                      Appuie sur <strong>Partager</strong> (le carré avec une flèche en bas de Safari)
                    </Step>
                    <Step n={2} icon={<Plus className="h-4 w-4" />}>
                      Fais défiler et appuie sur <strong>"Sur l'écran d'accueil"</strong>
                    </Step>
                    <Step n={3} icon={<span className="text-sm">✏️</span>}>
                      Nomme-le <strong>"Widget 💕"</strong> et appuie sur <strong>Ajouter</strong>
                    </Step>
                  </ol>
                  <div className="mt-4 rounded-2xl bg-rose-50 p-3 text-xs text-rose-700">
                    💡 L'icône ouvrira directement cette page widget sur ton écran d'accueil.
                  </div>
                </>
              ) : (
                <>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Sur <strong>Android avec Chrome</strong> :
                  </p>
                  <ol className="space-y-3">
                    <Step n={1} icon={<span className="text-sm font-bold">⋮</span>}>
                      Appuie sur le <strong>menu ⋮</strong> en haut à droite de Chrome
                    </Step>
                    <Step n={2} icon={<Plus className="h-4 w-4" />}>
                      Appuie sur <strong>"Ajouter à l'écran d'accueil"</strong>
                    </Step>
                    <Step n={3} icon={<span className="text-sm">✅</span>}>
                      Confirme — l'icône Widget apparaît sur ton écran d'accueil
                    </Step>
                  </ol>
                  <div className="mt-4 rounded-2xl bg-rose-50 p-3 text-xs text-rose-700">
                    💡 Assure-toi d'être sur la page <strong>/widget</strong> avant d'ajouter.
                  </div>
                </>
              )}

              <Button className="mt-5 w-full" onClick={() => setShowInstall(false)}>
                Compris 💖
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-foreground">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {n}
      </span>
      <span className="flex items-center gap-1.5 pt-0.5">
        <span className="text-primary">{icon}</span>
        <span>{children}</span>
      </span>
    </li>
  );
}

function formatAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 2) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${d} jour${d > 1 ? "s" : ""}`;
}
