// Moteur de sons pour les pensées — Web Audio API (pas de fichiers audio)

export type SoundId = "clochette" | "bulle" | "bise" | "harpe" | "silence";

export const SOUNDS: { id: SoundId; label: string; emoji: string }[] = [
  { id: "clochette", label: "Clochette", emoji: "🔔" },
  { id: "bulle",     label: "Bulle",     emoji: "🫧" },
  { id: "bise",      label: "Bise",      emoji: "💋" },
  { id: "harpe",     label: "Harpe",     emoji: "🎵" },
  { id: "silence",   label: "Silence",   emoji: "🔕" },
];

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx || ctx.state === "closed") {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// ── Sons individuels ────────────────────────────────────────────────────────

function playClochette() {
  const c = getCtx();
  const t = c.currentTime;
  // Ping aigu avec décroissance rapide
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1320, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.3);
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.8);
}

function playBulle() {
  const c = getCtx();
  const t = c.currentTime;
  // Glissando descendant rapide
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.18);
  gain.gain.setValueAtTime(0.4, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.25);
}

function playBise() {
  const c = getCtx();
  const t = c.currentTime;
  // Deux notes montantes douces — "mwah"
  for (const [offset, freq] of [[0, 440], [0.12, 523]] as [number, number][]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t + offset);
    gain.gain.setValueAtTime(0, t + offset);
    gain.gain.linearRampToValueAtTime(0.35, t + offset + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.25);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t + offset);
    osc.stop(t + offset + 0.3);
  }
}

function playHarpe() {
  const c = getCtx();
  const t = c.currentTime;
  // Arpège de 3 notes : Do Mi Sol
  for (const [i, freq] of [[0, 523.25], [1, 659.25], [2, 783.99]] as [number, number][]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t + i * 0.1);
    gain.gain.setValueAtTime(0.3, t + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.7);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t + i * 0.1);
    osc.stop(t + i * 0.1 + 0.75);
  }
}

// ── Export principal ────────────────────────────────────────────────────────

export function playSound(id: SoundId) {
  if (typeof window === "undefined" || !("AudioContext" in window || "webkitAudioContext" in window)) return;
  try {
    switch (id) {
      case "clochette": playClochette(); break;
      case "bulle":     playBulle();     break;
      case "bise":      playBise();      break;
      case "harpe":     playHarpe();     break;
      case "silence":   break;
    }
  } catch (e) {
    console.warn("pensee-sound:", e);
  }
}
