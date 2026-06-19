import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import {
  MINIGAME_DESCRIPTIONS, MINIGAME_IDS, MINIGAME_LABELS, type MinigameId,
} from "@/lib/game-content";

type Props = { onPick: (id: MinigameId) => void; onBack: () => void };

const STYLE: Record<MinigameId, { bg: string; shadow: string; emoji: string }> = {
  memory:  { bg: "linear-gradient(145deg,#fbcfe8,#e88aab,#c45c7c)", shadow: "0 10px 28px rgba(196,92,124,0.28)", emoji: "💞" },
  green:   { bg: "linear-gradient(145deg,#bbf7d0,#22c55e,#15803d)", shadow: "0 10px 28px rgba(34,197,94,0.25)", emoji: "🚦" },
  culture: { bg: "linear-gradient(145deg,#bae6fd,#0ea5e9,#0369a1)", shadow: "0 10px 28px rgba(14,165,233,0.25)", emoji: "🧠" },
  rps:     { bg: "linear-gradient(145deg,#fed7aa,#f97316,#ea580c)", shadow: "0 10px 28px rgba(234,88,12,0.25)", emoji: "✌️" },
  p4:      { bg: "linear-gradient(145deg,#fecaca,#dc2626,#9f1239)", shadow: "0 10px 28px rgba(220,38,38,0.25)", emoji: "🔴" },
};

export function MinigamesMenu({ onPick, onBack }: Props) {
  return (
    <div className="flex flex-1 flex-col min-h-0">

      {/* Header */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="mb-4 flex items-center gap-3">
          <button onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-2xl transition active:scale-90"
            style={{ background: "rgba(255,255,255,0.80)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.85)", color: "oklch(0.52 0.08 358)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <ArrowLeft className="h-4 w-4"/>
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "oklch(0.58 0.08 358)" }}>✦ à la carte ✦</p>
            <h1 className="font-serif text-3xl leading-tight" style={{ color: "oklch(0.38 0.12 358)" }}>
              Choisis un <em>duel</em>
            </h1>
          </div>
        </div>
        <p className="rounded-2xl px-3 py-2 text-center text-xs font-medium"
          style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.80)", color: "oklch(0.55 0.08 358)" }}>
          Le perdant tire un gage <span style={{ color: "#f97316" }}>●</span>
        </p>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="grid grid-cols-2 gap-3">
          {MINIGAME_IDS.map((id, i) => {
            const s = STYLE[id];
            return (
              <motion.button
                key={id}
                initial={{ opacity: 0, y: 14, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.08, type: "spring", stiffness: 280, damping: 22 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onPick(id)}
                className="relative flex flex-col items-center justify-center overflow-hidden rounded-[22px] p-5 text-center transition"
                style={{ background: s.bg, boxShadow: s.shadow, minHeight: 130 }}>
                {/* Glass overlay */}
                <div className="absolute inset-0 rounded-[22px]" style={{ background: "linear-gradient(145deg,rgba(255,255,255,0.18),rgba(255,255,255,0.03))" }}/>
                {/* Orb */}
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full" style={{ background: "rgba(255,255,255,0.22)", filter: "blur(18px)" }}/>
                <span className="relative text-4xl drop-shadow-sm">{s.emoji}</span>
                <p className="relative mt-2.5 font-serif text-xl leading-tight text-white drop-shadow-sm">
                  {MINIGAME_LABELS[id]}
                </p>
                <p className="relative mt-1 text-[10px] font-medium text-white/70 line-clamp-2 px-1">
                  {MINIGAME_DESCRIPTIONS[id]}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
