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
      { name: "description", content: "Connexion pour Eloise et toi." },
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/hub", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/hub",
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Compte créé 💕 Connecte-toi !");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
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
        {mode === "signin" ? "Connecte-toi pour retrouver ton amour." : "Crée ton compte pour vous appairer et recevoir ses pensées."}
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

      <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> ou avec email <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <div className="relative">
            <Input
              placeholder="Ton prénom (ex: Eloïse)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-12 rounded-2xl pl-4"
              maxLength={40}
            />
          </div>
        )}
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-2xl pl-10"
            autoComplete="email"
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="password"
            required
            minLength={6}
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-2xl pl-10"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </div>
        <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl">
          {mode === "signin" ? "Se connecter" : "Créer mon compte"}
        </Button>
      </form>

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-5 text-center text-xs text-primary underline-offset-4 hover:underline"
        type="button"
      >
        {mode === "signin" ? "Pas encore de compte ? Inscris-toi" : "Déjà un compte ? Connecte-toi"}
      </button>
    </div>
  );
}
