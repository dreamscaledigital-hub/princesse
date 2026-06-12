import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";
import { GAGES_BY_LEVEL, getGagesPool, LEVEL_LABELS, type DareLevel } from "@/lib/game-content";
import { useGenerateAIContent, type AIMostLikely, type Ambiance } from "@/lib/use-ai-content";
import { markItemsUsed, nonRepeatingSample, pickNonRepeating, shuffle } from "@/lib/non-repeating";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ─────────── RÉGLAGES ───────────
const NB_QUESTIONS = 10;

const STATEMENTS: string[] = [
  "pleurer devant un film romantique 🥲",
  "envoyer un message coquin en pleine journée 😏",
  "oublier un anniversaire important 🙈",
  "prendre la dernière part de gâteau sans demander 🍰",
  "chanter sous la douche à tue-tête 🚿",
  "s'endormir le premier devant un film 😴",
  "rougir pour un compliment osé 😳",
  "faire une déclaration d'amour en public 💌",
  "prendre l'initiative au lit ce soir 🔥",
  "envoyer un selfie sexy au boulot 📸",
  "parler dans son sommeil 💤",
  "exploser de rire au mauvais moment 🤣",
  "perdre ses clés trois fois dans la semaine 🔑",
  "réserver un week-end surprise 🧳",
  "draguer l'autre devant ses amis 😘",
  "tenter une nouvelle position 😈",
  "faire la grasse matinée jusqu'à midi ☀️",
  "voler la couette pendant la nuit 🛏️",
  "préparer un petit-déj au lit 🥐",
  "regarder son téléphone pendant un câlin 📱",
  "tomber amoureux/se au premier regard 💘",
  "dire « je t'aime » en premier après une dispute 💕",
  "envoyer une photo coquine en story par erreur 😱",
  "embrasser l'autre en public sans prévenir 💋",
  "préférer rester au lit toute la journée ensemble 🛌",
  "faire l'amour dans un lieu insolite 🌳",
  "oser un strip-tease improvisé 🎭",
  "dévorer l'autre du regard sans s'en rendre compte 👀",
  "craquer le premier dans un défi sans se toucher ✋",
  "raconter un fantasme jamais avoué auparavant 🤫",
];

const LEVEL_INFO: Record<DareLevel, { emoji: string; gradient: string; desc: string }> = {
  simple: { emoji: "🟢", gradient: "from-emerald-200 to-teal-200", desc: "Doux et mignon" },
  medium: { emoji: "🟡", gradient: "from-amber-200 to-orange-300", desc: "Un peu plus piquant" },
  ultra:  { emoji: "🔴", gradient: "from-rose-300 to-red-400",     desc: "Hot et sans tabou" },
};

type MLState = {
  game?: "mostlikely";
  phase?: "level_select" | "loading" | "play" | "reveal" | "dare" | "done";
  level_1?: DareLevel | null;
  level_2?: DareLevel | null;
  level?: DareLevel | null;
  order?: number[];
  index?: number;
  vote_1?: 1 | 2 | null;
  vote_2?: 1 | 2 | null;
  designations?: { "1": number; "2": number };
  agreements?: number;
  winner_slot?: 0 | 1 | 2 | null;
  wheel_index?: number | null;
  dare_text?: string | null;
  ai_statements?: string[] | null;
};

type Props = {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
  onDareDone: () => void;
};

const update = (roomId: string, patch: MLState) =>
  supabase.from("rooms").update({ minigame_state: patch }).eq("id", roomId);

async function patch(roomId: string, partial: MLState) {
  const { data } = await supabase.from("rooms").select("minigame_state").eq("id", roomId).maybeSingle();
  const current = (data?.minigame_state ?? {}) as MLState;
  await update(roomId, { ...current, ...partial });
}

function freshReset(): MLState {
  return {
    game: "mostlikely",
    phase: "level_select",
    level_1: null, level_2: null, level: null,
    order: [], index: 0,
    vote_1: null, vote_2: null,
    designations: { "1": 0, "2": 0 },
    agreements: 0,
    winner_slot: null, wheel_index: null, dare_text: null,
  };
}

export function MostLikely({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s = (room.minigame_state ?? {}) as MLState;
  const phase = s.phase ?? "level_select";

  useEffect(() => {
    if ((Object.keys(s).length === 0 || s.game !== "mostlikely") && mySlot === 1) {
      void update(room.id, freshReset());
    }
  }, [room.id, s, mySlot]);

  if (phase === "level_select") {
    return <LevelSelect state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  }
  if (phase === "loading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.2 }} className="text-7xl">🤔</motion.div>
        <p className="mt-4 font-script text-2xl text-primary">L'IA invente vos affirmations…</p>
        <p className="mt-1 text-xs text-muted-foreground">Une fournée fraîche pour vous deux ✨</p>
      </div>
    );
  }
  if (phase === "play" || phase === "reveal") {
    return <PlayView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  }
  if (phase === "dare") {
    return <DareView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} onDareDone={onDareDone} />;
  }
  return <DoneView state={s} mySlot={mySlot} myName={myName} otherName={otherName} onReplay={async () => { await update(room.id, freshReset()); }} onBackToMenu={onBackToMenu} />;
}

// ─────────── Choix du niveau ───────────
function LevelSelect({ state, room, mySlot, myName, otherName }:
  { state: MLState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const mine = mySlot === 1 ? state.level_1 : state.level_2;
  const theirs = mySlot === 1 ? state.level_2 : state.level_1;
  const both = state.level_1 && state.level_2;
  const match = both && state.level_1 === state.level_2;

  const generate = useGenerateAIContent();

  const choose = async (l: DareLevel) => {
    await patch(room.id, mySlot === 1 ? { level_1: l } : { level_2: l });
  };

  const start = async () => {
    if (!match || mySlot !== 1) return;
    const chosen = state.level_1 as DareLevel;
    const ambiance: Ambiance = chosen === "simple" ? "mignon" : chosen === "medium" ? "coquin" : "hot";

    await patch(room.id, { phase: "loading", level: chosen });
    const questionScope = `mostlikely:${chosen}`;
    const ai = await generate<AIMostLikely>("mostlikely", ambiance, NB_QUESTIONS * 3);

    const list = ai?.statements?.length ? nonRepeatingSample(ai.statements, NB_QUESTIONS, questionScope, (x) => x) : null;
    if (list) {
      markItemsUsed(questionScope, list, (x) => x);
      await patch(room.id, {
        phase: "play",
        level: chosen,
        ai_statements: list,
        order: list.map((_, i) => i),
        index: 0,
        vote_1: null, vote_2: null,
        designations: { "1": 0, "2": 0 },
        agreements: 0,
      });
    } else {
      const picked = nonRepeatingSample(STATEMENTS, Math.min(NB_QUESTIONS, STATEMENTS.length), `${questionScope}:local`, (x) => x);
      markItemsUsed(`${questionScope}:local`, picked, (x) => x);
      const idxs = picked.map((statement) => STATEMENTS.indexOf(statement));
      await patch(room.id, {
        phase: "play",
        level: chosen,
        ai_statements: null,
        order: idxs,
        index: 0,
        vote_1: null, vote_2: null,
        designations: { "1": 0, "2": 0 },
        agreements: 0,
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Qui est le plus susceptible de…</p>
        <h1 className="mt-1 font-script text-4xl text-primary">À deux, on vote 💞</h1>
        <p className="mt-2 text-xs text-muted-foreground">Choisissez le niveau du gage final ensemble :</p>
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
        <p>
          <span className="font-semibold">{myName}</span> : {mine ? LEVEL_LABELS[mine] : "—"} ·{" "}
          <span className="font-semibold">{otherName}</span> : {theirs ? LEVEL_LABELS[theirs] : "—"}
        </p>
        {both && !match && <p className="mt-2 text-muted-foreground">Mettez-vous d'accord 😅</p>}
      </div>

      <div className="mt-auto pt-6">
        <Button disabled={!match || mySlot !== 1} onClick={start} className="h-14 w-full rounded-2xl text-base font-semibold">
          {match ? (mySlot === 1 ? "C'est parti ! 💕" : `${otherName} va lancer…`) : "En attente du niveau commun…"}
        </Button>
      </div>
    </div>
  );
}

// ─────────── Phase de vote ───────────
function PlayView({ state, room, mySlot, myName, otherName }:
  { state: MLState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const order = state.order ?? [];
  const idx = state.index ?? 0;
  const sIdx = order[idx];
  const bank: string[] = state.ai_statements?.length ? state.ai_statements : STATEMENTS;
  const statement = sIdx != null ? bank[sIdx] : null;

  const myVote = (mySlot === 1 ? state.vote_1 : state.vote_2) ?? null;
  const otherVote = (mySlot === 1 ? state.vote_2 : state.vote_1) ?? null;
  const bothVoted = !!state.vote_1 && !!state.vote_2;
  const same = bothVoted && state.vote_1 === state.vote_2;
  const total = order.length;
  const isLast = idx >= total - 1;
  const designations = state.designations ?? { "1": 0, "2": 0 };
  const agreements = state.agreements ?? 0;

  const name1 = mySlot === 1 ? myName : otherName;
  const name2 = mySlot === 2 ? myName : otherName;

  // Transition vers reveal et incrémentation des compteurs (autorité = slot 1)
  useEffect(() => {
    if (state.phase === "play" && bothVoted && mySlot === 1) {
      const nextDes = { ...designations };
      let nextAgree = agreements;
      if (same) {
        const designated = state.vote_1 as 1 | 2;
        nextDes[String(designated) as "1" | "2"] += 1;
        nextAgree += 1;
      }
      void patch(room.id, { phase: "reveal", designations: nextDes, agreements: nextAgree });
    }
  }, [state.phase, bothVoted, same, mySlot, room.id, designations, agreements, state.vote_1]);

  useEffect(() => {
    if (state.phase === "reveal" && same) {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
    }
  }, [state.phase, same]);

  const vote = async (slot: 1 | 2) => {
    if (myVote) return;
    await patch(room.id, mySlot === 1 ? { vote_1: slot } : { vote_2: slot });
  };

  const next = async () => {
    if (mySlot !== 1) return;
    if (isLast) {
      // Déterminer le gagnant (le plus désigné), tirer le gage
      const d = state.designations ?? { "1": 0, "2": 0 };
      let winner: 0 | 1 | 2 = 0;
      if (d["1"] > d["2"]) winner = 1;
      else if (d["2"] > d["1"]) winner = 2;
      else winner = 0;
      const level = (state.level ?? "simple") as DareLevel;
      const pool = (getGagesPool(room.ambiance, level) ?? GAGES_BY_LEVEL[level]) ?? [];
      const dareScope = `dare:mostlikely:${room.ambiance ?? "irl"}:${level}`;
      const selectedDare = pickNonRepeating(pool, dareScope, (x) => x);
      if (selectedDare) markItemsUsed(dareScope, [selectedDare], (x) => x);
      const wi = selectedDare ? pool.indexOf(selectedDare) : 0;
      await patch(room.id, {
        phase: "dare",
        winner_slot: winner,
        wheel_index: wi,
        dare_text: selectedDare ?? null,
      });
    } else {
      await patch(room.id, { phase: "play", index: idx + 1, vote_1: null, vote_2: null });
    }
  };

  if (!statement) return null;
  const reveal = state.phase === "reveal";

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Question {idx + 1} / {total}</span>
        <span>🤝 {agreements} d'accord</span>
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Qui est le plus susceptible de…</p>
        <h2 className="mt-2 font-script text-2xl leading-snug text-primary px-2">{statement}</h2>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {([1, 2] as const).map((slot) => {
          const label = slot === 1 ? name1 : name2;
          const iPicked = myVote === slot;
          const theyPicked = reveal && otherVote === slot;
          const grad = slot === 1
            ? "from-rose-200 to-pink-300"
            : "from-violet-200 to-fuchsia-300";
          return (
            <motion.button
              key={slot}
              whileTap={{ scale: myVote ? 1 : 0.95 }}
              disabled={!!myVote}
              onClick={() => vote(slot)}
              className={`relative rounded-3xl border-2 p-5 text-center shadow-md bg-gradient-to-br ${grad}
                ${iPicked ? "border-primary ring-2 ring-primary/50" : "border-white/60"}
                ${myVote && !iPicked ? "opacity-60" : ""}`}
            >
              <div className="text-4xl">{slot === 1 ? "💖" : "💜"}</div>
              <p className="mt-2 font-script text-2xl text-foreground/90">{label}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-1 text-[11px] font-medium">
                {iPicked && <span className="rounded-full bg-white/80 px-2 py-0.5">Toi 💚</span>}
                {theyPicked && <span className="rounded-full bg-white/80 px-2 py-0.5">{otherName} 🧡</span>}
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-5 min-h-[80px] text-center">
        <AnimatePresence mode="wait">
          {!myVote && (
            <motion.p key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-sm text-muted-foreground">Vote en secret 🤫</motion.p>
          )}
          {myVote && !reveal && (
            <motion.p key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-sm text-muted-foreground">{otherName} vote… 👀</motion.p>
          )}
          {reveal && same && (
            <motion.div key="same" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <p className="font-script text-2xl text-primary">D'accord ! 💕</p>
              <p className="text-xs text-muted-foreground">
                +1 désignation pour {(state.vote_1 === 1) ? name1 : name2}
              </p>
            </motion.div>
          )}
          {reveal && !same && (
            <motion.div key="diff" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <p className="font-script text-2xl text-foreground/80">Pas d'accord 😏</p>
              <p className="text-xs text-muted-foreground">Aucune désignation</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-2xl bg-card/70 p-2">
          <p className="font-semibold">{name1}</p>
          <p className="text-lg">💖 {designations["1"]}</p>
        </div>
        <div className="rounded-2xl bg-card/70 p-2">
          <p className="font-semibold">{name2}</p>
          <p className="text-lg">💜 {designations["2"]}</p>
        </div>
      </div>

      {reveal && (
        <div className="mt-auto pt-4">
          {mySlot === 1 ? (
            <Button onClick={next} className="h-14 w-full rounded-2xl text-base font-semibold">
              {isLast ? "Voir le verdict 🏆" : "Suivante ➡️"}
            </Button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">{otherName} enchaîne…</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────── Gage ───────────
function DareView({ state, room, mySlot, myName, otherName, onDareDone }: {
  state: MLState; room: Room; mySlot: number; myName: string; otherName: string; onDareDone: () => void;
}) {
  const winner = state.winner_slot ?? 0;
  const dare = state.dare_text ?? "Un câlin tout doux 🤗";
  const designations = state.designations ?? { "1": 0, "2": 0 };
  const name1 = mySlot === 1 ? myName : otherName;
  const name2 = mySlot === 2 ? myName : otherName;

  useEffect(() => {
    if (winner !== 0) confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  }, [winner]);

  if (winner === 0) {
    const replay = async () => { await update(room.id, freshReset()); };
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-7xl">🤝</motion.div>
        <h2 className="mt-4 font-script text-3xl text-primary">Égalité parfaite 💕</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {name1} {designations["1"]} · {name2} {designations["2"]} — pas de gage cette fois.
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

  const iLost = mySlot === winner;
  const validate = async () => {
    onDareDone();
    await patch(room.id, { phase: "done" });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="text-6xl">🎁</motion.div>
      <p className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
        Le ou la plus désigné(e) : {winner === 1 ? name1 : name2} ({designations[String(winner) as "1" | "2"]} fois)
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {iLost ? "Ton gage 👇" : `Gage pour ${otherName} 👇`}
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
function DoneView({ state, mySlot, myName, otherName, onReplay, onBackToMenu }: {
  state: MLState; mySlot: number; myName: string; otherName: string; onReplay: () => void; onBackToMenu: () => void;
}) {
  const winner = state.winner_slot ?? 0;
  const iWon = winner !== 0 && mySlot !== winner; // celui qui a fait le gage = "perdant"
  const designations = state.designations ?? { "1": 0, "2": 0 };
  const agreements = state.agreements ?? 0;
  const name1 = mySlot === 1 ? myName : otherName;
  const name2 = mySlot === 2 ? myName : otherName;

  const verdict = useMemo(() => {
    if (winner === 0) return "Vous êtes pile-poil à égalité 🤝";
    const winnerName = winner === 1 ? name1 : name2;
    return `${winnerName} a été désigné(e) le plus de fois 👑`;
  }, [winner, name1, name2]);

  useEffect(() => {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} className="text-8xl">
        {iWon ? "💖" : "🏆"}
      </motion.div>
      <h2 className="mt-6 font-script text-3xl text-primary px-4">{verdict}</h2>
      <p className="mt-3 text-sm text-muted-foreground">Vous étiez d'accord {agreements} fois sur {state.order?.length ?? 0} 💞</p>
      <div className="mt-3 grid w-full max-w-xs grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-card/80 p-3">
          <p className="font-semibold">{name1}</p>
          <p className="text-2xl">💖 {designations["1"]}</p>
        </div>
        <div className="rounded-2xl bg-card/80 p-3">
          <p className="font-semibold">{name2}</p>
          <p className="text-2xl">💜 {designations["2"]}</p>
        </div>
      </div>
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
