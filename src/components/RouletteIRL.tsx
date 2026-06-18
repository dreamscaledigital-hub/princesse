import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, X, Trophy, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = {
  id: string;
  emoji: string;
  label: string;
  subtitle: string;
  color: string;
  bg: string;
  challenges: string[];
  timerSeconds: number;
};

type Phase = "idle" | "spinning" | "reveal" | "challenge" | "result";

type SyncState = {
  phase: Phase;
  turn: 1 | 2;
  rotation: number;
  catId: string | null;
  challenge: string;
  scores: [number, number];
  success: boolean | null;
  timerStartedAt: number | null;
  nonce: number;
};

// ── Challenge data ─────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  {
    id: "provocation",
    emoji: "🔥",
    label: "Provocation",
    subtitle: "Tu tentes… l'autre résiste",
    color: "#ef4444",
    bg: "from-red-500 to-orange-500",
    timerSeconds: 60,
    challenges: [
      "Caresse lentement tout le corps de ton/ta partenaire pendant 1 minute — il/elle ne doit pas réagir ni bouger.",
      "Embrasse le cou, l'oreille et la nuque très lentement pendant 60 secondes. Zéro réaction autorisée.",
      "Fais une fellation à ton/ta partenaire — l'autre ne peut pas bouger ni gémir, 1 minute.",
      "Lèche et suce les tétons de ton/ta partenaire pendant 1 minute — il/elle ne réagit pas.",
      "Frotte ton sexe contre celui de ton/ta partenaire (par-dessus ou en dessous) — il/elle ne bronche pas, 1 minute.",
      "Effleure les lèvres avec les tiennes sans jamais vraiment embrasser — 1 minute.",
      "Fais une trace de bisous de la bouche jusqu'au bas-ventre — l'autre ne peut pas réagir.",
      "Regarde ton/ta partenaire droit dans les yeux et fais ce que tu veux — il/elle ne réagit pas, 1 minute.",
      "Caresse le sexe de ton/ta partenaire par-dessus les vêtements jusqu'à ce qu'il/elle craque — 1 minute max.",
      "Masse ton/ta partenaire avec beaucoup de frottements sur les zones érogènes — jusqu'à ce qu'il/elle craque.",
      "Une fellation / un cunnilingus très lent et appuyé — l'autre ne peut ni gémir ni bouger les hanches, 1 minute.",
      "Branle ton/ta partenaire lentement et fermement — il/elle doit rester totalement immobile, 1 minute.",
    ],
  },
  {
    id: "aveugle",
    emoji: "👁️",
    label: "À l'aveugle",
    subtitle: "Les yeux bandés, le reste suit",
    color: "#7c3aed",
    bg: "from-violet-600 to-purple-700",
    timerSeconds: 120,
    challenges: [
      "Bande les yeux à ton/ta partenaire — embrasse-le/la partout sauf les lèvres pendant 2 minutes.",
      "Les yeux bandés : guide doucement les mains de ton/ta partenaire sur ton corps pendant 2 minutes.",
      "Fellation / cunnilingus les yeux bandés — l'autre devine seulement à la sensation, 2 minutes.",
      "Pénétration les yeux bandés dans la position de ton choix — 2 minutes au rythme que tu décides.",
      "Bande les yeux à ton/ta partenaire — il/elle doit deviner chaque endroit que tu embrasses ou lèches.",
      "Les yeux bandés, les mains liées (foulard) : 2 minutes de plaisir total sans aucun moyen de fuir.",
      "Bande les yeux et utilise uniquement ta langue sur la peau, le sexe inclus — trace des formes, 2 minutes.",
      "Les yeux fermés, ton/ta partenaire reçoit 2 minutes de plaisir oral là où tu décides.",
      "Bande les yeux et masturbe-le/la lentement — change de rythme sans prévenir, 2 minutes.",
      "Les yeux bandés : alterne sexe, main et bouche sans prévenir — 2 minutes de surprises.",
      "Pénétration les yeux bandés, mains tenues au-dessus de la tête — 2 minutes.",
      "Yeux bandés, tu décides quand et comment il/elle jouit — 2 minutes pour amener au bord.",
    ],
  },
  {
    id: "position",
    emoji: "💫",
    label: "Position Insolite",
    subtitle: "Créativité et complicité",
    color: "#d97706",
    bg: "from-amber-500 to-yellow-500",
    timerSeconds: 120,
    challenges: [
      "Position debout, ton/ta partenaire dos au mur — pénétration ou frottement, 2 minutes.",
      "Levrette : ton/ta partenaire penché(e) en avant, toi derrière — pénétration tenue 2 minutes.",
      "Assis(e) face à face, jambes entremêlées — pénétration lente, yeux dans les yeux, 2 minutes.",
      "Cuillère serrée sur le côté — pénétration par derrière, 2 minutes de chaleur.",
      "Ton/ta partenaire sur le bord du lit, toi debout face — pénétration profonde, 2 minutes.",
      "Position de l'andromaque : il/elle te chevauche, tu lui tiens les hanches — 2 minutes.",
      "Debout, tu portes ton/ta partenaire contre toi (jambes autour de la taille) — pénétration debout, 1 minute.",
      "Ton/ta partenaire allongé(e) sur le dos, jambes en l'air sur tes épaules — pénétration profonde, 2 minutes.",
      "À 4 pattes, toi qui pénètres par derrière, une main qui tire les cheveux — 2 minutes.",
      "69 — fellation et cunnilingus simultanés pendant 2 minutes sans s'arrêter.",
      "Position de l'amazone : ton/ta partenaire à califourchon dos à toi — 2 minutes.",
      "Allongé(e) sur le ventre, toi par-dessus — pénétration profonde et lente, 2 minutes.",
    ],
  },
  {
    id: "defi",
    emoji: "⏱️",
    label: "Le Défi",
    subtitle: "30 secondes pour réussir",
    color: "#059669",
    bg: "from-emerald-500 to-teal-600",
    timerSeconds: 30,
    challenges: [
      "30 secondes pour faire jouir ton/ta partenaire uniquement avec ta bouche — commence !",
      "30 secondes pour faire mouiller / faire bander ton/ta partenaire avec tes seuls doigts.",
      "30 secondes pour amener ton/ta partenaire au bord de l'orgasme — sans le/la laisser jouir.",
      "30 secondes pour que ton/ta partenaire te supplie de continuer.",
      "30 secondes pour le/la faire gémir fort — méthode libre.",
      "30 secondes de fellation / cunnilingus intense — donne tout.",
      "30 secondes pour faire un suçon visible quelque part — où tu veux.",
      "30 secondes : pénétration la plus profonde et la plus rapide possible.",
      "30 secondes pour faire dire à ton/ta partenaire un mot cochon de ton choix.",
      "30 secondes pour le/la déshabiller entièrement avec les dents si possible.",
      "30 secondes pour lui/la faire perdre toute contenance — méthode libre.",
      "30 secondes de branlette / masturbation avec changement de rythme — fais craquer.",
    ],
  },
  {
    id: "soumission",
    emoji: "🎀",
    label: "Tu Subis",
    subtitle: "L'un donne, l'autre reçoit",
    color: "#db2777",
    bg: "from-pink-500 to-rose-600",
    timerSeconds: 120,
    challenges: [
      "Allonge-toi et reçois — ton/ta partenaire te lèche et te suce où il/elle veut pendant 2 minutes. Tu ne bouges pas.",
      "Mains tenues au-dessus de la tête — tu reçois 2 minutes de fellation / cunnilingus sans pouvoir bouger.",
      "Les yeux fermés, tu subis 2 minutes de baisers + caresses du sexe là où ton/ta partenaire décide.",
      "Tu t'allonges, ton/ta partenaire prend le contrôle complet — il/elle te chevauche / te pénètre comme il/elle veut, 2 minutes.",
      "Tu reçois 2 minutes de masturbation lente — sans pouvoir rendre ni bouger les mains.",
      "Ton/ta partenaire trace un chemin de baisers du cou jusqu'au sexe — tu subis en silence, 2 minutes.",
      "Tu te laisses entièrement guider : ton/ta partenaire décide de tout (position, rythme, ce qu'il/elle te fait) pendant 2 minutes.",
      "Les mains immobiles de chaque côté — ton/ta partenaire explore librement bouche, sexe et corps pendant 2 minutes.",
      "Tu fermes les yeux et tu reçois fellation / cunnilingus pendant 2 minutes — interdit de bouger les hanches.",
      "Tu subis 2 minutes de taquineries au bord de l'orgasme — ton/ta partenaire arrête uniquement quand il/elle veut.",
      "À 4 pattes, tu subis la pénétration au rythme que ton/ta partenaire décide — 2 minutes sans bouger.",
      "Attaché(e) symboliquement (foulard, ceinture) — tu reçois 2 minutes de tout ce que ton/ta partenaire veut.",
    ],
  },
];

const CAT_BY_ID: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// ── SVG Wheel ─────────────────────────────────────────────────────────────────

const N = CATEGORIES.length;
const SEG = 360 / N;
const CX = 150;
const CY = 150;
const R = 138;

function segPath(i: number): string {
  const s = ((i * SEG - 90) * Math.PI) / 180;
  const e = (((i + 1) * SEG - 90) * Math.PI) / 180;
  const x1 = CX + R * Math.cos(s);
  const y1 = CY + R * Math.sin(s);
  const x2 = CX + R * Math.cos(e);
  const y2 = CY + R * Math.sin(e);
  return `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

function emojiPos(i: number) {
  const mid = (((i + 0.5) * SEG - 90) * Math.PI) / 180;
  const d = R * 0.63;
  return { x: CX + d * Math.cos(mid), y: CY + d * Math.sin(mid), rotate: (i + 0.5) * SEG };
}

// ── Timer circle ──────────────────────────────────────────────────────────────

const CIRC_R = 44;
const CIRC = 2 * Math.PI * CIRC_R;

function TimerCircle({ total, left, color }: { total: number; left: number; color: string }) {
  const pct = left / total;
  const dash = pct * CIRC;
  const urgent = left <= 5 && left > 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={CIRC_R} stroke="#e5e7eb" strokeWidth={8} fill="none" />
        <circle
          cx={55}
          cy={55}
          r={CIRC_R}
          stroke={urgent ? "#ef4444" : color}
          strokeWidth={8}
          fill="none"
          strokeDasharray={`${dash.toFixed(2)} ${CIRC.toFixed(2)}`}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: "stroke-dasharray 1s linear, stroke 0.3s" }}
        />
        <text
          x={55}
          y={55}
          dominantBaseline="middle"
          textAnchor="middle"
          fontSize={urgent ? 28 : 24}
          fontWeight="bold"
          fill={urgent ? "#ef4444" : "#1f2937"}
        >
          {left}
        </text>
      </svg>
      <p className="text-xs text-gray-400">secondes</p>
    </div>
  );
}

// ── Non-repeating draw per category (shuffled queue) ──────────────────────────

function useDeckPicker() {
  const decks = useRef<Record<string, number[]>>({});

  function pickFrom(catId: string, total: number): number {
    let deck = decks.current[catId];
    if (!deck || deck.length === 0) {
      deck = Array.from({ length: total }, (_, i) => i);
      // Fisher-Yates
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    const idx = deck.shift()!;
    decks.current[catId] = deck;
    return idx;
  }
  return pickFrom;
}

// ── Main component ────────────────────────────────────────────────────────────

export interface RouletteIRLProps {
  player1: string;
  player2: string;
  coupleId: string | null;
  myUserId: string | null;
  hostUserId: string | null; // user_a = slot 1
  onBack: () => void;
}

export function RouletteIRL({ player1, player2, coupleId, myUserId, hostUserId, onBack }: RouletteIRLProps) {
  const mySlot: 1 | 2 = myUserId && myUserId === hostUserId ? 1 : 2;

  const [state, setState] = useState<SyncState>({
    phase: "idle",
    turn: 1,
    rotation: 0,
    catId: null,
    challenge: "",
    scores: [0, 0],
    success: null,
    timerStartedAt: null,
    nonce: 0,
  });
  const [timerLeft, setTimerLeft] = useState<number>(0);
  const [synced, setSynced] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pickFrom = useDeckPicker();

  const cat = state.catId ? CAT_BY_ID[state.catId] : null;
  const total = cat?.timerSeconds ?? 30;
  const currentName = state.turn === 1 ? player1 : player2;
  const isMyTurn = state.turn === mySlot;

  // ── Realtime sync via broadcast ────────────────────────────────────────────
  const broadcast = useCallback(
    (next: SyncState) => {
      const ch = channelRef.current;
      if (!ch) return;
      void ch.send({ type: "broadcast", event: "state", payload: next });
    },
    [],
  );

  const apply = useCallback((updater: (prev: SyncState) => SyncState, alsoBroadcast = true) => {
    setState((prev) => {
      const next = updater(prev);
      if (alsoBroadcast) broadcast(next);
      return next;
    });
  }, [broadcast]);

  useEffect(() => {
    if (!coupleId) {
      setSynced(false);
      return;
    }
    const ch = supabase.channel(`roulette:${coupleId}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "state" }, (msg) => {
      const payload = msg.payload as SyncState;
      setState((prev) => (payload.nonce > prev.nonce ? payload : prev));
    });
    ch.on("broadcast", { event: "request_state" }, () => {
      // host re-sends its current state
      if (mySlot === 1) broadcast({ ...stateRef.current });
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setSynced(true);
        // non-host asks for current state
        if (mySlot === 2) {
          void ch.send({ type: "broadcast", event: "request_state", payload: {} });
        }
      } else {
        setSynced(false);
      }
    });
    channelRef.current = ch;
    return () => {
      void supabase.removeChannel(ch);
      channelRef.current = null;
      setSynced(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId]);

  // keep latest state in a ref for the request_state handler
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Timer driven by shared timerStartedAt ──────────────────────────────────
  useEffect(() => {
    if (state.phase !== "challenge" || !state.timerStartedAt) {
      setTimerLeft(total);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - state.timerStartedAt!) / 1000);
      const left = Math.max(0, total - elapsed);
      setTimerLeft(left);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [state.phase, state.timerStartedAt, total]);

  // ── Actions ────────────────────────────────────────────────────────────────
  function spin() {
    if (state.phase !== "idle" || !isMyTurn) return;
    const idx = Math.floor(Math.random() * N);
    const chosen = CATEGORIES[idx];
    const cIdx = pickFrom(chosen.id, chosen.challenges.length);
    const picked = chosen.challenges[cIdx];
    const targetAngle = (idx + 0.5) * SEG;
    const curMod = state.rotation % 360;
    let delta = (targetAngle - curMod + 360) % 360;
    if (delta < 20) delta += 360;
    const jitter = (Math.random() - 0.5) * 24;
    const newRotation = state.rotation + 1800 + delta + jitter;

    apply((prev) => ({
      ...prev,
      phase: "spinning",
      catId: chosen.id,
      challenge: picked,
      rotation: newRotation,
      nonce: prev.nonce + 1,
    }));
    setTimeout(() => {
      apply((prev) => ({ ...prev, phase: "reveal", nonce: prev.nonce + 1 }));
    }, 4300);
  }

  function startChallenge() {
    if (!isMyTurn) return;
    apply((prev) => ({
      ...prev,
      phase: "challenge",
      timerStartedAt: Date.now(),
      nonce: prev.nonce + 1,
    }));
  }

  function handleResult(won: boolean) {
    if (!isMyTurn) return;
    apply((prev) => {
      const scores: [number, number] = [prev.scores[0], prev.scores[1]];
      if (won) scores[prev.turn - 1]++;
      return {
        ...prev,
        phase: "result",
        success: won,
        scores,
        timerStartedAt: null,
        nonce: prev.nonce + 1,
      };
    });
  }

  function next() {
    apply((prev) => ({
      ...prev,
      phase: "idle",
      turn: prev.turn === 1 ? 2 : 1,
      catId: null,
      challenge: "",
      success: null,
      timerStartedAt: null,
      nonce: prev.nonce + 1,
    }));
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white/80 px-4 py-3 backdrop-blur-sm shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 transition active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="text-rose-500">
            {player1} {state.scores[0]}
          </span>
          <Trophy className="h-4 w-4 text-amber-400" />
          <span className="text-purple-500">
            {state.scores[1]} {player2}
          </span>
        </div>
        <span title={synced ? "Synchronisé" : "Hors ligne"}>
          {synced ? (
            <Wifi className="h-4 w-4 text-emerald-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-gray-300" />
          )}
        </span>
      </div>

      {/* Turn badge */}
      <motion.div
        key={state.turn}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 pt-4 text-center"
      >
        <span className="inline-block rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-gray-700 shadow-sm">
          🎯 Tour de <strong>{currentName}</strong> {isMyTurn ? "(toi)" : ""}
        </span>
      </motion.div>

      {/* Wheel container */}
      <div className="relative mx-auto mt-4 flex items-center justify-center" style={{ width: 320, height: 320 }}>
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 z-20 -translate-x-1/2" style={{ marginTop: -2 }}>
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "13px solid transparent",
              borderRight: "13px solid transparent",
              borderTop: "26px solid #1f2937",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
            }}
          />
        </div>

        <motion.svg
          width={300}
          height={300}
          viewBox="0 0 300 300"
          animate={{ rotate: state.rotation }}
          transition={{ duration: 4, ease: [0.15, 0.85, 0.35, 1.0] }}
          style={{ originX: "50%", originY: "50%" }}
        >
          {CATEGORIES.map((c, i) => {
            const pos = emojiPos(i);
            return (
              <g key={c.id}>
                <path d={segPath(i)} fill={c.color} stroke="white" strokeWidth={2.5} />
                <text
                  x={pos.x}
                  y={pos.y}
                  fontSize={28}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${pos.rotate}, ${pos.x}, ${pos.y})`}
                >
                  {c.emoji}
                </text>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={24} fill="white" stroke="#e5e7eb" strokeWidth={2} />
          <text x={CX} y={CY} fontSize={18} textAnchor="middle" dominantBaseline="middle">
            💕
          </text>
        </motion.svg>
      </div>

      {/* Spin button */}
      <AnimatePresence>
        {state.phase === "idle" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mt-4 flex flex-col items-center gap-2"
          >
            <button
              onClick={spin}
              disabled={!isMyTurn}
              className="rounded-full bg-gradient-to-br from-pink-500 to-rose-600 px-10 py-4 text-lg font-bold text-white shadow-lg shadow-pink-200 transition active:scale-95 disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none"
            >
              🎰 Lancer la roue
            </button>
            {!isMyTurn && (
              <p className="text-xs text-gray-400">En attente que {currentName} lance la roue…</p>
            )}
          </motion.div>
        )}
        {state.phase === "spinning" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-center text-sm text-gray-400"
          >
            ✨ La roue tourne…
          </motion.p>
        )}
      </AnimatePresence>

      {/* Category reveal overlay */}
      <AnimatePresence>
        {state.phase === "reveal" && cat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-br ${cat.bg} px-6 text-white`}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="text-center"
            >
              <p className="text-9xl">{cat.emoji}</p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight drop-shadow">{cat.label}</h2>
              <p className="mt-2 text-lg opacity-90">{cat.subtitle}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-8 text-center"
            >
              <p className="text-base opacity-80">Le défi de</p>
              <p className="text-2xl font-bold">{currentName}</p>
            </motion.div>
            {isMyTurn ? (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                onClick={startChallenge}
                className="mt-10 rounded-full bg-white px-8 py-3 text-base font-bold shadow-lg transition active:scale-95"
                style={{ color: cat.color }}
              >
                Voir le défi →
              </motion.button>
            ) : (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-10 text-sm opacity-80"
              >
                En attente de {currentName}…
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Challenge view */}
      <AnimatePresence>
        {state.phase === "challenge" && cat && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 px-4"
          >
            <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl">{cat.emoji}</span>
                <span className="text-lg font-bold" style={{ color: cat.color }}>
                  {cat.label}
                </span>
              </div>
              <p className="mt-4 text-center text-base leading-relaxed text-gray-700">
                {state.challenge}
              </p>
              <div className="mt-6 flex justify-center">
                <TimerCircle total={total} left={timerLeft} color={cat.color} />
              </div>
              {isMyTurn ? (
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleResult(false)}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-gray-100 py-3 font-semibold text-gray-600 transition active:scale-95"
                  >
                    <X className="h-4 w-4" /> Raté
                  </button>
                  <button
                    onClick={() => handleResult(true)}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 font-semibold text-white transition active:scale-95"
                  >
                    <Check className="h-4 w-4" /> Réussi
                  </button>
                </div>
              ) : (
                <p className="mt-6 text-center text-xs text-gray-400">
                  {currentName} décide du résultat…
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result view */}
      <AnimatePresence>
        {state.phase === "result" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mt-6 px-4"
          >
            <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
              <p className="text-6xl">{state.success ? "🎉" : "😅"}</p>
              <p className="mt-3 text-2xl font-bold text-gray-800">
                {state.success ? "Réussi !" : "Raté !"}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {state.success
                  ? `Bravo ${currentName}, +1 point !`
                  : `Pas grave ${currentName}, c'est l'autre qui joue.`}
              </p>
              <button
                onClick={next}
                className="mt-6 w-full rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 py-3 font-bold text-white shadow-lg transition active:scale-95"
              >
                Au tour suivant →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
