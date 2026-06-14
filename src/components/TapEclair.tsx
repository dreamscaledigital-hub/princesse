import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ─────────── Gages (modifiables) ───────────
const TAP_DARES: string[] = [
  "Un bisou de 10 secondes 💋",
  "Un compliment sincère, regard dans les yeux 🥰",
  "Un câlin de 30 secondes 🤗",
  "Imite l'autre pendant 1 minute 🎭",
  "Chante une chanson d'amour 🎤",
  "Raconte ton souvenir préféré à deux 💞",
  "Masse les épaules 1 minute 💆",
  "Danse 30 secondes sur la prochaine musique 💃",
  "Envoie-toi un selfie ridicule 🤪",
  "Cuisine ou prépare un truc à boire à l'autre 🍹",
  "Donne un surnom mignon tout neuf 🍓",
  "Lis un message d'amour à voix haute 💌",
];

// ─────────── Constantes timing ───────────
const COUNTDOWN_MS = 3000;
const WAIT_MIN_MS = 1500;
const WAIT_MAX_MS = 5000;
const TAP_TIMEOUT_MS = 4000;
const RESULT_MS = 2500;
const WINS_NEEDED = 3;
const AUTHORITY_SLOT = 1;

// ─────────── Types ───────────
type Phase = "countdown" | "waiting" | "lightning" | "result" | "game_over";
type TapEntry = { round_id: string; reaction_ms?: number; false_start?: boolean; timeout?: boolean };

type TapState = {
  game?: "tap";
  phase?: Phase;
  round?: number;
  round_id?: string;
  scores?: { "1": number; "2": number };
  dare?: string;
  countdown_start?: number;
  waiting_start?: number;
  waiting_delay_ms?: number;
  lightning_at?: number;
  tap_1?: TapEntry | null;
  tap_2?: TapEntry | null;
  round_winner_slot?: 0 | 1 | 2 | null;
  game_winner_slot?: 1 | 2 | null;
  round_message?: string;
  dare_done?: boolean;
};

type Props = {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
  onDareDone: () => void;
};

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

function pickDare() {
  return TAP_DARES[Math.floor(Math.random() * TAP_DARES.length)];
}

async function patchState(roomId: string, patch: Record<string, unknown>) {
  await supabase.rpc("minigame_patch", { _room_id: roomId, _patch: patch });
}

async function setState(roomId: string, state: Record<string, unknown>) {
  await supabase.from("rooms").update({ minigame_state: state }).eq("id", roomId);
}

export function TapEclair({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const state = (room.minigame_state ?? {}) as TapState;
  const isAuthority = mySlot === AUTHORITY_SLOT;

  const phase: Phase = state.phase ?? "countdown";
  const round = state.round ?? 1;
  const roundId = state.round_id ?? "";
  const scores = state.scores ?? { "1": 0, "2": 0 };
  const myScore = scores[String(mySlot) as "1" | "2"] ?? 0;
  const otherScore = scores[String(mySlot === 1 ? 2 : 1) as "1" | "2"] ?? 0;
  const dare = state.dare ?? "";

  const myTap = mySlot === 1 ? state.tap_1 : state.tap_2;
  const otherTap = mySlot === 1 ? state.tap_2 : state.tap_1;

  const appearTimeRef = useRef<number | null>(null);
  const hasTappedRef = useRef(false);
  const lastRoundIdRef = useRef<string>("");

  // Reset refs on new round
  useEffect(() => {
    if (roundId !== lastRoundIdRef.current) {
      lastRoundIdRef.current = roundId;
      hasTappedRef.current = false;
      appearTimeRef.current = null;
    }
  }, [roundId]);

  // Capture appear time when lightning phase starts
  useEffect(() => {
    if (phase === "lightning" && appearTimeRef.current === null) {
      appearTimeRef.current = performance.now();
    }
  }, [phase, roundId]);

  // ─────────── INIT ───────────
  useEffect(() => {
    if (!isAuthority) return;
    if (state.game === "tap") return;
    // Initialise nouveau game
    const fresh: TapState = {
      game: "tap",
      phase: "countdown",
      round: 1,
      round_id: rid(),
      scores: { "1": 0, "2": 0 },
      dare: pickDare(),
      countdown_start: Date.now(),
      tap_1: null,
      tap_2: null,
      round_winner_slot: null,
      game_winner_slot: null,
      dare_done: false,
    };
    void setState(room.id, fresh as Record<string, unknown>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthority, state.game, room.id]);

  // ─────────── AUTHORITY: countdown -> waiting ───────────
  useEffect(() => {
    if (!isAuthority) return;
    if (phase !== "countdown") return;
    if (!state.countdown_start) return;
    const elapsed = Date.now() - state.countdown_start;
    const remaining = Math.max(0, COUNTDOWN_MS - elapsed);
    const t = setTimeout(() => {
      const delay = WAIT_MIN_MS + Math.random() * (WAIT_MAX_MS - WAIT_MIN_MS);
      void patchState(room.id, {
        phase: "waiting",
        waiting_start: Date.now(),
        waiting_delay_ms: Math.round(delay),
        tap_1: null,
        tap_2: null,
      });
    }, remaining);
    return () => clearTimeout(t);
  }, [isAuthority, phase, state.countdown_start, room.id, roundId]);

  // ─────────── AUTHORITY: waiting -> lightning ───────────
  useEffect(() => {
    if (!isAuthority) return;
    if (phase !== "waiting") return;
    if (!state.waiting_start || !state.waiting_delay_ms) return;
    const elapsed = Date.now() - state.waiting_start;
    const remaining = Math.max(0, state.waiting_delay_ms - elapsed);
    const t = setTimeout(() => {
      // Vérifier qu'aucun faux départ n'est arrivé entre temps
      void patchState(room.id, {
        phase: "lightning",
        lightning_at: Date.now(),
      });
    }, remaining);
    return () => clearTimeout(t);
  }, [isAuthority, phase, state.waiting_start, state.waiting_delay_ms, room.id, roundId]);

  // ─────────── AUTHORITY: faux départ pendant waiting ───────────
  useEffect(() => {
    if (!isAuthority) return;
    if (phase !== "waiting") return;
    const t1 = state.tap_1?.round_id === roundId ? state.tap_1 : null;
    const t2 = state.tap_2?.round_id === roundId ? state.tap_2 : null;
    if (!t1 && !t2) return;
    // Au moins un faux départ détecté
    void resolveRound(t1, t2, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthority, phase, state.tap_1, state.tap_2, roundId]);

  // ─────────── AUTHORITY: lightning -> result ───────────
  useEffect(() => {
    if (!isAuthority) return;
    if (phase !== "lightning") return;
    if (!state.lightning_at) return;
    const elapsed = Date.now() - state.lightning_at;
    const remaining = Math.max(0, TAP_TIMEOUT_MS - elapsed);
    const t = setTimeout(() => {
      const t1 = state.tap_1?.round_id === roundId ? state.tap_1 : null;
      const t2 = state.tap_2?.round_id === roundId ? state.tap_2 : null;
      void resolveRound(t1, t2, false);
    }, remaining);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthority, phase, state.lightning_at, roundId]);

  // ─────────── AUTHORITY: les deux taps reçus pendant lightning ───────────
  useEffect(() => {
    if (!isAuthority) return;
    if (phase !== "lightning") return;
    const t1 = state.tap_1?.round_id === roundId ? state.tap_1 : null;
    const t2 = state.tap_2?.round_id === roundId ? state.tap_2 : null;
    if (t1 && t2) {
      void resolveRound(t1, t2, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthority, phase, state.tap_1, state.tap_2, roundId]);

  // ─────────── AUTHORITY: result -> next round ───────────
  useEffect(() => {
    if (!isAuthority) return;
    if (phase !== "result") return;
    const t = setTimeout(() => {
      const s1 = scores["1"] ?? 0;
      const s2 = scores["2"] ?? 0;
      if (s1 >= WINS_NEEDED || s2 >= WINS_NEEDED) {
        void patchState(room.id, {
          phase: "game_over",
          game_winner_slot: s1 > s2 ? 1 : 2,
        });
      } else {
        void patchState(room.id, {
          phase: "countdown",
          round: round + 1,
          round_id: rid(),
          countdown_start: Date.now(),
          tap_1: null,
          tap_2: null,
          round_winner_slot: null,
          round_message: null,
          lightning_at: null,
        });
      }
    }, RESULT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthority, phase, room.id, round, scores]);

  // ─────────── Résolution d'un round ───────────
  async function resolveRound(t1: TapEntry | null, t2: TapEntry | null, fromWaiting: boolean) {
    const fs1 = !!t1?.false_start;
    const fs2 = !!t2?.false_start;
    let winner: 0 | 1 | 2 = 0;
    let message = "";

    if (fromWaiting) {
      if (fs1 && fs2) {
        winner = 0;
        message = "Double faux départ ! On rejoue 😅";
      } else if (fs1) {
        winner = 2;
        message = `${mySlot === 2 ? myName : otherName} gagne (faux départ adverse) 😅`;
      } else if (fs2) {
        winner = 1;
        message = `${mySlot === 1 ? myName : otherName} gagne (faux départ adverse) 😅`;
      }
    } else {
      // lightning resolved
      const r1 = t1 && typeof t1.reaction_ms === "number" ? t1.reaction_ms : null;
      const r2 = t2 && typeof t2.reaction_ms === "number" ? t2.reaction_ms : null;
      if (r1 === null && r2 === null) {
        winner = 0;
        message = "Personne n'a tapé… on rejoue 😴";
      } else if (r1 === null) {
        winner = 2;
        message = "Trop lent⋯ point pour l'autre ⚡";
      } else if (r2 === null) {
        winner = 1;
        message = "Trop lent⋯ point pour l'autre ⚡";
      } else if (r1 === r2) {
        winner = 0;
        message = "Égalité parfaite ! On rejoue 🤝";
      } else if (r1 < r2) {
        winner = 1;
        message = `${r1} ms vs ${r2} ms — ${mySlot === 1 ? myName : otherName} ⚡`;
      } else {
        winner = 2;
        message = `${r2} ms vs ${r1} ms — ${mySlot === 2 ? myName : otherName} ⚡`;
      }
    }

    const newScores = { ...scores };
    if (winner === 1) newScores["1"] = (newScores["1"] ?? 0) + 1;
    if (winner === 2) newScores["2"] = (newScores["2"] ?? 0) + 1;

    await patchState(room.id, {
      phase: "result",
      round_winner_slot: winner,
      round_message: message,
      scores: newScores,
    });
  }

  // ─────────── Player tap ───────────
  const handleTap = async () => {
    if (hasTappedRef.current) return;
    if (phase !== "waiting" && phase !== "lightning") return;
    if (!roundId) return;
    hasTappedRef.current = true;
    const key = mySlot === 1 ? "tap_1" : "tap_2";
    if (phase === "waiting") {
      await patchState(room.id, { [key]: { round_id: roundId, false_start: true } });
    } else {
      const reaction = appearTimeRef.current === null
        ? TAP_TIMEOUT_MS
        : Math.max(0, Math.round(performance.now() - appearTimeRef.current));
      await patchState(room.id, { [key]: { round_id: roundId, reaction_ms: reaction } });
    }
  };

  // ─────────── Confetti victoire finale ───────────
  const fired = useRef(false);
  useEffect(() => {
    if (phase === "game_over" && !fired.current && state.game_winner_slot === mySlot) {
      fired.current = true;
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    }
    if (phase !== "game_over") fired.current = false;
  }, [phase, state.game_winner_slot, mySlot]);

  // ─────────── Rejouer / Reset ───────────
  const replay = async () => {
    if (!isAuthority) return;
    const fresh: TapState = {
      game: "tap",
      phase: "countdown",
      round: 1,
      round_id: rid(),
      scores: { "1": 0, "2": 0 },
      dare: pickDare(),
      countdown_start: Date.now(),
      tap_1: null,
      tap_2: null,
      round_winner_slot: null,
      game_winner_slot: null,
      dare_done: false,
    };
    await setState(room.id, fresh as Record<string, unknown>);
  };

  // ─────────── UI ───────────
  return (
    <div
      className="relative flex min-h-[80vh] flex-col"
      style={{ touchAction: "manipulation" }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between px-1">
        <button onClick={onBackToMenu} className="text-xs text-muted-foreground hover:text-foreground">
          ← Menu
        </button>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Tap Éclair ⚡ · Manche {Math.min(round, WINS_NEEDED * 2 - 1)}
        </div>
        <div className="text-xs font-semibold">
          {myScore} <span className="text-muted-foreground">–</span> {otherScore}
        </div>
      </div>

      {/* Gage rappel */}
      {dare && phase !== "game_over" && (
        <div className="mb-3 rounded-2xl bg-card/70 px-4 py-2 text-center text-xs text-muted-foreground">
          Gage du perdant : <span className="font-medium text-foreground">{dare}</span>
        </div>
      )}

      <TapBoard
        phase={phase}
        round={round}
        myName={myName}
        otherName={otherName}
        myScore={myScore}
        otherScore={otherScore}
        message={state.round_message ?? ""}
        winnerSlot={state.round_winner_slot ?? null}
        gameWinnerSlot={state.game_winner_slot ?? null}
        mySlot={mySlot}
        dare={dare}
        countdownStart={state.countdown_start ?? null}
        isAuthority={isAuthority}
        myTapDone={!!myTap && myTap.round_id === roundId}
        otherTapDone={!!otherTap && otherTap.round_id === roundId}
        onTap={handleTap}
        onReplay={replay}
        onBackToMenu={onBackToMenu}
        onDareDone={async () => {
          await patchState(room.id, { dare_done: true });
          onDareDone();
        }}
        dareDone={!!state.dare_done}
      />
    </div>
  );
}

function TapBoard(props: {
  phase: Phase;
  round: number;
  myName: string;
  otherName: string;
  myScore: number;
  otherScore: number;
  message: string;
  winnerSlot: 0 | 1 | 2 | null;
  gameWinnerSlot: 1 | 2 | null;
  mySlot: number;
  dare: string;
  countdownStart: number | null;
  isAuthority: boolean;
  myTapDone: boolean;
  otherTapDone: boolean;
  onTap: () => void;
  onReplay: () => void;
  onBackToMenu: () => void;
  onDareDone: () => void;
  dareDone: boolean;
}) {
  const {
    phase, message, winnerSlot, gameWinnerSlot, mySlot, dare,
    countdownStart, isAuthority, myTapDone, onTap, onReplay,
    onBackToMenu, onDareDone, dareDone, myName, otherName,
  } = props;

  // Game over screen
  if (phase === "game_over") {
    const iWon = gameWinnerSlot === mySlot;
    const winnerName = iWon ? myName : otherName;
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center px-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.3, 1] }}
          className="text-7xl"
        >
          {iWon ? "🏆" : "🥹"}
        </motion.div>
        <h2 className="mt-4 font-script text-4xl text-primary">
          {iWon ? "Tu es l'éclair ⚡" : `${winnerName} l'emporte ⚡`}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Score final : {props.myScore} – {props.otherScore}
        </p>
        {!iWon && (
          <div className="mt-6 w-full max-w-sm rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Ton gage</p>
            <p className="mt-1 text-base font-medium">{dare}</p>
            {!dareDone && (
              <Button onClick={onDareDone} className="mt-3 w-full h-12 rounded-xl">
                C'est fait ✅
              </Button>
            )}
            {dareDone && (
              <p className="mt-3 text-sm text-primary">Bravo 💕</p>
            )}
          </div>
        )}
        {iWon && (
          <p className="mt-4 text-sm text-muted-foreground">
            On attend que {otherName} fasse le gage 💕
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
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

  // Result short screen (overlays the tap zone)
  if (phase === "result") {
    const iWon = winnerSlot === mySlot;
    const tie = winnerSlot === 0;
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center px-4">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-6xl"
        >
          {tie ? "🤝" : iWon ? "⚡" : "😅"}
        </motion.div>
        <p className="mt-4 font-script text-3xl text-primary">
          {tie ? "Égalité — on rejoue" : iWon ? "Gagné ce round ⚡" : "Perdu ce round"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">{message}</p>
      </div>
    );
  }

  // Countdown
  if (phase === "countdown") {
    return (
      <CountdownView start={countdownStart ?? Date.now()} />
    );
  }

  // waiting / lightning — full-screen tap zone
  const isLightning = phase === "lightning";
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onTap();
      }}
      disabled={myTapDone}
      className={`relative mt-2 flex flex-1 select-none flex-col items-center justify-center rounded-3xl border-2 transition-colors ${
        isLightning
          ? "border-yellow-300 bg-gradient-to-br from-yellow-200 via-amber-300 to-yellow-400 text-amber-950 shadow-[0_0_60px_rgba(252,211,77,0.6)]"
          : "border-rose-200 bg-gradient-to-br from-rose-100 to-pink-200 text-rose-700"
      } disabled:opacity-70`}
      style={{ minHeight: 360, touchAction: "manipulation", WebkitTapHighlightColor: "transparent" }}
    >
      <AnimatePresence mode="wait">
        {isLightning ? (
          <motion.div
            key="lightning"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.4, 1.2, 1], opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col items-center"
          >
            <span className="text-9xl drop-shadow-[0_0_30px_rgba(255,200,0,0.9)]">⚡</span>
            <span className="mt-2 text-2xl font-bold uppercase tracking-widest">Tape !</span>
          </motion.div>
        ) : (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center"
          >
            <span className="text-5xl opacity-60">⋯</span>
            <span className="mt-3 text-base text-rose-600/80">Attends l'éclair…</span>
            <span className="mt-1 text-xs text-rose-500/60">(ne tape pas trop tôt !)</span>
          </motion.div>
        )}
      </AnimatePresence>
      {myTapDone && (
        <div className="absolute inset-x-0 bottom-4 text-center text-xs text-foreground/70">
          {phase === "lightning" ? "Tapé ⚡ — on attend le résultat" : "Faux départ enregistré 😅"}
        </div>
      )}
      <div className="absolute top-3 left-0 right-0 flex justify-between px-4 text-[10px] uppercase tracking-wider opacity-60">
        <span>{myName}</span>
        <span>vs</span>
        <span>{otherName}</span>
      </div>
    </button>
  );
}

function CountdownView({ start }: { start: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const elapsed = now - start;
  const n = Math.max(1, 3 - Math.floor(elapsed / 1000));
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Prêt·e ?</p>
      <motion.div
        key={n}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mt-4 font-script text-9xl text-primary"
      >
        {n}
      </motion.div>
      <p className="mt-4 text-sm text-muted-foreground">L'éclair tombe juste après…</p>
    </div>
  );
}
