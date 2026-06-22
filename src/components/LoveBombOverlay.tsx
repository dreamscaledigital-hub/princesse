import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";

// ── Audio ──────────────────────────────────────────────────────────────────
function playLoveSound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [329.63, 415.3, 493.88, 659.26];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      osc.start(t);
      osc.stop(t + 1.7);
    });
  } catch {
    /* blocked — ignore */
  }
}

// ── Variants ───────────────────────────────────────────────────────────────
const VARIANTS = [
  { emoji: "❤️",  text: "Je t'aime",       sub: "tellement fort",      glow: "#e8365d" },
  { emoji: "😘",  text: "Bisou !",          sub: "je pense à toi",      glow: "#d6406e" },
  { emoji: "🫶",  text: "Tu me manques",    sub: "viens vite",          glow: "#b5337b" },
  { emoji: "✨",  text: "T'es incroyable",  sub: "j'ai trop de chance", glow: "#c4553a" },
] as const;

export type LoveBombPayload = { sender_name: string; variant: number };

// ── Overlay UI ─────────────────────────────────────────────────────────────
function LoveBombOverlayUI({
  payload,
  onDismiss,
}: {
  payload: LoveBombPayload;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const v = VARIANTS[payload.variant % VARIANTS.length] ?? VARIANTS[0];

  // Generate hearts once
  const hearts = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        x: 4 + (i / 18) * 92 + (Math.random() - 0.5) * 8,
        delay: (i / 18) * 3 + Math.random() * 0.8,
        size: 14 + Math.random() * 20,
        dur: 2.8 + Math.random() * 2,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payload.variant],
  );

  useEffect(() => {
    // Trigger entrance on next frame
    const raf = requestAnimationFrame(() => setVisible(true));
    // Auto-dismiss after 5.5 s
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 450);
    }, 5500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [onDismiss]);

  const overlay = (
    <div
      onClick={() => {
        setVisible(false);
        setTimeout(onDismiss, 450);
      }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2147483647, // max z-index
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.96)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
        background: `radial-gradient(ellipse 90% 70% at 50% 45%, #3d1030 0%, #0d0818 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        cursor: "pointer",
        WebkitUserSelect: "none",
        userSelect: "none",
        willChange: "opacity, transform",
      }}
    >
      {/* Glow background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 60% 50% at 50% 48%, ${v.glow}44 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Floating hearts */}
      {hearts.map((h) => (
        <div
          key={h.id}
          style={{
            position: "absolute",
            left: `${h.x}%`,
            bottom: "-10vh",
            fontSize: h.size,
            pointerEvents: "none",
            animation: `lovebomb-rise ${h.dur}s ease-out ${h.delay}s infinite`,
          }}
        >
          {v.emoji}
        </div>
      ))}

      {/* Main content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          padding: "0 28px",
          transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.85)",
          transition: "transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)",
          transitionDelay: "0.05s",
        }}
      >
        {/* Glow ring */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 260,
            height: 260,
            transform: "translate(-50%, -60%)",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${v.glow}55 0%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        {/* Emoji */}
        <div
          style={{
            fontSize: 90,
            lineHeight: 1,
            filter: `drop-shadow(0 0 28px ${v.glow})`,
            animation: "lovebomb-pulse 1.5s ease-in-out infinite",
          }}
        >
          {v.emoji}
        </div>

        {/* Main text */}
        <div
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: "clamp(44px, 12vw, 70px)",
            fontWeight: 700,
            fontStyle: "italic",
            color: "white",
            lineHeight: 1.1,
            marginTop: 16,
            textShadow: `0 4px 32px ${v.glow}aa, 0 0 60px ${v.glow}44`,
          }}
        >
          {v.text}
        </div>

        {/* Sub text */}
        <div
          style={{
            fontSize: 17,
            color: "rgba(255,255,255,0.72)",
            marginTop: 8,
            letterSpacing: "0.06em",
            fontStyle: "italic",
            transition: "opacity 0.5s ease",
            transitionDelay: "0.4s",
            opacity: visible ? 1 : 0,
          }}
        >
          {v.sub}
        </div>

        {/* Sender */}
        <div
          style={{
            marginTop: 24,
            fontSize: 14,
            color: "#e88aab",
            letterSpacing: "0.08em",
            transition: "opacity 0.5s ease",
            transitionDelay: "0.65s",
            opacity: visible ? 1 : 0,
          }}
        >
          De {payload.sender_name} 💕
        </div>
      </div>

      {/* Dismiss hint */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          fontSize: 12,
          color: "rgba(255,255,255,0.32)",
          letterSpacing: "0.05em",
          transition: "opacity 0.5s ease",
          transitionDelay: "2.5s",
          opacity: visible ? 1 : 0,
        }}
      >
        Appuie pour fermer
      </div>

      {/* CSS keyframes injected inline */}
      <style>{`
        @keyframes lovebomb-rise {
          0%   { transform: translateY(0) scale(1); opacity: 0; }
          10%  { opacity: 0.7; }
          80%  { opacity: 0.6; }
          100% { transform: translateY(-110vh) scale(0.8) rotate(15deg); opacity: 0; }
        }
        @keyframes lovebomb-pulse {
          0%, 100% { transform: scale(1); }
          45%       { transform: scale(1.12); }
          60%       { transform: scale(1.06); }
        }
      `}</style>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}

// ── Receiver ───────────────────────────────────────────────────────────────
export function LoveBombReceiver() {
  const [active, setActive] = useState<LoveBombPayload | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function subscribe(uid: string) {
      if (cancelled) return;

      const { data: coupleId } = await supabase.rpc("couple_for_user", { _uid: uid });
      if (!coupleId || cancelled) return;

      // Clean up previous channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const ch = supabase.channel(`love-bomb-${coupleId}`, {
        config: { broadcast: { self: false, ack: false } },
      });

      ch.on("broadcast", { event: "love_bomb" }, (msg: unknown) => {
        // Defensive extraction — handle both { payload } and raw payload shapes
        const raw = (msg ?? {}) as Record<string, unknown>;
        const extracted =
          (raw["payload"] as LoveBombPayload | undefined) ??
          (raw as unknown as LoveBombPayload);

        const payload: LoveBombPayload = {
          sender_name:
            typeof extracted?.sender_name === "string"
              ? extracted.sender_name
              : "Ton amour",
          variant:
            typeof extracted?.variant === "number" ? extracted.variant : 0,
        };

        // Play sound first (no state dep)
        playLoveSound();

        // Show overlay
        setActive(payload);

        // Auto-dismiss
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setActive(null), 6500);
      });

      ch.subscribe((status) => {
        if (status === "CHANNEL_ERROR" && !cancelled) {
          // Retry after 3 s
          setTimeout(() => { if (!cancelled) void subscribe(uid); }, 3000);
        }
      });

      channelRef.current = ch;
    }

    // Initial auth check
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && !cancelled) void subscribe(user.id);
    });

    // Re-subscribe on auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
          session?.user
        ) {
          void subscribe(session.user.id);
        }
        if (event === "SIGNED_OUT") {
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }
        }
      },
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Always render the receiver — overlay is portal-based
  if (!active) return null;

  return (
    <LoveBombOverlayUI
      key={`${active.sender_name}-${Date.now()}`}
      payload={active}
      onDismiss={() => setActive(null)}
    />
  );
}
