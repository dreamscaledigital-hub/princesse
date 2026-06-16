import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Send, Zap, MessageCircle, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/widget")({
  head: () => ({ meta: [{ title: "Widget — Princesse 💕" }] }),
  component: WidgetPage,
});

type Profile = { id: string; display_name: string; avatar_emoji: string };
type Message = { body: string | null; created_at: string };
type DailyEntry = { mood_emoji: string | null; mood_word: string | null; updated_at: string };

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

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate({ to: "/auth" }); return; }

    // Mon profil
    const { data: myProf } = await supabase
      .from("profiles").select("id,display_name,avatar_emoji")
      .eq("id", user.id).maybeSingle();
    if (!myProf) { navigate({ to: "/auth" }); return; }
    setMe(myProf as Profile);

    // Mon couple
    const { data: coupleId } = await supabase.rpc("couple_for_user", { _uid: user.id });
    if (!coupleId) { setLoading(false); return; }

    const { data: couple } = await supabase
      .from("couples").select("user_a,user_b,created_at").eq("id", coupleId).maybeSingle();
    if (!couple) { setLoading(false); return; }

    // Jours ensemble
    const since = new Date((couple as { created_at: string }).created_at);
    const days = Math.floor((Date.now() - since.getTime()) / 86_400_000);
    setDaysTogether(days);

    // Profil partenaire
    const partnerId = (couple as { user_a: string; user_b: string }).user_a === user.id
      ? (couple as { user_a: string; user_b: string }).user_b
      : (couple as { user_a: string; user_b: string }).user_a;

    const { data: partProf } = await supabase
      .from("profiles").select("id,display_name,avatar_emoji")
      .eq("id", partnerId).maybeSingle();
    if (partProf) setPartner(partProf as Profile);

    // Dernier message du partenaire
    const { data: msgs } = await supabase
      .from("messages").select("body,created_at")
      .eq("couple_id", coupleId).eq("sender_id", partnerId)
      .order("created_at", { ascending: false }).limit(1);
    if (msgs?.[0]) setLastMsg(msgs[0] as Message);

    // Humeur du partenaire aujourd'hui
    const today = new Date().toISOString().split("T")[0];
    const { data: ritual } = await supabase
      .from("daily_rituals").select("id")
      .eq("couple_id", coupleId).eq("ritual_date", today).maybeSingle();
    if (ritual) {
      const { data: entry } = await supabase
        .from("daily_entries").select("mood_emoji,mood_word,updated_at")
        .eq("ritual_id", (ritual as { id: string }).id).eq("user_id", partnerId).maybeSingle();
      if (entry) setPartnerMood(entry as DailyEntry);
    }

    // Streak
    const { data: s } = await supabase.rpc("couple_streak", { _couple_id: coupleId });
    if (typeof s === "number") setStreak(s);

    setLoading(false);
  }

  async function sendQuickLove() {
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !partner) return;
      // Envoyer via messages
      const { data: coupleId } = await supabase.rpc("couple_for_user", { _uid: user.id });
      if (!coupleId) return;
      await supabase.from("messages").insert({
        couple_id: coupleId,
        sender_id: user.id,
        body: "💕",
        reactions: {},
        read_by: [user.id],
      });
      // Animation OK
      setTimeout(() => setSending(false), 1200);
    } catch {
      setSending(false);
    }
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
        <p className="text-base text-muted-foreground">Connecte-toi d'abord à un·e partenaire depuis l'app.</p>
        <Button onClick={() => navigate({ to: "/" })}>Ouvrir Princesse</Button>
      </div>
    );
  }

  const timeAgo = lastMsg
    ? formatAgo(lastMsg.created_at)
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 p-4">
      {/* Widget card — ressemble à un vrai widget iOS */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="w-full max-w-[340px] overflow-hidden rounded-[28px] bg-white/80 shadow-2xl ring-1 ring-rose-100 backdrop-blur-xl"
      >
        {/* Header */}
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
          {/* Humeur partenaire */}
          <div className="py-3.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Humeur aujourd'hui
            </p>
            {partnerMood ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl">{partnerMood.mood_emoji}</span>
                <span className="text-sm font-medium text-foreground capitalize">{partnerMood.mood_word}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Pas encore partagée…</p>
            )}
          </div>

          {/* Dernier message */}
          <div className="py-3.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Dernier message
            </p>
            {lastMsg?.body ? (
              <div>
                <p className="line-clamp-2 text-sm text-foreground">"{lastMsg.body}"</p>
                {timeAgo && <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Aucun message encore…</p>
            )}
          </div>

          {/* Streak */}
          {streak > 0 && (
            <div className="py-3.5">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-medium text-foreground">{streak} jour{streak > 1 ? "s" : ""} de streak rituel</span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2 p-4">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={sendQuickLove}
            disabled={sending}
            className="flex flex-col items-center gap-1 rounded-2xl bg-rose-50 py-3 text-rose-500 transition hover:bg-rose-100 disabled:opacity-60"
          >
            {sending
              ? <Heart className="h-5 w-5 animate-ping" />
              : <Heart className="h-5 w-5 fill-rose-400 text-rose-400" />
            }
            <span className="text-[10px] font-medium">{sending ? "Envoyé !" : "Envoyer 💕"}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate({ to: "/messages" })}
            className="flex flex-col items-center gap-1 rounded-2xl bg-pink-50 py-3 text-pink-500 transition hover:bg-pink-100"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="text-[10px] font-medium">Chat</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate({ to: "/" })}
            className="flex flex-col items-center gap-1 rounded-2xl bg-amber-50 py-3 text-amber-500 transition hover:bg-amber-100"
          >
            <Zap className="h-5 w-5" />
            <span className="text-[10px] font-medium">Jouer</span>
          </motion.button>
        </div>

        <p className="pb-4 text-center text-[10px] text-muted-foreground/60">
          Princesse 💕 · Ajoute cette page à l'écran d'accueil
        </p>
      </motion.div>
    </div>
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
