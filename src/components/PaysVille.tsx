import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";
import { markItemsUsed, pickNonRepeating } from "@/lib/non-repeating";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ─────────── CATÉGORIES FIXES — toujours les mêmes ───────────
const CATEGORIES_FIXED: { label: string; emoji: string }[] = [
  { label: "Pays",           emoji: "🌍" },
  { label: "Ville",          emoji: "🏙️" },
  { label: "Prénom",         emoji: "👤" },
  { label: "Animal",         emoji: "🐾" },
  { label: "Métier",         emoji: "💼" },
  { label: "Fruit ou Légume",emoji: "🍎" },
  { label: "Objet",          emoji: "📦" },
  { label: "Marque",         emoji: "⭐" },
];

// Lettres tirables (sans K W X Y Z trop difficiles)
const LETTERS_POOL = "ABCDEFGHIJLMNOPRSTUV".split("");

const GAGES_EROTIQUES: string[] = [
  "Un baiser langoureux de 20 secondes 💋",
  "Enlève un vêtement de ton choix 👕",
  "Massage sensuel d'une minute, là où l'autre te dit 💆",
  "Murmure à l'oreille de l'autre une chose dont tu as envie 🤫",
  "Embrasse l'autre dans le cou pendant 30 secondes 😘",
  "Laisse l'autre décider de la suite 😏",
  "Une danse sensuelle de 30 secondes 💃",
  "Mordille gentiment la lèvre ou l'oreille de l'autre 👄",
  "L'autre choisit où tu l'embrasses 💕",
  "À chaque manche perdue, un vêtement en moins 🔥",
  "Strip-tease improvisé de 20 secondes 🎭",
  "Caresse l'autre pendant une minute, sans parler ✨",
];

type Answers = Record<string, string>;

type PVState = {
  game?: "paysville";
  phase?: "intro" | "play" | "reveal" | "dare" | "done";
  letter?: string | null;
  categories?: string[];
  answers_1?: Answers;
  answers_2?: Answers;
  stopped_by?: 1 | 2 | null;
  validation_1?: Record<string, "ok" | "no">;
  validation_2?: Record<string, "ok" | "no">;
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

const update = (roomId: string, p: PVState) =>
  supabase.from("rooms").update({ minigame_state: p }).eq("id", roomId);

async function patch(roomId: string, partial: PVState) {
  const { data } = await supabase.from("rooms").select("minigame_state").eq("id", roomId).maybeSingle();
  const current = (data?.minigame_state ?? {}) as PVState;
  await update(roomId, { ...current, ...partial });
}

function freshReset(): PVState {
  return {
    game: "paysville",
    phase: "intro",
    letter: null,
    categories: CATEGORIES_FIXED.map((c) => c.label),
    answers_1: {}, answers_2: {},
    stopped_by: null,
    validation_1: {}, validation_2: {},
    winner_slot: null, wheel_index: null, dare_text: null,
  };
}

function normFirst(s: string): string {
  const t = (s ?? "").trim();
  if (!t) return "";
  return t[0].normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

// ── Style tokens ─────────────────────────────────────────────────────────────
const NIGHT_BG  = "linear-gradient(160deg, oklch(0.14 0.04 55) 0%, oklch(0.11 0.03 40) 100%)";
const GOLD      = "#fbbf24";
const GOLD_SOFT = "#fde68a";

function Orb({ size, x, y, delay, color }: { size: number; x: string; y: string; delay: number; color: string }) {
  return (
    <motion.div className="pointer-events-none absolute rounded-full"
      style={{ width: size, height: size, left: x, top: y, background: color, filter: `blur(${size * 0.55}px)`, opacity: 0.35 }}
      animate={{ scale: [1, 1.2, 1], opacity: [0.25, 0.45, 0.25], y: [0, -12, 0] }}
      transition={{ duration: 6 + delay, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export function PaysVille({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s = (room.minigame_state ?? {}) as PVState;
  const phase = s.phase ?? "intro";

  useEffect(() => {
    if ((Object.keys(s).length === 0 || s.game !== "paysville") && mySlot === 1)
      void update(room.id, freshReset());
  }, [room.id, s, mySlot]);

  if (phase === "intro")
    return <IntroView state={s} room={room} mySlot={mySlot} otherName={otherName} />;
  if (phase === "play")
    return <PlayView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  if (phase === "reveal")
    return <RevealView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  if (phase === "dare")
    return <DareView state={s} room={room} mySlot={mySlot} otherName={otherName} onDareDone={onDareDone} />;
  return (
    <DoneView state={s} mySlot={mySlot}
      onReplay={async () => { await update(room.id, freshReset()); }}
      onBackToMenu={onBackToMenu}
    />
  );
}

// ── Intro ─────────────────────────────────────────────────────────────────────
function IntroView({ state, room, mySlot, otherName }:
  { state: PVState; room: Room; mySlot: number; otherName: string }) {

  const start = async () => {
    if (mySlot !== 1) return;
    // Tire uniquement la LETTRE — catégories toujours fixes
    const letter =
      pickNonRepeating(LETTERS_POOL, "paysville:letters", (x) => x) ??
      LETTERS_POOL[Math.floor(Math.random() * LETTERS_POOL.length)];
    markItemsUsed("paysville:letters", [letter], (x) => x);
    await patch(room.id, {
      phase: "play",
      letter,
      categories: CATEGORIES_FIXED.map((c) => c.label),
      answers_1: {}, answers_2: {},
      stopped_by: null, validation_1: {}, validation_2: {},
      winner_slot: null, wheel_index: null, dare_text: null,
    });
  };

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: NIGHT_BG }}>
      <Orb size={220} x="-8%" y="-5%" delay={0} color="oklch(0.62 0.18 60)" />
      <Orb size={160} x="62%" y="55%" delay={2} color="oklch(0.55 0.15 45)" />

      <div className="relative z-10 flex flex-1 flex-col px-5 pt-8 pb-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-center mb-7">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: `${GOLD}66` }}>Petit Bac</p>
          <h1 className="mt-2 text-5xl font-semibold leading-tight"
            style={{ fontFamily: "Cormorant Garamond, serif", color: GOLD_SOFT }}>
            Pays · Ville
          </h1>
          <p className="mt-2 text-sm" style={{ color: "rgba(253,240,186,0.45)" }}>
            Remplis toutes les cases en premier. Le premier à finir crie STOP !
          </p>
        </motion.div>

        {/* Categories showcase */}
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
          className="rounded-3xl p-5 mb-5"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-center mb-4"
            style={{ color: `${GOLD}88` }}>
            Catégories (toujours les mêmes)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES_FIXED.map((c, i) => (
              <motion.div key={c.label}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.06 }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                <span className="text-base">{c.emoji}</span>
                <p className="text-sm font-medium" style={{ color: "rgba(253,240,186,0.75)" }}>{c.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Rule pills */}
        <div className="flex gap-2 flex-wrap justify-center mb-6">
          {[
            "Lettre tirée au sort",
            "Réponse valide = commence par la lettre",
            "Réponse unique = +2 pts",
            "Même réponse = +1 pt chacun",
          ].map((r) => (
            <span key={r} className="text-[11px] px-3 py-1 rounded-full"
              style={{ background: `${GOLD}15`, color: `${GOLD}cc`, border: `1px solid ${GOLD}30` }}>
              {r}
            </span>
          ))}
        </div>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          className="mt-auto">
          {mySlot === 1 ? (
            <motion.button whileTap={{ scale: 0.97 }} onClick={start}
              className="w-full h-14 rounded-2xl text-base font-semibold relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, oklch(0.72 0.18 60), oklch(0.60 0.20 45))`,
                color: "oklch(0.15 0.04 55)",
                boxShadow: `0 8px 28px ${GOLD}44`,
              }}>
              <motion.div className="absolute inset-0"
                animate={{ x: ["100%", "-100%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }} />
              <span className="relative z-10 font-bold">Tirer la lettre 🎲</span>
            </motion.button>
          ) : (
            <div className="w-full h-14 rounded-2xl flex items-center justify-center text-sm"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(253,240,186,0.4)" }}>
              <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                {otherName} tire la lettre…
              </motion.span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ── Play ──────────────────────────────────────────────────────────────────────
function PlayView({ state, room, mySlot, otherName }:
  { state: PVState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const letter = state.letter ?? "?";
  const myKey = mySlot === 1 ? "answers_1" : "answers_2";
  const myAnswers = (mySlot === 1 ? state.answers_1 : state.answers_2) ?? {};
  const stopped = !!state.stopped_by;

  const [local, setLocal] = useState<Answers>(myAnswers);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    setLocal(myAnswers);
    setStopping(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.letter]);

  // Debounce sync to Supabase
  useEffect(() => {
    if (stopped) return;
    const id = setTimeout(() => {
      void patch(room.id, { [myKey]: local } as PVState);
    }, 400);
    return () => clearTimeout(id);
  }, [local, room.id, myKey, stopped]);

  const onStop = async () => {
    if (stopping || stopped) return;
    setStopping(true);
    await patch(room.id, {
      [myKey]: local,
      stopped_by: mySlot as 1 | 2,
      phase: "reveal",
    } as PVState);
  };

  const filledCount = CATEGORIES_FIXED.filter((c) => (local[c.label] ?? "").trim().length > 0).length;
  const total = CATEGORIES_FIXED.length;
  const stoppedByOther = stopped && state.stopped_by !== mySlot;

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: NIGHT_BG }}>
      <div className="relative z-10 flex flex-1 flex-col">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 px-4 pt-4 pb-3"
          style={{ background: "linear-gradient(180deg, oklch(0.14 0.04 55) 80%, transparent)" }}>
          <div className="flex items-center justify-between gap-4">
            {/* Big letter */}
            <AnimatePresence mode="wait">
              <motion.div key={letter}
                initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 14 }}
                className="w-16 h-16 flex-shrink-0 flex items-center justify-center rounded-2xl text-4xl font-black"
                style={{
                  background: `linear-gradient(135deg, oklch(0.72 0.18 60), oklch(0.60 0.20 45))`,
                  color: "oklch(0.15 0.04 55)",
                  boxShadow: `0 4px 20px ${GOLD}55`,
                  fontFamily: "Cormorant Garamond, serif",
                }}>
                {letter}
              </motion.div>
            </AnimatePresence>

            {/* Progress + stop */}
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex justify-between text-xs" style={{ color: "rgba(253,240,186,0.5)" }}>
                <span>{filledCount}/{total} remplis</span>
                {stoppedByOther && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: GOLD }}>
                    {otherName} a crié STOP !
                  </motion.span>
                )}
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${GOLD}, oklch(0.72 0.20 45))` }}
                  animate={{ width: `${(filledCount / total) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </div>

          {/* STOP button */}
          {!stopped && (
            <motion.button
              whileTap={!stopping ? { scale: 0.96 } : {}}
              disabled={stopping}
              onClick={onStop}
              className="w-full mt-3 h-12 rounded-2xl text-base font-bold relative overflow-hidden"
              style={{
                background: stopping
                  ? "rgba(255,255,255,0.08)"
                  : "linear-gradient(135deg, oklch(0.55 0.22 25), oklch(0.45 0.22 10))",
                color: stopping ? "rgba(253,240,186,0.3)" : "white",
                boxShadow: stopping ? "none" : "0 4px 18px rgba(220,60,40,0.35)",
              }}>
              {!stopping && (
                <motion.div className="absolute inset-0"
                  animate={{ x: ["100%", "-100%"] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)" }} />
              )}
              <span className="relative z-10">
                {stopping ? "Envoi en cours…" : "STOP ✋ J'ai fini !"}
              </span>
            </motion.button>
          )}
          {stopped && !stoppedByOther && (
            <div className="mt-3 h-12 rounded-2xl flex items-center justify-center text-sm"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(253,240,186,0.35)" }}>
              Tu as crié STOP — en attente de {otherName}…
            </div>
          )}
        </div>

        {/* Input fields */}
        <div className="px-4 pb-8 space-y-3 overflow-y-auto">
          {CATEGORIES_FIXED.map((cat, i) => {
            const val = local[cat.label] ?? "";
            const first = normFirst(val);
            const isValid = !!val.trim() && first === letter;
            const isEmpty = !val.trim();

            let borderColor = "rgba(255,255,255,0.08)";
            let glowColor   = "transparent";
            if (!isEmpty) {
              borderColor = isValid ? "#4ade80" : "oklch(0.62 0.22 25)";
              glowColor   = isValid ? "rgba(74,222,128,0.15)" : "rgba(220,60,40,0.12)";
            }

            return (
              <motion.div key={cat.label}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}>
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1.5px solid ${borderColor}`, boxShadow: `0 0 16px ${glowColor}` }}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-xl flex-shrink-0">{cat.emoji}</span>
                    <div className="flex-1">
                      <p className="text-[10px] uppercase tracking-[0.15em] mb-1"
                        style={{ color: "rgba(253,240,186,0.4)" }}>
                        {cat.label}
                      </p>
                      <input
                        value={val}
                        onChange={(e) => {
                          if (stopped) return;
                          setLocal({ ...local, [cat.label]: e.target.value.slice(0, 30) });
                        }}
                        placeholder={`${cat.label} en ${letter}…`}
                        disabled={stopped}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        className="w-full bg-transparent text-base outline-none placeholder:text-sm"
                        style={{
                          color: isEmpty ? "rgba(253,240,186,0.3)" : isValid ? "#d1fae5" : "#fca5a5",
                          caretColor: GOLD,
                        }}
                        
                      />
                    </div>
                    {/* Validation icon */}
                    <AnimatePresence>
                      {!isEmpty && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                          className="flex-shrink-0 text-lg">
                          {isValid ? "✅" : "❌"}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Score calculation ─────────────────────────────────────────────────────────
function calcScore(state: PVState) {
  const letter = (state.letter ?? "").toUpperCase();
  const a1 = state.answers_1 ?? {};
  const a2 = state.answers_2 ?? {};
  const v1 = state.validation_1 ?? {};
  const v2 = state.validation_2 ?? {};

  let s1 = 0, s2 = 0;
  const details = CATEGORIES_FIXED.map((cat) => {
    const c = cat.label;
    const t1 = (a1[c] ?? "").trim();
    const t2 = (a2[c] ?? "").trim();
    const ok1L = !!t1 && normFirst(t1) === letter;
    const ok2L = !!t2 && normFirst(t2) === letter;
    const ok1 = ok1L && v1[c] !== "no";
    const ok2 = ok2L && v2[c] !== "no";
    let p1 = 0, p2 = 0;
    if (ok1) p1 = 1;
    if (ok2) p2 = 1;
    if (ok1 && ok2) {
      if (t1.toLowerCase() !== t2.toLowerCase()) { p1 += 1; p2 += 1; }
    } else {
      if (ok1 && !ok2) p1 += 1;
      if (ok2 && !ok1) p2 += 1;
    }
    s1 += p1; s2 += p2;
    return { cat, a1: t1, a2: t2, p1, p2, ok1, ok2 };
  });
  return { s1, s2, details };
}

// ── Reveal ────────────────────────────────────────────────────────────────────
function RevealView({ state, room, mySlot, myName, otherName }:
  { state: PVState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const { s1, s2, details } = useMemo(() => calcScore(state), [state]);
  const letter = state.letter ?? "?";

  const toggleRefuse = async (forSlot: 1 | 2, cat: string) => {
    const key = forSlot === 1 ? "validation_1" : "validation_2";
    const cur = ((forSlot === 1 ? state.validation_1 : state.validation_2) ?? {}) as Record<string, "ok" | "no">;
    const next = { ...cur, [cat]: cur[cat] === "no" ? "ok" as const : "no" as const };
    await patch(room.id, { [key]: next } as PVState);
  };

  const goVerdict = async () => {
    if (mySlot !== 1) return;
    let winner: 0 | 1 | 2 = s1 > s2 ? 1 : s2 > s1 ? 2 : 0;
    if (winner === 0) { await patch(room.id, { winner_slot: 0, phase: "dare" }); return; }
    const dareScope = "dare:paysville:erotique";
    const selectedDare = pickNonRepeating(GAGES_EROTIQUES, dareScope, (x) => x);
    if (selectedDare) markItemsUsed(dareScope, [selectedDare], (x) => x);
    const idx = selectedDare ? GAGES_EROTIQUES.indexOf(selectedDare) : 0;
    await patch(room.id, { winner_slot: winner, wheel_index: idx, dare_text: selectedDare ?? GAGES_EROTIQUES[idx], phase: "dare" });
  };

  const myScore  = mySlot === 1 ? s1 : s2;
  const othScore = mySlot === 1 ? s2 : s1;
  const stoppedName = state.stopped_by === mySlot ? myName : state.stopped_by ? otherName : null;
  const maxPossible = CATEGORIES_FIXED.length * 2;

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: NIGHT_BG }}>
      <Orb size={160} x="-5%" y="0%" delay={0} color="oklch(0.62 0.18 60)" />
      <Orb size={120} x="65%" y="55%" delay={2} color="oklch(0.55 0.15 45)" />

      <div className="relative z-10 flex flex-1 flex-col px-4 pt-4 pb-4">
        {/* Score header */}
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-5 mb-4"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Letter badge */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl font-black"
              style={{ background: `linear-gradient(135deg, oklch(0.72 0.18 60), oklch(0.60 0.20 45))`, color: "oklch(0.15 0.04 55)" }}>
              {letter}
            </div>
            <div>
              <p className="text-xs" style={{ color: "rgba(253,240,186,0.4)" }}>Lettre</p>
              {stoppedName && (
                <p className="text-[11px]" style={{ color: GOLD }}>⏱ STOP par {stoppedName}</p>
              )}
            </div>
          </div>

          {/* Score comparison */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { name: myName, score: myScore, isMe: true },
              { name: otherName, score: othScore, isMe: false },
            ]).map((p) => (
              <div key={p.name} className="text-center">
                <p className="text-xs font-semibold mb-1" style={{ color: "rgba(253,240,186,0.65)" }}>{p.name}</p>
                <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}
                  className="text-4xl font-bold" style={{ color: p.isMe ? GOLD : "rgba(253,240,186,0.7)" }}>
                  {p.score}
                </motion.p>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(253,240,186,0.3)" }}>/ {maxPossible} pts</p>
                <div className="h-1.5 rounded-full mt-2" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <motion.div className="h-full rounded-full"
                    style={{ background: p.isMe ? GOLD : "rgba(253,240,186,0.4)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(p.score / maxPossible) * 100}%` }}
                    transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Detail rows */}
        <div className="space-y-2.5 overflow-y-auto flex-1">
          {details.map(({ cat, a1, a2, p1, p2, ok1, ok2 }, i) => {
            const ref1 = (state.validation_1 ?? {})[cat.label] === "no";
            const ref2 = (state.validation_2 ?? {})[cat.label] === "no";
            return (
              <motion.div key={cat.label}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className="rounded-2xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                {/* Cat header */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
                  <span className="text-sm">{cat.emoji}</span>
                  <p className="text-[11px] uppercase tracking-[0.12em] font-semibold"
                    style={{ color: "rgba(253,240,186,0.5)" }}>{cat.label}</p>
                </div>
                {/* Two answers */}
                <div className="grid grid-cols-2 divide-x divide-white/5">
                  {[
                    { text: a1, ok: ok1, pts: p1, slot: 1 as const, refused: ref1, name: mySlot === 1 ? "Toi" : otherName },
                    { text: a2, ok: ok2, pts: p2, slot: 2 as const, refused: ref2, name: mySlot === 2 ? "Toi" : otherName },
                  ].map((side) => (
                    <div key={side.slot} className="px-3 py-2.5">
                      <p className="text-[10px] mb-1" style={{ color: "rgba(253,240,186,0.4)" }}>{side.name}</p>
                      <p className="text-sm font-semibold break-words"
                        style={{ color: side.ok ? "#d1fae5" : side.text ? "#fca5a5" : "rgba(253,240,186,0.2)" }}>
                        {side.text || <span className="italic" style={{ color: "rgba(253,240,186,0.2)" }}>—</span>}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs font-bold"
                          style={{ color: side.pts > 0 ? GOLD : "rgba(253,240,186,0.25)" }}>
                          +{side.pts} pt{side.pts > 1 ? "s" : ""}
                        </span>
                        {side.text && (
                          <button onClick={() => toggleRefuse(side.slot, cat.label)}
                            className="text-[10px] underline"
                            style={{ color: side.refused ? "#f87171" : "rgba(253,240,186,0.3)" }}>
                            {side.refused ? "Annuler" : "Refuser"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Verdict CTA */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="mt-4">
          {mySlot === 1 ? (
            <motion.button whileTap={{ scale: 0.97 }} onClick={goVerdict}
              className="w-full h-14 rounded-2xl text-base font-semibold relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, oklch(0.72 0.18 60), oklch(0.60 0.20 45))`,
                color: "oklch(0.15 0.04 55)",
                boxShadow: `0 8px 28px ${GOLD}44`,
              }}>
              <motion.div className="absolute inset-0"
                animate={{ x: ["100%", "-100%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }} />
              <span className="relative z-10 font-bold">Voir le verdict 🏆</span>
            </motion.button>
          ) : (
            <div className="w-full h-12 rounded-2xl flex items-center justify-center text-sm"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(253,240,186,0.35)" }}>
              {otherName} valide le verdict…
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ── Dare ──────────────────────────────────────────────────────────────────────
function DareView({ state, room, mySlot, otherName, onDareDone }: {
  state: PVState; room: Room; mySlot: number; otherName: string; onDareDone: () => void;
}) {
  const winner = state.winner_slot ?? 0;
  const idx = typeof state.wheel_index === "number" ? state.wheel_index : 0;
  const dare = state.dare_text ?? GAGES_EROTIQUES[idx % GAGES_EROTIQUES.length];

  useEffect(() => {
    if (winner !== 0) confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  }, [winner]);

  // Égalité
  if (winner === 0) {
    return (
      <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: NIGHT_BG }}>
        <Orb size={180} x="-5%" y="10%" delay={0} color="oklch(0.62 0.18 60)" />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center px-6">
          <motion.div initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200 }} className="text-7xl mb-4">🤝</motion.div>
          <h2 className="text-4xl font-semibold" style={{ fontFamily: "Cormorant Garamond, serif", color: GOLD_SOFT }}>
            Égalité 💕
          </h2>
          <p className="mt-2 text-sm" style={{ color: "rgba(253,240,186,0.45)" }}>
            Pas de gage. On remet ça ?
          </p>
          <div className="mt-auto w-full pt-8">
            {mySlot === 1 ? (
              <motion.button whileTap={{ scale: 0.97 }} onClick={async () => { await update(room.id, freshReset()); }}
                className="w-full h-14 rounded-2xl text-base font-bold relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, oklch(0.72 0.18 60), oklch(0.60 0.20 45))`, color: "oklch(0.15 0.04 55)", boxShadow: `0 8px 28px ${GOLD}44` }}>
                <span>Rejouer 🔁</span>
              </motion.button>
            ) : (
              <p className="text-sm text-center" style={{ color: "rgba(253,240,186,0.4)" }}>{otherName} relance…</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const loser = winner === 1 ? 2 : 1;
  const iLost = mySlot === loser;
  const validate = async () => { onDareDone(); await patch(room.id, { phase: "done" }); };

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: NIGHT_BG }}>
      <Orb size={200} x="-10%" y="-5%" delay={0} color={`${GOLD}66`} />
      <Orb size={150} x="60%" y="55%" delay={2} color="oklch(0.55 0.18 45)" />

      <div className="relative z-10 flex flex-1 flex-col items-center px-6 pt-8 pb-6">
        <motion.div initial={{ scale: 0, rotate: -25 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 12, delay: 0.1 }}
          className="text-7xl mb-4">🎁</motion.div>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="mb-5 px-4 py-1.5 rounded-full text-sm font-semibold"
          style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}44` }}>
          Gage coquin 🔥
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-sm mb-4" style={{ color: "rgba(253,240,186,0.5)" }}>
          {iLost ? "Ton gage du soir 👇" : `Gage pour ${otherName} 👇`}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 140 }}
          className="w-full rounded-3xl p-7 text-center"
          style={{
            background: `linear-gradient(145deg, ${GOLD}18, ${GOLD}08)`,
            border: `1.5px solid ${GOLD}40`,
            boxShadow: `0 0 40px ${GOLD}20, 0 16px 48px rgba(0,0,0,0.25)`,
          }}>
          <p className="text-2xl font-medium leading-snug"
            style={{ fontFamily: "Cormorant Garamond, serif", color: GOLD_SOFT }}>
            {dare}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
          className="mt-auto w-full pt-8">
          {iLost ? (
            <motion.button whileTap={{ scale: 0.97 }} onClick={validate}
              className="w-full h-14 rounded-2xl text-base font-bold relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, oklch(0.72 0.18 60), oklch(0.60 0.20 45))`, color: "oklch(0.15 0.04 55)", boxShadow: `0 8px 28px ${GOLD}44` }}>
              <motion.div className="absolute inset-0"
                animate={{ x: ["100%", "-100%"] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }} />
              <span className="relative z-10">C'est fait ! ✅</span>
            </motion.button>
          ) : (
            <div className="w-full h-14 rounded-2xl flex items-center justify-center text-sm"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(253,240,186,0.4)" }}>
              <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                On attend que {otherName} fasse son gage… 🥹
              </motion.span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ── Done ──────────────────────────────────────────────────────────────────────
function DoneView({ state, mySlot, onReplay, onBackToMenu }: {
  state: PVState; mySlot: number; onReplay: () => void; onBackToMenu: () => void;
}) {
  const winner = state.winner_slot ?? 0;
  const iWon = winner === mySlot;

  useEffect(() => {
    if (iWon) confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
  }, [iWon]);

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden" style={{ background: NIGHT_BG }}>
      <Orb size={200} x="-8%" y="-5%" delay={0} color="oklch(0.62 0.18 60)" />
      <Orb size={150} x="60%" y="55%" delay={2} color="oklch(0.55 0.15 45)" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center px-6">
        <motion.div initial={{ scale: 0, rotate: -25 }} animate={{ scale: [0, 1.3, 1], rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 14 }}
          className="text-8xl mb-4">
          {iWon ? "🏆" : "💖"}
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="text-4xl font-semibold"
          style={{ fontFamily: "Cormorant Garamond, serif", color: iWon ? GOLD_SOFT : "#fde8ee" }}>
          {iWon ? "Tu as gagné ! 🎉" : "Bravo pour le gage 😘"}
        </motion.h2>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="mt-auto w-full space-y-3 pt-10">
          <motion.button whileTap={{ scale: 0.97 }} onClick={onReplay}
            className="w-full h-14 rounded-2xl text-base font-bold relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, oklch(0.72 0.18 60), oklch(0.60 0.20 45))`, color: "oklch(0.15 0.04 55)", boxShadow: `0 8px 28px ${GOLD}44` }}>
            <motion.div className="absolute inset-0"
              animate={{ x: ["100%", "-100%"] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "linear" }}
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }} />
            <span className="relative z-10">Rejouer (nouvelle lettre) 🔁</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={onBackToMenu}
            className="w-full h-12 rounded-2xl text-sm"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(253,240,186,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
            ← Retour au menu
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
