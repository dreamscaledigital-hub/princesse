import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ─────────── RÉGLAGES ───────────
const NB_QUESTIONS = 10;

type Mode = "simple" | "extreme";

type Question = { a: string; b: string };

const QUESTIONS_SIMPLE: Question[] = [
  { a: "Pizza 🍕", b: "Sushis 🍣" },
  { a: "Vacances à la mer 🌊", b: "Vacances à la montagne 🏔️" },
  { a: "Soirée Netflix au chaud 🍿", b: "Sortie en ville 🌃" },
  { a: "Petit-déj au lit 🥐", b: "Grasse mat' à deux 😴" },
  { a: "Coucher de soleil sur la plage 🌅", b: "Balade en forêt 🌲" },
  { a: "Cuisiner ensemble 👩‍🍳", b: "Se faire livrer 🛵" },
  { a: "Comédie romantique 💞", b: "Film d'action 💥" },
  { a: "Câlin sous la couette 🛌", b: "Danser dans le salon 💃" },
  { a: "Chien 🐶", b: "Chat 🐱" },
  { a: "Été ☀️", b: "Hiver ❄️" },
  { a: "Café ☕", b: "Thé 🍵" },
  { a: "Sucré 🍫", b: "Salé 🧀" },
  { a: "Voyage en road-trip 🚗", b: "Voyage en avion ✈️" },
  { a: "Concert live 🎤", b: "Cinéma 🎬" },
  { a: "Lever tôt 🌄", b: "Coucher tard 🌙" },
];

const QUESTIONS_EXTREME: Question[] = [
  { a: "Un massage aux huiles 💆", b: "Un bain à deux aux bougies 🛁" },
  { a: "Bisous dans le cou 💋", b: "Bisous dans le dos 😘" },
  { a: "Lumières tamisées 💡", b: "À la lueur des bougies 🕯️" },
  { a: "Toi qui prends l'initiative 😏", b: "Moi qui prends l'initiative 😈" },
  { a: "Tendre et lent 🕊️", b: "Passionné 🔥" },
  { a: "Week-end surprise en amoureux 🧳", b: "Une nuit rien qu'à nous à la maison 🏡" },
  { a: "Slow collé-serré 💃", b: "Te chuchoter à l'oreille 🤫" },
  { a: "Yeux dans les yeux 👀", b: "Yeux bandés 🙈" },
  { a: "Sous la douche 🚿", b: "Devant la cheminée 🔥" },
  { a: "Lingerie sexy 🖤", b: "Ta chemise et rien d'autre 👕" },
  { a: "Matinée au lit 🌅", b: "Folie en pleine nuit 🌙" },
  { a: "Caresses dans les cheveux ✨", b: "Morsures douces sur l'épaule 😏" },
  { a: "Musique douce 🎶", b: "Silence complice 🤍" },
  { a: "Te déshabiller lentement 🎁", b: "Te jeter sur le lit 💥" },
];

const BANKS: Record<Mode, Question[]> = { simple: QUESTIONS_SIMPLE, extreme: QUESTIONS_EXTREME };

const MODE_INFO: Record<Mode, { label: string; emoji: string; gradient: string; desc: string }> = {
  simple:  { label: "Simple",  emoji: "😊", gradient: "from-emerald-200 to-rose-200",  desc: "Cool, fun et mignon" },
  extreme: { label: "Extrême", emoji: "🔥", gradient: "from-rose-300 to-red-300",      desc: "Hot, complice et taquin" },
};

type WYRState = {
  game?: "wouldyou";
  phase?: "mode_select" | "play" | "reveal" | "done";
  mode_1?: Mode | null;
  mode_2?: Mode | null;
  mode?: Mode | null;
  order?: number[];          // indices dans la banque
  index?: number;            // index courant dans `order`
  choice_1?: "a" | "b" | null;
  choice_2?: "a" | "b" | null;
  matches?: number;
};

type Props = {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
};

const update = (roomId: string, patch: WYRState) =>
  supabase.from("rooms").update({ minigame_state: patch }).eq("id", roomId);

async function patch(roomId: string, partial: WYRState) {
  const { data } = await supabase.from("rooms").select("minigame_state").eq("id", roomId).maybeSingle();
  const current = (data?.minigame_state ?? {}) as WYRState;
  await update(roomId, { ...current, ...partial });
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function freshReset(): WYRState {
  return {
    game: "wouldyou",
    phase: "mode_select",
    mode_1: null, mode_2: null, mode: null,
    order: [], index: 0,
    choice_1: null, choice_2: null,
    matches: 0,
  };
}

export function WouldYouRather({ room, mySlot, myName, otherName, onBackToMenu }: Props) {
  const s = (room.minigame_state ?? {}) as WYRState;
  const phase = s.phase ?? "mode_select";

  useEffect(() => {
    if (Object.keys(s).length === 0 && mySlot === 1) {
      void update(room.id, freshReset());
    }
  }, [room.id, s, mySlot]);

  if (phase === "mode_select") {
    return <ModeSelect state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  }
  if (phase === "play" || phase === "reveal") {
    return <PlayView state={s} room={room} mySlot={mySlot} otherName={otherName} />;
  }
  return (
    <DoneView
      state={s}
      onReplay={async () => { await update(room.id, freshReset()); }}
      onBackToMenu={onBackToMenu}
    />
  );
}

// ─────────── Choix du mode ───────────
function ModeSelect({ state, room, mySlot, myName, otherName }:
  { state: WYRState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const mine = mySlot === 1 ? state.mode_1 : state.mode_2;
  const theirs = mySlot === 1 ? state.mode_2 : state.mode_1;
  const both = state.mode_1 && state.mode_2;
  const match = both && state.mode_1 === state.mode_2;

  const choose = async (m: Mode) => {
    await patch(room.id, mySlot === 1 ? { mode_1: m } : { mode_2: m });
  };

  const start = async () => {
    if (!match || mySlot !== 1) return;
    const chosen = state.mode_1 as Mode;
    const bank = BANKS[chosen];
    const idxs = shuffle(bank.map((_, i) => i)).slice(0, Math.min(NB_QUESTIONS, bank.length));
    await patch(room.id, {
      phase: "play",
      mode: chosen,
      order: idxs,
      index: 0,
      choice_1: null, choice_2: null,
      matches: 0,
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Tu préfères ?</p>
        <h1 className="mt-1 font-script text-4xl text-primary">A ou B 💞</h1>
        <p className="mt-1 text-xs text-muted-foreground">Choisissez le mode ensemble :</p>
      </div>

      <div className="mt-5 grid gap-3">
        {(Object.keys(MODE_INFO) as Mode[]).map((m) => {
          const info = MODE_INFO[m];
          const iPicked = mine === m;
          const theyPicked = theirs === m;
          return (
            <motion.button
              key={m}
              whileTap={{ scale: 0.97 }}
              onClick={() => choose(m)}
              className={`flex items-center gap-4 rounded-3xl border-2 p-4 text-left shadow-md bg-gradient-to-br ${info.gradient} ${iPicked ? "border-primary ring-2 ring-primary/40" : "border-white/60"}`}
            >
              <span className="text-4xl">{info.emoji}</span>
              <div className="flex-1">
                <p className="font-script text-2xl text-foreground/90">{info.label}</p>
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
          <span className="font-semibold">{myName}</span> : {mine ? MODE_INFO[mine].label : "—"} ·{" "}
          <span className="font-semibold">{otherName}</span> : {theirs ? MODE_INFO[theirs].label : "—"}
        </p>
        {both && !match && <p className="mt-2 text-muted-foreground">Mettez-vous d'accord 😅</p>}
      </div>

      <div className="mt-auto pt-6">
        <Button disabled={!match || mySlot !== 1} onClick={start} className="h-14 w-full rounded-2xl text-base font-semibold">
          {match ? (mySlot === 1 ? "C'est parti ! 💕" : `${otherName} va lancer…`) : "En attente du mode commun…"}
        </Button>
      </div>
    </div>
  );
}

// ─────────── Phase de jeu ───────────
function PlayView({ state, room, mySlot, otherName }:
  { state: WYRState; room: Room; mySlot: number; otherName: string }) {
  const mode = (state.mode ?? "simple") as Mode;
  const bank = BANKS[mode];
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

  // Auto transition vers reveal côté slot 1 (source de vérité unique)
  useEffect(() => {
    if (state.phase === "play" && bothAnswered && mySlot === 1) {
      const inc = same ? 1 : 0;
      void patch(room.id, { phase: "reveal", matches: matches + inc });
    }
  }, [state.phase, bothAnswered, same, mySlot, room.id, matches]);

  // Confettis si match
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
    if (isLast) {
      await patch(room.id, { phase: "done" });
    } else {
      await patch(room.id, { phase: "play", index: idx + 1, choice_1: null, choice_2: null });
    }
  };

  if (!question) return null;

  const reveal = state.phase === "reveal";

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{MODE_INFO[mode].emoji} {MODE_INFO[mode].label}</span>
        <span>Question {idx + 1} / {total}</span>
        <span>💞 {matches}</span>
      </div>

      <div className="mt-4 text-center">
        <h2 className="font-script text-3xl text-primary">Tu préfères…</h2>
      </div>

      <div className="mt-5 grid gap-4">
        {(["a", "b"] as const).map((opt) => {
          const text = opt === "a" ? question.a : question.b;
          const iPicked = myChoice === opt;
          const theyPicked = reveal && otherChoice === opt;
          const grad = opt === "a"
            ? "from-rose-200 to-pink-300"
            : "from-emerald-200 to-teal-300";
          return (
            <motion.button
              key={opt}
              whileTap={{ scale: myChoice ? 1 : 0.97 }}
              disabled={!!myChoice}
              onClick={() => pick(opt)}
              className={`relative rounded-3xl border-2 p-6 text-center shadow-md bg-gradient-to-br ${grad}
                ${iPicked ? "border-primary ring-2 ring-primary/50" : "border-white/60"}
                ${myChoice && !iPicked ? "opacity-60" : ""}`}
            >
              <p className="text-[10px] uppercase tracking-widest text-foreground/60">
                {opt === "a" ? "Option A" : "Option B"}
              </p>
              <p className="mt-1 font-script text-2xl text-foreground/90 leading-snug">{text}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-1 text-[11px] font-medium">
                {iPicked && <span className="rounded-full bg-white/80 px-2 py-0.5">Toi 💚</span>}
                {theyPicked && <span className="rounded-full bg-white/80 px-2 py-0.5">{otherName} 🧡</span>}
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-5 min-h-[80px] text-center">
        <AnimatePresence mode="wait">
          {!myChoice && (
            <motion.p key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-sm text-muted-foreground">
              Tape ton choix 👆
            </motion.p>
          )}
          {myChoice && !reveal && (
            <motion.p key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-sm text-muted-foreground">
              {otherName} réfléchit… 👀
            </motion.p>
          )}
          {reveal && same && (
            <motion.div key="same" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="font-script text-2xl text-primary">Vous êtes d'accord 💕 +1</p>
            </motion.div>
          )}
          {reveal && !same && (
            <motion.div key="diff" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="font-script text-2xl text-foreground/80">Ah, pas d'accord 😏</p>
            </motion.div>
          )}
        </AnimatePresence>
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

// ─────────── Verdict final ───────────
function DoneView({ state, onReplay, onBackToMenu }:
  { state: WYRState; onReplay: () => void | Promise<void>; onBackToMenu: () => void }) {
  const total = state.order?.length ?? 0;
  const matches = state.matches ?? 0;
  const ratio = total ? matches / total : 0;

  const verdict = useMemo(() => {
    if (ratio >= 0.9) return { title: "Âmes sœurs 💞", desc: "Vous lisez dans les pensées l'un de l'autre !" };
    if (ratio >= 0.7) return { title: "Une belle alchimie ✨", desc: "Vous vous comprenez vraiment bien." };
    if (ratio >= 0.5) return { title: "Vous vous complétez 🧩", desc: "Assez d'accords, juste ce qu'il faut de surprises." };
    if (ratio >= 0.3) return { title: "Les opposés s'attirent 🌗", desc: "Vous avez vos différences… et c'est mignon !" };
    return { title: "Le jour et la nuit 🌒", desc: "Mais c'est ça qui rend tout intéressant 😉" };
  }, [ratio]);

  useEffect(() => {
    if (ratio >= 0.5) confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
  }, [ratio]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-7xl">💞</motion.div>
      <h2 className="mt-4 font-script text-4xl text-primary">{verdict.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs">{verdict.desc}</p>
      <p className="mt-5 rounded-2xl bg-card/80 px-5 py-3 text-lg shadow-md">
        Vous avez répondu pareil <span className="font-bold text-primary">{matches}</span> fois sur {total} 💕
      </p>

      <div className="mt-auto w-full space-y-3 pt-8">
        <Button onClick={() => onReplay()} className="h-14 w-full rounded-2xl text-base font-semibold">
          Rejouer 🔁
        </Button>
        <Button variant="secondary" onClick={onBackToMenu} className="h-12 w-full rounded-2xl">
          ← Retour au menu
        </Button>
      </div>
    </div>
  );
}
