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
  tap: "💞",
  memory: "💞",
  green: "🚦",
  culture: "🧠",
  rps: "✌️",
};

const GRADIENT: Record<MinigameId, string> = {
  tap: "from-pink-200/80 to-rose-300/80",
  memory: "from-pink-200/80 to-rose-300/80",
  green: "from-emerald-200/80 to-lime-300/80",
  culture: "from-sky-200/80 to-indigo-300/80",
  rps: "from-amber-200/80 to-orange-300/80",
};

export function MinigamesMenu({ onPick, onBack }: Props) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Mini-jeux à la carte</p>
        <h1 className="mt-1 font-script text-4xl text-primary">Choisis un duel 🎮</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Le perdant tire un gage moyen 🟡
        </p>
      </div>

      <div className="mt-6 grid gap-3">
        {MINIGAME_IDS.map((id, i) => (
          <motion.button
            key={id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onPick(id)}
            className={`flex items-center gap-4 rounded-3xl border-2 border-white/60 bg-gradient-to-br ${GRADIENT[id]} p-4 text-left shadow-md backdrop-blur`}
          >
            <span className="text-4xl">{EMOJI[id]}</span>
            <div className="flex-1">
              <p className="font-script text-2xl text-primary-foreground/90 drop-shadow-sm">
                {MINIGAME_LABELS[id]}
              </p>
              <p className="text-xs text-foreground/80">{MINIGAME_DESCRIPTIONS[id]}</p>
            </div>
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
