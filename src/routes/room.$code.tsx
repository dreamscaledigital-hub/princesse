import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Check, Copy, Heart, Loader2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getClientId } from "@/lib/player-id";
import {
  DEFAULT_NAMES,
  GAGES,
  LEURRES,
  NB_TOURS_PHASE2,
  QUESTIONS_PHASE1,
} from "@/lib/game-content";
import { useRoomState, type Room } from "@/lib/use-room-state";
import { FloatingHearts } from "@/components/FloatingHearts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/room/$code")({
  component: GamePage,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <p className="text-muted-foreground">Oups : {error.message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Partie introuvable</div>,
});

function GamePage() {
  const { code } = Route.useParams();
  const router = useRouter();
  const { room, players, answers, guesses, loading, error } = useRoomState(code);
  const [mySlot, setMySlot] = useState<number | null>(null);
  const [joining, setJoining] = useState(false);
  const clientId = typeof window !== "undefined" ? getClientId() : "";

  // Determine my slot from players list
  useEffect(() => {
    if (!clientId) return;
    const me = players.find((p) => p.client_id === clientId);
    if (me) setMySlot(me.slot);
  }, [players, clientId]);

  // Auto-join as slot 2 if free and we're not already in
  useEffect(() => {
    if (!room || !clientId || joining) return;
    const me = players.find((p) => p.client_id === clientId);
    if (me) return;
    const slot1 = players.find((p) => p.slot === 1);
    const slot2 = players.find((p) => p.slot === 2);
    if (slot1 && !slot2) {
      setJoining(true);
      supabase
        .from("players")
        .insert({
          room_id: room.id,
          slot: 2,
          name: DEFAULT_NAMES[1],
          client_id: clientId,
        })
        .then(({ error: e }) => {
          if (e) toast.error("Impossible de rejoindre : " + e.message);
          setJoining(false);
        });
    }
  }, [room, players, clientId, joining]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg">{error ?? "Partie introuvable"}</p>
        <Button onClick={() => router.navigate({ to: "/" })}>Retour</Button>
      </div>
    );
  }

  // Spectator: room full and we are not in
  if (!mySlot && players.length >= 2) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg">Cette partie est déjà complète 💛</p>
        <Button onClick={() => router.navigate({ to: "/" })}>Créer ma partie</Button>
      </div>
    );
  }

  // While joining
  if (!mySlot) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const ctx: Ctx = {
    room,
    players,
    answers,
    guesses,
    mySlot,
    otherSlot: mySlot === 1 ? 2 : 1,
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <FloatingHearts count={8} />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
        {room.phase === "lobby" && <Lobby {...ctx} />}
        {room.phase === "phase1" && <Phase1 {...ctx} />}
        {room.phase === "phase2" && <Phase2 {...ctx} />}
        {room.phase === "dare" && <DareScreen {...ctx} />}
        {room.phase === "done" && <Final {...ctx} />}
      </div>
    </div>
  );
}

type Ctx = {
  room: Room;
  players: import("@/lib/use-room-state").Player[];
  answers: import("@/lib/use-room-state").Answer[];
  guesses: import("@/lib/use-room-state").Guess[];
  mySlot: number;
  otherSlot: number;
};

// ───────────────────────────────────────────── LOBBY ─────

function Lobby({ room, players, mySlot }: Ctx) {
  const me = players.find((p) => p.slot === mySlot);
  const other = players.find((p) => p.slot !== mySlot);
  const [name, setName] = useState(me?.name ?? "");
  useEffect(() => {
    if (me) setName(me.name);
  }, [me]);

  const updateName = async (n: string) => {
    setName(n);
    if (!me) return;
    await supabase.from("players").update({ name: n }).eq("id", me.id);
  };

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?room=${room.code}`
      : "";

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Tu me connais ? 💕",
          text: "Rejoins-moi pour un petit quiz tendre 🥹",
          url: inviteUrl,
        });
        return;
      } catch {
        /* fallthrough */
      }
    }
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Lien copié ✨");
  };

  const startGame = async () => {
    await supabase.from("rooms").update({ phase: "phase1" }).eq("id", room.id);
  };

  const bothHere = players.length === 2;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="font-script text-center text-4xl text-primary">Salon d'attente</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        Code : <span className="font-mono font-bold tracking-widest">{room.code}</span>
      </p>

      <div className="mt-6 space-y-3">
        <PlayerCard label="Toi" name={name} you onNameChange={updateName} />
        <PlayerCard
          label="Ton amour"
          name={other?.name ?? "En attente..."}
          present={!!other}
        />
      </div>

      <div className="mt-6 rounded-2xl bg-card/80 p-4 backdrop-blur">
        <p className="text-sm font-medium">Invite-le/la 💌</p>
        <div className="mt-2 flex gap-2">
          <Input value={inviteUrl} readOnly className="text-xs" />
          <Button size="icon" variant="secondary" onClick={share}>
            <Share2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(inviteUrl);
              toast.success("Copié 💖");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-auto pt-8">
        <Button
          onClick={startGame}
          disabled={!bothHere}
          className="h-14 w-full rounded-2xl text-base font-semibold"
        >
          {bothHere ? "Commencer 💕" : "On attend l'autre... 🥰"}
        </Button>
      </div>
    </div>
  );
}

function PlayerCard({
  label,
  name,
  present = true,
  you = false,
  onNameChange,
}: {
  label: string;
  name: string;
  present?: boolean;
  you?: boolean;
  onNameChange?: (n: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${
        present ? "border-primary/30 bg-card/80" : "border-dashed border-border bg-card/40"
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-2xl">
        {present ? "💖" : "💭"}
      </div>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {you && onNameChange ? (
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="mt-1 h-8 border-0 bg-transparent p-0 text-lg font-semibold focus-visible:ring-0"
            maxLength={20}
          />
        ) : (
          <p className="text-lg font-semibold">{name}</p>
        )}
      </div>
      {present && <Check className="h-5 w-5 text-primary" />}
    </motion.div>
  );
}

// ───────────────────────────────────────────── PHASE 1 ─────

function Phase1({ room, players, answers, mySlot, otherSlot }: Ctx) {
  const myAnswers = answers.filter((a) => a.player_slot === mySlot);
  const otherAnswers = answers.filter((a) => a.player_slot === otherSlot);
  const otherName = players.find((p) => p.slot === otherSlot)?.name ?? "ton amour";

  const myIdx = myAnswers.length;
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Trigger phase2 when both have answered all questions
  useEffect(() => {
    if (mySlot !== 1) return; // only slot 1 triggers to avoid race
    if (
      myAnswers.length === QUESTIONS_PHASE1.length &&
      otherAnswers.length === QUESTIONS_PHASE1.length &&
      room.phase === "phase1"
    ) {
      // Build turn order: alternate starting with slot 1
      const order: number[] = [];
      for (let i = 0; i < NB_TOURS_PHASE2; i++) order.push((i % 2) + 1);
      supabase
        .from("rooms")
        .update({
          phase: "phase2",
          current_turn: 0,
          current_player: order[0],
          turn_order: order,
        })
        .eq("id", room.id);
    }
  }, [myAnswers.length, otherAnswers.length, mySlot, room]);

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("answers").insert({
      room_id: room.id,
      player_slot: mySlot,
      question_index: myIdx,
      answer_text: text.trim(),
    });
    if (error) toast.error(error.message);
    setText("");
    setSubmitting(false);
  };

  if (myIdx >= QUESTIONS_PHASE1.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
          className="text-7xl"
        >
          🥰
        </motion.div>
        <h2 className="mt-6 font-script text-4xl text-primary">
          On attend que {otherName} finisse...
        </h2>
        <p className="mt-2 text-muted-foreground">
          {otherAnswers.length} / {QUESTIONS_PHASE1.length} questions
        </p>
        <Progress
          value={(otherAnswers.length / QUESTIONS_PHASE1.length) * 100}
          className="mt-4 w-3/4"
        />
      </div>
    );
  }

  const q = QUESTIONS_PHASE1[myIdx];

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Étape 1 — On apprend à se connaître
        </p>
        <Progress
          value={(myIdx / QUESTIONS_PHASE1.length) * 100}
          className="mt-2"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {myIdx} / {QUESTIONS_PHASE1.length} — {otherName} : {otherAnswers.length}/{QUESTIONS_PHASE1.length}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={myIdx}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="flex flex-1 flex-col"
        >
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="font-script text-4xl leading-tight text-primary">
              {q.self}
            </h2>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Ta réponse..."
              className="mt-6 h-14 rounded-2xl text-lg"
              maxLength={60}
              autoFocus
            />
          </div>

          <Button
            onClick={submit}
            disabled={!text.trim() || submitting}
            className="mt-6 h-14 w-full rounded-2xl text-base font-semibold"
          >
            Valider 💌
          </Button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────────────────────────── PHASE 2 ─────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Phase2({ room, players, answers, guesses, mySlot, otherSlot }: Ctx) {
  const turnIdx = room.current_turn;
  const turnOrder = room.turn_order ?? [];
  const guesserSlot = turnOrder[turnIdx] ?? room.current_player;
  const targetSlot = guesserSlot === 1 ? 2 : 1;
  const guesserName = players.find((p) => p.slot === guesserSlot)?.name ?? "...";
  const targetName = players.find((p) => p.slot === targetSlot)?.name ?? "...";

  // Question index: we cycle through questions
  const questionIndex = turnIdx % QUESTIONS_PHASE1.length;
  const targetAnswer = answers.find(
    (a) => a.player_slot === targetSlot && a.question_index === questionIndex,
  );

  // Build choices once per turn (deterministic seed = roomId+turn so both screens match)
  const choices = useMemo(() => {
    if (!targetAnswer) return [];
    const pool = LEURRES[questionIndex] ?? [];
    const filtered = pool.filter(
      (l) => l.toLowerCase() !== targetAnswer.answer_text.toLowerCase(),
    );
    const distractors = shuffle(filtered).slice(0, 3);
    return shuffle([targetAnswer.answer_text, ...distractors]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetAnswer?.answer_text, questionIndex, room.id, turnIdx]);

  const isMyTurn = mySlot === guesserSlot;
  const alreadyGuessed = guesses.find((g) => g.turn_index === turnIdx);
  const [picking, setPicking] = useState(false);

  const pick = async (choice: string) => {
    if (!targetAnswer || picking) return;
    setPicking(true);
    const isCorrect =
      choice.toLowerCase().trim() === targetAnswer.answer_text.toLowerCase().trim();

    await supabase.from("guesses").insert({
      room_id: room.id,
      turn_index: turnIdx,
      guesser_slot: guesserSlot,
      chosen_text: choice,
      is_correct: isCorrect,
    });

    if (isCorrect) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#f4a4ae", "#a8c8a8", "#fde2e4", "#ffd1dc"],
      });
      const scoreField = guesserSlot === 1 ? "score_1" : "score_2";
      const currentScore = guesserSlot === 1 ? room.score_1 : room.score_2;
      await supabase
        .from("rooms")
        .update({ [scoreField]: currentScore + 1 })
        .eq("id", room.id);

      setTimeout(() => advanceTurn(), 1800);
    } else {
      // Move to dare: target picks the dare
      await supabase
        .from("rooms")
        .update({
          phase: "dare",
          current_dare: null,
          current_dare_for: guesserSlot,
        })
        .eq("id", room.id);
    }
    setPicking(false);
  };

  const advanceTurn = async () => {
    const next = turnIdx + 1;
    if (next >= NB_TOURS_PHASE2 || next >= turnOrder.length) {
      await supabase.from("rooms").update({ phase: "done" }).eq("id", room.id);
    } else {
      await supabase
        .from("rooms")
        .update({
          current_turn: next,
          current_player: turnOrder[next],
          current_dare: null,
          current_dare_for: null,
        })
        .eq("id", room.id);
    }
  };

  // Auto-advance after correct guess: only guesser triggers (already handled above)
  // But if guess exists and correct, both clients see it — show a brief celebration
  if (alreadyGuessed?.is_correct) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.3, 1] }}
          className="text-8xl"
        >
          💖
        </motion.div>
        <h2 className="mt-6 font-script text-4xl text-primary">
          Bonne réponse !
        </h2>
        <p className="mt-2 text-muted-foreground">
          {guesserName} connaît bien {targetName} 🥹
        </p>
      </div>
    );
  }

  if (!targetAnswer) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Étape 2 — Devine !
        </p>
        <p className="mt-1 text-sm">
          Question {turnIdx + 1} / {NB_TOURS_PHASE2}
          {" — "}
          Score : {players.find((p) => p.slot === mySlot)?.name} {mySlot === 1 ? room.score_1 : room.score_2}
          {" • "}
          {players.find((p) => p.slot === otherSlot)?.name} {otherSlot === 1 ? room.score_1 : room.score_2}
        </p>
      </div>

      {!isMyTurn ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
            className="text-7xl"
          >
            ⏳
          </motion.div>
          <h2 className="mt-6 font-script text-4xl text-primary">
            C'est au tour de {guesserName}...
          </h2>
          <p className="mt-2 text-muted-foreground">
            Il/elle doit deviner ta réponse à : <br />
            <span className="font-medium text-foreground">
              « {QUESTIONS_PHASE1[questionIndex].self} »
            </span>
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={turnIdx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-1 flex-col"
          >
            <h2 className="font-script text-3xl leading-tight text-primary">
              {QUESTIONS_PHASE1[questionIndex].about(targetName)}
            </h2>
            <div className="mt-6 grid gap-3">
              {choices.map((c) => (
                <motion.button
                  key={c}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => pick(c)}
                  disabled={picking}
                  className="rounded-2xl border-2 border-border bg-card/80 p-4 text-left text-base font-medium shadow-sm backdrop-blur transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
                >
                  {c}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ───────────────────────────────────────────── DARE ─────

function DareScreen({ room, players, mySlot }: Ctx) {
  // current_dare_for = slot of the player who must DO the dare (the one who failed)
  // The OTHER slot chooses the dare
  const failedSlot = room.current_dare_for!;
  const chooserSlot = failedSlot === 1 ? 2 : 1;
  const failedName = players.find((p) => p.slot === failedSlot)?.name ?? "...";
  const chooserName = players.find((p) => p.slot === chooserSlot)?.name ?? "...";

  const iChoose = mySlot === chooserSlot;
  const iDo = mySlot === failedSlot;

  // Pick 3 random dares (deterministic per turn)
  const dareOptions = useMemo(
    () => shuffle(GAGES).slice(0, 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room.id, room.current_turn],
  );

  const chooseDare = async (dare: string) => {
    await supabase.from("rooms").update({ current_dare: dare }).eq("id", room.id);
  };

  const advanceTurn = async () => {
    const next = room.current_turn + 1;
    const turnOrder = room.turn_order ?? [];
    if (next >= NB_TOURS_PHASE2 || next >= turnOrder.length) {
      await supabase.from("rooms").update({ phase: "done" }).eq("id", room.id);
    } else {
      await supabase
        .from("rooms")
        .update({
          phase: "phase2",
          current_turn: next,
          current_player: turnOrder[next],
          current_dare: null,
          current_dare_for: null,
        })
        .eq("id", room.id);
    }
  };

  // STEP A: chooser picks
  if (!room.current_dare) {
    if (iChoose) {
      return (
        <div className="flex flex-1 flex-col">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Aïe... mauvaise réponse 😏
          </p>
          <h2 className="mt-2 font-script text-3xl text-primary">
            Choisis un gage pour {failedName} :
          </h2>
          <div className="mt-6 grid gap-3">
            {dareOptions.map((d) => (
              <motion.button
                key={d}
                whileTap={{ scale: 0.96 }}
                onClick={() => chooseDare(d)}
                className="rounded-2xl border-2 border-border bg-card/80 p-4 text-left text-base font-medium shadow-sm backdrop-blur hover:border-primary hover:bg-primary/10"
              >
                {d}
              </motion.button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          animate={{ rotate: [0, 6, -6, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-7xl"
        >
          😬
        </motion.div>
        <h2 className="mt-6 font-script text-4xl text-primary">
          Aïe, raté !
        </h2>
        <p className="mt-2 text-muted-foreground">
          {chooserName} te choisit un petit gage... 😘
        </p>
      </div>
    );
  }

  // STEP B: dare chosen, failed player must do it
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring" }}
        className="text-6xl"
      >
        🎁
      </motion.div>
      <p className="mt-6 text-xs uppercase tracking-wider text-muted-foreground">
        Gage pour {failedName}
      </p>
      <h2 className="mt-3 font-script text-4xl leading-tight text-primary">
        {room.current_dare}
      </h2>
      {iDo ? (
        <Button
          onClick={advanceTurn}
          className="mt-10 h-14 w-full rounded-2xl text-base font-semibold"
        >
          C'est fait ! ✅
        </Button>
      ) : (
        <p className="mt-8 text-muted-foreground">
          On attend que {failedName} fasse son gage... 🥹
        </p>
      )}
    </div>
  );
}

// ───────────────────────────────────────────── FINAL ─────

function Final({ room, players, mySlot }: Ctx) {
  const me = players.find((p) => p.slot === mySlot);
  const other = players.find((p) => p.slot !== mySlot);
  const myScore = mySlot === 1 ? room.score_1 : room.score_2;
  const otherScore = mySlot === 1 ? room.score_2 : room.score_1;

  useEffect(() => {
    const id = setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 100,
        origin: { y: 0.5 },
        colors: ["#f4a4ae", "#a8c8a8", "#fde2e4", "#ffd1dc"],
      });
    }, 300);
    return () => clearTimeout(id);
  }, []);

  const total = NB_TOURS_PHASE2 / 2;
  const both = myScore + otherScore;
  const verdict =
    both >= total * 2 - 1
      ? "Vous vous connaissez par cœur 💕"
      : both >= total
        ? "Vous êtes vraiment complices 🥹"
        : "Va falloir réviser un peu 😏";

  const replay = async () => {
    if (mySlot !== 1) return;
    if (!room) return;
    // wipe answers/guesses, reset scores, back to phase1
    await Promise.all([
      supabase.from("answers").delete().eq("room_id", room.id),
      supabase.from("guesses").delete().eq("room_id", room.id),
    ]);
    await supabase
      .from("rooms")
      .update({
        phase: "phase1",
        current_turn: 0,
        current_player: 1,
        current_dare: null,
        current_dare_for: null,
        score_1: 0,
        score_2: 0,
        turn_order: [],
      })
      .eq("id", room.id);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          C'est fini !
        </p>
        <h2 className="mt-2 font-script text-5xl text-primary">{verdict}</h2>

        <div className="mt-8 flex w-full gap-4">
          <ScoreCard name={me?.name ?? "Toi"} score={myScore} total={total} />
          <ScoreCard name={other?.name ?? "..."} score={otherScore} total={total} />
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="mt-10 font-script text-3xl leading-tight text-primary"
        >
          Peu importe le score,
          <br />
          je t'aime {other?.name ?? "mon amour"} ❤️
        </motion.p>
      </div>

      <div className="space-y-3 pt-6">
        {mySlot === 1 ? (
          <Button
            onClick={replay}
            className="h-14 w-full rounded-2xl text-base font-semibold"
          >
            Rejouer 🔁
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            {me?.name} peut relancer une partie 💕
          </p>
        )}
        <Button
          variant="secondary"
          onClick={() => (window.location.href = "/")}
          className="h-12 w-full rounded-2xl"
        >
          Nouvelle partie
        </Button>
      </div>
    </div>
  );
}

function ScoreCard({ name, score, total }: { name: string; score: number; total: number }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200 }}
      className="flex-1 rounded-2xl bg-card/80 p-4 text-center shadow-md backdrop-blur"
    >
      <Heart className="mx-auto h-6 w-6 fill-primary text-primary" />
      <p className="mt-2 truncate text-sm font-medium text-muted-foreground">{name}</p>
      <p className="font-script text-4xl text-primary">
        {score}<span className="text-xl text-muted-foreground">/{total}</span>
      </p>
    </motion.div>
  );
}
