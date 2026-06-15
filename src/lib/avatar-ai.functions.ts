import { createServerFn } from "@tanstack/react-start";

type Input = { prompt: string };

const hairColors = {
  blond: "d6b370",
  blonde: "d6b370",
  brun: "724133",
  brune: "724133",
  marron: "724133",
  châtain: "b58143",
  chatain: "b58143",
  noir: "2c1b18",
  noire: "2c1b18",
  roux: "c93305",
  rousse: "c93305",
  rouge: "c93305",
  rose: "f59797",
  gris: "e8e1e1",
  grise: "e8e1e1",
  blanc: "ecdcbf",
  blanche: "ecdcbf",
} as const;

const skinColors = {
  clair: "ffdbb4",
  claire: "ffdbb4",
  pale: "ffdbb4",
  pâle: "ffdbb4",
  blanche: "ffdbb4",
  blanc: "ffdbb4",
  mat: "edb98a",
  mate: "edb98a",
  bronzé: "d08b5b",
  bronze: "d08b5b",
  foncé: "614335",
  fonce: "614335",
  noire: "614335",
  noir: "614335",
} as const;

const eyeColors = {
  bleu: "65c9ff",
  bleus: "65c9ff",
  bleue: "65c9ff",
  vert: "3eac2c",
  verts: "3eac2c",
  verte: "3eac2c",
  marron: "724133",
  noisette: "b58143",
  noir: "2c1b18",
  noirs: "2c1b18",
} as const;

const bgColors = {
  rose: "f8c8d8",
  pêche: "ffd6a5",
  peche: "ffd6a5",
  jaune: "fde68a",
  vert: "bbf7d0",
  verte: "bbf7d0",
  sauge: "bbf7d0",
  bleu: "bae6fd",
  bleue: "bae6fd",
  ciel: "bae6fd",
  lilas: "ddd6fe",
  violet: "ddd6fe",
  violette: "ddd6fe",
  blanc: "fef0f5",
  crème: "fef0f5",
  creme: "fef0f5",
} as const;

const longHair = ["bob", "bun", "curly", "curvy", "longButNotTooLong", "straight02", "straight01", "straightAndStrand", "bigHair"];
const shortHair = ["shortCurly", "shortFlat", "shortRound", "shortWaved", "sides", "theCaesar", "theCaesarAndSidePart", "frizzle"];

type AvatarResult = {
  style: "custom-cute";
  seed: string;
  backgroundColor: string;
  flip: boolean;
  radius: number;
  extras: Record<string, string>;
  summary: string;
};

function normalizeText(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function pickMapped(source: string, map: Record<string, string>) {
  for (const [word, value] of Object.entries(map)) {
    if (source.includes(normalizeText(word))) return value;
  }
  return undefined;
}

function stableSeed(prompt: string) {
  const cleaned = prompt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 18);
  return cleaned || "Amour";
}

function deterministicAvatar(prompt: string, ai?: Partial<AvatarResult>): AvatarResult {
  const text = normalizeText(prompt);
  const isGirl = hasAny(text, ["fille", "femme", "princesse", "copine", "elle", "meuf"]);
  const isBoy = hasAny(text, ["garcon", "garçon", "homme", "prince", "copain", "il", "mec"]);
  const wantsLong = isGirl || hasAny(text, ["long", "longs", "longue", "longues", "cheveux longs"]);
  const wantsShort = isBoy || hasAny(text, ["court", "courts", "courte", "courtes", "cheveux courts"]);
  const curly = hasAny(text, ["boucle", "boucles", "bouclee", "bouclée", "curly"]);
  const bun = hasAny(text, ["chignon", "bun"]);
  const hat = hasAny(text, ["bonnet", "chapeau"]);
  const hijab = hasAny(text, ["voile", "hijab"]);
  const freckles = hasAny(text, ["rousseur", "taches", "tache de rousseur", "freckles"]);
  const glasses = hasAny(text, ["lunette", "lunettes", "glasses"]);
  const sunglasses = hasAny(text, ["soleil", "sunglasses"]);
  const beard = hasAny(text, ["barbe", "barbu", "moustache", "mustache"]);
  const wink = hasAny(text, ["clin", "wink"]);
  const love = hasAny(text, ["amour", "coeur", "cœur", "love", "hearts"]);
  const sad = hasAny(text, ["triste", "sad"]);
  const surprised = hasAny(text, ["surpris", "surprise"]);

  let top = ai?.extras?.top || (wantsLong ? "straight01" : wantsShort ? "shortRound" : "curly");
  if (hat) top = "winterHat1";
  else if (hijab) top = "hijab";
  else if (bun) top = "bun";
  else if (curly) top = wantsShort ? "shortCurly" : "curly";
  else if (wantsLong && !longHair.includes(top)) top = "straight01";
  else if (wantsShort && !shortHair.includes(top)) top = "shortRound";

  const extras: Record<string, string> = {
    top,
    hairLength: wantsLong ? "long" : "short",
    hairTexture: curly ? "curly" : "smooth",
    hairColor: pickMapped(text, hairColors) || ai?.extras?.hairColor || "724133",
    skinColor: pickMapped(text, skinColors) || ai?.extras?.skinColor || "ffdbb4",
    eyesColor: pickMapped(text, eyeColors) || "2c1b18",
    mouth: sad ? "sad" : "smile",
    glasses: glasses ? "true" : "false",
    beard: beard ? "true" : "false",
    freckles: freckles ? "true" : "false",
    earrings: hasAny(text, ["boucle d'oreille", "boucles d'oreille", "earrings"]) ? "true" : "false",
    shirtColor: hasAny(text, ["noir", "noire"]) ? "262e33" : hasAny(text, ["bleu", "bleue"]) ? "65c9ff" : "ffafb9",
  };

  const eyeColor = pickMapped(text, eyeColors);

  const backgroundColor = pickMapped(text, bgColors) || ai?.backgroundColor || "f8c8d8";
  return {
    style: "custom-cute",
    seed: stableSeed(prompt),
    backgroundColor,
    flip: !!ai?.flip,
    radius: 50,
    extras,
    summary: [
      extras.hairColor ? "cheveux adaptés" : null,
      eyeColor ? "yeux colorés" : null,
      glasses ? "lunettes" : null,
      beard ? "barbe/moustache" : null,
      freckles ? "détail taches de rousseur" : null,
    ].filter(Boolean).join(" · ") || "traits doux et souriants",
  };
}

function safeAi(raw: unknown): Partial<AvatarResult> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const extras = o.extras && typeof o.extras === "object" ? o.extras as Record<string, string> : {};
  return {
    backgroundColor: typeof o.backgroundColor === "string" && /^[0-9a-fA-F]{6}$/.test(o.backgroundColor) ? o.backgroundColor.toLowerCase() : undefined,
    flip: !!o.flip,
    extras,
  };
}

export const generateAvatarFromPrompt = createServerFn({ method: "POST" })
  .inputValidator((d: Input) => ({ prompt: String(d.prompt || "").slice(0, 300) }))
  .handler(async ({ data }) => {
    const prompt = data.prompt.trim();
    if (!prompt) return { ok: false as const, error: "empty_prompt" };

    const apiKey = process.env.LOVABLE_API_KEY;
    let ai: Partial<AvatarResult> | undefined;

    if (apiKey) {
      try {
        const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
        const { generateText } = await import("ai");
        const gateway = createOpenAICompatible({
          name: "lovable",
          baseURL: "https://ai.gateway.lovable.dev/v1",
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
        });
        const result = await generateText({
          model: gateway("google/gemini-3-flash-preview"),
          temperature: 0.15,
          prompt: `Réponds uniquement en JSON court. Pour cette description d'avatar: "${prompt}", propose seulement {"backgroundColor":"hex sans #","flip":false,"extras":{"top":"coiffure avataaars si pertinente"}}.`,
        });
        const match = result.text.match(/\{[\s\S]*\}/);
        if (match) ai = safeAi(JSON.parse(match[0]));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("429")) return { ok: false as const, error: "rate_limit" };
        if (message.includes("402")) return { ok: false as const, error: "credits" };
      }
    }

    return { ok: true as const, result: deterministicAvatar(prompt, ai) };
  });