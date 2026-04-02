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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_usage_logs: {
        Row: {
          cost: number
          cost_usd: number
          created_at: string
          id: string
          model: string
          tokens: number
          user_id: string
        }
        Insert: {
          cost: number
          cost_usd: number
          created_at?: string
          id?: string
          model: string
          tokens: number
          user_id: string
        }
        Update: {
          cost?: number
          cost_usd?: number
          created_at?: string
          id?: string
          model?: string
          tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      business_materials: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      business_profiles: {
        Row: {
          canais: string[] | null
          como_ia_ajuda: string | null
          created_at: string
          id: string
          maior_desafio: string | null
          marca_descricao: string | null
          nicho: string | null
          nivel_experiencia: string | null
          nome_empresa: string
          objetivo_principal: string | null
          publico_alvo: string | null
          questionario_completo: boolean
          segmento_atuacao: string | null
          tipos_conteudo: string[] | null
          tom_comunicacao: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          canais?: string[] | null
          como_ia_ajuda?: string | null
          created_at?: string
          id?: string
          maior_desafio?: string | null
          marca_descricao?: string | null
          nicho?: string | null
          nivel_experiencia?: string | null
          nome_empresa: string
          objetivo_principal?: string | null
          publico_alvo?: string | null
          questionario_completo?: boolean
          segmento_atuacao?: string | null
          tipos_conteudo?: string[] | null
          tom_comunicacao?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          canais?: string[] | null
          como_ia_ajuda?: string | null
          created_at?: string
          id?: string
          maior_desafio?: string | null
          marca_descricao?: string | null
          nicho?: string | null
          nivel_experiencia?: string | null
          nome_empresa?: string
          objetivo_principal?: string | null
          publico_alvo?: string | null
          questionario_completo?: boolean
          segmento_atuacao?: string | null
          tipos_conteudo?: string[] | null
          tom_comunicacao?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      credits: {
        Row: {
          balance: number
          id: string
          last_reset_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          last_reset_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          last_reset_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_images: {
        Row: {
          created_at: string
          credits_used: number
          id: string
          image_url: string
          model: string
          negative_prompt: string | null
          optimized_prompt: string | null
          prompt: string
          quality: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          id?: string
          image_url: string
          model: string
          negative_prompt?: string | null
          optimized_prompt?: string | null
          prompt: string
          quality?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          id?: string
          image_url?: string
          model?: string
          negative_prompt?: string | null
          optimized_prompt?: string | null
          prompt?: string
          quality?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          gateway: string | null
          gateway_subscription_id: string | null
          id: string
          plan: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          gateway?: string | null
          gateway_subscription_id?: string | null
          id?: string
          plan?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          gateway?: string | null
          gateway_subscription_id?: string | null
          id?: string
          plan?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_id: string
          gateway: string
          processed_at: string
        }
        Insert: {
          event_id: string
          gateway: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          gateway?: string
          processed_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_credits:
        | {
            Args: {
              p_amount: number
              p_description?: string
              p_type?: string
              p_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_amount: number
              p_description?: string
              p_reference_id?: string
              p_type?: string
              p_user_id: string
            }
            Returns: undefined
          }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      deduct_credits: {
        Args: { p_amount: number; p_description?: string; p_user_id: string }
        Returns: undefined
      }
      deduct_credits_secure: {
        Args: { p_amount: number; p_description?: string }
        Returns: undefined
      }
      reset_credits_for_subscription: {
        Args: { p_amount: number; p_reference_id?: string; p_user_id: string }
        Returns: undefined
      }
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
