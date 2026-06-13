import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getClientId } from "@/lib/player-id";

export const Route = createFileRoute("/duel")({
  component: DuelCreatePage,
});

function generateDuelCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function DuelCreatePage() {
  const navigate = useNavigate();
  const myId = getClientId();

  useEffect(() => {
    void create();
  }, []);

  async function create() {
    // Récupérer le nom depuis le profil si connecté
    let myName = "Joueur 1";
    const { data: ures } = await supabase.auth.getUser();
    if (ures.user) {
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", ures.user.id).maybeSingle();
      if (prof?.display_name) myName = prof.display_name;
    }

    for (let i = 0; i < 5; i++) {
      const code = generateDuelCode();
      const { error } = await supabase.from("duels").insert({
        code, p1_id: myId, p1_name: myName,
      });
      if (!error) {
        navigate({ to: "/duel/$code", params: { code }, replace: true });
        return;
      }
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
      Création du duel…
    </div>
  );
}
