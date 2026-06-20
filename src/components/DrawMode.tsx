import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

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

// ─────────── Constantes ───────────
const WORDS = [
  "chat","chien","lapin","ours","licorne","papillon","dauphin","renard","hibou","éléphant",
  "singe","girafe","pingouin","koala","dragon","pizza","glace","fraise","gâteau","café",
  "croissant","sushi","chocolat","burger","crêpe","pastèque","ananas","cookie","macarons",
  "plage","montagne","forêt","château","jardin","cinéma","restaurant","île","phare","igloo",
  "volcan","désert","guitare","bougie","vélo","téléphone","livre","lunettes","chapeau",
  "parapluie","couronne","diamant","fusée","ballon","bisou","câlin","coeur","mariage","voyage",
  "étoiles","danse","surprise","roses","promesse","bateau",
];

const GAGES_TAP = [
  "Un bisou de 10 secondes 💋",
  "Un compliment sincère, regard dans les yeux 🥰",
  "Un câlin de 30 secondes 🤗",
  "Imite l'autre pendant 1 minute 🎭",
  "Chante une chanson d'amour 🎤",
  "Raconte ton souvenir préféré à deux 💞",
  "Masse les épaules 1 minute 💆",
  "Danse 30 secondes sur la prochaine musique 💃",
  "Donne un surnom mignon tout neuf 🍓",
  "Lis un message d'amour à voix haute 💌",
];

const DRAW_COLORS = [
  "#0d0d1a",
  "#f43f5e",
  "#fbbf24",
  "#4ade80",
  "#38bdf8",
  "#a78bfa",
  "#fb923c",
  "#f9a8d4",
];
const SIZES = [3, 7, 14];
const ERASER = { color: "#ffffff", width: 24 };

const TOTAL_ROUNDS = 4;
const DRAW_DURATION_MS = 90_000;
const PICK_DURATION_MS = 5_000;
const HINT_INTERVAL_MS = 25_000;
const POST_RESULT_AUTO_MS = 5000;
const AUTHORITY_SLOT = 1;

// ─────────── Types ───────────
type Phase = "word_pick" | "drawing" | "correct" | "timeout" | "round_end" | "game_over";

type DrawState = {
  game?: "draw";
  phase?: Phase;
  word?: string;
  word_display?: string;
  word_hint?: string;
  word_choices?: string[];
  pick_started_at?: number;
  drawer_slot?: 1 | 2;
  round?: number;
  scores?: [number, number];
  started_at?: number;
  gage?: string;
  wrong_guesses?: string[];
  found_at_ms?: number | null;
  dare_done?: boolean;
};

type StrokePoint = { x: number; y: number };
type StrokePayload = {
  pts: StrokePoint[];
  color: string;
  width: number;
  newPath: boolean;
};

type Props = {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
  onDareDone: () => void;
};

// ─────────── Utils ───────────
function pick<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeDisplay(word: string): string {
  return word
    .split("")
    .map((c) => (/\s/.test(c) ? " " : /[a-zàâäéèêëïîôöùûüç-]/i.test(c) ? "_" : c))
    .join(" ");
}

function makeHintFrom(word: string, revealed: Set<number>): string {
  return word
    .split("")
    .map((c, i) => {
      if (/\s/.test(c)) return " ";
      if (!/[a-zàâäéèêëïîôöùûüç-]/i.test(c)) return c;
      return revealed.has(i) ? c : "_";
    })
    .join(" ");
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

async function patchState(roomId: string, patch: Record<string, unknown>) {
  await supabase.rpc("minigame_patch", { _room_id: roomId, _patch: patch });
}

async function setState(roomId: string, state: Record<string, unknown>) {
  await supabase.from("rooms").update({ minigame_state: state }).eq("id", roomId);
}

function computeScore(elapsedMs: number): number {
  if (elapsedMs < 20_000) return 10;
  if (elapsedMs < 45_000) return 7;
  return 4;
}

// ─────────── HintDisplay ───────────
function HintDisplay({ hint, color = EMERALD }: { hint: string; color?: string }) {
  if (!hint) return null;
  const chars = hint.split(" ");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, justifyContent: "center", alignItems: "flex-end" }}>
      {chars.map((ch, i) => {
        if (ch === "") return <div key={i} style={{ width: 14, height: 38 }} />;
        const isRevealed = ch !== "_";
        return (
          <motion.div
            key={i}
            animate={isRevealed ? { scale: [1.25, 1] } : { scale: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              width: 26,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 7,
              background: isRevealed ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.04)",
              border: isRevealed ? `1.5px solid ${color}55` : "1.5px solid rgba(255,255,255,0.10)",
              borderBottom: isRevealed ? `3px solid ${color}` : "3px solid rgba(255,255,255,0.22)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              textShadow: isRevealed ? `0 0 10px ${color}` : "none",
              textTransform: "uppercase" as const,
              letterSpacing: 1,
            }}
          >
            {isRevealed ? ch : ""}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─────────── Composant principal ───────────
export function DrawMode({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const state = (room.minigame_state ?? {}) as DrawState;
  const isAuthority = mySlot === AUTHORITY_SLOT;

  const phase: Phase = state.phase ?? "word_pick";
  const round = state.round ?? 1;
  const drawerSlot = state.drawer_slot ?? 1;
  const isDrawer = mySlot === drawerSlot;
  const scores = state.scores ?? [0, 0];
  const myScore = scores[mySlot - 1] ?? 0;
  const otherScore = scores[mySlot === 1 ? 1 : 0] ?? 0;

  // ─────────── INIT du jeu ───────────
  useEffect(() => {
    if (!isAuthority) return;
    if (state.game === "draw") return;
    const choices = pick(WORDS, 3);
    const fresh: DrawState = {
      game: "draw",
      phase: "word_pick",
      round: 1,
      drawer_slot: 1,
      scores: [0, 0],
      word_choices: choices,
      pick_started_at: Date.now(),
      gage: pickOne(GAGES_TAP),
      wrong_guesses: [],
      dare_done: false,
    };
    void setState(room.id, fresh as Record<string, unknown>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthority, state.game, room.id]);

  // ─────────── Auto-pick après 5s ───────────
  useEffect(() => {
    if (!isAuthority) return;
    if (phase !== "word_pick") return;
    if (!state.pick_started_at || !state.word_choices?.length) return;
    const elapsed = Date.now() - state.pick_started_at;
    const remaining = Math.max(0, PICK_DURATION_MS - elapsed);
    const t = setTimeout(() => {
      const cur = (room.minigame_state ?? {}) as DrawState;
      if (cur.phase !== "word_pick") return;
      const chosen = pickOne(cur.word_choices ?? WORDS);
      void patchState(room.id, {
        phase: "drawing",
        word: chosen,
        word_display: makeDisplay(chosen),
        word_hint: makeDisplay(chosen),
        started_at: Date.now(),
        wrong_guesses: [],
        found_at_ms: null,
      });
    }, remaining + 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthority, phase, state.pick_started_at, room.id]);

  // ─────────── Timeout drawing 90s ───────────
  useEffect(() => {
    if (!isAuthority) return;
    if (phase !== "drawing") return;
    if (!state.started_at) return;
    const elapsed = Date.now() - state.started_at;
    const remaining = Math.max(0, DRAW_DURATION_MS - elapsed);
    const t = setTimeout(() => {
      const cur = (room.minigame_state ?? {}) as DrawState;
      if (cur.phase !== "drawing") return;
      void patchState(room.id, { phase: "timeout" });
    }, remaining + 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthority, phase, state.started_at, room.id]);

  // ─────────── Indice toutes les 25s ───────────
  useEffect(() => {
    if (!isAuthority) return;
    if (phase !== "drawing") return;
    if (!state.started_at || !state.word) return;
    const tick = () => {
      const cur = (room.minigame_state ?? {}) as DrawState;
      if (cur.phase !== "drawing" || !cur.word_hint || !cur.word) return;
      const hidden: number[] = [];
      const letters = cur.word.split("");
      const hintChars = (cur.word_hint.match(/\S|\s/g) || []).filter((c) => c !== " ");
      letters.forEach((c, i) => {
        if (/[a-zàâäéèêëïîôöùûüç-]/i.test(c) && hintChars[i] === "_") hidden.push(i);
      });
      if (hidden.length <= 1) return;
      const idx = hidden[Math.floor(Math.random() * hidden.length)];
      const revealed = new Set<number>();
      letters.forEach((c, i) => {
        if (!/[a-zàâäéèêëïîôöùûüç-]/i.test(c)) return;
        if (hintChars[i] !== "_") revealed.add(i);
      });
      revealed.add(idx);
      void patchState(room.id, { word_hint: makeHintFrom(cur.word, revealed) });
    };
    const interval = setInterval(tick, HINT_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthority, phase, state.started_at, state.word, room.id]);

  // ─────────── Auto next-round après résultat ───────────
  useEffect(() => {
    if (!isAuthority) return;
    if (phase !== "correct" && phase !== "timeout") return;
    const t = setTimeout(() => goNextRound(), POST_RESULT_AUTO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthority, phase, round]);

  async function goNextRound() {
    const cur = (room.minigame_state ?? {}) as DrawState;
    if (cur.phase !== "correct" && cur.phase !== "timeout") return;
    const curRound = cur.round ?? 1;
    if (curRound >= TOTAL_ROUNDS) {
      await patchState(room.id, { phase: "game_over" });
      return;
    }
    const nextRound = curRound + 1;
    const nextDrawer: 1 | 2 = nextRound % 2 === 1 ? 1 : 2;
    const choices = pick(WORDS, 3);
    await patchState(room.id, {
      phase: "word_pick",
      round: nextRound,
      drawer_slot: nextDrawer,
      word_choices: choices,
      pick_started_at: Date.now(),
      word: null,
      word_display: null,
      word_hint: null,
      wrong_guesses: [],
      started_at: null,
      found_at_ms: null,
    });
  }

  // ─────────── Confetti victoire finale ───────────
  const fired = useRef(false);
  useEffect(() => {
    if (phase === "game_over" && !fired.current) {
      const [s1, s2] = scores;
      const iWon = mySlot === 1 ? s1 > s2 : s2 > s1;
      if (iWon) {
        fired.current = true;
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
      }
    }
    if (phase !== "game_over") fired.current = false;
  }, [phase, scores, mySlot]);

  const replay = async () => {
    if (!isAuthority) return;
    const choices = pick(WORDS, 3);
    const fresh: DrawState = {
      game: "draw",
      phase: "word_pick",
      round: 1,
      drawer_slot: 1,
      scores: [0, 0],
      word_choices: choices,
      pick_started_at: Date.now(),
      gage: pickOne(GAGES_TAP),
      wrong_guesses: [],
      dare_done: false,
    };
    await setState(room.id, fresh as Record<string, unknown>);
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: BG,
      display: "flex",
      flexDirection: "column",
      padding: "14px 14px 28px",
      gap: 12,
      fontFamily: "'Inter', system-ui, sans-serif",
      touchAction: "manipulation",
      color: "#fff",
    }}>
      {/* Header */}
      <div style={{ ...glass, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 16 }}>
        <button
          onClick={onBackToMenu}
          style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          ← Menu
        </button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "rgba(255,255,255,0.35)" }}>
            Dessine & Devine
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", letterSpacing: 1 }}>
            Round {Math.min(round, TOTAL_ROUNDS)}/{TOTAL_ROUNDS}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ color: EMERALD, fontSize: 17, fontWeight: 800 }}>{myScore}</span>
          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 13 }}>–</span>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 17, fontWeight: 800 }}>{otherScore}</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === "word_pick" && (
          <motion.div
            key="pick"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ flex: 1, display: "flex", flexDirection: "column" }}
          >
            <WordPickScreen
              state={state}
              isDrawer={isDrawer}
              isAuthority={isAuthority}
              roomId={room.id}
              drawerName={isDrawer ? myName : otherName}
            />
          </motion.div>
        )}
        {phase === "drawing" && (
          <motion.div
            key="draw"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}
          >
            <DrawingScreen
              room={room}
              state={state}
              isDrawer={isDrawer}
              mySlot={mySlot}
              myName={myName}
              otherName={otherName}
            />
          </motion.div>
        )}
        {(phase === "correct" || phase === "timeout") && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{ flex: 1, display: "flex", flexDirection: "column" }}
          >
            <ResultScreen
              state={state}
              phase={phase}
              isAuthority={isAuthority}
              onNext={goNextRound}
            />
          </motion.div>
        )}
        {phase === "game_over" && (
          <motion.div
            key="over"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ flex: 1, display: "flex", flexDirection: "column" }}
          >
            <GameOverScreen
              state={state}
              mySlot={mySlot}
              myName={myName}
              otherName={otherName}
              isAuthority={isAuthority}
              onReplay={replay}
              onBackToMenu={onBackToMenu}
              onDareDone={async () => {
                await patchState(room.id, { dare_done: true });
                onDareDone();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────── Phase: Choix du mot ───────────
function WordPickScreen({
  state, isDrawer, isAuthority, roomId, drawerName,
}: {
  state: DrawState;
  isDrawer: boolean;
  isAuthority: boolean;
  roomId: string;
  drawerName: string;
}) {
  const [remaining, setRemaining] = useState(PICK_DURATION_MS);

  useEffect(() => {
    if (!state.pick_started_at) return;
    const update = () => {
      const r = Math.max(0, PICK_DURATION_MS - (Date.now() - (state.pick_started_at ?? 0)));
      setRemaining(r);
    };
    update();
    const i = setInterval(update, 100);
    return () => clearInterval(i);
  }, [state.pick_started_at]);

  const pickWord = async (word: string) => {
    if (!isAuthority) {
      await patchState(roomId, { word_choice_pending: word });
      return;
    }
    await patchState(roomId, {
      phase: "drawing",
      word,
      word_display: makeDisplay(word),
      word_hint: makeDisplay(word),
      started_at: Date.now(),
      wrong_guesses: [],
      found_at_ms: null,
    });
  };

  useEffect(() => {
    if (!isAuthority) return;
    const pending = (state as DrawState & { word_choice_pending?: string }).word_choice_pending;
    if (!pending) return;
    void patchState(roomId, {
      phase: "drawing",
      word: pending,
      word_display: makeDisplay(pending),
      word_hint: makeDisplay(pending),
      started_at: Date.now(),
      wrong_guesses: [],
      found_at_ms: null,
      word_choice_pending: null,
    });
  }, [isAuthority, state, roomId]);

  const secs = Math.ceil(remaining / 1000);
  const pct = remaining / PICK_DURATION_MS;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, padding: "0 8px" }}>
      {/* Countdown ring */}
      <div style={{ position: "relative", width: 68, height: 68 }}>
        <svg width="68" height="68" viewBox="0 0 68 68" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="34" cy="34" r="29" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          <circle
            cx="34" cy="34" r="29"
            fill="none"
            stroke={secs <= 1 ? ROSE : AMBER}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 29}
            strokeDashoffset={(2 * Math.PI * 29) * (1 - pct)}
            style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.3s" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: secs <= 1 ? ROSE : "#fff" }}>
          {secs}
        </div>
      </div>

      {isDrawer ? (
        <>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 34, fontStyle: "italic", color: "#fff", margin: 0, lineHeight: 1 }}>
              Choisis ton mot
            </h2>
            <p style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.40)" }}>
              À toi de le faire deviner ✨
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 320 }}>
            {(state.word_choices ?? []).map((w, idx) => (
              <motion.button
                key={w}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => pickWord(w)}
                style={{
                  ...glass,
                  padding: "18px 24px",
                  border: "1px solid rgba(255,255,255,0.14)",
                  cursor: "pointer",
                  fontSize: 20,
                  fontWeight: 600,
                  color: "#fff",
                  textAlign: "center",
                  textTransform: "capitalize",
                  letterSpacing: 0.5,
                  background: "rgba(255,255,255,0.07)",
                  transition: "background 0.2s",
                  borderRadius: 18,
                }}
              >
                {w}
              </motion.button>
            ))}
          </div>
        </>
      ) : (
        <>
          <motion.div
            animate={{ rotate: [0, -8, 8, -4, 4, 0], scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            style={{ fontSize: 72, lineHeight: 1 }}
          >
            🎨
          </motion.div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 30, fontStyle: "italic", color: "#fff", margin: 0 }}>
              {drawerName} choisit…
            </h2>
            <p style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.40)" }}>
              Prépare-toi à deviner 💭
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────── Phase: Dessin ───────────
function DrawingScreen({
  room, state, isDrawer, mySlot, myName, otherName,
}: {
  room: Room;
  state: DrawState;
  isDrawer: boolean;
  mySlot: number;
  myName: string;
  otherName: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [color, setColor] = useState(DRAW_COLORS[0]);
  const [brushSize, setBrushSize] = useState(SIZES[0]);
  const [isErasing, setIsErasing] = useState(false);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<StrokePoint | null>(null);
  const batchRef = useRef<StrokePoint[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newPathRef = useRef(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [guess, setGuess] = useState("");
  const [remaining, setRemaining] = useState(DRAW_DURATION_MS);

  // suppress unused warning
  void mySlot;
  void myName;
  void lastPointRef;

  // Timer display
  useEffect(() => {
    if (!state.started_at) return;
    const update = () => {
      const r = Math.max(0, DRAW_DURATION_MS - (Date.now() - (state.started_at ?? 0)));
      setRemaining(r);
    };
    update();
    const i = setInterval(update, 200);
    return () => clearInterval(i);
  }, [state.started_at]);

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctxRef.current = ctx;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Channel broadcast
  useEffect(() => {
    const channel = supabase.channel(`draw:${room.code}`, {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "stroke" }, ({ payload }: { payload: StrokePayload }) => {
        if (isDrawer) return;
        drawStrokeOnCanvas(payload);
      })
      .on("broadcast", { event: "clear" }, () => {
        if (isDrawer) return;
        clearCanvas();
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.code, isDrawer]);

  const drawStrokeOnCanvas = (payload: StrokePayload) => {
    const ctx = ctxRef.current;
    if (!ctx || payload.pts.length === 0) return;
    ctx.strokeStyle = payload.color;
    ctx.lineWidth = payload.width;
    if (payload.newPath) {
      ctx.beginPath();
      ctx.moveTo(payload.pts[0].x, payload.pts[0].y);
      for (let i = 1; i < payload.pts.length; i++) {
        ctx.lineTo(payload.pts[i].x, payload.pts[i].y);
      }
    } else {
      for (const p of payload.pts) ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  };

  const flushBatch = () => {
    if (batchRef.current.length === 0) return;
    const payload: StrokePayload = {
      pts: batchRef.current,
      color: isErasing ? ERASER.color : color,
      width: isErasing ? ERASER.width : brushSize,
      newPath: newPathRef.current,
    };
    drawStrokeOnCanvas(payload);
    channelRef.current?.send({ type: "broadcast", event: "stroke", payload });
    batchRef.current = [];
    newPathRef.current = false;
  };

  const getPoint = (e: React.PointerEvent): StrokePoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDrawer) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    isDrawingRef.current = true;
    newPathRef.current = true;
    const p = getPoint(e);
    lastPointRef.current = p;
    batchRef.current = [p];
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = setTimeout(flushBatch, 50);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawer || !isDrawingRef.current) return;
    e.preventDefault();
    const p = getPoint(e);
    lastPointRef.current = p;
    batchRef.current.push(p);
    if (!batchTimerRef.current) {
      batchTimerRef.current = setTimeout(() => {
        flushBatch();
        batchTimerRef.current = null;
      }, 50);
    }
  };

  const handlePointerUp = () => {
    if (!isDrawer) return;
    isDrawingRef.current = false;
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    flushBatch();
    newPathRef.current = true;
  };

  const handleClear = () => {
    if (!isDrawer) return;
    clearCanvas();
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
  };

  const submitGuess = async () => {
    if (isDrawer || !guess.trim() || !state.word || !state.started_at) return;
    const g = normalize(guess);
    const w = normalize(state.word);
    setGuess("");
    if (g === w) {
      const elapsed = Date.now() - state.started_at;
      const pts = computeScore(elapsed);
      const newScores: [number, number] = [...(state.scores ?? [0, 0])] as [number, number];
      newScores[0] += pts;
      newScores[1] += pts;
      channelRef.current?.send({ type: "broadcast", event: "correct", payload: {} });
      await patchState(room.id, {
        phase: "correct",
        scores: newScores,
        found_at_ms: elapsed,
      });
    } else {
      const wrongs = [...(state.wrong_guesses ?? []), guess.trim()].slice(-6);
      await patchState(room.id, { wrong_guesses: wrongs });
    }
  };

  const secs = Math.ceil(remaining / 1000);
  const pct = remaining / DRAW_DURATION_MS;
  const timerColor = secs <= 10 ? ROSE : secs <= 30 ? AMBER : EMERALD;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
      {/* Timer bar + info */}
      <div style={{ ...glass, padding: "10px 14px 14px", borderRadius: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <motion.span
            animate={{ color: timerColor }}
            style={{ fontFamily: "'Courier New', monospace", fontSize: 22, fontWeight: 800 }}
          >
            {secs}s
          </motion.span>
          {isDrawer ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 2 }}>
                Dessine
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: timerColor, textShadow: `0 0 18px ${timerColor}88`, textTransform: "capitalize" }}>
                {state.word}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)" }}>
              {otherName} dessine…
            </span>
          )}
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>
            {isDrawer ? `${otherName} devine` : "Devine !"}
          </span>
        </div>
        {/* Progress bar */}
        <div style={{ height: 4, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <motion.div
            animate={{ width: `${pct * 100}%`, backgroundColor: timerColor }}
            transition={{ duration: 0.2, ease: "linear" }}
            style={{ height: "100%", borderRadius: 4 }}
          />
        </div>
        {/* Guesser: hint tiles */}
        {!isDrawer && (
          <div style={{ marginTop: 14 }}>
            <HintDisplay hint={state.word_hint ?? state.word_display ?? ""} color={timerColor} />
          </div>
        )}
      </div>

      {/* Canvas */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 20,
          overflow: "hidden",
          border: `2px solid ${isDrawer ? timerColor + "55" : "rgba(255,255,255,0.10)"}`,
          boxShadow: isDrawer ? `0 0 24px ${timerColor}22, inset 0 0 0 1px ${timerColor}22` : "none",
          background: "#fff",
          touchAction: "none",
          transition: "border-color 0.5s, box-shadow 0.5s",
          flexShrink: 0,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            touchAction: "none",
            cursor: isDrawer ? (isErasing ? "cell" : "crosshair") : "default",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {!isDrawer && (
          <div style={{
            position: "absolute",
            bottom: 10,
            right: 12,
            fontSize: 11,
            color: "rgba(0,0,0,0.22)",
            pointerEvents: "none",
            userSelect: "none",
          }}>
            🎨 {otherName} dessine
          </div>
        )}
      </div>

      {isDrawer ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Color palette + eraser */}
          <div style={{ ...glass, padding: "10px 12px", borderRadius: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flex: 1, overflowX: "auto", scrollbarWidth: "none" }}>
              {DRAW_COLORS.map((c) => {
                const active = !isErasing && color === c;
                return (
                  <motion.button
                    key={c}
                    whileTap={{ scale: 0.82 }}
                    onClick={() => { setColor(c); setIsErasing(false); }}
                    style={{
                      width: 34,
                      height: 34,
                      flexShrink: 0,
                      borderRadius: "50%",
                      background: c === "#0d0d1a"
                        ? "radial-gradient(circle at 35% 30%, #2a2a3a, #0d0d1a)"
                        : `radial-gradient(circle at 32% 30%, ${c}ff 0%, ${c}cc 55%, ${c}99 100%)`,
                      border: active ? "2.5px solid #fff" : "2.5px solid transparent",
                      boxShadow: active
                        ? `0 0 0 2px ${c}, 0 0 14px ${c}aa`
                        : `0 0 6px ${c}33, inset 0 -2px 4px rgba(0,0,0,0.2)`,
                      cursor: "pointer",
                      transform: active ? "scale(1.2)" : "scale(1)",
                      transition: "transform 0.15s, box-shadow 0.15s, border 0.15s",
                      padding: 0,
                    }}
                  />
                );
              })}
            </div>
            {/* Eraser */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => setIsErasing((v) => !v)}
              style={{
                flexShrink: 0,
                width: 44,
                height: 36,
                borderRadius: 12,
                border: isErasing ? `2px solid ${AMBER}` : "2px solid rgba(255,255,255,0.14)",
                background: isErasing ? `${AMBER}1e` : "rgba(255,255,255,0.05)",
                cursor: "pointer",
                fontSize: 17,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isErasing ? `0 0 14px ${AMBER}55` : "none",
                transition: "all 0.2s",
                padding: 0,
              }}
            >
              🧽
            </motion.button>
          </div>

          {/* Brush sizes + clear */}
          <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
            <div style={{ ...glass, padding: "8px 12px", borderRadius: 14, display: "flex", gap: 8, alignItems: "center", flex: 1, justifyContent: "center" }}>
              {SIZES.map((s) => {
                const active = !isErasing && brushSize === s;
                return (
                  <motion.button
                    key={s}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => { setBrushSize(s); setIsErasing(false); }}
                    style={{
                      width: 52,
                      height: 38,
                      borderRadius: 10,
                      border: active ? `2px solid ${EMERALD}` : "2px solid rgba(255,255,255,0.10)",
                      background: active ? `${EMERALD}18` : "rgba(255,255,255,0.04)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: active ? `0 0 10px ${EMERALD}44` : "none",
                      transition: "all 0.15s",
                      padding: 0,
                    }}
                  >
                    <div style={{
                      width: Math.min(s * 2.2, 28),
                      height: Math.min(s * 2.2, 28),
                      borderRadius: "50%",
                      background: isErasing ? "rgba(255,255,255,0.3)" : color,
                      boxShadow: active ? `0 0 6px ${color}88` : "none",
                      flexShrink: 0,
                    }} />
                  </motion.button>
                );
              })}
            </div>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleClear}
              style={{
                height: "auto",
                minHeight: 54,
                paddingLeft: 16,
                paddingRight: 16,
                borderRadius: 14,
                border: `1.5px solid ${ROSE}44`,
                background: `${ROSE}12`,
                color: ROSE,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              🗑️ Effacer
            </motion.button>
          </div>

          <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.30)", margin: 0 }}>
            {otherName} essaie de deviner 💭
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Guess input */}
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitGuess(); }}
              placeholder="Ta proposition…"
              autoFocus
              style={{
                flex: 1,
                height: 52,
                borderRadius: 14,
                border: "1.5px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.07)",
                color: "#fff",
                fontSize: 16,
                padding: "0 16px",
                outline: "none",
                fontFamily: "inherit",
                WebkitAppearance: "none",
              }}
            />
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={submitGuess}
              disabled={!guess.trim()}
              style={{
                height: 52,
                paddingLeft: 20,
                paddingRight: 20,
                borderRadius: 14,
                border: "none",
                background: guess.trim()
                  ? `linear-gradient(135deg, ${EMERALD}, #22d3ee)`
                  : "rgba(255,255,255,0.08)",
                color: guess.trim() ? "#0a1a0a" : "rgba(255,255,255,0.28)",
                fontWeight: 700,
                fontSize: 15,
                cursor: guess.trim() ? "pointer" : "not-allowed",
                transition: "all 0.2s",
                boxShadow: guess.trim() ? `0 0 18px ${EMERALD}55` : "none",
                whiteSpace: "nowrap",
              }}
            >
              Deviner
            </motion.button>
          </div>

          {/* Wrong guesses */}
          <AnimatePresence>
            {(state.wrong_guesses?.length ?? 0) > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
              >
                {state.wrong_guesses?.map((g, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      background: `${ROSE}16`,
                      border: `1px solid ${ROSE}44`,
                      color: ROSE,
                      borderRadius: 20,
                      padding: "4px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: "line-through",
                      opacity: 0.75,
                    }}
                  >
                    {g}
                  </motion.span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ─────────── Phase: Résultat de round ───────────
function ResultScreen({
  state, phase, isAuthority, onNext,
}: {
  state: DrawState;
  phase: "correct" | "timeout";
  isAuthority: boolean;
  onNext: () => void;
}) {
  const correct = phase === "correct";
  const [countdown, setCountdown] = useState(Math.ceil(POST_RESULT_AUTO_MS / 1000));
  const accentColor = correct ? EMERALD : ROSE;

  useEffect(() => {
    if (correct) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }
  }, [correct]);

  useEffect(() => {
    const i = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "0 16px", textAlign: "center" }}>
      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 1.3, 1], opacity: 1 }}
        transition={{ duration: 0.5, times: [0, 0.6, 1] }}
        style={{ fontSize: 72, lineHeight: 1 }}
      >
        {correct ? "🎉" : "⏱️"}
      </motion.div>

      <div style={{ ...glass, padding: "24px 28px", width: "100%", maxWidth: 320, borderRadius: 24, border: `1px solid ${accentColor}33` }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 34, fontStyle: "italic", color: accentColor, margin: "0 0 8px", textShadow: `0 0 20px ${accentColor}66` }}>
          {correct ? "Trouvé !" : "Temps écoulé"}
        </h2>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>Le mot était</p>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: 2, textTransform: "capitalize", marginBottom: 16, textShadow: `0 0 18px ${accentColor}55` }}>
          {state.word}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.40)" }}>
          Score · {state.scores?.[0] ?? 0} – {state.scores?.[1] ?? 0}
        </div>
      </div>

      {isAuthority ? (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onNext}
          style={{
            height: 52,
            paddingLeft: 28,
            paddingRight: 28,
            borderRadius: 16,
            border: "none",
            background: correct
              ? `linear-gradient(135deg, ${EMERALD}, ${SKY})`
              : `linear-gradient(135deg, ${ROSE}, ${AMBER})`,
            color: "#0d0d0d",
            fontWeight: 700,
            fontSize: 16,
            cursor: "pointer",
            boxShadow: `0 0 24px ${accentColor}44`,
          }}
        >
          Round suivant →
        </motion.button>
      ) : (
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
          Round suivant dans {countdown}s…
        </p>
      )}
    </div>
  );
}

// ─────────── Phase: Game over ───────────
function GameOverScreen({
  state, mySlot, myName, otherName, isAuthority, onReplay, onBackToMenu, onDareDone,
}: {
  state: DrawState;
  mySlot: number;
  myName: string;
  otherName: string;
  isAuthority: boolean;
  onReplay: () => void;
  onBackToMenu: () => void;
  onDareDone: () => void;
}) {
  const [s1, s2] = state.scores ?? [0, 0];
  const tie = s1 === s2;
  const winnerSlot: 1 | 2 | null = tie ? null : s1 > s2 ? 1 : 2;
  const iWon = winnerSlot === mySlot;
  const winnerName = winnerSlot === 1
    ? (mySlot === 1 ? myName : otherName)
    : (mySlot === 2 ? myName : otherName);
  const dare = state.gage ?? "";
  const dareDone = !!state.dare_done;
  const topColor = tie ? AMBER : iWon ? EMERALD : ROSE;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "0 14px", textAlign: "center" }}>
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: [0, 1.35, 1], rotate: [0, 5, 0] }}
        transition={{ duration: 0.6, times: [0, 0.65, 1] }}
        style={{ fontSize: 80, lineHeight: 1 }}
      >
        {tie ? "🤝" : iWon ? "🏆" : "🥹"}
      </motion.div>

      <div style={{ ...glass, padding: "22px 24px", width: "100%", maxWidth: 340, borderRadius: 24, border: `1px solid ${topColor}33` }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 30, fontStyle: "italic", color: topColor, margin: "0 0 4px", textShadow: `0 0 20px ${topColor}66` }}>
          {tie ? "Égalité 💕" : iWon ? "Tu es l'artiste 🎨" : `${winnerName} l'emporte 🎨`}
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "rgba(255,255,255,0.38)" }}>
          Score final ·{" "}
          <span style={{ color: "#fff", fontWeight: 700 }}>{s1}</span>
          {" – "}
          <span style={{ color: "#fff", fontWeight: 700 }}>{s2}</span>
        </p>
      </div>

      {!tie && !iWon && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ ...glass, padding: "20px 22px", width: "100%", maxWidth: 340, borderRadius: 22, border: `1.5px solid ${AMBER}44`, background: `${AMBER}0c` }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: AMBER }}>
            Ton gage 🎭
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#fff", lineHeight: 1.45 }}>
            {dare}
          </p>
          {!dareDone ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onDareDone}
              style={{
                width: "100%",
                height: 48,
                borderRadius: 14,
                border: "none",
                background: `linear-gradient(135deg, ${AMBER}, #fb923c)`,
                color: "#0d0d0d",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                boxShadow: `0 0 20px ${AMBER}44`,
              }}
            >
              C'est fait ✅
            </motion.button>
          ) : (
            <motion.p
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{ margin: 0, fontSize: 15, color: EMERALD, fontWeight: 600 }}
            >
              Bravo 💕
            </motion.p>
          )}
        </motion.div>
      )}

      {!tie && iWon && (
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.32)" }}>
          On attend que {otherName} fasse le gage 💕
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320 }}>
        {isAuthority && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onReplay}
            style={{
              height: 52,
              borderRadius: 16,
              border: "none",
              background: `linear-gradient(135deg, ${SKY}, #6366f1)`,
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              boxShadow: `0 0 20px ${SKY}44`,
            }}
          >
            Rejouer 🔁
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBackToMenu}
          style={{
            height: 52,
            borderRadius: 16,
            border: "1.5px solid rgba(255,255,255,0.13)",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.65)",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          ← Retour au menu
        </motion.button>
      </div>
    </div>
  );
}
