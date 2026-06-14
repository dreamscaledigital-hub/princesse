import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase as _supabase } from "@/integrations/supabase/client";
// Cast to loosen strict Json type on minigame_state jsonb column.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { Button } from "@/components/ui/button";
import {
  CULTURE_QUESTIONS,
  GREEN_MAX_DELAY_MS,
  GREEN_MIN_DELAY_MS,
  HEART_MEMORY_CARDS,
  HEART_MEMORY_SHOW_MS,
  MINIGAME_DESCRIPTIONS,
  MINIGAME_LABELS,
  RPS_WINS_NEEDED,
  type MinigameId,
} from "@/lib/game-content";
import type { Room } from "@/lib/use-room-state";

// Shape of minigame_state varies per game.
// Common keys: phase: "countdown" | "play" | "result", winner_slot: number | 0 (0=tie)

type Props = {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onFinish: (winnerSlot: number | null) => void; // null = tie
};

export function Minigame(props: Props) {
  const { room, mySlot } = props;
  const state = (room.minigame_state ?? {}) as Record<string, unknown>;
  const phase = (state.phase as string) ?? "countdown";

  // Driver = picker (à la carte) sinon host (slot 1). Sert à éviter les doubles
  // initialisations aléatoires (ex: card_index) qui pourraient se chevaucher.
  const driverSlot = (state.picker_slot as number | undefined) ?? 1;
  const pickerSlot = state.picker_slot as number | undefined;

  // Initialise le compte à rebours si l'état est vide
  useEffect(() => {
    if (mySlot !== driverSlot) return;
    if (!room.minigame_id) return;
    if (Object.keys(state).length === 0) {
      void supabase
        .from("rooms")
        .update({
          minigame_state: { phase: "countdown", countdown_start: Date.now(), picker_slot: mySlot },
        })
        .eq("id", room.id);
    }
  }, [room.id, room.minigame_id, mySlot, driverSlot, state]);

  // Countdown → play : déclenché par le driver. Filet de sécurité : si le
  // compte à rebours est largement dépassé (driver disparu, etc.), l'autre
  // joueur force aussi la transition.
  useEffect(() => {
    if (phase !== "countdown") return;
    if (!room.minigame_id) return;
    const start = (state.countdown_start as number) ?? Date.now();
    const elapsed = Date.now() - start;
    const isDriver = mySlot === driverSlot;
    // Le driver part à 3s ; un fallback de l'autre joueur se déclenche à 5s
    const target = isDriver ? 3000 : 5000;
    const remaining = Math.max(0, target - elapsed);
    const id = setTimeout(() => {
      const playState = initialPlayState(room.minigame_id as MinigameId);
      void supabase
        .from("rooms")
        .update({
          minigame_state: {
            ...playState,
            ...(pickerSlot !== undefined ? { picker_slot: pickerSlot } : {}),
          },
        })
        .eq("id", room.id);
    }, remaining);
    return () => clearTimeout(id);
  }, [phase, room.id, room.minigame_id, mySlot, driverSlot, pickerSlot, state]);

  if (!room.minigame_id) return null;

  if (phase === "countdown") {
    return <Countdown id={room.minigame_id} state={state} />;
  }

  if (phase === "result") {
    const winner = (state.winner_slot as number) ?? 0;
    const winnerName = winner === mySlot ? props.myName : winner === 0 ? null : props.otherName;
    return (
      <ResultScreen
        winnerName={winnerName}
        iWon={winner === mySlot}
        tie={winner === 0}
        onNext={() => props.onFinish(winner === 0 ? null : winner)}
        canAdvance={mySlot === 1}
      />
    );
  }

  // play phase — dispatch
  switch (room.minigame_id) {
    case "tap":
      return <TapEclair {...props} state={state} />;
    case "memory":
      return <HeartMemory {...props} state={state} />;
    case "green":
      return <GreenLight {...props} state={state} />;
    case "culture":
      return <CultureFlash {...props} state={state} />;
    case "rps":
      return <RPS {...props} state={state} />;
  }
  return null;
}

function initialPlayState(id: MinigameId): Record<string, unknown> {
  const now = Date.now();
  switch (id) {
    case "tap": {
      const delay = TAP_MIN_DELAY_MS + Math.random() * (TAP_MAX_DELAY_MS - TAP_MIN_DELAY_MS);
      return { phase: "play", started_at: now, signal_at: now + delay };
    }
    case "memory": {
      const cardIndex = Math.floor(Math.random() * HEART_MEMORY_CARDS.length);
      return { phase: "play", started_at: now, reveal_until: now + HEART_MEMORY_SHOW_MS, card_index: cardIndex };
    }
    case "green": {
      const delay = GREEN_MIN_DELAY_MS + Math.random() * (GREEN_MAX_DELAY_MS - GREEN_MIN_DELAY_MS);
      return { phase: "play", started_at: now, go_at: now + delay };
    }
    case "culture": {
      const qi = Math.floor(Math.random() * CULTURE_QUESTIONS.length);
      return { phase: "play", started_at: now, qi, lost: [] as number[] };
    }
    case "rps":
      return { phase: "play", round: 1, wins_1: 0, wins_2: 0, choice_1: null, choice_2: null };
  }
}

function Countdown({ id, state }: { id: MinigameId; state: Record<string, unknown> }) {
  const start = (state.countdown_start as number) ?? Date.now();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  const elapsed = now - start;
  const n = Math.max(1, 3 - Math.floor(elapsed / 1000));
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{MINIGAME_LABELS[id]}</p>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{MINIGAME_DESCRIPTIONS[id]}</p>
      <motion.div
        key={n}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mt-8 font-script text-9xl text-primary"
      >
        {n}
      </motion.div>
      <p className="mt-4 text-muted-foreground">Prêt·e ?</p>
    </div>
  );
}

function ResultScreen({
  winnerName,
  iWon,
  tie,
  onNext,
  canAdvance,
}: {
  winnerName: string | null;
  iWon: boolean;
  tie: boolean;
  onNext: () => void;
  canAdvance: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.3, 1] }}
        className="text-8xl"
      >
        {tie ? "🤝" : iWon ? "🏆" : "🥹"}
      </motion.div>
      <h2 className="mt-6 font-script text-4xl text-primary">
        {tie ? "Égalité !" : iWon ? "Bravo, c'est toi !" : `${winnerName} gagne !`}
      </h2>
      {canAdvance ? (
        <Button onClick={onNext} className="mt-8 h-14 w-full max-w-xs rounded-2xl text-base font-semibold">
          Continuer 💕
        </Button>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">Ton/ta partenaire enchaîne...</p>
      )}
    </div>
  );
}

// ── HEART MEMORY ─────────────────────────────────
function HeartMemory({ room, mySlot, myName, otherName, state }: Props & { state: Record<string, unknown> }) {
  const revealUntil = (state.reveal_until as number) ?? Date.now();
  const cardIndex = (state.card_index as number) ?? 0;
  const card = HEART_MEMORY_CARDS[cardIndex % HEART_MEMORY_CARDS.length];
  const [now, setNow] = useState(Date.now());
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  const revealing = now < revealUntil;
  const remaining = Math.max(0, revealUntil - now);

  const pick = async (option: string[]) => {
    if (revealing || picking) return;
    setPicking(true);
    const isCorrect = option.join("|") === card.sequence.join("|");
    const winner = isCorrect ? mySlot : mySlot === 1 ? 2 : 1;
    await supabase
      .from("rooms")
      .update({ minigame_state: { ...state, phase: "result", winner_slot: winner, by: mySlot, correct: isCorrect } })
      .eq("id", room.id);
    setPicking(false);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Mémoire des cœurs 💞</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {myName} vs {otherName} — retiens la suite, puis retrouve-la.
        </p>
      </div>

      <div className="mt-6 rounded-3xl bg-card/80 p-5 text-center shadow-sm">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {revealing ? `Mémorise encore ${(remaining / 1000).toFixed(1)}s` : "À toi de choisir"}
        </p>
        <div className="mt-4 flex justify-center gap-3 text-5xl">
          {card.sequence.map((emoji, i) => (
            <motion.span
              key={`${emoji}-${i}`}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: revealing ? 1 : 0.25 }}
              className={revealing ? "" : "blur-sm"}
            >
              {revealing ? emoji : "💗"}
            </motion.span>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {card.options.map((option) => (
          <motion.button
            key={option.join("")}
            whileTap={{ scale: 0.96 }}
            disabled={revealing || picking}
            onClick={() => pick(option)}
            className="rounded-2xl border-2 border-border bg-card/80 p-4 text-center text-3xl shadow-sm transition hover:border-primary hover:bg-primary/10 disabled:opacity-45"
          >
            {option.join("  ")}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ── GREEN LIGHT ─────────────────────────────────
function GreenLight({ room, mySlot, myName, otherName, state }: Props & { state: Record<string, unknown> }) {
  const goAt = (state.go_at as number) ?? Date.now();
  const [now, setNow] = useState(Date.now());
  const actedRef = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(t);
  }, []);
  const isGreen = now >= goAt;

  const tap = async () => {
    if (actedRef.current) return;
    actedRef.current = true;
    const otherSlot = mySlot === 1 ? 2 : 1;
    const winner = isGreen ? mySlot : otherSlot;
    await supabase
      .from("rooms")
      .update({ minigame_state: { ...state, phase: "result", winner_slot: winner, early: !isGreen, by: mySlot } })
      .eq("id", room.id);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Feu vert 🚦</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {myName} vs {otherName} — premier à taper sur le vert !
        </p>
      </div>
      <motion.button
        onClick={tap}
        whileTap={{ scale: 0.97 }}
        animate={{ backgroundColor: isGreen ? "#7dd87d" : "#e94e4e" }}
        transition={{ duration: 0.2 }}
        className="mt-6 flex flex-1 items-center justify-center rounded-3xl text-3xl font-bold text-white shadow-lg"
        style={{ minHeight: 320 }}
      >
        {isGreen ? "VAS-Y ! TAPE !" : "Attends..."}
      </motion.button>
    </div>
  );
}

// ── TAP ÉCLAIR ─────────────────────────────────
function TapEclair({ room, mySlot, myName, otherName, state }: Props & { state: Record<string, unknown> }) {
  const signalAt = (state.signal_at as number) ?? Date.now();
  const [now, setNow] = useState(Date.now());
  const actedRef = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30);
    return () => clearInterval(t);
  }, []);
  const flash = now >= signalAt;

  const tap = async () => {
    if (actedRef.current) return;
    actedRef.current = true;
    const otherSlot = mySlot === 1 ? 2 : 1;
    const winner = flash ? mySlot : otherSlot;
    await supabase
      .from("rooms")
      .update({ minigame_state: { ...state, phase: "result", winner_slot: winner, early: !flash, by: mySlot } })
      .eq("id", room.id);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Tap éclair ⚡</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {myName} vs {otherName} — attends l'éclair, puis tape !
        </p>
      </div>
      <motion.button
        onClick={tap}
        whileTap={{ scale: 0.97 }}
        animate={{
          backgroundColor: flash ? "#fde047" : "#1e1b4b",
          color: flash ? "#1e1b4b" : "#fde047",
        }}
        transition={{ duration: 0.12 }}
        className="mt-6 flex flex-1 items-center justify-center rounded-3xl text-6xl font-bold shadow-lg"
        style={{ minHeight: 320 }}
      >
        {flash ? "⚡ TAPE !" : "🌙 patience…"}
      </motion.button>
    </div>
  );
}



// ── CULTURE FLASH ─────────────────────────────────
function CultureFlash({ room, mySlot, state }: Props & { state: Record<string, unknown> }) {
  const qi = (state.qi as number) ?? 0;
  const q = CULTURE_QUESTIONS[qi % CULTURE_QUESTIONS.length];
  const lost = (state.lost as number[]) ?? [];
  const iLost = lost.includes(mySlot);
  const [picking, setPicking] = useState(false);
  const choices = useMemo(() => q.choices, [q]);

  const pick = async (i: number) => {
    if (picking || iLost) return;
    setPicking(true);
    if (i === q.correct) {
      await supabase
        .from("rooms")
        .update({ minigame_state: { ...state, phase: "result", winner_slot: mySlot } })
        .eq("id", room.id);
    } else {
      const newLost = Array.from(new Set([...lost, mySlot]));
      // if both lost → tie (other slot wins by default? no, tie)
      if (newLost.length >= 2) {
        await supabase
          .from("rooms")
          .update({ minigame_state: { ...state, phase: "result", winner_slot: 0, lost: newLost } })
          .eq("id", room.id);
      } else {
        // other player still has a chance → wait. But mark them winner if they answer or after timeout.
        // For simplicity, if I lose, the OTHER wins immediately.
        const otherSlot = mySlot === 1 ? 2 : 1;
        await supabase
          .from("rooms")
          .update({ minigame_state: { ...state, phase: "result", winner_slot: otherSlot, lost: newLost } })
          .eq("id", room.id);
      }
    }
    setPicking(false);
  };

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-center text-xs uppercase tracking-wider text-muted-foreground">Quiz Flash 🧠</p>
      <h2 className="mt-3 text-center font-script text-3xl text-primary">{q.q}</h2>
      <div className="mt-6 grid gap-3">
        {choices.map((c, i) => (
          <motion.button
            key={c}
            whileTap={{ scale: 0.96 }}
            disabled={picking || iLost}
            onClick={() => pick(i)}
            className="rounded-2xl border-2 border-border bg-card/80 p-4 text-left text-base font-medium shadow-sm backdrop-blur hover:border-primary hover:bg-primary/10 disabled:opacity-60"
          >
            {c}
          </motion.button>
        ))}
      </div>
      {iLost && <p className="mt-4 text-center text-sm text-muted-foreground">Mauvaise réponse... on attend l'autre 😬</p>}
    </div>
  );
}

// ── RPS ─────────────────────────────────
const RPS_OPTIONS: { id: string; label: string; emoji: string }[] = [
  { id: "rock", label: "Pierre", emoji: "🪨" },
  { id: "paper", label: "Feuille", emoji: "📄" },
  { id: "scissors", label: "Ciseaux", emoji: "✂️" },
];

function rpsWinner(c1: string, c2: string): 0 | 1 | 2 {
  if (c1 === c2) return 0;
  if (
    (c1 === "rock" && c2 === "scissors") ||
    (c1 === "paper" && c2 === "rock") ||
    (c1 === "scissors" && c2 === "paper")
  )
    return 1;
  return 2;
}

function RPS({ room, mySlot, myName, otherName, state }: Props & { state: Record<string, unknown> }) {
  const round = (state.round as number) ?? 1;
  const wins1 = (state.wins_1 as number) ?? 0;
  const wins2 = (state.wins_2 as number) ?? 0;
  const choice1 = state.choice_1 as string | null;
  const choice2 = state.choice_2 as string | null;
  const myChoice = mySlot === 1 ? choice1 : choice2;
  const otherChoice = mySlot === 1 ? choice2 : choice1;

  const pick = async (id: string) => {
    if (myChoice) return;
    const patch = mySlot === 1 ? { choice_1: id } : { choice_2: id };
    await supabase
      .from("rooms")
      .update({ minigame_state: { ...state, ...patch } })
      .eq("id", room.id);
  };

  // Host resolves round
  useEffect(() => {
    if (mySlot !== 1) return;
    if (!choice1 || !choice2) return;
    const t = setTimeout(async () => {
      const w = rpsWinner(choice1, choice2);
      const nw1 = wins1 + (w === 1 ? 1 : 0);
      const nw2 = wins2 + (w === 2 ? 1 : 0);
      if (nw1 >= RPS_WINS_NEEDED || nw2 >= RPS_WINS_NEEDED) {
        await supabase
          .from("rooms")
          .update({
            minigame_state: {
              ...state,
              phase: "result",
              winner_slot: nw1 > nw2 ? 1 : 2,
              wins_1: nw1,
              wins_2: nw2,
            },
          })
          .eq("id", room.id);
      } else {
        await supabase
          .from("rooms")
          .update({
            minigame_state: {
              ...state,
              round: round + 1,
              wins_1: nw1,
              wins_2: nw2,
              choice_1: null,
              choice_2: null,
              last_winner: w,
            },
          })
          .eq("id", room.id);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [choice1, choice2, mySlot, room.id, round, state, wins1, wins2]);

  const myWins = mySlot === 1 ? wins1 : wins2;
  const otherWins = mySlot === 1 ? wins2 : wins1;

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Pierre-Feuille-Ciseaux ✌️</p>
        <p className="mt-1 text-sm">Manche {round} — {myName} {myWins} / {otherWins} {otherName}</p>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        {RPS_OPTIONS.map((o) => (
          <motion.button
            key={o.id}
            whileTap={{ scale: 0.92 }}
            disabled={!!myChoice}
            onClick={() => pick(o.id)}
            className={`flex flex-col items-center rounded-2xl border-2 p-4 text-center transition ${
              myChoice === o.id ? "border-primary bg-primary/15" : "border-border bg-card/80"
            } disabled:opacity-60`}
          >
            <span className="text-4xl">{o.emoji}</span>
            <span className="mt-2 text-xs font-medium">{o.label}</span>
          </motion.button>
        ))}
      </div>
      <div className="mt-6 flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
        <AnimatePresence mode="wait">
          {!myChoice ? (
            <motion.p key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Fais ton choix 👀
            </motion.p>
          ) : !otherChoice ? (
            <motion.p key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              On attend {otherName}...
            </motion.p>
          ) : (
            <motion.p key="rev" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Résolution... ✨
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
