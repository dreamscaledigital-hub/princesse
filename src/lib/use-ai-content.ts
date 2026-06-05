import { useServerFn } from "@tanstack/react-start";
import { generateGameContent } from "./ai-questions.functions";

export type Ambiance = "mignon" | "coquin" | "hot";
export type GameId = "wouldyou" | "mostlikely" | "paysville" | "riddles";

export type AIWouldYou = { questions: { a: string; b: string }[] };
export type AIMostLikely = { statements: string[] };
export type AIPaysVille = { categories: string[] };
export type AIRiddles = { riddles: { q: string; answers: string[] }[] };

export function useGenerateAIContent() {
  const fn = useServerFn(generateGameContent);
  return async function generate<T>(
    game: GameId,
    ambiance: Ambiance,
    count: number,
  ): Promise<T | null> {
    try {
      const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await fn({ data: { game, ambiance, count, seed } });
      if (!res?.ok) return null;
      const parsed = JSON.parse(res.json) as T;
      return parsed;
    } catch (e) {
      console.error("AI generate failed", e);
      return null;
    }
  };
}
