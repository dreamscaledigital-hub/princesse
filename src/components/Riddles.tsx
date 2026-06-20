import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";
import { GAGES_BY_LEVEL, getGagesPool, LEVEL_LABELS, type DareLevel } from "@/lib/game-content";
import { markItemsUsed, nonRepeatingSample, pickNonRepeating } from "@/lib/non-repeating";

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

// ─────────── Réglages ───────────
const NB_RIDDLES       = 6;
const ROUND_DURATION_MS = 35_000;

// ─────────── Devinettes simplifiées ───────────
const RIDDLES: { q: string; answers: string[] }[] = [
  { q: "Plus on en enlève, plus il devient grand. Qu'est-ce ?",
    answers: ["trou", "un trou"] },
  { q: "J'ai un cou mais pas de tête. Qui suis-je ?",
    answers: ["bouteille", "une bouteille"] },
  { q: "Qu'est-ce qui se casse dès qu'on le dit ?",
    answers: ["silence", "le silence"] },
  { q: "Plus je sèche, plus je suis mouillée. Qui suis-je ?",
    answers: ["serviette", "une serviette", "la serviette"] },
  { q: "Qu'est-ce qui monte mais ne redescend jamais ?",
    answers: ["age", "l age", "l'age", "lage"] },
  { q: "Je cours sans jambes, j'ai un lit mais je ne dors pas. Qui suis-je ?",
    answers: ["riviere", "la riviere", "une riviere", "fleuve", "un fleuve"] },
  { q: "Plus tu me partages, plus je grandis. Qu'est-ce ?",
    answers: ["amour", "l'amour", "lamour", "bonheur", "le bonheur", "joie"] },
  { q: "Ton prénom t'appartient, mais les autres l'utilisent plus que toi. Qu'est-ce ?",
    answers: ["prenom", "mon prenom", "ton prenom", "nom", "mon nom", "ton nom"] },
  { q: "J'ai des villes sans maisons, des forêts sans arbres. Qui suis-je ?",
    answers: ["carte", "une carte", "plan", "carte geographique"] },
  { q: "Le matin 4 pattes, le midi 2, le soir 3. Qui suis-je ?",
    answers: ["homme", "l'homme", "lhomme", "humain", "etre humain", "femme"] },
  { q: "Qu'est-ce qu'on peut attraper mais jamais lancer ?",
    answers: ["rhume", "un rhume"] },
  { q: "J'ai des dents mais je ne mords jamais. Qui suis-je ?",
    answers: ["peigne", "un peigne", "scie", "une scie", "fourchette", "une fourchette"] },
  { q: "Je suis toujours devant toi, mais on ne me voit jamais. Qu'est-ce ?",
    answers: ["futur", "le futur", "avenir", "l'avenir"] },
  { q: "Je parle toutes les langues sans en avoir appris une. Qui suis-je ?",
    answers: ["echo", "un echo", "l'echo"] },
  { q: "On me jette quand on en a besoin, on me reprend quand on n'en a plus besoin. Qu'est-ce ?",
    answers: ["ancre", "une ancre"] },
  { q: "Qu'est-ce qui a une tête et une queue mais pas de corps ?",
    answers: ["piece", "une piece", "monnaie", "piece de monnaie"] },
  { q: "Plus je suis grande, moins on me voit. Qu'est-ce ?",
    answers: ["obscurite", "nuit", "la nuit", "noirceur", "l'obscurite", "tenebres"] },
  { q: "Légère comme une plume, mais même les plus forts ne peuvent pas me tenir longtemps. Qu'est-ce ?",
    answers: ["souffle", "haleine", "respiration", "le souffle", "son souffle"] },
  { q: "Je suis plein quand je suis jeune et vide quand je suis vieux. Qu'est-ce ?",
    answers: ["sablier", "un sablier"] },
  { q: "On m'enlève les habits et je fais pleurer. Qui suis-je ?",
    answers: ["oignon", "un oignon"] },
];

const LEVEL_CFG: Record<DareLevel, { color: string; glow: string; desc: string; emoji: string }> = {
  simple: { color: EMERALD, glow: `${EMERALD}44`, desc: "Gages doux et mignons",   emoji: "🌿" },
  medium: { color: AMBER,   glow: `${AMBER}44`,   desc: "Un peu plus piquant",     emoji: "⚡" },
  ultra:  { color: ROSE,    glow: `${ROSE}44`,    desc: "Hot et sans tabou",        emoji: "🔥" },
};

// ─────────── Types ───────────
type TPhase = "level_select" | "play" | "result" | "dare" | "done";
type FirstCorrect = { slot: 1 | 2; ts: number; text: string } | null;
type Override = "winner_1" | "winner_2" | "none" | null;

type RState = {
  game?: "riddles";
  phase?: TPhase;
  level_1?: DareLevel | null;
  level_2?: DareLevel | null;
  level?: DareLevel | null;
  order?: number[];
  index?: number;
  started_at?: number | null;
  attempt_1?: { text: string; ok: boolean; ts: number } | null;
  attempt_2?: { text: string; ok: boolean; ts: number } | null;
  first_correct?: FirstCorrect;
  round_done?: boolean;
  override?: Override;
  score_1?: number;
  score_2?: number;
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

type SharedProps = { state: RState; room: Room; mySlot: number; myName: string; otherName: string };

// ─────────── Utils ───────────
function normalize(s: string) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function checkAnswer(text: string, answers: string[]) {
  const n = normalize(text);
  return !!n && answers.some((a) => normalize(a) === n);
}

function freshReset(): RState {
  return {
    game: "riddles", phase: "level_select",
    level_1: null, level_2: null, level: null,
    order: [], index: 0, started_at: null,
    attempt_1: null, attempt_2: null,
    first_correct: null, round_done: false, override: null,
    score_1: 0, score_2: 0,
    winner_slot: null, wheel_index: null, dare_text: null,
  };
}

async function patchState(roomId: string, partial: Record<string, unknown>) {
  await supabase.rpc("minigame_patch", { _room_id: roomId, _patch: partial });
}

async function dbUpdate(roomId: string, state: RState) {
  await supabase.from("rooms").update({ minigame_state: state }).eq("id", roomId);
}

// ─────────── Riddles ───────────
export function Riddles({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s     = (room.minigame_state ?? {}) as RState;
  const phase = s.phase ?? "level_select";

  useEffect(() => {
    if ((Object.keys(s).length === 0 || s.game !== "riddles") && mySlot === 1) {
      void dbUpdate(room.id, freshReset());
    }
  }, [room.id, s, mySlot]);

  const shared: SharedProps = { state: s, room, mySlot, myName, otherName };

  return (
    <div style={{
      minHeight: "100dvh", background: BG,
      display: "flex", flexDirection: "column",
      padding: "14px 14px 28px", gap: 12,
      fontFamily: "'Inter', system-ui, sans-serif", color: "#fff",
      touchAction: "manipulation",
    }}>
      {phase === "level_select"              && <LevelSelect {...shared} />}
      {(phase === "play" || phase === "result") && <PlayView    {...shared} />}
      {phase === "dare"                      && <DareView  {...shared} onDareDone={onDareDone} />}
      {phase === "done"                      && (
        <DoneView
          {...shared}
          onReplay={async () => { await dbUpdate(room.id, freshReset()); }}
          onBackToMenu={onBackToMenu}
        />
      )}
    </div>
  );
}

// ─────────── Choix du niveau ───────────
function LevelSelect({ state, room, mySlot, myName, otherName }: SharedProps) {
  const mine   = mySlot === 1 ? state.level_1 : state.level_2;
  const theirs = mySlot === 1 ? state.level_2 : state.level_1;
  const both   = !!(state.level_1 && state.level_2);
  const match  = both && state.level_1 === state.level_2;

  const choose = async (l: DareLevel) => {
    await patchState(room.id, mySlot === 1 ? { level_1: l } : { level_2: l });
  };

  const start = async () => {
    if (!match || mySlot !== 1) return;
    const chosen = state.level_1 as DareLevel;
    const picked = nonRepeatingSample(RIDDLES, Math.min(NB_RIDDLES, RIDDLES.length), `riddles:${chosen}`, (r) => r.q);
    markItemsUsed(`riddles:${chosen}`, picked, (r) => r.q);
    const idxs = picked.map((r) => RIDDLES.indexOf(r));
    await patchState(room.id, {
      phase: "play", level: chosen, order: idxs, index: 0,
      started_at: Date.now(),
      attempt_1: null, attempt_2: null,
      first_correct: null, round_done: false, override: null,
      score_1: 0, score_2: 0,
    });
  };

  const chosenLevel = (mine ?? "medium") as DareLevel;

  return (
    <>
      <div style={{ textAlign: "center", paddingTop: 6 }}>
        <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 3, color: "rgba(255,255,255,0.32)", margin: 0 }}>
          Duel de devinettes 🧩
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: 34, fontStyle: "italic", color: "#fff", margin: "4px 0 0", lineHeight: 1 }}>
          Énigmes à <em>deux</em>
        </h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 6, marginBottom: 0 }}>
          {NB_RIDDLES} devinettes · premier à répondre gagne le point
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
        {(Object.keys(LEVEL_CFG) as DareLevel[]).map((l, idx) => {
          const cfg      = LEVEL_CFG[l];
          const iPicked  = mine === l;
          const theyPick = theirs === l;
          return (
            <motion.button
              key={l}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.07 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => choose(l)}
              style={{
                ...glass,
                padding: "16px 18px", borderRadius: 18,
                border: iPicked ? `2px solid ${cfg.color}` : "1px solid rgba(255,255,255,0.09)",
                background: iPicked ? `${cfg.color}12` : "rgba(255,255,255,0.04)",
                boxShadow: iPicked ? `0 0 22px ${cfg.glow}` : "none",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left",
              }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                background: `${cfg.color}18`, border: `2px solid ${cfg.color}55`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, boxShadow: iPicked ? `0 0 14px ${cfg.glow}` : "none",
              }}>
                {cfg.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: SERIF, fontSize: 22, fontStyle: "italic", color: cfg.color, margin: 0, textShadow: iPicked ? `0 0 14px ${cfg.color}88` : "none" }}>
                  {LEVEL_LABELS[l]}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.38)", margin: "3px 0 0" }}>{cfg.desc}</p>
                {(iPicked || theyPick) && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {iPicked  && <span style={{ fontSize: 10, background: `${cfg.color}20`, border: `1px solid ${cfg.color}55`, color: cfg.color, borderRadius: 20, padding: "2px 8px" }}>Toi ✓</span>}
                    {theyPick && <span style={{ fontSize: 10, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", borderRadius: 20, padding: "2px 8px" }}>{otherName} ✓</span>}
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <div style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.40)" }}>
        <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{myName}</span> : {mine ? LEVEL_LABELS[mine] : "—"}
        {" · "}
        <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{otherName}</span> : {theirs ? LEVEL_LABELS[theirs as DareLevel] : "—"}
      </div>
      {both && !match && <p style={{ textAlign: "center", fontSize: 13, color: ROSE, margin: 0 }}>Mettez-vous d'accord 😅</p>}

      <div style={{ marginTop: "auto", paddingTop: 6 }}>
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={!match || mySlot !== 1}
          onClick={start}
          style={{
            width: "100%", height: 56, borderRadius: 18, border: "none",
            background: match ? `linear-gradient(135deg, ${LEVEL_CFG[chosenLevel].color}, ${SKY})` : "rgba(255,255,255,0.07)",
            color: match ? "#0d0d0d" : "rgba(255,255,255,0.25)",
            fontWeight: 700, fontSize: 17,
            cursor: match && mySlot === 1 ? "pointer" : "not-allowed",
            boxShadow: match ? `0 0 30px ${LEVEL_CFG[chosenLevel].glow}` : "none",
            transition: "all 0.3s",
          }}
        >
          {match ? (mySlot === 1 ? "C'est parti 🧩" : `${otherName} démarre…`) : "En attente du niveau commun…"}
        </motion.button>
      </div>
    </>
  );
}

// ─────────── ScoreDots ───────────
function ScoreDots({ score, total, color, reverse = false }: { score: number; total: number; color: string; reverse?: boolean }) {
  const dots = Array.from({ length: total }, (_, i) => i < score);
  const ordered = reverse ? [...dots].reverse() : dots;
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {ordered.map((filled, i) => (
        <motion.div
          key={i}
          animate={filled ? { scale: [1.4, 1] } : {}}
          style={{
            width: 11, height: 11, borderRadius: "50%",
            background: filled ? color : "transparent",
            border: `2px solid ${filled ? color : "rgba(255,255,255,0.18)"}`,
            boxShadow: filled ? `0 0 6px ${color}88` : "none",
          }}
        />
      ))}
    </div>
  );
}

// ─────────── AttemptBadge ───────────
function AttemptBadge({ label, attempt, hideText }: { label: string; attempt: { text: string; ok: boolean } | null; hideText?: boolean }) {
  if (!attempt) {
    return (
      <div style={{ ...glass, padding: "10px 12px", borderRadius: 14, textAlign: "center", border: "1px dashed rgba(255,255,255,0.12)" }}>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(255,255,255,0.32)", display: "block" }}>{label}</span>
        <p style={{ margin: "3px 0 0", fontSize: 11, fontStyle: "italic", color: "rgba(255,255,255,0.35)" }}>réfléchit…</p>
      </div>
    );
  }
  const col = attempt.ok ? EMERALD : ROSE;
  return (
    <div style={{ ...glass, padding: "10px 12px", borderRadius: 14, textAlign: "center", border: `1px solid ${col}44`, background: `${col}0c` }}>
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(255,255,255,0.42)", display: "block" }}>{label}</span>
      <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 700, color: col, textShadow: `0 0 8px ${col}88`, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {hideText ? (attempt.ok ? "✓ trouvé !" : "a essayé…") : attempt.text}
      </p>
    </div>
  );
}

// ─────────── PlayView ───────────
function PlayView({ state, room, mySlot, myName, otherName }: SharedProps) {
  const order        = state.order ?? [];
  const index        = state.index ?? 0;
  const riddleIdx    = order[index] ?? 0;
  const riddle       = RIDDLES[riddleIdx] ?? RIDDLES[0];
  const started      = state.started_at ?? Date.now();
  const firstCorrect = state.first_correct ?? null;
  const isResult     = state.phase === "result";
  const myAttemptKey = mySlot === 1 ? "attempt_1" : "attempt_2";
  const myAttempt    = (mySlot === 1 ? state.attempt_1 : state.attempt_2) ?? null;
  const otherAttempt = (mySlot === 1 ? state.attempt_2 : state.attempt_1) ?? null;
  const score1       = state.score_1 ?? 0;
  const score2       = state.score_2 ?? 0;
  const myScore      = mySlot === 1 ? score1 : score2;
  const otherScore   = mySlot === 1 ? score2 : score1;
  const isLast       = index >= order.length - 1;
  const level        = (state.level ?? "medium") as DareLevel;
  const cfg          = LEVEL_CFG[level];

  const [text, setText]   = useState("");
  const [now, setNow]     = useState(Date.now());
  const inputRef          = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isResult) {
      const id = setInterval(() => setNow(Date.now()), 100);
      return () => clearInterval(id);
    }
  }, [isResult]);

  useEffect(() => {
    setText("");
    if (!isResult) setTimeout(() => inputRef.current?.focus(), 120);
  }, [index, state.phase, isResult]);

  const remaining  = Math.max(0, ROUND_DURATION_MS - (now - started));
  const pct        = remaining / ROUND_DURATION_MS;
  const secLeft    = Math.ceil(remaining / 1000);
  const timerColor = secLeft <= 10 ? ROSE : secLeft <= 20 ? AMBER : EMERALD;

  // Autorité : ferme le round si timeout
  useEffect(() => {
    if (mySlot !== 1 || isResult || firstCorrect || remaining > 0) return;
    void patchState(room.id, { phase: "result", round_done: true });
  }, [mySlot, isResult, firstCorrect, remaining, room.id]);

  const submit = async () => {
    if (!text.trim() || isResult || firstCorrect) return;
    const ok   = checkAnswer(text, riddle.answers);
    const now2 = Date.now();
    const att  = { text: text.trim(), ok, ts: now2 };
    if (ok) {
      const { data } = await supabase.from("rooms").select("minigame_state").eq("id", room.id).maybeSingle();
      const cur = (data?.minigame_state ?? {}) as RState;
      if (!cur.first_correct) {
        const sKey = mySlot === 1 ? "score_1" : "score_2";
        const curScore = (mySlot === 1 ? cur.score_1 : cur.score_2) ?? 0;
        await supabase.from("rooms").update({
          minigame_state: {
            ...cur,
            [myAttemptKey]: att,
            first_correct: { slot: mySlot as 1 | 2, ts: now2, text: att.text },
            phase: "result",
            round_done: true,
            [sKey]: curScore + 1,
          },
        }).eq("id", room.id);
      } else {
        await patchState(room.id, { [myAttemptKey]: att });
      }
    } else {
      await patchState(room.id, { [myAttemptKey]: att });
      setText("");
    }
  };

  const overrideToWinner = async (slot: 1 | 2) => {
    if (mySlot !== 1) return;
    const prev = state.first_correct?.slot ?? null;
    if (prev === slot) return;
    let s1 = state.score_1 ?? 0;
    let s2 = state.score_2 ?? 0;
    if (prev === 1) s1 = Math.max(0, s1 - 1);
    if (prev === 2) s2 = Math.max(0, s2 - 1);
    if (slot === 1) s1++; else s2++;
    await patchState(room.id, {
      first_correct: { slot, ts: Date.now(), text: (slot === 1 ? state.attempt_1?.text : state.attempt_2?.text) ?? "" },
      score_1: s1, score_2: s2,
      override: slot === 1 ? "winner_1" : "winner_2",
    });
  };

  const cancelWin = async () => {
    if (mySlot !== 1) return;
    const prev = state.first_correct?.slot;
    if (!prev) return;
    let s1 = state.score_1 ?? 0;
    let s2 = state.score_2 ?? 0;
    if (prev === 1) s1 = Math.max(0, s1 - 1);
    if (prev === 2) s2 = Math.max(0, s2 - 1);
    await patchState(room.id, { first_correct: null, score_1: s1, score_2: s2, override: "none" });
  };

  const next = async () => {
    if (mySlot !== 1) return;
    if (isLast) {
      const s1 = state.score_1 ?? 0;
      const s2 = state.score_2 ?? 0;
      const winner: 0 | 1 | 2 = s1 === s2 ? 0 : s1 > s2 ? 1 : 2;
      if (winner === 0) {
        await patchState(room.id, { phase: "dare", winner_slot: 0 });
        return;
      }
      const pool     = getGagesPool(room.ambiance, level) ?? GAGES_BY_LEVEL[level];
      const scope    = `dare:riddles:${room.ambiance ?? "irl"}:${level}`;
      const selected = pickNonRepeating(pool, scope, (x) => x);
      if (selected) markItemsUsed(scope, [selected], (x) => x);
      const idx = selected ? pool.indexOf(selected) : 0;
      await patchState(room.id, {
        phase: "dare", winner_slot: winner,
        wheel_index: idx, dare_text: selected ?? pool[idx],
      });
    } else {
      await patchState(room.id, {
        phase: "play", index: index + 1, started_at: Date.now(),
        attempt_1: null, attempt_2: null,
        first_correct: null, round_done: false, override: null,
      });
    }
  };

  return (
    <>
      {/* Header scores */}
      <div style={{ ...glass, padding: "12px 16px", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(255,255,255,0.35)" }}>{myName}</span>
          <ScoreDots score={myScore} total={order.length} color={cfg.color} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 1 }}>
            {index + 1} / {order.length}
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 11, fontStyle: "italic", color: cfg.color }}>
            {LEVEL_LABELS[level]}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "rgba(255,255,255,0.35)" }}>{otherName}</span>
          <ScoreDots score={otherScore} total={order.length} color={ROSE} reverse />
        </div>
      </div>

      {/* Carte devinette */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${index}-${state.started_at}`}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -8 }}
          transition={{ duration: 0.3 }}
          style={{
            ...glass,
            position: "relative",
            padding: "28px 20px 22px",
            borderRadius: 24,
            overflow: "hidden",
            border: `1px solid ${isResult ? "rgba(255,255,255,0.10)" : `${timerColor}44`}`,
            boxShadow: isResult ? "none" : `0 0 24px ${timerColor}22`,
            background: "rgba(255,255,255,0.05)",
          }}
        >
          {/* Barre timer décroissante */}
          {!isResult && (
            <>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: "24px 24px 0 0" }}>
                <motion.div
                  animate={{ width: `${pct * 100}%`, backgroundColor: timerColor }}
                  transition={{ duration: 0.15, ease: "linear" }}
                  style={{ height: "100%", borderRadius: "24px 24px 0 0", boxShadow: `0 0 8px ${timerColor}` }}
                />
              </div>
              {/* Compteur */}
              <motion.div
                animate={secLeft <= 10 ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={{ repeat: secLeft <= 10 ? Infinity : 0, duration: 0.5 }}
                style={{
                  position: "absolute", top: 10, right: 14,
                  fontSize: 11, fontWeight: 800, color: timerColor,
                  textShadow: `0 0 10px ${timerColor}88`,
                }}
              >
                {secLeft}s
              </motion.div>
            </>
          )}

          {/* Icône énigme */}
          <p style={{ textAlign: "center", fontSize: 32, margin: "0 0 10px" }}>🧩</p>

          {/* Question */}
          <p style={{ textAlign: "center", fontFamily: SERIF, fontSize: 22, fontStyle: "italic", color: "#fff", lineHeight: 1.55, margin: 0 }}>
            {riddle.q}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Zone de réponse (pendant le jeu) */}
      {!isResult && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 60))}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            placeholder="Ta réponse…"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            style={{
              width: "100%", height: 52, borderRadius: 16,
              background: "rgba(255,255,255,0.07)",
              border: "1.5px solid rgba(255,255,255,0.14)",
              color: "#fff", fontSize: 16, padding: "0 16px",
              outline: "none", boxSizing: "border-box",
              fontFamily: "inherit",
              WebkitAppearance: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => { e.target.style.borderColor = `${cfg.color}88`; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.14)"; }}
          />
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={!text.trim()}
            onClick={() => void submit()}
            style={{
              height: 52, width: "100%", borderRadius: 16, border: "none",
              background: text.trim()
                ? `linear-gradient(135deg, ${cfg.color}, ${SKY})`
                : "rgba(255,255,255,0.07)",
              color: text.trim() ? "#0d0d0d" : "rgba(255,255,255,0.25)",
              fontWeight: 700, fontSize: 16, cursor: text.trim() ? "pointer" : "default",
              boxShadow: text.trim() ? `0 0 20px ${cfg.glow}` : "none",
              transition: "all 0.2s",
            }}
          >
            Répondre ✨
          </motion.button>

          {/* Badges tentatives */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <AttemptBadge label="Toi" attempt={myAttempt} />
            <AttemptBadge label={otherName} attempt={otherAttempt} hideText />
          </div>
        </div>
      )}

      {/* Résultat du round */}
      {isResult && (
        <ResultBlock
          state={state} mySlot={mySlot} myName={myName} otherName={otherName}
          riddleAnswers={riddle.answers} isLast={isLast}
          onNext={next}
          onOverrideMe={() => overrideToWinner(mySlot as 1 | 2)}
          onOverrideOther={() => overrideToWinner((mySlot === 1 ? 2 : 1) as 1 | 2)}
          onCancelWin={cancelWin}
        />
      )}
    </>
  );
}

// ─────────── ResultBlock ───────────
function ResultBlock({ state, mySlot, myName, otherName, riddleAnswers, isLast, onNext, onOverrideMe, onOverrideOther, onCancelWin }: {
  state: RState; mySlot: number; myName: string; otherName: string;
  riddleAnswers: string[]; isLast: boolean;
  onNext: () => void; onOverrideMe: () => void; onOverrideOther: () => void; onCancelWin: () => void;
}) {
  const fc = state.first_correct;
  const iWon = fc?.slot === mySlot;
  const winnerName = fc ? (fc.slot === mySlot ? "Tu as" : `${otherName} a`) : null;

  useEffect(() => {
    if (fc) confetti({ particleCount: 35, spread: 55, origin: { y: 0.45 } });
  }, [fc]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
      {/* Verdict du round */}
      <AnimatePresence mode="wait">
        <motion.div
          key={fc ? `w-${fc.slot}` : "none"}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          style={{
            ...glass,
            padding: "20px",
            borderRadius: 22,
            textAlign: "center",
            border: fc
              ? `1px solid ${iWon ? EMERALD : ROSE}44`
              : "1px solid rgba(255,255,255,0.10)",
            background: fc
              ? (iWon ? `${EMERALD}0c` : `${ROSE}0c`)
              : "rgba(255,255,255,0.04)",
          }}
        >
          <p style={{ fontSize: 44, margin: "0 0 8px", lineHeight: 1 }}>
            {fc ? (iWon ? "🎉" : "⚡") : "⏰"}
          </p>
          <h3 style={{ fontFamily: SERIF, fontSize: 24, fontStyle: "italic", color: fc ? (iWon ? EMERALD : ROSE) : "rgba(255,255,255,0.6)", margin: "0 0 6px", textShadow: fc ? `0 0 14px ${iWon ? EMERALD : ROSE}88` : "none" }}>
            {fc ? `${winnerName} trouvé !` : "Temps écoulé…"}
          </h3>
          <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.40)" }}>
            {fc
              ? <span>Réponse : <span style={{ color: "#fff", fontWeight: 600 }}>« {fc.text} »</span></span>
              : <span>Réponse : <span style={{ color: AMBER, fontWeight: 600 }}>« {riddleAnswers[0]} »</span></span>}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Badges des deux */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <AttemptBadge label={mySlot === 1 ? "Toi" : otherName} attempt={state.attempt_1 ?? null} />
        <AttemptBadge label={mySlot === 2 ? "Toi" : otherName} attempt={state.attempt_2 ?? null} />
      </div>

      {/* Arbitrage (slot 1 seulement) */}
      {mySlot === 1 && (
        <div style={{
          ...glass,
          padding: "12px 14px", borderRadius: 16,
          border: "1px dashed rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
        }}>
          <p style={{ margin: "0 0 8px", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: "rgba(255,255,255,0.30)", textAlign: "center" }}>
            Corriger ⚙️
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            {[
              { label: `→ ${myName}`,    fn: onOverrideMe    },
              { label: `→ ${otherName}`, fn: onOverrideOther },
              ...(fc ? [{ label: "Annuler le point", fn: onCancelWin }] : []),
            ].map(({ label, fn }) => (
              <motion.button
                key={label} whileTap={{ scale: 0.95 }} onClick={fn}
                style={{
                  padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                }}
              >
                {label}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Bouton suivant */}
      <div style={{ marginTop: "auto" }}>
        {mySlot === 1 ? (
          <motion.button
            whileTap={{ scale: 0.96 }} onClick={onNext}
            style={{
              width: "100%", height: 56, borderRadius: 18, border: "none",
              background: `linear-gradient(135deg, ${LEVEL_CFG[(state.level ?? "medium") as DareLevel].color}, ${SKY})`,
              color: "#0d0d0d", fontWeight: 800, fontSize: 17,
              cursor: "pointer",
              boxShadow: `0 0 24px ${LEVEL_CFG[(state.level ?? "medium") as DareLevel].glow}`,
            }}
          >
            {isLast ? "Voir le verdict 🏆" : "Suivante ➡️"}
          </motion.button>
        ) : (
          <div style={{ ...glass, padding: "14px 20px", borderRadius: 18, textAlign: "center" }}>
            <motion.p
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.45)" }}
            >
              ⏳ {otherName} enchaîne…
            </motion.p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────── Gage ───────────
function DareView({ state, room, mySlot, myName, otherName, onDareDone }: SharedProps & { onDareDone: () => void }) {
  const winner = state.winner_slot ?? 0;
  const dare   = state.dare_text ?? "Un câlin tout doux 🤗";
  const level  = (state.level ?? "simple") as DareLevel;

  useEffect(() => {
    if (winner !== 0) confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
  }, [winner]);

  // Égalité
  if (winner === 0) {
    const s1     = state.score_1 ?? 0;
    const s2     = state.score_2 ?? 0;
    const myScore = mySlot === 1 ? s1 : s2;
    const otScore = mySlot === 1 ? s2 : s1;
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center", padding: "0 16px" }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} style={{ fontSize: 72, lineHeight: 1 }}>🤝</motion.div>
        <div style={{ ...glass, padding: "22px 28px", width: "100%", maxWidth: 320, borderRadius: 24, border: `1px solid ${AMBER}33` }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 30, fontStyle: "italic", color: AMBER, margin: "0 0 8px" }}>Match nul 💕</h2>
          <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.40)" }}>
            {myName} <span style={{ color: "#fff", fontWeight: 700 }}>{myScore}</span>
            {" · "}
            {otherName} <span style={{ color: "#fff", fontWeight: 700 }}>{otScore}</span>
          </p>
        </div>
        {mySlot === 1 ? (
          <motion.button
            whileTap={{ scale: 0.95 }} onClick={() => void dbUpdate(room.id, freshReset())}
            style={{ width: "100%", maxWidth: 320, height: 56, borderRadius: 18, border: "none", background: `linear-gradient(135deg, ${SKY}, #6366f1)`, color: "#fff", fontWeight: 700, fontSize: 17, cursor: "pointer", boxShadow: `0 0 20px ${SKY}44` }}
          >
            Rejouer 🔁
          </motion.button>
        ) : (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>{otherName} relance…</p>
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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center", padding: "0 16px" }}>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 280, damping: 18 }} style={{ fontSize: 72, lineHeight: 1 }}>
        🎁
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        style={{ ...glass, padding: "22px 24px", width: "100%", maxWidth: 340, borderRadius: 22, border: `1.5px solid ${AMBER}44`, background: `${AMBER}0c` }}
      >
        <p style={{ margin: "0 0 4px", fontSize: 10, textTransform: "uppercase", letterSpacing: 2, color: AMBER }}>
          {iLost ? "Ton gage 🎭" : `Gage pour ${otherName} 🎭`}
        </p>
        <span style={{ fontSize: 11, background: `${LEVEL_CFG[level].color}20`, border: `1px solid ${LEVEL_CFG[level].color}44`, color: LEVEL_CFG[level].color, borderRadius: 20, padding: "2px 10px", display: "inline-block", marginTop: 4 }}>
          {LEVEL_LABELS[level]}
        </span>
        <h2 style={{ fontFamily: SERIF, fontSize: 26, fontStyle: "italic", color: "#fff", margin: "12px 0 0", lineHeight: 1.4 }}>
          {dare}
        </h2>
      </motion.div>
      {iLost ? (
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          whileTap={{ scale: 0.95 }} onClick={validate}
          style={{ width: "100%", maxWidth: 320, height: 56, borderRadius: 18, border: "none", background: `linear-gradient(135deg, ${AMBER}, #fb923c)`, color: "#0d0d0d", fontWeight: 700, fontSize: 17, cursor: "pointer", boxShadow: `0 0 24px ${AMBER}44` }}
        >
          C'est fait ! ✅
        </motion.button>
      ) : (
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>On attend que {otherName} fasse son gage… 🥹</p>
      )}
    </div>
  );
}

// ─────────── Fin ───────────
function DoneView({ state, mySlot, myName, otherName, onReplay, onBackToMenu }: SharedProps & { onReplay: () => void; onBackToMenu: () => void }) {
  const winner   = state.winner_slot ?? 0;
  const s1       = state.score_1 ?? 0;
  const s2       = state.score_2 ?? 0;
  const myScore  = mySlot === 1 ? s1 : s2;
  const otScore  = mySlot === 1 ? s2 : s1;
  const iWon     = winner === mySlot;
  const tie      = winner === 0;
  const topColor = tie ? AMBER : iWon ? EMERALD : ROSE;

  const verdict = useMemo(() => {
    if (tie) return "Match nul 🤝";
    const wn = winner === mySlot ? myName : otherName;
    return `${wn} remporte le duel !`;
  }, [tie, winner, mySlot, myName, otherName]);

  useEffect(() => { confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } }); }, []);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, textAlign: "center", padding: "0 16px" }}>
      <motion.div
        initial={{ scale: 0, y: 20 }} animate={{ scale: [0, 1.3, 1], y: 0 }}
        transition={{ duration: 0.5, times: [0, 0.6, 1] }}
        style={{ fontSize: 80, lineHeight: 1 }}
      >
        {iWon ? "🏆" : tie ? "🤝" : "💖"}
      </motion.div>

      <div style={{ ...glass, padding: "22px 28px", width: "100%", maxWidth: 320, borderRadius: 24, border: `1px solid ${topColor}33` }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 28, fontStyle: "italic", color: topColor, margin: "0 0 12px", textShadow: `0 0 16px ${topColor}66` }}>
          {verdict}
        </h2>
        <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 14, color: "rgba(255,255,255,0.45)" }}>
          <span><span style={{ color: "#fff", fontWeight: 700 }}>{myScore}</span> {myName}</span>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
          <span><span style={{ color: "#fff", fontWeight: 700 }}>{otScore}</span> {otherName}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320 }}>
        <motion.button
          whileTap={{ scale: 0.95 }} onClick={onReplay}
          style={{ height: 52, borderRadius: 16, border: "none", background: `linear-gradient(135deg, ${SKY}, #6366f1)`, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: `0 0 20px ${SKY}44` }}
        >
          Rejouer 🔁
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }} onClick={onBackToMenu}
          style={{ height: 52, borderRadius: 16, border: "1.5px solid rgba(255,255,255,0.13)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}
        >
          ← Retour au menu
        </motion.button>
      </div>
    </div>
  );
}
