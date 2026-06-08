import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { Ambiance } from "@/lib/game-content";

type Props = {
  roomId: string;
  ambiance: Ambiance | null | undefined;
};

const OPTIONS: { id: Ambiance; emoji: string; title: string; subtitle: string; grad: string; ring: string }[] = [
  {
    id: "irl",
    emoji: "💞",
    title: "En vrai",
    subtitle: "On est ensemble — gages présentiels",
    grad: "from-rose-200/90 via-pink-200/80 to-amber-100/70",
    ring: "ring-rose-300/70",
  },
  {
    id: "distance",
    emoji: "🌙",
    title: "À distance",
    subtitle: "Chacun de son côté — photos, vocaux…",
    grad: "from-indigo-300/80 via-violet-300/70 to-amber-200/60",
    ring: "ring-indigo-300/70",
  },
];

export function AmbianceSelector({ roomId, ambiance }: Props) {
  const current: Ambiance = ambiance === "distance" ? "distance" : "irl";

  const pick = async (id: Ambiance) => {
    if (id === current) return;
    await supabase.from("rooms").update({ ambiance: id }).eq("id", roomId);
  };

  return (
    <div className="mt-5">
      <p className="text-center text-[10px] uppercase tracking-[0.3em] text-primary/70">
        ✦ notre ambiance ✦
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        {OPTIONS.map((o) => {
          const active = current === o.id;
          return (
            <motion.button
              key={o.id}
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -2 }}
              onClick={() => pick(o.id)}
              className={`group relative overflow-hidden rounded-2xl border bg-white/55 p-3 text-left shadow-[0_8px_24px_-15px_rgba(0,0,0,0.25)] backdrop-blur-xl transition
                ${active ? `border-white ring-2 ${o.ring}` : "border-white/60"}`}
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${o.grad} ${active ? "opacity-80" : "opacity-40"} transition-opacity duration-500`} />
              <div className="relative flex items-center gap-2">
                <span className="text-2xl drop-shadow-sm">{o.emoji}</span>
                <div className="min-w-0">
                  <p className="font-serif text-base leading-tight text-foreground">{o.title}</p>
                  <p className="text-[10px] leading-snug text-foreground/70 line-clamp-2">{o.subtitle}</p>
                </div>
              </div>
              {active && (
                <span className="absolute right-2 top-2 rounded-full bg-white/85 px-1.5 py-0.5 text-[9px] font-semibold text-primary shadow-sm">
                  actif
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export function AmbianceBadge({ ambiance }: { ambiance: Ambiance | null | undefined }) {
  const amb: Ambiance = ambiance === "distance" ? "distance" : "irl";
  const label = amb === "distance" ? "🌙 À distance" : "💞 En vrai";
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/70 px-2.5 py-0.5 text-[10px] font-semibold text-primary backdrop-blur">
      {label}
    </span>
  );
}
