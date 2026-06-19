import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { GAGES_RPS } from "@/components/RPSExtreme";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ── Level config ──────────────────────────────────────────────────────────
type Level = "easy" | "medium" | "hard";

const LEVELS: Record<Level, { label: string; emoji: string; lives: number; color: string; glow: string; desc: string }> = {
  easy:   { label: "Facile",    emoji: "🌿", lives: 8, color: "#4ade80", glow: "#4ade8040", desc: "8 cœurs pour deviner" },
  medium: { label: "Moyen",     emoji: "✨", lives: 6, color: "#fbbf24", glow: "#fbbf2440", desc: "6 cœurs pour deviner" },
  hard:   { label: "Difficile", emoji: "🔥", lives: 4, color: "#f43f5e", glow: "#f43f5e40", desc: "Seulement 4 cœurs !" },
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MAX_WORD = 30;
const MAX_HINT = 60;

// ── Theme ─────────────────────────────────────────────────────────────────
const BG      = "linear-gradient(160deg, oklch(0.10 0.07 260) 0%, oklch(0.07 0.04 250) 100%)";
const EMERALD = "#4ade80";
const ROSE    = "#f43f5e";

const glass = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 20,
};

// ── Types ─────────────────────────────────────────────────────────────────
type HMState = {
  game?: "hangman";
  phase?: "level_select" | "build" | "guess" | "reveal" | "dare" | "done";
  level_1?: Level | null;
  level_2?: Level | null;
  level?: Level | null;
  round?: 1 | 2;
  word_r1?: string | null;
  hint_r1?: string | null;
  word_r2?: string | null;
  hint_r2?: string | null;
  letters_r1?: string[];
  letters_r2?: string[];
  errors_r1?: number;
  errors_r2?: number;
  finished_r1?: boolean;
  finished_r2?: boolean;
  success_r1?: boolean;
  success_r2?: boolean;
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

// ── Logic helpers (unchanged) ─────────────────────────────────────────────
function normChar(c: string): string {
  return c.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}
function isLetter(c: string): boolean {
  const n = normChar(c);
  return n.length === 1 && n >= "A" && n <= "Z";
}
function uniqueLettersOf(word: string): Set<string> {
  const set = new Set<string>();
  for (const c of word) if (isLetter(c)) set.add(normChar(c));
  return set;
}
function isWordSolved(word: string, letters: string[]): boolean {
  const guessed = new Set(letters.map((l) => l.toUpperCase()));
  for (const c of word) {
    if (isLetter(c) && !guessed.has(normChar(c))) return false;
  }
  return true;
}
function stableIndex(seed: string, max: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % max;
}

// ── Supabase helpers ──────────────────────────────────────────────────────
const dbUpdate = (roomId: string, state: HMState) =>
  supabase.from("rooms").update({ minigame_state: state }).eq("id", roomId);

async function patchState(roomId: string, partial: HMState) {
  const { data } = await supabase.from("rooms").select("minigame_state").eq("id", roomId).maybeSingle();
  const current = (data?.minigame_state ?? {}) as HMState;
  await dbUpdate(roomId, { ...current, ...partial });
}

function freshReset(): HMState {
  return {
    game: "hangman", phase: "level_select", round: 1,
    level_1: null, level_2: null, level: null,
    word_r1: null, hint_r1: null, word_r2: null, hint_r2: null,
    letters_r1: [], letters_r2: [],
    errors_r1: 0, errors_r2: 0,
    finished_r1: false, finished_r2: false,
    success_r1: false, success_r2: false,
    winner_slot: null, wheel_index: null, dare_text: null,
  };
}

// ── Shared header ─────────────────────────────────────────────────────────
function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ width: "100%", maxWidth: 420, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <button onClick={onBack} style={{
        background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12, padding: "6px 14px", color: "rgba(255,255,255,0.65)", fontSize: 13, cursor: "pointer",
      }}>← Menu</button>
      <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 26, color: "#fff", margin: 0, letterSpacing: "0.03em" }}>
        Le Pendu
      </h1>
      <div style={{ width: 76 }} />
    </div>
  );
}

// ── HeartBar ──────────────────────────────────────────────────────────────
function HeartBar({ lives, errors, color }: { lives: number; errors: number; color: string }) {
  const sz = lives <= 4 ? 28 : lives <= 6 ? 24 : 20;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 5 }}>
      {Array.from({ length: lives }).map((_, i) => {
        const lost = i < errors;
        return (
          <motion.span
            key={i}
            initial={false}
            animate={lost ? { scale: [1.4, 0.8, 1], rotate: [0, -15, 0] } : { scale: 1 }}
            transition={{ duration: 0.38 }}
            style={{
              fontSize: sz, lineHeight: 1,
              filter: lost
                ? "grayscale(1) brightness(0.35)"
                : "drop-shadow(0 0 5px " + color + ")",
              display: "inline-block",
            }}
          >
            ❤️
          </motion.span>
        );
      })}
    </div>
  );
}

// ── WordDisplay ───────────────────────────────────────────────────────────
function WordDisplay({ word, letters, reveal = false, color = "#fff" }: {
  word: string; letters: string[]; reveal?: boolean; color?: string;
}) {
  const guessed = new Set(letters.map((l) => l.toUpperCase()));
  const wordsArr = word.split(" ");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 10px" }}>
      {wordsArr.map((w, wi) => (
        <div key={wi} style={{ display: "flex", gap: 5 }}>
          {Array.from(w).map((ch, i) => {
            if (!isLetter(ch)) {
              return (
                <span key={i} style={{ width: 14, display: "flex", alignItems: "flex-end", justifyContent: "center", height: 44, color: "rgba(255,255,255,0.45)", fontSize: 18, paddingBottom: 4 }}>
                  {ch}
                </span>
              );
            }
            const n = normChar(ch);
            const shown = reveal || guessed.has(n);
            return (
              <motion.div
                key={i}
                initial={false}
                animate={shown ? { scale: [1.25, 1] } : { scale: 1 }}
                transition={{ duration: 0.25 }}
                style={{
                  width: 28, height: 44,
                  display: "flex", alignItems: "flex-end", justifyContent: "center",
                  borderBottom: "2.5px solid " + (shown ? color : "rgba(255,255,255,0.18)"),
                  paddingBottom: 4, fontSize: 19, fontWeight: 700,
                  color: shown ? "#fff" : "transparent",
                  textShadow: shown ? "0 0 10px " + color + "77" : "none",
                  transition: "border-color 0.2s",
                }}
              >
                {shown ? ch.toUpperCase() : ""}
              </motion.div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Keyboard ──────────────────────────────────────────────────────────────
function Keyboard({ letters, word, pending, onPress }: {
  letters: string[]; word: string; pending: string | null;
  onPress: (l: string) => void;
}) {
  const guessedSet  = new Set(letters.map((l) => l.toUpperCase()));
  const wordLetters = uniqueLettersOf(word);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
      {ALPHABET.map((l) => {
        const used   = guessedSet.has(l);
        const isHit  = used && wordLetters.has(l);
        const isMiss = used && !wordLetters.has(l);
        const isLoad = pending === l;

        return (
          <motion.button
            key={l}
            whileTap={!used ? { scale: 0.82 } : {}}
            disabled={used || !!pending}
            onClick={() => onPress(l)}
            style={{
              height: 42, borderRadius: 10, border: "none",
              cursor: used || !!pending ? "default" : "pointer",
              fontSize: 13, fontWeight: 700,
              transition: "background 0.15s, color 0.15s, opacity 0.15s",
              ...(isHit ? {
                background: EMERALD + "28",
                color: EMERALD,
                boxShadow: "0 0 8px " + EMERALD + "44",
                opacity: 1,
              } : isMiss ? {
                background: "rgba(255,255,255,0.03)",
                color: "rgba(255,255,255,0.14)",
                textDecoration: "line-through",
                opacity: 0.6,
              } : isLoad ? {
                background: "rgba(255,255,255,0.18)",
                color: "#fff",
              } : {
                background: "rgba(255,255,255,0.09)",
                color: "rgba(255,255,255,0.82)",
                boxShadow: "0 1px 0 rgba(255,255,255,0.05)",
              }),
            }}
          >
            {l}
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export function Hangman({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s     = (room.minigame_state ?? {}) as HMState;
  const phase = s.phase ?? "level_select";

  useEffect(() => {
    if (Object.keys(s).length === 0 && mySlot === 1) {
      void dbUpdate(room.id, freshReset());
    }
  }, [room.id, s, mySlot]);

  if (phase === "level_select") {
    return <LevelSelect state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onBack={onBackToMenu} />;
  }
  if (phase === "build" || phase === "guess") {
    return <Round state={s} room={room} mySlot={mySlot} otherName={otherName} onBack={onBackToMenu} />;
  }
  if (phase === "reveal") {
    return <RevealRound state={s} room={room} mySlot={mySlot} otherName={otherName} onBack={onBackToMenu} />;
  }
  if (phase === "dare") {
    return <DareView state={s} room={room} mySlot={mySlot} otherName={otherName} onDareDone={onDareDone} onBack={onBackToMenu} />;
  }
  return (
    <DoneView
      state={s} mySlot={mySlot}
      onReplay={async () => { await dbUpdate(room.id, freshReset()); }}
      onBack={onBackToMenu}
    />
  );
}

// ── LevelSelect ───────────────────────────────────────────────────────────
function LevelSelect({ state, room, mySlot, myName, otherName, onBack }: {
  state: HMState; room: Room; mySlot: number; myName: string; otherName: string; onBack: () => void;
}) {
  const mine   = mySlot === 1 ? state.level_1 : state.level_2;
  const theirs = mySlot === 1 ? state.level_2 : state.level_1;
  const both   = !!(state.level_1 && state.level_2);
  const match  = both && state.level_1 === state.level_2;

  const choose = async (l: Level) => {
    await patchState(room.id, mySlot === 1 ? { level_1: l } : { level_2: l });
  };

  const start = async () => {
    if (!match) return;
    await patchState(room.id, {
      phase: "build", level: state.level_1 ?? null, round: 1,
      word_r1: null, hint_r1: null, word_r2: null, hint_r2: null,
      letters_r1: [], letters_r2: [], errors_r1: 0, errors_r2: 0,
      finished_r1: false, finished_r2: false, success_r1: false, success_r2: false,
      winner_slot: null, wheel_index: null, dare_text: null,
    });
  };

  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 14px 36px" }}>
      <Header onBack={onBack} />
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", flex: 1 }}>

        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", margin: "0 0 24px" }}>
          Devine le mot secret avant de perdre tes cœurs ❤️
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
          {(Object.keys(LEVELS) as Level[]).map((l) => {
            const info     = LEVELS[l];
            const iPicked  = mine === l;
            const theyPicked = theirs === l;
            return (
              <motion.button
                key={l}
                whileTap={{ scale: 0.97 }}
                onClick={() => choose(l)}
                style={{
                  ...glass, borderRadius: 20, padding: "18px 20px",
                  display: "flex", alignItems: "center", gap: 16,
                  cursor: "pointer", textAlign: "left",
                  border: iPicked ? "2px solid " + info.color : "1px solid rgba(255,255,255,0.10)",
                  boxShadow: iPicked ? "0 0 22px " + info.glow : "none",
                  background: iPicked ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 30 }}>{info.emoji}</span>
                  <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center", width: 48 }}>
                    {Array.from({ length: info.lives }).map((_, i) => (
                      <span key={i} style={{ fontSize: 9 }}>❤️</span>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: info.color, fontSize: 18, fontWeight: 700, margin: "0 0 3px" }}>{info.label}</p>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, margin: 0 }}>{info.desc}</p>
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    {iPicked && (
                      <span style={{ background: info.color + "22", border: "1px solid " + info.color + "66", color: info.color, borderRadius: 100, fontSize: 11, padding: "2px 10px", fontWeight: 600 }}>
                        Toi ✓
                      </span>
                    )}
                    {theyPicked && (
                      <span style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.7)", borderRadius: 100, fontSize: 11, padding: "2px 10px" }}>
                        {otherName} ✓
                      </span>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <div style={{ ...glass, borderRadius: 16, padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: mine ? LEVELS[mine].color : "rgba(255,255,255,0.2)" }} />
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{myName} : {mine ? LEVELS[mine].label : "—"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{otherName} : {theirs ? LEVELS[theirs].label : "—"}</span>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: theirs ? LEVELS[theirs].color : "rgba(255,255,255,0.2)" }} />
            </div>
          </div>
          {both && !match && (
            <p style={{ color: "#fbbf24", fontSize: 12, textAlign: "center", margin: "8px 0 0" }}>
              Mettez-vous d'accord sur le même niveau 😅
            </p>
          )}
        </div>

        <div style={{ marginTop: "auto", paddingTop: 8 }}>
          <motion.button
            whileTap={match ? { scale: 0.97 } : {}}
            onClick={start}
            disabled={!match}
            style={{
              width: "100%", padding: "16px 0", borderRadius: 18, border: "none",
              cursor: match ? "pointer" : "not-allowed",
              background: match
                ? "linear-gradient(135deg, " + (mine ? LEVELS[mine].color : EMERALD) + "dd, " + (mine ? LEVELS[mine].color : EMERALD) + "88)"
                : "rgba(255,255,255,0.08)",
              color: match ? "#fff" : "rgba(255,255,255,0.3)",
              fontSize: 16, fontWeight: 700,
              boxShadow: match ? "0 6px 24px " + (mine ? LEVELS[mine!].color : EMERALD) + "44" : "none",
            }}
          >
            {match ? "C'est parti ! 🎮" : "En attente d'un niveau commun…"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ── Round dispatcher ──────────────────────────────────────────────────────
function Round({ state, room, mySlot, otherName, onBack }: {
  state: HMState; room: Room; mySlot: number; otherName: string; onBack: () => void;
}) {
  const level  = (state.level ?? "easy") as Level;
  const lives  = LEVELS[level].lives;
  const round  = state.round ?? 1;

  const codemakerSlot = round === 1 ? 1 : 2;
  const iAmMaker      = mySlot === codemakerSlot;

  const wordKey     = round === 1 ? "word_r1"     : "word_r2";
  const hintKey     = round === 1 ? "hint_r1"     : "hint_r2";
  const lettersKey  = round === 1 ? "letters_r1"  : "letters_r2";
  const errorsKey   = round === 1 ? "errors_r1"   : "errors_r2";
  const finishedKey = round === 1 ? "finished_r1" : "finished_r2";
  const successKey  = round === 1 ? "success_r1"  : "success_r2";

  const word    = (state[wordKey] as string | null | undefined) ?? null;
  const hint    = (state[hintKey] as string | null | undefined) ?? null;
  const letters = (state[lettersKey] as string[] | undefined) ?? [];
  const errors  = (state[errorsKey] as number | undefined) ?? 0;

  if (state.phase === "build") {
    if (iAmMaker) {
      return (
        <BuildWord
          level={level} round={round} otherName={otherName} onBack={onBack}
          onValidate={async (w, h) => {
            await patchState(room.id, { [wordKey]: w, [hintKey]: h, phase: "guess" } as HMState);
          }}
        />
      );
    }
    return <WaitingScreen onBack={onBack} otherName={otherName} round={round} level={level} />;
  }

  if (iAmMaker) {
    return (
      <WatcherView
        level={level} round={round} otherName={otherName}
        word={word ?? ""} hint={hint ?? ""} letters={letters} errors={errors} lives={lives}
        onBack={onBack}
      />
    );
  }

  return (
    <GuesserView
      level={level} round={round} otherName={otherName}
      word={word ?? ""} hint={hint ?? ""} letters={letters} errors={errors} lives={lives}
      onBack={onBack}
      onGuess={async (letter) => {
        const L = letter.toUpperCase();
        if (letters.includes(L)) return;
        const normWord   = normalize(word ?? "");
        const isHit      = normWord.includes(L);
        const newLetters = [...letters, L];
        const newErrors  = isHit ? errors : errors + 1;
        const solved     = isWordSolved(word ?? "", newLetters);
        const dead       = newErrors >= lives;

        if (solved || dead) {
          await patchState(room.id, {
            [lettersKey]: newLetters, [errorsKey]: newErrors,
            [finishedKey]: true, [successKey]: solved,
            phase: "reveal",
          } as HMState);
        } else {
          await patchState(room.id, { [lettersKey]: newLetters, [errorsKey]: newErrors } as HMState);
        }
      }}
    />
  );
}

// ── BuildWord ─────────────────────────────────────────────────────────────
function BuildWord({ level, round, otherName, onValidate, onBack }: {
  level: Level; round: number; otherName: string; onBack: () => void;
  onValidate: (word: string, hint: string) => void | Promise<void>;
}) {
  const [word, setWord]       = useState("");
  const [hint, setHint]       = useState("");
  const [sending, setSending] = useState(false);
  const cfg = LEVELS[level];

  const trimmed   = word.trim();
  const hasLetter = useMemo(() => Array.from(trimmed).some(isLetter), [trimmed]);
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_WORD && hasLetter && !sending;

  const submit = async () => {
    if (!canSubmit) return;
    setSending(true);
    try { await onValidate(trimmed, hint.trim().slice(0, MAX_HINT)); }
    finally { setSending(false); }
  };

  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 14px 36px" }}>
      <Header onBack={onBack} />
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", flex: 1 }}>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <span style={{ background: cfg.color + "22", border: "1px solid " + cfg.color + "55", color: cfg.color, borderRadius: 100, fontSize: 13, padding: "4px 16px", fontWeight: 600 }}>
            Manche {round} · {cfg.emoji} {cfg.label}
          </span>
        </div>

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28, color: "#fff", margin: "0 0 6px" }}>
            Ton mot secret 🔒
          </h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: 0 }}>
            {otherName} devra le deviner lettre par lettre.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          <div style={{ ...glass, borderRadius: 18, padding: "12px 16px" }}>
            <label style={{ color: "rgba(255,255,255,0.42)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              Mot ou phrase
            </label>
            <input
              value={word}
              onChange={(e) => setWord(e.target.value.slice(0, MAX_WORD))}
              placeholder="Ex : Notre plage secrète"
              autoFocus
              style={{
                background: "none", border: "none", outline: "none", width: "100%",
                color: "#fff", fontSize: 18, fontWeight: 600, caretColor: cfg.color,
              }}
            />
            <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "10px 0 6px" }} />
            <p style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, margin: 0 }}>
              {trimmed.length}/{MAX_WORD} · accents gérés automatiquement
            </p>
          </div>

          <div style={{ ...glass, borderRadius: 18, padding: "12px 16px" }}>
            <label style={{ color: "rgba(255,255,255,0.42)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              Indice (optionnel)
            </label>
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value.slice(0, MAX_HINT))}
              placeholder="Ex : un endroit qu'on adore"
              style={{
                background: "none", border: "none", outline: "none", width: "100%",
                color: "rgba(255,255,255,0.75)", fontSize: 15, caretColor: cfg.color,
              }}
            />
          </div>
        </div>

        {/* Live preview as blanks */}
        {trimmed.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ ...glass, borderRadius: 18, padding: "16px", marginBottom: 16, textAlign: "center", border: "1px solid " + cfg.color + "33" }}
          >
            <p style={{ color: cfg.color, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 12px" }}>
              Ce que verra {otherName}
            </p>
            <WordDisplay word={trimmed} letters={[]} reveal={false} color={cfg.color} />
            <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 11, margin: "10px 0 0" }}>
              {uniqueLettersOf(trimmed).size} lettre{uniqueLettersOf(trimmed).size > 1 ? "s" : ""} unique{uniqueLettersOf(trimmed).size > 1 ? "s" : ""} · {trimmed.replace(/[^a-zA-ZÀ-ÿ]/g, "").length} case{trimmed.replace(/[^a-zA-ZÀ-ÿ]/g, "").length > 1 ? "s" : ""}
            </p>
          </motion.div>
        )}

        <div style={{ marginTop: "auto", paddingTop: 8 }}>
          <motion.button
            whileTap={canSubmit ? { scale: 0.97 } : {}}
            disabled={!canSubmit}
            onClick={submit}
            style={{
              width: "100%", padding: "16px 0", borderRadius: 18, border: "none",
              cursor: canSubmit ? "pointer" : "not-allowed",
              background: canSubmit
                ? "linear-gradient(135deg, " + cfg.color + "dd, " + cfg.color + "88)"
                : "rgba(255,255,255,0.08)",
              color: canSubmit ? "#fff" : "rgba(255,255,255,0.28)",
              fontSize: 16, fontWeight: 700,
              boxShadow: canSubmit ? "0 6px 24px " + cfg.color + "44" : "none",
            }}
          >
            {sending ? "Envoi…" : "Mot prêt 🔒"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ── WaitingScreen ─────────────────────────────────────────────────────────
function WaitingScreen({ onBack, otherName, round, level }: {
  onBack: () => void; otherName: string; round: number; level: Level;
}) {
  const cfg = LEVELS[level];
  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 14px" }}>
      <Header onBack={onBack} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 20 }}>
        <span style={{ background: cfg.color + "22", border: "1px solid " + cfg.color + "55", color: cfg.color, borderRadius: 100, fontSize: 13, padding: "4px 16px", fontWeight: 600 }}>
          Manche {round} · {cfg.emoji} {cfg.label}
        </span>
        <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 2, repeat: Infinity }} style={{ fontSize: 72 }}>
          🤫
        </motion.div>
        <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28, color: "#fff", margin: 0 }}>
          {otherName} prépare son mot…
        </h2>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}>
          Le secret se forge 🔒
        </p>
      </div>
    </div>
  );
}

// ── GuesserView ───────────────────────────────────────────────────────────
function GuesserView({ level, round, otherName, word, hint, letters, errors, lives, onGuess, onBack }: {
  level: Level; round: number; otherName: string;
  word: string; hint: string; letters: string[]; errors: number; lives: number;
  onGuess: (letter: string) => void | Promise<void>; onBack: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const cfg = LEVELS[level];

  const press = async (l: string) => {
    if (pending || letters.includes(l)) return;
    setPending(l);
    try { await onGuess(l); } finally { setPending(null); }
  };

  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 14px 24px" }}>
      <Header onBack={onBack} />
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", flex: 1, gap: 12 }}>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <span style={{ background: cfg.color + "22", border: "1px solid " + cfg.color + "55", color: cfg.color, borderRadius: 100, fontSize: 13, padding: "4px 16px", fontWeight: 600 }}>
            Manche {round} · {cfg.emoji} {cfg.label}
          </span>
        </div>

        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22, color: "#fff", margin: "0 0 4px" }}>
            Devine le mot de {otherName}
          </h2>
          {hint && (
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0, fontStyle: "italic" }}>
              💡 {hint}
            </p>
          )}
        </div>

        <HeartBar lives={lives} errors={errors} color={cfg.color} />

        <div style={{ ...glass, borderRadius: 20, padding: "18px 12px" }}>
          <WordDisplay word={word} letters={letters} color={cfg.color} />
          <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 11, textAlign: "center", margin: "10px 0 0" }}>
            Accents et espaces gérés automatiquement ✨
          </p>
        </div>

        <div style={{ flex: 1 }}>
          <Keyboard letters={letters} word={word} pending={pending} onPress={press} />
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: EMERALD + "28", border: "1px solid " + EMERALD + "88" }} />
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Bonne lettre</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }} />
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Mauvaise lettre</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WatcherView ───────────────────────────────────────────────────────────
function WatcherView({ level, round, otherName, word, hint, letters, errors, lives, onBack }: {
  level: Level; round: number; otherName: string;
  word: string; hint: string; letters: string[]; errors: number; lives: number; onBack: () => void;
}) {
  const cfg         = LEVELS[level];
  const wordLetters = uniqueLettersOf(word);
  const hits        = letters.filter((l) => wordLetters.has(l.toUpperCase()));
  const misses      = letters.filter((l) => !wordLetters.has(l.toUpperCase()));

  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 14px 24px" }}>
      <Header onBack={onBack} />
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", flex: 1, gap: 12 }}>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <span style={{ background: cfg.color + "22", border: "1px solid " + cfg.color + "55", color: cfg.color, borderRadius: 100, fontSize: 13, padding: "4px 16px", fontWeight: 600 }}>
            Manche {round} · {cfg.emoji} {cfg.label}
          </span>
        </div>

        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22, color: "#fff", margin: "0 0 4px" }}>
            {otherName} cherche ton mot…
          </h2>
          {hint && (
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: 0, fontStyle: "italic" }}>
              💡 Indice donné : {hint}
            </p>
          )}
        </div>

        <HeartBar lives={lives} errors={errors} color={cfg.color} />

        {/* Ton mot — toujours visible pour le créateur */}
        <div style={{ ...glass, borderRadius: 20, padding: "14px 12px", border: "1px solid " + cfg.color + "44" }}>
          <p style={{ color: cfg.color, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center", margin: "0 0 12px" }}>
            Ton mot secret 🔒
          </p>
          <WordDisplay word={word} letters={letters} reveal color={cfg.color} />
          <p style={{ color: "rgba(255,255,255,0.22)", fontSize: 11, textAlign: "center", margin: "8px 0 0" }}>
            Toi seul vois le mot complet 😉
          </p>
        </div>

        {/* Letters sorted by result */}
        <div style={{ ...glass, borderRadius: 18, padding: "14px 16px", flex: 1 }}>
          <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center", margin: "0 0 12px" }}>
            Lettres essayées
          </p>
          {letters.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, textAlign: "center", margin: 0 }}>Aucune encore</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {hits.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <span style={{ color: EMERALD, fontSize: 11, fontWeight: 600, minWidth: 52 }}>✓ Bonnes</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    <AnimatePresence>
                      {hits.map((l) => (
                        <motion.span
                          key={l}
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          style={{ background: EMERALD + "22", border: "1px solid " + EMERALD + "66", color: EMERALD, borderRadius: 8, padding: "3px 10px", fontSize: 13, fontWeight: 700 }}
                        >{l}</motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
              {misses.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <span style={{ color: ROSE, fontSize: 11, fontWeight: 600, minWidth: 52 }}>✗ Ratées</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    <AnimatePresence>
                      {misses.map((l) => (
                        <motion.span
                          key={l}
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          style={{ background: ROSE + "18", border: "1px solid " + ROSE + "44", color: ROSE, borderRadius: 8, padding: "3px 10px", fontSize: 13, fontWeight: 700, textDecoration: "line-through" }}
                        >{l}</motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", margin: 0 }}>
          {errors} erreur{errors > 1 ? "s" : ""} · {Math.max(0, lives - errors)} ❤️ restant{Math.max(0, lives - errors) > 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

// ── RevealRound ───────────────────────────────────────────────────────────
function RevealRound({ state, room, mySlot, otherName, onBack }: {
  state: HMState; room: Room; mySlot: number; otherName: string; onBack: () => void;
}) {
  const round    = state.round ?? 1;
  const level    = (state.level ?? "easy") as Level;
  const cfg      = LEVELS[level];
  const lives    = cfg.lives;

  const wordKey    = round === 1 ? "word_r1"    : "word_r2";
  const lettersKey = round === 1 ? "letters_r1" : "letters_r2";
  const errorsKey  = round === 1 ? "errors_r1"  : "errors_r2";
  const successKey = round === 1 ? "success_r1" : "success_r2";

  const word    = (state[wordKey] as string | null | undefined) ?? "";
  const letters = (state[lettersKey] as string[] | undefined) ?? [];
  const errors  = (state[errorsKey] as number | undefined) ?? 0;
  const success = (state[successKey] as boolean | undefined) ?? false;

  const guesserSlot = round === 1 ? 2 : 1;
  const iAmGuesser  = mySlot === guesserSlot;

  useEffect(() => {
    if (success && iAmGuesser) void confetti({ particleCount: 90, spread: 70, origin: { y: 0.5 } });
  }, [success, iAmGuesser]);

  const goNext = async () => {
    if (round === 1) {
      await patchState(room.id, { phase: "build", round: 2 });
    } else {
      const s1 = state.success_r1 ?? false;
      const e1 = state.errors_r1 ?? lives;
      const s2 = success;
      const e2 = errors;
      const slot1Success = s2; const slot1Errors = e2;
      const slot2Success = s1; const slot2Errors = e1;

      let winner: 0 | 1 | 2 = 0;
      if      (slot1Success && !slot2Success) winner = 1;
      else if (slot2Success && !slot1Success) winner = 2;
      else if (slot1Success && slot2Success) {
        if      (slot1Errors < slot2Errors) winner = 1;
        else if (slot2Errors < slot1Errors) winner = 2;
      } else {
        if      (slot1Errors < slot2Errors) winner = 1;
        else if (slot2Errors < slot1Errors) winner = 2;
      }

      const gageList   = GAGES_RPS[level];
      const seed       = room.id + "-pendu-" + level + "-" + (state.word_r1 ?? "") + "-" + (state.word_r2 ?? "") + "-" + winner;
      const wheel_index = stableIndex(seed, gageList.length);

      await patchState(room.id, { phase: "dare", winner_slot: winner, wheel_index, dare_text: gageList[wheel_index] });
    }
  };

  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 14px 36px" }}>
      <Header onBack={onBack} />
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", flex: 1 }}>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <span style={{ background: cfg.color + "22", border: "1px solid " + cfg.color + "55", color: cfg.color, borderRadius: 100, fontSize: 13, padding: "4px 16px", fontWeight: 600 }}>
            Manche {round} · {cfg.emoji} {cfg.label}
          </span>
        </div>

        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          style={{ textAlign: "center", marginBottom: 20 }}
        >
          <div style={{ fontSize: 56, marginBottom: 10 }}>
            {success ? "🎉" : "💔"}
          </div>
          <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28, color: "#fff", margin: "0 0 4px" }}>
            {success
              ? (iAmGuesser ? "Tu as trouvé !" : otherName + " a trouvé !")
              : (iAmGuesser ? "Raté cette fois…" : otherName + " n'a pas trouvé")}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, margin: 0 }}>
            {errors} erreur{errors > 1 ? "s" : ""} · {Math.max(0, lives - errors)} ❤️ restant{Math.max(0, lives - errors) > 1 ? "s" : ""}
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.22 }}
          style={{ ...glass, borderRadius: 22, padding: "20px 14px", marginBottom: 16, textAlign: "center" }}
        >
          <p style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.09em", margin: "0 0 14px" }}>
            Le mot secret était
          </p>
          <WordDisplay word={word} letters={[]} reveal color={success ? EMERALD : ROSE} />
        </motion.div>

        <HeartBar lives={lives} errors={errors} color={cfg.color} />

        <div style={{ marginTop: "auto", paddingTop: 20 }}>
          {mySlot === 1 ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={goNext}
              style={{
                width: "100%", padding: "16px 0", borderRadius: 18, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, " + cfg.color + "dd, " + cfg.color + "88)",
                color: "#fff", fontSize: 15, fontWeight: 700,
                boxShadow: "0 6px 24px " + cfg.color + "44",
              }}
            >
              {round === 1 ? "Manche 2 — à toi de choisir le mot 🔒" : "Voir le résultat 🏆"}
            </motion.button>
          ) : (
            <div style={{ ...glass, borderRadius: 16, padding: "14px 16px", textAlign: "center" }}>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, margin: 0 }}>
                {otherName} passe à la suite…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── DareView ──────────────────────────────────────────────────────────────
function DareView({ state, room, mySlot, otherName, onDareDone, onBack }: {
  state: HMState; room: Room; mySlot: number; otherName: string; onDareDone: () => void; onBack: () => void;
}) {
  const winner   = state.winner_slot ?? 0;
  const level    = (state.level ?? "easy") as Level;
  const cfg      = LEVELS[level];
  const gageList = GAGES_RPS[level];
  const idx      = typeof state.wheel_index === "number" ? state.wheel_index : 0;
  const dare     = state.dare_text ?? gageList[idx % gageList.length];

  if (winner === 0) {
    return (
      <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center" }}>
        <motion.div initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: "spring" }} style={{ fontSize: 72, marginBottom: 20 }}>🤝</motion.div>
        <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 32, color: "#fff", margin: "0 0 8px" }}>Égalité !</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, marginBottom: 40 }}>Pas de gage cette fois. On remet ça ?</p>
        {mySlot === 1 ? (
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={async () => { await dbUpdate(room.id, freshReset()); }}
            style={{ padding: "16px 48px", borderRadius: 18, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 16, fontWeight: 700 }}>
            Rejouer 🔁
          </motion.button>
        ) : (
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>{otherName} va relancer…</p>
        )}
      </div>
    );
  }

  const loser = winner === 1 ? 2 : 1;
  const iLost = mySlot === loser;

  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center" }}>
      <motion.div
        initial={{ scale: 0.3, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        style={{ fontSize: 64, marginBottom: 16 }}
      >
        {iLost ? "😅" : "🏆"}
      </motion.div>

      <span style={{ background: cfg.color + "22", border: "1px solid " + cfg.color + "55", color: cfg.color, borderRadius: 100, fontSize: 13, padding: "4px 16px", fontWeight: 600, marginBottom: 16, display: "inline-block" }}>
        {cfg.emoji} {cfg.label}
      </span>

      <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.09em", margin: "0 0 8px" }}>
        {iLost ? "Ton gage" : "Gage pour " + otherName}
      </p>

      <div style={{ ...glass, borderRadius: 22, padding: "22px 24px", maxWidth: 380, width: "100%", marginBottom: 32 }}>
        <p style={{ color: "#fff", fontFamily: "Cormorant Garamond, serif", fontSize: 22, lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>
          "{dare}"
        </p>
      </div>

      {iLost ? (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={async () => { onDareDone(); await patchState(room.id, { phase: "done" }); }}
          style={{
            width: "100%", maxWidth: 380, padding: "16px 0", borderRadius: 18, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, " + cfg.color + "dd, " + cfg.color + "88)",
            color: "#fff", fontSize: 16, fontWeight: 700,
            boxShadow: "0 6px 24px " + cfg.color + "44",
          }}
        >
          C'est fait ! ✅
        </motion.button>
      ) : (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>On attend que {otherName} fasse son gage… 🥹</p>
      )}
    </div>
  );
}

// ── DoneView ──────────────────────────────────────────────────────────────
function DoneView({ state, mySlot, onReplay, onBack }: {
  state: HMState; mySlot: number; onReplay: () => void; onBack: () => void;
}) {
  const winner = state.winner_slot ?? 0;
  const iWon   = winner === mySlot;

  useEffect(() => {
    if (iWon) void confetti({ particleCount: 120, spread: 75, origin: { y: 0.5 }, colors: [ROSE, EMERALD, "#fbbf24", "#fff"] });
  }, [iWon]);

  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center" }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.25, 1] }}
        transition={{ duration: 0.7 }}
        style={{ fontSize: 80, marginBottom: 20 }}
      >
        {iWon ? "🏆" : "💖"}
      </motion.div>

      <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 32, color: "#fff", margin: "0 0 8px" }}>
        {iWon ? "Tu as gagné !" : "Bravo pour le gage 😘"}
      </h2>

      <div style={{ ...glass, borderRadius: 18, padding: "12px 24px", marginBottom: 36, display: "inline-block" }}>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: 0 }}>
          Erreurs : <span style={{ color: "#fff", fontWeight: 700 }}>{state.errors_r2 ?? "—"}</span> (J1) · <span style={{ color: "#fff", fontWeight: 700 }}>{state.errors_r1 ?? "—"}</span> (J2)
        </p>
      </div>

      <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 10 }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onReplay}
          style={{
            padding: "16px 0", borderRadius: 18, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #4ade80dd, #4ade8088)",
            color: "#fff", fontSize: 16, fontWeight: 700,
            boxShadow: "0 6px 24px #4ade8044",
          }}
        >
          Rejouer 🔁
        </motion.button>
        <button
          onClick={onBack}
          style={{
            padding: "13px 0", borderRadius: 16, cursor: "pointer",
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)",
            color: "rgba(255,255,255,0.7)", fontSize: 14,
          }}
        >
          ← Retour au menu
        </button>
      </div>
    </div>
  );
}
