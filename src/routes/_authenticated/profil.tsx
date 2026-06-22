import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellOff, LayoutDashboard, LogOut, Pencil, Sparkles,
  Shuffle, Palette, FlipHorizontal, Image as ImageIcon,
  User2, Wand2, ChevronRight, Save, X, Music, Heart,
} from "lucide-react";
import { isSoundId, playSound, SOUNDS, type SoundId } from "@/lib/pensee-sound";
import { cachePenseeSound } from "@/lib/notification-sound";
import { generateAvatarFromPrompt } from "@/lib/avatar-ai.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { LoveBombPayload } from "@/components/LoveBombOverlay";
import { Input } from "@/components/ui/input";
import {
  Avatar, AVATAR_STYLES, BG_PALETTE, SEED_PRESETS,
  buildAvatarUrl, randomAvatar, type AvatarOptions, type AvatarStyle,
} from "@/components/Avatar";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({ meta: [{ title: "Profil — Princesse" }] }),
  component: ProfilPage,
});

type Profile = {
  id: string; display_name: string; avatar_emoji: string;
  avatar_style: string; avatar_options: AvatarOptions;
  daily_notif_enabled: boolean; pensee_sound: string;
};

const NAME_EMOJIS = ["💕","🌸","🦋","🌙","⭐","🌹","🍀","🐝","🦊","🐻","✨","🍓","🌷"];
const RADIUS_OPTIONS = [{ v: 0, label: "Carré" }, { v: 20, label: "Doux" }, { v: 50, label: "Rond" }];
type Tab = "style" | "couleur" | "graine" | "options";

// ── Luxe glass card ───────────────────────────────────────────────────────────
function LuxeCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={"overflow-hidden rounded-[32px] " + className}
      style={{
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)",
        border: "1px solid rgba(255,255,255,0.88)",
        boxShadow: "0 12px 48px oklch(0.60 0.16 0 / 0.10), 0 2px 16px oklch(0.75 0.13 355 / 0.08), inset 0 1.5px 0 rgba(255,255,255,0.96)",
        ...style,
      }}>
      {children}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className="relative flex h-7 w-12 shrink-0 items-center rounded-full transition-all duration-300"
      style={{ background: on ? "linear-gradient(135deg,#e88aab,#c45c7c)" : "oklch(0.88 0.04 355)" }}>
      <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 28 }}
        className="absolute h-5 w-5 rounded-full bg-white shadow-md"
        style={{ left: on ? "calc(100% - 22px)" : 4 }}/>
    </button>
  );
}

// ── Settings row ──────────────────────────────────────────────────────────────
function Row({ icon, label, sub, right, onClick, danger = false }: {
  icon: React.ReactNode; label: string; sub?: string; right?: React.ReactNode; onClick?: () => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={"flex w-full items-center gap-4 px-5 py-4 text-left transition " + (onClick && !danger ? "active:bg-rose-50/60" : "") + (danger ? " active:bg-red-50/60" : "")}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] shadow-sm"
        style={danger
          ? { background: "linear-gradient(145deg,#fff1f2,#ffe4e6)", color: "#ef4444" }
          : { background: "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))", color: "oklch(0.45 0.12 358)" }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={"text-[15px] font-semibold " + (danger ? "text-red-500" : "text-foreground")}>{label}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </button>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5 px-1">
      <div className="h-px flex-1" style={{ background: "linear-gradient(to right,transparent,oklch(0.80 0.10 355/0.35))" }}/>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{children}</p>
      <div className="h-px flex-1" style={{ background: "linear-gradient(to left,transparent,oklch(0.80 0.10 355/0.35))" }}/>
    </div>
  );
}

// ── Animated orb ─────────────────────────────────────────────────────────────
function Orb({ size, x, y, delay, color }: { size: number; x: string; y: string; delay: number; color: string }) {
  return (
    <motion.div className="pointer-events-none absolute rounded-full"
      style={{ width: size, height: size, left: x, top: y, background: color, filter: `blur(${size * 0.45}px)`, opacity: 0.55 }}
      animate={{ scale: [1, 1.15, 1], opacity: [0.45, 0.65, 0.45], y: [0, -12, 0] }}
      transition={{ duration: 5 + delay, repeat: Infinity, ease: "easeInOut", delay }}/>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
function ProfilPage() {
  const navigate = useNavigate();
  const [me, setMe]           = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [loveCooldown, setLoveCooldown] = useState(0);
  const [loveSending, setLoveSending]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);

  const [draftName, setDraftName]   = useState("");
  const [draftStyle, setDraftStyle] = useState<string>("lorelei");
  const [draftOpts, setDraftOpts]   = useState<AvatarOptions>({ seed: "Amour", backgroundColor: "f8c8d8", flip: false, radius: 50 });
  const [tab, setTab]               = useState<Tab>("style");
  const [bumpKey, setBumpKey]       = useState(0);
  const [aiPrompt, setAiPrompt]     = useState("");
  const [aiLoading, setAiLoading]   = useState(false);
  const [dailyNotif, setDailyNotif] = useState(true);
  const [penseeSound, setPenseeSound] = useState<SoundId>("clochette");
  const meIdRef = useRef<string | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data: ures } = await supabase.auth.getUser();
    if (!ures.user) { navigate({ to: "/auth", replace: true }); return; }
    meIdRef.current = ures.user.id;
    const { data } = await supabase.from("profiles")
      .select("id,display_name,avatar_emoji,avatar_style,avatar_options,daily_notif_enabled,pensee_sound")
      .eq("id", ures.user.id).maybeSingle();
    if (data) {
      const p = data as Profile;
      setMe(p); setDailyNotif(p.daily_notif_enabled !== false);
      const s = isSoundId(p.pensee_sound) ? p.pensee_sound : "clochette";
      setPenseeSound(s); cachePenseeSound(s); resetDraft(p);
    }
    const { data: c } = await supabase.from("couples").select("id,user_a,user_b")
      .or(`user_a.eq.${ures.user.id},user_b.eq.${ures.user.id}`).maybeSingle();
    if (c) {
      setCoupleId(c.id);
      const pid = c.user_a === ures.user.id ? c.user_b : c.user_a;
      const { data: pp } = await supabase.from("profiles")
        .select("id,display_name,avatar_emoji,avatar_style,avatar_options").eq("id", pid).maybeSingle();
      if (pp) setPartner(pp as Profile);
    }
    setLoading(false);
  }

  useEffect(() => {
    const ch = supabase.channel("profiles-self")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        const row = payload.new as Profile;
        if (row.id === meIdRef.current) {
          setMe(prev => prev ? { ...prev, ...row } : row);
          if (isSoundId(row.pensee_sound)) { setPenseeSound(row.pensee_sound); cachePenseeSound(row.pensee_sound); }
        } else if (partner && row.id === partner.id) setPartner(prev => prev ? { ...prev, ...row } : row);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [partner?.id]);

  async function sendLoveBomb() {
    if (!coupleId || !me || loveCooldown > 0 || loveSending) return;
    setLoveSending(true);
    const variant = Math.floor(Math.random() * 4);
    const payload: LoveBombPayload = { sender_name: me.display_name || "Ton amour", variant };
    try {
      const ch = supabase.channel(`love-bomb-${coupleId}`);
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

  function resetDraft(p: Profile) {
    setDraftName(p.display_name || "");
    setDraftStyle(p.avatar_style || "lorelei");
    setDraftOpts({ seed: p.avatar_options?.seed || "Amour", backgroundColor: p.avatar_options?.backgroundColor ?? "f8c8d8", flip: !!p.avatar_options?.flip, radius: typeof p.avatar_options?.radius === "number" ? p.avatar_options.radius : 50, extras: p.avatar_options?.extras || {} });
  }
  function bump() { setBumpKey(k => k + 1); }
  function patch(opts: Partial<AvatarOptions>) { setDraftOpts(o => ({ ...o, ...opts })); bump(); }
  function pickStyle(s: AvatarStyle) { setDraftStyle(s); setDraftOpts(o => ({ ...o, extras: {} })); bump(); }
  function shuffleAll() { const r = randomAvatar(); setDraftStyle(r.style); setDraftOpts({ ...r.options, extras: {} }); bump(); }

  async function generateFromAI() {
    const p = aiPrompt.trim(); if (!p) { toast.error("Décris ton personnage ✨"); return; }
    setAiLoading(true);
    try {
      const res = await generateAvatarFromPrompt({ data: { prompt: p } });
      if (!res.ok) {
        if (res.error === "credits") toast.error("Plus de crédits IA 💸");
        else if (res.error === "rate_limit") toast.error("Trop de demandes, réessaie 💕");
        else toast.error("L'IA n'a pas répondu 🌸"); return;
      }
      const r = res.result;
      setDraftStyle(r.style); setDraftOpts({ seed: r.seed, backgroundColor: r.backgroundColor, flip: r.flip, radius: r.radius, extras: r.extras });
      setBumpKey(k => k + 1); toast.success("Voilà ton perso ! ✨");
    } finally { setAiLoading(false); }
  }

  async function toggleNotif() {
    if (!me) return; const next = !dailyNotif; setDailyNotif(next);
    await supabase.from("profiles").update({ daily_notif_enabled: next }).eq("id", me.id);
    toast.success(next ? "Notif du matin activée 🔔" : "Désactivée 🔕", { duration: 1600 });
  }

  async function savePenseeSound(s: SoundId) {
    if (!me) return; const prev = penseeSound; setPenseeSound(s);
    const { error } = await supabase.from("profiles").update({ pensee_sound: s }).eq("id", me.id);
    if (error) { setPenseeSound(prev); toast.error("Erreur sauvegarde"); return; }
    cachePenseeSound(s); setMe({ ...me, pensee_sound: s }); playSound(s);
  }

  async function save() {
    if (!me) return; const name = draftName.trim();
    if (!name) { toast.error("Choisis un petit nom 💕"); return; }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name, avatar_style: draftStyle, avatar_options: draftOpts }).eq("id", me.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setMe({ ...me, display_name: name, avatar_style: draftStyle, avatar_options: draftOpts });
    setEditing(false); toast.success("C'est tout toi ! 🥰", { duration: 2200 }); burstConfetti();
  }

  function cancel() { if (me) resetDraft(me); setEditing(false); }
  async function logout() { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }

  // ── Loading ──
  if (loading) return (
    <div className="flex min-h-[100dvh] items-center justify-center"
      style={{ background: "linear-gradient(160deg,oklch(0.96 0.022 352),oklch(0.99 0.008 355))" }}>
      <motion.div animate={{ scale: [1,1.12,1], opacity: [0.5,1,0.5] }} transition={{ repeat: Infinity, duration: 1.6 }}>
        <Heart className="h-8 w-8 animate-pulse" style={{ fill: "oklch(0.65 0.18 0)", color: "oklch(0.65 0.18 0)" }}/>
      </motion.div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW MODE
  // ═══════════════════════════════════════════════════════════════════════════
  if (!editing && me) return (
    <div className="relative min-h-[100dvh] pb-28 overflow-hidden"
      style={{ background: "linear-gradient(160deg,oklch(0.97 0.018 352) 0%,oklch(0.99 0.006 355) 50%,oklch(0.97 0.015 15) 100%)" }}>

      {/* ── FULL BLEED HERO ── */}
      <div className="relative h-[340px] w-full">
        {/* Decorations clipped to hero bounds */}
        <div className="absolute inset-0 overflow-hidden">
        {/* Gradient */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(150deg,oklch(0.62 0.18 358),oklch(0.52 0.20 2),oklch(0.70 0.16 330),oklch(0.55 0.22 8))" }}/>
        {/* Animated orbs */}
        <Orb size={200} x="-10%" y="-20%" delay={0} color="oklch(0.80 0.14 30/0.5)"/>
        <Orb size={160} x="60%" y="10%" delay={1.5} color="oklch(0.72 0.18 355/0.55)"/>
        <Orb size={120} x="20%" y="50%" delay={2.8} color="oklch(0.85 0.12 320/0.45)"/>
        <Orb size={90} x="78%" y="55%" delay={0.8} color="oklch(0.78 0.16 15/0.50)"/>
        {/* Rose petal SVG */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 390 340" aria-hidden>
          {[0,60,120,180,240,300].map((d,i) => (
            <g key={i} transform={`translate(350,60) rotate(${d})`} opacity="0.18">
              <ellipse rx="60" ry="22" fill="white" transform="translate(0,-48)"/>
            </g>
          ))}
          {[30,90,150,210,270,330].map((d,i) => (
            <g key={i} transform={`translate(48,38) rotate(${d})`} opacity="0.12">
              <ellipse rx="36" ry="13" fill="white" transform="translate(0,-28)"/>
            </g>
          ))}
          {/* Sparkles */}
          {[[72,18],[160,22],[300,15],[330,80],[80,90],[220,70]].map(([cx,cy],i) => (
            <motion.g key={i} transform={`translate(${cx},${cy})`}
              animate={{ opacity:[0.3,0.9,0.3], scale:[0.8,1.1,0.8] }}
              transition={{ duration:2.5+i*0.4, repeat:Infinity, delay:i*0.3 }}>
              <circle r="2" fill="white" opacity="0.8"/>
              <line x1="-5" y1="0" x2="5" y2="0" stroke="white" strokeWidth="0.8" opacity="0.6"/>
              <line x1="0" y1="-5" x2="0" y2="5" stroke="white" strokeWidth="0.8" opacity="0.6"/>
            </motion.g>
          ))}
        </svg>
        {/* Gradient fade-out to page bg */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-36"
          style={{ background: "linear-gradient(to bottom,transparent,oklch(0.97 0.018 352))" }}/>
        </div>{/* end decorations */}
        {/* Edit button */}
        <button onClick={() => setEditing(true)}
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-2xl transition active:scale-90"
          style={{ background: "rgba(255,255,255,0.22)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.40)", color: "white" }}>
          <Pencil className="h-4 w-4"/>
        </button>
        {/* Toi label */}
        <div className="absolute left-5 top-5">
          <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.20em] text-white"
            style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.30)" }}>
            Ton profil ✨
          </span>
        </div>

        {/* ── AVATAR centered on hero ── */}
        <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 translate-y-[52px] flex-col items-center">
          <div className="relative">
            {/* Multi glow rings */}
            <motion.div className="absolute rounded-full"
              style={{ inset: -8, background: "conic-gradient(from 0deg,oklch(0.75 0.13 355),oklch(0.60 0.16 0),oklch(0.80 0.12 75),oklch(0.55 0.20 345),oklch(0.75 0.13 355))", borderRadius: "999px", filter: "blur(3px)" }}
              animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}/>
            <div className="absolute rounded-full" style={{ inset: -4, background: "white", borderRadius: "999px" }}/>
            <div className="relative overflow-hidden rounded-[32px] shadow-2xl"
              style={{ border: "4px solid white", boxShadow: "0 20px 60px oklch(0.60 0.16 0 / 0.38), 0 6px 20px oklch(0.75 0.13 355 / 0.20)" }}>
              <Avatar style={me.avatar_style} options={me.avatar_options} fallbackEmoji={me.avatar_emoji} size={128}/>
            </div>
          </div>
        </div>
      </div>

      {/* ── NAME + CTA ── */}
      <div className="mt-20 flex flex-col items-center px-5 pb-2 text-center">
        <motion.h1 initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
          className="font-serif text-4xl leading-tight"
          style={{ color: "oklch(0.35 0.10 358)", textShadow: "0 1px 20px oklch(0.75 0.13 355/0.18)" }}>
          {me.display_name}
        </motion.h1>
        <motion.button initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.18 }}
          onClick={() => setEditing(true)}
          className="mt-4 flex h-11 items-center gap-2 rounded-2xl px-6 text-sm font-semibold text-white transition active:scale-95"
          style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow: "0 8px 24px oklch(0.60 0.16 0 / 0.30), inset 0 1px 0 rgba(255,255,255,0.22)" }}>
          <Pencil className="h-4 w-4"/> Modifier mon avatar
        </motion.button>
      </div>

      {/* ── CONTENT ── */}
      <div className="mx-auto max-w-md space-y-5 px-4 pt-6">

        {/* Partner card */}
        {partner && (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.22 }}>
            <LuxeCard>
              <div className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.20em] text-muted-foreground">Votre lien 💕</p>
                  <motion.div animate={{ scale:[1,1.2,1] }} transition={{ duration:2, repeat:Infinity, ease:"easeInOut" }}>
                    <Heart className="h-4 w-4" style={{ fill:"oklch(0.65 0.18 0)", color:"oklch(0.65 0.18 0)" }}/>
                  </motion.div>
                </div>
                <div className="flex items-center gap-0">
                  {/* Me */}
                  <div className="flex flex-1 flex-col items-center gap-2">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full opacity-60" style={{ background:"conic-gradient(from 0deg,oklch(0.75 0.13 355),oklch(0.60 0.16 0),oklch(0.75 0.13 355))", borderRadius:"50%", padding:2, margin:-2 }}/>
                      <div className="relative rounded-[20px] border-3 border-white shadow-lg" style={{ border:"3px solid white" }}>
                        <Avatar style={me.avatar_style} options={me.avatar_options} fallbackEmoji={me.avatar_emoji} size={72}/>
                      </div>
                    </div>
                    <p className="max-w-[90px] truncate font-serif text-lg leading-tight text-primary">{me.display_name}</p>
                  </div>
                  {/* Heart connector */}
                  <div className="relative flex flex-col items-center gap-1">
                    <div className="h-px w-10 opacity-30" style={{ background:"linear-gradient(to right,oklch(0.75 0.13 355),oklch(0.60 0.16 0))" }}/>
                    <motion.div animate={{ scale:[1,1.3,1], rotate:[0,10,-10,0] }} transition={{ duration:2.4, repeat:Infinity, ease:"easeInOut" }}
                      className="flex h-9 w-9 items-center justify-center rounded-full shadow-md"
                      style={{ background:"linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow:"0 4px 14px oklch(0.60 0.16 0/0.30)" }}>
                      <span className="text-lg">💖</span>
                    </motion.div>
                    <div className="h-px w-10 opacity-30" style={{ background:"linear-gradient(to left,oklch(0.75 0.13 355),oklch(0.60 0.16 0))" }}/>
                  </div>
                  {/* Partner */}
                  <div className="flex flex-1 flex-col items-center gap-2">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full opacity-60" style={{ background:"conic-gradient(from 90deg,oklch(0.75 0.13 355),oklch(0.60 0.16 0),oklch(0.75 0.13 355))", borderRadius:"50%", padding:2, margin:-2 }}/>
                      <div className="relative rounded-[20px] border-3 border-white shadow-lg" style={{ border:"3px solid white" }}>
                        <Avatar style={partner.avatar_style} options={partner.avatar_options} fallbackEmoji={partner.avatar_emoji} size={72}/>
                      </div>
                    </div>
                    <p className="max-w-[90px] truncate font-serif text-lg leading-tight text-primary">{partner.display_name}</p>
                  </div>
                </div>
              </div>
            </LuxeCard>
          </motion.div>
        )}

        {/* Sound picker */}
        <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.28 }}>
          <SectionLabel>Son des pensées reçues</SectionLabel>
          <LuxeCard className="p-5">
            <div className="grid grid-cols-5 gap-2">
              {SOUNDS.map(s => {
                const sel = penseeSound === s.id;
                return (
                  <button key={s.id} onClick={() => savePenseeSound(s.id)}
                    className="relative flex flex-col items-center gap-1.5 rounded-2xl py-3.5 transition active:scale-90"
                    style={{
                      background: sel ? "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" : "rgba(255,255,255,0.55)",
                      border: sel ? "1.5px solid oklch(0.75 0.13 355/0.55)" : "1.5px solid rgba(255,255,255,0.75)",
                      boxShadow: sel ? "0 6px 18px oklch(0.60 0.16 0/0.18), inset 0 1px 0 rgba(255,255,255,0.9)" : "0 2px 8px rgba(0,0,0,0.04)",
                    }}>
                    {sel && (
                      <motion.span initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:"spring", stiffness:500, damping:20 }}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-white"
                        style={{ background:"linear-gradient(135deg,#e88aab,#c45c7c)", fontSize:8 }}>✓</motion.span>
                    )}
                    <span className="text-2xl">{s.emoji}</span>
                    <span className="text-[9px] font-semibold leading-tight text-foreground/70">{s.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Music className="h-3 w-3"/> Appuie pour écouter et sélectionner
            </p>
          </LuxeCard>
        </motion.div>

        {/* Settings */}
        <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.34 }}>
          <SectionLabel>Réglages</SectionLabel>
          <LuxeCard>
            <div className="divide-y divide-rose-100/70">
              <Row
                icon={dailyNotif ? <Bell className="h-4.5 w-4.5" style={{ height:18,width:18 }}/> : <BellOff className="h-4.5 w-4.5" style={{ height:18,width:18 }}/>}
                label="Notif du matin à 8h"
                sub={dailyNotif ? "Activée — un mot doux chaque matin" : "Désactivée pour l'instant"}
                onClick={toggleNotif}
                right={<Toggle on={dailyNotif} onToggle={toggleNotif}/>}
              />
              <Row
                icon={<LayoutDashboard className="h-4.5 w-4.5" style={{ height:18,width:18 }}/>}
                label="Notre widget"
                sub="Votre espace personnalisé 🌸"
                onClick={() => window.location.href = "/widget"}
                right={<ChevronRight className="h-4 w-4 text-muted-foreground/60"/>}
              />
            </div>
          </LuxeCard>
        </motion.div>

        {/* Logout */}
        <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.40 }}>
          <LuxeCard>
            <Row icon={<LogOut className="h-4.5 w-4.5" style={{ height:18,width:18 }}/>} label="Se déconnecter" onClick={logout} danger/>
          </LuxeCard>
        </motion.div>

        {/* Coup de cœur */}
        {coupleId && me && (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.46 }}>
            <div style={{
              borderRadius: 28,
              background: "linear-gradient(145deg, oklch(0.22 0.08 355 / 0.90), oklch(0.16 0.06 340 / 0.95))",
              border: "1px solid oklch(0.48 0.26 355 / 0.35)",
              boxShadow: "0 8px 32px oklch(0.48 0.26 355 / 0.22), inset 0 1px 0 oklch(0.80 0.10 355 / 0.15)",
              padding: "22px 20px 20px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <motion.span
                  animate={{ scale: [1, 1.18, 1] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                  style={{ fontSize: 26, lineHeight: 1 }}
                >💝</motion.span>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "oklch(0.95 0.04 355)", letterSpacing: "-0.02em" }}>
                    Coup de cœur
                  </p>
                  <p style={{ margin: 0, fontSize: 11.5, color: "oklch(0.68 0.12 355)", marginTop: 2 }}>
                    Envoie une surprise à {partner?.display_name || "ton amour"} 🌸
                  </p>
                </div>
              </div>
              <div style={{ height: 1, background: "oklch(0.48 0.26 355 / 0.18)", margin: "14px 0" }} />
              <motion.button
                onClick={sendLoveBomb}
                disabled={loveCooldown > 0 || loveSending}
                whileTap={loveCooldown > 0 ? {} : { scale: 0.96 }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  padding: "15px 24px",
                  borderRadius: 18,
                  border: "none",
                  background: loveCooldown > 0
                    ? "oklch(0.18 0.04 260 / 0.70)"
                    : "linear-gradient(135deg, oklch(0.52 0.28 355) 0%, oklch(0.42 0.24 340) 100%)",
                  color: loveCooldown > 0 ? "oklch(0.45 0.06 260)" : "white",
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: loveCooldown > 0 ? "default" : "pointer",
                  boxShadow: loveCooldown > 0 ? "none" : "0 6px 24px oklch(0.52 0.28 355 / 0.45)",
                  transition: "all 0.3s ease",
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1 }}>
                  {loveCooldown > 0 ? "💤" : "💝"}
                </span>
                <span>
                  {loveSending ? "Envoi…" : loveCooldown > 0 ? `Disponible dans ${loveCooldown}s` : "Envoyer un coup de cœur"}
                </span>
              </motion.button>
              {loveCooldown === 0 && !loveSending && (
                <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 11, color: "oklch(0.55 0.10 355)" }}>
                  Ça déclenche une surprise sur son écran ✨
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.5 }}
          className="pb-4 pt-2 text-center font-serif text-xl"
          style={{ color:"oklch(0.72 0.12 358)" }}>
          Fait avec 💖
        </motion.p>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // EDIT MODE
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="relative min-h-[100dvh] pb-36 overflow-hidden"
      style={{ background: "linear-gradient(160deg,oklch(0.97 0.018 352),oklch(0.99 0.006 355) 50%,oklch(0.97 0.015 15))" }}>

      {/* Subtle bg orbs */}
      <Orb size={220} x="-8%" y="-5%" delay={0} color="oklch(0.90 0.09 352/0.55)"/>
      <Orb size={150} x="65%" y="5%" delay={2} color="oklch(0.88 0.08 15/0.45)"/>

      {/* ── TOP BAR ── */}
      <div className="sticky top-0 z-30 mx-auto flex max-w-md items-center justify-between px-4 py-4"
        style={{ background:"rgba(255,255,255,0.75)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,0.80)" }}>
        <button onClick={cancel}
          className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-semibold transition active:scale-90"
          style={{ background:"rgba(255,255,255,0.7)", border:"1px solid rgba(255,255,255,0.85)", color:"oklch(0.52 0.08 358)" }}>
          <X className="h-4 w-4"/> Annuler
        </button>
        <h1 className="font-serif text-xl" style={{ color:"oklch(0.42 0.12 358)" }}>Mon avatar</h1>
        <button onClick={shuffleAll}
          className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-semibold transition active:scale-95"
          style={{ background:"linear-gradient(135deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))", color:"oklch(0.42 0.10 358)", border:"1px solid rgba(255,255,255,0.8)" }}>
          <Shuffle className="h-3.5 w-3.5"/> Aléatoire
        </button>
      </div>

      <div className="mx-auto max-w-md space-y-4 px-4 pt-6">

        {/* ── LIVE PREVIEW ── */}
        <motion.div initial={{ scale:0.92, opacity:0 }} animate={{ scale:1, opacity:1 }} transition={{ type:"spring", stiffness:240, damping:20 }}
          className="flex flex-col items-center py-4">
          <div className="relative">
            <motion.div className="absolute rounded-full" style={{ inset:-10, background:"conic-gradient(from 0deg,oklch(0.75 0.13 355),oklch(0.60 0.16 0),oklch(0.80 0.12 75),oklch(0.55 0.20 345),oklch(0.75 0.13 355))", borderRadius:"999px", filter:"blur(4px)" }}
              animate={{ rotate:360 }} transition={{ duration:5, repeat:Infinity, ease:"linear" }}/>
            <div className="absolute rounded-full" style={{ inset:-4, background:"white", borderRadius:"999px" }}/>
            <div className="relative overflow-hidden rounded-[2.4rem] shadow-2xl" style={{ border:"4px solid white", boxShadow:"0 24px 60px oklch(0.60 0.16 0/0.32)" }}>
              <AnimatePresence mode="popLayout">
                <motion.div key={`${draftStyle}-${bumpKey}`}
                  initial={{ scale:0.80, opacity:0, rotate:-6 }} animate={{ scale:1, opacity:1, rotate:0 }} exit={{ scale:0.88, opacity:0 }}
                  transition={{ type:"spring", stiffness:320, damping:20 }}>
                  <Avatar style={draftStyle} options={draftOpts} size={180}/>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <p className="mt-5 font-serif text-3xl" style={{ color:"oklch(0.40 0.12 358)" }}>{draftName || "Ton petit nom"}</p>
        </motion.div>

        {/* ── AI CARD ── */}
        <LuxeCard>
          <div className="p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl shadow-sm"
                style={{ background:"linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow:"0 4px 12px oklch(0.60 0.16 0/0.28)" }}>
                <Wand2 className="h-4.5 w-4.5 text-white" style={{ height:18, width:18 }}/>
              </div>
              <div className="flex-1">
                <p className="font-serif text-lg leading-tight" style={{ color:"oklch(0.42 0.12 358)" }}>Génère avec l'IA</p>
                <p className="text-[10px] text-muted-foreground">Décris ton personnage en mots</p>
              </div>
              <span className="rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                style={{ background:"linear-gradient(135deg,#e88aab,#c45c7c)" }}>IA ✨</span>
            </div>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value.slice(0,280))} rows={2}
              placeholder="Ex. fille brune yeux verts, fond rose pastel…"
              className="w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none transition"
              style={{ background:"oklch(0.97 0.015 350)", border:"1px solid oklch(0.88 0.05 355/0.5)", color:"oklch(0.22 0.06 358)" }}/>
            <button onClick={generateFromAI} disabled={aiLoading || !aiPrompt.trim()}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
              style={{ background:"linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow:"0 6px 20px oklch(0.60 0.16 0/0.28)" }}>
              <Wand2 className="h-4 w-4"/>
              {aiLoading ? "L'IA dessine…" : "Générer mon avatar ✨"}
            </button>
          </div>
        </LuxeCard>

        {/* ── NAME CARD ── */}
        <LuxeCard>
          <div className="p-5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Ton petit nom</p>
            <Input value={draftName} onChange={e => setDraftName(e.target.value.slice(0,24))} maxLength={24}
              placeholder="Ex. Éloïse 🌸"
              className="h-12 rounded-2xl bg-white/80 text-base"/>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {NAME_EMOJIS.map(e => (
                <button key={e} type="button"
                  onClick={() => setDraftName(n => (n.endsWith(e) ? n.slice(0,-e.length).trimEnd() : `${n.trim()} ${e}`.trim().slice(0,24)))}
                  className="rounded-full px-2.5 py-1.5 text-lg transition active:scale-90"
                  style={{ background:"linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" }}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </LuxeCard>

        {/* ── TABS ── */}
        <div className="sticky top-[72px] z-20 rounded-full p-1.5"
          style={{ background:"rgba(255,255,255,0.92)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.88)", boxShadow:"0 4px 20px oklch(0.75 0.13 355/0.12)" }}>
          <div className="flex gap-1">
            {([
              { id:"style", label:"Style", icon:User2 },
              { id:"couleur", label:"Fond", icon:Palette },
              { id:"graine", label:"Visage", icon:Sparkles },
              { id:"options", label:"Forme", icon:ImageIcon },
            ] as { id:Tab; label:string; icon:typeof User2 }[]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="relative flex-1 inline-flex items-center justify-center gap-1 rounded-full px-2 py-2.5 text-xs font-bold transition"
                style={tab===t.id
                  ? { background:"linear-gradient(135deg,#e88aab,#c45c7c)", color:"white", boxShadow:"0 4px 14px oklch(0.60 0.16 0/0.30)" }
                  : { color:"oklch(0.58 0.08 358)" }}>
                <t.icon className="h-3.5 w-3.5" style={{ height:14, width:14 }}/> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── PANELS ── */}
        <LuxeCard>
          <div className="p-4">
            <AnimatePresence mode="wait">

              {tab==="style" && (
                <motion.div key="style" initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                  className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {AVATAR_STYLES.map(s => {
                    const sel = s.id===draftStyle;
                    return (
                      <button key={s.id} onClick={() => pickStyle(s.id)}
                        className="relative flex flex-col items-center gap-1.5 rounded-[20px] p-2 transition active:scale-95"
                        style={{
                          background: sel ? "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" : "rgba(255,255,255,0.6)",
                          border: sel ? "1.5px solid oklch(0.75 0.13 355/0.6)" : "1.5px solid rgba(255,255,255,0.75)",
                          boxShadow: sel ? "0 6px 18px oklch(0.60 0.16 0/0.18)" : "0 2px 8px rgba(0,0,0,0.04)",
                        }}>
                        {sel && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ background:"linear-gradient(135deg,#e88aab,#c45c7c)", fontSize:8 }}>✓</span>}
                        <img src={buildAvatarUrl(s.id, { seed:draftOpts.seed||"Amour", backgroundColor:"transparent" })} alt={s.label} className="h-16 w-16 rounded-xl" loading="lazy"/>
                        <span className="text-[10px] font-semibold text-foreground/75">{s.label}</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}

              {tab==="couleur" && (
                <motion.div key="couleur" initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                  className="grid grid-cols-5 gap-3">
                  {BG_PALETTE.map(c => {
                    const sel = (draftOpts.backgroundColor??"transparent")===c;
                    const isT = c==="transparent";
                    return (
                      <button key={c} onClick={() => patch({ backgroundColor:c })} aria-label={isT?"Aucun fond":`#${c}`}
                        className="relative aspect-square rounded-2xl transition active:scale-90"
                        style={{
                          background: isT ? "repeating-conic-gradient(#fff 0% 25%,#f1d1de 0% 50%) 50%/12px 12px" : `#${c}`,
                          border: sel ? "2.5px solid oklch(0.60 0.16 0)" : "2px solid rgba(255,255,255,0.6)",
                          boxShadow: sel ? "0 4px 14px oklch(0.60 0.16 0/0.30)" : "0 2px 6px rgba(0,0,0,0.08)",
                        }}>
                        {sel && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ background:"linear-gradient(135deg,#e88aab,#c45c7c)", fontSize:8 }}>✓</span>}
                      </button>
                    );
                  })}
                </motion.div>
              )}

              {tab==="graine" && (
                <motion.div key="graine" initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                  <p className="mb-3 text-xs text-muted-foreground">Change le visage en piochant une graine, ou tape la tienne ✨</p>
                  <Input value={draftOpts.seed||""} onChange={e => patch({ seed:e.target.value.slice(0,24) })}
                    placeholder="Ex. Étoile" className="mb-4 h-11 rounded-2xl bg-white/80"/>
                  <div className="grid grid-cols-3 gap-2">
                    {SEED_PRESETS.map(s => {
                      const sel = (draftOpts.seed||"")===s;
                      return (
                        <button key={s} onClick={() => patch({ seed:s })}
                          className="rounded-2xl py-2.5 text-xs font-semibold transition active:scale-95"
                          style={{
                            background: sel ? "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" : "rgba(255,255,255,0.6)",
                            border: sel ? "1.5px solid oklch(0.75 0.13 355/0.5)" : "1.5px solid rgba(255,255,255,0.7)",
                            color: sel ? "oklch(0.42 0.10 358)" : "oklch(0.38 0.06 358)",
                          }}>
                          {s}
                        </button>
                      );
                    })}
                    <button onClick={() => patch({ seed:Math.random().toString(36).slice(2,10) })}
                      className="col-span-3 mt-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition active:scale-95"
                      style={{ background:"linear-gradient(135deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))", color:"oklch(0.42 0.10 358)", border:"1.5px dashed oklch(0.75 0.13 355/0.5)" }}>
                      <Shuffle className="h-4 w-4"/> Nouveau visage aléatoire
                    </button>
                  </div>
                </motion.div>
              )}

              {tab==="options" && (
                <motion.div key="options" initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} className="space-y-5">
                  <div>
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Forme du cadre</p>
                    <div className="grid grid-cols-3 gap-2">
                      {RADIUS_OPTIONS.map(r => {
                        const sel = (draftOpts.radius??50)===r.v;
                        return (
                          <button key={r.v} onClick={() => patch({ radius:r.v })}
                            className="rounded-2xl py-3 text-sm font-semibold transition active:scale-95"
                            style={{
                              background: sel ? "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" : "rgba(255,255,255,0.6)",
                              border: sel ? "1.5px solid oklch(0.75 0.13 355/0.5)" : "1.5px solid rgba(255,255,255,0.7)",
                              color: sel ? "oklch(0.42 0.10 358)" : "oklch(0.38 0.06 358)",
                              boxShadow: sel ? "0 4px 14px oklch(0.60 0.16 0/0.16)" : "none",
                            }}>
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Miroir</p>
                    <button onClick={() => patch({ flip:!draftOpts.flip })}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-95"
                      style={{
                        background: draftOpts.flip ? "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" : "rgba(255,255,255,0.6)",
                        border: draftOpts.flip ? "1.5px solid oklch(0.75 0.13 355/0.5)" : "1.5px solid rgba(255,255,255,0.7)",
                        color: draftOpts.flip ? "oklch(0.42 0.10 358)" : "oklch(0.38 0.06 358)",
                      }}>
                      <FlipHorizontal className="h-4 w-4"/> {draftOpts.flip?"Inversé ✓":"Normal"}
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </LuxeCard>
      </div>

      {/* ── COUP DE CŒUR ── */}
      {coupleId && me && (
        <div style={{ padding: "0 16px 24px" }}>
          <div style={{
            borderRadius: 28,
            overflow: "hidden",
            background: "linear-gradient(145deg, oklch(0.13 0.06 355 / 0.85), oklch(0.10 0.04 340 / 0.90))",
            border: "1px solid oklch(0.48 0.26 355 / 0.35)",
            boxShadow: "0 8px 32px oklch(0.48 0.26 355 / 0.20), inset 0 1px 0 oklch(0.80 0.10 355 / 0.15)",
            padding: "24px 20px 20px",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <motion.span
                animate={{ scale: [1, 1.18, 1] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                style={{ fontSize: 28, lineHeight: 1 }}
              >
                💝
              </motion.span>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "oklch(0.95 0.04 355)", letterSpacing: "-0.02em" }}>
                  Coup de cœur
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "oklch(0.65 0.10 355)", marginTop: 1 }}>
                  Envoie un grand message d'amour à {partner?.display_name || "ton amour"} 🌸
                </p>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "oklch(0.48 0.26 355 / 0.20)", margin: "14px 0" }} />

            {/* Button */}
            <motion.button
              onClick={sendLoveBomb}
              disabled={loveCooldown > 0 || loveSending}
              whileTap={loveCooldown > 0 ? {} : { scale: 0.96 }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "16px 24px",
                borderRadius: 18,
                border: "none",
                background: loveCooldown > 0
                  ? "oklch(0.18 0.04 260 / 0.80)"
                  : "linear-gradient(135deg, oklch(0.52 0.28 355) 0%, oklch(0.42 0.24 340) 100%)",
                color: loveCooldown > 0 ? "oklch(0.45 0.06 260)" : "white",
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: loveCooldown > 0 ? "default" : "pointer",
                boxShadow: loveCooldown > 0
                  ? "none"
                  : "0 6px 24px oklch(0.52 0.28 355 / 0.45)",
                transition: "all 0.3s ease",
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>
                {loveCooldown > 0 ? "💤" : "💝"}
              </span>
              <span>
                {loveSending
                  ? "Envoi en cours…"
                  : loveCooldown > 0
                  ? `Disponible dans ${loveCooldown}s`
                  : `Envoyer un coup de cœur`}
              </span>
            </motion.button>

            {loveCooldown === 0 && !loveSending && (
              <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 11, color: "oklch(0.50 0.08 355)" }}>
                Ça déclenche une surprise sur l'écran de {partner?.display_name || "ton amour"} ✨
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── SAVE BAR ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center px-4"
        style={{ paddingBottom:"calc(env(safe-area-inset-bottom) + 16px)" }}>
        <div className="flex w-full max-w-md gap-2 rounded-[28px] p-2"
          style={{ background:"rgba(255,255,255,0.92)", backdropFilter:"blur(28px)", border:"1px solid rgba(255,255,255,0.88)", boxShadow:"0 -2px 20px rgba(0,0,0,0.06), 0 12px 40px oklch(0.60 0.16 0/0.16)" }}>
          <button onClick={cancel}
            className="flex h-13 flex-1 items-center justify-center rounded-[20px] text-sm font-semibold transition active:scale-95"
            style={{ height:52, background:"oklch(0.97 0.015 350)", border:"1px solid oklch(0.88 0.05 355/0.5)", color:"oklch(0.42 0.10 358)" }}>
            Annuler
          </button>
          <button onClick={save} disabled={saving}
            className="flex flex-[2] items-center justify-center gap-2 rounded-[20px] text-sm font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
            style={{ background:"linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow:"0 6px 24px oklch(0.60 0.16 0/0.32), inset 0 1px 0 rgba(255,255,255,0.20)" }}>
            <Save className="h-4 w-4"/>
            {saving ? "Sauvegarde…" : "Enregistrer 💕"}
          </button>
        </div>
      </div>

    </div>
  );
}

function burstConfetti() {
  if (typeof document === "undefined") return;
  const colors = ["#e88aab","#f8c8d8","#fde68a","#bbf7d0","#bae6fd","#c45c7c"];
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
  for (let i=0; i<36; i++) {
    const s = document.createElement("span");
    const sz = 6 + Math.random()*10;
    s.style.cssText = `position:absolute;left:${36+Math.random()*28}%;top:38%;width:${sz}px;height:${sz}px;background:${colors[i%colors.length]};border-radius:${Math.random()<0.5?"50%":"3px"};transform:translate(-50%,-50%);transition:transform 1200ms cubic-bezier(.2,.7,.2,1),opacity 1200ms;`;
    wrap.appendChild(s);
    requestAnimationFrame(()=>{
      const dx=(Math.random()-0.5)*380; const dy=-120-Math.random()*240;
      s.style.transform=`translate(${dx}px,${dy}px) rotate(${Math.random()*720}deg)`;
      s.style.opacity="0";
    });
  }
  document.body.appendChild(wrap);
  setTimeout(()=>wrap.remove(),1500);
}
