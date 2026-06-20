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
const SERIF   = "'Cormorant Garamond', Georgia, serif";

// ─────────── Réglages physique ───────────
const VIEW_W      = 360;
const VIEW_H      = 520;
const BALL_R      = 11;
const GRAVITY     = 1500;     // px/s²
const JUMP_V      = 400;      // px/s impulsion vers le haut
const RING_R      = 90;       // rayon centre anneau
const ARC_TOL     = 0.09;     // tolérance radians bord d'arc
const RING_GAP    = 230;      // distance verticale entre anneaux
const COUNTDOWN_S = 3;
const BROADCAST_HZ = 5;
const TRAIL_LEN   = 14;

// 4 couleurs néon pour les arcs
const COLORS = ["#f43f5e", "#fbbf24", "#4ade80", "#38bdf8"];
const COLOR_NAMES = ["Rose", "Ambre", "Émeraude", "Ciel"];

// Epaisseur anneau par niveau
const RING_THICK_BY_LEVEL: Record<DareLevel, number> = {
  simple: 18, medium: 14, ultra: 10,
};

const LEVEL_CFG: Record<DareLevel, { color: string; glow: string; desc: string; rotMult: number; gapMult: number; emoji: string }> = {
  simple: { color: EMERALD, glow: `${EMERALD}44`, desc: "Anneaux lents · arcs larges",  rotMult: 0.65, gapMult: 1.15, emoji: "🌿" },
  medium: { color: AMBER,   glow: `${AMBER}44`,   desc: "Vitesse normale",               rotMult: 1.00, gapMult: 1.00, emoji: "⚡" },
  ultra:  { color: ROSE,    glow: `${ROSE}44`,    desc: "Anneaux rapides · arcs fins",   rotMult: 1.55, gapMult: 0.82, emoji: "🔥" },
};

// ─────────── Types ───────────
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

type SharedProps = {
  state: TState;
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
};

type Ring    = { y: number; rotation: number; rotSpeed: number; passed: boolean };
type Pickup  = { y: number; color: number; taken: boolean };
type TrailPt = { x: number; y: number };

// ─────────── Utils ───────────
function stableIndex(seed: string, max: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % max;
}

function freshReset(): TState {
  return {
    game: "bounce", phase: "level_select",
    level_1: null, level_2: null, level: null, started_at: null,
    score_live_1: 0, score_live_2: 0,
    done_1: false, done_2: false,
    score_1: 0, score_2: 0,
    winner_slot: null, wheel_index: null, dare_text: null,
  };
}

async function patchState(roomId: string, partial: Record<string, unknown>) {
  await supabase.rpc("minigame_patch", { _room_id: roomId, _patch: partial });
}

async function dbUpdate(roomId: string, state: TState) {
  await supabase.from("rooms").update({ minigame_state: state }).eq("id", roomId);
}

// ─────────── ColorBounce ───────────
export function ColorBounce({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s     = (room.minigame_state ?? {}) as TState;
  const phase = s.phase ?? "level_select";

  useEffect(() => {
    if ((Object.keys(s).length === 0 || s.game !== "bounce") && mySlot === 1) {
      void dbUpdate(room.id, freshReset());
    }
  }, [room.id, s, mySlot]);

  const shared: SharedProps = { state: s, room, mySlot, myName, otherName };

  return (
    <div style={{
      minHeight: "100dvh", background: BG,
      display: "flex", flexDirection: "column",
      padding: "14px 14px 28px", gap: 12,
      fontFamily: "'Inter', system-ui, sans-serif", color: "#fff",
      touchAction: "manipulation",
    }}>
      {phase === "level_select"                    && <LevelSelect {...shared} />}
      {(phase === "countdown" || phase === "play") && <PlayView    {...shared} />}
      {phase === "result"                          && <Result       {...shared} />}
      {phase === "dare"  && <DareView  {...shared} onDareDone={onDareDone} />}
      {phase === "done"  && (
        <DoneView
          mySlot={mySlot}
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
    const startAt = Date.now() + (COUNTDOWN_S + 1) * 1000;
    await patchState(room.id, {
      phase: "countdown", level: chosen, started_at: startAt,
      score_live_1: 0, score_live_2: 0,
      done_1: false, done_2: false,
      score_1: 0, score_2: 0,
      winner_slot: null, wheel_index: null, dare_text: null,
    });
  };

  const chosenLevel = (mine ?? "medium") as DareLevel;

  return (
    <>
      <div style={{ textAlign: "center", paddingTop: 6 }}>
        <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, color: "rgba(255,255,255,0.32)", margin: 0 }}>
          Rebond 🌈
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: 34, fontStyle: "italic", color: "#fff", margin: "4px 0 0", lineHeight: 1 }}>
          Franchis les <em>couleurs</em>
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 6, marginBottom: 0 }}>
          Rebondis pour passer dans l'arc de la bonne couleur
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
        {(Object.keys(LEVEL_CFG) as DareLevel[]).map((l, idx) => {
          const cfg     = LEVEL_CFG[l];
          const iPicked = mine === l;
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
                display: "flex", alignItems: "center", gap: 14,
                textAlign: "left", borderRadius: 18,
              }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                background: `${cfg.color}18`, border: `2px solid ${cfg.color}55`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, boxShadow: iPicked ? `0 0 14px ${cfg.glow}` : "none",
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
                    {iPicked  && <span style={{ fontSize: 10, background: `${cfg.color}20`, border: `1px solid ${cfg.color}55`, color: cfg.color, borderRadius: 20, padding: "2px 8px" }}>Toi ✓</span>}
                    {theyPick && <span style={{ fontSize: 10, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", borderRadius: 20, padding: "2px 8px" }}>{otherName} ✓</span>}
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
            ? (mySlot === 1 ? "Top départ ! 🌈" : `${otherName} va lancer…`)
            : "En attente du niveau commun…"}
        </motion.button>
      </div>
    </>
  );
}

// ─────────── Jeu ───────────
function PlayView({ state, room, mySlot, myName, otherName }: SharedProps) {
  const level      = (state.level ?? "medium") as DareLevel;
  const cfg        = LEVEL_CFG[level];
  const ringThick  = RING_THICK_BY_LEVEL[level];
  const startedAt  = state.started_at ?? Date.now();
  const otherLive  = mySlot === 1 ? (state.score_live_2 ?? 0) : (state.score_live_1 ?? 0);
  const otherDone  = mySlot === 1 ? !!state.done_2 : !!state.done_1;
  const iAmDone    = mySlot === 1 ? !!state.done_1 : !!state.done_2;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 80);
    return () => clearInterval(t);
  }, []);
  const msToStart  = startedAt - now;
  const inCountdown = msToStart > 0;

  // Countdown → play (slot 1)
  useEffect(() => {
    if (state.phase === "countdown" && !inCountdown && mySlot === 1) {
      void patchState(room.id, { phase: "play" });
    }
  }, [state.phase, inCountdown, mySlot, room.id]);

  const canvasRef   = useRef<HTMLCanvasElement | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [ballColorIdx, setBallColorIdx] = useState(0);
  const [finalScore, setFinalScore]     = useState<number | null>(null);
  const [shake, setShake]               = useState(false);

  const scoreRef   = useRef(0);
  const ringsRef   = useRef<Ring[]>([]);
  const pickupsRef = useRef<Pickup[]>([]);
  const ballRef    = useRef({ x: VIEW_W / 2, y: 0, vy: 0, color: 0 });
  const cameraRef  = useRef(0);
  const flashRef   = useRef(0);          // score flash (positive = success color flash)
  const deathFlashRef = useRef(0);       // red flash on death
  const trailRef   = useRef<TrailPt[]>([]);
  const deadRef    = useRef(false);
  const wantJumpRef = useRef(false);

  const playing = state.phase === "play" && !iAmDone;

  // Pré-calculer les étoiles (static per session)
  const starsRef = useRef(
    Array.from({ length: 70 }, () => ({
      x: Math.random() * VIEW_W,
      y: Math.random() * VIEW_H * 3,
      a: Math.random() * 0.35 + 0.05,
      s: Math.random() < 0.12 ? 2 : 1,
    }))
  );

  // Init monde
  useEffect(() => {
    if (state.phase !== "play" && state.phase !== "countdown") return;
    scoreRef.current = 0;
    deadRef.current  = false;
    flashRef.current = 0;
    deathFlashRef.current = 0;
    trailRef.current = [];
    ballRef.current  = { x: VIEW_W / 2, y: 0, vy: -JUMP_V * 0.5, color: 0 };
    cameraRef.current = 0;
    setDisplayScore(0);
    setBallColorIdx(0);
    setFinalScore(null);

    const gap    = RING_GAP * cfg.gapMult;
    const rings: Ring[] = [];
    for (let i = 1; i <= 50; i++) {
      const base = 0.65 + Math.min(2.2, i * 0.035);
      rings.push({
        y: -i * gap,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: base * cfg.rotMult * (Math.random() < 0.5 ? -1 : 1),
        passed: false,
      });
    }
    const pickups: Pickup[] = [];
    for (let i = 1; i <= 50; i++) {
      pickups.push({ y: -i * gap + gap / 2, color: Math.floor(Math.random() * 4), taken: false });
    }
    ringsRef.current   = rings;
    pickupsRef.current = pickups;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.started_at, level]);

  // Boucle physique + rendu
  useEffect(() => {
    if (!playing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width  = VIEW_W * dpr;
    canvas.height = VIEW_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf  = 0;
    let last = performance.now();

    const checkRing = (ring: Ring): "ok" | "out" | "none" => {
      const ball  = ballRef.current;
      const inner = RING_R - ringThick / 2 - BALL_R * 0.55;
      const outer = RING_R + ringThick / 2 + BALL_R * 0.55;
      const dist  = Math.hypot(ball.x - VIEW_W / 2, ball.y - ring.y);
      if (dist < inner || dist > outer) return "none";
      const realAngle = Math.atan2(ball.y - ring.y, ball.x - VIEW_W / 2);
      let a = realAngle - ring.rotation;
      while (a < 0)           a += Math.PI * 2;
      while (a >= Math.PI * 2) a -= Math.PI * 2;
      const arcIdx = Math.floor(a / (Math.PI / 2)) % 4;
      const within = a - arcIdx * (Math.PI / 2);
      if (within < ARC_TOL || within > Math.PI / 2 - ARC_TOL) return "none";
      return arcIdx === ball.color ? "ok" : "out";
    };

    const die = () => {
      if (deadRef.current) return;
      deadRef.current = true;
      deathFlashRef.current = 14;
      const score = scoreRef.current;
      setFinalScore(score);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      void patchState(room.id, mySlot === 1
        ? { done_1: true, score_1: score, score_live_1: score }
        : { done_2: true, score_2: score, score_live_2: score });
    };

    const loop = (ts: number) => {
      const dt = Math.min(0.033, (ts - last) / 1000);
      last = ts;

      const ball = ballRef.current;
      if (wantJumpRef.current && !deadRef.current) {
        ball.vy = -JUMP_V;
        wantJumpRef.current = false;
      }

      // Physique
      ball.vy += GRAVITY * dt;
      ball.y  += ball.vy  * dt;
      for (const r of ringsRef.current) r.rotation += r.rotSpeed * dt;

      // Caméra
      const targetCam = ball.y - VIEW_H * 0.38;
      if (targetCam < cameraRef.current) cameraRef.current = targetCam;

      // Trail
      const trail = trailRef.current;
      trail.unshift({ x: ball.x, y: ball.y });
      if (trail.length > TRAIL_LEN) trail.pop();

      // Game over si hors écran
      if (ball.y > cameraRef.current + VIEW_H + BALL_R * 2) die();

      // Pickups
      for (const p of pickupsRef.current) {
        if (p.taken) continue;
        if (Math.abs(ball.y - p.y) < BALL_R + 14 && Math.abs(ball.x - VIEW_W / 2) < BALL_R + 14) {
          p.taken    = true;
          ball.color = p.color;
          setBallColorIdx(p.color);
          flashRef.current = 10;
        }
      }

      // Collisions
      for (const r of ringsRef.current) {
        if (r.passed) continue;
        const res = checkRing(r);
        if (res === "out") { die(); break; }
        if (ball.y < r.y - RING_R - BALL_R) {
          r.passed = true;
          scoreRef.current++;
          flashRef.current = 8;
          setDisplayScore(scoreRef.current);
          if (scoreRef.current % 5 === 0) {
            confetti({ particleCount: 20, spread: 50, origin: { y: 0.45 }, scalar: 0.8, ticks: 60 });
          }
        }
      }

      // ─── Rendu canvas ───
      const camY   = cameraRef.current;
      const screenY = (wy: number) => wy - camY;
      const ballSY  = screenY(ball.y);
      const ballCol = COLORS[ball.color];

      // Fond
      ctx.fillStyle = "#050510";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // Étoiles (léger parallaxe)
      for (const star of starsRef.current) {
        const sy = ((star.y + camY * 0.08) % (VIEW_H * 3) + VIEW_H * 3) % (VIEW_H * 3);
        if (sy > VIEW_H) continue;
        ctx.fillStyle = `rgba(255,255,255,${star.a})`;
        ctx.fillRect(star.x, sy, star.s, star.s);
      }

      // Halo ambiance balle
      const ambGrad = ctx.createRadialGradient(VIEW_W / 2, ballSY, 10, VIEW_W / 2, ballSY, 200);
      ambGrad.addColorStop(0, `${ballCol}22`);
      ambGrad.addColorStop(1, "transparent");
      ctx.fillStyle = ambGrad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // ─── Anneaux ───
      const nextRings = ringsRef.current.filter(r => !r.passed);
      const targetRing = nextRings[0] ?? null;

      ctx.lineCap = "butt";
      for (const r of ringsRef.current) {
        const sy = screenY(r.y);
        if (sy < -RING_R - 40 || sy > VIEW_H + RING_R + 40) continue;
        const cx      = VIEW_W / 2;
        const isTarget = r === targetRing;
        const thick   = isTarget ? ringThick + 3 : ringThick;

        for (let i = 0; i < 4; i++) {
          const col = COLORS[i];
          const a0  = r.rotation + i * (Math.PI / 2);
          const a1  = a0 + Math.PI / 2;

          // Glow
          ctx.shadowColor = col;
          ctx.shadowBlur  = isTarget ? 22 : 10;
          ctx.strokeStyle = col;
          ctx.lineWidth   = thick;
          ctx.beginPath();
          ctx.arc(cx, sy, RING_R, a0, a1);
          ctx.stroke();

          // Highlight intérieur
          ctx.shadowBlur  = 0;
          ctx.strokeStyle = "rgba(255,255,255,0.18)";
          ctx.lineWidth   = 2;
          ctx.beginPath();
          ctx.arc(cx, sy, RING_R - thick * 0.3, a0, a1);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // Indicateur de passage (couleur qui sera à π/2 quand la balle arrive)
        if (isTarget || r === nextRings[1]) {
          let a = Math.PI / 2 - r.rotation;
          while (a < 0)           a += Math.PI * 2;
          while (a >= Math.PI * 2) a -= Math.PI * 2;
          const arcAtEntry = Math.floor(a / (Math.PI / 2)) % 4;
          const entryCol   = COLORS[arcAtEntry];
          const isMatch    = arcAtEntry === ball.color;
          const dotX = cx + Math.cos(Math.PI / 2) * (RING_R + ringThick / 2 + 10);
          const dotY = sy + Math.sin(Math.PI / 2) * (RING_R + ringThick / 2 + 10);

          ctx.shadowColor = entryCol;
          ctx.shadowBlur  = isMatch ? 18 : 7;
          ctx.fillStyle   = isMatch ? entryCol : `${entryCol}99`;
          ctx.beginPath();
          ctx.arc(dotX, dotY, isMatch ? 7 : 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Flèche si c'est le target ring et correspondance OK
          if (isTarget && isMatch) {
            ctx.globalAlpha = 0.75;
            ctx.fillStyle   = entryCol;
            ctx.shadowBlur  = 12;
            ctx.beginPath();
            ctx.moveTo(dotX, dotY - 16);
            ctx.lineTo(dotX - 6, dotY - 8);
            ctx.lineTo(dotX + 6, dotY - 8);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.shadowBlur = 0;
        }
      }

      // ─── Pickups ───
      const pulse = (Math.sin(ts / 280) + 1) / 2;
      for (const p of pickupsRef.current) {
        if (p.taken) continue;
        const py = screenY(p.y);
        if (py < -20 || py > VIEW_H + 20) continue;
        const col = COLORS[p.color];

        ctx.shadowColor = col;
        ctx.shadowBlur  = 8 + pulse * 18;
        ctx.fillStyle   = col;
        ctx.beginPath();
        ctx.arc(VIEW_W / 2, py, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(255,255,255,${0.3 + pulse * 0.5})`;
        ctx.lineWidth   = 1.5;
        ctx.shadowBlur  = 0;
        ctx.beginPath();
        ctx.arc(VIEW_W / 2, py, 12 + pulse * 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // ─── Trail de la balle ───
      for (let i = trail.length - 1; i >= 0; i--) {
        const t  = trail[i];
        const tsy = screenY(t.y);
        const tr = BALL_R * (1 - (i + 1) / (trail.length + 1)) * 0.9;
        const ta = (1 - (i + 1) / (trail.length + 1)) * 0.55;
        ctx.globalAlpha = ta;
        ctx.fillStyle   = ballCol;
        ctx.beginPath();
        ctx.arc(t.x, tsy, tr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ─── Balle ───
      ctx.shadowColor = ballCol;
      ctx.shadowBlur  = 24;
      ctx.fillStyle   = ballCol;
      ctx.beginPath();
      ctx.arc(ball.x, ballSY, BALL_R, 0, Math.PI * 2);
      ctx.fill();

      // Anneau coloré autour de la balle
      ctx.strokeStyle = `${ballCol}99`;
      ctx.lineWidth   = 2.5;
      ctx.beginPath();
      ctx.arc(ball.x, ballSY, BALL_R + 4 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Reflet
      ctx.fillStyle   = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(ball.x - 3, ballSY - 3, BALL_R * 0.32, 0, Math.PI * 2);
      ctx.fill();

      // ─── Flash succès (couleur balle) ───
      if (flashRef.current > 0) {
        ctx.globalAlpha = flashRef.current / 10 * 0.22;
        ctx.fillStyle   = ballCol;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.globalAlpha = 1;
        flashRef.current--;
      }

      // ─── Flash mort (rouge) ───
      if (deathFlashRef.current > 0) {
        ctx.globalAlpha = deathFlashRef.current / 14 * 0.55;
        ctx.fillStyle   = "#ff1a1a";
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.globalAlpha = 1;
        deathFlashRef.current--;
      }

      if (!deadRef.current) raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, level, room.id, mySlot, ringThick]);

  // Broadcast score live
  useEffect(() => {
    if (!playing) return;
    let lastBroadcast = -1;
    const t = setInterval(() => {
      const sc = scoreRef.current;
      if (sc === lastBroadcast) return;
      lastBroadcast = sc;
      void patchState(room.id, mySlot === 1 ? { score_live_1: sc } : { score_live_2: sc });
    }, 1000 / BROADCAST_HZ);
    return () => clearInterval(t);
  }, [playing, room.id, mySlot]);

  // Fin des deux → résultat
  useEffect(() => {
    if (state.phase !== "play") return;
    if (!state.done_1 || !state.done_2 || mySlot !== 1 || state.winner_slot != null) return;
    const s1 = state.score_1 ?? 0;
    const s2 = state.score_2 ?? 0;
    const winner: 0 | 1 | 2 = s1 === s2 ? 0 : s1 > s2 ? 1 : 2;
    const lvl  = (state.level ?? "simple") as DareLevel;
    const pool = getGagesPool(room.ambiance, lvl) ?? GAGES_BY_LEVEL[lvl];
    const seed = `${room.id}-bounce-${lvl}-${s1}-${s2}-${winner}`;
    const idx  = stableIndex(seed, pool.length);
    void patchState(room.id, {
      phase: "result", winner_slot: winner,
      wheel_index: idx,
      dare_text: winner === 0 ? null : pool[idx],
    });
  }, [state, mySlot, room.id]);

  const ballColor = COLORS[ballColorIdx];

  return (
    <>
      {/* Header */}
      <div style={{ ...glass, padding: "10px 16px", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "rgba(255,255,255,0.32)" }}>Score</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: ballColor, textShadow: `0 0 14px ${ballColor}99` }}>
            {displayScore}
          </div>
        </div>
        {/* Indicateur couleur active */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: ballColor,
            boxShadow: `0 0 14px ${ballColor}, 0 0 28px ${ballColor}66`,
            border: "2px solid rgba(255,255,255,0.3)",
          }} />
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", letterSpacing: 1 }}>
            {COLOR_NAMES[ballColorIdx].toUpperCase()}
          </span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(255,255,255,0.32)" }}>{otherName}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
            {otherLive} {otherDone && "🏁"}
          </div>
        </div>
      </div>

      {/* Arène */}
      <motion.div
        animate={shake ? { x: [0, -7, 7, -5, 5, -2, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        onPointerDown={() => { if (playing) wantJumpRef.current = true; }}
        style={{
          position: "relative",
          width: "100%", maxWidth: 380, margin: "0 auto",
          aspectRatio: `${VIEW_W} / ${VIEW_H}`,
          borderRadius: 24, overflow: "hidden",
          border: playing ? `2px solid ${cfg.color}66` : "2px solid rgba(255,255,255,0.09)",
          boxShadow: playing
            ? `0 0 30px ${cfg.glow}, inset 0 0 60px rgba(0,0,0,0.5)`
            : "inset 0 0 60px rgba(0,0,0,0.5)",
          touchAction: "none", userSelect: "none",
          cursor: playing ? "pointer" : "default",
          flexShrink: 0,
          background: "#050510",
          transition: "border-color 0.3s, box-shadow 0.3s",
        }}
      >
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />

        {/* Overlay countdown */}
        <AnimatePresence>
          {state.phase === "countdown" && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: "rgba(0,0,0,0.70)", backdropFilter: "blur(6px)", gap: 12,
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={inCountdown ? Math.ceil(msToStart / 1000) : "go"}
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{ fontFamily: SERIF, fontSize: 88, fontStyle: "italic", color: "#fff", textShadow: `0 0 40px ${cfg.color}`, lineHeight: 1 }}
                >
                  {inCountdown ? Math.ceil(msToStart / 1000) : "GO !"}
                </motion.div>
              </AnimatePresence>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0 }}>
                Tape l'écran pour rebondir !
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overlay fin */}
        <AnimatePresence>
          {iAmDone && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", gap: 10,
              }}
            >
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }}
                transition={{ duration: 0.4 }}
                style={{ fontSize: 64 }}
              >
                🌈
              </motion.div>
              <p style={{ fontFamily: SERIF, fontSize: 36, fontStyle: "italic", color: "#fff", margin: 0 }}>
                {finalScore ?? scoreRef.current} <span style={{ fontSize: 18, color: "rgba(255,255,255,0.5)" }}>franchis</span>
              </p>
              <motion.p
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0 }}
              >
                {otherDone ? "On compare les scores…" : `En attente de ${otherName}…`}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Instruction */}
      <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.28)", margin: 0 }}>
        {playing
          ? "👆 Tape pour rebondir · passe dans le bon arc"
          : inCountdown ? "Prépare-toi…" : "—"}
      </p>

      {/* Légende des couleurs */}
      {playing && (
        <div style={{ display: "flex", justifyContent: "center", gap: 14 }}>
          {COLORS.map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%", background: c,
                boxShadow: ballColorIdx === i ? `0 0 8px ${c}` : "none",
                border: ballColorIdx === i ? `1.5px solid rgba(255,255,255,0.6)` : `1.5px solid ${c}55`,
              }} />
              <span style={{ fontSize: 10, color: ballColorIdx === i ? "#fff" : "rgba(255,255,255,0.35)", fontWeight: ballColorIdx === i ? 700 : 400 }}>
                {COLOR_NAMES[i]}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─────────── Résultat ───────────
function Result({ state, room, mySlot, myName, otherName }: SharedProps) {
  const s1     = state.score_1 ?? 0;
  const s2     = state.score_2 ?? 0;
  const myScore    = mySlot === 1 ? s1 : s2;
  const otherScore = mySlot === 1 ? s2 : s1;
  const winner = state.winner_slot ?? 0;
  const iWon   = winner === mySlot;
  const tie    = winner === 0;
  const topColor = tie ? AMBER : iWon ? EMERALD : ROSE;

  useEffect(() => {
    if (iWon) confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    const t = setTimeout(() => {
      if (mySlot === 1) void patchState(room.id, { phase: tie ? "done" : "dare" });
    }, 2600);
    return () => clearTimeout(t);
  }, [iWon, tie, mySlot, room.id]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center", padding: "0 16px" }}>
      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: [0, 1.3, 1], rotate: [0, 5, 0] }}
        transition={{ duration: 0.5, times: [0, 0.65, 1] }}
        style={{ fontSize: 80, lineHeight: 1 }}
      >
        {tie ? "🤝" : iWon ? "🏆" : "🌈"}
      </motion.div>

      <div style={{ ...glass, padding: "20px 24px", width: "100%", maxWidth: 320, borderRadius: 24, border: `1px solid ${topColor}33` }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 32, fontStyle: "italic", color: topColor, margin: "0 0 16px", textShadow: `0 0 20px ${topColor}66` }}>
          {tie ? "Match nul 💕" : iWon ? "Tu gagnes !" : `${otherName} gagne !`}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { name: myName,    score: myScore    },
            { name: otherName, score: otherScore },
          ].map(({ name, score }) => (
            <div key={name} style={{ ...glass, padding: "12px 8px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
              <p style={{ margin: "0 0 4px", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(255,255,255,0.38)" }}>{name}</p>
              <p style={{ margin: 0, fontFamily: SERIF, fontSize: 30, fontStyle: "italic", color: "#fff" }}>{score}</p>
            </div>
          ))}
        </div>
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
function DoneView({ mySlot, onBackToMenu, onReplay }: {
  mySlot: number; onBackToMenu: () => void; onReplay: () => void;
}) {
  useEffect(() => {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  }, []);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center", padding: "0 16px" }}>
      <motion.div
        initial={{ scale: 0, y: 20 }} animate={{ scale: [0, 1.3, 1], y: 0 }}
        transition={{ duration: 0.5, times: [0, 0.6, 1] }}
        style={{ fontSize: 80, lineHeight: 1 }}
      >
        🌈
      </motion.div>
      <h2 style={{ fontFamily: SERIF, fontSize: 36, fontStyle: "italic", color: "#fff", margin: 0 }}>Joli rebond !</h2>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.42)", margin: 0 }}>On en refait une ?</p>

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
