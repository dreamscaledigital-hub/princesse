import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ─────────── RÉGLAGES ───────────
const CATEGORIES_DEFAULT = [
  "Pays",
  "Ville",
  "Prénom",
  "Animal",
  "Métier",
  "Fruit ou Légume",
  "Objet",
  "Marque",
] as const;

// Lettres tirables (on évite K, W, X, Y, Z trop difficiles)
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
  // Validations manuelles (catégorie -> "ok" | "no")
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

const update = (roomId: string, patch: PVState) =>
  supabase.from("rooms").update({ minigame_state: patch }).eq("id", roomId);

async function patch(roomId: string, partial: PVState) {
  const { data } = await supabase
    .from("rooms")
    .select("minigame_state")
    .eq("id", roomId)
    .maybeSingle();
  const current = (data?.minigame_state ?? {}) as PVState;
  await update(roomId, { ...current, ...partial });
}

function freshReset(): PVState {
  return {
    game: "paysville",
    phase: "intro",
    letter: null,
    categories: [...CATEGORIES_DEFAULT],
    answers_1: {},
    answers_2: {},
    stopped_by: null,
    validation_1: {},
    validation_2: {},
    winner_slot: null,
    wheel_index: null,
    dare_text: null,
  };
}

function normFirst(s: string): string {
  const t = (s ?? "").trim();
  if (!t) return "";
  return t[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function stableIndex(seed: string, max: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % max;
}

// ─────────── Composant principal ───────────
export function PaysVille({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s = (room.minigame_state ?? {}) as PVState;
  const phase = s.phase ?? "intro";

  useEffect(() => {
    if ((Object.keys(s).length === 0 || s.game !== "paysville") && mySlot === 1) {
      void update(room.id, freshReset());
    }
  }, [room.id, s, mySlot]);

  if (phase === "intro") {
    return <IntroView state={s} room={room} mySlot={mySlot} otherName={otherName} />;
  }
  if (phase === "play") {
    return <PlayView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  }
  if (phase === "reveal") {
    return <RevealView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  }
  if (phase === "dare") {
    return <DareView state={s} room={room} mySlot={mySlot} otherName={otherName} onDareDone={onDareDone} />;
  }
  return (
    <DoneView
      state={s}
      mySlot={mySlot}
      onReplay={async () => { await update(room.id, freshReset()); }}
      onBackToMenu={onBackToMenu}
    />
  );
}

// ─────────── Intro / tirage lettre ───────────
function IntroView({ state, room, mySlot, otherName }:
  { state: PVState; room: Room; mySlot: number; otherName: string }) {
  const cats = state.categories ?? [...CATEGORIES_DEFAULT];

  const start = async () => {
    if (mySlot !== 1) return;
    const letter = LETTERS_POOL[Math.floor(Math.random() * LETTERS_POOL.length)];
    await patch(room.id, {
      phase: "play",
      letter,
      categories: [...CATEGORIES_DEFAULT],
      answers_1: {},
      answers_2: {},
      stopped_by: null,
      validation_1: {},
      validation_2: {},
      winner_slot: null,
      wheel_index: null,
      dare_text: null,
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Pays · Ville</p>
        <h1 className="mt-1 font-script text-4xl text-primary">Petit Bac 💞</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une lettre est tirée. Vous remplissez toutes les cases le plus vite possible.
          Le premier qui tape STOP arrête la manche pour les deux !
        </p>
      </div>

      <div className="mt-6 rounded-3xl bg-card/80 p-4 shadow-md">
        <p className="text-xs uppercase tracking-wider text-muted-foreground text-center">Catégories</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {cats.map((c) => (
            <span key={c} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-8">
        {mySlot === 1 ? (
          <Button onClick={start} className="h-14 w-full rounded-2xl text-base font-semibold">
            Tirer la lettre 🎲
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">{otherName} va tirer la lettre…</p>
        )}
      </div>
    </div>
  );
}

// ─────────── Phase play ───────────
function PlayView({ state, room, mySlot, otherName }:
  { state: PVState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const letter = state.letter ?? "?";
  const cats = state.categories ?? [...CATEGORIES_DEFAULT];
  const myKey = mySlot === 1 ? "answers_1" : "answers_2";
  const myAnswers = (mySlot === 1 ? state.answers_1 : state.answers_2) ?? {};

  // Local pour éviter de spammer Supabase à chaque touche
  const [local, setLocal] = useState<Answers>(myAnswers);

  // Sync depuis Supabase quand ça change ailleurs (rare : nouvelle manche)
  useEffect(() => {
    setLocal(myAnswers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.letter]);

  // Flush en debounce
  useEffect(() => {
    const id = setTimeout(() => {
      void patch(room.id, { [myKey]: local } as PVState);
    }, 400);
    return () => clearTimeout(id);
  }, [local, room.id, myKey]);

  const onStop = async () => {
    // Flush immédiat + STOP
    await patch(room.id, {
      [myKey]: local,
      stopped_by: mySlot as 1 | 2,
      phase: "reveal",
    } as PVState);
  };

  const filledCount = cats.filter((c) => (local[c] ?? "").trim().length > 0).length;

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Lettre</p>
        <motion.div
          key={letter}
          initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          className="mx-auto mt-1 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-rose-300 to-pink-400 text-6xl font-black text-white shadow-lg"
        >
          {letter}
        </motion.div>
        <p className="mt-2 text-xs text-muted-foreground">
          {filledCount}/{cats.length} remplis · {otherName} joue aussi 🤫
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {cats.map((c) => (
          <div key={c}>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{c}</label>
            <Input
              value={local[c] ?? ""}
              onChange={(e) => setLocal({ ...local, [c]: e.target.value.slice(0, 30) })}
              placeholder={`${c} en ${letter}…`}
              className="mt-1 h-11 text-base"
              autoComplete="off"
            />
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 mt-6 pt-4 pb-2">
        <Button
          onClick={onStop}
          className="h-14 w-full rounded-2xl bg-gradient-to-r from-rose-500 to-red-500 text-base font-bold text-white shadow-lg hover:opacity-90"
        >
          STOP ✋ J'ai fini !
        </Button>
      </div>
    </div>
  );
}

// ─────────── Reveal & scoring ───────────
function score(state: PVState): { s1: number; s2: number; details: { cat: string; a1: string; a2: string; p1: number; p2: number; ok1: boolean; ok2: boolean }[] } {
  const letter = (state.letter ?? "").toUpperCase();
  const cats = state.categories ?? [...CATEGORIES_DEFAULT];
  const a1 = state.answers_1 ?? {};
  const a2 = state.answers_2 ?? {};
  const v1 = state.validation_1 ?? {};
  const v2 = state.validation_2 ?? {};

  let s1 = 0, s2 = 0;
  const details = cats.map((c) => {
    const t1 = (a1[c] ?? "").trim();
    const t2 = (a2[c] ?? "").trim();
    const ok1Letter = !!t1 && normFirst(t1) === letter;
    const ok2Letter = !!t2 && normFirst(t2) === letter;
    // refus manuel possible
    const refused1 = v1[c] === "no";
    const refused2 = v2[c] === "no";
    const ok1 = ok1Letter && !refused1;
    const ok2 = ok2Letter && !refused2;
    const same = ok1 && ok2 && t1.toLowerCase() === t2.toLowerCase();
    let p1 = 0, p2 = 0;
    if (ok1 && ok2 && same) { p1 = 1; p2 = 1; }
    else {
      if (ok1) p1 = ok2 ? 1 : 2; // unique +1 bonus si l'autre a aussi répondu différemment → reste 2 ? on suit la règle : valide=1, unique=+1
      if (ok2) p2 = ok1 ? 1 : 2;
    }
    // Recalcul : règle = valide=1, +1 si UNIQUE (différent de l'autre VALIDE)
    p1 = 0; p2 = 0;
    if (ok1) p1 = 1;
    if (ok2) p2 = 1;
    if (ok1 && ok2) {
      if (t1.toLowerCase() !== t2.toLowerCase()) { p1 += 1; p2 += 1; }
    } else {
      // si l'autre n'a rien de valide, alors la réponse seule est "unique" → bonus
      if (ok1 && !ok2) p1 += 1;
      if (ok2 && !ok1) p2 += 1;
    }
    s1 += p1; s2 += p2;
    return { cat: c, a1: t1, a2: t2, p1, p2, ok1, ok2 };
  });
  return { s1, s2, details };
}

function RevealView({ state, room, mySlot, myName, otherName }:
  { state: PVState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const { s1, s2, details } = useMemo(() => score(state), [state]);
  const letter = state.letter ?? "?";

  const toggleRefuse = async (forSlot: 1 | 2, cat: string) => {
    const key = forSlot === 1 ? "validation_1" : "validation_2";
    const cur = ((forSlot === 1 ? state.validation_1 : state.validation_2) ?? {}) as Record<string, "ok" | "no">;
    const next = { ...cur };
    next[cat] = next[cat] === "no" ? "ok" : "no";
    await patch(room.id, { [key]: next } as PVState);
  };

  const goVerdict = async () => {
    if (mySlot !== 1) return;
    let winner: 0 | 1 | 2 = 0;
    if (s1 > s2) winner = 1;
    else if (s2 > s1) winner = 2;
    else winner = 0;

    if (winner === 0) {
      await patch(room.id, { winner_slot: 0, phase: "dare" });
      return;
    }
    const seed = `${room.id}-paysville-${letter}-${s1}-${s2}-${winner}`;
    const idx = stableIndex(seed, GAGES_EROTIQUES.length);
    await patch(room.id, {
      winner_slot: winner,
      wheel_index: idx,
      dare_text: GAGES_EROTIQUES[idx],
      phase: "dare",
    });
  };

  const myScore = mySlot === 1 ? s1 : s2;
  const otherScore = mySlot === 1 ? s2 : s1;
  const stoppedBy = state.stopped_by;
  const stoppedName = stoppedBy === mySlot ? myName : stoppedBy ? otherName : "";

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Lettre : {letter}</p>
        <h2 className="mt-1 font-script text-3xl text-primary">Révélation 🎉</h2>
        {stoppedName && (
          <p className="mt-1 text-xs text-muted-foreground">⏱️ {stoppedName} a arrêté la manche</p>
        )}
        <p className="mt-3 text-sm">
          <span className="font-semibold text-primary">{myName}</span> {myScore} pts ·{" "}
          <span className="font-semibold">{otherName}</span> {otherScore} pts
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {details.map((d) => (
          <div key={d.cat} className="rounded-2xl bg-card/80 p-3 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{d.cat}</p>
            <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
              <AnswerCell
                label={mySlot === 1 ? "Toi" : otherName}
                text={d.a1}
                ok={d.ok1}
                pts={d.p1}
                onRefuse={() => toggleRefuse(1, d.cat)}
                refused={(state.validation_1 ?? {})[d.cat] === "no"}
              />
              <AnswerCell
                label={mySlot === 2 ? "Toi" : otherName}
                text={d.a2}
                ok={d.ok2}
                pts={d.p2}
                onRefuse={() => toggleRefuse(2, d.cat)}
                refused={(state.validation_2 ?? {})[d.cat] === "no"}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-2">
        {mySlot === 1 ? (
          <Button onClick={goVerdict} className="h-14 w-full rounded-2xl text-base font-semibold">
            Voir le verdict 🏆
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">{otherName} valide le verdict…</p>
        )}
      </div>
    </div>
  );
}

function AnswerCell({ label, text, ok, pts, onRefuse, refused }:
  { label: string; text: string; ok: boolean; pts: number; onRefuse: () => void; refused: boolean }) {
  return (
    <div className={`rounded-xl border p-2 ${ok ? "border-emerald-300 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
      <p className="text-[10px] uppercase tracking-wider text-foreground/60">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold text-foreground/90">{text || <span className="italic text-muted-foreground">—</span>}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className={`text-[11px] font-bold ${ok ? "text-emerald-700" : "text-rose-600"}`}>+{pts}</span>
        {text && (
          <button
            onClick={onRefuse}
            className={`text-[10px] underline ${refused ? "text-rose-600" : "text-muted-foreground"}`}
          >
            {refused ? "Annuler refus" : "Refuser"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────── Gage ───────────
function DareView({ state, room, mySlot, otherName, onDareDone }: {
  state: PVState; room: Room; mySlot: number; otherName: string; onDareDone: () => void;
}) {
  const winner = state.winner_slot ?? 0;
  const idx = typeof state.wheel_index === "number" ? state.wheel_index : 0;
  const dare = state.dare_text ?? GAGES_EROTIQUES[idx % GAGES_EROTIQUES.length];

  useEffect(() => {
    if (winner !== 0) confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  }, [winner]);

  if (winner === 0) {
    const replay = async () => { await update(room.id, freshReset()); };
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-7xl">🤝</motion.div>
        <h2 className="mt-4 font-script text-3xl text-primary">Égalité 💕</h2>
        <p className="mt-2 text-sm text-muted-foreground">Pas de gage. On remet ça ?</p>
        {mySlot === 1 ? (
          <Button onClick={replay} className="mt-8 h-14 w-full max-w-xs rounded-2xl text-base font-semibold">
            Rejouer 🔁
          </Button>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">{otherName} relance la manche…</p>
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
      <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
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
function DoneView({ state, mySlot, onReplay, onBackToMenu }: {
  state: PVState; mySlot: number; onReplay: () => void; onBackToMenu: () => void;
}) {
  const winner = state.winner_slot ?? 0;
  const iWon = winner === mySlot;

  useEffect(() => {
    if (iWon) confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }, [iWon]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} className="text-8xl">
        {iWon ? "🏆" : "💖"}
      </motion.div>
      <h2 className="mt-6 font-script text-4xl text-primary">
        {iWon ? "Tu as gagné ! 🎉" : "Bravo pour le gage 😘"}
      </h2>
      <div className="mt-8 w-full max-w-xs space-y-3">
        <Button onClick={onReplay} className="h-14 w-full rounded-2xl text-base font-semibold">
          Rejouer (nouvelle lettre) 🔁
        </Button>
        <Button variant="secondary" onClick={onBackToMenu} className="h-12 w-full rounded-2xl">
          ← Retour au menu
        </Button>
      </div>
    </div>
  );
}
