import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DareLevel, MinigameId } from "@/lib/game-content";

export type TurnPlanEntry =
  | { kind: "classic"; guesser: number; qi: number }
  | { kind: "custom"; guesser: number; custom_id: string };

export type Stage = "round1" | "round2" | "finale" | "done";

export type GameMode = "full" | "quiz" | "minigames" | "mastermind" | "hangman" | "wouldyou" | "cupidon" | "paysville" | "mostlikely" | "riddles" | "tower" | "bounce" | "edit_secrets" | "wishlist" | "tap" | "draw" | "wheel" | "p4";

export type Room = {
  id: string;
  code: string;
  phase: "lobby" | "menu" | "secrets" | "phase1" | "phase2" | "dare" | "done" | "minigames" | "wishlist";
  mode: GameMode | null;
  stage: Stage;
  current_turn: number;
  current_player: number;
  current_dare: string | null;
  current_dare_for: number | null;
  score_1: number;
  score_2: number;
  complicity: number;
  turn_order: number[];
  turn_plan: TurnPlanEntry[];
  secrets_ready: number[];
  minigame_id: MinigameId | null;
  minigame_state: Record<string, unknown>;
  minigame_round: number;
  finale_scores: { "1": number; "2": number };
  next_date_at: string | null;
  ambiance: "irl" | "distance" | null;
  created_at: string;

};

export type Player = {
  id: string;
  room_id: string;
  slot: number;
  name: string;
  client_id: string;
};

export type Answer = {
  id: string;
  room_id: string;
  player_slot: number;
  question_index: number;
  answer_text: string;
};

export type Guess = {
  id: string;
  room_id: string;
  turn_index: number;
  guesser_slot: number;
  chosen_text: string;
  is_correct: boolean;
};

export type CustomQuestion = {
  id: string;
  room_id: string;
  author_slot: number;
  text: string;
  correct_answer: string;
  wrongs: string[];
};

export type CustomDare = {
  id: string;
  room_id: string;
  author_slot: number;
  text: string;
  level: DareLevel;
};

export function useRoomState(code: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [customDares, setCustomDares] = useState<CustomDare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      setLoading(true);
      const { data: roomData, error: roomErr } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .maybeSingle();

      if (cancelled) return;
      if (roomErr || !roomData) {
        setError("Partie introuvable");
        setLoading(false);
        return;
      }
      const r = roomData as unknown as Room;
      setRoom(r);

      const [pRes, aRes, gRes, cqRes, cdRes] = await Promise.all([
        supabase.from("players").select("*").eq("room_id", r.id),
        supabase.from("answers").select("*").eq("room_id", r.id),
        supabase.from("guesses").select("*").eq("room_id", r.id),
        supabase.from("custom_questions").select("*").eq("room_id", r.id),
        supabase.from("custom_dares").select("*").eq("room_id", r.id),
      ]);
      if (cancelled) return;
      setPlayers((pRes.data ?? []) as unknown as Player[]);
      setAnswers((aRes.data ?? []) as unknown as Answer[]);
      setGuesses((gRes.data ?? []) as unknown as Guess[]);
      setCustomQuestions((cqRes.data ?? []) as unknown as CustomQuestion[]);
      setCustomDares((cdRes.data ?? []) as unknown as CustomDare[]);
      setLoading(false);

      channel = supabase
        .channel(`room-${r.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${r.id}` }, (payload) => {
          if (payload.eventType === "DELETE") setRoom(null);
          else setRoom(payload.new as unknown as Room);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${r.id}` }, (payload) => {
          setPlayers((prev) => {
            if (payload.eventType === "INSERT") return [...prev, payload.new as unknown as Player];
            if (payload.eventType === "UPDATE") return prev.map((p) => (p.id === (payload.new as Player).id ? (payload.new as unknown as Player) : p));
            if (payload.eventType === "DELETE") return prev.filter((p) => p.id !== (payload.old as Player).id);
            return prev;
          });
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "answers", filter: `room_id=eq.${r.id}` }, (payload) => {
          setAnswers((prev) => {
            if (payload.eventType === "INSERT") return [...prev, payload.new as unknown as Answer];
            if (payload.eventType === "UPDATE") return prev.map((a) => (a.id === (payload.new as Answer).id ? (payload.new as unknown as Answer) : a));
            if (payload.eventType === "DELETE") return prev.filter((a) => a.id !== (payload.old as Answer).id);
            return prev;
          });
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "guesses", filter: `room_id=eq.${r.id}` }, (payload) => {
          setGuesses((prev) => {
            if (payload.eventType === "INSERT") return [...prev, payload.new as unknown as Guess];
            if (payload.eventType === "DELETE") return prev.filter((g) => g.id !== (payload.old as Guess).id);
            return prev;
          });
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "custom_questions", filter: `room_id=eq.${r.id}` }, (payload) => {
          setCustomQuestions((prev) => {
            if (payload.eventType === "INSERT") return [...prev, payload.new as unknown as CustomQuestion];
            if (payload.eventType === "UPDATE") return prev.map((q) => (q.id === (payload.new as CustomQuestion).id ? (payload.new as unknown as CustomQuestion) : q));
            if (payload.eventType === "DELETE") return prev.filter((q) => q.id !== (payload.old as CustomQuestion).id);
            return prev;
          });
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "custom_dares", filter: `room_id=eq.${r.id}` }, (payload) => {
          setCustomDares((prev) => {
            if (payload.eventType === "INSERT") return [...prev, payload.new as unknown as CustomDare];
            if (payload.eventType === "UPDATE") return prev.map((d) => (d.id === (payload.new as CustomDare).id ? (payload.new as unknown as CustomDare) : d));
            if (payload.eventType === "DELETE") return prev.filter((d) => d.id !== (payload.old as CustomDare).id);
            return prev;
          });
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [code]);

  return { room, players, answers, guesses, customQuestions, customDares, loading, error };
}
