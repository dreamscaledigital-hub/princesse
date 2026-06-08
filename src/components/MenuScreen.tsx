import { motion } from "framer-motion";
import { Copy, Heart, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MENU_TITLE, MENU_SUBTITLE, MODES, type ModeId } from "@/lib/game-content";
import { DateCountdown } from "@/components/DateCountdown";
import { AmbianceSelector } from "@/components/AmbianceSelector";
import type { Player, Room } from "@/lib/use-room-state";


type Props = {
  room: Room;
  players: Player[];
  mySlot: number;
  onPick: (mode: ModeId) => void;
};

export function MenuScreen({ room, players, mySlot, onPick }: Props) {
  const me = players.find((p) => p.slot === mySlot);
  const other = players.find((p) => p.slot !== mySlot);
  const bothHere = players.length === 2;
  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/?room=${room.code}` : "";

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Tu me connais ? 💕", url: inviteUrl });
        return;
      } catch {
        /* fallthrough */
      }
    }
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Lien copié ✨");
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[10px] uppercase tracking-[0.35em] text-primary/70"
        >
          ✦ pour nous deux ✦
        </motion.p>
        <motion.h1
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mt-2 font-serif text-5xl leading-[0.95] text-primary"
        >
          {MENU_TITLE.split(" ").map((w, i, arr) => (
            <span key={i} className={i === arr.length - 1 ? "italic text-blossom-rose" : ""}>
              {w}{i < arr.length - 1 ? " " : ""}
            </span>
          ))}
        </motion.h1>
        <div className="mx-auto mt-3 h-px w-12 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <p className="mt-3 text-sm text-muted-foreground text-balance px-6">{MENU_SUBTITLE}</p>
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-white/60 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
          <Heart className="h-3 w-3 fill-primary" />
          {me?.name ?? "Toi"} &amp; {other?.name ?? "ton amour"} {bothHere ? "· en ligne" : "· en attente"}
        </p>
      </div>

      <DateCountdown roomId={room.id} nextDateAt={room.next_date_at} />

      <AmbianceSelector roomId={room.id} ambiance={room.ambiance} />

      <div className="mt-5 grid grid-cols-2 gap-3">


        {MODES.map((m, i) => (
          <motion.button
            key={m.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -2 }}
            disabled={!bothHere}
            onClick={() => onPick(m.id)}
            className="group relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/70 bg-white/55 p-3 text-center shadow-[0_10px_30px_-15px_rgba(196,92,124,0.35)] backdrop-blur-xl transition disabled:opacity-50"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-25 transition group-hover:opacity-40`} />
            <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/40 blur-2xl" />
            <span className="relative text-4xl drop-shadow-sm">{m.emoji}</span>
            <p className="relative mt-2 font-serif text-xl leading-tight text-blossom-deep">
              {m.title}
            </p>
            <p className="relative mt-1 text-[10px] font-medium uppercase tracking-wider text-foreground/60 line-clamp-2">
              {m.subtitle}
            </p>
          </motion.button>
        ))}
      </div>


      {!bothHere && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          On attend que ton amour rejoigne avant de jouer 🥹
        </p>
      )}

      <div className="mt-auto pt-6">
        <div className="rounded-2xl bg-card/70 p-3 backdrop-blur">
          <p className="text-center text-[10px] uppercase tracking-wider text-muted-foreground">
            Code de la partie
          </p>
          <p className="text-center font-mono text-lg font-bold tracking-[0.4em] text-primary">
            {room.code}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" className="flex-1" onClick={share}>
              <Share2 className="mr-1.5 h-3.5 w-3.5" /> Inviter
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl);
                toast.success("Copié 💖");
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copier
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
