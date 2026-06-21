import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

// ── Audio ──────────────────────────────────────────────────────────────────
function playLoveSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    // E major arpeggio: E4 G#4 B4 E5
    const notes = [329.63, 415.30, 493.88, 659.26];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.11;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.13, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      osc.start(t);
      osc.stop(t + 1.6);
    });
  } catch {
    // AudioContext can be blocked — ignore
  }
}

// ── Variants ───────────────────────────────────────────────────────────────
const VARIANTS = [
  { emoji: "❤️",  text: "Je t'aime",      sub: "tellement fort",    glow: "oklch(0.55 0.28 10)" },
  { emoji: "😘",  text: "Bisou !",         sub: "je pense à toi",    glow: "oklch(0.50 0.25 350)" },
  { emoji: "🫶",  text: "Tu me manques",   sub: "viens vite",        glow: "oklch(0.45 0.20 320)" },
  { emoji: "✨",  text: "T'es incroyable", sub: "j'ai trop de chance", glow: "oklch(0.55 0.22 40)" },
] as const;

export type LoveBombPayload = {
  sender_name: string;
  variant: number;
};

// ── Overlay UI ─────────────────────────────────────────────────────────────
function LoveBombOverlayUI({ payload, onDismiss }: { payload: LoveBombPayload; onDismiss: () => void }) {
  const v = VARIANTS[payload.variant % VARIANTS.length] ?? VARIANTS[0];

  const hearts = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: 3 + Math.random() * 94,
        delay: Math.random() * 3.5,
        size: 14 + Math.random() * 22,
        duration: 2.8 + Math.random() * 2,
      })),
    [],
  );

  return (
    <motion.div
      key="love-bomb"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: "6%", scale: 0.96 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={onDismiss}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background:
          "radial-gradient(ellipse 90% 70% at 50% 45%, oklch(0.28 0.15 355) 0%, oklch(0.09 0.06 260) 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        cursor: "pointer",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    >
      {/* Floating hearts background */}
      {hearts.map((h) => (
        <motion.div
          key={h.id}
          initial={{ y: "110vh", opacity: 0 }}
          animate={{ y: "-25vh", opacity: [0, 0.65, 0.65, 0] }}
          transition={{
            delay: h.delay,
            duration: h.duration,
            repeat: Infinity,
            repeatDelay: 0.4,
            ease: "easeOut",
          }}
          style={{
            position: "absolute",
            left: `${h.x}%`,
            fontSize: h.size,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {v.emoji}
        </motion.div>
      ))}

      {/* Main content */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "0 24px" }}>
        {/* Glow ring behind emoji */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 240,
            height: 240,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${v.glow}55 0%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        {/* Emoji — heartbeat pulse */}
        <motion.div
          animate={{ scale: [1, 1.12, 1, 1.07, 1] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut", delay: 0.5 }}
          style={{
            fontSize: 88,
            lineHeight: 1,
            filter: `drop-shadow(0 0 24px ${v.glow})`,
          }}
        >
          {v.emoji}
        </motion.div>

        {/* Main text */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 12 }}
          style={{
            fontFamily: "Cormorant Garamond, Georgia, serif",
            fontSize: "clamp(44px, 12vw, 68px)",
            fontWeight: 700,
            fontStyle: "italic",
            color: "white",
            lineHeight: 1.1,
            marginTop: 18,
            textShadow: `0 4px 32px ${v.glow}88, 0 0 60px ${v.glow}44`,
          }}
        >
          {v.text}
        </motion.div>

        {/* Sub text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.75, y: 0 }}
          transition={{ delay: 0.45 }}
          style={{
            fontSize: 17,
            color: "white",
            marginTop: 8,
            letterSpacing: "0.06em",
            fontStyle: "italic",
          }}
        >
          {v.sub}
        </motion.div>

        {/* Sender */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          style={{
            marginTop: 22,
            fontSize: 14,
            color: "oklch(0.82 0.10 355)",
            letterSpacing: "0.08em",
          }}
        >
          De {payload.sender_name} 💕
        </motion.div>
      </div>

      {/* Dismiss hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.35 }}
        transition={{ delay: 2.2 }}
        style={{
          position: "absolute",
          bottom: 36,
          fontSize: 12,
          color: "white",
          letterSpacing: "0.05em",
        }}
      >
        Appuie pour fermer
      </motion.p>
    </motion.div>
  );
}

// ── Receiver (auto-subscribes, lives in __root) ────────────────────────────
export function LoveBombReceiver() {
  const [active, setActive] = useState<LoveBombPayload | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function subscribe(uid: string) {
      const { data: coupleId } = await supabase.rpc("couple_for_user", { _uid: uid });
      if (!coupleId || cancelled) return;

      if (channelRef.current) supabase.removeChannel(channelRef.current);

      const ch = supabase.channel(`love-bomb-${coupleId}`, {
        config: { broadcast: { self: false } },
      });
      ch.on(
        "broadcast",
        { event: "love_bomb" },
        ({ payload }: { payload: LoveBombPayload }) => {
          setActive(payload);
          playLoveSound();
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setActive(null), 5000);
        },
      );
      ch.subscribe();
      channelRef.current = ch;
    }

    // Initial load
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && !cancelled) void subscribe(user.id);
    });

    // Re-subscribe on auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        void subscribe(session.user.id);
      }
      if (event === "SIGNED_OUT") {
        if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {active && (
        <LoveBombOverlayUI
          payload={active}
          onDismiss={() => setActive(null)}
        />
      )}
    </AnimatePresence>
  );
}
