import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

const supabase = _supabase as any;

// ── Constants
const ARENA_W = 300;
const ARENA_H = 520;
const PUCK_R = 16;
const PADDLE_R = 28;
const GOAL_W = ARENA_W * 0.38;
const GOAL_X1 = (ARENA_W - GOAL_W) / 2;
const GOAL_X2 = GOAL_X1 + GOAL_W;
const MAX_SCORE = 5;
const PUCK_SPEED_INIT = 5.5;
const PUCK_SPEED_MAX = 14;
const FRICTION = 0.995;

// ── Colors
const NIGHT_BG = "linear-gradient(160deg, oklch(0.12 0.06 220) 0%, oklch(0.09 0.04 230) 100%)";
const CYAN = "#00e5ff";
const ROSE = "#f472b6";
const BLUE = "#60a5fa";
const GOLD = "#fbbf24";

// ── Types
type Vec = { x: number; y: number };
type Phase = "intro" | "play" | "done";
type State = { phase: Phase; score_1: number; score_2: number };

// ── Supabase helpers
function patch(roomId: string, p: Partial<State>) {
  return supabase.from("rooms").update({ minigame_state: p }).eq("id", roomId).then(() => undefined);
}
async function mergePatch(roomId: string, p: Partial<State>) {
  const { data } = await supabase.from("rooms").select("minigame_state").eq("id", roomId).maybeSingle();
  const prev = ((data?.minigame_state ?? {}) as State) || {};
  await supabase.from("rooms").update({ minigame_state: { ...prev, ...p } }).eq("id", roomId);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ── Ambient orb
function Orb({ x, y, color, size, delay }: { x: string; y: string; color: string; size: number; delay: number }) {
  return (
    <motion.div
      style={{
        position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)",
        width: size, height: size, borderRadius: "50%",
        background: color, filter: "blur(60px)", opacity: 0, pointerEvents: "none",
      }}
      animate={{ opacity: [0, 0.18, 0] }}
      transition={{ delay, duration: 5, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
    />
  );
}

// ── Props
interface Props {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
}

// ── Root export
export function AirHockey({ room, mySlot, myName, otherName, onBackToMenu }: Props) {
  const s = (room.minigame_state ?? {}) as State;

  useEffect(() => {
    if (Object.keys(s).length === 0 && mySlot === 1)
      void patch(room.id, { phase: "intro", score_1: 0, score_2: 0 });
  }, []);

  if (!s.phase || s.phase === "intro")
    return <IntroView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onBackToMenu={onBackToMenu} />;
  if (s.phase === "play")
    return <GameView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  return <DoneView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onBackToMenu={onBackToMenu} />;
}

// ── IntroView
function IntroView({ state, room, mySlot, myName, otherName, onBackToMenu }: Props & { state: State }) {
  const start = async () => {
    await patch(room.id, { phase: "play", score_1: 0, score_2: 0 });
  };

  return (
    <div style={{
      minHeight: "100dvh", background: NIGHT_BG, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden",
      fontFamily: "Work Sans, sans-serif",
    }}>
      <Orb x="20%" y="30%" color={CYAN} size={300} delay={0} />
      <Orb x="80%" y="70%" color={ROSE} size={250} delay={2} />
      <Orb x="50%" y="50%" color={BLUE} size={200} delay={1} />

      <motion.button whileTap={{ scale: 0.92 }} onClick={onBackToMenu} style={{
        position: "absolute", top: 24, left: 20,
        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12, padding: "8px 16px", color: "rgba(255,255,255,0.7)",
        fontSize: 13, cursor: "pointer",
      }}>← Retour</motion.button>

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, zIndex: 1, padding: "0 28px" }}>

        {/* Puck icon */}
        <motion.div
          animate={{
            y: [0, -14, 0],
            boxShadow: [`0 0 20px ${CYAN}88`, `0 0 56px ${CYAN}cc`, `0 0 20px ${CYAN}88`],
          }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          style={{
            width: 86, height: 86, borderRadius: "50%",
            background: `radial-gradient(circle at 32% 32%, #ffffff55, ${CYAN}cc)`,
            border: `3px solid ${CYAN}`, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <span style={{ fontSize: 38 }}>🏒</span>
        </motion.div>

        <h1 style={{
          fontFamily: "Cormorant Garamond, serif", fontSize: 44, fontWeight: 700,
          color: "#fff", margin: 0, textShadow: `0 0 32px ${CYAN}88`, letterSpacing: 1,
        }}>Air Hockey</h1>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, margin: 0 }}>
          Premier à {MAX_SCORE} buts gagne
        </p>

        {/* Players */}
        <div style={{ display: "flex", gap: 40, marginTop: 4 }}>
          {[
            { name: myName,    color: mySlot === 1 ? ROSE : BLUE, label: mySlot === 1 ? "Toi · Bas"  : "Toi · Haut"  },
            { name: otherName, color: mySlot === 1 ? BLUE : ROSE, label: mySlot === 1 ? "Lui · Haut" : "Lui · Bas"   },
          ].map((p, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.15 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 54, height: 54, borderRadius: "50%",
                background: `${p.color}22`, border: `2px solid ${p.color}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 700, color: p.color,
                boxShadow: `0 0 18px ${p.color}44`,
              }}>{p.name[0]?.toUpperCase()}</div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{p.name}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>{p.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Instructions */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 16, padding: "14px 22px", maxWidth: 300, textAlign: "center",
          }}>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, margin: 0, lineHeight: 1.65 }}>
            Glisse ton doigt pour bouger ton palet.<br />
            Défends ton but · Attaque celui de l'autre.
          </p>
        </motion.div>

        {mySlot === 1 ? (
          <motion.button whileTap={{ scale: 0.94 }} onClick={start} style={{
            marginTop: 6, padding: "14px 52px", borderRadius: 14,
            border: `1.5px solid ${CYAN}88`,
            background: `linear-gradient(135deg, ${CYAN}33, ${CYAN}11)`,
            color: CYAN, fontSize: 16, fontWeight: 700, cursor: "pointer",
            letterSpacing: 0.5, boxShadow: `0 0 28px ${CYAN}44`,
          }}>Lancer 🏒</motion.button>
        ) : (
          <motion.div animate={{ opacity: [0.45, 1, 0.45] }} transition={{ repeat: Infinity, duration: 1.5 }}
            style={{ marginTop: 6, color: "rgba(255,255,255,0.38)", fontSize: 14 }}>
            En attente de {otherName}…
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ── GameView
function GameView({ state, room, mySlot, myName, otherName }: Omit<Props, "onBackToMenu"> & { state: State }) {
  const arenaRef = useRef<HTMLDivElement>(null);
  const myPaddleRef = useRef<Vec>({ x: ARENA_W / 2, y: mySlot === 1 ? ARENA_H - 70 : 70 });
  const otherPaddleRef = useRef<Vec>({ x: ARENA_W / 2, y: mySlot === 1 ? 70 : ARENA_H - 70 });
  const puckRef = useRef<Vec>({ x: ARENA_W / 2, y: ARENA_H / 2 });
  const puckVelRef = useRef<Vec>({ x: 0, y: 0 });
  const isHost = mySlot === 1;

  const [myPaddle, setMyPaddle] = useState<Vec>(myPaddleRef.current);
  const [otherPaddle, setOtherPaddle] = useState<Vec>(otherPaddleRef.current);
  const [puck, setPuck] = useState<Vec>({ x: ARENA_W / 2, y: ARENA_H / 2 });
  const [score, setScore] = useState({ s1: state.score_1 ?? 0, s2: state.score_2 ?? 0 });
  const [goalFlash, setGoalFlash] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const rafRef = useRef<number>(0);
  const channelRef = useRef<any>(null);
  const playingRef = useRef(false);
  const scoringRef = useRef(false);

  // Sync score from Supabase realtime
  useEffect(() => {
    setScore({ s1: state.score_1 ?? 0, s2: state.score_2 ?? 0 });
  }, [state.score_1, state.score_2]);

  // ── Broadcast channel
  useEffect(() => {
    const ch = supabase.channel(`airhockey-${room.id}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "paddle" }, (msg: { payload: { slot: number; x: number; y: number } }) => {
      const p = msg.payload;
      if (p.slot !== mySlot) {
        otherPaddleRef.current = { x: p.x, y: p.y };
        setOtherPaddle({ x: p.x, y: p.y });
      }
    });
    if (!isHost) {
      ch.on("broadcast", { event: "puck" }, (msg: { payload: { x: number; y: number; vx: number; vy: number } }) => {
        const p = msg.payload;
        puckRef.current = { x: p.x, y: p.y };
        puckVelRef.current = { x: p.vx, y: p.vy };
        setPuck({ x: p.x, y: p.y });
      });
    }
    ch.subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [room.id]);

  // ── Restart puck after goal
  const launchPuck = () => {
    scoringRef.current = true;
    playingRef.current = false;
    puckRef.current = { x: ARENA_W / 2, y: ARENA_H / 2 };
    puckVelRef.current = { x: 0, y: 0 };
    setPuck({ x: ARENA_W / 2, y: ARENA_H / 2 });
    setCountdown(3);
    let c = 3;
    const iv = setInterval(() => {
      c--;
      if (c <= 0) {
        clearInterval(iv);
        setCountdown(null);
        scoringRef.current = false;
        playingRef.current = true;
        const angle = (Math.PI / 6) + Math.random() * (Math.PI * 2 / 3);
        const dir = Math.random() > 0.5 ? 1 : -1;
        puckVelRef.current = {
          x: Math.cos(angle) * PUCK_SPEED_INIT * (Math.random() > 0.5 ? 1 : -1),
          y: Math.sin(angle) * PUCK_SPEED_INIT * dir,
        };
      } else {
        setCountdown(c);
      }
    }, 1000);
  };

  // ── Physics loop (host only)
  useEffect(() => {
    if (!isHost) return;
    playingRef.current = true;
    // Initial velocity
    const dir = Math.random() > 0.5 ? 1 : -1;
    puckVelRef.current = {
      x: (Math.random() - 0.5) * PUCK_SPEED_INIT * 1.2,
      y: PUCK_SPEED_INIT * dir,
    };

    const loop = () => {
      if (playingRef.current && !scoringRef.current) {
        let { x, y } = puckRef.current;
        let { x: vx, y: vy } = puckVelRef.current;

        x += vx;
        y += vy;

        // Left/right wall bounce
        if (x - PUCK_R < 0) { x = PUCK_R; vx = Math.abs(vx); }
        if (x + PUCK_R > ARENA_W) { x = ARENA_W - PUCK_R; vx = -Math.abs(vx); }

        // Paddle collisions
        for (const paddle of [myPaddleRef.current, otherPaddleRef.current]) {
          const dx = x - paddle.x;
          const dy = y - paddle.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = PUCK_R + PADDLE_R;
          if (dist < minDist && dist > 0.5) {
            const nx = dx / dist;
            const ny = dy / dist;
            // Push out
            x = paddle.x + nx * (minDist + 1);
            y = paddle.y + ny * (minDist + 1);
            // Reflect
            const dot = vx * nx + vy * ny;
            vx = vx - 2 * dot * nx;
            vy = vy - 2 * dot * ny;
            // Speed boost
            const speed = Math.sqrt(vx * vx + vy * vy);
            const newSpeed = Math.min(speed * 1.06 + 0.3, PUCK_SPEED_MAX);
            if (speed > 0) { vx = (vx / speed) * newSpeed; vy = (vy / speed) * newSpeed; }
          }
        }

        // Goal: top → slot 1 scores
        if (y - PUCK_R < 0) {
          if (x >= GOAL_X1 && x <= GOAL_X2) {
            scoringRef.current = true;
            playingRef.current = false;
            void (async () => {
              const { data } = await supabase.from("rooms").select("minigame_state").eq("id", room.id).maybeSingle();
              const prev = (data?.minigame_state ?? {}) as State;
              const ns1 = (prev.score_1 ?? 0) + 1;
              const ns2 = prev.score_2 ?? 0;
              const nextPhase: Phase = ns1 >= MAX_SCORE ? "done" : "play";
              await supabase.from("rooms").update({ minigame_state: { ...prev, phase: nextPhase, score_1: ns1, score_2: ns2 } }).eq("id", room.id);
              if (nextPhase !== "done") {
                setGoalFlash(1);
                setTimeout(() => setGoalFlash(null), 1400);
                launchPuck();
              }
            })();
            y = PUCK_R; vy = Math.abs(vy);
          } else {
            y = PUCK_R; vy = Math.abs(vy);
          }
        }

        // Goal: bottom → slot 2 scores
        if (y + PUCK_R > ARENA_H) {
          if (x >= GOAL_X1 && x <= GOAL_X2) {
            scoringRef.current = true;
            playingRef.current = false;
            void (async () => {
              const { data } = await supabase.from("rooms").select("minigame_state").eq("id", room.id).maybeSingle();
              const prev = (data?.minigame_state ?? {}) as State;
              const ns1 = prev.score_1 ?? 0;
              const ns2 = (prev.score_2 ?? 0) + 1;
              const nextPhase: Phase = ns2 >= MAX_SCORE ? "done" : "play";
              await supabase.from("rooms").update({ minigame_state: { ...prev, phase: nextPhase, score_1: ns1, score_2: ns2 } }).eq("id", room.id);
              if (nextPhase !== "done") {
                setGoalFlash(2);
                setTimeout(() => setGoalFlash(null), 1400);
                launchPuck();
              }
            })();
            y = ARENA_H - PUCK_R; vy = -Math.abs(vy);
          } else {
            y = ARENA_H - PUCK_R; vy = -Math.abs(vy);
          }
        }

        vx *= FRICTION;
        vy *= FRICTION;

        puckRef.current = { x, y };
        puckVelRef.current = { x: vx, y: vy };
        setPuck({ x, y });

        channelRef.current?.send({ type: "broadcast", event: "puck", payload: { x, y, vx, vy } });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [isHost, room.id]);

  // ── Pointer input
  useEffect(() => {
    const arena = arenaRef.current;
    if (!arena) return;
    const move = (e: PointerEvent) => {
      const rect = arena.getBoundingClientRect();
      const lx = (e.clientX - rect.left) * (ARENA_W / rect.width);
      const ly = (e.clientY - rect.top) * (ARENA_H / rect.height);
      const minY = mySlot === 1 ? ARENA_H / 2 + PADDLE_R : PADDLE_R;
      const maxY = mySlot === 1 ? ARENA_H - PADDLE_R : ARENA_H / 2 - PADDLE_R;
      const cx = clamp(lx, PADDLE_R, ARENA_W - PADDLE_R);
      const cy = clamp(ly, minY, maxY);
      myPaddleRef.current = { x: cx, y: cy };
      setMyPaddle({ x: cx, y: cy });
      channelRef.current?.send({ type: "broadcast", event: "paddle", payload: { slot: mySlot, x: cx, y: cy } });
    };
    const down = (e: PointerEvent) => { try { arena.setPointerCapture(e.pointerId); } catch(_) {} move(e); };
    arena.addEventListener("pointermove", move, { passive: true });
    arena.addEventListener("pointerdown", down as EventListener, { passive: true });
    return () => {
      arena.removeEventListener("pointermove", move);
      arena.removeEventListener("pointerdown", down as EventListener);
    };
  }, [mySlot]);

  // ── Helpers
  const lx = (v: number) => `${(v / ARENA_W) * 100}%`;
  const ly = (v: number) => `${(v / ARENA_H) * 100}%`;

  const myColor = mySlot === 1 ? ROSE : BLUE;
  const otherColor = mySlot === 1 ? BLUE : ROSE;
  const myScore = mySlot === 1 ? score.s1 : score.s2;
  const otherScore = mySlot === 1 ? score.s2 : score.s1;

  return (
    <div style={{
      minHeight: "100dvh", background: NIGHT_BG, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden",
      fontFamily: "Work Sans, sans-serif", userSelect: "none", touchAction: "none",
    }}>
      <Orb x="10%" y="15%" color={CYAN} size={200} delay={0} />
      <Orb x="90%" y="85%" color={ROSE} size={180} delay={1.5} />

      {/* Score HUD */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        padding: "14px 20px 12px", display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 10, background: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
          <span style={{ fontSize: 11, color: otherColor, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 }}>{otherName}</span>
          <span style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 46, fontWeight: 700, color: otherColor, lineHeight: 1, textShadow: `0 0 20px ${otherColor}88` }}>{otherScore}</span>
        </div>
        <div style={{ width: 1, height: 44, background: "rgba(255,255,255,0.14)", margin: "0 16px" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
          <span style={{ fontSize: 11, color: myColor, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 }}>{myName}</span>
          <span style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 46, fontWeight: 700, color: myColor, lineHeight: 1, textShadow: `0 0 20px ${myColor}88` }}>{myScore}</span>
        </div>
      </div>

      {/* Arena */}
      <div ref={arenaRef} style={{
        position: "relative", width: "min(88vw, 340px)", aspectRatio: `${ARENA_W}/${ARENA_H}`,
        borderRadius: 20, overflow: "hidden",
        background: "linear-gradient(180deg, oklch(0.15 0.08 220) 0%, oklch(0.10 0.06 220) 100%)",
        border: "2px solid rgba(0,229,255,0.22)",
        boxShadow: "0 0 60px rgba(0,229,255,0.1), inset 0 0 40px rgba(0,0,0,0.5)",
        cursor: "none",
      }}>
        {/* Grid lines */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06, pointerEvents: "none" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <line key={`v${i}`} x1={`${(i + 1) * (100 / 7)}%`} y1="0" x2={`${(i + 1) * (100 / 7)}%`} y2="100%" stroke="white" strokeWidth="1" />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={`${(i + 1) * (100 / 11)}%`} x2="100%" y2={`${(i + 1) * (100 / 11)}%`} stroke="white" strokeWidth="1" />
          ))}
        </svg>

        {/* Center line */}
        <div style={{ position: "absolute", left: "5%", right: "5%", top: "50%", height: 1, background: "rgba(255,255,255,0.13)", transform: "translateY(-50%)" }} />
        {/* Center circle */}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "30%", paddingBottom: "30%", borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.11)" }} />
        {/* Center dot */}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.28)" }} />

        {/* Top goal zone (opponent) */}
        <div style={{
          position: "absolute", top: 0,
          left: `${(GOAL_X1 / ARENA_W) * 100}%`, width: `${(GOAL_W / ARENA_W) * 100}%`,
          height: 9,
          background: mySlot === 1 ? `${BLUE}99` : `${ROSE}99`,
          boxShadow: mySlot === 1 ? `0 4px 14px ${BLUE}88` : `0 4px 14px ${ROSE}88`,
        }} />
        <div style={{ position: "absolute", top: 0, left: `${(GOAL_X1 / ARENA_W) * 100}%`, width: 3, height: 18, background: "rgba(255,255,255,0.55)", borderRadius: "0 0 2px 2px" }} />
        <div style={{ position: "absolute", top: 0, left: `${(GOAL_X2 / ARENA_W) * 100}%`, width: 3, height: 18, background: "rgba(255,255,255,0.55)", borderRadius: "0 0 2px 2px", transform: "translateX(-100%)" }} />

        {/* Bottom goal zone (mine) */}
        <div style={{
          position: "absolute", bottom: 0,
          left: `${(GOAL_X1 / ARENA_W) * 100}%`, width: `${(GOAL_W / ARENA_W) * 100}%`,
          height: 9,
          background: mySlot === 1 ? `${ROSE}99` : `${BLUE}99`,
          boxShadow: mySlot === 1 ? `0 -4px 14px ${ROSE}88` : `0 -4px 14px ${BLUE}88`,
        }} />
        <div style={{ position: "absolute", bottom: 0, left: `${(GOAL_X1 / ARENA_W) * 100}%`, width: 3, height: 18, background: "rgba(255,255,255,0.55)", borderRadius: "2px 2px 0 0" }} />
        <div style={{ position: "absolute", bottom: 0, left: `${(GOAL_X2 / ARENA_W) * 100}%`, width: 3, height: 18, background: "rgba(255,255,255,0.55)", borderRadius: "2px 2px 0 0", transform: "translateX(-100%)" }} />

        {/* Other paddle */}
        <div style={{
          position: "absolute", left: lx(otherPaddle.x), top: ly(otherPaddle.y),
          transform: "translate(-50%,-50%)",
          width: `${(PADDLE_R * 2 / ARENA_W) * 100}%`, aspectRatio: "1",
          borderRadius: "50%",
          background: `radial-gradient(circle at 32% 32%, ${otherColor}66, ${otherColor}33)`,
          border: `2.5px solid ${otherColor}`,
          boxShadow: `0 0 22px ${otherColor}88, 0 0 8px ${otherColor}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "clamp(8px,2vw,12px)", fontWeight: 700, color: "#fff",
        }}>{otherName[0]?.toUpperCase()}</div>

        {/* My paddle */}
        <div style={{
          position: "absolute", left: lx(myPaddle.x), top: ly(myPaddle.y),
          transform: "translate(-50%,-50%)",
          width: `${(PADDLE_R * 2 / ARENA_W) * 100}%`, aspectRatio: "1",
          borderRadius: "50%",
          background: `radial-gradient(circle at 32% 32%, ${myColor}66, ${myColor}33)`,
          border: `2.5px solid ${myColor}`,
          boxShadow: `0 0 22px ${myColor}cc, 0 0 8px ${myColor}66`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "clamp(8px,2vw,12px)", fontWeight: 700, color: "#fff",
        }}>{myName[0]?.toUpperCase()}</div>

        {/* Puck */}
        <div style={{
          position: "absolute", left: lx(puck.x), top: ly(puck.y),
          transform: "translate(-50%,-50%)",
          width: `${(PUCK_R * 2 / ARENA_W) * 100}%`, aspectRatio: "1",
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, #ffffff99, ${CYAN}cc)`,
          border: `1.5px solid ${CYAN}ee`,
          boxShadow: `0 0 18px ${CYAN}dd, 0 0 6px ${CYAN}`,
          zIndex: 5,
        }} />

        {/* Goal flash */}
        <AnimatePresence>
          {goalFlash !== null && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                position: "absolute", inset: 0,
                background: goalFlash === mySlot ? `${myColor}1a` : `${otherColor}1a`,
                backdropFilter: "blur(1px)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10,
              }}>
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.3, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 18 }}
                style={{
                  fontFamily: "Cormorant Garamond, serif", fontSize: 60, fontWeight: 700,
                  color: "#fff",
                  textShadow: `0 0 32px ${goalFlash === mySlot ? myColor : otherColor}`,
                }}>
                {goalFlash === mySlot ? "⚡ But !" : "😬 But !"}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Countdown */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: "absolute", inset: 0, backdropFilter: "blur(5px)",
                background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center",
                justifyContent: "center", zIndex: 10,
              }}>
              <AnimatePresence mode="wait">
                <motion.div key={countdown}
                  initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.6, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                  style={{
                    fontFamily: "Cormorant Garamond, serif", fontSize: 88, fontWeight: 700,
                    color: CYAN, textShadow: `0 0 50px ${CYAN}`,
                  }}>{countdown}</motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Goal labels */}
      <div style={{ display: "flex", width: "min(88vw, 340px)", justifyContent: "space-between", marginTop: 10, padding: "0 4px" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 0.3 }}>
          ↑ But de {otherName}
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 0.3 }}>
          Ton but ↓
        </span>
      </div>
    </div>
  );
}

// ── DoneView
function DoneView({ state, room, mySlot, myName, otherName, onBackToMenu }: Props & { state: State }) {
  const s1 = state.score_1 ?? 0;
  const s2 = state.score_2 ?? 0;
  const iWon = (mySlot === 1 && s1 > s2) || (mySlot === 2 && s2 > s1);
  const myScore = mySlot === 1 ? s1 : s2;
  const otherScore = mySlot === 1 ? s2 : s1;
  const myColor = mySlot === 1 ? ROSE : BLUE;
  const otherColor = mySlot === 1 ? BLUE : ROSE;

  return (
    <div style={{
      minHeight: "100dvh", background: NIGHT_BG, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden",
      fontFamily: "Work Sans, sans-serif",
    }}>
      <Orb x="20%" y="30%" color={CYAN} size={300} delay={0} />
      <Orb x="80%" y="70%" color={iWon ? GOLD : ROSE} size={250} delay={1} />

      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, zIndex: 1, padding: "0 28px", textAlign: "center" }}>

        <motion.div
          animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.12, 1] }}
          transition={{ delay: 0.5, duration: 1.2 }}
          style={{ fontSize: 76 }}>
          {iWon ? "🏆" : "💪"}
        </motion.div>

        <h1 style={{
          fontFamily: "Cormorant Garamond, serif", fontSize: 42, fontWeight: 700,
          color: "#fff", margin: 0,
          textShadow: iWon ? `0 0 30px ${GOLD}88` : "none",
        }}>{iWon ? "Victoire !" : "Défaite !"}</h1>
        <p style={{ color: "rgba(255,255,255,0.48)", margin: 0, fontSize: 15 }}>
          {iWon ? `Tu as dominé ${otherName} 🔥` : `${otherName} t'a eu cette fois !`}
        </p>

        {/* Score card */}
        <div style={{
          display: "flex", alignItems: "center", gap: 24,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20, padding: "22px 44px",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: myColor, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>{myName}</div>
            <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 60, fontWeight: 700, color: myColor, lineHeight: 1, textShadow: `0 0 20px ${myColor}66` }}>{myScore}</div>
          </div>
          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 30, color: "rgba(255,255,255,0.22)" }}>–</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: otherColor, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>{otherName}</div>
            <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 60, fontWeight: 700, color: otherColor, lineHeight: 1, textShadow: `0 0 20px ${otherColor}66` }}>{otherScore}</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 280 }}>
          {mySlot === 1 && (
            <motion.button whileTap={{ scale: 0.94 }}
              onClick={() => patch(room.id, { phase: "play", score_1: 0, score_2: 0 })}
              style={{
                padding: "14px", borderRadius: 14,
                border: `1.5px solid ${CYAN}88`,
                background: `linear-gradient(135deg, ${CYAN}33, ${CYAN}11)`,
                color: CYAN, fontSize: 15, fontWeight: 700, cursor: "pointer",
                boxShadow: `0 0 24px ${CYAN}33`,
              }}>Revanche 🏒</motion.button>
          )}
          <motion.button whileTap={{ scale: 0.94 }} onClick={onBackToMenu} style={{
            padding: "13px", borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.68)", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>Retour au menu</motion.button>
        </div>
      </motion.div>
    </div>
  );
}
