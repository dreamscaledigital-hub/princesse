import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ─── Catégories & défis ────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "bisou",    emoji: "💋", label: "Bisou",       color: "#f472b6", bg: "from-pink-400 to-rose-500" },
  { id: "douceur",  emoji: "💆", label: "Douceur",     color: "#a78bfa", bg: "from-violet-400 to-purple-500" },
  { id: "imitation",emoji: "🎤", label: "Imitation",   color: "#fb923c", bg: "from-orange-400 to-amber-500" },
  { id: "question", emoji: "🤔", label: "Question",    color: "#34d399", bg: "from-emerald-400 to-teal-500" },
  { id: "physique", emoji: "💪", label: "Défi physique",color: "#60a5fa", bg: "from-blue-400 to-sky-500" },
  { id: "scene",    emoji: "🎭", label: "Mise en scène",color: "#fbbf24", bg: "from-yellow-400 to-amber-500" },
  { id: "surprise", emoji: "🎁", label: "Surprise",    color: "#f87171", bg: "from-red-400 to-rose-500" },
  { id: "double",   emoji: "🎲", label: "Double gage", color: "#818cf8", bg: "from-indigo-400 to-violet-500" },
] as const;

type CategoryId = typeof CATEGORIES[number]["id"];

const CHALLENGES: Record<CategoryId, string[]> = {
  bisou: [
    "Un bisou de 10 secondes sur le cou 😍",
    "Un bisou surprise dans les 30 prochaines secondes ⏱️",
    "Un bisou esquimau — nez contre nez 🥰",
    "Un bisou dans la paume de la main 💕",
    "Un bisou là où l'autre décide 😘",
    "Un bisou les yeux fermés tous les deux 🌙",
  ],
  douceur: [
    "Massage des épaules pendant 2 minutes 💆",
    "Caresse les cheveux pendant 1 minute 🌸",
    "Dessine des formes doucement dans le dos 🖊️",
    "Massage des mains avec tout le soin du monde 🤲",
    "Frotte tendrement le front de l'autre 🌙",
    "Chatouilles ultradouces pendant 30 secondes 😄",
  ],
  imitation: [
    "Imite la façon de marcher de l'autre 🚶",
    "Imite 3 expressions favorites de l'autre 😄",
    "Chante une chanson avec la voix de l'autre 🎵",
    "Imite comment l'autre mange 🍽️",
    "Fais la danse signature de l'autre 💃",
    "Imite comment l'autre dit 'je t'aime' 💕",
  ],
  question: [
    "Quel est le souvenir le plus tendre qu'on partage ? 💞",
    "Qu'est-ce que tu préfères chez moi physiquement ? 👀",
    "Quel moment précis a changé notre relation ?",
    "Qu'est-ce que tu voudrais qu'on fasse plus souvent ? 🌟",
    "Qu'est-ce qui t'a fait tomber amoureux·se de moi ? 🥹",
    "Si tu pouvais changer une chose de notre relation, ce serait quoi ?",
    "Quel est ton rêve secret que tu ne m'as pas encore dit ? 🌠",
    "Quelle est la chose la plus courageuse que tu aies faite pour moi ? 💪",
  ],
  physique: [
    "20 squats maintenant — top chrono 💪",
    "Tiens l'équilibre sur un pied pendant 30 secondes 🦩",
    "10 pompes devant l'autre 😤",
    "Danse sans musique pendant 1 minute entière 🕺",
    "Tiens la planche 30 secondes 😮‍💨",
    "Fais le poirier (ou tente-le) 🤸",
  ],
  scene: [
    "Rejoue le moment où on s'est rencontrés 🎬",
    "Improvise une déclaration d'amour de 30 secondes 💝",
    "Fais une pub pour l'autre en 1 minute 📺",
    "Raconte notre histoire comme un conte de fées 📖",
    "Crée un slogan pour notre couple en 30 secondes 🏆",
    "Imite un couple célèbre pendant 2 minutes 🎭",
  ],
  surprise: [
    "Prépare une vraie surprise dans les 24h 🎁",
    "Écris un message doux à garder précieusement 💌",
    "Prends la plus belle photo de l'autre là maintenant 📸",
    "Déclare 'notre chanson' pour ce soir 🎵",
    "Invente un surnom mignon tout neuf 🍓",
    "Planifie un mini rendez-vous pour cette semaine 📅",
  ],
  double: [
    "Retourne la roue… et accomplis le défi en DOUBLE 🎲🎲",
    "L'autre choisit librement ton prochain défi 😈",
    "Accomplis le prochain défi les yeux bandés 🙈",
    "Le prochain défi dure 2x plus longtemps ⏰",
    "Vous faites le défi ENSEMBLE tous les deux 👫",
    "Tire 2 défis Bisou et accomplis les deux 💋💋",
  ],
};

const N = CATEGORIES.length; // 8
const SEG_DEG = 360 / N;     // 45°
const TOTAL_ROUNDS = 6;

// ─── State ─────────────────────────────────────────────────────────────────

type WheelState = {
  phase?: "idle" | "spinning" | "challenge" | "result" | "game_over";
  turn?: 1 | 2;
  round?: number;
  total_rotation?: number;    // accumulated wheel rotation (degrees)
  category_idx?: number;      // 0-7
  challenge?: string;
  scores?: [number, number];
  skips?: [number, number];
};

type Props = {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
  onDareDone: () => void;
};

// ─── SVG Wheel ─────────────────────────────────────────────────────────────

function WheelSVG({ rotation }: { rotation: number }) {
  const cx = 150, cy = 150, r = 138;

  function segPath(i: number) {
    const startRad = ((i * SEG_DEG) - 90) * (Math.PI / 180);
    const endRad   = (((i + 1) * SEG_DEG) - 90) * (Math.PI / 180);
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
  }

  function textPos(i: number) {
    const midRad = ((i * SEG_DEG) + SEG_DEG / 2 - 90) * (Math.PI / 180);
    return {
      x: cx + r * 0.62 * Math.cos(midRad),
      y: cy + r * 0.62 * Math.sin(midRad),
      rot: i * SEG_DEG + SEG_DEG / 2,
    };
  }

  return (
    <motion.div
      animate={{ rotate: rotation }}
      transition={{ duration: 0, ease: "linear" }}
      style={{ display: "inline-block", width: "100%", maxWidth: 300 }}
    >
      <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.25" />
          </filter>
        </defs>
        {CATEGORIES.map((cat, i) => {
          const { x, y, rot } = textPos(i);
          return (
            <g key={cat.id} filter="url(#shadow)">
              <path d={segPath(i)} fill={cat.color} stroke="white" strokeWidth="2.5" />
              <text
                x={x.toFixed(2)} y={y.toFixed(2)}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="22"
                transform={`rotate(${rot}, ${x.toFixed(2)}, ${y.toFixed(2)})`}
                style={{ userSelect: "none" }}
              >
                {cat.emoji}
              </text>
            </g>
          );
        })}
        {/* Inner ring */}
        <circle cx={cx} cy={cy} r="30" fill="white" stroke="#e88aab" strokeWidth="3" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="22">🎡</text>
      </svg>
    </motion.div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function WheelGame({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const raw = (room.minigame_state ?? {}) as WheelState;
  const phase        = raw.phase ?? "idle";
  const turn         = raw.turn ?? 1;
  const round        = raw.round ?? 1;
  const totalRot     = raw.total_rotation ?? 0;
  const catIdx       = raw.category_idx ?? 0;
  const challenge    = raw.challenge ?? "";
  const scores       = raw.scores ?? [0, 0];
  const skips        = raw.skips ?? [0, 0];

  const isHost  = mySlot === 1;
  const isMyTurn = turn === mySlot;
  const myScore  = scores[mySlot - 1];
  const otherScore = scores[mySlot === 1 ? 1 : 0];
  const mySkips  = skips[mySlot - 1];

  // Local animated rotation — synced to totalRot but animated smoothly
  const [displayRot, setDisplayRot] = useState(totalRot);
  const [spinning, setSpinning] = useState(false);
  const prevTotalRot = useRef(totalRot);
  const confettiFired = useRef(false);

  // Init
  useEffect(() => {
    if (!isHost) return;
    if (!raw.phase) {
      void supabase.from("rooms").update({
        minigame_state: {
          phase: "idle", turn: 1, round: 1,
          total_rotation: 0, scores: [0, 0], skips: [0, 0],
        } as WheelState,
      }).eq("id", room.id);
    }
  }, [isHost, room.id, raw.phase]);

  // Animate wheel when totalRot changes
  useEffect(() => {
    if (totalRot !== prevTotalRot.current) {
      setSpinning(true);
      setDisplayRot(totalRot);
      const timer = setTimeout(() => setSpinning(false), 4200);
      prevTotalRot.current = totalRot;
      return () => clearTimeout(timer);
    }
  }, [totalRot]);

  // Confetti on game over
  useEffect(() => {
    if (phase === "game_over" && !confettiFired.current) {
      confettiFired.current = true;
      void confetti({ particleCount: 150, spread: 80, origin: { y: 0.5 }, colors: ["#f472b6", "#a78bfa", "#34d399", "#fbbf24"] });
    }
  }, [phase]);

  // ── Actions ──

  async function spin() {
    if (!isMyTurn || phase !== "idle" || spinning) return;

    // Pick random category & challenge
    const idx = Math.floor(Math.random() * N);
    const cat = CATEGORIES[idx];
    const challenges = CHALLENGES[cat.id];
    const ch = challenges[Math.floor(Math.random() * challenges.length)];

    // Calculate rotation to land on idx
    // At rotation 0: segment 0 is at top. Rotating clockwise by k*45° brings segment (N - k % N) % N to top.
    // To land on segment idx: need k such that (N - k % N) % N === idx → k = (N - idx) % N
    const baseOffset = ((N - idx) % N) * SEG_DEG;
    const extraRandom = (Math.random() - 0.5) * 20; // ±10° within segment
    const newTotal = totalRot + 5 * 360 + baseOffset + extraRandom;

    await supabase.from("rooms").update({
      minigame_state: {
        ...raw,
        phase: "spinning",
        total_rotation: newTotal,
        category_idx: idx,
        challenge: ch,
      } as WheelState,
    }).eq("id", room.id);

    // After spin animation (4s), show challenge
    setTimeout(async () => {
      await supabase.from("rooms").update({
        minigame_state: {
          ...raw,
          phase: "challenge",
          total_rotation: newTotal,
          category_idx: idx,
          challenge: ch,
        } as WheelState,
      }).eq("id", room.id);
    }, 4200);
  }

  async function markDone(skipped: boolean) {
    const newScores: [number, number] = [...scores] as [number, number];
    const newSkips: [number, number] = [...skips] as [number, number];
    const otherIdx = mySlot === 1 ? 1 : 0;

    if (!skipped) {
      const isDouble = CATEGORIES[catIdx].id === "double";
      newScores[mySlot - 1] += isDouble ? 20 : 10;
    } else {
      newSkips[mySlot - 1] += 1;
      newScores[otherIdx] += 5; // bonus partenaire si on passe
    }

    const nextRound = round + 1;
    const nextTurn: 1 | 2 = turn === 1 ? 2 : 1;

    if (nextRound > TOTAL_ROUNDS) {
      await supabase.from("rooms").update({
        minigame_state: {
          ...raw, phase: "game_over", scores: newScores, skips: newSkips,
        } as WheelState,
      }).eq("id", room.id);
    } else {
      await supabase.from("rooms").update({
        minigame_state: {
          ...raw, phase: "idle", turn: nextTurn, round: nextRound,
          scores: newScores, skips: newSkips,
        } as WheelState,
      }).eq("id", room.id);
    }
  }

  async function restart() {
    if (!isHost) return;
    confettiFired.current = false;
    await supabase.from("rooms").update({
      minigame_state: {
        phase: "idle", turn: 1, round: 1,
        total_rotation: displayRot, // keep visual position
        scores: [0, 0], skips: [0, 0],
      } as WheelState,
    }).eq("id", room.id);
  }

  const cat = CATEGORIES[catIdx];

  // ── Render ──

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-fuchsia-50 via-rose-50 to-pink-50 px-4 pb-8 pt-6">

      {/* Header */}
      <div className="mb-4 flex w-full max-w-sm items-center justify-between">
        <button onClick={onBackToMenu} className="text-xs text-muted-foreground hover:text-foreground">← Menu</button>
        <h2 className="font-serif text-2xl text-primary">La Roue des Défis</h2>
        <div className="w-12" />
      </div>

      {/* Scoreboard */}
      <div className="mb-5 flex w-full max-w-sm items-center justify-between rounded-2xl bg-white/70 px-5 py-3 shadow-sm backdrop-blur">
        <div className="text-center">
          <p className="text-xl font-bold text-primary">{mySlot === 1 ? scores[0] : scores[1]}</p>
          <p className="text-xs text-muted-foreground">{myName}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Round</p>
          <p className="text-base font-bold text-foreground">{Math.min(round, TOTAL_ROUNDS)}/{TOTAL_ROUNDS}</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-primary">{mySlot === 2 ? scores[0] : scores[1]}</p>
          <p className="text-xs text-muted-foreground">{otherName}</p>
        </div>
      </div>

      {/* Wheel + pointer */}
      <div className="relative w-full max-w-[300px]">
        {/* Pointer triangle */}
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1">
          <div className="h-0 w-0 border-l-[10px] border-r-[10px] border-t-[22px] border-l-transparent border-r-transparent border-t-rose-500 drop-shadow-md" />
        </div>

        {/* Wheel */}
        <motion.div
          animate={{ rotate: displayRot }}
          transition={spinning ? { duration: 4, ease: [0.15, 0.85, 0.35, 1.0] } : { duration: 0 }}
          style={{ willChange: "transform" }}
        >
          <WheelSVG rotation={0} />
        </motion.div>
      </div>

      {/* Category labels ring */}
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {CATEGORIES.map((c, i) => (
          <span
            key={c.id}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold text-white transition-all duration-300 ${
              phase !== "idle" && i === catIdx && !spinning
                ? "scale-110 ring-2 ring-white shadow-lg"
                : "opacity-70"
            }`}
            style={{ backgroundColor: c.color }}
          >
            {c.emoji} {c.label}
          </span>
        ))}
      </div>

      {/* Action zone */}
      <div className="mt-6 w-full max-w-sm">
        <AnimatePresence mode="wait">

          {/* IDLE — bouton spin */}
          {phase === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {isMyTurn ? (
                <motion.button
                  onClick={spin}
                  disabled={spinning}
                  whileTap={{ scale: 0.95 }}
                  className="w-full rounded-3xl bg-gradient-to-r from-fuchsia-500 to-rose-500 py-5 text-lg font-bold text-white shadow-xl"
                >
                  🎡 Faire tourner !
                </motion.button>
              ) : (
                <div className="rounded-3xl bg-white/60 py-5 text-center text-sm font-medium text-muted-foreground backdrop-blur">
                  C'est au tour de <span className="font-bold text-primary">{otherName}</span>…
                </div>
              )}
            </motion.div>
          )}

          {/* SPINNING */}
          {phase === "spinning" && (
            <motion.div key="spinning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-3xl bg-white/60 py-6 text-center backdrop-blur">
              <p className="text-2xl">🌀</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">La roue tourne…</p>
            </motion.div>
          )}

          {/* CHALLENGE */}
          {phase === "challenge" && (
            <motion.div key="challenge"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              className={`overflow-hidden rounded-3xl bg-gradient-to-br ${cat.bg} p-5 text-white shadow-2xl`}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="text-3xl">{cat.emoji}</span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{cat.label}</p>
                  <p className="font-serif text-xl">
                    {turn === mySlot ? "Ton défi !" : `Défi de ${otherName}`}
                  </p>
                </div>
              </div>

              <p className="mb-5 text-base font-medium leading-snug">"{challenge}"</p>

              {isMyTurn ? (
                <div className="flex gap-2">
                  <Button onClick={() => markDone(false)}
                    className="flex-1 rounded-2xl bg-white/25 text-white backdrop-blur hover:bg-white/35">
                    ✅ Accompli !
                  </Button>
                  {mySkips < 1 && (
                    <Button onClick={() => markDone(true)} variant="ghost"
                      className="rounded-2xl text-white/80 hover:bg-white/20 hover:text-white">
                      😅 Passer
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl bg-white/20 py-3 text-center text-sm">
                  En attente de {otherName}…
                </div>
              )}
            </motion.div>
          )}

          {/* GAME OVER */}
          {phase === "game_over" && (
            <motion.div key="gameover"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="overflow-hidden rounded-3xl bg-white/80 p-6 text-center shadow-2xl backdrop-blur"
            >
              {(() => {
                const myFinalScore = scores[mySlot - 1];
                const otherFinalScore = scores[mySlot === 1 ? 1 : 0];
                const won = myFinalScore > otherFinalScore;
                const draw = myFinalScore === otherFinalScore;
                return (
                  <>
                    <p className="mb-1 text-4xl">{draw ? "🤝" : won ? "🎉" : "😅"}</p>
                    <p className="font-serif text-2xl text-primary">
                      {draw ? "Égalité parfaite !" : won ? "Tu gagnes !" : `${otherName} gagne !`}
                    </p>
                    <div className="my-4 flex justify-center gap-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-primary">{myFinalScore}</p>
                        <p className="text-xs text-muted-foreground">{myName}</p>
                      </div>
                      <div className="text-muted-foreground self-center">vs</div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-primary">{otherFinalScore}</p>
                        <p className="text-xs text-muted-foreground">{otherName}</p>
                      </div>
                    </div>
                    {!won && !draw && (
                      <p className="mb-4 text-sm text-muted-foreground">
                        Le score parle… tu dois un dernier défi 😉
                      </p>
                    )}
                    <div className="flex gap-2">
                      {isHost && (
                        <Button onClick={restart} variant="outline" className="flex-1 rounded-2xl">
                          Rejouer 🔄
                        </Button>
                      )}
                      <Button onClick={onBackToMenu} variant="ghost" className="flex-1 rounded-2xl">
                        Menu
                      </Button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
