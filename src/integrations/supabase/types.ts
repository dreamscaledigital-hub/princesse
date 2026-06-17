export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      answers: {
        Row: {
          answer_text: string
          created_at: string
          id: string
          player_slot: number
          question_index: number
          room_id: string
        }
        Insert: {
          answer_text: string
          created_at?: string
          id?: string
          player_slot: number
          question_index: number
          room_id: string
        }
        Update: {
          answer_text?: string
          created_at?: string
          id?: string
          player_slot?: number
          question_index?: number
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      couples: {
        Row: {
          created_at: string
          id: string
          last_morning_digest_date: string | null
          room_id: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_morning_digest_date?: string | null
          room_id?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          last_morning_digest_date?: string | null
          room_id?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "couples_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_dares: {
        Row: {
          author_slot: number
          created_at: string
          id: string
          level: string
          room_id: string
          text: string
        }
        Insert: {
          author_slot: number
          created_at?: string
          id?: string
          level?: string
          room_id: string
          text: string
        }
        Update: {
          author_slot?: number
          created_at?: string
          id?: string
          level?: string
          room_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_dares_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_questions: {
        Row: {
          author_slot: number
          correct_answer: string
          created_at: string
          id: string
          room_id: string
          text: string
          wrongs: Json
        }
        Insert: {
          author_slot: number
          correct_answer: string
          created_at?: string
          id?: string
          room_id: string
          text: string
          wrongs?: Json
        }
        Update: {
          author_slot?: number
          correct_answer?: string
          created_at?: string
          id?: string
          room_id?: string
          text?: string
          wrongs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "custom_questions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_entries: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          mood_emoji: string | null
          mood_word: string | null
          ritual_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          mood_emoji?: string | null
          mood_word?: string | null
          ritual_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          mood_emoji?: string | null
          mood_word?: string | null
          ritual_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_entries_ritual_id_fkey"
            columns: ["ritual_id"]
            isOneToOne: false
            referencedRelation: "daily_rituals"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_rituals: {
        Row: {
          ambiance: string | null
          couple_id: string
          created_at: string
          id: string
          question: string
          ritual_date: string
        }
        Insert: {
          ambiance?: string | null
          couple_id: string
          created_at?: string
          id?: string
          question: string
          ritual_date?: string
        }
        Update: {
          ambiance?: string | null
          couple_id?: string
          created_at?: string
          id?: string
          question?: string
          ritual_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_rituals_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      duels: {
        Row: {
          code: string
          created_at: string
          current_round: number
          gage: string
          game_winner_id: string | null
          id: string
          owner_user_id: string | null
          p1_id: string
          p1_name: string
          p1_score: number
          p2_id: string | null
          p2_name: string | null
          p2_score: number
          round_winner_id: string | null
          signal_at: string | null
          status: string
          total_rounds: number
        }
        Insert: {
          code: string
          created_at?: string
          current_round?: number
          gage?: string
          game_winner_id?: string | null
          id?: string
          owner_user_id?: string | null
          p1_id: string
          p1_name?: string
          p1_score?: number
          p2_id?: string | null
          p2_name?: string | null
          p2_score?: number
          round_winner_id?: string | null
          signal_at?: string | null
          status?: string
          total_rounds?: number
        }
        Update: {
          code?: string
          created_at?: string
          current_round?: number
          gage?: string
          game_winner_id?: string | null
          id?: string
          owner_user_id?: string | null
          p1_id?: string
          p1_name?: string
          p1_score?: number
          p2_id?: string | null
          p2_name?: string | null
          p2_score?: number
          round_winner_id?: string | null
          signal_at?: string | null
          status?: string
          total_rounds?: number
        }
        Relationships: []
      }
      guesses: {
        Row: {
          chosen_text: string
          created_at: string
          guesser_slot: number
          id: string
          is_correct: boolean
          room_id: string
          turn_index: number
        }
        Insert: {
          chosen_text: string
          created_at?: string
          guesser_slot: number
          id?: string
          is_correct: boolean
          room_id: string
          turn_index: number
        }
        Update: {
          chosen_text?: string
          created_at?: string
          guesser_slot?: number
          id?: string
          is_correct?: boolean
          room_id?: string
          turn_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "guesses_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          couple_id: string
          created_at: string
          id: string
          image_path: string | null
          reactions: Json
          read_by: Json
          sender_id: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          couple_id: string
          created_at?: string
          id?: string
          image_path?: string | null
          reactions?: Json
          read_by?: Json
          sender_id: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          couple_id?: string
          created_at?: string
          id?: string
          image_path?: string | null
          reactions?: Json
          read_by?: Json
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_couple_id_fkey"
            columns: ["couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      pairing_codes: {
        Row: {
          code: string
          consumed_at: string | null
          consumed_by: string | null
          created_at: string
          created_by: string
          expires_at: string
        }
        Insert: {
          code: string
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
        }
        Update: {
          code?: string
          consumed_at?: string | null
          consumed_by?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          client_id: string
          id: string
          joined_at: string
          name: string
          room_id: string
          slot: number
        }
        Insert: {
          client_id: string
          id?: string
          joined_at?: string
          name?: string
          room_id: string
          slot: number
        }
        Update: {
          client_id?: string
          id?: string
          joined_at?: string
          name?: string
          room_id?: string
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_emoji: string
          avatar_options: Json
          avatar_style: string
          created_at: string
          daily_notif_enabled: boolean
          display_name: string
          id: string
          pensee_sound: string
          updated_at: string
        }
        Insert: {
          avatar_emoji?: string
          avatar_options?: Json
          avatar_style?: string
          created_at?: string
          daily_notif_enabled?: boolean
          display_name?: string
          id: string
          pensee_sound?: string
          updated_at?: string
        }
        Update: {
          avatar_emoji?: string
          avatar_options?: Json
          avatar_style?: string
          created_at?: string
          daily_notif_enabled?: boolean
          display_name?: string
          id?: string
          pensee_sound?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          ambiance: string
          code: string
          complicity: number
          created_at: string
          current_dare: string | null
          current_dare_for: number | null
          current_player: number
          current_turn: number
          finale_scores: Json
          id: string
          minigame_id: string | null
          minigame_round: number
          minigame_state: Json
          mode: string | null
          next_date_at: string | null
          owner_couple_id: string | null
          phase: string
          score_1: number
          score_2: number
          secrets_ready: Json
          stage: string
          turn_order: Json
          turn_plan: Json
        }
        Insert: {
          ambiance?: string
          code: string
          complicity?: number
          created_at?: string
          current_dare?: string | null
          current_dare_for?: number | null
          current_player?: number
          current_turn?: number
          finale_scores?: Json
          id?: string
          minigame_id?: string | null
          minigame_round?: number
          minigame_state?: Json
          mode?: string | null
          next_date_at?: string | null
          owner_couple_id?: string | null
          phase?: string
          score_1?: number
          score_2?: number
          secrets_ready?: Json
          stage?: string
          turn_order?: Json
          turn_plan?: Json
        }
        Update: {
          ambiance?: string
          code?: string
          complicity?: number
          created_at?: string
          current_dare?: string | null
          current_dare_for?: number | null
          current_player?: number
          current_turn?: number
          finale_scores?: Json
          id?: string
          minigame_id?: string | null
          minigame_round?: number
          minigame_state?: Json
          mode?: string | null
          next_date_at?: string | null
          owner_couple_id?: string | null
          phase?: string
          score_1?: number
          score_2?: number
          secrets_ready?: Json
          stage?: string
          turn_order?: Json
          turn_plan?: Json
        }
        Relationships: [
          {
            foreignKeyName: "rooms_owner_couple_id_fkey"
            columns: ["owner_couple_id"]
            isOneToOne: false
            referencedRelation: "couples"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          id: string
          note: string | null
          proposed_by: number
          room_code: string
          status: string
          title: string
          validated_by: number | null
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          proposed_by: number
          room_code: string
          status?: string
          title: string
          validated_by?: number | null
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          proposed_by?: number
          room_code?: string
          status?: string
          title?: string
          validated_by?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_pairing_code: { Args: { _code: string }; Returns: string }
      couple_for_user: { Args: { _uid: string }; Returns: string }
      couple_streak: { Args: { _couple_id: string }; Returns: number }
      increment_tap: {
        Args: { _delta: number; _room_id: string; _slot: number }
        Returns: undefined
      }
      is_room_code_member: { Args: { _code: string }; Returns: boolean }
      is_room_member: { Args: { _room_id: string }; Returns: boolean }
      minigame_patch: {
        Args: { _patch: Json; _room_id: string }
        Returns: undefined
      }
      partner_of: { Args: { _uid: string }; Returns: string }
      register_tap: {
        Args: { _code: string; _player_id: string }
        Returns: string
      }
      start_duel_round: { Args: { _code: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
