import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Room = {
  id: string;
  code: string;
  phase: "lobby" | "phase1" | "phase2" | "dare" | "done";
  current_turn: number;
  current_player: number;
  current_dare: string | null;
  current_dare_for: number | null;
  score_1: number;
  score_2: number;
  turn_order: number[]; // jsonb array, ex [1,2,1,2,...]
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

export function useRoomState(code: string | undefined) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [guesses, setGuesses] = useState<Guess[]>([]);
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

      const [pRes, aRes, gRes] = await Promise.all([
        supabase.from("players").select("*").eq("room_id", r.id),
        supabase.from("answers").select("*").eq("room_id", r.id),
        supabase.from("guesses").select("*").eq("room_id", r.id),
      ]);
      if (cancelled) return;
      setPlayers((pRes.data ?? []) as unknown as Player[]);
      setAnswers((aRes.data ?? []) as unknown as Answer[]);
      setGuesses((gRes.data ?? []) as unknown as Guess[]);
      setLoading(false);

      channel = supabase
        .channel(`room-${r.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "rooms", filter: `id=eq.${r.id}` },
          (payload) => {
            if (payload.eventType === "DELETE") setRoom(null);
            else setRoom(payload.new as unknown as Room);
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "players", filter: `room_id=eq.${r.id}` },
          (payload) => {
            setPlayers((prev) => {
              if (payload.eventType === "INSERT") return [...prev, payload.new as unknown as Player];
              if (payload.eventType === "UPDATE")
                return prev.map((p) => (p.id === (payload.new as Player).id ? (payload.new as unknown as Player) : p));
              if (payload.eventType === "DELETE")
                return prev.filter((p) => p.id !== (payload.old as Player).id);
              return prev;
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "answers", filter: `room_id=eq.${r.id}` },
          (payload) => {
            setAnswers((prev) => {
              if (payload.eventType === "INSERT") return [...prev, payload.new as unknown as Answer];
              if (payload.eventType === "UPDATE")
                return prev.map((a) => (a.id === (payload.new as Answer).id ? (payload.new as unknown as Answer) : a));
              return prev;
            });
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "guesses", filter: `room_id=eq.${r.id}` },
          (payload) => {
            setGuesses((prev) => {
              if (payload.eventType === "INSERT") return [...prev, payload.new as unknown as Guess];
              return prev;
            });
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [code]);

  return { room, players, answers, guesses, loading, error };
}
