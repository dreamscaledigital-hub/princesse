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

  const getCoupleIdOrThrow = async (): Promise<string> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      navigate({ to: "/auth" });
      throw new Error("Connecte-toi pour créer une partie 💕");
    }
    const { data: coupleId, error } = await supabase.rpc("couple_for_user", { _uid: auth.user.id });
    if (error) throw new Error(error.message);
    if (!coupleId) {
      navigate({ to: "/hub" });
      throw new Error("Appaire-toi avec ton amour d'abord 💕");
    }
    return coupleId as string;
  };

  const createGame = async () => {
    setBusy(true);
    try {
      const clientId = getClientId();
      const coupleId = await getCoupleIdOrThrow();
      let code = "";
      let roomId = "";
      for (let i = 0; i < 5; i++) {
        const c = generateRoomCode();
        const { data, error } = await supabase
          .from("rooms")
          .insert({ code: c, phase: "lobby", owner_couple_id: coupleId })
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
      const coupleId = await getCoupleIdOrThrow();

      const { data: existing } = await supabase
        .from("rooms")
        .select("id, code")
        .eq("code", code)
        .maybeSingle();

      if (existing) {
        toast.success(`Bienvenue dans votre session "${code}" 💕`);
        navigate({ to: "/room/$code", params: { code } });
        return;
      }

      const { data, error } = await supabase
        .from("rooms")
        .insert({ code, phase: "lobby", owner_couple_id: coupleId })
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

  const joinDuel = () => {
    const code = duelCode.trim().toUpperCase();
    if (code.length < 6) { toast.error("Entre un code de duel valide"); return; }
    navigate({ to: "/duel/$code", params: { code } });
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

          {/* Séparateur Duel */}
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground pt-2">
            <div className="h-px flex-1 bg-border" />
            Duel rapide
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Tap éclair */}
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-700">Tap éclair</span>
              <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-600">New ⚡</span>
            </div>
            <p className="text-xs text-amber-700/70 mb-3">Annonce un gage · Tape le cœur en premier · Best of 5</p>
            <Button
              onClick={() => navigate({ to: "/duel" })}
              disabled={busy}
              className="h-11 w-full rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold mb-2"
            >
              <Zap className="mr-2 h-4 w-4" /> Créer un duel
            </Button>
            <div className="flex gap-2">
              <Input
                value={duelCode}
                onChange={(e) => setDuelCode(e.target.value.toUpperCase())}
                placeholder="Code du duel"
                maxLength={6}
                className="h-9 rounded-xl text-center text-sm font-semibold tracking-[0.3em] flex-1"
              />
              <Button onClick={joinDuel} variant="outline" size="sm"
                className="h-9 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50">
                Rejoindre
              </Button>
            </div>
          </div>

          {/* Installation */}
          <div className="flex justify-center pt-2">
            <InstallButton />
          </div>
        </motion.div>
      </div>
      <InstallPrompt />
    </div>
  );
}
