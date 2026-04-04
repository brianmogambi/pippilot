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
      alerts: {
        Row: {
          condition: string
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          pair: string
          severity: string
          signal_id: string
          status: string
          timeframe: string | null
          title: string | null
          triggered_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          condition: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          pair: string
          severity?: string
          signal_id: string
          status?: string
          timeframe?: string | null
          title?: string | null
          triggered_at?: string | null
          type?: string
          user_id: string
        }
        Update: {
          condition?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          pair?: string
          severity?: string
          signal_id?: string
          status?: string
          timeframe?: string | null
          title?: string | null
          triggered_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          base_currency: string
          created_at: string
          id: string
          instrument_type: string
          is_active: boolean
          pip_value: number | null
          quote_currency: string
          symbol: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          id?: string
          instrument_type?: string
          is_active?: boolean
          pip_value?: number | null
          quote_currency: string
          symbol: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          id?: string
          instrument_type?: string
          is_active?: boolean
          pip_value?: number | null
          quote_currency?: string
          symbol?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_currency: string
          account_equity: number | null
          account_size: number | null
          broker_name: string | null
          created_at: string
          default_risk_pct: number | null
          display_name: string | null
          experience_level: string | null
          id: string
          max_daily_loss_pct: number | null
          notifications_enabled: boolean | null
          onboarding_completed: boolean | null
          preferred_pairs: string[] | null
          preferred_sessions: string[] | null
          timezone: string | null
          trading_style: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_currency?: string
          account_equity?: number | null
          account_size?: number | null
          broker_name?: string | null
          created_at?: string
          default_risk_pct?: number | null
          display_name?: string | null
          experience_level?: string | null
          id?: string
          max_daily_loss_pct?: number | null
          notifications_enabled?: boolean | null
          onboarding_completed?: boolean | null
          preferred_pairs?: string[] | null
          preferred_sessions?: string[] | null
          timezone?: string | null
          trading_style?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_currency?: string
          account_equity?: number | null
          account_size?: number | null
          broker_name?: string | null
          created_at?: string
          default_risk_pct?: number | null
          display_name?: string | null
          experience_level?: string | null
          id?: string
          max_daily_loss_pct?: number | null
          notifications_enabled?: boolean | null
          onboarding_completed?: boolean | null
          preferred_pairs?: string[] | null
          preferred_sessions?: string[] | null
          timezone?: string | null
          trading_style?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          ai_reasoning: string
          confidence: number
          created_at: string
          created_by_ai: boolean
          direction: string
          entry_price: number
          id: string
          invalidation_reason: string | null
          pair: string
          setup_type: string | null
          status: string
          stop_loss: number
          take_profit_1: number
          take_profit_2: number | null
          take_profit_3: number | null
          timeframe: string
          updated_at: string
          verdict: string
        }
        Insert: {
          ai_reasoning: string
          confidence: number
          created_at?: string
          created_by_ai?: boolean
          direction: string
          entry_price: number
          id?: string
          invalidation_reason?: string | null
          pair: string
          setup_type?: string | null
          status?: string
          stop_loss: number
          take_profit_1: number
          take_profit_2?: number | null
          take_profit_3?: number | null
          timeframe: string
          updated_at?: string
          verdict: string
        }
        Update: {
          ai_reasoning?: string
          confidence?: number
          created_at?: string
          created_by_ai?: boolean
          direction?: string
          entry_price?: number
          id?: string
          invalidation_reason?: string | null
          pair?: string
          setup_type?: string | null
          status?: string
          stop_loss?: number
          take_profit_1?: number
          take_profit_2?: number | null
          take_profit_3?: number | null
          timeframe?: string
          updated_at?: string
          verdict?: string
        }
        Relationships: []
      }
      trade_journal_entries: {
        Row: {
          closed_at: string | null
          confidence: number | null
          created_at: string
          direction: string
          emotional_notes: string | null
          entry_price: number
          exit_price: number | null
          followed_plan: boolean
          id: string
          lesson_learned: string | null
          lot_size: number | null
          notes: string | null
          opened_at: string
          pair: string
          result_amount: number | null
          result_pips: number | null
          screenshot_url: string | null
          setup_reasoning: string | null
          setup_type: string | null
          status: string
          stop_loss: number | null
          take_profit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          confidence?: number | null
          created_at?: string
          direction: string
          emotional_notes?: string | null
          entry_price: number
          exit_price?: number | null
          followed_plan?: boolean
          id?: string
          lesson_learned?: string | null
          lot_size?: number | null
          notes?: string | null
          opened_at?: string
          pair: string
          result_amount?: number | null
          result_pips?: number | null
          screenshot_url?: string | null
          setup_reasoning?: string | null
          setup_type?: string | null
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          confidence?: number | null
          created_at?: string
          direction?: string
          emotional_notes?: string | null
          entry_price?: number
          exit_price?: number | null
          followed_plan?: boolean
          id?: string
          lesson_learned?: string | null
          lot_size?: number | null
          notes?: string | null
          opened_at?: string
          pair?: string
          result_amount?: number | null
          result_pips?: number | null
          screenshot_url?: string | null
          setup_reasoning?: string | null
          setup_type?: string | null
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trading_accounts: {
        Row: {
          account_currency: string
          account_name: string
          balance: number
          broker_name: string | null
          created_at: string
          equity: number
          id: string
          is_default: boolean
          leverage: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_currency?: string
          account_name?: string
          balance?: number
          broker_name?: string | null
          created_at?: string
          equity?: number
          id?: string
          is_default?: boolean
          leverage?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_currency?: string
          account_name?: string
          balance?: number
          broker_name?: string | null
          created_at?: string
          equity?: number
          id?: string
          is_default?: boolean
          leverage?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_risk_profiles: {
        Row: {
          conservative_mode: boolean
          created_at: string
          id: string
          max_daily_loss_pct: number
          max_total_open_risk_pct: number
          risk_per_trade_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          conservative_mode?: boolean
          created_at?: string
          id?: string
          max_daily_loss_pct?: number
          max_total_open_risk_pct?: number
          risk_per_trade_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          conservative_mode?: boolean
          created_at?: string
          id?: string
          max_daily_loss_pct?: number
          max_total_open_risk_pct?: number
          risk_per_trade_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_watchlist: {
        Row: {
          created_at: string
          id: string
          pair: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pair: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pair?: string
          user_id?: string
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
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
