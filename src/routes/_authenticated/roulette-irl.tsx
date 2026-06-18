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
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [hostUserId, setHostUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadNames();
  }, []);

  async function loadNames() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      setMyUserId(uid);
      if (!uid) return;

      const { data: cid } = await supabase.rpc("couple_for_user", { _uid: uid });
      if (!cid) return;
      setCoupleId(cid as string);

      const { data: couple } = await supabase
        .from("couples")
        .select("user_a,user_b")
        .eq("id", cid as string)
        .maybeSingle();
      if (!couple) return;

      // user_a is always slot 1 (host) — deterministic across devices
      setHostUserId(couple.user_a);
      const partnerId = couple.user_a === uid ? couple.user_b : couple.user_a;

      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", [couple.user_a, couple.user_b]);

      const byId = Object.fromEntries((profs ?? []).map((p) => [p.id, p.display_name || ""]));
      setPlayer1(byId[couple.user_a] || "Joueur 1");
      setPlayer2(byId[couple.user_b] || "Joueur 2");

      // suppress unused var warning
      void partnerId;
    } catch {
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
      coupleId={coupleId}
      myUserId={myUserId}
      hostUserId={hostUserId}
      onBack={() => navigate({ to: "/hub" })}
    />
  );
}
