// Phase 18.3: write path for executed_trades (useCreateExecutedTrade).
// Phase 18.4: read path (useOpenExecutedTrades, useExecutedTrade) and
// close mutation (useCloseExecutedTrade).
//
// Reads are intentionally scoped — we don't ship a "list every executed
// trade ever" hook because the Journal page is the canonical trade
// history view and it already queries trade_journal_entries. The
// executed_trades table is consulted only for (a) the currently-open
// trades that still need closing and (b) fetching a single trade by id
// when prefilling the close/review dialog.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import type { AccountMode, ExecutedTrade } from "@/types/trading";

/**
 * Full insert payload for executed_trades. Callers MUST pass account_id
 * and account_mode explicitly — we never guess them. When taking a
 * signal-linked trade, the caller is also responsible for copying the
 * planned_* snapshot from the signal at the exact moment the trade is
 * taken (see TakeTradeDialog for the canonical snapshot logic).
 */
export type ExecutedTradeInsert = Omit<
  Database["public"]["Tables"]["executed_trades"]["Insert"],
  "user_id"
>;

export function useCreateExecutedTrade() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ExecutedTradeInsert) => {
      const { data, error } = await supabase
        .from("executed_trades")
        .insert({ ...payload, user_id: user!.id })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["executed-trades"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-journal"] });
      queryClient.invalidateQueries({ queryKey: ["journal-stats"] });
      queryClient.invalidateQueries({ queryKey: ["daily-risk-trades"] });
      toast.success("Trade opened");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to open trade";
      toast.error(msg);
    },
  });
}

/**
 * Phase 18.4: list the user's currently-open executed_trades (status
 * = 'open') for the close-trade flow. Optionally scoped to demo or real
 * so the Journal page "Open Trades" section inherits the user's active
 * mode filter and never silently mixes demo and real positions.
 */
export function useOpenExecutedTrades(mode?: AccountMode) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["executed-trades", "open", user?.id, mode ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("executed_trades")
        .select("*")
        .eq("user_id", user!.id)
        .eq("result_status", "open")
        .order("opened_at", { ascending: false });
      if (mode) query = query.eq("account_mode", mode);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ExecutedTrade[];
    },
    enabled: !!user,
  });
}

/**
 * Phase 18.8: closed trades that have no linked journal entry. Used
 * by the Journal-page "you have unjournaled trades" reminder so the
 * trader doesn't lose review value when they close a trade outside
 * the dialog (e.g. broker-sync auto-close in a future phase) or
 * intentionally unchecked the journal toggle at close time.
 *
 * Implemented as two queries + an in-memory anti-join because
 * PostgREST has no idiomatic NOT EXISTS. The dataset is the user's
 * own closed trades, so the join is small.
 */
export function useUnjournaledClosedTrades(mode?: AccountMode) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["executed-trades", "unjournaled", user?.id, mode ?? "all"],
    queryFn: async () => {
      let tradesQuery = supabase
        .from("executed_trades")
        .select("*")
        .eq("user_id", user!.id)
        .in("result_status", ["win", "loss", "breakeven"])
        .order("closed_at", { ascending: false });
      if (mode) tradesQuery = tradesQuery.eq("account_mode", mode);
      const { data: trades, error: tradesErr } = await tradesQuery;
      if (tradesErr) throw tradesErr;
      if (!trades || trades.length === 0) return [];

      const tradeIds = trades.map((t) => t.id);
      const { data: journals, error: journalsErr } = await supabase
        .from("trade_journal_entries")
        .select("executed_trade_id")
        .eq("user_id", user!.id)
        .in("executed_trade_id", tradeIds);
      if (journalsErr) throw journalsErr;

      const journaledIds = new Set(
        (journals ?? [])
          .map((j) => j.executed_trade_id)
          .filter((id): id is string => !!id),
      );
      return (trades as ExecutedTrade[]).filter((t) => !journaledIds.has(t.id));
    },
    enabled: !!user,
  });
}

/** Phase 18.4: single trade fetch used when editing / closing from a URL. */
export function useExecutedTrade(id: string | null | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["executed-trades", "by-id", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("executed_trades")
        .select("*")
        .eq("id", id!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as ExecutedTrade | null;
    },
    enabled: !!user && !!id,
  });
}

/**
 * Phase 18.4: close an executed trade and patch its result fields.
 * The caller is responsible for computing pnl / pnl_percent / result
 * from the actual exit price (pip-value calculation lives in the
 * dialog, which already has access to pip-value hooks). This mutation
 * only persists the provided patch and invalidates dependent caches.
 */
export type ExecutedTradeClosePayload = Pick<
  Database["public"]["Tables"]["executed_trades"]["Update"],
  | "actual_exit_price"
  | "closed_at"
  | "result_status"
  | "pnl"
  | "pnl_percent"
  | "notes"
>;

export function useCloseExecutedTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: ExecutedTradeClosePayload;
    }) => {
      const { error } = await supabase
        .from("executed_trades")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["executed-trades"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-journal"] });
      queryClient.invalidateQueries({ queryKey: ["journal-stats"] });
      queryClient.invalidateQueries({ queryKey: ["daily-risk-trades"] });
      toast.success("Trade closed");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to close trade";
      toast.error(msg);
    },
  });
}
