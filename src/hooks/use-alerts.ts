import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Alert } from "@/types/trading";
import type { AlertEventKind } from "@/lib/alert-engine";
import { toast } from "sonner";

// Phase 7: enriched payload — joins the source signal via FK so the
// dashboard widget can render setup type / direction inline.
export type EnrichedAlert = Alert & {
  event_kind: AlertEventKind | null;
  analysis_run_id: string | null;
  signal: {
    setup_type: string | null;
    direction: string | null;
    confidence: number | null;
    entry_price: number | string | null;
    verdict: string | null;
  } | null;
};

const ENRICHED_SELECT =
  "*, signal:signals!alerts_signal_id_fkey(setup_type, direction, confidence, entry_price, verdict)";

export function useAlerts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["alerts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Alert[];
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000, // poll every minute for new alerts
  });
}

export function useDashboardAlerts(limit = 5) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-alerts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []) as Alert[];
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useUnreadAlertCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["unread-alerts", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      return count ?? 0;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase.from("alerts").update({ is_read: true }).eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["unread-alerts"] });
    },
  });
}

export function useEnrichedAlerts(opts?: { kinds?: AlertEventKind[] }) {
  const { user } = useAuth();
  const kinds = opts?.kinds;

  return useQuery({
    queryKey: ["enriched-alerts", user?.id, kinds?.join(",") ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("alerts")
        .select(ENRICHED_SELECT)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (kinds && kinds.length > 0) {
        query = query.in("event_kind" as never, kinds as never);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as EnrichedAlert[];
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useDashboardAlertsEnriched(limit = 5) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-alerts-enriched", user?.id, limit],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select(ENRICHED_SELECT)
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []) as unknown as EnrichedAlert[];
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMarkAllAlertsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("alerts")
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["unread-alerts"] });
      toast.success("All alerts marked as read");
    },
  });
}
