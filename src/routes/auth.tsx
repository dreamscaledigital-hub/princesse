import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Se connecter — Princesse 💕" }, { name: "description", content: "Connexion pour toi et ton amour." }] }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot" | "reset";

// ── Decorative SVG elements ─────────────────────────────────────────────────
function FloralBg() {
  return (
    <svg viewBox="0 0 400 800" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="p1" cx="20%" cy="15%" r="40%">
          <stop offset="0%" stopColor="oklch(0.75 0.13 355)" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="oklch(0.75 0.13 355)" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="p2" cx="80%" cy="80%" r="45%">
          <stop offset="0%" stopColor="oklch(0.60 0.16 0)" stopOpacity="0.16"/>
          <stop offset="100%" stopColor="oklch(0.60 0.16 0)" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="p3" cx="85%" cy="20%" r="35%">
          <stop offset="0%" stopColor="oklch(0.80 0.12 75)" stopOpacity="0.12"/>
          <stop offset="100%" stopColor="oklch(0.80 0.12 75)" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="800" fill="url(#p1)"/>
      <rect width="400" height="800" fill="url(#p2)"/>
      <rect width="400" height="800" fill="url(#p3)"/>
      {/* Decorative petals */}
      {[[40,60,30,355],[360,120,22,310],[70,680,26,45],[340,720,20,200],[200,40,18,90]].map(([x,y,r,rot],i)=>(
        <g key={i} transform={`translate(${x},${y}) rotate(${rot})`} opacity="0.35">
          <ellipse rx={r} ry={r*0.55} fill="none" stroke="oklch(0.75 0.13 355)" strokeWidth="1"/>
          <ellipse rx={r*0.65} ry={r*0.35} fill="none" stroke="oklch(0.60 0.16 0)" strokeWidth="0.7" opacity="0.6"/>
        </g>
      ))}
      {/* Scattered hearts */}
      {[[30,150,10],[370,350,8],[60,500,7],[330,600,9],[180,750,6]].map(([x,y,s],i)=>(
        <text key={i} x={x} y={y} fontSize={s} textAnchor="middle" opacity="0.2" fill="oklch(0.60 0.16 0)">♥</text>
      ))}
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode]           = useState<Mode>("signin");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy]           = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/hub", replace: true });
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") navigate({ to: "/hub", replace: true });
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: {
          emailRedirectTo: window.location.origin + "/auth",
          data: { display_name: displayName.trim() || email.split("@")[0] },
        }});
        if (error) throw error;
        if (data.session) { toast.success("Bienvenue 💕"); navigate({ to: "/hub", replace: true }); }
        else setEmailSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes("Email not confirmed")) throw new Error("Confirme ton email 📬");
          if (error.message.includes("Invalid login credentials")) throw new Error("Email ou mot de passe incorrect");
          throw error;
        }
        navigate({ to: "/hub", replace: true });
      }
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };

  const google = async () => {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/hub" });
    if (res.error) { toast.error((res.error as Error).message || "Erreur Google"); setBusy(false); return; }
    if (res.redirected) return;
    navigate({ to: "/hub", replace: true });
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/auth" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setResetSent(true);
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error("6 caractères minimum"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Mot de passe mis à jour 💕");
    navigate({ to: "/hub", replace: true });
  };

  const resendConfirmation = async () => {
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Email renvoyé 📬");
  };

  if (emailSent) return (
    <AuthShell>
      <div className="text-center">
        <MailIcon/> 
        <h1 className="mt-5 font-serif text-4xl text-primary">Regarde tes mails 💌</h1>
        <p className="mt-2 text-sm text-muted-foreground">Confirme ton adresse pour ouvrir votre petit nid.</p>
        <AuthBtn onClick={resendConfirmation} disabled={busy} className="mt-7">Renvoyer l'email</AuthBtn>
        <button onClick={()=>setEmailSent(false)} className="mt-4 block w-full text-center text-sm text-muted-foreground underline">Retour</button>
      </div>
    </AuthShell>
  );

  if (resetSent) return (
    <AuthShell>
      <div className="text-center">
        <MailIcon/>
        <h1 className="mt-5 font-serif text-4xl text-primary">Lien envoyé 💕</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ouvre le lien reçu par email.</p>
        <button onClick={()=>{setResetSent(false);setMode("signin");}} className="mt-6 text-sm text-muted-foreground underline">Retour</button>
      </div>
    </AuthShell>
  );

  if (mode === "forgot") return (
    <AuthShell>
      <button onClick={()=>setMode("signin")} className="mb-6 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition">
        ← Retour
      </button>
      <h1 className="font-serif text-4xl text-primary">Mot de passe oublié</h1>
      <p className="mt-2 text-sm text-muted-foreground">On t'envoie un lien pour revenir.</p>
      <form onSubmit={sendReset} className="mt-6 space-y-4">
        <AuthInput type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ton@email.fr" icon={<Mail className="h-4 w-4"/>} required/>
        <AuthBtn type="submit" disabled={busy}>Recevoir le lien</AuthBtn>
      </form>
    </AuthShell>
  );

  if (mode === "reset") return (
    <AuthShell>
      <h1 className="font-serif text-4xl text-primary">Nouveau mot de passe</h1>
      <p className="mt-2 text-sm text-muted-foreground">Choisis un nouveau mot de passe.</p>
      <form onSubmit={updatePassword} className="mt-6 space-y-4">
        <PasswordInput value={newPassword} onChange={e=>setNewPassword(e.target.value)}
          shown={showPassword} onToggle={()=>setShowPassword(v=>!v)} placeholder="Nouveau mot de passe"/>
        <AuthBtn type="submit" disabled={busy}>Enregistrer</AuthBtn>
      </form>
    </AuthShell>
  );

  const isSignup = mode === "signup";

  return (
    <AuthShell>
      <Link to="/" className="mb-6 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition">
        ← Jeux
      </Link>

      {/* Hero */}
      <div className="mb-8 text-center">
        <motion.div initial={{scale:0.7,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:"spring",stiffness:200,damping:16}}
          className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full"
          style={{background:"linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))",
            boxShadow:"0 16px 40px oklch(0.60 0.16 0 / 0.28), 0 6px 16px oklch(0.75 0.13 355 / 0.22), inset 0 1px 0 rgba(255,255,255,0.7)"}}>
          <Heart className="h-10 w-10 fill-primary text-primary animate-heartbeat"/>
        </motion.div>
        <h1 className="font-serif text-5xl leading-tight text-primary">
          {isSignup ? "Crée ton compte" : "Bienvenue"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSignup ? "Prépare votre nid à deux." : "Retrouve votre petit cocon."}
        </p>
      </div>

      {/* Google */}
      <button type="button" onClick={google} disabled={busy}
        className="flex h-13 w-full items-center justify-center gap-3 rounded-2xl text-sm font-semibold transition active:scale-[0.98]"
        style={{background:"rgba(255,255,255,0.85)", backdropFilter:"blur(12px)",
          border:"1px solid rgba(255,255,255,0.75)", color:"oklch(0.28 0.05 358)",
          boxShadow:"0 4px 16px oklch(0.60 0.16 0 / 0.08), inset 0 1px 0 rgba(255,255,255,0.95)"}}>
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continuer avec Google
      </button>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1" style={{background:"linear-gradient(to right,transparent,oklch(0.75 0.13 355 / 0.3))"}}/>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">ou</span>
        <div className="h-px flex-1" style={{background:"linear-gradient(to left,transparent,oklch(0.75 0.13 355 / 0.3))"}}/>
      </div>

      {/* Form */}
      <form onSubmit={submit} className="space-y-3">
        <AnimatePresence initial={false}>
          {isSignup && (
            <motion.div key="name" initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
              <AuthInput value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Ton prénom"/>
            </motion.div>
          )}
        </AnimatePresence>
        <AuthInput type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ton@email.fr"
          icon={<Mail className="h-4 w-4"/>} required/>
        <PasswordInput value={password} onChange={e=>setPassword(e.target.value)}
          shown={showPassword} onToggle={()=>setShowPassword(v=>!v)} placeholder="Mot de passe" minLength={6} required/>
        <AuthBtn type="submit" disabled={busy} className="mt-2">
          {isSignup ? "Créer mon compte" : "Se connecter"}
        </AuthBtn>
      </form>

      <div className="mt-6 space-y-3 text-center text-sm">
        {!isSignup && (
          <button onClick={()=>setMode("forgot")} className="text-muted-foreground underline hover:text-primary transition">
            Mot de passe oublié ?
          </button>
        )}
        <div>
          <button onClick={()=>setMode(isSignup?"signin":"signup")} className="font-medium text-primary underline">
            {isSignup ? "J'ai déjà un compte" : "Créer un compte"}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────
function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-0">
      <FloralBg/>
      <motion.div initial={{y:16,opacity:0}} animate={{y:0,opacity:1}} transition={{duration:0.45,ease:"easeOut"}}
        className="relative z-10 w-full max-w-sm rounded-none px-7 py-10 sm:rounded-[36px]"
        style={{background:"rgba(255,255,255,0.82)", backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)",
          border:"1px solid rgba(255,255,255,0.78)",
          boxShadow:"0 32px 80px oklch(0.60 0.16 0 / 0.14), 0 12px 32px oklch(0.75 0.13 355 / 0.12), inset 0 1px 0 rgba(255,255,255,0.95)"}}>
        {children}
      </motion.div>
    </main>
  );
}

// ── Shared atoms ──────────────────────────────────────────────────────────────
function MailIcon() {
  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
      style={{background:"linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))",
        boxShadow:"0 8px 24px oklch(0.60 0.16 0 / 0.22)"}}>
      <Mail className="h-7 w-7 text-primary"/>
    </div>
  );
}

function AuthInput({ icon, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }) {
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">{icon}</span>}
      <input {...props}
        className={"h-13 w-full rounded-2xl text-sm font-medium outline-none transition placeholder:text-muted-foreground/60 " + (className||"")}
        style={{background:"oklch(0.97 0.015 350)", border:"1px solid oklch(0.84 0.055 350 / 0.5)",
          paddingLeft: icon ? 44 : 18, paddingRight: 18, color:"oklch(0.22 0.06 358)"}}/>
    </div>
  );
}

function PasswordInput({ shown, onToggle, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { shown: boolean; onToggle: ()=>void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
        <Lock className="h-4 w-4"/>
      </span>
      <input {...props} type={shown?"text":"password"}
        className="h-13 w-full rounded-2xl text-sm font-medium outline-none transition placeholder:text-muted-foreground/60"
        style={{background:"oklch(0.97 0.015 350)", border:"1px solid oklch(0.84 0.055 350 / 0.5)",
          paddingLeft:44, paddingRight:48, color:"oklch(0.22 0.06 358)"}}/>
      <button type="button" onClick={onToggle}
        className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground transition hover:text-primary">
        {shown ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
      </button>
    </div>
  );
}

function AuthBtn({ children, className, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) {
  return (
    <button {...props} disabled={disabled}
      className={"flex h-13 w-full items-center justify-center rounded-2xl text-sm font-semibold text-white transition active:scale-[0.97] disabled:opacity-50 " + (className||"")}
      style={{background:"linear-gradient(135deg,#e88aab,#c45c7c)",
        boxShadow: disabled ? "none" : "0 8px 24px oklch(0.60 0.16 0 / 0.34), inset 0 1px 0 rgba(255,255,255,0.18)"}}>
      {children}
    </button>
  );
}
