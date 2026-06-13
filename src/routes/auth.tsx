import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Mail, Lock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Se connecter — Princesse 💕" },
      { name: "description", content: "Connexion pour toi et ton amour." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/hub", replace: true });
    });

    // Détecte le retour depuis le lien de confirmation email
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") navigate({ to: "/hub", replace: true });
    });
    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/hub",
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;

        if (data.session) {
          // Auto-confirm activé → session immédiate
          toast.success("Bienvenue 💕");
          navigate({ to: "/hub", replace: true });
        } else {
          // Confirmation email envoyé
          setEmailSent(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes("Email not confirmed")) {
            throw new Error("Confirme d'abord ton email — vérifie ta boîte mail 📬");
          }
          if (error.message.includes("Invalid login credentials")) {
            throw new Error("Email ou mot de passe incorrect");
          }
          throw error;
        }
        navigate({ to: "/hub", replace: true });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/hub",
    });
    if (res.error) {
      toast.error((res.error as Error).message || "Erreur Google");
      setBusy(false);
      return;
    }
    if (res.redirected) return;
    navigate({ to: "/hub", replace: true });
  };

  const resendConfirmation = async () => {
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Email renvoyé 📬");
  };

  // Écran affiché si confirmation email requise
  if (emailSent) {
    return (
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary/15">
          <Mail className="h-12 w-12 text-primary" />
        </motion.div>
        <h1 className="mt-5 font-serif text-4xl text-primary">Vérifie ton email 📬</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          On a envoyé un lien de confirmation à<br />
          <b>{email}</b>.<br /><br />
          Clique dessus pour activer ton compte et te connecter.
        </p>
        <Button
          className="mt-8 h-12 w-full rounded-2xl"
          onClick={resendConfirmation}
          variant="outline"
          disabled={busy}
        >
          Renvoyer l'email
        </Button>
        <button
          onClick={() => { setEmailSent(false); setMode("signin"); }}
          className="mt-4 text-xs text-primary underline-offset-4 hover:underline"
        >
          Retour à la connexion
        </button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <Link to="/" className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> Retour
      </Link>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/15">
        <Heart className="h-10 w-10 fill-primary text-primary" />
      </motion.div>
      <h1 className="mt-4 text-center font-serif text-4xl text-primary">
        {mode === "signin" ? "Te revoilà 💕" : <><i>Bienvenue</i> chez nous</>}
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {mode === "signin"
          ? "Connecte-toi pour retrouver ton amour."
          : "Crée ton compte pour vous appairer et recevoir ses pensées."}
      </p>

      <Button
        type="button"
        variant="outline"
        className="mt-8 h-12 w-full rounded-2xl"
        disabled={busy}
        onClick={google}
      >
        Continuer avec Google
      </Button>

      <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <div className="relative">
            <Heart className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ton prénom"
              className="h-12 rounded-2xl pl-10"
            />
          </div>
        )}
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="h-12 rounded-2xl pl-10"
          />
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe (6+ caractères)"
            className="h-12 rounded-2xl pl-10"
          />
        </div>
        <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl">
          {mode === "signin" ? "Se connecter" : "Créer mon compte 💕"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-5 text-center text-xs text-primary underline-offset-4 hover:underline"
      >
        {mode === "signin"
          ? "Pas encore de compte ? Créer un compte"
          : "Déjà un compte ? Se connecter"}
      </button>
    </div>
  );
}