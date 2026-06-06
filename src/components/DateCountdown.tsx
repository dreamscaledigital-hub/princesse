import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Pencil, Heart } from "lucide-react";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

type Props = {
  roomId: string;
  nextDateAt: string | null;
};

// Calcule le prochain mercredi à 14:15 (heure de Bruxelles, simplifiée en local).
function defaultNextDate(): Date {
  const now = new Date();
  const d = new Date(now);
  d.setHours(14, 15, 0, 0);
  const day = d.getDay(); // 0 dim, 3 mer
  let diff = (3 - day + 7) % 7;
  if (diff === 0 && d.getTime() <= now.getTime()) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toLocalInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function formatPretty(d: Date): string {
  const j = JOURS[d.getDay()];
  return `${j} ${d.getDate()} ${MOIS[d.getMonth()]} à ${pad(d.getHours())}h${pad(d.getMinutes())} 🥰`;
}

export function DateCountdown({ roomId, nextDateAt }: Props) {
  const target = useMemo(() => {
    if (nextDateAt) {
      const d = new Date(nextDateAt);
      if (!isNaN(d.getTime())) return d;
    }
    return defaultNextDate();
  }, [nextDateAt]);

  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(toLocalInputValue(target));
  const [saving, setSaving] = useState(false);
  const [celebrated, setCelebrated] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setDraft(toLocalInputValue(target));
    setCelebrated(false);
  }, [target]);

  const diff = target.getTime() - now.getTime();
  const isNow = diff <= 0;

  useEffect(() => {
    if (isNow && !celebrated) {
      setCelebrated(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.4 },
        colors: ["#e88aab", "#f8c8d8", "#c45c7c", "#fef0f5"],
      });
    }
  }, [isNow, celebrated]);

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  const save = async () => {
    const d = new Date(draft);
    if (isNaN(d.getTime())) {
      toast.error("Date invalide");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("rooms")
      .update({ next_date_at: d.toISOString() })
      .eq("id", roomId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Rendez-vous mis à jour 💕");
    setOpen(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mt-6 overflow-hidden rounded-3xl border border-blossom-rose/30 bg-gradient-to-br from-[#fff7fb] via-[#fef0f5] to-[#fde2ec] p-5 shadow-[0_18px_40px_-20px_rgba(196,92,124,0.45)]"
      >
        {/* cœurs décoratifs */}
        <motion.span
          aria-hidden
          className="absolute -left-2 top-3 text-2xl text-blossom-rose/60"
          animate={{ y: [0, -4, 0], rotate: [-8, 4, -8] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          💗
        </motion.span>
        <motion.span
          aria-hidden
          className="absolute right-2 top-1 text-xl text-blossom-rose/50"
          animate={{ y: [0, 4, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: 0.3 }}
        >
          💞
        </motion.span>
        <motion.span
          aria-hidden
          className="absolute bottom-2 left-6 text-lg text-blossom-rose/50"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, delay: 0.6 }}
        >
          💕
        </motion.span>
        <motion.span
          aria-hidden
          className="absolute -right-1 bottom-4 text-2xl text-blossom-rose/60"
          animate={{ rotate: [0, 10, 0] }}
          transition={{ duration: 3.2, repeat: Infinity }}
        >
          🌸
        </motion.span>

        <div className="relative text-center">
          <p className="font-script text-xl text-blossom-deep">
            Notre prochain rendez-vous est dans…
          </p>

          <AnimatePresence mode="wait">
            {isNow ? (
              <motion.div
                key="now"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-3"
              >
                <motion.p
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="font-serif text-3xl italic text-blossom-rose"
                >
                  C'est l'heure 💕
                </motion.p>
                <p className="mt-1 font-script text-lg text-blossom-deep">
                  On se retrouve maintenant 🥰
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="count"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-3 flex justify-center gap-2"
              >
                <TimeCard value={days} label="j" />
                <TimeCard value={hours} label="h" />
                <TimeCard value={minutes} label="min" />
                <TimeCard value={seconds} label="s" pulse />
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-3 font-script text-lg text-blossom-deep">
            {formatPretty(target)}
          </p>

          <button
            onClick={() => setOpen(true)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-blossom-rose/40 bg-white/70 px-3 py-1 text-xs font-medium text-blossom-deep shadow-sm backdrop-blur transition hover:bg-white"
          >
            <Pencil className="h-3 w-3" /> Modifier
          </button>
        </div>
      </motion.div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-script text-2xl text-blossom-deep">
              <Heart className="mr-1 inline h-4 w-4 fill-blossom-rose text-blossom-rose" />
              Notre prochain rendez-vous
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Date et heure</label>
            <Input
              type="datetime-local"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "..." : "Enregistrer 💕"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TimeCard({ value, label, pulse }: { value: number; label: string; pulse?: boolean }) {
  const safe = Math.max(0, value);
  return (
    <motion.div
      animate={pulse ? { scale: [1, 1.06, 1] } : undefined}
      transition={pulse ? { duration: 1, repeat: Infinity } : undefined}
      className="flex min-w-[56px] flex-col items-center rounded-2xl border border-white/80 bg-white/70 px-2 py-2 shadow-sm backdrop-blur"
    >
      <span className="font-serif text-2xl leading-none text-blossom-deep tabular-nums">
        {pad(safe)}
      </span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-blossom-rose">
        {label}
      </span>
    </motion.div>
  );
}
