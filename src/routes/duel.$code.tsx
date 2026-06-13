import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Share2, Zap, Trophy, Heart, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getClientId } from "@/lib/player-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/duel/$code")({
  component: DuelPage,
});

type Duel = {
  id: string; code: string;
  p1_id: string; p1_name: string;
  p2_id: string | null; p2_name: string | null;
  gage: string;
  p1_score: number; p2_score: number;
  status: string; current_round: number; total_rounds: number;
  round_winner_id: string | null;
  game_winner_id: string | null;
  signal_at: string | null;
};

const PRESET_GAGES = [
  "Préparer le petit-déjeuner demain ☕",
  "Masser l'autre 5 minutes 💆",
  "Choisir le prochain film 🎬",
  "Dire 5 choses que tu aimes chez moi 💕",
  "1 minute de chatouilles 😂",
  "Écrire un petit mot tendre 📝",
];

function DuelPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const myId = getClientId();

  const [duel, setDuel] = useState<Duel | null>(null);
  const [myName, setMyName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [gageInput, setGageInput] = useState("");
  const [joined, setJoined] = useState(false);
  const [signalVisible, setSignalVisible] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [tapped, setTapped] = useState(false);
  const [roundResultMsg, setRoundResultMsg] = useState("");
  const signalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isP1 = duel?.p1_id === myId;
  const isP2 = duel?.p2_id === myId;
  const amHost = isP1;

  // ── Chargement initial ────────────────────────────────────────────────────
  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`duel-${code}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "duels", filter: `code=eq.${code}` },
        (p) => setDuel(p.new as Duel))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [code]);

  async function load() {
    const { data } = await supabase.from("duels").select("*").eq("code", code).maybeSingle();
    if (!data) { toast.error("Duel introuvable"); navigate({ to: "/" }); return; }
    setDuel(data as Duel);
    if (data.p1_id === myId) { setMyName(data.p1_name); setJoined(true); }
    if (data.p2_id === myId) { setMyName(data.p2_name || ""); setJoined(true); }
  }

  // ── Rejoindre en tant que P2 ──────────────────────────────────────────────
  async function join() {
    const name = nameInput.trim() || "Joueur 2";
    const { error } = await supabase.from("duels")
      .update({ p2_id: myId, p2_name: name })
      .eq("code", code).is("p2_id", null);
    if (error) { toast.error("Impossible de rejoindre"); return; }
    setMyName(name); setJoined(true);
  }

  // ── Valider le gage (hôte) ────────────────────────────────────────────────
  async function setGage(g: string) {
    await supabase.from("duels").update({ gage: g, status: "gage_confirm" }).eq("code", code);
  }

  // ── Confirmer le gage (P2) ────────────────────────────────────────────────
  async function confirmGage() {
    await supabase.from("duels").update({ status: "countdown" }).eq("code", code);
    void startCountdown();
  }

  // ── Démarrer le countdown puis le round ──────────────────────────────────
  const startCountdown = useCallback(async () => {
    setCountdown(3);
    let n = 3;
    countdownRef.current = setInterval(async () => {
      n--;
      if (n > 0) { setCountdown(n); }
      else {
        clearInterval(countdownRef.current!);
        setCountdown(null);
        if (amHost) {
          // L'hôte lance le round côté serveur (signal_at aléatoire)
          await supabase.rpc("start_duel_round", { _code: code });
        }
      }
    }, 1000);
  }, [amHost, code]);

  // ── Watch signal_at pour afficher le ❤️ ──────────────────────────────────
  useEffect(() => {
    if (!duel || duel.status !== "ready" || !duel.signal_at) return;
    setSignalVisible(false);
    setTapped(false);
    if (signalTimerRef.current) clearTimeout(signalTimerRef.current);

    const delay = new Date(duel.signal_at).getTime() - Date.now();
    if (delay <= 0) { setSignalVisible(true); return; }
    signalTimerRef.current = setTimeout(() => setSignalVisible(true), delay);
    return () => { if (signalTimerRef.current) clearTimeout(signalTimerRef.current); };
  }, [duel?.signal_at, duel?.status]);

  // ── Lancer le countdown au début d'un round (via status) ─────────────────
  useEffect(() => {
    if (!duel || duel.status !== "countdown") return;
    setSignalVisible(false); setTapped(false);
    void startCountdown();
  }, [duel?.status, duel?.current_round]);

  // ── Résultat du round ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!duel || (duel.status !== "round_result" && duel.status !== "game_over")) return;
    setSignalVisible(false);
    const winner = duel.round_winner_id;
    if (winner === myId) setRoundResultMsg("Tu as tapé en premier ! 🏆");
    else if (winner) setRoundResultMsg(`${duel.p1_id === winner ? duel.p1_name : duel.p2_name} a tapé en premier !`);

    if (duel.status === "round_result" && amHost) {
      // Passer au round suivant après 2 secondes
      setTimeout(async () => {
        await supabase.from("duels")
          .update({ status: "countdown", current_round: duel.current_round + 1, signal_at: null })
          .eq("code", code);
      }, 2500);
    }
  }, [duel?.status, duel?.round_winner_id]);

  // ── Taper ! ───────────────────────────────────────────────────────────────
  async function tap() {
    if (tapped) return;
    setTapped(true);
    const { data, error } = await supabase.rpc("register_tap", { _code: code, _player_id: myId });
    if (error) { toast.error(error.message); return; }
    if (data === "false_start") toast.error("Faux départ — tu perds ce round ! 😬");
  }

  // ── Partage du code ───────────────────────────────────────────────────────
  async function share() {
    const url = window.location.href;
    const text = `Rejoins mon duel Tap éclair ⚡ — code : ${code}`;
    if (navigator.share) { try { await navigator.share({ text, url }); return; } catch {} }
    await navigator.clipboard.writeText(url);
    toast.success("Lien copié !");
  }

  // ── Rejouer ───────────────────────────────────────────────────────────────
  async function rematch() {
    await supabase.from("duels").update({
      p1_score: 0, p2_score: 0, status: "gage_input",
      current_round: 0, round_winner_id: null, game_winner_id: null,
      signal_at: null, gage: "",
    }).eq("code", code);
  }

  if (!duel) return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">Chargement…</div>;

  // ═══ RENDER PAR PHASE ════════════════════════════════════════════════════

  // Pas encore rejoint
  if (!joined && !isP1 && !isP2) {
    return (
      <Screen title="Rejoindre le duel" icon="⚡">
        <p className="mb-4 text-center text-sm text-muted-foreground">
          <span className="font-medium text-primary">{duel.p1_name}</span> t'invite à un duel Tap éclair !
        </p>
        <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)}
          placeholder="Ton prénom" maxLength={20}
          className="h-12 rounded-2xl text-center text-base"
          onKeyDown={(e) => e.key === "Enter" && join()} />
        <Button onClick={join} className="mt-3 h-12 w-full rounded-2xl">
          <Zap className="mr-2 h-4 w-4" /> Rejoindre le duel
        </Button>
      </Screen>
    );
  }

  // Lobby
  if (duel.status === "lobby") {
    return (
      <Screen title="Duel Tap ⚡" icon="⚡" subtitle={`Tu es ${isP1 ? duel.p1_name : duel.p2_name}`}>
        {!duel.p2_id ? (
          <>
            <div className="rounded-2xl bg-primary/10 p-5 text-center">
              <p className="text-xs text-muted-foreground mb-2">Code à partager</p>
              <p className="font-mono text-4xl font-bold tracking-[0.4em] text-primary">{code}</p>
            </div>
            <div className="flex gap-2 mt-3">
              <Button onClick={share} variant="outline" className="flex-1 h-11 rounded-2xl">
                <Share2 className="mr-2 h-4 w-4" /> Partager
              </Button>
              <Button onClick={() => { navigator.clipboard.writeText(code); toast.success("Copié !"); }}
                variant="outline" className="flex-1 h-11 rounded-2xl">
                <Copy className="mr-2 h-4 w-4" /> Copier
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-4 animate-pulse">En attente de ton adversaire…</p>
          </>
        ) : (
          <>
            <div className="rounded-2xl bg-primary/10 p-4 text-center">
              <p className="text-primary font-medium">{duel.p1_name} vs {duel.p2_name}</p>
              <p className="text-xs text-muted-foreground mt-1">Les deux joueurs sont prêts !</p>
            </div>
            {isP1 && (
              <Button onClick={() => supabase.from("duels").update({ status: "gage_input" }).eq("code", code)}
                className="mt-4 h-12 w-full rounded-2xl">
                Choisir le gage →
              </Button>
            )}
            {isP2 && <p className="text-center text-xs text-muted-foreground mt-4 animate-pulse">En attente du gage…</p>}
          </>
        )}
      </Screen>
    );
  }

  // Choix du gage (hôte)
  if (duel.status === "gage_input" && isP1) {
    return (
      <Screen title="Le gage" icon="🎯" subtitle="En cas de défaite, le perdant devra…">
        <div className="grid grid-cols-1 gap-2">
          {PRESET_GAGES.map((g) => (
            <button key={g} onClick={() => setGage(g)}
              className="rounded-2xl border border-primary/20 bg-white/70 px-4 py-3 text-left text-sm text-foreground transition hover:bg-primary/10 active:scale-[.98]">
              {g}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input value={gageInput} onChange={(e) => setGageInput(e.target.value)}
            placeholder="Gage personnalisé…" maxLength={80}
            className="h-11 rounded-2xl flex-1" />
          <Button onClick={() => gageInput.trim() && setGage(gageInput.trim())}
            disabled={!gageInput.trim()} className="h-11 rounded-2xl px-4">OK</Button>
        </div>
      </Screen>
    );
  }

  if (duel.status === "gage_input" && isP2) {
    return <Screen title="Le gage" icon="🎯" subtitle="L'adversaire choisit le gage…">
      <p className="text-center text-xs text-muted-foreground animate-pulse">En attente…</p>
    </Screen>;
  }

  // Confirmation du gage (P2)
  if (duel.status === "gage_confirm") {
    return (
      <Screen title="Le gage" icon="🎯">
        <div className="rounded-2xl bg-primary/10 p-5 text-center">
          <p className="text-xs text-muted-foreground mb-2">En cas de défaite</p>
          <p className="text-lg font-medium text-primary">"{duel.gage}"</p>
        </div>
        {isP2 && (
          <Button onClick={confirmGage} className="mt-4 h-12 w-full rounded-2xl">
            Accepter et lancer le duel ⚡
          </Button>
        )}
        {isP1 && <p className="text-center text-xs text-muted-foreground mt-4 animate-pulse">En attente que {duel.p2_name} accepte…</p>}
      </Screen>
    );
  }

  // Countdown 3-2-1
  if (duel.status === "countdown" || countdown !== null) {
    return (
      <Screen title={`Round ${duel.current_round}/${duel.total_rounds}`} icon="⏱">
        <ScoreBar duel={duel} myId={myId} />
        <AnimatePresence mode="wait">
          {countdown !== null && (
            <motion.div key={countdown}
              initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
              className="flex h-48 items-center justify-center">
              <span className="text-8xl font-bold text-primary">{countdown}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="text-center text-sm text-muted-foreground">Prépare-toi…</p>
      </Screen>
    );
  }

  // Phase ready / tap
  if (duel.status === "ready") {
    return (
      <Screen title={`Round ${duel.current_round}/${duel.total_rounds}`} icon="">
        <ScoreBar duel={duel} myId={myId} />
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8">
          <AnimatePresence mode="wait">
            {!signalVisible ? (
              <motion.div key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-center text-lg text-muted-foreground">Attend le signal…</p>
                <p className="text-center text-xs text-muted-foreground/60 mt-2">Ne tape pas trop tôt !</p>
              </motion.div>
            ) : (
              <motion.button key="tap"
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                onClick={tap} disabled={tapped}
                className={`flex h-52 w-52 flex-col items-center justify-center rounded-full shadow-xl transition active:scale-90
                  ${tapped ? "bg-primary/30" : "bg-primary cursor-pointer"}`}>
                <span className="text-6xl">{tapped ? "✅" : "❤️"}</span>
                <span className={`mt-3 text-xl font-bold ${tapped ? "text-primary" : "text-white"}`}>
                  {tapped ? "Tapé !" : "TAP !"}
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </Screen>
    );
  }

  // Résultat du round
  if (duel.status === "round_result") {
    const iWon = duel.round_winner_id === myId;
    return (
      <Screen title={`Round ${duel.current_round}/${duel.total_rounds}`} icon={iWon ? "🏆" : "💨"}>
        <ScoreBar duel={duel} myId={myId} />
        <div className="flex flex-col items-center justify-center gap-4 py-10">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}
            className="text-6xl">{iWon ? "🏆" : "💨"}</motion.div>
          <p className="text-center text-lg font-medium text-foreground">{roundResultMsg}</p>
          <p className="text-center text-sm text-muted-foreground animate-pulse">Prochain round…</p>
        </div>
      </Screen>
    );
  }

  // Fin de partie
  if (duel.status === "game_over") {
    const iWon = duel.game_winner_id === myId;
    const winnerName = duel.game_winner_id === duel.p1_id ? duel.p1_name : duel.p2_name;
    const loserName  = duel.game_winner_id === duel.p1_id ? duel.p2_name : duel.p1_name;
    return (
      <Screen title="Fin du duel !" icon={iWon ? "🏆" : "🎭"}>
        <ScoreBar duel={duel} myId={myId} />
        <div className="flex flex-col items-center gap-5 py-6">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}
            className="text-7xl">{iWon ? "🏆" : "🎭"}</motion.div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{winnerName} gagne !</p>
            <p className="text-sm text-muted-foreground mt-1">{duel.p1_score} — {duel.p2_score}</p>
          </div>
          <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-amber-600 mb-1">Le gage de {loserName}</p>
            <p className="text-base font-medium text-amber-900">"{duel.gage}"</p>
          </div>
          {isP1 && (
            <Button onClick={rematch} variant="outline" className="h-11 w-full rounded-2xl">
              🔄 Revanche !
            </Button>
          )}
        </div>
      </Screen>
    );
  }

  return null;
}

// ── Composants utilitaires ─────────────────────────────────────────────────

function Screen({ title, icon, subtitle, children }: {
  title: string; icon: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-5 pb-28 pt-6">
      <div className="mb-5 text-center">
        {icon && <div className="text-4xl mb-2">{icon}</div>}
        <h1 className="font-serif text-2xl text-primary">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ScoreBar({ duel, myId }: { duel: Duel; myId: string }) {
  const iP1 = duel.p1_id === myId;
  const myScore = iP1 ? duel.p1_score : duel.p2_score;
  const theirScore = iP1 ? duel.p2_score : duel.p1_score;
  const myName = iP1 ? duel.p1_name : (duel.p2_name || "Joueur 2");
  const theirName = iP1 ? (duel.p2_name || "Joueur 2") : duel.p1_name;

  return (
    <div className="mb-4 flex items-center justify-between rounded-2xl bg-primary/10 px-4 py-3">
      <div className="text-center flex-1">
        <p className="text-xs text-muted-foreground">{myName}</p>
        <p className="text-3xl font-bold text-primary">{myScore}</p>
      </div>
      <p className="text-lg font-bold text-primary/40 px-2">VS</p>
      <div className="text-center flex-1">
        <p className="text-xs text-muted-foreground">{theirName}</p>
        <p className="text-3xl font-bold text-primary">{theirScore}</p>
      </div>
    </div>
  );
}
