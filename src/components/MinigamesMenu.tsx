import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  MINIGAME_DESCRIPTIONS,
  MINIGAME_IDS,
  MINIGAME_LABELS,
  type MinigameId,
} from "@/lib/game-content";

type Props = {
  onPick: (id: MinigameId) => void;
  onBack: () => void;
};

const EMOJI: Record<MinigameId, string> = {
  tap: "⚡",
  memory: "💞",
  green: "🚦",
  culture: "🧠",
  rps: "✌️",
};

const GRADIENT: Record<MinigameId, string> = {
  tap: "from-yellow-200/80 to-amber-300/80",
  memory: "from-pink-200/80 to-rose-300/80",
  green: "from-emerald-200/80 to-lime-300/80",
  culture: "from-sky-200/80 to-indigo-300/80",
  rps: "from-amber-200/80 to-orange-300/80",
};

export function MinigamesMenu({ onPick, onBack }: Props) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.35em] text-primary/70">✦ à la carte ✦</p>
        <h1 className="mt-2 font-serif text-5xl leading-none text-primary">
          Choisis un <span className="italic">duel</span>
        </h1>
        <div className="mx-auto mt-3 h-px w-12 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <p className="mt-3 text-xs text-muted-foreground">
          Le perdant tire un gage moyen <span className="text-amber-500">●</span>
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {MINIGAME_IDS.map((id, i) => (
          <motion.button
            key={id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -2 }}
            onClick={() => onPick(id)}
            className="group relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/70 bg-white/55 p-3 text-center shadow-[0_10px_30px_-15px_rgba(196,92,124,0.35)] backdrop-blur-xl"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENT[id]} opacity-30 transition group-hover:opacity-50`} />
            <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/40 blur-2xl" />
            <span className="relative text-4xl drop-shadow-sm">{EMOJI[id]}</span>
            <p className="relative mt-2 font-serif text-xl leading-tight text-blossom-deep">
              {MINIGAME_LABELS[id]}
            </p>
            <p className="relative mt-1 text-[10px] font-medium uppercase tracking-wider text-foreground/60 line-clamp-2">
              {MINIGAME_DESCRIPTIONS[id]}
            </p>
          </motion.button>
        ))}
      </div>

      <div className="mt-auto pt-6">
        <Button variant="secondary" className="w-full h-12 rounded-2xl" onClick={onBack}>
          ← Retour au menu
        </Button>
      </div>
    </div>
  );
}

