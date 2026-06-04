import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { GAGES_RPS } from "@/components/RPSExtreme";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ─────────── RÉGLAGES (modifiables) ───────────
type Level = "easy" | "medium" | "hard";

const LEVELS: Record<Level, { label: string; emoji: string; lives: number; gradient: string }> = {
  easy:   { label: "Facile",    emoji: "🟢", lives: 8, gradient: "from-emerald-200 to-lime-200" },
  medium: { label: "Moyen",     emoji: "🟡", lives: 6, gradient: "from-amber-200 to-yellow-200" },
  hard:   { label: "Difficile", emoji: "🔴", lives: 4, gradient: "from-rose-200 to-pink-300" },
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MAX_WORD = 30;
const MAX_HINT = 60;

type HMState = {
  game?: "hangman";
  phase?: "level_select" | "build" | "guess" | "reveal" | "dare" | "done";
  level_1?: Level | null;
  level_2?: Level | null;
  level?: Level | null;
  round?: 1 | 2;
  word_r1?: string | null;  // mot secret manche 1 (saisi par joueur 1)
  hint_r1?: string | null;
  word_r2?: string | null;  // manche 2 (joueur 2)
  hint_r2?: string | null;
  letters_r1?: string[];     // lettres proposées par le devineur de la manche 1 (=joueur 2)
  letters_r2?: string[];     // joueur 1
  errors_r1?: number;
  errors_r2?: number;
  finished_r1?: boolean;
  finished_r2?: boolean;
  success_r1?: boolean;
  success_r2?: boolean;
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

// ─────────── Helpers ───────────
function normChar(c: string): string {
  return c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}
function isLetter(c: string): boolean {
  const n = normChar(c);
  return n.length === 1 && n >= "A" && n <= "Z";
}
function uniqueLettersOf(word: string): Set<string> {
  const set = new Set<string>();
  for (const c of word) if (isLetter(c)) set.add(normChar(c));
  return set;
}
function isWordSolved(word: string, letters: string[]): boolean {
  const guessed = new Set(letters.map((l) => l.toUpperCase()));
  for (const c of word) {
    if (isLetter(c) && !guessed.has(normChar(c))) return false;
  }
  return true;
}
function stableIndex(seed: string, max: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % max;
}

const update = (roomId: string, patch: HMState) =>
  supabase.from("rooms").update({ minigame_state: patch }).eq("id", roomId);

async function patch(roomId: string, partial: HMState) {
  const { data } = await supabase
    .from("rooms")
    .select("minigame_state")
    .eq("id", roomId)
    .maybeSingle();
  const current = (data?.minigame_state ?? {}) as HMState;
  const next = { ...current, ...partial };
  await update(roomId, next);
}

function freshReset(): HMState {
  return {
    game: "hangman",
    phase: "level_select",
    round: 1,
    level_1: null, level_2: null, level: null,
    word_r1: null, hint_r1: null,
    word_r2: null, hint_r2: null,
    letters_r1: [], letters_r2: [],
    errors_r1: 0, errors_r2: 0,
    finished_r1: false, finished_r2: false,
    success_r1: false, success_r2: false,
    winner_slot: null, wheel_index: null, dare_text: null,
  };
}

// ─────────── Composant principal ───────────
export function Hangman({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s = (room.minigame_state ?? {}) as HMState;
  const phase = s.phase ?? "level_select";

  useEffect(() => {
    if (Object.keys(s).length === 0 && mySlot === 1) {
      void update(room.id, freshReset());
    }
  }, [room.id, s, mySlot]);

  if (phase === "level_select") {
    return <LevelSelect state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  }
  if (phase === "build" || phase === "guess") {
    return <Round state={s} room={room} mySlot={mySlot} otherName={otherName} />;
  }
  if (phase === "reveal") {
    return <RevealRound state={s} room={room} mySlot={mySlot} otherName={otherName} />;
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

// ─────────── Étape 1 : niveau ───────────
function LevelSelect({ state, room, mySlot, myName, otherName }: { state: HMState; room: Room; mySlot: number; myName: string; otherName: string }) {
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
      word_r1: null, hint_r1: null,
      word_r2: null, hint_r2: null,
      letters_r1: [], letters_r2: [],
      errors_r1: 0, errors_r2: 0,
      finished_r1: false, finished_r2: false,
      success_r1: false, success_r2: false,
      winner_slot: null, wheel_index: null, dare_text: null,
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Le Pendu 💞</p>
        <h1 className="mt-1 font-script text-4xl text-primary">❤️ → 💔</h1>
        <p className="mt-1 text-xs text-muted-foreground">Devine le mot secret de l'autre avant de perdre tes cœurs !</p>
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
                <p className="text-[11px] text-foreground/70">{info.lives} cœurs ❤️</p>
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

// ─────────── Manche ───────────
function Round({ state, room, mySlot, otherName }: { state: HMState; room: Room; mySlot: number; otherName: string }) {
  const level = (state.level ?? "easy") as Level;
  const lives = LEVELS[level].lives;
  const round = state.round ?? 1;

  const codemakerSlot = round === 1 ? 1 : 2;
  const iAmMaker = mySlot === codemakerSlot;

  const wordKey = round === 1 ? "word_r1" : "word_r2";
  const hintKey = round === 1 ? "hint_r1" : "hint_r2";
  const lettersKey = round === 1 ? "letters_r1" : "letters_r2";
  const errorsKey = round === 1 ? "errors_r1" : "errors_r2";
  const finishedKey = round === 1 ? "finished_r1" : "finished_r2";
  const successKey = round === 1 ? "success_r1" : "success_r2";

  const word = (state[wordKey] as string | null | undefined) ?? null;
  const hint = (state[hintKey] as string | null | undefined) ?? null;
  const letters = (state[lettersKey] as string[] | undefined) ?? [];
  const errors = (state[errorsKey] as number | undefined) ?? 0;

  if (state.phase === "build") {
    if (iAmMaker) {
      return (
        <BuildWord
          level={level}
          round={round}
          otherName={otherName}
          onValidate={async (w, h) => {
            await patch(room.id, { [wordKey]: w, [hintKey]: h, phase: "guess" } as HMState);
          }}
        />
      );
    }
    return <WaitingScreen title={`Manche ${round}`} message={`${otherName} prépare son mot secret… 🔒`} />;
  }

  // Phase guess
  if (iAmMaker) {
    return (
      <WatcherView
        level={level}
        round={round}
        otherName={otherName}
        word={word ?? ""}
        letters={letters}
        errors={errors}
        lives={lives}
        hint={hint ?? ""}
      />
    );
  }

  return (
    <GuesserView
      level={level}
      round={round}
      otherName={otherName}
      word={word ?? ""}
      hint={hint ?? ""}
      letters={letters}
      errors={errors}
      lives={lives}
      onGuess={async (letter) => {
        const L = letter.toUpperCase();
        if (letters.includes(L)) return;
        const normWord = normalize(word ?? "");
        const isHit = normWord.includes(L);
        const newLetters = [...letters, L];
        const newErrors = isHit ? errors : errors + 1;
        const solved = isWordSolved(word ?? "", newLetters);
        const dead = newErrors >= lives;

        if (solved || dead) {
          // Fin de manche → reveal puis next round
          const baseUpdate: HMState = {
            [lettersKey]: newLetters,
            [errorsKey]: newErrors,
            [finishedKey]: true,
            [successKey]: solved,
            phase: "reveal",
          } as HMState;
          await patch(room.id, baseUpdate);
        } else {
          await patch(room.id, { [lettersKey]: newLetters, [errorsKey]: newErrors } as HMState);
        }
      }}
    />
  );
}

// ─────────── Reveal entre manches / fin partie ───────────
function RevealRound({ state, room, mySlot, otherName }: { state: HMState; room: Room; mySlot: number; otherName: string }) {
  const round = state.round ?? 1;
  const level = (state.level ?? "easy") as Level;
  const lives = LEVELS[level].lives;
  const wordKey = round === 1 ? "word_r1" : "word_r2";
  const lettersKey = round === 1 ? "letters_r1" : "letters_r2";
  const errorsKey = round === 1 ? "errors_r1" : "errors_r2";
  const successKey = round === 1 ? "success_r1" : "success_r2";

  const word = (state[wordKey] as string | null | undefined) ?? "";
  const letters = (state[lettersKey] as string[] | undefined) ?? [];
  const errors = (state[errorsKey] as number | undefined) ?? 0;
  const success = (state[successKey] as boolean | undefined) ?? false;

  const guesserSlot = round === 1 ? 2 : 1;
  const iAmGuesser = mySlot === guesserSlot;

  useEffect(() => {
    if (success && iAmGuesser) confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  }, [success, iAmGuesser]);

  const goNext = async () => {
    if (round === 1) {
      await patch(room.id, { phase: "build", round: 2 });
    } else {
      // Calcul du gagnant
      const s1 = state.success_r1 ?? false; // joueur 2 devine en manche 1 → résultat du devineur slot 2
      const e1 = state.errors_r1 ?? lives;
      const s2 = success; // manche 2 résultat du devineur slot 1
      const e2 = errors;
      // Mappage : guesser de round1 = slot 2, guesser de round2 = slot 1
      const slot1Success = s2; const slot1Errors = e2;
      const slot2Success = s1; const slot2Errors = e1;

      let winner: 0 | 1 | 2 = 0;
      if (slot1Success && !slot2Success) winner = 1;
      else if (slot2Success && !slot1Success) winner = 2;
      else if (slot1Success && slot2Success) {
        if (slot1Errors < slot2Errors) winner = 1;
        else if (slot2Errors < slot1Errors) winner = 2;
        else winner = 0;
      } else {
        // Les deux ont échoué : moins d'erreurs gagne (= a tenu plus longtemps)
        if (slot1Errors < slot2Errors) winner = 1;
        else if (slot2Errors < slot1Errors) winner = 2;
        else winner = 0;
      }

      const gageList = GAGES_RPS[level];
      const seed = `${room.id}-pendu-${level}-${state.word_r1 ?? ""}-${state.word_r2 ?? ""}-${winner}`;
      const wheel_index = stableIndex(seed, gageList.length);

      await patch(room.id, {
        phase: "dare",
        winner_slot: winner,
        wheel_index,
        dare_text: gageList[wheel_index],
      });
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Manche {round} · {LEVELS[level].emoji} {LEVELS[level].label}
        </p>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-3 text-6xl">
          {success ? "🎉" : "💔"}
        </motion.div>
        <h2 className="mt-2 font-script text-3xl text-primary">
          {success
            ? (iAmGuesser ? "Tu as trouvé ! 💖" : `${otherName} a trouvé !`)
            : (iAmGuesser ? "Raté… 🥺" : `${otherName} n'a pas trouvé`)}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {errors} erreur{errors > 1 ? "s" : ""} · {Math.max(0, lives - errors)} ❤️ restant{Math.max(0, lives - errors) > 1 ? "s" : ""}
        </p>
      </div>

      <div className="mt-6 rounded-3xl bg-card/80 p-5 text-center shadow-md">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Le mot secret était</p>
        <p className="mt-2 font-script text-3xl text-primary break-words">{word}</p>
      </div>

      <div className="mt-auto pt-6">
        {mySlot === 1 ? (
          <Button onClick={goNext} className="h-14 w-full rounded-2xl text-base font-semibold">
            {round === 1 ? "Manche 2 → à toi de choisir le mot 🔒" : "Voir le résultat 🏆"}
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">{otherName} continue…</p>
        )}
      </div>
    </div>
  );
}

// ─────────── BuildWord ───────────
function BuildWord({ level, round, otherName, onValidate }: {
  level: Level; round: number; otherName: string;
  onValidate: (word: string, hint: string) => void | Promise<void>;
}) {
  const [word, setWord] = useState("");
  const [hint, setHint] = useState("");
  const [sending, setSending] = useState(false);

  const trimmed = word.trim();
  const hasLetter = useMemo(() => Array.from(trimmed).some(isLetter), [trimmed]);
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_WORD && hasLetter && !sending;

  const submit = async () => {
    if (!canSubmit) return;
    setSending(true);
    try {
      await onValidate(trimmed, hint.trim().slice(0, MAX_HINT));
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
        <h2 className="mt-1 font-script text-3xl text-primary">Ton mot secret 🔒</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Choisis un mot ou une petite phrase (surnom, lieu, souvenir…). {otherName} ne le verra pas !
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Mot ou phrase</label>
          <Input
            value={word}
            onChange={(e) => setWord(e.target.value.slice(0, MAX_WORD))}
            placeholder="Ex : Notre plage 🌊"
            className="mt-1 text-lg"
            autoFocus
          />
          <p className="mt-1 text-[10px] text-muted-foreground">{trimmed.length}/{MAX_WORD} · les accents sont gérés automatiquement</p>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Indice (optionnel)</label>
          <Input
            value={hint}
            onChange={(e) => setHint(e.target.value.slice(0, MAX_HINT))}
            placeholder="Ex : un endroit qu'on adore"
            className="mt-1"
          />
        </div>
      </div>

      <div className="mt-auto pt-6">
        <Button disabled={!canSubmit} onClick={submit} className="h-14 w-full rounded-2xl text-base font-semibold">
          Mot prêt 🔒
        </Button>
      </div>
    </div>
  );
}

// ─────────── WaitingScreen ───────────
function WaitingScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-4 text-6xl">
        🤫
      </motion.div>
      <p className="mt-6 font-script text-2xl text-primary">{message}</p>
    </div>
  );
}

// ─────────── WordDisplay (cases) ───────────
function WordDisplay({ word, letters, reveal = false }: { word: string; letters: string[]; reveal?: boolean }) {
  const guessed = new Set(letters.map((l) => l.toUpperCase()));
  // On split en "mots" pour éviter de couper un mot en passant à la ligne
  const wordsArr = word.split(" ");
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
      {wordsArr.map((w, wi) => (
        <div key={wi} className="flex gap-1">
          {Array.from(w).map((ch, i) => {
            if (!isLetter(ch)) {
              return (
                <span key={i} className="flex h-9 w-6 items-center justify-center text-xl text-foreground/70">
                  {ch}
                </span>
              );
            }
            const n = normChar(ch);
            const shown = reveal || guessed.has(n);
            return (
              <motion.span
                key={i}
                initial={false}
                animate={{ scale: shown ? [1.2, 1] : 1 }}
                className={`flex h-9 w-7 items-end justify-center border-b-2 ${shown ? "border-primary" : "border-foreground/40"} pb-0.5 text-lg font-semibold ${shown ? "text-primary" : "text-transparent"}`}
              >
                {shown ? ch : "_"}
              </motion.span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─────────── HeartsRow ───────────
function HeartsRow({ lives, errors }: { lives: number; errors: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      {Array.from({ length: lives }).map((_, i) => {
        const lost = i < errors;
        return (
          <motion.span
            key={i}
            initial={false}
            animate={lost ? { scale: [1.3, 1], rotate: [0, -10, 0] } : { scale: 1 }}
            className="text-2xl"
          >
            {lost ? "💔" : "❤️"}
          </motion.span>
        );
      })}
    </div>
  );
}

// ─────────── GuesserView ───────────
function GuesserView({ level, round, otherName, word, hint, letters, errors, lives, onGuess }: {
  level: Level; round: number; otherName: string;
  word: string; hint: string; letters: string[]; errors: number; lives: number;
  onGuess: (letter: string) => void | Promise<void>;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const guessedSet = new Set(letters.map((l) => l.toUpperCase()));
  const wordLetters = uniqueLettersOf(word);

  const press = async (l: string) => {
    if (pending || guessedSet.has(l)) return;
    setPending(l);
    try { await onGuess(l); } finally { setPending(null); }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Manche {round} · {LEVELS[level].emoji} {LEVELS[level].label}
        </p>
        <h2 className="mt-1 font-script text-2xl text-primary">Devine le mot de {otherName} 🔍</h2>
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground italic">💡 Indice : {hint}</p>
        )}
      </div>

      <div className="mt-4">
        <HeartsRow lives={lives} errors={errors} />
      </div>

      <div className="mt-5 rounded-3xl bg-card/80 p-4 shadow-md">
        <WordDisplay word={word} letters={letters} />
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {ALPHABET.map((l) => {
          const used = guessedSet.has(l);
          const isHit = used && wordLetters.has(l);
          const isMiss = used && !wordLetters.has(l);
          return (
            <motion.button
              key={l}
              whileTap={{ scale: 0.9 }}
              disabled={used || !!pending}
              onClick={() => press(l)}
              className={`h-10 rounded-xl text-sm font-bold shadow-sm transition disabled:opacity-60
                ${isHit ? "bg-emerald-300 text-emerald-950" : isMiss ? "bg-rose-200 text-rose-700 line-through" : "bg-card text-foreground hover:bg-primary/10"}`}
            >
              {l}
            </motion.button>
          );
        })}
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Les accents et espaces sont gérés automatiquement ✨
      </p>
    </div>
  );
}

// ─────────── WatcherView (le créateur du mot regarde) ───────────
function WatcherView({ level, round, otherName, word, letters, errors, lives, hint }: {
  level: Level; round: number; otherName: string;
  word: string; letters: string[]; errors: number; lives: number; hint: string;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Manche {round} · {LEVELS[level].emoji} {LEVELS[level].label}
        </p>
        <h2 className="mt-1 font-script text-2xl text-primary">{otherName} cherche ton mot… 🤔</h2>
        {hint && <p className="mt-1 text-xs text-muted-foreground italic">💡 Indice donné : {hint}</p>}
      </div>

      <div className="mt-4">
        <HeartsRow lives={lives} errors={errors} />
      </div>

      <div className="mt-5 rounded-3xl bg-card/80 p-4 shadow-md">
        <WordDisplay word={word} letters={letters} reveal />
        <p className="mt-3 text-center text-[11px] text-muted-foreground">(Toi tu vois le mot 😉)</p>
      </div>

      <div className="mt-5">
        <p className="text-center text-xs text-muted-foreground">Lettres déjà proposées :</p>
        <div className="mt-2 flex flex-wrap justify-center gap-1">
          <AnimatePresence>
            {letters.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            {letters.map((l) => {
              const hit = uniqueLettersOf(word).has(l.toUpperCase());
              return (
                <motion.span
                  key={l}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`rounded-lg px-2 py-1 text-sm font-bold ${hit ? "bg-emerald-200 text-emerald-900" : "bg-rose-200 text-rose-800"}`}
                >
                  {l}
                </motion.span>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─────────── Gage ───────────
function DareView({ state, room, mySlot, otherName, onDareDone }: {
  state: HMState; room: Room; mySlot: number; otherName: string; onDareDone: () => void;
}) {
  const winner = state.winner_slot ?? 0;
  const level = (state.level ?? "easy") as Level;
  const gageList = GAGES_RPS[level];
  const idx = typeof state.wheel_index === "number" ? state.wheel_index : 0;
  const dare = state.dare_text ?? gageList[idx % gageList.length];

  if (winner === 0) {
    const replay = async () => { await update(room.id, freshReset()); };
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

// ─────────── DoneView ───────────
function DoneView({ state, mySlot, onReplay, onBackToMenu }: {
  state: HMState; mySlot: number; onReplay: () => void; onBackToMenu: () => void;
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
        Erreurs : {state.errors_r2 ?? "—"} (J1) · {state.errors_r1 ?? "—"} (J2)
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
