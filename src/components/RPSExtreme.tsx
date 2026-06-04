import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

// ─────────── GAGES (modifiables ici, par niveau) ───────────
export const GAGES_RPS = {
  easy: [
    "Fais un bisou sur la joue de l'autre",
    "Dis 3 choses que tu adores chez l'autre",
    "Fais ton plus beau compliment, là, maintenant",
    "Fais un cœur avec tes mains et garde-le 10 secondes",
    "Imite l'autre pendant 10 secondes",
    "Raconte ton souvenir préféré de vous deux",
    "Fais un câlin de 20 secondes",
  ],
  medium: [
    "Chante le refrain de votre chanson",
    "Envoie/dis un message vocal trop mignon",
    "Improvise une déclaration d'amour de 20 secondes",
    "Masse les épaules de l'autre pendant 1 minute",
    "Écris un petit poème pour l'autre en 1 minute",
    "Fais une imitation qui fait rire l'autre",
    "Danse 30 secondes (sans musique, encore mieux)",
  ],
  hard: [
    "Organise entièrement votre prochain rendez-vous",
    "Écris une lettre d'amour à lire plus tard",
    "Petit-déjeuner au lit garanti la prochaine fois",
    "Réalise un vœu (raisonnable) de l'autre",
    "Prépare une petite surprise pour cette semaine",
    "Fais une déclaration filmée de 30 secondes",
  ],
} as const;

type Level = "easy" | "medium" | "hard";
type Choice = "rock" | "paper" | "scissors";

const LEVEL_INFO: Record<Level, { label: string; emoji: string; color: string }> = {
  easy: { label: "Facile", emoji: "🟢", color: "from-emerald-200 to-lime-200" },
  medium: { label: "Moyen", emoji: "🟡", color: "from-amber-200 to-yellow-200" },
  hard: { label: "Difficile", emoji: "🔴", color: "from-rose-200 to-pink-300" },
};

const CHOICES: { id: Choice; label: string; emoji: string }[] = [
  { id: "rock", label: "Pierre", emoji: "✊" },
  { id: "paper", label: "Feuille", emoji: "✋" },
  { id: "scissors", label: "Ciseaux", emoji: "✌️" },
];

function rpsWinner(c1: Choice, c2: Choice): 0 | 1 | 2 {
  if (c1 === c2) return 0;
  if (
    (c1 === "rock" && c2 === "scissors") ||
    (c1 === "paper" && c2 === "rock") ||
    (c1 === "scissors" && c2 === "paper")
  )
    return 1;
  return 2;
}

type State = {
  phase?: "level_select" | "play" | "reveal" | "wheel" | "dare" | "done";
  level_1?: Level | null;
  level_2?: Level | null;
  level?: Level | null;
  choice_1?: Choice | null;
  choice_2?: Choice | null;
  sent_1?: boolean;
  sent_2?: boolean;
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
  onDareDone: () => void; // pour la jauge de complicité
};

const patch = (roomId: string, p: State) =>
  supabase.rpc("minigame_patch", { _room_id: roomId, _patch: p });

export function RPSExtreme({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const s = (room.minigame_state ?? {}) as State;
  const phase = s.phase ?? "level_select";
  const otherSlot = mySlot === 1 ? 2 : 1;

  // Init quand l'état est vide — un seul joueur (le slot 1) prend l'init
  useEffect(() => {
    if (Object.keys(s).length === 0 && mySlot === 1) {
      void patch(room.id, { phase: "level_select" });
    }
  }, [room.id, s, mySlot]);

  if (phase === "level_select") {
    return <LevelSelect state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  }
  if (phase === "play" || phase === "reveal") {
    return (
      <PlayRound
        state={s}
        room={room}
        mySlot={mySlot}
        myName={myName}
        otherName={otherName}
        otherSlot={otherSlot}
      />
    );
  }
  if (phase === "wheel") {
    return <WheelView state={s} room={room} mySlot={mySlot} myName={myName} otherName={otherName} />;
  }
  if (phase === "dare") {
    return (
      <DareView
        state={s}
        room={room}
        mySlot={mySlot}
        myName={myName}
        otherName={otherName}
        onDareDone={onDareDone}
      />
    );
  }
  // done
  return (
    <DoneView
      state={s}
      room={room}
      mySlot={mySlot}
      onReplay={async () => {
        await patch(room.id, {
          phase: "level_select",
          level_1: null, level_2: null, level: null,
          choice_1: null, choice_2: null, sent_1: false, sent_2: false,
          winner_slot: null, wheel_index: null, dare_text: null,
        });
      }}
      onBackToMenu={onBackToMenu}
    />
  );
}

// ─────────── ÉTAPE 1 : choix du niveau ───────────
function LevelSelect({
  state, room, mySlot, myName, otherName,
}: { state: State; room: Room; mySlot: number; myName: string; otherName: string }) {
  const mine = mySlot === 1 ? state.level_1 : state.level_2;
  const theirs = mySlot === 1 ? state.level_2 : state.level_1;
  const both = state.level_1 && state.level_2;
  const match = both && state.level_1 === state.level_2;

  const choose = async (l: Level) => {
    const p: State = mySlot === 1 ? { level_1: l } : { level_2: l };
    await patch(room.id, p);
  };

  const start = async () => {
    if (!match) return;
    await patch(room.id, {
      phase: "play",
      level: state.level_1 ?? null,
      choice_1: null, choice_2: null, sent_1: false, sent_2: false,
      winner_slot: null, wheel_index: null, dare_text: null,
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Pierre-Papier-Ciseaux Extrême</p>
        <h1 className="mt-1 font-script text-4xl text-primary">✊ ✋ ✌️</h1>
        <p className="mt-1 text-xs text-muted-foreground">Le perdant fait un gage 😈</p>
      </div>

      <p className="mt-5 text-center text-sm font-medium">Choisissez ENSEMBLE le niveau du gage :</p>

      <div className="mt-4 grid gap-3">
        {(Object.keys(LEVEL_INFO) as Level[]).map((l) => {
          const info = LEVEL_INFO[l];
          const iPicked = mine === l;
          const theyPicked = theirs === l;
          return (
            <motion.button
              key={l}
              whileTap={{ scale: 0.97 }}
              onClick={() => choose(l)}
              className={`relative flex items-center gap-4 rounded-3xl border-2 p-4 text-left shadow-md bg-gradient-to-br ${info.color} ${
                iPicked ? "border-primary ring-2 ring-primary/40" : "border-white/60"
              }`}
            >
              <span className="text-4xl">{info.emoji}</span>
              <div className="flex-1">
                <p className="font-script text-2xl text-foreground/90">{info.label}</p>
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
          <span className="font-semibold">{myName}</span> :{" "}
          {mine ? LEVEL_INFO[mine].label : "—"}{" "}
          · <span className="font-semibold">{otherName}</span> :{" "}
          {theirs ? LEVEL_INFO[theirs].label : "—"}
        </p>
        {both && !match && (
          <p className="mt-2 text-muted-foreground">Mettez-vous d'accord sur le même niveau 😅</p>
        )}
      </div>

      <div className="mt-auto pt-6">
        <Button
          disabled={!match}
          onClick={start}
          className="h-14 w-full rounded-2xl text-base font-semibold"
        >
          {match ? "C'est parti ! 🎮" : "En attente du niveau commun…"}
        </Button>
      </div>
    </div>
  );
}

// ─────────── ÉTAPE 2/3 : manche + révélation ───────────
function PlayRound({
  state, room, mySlot, myName, otherName, otherSlot,
}: { state: State; room: Room; mySlot: number; myName: string; otherName: string; otherSlot: number }) {
  const myChoice = (mySlot === 1 ? state.choice_1 : state.choice_2) ?? null;
  const otherChoice = (mySlot === 1 ? state.choice_2 : state.choice_1) ?? null;
  const mySent = mySlot === 1 ? !!state.sent_1 : !!state.sent_2;
  const otherSent = mySlot === 1 ? !!state.sent_2 : !!state.sent_1;
  const bothSent = !!state.sent_1 && !!state.sent_2;
  const phase = state.phase;

  const [picking, setPicking] = useState<Choice | null>(myChoice);
  useEffect(() => { setPicking(myChoice); }, [myChoice]);

  const pick = async (c: Choice) => {
    if (mySent) return;
    setPicking(c);
    const p: State = mySlot === 1 ? { choice_1: c } : { choice_2: c };
    await patch(room.id, p);
  };

  const send = async () => {
    if (mySent || !picking) return;
    const p: State = mySlot === 1
      ? { choice_1: picking, sent_1: true }
      : { choice_2: picking, sent_2: true };
    await patch(room.id, p);
  };

  // Quand les deux sont envoyés et qu'on est encore en "play", passer en "reveal".
  // Les deux joueurs peuvent piloter : la fonction SQL `minigame_patch` fusionne,
  // donc deux écritures identiques ne se gênent pas.
  useEffect(() => {
    if (!bothSent) return;
    if (phase !== "play") return;
    void patch(room.id, { phase: "reveal" });
  }, [bothSent, phase, room.id]);

  // Reveal → résolution (les deux joueurs pilotent : opérations idempotentes)
  useEffect(() => {
    if (phase !== "reveal") return;
    const c1 = state.choice_1 as Choice | null;
    const c2 = state.choice_2 as Choice | null;
    if (!c1 || !c2) return;
    const w = rpsWinner(c1, c2);
    const t = setTimeout(() => {
      if (w === 0) {
        // Égalité → on relance la manche
        void patch(room.id, {
          phase: "play",
          choice_1: null, choice_2: null, sent_1: false, sent_2: false,
        });
      } else {
        void patch(room.id, { phase: "wheel", winner_slot: w });
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [phase, room.id, state.choice_1, state.choice_2]);


  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Pierre-Papier-Ciseaux ✊✋✌️</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Niveau : <span className="font-semibold">{state.level ? LEVEL_INFO[state.level].label : "—"}</span>
        </p>
      </div>

      {/* Zone des deux choix */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card/80 p-4 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{myName} (toi)</p>
          <div className="mt-2 text-5xl">
            {phase === "reveal" && myChoice ? CHOICES.find((x) => x.id === myChoice)!.emoji
              : mySent ? "🔒"
              : picking ? CHOICES.find((x) => x.id === picking)!.emoji
              : "❔"}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {mySent ? "Envoyé ✓" : picking ? "Prêt à envoyer" : "Choisis…"}
          </p>
        </div>
        <div className="rounded-2xl bg-card/80 p-4 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{otherName}</p>
          <div className="mt-2 text-5xl">
            {phase === "reveal" && otherChoice ? CHOICES.find((x) => x.id === otherChoice)!.emoji
              : otherSent ? "🔒"
              : "💭"}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {otherSent ? "Envoyé ✓" : `${otherName} réfléchit…`}
          </p>
        </div>
      </div>

      {/* Résultat de la révélation */}
      {phase === "reveal" && state.choice_1 && state.choice_2 && (() => {
        const w = rpsWinner(state.choice_1 as Choice, state.choice_2 as Choice);
        return (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl bg-primary/10 p-4 text-center"
          >
            <p className="font-script text-3xl text-primary">
              {w === 0 ? "Égalité ! On rejoue ✊" : (w === mySlot ? "Tu gagnes 🏆" : `${otherName} gagne !`)}
            </p>
          </motion.div>
        );
      })()}

      {/* Boutons de choix */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        {CHOICES.map((c) => (
          <motion.button
            key={c.id}
            whileTap={{ scale: 0.94 }}
            disabled={mySent || phase === "reveal"}
            onClick={() => pick(c.id)}
            className={`flex flex-col items-center rounded-2xl border-2 p-4 transition ${
              picking === c.id ? "border-primary bg-primary/15" : "border-border bg-card/80"
            } disabled:opacity-50`}
          >
            <span className="text-4xl">{c.emoji}</span>
            <span className="mt-2 text-xs font-medium">{c.label}</span>
          </motion.button>
        ))}
      </div>

      <div className="mt-auto pt-5">
        <Button
          onClick={send}
          disabled={!picking || mySent || phase === "reveal"}
          className="h-14 w-full rounded-2xl text-base font-semibold"
        >
          {mySent ? (otherSent ? "Révélation…" : `En attente de ${otherName}…`) : "ENVOYER 🚀"}
        </Button>
      </div>
    </div>
  );
}

// ─────────── ÉTAPE 4 : la roue ───────────
function WheelView({
  state, room, mySlot, myName, otherName,
}: { state: State; room: Room; mySlot: number; myName: string; otherName: string }) {
  const level = (state.level ?? "easy") as Level;
  const gages = useMemo(() => [...GAGES_RPS[level]], [level]);
  const winner = state.winner_slot ?? 0;
  const iWon = winner === mySlot;
  const wheelIndex = state.wheel_index;
  const [spinning, setSpinning] = useState(false);
  const triggeredRef = useRef(false);

  // Le gagnant tire l'index et l'écrit ; les deux animent vers le même index
  const spin = async () => {
    if (!iWon || wheelIndex !== null && wheelIndex !== undefined) return;
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    const idx = Math.floor(Math.random() * gages.length);
    setSpinning(true);
    await patch(room.id, { wheel_index: idx, dare_text: gages[idx] });
  };

  // Quand wheel_index est défini, on lance l'animation puis on passe à "dare"
  useEffect(() => {
    if (wheelIndex === null || wheelIndex === undefined) return;
    setSpinning(true);
    const t = setTimeout(() => {
      setSpinning(false);
      if (mySlot === 1) {
        void patch(room.id, { phase: "dare" });
      }
    }, 3200);
    return () => clearTimeout(t);
  }, [wheelIndex, mySlot, room.id]);

  // Animation : décalage angulaire qui s'arrête sur l'index choisi
  const seg = 360 / gages.length;
  const finalRotation = wheelIndex !== null && wheelIndex !== undefined
    ? 360 * 5 + (360 - (wheelIndex * seg + seg / 2))
    : 0;

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">La roue des gages 🎡</p>
        <p className="mt-1 text-sm">
          {iWon ? "Tu as gagné ! Fais tourner la roue 🌟" : `${otherName} tourne la roue…`}
        </p>
      </div>

      <div className="relative mx-auto mt-6 aspect-square w-72 max-w-full">
        {/* Pointeur */}
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1 text-3xl">▼</div>
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-primary/40 shadow-xl"
          style={{
            background: `conic-gradient(${gages.map((_, i) => {
              const colors = ["#fecdd3", "#fde68a", "#bbf7d0", "#bae6fd", "#ddd6fe", "#fbcfe8", "#fed7aa"];
              const c = colors[i % colors.length];
              return `${c} ${(i / gages.length) * 360}deg ${((i + 1) / gages.length) * 360}deg`;
            }).join(",")})`,
          }}
          animate={{ rotate: finalRotation }}
          transition={{ duration: 3, ease: [0.17, 0.67, 0.21, 0.99] }}
        >
          {gages.map((g, i) => {
            const angle = i * seg + seg / 2;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 origin-left text-[10px] font-semibold text-foreground/80"
                style={{
                  transform: `rotate(${angle}deg) translateX(20px)`,
                  width: "45%",
                }}
              >
                <span className="block truncate pr-2">{g.slice(0, 22)}…</span>
              </div>
            );
          })}
        </motion.div>
        <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-primary shadow-md" />
      </div>

      <div className="mt-auto pt-6">
        {iWon && wheelIndex === undefined ? (
          <Button onClick={spin} disabled={spinning} className="h-14 w-full rounded-2xl text-base font-semibold">
            {spinning ? "Ça tourne…" : "Tourner la roue 🎡"}
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            {wheelIndex !== null && wheelIndex !== undefined ? "Roulement de tambour… 🥁" : `En attente de ${iWon ? "toi" : otherName}…`}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────── ÉTAPE 5 : faire le gage ───────────
function DareView({
  state, room, mySlot, myName, otherName, onDareDone,
}: { state: State; room: Room; mySlot: number; myName: string; otherName: string; onDareDone: () => void }) {
  const winner = state.winner_slot ?? 0;
  const loser = winner === 1 ? 2 : 1;
  const iLost = mySlot === loser;
  const dare = state.dare_text ?? "…";
  const level = (state.level ?? "easy") as Level;

  const validate = async () => {
    onDareDone();
    await patch(room.id, { phase: "done" });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="text-6xl">
        🎁
      </motion.div>
      <div className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        {LEVEL_INFO[level].emoji} {LEVEL_INFO[level].label}
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

// ─────────── ÉTAPE 6 : fin de manche ───────────
function DoneView({
  state, room, mySlot, onReplay, onBackToMenu,
}: { state: State; room: Room; mySlot: number; onReplay: () => void; onBackToMenu: () => void }) {
  const winner = state.winner_slot ?? 0;
  const iWon = winner === mySlot;

  useEffect(() => {
    if (iWon) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }
  }, [iWon]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} className="text-8xl">
        {iWon ? "🏆" : "💖"}
      </motion.div>
      <h2 className="mt-6 font-script text-4xl text-primary">
        {iWon ? "Bravo champion·ne !" : "Bravo pour le gage 😘"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">Vous montez en complicité 💞</p>

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
