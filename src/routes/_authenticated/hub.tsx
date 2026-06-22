import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Bell, BellOff, Send, LogOut, Copy, Sparkles, Share2, RefreshCw, Unlink, Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/Avatar";
import { DailyRitual } from "@/components/DailyRitual";
import {
  subscribeToPush, sendPensee, pushPermissionState, getNotifStatus, isIOS, isStandalonePWA,
} from "@/lib/push-client";
import { InstallPrompt } from "@/components/InstallPrompt";
import type { LoveBombPayload } from "@/components/LoveBombOverlay";

export const Route = createFileRoute("/_authenticated/hub")({
  head: () => ({ meta: [{ title: "Notre nid 💕 — Princesse" }] }),
  component: HubPage,
});

type Profile = { id: string; display_name: string; avatar_emoji: string; avatar_style?: string | null; avatar_options?: Record<string, unknown> | null };
type Couple  = { id: string; user_a: string; user_b: string };

function genCode(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

const QUICK_MESSAGES = ["Tu me manques 🥺", "Je pense à toi 💕", "Coucou toi 😘", "Je t'aime fort 🤍"];

// ── Decorative SVG rose ───────────────────────────────────────────────────────
function RoseDeco({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      <g opacity="0.55">
        <circle cx="40" cy="40" r="8" fill="none" stroke="currentColor" strokeWidth="1.2"/>
        {[0,45,90,135,180,225,270,315].map((a,i)=>{
          const r = (a*Math.PI)/180;
          const x = 40+22*Math.cos(r); const y = 40+22*Math.sin(r);
          return <ellipse key={i} cx={x} cy={y} rx="9" ry="5.5"
            transform={`rotate(${a+90},${x},${y})`}
            fill="none" stroke="currentColor" strokeWidth="1" opacity={0.7-(i*0.03)}/>;
        })}
        {[0,60,120,180,240,300].map((a,i)=>{
          const r=(a*Math.PI)/180;
          const x=40+36*Math.cos(r); const y=40+36*Math.sin(r);
          return <ellipse key={i} cx={x} cy={y} rx="10" ry="6"
            transform={`rotate(${a+90},${x},${y})`}
            fill="none" stroke="currentColor" strokeWidth="0.8" opacity={0.5}/>;
        })}
      </g>
    </svg>
  );
}

// ── Heart divider ─────────────────────────────────────────────────────────────
function HeartLine() {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="h-px flex-1" style={{background:"linear-gradient(to right, transparent, oklch(0.75 0.13 355 / 0.4))"}}/>
      <Heart className="h-3.5 w-3.5 fill-primary/40 text-primary/40"/>
      <div className="h-px flex-1" style={{background:"linear-gradient(to left, transparent, oklch(0.75 0.13 355 / 0.4))"}}/>
    </div>
  );
}

function HubPage() {
  const navigate = useNavigate();
  const [me, setMe]           = useState<Profile | null>(null);
  const [couple, setCouple]   = useState<Couple | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [perm, setPerm]       = useState<NotificationPermission | "unsupported">("default");
  const [justPaired, setJustPaired] = useState(false);
  const [loveCooldown, setLoveCooldown] = useState(0);
  const [loveSending, setLoveSending] = useState(false);
  const [myCode, setMyCode]   = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [pairBusy, setPairBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);

  useEffect(() => {
    const p = pushPermissionState(); setPerm(p); void loadAll();
    if (p === "granted") { subscribeToPush().then((res) => { if (res.ok) setPerm("granted"); }); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
    (async () => {
      const { data: ures } = await supabase.auth.getUser();
      const uid = ures.user?.id;
      if (!uid || cancelled) return;
      channel = supabase.channel(`couples-watch-${uid}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "couples" }, (payload) => {
          const row = payload.new as Couple;
          if (row.user_a === uid || row.user_b === uid) void loadAll();
        }).subscribe();
      pollId = setInterval(() => { if (!couple) void loadAll(); }, 4000);
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
    if (!uid) { navigate({ to: "/auth", replace: true }); return; }
    const meta = (ures.user?.user_metadata || {}) as { display_name?: string; full_name?: string; name?: string };
    const fallbackName = meta.display_name || meta.full_name || meta.name || ures.user?.email?.split("@")[0] || "Mon amour";
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (!prof) {
      const { data: created } = await supabase.from("profiles").upsert({ id: uid, display_name: fallbackName }, { onConflict: "id" }).select("*").maybeSingle();
      setMe((created as Profile) || { id: uid, display_name: fallbackName, avatar_emoji: "💕" });
    } else { setMe(prof as Profile); }
    const { data: c } = await supabase.from("couples").select("*").or(`user_a.eq.${uid},user_b.eq.${uid}`).maybeSingle();
    if (c) {
      setCouple(c as Couple);
      if (fromPairing) setJustPaired(true);
      const partnerId = c.user_a === uid ? c.user_b : c.user_a;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle();
      setPartner((p as Profile) || null);
    } else { setCouple(null); setPartner(null); }
    setLoading(false);
  }

  async function createPairingCode() {
    setPairBusy(true);
    try {
      const code = genCode();
      const { data: ures } = await supabase.auth.getUser();
      const { error } = await supabase.from("pairing_codes").insert({ code, created_by: ures.user!.id });
      if (error) throw error;
      setMyCode(code);
    } catch (e) { toast.error((e as Error).message); } finally { setPairBusy(false); }
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
    } catch (e) { toast.error((e as Error).message); } finally { setPairBusy(false); }
  }

  async function enablePush() {
    setSubscribing(true);
    const res = await subscribeToPush();
    setPerm(pushPermissionState()); setSubscribing(false);
    if (res.ok) { toast.success("Notifications activées 🔔"); setJustPaired(false); }
    else toast.error(res.reason || "Impossible d'activer");
  }

  async function diagnose() {
    setDiagnosing(true);
    const lines: string[] = [];
    const { canRegisterSW } = await import("@/lib/sw-register");
    lines.push(canRegisterSW() ? "✅ URL de production" : "❌ URL preview — ouvre l'URL de prod");
    const p = pushPermissionState();
    if (p === "granted") lines.push("✅ Permission accordée");
    else if (p === "denied") lines.push("❌ Permission refusée");
    else if (p === "unsupported") lines.push("❌ Non supporté");
    else lines.push("⚠️ Permission non demandée");
    try { await (await import("@/lib/push-client")).fetchVapidPublicKey(); lines.push("✅ Clés VAPID ok"); }
    catch (e) { lines.push(`❌ VAPID: ${(e as Error).message}`); }
    const status = await getNotifStatus();
    if (status) {
      lines.push(status.coupled ? "✅ Couple trouvé" : "❌ Pas appairé");
      lines.push(status.mySubCount > 0 ? `✅ Push actif (${status.mySubCount})` : "❌ Pas d'abonnement push");
      lines.push(status.partnerSubCount > 0 ? `✅ Push partenaire actif (${status.partnerSubCount})` : "❌ Partenaire pas abonné");
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
    if (res.ok) { toast.success(`Envoyé à ${partner?.display_name || "ton amour"} 💌`); setMessage(""); }
    else toast.error(res.reason || "Échec");
  }

  async function sendLoveBomb() {
    if (!couple || !me || loveCooldown > 0 || loveSending) return;
    setLoveSending(true);
    const variant = Math.floor(Math.random() * 4);
    const payload: LoveBombPayload = { sender_name: me.display_name || "Ton amour", variant };
    try {
      // Subscribe without awaiting SUBSCRIBED — Supabase queues the send.
      const ch = supabase.channel(`love-bomb-${couple.id}`);
      ch.subscribe();
      await new Promise<void>((r) => setTimeout(r, 400));
      await ch.send({ type: "broadcast", event: "love_bomb", payload });
      setTimeout(() => supabase.removeChannel(ch), 1000);
    } catch { /* ignore */ }
    setLoveSending(false);
    setLoveCooldown(60);
    const iv = setInterval(() => {
      setLoveCooldown((p) => { if (p <= 1) { clearInterval(iv); return 0; } return p - 1; });
    }, 1000);
  }

  async function unpair() {
    if (!couple) return;
    if (!window.confirm("Se désappairer ?")) return;
    const { error } = await supabase.from("couples").delete().eq("id", couple.id);
    if (error) { toast.error(error.message); return; }
    setCouple(null); setPartner(null); setJustPaired(false); setMyCode(null);
    toast.success("Désappairés 💔");
  }

  async function logout() { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <motion.div animate={{ scale:[1,1.1,1], opacity:[0.5,1,0.5] }} transition={{ duration:2, repeat:Infinity }}>
          <Heart className="h-8 w-8 fill-primary text-primary"/>
        </motion.div>
      </div>
    );
  }

  const ios = isIOS(); const standalone = isStandalonePWA();
  const needsInstall = ios && !standalone;
  const notifActive = perm === "granted";
  const notifDenied = perm === "denied";

  return (
    <div className="relative mx-auto min-h-screen max-w-md pb-32">

      {/* ── Decorative roses ──────────────────────────────────────────────── */}
      <RoseDeco className="pointer-events-none absolute -top-4 -right-4 h-28 w-28 text-primary/20"/>
      <RoseDeco className="pointer-events-none absolute top-32 -left-8 h-20 w-20 text-primary/12 rotate-45"/>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-6">
        <Link to="/" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-primary"
          style={{background:"rgba(255,255,255,0.6)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.7)"}}>
          ← Jeux
        </Link>
        <button onClick={logout} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-primary"
          style={{background:"rgba(255,255,255,0.6)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.7)"}}>
          <LogOut className="h-3 w-3"/> Déconnexion
        </button>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <motion.div initial={{y:16,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.1}} className="px-5 pt-6 text-center">
        {/* Avatar + ring */}
        <div className="relative mx-auto mb-4 inline-block">
          <div className="absolute inset-0 rounded-full animate-breathe"
            style={{background:"conic-gradient(from 0deg, oklch(0.75 0.13 355), oklch(0.60 0.16 0), oklch(0.80 0.12 75), oklch(0.75 0.13 355))",
              borderRadius:"50%", padding:3, margin:-3}}/>
          <div className="relative rounded-full p-1" style={{background:"white"}}>
            <Avatar style={me?.avatar_style} options={(me?.avatar_options as never)||{}} fallbackEmoji={me?.avatar_emoji} size={80}/>
          </div>
        </div>

        <h1 className="font-serif text-5xl text-primary" style={{letterSpacing:"-0.025em"}}>
          Notre <em>nid</em>
        </h1>
        <p className="mt-1.5 text-sm font-medium" style={{color:"oklch(0.52 0.06 358)"}}>
          Salut {me?.display_name} 💕
        </p>
      </motion.div>

      {!couple ? (
        <PairUI myCode={myCode} onCreate={createPairingCode} enteredCode={enteredCode} setEnteredCode={setEnteredCode} onConsume={consumeCode} busy={pairBusy}/>
      ) : (
        <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.2}} className="mt-4 space-y-4 px-5">

          {/* DailyRitual */}
          {me && partner && (
            <DailyRitual myId={me.id} partnerId={partner.id} partnerName={partner.display_name || "ton amour"}/>
          )}

          {/* Roulette coquine */}
          <a href="/roulette-irl"
            className="block overflow-hidden transition-all duration-300 active:scale-[0.98]"
            style={{background:"linear-gradient(135deg, #fff0f5 0%, #ffe0ed 40%, #f5e0ff 100%)",
              borderRadius:28, border:"1px solid rgba(255,255,255,0.8)",
              boxShadow:"0 12px 40px oklch(0.60 0.16 0 / 0.16), 0 4px 12px oklch(0.75 0.13 355 / 0.12), inset 0 1px 0 rgba(255,255,255,0.9)"}}>
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
                style={{background:"linear-gradient(135deg,#fce7f3,#f3e8ff)", boxShadow:"0 4px 12px oklch(0.75 0.13 355 / 0.25)"}}>
                🎰
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-800">Roulette Coquine</p>
                <p className="mt-0.5 text-xs text-gray-400">5 catégories · défis · positions · complicité</p>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{background:"linear-gradient(135deg,#e88aab,#c45c7c)"}}>
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                </svg>
              </div>
            </div>
            {/* Decorative gradient bar */}
            <div className="h-0.5 w-full" style={{background:"linear-gradient(to right, #f9a8d4, #e879f9, #f9a8d4)"}}/>
          </a>

          {/* Post-pairing banner */}
          {justPaired && !notifActive && !needsInstall && (
            <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}}
              className="rounded-3xl p-5 text-center"
              style={{background:"linear-gradient(135deg,oklch(0.95 0.04 350),oklch(0.90 0.06 355))",
                border:"1px solid oklch(0.80 0.10 355 / 0.4)", boxShadow:"0 8px 24px oklch(0.75 0.13 355 / 0.2)"}}>
              <p className="font-serif text-xl text-primary">Vous êtes appairés 💞</p>
              <p className="mt-1 text-xs text-muted-foreground">Active les notifications pour recevoir les pensées de {partner?.display_name}.</p>
              <button onClick={enablePush} disabled={subscribing}
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl px-6 text-sm font-semibold text-white transition active:scale-95"
                style={{background:"linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow:"0 6px 20px oklch(0.60 0.16 0 / 0.3)"}}>
                <Bell className="h-4 w-4"/> Activer les notifications
              </button>
            </motion.div>
          )}

          {/* Notifications */}
          <div className="rounded-3xl p-4"
            style={{background:"rgba(255,255,255,0.72)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.70)",
              boxShadow:"0 8px 32px oklch(0.60 0.16 0 / 0.08)"}}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
                style={{background: notifActive ? "linear-gradient(135deg,#e88aab,#c45c7c)" : "oklch(0.94 0.02 355)"}}>
                {notifActive ? <Bell className="h-4 w-4 text-white"/> : <BellOff className="h-4 w-4 text-muted-foreground"/>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {notifActive ? "Notifications activées ✓" : "Notifications à activer"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {needsInstall ? "Ajoute l'app à l'écran d'accueil (iPhone)"
                    : notifDenied ? "Bloquées dans les réglages du navigateur"
                    : `Pour recevoir les pensées de ${partner?.display_name || "ton amour"}`}
                </p>
              </div>
            </div>
            {!notifActive && !needsInstall && !notifDenied && (
              <button onClick={enablePush} disabled={subscribing}
                className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition active:scale-95"
                style={{background:"linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow:"0 4px 14px oklch(0.60 0.16 0 / 0.28)"}}>
                {subscribing ? <RefreshCw className="h-4 w-4 animate-spin"/> : <Bell className="h-4 w-4"/>}
                Activer
              </button>
            )}
            <button onClick={diagnose} disabled={diagnosing}
              className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-primary transition">
              {diagnosing ? <RefreshCw className="h-3 w-3 animate-spin"/> : <Stethoscope className="h-3 w-3"/>}
              {diagnosing ? "Diagnostic…" : "Diagnostiquer"}
            </button>
          </div>

          <HeartLine/>

          {/* Pensée */}
          <div className="rounded-3xl p-5"
            style={{background:"rgba(255,255,255,0.80)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.75)",
              boxShadow:"0 12px 40px oklch(0.60 0.16 0 / 0.10), inset 0 1px 0 rgba(255,255,255,0.95)"}}>
            <h2 className="font-serif text-3xl text-primary">
              Pour {partner?.display_name || "ton amour"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Une pensée qui arrive directement sur son écran 💌</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {QUICK_MESSAGES.map((text) => (
                <button key={text} type="button" disabled={sending} onClick={() => send(text)}
                  className="min-h-11 rounded-2xl px-3 text-sm font-medium transition active:scale-95"
                  style={{background:"oklch(0.97 0.018 350)", border:"1px solid oklch(0.88 0.06 350 / 0.6)",
                    color:"oklch(0.52 0.06 358)", boxShadow:"0 2px 8px oklch(0.75 0.13 355 / 0.12)"}}>
                  {text}
                </button>
              ))}
            </div>

            <div className="relative mt-3">
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={140}
                placeholder="Écris-lui quelque chose de doux…"
                className="min-h-24 resize-none rounded-2xl text-sm"
                style={{background:"oklch(0.97 0.015 350)", border:"1px solid oklch(0.85 0.055 350 / 0.5)"}}/>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{message.length}/140</span>
              <button onClick={() => send(message)} disabled={sending || !message.trim()}
                className="flex h-11 items-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-40"
                style={{background:"linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow:"0 6px 18px oklch(0.60 0.16 0 / 0.3)"}}>
                <Send className="h-4 w-4"/> Envoyer
              </button>
            </div>
          </div>

          <button type="button" onClick={unpair}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm text-muted-foreground/60 transition hover:text-destructive">
            <Unlink className="h-3.5 w-3.5"/> Se désappairer
          </button>
        </motion.div>
      )}

      <InstallPrompt/>

      {/* ── Bouton flottant Coup de cœur ─────────────────────────── */}
      {me && couple && (
        <motion.button
          onClick={sendLoveBomb}
          disabled={loveCooldown > 0 || loveSending}
          whileTap={{ scale: 0.94 }}
          style={{
            position: "fixed",
            bottom: "calc(env(safe-area-inset-bottom) + 88px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 28px",
            borderRadius: 999,
            border: "none",
            background: loveCooldown > 0
              ? "oklch(0.16 0.04 260)"
              : "linear-gradient(135deg, oklch(0.48 0.26 355) 0%, oklch(0.40 0.22 340) 100%)",
            color: loveCooldown > 0 ? "oklch(0.50 0.05 260)" : "white",
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "inherit",
            whiteSpace: "nowrap",
            cursor: loveCooldown > 0 ? "default" : "pointer",
            boxShadow: loveCooldown > 0
              ? "none"
              : "0 6px 28px oklch(0.48 0.26 355 / 0.50), 0 2px 8px oklch(0.48 0.26 355 / 0.30)",
            transition: "all 0.3s ease",
          }}
        >
          <motion.span
            animate={loveCooldown > 0 ? {} : { scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
            style={{ fontSize: 20, lineHeight: 1 }}
          >
            {loveCooldown > 0 ? "💤" : "💝"}
          </motion.span>
          <span>
            {loveSending
              ? "Envoi…"
              : loveCooldown > 0
              ? `Coup de cœur dans ${loveCooldown}s`
              : `Coup de cœur pour ${partner?.display_name || "ton amour"}`}
          </span>
        </motion.button>
      )}
    </div>
  );
}

// ── Pair UI ───────────────────────────────────────────────────────────────────
function PairUI({ myCode, onCreate, enteredCode, setEnteredCode, onConsume, busy }: {
  myCode: string | null; onCreate: () => void; enteredCode: string;
  setEnteredCode: (s: string) => void; onConsume: () => void; busy: boolean;
}) {
  async function shareCode() {
    if (!myCode) return;
    const text = `Rejoins-moi sur Princesse 💕 — entre le code ${myCode} dans l'appli !`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch {} }
    await navigator.clipboard.writeText(myCode);
    toast.success("Code copié 💖");
  }

  return (
    <motion.div initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.2}} className="mt-8 space-y-6 px-5">

      {/* Illustration */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
            style={{background:"linear-gradient(135deg,#fce7f3,#f3e8ff)", boxShadow:"0 8px 24px oklch(0.75 0.13 355 / 0.22)"}}>
            💕
          </div>
          <div className="h-px w-10" style={{background:"linear-gradient(to right,oklch(0.75 0.13 355 / 0.4),oklch(0.75 0.13 355 / 0.1))"}}/>
          <Heart className="h-4 w-4 fill-primary/30 text-primary/30 animate-heartbeat"/>
          <div className="h-px w-10" style={{background:"linear-gradient(to left,oklch(0.75 0.13 355 / 0.4),oklch(0.75 0.13 355 / 0.1))"}}/>
          <div className="flex h-14 w-14 items-center justify-center rounded-full text-2xl"
            style={{background:"linear-gradient(135deg,#f3e8ff,#fce7f3)", boxShadow:"0 8px 24px oklch(0.75 0.13 355 / 0.22)"}}>
            💌
          </div>
        </div>
        <p className="mt-2 text-center font-serif text-2xl text-primary">Invitez votre amour</p>
        <p className="text-center text-xs text-muted-foreground">L'un génère un code, l'autre le saisit.</p>
      </div>

      {/* Card */}
      <div className="rounded-3xl p-6"
        style={{background:"rgba(255,255,255,0.82)", backdropFilter:"blur(24px)", border:"1px solid rgba(255,255,255,0.78)",
          boxShadow:"0 16px 48px oklch(0.60 0.16 0 / 0.10), inset 0 1px 0 rgba(255,255,255,0.95)"}}>

        {myCode ? (
          <div className="rounded-2xl p-5 text-center"
            style={{background:"linear-gradient(135deg,oklch(0.97 0.022 350),oklch(0.93 0.042 355))",
              border:"1px solid oklch(0.82 0.08 355 / 0.45)"}}>
            <p className="text-[10px] uppercase tracking-widest text-primary/60">Donne ce code à ton amour</p>
            <p className="mt-3 font-mono text-5xl font-bold tracking-[0.35em] text-primary">{myCode}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Valide 15 minutes</p>
            <div className="mt-4 flex justify-center gap-3">
              <button onClick={shareCode}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white transition active:scale-95"
                style={{background:"linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow:"0 4px 12px oklch(0.60 0.16 0 / 0.28)"}}>
                <Share2 className="h-3 w-3"/> Partager
              </button>
              <button onClick={() => { navigator.clipboard.writeText(myCode); toast.success("Copié 💖"); }}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition active:scale-95"
                style={{background:"rgba(255,255,255,0.8)", border:"1px solid oklch(0.82 0.08 355 / 0.4)", color:"oklch(0.60 0.16 0)"}}>
                <Copy className="h-3 w-3"/> Copier
              </button>
            </div>
          </div>
        ) : (
          <button onClick={onCreate} disabled={busy}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white transition active:scale-95 disabled:opacity-50"
            style={{background:"linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow:"0 8px 24px oklch(0.60 0.16 0 / 0.32)"}}>
            <Sparkles className="h-5 w-5"/> Générer mon code
          </button>
        )}

        <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          <div className="h-px flex-1 bg-border"/> j'ai reçu un code <div className="h-px flex-1 bg-border"/>
        </div>

        <Input placeholder="Entre le code de ton amour" value={enteredCode}
          onChange={(e) => setEnteredCode(e.target.value.toUpperCase())} maxLength={6}
          className="h-13 rounded-2xl text-center text-xl font-bold tracking-[0.35em]"
          style={{background:"oklch(0.97 0.015 350)", border:"1px solid oklch(0.84 0.055 350 / 0.5)"}}/>

        <button onClick={onConsume} disabled={busy || enteredCode.trim().length < 4}
          className="mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-95 disabled:opacity-40"
          style={{background:"oklch(0.95 0.035 352)", border:"1px solid oklch(0.82 0.08 355 / 0.4)", color:"oklch(0.52 0.06 358)"}}>
          Nous appairer 💞
        </button>
      </div>
    </motion.div>
  );
}
