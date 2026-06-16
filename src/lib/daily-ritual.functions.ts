import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FALLBACK_QUESTIONS = [
  "Quel est le moment où tu m'as trouvé(e) le plus craquant(e) cette semaine ?",
  "Si on partait demain n'importe où, tu choisirais quel endroit et pourquoi ?",
  "Qu'est-ce qui t'a fait sourire en pensant à moi aujourd'hui ?",
  "Raconte-moi un souvenir de nous que tu repenses souvent.",
  "Qu'est-ce que tu rêverais qu'on fasse ce week-end, juste tous les deux ?",
  "Quel petit geste de moi te fait fondre à tous les coups ?",
  "Si tu devais me décrire en 3 mots aujourd'hui, ce serait quoi ?",
  "Quelle chanson te rappelle nous deux en ce moment ?",
];

type Ambiance = "irl" | "distance" | string;

async function generateAiQuestion(ambiance: Ambiance): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  const tone =
    ambiance === "distance"
      ? "Le couple est à distance ce moment, la question doit renforcer le lien malgré l'éloignement, créer de la proximité émotionnelle."
      : "Le couple est ensemble (in real life), la question peut évoquer le présent, le partagé, le physique tendre.";

  const seed = `${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Tu écris en FRANÇAIS une seule question quotidienne tendre et originale pour un couple adulte amoureux. Ton : romantique éditorial, doux, ni cliché ni mièvre. La question doit inviter à se révéler, à raconter, ou à projeter — pas une question fermée oui/non. Maximum 140 caractères. Pas de guillemets, pas de préambule.",
          },
          {
            role: "user",
            content: `${tone} Génère UNE question pour aujourd'hui. Seed pour varier : ${seed}. Réponds uniquement avec la question, rien d'autre.`,
          },
        ],
        temperature: 1,
      }),
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const text: string | undefined = json?.choices?.[0]?.message?.content;
    if (!text) return null;
    const clean = text.trim().replace(/^["'«»\s]+|["'«»\s]+$/g, "");
    if (clean.length < 10 || clean.length > 240) return null;
    return clean;
  } catch {
    return null;
  }
}

function todayISO(): string {
  // Date côté serveur en TZ Europe/Paris (alignée avec la DB)
  const d = new Date();
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${day}`;
}

export const getOrCreateTodayRitual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: coupleId, error: coupleErr } = await supabase.rpc("couple_for_user", {
      _uid: userId,
    });
    if (coupleErr) throw new Error(coupleErr.message);
    if (!coupleId) throw new Error("Pas encore appairé(e)");

    const today = todayISO();

    // 1. Existe déjà ?
    const { data: existing } = await supabase
      .from("daily_rituals")
      .select("*")
      .eq("couple_id", coupleId)
      .eq("ritual_date", today)
      .maybeSingle();

    if (existing) return existing;

    // 2. Quelle ambiance ? On lit la dernière room du couple (champ ambiance) si dispo
    let ambiance: Ambiance = "irl";
    const { data: lastRoom } = await supabase
      .from("rooms")
      .select("ambiance")
      .eq("owner_couple_id", coupleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRoom?.ambiance) ambiance = lastRoom.ambiance;

    // 3. Génère la question (IA, fallback statique)
    let question = await generateAiQuestion(ambiance);
    if (!question) {
      const idx = Math.floor(Math.random() * FALLBACK_QUESTIONS.length);
      question = FALLBACK_QUESTIONS[idx];
    }

    // 4. Insert (upsert pour gérer la course entre les deux membres)
    const { data: inserted, error: insErr } = await supabase
      .from("daily_rituals")
      .upsert(
        { couple_id: coupleId, ritual_date: today, question, ambiance },
        { onConflict: "couple_id,ritual_date" },
      )
      .select("*")
      .maybeSingle();
    if (insErr) throw new Error(insErr.message);
    return inserted!;
  });
