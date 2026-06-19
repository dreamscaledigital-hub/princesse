import { motion } from "framer-motion";
import { Copy, Heart, Share2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { MODES, type ModeId } from "@/lib/game-content";
import { DateCountdown } from "@/components/DateCountdown";
import { AmbianceSelector } from "@/components/AmbianceSelector";
import type { Player, Room } from "@/lib/use-room-state";

type Props = {
  room: Room;
  players: Player[];
  mySlot: number;
  onPick: (mode: ModeId) => void;
};

// ── Game catalogue organisation ───────────────────────────────────────────────
const FEATURED_IDS: ModeId[]  = ["full", "quiz"];
const TOGETHER_IDS: ModeId[]  = ["wouldyou", "mostlikely", "cupidon", "paysville"];
const DUELS_IDS: ModeId[]     = ["minigames", "p4", "mastermind", "hangman", "draw", "tap", "tower", "bounce", "riddles", "wheel"];
const PERSONAL_IDS: ModeId[]  = ["edit_secrets"];

// Rich gradient overrides per mode
const CARD_STYLE: Partial<Record<ModeId, { bg: string; shadow: string; accent: string }>> = {
  full:        { bg: "linear-gradient(145deg,#fde68a,#f97316,#e88aab)", shadow: "0 12px 36px rgba(249,115,22,0.28)", accent: "#f97316" },
  quiz:        { bg: "linear-gradient(145deg,#fbcfe8,#e88aab,#c45c7c)", shadow: "0 12px 36px rgba(196,92,124,0.28)", accent: "#e88aab" },
  wouldyou:    { bg: "linear-gradient(145deg,#f5d0fe,#d946ef,#a855f7)", shadow: "0 10px 28px rgba(168,85,247,0.25)", accent: "#d946ef" },
  mostlikely:  { bg: "linear-gradient(145deg,#e0e7ff,#6366f1,#4f46e5)", shadow: "0 10px 28px rgba(99,102,241,0.25)", accent: "#6366f1" },
  cupidon:     { bg: "linear-gradient(145deg,#fecaca,#ef4444,#be123c)", shadow: "0 10px 28px rgba(239,68,68,0.25)", accent: "#ef4444" },
  paysville:   { bg: "linear-gradient(145deg,#fed7aa,#f97316,#ea580c)", shadow: "0 10px 28px rgba(234,88,12,0.22)", accent: "#f97316" },
  minigames:   { bg: "linear-gradient(145deg,#bbf7d0,#22c55e,#15803d)", shadow: "0 8px 22px rgba(34,197,94,0.22)", accent: "#22c55e" },
  p4:          { bg: "linear-gradient(145deg,#fecaca,#dc2626,#9f1239)", shadow: "0 8px 22px rgba(220,38,38,0.22)", accent: "#dc2626" },
  mastermind:  { bg: "linear-gradient(145deg,#bae6fd,#0ea5e9,#0369a1)", shadow: "0 8px 22px rgba(14,165,233,0.22)", accent: "#0ea5e9" },
  hangman:     { bg: "linear-gradient(145deg,#fbcfe8,#ec4899,#be185d)", shadow: "0 8px 22px rgba(236,72,153,0.22)", accent: "#ec4899" },
  draw:        { bg: "linear-gradient(145deg,#e9d5ff,#a855f7,#7c3aed)", shadow: "0 8px 22px rgba(168,85,247,0.22)", accent: "#a855f7" },
  tap:         { bg: "linear-gradient(145deg,#fef08a,#eab308,#ca8a04)", shadow: "0 8px 22px rgba(234,179,8,0.22)", accent: "#eab308" },
  tower:       { bg: "linear-gradient(145deg,#bae6fd,#38bdf8,#0284c7)", shadow: "0 8px 22px rgba(56,189,248,0.22)", accent: "#38bdf8" },
  bounce:      { bg: "linear-gradient(145deg,#fbcfe8,#f9a8d4,#22d3ee)", shadow: "0 8px 22px rgba(34,211,238,0.22)", accent: "#22d3ee" },
  riddles:     { bg: "linear-gradient(145deg,#bbf7d0,#4ade80,#16a34a)", shadow: "0 8px 22px rgba(74,222,128,0.22)", accent: "#4ade80" },
  wheel:       { bg: "linear-gradient(145deg,#f5d0fe,#e879f9,#a21caf)", shadow: "0 8px 22px rgba(232,121,249,0.22)", accent: "#e879f9" },
  edit_secrets:{ bg: "linear-gradient(145deg,#e0e7ff,#818cf8,#4338ca)", shadow: "0 8px 22px rgba(129,140,248,0.22)", accent: "#818cf8" },
};

function modeById(id: ModeId) { return MODES.find(m => m.id === id)!; }

// ── Featured card (full width) ────────────────────────────────────────────────
function FeaturedCard({ id, disabled, onPick }: { id: ModeId; disabled: boolean; onPick: (id: ModeId) => void }) {
  const m = modeById(id);
  if (!m) return null;
  const s = CARD_STYLE[id];
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.97 }}
      disabled={disabled}
      onClick={() => onPick(id)}
      className="relative w-full overflow-hidden rounded-[24px] text-left transition disabled:opacity-50"
      style={{ background: s?.bg || m.gradient, boxShadow: s?.shadow || "0 10px 28px rgba(196,92,124,0.22)" }}>
      {/* Glass overlay */}
      <div className="absolute inset-0 rounded-[24px]" style={{ background: "linear-gradient(145deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04))" }}/>
      {/* Glow orb */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full" style={{ background: "rgba(255,255,255,0.20)", filter: "blur(20px)" }}/>
      <div className="relative flex items-center gap-4 px-5 py-5">
        <span className="text-4xl drop-shadow-sm">{m.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-2xl leading-tight text-white drop-shadow-sm">{m.title}</p>
          <p className="mt-0.5 text-xs font-medium text-white/75">{m.subtitle}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,0.22)", backdropFilter: "blur(8px)" }}>
          <span className="text-white text-base">→</span>
        </div>
      </div>
    </motion.button>
  );
}

// ── Together card (2-col medium) ──────────────────────────────────────────────
function TogetherCard({ id, disabled, onPick, delay = 0 }: { id: ModeId; disabled: boolean; onPick: (id: ModeId) => void; delay?: number }) {
  const m = modeById(id);
  if (!m) return null;
  const s = CARD_STYLE[id];
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      whileTap={{ scale: 0.96 }}
      disabled={disabled}
      onClick={() => onPick(id)}
      className="relative flex flex-col items-center justify-center overflow-hidden rounded-[22px] p-4 text-center transition disabled:opacity-50"
      style={{ background: s?.bg || m.gradient, boxShadow: s?.shadow || "0 8px 20px rgba(196,92,124,0.20)", minHeight: 120 }}>
      <div className="absolute inset-0 rounded-[22px]" style={{ background: "linear-gradient(145deg,rgba(255,255,255,0.16),rgba(255,255,255,0.03))" }}/>
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full" style={{ background: "rgba(255,255,255,0.18)", filter: "blur(16px)" }}/>
      <span className="relative text-3xl drop-shadow-sm">{m.emoji}</span>
      <p className="relative mt-2 font-serif text-lg leading-tight text-white drop-shadow-sm">{m.title}</p>
      <p className="relative mt-0.5 text-[10px] font-medium text-white/70 line-clamp-2">{m.subtitle}</p>
    </motion.button>
  );
}

// ── Duel compact card (3-col) ─────────────────────────────────────────────────
function DuelCard({ id, disabled, onPick, delay = 0 }: { id: ModeId; disabled: boolean; onPick: (id: ModeId) => void; delay?: number }) {
  const m = modeById(id);
  if (!m) return null;
  const s = CARD_STYLE[id];
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay }}
      whileTap={{ scale: 0.93 }}
      disabled={disabled}
      onClick={() => onPick(id)}
      className="relative flex flex-col items-center justify-center overflow-hidden rounded-[18px] py-3.5 px-2 text-center transition disabled:opacity-45"
      style={{ background: s?.bg || m.gradient, boxShadow: s?.shadow || "0 6px 16px rgba(0,0,0,0.12)", minHeight: 90 }}>
      <div className="absolute inset-0 rounded-[18px]" style={{ background: "linear-gradient(145deg,rgba(255,255,255,0.15),rgba(255,255,255,0.02))" }}/>
      <span className="relative text-2xl drop-shadow-sm">{m.emoji}</span>
      <p className="relative mt-1.5 text-[11px] font-bold leading-tight text-white drop-shadow-sm line-clamp-2 px-1">{m.title}</p>
    </motion.button>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children, emoji }: { children: React.ReactNode; emoji?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      {emoji && <span className="text-sm">{emoji}</span>}
      <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "oklch(0.58 0.08 358)" }}>{children}</p>
      <div className="h-px flex-1" style={{ background: "linear-gradient(to right,oklch(0.80 0.10 355/0.30),transparent)" }}/>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function MenuScreen({ room, players, mySlot, onPick }: Props) {
  const me    = players.find(p => p.slot === mySlot);
  const other = players.find(p => p.slot !== mySlot);
  const bothHere = players.length === 2;
  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/?room=${room.code}` : "";

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "Tu me connais ? 💕", url: inviteUrl }); return; } catch {}
    }
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Lien copié ✨");
  };

  return (
    <div className="flex flex-1 flex-col min-h-0">

      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-20 shrink-0 mx-auto w-full"
        style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,0.80)", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
        <div className="px-4 py-3">
          {/* Players row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)" }}>
                {(me?.name || "?")[0].toUpperCase()}
              </div>
              <span className="truncate text-sm font-semibold" style={{ color: "oklch(0.38 0.10 358)" }}>{me?.name || "Toi"}</span>
              <motion.div animate={{ scale: [1,1.2,1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                <Heart className="h-3.5 w-3.5 shrink-0 fill-primary text-primary"/>
              </motion.div>
              <span className="truncate text-sm font-semibold" style={{ color: "oklch(0.38 0.10 358)" }}>{other?.name || "…"}</span>
              {bothHere
                ? <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 6px #22c55e88" }}/>
                : <WifiOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50"/>}
            </div>
            {/* Room code + share */}
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-xs font-bold tracking-[0.18em]" style={{ color: "oklch(0.55 0.10 358)", background: "oklch(0.97 0.015 350)", borderRadius: 8, padding: "2px 8px", border: "1px solid oklch(0.88 0.05 355/0.5)" }}>
                {room.code}
              </span>
              <button onClick={share}
                className="flex h-8 w-8 items-center justify-center rounded-2xl transition active:scale-90"
                style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow: "0 3px 10px oklch(0.60 0.16 0/0.28)" }}>
                <Share2 className="h-3.5 w-3.5 text-white"/>
              </button>
              <button onClick={async () => { await navigator.clipboard.writeText(inviteUrl); toast.success("Copié 💖"); }}
                className="flex h-8 w-8 items-center justify-center rounded-2xl transition active:scale-90"
                style={{ background: "rgba(255,255,255,0.8)", border: "1px solid oklch(0.85 0.05 355/0.5)", color: "oklch(0.55 0.10 358)" }}>
                <Copy className="h-3.5 w-3.5"/>
              </button>
            </div>
          </div>
          {/* Waiting notice */}
          {!bothHere && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mt-1.5 text-center text-[11px]" style={{ color: "oklch(0.62 0.08 358)" }}>
              On attend que ton amour rejoigne… 🥹
            </motion.p>
          )}
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 px-4 pb-10 pt-5">

          {/* Ambiance + Date */}
          <div className="rounded-[22px] p-4 space-y-3"
            style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.82)", boxShadow: "0 6px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)" }}>
            <AmbianceSelector roomId={room.id} ambiance={room.ambiance}/>
            <DateCountdown roomId={room.id} nextDateAt={room.next_date_at}/>
          </div>

          {/* ── SECTION 1: À la une ── */}
          <div className="space-y-2.5">
            <SectionLabel emoji="🌟">À la une</SectionLabel>
            {FEATURED_IDS.map((id, i) => (
              <motion.div key={id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.07 }}>
                <FeaturedCard id={id} disabled={!bothHere} onPick={onPick}/>
              </motion.div>
            ))}
            {/* Roulette Coquine as featured */}
            <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: 0.14 }}>
              <Link to="/roulette-irl"
                className="relative block w-full overflow-hidden rounded-[24px] text-left transition active:scale-[0.97]"
                style={{ background: "linear-gradient(145deg,#fbcfe8,#f472b6,#db2777)", boxShadow: "0 12px 36px rgba(219,39,119,0.28)" }}>
                <div className="absolute inset-0" style={{ background: "linear-gradient(145deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04))" }}/>
                <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full" style={{ background: "rgba(255,255,255,0.20)", filter: "blur(20px)" }}/>
                <div className="relative flex items-center gap-4 px-5 py-5">
                  <span className="text-4xl drop-shadow-sm">🎰</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-2xl leading-tight text-white drop-shadow-sm">Roulette Coquine</p>
                    <p className="mt-0.5 text-xs font-medium text-white/75">5 catégories · défis · positions · complicité</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,0.22)", backdropFilter: "blur(8px)" }}>
                    <span className="text-white text-base">→</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>

          {/* ── SECTION 2: Moments à deux ── */}
          <div className="space-y-2.5">
            <SectionLabel emoji="💞">Moments à deux</SectionLabel>
            <div className="grid grid-cols-2 gap-2.5">
              {TOGETHER_IDS.map((id, i) => (
                <TogetherCard key={id} id={id} disabled={!bothHere} onPick={onPick} delay={i * 0.06}/>
              ))}
            </div>
          </div>

          {/* ── SECTION 3: Duels express ── */}
          <div className="space-y-2.5">
            <SectionLabel emoji="⚡">Duels express</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {DUELS_IDS.map((id, i) => (
                <DuelCard key={id} id={id} disabled={!bothHere} onPick={onPick} delay={i * 0.04}/>
              ))}
            </div>
          </div>

          {/* ── SECTION 4: Notre coin ── */}
          <div className="space-y-2.5">
            <SectionLabel emoji="✏️">Notre coin</SectionLabel>
            {PERSONAL_IDS.map((id, i) => (
              <motion.div key={id} initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.05 }}>
                <FeaturedCard id={id} disabled={false} onPick={onPick}/>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
