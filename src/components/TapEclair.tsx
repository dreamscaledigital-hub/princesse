import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ─────────── Design tokens ───────────
const BG     = "linear-gradient(160deg, oklch(0.10 0.07 260) 0%, oklch(0.07 0.04 250) 100%)";
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

// ─────────── Gages ───────────
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
const COUNTDOWN_MS    = 3000;
const WAIT_MIN_MS     = 1500;
const WAIT_MAX_MS     = 5000;
const TAP_TIMEOUT_MS  = 4000;
const RESULT_MS       = 3000;
const WINS_NEEDED     = 3;
const AUTHORITY_SLOT  = 1;

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

// ─────────── Composant principal ───────────
export function TapEclair({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const state = (room.minigame_state ?? {}) as TapState;
  const isAuthority = mySlot === AUTHORITY_SLOT;

  const phase: Phase = state.phase ?? "countdown";
  const round  = state.round ?? 1;
  const roundId = state.round_id ?? "";
  const scores  = state.scores ?? { "1": 0, "2": 0 };
  const myScore    = scores[String(mySlot) as "1" | "2"] ?? 0;
  const otherScore = scores[String(mySlot === 1 ? 2 : 1) as "1" | "2"] ?? 0;
  const dare = state.dare ?? "";

  const myTap    = mySlot === 1 ? state.tap_1 : state.tap_2;
  const otherTap = mySlot === 1 ? state.tap_2 : state.tap_1;

  const appearTimeRef   = useRef<number | null>(null);
  const hasTappedRef    = useRef(false);
  const lastRoundIdRef  = useRef<string>("");

  // Reset refs on new round
  useEffect(() => {
    if (roundId !== lastRoundIdRef.current) {
      lastRoundIdRef.current = roundId;
      hasTappedRef.current   = false;
      appearTimeRef.current  = null;
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
    const elapsed   = Date.now() - state.countdown_start;
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
    const elapsed   = Date.now() - state.waiting_start;
    const remaining = Math.max(0, state.waiting_delay_ms - elapsed);
    const t = setTimeout(() => {
      void patchState(room.id, { phase: "lightning", lightning_at: Date.now() });
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
    void resolveRound(t1, t2, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthority, phase, state.tap_1, state.tap_2, roundId]);

  // ─────────── AUTHORITY: lightning -> result (timeout) ───────────
  useEffect(() => {
    if (!isAuthority) return;
    if (phase !== "lightning") return;
    if (!state.lightning_at) return;
    const elapsed   = Date.now() - state.lightning_at;
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
    if (t1 && t2) void resolveRound(t1, t2, false);
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
        void patchState(room.id, { phase: "game_over", game_winner_slot: s1 > s2 ? 1 : 2 });
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
        winner  = 0;
        message = "Double faux départ ! On rejoue 😅";
      } else if (fs1) {
        winner  = 2;
        message = `${mySlot === 2 ? myName : otherName} gagne (faux départ adverse) 😅`;
      } else if (fs2) {
        winner  = 1;
        message = `${mySlot === 1 ? myName : otherName} gagne (faux départ adverse) 😅`;
      }
    } else {
      const r1 = t1 && typeof t1.reaction_ms === "number" ? t1.reaction_ms : null;
      const r2 = t2 && typeof t2.reaction_ms === "number" ? t2.reaction_ms : null;
      if (r1 === null && r2 === null) {
        winner  = 0;
        message = "Personne n'a tapé… on rejoue 😴";
      } else if (r1 === null) {
        winner  = 2;
        message = "Trop lent⋯ point pour l'autre ⚡";
      } else if (r2 === null) {
        winner  = 1;
        message = "Trop lent⋯ point pour l'autre ⚡";
      } else if (r1 === r2) {
        winner  = 0;
        message = "Égalité parfaite ! On rejoue 🤝";
      } else if (r1 < r2) {
        winner  = 1;
        message = `${r1} ms vs ${r2} ms — ${mySlot === 1 ? myName : otherName} ⚡`;
      } else {
        winner  = 2;
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
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.5 } });
    }
    if (phase !== "game_over") fired.current = false;
  }, [phase, state.game_winner_slot, mySlot]);

  // ─────────── Rejouer ───────────
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
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "rgba(255,255,255,0.35)" }}>
            Tap Éclair
          </div>
        </div>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.30)", letterSpacing: 1 }}>
          Manche {Math.min(round, WINS_NEEDED * 2 - 1)}
        </span>
      </div>

      {/* Score dots */}
      {phase !== "game_over" && (
        <div style={{ ...glass, padding: "12px 20px", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>Toi</span>
            <WinDots score={myScore} needed={WINS_NEEDED} color={EMERALD} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{myScore}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: 1 }}>vs</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{otherScore}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{otherName}</span>
            <WinDots score={otherScore} needed={WINS_NEEDED} color={ROSE} reverse />
          </div>
        </div>
      )}

      {/* Gage reminder */}
      {dare && phase !== "game_over" && (
        <div style={{
          ...glass,
          padding: "8px 16px",
          borderRadius: 14,
          textAlign: "center",
          fontSize: 11,
          color: "rgba(255,255,255,0.35)",
          borderColor: `${AMBER}22`,
        }}>
          Gage du perdant ·{" "}
          <span style={{ color: AMBER, fontWeight: 600 }}>{dare}</span>
        </div>
      )}

      {/* Main board */}
      <TapBoard
        phase={phase}
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

// ─────────── WinDots ───────────
function WinDots({ score, needed, color, reverse = false }: { score: number; needed: number; color: string; reverse?: boolean }) {
  const dots = Array.from({ length: needed }, (_, i) => i < score);
  const ordered = reverse ? [...dots].reverse() : dots;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {ordered.map((filled, i) => (
        <motion.div
          key={i}
          animate={filled ? { scale: [1.4, 1], boxShadow: [`0 0 14px ${color}`, `0 0 6px ${color}88`] } : {}}
          transition={{ duration: 0.4 }}
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: filled ? color : "transparent",
            border: `2px solid ${filled ? color : "rgba(255,255,255,0.18)"}`,
            boxShadow: filled ? `0 0 6px ${color}88` : "none",
            transition: "background 0.3s, border-color 0.3s",
          }}
        />
      ))}
    </div>
  );
}

// ─────────── TapBoard ───────────
function TapBoard(props: {
  phase: Phase;
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

  // ─────────── Game over ───────────
  if (phase === "game_over") {
    const iWon        = gameWinnerSlot === mySlot;
    const winnerName  = iWon ? myName : otherName;
    const topColor    = iWon ? EMERALD : ROSE;
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "0 14px", textAlign: "center" }}>
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: [0, 1.4, 1], rotate: [0, 8, 0] }}
          transition={{ duration: 0.6, times: [0, 0.65, 1] }}
          style={{ fontSize: 80, lineHeight: 1 }}
        >
          {iWon ? "🏆" : "🥹"}
        </motion.div>

        <div style={{ ...glass, padding: "22px 28px", width: "100%", maxWidth: 340, borderRadius: 24, border: `1px solid ${topColor}33` }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 32, fontStyle: "italic", color: topColor, margin: "0 0 4px", textShadow: `0 0 20px ${topColor}66` }}>
            {iWon ? "Tu es l'éclair ⚡" : `${winnerName} l'emporte ⚡`}
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "rgba(255,255,255,0.38)" }}>
            Score final · <span style={{ color: "#fff", fontWeight: 700 }}>{props.myScore}</span>
            {" – "}
            <span style={{ color: "#fff", fontWeight: 700 }}>{props.otherScore}</span>
          </p>
        </div>

        {!iWon && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{ ...glass, padding: "20px 22px", width: "100%", maxWidth: 340, borderRadius: 22, border: `1.5px solid ${AMBER}44`, background: `${AMBER}0c` }}
          >
            <p style={{ margin: "0 0 6px", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: AMBER }}>Ton gage 🎭</p>
            <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#fff", lineHeight: 1.45 }}>{dare}</p>
            {!dareDone ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onDareDone}
                style={{ width: "100%", height: 48, borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${AMBER}, #fb923c)`, color: "#0d0d0d", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: `0 0 20px ${AMBER}44` }}
              >
                C'est fait ✅
              </motion.button>
            ) : (
              <motion.p initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ margin: 0, fontSize: 15, color: EMERALD, fontWeight: 600 }}>
                Bravo 💕
              </motion.p>
            )}
          </motion.div>
        )}

        {iWon && (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.32)" }}>
            On attend que {otherName} fasse le gage 💕
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320 }}>
          {isAuthority && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onReplay}
              style={{ height: 52, borderRadius: 16, border: "none", background: `linear-gradient(135deg, ${SKY}, #6366f1)`, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: `0 0 20px ${SKY}44` }}
            >
              Rejouer 🔁
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onBackToMenu}
            style={{ height: 52, borderRadius: 16, border: "1.5px solid rgba(255,255,255,0.13)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            ← Retour au menu
          </motion.button>
        </div>
      </div>
    );
  }

  // ─────────── Result screen ───────────
  if (phase === "result") {
    const iWon = winnerSlot === mySlot;
    const tie  = winnerSlot === 0;
    const accentColor = tie ? AMBER : iWon ? EMERALD : ROSE;
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "0 16px", textAlign: "center" }}>
        <motion.div
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: [0.3, 1.4, 1], opacity: 1 }}
          transition={{ duration: 0.4, times: [0, 0.6, 1] }}
          style={{ fontSize: 72, lineHeight: 1 }}
        >
          {tie ? "🤝" : iWon ? "⚡" : "😅"}
        </motion.div>
        <div style={{ ...glass, padding: "22px 28px", width: "100%", maxWidth: 320, borderRadius: 24, border: `1px solid ${accentColor}33` }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 30, fontStyle: "italic", color: accentColor, margin: "0 0 10px", textShadow: `0 0 18px ${accentColor}66` }}>
            {tie ? "Égalité — on rejoue" : iWon ? "Gagné ce round ⚡" : "Perdu ce round"}
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.5, fontWeight: 500 }}>
            {message}
          </p>
        </div>
      </div>
    );
  }

  // ─────────── Countdown ───────────
  if (phase === "countdown") {
    return <CountdownView start={countdownStart ?? Date.now()} />;
  }

  // ─────────── Waiting / Lightning — tap zone ───────────
  const isLightning = phase === "lightning";
  return (
    <TapZone
      isLightning={isLightning}
      myTapDone={myTapDone}
      otherTapDone={props.otherTapDone}
      myName={myName}
      otherName={otherName}
      onTap={onTap}
    />
  );
}

// ─────────── TapZone ───────────
function TapZone({
  isLightning, myTapDone, otherTapDone, myName, otherName, onTap,
}: {
  isLightning: boolean;
  myTapDone: boolean;
  otherTapDone: boolean;
  myName: string;
  otherName: string;
  onTap: () => void;
}) {
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (myTapDone) return;
    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
    setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, id: Date.now() });
    onTap();
  };

  return (
    <motion.button
      type="button"
      onPointerDown={handlePointerDown}
      disabled={myTapDone}
      animate={
        isLightning
          ? { x: [0, -5, 5, -3, 3, -1, 0] }
          : { scale: [1, 1.006, 1] }
      }
      transition={
        isLightning
          ? { duration: 0.25, ease: "easeOut" }
          : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
      }
      style={{
        position: "relative",
        flex: 1,
        minHeight: 340,
        borderRadius: 28,
        overflow: "hidden",
        border: `2.5px solid ${isLightning ? AMBER : ROSE}`,
        boxShadow: isLightning
          ? `0 0 60px ${AMBER}88, 0 0 120px ${AMBER}44, inset 0 0 80px #fef08a44`
          : `0 0 30px ${ROSE}22, inset 0 0 60px rgba(0,0,0,0.3)`,
        background: isLightning
          ? `radial-gradient(ellipse at 50% 40%, #fef08a 0%, #fbbf24 35%, #f59e0b 70%, #b45309 100%)`
          : `radial-gradient(ellipse at 50% 50%, oklch(0.14 0.07 10) 0%, oklch(0.10 0.06 260) 100%)`,
        cursor: myTapDone ? "default" : "pointer",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
        transition: "background 0.07s, border-color 0.07s, box-shadow 0.07s",
      }}
    >
      {/* Background ghosted bolt during waiting */}
      {!isLightning && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 200,
          opacity: 0.04,
          pointerEvents: "none",
          userSelect: "none",
        }}>
          ⚡
        </div>
      )}

      {/* Ripple */}
      <AnimatePresence>
        {ripple && (
          <motion.div
            key={ripple.id}
            initial={{ width: 0, height: 0, opacity: 0.6 }}
            animate={{ width: 600, height: 600, opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            onAnimationComplete={() => setRipple(null)}
            style={{
              position: "absolute",
              left: ripple.x,
              top: ripple.y,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              background: isLightning ? "rgba(255,255,255,0.5)" : `${ROSE}44`,
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      {/* Content */}
      <AnimatePresence mode="wait">
        {isLightning ? (
          <motion.div
            key="lightning"
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 1.3, 1], opacity: 1 }}
            transition={{ duration: 0.15, times: [0, 0.55, 1] }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
          >
            <span style={{
              fontSize: 110,
              lineHeight: 1,
              filter: "drop-shadow(0 0 30px rgba(255,220,0,0.9)) drop-shadow(0 0 60px rgba(255,180,0,0.6))",
              userSelect: "none",
            }}>
              ⚡
            </span>
            <span style={{
              fontSize: 28,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: 6,
              color: "#4a2500",
              textShadow: "0 1px 0 rgba(255,255,255,0.4)",
            }}>
              Tape !
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
          >
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
              style={{ fontSize: 48, lineHeight: 1, color: `${ROSE}99` }}
            >
              ⋯
            </motion.div>
            <span style={{ fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>
              Attends l'éclair…
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", letterSpacing: 0.5 }}>
              Ne tape pas trop tôt !
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap done feedback */}
      {myTapDone && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: "absolute",
            bottom: 18,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 13,
            fontWeight: 600,
            color: isLightning ? "rgba(80,30,0,0.8)" : "rgba(255,255,255,0.55)",
          }}
        >
          {isLightning ? "Tapé ⚡ — attends le résultat" : "Faux départ enregistré 😅"}
        </motion.div>
      )}

      {/* Other player feedback */}
      {otherTapDone && !myTapDone && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            fontSize: 11,
            color: isLightning ? "rgba(80,30,0,0.6)" : "rgba(255,255,255,0.35)",
            background: isLightning ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.06)",
            borderRadius: 20,
            padding: "4px 10px",
          }}
        >
          {otherName} a tapé…
        </motion.div>
      )}

      {/* Player labels */}
      <div style={{
        position: "absolute",
        top: 16,
        left: 18,
        display: "flex",
        gap: 6,
        alignItems: "center",
      }}>
        <span style={{ fontSize: 11, color: isLightning ? "rgba(80,30,0,0.5)" : "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: 1.5 }}>
          {myName}
        </span>
        <span style={{ fontSize: 10, color: isLightning ? "rgba(80,30,0,0.35)" : "rgba(255,255,255,0.18)" }}>vs</span>
        <span style={{ fontSize: 11, color: isLightning ? "rgba(80,30,0,0.5)" : "rgba(255,255,255,0.28)", textTransform: "uppercase", letterSpacing: 1.5 }}>
          {otherName}
        </span>
      </div>
    </motion.button>
  );
}

// ─────────── CountdownView ───────────
function CountdownView({ start }: { start: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, []);

  const elapsed     = now - start;
  const totalSecs   = COUNTDOWN_MS / 1000;
  const currentSec  = Math.max(1, totalSecs - Math.floor(elapsed / 1000));
  const fracDone    = (elapsed % 1000) / 1000;
  const globalPct   = Math.min(1, elapsed / COUNTDOWN_MS);

  const R     = 82;
  const circ  = 2 * Math.PI * R;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center" }}>
      <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 3, color: "rgba(255,255,255,0.35)", margin: 0 }}>
        Prête ?
      </p>

      <div style={{ position: "relative", width: 200, height: 200 }}>
        <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: "rotate(-90deg)", position: "absolute", inset: 0 }}>
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
          <motion.circle
            cx="100" cy="100" r={R}
            fill="none"
            stroke={ROSE}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circ}
            animate={{ strokeDashoffset: circ * globalPct }}
            transition={{ duration: 0.05, ease: "linear" }}
            style={{ filter: `drop-shadow(0 0 8px ${ROSE}88)` }}
          />
        </svg>

        {/* Glow ring */}
        <div style={{
          position: "absolute",
          inset: 12,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at center, ${ROSE}10 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentSec}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SERIF,
              fontSize: 96,
              fontStyle: "italic",
              fontWeight: 700,
              color: "#fff",
              textShadow: `0 0 40px ${ROSE}88`,
              lineHeight: 1,
            }}
          >
            {currentSec}
          </motion.div>
        </AnimatePresence>

        {/* Inner progress arc */}
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{
            position: "absolute",
            bottom: 28,
            width: "100%",
            textAlign: "center",
          }}>
            <motion.div
              style={{ height: 3, borderRadius: 3, background: `rgba(255,255,255,0.12)`, margin: "0 40px", overflow: "hidden" }}
            >
              <motion.div
                animate={{ width: `${fracDone * 100}%` }}
                transition={{ duration: 0.05, ease: "linear" }}
                style={{ height: "100%", background: ROSE, borderRadius: 3 }}
              />
            </motion.div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.38)", margin: 0 }}>
        L'éclair tombe juste après… ⚡
      </p>
    </div>
  );
}
