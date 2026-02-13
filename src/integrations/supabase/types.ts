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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      category_trees: {
        Row: {
          categories: Json
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?: Json
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?: Json
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_tags: {
        Row: {
          ai_model: string | null
          combined_tags: string | null
          created_at: string
          generated_tags: string[]
          id: string
          metadata: Json | null
          original_tags: string | null
          product_name: string | null
          product_sku: string
          prompt_used: string | null
          session_id: string | null
          tag_group: string
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          combined_tags?: string | null
          created_at?: string
          generated_tags?: string[]
          id?: string
          metadata?: Json | null
          original_tags?: string | null
          product_name?: string | null
          product_sku: string
          prompt_used?: string | null
          session_id?: string | null
          tag_group?: string
          user_id: string
        }
        Update: {
          ai_model?: string | null
          combined_tags?: string | null
          created_at?: string
          generated_tags?: string[]
          id?: string
          metadata?: Json | null
          original_tags?: string | null
          product_name?: string | null
          product_sku?: string
          prompt_used?: string | null
          session_id?: string | null
          tag_group?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_tags_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "product_enrichment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_images: {
        Row: {
          created_at: string
          file_size_bytes: number | null
          format: string | null
          height: number | null
          id: string
          is_background_removed: boolean | null
          metadata: Json | null
          original_url: string | null
          product_name: string | null
          product_sku: string
          public_url: string
          session_id: string | null
          source_type: string
          storage_path: string
          user_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          file_size_bytes?: number | null
          format?: string | null
          height?: number | null
          id?: string
          is_background_removed?: boolean | null
          metadata?: Json | null
          original_url?: string | null
          product_name?: string | null
          product_sku: string
          public_url: string
          session_id?: string | null
          source_type: string
          storage_path: string
          user_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          file_size_bytes?: number | null
          format?: string | null
          height?: number | null
          id?: string
          is_background_removed?: boolean | null
          metadata?: Json | null
          original_url?: string | null
          product_name?: string | null
          product_sku?: string
          public_url?: string
          session_id?: string | null
          source_type?: string
          storage_path?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "processed_images_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "product_enrichment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_logs: {
        Row: {
          abbreviations_applied: number | null
          created_at: string
          duplicates_found: number | null
          filename: string
          id: string
          original_columns: Json | null
          processed_columns: Json | null
          rows_processed: number | null
          user_id: string
        }
        Insert: {
          abbreviations_applied?: number | null
          created_at?: string
          duplicates_found?: number | null
          filename: string
          id?: string
          original_columns?: Json | null
          processed_columns?: Json | null
          rows_processed?: number | null
          user_id: string
        }
        Update: {
          abbreviations_applied?: number | null
          created_at?: string
          duplicates_found?: number | null
          filename?: string
          id?: string
          original_columns?: Json | null
          processed_columns?: Json | null
          rows_processed?: number | null
          user_id?: string
        }
        Relationships: []
      }
      product_enrichment_sessions: {
        Row: {
          created_at: string
          duplicates_found: number
          id: string
          images_added: number
          items_processed: number
          metadata: Json | null
          original_filename: string
          status: string
          tags_generated: number
          total_items: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duplicates_found?: number
          id?: string
          images_added?: number
          items_processed?: number
          metadata?: Json | null
          original_filename: string
          status?: string
          tags_generated?: number
          total_items?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duplicates_found?: number
          id?: string
          images_added?: number
          items_processed?: number
          metadata?: Json | null
          original_filename?: string
          status?: string
          tags_generated?: number
          total_items?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      produtos_processados: {
        Row: {
          categoria_inferida: string | null
          created_at: string
          descricao_enriquecida: string | null
          id: string
          marca_inferida: string | null
          metadata: Json | null
          modelo_ia: string | null
          necessita_revisao: boolean
          nome_padronizado: string | null
          origem_inferida: string | null
          produto_original: Json
          razao_revisao: string | null
          session_id: string | null
          tempo_processamento_ms: number | null
          updated_at: string
          user_id: string
          validado: boolean
          validado_em: string | null
        }
        Insert: {
          categoria_inferida?: string | null
          created_at?: string
          descricao_enriquecida?: string | null
          id?: string
          marca_inferida?: string | null
          metadata?: Json | null
          modelo_ia?: string | null
          necessita_revisao?: boolean
          nome_padronizado?: string | null
          origem_inferida?: string | null
          produto_original: Json
          razao_revisao?: string | null
          session_id?: string | null
          tempo_processamento_ms?: number | null
          updated_at?: string
          user_id: string
          validado?: boolean
          validado_em?: string | null
        }
        Update: {
          categoria_inferida?: string | null
          created_at?: string
          descricao_enriquecida?: string | null
          id?: string
          marca_inferida?: string | null
          metadata?: Json | null
          modelo_ia?: string | null
          necessita_revisao?: boolean
          nome_padronizado?: string | null
          origem_inferida?: string | null
          produto_original?: Json
          razao_revisao?: string | null
          session_id?: string | null
          tempo_processamento_ms?: number | null
          updated_at?: string
          user_id?: string
          validado?: boolean
          validado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_processados_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "product_enrichment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_configurations: {
        Row: {
          abbreviations: Json | null
          column_config: Json | null
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          abbreviations?: Json | null
          column_config?: Json | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          abbreviations?: Json | null
          column_config?: Json | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presets: {
        Row: {
          abbreviations: Json
          column_config: Json
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          abbreviations?: Json
          column_config?: Json
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          abbreviations?: Json
          column_config?: Json
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
