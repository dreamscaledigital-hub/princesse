import { motion } from "framer-motion";
import { COMPLICITY_MAX } from "@/lib/game-content";

export function ComplicityBar({
  value,
  name1,
  name2,
}: {
  value: number;
  name1: string;
  name2: string;
}) {
  const pct = Math.min(100, Math.round((value / COMPLICITY_MAX) * 100));
  return (
    <div className="mb-4 rounded-2xl bg-card/70 p-3 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>💞 Complicité</span>
        <motion.span
          key={pct}
          initial={{ scale: 0.8, color: "var(--primary)" }}
          animate={{ scale: 1, color: "var(--muted-foreground)" }}
          className="font-mono"
        >
          {pct}%
        </motion.span>
      </div>
      <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-secondary/40">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-pink-300 via-rose-400 to-emerald-300"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 18 }}
        />
        {/* Avatars on the path */}
        <motion.div
          className="pointer-events-none absolute -top-1 text-base"
          initial={false}
          animate={{ left: `calc(${Math.min(pct, 95)}% - 8px)` }}
          transition={{ type: "spring", stiffness: 100, damping: 18 }}
          aria-hidden
        >
          👩‍🦰
        </motion.div>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>👨 {name1}</span>
        <span>{name2} 👩</span>
      </div>
    </div>
  );
}
