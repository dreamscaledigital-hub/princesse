import { motion } from "framer-motion";
import { Copy, Heart, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MENU_TITLE, MENU_SUBTITLE, MODES, type ModeId } from "@/lib/game-content";
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
        <motion.h1
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="font-script text-4xl text-primary"
        >
          {MENU_TITLE}
        </motion.h1>
        <p className="mt-1 text-sm text-muted-foreground">{MENU_SUBTITLE}</p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Heart className="h-3 w-3 fill-primary" />
          {me?.name ?? "Toi"} &amp; {other?.name ?? "ton amour"} {bothHere ? "💕 en ligne" : "💭 en attente"}
        </p>
      </div>

      <div className="mt-6 grid gap-3">
        {MODES.map((m, i) => (
          <motion.button
            key={m.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileTap={{ scale: 0.97 }}
            disabled={!bothHere}
            onClick={() => onPick(m.id)}
            className={`group relative overflow-hidden rounded-3xl border-2 border-white/60 bg-gradient-to-br ${m.gradient} p-5 text-left shadow-md backdrop-blur transition disabled:opacity-50`}
          >
            <div className="flex items-center gap-4">
              <span className="text-5xl drop-shadow-sm">{m.emoji}</span>
              <div className="flex-1">
                <p className="font-script text-2xl text-primary-foreground/90 drop-shadow-sm">
                  {m.title}
                </p>
                <p className="mt-0.5 text-xs font-medium text-foreground/80">{m.subtitle}</p>
              </div>
            </div>
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
