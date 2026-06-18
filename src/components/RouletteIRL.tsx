import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronRight, Check, X, RotateCcw, Trophy } from "lucide-react";

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
      "Souffle doucement sur chaque zone sensible sans jamais toucher — 1 minute entière.",
      "Murmure tes désirs les plus intenses à l'oreille, aussi lentement que possible — 1 minute.",
      "Trace ton prénom sur le corps de ton/ta partenaire avec un seul doigt. Il/elle ne doit pas frémir.",
      "Effleure les lèvres avec les tiennes sans jamais vraiment embrasser — pendant 1 minute.",
      "Promène tes lèvres de l'oreille jusqu'à l'épaule, en soufflant chaud — 1 minute.",
      "Regarde ton/ta partenaire droit dans les yeux et caresse les bras très doucement — 1 minute.",
      "Chuchote ce que tu ferais ce soir… très lentement… 1 minute complète.",
      "Masse les épaules et la nuque avec tes pouces, en soufflant dans le cou — 1 minute.",
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
      "Trace un chemin de baisers du cou jusqu'au ventre, les yeux de ton/ta partenaire bandés.",
      "Les yeux bandés : décris à voix haute tout ce que tu fais en temps réel — 2 minutes.",
      "Bande les yeux à ton/ta partenaire — il/elle doit deviner chaque endroit que tu embrasses.",
      "Les yeux bandés, les mains tenues : 2 minutes de contact total sans possibilité de fuir.",
      "Bande les yeux et utilise uniquement ta langue sur la peau — trace des formes — 2 minutes.",
      "Les yeux fermés, ton/ta partenaire reçoit 2 minutes de plaisir là où tu décides.",
      "Bande les yeux à ton/ta partenaire — prends le contrôle complet du rythme pendant 2 minutes.",
      "Les yeux bandés : surprise totale — ton/ta partenaire découvre sans voir ce que tu fais.",
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
      "Position debout, ton/ta partenaire dos au mur — contact maximal corps entier pendant 2 minutes.",
      "Levrette : ton/ta partenaire penché(e) en avant, toi derrière — tenez la position 2 minutes.",
      "Assis(e) face à face, jambes entremêlées — yeux dans les yeux, mouvements lents — 2 minutes.",
      "Allongé(e) sur le côté, partenaire derrière en cuillère serré — 2 minutes de chaleur.",
      "Ton/ta partenaire sur le bord du lit ou d'une surface, toi debout face — 2 minutes.",
      "À genoux face à face — contact corps entier, mains libres — 2 minutes.",
      "Debout, toi qui portes ton/ta partenaire contre toi — 1 minute, sans le/la lâcher.",
      "Ton/ta partenaire allongé(e), toi à genoux à côté — exploration complète — 2 minutes.",
      "À 4 pattes, toi qui guides par derrière — 2 minutes.",
      "Face à face debout, mains partout, mouvements libres — 2 minutes sans s'arrêter.",
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
      "30 secondes pour faire réagir ton/ta partenaire uniquement avec ta bouche — commence !",
      "30 secondes pour faire frémir ton/ta partenaire avec tes seuls doigts — aucun autre contact.",
      "30 secondes pour que ton/ta partenaire te demande de ne pas s'arrêter.",
      "30 secondes pour que ton/ta partenaire ferme les yeux de plaisir.",
      "30 secondes pour lui/la faire dire encore ou continue.",
      "30 secondes de contact total — le plus intense et le plus soutenu possible.",
      "30 secondes : fais-lui oublier tout ce qui l'entoure.",
      "30 secondes pour lui/la faire sourire ET frémir simultanément.",
      "30 secondes : ton/ta partenaire résiste et ne bronche pas — bonne chance.",
      "30 secondes pour lui/la faire perdre toute contenance — méthode libre.",
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
      "Allonge-toi et reçois — ton/ta partenaire te masse le corps entier pendant 3 minutes. Tu ne bouges pas.",
      "Mains tenues au-dessus de la tête — tu reçois les baisers de ton/ta partenaire pendant 2 minutes.",
      "Les yeux fermés, tu subis 1 minute de baisers là où ton/ta partenaire le décide — sans protester.",
      "Tu t'allonges, ton/ta partenaire prend le contrôle complet du rythme et du lieu — 3 minutes.",
      "Tu reçois 2 minutes de caresses intensives — sans pouvoir rendre ni bouger les mains.",
      "Ton/ta partenaire trace un chemin de baisers du cou jusqu'aux pieds — tu subis en silence.",
      "Tu te laisses entièrement guider : ton/ta partenaire décide de tout pendant 2 minutes.",
      "Les mains immobiles de chaque côté — ton/ta partenaire explore librement pendant 2 minutes.",
      "Tu fermes les yeux et tu reçois ce que ton/ta partenaire décide de te donner — 2 minutes.",
      "Tu subis 2 minutes de taquineries intenses — ton/ta partenaire s'arrête uniquement quand il/elle veut.",
    ],
  },
];

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
          cx={55} cy={55} r={CIRC_R}
          stroke={urgent ? "#ef4444" : color}
          strokeWidth={8} fill="none"
          strokeDasharray={`${dash.toFixed(2)} ${CIRC.toFixed(2)}`}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: "stroke-dasharray 1s linear, stroke 0.3s" }}
        />
        <text x={55} y={55} dominantBaseline="middle" textAnchor="middle"
          fontSize={urgent ? 28 : 24} fontWeight="bold"
          fill={urgent ? "#ef4444" : "#1f2937"}
        >
          {left}
        </text>
      </svg>
      <p className="text-xs text-gray-400">secondes</p>
    </div>
  );
}

// ── useTimer ──────────────────────────────────────────────────────────────────

function useTimer(total: number, onEnd: () => void) {
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  function start() { setLeft(total); setRunning(true); }
  function stop() { setRunning(false); if (ref.current) clearInterval(ref.current); }

  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => {
      setLeft((t) => {
        if (t <= 1) { setRunning(false); clearInterval(ref.current!); onEnd(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(ref.current!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return { left, running, start, stop };
}

// ── Main component ────────────────────────────────────────────────────────────

export interface RouletteIRLProps {
  player1: string;
  player2: string;
  onBack: () => void;
}

export function RouletteIRL({ player1, player2, onBack }: RouletteIRLProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [turn, setTurn] = useState<1 | 2>(1);
  const [rotation, setRotation] = useState(0);
  const [cat, setCat] = useState<Category | null>(null);
  const [challenge, setChallenge] = useState("");
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [timerDone, setTimerDone] = useState(false);

  const currentName = turn === 1 ? player1 : player2;
  const otherName   = turn === 1 ? player2 : player1;
  const timer = useTimer(cat?.timerSeconds ?? 30, () => setTimerDone(true));

  function spin() {
    if (phase !== "idle") return;
    const idx = Math.floor(Math.random() * N);
    const chosen = CATEGORIES[idx];
    const picked = chosen.challenges[Math.floor(Math.random() * chosen.challenges.length)];
    const targetAngle = (idx + 0.5) * SEG;
    const curMod = rotation % 360;
    let delta = (targetAngle - curMod + 360) % 360;
    if (delta < 20) delta += 360;
    const jitter = (Math.random() - 0.5) * 24;
    setCat(chosen); setChallenge(picked); setTimerDone(false);
    setRotation(rotation + 1800 + delta + jitter);
    setPhase("spinning");
    setTimeout(() => setPhase("reveal"), 4300);
  }

  function startChallenge() {
    setTimerDone(false); setPhase("challenge"); timer.start();
  }

  function handleResult(won: boolean) {
    timer.stop(); setSuccess(won);
    if (won) setScores((s) => { const n: [number,number] = [s[0],s[1]]; n[turn-1]++; return n; });
    setPhase("result");
  }

  function next() {
    setTurn((t) => (t === 1 ? 2 : 1));
    setCat(null); setChallenge(""); setTimerDone(false); setSuccess(null); setPhase("idle");
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white/80 px-4 py-3 backdrop-blur-sm shadow-sm">
        <button onClick={onBack} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 transition active:scale-95">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="text-rose-500">{player1} {scores[0]}</span>
          <Trophy className="h-4 w-4 text-amber-400" />
          <span className="text-purple-500">{scores[1]} {player2}</span>
        </div>
      </div>

      {/* Turn badge */}
      <motion.div key={turn} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="px-4 pt-4 text-center">
        <span className="inline-block rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-gray-700 shadow-sm">
          🎯 Tour de <strong>{currentName}</strong>
        </span>
      </motion.div>

      {/* Wheel container */}
      <div className="relative mx-auto mt-4 flex items-center justify-center" style={{ width: 320, height: 320 }}>
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 z-20 -translate-x-1/2" style={{ marginTop: -2 }}>
          <div style={{ width: 0, height: 0, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderTop: "26px solid #1f2937", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }} />
        </div>

        <motion.svg
          width={300} height={300} viewBox="0 0 300 300"
          animate={{ rotate: rotation }}
          transition={{ duration: 4, ease: [0.15, 0.85, 0.35, 1.0] }}
          style={{ originX: "50%", originY: "50%" }}
        >
          {CATEGORIES.map((c, i) => {
            const pos = emojiPos(i);
            return (
              <g key={c.id}>
                <path d={segPath(i)} fill={c.color} stroke="white" strokeWidth={2.5} />
                <text x={pos.x} y={pos.y} fontSize={28} textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${pos.rotate}, ${pos.x}, ${pos.y})`}>
                  {c.emoji}
                </text>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={24} fill="white" stroke="#e5e7eb" strokeWidth={2} />
          <text x={CX} y={CY} fontSize={18} textAnchor="middle" dominantBaseline="middle">💕</text>
        </motion.svg>
      </div>

      {/* Spin button */}
      <AnimatePresence>
        {phase === "idle" && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="mt-4 flex justify-center">
            <button onClick={spin} className="rounded-full bg-gradient-to-br from-pink-500 to-rose-600 px-10 py-4 text-lg font-bold text-white shadow-lg shadow-pink-200 transition active:scale-95">
              🎰 Lancer la roue
            </button>
          </motion.div>
        )}
        {phase === "spinning" && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 text-center text-sm text-gray-400">
            ✨ La roue tourne…
          </motion.p>
        )}
      </AnimatePresence>

      {/* Category reveal overlay */}
      <AnimatePresence>
        {phase === "reveal" && cat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`fixed inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-br ${cat.bg} px-6 text-white`}>
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", duration: 0.6 }} className="text-center">
              <p className="text-9xl">{cat.emoji}</p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight drop-shadow">{cat.label}</h2>
              <p className="mt-2 text-lg opacity-90">{cat.subtitle}</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-8 text-center">
              <p className="text-base opacity-80">Le défi de</p>
              <p className="text-2xl font-bold">{currentName}</p>
            </motion.div>
            <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
              onClick={startChallenge}
              className="mt-10 flex items-center gap-2 rounded-full bg-white/25 px-8 py-3.5 text-lg font-semibold backdrop-blur-sm transition active:scale-95 hover:bg-white/35">
              Voir le défi <ChevronRight className="h-5 w-5" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Challenge overlay */}
      <AnimatePresence>
        {phase === "challenge" && cat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-white px-5 pb-8">
            {/* Category badge */}
            <div className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-white" style={{ background: cat.color }}>
              {cat.emoji} {cat.label}
            </div>

            {/* Challenge text */}
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
              className="mx-auto mt-5 max-w-sm rounded-3xl border-2 p-6 shadow-sm"
              style={{ borderColor: cat.color + "50", background: cat.color + "0A" }}>
              <p className="text-center text-lg font-medium leading-relaxed text-gray-800">{challenge}</p>
            </motion.div>

            {/* Roles */}
            <p className="mt-3 text-center text-sm text-gray-400">
              <span className="font-semibold" style={{ color: cat.color }}>{currentName}</span>
              {" → "}
              <span className="font-semibold text-gray-600">{otherName}</span>
            </p>

            {/* Timer */}
            <div className="mt-5 flex justify-center">
              <TimerCircle total={cat.timerSeconds} left={timer.left} color={cat.color} />
            </div>

            {timerDone && (
              <motion.p initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="mt-2 text-center text-sm font-semibold text-red-500">
                ⏰ Temps écoulé !
              </motion.p>
            )}

            {/* Buttons */}
            <div className="mt-6 flex gap-3">
              <button onClick={() => handleResult(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-red-200 bg-red-50 py-4 text-base font-semibold text-red-500 transition active:scale-95">
                <X className="h-5 w-5" /> Forfait
              </button>
              <button onClick={() => handleResult(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-emerald-200 bg-emerald-50 py-4 text-base font-semibold text-emerald-600 transition active:scale-95">
                <Check className="h-5 w-5" /> Réussi !
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result overlay */}
      <AnimatePresence>
        {phase === "result" && cat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
            style={{ background: success ? "#f0fdf4" : "#fff1f2" }}>
            <motion.div initial={{ scale: 0.5, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", duration: 0.5 }} className="text-center">
              <p className="text-8xl">{success ? "🎉" : "😈"}</p>
              <h2 className="mt-4 text-3xl font-bold" style={{ color: success ? "#16a34a" : "#e11d48" }}>
                {success ? "Défi relevé !" : "Forfait !"}
              </h2>
              <p className="mt-2 text-gray-500">
                {success ? `+1 point pour ${currentName} 💕` : `${currentName} a craqué… 😏`}
              </p>
            </motion.div>

            {/* Score */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="mt-8 flex items-center gap-6 rounded-3xl bg-white px-8 py-4 shadow-md">
              <div className="text-center">
                <p className="text-xs text-gray-400">{player1}</p>
                <p className="text-3xl font-bold text-rose-500">{scores[0]}</p>
              </div>
              <Trophy className="h-6 w-6 text-amber-400" />
              <div className="text-center">
                <p className="text-xs text-gray-400">{player2}</p>
                <p className="text-3xl font-bold text-purple-500">{scores[1]}</p>
              </div>
            </motion.div>

            <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              onClick={next}
              className="mt-8 flex items-center gap-2 rounded-full bg-gray-900 px-8 py-4 text-base font-semibold text-white shadow transition active:scale-95">
              <RotateCcw className="h-4 w-4" />
              Tour de {turn === 1 ? player2 : player1}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
