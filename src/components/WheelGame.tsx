import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { Room } from "@/lib/use-room-state";

const supabase = _supabase as any;

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG     = "linear-gradient(160deg, oklch(0.10 0.07 260) 0%, oklch(0.07 0.04 250) 100%)";
const SERIF  = "'Cormorant Garamond', Georgia, serif";
const ROSE   = "#f43f5e";
const AMBER  = "#fbbf24";
const EMERALD= "#4ade80";
const SKY    = "#38bdf8";
const VIOLET = "#a78bfa";
const TEAL   = "#2dd4bf";
const ORANGE = "#fb923c";
const GOLD   = "#fbbf24";

const glass: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 20,
};

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "bisou",     emoji: "💋", label: "Bisou",           color: ROSE,    timer: 20, pts: 10 },
  { id: "imitation", emoji: "🎭", label: "Imitation",       color: AMBER,   timer: 40, pts: 10 },
  { id: "question",  emoji: "💬", label: "Question Vérité", color: SKY,     timer: 60, pts: 10 },
  { id: "physique",  emoji: "💪", label: "Défi Physique",   color: EMERALD, timer: 35, pts: 10 },
  { id: "creatif",   emoji: "🎨", label: "Créatif",         color: VIOLET,  timer: 60, pts: 10 },
  { id: "gage",      emoji: "🃏", label: "Gage Surprise",   color: ORANGE,  timer: 0,  pts: 10 },
  { id: "precision", emoji: "🎯", label: "Précision",       color: TEAL,    timer: 45, pts: 10 },
  { id: "foudre",    emoji: "⚡", label: "Coup de Foudre",  color: GOLD,    timer: 45, pts: 20 },
] as const;

type CategoryId = typeof CATEGORIES[number]["id"];
const N   = CATEGORIES.length;
const SEG = 360 / N;
const TOTAL_ROUNDS = 8;

// ── Challenges ────────────────────────────────────────────────────────────────
const CHALLENGES: Record<CategoryId, string[]> = {
  bisou: [
    "Bisou papillon : colle tes cils à la joue de l'autre les yeux fermés — doux et lent 🦋",
    "Bisou dans la paume de la main — l'autre ferme les yeux et garde la main ouverte",
    "Bisou eskimo — nez contre nez pendant 5 secondes sans bouger 🥰",
    "Embrasse le bout du nez de l'autre 3 fois de suite, sans te presser",
    "Pose tes lèvres sur le front de l'autre et tiens 5 secondes, en silence",
    "Un bisou derrière l'oreille — le plus doux et lent que tu puisses donner",
    "Un bisou sur chaque paupière fermée — l'autre ne bouge pas",
  ],
  imitation: [
    "Rejoue notre première rencontre en 30 secondes — du début jusqu'à 'bonjour' 🎬",
    "Fais la pub de ton partenaire comme un produit à vendre — 30 secondes chronos",
    "Imite comment l'autre fait la tête quand il/elle se lève le matin 😂",
    "Raconte un souvenir commun à la première personne — depuis le point de vue de l'autre",
    "Imite l'autre en train de commander au restaurant — gestes et voix inclus",
    "Rejoue votre échange de messages le plus drôle — joue les deux rôles",
    "Imite comment l'autre dit 'je t'aime' — sans vraiment le prononcer",
  ],
  question: [
    "Quel moment précis t'a fait réaliser que tu m'aimais vraiment ? Sois précis(e) ❤️",
    "Ce qui te fait peur dans l'amour — dis-le vraiment, sans filtre ni honte",
    "Qu'est-ce que tu n'aurais jamais cru qu'on ferait ensemble un jour ?",
    "Quel souvenir de nous deux tu garderais si tu ne pouvais en garder qu'un seul ?",
    "Qu'est-ce que tu voudrais me dire plus souvent mais tu n'oses pas encore ?",
    "Si tu pouvais revivre une seule journée avec moi, laquelle — et pourquoi ?",
    "Qu'est-ce qui te surprend encore chez moi après tout ce temps ?",
    "Si tu devais me décrire à un(e) inconnu(e) en 3 phrases, tu dirais quoi ?",
  ],
  physique: [
    "20 squats maintenant — ton partenaire compte à voix haute à ta place 💪",
    "Tiens en équilibre sur un pied, les bras en croix — 20 secondes sans trébucher",
    "10 jumping jacks aussi vite que tu peux — l'autre chronomètre",
    "5 pompes parfaites — dos plat, bras tendus jusqu'en haut",
    "Danse sans musique, comme personne ne te regarde — 20 secondes non-stop 🕺",
    "Tiens la planche 25 secondes — l'autre vérifie la forme",
    "Fais 5 tours sur toi-même, puis marche droit jusqu'à ton partenaire sans trébucher",
  ],
  creatif: [
    "Dessine le portrait de l'autre en 45 secondes — sans lever le crayon du papier 🎨",
    "Invente le titre de votre film d'amour + un pitch en une phrase — en 40 secondes",
    "Chante 20 secondes d'une chanson en remplaçant les mots clés par le prénom de l'autre 🎤",
    "Invente une blague sur votre couple — elle doit faire rire l'autre (il/elle juge)",
    "Crée votre devise de couple en 30 secondes — l'autre valide si ça vous ressemble",
    "Invente un surnom ultra original pour l'autre + justifie-le en 1 phrase mémorable",
    "Mime un souvenir commun sans un mot — l'autre doit deviner la scène exacte",
  ],
  gage: [
    "Ton partenaire choisit un objet dans la pièce — tu dois le complimenter sincèrement pendant 30 secondes 🃏",
    "Tu dois faire rire l'autre en 30 secondes — méthode entièrement libre",
    "Double enjeu : tire une 2ème fois. Réussis les deux = +20 pts. Échoues = 0 ⚡",
    "Échange de rôles : l'autre fait le PROCHAIN tour à ta place. Toi tu joues le jury",
    "Décris l'autre avec 5 emojis seulement — il/elle doit deviner ce que chacun représente",
    "Écris un SMS romantique improvisé de 3 lignes — l'autre juge si tu l'envoies ou pas",
  ],
  precision: [
    "Lance 5 fois une pièce en l'air et prédit pile ou face — 4/5 pour réussir 🎯",
    "Fais tenir un objet de la pièce en équilibre sur ta tête pendant 15 secondes",
    "Touche ton nez 10 fois les yeux fermés — zéro ratée autorisée",
    "Lance une boulette de papier dans une corbeille à 2m — 3 essais, 2/3 = réussi",
    "Attrape 5 fois de suite un objet lancé par l'autre — yeux à demi fermés",
    "Fais tenir un stylo en équilibre sur ton doigt tendu — 10 secondes sans bouger",
    "Bats des mains dans le dos 5 fois en alternant les deux mains, au rythme imposé par l'autre",
  ],
  foudre: [
    "Vous DEUX : dansez ensemble 30 secondes sur la chanson que TU choisis maintenant ⚡",
    "Faites un selfie dans la pose la plus inattendue — l'autre choisit la pose en 5 secondes",
    "Rejouez la scène la plus emblématique d'un film romantique — l'autre choisit le film",
    "Inventez un handshake de couple en 45 secondes — il doit être mémorisable et rejouable",
    "Vous deux : écrivez chacun 3 choses à faire ensemble cette année — comparez à voix haute",
    "Tour libre INTENSIFIÉ : l'autre invente un défi sur le moment. Tu as 10 secondes pour dire oui ou non 😈",
  ],
};

// ── Shuffle helper ─────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Picks that avoid repetition per session
const usedChallenges: Record<string, string[]> = {};
function pickChallenge(catId: CategoryId): string {
  const pool = CHALLENGES[catId];
  if (!usedChallenges[catId] || usedChallenges[catId].length >= pool.length) {
    usedChallenges[catId] = shuffle(pool);
  }
  return usedChallenges[catId].pop()!;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = "idle" | "spinning" | "reveal" | "challenge" | "voting" | "result" | "game_over";

type WheelState = {
  phase?: Phase;
  turn?: 1 | 2;
  round?: number;
  total_rotation?: number;
  category_idx?: number;
  challenge?: string;
  scores?: [number, number];
  skips?: [number, number];
  vote?: boolean | null;
};

interface Props {
  room: Room;
  mySlot: number;
  myName: string;
  otherName: string;
  onBackToMenu: () => void;
  onDareDone: () => void;
}

// ── Supabase ──────────────────────────────────────────────────────────────────
async function patchState(roomId: string, p: Partial<WheelState>) {
  await supabase.rpc("minigame_patch", { _room_id: roomId, _patch: p });
}

// ── useTimer ──────────────────────────────────────────────────────────────────
function useTimer() {
  const [left,  setLeft]  = useState(0);
  const [total, setTotal] = useState(0);
  const [done,  setDone]  = useState(false);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function start(seconds: number) {
    if (seconds <= 0) return;
    setTotal(seconds); setLeft(seconds); setDone(false);
    if (ivRef.current) clearInterval(ivRef.current);
    ivRef.current = setInterval(() => {
      setLeft(p => {
        if (p <= 1) { clearInterval(ivRef.current!); setDone(true); return 0; }
        return p - 1;
      });
    }, 1000);
  }
  function stop() { if (ivRef.current) clearInterval(ivRef.current); }
  useEffect(() => () => stop(), []);
  return { left, total, done, start, stop };
}

// ── TimerCircle ───────────────────────────────────────────────────────────────
const CIRC_R = 44;
const CIRC   = 2 * Math.PI * CIRC_R;

function TimerCircle({ total, left, color }: { total: number; left: number; color: string }) {
  if (total <= 0) return null;
  const pct   = total > 0 ? left / total : 0;
  const dash  = pct * CIRC;
  const urgnt = left <= 5 && left > 0;
  const col   = urgnt ? ROSE : left <= 15 ? AMBER : color;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={CIRC_R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7} />
        <motion.circle cx={55} cy={55} r={CIRC_R} fill="none" stroke={col} strokeWidth={7}
          strokeLinecap="round" transform="rotate(-90 55 55)"
          animate={{ strokeDasharray: `${dash} ${CIRC}` }}
          transition={{ duration: 0.85, ease: "linear" }}
          style={{ filter: `drop-shadow(0 0 5px ${col})` }} />
        <text x={55} y={55} textAnchor="middle" dominantBaseline="middle"
          fill={urgnt ? ROSE : "#fff"} fontSize={urgnt ? 30 : 26}
          fontWeight={700} fontFamily={SERIF}
          style={{ filter: urgnt ? `drop-shadow(0 0 8px ${ROSE})` : "none" }}>
          {left}
        </text>
      </svg>
    </div>
  );
}

// ── WheelSVG ─────────────────────────────────────────────────────────────────
const CX = 150, CY = 150, WR = 134;

function segPath(i: number): string {
  const s = ((i * SEG - 90) * Math.PI) / 180;
  const e = (((i + 1) * SEG - 90) * Math.PI) / 180;
  const x1 = CX + WR * Math.cos(s), y1 = CY + WR * Math.sin(s);
  const x2 = CX + WR * Math.cos(e), y2 = CY + WR * Math.sin(e);
  return `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${WR} ${WR} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}
function emojiPos(i: number) {
  const mid = ((i + 0.5) * SEG - 90) * Math.PI / 180;
  const d   = WR * 0.63;
  return { x: CX + d * Math.cos(mid), y: CY + d * Math.sin(mid), rot: (i + 0.5) * SEG };
}

function WheelSVG({ spinning, landingIdx }: { spinning: boolean; landingIdx: number }) {
  return (
    <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="wg-hub" cx="50%" cy="30%" r="70%">
          <stop offset="0%"   stopColor="#fde68a" />
          <stop offset="55%"  stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#78350f" />
        </radialGradient>
        <filter id="wg-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Outer ring */}
      <circle cx={CX} cy={CY} r={143} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
      <circle cx={CX} cy={CY} r={138} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={1.5} />

      {/* Segments */}
      {CATEGORIES.map((c, i) => {
        const { x, y, rot } = emojiPos(i);
        const isLanding = !spinning && i === landingIdx;
        return (
          <g key={c.id}>
            <path d={segPath(i)}
              fill={isLanding ? `${c.color}44` : `${c.color}22`}
              stroke={isLanding ? c.color : `${c.color}55`}
              strokeWidth={isLanding ? 2.5 : 1.5} />
            <text x={x.toFixed(2)} y={y.toFixed(2)}
              fontSize={isLanding ? 30 : 26}
              textAnchor="middle" dominantBaseline="middle"
              transform={`rotate(${rot}, ${x.toFixed(2)}, ${y.toFixed(2)})`}
              style={{ filter: `drop-shadow(0 0 ${isLanding ? 10 : 5}px ${c.color})` }}>
              {c.emoji}
            </text>
          </g>
        );
      })}

      {/* Inner shadow ring */}
      <circle cx={CX} cy={CY} r={32} fill="rgba(0,0,0,0.45)" />
      {/* Hub */}
      <circle cx={CX} cy={CY} r={28} fill="url(#wg-hub)" />
      <circle cx={CX} cy={CY} r={28} stroke="rgba(255,255,255,0.28)" strokeWidth={2} fill="none" />
      <text x={CX} y={CY} fontSize={17} textAnchor="middle" dominantBaseline="middle">🎡</text>
    </svg>
  );
}

// ── WheelGame ─────────────────────────────────────────────────────────────────
export function WheelGame({ room, mySlot, myName, otherName, onBackToMenu, onDareDone }: Props) {
  const raw       = (room.minigame_state ?? {}) as WheelState;
  const phase     = raw.phase            ?? "idle";
  const turn      = raw.turn             ?? 1;
  const round     = raw.round            ?? 1;
  const totalRot  = raw.total_rotation   ?? 0;
  const catIdx    = raw.category_idx     ?? 0;
  const challenge = raw.challenge        ?? "";
  const scores    = raw.scores           ?? [0, 0];
  const skips     = raw.skips            ?? [0, 0];
  const vote      = raw.vote;

  const isHost   = mySlot === 1;
  const isMyTurn = turn === mySlot;
  const myScore  = scores[mySlot - 1];
  const othScore = scores[mySlot === 1 ? 1 : 0];
  const cat      = CATEGORIES[catIdx];
  const myColor  = mySlot === 1 ? ROSE : SKY;
  const othColor = mySlot === 1 ? SKY  : ROSE;

  // Local wheel animation
  const [displayRot,  setDisplayRot]  = useState(totalRot);
  const [isSpinning,  setIsSpinning]  = useState(false);
  const prevTotRef    = useRef(totalRot);
  const confettiFired = useRef(false);
  const timer         = useTimer();

  // Init
  useEffect(() => {
    if (!isHost || raw.phase) return;
    void patchState(room.id, { phase: "idle", turn: 1, round: 1, total_rotation: 0, scores: [0, 0], skips: [0, 0], vote: null });
  }, [isHost, room.id, raw.phase]);

  // Wheel spin animation
  useEffect(() => {
    if (totalRot !== prevTotRef.current) {
      setIsSpinning(true);
      setDisplayRot(totalRot);
      prevTotRef.current = totalRot;
      const t = setTimeout(() => setIsSpinning(false), 4400);
      return () => clearTimeout(t);
    }
  }, [totalRot]);

  // spinning → reveal (only turn player patches)
  useEffect(() => {
    if (phase !== "spinning" || !isMyTurn) return;
    const t = setTimeout(() => void patchState(room.id, { phase: "reveal" }), 4400);
    return () => clearTimeout(t);
  }, [phase, isMyTurn, room.id]);

  // Timer start when challenge begins
  useEffect(() => {
    if (phase === "challenge" && isMyTurn && cat.timer > 0) {
      timer.start(cat.timer);
    }
    if (phase !== "challenge") timer.stop();
  }, [phase, cat.id]);

  // Confetti on win
  useEffect(() => {
    if (phase === "game_over" && !confettiFired.current) {
      confettiFired.current = true;
      const winnerIdx = scores[0] > scores[1] ? 0 : 1;
      if (winnerIdx === mySlot - 1) {
        confetti({ particleCount: 160, spread: 100, origin: { y: 0.45 }, colors: [ROSE, AMBER, EMERALD, SKY, VIOLET] });
      }
    }
  }, [phase]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function spin() {
    if (!isMyTurn || phase !== "idle" || isSpinning) return;
    const idx     = Math.floor(Math.random() * N);
    const chosen  = CATEGORIES[idx];
    const ch      = pickChallenge(chosen.id);
    // Land segment idx under pointer (top): rotate so that segment idx faces up
    const baseOff = ((N - idx) % N) * SEG + SEG / 2;
    const jitter  = (Math.random() - 0.5) * SEG * 0.65;
    const newTotal = totalRot + 1800 + baseOff + jitter;
    await patchState(room.id, { phase: "spinning", total_rotation: newTotal, category_idx: idx, challenge: ch, vote: null });
  }

  async function startChallenge() {
    if (!isMyTurn) return;
    await patchState(room.id, { phase: "challenge" });
  }

  async function submitDone() {
    if (!isMyTurn) return;
    timer.stop();
    await patchState(room.id, { phase: "voting" });
  }

  async function castVote(won: boolean) {
    if (isMyTurn) return; // only partner votes
    const newScores: [number, number] = [scores[0], scores[1]];
    const doerIdx  = turn - 1;
    const judgeIdx = turn === 1 ? 1 : 0;
    if (won) {
      newScores[doerIdx] += cat.pts;
    } else {
      newScores[judgeIdx] += 5;
    }
    const nextRound = round + 1;
    if (nextRound > TOTAL_ROUNDS) {
      await patchState(room.id, { phase: "game_over", scores: newScores, vote: won });
    } else {
      await patchState(room.id, { phase: "result", scores: newScores, vote: won });
    }
  }

  async function next() {
    if (!isMyTurn) return;
    const nextTurn: 1 | 2 = turn === 1 ? 2 : 1;
    await patchState(room.id, { phase: "idle", turn: nextTurn, round: round + 1, vote: null });
  }

  async function skipChallenge() {
    if (!isMyTurn || (skips[mySlot - 1] ?? 0) >= 1) return;
    timer.stop();
    const newScores: [number, number] = [scores[0], scores[1]];
    const newSkips:  [number, number] = [skips[0],  skips[1]];
    const judgeIdx  = turn === 1 ? 1 : 0;
    newScores[judgeIdx] += 5;
    newSkips[mySlot - 1] += 1;
    const nextTurn: 1 | 2 = turn === 1 ? 2 : 1;
    const nextRound = round + 1;
    if (nextRound > TOTAL_ROUNDS) {
      await patchState(room.id, { phase: "game_over", scores: newScores, skips: newSkips });
    } else {
      await patchState(room.id, { phase: "idle", turn: nextTurn, round: nextRound, scores: newScores, skips: newSkips, vote: null });
    }
  }

  async function restart() {
    if (!isHost) return;
    confettiFired.current = false;
    onDareDone();
    await patchState(room.id, { phase: "idle", turn: 1, round: 1, total_rotation: displayRot, scores: [0, 0], skips: [0, 0], vote: null });
  }

  // ── Score pips ────────────────────────────────────────────────────────────
  function ScorePips({ score, color, max = 6 }: { score: number; color: string; max?: number }) {
    const pips = Math.min(Math.floor(score / 10), max);
    return (
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: max }).map((_, i) => (
          <motion.div key={i}
            animate={i === pips - 1 ? { scale: [1.5, 1] } : {}}
            transition={{ duration: 0.35 }}
            style={{ width: 8, height: 8, borderRadius: "50%",
              background: i < pips ? color : "rgba(255,255,255,0.12)",
              boxShadow: i < pips ? `0 0 5px ${color}` : "none",
              transition: "background 0.3s" }} />
        ))}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const canSkip   = isMyTurn && (skips[mySlot - 1] ?? 0) < 1;
  const iScored   = vote !== null && vote !== undefined && turn !== mySlot ? !vote : !!vote; // points went to: vote=true→doer, vote=false→judge
  const roundDisp = Math.min(round, TOTAL_ROUNDS);

  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", overflow: "hidden", fontFamily: SERIF }}>

      {/* Ambient orbs */}
      <motion.div animate={{ opacity: [0.07, 0.16, 0.07] }} transition={{ duration: 6, repeat: Infinity }}
        style={{ position: "absolute", left: "5%", top: "10%", width: 300, height: 300, borderRadius: "50%", background: cat.color, filter: "blur(90px)", pointerEvents: "none" }} />
      <motion.div animate={{ opacity: [0.05, 0.12, 0.05] }} transition={{ duration: 7, delay: 1.5, repeat: Infinity }}
        style={{ position: "absolute", right: "0%", bottom: "20%", width: 250, height: 250, borderRadius: "50%", background: VIOLET, filter: "blur(80px)", pointerEvents: "none" }} />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ width: "100%", padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 5, background: "rgba(0,0,0,0.28)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <motion.button whileTap={{ scale: 0.92 }} onClick={onBackToMenu}
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 12, padding: "7px 14px", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", fontFamily: SERIF }}>
          ← Retour
        </motion.button>

        {/* Scores */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span style={{ fontSize: 10, color: myColor, fontWeight: 700, letterSpacing: 0.6 }}>{myName}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ScorePips score={myScore} color={myColor} />
              <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: myColor, lineHeight: 1, textShadow: `0 0 12px ${myColor}` }}>{myScore}</span>
            </div>
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 14, color: "rgba(255,255,255,0.2)" }}>·</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <span style={{ fontSize: 10, color: othColor, fontWeight: 700, letterSpacing: 0.6 }}>{otherName}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: othColor, lineHeight: 1, textShadow: `0 0 12px ${othColor}` }}>{othScore}</span>
              <ScorePips score={othScore} color={othColor} />
            </div>
          </div>
        </div>

        {/* Round pill */}
        <div style={{ ...glass, padding: "5px 12px", borderRadius: 20 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: "'Work Sans',sans-serif" }}>
            {roundDisp}<span style={{ color: "rgba(255,255,255,0.3)" }}>/{TOTAL_ROUNDS}</span>
          </span>
        </div>
      </div>

      {/* ── Turn badge ───────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div key={`turn-${turn}-${phase}`}
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          style={{ marginTop: 10, zIndex: 5 }}>
          <span style={{ ...glass, display: "inline-block", padding: "6px 18px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.82)", borderRadius: 99, fontFamily: "'Work Sans',sans-serif" }}>
            {isMyTurn ? "✨ C'est ton tour !" : `⏳ Tour de ${otherName}`}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* ── Wheel ────────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", width: "min(82vw, 300px)", marginTop: 16, zIndex: 5 }}>
        {/* Glow ring (pulses when spinning) */}
        <motion.div animate={{ opacity: isSpinning ? [0.35, 0.75, 0.35] : 0.18 }}
          transition={{ duration: 1.1, repeat: isSpinning ? Infinity : 0 }}
          style={{ position: "absolute", inset: 0, borderRadius: "50%",
            background: `conic-gradient(${ROSE},${AMBER},${EMERALD},${SKY},${VIOLET},${TEAL},${ORANGE},${AMBER},${ROSE})`,
            filter: "blur(18px)", zIndex: 0 }} />

        {/* Pointer */}
        <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", zIndex: 20 }}>
          <div style={{ width: 0, height: 0,
            borderLeft: "11px solid transparent", borderRight: "11px solid transparent",
            borderTop: "26px solid #fbbf24",
            filter: "drop-shadow(0 0 8px rgba(251,191,36,0.9))" }} />
        </div>

        {/* Spinning wheel */}
        <motion.div
          animate={{ rotate: displayRot }}
          transition={isSpinning ? { duration: 4.2, ease: [0.12, 0.88, 0.33, 1.0] } : { duration: 0 }}
          style={{ position: "relative", zIndex: 10, willChange: "transform" }}>
          <WheelSVG spinning={isSpinning} landingIdx={catIdx} />
        </motion.div>
      </div>

      {/* ── Category chips ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 12, padding: "0 16px", maxWidth: 360, zIndex: 5 }}>
        {CATEGORIES.map((c, i) => (
          <span key={c.id} style={{
            borderRadius: 99, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "#fff",
            background: `${c.color}28`, border: `1px solid ${c.color}${!isSpinning && i === catIdx ? "cc" : "33"}`,
            boxShadow: !isSpinning && i === catIdx ? `0 0 10px ${c.color}66` : "none",
            transition: "all 0.4s", fontFamily: "'Work Sans',sans-serif",
          }}>
            {c.emoji} {c.label}
          </span>
        ))}
      </div>

      {/* ── Idle / Spinning action zone ──────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ marginTop: 22, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 5 }}>
            {isMyTurn ? (
              <div style={{ position: "relative" }}>
                <motion.div animate={{ scale: [1, 1.55, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2.2, repeat: Infinity }}
                  style={{ position: "absolute", inset: -18, borderRadius: 999, border: `2px solid ${ROSE}55` }} />
                <motion.div animate={{ scale: [1, 1.9, 1], opacity: [0.2, 0, 0.2] }}
                  transition={{ duration: 2.2, repeat: Infinity, delay: 0.5 }}
                  style={{ position: "absolute", inset: -18, borderRadius: 999, border: `2px solid ${VIOLET}44` }} />
                <motion.button whileTap={{ scale: 0.93 }} onClick={spin}
                  style={{
                    background: `linear-gradient(135deg, ${ROSE} 0%, #ec4899 50%, ${VIOLET} 100%)`,
                    boxShadow: `0 0 32px ${ROSE}55, 0 0 64px ${VIOLET}25`,
                    borderRadius: 999, padding: "17px 46px",
                    fontSize: 18, fontWeight: 800, color: "#fff",
                    border: "1px solid rgba(255,255,255,0.2)",
                    letterSpacing: 0.4, cursor: "pointer", fontFamily: SERIF,
                  }}>
                  🎡 Lancer la roue
                </motion.button>
              </div>
            ) : (
              <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.8 }}
                style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontFamily: "'Work Sans',sans-serif" }}>
                En attente que {otherName} lance…
              </motion.p>
            )}
          </motion.div>
        )}

        {phase === "spinning" && (
          <motion.p key="spinning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ marginTop: 22, color: "rgba(255,255,255,0.45)", fontSize: 14, letterSpacing: 2, fontFamily: "'Work Sans',sans-serif" }}
>
            <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }}>
              ✨ La roue tourne…
            </motion.span>
          </motion.p>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── REVEAL overlay ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "reveal" && cat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "0 24px",
              background: `linear-gradient(160deg, oklch(0.12 0.09 260) 0%, oklch(0.08 0.05 250) 100%)` }}>
            {/* Color wash */}
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 38%, ${cat.color}22, transparent 68%)`, pointerEvents: "none" }} />

            <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 16 }}
              style={{ position: "relative", zIndex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>

              <motion.span animate={{ y: [0, -12, 0] }} transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                style={{ fontSize: 96, lineHeight: 1, filter: `drop-shadow(0 0 18px ${cat.color})` }}>
                {cat.emoji}
              </motion.span>

              <h2 style={{ fontFamily: SERIF, fontSize: 52, fontWeight: 700, color: "#fff", margin: "4px 0 0",
                textShadow: `0 0 30px ${cat.color}, 0 0 60px ${cat.color}55`, lineHeight: 1 }}>
                {cat.label}
              </h2>

              {cat.id === "foudre" && (
                <span style={{ ...glass, padding: "5px 16px", borderRadius: 99, fontSize: 12, color: AMBER, fontFamily: "'Work Sans',sans-serif", letterSpacing: 0.5 }}>
                  ⚡ Double points ce tour !
                </span>
              )}

              <div style={{ marginTop: 6 }}>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontFamily: "'Work Sans',sans-serif" }}>Défi pour</p>
                <p style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: "#fff", marginTop: 2 }}>{turn === mySlot ? myName : otherName}</p>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
              style={{ position: "relative", zIndex: 1, marginTop: 32 }}>
              {isMyTurn ? (
                <motion.button whileTap={{ scale: 0.93 }} onClick={startChallenge}
                  style={{ ...glass, padding: "14px 36px", fontSize: 16, fontWeight: 700, color: "#fff",
                    cursor: "pointer", fontFamily: SERIF,
                    boxShadow: `0 0 24px ${cat.color}44`, border: `1px solid ${cat.color}55` }}>
                  Voir mon défi →
                </motion.button>
              ) : (
                <p style={{ ...glass, padding: "12px 24px", fontSize: 14, color: "rgba(255,255,255,0.55)", fontFamily: "'Work Sans',sans-serif" }}>
                  En attente de {otherName}…
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CHALLENGE overlay ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "challenge" && cat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", overflow: "auto", padding: "0 20px 32px",
              background: "oklch(0.08 0.05 255)" }}>
            {/* Top glow */}
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 200, background: `radial-gradient(ellipse at 50% 0%, ${cat.color}25, transparent 70%)`, pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, marginTop: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, maxWidth: 360, margin: "36px auto 0" }}>

              {/* Category pill */}
              <motion.span initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: cat.color, borderRadius: 99, padding: "7px 18px", fontSize: 13, fontWeight: 700, color: "#fff",
                  boxShadow: `0 0 18px ${cat.color}66`, fontFamily: "'Work Sans',sans-serif" }}>
                {cat.emoji} {cat.label}
              </motion.span>

              {/* Challenge card */}
              <motion.div initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
                style={{ ...glass, padding: "28px 24px", width: "100%",
                  border: `1px solid ${cat.color}44`,
                  boxShadow: `0 0 40px ${cat.color}18, inset 0 0 24px rgba(255,255,255,0.02)` }}>
                <p style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, color: "#fff", lineHeight: 1.55, textAlign: "center", margin: 0 }}>
                  {challenge}
                </p>
              </motion.div>

              {/* Doer → target */}
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", fontFamily: "'Work Sans',sans-serif" }}>
                <span style={{ color: cat.color, fontWeight: 600 }}>{turn === mySlot ? myName : otherName}</span>
                {cat.id !== "foudre" && <> → <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{turn === mySlot ? otherName : myName}</span></>}
              </p>

              {/* Timer */}
              {cat.timer > 0 && isMyTurn && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                  <TimerCircle total={timer.total} left={timer.left} color={cat.color} />
                  {timer.done && (
                    <motion.p initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      style={{ textAlign: "center", fontWeight: 700, color: ROSE, fontSize: 15, fontFamily: "'Work Sans',sans-serif", marginTop: 6, textShadow: `0 0 12px ${ROSE}` }}>
                      ⏰ Temps écoulé !
                    </motion.p>
                  )}
                </motion.div>
              )}
              {!isMyTurn && (
                <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.8 }}
                  style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontFamily: "'Work Sans',sans-serif", textAlign: "center" }}>
                  {turn !== mySlot ? myName : otherName} relève le défi…<br />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Tu joueras le jury ensuite</span>
                </motion.p>
              )}

              {/* Buttons */}
              {isMyTurn && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                  <motion.button whileTap={{ scale: 0.94 }} onClick={submitDone}
                    style={{ padding: "17px", borderRadius: 18, border: `1.5px solid ${cat.color}88`,
                      background: `linear-gradient(135deg, ${cat.color}28, ${cat.color}0d)`,
                      color: cat.color, fontSize: 16, fontWeight: 700, cursor: "pointer",
                      boxShadow: `0 0 22px ${cat.color}33`, fontFamily: SERIF }}>
                    ✅ J'ai terminé — l'autre juge !
                  </motion.button>
                  {canSkip && (
                    <motion.button whileTap={{ scale: 0.94 }} onClick={skipChallenge}
                      style={{ padding: "12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)",
                        fontSize: 13, cursor: "pointer", fontFamily: "'Work Sans',sans-serif" }}>
                      😅 Passer (1× par partie — +5 pts à l'autre)
                    </motion.button>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── VOTING overlay ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "voting" && cat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 45, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: "oklch(0.08 0.06 255)", padding: "0 24px" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 40%, rgba(251,191,36,0.12), transparent 60%)", pointerEvents: "none" }} />

            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
              style={{ position: "relative", zIndex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%", maxWidth: 360 }}>

              {isMyTurn ? (
                <>
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                    style={{ fontSize: 64 }}>⏳</motion.div>
                  <h2 style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 700, color: "#fff" }}>Ton partenaire juge…</h2>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontFamily: "'Work Sans',sans-serif" }}>
                    {otherName} décide si tu as réussi
                  </p>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 64 }}>⚖️</span>
                  <h2 style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>
                    {turn === 1 ? myName : otherName} a réussi ?
                  </h2>
                  <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, fontFamily: "'Work Sans',sans-serif" }}>
                    Tu es le jury — ton verdict est sans appel 🎩
                  </p>
                  <div style={{ display: "flex", gap: 14, width: "100%", marginTop: 8 }}>
                    <motion.button whileTap={{ scale: 0.92 }} onClick={() => castVote(false)}
                      style={{ flex: 1, padding: "20px 0", borderRadius: 20,
                        background: "rgba(239,68,68,0.12)", border: "1.5px solid rgba(239,68,68,0.4)",
                        color: "#f87171", fontSize: 18, fontWeight: 700, cursor: "pointer",
                        boxShadow: "0 0 20px rgba(239,68,68,0.12)", fontFamily: SERIF }}>
                      ❌ Raté
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.92 }} onClick={() => castVote(true)}
                      style={{ flex: 1, padding: "20px 0", borderRadius: 20,
                        background: "rgba(74,222,128,0.12)", border: "1.5px solid rgba(74,222,128,0.4)",
                        color: EMERALD, fontSize: 18, fontWeight: 700, cursor: "pointer",
                        boxShadow: "0 0 20px rgba(74,222,128,0.12)", fontFamily: SERIF }}>
                      ✅ Réussi !
                    </motion.button>
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.22)", fontFamily: "'Work Sans',sans-serif", marginTop: -4 }}>
                    Réussi = +{cat.pts} pts pour {turn === 1 ? myName : otherName} · Raté = +5 pts pour toi
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RESULT overlay ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "result" && cat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: "oklch(0.08 0.05 255)", padding: "0 24px" }}>
            <div style={{ position: "absolute", inset: 0,
              background: vote
                ? "radial-gradient(circle at 50% 38%, rgba(74,222,128,0.18), transparent 60%)"
                : "radial-gradient(circle at 50% 38%, rgba(239,68,68,0.15), transparent 60%)",
              pointerEvents: "none" }} />

            <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 14 }}
              style={{ position: "relative", zIndex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: "100%", maxWidth: 360 }}>

              <motion.span animate={{ rotate: vote ? [0, -8, 8, -4, 0] : [0, -3, 3, 0] }}
                transition={{ duration: 0.55, delay: 0.15 }}
                style={{ fontSize: 88 }}>{vote ? "🎉" : "💔"}</motion.span>

              <h2 style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 700, lineHeight: 1,
                color: vote ? EMERALD : "#f87171",
                textShadow: vote ? `0 0 24px ${EMERALD}88` : "0 0 24px rgba(248,113,113,0.6)" }}>
                {vote ? "Défi relevé !" : "Pas réussi !"}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, fontFamily: "'Work Sans',sans-serif" }}>
                {vote
                  ? `+${cat.pts} pts pour ${turn === mySlot ? myName : otherName} 🔥`
                  : `+5 pts pour ${turn === mySlot ? otherName : myName} (jury) 👨‍⚖️`}
              </p>

              {/* Score card */}
              <div style={{ ...glass, display: "flex", alignItems: "center", gap: 28, padding: "18px 36px", marginTop: 4 }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 10, color: myColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, fontFamily: "'Work Sans',sans-serif", marginBottom: 6 }}>{myName}</p>
                  <p style={{ fontFamily: SERIF, fontSize: 52, fontWeight: 700, color: myColor, lineHeight: 1, textShadow: `0 0 18px ${myColor}66` }}>{myScore}</p>
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 28, color: "rgba(255,255,255,0.15)" }}>–</div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 10, color: othColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.7, fontFamily: "'Work Sans',sans-serif", marginBottom: 6 }}>{otherName}</p>
                  <p style={{ fontFamily: SERIF, fontSize: 52, fontWeight: 700, color: othColor, lineHeight: 1, textShadow: `0 0 18px ${othColor}66` }}>{othScore}</p>
                </div>
              </div>

              {isMyTurn ? (
                <motion.button whileTap={{ scale: 0.93 }} onClick={next}
                  style={{ ...glass, padding: "14px 36px", borderRadius: 99, fontSize: 15, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: SERIF, marginTop: 6 }}>
                  Tour de {turn === 1 ? otherName : myName} →
                </motion.button>
              ) : (
                <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.8 }}
                  style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, fontFamily: "'Work Sans',sans-serif" }}>
                  En attente de {turn === mySlot ? otherName : myName}…
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GAME OVER overlay ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "game_over" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(160deg, #150e00 0%, oklch(0.08 0.06 255) 50%, #0d0010 100%)`,
              overflowY: "auto", padding: "20px 24px" }}>
            {/* Gold orb */}
            <div style={{ position: "absolute", top: "8%", left: "50%", transform: "translateX(-50%)", width: 380, height: 380, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(251,191,36,0.22) 0%, transparent 70%)", filter: "blur(35px)", pointerEvents: "none" }} />

            {(() => {
              const ms = scores[mySlot - 1];
              const os = scores[mySlot === 1 ? 1 : 0];
              const won  = ms > os;
              const draw = ms === os;
              const winner = won ? myName : draw ? null : otherName;
              const winColor = won ? AMBER : draw ? SKY : othColor;
              return (
                <motion.div style={{ position: "relative", zIndex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: "100%", maxWidth: 370 }}>
                  <motion.span initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 160, damping: 12 }}
                    style={{ fontSize: 100, lineHeight: 1 }}>{draw ? "🤝" : won ? "👑" : "💪"}</motion.span>

                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    <h1 style={{ fontFamily: SERIF, fontSize: 48, fontWeight: 700, color: "#fff", margin: "0 0 6px", letterSpacing: 0.5,
                      textShadow: `0 0 36px ${winColor}88` }}>
                      {draw ? "Égalité !" : won ? "Victoire !" : "Perdu !"}
                    </h1>
                    <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 15, fontFamily: "'Work Sans',sans-serif" }}>
                      {draw ? "Parfaitement équilibrés 🤝" : won ? `Tu as dominé ${otherName} ! 🔥` : `${otherName} t'a eu ! Revanche ?`}
                    </p>
                  </motion.div>

                  {/* Score card */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                    style={{ ...glass, display: "flex", alignItems: "center", gap: 28, padding: "24px 40px", width: "100%" }}>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <p style={{ fontSize: 10, color: myColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "'Work Sans',sans-serif", marginBottom: 8 }}>{myName}</p>
                      <p style={{ fontFamily: SERIF, fontSize: 68, fontWeight: 700, color: myColor, lineHeight: 1, textShadow: `0 0 22px ${myColor}66` }}>{ms}</p>
                    </div>
                    <div style={{ fontFamily: SERIF, fontSize: 32, color: "rgba(255,255,255,0.18)" }}>–</div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <p style={{ fontSize: 10, color: othColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "'Work Sans',sans-serif", marginBottom: 8 }}>{otherName}</p>
                      <p style={{ fontFamily: SERIF, fontSize: 68, fontWeight: 700, color: othColor, lineHeight: 1, textShadow: `0 0 22px ${othColor}66` }}>{os}</p>
                    </div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }}
                    style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
                    {isHost && (
                      <motion.button whileTap={{ scale: 0.93 }} onClick={restart}
                        style={{ padding: "15px", borderRadius: 16, border: `1.5px solid ${AMBER}77`,
                          background: `linear-gradient(135deg, ${AMBER}28, ${AMBER}0d)`,
                          color: AMBER, fontSize: 16, fontWeight: 700, cursor: "pointer",
                          boxShadow: `0 0 24px ${AMBER}33`, fontFamily: SERIF }}>
                        Revanche 🎡
                      </motion.button>
                    )}
                    <motion.button whileTap={{ scale: 0.93 }} onClick={onBackToMenu}
                      style={{ padding: "14px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.11)",
                        background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.58)",
                        fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: SERIF }}>
                      Retour au menu
                    </motion.button>
                  </motion.div>
                </motion.div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
