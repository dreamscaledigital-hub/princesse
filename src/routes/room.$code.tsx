import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Check, Copy, Heart, Loader2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getClientId } from "@/lib/player-id";
import {
  BADGE_GAGE_PERSO,
  BADGE_QUESTION_PERSO,
  DEFAULT_NAMES,
  GAGES,
  LEURRES,
  NB_GAGES_PERSO_MAX,
  NB_GAGES_PERSO_MIN,
  NB_QUESTIONS_PERSO_MAX,
  NB_QUESTIONS_PERSO_MIN,
  NB_TOURS_PHASE2,
  QUESTIONS_PHASE1,
  SECRETS_SOUS_TITRE,
  SECRETS_TITRE,
} from "@/lib/game-content";
import {
  useRoomState,
  type CustomDare,
  type CustomQuestion,
  type Room,
  type TurnPlanEntry,
} from "@/lib/use-room-state";

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
  const { room, players, answers, guesses, customQuestions, customDares, loading, error } = useRoomState(code);
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
    customQuestions,
    customDares,
    mySlot,
    otherSlot: mySlot === 1 ? 2 : 1,
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <FloatingHearts count={8} />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
        {room.phase === "lobby" && <Lobby {...ctx} />}
        {room.phase === "secrets" && <Secrets {...ctx} />}
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
  customQuestions: CustomQuestion[];
  customDares: CustomDare[];
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
    await supabase.from("rooms").update({ phase: "secrets" }).eq("id", room.id);
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

function Phase1({ room, players, answers, customQuestions, mySlot, otherSlot }: Ctx) {
  const myAnswers = answers.filter((a) => a.player_slot === mySlot);
  const otherAnswers = answers.filter((a) => a.player_slot === otherSlot);
  const otherName = players.find((p) => p.slot === otherSlot)?.name ?? "ton amour";

  const myIdx = myAnswers.length;
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const bothDone =
    myAnswers.length >= QUESTIONS_PHASE1.length &&
    otherAnswers.length >= QUESTIONS_PHASE1.length;

  const [starting, setStarting] = useState(false);
  const startGame = async () => {
    setStarting(true);
    // Build a turn plan mixing custom questions (each asked to the OTHER of its author)
    // with classic alternating questions to reach NB_TOURS_PHASE2 total.
    const customTurns: TurnPlanEntry[] = customQuestions.map((q) => ({
      kind: "custom" as const,
      guesser: q.author_slot === 1 ? 2 : 1,
      custom_id: q.id,
    }));
    const remaining = Math.max(0, NB_TOURS_PHASE2 - customTurns.length);
    const classicTurns: TurnPlanEntry[] = [];
    let next = 1;
    for (let i = 0; i < remaining; i++) {
      classicTurns.push({
        kind: "classic" as const,
        guesser: next,
        qi: i % QUESTIONS_PHASE1.length,
      });
      next = next === 1 ? 2 : 1;
    }
    const plan = shuffle([...customTurns, ...classicTurns]).slice(0, NB_TOURS_PHASE2);
    const order = plan.map((p) => p.guesser);
    const { error } = await supabase
      .from("rooms")
      .update({
        phase: "phase2",
        current_turn: 0,
        current_player: order[0] ?? 1,
        turn_order: order,
        turn_plan: plan,
      })
      .eq("id", room.id)
      .eq("phase", "phase1");
    if (error) {
      toast.error(error.message);
      setStarting(false);
    }
  };


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
          {bothDone ? "💞" : "🥰"}
        </motion.div>
        {bothDone ? (
          <>
            <h2 className="mt-6 font-script text-4xl text-primary">
              Vous avez tous les deux fini !
            </h2>
            <p className="mt-2 text-muted-foreground">
              Prêts à voir à quel point vous vous connaissez ?
            </p>
            <Button
              size="lg"
              onClick={startGame}
              disabled={starting}
              className="mt-6"
            >
              {starting ? "C'est parti..." : "Commencer le jeu 💕"}
            </Button>
          </>
        ) : (
          <>
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
          </>
        )}
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

function Phase2({ room, players, answers, guesses, customQuestions, mySlot, otherSlot }: Ctx) {
  const turnIdx = room.current_turn;
  const turnOrder = room.turn_order ?? [];
  const turnPlan = (room.turn_plan ?? []) as TurnPlanEntry[];
  const currentTurn = turnPlan[turnIdx];

  // Fallback to legacy classic mode if no plan
  const guesserSlot = currentTurn?.guesser ?? turnOrder[turnIdx] ?? room.current_player;
  const targetSlot = guesserSlot === 1 ? 2 : 1;
  const guesserName = players.find((p) => p.slot === guesserSlot)?.name ?? "...";
  const targetName = players.find((p) => p.slot === targetSlot)?.name ?? "...";

  const isCustom = currentTurn?.kind === "custom";
  const customQ = isCustom
    ? customQuestions.find((q) => q.id === currentTurn.custom_id)
    : undefined;
  const authorName = customQ
    ? players.find((p) => p.slot === customQ.author_slot)?.name ?? "ton amour"
    : "";

  // For classic turns
  const classicQi =
    currentTurn?.kind === "classic" ? currentTurn.qi : turnIdx % QUESTIONS_PHASE1.length;
  const targetAnswer = !isCustom
    ? answers.find(
        (a) => a.player_slot === targetSlot && a.question_index === classicQi,
      )
    : undefined;

  // The correct answer for this turn (classic or custom)
  const correctAnswer = isCustom ? customQ?.correct_answer : targetAnswer?.answer_text;

  // Build choices deterministically per turn
  const choices = useMemo(() => {
    if (isCustom) {
      if (!customQ) return [];
      return shuffle([customQ.correct_answer, ...(customQ.wrongs ?? [])]);
    }
    if (!targetAnswer) return [];
    const pool = LEURRES[classicQi] ?? [];
    const filtered = pool.filter(
      (l) => l.toLowerCase() !== targetAnswer.answer_text.toLowerCase(),
    );
    const distractors = shuffle(filtered).slice(0, 3);
    return shuffle([targetAnswer.answer_text, ...distractors]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustom, customQ?.id, targetAnswer?.answer_text, classicQi, room.id, turnIdx]);

  const isMyTurn = mySlot === guesserSlot;
  const alreadyGuessed = guesses.find((g) => g.turn_index === turnIdx);
  const [picking, setPicking] = useState(false);

  const pick = async (choice: string) => {
    if (!correctAnswer || picking) return;
    setPicking(true);
    const isCorrect =
      choice.toLowerCase().trim() === correctAnswer.toLowerCase().trim();

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
      const update =
        guesserSlot === 1
          ? { score_1: room.score_1 + 1 }
          : { score_2: room.score_2 + 1 };
      await supabase.from("rooms").update(update).eq("id", room.id);

      setTimeout(() => advanceTurn(), 1800);
    } else {
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

  if (!correctAnswer) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const questionText = isCustom
    ? customQ!.text
    : QUESTIONS_PHASE1[classicQi].about(targetName);
  const selfText = isCustom ? customQ!.text : QUESTIONS_PHASE1[classicQi].self;

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
            {isCustom ? "💌" : "⏳"}
          </motion.div>
          <h2 className="mt-6 font-script text-4xl text-primary">
            C'est au tour de {guesserName}...
          </h2>
          <p className="mt-2 text-muted-foreground">
            {isCustom ? (
              <>Une petite question piège t'attendait 🙈</>
            ) : (
              <>
                Il/elle doit deviner ta réponse à : <br />
                <span className="font-medium text-foreground">« {selfText} »</span>
              </>
            )}
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
            {isCustom && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-3 rounded-2xl border-2 border-primary/40 bg-primary/10 px-4 py-3 text-center text-sm font-medium text-primary"
              >
                {BADGE_QUESTION_PERSO(authorName)}
              </motion.div>
            )}
            <h2 className="font-script text-3xl leading-tight text-primary">
              {questionText}
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

function DareScreen({ room, players, customDares, mySlot }: Ctx) {
  const failedSlot = room.current_dare_for!;
  const chooserSlot = failedSlot === 1 ? 2 : 1;
  const failedName = players.find((p) => p.slot === failedSlot)?.name ?? "...";
  const chooserName = players.find((p) => p.slot === chooserSlot)?.name ?? "...";

  const iChoose = mySlot === chooserSlot;
  const iDo = mySlot === failedSlot;

  // Custom dares written by the chooser are exclusive to them
  const myCustomDares = customDares.filter((d) => d.author_slot === chooserSlot);

  // Build deterministic pool of 3 options for the chooser: prioritise customs then fill with classics
  const dareOptions = useMemo(() => {
    const customsTexts = myCustomDares.map((d) => `★${d.text}`); // marker prefix to spot customs
    const classics = shuffle(GAGES);
    const pool = shuffle([...customsTexts, ...classics]).slice(0, 3);
    return pool;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, room.current_turn, myCustomDares.length]);

  // Determine if current dare is one written by chooser
  const isCustomDare =
    !!room.current_dare &&
    myCustomDares.some((d) => d.text === room.current_dare);

  const chooseDare = async (dare: string) => {
    const clean = dare.startsWith("★") ? dare.slice(1) : dare;
    await supabase.from("rooms").update({ current_dare: clean }).eq("id", room.id);
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
            {dareOptions.map((d) => {
              const isCustomOpt = d.startsWith("★");
              const label = isCustomOpt ? d.slice(1) : d;
              return (
                <motion.button
                  key={d}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => chooseDare(d)}
                  className="relative rounded-2xl border-2 border-border bg-card/80 p-4 text-left text-base font-medium shadow-sm backdrop-blur hover:border-primary hover:bg-primary/10"
                >
                  {isCustomOpt && (
                    <span className="mb-1 block text-[10px] uppercase tracking-wider text-primary">
                      💕 Ton gage perso
                    </span>
                  )}
                  {label}
                </motion.button>
              );
            })}
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
      {isCustomDare && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
        >
          {BADGE_GAGE_PERSO(chooserName)}
        </motion.div>
      )}
      <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
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


// ───────────────────────────────────────────── SECRETS ─────

type DraftQuestion = { text: string; correct: string; w1: string; w2: string; w3: string };
type DraftDare = { text: string };

function emptyQ(): DraftQuestion {
  return { text: "", correct: "", w1: "", w2: "", w3: "" };
}

function Secrets({ room, players, customQuestions, customDares, mySlot, otherSlot }: Ctx) {
  const myName = players.find((p) => p.slot === mySlot)?.name ?? "Toi";
  const otherName = players.find((p) => p.slot === otherSlot)?.name ?? "ton amour";

  const myExistingQ = customQuestions.filter((q) => q.author_slot === mySlot);
  const myExistingD = customDares.filter((d) => d.author_slot === mySlot);
  const otherCountQ = customQuestions.filter((q) => q.author_slot === otherSlot).length;
  const otherCountD = customDares.filter((d) => d.author_slot === otherSlot).length;

  const secretsReady = (room.secrets_ready ?? []) as number[];
  const iAmReady = secretsReady.includes(mySlot);
  const otherReady = secretsReady.includes(otherSlot);
  const bothReady = iAmReady && otherReady;

  const [questions, setQuestions] = useState<DraftQuestion[]>(() =>
    Array.from({ length: NB_QUESTIONS_PERSO_MIN }, emptyQ),
  );
  const [dares, setDares] = useState<DraftDare[]>(() =>
    Array.from({ length: NB_GAGES_PERSO_MIN }, () => ({ text: "" })),
  );
  const [saving, setSaving] = useState(false);

  // If both ready -> auto-advance to phase1 (any client; idempotent via .eq phase)
  useEffect(() => {
    if (!bothReady || room.phase !== "secrets") return;
    supabase
      .from("rooms")
      .update({ phase: "phase1" })
      .eq("id", room.id)
      .eq("phase", "secrets")
      .then(() => undefined);
  }, [bothReady, room.id, room.phase]);

  if (iAmReady) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          animate={{ rotate: [0, 6, -6, 0] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
          className="text-7xl"
        >
          🙈
        </motion.div>
        <h2 className="mt-6 font-script text-4xl text-primary">
          Tes pièges sont prêts !
        </h2>
        <p className="mt-2 text-muted-foreground">
          {otherReady
            ? "C'est parti..."
            : `On attend que ${otherName} finisse ses pièges...`}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          {otherName} : {otherCountQ} question(s) · {otherCountD} gage(s)
        </p>
      </div>
    );
  }

  const validQuestions = questions.filter(
    (q) => q.text.trim() && q.correct.trim() && q.w1.trim() && q.w2.trim() && q.w3.trim(),
  );
  const validDares = dares.filter((d) => d.text.trim());
  const canSubmit =
    validQuestions.length >= NB_QUESTIONS_PERSO_MIN &&
    validDares.length >= NB_GAGES_PERSO_MIN;

  const submitAll = async () => {
    setSaving(true);
    // Clean any previous drafts from this player (in case of edit)
    if (myExistingQ.length || myExistingD.length) {
      await Promise.all([
        supabase
          .from("custom_questions")
          .delete()
          .eq("room_id", room.id)
          .eq("author_slot", mySlot),
        supabase
          .from("custom_dares")
          .delete()
          .eq("room_id", room.id)
          .eq("author_slot", mySlot),
      ]);
    }
    if (validQuestions.length) {
      await supabase.from("custom_questions").insert(
        validQuestions.map((q) => ({
          room_id: room.id,
          author_slot: mySlot,
          text: q.text.trim(),
          correct_answer: q.correct.trim(),
          wrongs: [q.w1.trim(), q.w2.trim(), q.w3.trim()],
        })),
      );
    }
    if (validDares.length) {
      await supabase.from("custom_dares").insert(
        validDares.map((d) => ({
          room_id: room.id,
          author_slot: mySlot,
          text: d.text.trim(),
        })),
      );
    }
    const nextReady = Array.from(new Set([...secretsReady, mySlot]));
    await supabase
      .from("rooms")
      .update({ secrets_ready: nextReady })
      .eq("id", room.id);
    setSaving(false);
  };

  const updateQ = (i: number, patch: Partial<DraftQuestion>) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const updateD = (i: number, text: string) =>
    setDares((prev) => prev.map((d, idx) => (idx === i ? { text } : d)));

  return (
    <div className="flex flex-1 flex-col pb-8">
      <p className="text-center text-xs uppercase tracking-wider text-muted-foreground">
        Étape secrète · {myName}
      </p>
      <h2 className="mt-1 text-center font-script text-4xl text-primary">{SECRETS_TITRE}</h2>
      <p className="mt-1 text-center text-sm text-muted-foreground">{SECRETS_SOUS_TITRE}</p>

      <div className="mt-6 rounded-2xl bg-card/80 p-4 backdrop-blur">
        <p className="text-sm font-semibold">
          💌 Tes questions pour {otherName}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Écris {NB_QUESTIONS_PERSO_MIN} à {NB_QUESTIONS_PERSO_MAX} questions avec la bonne réponse et 3 mauvaises.
        </p>

        <div className="mt-4 space-y-5">
          {questions.map((q, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border/60 p-3">
              <p className="text-xs font-medium text-muted-foreground">Question {i + 1}</p>
              <Input
                placeholder="La question..."
                value={q.text}
                onChange={(e) => updateQ(i, { text: e.target.value })}
                maxLength={120}
              />
              <Input
                placeholder="✅ La bonne réponse"
                value={q.correct}
                onChange={(e) => updateQ(i, { correct: e.target.value })}
                maxLength={60}
                className="border-primary/40"
              />
              <div className="grid grid-cols-1 gap-2">
                <Input
                  placeholder="❌ Mauvaise réponse 1"
                  value={q.w1}
                  onChange={(e) => updateQ(i, { w1: e.target.value })}
                  maxLength={60}
                />
                <Input
                  placeholder="❌ Mauvaise réponse 2"
                  value={q.w2}
                  onChange={(e) => updateQ(i, { w2: e.target.value })}
                  maxLength={60}
                />
                <Input
                  placeholder="❌ Mauvaise réponse 3"
                  value={q.w3}
                  onChange={(e) => updateQ(i, { w3: e.target.value })}
                  maxLength={60}
                />
              </div>
              {questions.length > NB_QUESTIONS_PERSO_MIN && (
                <button
                  type="button"
                  onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-xs text-muted-foreground underline"
                >
                  Retirer cette question
                </button>
              )}
            </div>
          ))}
        </div>

        {questions.length < NB_QUESTIONS_PERSO_MAX && (
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => setQuestions((prev) => [...prev, emptyQ()])}
          >
            + Ajouter une question
          </Button>
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-card/80 p-4 backdrop-blur">
        <p className="text-sm font-semibold">
          💕 Tes gages perso pour {otherName}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {NB_GAGES_PERSO_MIN} à {NB_GAGES_PERSO_MAX} gages qui pourront tomber quand il/elle se trompe.
        </p>
        <div className="mt-3 space-y-2">
          {dares.map((d, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder={`Gage ${i + 1}...`}
                value={d.text}
                onChange={(e) => updateD(i, e.target.value)}
                maxLength={140}
              />
              {dares.length > NB_GAGES_PERSO_MIN && (
                <button
                  type="button"
                  onClick={() => setDares((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-xs text-muted-foreground underline"
                >
                  Retirer
                </button>
              )}
            </div>
          ))}
        </div>
        {dares.length < NB_GAGES_PERSO_MAX && (
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => setDares((prev) => [...prev, { text: "" }])}
          >
            + Ajouter un gage
          </Button>
        )}
      </div>

      <Button
        onClick={submitAll}
        disabled={!canSubmit || saving}
        className="mt-6 h-14 w-full rounded-2xl text-base font-semibold"
      >
        {saving ? "..." : "C'est prêt 🙈"}
      </Button>
      {!canSubmit && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Remplis au moins {NB_QUESTIONS_PERSO_MIN} questions complètes et {NB_GAGES_PERSO_MIN} gage.
        </p>
      )}
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {otherName} : {otherReady ? "a fini 💕" : "prépare ses pièges..."}
      </p>
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
    await Promise.all([
      supabase.from("answers").delete().eq("room_id", room.id),
      supabase.from("guesses").delete().eq("room_id", room.id),
      supabase.from("custom_questions").delete().eq("room_id", room.id),
      supabase.from("custom_dares").delete().eq("room_id", room.id),
    ]);
    await supabase
      .from("rooms")
      .update({
        phase: "secrets",
        current_turn: 0,
        current_player: 1,
        current_dare: null,
        current_dare_for: null,
        score_1: 0,
        score_2: 0,
        turn_order: [],
        turn_plan: [],
        secrets_ready: [],
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
