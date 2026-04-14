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
          review_notes: string | null
          review_tag: string | null
          reviewed_at: string | null
          reviewed_by: string | null
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
          review_notes?: string | null
          review_tag?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
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
          review_notes?: string | null
          review_tag?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
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
      generation_runs: {
        Row: {
          id: string
          function_name: string
          batch_index: number | null
          pairs_processed: string[]
          started_at: string
          finished_at: string | null
          duration_ms: number | null
          status: string
          error_message: string | null
          candles_fetched: number
          signals_created: number
          api_credits_used: number
        }
        Insert: {
          id?: string
          function_name: string
          batch_index?: number | null
          pairs_processed?: string[]
          started_at?: string
          finished_at?: string | null
          duration_ms?: number | null
          status?: string
          error_message?: string | null
          candles_fetched?: number
          signals_created?: number
          api_credits_used?: number
        }
        Update: {
          id?: string
          function_name?: string
          batch_index?: number | null
          pairs_processed?: string[]
          started_at?: string
          finished_at?: string | null
          duration_ms?: number | null
          status?: string
          error_message?: string | null
          candles_fetched?: number
          signals_created?: number
          api_credits_used?: number
        }
        Relationships: []
      }
      indicator_snapshots: {
        Row: {
          id: string
          run_id: string
          symbol: string
          timeframe: string
          price: number
          ema20: number | null
          ema50: number | null
          ema200: number | null
          rsi14: number | null
          atr14: number | null
          macd_hist: number | null
          bb_upper: number | null
          bb_lower: number | null
          bb_width: number | null
          trend: string | null
          created_at: string
        }
        Insert: {
          id?: string
          run_id: string
          symbol: string
          timeframe: string
          price: number
          ema20?: number | null
          ema50?: number | null
          ema200?: number | null
          rsi14?: number | null
          atr14?: number | null
          macd_hist?: number | null
          bb_upper?: number | null
          bb_lower?: number | null
          bb_width?: number | null
          trend?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          run_id?: string
          symbol?: string
          timeframe?: string
          price?: number
          ema20?: number | null
          ema50?: number | null
          ema200?: number | null
          rsi14?: number | null
          atr14?: number | null
          macd_hist?: number | null
          bb_upper?: number | null
          bb_lower?: number | null
          bb_width?: number | null
          trend?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicator_snapshots_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "generation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          id: string
          alert_id: string
          user_id: string
          channel: string
          status: string
          skip_reason: string | null
          error_message: string | null
          attempt_count: number
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          alert_id: string
          user_id: string
          channel: string
          status?: string
          skip_reason?: string | null
          error_message?: string | null
          attempt_count?: number
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          alert_id?: string
          user_id?: string
          channel?: string
          status?: string
          skip_reason?: string | null
          error_message?: string | null
          attempt_count?: number
          sent_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      ohlcv_candles: {
        Row: {
          symbol: string
          timeframe: string
          candle_time: string
          open: number
          high: number
          low: number
          close: number
          volume: number | null
          fetched_at: string
        }
        Insert: {
          symbol: string
          timeframe: string
          candle_time: string
          open: number
          high: number
          low: number
          close: number
          volume?: number | null
          fetched_at?: string
        }
        Update: {
          symbol?: string
          timeframe?: string
          candle_time?: string
          open?: number
          high?: number
          low?: number
          close?: number
          volume?: number | null
          fetched_at?: string
        }
        Relationships: []
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
      market_data_cache: {
        Row: {
          symbol: string
          price: number
          spread: number
          daily_change: number
          daily_change_pct: number
          atr: number
          volatility: string
          trend_h1: string
          trend_h4: string
          trend_d1: string
          active_session: string
          news_risk: boolean
          support_level: number
          resistance_level: number
          session_high: number
          session_low: number
          prev_day_high: number
          prev_day_low: number
          market_structure: string
          updated_at: string
        }
        Insert: {
          symbol: string
          price?: number
          spread?: number
          daily_change?: number
          daily_change_pct?: number
          atr?: number
          volatility?: string
          trend_h1?: string
          trend_h4?: string
          trend_d1?: string
          active_session?: string
          news_risk?: boolean
          support_level?: number
          resistance_level?: number
          session_high?: number
          session_low?: number
          prev_day_high?: number
          prev_day_low?: number
          market_structure?: string
          updated_at?: string
        }
        Update: {
          symbol?: string
          price?: number
          spread?: number
          daily_change?: number
          daily_change_pct?: number
          atr?: number
          volatility?: string
          trend_h1?: string
          trend_h4?: string
          trend_d1?: string
          active_session?: string
          news_risk?: boolean
          support_level?: number
          resistance_level?: number
          session_high?: number
          session_low?: number
          prev_day_high?: number
          prev_day_low?: number
          market_structure?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_currency: string
          account_equity: number | null
          account_size: number | null
          alert_channels: string[] | null
          broker_name: string | null
          created_at: string
          default_risk_pct: number | null
          default_timeframe: string | null
          display_name: string | null
          experience_level: string | null
          id: string
          max_daily_loss_pct: number | null
          notification_email: string | null
          notifications_enabled: boolean | null
          onboarding_completed: boolean | null
          preferred_pairs: string[] | null
          preferred_sessions: string[] | null
          preferred_strategies: string[] | null
          severity_channel_routing: Json | null
          telegram_chat_id: string | null
          timezone: string | null
          trading_style: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_currency?: string
          account_equity?: number | null
          account_size?: number | null
          alert_channels?: string[] | null
          broker_name?: string | null
          created_at?: string
          default_risk_pct?: number | null
          default_timeframe?: string | null
          display_name?: string | null
          experience_level?: string | null
          id?: string
          max_daily_loss_pct?: number | null
          notification_email?: string | null
          notifications_enabled?: boolean | null
          onboarding_completed?: boolean | null
          preferred_pairs?: string[] | null
          preferred_sessions?: string[] | null
          preferred_strategies?: string[] | null
          severity_channel_routing?: Json | null
          telegram_chat_id?: string | null
          timezone?: string | null
          trading_style?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_currency?: string
          account_equity?: number | null
          account_size?: number | null
          alert_channels?: string[] | null
          broker_name?: string | null
          created_at?: string
          default_risk_pct?: number | null
          default_timeframe?: string | null
          display_name?: string | null
          experience_level?: string | null
          id?: string
          max_daily_loss_pct?: number | null
          notification_email?: string | null
          notifications_enabled?: boolean | null
          onboarding_completed?: boolean | null
          preferred_pairs?: string[] | null
          preferred_sessions?: string[] | null
          preferred_strategies?: string[] | null
          severity_channel_routing?: Json | null
          telegram_chat_id?: string | null
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
          review_notes: string | null
          review_tag: string | null
          reviewed_at: string | null
          reviewed_by: string | null
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
          review_notes?: string | null
          review_tag?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
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
          review_notes?: string | null
          review_tag?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
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
      executed_trades: {
        Row: {
          account_id: string
          account_mode: string
          actual_entry_price: number
          actual_exit_price: number | null
          actual_stop_loss: number | null
          actual_take_profit: number | null
          broker_position_id: string | null
          closed_at: string | null
          created_at: string
          direction: string
          id: string
          lot_size: number | null
          notes: string | null
          opened_at: string
          planned_confidence: number | null
          planned_entry_high: number | null
          planned_entry_low: number | null
          planned_reasoning_snapshot: string | null
          planned_setup_type: string | null
          planned_stop_loss: number | null
          planned_take_profit_1: number | null
          planned_take_profit_2: number | null
          planned_timeframe: string | null
          pnl: number | null
          pnl_percent: number | null
          position_size: number | null
          result_status: string
          signal_id: string | null
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          account_mode: string
          actual_entry_price: number
          actual_exit_price?: number | null
          actual_stop_loss?: number | null
          actual_take_profit?: number | null
          broker_position_id?: string | null
          closed_at?: string | null
          created_at?: string
          direction: string
          id?: string
          lot_size?: number | null
          notes?: string | null
          opened_at?: string
          planned_confidence?: number | null
          planned_entry_high?: number | null
          planned_entry_low?: number | null
          planned_reasoning_snapshot?: string | null
          planned_setup_type?: string | null
          planned_stop_loss?: number | null
          planned_take_profit_1?: number | null
          planned_take_profit_2?: number | null
          planned_timeframe?: string | null
          pnl?: number | null
          pnl_percent?: number | null
          position_size?: number | null
          result_status?: string
          signal_id?: string | null
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          account_mode?: string
          actual_entry_price?: number
          actual_exit_price?: number | null
          actual_stop_loss?: number | null
          actual_take_profit?: number | null
          broker_position_id?: string | null
          closed_at?: string | null
          created_at?: string
          direction?: string
          id?: string
          lot_size?: number | null
          notes?: string | null
          opened_at?: string
          planned_confidence?: number | null
          planned_entry_high?: number | null
          planned_entry_low?: number | null
          planned_reasoning_snapshot?: string | null
          planned_setup_type?: string | null
          planned_stop_loss?: number | null
          planned_take_profit_1?: number | null
          planned_take_profit_2?: number | null
          planned_timeframe?: string | null
          pnl?: number | null
          pnl_percent?: number | null
          position_size?: number | null
          result_status?: string
          signal_id?: string | null
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "executed_trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "trading_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executed_trades_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_analyses: {
        Row: {
          created_at: string
          details: Json
          discipline_score: number | null
          executed_trade_id: string
          execution_quality_score: number | null
          flags: string[]
          id: string
          improvement_actions: string[]
          primary_outcome_reason: string | null
          risk_management_score: number | null
          rule_version: string
          signal_quality_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          discipline_score?: number | null
          executed_trade_id: string
          execution_quality_score?: number | null
          flags?: string[]
          id?: string
          improvement_actions?: string[]
          primary_outcome_reason?: string | null
          risk_management_score?: number | null
          rule_version?: string
          signal_quality_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          discipline_score?: number | null
          executed_trade_id?: string
          execution_quality_score?: number | null
          flags?: string[]
          id?: string
          improvement_actions?: string[]
          primary_outcome_reason?: string | null
          risk_management_score?: number | null
          rule_version?: string
          signal_quality_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_analyses_executed_trade_id_fkey"
            columns: ["executed_trade_id"]
            isOneToOne: true
            referencedRelation: "executed_trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_journal_entries: {
        Row: {
          account_mode: string
          closed_at: string | null
          confidence: number | null
          created_at: string
          direction: string
          discipline_rating: number | null
          emotion_after: string | null
          emotion_before: string | null
          emotional_notes: string | null
          entry_price: number
          executed_trade_id: string | null
          execution_rating: number | null
          exit_price: number | null
          followed_plan: boolean
          id: string
          lesson_learned: string | null
          lot_size: number | null
          mistake_tags: string[]
          notes: string | null
          opened_at: string
          pair: string
          result_amount: number | null
          result_pips: number | null
          screenshot_after: string | null
          screenshot_before: string | null
          screenshot_url: string | null
          setup_rating: number | null
          setup_reasoning: string | null
          setup_type: string | null
          status: string
          stop_loss: number | null
          take_profit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_mode?: string
          closed_at?: string | null
          confidence?: number | null
          created_at?: string
          direction: string
          discipline_rating?: number | null
          emotion_after?: string | null
          emotion_before?: string | null
          emotional_notes?: string | null
          entry_price: number
          executed_trade_id?: string | null
          execution_rating?: number | null
          exit_price?: number | null
          followed_plan?: boolean
          id?: string
          lesson_learned?: string | null
          lot_size?: number | null
          mistake_tags?: string[]
          notes?: string | null
          opened_at?: string
          pair: string
          result_amount?: number | null
          result_pips?: number | null
          screenshot_after?: string | null
          screenshot_before?: string | null
          screenshot_url?: string | null
          setup_rating?: number | null
          setup_reasoning?: string | null
          setup_type?: string | null
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_mode?: string
          closed_at?: string | null
          confidence?: number | null
          created_at?: string
          direction?: string
          discipline_rating?: number | null
          emotion_after?: string | null
          emotion_before?: string | null
          emotional_notes?: string | null
          entry_price?: number
          executed_trade_id?: string | null
          execution_rating?: number | null
          exit_price?: number | null
          followed_plan?: boolean
          id?: string
          lesson_learned?: string | null
          lot_size?: number | null
          mistake_tags?: string[]
          notes?: string | null
          opened_at?: string
          pair?: string
          result_amount?: number | null
          result_pips?: number | null
          screenshot_after?: string | null
          screenshot_before?: string | null
          screenshot_url?: string | null
          setup_rating?: number | null
          setup_reasoning?: string | null
          setup_type?: string | null
          status?: string
          stop_loss?: number | null
          take_profit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_journal_entries_executed_trade_id_fkey"
            columns: ["executed_trade_id"]
            isOneToOne: false
            referencedRelation: "executed_trades"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_accounts: {
        Row: {
          account_currency: string
          account_mode: string
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
          account_mode?: string
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
          account_mode?: string
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
      pair_analyses: {
        Row: {
          id: string
          signal_id: string | null
          pair: string
          setup_type: string
          direction: string
          entry_zone_low: number
          entry_zone_high: number
          stop_loss: number
          tp1: number
          tp2: number | null
          tp3: number | null
          confidence: number
          setup_quality: string
          invalidation: string
          beginner_explanation: string
          expert_explanation: string
          reasons_for: string[]
          reasons_against: string[]
          no_trade_reason: string | null
          verdict: string
          created_at: string
        }
        Insert: {
          id?: string
          signal_id?: string | null
          pair: string
          setup_type: string
          direction: string
          entry_zone_low: number
          entry_zone_high: number
          stop_loss: number
          tp1: number
          tp2?: number | null
          tp3?: number | null
          confidence: number
          setup_quality: string
          invalidation: string
          beginner_explanation?: string
          expert_explanation?: string
          reasons_for?: string[]
          reasons_against?: string[]
          no_trade_reason?: string | null
          verdict: string
          created_at?: string
        }
        Update: {
          id?: string
          signal_id?: string | null
          pair?: string
          setup_type?: string
          direction?: string
          entry_zone_low?: number
          entry_zone_high?: number
          stop_loss?: number
          tp1?: number
          tp2?: number | null
          tp3?: number | null
          confidence?: number
          setup_quality?: string
          invalidation?: string
          beginner_explanation?: string
          expert_explanation?: string
          reasons_for?: string[]
          reasons_against?: string[]
          no_trade_reason?: string | null
          verdict?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pair_analyses_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    // ── Phase 14: Broker integration tables ──────────────────────
      broker_connections: {
        Row: {
          id: string
          user_id: string
          broker_type: string
          label: string
          encrypted_credentials: Json
          status: string
          last_error: string | null
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          broker_type: string
          label?: string
          encrypted_credentials?: Json
          status?: string
          last_error?: string | null
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          broker_type?: string
          label?: string
          encrypted_credentials?: Json
          status?: string
          last_error?: string | null
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      synced_accounts: {
        Row: {
          id: string
          connection_id: string
          user_id: string
          broker_account_id: string
          account_name: string | null
          currency: string
          balance: number
          equity: number
          margin_used: number
          free_margin: number
          leverage: number | null
          server_name: string | null
          is_live: boolean
          synced_at: string
          created_at: string
        }
        Insert: {
          id?: string
          connection_id: string
          user_id: string
          broker_account_id: string
          account_name?: string | null
          currency?: string
          balance?: number
          equity?: number
          margin_used?: number
          free_margin?: number
          leverage?: number | null
          server_name?: string | null
          is_live?: boolean
          synced_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          connection_id?: string
          user_id?: string
          broker_account_id?: string
          account_name?: string | null
          currency?: string
          balance?: number
          equity?: number
          margin_used?: number
          free_margin?: number
          leverage?: number | null
          server_name?: string | null
          is_live?: boolean
          synced_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "synced_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      open_positions: {
        Row: {
          id: string
          synced_account_id: string
          user_id: string
          broker_ticket_id: string
          symbol: string
          direction: string
          volume: number
          open_price: number
          current_price: number | null
          stop_loss: number | null
          take_profit: number | null
          swap: number
          commission: number
          unrealized_pnl: number
          opened_at: string
          synced_at: string
        }
        Insert: {
          id?: string
          synced_account_id: string
          user_id: string
          broker_ticket_id: string
          symbol: string
          direction: string
          volume: number
          open_price: number
          current_price?: number | null
          stop_loss?: number | null
          take_profit?: number | null
          swap?: number
          commission?: number
          unrealized_pnl?: number
          opened_at: string
          synced_at?: string
        }
        Update: {
          id?: string
          synced_account_id?: string
          user_id?: string
          broker_ticket_id?: string
          symbol?: string
          direction?: string
          volume?: number
          open_price?: number
          current_price?: number | null
          stop_loss?: number | null
          take_profit?: number | null
          swap?: number
          commission?: number
          unrealized_pnl?: number
          opened_at?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_positions_synced_account_id_fkey"
            columns: ["synced_account_id"]
            isOneToOne: false
            referencedRelation: "synced_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_orders: {
        Row: {
          id: string
          synced_account_id: string
          user_id: string
          broker_ticket_id: string
          symbol: string
          order_type: string
          volume: number
          price: number
          stop_loss: number | null
          take_profit: number | null
          expiration: string | null
          placed_at: string
          synced_at: string
        }
        Insert: {
          id?: string
          synced_account_id: string
          user_id: string
          broker_ticket_id: string
          symbol: string
          order_type: string
          volume: number
          price: number
          stop_loss?: number | null
          take_profit?: number | null
          expiration?: string | null
          placed_at: string
          synced_at?: string
        }
        Update: {
          id?: string
          synced_account_id?: string
          user_id?: string
          broker_ticket_id?: string
          symbol?: string
          order_type?: string
          volume?: number
          price?: number
          stop_loss?: number | null
          take_profit?: number | null
          expiration?: string | null
          placed_at?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_orders_synced_account_id_fkey"
            columns: ["synced_account_id"]
            isOneToOne: false
            referencedRelation: "synced_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_snapshots: {
        Row: {
          id: string
          synced_account_id: string
          user_id: string
          balance: number
          equity: number
          margin_used: number
          open_positions_count: number
          unrealized_pnl: number
          snapshot_at: string
        }
        Insert: {
          id?: string
          synced_account_id: string
          user_id: string
          balance: number
          equity: number
          margin_used?: number
          open_positions_count?: number
          unrealized_pnl?: number
          snapshot_at?: string
        }
        Update: {
          id?: string
          synced_account_id?: string
          user_id?: string
          balance?: number
          equity?: number
          margin_used?: number
          open_positions_count?: number
          unrealized_pnl?: number
          snapshot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_snapshots_synced_account_id_fkey"
            columns: ["synced_account_id"]
            isOneToOne: false
            referencedRelation: "synced_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          id: string
          connection_id: string
          user_id: string
          sync_type: string
          status: string
          items_synced: number
          duration_ms: number | null
          error_message: string | null
          started_at: string
          finished_at: string | null
        }
        Insert: {
          id?: string
          connection_id: string
          user_id: string
          sync_type: string
          status: string
          items_synced?: number
          duration_ms?: number | null
          error_message?: string | null
          started_at?: string
          finished_at?: string | null
        }
        Update: {
          id?: string
          connection_id?: string
          user_id?: string
          sync_type?: string
          status?: string
          items_synced?: number
          duration_ms?: number | null
          error_message?: string | null
          started_at?: string
          finished_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "broker_connections"
            referencedColumns: ["id"]
          },
        ]
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
