import { useMemo } from "react";

export type AvatarOptions = {
  seed?: string;
  backgroundColor?: string; // hex without '#', comma list ok
  flip?: boolean;
  radius?: number; // 0..50
  /** Extra DiceBear style options (e.g. hair, hairColor, eyes, skinColor). */
  extras?: Record<string, string>;
};

export const AVATAR_STYLES = [
  { id: "custom-cute", label: "IA" },
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

const RESERVED_KEYS = new Set(["seed", "backgroundColor", "backgroundType", "flip", "radius"]);

function safeHex(value: string | undefined, fallback: string) {
  const v = (value || "").replace(/^#/, "").toLowerCase();
  return /^[0-9a-f]{6}$/.test(v) ? `#${v}` : fallback;
}

function buildCustomCuteAvatarUrl(options: AvatarOptions = {}) {
  const extras = options.extras || {};
  const bg = options.backgroundColor === "transparent" ? "transparent" : safeHex(options.backgroundColor, "#f8c8d8");
  const skin = safeHex(extras.skinColor, "#ffdbb4");
  const hair = safeHex(extras.hairColor, "#724133");
  const eyes = safeHex(extras.eyesColor, "#2c1b18");
  const shirt = safeHex(extras.shirtColor, "#ffafb9");
  const longHair = extras.hairLength === "long";
  const curly = extras.hairTexture === "curly";
  const glasses = extras.glasses === "true";
  const beard = extras.beard === "true";
  const freckles = extras.freckles === "true";
  const smile = extras.mouth !== "sad";
  const radius = typeof options.radius === "number" ? options.radius : 50;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect width="256" height="256" rx="${radius * 2.2}" fill="${bg}"/>
    <ellipse cx="128" cy="224" rx="62" ry="38" fill="${shirt}"/>
    ${longHair ? `<ellipse cx="128" cy="107" rx="70" ry="82" fill="${hair}"/>` : ""}
    <circle cx="128" cy="112" r="58" fill="${skin}"/>
    ${longHair ? `<path d="M70 116c6-51 30-78 61-78 35 0 56 29 58 78-18-22-44-32-75-32-18 0-32 9-44 32Z" fill="${hair}"/>` : `<path d="M72 102c7-42 35-66 67-60 27 5 44 25 47 60-26-20-75-25-114 0Z" fill="${hair}"/>`}
    ${curly ? `<g fill="${hair}"><circle cx="78" cy="82" r="15"/><circle cx="100" cy="58" r="16"/><circle cx="128" cy="50" r="17"/><circle cx="156" cy="58" r="16"/><circle cx="179" cy="84" r="15"/></g>` : ""}
    <circle cx="106" cy="117" r="7" fill="${eyes}"/><circle cx="150" cy="117" r="7" fill="${eyes}"/>
    <circle cx="108" cy="115" r="2.4" fill="#fff"/><circle cx="152" cy="115" r="2.4" fill="#fff"/>
    ${glasses ? `<g fill="none" stroke="#8a4f63" stroke-width="5" stroke-linecap="round"><circle cx="106" cy="118" r="17"/><circle cx="150" cy="118" r="17"/><path d="M123 118h10"/></g>` : ""}
    <ellipse cx="94" cy="142" rx="12" ry="7" fill="#f59797" opacity=".45"/><ellipse cx="162" cy="142" rx="12" ry="7" fill="#f59797" opacity=".45"/>
    ${freckles ? `<g fill="#b58143" opacity=".65"><circle cx="96" cy="132" r="2"/><circle cx="108" cy="137" r="2"/><circle cx="148" cy="137" r="2"/><circle cx="160" cy="132" r="2"/></g>` : ""}
    ${beard ? `<path d="M100 148c8 24 48 24 56 0 4 31-12 49-28 49s-32-18-28-49Z" fill="${hair}" opacity=".85"/>` : ""}
    <path d="${smile ? "M108 153c10 14 30 14 40 0" : "M110 164c10-10 26-10 36 0"}" fill="none" stroke="#8a4f63" stroke-width="5" stroke-linecap="round"/>
    ${extras.earrings === "true" ? `<circle cx="72" cy="130" r="5" fill="#e88aab"/><circle cx="184" cy="130" r="5" fill="#e88aab"/>` : ""}
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function buildAvatarUrl(style: string, options: AvatarOptions = {}) {
  if (style === "custom-cute") return buildCustomCuteAvatarUrl(options);
  const params = new URLSearchParams();
  params.set("seed", options.seed?.trim() || "Amour");
  if (options.backgroundColor) {
    params.set("backgroundColor", options.backgroundColor === "transparent" ? "transparent" : options.backgroundColor);
  }
  if (options.flip) params.set("flip", "true");
  if (typeof options.radius === "number") params.set("radius", String(options.radius));
  if (options.extras) {
    for (const [k, v] of Object.entries(options.extras)) {
      if (!k || RESERVED_KEYS.has(k)) continue;
      if (v == null || v === "") continue;
      if (!/^[a-zA-Z][a-zA-Z0-9]{0,30}$/.test(k)) continue;
      const safe = String(v).replace(/[^a-zA-Z0-9,]/g, "").slice(0, 200);
      if (!safe) continue;
      params.set(k, safe);
    }
  }
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
