import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Sparkles, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getClientId, generateRoomCode } from "@/lib/player-id";
import { DEFAULT_NAMES } from "@/lib/game-content";
import { FloatingHearts } from "@/components/FloatingHearts";
import { InstallPrompt, InstallButton } from "@/components/InstallPrompt";
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
  const [customCode, setCustomCode] = useState("");
  const [showCustomCode, setShowCustomCode] = useState(false);
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

  const createOrJoinWithCustomCode = async () => {
    const code = customCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 4 || code.length > 8) {
      toast.error("Le code doit faire entre 4 et 8 caractères");
      return;
    }
    setBusy(true);
    try {
      const clientId = getClientId();

      // Vérifier si la room existe déjà
      const { data: existing } = await supabase
        .from("rooms")
        .select("id, code")
        .eq("code", code)
        .maybeSingle();

      if (existing) {
        // Room existe → rejoindre directement
        toast.success(`Bienvenue dans votre session "${code}" 💕`);
        navigate({ to: "/room/$code", params: { code } });
        return;
      }

      // Room n'existe pas → la créer avec ce code
      const { data, error } = await supabase
        .from("rooms")
        .insert({ code, phase: "lobby" })
        .select()
        .single();

      if (error || !data) throw new Error("Impossible de créer la partie");

      await supabase.from("players").insert({
        room_id: (data as { id: string }).id,
        slot: 1,
        name: DEFAULT_NAMES[0],
        client_id: clientId,
      });

      toast.success(`Session "${code}" créée 💕`);
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
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 pb-28 pt-10">
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
          {/* Créer une partie (code aléatoire) */}
          <Button
            onClick={createGame}
            disabled={busy || showCustomCode}
            className="h-14 w-full rounded-2xl text-base font-semibold shadow-md transition-transform active:scale-[0.98]"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Créer une partie
          </Button>

          {/* Code personnalisé */}
          <AnimatePresence initial={false}>
            {showCustomCode ? (
              <motion.div
                key="custom"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <Input
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  placeholder="VOTRE-CODE"
                  maxLength={8}
                  className="h-12 rounded-xl text-center text-lg tracking-widest"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setShowCustomCode(false); setCustomCode(""); }}
                    className="flex-1 rounded-xl"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={createOrJoinWithCustomCode}
                    disabled={busy}
                    className="flex-1 rounded-xl"
                  >
                    Valider
                  </Button>
                </div>
              </motion.div>
            ) : (
              <Button
                key="show-custom"
                variant="outline"
                onClick={() => setShowCustomCode(true)}
                disabled={busy}
                className="h-12 w-full rounded-xl"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Utiliser un code à nous
              </Button>
            )}
          </AnimatePresence>

          {/* Rejoindre */}
          <div className="flex gap-2 pt-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Code d'invitation"
              maxLength={8}
              className="h-12 rounded-xl text-center tracking-widest"
            />
            <Button onClick={joinGame} disabled={busy} className="h-12 rounded-xl">
              Rejoindre
            </Button>
          </div>

          {/* Compte + Installation */}
          <div className="flex flex-col gap-3 pt-4">
            <InstallButton />

          </div>
        </motion.div>
      </div>
      <InstallPrompt />
    </div>
  );
}
