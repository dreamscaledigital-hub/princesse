import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Check, Copy, Heart, Loader2, Share2 } from "lucide-react";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { getClientId } from "@/lib/player-id";
import {
  BADGE_GAGE_PERSO,
  BADGE_QUESTION_PERSO,
  COMPLICITY_GAINS,
  COMPLICITY_MAX,
  DEFAULT_NAMES,
  GAGES_BY_LEVEL,
  LEURRES,
  LEVEL_LABELS,
  MINIGAME_IDS,
  type ModeId,
  NB_GAGES_PERSO_MAX,
  NB_GAGES_PERSO_MIN,
  NB_MINIGAMES_FINALE,
  NB_MINIGAMES_ROUND2,
  NB_QUESTIONS_PERSO_MAX,
  NB_QUESTIONS_PERSO_MIN,
  NB_TOURS_PHASE2,
  QUESTIONS_PHASE1,
  SECRETS_SOUS_TITRE,
  SECRETS_TITRE,
  STAGE_DARE_LEVEL,
  SURPRISE_FINALE,
  SURPRISE_TITRE,
  type DareLevel,
  type MinigameId,
} from "@/lib/game-content";
import {
  useRoomState,
  type CustomDare,
  type CustomQuestion,
  type Room,
  type TurnPlanEntry,
} from "@/lib/use-room-state";

import { FloatingHearts } from "@/components/FloatingHearts";
import { ComplicityBar } from "@/components/ComplicityBar";
import { MenuScreen } from "@/components/MenuScreen";
import { Minigame } from "@/components/minigames";
import { RPSExtreme } from "@/components/RPSExtreme";
import { Mastermind } from "@/components/Mastermind";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

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

  useEffect(() => {
    if (!clientId) return;
    const me = players.find((p) => p.client_id === clientId);
    if (me) setMySlot(me.slot);
  }, [players, clientId]);

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
        .insert({ room_id: room.id, slot: 2, name: DEFAULT_NAMES[1], client_id: clientId })
        .then(({ error: e }: { error: { message: string } | null }) => {
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

  if (!mySlot && players.length >= 2) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg">Cette partie est déjà complète 💛</p>
        <Button onClick={() => router.navigate({ to: "/" })}>Créer ma partie</Button>
      </div>
    );
  }

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

  const showComplicity = !["lobby", "secrets"].includes(room.phase);
  const name1 = players.find((p) => p.slot === 1)?.name ?? "Toi";
  const name2 = players.find((p) => p.slot === 2)?.name ?? "Ton amour";

  const backToMenu = async () => {
    await supabase
      .from("rooms")
      .update({
        phase: "menu",
        mode: null,
        minigame_id: null,
        minigame_state: {},
        current_dare: null,
        current_dare_for: null,
      })
      .eq("id", room.id);
  };

  const pickMode = async (mode: ModeId) => {
    if (mode === "full") {
      await supabase
        .from("rooms")
        .update({
          phase: "secrets",
          mode: "full",
          stage: "round1",
          current_turn: 0,
          current_player: 1,
          score_1: 0,
          score_2: 0,
          turn_order: [],
          turn_plan: [],
          secrets_ready: [],
          minigame_id: null,
          minigame_state: {},
          minigame_round: 0,
          finale_scores: { "1": 0, "2": 0 },
          current_dare: null,
          current_dare_for: null,
        })
        .eq("id", room.id);
    } else if (mode === "quiz") {
      const myAns = answers.filter((a) => a.player_slot === 1).length;
      const otherAns = answers.filter((a) => a.player_slot === 2).length;
      const haveAnswers = myAns >= QUESTIONS_PHASE1.length && otherAns >= QUESTIONS_PHASE1.length;
      if (!haveAnswers) {
        await supabase
          .from("rooms")
          .update({
            phase: "phase1",
            mode: "quiz",
            stage: "round1",
            current_turn: 0,
            current_player: 1,
            score_1: 0,
            score_2: 0,
            turn_order: [],
            turn_plan: [],
            current_dare: null,
            current_dare_for: null,
          })
          .eq("id", room.id);
      } else {
        const plan = buildQuizPlan(customQuestions);
        await supabase
          .from("rooms")
          .update({
            phase: "phase2",
            mode: "quiz",
            stage: "round1",
            current_turn: 0,
            current_player: plan[0]?.guesser ?? 1,
            turn_order: plan.map((p) => p.guesser),
            turn_plan: plan,
            current_dare: null,
            current_dare_for: null,
          })
          .eq("id", room.id);
      }
    } else if (mode === "minigames" || mode === "mastermind") {
      await supabase
        .from("rooms")
        .update({
          phase: "minigames",
          mode,
          minigame_id: null,
          minigame_state: {},
          current_dare: null,
          current_dare_for: null,
        })
        .eq("id", room.id);
    } else if (mode === "edit_secrets") {
      await supabase
        .from("rooms")
        .update({
          phase: "secrets",
          mode: "edit_secrets",
          secrets_ready: [],
        })
        .eq("id", room.id);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <FloatingHearts count={8} />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
        {showComplicity && (
          <ComplicityBar value={room.complicity ?? 0} name1={name1} name2={name2} />
        )}
        {room.phase !== "lobby" && room.phase !== "menu" && (
          <button
            onClick={backToMenu}
            className="mb-3 self-start rounded-full bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition hover:bg-card"
          >
            ← Menu
          </button>
        )}
        {room.phase === "lobby" && <Lobby {...ctx} />}
        {room.phase === "menu" && <MenuScreen room={room} players={players} mySlot={mySlot} onPick={pickMode} />}
        {room.phase === "secrets" && <Secrets {...ctx} onDone={backToMenu} />}
        {room.phase === "phase1" && <Phase1 {...ctx} />}
        {room.phase === "phase2" && <Phase2 {...ctx} />}
        {room.phase === "minigames" && <MinigamesMode ctx={ctx} />}
        {room.phase === "dare" && <DareScreen {...ctx} />}
        {room.phase === "done" && <Final {...ctx} onMenu={backToMenu} />}
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

// ───────────────────────────────────────────── helpers ─────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickMinigame(): MinigameId {
  return MINIGAME_IDS[Math.floor(Math.random() * MINIGAME_IDS.length)];
}

function currentStageDareLevel(stage: string): DareLevel {
  if (stage === "round2") return "medium";
  if (stage === "finale") return "ultra";
  return "simple";
}

async function bumpComplicity(room: Room, gain: number) {
  const next = Math.min(COMPLICITY_MAX, (room.complicity ?? 0) + gain);
  if (next === room.complicity) return;
  await supabase.from("rooms").update({ complicity: next }).eq("id", room.id);
}

function buildQuizPlan(customQuestions: CustomQuestion[]): TurnPlanEntry[] {
  const customs: TurnPlanEntry[] = customQuestions.map((q) => ({
    kind: "custom" as const,
    guesser: q.author_slot === 1 ? 2 : 1,
    custom_id: q.id,
  }));
  const classics: TurnPlanEntry[] = [];
  let next = 1;
  const target = Math.max(NB_TOURS_PHASE2, QUESTIONS_PHASE1.length * 2);
  for (let i = 0; i < target; i++) {
    classics.push({ kind: "classic" as const, guesser: next, qi: i % QUESTIONS_PHASE1.length });
    next = next === 1 ? 2 : 1;
  }
  return shuffle([...customs, ...classics]);
}


// ───────────────────────────────────────────── LOBBY ─────

function Lobby({ room, players, mySlot }: Ctx) {
  const me = players.find((p) => p.slot === mySlot);
  const other = players.find((p) => p.slot !== mySlot);
  const [name, setName] = useState(me?.name ?? "");
  useEffect(() => { if (me) setName(me.name); }, [me]);

  const updateName = async (n: string) => {
    setName(n);
    if (!me) return;
    await supabase.from("players").update({ name: n }).eq("id", me.id);
  };

  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/?room=${room.code}` : "";

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Tu me connais ? 💕", text: "Rejoins-moi pour un petit quiz tendre 🥹", url: inviteUrl });
        return;
      } catch { /* fallthrough */ }
    }
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Lien copié ✨");
  };

  const startGame = async () => {
    await supabase.from("rooms").update({ phase: "menu", mode: null }).eq("id", room.id);
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
        <PlayerCard label="Ton amour" name={other?.name ?? "En attente..."} present={!!other} />
      </div>

      <div className="mt-6 rounded-2xl bg-card/80 p-4 backdrop-blur">
        <p className="text-sm font-medium">Invite-le/la 💌</p>
        <div className="mt-2 flex gap-2">
          <Input value={inviteUrl} readOnly className="text-xs" />
          <Button size="icon" variant="secondary" onClick={share}>
            <Share2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="secondary" onClick={async () => { await navigator.clipboard.writeText(inviteUrl); toast.success("Copié 💖"); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-auto pt-8">
        <Button onClick={startGame} disabled={!bothHere} className="h-14 w-full rounded-2xl text-base font-semibold">
          {bothHere ? "Commencer 💕" : "On attend l'autre... 🥰"}
        </Button>
      </div>
    </div>
  );
}

function PlayerCard({ label, name, present = true, you = false, onNameChange }: { label: string; name: string; present?: boolean; you?: boolean; onNameChange?: (n: string) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${present ? "border-primary/30 bg-card/80" : "border-dashed border-border bg-card/40"}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-2xl">{present ? "💖" : "💭"}</div>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {you && onNameChange ? (
          <Input value={name} onChange={(e) => onNameChange(e.target.value)} className="mt-1 h-8 border-0 bg-transparent p-0 text-lg font-semibold focus-visible:ring-0" maxLength={20} />
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

  const bothDone = myAnswers.length >= QUESTIONS_PHASE1.length && otherAnswers.length >= QUESTIONS_PHASE1.length;

  const [starting, setStarting] = useState(false);
  const startGame = async () => {
    setStarting(true);
    const customTurns: TurnPlanEntry[] = customQuestions.map((q) => ({
      kind: "custom" as const, guesser: q.author_slot === 1 ? 2 : 1, custom_id: q.id,
    }));
    const remaining = Math.max(0, NB_TOURS_PHASE2 - customTurns.length);
    const classicTurns: TurnPlanEntry[] = [];
    let next = 1;
    for (let i = 0; i < remaining; i++) {
      classicTurns.push({ kind: "classic" as const, guesser: next, qi: i % QUESTIONS_PHASE1.length });
      next = next === 1 ? 2 : 1;
    }
    const plan = shuffle([...customTurns, ...classicTurns]).slice(0, NB_TOURS_PHASE2);
    const order = plan.map((p) => p.guesser);
    const { error } = await supabase.from("rooms")
      .update({ phase: "phase2", stage: "round1", current_turn: 0, current_player: order[0] ?? 1, turn_order: order, turn_plan: plan })
      .eq("id", room.id).eq("phase", "phase1");
    if (error) { toast.error(error.message); setStarting(false); }
  };

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("answers").insert({
      room_id: room.id, player_slot: mySlot, question_index: myIdx, answer_text: text.trim(),
    });
    if (error) toast.error(error.message);
    setText(""); setSubmitting(false);
  };

  if (myIdx >= QUESTIONS_PHASE1.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ repeat: Infinity, duration: 2.5 }} className="text-7xl">
          {bothDone ? "💞" : "🥰"}
        </motion.div>
        {bothDone ? (
          <>
            <h2 className="mt-6 font-script text-4xl text-primary">Vous avez tous les deux fini !</h2>
            <p className="mt-2 text-muted-foreground">Prêts à voir à quel point vous vous connaissez ?</p>
            <Button size="lg" onClick={startGame} disabled={starting} className="mt-6">
              {starting ? "C'est parti..." : "Commencer le jeu 💕"}
            </Button>
          </>
        ) : (
          <>
            <h2 className="mt-6 font-script text-4xl text-primary">On attend que {otherName} finisse...</h2>
            <p className="mt-2 text-muted-foreground">{otherAnswers.length} / {QUESTIONS_PHASE1.length} questions</p>
            <Progress value={(otherAnswers.length / QUESTIONS_PHASE1.length) * 100} className="mt-4 w-3/4" />
          </>
        )}
      </div>
    );
  }

  const q = QUESTIONS_PHASE1[myIdx];

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Étape 1 — On apprend à se connaître</p>
        <Progress value={(myIdx / QUESTIONS_PHASE1.length) * 100} className="mt-2" />
        <p className="mt-1 text-xs text-muted-foreground">{myIdx} / {QUESTIONS_PHASE1.length} — {otherName} : {otherAnswers.length}/{QUESTIONS_PHASE1.length}</p>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={myIdx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col justify-center">
            <h2 className="font-script text-4xl leading-tight text-primary">{q.self}</h2>
            <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Ta réponse..." className="mt-6 h-14 rounded-2xl text-lg" maxLength={60} autoFocus />
          </div>
          <Button onClick={submit} disabled={!text.trim() || submitting} className="mt-6 h-14 w-full rounded-2xl text-base font-semibold">
            Valider 💌
          </Button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────────────────────────── PHASE 2 (dispatch sur stage) ─────

function Phase2(ctx: Ctx) {
  const { room, mySlot } = ctx;
  const stage = room.stage ?? "round1";

  // Stage transitions are host-driven (slot 1)
  if (stage === "round1") return <Round1QCM {...ctx} />;
  if (stage === "round2" || stage === "finale") return <MinigameStage {...ctx} />;
  // stage === "done" but phase==="phase2" shouldn't happen, fall through
  return <Round1QCM {...ctx} />;
}

// Round 1 = the existing "deviner l'autre"
function Round1QCM({ room, players, answers, guesses, customQuestions, mySlot, otherSlot }: Ctx) {
  const turnIdx = room.current_turn;
  const turnOrder = room.turn_order ?? [];
  const turnPlan = (room.turn_plan ?? []) as TurnPlanEntry[];
  const currentTurn = turnPlan[turnIdx];

  const guesserSlot = currentTurn?.guesser ?? turnOrder[turnIdx] ?? room.current_player;
  const targetSlot = guesserSlot === 1 ? 2 : 1;
  const guesserName = players.find((p) => p.slot === guesserSlot)?.name ?? "...";
  const targetName = players.find((p) => p.slot === targetSlot)?.name ?? "...";

  const isCustom = currentTurn?.kind === "custom";
  const customQ = isCustom ? customQuestions.find((q) => q.id === currentTurn.custom_id) : undefined;
  const authorName = customQ ? players.find((p) => p.slot === customQ.author_slot)?.name ?? "ton amour" : "";

  const classicQi = currentTurn?.kind === "classic" ? currentTurn.qi : turnIdx % QUESTIONS_PHASE1.length;
  const targetAnswer = !isCustom
    ? answers.find((a) => a.player_slot === targetSlot && a.question_index === classicQi)
    : undefined;

  const correctAnswer = isCustom ? customQ?.correct_answer : targetAnswer?.answer_text;

  const choices = useMemo(() => {
    if (isCustom) {
      if (!customQ) return [];
      return shuffle([customQ.correct_answer, ...(customQ.wrongs ?? [])]);
    }
    if (!targetAnswer) return [];
    const pool = LEURRES[classicQi] ?? [];
    const filtered = pool.filter((l) => l.toLowerCase() !== targetAnswer.answer_text.toLowerCase());
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
    const isCorrect = choice.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    await supabase.from("guesses").insert({
      room_id: room.id, turn_index: turnIdx, guesser_slot: guesserSlot, chosen_text: choice, is_correct: isCorrect,
    });
    if (isCorrect) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ["#f4a4ae", "#a8c8a8", "#fde2e4", "#ffd1dc"] });
      const update = guesserSlot === 1 ? { score_1: room.score_1 + 1 } : { score_2: room.score_2 + 1 };
      await supabase.from("rooms").update(update).eq("id", room.id);
      await bumpComplicity(room, COMPLICITY_GAINS.correct);
      setTimeout(() => advanceTurn(), 1800);
    } else {
      await supabase.from("rooms").update({
        phase: "dare", current_dare: null, current_dare_for: guesserSlot,
        minigame_state: { dare_level: "simple" },
      }).eq("id", room.id);
    }
    setPicking(false);
  };

  const advanceTurn = async () => {
    const next = turnIdx + 1;
    if (next >= turnOrder.length) {
      if (room.mode === "quiz") {
        // standalone quiz: regenerate plan and loop
        if (mySlot === 1) {
          const plan = buildQuizPlan(customQuestions);
          await supabase.from("rooms").update({
            current_turn: 0, current_player: plan[0]?.guesser ?? 1,
            turn_order: plan.map((p) => p.guesser), turn_plan: plan,
            current_dare: null, current_dare_for: null,
          }).eq("id", room.id);
        }
        return;
      }
      // full mode → Round 2
      if (mySlot === 1) {
        await supabase.from("rooms").update({
          stage: "round2", minigame_id: pickMinigame(), minigame_state: {}, minigame_round: 0,
        }).eq("id", room.id);
      }
    } else {
      await supabase.from("rooms").update({
        current_turn: next, current_player: turnOrder[next], current_dare: null, current_dare_for: null,
      }).eq("id", room.id);
    }
  };


  if (alreadyGuessed?.is_correct) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} className="text-8xl">💖</motion.div>
        <h2 className="mt-6 font-script text-4xl text-primary">Bonne réponse !</h2>
        <p className="mt-2 text-muted-foreground">{guesserName} connaît bien {targetName} 🥹</p>
      </div>
    );
  }

  if (!correctAnswer) {
    return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const questionText = isCustom ? customQ!.text : QUESTIONS_PHASE1[classicQi].about(targetName);
  const selfText = isCustom ? customQ!.text : QUESTIONS_PHASE1[classicQi].self;

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Manche 1 — Tu me connais ?</p>
        <p className="mt-1 text-sm">
          Question {turnIdx + 1} / {NB_TOURS_PHASE2}
          {" — "}Score : {players.find((p) => p.slot === mySlot)?.name} {mySlot === 1 ? room.score_1 : room.score_2}
          {" • "}{players.find((p) => p.slot === otherSlot)?.name} {otherSlot === 1 ? room.score_1 : room.score_2}
        </p>
      </div>
      {!isMyTurn ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.8 }} className="text-7xl">
            {isCustom ? "💌" : "⏳"}
          </motion.div>
          <h2 className="mt-6 font-script text-4xl text-primary">C'est au tour de {guesserName}...</h2>
          <p className="mt-2 text-muted-foreground">
            {isCustom ? <>Une petite question piège t'attendait 🙈</> : (
              <>Il/elle doit deviner ta réponse à : <br /><span className="font-medium text-foreground">« {selfText} »</span></>
            )}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={turnIdx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-1 flex-col">
            {isCustom && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="mb-3 rounded-2xl border-2 border-primary/40 bg-primary/10 px-4 py-3 text-center text-sm font-medium text-primary">
                {BADGE_QUESTION_PERSO(authorName)}
              </motion.div>
            )}
            <h2 className="font-script text-3xl leading-tight text-primary">{questionText}</h2>
            <div className="mt-6 grid gap-3">
              {choices.map((c) => (
                <motion.button key={c} whileTap={{ scale: 0.96 }} onClick={() => pick(c)} disabled={picking}
                  className="rounded-2xl border-2 border-border bg-card/80 p-4 text-left text-base font-medium shadow-sm backdrop-blur transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60">
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

// ───────────────────────────────────────────── MINIGAME STAGE (round2 + finale) ─────

function MinigameStage(ctx: Ctx) {
  const { room, mySlot, players } = ctx;
  const stage = room.stage as "round2" | "finale";
  const total = stage === "round2" ? NB_MINIGAMES_ROUND2 : NB_MINIGAMES_FINALE;
  const done = room.minigame_round ?? 0;
  const myName = players.find((p) => p.slot === mySlot)?.name ?? "Toi";
  const otherName = players.find((p) => p.slot !== mySlot)?.name ?? "...";

  // If no minigame yet picked, host picks
  useEffect(() => {
    if (mySlot !== 1) return;
    if (room.minigame_id) return;
    void supabase.from("rooms").update({ minigame_id: pickMinigame(), minigame_state: {} }).eq("id", room.id);
  }, [room.id, room.minigame_id, mySlot]);

  const finishMinigame = async (winnerSlot: number | null) => {
    if (mySlot !== 1) return;
    // Always bump complicity for a minigame completed
    await bumpComplicity(room, COMPLICITY_GAINS.minigame);

    if (winnerSlot === null) {
      // Tie: no dare, just advance
      await advanceAfterMinigame();
      return;
    }
    // Loser gets a dare
    const loser = winnerSlot === 1 ? 2 : 1;
    // Track finale champion score
    if (stage === "finale") {
      const fs = room.finale_scores ?? { "1": 0, "2": 0 };
      const next = { ...fs, [String(winnerSlot)]: (fs[String(winnerSlot) as "1" | "2"] ?? 0) + 1 };
      await supabase.from("rooms").update({ finale_scores: next }).eq("id", room.id);
    } else {
      // Round 2 winner also gets a +1 score
      const update = winnerSlot === 1 ? { score_1: room.score_1 + 1 } : { score_2: room.score_2 + 1 };
      await supabase.from("rooms").update(update).eq("id", room.id);
    }
    const level: DareLevel = currentStageDareLevel(stage);
    await supabase.from("rooms").update({
      phase: "dare",
      current_dare: null,
      current_dare_for: loser,
      minigame_state: { dare_level: level },
    }).eq("id", room.id);
  };

  const advanceAfterMinigame = async () => {
    const nextRound = done + 1;
    if (nextRound >= total) {
      if (stage === "round2") {
        await supabase.from("rooms").update({
          stage: "finale", minigame_id: pickMinigame(), minigame_state: {}, minigame_round: 0,
        }).eq("id", room.id);
      } else {
        await supabase.from("rooms").update({ phase: "done", stage: "done", minigame_id: null, minigame_state: {} }).eq("id", room.id);
      }
    } else {
      await supabase.from("rooms").update({
        minigame_round: nextRound, minigame_id: pickMinigame(), minigame_state: {},
      }).eq("id", room.id);
    }
  };

  if (!room.minigame_id) {
    return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {stage === "round2" ? "Manche 2 — Battles instantanées" : "Le Grand Défi 🔥"}
        </p>
        <p className="text-xs text-muted-foreground">Mini-jeu {done + 1} / {total}</p>
      </div>
      <Minigame
        room={room}
        mySlot={mySlot}
        myName={myName}
        otherName={otherName}
        onFinish={finishMinigame}
      />
    </div>
  );
}

// ───────────────────────────────────────────── MINIGAMES MODE (Pierre-Papier-Ciseaux Extrême) ─────

function MinigamesMode({ ctx }: { ctx: Ctx }) {
  const { room, mySlot, players } = ctx;
  const myName = players.find((p) => p.slot === mySlot)?.name ?? "Toi";
  const otherName = players.find((p) => p.slot !== mySlot)?.name ?? "...";

  const backToMenu = async () => {
    await supabase.from("rooms").update({
      phase: "menu",
      mode: null,
      minigame_id: null,
      minigame_state: {},
      current_dare: null,
      current_dare_for: null,
    }).eq("id", room.id);
  };

  const onDareDone = async () => {
    await bumpComplicity(room, COMPLICITY_GAINS.dare_done);
  };

  if (room.mode === "mastermind") {
    return (
      <Mastermind
        room={room}
        mySlot={mySlot}
        myName={myName}
        otherName={otherName}
        onBackToMenu={backToMenu}
        onDareDone={onDareDone}
      />
    );
  }

  return (
    <RPSExtreme
      room={room}
      mySlot={mySlot}
      myName={myName}
      otherName={otherName}
      onBackToMenu={backToMenu}
      onDareDone={onDareDone}
    />
  );
}



// ───────────────────────────────────────────── DARE ─────

function DareScreen({ room, players, customDares, customQuestions, mySlot }: Ctx) {
  const failedSlot = room.current_dare_for!;
  const chooserSlot = failedSlot === 1 ? 2 : 1;
  const failedName = players.find((p) => p.slot === failedSlot)?.name ?? "...";
  const chooserName = players.find((p) => p.slot === chooserSlot)?.name ?? "...";

  const stage = room.stage ?? "round1";
  const stageKey = stage === "done" ? "round1" : stage;
  const level: DareLevel =
    ((room.minigame_state ?? {}) as Record<string, unknown>).dare_level as DareLevel
    ?? currentStageDareLevel(stageKey);

  const iChoose = mySlot === chooserSlot;
  const iDo = mySlot === failedSlot;

  const myCustomDares = customDares.filter((d) => d.author_slot === chooserSlot && (d.level ?? "simple") === level);

  const dareOptions = useMemo(() => {
    const customsTexts = myCustomDares.map((d) => `★${d.text}`);
    const classics = shuffle(GAGES_BY_LEVEL[level] ?? []);
    const pool = shuffle([...customsTexts, ...classics]).slice(0, 3);
    return pool;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, room.current_turn, room.minigame_round, myCustomDares.length, level]);

  const isCustomDare = !!room.current_dare && myCustomDares.some((d) => d.text === room.current_dare);

  const chooseDare = async (dare: string) => {
    const clean = dare.startsWith("★") ? dare.slice(1) : dare;
    await supabase.from("rooms").update({ current_dare: clean }).eq("id", room.id);
  };

  const advance = async () => {
    await bumpComplicity(room, COMPLICITY_GAINS.dare_done);
    if (room.mode === "minigames") {
      await supabase.from("rooms").update({
        phase: "minigames", current_dare: null, current_dare_for: null,
        minigame_id: null, minigame_state: {},
      }).eq("id", room.id);
      return;
    }
    if (room.mode === "quiz") {
      const turnOrder = room.turn_order ?? [];
      const next = room.current_turn + 1;
      if (next >= turnOrder.length) {
        if (mySlot === 1) {
          const fresh = buildQuizPlan(customQuestions);
          await supabase.from("rooms").update({
            phase: "phase2", current_dare: null, current_dare_for: null,
            current_turn: 0, current_player: fresh[0]?.guesser ?? 1,
            turn_order: fresh.map((p) => p.guesser), turn_plan: fresh,
          }).eq("id", room.id);

        } else {
          await supabase.from("rooms").update({
            phase: "phase2", current_dare: null, current_dare_for: null,
          }).eq("id", room.id);
        }
      } else {
        await supabase.from("rooms").update({
          phase: "phase2", current_turn: next, current_player: turnOrder[next],
          current_dare: null, current_dare_for: null,
        }).eq("id", room.id);
      }
      return;
    }
    // Return to the right stage flow (full mode)

    if (stage === "round1") {
      const next = room.current_turn + 1;
      const turnOrder = room.turn_order ?? [];
      if (next >= NB_TOURS_PHASE2 || next >= turnOrder.length) {
        if (mySlot === 1) {
          await supabase.from("rooms").update({
            phase: "phase2", stage: "round2", current_dare: null, current_dare_for: null,
            minigame_id: pickMinigame(), minigame_state: {}, minigame_round: 0,
          }).eq("id", room.id);
        } else {
          await supabase.from("rooms").update({
            phase: "phase2", current_dare: null, current_dare_for: null,
          }).eq("id", room.id);
        }
      } else {
        await supabase.from("rooms").update({
          phase: "phase2", current_turn: next, current_player: turnOrder[next],
          current_dare: null, current_dare_for: null,
        }).eq("id", room.id);
      }
    } else {
      // round2 / finale: clear dare and advance minigame
      const total = stage === "round2" ? NB_MINIGAMES_ROUND2 : NB_MINIGAMES_FINALE;
      const nextRound = (room.minigame_round ?? 0) + 1;
      if (mySlot === 1) {
        if (nextRound >= total) {
          if (stage === "round2") {
            await supabase.from("rooms").update({
              phase: "phase2", stage: "finale", current_dare: null, current_dare_for: null,
              minigame_id: pickMinigame(), minigame_state: {}, minigame_round: 0,
            }).eq("id", room.id);
          } else {
            await supabase.from("rooms").update({
              phase: "done", stage: "done", current_dare: null, current_dare_for: null,
              minigame_id: null, minigame_state: {},
            }).eq("id", room.id);
          }
        } else {
          await supabase.from("rooms").update({
            phase: "phase2", current_dare: null, current_dare_for: null,
            minigame_round: nextRound, minigame_id: pickMinigame(), minigame_state: {},
          }).eq("id", room.id);
        }
      } else {
        await supabase.from("rooms").update({
          phase: "phase2", current_dare: null, current_dare_for: null,
        }).eq("id", room.id);
      }
    }
  };

  if (!room.current_dare) {
    if (iChoose) {
      return (
        <div className="flex flex-1 flex-col">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Aïe... mauvaise réponse 😏</p>
          <div className="mt-2 inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {LEVEL_LABELS[level]}
          </div>
          <h2 className="mt-3 font-script text-3xl text-primary">Choisis un gage pour {failedName} :</h2>
          <div className="mt-6 grid gap-3">
            {dareOptions.map((d) => {
              const isCustomOpt = d.startsWith("★");
              const label = isCustomOpt ? d.slice(1) : d;
              return (
                <motion.button key={d} whileTap={{ scale: 0.96 }} onClick={() => chooseDare(d)}
                  className="relative rounded-2xl border-2 border-border bg-card/80 p-4 text-left text-base font-medium shadow-sm backdrop-blur hover:border-primary hover:bg-primary/10">
                  {isCustomOpt && (
                    <span className="mb-1 block text-[10px] uppercase tracking-wider text-primary">💕 Ton gage perso</span>
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
        <motion.div animate={{ rotate: [0, 6, -6, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-7xl">😬</motion.div>
        <h2 className="mt-6 font-script text-4xl text-primary">Aïe, raté !</h2>
        <p className="mt-2 text-muted-foreground">{chooserName} te choisit un petit gage... 😘</p>
        <div className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {LEVEL_LABELS[level]}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="text-6xl">🎁</motion.div>
      <div className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        {LEVEL_LABELS[level]}
      </div>
      {isCustomDare && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {BADGE_GAGE_PERSO(chooserName)}
        </motion.div>
      )}
      <p className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">Gage pour {failedName}</p>
      <h2 className="mt-3 font-script text-4xl leading-tight text-primary">{room.current_dare}</h2>
      {iDo ? (
        <Button onClick={advance} className="mt-10 h-14 w-full rounded-2xl text-base font-semibold">C'est fait ! ✅</Button>
      ) : (
        <p className="mt-8 text-muted-foreground">On attend que {failedName} fasse son gage... 🥹</p>
      )}
    </div>
  );
}

// ───────────────────────────────────────────── SECRETS ─────

type DraftQuestion = { text: string; correct: string; w1: string; w2: string; w3: string };
type DraftDare = { text: string; level: DareLevel };

function emptyQ(): DraftQuestion { return { text: "", correct: "", w1: "", w2: "", w3: "" }; }

function Secrets({ room, players, customQuestions, customDares, mySlot, otherSlot, onDone }: Ctx & { onDone: () => void }) {
  const myName = players.find((p) => p.slot === mySlot)?.name ?? "Toi";
  const otherName = players.find((p) => p.slot === otherSlot)?.name ?? "ton amour";
  const isEdit = room.mode === "edit_secrets";

  const myExistingQ = customQuestions.filter((q) => q.author_slot === mySlot);
  const myExistingD = customDares.filter((d) => d.author_slot === mySlot);
  const otherCountQ = customQuestions.filter((q) => q.author_slot === otherSlot).length;
  const otherCountD = customDares.filter((d) => d.author_slot === otherSlot).length;

  const secretsReady = (room.secrets_ready ?? []) as number[];
  const iAmReady = secretsReady.includes(mySlot);
  const otherReady = secretsReady.includes(otherSlot);
  const bothReady = iAmReady && otherReady;

  const [questions, setQuestions] = useState<DraftQuestion[]>(() => Array.from({ length: NB_QUESTIONS_PERSO_MIN }, emptyQ));
  const [dares, setDares] = useState<DraftDare[]>(() => Array.from({ length: NB_GAGES_PERSO_MIN }, () => ({ text: "", level: "simple" as DareLevel })));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) return; // standalone editing doesn't auto-advance
    if (!bothReady || room.phase !== "secrets") return;
    supabase.from("rooms").update({ phase: "phase1" }).eq("id", room.id).eq("phase", "secrets").then(() => undefined);
  }, [bothReady, room.id, room.phase, isEdit]);

  if (iAmReady && !isEdit) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div animate={{ rotate: [0, 6, -6, 0] }} transition={{ repeat: Infinity, duration: 2.5 }} className="text-7xl">🙈</motion.div>
        <h2 className="mt-6 font-script text-4xl text-primary">Tes pièges sont prêts !</h2>
        <p className="mt-2 text-muted-foreground">{otherReady ? "C'est parti..." : `On attend que ${otherName} finisse ses pièges...`}</p>
        <p className="mt-3 text-xs text-muted-foreground">{otherName} : {otherCountQ} question(s) · {otherCountD} gage(s)</p>
      </div>
    );
  }

  const validQuestions = questions.filter((q) => q.text.trim() && q.correct.trim() && q.w1.trim() && q.w2.trim() && q.w3.trim());
  const validDares = dares.filter((d) => d.text.trim());
  const canSubmit = isEdit
    ? validQuestions.length + validDares.length > 0
    : validQuestions.length >= NB_QUESTIONS_PERSO_MIN && validDares.length >= NB_GAGES_PERSO_MIN;

  const submitAll = async () => {
    setSaving(true);
    if (myExistingQ.length || myExistingD.length) {
      await Promise.all([
        supabase.from("custom_questions").delete().eq("room_id", room.id).eq("author_slot", mySlot),
        supabase.from("custom_dares").delete().eq("room_id", room.id).eq("author_slot", mySlot),
      ]);
    }
    if (validQuestions.length) {
      await supabase.from("custom_questions").insert(validQuestions.map((q) => ({
        room_id: room.id, author_slot: mySlot, text: q.text.trim(),
        correct_answer: q.correct.trim(), wrongs: [q.w1.trim(), q.w2.trim(), q.w3.trim()],
      })));
    }
    if (validDares.length) {
      await supabase.from("custom_dares").insert(validDares.map((d) => ({
        room_id: room.id, author_slot: mySlot, text: d.text.trim(), level: d.level,
      })));
    }
    if (isEdit) {
      setSaving(false);
      toast.success("Pièges enregistrés 🙈");
      onDone();
      return;
    }
    const nextReady = Array.from(new Set([...secretsReady, mySlot]));
    await supabase.from("rooms").update({ secrets_ready: nextReady }).eq("id", room.id);
    setSaving(false);
  };


  const updateQ = (i: number, patch: Partial<DraftQuestion>) => setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const updateD = (i: number, patch: Partial<DraftDare>) => setDares((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  return (
    <div className="flex flex-1 flex-col pb-8">
      <p className="text-center text-xs uppercase tracking-wider text-muted-foreground">Étape secrète · {myName}</p>
      <h2 className="mt-1 text-center font-script text-4xl text-primary">{SECRETS_TITRE}</h2>
      <p className="mt-1 text-center text-sm text-muted-foreground">{SECRETS_SOUS_TITRE}</p>

      <div className="mt-6 rounded-2xl bg-card/80 p-4 backdrop-blur">
        <p className="text-sm font-semibold">💌 Tes questions pour {otherName}</p>
        <p className="mt-1 text-xs text-muted-foreground">Écris {NB_QUESTIONS_PERSO_MIN} à {NB_QUESTIONS_PERSO_MAX} questions avec la bonne réponse et 3 mauvaises.</p>
        <div className="mt-4 space-y-5">
          {questions.map((q, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border/60 p-3">
              <p className="text-xs font-medium text-muted-foreground">Question {i + 1}</p>
              <Input placeholder="La question..." value={q.text} onChange={(e) => updateQ(i, { text: e.target.value })} maxLength={120} />
              <Input placeholder="✅ La bonne réponse" value={q.correct} onChange={(e) => updateQ(i, { correct: e.target.value })} maxLength={60} className="border-primary/40" />
              <div className="grid grid-cols-1 gap-2">
                <Input placeholder="❌ Mauvaise réponse 1" value={q.w1} onChange={(e) => updateQ(i, { w1: e.target.value })} maxLength={60} />
                <Input placeholder="❌ Mauvaise réponse 2" value={q.w2} onChange={(e) => updateQ(i, { w2: e.target.value })} maxLength={60} />
                <Input placeholder="❌ Mauvaise réponse 3" value={q.w3} onChange={(e) => updateQ(i, { w3: e.target.value })} maxLength={60} />
              </div>
              {questions.length > NB_QUESTIONS_PERSO_MIN && (
                <button type="button" onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs text-muted-foreground underline">Retirer cette question</button>
              )}
            </div>
          ))}
        </div>
        {questions.length < NB_QUESTIONS_PERSO_MAX && (
          <Button variant="secondary" className="mt-3 w-full" onClick={() => setQuestions((prev) => [...prev, emptyQ()])}>+ Ajouter une question</Button>
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-card/80 p-4 backdrop-blur">
        <p className="text-sm font-semibold">💕 Tes gages perso pour {otherName}</p>
        <p className="mt-1 text-xs text-muted-foreground">{NB_GAGES_PERSO_MIN} à {NB_GAGES_PERSO_MAX} gages. Choisis le niveau de chaque gage.</p>
        <div className="mt-3 space-y-3">
          {dares.map((d, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-border/60 p-3">
              <Input placeholder={`Gage ${i + 1}...`} value={d.text} onChange={(e) => updateD(i, { text: e.target.value })} maxLength={140} />
              <div className="flex gap-2">
                {(["simple", "medium", "ultra"] as DareLevel[]).map((lv) => (
                  <button key={lv} type="button" onClick={() => updateD(i, { level: lv })}
                    className={`flex-1 rounded-full px-2 py-1 text-xs font-medium transition ${d.level === lv ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}>
                    {LEVEL_LABELS[lv]}
                  </button>
                ))}
              </div>
              {dares.length > NB_GAGES_PERSO_MIN && (
                <button type="button" onClick={() => setDares((prev) => prev.filter((_, idx) => idx !== i))} className="text-xs text-muted-foreground underline">Retirer</button>
              )}
            </div>
          ))}
        </div>
        {dares.length < NB_GAGES_PERSO_MAX && (
          <Button variant="secondary" className="mt-3 w-full" onClick={() => setDares((prev) => [...prev, { text: "", level: "simple" as DareLevel }])}>+ Ajouter un gage</Button>
        )}
      </div>

      <Button onClick={submitAll} disabled={!canSubmit || saving} className="mt-6 h-14 w-full rounded-2xl text-base font-semibold">
        {saving ? "..." : isEdit ? "Sauvegarder & retour menu 💾" : "C'est prêt 🙈"}
      </Button>
      {!canSubmit && !isEdit && (
        <p className="mt-2 text-center text-xs text-muted-foreground">Remplis au moins {NB_QUESTIONS_PERSO_MIN} questions complètes et {NB_GAGES_PERSO_MIN} gage.</p>
      )}
      {!isEdit && (
        <p className="mt-3 text-center text-xs text-muted-foreground">{otherName} : {otherReady ? "a fini 💕" : "prépare ses pièges..."}</p>
      )}
    </div>
  );
}


// ───────────────────────────────────────────── FINAL ─────

function Final({ room, players, mySlot, onMenu }: Ctx & { onMenu: () => void }) {
  const me = players.find((p) => p.slot === mySlot);
  const other = players.find((p) => p.slot !== mySlot);
  const myScore = mySlot === 1 ? room.score_1 : room.score_2;
  const otherScore = mySlot === 1 ? room.score_2 : room.score_1;
  const finaleScores = room.finale_scores ?? { "1": 0, "2": 0 };
  const myFinale = finaleScores[String(mySlot) as "1" | "2"] ?? 0;
  const otherFinale = finaleScores[String(mySlot === 1 ? 2 : 1) as "1" | "2"] ?? 0;
  const complicity = room.complicity ?? 0;
  const surpriseUnlocked = complicity >= COMPLICITY_MAX;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      confetti({ particleCount: 120, spread: 100, origin: { y: 0.5 }, colors: ["#f4a4ae", "#a8c8a8", "#fde2e4", "#ffd1dc"] });
    }, 300);
    return () => clearTimeout(id);
  }, []);

  const champion = myFinale > otherFinale ? me?.name : otherFinale > myFinale ? other?.name : null;

  const verdict = champion
    ? `🏆 Champion du couple : ${champion}`
    : "🤝 Égalité parfaite, vous êtes pile assortis !";

  const replay = async () => {
    if (mySlot !== 1) return;
    if (!room) return;
    await Promise.all([
      supabase.from("answers").delete().eq("room_id", room.id),
      supabase.from("guesses").delete().eq("room_id", room.id),
      supabase.from("custom_questions").delete().eq("room_id", room.id),
      supabase.from("custom_dares").delete().eq("room_id", room.id),
    ]);
    await supabase.from("rooms").update({
      phase: "menu", mode: null, stage: "round1", current_turn: 0, current_player: 1, current_dare: null, current_dare_for: null,
      score_1: 0, score_2: 0, complicity: 0, turn_order: [], turn_plan: [], secrets_ready: [],
      minigame_id: null, minigame_state: {}, minigame_round: 0, finale_scores: { "1": 0, "2": 0 },
    }).eq("id", room.id);
  };


  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">C'est fini !</p>
        <h2 className="mt-2 font-script text-4xl text-primary">{verdict}</h2>

        <div className="mt-6 grid w-full grid-cols-2 gap-3">
          <ScoreCard name={me?.name ?? "Toi"} qcm={myScore} finale={myFinale} />
          <ScoreCard name={other?.name ?? "..."} qcm={otherScore} finale={otherFinale} />
        </div>

        <div className="mt-8 w-full rounded-2xl bg-card/80 p-4 text-left backdrop-blur">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">💞 Jauge de complicité</p>
          <p className="mt-1 font-script text-3xl text-primary">{Math.round((complicity / COMPLICITY_MAX) * 100)}%</p>
          {surpriseUnlocked ? (
            <>
              {!revealed ? (
                <Button onClick={() => { setRevealed(true); confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 } }); }}
                  className="mt-3 h-12 w-full rounded-2xl text-sm font-semibold">
                  Découvrir la surprise 💌
                </Button>
              ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-3 whitespace-pre-line rounded-xl border-2 border-primary/40 bg-primary/5 p-4 font-script text-lg leading-relaxed text-primary">
                  <p className="mb-2 text-center text-sm font-semibold uppercase tracking-wider">{SURPRISE_TITRE}</p>
                  {SURPRISE_FINALE}
                </motion.div>
              )}
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">À 100%, une petite surprise vous attend la prochaine fois 💕</p>
          )}
        </div>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
          className="mt-8 font-script text-2xl leading-tight text-primary">
          Peu importe le score,<br />je t'aime {other?.name ?? "mon amour"} ❤️
        </motion.p>
      </div>

      <div className="space-y-3 pt-6">
        {mySlot === 1 ? (
          <Button onClick={replay} className="h-14 w-full rounded-2xl text-base font-semibold">Rejouer 🔁</Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">{me?.name} peut relancer une partie 💕</p>
        )}
        <Button variant="secondary" onClick={() => (window.location.href = "/")} className="h-12 w-full rounded-2xl">Nouvelle partie</Button>
      </div>
    </div>
  );
}

function ScoreCard({ name, qcm, finale }: { name: string; qcm: number; finale: number }) {
  return (
    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200 }}
      className="rounded-2xl bg-card/80 p-3 text-center shadow-md backdrop-blur">
      <Heart className="mx-auto h-5 w-5 fill-primary text-primary" />
      <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{name}</p>
      <p className="font-script text-3xl text-primary">{qcm + finale}</p>
      <p className="text-[10px] text-muted-foreground">QCM {qcm} · Finale {finale}</p>
    </motion.div>
  );
}
