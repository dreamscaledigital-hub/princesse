import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RouletteIRL } from "@/components/RouletteIRL";

export const Route = createFileRoute("/_authenticated/roulette-irl")({
  head: () => ({ meta: [{ title: "Roulette 🎰 — Princesse" }] }),
  component: RouletteIRLPage,
});

function RouletteIRLPage() {
  const navigate = useNavigate();
  const [player1, setPlayer1] = useState("Toi");
  const [player2, setPlayer2] = useState("Ton amour");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadNames();
  }, []);

  async function loadNames() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;

      const { data: me } = await supabase.from("profiles").select("display_name").eq("id", uid).maybeSingle();
      if (me?.display_name) setPlayer1(me.display_name);

      const { data: coupleId } = await supabase.rpc("couple_for_user", { _uid: uid });
      if (coupleId) {
        const { data: couple } = await supabase.from("couples").select("user_a,user_b").eq("id", coupleId).maybeSingle();
        if (couple) {
          const partnerId = couple.user_a === uid ? couple.user_b : couple.user_a;
          const { data: partner } = await supabase.from("profiles").select("display_name").eq("id", partnerId).maybeSingle();
          if (partner?.display_name) setPlayer2(partner.display_name);
        }
      }
    } catch (e) {
      // silently ignore — fallback names already set
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-pink-300 text-2xl">
        💕
      </div>
    );
  }

  return (
    <RouletteIRL
      player1={player1}
      player2={player2}
      onBack={() => navigate({ to: "/hub" })}
    />
  );
}
