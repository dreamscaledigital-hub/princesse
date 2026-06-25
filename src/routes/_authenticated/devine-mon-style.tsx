import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DevineMonStyle } from "@/components/DevineMonStyle";

export const Route = createFileRoute("/_authenticated/devine-mon-style")({
  head: () => ({ meta: [{ title: "Devine mon Style 💅 — Princesse" }] }),
  component: DevineMonStylePage,
});

type State =
  | { status: "loading" }
  | { status: "no_couple" }
  | { status: "ready"; player1: string; player2: string; mySlot: 1|2; coupleId: string };

function DevineMonStylePage() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) { navigate({ to: "/auth" }); return; }

      const { data: me } = await supabase.from("profiles")
        .select("display_name").eq("id", uid).maybeSingle();
      const myName = (me as { display_name?: string } | null)?.display_name || "Toi";

      const { data: coupleId } = await supabase.rpc("couple_for_user", { _uid: uid });
      if (!coupleId) { setState({ status: "no_couple" }); return; }

      const { data: couple } = await supabase.from("couples")
        .select("user_a,user_b").eq("id", coupleId).maybeSingle();
      if (!couple) { setState({ status: "no_couple" }); return; }

      const c = couple as { user_a: string; user_b: string };
      const partnerId = c.user_a === uid ? c.user_b : c.user_a;
      const mySlot: 1|2 = c.user_a === uid ? 1 : 2;

      const { data: partner } = await supabase.from("profiles")
        .select("display_name").eq("id", partnerId).maybeSingle();
      const partnerName = (partner as { display_name?: string } | null)?.display_name || "Ton amour";

      const player1 = mySlot === 1 ? myName : partnerName;
      const player2 = mySlot === 1 ? partnerName : myName;
      setState({ status: "ready", player1, player2, mySlot, coupleId: coupleId as string });
    } catch {
      setState({ status: "no_couple" });
    }
  }

  if (state.status === "loading") return (
    <div style={{ minHeight:"100dvh", background:"#0b0114", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <span style={{ fontSize:40, animation:"pulse 1s infinite" }}>💅</span>
    </div>
  );

  if (state.status === "no_couple") return (
    <div style={{ minHeight:"100dvh", background:"#0b0114", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:16, padding:24 }}>
      <span style={{ fontSize:48 }}>💔</span>
      <p style={{ color:"rgba(255,255,255,0.6)", textAlign:"center" }}>Appaire-toi avec ton amour d'abord !</p>
      <button onClick={() => navigate({ to: "/hub" })}
        style={{ background:"linear-gradient(135deg,#ec4899,#a855f7)", border:"none", borderRadius:999,
          padding:"12px 28px", color:"white", fontWeight:700, fontSize:14, cursor:"pointer" }}>
        Aller au hub
      </button>
    </div>
  );

  return (
    <DevineMonStyle
      player1={state.player1} player2={state.player2}
      mySlot={state.mySlot} coupleId={state.coupleId}
      onBack={() => navigate({ to: "/hub" })}
    />
  );
}
