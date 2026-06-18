import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Bell, BellOff, Send, Copy, Sparkles, Share2,
  RefreshCw, Unlink, Stethoscope, Check, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import {
  subscribeToPush, sendPensee, pushPermissionState,
  getNotifStatus, fetchVapidPublicKey, isIOS, isStandalonePWA,
} from "@/lib/push-client";
import { canRegisterSW } from "@/lib/sw-register";
import { DailyRitual } from "@/components/DailyRitual";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/_authenticated/pensees")({
  head: () => ({ meta: [{ title: "Pensées 💌 — Princesse" }] }),
  component: PenseesPage,
});

type Profile = { id: string; display_name: string; avatar_emoji: string; avatar_style?: string | null; avatar_options?: Record<string, unknown> | null };
type Couple  = { id: string; user_a: string; user_b: string };

function genCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = ""; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; return s;
}

const QUICK = ["Tu me manques 🥺", "Je pense à toi 💕", "Coucou toi 😘", "Je t'aime fort 🤍"];

// ── Glass card ────────────────────────────────────────────────────────────────
function GCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={"overflow-hidden rounded-[28px] " + className}
      style={{
        background: "rgba(255,255,255,0.80)",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.85)",
        boxShadow: "0 8px 40px oklch(0.60 0.16 0 / 0.09), 0 2px 10px oklch(0.75 0.13 355 / 0.07), inset 0 1px 0 rgba(255,255,255,0.95)",
        ...style,
      }}>
      {children}
    </div>
  );
}

// ── Pill button ───────────────────────────────────────────────────────────────
function PrimaryBtn({ children, onClick, disabled, className = "" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={"flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition active:scale-[0.97] disabled:opacity-50 " + className}
      style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow: disabled ? "none" : "0 8px 24px oklch(0.60 0.16 0 / 0.30), inset 0 1px 0 rgba(255,255,255,0.18)" }}>
      {children}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function PenseesPage() {
  const navigate = useNavigate();
  const [me, setMe]         = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [perm, setPerm]     = useState<NotificationPermission | "unsupported">("default");
  const [justPaired, setJustPaired] = useState(false);

  const [myCode, setMyCode]         = useState<string | null>(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [pairBusy, setPairBusy]     = useState(false);

  const [message, setMessage]       = useState("");
  const [sending, setSending]       = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);

  useEffect(() => {
    const p = pushPermissionState(); setPerm(p); void loadAll();
    if (p === "granted") subscribeToPush().then(res => { if (res.ok) setPerm("granted"); });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;
    (async () => {
      const { data: ures } = await supabase.auth.getUser();
      const uid = ures.user?.id; if (!uid || cancelled) return;
      channel = supabase.channel(`couples-pensees-${uid}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "couples" }, (payload) => {
          const row = payload.new as Couple;
          if (row.user_a === uid || row.user_b === uid) void loadAll();
        }).subscribe();
      pollId = setInterval(() => { if (!couple) void loadAll(); }, 4000);
    })();
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); if (pollId) clearInterval(pollId); };
  }, [couple?.id]);

  async function loadAll(fromPairing = false) {
    const { data: ures } = await supabase.auth.getUser();
    const uid = ures.user?.id;
    if (!uid) { navigate({ to: "/auth", replace: true }); return; }
    const meta = (ures.user?.user_metadata || {}) as { display_name?: string; full_name?: string; name?: string };
    const fallback = meta.display_name || meta.full_name || meta.name || ures.user?.email?.split("@")[0] || "Mon amour";
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (!prof) {
      const { data: created } = await supabase.from("profiles").upsert({ id: uid, display_name: fallback }, { onConflict: "id" }).select("*").maybeSingle();
      setMe((created as Profile) || { id: uid, display_name: fallback, avatar_emoji: "💕" });
    } else { setMe(prof as Profile); }
    const { data: c } = await supabase.from("couples").select("*").or(`user_a.eq.${uid},user_b.eq.${uid}`).maybeSingle();
    if (c) {
      setCouple(c as Couple); if (fromPairing) setJustPaired(true);
      const pid = c.user_a === uid ? c.user_b : c.user_a;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", pid).maybeSingle();
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
      if (error) throw error; setMyCode(code);
    } catch (e) { toast.error((e as Error).message); } finally { setPairBusy(false); }
  }

  async function consumeCode() {
    const code = enteredCode.trim().toUpperCase();
    if (code.length < 4) return toast.error("Code invalide");
    setPairBusy(true);
    try {
      const { error } = await supabase.rpc("consume_pairing_code", { _code: code });
      if (error) throw error; toast.success("Appairés 💞"); await loadAll(true);
    } catch (e) { toast.error((e as Error).message); } finally { setPairBusy(false); }
  }

  async function enablePush() {
    setSubscribing(true);
    const res = await subscribeToPush(); setPerm(pushPermissionState()); setSubscribing(false);
    if (res.ok) { toast.success("Notifications activées 🔔"); setJustPaired(false); }
    else toast.error(res.reason || "Impossible d'activer");
  }

  async function diagnose() {
    setDiagnosing(true);
    const lines: string[] = [];
    if (canRegisterSW()) lines.push("✅ URL de production"); else { lines.push("❌ URL de prévisualisation"); lines.push("   👉 Ouvre l'URL de production"); }
    const p = pushPermissionState();
    if (p === "granted") lines.push("✅ Permission accordée");
    else if (p === "denied") lines.push("❌ Permission refusée — autorise dans les réglages");
    else lines.push("⚠️  Permission pas encore demandée");
    try { await fetchVapidPublicKey(); lines.push("✅ Clés VAPID configurées"); } catch (e) { lines.push(`❌ VAPID: ${(e as Error).message}`); }
    const status = await getNotifStatus();
    if (status) {
      lines.push(status.coupled ? "✅ Couple trouvé" : "❌ Pas appairé");
      lines.push(status.mySubCount > 0 ? `✅ Ton abonnement (${status.mySubCount})` : "❌ Abonnement manquant — clique Activer");
      lines.push(status.partnerSubCount > 0 ? `✅ Abonnement partenaire (${status.partnerSubCount})` : "❌ Partenaire sans notifs");
    } else { lines.push("⚠️  Diagnostic indisponible"); }
    setDiagnosing(false); toast(lines.join("\n"), { duration: 12000 });
  }

  async function send(text: string) {
    const msg = text.trim(); if (!msg) return;
    if (msg.length > 140) return toast.error("Message trop long");
    setSending(true);
    const res = await sendPensee(msg); setSending(false);
    if (res.ok) { toast.success(`Envoyé à ${partner?.display_name || "ton amour"} 💌`); setMessage(""); }
    else toast.error(res.reason || "Échec de l'envoi");
  }

  async function unpair() {
    if (!couple) return;
    if (!window.confirm("Se désappairer ? Tu pourras te réappairer avec quelqu'un d'autre.")) return;
    const { error } = await supabase.from("couples").delete().eq("id", couple.id);
    if (error) { toast.error(error.message); return; }
    setCouple(null); setPartner(null); setJustPaired(false); setMyCode(null); toast.success("Désappairés 💔");
  }

  if (loading) return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <motion.div animate={{ opacity: [0.4,1,0.4] }} transition={{ repeat: Infinity, duration: 1.8 }}
        className="font-serif text-2xl text-primary">…</motion.div>
    </div>
  );

  return (
    <div className="relative mx-auto max-w-md pb-28">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden"
        style={{ background: "linear-gradient(165deg,oklch(0.90 0.062 352),oklch(0.78 0.108 358),oklch(0.82 0.085 10))", minHeight: 180 }}>
        {/* SVG petal decorations */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-25" viewBox="0 0 390 180" aria-hidden>
          {[0,60,120,180,240,300].map((d,i)=>(
            <g key={i} transform={`translate(340,90) rotate(${d})`}>
              <ellipse rx="50" ry="22" fill="white" transform="translate(0,-42)" opacity="0.8"/>
            </g>
          ))}
          {[0,72,144,216,288].map((d,i)=>(
            <g key={i} transform={`translate(48,32) rotate(${d})`}>
              <ellipse rx="28" ry="13" fill="white" transform="translate(0,-23)" opacity="0.7"/>
            </g>
          ))}
          {[[30,155,10],[180,170,8],[300,160,7]].map(([x,y,s],i)=>(
            <text key={i} x={x} y={y} fontSize={s} textAnchor="middle" opacity="0.35" fill="white">♥</text>
          ))}
        </svg>

        <div className="relative z-10 flex flex-col items-center pb-10 pt-10">
          {couple && partner ? (
            <>
              {/* Two avatars */}
              <div className="flex items-center gap-3">
                {me && (
                  <div className="rounded-[18px] border-3 border-white shadow-lg" style={{ border: "3px solid white" }}>
                    <Avatar style={me.avatar_style as string} options={me.avatar_options as any} fallbackEmoji={me.avatar_emoji} size={56}/>
                  </div>
                )}
                <motion.div animate={{ scale: [1,1.18,1] }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}>
                  <Heart className="h-6 w-6 fill-white text-white drop-shadow-sm"/>
                </motion.div>
                <div className="rounded-[18px] border-3 border-white shadow-lg" style={{ border: "3px solid white" }}>
                  <Avatar style={partner.avatar_style as string} options={partner.avatar_options as any} fallbackEmoji={partner.avatar_emoji} size={56}/>
                </div>
              </div>
              <h1 className="mt-4 font-serif text-3xl leading-tight text-white drop-shadow-sm">
                Pour <em>{partner.display_name}</em> 💌
              </h1>
              <p className="mt-1 text-sm text-white/80">Bonjour {me?.display_name} 💕</p>
            </>
          ) : (
            <>
              <motion.div animate={{ scale: [1,1.14,1] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: "rgba(255,255,255,0.22)", backdropFilter: "blur(8px)" }}>
                <Heart className="h-8 w-8 fill-white text-white"/>
              </motion.div>
              <h1 className="mt-4 font-serif text-3xl text-white drop-shadow-sm">Pensées 💌</h1>
              <p className="mt-1 text-sm text-white/80">Connecte-toi avec ton amour</p>
            </>
          )}
        </div>

        {/* Bottom wave */}
        <svg className="absolute -bottom-px left-0 w-full" viewBox="0 0 390 32" aria-hidden preserveAspectRatio="none">
          <path d="M0 32 Q97.5 0 195 16 Q292.5 32 390 0 L390 32 Z" fill="oklch(0.97 0.012 340)"/>
        </svg>
      </div>

      <div className="space-y-4 px-4 pt-5">

        {/* ── NOT PAIRED ── */}
        {!couple && (
          <PairUI myCode={myCode} onCreate={createPairingCode}
            enteredCode={enteredCode} setEnteredCode={setEnteredCode}
            onConsume={consumeCode} busy={pairBusy}/>
        )}

        {/* ── PAIRED ── */}
        {couple && (
          <>
            {/* Just paired banner */}
            <AnimatePresence>
              {justPaired && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                  className="overflow-hidden rounded-[24px] p-5 text-center"
                  style={{ background: "linear-gradient(135deg,oklch(0.92 0.055 352),oklch(0.86 0.085 358))", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 8px 28px oklch(0.60 0.16 0 / 0.18)" }}>
                  <p className="font-serif text-2xl text-primary">Vous êtes liés 💞</p>
                  <p className="mt-1 text-xs text-muted-foreground">Active les notifications pour recevoir les pensées de {partner?.display_name}.</p>
                  <button onClick={enablePush} disabled={subscribing}
                    className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow: "0 6px 18px oklch(0.60 0.16 0 / 0.28)" }}>
                    <Bell className="h-4 w-4"/> Activer les notifications
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* DailyRitual */}
            {me && partner && (
              <DailyRitual myId={me.id} partnerId={partner.id} partnerName={partner.display_name || "ton amour"}/>
            )}

            {/* ── SEND A THOUGHT ── */}
            <GCard>
              <div className="p-5">
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" }}>
                    <Send className="h-4 w-4 text-primary"/>
                  </div>
                  <div>
                    <p className="font-serif text-xl text-primary">Une <em>pensée</em></p>
                    <p className="text-[11px] text-muted-foreground">pour {partner?.display_name} 💌</p>
                  </div>
                </div>

                {/* Quick messages */}
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {QUICK.map(q => (
                    <motion.button key={q} onClick={() => send(q)} disabled={sending}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center justify-center rounded-2xl px-3 py-3 text-sm font-medium transition disabled:opacity-50"
                      style={{ background: "linear-gradient(145deg,oklch(0.96 0.030 352),oklch(0.91 0.058 358))", border: "1px solid rgba(255,255,255,0.8)", color: "oklch(0.42 0.10 358)", boxShadow: "0 3px 10px oklch(0.75 0.13 355 / 0.12)" }}>
                      {q}
                    </motion.button>
                  ))}
                </div>

                {/* Custom textarea */}
                <div className="relative">
                  <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={140} rows={3}
                    placeholder="Écris quelque chose de tendre…"
                    className="w-full resize-none rounded-2xl px-4 py-3.5 text-sm outline-none transition"
                    style={{ background: "oklch(0.97 0.015 350)", border: "1px solid oklch(0.88 0.05 355 / 0.5)", color: "oklch(0.22 0.06 358)" }}/>
                  <span className="absolute bottom-3 right-4 text-[10px] text-muted-foreground/60">{message.length}/140</span>
                </div>

                <PrimaryBtn onClick={() => send(message)} disabled={sending || !message.trim()} className="mt-3">
                  <Send className="h-4 w-4"/>
                  {sending ? "Envoi…" : `Envoyer à ${partner?.display_name || "ton amour"}`}
                </PrimaryBtn>
              </div>
            </GCard>

            {/* ── NOTIFICATIONS ── */}
            <NotifCard perm={perm} partnerName={partner?.display_name || "ton amour"}
              subscribing={subscribing} onEnable={enablePush}
              diagnosing={diagnosing} onDiagnose={diagnose}/>

            {/* Unpair */}
            <div className="pb-2 text-center">
              <button onClick={unpair}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/40 transition hover:text-red-400">
                <Unlink className="h-3 w-3"/> Se désappairer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Notif card ────────────────────────────────────────────────────────────────
function NotifCard({ perm, partnerName, subscribing, onEnable, diagnosing, onDiagnose }: {
  perm: NotificationPermission | "unsupported"; partnerName: string;
  subscribing: boolean; onEnable: () => void;
  diagnosing: boolean; onDiagnose: () => void;
}) {
  const ios        = isIOS();
  const standalone = isStandalonePWA();
  const needsInstall = ios && !standalone;
  const notifActive  = perm === "granted";
  const notifDenied  = perm === "denied";

  const statusText = notifActive
    ? `Tu reçois les pensées de ${partnerName} 💕`
    : notifDenied ? "Bloquées — autorise dans les réglages du navigateur"
    : perm === "unsupported" ? "Non supporté sur cet appareil"
    : needsInstall ? "Installe l'app sur ton écran d'accueil d'abord"
    : "Active-les pour recevoir les pensées de " + partnerName;

  return (
    <GCard>
      <div className="p-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: notifActive
                ? "linear-gradient(145deg,oklch(0.92 0.062 135),oklch(0.78 0.12 142))"
                : "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))",
            }}>
            {notifActive
              ? <Bell className="h-4.5 w-4.5 text-white" style={{ height: 18, width: 18 }}/>
              : <BellOff className="h-4.5 w-4.5 text-primary" style={{ height: 18, width: 18 }}/>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: notifActive ? "oklch(0.36 0.10 142)" : "oklch(0.32 0.08 358)" }}>
              {notifActive ? "Notifications actives" : "Notifications"}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{statusText}</p>
          </div>
          {notifActive && (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ background: "oklch(0.78 0.12 142)" }}>
              <Check className="h-3.5 w-3.5 text-white"/>
            </div>
          )}
          {!notifActive && !notifDenied && perm !== "unsupported" && !needsInstall && (
            <button onClick={onEnable} disabled={subscribing}
              className="shrink-0 rounded-2xl px-4 py-2 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow: "0 4px 12px oklch(0.60 0.16 0 / 0.25)" }}>
              {subscribing ? <RefreshCw className="h-3.5 w-3.5 animate-spin"/> : "Activer"}
            </button>
          )}
        </div>

        {/* Subtle actions row */}
        <div className="mt-4 flex items-center gap-4 border-t pt-3" style={{ borderColor: "oklch(0.88 0.05 355 / 0.4)" }}>
          {notifActive && (
            <button onClick={onEnable} disabled={subscribing}
              className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-primary">
              <RefreshCw className="h-3 w-3"/> Actualiser
            </button>
          )}
          <button onClick={onDiagnose} disabled={diagnosing}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-primary">
            {diagnosing ? <RefreshCw className="h-3 w-3 animate-spin"/> : <Stethoscope className="h-3 w-3"/>}
            Diagnostiquer
          </button>
        </div>
      </div>
    </GCard>
  );
}

// ── Pair UI ───────────────────────────────────────────────────────────────────
function PairUI({ myCode, onCreate, enteredCode, setEnteredCode, onConsume, busy }: {
  myCode: string | null; onCreate: () => void;
  enteredCode: string; setEnteredCode: (s: string) => void;
  onConsume: () => void; busy: boolean;
}) {
  async function shareCode() {
    if (!myCode) return;
    const text = `Rejoins-moi sur Princesse 💕 — entre le code ${myCode} !`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch {} }
    await navigator.clipboard.writeText(myCode); toast.success("Code copié 💖");
  }

  return (
    <div className="space-y-4">
      {/* Generate code */}
      <GCard>
        <div className="p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" }}>
              <Heart className="h-4 w-4 fill-primary text-primary"/>
            </div>
            <div>
              <p className="font-serif text-xl text-primary">S'appairer 💞</p>
              <p className="text-[11px] text-muted-foreground">L'un génère, l'autre entre le code</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {myCode ? (
              <motion.div key="code" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="overflow-hidden rounded-2xl p-5 text-center"
                style={{ background: "linear-gradient(135deg,oklch(0.92 0.055 352),oklch(0.86 0.085 358))", border: "1px solid rgba(255,255,255,0.8)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/70">Donne ce code à ton amour</p>
                <motion.p
                  initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 250, damping: 15 }}
                  className="mt-3 font-mono text-5xl font-bold tracking-[0.35em] text-primary" style={{ letterSpacing: "0.3em" }}>
                  {myCode}
                </motion.p>
                <p className="mt-2 text-[10px] text-muted-foreground">Valable 15 minutes</p>
                <div className="mt-4 flex justify-center gap-3">
                  <button onClick={shareCode}
                    className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-semibold text-primary transition active:scale-95"
                    style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 3px 10px oklch(0.60 0.16 0 / 0.12)" }}>
                    <Share2 className="h-3.5 w-3.5"/> Partager
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(myCode); toast.success("Copié 💖"); }}
                    className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-semibold text-primary transition active:scale-95"
                    style={{ background: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 3px 10px oklch(0.60 0.16 0 / 0.12)" }}>
                    <Copy className="h-3.5 w-3.5"/> Copier
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <PrimaryBtn onClick={onCreate} disabled={busy}>
                  <Sparkles className="h-4 w-4"/> Générer mon code
                </PrimaryBtn>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GCard>

      {/* Enter code */}
      <GCard>
        <div className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: "linear-gradient(to right,transparent,oklch(0.75 0.13 355 / 0.35))" }}/>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">J'ai reçu un code</p>
            <div className="h-px flex-1" style={{ background: "linear-gradient(to left,transparent,oklch(0.75 0.13 355 / 0.35))" }}/>
          </div>
          <div className="mt-4 space-y-3">
            <input value={enteredCode} onChange={e => setEnteredCode(e.target.value.toUpperCase())} maxLength={6}
              onKeyDown={e => e.key === "Enter" && !busy && onConsume()}
              placeholder="ENTRE LE CODE"
              className="h-14 w-full rounded-2xl px-4 text-center text-2xl font-bold tracking-[0.35em] outline-none transition"
              style={{ background: "oklch(0.97 0.015 350)", border: "1px solid oklch(0.88 0.05 355 / 0.5)", color: "oklch(0.28 0.10 358)", letterSpacing: "0.35em" }}/>
            <button onClick={onConsume} disabled={busy || enteredCode.trim().length < 4}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50"
              style={{ height: 52, background: "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))", border: "1px solid rgba(255,255,255,0.8)", color: "oklch(0.38 0.10 358)", boxShadow: "0 4px 14px oklch(0.75 0.13 355 / 0.16)" }}>
              <Heart className="h-4 w-4 fill-primary text-primary"/> Nous appairer 💞
            </button>
          </div>
        </div>
      </GCard>
    </div>
  );
}
