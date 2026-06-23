import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { RouletteIRL } from "@/components/RouletteIRL";

export const Route = createFileRoute("/_authenticated/roulette-irl")({
  head: () => ({ meta: [{ title: "Roulette 🎰 — Princesse" }] }),
  component: RouletteIRLPage,
});

type GameState =
  | { status: "loading" }
  | { status: "no_couple" }
  | { status: "ready"; player1: string; player2: string; mySlot: 1 | 2; coupleId: string };

type Mode = "solo" | "duo" | null;

function RouletteIRLPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<GameState>({ status: "loading" });
  const [mode, setMode] = useState<Mode>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) { navigate({ to: "/auth" }); return; }

      const { data: me } = await supabase
        .from("profiles").select("display_name").eq("id", uid).maybeSingle();
      const myName = (me as { display_name?: string } | null)?.display_name || "Toi";

      const { data: coupleId } = await supabase.rpc("couple_for_user", { _uid: uid });
      if (!coupleId) { setState({ status: "no_couple" }); return; }

      const { data: couple } = await supabase
        .from("couples").select("user_a,user_b").eq("id", coupleId).maybeSingle();
      if (!couple) { setState({ status: "no_couple" }); return; }

      const c = couple as { user_a: string; user_b: string };
      const partnerId = c.user_a === uid ? c.user_b : c.user_a;
      const mySlot: 1 | 2 = c.user_a === uid ? 1 : 2;

      const { data: partner } = await supabase
        .from("profiles").select("display_name").eq("id", partnerId).maybeSingle();
      const partnerName = (partner as { display_name?: string } | null)?.display_name || "Ton amour";

      const player1 = mySlot === 1 ? myName : partnerName;
      const player2 = mySlot === 1 ? partnerName : myName;

      setState({ status: "ready", player1, player2, mySlot, coupleId: coupleId as string });
    } catch {
      setState({ status: "no_couple" });
    }
  }

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-pink-300 text-2xl animate-pulse">
        💕
      </div>
    );
  }

  if (state.status === "no_couple") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: "#0b0714" }}>
        <p className="text-4xl">💔</p>
        <p style={{ color: "rgba(255,255,255,0.6)" }}>Appaire-toi avec ton amour d'abord !</p>
        <button onClick={() => navigate({ to: "/hub" })}
          className="rounded-full px-6 py-3 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#f43f5e,#a855f7)" }}>
          Aller au hub
        </button>
      </div>
    );
  }

  // ── Mode already selected → launch game
  if (mode !== null) {
    return (
      <RouletteIRL
        player1={state.player1}
        player2={state.player2}
        mySlot={state.mySlot}
        coupleId={state.coupleId}
        soloMode={mode === "solo"}
        onBack={() => setMode(null)}
      />
    );
  }

  // ── Mode selector screen
  const partnerName = state.mySlot === 1 ? state.player2 : state.player1;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10 overflow-hidden"
      style={{ background: "#0b0714", position: "relative" }}>

      {/* Background orbs */}
      <div style={{ position: "absolute", top: "-15%", left: "-10%", width: 320, height: 320, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(244,63,94,0.35) 0%, transparent 70%)", filter: "blur(50px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-15%", right: "-10%", width: 320, height: 320, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(168,85,247,0.30) 0%, transparent 70%)", filter: "blur(50px)", pointerEvents: "none" }} />

      <div className="relative z-10 w-full max-w-sm">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <motion.p className="text-7xl" animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}>💋</motion.p>
          <h1 className="mt-3 text-3xl font-black text-white" style={{ letterSpacing: -0.5 }}>
            Roulette Coquine
          </h1>
          <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.38)" }}>
            Choisis ton mode de jeu
          </p>
        </motion.div>

        {/* Mode cards */}
        <div className="flex flex-col gap-4">

          {/* SOLO */}
          <motion.button
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            onClick={() => setMode("solo")}
            whileTap={{ scale: 0.97 }}
            className="text-left w-full"
            style={{
              background: "linear-gradient(135deg, rgba(244,63,94,0.22) 0%, rgba(168,85,247,0.18) 100%)",
              border: "1px solid rgba(244,63,94,0.40)",
              borderRadius: 24,
              padding: "22px 24px",
              boxShadow: "0 0 32px rgba(244,63,94,0.12)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 40, lineHeight: 1 }}>🎰</span>
              <div>
                <p style={{ fontSize: 18, fontWeight: 800, color: "white", margin: 0, letterSpacing: -0.3 }}>
                  Mode Solo
                </p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.50)", margin: "4px 0 0" }}>
                  Tu contrôles tout — lance la roue autant de fois que tu veux
                </p>
              </div>
            </div>
            <div style={{
              marginTop: 14,
              background: "rgba(244,63,94,0.15)",
              borderRadius: 12,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", margin: 0 }}>
                Pas besoin d'attendre {partnerName} — tu es maître du jeu
              </p>
            </div>
          </motion.button>

          {/* DUO */}
          <motion.button
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 }}
            onClick={() => setMode("duo")}
            whileTap={{ scale: 0.97 }}
            className="text-left w-full"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 24,
              padding: "22px 24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 40, lineHeight: 1 }}>👫</span>
              <div>
                <p style={{ fontSize: 18, fontWeight: 800, color: "white", margin: 0, letterSpacing: -0.3 }}>
                  Mode Duo
                </p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.50)", margin: "4px 0 0" }}>
                  Toi & {partnerName} — tours alternés, complicité maximale
                </p>
              </div>
            </div>
          </motion.button>

        </div>

        {/* Back */}
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          onClick={() => navigate({ to: "/hub" })}
          style={{ display: "block", margin: "28px auto 0", color: "rgba(255,255,255,0.28)", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}
        >
          ← Retour au hub
        </motion.button>

      </div>
    </div>
  );
}
