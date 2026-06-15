import { createServerFn } from "@tanstack/react-start";

type Input = { prompt: string };

/**
 * AI-driven DiceBear avatar builder.
 *
 * IMPORTANT: DiceBear "seed" is hashed — it does NOT control specific traits.
 * To actually reflect the description (couleur de cheveux, peau, yeux…), we
 * must pass per-style options like hair, hairColor, skinColor, eyes, mouth,
 * etc. as URL params. This file constrains the AI to 3 styles with very rich
 * controllable vocab (avataaars, lorelei, adventurer), tells it the EXACT
 * allowed enum values, and forwards them as `extras` to the client.
 */

// ─── Per-style controllable vocabulary (DiceBear 9.x) ─────────────────────

const AVATAAARS = {
  topMasc: ["shortHairShortFlat", "shortHairTheCaesar", "shortHairShaggy", "shortHairDreads01", "shortHairFrizzle", "shortHairSides", "shortWaved"],
  topFem: ["longHairStraight", "longHairStraight2", "longHairBob", "longHairCurly", "longHairCurvy", "longHairBigHair", "longHairFro", "longHairMiaWallace"],
  topHat: ["hat", "winterHat1", "winterHat02", "winterHat03", "winterHat04", "turban", "hijab"],
  hairColor: ["auburn", "black", "blonde", "blondeGolden", "brown", "brownDark", "pastelPink", "platinum", "red", "silverGray"],
  skinColor: ["tanned", "yellow", "pale", "light", "brown", "darkBrown", "black"],
  eyes: ["default", "happy", "wink", "hearts", "squint", "surprised", "side"],
  eyebrows: ["default", "raisedExcited", "sadConcerned", "upDown", "angry", "flatNatural"],
  mouth: ["smile", "twinkle", "default", "tongue", "serious", "sad"],
  facialHair: ["blank", "beardLight", "beardMajestic", "beardMedium", "moustacheFancy", "moustacheMagnum"],
  facialHairColor: ["auburn", "black", "blonde", "blondeGolden", "brown", "brownDark", "platinum", "red"],
  accessories: ["blank", "kurt", "prescription01", "prescription02", "round", "sunglasses", "wayfarers"],
  clothing: ["blazerAndShirt", "blazerAndSweater", "collarAndSweater", "graphicShirt", "hoodie", "overall", "shirtCrewNeck", "shirtScoopNeck", "shirtVNeck"],
  clothesColor: ["black", "blue01", "blue02", "blue03", "gray01", "gray02", "heather", "pastelBlue", "pastelGreen", "pastelOrange", "pastelRed", "pastelYellow", "pink", "red", "white"],
};

const LORELEI = {
  hair: ["variant01","variant02","variant03","variant04","variant05","variant06","variant07","variant08","variant09","variant10","variant11","variant12","variant13","variant14","variant15","variant16","variant17","variant18","variant19","variant20","variant21","variant22","variant23","variant24","variant25","variant26","variant27","variant28","variant29","variant30","variant31","variant32","variant33","variant34","variant35","variant36","variant37","variant38","variant39","variant40","variant41","variant42","variant43","variant44","variant45","variant46","variant47","variant48"],
  // hairColor in lorelei: hex without # (provide a small palette)
  hairColor: ["0e0e0e","3eac2c","6a4e35","85c2c6","796a45","562306","592454","ab2a18","ac6511","afafaf","b9a05f","cb6820","dba3be","e5d7a3","f59797"],
  eyes: ["variant01","variant02","variant03","variant04","variant05","variant06","variant07","variant08","variant09","variant10","variant11","variant12","variant13","variant14","variant15","variant16","variant17","variant18","variant19","variant20","variant21","variant22","variant23","variant24"],
  eyebrows: ["variant01","variant02","variant03","variant04","variant05","variant06","variant07","variant08","variant09","variant10","variant11","variant12","variant13","variant14"],
  mouth: ["happy01","happy02","happy03","happy04","happy05","happy06","happy07","happy08","happy09","happy10","happy11","happy12","happy13","happy14","happy15","happy16","happy17","happy18","sad01","sad02","sad03","sad04","sad05","sad06","sad07","sad08","sad09"],
  nose: ["variant01","variant02","variant03","variant04","variant05","variant06","variant07"],
  freckles: ["variant01","variant02","variant03","variant04","variant05"],
  freckleProbability: ["0","100"],
  glasses: ["variant01","variant02","variant03","variant04","variant05"],
  glassesProbability: ["0","100"],
  earrings: ["variant01","variant02","variant03","variant04","variant05"],
  earringsProbability: ["0","100"],
  beard: ["variant01","variant02","variant03"],
  beardProbability: ["0","100"],
};

const ADVENTURER = {
  hairShort: ["short01","short02","short03","short04","short05","short06","short07","short08","short09","short10","short11","short12","short13","short14","short15","short16","short17","short18","short19"],
  hairLong: ["long01","long02","long03","long04","long05","long06","long07","long08","long09","long10","long11","long12","long13","long14","long15","long16","long17","long18","long19","long20","long21","long22","long23","long24","long25","long26"],
  hairColor: ["0e0e0e","3eac2c","6a4e35","85c2c6","796a45","562306","592454","ab2a18","ac6511","afafaf","b9a05f","cb6820","dba3be","e5d7a3","f59797"],
  skinColor: ["9e5622","763900","ecad80","f2d3b1"],
  eyes: ["variant01","variant02","variant03","variant04","variant05","variant06","variant07","variant08","variant09","variant10","variant11","variant12","variant13","variant14","variant15","variant16","variant17","variant18","variant19","variant20","variant21","variant22","variant23","variant24","variant25","variant26"],
  eyebrows: ["variant01","variant02","variant03","variant04","variant05","variant06","variant07","variant08","variant09","variant10","variant11","variant12","variant13","variant14","variant15"],
  mouth: ["variant01","variant02","variant03","variant04","variant05","variant06","variant07","variant08","variant09","variant10","variant11","variant12","variant13","variant14","variant15","variant16","variant17","variant18","variant19","variant20","variant21","variant22","variant23","variant24","variant25","variant26","variant27","variant28","variant29","variant30"],
  glasses: ["variant01","variant02","variant03","variant04","variant05"],
  glassesProbability: ["0","100"],
  earrings: ["variant01","variant02","variant03","variant04","variant05","variant06"],
  earringsProbability: ["0","100"],
  features: ["birthmark","blush","freckles","mustache"],
  featuresProbability: ["0","100"],
};

const ALLOWED_STYLES = ["avataaars", "lorelei", "adventurer"] as const;
type Style = (typeof ALLOWED_STYLES)[number];

const PER_STYLE_KEYS: Record<Style, string[]> = {
  avataaars: ["top", "hairColor", "skinColor", "eyes", "eyebrows", "mouth", "facialHair", "facialHairColor", "accessories", "clothing", "clothesColor"],
  lorelei: ["hair", "hairColor", "eyes", "eyebrows", "mouth", "nose", "freckles", "freckleProbability", "glasses", "glassesProbability", "earrings", "earringsProbability", "beard", "beardProbability"],
  adventurer: ["hair", "hairColor", "skinColor", "eyes", "eyebrows", "mouth", "glasses", "glassesProbability", "earrings", "earringsProbability", "features", "featuresProbability"],
};

const BG_NAMES: Record<string, string> = {
  rose: "f8c8d8", pêche: "ffd6a5", peche: "ffd6a5",
  jaune: "fde68a", vert: "bbf7d0", sauge: "bbf7d0",
  bleu: "bae6fd", ciel: "bae6fd", lilas: "ddd6fe",
  violet: "ddd6fe", bonbon: "fbcfe8", blush: "fecaca",
  crème: "fef0f5", creme: "fef0f5", voile: "fef0f5",
};

const SYSTEM = `Tu es un générateur d'avatar DiceBear pour une appli de couple. À partir d'une description en français, tu DOIS produire un JSON strict décrivant un avatar qui reflète FIDÈLEMENT les traits mentionnés (genre, cheveux, couleur cheveux, peau, yeux, accessoires…).

RÈGLES IMPORTANTES :
1. Choisis "style" parmi : "avataaars" (cartoon polyvalent — idéal si traits précis), "lorelei" (illustré doux, féminin), "adventurer" (cartoon moderne).
2. "seed" est un mot court (ne contrôle que la variation aléatoire des détails non spécifiés).
3. "backgroundColor" : hex 6 chiffres SANS #, ou "transparent". Couleurs douces : f8c8d8 rose, ffd6a5 pêche, fde68a jaune, bbf7d0 sauge, bae6fd ciel, ddd6fe lilas, fbcfe8 bonbon, fecaca blush, fef0f5 voile.
4. "extras" : OBJET d'options DiceBear pour le style choisi. UTILISE UNIQUEMENT les clés et valeurs autorisées ci-dessous. Choisis chaque trait pour correspondre à la description.

═══ STYLE "avataaars" — clés autorisées ═══
- top (coiffure) : ${[...AVATAAARS.topMasc, ...AVATAAARS.topFem, ...AVATAAARS.topHat].join(", ")}
  → masculin court : ${AVATAAARS.topMasc.join(", ")}
  → féminin long : ${AVATAAARS.topFem.join(", ")}
  → couvre-chef : ${AVATAAARS.topHat.join(", ")}
- hairColor : ${AVATAAARS.hairColor.join(", ")}  (blond→blonde, brun→brown, noir→black, roux→red, rose→pastelPink, gris→silverGray)
- skinColor : ${AVATAAARS.skinColor.join(", ")}  (clair→light/pale, mat→tanned, basané→brown, noir→black/darkBrown)
- eyes : ${AVATAAARS.eyes.join(", ")}
- eyebrows : ${AVATAAARS.eyebrows.join(", ")}
- mouth : ${AVATAAARS.mouth.join(", ")}
- facialHair : ${AVATAAARS.facialHair.join(", ")}  (blank = pas de barbe)
- facialHairColor : ${AVATAAARS.facialHairColor.join(", ")}
- accessories : ${AVATAAARS.accessories.join(", ")}  (blank = rien, sunglasses/round/wayfarers pour lunettes)
- clothing : ${AVATAAARS.clothing.join(", ")}
- clothesColor : ${AVATAAARS.clothesColor.join(", ")}

═══ STYLE "lorelei" — clés autorisées ═══
- hair : variant01..variant48
- hairColor (hex sans #) : ${LORELEI.hairColor.join(", ")}  (blond→e5d7a3 ou b9a05f, brun→6a4e35 ou 796a45, noir→0e0e0e, roux→ab2a18 ou cb6820, rose→dba3be ou f59797)
- eyes : variant01..variant24
- eyebrows : variant01..variant14
- mouth : happy01..happy18 (souriant), sad01..sad09 (triste)
- nose : variant01..variant07
- freckles + freckleProbability ("0" ou "100")
- glasses + glassesProbability
- earrings + earringsProbability
- beard + beardProbability (utiliser "100" si barbe demandée)

═══ STYLE "adventurer" — clés autorisées ═══
- hair : short01..short19 (court) OU long01..long26 (long)
- hairColor (hex sans #) : ${ADVENTURER.hairColor.join(", ")}
- skinColor (hex sans #) : 9e5622 (foncé), 763900 (très foncé), ecad80 (mat), f2d3b1 (clair)
- eyes : variant01..variant26
- eyebrows : variant01..variant15
- mouth : variant01..variant30
- glasses + glassesProbability ("100" pour activer)
- earrings + earringsProbability
- features : birthmark, blush, freckles, mustache  + featuresProbability

RÉFLEXION OBLIGATOIRE avant de répondre :
- Si la description mentionne un genre (fille/femme → cheveux longs ; garçon/homme → cheveux courts), respecte-le.
- Si une couleur de cheveux est citée, FORCE hairColor.
- Si une couleur de peau est citée, FORCE skinColor.
- Si des lunettes/barbe/taches de rousseur sont citées, ACTIVE l'option correspondante.
- Sinon, choisis des valeurs cohérentes et douces.

Réponds UNIQUEMENT en JSON valide, sans markdown.`;

const SCHEMA_HINT = `{
  "style": "avataaars",
  "seed": "Lila",
  "backgroundColor": "f8c8d8",
  "flip": false,
  "radius": 50,
  "extras": {
    "top": "longHairCurly",
    "hairColor": "blonde",
    "skinColor": "light",
    "eyes": "happy",
    "mouth": "smile",
    "clothing": "shirtCrewNeck",
    "clothesColor": "pastelPink"
  }
}`;

type AvatarResult = {
  style: Style;
  seed: string;
  backgroundColor: string;
  flip: boolean;
  radius: number;
  extras: Record<string, string>;
};

function sanitizeValue(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/[^a-zA-Z0-9,]/g, "").slice(0, 200);
}

function normalize(raw: unknown): AvatarResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const style = (typeof o.style === "string" && (ALLOWED_STYLES as readonly string[]).includes(o.style) ? o.style : "avataaars") as Style;
  const seed = typeof o.seed === "string" && o.seed.trim() ? o.seed.trim().slice(0, 40) : "Amour";
  let bg = typeof o.backgroundColor === "string" ? o.backgroundColor.trim().toLowerCase().replace(/^#/, "") : "f8c8d8";
  if (BG_NAMES[bg]) bg = BG_NAMES[bg];
  if (bg !== "transparent" && !/^[0-9a-f]{6}$/.test(bg)) bg = "f8c8d8";
  const flip = !!o.flip;
  const r = typeof o.radius === "number" ? o.radius : 50;
  const radius = [0, 20, 50].includes(r) ? r : (r > 35 ? 50 : r > 10 ? 20 : 0);

  const extras: Record<string, string> = {};
  const allowedKeys = new Set(PER_STYLE_KEYS[style]);
  const rawExtras = o.extras;
  if (rawExtras && typeof rawExtras === "object") {
    for (const [k, v] of Object.entries(rawExtras as Record<string, unknown>)) {
      if (!allowedKeys.has(k)) continue;
      const val = sanitizeValue(v);
      if (!val) continue;
      extras[k] = val;
    }
  }
  return { style, seed, backgroundColor: bg, flip, radius, extras };
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
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `Description : « ${data.prompt} »\n\nProduis un JSON valide qui suit EXACTEMENT ce schéma (adapte les valeurs à la description) :\n${SCHEMA_HINT}` },
          ],
          response_format: { type: "json_object" },
          temperature: 0.6,
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
