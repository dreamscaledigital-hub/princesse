import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Smile, ImagePlus, Heart, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { sendPensee } from "@/lib/push-client";
import { playSound, type SoundId } from "@/lib/pensee-sound";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Notre chat 💌 — Princesse" }] }),
  component: MessagesPage,
});

type Profile = {
  id: string;
  display_name: string;
  avatar_emoji: string;
  avatar_style?: string | null;
  avatar_options?: Record<string, unknown> | null;
};

type Reactions = Record<string, string[]>;

type Message = {
  id: string;
  couple_id: string;
  sender_id: string;
  body: string | null;
  image_path: string | null;
  reactions: Reactions;
  read_by: string[];
  created_at: string;
};

const EMOJIS = [
  "❤️", "😍", "😘", "🥰", "😂", "🥺", "😏", "😉",
  "🔥", "💋", "💕", "💖", "💗", "💞", "💓", "✨",
  "🌹", "🌸", "🥂", "🍷", "🍓", "🍑", "🎀", "💌",
  "👀", "🙈", "🤭", "😴", "🤍", "🌙", "⭐", "🦋",
];
const QUICK_REACTIONS = ["❤️", "😍", "😂", "🥺", "🔥", "💋"];

function MessagesPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Profile | null>(null);
  const [partner, setPartner] = useState<Profile | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentRef = useRef(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundRef = useRef<SoundId>("clochette");

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
      soundRef.current = ((meProf as { pensee_sound?: string })?.pensee_sound ?? "clochette") as SoundId;

      const { data: c } = await supabase
        .from("couples").select("*")
        .or(`user_a.eq.${uid},user_b.eq.${uid}`).maybeSingle();
      if (!c) { setLoading(false); return; }
      setCoupleId(c.id);

      const partnerId = c.user_a === uid ? c.user_b : c.user_a;
      const { data: pProf } = await supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle();
      if (cancelled) return;
      setPartner(pProf as Profile);

      const { data: msgs } = await supabase
        .from("messages").select("*")
        .eq("couple_id", c.id)
        .order("created_at", { ascending: true })
        .limit(500);
      if (cancelled) return;
      setMessages((msgs || []) as Message[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  // Realtime subscriptions
  useEffect(() => {
    if (!coupleId || !me) return;

    const msgChannel = supabase
      .channel(`messages-${coupleId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          // Jouer le son si c'est un message du partenaire (pas le mien)
          if (m.sender_id !== me?.id) playSound(soundRef.current);
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => x.id === m.id ? m : x));
        })
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const old = payload.old as { id: string };
          setMessages((prev) => prev.filter((x) => x.id !== old.id));
        })
      .subscribe();

    const typingChannel = supabase.channel(`typing-${coupleId}`, {
      config: { broadcast: { self: false } },
    });
    typingChannel
      .on("broadcast", { event: "typing" }, (payload) => {
        const senderId = (payload.payload as { sender: string }).sender;
        if (senderId === me.id) return;
        setPartnerTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 3000);
      })
      .subscribe();
    typingChannelRef.current = typingChannel;

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(typingChannel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [coupleId, me]);

  // Auto-scroll on new messages or typing
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [messages, partnerTyping]);

  // Mark unread messages as read
  useEffect(() => {
    if (!me || messages.length === 0) return;
    const unread = messages.filter(
      (m) => m.sender_id !== me.id && !(m.read_by || []).includes(me.id),
    );
    if (unread.length === 0) return;
    (async () => {
      for (const m of unread) {
        const next = Array.from(new Set([...(m.read_by || []), me.id]));
        await supabase.from("messages").update({ read_by: next }).eq("id", m.id);
      }
    })();
  }, [messages, me]);

  // Resolve signed URLs for images
  useEffect(() => {
    const missing = messages.filter((m) => m.image_path && !imageUrls[m.image_path]);
    if (missing.length === 0) return;
    (async () => {
      const updates: Record<string, string> = {};
      for (const m of missing) {
        const { data } = await supabase.storage
          .from("chat-photos")
          .createSignedUrl(m.image_path!, 60 * 60);
        if (data?.signedUrl) updates[m.image_path!] = data.signedUrl;
      }
      if (Object.keys(updates).length) setImageUrls((p) => ({ ...p, ...updates }));
    })();
  }, [messages, imageUrls]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [draft]);

  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current?.send({
      type: "broadcast", event: "typing",
      payload: { sender: me?.id },
    });
  }, [me]);

  const pickImage = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choisis une image"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image trop lourde (8 Mo max)"); return; }
    setPendingImage(file);
    setImagePreview(URL.createObjectURL(file));
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
        const { error: upErr } = await supabase.storage
          .from("chat-photos")
          .upload(path, pendingImage, { upsert: false, contentType: pendingImage.type });
        if (upErr) throw upErr;
        imagePath = path;
      }
      const { error } = await supabase.from("messages").insert({
        couple_id: coupleId,
        sender_id: me.id,
        body: text || null,
        image_path: imagePath,
        read_by: [me.id],
      });
      if (error) throw error;
      const preview = text
        ? (text.length > 80 ? text.slice(0, 77) + "…" : text)
        : (imagePath ? "📸 t'a envoyé une photo" : "💌 nouveau message");
      const myName = me.display_name || "ton amour";
      void sendPensee(`${myName} : ${preview}`).catch(() => {});
      setDraft("");
      setPendingImage(null);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      setShowEmojis(false);
      textareaRef.current?.focus();
    } catch (e) {
      toast.error((e as Error).message || "Impossible d'envoyer");
    } finally {
      setSending(false);
    }
  }

  async function toggleReaction(msg: Message, emoji: string) {
    if (!me) return;
    const reactions: Reactions = { ...(msg.reactions || {}) };
    const list = reactions[emoji] || [];
    reactions[emoji] = list.includes(me.id)
      ? list.filter((id) => id !== me.id)
      : [...list, me.id];
    if (reactions[emoji].length === 0) delete reactions[emoji];
    // optimistic
    setMessages((prev) => prev.map((x) => x.id === msg.id ? { ...x, reactions } : x));
    setReactingId(null);
    await supabase.from("messages").update({ reactions }).eq("id", msg.id);
  }

  const groups = useMemo(() => groupByDay(messages), [messages]);
  const partnerName = partner?.display_name || "ton amour";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!coupleId || !partner) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <Heart className="h-10 w-10 text-primary" />
        <h1 className="mt-4 font-serif text-3xl text-primary">Pas encore appairés</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pour discuter, vous devez d'abord vous appairer dans <i>Notre nid</i>.
        </p>
        <Link to="/hub" className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-md active:scale-95">
          Aller au nid 💞
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] flex-col bg-background">
      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b border-primary/10 bg-white/90 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/" className="rounded-full p-1.5 text-muted-foreground hover:bg-primary/5">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="rounded-full border-2 border-white bg-white/70 p-0.5 shadow-sm">
            <Avatar
              style={partner.avatar_style}
              options={(partner.avatar_options as never) || {}}
              fallbackEmoji={partner.avatar_emoji}
              size={40}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-lg leading-tight text-primary">{partnerName}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {partnerTyping ? <span className="italic">en train d'écrire…</span> : "à toi pour toujours 💕"}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-4 py-5">
          {messages.length === 0 && (
            <div className="mt-10 text-center">
              <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-3xl">
                💌
              </div>
              <p className="mt-4 font-serif text-xl text-primary">Votre conversation commence ici</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Envoie ton premier <i>mot doux</i> à {partnerName}.
              </p>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.day} className="mb-2">
              <div className="my-4 flex items-center justify-center">
                <span className="rounded-full bg-white/70 px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground shadow-sm backdrop-blur">
                  {group.day}
                </span>
              </div>
              <div className="space-y-1.5">
                {group.items.map((m, idx) => {
                  const mine = m.sender_id === me!.id;
                  const prev = group.items[idx - 1];
                  const stacked = prev && prev.sender_id === m.sender_id
                    && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000);
                  const reactionEntries = Object.entries(m.reactions || {}).filter(([, ids]) => ids.length > 0);
                  const seen = mine && (m.read_by || []).includes(partner.id);
                  return (
                    <div key={m.id} className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
                      {!mine && (
                        <div className={cn("h-7 w-7 shrink-0", stacked && "invisible")}>
                          <Avatar
                            style={partner.avatar_style}
                            options={(partner.avatar_options as never) || {}}
                            fallbackEmoji={partner.avatar_emoji}
                            size={28}
                          />
                        </div>
                      )}
                      <div className="relative max-w-[78%]">
                        <motion.button
                          type="button"
                          initial={{ opacity: 0, y: 6, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.18 }}
                          onContextMenu={(e) => { e.preventDefault(); setReactingId(reactingId === m.id ? null : m.id); }}
                          onDoubleClick={() => setReactingId(reactingId === m.id ? null : m.id)}
                          className={cn(
                            "block w-full text-left px-4 py-2.5 shadow-sm transition-all active:scale-[0.98]",
                            mine
                              ? "bg-primary text-primary-foreground rounded-3xl rounded-br-md"
                              : "bg-white/85 text-foreground rounded-3xl rounded-bl-md border border-primary/5",
                          )}
                        >
                          {m.image_path && (
                            <div className="-mx-2 -mt-1 mb-1.5 overflow-hidden rounded-2xl">
                              {imageUrls[m.image_path]
                                ? <img src={imageUrls[m.image_path]} alt="" className="block max-h-72 w-full object-cover" />
                                : <div className="flex h-40 w-full items-center justify-center bg-black/5"><Loader2 className="h-4 w-4 animate-spin" /></div>}
                            </div>
                          )}
                          {m.body && <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.body}</p>}
                        </motion.button>

                        {/* Reactions */}
                        {reactionEntries.length > 0 && (
                          <div className={cn("absolute -bottom-3 flex gap-1", mine ? "right-2" : "left-2")}>
                            {reactionEntries.map(([emoji, ids]) => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(m, emoji)}
                                className={cn(
                                  "flex items-center gap-0.5 rounded-full border bg-white px-1.5 py-0.5 text-[11px] shadow-sm transition active:scale-90",
                                  ids.includes(me!.id) ? "border-primary/40" : "border-transparent",
                                )}
                              >
                                <span>{emoji}</span>
                                {ids.length > 1 && <span className="text-muted-foreground">{ids.length}</span>}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Quick reactions */}
                        <AnimatePresence>
                          {reactingId === m.id && (
                            <motion.div
                              initial={{ opacity: 0, y: 8, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className={cn(
                                "absolute -top-12 z-10 flex gap-1 rounded-full border border-primary/10 bg-white p-1.5 shadow-lg",
                                mine ? "right-0" : "left-0",
                              )}
                            >
                              {QUICK_REACTIONS.map((e) => (
                                <button
                                  key={e}
                                  onClick={() => toggleReaction(m, e)}
                                  className="rounded-full p-1 text-lg transition hover:scale-125 active:scale-110"
                                >
                                  {e}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      {mine && <div className="w-1 shrink-0" />}
                    </div>
                  );
                })}
                {/* "vu" indicator on last own message */}
                {(() => {
                  const lastMine = [...group.items].reverse().find((m) => m.sender_id === me!.id);
                  if (!lastMine) return null;
                  const seen = (lastMine.read_by || []).includes(partner.id);
                  if (!seen) return null;
                  return (
                    <div className="mt-1 pr-1 text-right text-[10px] text-muted-foreground">vu ✓</div>
                  );
                })()}
              </div>
            </div>
          ))}

          {partnerTyping && (
            <div className="mt-2 flex items-end gap-2">
              <div className="h-7 w-7 shrink-0">
                <Avatar
                  style={partner.avatar_style}
                  options={(partner.avatar_options as never) || {}}
                  fallbackEmoji={partner.avatar_emoji}
                  size={28}
                />
              </div>
              <div className="rounded-3xl rounded-bl-md border border-primary/5 bg-white/85 px-4 py-3 shadow-sm">
                <TypingDots />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Emoji picker */}
      <AnimatePresence>
        {showEmojis && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="border-t border-primary/10 bg-white/95 backdrop-blur"
          >
            <div className="mx-auto grid max-w-md grid-cols-8 gap-1 p-3">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { setDraft((d) => d + e); textareaRef.current?.focus(); }}
                  className="rounded-xl p-2 text-2xl transition hover:bg-primary/10 active:scale-90"
                >
                  {e}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer */}
      <div
        className="border-t border-primary/10 bg-white/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {imagePreview && (
          <div className="mx-auto max-w-md px-3 pt-3">
            <div className="relative inline-block overflow-hidden rounded-2xl border border-primary/20 shadow-sm">
              <img src={imagePreview} alt="" className="block h-24 w-24 object-cover" />
              <button
                onClick={() => {
                  if (imagePreview) URL.revokeObjectURL(imagePreview);
                  setPendingImage(null); setImagePreview(null);
                }}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                aria-label="Retirer l'image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
        <div className="mx-auto flex max-w-md items-end gap-2 px-3 py-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition active:scale-90"
            aria-label="Envoyer une photo"
          >
            <ImagePlus className="h-5 w-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { pickImage(e.target.files?.[0] || null); e.target.value = ""; }}
          />
          <button
            type="button"
            onClick={() => setShowEmojis((v) => !v)}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-90",
              showEmojis ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
            )}
            aria-label="Emojis"
          >
            <Smile className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-end rounded-3xl border border-primary/15 bg-white/80 px-4 py-2 shadow-inner">
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); broadcastTyping(); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={`Écris à ${partnerName}…`}
              className="max-h-[140px] min-h-[24px] w-full resize-none bg-transparent text-[15px] leading-snug text-foreground outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || (!draft.trim() && !pendingImage)}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition active:scale-90",
              "disabled:opacity-40 disabled:shadow-none",
            )}
            aria-label="Envoyer"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-primary/60"
          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

function groupByDay(messages: Message[]) {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const groups: { day: string; items: Message[] }[] = [];
  for (const m of messages) {
    const d = new Date(m.created_at);
    const day = startOfDay(d);
    let label: string;
    if (day.getTime() === today.getTime()) label = "Aujourd'hui";
    else if (day.getTime() === yesterday.getTime()) label = "Hier";
    else label = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    const last = groups[groups.length - 1];
    if (last && last.day === label) last.items.push(m);
    else groups.push({ day: label, items: [m] });
  }
  return groups;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
