import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";
import { GAGES_BY_LEVEL, getGagesPool, LEVEL_LABELS, type DareLevel } from "@/lib/game-content";
import { useGenerateAIContent, type AIMostLikely, type Ambiance } from "@/lib/use-ai-content";
import { markItemsUsed, nonRepeatingSample, pickNonRepeating } from "@/lib/non-repeating";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

const NB_QUESTIONS = 10;

const STATEMENTS: string[] = [
  "pleurer devant un film romantique 🥲",
  "envoyer un message coquin en pleine journée 😏",
  "oublier un anniversaire important 🙈",
  "prendre la dernière part de gâteau sans demander 🍰",
  "chanter sous la douche à tue-tête 🚿",
  "s'endormir le premier devant un film 😴",
  "rougir pour un compliment osé 😳",
  "faire une déclaration d'amour en public 💌",
  "prendre l'initiative au lit ce soir 🔥",
  "envoyer un selfie sexy au boulot 📸",
  "parler dans son sommeil 💤",
  "exploser de rire au mauvais moment 🤣",
  "perdre ses clés trois fois dans la semaine 🔑",
  "réserver un week-end surprise 🧳",
  "draguer l'autre devant ses amis 😘",
  "tenter une nouvelle position 😈",
  "faire la grasse matinée jusqu'à midi ☀️",
  "voler la couette pendant la nuit 🛏️",
  "préparer un petit-déj au lit 🥐",
  "regarder son téléphone pendant un câlin 📱",
  "tomber amoureux/se au premier regard 💘",
  "dire « je t'aime » en premier après une dispute 💕",
  "envoyer une photo coquine en story par erreur 😱",
  "embrasser l'autre en public sans prévenir 💋",
  "préférer rester au lit toute la journée ensemble 🛌",
  "faire l'amour dans un lieu insolite 🌳",
  "oser un strip-tease improvisé 🎭",
  "dévorer l'autre du regard sans s'en rendre compte 👀",
  "craquer le premier dans un défi sans se toucher ✋",
  "raconter un fantasme jamais avoué auparavant 🤫",
];

const LEVEL_CFG: Record<DareLevel, {
  emoji: string; desc: string;
  bg: string; accentHex: string; glow: string;
}> = {
  simple: {
    emoji: "🌿", desc: "Doux, tendre et mignon",
    bg: "linear-gradient(145deg, oklch(0.66 0.15 155), oklch(0.54 0.18 160))",
    accentHex: "#6ee7b7", glow: "rgba(110,231,183,0.35)",
  },
  medium: {
    emoji: "✨", desc: "Un peu piquant, osé mais fun",
    bg: "linear-gradient(145deg, oklch(0.75 0.16 65), oklch(0.62 0.20 50))",
    accentHex: "#fbbf24", glow: "rgba(251,191,36,0.35)",
  },
  ultra: {
    emoji: "🔥", desc: "Hot, sans tabou et enflammé",
    bg: "linear-gradient(145deg, oklch(0.62 0.22 25), oklch(0.50 0.24 12))",
    accentHex: "#f87171", glow: "rgba(248,113,113,0.4)",
  },
};

// Night violet palette shared across all levels
const NIGHT_BG = "linear-gradient(160deg, oklch(0.16 0.06 285) 0%, oklch(0.13 0.07 270) 100%)";
const PLAYER_COLORS: [string, string] = ["#c084fc", "#67e8f9"]; // violet, cyan

type MLState = {
  game?: "mostlikely";
  phase?: "level_select" | "loading" | "play" | "reveal" | "dare" | "done";
  level_1?: DareLevel | null;
  level_2?: DareLevel | null;
  level?: DareLevel | null;
  order?: number[];
  index?: number;
  vote_1?: 1 | 2 | null;
  vote_2?: 1 | 2 | null;
  designations?: { "1": number; "2": number };
  agreements?: number;
  winner_slot?: 0 | 1 | 2 | null;
  wheel_index?: number | null;
  dare_text?: string | null;
  ai_statements?: string[] | null;
};

type Props = {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
  onDareDone: () => void;
};

const update = (roomId: string, p: MLState) =>
  supabase.from("rooms").update({ minigame_state: p }).eq("id", roomId);

async function patch(roomId: string, partial: MLState) {
  const { data } = await supabase.from("rooms").select("minigame_state").eq("id", roomId).maybeSingle();
  const current = (data?.minigame_state ?? {}) as MLState;
  await update(roomId, { ...current, ...partial });
}

function freshReset(): MLState {
  return {
    game: "mostlikely", phase: "level_select",
    level_1: null, level_2: null, level: null,
    order: [], index: 0,
    vote_1: null, vote_2: null,
    designations: { "1": 0, "2": 0 },
    agreements: 0,
    winner_slot: null, wheel_index: null, dare_text: null,
  };
}

function Orb({ size, x, y, delay, color }: { size: number; x: string; y: string; delay: number; color: string }) {
  return (
    <motion.div className="pointer-events-none absolute rounded-full"
      style={{ width: size, height: size, left: x, top: y, background: color, filter: `blur(${size * 0.55}px)`, opacity: 0.38 }}
      animate={{ scale: [1, 1.2, 1], opacity: [0.28, 0.48, 0.28], y: [0, -14, 0] }}
      transition={{ duration: 6 + delay, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function MostLikely({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s = (room.minigame_state ?? {}) as MLState;
  const phase = s.phase ?? "level_select";

  useEffect(() => {
    if ((Object.keys(s).length === 0 || s.game !== "mostlikely") && mySlot === 1)
      void update(room.id, freshReset());
  }, [room.id, s, mySlot]);

  if (phase === "level_select")
    return <LevelSelect state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  if (phase === "loading") return <LoadingView />;
  if (phase === "play" || phase === "reveal")
    return <PlayView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  if (phase === "dare")
    return <DareView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onDareDone={onDareDone} />;
  return (
    <DoneView state={s} mySlot={mySlot} myName={myName} otherName={otherName}
      onReplay={async () => { await update(room.id, freshReset()); }}
      onBackToMenu={onBackToMenu}
    />
  );
}

// ─── Loading ─────────────────────────────────────────────────────────────────
function LoadingView() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center relative overflow-hidden"
      style={{ background: NIGHT_BG }}>
      <Orb size={160} x="5%" y="10%" delay={0} color="oklch(0.60 0.22 285)" />
      <Orb size={120} x="65%" y="55%" delay={2} color="oklch(0.55 0.18 200)" />
      <div className="relative z-10 flex flex-col items-center gap-5">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          className="text-6xl">🤔</motion.div>
        <div>
          <p style={{ fontFamily: "Cormorant Garamond, serif", color: "#e9d5ff" }} className="text-3xl font-semibold">
            L'IA invente vos affirmations…
          </p>
          <p className="mt-2 text-sm" style={{ color: "rgba(233,213,255,0.5)" }}>
            Une fournée fraîche rien que pour vous ✨
          </p>
        </div>
        <div className="flex gap-2 mt-1">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="w-2 h-2 rounded-full" style={{ background: "#c084fc" }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.3 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Level Select ─────────────────────────────────────────────────────────────
function LevelSelect({ state, room, mySlot, myName, otherName }:
  { state: MLState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const mine = mySlot === 1 ? state.level_1 : state.level_2;
  const theirs = mySlot === 1 ? state.level_2 : state.level_1;
  const both = state.level_1 && state.level_2;
  const match = both && state.level_1 === state.level_2;
  const generate = useGenerateAIContent();

  const choose = async (l: DareLevel) => {
    await patch(room.id, mySlot === 1 ? { level_1: l } : { level_2: l });
  };

  const start = async () => {
    if (!match || mySlot !== 1) return;
    const chosen = state.level_1 as DareLevel;
    const ambiance: Ambiance = chosen === "simple" ? "mignon" : chosen === "medium" ? "coquin" : "hot";
    await patch(room.id, { phase: "loading", level: chosen });
    const questionScope = `mostlikely:${chosen}`;
    const ai = await generate<AIMostLikely>("mostlikely", ambiance, NB_QUESTIONS * 3);
    const list = ai?.statements?.length ? nonRepeatingSample(ai.statements, NB_QUESTIONS, questionScope, (x) => x) : null;
    if (list) {
      markItemsUsed(questionScope, list, (x) => x);
      await patch(room.id, {
        phase: "play", level: chosen, ai_statements: list,
        order: list.map((_, i) => i), index: 0,
        vote_1: null, vote_2: null, designations: { "1": 0, "2": 0 }, agreements: 0,
      });
    } else {
      const picked = nonRepeatingSample(STATEMENTS, Math.min(NB_QUESTIONS, STATEMENTS.length), `${questionScope}:local`, (x) => x);
      markItemsUsed(`${questionScope}:local`, picked, (x) => x);
      const idxs = picked.map((s) => STATEMENTS.indexOf(s));
      await patch(room.id, {
        phase: "play", level: chosen, ai_statements: null,
        order: idxs, index: 0,
        vote_1: null, vote_2: null, designations: { "1": 0, "2": 0 }, agreements: 0,
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: NIGHT_BG }}>
      <Orb size={200} x="-8%" y="-5%" delay={0} color="oklch(0.60 0.24 285)" />
      <Orb size={140} x="65%" y="55%" delay={2.5} color="oklch(0.56 0.20 200)" />
      <Orb size={100} x="70%" y="5%" delay={1} color="oklch(0.62 0.18 310)" />

      <div className="relative z-10 flex flex-1 flex-col px-5 pt-8 pb-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "rgba(233,213,255,0.4)" }}>
            Qui est le plus susceptible de…
          </p>
          <h1 className="mt-2 text-5xl font-semibold leading-tight"
            style={{ fontFamily: "Cormorant Garamond, serif", color: "#e9d5ff" }}>
            Choisissez le niveau
          </h1>
          <p className="mt-2 text-sm" style={{ color: "rgba(233,213,255,0.38)" }}>
            Le niveau détermine l'intensité du gage final
          </p>
        </motion.div>

        {/* Level cards */}
        <div className="flex flex-col gap-4 flex-1">
          {(Object.keys(LEVEL_CFG) as DareLevel[]).map((l, i) => {
            const cfg = LEVEL_CFG[l];
            const iPicked = mine === l;
            const theyPicked = theirs === l;
            return (
              <motion.button key={l}
                initial={{ opacity: 0, x: i % 2 === 0 ? -28 : 28 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.12, duration: 0.45, ease: "easeOut" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => choose(l)}
                className="relative rounded-3xl overflow-hidden text-left flex-1"
                style={{
                  background: cfg.bg,
                  boxShadow: iPicked
                    ? `0 0 0 3px ${cfg.accentHex}, 0 12px 40px ${cfg.glow}`
                    : "0 6px 24px rgba(0,0,0,0.3)",
                  minHeight: 90,
                }}
              >
                {iPicked && (
                  <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ background: "rgba(255,255,255,0.10)" }} />
                )}
                <div className="relative z-10 p-5 flex items-center gap-4 h-full">
                  <motion.span className="text-4xl flex-shrink-0"
                    animate={iPicked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                    transition={{ duration: 0.4 }}>
                    {cfg.emoji}
                  </motion.span>
                  <div className="flex-1">
                    <p className="text-xl font-semibold"
                      style={{ fontFamily: "Cormorant Garamond, serif", color: "rgba(255,255,255,0.95)" }}>
                      {LEVEL_LABELS[l]}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>{cfg.desc}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {iPicked && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="text-[11px] font-semibold rounded-full px-2.5 py-0.5"
                          style={{ background: "rgba(255,255,255,0.25)", color: "white" }}>
                          Toi ✓
                        </motion.span>
                      )}
                      {theyPicked && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="text-[11px] font-semibold rounded-full px-2.5 py-0.5"
                          style={{ background: "rgba(255,255,255,0.25)", color: "white" }}>
                          {otherName} ✓
                        </motion.span>
                      )}
                    </div>
                  </div>
                  {iPicked && (
                    <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.3)" }}>
                      <span className="text-white text-sm font-bold">✓</span>
                    </motion.div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Status */}
        <motion.div className="mt-5 text-center text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
          {both && !match ? (
            <motion.p animate={{ scale: [1, 1.04, 1] }} transition={{ repeat: Infinity, duration: 2 }}
              style={{ color: "#c084fc" }}>
              Mettez-vous d'accord 😅
            </motion.p>
          ) : (
            <p style={{ color: "rgba(233,213,255,0.45)" }}>
              <span style={{ color: "rgba(233,213,255,0.8)" }}>{myName}</span>{" : "}
              {mine ? LEVEL_LABELS[mine] : "—"}{"  ·  "}
              <span style={{ color: "rgba(233,213,255,0.8)" }}>{otherName}</span>{" : "}
              {theirs ? LEVEL_LABELS[theirs] : "—"}
            </p>
          )}
        </motion.div>

        {/* CTA */}
        <motion.div className="mt-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
          <motion.button
            disabled={!match || mySlot !== 1}
            onClick={start}
            whileTap={match && mySlot === 1 ? { scale: 0.97 } : {}}
            className="w-full h-14 rounded-2xl text-base font-semibold relative overflow-hidden"
            style={{
              background: match
                ? "linear-gradient(135deg, oklch(0.65 0.24 285), oklch(0.55 0.20 260))"
                : "rgba(255,255,255,0.07)",
              color: match ? "white" : "rgba(255,255,255,0.28)",
              boxShadow: match ? "0 8px 28px rgba(160,80,240,0.35)" : "none",
              border: "1px solid rgba(255,255,255,0.1)",
            }}>
            {match && (
              <motion.div className="absolute inset-0"
                animate={{ x: ["100%", "-100%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}
              />
            )}
            <span className="relative z-10">
              {match ? (mySlot === 1 ? "C'est parti ! 💞" : `${otherName} va lancer…`) : "En attente du niveau commun…"}
            </span>
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Play / Reveal ─────────────────────────────────────────────────────────────
function PlayView({ state, room, mySlot, myName, otherName }:
  { state: MLState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const order = state.order ?? [];
  const idx = state.index ?? 0;
  const sIdx = order[idx];
  const bank: string[] = state.ai_statements?.length ? state.ai_statements : STATEMENTS;
  const statement = sIdx != null ? bank[sIdx] : null;

  const myVote = (mySlot === 1 ? state.vote_1 : state.vote_2) ?? null;
  const otherVote = (mySlot === 1 ? state.vote_2 : state.vote_1) ?? null;
  const bothVoted = !!state.vote_1 && !!state.vote_2;
  const same = bothVoted && state.vote_1 === state.vote_2;
  const total = order.length;
  const isLast = idx >= total - 1;
  const designations = state.designations ?? { "1": 0, "2": 0 };
  const agreements = state.agreements ?? 0;
  const reveal = state.phase === "reveal";

  // Names: slot 1 = name1, slot 2 = name2
  const name1 = mySlot === 1 ? myName : otherName;
  const name2 = mySlot === 2 ? myName : otherName;

  useEffect(() => {
    if (state.phase === "play" && bothVoted && mySlot === 1) {
      const nextDes = { ...designations };
      let nextAgree = agreements;
      if (same) {
        const designated = state.vote_1 as 1 | 2;
        nextDes[String(designated) as "1" | "2"] += 1;
        nextAgree += 1;
      }
      void patch(room.id, { phase: "reveal", designations: nextDes, agreements: nextAgree });
    }
  }, [state.phase, bothVoted, same, mySlot, room.id, designations, agreements, state.vote_1]);

  useEffect(() => {
    if (state.phase === "reveal" && same)
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
  }, [state.phase, same]);

  const vote = async (slot: 1 | 2) => {
    if (myVote) return;
    await patch(room.id, mySlot === 1 ? { vote_1: slot } : { vote_2: slot });
  };

  const next = async () => {
    if (mySlot !== 1) return;
    if (isLast) {
      const d = state.designations ?? { "1": 0, "2": 0 };
      let winner: 0 | 1 | 2 = 0;
      if (d["1"] > d["2"]) winner = 1;
      else if (d["2"] > d["1"]) winner = 2;
      else winner = 0;
      const level = (state.level ?? "simple") as DareLevel;
      const pool = (getGagesPool(room.ambiance, level) ?? GAGES_BY_LEVEL[level]) ?? [];
      const dareScope = `dare:mostlikely:${room.ambiance ?? "irl"}:${level}`;
      const selectedDare = pickNonRepeating(pool, dareScope, (x) => x);
      if (selectedDare) markItemsUsed(dareScope, [selectedDare], (x) => x);
      const wi = selectedDare ? pool.indexOf(selectedDare) : 0;
      await patch(room.id, { phase: "dare", winner_slot: winner, wheel_index: wi, dare_text: selectedDare ?? null });
    } else {
      await patch(room.id, { phase: "play", index: idx + 1, vote_1: null, vote_2: null });
    }
  };

  if (!statement) return null;

  const level = (state.level ?? "simple") as DareLevel;
  const cfg = LEVEL_CFG[level];

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: NIGHT_BG }}>
      <Orb size={180} x="-10%" y="0%" delay={0} color="oklch(0.60 0.24 285)" />
      <Orb size={130} x="65%" y="60%" delay={2.5} color="oklch(0.55 0.18 190)" />

      <div className="relative z-10 flex flex-1 flex-col px-5 pt-5 pb-6">
        {/* Progress header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)" }}>
            <span className="text-sm">{cfg.emoji}</span>
            <span className="text-xs font-medium" style={{ color: "rgba(233,213,255,0.6)" }}>
              {LEVEL_LABELS[level]}
            </span>
          </div>

          {/* Progress dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <motion.div key={i} className="h-1.5 rounded-full"
                style={{
                  width: i === idx ? 18 : 6,
                  background: i < idx ? cfg.accentHex : i === idx ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.18)",
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)" }}>
            <span className="text-xs" style={{ color: "rgba(233,213,255,0.5)" }}>🤝</span>
            <span className="text-xs font-bold" style={{ color: cfg.accentHex }}>{agreements}</span>
          </div>
        </div>

        {/* Statement card */}
        <AnimatePresence mode="wait">
          <motion.div key={`stmt-${idx}`}
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.38, ease: "easeOut" }}
            className="relative rounded-3xl p-6 mb-5 text-center"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.10)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}>
            <p className="text-[10px] uppercase tracking-[0.2em] mb-3" style={{ color: "rgba(233,213,255,0.4)" }}>
              Qui est le plus susceptible de…
            </p>
            <p className="text-2xl font-medium leading-snug"
              style={{ fontFamily: "Cormorant Garamond, serif", color: "#e9d5ff" }}>
              {statement}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Vote buttons — 2 players portrait cards */}
        <div className="grid grid-cols-2 gap-3 flex-1">
          {([1, 2] as const).map((slot) => {
            const label = slot === 1 ? name1 : name2;
            const color = PLAYER_COLORS[slot - 1];
            const iPicked = myVote === slot;
            const theyPicked = reveal && otherVote === slot;
            const isWrong = !!(myVote && !iPicked);

            return (
              <motion.button key={slot}
                whileTap={!myVote ? { scale: 0.95 } : {}}
                disabled={!!myVote}
                onClick={() => vote(slot)}
                animate={{ opacity: isWrong ? 0.4 : 1 }}
                className="relative rounded-3xl overflow-hidden flex flex-col items-center justify-center gap-3 py-6 px-3"
                style={{
                  background: `linear-gradient(160deg, ${color}22, ${color}11)`,
                  border: iPicked ? `2px solid ${color}` : "2px solid rgba(255,255,255,0.10)",
                  boxShadow: iPicked ? `0 0 0 2px ${color}55, 0 8px 28px ${color}30` : "0 4px 16px rgba(0,0,0,0.2)",
                  minHeight: 130,
                }}>
                {/* Glow background if selected */}
                {iPicked && (
                  <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ background: `radial-gradient(ellipse at center, ${color}20, transparent 70%)` }} />
                )}

                {/* Avatar initial */}
                <motion.div className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold"
                  style={{ background: `${color}30`, border: `2px solid ${color}60`, color }}
                  animate={iPicked ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                  transition={{ duration: 0.4 }}>
                  {label[0]?.toUpperCase()}
                </motion.div>

                <p className="relative z-10 text-lg font-semibold text-center"
                  style={{ fontFamily: "Cormorant Garamond, serif", color: "rgba(233,213,255,0.9)" }}>
                  {label}
                </p>

                {/* Score counter */}
                <div className="relative z-10 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ background: `${color}25`, color }}>
                  {designations[String(slot) as "1" | "2"]} désig.
                </div>

                {/* Badges */}
                <div className="relative z-10 flex flex-col gap-1 items-center">
                  {iPicked && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="text-[11px] font-semibold rounded-full px-2.5 py-0.5"
                      style={{ background: "rgba(255,255,255,0.18)", color: "white" }}>
                      Ton vote ✓
                    </motion.span>
                  )}
                  {theyPicked && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1 }}
                      className="text-[11px] font-semibold rounded-full px-2.5 py-0.5"
                      style={{ background: "rgba(255,255,255,0.18)", color: "white" }}>
                      {otherName} vote ✓
                    </motion.span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Status zone */}
        <div className="mt-4 min-h-[56px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            {!myVote && (
              <motion.p key="pick" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-sm" style={{ color: "rgba(233,213,255,0.4)" }}>
                Vote en secret 🤫
              </motion.p>
            )}
            {myVote && !reveal && (
              <motion.div key="wait" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full"
                style={{ background: "rgba(255,255,255,0.08)" }}>
                <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.4 }}>👀</motion.span>
                <p className="text-sm" style={{ color: "rgba(233,213,255,0.5)" }}>{otherName} vote…</p>
              </motion.div>
            )}
            {reveal && same && (
              <motion.div key="agree" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                className="text-center">
                <p className="text-2xl font-semibold"
                  style={{ fontFamily: "Cormorant Garamond, serif", color: cfg.accentHex }}>
                  D'accord ! 💕 +1 désig.
                </p>
              </motion.div>
            )}
            {reveal && !same && (
              <motion.div key="diff" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-center">
                <p className="text-2xl font-semibold"
                  style={{ fontFamily: "Cormorant Garamond, serif", color: "rgba(233,213,255,0.6)" }}>
                  Pas d'accord 😏
                </p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(233,213,255,0.35)" }}>Aucune désignation</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Next button */}
        {reveal && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mt-2">
            {mySlot === 1 ? (
              <motion.button whileTap={{ scale: 0.97 }} onClick={next}
                className="w-full h-14 rounded-2xl text-base font-semibold relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, oklch(0.65 0.24 285), oklch(0.55 0.20 260))",
                  color: "white", boxShadow: "0 8px 28px rgba(130,50,220,0.3)",
                }}>
                <motion.div className="absolute inset-0"
                  animate={{ x: ["100%", "-100%"] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }} />
                <span className="relative z-10">{isLast ? "Voir le verdict 🏆" : "Affirmation suivante →"}</span>
              </motion.button>
            ) : (
              <div className="w-full h-12 rounded-2xl flex items-center justify-center text-sm"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(233,213,255,0.35)" }}>
                {otherName} enchaîne…
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Dare View ────────────────────────────────────────────────────────────────
function DareView({ state, room, mySlot, myName, otherName, onDareDone }: {
  state: MLState; room: Room; mySlot: number; myName: string; otherName: string; onDareDone: () => void;
}) {
  const winner = state.winner_slot ?? 0;
  const dare = state.dare_text ?? "Un câlin tout doux 🤗";
  const designations = state.designations ?? { "1": 0, "2": 0 };
  const name1 = mySlot === 1 ? myName : otherName;
  const name2 = mySlot === 2 ? myName : otherName;
  const level = (state.level ?? "simple") as DareLevel;
  const cfg = LEVEL_CFG[level];

  useEffect(() => {
    if (winner !== 0) confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  }, [winner]);

  // Égalité
  if (winner === 0) {
    return (
      <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: NIGHT_BG }}>
        <Orb size={180} x="-5%" y="10%" delay={0} color="oklch(0.60 0.24 285)" />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center px-6">
          <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200 }} className="text-7xl mb-4">🤝</motion.div>
          <h2 className="text-4xl font-semibold" style={{ fontFamily: "Cormorant Garamond, serif", color: "#e9d5ff" }}>
            Égalité parfaite 💕
          </h2>
          <p className="mt-3 text-sm" style={{ color: "rgba(233,213,255,0.5)" }}>
            {name1} {designations["1"]} · {name2} {designations["2"]} — pas de gage cette fois !
          </p>
          <div className="mt-auto w-full pt-8">
            {mySlot === 1 ? (
              <motion.button whileTap={{ scale: 0.97 }} onClick={async () => { await update(room.id, freshReset()); }}
                className="w-full h-14 rounded-2xl text-base font-semibold relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, oklch(0.65 0.24 285), oklch(0.55 0.20 260))",
                  color: "white", boxShadow: "0 8px 28px rgba(130,50,220,0.3)",
                }}>
                <span>Rejouer 🔁</span>
              </motion.button>
            ) : (
              <p className="text-sm text-center" style={{ color: "rgba(233,213,255,0.4)" }}>{otherName} relance…</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const iLost = mySlot === winner;
  const winnerName = winner === 1 ? name1 : name2;
  const winnerCount = designations[String(winner) as "1" | "2"];

  const validate = async () => {
    onDareDone();
    await patch(room.id, { phase: "done" });
  };

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: NIGHT_BG }}>
      <Orb size={200} x="-10%" y="-5%" delay={0} color={`${cfg.accentHex}66`} />
      <Orb size={150} x="60%" y="55%" delay={2} color="oklch(0.60 0.24 285)" />

      <div className="relative z-10 flex flex-1 flex-col items-center px-6 pt-8 pb-6">
        {/* Winner badge */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="px-5 py-2 rounded-full text-sm font-semibold mb-6"
          style={{ background: `${cfg.accentHex}25`, color: cfg.accentHex, border: `1px solid ${cfg.accentHex}50` }}>
          👑 {winnerName} désigné(e) {winnerCount}× — c'est lui/elle !
        </motion.div>

        {/* Gift icon */}
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.2 }}
          className="text-7xl mb-4">
          🎁
        </motion.div>

        {/* Context */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-sm mb-3" style={{ color: "rgba(233,213,255,0.5)" }}>
          {iLost ? "Ton gage du soir 👇" : `Le gage de ${winnerName} 👇`}
        </motion.p>

        {/* Dare card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 140 }}
          className="w-full rounded-3xl p-7 text-center"
          style={{
            background: `linear-gradient(145deg, ${cfg.accentHex}18, ${cfg.accentHex}08)`,
            border: `1.5px solid ${cfg.accentHex}40`,
            boxShadow: `0 0 40px ${cfg.accentHex}20, 0 16px 48px rgba(0,0,0,0.25)`,
          }}>
          <p className="text-2xl font-medium leading-snug"
            style={{ fontFamily: "Cormorant Garamond, serif", color: "#e9d5ff" }}>
            {dare}
          </p>
        </motion.div>

        {/* Action */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
          className="mt-auto w-full pt-8">
          {iLost ? (
            <motion.button whileTap={{ scale: 0.97 }} onClick={validate}
              className="w-full h-14 rounded-2xl text-base font-semibold relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${cfg.accentHex}, ${cfg.accentHex}bb)`,
                color: "white", boxShadow: `0 8px 28px ${cfg.glow}`,
              }}>
              <motion.div className="absolute inset-0"
                animate={{ x: ["100%", "-100%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)" }} />
              <span className="relative z-10">C'est fait ! ✅</span>
            </motion.button>
          ) : (
            <div className="w-full h-14 rounded-2xl flex items-center justify-center text-sm"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(233,213,255,0.4)" }}>
              On attend que {winnerName} fasse son gage… 🥹
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Done ─────────────────────────────────────────────────────────────────────
function DoneView({ state, mySlot, myName, otherName, onReplay, onBackToMenu }: {
  state: MLState; mySlot: number; myName: string; otherName: string; onReplay: () => void; onBackToMenu: () => void;
}) {
  const winner = state.winner_slot ?? 0;
  const iWon = winner !== 0 && mySlot !== winner;
  const designations = state.designations ?? { "1": 0, "2": 0 };
  const agreements = state.agreements ?? 0;
  const total = state.order?.length ?? 0;
  const name1 = mySlot === 1 ? myName : otherName;
  const name2 = mySlot === 2 ? myName : otherName;
  const level = (state.level ?? "simple") as DareLevel;
  const cfg = LEVEL_CFG[level];

  const verdict = useMemo(() => {
    if (winner === 0) return "Égalité parfaite 🤝";
    const winnerName = winner === 1 ? name1 : name2;
    return `${winnerName} a été le plus désigné(e) 👑`;
  }, [winner, name1, name2]);

  useEffect(() => {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }, []);

  const d1 = designations["1"];
  const d2 = designations["2"];
  const maxD = Math.max(d1, d2, 1);

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: NIGHT_BG }}>
      <Orb size={200} x="-8%" y="-5%" delay={0} color="oklch(0.60 0.24 285)" />
      <Orb size={140} x="62%" y="55%" delay={2} color="oklch(0.55 0.18 190)" />

      <div className="relative z-10 flex flex-1 flex-col items-center px-6 pt-8 pb-6 text-center">
        {/* Trophy */}
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
          className="text-7xl mb-2">
          {iWon ? "💖" : "🏆"}
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="text-4xl font-semibold mt-2 px-4"
          style={{ fontFamily: "Cormorant Garamond, serif", color: "#e9d5ff" }}>
          {verdict}
        </motion.h2>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-2 text-sm" style={{ color: "rgba(233,213,255,0.45)" }}>
          Vous étiez d'accord {agreements} fois sur {total} 💞
        </motion.p>

        {/* Comparison bars */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="mt-8 w-full space-y-4">
          {([1, 2] as const).map((slot) => {
            const label = slot === 1 ? name1 : name2;
            const count = designations[String(slot) as "1" | "2"];
            const color = PLAYER_COLORS[slot - 1];
            const barW = `${Math.round((count / maxD) * 100)}%`;
            const isWinner = winner === slot;
            return (
              <div key={slot} className="text-left">
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "rgba(233,213,255,0.8)" }}>
                    {isWinner && <span>👑</span>}{label}
                  </p>
                  <span className="text-sm font-bold" style={{ color }}>{count} désig.</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <motion.div className="h-full rounded-full"
                    style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                    initial={{ width: 0 }} animate={{ width: barW }}
                    transition={{ delay: 0.7 + (slot - 1) * 0.1, duration: 0.9, ease: "easeOut" }} />
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Buttons */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
          className="mt-auto w-full space-y-3 pt-8">
          <motion.button whileTap={{ scale: 0.97 }} onClick={onReplay}
            className="w-full h-14 rounded-2xl text-base font-semibold relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, oklch(0.65 0.24 285), oklch(0.55 0.20 260))",
              color: "white", boxShadow: "0 8px 28px rgba(130,50,220,0.3)",
            }}>
            <motion.div className="absolute inset-0"
              animate={{ x: ["100%", "-100%"] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }} />
            <span className="relative z-10">Rejouer 🔁</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={onBackToMenu}
            className="w-full h-12 rounded-2xl text-sm font-medium"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(233,213,255,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
            ← Retour au menu
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
