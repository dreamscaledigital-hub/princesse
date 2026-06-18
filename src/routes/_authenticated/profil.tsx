import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellOff, LayoutDashboard, LogOut, Pencil, Sparkles,
  Save, X, Shuffle, Palette, FlipHorizontal, Image as ImageIcon,
  User2, Wand2, ChevronRight, Check, Music,
} from "lucide-react";
import { isSoundId, playSound, SOUNDS, type SoundId } from "@/lib/pensee-sound";
import { cachePenseeSound } from "@/lib/notification-sound";
import { generateAvatarFromPrompt } from "@/lib/avatar-ai.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

// ── Glass card ────────────────────────────────────────────────────────────────
function GlassCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={"overflow-hidden rounded-[28px] " + className}
      style={{
        background: "rgba(255,255,255,0.78)",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.82)",
        boxShadow: "0 8px 40px oklch(0.60 0.16 0 / 0.10), 0 2px 12px oklch(0.75 0.13 355 / 0.08), inset 0 1px 0 rgba(255,255,255,0.95)",
        ...style,
      }}>
      {children}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{children}</p>;
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
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

// ── Row item (settings row) ───────────────────────────────────────────────────
function SettingsRow({ icon, label, sub, right, onClick, danger = false }: {
  icon: React.ReactNode; label: string; sub?: string; right?: React.ReactNode; onClick?: () => void; danger?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={"flex w-full items-center gap-3.5 px-5 py-4 text-left transition " + (onClick && !danger ? "hover:bg-primary/5 active:bg-primary/10" : "") + (danger ? " hover:bg-red-50/60 active:bg-red-100/60" : "")}>
      <span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl " + (danger ? "bg-red-50 text-red-400" : "text-primary")}
        style={danger ? {} : { background: "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={"text-sm font-semibold " + (danger ? "text-red-500" : "text-foreground")}>{label}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function ProfilPage() {
  const navigate = useNavigate();
  const [me, setMe]           = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
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

  // ── load ──
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
    const { data: c } = await supabase.from("couples").select("user_a,user_b")
      .or(`user_a.eq.${ures.user.id},user_b.eq.${ures.user.id}`).maybeSingle();
    if (c) {
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
    <div className="flex min-h-[70vh] items-center justify-center">
      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }}
        className="font-serif text-2xl text-primary">…</motion.div>
    </div>
  );

  // ═════════════════════════════════════════════════════════
  // VIEW MODE
  // ═════════════════════════════════════════════════════════
  if (!editing && me) return (
    <div className="relative mx-auto max-w-md space-y-4 px-4 pb-28 pt-6">

      {/* ── HERO CARD ── */}
      <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.45 }}>
        <GlassCard>
          {/* Gradient header band */}
          <div className="relative h-28 w-full overflow-hidden"
            style={{ background: "linear-gradient(165deg,oklch(0.90 0.062 352),oklch(0.78 0.108 358),oklch(0.82 0.085 10))" }}>
            {/* Petal decorations */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-30" viewBox="0 0 380 112" aria-hidden>
              {[0,60,120,180,240,300].map((d,i)=>(
                <g key={i} transform={`translate(320,56) rotate(${d})`}>
                  <ellipse rx="40" ry="18" fill="white" transform="translate(0,-34)" opacity="0.7"/>
                </g>
              ))}
              {[30,90,150,210,270,330].map((d,i)=>(
                <g key={i} transform={`translate(55,20) rotate(${d})`}>
                  <ellipse rx="22" ry="10" fill="white" transform="translate(0,-18)" opacity="0.5"/>
                </g>
              ))}
            </svg>
            {/* Edit button */}
            <button onClick={() => setEditing(true)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-2xl transition active:scale-95"
              style={{ background: "rgba(255,255,255,0.28)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.5)" }}>
              <Pencil className="h-4 w-4 text-white"/>
            </button>
          </div>
          {/* Avatar pulled up */}
          <div className="relative px-5 pb-5">
            <div className="relative -mt-14 mb-3 flex items-end gap-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-full animate-breathe"
                  style={{ background: "conic-gradient(from 0deg,oklch(0.75 0.13 355),oklch(0.60 0.16 0),oklch(0.80 0.12 75),oklch(0.75 0.13 355))", borderRadius: "50%", padding: 3, margin: -3 }}/>
                <div className="relative rounded-[26px] border-4 border-white shadow-lg"
                  style={{ boxShadow: "0 8px 28px oklch(0.60 0.16 0 / 0.28)" }}>
                  <Avatar style={me.avatar_style} options={me.avatar_options} fallbackEmoji={me.avatar_emoji} size={100}/>
                </div>
              </div>
              <div className="pb-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Toi 💕</p>
                <p className="font-serif text-3xl leading-tight text-primary">{me.display_name}</p>
              </div>
            </div>
            <button onClick={() => setEditing(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow: "0 6px 20px oklch(0.60 0.16 0 / 0.30), inset 0 1px 0 rgba(255,255,255,0.18)" }}>
              <Pencil className="h-4 w-4"/> Modifier mon avatar
            </button>
          </div>
        </GlassCard>
      </motion.div>

      {/* ── PARTNER ── */}
      {partner && (
        <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.08 }}>
          <GlassCard>
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-full opacity-70"
                  style={{ background: "conic-gradient(from 90deg,oklch(0.75 0.13 355),oklch(0.80 0.12 75),oklch(0.60 0.16 0),oklch(0.75 0.13 355))", borderRadius: "50%", padding: 2, margin: -2 }}/>
                <div className="relative rounded-[20px] border-3 border-white"
                  style={{ border: "3px solid white" }}>
                  <Avatar style={partner.avatar_style} options={partner.avatar_options} fallbackEmoji={partner.avatar_emoji} size={60}/>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Ton amour</p>
                <p className="truncate font-serif text-2xl text-primary">{partner.display_name}</p>
              </div>
              <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full"
                style={{ background: "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" }}>
                <span className="text-base">💕</span>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ── SON DES PENSÉES ── */}
      <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.12 }}>
        <SectionLabel>Son des pensées reçues</SectionLabel>
        <GlassCard className="p-5">
          <div className="grid grid-cols-5 gap-2">
            {SOUNDS.map(s => (
              <button key={s.id} onClick={() => savePenseeSound(s.id)}
                className="relative flex flex-col items-center gap-1.5 rounded-2xl py-3 transition active:scale-95"
                style={{
                  background: penseeSound === s.id ? "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" : "rgba(255,255,255,0.5)",
                  border: penseeSound === s.id ? "1.5px solid oklch(0.75 0.13 355 / 0.6)" : "1.5px solid rgba(255,255,255,0.7)",
                  boxShadow: penseeSound === s.id ? "0 4px 14px oklch(0.60 0.16 0 / 0.18)" : "none",
                }}>
                {penseeSound === s.id && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-white"
                    style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", fontSize: 8 }}>✓</span>
                )}
                <span className="text-xl">{s.emoji}</span>
                <span className="text-[9px] font-semibold leading-tight text-foreground/70">{s.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Music className="h-3 w-3"/> Appuie pour écouter et sélectionner
          </p>
        </GlassCard>
      </motion.div>

      {/* ── SETTINGS ── */}
      <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.18 }}>
        <SectionLabel>Réglages</SectionLabel>
        <GlassCard>
          <div className="divide-y divide-primary/8">
            <SettingsRow
              icon={dailyNotif ? <Bell className="h-4 w-4"/> : <BellOff className="h-4 w-4"/>}
              label="Notif du matin à 8h"
              sub={dailyNotif ? "Activée — un petit mot chaque matin" : "Désactivée"}
              onClick={toggleNotif}
              right={<Toggle on={dailyNotif} onToggle={toggleNotif}/>}
            />
            <SettingsRow
              icon={<LayoutDashboard className="h-4 w-4"/>}
              label="Notre widget"
              sub="Votre espace personnalisé 🌸"
              onClick={() => window.location.href = "/widget"}
              right={<ChevronRight className="h-4 w-4 text-muted-foreground"/>}
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* ── LOGOUT ── */}
      <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.22 }}>
        <GlassCard>
          <div className="divide-y divide-primary/8">
            <SettingsRow
              icon={<LogOut className="h-4 w-4"/>}
              label="Se déconnecter"
              onClick={logout}
              danger
            />
          </div>
        </GlassCard>
      </motion.div>

      <p className="pt-4 text-center font-serif text-lg text-primary/30">Fait avec 💖</p>
    </div>
  );

  // ═════════════════════════════════════════════════════════
  // EDIT MODE
  // ═════════════════════════════════════════════════════════
  return (
    <div className="relative mx-auto max-w-md px-4 pb-36 pt-5">

      {/* Top bar */}
      <div className="mb-5 flex items-center justify-between">
        <button onClick={cancel}
          className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-primary active:bg-primary/5"
          style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)" }}>
          <X className="h-4 w-4"/> Annuler
        </button>
        <h1 className="font-serif text-xl text-primary">Mon avatar</h1>
        <button onClick={shuffleAll}
          className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-medium transition active:scale-95"
          style={{ background: "linear-gradient(135deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))", color: "oklch(0.42 0.10 358)", border: "1px solid rgba(255,255,255,0.8)" }}>
          <Shuffle className="h-3.5 w-3.5"/> Aléatoire
        </button>
      </div>

      {/* LIVE PREVIEW */}
      <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-6 flex flex-col items-center">
        <div className="relative">
          {/* Glow ring */}
          <div className="absolute inset-0 animate-breathe rounded-full"
            style={{ background: "conic-gradient(from 0deg,oklch(0.75 0.13 355),oklch(0.60 0.16 0),oklch(0.80 0.12 75),oklch(0.75 0.13 355))", borderRadius: "999px", padding: 4, margin: -4, filter: "blur(2px)" }}/>
          <div className="relative rounded-[2.2rem] border-4 border-white"
            style={{ boxShadow: "0 20px 50px oklch(0.60 0.16 0 / 0.30)" }}>
            <AnimatePresence mode="popLayout">
              <motion.div key={`${draftStyle}-${bumpKey}`}
                initial={{ scale: 0.82, opacity: 0, rotate: -5 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 20 }}>
                <Avatar style={draftStyle} options={draftOpts} size={180}/>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <p className="mt-4 font-serif text-2xl text-primary">{draftName || "Ton petit nom"}</p>
      </motion.div>

      {/* AI CARD */}
      <GlassCard className="mb-4">
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)" }}>
              <Wand2 className="h-4 w-4 text-white"/>
            </div>
            <div>
              <p className="font-serif text-lg text-primary">Génère avec l'IA</p>
              <p className="text-[10px] text-muted-foreground">Décris ton personnage en mots</p>
            </div>
            <span className="ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
              style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)" }}>IA ✨</span>
          </div>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value.slice(0, 280))} rows={2}
            placeholder="Ex. fille brune yeux verts, fond rose pastel…"
            className="w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none transition"
            style={{ background: "oklch(0.97 0.015 350)", border: "1px solid oklch(0.88 0.05 355 / 0.5)", color: "oklch(0.22 0.06 358)" }}/>
          <button onClick={generateFromAI} disabled={aiLoading || !aiPrompt.trim()}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow: "0 6px 20px oklch(0.60 0.16 0 / 0.28)" }}>
            <Wand2 className="h-4 w-4"/>
            {aiLoading ? "L'IA dessine…" : "Générer mon avatar ✨"}
          </button>
        </div>
      </GlassCard>

      {/* NAME CARD */}
      <GlassCard className="mb-4">
        <div className="p-5">
          <SectionLabel>Ton petit nom</SectionLabel>
          <Input value={draftName} onChange={e => setDraftName(e.target.value.slice(0, 24))} maxLength={24}
            placeholder="Ex. Éloïse 🌸"
            className="h-12 rounded-2xl bg-white/80 text-base"/>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {NAME_EMOJIS.map(e => (
              <button key={e} type="button"
                onClick={() => setDraftName(n => (n.endsWith(e) ? n.slice(0, -e.length).trimEnd() : `${n.trim()} ${e}`.trim().slice(0, 24)))}
                className="rounded-full px-2.5 py-1.5 text-base transition active:scale-90"
                style={{ background: "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" }}>
                {e}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* TABS */}
      <div className="sticky top-2 z-20 mb-3 flex gap-1 rounded-full p-1"
        style={{ background: "rgba(255,255,255,0.90)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.85)", boxShadow: "0 4px 16px oklch(0.75 0.13 355 / 0.12)" }}>
        {([
          { id: "style", label: "Style", icon: User2 },
          { id: "couleur", label: "Fond", icon: Palette },
          { id: "graine", label: "Visage", icon: Sparkles },
          { id: "options", label: "Forme", icon: ImageIcon },
        ] as { id: Tab; label: string; icon: typeof User2 }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-full px-2 py-2 text-xs font-semibold transition"
            style={tab === t.id
              ? { background: "linear-gradient(135deg,#e88aab,#c45c7c)", color: "white", boxShadow: "0 4px 12px oklch(0.60 0.16 0 / 0.28)" }
              : { color: "oklch(0.52 0.08 358)" }}>
            <t.icon className="h-3.5 w-3.5"/> {t.label}
          </button>
        ))}
      </div>

      {/* PANELS */}
      <GlassCard className="mb-5">
        <div className="p-4">
          <AnimatePresence mode="wait">

            {tab === "style" && (
              <motion.div key="style" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {AVATAR_STYLES.map(s => {
                  const sel = s.id === draftStyle;
                  return (
                    <button key={s.id} onClick={() => pickStyle(s.id)}
                      className="relative flex flex-col items-center gap-1.5 rounded-2xl p-2 transition active:scale-95"
                      style={{
                        background: sel ? "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" : "rgba(255,255,255,0.6)",
                        border: sel ? "1.5px solid oklch(0.75 0.13 355 / 0.6)" : "1.5px solid rgba(255,255,255,0.7)",
                        boxShadow: sel ? "0 6px 18px oklch(0.60 0.16 0 / 0.18)" : "none",
                      }}>
                      {sel && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-white"
                        style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", fontSize: 8 }}>✓</span>}
                      <img src={buildAvatarUrl(s.id, { seed: draftOpts.seed || "Amour", backgroundColor: "transparent" })}
                        alt={s.label} className="h-16 w-16 rounded-xl" loading="lazy"/>
                      <span className="text-[10px] font-semibold text-foreground/75">{s.label}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}

            {tab === "couleur" && (
              <motion.div key="couleur" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="grid grid-cols-5 gap-3">
                {BG_PALETTE.map(c => {
                  const sel = (draftOpts.backgroundColor ?? "transparent") === c;
                  const isT = c === "transparent";
                  return (
                    <button key={c} onClick={() => patch({ backgroundColor: c })} aria-label={isT ? "Aucun fond" : `#${c}`}
                      className="relative aspect-square rounded-2xl transition active:scale-90"
                      style={{
                        background: isT ? "repeating-conic-gradient(#fff 0% 25%,#f1d1de 0% 50%) 50%/12px 12px" : `#${c}`,
                        border: sel ? "2.5px solid oklch(0.60 0.16 0)" : "2px solid rgba(255,255,255,0.6)",
                        boxShadow: sel ? "0 4px 14px oklch(0.60 0.16 0 / 0.30)" : "0 2px 6px rgba(0,0,0,0.08)",
                      }}>
                      {sel && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-white"
                        style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", fontSize: 8 }}>✓</span>}
                    </button>
                  );
                })}
              </motion.div>
            )}

            {tab === "graine" && (
              <motion.div key="graine" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <p className="mb-3 text-xs text-muted-foreground">Change le visage en piochant une graine, ou tape la tienne ✨</p>
                <Input value={draftOpts.seed || ""} onChange={e => patch({ seed: e.target.value.slice(0, 24) })}
                  placeholder="Ex. Étoile" className="mb-4 h-11 rounded-2xl bg-white/80"/>
                <div className="grid grid-cols-3 gap-2">
                  {SEED_PRESETS.map(s => {
                    const sel = (draftOpts.seed || "") === s;
                    return (
                      <button key={s} onClick={() => patch({ seed: s })}
                        className="rounded-2xl py-2.5 text-xs font-semibold transition active:scale-95"
                        style={{
                          background: sel ? "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" : "rgba(255,255,255,0.6)",
                          border: sel ? "1.5px solid oklch(0.75 0.13 355 / 0.5)" : "1.5px solid rgba(255,255,255,0.7)",
                          color: sel ? "oklch(0.42 0.10 358)" : "oklch(0.38 0.06 358)",
                        }}>
                        {s}
                      </button>
                    );
                  })}
                  <button onClick={() => patch({ seed: Math.random().toString(36).slice(2, 10) })}
                    className="col-span-3 mt-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition active:scale-95"
                    style={{ background: "linear-gradient(135deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))", color: "oklch(0.42 0.10 358)", border: "1.5px dashed oklch(0.75 0.13 355 / 0.5)" }}>
                    <Shuffle className="h-4 w-4"/> Nouveau visage aléatoire
                  </button>
                </div>
              </motion.div>
            )}

            {tab === "options" && (
              <motion.div key="options" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                <div>
                  <SectionLabel>Forme du cadre</SectionLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {RADIUS_OPTIONS.map(r => {
                      const sel = (draftOpts.radius ?? 50) === r.v;
                      return (
                        <button key={r.v} onClick={() => patch({ radius: r.v })}
                          className="rounded-2xl py-3 text-sm font-semibold transition active:scale-95"
                          style={{
                            background: sel ? "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" : "rgba(255,255,255,0.6)",
                            border: sel ? "1.5px solid oklch(0.75 0.13 355 / 0.5)" : "1.5px solid rgba(255,255,255,0.7)",
                            color: sel ? "oklch(0.42 0.10 358)" : "oklch(0.38 0.06 358)",
                            boxShadow: sel ? "0 4px 14px oklch(0.60 0.16 0 / 0.16)" : "none",
                          }}>
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <SectionLabel>Miroir</SectionLabel>
                  <button onClick={() => patch({ flip: !draftOpts.flip })}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-95"
                    style={{
                      background: draftOpts.flip ? "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))" : "rgba(255,255,255,0.6)",
                      border: draftOpts.flip ? "1.5px solid oklch(0.75 0.13 355 / 0.5)" : "1.5px solid rgba(255,255,255,0.7)",
                      color: draftOpts.flip ? "oklch(0.42 0.10 358)" : "oklch(0.38 0.06 358)",
                    }}>
                    <FlipHorizontal className="h-4 w-4"/> {draftOpts.flip ? "Inversé ✓" : "Normal"}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </GlassCard>

      {/* SAVE BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)", padding: "0 16px calc(env(safe-area-inset-bottom) + 16px)" }}>
        <div className="flex w-full max-w-md gap-2 rounded-[22px] p-2"
          style={{ background: "rgba(255,255,255,0.90)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.85)", boxShadow: "0 8px 32px oklch(0.60 0.16 0 / 0.16), 0 2px 8px oklch(0.75 0.13 355 / 0.10)" }}>
          <button onClick={cancel}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl text-sm font-semibold transition active:scale-95"
            style={{ background: "oklch(0.97 0.015 350)", border: "1px solid oklch(0.88 0.05 355 / 0.5)", color: "oklch(0.42 0.10 358)" }}>
            Annuler
          </button>
          <button onClick={save} disabled={saving}
            className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition active:scale-[0.97] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow: "0 6px 20px oklch(0.60 0.16 0 / 0.30), inset 0 1px 0 rgba(255,255,255,0.18)" }}>
            <Save className="h-4 w-4"/>
            {saving ? "Sauvegarde…" : "Enregistrer"}
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
  for (let i = 0; i < 28; i++) {
    const s = document.createElement("span");
    const sz = 6 + Math.random() * 9;
    s.style.cssText = `position:absolute;left:${38+Math.random()*24}%;top:38%;width:${sz}px;height:${sz}px;background:${colors[i%colors.length]};border-radius:${Math.random()<0.5?"50%":"3px"};transform:translate(-50%,-50%);transition:transform 1150ms cubic-bezier(.2,.7,.2,1),opacity 1150ms;`;
    wrap.appendChild(s);
    requestAnimationFrame(()=>{
      const dx=(Math.random()-0.5)*340; const dy=-130-Math.random()*220;
      s.style.transform=`translate(${dx}px,${dy}px) rotate(${Math.random()*720}deg)`;
      s.style.opacity="0";
    });
  }
  document.body.appendChild(wrap);
  setTimeout(()=>wrap.remove(),1400);
}
