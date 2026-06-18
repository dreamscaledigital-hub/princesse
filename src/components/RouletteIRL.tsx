import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronRight, Check, X, RotateCcw, Trophy, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Category = {
  id: string; emoji: string; label: string; subtitle: string;
  color: string; bg: string; challenges: string[]; timerSeconds: number;
};
type Phase = "agreement" | "idle" | "spinning" | "reveal" | "challenge" | "result" | "victory";

const CATEGORIES: Category[] = [
  {
    id: "provocation", emoji: "🔥", label: "Provocation",
    subtitle: "Tu tentes… l'autre résiste", color: "#ef4444",
    bg: "from-red-500 to-orange-500", timerSeconds: 60,
    challenges: [
      // ── mild ──
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
      // ── corsé ──
      "Caresse l'intérieur des cuisses de ton/ta partenaire très lentement, en remontant — sans jamais aller plus haut. Il/elle ne bouge pas.",
      "Embrasse le cou, mords légèrement l'oreille, souffle chaud dans la nuque — 60s sans pause.",
      "Promène les doigts sur tout le corps en t'arrêtant juste là où il/elle veut que tu continues — sans jamais y aller.",
      "Murmure en détail ce que tu vas lui faire ce soir. Aussi lentement que possible. Aucun mot ne doit manquer.",
      "Trace un chemin de baisers du nombril vers le bas — arrête-toi juste avant. Recommence depuis le début.",
      "Effleure les lèvres, les hanches, le bas du dos avec tes doigts — sans saisir, juste frôler.",
      "Masse les fesses et le bas du dos lentement — il/elle ne doit pas fléchir ni soupirer.",
      "Pose ta main là où tu veux sur son corps — sans la bouger. Juste la chaleur. 60 secondes.",
      "Embrasse partout sauf là où il/elle veut le plus. Résiste à ses sous-entendus pendant 1 minute.",
      "Regarde-le/la dans les yeux et caresse ses lèvres avec ton pouce — sans embrasser. 1 minute entière.",
    ],
  },
  {
    id: "aveugle", emoji: "👁️", label: "À l'aveugle",
    subtitle: "Les yeux bandés, le reste suit", color: "#7c3aed",
    bg: "from-violet-600 to-purple-700", timerSeconds: 120,
    challenges: [
      // ── mild ──
      "Bande les yeux à ton/ta partenaire — embrasse-le/la partout sauf les lèvres pendant 2 minutes.",
      "Les yeux bandés : guide doucement les mains de ton/ta partenaire sur ton corps pendant 2 minutes.",
      "Trace un chemin de baisers du cou jusqu'au ventre, les yeux de ton/ta partenaire bandés.",
      "Les yeux bandés : décris à voix haute tout ce que tu fais en temps réel — 2 minutes.",
      "Bande les yeux à ton/ta partenaire — il/elle doit deviner chaque endroit que tu embrasses.",
      "Les yeux bandés, les mains tenues : 2 minutes de contact total sans possibilité de fuir.",
      "Bande les yeux et utilise uniquement ta langue sur la peau — trace des formes — 2 minutes.",
      "Les yeux fermés, ton/ta partenaire reçoit 2 minutes de plaisir là où tu décides.",
      "Bande les yeux à ton/ta partenaire — prends le contrôle complet du rythme pendant 2 minutes.",
      "Les yeux bandés : ton/ta partenaire choisit une partie du corps, toi tu choisis comment l'explorer.",
      // ── corsé ──
      "Yeux bandés, mains liées dans le dos — tu as 2 minutes pour explorer ton/ta partenaire sans contrainte.",
      "Bande les yeux à ton/ta partenaire. Utilise tes lèvres et ta langue du ventre vers les hanches — 2 minutes.",
      "Les yeux bandés : ton/ta partenaire doit deviner quelle partie de ton corps tu poses contre lui/elle.",
      "Bande les yeux, décris chaque geste à voix haute avec tous les détails — 2 minutes sans s'arrêter.",
      "Yeux bandés : embrasse-le/la partout sauf là où il/elle attend le plus. Fais durer la frustration.",
      "Les yeux bandés — tu as 2 minutes pour lui faire ressentir quelque chose d'intense sans aucun mot.",
      "Yeux bandés, mains bloquées au-dessus de la tête : il/elle subit ce que tu décides — 2 minutes.",
      "Bande les yeux et guide lentement ses mains sur ton corps, zone par zone, pendant 2 minutes.",
      "Les yeux bandés : il/elle doit nommer chaque endroit où tu poses les lèvres avant que tu continues.",
      "Yeux bandés, tu souffles chaud et embrasses dans le cou et le creux des épaules — 2 minutes continues.",
    ],
  },
  {
    id: "position", emoji: "💫", label: "Position Insolite",
    subtitle: "Créativité et complicité", color: "#d97706",
    bg: "from-amber-500 to-yellow-500", timerSeconds: 120,
    challenges: [
      // ── mild ──
      "Position debout, ton/ta partenaire dos au mur — contact maximal corps entier pendant 2 minutes.",
      "Levrette : ton/ta partenaire penché(e) en avant, toi derrière — tenez la position 2 minutes.",
      "Assis(e) face à face, jambes entremêlées — yeux dans les yeux, mouvements lents — 2 minutes.",
      "Allongé(e) sur le côté, partenaire derrière en cuillère serré — 2 minutes de chaleur totale.",
      "Ton/ta partenaire sur le bord du lit ou d'une surface, toi debout face — 2 minutes.",
      "À genoux face à face — contact corps entier, mains libres — 2 minutes.",
      "Debout, toi qui portes ton/ta partenaire contre toi — 1 minute, sans le/la lâcher.",
      "Ton/ta partenaire allongé(e), toi à genoux à côté — exploration complète — 2 minutes.",
      "À 4 pattes, toi qui guides par derrière — 2 minutes.",
      "Face à face debout, mains partout, mouvements libres — 2 minutes sans s'arrêter.",
      // ── corsé ──
      "Debout contre le mur, jambes de ton/ta partenaire autour de tes hanches — contact maximal, 2 minutes.",
      "Ton/ta partenaire allongé(e) sur le bord du lit, toi debout — contrôle total du rythme, 2 minutes.",
      "Face à face assis(e), bassin à bassin, mouvements circulaires très lents — yeux dans les yeux, 2 minutes.",
      "Levrette mais au ralenti extrême — rythme imposé par celui/celle qui est derrière, 2 minutes.",
      "Cuillère à genoux tous les deux — contact maximal dos/ventre, mains libres sur les hanches, 2 minutes.",
      "Toi assis(e), partenaire sur toi face à toi — mains libres, rythme libre, 2 minutes.",
      "Partenaire debout, toi à genoux face — 2 minutes, exploration et contact libres.",
      "Partenaire à 4 pattes, toi derrière — contrôle du rythme et de la profondeur, 2 minutes.",
      "Les deux debout, toi derrière — joue sur l'angle, la pression, les mains sur les hanches, 2 minutes.",
      "Partenaire penché(e) sur une surface, toi debout derrière — rythme entièrement contrôlé par toi, 2 min.",
    ],
  },
  {
    id: "defi", emoji: "⏱️", label: "Le Défi",
    subtitle: "30 secondes pour réussir", color: "#059669",
    bg: "from-emerald-500 to-teal-600", timerSeconds: 30,
    challenges: [
      // ── mild ──
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
      // ── corsé ──
      "30 secondes pour lui/la faire retenir son souffle.",
      "30 secondes pour le/la faire s'accrocher à quelque chose.",
      "30 secondes pour lui/la faire fermer les yeux sans le demander.",
      "30 secondes pour que le/la partenaire te supplie de continuer.",
      "30 secondes de contact avec ta bouche uniquement — là où tu décides.",
      "30 secondes pour lui/la faire cambrer le dos.",
      "30 secondes le plus lentement possible — zéro précipitation, maximum d'intensité.",
      "30 secondes les yeux dans les yeux — pas le droit de les baisser.",
      "30 secondes de contact maximal puis immobilité totale — attends sa réaction.",
      "30 secondes pour lui/la faire oublier comment s'appelle la pièce où vous êtes.",
    ],
  },
  {
    id: "soumission", emoji: "🎀", label: "Tu Subis",
    subtitle: "L'un donne, l'autre reçoit", color: "#db2777",
    bg: "from-pink-500 to-rose-600", timerSeconds: 120,
    challenges: [
      // ── mild ──
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
      // ── corsé ──
      "Mains tenues dans le dos — tu reçois 2 minutes de baisers là où il/elle choisit, sans dire un mot.",
      "Allongé(e), yeux fermés — il/elle trace lentement ses mains partout pendant 2 minutes sans s'arrêter.",
      "Tu n'as pas le droit de toucher — 2 minutes de caresses ciblées sur tes zones les plus sensibles.",
      "Yeux bandés, mains immobiles : il/elle explore librement pendant 3 minutes — tu subis.",
      "Tu restes debout, mains le long du corps — il/elle prend le contrôle total pendant 2 minutes.",
      "Tu t'allonges face contre le matelas — massage du dos, des fesses et des cuisses — 3 minutes.",
      "Il/elle choisit une zone de ton corps et s'y concentre exclusivement pendant 2 minutes — tu subis.",
      "Mains au-dessus de la tête, yeux fermés — il/elle fait ce qu'il/elle veut pendant 2 minutes.",
      "Tu peux réagir mais pas bouger les mains — 2 minutes de taquineries ciblées sans merci.",
      "Il/elle s'arrête quand il/elle veut, reprend quand il/elle veut — tu ne contrôles rien pendant 3 minutes.",
    ],
  },
];

const N = CATEGORIES.length;
const SEG = 360 / N;
const CX = 150; const CY = 150; const R = 138;

function segPath(i: number): string {
  const s = ((i * SEG - 90) * Math.PI) / 180;
  const e = (((i + 1) * SEG - 90) * Math.PI) / 180;
  const x1 = CX + R * Math.cos(s); const y1 = CY + R * Math.sin(s);
  const x2 = CX + R * Math.cos(e); const y2 = CY + R * Math.sin(e);
  return `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}
function emojiPos(i: number) {
  const mid = (((i + 0.5) * SEG - 90) * Math.PI) / 180;
  const d = R * 0.63;
  return { x: CX + d * Math.cos(mid), y: CY + d * Math.sin(mid), rotate: (i + 0.5) * SEG };
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CIRC_R = 44;
const CIRC = 2 * Math.PI * CIRC_R;

function TimerCircle({ total, left, color }: { total: number; left: number; color: string }) {
  const pct = total > 0 ? left / total : 0;
  const dash = pct * CIRC;
  const urgent = left <= 5 && left > 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={CIRC_R} stroke="#e5e7eb" strokeWidth={8} fill="none" />
        <circle cx={55} cy={55} r={CIRC_R} stroke={urgent ? "#ef4444" : color} strokeWidth={8} fill="none"
          strokeDasharray={`${dash.toFixed(2)} ${CIRC.toFixed(2)}`} strokeLinecap="round"
          transform="rotate(-90 55 55)" style={{ transition: "stroke-dasharray 1s linear, stroke 0.3s" }} />
        <text x={55} y={55} dominantBaseline="middle" textAnchor="middle"
          fontSize={urgent ? 28 : 24} fontWeight="bold" fill={urgent ? "#ef4444" : "#1f2937"}>{left}</text>
      </svg>
      <p className="text-xs text-gray-400">secondes</p>

      {/* ── Agreement screen ── */}
      <AnimatePresence>
        {phase === "agreement" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-rose-100 via-pink-50 to-purple-100 px-6 py-10">
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", duration: 0.6 }} className="w-full max-w-sm">
              <div className="text-center">
                <p className="text-7xl">💋</p>
                <h1 className="mt-3 text-3xl font-bold text-gray-800">Roulette Coquine</h1>
              </div>
              <div className="mt-5 rounded-3xl bg-white p-6 shadow-lg">
                <p className="text-sm font-semibold text-gray-700 mb-3">📜 Règles du jeu</p>
                <p className="text-sm text-gray-600 leading-relaxed">Chacun lance la roue à tour de rôle. La roue désigne une catégorie et un défi à relever.</p>
                <p className="text-sm text-gray-600 leading-relaxed mt-2">Réussir <span className="font-semibold text-emerald-600">= +1 point</span>. Échouer = pas de point.</p>
                <div className="mt-4 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 p-4 text-white text-center">
                  <p className="text-xl font-bold">🏆 Premier à 10 points</p>
                  <p className="mt-1 text-sm font-medium opacity-90">peut exiger ce qu'il veut,</p>
                  <p className="text-sm font-medium opacity-90">quand il veut, où il veut.</p>
                  <p className="mt-2 text-xs opacity-75 italic">— sans limite de temps —</p>
                </div>
                <p className="mt-4 text-xs text-center text-gray-400">En tapant « J'accepte », vous consentez librement à jouer ensemble.</p>
              </div>
              <div className="mt-5 flex flex-col items-center gap-3">
                {!myAgreed ? (
                  <button onClick={agree} className="rounded-full bg-gradient-to-br from-pink-500 to-rose-600 px-10 py-4 text-lg font-bold text-white shadow-lg shadow-pink-200 transition active:scale-95">
                    💕 J'accepte !
                  </button>
                ) : (
                  <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-6 py-3">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-600">Tu as accepté !</span>
                  </div>
                )}
                <p className="text-sm text-center">
                  {partnerAgreed
                    ? <span className="font-medium text-emerald-500">✓ {theirName} a accepté !</span>
                    : <span className="text-gray-400 animate-pulse">En attente de {theirName}…</span>}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Victory screen ── */}
      <AnimatePresence>
        {phase === "victory" && winner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-100 px-6 py-10">
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", duration: 0.7 }}>
              <p className="text-center text-9xl">👑</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-4 text-center w-full max-w-sm">
              <h1 className="text-4xl font-bold text-gray-800">{winner === 1 ? player1 : player2} gagne !</h1>
              <div className="mt-5 rounded-3xl bg-white px-8 py-6 shadow-xl text-center">
                <p className="text-base font-semibold text-gray-500 uppercase tracking-wider">🏆 Ton cadeau</p>
                <p className="mt-3 text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-pink-500 to-rose-600 leading-tight">Tu exiges ce que tu veux,</p>
                <p className="text-2xl font-extrabold text-gray-700">quand tu veux,</p>
                <p className="text-2xl font-extrabold text-gray-700">où tu veux. 😈</p>
                <p className="mt-3 text-sm text-gray-400 italic">— sans limite de temps —</p>
              </div>
              <div className="mt-4 flex items-center justify-center gap-6 rounded-2xl bg-white/80 px-6 py-3 shadow">
                <div className="text-center"><p className="text-xs text-gray-400">{player1}</p><p className="text-2xl font-bold text-rose-500">{scores[0]}</p></div>
                <Trophy className="h-5 w-5 text-amber-400" />
                <div className="text-center"><p className="text-xs text-gray-400">{player2}</p><p className="text-2xl font-bold text-purple-500">{scores[1]}</p></div>
              </div>
              <button onClick={restart} className="mt-6 flex items-center gap-2 rounded-full bg-gray-900 px-8 py-4 text-base font-semibold text-white shadow transition active:scale-95 mx-auto">
                <RotateCcw className="h-4 w-4" /> Nouvelle partie
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function useTimer(onEnd: () => void) {
  const [left, setLeft] = useState(0);
  const [total, setTotal] = useState(30);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  function start(seconds: number) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setTotal(seconds); setLeft(seconds); setRunning(true);
  }
  function stop() {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setLeft((t) => {
        if (t <= 1) { setRunning(false); clearInterval(intervalRef.current!); onEndRef.current(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [running]);
  return { left, total, running, start, stop };
}

export interface RouletteIRLProps {
  player1: string; player2: string;
  mySlot: 1 | 2; coupleId: string;
  onBack: () => void;
}

export function RouletteIRL({ player1, player2, mySlot, coupleId, onBack }: RouletteIRLProps) {
  const [phase,     setPhase]     = useState<Phase>("agreement");
  const [turn,      setTurn]      = useState<1 | 2>(1);
  const [rotation,  setRotation]  = useState(0);
  const [cat,       setCat]       = useState<Category | null>(null);
  const [challenge, setChallenge] = useState("");
  const [scores,    setScores]    = useState<[number, number]>([0, 0]);
  const [success,   setSuccess]   = useState<boolean | null>(null);
  const [timerDone, setTimerDone] = useState(false);
  const [connected, setConnected] = useState(false);
  const [myAgreed,  setMyAgreed]  = useState(false);
  const [partnerAgreed, setPartnerAgreed] = useState(false);
  const [winner,    setWinner]    = useState<1 | 2 | null>(null);

  const channelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const queuesRef     = useRef<Record<string, string[]>>({});
  const processingRef = useRef(false);

  const isMyTurn    = turn === mySlot;
  const currentName = turn === 1 ? player1 : player2;
  const otherName   = turn === 1 ? player2 : player1;
  const myName      = mySlot === 1 ? player1 : player2; // eslint-disable-line @typescript-eslint/no-unused-vars
  const theirName   = mySlot === 1 ? player2 : player1;
  const timer       = useTimer(() => setTimerDone(true));

  function nextChallenge(catId: string, challenges: string[]): string {
    if (!queuesRef.current[catId] || queuesRef.current[catId].length === 0) {
      queuesRef.current[catId] = shuffle([...challenges]);
    }
    return queuesRef.current[catId].pop()!;
  }

  useEffect(() => {
    const ch = supabase.channel(`roulette:${coupleId}`, {
      config: { broadcast: { self: false } },
    });
    ch
      .on("broadcast", { event: "spin" }, ({ payload }: { payload: { catId: string; challenge: string; rotation: number } }) => {
        const found = CATEGORIES.find((c) => c.id === payload.catId) ?? null;
        setCat(found); setChallenge(payload.challenge);
        setRotation(payload.rotation); setTimerDone(false);
        setPhase("spinning");
        setTimeout(() => setPhase("reveal"), 4300);
      })
      .on("broadcast", { event: "start_challenge" }, ({ payload }: { payload: { seconds: number } }) => {
        setTimerDone(false); setPhase("challenge"); timer.start(payload.seconds);
      })
      .on("broadcast", { event: "result" }, ({ payload }: { payload: { success: boolean; slot: number } }) => {
        if (processingRef.current) return;
        processingRef.current = true;
        setSuccess(payload.success);
        if (payload.success) setScores((s) => { const n: [number,number]=[s[0],s[1]]; n[payload.slot-1]++; return n; });
        setPhase("result");
        setTimeout(() => { processingRef.current = false; }, 500);
      })
      .on("broadcast", { event: "next" }, ({ payload }: { payload: { nextTurn: 1 | 2 } }) => {
        setTurn(payload.nextTurn); setCat(null); setChallenge("");
        setTimerDone(false); setSuccess(null); setPhase("idle");
      })
      .on("broadcast", { event: "agreed" }, () => { setPartnerAgreed(true); })
      .on("broadcast", { event: "victory" }, ({ payload }: { payload: { winner: 1|2; newScores: [number,number] } }) => {
        if (processingRef.current) return;
        processingRef.current = true;
        setScores(payload.newScores); setWinner(payload.winner); setPhase("victory");
        setTimeout(() => { processingRef.current = false; }, 500);
      })
      .on("broadcast", { event: "restart" }, () => {
        setScores([0, 0]); setWinner(null); setTurn(1);
        setCat(null); setChallenge(""); setTimerDone(false); setSuccess(null);
        setPhase("idle");
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId]);

  useEffect(() => {
    if (myAgreed && partnerAgreed && phase === "agreement") setPhase("idle");
  }, [myAgreed, partnerAgreed, phase]);

  function agree() {
    if (myAgreed) return;
    channelRef.current?.send({ type: "broadcast", event: "agreed", payload: {} });
    setMyAgreed(true);
  }

  function restart() {
    if (processingRef.current) return;
    processingRef.current = true;
    channelRef.current?.send({ type: "broadcast", event: "restart", payload: {} });
    setScores([0, 0]); setWinner(null); setTurn(1);
    setCat(null); setChallenge(""); setTimerDone(false); setSuccess(null);
    setPhase("idle");
    setTimeout(() => { processingRef.current = false; }, 500);
  }

  function spin() {
    if (phase !== "idle" || !isMyTurn) return;
    const idx = Math.floor(Math.random() * N);
    const chosen = CATEGORIES[idx];
    const picked = nextChallenge(chosen.id, chosen.challenges);
    const targetAngle = (idx + 0.5) * SEG;
    const curMod = rotation % 360;
    let delta = (targetAngle - curMod + 360) % 360;
    if (delta < 20) delta += 360;
    const newRot = rotation + 1800 + delta + (Math.random() - 0.5) * 24;
    channelRef.current?.send({ type: "broadcast", event: "spin", payload: { catId: chosen.id, challenge: picked, rotation: newRot } });
    setCat(chosen); setChallenge(picked); setRotation(newRot); setTimerDone(false);
    setPhase("spinning");
    setTimeout(() => setPhase("reveal"), 4300);
  }

  function startChallenge() {
    if (!isMyTurn || !cat) return;
    channelRef.current?.send({ type: "broadcast", event: "start_challenge", payload: { seconds: cat.timerSeconds } });
    setTimerDone(false); setPhase("challenge"); timer.start(cat.timerSeconds);
  }

  function handleResult(won: boolean) {
    if (processingRef.current) return;
    processingRef.current = true;
    timer.stop();
    const newScores: [number, number] = [scores[0], scores[1]];
    if (won) newScores[turn - 1]++;
    setSuccess(won); setScores(newScores);
    if (won && newScores[turn - 1] >= 10) {
      channelRef.current?.send({ type: "broadcast", event: "victory", payload: { winner: turn, newScores } });
      setWinner(turn); setPhase("victory");
    } else {
      channelRef.current?.send({ type: "broadcast", event: "result", payload: { success: won, slot: turn } });
      setPhase("result");
    }
    setTimeout(() => { processingRef.current = false; }, 500);
  }

  function next() {
    if (!isMyTurn) return;
    const nextTurn: 1|2 = turn === 1 ? 2 : 1;
    channelRef.current?.send({ type: "broadcast", event: "next", payload: { nextTurn } });
    setTurn(nextTurn); setCat(null); setChallenge(""); setTimerDone(false); setSuccess(null); setPhase("idle");
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white/80 px-4 py-3 backdrop-blur-sm shadow-sm">
        <button onClick={onBack} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600 transition active:scale-95">
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>
        <div className="flex items-center gap-2">
          <div className="text-center">
            <div className="text-xs font-bold text-rose-500">{player1}</div>
            <div className="flex gap-0.5 justify-center mt-0.5">{Array.from({length:10}).map((_,i)=>(<div key={i} className={`h-1.5 w-1.5 rounded-full transition-colors ${i<scores[0]?"bg-rose-500":"bg-rose-200"}`}/>))}</div>
            <div className="text-xs text-gray-400 leading-none">{scores[0]}/10</div>
          </div>
          <Trophy className="h-4 w-4 text-amber-400 mx-1" />
          <div className="text-center">
            <div className="text-xs font-bold text-purple-500">{player2}</div>
            <div className="flex gap-0.5 justify-center mt-0.5">{Array.from({length:10}).map((_,i)=>(<div key={i} className={`h-1.5 w-1.5 rounded-full transition-colors ${i<scores[1]?"bg-purple-500":"bg-purple-200"}`}/>))}</div>
            <div className="text-xs text-gray-400 leading-none">{scores[1]}/10</div>
          </div>
        </div>
        <div title={connected ? "Synchronisé" : "Connexion…"}>
          {connected ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-gray-300 animate-pulse" />}
        </div>
      </div>

      <motion.div key={turn} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="px-4 pt-4 text-center">
        <span className="inline-block rounded-full bg-white/90 px-4 py-1.5 text-sm font-medium text-gray-700 shadow-sm">
          {isMyTurn ? "🎯 C'est ton tour !" : `⏳ Tour de ${currentName}`}
        </span>
      </motion.div>

      <div className="relative mx-auto mt-4 flex items-center justify-center" style={{ width: 320, height: 320 }}>
        <div className="absolute top-0 left-1/2 z-20 -translate-x-1/2" style={{ marginTop: -2 }}>
          <div style={{ width: 0, height: 0, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderTop: "26px solid #1f2937", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }} />
        </div>
        <motion.svg width={300} height={300} viewBox="0 0 300 300"
          animate={{ rotate: rotation }} transition={{ duration: 4, ease: [0.15, 0.85, 0.35, 1.0] }}
          style={{ originX: "50%", originY: "50%" }}>
          {CATEGORIES.map((c, i) => {
            const pos = emojiPos(i);
            return (
              <g key={c.id}>
                <path d={segPath(i)} fill={c.color} stroke="white" strokeWidth={2.5} />
                <text x={pos.x} y={pos.y} fontSize={28} textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${pos.rotate}, ${pos.x}, ${pos.y})`}>{c.emoji}</text>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r={24} fill="white" stroke="#e5e7eb" strokeWidth={2} />
          <text x={CX} y={CY} fontSize={18} textAnchor="middle" dominantBaseline="middle">💕</text>
        </motion.svg>
      </div>

      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="mt-4 flex flex-col items-center gap-2">
            {isMyTurn ? (
              <button onClick={spin} className="rounded-full bg-gradient-to-br from-pink-500 to-rose-600 px-10 py-4 text-lg font-bold text-white shadow-lg shadow-pink-200 transition active:scale-95">
                🎰 Lancer la roue
              </button>
            ) : (
              <p className="text-sm text-gray-400 animate-pulse">En attente que {currentName} lance…</p>
            )}
          </motion.div>
        )}
        {phase === "spinning" && (
          <motion.p key="spinning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 text-center text-sm text-gray-400">
            ✨ La roue tourne…
          </motion.p>
        )}
      </AnimatePresence>

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
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
              {isMyTurn ? (
                <button onClick={startChallenge} className="mt-10 flex items-center gap-2 rounded-full bg-white/25 px-8 py-3.5 text-lg font-semibold backdrop-blur-sm transition active:scale-95 hover:bg-white/35">
                  Voir le défi <ChevronRight className="h-5 w-5" />
                </button>
              ) : (
                <p className="mt-10 rounded-full bg-white/20 px-6 py-3 text-base opacity-80">En attente de {currentName}…</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "challenge" && cat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-white px-5 pb-8">
            <div className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-white" style={{ background: cat.color }}>
              {cat.emoji} {cat.label}
            </div>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
              className="mx-auto mt-5 max-w-sm rounded-3xl border-2 p-6 shadow-sm"
              style={{ borderColor: cat.color + "50", background: cat.color + "0A" }}>
              <p className="text-center text-lg font-medium leading-relaxed text-gray-800">{challenge}</p>
            </motion.div>
            <p className="mt-3 text-center text-sm text-gray-400">
              <span className="font-semibold" style={{ color: cat.color }}>{currentName}</span>{" → "}
              <span className="font-semibold text-gray-600">{otherName}</span>
            </p>
            <div className="mt-5 flex justify-center">
              <TimerCircle total={timer.total} left={timer.left} color={cat.color} />
            </div>
            {timerDone && (
              <motion.p initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="mt-2 text-center text-sm font-semibold text-red-500">⏰ Temps écoulé !</motion.p>
            )}
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
              <p className="mt-2 text-gray-500">{success ? `+1 point pour ${currentName} 💕` : `${currentName} a craqué… 😏`}</p>
            </motion.div>
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
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              {isMyTurn ? (
                <button onClick={next} className="mt-8 flex items-center gap-2 rounded-full bg-gray-900 px-8 py-4 text-base font-semibold text-white shadow transition active:scale-95">
                  <RotateCcw className="h-4 w-4" /> Tour de {otherName}
                </button>
              ) : (
                <p className="mt-8 text-sm text-gray-400 animate-pulse">En attente de {currentName}…</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Agreement screen ── */}
      <AnimatePresence>
        {phase === "agreement" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-rose-100 via-pink-50 to-purple-100 px-6 py-10">
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", duration: 0.6 }} className="w-full max-w-sm">
              <div className="text-center">
                <p className="text-7xl">💋</p>
                <h1 className="mt-3 text-3xl font-bold text-gray-800">Roulette Coquine</h1>
              </div>
              <div className="mt-5 rounded-3xl bg-white p-6 shadow-lg">
                <p className="text-sm font-semibold text-gray-700 mb-3">📜 Règles du jeu</p>
                <p className="text-sm text-gray-600 leading-relaxed">Chacun lance la roue à tour de rôle. La roue désigne une catégorie et un défi à relever.</p>
                <p className="text-sm text-gray-600 leading-relaxed mt-2">Réussir <span className="font-semibold text-emerald-600">= +1 point</span>. Échouer = pas de point.</p>
                <div className="mt-4 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 p-4 text-white text-center">
                  <p className="text-xl font-bold">🏆 Premier à 10 points</p>
                  <p className="mt-1 text-sm font-medium opacity-90">peut exiger ce qu'il veut,</p>
                  <p className="text-sm font-medium opacity-90">quand il veut, où il veut.</p>
                  <p className="mt-2 text-xs opacity-75 italic">— sans limite de temps —</p>
                </div>
                <p className="mt-4 text-xs text-center text-gray-400">En tapant « J'accepte », vous consentez librement à jouer ensemble.</p>
              </div>
              <div className="mt-5 flex flex-col items-center gap-3">
                {!myAgreed ? (
                  <button onClick={agree} className="rounded-full bg-gradient-to-br from-pink-500 to-rose-600 px-10 py-4 text-lg font-bold text-white shadow-lg shadow-pink-200 transition active:scale-95">
                    💕 J'accepte !
                  </button>
                ) : (
                  <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-6 py-3">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-600">Tu as accepté !</span>
                  </div>
                )}
                <p className="text-sm text-center">
                  {partnerAgreed
                    ? <span className="font-medium text-emerald-500">✓ {theirName} a accepté !</span>
                    : <span className="text-gray-400 animate-pulse">En attente de {theirName}…</span>}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Victory screen ── */}
      <AnimatePresence>
        {phase === "victory" && winner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-100 px-6 py-10">
            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", duration: 0.7 }}>
              <p className="text-center text-9xl">👑</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-4 text-center w-full max-w-sm">
              <h1 className="text-4xl font-bold text-gray-800">{winner === 1 ? player1 : player2} gagne !</h1>
              <div className="mt-5 rounded-3xl bg-white px-8 py-6 shadow-xl text-center">
                <p className="text-base font-semibold text-gray-500 uppercase tracking-wider">🏆 Ton cadeau</p>
                <p className="mt-3 text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-pink-500 to-rose-600 leading-tight">Tu exiges ce que tu veux,</p>
                <p className="text-2xl font-extrabold text-gray-700">quand tu veux,</p>
                <p className="text-2xl font-extrabold text-gray-700">où tu veux. 😈</p>
                <p className="mt-3 text-sm text-gray-400 italic">— sans limite de temps —</p>
              </div>
              <div className="mt-4 flex items-center justify-center gap-6 rounded-2xl bg-white/80 px-6 py-3 shadow">
                <div className="text-center"><p className="text-xs text-gray-400">{player1}</p><p className="text-2xl font-bold text-rose-500">{scores[0]}</p></div>
                <Trophy className="h-5 w-5 text-amber-400" />
                <div className="text-center"><p className="text-xs text-gray-400">{player2}</p><p className="text-2xl font-bold text-purple-500">{scores[1]}</p></div>
              </div>
              <button onClick={restart} className="mt-6 flex items-center gap-2 rounded-full bg-gray-900 px-8 py-4 text-base font-semibold text-white shadow transition active:scale-95 mx-auto">
                <RotateCcw className="h-4 w-4" /> Nouvelle partie
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
