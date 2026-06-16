import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, LogOut, Pencil, Sparkles, Save, X, Shuffle, Palette, FlipHorizontal, Image as ImageIcon, User2, Wand2 } from "lucide-react";
import { generateAvatarFromPrompt } from "@/lib/avatar-ai.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Avatar,
  AVATAR_STYLES,
  BG_PALETTE,
  SEED_PRESETS,
  buildAvatarUrl,
  randomAvatar,
  type AvatarOptions,
  type AvatarStyle,
} from "@/components/Avatar";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({ meta: [{ title: "Profil — Princesse" }] }),
  component: ProfilPage,
});

type Profile = {
  id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_style: string;
  avatar_options: AvatarOptions;
};

const NAME_EMOJIS = ["", "💕", "🌸", "🦋", "🌙", "⭐", "🌹", "🍀", "🐝", "🦊", "🐻", "✨", "🍓", "🌷"];

const RADIUS_OPTIONS = [
  { v: 0, label: "Carré" },
  { v: 20, label: "Doux" },
  { v: 50, label: "Rond" },
];

type Tab = "style" | "couleur" | "graine" | "options";

function ProfilPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Draft state (only persisted on Save)
  const [draftName, setDraftName] = useState("");
  const [draftStyle, setDraftStyle] = useState<string>("lorelei");
  const [draftOpts, setDraftOpts] = useState<AvatarOptions>({ seed: "Amour", backgroundColor: "f8c8d8", flip: false, radius: 50 });
  const [tab, setTab] = useState<Tab>("style");
  const [bumpKey, setBumpKey] = useState(0); // triggers the bounce
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const meIdRef = useRef<string | null>(null);

  async function generateFromAI() {
    const p = aiPrompt.trim();
    if (!p) { toast.error("Décris ton personnage en quelques mots ✨"); return; }
    setAiLoading(true);
    try {
      const res = await generateAvatarFromPrompt({ data: { prompt: p } });
      if (!res.ok) {
        if (res.error === "credits") toast.error("Plus de crédits IA 💸");
        else if (res.error === "rate_limit") toast.error("Trop de demandes, réessaie dans un instant 💕");
        else toast.error("L'IA n'a pas répondu, réessaie 🌸");
        return;
      }
      const r = res.result;
      setDraftStyle(r.style);
      setDraftOpts({ seed: r.seed, backgroundColor: r.backgroundColor, flip: r.flip, radius: r.radius, extras: r.extras });
      setBumpKey((k) => k + 1);
      toast.success("Voilà ton perso ! ✨");
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function load() {
    const { data: ures } = await supabase.auth.getUser();
    if (!ures.user) { navigate({ to: "/auth", replace: true }); return; }
    meIdRef.current = ures.user.id;

    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_emoji, avatar_style, avatar_options")
      .eq("id", ures.user.id)
      .maybeSingle();

    if (data) {
      const p = data as Profile;
      setMe(p);
      resetDraft(p);
    }

    // Partner via couples
    const { data: c } = await supabase
      .from("couples")
      .select("user_a, user_b")
      .or(`user_a.eq.${ures.user.id},user_b.eq.${ures.user.id}`)
      .maybeSingle();
    if (c) {
      const partnerId = c.user_a === ures.user.id ? c.user_b : c.user_a;
      const { data: pp } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_emoji, avatar_style, avatar_options")
        .eq("id", partnerId)
        .maybeSingle();
      if (pp) setPartner(pp as Profile);
    }

    setLoading(false);
  }

  // Realtime: refresh on profile change (me + partner)
  useEffect(() => {
    const channel = supabase
      .channel("profiles-self")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const row = payload.new as Profile;
          if (row.id === meIdRef.current) setMe((prev) => (prev ? { ...prev, ...row } : row));
          else if (partner && row.id === partner.id) setPartner((prev) => (prev ? { ...prev, ...row } : row));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partner?.id]);

  function resetDraft(p: Profile) {
    setDraftName(p.display_name || "");
    setDraftStyle(p.avatar_style || "lorelei");
    setDraftOpts({
      seed: p.avatar_options?.seed || "Amour",
      backgroundColor: p.avatar_options?.backgroundColor ?? "f8c8d8",
      flip: !!p.avatar_options?.flip,
      radius: typeof p.avatar_options?.radius === "number" ? p.avatar_options.radius : 50,
      extras: p.avatar_options?.extras || {},
    });
  }

  function bump() { setBumpKey((k) => k + 1); }

  function patch(opts: Partial<AvatarOptions>) {
    setDraftOpts((o) => ({ ...o, ...opts }));
    bump();
  }

  function pickStyle(s: AvatarStyle) {
    setDraftStyle(s);
    // extras are style-specific; clear them when changing style manually
    setDraftOpts((o) => ({ ...o, extras: {} }));
    bump();
  }

  function shuffleAll() {
    const r = randomAvatar();
    setDraftStyle(r.style);
    setDraftOpts({ ...r.options, extras: {} });
    bump();
  }

  async function save() {
    if (!me) return;
    const name = draftName.trim();
    if (!name) { toast.error("Choisis un petit nom 💕"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name,
        avatar_style: draftStyle,
        avatar_options: draftOpts,
      })
      .eq("id", me.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setMe({ ...me, display_name: name, avatar_style: draftStyle, avatar_options: draftOpts });
    setEditing(false);
    toast.success("C'est tout toi ! 🥰", { duration: 2200 });
    burstConfetti();
  }

  function cancel() {
    if (me) resetDraft(me);
    setEditing(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <span className="animate-pulse font-serif text-xl">…</span>
      </div>
    );
  }

  // ─────────── VIEW MODE ───────────
  if (!editing && me) {
    return (
      <div className="relative mx-auto max-w-md px-5 pb-28 pt-6">
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6 text-center">
          <h1 className="font-serif text-3xl text-primary"><i>Mon</i> profil</h1>
          <p className="mt-1 text-xs text-muted-foreground">Choisis ton personnage 🌸</p>
        </motion.div>

        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-white/70 p-6 shadow-[0_20px_50px_-30px_rgba(196,92,124,0.4)] backdrop-blur"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-primary/15 blur-2xl" />

          <div className="relative flex flex-col items-center">
            <div className="rounded-[2rem] border-4 border-white bg-gradient-to-br from-white/80 to-accent/15 p-2 shadow-lg">
              <Avatar style={me.avatar_style} options={me.avatar_options} fallbackEmoji={me.avatar_emoji} size={160} />
            </div>
            <p className="mt-4 font-serif text-3xl text-primary"><i>{me.display_name}</i></p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">toi 💕</p>

            <Button
              onClick={() => setEditing(true)}
              className="mt-5 h-12 rounded-2xl px-6 shadow-md"
            >
              <Pencil className="mr-2 h-4 w-4" /> Modifier mon profil
            </Button>
          </div>
        </motion.div>

        {/* Partner card */}
        {partner && (
          <motion.div
            initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
            className="mt-5 flex items-center gap-4 rounded-3xl border border-primary/15 bg-white/55 p-4 backdrop-blur"
          >
            <Avatar style={partner.avatar_style} options={partner.avatar_options} fallbackEmoji={partner.avatar_emoji} size={64} ring />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">ton amour</p>
              <p className="truncate font-serif text-xl text-primary"><i>{partner.display_name}</i></p>
            </div>
          </motion.div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <a href="/widget" className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/60 text-sm font-medium text-rose-500 transition hover:bg-rose-100">
            <LayoutDashboard className="h-4 w-4" />
            Notre widget 🌸
          </a>
          <Button onClick={logout} variant="outline" className="h-12 w-full rounded-2xl text-muted-foreground hover:border-red-300 hover:text-red-500">
            <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
          </Button>
        </div>

        <p className="mt-8 text-center font-serif text-xl text-primary/40">Fait avec 💖</p>
      </div>
    );
  }

  // ─────────── EDIT MODE ───────────
  return (
    <div className="relative mx-auto max-w-md px-5 pb-32 pt-5">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={cancel} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <X className="h-4 w-4" /> Annuler
        </button>
        <button onClick={shuffleAll} className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/30">
          <Shuffle className="h-3.5 w-3.5" /> Aléatoire 🎲
        </button>
      </div>

      {/* LIVE PREVIEW */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="relative mx-auto mb-5 flex flex-col items-center"
      >
        <div className="relative rounded-[2rem] border-4 border-white bg-gradient-to-br from-white/80 to-accent/15 p-2 shadow-[0_25px_60px_-30px_rgba(196,92,124,0.5)]">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`${draftStyle}-${bumpKey}`}
              initial={{ scale: 0.85, opacity: 0, rotate: -4 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
            >
              <Avatar style={draftStyle} options={draftOpts} size={180} />
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="mt-3 font-serif text-2xl text-primary">
          <i>{draftName || "Ton petit nom"}</i>
        </p>
      </motion.div>

      {/* AI DESCRIBE → AVATAR */}
      <div className="mb-5 rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/10 via-white/60 to-primary/10 p-4 backdrop-blur">
        <div className="mb-2 flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <span className="font-serif text-lg text-primary"><i>Décris ton perso</i></span>
          <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">IA ✨</span>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">Ex. « fille brune yeux verts, fond rose pastel » ou « petit roux souriant, style cartoon »</p>
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value.slice(0, 280))}
          rows={2}
          placeholder="Décris ton personnage…"
          className="w-full resize-none rounded-2xl border border-primary/20 bg-white/80 px-3 py-2 text-sm outline-none transition focus:border-primary"
        />
        <Button
          onClick={generateFromAI}
          disabled={aiLoading || !aiPrompt.trim()}
          className="mt-2 h-11 w-full rounded-2xl shadow"
        >
          <Wand2 className="mr-2 h-4 w-4" />
          {aiLoading ? "L'IA dessine…" : "Générer avec l'IA ✨"}
        </Button>
      </div>

      {/* NAME */}
      <div className="mb-5 rounded-3xl border border-primary/20 bg-white/70 p-4 backdrop-blur">
        <label className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Ton petit nom</label>
        <Input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value.slice(0, 24))}
          maxLength={24}
          placeholder="Ex. Éloïse 🌸"
          className="mt-2 h-11 rounded-2xl bg-white/80 text-base"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {NAME_EMOJIS.filter(Boolean).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setDraftName((n) => (n.endsWith(e) ? n.slice(0, -e.length).trimEnd() : `${n.trim()} ${e}`.trim().slice(0, 24)))}
              className="rounded-full bg-primary/10 px-2.5 py-1 text-base transition active:scale-90 hover:bg-primary/20"
            >{e}</button>
          ))}
        </div>
      </div>

      {/* TABS */}
      <div className="sticky top-2 z-10 mb-3 flex gap-1 rounded-full border border-primary/15 bg-white/85 p-1 shadow-sm backdrop-blur">
        {([
          { id: "style", label: "Style", icon: User2 },
          { id: "couleur", label: "Fond", icon: Palette },
          { id: "graine", label: "Visage", icon: Sparkles },
          { id: "options", label: "Forme", icon: ImageIcon },
        ] as { id: Tab; label: string; icon: typeof User2 }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-medium transition ${tab === t.id ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-primary"}`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* PANELS */}
      <div className="rounded-3xl border border-primary/15 bg-white/65 p-4 backdrop-blur">
        <AnimatePresence mode="wait">
          {tab === "style" && (
            <motion.div key="style" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {AVATAR_STYLES.map((s) => {
                const selected = s.id === draftStyle;
                return (
                  <button
                    key={s.id}
                    onClick={() => pickStyle(s.id)}
                    className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 p-2 transition active:scale-95 ${selected ? "border-primary bg-primary/10 shadow" : "border-transparent bg-white/70 hover:border-primary/40"}`}
                  >
                    <img
                      src={buildAvatarUrl(s.id, { seed: draftOpts.seed || "Amour", backgroundColor: "transparent" })}
                      alt={s.label}
                      className="h-16 w-16 rounded-xl"
                      loading="lazy"
                    />
                    <span className="text-[10px] font-medium text-foreground/80">{s.label}</span>
                    {selected && (
                      <span className="absolute right-1 top-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">✓</span>
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}

          {tab === "couleur" && (
            <motion.div key="couleur" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid grid-cols-5 gap-3">
              {BG_PALETTE.map((c) => {
                const selected = (draftOpts.backgroundColor ?? "transparent") === c;
                const isTransparent = c === "transparent";
                return (
                  <button
                    key={c}
                    onClick={() => patch({ backgroundColor: c })}
                    aria-label={isTransparent ? "Aucun fond" : `#${c}`}
                    className={`relative aspect-square rounded-2xl border-2 transition active:scale-90 ${selected ? "border-primary shadow" : "border-white/60 hover:border-primary/40"}`}
                    style={{
                      background: isTransparent
                        ? "repeating-conic-gradient(#fff 0% 25%, #f1d1de 0% 50%) 50% / 12px 12px"
                        : `#${c}`,
                    }}
                  >
                    {selected && (
                      <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow">✓</span>
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}

          {tab === "graine" && (
            <motion.div key="graine" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="mb-2 text-xs text-muted-foreground">Change le visage en piochant une graine, ou tape la tienne ✨</p>
              <Input
                value={draftOpts.seed || ""}
                onChange={(e) => patch({ seed: e.target.value.slice(0, 24) })}
                placeholder="Ex. Étoile"
                className="mb-3 h-11 rounded-2xl bg-white/80"
              />
              <div className="grid grid-cols-3 gap-2">
                {SEED_PRESETS.map((s) => {
                  const selected = (draftOpts.seed || "") === s;
                  return (
                    <button
                      key={s}
                      onClick={() => patch({ seed: s })}
                      className={`rounded-2xl border px-3 py-2 text-xs font-medium transition active:scale-95 ${selected ? "border-primary bg-primary/10 text-primary" : "border-primary/20 bg-white/70 text-foreground/80 hover:bg-primary/5"}`}
                    >{s}</button>
                  );
                })}
                <button
                  onClick={() => patch({ seed: Math.random().toString(36).slice(2, 10) })}
                  className="col-span-3 mt-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-accent/15 px-3 py-2 text-sm font-medium text-primary transition active:scale-95"
                >
                  <Shuffle className="h-4 w-4" /> Nouveau visage aléatoire
                </button>
              </div>
            </motion.div>
          )}

          {tab === "options" && (
            <motion.div key="options" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Forme du cadre</p>
                <div className="grid grid-cols-3 gap-2">
                  {RADIUS_OPTIONS.map((r) => {
                    const selected = (draftOpts.radius ?? 50) === r.v;
                    return (
                      <button
                        key={r.v}
                        onClick={() => patch({ radius: r.v })}
                        className={`rounded-2xl border-2 px-3 py-3 text-xs font-medium transition active:scale-95 ${selected ? "border-primary bg-primary/10 text-primary" : "border-primary/15 bg-white/70 text-foreground/80"}`}
                      >{r.label}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Miroir</p>
                <button
                  onClick={() => patch({ flip: !draftOpts.flip })}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 text-sm font-medium transition active:scale-95 ${draftOpts.flip ? "border-primary bg-primary/10 text-primary" : "border-primary/15 bg-white/70 text-foreground/80"}`}
                >
                  <FlipHorizontal className="h-4 w-4" /> {draftOpts.flip ? "Inversé" : "Normal"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SAVE BAR */}
      <div className="sticky bottom-3 mt-5 flex gap-2 rounded-2xl border border-primary/20 bg-white/85 p-2 shadow-lg backdrop-blur">
        <Button onClick={cancel} variant="outline" className="h-12 flex-1 rounded-xl">
          Annuler
        </Button>
        <Button onClick={save} disabled={saving} className="h-12 flex-[2] rounded-xl shadow">
          <Save className="mr-2 h-4 w-4" /> {saving ? "…" : "Enregistrer 💾"}
        </Button>
      </div>
    </div>
  );
}

// Tiny confetti burst — DOM only, no extra deps
function burstConfetti() {
  if (typeof document === "undefined") return;
  const colors = ["#e88aab", "#f8c8d8", "#fde68a", "#bbf7d0", "#bae6fd", "#c45c7c"];
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;";
  for (let i = 0; i < 24; i++) {
    const s = document.createElement("span");
    const size = 6 + Math.random() * 8;
    s.style.cssText = `position:absolute;left:${40 + Math.random() * 20}%;top:35%;width:${size}px;height:${size}px;background:${colors[i % colors.length]};border-radius:${Math.random() < 0.5 ? "50%" : "2px"};transform:translate(-50%,-50%);transition:transform 1100ms cubic-bezier(.2,.7,.2,1),opacity 1100ms;`;
    wrap.appendChild(s);
    requestAnimationFrame(() => {
      const dx = (Math.random() - 0.5) * 320;
      const dy = -120 - Math.random() * 200;
      s.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.random() * 720}deg)`;
      s.style.opacity = "0";
    });
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 1300);
}
