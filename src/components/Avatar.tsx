import { useMemo } from "react";

export type AvatarOptions = {
  seed?: string;
  backgroundColor?: string; // hex without '#', comma list ok
  flip?: boolean;
  radius?: number; // 0..50
};

export const AVATAR_STYLES = [
  { id: "lorelei", label: "Lorelei" },
  { id: "adventurer", label: "Aventure" },
  { id: "big-smile", label: "Sourire" },
  { id: "fun-emoji", label: "Emoji" },
  { id: "micah", label: "Micah" },
  { id: "notionists", label: "Notion" },
  { id: "open-peeps", label: "Peeps" },
  { id: "personas", label: "Personas" },
  { id: "avataaars", label: "Avataaars" },
  { id: "miniavs", label: "Mini" },
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number]["id"];

export const BG_PALETTE = [
  "transparent",
  "fef0f5", // veil
  "f8c8d8", // pale
  "ffd6a5", // peach
  "fde68a", // soft yellow
  "bbf7d0", // sage
  "bae6fd", // sky
  "ddd6fe", // lilac
  "fbcfe8", // candy pink
  "fecaca", // blush
];

export const SEED_PRESETS = [
  "Amour", "Câlin", "Étoile", "Pétale", "Soleil",
  "Lune", "Miel", "Cerise", "Velours", "Nuage",
  "Confetti", "Cœur",
];

export function buildAvatarUrl(style: string, options: AvatarOptions = {}) {
  const params = new URLSearchParams();
  params.set("seed", options.seed?.trim() || "Amour");
  if (options.backgroundColor && options.backgroundColor !== "transparent") {
    params.set("backgroundColor", options.backgroundColor);
  } else {
    params.set("backgroundType", "solid");
  }
  if (options.flip) params.set("flip", "true");
  if (typeof options.radius === "number") params.set("radius", String(options.radius));
  return `https://api.dicebear.com/9.x/${encodeURIComponent(style)}/svg?${params.toString()}`;
}

export function randomAvatar(): { style: AvatarStyle; options: AvatarOptions } {
  const style = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)].id;
  const seed = SEED_PRESETS[Math.floor(Math.random() * SEED_PRESETS.length)] + "-" + Math.random().toString(36).slice(2, 6);
  const bg = BG_PALETTE[Math.floor(Math.random() * BG_PALETTE.length)];
  return { style, options: { seed, backgroundColor: bg, flip: Math.random() < 0.5, radius: [0, 20, 50][Math.floor(Math.random() * 3)] } };
}

type AvatarProps = {
  style?: string | null;
  options?: AvatarOptions | null;
  fallbackEmoji?: string | null;
  size?: number;
  className?: string;
  ring?: boolean;
};

export function Avatar({ style, options, fallbackEmoji, size = 48, className = "", ring = false }: AvatarProps) {
  const url = useMemo(
    () => (style ? buildAvatarUrl(style, options || {}) : null),
    [style, options],
  );
  const ringCls = ring ? "ring-2 ring-primary/40" : "";
  if (!url) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-full bg-primary/15 ${ringCls} ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.55 }}
      >
        {fallbackEmoji || "💕"}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt="avatar"
      width={size}
      height={size}
      className={`rounded-full bg-white/60 ${ringCls} ${className}`}
      style={{ width: size, height: size, objectFit: "cover" }}
      draggable={false}
    />
  );
}
