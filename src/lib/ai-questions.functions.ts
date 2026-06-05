import { createServerFn } from "@tanstack/react-start";

type GameId = "wouldyou" | "mostlikely" | "paysville" | "riddles";
type Ambiance = "mignon" | "coquin" | "hot";

type Input = {
  game: GameId;
  ambiance: Ambiance;
  count: number;
  seed?: string;
};

const AMBIANCE_DESC: Record<Ambiance, string> = {
  mignon: "doux, romantique, mignon, tendre (sans contenu sexuel explicite)",
  coquin: "coquin, sensuel, suggestif, légèrement osé (couple adulte consentant)",
  hot: "très érotique, sans tabou, explicite, hot (couple adulte consentant, toujours respectueux et consenti)",
};

function buildPrompt(game: GameId, ambiance: Ambiance, count: number, seed: string): { system: string; user: string; schemaHint: string } {
  const tone = AMBIANCE_DESC[ambiance];
  const common = `Tu génères du contenu en FRANÇAIS pour un mini-jeu de COUPLE adulte et consentant. Ton ambiance : ${tone}. Sois créatif, varié, évite les clichés. Seed aléatoire pour varier : ${seed}. Réponds UNIQUEMENT en JSON valide, aucun texte autour.`;

  if (game === "wouldyou") {
    return {
      system: common,
      user: `Génère ${count} questions "Tu préfères A ou B ?" pour ce couple. Chaque question propose deux options désirables et cohérentes avec l'ambiance. Ajoute 1 emoji pertinent à la fin de chaque option. Garde chaque option courte (max 90 caractères).`,
      schemaHint: `{"questions":[{"a":"texte option A 💕","b":"texte option B 🔥"}]}`,
    };
  }
  if (game === "mostlikely") {
    return {
      system: common,
      user: `Génère ${count} affirmations courtes pour le jeu "Qui est le plus susceptible de…". Chaque affirmation commence par un verbe à l'infinitif ou une action (sans répéter "Qui est le plus susceptible de"). Ajoute 1 emoji à la fin. Max 80 caractères.`,
      schemaHint: `{"statements":["pleurer devant un film romantique 🥲","prendre l'initiative au lit ce soir 🔥"]}`,
    };
  }
  if (game === "paysville") {
    return {
      system: common,
      user: `Génère ${count} catégories pour un "Petit Bac" (Pays Ville) couple. Les catégories doivent être originales, courtes (max 22 caractères), faciles à remplir avec un mot commençant par n'importe quelle lettre. Mix entre catégories classiques et catégories thématiques couple/sensuel cohérentes avec l'ambiance.`,
      schemaHint: `{"categories":["Pays","Prénom sexy","Vêtement","Lieu romantique"]}`,
    };
  }
  // riddles
  return {
    system: common,
    user: `Génère ${count} devinettes/énigmes en français pour ce couple. Pour chaque énigme, fournis le texte de l'énigme ET une liste de 2 à 6 réponses acceptées (variantes orthographiques, avec/sans article, singulier/pluriel — toutes en minuscules sans accents). L'énigme peut avoir une touche d'humour ${ambiance}. Réponse en 1 à 3 mots maximum.`,
    schemaHint: `{"riddles":[{"q":"Plus on en enlève, plus il devient grand. Qu'est-ce que c'est ?","answers":["un trou","trou","le trou"]}]}`,
  };
}

export const generateGameContent = createServerFn({ method: "POST" })
  .inputValidator((d: Input) => d)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "LOVABLE_API_KEY missing" };
    }
    const seed = data.seed ?? Math.random().toString(36).slice(2, 10);
    const { system, user, schemaHint } = buildPrompt(data.game, data.ambiance, data.count, seed);

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: system },
            { role: "user", content: `${user}\n\nFormat JSON attendu (exemple):\n${schemaHint}` },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        console.error("AI gateway error", resp.status, t);
        return { ok: false as const, error: `gateway_${resp.status}` };
      }
      const json = await resp.json();
      const content: string = json?.choices?.[0]?.message?.content ?? "";
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(content) as Record<string, unknown>;
      } catch {
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) return { ok: false as const, error: "invalid_json" };
        parsed = JSON.parse(match[0]) as Record<string, unknown>;
      }
      return { ok: true as const, data: parsed };
    } catch (e) {
      console.error("AI fetch failed", e);
      return { ok: false as const, error: "network" };
    }
  });
