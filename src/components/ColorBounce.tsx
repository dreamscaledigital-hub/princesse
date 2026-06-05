import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";
import { GAGES_BY_LEVEL, LEVEL_LABELS, type DareLevel } from "@/lib/game-content";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ─────────── RÉGLAGES PHYSIQUE / JEU ───────────
const VIEW_W = 360;
const VIEW_H = 560;
const BALL_R = 11;
const GRAVITY = 1500;          // px/s²
const JUMP_V = 400;             // px/s impulsion (rebonds plus petits)
const RING_R = 92;              // rayon des anneaux
const RING_THICK = 14;
const ARC_TOL = 0.08;           // tolérance radians sur la collision d'arc
const RING_GAP = 230;           // distance verticale entre anneaux
const COUNTDOWN_S = 3;
const BROADCAST_HZ = 5;

const COLORS = ["#ff5fa2", "#ffd23f", "#4ed1c1", "#5d9bff"]; // rose, jaune, turquoise, bleu
const COLOR_NAMES = ["rose", "jaune", "turquoise", "bleu"];

const LEVEL_INFO: Record<DareLevel, { emoji: string; gradient: string; desc: string; rotMult: number; gapMult: number }> = {
  simple: { emoji: "🟢", gradient: "from-emerald-200 to-teal-200", desc: "Anneaux lents",  rotMult: 0.7, gapMult: 1.1 },
  medium: { emoji: "🟡", gradient: "from-amber-200 to-orange-300", desc: "Vitesse normale", rotMult: 1.0, gapMult: 1.0 },
  ultra:  { emoji: "🔴", gradient: "from-rose-300 to-red-400",     desc: "Folie colorée",   rotMult: 1.5, gapMult: 0.85 },
};

type TPhase = "level_select" | "countdown" | "play" | "result" | "dare" | "done";

type TState = {
  game?: "bounce";
  phase?: TPhase;
  level_1?: DareLevel | null;
  level_2?: DareLevel | null;
  level?: DareLevel | null;
  started_at?: number | null;
  score_live_1?: number;
  score_live_2?: number;
  done_1?: boolean;
  done_2?: boolean;
  score_1?: number;
  score_2?: number;
  winner_slot?: 0 | 1 | 2 | null;
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

const update = (roomId: string, patchObj: TState) =>
  supabase.from("rooms").update({ minigame_state: patchObj }).eq("id", roomId);

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
    game: "bounce",
    phase: "level_select",
    level_1: null, level_2: null, level: null,
    started_at: null,
    score_live_1: 0, score_live_2: 0,
    done_1: false, done_2: false,
    score_1: 0, score_2: 0,
    winner_slot: null, wheel_index: null, dare_text: null,
  };
}

export function ColorBounce({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s = (room.minigame_state ?? {}) as TState;
  const phase = s.phase ?? "level_select";

  useEffect(() => {
    if ((Object.keys(s).length === 0 || s.game !== "bounce") && mySlot === 1) {
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
  return <DoneView mySlot={mySlot} onBackToMenu={onBackToMenu} onReplay={async () => { await update(room.id, freshReset()); }} />;
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
      score_live_1: 0, score_live_2: 0,
      done_1: false, done_2: false,
      score_1: 0, score_2: 0,
      winner_slot: null, wheel_index: null, dare_text: null,
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Rebond 🌈</p>
        <h1 className="mt-1 font-serif text-4xl text-primary">Franchis les <span className="italic">couleurs</span></h1>
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
          {match ? (mySlot === 1 ? "Top départ ! 🌈" : `${otherName} va lancer…`) : "En attente du niveau commun…"}
        </Button>
      </div>
    </div>
  );
}

// ─────────── Jeu principal ───────────
type Ring = { y: number; rotation: number; rotSpeed: number; passed: boolean };
type Pickup = { y: number; color: number; taken: boolean };

function PlayView({ state, room, mySlot, myName, otherName }:
  { state: TState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const level = (state.level ?? "medium") as DareLevel;
  const info = LEVEL_INFO[level];

  const startedAt = state.started_at ?? Date.now();
  const otherScoreLive = mySlot === 1 ? (state.score_live_2 ?? 0) : (state.score_live_1 ?? 0);
  const otherDone = mySlot === 1 ? !!state.done_2 : !!state.done_1;
  const iAmDone = mySlot === 1 ? !!state.done_1 : !!state.done_2;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  const msToStart = startedAt - now;
  const inCountdown = msToStart > 0;
  const countLabel = msToStart > 3000 ? "Prêt ?" : msToStart > 0 ? `${Math.ceil(msToStart / 1000)}` : "GO !";

  useEffect(() => {
    if (state.phase === "countdown" && !inCountdown && mySlot === 1) {
      void patch(room.id, { phase: "play" });
    }
  }, [state.phase, inCountdown, mySlot, room.id]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const scoreRef = useRef(0);
  const [, force] = useState(0);

  const playing = state.phase === "play" && !iAmDone;

  // Refs pour la boucle de jeu (évite recréations)
  const ringsRef = useRef<Ring[]>([]);
  const pickupsRef = useRef<Pickup[]>([]);
  const ballRef = useRef<{ x: number; y: number; vy: number; color: number }>({ x: VIEW_W / 2, y: 0, vy: 0, color: 0 });
  const cameraRef = useRef(0);   // décalage monde (la balle commence à y=0, monte en y négatif)
  const flashRef = useRef(0);
  const deadRef = useRef(false);
  const wantJumpRef = useRef(false);

  // Initialisation du monde quand on entre en play
  useEffect(() => {
    if (state.phase !== "play" && state.phase !== "countdown") return;
    // Reset complet
    scoreRef.current = 0;
    deadRef.current = false;
    flashRef.current = 0;
    ballRef.current = { x: VIEW_W / 2, y: 0, vy: -JUMP_V * 0.5, color: 0 };
    cameraRef.current = 0;
    const gap = RING_GAP * info.gapMult;
    const rings: Ring[] = [];
    for (let i = 1; i <= 40; i++) {
      const baseSpeed = 0.7 + Math.min(2.0, i * 0.04);
      rings.push({
        y: -i * gap,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: baseSpeed * info.rotMult * (Math.random() < 0.5 ? -1 : 1),
        passed: false,
      });
    }
    const pickups: Pickup[] = [];
    for (let i = 1; i <= 40; i++) {
      pickups.push({ y: -i * gap + gap / 2, color: Math.floor(Math.random() * COLORS.length), taken: false });
    }
    ringsRef.current = rings;
    pickupsRef.current = pickups;
    force((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.started_at, level]);

  // Boucle physique + rendu canvas
  useEffect(() => {
    if (!playing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Setup HiDPI
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = VIEW_W * dpr;
    canvas.height = VIEW_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    let last = performance.now();

    const checkRingCollision = (ring: Ring): "ok" | "out" | "none" => {
      const ball = ballRef.current;
      const dy = ball.y - ring.y;
      const dist = Math.abs(dy); // x est centré, donc dist = |dy| (ring centré à x = VIEW_W/2)
      // Approche : la balle ne traverse que verticalement (centrée x). Quand elle est dans l'anneau (dist ≈ R)
      const inner = RING_R - RING_THICK / 2 - BALL_R * 0.6;
      const outer = RING_R + RING_THICK / 2 + BALL_R * 0.6;
      if (dist < inner) return "none"; // à l'intérieur, traversée libre
      if (dist > outer) return "none"; // à l'extérieur
      // On touche l'anneau : déterminer l'arc selon l'angle
      // angle de la balle par rapport au centre de l'anneau
      const angle = Math.atan2(dy, 0.0001); // x diff ~ 0, donc ±π/2
      // En fait, la balle est centrée X = ring centre X, donc dy détermine si on touche le haut ou le bas
      // Angle réel : atan2(ball.y - ring.y, ball.x - ring.x)
      const cx = VIEW_W / 2;
      const realAngle = Math.atan2(ball.y - ring.y, ball.x - cx);
      // Rotation de l'arc considéré
      let a = realAngle - ring.rotation;
      while (a < 0) a += Math.PI * 2;
      while (a >= Math.PI * 2) a -= Math.PI * 2;
      // 4 arcs de π/2 chacun
      const arcIdx = Math.floor(a / (Math.PI / 2)) % 4;
      // Tolérance proche du bord d'arc
      const within = a - arcIdx * (Math.PI / 2);
      if (within < ARC_TOL || within > Math.PI / 2 - ARC_TOL) return "none";
      // L'arc i a la couleur i
      return arcIdx === ball.color ? "ok" : "out";
      void angle;
    };

    const die = () => {
      if (deadRef.current) return;
      deadRef.current = true;
      const score = scoreRef.current;
      setFinalScore(score);
      void patch(room.id, mySlot === 1
        ? { done_1: true, score_1: score, score_live_1: score }
        : { done_2: true, score_2: score, score_live_2: score });
    };

    const loop = (ts: number) => {
      const dt = Math.min(0.033, (ts - last) / 1000);
      last = ts;

      const ball = ballRef.current;
      if (wantJumpRef.current) {
        ball.vy = -JUMP_V;
        wantJumpRef.current = false;
      }

      // Physique
      ball.vy += GRAVITY * dt;
      ball.y += ball.vy * dt;

      // Anneaux : rotation
      for (const r of ringsRef.current) r.rotation += r.rotSpeed * dt;

      // Caméra : suit la balle quand elle est haute
      const targetCam = ball.y - VIEW_H * 0.35;
      if (targetCam < cameraRef.current) cameraRef.current = targetCam;

      // Game over si la balle tombe sous l'écran
      if (ball.y > cameraRef.current + VIEW_H + BALL_R * 2) {
        die();
      }

      // Pickups (changeurs de couleur)
      for (const p of pickupsRef.current) {
        if (p.taken) continue;
        const dy = ball.y - p.y;
        if (Math.abs(dy) < BALL_R + 10 && Math.abs(ball.x - VIEW_W / 2) < BALL_R + 10) {
          p.taken = true;
          ball.color = p.color;
          flashRef.current = 8;
        }
      }

      // Collisions anneaux
      for (const r of ringsRef.current) {
        if (r.passed) continue;
        const res = checkRingCollision(r);
        if (res === "out") { die(); break; }
        // Marquer comme franchi quand la balle est au-dessus
        if (ball.y < r.y - RING_R - BALL_R) {
          r.passed = true;
          scoreRef.current += 1;
          flashRef.current = 6;
          force((n) => n + 1);
        }
      }

      // ─── Rendu ───
      ctx.fillStyle = "#0e0a1a";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // Halos d'ambiance
      const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.3, 20, VIEW_W / 2, VIEW_H * 0.3, 280);
      grad.addColorStop(0, "rgba(255, 95, 162, 0.10)");
      grad.addColorStop(1, "rgba(14, 10, 26, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      const camY = cameraRef.current;
      const screenY = (worldY: number) => worldY - camY;

      // Anneaux visibles
      ctx.lineWidth = RING_THICK;
      ctx.lineCap = "butt";
      for (const r of ringsRef.current) {
        const sy = screenY(r.y);
        if (sy < -RING_R - 20 || sy > VIEW_H + RING_R + 20) continue;
        const cx = VIEW_W / 2;
        for (let i = 0; i < 4; i++) {
          ctx.strokeStyle = COLORS[i];
          ctx.beginPath();
          const a0 = r.rotation + i * (Math.PI / 2);
          const a1 = a0 + Math.PI / 2;
          ctx.arc(cx, sy, RING_R, a0, a1);
          ctx.stroke();
        }
      }

      // Pickups
      for (const p of pickupsRef.current) {
        if (p.taken) continue;
        const sy = screenY(p.y);
        if (sy < -20 || sy > VIEW_H + 20) continue;
        ctx.fillStyle = COLORS[p.color];
        ctx.beginPath();
        ctx.arc(VIEW_W / 2, sy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Balle
      const bsy = screenY(ball.y);
      ctx.shadowColor = COLORS[ball.color];
      ctx.shadowBlur = 18;
      ctx.fillStyle = COLORS[ball.color];
      ctx.beginPath();
      ctx.arc(ball.x, bsy, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Petit reflet
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(ball.x - 3, bsy - 3, BALL_R * 0.35, 0, Math.PI * 2);
      ctx.fill();

      if (flashRef.current > 0) flashRef.current -= 1;

      if (!deadRef.current) raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, level, room.id, mySlot, info.rotMult]);

  // Broadcast score live
  useEffect(() => {
    if (!playing) return;
    let last = -1;
    const t = setInterval(() => {
      const sc = scoreRef.current;
      if (sc === last) return;
      last = sc;
      void patch(room.id, mySlot === 1 ? { score_live_1: sc } : { score_live_2: sc });
    }, 1000 / BROADCAST_HZ);
    return () => clearInterval(t);
  }, [playing, room.id, mySlot]);

  // Fin des deux → result (slot 1 déclenche)
  useEffect(() => {
    if (state.phase !== "play") return;
    if (state.done_1 && state.done_2 && mySlot === 1 && state.winner_slot == null) {
      const s1 = state.score_1 ?? 0;
      const s2 = state.score_2 ?? 0;
      const winner: 0 | 1 | 2 = s1 === s2 ? 0 : s1 > s2 ? 1 : 2;
      const lvl = (state.level ?? "simple") as DareLevel;
      const pool = GAGES_BY_LEVEL[lvl];
      const seed = `${room.id}-bounce-${lvl}-${s1}-${s2}-${winner}`;
      const idx = stableIndex(seed, pool.length);
      void patch(room.id, {
        phase: "result",
        winner_slot: winner,
        wheel_index: idx,
        dare_text: winner === 0 ? null : pool[idx],
      });
    }
  }, [state, mySlot, room.id]);

  const myScore = scoreRef.current;
  const ballColorName = COLOR_NAMES[ballRef.current.color];
  const ballColor = COLORS[ballRef.current.color];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between text-xs">
        <span className="rounded-full bg-card/80 px-2 py-1 font-medium">
          🌈 <span className="font-bold text-primary">{myScore}</span>
        </span>
        <span className="flex items-center gap-1 rounded-full bg-card/80 px-2 py-1 font-medium">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: ballColor }} />
          {ballColorName}
        </span>
        <span className="rounded-full bg-card/80 px-2 py-1 font-medium">
          {otherName} : <span className="font-bold text-primary">{otherScoreLive}</span> {otherDone && "🏁"}
        </span>
      </div>

      <div
        onPointerDown={() => { if (playing) wantJumpRef.current = true; }}
        className="relative mx-auto mt-3 w-full max-w-sm touch-none select-none overflow-hidden rounded-3xl border-2 border-white/30 shadow-2xl"
        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, background: "#0e0a1a" }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block" }}
        />

        {/* Overlay countdown */}
        <AnimatePresence>
          {state.phase === "countdown" && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            >
              <motion.div
                key={countLabel}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.15, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="font-serif text-7xl italic text-white drop-shadow"
              >
                {countLabel}
              </motion.div>
            </motion.div>
          )}

          {iAmDone && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm"
            >
              <p className="text-5xl">🌈</p>
              <p className="font-serif text-3xl text-white">{finalScore ?? (mySlot === 1 ? state.score_1 : state.score_2)} franchis</p>
              <p className="text-sm text-white/70">
                {otherDone ? "On compare…" : `En attente de ${otherName}…`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        {playing ? "Tape l'écran pour rebondir 👆" : inCountdown ? "Prépare-toi…" : "—"}
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
        {tie ? "🤝" : iWon ? "🏆" : "🌈"}
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
function DareView({ state, room, mySlot, otherName, onDareDone }:
  { state: TState; room: Room; mySlot: number; myName: string; otherName: string; onDareDone: () => void }) {
  const winner = state.winner_slot ?? 0;
  const loserSlot = winner === 1 ? 2 : 1;
  const iLost = loserSlot === mySlot;
  const level = (state.level ?? "simple") as DareLevel;
  const dare = state.dare_text ?? GAGES_BY_LEVEL[level][0];

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
function DoneView({ mySlot, onBackToMenu, onReplay }:
  { mySlot: number; onBackToMenu: () => void; onReplay: () => void }) {
  useEffect(() => {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} className="text-8xl">🌈</motion.div>
      <h2 className="mt-6 font-serif text-4xl italic text-primary">Joli rebond !</h2>
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
