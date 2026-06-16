import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

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

const COLORS = ["#1a1a1a", "#e74c3c", "#e88aab", "#3498db", "#2ecc71", "#f39c12"];
const SIZES = [3, 8];
const ERASER = { color: "#ffffff", width: 20 };

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
    .replace(/[\u0300-\u036f]/g, "");
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
    const word = state.word;
    const tick = () => {
      const cur = (room.minigame_state ?? {}) as DrawState;
      if (cur.phase !== "drawing" || !cur.word_hint || !cur.word) return;
      // Trouver les lettres encore cachées
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

  // ─────────── UI ───────────
  return (
    <div className="flex min-h-[80vh] flex-col" style={{ touchAction: "manipulation" }}>
      <div className="mb-3 flex items-center justify-between px-1">
        <button onClick={onBackToMenu} className="text-xs text-muted-foreground hover:text-foreground">
          ← Menu
        </button>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Dessine & Devine 🎨 · Round {Math.min(round, TOTAL_ROUNDS)}/{TOTAL_ROUNDS}
        </div>
        <div className="text-xs font-semibold">
          {myScore} <span className="text-muted-foreground">–</span> {otherScore}
        </div>
      </div>

      {phase === "word_pick" && (
        <WordPickScreen
          state={state}
          isDrawer={isDrawer}
          isAuthority={isAuthority}
          roomId={room.id}
          drawerName={isDrawer ? myName : otherName}
        />
      )}

      {phase === "drawing" && (
        <DrawingScreen
          room={room}
          state={state}
          isDrawer={isDrawer}
          mySlot={mySlot}
          myName={myName}
          otherName={otherName}
        />
      )}

      {(phase === "correct" || phase === "timeout") && (
        <ResultScreen
          state={state}
          phase={phase}
          isAuthority={isAuthority}
          onNext={goNextRound}
        />
      )}

      {phase === "game_over" && (
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
      )}
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
      // Si le devineur est non-authority mais c'est lui le dessinateur, on demande à l'authority via patch
      // Simplification : seul l'authority écrit, donc on signale via une autre clé
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

  // L'authority surveille word_choice_pending (cas où drawer = slot 2)
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

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center px-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {Math.ceil(remaining / 1000)}s
      </p>
      {isDrawer ? (
        <>
          <h2 className="mt-2 font-serif text-3xl text-primary italic">Choisis ton mot</h2>
          <p className="mt-1 text-sm text-muted-foreground">À toi de le faire deviner ✨</p>
          <div className="mt-6 flex flex-col gap-3 w-full max-w-xs">
            {(state.word_choices ?? []).map((w) => (
              <motion.button
                key={w}
                whileTap={{ scale: 0.95 }}
                onClick={() => pickWord(w)}
                className="rounded-2xl border-2 border-primary/30 bg-card/80 px-4 py-4 text-lg font-medium shadow-sm hover:bg-primary/10 transition"
              >
                {w}
              </motion.button>
            ))}
          </div>
        </>
      ) : (
        <>
          <motion.div
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-6xl"
          >
            🎨
          </motion.div>
          <h2 className="mt-4 font-serif text-3xl text-primary italic">{drawerName} choisit…</h2>
          <p className="mt-2 text-sm text-muted-foreground">Prépare-toi à deviner 💭</p>
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
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(SIZES[0]);
  const [isErasing, setIsErasing] = useState(false);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<StrokePoint | null>(null);
  const batchRef = useRef<StrokePoint[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newPathRef = useRef(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [guess, setGuess] = useState("");
  const [remaining, setRemaining] = useState(DRAW_DURATION_MS);

  // Timer affichage
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
      width: isErasing ? ERASER.width : width,
      newPath: newPathRef.current,
    };
    drawStrokeOnCanvas(payload);
    channelRef.current?.send({ type: "broadcast", event: "stroke", payload });
    batchRef.current = [];
    newPathRef.current = false;
  };

  const getPoint = (e: PointerEvent | React.PointerEvent): StrokePoint => {
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

  // Devineur : soumettre une tentative
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
  const timerColor = secs <= 10 ? "text-red-500" : secs <= 30 ? "text-orange-500" : "text-primary";

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Timer + mot */}
      <div className="flex items-center justify-between rounded-2xl bg-card/80 px-4 py-2 backdrop-blur">
        <span className={`font-mono text-lg font-bold ${timerColor}`}>{secs}s</span>
        {isDrawer ? (
          <span className="text-sm">
            <span className="text-muted-foreground">Dessine : </span>
            <span className="font-bold text-primary">{state.word}</span>
          </span>
        ) : (
          <span className="font-mono text-lg font-bold tracking-widest">
            {state.word_hint ?? state.word_display ?? ""}
          </span>
        )}
      </div>

      {/* Canvas */}
      <div
        className="relative w-full overflow-hidden rounded-2xl border-2 border-primary/20 bg-white shadow-inner"
        style={{ aspectRatio: "1 / 1", touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ touchAction: "none", cursor: isDrawer ? "crosshair" : "default" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      {isDrawer ? (
        <>
          {/* Palette */}
          <div className="flex items-center justify-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setColor(c); setIsErasing(false); }}
                className={`h-8 w-8 rounded-full border-2 transition ${
                  !isErasing && color === c ? "border-primary scale-110" : "border-white/50"
                }`}
                style={{ background: c }}
              />
            ))}
            <button
              onClick={() => setIsErasing((v) => !v)}
              className={`h-8 rounded-full border-2 px-3 text-xs font-medium transition ${
                isErasing ? "border-primary bg-primary/10" : "border-border bg-white"
              }`}
            >
              🧽
            </button>
          </div>
          <div className="flex items-center justify-center gap-2">
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => { setWidth(s); setIsErasing(false); }}
                className={`flex h-8 w-12 items-center justify-center rounded-xl border-2 transition ${
                  !isErasing && width === s ? "border-primary bg-primary/10" : "border-border bg-white"
                }`}
              >
                <span className="rounded-full bg-foreground" style={{ width: s, height: s }} />
              </button>
            ))}
            <Button size="sm" variant="outline" onClick={handleClear} className="h-8">
              Effacer
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {otherName} essaie de deviner 💭
          </p>
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <Input
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitGuess(); }}
              placeholder="Ta proposition…"
              className="flex-1"
              autoFocus
            />
            <Button onClick={submitGuess} disabled={!guess.trim()}>
              Deviner
            </Button>
          </div>
          {(state.wrong_guesses?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {state.wrong_guesses?.map((g, i) => (
                <span
                  key={i}
                  className="rounded-full bg-card/60 px-2 py-0.5 text-xs text-muted-foreground line-through"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </>
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
  useEffect(() => {
    if (correct) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }
  }, [correct]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center px-4">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-6xl"
      >
        {correct ? "🎉" : "⏱️"}
      </motion.div>
      <h2 className="mt-4 font-serif text-3xl text-primary italic">
        {correct ? "Trouvé !" : "Temps écoulé"}
      </h2>
      <p className="mt-2 text-base">
        Le mot était <span className="font-bold text-primary">{state.word}</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Score : {state.scores?.[0] ?? 0} – {state.scores?.[1] ?? 0}
      </p>
      {isAuthority && (
        <Button onClick={onNext} className="mt-6 h-12 rounded-xl px-6">
          Round suivant →
        </Button>
      )}
      {!isAuthority && (
        <p className="mt-6 text-sm text-muted-foreground">Round suivant dans un instant…</p>
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
  const winnerName = winnerSlot === 1 ? (mySlot === 1 ? myName : otherName) : (mySlot === 2 ? myName : otherName);
  const dare = state.gage ?? "";
  const dareDone = !!state.dare_done;

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center px-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.3, 1] }}
        className="text-7xl"
      >
        {tie ? "🤝" : iWon ? "🏆" : "🥹"}
      </motion.div>
      <h2 className="mt-4 font-serif text-4xl text-primary italic">
        {tie ? "Égalité 💕" : iWon ? "Tu es l'artiste 🎨" : `${winnerName} l'emporte 🎨`}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Score final : {s1} – {s2}
      </p>
      {!tie && !iWon && (
        <div className="mt-6 w-full max-w-sm rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Ton gage</p>
          <p className="mt-1 text-base font-medium">{dare}</p>
          {!dareDone ? (
            <Button onClick={onDareDone} className="mt-3 w-full h-12 rounded-xl">
              C'est fait ✅
            </Button>
          ) : (
            <p className="mt-3 text-sm text-primary">Bravo 💕</p>
          )}
        </div>
      )}
      {!tie && iWon && (
        <p className="mt-4 text-sm text-muted-foreground">
          On attend que {otherName} fasse le gage 💕
        </p>
      )}
      <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
        {isAuthority && (
          <Button onClick={onReplay} className="h-12 rounded-xl">Rejouer 🔁</Button>
        )}
        <Button variant="outline" onClick={onBackToMenu} className="h-12 rounded-xl">
          ← Retour au menu
        </Button>
      </div>
    </div>
  );
}
