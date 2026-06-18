import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronRight, Check, X, RotateCcw, Trophy, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = {
  id: string; emoji: string; label: string; subtitle: string;
  color: string; glowColor: string; darkGrad: string;
  challenges: string[]; timerSeconds: number;
};
type Phase = "agreement" | "idle" | "spinning" | "reveal" | "challenge" | "result" | "victory";

// ── Categories ────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  {
    id: "provocation", emoji: "🔥", label: "Provocation",
    subtitle: "Tu tentes… l'autre résiste",
    color: "#ff4560", glowColor: "rgba(255,69,96,0.5)", darkGrad: "linear-gradient(135deg,#7f1d1d 0%,#3b0a0a 100%)",
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
    subtitle: "Les yeux bandés, le reste suit",
    color: "#8b5cf6", glowColor: "rgba(139,92,246,0.5)", darkGrad: "linear-gradient(135deg,#4c1d95 0%,#1e0a4a 100%)",
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
      "Les yeux bandés : ton/ta partenaire choisit une partie du corps, toi tu choisis comment l'explorer.",
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
    subtitle: "Créativité et complicité",
    color: "#f59e0b", glowColor: "rgba(245,158,11,0.5)", darkGrad: "linear-gradient(135deg,#78350f 0%,#2d1500 100%)",
    timerSeconds: 120,
    challenges: [
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
    subtitle: "30 secondes pour réussir",
    color: "#10b981", glowColor: "rgba(16,185,129,0.5)", darkGrad: "linear-gradient(135deg,#064e3b 0%,#012820 100%)",
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
    subtitle: "L'un donne, l'autre reçoit",
    color: "#ec4899", glowColor: "rgba(236,72,153,0.5)", darkGrad: "linear-gradient(135deg,#831843 0%,#3b0a22 100%)",
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

// ── Wheel math ────────────────────────────────────────────────────────────────

const N = CATEGORIES.length;
const SEG = 360 / N;
const CX = 150; const CY = 150; const R = 136;

function segPath(i: number): string {
  const s = ((i * SEG - 90) * Math.PI) / 180;
  const e = (((i + 1) * SEG - 90) * Math.PI) / 180;
  const x1 = CX + R * Math.cos(s); const y1 = CY + R * Math.sin(s);
  const x2 = CX + R * Math.cos(e); const y2 = CY + R * Math.sin(e);
  return `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}
function emojiPos(i: number) {
  const mid = (((i + 0.5) * SEG - 90) * Math.PI) / 180;
  const d = R * 0.62;
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

// ── Timer circle ──────────────────────────────────────────────────────────────

const CIRC_R = 46;
const CIRC = 2 * Math.PI * CIRC_R;

function TimerCircle({ total, left, color, glowColor }: { total: number; left: number; color: string; glowColor: string }) {
  const pct = total > 0 ? left / total : 0;
  const dash = pct * CIRC;
  const urgent = left <= 5 && left > 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={120} height={120} viewBox="0 0 120 120">
        <defs>
          <filter id="arc-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx={60} cy={60} r={CIRC_R} stroke="rgba(255,255,255,0.08)" strokeWidth={9} fill="none" />
        {/* Glow halo */}
        <circle cx={60} cy={60} r={CIRC_R} stroke={urgent ? "#ef4444" : glowColor} strokeWidth={14} fill="none"
          strokeDasharray={`${dash.toFixed(2)} ${CIRC.toFixed(2)}`} strokeLinecap="round"
          transform="rotate(-90 60 60)" opacity={0.25}
          style={{ transition: "stroke-dasharray 1s linear, stroke 0.3s" }} />
        {/* Arc */}
        <circle cx={60} cy={60} r={CIRC_R} stroke={urgent ? "#ef4444" : color} strokeWidth={9} fill="none"
          strokeDasharray={`${dash.toFixed(2)} ${CIRC.toFixed(2)}`} strokeLinecap="round"
          transform="rotate(-90 60 60)" filter="url(#arc-glow)"
          style={{ transition: "stroke-dasharray 1s linear, stroke 0.3s" }} />
        {/* Number */}
        <text x={60} y={60} dominantBaseline="middle" textAnchor="middle"
          fontSize={urgent ? 30 : 26} fontWeight="800" fill={urgent ? "#ef4444" : "white"}>{left}</text>
      </svg>
      <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>secondes</p>
    </div>
  );
}

// ── useTimer ──────────────────────────────────────────────────────────────────

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
  function stop() { setRunning(false); if (intervalRef.current) clearInterval(intervalRef.current); }
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

// ── Background orbs ───────────────────────────────────────────────────────────

function Orbs() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" style={{ background: "#0b0714" }}>
      <motion.div animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", top: "-20%", left: "-15%", width: 350, height: 350, borderRadius: "50%",
          background: "radial-gradient(circle, #f43f5e 0%, transparent 70%)" }} />
      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.25, 0.4, 0.25] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        style={{ position: "absolute", bottom: "-20%", right: "-15%", width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, #a855f7 0%, transparent 70%)" }} />
      <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        style={{ position: "absolute", top: "40%", left: "30%", width: 260, height: 260, borderRadius: "50%",
          background: "radial-gradient(circle, #ec4899 0%, transparent 70%)" }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface RouletteIRLProps {
  player1: string; player2: string;
  mySlot: 1 | 2; coupleId: string;
  onBack: () => void;
}

export function RouletteIRL({ player1, player2, mySlot, coupleId, onBack }: RouletteIRLProps) {
  const [phase,        setPhase]        = useState<Phase>("agreement");
  const [turn,         setTurn]         = useState<1 | 2>(1);
  const [rotation,     setRotation]     = useState(0);
  const [cat,          setCat]          = useState<Category | null>(null);
  const [challenge,    setChallenge]    = useState("");
  const [scores,       setScores]       = useState<[number, number]>([0, 0]);
  const [success,      setSuccess]      = useState<boolean | null>(null);
  const [timerDone,    setTimerDone]    = useState(false);
  const [connected,    setConnected]    = useState(false);
  const [myAgreed,     setMyAgreed]     = useState(false);
  const [partnerAgreed,setPartnerAgreed]= useState(false);
  const [winner,       setWinner]       = useState<1 | 2 | null>(null);

  const channelRef    = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const queuesRef     = useRef<Record<string, string[]>>({});
  const processingRef = useRef(false);

  const isMyTurn    = turn === mySlot;
  const currentName = turn === 1 ? player1 : player2;
  const otherName   = turn === 1 ? player2 : player1;
  const theirName   = mySlot === 1 ? player2 : player1;

  const timer = useTimer(() => setTimerDone(true));

  function nextChallenge(catId: string, challenges: string[]): string {
    if (!queuesRef.current[catId] || queuesRef.current[catId].length === 0) {
      queuesRef.current[catId] = shuffle([...challenges]);
    }
    return queuesRef.current[catId].pop()!;
  }

  useEffect(() => {
    const ch = supabase.channel(`roulette:${coupleId}`, { config: { broadcast: { self: false } } });
    ch
      .on("broadcast", { event: "spin" }, ({ payload }: { payload: { catId: string; challenge: string; rotation: number } }) => {
        const found = CATEGORIES.find((c) => c.id === payload.catId) ?? null;
        setCat(found); setChallenge(payload.challenge); setRotation(payload.rotation); setTimerDone(false);
        setPhase("spinning"); setTimeout(() => setPhase("reveal"), 4300);
      })
      .on("broadcast", { event: "start_challenge" }, ({ payload }: { payload: { seconds: number } }) => {
        setTimerDone(false); setPhase("challenge"); timer.start(payload.seconds);
      })
      .on("broadcast", { event: "result" }, ({ payload }: { payload: { success: boolean; slot: number } }) => {
        if (processingRef.current) return; processingRef.current = true;
        setSuccess(payload.success);
        if (payload.success) setScores((s) => { const n: [number,number]=[s[0],s[1]]; n[payload.slot-1]++; return n; });
        setPhase("result"); setTimeout(() => { processingRef.current = false; }, 500);
      })
      .on("broadcast", { event: "next" }, ({ payload }: { payload: { nextTurn: 1 | 2 } }) => {
        setTurn(payload.nextTurn); setCat(null); setChallenge(""); setTimerDone(false); setSuccess(null); setPhase("idle");
      })
      .on("broadcast", { event: "agreed" }, () => { setPartnerAgreed(true); })
      .on("broadcast", { event: "victory" }, ({ payload }: { payload: { winner: 1|2; newScores: [number,number] } }) => {
        if (processingRef.current) return; processingRef.current = true;
        setScores(payload.newScores); setWinner(payload.winner); setPhase("victory");
        setTimeout(() => { processingRef.current = false; }, 500);
      })
      .on("broadcast", { event: "restart" }, () => {
        setScores([0,0]); setWinner(null); setTurn(1); setCat(null); setChallenge("");
        setTimerDone(false); setSuccess(null); setPhase("idle");
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
    if (processingRef.current) return; processingRef.current = true;
    channelRef.current?.send({ type: "broadcast", event: "restart", payload: {} });
    setScores([0,0]); setWinner(null); setTurn(1); setCat(null); setChallenge("");
    setTimerDone(false); setSuccess(null); setPhase("idle");
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
    setPhase("spinning"); setTimeout(() => setPhase("reveal"), 4300);
  }

  function startChallenge() {
    if (!isMyTurn || !cat) return;
    channelRef.current?.send({ type: "broadcast", event: "start_challenge", payload: { seconds: cat.timerSeconds } });
    setTimerDone(false); setPhase("challenge"); timer.start(cat.timerSeconds);
  }

  function handleResult(won: boolean) {
    if (processingRef.current) return; processingRef.current = true;
    timer.stop();
    const newScores: [number,number] = [scores[0], scores[1]];
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

  // ─── Glass card helper ───────────────────────────────────────────────────────
  const glassCard: React.CSSProperties = {
    background: "rgba(255,255,255,0.07)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 24,
  };

  // ─── Score dots row ──────────────────────────────────────────────────────────
  function ScoreDots({ score, color }: { score: number; color: string }) {
    return (
      <div className="flex gap-[3px]">
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.div key={i}
            animate={{ scale: i === score - 1 ? [1, 1.5, 1] : 1 }}
            transition={{ duration: 0.4 }}
            style={{ width: 7, height: 7, borderRadius: "50%",
              background: i < score ? color : "rgba(255,255,255,0.18)",
              boxShadow: i < score ? `0 0 6px ${color}` : "none",
              transition: "background 0.3s, box-shadow 0.3s" }} />
        ))}
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <Orbs />

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(11,7,20,0.75)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <button onClick={onBack}
          className="flex items-center gap-1 transition active:scale-95"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 99, padding: "6px 14px", color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500 }}>
          <ArrowLeft className="h-3.5 w-3.5" /> Retour
        </button>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <span style={{ color: "#f43f5e", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>{player1}</span>
            <ScoreDots score={scores[0]} color="#f43f5e" />
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{scores[0]}/10</span>
          </div>
          <Trophy className="h-4 w-4" style={{ color: "#fbbf24", filter: "drop-shadow(0 0 6px #fbbf24)" }} />
          <div className="flex flex-col items-center gap-1">
            <span style={{ color: "#a855f7", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>{player2}</span>
            <ScoreDots score={scores[1]} color="#a855f7" />
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{scores[1]}/10</span>
          </div>
        </div>

        <div title={connected ? "Synchronisé" : "Connexion…"}>
          {connected
            ? <Wifi className="h-4 w-4" style={{ color: "#10b981", filter: "drop-shadow(0 0 4px #10b981)" }} />
            : <WifiOff className="h-4 w-4 animate-pulse" style={{ color: "rgba(255,255,255,0.25)" }} />}
        </div>
      </div>

      {/* ── Turn indicator ────────────────────────────────────────────────────── */}
      <motion.div key={turn} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="px-4 pt-4 text-center">
        <span style={{ ...glassCard, display: "inline-block", padding: "7px 20px",
          fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", borderRadius: 99 }}>
          {isMyTurn ? "✨ C'est ton tour !" : `⏳ Tour de ${currentName}`}
        </span>
      </motion.div>

      {/* ── Wheel ─────────────────────────────────────────────────────────────── */}
      <div className="relative mx-auto mt-5 flex items-center justify-center" style={{ width: 320, height: 320 }}>
        {/* Glow ring behind wheel */}
        <motion.div animate={{ opacity: phase === "spinning" ? [0.4, 0.8, 0.4] : 0.25 }}
          transition={{ duration: 1.2, repeat: phase === "spinning" ? Infinity : 0 }}
          style={{ position: "absolute", inset: 4, borderRadius: "50%",
            background: "conic-gradient(#ff4560,#8b5cf6,#f59e0b,#10b981,#ec4899,#ff4560)",
            filter: "blur(18px)", zIndex: 0 }} />

        {/* Pointer */}
        <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", zIndex: 20, textAlign: "center" }}>
          <div style={{ width: 0, height: 0,
            borderLeft: "12px solid transparent", borderRight: "12px solid transparent",
            borderTop: "28px solid #fbbf24", margin: "0 auto",
            filter: "drop-shadow(0 0 8px rgba(251,191,36,0.9))" }} />
        </div>

        <motion.svg width={304} height={304} viewBox="0 0 300 300"
          animate={{ rotate: rotation }}
          transition={{ duration: 4, ease: [0.15, 0.85, 0.35, 1.0] }}
          style={{ originX: "50%", originY: "50%", position: "relative", zIndex: 10 }}>
          <defs>
            {/* Outer segment highlight overlay */}
            <radialGradient id="seg-shine" cx="50%" cy="0%" r="80%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            {/* Center hub gradient */}
            <radialGradient id="hub-gold" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#92400e" />
            </radialGradient>
          </defs>

          {/* Outer decorative ring */}
          <circle cx={CX} cy={CY} r={148} stroke="rgba(255,255,255,0.06)" strokeWidth={3} fill="none" />
          <circle cx={CX} cy={CY} r={143} stroke="rgba(255,255,255,0.12)" strokeWidth={1} fill="none" />

          {/* Segments */}
          {CATEGORIES.map((c, i) => {
            const pos = emojiPos(i);
            return (
              <g key={c.id}>
                <path d={segPath(i)} fill={c.color} stroke="rgba(0,0,0,0.5)" strokeWidth={2} />
                {/* Shine overlay */}
                <path d={segPath(i)} fill="url(#seg-shine)" />
                {/* Emoji */}
                <text x={pos.x} y={pos.y} fontSize={26} textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${pos.rotate}, ${pos.x}, ${pos.y})`}
                  style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>{c.emoji}</text>
              </g>
            );
          })}

          {/* Inner shadow ring */}
          <circle cx={CX} cy={CY} r={30} fill="rgba(0,0,0,0.3)" />
          {/* Hub */}
          <circle cx={CX} cy={CY} r={26} fill="url(#hub-gold)" />
          <circle cx={CX} cy={CY} r={26} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} fill="none" />
          <text x={CX} y={CY} fontSize={16} textAnchor="middle" dominantBaseline="middle">💕</text>
        </motion.svg>
      </div>

      {/* ── Idle / Spinning states ────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="mt-6 flex flex-col items-center gap-3">
            {isMyTurn ? (
              <div className="relative">
                {/* Pulse rings */}
                <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  style={{ position: "absolute", inset: -16, borderRadius: 999, border: "2px solid rgba(244,63,94,0.5)" }} />
                <motion.div animate={{ scale: [1, 1.8, 1], opacity: [0.2, 0, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
                  style={{ position: "absolute", inset: -16, borderRadius: 999, border: "2px solid rgba(168,85,247,0.4)" }} />
                <button onClick={spin}
                  style={{ background: "linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #a855f7 100%)",
                    boxShadow: "0 0 32px rgba(244,63,94,0.5), 0 0 64px rgba(168,85,247,0.25)",
                    borderRadius: 999, padding: "18px 44px", fontSize: 18, fontWeight: 800, color: "white",
                    border: "1px solid rgba(255,255,255,0.2)", letterSpacing: 0.5, position: "relative" }}
                  className="transition active:scale-95">
                  🎰 Lancer la roue
                </button>
              </div>
            ) : (
              <p className="animate-pulse text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                En attente que {currentName} lance…
              </p>
            )}
          </motion.div>
        )}
        {phase === "spinning" && (
          <motion.p key="spinning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mt-6 text-center text-sm tracking-widest uppercase animate-pulse"
            style={{ color: "rgba(255,255,255,0.5)" }}>
            ✨ La roue tourne…
          </motion.p>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── REVEAL screen ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "reveal" && cat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden px-6"
            style={{ background: cat.darkGrad }}>
            {/* Ambient glow */}
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 40%, ${cat.glowColor}, transparent 70%)` }} />

            <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="relative z-10 text-center">
              <motion.p className="text-[96px] leading-none"
                animate={{ y: [0, -10, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}>
                {cat.emoji}
              </motion.p>
              <h2 className="mt-4 text-5xl font-black tracking-tight text-white"
                style={{ textShadow: `0 0 30px ${cat.glowColor}, 0 0 60px ${cat.glowColor}` }}>
                {cat.label}
              </h2>
              <p className="mt-2 text-base" style={{ color: "rgba(255,255,255,0.65)" }}>{cat.subtitle}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
              className="relative z-10 mt-8 text-center">
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Le défi de</p>
              <p className="text-2xl font-bold text-white">{currentName}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
              className="relative z-10 mt-8">
              {isMyTurn ? (
                <button onClick={startChallenge}
                  className="flex items-center gap-2 transition active:scale-95"
                  style={{ ...glassCard, padding: "14px 32px", fontSize: 16, fontWeight: 700, color: "white",
                    boxShadow: `0 0 20px ${cat.glowColor}` }}>
                  Voir le défi <ChevronRight className="h-5 w-5" />
                </button>
              ) : (
                <p style={{ ...glassCard, padding: "12px 24px", fontSize: 14, color: "rgba(255,255,255,0.65)" }}>
                  En attente de {currentName}…
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CHALLENGE screen ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "challenge" && cat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex flex-col overflow-y-auto px-5 pb-10"
            style={{ background: "#0b0714" }}>
            {/* Ambient glow top */}
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 200,
              background: `radial-gradient(ellipse at 50% 0%, ${cat.glowColor}, transparent 70%)`, zIndex: 0 }} />

            <div className="relative z-10 mx-auto mt-10 w-full max-w-sm">
              {/* Category pill */}
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="mx-auto mb-5 inline-flex items-center gap-2"
                style={{ background: cat.color, borderRadius: 99, padding: "7px 18px",
                  fontSize: 13, fontWeight: 700, color: "white", boxShadow: `0 0 16px ${cat.glowColor}` }}>
                {cat.emoji} {cat.label}
              </motion.div>

              {/* Challenge card */}
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
                style={{ ...glassCard, padding: 28,
                  boxShadow: `0 0 0 1px ${cat.color}40, 0 0 40px ${cat.glowColor}30, inset 0 0 30px rgba(255,255,255,0.02)` }}>
                <p className="text-center text-lg font-medium leading-relaxed text-white">{challenge}</p>
              </motion.div>

              {/* Players row */}
              <p className="mt-3 text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                <span style={{ color: cat.color, fontWeight: 600 }}>{currentName}</span>
                {" → "}
                <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{otherName}</span>
              </p>

              {/* Timer */}
              <div className="mt-6 flex justify-center">
                <TimerCircle total={timer.total} left={timer.left} color={cat.color} glowColor={cat.glowColor} />
              </div>

              {timerDone && (
                <motion.p initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  className="mt-2 text-center text-sm font-bold"
                  style={{ color: "#ef4444", textShadow: "0 0 12px rgba(239,68,68,0.7)" }}>
                  ⏰ Temps écoulé !
                </motion.p>
              )}

              {/* Result buttons */}
              <div className="mt-6 flex gap-3">
                <button onClick={() => handleResult(false)}
                  className="flex flex-1 items-center justify-center gap-2 transition active:scale-95"
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)",
                    borderRadius: 20, padding: "16px 0", color: "#f87171", fontWeight: 700, fontSize: 15,
                    boxShadow: "0 0 20px rgba(239,68,68,0.1)" }}>
                  <X className="h-4 w-4" /> Forfait
                </button>
                <button onClick={() => handleResult(true)}
                  className="flex flex-1 items-center justify-center gap-2 transition active:scale-95"
                  style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)",
                    borderRadius: 20, padding: "16px 0", color: "#34d399", fontWeight: 700, fontSize: 15,
                    boxShadow: "0 0 20px rgba(16,185,129,0.1)" }}>
                  <Check className="h-4 w-4" /> Réussi !
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RESULT screen ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "result" && cat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
            style={{ background: "#0b0714" }}>
            {/* Ambient */}
            <div style={{ position: "absolute", inset: 0,
              background: success
                ? "radial-gradient(circle at 50% 40%, rgba(16,185,129,0.2), transparent 65%)"
                : "radial-gradient(circle at 50% 40%, rgba(239,68,68,0.18), transparent 65%)" }} />

            <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 14 }} className="relative z-10 text-center">
              <motion.p className="text-8xl leading-none"
                animate={{ rotate: success ? [0, -5, 5, -3, 3, 0] : [0, -3, 3, 0] }}
                transition={{ duration: 0.6, delay: 0.2 }}>
                {success ? "🎉" : "💔"}
              </motion.p>
              <h2 className="mt-4 text-3xl font-black"
                style={{ color: success ? "#34d399" : "#f87171",
                  textShadow: success ? "0 0 24px rgba(52,211,153,0.6)" : "0 0 24px rgba(248,113,113,0.6)" }}>
                {success ? "Défi relevé !" : "Forfait !"}
              </h2>
              <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                {success ? `+1 point pour ${currentName} 💕` : `${currentName} a craqué… 😏`}
              </p>
            </motion.div>

            {/* Score panel */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="relative z-10 mt-8 flex items-center gap-8 px-8 py-5"
              style={{ ...glassCard }}>
              <div className="text-center">
                <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>{player1}</p>
                <p className="mt-1 text-4xl font-black" style={{ color: "#f43f5e", textShadow: "0 0 16px rgba(244,63,94,0.5)" }}>{scores[0]}</p>
              </div>
              <Trophy className="h-6 w-6" style={{ color: "#fbbf24", filter: "drop-shadow(0 0 8px #fbbf24)" }} />
              <div className="text-center">
                <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>{player2}</p>
                <p className="mt-1 text-4xl font-black" style={{ color: "#a855f7", textShadow: "0 0 16px rgba(168,85,247,0.5)" }}>{scores[1]}</p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              className="relative z-10 mt-6">
              {isMyTurn ? (
                <button onClick={next}
                  className="flex items-center gap-2 transition active:scale-95"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 999, padding: "14px 32px", color: "white", fontWeight: 600, fontSize: 15 }}>
                  <RotateCcw className="h-4 w-4" /> Tour de {otherName}
                </button>
              ) : (
                <p className="animate-pulse text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                  En attente de {currentName}…
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AGREEMENT screen ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "agreement" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto px-5 py-10"
            style={{ background: "#0b0714" }}>
            {/* Orbs */}
            <div style={{ position: "absolute", top: "-10%", left: "-10%", width: 300, height: 300, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(244,63,94,0.4) 0%, transparent 70%)", filter: "blur(40px)" }} />
            <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: 300, height: 300, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(168,85,247,0.35) 0%, transparent 70%)", filter: "blur(40px)" }} />

            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", duration: 0.7 }} className="relative z-10 w-full max-w-sm">

              {/* Title */}
              <div className="text-center mb-6">
                <motion.p className="text-7xl" animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}>💋</motion.p>
                <h1 className="mt-3 text-3xl font-black text-white" style={{ letterSpacing: -0.5 }}>Roulette Coquine</h1>
                <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Un jeu de complicité & désir</p>
              </div>

              {/* Rules card */}
              <div style={{ ...glassCard, padding: 24 }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>Règles du jeu</p>

                <div className="space-y-3">
                  <div className="flex gap-3 items-start">
                    <span className="text-xl">🎰</span>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                      Chacun lance la roue à tour de rôle. Elle désigne une catégorie et un défi à relever.
                    </p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <span className="text-xl">✅</span>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                      Réussir le défi = <span style={{ color: "#34d399", fontWeight: 700 }}>+1 point</span>. Échouer = pas de point.
                    </p>
                  </div>
                </div>

                {/* Prize box */}
                <div className="mt-5 rounded-2xl p-4 text-center"
                  style={{ background: "linear-gradient(135deg, rgba(244,63,94,0.25), rgba(168,85,247,0.25))",
                    border: "1px solid rgba(244,63,94,0.3)", boxShadow: "0 0 20px rgba(244,63,94,0.15)" }}>
                  <p className="text-xl font-black text-white">🏆 Premier à 10 points</p>
                  <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                    peut exiger ce qu'il veut,<br />quand il veut, où il veut.
                  </p>
                  <p className="mt-2 text-xs italic" style={{ color: "rgba(255,255,255,0.4)" }}>— sans limite de temps —</p>
                </div>

                <p className="mt-4 text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  En appuyant sur « J'accepte » vous consentez librement à jouer ensemble.
                </p>
              </div>

              {/* Accept buttons */}
              <div className="mt-6 flex flex-col items-center gap-3">
                {!myAgreed ? (
                  <button onClick={agree}
                    className="transition active:scale-95"
                    style={{ background: "linear-gradient(135deg, #f43f5e, #ec4899, #a855f7)",
                      borderRadius: 999, padding: "16px 44px", fontSize: 17, fontWeight: 800, color: "white",
                      boxShadow: "0 0 30px rgba(244,63,94,0.5), 0 0 60px rgba(168,85,247,0.2)",
                      border: "1px solid rgba(255,255,255,0.2)" }}>
                    💕 J'accepte !
                  </button>
                ) : (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    className="flex items-center gap-2"
                    style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)",
                      borderRadius: 999, padding: "12px 24px" }}>
                    <Check className="h-4 w-4" style={{ color: "#34d399" }} />
                    <span className="text-sm font-semibold" style={{ color: "#34d399" }}>Tu as accepté !</span>
                  </motion.div>
                )}
                <p className="text-sm text-center">
                  {partnerAgreed
                    ? <motion.span initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="font-semibold" style={{ color: "#34d399" }}>
                        ✓ {theirName} a accepté !
                      </motion.span>
                    : <span className="animate-pulse" style={{ color: "rgba(255,255,255,0.35)" }}>
                        En attente de {theirName}…
                      </span>}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── VICTORY screen ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "victory" && winner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto px-6 py-10"
            style={{ background: "linear-gradient(160deg, #1a0e00 0%, #0b0714 50%, #0d0c00 100%)" }}>
            {/* Gold orb */}
            <div style={{ position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)",
              width: 360, height: 360, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(251,191,36,0.25) 0%, transparent 70%)", filter: "blur(30px)" }} />

            <div className="relative z-10 w-full max-w-sm text-center">
              {/* Crown */}
              <motion.p className="text-9xl leading-none"
                initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 160, damping: 12 }}>
                👑
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                <h1 className="mt-4 text-4xl font-black text-white" style={{ letterSpacing: -1 }}>
                  {winner === 1 ? player1 : player2} gagne !
                </h1>
                <p className="mt-1 text-sm" style={{ color: "rgba(251,191,36,0.7)" }}>
                  {scores[winner - 1]}/10 défis remportés
                </p>
              </motion.div>

              {/* Prize card */}
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}
                className="mt-6"
                style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.08))",
                  border: "1px solid rgba(251,191,36,0.25)", borderRadius: 28, padding: "28px 24px",
                  boxShadow: "0 0 40px rgba(251,191,36,0.15), inset 0 0 30px rgba(251,191,36,0.05)" }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(251,191,36,0.6)" }}>🏆 Ton cadeau</p>
                <p className="text-2xl font-black" style={{ color: "#fde68a", textShadow: "0 0 20px rgba(251,191,36,0.5)" }}>
                  Tu exiges ce que tu veux,
                </p>
                <p className="text-2xl font-black text-white">quand tu veux,</p>
                <p className="text-2xl font-black text-white">où tu veux. 😈</p>
                <p className="mt-3 text-xs italic" style={{ color: "rgba(255,255,255,0.3)" }}>— sans limite de temps —</p>
              </motion.div>

              {/* Final scores */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }}
                className="mt-5 flex items-center justify-center gap-8 py-4 px-6"
                style={{ ...glassCard }}>
                <div className="text-center">
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{player1}</p>
                  <p className="text-3xl font-black mt-0.5" style={{ color: "#f43f5e" }}>{scores[0]}</p>
                </div>
                <Trophy className="h-5 w-5" style={{ color: "#fbbf24", filter: "drop-shadow(0 0 8px #fbbf24)" }} />
                <div className="text-center">
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{player2}</p>
                  <p className="text-3xl font-black mt-0.5" style={{ color: "#a855f7" }}>{scores[1]}</p>
                </div>
              </motion.div>

              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                onClick={restart}
                className="mt-6 flex items-center gap-2 transition active:scale-95 mx-auto"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 999, padding: "14px 32px", color: "white", fontWeight: 600, fontSize: 15 }}>
                <RotateCcw className="h-4 w-4" /> Nouvelle partie
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
