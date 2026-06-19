import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Smile, ImagePlus, Heart, X, Loader2, Palette, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { isSoundId } from "@/lib/pensee-sound";
import { cachePenseeSound, playNotificationSound, refreshPenseeSoundFromProfile } from "@/lib/notification-sound";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Notre chat 💌 — Princesse" }] }),
  component: MessagesPage,
});

type Profile = {
  id: string; display_name: string; avatar_emoji: string;
  avatar_style?: string | null; avatar_options?: Record<string, unknown> | null;
};
type Reactions = Record<string, string[]>;
type Message = {
  id: string; couple_id: string; sender_id: string;
  body: string | null; image_path: string | null;
  reactions: Reactions; read_by: string[]; created_at: string;
  read_at?: string | null;
};

// ── Theme system ──────────────────────────────────────────────────────────────
export type ThemeId = "rose" | "nuit" | "foret" | "eclat" | "braise" | "minuit";

type ThemeCfg = {
  name: string; emoji: string; desc: string;
  chatBg: string; headerBg: string; headerBorder: string;
  headerText: string; headerSub: string;
  myBubble: string; myText: string; myShadow: string;
  theirBubble: string; theirText: string; theirBorder: string;
  composerBg: string; composerBorder: string;
  inputBg: string; inputBorder: string; inputText: string; inputPlaceholder: string;
  iconBtn: string; iconBtnText: string;
  sendBtn: string; sendShadow: string;
  daySepBg: string; daySepText: string; daySepLine: string;
  reactionBg: string; reactionBorder: string;
  pickerBg: string; pickerBorder: string;
  typingDot: string;
  accentHex: string;
  dark: boolean;
};

const THEMES: Record<ThemeId, ThemeCfg> = {
  rose: {
    name: "Rose", emoji: "🌸", desc: "Doux & romantique",
    chatBg: "linear-gradient(160deg,oklch(0.96 0.022 352),oklch(0.99 0.008 355) 50%,oklch(0.97 0.018 10))",
    headerBg: "rgba(255,255,255,0.90)", headerBorder: "rgba(255,255,255,0.85)",
    headerText: "oklch(0.42 0.12 358)", headerSub: "oklch(0.58 0.08 358)",
    myBubble: "linear-gradient(145deg,#e88aab,#c45c7c)", myText: "#fff", myShadow: "0 4px 18px oklch(0.60 0.16 0/0.28)",
    theirBubble: "rgba(255,255,255,0.88)", theirText: "oklch(0.22 0.05 358)", theirBorder: "rgba(255,255,255,0.9)",
    composerBg: "rgba(255,255,255,0.92)", composerBorder: "rgba(255,255,255,0.85)",
    inputBg: "rgba(255,255,255,0.85)", inputBorder: "oklch(0.88 0.05 355/0.6)", inputText: "oklch(0.22 0.06 358)", inputPlaceholder: "oklch(0.72 0.06 358)",
    iconBtn: "linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))", iconBtnText: "oklch(0.42 0.10 358)",
    sendBtn: "linear-gradient(135deg,#e88aab,#c45c7c)", sendShadow: "0 6px 18px oklch(0.60 0.16 0/0.32)",
    daySepBg: "rgba(255,255,255,0.80)", daySepText: "oklch(0.58 0.06 358)", daySepLine: "oklch(0.75 0.13 355/0.25)",
    reactionBg: "rgba(255,255,255,0.92)", reactionBorder: "oklch(0.75 0.13 355/0.5)",
    pickerBg: "rgba(255,255,255,0.96)", pickerBorder: "rgba(255,255,255,0.85)",
    typingDot: "linear-gradient(135deg,#e88aab,#c45c7c)", accentHex: "#e88aab", dark: false,
  },
  nuit: {
    name: "Nuit", emoji: "🌙", desc: "Mystérieux & intime",
    chatBg: "linear-gradient(160deg,#0c0717,#130b24,#0a0d1f)",
    headerBg: "rgba(16,9,30,0.96)", headerBorder: "rgba(255,255,255,0.06)",
    headerText: "rgba(255,255,255,0.92)", headerSub: "rgba(255,255,255,0.45)",
    myBubble: "linear-gradient(145deg,#6d28d9,#4c1d95)", myText: "#fff", myShadow: "0 4px 18px rgba(109,40,217,0.45)",
    theirBubble: "rgba(255,255,255,0.07)", theirText: "rgba(255,255,255,0.88)", theirBorder: "rgba(255,255,255,0.10)",
    composerBg: "rgba(12,7,24,0.97)", composerBorder: "rgba(255,255,255,0.07)",
    inputBg: "rgba(255,255,255,0.06)", inputBorder: "rgba(255,255,255,0.12)", inputText: "rgba(255,255,255,0.88)", inputPlaceholder: "rgba(255,255,255,0.28)",
    iconBtn: "rgba(255,255,255,0.08)", iconBtnText: "rgba(255,255,255,0.65)",
    sendBtn: "linear-gradient(135deg,#7c3aed,#4c1d95)", sendShadow: "0 6px 18px rgba(109,40,217,0.50)",
    daySepBg: "rgba(255,255,255,0.06)", daySepText: "rgba(255,255,255,0.30)", daySepLine: "rgba(255,255,255,0.08)",
    reactionBg: "rgba(255,255,255,0.10)", reactionBorder: "rgba(109,40,217,0.5)",
    pickerBg: "rgba(20,12,38,0.98)", pickerBorder: "rgba(255,255,255,0.08)",
    typingDot: "linear-gradient(135deg,#7c3aed,#4c1d95)", accentHex: "#7c3aed", dark: true,
  },
  foret: {
    name: "Forêt", emoji: "🌿", desc: "Nature & sérénité",
    chatBg: "linear-gradient(160deg,#f0f7ee,#e8f4e1,#f4f1e8)",
    headerBg: "rgba(240,247,238,0.94)", headerBorder: "rgba(74,124,89,0.12)",
    headerText: "#2d4a35", headerSub: "#5a7a60",
    myBubble: "linear-gradient(145deg,#4a7c59,#2d5a3d)", myText: "#fff", myShadow: "0 4px 18px rgba(74,124,89,0.35)",
    theirBubble: "rgba(255,255,255,0.85)", theirText: "#2d3b2a", theirBorder: "rgba(74,124,89,0.15)",
    composerBg: "rgba(240,247,238,0.96)", composerBorder: "rgba(74,124,89,0.15)",
    inputBg: "rgba(255,255,255,0.80)", inputBorder: "rgba(74,124,89,0.25)", inputText: "#2d3b2a", inputPlaceholder: "#8aaa90",
    iconBtn: "linear-gradient(145deg,#d4ead8,#bcd8c2)", iconBtnText: "#2d5a3d",
    sendBtn: "linear-gradient(135deg,#4a7c59,#2d5a3d)", sendShadow: "0 6px 18px rgba(74,124,89,0.40)",
    daySepBg: "rgba(255,255,255,0.78)", daySepText: "#5a7a60", daySepLine: "rgba(74,124,89,0.20)",
    reactionBg: "rgba(255,255,255,0.90)", reactionBorder: "rgba(74,124,89,0.40)",
    pickerBg: "rgba(240,247,238,0.98)", pickerBorder: "rgba(74,124,89,0.15)",
    typingDot: "linear-gradient(135deg,#4a7c59,#2d5a3d)", accentHex: "#4a7c59", dark: false,
  },
  eclat: {
    name: "Éclat", emoji: "✨", desc: "Pétillant & joyeux",
    chatBg: "linear-gradient(160deg,#fff8f0,#fff0fa,#f0f4ff)",
    headerBg: "rgba(255,255,255,0.92)", headerBorder: "rgba(249,115,22,0.12)",
    headerText: "#92400e", headerSub: "#b45309",
    myBubble: "linear-gradient(145deg,#f97316,#db2777)", myText: "#fff", myShadow: "0 4px 18px rgba(249,115,22,0.35)",
    theirBubble: "rgba(255,255,255,0.88)", theirText: "#1a1a2e", theirBorder: "rgba(249,115,22,0.12)",
    composerBg: "rgba(255,255,255,0.95)", composerBorder: "rgba(249,115,22,0.12)",
    inputBg: "rgba(255,255,255,0.88)", inputBorder: "rgba(249,115,22,0.20)", inputText: "#1a1a2e", inputPlaceholder: "#a0607c",
    iconBtn: "linear-gradient(145deg,#fff0e0,#ffdde8)", iconBtnText: "#db2777",
    sendBtn: "linear-gradient(135deg,#f97316,#db2777)", sendShadow: "0 6px 18px rgba(249,115,22,0.40)",
    daySepBg: "rgba(255,255,255,0.82)", daySepText: "#b45309", daySepLine: "rgba(249,115,22,0.20)",
    reactionBg: "rgba(255,255,255,0.92)", reactionBorder: "rgba(249,115,22,0.45)",
    pickerBg: "rgba(255,252,248,0.98)", pickerBorder: "rgba(249,115,22,0.12)",
    typingDot: "linear-gradient(135deg,#f97316,#db2777)", accentHex: "#f97316", dark: false,
  },
  braise: {
    name: "Braise", emoji: "🔥", desc: "Sensuel & passionné",
    chatBg: "linear-gradient(160deg,#150808,#2a0f10,#1a0a16)",
    headerBg: "rgba(20,8,8,0.97)", headerBorder: "rgba(220,38,38,0.12)",
    headerText: "rgba(255,210,210,0.92)", headerSub: "rgba(220,38,38,0.65)",
    myBubble: "linear-gradient(145deg,#dc2626,#7f1d1d)", myText: "#fff", myShadow: "0 4px 18px rgba(220,38,38,0.45)",
    theirBubble: "rgba(255,255,255,0.05)", theirText: "rgba(255,210,200,0.90)", theirBorder: "rgba(220,38,38,0.18)",
    composerBg: "rgba(15,6,6,0.98)", composerBorder: "rgba(220,38,38,0.15)",
    inputBg: "rgba(255,255,255,0.05)", inputBorder: "rgba(220,38,38,0.20)", inputText: "rgba(255,220,210,0.90)", inputPlaceholder: "rgba(220,38,38,0.40)",
    iconBtn: "rgba(220,38,38,0.12)", iconBtnText: "rgba(220,38,38,0.80)",
    sendBtn: "linear-gradient(135deg,#dc2626,#7f1d1d)", sendShadow: "0 6px 18px rgba(220,38,38,0.50)",
    daySepBg: "rgba(255,255,255,0.05)", daySepText: "rgba(220,38,38,0.60)", daySepLine: "rgba(220,38,38,0.15)",
    reactionBg: "rgba(255,255,255,0.08)", reactionBorder: "rgba(220,38,38,0.45)",
    pickerBg: "rgba(18,7,7,0.99)", pickerBorder: "rgba(220,38,38,0.15)",
    typingDot: "linear-gradient(135deg,#dc2626,#7f1d1d)", accentHex: "#dc2626", dark: true,
  },
  minuit: {
    name: "Minuit", emoji: "🖤", desc: "Sombre & intense",
    chatBg: "linear-gradient(160deg,#060608,#0e0e12,#08080e)",
    headerBg: "rgba(6,6,8,0.99)", headerBorder: "rgba(225,29,72,0.10)",
    headerText: "rgba(255,255,255,0.88)", headerSub: "rgba(255,255,255,0.32)",
    myBubble: "linear-gradient(145deg,#e11d48,#881337)", myText: "#fff", myShadow: "0 4px 18px rgba(225,29,72,0.40)",
    theirBubble: "rgba(255,255,255,0.04)", theirText: "rgba(255,255,255,0.82)", theirBorder: "rgba(225,29,72,0.12)",
    composerBg: "rgba(4,4,6,0.99)", composerBorder: "rgba(225,29,72,0.10)",
    inputBg: "rgba(255,255,255,0.04)", inputBorder: "rgba(225,29,72,0.15)", inputText: "rgba(255,255,255,0.85)", inputPlaceholder: "rgba(255,255,255,0.22)",
    iconBtn: "rgba(225,29,72,0.10)", iconBtnText: "rgba(225,29,72,0.75)",
    sendBtn: "linear-gradient(135deg,#e11d48,#881337)", sendShadow: "0 6px 18px rgba(225,29,72,0.45)",
    daySepBg: "rgba(255,255,255,0.04)", daySepText: "rgba(255,255,255,0.25)", daySepLine: "rgba(225,29,72,0.12)",
    reactionBg: "rgba(255,255,255,0.07)", reactionBorder: "rgba(225,29,72,0.40)",
    pickerBg: "rgba(8,6,12,0.99)", pickerBorder: "rgba(225,29,72,0.12)",
    typingDot: "linear-gradient(135deg,#e11d48,#881337)", accentHex: "#e11d48", dark: true,
  },
};

const THEME_ORDER: ThemeId[] = ["rose","nuit","foret","eclat","braise","minuit"];

const EMOJIS = [
  "❤️","😍","😘","🥰","😂","🥺","😏","😉",
  "🔥","💋","💕","💖","💗","💞","💓","✨",
  "🌹","🌸","🥂","🍷","🍓","🍑","🎀","💌",
  "👀","🙈","🤭","😴","🤍","🌙","⭐","🦋",
];
const QUICK_REACTIONS = ["❤️","😍","😂","🥺","🔥","💋"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" }).replace(":"," h ");
}
function groupByDay(messages: Message[]) {
  const now = new Date(); const today = startOfDay(now);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
  const groups: { day: string; items: Message[] }[] = [];
  for (const m of messages) {
    const d = new Date(m.created_at); const day = startOfDay(d);
    let label: string;
    if (day.getTime() === today.getTime()) label = "Aujourd'hui";
    else if (day.getTime() === yesterday.getTime()) label = "Hier";
    else label = d.toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long" });
    const last = groups[groups.length-1];
    if (last && last.day === label) last.items.push(m); else groups.push({ day:label, items:[m] });
  }
  return groups;
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }

// ── Sub-components ────────────────────────────────────────────────────────────
function TypingDots({ dot }: { dot: string }) {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0,1,2].map(i => (
        <motion.span key={i} className="block h-2 w-2 rounded-full" style={{ background: dot }}
          animate={{ y:[0,-4,0], opacity:[0.4,1,0.4] }}
          transition={{ duration:0.9, repeat:Infinity, delay:i*0.16 }}/>
      ))}
    </div>
  );
}

function DaySep({ label, t }: { label: string; t: ThemeCfg }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1" style={{ background:`linear-gradient(to right,transparent,${t.daySepLine})` }}/>
      <span className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{ background:t.daySepBg, backdropFilter:"blur(8px)", color:t.daySepText, border:`1px solid ${t.daySepLine}` }}>
        {label}
      </span>
      <div className="h-px flex-1" style={{ background:`linear-gradient(to left,transparent,${t.daySepLine})` }}/>
    </div>
  );
}

// ── Theme Picker ──────────────────────────────────────────────────────────────
function ThemePicker({ current, onSelect, onClose, t }: { current: ThemeId; onSelect: (id:ThemeId)=>void; onClose:()=>void; t: ThemeCfg }) {
  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background:"rgba(0,0,0,0.55)", backdropFilter:"blur(4px)" }}
      onClick={onClose}>
      <motion.div initial={{ y:"100%" }} animate={{ y:0 }} exit={{ y:"100%" }}
        transition={{ type:"spring", stiffness:320, damping:30 }}
        className="w-full rounded-t-[32px] p-5 pb-10"
        style={{ background:t.pickerBg, border:`1px solid ${t.pickerBorder}`, boxShadow:"0 -16px 60px rgba(0,0,0,0.30)" }}
        onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ background:t.dark?"rgba(255,255,255,0.20)":"rgba(0,0,0,0.12)" }}/>
        <p className="mb-4 text-center text-sm font-semibold" style={{ color:t.headerText }}>Choisir une ambiance</p>
        <div className="grid grid-cols-3 gap-3">
          {THEME_ORDER.map(id => {
            const th = THEMES[id]; const sel = current === id;
            return (
              <button key={id} onClick={() => onSelect(id)}
                className="relative flex flex-col items-center gap-2 rounded-2xl py-4 transition active:scale-95"
                style={{
                  background: sel ? th.myBubble : (t.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
                  border: sel ? `2px solid ${th.accentHex}` : `1.5px solid ${t.dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)"}`,
                  boxShadow: sel ? `0 6px 20px ${th.accentHex}55` : "none",
                }}>
                {sel && (
                  <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full text-white text-[9px]"
                    style={{ background:th.accentHex }}>✓</span>
                )}
                <span className="text-3xl">{th.emoji}</span>
                <span className="text-[11px] font-bold" style={{ color: sel ? (th.dark?"#fff":th.accentHex) : t.headerText }}>{th.name}</span>
                <span className="text-[9px] text-center leading-tight px-1" style={{ color: sel ? (th.dark?"rgba(255,255,255,0.7)":th.accentHex+"bb") : t.headerSub }}>{th.desc}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function MessagesPage() {
  const navigate = useNavigate();
  const [me, setMe]         = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading]   = useState(true);
  const [draft, setDraft]       = useState("");
  const [sending, setSending]   = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [pendingImage, setPendingImage]   = useState<File | null>(null);
  const [imagePreview, setImagePreview]   = useState<string | null>(null);
  const [reactingId, setReactingId]       = useState<string | null>(null);
  const [imageUrls, setImageUrls]         = useState<Record<string, string>>({});
  const [themeId, setThemeId] = useState<ThemeId>(() =>
    (typeof localStorage !== "undefined" ? (localStorage.getItem("chat-theme") as ThemeId) : null) || "rose"
  );

  const t = THEMES[themeId];

  const scrollRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const typingTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pickTheme(id: ThemeId) {
    setThemeId(id);
    localStorage.setItem("chat-theme", id);
    setShowThemePicker(false);
  }

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: ures } = await supabase.auth.getUser();
      const uid = ures.user?.id;
      if (!uid) { navigate({ to: "/auth", replace: true }); return; }
      const { data: meProf } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (cancelled) return;
      setMe(meProf as Profile);
      const s = (meProf as { pensee_sound?: string })?.pensee_sound;
      if (isSoundId(s)) cachePenseeSound(s);
      const { data: c } = await supabase.from("couples").select("*").or(`user_a.eq.${uid},user_b.eq.${uid}`).maybeSingle();
      if (!c) { setLoading(false); return; }
      setCoupleId(c.id);
      const partnerId = c.user_a === uid ? c.user_b : c.user_a;
      const { data: pProf } = await supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle();
      if (cancelled) return;
      setPartner(pProf as Profile);
      const { data: msgs } = await supabase.from("messages").select("*")
        .eq("couple_id", c.id).order("created_at", { ascending: true }).limit(500);
      if (cancelled) return;
      setMessages((msgs || []) as Message[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  // Realtime
  useEffect(() => {
    if (!coupleId || !me) return;
    const msgChannel = supabase.channel(`messages-${coupleId}`)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages", filter:`couple_id=eq.${coupleId}` }, (payload) => {
        const m = payload.new as Message;
        setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
        if (m.sender_id !== me?.id) void refreshPenseeSoundFromProfile().finally(() => playNotificationSound());
      })
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"messages", filter:`couple_id=eq.${coupleId}` }, (payload) => {
        const m = payload.new as Message;
        setMessages(prev => prev.map(x => x.id === m.id ? m : x));
      })
      .on("postgres_changes", { event:"DELETE", schema:"public", table:"messages", filter:`couple_id=eq.${coupleId}` }, (payload) => {
        const old = payload.old as { id: string };
        setMessages(prev => prev.filter(x => x.id !== old.id));
      })
      .subscribe();
    const typingChannel = supabase.channel(`typing-${coupleId}`, { config:{ broadcast:{ self:false } } });
    typingChannel.on("broadcast", { event:"typing" }, (payload) => {
      const senderId = (payload.payload as { sender: string }).sender;
      if (senderId === me.id) return;
      setPartnerTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 3000);
    }).subscribe();
    typingChannelRef.current = typingChannel;
    return () => {
      supabase.removeChannel(msgChannel); supabase.removeChannel(typingChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [coupleId, me]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [messages, partnerTyping]);

  // Mark as read (also write read_at)
  useEffect(() => {
    if (!me || messages.length === 0) return;
    const unread = messages.filter(m => m.sender_id !== me.id && !(m.read_by || []).includes(me.id));
    if (unread.length === 0) return;
    const now = new Date().toISOString();
    (async () => {
      for (const m of unread) {
        const next = Array.from(new Set([...(m.read_by || []), me.id]));
        await supabase.from("messages").update({ read_by: next, read_at: m.read_at || now } as any).eq("id", m.id);
      }
    })();
  }, [messages, me]);

  // Resolve image URLs
  useEffect(() => {
    const missing = messages.filter(m => m.image_path && !imageUrls[m.image_path]);
    if (missing.length === 0) return;
    (async () => {
      const updates: Record<string, string> = {};
      for (const m of missing) {
        const { data } = await supabase.storage.from("chat-photos").createSignedUrl(m.image_path!, 60*60);
        if (data?.signedUrl) updates[m.image_path!] = data.signedUrl;
      }
      if (Object.keys(updates).length) setImageUrls(p => ({ ...p, ...updates }));
    })();
  }, [messages, imageUrls]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current; if (!el) return;
    el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [draft]);

  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current?.send({ type:"broadcast", event:"typing", payload:{ sender:me?.id } });
  }, [me]);

  const pickImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choisis une image"); return; }
    if (file.size > 8*1024*1024) { toast.error("Image trop lourde (8 Mo max)"); return; }
    setPendingImage(file); setImagePreview(URL.createObjectURL(file));
  };

  async function send() {
    const text = draft.trim();
    if (!coupleId || !me) return;
    if (!text && !pendingImage) return;
    setSending(true);
    try {
      let imagePath: string | null = null;
      if (pendingImage) {
        const ext = pendingImage.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${coupleId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("chat-photos").upload(path, pendingImage, { upsert:false, contentType:pendingImage.type });
        if (upErr) throw upErr; imagePath = path;
      }
      const { error } = await supabase.from("messages").insert({ couple_id:coupleId, sender_id:me.id, body:text||null, image_path:imagePath, read_by:[me.id] });
      if (error) throw error;
      const preview = text ? (text.length>80?text.slice(0,77)+"…":text) : (imagePath?"📷 Photo":"💌 nouveau message");
      void supabase.functions.invoke("send-push", { body:{ action:"new_message", sender_id:me.id, couple_id:coupleId, message_body:preview } }).catch(()=>{});
      setDraft(""); setPendingImage(null);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null); setShowEmojis(false);
      textareaRef.current?.focus();
    } catch (e) { toast.error((e as Error).message || "Impossible d'envoyer"); }
    finally { setSending(false); }
  }

  async function toggleReaction(msg: Message, emoji: string) {
    if (!me) return;
    const reactions: Reactions = { ...(msg.reactions || {}) };
    const list = reactions[emoji] || [];
    reactions[emoji] = list.includes(me.id) ? list.filter(id => id !== me.id) : [...list, me.id];
    if (reactions[emoji].length === 0) delete reactions[emoji];
    setMessages(prev => prev.map(x => x.id === msg.id ? { ...x, reactions } : x));
    setReactingId(null);
    await supabase.from("messages").update({ reactions }).eq("id", msg.id);
  }

  const groups = useMemo(() => groupByDay(messages), [messages]);
  const partnerName = partner?.display_name || "ton amour";

  // ── Loading ──
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center" style={{ background:t.chatBg }}>
      <motion.div animate={{ scale:[1,1.12,1], opacity:[0.5,1,0.5] }} transition={{ repeat:Infinity, duration:1.6 }}>
        <Heart className="h-8 w-8" style={{ fill:t.accentHex, color:t.accentHex }}/>
      </motion.div>
    </div>
  );

  // ── Not paired ──
  if (!coupleId || !partner) return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center"
      style={{ background:t.chatBg }}>
      <motion.div initial={{ scale:0.8,opacity:0 }} animate={{ scale:1,opacity:1 }} transition={{ type:"spring",stiffness:200,damping:18 }}
        className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background:t.dark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.6)", backdropFilter:"blur(12px)" }}>
        <Heart className="h-10 w-10 animate-heartbeat" style={{ fill:t.accentHex, color:t.accentHex }}/>
      </motion.div>
      <h1 className="relative z-10 mt-5 font-serif text-4xl" style={{ color:t.headerText }}>Pas encore appairés</h1>
      <p className="relative z-10 mt-2 text-sm" style={{ color:t.headerSub }}>Allez dans <em>Notre nid</em> d'abord.</p>
      <Link to="/hub" className="relative z-10 mt-7 flex h-13 items-center gap-2 rounded-2xl px-8 text-sm font-semibold text-white transition active:scale-95"
        style={{ height:52, background:t.sendBtn, boxShadow:t.sendShadow }}>
        <Heart className="h-4 w-4 fill-white text-white"/> Aller au nid 💞
      </Link>
    </div>
  );

  return (
    <div className="relative flex h-[100dvh] flex-col" style={{ background:t.chatBg }}>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 shrink-0"
        style={{ paddingTop:"env(safe-area-inset-top)", background:t.headerBg, backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)", borderBottom:`1px solid ${t.headerBorder}`, boxShadow:"0 4px 20px rgba(0,0,0,0.08)" }}>
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition active:scale-90"
            style={{ color:t.headerText, background:t.dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)" }}>
            <ArrowLeft className="h-5 w-5"/>
          </Link>
          {/* Partner avatar */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full" style={{ background:`conic-gradient(from 0deg,${t.accentHex},${t.dark?"rgba(255,255,255,0.3)":t.accentHex+"88"},${t.accentHex})`, borderRadius:"50%", padding:2, margin:-2 }}/>
            <div className="relative rounded-[14px] border-2 shadow-sm" style={{ borderColor:t.dark?"#000":"#fff" }}>
              <Avatar style={partner.avatar_style} options={(partner.avatar_options as never)||{}} fallbackEmoji={partner.avatar_emoji} size={40}/>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-lg leading-tight" style={{ color:t.headerText }}>{partnerName}</p>
            <AnimatePresence mode="wait">
              {partnerTyping
                ? <motion.p key="typing" initial={{ opacity:0,y:3 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
                    className="text-[11px] font-medium italic" style={{ color:t.accentHex }}>en train d'écrire…</motion.p>
                : <motion.p key="sub" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                    className="text-[11px]" style={{ color:t.headerSub }}>à toi pour toujours 💕</motion.p>}
            </AnimatePresence>
          </div>
          {/* Theme button */}
          <button onClick={() => setShowThemePicker(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition active:scale-90"
            style={{ background:t.dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.05)", color:t.headerText }}>
            <Palette className="h-4.5 w-4.5" style={{ height:18, width:18 }}/>
          </button>
          {/* Online dot */}
          <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background:"linear-gradient(135deg,#86efac,#22c55e)", boxShadow:"0 0 6px #22c55e88" }}/>
        </div>
      </header>

      {/* ── MESSAGES ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-4 py-5">

          {/* Empty state */}
          {messages.length === 0 && (
            <motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }} className="mt-16 flex flex-col items-center text-center">
              <motion.div animate={{ scale:[1,1.08,1] }} transition={{ repeat:Infinity, duration:2.8, ease:"easeInOut" }}
                className="flex h-24 w-24 items-center justify-center rounded-full text-4xl"
                style={{ background:t.dark?"rgba(255,255,255,0.06)":"rgba(255,255,255,0.80)", boxShadow:`0 12px 36px ${t.accentHex}44` }}>
                💌
              </motion.div>
              <p className="mt-6 font-serif text-2xl" style={{ color:t.headerText }}>Votre histoire commence ici</p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color:t.headerSub }}>
                Envoie ton premier <em>mot doux</em> à {partnerName}.
              </p>
            </motion.div>
          )}

          {/* Message groups */}
          {groups.map(group => (
            <div key={group.day}>
              <DaySep label={group.day} t={t}/>
              <div className="space-y-1">
                {group.items.map((m, idx) => {
                  const mine = m.sender_id === me!.id;
                  const prev = group.items[idx-1];
                  const next = group.items[idx+1];
                  const stacked = prev && prev.sender_id === m.sender_id
                    && (new Date(m.created_at).getTime()-new Date(prev.created_at).getTime() < 5*60*1000);
                  const isLastInGroup = !next || next.sender_id !== m.sender_id
                    || (new Date(next.created_at).getTime()-new Date(m.created_at).getTime() > 5*60*1000);
                  const reactionEntries = Object.entries(m.reactions||{}).filter(([,ids])=>ids.length>0);
                  const isLastMine = mine && !group.items.slice(idx+1).some(x => x.sender_id === me!.id);
                  const seenByPartner = mine && (m.read_by||[]).includes(partner.id);

                  return (
                    <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                      <div className={cn("flex items-end gap-1.5", mine ? "justify-end" : "justify-start")}>
                        {/* Partner avatar */}
                        {!mine && (
                          <div className={cn("shrink-0 mb-0.5", stacked && "invisible")} style={{ width:32, height:32 }}>
                            <div className="rounded-[10px] border-2 shadow-sm" style={{ borderColor:t.dark?"#111":"#fff" }}>
                              <Avatar style={partner.avatar_style} options={(partner.avatar_options as never)||{}} fallbackEmoji={partner.avatar_emoji} size={28}/>
                            </div>
                          </div>
                        )}

                        <div className="relative max-w-[78%]">
                          {/* Bubble */}
                          <motion.button type="button"
                            initial={{ opacity:0,y:6,scale:0.95 }} animate={{ opacity:1,y:0,scale:1 }}
                            transition={{ duration:0.18 }}
                            onContextMenu={e=>{ e.preventDefault(); setReactingId(reactingId===m.id?null:m.id); }}
                            onDoubleClick={()=>setReactingId(reactingId===m.id?null:m.id)}
                            className="block w-full text-left transition-all active:scale-[0.97]"
                            style={{
                              padding: m.image_path&&!m.body ? "4px" : "10px 14px",
                              borderRadius: mine
                                ? (stacked ? "18px 6px 6px 18px" : "18px 18px 6px 18px")
                                : (stacked ? "6px 18px 18px 6px" : "18px 18px 18px 6px"),
                              background: mine ? t.myBubble : t.theirBubble,
                              backdropFilter: mine ? undefined : "blur(12px)",
                              border: mine ? "none" : `1px solid ${t.theirBorder}`,
                              boxShadow: mine ? t.myShadow : `0 3px 12px rgba(0,0,0,${t.dark?0.25:0.06}), inset 0 1px 0 rgba(255,255,255,${t.dark?0.04:0.8})`,
                              color: mine ? t.myText : t.theirText,
                            }}>
                            {m.image_path && (
                              <div className="overflow-hidden rounded-[14px]">
                                {imageUrls[m.image_path]
                                  ? <img src={imageUrls[m.image_path]} alt="" className="block max-h-72 w-full object-cover"/>
                                  : <div className="flex h-40 w-48 items-center justify-center" style={{ background:t.dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)" }}><Loader2 className="h-4 w-4 animate-spin" style={{ color:t.accentHex }}/></div>}
                              </div>
                            )}
                            {m.body && (
                              <p className="whitespace-pre-wrap break-words text-[15px] leading-snug" style={{ marginTop:m.image_path?8:0 }}>
                                {m.body}
                              </p>
                            )}
                          </motion.button>

                          {/* Reactions */}
                          {reactionEntries.length > 0 && (
                            <div className={cn("absolute -bottom-3.5 flex gap-1 z-10", mine?"right-2":"left-2")}>
                              {reactionEntries.map(([emoji,ids])=>(
                                <button key={emoji} onClick={()=>toggleReaction(m,emoji)}
                                  className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] transition active:scale-90"
                                  style={{ background:t.reactionBg, border:`1.5px solid ${ids.includes(me!.id)?t.reactionBorder:"transparent"}`, backdropFilter:"blur(8px)", boxShadow:"0 2px 8px rgba(0,0,0,0.15)" }}>
                                  <span>{emoji}</span>
                                  {ids.length>1&&<span style={{ color:t.headerSub }}>{ids.length}</span>}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Quick reactions */}
                          <AnimatePresence>
                            {reactingId===m.id && (
                              <motion.div
                                initial={{ opacity:0,y:8,scale:0.88 }} animate={{ opacity:1,y:0,scale:1 }} exit={{ opacity:0,scale:0.88 }}
                                className={cn("absolute -top-12 z-20 flex gap-1 rounded-full p-1.5", mine?"right-0":"left-0")}
                                style={{ background:t.reactionBg, backdropFilter:"blur(16px)", border:`1px solid ${t.reactionBorder}`, boxShadow:"0 8px 24px rgba(0,0,0,0.20)" }}>
                                {QUICK_REACTIONS.map(e=>(
                                  <button key={e} onClick={()=>toggleReaction(m,e)}
                                    className="rounded-full p-1.5 text-xl transition hover:scale-125 active:scale-110">{e}</button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Timestamp + read receipt — shown on last message of each burst */}
                      {isLastInGroup && (
                        <div className={cn("mt-1 flex items-center gap-1.5 px-1", mine ? "justify-end pr-2" : "justify-start pl-10")}>
                          <span className="text-[10px]" style={{ color:t.headerSub }}>{fmtTime(m.created_at)}</span>
                          {mine && seenByPartner && (
                            <>
                              <span className="text-[10px]" style={{ color:t.accentHex }}>·</span>
                              <div className="h-3.5 w-3.5 overflow-hidden rounded-full border shadow-sm" style={{ borderColor:t.dark?"#222":"#fff" }}>
                                <Avatar style={partner.avatar_style} options={(partner.avatar_options as never)||{}} fallbackEmoji={partner.avatar_emoji} size={14}/>
                              </div>
                              <span className="text-[10px]" style={{ color:t.accentHex }}>
                                lu {m.read_at ? fmtTime(m.read_at) : ""}
                              </span>
                            </>
                          )}
                          {mine && !seenByPartner && (
                            <span className="text-[10px]" style={{ color:t.headerSub }}>envoyé</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {partnerTyping && (
            <motion.div initial={{ opacity:0,y:6 }} animate={{ opacity:1,y:0 }} className="mt-3 flex items-end gap-2">
              <div className="shrink-0 rounded-[10px] border-2 shadow-sm" style={{ borderColor:t.dark?"#111":"#fff" }}>
                <Avatar style={partner.avatar_style} options={(partner.avatar_options as never)||{}} fallbackEmoji={partner.avatar_emoji} size={28}/>
              </div>
              <div className="rounded-[18px] rounded-bl-[6px] px-4 py-3"
                style={{ background:t.theirBubble, backdropFilter:"blur(12px)", border:`1px solid ${t.theirBorder}`, boxShadow:`0 3px 12px rgba(0,0,0,${t.dark?0.25:0.06})` }}>
                <TypingDots dot={t.typingDot}/>
              </div>
            </motion.div>
          )}
          <div className="h-4"/>
        </div>
      </div>

      {/* ── EMOJI PICKER ── */}
      <AnimatePresence>
        {showEmojis && (
          <motion.div initial={{ y:100,opacity:0 }} animate={{ y:0,opacity:1 }} exit={{ y:100,opacity:0 }}
            transition={{ type:"spring",stiffness:340,damping:28 }}
            style={{ background:t.pickerBg, backdropFilter:"blur(24px)", borderTop:`1px solid ${t.pickerBorder}` }}>
            <div className="mx-auto grid max-w-md grid-cols-8 gap-1 p-3">
              {EMOJIS.map(e=>(
                <button key={e} type="button" onClick={()=>{ setDraft(d=>d+e); textareaRef.current?.focus(); }}
                  className="rounded-xl p-2 text-2xl transition active:scale-90"
                  style={{ ":hover":{ background:t.dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)" } } as React.CSSProperties}>
                  {e}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── COMPOSER ── */}
      <div className="shrink-0"
        style={{ background:t.composerBg, backdropFilter:"blur(24px)", borderTop:`1px solid ${t.composerBorder}`, paddingBottom:"env(safe-area-inset-bottom)", boxShadow:`0 -4px 20px rgba(0,0,0,${t.dark?0.30:0.06})` }}>
        {imagePreview && (
          <div className="mx-auto max-w-md px-4 pt-3">
            <div className="relative inline-block overflow-hidden rounded-2xl shadow-md"
              style={{ border:`2px solid ${t.dark?"rgba(255,255,255,0.12)":"#fff"}` }}>
              <img src={imagePreview} alt="" className="block h-24 w-24 object-cover"/>
              <button onClick={()=>{ if(imagePreview) URL.revokeObjectURL(imagePreview); setPendingImage(null); setImagePreview(null); }}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-white"
                style={{ background:"rgba(0,0,0,0.60)", backdropFilter:"blur(4px)" }}>
                <X className="h-3.5 w-3.5"/>
              </button>
            </div>
          </div>
        )}
        <div className="mx-auto flex max-w-md items-end gap-2 px-3 py-3">
          <button type="button" onClick={()=>fileInputRef.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition active:scale-90"
            style={{ background:t.iconBtn, color:t.iconBtnText }}>
            <ImagePlus className="h-5 w-5"/>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={e=>{ pickImage(e.target.files?.[0]||null); e.target.value=""; }}/>
          <button type="button" onClick={()=>setShowEmojis(v=>!v)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition active:scale-90"
            style={showEmojis
              ? { background:t.sendBtn, color:"#fff", boxShadow:t.sendShadow }
              : { background:t.iconBtn, color:t.iconBtnText }}>
            <Smile className="h-5 w-5"/>
          </button>
          <div className="flex flex-1 items-end rounded-[22px] px-4 py-2.5"
            style={{ background:t.inputBg, border:`1.5px solid ${t.inputBorder}`, boxShadow:`inset 0 1px 0 rgba(255,255,255,${t.dark?0.04:0.8})` }}>
            <textarea ref={textareaRef} rows={1} value={draft}
              onChange={e=>{ setDraft(e.target.value); broadcastTyping(); }}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); void send(); } }}
              placeholder={`Écris à ${partnerName}…`}
              className="max-h-[140px] min-h-[22px] w-full resize-none bg-transparent text-[15px] leading-snug outline-none"
              style={{ color:t.inputText, caretColor:t.accentHex }}/>
          </div>
          <button type="button" onClick={()=>void send()} disabled={sending||(!draft.trim()&&!pendingImage)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white transition active:scale-90 disabled:opacity-40"
            style={{ background:t.sendBtn, boxShadow:(sending||(!draft.trim()&&!pendingImage))?"none":t.sendShadow }}>
            {sending?<Loader2 className="h-5 w-5 animate-spin"/>:<Send className="h-5 w-5"/>}
          </button>
        </div>
      </div>

      {/* ── THEME PICKER ── */}
      <AnimatePresence>
        {showThemePicker && (
          <ThemePicker current={themeId} onSelect={pickTheme} onClose={()=>setShowThemePicker(false)} t={t}/>
        )}
      </AnimatePresence>

    </div>
  );
}
