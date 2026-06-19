import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { GAGES_RPS } from "@/components/RPSExtreme";
import type { Room } from "@/lib/use-room-state";
import { markItemsUsed, pickNonRepeating } from "@/lib/non-repeating";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ── Level config ──────────────────────────────────────────────────────────
type Level = "easy" | "medium" | "hard";

const LEVELS: Record<Level, { label: string; size: number; palette: number; maxAttempts: number; color: string; glow: string; desc: string; emoji: string }> = {
  easy:   { label: "Facile",    size: 3, palette: 4, maxAttempts: 10, color: "#4ade80", glow: "#4ade8040", desc: "3 cases · 4 couleurs · 10 essais", emoji: "🌿" },
  medium: { label: "Moyen",     size: 4, palette: 6, maxAttempts: 10, color: "#fbbf24", glow: "#fbbf2440", desc: "4 cases · 6 couleurs · 10 essais", emoji: "✨" },
  hard:   { label: "Difficile", size: 5, palette: 6, maxAttempts: 8,  color: "#f43f5e", glow: "#f43f5e40", desc: "5 cases · 6 couleurs · 8 essais",  emoji: "🔥" },
};

// ── Color palette ─────────────────────────────────────────────────────────
const COLORS = [
  { id: "rose",   hex: "#f43f5e", label: "Rose"   },
  { id: "amber",  hex: "#fbbf24", label: "Doré"   },
  { id: "lime",   hex: "#4ade80", label: "Vert"   },
  { id: "sky",    hex: "#38bdf8", label: "Bleu"   },
  { id: "violet", hex: "#a78bfa", label: "Violet" },
  { id: "orange", hex: "#fb923c", label: "Orange" },
];

// ── Theme ─────────────────────────────────────────────────────────────────
const BG = "linear-gradient(160deg, oklch(0.10 0.07 260) 0%, oklch(0.07 0.04 250) 100%)";

const glass = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 20,
};

// ── Types ─────────────────────────────────────────────────────────────────
type Attempt = { guess: string[]; black: number; white: number };

type MMState = {
  game?: "mastermind";
  phase?: "level_select" | "build" | "guess" | "dare" | "done";
  level_1?: Level | null;
  level_2?: Level | null;
  level?: Level | null;
  round?: 1 | 2;
  code_1?: string[] | null;
  code_2?: string[] | null;
  attempts_1?: Attempt[];
  attempts_2?: Attempt[];
  found_1?: boolean | null;
  found_2?: boolean | null;
  tries_1?: number | null;
  tries_2?: number | null;
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

// ── Supabase helpers (unchanged) ──────────────────────────────────────────
const dbUpdate = (roomId: string, state: MMState) =>
  supabase.from("rooms").update({ minigame_state: state }).eq("id", roomId);

async function patchState(roomId: string, partial: MMState) {
  const { data } = await supabase.from("rooms").select("minigame_state").eq("id", roomId).maybeSingle();
  const current = (data?.minigame_state ?? {}) as MMState;
  await dbUpdate(roomId, { ...current, ...partial });
}

// ── Game logic (unchanged) ────────────────────────────────────────────────
function evaluate(code: string[], guess: string[]): { black: number; white: number } {
  let black = 0;
  const codeRest: string[] = [], guessRest: string[] = [];
  for (let i = 0; i < code.length; i++) {
    if (guess[i] === code[i]) black++;
    else { codeRest.push(code[i]); guessRest.push(guess[i]); }
  }
  let white = 0;
  const counts: Record<string, number> = {};
  for (const c of codeRest) counts[c] = (counts[c] ?? 0) + 1;
  for (const g of guessRest) { if ((counts[g] ?? 0) > 0) { white++; counts[g]--; } }
  return { black, white };
}

// ── Helper UI components ──────────────────────────────────────────────────

/** Colored disc or empty slot */
function Disc({ colorId, size = 44, active = false }: { colorId?: string | null; size?: number; active?: boolean }) {
  const c = colorId ? COLORS.find(x => x.id === colorId) : null;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, position: "relative",
      background: c
        ? "radial-gradient(circle at 32% 30%, " + c.hex + "ff 0%, " + c.hex + "cc 55%, " + c.hex + "99 100%)"
        : "rgba(255,255,255,0.07)",
      boxShadow: c
        ? "0 0 10px " + c.hex + "66, inset 0 -2px 4px rgba(0,0,0,0.2)"
        : active
          ? "0 0 0 2.5px rgba(255,255,255,0.75), inset 0 2px 8px rgba(0,0,0,0.45)"
          : "0 0 0 1.5px rgba(255,255,255,0.15), inset 0 2px 8px rgba(0,0,0,0.4)",
    }}>
      {active && !c && (
        <div style={{ position: "absolute", inset: "32%", background: "rgba(255,255,255,0.55)", borderRadius: "50%", animation: "pulse 1.2s ease-in-out infinite" }} />
      )}
    </div>
  );
}

/** Feedback pegs: black = well-placed, white = right color wrong place */
function Pegs({ black, white, total }: { black: number; white: number; total: number }) {
  const rows = Math.ceil(total / 2);
  const pegs = Array.from({ length: rows * 2 }, (_, i) =>
    i < black ? "black" : i < black + white ? "white" : "empty"
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 12px)", gap: 3 }}>
      {pegs.map((type, i) => (
        <div key={i} style={{
          width: 12, height: 12, borderRadius: "50%",
          background: type === "black" ? "#0d0d1f" : type === "white" ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.07)",
          border: type === "white" ? "1.5px solid rgba(255,255,255,0.55)"
                : type === "empty" ? "1px solid rgba(255,255,255,0.1)" : "none",
          boxShadow: type === "black" ? "inset 0 1px 3px rgba(0,0,0,0.8)" : "none",
        }} />
      ))}
    </div>
  );
}

/** Back button + title bar shared by all screens */
function Header({ onBack, title, subtitle }: { onBack: () => void; title?: string; subtitle?: string }) {
  return (
    <div style={{ width: "100%", maxWidth: 420, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: subtitle ? 10 : 0 }}>
        <button onClick={onBack} style={{
          background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12, padding: "6px 14px", color: "rgba(255,255,255,0.65)", fontSize: 13, cursor: "pointer",
        }}>← Menu</button>
        <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 26, color: "#fff", margin: 0, letterSpacing: "0.03em" }}>
          {title ?? "Mastermind"}
        </h1>
        <div style={{ width: 76 }} />
      </div>
      {subtitle && (
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center", margin: 0 }}>{subtitle}</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export function Mastermind({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s = (room.minigame_state ?? {}) as MMState;
  const phase = s.phase ?? "level_select";

  useEffect(() => {
    if (Object.keys(s).length === 0 && mySlot === 1) {
      void dbUpdate(room.id, { game: "mastermind", phase: "level_select", round: 1 });
    }
  }, [room.id, s, mySlot]);

  if (phase === "level_select") {
    return <LevelSelect state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onBack={onBackToMenu} />;
  }
  if (phase === "build" || phase === "guess") {
    return <Round state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onBack={onBackToMenu} />;
  }
  if (phase === "dare") {
    return <DareView state={s} room={room} mySlot={mySlot} otherName={otherName} onDareDone={onDareDone} onBack={onBackToMenu} />;
  }
  return (
    <DoneView
      state={s} mySlot={mySlot} onBack={onBackToMenu}
      onReplay={async () => {
        await dbUpdate(room.id, {
          game: "mastermind", phase: "level_select", round: 1,
          level_1: null, level_2: null, level: null,
          code_1: null, code_2: null,
          attempts_1: [], attempts_2: [],
          found_1: null, found_2: null,
          tries_1: null, tries_2: null,
          winner_slot: null, wheel_index: null, dare_text: null,
        });
      }}
    />
  );
}

// ── LevelSelect ───────────────────────────────────────────────────────────
function LevelSelect({ state, room, mySlot, myName, otherName, onBack }: {
  state: MMState; room: Room; mySlot: number; myName: string; otherName: string; onBack: () => void;
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
      code_1: null, code_2: null, attempts_1: [], attempts_2: [],
      found_1: null, found_2: null, tries_1: null, tries_2: null,
      winner_slot: null, wheel_index: null, dare_text: null,
    });
  };

  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 14px 36px" }}>
      <Header onBack={onBack} subtitle="Retrouvez le code de l'autre — le moins d'essais gagne !" />

      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        {(Object.keys(LEVELS) as Level[]).map((l) => {
          const info = LEVELS[l];
          const iPicked = mine === l;
          const theyPicked = theirs === l;
          return (
            <motion.button
              key={l}
              whileTap={{ scale: 0.97 }}
              onClick={() => choose(l)}
              style={{
                ...glass,
                borderRadius: 20,
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                cursor: "pointer",
                textAlign: "left",
                border: iPicked
                  ? "2px solid " + info.color
                  : "1px solid rgba(255,255,255,0.10)",
                boxShadow: iPicked ? "0 0 20px " + info.glow : "none",
                transition: "box-shadow 0.2s, border 0.2s",
                background: iPicked ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)",
              }}
            >
              <span style={{ fontSize: 36, flexShrink: 0 }}>{info.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: info.color, fontSize: 18, fontWeight: 700, margin: "0 0 2px" }}>{info.label}</p>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, margin: 0 }}>{info.desc}</p>
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  {iPicked && (
                    <span style={{ background: info.color + "22", border: "1px solid " + info.color + "66", color: info.color, borderRadius: 100, fontSize: 11, padding: "2px 10px", fontWeight: 600 }}>
                      Toi ✓
                    </span>
                  )}
                  {theyPicked && (
                    <span style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", borderRadius: 100, fontSize: 11, padding: "2px 10px" }}>
                      {otherName} ✓
                    </span>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}

        <div style={{ ...glass, borderRadius: 16, padding: "12px 16px", marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: mine ? LEVELS[mine].color : "rgba(255,255,255,0.2)", boxShadow: mine ? "0 0 6px " + LEVELS[mine!].color : "none" }} />
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{myName} : {mine ? LEVELS[mine].label : "—"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{otherName} : {theirs ? LEVELS[theirs].label : "—"}</span>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: theirs ? LEVELS[theirs].color : "rgba(255,255,255,0.2)", boxShadow: theirs ? "0 0 6px " + LEVELS[theirs!].color : "none" }} />
            </div>
          </div>
          {both && !match && (
            <p style={{ color: "#fbbf24", fontSize: 12, textAlign: "center", marginTop: 8, marginBottom: 0 }}>
              Mettez-vous d'accord sur le même niveau 😅
            </p>
          )}
        </div>

        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <motion.button
            whileTap={match ? { scale: 0.97 } : {}}
            onClick={start}
            disabled={!match}
            style={{
              width: "100%", padding: "16px 0", borderRadius: 18, border: "none", cursor: match ? "pointer" : "not-allowed",
              background: match
                ? "linear-gradient(135deg, " + (mine ? LEVELS[mine].color : "#4ade80") + "dd, " + (mine ? LEVELS[mine].color : "#4ade80") + "88)"
                : "rgba(255,255,255,0.08)",
              color: match ? "#fff" : "rgba(255,255,255,0.35)",
              fontSize: 16, fontWeight: 700,
              boxShadow: match ? "0 6px 24px " + (mine ? LEVELS[mine].color + "44" : "#4ade8044") : "none",
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
function Round({ state, room, mySlot, myName, otherName, onBack }: {
  state: MMState; room: Room; mySlot: number; myName: string; otherName: string; onBack: () => void;
}) {
  const level = (state.level ?? "easy") as Level;
  const { size, palette, maxAttempts } = LEVELS[level];
  const palettes = COLORS.slice(0, palette);
  const round = state.round ?? 1;

  const codemakerSlot = round === 1 ? 1 : 2;
  const iAmMaker      = mySlot === codemakerSlot;

  const codeKey     = round === 1 ? "code_1"     : "code_2"     as keyof MMState;
  const attemptsKey = round === 1 ? "attempts_2" : "attempts_1" as keyof MMState;
  const foundKey    = round === 1 ? "found_2"    : "found_1"    as keyof MMState;
  const triesKey    = round === 1 ? "tries_2"    : "tries_1"    as keyof MMState;

  const code     = (state[codeKey] as string[] | null | undefined) ?? null;
  const attempts = (state[attemptsKey] as Attempt[] | undefined) ?? [];

  if (state.phase === "build") {
    if (iAmMaker) {
      return (
        <BuildCode
          size={size} palettes={palettes} level={level} round={round} otherName={otherName}
          onBack={onBack}
          onValidate={async (newCode) => {
            await patchState(room.id, { [codeKey]: newCode, phase: "guess" } as MMState);
          }}
        />
      );
    }
    return <WaitingScreen onBack={onBack} otherName={otherName} round={round} level={level} />;
  }

  // guess phase
  if (iAmMaker) {
    return (
      <WatcherView
        level={level} round={round} otherName={otherName}
        attempts={attempts} maxAttempts={maxAttempts} size={size} palettes={palettes}
        myCode={code}
        onBack={onBack}
      />
    );
  }

  return (
    <GuesserView
      level={level} round={round} size={size} palettes={palettes}
      maxAttempts={maxAttempts} attempts={attempts} otherName={otherName}
      onBack={onBack}
      onSubmit={async (guess) => {
        if (!code) return;
        const result = evaluate(code, guess);
        const newAttempt: Attempt = { guess, black: result.black, white: result.white };
        const newAttempts = [...attempts, newAttempt];
        const found  = result.black === size;
        const ended  = found || newAttempts.length >= maxAttempts;

        if (!ended) {
          await patchState(room.id, { [attemptsKey]: newAttempts } as MMState);
          return;
        }

        const tries = newAttempts.length;
        if (round === 1) {
          await patchState(room.id, {
            [attemptsKey]: newAttempts, [foundKey]: found, [triesKey]: tries,
            phase: "build", round: 2,
          } as MMState);
        } else {
          const found1  = round === 2 ? found : (state.found_1 ?? false);
          const tries1  = round === 2 ? tries : (state.tries_1 ?? maxAttempts);
          const found2  = state.found_2 ?? false;
          const tries2  = state.tries_2 ?? maxAttempts;

          let winner: 0 | 1 | 2 = 0;
          if      (found1 && !found2)             winner = 1;
          else if (found2 && !found1)             winner = 2;
          else if (found1 && found2) {
            if      (tries1 < tries2) winner = 1;
            else if (tries2 < tries1) winner = 2;
          }

          const gageList   = [...GAGES_RPS[level]];
          const dareScope  = "dare:mastermind:" + level;
          const selectedDare = pickNonRepeating(gageList, dareScope, (x) => x);
          if (selectedDare) markItemsUsed(dareScope, [selectedDare], (x) => x);
          const wheel_index = selectedDare ? gageList.indexOf(selectedDare) : 0;

          await patchState(room.id, {
            [attemptsKey]: newAttempts, [foundKey]: found, [triesKey]: tries,
            phase: "dare", winner_slot: winner, wheel_index,
            dare_text: winner === 0 ? null : selectedDare ?? gageList[wheel_index],
          } as MMState);
        }
      }}
    />
  );
}

// ── BuildCode ─────────────────────────────────────────────────────────────
function BuildCode({ size, palettes, level, round, onValidate, otherName, onBack }: {
  size: number; palettes: typeof COLORS; level: Level; round: number;
  onValidate: (code: string[]) => void | Promise<void>; otherName: string; onBack: () => void;
}) {
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(size).fill(null));
  const [active, setActive] = useState(0);
  const filled = slots.every((s) => s !== null);
  const cfg = LEVELS[level];

  const pickColor = (id: string) => {
    setSlots((prev) => {
      const next = [...prev];
      next[active] = id;
      return next;
    });
    // Advance to next empty slot
    const nextEmpty = slots.findIndex((s, i) => i > active && s === null);
    if (nextEmpty !== -1) setActive(nextEmpty);
    else if (active < size - 1) setActive(active + 1);
  };

  const tapSlot = (i: number) => {
    setActive(i);
    // Tap filled slot: clear it
    if (slots[i] !== null) {
      setSlots((prev) => prev.map((s, idx) => idx === i ? null : s));
    }
  };

  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 14px 36px" }}>
      <Header onBack={onBack} />

      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", flex: 1, gap: 0 }}>
        {/* Manche badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <span style={{ background: cfg.color + "22", border: "1px solid " + cfg.color + "55", color: cfg.color, borderRadius: 100, fontSize: 13, padding: "4px 16px", fontWeight: 600 }}>
            Manche {round} · {cfg.emoji} {cfg.label}
          </span>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28, color: "#fff", margin: "0 0 4px" }}>
            Crée ton code secret 🔒
          </h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: 0 }}>
            {otherName} devra le retrouver. Répétitions autorisées.
          </p>
        </div>

        {/* Code slots */}
        <div style={{ ...glass, padding: "20px 16px", marginBottom: 24, borderRadius: 22 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.09em", textAlign: "center", marginBottom: 14, marginTop: 0 }}>
            Ton code
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {slots.map((s, i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.9 }}
                onClick={() => tapSlot(i)}
                style={{
                  background: "none", border: "none", padding: 0, cursor: "pointer",
                  outline: "none",
                  transform: active === i && !s ? "scale(1.08)" : "scale(1)",
                  transition: "transform 0.15s",
                }}
              >
                <Disc colorId={s} size={52} active={active === i} />
              </motion.button>
            ))}
          </div>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "center", marginTop: 12, marginBottom: 0 }}>
            Appuie sur une case remplie pour la vider
          </p>
        </div>

        {/* Color palette */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.09em", textAlign: "center", marginBottom: 14 }}>
            Palette
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {palettes.map((p) => (
              <motion.button
                key={p.id}
                whileTap={{ scale: 0.85 }}
                onClick={() => pickColor(p.id)}
                style={{
                  width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: "radial-gradient(circle at 32% 30%, " + p.hex + "ff 0%, " + p.hex + "cc 55%)",
                  boxShadow: "0 0 14px " + p.hex + "66, 0 4px 12px rgba(0,0,0,0.3)",
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => { setSlots(Array(size).fill(null)); setActive(0); }}
            style={{
              padding: "12px 0", borderRadius: 16, cursor: "pointer",
              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)",
              color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 500,
            }}
          >
            Tout effacer 🧽
          </button>
          <motion.button
            whileTap={filled ? { scale: 0.97 } : {}}
            disabled={!filled}
            onClick={() => filled && onValidate(slots.filter((s): s is string => !!s))}
            style={{
              padding: "16px 0", borderRadius: 18, border: "none", cursor: filled ? "pointer" : "not-allowed",
              background: filled
                ? "linear-gradient(135deg, " + cfg.color + "dd, " + cfg.color + "88)"
                : "rgba(255,255,255,0.08)",
              color: filled ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 16, fontWeight: 700,
              boxShadow: filled ? "0 6px 24px " + cfg.color + "44" : "none",
            }}
          >
            Code prêt 🔒
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ── WaitingScreen ─────────────────────────────────────────────────────────
function WaitingScreen({ onBack, otherName, round, level }: { onBack: () => void; otherName: string; round: number; level: Level }) {
  const cfg = LEVELS[level];
  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 14px 36px" }}>
      <Header onBack={onBack} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 20 }}>
        <span style={{ background: cfg.color + "22", border: "1px solid " + cfg.color + "55", color: cfg.color, borderRadius: 100, fontSize: 13, padding: "4px 16px", fontWeight: 600 }}>
          Manche {round} · {cfg.emoji} {cfg.label}
        </span>
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ fontSize: 72 }}
        >
          🤫
        </motion.div>
        <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 28, color: "#fff", margin: 0 }}>
          {otherName} prépare son code…
        </h2>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}>
          Patience, le secret se forge 🔒
        </p>
      </div>
    </div>
  );
}

// ── WatcherView ───────────────────────────────────────────────────────────
// CRITICAL: le codemaker voit TOUJOURS son propre code en haut
function WatcherView({ level, round, otherName, attempts, maxAttempts, size, palettes, myCode, onBack }: {
  level: Level; round: number; otherName: string; attempts: Attempt[];
  maxAttempts: number; size: number; palettes: typeof COLORS;
  myCode: string[] | null; onBack: () => void;
}) {
  const cfg = LEVELS[level];
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [attempts.length]);

  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 14px 36px" }}>
      <Header onBack={onBack} />

      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Manche badge */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <span style={{ background: cfg.color + "22", border: "1px solid " + cfg.color + "55", color: cfg.color, borderRadius: 100, fontSize: 13, padding: "4px 16px", fontWeight: 600 }}>
            Manche {round} · {cfg.emoji} {cfg.label}
          </span>
        </div>

        {/* ── TON CODE — always visible ── */}
        {myCode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ ...glass, padding: "14px 18px", marginBottom: 16, borderRadius: 20, border: "1px solid " + cfg.color + "44" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ color: cfg.color, fontSize: 12, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Ton code secret 🔒
              </p>
              <span style={{ background: cfg.color + "22", color: cfg.color, borderRadius: 100, fontSize: 10, padding: "2px 8px" }}>
                Visible que par toi
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              {myCode.map((colorId, i) => (
                <Disc key={i} colorId={colorId} size={44} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Progress */}
        <div style={{ ...glass, padding: "10px 16px", marginBottom: 16, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 13 }}>
            {otherName} cherche…
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{attempts.length}</span>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>/ {maxAttempts}</span>
          </div>
        </div>

        {/* Attempts */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <AttemptsList attempts={attempts} size={size} palettes={palettes} />
          <div ref={listEndRef} />
        </div>
      </div>
    </div>
  );
}

// ── GuesserView ───────────────────────────────────────────────────────────
function GuesserView({ level, round, size, palettes, maxAttempts, attempts, otherName, onSubmit, onBack }: {
  level: Level; round: number; size: number; palettes: typeof COLORS; maxAttempts: number;
  attempts: Attempt[]; otherName: string;
  onSubmit: (guess: string[]) => void | Promise<void>; onBack: () => void;
}) {
  const [slots, setSlots]   = useState<(string | null)[]>(() => Array(size).fill(null));
  const [active, setActive] = useState(0);
  const [sending, setSending] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  const filled    = slots.every((s) => s !== null);
  const remaining = Math.max(0, maxAttempts - attempts.length);
  const cfg       = LEVELS[level];

  useEffect(() => {
    setSlots(Array(size).fill(null));
    setActive(0);
  }, [attempts.length, size]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [attempts.length]);

  const pickColor = (id: string) => {
    setSlots((prev) => prev.map((s, idx) => idx === active ? id : s));
    if (active < size - 1) setActive(active + 1);
  };

  const tapSlot = (i: number) => {
    setActive(i);
    if (slots[i] !== null) {
      setSlots((prev) => prev.map((s, idx) => idx === i ? null : s));
    }
  };

  const submit = async () => {
    if (!filled || sending) return;
    setSending(true);
    try { await onSubmit(slots.filter((s): s is string => !!s)); }
    finally { setSending(false); }
  };

  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 14px 36px" }}>
      <Header onBack={onBack} />

      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Header info */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <span style={{ background: cfg.color + "22", border: "1px solid " + cfg.color + "55", color: cfg.color, borderRadius: 100, fontSize: 13, padding: "4px 16px", fontWeight: 600 }}>
            Manche {round} · {cfg.emoji} {cfg.label}
          </span>
        </div>

        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 24, color: "#fff", margin: "0 0 4px" }}>
            Devine le code de {otherName}
          </h2>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>⚫ bien placé · ⚪ bonne couleur</span>
            <span style={{
              background: remaining <= 2 ? "#f43f5e22" : "rgba(255,255,255,0.08)",
              border: "1px solid " + (remaining <= 2 ? "#f43f5e55" : "rgba(255,255,255,0.14)"),
              color: remaining <= 2 ? "#f43f5e" : "rgba(255,255,255,0.7)",
              borderRadius: 100, fontSize: 12, padding: "2px 10px", fontWeight: 600,
            }}>
              {remaining} essai{remaining > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Current guess builder */}
        <div style={{ ...glass, padding: "16px", marginBottom: 16, borderRadius: 20 }}>
          {/* Slots */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14 }}>
            {slots.map((s, i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.88 }}
                onClick={() => tapSlot(i)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                <Disc colorId={s} size={48} active={active === i} />
              </motion.button>
            ))}
          </div>

          {/* Color palette */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {palettes.map((p) => (
              <motion.button
                key={p.id}
                whileTap={{ scale: 0.84 }}
                onClick={() => pickColor(p.id)}
                style={{
                  width: 48, height: 48, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: "radial-gradient(circle at 32% 30%, " + p.hex + "ff 0%, " + p.hex + "cc 55%)",
                  boxShadow: "0 0 12px " + p.hex + "55, 0 3px 10px rgba(0,0,0,0.3)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Attempts history */}
        {attempts.length > 0 && (
          <div style={{ flex: 1, overflowY: "auto", marginBottom: 12 }}>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, textAlign: "center" }}>
              Historique
            </p>
            <AttemptsList attempts={attempts} size={size} palettes={palettes} />
            <div ref={listEndRef} />
          </div>
        )}

        {/* Submit */}
        <div style={{ marginTop: "auto", paddingTop: 8 }}>
          <motion.button
            whileTap={filled && !sending ? { scale: 0.97 } : {}}
            disabled={!filled || sending}
            onClick={submit}
            style={{
              width: "100%", padding: "16px 0", borderRadius: 18, border: "none",
              cursor: filled && !sending ? "pointer" : "not-allowed",
              background: filled && !sending
                ? "linear-gradient(135deg, " + cfg.color + "dd, " + cfg.color + "88)"
                : "rgba(255,255,255,0.08)",
              color: filled && !sending ? "#fff" : "rgba(255,255,255,0.3)",
              fontSize: 16, fontWeight: 700,
              boxShadow: filled && !sending ? "0 6px 24px " + cfg.color + "44" : "none",
            }}
          >
            {sending ? "Envoi…" : "Tenter 🎯"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ── AttemptsList ──────────────────────────────────────────────────────────
function AttemptsList({ attempts, size, palettes }: { attempts: Attempt[]; size: number; palettes: typeof COLORS }) {
  if (attempts.length === 0) {
    return <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, textAlign: "center" }}>Aucun essai pour l'instant.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <AnimatePresence initial={false}>
        {attempts.map((a, idx) => {
          const isLast = idx === attempts.length - 1;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                ...glass,
                borderRadius: 16,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: isLast ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 700, minWidth: 24, textAlign: "right" }}>
                #{idx + 1}
              </span>
              <div style={{ display: "flex", gap: 6, flex: 1, justifyContent: "center" }}>
                {a.guess.map((g, i) => {
                  const c = palettes.find((p) => p.id === g);
                  return (
                    <div key={i} style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: c ? "radial-gradient(circle at 32% 30%, " + c.hex + "ff 0%, " + c.hex + "cc 55%)" : "rgba(255,255,255,0.15)",
                      boxShadow: c ? "0 0 8px " + c.hex + "44" : "none",
                      flexShrink: 0,
                    }} />
                  );
                })}
              </div>
              <Pegs black={a.black} white={a.white} total={size} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ── DareView ──────────────────────────────────────────────────────────────
function DareView({ state, room, mySlot, otherName, onDareDone, onBack }: {
  state: MMState; room: Room; mySlot: number; otherName: string; onDareDone: () => void; onBack: () => void;
}) {
  const winner = state.winner_slot ?? 0;
  const level  = (state.level ?? "easy") as Level;
  const cfg    = LEVELS[level];
  const idx    = typeof state.wheel_index === "number" ? state.wheel_index : 0;
  const dare   = state.dare_text ?? GAGES_RPS[level][idx % GAGES_RPS[level].length];

  if (winner === 0) {
    const replay = async () => {
      await patchState(room.id, {
        phase: "level_select", round: 1,
        level_1: null, level_2: null, level: null,
        code_1: null, code_2: null, attempts_1: [], attempts_2: [],
        found_1: null, found_2: null, tries_1: null, tries_2: null,
        winner_slot: null, wheel_index: null, dare_text: null,
      });
    };
    return (
      <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 14px" }}>
        <motion.div initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} style={{ fontSize: 72, marginBottom: 20 }}>🤝</motion.div>
        <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 32, color: "#fff", margin: "0 0 8px", textAlign: "center" }}>Égalité !</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, textAlign: "center", margin: "0 0 40px" }}>Pas de gage cette fois. On remet ça ?</p>
        {mySlot === 1 ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={replay}
            style={{ padding: "16px 48px", borderRadius: 18, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 16, fontWeight: 700 }}
          >
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

  const validate = async () => {
    onDareDone();
    await patchState(room.id, { phase: "done" });
  };

  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 20px", textAlign: "center" }}>
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

      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.09em", margin: "0 0 8px" }}>
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
          onClick={validate}
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
  state: MMState; mySlot: number; onReplay: () => void; onBack: () => void;
}) {
  const winner = state.winner_slot ?? 0;
  const iWon   = winner === mySlot;

  useEffect(() => {
    if (iWon) void confetti({ particleCount: 120, spread: 75, origin: { y: 0.5 }, colors: ["#4ade80", "#fbbf24", "#f43f5e", "#fff"] });
  }, [iWon]);

  return (
    <div style={{ background: BG, minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 20px", textAlign: "center" }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.25, 1] }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        style={{ fontSize: 80, marginBottom: 20 }}
      >
        {iWon ? "🏆" : "💖"}
      </motion.div>

      <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 32, color: "#fff", margin: "0 0 8px" }}>
        {iWon ? "Tu as gagné !" : "Bravo pour le gage 😘"}
      </h2>

      <div style={{ ...glass, borderRadius: 18, padding: "14px 24px", marginBottom: 36, display: "inline-block" }}>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, margin: 0 }}>
          Essais : <span style={{ color: "#fff", fontWeight: 700 }}>{state.tries_1 ?? "—"}</span> (J1) · <span style={{ color: "#fff", fontWeight: 700 }}>{state.tries_2 ?? "—"}</span> (J2)
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
            color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 500,
          }}
        >
          ← Retour au menu
        </button>
      </div>
    </div>
  );
}
