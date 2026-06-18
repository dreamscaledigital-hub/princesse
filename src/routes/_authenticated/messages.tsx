import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Smile, ImagePlus, Heart, X, Loader2 } from "lucide-react";
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
};

const EMOJIS = [
  "❤️","😍","😘","🥰","😂","🥺","😏","😉",
  "🔥","💋","💕","💖","💗","💞","💓","✨",
  "🌹","🌸","🥂","🍷","🍓","🍑","🎀","💌",
  "👀","🙈","🤭","😴","🤍","🌙","⭐","🦋",
];
const QUICK_REACTIONS = ["❤️","😍","😂","🥺","🔥","💋"];

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0,1,2].map(i => (
        <motion.span key={i} className="block h-2 w-2 rounded-full"
          style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)" }}
          animate={{ y:[0,-4,0], opacity:[0.4,1,0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i*0.16 }}/>
      ))}
    </div>
  );
}

// ── Day separator ─────────────────────────────────────────────────────────────
function DaySep({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: "linear-gradient(to right,transparent,oklch(0.75 0.13 355 / 0.3))" }}/>
      <span className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
        style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.85)", boxShadow: "0 2px 8px oklch(0.75 0.13 355 / 0.10)" }}>
        {label}
      </span>
      <div className="h-px flex-1" style={{ background: "linear-gradient(to left,transparent,oklch(0.75 0.13 355 / 0.3))" }}/>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
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
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [pendingImage, setPendingImage]   = useState<File | null>(null);
  const [imagePreview, setImagePreview]   = useState<string | null>(null);
  const [reactingId, setReactingId]       = useState<string | null>(null);
  const [imageUrls, setImageUrls]         = useState<Record<string, string>>({});

  const scrollRef    = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const typingTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` }, (payload) => {
        const m = payload.new as Message;
        setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]);
        if (m.sender_id !== me?.id) void refreshPenseeSoundFromProfile().finally(() => playNotificationSound());
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` }, (payload) => {
        const m = payload.new as Message;
        setMessages(prev => prev.map(x => x.id === m.id ? m : x));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` }, (payload) => {
        const old = payload.old as { id: string };
        setMessages(prev => prev.filter(x => x.id !== old.id));
      })
      .subscribe();
    const typingChannel = supabase.channel(`typing-${coupleId}`, { config: { broadcast: { self: false } } });
    typingChannel.on("broadcast", { event: "typing" }, (payload) => {
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

  // Mark as read
  useEffect(() => {
    if (!me || messages.length === 0) return;
    const unread = messages.filter(m => m.sender_id !== me.id && !(m.read_by || []).includes(me.id));
    if (unread.length === 0) return;
    (async () => {
      for (const m of unread) {
        const next = Array.from(new Set([...(m.read_by || []), me.id]));
        await supabase.from("messages").update({ read_by: next }).eq("id", m.id);
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
    typingChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { sender: me?.id } });
  }, [me]);

  const pickImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choisis une image"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image trop lourde (8 Mo max)"); return; }
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
        const { error: upErr } = await supabase.storage.from("chat-photos").upload(path, pendingImage, { upsert: false, contentType: pendingImage.type });
        if (upErr) throw upErr; imagePath = path;
      }
      const { error } = await supabase.from("messages").insert({ couple_id: coupleId, sender_id: me.id, body: text || null, image_path: imagePath, read_by: [me.id] });
      if (error) throw error;
      const preview = text ? (text.length > 80 ? text.slice(0,77)+"…" : text) : (imagePath ? "📷 Photo" : "💌 nouveau message");
      void supabase.functions.invoke("send-push", { body: { action: "new_message", sender_id: me.id, couple_id: coupleId, message_body: preview } }).catch(()=>{});
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
    <div className="flex min-h-screen items-center justify-center"
      style={{ background: "linear-gradient(160deg,oklch(0.95 0.030 352),oklch(0.98 0.012 355))" }}>
      <motion.div animate={{ scale:[1,1.12,1], opacity:[0.5,1,0.5] }} transition={{ repeat:Infinity, duration:1.6 }}>
        <Heart className="h-8 w-8 fill-primary text-primary"/>
      </motion.div>
    </div>
  );

  // ── Not paired ──
  if (!coupleId || !partner) return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center"
      style={{ background: "linear-gradient(160deg,oklch(0.93 0.042 352),oklch(0.97 0.018 355))" }}>
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-20" viewBox="0 0 390 844" aria-hidden preserveAspectRatio="xMidYMid slice">
        {[0,60,120,180,240,300].map((d,i)=>(
          <g key={i} transform={`translate(310,120) rotate(${d})`}>
            <ellipse rx="55" ry="25" fill="oklch(0.60 0.16 0)" transform="translate(0,-46)"/>
          </g>
        ))}
      </svg>
      <motion.div initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }} transition={{ type:"spring", stiffness:200, damping:18 }}
        className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", boxShadow: "0 12px 40px oklch(0.60 0.16 0 / 0.20)" }}>
        <Heart className="h-10 w-10 fill-primary text-primary animate-heartbeat"/>
      </motion.div>
      <motion.h1 initial={{ y:16, opacity:0 }} animate={{ y:0, opacity:1 }} transition={{ delay:0.15 }}
        className="relative z-10 mt-5 font-serif text-4xl text-primary">
        Pas encore appairés
      </motion.h1>
      <motion.p initial={{ y:12, opacity:0 }} animate={{ y:0, opacity:1 }} transition={{ delay:0.25 }}
        className="relative z-10 mt-2 text-sm text-muted-foreground">
        Pour discuter, appairez-vous d'abord dans <em>Notre nid</em>.
      </motion.p>
      <motion.div initial={{ y:10, opacity:0 }} animate={{ y:0, opacity:1 }} transition={{ delay:0.35 }}>
        <Link to="/hub"
          className="relative z-10 mt-7 flex h-13 items-center gap-2 rounded-2xl px-8 text-sm font-semibold text-white transition active:scale-95"
          style={{ height:52, background:"linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow:"0 8px 24px oklch(0.60 0.16 0 / 0.30)" }}>
          <Heart className="h-4 w-4 fill-white text-white"/> Aller au nid 💞
        </Link>
      </motion.div>
    </div>
  );

  // ── Chat ──
  return (
    <div className="relative flex h-[100dvh] flex-col"
      style={{ background: "linear-gradient(160deg,oklch(0.96 0.022 352),oklch(0.99 0.008 355),oklch(0.97 0.018 10))" }}>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-30 shrink-0"
        style={{ paddingTop: "env(safe-area-inset-top)", background: "rgba(255,255,255,0.88)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", borderBottom: "1px solid rgba(255,255,255,0.85)", boxShadow: "0 4px 20px oklch(0.60 0.16 0 / 0.08)" }}>
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition hover:bg-primary/8 active:scale-90"
            style={{ color: "oklch(0.52 0.10 358)" }}>
            <ArrowLeft className="h-5 w-5"/>
          </Link>
          {/* Partner avatar with ring */}
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-full" style={{ background:"conic-gradient(from 0deg,oklch(0.75 0.13 355),oklch(0.60 0.16 0),oklch(0.80 0.12 75),oklch(0.75 0.13 355))", borderRadius:"50%", padding:2, margin:-2 }}/>
            <div className="relative rounded-[14px] border-2 border-white shadow-sm">
              <Avatar style={partner.avatar_style} options={(partner.avatar_options as never) || {}} fallbackEmoji={partner.avatar_emoji} size={40}/>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-lg leading-tight text-primary">{partnerName}</p>
            <AnimatePresence mode="wait">
              {partnerTyping ? (
                <motion.p key="typing" initial={{ opacity:0, y:3 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                  className="text-[11px] font-medium text-primary/70 italic">
                  en train d'écrire…
                </motion.p>
              ) : (
                <motion.p key="sub" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  className="text-[11px] text-muted-foreground">
                  à toi pour toujours 💕
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          {/* Online dot decoration */}
          <div className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background:"linear-gradient(135deg,#86efac,#22c55e)", boxShadow:"0 0 6px #22c55e88" }}/>
        </div>
      </header>

      {/* ── MESSAGES ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-4 py-5">

          {/* Empty state */}
          {messages.length === 0 && (
            <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} className="mt-16 flex flex-col items-center text-center">
              <div className="relative">
                <motion.div animate={{ scale:[1,1.08,1] }} transition={{ repeat:Infinity, duration:2.8, ease:"easeInOut" }}
                  className="flex h-24 w-24 items-center justify-center rounded-full text-4xl"
                  style={{ background:"linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))", boxShadow:"0 12px 36px oklch(0.60 0.16 0 / 0.20)" }}>
                  💌
                </motion.div>
                {/* Floating hearts */}
                {[-20,0,20].map((x,i)=>(
                  <motion.div key={i} className="absolute text-base" style={{ left:`calc(50% + ${x}px)`, top:-8 }}
                    animate={{ y:[-4,4,-4], opacity:[0.5,1,0.5] }}
                    transition={{ repeat:Infinity, duration:2+i*0.4, delay:i*0.3 }}>
                    ♥
                  </motion.div>
                ))}
              </div>
              <p className="mt-6 font-serif text-2xl text-primary">Votre histoire commence ici</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Envoie ton premier <em>mot doux</em> à {partnerName}.
              </p>
            </motion.div>
          )}

          {/* Message groups */}
          {groups.map(group => (
            <div key={group.day}>
              <DaySep label={group.day}/>
              <div className="space-y-1.5">
                {group.items.map((m, idx) => {
                  const mine = m.sender_id === me!.id;
                  const prev = group.items[idx - 1];
                  const stacked = prev && prev.sender_id === m.sender_id
                    && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5*60*1000);
                  const reactionEntries = Object.entries(m.reactions || {}).filter(([,ids]) => ids.length > 0);

                  return (
                    <div key={m.id} className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
                      {!mine && (
                        <div className={cn("shrink-0", stacked && "invisible")} style={{ width:32, height:32 }}>
                          <div className="rounded-[10px] border-2 border-white shadow-sm">
                            <Avatar style={partner.avatar_style} options={(partner.avatar_options as never)||{}} fallbackEmoji={partner.avatar_emoji} size={28}/>
                          </div>
                        </div>
                      )}

                      <div className="relative max-w-[78%]">
                        <motion.button type="button"
                          initial={{ opacity:0, y:6, scale:0.95 }}
                          animate={{ opacity:1, y:0, scale:1 }}
                          transition={{ duration:0.18 }}
                          onContextMenu={e => { e.preventDefault(); setReactingId(reactingId === m.id ? null : m.id); }}
                          onDoubleClick={() => setReactingId(reactingId === m.id ? null : m.id)}
                          className="block w-full text-left transition-all active:scale-[0.97]"
                          style={{
                            padding: m.image_path && !m.body ? "4px" : "10px 16px",
                            borderRadius: mine ? "22px 22px 6px 22px" : "22px 22px 22px 6px",
                            background: mine
                              ? "linear-gradient(145deg,#e88aab,#c45c7c)"
                              : "rgba(255,255,255,0.88)",
                            backdropFilter: mine ? undefined : "blur(12px)",
                            border: mine ? "none" : "1px solid rgba(255,255,255,0.9)",
                            boxShadow: mine
                              ? "0 4px 18px oklch(0.60 0.16 0 / 0.28), inset 0 1px 0 rgba(255,255,255,0.18)"
                              : "0 3px 12px oklch(0.75 0.13 355 / 0.10), inset 0 1px 0 rgba(255,255,255,0.9)",
                            color: mine ? "white" : "oklch(0.22 0.05 358)",
                          }}>
                          {m.image_path && (
                            <div className="overflow-hidden rounded-[18px]">
                              {imageUrls[m.image_path]
                                ? <img src={imageUrls[m.image_path]} alt="" className="block max-h-72 w-full object-cover"/>
                                : <div className="flex h-40 w-48 items-center justify-center" style={{ background:"oklch(0.93 0.025 355)" }}><Loader2 className="h-4 w-4 animate-spin text-primary"/></div>}
                            </div>
                          )}
                          {m.body && (
                            <p className="whitespace-pre-wrap break-words text-[15px] leading-snug" style={{ marginTop: m.image_path ? 8 : 0 }}>
                              {m.body}
                            </p>
                          )}
                        </motion.button>

                        {/* Reactions */}
                        {reactionEntries.length > 0 && (
                          <div className={cn("absolute -bottom-3.5 flex gap-1", mine ? "right-2" : "left-2")}>
                            {reactionEntries.map(([emoji, ids]) => (
                              <button key={emoji} onClick={() => toggleReaction(m, emoji)}
                                className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] transition active:scale-90"
                                style={{
                                  background: "rgba(255,255,255,0.92)", backdropFilter:"blur(8px)",
                                  border: ids.includes(me!.id) ? "1.5px solid oklch(0.75 0.13 355 / 0.6)" : "1px solid rgba(255,255,255,0.8)",
                                  boxShadow: "0 2px 8px oklch(0.60 0.16 0 / 0.12)",
                                }}>
                                <span>{emoji}</span>
                                {ids.length > 1 && <span className="text-muted-foreground">{ids.length}</span>}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Quick reactions picker */}
                        <AnimatePresence>
                          {reactingId === m.id && (
                            <motion.div
                              initial={{ opacity:0, y:8, scale:0.88 }}
                              animate={{ opacity:1, y:0, scale:1 }}
                              exit={{ opacity:0, scale:0.88 }}
                              className={cn("absolute -top-12 z-20 flex gap-1 rounded-full p-1.5", mine ? "right-0" : "left-0")}
                              style={{ background:"rgba(255,255,255,0.95)", backdropFilter:"blur(16px)", border:"1px solid rgba(255,255,255,0.9)", boxShadow:"0 8px 24px oklch(0.60 0.16 0 / 0.18)" }}>
                              {QUICK_REACTIONS.map(e => (
                                <button key={e} onClick={() => toggleReaction(m, e)}
                                  className="rounded-full p-1.5 text-xl transition hover:scale-125 active:scale-110">
                                  {e}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {mine && <div className="w-0.5 shrink-0"/>}
                    </div>
                  );
                })}

                {/* Vu indicator */}
                {(() => {
                  const lastMine = [...group.items].reverse().find(m => m.sender_id === me!.id);
                  if (!lastMine || !(lastMine.read_by || []).includes(partner.id)) return null;
                  return (
                    <div className="mt-1 flex items-center justify-end gap-1 pr-1">
                      <div className="h-3.5 w-3.5 overflow-hidden rounded-full border border-white shadow-sm">
                        <Avatar style={partner.avatar_style} options={(partner.avatar_options as never)||{}} fallbackEmoji={partner.avatar_emoji} size={14}/>
                      </div>
                      <span className="text-[10px] text-muted-foreground">vu</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {partnerTyping && (
            <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className="mt-3 flex items-end gap-2">
              <div className="shrink-0 rounded-[10px] border-2 border-white shadow-sm">
                <Avatar style={partner.avatar_style} options={(partner.avatar_options as never)||{}} fallbackEmoji={partner.avatar_emoji} size={28}/>
              </div>
              <div className="rounded-[22px] rounded-bl-[6px] px-4 py-3"
                style={{ background:"rgba(255,255,255,0.88)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,0.9)", boxShadow:"0 3px 12px oklch(0.75 0.13 355 / 0.10)" }}>
                <TypingDots/>
              </div>
            </motion.div>
          )}

          {/* Bottom padding for composer */}
          <div className="h-4"/>
        </div>
      </div>

      {/* ── EMOJI PICKER ── */}
      <AnimatePresence>
        {showEmojis && (
          <motion.div initial={{ y:100, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:100, opacity:0 }}
            transition={{ type:"spring", stiffness:340, damping:28 }}
            style={{ background:"rgba(255,255,255,0.95)", backdropFilter:"blur(24px)", borderTop:"1px solid rgba(255,255,255,0.85)" }}>
            <div className="mx-auto grid max-w-md grid-cols-8 gap-1 p-3">
              {EMOJIS.map(e => (
                <button key={e} type="button" onClick={() => { setDraft(d => d+e); textareaRef.current?.focus(); }}
                  className="rounded-xl p-2 text-2xl transition hover:bg-primary/10 active:scale-90">
                  {e}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── COMPOSER ── */}
      <div className="shrink-0"
        style={{ background:"rgba(255,255,255,0.92)", backdropFilter:"blur(24px)", borderTop:"1px solid rgba(255,255,255,0.85)", paddingBottom:"env(safe-area-inset-bottom)", boxShadow:"0 -4px 20px oklch(0.60 0.16 0 / 0.06)" }}>

        {/* Image preview */}
        {imagePreview && (
          <div className="mx-auto max-w-md px-4 pt-3">
            <div className="relative inline-block overflow-hidden rounded-2xl border-2 border-white shadow-md">
              <img src={imagePreview} alt="" className="block h-24 w-24 object-cover"/>
              <button onClick={() => { if(imagePreview) URL.revokeObjectURL(imagePreview); setPendingImage(null); setImagePreview(null); }}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-white"
                style={{ background:"rgba(0,0,0,0.55)", backdropFilter:"blur(4px)" }}>
                <X className="h-3.5 w-3.5"/>
              </button>
            </div>
          </div>
        )}

        <div className="mx-auto flex max-w-md items-end gap-2 px-3 py-3">
          {/* Image button */}
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition active:scale-90"
            style={{ background:"linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))", color:"oklch(0.42 0.10 358)" }}>
            <ImagePlus className="h-5 w-5"/>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={e => { pickImage(e.target.files?.[0] || null); e.target.value=""; }}/>

          {/* Emoji button */}
          <button type="button" onClick={() => setShowEmojis(v => !v)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition active:scale-90"
            style={showEmojis
              ? { background:"linear-gradient(135deg,#e88aab,#c45c7c)", color:"white", boxShadow:"0 4px 14px oklch(0.60 0.16 0 / 0.28)" }
              : { background:"linear-gradient(145deg,oklch(0.95 0.042 352),oklch(0.88 0.072 358))", color:"oklch(0.42 0.10 358)" }}>
            <Smile className="h-5 w-5"/>
          </button>

          {/* Textarea bubble */}
          <div className="flex flex-1 items-end rounded-[22px] px-4 py-2.5"
            style={{ background:"rgba(255,255,255,0.85)", border:"1.5px solid oklch(0.88 0.05 355 / 0.6)", boxShadow:"inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 8px oklch(0.75 0.13 355 / 0.08)" }}>
            <textarea ref={textareaRef} rows={1} value={draft}
              onChange={e => { setDraft(e.target.value); broadcastTyping(); }}
              onKeyDown={e => { if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); void send(); } }}
              placeholder={`Écris à ${partnerName}…`}
              className="max-h-[140px] min-h-[22px] w-full resize-none bg-transparent text-[15px] leading-snug outline-none placeholder:text-muted-foreground/50"
              style={{ color:"oklch(0.22 0.06 358)" }}/>
          </div>

          {/* Send button */}
          <button type="button" onClick={() => void send()} disabled={sending || (!draft.trim() && !pendingImage)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white transition active:scale-90 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow: (sending || (!draft.trim() && !pendingImage)) ? "none" : "0 6px 18px oklch(0.60 0.16 0 / 0.32)" }}>
            {sending ? <Loader2 className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5"/>}
          </button>
        </div>
      </div>

    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
