import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Bell, BellOff, Send, LogOut, Copy, Sparkles, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  subscribeToPush,
  sendPensee,
  pushPermissionState,
  isIOS,
  isStandalonePWA,
} from "@/lib/push-client";
import { InstallPrompt } from "@/components/InstallPrompt";

export const Route = createFileRoute("/_authenticated/hub")({
  head: () => ({ meta: [{ title: "Notre nid 💕 — Princesse" }] }),
  component: HubPage,
});

type Profile = { id: string; display_name: string; avatar_emoji: string };
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

  // Pair state
  const [myCode, setMyCode] = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [pairBusy, setPairBusy] = useState(false);

  // Pensee state
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    setPerm(pushPermissionState());
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const { data: ures } = await supabase.auth.getUser();
    const uid = ures.user?.id;
    if (!uid) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    setMe((prof as Profile) || { id: uid, display_name: "Moi", avatar_emoji: "💕" });

    const { data: c } = await supabase
      .from("couples")
      .select("*")
      .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      .maybeSingle();
    if (c) {
      setCouple(c as Couple);
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
      await loadAll();
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
    if (res.ok) toast.success("Notifications activées 🔔");
    else toast.error(res.reason || "Impossible d'activer");
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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <Heart className="h-8 w-8 fill-primary text-primary" />
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
        <PenseeUI
          partnerName={partner?.display_name || "ton amour"}
          perm={perm}
          onEnable={enablePush}
          subscribing={subscribing}
          quick={QUICK_MESSAGES}
          message={message}
          setMessage={setMessage}
          send={send}
          sending={sending}
        />
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
  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-3xl border border-primary/20 bg-white/70 p-5 shadow-sm backdrop-blur">
        <p className="text-center text-[10px] uppercase tracking-[0.3em] text-primary/70">étape 1</p>
        <h2 className="mt-2 text-center font-serif text-2xl text-primary">S'appairer 💞</h2>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Un seul d'entre vous génère un code, l'autre le saisit. Ensuite vous êtes liés pour toujours.
        </p>

        {myCode ? (
          <div className="mt-5 rounded-2xl bg-primary/10 p-4 text-center">
            <p className="text-[10px] uppercase tracking-wider text-primary/70">Donne ce code à ton amour</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.4em] text-primary">{myCode}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Valide 15 minutes</p>
            <button
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={() => { navigator.clipboard.writeText(myCode); toast.success("Copié 💖"); }}
            >
              <Copy className="h-3 w-3" /> Copier
            </button>
          </div>
        ) : (
          <Button onClick={onCreate} disabled={busy} className="mt-4 h-12 w-full rounded-2xl">
            <Sparkles className="mr-2 h-4 w-4" /> Générer un code
          </Button>
        )}

        <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
        </div>

        <Input
          placeholder="Code reçu de ton amour"
          value={enteredCode}
          onChange={(e) => setEnteredCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="h-12 rounded-2xl text-center text-lg font-semibold tracking-[0.4em]"
        />
        <Button onClick={onConsume} disabled={busy} variant="secondary" className="mt-2 h-12 w-full rounded-2xl">
          Nous appairer
        </Button>
      </div>
    </div>
  );
}

function PenseeUI({
  partnerName, perm, onEnable, subscribing, quick, message, setMessage, send, sending,
}: {
  partnerName: string;
  perm: NotificationPermission | "unsupported";
  onEnable: () => void;
  subscribing: boolean;
  quick: string[];
  message: string;
  setMessage: (s: string) => void;
  send: (s: string) => void;
  sending: boolean;
}) {
  const ios = isIOS();
  const standalone = isStandalonePWA();
  const needsInstall = ios && !standalone;

  return (
    <div className="mt-6 space-y-5">
      {/* Notifications card */}
      <div className="rounded-3xl border border-primary/20 bg-white/70 p-4 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          {perm === "granted" ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
          <div className="flex-1">
            <p className="font-serif text-base text-primary">Notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {perm === "granted"
                ? "Tu reçois les pensées de ton amour 💕"
                : perm === "denied"
                  ? "Refusées — autorise-les dans les réglages du navigateur."
                  : "Active pour recevoir les pensées."}
            </p>
          </div>
          {perm !== "granted" && perm !== "denied" && perm !== "unsupported" && (
            <Button size="sm" onClick={onEnable} disabled={subscribing}>Activer</Button>
          )}
        </div>
        {needsInstall && (
          <p className="mt-3 rounded-xl bg-blossom-cream/60 p-2 text-[11px] text-primary/80">
            📲 Sur iPhone : il faut <b>installer l'appli sur l'écran d'accueil</b> (Partager → Sur l'écran d'accueil) <i>avant</i> d'activer les notifs.
          </p>
        )}
      </div>

      {/* Envoyer une pensée */}
      <div className="rounded-3xl border border-primary/20 bg-white/70 p-5 shadow-sm backdrop-blur">
        <h2 className="text-center font-serif text-2xl text-primary">
          Envoyer une pensée <i className="text-blossom-rose">à {partnerName}</i> 💌
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {quick.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={sending}
              className="rounded-2xl border border-primary/15 bg-white/60 px-3 py-3 text-sm font-medium text-primary shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Textarea
            placeholder="…ou écris ton petit mot"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={140}
            rows={2}
            className="resize-none rounded-2xl"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{message.length}/140</span>
            <Button size="sm" onClick={() => send(message)} disabled={sending || !message.trim()}>
              <Send className="mr-1 h-3 w-3" /> Envoyer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
