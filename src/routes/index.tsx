import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Sparkles, KeyRound, Dices, ChevronRight, Send } from "lucide-react";
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

// ── Animated orb ─────────────────────────────────────────────────────────────
function Orb({ size, x, y, delay, color }: { size: number; x: string; y: string; delay: number; color: string }) {
  return (
    <motion.div className="pointer-events-none absolute rounded-full"
      style={{ width: size, height: size, left: x, top: y, background: color, filter: `blur(${size * 0.48}px)`, opacity: 0.52 }}
      animate={{ scale: [1, 1.14, 1], opacity: [0.42, 0.62, 0.42], y: [0, -14, 0] }}
      transition={{ duration: 5 + delay, repeat: Infinity, ease: "easeInOut", delay }}/>
  );
}

// ── Tiny chip ────────────────────────────────────────────────────────────────
function Chip({ label, emoji }: { label: string; emoji?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold"
      style={{ background: "rgba(255,255,255,0.65)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.80)", color: "oklch(0.45 0.10 358)" }}>
      {emoji && <span>{emoji}</span>}{label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function HomePage() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode]     = useState("");
  const [customCode, setCustomCode] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [showJoin, setShowJoin]     = useState(false);
  const [busy, setBusy]             = useState(false);

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

  const createOrJoinCustom = async () => {
    const code = customCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 4 || code.length > 8) { toast.error("4 à 8 caractères"); return; }
    setBusy(true);
    try {
      const clientId = getClientId();
      const coupleId = await getCoupleIdOrThrow();
      const { data: existing } = await supabase.from("rooms").select("id,code").eq("code", code).maybeSingle();
      if (existing) { toast.success(`Bienvenue dans "${code}" 💕`); navigate({ to: "/room/$code", params: { code } }); return; }
      const { data, error } = await supabase.from("rooms")
        .insert({ code, phase: "lobby", owner_couple_id: coupleId }).select().single();
      if (error || !data) throw new Error("Impossible de créer la partie");
      await supabase.from("players").insert({ room_id: (data as { id: string }).id, slot: 1, name: DEFAULT_NAMES[0], client_id: clientId });
      toast.success(`Session "${code}" créée 💕`);
      navigate({ to: "/room/$code", params: { code } });
    } catch (e) { toast.error((e as Error).message); setBusy(false); }
  };

  const joinGame = () => {
    const code = roomCode.trim().toUpperCase();
    if (code.length < 4) { toast.error("Entre un code valide"); return; }
    navigate({ to: "/room/$code", params: { code } });
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden pb-32"
      style={{ background: "linear-gradient(160deg,oklch(0.97 0.018 352) 0%,oklch(0.99 0.006 355) 50%,oklch(0.97 0.015 15) 100%)" }}>
      <FloatingHearts/>

      {/* ── BG ORBS ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Orb size={280} x="-12%" y="-8%" delay={0}   color="oklch(0.90 0.09 352/0.8)"/>
        <Orb size={200} x="62%"  y="12%" delay={1.8} color="oklch(0.88 0.08 15/0.7)"/>
        <Orb size={160} x="5%"   y="55%" delay={3.1} color="oklch(0.92 0.07 355/0.6)"/>
        <Orb size={120} x="72%"  y="65%" delay={0.9} color="oklch(0.86 0.10 340/0.6)"/>
      </div>

      <div className="relative z-10 mx-auto max-w-md flex flex-col px-5 pt-12">

        {/* ── HERO ── */}
        <motion.div initial={{ y: -18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.55 }} className="mb-8">
          {/* Badge */}
          <div className="mb-4 flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: "linear-gradient(to right,transparent,oklch(0.75 0.13 355/0.35))" }}/>
            <motion.span animate={{ scale: [1,1.18,1] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
              <Heart className="h-3.5 w-3.5 fill-primary text-primary"/>
            </motion.span>
            <div className="h-px flex-1" style={{ background: "linear-gradient(to left,transparent,oklch(0.75 0.13 355/0.35))" }}/>
          </div>
          <h1 className="font-serif leading-none tracking-tight" style={{ fontSize: "3.2rem", color: "oklch(0.28 0.08 358)" }}>
            Nos petits<br/>
            <span style={{ background: "linear-gradient(135deg,#c45c7c,#e88aab,#d4a0b0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              jeux à deux
            </span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "oklch(0.58 0.06 358)" }}>
            Quiz tendres, défis complices,<br/>roulette coquine. Juste pour vous.
          </p>
        </motion.div>

        {/* ══════════════════════════════════════════════════════
            CARD 1 — Quiz coquin (FEATURED)
        ══════════════════════════════════════════════════════ */}
        <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.14, duration: 0.5 }}
          className="mb-4 overflow-hidden rounded-[32px]"
          style={{
            background: "linear-gradient(155deg,oklch(0.96 0.030 352) 0%,oklch(0.91 0.058 358) 55%,oklch(0.94 0.040 10) 100%)",
            boxShadow: "0 20px 56px oklch(0.60 0.16 0/0.18), 0 6px 20px oklch(0.75 0.13 355/0.14), inset 0 1.5px 0 rgba(255,255,255,0.85)",
            border: "1px solid rgba(255,255,255,0.72)",
          }}>

          {/* Card header */}
          <div className="flex items-start gap-4 px-5 pt-5 pb-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
              style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(10px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 12px oklch(0.75 0.13 355/0.18)" }}>
              💕
              <motion.span className="absolute -right-1 -top-1 text-xs"
                animate={{ scale: [1,1.2,1], rotate: [0,12,-8,0] }} transition={{ duration: 3, repeat: Infinity }}>
                ✨
              </motion.span>
            </div>
            <div className="flex-1">
              <p className="font-serif text-2xl leading-tight" style={{ color: "oklch(0.38 0.12 358)" }}>Quiz coquin</p>
              <p className="mt-0.5 text-xs" style={{ color: "oklch(0.58 0.08 358)" }}>Questions · Gages · Mini-jeux</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip emoji="❓" label="Quiz intime"/>
                <Chip emoji="🎲" label="Défis"/>
                <Chip emoji="🏆" label="Gages"/>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-5 h-px" style={{ background: "linear-gradient(to right,transparent,oklch(0.75 0.13 355/0.22),transparent)" }}/>

          {/* Actions */}
          <div className="space-y-2.5 px-5 py-4">
            {/* Créer */}
            <button onClick={createGame} disabled={busy}
              className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-base font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow: "0 8px 28px oklch(0.60 0.16 0/0.32), inset 0 1px 0 rgba(255,255,255,0.20)" }}>
              <Sparkles className="h-5 w-5"/> Créer une partie
            </button>

            {/* Code personnalisé */}
            <AnimatePresence initial={false}>
              {showCustom ? (
                <motion.div key="custom" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-2 pt-1">
                    <input value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase())} placeholder="NOTRE-CODE" maxLength={8}
                      className="h-12 w-full rounded-2xl px-4 text-center text-base tracking-[0.2em] font-bold outline-none transition"
                      style={{ background: "rgba(255,255,255,0.75)", border: "1.5px solid rgba(255,255,255,0.88)", color: "oklch(0.30 0.08 358)" }}/>
                    <div className="flex gap-2">
                      <button onClick={() => { setShowCustom(false); setCustomCode(""); }}
                        className="flex h-12 flex-1 items-center justify-center rounded-2xl text-sm font-semibold transition active:scale-95"
                        style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(255,255,255,0.82)", color: "oklch(0.45 0.08 358)" }}>
                        Annuler
                      </button>
                      <button onClick={createOrJoinCustom} disabled={busy}
                        className="flex h-12 flex-1 items-center justify-center rounded-2xl text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)" }}>
                        Valider 💕
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <button key="show" onClick={() => setShowCustom(true)} disabled={busy}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-95"
                  style={{ background: "rgba(255,255,255,0.72)", border: "1.5px solid rgba(255,255,255,0.84)", color: "oklch(0.42 0.10 358)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <KeyRound className="h-4 w-4"/> Code rien qu'à nous
                </button>
              )}
            </AnimatePresence>

            {/* Rejoindre */}
            <AnimatePresence initial={false}>
              {showJoin ? (
                <motion.div key="join" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="flex gap-2 pt-1">
                    <input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === "Enter" && joinGame()} placeholder="Code invitation" maxLength={8}
                      className="h-12 flex-1 rounded-2xl px-4 text-center text-sm tracking-widest font-bold outline-none"
                      style={{ background: "rgba(255,255,255,0.72)", border: "1.5px solid rgba(255,255,255,0.84)", color: "oklch(0.30 0.08 358)" }}/>
                    <button onClick={joinGame} disabled={busy}
                      className="h-12 rounded-2xl px-5 text-sm font-semibold text-white transition active:scale-95"
                      style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)" }}>
                      Rejoindre
                    </button>
                  </div>
                </motion.div>
              ) : (
                <button key="joinBtn" onClick={() => setShowJoin(true)}
                  className="flex h-10 w-full items-center justify-center gap-1.5 text-xs font-medium transition"
                  style={{ color: "oklch(0.60 0.08 358)" }}>
                  <Send className="h-3.5 w-3.5"/> Rejoindre avec un code
                </button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ══════════════════════════════════════════════════════
            CARD 2 — Roulette IRL
        ══════════════════════════════════════════════════════ */}
        <motion.a href="/roulette-irl"
          initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.26, duration: 0.5 }}
          className="mb-4 block overflow-hidden rounded-[32px] transition-all duration-200 active:scale-[0.97]"
          style={{
            background: "linear-gradient(145deg,oklch(0.93 0.042 352),oklch(0.86 0.078 358),oklch(0.90 0.058 10))",
            boxShadow: "0 16px 48px oklch(0.60 0.16 0/0.20), 0 4px 16px oklch(0.75 0.13 355/0.14), inset 0 1.5px 0 rgba(255,255,255,0.80)",
            border: "1px solid rgba(255,255,255,0.68)",
          }}>

          <div className="flex items-center gap-4 px-5 py-5">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
              style={{ background: "rgba(255,255,255,0.60)", backdropFilter: "blur(10px)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 12px oklch(0.75 0.13 355/0.18)" }}>
              🎰
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-2xl leading-tight" style={{ color: "oklch(0.38 0.12 358)" }}>Roulette IRL</p>
              <p className="mt-0.5 text-xs" style={{ color: "oklch(0.58 0.08 358)" }}>Défis réels · Victoire à 10 pts</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip emoji="💋" label="Séduction"/>
                <Chip emoji="🔥" label="Passion"/>
                <Chip emoji="🌊" label="Détente"/>
              </div>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow: "0 4px 14px oklch(0.60 0.16 0/0.30)" }}>
              <ChevronRight className="h-5 w-5 text-white"/>
            </div>
          </div>

          {/* Gradient bar accent */}
          <div className="h-0.5" style={{ background: "linear-gradient(to right,oklch(0.75 0.13 355/0.20),oklch(0.60 0.16 0/0.40),oklch(0.75 0.13 355/0.20))" }}/>

          {/* Category preview */}
          <div className="flex items-center justify-between px-5 py-3">
            {[["🌟","Osé"],["💋","Séduction"],["🌿","Détente"],["🎭","Défi"],["🔥","Brûlant"]].map(([e,l]) => (
              <div key={l} className="flex flex-col items-center gap-1">
                <span className="text-base">{e}</span>
                <span className="text-[9px] font-semibold" style={{ color: "oklch(0.58 0.08 358)" }}>{l}</span>
              </div>
            ))}
          </div>
        </motion.a>

        {/* ── FOOTER LINKS ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.44 }}
          className="mt-3 flex flex-col items-center gap-3">
          <Link to="/hub"
            className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium transition active:scale-95"
            style={{ background: "rgba(255,255,255,0.70)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.80)", color: "oklch(0.52 0.08 358)", boxShadow: "0 4px 14px rgba(0,0,0,0.06)" }}>
            <Heart className="h-3.5 w-3.5 fill-primary/50 text-primary/50"/> Notre nid
          </Link>
          <div className="flex items-center gap-3 text-xs" style={{ color: "oklch(0.65 0.05 358)" }}>
            <Link to="/auth" className="underline underline-offset-2 hover:text-primary transition">Se connecter</Link>
            <span>·</span>
            <div className="inline-flex"><InstallButton/></div>
          </div>
        </motion.div>
      </div>

      <InstallPrompt/>
    </div>
  );
}
