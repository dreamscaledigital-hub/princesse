import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CULTURE_QUESTIONS,
  GREEN_MAX_DELAY_MS,
  GREEN_MIN_DELAY_MS,
  MINIGAME_DESCRIPTIONS,
  MINIGAME_LABELS,
  RPS_WINS_NEEDED,
  TAP_DURATION_MS,
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

  // Host (slot 1) initializes countdown
  useEffect(() => {
    if (mySlot !== 1) return;
    if (!room.minigame_id) return;
    if (Object.keys(state).length === 0) {
      void supabase
        .from("rooms")
        .update({
          minigame_state: { phase: "countdown", countdown_start: Date.now() },
        })
        .eq("id", room.id);
    }
  }, [room.id, room.minigame_id, mySlot, state]);

  // Countdown → play (host)
  useEffect(() => {
    if (mySlot !== 1) return;
    if (phase !== "countdown") return;
    const start = (state.countdown_start as number) ?? Date.now();
    const remaining = 3000 - (Date.now() - start);
    const id = setTimeout(() => {
      void supabase
        .from("rooms")
        .update({ minigame_state: initialPlayState(room.minigame_id as MinigameId) })
        .eq("id", room.id);
    }, Math.max(0, remaining));
    return () => clearTimeout(id);
  }, [phase, room.id, room.minigame_id, mySlot, state]);

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
      return <TapBattle {...props} state={state} />;
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
    case "tap":
      return { phase: "play", started_at: now, ends_at: now + TAP_DURATION_MS, taps_1: 0, taps_2: 0 };
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

// ── TAP BATTLE ─────────────────────────────────
function TapBattle({ room, mySlot, myName, otherName, state }: Props & { state: Record<string, unknown> }) {
  const endsAt = (state.ends_at as number) ?? Date.now();
  const taps1 = (state.taps_1 as number) ?? 0;
  const taps2 = (state.taps_2 as number) ?? 0;
  const [myCount, setMyCount] = useState(mySlot === 1 ? taps1 : taps2);
  const [now, setNow] = useState(Date.now());
  const lastSyncRef = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 80);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.max(0, endsAt - now);
  const finished = remaining === 0;

  const sync = (count: number) => {
    const nowMs = Date.now();
    if (nowMs - lastSyncRef.current < 180) return;
    lastSyncRef.current = nowMs;
    const patch = mySlot === 1 ? { taps_1: count } : { taps_2: count };
    void supabase
      .from("rooms")
      .update({ minigame_state: { ...state, ...patch } })
      .eq("id", room.id);
  };

  const tap = () => {
    if (finished) return;
    setMyCount((c) => {
      const n = c + 1;
      sync(n);
      return n;
    });
  };

  // When finished: host writes final state + result
  useEffect(() => {
    if (!finished || finishedRef.current) return;
    finishedRef.current = true;
    // First flush my local count
    const patch = mySlot === 1 ? { taps_1: myCount } : { taps_2: myCount };
    const finalState = { ...state, ...patch };
    void supabase
      .from("rooms")
      .update({ minigame_state: finalState })
      .eq("id", room.id)
      .then(() => {
        if (mySlot !== 1) return;
        // Host decides winner after slight delay to allow other client's last sync
        setTimeout(async () => {
          const { data } = await supabase
            .from("rooms")
            .select("minigame_state")
            .eq("id", room.id)
            .maybeSingle();
          const s = ((data?.minigame_state ?? {}) as Record<string, unknown>);
          const t1 = (s.taps_1 as number) ?? 0;
          const t2 = (s.taps_2 as number) ?? 0;
          const winner = t1 === t2 ? 0 : t1 > t2 ? 1 : 2;
          await supabase
            .from("rooms")
            .update({ minigame_state: { ...s, phase: "result", winner_slot: winner } })
            .eq("id", room.id);
        }, 600);
      });
  }, [finished, mySlot, myCount, room.id, state]);

  const myDisplay = mySlot === 1 ? Math.max(myCount, taps1) : Math.max(myCount, taps2);
  const otherDisplay = mySlot === 1 ? taps2 : taps1;

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Tap Battle ⚡</p>
        <p className="mt-1 font-script text-5xl text-primary">{(remaining / 1000).toFixed(1)}s</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-primary/15 p-4 text-center">
          <p className="text-xs text-muted-foreground">{myName} (toi)</p>
          <p className="font-script text-5xl text-primary">{myDisplay}</p>
        </div>
        <div className="rounded-2xl bg-card/80 p-4 text-center">
          <p className="text-xs text-muted-foreground">{otherName}</p>
          <p className="font-script text-5xl text-primary">{otherDisplay}</p>
        </div>
      </div>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={tap}
        disabled={finished}
        className="mt-6 flex-1 select-none rounded-3xl bg-gradient-to-br from-primary to-primary/70 text-2xl font-bold text-primary-foreground shadow-lg disabled:opacity-50"
        style={{ minHeight: 240 }}
      >
        {finished ? "Stop !" : "TAP ! TAP ! TAP !"}
      </motion.button>
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
