import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Music, Pause } from "lucide-react";
import song from "@/assets/notre-chanson.mp3.asset.json";

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const a = new Audio(song.url);
    a.loop = true;
    a.volume = 0.45;
    audioRef.current = a;
    return () => {
      a.pause();
      audioRef.current = null;
    };
  }, []);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      try {
        await a.play();
        setPlaying(true);
      } catch {
        /* ignored */
      }
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={{ scale: 0.92 }}
      onClick={toggle}
      aria-label={playing ? "Mettre en pause notre chanson" : "Jouer notre chanson"}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-2 text-blossom-deep shadow-[0_10px_30px_-10px_rgba(196,92,124,0.45)] backdrop-blur-xl"
    >
      <span className="relative flex h-6 w-6 items-center justify-center">
        {playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Music className="h-4 w-4" />
        )}
        {playing && (
          <motion.span
            className="absolute inset-0 rounded-full border border-blossom-rose/60"
            animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
        )}
      </span>
      <span className="font-serif text-sm italic leading-none">
        {playing ? "notre chanson…" : "notre chanson"}
      </span>
    </motion.button>
  );
}
