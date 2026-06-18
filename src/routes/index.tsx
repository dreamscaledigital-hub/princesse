import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { Heart, Dices, KeyRound, Shuffle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getClientId, generateRoomCode } from "@/lib/player-id";
import { DEFAULT_NAMES } from "@/lib/game-content";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Princesse 💕" }, { name: "description", content: "Votre petit univers à deux." }] }),
  component: HomePage,
});

// ── Decorative SVG background ─────────────────────────────────────────────────
function HeroBg() {
  return (
    <svg viewBox="0 0 390 844" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="hero-p1" cx="25%" cy="10%" r="55%">
          <stop offset="0%" stopColor="oklch(0.88 0.072 358)" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="oklch(0.88 0.072 358)" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="hero-p2" cx="80%" cy="85%" r="50%">
          <stop offset="0%" stopColor="oklch(0.82 0.085 10)" stopOpacity="0.40"/>
          <stop offset="100%" stopColor="oklch(0.82 0.085 10)" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="hero-p3" cx="90%" cy="18%" r="38%">
          <stop offset="0%" stopColor="oklch(0.85 0.09 75)" stopOpacity="0.28"/>
          <stop offset="100%" stopColor="oklch(0.85 0.09 75)" stopOpacity="0"/>
        </radialGradient>
        <filter id="soft">
          <feGaussianBlur stdDeviation="2"/>
        </filter>
      </defs>
      {/* Gradient blobs */}
      <rect width="390" height="844" fill="url(#hero-p1)"/>
      <rect width="390" height="844" fill="url(#hero-p2)"/>
      <rect width="390" height="844" fill="url(#hero-p3)"/>
      {/* Large decorative rose */}
      <g transform="translate(310,80) rotate(-20)" opacity="0.18" filter="url(#soft)">
        {[0,60,120,180,240,300].map((deg,i)=>(
          <g key={i} transform={`rotate(${deg})`}>
            <ellipse rx="44" ry="22" fill="oklch(0.60 0.16 0)" transform="translate(0,-38)"/>
          </g>
        ))}
        {[30,90,150,210,270,330].map((deg,i)=>(
          <g key={i} transform={`rotate(${deg})`}>
            <ellipse rx="28" ry="14" fill="oklch(0.75 0.13 355)" transform="translate(0,-22)"/>
          </g>
        ))}
        <circle r="12" fill="oklch(0.80 0.12 75)"/>
      </g>
      {/* Small rose bottom-left */}
      <g transform="translate(60,740) rotate(25)" opacity="0.14" filter="url(#soft)">
        {[0,72,144,216,288].map((deg,i)=>(
          <g key={i} transform={`rotate(${deg})`}>
            <ellipse rx="30" ry="14" fill="oklch(0.60 0.16 0)" transform="translate(0,-26)"/>
          </g>
        ))}
        <circle r="9" fill="oklch(0.80 0.12 75)"/>
      </g>
      {/* Scattered petals */}
      {[[55,120,18,15],[320,380,14,200],[80,460,10,80],[340,520,16,310],[160,700,12,140]].map(([x,y,rx,rot],i)=>(
        <g key={i} transform={`translate(${x},${y}) rotate(${rot})`} opacity="0.25">
          <ellipse rx={rx} ry={rx*0.5} fill="none" stroke="oklch(0.75 0.13 355)" strokeWidth="1.2"/>
        </g>
      ))}
      {/* Hearts scattered */}
      {[[30,200,12],[358,320,9],[40,580,8],[355,640,11],[195,800,7]].map(([x,y,s],i)=>(
        <text key={i} x={x} y={y} fontSize={s} textAnchor="middle" opacity="0.18" fill="oklch(0.60 0.16 0)">♥</text>
      ))}
      {/* Thin arc top */}
      <path d="M 0 160 Q 195 100 390 160" fill="none" stroke="oklch(0.75 0.13 355)" strokeWidth="0.8" opacity="0.25"/>
    </svg>
  );
}

// ── Game cards ────────────────────────────────────────────────────────────────
type GameCard = { emoji: string; title: string; desc: string; route: string; gradient: string; glow: string };

const GAMES: GameCard[] = [
  {
    emoji: "🎡",
    title: "Roulette IRL",
    desc: "Défiez-vous avec 5 catégories de surprises. Le premier à 10 points choisit son gage.",
    route: "/roulette-irl",
    gradient: "linear-gradient(145deg,oklch(0.90 0.062 352),oklch(0.82 0.105 358))",
    glow: "oklch(0.60 0.16 0 / 0.28)",
  },
];

function GameCard({ card, delay = 0 }: { card: GameCard; delay?: number }) {
  const navigate = useNavigate();
  return (
    <motion.button
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      whileTap={{ scale: 0.97 }}
      onClick={() => navigate({ to: card.route as "/" })}
      className="w-full overflow-hidden rounded-[28px] text-left"
      style={{
        background: card.gradient,
        boxShadow: `0 16px 48px ${card.glow}, 0 6px 16px oklch(0.75 0.13 355 / 0.15), inset 0 1px 0 rgba(255,255,255,0.65)`,
      }}
    >
      {/* Card body */}
      <div className="px-6 pb-6 pt-6">
        <div className="flex items-start gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl"
            style={{
              background: "rgba(255,255,255,0.55)",
              backdropFilter: "blur(8px)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
            }}
          >
            {card.emoji}
          </span>
          <div className="pt-1">
            <p className="font-serif text-2xl leading-tight text-primary">{card.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.desc}</p>
          </div>
        </div>
        {/* Play button row */}
        <div className="mt-5 flex items-center justify-between">
          <div className="flex gap-1">
            {[0,1,2].map(i=>(
              <div key={i} className="h-1.5 w-1.5 rounded-full" style={{background:"oklch(0.60 0.16 0 / 0.35)"}}/>
            ))}
          </div>
          <motion.div
            whileHover={{ x: 3 }}
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{
              background: "linear-gradient(145deg,#e88aab,#c45c7c)",
              boxShadow: "0 6px 18px oklch(0.60 0.16 0 / 0.38), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
          >
            <Dices className="h-5 w-5 text-white"/>
          </motion.div>
        </div>
      </div>
    </motion.button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function HomePage() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function joinOrCreateRoom(rawCode?: string) {
    const isRandom = !rawCode;
    const inputCode = (rawCode ?? roomCode).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!isRandom && (inputCode.length < 4 || inputCode.length > 8)) {
      toast.error("Le code doit faire entre 4 et 8 caractères");
      return;
    }
    setBusy(true);
    try {
      const clientId = getClientId();

      // Rejoindre une room existante (code saisi)
      if (!isRandom) {
        const { data: existing } = await supabase
          .from("rooms").select("id, code").eq("code", inputCode).maybeSingle();
        if (existing) {
          navigate({ to: "/room/$code", params: { code: inputCode } });
          return;
        }
      }

      // Créer la room (avec code saisi ou code aléatoire avec retry)
      let code = inputCode;
      let roomId = "";
      const attempts = isRandom ? 5 : 1;
      for (let i = 0; i < attempts; i++) {
        const c = isRandom ? generateRoomCode() : inputCode;
        const { data, error } = await supabase
          .from("rooms").insert({ code: c, phase: "lobby" }).select().single();
        if (!error && data) {
          code = c; roomId = (data as { id: string }).id; break;
        }
      }
      if (!roomId) throw new Error("Impossible de créer la partie");

      await supabase.from("players").insert({
        room_id: roomId, slot: 1, name: DEFAULT_NAMES[0], client_id: clientId,
      });

      toast.success(isRandom ? `Partie créée 💕` : `Session "${code}" prête 💕`);
      navigate({ to: "/room/$code", params: { code } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="relative min-h-screen overflow-hidden pb-32">
      <HeroBg/>

      <div className="relative z-10 flex flex-col px-5 pt-16">
        {/* Hero header */}
        <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.55, ease: "easeOut" }} className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: "linear-gradient(to right,transparent,oklch(0.75 0.13 355 / 0.4))" }}/>
            <Heart className="h-3.5 w-3.5 fill-primary text-primary animate-heartbeat"/>
            <div className="h-px flex-1" style={{ background: "linear-gradient(to left,transparent,oklch(0.75 0.13 355 / 0.4))" }}/>
          </div>
          <h1 className="font-serif text-[3.2rem] leading-none tracking-tight" style={{ color: "oklch(0.28 0.08 358)" }}>
            Notre<br/>
            <span style={{ background: "linear-gradient(135deg,#c45c7c,#e88aab,#d4a0b0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              univers
            </span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Des petits jeux, des défis, des souvenirs.<br/>Juste pour vous deux.
          </p>
        </motion.div>

        {/* Game cards */}
        <div className="space-y-4">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Jeux disponibles
          </motion.p>
          {GAMES.map((g, i) => <GameCard key={g.route} card={g} delay={0.25 + i * 0.08}/>)}
        </div>

        {/* Auth CTA */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.45 }}
          className="mt-10 overflow-hidden rounded-[24px] p-5"
          style={{
            background: "rgba(255,255,255,0.7)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.8)",
            boxShadow: "0 8px 32px oklch(0.75 0.13 355 / 0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
          }}>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))",
                boxShadow: "0 4px 12px oklch(0.60 0.16 0 / 0.18)" }}>
              <Heart className="h-6 w-6 fill-primary text-primary"/>
            </div>
            <div>
              <p className="font-serif text-lg text-primary">Votre espace</p>
              <p className="text-xs text-muted-foreground">Sauvegardez vos scores et défis.</p>
            </div>
          </div>
          <button onClick={() => navigate({ to: "/auth" })}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition active:scale-[0.97]"
            style={{
              background: "linear-gradient(135deg,#e88aab,#c45c7c)",
              boxShadow: "0 8px 24px oklch(0.60 0.16 0 / 0.32), inset 0 1px 0 rgba(255,255,255,0.18)",
            }}>
            <Heart className="h-4 w-4 fill-white text-white"/>
            Se connecter
          </button>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1" style={{background:"linear-gradient(to right,transparent,oklch(0.75 0.13 355 / 0.35))"}}/>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">ou jouer vite</span>
            <div className="h-px flex-1" style={{background:"linear-gradient(to left,transparent,oklch(0.75 0.13 355 / 0.35))"}}/>
          </div>

          {/* Code rien que à nous */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-primary">
              <KeyRound className="h-3.5 w-3.5"/> Le code rien qu'à nous
            </label>
            <div className="flex gap-2">
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && !busy && joinOrCreateRoom(roomCode)}
                placeholder="ABC123"
                maxLength={8}
                className="h-11 flex-1 rounded-2xl px-4 text-center text-sm font-semibold tracking-[0.3em] outline-none transition focus:ring-2"
                style={{
                  background: "rgba(255,255,255,0.85)",
                  border: "1px solid oklch(0.85 0.06 355 / 0.6)",
                  color: "oklch(0.30 0.08 358)",
                }}
              />
              <button onClick={() => joinOrCreateRoom(roomCode)} disabled={busy || roomCode.trim().length < 4}
                className="h-11 rounded-2xl px-4 text-sm font-semibold text-primary transition active:scale-95 disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.85)", border: "1px solid oklch(0.85 0.06 355 / 0.6)" }}>
                Rejoindre
              </button>
            </div>
          </div>

          {/* Partie au hasard */}
          <button onClick={() => joinOrCreateRoom()} disabled={busy}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))",
              border: "1px solid oklch(0.82 0.085 10 / 0.4)",
              color: "oklch(0.35 0.10 358)",
              boxShadow: "0 4px 16px oklch(0.75 0.13 355 / 0.18)",
            }}>
            <Shuffle className="h-4 w-4"/>
            Créer une partie au hasard
          </button>
        </motion.div>
      </div>
    </main>
  );
}
