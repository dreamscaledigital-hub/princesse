import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";
import { GAGES_BY_LEVEL, getGagesPool, LEVEL_LABELS, type DareLevel } from "@/lib/game-content";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ─────────── RÉGLAGES ───────────
const LOGICAL_W = 300;              // largeur logique de l'arène
const BLOCK_H = 22;                 // hauteur d'un bloc (px)
const START_W = 180;                // largeur du bloc de départ
const PERFECT_TOL = 4;              // tolérance "Parfait !" (unités logiques)
const PERFECT_BONUS = 6;            // largeur regagnée si parfait
const BASE_SPEED = 110;             // px/s au premier bloc
const SPEED_STEP = 7;               // accélération par bloc
const MAX_SPEED = 360;
const COUNTDOWN_S = 3;
const BROADCAST_HZ = 6;

const LEVEL_INFO: Record<DareLevel, { emoji: string; gradient: string; desc: string; speedMult: number }> = {
  simple: { emoji: "🟢", gradient: "from-emerald-200 to-teal-200", desc: "Vitesse douce", speedMult: 0.85 },
  medium: { emoji: "🟡", gradient: "from-amber-200 to-orange-300", desc: "Vitesse normale", speedMult: 1 },
  ultra:  { emoji: "🔴", gradient: "from-rose-300 to-red-400",     desc: "Vitesse folle", speedMult: 1.25 },
};

// Palette pastel (cyclique) pour les blocs
const PASTEL = [
  "#fbcfe8", "#fecaca", "#fed7aa", "#fde68a", "#bbf7d0",
  "#a7f3d0", "#bae6fd", "#c7d2fe", "#ddd6fe", "#f5d0fe",
];

type TPhase = "level_select" | "countdown" | "play" | "result" | "dare" | "done";

type TState = {
  game?: "tower";
  phase?: TPhase;
  level_1?: DareLevel | null;
  level_2?: DareLevel | null;
  level?: DareLevel | null;
  started_at?: number | null;      // ms epoch (top départ commun)
  height_1?: number;               // hauteur live (étages)
  height_2?: number;
  done_1?: boolean;
  done_2?: boolean;
  score_1?: number;
  score_2?: number;
  winner_slot?: 0 | 1 | 2 | null;  // 0 = égalité
  wheel_index?: number | null;
  dare_text?: string | null;
};

type Props = {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
  onDareDone: () => void;
};

const update = (roomId: string, patch: TState) =>
  supabase.from("rooms").update({ minigame_state: patch }).eq("id", roomId);

async function patch(roomId: string, partial: TState) {
  const { data } = await supabase.from("rooms").select("minigame_state").eq("id", roomId).maybeSingle();
  const current = (data?.minigame_state ?? {}) as TState;
  await update(roomId, { ...current, ...partial });
}

function stableIndex(seed: string, max: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % max;
}

function freshReset(): TState {
  return {
    game: "tower",
    phase: "level_select",
    level_1: null, level_2: null, level: null,
    started_at: null,
    height_1: 0, height_2: 0,
    done_1: false, done_2: false,
    score_1: 0, score_2: 0,
    winner_slot: null, wheel_index: null, dare_text: null,
  };
}

export function StackTower({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s = (room.minigame_state ?? {}) as TState;
  const phase = s.phase ?? "level_select";

  useEffect(() => {
    if ((Object.keys(s).length === 0 || s.game !== "tower") && mySlot === 1) {
      void update(room.id, freshReset());
    }
  }, [room.id, s, mySlot]);

  if (phase === "level_select")
    return <LevelSelect state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  if (phase === "countdown" || phase === "play")
    return <PlayView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  if (phase === "result")
    return <Result state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  if (phase === "dare")
    return <DareView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onDareDone={onDareDone} />;
  return <DoneView state={s} room={room} mySlot={mySlot} onBackToMenu={onBackToMenu} onReplay={async () => { await update(room.id, freshReset()); }} />;
}

// ─────────── Choix du niveau ───────────
function LevelSelect({ state, room, mySlot, myName, otherName }:
  { state: TState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const mine = mySlot === 1 ? state.level_1 : state.level_2;
  const theirs = mySlot === 1 ? state.level_2 : state.level_1;
  const both = state.level_1 && state.level_2;
  const match = both && state.level_1 === state.level_2;

  const choose = async (l: DareLevel) => {
    await patch(room.id, mySlot === 1 ? { level_1: l } : { level_2: l });
  };

  const start = async () => {
    if (!match || mySlot !== 1) return;
    const chosen = state.level_1 as DareLevel;
    const startAt = Date.now() + (COUNTDOWN_S + 1) * 1000;
    await patch(room.id, {
      phase: "countdown",
      level: chosen,
      started_at: startAt,
      height_1: 0, height_2: 0,
      done_1: false, done_2: false,
      score_1: 0, score_2: 0,
      winner_slot: null, wheel_index: null, dare_text: null,
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">La tour infinie 🗼</p>
        <h1 className="mt-1 font-serif text-4xl text-primary">Empile, empile <span className="italic">encore</span></h1>
        <p className="mt-2 text-xs text-muted-foreground">Choisissez ensemble le niveau du gage :</p>
      </div>

      <div className="mt-5 grid gap-3">
        {(Object.keys(LEVEL_INFO) as DareLevel[]).map((l) => {
          const info = LEVEL_INFO[l];
          const iPicked = mine === l;
          const theyPicked = theirs === l;
          return (
            <motion.button
              key={l}
              whileTap={{ scale: 0.97 }}
              onClick={() => choose(l)}
              className={`flex items-center gap-4 rounded-3xl border-2 p-4 text-left shadow-md bg-gradient-to-br ${info.gradient} ${iPicked ? "border-primary ring-2 ring-primary/40" : "border-white/60"}`}
            >
              <span className="text-4xl">{info.emoji}</span>
              <div className="flex-1">
                <p className="font-serif text-2xl text-foreground/90">{LEVEL_LABELS[l]}</p>
                <p className="text-[11px] text-foreground/70">{info.desc}</p>
                <div className="mt-1 flex gap-2 text-[11px] font-medium">
                  {iPicked && <span className="rounded-full bg-white/80 px-2 py-0.5">Toi ✓</span>}
                  {theyPicked && <span className="rounded-full bg-white/80 px-2 py-0.5">{otherName} ✓</span>}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4 text-center text-sm">
        <p>
          <span className="font-semibold">{myName}</span> : {mine ? LEVEL_LABELS[mine] : "—"} ·{" "}
          <span className="font-semibold">{otherName}</span> : {theirs ? LEVEL_LABELS[theirs] : "—"}
        </p>
        {both && !match && <p className="mt-2 text-muted-foreground">Mettez-vous d'accord 😅</p>}
      </div>

      <div className="mt-auto pt-6">
        <Button disabled={!match || mySlot !== 1} onClick={start} className="h-14 w-full rounded-2xl text-base font-semibold">
          {match ? (mySlot === 1 ? "Top départ ! 🗼" : `${otherName} va lancer…`) : "En attente du niveau commun…"}
        </Button>
      </div>
    </div>
  );
}

// ─────────── Jeu principal ───────────
type Block = { x: number; w: number; color: string };
type FallingPiece = { x: number; w: number; y: number; color: string; vy: number };

function PlayView({ state, room, mySlot, myName, otherName }:
  { state: TState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const level = (state.level ?? "medium") as DareLevel;
  const speedMult = LEVEL_INFO[level].speedMult;

  const startedAt = state.started_at ?? Date.now();
  const otherHeight = mySlot === 1 ? (state.height_2 ?? 0) : (state.height_1 ?? 0);
  const otherDone = mySlot === 1 ? !!state.done_2 : !!state.done_1;
  const iAmDone = mySlot === 1 ? !!state.done_1 : !!state.done_2;

  // Compte à rebours local synchronisé sur started_at
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  const msToStart = startedAt - now;
  const inCountdown = msToStart > 0;
  const countLabel = msToStart > 3000 ? "Prêt ?" : msToStart > 0 ? `${Math.ceil(msToStart / 1000)}` : "GO !";

  // Passe la phase de countdown → play une fois le temps écoulé (slot 1)
  useEffect(() => {
    if (state.phase === "countdown" && !inCountdown && mySlot === 1) {
      void patch(room.id, { phase: "play" });
    }
  }, [state.phase, inCountdown, mySlot, room.id]);

  // ── État local de la tour ──
  const [stack, setStack] = useState<Block[]>(() => [{
    x: (LOGICAL_W - START_W) / 2,
    w: START_W,
    color: PASTEL[0],
  }]);
  const [movingX, setMovingX] = useState((LOGICAL_W - START_W) / 2);
  const [movingDir, setMovingDir] = useState<1 | -1>(1);
  const [falling, setFalling] = useState<FallingPiece[]>([]);
  const [perfectFlash, setPerfectFlash] = useState(0);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const stackRef = useRef(stack);
  useEffect(() => { stackRef.current = stack; }, [stack]);

  const playing = state.phase === "play" && !iAmDone;

  // Boucle d'animation du bloc qui se déplace + chutes
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  useEffect(() => {
    if (!playing) return;
    lastTsRef.current = performance.now();
    const loop = (ts: number) => {
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      // Vitesse en fonction de la hauteur
      const h = stackRef.current.length - 1;
      const speed = Math.min(MAX_SPEED, (BASE_SPEED + h * SPEED_STEP) * speedMult);
      const topBlock = stackRef.current[stackRef.current.length - 1];

      setMovingX((prev) => {
        let next = prev + speed * dt * (movingDir === 1 ? 1 : -1);
        const maxX = LOGICAL_W - topBlock.w;
        if (next >= maxX) { next = maxX; setMovingDir(-1); }
        if (next <= 0) { next = 0; setMovingDir(1); }
        return next;
      });

      // Chutes
      setFalling((prev) => {
        if (prev.length === 0) return prev;
        const next = prev
          .map((p) => ({ ...p, y: p.y + p.vy * dt, vy: p.vy + 900 * dt }))
          .filter((p) => p.y < 600);
        return next;
      });

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, movingDir, speedMult]);

  // Broadcast périodique de la hauteur live (∼6Hz)
  useEffect(() => {
    if (!playing) return;
    let last = -1;
    const t = setInterval(() => {
      const h = stackRef.current.length - 1;
      if (h === last) return;
      last = h;
      void patch(room.id, mySlot === 1 ? { height_1: h } : { height_2: h });
    }, 1000 / BROADCAST_HZ);
    return () => clearInterval(t);
  }, [playing, room.id, mySlot]);

  // Action : poser le bloc
  const drop = () => {
    if (!playing) return;
    const top = stack[stack.length - 1];
    const movingW = top.w;
    const newLeft = Math.max(movingX, top.x);
    const newRight = Math.min(movingX + movingW, top.x + top.w);
    const overlap = newRight - newLeft;

    // RATÉ — fin
    if (overlap <= 0) {
      // tout le bloc tombe
      setFalling((prev) => [...prev, {
        x: movingX, w: movingW, y: 0,
        color: PASTEL[stack.length % PASTEL.length],
        vy: 0,
      }]);
      const score = stack.length - 1; // étages empilés (hors socle)
      setFinalScore(score);
      void patch(room.id, mySlot === 1
        ? { done_1: true, score_1: score, height_1: score }
        : { done_2: true, score_2: score, height_2: score });
      return;
    }

    const diff = Math.abs(movingX - top.x);
    const isPerfect = diff <= PERFECT_TOL;

    let placedX = newLeft;
    let placedW = overlap;
    if (isPerfect) {
      // Alignement parfait : on garde la largeur, petit bonus
      placedX = top.x;
      placedW = Math.min(LOGICAL_W, top.w + PERFECT_BONUS);
      if (placedX + placedW > LOGICAL_W) placedX = LOGICAL_W - placedW;
      if (placedX < 0) placedX = 0;
      setPerfectFlash((n) => n + 1);
      confetti({ particleCount: 18, spread: 50, origin: { y: 0.5 }, scalar: 0.6, ticks: 60 });
    } else {
      // Morceau qui dépasse → tombe
      const leftCut = movingX < top.x ? { x: movingX, w: top.x - movingX } : null;
      const rightCut = movingX + movingW > top.x + top.w
        ? { x: top.x + top.w, w: (movingX + movingW) - (top.x + top.w) }
        : null;
      const cut = leftCut ?? rightCut;
      if (cut && cut.w > 0.5) {
        setFalling((prev) => [...prev, {
          x: cut.x, w: cut.w, y: 0,
          color: PASTEL[stack.length % PASTEL.length],
          vy: 0,
        }]);
      }
    }

    const newBlock: Block = {
      x: placedX,
      w: placedW,
      color: PASTEL[stack.length % PASTEL.length],
    };
    const nextStack = [...stack, newBlock];
    setStack(nextStack);

    // Repositionner le bloc mobile au bord opposé
    setMovingX(movingDir === 1 ? 0 : LOGICAL_W - newBlock.w);
    setMovingDir((d) => (d === 1 ? -1 : 1));
  };

  // Fin des deux → result (slot 1 déclenche)
  useEffect(() => {
    if (state.phase !== "play") return;
    if (state.done_1 && state.done_2 && mySlot === 1 && state.winner_slot == null) {
      const s1 = state.score_1 ?? 0;
      const s2 = state.score_2 ?? 0;
      const winner: 0 | 1 | 2 = s1 === s2 ? 0 : s1 > s2 ? 1 : 2;
      const lvl = (state.level ?? "simple") as DareLevel;
      const pool = (getGagesPool(room.ambiance, lvl) ?? GAGES_BY_LEVEL[lvl]);
      const seed = `${room.id}-tower-${lvl}-${s1}-${s2}-${winner}`;
      const idx = stableIndex(seed, pool.length);
      void patch(room.id, {
        phase: "result",
        winner_slot: winner,
        wheel_index: idx,
        dare_text: winner === 0 ? null : pool[idx],
      });
    }
  }, [state, mySlot, room.id]);

  // Rendu
  const myHeight = stack.length - 1;
  const topBlock = stack[stack.length - 1];

  // "Caméra" : on garde le sommet et le bloc mobile dans la zone visible
  // L'arène fait 360px de haut. Les blocs sont posés depuis le bas.
  const ARENA_H = 360;
  const totalStackH = stack.length * BLOCK_H;
  const cameraY = Math.max(0, totalStackH + BLOCK_H * 2 - ARENA_H);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between text-xs">
        <span className="rounded-full bg-card/80 px-2 py-1 font-medium">
          🗼 <span className="font-bold text-primary">{myHeight}</span> étages
        </span>
        <span className="rounded-full bg-card/80 px-2 py-1 font-medium">
          {otherName} : <span className="font-bold text-primary">{otherHeight}</span> {otherDone && "🏁"}
        </span>
      </div>

      <div
        onPointerDown={drop}
        className="relative mx-auto mt-3 w-full max-w-sm touch-none select-none overflow-hidden rounded-3xl border-2 border-white/60 bg-gradient-to-b from-sky-100 via-rose-50 to-emerald-100 shadow-inner"
        style={{ aspectRatio: `${LOGICAL_W} / ${ARENA_H}`, cursor: playing ? "pointer" : "default" }}
      >
        {/* Conteneur monde (translaté pour suivre la tour) */}
        <div
          className="absolute inset-x-0"
          style={{
            bottom: `${(-cameraY / ARENA_H) * 100}%`,
            height: `${(Math.max(ARENA_H, totalStackH + BLOCK_H * 4) / ARENA_H) * 100}%`,
            transition: "bottom 220ms ease-out",
          }}
        >
          {/* Pile */}
          {stack.map((b, i) => (
            <div
              key={i}
              className="absolute rounded-md shadow-sm"
              style={{
                left: `${(b.x / LOGICAL_W) * 100}%`,
                width: `${(b.w / LOGICAL_W) * 100}%`,
                bottom: `${(i * BLOCK_H)}px`,
                height: `${BLOCK_H}px`,
                background: `linear-gradient(180deg, ${b.color}, color-mix(in oklab, ${b.color} 70%, white))`,
                border: "1px solid rgba(255,255,255,0.6)",
              }}
            />
          ))}

          {/* Bloc mobile */}
          {playing && topBlock && (
            <div
              className="absolute rounded-md shadow-md"
              style={{
                left: `${(movingX / LOGICAL_W) * 100}%`,
                width: `${(topBlock.w / LOGICAL_W) * 100}%`,
                bottom: `${(stack.length * BLOCK_H)}px`,
                height: `${BLOCK_H}px`,
                background: `linear-gradient(180deg, ${PASTEL[stack.length % PASTEL.length]}, color-mix(in oklab, ${PASTEL[stack.length % PASTEL.length]} 60%, white))`,
                border: "1px solid rgba(255,255,255,0.8)",
                willChange: "left",
              }}
            />
          )}

          {/* Morceaux qui tombent */}
          {falling.map((p, i) => (
            <div
              key={`f-${i}-${p.x}`}
              className="absolute rounded-md opacity-80"
              style={{
                left: `${(p.x / LOGICAL_W) * 100}%`,
                width: `${(p.w / LOGICAL_W) * 100}%`,
                bottom: `${(stack.length * BLOCK_H) - p.y}px`,
                height: `${BLOCK_H}px`,
                background: p.color,
                transform: `rotate(${(p.x % 7) - 3}deg)`,
              }}
            />
          ))}
        </div>

        {/* Flash "Parfait !" */}
        <AnimatePresence>
          {perfectFlash > 0 && (
            <motion.div
              key={perfectFlash}
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: -10, scale: 1.05 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.6 }}
              className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1 font-script text-2xl text-primary shadow"
            >
              Parfait ! ✨
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overlay countdown */}
        <AnimatePresence>
          {state.phase === "countdown" && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm"
            >
              <motion.div
                key={countLabel}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.15, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="font-serif text-7xl italic text-primary drop-shadow"
              >
                {countLabel}
              </motion.div>
            </motion.div>
          )}

          {iAmDone && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 backdrop-blur-sm"
            >
              <p className="text-5xl">🗼</p>
              <p className="font-serif text-3xl text-primary">{finalScore ?? (mySlot === 1 ? state.score_1 : state.score_2)} étages</p>
              <p className="text-sm text-muted-foreground">
                {otherDone ? "On compare…" : `En attente de ${otherName}…`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        {playing ? "Tape n'importe où pour poser le bloc 👇" : inCountdown ? "Prépare-toi…" : "—"}
      </p>
    </div>
  );
}

// ─────────── Résultat ───────────
function Result({ state, room, mySlot, myName, otherName }:
  { state: TState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const s1 = state.score_1 ?? 0;
  const s2 = state.score_2 ?? 0;
  const myScore = mySlot === 1 ? s1 : s2;
  const otherScore = mySlot === 1 ? s2 : s1;
  const winner = state.winner_slot ?? 0;
  const iWon = winner === mySlot;
  const tie = winner === 0;

  useEffect(() => {
    if (iWon) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    const t = setTimeout(() => {
      if (mySlot === 1) {
        void patch(room.id, { phase: tie ? "done" : "dare" });
      }
    }, 2200);
    return () => clearTimeout(t);
  }, [iWon, tie, mySlot, room.id]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} className="text-7xl">
        {tie ? "🤝" : iWon ? "🏆" : "🗼"}
      </motion.div>
      <h2 className="mt-6 font-serif text-4xl text-primary">
        {tie ? "Match nul 💕" : iWon ? "Tu gagnes !" : `${otherName} gagne !`}
      </h2>
      <div className="mt-6 grid w-full max-w-xs grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card/80 p-3 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{myName}</p>
          <p className="font-serif text-3xl text-primary">{myScore}</p>
        </div>
        <div className="rounded-2xl bg-card/80 p-3 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{otherName}</p>
          <p className="font-serif text-3xl text-primary">{otherScore}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────── Gage ───────────
function DareView({ state, room, mySlot, myName, otherName, onDareDone }:
  { state: TState; room: Room; mySlot: number; myName: string; otherName: string; onDareDone: () => void }) {
  const winner = state.winner_slot ?? 0;
  const loserSlot = winner === 1 ? 2 : 1;
  const iLost = loserSlot === mySlot;
  const level = (state.level ?? "simple") as DareLevel;
  const dare = state.dare_text ?? (getGagesPool(room.ambiance, level) ?? GAGES_BY_LEVEL[level])[0];

  const validate = async () => {
    onDareDone();
    await patch(room.id, { phase: "done" });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="text-6xl">
        🎁
      </motion.div>
      <div className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        {LEVEL_LABELS[level]}
      </div>
      <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
        {iLost ? "Ton gage" : `Gage pour ${otherName}`}
      </p>
      <h2 className="mt-3 px-4 font-serif text-3xl italic leading-tight text-primary">{dare}</h2>
      {iLost ? (
        <Button onClick={validate} className="mt-10 h-14 w-full max-w-xs rounded-2xl text-base font-semibold">
          C'est fait ! ✅
        </Button>
      ) : (
        <p className="mt-8 text-muted-foreground">On attend que {otherName} fasse son gage… 🥹</p>
      )}
    </div>
  );
}

// ─────────── Fin ───────────
function DoneView({ state, room, mySlot, onBackToMenu, onReplay }:
  { state: TState; room: Room; mySlot: number; onBackToMenu: () => void; onReplay: () => void }) {
  useEffect(() => {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} className="text-8xl">🗼</motion.div>
      <h2 className="mt-6 font-serif text-4xl italic text-primary">Belle tour !</h2>
      <p className="mt-2 text-sm text-muted-foreground">On en refait une ?</p>

      <div className="mt-8 w-full max-w-xs space-y-3">
        {mySlot === 1 ? (
          <Button onClick={onReplay} className="h-14 w-full rounded-2xl text-base font-semibold">
            Rejouer 🔁
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">En attente de la décision…</p>
        )}
        <Button variant="secondary" onClick={onBackToMenu} className="h-12 w-full rounded-2xl">
          ← Retour au menu
        </Button>
      </div>
    </div>
  );
}
