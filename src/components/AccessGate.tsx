import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Heart, Lock } from "lucide-react";

const KEY = "princesse-access-ok";
const CODE = "2233";

export function AccessGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(false);
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY) === "1") setOk(true);
    setReady(true);
  }, []);

  if (!ready) return null;
  if (ok) return <>{children}</>;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() === CODE) {
      localStorage.setItem(KEY, "1");
      setOk(true);
    } else {
      setError(true);
      setInput("");
      setTimeout(() => setError(false), 600);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center px-6"
      style={{ background: "linear-gradient(160deg,oklch(0.97 0.018 352) 0%,oklch(0.99 0.006 355) 50%,oklch(0.97 0.015 15) 100%)" }}>
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm rounded-[32px] p-8 text-center"
        style={{
          background: "rgba(255,255,255,0.78)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.85)",
          boxShadow: "0 20px 56px oklch(0.60 0.16 0/0.18), inset 0 1.5px 0 rgba(255,255,255,0.9)",
        }}>
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow: "0 8px 24px oklch(0.60 0.16 0/0.30)" }}>
          <Lock className="h-6 w-6 text-white" />
        </motion.div>
        <h1 className="font-serif text-3xl leading-none" style={{ color: "oklch(0.30 0.10 358)" }}>
          Notre nid privé
        </h1>
        <p className="mt-2 text-sm" style={{ color: "oklch(0.55 0.08 358)" }}>
          Entre notre petit code pour entrer 💕
        </p>

        <motion.input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          inputMode="numeric"
          autoFocus
          placeholder="••••"
          maxLength={8}
          animate={error ? { x: [0, -8, 8, -6, 6, 0] } : {}}
          transition={{ duration: 0.45 }}
          className="mt-6 h-14 w-full rounded-2xl px-4 text-center text-2xl tracking-[0.5em] font-bold outline-none"
          style={{
            background: "rgba(255,255,255,0.85)",
            border: error ? "1.5px solid #ef4444" : "1.5px solid rgba(255,255,255,0.9)",
            color: "oklch(0.30 0.10 358)",
          }}
        />

        <button type="submit"
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold text-white transition active:scale-[0.97]"
          style={{ background: "linear-gradient(135deg,#e88aab,#c45c7c)", boxShadow: "0 8px 24px oklch(0.60 0.16 0/0.30)" }}>
          <Heart className="h-4 w-4 fill-white" /> Entrer
        </button>
      </motion.form>
    </div>
  );
}
