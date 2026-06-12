import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";
import { GAGES_BY_LEVEL, getGagesPool, LEVEL_LABELS, type DareLevel } from "@/lib/game-content";
import { markItemsUsed, nonRepeatingSample, pickNonRepeating } from "@/lib/non-repeating";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ─────────── RÉGLAGES ───────────
const NB_RIDDLES = 6;
const ROUND_DURATION_MS = 45_000;

const RIDDLES: { q: string; answers: string[] }[] = [
  { q: "Plus on en enlève, plus il devient grand. Qu'est-ce que c'est ?", answers: ["un trou", "trou"] },
  { q: "Je cours toujours mais je n'ai pas de jambes, j'ai un lit mais je ne dors jamais. Qui suis-je ?", answers: ["la riviere", "riviere", "un fleuve", "fleuve", "une riviere"] },
  { q: "Qu'est-ce qui se casse quand on le dit ?", answers: ["le silence", "silence"] },
  { q: "J'ai des villes mais pas de maisons, des forets mais pas d'arbres, de l'eau mais pas de poissons. Qui suis-je ?", answers: ["une carte", "carte", "une carte geographique", "carte geographique"] },
  { q: "Qu'est-ce qui a un cou mais pas de tete ?", answers: ["une bouteille", "bouteille"] },
  { q: "Plus je seche, plus je suis mouillee. Qui suis-je ?", answers: ["la serviette", "serviette", "une serviette"] },
  { q: "Qu'est-ce qui monte mais ne redescend jamais ?", answers: ["lage", "l age", "age", "l'age"] },
  { q: "Le matin il marche a 4 pattes, a midi a 2, le soir a 3. Qui est-ce ?", answers: ["lhomme", "homme", "l'homme", "l etre humain", "letre humain", "etre humain"] },
  { q: "Plus tu me partages, plus je grandis. Qu'est-ce que c'est ?", answers: ["lamour", "amour", "l'amour", "le bonheur", "bonheur"] },
  { q: "Qu'est-ce qui appartient a toi mais que les autres utilisent plus que toi ?", answers: ["ton prenom", "ton nom", "prenom", "nom", "mon prenom", "mon nom"] },
  { q: "Je n'ai pas d'yeux mais autrefois j'ai vu. Maintenant je n'ai plus rien mais je reste utile. Qui suis-je ?", answers: ["une aiguille", "aiguille"] },
  { q: "Quel est l'animal le plus heureux ?", answers: ["le hibou", "hibou"] },
];

const LEVEL_INFO: Record<DareLevel, { emoji: string; gradient: string; desc: string }> = {
  simple: { emoji: "🟢", gradient: "from-emerald-200 to-teal-200", desc: "Doux et mignon" },
  medium: { emoji: "🟡", gradient: "from-amber-200 to-orange-300", desc: "Un peu plus piquant" },
  ultra:  { emoji: "🔴", gradient: "from-rose-300 to-red-400",     desc: "Hot et sans tabou" },
};

type FirstCorrect = { slot: 1 | 2; ts: number; text: string } | null;
type Override = "winner_1" | "winner_2" | "none" | null;

type RState = {
  game?: "riddles";
  phase?: "level_select" | "play" | "result" | "dare" | "done";
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

const update = (roomId: string, p: RState) =>
  supabase.from("rooms").update({ minigame_state: p }).eq("id", roomId);

async function patch(roomId: string, partial: RState) {
  const { data } = await supabase.from("rooms").select("minigame_state").eq("id", roomId).maybeSingle();
  const current = (data?.minigame_state ?? {}) as RState;
  await update(roomId, { ...current, ...partial });
}

function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function checkAnswer(text: string, answers: string[]): boolean {
  const n = normalize(text);
  if (!n) return false;
  return answers.some((a) => normalize(a) === n);
}

function freshReset(): RState {
  return {
    game: "riddles",
    phase: "level_select",
    level_1: null, level_2: null, level: null,
    order: [], index: 0,
    started_at: null,
    attempt_1: null, attempt_2: null,
    first_correct: null,
    round_done: false,
    override: null,
    score_1: 0, score_2: 0,
    winner_slot: null, wheel_index: null, dare_text: null,
  };
}

export function Riddles({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s = (room.minigame_state ?? {}) as RState;
  const phase = s.phase ?? "level_select";

  useEffect(() => {
    if ((Object.keys(s).length === 0 || s.game !== "riddles") && mySlot === 1) {
      void update(room.id, freshReset());
    }
  }, [room.id, s, mySlot]);

  if (phase === "level_select") {
    return <LevelSelect state={s} room={room} mySlot={mySlot} otherName={otherName} />;
  }
  if (phase === "play" || phase === "result") {
    return <PlayView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  }
  if (phase === "dare") {
    return <DareView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onDareDone={onDareDone} />;
  }
  return <DoneView state={s} mySlot={mySlot} myName={myName} otherName={otherName} onReplay={async () => { await update(room.id, freshReset()); }} onBackToMenu={onBackToMenu} />;
}

// ─────────── Choix du niveau ───────────
function LevelSelect({ state, room, mySlot, otherName }:
  { state: RState; room: Room; mySlot: number; otherName: string }) {
  const mine = mySlot === 1 ? state.level_1 : state.level_2;
  const theirs = mySlot === 1 ? state.level_2 : state.level_1;
  const both = state.level_1 && state.level_2;
  const match = both && state.level_1 === state.level_2;

  const choose = async (l: DareLevel) => {
    await patch(room.id, mySlot === 1 ? { level_1: l } : { level_2: l });
  };

  const start = async () => {
    if (!match || mySlot !== 1) return;
    const chosen = state.level_1 as DareLevel;
    const picked = nonRepeatingSample(RIDDLES, Math.min(NB_RIDDLES, RIDDLES.length), `riddles:${chosen}`, (r) => r.q);
    markItemsUsed(`riddles:${chosen}`, picked, (r) => r.q);
    const idxs = picked.map((riddle) => RIDDLES.indexOf(riddle));
    await patch(room.id, {
      phase: "play",
      level: chosen,
      order: idxs,
      index: 0,
      started_at: Date.now(),
      attempt_1: null, attempt_2: null,
      first_correct: null,
      round_done: false,
      override: null,
      score_1: 0, score_2: 0,
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Duel de devinettes</p>
        <h1 className="mt-1 font-script text-4xl text-primary">Énigmes à deux 🧩</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Choisissez ensemble le niveau du gage final :
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        {(Object.keys(LEVEL_INFO) as DareLevel[]).map((l) => {
          const info = LEVEL_INFO[l];
          const iPicked = mine === l;
          const theyPicked = theirs === l;
          return (
            <motion.button
              key={l}
              whileTap={{ scale: 0.97 }}
              onClick={() => choose(l)}
              className={`flex items-center gap-4 rounded-3xl border-2 p-4 text-left shadow-md bg-gradient-to-br ${info.gradient} ${iPicked ? "border-primary ring-2 ring-primary/40" : "border-white/60"}`}
            >
              <span className="text-4xl">{info.emoji}</span>
              <div className="flex-1">
                <p className="font-script text-2xl text-foreground/90">{LEVEL_LABELS[l]}</p>
                <p className="text-[11px] text-foreground/70">{info.desc}</p>
                <div className="mt-1 flex gap-2 text-[11px] font-medium">
                  {iPicked && <span className="rounded-full bg-white/80 px-2 py-0.5">Toi ✓</span>}
                  {theyPicked && <span className="rounded-full bg-white/80 px-2 py-0.5">{otherName} ✓</span>}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-4 text-center text-sm">
        {!both && <p className="text-muted-foreground">En attente que vous choisissiez tous les deux…</p>}
        {both && !match && <p className="text-rose-500">Vous n'avez pas choisi le même niveau 🙈</p>}
        {match && mySlot !== 1 && <p className="text-muted-foreground">{otherName} démarre la partie…</p>}
      </div>

      <div className="mt-auto pt-8">
        {match && mySlot === 1 && (
          <Button onClick={start} className="h-14 w-full rounded-2xl text-base font-semibold">
            C'est parti 🧩
          </Button>
        )}
      </div>
    </div>
  );
}

// ─────────── Play ───────────
function PlayView({ state, room, mySlot, myName, otherName }:
  { state: RState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const order = state.order ?? [];
  const index = state.index ?? 0;
  const riddleIdx = order[index] ?? 0;
  const riddle = RIDDLES[riddleIdx];
  const started = state.started_at ?? Date.now();
  const firstCorrect = state.first_correct ?? null;
  const isResult = state.phase === "result";
  const myAttemptKey = mySlot === 1 ? "attempt_1" : "attempt_2";
  const myAttempt = mySlot === 1 ? state.attempt_1 : state.attempt_2;

  const [text, setText] = useState("");
  const [now, setNow] = useState(Date.now());

  // ticking timer
  useEffect(() => {
    if (isResult) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [isResult]);

  // reset local text on round change
  useEffect(() => { setText(""); }, [index, state.phase]);

  const remaining = Math.max(0, ROUND_DURATION_MS - (now - started));
  const secLeft = Math.ceil(remaining / 1000);

  // Authority (slot 1) closes round on timeout
  useEffect(() => {
    if (mySlot !== 1) return;
    if (isResult) return;
    if (firstCorrect) return;
    if (remaining > 0) return;
    void patch(room.id, { phase: "result", round_done: true });
  }, [mySlot, isResult, firstCorrect, remaining, room.id]);

  const submit = async () => {
    if (!text.trim() || isResult) return;
    if (firstCorrect) return;
    const ok = checkAnswer(text, riddle.answers);
    const now2 = Date.now();
    const att = { text: text.trim(), ok, ts: now2 };
    // record attempt
    if (ok) {
      // claim victory only if still nobody got it (re-read)
      const { data } = await supabase.from("rooms").select("minigame_state").eq("id", room.id).maybeSingle();
      const cur = (data?.minigame_state ?? {}) as RState;
      if (!cur.first_correct) {
        const sKey = mySlot === 1 ? "score_1" : "score_2";
        const curScore = (mySlot === 1 ? cur.score_1 : cur.score_2) ?? 0;
        await update(room.id, {
          ...cur,
          [myAttemptKey]: att,
          first_correct: { slot: mySlot as 1 | 2, ts: now2, text: att.text },
          phase: "result",
          round_done: true,
          [sKey]: curScore + 1,
        } as RState);
      } else {
        await patch(room.id, { [myAttemptKey]: att } as RState);
      }
    } else {
      await patch(room.id, { [myAttemptKey]: att } as RState);
      setText("");
    }
  };

  const overrideToWinner = async (slot: 1 | 2) => {
    if (mySlot !== 1) return;
    const cur = state;
    const prevWinner = cur.first_correct?.slot ?? null;
    if (prevWinner === slot) return;
    let s1 = cur.score_1 ?? 0;
    let s2 = cur.score_2 ?? 0;
    if (prevWinner === 1) s1 = Math.max(0, s1 - 1);
    if (prevWinner === 2) s2 = Math.max(0, s2 - 1);
    if (slot === 1) s1 += 1; else s2 += 1;
    await patch(room.id, {
      first_correct: { slot, ts: Date.now(), text: (slot === 1 ? cur.attempt_1?.text : cur.attempt_2?.text) ?? "" },
      score_1: s1, score_2: s2,
      override: slot === 1 ? "winner_1" : "winner_2",
    });
  };

  const cancelWin = async () => {
    if (mySlot !== 1) return;
    const cur = state;
    const prev = cur.first_correct?.slot;
    if (!prev) return;
    let s1 = cur.score_1 ?? 0;
    let s2 = cur.score_2 ?? 0;
    if (prev === 1) s1 = Math.max(0, s1 - 1);
    if (prev === 2) s2 = Math.max(0, s2 - 1);
    await patch(room.id, {
      first_correct: null,
      score_1: s1, score_2: s2,
      override: "none",
    });
  };

  const isLast = index >= order.length - 1;

  const next = async () => {
    if (mySlot !== 1) return;
    if (isLast) {
      // verdict
      const s1 = state.score_1 ?? 0;
      const s2 = state.score_2 ?? 0;
      let winner: 0 | 1 | 2 = 0;
      if (s1 > s2) winner = 1;
      else if (s2 > s1) winner = 2;
      if (winner === 0) {
        await patch(room.id, { phase: "dare", winner_slot: 0 });
        return;
      }
      const level = (state.level ?? "simple") as DareLevel;
      const pool = (getGagesPool(room.ambiance, level) ?? GAGES_BY_LEVEL[level]);
      const dareScope = `dare:riddles:${room.ambiance ?? "irl"}:${level}`;
      const selectedDare = pickNonRepeating(pool, dareScope, (x) => x);
      if (selectedDare) markItemsUsed(dareScope, [selectedDare], (x) => x);
      const idx = selectedDare ? pool.indexOf(selectedDare) : 0;
      await patch(room.id, {
        phase: "dare",
        winner_slot: winner,
        wheel_index: idx,
        dare_text: selectedDare ?? pool[idx],
      });
    } else {
      await patch(room.id, {
        phase: "play",
        index: index + 1,
        started_at: Date.now(),
        attempt_1: null, attempt_2: null,
        first_correct: null,
        round_done: false,
        override: null,
      });
    }
  };

  const otherAttempt = mySlot === 1 ? state.attempt_2 : state.attempt_1;
  const score1 = state.score_1 ?? 0;
  const score2 = state.score_2 ?? 0;
  const myScore = mySlot === 1 ? score1 : score2;
  const otherScore = mySlot === 1 ? score2 : score1;

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Énigme {index + 1} / {order.length}
        </p>
        <div className="mt-1 flex items-center justify-center gap-3 text-sm">
          <span className="font-semibold text-primary">{myName} {myScore}</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-semibold">{otherName} {otherScore}</span>
        </div>
        {!isResult && (
          <div className="mx-auto mt-2 flex h-9 w-20 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700">
            ⏱ {secLeft}s
          </div>
        )}
      </div>

      <motion.div
        key={`${index}-${state.phase}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-5 rounded-3xl bg-gradient-to-br from-rose-100 to-pink-200 p-5 shadow-md"
      >
        <p className="text-center font-script text-2xl leading-snug text-foreground/90">
          {riddle.q}
        </p>
      </motion.div>

      {!isResult && (
        <div className="mt-5 space-y-3">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 60))}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Ta réponse…"
            className="h-12 text-base"
            autoFocus
            autoComplete="off"
          />
          <Button onClick={submit} disabled={!text.trim()} className="h-12 w-full rounded-2xl text-base font-semibold">
            Répondre ✨
          </Button>

          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <AttemptBadge label="Toi" attempt={myAttempt ?? null} />
            <AttemptBadge label={otherName} attempt={otherAttempt ?? null} hideText />
          </div>
        </div>
      )}

      {isResult && (
        <ResultBlock
          state={state}
          mySlot={mySlot}
          myName={myName}
          otherName={otherName}
          riddleAnswers={riddle.answers}
          onNext={next}
          isLast={isLast}
          onOverrideMe={() => overrideToWinner(mySlot as 1 | 2)}
          onOverrideOther={() => overrideToWinner((mySlot === 1 ? 2 : 1) as 1 | 2)}
          onCancelWin={cancelWin}
        />
      )}
    </div>
  );
}

function AttemptBadge({ label, attempt, hideText }: { label: string; attempt: { text: string; ok: boolean } | null; hideText?: boolean }) {
  if (!attempt) {
    return (
      <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-card/60 p-2 text-center">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <p className="text-xs italic text-muted-foreground">en réflexion…</p>
      </div>
    );
  }
  return (
    <div className={`rounded-xl border p-2 text-center ${attempt.ok ? "border-emerald-300 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
      <span className="text-[10px] uppercase tracking-wider text-foreground/60">{label}</span>
      <p className="truncate text-xs font-semibold text-foreground/90">
        {hideText ? (attempt.ok ? "✓ a trouvé !" : "essai…") : attempt.text}
      </p>
    </div>
  );
}

function ResultBlock({ state, mySlot, myName, otherName, riddleAnswers, onNext, isLast, onOverrideMe, onOverrideOther, onCancelWin }:
  { state: RState; mySlot: number; myName: string; otherName: string; riddleAnswers: string[]; onNext: () => void; isLast: boolean; onOverrideMe: () => void; onOverrideOther: () => void; onCancelWin: () => void; }) {
  const fc = state.first_correct;
  const winnerName = fc ? (fc.slot === mySlot ? myName : otherName) : null;

  useEffect(() => {
    if (fc) confetti({ particleCount: 40, spread: 60, origin: { y: 0.5 } });
  }, [fc]);

  return (
    <div className="mt-5 flex flex-1 flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={fc ? `w-${fc.slot}` : "none"}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-3xl bg-card/80 p-4 text-center shadow-md"
        >
          {fc ? (
            <>
              <p className="text-3xl">🎉</p>
              <p className="mt-1 font-script text-2xl text-primary">{winnerName} a trouvé en premier !</p>
              <p className="mt-1 text-xs text-muted-foreground">Réponse : « {fc.text} »</p>
            </>
          ) : (
            <>
              <p className="text-3xl">⏰</p>
              <p className="mt-1 font-script text-2xl text-foreground/80">Personne n'a trouvé…</p>
              <p className="mt-1 text-xs text-muted-foreground">Réponse acceptée : « {riddleAnswers[0]} »</p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <AttemptBadge label={mySlot === 1 ? "Toi" : otherName} attempt={state.attempt_1 ?? null} />
        <AttemptBadge label={mySlot === 2 ? "Toi" : otherName} attempt={state.attempt_2 ?? null} />
      </div>

      {mySlot === 1 && (
        <div className="mt-3 rounded-2xl border border-dashed border-muted-foreground/30 bg-card/40 p-3 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Arbitrage (slot 1)</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs">
            <Button size="sm" variant="secondary" onClick={onOverrideMe}>Donner à {myName}</Button>
            <Button size="sm" variant="secondary" onClick={onOverrideOther}>Donner à {otherName}</Button>
            {fc && <Button size="sm" variant="ghost" onClick={onCancelWin}>Annuler le point</Button>}
          </div>
        </div>
      )}

      <div className="mt-auto pt-4">
        {mySlot === 1 ? (
          <Button onClick={onNext} className="h-14 w-full rounded-2xl text-base font-semibold">
            {isLast ? "Voir le verdict 🏆" : "Suivante ➡️"}
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">{otherName} enchaîne…</p>
        )}
      </div>
    </div>
  );
}

// ─────────── Gage ───────────
function DareView({ state, room, mySlot, myName, otherName, onDareDone }:
  { state: RState; room: Room; mySlot: number; myName: string; otherName: string; onDareDone: () => void }) {
  const winner = state.winner_slot ?? 0;
  const dare = state.dare_text ?? "Un câlin tout doux 🤗";

  useEffect(() => {
    if (winner !== 0) confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  }, [winner]);

  if (winner === 0) {
    const replay = async () => { await update(room.id, freshReset()); };
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-7xl">🤝</motion.div>
        <h2 className="mt-4 font-script text-3xl text-primary">Match nul 💕</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {myName} {mySlot === 1 ? state.score_1 : state.score_2} · {otherName} {mySlot === 1 ? state.score_2 : state.score_1} — pas de gage.
        </p>
        {mySlot === 1 ? (
          <Button onClick={replay} className="mt-8 h-14 w-full max-w-xs rounded-2xl text-base font-semibold">
            Rejouer 🔁
          </Button>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">{otherName} relance…</p>
        )}
      </div>
    );
  }

  const loser = winner === 1 ? 2 : 1;
  const iLost = mySlot === loser;
  const validate = async () => {
    onDareDone();
    await patch(room.id, { phase: "done" });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="text-6xl">🎁</motion.div>
      <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
        {iLost ? "Ton gage" : `Gage pour ${otherName}`}
      </p>
      <h2 className="mt-3 font-script text-3xl leading-tight text-primary px-4">{dare}</h2>
      {iLost ? (
        <Button onClick={validate} className="mt-10 h-14 w-full max-w-xs rounded-2xl text-base font-semibold">
          C'est fait ! ✅
        </Button>
      ) : (
        <p className="mt-8 text-muted-foreground">On attend que {otherName} fasse son gage… 🥹</p>
      )}
    </div>
  );
}

// ─────────── Done ───────────
function DoneView({ state, mySlot, myName, otherName, onReplay, onBackToMenu }:
  { state: RState; mySlot: number; myName: string; otherName: string; onReplay: () => void; onBackToMenu: () => void }) {
  const winner = state.winner_slot ?? 0;
  const s1 = state.score_1 ?? 0;
  const s2 = state.score_2 ?? 0;
  const myScore = mySlot === 1 ? s1 : s2;
  const otherScore = mySlot === 1 ? s2 : s1;

  const verdict = useMemo(() => {
    if (winner === 0) return "Match nul 🤝";
    const wn = winner === mySlot ? myName : otherName;
    return `${wn} remporte le duel 👑`;
  }, [winner, mySlot, myName, otherName]);

  useEffect(() => {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} className="text-8xl">
        {winner === mySlot ? "🏆" : "💖"}
      </motion.div>
      <h2 className="mt-6 font-script text-3xl text-primary px-4">{verdict}</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        {myName} {myScore} · {otherName} {otherScore}
      </p>
      <div className="mt-8 w-full max-w-xs space-y-3">
        <Button onClick={onReplay} className="h-14 w-full rounded-2xl text-base font-semibold">
          Rejouer 🔁
        </Button>
        <Button variant="secondary" onClick={onBackToMenu} className="h-12 w-full rounded-2xl">
          ← Retour au menu
        </Button>
      </div>
    </div>
  );
}
