import { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";
import { useGenerateAIContent, type AIWouldYou, type Ambiance } from "@/lib/use-ai-content";
import { markItemsUsed, nonRepeatingSample } from "@/lib/non-repeating";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

const NB_QUESTIONS = 10;

type Mode = "doux" | "coquin";
type Question = { a: string; b: string };

const QUESTIONS_DOUX: Question[] = [
  { a: "Un massage sensuel aux huiles chaudes sur tout le corps 💆‍♀️", b: "Un bain moussant à deux avec champagne et fraises 🍾" },
  { a: "M'embrasser passionnément dans le cou pendant 5 min 💋", b: "Recevoir des baisers dans le dos qui descendent lentement 😘" },
  { a: "Te retrouver les yeux bandés, guidé par mes mains 🙈", b: "M'observer te déshabiller lentement, sans me toucher 👀" },
  { a: "Une nuit à l'hôtel avec vue sur la ville 🌃", b: "Une nuit de folie dans notre lit transformé en tente de soie 🛏️" },
  { a: "Moi qui prends l'initiative et te domine doucement 😈", b: "Toi qui me plaque contre le mur et prend le contrôle 🔥" },
  { a: "Des caresses lentes et tendres qui durent une heure 🕊️", b: "Un baiser sauvage qui nous mène directement au lit 💥" },
  { a: "Te réveiller avec ma bouche sur toi 🌅", b: "Te surprendre en pleine nuit avec mes mains 🌙" },
  { a: "M'entendre te murmurer des mots coquins à l'oreille 🤫", b: "Te voir me fixer en silence, le désir dans les yeux 👁️" },
  { a: "Une danse lente, collé-serré, sans aucun vêtement 💃", b: "Un strip-tease improvisé rien que pour toi 🎭" },
  { a: "Qu'on fasse l'amour sous la pluie chaude de la douche 🚿", b: "Qu'on fasse l'amour devant la cheminée, couverts d'une couverture 🔥" },
  { a: "Que je porte ta chemise et rien d'autre 👔", b: "Que je porte de la lingerie transparente noire 🖤" },
  { a: "Te caresser pendant que tu regardes un film 🎬", b: "T'embrasser sauvagement en plein milieu du film 💋" },
  { a: "Un week-end où on ne sort pas du lit 🛌", b: "Une escapade où on fait l'amour dans des lieux inattendus 🏨" },
  { a: "Te voir transpirer après un effort physique 🔥", b: "Te voir tout calme et détendu après un bain 🛁" },
  { a: "Qu'on s'endorme nus, peau contre peau 🤍", b: "Qu'on s'endorme après une nuit sans sommeil 😴" },
];

const QUESTIONS_COQUIN: Question[] = [
  { a: "M'attacher au lit pour que tu fasses ce que tu veux de moi ⛓️", b: "T'attacher et te torturer avec des caresses lentes 🪶" },
  { a: "Recevoir un cunni langoureux pendant que je suis allongée 🛏️", b: "T'asseoir sur mon visage pendant que je te lèche 👅" },
  { a: "Faire l'amour à la fenêtre, risque d'être vus 🪟", b: "Faire l'amour en pleine nature, risque d'être entendus 🌳" },
  { a: "Te voir jouir avant même que je ne commence 😏", b: "Te faire attendre, au bord, pendant un quart d'heure ⏳" },
  { a: "Qu'on utilise des menottes douces en fourrure 🐻", b: "Qu'on utilise un bandeau et un plug 🎀" },
  { a: "Qu'on fasse l'amour en silence, les voisins à côté 🤫", b: "Qu'on fasse l'amour en criant, sans se retenir 📢" },
  { a: "Que je te domine, je décide de tout ce soir 👑", b: "Que tu me domines, j'obéis à tous tes ordres 🧎" },
  { a: "Te caresser sous la table au restaurant 🍽️", b: "Te caresser au cinéma dans le fond de la salle 🎥" },
  { a: "Qu'on se filme pendant qu'on fait l'amour 📹", b: "Qu'on prenne des photos très suggestives 📸" },
  { a: "Qu'on essaie un jouet qui vibre sur toi 🍆", b: "Qu'on essaie un jouet qui vibre sur moi 💦" },
  { a: "Faire l'amour debout contre le mur du dressing 🪞", b: "Faire l'amour sur le plan de travail de la cuisine 🍳" },
  { a: "Qu'on s'échange nos sous-vêtements toute la journée 🩲", b: "Qu'on ne porte rien sous nos vêtements toute la journée 🚫" },
  { a: "Te sentir me pénétrer lentement, millimètre par millimètre 🐌", b: "Te sentir me prendre sauvagement d'un seul coup 💥" },
  { a: "Qu'on essaie la glace pendant les préliminaires 🧊", b: "Qu'on essaie la cire chaude pendant les préliminaires 🕯️" },
];

const BANKS: Record<Mode, Question[]> = { doux: QUESTIONS_DOUX, coquin: QUESTIONS_COQUIN };

const MODE_INFO: Record<Mode, {
  label: string; emoji: string; desc: string;
  accentHex: string; glow: string;
  cardA: string; cardB: string;
}> = {
  doux: {
    label: "Doux & Sensuel", emoji: "💋",
    desc: "Romantique, tendre et enivrant",
    accentHex: "#f4a0b5", glow: "rgba(244,160,181,0.35)",
    cardA: "linear-gradient(145deg, oklch(0.76 0.09 345), oklch(0.66 0.13 328))",
    cardB: "linear-gradient(145deg, oklch(0.72 0.11 320), oklch(0.60 0.15 305))",
  },
  coquin: {
    label: "Torride & Osé", emoji: "🔥",
    desc: "Intense, sans tabou et enflammé",
    accentHex: "#e8805a", glow: "rgba(232,128,90,0.35)",
    cardA: "linear-gradient(145deg, oklch(0.58 0.20 22), oklch(0.48 0.22 8))",
    cardB: "linear-gradient(145deg, oklch(0.55 0.21 340), oklch(0.44 0.22 325))",
  },
};

type WYRState = {
  game?: "wouldyou";
  phase?: "mode_select" | "loading" | "play" | "reveal" | "done";
  mode_1?: Mode | null;
  mode_2?: Mode | null;
  mode?: Mode | null;
  order?: number[];
  index?: number;
  choice_1?: "a" | "b" | null;
  choice_2?: "a" | "b" | null;
  matches?: number;
  ai_questions?: Question[] | null;
  ai_failed?: boolean;
};

type Props = {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
};

const update = (roomId: string, p: WYRState) =>
  supabase.from("rooms").update({ minigame_state: p }).eq("id", roomId);

async function patch(roomId: string, partial: WYRState) {
  const { data } = await supabase.from("rooms").select("minigame_state").eq("id", roomId).maybeSingle();
  const current = (data?.minigame_state ?? {}) as WYRState;
  await update(roomId, { ...current, ...partial });
}

function freshReset(): WYRState {
  return {
    game: "wouldyou", phase: "mode_select",
    mode_1: null, mode_2: null, mode: null,
    order: [], index: 0,
    choice_1: null, choice_2: null, matches: 0,
    ai_questions: null, ai_failed: false,
  };
}

function Orb({ size, x, y, delay, color }: { size: number; x: string; y: string; delay: number; color: string }) {
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full"
      style={{ width: size, height: size, left: x, top: y, background: color, filter: `blur(${size * 0.55}px)`, opacity: 0.4 }}
      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3], y: [0, -14, 0] }}
      transition={{ duration: 6 + delay, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

export function WouldYouRather({ room, mySlot, myName, otherName, onBackToMenu }: Props) {
  const s = (room.minigame_state ?? {}) as WYRState;
  const phase = s.phase ?? "mode_select";

  useEffect(() => {
    if (Object.keys(s).length === 0 && mySlot === 1) void update(room.id, freshReset());
  }, [room.id, s, mySlot]);

  if (phase === "mode_select")
    return <ModeSelect state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  if (phase === "loading") return <LoadingView />;
  if (phase === "play" || phase === "reveal")
    return <PlayView state={s} room={room} mySlot={mySlot} otherName={otherName} onBackToMenu={onBackToMenu} />;
  return (
    <DoneView
      state={s}
      onReplay={async () => { await update(room.id, freshReset()); }}
      onBackToMenu={onBackToMenu}
    />
  );
}

// ── Loading ──────────────────────────────────────────────────────────────────
function LoadingView() {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center text-center relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, oklch(0.20 0.04 340), oklch(0.16 0.05 320))" }}
    >
      <Orb size={160} x="10%" y="15%" delay={0} color="oklch(0.62 0.18 340)" />
      <Orb size={120} x="65%" y="55%" delay={2} color="oklch(0.58 0.16 20)" />
      <div className="relative z-10 flex flex-col items-center gap-5">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          className="text-7xl"
        >💞</motion.div>
        <div>
          <p style={{ fontFamily: "Cormorant Garamond, serif", color: "#fde8ee" }} className="text-3xl font-semibold">
            L'IA prépare vos questions…
          </p>
          <p className="mt-2 text-sm" style={{ color: "rgba(253,232,238,0.55)" }}>
            Une série unique rien que pour vous ✨
          </p>
        </div>
        <div className="flex gap-2 mt-1">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} className="w-2 h-2 rounded-full" style={{ background: "#fde8ee" }}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.3 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Mode Select ───────────────────────────────────────────────────────────────
function ModeSelect({ state, room, mySlot, myName, otherName }:
  { state: WYRState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const mine = mySlot === 1 ? state.mode_1 : state.mode_2;
  const theirs = mySlot === 1 ? state.mode_2 : state.mode_1;
  const both = state.mode_1 && state.mode_2;
  const match = both && state.mode_1 === state.mode_2;
  const generate = useGenerateAIContent();

  const choose = async (m: Mode) => {
    await patch(room.id, mySlot === 1 ? { mode_1: m } : { mode_2: m });
  };

  const start = async () => {
    if (!match || mySlot !== 1) return;
    const chosen = state.mode_1 as Mode;
    const ambiance: Ambiance = chosen === "doux" ? "mignon" : "hot";
    await patch(room.id, { phase: "loading", mode: chosen });
    const scope = `wouldyou:${chosen}`;
    const keyOf = (q: Question) => `${q.a}|${q.b}`;
    const ai = await generate<AIWouldYou>("wouldyou", ambiance, NB_QUESTIONS * 3);
    if (ai?.questions?.length) {
      const questions = nonRepeatingSample(ai.questions, NB_QUESTIONS, scope, keyOf);
      markItemsUsed(scope, questions, keyOf);
      await patch(room.id, {
        phase: "play", mode: chosen, ai_questions: questions,
        order: questions.map((_, i) => i), index: 0,
        choice_1: null, choice_2: null, matches: 0, ai_failed: false,
      });
    } else {
      const bank = BANKS[chosen];
      const chosenQs = nonRepeatingSample(bank, Math.min(NB_QUESTIONS, bank.length), `${scope}:local`, keyOf);
      markItemsUsed(`${scope}:local`, chosenQs, keyOf);
      const idxs = chosenQs.map((q) => bank.indexOf(q));
      await patch(room.id, {
        phase: "play", mode: chosen, ai_questions: null,
        order: idxs, index: 0,
        choice_1: null, choice_2: null, matches: 0, ai_failed: true,
      });
    }
  };

  return (
    <div
      className="flex flex-1 flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, oklch(0.18 0.04 340) 0%, oklch(0.15 0.05 320) 100%)" }}
    >
      <Orb size={200} x="-5%" y="-5%" delay={0} color="oklch(0.60 0.18 340)" />
      <Orb size={150} x="60%" y="60%" delay={3} color="oklch(0.55 0.16 20)" />
      <Orb size={100} x="75%" y="10%" delay={1.5} color="oklch(0.65 0.14 350)" />

      <div className="relative z-10 flex flex-1 flex-col px-5 pt-8 pb-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center mb-8"
        >
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "rgba(253,232,238,0.45)" }}>
            Tu préfères ?
          </p>
          <h1 className="mt-2 text-5xl font-semibold leading-tight"
            style={{ fontFamily: "Cormorant Garamond, serif", color: "#fde8ee" }}>
            Choisissez l'ambiance
          </h1>
          <p className="mt-2 text-sm" style={{ color: "rgba(253,232,238,0.4)" }}>
            Vous devez être d'accord pour commencer
          </p>
        </motion.div>

        {/* Mode cards */}
        <div className="flex flex-col gap-4 flex-1">
          {(Object.keys(MODE_INFO) as Mode[]).map((m, i) => {
            const info = MODE_INFO[m];
            const iPicked = mine === m;
            const theyPicked = theirs === m;
            const cardBg = m === "doux"
              ? "linear-gradient(145deg, oklch(0.76 0.09 345), oklch(0.66 0.13 328))"
              : "linear-gradient(145deg, oklch(0.58 0.20 22), oklch(0.48 0.22 8))";
            return (
              <motion.button
                key={m}
                initial={{ opacity: 0, x: i === 0 ? -30 : 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.15, duration: 0.45, ease: "easeOut" }}
                whileTap={{ scale: 0.97 }}
                onClick={() => choose(m)}
                className="relative rounded-3xl overflow-hidden text-left flex-1"
                style={{
                  background: cardBg,
                  boxShadow: iPicked
                    ? `0 0 0 3px ${info.accentHex}, 0 12px 40px ${info.glow}`
                    : "0 8px 28px rgba(0,0,0,0.25)",
                  minHeight: 110,
                }}
              >
                {iPicked && (
                  <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ background: "rgba(255,255,255,0.12)" }} />
                )}
                <div className="relative z-10 p-5 flex items-center gap-4 h-full">
                  <motion.span className="text-5xl flex-shrink-0"
                    animate={iPicked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                    transition={{ duration: 0.4 }}>
                    {info.emoji}
                  </motion.span>
                  <div className="flex-1">
                    <p className="text-2xl font-semibold leading-tight"
                      style={{ fontFamily: "Cormorant Garamond, serif", color: "rgba(255,255,255,0.95)" }}>
                      {info.label}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>{info.desc}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {iPicked && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="text-[11px] font-semibold rounded-full px-2.5 py-0.5"
                          style={{ background: "rgba(255,255,255,0.25)", color: "white" }}>
                          Toi ✓
                        </motion.span>
                      )}
                      {theyPicked && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="text-[11px] font-semibold rounded-full px-2.5 py-0.5"
                          style={{ background: "rgba(255,255,255,0.25)", color: "white" }}>
                          {otherName} ✓
                        </motion.span>
                      )}
                    </div>
                  </div>
                  {iPicked && (
                    <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.3)" }}>
                      <span className="text-white text-sm font-bold">✓</span>
                    </motion.div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Statut */}
        <motion.div className="mt-5 text-center text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          {both && !match ? (
            <motion.p animate={{ scale: [1, 1.04, 1] }} transition={{ repeat: Infinity, duration: 2 }}
              style={{ color: "#f4a0b5" }}>
              Mettez-vous d'accord 😅
            </motion.p>
          ) : (
            <p style={{ color: "rgba(253,232,238,0.5)" }}>
              <span style={{ color: "rgba(253,232,238,0.8)" }}>{myName}</span>{" : "}
              {mine ? MODE_INFO[mine].label : "—"}{"  ·  "}
              <span style={{ color: "rgba(253,232,238,0.8)" }}>{otherName}</span>{" : "}
              {theirs ? MODE_INFO[theirs].label : "—"}
            </p>
          )}
        </motion.div>

        {/* CTA */}
        <motion.div className="mt-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <motion.button
            disabled={!match || mySlot !== 1}
            onClick={start}
            whileTap={match && mySlot === 1 ? { scale: 0.97 } : {}}
            className="w-full h-14 rounded-2xl text-base font-semibold relative overflow-hidden"
            style={{
              background: match
                ? "linear-gradient(135deg, oklch(0.72 0.16 350), oklch(0.62 0.20 10))"
                : "rgba(255,255,255,0.08)",
              color: match ? "white" : "rgba(255,255,255,0.3)",
              boxShadow: match ? "0 8px 28px rgba(220,80,100,0.35)" : "none",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {match && (
              <motion.div className="absolute inset-0"
                animate={{ x: ["100%", "-100%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}
              />
            )}
            <span className="relative z-10">
              {match ? (mySlot === 1 ? "C'est parti ! 💕" : `${otherName} va lancer…`) : "En attente du mode commun…"}
            </span>
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}

// ── Play ──────────────────────────────────────────────────────────────────────
function PlayView({ state, room, mySlot, otherName, onBackToMenu }:
  { state: WYRState; room: Room; mySlot: number; otherName: string; onBackToMenu: () => void }) {
  const mode = (state.mode ?? "doux") as Mode;
  const info = MODE_INFO[mode];
  const aiQuestions = state.ai_questions ?? null;
  const bank: Question[] = aiQuestions && aiQuestions.length ? aiQuestions : BANKS[mode];
  const order = state.order ?? [];
  const idx = state.index ?? 0;
  const qIndex = order[idx];
  const question = qIndex != null ? bank[qIndex] : null;

  const myChoice = (mySlot === 1 ? state.choice_1 : state.choice_2) ?? null;
  const otherChoice = (mySlot === 1 ? state.choice_2 : state.choice_1) ?? null;
  const bothAnswered = !!state.choice_1 && !!state.choice_2;
  const same = bothAnswered && state.choice_1 === state.choice_2;
  const total = order.length;
  const isLast = idx >= total - 1;
  const matches = state.matches ?? 0;
  const prevKeyRef = useRef<string>("");
  const qKey = `q-${idx}`;
  if (qKey !== prevKeyRef.current) prevKeyRef.current = qKey;

  useEffect(() => {
    if (state.phase === "play" && bothAnswered && mySlot === 1) {
      const inc = same ? 1 : 0;
      void patch(room.id, { phase: "reveal", matches: matches + inc });
    }
  }, [state.phase, bothAnswered, same, mySlot, room.id, matches]);

  useEffect(() => {
    if (state.phase === "reveal" && same) {
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
    }
  }, [state.phase, same]);

  const pick = async (c: "a" | "b") => {
    if (myChoice) return;
    await patch(room.id, mySlot === 1 ? { choice_1: c } : { choice_2: c });
  };

  const next = async () => {
    if (mySlot !== 1) return;
    if (isLast) await patch(room.id, { phase: "done" });
    else await patch(room.id, { phase: "play", index: idx + 1, choice_1: null, choice_2: null });
  };

  if (!question) return null;
  const reveal = state.phase === "reveal";

  const bgStyle = mode === "doux"
    ? "linear-gradient(160deg, oklch(0.20 0.04 340), oklch(0.16 0.05 320))"
    : "linear-gradient(160deg, oklch(0.16 0.06 20), oklch(0.13 0.07 10))";

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: bgStyle }}>
      <Orb size={180} x="-8%" y="5%" delay={0} color={mode === "doux" ? "oklch(0.65 0.16 340)" : "oklch(0.58 0.22 20)"} />
      <Orb size={130} x="65%" y="65%" delay={2.5} color={mode === "doux" ? "oklch(0.60 0.14 320)" : "oklch(0.52 0.20 350)"} />

      <div className="relative z-10 flex flex-1 flex-col px-5 pt-5 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBackToMenu}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 18 }}>
            ←
          </motion.button>
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-[11px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
              {info.emoji} {info.label.split(" ")[0]}
            </p>
            <div className="flex gap-1.5">
              {Array.from({ length: total }).map((_, i) => (
                <motion.div key={i} className="h-1.5 rounded-full"
                  style={{
                    width: i === idx ? 18 : 6,
                    background: i < idx ? info.accentHex : i === idx ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)",
                  }}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.1)" }}>
            <span className="text-sm">💞</span>
            <span className="text-sm font-bold" style={{ color: info.accentHex }}>{matches}</span>
          </div>
        </div>

        {/* Question + Cards */}
        <AnimatePresence mode="wait">
          <motion.div key={qKey}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-col flex-1 gap-4">
            <h2 className="text-center text-3xl font-semibold"
              style={{ fontFamily: "Cormorant Garamond, serif", color: "rgba(255,255,255,0.9)" }}>
              Tu préfères…
            </h2>

            {(["a", "b"] as const).map((opt, oi) => {
              const text = opt === "a" ? question.a : question.b;
              const iPicked = myChoice === opt;
              const theyPicked = reveal && otherChoice === opt;
              const isWrongSide = !!(myChoice && !iPicked);
              const cardBg = opt === "a" ? info.cardA : info.cardB;

              return (
                <motion.button key={opt}
                  whileTap={!myChoice ? { scale: 0.97 } : {}}
                  disabled={!!myChoice}
                  onClick={() => pick(opt)}
                  initial={{ opacity: 0, x: oi === 0 ? -24 : 24 }}
                  animate={{ opacity: isWrongSide ? 0.45 : 1, x: 0 }}
                  transition={{ duration: 0.35, delay: oi * 0.08 }}
                  className="relative rounded-3xl overflow-hidden text-left flex-1"
                  style={{
                    background: cardBg,
                    boxShadow: iPicked
                      ? `0 0 0 3px rgba(255,255,255,0.7), 0 12px 36px ${info.glow}`
                      : "0 6px 22px rgba(0,0,0,0.2)",
                    minHeight: 100,
                  }}
                >
                  {iPicked && (
                    <motion.div className="absolute inset-0 pointer-events-none"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ background: "rgba(255,255,255,0.12)" }} />
                  )}
                  <div className="relative z-10 p-5 h-full flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] mb-2"
                        style={{ color: "rgba(255,255,255,0.5)" }}>
                        Option {opt.toUpperCase()}
                      </p>
                      <p className="text-xl font-medium leading-snug"
                        style={{ fontFamily: "Cormorant Garamond, serif", color: "rgba(255,255,255,0.95)" }}>
                        {text}
                      </p>
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {iPicked && (
                        <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          className="text-[11px] font-semibold rounded-full px-3 py-1"
                          style={{ background: "rgba(255,255,255,0.25)", color: "white" }}>
                          Toi 💚
                        </motion.span>
                      )}
                      {theyPicked && (
                        <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.15 }}
                          className="text-[11px] font-semibold rounded-full px-3 py-1"
                          style={{ background: "rgba(255,255,255,0.25)", color: "white" }}>
                          {otherName} 🧡
                        </motion.span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Statut */}
        <div className="mt-4 min-h-[60px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            {!myChoice && (
              <motion.p key="pick"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                Tape ton choix 👆
              </motion.p>
            )}
            {myChoice && !reveal && (
              <motion.div key="wait"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full"
                style={{ background: "rgba(255,255,255,0.1)" }}>
                <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>👀</motion.span>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{otherName} réfléchit…</p>
              </motion.div>
            )}
            {reveal && same && (
              <motion.div key="match"
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.p animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: 2, duration: 0.4 }}
                  className="text-2xl font-semibold"
                  style={{ fontFamily: "Cormorant Garamond, serif", color: info.accentHex }}>
                  Vous êtes d'accord 💕 +1
                </motion.p>
              </motion.div>
            )}
            {reveal && !same && (
              <motion.div key="diff"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p className="text-2xl font-semibold"
                  style={{ fontFamily: "Cormorant Garamond, serif", color: "rgba(255,255,255,0.65)" }}>
                  Ah, pas d'accord 😏
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Next button */}
        {reveal && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-2">
            {mySlot === 1 ? (
              <motion.button whileTap={{ scale: 0.97 }} onClick={next}
                className="w-full h-14 rounded-2xl text-base font-semibold relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, oklch(0.72 0.16 350), oklch(0.62 0.20 10))",
                  color: "white", boxShadow: "0 8px 28px rgba(220,80,100,0.3)",
                }}>
                <motion.div className="absolute inset-0"
                  animate={{ x: ["100%", "-100%"] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}
                />
                <span className="relative z-10">{isLast ? "Voir le verdict 🏆" : "Question suivante →"}</span>
              </motion.button>
            ) : (
              <div className="w-full h-12 rounded-2xl flex items-center justify-center text-sm"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                {otherName} enchaîne…
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Done ──────────────────────────────────────────────────────────────────────
function DoneView({ state, onReplay, onBackToMenu }:
  { state: WYRState; onReplay: () => void | Promise<void>; onBackToMenu: () => void }) {
  const total = state.order?.length ?? 0;
  const matches = state.matches ?? 0;
  const ratio = total ? matches / total : 0;
  const mode = (state.mode ?? "doux") as Mode;
  const info = MODE_INFO[mode];

  const verdict = useMemo(() => {
    if (ratio >= 0.9) return { title: "Âmes sœurs 💞", desc: "Vous lisez dans les pensées l'un de l'autre !", emoji: "💞" };
    if (ratio >= 0.7) return { title: "Une belle alchimie ✨", desc: "Vous vous comprenez vraiment bien.", emoji: "✨" };
    if (ratio >= 0.5) return { title: "Vous vous complétez 🧩", desc: "Assez d'accords, juste ce qu'il faut de surprises.", emoji: "🧩" };
    if (ratio >= 0.3) return { title: "Les opposés s'attirent 🌗", desc: "Vous avez vos différences… et c'est mignon !", emoji: "🌗" };
    return { title: "Le jour et la nuit 🌒", desc: "Mais c'est ça qui rend tout intéressant 😉", emoji: "🌒" };
  }, [ratio]);

  useEffect(() => {
    if (ratio >= 0.5) confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
  }, [ratio]);

  const pct = Math.round(ratio * 100);
  const circleR = 58;
  const circleDash = 2 * Math.PI * circleR;

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, oklch(0.18 0.04 340), oklch(0.14 0.05 320))" }}>
      <Orb size={200} x="-10%" y="-5%" delay={0} color="oklch(0.62 0.18 340)" />
      <Orb size={150} x="60%" y="55%" delay={2} color="oklch(0.55 0.16 20)" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        {/* Emoji */}
        <motion.div
          initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
          className="text-7xl mb-2">
          {verdict.emoji}
        </motion.div>

        {/* Titre */}
        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="text-4xl font-semibold mt-2"
          style={{ fontFamily: "Cormorant Garamond, serif", color: "#fde8ee" }}>
          {verdict.title}
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mt-2 text-sm max-w-xs" style={{ color: "rgba(253,232,238,0.5)" }}>
          {verdict.desc}
        </motion.p>

        {/* Score circle */}
        <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 160 }}
          className="mt-8 relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
          <svg className="absolute inset-0 -rotate-90" width="140" height="140">
            <circle cx="70" cy="70" r={circleR} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <motion.circle cx="70" cy="70" r={circleR} fill="none"
              stroke={info.accentHex} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${circleDash}`}
              initial={{ strokeDashoffset: circleDash }}
              animate={{ strokeDashoffset: circleDash * (1 - ratio) }}
              transition={{ delay: 0.8, duration: 1.2, ease: "easeOut" }}
              style={{ filter: `drop-shadow(0 0 8px ${info.accentHex})` }}
            />
          </svg>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
            className="flex flex-col items-center">
            <span className="text-4xl font-bold" style={{ color: "#fde8ee" }}>{pct}%</span>
            <span className="text-[11px] mt-0.5" style={{ color: "rgba(253,232,238,0.4)" }}>en commun</span>
          </motion.div>
        </motion.div>

        {/* Détail */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
          className="mt-6 px-6 py-3 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <p className="text-sm" style={{ color: "rgba(253,232,238,0.6)" }}>
            Vous avez répondu pareil{" "}
            <span className="font-bold text-lg" style={{ color: info.accentHex }}>{matches}</span>
            {" "}fois sur {total} 💕
          </p>
        </motion.div>

        {/* Boutons */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}
          className="mt-auto w-full space-y-3 pt-8">
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => onReplay()}
            className="w-full h-14 rounded-2xl text-base font-semibold relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, oklch(0.72 0.16 350), oklch(0.62 0.20 10))",
              color: "white", boxShadow: "0 8px 28px rgba(220,80,100,0.3)",
            }}>
            <motion.div className="absolute inset-0"
              animate={{ x: ["100%", "-100%"] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}
            />
            <span className="relative z-10">Rejouer 🔁</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={onBackToMenu}
            className="w-full h-12 rounded-2xl text-sm font-medium"
            style={{
              background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}>
            ← Retour au menu
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
