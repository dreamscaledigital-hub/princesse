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
      <div cla