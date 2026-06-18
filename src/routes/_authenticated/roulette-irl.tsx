import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

function RouletteIRLPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<GameState>({ status: "loading" });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) { navigate({ to: "/auth" }); return; }

      // Load my profile
      const { data: me } = await supabase
        .from("profiles").select("display_name").eq("id", uid).maybeSingle();
      const myName = (me as { display_name?: string } | null)?.display_name || "Toi";

      // Load couple
      const { data: coupleId } = await supabase.rpc("couple_for_user", { _uid: uid });
      if (!coupleId) { setState({ status: "no_couple" }); return; }

      const { data: couple } = await supabase
        .from("couples").select("user_a,user_b").eq("id", coupleId).maybeSingle();
      if (!couple) { setState({ status: "no_couple" }); return; }

      const partnerId = (couple as { user_a: string; user_b: string }).user_a === uid
        ? (couple as { user_a: string; user_b: string }).user_b
        : (couple as { user_a: string; user_b: string }).user_a;
      const mySlot: 1 | 2 = (couple as { user_a: string; user_b: string }).user_a === uid ? 1 : 2;

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-4xl">💔</p>
        <p className="text-gray-600">Appaire-toi avec ton amour d'abord !</p>
        <button onClick={() => navigate({ to: "/hub" })}
          className="rounded-full bg-pink-500 px-6 py-3 text-sm font-semibold text-white">
          Aller au hub
        </button>
      </div>
    );
  }

  return (
    <RouletteIRL
      player1={state.player1}
      player2={state.player2}
      mySlot={state.mySlot}
      coupleId={state.coupleId}
      onBack={() => navigate({ to: "/hub" })}
    />
  );
}
