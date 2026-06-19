import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ── Gages par niveau (inchangés)
export const GAGES_RPS = {
  easy: [
    "Fais un bisou sur la joue de l'autre",
    "Dis 3 choses que tu adores chez l'autre",
    "Fais ton plus beau compliment, là, maintenant",
    "Fais un cœur avec tes mains et garde-le 10 secondes",
    "Imite l'autre pendant 10 secondes",
    "Raconte ton souvenir préféré de vous deux",
    "Fais un câlin de 20 secondes",
  ],
  medium: [
    "Chante le refrain de votre chanson",
    "Improvise une déclaration d'amour de 20 secondes",
    "Masse les épaules de l'autre pendant 1 minute",
    "Écris un petit poème pour l'autre en 1 minute",
    "Fais une imitation qui fait rire l'autre",
    "Danse 30 secondes (sans musique c'est encore mieux)",
    "Envoie un vocal trop mignon à l'autre",
  ],
  hard: [
    "Organise entièrement votre prochain rendez-vous",
    "Écris une lettre d'amour à lire plus tard",
    "Petit-déjeuner au lit garanti la prochaine fois",
    "Réalise un vœu (raisonnable) de l'autre",
    "Prépare une petite surprise pour cette semaine",
    "Fais une déclaration filmée de 30 secondes",
    "Laisse l'autre choisir ce qu'on fait ce week-end",
  ],
} as const;

type Level  = "easy" | "medium" | "hard";
type Choice = "rock" | "paper" | "scissors";

// ── Design constants
const BG      = "linear-gradient(160deg, oklch(0.11 0.07 280) 0%, oklch(0.08 0.05 270) 100%)";
const VIOLET  = "#c084fc";
const CYAN_C  = "#67e8f9";
const EMERALD = "#4ade80";
const AMBER   = "#fbbf24";
const FIRE    = "#f87171";
const GOLD    = "#fbbf24";

const LEVEL_CFG: Record<Level, { label: string; emoji: string; color: string; glow: string; desc: string }> = {
  easy:   { label: "Facile",  emoji: "🌿", color: EMERALD, glow: "#4ade8055", desc: "Gages tout doux" },
  medium: { label: "Moyen",   emoji: "✨", color: AMBER,   glow: "#fbbf2455", desc: "Gages corsés"    },
  hard:   { label: "Hard",    emoji: "🔥", color: FIRE,    glow: "#f8717155", desc: "Gages intenses"  },
};

const CHOICES: { id: Choice; label: string; emoji: string }[] = [
  { id: "rock",     label: "Pierre",  emoji: "✊" },
  { id: "paper",    label: "Feuille", emoji: "✋" },
  { id: "scissors", label: "Ciseaux", emoji: "✌️" },
];

function rpsWinner(c1: Choice, c2: Choice): 0 | 1 | 2 {
  if (c1 === c2) return 0;
  if ((c1==="rock"&&c2==="scissors")||(c1==="paper"&&c2==="rock")||(c1==="scissors"&&c2==="paper")) return 1;
  return 2;
}

// ── State
type State = {
  phase?:      "level_select" | "play" | "reveal" | "dare" | "done";
  level_1?:    Level | null;
  level_2?:    Level | null;
  level?:      Level | null;
  choice_1?:   Choice | null;
  choice_2?:   Choice | null;
  sent_1?:     boolean;
  sent_2?:     boolean;
  winner_slot?: 0 | 1 | 2 | null;
  wheel_index?: number | null;
  dare_text?:   string | null;
};

type Props = {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
  onDareDone: () => void;
};

const patch = (roomId: string, p: State) =>
  supabase.rpc("minigame_patch", { _room_id: roomId, _patch: p });

// ── Ambient orb
function Orb({ x, y, color, size, delay }: { x: string; y: string; color: string; size: number; delay: number }) {
  return (
    <motion.div
      style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", width: size, height: size, borderRadius: "50%", background: color, filter: "blur(60px)", opacity: 0, pointerEvents: "none" }}
      animate={{ opacity: [0, 0.18, 0] }}
      transition={{ delay, duration: 5, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
    />
  );
}

// ── Root
export function RPSExtreme({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s = (room.minigame_state ?? {}) as State;
  const phase = s.phase ?? "level_select";

  useEffect(() => {
    if (Object.keys(s).length === 0 && mySlot === 1)
      void patch(room.id, { phase: "level_select" });
  }, [room.id, s, mySlot]);

  const replayProps = {
    onReplay: async () => {
      await patch(room.id, {
        phase: "level_select",
        level_1: null, level_2: null, level: null,
        choice_1: null, choice_2: null, sent_1: false, sent_2: false,
        winner_slot: null, wheel_index: null, dare_text: null,
      });
    },
  };

  if (phase === "level_select")
    return <LevelSelect state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onBackToMenu={onBackToMenu} />;
  if (phase === "play")
    return <PlayRound state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  if (phase === "reveal")
    return <RevealView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  if (phase === "dare")
    return <DareView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onDareDone={onDareDone} />;
  return <DoneView state={s} mySlot={mySlot} myName={myName} otherName={otherName} onBackToMenu={onBackToMenu} {...replayProps} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// LevelSelect
// ─────────────────────────────────────────────────────────────────────────────
function LevelSelect({ state, room, mySlot, myName, otherName, onBackToMenu }:
  { state: State; room: Room; mySlot: number; myName: string; otherName: string; onBackToMenu: () => void }) {
  const mine   = mySlot === 1 ? state.level_1 : state.level_2;
  const theirs = mySlot === 1 ? state.level_2 : state.level_1;
  const match  = state.level_1 && state.level_2 && state.level_1 === state.level_2;

  const choose = (l: Level) =>
    patch(room.id, mySlot === 1 ? { level_1: l } : { level_2: l });

  const start = () => {
    if (!match) return;
    patch(room.id, {
      phase: "play", level: state.level_1 ?? null,
      choice_1: null, choice_2: null, sent_1: false, sent_2: false,
      winner_slot: null, wheel_index: null, dare_text: null,
    });
  };

  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: "Work Sans, sans-serif", padding: "0 24px" }}>
      <Orb x="20%" y="25%" color={VIOLET} size={300} delay={0} />
      <Orb x="80%" y="75%" color={CYAN_C} size={240} delay={1.5} />

      <motion.button whileTap={{ scale: 0.92 }} onClick={onBackToMenu}
        style={{ position: "absolute", top: 24, left: 20, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "8px 16px", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer" }}>
        ← Retour
      </motion.button>

      <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 0, zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 2.5 }}
            style={{ fontSize: 52, marginBottom: 10 }}>✊✋✌️</motion.div>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 34, fontWeight: 700, color: "#fff", margin: "0 0 6px", textShadow: `0 0 28px ${VIOLET}88` }}>
            Pierre · Feuille · Ciseaux
          </h1>
          <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 13, margin: 0 }}>
            Le perdant fait un gage 😈 · Choisissez le niveau ensemble
          </p>
        </div>

        {/* Level cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(Object.keys(LEVEL_CFG) as Level[]).map((l) => {
            const cfg = LEVEL_CFG[l];
            const iPicked     = mine === l;
            const theyPicked  = theirs === l;
            return (
              <motion.button key={l} whileTap={{ scale: 0.96 }} onClick={() => choose(l)}
                style={{
                  padding: "18px 20px", borderRadius: 18, cursor: "pointer", textAlign: "left",
                  background: iPicked ? `${cfg.glow}` : "rgba(255,255,255,0.04)",
                  border: `2px solid ${iPicked ? cfg.color : "rgba(255,255,255,0.10)"}`,
                  boxShadow: iPicked ? `0 0 24px ${cfg.glow}, 0 0 8px ${cfg.glow}` : "none",
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: 16,
                }}>
                <span style={{ fontSize: 34 }}>{cfg.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22, fontWeight: 700, color: iPicked ? cfg.color : "#fff" }}>{cfg.label}</span>
                    {iPicked    && <span style={{ fontSize: 11, background: `${cfg.color}33`, color: cfg.color, borderRadius: 20, padding: "2px 10px", fontWeight: 600 }}>Toi ✓</span>}
                    {theyPicked && <span style={{ fontSize: 11, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", borderRadius: 20, padding: "2px 10px", fontWeight: 600 }}>{otherName} ✓</span>}
                  </div>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>{cfg.desc}</p>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${iPicked ? cfg.color : "rgba(255,255,255,0.2)"}`, background: iPicked ? cfg.color : "transparent", flexShrink: 0, transition: "all 0.2s" }} />
              </motion.button>
            );
          })}
        </div>

        {/* Status + start */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 16 }}>
            {[{ name: myName, level: mine }, { name: otherName, level: theirs }].map((p, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: p.level ? LEVEL_CFG[p.level].color : "rgba(255,255,255,0.25)" }}>
                  {p.level ? LEVEL_CFG[p.level].emoji + " " + LEVEL_CFG[p.level].label : "—"}
                </div>
              </div>
            ))}
          </div>

          {state.level_1 && state.level_2 && !match && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: "center", fontSize: 13, color: FIRE, marginBottom: 12 }}>
              Pas d'accord — choisissez le même niveau 😅
            </motion.p>
          )}

          <motion.button whileTap={{ scale: 0.94 }} onClick={start} disabled={!match}
            style={{
              width: "100%", padding: "16px", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: match ? "pointer" : "not-allowed",
              border: match ? `1.5px solid ${VIOLET}99` : "1.5px solid rgba(255,255,255,0.1)",
              background: match ? `linear-gradient(135deg, ${VIOLET}33, ${VIOLET}11)` : "rgba(255,255,255,0.04)",
              color: match ? VIOLET : "rgba(255,255,255,0.3)",
              boxShadow: match ? `0 0 28px ${VIOLET}44` : "none",
              transition: "all 0.3s",
            }}>
            {match ? "C'est parti ! 🎮" : "En attente…"}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PlayRound
// ─────────────────────────────────────────────────────────────────────────────
function PlayRound({ state, room, mySlot, myName, otherName }:
  { state: State; room: Room; mySlot: number; myName: string; otherName: string }) {
  const myChoice    = (mySlot === 1 ? state.choice_1 : state.choice_2) ?? null;
  const otherChoice = (mySlot === 1 ? state.choice_2 : state.choice_1) ?? null;
  const mySent      = mySlot === 1 ? !!state.sent_1 : !!state.sent_2;
  const otherSent   = mySlot === 1 ? !!state.sent_2 : !!state.sent_1;
  const bothSent    = !!state.sent_1 && !!state.sent_2;
  const level       = (state.level ?? "easy") as Level;
  const cfg         = LEVEL_CFG[level];
  const myColor     = mySlot === 1 ? VIOLET : CYAN_C;
  const otherColor  = mySlot === 1 ? CYAN_C : VIOLET;

  const [picking, setPicking] = useState<Choice | null>(myChoice);
  const sentRef = useRef(false);
  useEffect(() => { setPicking(myChoice); }, [myChoice]);

  const pick = async (c: Choice) => {
    if (mySent) return;
    setPicking(c);
    await patch(room.id, mySlot === 1 ? { choice_1: c } : { choice_2: c });
  };

  const send = async () => {
    if (mySent || !picking || sentRef.current) return;
    sentRef.current = true;
    const p = mySlot === 1 ? { choice_1: picking, sent_1: true } : { choice_2: picking, sent_2: true };
    await patch(room.id, p);
  };

  // Host resolves when both sent
  useEffect(() => {
    if (!bothSent || state.phase !== "play" || mySlot !== 1) return;
    const c1 = state.choice_1 as Choice;
    const c2 = state.choice_2 as Choice;
    const w = rpsWinner(c1, c2);
    const lvl = (state.level ?? "easy") as Level;
    const idx = w !== 0 ? Math.floor(Math.random() * GAGES_RPS[lvl].length) : null;
    const dare = idx !== null ? GAGES_RPS[lvl][idx] : null;
    const t = setTimeout(() => {
      void patch(room.id, {
        phase: "reveal",
        winner_slot: w,
        ...(idx !== null ? { wheel_index: idx, dare_text: dare } : {}),
      });
    }, 300);
    return () => clearTimeout(t);
  }, [bothSent, state.phase, mySlot, state.choice_1, state.choice_2, state.level, room.id]);

  // Fallback poll
  useEffect(() => {
    if (state.phase !== "play" || !mySent) return;
    const t = setInterval(async () => {
      const { data } = await supabase.from("rooms").select("minigame_state").eq("id", room.id).maybeSingle();
      const ms = (data?.minigame_state ?? {}) as State;
      if (ms.sent_1 && ms.sent_2 && (ms.phase === "play" || !ms.phase) && mySlot === 1) {
        const c1 = ms.choice_1 as Choice;
        const c2 = ms.choice_2 as Choice;
        const w = rpsWinner(c1, c2);
        const lvl = (ms.level ?? "easy") as Level;
        const idx = w !== 0 ? Math.floor(Math.random() * GAGES_RPS[lvl].length) : null;
        const dare = idx !== null ? GAGES_RPS[lvl][idx] : null;
        void patch(room.id, {
          phase: "reveal", winner_slot: w,
          ...(idx !== null ? { wheel_index: idx, dare_text: dare } : {}),
        });
        clearInterval(t);
      } else if (ms.phase && ms.phase !== "play") {
        clearInterval(t);
      }
    }, 1800);
    return () => clearInterval(t);
  }, [state.phase, mySent, mySlot, room.id]);

  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", fontFamily: "Work Sans, sans-serif", padding: "0 20px 32px" }}>
      <Orb x="15%" y="20%" color={myColor}    size={260} delay={0}   />
      <Orb x="85%" y="80%" color={otherColor} size={220} delay={1.5} />

      {/* Level badge */}
      <div style={{ paddingTop: 52, textAlign: "center", zIndex: 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${cfg.glow}`, border: `1.5px solid ${cfg.color}66`, borderRadius: 30, padding: "6px 18px" }}>
          <span>{cfg.emoji}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>Niveau {cfg.label}</span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 6 }}>
          Pierre · Feuille · Ciseaux
        </p>
      </div>

      {/* Players status */}
      <div style={{ display: "flex", gap: 12, marginTop: 20, zIndex: 1 }}>
        {[
          { name: myName,    color: myColor,    sent: mySent,    choice: picking,     label: "Toi" },
          { name: otherName, color: otherColor, sent: otherSent, choice: otherChoice, label: "Lui/Elle" },
        ].map((p, i) => (
          <div key={i} style={{
            flex: 1, borderRadius: 18, padding: "16px 12px", textAlign: "center",
            background: p.sent ? `${p.color}18` : "rgba(255,255,255,0.04)",
            border: `1.5px solid ${p.sent ? p.color + "88" : "rgba(255,255,255,0.09)"}`,
            transition: "all 0.3s",
          }}>
            <div style={{ fontSize: 11, color: p.color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{p.name}</div>
            <motion.div
              animate={p.sent && !bothSent ? { scale: [1, 1.04, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.2 }}
              style={{ fontSize: 40, lineHeight: 1 }}>
              {p.sent
                ? "🔒"
                : i === 0 && p.choice
                  ? CHOICES.find(c => c.id === p.choice)!.emoji
                  : "💭"}
            </motion.div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", marginTop: 6 }}>
              {p.sent ? "Envoyé ✓" : i === 0 ? (p.choice ? "Prêt à envoyer" : "Choisis…") : `Réfléchit…`}
            </div>
          </div>
        ))}
      </div>

      {/* Choice buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 22, zIndex: 1 }}>
        {CHOICES.map((c) => {
          const sel = picking === c.id;
          return (
            <motion.button key={c.id} whileTap={{ scale: 0.92 }}
              disabled={mySent}
              onClick={() => pick(c.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "20px 8px", borderRadius: 20, cursor: mySent ? "not-allowed" : "pointer",
                background: sel ? `${myColor}22` : "rgba(255,255,255,0.04)",
                border: `2px solid ${sel ? myColor : "rgba(255,255,255,0.10)"}`,
                boxShadow: sel ? `0 0 24px ${myColor}55, 0 0 8px ${myColor}33` : "none",
                transition: "all 0.2s",
                opacity: mySent && picking !== c.id ? 0.35 : 1,
              }}>
              <motion.span
                animate={sel ? { scale: [1, 1.12, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                style={{ fontSize: 44, display: "block" }}>
                {c.emoji}
              </motion.span>
              <span style={{ fontSize: 12, fontWeight: 600, color: sel ? myColor : "rgba(255,255,255,0.5)", marginTop: 8 }}>
                {c.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Status message + send */}
      <div style={{ marginTop: "auto", paddingTop: 20, zIndex: 1 }}>
        <AnimatePresence mode="wait">
          {bothSent ? (
            <motion.div key="both" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: "center", marginBottom: 14 }}>
              <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1 }}
                style={{ color: cfg.color, fontSize: 14, fontWeight: 600 }}>
                Révélation imminente… ⚡
              </motion.p>
            </motion.div>
          ) : mySent ? (
            <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ textAlign: "center", marginBottom: 14 }}>
              <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.4 }}
                style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
                En attente de {otherName}…
              </motion.p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.button whileTap={{ scale: 0.95 }} onClick={send}
          disabled={!picking || mySent}
          style={{
            width: "100%", padding: "16px", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: !picking || mySent ? "not-allowed" : "pointer",
            border: picking && !mySent ? `1.5px solid ${myColor}99` : "1.5px solid rgba(255,255,255,0.1)",
            background: picking && !mySent ? `linear-gradient(135deg, ${myColor}33, ${myColor}11)` : "rgba(255,255,255,0.04)",
            color: picking && !mySent ? myColor : "rgba(255,255,255,0.3)",
            boxShadow: picking && !mySent ? `0 0 28px ${myColor}44` : "none",
            transition: "all 0.3s",
          }}>
          {mySent ? (otherSent ? "Révélation…" : `En attente de ${otherName}…`) : picking ? "ENVOYER ✊" : "Choisis d'abord"}
        </motion.button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RevealView — shake 1-2-3 + dramatic reveal
// ─────────────────────────────────────────────────────────────────────────────
function RevealView({ state, room, mySlot, myName, otherName }:
  { state: State; room: Room; mySlot: number; myName: string; otherName: string }) {
  const c1       = state.choice_1 as Choice | null;
  const c2       = state.choice_2 as Choice | null;
  const winner   = state.winner_slot ?? 0;
  const level    = (state.level ?? "easy") as Level;
  const cfg      = LEVEL_CFG[level];
  const myColor  = mySlot === 1 ? VIOLET : CYAN_C;
  const othColor = mySlot === 1 ? CYAN_C : VIOLET;

  const myChoice    = mySlot === 1 ? c1 : c2;
  const otherChoice = mySlot === 1 ? c2 : c1;
  const iWon        = winner === mySlot;
  const isTie       = winner === 0;

  const [step, setStep]       = useState<"shake" | "reveal">("shake");
  const [shakeNum, setShakeNum] = useState(3);

  // Countdown 3→2→1 then reveal
  useEffect(() => {
    let n = 3;
    setShakeNum(n);
    const iv = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(iv);
        setStep("reveal");
      } else {
        setShakeNum(n);
      }
    }, 700);
    return () => clearInterval(iv);
  }, []);

  // Host transitions after reveal
  useEffect(() => {
    if (step !== "reveal" || mySlot !== 1) return;
    if (isTie) {
      const t = setTimeout(() => {
        void patch(room.id, {
          phase: "play",
          choice_1: null, choice_2: null, sent_1: false, sent_2: false,
        });
      }, 2200);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        void patch(room.id, { phase: "dare" });
      }, 2800);
      return () => clearTimeout(t);
    }
  }, [step, mySlot, isTie, room.id]);

  if (step === "shake") {
    return (
      <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: "Work Sans, sans-serif" }}>
        <Orb x="50%" y="50%" color={VIOLET} size={400} delay={0} />
        <motion.div
          animate={{ y: [0, -20, 0], rotate: [-5, 5, -5] }}
          transition={{ repeat: Infinity, duration: 0.4, ease: "easeInOut" }}
          style={{ fontSize: 80, userSelect: "none" }}>✊</motion.div>
        <AnimatePresence mode="wait">
          <motion.div key={shakeNum}
            initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 100, fontWeight: 700, color: "#fff", marginTop: 16, textShadow: `0 0 40px ${VIOLET}` }}>
            {shakeNum}
          </motion.div>
        </AnimatePresence>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 8, letterSpacing: 2 }}>
          SHOOT…
        </p>
      </div>
    );
  }

  // Reveal step
  const myEmoji    = myChoice    ? CHOICES.find(c => c.id === myChoice)!.emoji    : "❔";
  const otherEmoji = otherChoice ? CHOICES.find(c => c.id === otherChoice)!.emoji : "❔";

  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: "Work Sans, sans-serif", padding: "0 24px" }}>
      <Orb x="20%" y="30%" color={myColor}  size={280} delay={0} />
      <Orb x="80%" y="70%" color={othColor} size={240} delay={0.5} />

      {/* Title */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ textAlign: "center", marginBottom: 32, zIndex: 1 }}>
        <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 38, fontWeight: 700, color: "#fff" }}>
          {isTie ? "Égalité ! 🤝" : iWon ? "Tu gagnes ! 🏆" : `${otherName} gagne !`}
        </div>
        {isTie && <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 6 }}>On rejoue dans un instant…</p>}
      </motion.div>

      {/* Both choices */}
      <div style={{ display: "flex", gap: 20, zIndex: 1, width: "100%", maxWidth: 320 }}>
        {[
          { name: myName,    emoji: myEmoji,    color: myColor,  won: iWon,   },
          { name: otherName, emoji: otherEmoji, color: othColor, won: !iWon && !isTie },
        ].map((p, i) => (
          <motion.div key={i}
            initial={{ scale: 0.4, opacity: 0, x: i === 0 ? -40 : 40 }}
            animate={{ scale: p.won ? 1.1 : isTie ? 1 : 0.88, opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 + i * 0.1 }}
            style={{
              flex: 1, padding: "24px 12px", borderRadius: 24, textAlign: "center",
              background: p.won ? `${p.color}22` : "rgba(255,255,255,0.04)",
              border: `2px solid ${p.won ? p.color : (isTie ? p.color + "66" : "rgba(255,255,255,0.08)")}`,
              boxShadow: p.won ? `0 0 40px ${p.color}66` : "none",
              transition: "all 0.3s",
            }}>
            <div style={{ fontSize: 12, color: p.color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>{p.name}</div>
            <div style={{ fontSize: 60 }}>{p.emoji}</div>
            {p.won && !isTie && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: "spring" }}
                style={{ marginTop: 10, fontSize: 24 }}>🏆</motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Result banner */}
      {!isTie && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          style={{ marginTop: 28, textAlign: "center", zIndex: 1 }}>
          <div style={{ background: iWon ? `${myColor}22` : "rgba(255,255,255,0.06)", border: `1px solid ${iWon ? myColor + "55" : "rgba(255,255,255,0.1)"}`, borderRadius: 16, padding: "12px 24px" }}>
            <p style={{ color: iWon ? myColor : "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: 600, margin: 0 }}>
              {iWon ? "Le gage attend l'autre… 😈" : "Ton gage arrive… 😬"}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DareView
// ─────────────────────────────────────────────────────────────────────────────
function DareView({ state, room, mySlot, myName, otherName, onDareDone }:
  { state: State; room: Room; mySlot: number; myName: string; otherName: string; onDareDone: () => void }) {
  const winner = state.winner_slot ?? 0;
  const loser  = winner === 1 ? 2 : 1;
  const iLost  = mySlot === loser;
  const dare   = state.dare_text ?? "…";
  const level  = (state.level ?? "easy") as Level;
  const cfg    = LEVEL_CFG[level];

  const validate = async () => {
    onDareDone();
    await patch(room.id, { phase: "done" });
  };

  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: "Work Sans, sans-serif", padding: "0 28px" }}>
      <Orb x="30%" y="40%" color={cfg.color} size={350} delay={0} />

      <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}
        style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", alignItems: "center", gap: 0, zIndex: 1 }}>

        {/* Level badge */}
        <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 2.5 }}
          style={{ fontSize: 64, marginBottom: 16 }}>{cfg.emoji}</motion.div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${cfg.glow}`, border: `1.5px solid ${cfg.color}88`, borderRadius: 30, padding: "6px 18px", marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
        </div>

        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, margin: "0 0 10px" }}>
          {iLost ? "Ton gage, " + myName : `Gage pour ${otherName}`}
        </p>

        {/* Dare card */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}
          style={{
            width: "100%", padding: "28px 24px", borderRadius: 24, textAlign: "center",
            background: `linear-gradient(145deg, ${cfg.glow}, rgba(255,255,255,0.04))`,
            border: `2px solid ${cfg.color}66`,
            boxShadow: `0 0 48px ${cfg.glow}`,
            marginBottom: 28,
          }}>
          <p style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1.4, margin: 0 }}>
            {dare}
          </p>
        </motion.div>

        {iLost ? (
          <motion.button whileTap={{ scale: 0.94 }} onClick={validate}
            style={{ width: "100%", padding: "16px", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${cfg.color}99`, background: `linear-gradient(135deg, ${cfg.glow}, transparent)`, color: cfg.color, boxShadow: `0 0 24px ${cfg.glow}` }}>
            C'est fait ! ✅
          </motion.button>
        ) : (
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.6 }}
            style={{ color: "rgba(255,255,255,0.38)", fontSize: 14, textAlign: "center" }}>
            On attend que {otherName} fasse son gage… 🥹
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DoneView
// ─────────────────────────────────────────────────────────────────────────────
function DoneView({ state, mySlot, myName, otherName, onReplay, onBackToMenu }:
  { state: State; mySlot: number; myName: string; otherName: string; onReplay: () => void; onBackToMenu: () => void }) {
  const winner = state.winner_slot ?? 0;
  const iWon   = winner === mySlot;

  useEffect(() => {
    if (iWon) {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.55 }, colors: [VIOLET, CYAN_C, GOLD, "#fff"] });
    }
  }, [iWon]);

  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", fontFamily: "Work Sans, sans-serif", padding: "0 28px" }}>
      <Orb x="25%" y="30%" color={iWon ? GOLD : VIOLET} size={320} delay={0} />
      <Orb x="75%" y="70%" color={CYAN_C} size={240} delay={1} />

      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
        style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", alignItems: "center", gap: 0, zIndex: 1, textAlign: "center" }}>

        <motion.div animate={{ rotate: [0, -10, 10, -6, 6, 0], scale: [1, 1.15, 1] }} transition={{ delay: 0.5, duration: 1.2 }}
          style={{ fontSize: 80, marginBottom: 16 }}>
          {iWon ? "🏆" : "💖"}
        </motion.div>

        <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 40, fontWeight: 700, color: "#fff", margin: "0 0 8px", textShadow: iWon ? `0 0 30px ${GOLD}88` : "none" }}>
          {iWon ? "Bravo champion·ne !" : "Bravo pour le gage 😘"}
        </h1>
        <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 14, margin: "0 0 32px" }}>
          {iWon ? `${otherName} va faire son gage 😈` : "Tu montes en complicité 💞"}
        </p>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <motion.button whileTap={{ scale: 0.94 }} onClick={onReplay}
            style={{ padding: "15px", borderRadius: 14, border: `1.5px solid ${VIOLET}99`, background: `linear-gradient(135deg, ${VIOLET}33, ${VIOLET}11)`, color: VIOLET, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: `0 0 24px ${VIOLET}33` }}>
            Rejouer 🔁
          </motion.button>
          <motion.button whileTap={{ scale: 0.94 }} onClick={onBackToMenu}
            style={{ padding: "13px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.13)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            ← Retour au menu
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
