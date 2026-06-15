import { createServerFn } from "@tanstack/react-start";

type Input = { prompt: string };

const STYLES = [
  "lorelei", "adventurer", "big-smile", "fun-emoji", "micah",
  "notionists", "open-peeps", "personas", "avataaars", "miniavs",
];

const BG_NAMES: Record<string, string> = {
  rose: "f8c8d8",
  pêche: "ffd6a5",
  jaune: "fde68a",
  vert: "bbf7d0",
  sauge: "bbf7d0",
  bleu: "bae6fd",
  ciel: "bae6fd",
  lilas: "ddd6fe",
  violet: "ddd6fe",
  bonbon: "fbcfe8",
  blush: "fecaca",
  crème: "fef0f5",
  voile: "fef0f5",
};

const SYSTEM = `Tu aides à créer un avatar DiceBear pour une appli de couple romantique. À partir d'une description en français, choisis le STYLE le plus adapté, une GRAINE (seed) cohérente (1-3 mots, peut inclure un détail comme "Léo-brun"), une COULEUR DE FOND, et 2 options de présentation. La graine influence fortement l'apparence (visage/coiffure/peau via le hash). Pour mieux refléter la description, intègre les traits clés dans la graine (ex. "fille-blonde-yeux-bleus", "garçon-roux"). Réponds UNIQUEMENT en JSON valide.

Styles disponibles (choisis le plus pertinent) :
- "lorelei" : illustré doux, féminin, mignon
- "adventurer" : cartoon style aventurier, varié
- "big-smile" : très souriant, joyeux, coloré
- "fun-emoji" : emoji rond drôle, abstrait
- "micah" : minimaliste plat, chic
- "notionists" : style Notion, sobre élégant
- "open-peeps" : illustration dessinée à main levée
- "personas" : moderne géométrique
- "avataaars" : cartoon classique très personnalisable
- "miniavs" : mini personnages mignons et stylisés

Couleurs de fond (hex sans #) : transparent, fef0f5 (voile), f8c8d8 (rose), ffd6a5 (pêche), fde68a (jaune), bbf7d0 (sauge), bae6fd (ciel), ddd6fe (lilas), fbcfe8 (bonbon), fecaca (blush).`;

const SCHEMA_HINT = `{"style":"lorelei","seed":"fille-brune-yeux-verts","backgroundColor":"f8c8d8","flip":false,"radius":50}`;

type AvatarResult = {
  style: string;
  seed: string;
  backgroundColor: string; // hex without #, or "transparent"
  flip: boolean;
  radius: number; // 0 | 20 | 50
};

function normalize(raw: unknown): AvatarResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const style = typeof o.style === "string" && STYLES.includes(o.style) ? o.style : "lorelei";
  const seed = typeof o.seed === "string" && o.seed.trim() ? o.seed.trim().slice(0, 40) : "Amour";
  let bg = typeof o.backgroundColor === "string" ? o.backgroundColor.trim().toLowerCase().replace(/^#/, "") : "f8c8d8";
  if (BG_NAMES[bg]) bg = BG_NAMES[bg];
  if (bg !== "transparent" && !/^[0-9a-f]{6}$/.test(bg)) bg = "f8c8d8";
  const flip = !!o.flip;
  const r = typeof o.radius === "number" ? o.radius : 50;
  const radius = [0, 20, 50].includes(r) ? r : (r > 35 ? 50 : r > 10 ? 20 : 0);
  return { style, seed, backgroundColor: bg, flip, radius };
}

export const generateAvatarFromPrompt = createServerFn({ method: "POST" })
  .inputValidator((d: Input) => ({ prompt: String(d.prompt || "").slice(0, 300) }))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false as const, error: "LOVABLE_API_KEY missing" };
    if (!data.prompt.trim()) return { ok: false as const, error: "empty_prompt" };

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `Description : ${data.prompt}\n\nFormat JSON attendu :\n${SCHEMA_HINT}` },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!resp.ok) {
        if (resp.status === 429) return { ok: false as const, error: "rate_limit" };
        if (resp.status === 402) return { ok: false as const, error: "credits" };
        return { ok: false as const, error: `gateway_${resp.status}` };
      }
      const json = await resp.json();
      const content: string = json?.choices?.[0]?.message?.content ?? "";
      let parsed: unknown;
      try { parsed = JSON.parse(content); }
      catch {
        const m = content.match(/\{[\s\S]*\}/);
        if (!m) return { ok: false as const, error: "invalid_json" };
        parsed = JSON.parse(m[0]);
      }
      const result = normalize(parsed);
      if (!result) return { ok: false as const, error: "invalid_shape" };
      return { ok: true as const, result };
    } catch (e) {
      console.error("avatar AI failed", e);
      return { ok: false as const, error: "network" };
    }
  });
