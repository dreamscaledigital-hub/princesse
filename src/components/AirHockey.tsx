import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

const supabase = _supabase as any;

// ── Logical arena dimensions
const AW = 300;
const AH = 520;
const PR = 15;        // puck radius
const PAD_R = 30;     // paddle radius
const GOAL_W = AW * 0.40;
const GOAL_X1 = (AW - GOAL_W) / 2;
const GOAL_X2 = GOAL_X1 + GOAL_W;
const MAX_SCORE = 5;
const SPEED_INIT = 7;
const SPEED_MAX  = 16;
const SPEED_MIN  = 4;   // puck never stops
const FRICTION   = 0.999; // almost frictionless — it's air!
const TRAIL_LEN  = 8;

// ── Colors
const BG     = "linear-gradient(160deg, oklch(0.12 0.06 220) 0%, oklch(0.09 0.04 230) 100%)";
const CYAN   = "#00e5ff";
const ROSE   = "#f472b6";
const BLUE   = "#60a5fa";
const GOLD   = "#fbbf24";

// ── Types
type Vec   = { x: number; y: number };
type Phase = "intro" | "play" | "done";
type State = { phase: Phase; score_1: number; score_2: number };

// ── Helpers
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// Convert logical pos → pixel inside arena
function toPx(pos: Vec, rect: DOMRect): Vec {
  return { x: (pos.x / AW) * rect.width, y: (pos.y / AH) * rect.height };
}
// Set element position via GPU-accelerated transform
function moveTo(el: HTMLDivElement | null, pos: Vec, rect: DOMRect | null) {
  if (!el || !rect) return;
  const { x, y } = toPx(pos, rect);
  el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
}

// ── Supabase
function patch(roomId: string, p: Partial<State>) {
  return supabase.from("rooms").update({ minigame_state: p }).eq("id", roomId).then(() => undefined);
}

// ── Ambient orb
function Orb({ x, y, color, size, delay }: { x: string; y: string; color: string; size: number; delay: number }) {
  return (
    <motion.div
      style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", width: size, height: size, borderRadius: "50%", background: color, filter: "blur(60px)", opacity: 0, pointerEvents: "none" }}
      animate={{ opacity: [0, 0.15, 0] }}
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

// ── Root
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

// ─────────────────────────────────────────────────────────────────────────────
// IntroView
// ─────────────────────────────────────────────────────────────────────────────
function IntroView({ state, room, mySlot, myName, otherName, onBackToMenu }: Props & { state: State }) {
  const myColor    = mySlot === 1 ? ROSE : BLUE;
  const otherColor = mySlot === 1 ? BLUE : ROSE;

  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: "Work Sans, sans-serif" }}>
      <Orb x="20%" y="30%" color={CYAN}  size={320} delay={0} />
      <Orb x="80%" y="70%" color={ROSE}  size={260} delay={2} />
      <Orb x="50%" y="52%" color={BLUE}  size={200} delay={1} />

      <motion.button whileTap={{ scale: 0.92 }} onClick={onBackToMenu} style={{ position: "absolute", top: 24, left: 20, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "8px 16px", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer" }}>← Retour</motion.button>

      <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, zIndex: 1, padding: "0 28px" }}>

        {/* Animated puck */}
        <motion.div
          animate={{ y: [0, -16, 0], boxShadow: [`0 0 24px ${CYAN}66`, `0 0 60px ${CYAN}cc`, `0 0 24px ${CYAN}66`] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          style={{ width: 90, height: 90, borderRadius: "50%", background: `radial-gradient(circle at 30% 30%, #ffffff66, ${CYAN}cc)`, border: `3px solid ${CYAN}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 40 }}>🏒</span>
        </motion.div>

        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 46, fontWeight: 700, color: "#fff", margin: "0 0 4px", textShadow: `0 0 36px ${CYAN}88`, letterSpacing: 1 }}>Air Hockey</h1>
          <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 14, margin: 0 }}>Premier à {MAX_SCORE} buts gagne</p>
        </div>

        {/* Player cards */}
        <div style={{ display: "flex", gap: 24, marginTop: 4 }}>
          {[
            { name: myName,    color: myColor,    label: mySlot === 1 ? "Toi · Bas"  : "Toi · Haut"  },
            { name: otherName, color: otherColor,  label: mySlot === 1 ? "Lui · Haut" : "Lui · Bas"   },
          ].map((p, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.12 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ width: 58, height: 58, borderRadius: "50%", background: `${p.color}1a`, border: `2.5px solid ${p.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: p.color, boxShadow: `0 0 20px ${p.color}44` }}>
                {p.name[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{p.name}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{p.label}</span>
            </motion.div>
          ))}
        </div>

        {/* How to play */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16, padding: "14px 22px", maxWidth: 300, textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.52)", fontSize: 13, margin: 0, lineHeight: 1.7 }}>
            Glisse ton doigt dans ta moitié du terrain.<br />
            Frappe le palet dans le but adverse.
          </p>
        </motion.div>

        {mySlot === 1 ? (
          <motion.button whileTap={{ scale: 0.93 }} onClick={() => patch(room.id, { phase: "play", score_1: 0, score_2: 0 })}
            style={{ marginTop: 4, padding: "15px 56px", borderRadius: 14, border: `1.5px solid ${CYAN}99`, background: `linear-gradient(135deg, ${CYAN}33, ${CYAN}11)`, color: CYAN, fontSize: 16, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5, boxShadow: `0 0 30px ${CYAN}44` }}>
            Lancer 🏒
          </motion.button>
        ) : (
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.6 }}
            style={{ marginTop: 4, color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
            En attente de {otherName}…
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GameView — direct DOM updates, paddle velocity transfer, trail
// ─────────────────────────────────────────────────────────────────────────────
function GameView({ state, room, mySlot, myName, otherName }: Omit<Props, "onBackToMenu"> & { state: State }) {
  // ── DOM refs for game objects
  const arenaRef       = useRef<HTMLDivElement>(null);
  const puckElRef      = useRef<HTMLDivElement>(null);
  const myPadElRef     = useRef<HTMLDivElement>(null);
  const otherPadElRef  = useRef<HTMLDivElement>(null);
  const trailEls       = useRef<(HTMLDivElement | null)[]>([]);

  // ── Game state refs (no React state for physics = 60fps)
  const myPos      = useRef<Vec>({ x: AW / 2, y: mySlot === 1 ? AH - 80 : 80 });
  const otherPos   = useRef<Vec>({ x: AW / 2, y: mySlot === 1 ? 80 : AH - 80 });
  const puckPos    = useRef<Vec>({ x: AW / 2, y: AH / 2 });
  const puckVel    = useRef<Vec>({ x: 0, y: 0 });
  const myPadVel   = useRef<Vec>({ x: 0, y: 0 }); // paddle velocity → transferred on hit
  const trail      = useRef<Vec[]>(Array(TRAIL_LEN).fill({ x: AW / 2, y: AH / 2 }));
  const arenaRect  = useRef<DOMRect | null>(null);

  const isHost = mySlot === 1;

  // ── React state only for HUD / overlays
  const [score,      setScore]     = useState({ s1: state.score_1 ?? 0, s2: state.score_2 ?? 0 });
  const [goalFlash,  setGoalFlash] = useState<{ scorer: number; key: number } | null>(null);
  const [countdown,  setCountdown] = useState<number | null>(null);
  const [shake,      setShake]     = useState(false);

  const channelRef  = useRef<any>(null);
  const rafRef      = useRef<number>(0);
  const playingRef  = useRef(false);
  const scoringRef  = useRef(false);

  // ── Sync score from Supabase realtime
  useEffect(() => {
    setScore({ s1: state.score_1 ?? 0, s2: state.score_2 ?? 0 });
  }, [state.score_1, state.score_2]);

  // ── ResizeObserver → keep arenaRect fresh + init positions
  useEffect(() => {
    const update = () => {
      if (!arenaRef.current) return;
      arenaRect.current = arenaRef.current.getBoundingClientRect();
      moveTo(myPadElRef.current,    myPos.current,    arenaRect.current);
      moveTo(otherPadElRef.current, otherPos.current, arenaRect.current);
      moveTo(puckElRef.current,     puckPos.current,  arenaRect.current);
    };
    update();
    const ro = new ResizeObserver(update);
    if (arenaRef.current) ro.observe(arenaRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Broadcast channel
  useEffect(() => {
    const ch = supabase.channel(`airhockey-${room.id}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "paddle" }, (msg: { payload: { slot: number; x: number; y: number } }) => {
      const p = msg.payload;
      if (p.slot !== mySlot) {
        otherPos.current = { x: p.x, y: p.y };
        moveTo(otherPadElRef.current, { x: p.x, y: p.y }, arenaRect.current);
      }
    });
    if (!isHost) {
      ch.on("broadcast", { event: "puck" }, (msg: { payload: { x: number; y: number; vx: number; vy: number } }) => {
        const { x, y, vx, vy } = msg.payload;
        puckPos.current = { x, y };
        puckVel.current = { x: vx, y: vy };
        moveTo(puckElRef.current, { x, y }, arenaRect.current);
      });
    }
    ch.subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [room.id, mySlot]);

  // ── Goal handler (called from physics loop)
  const handleGoal = (scorer: number) => {
    scoringRef.current = true;
    playingRef.current = false;
    puckPos.current = { x: AW / 2, y: AH / 2 };
    puckVel.current = { x: 0, y: 0 };
    trail.current   = Array(TRAIL_LEN).fill({ x: AW / 2, y: AH / 2 });
    moveTo(puckElRef.current, { x: AW / 2, y: AH / 2 }, arenaRect.current);
    trail.current.forEach((p, i) => moveTo(trailEls.current[i], p, arenaRect.current));

    setGoalFlash({ scorer, key: Date.now() });
    setShake(true);
    setTimeout(() => setShake(false), 500);
    setTimeout(() => setGoalFlash(null), 1600);

    setCountdown(3);
    let c = 3;
    const iv = setInterval(() => {
      c--;
      if (c <= 0) {
        clearInterval(iv);
        setCountdown(null);
        scoringRef.current = false;
        playingRef.current = true;
        // Serve toward the side that conceded
        const vy = scorer === 1 ? SPEED_INIT : -SPEED_INIT;
        const vx = (Math.random() - 0.5) * SPEED_INIT * 1.4;
        puckVel.current = { x: vx, y: vy };
      } else {
        setCountdown(c);
      }
    }, 1000);
  };

  // ── Physics loop (host only)
  useEffect(() => {
    if (!isHost) return;
    playingRef.current = true;
    // Initial serve
    const vy = (Math.random() > 0.5 ? 1 : -1) * SPEED_INIT;
    puckVel.current = { x: (Math.random() - 0.5) * SPEED_INIT * 1.2, y: vy };

    const loop = () => {
      if (playingRef.current && !scoringRef.current) {
        let { x, y }   = puckPos.current;
        let { x: vx, y: vy } = puckVel.current;

        x += vx;
        y += vy;

        // ── Side wall bounce
        if (x - PR < 0)   { x = PR;      vx =  Math.abs(vx); }
        if (x + PR > AW)  { x = AW - PR; vx = -Math.abs(vx); }

        // ── Paddle collisions (my paddle + other paddle)
        for (const [pad, pv] of [
          [myPos.current,    myPadVel.current],
          [otherPos.current, { x: 0, y: 0 }],
        ] as [Vec, Vec][]) {
          const dx   = x - pad.x;
          const dy   = y - pad.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const min  = PR + PAD_R;
          if (dist < min && dist > 0.1) {
            const nx = dx / dist;
            const ny = dy / dist;
            // Push puck out of overlap
            x = pad.x + nx * (min + 0.5);
            y = pad.y + ny * (min + 0.5);
            // Reflect only if approaching
            const dot = vx * nx + vy * ny;
            if (dot < 0) {
              vx -= 2 * dot * nx;
              vy -= 2 * dot * ny;
              // Transfer paddle velocity
              vx += pv.x * 0.6;
              vy += pv.y * 0.6;
              // Clamp speed
              const spd = Math.sqrt(vx * vx + vy * vy);
              if (spd > 0) {
                const newSpd = Math.min(Math.max(spd, SPEED_MIN + 1), SPEED_MAX);
                vx = (vx / spd) * newSpd;
                vy = (vy / spd) * newSpd;
              }
            }
          }
        }

        // ── Top wall / goal
        if (y - PR < 0) {
          if (x >= GOAL_X1 && x <= GOAL_X2 && !scoringRef.current) {
            scoringRef.current = true; // prevent re-entry
            void (async () => {
              const { data } = await supabase.from("rooms").select("minigame_state").eq("id", room.id).maybeSingle();
              const prev = (data?.minigame_state ?? {}) as State;
              const ns1 = (prev.score_1 ?? 0) + 1;
              const ns2 = prev.score_2 ?? 0;
              const next: Phase = ns1 >= MAX_SCORE ? "done" : "play";
              await supabase.from("rooms").update({ minigame_state: { ...prev, phase: next, score_1: ns1, score_2: ns2 } }).eq("id", room.id);
              if (next !== "done") handleGoal(1);
            })();
            y = PR; vy = Math.abs(vy);
          } else {
            y = PR; vy = Math.abs(vy);
          }
        }

        // ── Bottom wall / goal
        if (y + PR > AH) {
          if (x >= GOAL_X1 && x <= GOAL_X2 && !scoringRef.current) {
            scoringRef.current = true;
            void (async () => {
              const { data } = await supabase.from("rooms").select("minigame_state").eq("id", room.id).maybeSingle();
              const prev = (data?.minigame_state ?? {}) as State;
              const ns1 = prev.score_1 ?? 0;
              const ns2 = (prev.score_2 ?? 0) + 1;
              const next: Phase = ns2 >= MAX_SCORE ? "done" : "play";
              await supabase.from("rooms").update({ minigame_state: { ...prev, phase: next, score_1: ns1, score_2: ns2 } }).eq("id", room.id);
              if (next !== "done") handleGoal(2);
            })();
            y = AH - PR; vy = -Math.abs(vy);
          } else {
            y = AH - PR; vy = -Math.abs(vy);
          }
        }

        // ── Friction (minimal)
        vx *= FRICTION;
        vy *= FRICTION;

        // ── Min speed enforcement (puck never stalls)
        const spd = Math.sqrt(vx * vx + vy * vy);
        if (spd > 0 && spd < SPEED_MIN) {
          vx = (vx / spd) * SPEED_MIN;
          vy = (vy / spd) * SPEED_MIN;
        }

        // ── Update puck
        puckPos.current = { x, y };
        puckVel.current = { x: vx, y: vy };
        moveTo(puckElRef.current, { x, y }, arenaRect.current);

        // ── Update trail
        trail.current = [{ x, y }, ...trail.current.slice(0, TRAIL_LEN - 1)];
        trail.current.forEach((p, i) => moveTo(trailEls.current[i], p, arenaRect.current));

        // ── Broadcast puck
        channelRef.current?.send({ type: "broadcast", event: "puck", payload: { x, y, vx, vy } });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [isHost, room.id]);

  // ── Non-host trail loop
  useEffect(() => {
    if (isHost) return;
    const loop = () => {
      const { x, y } = puckPos.current;
      trail.current = [{ x, y }, ...trail.current.slice(0, TRAIL_LEN - 1)];
      trail.current.forEach((p, i) => moveTo(trailEls.current[i], p, arenaRect.current));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [isHost]);

  // ── Pointer input — instant, smooth, no React state
  useEffect(() => {
    const arena = arenaRef.current;
    if (!arena) return;

    let lastX = myPos.current.x;
    let lastY = myPos.current.y;

    const move = (e: PointerEvent) => {
      const rect = arenaRect.current ?? arena.getBoundingClientRect();
      const lx = (e.clientX - rect.left) * (AW / rect.width);
      const ly = (e.clientY - rect.top)  * (AH / rect.height);

      const minY = mySlot === 1 ? AH / 2 + PAD_R : PAD_R;
      const maxY = mySlot === 1 ? AH - PAD_R : AH / 2 - PAD_R;

      const cx = clamp(lx, PAD_R, AW - PAD_R);
      const cy = clamp(ly, minY, maxY);

      // Track paddle velocity for transfer
      myPadVel.current = { x: cx - lastX, y: cy - lastY };
      lastX = cx; lastY = cy;

      myPos.current = { x: cx, y: cy };
      moveTo(myPadElRef.current, { x: cx, y: cy }, rect);

      channelRef.current?.send({ type: "broadcast", event: "paddle", payload: { slot: mySlot, x: cx, y: cy } });
    };

    const down = (e: PointerEvent) => {
      try { arena.setPointerCapture(e.pointerId); } catch (_) {}
      move(e);
    };

    arena.addEventListener("pointermove", move, { passive: true });
    arena.addEventListener("pointerdown", down as EventListener, { passive: true });
    return () => {
      arena.removeEventListener("pointermove", move);
      arena.removeEventListener("pointerdown", down as EventListener);
    };
  }, [mySlot]);

  // ── Colors / HUD values
  const myColor    = mySlot === 1 ? ROSE : BLUE;
  const otherColor = mySlot === 1 ? BLUE : ROSE;
  const myScore    = mySlot === 1 ? score.s1 : score.s2;
  const otherScore = mySlot === 1 ? score.s2 : score.s1;
  const iScored    = goalFlash?.scorer === mySlot;
  const flashColor = iScored ? myColor : otherColor;

  // Progress pip helper
  const pips = (n: number, color: string) =>
    Array.from({ length: MAX_SCORE }).map((_, i) => (
      <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i < n ? color : "rgba(255,255,255,0.14)", boxShadow: i < n ? `0 0 6px ${color}` : "none", transition: "all 0.3s" }} />
    ));

  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: "Work Sans, sans-serif", userSelect: "none", touchAction: "none" }}>
      <Orb x="8%"  y="12%" color={CYAN} size={200} delay={0} />
      <Orb x="92%" y="88%" color={ROSE} size={180} delay={1.5} />

      {/* ── Score HUD */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "10px 16px 8px", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, background: "linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)" }}>
        {/* Opponent top */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
          <span style={{ fontSize: 10, color: otherColor, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 2 }}>{otherName}</span>
          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 46, fontWeight: 700, color: otherColor, lineHeight: 1, textShadow: `0 0 22px ${otherColor}88` }}>{otherScore}</div>
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>{pips(otherScore, otherColor)}</div>
        </div>
        <div style={{ width: 1, height: 52, background: "rgba(255,255,255,0.12)", margin: "0 12px" }} />
        {/* My score bottom */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
          <span style={{ fontSize: 10, color: myColor, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 2 }}>{myName}</span>
          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 46, fontWeight: 700, color: myColor, lineHeight: 1, textShadow: `0 0 22px ${myColor}88` }}>{myScore}</div>
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>{pips(myScore, myColor)}</div>
        </div>
      </div>

      {/* ── Arena */}
      <motion.div
        ref={arenaRef}
        animate={shake ? { x: [0, -10, 10, -7, 7, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.42, ease: "easeOut" }}
        style={{
          position: "relative",
          width: "min(88vw, 340px)",
          aspectRatio: `${AW}/${AH}`,
          borderRadius: 20,
          overflow: "hidden",
          background: "linear-gradient(180deg, oklch(0.14 0.08 220) 0%, oklch(0.10 0.06 220) 100%)",
          border: "2px solid rgba(0,229,255,0.22)",
          boxShadow: "0 0 60px rgba(0,229,255,0.10), inset 0 0 40px rgba(0,0,0,0.5)",
          cursor: "none",
        }}>

        {/* Grid */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.05, pointerEvents: "none" }}>
          {Array.from({ length: 6 }).map((_, i) => <line key={`v${i}`} x1={`${(i+1)*100/7}%`} y1="0" x2={`${(i+1)*100/7}%`} y2="100%" stroke="white" strokeWidth="1" />)}
          {Array.from({ length: 10 }).map((_, i) => <line key={`h${i}`} x1="0" y1={`${(i+1)*100/11}%`} x2="100%" y2={`${(i+1)*100/11}%`} stroke="white" strokeWidth="1" />)}
        </svg>

        {/* Center line & circle */}
        <div style={{ position: "absolute", left: "5%", right: "5%", top: "50%", height: 1, background: "rgba(255,255,255,0.11)", transform: "translateY(-50%)" }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "30%", paddingBottom: "30%", borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.09)" }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.22)" }} />

        {/* Top goal (opponent) */}
        <div style={{ position: "absolute", top: 0, left: `${(GOAL_X1/AW)*100}%`, width: `${(GOAL_W/AW)*100}%`, height: 10, background: mySlot === 1 ? `${BLUE}ee` : `${ROSE}ee`, boxShadow: mySlot === 1 ? `0 4px 18px ${BLUE}` : `0 4px 18px ${ROSE}` }} />
        <div style={{ position: "absolute", top: 0, left: `${(GOAL_X1/AW)*100}%`,          width: 4, height: 22, background: "rgba(255,255,255,0.6)", borderRadius: "0 0 2px 2px" }} />
        <div style={{ position: "absolute", top: 0, right: `${((AW-GOAL_X2)/AW)*100}%`,    width: 4, height: 22, background: "rgba(255,255,255,0.6)", borderRadius: "0 0 2px 2px" }} />

        {/* Bottom goal (mine) */}
        <div style={{ position: "absolute", bottom: 0, left: `${(GOAL_X1/AW)*100}%`, width: `${(GOAL_W/AW)*100}%`, height: 10, background: mySlot === 1 ? `${ROSE}ee` : `${BLUE}ee`, boxShadow: mySlot === 1 ? `0 -4px 18px ${ROSE}` : `0 -4px 18px ${BLUE}` }} />
        <div style={{ position: "absolute", bottom: 0, left: `${(GOAL_X1/AW)*100}%`,        width: 4, height: 22, background: "rgba(255,255,255,0.6)", borderRadius: "2px 2px 0 0" }} />
        <div style={{ position: "absolute", bottom: 0, right: `${((AW-GOAL_X2)/AW)*100}%`, width: 4, height: 22, background: "rgba(255,255,255,0.6)", borderRadius: "2px 2px 0 0" }} />

        {/* Puck trail */}
        {Array.from({ length: TRAIL_LEN }).map((_, i) => {
          const frac = 1 - i / TRAIL_LEN;
          return (
            <div key={`tr${i}`} ref={el => { trailEls.current[i] = el; }}
              style={{
                position: "absolute", left: 0, top: 0,
                width: `${((PR * 2 * frac * 0.85) / AW) * 100}%`, aspectRatio: "1",
                borderRadius: "50%", background: CYAN,
                opacity: frac * 0.32, filter: `blur(${i * 1.8}px)`,
                willChange: "transform", pointerEvents: "none",
              }} />
          );
        })}

        {/* Other paddle */}
        <div ref={otherPadElRef} style={{
          position: "absolute", left: 0, top: 0,
          width: `${(PAD_R*2/AW)*100}%`, aspectRatio: "1", borderRadius: "50%",
          background: `radial-gradient(circle at 32% 32%, ${otherColor}77, ${otherColor}33)`,
          border: `2.5px solid ${otherColor}`,
          boxShadow: `0 0 24px ${otherColor}88, 0 0 8px ${otherColor}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "clamp(8px,2vw,13px)", fontWeight: 700, color: "#fff",
          willChange: "transform",
        }}>{otherName[0]?.toUpperCase()}</div>

        {/* My paddle */}
        <div ref={myPadElRef} style={{
          position: "absolute", left: 0, top: 0,
          width: `${(PAD_R*2/AW)*100}%`, aspectRatio: "1", borderRadius: "50%",
          background: `radial-gradient(circle at 32% 32%, ${myColor}88, ${myColor}44)`,
          border: `2.5px solid ${myColor}`,
          boxShadow: `0 0 30px ${myColor}cc, 0 0 10px ${myColor}77`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "clamp(8px,2vw,13px)", fontWeight: 700, color: "#fff",
          willChange: "transform",
        }}>{myName[0]?.toUpperCase()}</div>

        {/* Puck */}
        <div ref={puckElRef} style={{
          position: "absolute", left: 0, top: 0,
          width: `${(PR*2/AW)*100}%`, aspectRatio: "1", borderRadius: "50%",
          background: `radial-gradient(circle at 28% 28%, #ffffffdd, ${CYAN}dd)`,
          border: `1.5px solid ${CYAN}`,
          boxShadow: `0 0 24px ${CYAN}ee, 0 0 8px ${CYAN}`,
          willChange: "transform", zIndex: 5,
        }} />

        {/* Goal flash */}
        <AnimatePresence>
          {goalFlash && (
            <motion.div key={goalFlash.key}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${flashColor}18`, backdropFilter: "blur(2px)", zIndex: 10 }}>
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.5, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 16 }}
                style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 68, fontWeight: 700, color: "#fff", textShadow: `0 0 44px ${flashColor}` }}>
                {iScored ? "⚡ But !" : "😬 But !"}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Countdown */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "absolute", inset: 0, backdropFilter: "blur(7px)", background: "rgba(0,0,0,0.52)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
              <AnimatePresence mode="wait">
                <motion.div key={countdown}
                  initial={{ scale: 0.15, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 2, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 480, damping: 22 }}
                  style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 100, fontWeight: 700, color: CYAN, textShadow: `0 0 70px ${CYAN}` }}>
                  {countdown}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Legend */}
      <div style={{ display: "flex", width: "min(88vw, 340px)", justifyContent: "space-between", marginTop: 10, padding: "0 6px" }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.26)", letterSpacing: 0.3 }}>↑ But de {otherName}</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.26)", letterSpacing: 0.3 }}>Ton but ↓</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DoneView
// ─────────────────────────────────────────────────────────────────────────────
function DoneView({ state, room, mySlot, myName, otherName, onBackToMenu }: Props & { state: State }) {
  const s1 = state.score_1 ?? 0;
  const s2 = state.score_2 ?? 0;
  const iWon     = (mySlot === 1 && s1 > s2) || (mySlot === 2 && s2 > s1);
  const myScore  = mySlot === 1 ? s1 : s2;
  const othScore = mySlot === 1 ? s2 : s1;
  const myColor  = mySlot === 1 ? ROSE : BLUE;
  const othColor = mySlot === 1 ? BLUE : ROSE;

  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: "Work Sans, sans-serif" }}>
      <Orb x="20%" y="30%" color={CYAN}              size={320} delay={0} />
      <Orb x="80%" y="70%" color={iWon ? GOLD : ROSE} size={260} delay={1} />

      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, zIndex: 1, padding: "0 28px", textAlign: "center" }}>

        <motion.div animate={{ rotate: [0, -12, 12, -6, 6, 0], scale: [1, 1.14, 1] }} transition={{ delay: 0.5, duration: 1.2 }}
          style={{ fontSize: 80 }}>{iWon ? "🏆" : "💪"}</motion.div>

        <div>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 44, fontWeight: 700, color: "#fff", margin: "0 0 6px", textShadow: iWon ? `0 0 32px ${GOLD}88` : "none" }}>
            {iWon ? "Victoire !" : "Défaite !"}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", margin: 0, fontSize: 15 }}>
            {iWon ? `Tu as dominé ${otherName} 🔥` : `${otherName} t'a eu cette fois !`}
          </p>
        </div>

        {/* Score card */}
        <div style={{ display: "flex", alignItems: "center", gap: 28, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "22px 44px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: myColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>{myName}</div>
            <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 64, fontWeight: 700, color: myColor, lineHeight: 1, textShadow: `0 0 24px ${myColor}66` }}>{myScore}</div>
          </div>
          <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 32, color: "rgba(255,255,255,0.2)" }}>–</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: othColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>{otherName}</div>
            <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 64, fontWeight: 700, color: othColor, lineHeight: 1, textShadow: `0 0 24px ${othColor}66` }}>{othScore}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 288 }}>
          {mySlot === 1 && (
            <motion.button whileTap={{ scale: 0.93 }}
              onClick={() => patch(room.id, { phase: "play", score_1: 0, score_2: 0 })}
              style={{ padding: "14px", borderRadius: 14, border: `1.5px solid ${CYAN}99`, background: `linear-gradient(135deg, ${CYAN}33, ${CYAN}11)`, color: CYAN, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: `0 0 26px ${CYAN}33` }}>
              Revanche 🏒
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.93 }} onClick={onBackToMenu}
            style={{ padding: "13px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.13)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Retour au menu
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
