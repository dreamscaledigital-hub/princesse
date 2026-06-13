import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Mail, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react";
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

type Mode = "signin" | "signup" | "forgot" | "reset";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    // Redirige si déjà connecté
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/hub", replace: true });
    });

    // Écoute les événements auth :
    // - SIGNED_IN : après confirmation email ou retour OAuth → /hub
    // - PASSWORD_RECOVERY : retour depuis le lien de reset → formulaire nouveau mdp
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        navigate({ to: "/hub", replace: true });
      }
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  // ── Inscription / Connexion ──────────────────────────────────────────────
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/auth",
            data: { display_name: displayName.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.session) {
          // Auto-confirm activé → session immédiate
          toast.success("Bienvenue 💕");
          navigate({ to: "/hub", replace: true });
        } else {
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

  // ── Google OAuth ─────────────────────────────────────────────────────────
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

  // ── Renvoyer email de confirmation ───────────────────────────────────────
  const resendConfirmation = async () => {
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Email renvoyé 📬");
  };

  // ── Mot de passe oublié ──────────────────────────────────────────────────
  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/auth",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setResetSent(true);
  };

  // ── Nouveau mot de passe (après clic sur le lien) ────────────────────────
  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("6 caractères minimum");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Mot de passe mis à jour 💕");
    navigate({ to: "/hub", replace: true });
  };

  // ── Écrans spéciaux ──────────────────────────────────────────────────────

  // Email de confirmation envoyé
  if (emailSent) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-4 font-serif text-3xl text-primary">Regarde tes mails 💌</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Confirme ton adresse pour ouvrir votre petit nid.
          </p>
          <Button onClick={resendConfirmation} disabled={busy} className="mt-6 h-12 w-full rounded-2xl">
            Renvoyer l'email
          </Button>
          <button
            type="button"
            onClick={() => setEmailSent(false)}
            className="mt-4 text-sm text-muted-foreground underline"
          >
            Retour
          </button>
        </div>
      </AuthShell>
    );
  }

  if (resetSent) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-4 font-serif text-3xl text-primary">Lien envoyé 💕</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ouvre le lien reçu par email pour choisir un nouveau mot de passe.
          </p>
          <button
            type="button"
            onClick={() => { setResetSent(false); setMode("signin"); }}
            className="mt-6 text-sm text-muted-foreground underline"
          >
            Retour à la connexion
          </button>
        </div>
      </AuthShell>
    );
  }

  if (mode === "forgot") {
    return (
      <AuthShell>
        <button
          type="button"
          onClick={() => setMode("signin")}
          className="mb-6 inline-flex items-center gap-1 text-xs text-muted-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Retour
        </button>
        <h1 className="font-serif text-4xl text-primary">Mot de passe oublié</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          On t'envoie un lien pour revenir dans votre nid.
        </p>
        <form onSubmit={sendReset} className="mt-6 space-y-4">
          <FieldIcon icon={<Mail className="h-4 w-4" />}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.fr"
              required
              className="h-12 rounded-2xl pl-10"
            />
          </FieldIcon>
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl">
            Recevoir le lien
          </Button>
        </form>
      </AuthShell>
    );
  }

  if (mode === "reset") {
    return (
      <AuthShell>
        <h1 className="font-serif text-4xl text-primary">Nouveau mot de passe</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choisis un mot de passe pour ton compte.</p>
        <form onSubmit={updatePassword} className="mt-6 space-y-4">
          <FieldIcon icon={<Lock className="h-4 w-4" />}>
            <Input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nouveau mot de passe"
              minLength={6}
              required
              className="h-12 rounded-2xl px-10"
            />
            <PasswordToggle shown={showPassword} onClick={() => setShowPassword((v) => !v)} />
          </FieldIcon>
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl">
            Enregistrer
          </Button>
        </form>
      </AuthShell>
    );
  }

  const isSignup = mode === "signup";

  return (
    <AuthShell>
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowLeft className="h-3 w-3" /> Jeux
      </Link>

      <div className="text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15"
        >
          <Heart className="h-8 w-8 fill-primary text-primary" />
        </motion.div>
        <h1 className="mt-4 font-serif text-4xl text-primary">
          {isSignup ? "Créer ton compte" : "Bienvenue"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSignup ? "Prépare votre nid à deux." : "Retrouve votre petit cocon."}
        </p>
      </div>

      <Button type="button" variant="secondary" onClick={google} disabled={busy} className="mt-7 h-12 w-full rounded-2xl">
        Continuer avec Google
      </Button>

      <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <AnimatePresence initial={false}>
          {isSignup && (
            <motion.div
              key="display-name"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ton prénom"
                className="h-12 rounded-2xl"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <FieldIcon icon={<Mail className="h-4 w-4" />}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ton@email.fr"
            required
            className="h-12 rounded-2xl pl-10"
          />
        </FieldIcon>

        <FieldIcon icon={<Lock className="h-4 w-4" />}>
          <Input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            minLength={6}
            required
            className="h-12 rounded-2xl px-10"
          />
          <PasswordToggle shown={showPassword} onClick={() => setShowPassword((v) => !v)} />
        </FieldIcon>

        <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl">
          {isSignup ? "Créer mon compte" : "Se connecter"}
        </Button>
      </form>

      <div className="mt-5 space-y-3 text-center text-sm">
        {!isSignup && (
          <button type="button" onClick={() => setMode("forgot")} className="text-muted-foreground underline">
            Mot de passe oublié ?
          </button>
        )}
        <div>
          <button
            type="button"
            onClick={() => setMode(isSignup ? "signin" : "signup")}
            className="text-primary underline"
          >
            {isSignup ? "J'ai déjà un compte" : "Créer un compte"}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-8">
      <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        {children}
      </motion.div>
    </main>
  );
}

function FieldIcon({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
        {icon}
      </span>
      {children}
    </div>
  );
}

function PasswordToggle({ shown, onClick }: { shown: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
    >
      {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}