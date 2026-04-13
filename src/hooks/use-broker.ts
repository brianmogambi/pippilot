import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  BrokerConnection,
  SyncedAccount,
  OpenPosition,
  PendingOrder,
  AccountSnapshot,
  SyncLog,
} from "@/types/trading";

// ── Broker connections ─────────────────────────────────────────

/** All broker connections for the current user (safe columns only). */
export function useBrokerConnections() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["broker-connections", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broker_connections")
        .select(
          "id, user_id, broker_type, label, status, last_error, last_synced_at, created_at, updated_at",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Omit<BrokerConnection, "encrypted_credentials">[];
    },
    enabled: !!user,
  });
}

// ── Synced accounts ────────────────────────────────────────────

/** Synced accounts, optionally filtered by connection. */
export function useSyncedAccounts(connectionId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["synced-accounts", user?.id, connectionId],
    queryFn: async () => {
      let query = supabase
        .from("synced_accounts")
        .select("*")
        .eq("user_id", user!.id)
        .order("synced_at", { ascending: false });

      if (connectionId) {
        query = query.eq("connection_id", connectionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SyncedAccount[];
    },
    enabled: !!user,
  });
}

// ── Open positions ─────────────────────────────────────────────

/** Open positions, optionally filtered by synced account. */
export function useOpenPositions(syncedAccountId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["open-positions", user?.id, syncedAccountId],
    queryFn: async () => {
      let query = supabase
        .from("open_positions")
        .select("*")
        .eq("user_id", user!.id)
        .order("opened_at", { ascending: false });

      if (syncedAccountId) {
        query = query.eq("synced_account_id", syncedAccountId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as OpenPosition[];
    },
    enabled: !!user,
  });
}

// ── Pending orders ─────────────────────────────────────────────

/** Pending orders, optionally filtered by synced account. */
export function usePendingOrders(syncedAccountId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["pending-orders", user?.id, syncedAccountId],
    queryFn: async () => {
      let query = supabase
        .from("pending_orders")
        .select("*")
        .eq("user_id", user!.id)
        .order("placed_at", { ascending: false });

      if (syncedAccountId) {
        query = query.eq("synced_account_id", syncedAccountId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PendingOrder[];
    },
    enabled: !!user,
  });
}

// ── Account snapshots ──────────────────────────────────────────

/** Recent equity snapshots for a synced account (for equity curve). */
export function useAccountSnapshots(
  syncedAccountId: string,
  limit = 100,
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["account-snapshots", user?.id, syncedAccountId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_snapshots")
        .select("*")
        .eq("synced_account_id", syncedAccountId)
        .eq("user_id", user!.id)
        .order("snapshot_at", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data as AccountSnapshot[];
    },
    enabled: !!user && !!syncedAccountId,
  });
}

// ── Sync logs ──────────────────────────────────────────────────

/** Recent sync logs for a connection. */
export function useSyncLogs(connectionId: string, limit = 20) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["sync-logs", user?.id, connectionId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_logs")
        .select("*")
        .eq("connection_id", connectionId)
        .eq("user_id", user!.id)
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as SyncLog[];
    },
    enabled: !!user && !!connectionId,
  });
}

// ── Trigger sync ───────────────────────────────────────────────

/** Mutation to trigger a broker data sync via edge function. */
export function useTriggerSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "sync-broker-data",
        { body: { connectionId } },
      );
      if (error) throw error;
      return data as {
        synced: number;
        errors: number;
        results: Array<{
          connectionId: string;
          status: string;
          error?: string;
        }>;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["broker-connections"] });
      queryClient.invalidateQueries({ queryKey: ["synced-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["open-positions"] });
      queryClient.invalidateQueries({ queryKey: ["pending-orders"] });
      queryClient.invalidateQueries({ queryKey: ["account-snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["sync-logs"] });
    },
  });
}
