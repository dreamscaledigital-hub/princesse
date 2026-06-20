import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";
import { GAGES_BY_LEVEL, getGagesPool, LEVEL_LABELS, type DareLevel } from "@/lib/game-content";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ─────────── Design tokens ───────────
const BG = "linear-gradient(160deg, oklch(0.10 0.07 260) 0%, oklch(0.07 0.04 250) 100%)";
const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 20,
};
const ROSE    = "#f43f5e";
const AMBER   = "#fbbf24";
const EMERALD = "#4ade80";
const SKY     = "#38bdf8";
const VIOLET  = "#a78bfa";
const SERIF   = "'Cormorant Garamond', Georgia, serif";

// Couleurs par joueur : slot 1 = chaud, slot 2 = froid
const P1_COLORS = ["#f43f5e", "#fbbf24", "#fb923c", "#f9a8d4"];
const P2_COLORS = ["#4ade80", "#38bdf8", "#a78bfa", "#2dd4bf"];

// ─────────── Réglages ───────────
const LOGICAL_W    = 300;
const BLOCK_H      = 24;
const PERFECT_TOL  = 5;
const PERFECT_BONUS = 8;
const BASE_SPEED   = 90;
const SPEED_STEP   = 5;
const MAX_SPEED    = 300;
const COUNTDOWN_S  = 3;
const ARENA_H      = 380;

const LEVEL_CFG: Record<DareLevel, {
  color: string; glow: string; desc: string; speedMult: number; startW: number; emoji: string;
}> = {
  simple: { color: EMERALD, glow: `${EMERALD}44`, desc: "Blocs larges · vitesse douce",    speedMult: 0.80, startW: 192, emoji: "🌿" },
  medium: { color: AMBER,   glow: `${AMBER}44`,   desc: "Taille normale · vitesse normale", speedMult: 1.00, startW: 168, emoji: "⚡" },
  ultra:  { color: ROSE,    glow: `${ROSE}44`,    desc: "Blocs étroits · vitesse folle",   speedMult: 1.35, startW: 136, emoji: "🔥" },
};

// ─────────── Types ───────────
type TPhase = "level_select" | "countdown" | "play" | "result" | "dare" | "done";

type BlockData = { x: number; w: number; color: string; slot: 1 | 2 };
type FallingPiece = { x: number; w: number; color: string; y: number; vy: number; rot: number };

type TState = {
  game?: "tower";
  phase?: TPhase;
  level_1?: DareLevel | null;
  level_2?: DareLevel | null;
  level?: DareLevel | null;
  stack?: BlockData[];
  active_slot?: 1 | 2;
  turn_started_at?: number | null;
  moving_start_x?: number;
  moving_dir?: 1 | -1;
  drop_x?: number | null;
  drop_slot?: 1 | 2 | null;
  last_cut?: { x: number; w: number; color: string } | null;
  last_perfect?: boolean;
  score?: number;
  winner_slot?: 0 | 1 | 2 | null;
  loser_slot?: 1 | 2 | null;
  dare_text?: string | null;
  dare_done?: boolean;
  started_at?: number | null;
};

type Props = {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
  onDareDone: () => void;
};

type SharedProps = {
  state: TState;
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
};

// ─────────── Utils ───────────
function stableIndex(seed: string, max: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % max;
}

function blockColor(slot: 1 | 2, index: number): string {
  return (slot === 1 ? P1_COLORS : P2_COLORS)[index % 4];
}

function initialStack(startW: number): BlockData[] {
  return [{ x: (LOGICAL_W - startW) / 2, w: startW, color: VIOLET, slot: 1 }];
}

function freshReset(): TState {
  return {
    game: "tower", phase: "level_select",
    level_1: null, level_2: null, level: null,
    stack: initialStack(168),
    active_slot: 1, turn_started_at: null,
    moving_start_x: 0, moving_dir: 1,
    drop_x: null, drop_slot: null,
    last_cut: null, last_perfect: false,
    score: 0, winner_slot: null, loser_slot: null,
    dare_text: null, dare_done: false, started_at: null,
  };
}

function computeSpeed(height: number, speedMult: number): number {
  return Math.min(MAX_SPEED, (BASE_SPEED + height * SPEED_STEP) * speedMult);
}

// Calcul déterministe de la position du bloc mobile
function computeX(
  startX: number, dir: 1 | -1, speed: number, elapsedSec: number, blockW: number
): { x: number; d: 1 | -1 } {
  const maxX = LOGICAL_W - blockW;
  if (maxX <= 0) return { x: 0, d: dir };
  let x = Math.max(0, Math.min(maxX, startX));
  let d = dir;
  let t = elapsedSec;
  while (t > 0.0001) {
    const dist = d === 1 ? maxX - x : x;
    const ttw  = dist / speed;
    if (ttw >= t) { x += d * speed * t; t = 0; }
    else          { x = d === 1 ? maxX : 0; d = d === 1 ? -1 : 1; t -= ttw; }
  }
  return { x: Math.max(0, Math.min(maxX, x)), d };
}

async function patchState(roomId: string, partial: Record<string, unknown>) {
  await supabase.rpc("minigame_patch", { _room_id: roomId, _patch: partial });
}

async function dbUpdate(roomId: string, state: TState) {
  await supabase.from("rooms").update({ minigame_state: state }).eq("id", roomId);
}

// ─────────── StackTower ───────────
export function StackTower({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s     = (room.minigame_state ?? {}) as TState;
  const phase = s.phase ?? "level_select";

  useEffect(() => {
    if ((Object.keys(s).length === 0 || s.game !== "tower") && mySlot === 1) {
      void dbUpdate(room.id, freshReset());
    }
  }, [room.id, s, mySlot]);

  const shared: SharedProps = { state: s, room, mySlot, myName, otherName };

  return (
    <div style={{
      minHeight: "100dvh",
      background: BG,
      display: "flex",
      flexDirection: "column",
      padding: "14px 14px 28px",
      gap: 12,
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#fff",
      touchAction: "manipulation",
    }}>
      {phase === "level_select"                    && <LevelSelect {...shared} />}
      {(phase === "countdown" || phase === "play") && <PlayView    {...shared} />}
      {phase === "result"                          && <Result       {...shared} />}
      {phase === "dare"  && <DareView  {...shared} onDareDone={onDareDone} />}
      {phase === "done"  && (
        <DoneView
          state={s} room={room} mySlot={mySlot}
          onBackToMenu={onBackToMenu}
          onReplay={async () => { await dbUpdate(room.id, freshReset()); }}
        />
      )}
    </div>
  );
}

// ─────────── Choix du niveau ───────────
function LevelSelect({ state, room, mySlot, myName, otherName }: SharedProps) {
  const mine   = mySlot === 1 ? state.level_1 : state.level_2;
  const theirs = mySlot === 1 ? state.level_2 : state.level_1;
  const both   = !!(state.level_1 && state.level_2);
  const match  = both && state.level_1 === state.level_2;

  const choose = async (l: DareLevel) => {
    await patchState(room.id, mySlot === 1 ? { level_1: l } : { level_2: l });
  };

  const start = async () => {
    if (!match || mySlot !== 1) return;
    const chosen  = state.level_1 as DareLevel;
    const cfg     = LEVEL_CFG[chosen];
    const startStack = initialStack(cfg.startW);
    await patchState(room.id, {
      phase: "countdown",
      level: chosen,
      stack: startStack,
      active_slot: 1,
      turn_started_at: Date.now() + COUNTDOWN_S * 1000,
      moving_start_x: 0,
      moving_dir: 1,
      drop_x: null, drop_slot: null,
      last_cut: null, last_perfect: false,
      score: 0, winner_slot: null, loser_slot: null,
      dare_text: null, dare_done: false, started_at: Date.now(),
    });
  };

  const chosenLevel = (mine ?? "medium") as DareLevel;

  return (
    <>
      <div style={{ textAlign: "center", paddingTop: 6 }}>
        <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, color: "rgba(255,255,255,0.32)", margin: 0 }}>
          La Tour Infinie 🗼
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: 34, fontStyle: "italic", color: "#fff", margin: "4px 0 0", lineHeight: 1 }}>
          Empile, encore et <em>encore</em>
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 6, marginBottom: 0 }}>
          À tour de rôle · le premier qui rate le bloc perd
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
        {(Object.keys(LEVEL_CFG) as DareLevel[]).map((l, idx) => {
          const cfg      = LEVEL_CFG[l];
          const iPicked  = mine === l;
          const theyPick = theirs === l;
          return (
            <motion.button
              key={l}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.07 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => choose(l)}
              style={{
                ...glass,
                padding: "16px 18px",
                border: iPicked ? `2px solid ${cfg.color}` : "1px solid rgba(255,255,255,0.09)",
                background: iPicked ? `${cfg.color}12` : "rgba(255,255,255,0.04)",
                boxShadow: iPicked ? `0 0 22px ${cfg.glow}` : "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 14,
                textAlign: "left",
                transition: "all 0.2s",
                borderRadius: 18,
              }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                background: `${cfg.color}18`,
                border: `2px solid ${cfg.color}55`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
                boxShadow: iPicked ? `0 0 14px ${cfg.glow}` : "none",
              }}>
                {cfg.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: SERIF, fontSize: 22, fontStyle: "italic", color: cfg.color, margin: 0, textShadow: iPicked ? `0 0 14px ${cfg.color}88` : "none" }}>
                  {LEVEL_LABELS[l]}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", margin: "3px 0 0" }}>{cfg.desc}</p>
                {(iPicked || theyPick) && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {iPicked   && <span style={{ fontSize: 10, background: `${cfg.color}20`, border: `1px solid ${cfg.color}55`, color: cfg.color, borderRadius: 20, padding: "2px 8px" }}>Toi ✓</span>}
                    {theyPick  && <span style={{ fontSize: 10, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", borderRadius: 20, padding: "2px 8px" }}>{otherName} ✓</span>}
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <div style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.40)" }}>
        <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{myName}</span> : {mine ? LEVEL_LABELS[mine] : "—"}
        {" · "}
        <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{otherName}</span> : {theirs ? LEVEL_LABELS[theirs as DareLevel] : "—"}
      </div>
      {both && !match && (
        <p style={{ textAlign: "center", fontSize: 13, color: ROSE, margin: 0 }}>Mettez-vous d'accord 😅</p>
      )}

      <div style={{ marginTop: "auto", paddingTop: 6 }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={!match || mySlot !== 1}
          onClick={start}
          style={{
            width: "100%", height: 56, borderRadius: 18, border: "none",
            background: match ? `linear-gradient(135deg, ${LEVEL_CFG[chosenLevel].color}, ${SKY})` : "rgba(255,255,255,0.07)",
            color: match ? "#0d0d0d" : "rgba(255,255,255,0.25)",
            fontWeight: 700, fontSize: 17,
            cursor: match && mySlot === 1 ? "pointer" : "not-allowed",
            boxShadow: match ? `0 0 30px ${LEVEL_CFG[chosenLevel].glow}` : "none",
            transition: "all 0.3s",
          }}
        >
          {match
            ? (mySlot === 1 ? "Construire la tour ! 🗼" : `${otherName} va lancer…`)
            : "Choisissez le même niveau…"}
        </motion.button>
      </div>
    </>
  );
}

// ─────────── Jeu principal ───────────
function PlayView({ state, room, mySlot, myName, otherName }: SharedProps) {
  const isAuthority = mySlot === 1;
  const phase       = state.phase ?? "countdown";
  const level       = (state.level ?? "medium") as DareLevel;
  const cfg         = LEVEL_CFG[level];
  const stack: BlockData[] = state.stack ?? initialStack(cfg.startW);
  const activeSlot  = state.active_slot ?? 1;
  const isMyTurn    = activeSlot === mySlot;
  const score       = state.score ?? 0;
  const activeColor = isMyTurn ? cfg.color : "rgba(255,255,255,0.35)";

  const [movingX, setMovingX]       = useState(state.moving_start_x ?? 0);
  const [falling, setFalling]       = useState<FallingPiece[]>([]);
  const [perfectKey, setPerfectKey] = useState(0);
  const rafRef        = useRef<number>(0);
  const fallRafRef    = useRef<number>(0);
  const lastCutRef    = useRef<string>("");
  const lastPerfectScoreRef = useRef(-1);
  const isResolvingRef = useRef(false);

  // Timer local pour le countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(t);
  }, []);
  const turnStart    = state.turn_started_at ?? Date.now();
  const msToTurnStart = turnStart - now;
  const inCountdown   = phase === "countdown" || (phase === "play" && msToTurnStart > 0);

  // Authority: countdown → play
  useEffect(() => {
    if (!isAuthority || phase !== "countdown" || !state.turn_started_at) return;
    const delay = state.turn_started_at - Date.now();
    const t = setTimeout(() => void patchState(room.id, { phase: "play" }), Math.max(0, delay));
    return () => clearTimeout(t);
  }, [isAuthority, phase, state.turn_started_at, room.id]);

  // Animation déterministe du bloc mobile
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (phase !== "play" || !state.turn_started_at || state.drop_x != null) return;
    const startX  = state.moving_start_x ?? 0;
    const dir     = state.moving_dir ?? 1 as 1 | -1;
    const topW    = stack[stack.length - 1].w;
    const speed   = computeSpeed(stack.length - 1, cfg.speedMult);

    const loop = () => {
      const elapsed = Math.max(0, (Date.now() - (state.turn_started_at ?? Date.now())) / 1000);
      const { x } = computeX(startX, dir, speed, elapsed, topW);
      setMovingX(x);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, state.turn_started_at, state.moving_start_x, state.moving_dir, stack.length, cfg.speedMult, state.drop_x]);

  // Boucle physique des chutes
  useEffect(() => {
    let last = performance.now();
    const loop = (ts: number) => {
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      setFalling((prev) => {
        if (prev.length === 0) return prev;
        return prev
          .map((p) => ({ ...p, y: p.y + p.vy * dt, vy: p.vy + 900 * dt }))
          .filter((p) => p.y < 900);
      });
      fallRafRef.current = requestAnimationFrame(loop);
    };
    fallRafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(fallRafRef.current);
  }, []);

  // Détecter nouveau morceau tombé
  useEffect(() => {
    const cut = state.last_cut;
    if (!cut) return;
    const key = `${cut.x.toFixed(1)}-${cut.w.toFixed(1)}-${cut.color}`;
    if (key === lastCutRef.current) return;
    lastCutRef.current = key;
    setFalling((prev) => [...prev, {
      ...cut, y: 0, vy: -30, rot: ((cut.x * 7) % 14) - 7,
    }]);
  }, [state.last_cut]);

  // Détecter bloc parfait
  useEffect(() => {
    if (!state.last_perfect) return;
    if ((state.score ?? 0) === lastPerfectScoreRef.current) return;
    lastPerfectScoreRef.current = state.score ?? 0;
    setPerfectKey((k) => k + 1);
    confetti({ particleCount: 22, spread: 45, origin: { y: 0.5 }, scalar: 0.75, ticks: 70 });
  }, [state.last_perfect, state.score]);

  // Authority: résoudre le dépôt
  useEffect(() => {
    if (!isAuthority || phase !== "play") return;
    if (state.drop_x == null || !state.drop_slot) return;
    if (isResolvingRef.current) return;
    isResolvingRef.current = true;

    const dropX    = state.drop_x;
    const dropSlot = state.drop_slot as 1 | 2;
    const topBlock = stack[stack.length - 1];
    const blockW   = topBlock.w;

    const newLeft  = Math.max(dropX, topBlock.x);
    const newRight = Math.min(dropX + blockW, topBlock.x + topBlock.w);
    const overlap  = newRight - newLeft;

    if (overlap <= 0) {
      // Raté → perdant
      const loserSlot:  1 | 2 = dropSlot;
      const winnerSlot: 1 | 2 = dropSlot === 1 ? 2 : 1;
      const lvl  = (state.level ?? "simple") as DareLevel;
      const pool = getGagesPool(room.ambiance, lvl) ?? GAGES_BY_LEVEL[lvl];
      const seed = `${room.id}-tower-${lvl}-${score}`;
      const idx  = stableIndex(seed, pool.length);
      void patchState(room.id, {
        phase: "result",
        winner_slot: winnerSlot, loser_slot: loserSlot,
        dare_text: pool[idx],
        drop_x: null, drop_slot: null,
        last_cut: { x: dropX, w: blockW, color: blockColor(dropSlot, Math.floor(score / 2)) },
        last_perfect: false,
      }).finally(() => { isResolvingRef.current = false; });
      return;
    }

    const diff       = Math.abs(dropX - topBlock.x);
    const isPerfect  = diff <= PERFECT_TOL;
    let placedX      = newLeft;
    let placedW      = isPerfect ? Math.min(LOGICAL_W, topBlock.w + PERFECT_BONUS) : overlap;
    let cutPiece: { x: number; w: number; color: string } | null = null;

    if (isPerfect) {
      placedX = topBlock.x;
      if (placedX + placedW > LOGICAL_W) placedX = LOGICAL_W - placedW;
      if (placedX < 0) placedX = 0;
    } else {
      const leftCut  = dropX < topBlock.x ? { x: dropX, w: topBlock.x - dropX } : null;
      const rightCut = dropX + blockW > topBlock.x + topBlock.w
        ? { x: topBlock.x + topBlock.w, w: (dropX + blockW) - (topBlock.x + topBlock.w) }
        : null;
      const cut = leftCut ?? rightCut;
      if (cut && cut.w > 0.5) {
        cutPiece = { ...cut, color: blockColor(dropSlot, Math.floor(score / 2)) };
      }
    }

    const newBlock: BlockData = {
      x: placedX, w: placedW,
      color: blockColor(dropSlot, Math.floor(score / 2)),
      slot: dropSlot,
    };
    const newStack   = [...stack, newBlock];
    const newScore   = newStack.length - 1;
    const nextSlot:  1 | 2 = dropSlot === 1 ? 2 : 1;
    const nextDir:   1 | -1 = newScore % 2 === 0 ? 1 : -1;
    const nextStartX = nextDir === 1 ? 0 : LOGICAL_W - placedW;

    void patchState(room.id, {
      stack: newStack,
      active_slot: nextSlot,
      turn_started_at: Date.now() + 350,
      moving_start_x: nextStartX,
      moving_dir: nextDir,
      drop_x: null, drop_slot: null,
      score: newScore,
      last_cut: cutPiece,
      last_perfect: isPerfect,
    }).finally(() => { isResolvingRef.current = false; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.drop_x, state.drop_slot, isAuthority, phase]);

  // Poser le bloc
  const handleDrop = async () => {
    if (!isMyTurn || phase !== "play" || inCountdown) return;
    if (state.drop_x != null) return;
    const x = movingX;
    await patchState(room.id, { drop_x: x, drop_slot: mySlot });
  };

  const topBlock     = stack[stack.length - 1];
  const movingColor  = blockColor(mySlot as 1 | 2, Math.floor((score + 1) / 2));
  const totalStackH  = stack.length * BLOCK_H;
  const cameraY      = Math.max(0, totalStackH + BLOCK_H * 2 - ARENA_H);

  return (
    <>
      {/* Header */}
      <div style={{ ...glass, padding: "10px 16px", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => {}} style={{ display: "none" }} />
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "rgba(255,255,255,0.32)" }}>La Tour</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: cfg.color, textShadow: `0 0 12px ${cfg.color}88` }}>
            {score} bloc{score !== 1 ? "s" : ""}
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeSlot}-${inCountdown}`}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            style={{ textAlign: "center", fontSize: 13, fontWeight: 600 }}
          >
            {inCountdown
              ? <span style={{ color: "rgba(255,255,255,0.55)" }}>En route…</span>
              : isMyTurn
                ? <span style={{ color: cfg.color, textShadow: `0 0 10px ${cfg.color}88` }}>🟢 Ton tour</span>
                : <span style={{ color: "rgba(255,255,255,0.45)" }}>⏳ Tour de {otherName}</span>}
          </motion.div>
        </AnimatePresence>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.32)", textTransform: "uppercase", letterSpacing: 1 }}>
          {LEVEL_LABELS[level]}
        </div>
      </div>

      {/* Légende joueurs */}
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        {([1, 2] as const).map((slot) => {
          const isMe = slot === mySlot;
          const pColors = slot === 1 ? P1_COLORS : P2_COLORS;
          return (
            <div key={slot} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", gap: 3 }}>
                {pColors.slice(0, 2).map((c, i) => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: c, boxShadow: `0 0 4px ${c}88` }} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: isMe ? "#fff" : "rgba(255,255,255,0.45)", fontWeight: isMe ? 700 : 400 }}>
                {isMe ? "Toi" : otherName}
              </span>
            </div>
          );
        })}
      </div>

      {/* Arène */}
      <div
        onPointerDown={isMyTurn && phase === "play" && !inCountdown && state.drop_x == null
          ? (e) => { e.preventDefault(); void handleDrop(); }
          : undefined}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 360,
          margin: "0 auto",
          aspectRatio: `${LOGICAL_W} / ${ARENA_H}`,
          borderRadius: 24,
          overflow: "hidden",
          border: isMyTurn && !inCountdown
            ? `2px solid ${cfg.color}77`
            : "2px solid rgba(255,255,255,0.09)",
          boxShadow: isMyTurn && !inCountdown
            ? `0 0 32px ${cfg.glow}, inset 0 0 60px rgba(0,0,0,0.5)`
            : "inset 0 0 60px rgba(0,0,0,0.5)",
          background: "linear-gradient(180deg, oklch(0.07 0.04 250) 0%, oklch(0.10 0.06 260) 100%)",
          cursor: isMyTurn && phase === "play" && !inCountdown && state.drop_x == null ? "pointer" : "default",
          touchAction: "none",
          userSelect: "none",
          flexShrink: 0,
          transition: "border-color 0.4s, box-shadow 0.4s",
        }}
      >
        {/* Grille de fond */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }} />

        {/* Monde (camera scroll) */}
        <div style={{
          position: "absolute",
          left: 0, right: 0,
          bottom: `${(-cameraY / ARENA_H) * 100}%`,
          height: `${(Math.max(ARENA_H, totalStackH + BLOCK_H * 5) / ARENA_H) * 100}%`,
          transition: "bottom 220ms ease-out",
        }}>
          {/* Blocs posés */}
          {stack.map((b, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${(b.x / LOGICAL_W) * 100}%`,
                width: `${(b.w / LOGICAL_W) * 100}%`,
                bottom: `${i * BLOCK_H}px`,
                height: `${BLOCK_H}px`,
                background: `linear-gradient(180deg, ${b.color}ff 0%, ${b.color}bb 100%)`,
                border: `1px solid ${b.color}66`,
                borderRadius: 5,
                boxShadow: `0 0 8px ${b.color}44, 0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)`,
              }}
            />
          ))}

          {/* Bloc mobile */}
          {phase === "play" && !inCountdown && state.drop_x == null && topBlock && (
            <div
              style={{
                position: "absolute",
                left: `${(movingX / LOGICAL_W) * 100}%`,
                width: `${(topBlock.w / LOGICAL_W) * 100}%`,
                bottom: `${stack.length * BLOCK_H}px`,
                height: `${BLOCK_H}px`,
                background: `linear-gradient(180deg, ${movingColor}ff 0%, ${movingColor}cc 100%)`,
                border: `1.5px solid ${movingColor}88`,
                borderRadius: 5,
                boxShadow: `0 0 18px ${movingColor}88, 0 0 6px ${movingColor}, inset 0 1px 0 rgba(255,255,255,0.3)`,
                willChange: "left",
              }}
            />
          )}

          {/* Snap freeze quand déposé */}
          {state.drop_x != null && topBlock && (
            <motion.div
              initial={{ opacity: 1 }} animate={{ opacity: 0.4 }}
              style={{
                position: "absolute",
                left: `${(state.drop_x / LOGICAL_W) * 100}%`,
                width: `${(topBlock.w / LOGICAL_W) * 100}%`,
                bottom: `${stack.length * BLOCK_H}px`,
                height: `${BLOCK_H}px`,
                background: `${movingColor}88`,
                borderRadius: 5,
              }}
            />
          )}

          {/* Morceaux tombant */}
          {falling.map((p, i) => (
            <div
              key={`f-${i}`}
              style={{
                position: "absolute",
                left: `${(p.x / LOGICAL_W) * 100}%`,
                width: `${(p.w / LOGICAL_W) * 100}%`,
                bottom: `${(stack.length * BLOCK_H) - p.y}px`,
                height: `${BLOCK_H}px`,
                background: p.color,
                borderRadius: 5,
                opacity: 0.75,
                transform: `rotate(${p.rot}deg)`,
              }}
            />
          ))}
        </div>

        {/* Flash Parfait ! */}
        <AnimatePresence>
          {perfectKey > 0 && (
            <motion.div
              key={perfectKey}
              initial={{ opacity: 0, y: 8, scale: 0.85 }}
              animate={{ opacity: 1, y: -6, scale: 1.05 }}
              exit={{ opacity: 0, y: -28 }}
              transition={{ duration: 0.65 }}
              style={{
                position: "absolute",
                top: 18,
                left: "50%",
                transform: "translateX(-50%)",
                pointerEvents: "none",
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(8px)",
                border: `1px solid ${EMERALD}66`,
                borderRadius: 20,
                padding: "4px 18px",
                fontFamily: SERIF,
                fontSize: 20,
                fontStyle: "italic",
                color: EMERALD,
                textShadow: `0 0 14px ${EMERALD}`,
                whiteSpace: "nowrap",
              }}
            >
              Parfait ! ✨
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overlay countdown */}
        <AnimatePresence>
          {inCountdown && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: "rgba(0,0,0,0.72)",
                backdropFilter: "blur(6px)",
                gap: 12,
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={Math.ceil(msToTurnStart / 1000)}
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{
                    fontFamily: SERIF,
                    fontSize: 88,
                    fontStyle: "italic",
                    color: "#fff",
                    textShadow: `0 0 40px ${cfg.color}`,
                    lineHeight: 1,
                  }}
                >
                  {msToTurnStart > 0 ? Math.ceil(msToTurnStart / 1000) : "GO !"}
                </motion.div>
              </AnimatePresence>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0 }}>
                {activeSlot === mySlot ? "C'est toi qui commences !" : `${otherName} commence !`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Label attente adversaire */}
        {!inCountdown && !isMyTurn && phase === "play" && state.drop_x == null && (
          <div style={{
            position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
            fontSize: 11, color: "rgba(255,255,255,0.30)", whiteSpace: "nowrap",
            background: "rgba(0,0,0,0.35)", borderRadius: 20, padding: "4px 12px",
          }}>
            {otherName} vise…
          </div>
        )}
      </div>

      {/* Bouton POSE */}
      {phase === "play" && !inCountdown && (
        <div>
          {isMyTurn && state.drop_x == null ? (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onPointerDown={(e) => { e.preventDefault(); void handleDrop(); }}
              animate={{
                boxShadow: [`0 0 20px ${cfg.color}44`, `0 0 44px ${cfg.color}99`, `0 0 20px ${cfg.color}44`],
              }}
              transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
              style={{
                width: "100%", height: 62, borderRadius: 20, border: "none",
                background: `linear-gradient(135deg, ${cfg.color}, ${SKY})`,
                color: "#0a0a0a", fontWeight: 900, fontSize: 24,
                letterSpacing: 3, textTransform: "uppercase",
                cursor: "pointer", touchAction: "manipulation",
              }}
            >
              POSE ! 🗼
            </motion.button>
          ) : isMyTurn && state.drop_x != null ? (
            <div style={{ ...glass, padding: "14px 20px", borderRadius: 18, textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.45)" }}>
              En attente du résultat…
            </div>
          ) : (
            <div style={{ ...glass, padding: "14px 20px", borderRadius: 18, textAlign: "center" }}>
              <motion.p
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.5)" }}
              >
                ⏳ {otherName} va poser son bloc…
              </motion.p>
            </div>
          )}
        </div>
      )}

      {/* Infos bas */}
      {phase === "play" && !inCountdown && (
        <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", margin: 0 }}>
          {myName} = {mySlot === 1 ? "chaud 🔴" : "froid 🔵"} · {otherName} = {mySlot === 1 ? "froid 🔵" : "chaud 🔴"}
        </p>
      )}
    </>
  );
}

// ─────────── Résultat ───────────
function Result({ state, room, mySlot, myName, otherName }: SharedProps) {
  const winner   = state.winner_slot ?? 0;
  const iWon     = winner === mySlot;
  const tie      = winner === 0;
  const topColor = tie ? AMBER : iWon ? EMERALD : ROSE;
  const score    = state.score ?? 0;

  useEffect(() => {
    if (iWon) confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    const t = setTimeout(() => {
      if (mySlot === 1) void patchState(room.id, { phase: tie ? "done" : "dare" });
    }, 2800);
    return () => clearTimeout(t);
  }, [iWon, tie, mySlot, room.id]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center", padding: "0 16px" }}>
      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: [0, 1.35, 1], rotate: [0, 5, 0] }}
        transition={{ duration: 0.55, times: [0, 0.65, 1] }}
        style={{ fontSize: 80, lineHeight: 1 }}
      >
        {tie ? "🤝" : iWon ? "🏆" : "🗼"}
      </motion.div>
      <div style={{ ...glass, padding: "22px 28px", width: "100%", maxWidth: 320, borderRadius: 24, border: `1px solid ${topColor}33` }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 32, fontStyle: "italic", color: topColor, margin: "0 0 8px", textShadow: `0 0 20px ${topColor}66` }}>
          {tie ? "Match nul 💕" : iWon ? "Tu gagnes !" : `${otherName} gagne !`}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.42)" }}>
          Tour de <span style={{ color: "#fff", fontWeight: 700 }}>{score}</span> bloc{score !== 1 ? "s" : ""} ensemble
        </p>
      </div>
    </div>
  );
}

// ─────────── Gage ───────────
function DareView({ state, room, mySlot, otherName, onDareDone }: SharedProps & { onDareDone: () => void }) {
  const winner    = state.winner_slot ?? 0;
  const loserSlot = winner === 1 ? 2 : 1;
  const iLost     = loserSlot === mySlot;
  const level     = (state.level ?? "simple") as DareLevel;
  const dare      = state.dare_text ?? (getGagesPool(room.ambiance, level) ?? GAGES_BY_LEVEL[level])[0];

  const validate = async () => {
    onDareDone();
    await patchState(room.id, { phase: "done" });
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center", padding: "0 16px" }}>
      <motion.div
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 18 }}
        style={{ fontSize: 72, lineHeight: 1 }}
      >
        🎁
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        style={{ ...glass, padding: "22px 24px", width: "100%", maxWidth: 340, borderRadius: 22, border: `1.5px solid ${AMBER}44`, background: `${AMBER}0c` }}
      >
        <p style={{ margin: "0 0 4px", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: AMBER }}>
          {iLost ? "Ton gage 🎭" : `Gage pour ${otherName} 🎭`}
        </p>
        <span style={{ fontSize: 11, background: `${LEVEL_CFG[level].color}20`, border: `1px solid ${LEVEL_CFG[level].color}44`, color: LEVEL_CFG[level].color, borderRadius: 20, padding: "2px 10px", display: "inline-block", marginTop: 4 }}>
          {LEVEL_LABELS[level]}
        </span>
        <h2 style={{ fontFamily: SERIF, fontSize: 26, fontStyle: "italic", color: "#fff", margin: "12px 0 0", lineHeight: 1.4 }}>
          {dare}
        </h2>
      </motion.div>

      {iLost ? (
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          whileTap={{ scale: 0.95 }} onClick={validate}
          style={{ width: "100%", maxWidth: 320, height: 56, borderRadius: 18, border: "none", background: `linear-gradient(135deg, ${AMBER}, #fb923c)`, color: "#0d0d0d", fontWeight: 700, fontSize: 17, cursor: "pointer", boxShadow: `0 0 24px ${AMBER}44` }}
        >
          C'est fait ! ✅
        </motion.button>
      ) : (
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
          On attend que {otherName} fasse son gage… 🥹
        </p>
      )}
    </div>
  );
}

// ─────────── Fin ───────────
function DoneView({ state, room, mySlot, onBackToMenu, onReplay }: {
  state: TState; room: Room; mySlot: number; onBackToMenu: () => void; onReplay: () => void;
}) {
  useEffect(() => { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }, []);
  const score = state.score ?? 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center", padding: "0 16px" }}>
      <motion.div
        initial={{ scale: 0, y: 20 }} animate={{ scale: [0, 1.3, 1], y: 0 }}
        transition={{ duration: 0.5, times: [0, 0.6, 1] }}
        style={{ fontSize: 80, lineHeight: 1 }}
      >
        🗼
      </motion.div>
      <h2 style={{ fontFamily: SERIF, fontSize: 36, fontStyle: "italic", color: "#fff", margin: 0 }}>Belle tour !</h2>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.42)", margin: 0 }}>
        {score} bloc{score !== 1 ? "s" : ""} empilés ensemble
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320, marginTop: 8 }}>
        {mySlot === 1 ? (
          <motion.button
            whileTap={{ scale: 0.95 }} onClick={onReplay}
            style={{ height: 52, borderRadius: 16, border: "none", background: `linear-gradient(135deg, ${SKY}, #6366f1)`, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: `0 0 20px ${SKY}44` }}
          >
            Rejouer 🔁
          </motion.button>
        ) : (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>En attente de la décision…</p>
        )}
        <motion.button
          whileTap={{ scale: 0.95 }} onClick={onBackToMenu}
          style={{ height: 52, borderRadius: 16, border: "1.5px solid rgba(255,255,255,0.13)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
        >
          ← Retour au menu
        </motion.button>
      </div>
    </div>
  );
}
