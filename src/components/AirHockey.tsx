import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";
import confetti from "canvas-confetti";

const supabase = _supabase as any;

// ── Arena logical dimensions
const AW = 300;
const AH = 520;
const PR = 14;         // puck radius
const PAD_R = 32;      // paddle radius
const GOAL_W = AW * 0.42;
const GOAL_X1 = (AW - GOAL_W) / 2;
const GOAL_X2 = GOAL_X1 + GOAL_W;
const MAX_SCORE = 5;
const SPEED_INIT = 3.5;   // serve lent — la vitesse vient des frappes
const SPEED_MAX = 24;    // peut monter très haut sur frappe violente
const SPEED_MIN = 1.0;   // peut devenir quasi-immobile
const FRICTION = 0.988;  // décélère en ~1.5s — chaque frappe compte
const TRAIL_LEN = 14;
const HIT_FRAMES = 12;

// ── Design tokens
const BG = "linear-gradient(160deg, oklch(0.10 0.07 220) 0%, oklch(0.07 0.04 230) 100%)";
const CYAN = "#00e5ff";
const ROSE = "#f43f5e";
const BLUE = "#38bdf8";
const GOLD = "#fbbf24";
const SERIF = "'Cormorant Garamond', Georgia, serif";

// ── Types
type Vec = { x: number; y: number };
type Phase = "intro" | "play" | "done";
type GState = { phase: Phase; score_1: number; score_2: number };

// ── Helpers
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function toPx(pos: Vec, rect: DOMRect): Vec {
  return { x: (pos.x / AW) * rect.width, y: (pos.y / AH) * rect.height };
}
function moveTo(el: HTMLDivElement | null, pos: Vec, rect: DOMRect | null) {
  if (!el || !rect) return;
  const { x, y } = toPx(pos, rect);
  el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
}

async function patchState(roomId: string, p: Partial<GState>) {
  await supabase.rpc("minigame_patch", { _room_id: roomId, _patch: p });
}

// ── Props
interface Props {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────
export function AirHockey({ room, mySlot, myName, otherName, onBackToMenu }: Props) {
  const s = (room.minigame_state ?? {}) as GState;
  useEffect(() => {
    if (Object.keys(s).length === 0 && mySlot === 1)
      void patchState(room.id, { phase: "intro", score_1: 0, score_2: 0 });
  }, []);
  if (!s.phase || s.phase === "intro")
    return <IntroView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onBackToMenu={onBackToMenu} />;
  if (s.phase === "play")
    return <GameView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onBackToMenu={onBackToMenu} />;
  return <DoneView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onBackToMenu={onBackToMenu} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// IntroView
// ─────────────────────────────────────────────────────────────────────────────
function IntroView({ state: _s, room, mySlot, myName, otherName, onBackToMenu }: Props & { state: GState }) {
  const myColor = mySlot === 1 ? ROSE : BLUE;
  const otherColor = mySlot === 1 ? BLUE : ROSE;
  const glass = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 20, backdropFilter: "blur(12px)" } as const;

  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: SERIF }}>
      {/* Ambient orbs */}
      <motion.div animate={{ opacity: [0.08, 0.18, 0.08] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", left: "15%", top: "20%", width: 300, height: 300, borderRadius: "50%", background: BLUE, filter: "blur(80px)", pointerEvents: "none" }} />
      <motion.div animate={{ opacity: [0.06, 0.14, 0.06] }} transition={{ duration: 7, delay: 1.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", right: "10%", bottom: "25%", width: 260, height: 260, borderRadius: "50%", background: ROSE, filter: "blur(80px)", pointerEvents: "none" }} />

      <motion.button whileTap={{ scale: 0.92 }} onClick={onBackToMenu}
        style={{ position: "absolute", top: 24, left: 20, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "8px 16px", color: "rgba(255,255,255,0.65)", fontSize: 13, cursor: "pointer", fontFamily: SERIF }}>
        ← Retour
      </motion.button>

      <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, zIndex: 1, padding: "0 28px", width: "100%", maxWidth: 380 }}>

        {/* Puck */}
        <motion.div
          animate={{ y: [0, -14, 0], boxShadow: [`0 0 24px ${CYAN}55`, `0 0 60px ${CYAN}bb`, `0 0 24px ${CYAN}55`] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
          style={{ width: 86, height: 86, borderRadius: "50%", background: `radial-gradient(circle at 30% 30%, #ffffffaa, ${CYAN}cc)`, border: `2.5px solid ${CYAN}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 40px ${CYAN}66` }}>
          <span style={{ fontSize: 38 }}>🏒</span>
        </motion.div>

        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 48, fontWeight: 700, color: "#fff", margin: "0 0 4px", letterSpacing: 1, textShadow: `0 0 32px ${CYAN}77` }}>Air Hockey</h1>
          <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 14, margin: 0, letterSpacing: 0.4 }}>Premier à {MAX_SCORE} buts remporte la partie</p>
        </div>

        {/* Players */}
        <div style={{ display: "flex", gap: 20, width: "100%" }}>
          {[
            { name: myName,    color: myColor,    side: mySlot === 1 ? "⬇ Ton but en bas"  : "⬆ Ton but en haut" },
            { name: otherName, color: otherColor, side: mySlot === 1 ? "⬆ But en haut"     : "⬇ But en bas"      },
          ].map((p, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.1 }}
              style={{ ...glass, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "18px 12px" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${p.color}18`, border: `2.5px solid ${p.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: p.color, boxShadow: `0 0 18px ${p.color}44`, fontFamily: SERIF }}>
                {p.name[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", fontFamily: SERIF }}>{p.name}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.32)", textAlign: "center", lineHeight: 1.4 }}>{p.side}</span>
            </motion.div>
          ))}
        </div>

        {/* Rules */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          style={{ ...glass, padding: "13px 20px", width: "100%", textAlign: "center" }}>
          <p style={{ color: "rgba(255,255,255,0.48)", fontSize: 13, margin: 0, lineHeight: 1.8, fontFamily: "'Work Sans', sans-serif" }}>
            Glisse ton doigt dans ta moitié du terrain<br />
            Frappe le palet dans le but adverse 🎯
          </p>
        </motion.div>

        {mySlot === 1 ? (
          <motion.button whileTap={{ scale: 0.93 }}
            onClick={() => patchState(room.id, { phase: "play", score_1: 0, score_2: 0 })}
            style={{ padding: "16px 60px", borderRadius: 16, border: `1.5px solid ${CYAN}88`, background: `linear-gradient(135deg, ${CYAN}2a, ${CYAN}0d)`, color: CYAN, fontSize: 17, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5, boxShadow: `0 0 28px ${CYAN}33`, fontFamily: SERIF }}>
            Lancer 🏒
          </motion.button>
        ) : (
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.8 }}
            style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, fontFamily: "'Work Sans', sans-serif" }}>
            En attente de {otherName}…
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GameView
// ─────────────────────────────────────────────────────────────────────────────
function GameView({ state, room, mySlot, myName, otherName, onBackToMenu }: Props & { state: GState }) {
  const arenaRef      = useRef<HTMLDivElement>(null);
  const puckElRef     = useRef<HTMLDivElement>(null);
  const myPadElRef    = useRef<HTMLDivElement>(null);
  const otherPadElRef = useRef<HTMLDivElement>(null);
  const trailEls      = useRef<(HTMLDivElement | null)[]>([]);
  const topGoalRef    = useRef<HTMLDivElement>(null);
  const botGoalRef    = useRef<HTMLDivElement>(null);

  const myPos       = useRef<Vec>({ x: AW / 2, y: mySlot === 1 ? AH - 90 : 90 });
  const otherPos    = useRef<Vec>({ x: AW / 2, y: mySlot === 1 ? 90 : AH - 90 });
  const puckPos     = useRef<Vec>({ x: AW / 2, y: AH / 2 });
  const puckTarget  = useRef<Vec>({ x: AW / 2, y: AH / 2 }); // for non-host lerp
  const puckVel     = useRef<Vec>({ x: 0, y: 0 });
  const myPadVel    = useRef<Vec>({ x: 0, y: 0 });
  const trail       = useRef<Vec[]>(Array(TRAIL_LEN).fill({ x: AW / 2, y: AH / 2 }));
  const arenaRect   = useRef<DOMRect | null>(null);
  const hitRef      = useRef(0);

  const isHost = mySlot === 1;
  const myColor    = mySlot === 1 ? ROSE : BLUE;
  const otherColor = mySlot === 1 ? BLUE : ROSE;
  const topGoalColor    = mySlot === 1 ? BLUE : ROSE;   // top = opponent's goal
  const bottomGoalColor = mySlot === 1 ? ROSE : BLUE;   // bottom = mine

  const [score,     setScore]     = useState({ s1: state.score_1 ?? 0, s2: state.score_2 ?? 0 });
  const [goalFlash, setGoalFlash] = useState<{ scorer: number; name: string; key: number } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shake,     setShake]     = useState(false);

  const channelRef   = useRef<any>(null);
  const rafRef       = useRef<number>(0);
  const playingRef   = useRef(false);
  const scoringRef   = useRef(false);

  useEffect(() => {
    setScore({ s1: state.score_1 ?? 0, s2: state.score_2 ?? 0 });
  }, [state.score_1, state.score_2]);

  // Resize observer
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

  // Broadcast channel
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
        puckTarget.current = { x, y };
        puckVel.current = { x: vx, y: vy };
      });
    }
    ch.subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [room.id, mySlot]);

  // Goal handler
  const handleGoal = (scorer: number) => {
    scoringRef.current = true;
    playingRef.current = false;
    puckPos.current  = { x: AW / 2, y: AH / 2 };
    puckTarget.current = { x: AW / 2, y: AH / 2 };
    puckVel.current  = { x: 0, y: 0 };
    trail.current    = Array(TRAIL_LEN).fill({ x: AW / 2, y: AH / 2 });
    moveTo(puckElRef.current, { x: AW / 2, y: AH / 2 }, arenaRect.current);
    trail.current.forEach((p, i) => moveTo(trailEls.current[i], p, arenaRect.current));

    const scorerName = scorer === mySlot ? myName : otherName;
    setGoalFlash({ scorer, name: scorerName, key: Date.now() });
    setShake(true);
    setTimeout(() => setShake(false), 520);
    setTimeout(() => setGoalFlash(null), 1800);

    // Confetti when I score
    if (scorer === mySlot) {
      confetti({ particleCount: 60, spread: 80, origin: { y: 0.5 }, ticks: 90, scalar: 0.9 });
    }

    setCountdown(3);
    let c = 3;
    const iv = setInterval(() => {
      c--;
      if (c <= 0) {
        clearInterval(iv);
        setCountdown(null);
        scoringRef.current = false;
        playingRef.current = true;
        const vy = scorer === 1 ? SPEED_INIT : -SPEED_INIT;
        const vx = (Math.random() - 0.5) * SPEED_INIT * 1.4;
        puckVel.current = { x: vx, y: vy };
      } else {
        setCountdown(c);
      }
    }, 1000);
  };

  // ── Host physics loop
  useEffect(() => {
    if (!isHost) return;
    playingRef.current = true;
    const vy0 = (Math.random() > 0.5 ? 1 : -1) * SPEED_INIT;
    puckVel.current = { x: (Math.random() - 0.5) * SPEED_INIT * 1.2, y: vy0 };

    const loop = () => {
      if (playingRef.current && !scoringRef.current) {
        let { x, y }   = puckPos.current;
        let { x: vx, y: vy } = puckVel.current;

        x += vx;
        y += vy;

        // Side walls
        if (x - PR < 0)  { x = PR;      vx =  Math.abs(vx); }
        if (x + PR > AW) { x = AW - PR; vx = -Math.abs(vx); }

        // Paddle collisions
        let hit = false;
        for (const [pad, pv] of [
          [myPos.current, myPadVel.current],
          [otherPos.current, { x: 0, y: 0 }],
        ] as [Vec, Vec][]) {
          const dx   = x - pad.x;
          const dy   = y - pad.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const min  = PR + PAD_R;
          if (dist < min && dist > 0.1) {
            const nx = dx / dist;
            const ny = dy / dist;
            x = pad.x + nx * (min + 0.5);
            y = pad.y + ny * (min + 0.5);
            const dot = vx * nx + vy * ny;
            if (dot < 0) {
              vx -= 2 * dot * nx;
              vy -= 2 * dot * ny;
              vx += pv.x * 0.92;
              vy += pv.y * 0.92;
              const spd = Math.sqrt(vx * vx + vy * vy);
              if (spd > 0) {
                const ns = Math.min(spd, SPEED_MAX);
                vx = (vx / spd) * ns;
                vy = (vy / spd) * ns;
              }
              hit = true;
            }
          }
        }

        // Hit effect
        if (hit) {
          hitRef.current = HIT_FRAMES;
        }

        // Top wall / goal
        if (y - PR < 0) {
          if (x >= GOAL_X1 && x <= GOAL_X2 && !scoringRef.current) {
            scoringRef.current = true;
            void (async () => {
              const { data } = await supabase.from("rooms").select("minigame_state").eq("id", room.id).maybeSingle();
              const prev = (data?.minigame_state ?? {}) as GState;
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

        // Bottom wall / goal
        if (y + PR > AH) {
          if (x >= GOAL_X1 && x <= GOAL_X2 && !scoringRef.current) {
            scoringRef.current = true;
            void (async () => {
              const { data } = await supabase.from("rooms").select("minigame_state").eq("id", room.id).maybeSingle();
              const prev = (data?.minigame_state ?? {}) as GState;
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

        vx *= FRICTION;
        vy *= FRICTION;

        const spd = Math.sqrt(vx * vx + vy * vy);
        if (spd > 0 && spd < SPEED_MIN) { vx = (vx / spd) * SPEED_MIN; vy = (vy / spd) * SPEED_MIN; }

        puckPos.current = { x, y };
        puckVel.current = { x: vx, y: vy };

        // Puck glow — speed + hit effect
        if (puckElRef.current) {
          const h = hitRef.current;
          if (h > 0) {
            const g = h / HIT_FRAMES;
            puckElRef.current.style.boxShadow = `0 0 ${28 + g * 40}px ${CYAN}ff, 0 0 ${12 + g * 20}px ${CYAN}cc, 0 0 4px #fff`;
            hitRef.current--;
          } else {
            const spdNorm = Math.min(1, (spd - SPEED_MIN) / (SPEED_MAX - SPEED_MIN));
            puckElRef.current.style.boxShadow = `0 0 ${18 + spdNorm * 22}px ${CYAN}cc, 0 0 6px ${CYAN}88`;
          }
        }

        // Danger zone: goal glow when puck near
        if (topGoalRef.current) {
          const danger = Math.max(0, Math.min(1, (AH * 0.22 - y) / (AH * 0.15)));
          topGoalRef.current.style.boxShadow = `0 0 ${14 + danger * 28}px ${topGoalColor}, 0 4px ${20 + danger * 30}px ${topGoalColor}88`;
          topGoalRef.current.style.opacity = `${0.75 + danger * 0.25}`;
        }
        if (botGoalRef.current) {
          const danger = Math.max(0, Math.min(1, (y - AH * 0.78) / (AH * 0.15)));
          botGoalRef.current.style.boxShadow = `0 0 ${14 + danger * 28}px ${bottomGoalColor}, 0 -4px ${20 + danger * 30}px ${bottomGoalColor}88`;
          botGoalRef.current.style.opacity = `${0.75 + danger * 0.25}`;
        }

        moveTo(puckElRef.current, { x, y }, arenaRect.current);
        trail.current = [{ x, y }, ...trail.current.slice(0, TRAIL_LEN - 1)];
        trail.current.forEach((p, i) => moveTo(trailEls.current[i], p, arenaRect.current));

        channelRef.current?.send({ type: "broadcast", event: "puck", payload: { x, y, vx, vy } });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [isHost, room.id]);

  // ── Non-host: lerp interpolation loop (smooth puck)
  useEffect(() => {
    if (isHost) return;
    const loop = () => {
      const { x: tx, y: ty } = puckTarget.current;
      const { x: cx, y: cy } = puckPos.current;
      const nx = cx + (tx - cx) * 0.38;
      const ny = cy + (ty - cy) * 0.38;
      puckPos.current = { x: nx, y: ny };
      moveTo(puckElRef.current, { x: nx, y: ny }, arenaRect.current);

      // Speed-based glow for non-host too
      if (puckElRef.current) {
        const { x: vx, y: vy } = puckVel.current;
        const spd = Math.sqrt(vx * vx + vy * vy);
        const spdNorm = Math.min(1, (spd - SPEED_MIN) / (SPEED_MAX - SPEED_MIN));
        puckElRef.current.style.boxShadow = `0 0 ${18 + spdNorm * 22}px ${CYAN}cc, 0 0 6px ${CYAN}88`;
      }

      trail.current = [{ x: nx, y: ny }, ...trail.current.slice(0, TRAIL_LEN - 1)];
      trail.current.forEach((p, i) => moveTo(trailEls.current[i], p, arenaRect.current));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [isHost]);

  // ── Pointer input
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

  const myScore    = mySlot === 1 ? score.s1 : score.s2;
  const otherScore = mySlot === 1 ? score.s2 : score.s1;
  const iScored    = goalFlash?.scorer === mySlot;
  const flashColor = iScored ? myColor : otherColor;

  const pips = (n: number, color: string) =>
    Array.from({ length: MAX_SCORE }).map((_, i) => (
      <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i < n ? color : "rgba(255,255,255,0.12)", boxShadow: i < n ? `0 0 5px ${color}` : "none", transition: "all 0.35s" }} />
    ));

  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", userSelect: "none", touchAction: "none" }}>

      {/* Back button */}
      <motion.button whileTap={{ scale: 0.9 }} onClick={onBackToMenu}
        style={{ position: "absolute", top: 14, left: 14, zIndex: 20, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "6px 13px", color: "rgba(255,255,255,0.55)", fontSize: 12, cursor: "pointer", fontFamily: SERIF }}>
        ← Quitter
      </motion.button>

      {/* ── Arena */}
      <motion.div
        ref={arenaRef}
        animate={shake ? { x: [0, -9, 9, -6, 6, -3, 3, 0] } : { x: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        style={{
          position: "relative",
          width: "min(92vw, 350px)",
          aspectRatio: `${AW}/${AH}`,
          borderRadius: 22,
          overflow: "hidden",
          background: "linear-gradient(180deg, oklch(0.14 0.09 220) 0%, oklch(0.10 0.06 220) 100%)",
          border: "1.5px solid rgba(0,229,255,0.18)",
          boxShadow: "0 0 60px rgba(0,229,255,0.08), inset 0 0 50px rgba(0,0,0,0.45)",
          cursor: "none",
        }}>

        {/* Half-court color tints */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", background: `linear-gradient(180deg, ${topGoalColor}09 0%, transparent 100%)`, pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%", background: `linear-gradient(0deg, ${bottomGoalColor}09 0%, transparent 100%)`, pointerEvents: "none", zIndex: 0 }} />

        {/* Ice grid */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04, pointerEvents: "none", zIndex: 0 }}>
          {Array.from({ length: 5 }).map((_, i) => <line key={`v${i}`} x1={`${(i+1)*100/6}%`} y1="0" x2={`${(i+1)*100/6}%`} y2="100%" stroke="white" strokeWidth="1" />)}
          {Array.from({ length: 9 }).map((_, i) => <line key={`h${i}`} x1="0" y1={`${(i+1)*100/10}%`} x2="100%" y2={`${(i+1)*100/10}%`} stroke="white" strokeWidth="1" />)}
        </svg>

        {/* Center line */}
        <div style={{ position: "absolute", left: "4%", right: "4%", top: "50%", height: 1.5, background: "rgba(255,255,255,0.13)", transform: "translateY(-50%)", zIndex: 1 }} />
        {/* Center circle */}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "28%", paddingBottom: "28%", borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.10)", zIndex: 1 }} />
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.25)", zIndex: 1 }} />

        {/* ── Top goal (opponent) */}
        <div ref={topGoalRef} style={{
          position: "absolute", top: 0,
          left: `${(GOAL_X1/AW)*100}%`, width: `${(GOAL_W/AW)*100}%`,
          height: 13, zIndex: 3,
          background: `linear-gradient(180deg, ${topGoalColor} 0%, ${topGoalColor}88 100%)`,
          boxShadow: `0 0 14px ${topGoalColor}, 0 4px 22px ${topGoalColor}88`,
          transition: "box-shadow 0.1s, opacity 0.1s",
        }}>
          <div style={{ position: "absolute", left: -3, top: 0, width: 5, height: 26, background: "#fff", borderRadius: "0 0 3px 3px", boxShadow: "0 3px 8px #ffffff66" }} />
          <div style={{ position: "absolute", right: -3, top: 0, width: 5, height: 26, background: "#fff", borderRadius: "0 0 3px 3px", boxShadow: "0 3px 8px #ffffff66" }} />
          {[1,2,3].map(i => <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${i*25}%`, width: 1, background: "rgba(255,255,255,0.28)" }} />)}
        </div>

        {/* ── Bottom goal (mine) */}
        <div ref={botGoalRef} style={{
          position: "absolute", bottom: 0,
          left: `${(GOAL_X1/AW)*100}%`, width: `${(GOAL_W/AW)*100}%`,
          height: 13, zIndex: 3,
          background: `linear-gradient(0deg, ${bottomGoalColor} 0%, ${bottomGoalColor}88 100%)`,
          boxShadow: `0 0 14px ${bottomGoalColor}, 0 -4px 22px ${bottomGoalColor}88`,
          transition: "box-shadow 0.1s, opacity 0.1s",
        }}>
          <div style={{ position: "absolute", left: -3, bottom: 0, width: 5, height: 26, background: "#fff", borderRadius: "3px 3px 0 0", boxShadow: "0 -3px 8px #ffffff66" }} />
          <div style={{ position: "absolute", right: -3, bottom: 0, width: 5, height: 26, background: "#fff", borderRadius: "3px 3px 0 0", boxShadow: "0 -3px 8px #ffffff66" }} />
          {[1,2,3].map(i => <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${i*25}%`, width: 1, background: "rgba(255,255,255,0.28)" }} />)}
        </div>

        {/* ── HUD — opponent (top) */}
        <div style={{
          position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.42)", backdropFilter: "blur(10px)",
          border: `1px solid ${otherColor}2a`,
          borderRadius: 24, padding: "5px 14px 5px 10px",
          display: "flex", alignItems: "center", gap: 8, zIndex: 6,
          whiteSpace: "nowrap",
        }}>
          <span style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 700, color: otherColor, lineHeight: 1, textShadow: `0 0 14px ${otherColor}` }}>{otherScore}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontFamily: "'Work Sans',sans-serif", letterSpacing: 0.3 }}>{otherName}</span>
            <div style={{ display: "flex", gap: 3 }}>{pips(otherScore, otherColor)}</div>
          </div>
        </div>

        {/* ── HUD — me (bottom) */}
        <div style={{
          position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.42)", backdropFilter: "blur(10px)",
          border: `1px solid ${myColor}2a`,
          borderRadius: 24, padding: "5px 10px 5px 14px",
          display: "flex", alignItems: "center", gap: 8, zIndex: 6,
          whiteSpace: "nowrap",
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontFamily: "'Work Sans',sans-serif", letterSpacing: 0.3 }}>{myName}</span>
            <div style={{ display: "flex", gap: 3 }}>{pips(myScore, myColor)}</div>
          </div>
          <span style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 700, color: myColor, lineHeight: 1, textShadow: `0 0 14px ${myColor}` }}>{myScore}</span>
        </div>

        {/* ── Puck trail */}
        {Array.from({ length: TRAIL_LEN }).map((_, i) => {
          const frac = 1 - i / TRAIL_LEN;
          return (
            <div key={`tr${i}`} ref={el => { trailEls.current[i] = el; }}
              style={{
                position: "absolute", left: 0, top: 0,
                width: `${((PR * 2 * frac * 0.75) / AW) * 100}%`, aspectRatio: "1",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${CYAN}cc, ${CYAN}44)`,
                opacity: frac * 0.38,
                filter: `blur(${i * 1.4}px)`,
                willChange: "transform", pointerEvents: "none", zIndex: 4,
              }} />
          );
        })}

        {/* ── Other paddle */}
        <div ref={otherPadElRef} style={{
          position: "absolute", left: 0, top: 0,
          width: `${(PAD_R*2/AW)*100}%`, aspectRatio: "1", borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${otherColor}88, ${otherColor}33)`,
          border: `2.5px solid ${otherColor}bb`,
          boxShadow: `0 0 22px ${otherColor}77, 0 0 6px ${otherColor}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "clamp(9px,2vw,13px)", fontWeight: 700, color: "#fff",
          fontFamily: SERIF, willChange: "transform", zIndex: 5,
        }}>{otherName[0]?.toUpperCase()}</div>

        {/* ── My paddle */}
        <div ref={myPadElRef} style={{
          position: "absolute", left: 0, top: 0,
          width: `${(PAD_R*2/AW)*100}%`, aspectRatio: "1", borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${myColor}99, ${myColor}44)`,
          border: `2.5px solid ${myColor}dd`,
          boxShadow: `0 0 28px ${myColor}bb, 0 0 10px ${myColor}66`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "clamp(9px,2vw,13px)", fontWeight: 700, color: "#fff",
          fontFamily: SERIF, willChange: "transform", zIndex: 5,
        }}>{myName[0]?.toUpperCase()}</div>

        {/* ── Puck */}
        <div ref={puckElRef} style={{
          position: "absolute", left: 0, top: 0,
          width: `${(PR*2/AW)*100}%`, aspectRatio: "1", borderRadius: "50%",
          background: `radial-gradient(circle at 32% 32%, #ffffffdd, ${CYAN}dd)`,
          border: `1.5px solid ${CYAN}cc`,
          boxShadow: `0 0 22px ${CYAN}cc, 0 0 8px ${CYAN}88`,
          willChange: "transform", zIndex: 6,
        }} />

        {/* ── Goal flash */}
        <AnimatePresence>
          {goalFlash && (
            <motion.div key={goalFlash.key}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `${flashColor}14`, backdropFilter: "blur(3px)", zIndex: 10, gap: 6 }}>
              <motion.div
                initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 15 }}
                style={{ textAlign: "center" }}>
                <div style={{ fontFamily: SERIF, fontSize: 80, fontWeight: 700, color: "#fff", textShadow: `0 0 50px ${flashColor}`, lineHeight: 1 }}>
                  {iScored ? "⚡" : "😬"}
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 44, fontWeight: 700, color: flashColor, textShadow: `0 0 30px ${flashColor}`, lineHeight: 1.1 }}>
                  BUT !
                </div>
                <div style={{ fontFamily: "'Work Sans',sans-serif", fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
                  {iScored ? "Tu as marqué 🔥" : `${goalFlash.name} a marqué`}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Countdown */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "absolute", inset: 0, backdropFilter: "blur(8px)", background: "rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10, gap: 10 }}>
              <AnimatePresence mode="wait">
                <motion.div key={countdown}
                  initial={{ scale: 0.1, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 2.2, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  style={{ fontFamily: SERIF, fontSize: 108, fontWeight: 700, color: CYAN, textShadow: `0 0 70px ${CYAN}, 0 0 28px ${CYAN}`, lineHeight: 1 }}>
                  {countdown}
                </motion.div>
              </AnimatePresence>
              <div style={{ fontFamily: "'Work Sans',sans-serif", fontSize: 13, color: "rgba(255,255,255,0.45)", letterSpacing: 1 }}>
                Prêt ?
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DoneView
// ─────────────────────────────────────────────────────────────────────────────
function DoneView({ state, room, mySlot, myName, otherName, onBackToMenu }: Props & { state: GState }) {
  const s1 = state.score_1 ?? 0;
  const s2 = state.score_2 ?? 0;
  const iWon     = (mySlot === 1 && s1 > s2) || (mySlot === 2 && s2 > s1);
  const myScore  = mySlot === 1 ? s1 : s2;
  const othScore = mySlot === 1 ? s2 : s1;
  const myColor  = mySlot === 1 ? ROSE : BLUE;
  const othColor = mySlot === 1 ? BLUE : ROSE;
  const glass    = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 20, backdropFilter: "blur(12px)" } as const;

  useEffect(() => {
    if (iWon) {
      setTimeout(() => confetti({ particleCount: 120, spread: 100, origin: { y: 0.45 }, ticks: 130 }), 200);
    }
  }, []);

  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: SERIF }}>
      <motion.div animate={{ opacity: [0.08, 0.20, 0.08] }} transition={{ duration: 5, repeat: Infinity }}
        style={{ position: "absolute", left: "10%", top: "15%", width: 320, height: 320, borderRadius: "50%", background: iWon ? GOLD : ROSE, filter: "blur(90px)", pointerEvents: "none" }} />
      <motion.div animate={{ opacity: [0.06, 0.15, 0.06] }} transition={{ duration: 6, delay: 1, repeat: Infinity }}
        style={{ position: "absolute", right: "5%", bottom: "20%", width: 260, height: 260, borderRadius: "50%", background: BLUE, filter: "blur(80px)", pointerEvents: "none" }} />

      <motion.div initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, zIndex: 1, padding: "0 28px", textAlign: "center", width: "100%", maxWidth: 380 }}>

        <motion.div animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.16, 1] }} transition={{ delay: 0.5, duration: 1.1 }}
          style={{ fontSize: 82 }}>{iWon ? "🏆" : "💪"}</motion.div>

        <div>
          <h1 style={{ fontFamily: SERIF, fontSize: 46, fontWeight: 700, color: "#fff", margin: "0 0 6px", textShadow: iWon ? `0 0 36px ${GOLD}88` : "none", letterSpacing: 0.5 }}>
            {iWon ? "Victoire !" : "Défaite !"}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.42)", margin: 0, fontSize: 15, fontFamily: "'Work Sans',sans-serif" }}>
            {iWon ? `Tu as dominé ${otherName} 🔥` : `${otherName} t'a eu cette fois !`}
          </p>
        </div>

        {/* Score card */}
        <div style={{ ...glass, display: "flex", alignItems: "center", gap: 28, padding: "22px 40px", width: "100%" }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: myColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, fontFamily: "'Work Sans',sans-serif" }}>{myName}</div>
            <div style={{ fontFamily: SERIF, fontSize: 68, fontWeight: 700, color: myColor, lineHeight: 1, textShadow: `0 0 24px ${myColor}66` }}>{myScore}</div>
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 32, color: "rgba(255,255,255,0.18)" }}>–</div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: othColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, fontFamily: "'Work Sans',sans-serif" }}>{otherName}</div>
            <div style={{ fontFamily: SERIF, fontSize: 68, fontWeight: 700, color: othColor, lineHeight: 1, textShadow: `0 0 24px ${othColor}66` }}>{othScore}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
          {mySlot === 1 && (
            <motion.button whileTap={{ scale: 0.93 }}
              onClick={() => patchState(room.id, { phase: "play", score_1: 0, score_2: 0 })}
              style={{ padding: "15px", borderRadius: 16, border: `1.5px solid ${CYAN}88`, background: `linear-gradient(135deg, ${CYAN}28, ${CYAN}0d)`, color: CYAN, fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: `0 0 24px ${CYAN}2a`, fontFamily: SERIF }}>
              Revanche 🏒
            </motion.button>
          )}
          <motion.button whileTap={{ scale: 0.93 }} onClick={onBackToMenu}
            style={{ padding: "14px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: SERIF }}>
            Retour au menu
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
