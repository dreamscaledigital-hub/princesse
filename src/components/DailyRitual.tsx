import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getOrCreateTodayRitual } from "@/lib/daily-ritual.functions";

const MOODS = [
  { emoji: "🥰", word: "amoureux·se" },
  { emoji: "😌", word: "apaisé·e" },
  { emoji: "🔥", word: "passionné·e" },
  { emoji: "🥲", word: "nostalgique" },
  { emoji: "😴", word: "fatigué·e" },
  { emoji: "😎", word: "confiant·e" },
  { emoji: "🤍", word: "tendre" },
  { emoji: "😬", word: "stressé·e" },
];

type Ritual = {
  id: string;
  couple_id: string;
  ritual_date: string;
  question: string;
  ambiance: string | null;
};

type Entry = {
  id: string;
  ritual_id: string;
  user_id: string;
  mood_emoji: string | null;
  mood_word: string | null;
  answer: string | null;
  updated_at: string;
};

type Props = {
  myId: string;
  partnerId: string;
  partnerName: string;
};

export function DailyRitual({ myId, partnerId, partnerName }: Props) {
  const [ritual, setRitual] = useState<Ritual | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [draft, setDraft] = useState("");
  const [mood, setMood] = useState<{ emoji: string; word: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const myEntry = useMemo(() => entries.find((e) => e.user_id === myId) || null, [entries, myId]);
  const partnerEntry = useMemo(
    () => entries.find((e) => e.user_id === partnerId) || null,
    [entries, partnerId],
  );
  const bothAnswered = !!myEntry?.answer && !!partnerEntry?.answer;

  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void init();
  }, []);

  async function init() {
    try {
      const r = (await getOrCreateTodayRitual()) as Ritual;
      setRitual(r);
      await loadEntries(r.id);
      await loadStreak(r.couple_id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadEntries(ritualId: string) {
    const { data } = await supabase
      .from("daily_entries")
      .select("*")
      .eq("ritual_id", ritualId);
    if (data) {
      setEntries(data as Entry[]);
      const mine = (data as Entry[]).find((e) => e.user_id === myId);
      if (mine) {
        setDraft(mine.answer || "");
        if (mine.mood_emoji && mine.mood_word) setMood({ emoji: mine.mood_emoji, word: mine.mood_word });
      }
    }
  }

  async function loadStreak(coupleId: string) {
    const { data } = await supabase.rpc("couple_streak", { _couple_id: coupleId });
    if (typeof data === "number") setStreak(data);
  }

  // Realtime sur les entries du jour
  useEffect(() => {
    if (!ritual) return;
    const channel = supabase
      .channel(`ritual-${ritual.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_entries", filter: `ritual_id=eq.${ritual.id}` },
        () => {
          void loadEntries(ritual.id);
          void loadStreak(ritual.couple_id);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ritual?.id]);

  async function save() {
    if (!ritual || !mood || !draft.trim()) {
      if (!mood) toast.error("Choisis une humeur du jour 💕");
      else if (!draft.trim()) toast.error("Écris ta réponse 🤍");
      return;
    }
    setSaving(true);
    const payload = {
      ritual_id: ritual.id,
      user_id: myId,
      mood_emoji: mood.emoji,
      mood_word: mood.word,
      answer: draft.trim().slice(0, 500),
    };
    const { error } = await supabase
      .from("daily_entries")
      .upsert(payload, { onConflict: "ritual_id,user_id" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Réponse envoyée 💞");
    await loadEntries(ritual.id);
    await loadStreak(ritual.couple_id);
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-primary/20 bg-card/80 p-6 text-center text-sm text-muted-foreground shadow-sm backdrop-blur">
        <Sparkles className="mx-auto h-5 w-5 animate-pulse text-primary" />
        <p className="mt-2">Préparation du rituel du jour…</p>
      </div>
    );
  }

  if (!ritual) return null;

  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(ritual.ritual_date + "T12:00:00"));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/90 to-card/80 p-5 shadow-md backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70">Rituel du jour</p>
          <p className="text-xs capitalize text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          <Flame className="h-3.5 w-3.5" />
          {streak} <span className="font-normal opacity-80">j</span>
        </div>
      </div>

      <h2 className="mt-3 font-serif text-2xl leading-snug text-foreground">
        <i>«</i> {ritual.question} <i>»</i>
      </h2>

      {/* Humeur du jour */}
      <div className="mt-5">
        <p className="text-xs font-medium text-muted-foreground">Ton humeur aujourd'hui</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {MOODS.map((m) => {
            const active = mood?.emoji === m.emoji;
            return (
              <button
                key={m.emoji}
                type="button"
                onClick={() => setMood(m)}
                className={`flex flex-col items-center gap-1 rounded-2xl border p-2 text-[10px] transition active:scale-95 ${
                  active
                    ? "border-primary bg-primary/15 text-primary shadow-sm"
                    : "border-border bg-background/60 text-muted-foreground hover:border-primary/40"
                }`}
              >
                <span className="text-xl leading-none">{m.emoji}</span>
                <span className="truncate">{m.word}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Composer / réponse */}
      <div className="mt-4">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          placeholder="Ta réponse, dans tes mots…"
          className="min-h-24 resize-none rounded-2xl"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{draft.length}/500</span>
          <Button onClick={save} disabled={saving} className="h-10 rounded-2xl px-4">
            <Send className="mr-2 h-3.5 w-3.5" />
            {myEntry?.answer ? "Mettre à jour" : "Envoyer"}
          </Button>
        </div>
      </div>

      {/* Statut / révélation */}
      <div className="mt-4 rounded-2xl bg-background/50 p-3">
        <AnimatePresence mode="wait">
          {!myEntry?.answer ? (
            <motion.p
              key="me-pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground"
            >
              Réponds pour découvrir la réponse de {partnerName} 💕
            </motion.p>
          ) : !partnerEntry?.answer ? (
            <motion.p
              key="partner-pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground"
            >
              {partnerName} n'a pas encore répondu… reviens plus tard 🤍
            </motion.p>
          ) : bothAnswered ? (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-2">
                {partnerEntry.mood_emoji && (
                  <span className="text-2xl leading-none">{partnerEntry.mood_emoji}</span>
                )}
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">{partnerName}</span>
                  {partnerEntry.mood_word && <span> · {partnerEntry.mood_word}</span>}
                </p>
              </div>
              <p className="mt-2 whitespace-pre-wrap font-serif text-base italic text-foreground">
                « {partnerEntry.answer} »
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
