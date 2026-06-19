import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ──────────── RÉGLAGES ────────────
const ARENA_W           = 100;
const ARENA_H           = 150;
const PLAYER_R          = 7;
const PROJECTILE_R      = 3;
const PROJECTILE_SPEED  = 40;
const DURATION_S        = 10;
const SHOT_INTERVAL_MS  = 1000;
const COUNTDOWN_S       = 3;
const POS_BROADCAST_HZ  = 20;

// ──────────── GAGES ────────────
export const GAGES_CUPIDON: string[] = [
  "Embrasse l'autre passionnément pendant 15 secondes 💋",
  "Un baiser lent dans le cou 😘",
  "Enlève un vêtement de ton choix 🔥",
  "Massage sensuel d'une minute 💆",
  "Murmure à l'oreille ce que tu as envie de faire 😏",
  "Mords gentiment la lèvre de l'autre 😈",
  "Une danse sensuelle de 30 secondes 💃",
  "L'autre choisit ce qui se passe maintenant 😈",
  "Embrasse l'autre là où tu veux pendant 20 secondes 💞",
  "Laisse l'autre mener pour la suite 🔥",
];

type Phase = "intro" | "countdown" | "play" | "result" | "dare" | "done";
type Outcome = "hit" | "dodge" | null;

type State = {
  phase?: Phase;
  shooter_slot?: 1 | 2 | null;
  round?: number;
  outcome?: Outcome;
  loser_slot?: 1 | 2 | null;
  dare_index?: number | null;
};

type Vec = { x: number; y: number };
type Projectile = { id: number; x: number; y: number; vx: number; vy: number };

type Props = {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
  onDareDone: () => void;
};

function patch(roomId: string, p: State) {
  return supabase.from("rooms").update({ minigame_state: p }).eq("id", roomId).then(() => undefined);
}

async function mergePatch(roomId: string, p: Partial<State>) {
  const { data } = await supabase.from("rooms").select("minigame_state").eq("id", roomId).maybeSingle();
  const prev = ((data?.minigame_state ?? {}) as State) || {};
  await supabase.from("rooms").update({ minigame_state: { ...prev, ...p } }).eq("id", roomId);
}

function stableIndex(seed: string, max: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % max;
}

// ── Shared style tokens ──────────────────────────────────────────────────────
const NIGHT_BG  = "linear-gradient(160deg, oklch(0.14 0.06 340) 0%, oklch(0.11 0.05 320) 100%)";
const ROSE_HEX  = "#f472b6";
const CYAN_HEX  = "#67e8f9";

function Orb({ size, x, y, delay, color }: { size: number; x: string; y: string; delay: number; color: string }) {
  return (
    <motion.div className="pointer-events-none absolute rounded-full"
      style={{ width: size, height: size, left: x, top: y, background: color, filter: `blur(${size * 0.55}px)`, opacity: 0.35 }}
      animate={{ scale: [1, 1.2, 1], opacity: [0.25, 0.45, 0.25], y: [0, -12, 0] }}
      transition={{ duration: 6 + delay, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function CupidonDuel({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s = (room.minigame_state ?? {}) as State;
  const phase: Phase = s.phase ?? "intro";

  useEffect(() => {
    if (Object.keys(s).length === 0 && mySlot === 1)
      void patch(room.id, { phase: "intro", round: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  if (phase === "intro")
    return <Intro state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onBackToMenu={onBackToMenu} />;
  if (phase === "countdown" || phase === "play")
    return <Arena state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  if (phase === "result")
    return <Result state={s} room={room} mySlot={mySlot} otherName={otherName} />;
  if (phase === "dare")
    return <DareView state={s} room={room} mySlot={mySlot} otherName={otherName} onDareDone={onDareDone} />;
  return <DoneView state={s} room={room} mySlot={mySlot} onBackToMenu={onBackToMenu} />;
}

// ── Intro ─────────────────────────────────────────────────────────────────────
function Intro({ state, room, mySlot, myName, otherName, onBackToMenu }:
  { state: State; room: Room; mySlot: number; myName: string; otherName: string; onBackToMenu: () => void }) {
  const shooter = state.shooter_slot ?? null;
  const iAmShooter = shooter && shooter === mySlot;

  const start = async () => {
    const nextShooter = shooter ?? ((Math.random() < 0.5 ? 1 : 2) as 1 | 2);
    await mergePatch(room.id, { phase: "countdown", shooter_slot: nextShooter, outcome: null, loser_slot: null, dare_index: null });
  };

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: NIGHT_BG }}>
      <Orb size={220} x="-10%" y="-5%" delay={0} color="oklch(0.55 0.22 340)" />
      <Orb size={160} x="60%" y="50%" delay={2} color="oklch(0.50 0.18 20)" />

      <div className="relative z-10 flex flex-1 flex-col px-5 pt-8 pb-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "rgba(244,114,182,0.5)" }}>
            Mini-jeu
          </p>
          <h1 className="mt-2 text-5xl font-semibold"
            style={{ fontFamily: "Cormorant Garamond, serif", color: "#fde8ee" }}>
            Duel de Cupidon
          </h1>
          <p className="mt-1 text-base" style={{ color: "rgba(253,232,238,0.45)" }}>
            Esquive les flèches… ou décoche-les 🏹
          </p>
        </motion.div>

        {/* Rules card */}
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.5 }}
          className="rounded-3xl p-6 text-center flex-1 flex flex-col items-center justify-center gap-5"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
          }}>
          {/* Animated arrow / heart */}
          <motion.div
            animate={{ scale: [1, 1.15, 1], rotate: [0, -8, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            className="text-6xl">
            💘
          </motion.div>

          {/* Role display */}
          {shooter ? (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-semibold" style={{ color: "rgba(253,232,238,0.55)" }}>Rôles tirés :</p>
              <div className="flex gap-3">
                <div className="px-4 py-2 rounded-2xl text-sm font-semibold"
                  style={{ background: `${ROSE_HEX}22`, color: ROSE_HEX, border: `1px solid ${ROSE_HEX}44` }}>
                  🏹 Tireur : {shooter === mySlot ? myName : otherName}
                </div>
                <div className="px-4 py-2 rounded-2xl text-sm font-semibold"
                  style={{ background: `${CYAN_HEX}22`, color: CYAN_HEX, border: `1px solid ${CYAN_HEX}44` }}>
                  🏃 Fuyard : {shooter === mySlot ? otherName : myName}
                </div>
              </div>
              {iAmShooter !== null && (
                <p className="text-base font-semibold mt-1"
                  style={{ fontFamily: "Cormorant Garamond, serif", color: "#fde8ee" }}>
                  {iAmShooter ? `Tu tires sur ${otherName} 🎯` : `${otherName} te cible 🏃`}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "rgba(253,232,238,0.5)" }}>
              Rôles tirés au sort au lancement
            </p>
          )}

          {/* Rules */}
          <div className="w-full space-y-2">
            {[
              { icon: "⏱", text: `${DURATION_S} secondes de duel` },
              { icon: "💘", text: "1 flèche tirée par seconde" },
              { icon: "😈", text: "Touché → le fuyard fait le gage" },
              { icon: "😏", text: "Esquive parfaite → le tireur fait le gage" },
            ].map((r) => (
              <div key={r.text} className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-left"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <span className="text-lg flex-shrink-0">{r.icon}</span>
                <p className="text-sm" style={{ color: "rgba(253,232,238,0.65)" }}>{r.text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Buttons */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="mt-5 space-y-3">
          {mySlot === 1 ? (
            <motion.button whileTap={{ scale: 0.97 }} onClick={start}
              className="w-full h-14 rounded-2xl text-base font-semibold relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, oklch(0.65 0.22 340), oklch(0.55 0.20 10))",
                color: "white", boxShadow: "0 8px 28px rgba(220,80,100,0.35)",
              }}>
              <motion.div className="absolute inset-0"
                animate={{ x: ["100%", "-100%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }} />
              <span className="relative z-10">Commencer 💘</span>
            </motion.button>
          ) : (
            <div className="w-full h-14 rounded-2xl flex items-center justify-center text-sm"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(253,232,238,0.4)" }}>
              <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                En attente de {otherName}…
              </motion.span>
            </div>
          )}
          <motion.button whileTap={{ scale: 0.97 }} onClick={onBackToMenu}
            className="w-full h-11 rounded-2xl text-sm"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(253,232,238,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
            ← Menu
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}

// ── Arena (countdown + play) ───────────────────────────────────────────────────
function Arena({ state, room, mySlot, myName, otherName }:
  { state: State; room: Room; mySlot: number; myName: string; otherName: string }) {
  const shooter = (state.shooter_slot ?? 1) as 1 | 2;
  const iAmShooter = shooter === mySlot;
  const phase = state.phase ?? "countdown";

  const [myPos, setMyPos] = useState<Vec>(() =>
    mySlot === shooter ? { x: ARENA_W / 2, y: ARENA_H - 18 } : { x: ARENA_W / 2, y: 18 }
  );
  const [otherPos, setOtherPos] = useState<Vec>(() =>
    mySlot === shooter ? { x: ARENA_W / 2, y: 18 } : { x: ARENA_W / 2, y: ARENA_H - 18 }
  );

  const myPosRef = useRef(myPos);
  const otherPosRef = useRef(otherPos);
  useEffect(() => { myPosRef.current = myPos; }, [myPos]);
  useEffect(() => { otherPosRef.current = otherPos; }, [otherPos]);

  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const projRef = useRef<Projectile[]>([]);
  useEffect(() => { projRef.current = projectiles; }, [projectiles]);

  const [remaining, setRemaining] = useState(DURATION_S);
  const [countdown, setCountdown] = useState(COUNTDOWN_S);

  const arenaRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  // ── Broadcast channel
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    const ch = supabase.channel(`cupidon-${room.id}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "pos" }, (msg: { payload: { slot: number; x: number; y: number } }) => {
      const p = msg.payload;
      if (p.slot !== mySlot) setOtherPos({ x: p.x, y: p.y });
    });
    ch.on("broadcast", { event: "proj" }, (msg: { payload: { list: Projectile[] } }) => {
      if (!iAmShooter) setProjectiles(msg.payload.list);
    });
    ch.subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [room.id, mySlot, iAmShooter]);

  // ── Drag
  const setPosFromEvent = (clientX: number, clientY: number) => {
    const el = arenaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * ARENA_W;
    const y = ((clientY - rect.top) / rect.height) * ARENA_H;
    setMyPos({
      x: Math.max(PLAYER_R, Math.min(ARENA_W - PLAYER_R, x)),
      y: Math.max(PLAYER_R, Math.min(ARENA_H - PLAYER_R, y)),
    });
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (phase !== "play") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setPosFromEvent(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => { if (draggingRef.current) setPosFromEvent(e.clientX, e.clientY); };
  const onPointerUp = () => { draggingRef.current = false; };

  // ── Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    setCountdown(COUNTDOWN_S);
    let n = COUNTDOWN_S;
    const t = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        clearInterval(t);
        if (iAmShooter) void mergePatch(room.id, { phase: "play" });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, iAmShooter, room.id]);

  // ── Broadcast positions
  useEffect(() => {
    if (phase !== "play" && phase !== "countdown") return;
    const ch = channelRef.current;
    if (!ch) return;
    const t = setInterval(() => {
      ch.send({ type: "broadcast", event: "pos", payload: { slot: mySlot, x: myPosRef.current.x, y: myPosRef.current.y } });
    }, 1000 / POS_BROADCAST_HZ);
    return () => clearInterval(t);
  }, [phase, mySlot]);

  // ── Game loop (tireur)
  const projectileIdRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const lastShotRef = useRef<number>(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (phase !== "play" || !iAmShooter) return;
    finishedRef.current = false;
    startedAtRef.current = performance.now();
    lastShotRef.current = performance.now();
    setProjectiles([]);
    projRef.current = [];
    let raf = 0;
    let lastTs = performance.now();
    let lastBroadcast = performance.now();

    const loop = (ts: number) => {
      if (finishedRef.current) return;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      const elapsed = (ts - (startedAtRef.current ?? ts)) / 1000;
      setRemaining(Math.max(0, Math.ceil(DURATION_S - elapsed)));

      if (ts - lastShotRef.current >= SHOT_INTERVAL_MS && elapsed < DURATION_S) {
        lastShotRef.current = ts;
        const from = myPosRef.current;
        const to = otherPosRef.current;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.max(0.0001, Math.hypot(dx, dy));
        projRef.current = [...projRef.current, {
          id: ++projectileIdRef.current,
          x: from.x, y: from.y,
          vx: (dx / len) * PROJECTILE_SPEED,
          vy: (dy / len) * PROJECTILE_SPEED,
        }];
      }

      const runner = otherPosRef.current;
      let hit = false;
      const next: Projectile[] = [];
      for (const p of projRef.current) {
        const nx = p.x + p.vx * dt;
        const ny = p.y + p.vy * dt;
        if (Math.hypot(nx - runner.x, ny - runner.y) < PLAYER_R + PROJECTILE_R) { hit = true; continue; }
        if (nx < -10 || nx > ARENA_W + 10 || ny < -10 || ny > ARENA_H + 10) continue;
        next.push({ ...p, x: nx, y: ny });
      }
      projRef.current = next;
      setProjectiles(next);

      if (ts - lastBroadcast > 1000 / POS_BROADCAST_HZ) {
        lastBroadcast = ts;
        channelRef.current?.send({ type: "broadcast", event: "proj", payload: { list: next } });
      }

      if (hit) {
        finishedRef.current = true;
        const runnerSlot = shooter === 1 ? 2 : 1;
        const seed = `${room.id}-cupidon-${state.round ?? 1}-hit`;
        const idx = stableIndex(seed, GAGES_CUPIDON.length);
        channelRef.current?.send({ type: "broadcast", event: "proj", payload: { list: [] } });
        void mergePatch(room.id, { phase: "result", outcome: "hit", loser_slot: runnerSlot, dare_index: idx });
        return;
      }
      if (elapsed >= DURATION_S) {
        finishedRef.current = true;
        const seed = `${room.id}-cupidon-${state.round ?? 1}-dodge`;
        const idx = stableIndex(seed, GAGES_CUPIDON.length);
        channelRef.current?.send({ type: "broadcast", event: "proj", payload: { list: [] } });
        void mergePatch(room.id, { phase: "result", outcome: "dodge", loser_slot: shooter, dare_index: idx });
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { finishedRef.current = true; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, iAmShooter, room.id, shooter, state.round]);

  // ── Fuyard chrono
  useEffect(() => {
    if (phase !== "play" || iAmShooter) return;
    setRemaining(DURATION_S);
    const t0 = performance.now();
    const t = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil(DURATION_S - (performance.now() - t0) / 1000)));
    }, 250);
    return () => clearInterval(t);
  }, [phase, iAmShooter]);

  // Shooter = rose, dodger = cyan
  const shooterColor = ROSE_HEX;
  const dodgerColor  = CYAN_HEX;
  const myColor      = iAmShooter ? shooterColor : dodgerColor;
  const otherColor   = iAmShooter ? dodgerColor : shooterColor;
  const myLabel      = myName[0]?.toUpperCase() ?? "?";
  const otherLabel   = otherName[0]?.toUpperCase() ?? "?";

  const timerPct = remaining / DURATION_S;
  const timerColor = remaining > 5 ? "#4ade80" : remaining > 3 ? "#fbbf24" : "#f87171";

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: NIGHT_BG }}>
      <div className="relative z-10 flex flex-1 flex-col px-4 pt-4 pb-4">
        {/* HUD */}
        <div className="flex items-center justify-between mb-3">
          {/* Role badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: `${myColor}22`, border: `1px solid ${myColor}44` }}>
            <span className="text-sm">{iAmShooter ? "🏹" : "🏃"}</span>
            <span className="text-xs font-semibold" style={{ color: myColor }}>
              {iAmShooter ? "Tu tires" : "Tu esquives"}
            </span>
          </div>

          {/* Timer */}
          <div className="flex flex-col items-center">
            <motion.span
              key={remaining}
              initial={{ scale: 1.3, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-bold font-mono"
              style={{ color: timerColor, textShadow: `0 0 12px ${timerColor}` }}>
              {remaining}s
            </motion.span>
            {/* Timer bar */}
            <div className="w-20 h-1.5 rounded-full mt-0.5" style={{ background: "rgba(255,255,255,0.1)" }}>
              <motion.div className="h-full rounded-full" style={{ background: timerColor }}
                animate={{ width: `${timerPct * 100}%` }} transition={{ duration: 0.25, ease: "linear" }} />
            </div>
          </div>

          {/* Other role */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: `${otherColor}22`, border: `1px solid ${otherColor}44` }}>
            <span className="text-xs font-semibold" style={{ color: otherColor }}>
              {iAmShooter ? otherName : otherName}
            </span>
            <span className="text-sm">{iAmShooter ? "🏃" : "🏹"}</span>
          </div>
        </div>

        {/* Arena */}
        <div
          ref={arenaRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative mx-auto w-full max-w-sm touch-none select-none overflow-hidden rounded-3xl"
          style={{
            aspectRatio: `${ARENA_W} / ${ARENA_H}`,
            background: "linear-gradient(180deg, oklch(0.12 0.06 285) 0%, oklch(0.10 0.05 300) 100%)",
            border: "1.5px solid rgba(255,255,255,0.08)",
            boxShadow: "inset 0 0 60px rgba(0,0,0,0.4), 0 8px 40px rgba(0,0,0,0.4)",
          }}>
          {/* Grid lines subtle */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.06]"
            xmlns="http://www.w3.org/2000/svg">
            {[...Array(10)].map((_, i) => (
              <line key={`v${i}`} x1={`${i * 11.1}%`} y1="0" x2={`${i * 11.1}%`} y2="100%"
                stroke="white" strokeWidth="0.5" />
            ))}
            {[...Array(15)].map((_, i) => (
              <line key={`h${i}`} x1="0" y1={`${i * 7.15}%`} x2="100%" y2={`${i * 7.15}%`}
                stroke="white" strokeWidth="0.5" />
            ))}
          </svg>

          {/* Center divider */}
          <div className="absolute left-0 right-0 pointer-events-none"
            style={{ top: "50%", height: "1px", background: "rgba(255,255,255,0.08)" }} />

          {/* Glow zones */}
          <div className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 50% 100%, ${ROSE_HEX}18, transparent 70%)` }} />
          <div className="absolute inset-x-0 top-0 h-24 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at 50% 0%, ${CYAN_HEX}18, transparent 70%)` }} />

          {/* Other player */}
          <PlayerAvatar pos={otherPos} color={otherColor} label={otherLabel} />
          {/* My player */}
          <PlayerAvatar pos={myPos} color={myColor} label={myLabel} isMe />

          {/* Projectiles */}
          {projectiles.map((p) => (
            <motion.div key={p.id}
              className="absolute pointer-events-none"
              style={{
                left: `${(p.x / ARENA_W) * 100}%`,
                top: `${(p.y / ARENA_H) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}>
              {/* Glow ring */}
              <div className="absolute inset-0 rounded-full"
                style={{
                  width: 18, height: 18,
                  left: -5, top: -5,
                  background: `${ROSE_HEX}30`,
                  filter: "blur(4px)",
                }} />
              <span style={{ fontSize: "1.1rem", filter: `drop-shadow(0 0 6px ${ROSE_HEX})` }}>💘</span>
            </motion.div>
          ))}

          {/* Countdown overlay */}
          <AnimatePresence>
            {phase === "countdown" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
                <motion.div key={countdown}
                  initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.6, opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="text-8xl font-bold"
                  style={{ fontFamily: "Cormorant Garamond, serif", color: ROSE_HEX, textShadow: `0 0 40px ${ROSE_HEX}` }}>
                  {countdown > 0 ? countdown : "GO!"}
                </motion.div>
                <p className="text-sm font-semibold" style={{ color: "rgba(253,232,238,0.6)" }}>
                  {iAmShooter ? "Prépare-toi à tirer 🏹" : "Prépare-toi à esquiver 🏃"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hint */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-3 text-center text-xs"
          style={{ color: "rgba(253,232,238,0.35)" }}>
          Glisse ton doigt pour déplacer {myName[0].toUpperCase() + myName.slice(1)}
        </motion.p>
      </div>
    </div>
  );
}

function PlayerAvatar({ pos, color, label, isMe }: { pos: Vec; color: string; label: string; isMe?: boolean }) {
  const sizePct = (PLAYER_R * 2) / ARENA_W * 100;
  return (
    <motion.div
      animate={{ left: `${(pos.x / ARENA_W) * 100}%`, top: `${(pos.y / ARENA_H) * 100}%` }}
      transition={{ type: "tween", duration: 0.05, ease: "linear" }}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full font-bold"
      style={{
        width: `${sizePct * 1.9}%`, aspectRatio: "1 / 1",
        background: `${color}28`,
        border: `2px solid ${color}`,
        boxShadow: `0 0 16px ${color}60, 0 0 6px ${color}40`,
        color,
        fontSize: "clamp(10px, 2.5vw, 16px)",
      }}>
      {label}
      {/* Pulse ring for me */}
      {isMe && (
        <motion.div className="absolute inset-0 rounded-full pointer-events-none"
          style={{ border: `2px solid ${color}` }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeOut" }}
        />
      )}
    </motion.div>
  );
}

// ── Result ─────────────────────────────────────────────────────────────────────
function Result({ state, room, mySlot, otherName }:
  { state: State; room: Room; mySlot: number; otherName: string }) {
  const outcome = state.outcome;
  const loser = state.loser_slot;
  const iLost = loser === mySlot;
  const isHit = outcome === "hit";

  useEffect(() => {
    if (!iLost) confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    const t = setTimeout(() => { void mergePatch(room.id, { phase: "dare" }); }, 2200);
    return () => clearTimeout(t);
  }, [room.id, iLost]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center relative overflow-hidden"
      style={{ background: NIGHT_BG }}>
      <Orb size={200} x="20%" y="20%" delay={0} color={isHit ? "oklch(0.55 0.22 340)" : "oklch(0.50 0.18 140)"} />

      <div className="relative z-10 text-center px-6">
        <motion.div
          initial={{ scale: 0, rotate: -20 }} animate={{ scale: [0, 1.3, 1], rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="text-8xl mb-5">
          {isHit ? "💘" : "🎉"}
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="text-5xl font-semibold"
          style={{ fontFamily: "Cormorant Garamond, serif", color: isHit ? ROSE_HEX : "#4ade80",
            textShadow: `0 0 30px ${isHit ? ROSE_HEX : "#4ade80"}` }}>
          {isHit ? "Touché ! 💘" : "Esquive parfaite !"}
        </motion.h2>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-3 text-base" style={{ color: "rgba(253,232,238,0.55)" }}>
          {iLost ? "Tu as un petit gage… 😏" : `${otherName} a un gage… 😏`}
        </motion.p>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          className="mt-6 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: ROSE_HEX }}
              animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.2 }} />
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// ── Dare ───────────────────────────────────────────────────────────────────────
function DareView({ state, room, mySlot, otherName, onDareDone }:
  { state: State; room: Room; mySlot: number; otherName: string; onDareDone: () => void }) {
  const loser = state.loser_slot;
  const iLost = loser === mySlot;
  const idx = typeof state.dare_index === "number" ? state.dare_index : 0;
  const dare = GAGES_CUPIDON[idx % GAGES_CUPIDON.length];

  useEffect(() => {
    if (iLost) confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
  }, [iLost]);

  const validate = async () => { onDareDone(); await mergePatch(room.id, { phase: "done" }); };

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: NIGHT_BG }}>
      <Orb size={200} x="-10%" y="-5%" delay={0} color="oklch(0.55 0.22 340)" />
      <Orb size={150} x="60%" y="55%" delay={2} color="oklch(0.50 0.18 20)" />

      <div className="relative z-10 flex flex-1 flex-col items-center px-6 pt-8 pb-6">
        {/* Icon */}
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.1 }}
          className="text-7xl mb-3">
          🎁
        </motion.div>

        {/* Hot badge */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="mb-5 px-4 py-1.5 rounded-full text-sm font-semibold"
          style={{ background: `${ROSE_HEX}22`, color: ROSE_HEX, border: `1px solid ${ROSE_HEX}44` }}>
          Gage hot 🔥
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-sm mb-4" style={{ color: "rgba(253,232,238,0.5)" }}>
          {iLost ? "Ton gage du soir 👇" : `Gage pour ${otherName} 👇`}
        </motion.p>

        {/* Dare card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 140 }}
          className="w-full rounded-3xl p-7 text-center"
          style={{
            background: `linear-gradient(145deg, ${ROSE_HEX}18, ${ROSE_HEX}08)`,
            border: `1.5px solid ${ROSE_HEX}40`,
            boxShadow: `0 0 40px ${ROSE_HEX}20, 0 16px 48px rgba(0,0,0,0.25)`,
          }}>
          <p className="text-2xl font-medium leading-snug"
            style={{ fontFamily: "Cormorant Garamond, serif", color: "#fde8ee" }}>
            {dare}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
          className="mt-auto w-full pt-8">
          {iLost ? (
            <motion.button whileTap={{ scale: 0.97 }} onClick={validate}
              className="w-full h-14 rounded-2xl text-base font-semibold relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, oklch(0.65 0.22 340), oklch(0.55 0.20 10))",
                color: "white", boxShadow: "0 8px 28px rgba(220,80,100,0.35)",
              }}>
              <motion.div className="absolute inset-0"
                animate={{ x: ["100%", "-100%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }} />
              <span className="relative z-10">C'est fait ! ✅</span>
            </motion.button>
          ) : (
            <div className="w-full h-14 rounded-2xl flex items-center justify-center text-sm"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(253,232,238,0.4)" }}>
              <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                On attend que {otherName} fasse son gage… 🥹
              </motion.span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ── Done ────────────────────────────────────────────────────────────────────────
function DoneView({ state, room, mySlot, onBackToMenu }:
  { state: State; room: Room; mySlot: number; onBackToMenu: () => void }) {
  useEffect(() => {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }, []);

  const replay = async () => {
    const prevShooter = (state.shooter_slot ?? 1) as 1 | 2;
    const nextShooter = (prevShooter === 1 ? 2 : 1) as 1 | 2;
    await patch(room.id, {
      phase: "countdown", shooter_slot: nextShooter,
      round: (state.round ?? 1) + 1,
      outcome: null, loser_slot: null, dare_index: null,
    });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center relative overflow-hidden"
      style={{ background: NIGHT_BG }}>
      <Orb size={200} x="-5%" y="-5%" delay={0} color="oklch(0.55 0.22 340)" />
      <Orb size={160} x="55%" y="55%" delay={2} color="oklch(0.50 0.16 285)" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center px-6">
        <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: [0, 1.3, 1], rotate: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 12 }}
          className="text-8xl mb-4">
          💞
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="text-4xl font-semibold"
          style={{ fontFamily: "Cormorant Garamond, serif", color: "#fde8ee" }}>
          Belle manche !
        </motion.h2>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
          className="mt-2 text-sm" style={{ color: "rgba(253,232,238,0.45)" }}>
          On inverse les rôles ?
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="mt-auto w-full space-y-3 pt-10">
          {mySlot === 1 ? (
            <motion.button whileTap={{ scale: 0.97 }} onClick={replay}
              className="w-full h-14 rounded-2xl text-base font-semibold relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, oklch(0.65 0.22 340), oklch(0.55 0.20 10))",
                color: "white", boxShadow: "0 8px 28px rgba(220,80,100,0.3)",
              }}>
              <motion.div className="absolute inset-0"
                animate={{ x: ["100%", "-100%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }} />
              <span className="relative z-10">Rejouer 🔁 (rôles inversés)</span>
            </motion.button>
          ) : (
            <div className="w-full h-14 rounded-2xl flex items-center justify-center text-sm"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(253,232,238,0.4)" }}>
              En attente de la décision…
            </div>
          )}
          <motion.button whileTap={{ scale: 0.97 }} onClick={onBackToMenu}
            className="w-full h-12 rounded-2xl text-sm"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(253,232,238,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
            ← Retour au menu
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
