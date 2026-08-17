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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      learning_path_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          order_index: number
          path_id: string
          progress: number
          status: Database["public"]["Enums"]["path_step_status"]
          step_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          order_index: number
          path_id: string
          progress?: number
          status?: Database["public"]["Enums"]["path_step_status"]
          step_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          order_index?: number
          path_id?: string
          progress?: number
          status?: Database["public"]["Enums"]["path_step_status"]
          step_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_steps_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          created_at: string
          id: string
          level: Database["public"]["Enums"]["placement_level"]
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level: Database["public"]["Enums"]["placement_level"]
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["placement_level"]
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_preferences: {
        Row: {
          arabic_font_scale: number
          arabic_level: Database["public"]["Enums"]["arabic_level"] | null
          created_at: string
          daily_goal_minutes: number
          onboarding_completed: boolean
          preferred_reciter: string
          preferred_translation: string
          primary_goal: Database["public"]["Enums"]["learning_goal"] | null
          show_transliteration: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          arabic_font_scale?: number
          arabic_level?: Database["public"]["Enums"]["arabic_level"] | null
          created_at?: string
          daily_goal_minutes?: number
          onboarding_completed?: boolean
          preferred_reciter?: string
          preferred_translation?: string
          primary_goal?: Database["public"]["Enums"]["learning_goal"] | null
          show_transliteration?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          arabic_font_scale?: number
          arabic_level?: Database["public"]["Enums"]["arabic_level"] | null
          created_at?: string
          daily_goal_minutes?: number
          onboarding_completed?: boolean
          preferred_reciter?: string
          preferred_translation?: string
          primary_goal?: Database["public"]["Enums"]["learning_goal"] | null
          show_transliteration?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      placement_attempts: {
        Row: {
          answers: Json
          completed_at: string
          created_at: string
          id: string
          recommended_level: Database["public"]["Enums"]["placement_level"]
          score: number
          section_scores: Json
          total: number
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string
          created_at?: string
          id?: string
          recommended_level: Database["public"]["Enums"]["placement_level"]
          score?: number
          section_scores?: Json
          total?: number
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string
          created_at?: string
          id?: string
          recommended_level?: Database["public"]["Enums"]["placement_level"]
          score?: number
          section_scores?: Json
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      practice_attempts: {
        Row: {
          correct: boolean
          created_at: string
          id: string
          item_id: string | null
          item_key: string
          item_type: string
          response_time_ms: number | null
          user_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          id?: string
          item_id?: string | null
          item_key: string
          item_type: string
          response_time_ms?: number | null
          user_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          id?: string
          item_id?: string | null
          item_key?: string
          item_type?: string
          response_time_ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_attempts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "review_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          interface_language: string
          theme: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id: string
          interface_language?: string
          theme?: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          interface_language?: string
          theme?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      review_items: {
        Row: {
          back: string
          context: string | null
          created_at: string
          due_date: string
          ease_factor: number
          front: string
          id: string
          interval_days: number
          item_key: string
          item_type: string
          lapses: number
          last_reviewed_at: string | null
          repetitions: number
          status: Database["public"]["Enums"]["review_item_status"]
          step_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          back: string
          context?: string | null
          created_at?: string
          due_date?: string
          ease_factor?: number
          front: string
          id?: string
          interval_days?: number
          item_key: string
          item_type: string
          lapses?: number
          last_reviewed_at?: string | null
          repetitions?: number
          status?: Database["public"]["Enums"]["review_item_status"]
          step_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          back?: string
          context?: string | null
          created_at?: string
          due_date?: string
          ease_factor?: number
          front?: string
          id?: string
          interval_days?: number
          item_key?: string
          item_type?: string
          lapses?: number
          last_reviewed_at?: string | null
          repetitions?: number
          status?: Database["public"]["Enums"]["review_item_status"]
          step_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      streaks: {
        Row: {
          created_at: string
          current_streak: number
          last_active_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          minutes: number
          occurred_at: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          minutes?: number
          occurred_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          minutes?: number
          occurred_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_vocabulary: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          status: string
          updated_at: string | null
          user_id: string
          word_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          word_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_vocabulary_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "word_frequency"
            referencedColumns: ["id"]
          },
        ]
      }
      weak_areas: {
        Row: {
          area: string
          created_at: string
          id: string
          last_practiced_at: string | null
          source: Database["public"]["Enums"]["weak_area_source"]
          strength: number
          updated_at: string
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string
          id?: string
          last_practiced_at?: string | null
          source?: Database["public"]["Enums"]["weak_area_source"]
          strength?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          last_practiced_at?: string | null
          source?: Database["public"]["Enums"]["weak_area_source"]
          strength?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      word_frequency: {
        Row: {
          category: Database["public"]["Enums"]["word_category"] | null
          created_at: string | null
          example_ayah: string | null
          example_reference: string | null
          frequency_rank: number | null
          id: string
          meaning: string
          meaning_fr: string | null
          occurrences: number | null
          root: string | null
          topic_tags: string[] | null
          transliteration: string | null
          word: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["word_category"] | null
          created_at?: string | null
          example_ayah?: string | null
          example_reference?: string | null
          frequency_rank?: number | null
          id?: string
          meaning: string
          meaning_fr?: string | null
          occurrences?: number | null
          root?: string | null
          topic_tags?: string[] | null
          transliteration?: string | null
          word: string
        }
        Update: {
          category?: Database["public"]["Enums"]["word_category"] | null
          created_at?: string | null
          example_ayah?: string | null
          example_reference?: string | null
          frequency_rank?: number | null
          id?: string
          meaning?: string
          meaning_fr?: string | null
          occurrences?: number | null
          root?: string | null
          topic_tags?: string[] | null
          transliteration?: string | null
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "admin"
      arabic_level:
        | "complete_beginner"
        | "knows_alphabet"
        | "reads_slowly"
        | "reads_quran"
        | "intermediate"
      learning_goal:
        | "read_quran"
        | "understand_quranic_arabic"
        | "improve_tajweed"
        | "memorize_quran"
        | "improve_vocabulary"
        | "combination"
      path_step_status: "locked" | "available" | "in_progress" | "completed"
      placement_level:
        | "complete_beginner"
        | "foundation"
        | "beginner_reader"
        | "developing_reader"
        | "intermediate_quranic"
      review_item_status:
        | "new"
        | "learning"
        | "review"
        | "relearning"
        | "suspended"
      weak_area_source: "placement" | "practice" | "self_assessed"
      word_category: "noun" | "verb" | "particle" | "phrase"
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
    Enums: {
      app_role: ["student", "teacher", "admin"],
      arabic_level: [
        "complete_beginner",
        "knows_alphabet",
        "reads_slowly",
        "reads_quran",
        "intermediate",
      ],
      learning_goal: [
        "read_quran",
        "understand_quranic_arabic",
        "improve_tajweed",
        "memorize_quran",
        "improve_vocabulary",
        "combination",
      ],
      path_step_status: ["locked", "available", "in_progress", "completed"],
      placement_level: [
        "complete_beginner",
        "foundation",
        "beginner_reader",
        "developing_reader",
        "intermediate_quranic",
      ],
      review_item_status: [
        "new",
        "learning",
        "review",
        "relearning",
        "suspended",
      ],
      weak_area_source: ["placement", "practice", "self_assessed"],
      word_category: ["noun", "verb", "particle", "phrase"],
    },
  },
} as const
