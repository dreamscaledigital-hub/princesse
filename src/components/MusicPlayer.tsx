import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Pause, SkipForward } from "lucide-react";
import song1 from "@/assets/notre-chanson.mp3.asset.json";
import song2 from "@/assets/velvet-tea-window.mp3.asset.json";

const PLAYLIST = [
  { url: song1.url, title: "notre chanson" },
  { url: song2.url, title: "velvet tea window" },
];

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const a = new Audio(PLAYLIST[0].url);
    a.volume = 0.45;
    audioRef.current = a;

    const onEnded = () => {
      setIndex((i) => (i + 1) % PLAYLIST.length);
    };
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("ended", onEnded);
      a.pause();
      audioRef.current = null;
    };
  }, []);

  // Quand on change de morceau, charge et joue si on était en lecture
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const wasPlaying = playing;
    a.src = PLAYLIST[index].url;
    a.load();
    if (wasPlaying) {
      a.play().catch(() => setPlaying(false));
    }
  }, [index]);

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

  const next = () => {
    setIndex((i) => (i + 1) % PLAYLIST.length);
  };

  const current = PLAYLIST[index];

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-white/70 bg-white/70 px-2 py-1.5 text-blossom-deep shadow-[0_10px_30px_-10px_rgba(196,92,124,0.45)] backdrop-blur-xl">
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.92 }}
        onClick={toggle}
        aria-label={playing ? `Pause ${current.title}` : `Jouer ${current.title}`}
        className="flex items-center gap-2 rounded-full px-2 py-1"
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
        <AnimatePresence mode="wait">
          <motion.span
            key={current.title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="font-serif text-sm italic leading-none"
          >
            {playing ? `${current.title}…` : current.title}
          </motion.span>
        </AnimatePresence>
      </motion.button>
      <button
        onClick={next}
        aria-label="Chanson suivante"
        className="flex h-7 w-7 items-center justify-center rounded-full text-blossom-deep/70 transition hover:bg-blossom-rose/15 hover:text-blossom-deep"
      >
        <SkipForward className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
