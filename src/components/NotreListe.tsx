import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Check, Heart, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

type WishStatus = "proposed" | "validated" | "completed" | "refused";

type Wish = {
  id: string;
  room_code: string;
  title: string;
  note: string | null;
  category: string | null;
  proposed_by: number;
  status: WishStatus;
  validated_by: number | null;
  completed_at: string | null;
  created_at: string;
};

const CATEGORIES = [
  { id: "Resto", emoji: "🍝" },
  { id: "Voyage", emoji: "✈️" },
  { id: "Activité", emoji: "🎨" },
  { id: "À la maison", emoji: "🏡" },
  { id: "Surprise", emoji: "🎁" },
] as const;

type Tab = "pending" | "todo" | "done";

type Props = {
  roomCode: string;
  mySlot: number;
  name1: string;
  name2: string;
};

function celebrate(intensity: "soft" | "big" = "soft") {
  if (typeof window === "undefined") return;
  confetti({
    particleCount: intensity === "big" ? 90 : 40,
    spread: 70,
    startVelocity: 35,
    origin: { y: 0.7 },
    colors: ["#e88aab", "#c45c7c", "#f8c8d8", "#a8c0a0"],
    scalar: 0.9,
  });
}

export function NotreListe({ roomCode, mySlot, name1, name2 }: Props) {
  const [items, setItems] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("todo");
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newCat, setNewCat] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nameBySlot = (slot: number) => (slot === 1 ? name1 : name2);
  const myName = nameBySlot(mySlot);
  const otherName = nameBySlot(mySlot === 1 ? 2 : 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("wishlist_items")
        .select("*")
        .eq("room_code", roomCode)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setItems((data ?? []) as Wish[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`wishlist-${roomCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wishlist_items", filter: `room_code=eq.${roomCode}` },
        (payload: { eventType: string; new: Wish; old: Wish }) => {
          setItems((prev) => {
            if (payload.eventType === "INSERT") {
              if (prev.some((i) => i.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((i) => (i.id === payload.new.id ? payload.new : i));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((i) => i.id !== payload.old.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  const pending = useMemo(() => items.filter((i) => i.status === "proposed"), [items]);
  const todo = useMemo(() => items.filter((i) => i.status === "validated"), [items]);
  const done = useMemo(() => items.filter((i) => i.status === "completed"), [items]);

  const addIdea = async () => {
    const title = newTitle.trim();
    if (!title) {
      toast.error("Mets un petit titre 💕");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("wishlist_items").insert({
      room_code: roomCode,
      title: title.slice(0, 120),
      note: newNote.trim() ? newNote.trim().slice(0, 400) : null,
      category: newCat,
      proposed_by: mySlot,
      status: "proposed",
    });
    setSubmitting(false);
    if (error) {
      toast.error("Oups : " + error.message);
      return;
    }
    setNewTitle("");
    setNewNote("");
    setNewCat(null);
    setShowForm(false);
    setTab("pending");
    toast.success("Idée envoyée à " + otherName + " 💌");
  };

  const validateIdea = async (w: Wish) => {
    const { error } = await supabase
      .from("wishlist_items")
      .update({ status: "validated", validated_by: mySlot })
      .eq("id", w.id);
    if (error) return toast.error(error.message);
    celebrate("soft");
    toast.success(`Tu as validé l'idée de ${nameBySlot(w.proposed_by)} 💚`);
  };

  const refuseIdea = async (w: Wish) => {
    const { error } = await supabase.from("wishlist_items").delete().eq("id", w.id);
    if (error) return toast.error(error.message);
    toast("Idée rangée discrètement 🌸");
  };

  const completeIdea = async (w: Wish) => {
    const { error } = await supabase
      .from("wishlist_items")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", w.id);
    if (error) return toast.error(error.message);
    celebrate("big");
    toast.success("Une aventure de plus à deux ❤️");
  };

  const removeIdea = async (w: Wish) => {
    const { error } = await supabase.from("wishlist_items").delete().eq("id", w.id);
    if (error) return toast.error(error.message);
  };

  const accomplishedCount = done.length;

  return (
    <div className="flex flex-1 flex-col pb-24">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.35em] text-primary/70">✦ à deux ✦</p>
        <h1 className="mt-2 font-serif text-4xl italic text-primary">Notre liste 💕</h1>
        <div className="mx-auto mt-3 h-px w-12 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-xs font-medium text-blossom-deep backdrop-blur">
          <Heart className="h-3 w-3 fill-primary text-primary" />
          {accomplishedCount} aventure{accomplishedCount > 1 ? "s" : ""} réalisée{accomplishedCount > 1 ? "s" : ""} ensemble
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-5 grid grid-cols-3 gap-1.5 rounded-2xl bg-white/60 p-1.5 backdrop-blur">
        <TabBtn active={tab === "pending"} onClick={() => setTab("pending")} label="💡 En attente" count={pending.length} />
        <TabBtn active={tab === "todo"} onClick={() => setTab("todo")} label="✅ À faire" count={todo.length} />
        <TabBtn active={tab === "done"} onClick={() => setTab("done")} label="❤️ Fait" count={done.length} />
      </div>

      <div className="mt-4 flex-1 space-y-3">
        {loading && <p className="text-center text-sm text-muted-foreground">Chargement…</p>}

        {!loading && tab === "pending" && pending.length === 0 && (
          <EmptyState text="Aucune idée en attente. Propose-en une ! 💡" />
        )}
        {!loading && tab === "todo" && todo.length === 0 && (
          <EmptyState text="Validez quelques idées et elles atterriront ici ✨" />
        )}
        {!loading && tab === "done" && done.length === 0 && (
          <EmptyState text="Bientôt plein de souvenirs à deux ❤️" />
        )}

        <AnimatePresence mode="popLayout">
          {tab === "pending" &&
            pending.map((w) => (
              <WishCard
                key={w.id}
                w={w}
                mySlot={mySlot}
                nameBySlot={nameBySlot}
                actions={
                  w.proposed_by === mySlot ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs italic text-muted-foreground">
                        en attente de {otherName}…
                      </span>
                      <button
                        onClick={() => removeIdea(w)}
                        className="ml-auto rounded-full p-1.5 text-muted-foreground/70 hover:bg-rose-100 hover:text-rose-600"
                        aria-label="Retirer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => validateIdea(w)}
                        className="h-9 flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600"
                      >
                        <Check className="mr-1 h-4 w-4" /> Valider
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => refuseIdea(w)}
                        className="h-9 rounded-xl"
                      >
                        <X className="mr-1 h-4 w-4" /> Refuser
                      </Button>
                    </div>
                  )
                }
              />
            ))}

          {tab === "todo" &&
            todo.map((w) => (
              <WishCard
                key={w.id}
                w={w}
                mySlot={mySlot}
                nameBySlot={nameBySlot}
                actions={
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => completeIdea(w)}
                      className="h-9 flex-1 rounded-xl bg-gradient-to-r from-rose-400 to-pink-500 hover:opacity-90"
                    >
                      <Sparkles className="mr-1 h-4 w-4" /> Fait ! 🎉
                    </Button>
                    <button
                      onClick={() => removeIdea(w)}
                      className="rounded-xl bg-white/70 p-2 text-muted-foreground hover:bg-rose-100 hover:text-rose-600"
                      aria-label="Retirer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                }
              />
            ))}

          {tab === "done" &&
            done.map((w) => (
              <WishCard key={w.id} w={w} mySlot={mySlot} nameBySlot={nameBySlot} />
            ))}
        </AnimatePresence>
      </div>

      {/* Floating add button */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-gradient-to-r from-rose-400 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-300/50 transition active:scale-95"
      >
        <Plus className="mr-1 inline h-4 w-4" /> Ajouter une idée
      </button>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-3xl bg-gradient-to-b from-rose-50 to-pink-50 p-5 shadow-2xl sm:rounded-3xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-serif text-2xl italic text-primary">Une nouvelle envie ✨</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-white/70"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex : Pique-nique au parc 🧺"
                maxLength={120}
                className="h-12 rounded-xl bg-white/80"
                autoFocus
              />
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Une petite note (optionnel)…"
                maxLength={400}
                className="mt-3 min-h-[70px] rounded-xl bg-white/80"
              />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setNewCat(newCat === c.id ? null : c.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      newCat === c.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-primary/20 bg-white/70 text-foreground/70 hover:bg-white"
                    }`}
                  >
                    {c.emoji} {c.id}
                  </button>
                ))}
              </div>
              <Button
                onClick={addIdea}
                disabled={submitting}
                className="mt-4 h-12 w-full rounded-2xl bg-gradient-to-r from-rose-400 to-pink-500 text-base font-semibold hover:opacity-90"
              >
                <Heart className="mr-2 h-4 w-4 fill-white" />
                Envoyer à {otherName}
              </Button>
              <p className="mt-2 text-center text-[11px] italic text-muted-foreground">
                {otherName} devra valider pour que l'idée rejoigne votre liste 💕
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-2 py-2 text-[11px] font-semibold transition ${
        active
          ? "bg-white text-blossom-deep shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      <span className="ml-1 opacity-70">({count})</span>
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-primary/20 bg-white/40 px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function WishCard({
  w,
  mySlot,
  nameBySlot,
  actions,
}: {
  w: Wish;
  mySlot: number;
  nameBySlot: (slot: number) => string;
  actions?: ReactNode;
}) {
  const proposerName = nameBySlot(w.proposed_by);
  const isMine = w.proposed_by === mySlot;
  const proposerColor = w.proposed_by === 1 ? "bg-sky-400" : "bg-pink-400";
  const initial = proposerName.charAt(0).toUpperCase();
  const cat = CATEGORIES.find((c) => c.id === w.category);
  const completed = w.status === "completed";
  const completedDate = w.completed_at
    ? new Date(w.completed_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-2xl border border-white/80 bg-white/80 p-4 shadow-[0_8px_24px_-15px_rgba(196,92,124,0.35)] backdrop-blur ${
        completed ? "opacity-90" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow ${proposerColor}`}
        >
          {initial}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`font-serif text-lg leading-tight text-blossom-deep ${completed ? "line-through decoration-rose-300/60" : ""}`}>
              {w.title}
            </p>
            {cat && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {cat.emoji} {cat.id}
              </span>
            )}
          </div>
          {w.note && <p className="mt-1 text-sm text-foreground/70">{w.note}</p>}
          <p className="mt-1.5 text-[11px] italic text-muted-foreground">
            Proposé par <span className="font-semibold not-italic text-foreground/70">{isMine ? "toi" : proposerName}</span>
            {completedDate && <> · ❤️ fait le {completedDate}</>}
          </p>
        </div>
      </div>
      {actions && <div className="mt-3">{actions}</div>}
    </motion.div>
  );
}
