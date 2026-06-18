import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Sparkles, KeyRound, Dices, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getClientId, generateRoomCode } from "@/lib/player-id";
import { DEFAULT_NAMES } from "@/lib/game-content";
import { FloatingHearts } from "@/components/FloatingHearts";
import { InstallPrompt, InstallButton } from "@/components/InstallPrompt";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Princesse 💕 — Jeux à deux" },
      { name: "description", content: "Vos petits jeux à deux — quiz, défis, complicité." },
    ],
  }),
  component: HomePage,
});

// ── Decorative SVG ────────────────────────────────────────────────────────────
function HeroBg() {
  return (
    <svg viewBox="0 0 390 844" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="hp1" cx="25%" cy="10%" r="55%">
          <stop offset="0%" stopColor="oklch(0.88 0.072 358)" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="oklch(0.88 0.072 358)" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="hp2" cx="80%" cy="85%" r="50%">
          <stop offset="0%" stopColor="oklch(0.82 0.085 10)" stopOpacity="0.38"/>
          <stop offset="100%" stopColor="oklch(0.82 0.085 10)" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="hp3" cx="88%" cy="18%" r="38%">
          <stop offset="0%" stopColor="oklch(0.85 0.09 75)" stopOpacity="0.24"/>
          <stop offset="100%" stopColor="oklch(0.85 0.09 75)" stopOpacity="0"/>
        </radialGradient>
        <filter id="hsoft"><feGaussianBlur stdDeviation="2"/></filter>
      </defs>
      <rect width="390" height="844" fill="url(#hp1)"/>
      <rect width="390" height="844" fill="url(#hp2)"/>
      <rect width="390" height="844" fill="url(#hp3)"/>
      <g transform="translate(316,74) rotate(-18)" opacity="0.18" filter="url(#hsoft)">
        {[0,60,120,180,240,300].map((deg,i)=>(
          <g key={i} transform={`rotate(${deg})`}>
            <ellipse rx="42" ry="20" fill="oklch(0.60 0.16 0)" transform="translate(0,-36)"/>
          </g>
        ))}
        {[30,90,150,210,270,330].map((deg,i)=>(
          <g key={i} transform={`rotate(${deg})`}>
            <ellipse rx="26" ry="13" fill="oklch(0.75 0.13 355)" transform="translate(0,-20)"/>
          </g>
        ))}
        <circle r="11" fill="oklch(0.80 0.12 75)"/>
      </g>
      <g transform="translate(58,730) rotate(22)" opacity="0.13" filter="url(#hsoft)">
        {[0,72,144,216,288].map((deg,i)=>(
          <g key={i} transform={`rotate(${deg})`}>
            <ellipse rx="28" ry="13" fill="oklch(0.60 0.16 0)" transform="translate(0,-24)"/>
          </g>
        ))}
        <circle r="8" fill="oklch(0.80 0.12 75)"/>
      </g>
      {[[55,120,18,15],[320,380,14,200],[80,460,10,80],[340,520,16,310],[160,700,12,140]].map(([x,y,rx,rot],i)=>(
        <g key={i} transform={`translate(${x},${y}) rotate(${rot})`} opacity="0.22">
          <ellipse rx={rx} ry={rx*0.5} fill="none" stroke="oklch(0.75 0.13 355)" strokeWidth="1.2"/>
        </g>
      ))}
      {[[30,200,12],[358,320,9],[40,580,8],[355,640,11],[195,800,7]].map(([x,y,s],i)=>(
        <text key={i} x={x} y={y} fontSize={s} textAnchor="middle" opacity="0.16" fill="oklch(0.60 0.16 0)">♥</text>
      ))}
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function HomePage() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode]       = useState("");
  const [customCode, setCustomCode]   = useState("");
  const [showCustom, setShowCustom]   = useState(false);
  const [busy, setBusy]               = useState(false);

  // ?room=CODE → redirect direct
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search).get("room");
    if (p) navigate({ to: "/room/$code", params: { code: p.toUpperCase() }, replace: true });
  }, [navigate]);

  const getCoupleIdOrThrow = async (): Promise<string> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { navigate({ to: "/auth" }); throw new Error("Connecte-toi d'abord 💕"); }
    const { data: coupleId, error } = await supabase.rpc("couple_for_user", { _uid: auth.user.id });
    if (error) throw new Error(error.message);
    if (!coupleId) { navigate({ to: "/hub" }); throw new Error("Appaire-toi avec ton amour d'abord 💕"); }
    return coupleId as string;
  };

  // Créer partie aléatoire
  const createGame = async () => {
    setBusy(true);
    try {
      const clientId = getClientId();
      const coupleId = await getCoupleIdOrThrow();
      let code = ""; let roomId = "";
      for (let i = 0; i < 5; i++) {
        const c = generateRoomCode();
        const { data, error } = await supabase.from("rooms")
          .insert({ code: c, phase: "lobby", owner_couple_id: coupleId }).select().single();
        if (!error && data) { code = c; roomId = (data as { id: string }).id; break; }
      }
      if (!code) throw new Error("Impossible de créer la partie");
      await supabase.from("players").insert({ room_id: roomId, slot: 1, name: DEFAULT_NAMES[0], client_id: clientId });
      navigate({ to: "/room/$code", params: { code } });
    } catch (e) { toast.error((e as Error).message); setBusy(false); }
  };

  // Créer/rejoindre avec code personnalisé
  const createOrJoinCustom = async () => {
    const code = customCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 4 || code.length > 8) { toast.error("4 à 8 caractères"); return; }
    setBusy(true);
    try {
      const clientId = getClientId();
      const coupleId = await getCoupleIdOrThrow();
      const { data: existing } = await supabase.from("rooms").select("id,code").eq("code", code).maybeSingle();
      if (existing) {
        toast.success(`Bienvenue dans "${code}" 💕`);
        navigate({ to: "/room/$code", params: { code } }); return;
      }
      const { data, error } = await supabase.from("rooms")
        .insert({ code, phase: "lobby", owner_couple_id: coupleId }).select().single();
      if (error || !data) throw new Error("Impossible de créer la partie");
      await supabase.from("players").insert({ room_id: (data as { id: string }).id, slot: 1, name: DEFAULT_NAMES[0], client_id: clientId });
      toast.success(`Session "${code}" créée 💕`);
      navigate({ to: "/room/$code", params: { code } });
    } catch (e) { toast.error((e as Error).message); setBusy(false); }
  };

  // Rejoindre via code
  const joinGame = () => {
    const code = roomCode.trim().toUpperCase();
    if (code.length < 4) { toast.error("Entre un code valide"); return; }
    navigate({ to: "/room/$code", params: { code } });
  };

  return (
    <div className="relative min-h-screen overflow-hidden pb-32">
      <FloatingHearts/>
      <HeroBg/>

      <div className="relative z-10 flex flex-col px-5 pt-14">

        {/* Header */}
        <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: "linear-gradient(to right,transparent,oklch(0.75 0.13 355 / 0.4))" }}/>
            <Heart className="h-3.5 w-3.5 fill-primary text-primary animate-heartbeat"/>
            <div className="h-px flex-1" style={{ background: "linear-gradient(to left,transparent,oklch(0.75 0.13 355 / 0.4))" }}/>
          </div>
          <h1 className="font-serif text-[3rem] leading-none tracking-tight" style={{ color: "oklch(0.28 0.08 358)" }}>
            Tu me<br/>
            <span style={{ background: "linear-gradient(135deg,#c45c7c,#e88aab,#d4a0b0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              connais ?
            </span>
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            Quiz tendre, défis et mini-jeux.<br/>Juste pour vous deux.
          </p>
        </motion.div>

        {/* ── Jeu principal ── */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15, duration: 0.5 }}
          className="mb-4 overflow-hidden rounded-[28px] p-5"
          style={{ background: "linear-gradient(145deg,oklch(0.96 0.030 352),oklch(0.91 0.058 358))",
            boxShadow: "0 16px 48px oklch(0.60 0.16 0 / 0.20), 0 4px 16px oklch(0.75 0.13 355 / 0.14), inset 0 1px 0 rgba(255,255,255,0.75)" }}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
              style={{ background: "rgba(255,255,255,0.65)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 10px oklch(0.75 0.13 355 / 0.15)" }}>
              💕
            </div>
            <div>
              <p className="font-serif text-xl text-primary">Quiz coquin</p>
              <p className="text-xs text-muted-foreground">Questions · Gages · Mini-jeux</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Créer au hasard */}
            <button onClick={createGame} disabled={busy}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)",
                boxShadow: "0 8px 24px oklch(0.60 0.16 0 / 0.32), inset 0 1px 0 rgba(255,255,255,0.18)" }}>
              <Sparkles className="h-4 w-4"/> Créer une partie
            </button>

            {/* Code personnalisé */}
            <AnimatePresence initial={false}>
              {showCustom ? (
                <motion.div key="custom" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-2 overflow-hidden">
                  <input value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase())}
                    placeholder="NOTRE-CODE" maxLength={8}
                    className="h-12 w-full rounded-2xl px-4 text-center text-lg tracking-widest outline-none"
                    style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.8)", color: "oklch(0.28 0.08 358)" }}/>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowCustom(false); setCustomCode(""); }}
                      className="flex flex-1 h-12 items-center justify-center rounded-2xl text-sm font-semibold transition active:scale-[0.97]"
                      style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.8)", color: "oklch(0.42 0.10 358)" }}>
                      Annuler
                    </button>
                    <button onClick={createOrJoinCustom} disabled={busy}
                      className="flex flex-1 h-12 items-center justify-center rounded-2xl text-sm font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)" }}>
                      Valider
                    </button>
                  </div>
                </motion.div>
              ) : (
                <button key="show" onClick={() => setShowCustom(true)} disabled={busy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-[0.97]"
                  style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.8)", color: "oklch(0.42 0.10 358)",
                    boxShadow: "0 4px 12px oklch(0.75 0.13 355 / 0.08)" }}>
                  <KeyRound className="h-4 w-4"/> Code rien qu'à nous
                </button>
              )}
            </AnimatePresence>

            {/* Rejoindre via code d'invitation */}
            <div className="flex gap-2">
              <input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && joinGame()}
                placeholder="Code d'invitation" maxLength={8}
                className="h-12 flex-1 rounded-2xl px-4 text-center text-sm tracking-widest outline-none"
                style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.8)", color: "oklch(0.28 0.08 358)" }}/>
              <button onClick={joinGame} disabled={busy}
                className="h-12 rounded-2xl px-5 text-sm font-semibold text-white transition active:scale-[0.97]"
                style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)" }}>
                Rejoindre
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Roulette IRL ── */}
        <motion.a href="/roulette-irl" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.28, duration: 0.5 }}
          className="mb-4 block overflow-hidden rounded-[28px] transition-all duration-200 active:scale-[0.97]"
          style={{ background: "linear-gradient(145deg,oklch(0.93 0.042 352),oklch(0.86 0.078 358))",
            boxShadow: "0 12px 40px oklch(0.60 0.16 0 / 0.18), 0 4px 12px oklch(0.75 0.13 355 / 0.13), inset 0 1px 0 rgba(255,255,255,0.7)" }}>
          <div className="flex items-center gap-4 px-5 py-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
              style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(8px)" }}>
              🎰
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-xl text-primary">Roulette IRL</p>
              <p className="mt-0.5 text-xs text-muted-foreground">5 catégories · défis · victoire à 10 pts</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow: "0 4px 12px oklch(0.60 0.16 0 / 0.30)" }}>
              <Dices className="h-4 w-4 text-white"/>
            </div>
          </div>
          <div className="h-0.5 w-full" style={{ background: "linear-gradient(to right,oklch(0.75 0.13 355 / 0.25),oklch(0.60 0.16 0 / 0.35),oklch(0.75 0.13 355 / 0.25))" }}/>
        </motion.a>

        {/* Footer links */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.42 }} className="mt-2 flex items-center justify-center gap-3">
          <Link to="/hub" className="text-xs text-muted-foreground underline hover:text-primary transition">Notre nid 💕</Link>
          <span className="text-muted-foreground/30">·</span>
          <Link to="/auth" className="text-xs text-muted-foreground underline hover:text-primary transition">Se connecter</Link>
          <span className="text-muted-foreground/30">·</span>
          <div className="inline-flex"><InstallButton/></div>
        </motion.div>
      </div>

      <InstallPrompt/>
    </div>
  );
}
