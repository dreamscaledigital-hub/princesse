import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ──────────────── RÉGLAGES (modifiables) ────────────────
const ARENA_W = 100;             // unités logiques
const ARENA_H = 150;
const PLAYER_R = 7;              // rayon joueur (hitbox)
const PROJECTILE_R = 3;          // rayon projectile (cœur)
const PROJECTILE_SPEED = 40;     // unités/seconde
const DURATION_S = 10;           // durée d'une manche
const SHOT_INTERVAL_MS = 1000;   // un tir par seconde
const COUNTDOWN_S = 3;
const POS_BROADCAST_HZ = 20;     // fréquence d'envoi des positions/projectiles

// ──────────────── GAGES HOT (modifiables) ────────────────
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
  shooter_slot?: 1 | 2 | null;     // qui tire
  round?: number;                  // pour seed/réinitialisation
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
  return supabase
    .from("rooms")
    .update({ minigame_state: p })
    .eq("id", roomId)
    .then(() => undefined);
}

// Merge patch via lecture+écriture (la table n'a pas de RPC dédiée pour ce jeu)
async function mergePatch(roomId: string, p: Partial<State>) {
  const { data } = await supabase
    .from("rooms")
    .select("minigame_state")
    .eq("id", roomId)
    .maybeSingle();
  const prev = ((data?.minigame_state ?? {}) as State) || {};
  await supabase
    .from("rooms")
    .update({ minigame_state: { ...prev, ...p } })
    .eq("id", roomId);
}

function stableIndex(seed: string, max: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % max;
}

export function CupidonDuel({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s = (room.minigame_state ?? {}) as State;
  const phase: Phase = s.phase ?? "intro";

  // Init : slot 1 démarre l'écran d'intro
  useEffect(() => {
    if (Object.keys(s).length === 0 && mySlot === 1) {
      void patch(room.id, { phase: "intro", round: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  if (phase === "intro") return <Intro state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onBackToMenu={onBackToMenu} />;
  if (phase === "countdown" || phase === "play") {
    return <Arena state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  }
  if (phase === "result") return <Result state={s} room={room} mySlot={mySlot} otherName={otherName} />;
  if (phase === "dare") return <DareView state={s} room={room} mySlot={mySlot} otherName={otherName} onDareDone={onDareDone} />;
  return <DoneView state={s} room={room} mySlot={mySlot} onBackToMenu={onBackToMenu} />;
}

// ──────────────── INTRO + attribution ────────────────
function Intro({ state, room, mySlot, myName, otherName, onBackToMenu }: { state: State; room: Room; mySlot: number; myName: string; otherName: string; onBackToMenu: () => void }) {
  const shooter = state.shooter_slot ?? null;

  const start = async () => {
    // Si pas encore de tireur, tirage au sort (slot 1 décide)
    let nextShooter = shooter;
    if (!nextShooter) {
      nextShooter = (Math.random() < 0.5 ? 1 : 2) as 1 | 2;
    }
    await mergePatch(room.id, {
      phase: "countdown",
      shooter_slot: nextShooter,
      outcome: null,
      loser_slot: null,
      dare_index: null,
    });
  };

  const iAmShooter = shooter && shooter === mySlot;
  const roleText = !shooter
    ? "Rôles tirés au sort au lancement"
    : iAmShooter
      ? `Tu tires, ${otherName} esquive 🎯`
      : `${otherName} tire, tu esquives 🏃`;

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Duel de Cupidon</p>
        <motion.h1 initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="font-script text-4xl text-primary">
          Duel de Cupidon 💘
        </motion.h1>
        <p className="mt-2 text-sm text-muted-foreground">Esquive les flèches… ou décoche-les 🏹</p>
      </div>

      <div className="mt-6 rounded-3xl bg-gradient-to-br from-rose-100 to-pink-200 p-5 text-center shadow-md">
        <p className="text-5xl">💘</p>
        <p className="mt-2 font-script text-2xl text-primary">{roleText}</p>
        <p className="mt-3 text-xs text-foreground/70">
          {DURATION_S} secondes · 1 tir par seconde<br />
          Touché → le fuyard fait le gage.<br />
          Esquive parfaite → le tireur fait le gage 😏
        </p>
      </div>

      <div className="mt-auto space-y-3 pt-6">
        {mySlot === 1 ? (
          <Button onClick={start} className="h-14 w-full rounded-2xl text-base font-semibold">
            Commencer 💘
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">En attente de {otherName}…</p>
        )}
        <Button variant="ghost" onClick={onBackToMenu} className="h-10 w-full rounded-2xl text-sm">← Menu</Button>
      </div>
    </div>
  );
}

// ──────────────── ARENA (countdown + play) ────────────────
function Arena({ state, room, mySlot, myName, otherName }: { state: State; room: Room; mySlot: number; myName: string; otherName: string }) {
  const shooter = (state.shooter_slot ?? 1) as 1 | 2;
  const iAmShooter = shooter === mySlot;
  const phase = state.phase ?? "countdown";

  // Position de MON perso et de l'autre
  const [myPos, setMyPos] = useState<Vec>(() => mySlot === shooter ? { x: ARENA_W / 2, y: ARENA_H - 18 } : { x: ARENA_W / 2, y: 18 });
  const [otherPos, setOtherPos] = useState<Vec>(() => mySlot === shooter ? { x: ARENA_W / 2, y: 18 } : { x: ARENA_W / 2, y: ARENA_H - 18 });

  // Refs pour la boucle d'animation
  const myPosRef = useRef(myPos);
  const otherPosRef = useRef(otherPos);
  useEffect(() => { myPosRef.current = myPos; }, [myPos]);
  useEffect(() => { otherPosRef.current = otherPos; }, [otherPos]);

  // Projectiles (la source de vérité = côté tireur)
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const projRef = useRef<Projectile[]>([]);
  useEffect(() => { projRef.current = projectiles; }, [projectiles]);

  // Chrono
  const [remaining, setRemaining] = useState(DURATION_S);
  const [countdown, setCountdown] = useState(COUNTDOWN_S);

  // Arène DOM
  const arenaRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  // ── Channel realtime (broadcast)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    const ch = supabase.channel(`cupidon-${room.id}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "pos" }, (msg: { payload: { slot: number; x: number; y: number } }) => {
      const p = msg.payload;
      if (p.slot !== mySlot) setOtherPos({ x: p.x, y: p.y });
    });
    ch.on("broadcast", { event: "proj" }, (msg: { payload: { list: Projectile[] } }) => {
      // Reçu uniquement par le fuyard (envoyé par le tireur)
      if (!iAmShooter) setProjectiles(msg.payload.list);
    });
    ch.subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [room.id, mySlot, iAmShooter]);

  // ── Drag du perso (pointer events sur l'arène)
  const setPosFromEvent = (clientX: number, clientY: number) => {
    const el = arenaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * ARENA_W;
    const y = ((clientY - rect.top) / rect.height) * ARENA_H;
    const clamped = {
      x: Math.max(PLAYER_R, Math.min(ARENA_W - PLAYER_R, x)),
      y: Math.max(PLAYER_R, Math.min(ARENA_H - PLAYER_R, y)),
    };
    setMyPos(clamped);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (phase !== "play") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setPosFromEvent(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    setPosFromEvent(e.clientX, e.clientY);
  };
  const onPointerUp = () => { draggingRef.current = false; };

  // ── Compte à rebours 3-2-1
  useEffect(() => {
    if (phase !== "countdown") return;
    setCountdown(COUNTDOWN_S);
    let n = COUNTDOWN_S;
    const t = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        clearInterval(t);
        // Le tireur lance la manche
        if (iAmShooter) {
          void mergePatch(room.id, { phase: "play" });
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, iAmShooter, room.id]);

  // ── Broadcast position (les deux clients)
  useEffect(() => {
    if (phase !== "play" && phase !== "countdown") return;
    const ch = channelRef.current;
    if (!ch) return;
    const t = setInterval(() => {
      ch.send({ type: "broadcast", event: "pos", payload: { slot: mySlot, x: myPosRef.current.x, y: myPosRef.current.y } });
    }, 1000 / POS_BROADCAST_HZ);
    return () => clearInterval(t);
  }, [phase, mySlot]);

  // ── Boucle de jeu côté TIREUR : tirs, mouvement projectiles, collision, chrono
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

      // Tir périodique : on vise la position courante du fuyard
      if (ts - lastShotRef.current >= SHOT_INTERVAL_MS && elapsed < DURATION_S) {
        lastShotRef.current = ts;
        const from = myPosRef.current;            // tireur = moi
        const to = otherPosRef.current;           // fuyard = autre
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.max(0.0001, Math.hypot(dx, dy));
        const proj: Projectile = {
          id: ++projectileIdRef.current,
          x: from.x,
          y: from.y,
          vx: (dx / len) * PROJECTILE_SPEED,
          vy: (dy / len) * PROJECTILE_SPEED,
        };
        projRef.current = [...projRef.current, proj];
      }

      // Avance projectiles
      const runner = otherPosRef.current;
      let hit = false;
      const next: Projectile[] = [];
      for (const p of projRef.current) {
        const nx = p.x + p.vx * dt;
        const ny = p.y + p.vy * dt;
        // collision avec fuyard
        if (Math.hypot(nx - runner.x, ny - runner.y) < PLAYER_R + PROJECTILE_R) {
          hit = true;
          continue;
        }
        // hors arène (avec marge)
        if (nx < -10 || nx > ARENA_W + 10 || ny < -10 || ny > ARENA_H + 10) continue;
        next.push({ ...p, x: nx, y: ny });
      }
      projRef.current = next;
      setProjectiles(next);

      // Broadcast projectiles aux fuyards (~20Hz)
      if (ts - lastBroadcast > 1000 / POS_BROADCAST_HZ) {
        lastBroadcast = ts;
        channelRef.current?.send({ type: "broadcast", event: "proj", payload: { list: next } });
      }

      // Fin de manche : collision ou temps écoulé
      if (hit) {
        finishedRef.current = true;
        const runnerSlot = shooter === 1 ? 2 : 1;
        const seed = `${room.id}-cupidon-${state.round ?? 1}-hit`;
        const idx = stableIndex(seed, GAGES_CUPIDON.length);
        // Broadcast une dernière fois la liste vide pour clean visuel
        channelRef.current?.send({ type: "broadcast", event: "proj", payload: { list: [] } });
        void mergePatch(room.id, {
          phase: "result",
          outcome: "hit",
          loser_slot: runnerSlot,
          dare_index: idx,
        });
        return;
      }
      if (elapsed >= DURATION_S) {
        finishedRef.current = true;
        const seed = `${room.id}-cupidon-${state.round ?? 1}-dodge`;
        const idx = stableIndex(seed, GAGES_CUPIDON.length);
        channelRef.current?.send({ type: "broadcast", event: "proj", payload: { list: [] } });
        void mergePatch(room.id, {
          phase: "result",
          outcome: "dodge",
          loser_slot: shooter,
          dare_index: idx,
        });
        return;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      finishedRef.current = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, iAmShooter, room.id, shooter, state.round]);

  // Côté fuyard : on n'a pas besoin de raf, on rend ce qu'on reçoit en broadcast
  // mais on peut afficher un petit chrono local approximatif pour le suspense
  useEffect(() => {
    if (phase !== "play" || iAmShooter) return;
    setRemaining(DURATION_S);
    const t0 = performance.now();
    const t = setInterval(() => {
      const e = (performance.now() - t0) / 1000;
      setRemaining(Math.max(0, Math.ceil(DURATION_S - e)));
    }, 250);
    return () => clearInterval(t);
  }, [phase, iAmShooter]);

  // Avatars : Eloise (slot 2) = fille blonde 👱‍♀️, l'autre (slot 1) = garçon brun 👨
  const avatarFor = (slot: number) => (slot === 2 ? "👱‍♀️" : "👨");
  const myAvatar = avatarFor(mySlot);
  const otherAvatar = avatarFor(mySlot === 1 ? 2 : 1);

  const roleLabel = iAmShooter ? "🏹 Tu tires" : "🏃 Tu esquives";

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between text-xs">
        <span className="rounded-full bg-card/80 px-2 py-1 font-medium">{roleLabel}</span>
        <span className="font-mono text-base font-bold text-primary">⏱ {remaining}s</span>
      </div>

      <div
        ref={arenaRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative mx-auto mt-3 w-full max-w-sm touch-none select-none overflow-hidden rounded-3xl border-2 border-white/60 bg-gradient-to-br from-rose-100 via-pink-50 to-emerald-100 shadow-inner"
        style={{ aspectRatio: `${ARENA_W} / ${ARENA_H}` }}
      >
        {/* Avatars : autre */}
        <Avatar pos={otherPos} emoji={otherAvatar} ring={iAmShooter ? "target" : "self"} />
        {/* Avatars : moi */}
        <Avatar pos={myPos} emoji={myAvatar} ring={iAmShooter ? "self" : "target"} me />

        {/* Projectiles */}
        {projectiles.map((p) => (
          <div
            key={p.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-lg"
            style={{ left: `${(p.x / ARENA_W) * 100}%`, top: `${(p.y / ARENA_H) * 100}%` }}
          >
            💘
          </div>
        ))}

        {/* Overlay countdown */}
        <AnimatePresence>
          {phase === "countdown" && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-sm"
            >
              <motion.div
                key={countdown}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="font-script text-7xl text-primary drop-shadow"
              >
                {countdown > 0 ? countdown : "GO !"}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 text-center text-xs text-muted-foreground">
        Glisse ton doigt dans l'arène pour bouger {myName} ({myAvatar})
      </div>
    </div>
  );
}

function Avatar({ pos, emoji, ring, me }: { pos: Vec; emoji: string; ring: "self" | "target"; me?: boolean }) {
  const sizePct = (PLAYER_R * 2) / ARENA_W * 100;
  return (
    <motion.div
      animate={{ left: `${(pos.x / ARENA_W) * 100}%`, top: `${(pos.y / ARENA_H) * 100}%` }}
      transition={{ type: "tween", duration: 0.05, ease: "linear" }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full border-2 shadow ${
        ring === "self" ? "border-emerald-400 bg-white/80" : "border-rose-400 bg-white/80"
      } ${me ? "ring-2 ring-primary/40" : ""}`}
      style={{ width: `${sizePct * 1.8}%`, aspectRatio: "1 / 1", fontSize: "1.4rem" }}
    >
      <span>{emoji}</span>
    </motion.div>
  );
}

// ──────────────── RESULT ────────────────
function Result({ state, room, mySlot, otherName }: { state: State; room: Room; mySlot: number; otherName: string }) {
  const outcome = state.outcome;
  const loser = state.loser_slot;
  const iLost = loser === mySlot;

  useEffect(() => {
    const t = setTimeout(() => {
      // tout le monde peut faire avancer ; on protège avec la phase courante
      void mergePatch(room.id, { phase: "dare" });
    }, 1800);
    return () => clearTimeout(t);
  }, [room.id]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} className="text-7xl">
        {outcome === "hit" ? "💘" : "🎉"}
      </motion.div>
      <h2 className="mt-6 font-script text-4xl text-primary">
        {outcome === "hit" ? "Touché ! 💘" : "Esquive parfaite ! 🎉"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {iLost ? "Tu as un petit gage… 😏" : `${otherName} a un petit gage… 😏`}
      </p>
    </div>
  );
}

// ──────────────── DARE ────────────────
function DareView({ state, room, mySlot, otherName, onDareDone }: { state: State; room: Room; mySlot: number; otherName: string; onDareDone: () => void }) {
  const loser = state.loser_slot;
  const iLost = loser === mySlot;
  const idx = typeof state.dare_index === "number" ? state.dare_index : 0;
  const dare = GAGES_CUPIDON[idx % GAGES_CUPIDON.length];

  const validate = async () => {
    onDareDone();
    await mergePatch(room.id, { phase: "done" });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="text-6xl">
        🎁
      </motion.div>
      <div className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        Gage hot 🔥
      </div>
      <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
        {iLost ? "Ton gage" : `Gage pour ${otherName}`}
      </p>
      <h2 className="mt-3 px-4 font-script text-3xl leading-tight text-primary">{dare}</h2>
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

// ──────────────── DONE ────────────────
function DoneView({ state, room, mySlot, onBackToMenu }: { state: State; room: Room; mySlot: number; onBackToMenu: () => void }) {
  useEffect(() => {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }, []);

  const replay = async () => {
    // On inverse les rôles et on incrémente le round (seed différent)
    const prevShooter = (state.shooter_slot ?? 1) as 1 | 2;
    const nextShooter = (prevShooter === 1 ? 2 : 1) as 1 | 2;
    await patch(room.id, {
      phase: "countdown",
      shooter_slot: nextShooter,
      round: (state.round ?? 1) + 1,
      outcome: null,
      loser_slot: null,
      dare_index: null,
    });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} className="text-8xl">💞</motion.div>
      <h2 className="mt-6 font-script text-4xl text-primary">Belle manche !</h2>
      <p className="mt-2 text-sm text-muted-foreground">On inverse les rôles ?</p>

      <div className="mt-8 w-full max-w-xs space-y-3">
        {mySlot === 1 ? (
          <Button onClick={replay} className="h-14 w-full rounded-2xl text-base font-semibold">
            Rejouer 🔁 (rôles inversés)
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
