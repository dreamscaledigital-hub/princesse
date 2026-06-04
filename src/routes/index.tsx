import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getClientId, generateRoomCode } from "@/lib/player-id";
import { DEFAULT_NAMES } from "@/lib/game-content";
import { FloatingHearts } from "@/components/FloatingHearts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tu me connais ? — Quiz romantique à deux" },
      { name: "description", content: "Un petit quiz tendre pour découvrir à quel point vous vous connaissez." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Si on arrive avec ?room=XXXX, on rejoint direct
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("room");
    if (code) {
      navigate({ to: "/room/$code", params: { code: code.toUpperCase() }, replace: true });
    }
  }, [navigate]);

  const createGame = async () => {
    setBusy(true);
    try {
      const clientId = getClientId();
      let code = "";
      let roomId = "";
      // Try up to 5 times to avoid collision
      for (let i = 0; i < 5; i++) {
        const c = generateRoomCode();
        const { data, error } = await supabase
          .from("rooms")
          .insert({ code: c, phase: "lobby" })
          .select()
          .single();
        if (!error && data) {
          code = c;
          roomId = (data as { id: string }).id;
          break;
        }
      }
      if (!code) throw new Error("Impossible de créer la partie");

      await supabase.from("players").insert({
        room_id: roomId,
        slot: 1,
        name: DEFAULT_NAMES[0],
        client_id: clientId,
      });

      navigate({ to: "/room/$code", params: { code } });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  const joinGame = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      toast.error("Entre un code valide");
      return;
    }
    navigate({ to: "/room/$code", params: { code } });
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <FloatingHearts />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/15 shadow-lg"
        >
          <Heart className="h-12 w-12 fill-primary text-primary" />
        </motion.div>

        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="font-script text-center text-5xl font-bold leading-none text-primary"
        >
          Tu me connais ?
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="mt-3 text-center text-base text-muted-foreground"
        >
          Un petit quiz tendre, à deux. Devine ce que ton amour répondrait… ou paie un gage 😘
        </motion.p>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 w-full space-y-4"
        >
          <Button
            onClick={createGame}
            disabled={busy}
            className="h-14 w-full rounded-2xl text-base font-semibold shadow-md transition-transform active:scale-95"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Créer une partie
          </Button>

          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            ou
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Code à 6 caractères"
              maxLength={6}
              className="h-14 rounded-2xl text-center text-lg font-semibold tracking-[0.4em]"
            />
            <Button
              onClick={joinGame}
              variant="secondary"
              className="h-12 w-full rounded-2xl text-base font-semibold"
            >
              Rejoindre la partie
            </Button>
          </div>
        </motion.div>

        <p className="mt-10 text-center font-script text-2xl text-primary/70">
          Fait avec 💖
        </p>
      </div>
    </div>
  );
}
