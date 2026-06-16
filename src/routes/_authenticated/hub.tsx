import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Bell, BellOff, Send, LogOut, Copy, Sparkles, ArrowLeft, Share2, RefreshCw, Unlink, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/Avatar";
import { DailyRitual } from "@/components/DailyRitual";
import {
  subscribeToPush,
  sendPensee,
  pushPermissionState,
  getNotifStatus,
  isIOS,
  isStandalonePWA,
} from "@/lib/push-client";
import { InstallPrompt } from "@/components/InstallPrompt";


export const Route = createFileRoute("/_authenticated/hub")({
  head: () => ({ meta: [{ title: "Notre nid 💕 — Princesse" }] }),
  component: HubPage,
});

type Profile = { id: string; display_name: string; avatar_emoji: string; avatar_style?: string | null; avatar_options?: Record<string, unknown> | null };
type Couple = { id: string; user_a: string; user_b: string };

function genCode(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

const QUICK_MESSAGES = [
  "Tu me manques 🥺",
  "Je pense à toi 💕",
  "Coucou toi 😘",
  "Je t'aime fort 🤍",
];

function HubPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [justPaired, setJustPaired] = useState(false);

  // Pair state
  const [myCode, setMyCode] = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [pairBusy, setPairBusy] = useState(false);

  // Pensee state
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);

  useEffect(() => {
    const p = pushPermissionState();
    setPerm(p);
    void loadAll();
    // Si la permission est déjà accordée, on s'assure que l'abonnement est en base
    if (p === "granted") {
      subscribeToPush().then((res) => {
        if (res.ok) setPerm("granted");
      });
    }
  }, []);

  // Realtime + poll de secours : dès qu'un couple m'inclut, recharger
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
    (async () => {
      const { data: ures } = await supabase.auth.getUser();
      const uid = ures.user?.id;
      if (!uid || cancelled) return;
      channel = supabase
        .channel(`couples-watch-${uid}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "couples" },
          (payload) => {
            const row = payload.new as Couple;
            if (row.user_a === uid || row.user_b === uid) void loadAll();
          },
        )
        .subscribe();
      pollId = setInterval(() => {
        if (!couple) void loadAll();
      }, 4000);
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (pollId) clearInterval(pollId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id]);

  async function loadAll(fromPairing = false) {
    const { data: ures } = await supabase.auth.getUser();
    const uid = ures.user?.id;
    if (!uid) {
      navigate({ to: "/auth", replace: true });
      return;
    }

    const meta = (ures.user?.user_metadata || {}) as { display_name?: string; full_name?: string; name?: string };
    const fallbackName =
      meta.display_name || meta.full_name || meta.name || ures.user?.email?.split("@")[0] || "Mon amour";
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (!prof) {
      const { data: created } = await supabase
        .from("profiles")
        .upsert({ id: uid, display_name: fallbackName }, { onConflict: "id" })
        .select("*")
        .maybeSingle();
      setMe((created as Profile) || { id: uid, display_name: fallbackName, avatar_emoji: "💕" });
    } else {
      setMe(prof as Profile);
    }

    const { data: c } = await supabase
      .from("couples")
      .select("*")
      .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      .maybeSingle();
    if (c) {
      setCouple(c as Couple);
      if (fromPairing) setJustPaired(true);
      const partnerId = c.user_a === uid ? c.user_b : c.user_a;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle();
      setPartner((p as Profile) || null);
    } else {
      setCouple(null);
      setPartner(null);
    }
    setLoading(false);
  }

  async function createPairingCode() {
    setPairBusy(true);
    try {
      const code = genCode();
      const { data: ures } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("pairing_codes")
        .insert({ code, created_by: ures.user!.id });
      if (error) throw error;
      setMyCode(code);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPairBusy(false);
    }
  }

  async function consumeCode() {
    const code = enteredCode.trim().toUpperCase();
    if (code.length < 4) return toast.error("Code invalide");
    setPairBusy(true);
    try {
      const { error } = await supabase.rpc("consume_pairing_code", { _code: code });
      if (error) throw error;
      toast.success("Appairés 💞");
      await loadAll(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPairBusy(false);
    }
  }

  async function enablePush() {
    setSubscribing(true);
    const res = await subscribeToPush();
    setPerm(pushPermissionState());
    setSubscribing(false);
    if (res.ok) {
      toast.success("Notifications activées 🔔");
      setJustPaired(false);
    } else {
      toast.error(res.reason || "Impossible d'activer");
    }
  }

  async function diagnose() {
    setDiagnosing(true);
    const lines: string[] = [];

    // 1. URL de production ?
    const { canRegisterSW } = await import("@/lib/sw-register");
    if (canRegisterSW()) {
      lines.push("✅ URL de production détectée");
    } else {
      lines.push("❌ URL de prévisualisation — les notifications sont désactivées ici");
      lines.push("   👉 Ouvre l'URL de production Lovable (pas la preview)");
    }

    // 2. Permission navigateur
    const p = pushPermissionState();
    if (p === "granted") lines.push("✅ Permission notifications accordée");
    else if (p === "denied") lines.push("❌ Permission refusée — autorise dans les réglages du navigateur");
    else if (p === "unsupported") lines.push("❌ Notifications non supportées sur cet appareil");
    else lines.push("⚠️  Permission pas encore demandée — clique Activer");

    // 3. Clés VAPID (fonctionne avec ancienne et nouvelle version de la fonction)
    try {
      await (await import("@/lib/push-client")).fetchVapidPublicKey();
      lines.push("✅ Clés VAPID configurées dans Supabase");
    } catch (e) {
      lines.push(`❌ VAPID: ${(e as Error).message}`);
    }

    // 4. Diagnostic complet (nécessite la nouvelle version de la fonction)
    const status = await getNotifStatus();
    if (status) {
      lines.push(status.coupled ? "✅ Couple trouvé en base" : "❌ Pas encore appairé");
      lines.push(status.mySubCount > 0
        ? `✅ Ton abonnement push actif (${status.mySubCount})`
        : "❌ Tu n'as pas d'abonnement push — clique Activer sur l'URL de prod");
      lines.push(status.partnerSubCount > 0
        ? `✅ Abonnement partenaire actif (${status.partnerSubCount})`
        : "❌ Ton amour n'a pas encore activé ses notifications");
    } else {
      lines.push("⚠️  Diagnostic DB indisponible (redéploie la fonction dans Supabase)");
    }

    setDiagnosing(false);
    toast(lines.join("\n"), { duration: 12000 });
  }

  async function send(text: string) {
    const msg = text.trim();
    if (!msg) return;
    if (msg.length > 140) return toast.error("Message trop long (140 max)");
    setSending(true);
    const res = await sendPensee(msg);
    setSending(false);
    if (res.ok) {
      toast.success(`Envoyé à ${partner?.display_name || "ton amour"} 💌`);
      setMessage("");
    } else {
      toast.error(res.reason || "Échec de l'envoi");
    }
  }

  async function unpair() {
    if (!couple) return;
    const confirmed = window.confirm("Se désappairer ? Vous pourrez vous réappairer avec quelqu'un d'autre.");
    if (!confirmed) return;
    const { error } = await supabase.from("couples").delete().eq("id", couple.id);
    if (error) { toast.error(error.message); return; }
    setCouple(null);
    setPartner(null);
    setJustPaired(false);
    setMyCode(null);
    toast.success("Désappairés — tu peux te réappairer 💔");
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">…</div>;
  }

  return (
    <div className="relative mx-auto min-h-screen max-w-md px-5 py-8">
      <div className="flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" /> Jeux
        </Link>
        <button onClick={logout} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
          <LogOut className="h-3 w-3" /> Déconnexion
        </button>
      </div>

      <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-4 text-center">
        <div className="mx-auto inline-flex items-center justify-center rounded-full border-4 border-white bg-white/70 p-1 shadow-md">
          <Avatar style={me?.avatar_style} options={(me?.avatar_options as never) || {}} fallbackEmoji={me?.avatar_emoji} size={72} />
        </div>
        <h1 className="mt-3 font-serif text-4xl text-primary">
          Notre <i>nid</i>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Salut {me?.display_name} 💕</p>
      </motion.div>

      {!couple ? (
        <PairUI
          myCode={myCode}
          onCreate={createPairingCode}
          enteredCode={enteredCode}
          setEnteredCode={setEnteredCode}
          onConsume={consumeCode}
          busy={pairBusy}
        />
      ) : (
        <div className="mt-6 space-y-5">
          {me && partner && (
            <DailyRitual
              myId={me.id}
              partnerId={partner.id}
              partnerName={partner.display_name || "ton amour"}
            />
          )}
          <PenseeUI
            partnerName={partner?.display_name || "ton amour"}
            perm={perm}
            onEnable={enablePush}
            subscribing={subscribing}
            diagnosing={diagnosing}
            onDiagnose={diagnose}
            quick={QUICK_MESSAGES}
            message={message}
            setMessage={setMessage}
            send={send}
            sending={sending}
            justPaired={justPaired}
            onUnpair={unpair}
          />
        </div>
      )}


      <InstallPrompt />
    </div>
  );
}

function PairUI({
  myCode, onCreate, enteredCode, setEnteredCode, onConsume, busy,
}: {
  myCode: string | null;
  onCreate: () => void;
  enteredCode: string;
  setEnteredCode: (s: string) => void;
  onConsume: () => void;
  busy: boolean;
}) {
  async function shareCode() {
    if (!myCode) return;
    const text = `Rejoins-moi sur Princesse 💕 — entre le code ${myCode} dans l'appli !`;
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch {}
    }
    await navigator.clipboard.writeText(myCode);
    toast.success("Code copié 💖");
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-3xl border border-primary/20 bg-white/70 p-5 shadow-sm backdrop-blur">
        <h2 className="text-center font-serif text-2xl text-primary">S'appairer 💞</h2>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          L'un génère un code, l'autre le saisit. Vous serez liés pour toujours 💕
        </p>

        {myCode ? (
          <div className="mt-5 rounded-2xl bg-primary/10 p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-primary/70">Donne ce code à ton amour</p>
            <p className="mt-2 font-mono text-4xl font-bold tracking-[0.4em] text-primary">{myCode}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Valide 15 minutes</p>
            <div className="mt-3 flex justify-center gap-3">
              <button
                className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-primary shadow-sm transition active:scale-95"
                onClick={shareCode}
              >
                <Share2 className="h-3 w-3" /> Partager
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-primary shadow-sm transition active:scale-95"
                onClick={() => { navigator.clipboard.writeText(myCode); toast.success("Copié 💖"); }}
              >
                <Copy className="h-3 w-3" /> Copier
              </button>
            </div>
          </div>
        ) : (
          <Button onClick={onCreate} disabled={busy} className="mt-4 h-12 w-full rounded-2xl">
            <Sparkles className="mr-2 h-4 w-4" /> Générer mon code
          </Button>
        )}

        <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> j'ai reçu un code <div className="h-px flex-1 bg-border" />
        </div>

        <Input
          placeholder="Entre le code de ton amour"
          value={enteredCode}
          onChange={(e) => setEnteredCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="h-12 rounded-2xl text-center text-lg font-semibold tracking-[0.4em]"
        />
        <Button
          onClick={onConsume}
          disabled={busy || enteredCode.trim().length < 4}
          variant="secondary"
          className="mt-2 h-12 w-full rounded-2xl"
        >
          Nous appairer 💞
        </Button>
      </div>
    </div>
  );
}

function PenseeUI({
  partnerName, perm, onEnable, subscribing, diagnosing, onDiagnose, quick, message, setMessage, send, sending, justPaired, onUnpair,
}: {
  partnerName: string;
  perm: NotificationPermission | "unsupported";
  onEnable: () => void;
  subscribing: boolean;
  diagnosing: boolean;
  onDiagnose: () => void;
  quick: string[];
  message: string;
  setMessage: (s: string) => void;
  send: (s: string) => void;
  sending: boolean;
  justPaired: boolean;
  onUnpair: () => void;
}) {
  const ios = isIOS();
  const standalone = isStandalonePWA();
  const needsInstall = ios && !standalone;
  const notifActive = perm === "granted";
  const notifDenied = perm === "denied";

  return (
    <div className="mt-6 space-y-5">
      {/* Bannière post-appairage */}
      {justPaired && !notifActive && !needsInstall && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-primary/10 p-4 text-center"
        >
          <p className="font-serif text-lg text-primary">Vous êtes appairés 💞</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Active les notifications pour recevoir les pensées de {partnerName}.
          </p>
          <Button onClick={onEnable} disabled={subscribing} className="mt-3 h-10 rounded-2xl px-6">
            <Bell className="mr-2 h-4 w-4" /> Activer les notifications
          </Button>
        </motion.div>
      )}

      {/* Notifications */}
      <div className="rounded-3xl border border-primary/20 bg-card/80 p-4 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          {notifActive ? (
            <Bell className="h-5 w-5 shrink-0 text-primary" />
          ) : (
            <BellOff className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {notifActive ? "Notifications activées" : "Notifications à activer"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {needsInstall
                ? "Sur iPhone, ajoute l'app à l'écran d'accueil avant d'activer les notifications."
                : notifDenied
                  ? "Les notifications sont bloquées dans les réglages du navigateur."
                  : `Pour recevoir les pensées de ${partnerName}.`}
            </p>
          </div>
        </div>
        {!notifActive && !needsInstall && !notifDenied && (
          <Button onClick={onEnable} disabled={subscribing} className="mt-4 h-11 w-full rounded-2xl">
            {subscribing ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Bell className="mr-2 h-4 w-4" />
            )}
            Activer
          </Button>
        )}
        <button
          onClick={onDiagnose}
          disabled={diagnosing}
          className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
        >
          {diagnosing
            ? <RefreshCw className="h-3 w-3 animate-spin" />
            : <Stethoscope className="h-3 w-3" />}
          {diagnosing ? "Diagnostic…" : "Diagnostiquer les notifications"}
        </button>
      </div>

      {/* Message */}
      <div className="rounded-3xl border border-primary/20 bg-card/80 p-4 shadow-sm backdrop-blur">
        <h2 className="font-serif text-2xl text-primary">Pensée pour {partnerName}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {quick.map((text) => (
            <Button
              key={text}
              type="button"
              variant="outline"
              disabled={sending}
              onClick={() => send(text)}
              className="min-h-11 rounded-2xl px-3 text-sm"
            >
              {text}
            </Button>
          ))}
        </div>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={140}
          placeholder="Écris-lui une petite pensée…"
          className="mt-3 min-h-24 resize-none rounded-2xl"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[10px] text-muted-foreground">{message.length}/140</span>
          <Button onClick={() => send(message)} disabled={sending || !message.trim()} className="h-11 rounded-2xl px-5">
            <Send className="mr-2 h-4 w-4" />
            Envoyer
          </Button>
        </div>
      </div>

      <Button type="button" variant="ghost" onClick={onUnpair} className="h-11 w-full rounded-2xl text-muted-foreground">
        <Unlink className="mr-2 h-4 w-4" />
        Se désappairer
      </Button>
    </div>
  );
}