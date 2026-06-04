import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { GAGES_RPS } from "@/components/RPSExtreme";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ─────────── RÉGLAGES (modifiables) ───────────
type Level = "easy" | "medium" | "hard";

const LEVELS: Record<Level, { label: string; emoji: string; size: number; palette: number; maxAttempts: number; gradient: string }> = {
  easy:   { label: "Facile",    emoji: "🟢", size: 3, palette: 4, maxAttempts: 10, gradient: "from-emerald-200 to-lime-200" },
  medium: { label: "Moyen",     emoji: "🟡", size: 4, palette: 6, maxAttempts: 10, gradient: "from-amber-200 to-yellow-200" },
  hard:   { label: "Difficile", emoji: "🔴", size: 5, palette: 6, maxAttempts: 8,  gradient: "from-rose-200 to-pink-300" },
};

// Couleurs mignonnes (palette de 6, on prend les N premières par niveau)
const COLORS = [
  { id: "rose",   emoji: "💗", bg: "bg-pink-400" },
  { id: "amber",  emoji: "💛", bg: "bg-amber-400" },
  { id: "lime",   emoji: "💚", bg: "bg-emerald-400" },
  { id: "sky",    emoji: "💙", bg: "bg-sky-400" },
  { id: "violet", emoji: "💜", bg: "bg-violet-400" },
  { id: "orange", emoji: "🧡", bg: "bg-orange-400" },
];

type Attempt = { guess: string[]; black: number; white: number };

type MMState = {
  game?: "mastermind";
  phase?: "level_select" | "build" | "guess" | "dare" | "done";
  level_1?: Level | null;
  level_2?: Level | null;
  level?: Level | null;
  round?: 1 | 2;
  code_1?: string[] | null;       // secret du slot 1 (manche 1)
  code_2?: string[] | null;       // secret du slot 2 (manche 2)
  attempts_1?: Attempt[];          // essais du slot 1 (manche 2)
  attempts_2?: Attempt[];          // essais du slot 2 (manche 1)
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

const update = (roomId: string, patch: MMState) =>
  supabase.from("rooms").update({ minigame_state: patch }).eq("id", roomId);

// On merge côté client en lisant l'état courant (atomicité raisonnable
// pour ce jeu ; les écritures concurrentes sont rares et bornées par rôle).
async function patch(roomId: string, partial: MMState) {
  const { data } = await supabase
    .from("rooms")
    .select("minigame_state")
    .eq("id", roomId)
    .maybeSingle();
  const current = (data?.minigame_state ?? {}) as MMState;
  const next = { ...current, ...partial };
  await update(roomId, next);
}

function evaluate(code: string[], guess: string[]): { black: number; white: number } {
  let black = 0;
  const codeRest: string[] = [];
  const guessRest: string[] = [];
  for (let i = 0; i < code.length; i += 1) {
    if (guess[i] === code[i]) black += 1;
    else { codeRest.push(code[i]); guessRest.push(guess[i]); }
  }
  let white = 0;
  const counts: Record<string, number> = {};
  for (const c of codeRest) counts[c] = (counts[c] ?? 0) + 1;
  for (const g of guessRest) {
    if ((counts[g] ?? 0) > 0) { white += 1; counts[g] -= 1; }
  }
  return { black, white };
}

function stableIndex(seed: string, max: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % max;
}

export function Mastermind({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s = (room.minigame_state ?? {}) as MMState;
  const phase = s.phase ?? "level_select";

  // Init côté slot 1
  useEffect(() => {
    if (Object.keys(s).length === 0 && mySlot === 1) {
      void update(room.id, { game: "mastermind", phase: "level_select", round: 1 });
    }
  }, [room.id, s, mySlot]);

  if (phase === "level_select") {
    return <LevelSelect state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  }
  if (phase === "build" || phase === "guess") {
    return <Round state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  }
  if (phase === "dare") {
    return <DareView state={s} room={room} mySlot={mySlot} otherName={otherName} onDareDone={onDareDone} />;
  }
  // done
  return (
    <DoneView
      state={s}
      mySlot={mySlot}
      onReplay={async () => {
        await update(room.id, {
          game: "mastermind",
          phase: "level_select",
          round: 1,
          level_1: null, level_2: null, level: null,
          code_1: null, code_2: null,
          attempts_1: [], attempts_2: [],
          found_1: null, found_2: null,
          tries_1: null, tries_2: null,
          winner_slot: null, wheel_index: null, dare_text: null,
        });
      }}
      onBackToMenu={onBackToMenu}
    />
  );
}

// ─────────── Étape 1 : choix du niveau commun ───────────
function LevelSelect({ state, room, mySlot, myName, otherName }: { state: MMState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const mine = mySlot === 1 ? state.level_1 : state.level_2;
  const theirs = mySlot === 1 ? state.level_2 : state.level_1;
  const both = state.level_1 && state.level_2;
  const match = both && state.level_1 === state.level_2;

  const choose = async (l: Level) => {
    await patch(room.id, mySlot === 1 ? { level_1: l } : { level_2: l });
  };

  const start = async () => {
    if (!match) return;
    await patch(room.id, {
      phase: "build",
      level: state.level_1 ?? null,
      round: 1,
      code_1: null, code_2: null,
      attempts_1: [], attempts_2: [],
      found_1: null, found_2: null,
      tries_1: null, tries_2: null,
      winner_slot: null, wheel_index: null, dare_text: null,
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Mastermind 💞</p>
        <h1 className="mt-1 font-script text-4xl text-primary">💗💛💚💙</h1>
        <p className="mt-1 text-xs text-muted-foreground">Devine le code de l'autre — moins d'essais = gagne !</p>
      </div>

      <p className="mt-5 text-center text-sm font-medium">Choisissez ENSEMBLE le niveau :</p>

      <div className="mt-4 grid gap-3">
        {(Object.keys(LEVELS) as Level[]).map((l) => {
          const info = LEVELS[l];
          const iPicked = mine === l;
          const theyPicked = theirs === l;
          return (
            <motion.button
              key={l}
              whileTap={{ scale: 0.97 }}
              onClick={() => choose(l)}
              className={`relative flex items-center gap-4 rounded-3xl border-2 p-4 text-left shadow-md bg-gradient-to-br ${info.gradient} ${iPicked ? "border-primary ring-2 ring-primary/40" : "border-white/60"}`}
            >
              <span className="text-4xl">{info.emoji}</span>
              <div className="flex-1">
                <p className="font-script text-2xl text-foreground/90">{info.label}</p>
                <p className="text-[11px] text-foreground/70">{info.size} cases · {info.palette} couleurs · {info.maxAttempts} essais</p>
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
          <span className="font-semibold">{myName}</span> : {mine ? LEVELS[mine].label : "—"} · <span className="font-semibold">{otherName}</span> : {theirs ? LEVELS[theirs].label : "—"}
        </p>
        {both && !match && <p className="mt-2 text-muted-foreground">Mettez-vous d'accord 😅</p>}
      </div>

      <div className="mt-auto pt-6">
        <Button disabled={!match} onClick={start} className="h-14 w-full rounded-2xl text-base font-semibold">
          {match ? "C'est parti ! 🎮" : "En attente du niveau commun…"}
        </Button>
      </div>
    </div>
  );
}

// ─────────── Étape 2/3 : manches ───────────
function Round({ state, room, mySlot, myName, otherName }: { state: MMState; room: Room; mySlot: number; myName: string; otherName: string }) {
  const level = (state.level ?? "easy") as Level;
  const { size, palette, maxAttempts } = LEVELS[level];
  const palettes = COLORS.slice(0, palette);
  const round = state.round ?? 1;

  // Rôles selon manche
  const codemakerSlot = round === 1 ? 1 : 2;
  const guesserSlot = round === 1 ? 2 : 1;
  const iAmMaker = mySlot === codemakerSlot;

  const codeKey = round === 1 ? "code_1" : "code_2";
  const attemptsKey = round === 1 ? "attempts_2" : "attempts_1";
  const foundKey = round === 1 ? "found_2" : "found_1";
  const triesKey = round === 1 ? "tries_2" : "tries_1";

  const code = (state[codeKey] as string[] | null | undefined) ?? null;
  const attempts = (state[attemptsKey] as Attempt[] | undefined) ?? [];

  // ── Phase "build" : le codemaker compose son code, le guesser attend ──
  if (state.phase === "build") {
    if (iAmMaker) {
      return (
        <BuildCode
          size={size}
          palettes={palettes}
          level={level}
          round={round}
          onValidate={async (newCode) => {
            await patch(room.id, { [codeKey]: newCode, phase: "guess" } as MMState);
          }}
          otherName={otherName}
        />
      );
    }
    return (
      <WaitingScreen
        title={round === 1 ? "Manche 1" : "Manche 2"}
        message={`${otherName} prépare son code secret… 🔒`}
      />
    );
  }

  // ── Phase "guess" ──
  if (iAmMaker) {
    // Codemaker regarde la progression
    return (
      <WatcherView
        level={level}
        round={round}
        otherName={otherName}
        attempts={attempts}
        maxAttempts={maxAttempts}
        size={size}
        palettes={palettes}
      />
    );
  }

  // Guesser propose des combinaisons
  return (
    <GuesserView
      level={level}
      round={round}
      size={size}
      palettes={palettes}
      maxAttempts={maxAttempts}
      code={code ?? []}
      attempts={attempts}
      otherName={otherName}
      myName={myName}
      onSubmit={async (guess) => {
        if (!code) return;
        const result = evaluate(code, guess);
        const newAttempt: Attempt = { guess, black: result.black, white: result.white };
        const newAttempts = [...attempts, newAttempt];
        const found = result.black === size;
        const ended = found || newAttempts.length >= maxAttempts;

        if (!ended) {
          await patch(room.id, { [attemptsKey]: newAttempts } as MMState);
          return;
        }

        const tries = newAttempts.length;
        // Fin de manche
        if (round === 1) {
          await patch(room.id, {
            [attemptsKey]: newAttempts,
            [foundKey]: found,
            [triesKey]: tries,
            phase: "build",
            round: 2,
          } as MMState);
        } else {
          // Fin de manche 2 → calcul du gagnant
          const found1 = round === 2 ? found : (state.found_1 ?? false);
          const tries1 = round === 2 ? tries : (state.tries_1 ?? maxAttempts);
          const found2 = state.found_2 ?? false;
          const tries2 = state.tries_2 ?? maxAttempts;

          let winner: 0 | 1 | 2 = 0;
          if (found1 && !found2) winner = 1;
          else if (found2 && !found1) winner = 2;
          else if (found1 && found2) {
            if (tries1 < tries2) winner = 1;
            else if (tries2 < tries1) winner = 2;
            else winner = 0;
          } else {
            winner = 0;
          }

          const gageList = GAGES_RPS[level];
          const seed = `${room.id}-mm-${level}-${(state.code_1 ?? []).join("")}-${(state.code_2 ?? []).join("")}-${winner}`;
          const wheel_index = stableIndex(seed, gageList.length);

          await patch(room.id, {
            [attemptsKey]: newAttempts,
            [foundKey]: found,
            [triesKey]: tries,
            phase: "dare",
            winner_slot: winner,
            wheel_index,
            dare_text: gageList[wheel_index],
          } as MMState);
        }
      }}
    />
  );
}

// ─────────── Sous-vues ───────────
function BuildCode({ size, palettes, level, round, onValidate, otherName }: {
  size: number; palettes: typeof COLORS; level: Level; round: number;
  onValidate: (code: string[]) => void | Promise<void>; otherName: string;
}) {
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(size).fill(null));
  const [active, setActive] = useState(0);
  const filled = slots.every((s) => s !== null);

  const setSlot = (i: number, id: string | null) => {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? id : s)));
  };

  const pickColor = (id: string) => {
    setSlot(active, id);
    const next = slots.findIndex((s, i) => i !== active && s === null);
    if (next !== -1 && active === slots.findIndex((s) => s === null)) setActive(next);
    else if (active < size - 1) setActive(active + 1);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Manche {round} · {LEVELS[level].emoji} {LEVELS[level].label}
        </p>
        <h2 className="mt-1 font-script text-3xl text-primary">Crée ton code secret 🔒</h2>
        <p className="mt-1 text-xs text-muted-foreground">{otherName} devra le retrouver. Les répétitions sont autorisées.</p>
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {slots.map((s, i) => {
          const c = s ? palettes.find((p) => p.id === s) : null;
          return (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`h-14 w-14 rounded-2xl border-2 flex items-center justify-center text-2xl transition ${active === i ? "border-primary ring-2 ring-primary/40" : "border-border"} ${c ? c.bg : "bg-card/80"}`}
            >
              {c ? c.emoji : "·"}
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground">Choisis une couleur :</p>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {palettes.map((p) => (
          <motion.button
            key={p.id}
            whileTap={{ scale: 0.9 }}
            onClick={() => pickColor(p.id)}
            className={`flex flex-col items-center rounded-2xl border-2 border-white/60 p-3 text-3xl shadow-sm ${p.bg}`}
          >
            <span>{p.emoji}</span>
          </motion.button>
        ))}
      </div>

      <div className="mt-auto pt-6 space-y-2">
        <Button
          variant="secondary"
          className="h-11 w-full rounded-2xl"
          onClick={() => { setSlots(Array(size).fill(null)); setActive(0); }}
        >
          Effacer 🧽
        </Button>
        <Button
          disabled={!filled}
          onClick={() => filled && onValidate(slots.filter((s): s is string => !!s))}
          className="h-14 w-full rounded-2xl text-base font-semibold"
        >
          Code prêt 🔒
        </Button>
      </div>
    </div>
  );
}

function WaitingScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mt-4 text-6xl"
      >
        🤫
      </motion.div>
      <p className="mt-6 font-script text-2xl text-primary">{message}</p>
    </div>
  );
}

function AttemptsList({ attempts, size, palettes }: { attempts: Attempt[]; size: number; palettes: typeof COLORS }) {
  return (
    <div className="mt-4 space-y-2">
      {attempts.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">Aucun essai pour l'instant.</p>
      )}
      <AnimatePresence initial={false}>
        {attempts.map((a, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-2 rounded-xl bg-card/80 p-2 shadow-sm"
          >
            <span className="w-6 text-center text-[11px] font-semibold text-muted-foreground">#{idx + 1}</span>
            <div className="flex flex-1 justify-center gap-1.5">
              {a.guess.map((g, i) => {
                const c = palettes.find((p) => p.id === g);
                return (
                  <span key={i} className={`h-7 w-7 rounded-full flex items-center justify-center text-sm ${c?.bg ?? "bg-muted"}`}>
                    {c?.emoji ?? "·"}
                  </span>
                );
              })}
              {Array.from({ length: Math.max(0, size - a.guess.length) }).map((_, i) => (
                <span key={`pad${i}`} className="h-7 w-7 rounded-full bg-muted/40" />
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs font-bold">
              <span className="rounded-full bg-foreground/90 px-1.5 py-0.5 text-background">{a.black}⚫</span>
              <span className="rounded-full bg-background px-1.5 py-0.5 text-foreground border border-border">{a.white}⚪</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function GuesserView({ level, round, size, palettes, maxAttempts, attempts, otherName, onSubmit }: {
  level: Level; round: number; size: number; palettes: typeof COLORS; maxAttempts: number;
  attempts: Attempt[]; otherName: string;
  onSubmit: (guess: string[]) => void | Promise<void>;
}) {
  const [slots, setSlots] = useState<(string | null)[]>(() => Array(size).fill(null));
  const [active, setActive] = useState(0);
  const [sending, setSending] = useState(false);
  const filled = slots.every((s) => s !== null);
  const remaining = Math.max(0, maxAttempts - attempts.length);

  useEffect(() => {
    setSlots(Array(size).fill(null));
    setActive(0);
  }, [attempts.length, size]);

  const pickColor = (id: string) => {
    setSlots((prev) => prev.map((s, idx) => (idx === active ? id : s)));
    if (active < size - 1) setActive(active + 1);
  };

  const submit = async () => {
    if (!filled || sending) return;
    setSending(true);
    try {
      await onSubmit(slots.filter((s): s is string => !!s));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Manche {round} · {LEVELS[level].emoji} {LEVELS[level].label}
        </p>
        <h2 className="mt-1 font-script text-2xl text-primary">Devine le code de {otherName} 🔍</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          ⚫ bien placé · ⚪ bonne couleur, mauvaise place · {remaining} essai{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""}
        </p>
      </div>

      {/* Slots de saisie */}
      <div className="mt-4 flex justify-center gap-2">
        {slots.map((s, i) => {
          const c = s ? palettes.find((p) => p.id === s) : null;
          return (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`h-12 w-12 rounded-2xl border-2 flex items-center justify-center text-xl transition ${active === i ? "border-primary ring-2 ring-primary/40" : "border-border"} ${c ? c.bg : "bg-card/80"}`}
            >
              {c ? c.emoji : "·"}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-6 gap-2">
        {palettes.map((p) => (
          <motion.button
            key={p.id}
            whileTap={{ scale: 0.9 }}
            onClick={() => pickColor(p.id)}
            className={`h-10 rounded-xl border border-white/60 text-xl shadow-sm ${p.bg}`}
          >
            {p.emoji}
          </motion.button>
        ))}
      </div>

      {/* Historique */}
      <div className="mt-3 max-h-[40vh] overflow-y-auto pr-1">
        <AttemptsList attempts={attempts} size={size} palettes={palettes} />
      </div>

      <div className="mt-auto pt-4">
        <Button
          disabled={!filled || sending}
          onClick={submit}
          className="h-14 w-full rounded-2xl text-base font-semibold"
        >
          Tenter 🎯
        </Button>
      </div>
    </div>
  );
}

function WatcherView({ level, round, otherName, attempts, maxAttempts, size, palettes }: {
  level: Level; round: number; otherName: string; attempts: Attempt[]; maxAttempts: number;
  size: number; palettes: typeof COLORS;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Manche {round} · {LEVELS[level].emoji} {LEVELS[level].label}
        </p>
        <h2 className="mt-1 font-script text-2xl text-primary">{otherName} cherche ton code… 🤔</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {attempts.length} / {maxAttempts} essai{attempts.length > 1 ? "s" : ""}
        </p>
      </div>
      <div className="mt-4 flex-1 overflow-y-auto">
        <AttemptsList attempts={attempts} size={size} palettes={palettes} />
      </div>
    </div>
  );
}

// ─────────── Gage ───────────
function DareView({ state, room, mySlot, otherName, onDareDone }: {
  state: MMState; room: Room; mySlot: number; otherName: string; onDareDone: () => void;
}) {
  const winner = state.winner_slot ?? 0;
  const level = (state.level ?? "easy") as Level;
  const gageList = GAGES_RPS[level];
  const idx = typeof state.wheel_index === "number" ? state.wheel_index : 0;
  const dare = state.dare_text ?? gageList[idx % gageList.length];

  // Égalité → on rejoue
  if (winner === 0) {
    const replay = async () => {
      await patch(room.id, {
        phase: "level_select",
        round: 1,
        level_1: null, level_2: null, level: null,
        code_1: null, code_2: null,
        attempts_1: [], attempts_2: [],
        found_1: null, found_2: null,
        tries_1: null, tries_2: null,
        winner_slot: null, wheel_index: null, dare_text: null,
      });
    };
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-7xl">🤝</motion.div>
        <h2 className="mt-4 font-script text-3xl text-primary">Égalité 💕</h2>
        <p className="mt-2 text-sm text-muted-foreground">Pas de gage cette fois. On remet ça ?</p>
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
      <div className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        {LEVELS[level].emoji} {LEVELS[level].label}
      </div>
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

// ─────────── Fin ───────────
function DoneView({ state, mySlot, onReplay, onBackToMenu }: {
  state: MMState; mySlot: number; onReplay: () => void; onBackToMenu: () => void;
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
      <p className="mt-2 text-sm text-muted-foreground">
        Essais : {state.tries_1 ?? "—"} (J1) · {state.tries_2 ?? "—"} (J2)
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
